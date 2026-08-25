<?php

namespace App\Services;

use App\Models\SimulationModeReward;
use Illuminate\Support\Facades\Schema;
use Throwable;

class SimulationModeRewardService
{
    public const DEFAULTS = [
        'greenhouse' => ['name_en' => 'Environment Control', 'name_th' => 'โหมดควบคุมสภาพแวดล้อม', 'experience_reward' => 20, 'coin_reward' => 20, 'is_active' => true],
        'outdoor' => ['name_en' => 'Outdoor', 'name_th' => 'โหมดกลางแจ้ง', 'experience_reward' => 150, 'coin_reward' => 200, 'is_active' => true],
        'seasonal' => ['name_en' => 'Seasonal Journey', 'name_th' => 'โหมดปลูกตามฤดูกาล', 'experience_reward' => 300, 'coin_reward' => 500, 'is_active' => true],
    ];

    public function forMode(?string $mode): array
    {
        $mode = array_key_exists((string) $mode, self::DEFAULTS) ? (string) $mode : 'greenhouse';

        try {
            if (Schema::hasTable('simulation_mode_rewards')) {
                // A disabled mode still keeps its configured completion reward
                // for simulations that were started before an administrator
                // disabled it. Availability is enforced separately when a new
                // simulation is created.
                $reward = SimulationModeReward::query()->where('mode', $mode)->first();
                if ($reward) {
                    return [
                        'mode' => $mode,
                        'name_en' => $reward->name_en,
                        'name_th' => $reward->name_th,
                        'experience_reward' => (int) $reward->experience_reward,
                        'coin_reward' => (int) $reward->coin_reward,
                        'is_active' => (bool) $reward->is_active,
                    ];
                }
            }
        } catch (Throwable) {
            // Deployments remain playable while a new migration is being rolled out.
        }

        return ['mode' => $mode, ...self::DEFAULTS[$mode]];
    }

    public function catalog(): array
    {
        return collect(array_keys(self::DEFAULTS))->map(fn (string $mode): array => $this->forMode($mode))->all();
    }

    public function isModeActive(?string $mode): bool
    {
        $mode = (string) $mode;
        if (! array_key_exists($mode, self::DEFAULTS)) {
            return false;
        }

        return (bool) ($this->forMode($mode)['is_active'] ?? true);
    }
}
