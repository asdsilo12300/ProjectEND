<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class PublicMediaControllerTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        config([
            'cors.allowed_origins' => ['https://project-end-teal.vercel.app'],
            'services.media.disk' => 'public',
            'services.media.driver' => 'laravel',
        ]);

        Storage::fake('public');
    }

    public function test_it_serves_gltf_files_through_the_cors_enabled_api(): void
    {
        Storage::disk('public')->put(
            'model-bundles/tulip/model.gltf',
            '{"asset":{"version":"2.0"}}',
        );

        $response = $this
            ->withHeader('Origin', 'https://project-end-teal.vercel.app')
            ->get('/api/media/model-bundles/tulip/model.gltf');

        $response
            ->assertOk()
            ->assertHeader('Access-Control-Allow-Origin', 'https://project-end-teal.vercel.app')
            ->assertHeader('Content-Type', 'model/gltf+json')
            ->assertHeader('Cache-Control', 'immutable, max-age=31536000, public');

        $this->assertStringContainsString('"version":"2.0"', $response->streamedContent());
    }

    public function test_it_serves_model_dependencies_from_the_same_relative_directory(): void
    {
        Storage::disk('public')->put('model-bundles/tulip/tulip_model.bin', 'binary-model-data');
        Storage::disk('public')->put('model-bundles/tulip/texture/petal.png', 'png-data');

        $this->get('/api/media/model-bundles/tulip/tulip_model.bin')
            ->assertOk()
            ->assertHeader('Content-Type', 'application/octet-stream');

        $this->get('/api/media/model-bundles/tulip/texture/petal.png')
            ->assertOk()
            ->assertHeader('Content-Type', 'image/png');
    }

    public function test_it_rejects_parent_directory_traversal(): void
    {
        $this->get('/api/media/model-bundles/%2E%2E/private.txt')->assertNotFound();
    }
}
