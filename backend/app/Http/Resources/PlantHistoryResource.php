<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PlantHistoryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $growthCalculation = $this->growthCalculationFallback();

        return [
            'id' => $this->id,
            'simulator_id' => $this->simulator_id,
            'user_id' => $this->user_id,
            'plant_id' => $this->plant_id,
            'plant' => new PlantResource($this->whenLoaded('plant')),
            'final_stage_id' => $this->final_stage_id,
            'final_stage' => $this->whenLoaded('finalStage', fn () => new PlantStageResource($this->finalStage)),
            'final_health' => (int) $this->final_health,
            'health' => (int) $this->final_health,
            'total_score' => (int) $this->total_score,
            'duration_days' => (int) $this->duration_days,
            'duration_seconds' => $this->duration_seconds === null
                ? max(0, (int) $this->duration_days * 86400)
                : max(0, (int) $this->duration_seconds),
            'visibility' => $this->visibility,
            'snapshot_image_url' => $this->snapshot_image_url,
            'game_state' => $this->game_state,
            'growth_calculation' => $growthCalculation,
            'analysis_result' => $this->analysis_result,
            'direction' => $this->direction,
            'created_at' => $this->created_at?->toISOString(),
        ];
    }

    private function growthCalculationFallback(): ?array
    {
        $savedCalculation = data_get($this->game_state, 'growth_calculation');
        if (is_array($savedCalculation)) {
            return $savedCalculation;
        }

        $savedGrowthPoint = data_get($this->game_state, 'simulator.growth_point');
        if ($savedGrowthPoint === null || ! $this->relationLoaded('plant')) {
            return null;
        }

        $maximumGrowthPoint = max(100, (int) $this->plant->stages->max('required_growth_point'));
        $growthPoint = min($maximumGrowthPoint, max(0, (float) $savedGrowthPoint));
        $maturityDays = max(1, (int) ($this->plant->real_maturity_days ?? 90));
        $progressPercent = ($growthPoint / $maximumGrowthPoint) * 100;
        $equivalentDays = ($growthPoint / $maximumGrowthPoint) * $maturityDays;
        $normalSecondsPerRealDay = 30 / (14 * ($maturityDays / $maximumGrowthPoint));
        $isMature = $growthPoint >= $maximumGrowthPoint;

        return [
            'version' => 1,
            'captured_at' => data_get($this->game_state, 'captured_at') ?? $this->created_at?->toISOString(),
            'derived_for_legacy_history' => true,
            'status' => $isMature ? 'complete' : 'paused',
            'cycle_seconds' => 30,
            'growth_point' => round($growthPoint, 2),
            'maximum_growth_point' => $maximumGrowthPoint,
            'progress_percent' => round($progressPercent, 2),
            'maturity_days' => $maturityDays,
            'equivalent_days' => round($equivalentDays, 2),
            'real_days_remaining' => round(max(0, $maturityDays - $equivalentDays), 2),
            'real_days_per_point' => round($maturityDays / $maximumGrowthPoint, 4),
            'observed_growth_points_per_cycle' => 0,
            'pace_percent' => 0,
            'seconds_per_real_day' => null,
            'normal_seconds_per_real_day' => round($normalSecondsPerRealDay, 2),
            'recent_growth_percentages' => [round($progressPercent, 2)],
            'reference_url' => $this->plant->growth_reference_url,
        ];
    }
}
