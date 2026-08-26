<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\SimulatorResource;
use App\Models\Simulator;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class SimulatorLocationController extends Controller
{
    public function update(Request $request, Simulator $simulator): SimulatorResource
    {
        abort_unless((int) $simulator->user_id === (int) $request->user()->id, 403);
        abort_unless($simulator->hasAvailablePlant(), 423, 'This plant species is currently under maintenance.');
        $data = $request->validate([
            'location_name' => ['required', 'string', 'max:191'],
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
            'timezone' => ['nullable', 'string', 'max:80'],
        ]);

        $updated = DB::transaction(function () use ($simulator, $data): Simulator {
            $locked = Simulator::query()->whereKey($simulator->id)->lockForUpdate()->firstOrFail();
            abort_unless($locked->status === 'active', 409, 'Only active simulations can change location.');
            abort_unless($locked->mode === 'outdoor', 409, 'Only outdoor simulations have a transferable growing location.');
            $locked->forceFill([
                'location_name' => $data['location_name'], 'latitude' => $data['latitude'],
                'longitude' => $data['longitude'], 'location_timezone' => $data['timezone'] ?? null,
                'location_changed_at' => now(), 'state_version' => ((int) $locked->state_version) + 1,
            ])->save();
            return $locked;
        });

        return new SimulatorResource($updated->fresh(['plant.stages', 'currentStage', 'visualVariant', 'activePests.pest.conditionRules', 'simulationEvents.definition']));
    }
}
