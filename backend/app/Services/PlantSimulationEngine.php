<?php

namespace App\Services;

use App\Models\Pest;
use App\Models\PlantConditionRule;
use App\Models\PlantVisualVariant;
use App\Models\PestConditionRule;
use App\Models\SimulationLog;
use App\Models\SimulationPest;
use App\Models\Simulator;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;

class PlantSimulationEngine
{
    /**
     * @param array<string, int|float|null> $factors
     */
    public function tick(Simulator $simulator, array $factors): Simulator
    {
        return DB::transaction(function () use ($simulator, $factors): Simulator {
            $simulator->loadMissing(['plant.conditionRules', 'plant.visualVariants', 'currentStage']);
            $plant = $simulator->plant;
            $matchedRules = $plant->conditionRules
                ->where('is_active', true)
                ->filter(fn (PlantConditionRule $rule) => $this->matchesRule($rule, $factors))
                ->sortByDesc('severity')
                ->values();

            $healthDelta = (int) $matchedRules->sum('health_delta');
            $growthDelta = (int) $matchedRules->sum('growth_delta');
            $stressCount = $matchedRules->filter(fn (PlantConditionRule $rule) => $rule->health_delta < 0 || $rule->growth_delta < 0)->count();
            $baseGrowth = $stressCount === 0 ? 14 : 6;

            $visualState = $stressCount >= 3
                ? 'stunted'
                : ($matchedRules->first()?->visual_state ?? 'healthy');

            $nextHealth = $this->clamp((int) $simulator->health + $healthDelta, 0, 100);
            $maxGrowthPoint = (int) $plant->stages()->max('required_growth_point');
            $calculatedGrowth = max(0, (int) $simulator->growth_point + $baseGrowth + $growthDelta);
            $nextGrowth = $maxGrowthPoint > 0 ? min($maxGrowthPoint, $calculatedGrowth) : $calculatedGrowth;
            $stage = $plant->stages()
                ->reorder()
                ->where('required_growth_point', '<=', $nextGrowth)
                ->orderByDesc('required_growth_point')
                ->first();
            $variant = $this->variantFor($plant->id, $stage?->id, $visualState);
            $visualOverrides = $this->visualOverrides($visualState, $variant);
            $pestRisks = $this->pestRiskMap($simulator, $factors);
            $activePests = $this->updatePests($simulator, $factors, $pestRisks);
            $analysis = $this->analysisText($matchedRules->pluck('analysis_result')->filter()->values()->all(), $visualState);
            $direction = $this->directionText($matchedRules->pluck('direction')->filter()->values()->all(), $visualState);
            $nextDay = ((int) $simulator->logs()->max('day_no')) + 1;

            $state = [
                'growth_point' => $nextGrowth,
                'current_stage_id' => $stage?->id ?? $simulator->current_stage_id,
                'health' => $nextHealth,
                'visual_state' => $visualState,
                'visual_variant_id' => $variant?->id,
                'visual_overrides' => $visualOverrides,
                'water' => (int) Arr::get($factors, 'water', $simulator->water),
                'light' => (int) Arr::get($factors, 'light', $simulator->light),
                'fertilizer' => (int) Arr::get($factors, 'fertilizer', $simulator->fertilizer),
                'soil_humidity' => (int) Arr::get($factors, 'soil_humidity', $simulator->soil_humidity),
                'air_humidity' => (int) Arr::get($factors, 'air_humidity', $simulator->air_humidity),
                'soil_temp' => (float) Arr::get($factors, 'soil_temp', $simulator->soil_temp),
                'air_temp' => (float) Arr::get($factors, 'air_temp', $simulator->air_temp),
            ];

            $simulator->update($state);

            SimulationLog::query()->create($state + [
                'simulator_id' => $simulator->id,
                'day_no' => $nextDay,
                'score' => max(0, $nextGrowth + $nextHealth - ($activePests * 8)),
                'analysis_result' => $analysis,
                'direction' => $direction,
            ]);

            $freshSimulator = $simulator->fresh(['plant.stages', 'currentStage', 'visualVariant', 'activePests.pest.conditionRules']);
            $freshSimulator->setAttribute('pest_risks', $pestRisks);

            return $freshSimulator;
        });
    }

    /** @param array<string, int|float|null> $factors */
    private function matchesRule(PlantConditionRule|PestConditionRule $rule, array $factors): bool
    {
        if (! array_key_exists($rule->factor, $factors) || $factors[$rule->factor] === null) {
            return false;
        }

        $value = (float) $factors[$rule->factor];
        $min = $rule->min_value === null ? null : (float) $rule->min_value;
        $max = $rule->max_value === null ? null : (float) $rule->max_value;

        return match ($rule->operator) {
            'below' => $min !== null && $value < $min,
            'above' => $max !== null && $value > $max,
            'between' => $min !== null && $max !== null && $value >= $min && $value <= $max,
            'outside' => $min !== null && $max !== null && ($value < $min || $value > $max),
            default => false,
        };
    }

    private function variantFor(int $plantId, ?int $stageId, string $visualState): ?PlantVisualVariant
    {
        return PlantVisualVariant::query()
            ->where('plant_id', $plantId)
            ->where('state_key', $visualState)
            ->where('is_active', true)
            ->where(fn ($query) => $query->whereNull('stage_id')->orWhere('stage_id', $stageId))
            ->orderByRaw('stage_id IS NULL')
            ->orderByDesc('priority')
            ->first();
    }

