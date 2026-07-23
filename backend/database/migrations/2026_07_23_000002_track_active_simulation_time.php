<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Carbon;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    private const MAX_CONTINUOUS_GAP_SECONDS = 90;

    public function up(): void
    {
        Schema::table('simulators', function (Blueprint $table): void {
            if (! Schema::hasColumn('simulators', 'active_seconds')) {
                $table->unsignedBigInteger('active_seconds')->default(0);
            }
            if (! Schema::hasColumn('simulators', 'last_active_at')) {
                $table->timestamp('last_active_at')->nullable();
            }
        });

        DB::table('simulators')
            ->select(['id', 'started_at', 'ended_at', 'updated_at'])
            ->orderBy('id')
            ->chunkById(100, function ($simulators): void {
                foreach ($simulators as $simulator) {
                    $terminalAt = $simulator->ended_at ?: $simulator->updated_at;
                    $activityTimes = $this->activityTimes((int) $simulator->id, $terminalAt);
                    $activeSeconds = $this->calculateActiveSeconds($simulator->started_at, $terminalAt, $activityTimes);
                    $lastActiveAt = $activityTimes->last() ?: $simulator->started_at;

                    DB::table('simulators')->where('id', $simulator->id)->update([
                        'active_seconds' => $activeSeconds,
                        'last_active_at' => $lastActiveAt,
                    ]);
                }
            });

        DB::table('plant_histories')
            ->select(['id', 'simulator_id', 'created_at'])
            ->orderBy('id')
            ->chunkById(100, function ($histories): void {
                $simulators = DB::table('simulators')
                    ->whereIn('id', $histories->pluck('simulator_id')->filter()->unique()->values())
                    ->get(['id', 'started_at'])
                    ->keyBy('id');

                foreach ($histories as $history) {
                    $simulator = $simulators->get($history->simulator_id);
                    if (! $simulator?->started_at || ! $history->created_at) {
                        continue;
                    }

                    $activityTimes = $this->activityTimes((int) $history->simulator_id, $history->created_at);
                    $activeSeconds = $this->calculateActiveSeconds($simulator->started_at, $history->created_at, $activityTimes);

                    DB::table('plant_histories')->where('id', $history->id)->update([
                        'duration_seconds' => $activeSeconds,
                        'duration_days' => intdiv($activeSeconds, 86400),
                    ]);
                }
            });
    }

    public function down(): void
    {
        Schema::table('simulators', function (Blueprint $table): void {
            if (Schema::hasColumn('simulators', 'last_active_at')) {
                $table->dropColumn('last_active_at');
            }
            if (Schema::hasColumn('simulators', 'active_seconds')) {
                $table->dropColumn('active_seconds');
            }
        });
    }

    private function activityTimes(int $simulatorId, mixed $terminalAt): Collection
    {
        return DB::table('simulation_logs')
            ->where('simulator_id', $simulatorId)
            ->when($terminalAt, fn ($query) => $query->where('created_at', '<=', $terminalAt))
            ->orderBy('created_at')
            ->pluck('created_at');
    }

    private function calculateActiveSeconds(mixed $startedAt, mixed $terminalAt, Collection $activityTimes): int
    {
        if (! $startedAt || ! $terminalAt) {
            return 0;
        }

        $start = Carbon::parse($startedAt);
        $terminal = Carbon::parse($terminalAt);
        $previousTimestamp = $start->getTimestamp();
        $activeSeconds = 0;

        foreach ($activityTimes as $activityTime) {
            $timestamp = Carbon::parse($activityTime)->getTimestamp();
            if ($timestamp < $previousTimestamp || $timestamp > $terminal->getTimestamp()) {
                continue;
            }

            $activeSeconds += min(
                self::MAX_CONTINUOUS_GAP_SECONDS,
                $timestamp - $previousTimestamp,
            );
            $previousTimestamp = $timestamp;
        }

        if ($terminal->getTimestamp() >= $previousTimestamp) {
            $activeSeconds += min(
                self::MAX_CONTINUOUS_GAP_SECONDS,
                $terminal->getTimestamp() - $previousTimestamp,
            );
        }

        return max(0, $activeSeconds);
    }
};
