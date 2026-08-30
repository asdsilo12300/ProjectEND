<?php

namespace App\Services;

use App\Models\Achievement;
use App\Models\AnimationPreset;
use App\Models\EventDefinition;
use App\Models\Item;
use App\Models\ItemType;
use App\Models\ModelAsset;
use App\Models\Pest;
use App\Models\PestConditionRule;
use App\Models\PestKnowledge;
use App\Models\Plant;
use App\Models\PlantConditionRule;
use App\Models\PlantGrowthStage;
use App\Models\PlantKnowledge;
use App\Models\PlantVisualVariant;
use App\Models\Quest;
use App\Models\ShopItem;
use App\Models\SimulationModeReward;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Validation\Validator;

class AdminSimulationDataValidator
{
    /** @param array<string, mixed> $data */
    public function validate(string $resource, array $data, ?int $recordId, Validator $validator): void
    {
        if ($validator->errors()->isNotEmpty()) {
            return;
        }

        match ($resource) {
            'plants' => $this->validatePlant($data, $recordId, $validator),
            'plant-stages' => $this->validateStage($data, $recordId, $validator),
            'plant-rules' => $this->validateConditionRule(PlantConditionRule::class, 'plant_id', $data, $recordId, $validator),
            'plant-variants' => $this->validateVariant($data, $recordId, $validator),
            'plant-knowledge' => $this->validateKnowledge(PlantKnowledge::query(), 'plant_id', $data, $recordId, $validator, ['care_en', 'care_th']),
            'pests' => $this->validatePest($data, $recordId, $validator),
            'pest-knowledge' => $this->validateKnowledge(PestKnowledge::query(), 'pest_id', $data, $recordId, $validator, ['signs_en', 'signs_th', 'favorable_conditions_en', 'favorable_conditions_th', 'prevention_en', 'prevention_th', 'treatment_action_keys']),
            'pest-rules' => $this->validateConditionRule(PestConditionRule::class, 'pest_id', $data, $recordId, $validator),
            'item-types' => $this->validateItemType($data, $recordId, $validator),
            'animation-presets' => $this->validateAnimationPreset($data, $recordId, $validator),
            'items' => $this->validateItem($data, $recordId, $validator),
            'shop-items' => $this->validateUniqueValue(ShopItem::query(), 'item_id', $data['item_id'] ?? null, $recordId, $validator, 'item_id', 'This item already has a shop listing.'),
            'event-definitions' => $this->validateEvent($data, $recordId, $validator),
            'simulation-mode-rewards' => $this->validateUniqueValue(SimulationModeReward::query(), 'mode', $data['mode'] ?? null, $recordId, $validator, 'mode', 'This simulation mode already has a reward row.'),
            'quests' => $this->validateQuest($data, $recordId, $validator),
            'achievements' => $this->validateAchievement($data, $recordId, $validator),
            'model-assets' => $this->validateUniqueText(ModelAsset::query(), 'asset_key', $data['asset_key'] ?? null, $recordId, $validator, 'asset_key', 'A model asset with this key already exists.'),
            default => null,
        };
    }

    /** @param array<string, mixed> $data */
    private function validatePlant(array $data, ?int $recordId, Validator $validator): void
    {
        $this->validateUniqueText(Plant::query(), 'name_th', $data['name_th'] ?? null, $recordId, $validator, 'name_th', 'A plant with this Thai name already exists.');
        $this->validateUniqueText(Plant::query(), 'name_en', $data['name_en'] ?? null, $recordId, $validator, 'name_en', 'A plant with this English name already exists.');
        foreach (['water', 'light', 'fertilizer', 'soil_humidity', 'air_humidity', 'soil_temp', 'air_temp'] as $factor) {
            $this->validateOrderedRange($data, "{$factor}_min", "{$factor}_max", $validator, ucfirst(str_replace('_', ' ', $factor)));
        }
    }

    /** @param array<string, mixed> $data */
    private function validatePest(array $data, ?int $recordId, Validator $validator): void
    {
        $this->validateUniqueText(Pest::query(), 'name_th', $data['name_th'] ?? null, $recordId, $validator, 'name_th', 'A pest with this Thai name already exists.');
        $this->validateUniqueText(Pest::query(), 'name_en', $data['name_en'] ?? null, $recordId, $validator, 'name_en', 'A pest with this English name already exists.');
    }

