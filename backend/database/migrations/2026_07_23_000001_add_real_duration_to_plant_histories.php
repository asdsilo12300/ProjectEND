<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('plant_histories', 'duration_seconds')) {
            Schema::table('plant_histories', function (Blueprint $table): void {
                $table->unsignedBigInteger('duration_seconds')->nullable();
            });
        }

        DB::table('plant_histories')
            ->select(['id', 'simulator_id', 'duration_days', 'created_at'])
            ->whereNull('duration_seconds')
            ->orderBy('id')
            ->chunkById(250, function ($histories): void {
                $simulators = DB::table('simulators')
                    ->whereIn('id', $histories->pluck('simulator_id')->filter()->unique()->values())
                    ->get(['id', 'started_at', 'ended_at'])
                    ->keyBy('id');

                foreach ($histories as $history) {
                    $durationSeconds = max(0, (int) $history->duration_days * 86400);
                    $simulator = $simulators->get($history->simulator_id);

                    if ($simulator?->started_at) {
                        $startedAt = Carbon::parse($simulator->started_at);
                        $endedAt = Carbon::parse($simulator->ended_at ?: $history->created_at ?: $simulator->started_at);
                        $durationSeconds = max(0, $endedAt->getTimestamp() - $startedAt->getTimestamp());
                    }

                    DB::table('plant_histories')
                        ->where('id', $history->id)
                        ->update(['duration_seconds' => $durationSeconds]);
                }
            });
    }

    public function down(): void
    {
        if (Schema::hasColumn('plant_histories', 'duration_seconds')) {
            Schema::table('plant_histories', function (Blueprint $table): void {
                $table->dropColumn('duration_seconds');
            });
        }
    }
};
