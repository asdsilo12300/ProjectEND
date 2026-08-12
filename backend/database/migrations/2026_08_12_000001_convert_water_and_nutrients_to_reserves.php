<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // The previous columns represented adjustable measurements (ml/g).
        // They now store a 0-100 reserve, so existing active plants receive a
        // safe one-time supply without resetting growth, health, or location.
        if (Schema::hasTable('simulators')) {
            DB::table('simulators')
                ->where('status', 'active')
                ->update(['water' => 100, 'fertilizer' => 100]);
        }

        if (! Schema::hasTable('items') || ! Schema::hasColumn('items', 'action_key')) {
            return;
        }

        $now = now();
        DB::table('items')->where('action_key', 'water')->update([
            'description' => 'Restores 22% of the active plant water reserve.',
            'effect_value' => 22,
            'effect_payload' => json_encode([
                'strategy' => 'refill_reserve',
                'resource' => 'water',
                'duration_ticks' => 1,
            ], JSON_THROW_ON_ERROR),
            'updated_at' => $now,
        ]);
        DB::table('items')->where('action_key', 'fertilizer')->update([
            'description' => 'Restores 18% of the active plant nutrient reserve.',
            'effect_value' => 18,
            'effect_payload' => json_encode([
                'strategy' => 'refill_reserve',
                'resource' => 'fertilizer',
                'duration_ticks' => 1,
            ], JSON_THROW_ON_ERROR),
            'updated_at' => $now,
        ]);
    }

    public function down(): void
    {
        // Reserve usage changes live simulation state and is intentionally not
        // converted back into the legacy ml/g measurements on rollback.
    }
};
