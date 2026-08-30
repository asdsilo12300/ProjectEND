<?php

namespace App\Services;

use App\Models\Item;
use App\Models\Pest;
use App\Models\SimulationAction;
use App\Models\SimulationEvent;
use App\Models\SimulationModifier;
use App\Models\SimulationPest;
use App\Models\Simulator;
use App\Models\SimulationWeatherDay;
use App\Models\UserItem;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class SimulationActionService
{
    /** @param array<string, mixed> $payload */
    public function apply(Simulator $simulator, int $userId, array $payload): array
    {
        return DB::transaction(function () use ($simulator, $userId, $payload): array {
            $existing = SimulationAction::query()
                ->where('user_id', $userId)
                ->where('client_action_id', $payload['client_action_id'])
                ->with(['item', 'modifiers'])
                ->first();
            if ($existing) {
                return $this->result($existing, true);
            }

            $lockedSimulator = Simulator::query()->whereKey($simulator->id)->lockForUpdate()->firstOrFail();
            abort_unless((int) $lockedSimulator->user_id === $userId, 403);
            abort_unless($lockedSimulator->status === 'active', 409, 'Only active simulations accept care actions.');

            // A concurrent retry can pass the first lookup while the original
            // transaction is still uncommitted, then wait here for the same
            // simulator lock. Recheck after acquiring the lock so the retry
            // returns the original result instead of reaching the unique key.
            $existingAfterLock = SimulationAction::query()
                ->where('user_id', $userId)
                ->where('client_action_id', $payload['client_action_id'])
                ->with(['item', 'modifiers'])
                ->first();
            if ($existingAfterLock) {
                return $this->result($existingAfterLock, true);
            }

            $item = isset($payload['item_id'])
                ? Item::query()->whereKey($payload['item_id'])->where('is_active', true)->firstOrFail()
                : null;
            $actionKey = (string) ($payload['action_key'] ?: $item?->action_key ?: ($item ? $this->legacyActionKey($item) : ''));
            $labControlKeys = ['water', 'light', 'fertilizer', 'soil', 'air', 'soil-temp', 'temp'];
            if (! $item && ($lockedSimulator->mode !== 'greenhouse' || ! in_array($actionKey, $labControlKeys, true))) {
                throw ValidationException::withMessages(['item_id' => 'Outdoor care and inventory actions require an available item.']);
            }
            if ($item) {
                $scope = $item->mode_scope ?: 'both';
                $compatibleScopes = $lockedSimulator->mode === 'seasonal'
                    ? ['both', 'seasonal', 'outdoor']
                    : ['both', $lockedSimulator->mode];
                if (! in_array($scope, $compatibleScopes, true)) {
                    throw ValidationException::withMessages(['item_id' => 'This item cannot be used in the selected growing mode.']);
                }
            }

            if ($actionKey === 'mulch') {
                $this->assertMulchConditions($lockedSimulator, $payload['observed_precipitation'] ?? null);
            }

            if ($lockedSimulator->mode === 'seasonal') {
                $this->assertSeasonalActionAllowed($lockedSimulator, $actionKey);
            }

            $inventory = $item ? UserItem::query()
                ->where('user_id', $userId)->where('item_id', $item->id)
                ->lockForUpdate()->first() : null;
            if ($item && (! $inventory || (int) $inventory->quantity < 1)) {
                throw ValidationException::withMessages(['item_id' => 'Not enough item quantity.']);
            }
            if ($item && in_array($actionKey, ['water', 'fertilizer'], true) && (int) $lockedSimulator->{$actionKey} >= 100) {
                throw ValidationException::withMessages([
                    'action_key' => $actionKey === 'water'
                        ? 'The plant water reserve is already full.'
                        : 'The plant nutrient reserve is already full.',
                ]);
            }

            $action = SimulationAction::query()->create([
                'simulator_id' => $lockedSimulator->id, 'user_id' => $userId,
                'item_id' => $item?->id, 'simulation_event_id' => $payload['event_id'] ?? null,
                'client_action_id' => $payload['client_action_id'], 'action_key' => $actionKey,
                'animation_key' => $item?->animation_key ?: $actionKey, 'status' => 'applying',
                'target_value' => $payload['target_value'] ?? null, 'request_payload' => $payload,
            ]);

            $changes = $this->environmentChanges($lockedSimulator, $actionKey, $item, $payload['target_value'] ?? null);
            $pestResult = null;
            if ($changes === []) {
                if (! $item) {
                    $action->delete();
                    throw ValidationException::withMessages(['action_key' => 'This laboratory control is not available.']);
                }
                $pestResult = $this->treatPest($lockedSimulator, $item, $actionKey);
                if (! $pestResult['matched']) {
                    $action->delete();
                    throw ValidationException::withMessages(['action_key' => 'No matching active pest or care target was found.']);
                }
            }

            if ($changes !== []) {
                $lockedSimulator->forceFill($changes + [
                    'state_version' => ((int) $lockedSimulator->state_version) + 1,
                ])->save();
                if ($item) $this->createModifiers($lockedSimulator, $action, $actionKey, $item);
            }

            if ($inventory) $inventory->decrement('quantity');
            $resolvedEvent = $this->resolveEvent($lockedSimulator, $payload['event_id'] ?? null, $actionKey);
            $messageCode = $pestResult ? 'game.action.pest_treated' : 'game.action.applied';
            $result = [
                'changes' => $changes,
                'pest' => $pestResult,
                'event_resolved' => $resolvedEvent,
                'inventory_quantity' => $inventory ? max(0, (int) $inventory->fresh()->quantity) : null,
                'message_params' => ['item' => $item?->name ?? 'Laboratory control', 'action' => $actionKey],
            ];

            $action->forceFill([
                'status' => 'success', 'result_payload' => $result,
                'message_code' => $messageCode, 'applied_at' => now(),
            ])->save();

            return $this->result($action->fresh(['item', 'modifiers']), false);
        });
    }

    private function legacyActionKey(Item $item): string
    {
        $effect = strtolower((string) $item->effect_type);
        return match (true) {
            str_contains($effect, 'aphid') => 'aphid-treatment',
            str_contains($effect, 'snail') => 'snail-treatment',
            str_contains($effect, 'fung') => 'fungus-treatment',
            default => str($item->name)->slug()->toString(),
        };
    }

    private function assertSeasonalActionAllowed(Simulator $simulator, string $actionKey): void
    {
        if (in_array($actionKey, ['water', 'fertilizer', 'mulch'], true)) return;

        $configuredForActivePest = $simulator->activePests()
            ->whereHas('pest.knowledge', fn ($query) => $query->whereJsonContains('treatment_action_keys', $actionKey))
            ->exists();
        if ($configuredForActivePest) return;

        if (str_ends_with($actionKey, '-treatment')) {
            // Pest care is an emergency response and remains unavailable when
            // there is no matching active pest (the normal treatment check
            // below still validates the exact target). Keep this fallback for
            // legacy treatment items that predate administrator mappings.
            if ($simulator->activePests()->exists()) return;
        }

        $emergencyKeys = ['drainage', 'shade', 'windbreak', 'frost-cover'];
        if (! in_array($actionKey, $emergencyKeys, true)) {
            throw ValidationException::withMessages([
                'action_key' => 'Seasonal Journey allows watering, fertilizer, treatment for an active pest, and event-specific emergency care only.',
            ]);
        }

        $eventAllowsAction = SimulationEvent::query()
            ->where('simulator_id', $simulator->id)
            ->whereIn('status', ['announced', 'active'])
            ->whereHas('definition', fn ($query) => $query->whereJsonContains('response_action_keys', $actionKey))
            ->exists();
        $days = SimulationWeatherDay::query()
            ->where('simulator_id', $simulator->id)
            ->whereBetween('day_index', [(int) $simulator->calendar_day, (int) $simulator->calendar_day + 1])
            ->get();
        // Severe weather is announced one simulated day ahead, so protection
        // can be installed before damage is applied rather than afterwards.
        $weatherAllowsAction = $days->contains(fn (SimulationWeatherDay $day) => match ($actionKey) {
            'drainage' => (float) $day->precipitation >= 25,
            'shade' => (float) $day->temperature_max >= 36,
            'windbreak' => (float) $day->wind_gust >= 45,
            'frost-cover' => (float) $day->temperature_min <= 3 || (float) $day->snowfall > 0,
            default => false,
        });

        if (! $eventAllowsAction && ! $weatherAllowsAction) {
            throw ValidationException::withMessages([
                'action_key' => 'This emergency item becomes available only when the matching seasonal warning is active.',
            ]);
        }

        $cooldownActive = SimulationModifier::query()
            ->where('simulator_id', $simulator->id)
            ->whereHas('action', fn ($query) => $query->where('action_key', $actionKey))
            ->activeAt((int) $simulator->event_tick_count)
            ->exists();
        if ($cooldownActive) {
            throw ValidationException::withMessages([
                'action_key' => 'This emergency protection is already active. Wait for its cooldown before using another.',
            ]);
        }
    }

    private function assertMulchConditions(Simulator $simulator, mixed $observedPrecipitation): void
    {
        $plant = $simulator->plant()->firstOrFail();
        $recordedRain = (float) (SimulationWeatherDay::query()
            ->where('simulator_id', $simulator->id)
            ->where('day_index', (int) $simulator->calendar_day)
            ->value('precipitation') ?? 0);
        $observedRain = is_numeric($observedPrecipitation) ? (float) $observedPrecipitation : 0;
        $heavyRain = max($recordedRain, $observedRain) >= 25;
        $lowSoilMoisture = (float) $simulator->soil_humidity < (float) $plant->soil_humidity_min;
        $hotSoil = (float) $simulator->soil_temp > (float) $plant->soil_temp_max;

        if (! $heavyRain && ! $lowSoilMoisture && ! $hotSoil) {
            throw ValidationException::withMessages([
                'action_key' => 'Straw Mulch is available only during heavy rain (25 mm or more), when soil moisture is below the plant minimum, or when soil temperature exceeds the plant maximum.',
            ]);
        }

        $alreadyActive = SimulationModifier::query()
            ->where('simulator_id', $simulator->id)
            ->whereHas('action', fn ($query) => $query->where('action_key', 'mulch'))
            ->activeAt((int) $simulator->event_tick_count)
            ->exists();
        if ($alreadyActive) {
            throw ValidationException::withMessages([
                'action_key' => 'Straw Mulch is already active. Wait for its effect to end before using another.',
            ]);
        }
    }

    /** @return array<string, int|float> */
    private function environmentChanges(Simulator $simulator, string $actionKey, ?Item $item, mixed $targetValue): array
    {
        $plant = $simulator->plant()->firstOrFail();
        $strength = $item ? max(5, min(35, abs((int) $item->effect_value) ?: 20)) : 100;
        $knownActionKeys = ['water', 'fertilizer', 'soil', 'light', 'air', 'soil-temp', 'temp', 'mulch', 'drainage', 'shade', 'windbreak', 'frost-cover'];
        $strategy = $item ? (string) Arr::get($item->effect_payload ?? [], 'strategy', '') : '';
        $resource = $item ? (string) Arr::get($item->effect_payload ?? [], 'resource', '') : '';

        if ($item && $strategy !== '' && $resource !== '' && ! in_array($actionKey, $knownActionKeys, true)) {
            $current = is_numeric($simulator->{$resource} ?? null) ? (float) $simulator->{$resource} : null;
            $minimum = is_numeric($plant->{$resource.'_min'} ?? null) ? (float) $plant->{$resource.'_min'} : null;
            $maximum = is_numeric($plant->{$resource.'_max'} ?? null) ? (float) $plant->{$resource.'_max'} : null;

            if ($current !== null && $strategy === 'refill_reserve' && in_array($resource, ['water', 'fertilizer'], true)) {
                return [$resource => min(100, $current + $strength)];
            }
            if ($current !== null && $minimum !== null && $maximum !== null && $strategy === 'toward_healthy_midpoint') {
                $midpoint = ($minimum + $maximum) / 2;
                $step = max(1, ($maximum - $minimum) * ($strength / 100));
                $next = $current < $midpoint ? min($midpoint, $current + $step) : max($midpoint, $current - $step);
                return [$resource => round($next, str_contains($resource, 'temp') ? 2 : 0)];
            }
            if ($current !== null && $minimum !== null && $strategy === 'drainage') {
                return [$resource => max($minimum, $current - $strength)];
            }
            if ($current !== null && $strategy === 'moisture_retention') {
                return [$resource => $current];
            }
        }

        // Water and nutrients are reserves consumed by the plant. A care item
        // replenishes the reserve by a dose; it no longer moves an arbitrary
        // environmental slider toward the old min/max midpoint.
        if (in_array($actionKey, ['water', 'fertilizer'], true)) {
            $current = (int) $simulator->{$actionKey};
            $dose = $item
                ? $strength
                : max(0, min(100, (int) $targetValue) - $current);

            return [$actionKey => min(100, $current + $dose)];
        }

        $factor = match ($actionKey) {
            'soil' => 'soil_humidity',
            'light' => 'light', 'air' => 'air_humidity', 'soil-temp' => 'soil_temp', 'temp' => 'air_temp',
            default => null,
        };

        if ($factor) {
            $min = (float) $plant->{$factor.'_min'};
            $max = (float) $plant->{$factor.'_max'};
            $midpoint = ($min + $max) / 2;
            $current = (float) $simulator->{$factor};
            $requested = is_numeric($targetValue) ? (float) $targetValue : $midpoint;
            // Inventory care moves the plant toward its species-specific
            // healthy range. Direct greenhouse controls remain true
            // experiment controls and may intentionally create stress.
            $boundedTarget = $item
                ? $midpoint
                : (str_contains($factor, 'temp')
                    ? min(80, max(-20, $requested))
                    : min(100, max(0, $requested)));
            $step = $item ? max(1, ($max - $min) * ($strength / 100)) : abs($boundedTarget - $current);
            $next = $current < $boundedTarget ? min($boundedTarget, $current + $step) : max($boundedTarget, $current - $step);
            return [$factor => round($next, str_contains($factor, 'temp') ? 2 : 0)];
        }

        return match ($actionKey) {
            // Mulch does not create water. Its benefit is applied by the timed
            // modifiers below, which offset evaporation and moisture loss.
            'mulch' => ['soil_humidity' => (int) $simulator->soil_humidity],
            'drainage' => [
                'soil_humidity' => max((int) $plant->soil_humidity_min, (int) $simulator->soil_humidity - $strength),
            ],
            'shade' => [
                'light' => max((int) $plant->light_min, (int) $simulator->light - $strength),
                'air_temp' => max((float) $plant->air_temp_min, (float) $simulator->air_temp - 4),
            ],
            // Keep an immediate, visible response on the simulator while the
            // temporary modifier below reduces the actual wind readings used
            // by the next seasonal calculations.
            'windbreak' => ['air_humidity' => min((int) $plant->air_humidity_max, (int) $simulator->air_humidity + 4)],
            'frost-cover' => [
                'air_temp' => min((float) $plant->air_temp_max, (float) $simulator->air_temp + 5),
                'soil_temp' => min((float) $plant->soil_temp_max, (float) $simulator->soil_temp + 3),
            ],
            default => [],
        };
    }

    private function createModifiers(Simulator $simulator, SimulationAction $action, string $actionKey, Item $item): void
    {
        $duration = max(1, (int) Arr::get($item->effect_payload ?? [], 'duration_ticks', 1));
        $durationSeconds = max(5, min(300, (int) Arr::get($item->effect_payload ?? [], 'duration_seconds', 30)));
        $tick = (int) $simulator->event_tick_count;
        $temporary = match ($actionKey) {
            'mulch' => ['water' => 2, 'soil_humidity' => 3],
            'shade' => ['light' => -10, 'air_temp' => -2],
            'windbreak' => ['wind_speed' => -25, 'wind_gust' => -35, 'air_humidity' => 3],
            'frost-cover' => ['air_temp' => 4, 'soil_temp' => 2],
            'drainage' => ['soil_humidity' => -8],
            default => match ((string) Arr::get($item->effect_payload ?? [], 'strategy', '')) {
                'moisture_retention' => [(string) Arr::get($item->effect_payload ?? [], 'resource', 'soil_humidity') => 3, 'water' => 2],
                default => [],
            },
        };
        foreach ($temporary as $factor => $value) {
            SimulationModifier::query()->create([
                'simulator_id' => $simulator->id, 'simulation_action_id' => $action->id,
                'factor_key' => $factor, 'add_value' => $value, 'multiply_value' => 1,
                'starts_tick' => $tick, 'ends_tick' => $tick + $duration,
                'expires_at' => now()->addSeconds($durationSeconds),
            ]);
        }
    }

    /** @return array{matched: bool, removed: array<int, string>} */
    private function treatPest(Simulator $simulator, Item $item, string $actionKey): array
    {
        $effect = strtolower((string) $item->effect_type.' '.$actionKey);
        $configuredTargets = Pest::query()
            ->whereHas('knowledge', fn ($query) => $query->whereJsonContains('treatment_action_keys', $actionKey))
            ->pluck('name_en')
            ->map(fn ($name) => strtolower((string) $name));
        $targets = collect(['aphid', 'snail', 'fungus'])
            ->filter(fn ($name) => str_contains($effect, $name))
            ->merge($configuredTargets)
            ->filter()
            ->unique()
            ->values();
        if ($targets->isEmpty() && str_contains($effect, 'manual')) $targets = collect(['aphid', 'snail']);
        $pests = SimulationPest::query()
            ->select('simulation_pests.*')->addSelect('pests.name_en as pest_name_en')
            ->join('pests', 'pests.id', '=', 'simulation_pests.pest_id')
            ->where('simulation_pests.simulator_id', $simulator->id)
            ->where('simulation_pests.status', 'active')
            ->when($targets->isNotEmpty(), fn ($query) => $query->whereIn(DB::raw('LOWER(pests.name_en)'), $targets->all()))
            ->lockForUpdate()->get();
        foreach ($pests as $pest) $pest->forceFill(['status' => 'treated', 'treated_at' => now()])->save();
        return ['matched' => $pests->isNotEmpty(), 'removed' => $pests->pluck('pest_name_en')->filter()->values()->all()];
    }

    private function resolveEvent(Simulator $simulator, mixed $eventId, string $actionKey): bool
    {
        if (! $eventId) return false;
        $event = SimulationEvent::query()->with('definition')->whereKey($eventId)->where('simulator_id', $simulator->id)->lockForUpdate()->first();
        if (! $event || ! in_array($event->status, ['announced', 'active'], true)) return false;
        if (! in_array($actionKey, $event->definition?->response_action_keys ?? [], true)) return false;
        $event->forceFill(['status' => 'resolved', 'resolved_at' => now(), 'resolved_by_action_key' => $actionKey])->save();
        return true;
    }

    private function result(SimulationAction $action, bool $replayed): array
    {
        $simulator = $action->simulator()->firstOrFail();

        return [
            'action' => $action,
            'message_code' => $action->message_code,
            'message_params' => $action->result_payload['message_params'] ?? [],
            'inventory_quantity' => $action->result_payload['inventory_quantity'] ?? null,
            'simulator' => $simulator,
            'active_modifiers' => SimulationModifier::query()->where('simulator_id', $action->simulator_id)
                ->with('action')
                ->activeAt((int) ($simulator->event_tick_count ?? 0))->get(),
            'replayed' => $replayed,
        ];
    }
}
