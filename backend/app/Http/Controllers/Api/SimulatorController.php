<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\SimulatorResource;
use App\Models\ItemUsage;
use App\Models\Plant;
use App\Models\SimulationLog;
use App\Models\Simulator;
use App\Models\UserItem;
use App\Services\PlantSimulationEngine;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class SimulatorController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        return SimulatorResource::collection(
            Simulator::query()
                ->with(['plant.stages', 'currentStage', 'visualVariant', 'activePests.pest.conditionRules'])
                ->where('user_id', $request->user()->id)
                ->latest()
                ->get()
        );
    }

    public function latest(Request $request)
    {
        $simulator = Simulator::query()
            ->with(['plant.stages', 'currentStage', 'visualVariant', 'activePests.pest.conditionRules'])
            ->where('user_id', $request->user()->id)
            ->where('status', 'active')
            ->latest('updated_at')
            ->latest('id')
            ->first();

        if (! $simulator) {
            return response()->json(['data' => null]);
        }

        return new SimulatorResource($simulator);
    }
    public function store(Request $request): SimulatorResource
    {
        $data = $request->validate([
            'plant_id' => ['required', 'exists:plants,id'],
            'mode' => ['required', Rule::in(['outdoor', 'greenhouse'])],
            'location_name' => ['nullable', 'string', 'max:191'],
            'latitude' => ['nullable', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'numeric', 'between:-180,180'],
            'season' => ['nullable', Rule::in(['summer', 'rainy', 'winter'])],
        ]);

        $plant = Plant::query()->with('stages')->findOrFail($data['plant_id']);
        $firstStage = $plant->stages->first();

        $simulator = Simulator::query()->create([
            ...$data,
            'user_id' => $request->user()->id,
            'current_stage_id' => $firstStage?->id,
            'health' => 100,
            'visual_state' => 'healthy',
            'visual_overrides' => ['leafColor' => '#9bcf82', 'stemColor' => '#7a5a2f', 'scale' => 1],
            'status' => 'active',
            'started_at' => now(),
        ]);

        return new SimulatorResource($simulator->load(['plant.stages', 'currentStage', 'visualVariant', 'activePests.pest.conditionRules']));
    }

    public function show(Request $request, Simulator $simulator): SimulatorResource
    {
        abort_unless($simulator->user_id === $request->user()->id, 403);

        return new SimulatorResource($simulator->load(['plant.stages', 'currentStage', 'visualVariant', 'activePests.pest.conditionRules']));
    }

    public function tick(Request $request, Simulator $simulator, PlantSimulationEngine $engine): SimulatorResource
    {
        abort_unless($simulator->user_id === $request->user()->id, 403);

        $factors = $request->validate([
            'water' => ['required', 'integer', 'min:0', 'max:100'],
            'light' => ['required', 'integer', 'min:0', 'max:100'],
            'fertilizer' => ['required', 'integer', 'min:0', 'max:100'],
            'soil_humidity' => ['required', 'integer', 'min:0', 'max:100'],
            'air_humidity' => ['required', 'integer', 'min:0', 'max:100'],
            'soil_temp' => ['required', 'numeric', 'min:-20', 'max:80'],
            'air_temp' => ['required', 'numeric', 'min:-20', 'max:80'],
            'rain' => ['nullable', 'numeric', 'min:0', 'max:500'],
        ]);

        return new SimulatorResource($engine->tick($simulator, $factors));
    }

    public function sync(Request $request, Simulator $simulator): SimulatorResource
    {
        abort_unless($simulator->user_id === $request->user()->id, 403);

        $data = $request->validate([
            'growth_point' => ['required', 'numeric', 'min:0'],
            'health' => ['required', 'integer', 'min:0', 'max:100'],
            'water' => ['required', 'integer', 'min:0', 'max:100'],
            'light' => ['required', 'integer', 'min:0', 'max:100'],
            'fertilizer' => ['required', 'integer', 'min:0', 'max:100'],
            'soil_humidity' => ['required', 'integer', 'min:0', 'max:100'],
            'air_humidity' => ['required', 'integer', 'min:0', 'max:100'],
            'soil_temp' => ['required', 'numeric', 'min:-20', 'max:80'],
            'air_temp' => ['required', 'numeric', 'min:-20', 'max:80'],
            'visual_state' => ['nullable', 'string', 'max:80'],
            'visual_overrides' => ['nullable', 'array'],
            'analysis_result' => ['nullable', 'string'],
            'direction' => ['nullable', 'string'],
        ]);

        $growthPoint = (int) round((float) $data['growth_point']);
        $stage = $simulator->plant
            ->stages()
            ->where('required_growth_point', '<=', $growthPoint)
            ->orderByDesc('required_growth_point')
            ->first();

        $state = [
            'growth_point' => $growthPoint,
            'current_stage_id' => $stage?->id ?? $simulator->current_stage_id,
            'health' => $data['health'],
            'visual_state' => $data['visual_state'] ?? $simulator->visual_state ?? 'healthy',
            'visual_overrides' => $data['visual_overrides'] ?? $simulator->visual_overrides ?? [],
            'water' => $data['water'],
            'light' => $data['light'],
            'fertilizer' => $data['fertilizer'],
            'soil_humidity' => $data['soil_humidity'],
            'air_humidity' => $data['air_humidity'],
            'soil_temp' => $data['soil_temp'],
            'air_temp' => $data['air_temp'],
            'status' => 'active',
        ];

        DB::transaction(function () use ($data, $simulator, $state): void {
            $simulator->update($state);

            SimulationLog::query()->create($state + [
                'simulator_id' => $simulator->id,
                'day_no' => ((int) $simulator->logs()->max('day_no')) + 1,
                'score' => max(0, (int) $state['growth_point'] + (int) $state['health']),
                'analysis_result' => $data['analysis_result'] ?? 'Current simulation state saved.',
                'direction' => $data['direction'] ?? 'Continue from the latest saved state.',
            ]);
        });

        return new SimulatorResource($simulator->fresh(['plant.stages', 'currentStage', 'visualVariant', 'activePests.pest.conditionRules']));
    }
    public function storeLog(Request $request, Simulator $simulator): SimulatorResource
    {
        abort_unless($simulator->user_id === $request->user()->id, 403);

        $data = $request->validate([
            'day_no' => ['required', 'integer', 'min:1'],
            'growth_point' => ['required', 'integer', 'min:0'],
            'health' => ['required', 'integer', 'min:0', 'max:100'],
            'water' => ['required', 'integer', 'min:0'],
            'light' => ['required', 'integer', 'min:0'],
            'fertilizer' => ['required', 'integer', 'min:0'],
            'soil_humidity' => ['required', 'integer', 'min:0'],
            'air_humidity' => ['required', 'integer', 'min:0'],
            'soil_temp' => ['required', 'numeric'],
            'air_temp' => ['required', 'numeric'],
            'score' => ['nullable', 'integer', 'min:0'],
            'analysis_result' => ['nullable', 'string'],
            'direction' => ['nullable', 'string'],
        ]);

        DB::transaction(function () use ($data, $simulator): void {
            SimulationLog::query()->updateOrCreate(
                ['simulator_id' => $simulator->id, 'day_no' => $data['day_no']],
                $data + ['simulator_id' => $simulator->id, 'score' => $data['score'] ?? 0]
            );

            $stage = $simulator->plant
                ->stages()
                ->where('required_growth_point', '<=', $data['growth_point'])
                ->orderByDesc('required_growth_point')
                ->first();

            $simulator->update([
                'growth_point' => $data['growth_point'],
                'current_stage_id' => $stage?->id ?? $simulator->current_stage_id,
                'health' => $data['health'],
                'water' => $data['water'],
                'light' => $data['light'],
                'fertilizer' => $data['fertilizer'],
                'soil_humidity' => $data['soil_humidity'],
                'air_humidity' => $data['air_humidity'],
                'soil_temp' => $data['soil_temp'],
                'air_temp' => $data['air_temp'],
            ]);
        });

        return new SimulatorResource($simulator->fresh(['plant.stages', 'currentStage', 'visualVariant', 'activePests.pest.conditionRules']));
    }

    public function useItem(Request $request, Simulator $simulator): JsonResponse
    {
        abort_unless($simulator->user_id === $request->user()->id, 403);

        $data = $request->validate([
            'item_id' => ['required', 'exists:items,id'],
            'quantity' => ['nullable', 'integer', 'min:1'],
        ]);

        $quantity = $data['quantity'] ?? 1;

        $userItem = UserItem::query()
            ->where('user_id', $request->user()->id)
            ->where('item_id', $data['item_id'])
            ->firstOrFail();

        abort_if($userItem->quantity < $quantity, 422, 'Not enough item quantity.');

        $usage = DB::transaction(function () use ($data, $quantity, $request, $simulator, $userItem) {
            $userItem->decrement('quantity', $quantity);

            return ItemUsage::query()->create([
                'user_id' => $request->user()->id,
                'item_id' => $data['item_id'],
                'simulator_id' => $simulator->id,
                'quantity' => $quantity,
                'effect_result' => 'Item used successfully.',
            ]);
        });

        return response()->json(['data' => $usage], 201);
    }
}

