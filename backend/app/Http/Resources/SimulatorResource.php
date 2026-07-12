<?php

namespace App\Http\Resources;

use App\Models\Pest;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Str;

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
            'mode' => $this->mode,
            'location_name' => $this->location_name,
            'latitude' => $this->latitude ? (float) $this->latitude : null,
            'longitude' => $this->longitude ? (float) $this->longitude : null,
            'season' => $this->season,
            'growth_point' => $this->growth_point,
            'health' => $this->health,
            'visual_state' => $this->visual_state ?? 'healthy',
            'visual_overrides' => $this->visual_overrides ?? [],
            'water' => $this->water,
            'light' => $this->light,
            'fertilizer' => $this->fertilizer,
            'soil_humidity' => $this->soil_humidity,
            'air_humidity' => $this->air_humidity,
            'soil_temp' => (float) $this->soil_temp,
            'air_temp' => (float) $this->air_temp,
            'status' => $this->status,
            'share_visibility' => $this->share_visibility ?? 'private',
            'state_version' => (int) ($this->state_version ?? 1),
            'shared_at' => $this->shared_at,
            'live_snapshot_url' => $this->publicUrl($this->live_snapshot_url),
            'updated_at' => $this->updated_at,
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
                    'model_url' => $this->publicUrl($simulationPest->pest->model_url),
                    'image_url' => $this->publicUrl($simulationPest->pest->image_url),
                    'damage_per_turn' => $simulationPest->pest->damage_per_turn,
                ],
            ])->values()),
            'plant' => new PlantResource($this->whenLoaded('plant')),
            'started_at' => $this->started_at,
            'ended_at' => $this->ended_at,
        ];
    }

    private function pestRisks(): array
    {
        $tickRisks = $this->resource->getAttribute('pest_risks');
        if (is_array($tickRisks)) {
            return $tickRisks;
        }

        return Pest::query()
            ->with('conditionRules')
            ->get()
            ->mapWithKeys(fn ($pest) => [$pest->name_en => $this->pestRiskChance($pest)])
            ->all();
    }
    
    private function pestRiskChance($pest): int
    {
        $tickRisks = $this->resource->getAttribute('pest_risks');
        if (is_array($tickRisks) && array_key_exists($pest->name_en, $tickRisks)) {
            return (int) $tickRisks[$pest->name_en];
        }

        $chance = 0.0;
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

        return '/storage/' . ltrim($path, '/');
    }
}







