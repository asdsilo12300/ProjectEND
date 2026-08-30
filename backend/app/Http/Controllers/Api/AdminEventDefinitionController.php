<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AdminActivityLog;
use App\Models\EventDefinition;
use App\Support\LocalizedFieldLanguageValidator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AdminEventDefinitionController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $query = EventDefinition::query()->withTrashed()->orderBy('id');
        if ($request->filled('search')) {
            $term = '%'.trim((string) $request->query('search')).'%';
            $query->where(fn ($q) => $q->whereLike('name_en', $term, false)->orWhereLike('name_th', $term, false)->orWhereLike('event_key', $term, false));
        }
        return response()->json($query->paginate(25));
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate($this->rules());
        LocalizedFieldLanguageValidator::validateOrFail($data);
        $event = EventDefinition::query()->create($data);
        AdminActivityLog::record($request->user(), 'created', 'event-definitions', $event->id, ['after' => $event->toArray()]);
        return response()->json(['data' => $event], 201);
    }

    public function update(Request $request, EventDefinition $eventDefinition): JsonResponse
    {
        $before = $eventDefinition->toArray();
        $data = $request->validate($this->rules($eventDefinition->id));
        LocalizedFieldLanguageValidator::validateOrFail($data);
        $eventDefinition->fill($data)->save();
        AdminActivityLog::record($request->user(), 'updated', 'event-definitions', $eventDefinition->id, ['before' => $before, 'after' => $eventDefinition->fresh()->toArray()]);
        return response()->json(['data' => $eventDefinition->fresh()]);
    }

    public function destroy(Request $request, EventDefinition $eventDefinition): JsonResponse
    {
        $eventDefinition->delete();
        AdminActivityLog::record($request->user(), 'soft_deleted', 'event-definitions', $eventDefinition->id);
        return response()->json(['message' => 'Event moved to trash.']);
    }

    public function restore(Request $request, int $eventDefinition): JsonResponse
    {
        $event = EventDefinition::onlyTrashed()->findOrFail($eventDefinition);
        $event->restore();
        AdminActivityLog::record($request->user(), 'restored', 'event-definitions', $event->id);
        return response()->json(['data' => $event->fresh()]);
    }

    private function rules(?int $id = null): array
    {
        return [
            'event_key' => ['required', 'string', 'max:120', Rule::unique('event_definitions', 'event_key')->ignore($id)],
            'name_en' => ['required', 'string', 'max:191'], 'name_th' => ['required', 'string', 'max:191'],
            'description_en' => ['nullable', 'string', 'max:4000'], 'description_th' => ['nullable', 'string', 'max:4000'],
            'mode_scope' => ['required', Rule::in(['both', 'greenhouse', 'outdoor', 'seasonal'])],
            'severity' => ['required', Rule::in(['low', 'medium', 'high'])],
            'weight' => ['required', 'integer', 'between:1,100'], 'trigger_chance' => ['required', 'integer', 'between:0,100'],
            'warning_ticks' => ['required', 'integer', 'between:0,20'], 'duration_ticks' => ['required', 'integer', 'between:1,50'],
            'cooldown_ticks' => ['required', 'integer', 'between:1,100'],
            'conditions' => ['nullable', 'array'], 'effects' => ['nullable', 'array'], 'response_action_keys' => ['nullable', 'array'],
            'conditions.*.factor' => ['nullable', 'string', Rule::in(['water', 'light', 'fertilizer', 'soil_humidity', 'air_humidity', 'soil_temp', 'air_temp'])],
            'conditions.*.operator' => ['nullable', 'string', Rule::in(['above', 'above_or_equal', 'below', 'below_or_equal', 'between', 'outside', 'equals', '='])],
            'conditions.*.value' => ['nullable', 'numeric'], 'conditions.*.min' => ['nullable', 'numeric'], 'conditions.*.max' => ['nullable', 'numeric'],
            'effects.factor_delta' => ['nullable', 'array'],
            'effects.factor_delta.*' => ['numeric', 'between:-100,100'],
            'response_action_keys.*' => ['string', 'max:100'], 'is_harmful' => ['required', 'boolean'], 'is_active' => ['required', 'boolean'],
        ];
    }
}
