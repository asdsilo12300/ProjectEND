<?php

use App\Models\Plant;
use App\Services\KnownPlantProfileService;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        $requiredTables = ['plants', 'plant_growth_stages', 'plant_condition_rules', 'plant_visual_variants'];

        foreach ($requiredTables as $table) {
            if (! Schema::hasTable($table)) {
                return;
            }
        }

        $tulips = Plant::query()
            ->where(function ($query): void {
                $query->whereRaw('LOWER(name_en) LIKE ?', ['%tulip%'])
                    ->orWhere('name_th', 'ทิวลิป');
            })
            ->get();

        $profiles = app(KnownPlantProfileService::class);
        $tulips->each(fn (Plant $plant): bool => $profiles->apply($plant));
    }

    public function down(): void
    {
        // This migration repairs user-created plant data. Rolling it back must
        // not delete rules or visual variants that an administrator may edit.
    }
};
