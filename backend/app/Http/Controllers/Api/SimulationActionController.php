<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\SimulatorResource;
use App\Models\Simulator;
use App\Services\SimulationActionService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SimulationActionController extends Controller
{
    public function store(Request $request, Simulator $simulator, SimulationActionService $service): JsonResponse
    {
        abort_unless((int) $simulator->user_id === (int) $request->user()->id, 403);
        $data = $request->validate([
            'client_action_id' => ['required', 'uuid'],
            'action_key' => ['required', 'string', 'max:100'],
            'item_id' => ['nullable', 'integer', 'exists:items,id'],
            'target_value' => ['nullable', 'numeric', 'between:-1000,1000'],
            'event_id' => ['nullable', 'integer', 'exists:simulation_events,id'],
        ]);
        $result = $service->apply($simulator, (int) $request->user()->id, $data);
        $fresh = $result['simulator']->fresh([
            'plant.stages',
            'currentStage',
            'visualVariant',
            'activePests.pest.conditionRules',
            'simulationEvents.definition',
            'modifiers.action',
        ]);
        $result['simulator'] = (new SimulatorResource($fresh))->resolve($request);

        return response()->json(['data' => $result], $result['replayed'] ? 200 : 201);
    }
}
