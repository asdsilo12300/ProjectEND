<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('items')
            || ! Schema::hasColumn('items', 'action_key')
            || ! Schema::hasColumn('items', 'animation_key')) {
            return;
        }

        $mappings = [
            'Hand Pick' => ['manual-pest-control', 'hand-pick'],
            'Insect Spray' => ['aphid-treatment', 'pest-spray'],
            'Snail Spray' => ['snail-treatment', 'pest-spray'],
            'Fungus Spray' => ['fungus-treatment', 'pest-spray'],
        ];

        foreach ($mappings as $name => [$actionKey, $animationKey]) {
            $item = DB::table('items')->where('name', $name)->first();
            if (! $item) {
                continue;
            }

            $actionConflict = DB::table('items')
                ->where('action_key', $actionKey)
                ->where('id', '!=', $item->id)
                ->exists();

            DB::table('items')->where('id', $item->id)->update([
                'action_key' => $actionConflict ? $item->action_key : $actionKey,
                'animation_key' => $animationKey,
                'mode_scope' => $item->mode_scope ?: 'both',
                'updated_at' => now(),
            ]);
        }
    }

    public function down(): void
    {
        // Keep action metadata intact because it can be referenced by saved
        // simulation actions and is valid for the legacy pesticide records.
    }
};
