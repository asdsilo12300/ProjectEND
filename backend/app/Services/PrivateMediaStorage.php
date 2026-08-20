<?php

namespace App\Services;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use RuntimeException;

class PrivateMediaStorage
{
    public function __construct(private readonly ExternalHttpClient $http) {}

    public function store(UploadedFile $file, string $directory): string
    {
        $path = trim($directory, '/').'/'.$file->hashName();
        $contents = file_get_contents($file->getRealPath());
        if ($contents === false) throw new RuntimeException('Unable to read the uploaded evidence file.');

        if ($this->usesSupabase()) {
            $response = $this->request()->withHeaders([
                'Content-Type' => $file->getMimeType() ?: 'application/octet-stream',
                'x-upsert' => 'false',
            ])->withBody($contents, $file->getMimeType() ?: 'application/octet-stream')->post($this->objectUrl($path));
            if ($response->failed()) throw new RuntimeException('Unable to store the private evidence file.');
        } elseif (! Storage::disk($this->disk())->put($path, $contents)) {
            throw new RuntimeException('Unable to store the private evidence file.');
        }

        return $path;
    }

    public function contents(string $path): string
    {
        if ($this->usesSupabase()) {
            $response = $this->request()->get($this->objectUrl($path));
            if ($response->failed()) throw new RuntimeException('Evidence file was not found.');
            return $response->body();
        }
        if (! Storage::disk($this->disk())->exists($path)) throw new RuntimeException('Evidence file was not found.');
        return Storage::disk($this->disk())->get($path);
    }

    private function usesSupabase(): bool { return config('services.private_media.driver', 'laravel') === 'supabase'; }
    private function disk(): string { return (string) config('services.private_media.disk', 'local'); }
    private function bucket(): string { return trim((string) config('services.private_media.supabase_bucket', 'issue-evidence'), '/'); }
    private function projectUrl(): string { return rtrim((string) config('services.private_media.supabase_url'), '/'); }
    private function encodePath(string $path): string { return implode('/', array_map('rawurlencode', explode('/', trim(str_replace('\\', '/', $path), '/')))); }
    private function objectUrl(string $path): string { return $this->projectUrl().'/storage/v1/object/'.$this->encodePath($this->bucket()).'/'.$this->encodePath($path); }
    private function request(): PendingRequest
    {
        $key = trim((string) config('services.private_media.supabase_key'));
        if ($this->projectUrl() === '' || $key === '' || $this->bucket() === '') throw new RuntimeException('Private Supabase Storage configuration is incomplete.');
        return $this->http->request()->timeout((int) config('services.private_media.timeout', 30))->retry(2, 250)->withHeaders(['apikey' => $key, 'Authorization' => 'Bearer '.$key]);
    }
}
