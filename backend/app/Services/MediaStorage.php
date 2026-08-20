<?php

namespace App\Services;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

class MediaStorage
{
    public function __construct(private readonly ExternalHttpClient $http) {}

    public function storeUploadedFile(UploadedFile $file, string $directory): string
    {
        $path = trim($directory, '/').'/'.$file->hashName();
        $contents = file_get_contents($file->getRealPath());

        if ($contents === false || ! $this->put($path, $contents, $file->getMimeType() ?: 'application/octet-stream')) {
            throw new RuntimeException('Unable to store the uploaded media file.');
        }

        return $path;
    }

    public function put(string $path, string $contents, string $contentType = 'application/octet-stream'): bool
    {
        $path = $this->normalizePath($path);

        if (! $this->usesSupabase()) {
            return Storage::disk($this->disk())->put($path, $contents, [
                'visibility' => 'public',
                'ContentType' => $contentType,
            ]);
        }

        $response = $this->supabaseRequest()
            ->withHeaders([
                'Content-Type' => $contentType,
                'x-upsert' => 'true',
            ])
            ->withBody($contents, $contentType)
            ->post($this->objectUrl($path));

        if ($response->failed()) {
            Log::error('Supabase Storage upload failed.', [
                'path' => $path,
                'status' => $response->status(),
                'response' => $response->body(),
            ]);
        }

        return $response->successful();
    }

    public function deleteFromReference(?string $reference): bool
    {
        $path = $this->pathFromReference($reference);

        if ($path === null) {
            return false;
        }

        if (! $this->usesSupabase()) {
            return Storage::disk($this->disk())->delete($path);
        }

        $response = $this->supabaseRequest()
            ->delete($this->storageBaseUrl().'/object/'.$this->encodePath($this->bucket()), [
                'prefixes' => [$path],
            ]);

        if ($response->failed()) {
            Log::warning('Supabase Storage delete failed.', [
                'path' => $path,
                'status' => $response->status(),
            ]);
        }

        return $response->successful();
    }

    public function publicUrl(string $path): string
    {
        $path = $this->normalizePath($path);

        if ($this->usesSupabase()) {
            return $this->publicBaseUrl().'/'.$this->encodePath($path);
        }

        return Storage::disk($this->disk())->url($path);
    }

    public function reference(string $path): string
    {
        $path = $this->normalizePath($path);

        return $this->usesSupabase()
            ? $this->publicUrl($path)
            : '/storage/'.$path;
    }

    public function normalizeReference(?string $reference): ?string
    {
        if ($reference === null || trim($reference) === '') {
            return null;
        }

        $path = $this->pathFromReference($reference);

        return $path === null ? trim($reference) : '/storage/'.$path;
    }

    public function usesSupabase(): bool
    {
        return config('services.media.driver', 'laravel') === 'supabase';
    }

    private function supabaseRequest(): PendingRequest
    {
        $key = trim((string) config('services.media.supabase_key'));

        if ($this->projectUrl() === '' || $key === '' || $this->bucket() === '') {
            throw new RuntimeException('Supabase Storage is selected but its URL, secret key, or bucket is missing.');
        }

        return $this->http->request()
            ->timeout((int) config('services.media.timeout', 30))
            ->retry(2, 250)
            ->withHeaders([
                'apikey' => $key,
                'Authorization' => 'Bearer '.$key,
            ]);
    }

    private function objectUrl(string $path): string
    {
        return $this->storageBaseUrl().'/object/'.$this->encodePath($this->bucket()).'/'.$this->encodePath($path);
    }

    private function publicBaseUrl(): string
    {
        return $this->storageBaseUrl().'/object/public/'.$this->encodePath($this->bucket());
    }

    private function storageBaseUrl(): string
    {
        return $this->projectUrl().'/storage/v1';
    }

    private function projectUrl(): string
    {
        return rtrim((string) config('services.media.supabase_url'), '/');
    }

    private function bucket(): string
    {
        return trim((string) config('services.media.supabase_bucket'), '/');
    }

    private function disk(): string
    {
        return (string) config('services.media.disk', 'public');
    }

    private function pathFromReference(?string $reference): ?string
    {
        if (! $reference) {
            return null;
        }

        $reference = trim($reference);

        if (str_starts_with($reference, '/storage/')) {
            return $this->normalizePath(substr($reference, strlen('/storage/')));
        }

        if (str_starts_with($reference, '/api/media/')) {
            return $this->normalizePath(substr($reference, strlen('/api/media/')));
        }

        if (! $this->usesSupabase()) {
            $diskBaseUrl = rtrim((string) config("filesystems.disks.{$this->disk()}.url"), '/');

            if ($diskBaseUrl !== '' && str_starts_with($reference, $diskBaseUrl.'/')) {
                return $this->normalizePath(substr($reference, strlen($diskBaseUrl) + 1));
            }
        }

        if ($this->usesSupabase()) {
            $prefix = $this->publicBaseUrl().'/';

            if (str_starts_with($reference, $prefix)) {
                return $this->normalizePath(rawurldecode(substr($reference, strlen($prefix))));
            }
        }

        if (
            (str_starts_with($reference, 'http://') || str_starts_with($reference, 'https://'))
            && $this->isBackendOwnedUrl($reference)
        ) {
            $urlPath = rawurldecode((string) parse_url($reference, PHP_URL_PATH));

            if (str_starts_with($urlPath, '/storage/')) {
                return $this->normalizePath(substr($urlPath, strlen('/storage/')));
            }

            if (str_starts_with($urlPath, '/api/media/')) {
                return $this->normalizePath(substr($urlPath, strlen('/api/media/')));
            }
        }

        if (! str_starts_with($reference, 'http://') && ! str_starts_with($reference, 'https://')) {
            return $this->normalizePath($reference);
        }

        return null;
    }

    private function isBackendOwnedUrl(string $reference): bool
    {
        $host = mb_strtolower((string) parse_url($reference, PHP_URL_HOST));
        $backendHosts = array_filter([
            'localhost',
            '127.0.0.1',
            '::1',
            mb_strtolower((string) parse_url((string) config('app.url'), PHP_URL_HOST)),
            mb_strtolower((string) parse_url(
                (string) config("filesystems.disks.{$this->disk()}.url"),
                PHP_URL_HOST,
            )),
        ]);

        return $host !== '' && in_array($host, $backendHosts, true);
    }

    private function normalizePath(string $path): string
    {
        return ltrim(str_replace('\\', '/', $path), '/');
    }

    private function encodePath(string $path): string
    {
        return implode('/', array_map('rawurlencode', explode('/', $this->normalizePath($path))));
    }
}
