<?php

namespace App\Services;

use App\Models\Pest;
use App\Models\PestConditionRule;
use App\Models\Plant;
use App\Models\PlantConditionRule;
use App\Models\PlantVisualVariant;
use App\Models\SimulationLog;
use App\Models\SimulationPest;
use App\Models\Simulator;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Symfony\Component\HttpKernel\Exception\ConflictHttpException;

class PlantSimulationEngine
{
    public function __construct(private readonly SimulationActivityTracker $activity) {}

    /**
     * @param  array<string, int|float|null>  $factors
     */
    public function tick(Simulator $simulator, array $factors): Simulator
    {
        $simulatorId = $simulator->getKey();

        return DB::transaction(function () use ($simulatorId, $factors): Simulator {
            $simulator = Simulator::query()
                ->whereKey($simulatorId)
                ->lockForUpdate()
                ->firstOrFail();

            if ($simulator->status !== 'active') {
                throw new ConflictHttpException('Only active simulations can advance.');
            }

            $simulator->loadMissing(['plant.conditionRules', 'plant.visualVariants', 'currentStage']);
            $plant = $simulator->plant;
            $repairedLegacyRootTemperature = $this->repairLegacyGreenhouseRootTemperature($simulator, $plant, $factors);
            $matchedRules = $plant->conditionRules
                ->where('is_active', true)
                ->filter(fn (PlantConditionRule $rule) => $this->matchesRule($rule, $factors))
                ->sortByDesc('severity')
                ->values();

            $healthDelta = (int) $matchedRules->sum('health_delta');
            $growthDelta = (int) $matchedRules->sum('growth_delta');
            $stressCount = $matchedRules->filter(fn (PlantConditionRule $rule) => $rule->health_delta < 0 || $rule->growth_delta < 0)->count();
            $wasDepleted = (int) $simulator->health === 0;
            $naturalRecovery = $stressCount === 0 ? 3 : 0;

            // Keep the dominant environmental symptom as the visual state.
            // Growth can still be stunted or paused by several simultaneous
            // stresses, but replacing a specific cause such as heat stress
            // with the generic "stunted" state hides the corresponding colour
            // and deformation from the 3D plant.
            $dominantVisualState = $matchedRules->first()?->visual_state;
            $visualState = $dominantVisualState ?? 'healthy';

            $pestRisks = $this->pestRiskMap($simulator, $factors);
            $pestState = $this->updatePests($simulator, $factors, $pestRisks);
            $activePests = $pestState['count'];
            $pestDamage = $pestState['damage'];
            // Earlier clients had one temperature control and sent its air
            // reading as the root-zone temperature. When that known legacy
            // payload is corrected and no other condition is wrong, restore
            // health lost solely to the interface defect.
            $startingHealth = $repairedLegacyRootTemperature && $stressCount === 0
                ? 100
                : (int) $simulator->health;
            $healthAfterEnvironment = $this->clamp($startingHealth + $healthDelta + $naturalRecovery, 0, 100);
            $nextHealth = $this->clamp($healthAfterEnvironment - $pestDamage, 0, 100);

            // Low health caused only by an active pest has no environmental
            // symptom to display, so the generic stunted appearance remains
            // useful in that case.
            if ($nextHealth <= 50 && $dominantVisualState === null) {
                $visualState = 'stunted';
            }

            $maxGrowthPoint = (int) $plant->stages()->max('required_growth_point');
            $currentGrowth = max(0, (int) $simulator->growth_point);
            $baseGrowth = $stressCount === 0 ? 14 : 6;
            $growthIncrement = max(0, $baseGrowth + $growthDelta);
            $calculatedGrowth = $wasDepleted || $nextHealth === 0
                ? $currentGrowth
                : $currentGrowth + $growthIncrement;
            $nextGrowth = $maxGrowthPoint > 0
                ? min($maxGrowthPoint, $calculatedGrowth)
                : $calculatedGrowth;
            $stage = $plant->stages()
                ->reorder()
                ->where('required_growth_point', '<=', $nextGrowth)
                ->orderByDesc('required_growth_point')
                ->orderByDesc('id')
                ->first();
            $variant = $this->variantFor($plant->id, $stage?->id, $visualState);
            $visualOverrides = $this->visualOverrides($visualState, $variant);
            $analysis = $this->analysisText($matchedRules->pluck('analysis_result')->filter()->values()->all(), $visualState);
            $direction = $this->directionText($matchedRules->pluck('direction')->filter()->values()->all(), $visualState);
            if ($pestDamage > 0) {
                $analysis .= " Active pests caused {$pestDamage} health damage this cycle.";
                $direction .= ' Use an appropriate pest treatment to stop further damage.';
            }
            if ($nextHealth === 0) {
                $analysis .= ' Plant health is depleted, so growth has stopped.';
                $direction .= ' Treat pests and correct the environment before continuing.';
            } elseif ($wasDepleted) {
                $analysis .= ' Plant health has started to recover, while growth remains paused for this cycle.';
                $direction .= ' Keep conditions stable so growth can resume next cycle.';
            }
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
                'state_version' => ((int) $simulator->state_version) + 1,
                ...$this->activity->attributes($simulator),
            ];

            $latestLog = $simulator->logs()
                ->latest('created_at')
                ->latest('id')
                ->first();
            $pestSetChanged = $pestState['changed'] || ($latestLog?->created_at && SimulationPest::query()
                ->where('simulator_id', $simulator->id)
                ->where(function ($query) use ($latestLog): void {
                    $query->where('appeared_at', '>', $latestLog->created_at)
                        ->orWhere('treated_at', '>', $latestLog->created_at);
                })
                ->exists());
            $shouldCreateLog = ! $latestLog
                || (int) $simulator->growth_point !== $nextGrowth
                || (int) $simulator->health !== $nextHealth
                || (int) $simulator->current_stage_id !== (int) $state['current_stage_id']
                || (string) $simulator->visual_state !== $visualState
                || $pestSetChanged;

            $simulator->update($state);

            if ($shouldCreateLog) {
                SimulationLog::query()->create($state + [
                    'simulator_id' => $simulator->id,
                    'day_no' => ((int) $simulator->logs()->max('day_no')) + 1,
                    'score' => max(0, $nextGrowth + $nextHealth - ($activePests * 8)),
                    'analysis_result' => $analysis,
                    'direction' => $direction,
                ]);
            }

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

    /** @param array<string, int|float|bool|null> $factors */
    private function repairLegacyGreenhouseRootTemperature(Simulator $simulator, Plant $plant, array &$factors): bool
    {
        if (($factors['root_temperature_controlled'] ?? false) || $simulator->mode !== 'greenhouse') {
            return false;
        }

        $soilTemp = (float) ($factors['soil_temp'] ?? $simulator->soil_temp);
        $airTemp = (float) ($factors['air_temp'] ?? $simulator->air_temp);
        $soilMin = (float) $plant->soil_temp_min;
        $soilMax = (float) $plant->soil_temp_max;
        $airMin = (float) $plant->air_temp_min;
        $airMax = (float) $plant->air_temp_max;
        $rootTemperatureWasCopied = abs($soilTemp - $airTemp) < 0.01;
        $airIsHealthy = $airTemp >= $airMin && $airTemp <= $airMax;
        $soilIsStressed = $soilTemp < $soilMin || $soilTemp > $soilMax;

        if (! $rootTemperatureWasCopied || ! $airIsHealthy || ! $soilIsStressed || $soilMin > $soilMax) {
            return false;
        }

        $factors['soil_temp'] = round(($soilMin + $soilMax) / 2, 2);

        return true;
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
     * @param  array<string, int|float|null>  $factors
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
        $chance = (float) $pest->base_chance;

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
     * @param  array<string, int|float|null>  $factors
     * @param  array<string, int>  $pestRisks
     * @return array{count: int, damage: int, changed: bool}
     */
    private function updatePests(Simulator $simulator, array $factors, array $pestRisks): array
    {
        $activeCount = 0;
        $damage = 0;
        $changed = false;
        $pests = Pest::query()->with('conditionRules')->get();

        foreach ($pests as $pest) {
            $chance = $pestRisks[$pest->name_en] ?? $this->pestChance($simulator, $pest, $factors);
            $alreadyActive = SimulationPest::query()
                ->where('simulator_id', $simulator->id)
                ->where('pest_id', $pest->id)
                ->where('status', 'active')
                ->exists();

            if ($alreadyActive) {
                $activeCount++;
                $damage += max(0, (int) $pest->damage_per_turn);

                continue;
            }

            if ($chance > 0 && ($chance >= 100 || random_int(1, 100) <= $chance)) {
                SimulationPest::query()->create([
                    'simulator_id' => $simulator->id,
                    'pest_id' => $pest->id,
                    'status' => 'active',
                    'appeared_at' => now(),
                ]);
                $activeCount++;
                $damage += max(0, (int) $pest->damage_per_turn);
                $changed = true;
            }
        }

        return ['count' => $activeCount, 'damage' => $damage, 'changed' => $changed];
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
