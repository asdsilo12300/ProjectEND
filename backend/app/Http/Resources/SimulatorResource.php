<?php

namespace App\Http\Resources;

use App\Models\Pest;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Str;
use App\Services\SeasonalWeatherService;

class SimulatorResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $stage = $this->whenLoaded('currentStage');
        $variant = $this->whenLoaded('visualVariant');
        $modelPath = $variant?->model_url ?: $stage?->model_url ?: $this->plant?->base_model_url;

        return [
            'id' => $this->id,
            'plant_id' => $this->plant_id,
            'plant_available' => $this->plant !== null && $this->plant->deleted_at === null,
            'mode' => $this->mode,
            'location_name' => $this->location_name,
            'location_timezone' => $this->location_timezone,
            'location_changed_at' => $this->location_changed_at,
            'latitude' => $this->latitude ? (float) $this->latitude : null,
            'longitude' => $this->longitude ? (float) $this->longitude : null,
            'season' => $this->season,
            'climate_zone' => $this->climate_zone,
            'season_key' => $this->season_key,
            'start_month' => $this->start_month === null ? null : (int) $this->start_month,
            'simulated_datetime' => $this->simulated_datetime,
            'calendar_day' => (int) ($this->calendar_day ?? 0),
            'biological_days' => round((float) ($this->biological_days ?? 0), 2),
            'weather_seed' => $this->weather_seed === null ? null : (int) $this->weather_seed,
            'weather_source' => $this->weather_source,
            'weather_profile_version' => $this->weather_profile_version,
            'seasonal_context' => $this->mode === 'seasonal'
                ? ($this->resource->getAttribute('seasonal_context_payload')
                    ?? app(SeasonalWeatherService::class)->context($this->resource))
                : null,
            'growth_point' => $this->growth_point,
            'health' => $this->health,
            'visual_state' => $this->visual_state ?? 'healthy',
            'visual_overrides' => $this->visual_overrides ?? [],
            'water' => $this->water,
            'light' => $this->light,
            'fertilizer' => $this->fertilizer,
            'plant_needs' => [
                'water' => (int) $this->water,
                'fertilizer' => (int) $this->fertilizer,
                'rates' => $this->resource->getAttribute('plant_need_rates') ?? [
                    'water_per_cycle' => 3,
                    'fertilizer_per_cycle' => 0.25,
                    'rain_recovery' => 0,
                ],
            ],
            'soil_humidity' => $this->soil_humidity,
            'air_humidity' => $this->air_humidity,
            'soil_temp' => (float) $this->soil_temp,
            'air_temp' => (float) $this->air_temp,
            'status' => $this->status,
            'share_visibility' => $this->share_visibility ?? 'private',
            'state_version' => (int) ($this->state_version ?? 1),
            'event_tick_count' => (int) ($this->event_tick_count ?? 0),
            'shared_at' => $this->shared_at,
            'live_snapshot_url' => $this->publicUrl($this->live_snapshot_url),
            'updated_at' => $this->updated_at,
            'active_seconds' => max(0, (int) ($this->active_seconds ?? 0)),
            'owner' => $this->whenLoaded('user', fn () => [
                'id' => $this->user->id,
                'username' => $this->user->username,
                'avatar_url' => $this->user->avatar_url,
                'level' => $this->user->level,
            ]),
            'maturity_reward_claimed_at' => $this->maturity_reward_claimed_at,
            'maturity_reward_amount' => (int) ($this->maturity_reward_amount ?? 0),
            'current_stage' => $stage ? new PlantStageResource($stage) : null,
            'current_model_url' => $this->publicUrl($modelPath),
            'pest_risks' => $this->pestRisks(),
            'visual_variant' => $variant ? [
                'id' => $variant->id,
                'state_key' => $variant->state_key,
                'label' => $variant->label,
                'model_url' => $this->publicUrl($variant->model_url),
            ] : null,
            'active_pests' => $this->whenLoaded('activePests', fn () => $this->activePests->map(fn ($simulationPest) => [
                'id' => $simulationPest->id,
                'status' => $simulationPest->status,
                'appeared_at' => $simulationPest->appeared_at,
                'risk_chance' => $this->pestRiskChance($simulationPest->pest),
                'pest' => [
                    'id' => $simulationPest->pest->id,
                    'name_th' => $simulationPest->pest->name_th,
                    'name_en' => $simulationPest->pest->name_en,
                    'placement_mode' => $simulationPest->pest->placement_mode ?? 'ground_random',
                    'model_url' => $this->publicUrl($simulationPest->pest->model_url),
                    'image_url' => $this->publicUrl($simulationPest->pest->image_url),
                    'damage_per_turn' => $simulationPest->pest->damage_per_turn,
                ],
            ])->values()),
            'events' => $this->whenLoaded('simulationEvents', fn () => $this->simulationEvents
                ->whereIn('status', ['announced', 'active'])
                ->map(fn ($event) => [
                    'id' => $event->id,
                    'event_key' => $event->definition?->event_key,
                    'name_en' => $event->definition?->name_en,
                    'name_th' => $event->definition?->name_th,
                    'description_en' => $event->definition?->description_en,
                    'description_th' => $event->definition?->description_th,
                    'severity' => $event->definition?->severity,
                    'is_harmful' => (bool) $event->definition?->is_harmful,
                    'response_action_keys' => $event->definition?->response_action_keys ?? [],
                    'status' => $event->status,
                    'starts_tick' => (int) $event->starts_tick,
                    'ends_tick' => (int) $event->ends_tick,
                ])->values()),
            'active_modifiers' => $this->whenLoaded('modifiers', fn () => $this->modifiers
                ->filter(fn ($modifier) => $modifier->isActiveAt((int) $this->event_tick_count))
                ->map(fn ($modifier) => [
                    'id' => $modifier->id,
                    'action_key' => $modifier->action?->action_key,
                    'animation_key' => $modifier->action?->animation_key,
                    'factor_key' => $modifier->factor_key,
                    'add_value' => (float) $modifier->add_value,
                    'multiply_value' => (float) $modifier->multiply_value,
                    'starts_tick' => (int) $modifier->starts_tick,
                    'ends_tick' => $modifier->ends_tick === null ? null : (int) $modifier->ends_tick,
                    'expires_at' => $modifier->expires_at?->toIso8601String(),
                    'remaining_seconds' => $modifier->expires_at === null
                        ? null
                        : max(0, (int) ceil(now()->diffInMilliseconds($modifier->expires_at, false) / 1000)),
                ])->values()),
            'plant' => new PlantResource($this->whenLoaded('plant')),
            'started_at' => $this->started_at,
            'ended_at' => $this->ended_at,
        ];
    }

    private function pestRisks(): array
    {
        $tickRisks = $this->resource->getAttribute('pest_risks');

        return Pest::query()
            ->with('conditionRules')
            ->get()
            ->mapWithKeys(fn ($pest) => [
                $pest->name_en => is_array($tickRisks) && array_key_exists($pest->name_en, $tickRisks)
                    ? (int) $tickRisks[$pest->name_en]
                    : $this->pestRiskChance($pest),
            ])
            ->all();
    }

    private function pestRiskChance($pest): int
    {
        $tickRisks = $this->resource->getAttribute('pest_risks');
        if (is_array($tickRisks) && array_key_exists($pest->name_en, $tickRisks)) {
            return (int) $tickRisks[$pest->name_en];
        }

        $chance = (float) $pest->base_chance;
        $factors = [
            'water' => $this->water,
            'light' => $this->light,
            'fertilizer' => $this->fertilizer,
            'soil_humidity' => $this->soil_humidity,
            'air_humidity' => $this->air_humidity,
            'soil_temp' => $this->soil_temp,
            'air_temp' => $this->air_temp,
        ];

        foreach ($pest->conditionRules ?? [] as $rule) {
            if (! $rule->is_active || ! array_key_exists($rule->factor, $factors) || $factors[$rule->factor] === null) {
                continue;
            }

            if ($rule->plant_id !== null && (int) $rule->plant_id !== (int) $this->plant_id) {
                continue;
            }

            if ($this->matchesPestRule($rule, (float) $factors[$rule->factor])) {
                $chance += (float) $rule->chance_delta;
            }
        }

        return min(100, max(0, (int) round($chance)));
    }

    private function matchesPestRule($rule, float $value): bool
    {
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

    private function publicUrl(?string $path): ?string
    {
        if (! $path) {
            return null;
        }

        if (Str::startsWith($path, ['http://', 'https://', '/'])) {
            return $path;
        }

        return '/storage/'.ltrim($path, '/');
    }
}
