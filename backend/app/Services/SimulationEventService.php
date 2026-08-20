<?php

namespace App\Services;

use App\Models\EventDefinition;
use App\Models\SimulationEvent;
use App\Models\SimulationModifier;
use App\Models\Simulator;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;

class SimulationEventService
{
    /** @param array<string, int|float|null> $factors */
    public function advance(Simulator $simulator, array $factors): array
    {
        return DB::transaction(function () use ($simulator, $factors): array {
            $simulator = Simulator::query()->whereKey($simulator->id)->lockForUpdate()->firstOrFail();
            $tick = (int) $simulator->event_tick_count + 1;
            $simulator->forceFill(['event_tick_count' => $tick])->save();

            SimulationEvent::query()->where('simulator_id', $simulator->id)->where('status', 'announced')
                ->where('starts_tick', '<=', $tick)->update(['status' => 'active', 'updated_at' => now()]);
            SimulationEvent::query()->where('simulator_id', $simulator->id)->whereIn('status', ['announced', 'active'])
                ->where('ends_tick', '<', $tick)->update(['status' => 'expired', 'updated_at' => now()]);

            $this->schedule($simulator, $tick, $factors);
            $events = SimulationEvent::query()->with('definition')->where('simulator_id', $simulator->id)
                ->whereIn('status', ['announced', 'active'])->orderBy('starts_tick')->get();

            foreach ($events->where('status', 'active') as $event) {
                foreach (Arr::get($event->effect_snapshot ?? [], 'factor_delta', []) as $factor => $delta) {
                    if (array_key_exists($factor, $factors)) $factors[$factor] = (float) $factors[$factor] + (float) $delta;
                }
            }
            $modifiers = SimulationModifier::query()->with('action')->where('simulator_id', $simulator->id)
                ->activeAt($tick)->get();
            foreach ($modifiers as $modifier) {
                if (array_key_exists($modifier->factor_key, $factors)) {
                    $factors[$modifier->factor_key] = (($factors[$modifier->factor_key] ?? 0) + $modifier->add_value) * $modifier->multiply_value;
                }
            }

            return [
                'factors' => $this->clampFactors($factors),
                'events' => $events,
                'modifiers' => $modifiers,
                'tick' => $tick,
            ];
        });
    }

    /** @param array<string, int|float|null> $factors */
    private function schedule(Simulator $simulator, int $tick, array $factors): void
    {
        // Seasonal hazards come from the persisted weather timeline. Random
        // events here would contradict the weather shown in the forecast HUD.
        if ($simulator->mode === 'seasonal') return;

        $activeHarmful = SimulationEvent::query()->where('simulator_id', $simulator->id)
            ->whereIn('status', ['announced', 'active'])->whereHas('definition', fn ($q) => $q->where('is_harmful', true))->exists();
        if ($activeHarmful) return;

        $harvests = $simulator->user()->withCount(['plantHistories as completed_harvests' => fn ($q) => $q->whereNotNull('simulator_id')])->first()?->completed_harvests ?? 0;
        if ($harvests === 0 && $tick <= 2) return;
        $allowedSeverity = $harvests === 0 ? ['low'] : ($harvests < 5 ? ['low', 'medium'] : ['low', 'medium', 'high']);
        $last = SimulationEvent::query()->with('definition')->where('simulator_id', $simulator->id)->latest('ends_tick')->first();
        if ($last && $tick <= (int) $last->ends_tick + max(1, (int) ($last->definition?->cooldown_ticks ?? 2))) return;

        $definitions = EventDefinition::query()->where('is_active', true)
            ->whereIn('mode_scope', ['both', $simulator->mode])->whereIn('severity', $allowedSeverity)->orderBy('id')->get()
            ->filter(fn (EventDefinition $definition): bool => $this->matchesConditions($definition->conditions ?? [], $factors));
        if ($definitions->isEmpty()) return;
        $roll = (abs(crc32($simulator->id.':'.$tick.':event')) % 100) + 1;
        $chance = min(38, max(4, (int) round($definitions->avg('trigger_chance'))));
        if ($roll > $chance) return;

        $weighted = $definitions->flatMap(fn ($definition) => array_fill(0, max(1, min(50, (int) $definition->weight)), $definition));
        $definition = $weighted[abs(crc32($simulator->id.':'.$tick.':pick')) % $weighted->count()];
        $starts = $tick + (int) $definition->warning_ticks;
        SimulationEvent::query()->create([
            'simulator_id' => $simulator->id, 'event_definition_id' => $definition->id,
            'status' => $definition->warning_ticks > 0 ? 'announced' : 'active',
            'announced_tick' => $tick, 'starts_tick' => $starts,
            'ends_tick' => $starts + max(1, (int) $definition->duration_ticks) - 1,
            'seed' => abs(crc32($simulator->id.':'.$tick.':'.$definition->event_key)),
            'effect_snapshot' => $definition->effects ?? [],
        ]);
        if ($definition->is_harmful) $simulator->forceFill(['last_harmful_event_at' => now()])->save();
    }