    /** @param array<string, mixed> $data */
    private function validateItem(array $data, ?int $recordId, Validator $validator): void
    {
        $this->validateUniqueText(Item::query(), 'name', $data['name'] ?? null, $recordId, $validator, 'name', 'An item with this name already exists.');
        if (! empty($data['action_key'])) {
            $this->validateUniqueText(Item::query(), 'action_key', $data['action_key'], $recordId, $validator, 'action_key', 'Another item already uses this simulation action.');
        }

        $effects = is_array($data['effect_payload'] ?? null) ? $data['effect_payload'] : [];
        $strategy = (string) ($effects['strategy'] ?? '');
        $resource = (string) ($effects['resource'] ?? '');
        $allowedResources = [
            'refill_reserve' => ['water', 'fertilizer'],
            'toward_healthy_midpoint' => ['water', 'light', 'fertilizer', 'soil_humidity', 'air_humidity', 'soil_temp', 'air_temp'],
            'drainage' => ['soil_humidity'],
            'moisture_retention' => ['soil_humidity'],
        ];
        if ($strategy !== '' && $resource === '') {
            $validator->errors()->add('effect_payload.resource', 'Choose which plant resource this item affects.');
        } elseif ($strategy !== '' && ! in_array($resource, $allowedResources[$strategy] ?? [], true)) {
            $validator->errors()->add('effect_payload.resource', 'The selected resource does not match this item behavior.');
        }
    }

    /** @param array<string, mixed> $data */
    private function validateItemType(array $data, ?int $recordId, Validator $validator): void
    {
        $this->validateUniqueText(ItemType::query(), 'key', $data['key'] ?? null, $recordId, $validator, 'key', 'An item type with this key already exists.');
        $this->validateUniqueText(ItemType::query(), 'name_en', $data['name_en'] ?? null, $recordId, $validator, 'name_en', 'An item type with this English name already exists.');
        $this->validateUniqueText(ItemType::query(), 'name_th', $data['name_th'] ?? null, $recordId, $validator, 'name_th', 'An item type with this Thai name already exists.');
    }

    /** @param array<string, mixed> $data */
    private function validateAnimationPreset(array $data, ?int $recordId, Validator $validator): void
    {
        $this->validateUniqueText(AnimationPreset::query(), 'key', $data['key'] ?? null, $recordId, $validator, 'key', 'An animation preset with this key already exists.');
        $this->validateUniqueText(AnimationPreset::query(), 'name_en', $data['name_en'] ?? null, $recordId, $validator, 'name_en', 'An animation preset with this English name already exists.');
        $this->validateUniqueText(AnimationPreset::query(), 'name_th', $data['name_th'] ?? null, $recordId, $validator, 'name_th', 'An animation preset with this Thai name already exists.');
    }

    /** @param array<string, mixed> $data */
    private function validateStage(array $data, ?int $recordId, Validator $validator): void
    {
        $query = PlantGrowthStage::query()->where('plant_id', $data['plant_id']);
        $this->validateUniqueText(clone $query, 'stage_name', $data['stage_name'] ?? null, $recordId, $validator, 'stage_name', 'This plant already has a growth stage with the same name.');

        $duplicateGrowth = (clone $query)->where('required_growth_point', $data['required_growth_point']);
        $this->ignoreRecord($duplicateGrowth, $recordId);
        if ($duplicateGrowth->exists()) {
            $validator->errors()->add('required_growth_point', 'This plant already has a stage at the same growth point. Each stage must start at a different point.');
        }
    }

    /** @param array<string, mixed> $data */
    private function validateVariant(array $data, ?int $recordId, Validator $validator): void
    {
        $query = PlantVisualVariant::query()
            ->where('plant_id', $data['plant_id'])
            ->where('state_key', $data['state_key']);
        empty($data['stage_id']) ? $query->whereNull('stage_id') : $query->where('stage_id', $data['stage_id']);
        $this->ignoreRecord($query, $recordId);
        if ($query->exists()) {
            $validator->errors()->add('state_key', 'This plant already has a visual variant for the same growth stage and state.');
        }
    }

