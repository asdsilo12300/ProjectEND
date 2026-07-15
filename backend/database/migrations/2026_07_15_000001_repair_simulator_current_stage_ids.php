<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('simulators') || ! Schema::hasTable('plant_growth_stages')) {
            return;
        }

        foreach (['id', 'plant_id', 'growth_point', 'current_stage_id'] as $column) {
            if (! Schema::hasColumn('simulators', $column)) {
                return;
            }
        }

        foreach (['id', 'plant_id', 'required_growth_point'] as $column) {
            if (! Schema::hasColumn('plant_growth_stages', $column)) {
                return;
            }
        }

        DB::table('simulators')
            ->select(['id', 'plant_id', 'growth_point', 'current_stage_id'])
            ->orderBy('id')
            ->chunkById(200, function ($simulators): void {
                foreach ($simulators as $simulator) {
                    $stageId = DB::table('plant_growth_stages')
                        ->where('plant_id', $simulator->plant_id)
                        ->where('required_growth_point', '<=', $simulator->growth_point)
                        ->orderByDesc('required_growth_point')
                        ->orderByDesc('id')
                        ->value('id');

                    if ($stageId !== null && (int) $simulator->current_stage_id !== (int) $stageId) {
                        DB::table('simulators')
                            ->where('id', $simulator->id)
                            ->update(['current_stage_id' => $stageId]);
                    }
                }
            });
    }

    public function down(): void
    {
        // Existing incorrect stage ids cannot be reconstructed safely.
    }
};
