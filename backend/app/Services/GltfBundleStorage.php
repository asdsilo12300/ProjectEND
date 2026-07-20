<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use JsonException;
use RuntimeException;
use Throwable;

class GltfBundleStorage
{
    private const RESOURCE_EXTENSIONS = ['bin', 'png', 'jpg', 'jpeg', 'webp'];

    public function __construct(private readonly MediaStorage $media) {}

    /**
     * @param  array<int, UploadedFile>  $resources
     * @param  array<int, string>  $resourcePaths
     * @return array{reference: string, url: string, path: string, files: array<int, string>, dependency_count: int, size: int, sha256: string}
     */
    public function store(UploadedFile $model, array $resources = [], array $resourcePaths = []): array
    {
        $modelContents = file_get_contents($model->getRealPath());
        if ($modelContents === false) {
            throw ValidationException::withMessages(['model' => 'The GLTF file could not be read.']);
        }

        $document = $this->parseDocument($modelContents);
        $requiredDependencies = $this->requiredDependencies($document);
        $uploads = $this->describeUploads($resources, $resourcePaths);
        $matchedDependencies = $this->matchDependencies($requiredDependencies, $uploads);

        $directory = 'model-bundles/'.Str::uuid();
        $modelPath = $directory.'/model.gltf';
        $storedPaths = [];

        try {
            $this->storeFile($modelPath, $modelContents, 'model/gltf+json');
            $storedPaths[] = $modelPath;

            foreach ($matchedDependencies as $relativePath => $file) {
                $contents = file_get_contents($file->getRealPath());
                if ($contents === false) {
                    throw new RuntimeException("Unable to read supporting file {$file->getClientOriginalName()}.");
                }

                $path = $directory.'/'.$relativePath;
                $this->storeFile($path, $contents, $this->contentType($relativePath));
                $storedPaths[] = $path;
            }
        } catch (Throwable $exception) {
            foreach ($storedPaths as $path) {
                $this->media->deleteFromReference($path);
            }

            throw $exception;
        }

        $totalSize = (int) $model->getSize();
        foreach ($matchedDependencies as $file) {
            $totalSize += (int) $file->getSize();
        }

        return [
            'reference' => $this->media->reference($modelPath),
            'url' => $this->media->publicUrl($modelPath),
            'path' => $modelPath,
            'files' => $storedPaths,
            'dependency_count' => count($matchedDependencies),
            'size' => $totalSize,
            'sha256' => hash('sha256', $modelContents),
        ];
    }