    /**
     * @param class-string<PlantConditionRule|PestConditionRule> $model
     * @param array<string, mixed> $data
     */
    private function validateConditionRule(string $model, string $ownerKey, array $data, ?int $recordId, Validator $validator): void
    {
        $operator = (string) $data['operator'];
        $min = $data['min_value'] ?? null;
        $max = $data['max_value'] ?? null;

        if (in_array($operator, ['below', 'between', 'outside'], true) && $min === null) {
            $validator->errors()->add('min_value', "Minimum is required when the operator is {$operator}.");
        }
        if (in_array($operator, ['above', 'between', 'outside'], true) && $max === null) {
            $validator->errors()->add('max_value', "Maximum is required when the operator is {$operator}.");
        }
        if (in_array($operator, ['between', 'outside'], true) && $min !== null && $max !== null && (float) $min >= (float) $max) {
            $validator->errors()->add('max_value', 'Maximum must be greater than minimum for this condition.');
        }
        if ($validator->errors()->isNotEmpty()) {
            return;
        }

        $query = $model::query()
            ->where($ownerKey, $data[$ownerKey])
            ->where('factor', $data['factor']);
        if ($model === PestConditionRule::class) {
            empty($data['plant_id']) ? $query->whereNull('plant_id') : $query->where('plant_id', $data['plant_id']);
        }
        $this->ignoreRecord($query, $recordId);

        foreach ($query->get() as $existing) {
            $exactDuplicate = $existing->operator === $operator
                && $this->sameNumber($existing->min_value, $min)
                && $this->sameNumber($existing->max_value, $max);
            if ($exactDuplicate) {
                $validator->errors()->add('factor', "Duplicate condition: record #{$existing->id} already uses the same factor, operator, and thresholds in this group.");
                return;
            }

            if (($data['is_active'] ?? true) && $existing->is_active && $this->conditionsOverlap($operator, $min, $max, $existing->operator, $existing->min_value, $existing->max_value)) {
                $validator->errors()->add('factor', "Conflicting condition: this active range overlaps record #{$existing->id} in the same group. Disable one rule or use non-overlapping thresholds.");
                return;
            }
        }
    }

    /** @param array<string, mixed> $data */
    private function validateEvent(array $data, ?int $recordId, Validator $validator): void
    {
        $this->validateUniqueText(EventDefinition::query(), 'name_en', $data['name_en'] ?? null, $recordId, $validator, 'name_en', 'An event with this English name already exists.');
        $this->validateUniqueText(EventDefinition::query(), 'name_th', $data['name_th'] ?? null, $recordId, $validator, 'name_th', 'An event with this Thai name already exists.');

        $seen = [];
        foreach ($data['conditions'] ?? [] as $index => $condition) {
            $factor = $condition['factor'] ?? null;
            $operator = $condition['operator'] ?? null;
            if (! $factor) {
                $validator->errors()->add("conditions.{$index}.factor", 'Every event condition must select an environmental factor.');
            }
            if (! $operator) {
                $validator->errors()->add("conditions.{$index}.operator", 'Every event condition must select an operator.');
            }
            if (! $factor || ! $operator) {
                continue;
            }
            $signature = json_encode([$factor, $operator, $condition['value'] ?? null, $condition['min'] ?? null, $condition['max'] ?? null]);
            if (isset($seen[$signature])) {
                $validator->errors()->add("conditions.{$index}", 'This event contains the same environmental condition more than once.');
            }
            $seen[$signature] = true;
            if (in_array($operator, ['between', 'outside'], true)) {
                if (! isset($condition['min'], $condition['max'])) {
                    $validator->errors()->add("conditions.{$index}", 'Between and outside conditions require both minimum and maximum.');
                } elseif ((float) $condition['min'] >= (float) $condition['max']) {
                    $validator->errors()->add("conditions.{$index}.max", 'Condition maximum must be greater than minimum.');
                }
            } elseif (! array_key_exists('value', $condition) || $condition['value'] === null || $condition['value'] === '') {
                $validator->errors()->add("conditions.{$index}.value", 'This condition requires a comparison value.');
            }
        }
        $this->validateDistinctList($data['response_action_keys'] ?? [], 'response_action_keys', $validator);
    }

    /** @param array<string, mixed> $data */
    private function validateQuest(array $data, ?int $recordId, Validator $validator): void
    {
        $this->validateUniqueText(Quest::query(), 'title', $data['title'] ?? null, $recordId, $validator, 'title', 'A quest with this title already exists.');
        $query = Quest::query()->where('quest_type', $data['quest_type'])->where('target_type', $data['target_type'])->where('target_value', $data['target_value']);
        $this->ignoreRecord($query, $recordId);
        if ($query->exists()) {
            $validator->errors()->add('target_type', 'Another quest already has the same quest type, target, and target value.');
        }
    }

    /** @param array<string, mixed> $data */
    private function validateAchievement(array $data, ?int $recordId, Validator $validator): void
    {
        $this->validateUniqueText(Achievement::query(), 'title', $data['title'] ?? null, $recordId, $validator, 'title', 'An achievement with this title already exists.');
        $query = Achievement::query()->where('condition_type', $data['condition_type'])->where('condition_value', $data['condition_value']);
        $this->ignoreRecord($query, $recordId);
        if ($query->exists()) {
            $validator->errors()->add('condition_type', 'Another achievement already uses the same condition and target value.');
        }
    }

