<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const INDEX_NAME = 'simulators_user_plant_active_unique';

    public function up(): void
    {
        if (! Schema::hasTable('simulators')) {
            return;
        }

        $duplicateGroups = DB::table('simulators')
            ->select(['user_id', 'plant_id'])
            ->selectRaw('COUNT(*) AS duplicate_count')
            ->where('status', 'active')
            ->whereNull('deleted_at')
            ->groupBy('user_id', 'plant_id')
            ->havingRaw('COUNT(*) > 1')
            ->get();

        foreach ($duplicateGroups as $group) {
            $duplicateIds = DB::table('simulators')
                ->where('user_id', $group->user_id)
                ->where('plant_id', $group->plant_id)
                ->where('status', 'active')
                ->whereNull('deleted_at')
                ->orderByDesc('updated_at')
                ->orderByDesc('id')
                ->pluck('id')
                ->slice(1)
                ->values();

            if ($duplicateIds->isEmpty()) {
                continue;
            }

            DB::table('simulators')->whereIn('id', $duplicateIds)->update([
                'status' => 'cancelled',
                'share_visibility' => 'private',
                'ended_at' => now(),
                'state_version' => DB::raw('state_version + 1'),
                'updated_at' => now(),
            ]);

            if (Schema::hasTable('posts') && Schema::hasColumn('posts', 'deleted_at')) {
                DB::table('posts')
                    ->whereIn('simulator_id', $duplicateIds)
                    ->whereNull('deleted_at')
                    ->update(['deleted_at' => now(), 'updated_at' => now()]);
            }
        }

        if (in_array(DB::getDriverName(), ['pgsql', 'sqlite'], true)) {
            DB::statement(sprintf(
                'CREATE UNIQUE INDEX IF NOT EXISTS %s ON simulators (user_id, plant_id) WHERE status = \'active\' AND deleted_at IS NULL',
                self::INDEX_NAME,
            ));
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('simulators') || ! in_array(DB::getDriverName(), ['pgsql', 'sqlite'], true)) {
            return;
        }

        DB::statement('DROP INDEX IF EXISTS '.self::INDEX_NAME);
    }
};
