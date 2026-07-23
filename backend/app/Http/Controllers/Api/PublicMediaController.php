<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\MediaStorage;
use Illuminate\Http\RedirectResponse;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\HttpFoundation\StreamedResponse;

class PublicMediaController extends Controller
{
    public function __invoke(string $path, MediaStorage $media): StreamedResponse|RedirectResponse
    {
        $path = $this->safePath($path);

        if ($media->usesSupabase()) {
            return redirect()->away($media->publicUrl($path));
        }

        $disk = Storage::disk((string) config('services.media.disk', 'public'));
        abort_unless($disk->exists($path), 404);

        return $disk->response($path, basename($path), [
            'Cache-Control' => 'public, max-age=31536000, immutable',
            'Content-Type' => $this->contentType($path),
            'X-Content-Type-Options' => 'nosniff',
        ], 'inline');
    }

    private function safePath(string $path): string
    {
        $path = ltrim(str_replace('\\', '/', rawurldecode($path)), '/');
        $segments = explode('/', $path);

        abort_if(
            $path === ''
            || str_contains($path, "\0")
            || in_array('..', $segments, true),
            404,
        );

        return $path;
    }

    private function contentType(string $path): string
    {
        return match (strtolower(pathinfo($path, PATHINFO_EXTENSION))) {
            'gltf' => 'model/gltf+json',
            'glb' => 'model/gltf-binary',
            'bin' => 'application/octet-stream',
            'png' => 'image/png',
            'jpg', 'jpeg' => 'image/jpeg',
            'webp' => 'image/webp',
            default => 'application/octet-stream',
        };
    }
}