    /** @param array<string, mixed> $data @param array<int, string> $listFields */
    private function validateReferenceLists(array $data, Validator $validator, array $listFields): void
    {
        foreach ($listFields as $field) {
            $this->validateDistinctList($data[$field] ?? [], $field, $validator);
        }
        $urls = array_column($data['sources'] ?? [], 'url');
        $this->validateDistinctList($urls, 'sources', $validator, 'The same reference URL is listed more than once.');
    }

    /** @param array<string, mixed> $data @param array<int, string> $listFields */
    private function validateKnowledge(Builder $query, string $ownerKey, array $data, ?int $recordId, Validator $validator, array $listFields): void
    {
        $this->validateUniqueValue($query, $ownerKey, $data[$ownerKey] ?? null, $recordId, $validator, $ownerKey, 'This record already has a knowledge guide. Edit the existing guide instead.');
        $this->validateReferenceLists($data, $validator, $listFields);
    }

    /** @param array<string, mixed> $data */
    private function validateOrderedRange(array $data, string $minKey, string $maxKey, Validator $validator, string $label): void
    {
        if (isset($data[$minKey], $data[$maxKey]) && (float) $data[$minKey] >= (float) $data[$maxKey]) {
            $validator->errors()->add($maxKey, "{$label} maximum must be greater than its minimum.");
        }
    }

    private function validateUniqueText(Builder $query, string $column, mixed $value, ?int $recordId, Validator $validator, string $field, string $message): void
    {
        $normalized = mb_strtolower(trim((string) $value));
        if ($normalized === '') {
            return;
        }
        $query->whereRaw("LOWER(TRIM({$column})) = ?", [$normalized]);
        $this->ignoreRecord($query, $recordId);
        if ($query->exists()) {
            $validator->errors()->add($field, $message);
        }
    }

    private function validateUniqueValue(Builder $query, string $column, mixed $value, ?int $recordId, Validator $validator, string $field, string $message): void
    {
        if ($value === null || $value === '') {
            return;
        }
        $query->where($column, $value);
        $this->ignoreRecord($query, $recordId);
        if ($query->exists()) {
            $validator->errors()->add($field, $message);
        }
    }

    /** @param array<int, mixed> $values */
    private function validateDistinctList(array $values, string $field, Validator $validator, string $message = 'This list contains duplicate entries.'): void
    {
        $normalized = array_values(array_filter(array_map(fn ($value) => mb_strtolower(trim((string) $value)), $values)));
        if (count($normalized) !== count(array_unique($normalized))) {
            $validator->errors()->add($field, $message);
        }
    }

    private function ignoreRecord(Builder $query, ?int $recordId): void
    {
        if ($recordId !== null) {
            $query->whereKeyNot($recordId);
        }
    }

    private function sameNumber(mixed $first, mixed $second): bool
    {
        if ($first === null || $second === null) {
            return $first === null && $second === null;
        }
        return abs((float) $first - (float) $second) < 0.000001;
    }

    private function conditionsOverlap(string $firstOperator, mixed $firstMin, mixed $firstMax, string $secondOperator, mixed $secondMin, mixed $secondMax): bool
    {
        foreach ($this->segments($firstOperator, $firstMin, $firstMax) as $first) {
            foreach ($this->segments($secondOperator, $secondMin, $secondMax) as $second) {
                $point = max($first[0], $second[0]);
                $end = min($first[1], $second[1]);
                if ($point < $end || ($point === $end && $this->contains($first, $point) && $this->contains($second, $point))) {
                    return true;
                }
            }
        }
        return false;
    }

    /** @return array<int, array{0: float, 1: float, 2: bool, 3: bool}> */
    private function segments(string $operator, mixed $min, mixed $max): array
    {
        return match ($operator) {
            'below' => [[-INF, (float) $min, false, false]],
            'above' => [[(float) $max, INF, false, false]],
            'between' => [[(float) $min, (float) $max, true, true]],
            'outside' => [[-INF, (float) $min, false, false], [(float) $max, INF, false, false]],
            default => [],
        };
    }

    /** @param array{0: float, 1: float, 2: bool, 3: bool} $segment */
    private function contains(array $segment, float $value): bool
    {
        return ($value > $segment[0] || ($segment[2] && $value === $segment[0]))
            && ($value < $segment[1] || ($segment[3] && $value === $segment[1]));
    }
}
