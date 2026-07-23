<?php

namespace App\Services;

use App\Models\Simulator;
use Carbon\CarbonInterface;

class SimulationActivityTracker
{
    public const MAX_CONTINUOUS_GAP_SECONDS = 90;

    /** @return array{active_seconds: int, last_active_at: CarbonInterface|null} */
    public function attributes(Simulator $simulator, ?CarbonInterface $at = null): array
    {
        if ($simulator->status !== 'active') {
            return [
                'active_seconds' => max(0, (int) ($simulator->active_seconds ?? 0)),
                'last_active_at' => $simulator->last_active_at,
            ];
        }

        $at ??= now();
        $lastActiveAt = $simulator->last_active_at ?? $simulator->started_at ?? $at;
        $elapsed = max(0, $at->getTimestamp() - $lastActiveAt->getTimestamp());
        $activeDelta = min(self::MAX_CONTINUOUS_GAP_SECONDS, $elapsed);

        return [
            'active_seconds' => max(0, (int) ($simulator->active_seconds ?? 0)) + $activeDelta,
            'last_active_at' => $at,
        ];
    }
}