    /** @return array<string, mixed> */
    private function visualOverrides(string $visualState, ?PlantVisualVariant $variant): array
    {
        $defaults = [
            'healthy' => ['leafColor' => '#9bcf82', 'stemColor' => '#7a5a2f', 'scale' => 1, 'leafState' => 'upright', 'stemState' => 'upright'],
            'underwatered' => ['leafColor' => '#9a6a3a', 'stemColor' => '#6f4a2a', 'scale' => 0.92, 'leafState' => 'wilted', 'stemState' => 'leaning'],
            'overwatered' => ['leafColor' => '#7f9964', 'stemColor' => '#6b5b35', 'scale' => 0.95, 'leafState' => 'drooping', 'stemState' => 'soft'],
            'nutrient_deficient' => ['leafColor' => '#d6c66b', 'stemColor' => '#8a743e', 'scale' => 0.9, 'leafState' => 'yellowing', 'stemState' => 'thin'],
            'heat_stress' => ['leafColor' => '#c6773e', 'stemColor' => '#7a4b2f', 'scale' => 0.92, 'leafState' => 'burnt_edges', 'stemState' => 'dry'],
            'burnt' => ['leafColor' => '#b87536', 'stemColor' => '#704326', 'scale' => 0.88, 'leafState' => 'root_burn', 'stemState' => 'dry'],
            'cold_stress' => ['leafColor' => '#65816f', 'stemColor' => '#5f6f5b', 'scale' => 0.9, 'leafState' => 'darkened', 'stemState' => 'slow'],
            'stunted' => ['leafColor' => '#7b6f3f', 'stemColor' => '#5c4a28', 'scale' => 0.68, 'leafState' => 'small', 'stemState' => 'short'],
        ];

        $base = $defaults[$visualState] ?? $defaults['healthy'];

        if (! $variant) {
            return $base;
        }

        return array_filter([
            'leafColor' => $variant->leaf_color ?: $base['leafColor'],
            'stemColor' => $variant->stem_color ?: $base['stemColor'],
            'scale' => (float) $variant->scale ?: $base['scale'],
            'leafState' => $variant->leaf_state ?: $base['leafState'],
            'stemState' => $variant->stem_state ?: $base['stemState'],
        ], fn ($value) => $value !== null);
    }

    /**
     * @param array<string, int|float|null> $factors
     * @return array<string, int>
     */
    private function pestRiskMap(Simulator $simulator, array $factors): array
    {
        return Pest::query()
            ->with('conditionRules')
            ->get()
            ->mapWithKeys(fn (Pest $pest) => [$pest->name_en => $this->pestChance($simulator, $pest, $factors)])
            ->all();
    }

    /** @param array<string, int|float|null> $factors */
    private function pestChance(Simulator $simulator, Pest $pest, array $factors): int
    {
        $chance = 0.0;

        foreach ($pest->conditionRules->where('is_active', true) as $rule) {
            if ($rule->plant_id !== null && (int) $rule->plant_id !== (int) $simulator->plant_id) {
                continue;
            }
            if ($this->matchesRule($rule, $factors)) {
                $chance += (float) $rule->chance_delta;
            }
        }

        return $this->clamp((int) round($chance), 0, 100);
    }

    /**
     * @param array<string, int|float|null> $factors
     * @param array<string, int> $pestRisks
     */
    private function updatePests(Simulator $simulator, array $factors, array $pestRisks): int
    {
        $activeCount = 0;
        $pests = Pest::query()->with('conditionRules')->get();

        foreach ($pests as $pest) {
            $chance = $pestRisks[$pest->name_en] ?? $this->pestChance($simulator, $pest, $factors);
            if ($chance <= 0) {
                SimulationPest::query()
                    ->where('simulator_id', $simulator->id)
                    ->where('pest_id', $pest->id)
                    ->where('status', 'active')
                    ->update(['status' => 'inactive']);
                continue;
            }

            $alreadyActive = SimulationPest::query()
                ->where('simulator_id', $simulator->id)
                ->where('pest_id', $pest->id)
                ->where('status', 'active')
                ->exists();

            if ($alreadyActive) {
                $activeCount++;
                continue;
            }

            if ($chance >= 100 || random_int(1, 100) <= $chance) {
                SimulationPest::query()->create([
                    'simulator_id' => $simulator->id,
                    'pest_id' => $pest->id,
                    'status' => 'active',
                    'appeared_at' => now(),
                ]);
                $activeCount++;
            }
        }

        return $activeCount;
    }
    /** @param array<int, string> $messages */
    private function analysisText(array $messages, string $visualState): string
    {
        if ($messages !== []) {
            return implode(' ', array_unique($messages));
        }

        return $visualState === 'healthy'
            ? 'Plant conditions are stable and within the recommended range.'
            : 'Plant condition changed based on the latest environment factors.';
    }

    /** @param array<int, string> $messages */
    private function directionText(array $messages, string $visualState): string
    {
        if ($messages !== []) {
            return implode(' ', array_unique($messages));
        }

        return $visualState === 'healthy'
            ? 'Keep the current care pattern and compare the next cycle.'
            : 'Adjust the highlighted factor before the next cycle.';
    }

    private function clamp(int $value, int $min, int $max): int
    {
        return min($max, max($min, $value));
    }
}
