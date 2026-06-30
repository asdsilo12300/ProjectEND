<?php

namespace App\Console\Commands;

use App\Models\ModelAsset;
use App\Models\Pest;
use App\Models\Plant;
use App\Models\PlantGrowthStage;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;

class ImportModels extends Command
{
    protected $signature = 'models:import {--dir=../frontend/public}';
    protected $description = 'Import local GLTF/GLB model sets into public storage and update plant, pest, stage, and model asset records.';

    private array $knownAssets = [
        'plant.gltf' => ['key' => 'plant.original', 'type' => 'plant', 'label' => 'Original plant model'],
        'dirt.gltf' => ['key' => 'ground.dirt', 'type' => 'scene', 'label' => 'Dirt ground model'],
        'aphid.gltf' => ['key' => 'pest.aphid', 'type' => 'pest', 'label' => 'Aphid pest model'],
        'snails.gltf' => ['key' => 'pest.snail', 'type' => 'pest', 'label' => 'Snail pest model'],
    ];

    public function handle(): int
    {
        $dir = realpath(base_path($this->option('dir')));

        if (! $dir || ! is_dir($dir)) {
            $this->error('Directory not found: ' . base_path($this->option('dir')));
            return self::FAILURE;
        }

        Storage::disk('public')->makeDirectory('models');

        foreach ($this->modelFiles($dir) as $file) {
            $basename = basename($file);
            $storagePath = 'models/' . $basename;
            Storage::disk('public')->put($storagePath, file_get_contents($file));
            $this->info("Stored {$basename} -> {$storagePath}");

            $this->copyGltfDependencies($file, $dir);
            $this->bindKnownAsset($basename, $storagePath);
            $this->bindLegacyPattern($basename, $storagePath);
        }

        $this->info('Model import complete.');
        return self::SUCCESS;
    }

    private function modelFiles(string $dir): array
    {
        return array_values(array_filter(
            glob($dir . DIRECTORY_SEPARATOR . '*.{gltf,glb}', GLOB_BRACE) ?: [],
            fn (string $file) => is_file($file)
        ));
    }

    private function copyGltfDependencies(string $modelFile, string $dir): void
    {
        if (! Str::endsWith(strtolower($modelFile), '.gltf')) {
            return;
        }

        $json = json_decode(file_get_contents($modelFile) ?: '', true);
        if (! is_array($json)) {
            return;
        }

        $uris = [];
        foreach ($json['buffers'] ?? [] as $buffer) {
            if (! empty($buffer['uri'])) {
                $uris[] = $buffer['uri'];
            }
        }
        foreach ($json['images'] ?? [] as $image) {
            if (! empty($image['uri'])) {
                $uris[] = $image['uri'];
            }
        }

        foreach (array_unique($uris) as $uri) {
            if (Str::startsWith($uri, ['data:', 'http://', 'https://'])) {
                continue;
            }

            $source = realpath($dir . DIRECTORY_SEPARATOR . str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $uri));
            if (! $source || ! is_file($source)) {
                $this->warn("Missing GLTF dependency: {$uri}");
                continue;
            }

            $relativeUri = str_replace('\\', '/', $uri);
            $storagePath = 'models/' . $relativeUri;
            Storage::disk('public')->put($storagePath, file_get_contents($source));
            $this->line("  dependency {$uri} -> {$storagePath}");
        }
    }

    private function bindKnownAsset(string $basename, string $storagePath): void
    {
        $definition = $this->knownAssets[$basename] ?? null;
        if (! $definition) {
            return;
        }

        ModelAsset::query()->updateOrCreate(
            ['asset_key' => $definition['key']],
            [
                'asset_key' => $definition['key'],
                'label' => $definition['label'],
                'type' => $definition['type'],
                'url' => $storagePath,
                'metadata' => ['imported_from' => $basename],
            ]
        );

        if ($basename === 'plant.gltf') {
            Plant::query()->where('name_en', 'Simulation Sprout')->update(['base_model_url' => $storagePath]);
            PlantGrowthStage::query()
                ->whereHas('plant', fn ($query) => $query->where('name_en', 'Simulation Sprout'))
                ->update(['model_url' => $storagePath]);
        }

        if ($basename === 'aphid.gltf') {
            Pest::query()->where('name_en', 'aphid')->update(['model_url' => $storagePath]);
        }

        if ($basename === 'snails.gltf') {
            Pest::query()->where('name_en', 'snail')->update(['model_url' => $storagePath]);
        }
    }

    private function bindLegacyPattern(string $basename, string $storagePath): void
    {
        if (Str::startsWith($basename, 'plant_')) {
            $id = (int) filter_var($basename, FILTER_SANITIZE_NUMBER_INT);
            Plant::query()->whereKey($id)->update(['base_model_url' => $storagePath]);
        }

        if (Str::startsWith($basename, 'stage_')) {
            $id = (int) filter_var($basename, FILTER_SANITIZE_NUMBER_INT);
            PlantGrowthStage::query()->whereKey($id)->update(['model_url' => $storagePath]);
        }
    }
}
