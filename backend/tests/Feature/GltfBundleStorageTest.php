<?php

namespace Tests\Feature;

use App\Services\GltfBundleStorage;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class GltfBundleStorageTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Storage::fake('public');
        config()->set('services.media.driver', 'laravel');
        config()->set('services.media.disk', 'public');
    }

    public function test_it_stores_a_gltf_and_its_dependencies_in_an_isolated_bundle(): void
    {
        $bundle = app(GltfBundleStorage::class)->store(
            $this->modelFile(),
            [
                UploadedFile::fake()->createWithContent('mesh.bin', 'mesh-data'),
                UploadedFile::fake()->createWithContent('leaf.png', 'texture-data'),
            ],
            ['mesh.bin', 'export/textures/leaf.png'],
        );

        $this->assertStringStartsWith('/storage/model-bundles/', $bundle['reference']);
        $this->assertStringEndsWith('/model.gltf', $bundle['reference']);
        $this->assertSame(2, $bundle['dependency_count']);
        Storage::disk('public')->assertExists($bundle['path']);
        Storage::disk('public')->assertExists(dirname($bundle['path']).'/mesh.bin');
        Storage::disk('public')->assertExists(dirname($bundle['path']).'/textures/leaf.png');
    }

    public function test_two_models_with_the_same_dependency_names_do_not_overwrite_each_other(): void
    {
        $storage = app(GltfBundleStorage::class);
        $first = $storage->store($this->modelFile(), $this->dependencies());
        $second = $storage->store($this->modelFile(), $this->dependencies());

        $this->assertNotSame(dirname($first['path']), dirname($second['path']));
        Storage::disk('public')->assertExists(dirname($first['path']).'/mesh.bin');
        Storage::disk('public')->assertExists(dirname($second['path']).'/mesh.bin');
    }

    public function test_it_rejects_a_package_when_a_referenced_texture_is_missing(): void
    {
        $this->expectException(ValidationException::class);

        app(GltfBundleStorage::class)->store(
            $this->modelFile(),
            [UploadedFile::fake()->createWithContent('mesh.bin', 'mesh-data')],
        );
    }

    public function test_it_rejects_external_dependency_urls(): void
    {
        $this->expectException(ValidationException::class);

        $model = UploadedFile::fake()->createWithContent('remote.gltf', json_encode([
            'asset' => ['version' => '2.0'],
            'buffers' => [['uri' => 'https://example.com/model.bin', 'byteLength' => 4]],
        ], JSON_THROW_ON_ERROR));

        app(GltfBundleStorage::class)->store($model);
    }

    private function modelFile(): UploadedFile
    {
        return UploadedFile::fake()->createWithContent('plant.gltf', json_encode([
            'asset' => ['version' => '2.0'],
            'buffers' => [['uri' => 'mesh.bin', 'byteLength' => 9]],
            'images' => [['uri' => 'textures/leaf.png']],
        ], JSON_THROW_ON_ERROR));
    }

    /** @return array<int, UploadedFile> */
    private function dependencies(): array
    {
        return [
            UploadedFile::fake()->createWithContent('mesh.bin', 'mesh-data'),
            UploadedFile::fake()->createWithContent('leaf.png', 'texture-data'),
        ];
    }
}
