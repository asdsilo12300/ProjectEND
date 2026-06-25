<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;
use App\Models\Plant;
use App\Models\PlantGrowthStage;
use Illuminate\Support\Str;

class ImportModels extends Command
{
    protected $signature = 'models:import {--dir=tmp/models}';
    protected $description = 'Import .glb files from a directory into storage and update plant/stage records. Filenames: plant_{id}.glb or stage_{id}.glb';

    public function handle(): int
    {
        $dir = base_path($this->option('dir'));

        if (! is_dir($dir)) {
            $this->error("Directory not found: {$dir}");
            return 1;
        }

        $files = glob(rtrim($dir, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . '*.glb');
        if (! $files) {
            $this->info('No .glb files found in ' . $dir);
            return 0;
        }

        foreach ($files as $file) {
            $name = pathinfo($file, PATHINFO_BASENAME);
            $this->info("Processing {$name}...");

            $path = Storage::disk('public')->putFile('models', new \Illuminate\Http\File($file));
            if (! $path) {
                $this->error("Failed to store {$name}");
                continue;
            }

            // pattern: plant_{id}.glb
            if (Str::startsWith($name, 'plant_')) {
                $id = (int) filter_var($name, FILTER_SANITIZE_NUMBER_INT);
                $plant = Plant::find($id);
                if ($plant) {
                    $plant->update(['base_model_url' => $path]);
                    $this->info("Updated Plant {$id} -> {$path}");
                    continue;
                }
            }

            // pattern: stage_{id}.glb
            if (Str::startsWith($name, 'stage_')) {
                $id = (int) filter_var($name, FILTER_SANITIZE_NUMBER_INT);
                $stage = PlantGrowthStage::find($id);
                if ($stage) {
                    $stage->update(['model_url' => $path]);
                    $this->info("Updated Stage {$id} -> {$path}");
                    continue;
                }
            }

            $this->warn("No matching record for {$name}; stored at {$path}");
        }

        $this->info('Import complete.');
        return 0;
    }
}
