<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Throwable;

class GoogleAvatarService
{
    public function __construct(private readonly MediaStorage $media) {}

    public function cache(string $googleId, string $pictureUrl): ?string
    {
        $googleId = trim($googleId);
        $pictureUrl = trim($pictureUrl);
        $host = mb_strtolower((string) parse_url($pictureUrl, PHP_URL_HOST));
        $scheme = mb_strtolower((string) parse_url($pictureUrl, PHP_URL_SCHEME));

        if (
            $googleId === '' ||
            $pictureUrl === '' ||
            $scheme !== 'https' ||
            ($host !== 'googleusercontent.com' && ! str_ends_with($host, '.googleusercontent.com'))
        ) {
            return null;
        }

        try {
            $response = Http::timeout(12)
                ->withHeaders(['User-Agent' => 'Plant-Growth-Academy/1.0'])
                ->get($pictureUrl);

            if (! $response->successful()) {
                return null;
            }

            $body = $response->body();

            if ($body === '' || strlen($body) > 2 * 1024 * 1024) {
                return null;
            }

            $imageInfo = function_exists('getimagesizefromstring') ? @getimagesizefromstring($body) : false;
            $mime = is_array($imageInfo) ? (string) ($imageInfo['mime'] ?? '') : '';
            $extension = match ($mime) {
                'image/jpeg' => 'jpg',
                'image/png' => 'png',
                'image/webp' => 'webp',
                default => null,
            };

            if (! $extension) {
                return null;
            }

            $path = 'profile-avatars/google/'.hash('sha256', $googleId).'.'.$extension;

            if (! $this->media->put($path, $body, $mime)) {
                return null;
            }

            return $this->media->publicUrl($path);
        } catch (Throwable $error) {
            Log::notice('Could not cache a Google profile image.', [
                'exception' => $error::class,
            ]);

            return null;
        }
    }
}
