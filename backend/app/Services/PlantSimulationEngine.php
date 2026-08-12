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
use Illuminate\Support\Facades\Schema;
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
            $resourceState = $this->consumePlantResources($simulator, $plant, $factors);
            $factors['water'] = $resourceState['water'];
            $factors['fertilizer'] = $resourceState['fertilizer'];
            $matchedRules = $plant->conditionRules
                ->where('is_active', true)
                // Water and fertilizer now represent remaining reserves. Old
                // upper-bound rules would incorrectly punish a full meter.
                ->whereNotIn('factor', ['water', 'fertilizer'])
                ->filter(fn (PlantConditionRule $rule) => $this->matchesRule($rule, $factors))
                ->sortByDesc('severity')
                ->values();

            $healthDelta = (int) $matchedRules->sum('health_delta') + $resourceState['health_delta'];
            if ($simulator->mode === 'outdoor') {
                // Outdoor weather may combine several rules at once. Cap the
                // environmental loss so the player always gets a recovery turn.
                $healthDelta = max(-16, $healthDelta);
            }
            $growthDelta = (int) $matchedRules->sum('growth_delta') + $resourceState['growth_delta'];
            $stressCount = $matchedRules->filter(fn (PlantConditionRule $rule) => $rule->health_delta < 0 || $rule->growth_delta < 0)->count()
                + $resourceState['stress_count'];
            $wasDepleted = (int) $simulator->health === 0;
            $naturalRecovery = $stressCount === 0 ? 3 : 0;

            // Keep the dominant environmental symptom as the visual state.
            // Growth can still be stunted or paused by several simultaneous
            // stresses, but replacing a specific cause such as heat stress
            // with the generic "stunted" state hides the corresponding colour
            // and deformation from the 3D plant.
            $dominantVisualState = $resourceState['critical']
                ? $resourceState['visual_state']
                : ($matchedRules->first()?->visual_state ?? $resourceState['visual_state']);
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
            if ($simulator->mode === 'outdoor') {
                $nextHealth = max($nextHealth, max(0, $startingHealth - 20));
            }

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
            $analysisMessages = $matchedRules->pluck('analysis_result')->filter()->values()->all();
            $directionMessages = $matchedRules->pluck('direction')->filter()->values()->all();
            if ($resourceState['analysis']) $analysisMessages[] = $resourceState['analysis'];
            if ($resourceState['direction']) $directionMessages[] = $resourceState['direction'];
            $analysis = $this->analysisText($analysisMessages, $visualState);
            $direction = $this->directionText($directionMessages, $visualState);
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
            $freshSimulator->setAttribute('plant_need_rates', [
                'water_per_cycle' => $resourceState['water_consumed'],
                'fertilizer_per_cycle' => $resourceState['fertilizer_consumed'],
                'rain_recovery' => $resourceState['rain_recovery'],
            ]);

            return $freshSimulator;
        });
    }

    /**
     * Convert the old adjustable water/fertilizer factors into persistent
     * reserves. Water responds quickly to plant size, heat, light and dry air;
     * nutrients are intentionally consumed about an order of magnitude more
     * slowly so care remains understandable instead of becoming busywork.
     *
     * @param  array<string, int|float|null>  $factors
     * @return array<string, int|float|string|bool|null>
     */
    private function consumePlantResources(Simulator $simulator, Plant $plant, array $factors): array
    {
        $water = $this->clamp((int) Arr::get($factors, 'water', $simulator->water), 0, 100);
        $fertilizer = $this->clamp((int) Arr::get($factors, 'fertilizer', $simulator->fertilizer), 0, 100);
        $maxGrowth = max(1, (int) $plant->stages()->max('required_growth_point'));
        $growthRatio = min(1, max(0, (float) $simulator->growth_point / $maxGrowth));
        $airTemperature = (float) Arr::get($factors, 'air_temp', $simulator->air_temp);
        $airHumidity = (float) Arr::get($factors, 'air_humidity', $simulator->air_humidity);
        $light = (float) Arr::get($factors, 'light', $simulator->light);
        $rain = $simulator->mode === 'outdoor' ? max(0, (float) Arr::get($factors, 'rain', 0)) : 0;

        $heatLoad = max(0, $airTemperature - (float) $plant->air_temp_max) * 0.18;
        $dryAirLoad = max(0, (float) $plant->air_humidity_min - $airHumidity) * 0.04;
        $lightLoad = max(0, $light - (float) $plant->light_max) * 0.025;
        $waterConsumed = max(1, min(8, (int) round(2.2 + ($growthRatio * 1.8) + $heatLoad + $dryAirLoad + $lightLoad)));
        $rainRecovery = min(12, (int) round($rain * 4));
        $nextWater = $this->clamp($water - $waterConsumed + $rainRecovery, 0, 100);

        $tick = max(1, (int) ($simulator->event_tick_count ?? 1));
        $fertilizerConsumed = $tick % 4 === 0 ? 1 : 0;
        $nextFertilizer = $this->clamp($fertilizer - $fertilizerConsumed, 0, 100);

        $healthDelta = 0;
        $growthDelta = 0;
        $stressCount = 0;
        $visualState = null;
        $analysis = null;
        $direction = null;
        $critical = false;

        if ($nextWater <= 8) {
            $healthDelta -= 12;
            $growthDelta -= 14;
            $stressCount++;
            $visualState = 'underwatered';
            $analysis = 'The plant water reserve is critically low.';
            $direction = 'Use a watering item before the next update.';
            $critical = true;
        } elseif ($nextWater <= 25) {
            $healthDelta -= 5;
            $growthDelta -= 7;
            $stressCount++;
            $visualState = 'underwatered';
            $analysis = 'The plant is using its remaining water reserve.';
            $direction = 'Water the plant soon to keep growth stable.';
        }

        if ($nextFertilizer <= 10) {
            $healthDelta -= 5;
            $growthDelta -= 9;
            $stressCount++;
            if (! $critical) $visualState = 'nutrient_deficient';
            $analysis = trim(($analysis ? $analysis.' ' : '').'The nutrient reserve is critically low.');
            $direction = trim(($direction ? $direction.' ' : '').'Apply fertilizer to restore available nutrients.');
        } elseif ($nextFertilizer <= 22) {
            $growthDelta -= 4;
            $stressCount++;
            $visualState ??= 'nutrient_deficient';
            $analysis = trim(($analysis ? $analysis.' ' : '').'The nutrient reserve is running low.');
            $direction = trim(($direction ? $direction.' ' : '').'Plan a fertilizer application soon.');
        }

        return [
            'water' => $nextWater,
            'fertilizer' => $nextFertilizer,
            'water_consumed' => $waterConsumed,
            'fertilizer_consumed' => $fertilizerConsumed,
            'rain_recovery' => $rainRecovery,
            'health_delta' => $healthDelta,
            'growth_delta' => $growthDelta,
            'stress_count' => $stressCount,
            'visual_state' => $visualState,
            'analysis' => $analysis,
            'direction' => $direction,
            'critical' => $critical,
        ];
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
        $newPestCreated = false;
        $tick = (int) ($simulator->event_tick_count ?? 0);
        $hasEventClock = Schema::hasColumn('simulators', 'event_tick_count');
        $canIntroducePest = ! $hasEventClock || ($tick > 2 && $tick % 2 === 0);
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

            $roll = (abs(crc32($simulator->id.':'.$tick.':pest:'.$pest->id)) % 100) + 1;
            if (! $newPestCreated && $canIntroducePest && $chance > 0 && ($chance >= 100 || $roll <= $chance)) {
                SimulationPest::query()->create([
                    'simulator_id' => $simulator->id,
                    'pest_id' => $pest->id,
                    'status' => 'active',
                    'appeared_at' => now(),
                ]);
                $activeCount++;
                $damage += max(0, (int) $pest->damage_per_turn);
                $changed = true;
                $newPestCreated = true;
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
