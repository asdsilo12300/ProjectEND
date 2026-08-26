<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Every pest keeps a small independent chance to appear in otherwise
     * healthy conditions. Matching environmental rules are added on top of
     * this baseline by PlantSimulationEngine, so favourable conditions remain
     * the dominant cause of an outbreak.
     */
    public function up(): void
    {
        if (! Schema::hasTable('pests') || ! Schema::hasColumn('pests', 'base_chance')) {
            return;
        }

        foreach ([
            'aphid' => 4,
            'snail' => 3,
            'fungus' => 2,
        ] as $name => $chance) {
            DB::table('pests')
                ->whereRaw('LOWER(name_en) = ?', [$name])
                ->update(['base_chance' => $chance]);
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('pests') || ! Schema::hasColumn('pests', 'base_chance')) {
            return;
        }

        foreach ([
            'aphid' => 4,
            'snail' => 3,
            'fungus' => 2,
        ] as $name => $chance) {
            DB::table('pests')
                ->whereRaw('LOWER(name_en) = ?', [$name])
                ->where('base_chance', $chance)
                ->update(['base_chance' => 0]);
        }
    }
};
