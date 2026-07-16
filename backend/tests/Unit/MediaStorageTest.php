<?php

namespace Tests\Unit;

use App\Services\MediaStorage;
use Illuminate\Http\Client\Request;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class MediaStorageTest extends TestCase
{
    public function test_local_media_uses_the_public_disk_and_returns_a_browser_reference(): void
    {
        Storage::fake('public');
        config()->set('services.media.driver', 'laravel');
        config()->set('services.media.disk', 'public');

        $media = app(MediaStorage::class);

        $this->assertTrue($media->put('profile-avatars/avatar.png', 'image-bytes', 'image/png'));
        Storage::disk('public')->assertExists('profile-avatars/avatar.png');
        $this->assertSame('/storage/profile-avatars/avatar.png', $media->reference('profile-avatars/avatar.png'));
        $this->assertTrue($media->deleteFromReference('/storage/profile-avatars/avatar.png'));
        Storage::disk('public')->assertMissing('profile-avatars/avatar.png');
    }

    public function test_supabase_media_upload_uses_server_credentials_and_public_url(): void
    {
        config()->set('services.media.driver', 'supabase');
        config()->set('services.media.supabase_url', 'https://project-ref.supabase.co');
        config()->set('services.media.supabase_key', 'server-secret');
        config()->set('services.media.supabase_bucket', 'plant-media');

        Http::fake([
            'https://project-ref.supabase.co/storage/v1/object/plant-media/*' => Http::response([
                'Key' => 'plant-media/content-images/cover image.png',
            ]),
        ]);

        $media = app(MediaStorage::class);
        $path = 'content-images/cover image.png';

        $this->assertTrue($media->put($path, 'image-bytes', 'image/png'));
        $this->assertSame(
            'https://project-ref.supabase.co/storage/v1/object/public/plant-media/content-images/cover%20image.png',
            $media->reference($path),
        );

        Http::assertSent(fn (Request $request): bool => $request->url() === 'https://project-ref.supabase.co/storage/v1/object/plant-media/content-images/cover%20image.png'
            && $request->hasHeader('apikey', 'server-secret')
            && $request->hasHeader('Authorization', 'Bearer server-secret')
            && $request->hasHeader('x-upsert', 'true')
            && $request->body() === 'image-bytes'
        );
    }
}