    private function parseDocument(string $contents): array
    {
        try {
            $document = json_decode($contents, true, flags: JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            throw ValidationException::withMessages(['model' => 'The selected file is not valid GLTF JSON.']);
        }

        if (! is_array($document) || ! str_starts_with((string) data_get($document, 'asset.version', ''), '2')) {
            throw ValidationException::withMessages(['model' => 'Only GLTF 2.x models are supported.']);
        }

        return $document;
    }

    /** @return array<int, string> */
    private function requiredDependencies(array $document): array
    {
        $uris = [];

        foreach ((array) ($document['buffers'] ?? []) as $buffer) {
            $uri = is_array($buffer) ? ($buffer['uri'] ?? null) : null;
            if (! is_string($uri) || trim($uri) === '') {
                throw ValidationException::withMessages([
                    'model' => 'A .gltf file with binary data must reference an external .bin file.',
                ]);
            }
            $uris[] = $uri;
        }

        foreach ((array) ($document['images'] ?? []) as $image) {
            $uri = is_array($image) ? ($image['uri'] ?? null) : null;
            if (is_string($uri) && trim($uri) !== '') {
                $uris[] = $uri;
            }
        }

        $paths = [];
        foreach ($uris as $uri) {
            if (str_starts_with(strtolower(trim($uri)), 'data:')) {
                continue;
            }

            $path = $this->normalizeReferencedPath($uri);
            $extension = strtolower(pathinfo($path, PATHINFO_EXTENSION));
            if (! in_array($extension, self::RESOURCE_EXTENSIONS, true)) {
                throw ValidationException::withMessages([
                    'model' => "The GLTF references an unsupported file type: {$path}.",
                ]);
            }
            $paths[$path] = $path;
        }

        return array_values($paths);
    }

    private function normalizeReferencedPath(string $uri): string
    {
        $path = preg_split('/[?#]/', trim($uri), 2)[0] ?? '';
        $path = rawurldecode(str_replace('\\', '/', $path));

        if ($path === '' || str_starts_with($path, '/') || str_starts_with($path, '//') || preg_match('/^[a-z][a-z0-9+.-]*:/i', $path)) {
            throw ValidationException::withMessages([
                'model' => 'GLTF dependencies must use local relative paths, not external URLs.',
            ]);
        }

        $segments = [];
        foreach (explode('/', $path) as $segment) {
            if ($segment === '' || $segment === '.') {
                continue;
            }
            if ($segment === '..') {
                throw ValidationException::withMessages([
                    'model' => 'GLTF dependencies may not access a parent folder.',
                ]);
            }
            $segments[] = $segment;
        }

        if ($segments === []) {
            throw ValidationException::withMessages(['model' => 'The GLTF contains an invalid dependency path.']);
        }

        return implode('/', $segments);
    }

    /**
     * @param  array<int, UploadedFile>  $files
     * @param  array<int, string>  $paths
     * @return array<int, array{file: UploadedFile, path: string}>
     */
    private function describeUploads(array $files, array $paths): array
    {
        $uploads = [];
        foreach (array_values($files) as $index => $file) {
            $path = trim((string) ($paths[$index] ?? $file->getClientOriginalName()));
            $path = rawurldecode(str_replace('\\', '/', $path));
            $segments = array_values(array_filter(explode('/', $path), fn (string $segment): bool => $segment !== '' && $segment !== '.'));

            if ($segments === [] || in_array('..', $segments, true)) {
                throw ValidationException::withMessages(['resources' => 'A supporting file has an unsafe relative path.']);
            }

            $uploads[] = ['file' => $file, 'path' => implode('/', $segments)];
        }

        return $uploads;
    }

    /**
     * @param  array<int, string>  $required
     * @param  array<int, array{file: UploadedFile, path: string}>  $uploads
     * @return array<string, UploadedFile>
     */
    private function matchDependencies(array $required, array $uploads): array
    {
        $matches = [];

        foreach ($required as $requiredPath) {
            $exact = array_values(array_filter($uploads, fn (array $upload): bool => $upload['path'] === $requiredPath || str_ends_with($upload['path'], '/'.$requiredPath)
            ));
            $candidates = $exact !== [] ? $exact : array_values(array_filter($uploads, fn (array $upload): bool => basename($upload['path']) === basename($requiredPath)
            ));

            if ($candidates === []) {
                throw ValidationException::withMessages([
                    'resources' => "The model needs supporting file {$requiredPath}. Select it together with the GLTF.",
                ]);
            }

            if (count($candidates) > 1) {
                throw ValidationException::withMessages([
                    'resources' => "More than one uploaded file could match {$requiredPath}. Select the model folder so relative paths are preserved.",
                ]);
            }

            $matches[$requiredPath] = $candidates[0]['file'];
        }

        return $matches;
    }

    private function storeFile(string $path, string $contents, string $contentType): void
    {
        if (! $this->media->put($path, $contents, $contentType)) {
            throw new RuntimeException('Unable to store the complete GLTF model package.');
        }
    }

    private function contentType(string $path): string
    {
        return match (strtolower(pathinfo($path, PATHINFO_EXTENSION))) {
            'bin' => 'application/octet-stream',
            'png' => 'image/png',
            'jpg', 'jpeg' => 'image/jpeg',
            'webp' => 'image/webp',
            default => 'application/octet-stream',
        };
    }
}