    /**
     * Conditions accept either a list of objects such as
     * [{"factor":"air_temp","operator":"above","value":34}] or a compact
     * map such as {"air_temp":{"min":34},"air_humidity":{"max":75}}.
     * An empty condition list intentionally matches every environment.
     *
     * @param array<int|string, mixed> $conditions
     * @param array<string, int|float|null> $factors
     */
    private function matchesConditions(array $conditions, array $factors): bool
    {
        if ($conditions === []) return true;

        $rules = array_is_list($conditions)
            ? $conditions
            : collect($conditions)->map(fn ($constraint, $factor) => is_array($constraint)
                ? ['factor' => $factor, ...$constraint]
                : ['factor' => $factor, 'operator' => 'equals', 'value' => $constraint])->values()->all();

        foreach ($rules as $rule) {
            if (!is_array($rule)) return false;
            $factor = (string) ($rule['factor'] ?? '');
            if ($factor === '' || !array_key_exists($factor, $factors) || $factors[$factor] === null) return false;
            $actual = (float) $factors[$factor];
            $operator = (string) ($rule['operator'] ?? (array_key_exists('min', $rule) && array_key_exists('max', $rule) ? 'between' : (array_key_exists('min', $rule) ? 'above_or_equal' : (array_key_exists('max', $rule) ? 'below_or_equal' : 'equals'))));
            $value = (float) ($rule['value'] ?? $rule['min'] ?? 0);
            $min = (float) ($rule['min'] ?? $value);
            $max = (float) ($rule['max'] ?? $value);

            $matches = match ($operator) {
                'above' => $actual > $value,
                'above_or_equal', 'min' => $actual >= $min,
                'below' => $actual < $value,
                'below_or_equal', 'max' => $actual <= $max,
                'between' => $actual >= min($min, $max) && $actual <= max($min, $max),
                'outside' => $actual < min($min, $max) || $actual > max($min, $max),
                'equals', '=' => abs($actual - $value) < 0.0001,
                default => false,
            };
            if (!$matches) return false;
        }

        return true;
    }

    private function clampFactors(array $factors): array
    {
        foreach (['water', 'light', 'fertilizer', 'soil_humidity', 'air_humidity'] as $key) {
            if (isset($factors[$key])) $factors[$key] = (int) min(100, max(0, round($factors[$key])));
        }
        foreach (['soil_temp', 'air_temp'] as $key) {
            if (isset($factors[$key])) $factors[$key] = round(min(80, max(-20, (float) $factors[$key])), 2);
        }
        foreach (['rain', 'snowfall', 'wind_speed', 'wind_gust', 'shortwave_radiation', 'evapotranspiration'] as $key) {
            if (isset($factors[$key])) $factors[$key] = round(max(0, (float) $factors[$key]), 2);
        }
        if (isset($factors['cloud_cover'])) {
            $factors['cloud_cover'] = round(min(100, max(0, (float) $factors['cloud_cover'])), 2);
        }
        return $factors;
    }
}
