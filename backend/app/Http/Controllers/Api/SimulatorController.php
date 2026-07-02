<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\SimulatorResource;
use App\Models\Friendship;
use App\Models\Item;
use App\Models\ItemUsage;
use App\Models\Plant;
use App\Models\SimulationLog;
use App\Models\SimulationPest;
use App\Models\Simulator;
use App\Models\SimulatorComment;
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
    public function claimMaturityReward(Request $request, Simulator $simulator): JsonResponse
    {
        abort_unless($simulator->user_id === $request->user()->id, 403);

        $result = DB::transaction(function () use ($request, $simulator): array {
            $lockedSimulator = Simulator::query()
                ->whereKey($simulator->id)
                ->lockForUpdate()
                ->firstOrFail();

            $user = $request->user()->refresh();
            $currentCoin = (int) ($user->coin ?? 0);

            if ((float) $lockedSimulator->growth_point < 100) {
                return [
                    'awarded' => false,
                    'amount' => 0,
                    'balance' => $currentCoin,
                    'reason' => 'Plant is not fully grown yet.',
                    'simulator' => (new SimulatorResource($lockedSimulator->fresh(['plant.stages', 'currentStage', 'visualVariant', 'activePests.pest.conditionRules'])))->resolve($request),
                ];
            }

            if ($lockedSimulator->maturity_reward_claimed_at) {
                return [
                    'awarded' => false,
                    'amount' => 0,
                    'balance' => $currentCoin,
                    'reason' => 'Maturity reward already claimed.',
                    'simulator' => (new SimulatorResource($lockedSimulator->fresh(['plant.stages', 'currentStage', 'visualVariant', 'activePests.pest.conditionRules'])))->resolve($request),
                ];
            }

            $amount = 100;
            $user->forceFill(['coin' => $currentCoin + $amount])->save();
            $lockedSimulator->forceFill([
                'maturity_reward_claimed_at' => now(),
                'maturity_reward_amount' => $amount,
            ])->save();

            return [
                'awarded' => true,
                'amount' => $amount,
                'balance' => (int) $user->coin,
                'simulator' => (new SimulatorResource($lockedSimulator->fresh(['plant.stages', 'currentStage', 'visualVariant', 'activePests.pest.conditionRules'])))->resolve($request),
            ];
        });

        return response()->json(['data' => $result]);
    }
    public function finish(Request $request, Simulator $simulator): JsonResponse
    {
        abort_unless($simulator->user_id === $request->user()->id, 403);

        $simulator->update([
            'status' => 'ended',
            'ended_at' => now(),
        ]);

        return response()->json(['data' => ['id' => $simulator->id, 'status' => 'ended']]);
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
            'item_id' => ['nullable', 'integer', 'exists:items,id'],
            'item_key' => ['nullable', 'string', 'max:120'],
            'quantity' => ['nullable', 'integer', 'min:1'],
        ]);

        abort_if(empty($data['item_id']) && empty($data['item_key']), 422, 'Please choose an item.');

        $quantity = $data['quantity'] ?? 1;
        $itemAliases = [
            'hand-pick' => 'Hand Pick',
            'insecticide-spray' => 'Insect Spray',
            'antifungal-spray' => 'Fungus Spray',
            'snail-trap' => 'Snail Trap',
        ];

        $item = Item::query()
            ->where('is_active', true)
            ->when(! empty($data['item_id']), fn ($query) => $query->where('id', $data['item_id']))
            ->when(empty($data['item_id']), function ($query) use ($data, $itemAliases) {
                $name = $itemAliases[$data['item_key']] ?? $data['item_key'];
                $query->where('name', $name);
            })
            ->firstOrFail();

        $userItem = UserItem::query()->firstOrCreate(
            ['user_id' => $request->user()->id, 'item_id' => $item->id],
            ['quantity' => str_starts_with((string) $item->effect_type, 'pest_control') ? 5 : 0],
        );

        abort_if($userItem->quantity < $quantity, 422, 'Not enough item quantity.');

        $result = DB::transaction(function () use ($item, $quantity, $request, $simulator, $userItem) {
            $effectType = strtolower((string) $item->effect_type);
            $targetText = str_contains($effectType, ':') ? explode(':', $effectType, 2)[1] : '';
            $targets = collect(explode(',', $targetText))
                ->map(fn ($target) => trim($target))
                ->filter()
                ->values();

            $removedPests = collect();

            if (str_starts_with(strtolower((string) $item->effect_type), 'pest_control') && $targets->isNotEmpty()) {
                $removedPests = SimulationPest::query()
                    ->with('pest')
                    ->where('simulator_id', $simulator->id)
                    ->where('status', 'active')
                    ->whereHas('pest', fn ($query) => $query->whereIn(DB::raw('LOWER(name_en)'), $targets->all()))
                    ->get();

                SimulationPest::query()
                    ->whereIn('id', $removedPests->pluck('id'))
                    ->update([
                        'status' => 'treated',
                        'treated_at' => now(),
                    ]);
            }

            $userItem->decrement('quantity', $quantity);

            $targetNames = $targets->implode(', ');
            $removedNames = $removedPests->map(fn (SimulationPest $pest) => $pest->pest?->name_en)->filter()->values();
            $message = $removedNames->isNotEmpty()
                ? $item->name . ' removed ' . $removedNames->implode(', ') . '.'
                : ($targetNames ? $item->name . ' is ready for ' . $targetNames . ', but no active pest was found.' : $item->name . ' used successfully.');

            $usage = ItemUsage::query()->create([
                'user_id' => $request->user()->id,
                'item_id' => $item->id,
                'simulator_id' => $simulator->id,
                'quantity' => $quantity,
                'effect_result' => $message,
            ]);

            return [
                'usage' => $usage,
                'message' => $message,
                'targets' => $targets,
                'removed_pests' => $removedNames,
            ];
        });

        $freshSimulator = $simulator->fresh(['plant.stages', 'currentStage', 'visualVariant', 'activePests.pest.conditionRules']);

        return response()->json([
            'data' => [
                ...$result,
                'simulator' => new SimulatorResource($freshSimulator),
            ],
        ], 201);
    }
    public function comments(Request $request, Simulator $simulator): JsonResponse
    {
        $this->authorizeSimulatorConversation($request, $simulator);

        $comments = SimulatorComment::query()
            ->with('user')
            ->where('simulator_id', $simulator->id)
            ->where('status', 'visible')
            ->oldest()
            ->get()
            ->map(fn (SimulatorComment $comment) => $this->commentPayload($comment))
            ->values();

        return response()->json(['data' => $comments]);
    }

    public function storeComment(Request $request, Simulator $simulator): JsonResponse
    {
        $this->authorizeSimulatorConversation($request, $simulator);

        $data = $request->validate([
            'comment_text' => ['required', 'string', 'max:1000'],
        ]);

        $comment = SimulatorComment::query()->create([
            'simulator_id' => $simulator->id,
            'user_id' => $request->user()->id,
            'comment_text' => trim($data['comment_text']),
            'status' => 'visible',
        ]);

        return response()->json(['data' => $this->commentPayload($comment->load('user'))], 201);
    }

    private function authorizeSimulatorConversation(Request $request, Simulator $simulator): void
    {
        $userId = $request->user()->id;

        if ($simulator->user_id === $userId) {
            return;
        }

        $isAcceptedFriend = Friendship::query()
            ->where('status', 'accepted')
            ->where(function ($query) use ($userId, $simulator): void {
                $query
                    ->where(function ($inner) use ($userId, $simulator): void {
                        $inner->where('requester_id', $userId)->where('addressee_id', $simulator->user_id);
                    })
                    ->orWhere(function ($inner) use ($userId, $simulator): void {
                        $inner->where('requester_id', $simulator->user_id)->where('addressee_id', $userId);
                    });
            })
            ->exists();

        abort_unless($isAcceptedFriend, 403);
    }

    private function commentPayload(SimulatorComment $comment): array
    {
        return [
            'id' => $comment->id,
            'simulator_id' => $comment->simulator_id,
            'comment_text' => $comment->comment_text,
            'created_at' => $comment->created_at?->toISOString(),
            'user' => [
                'id' => $comment->user?->id,
                'username' => $comment->user?->username,
                'email' => $comment->user?->email,
                'avatar_url' => $comment->user?->avatar_url,
                'role' => $comment->user?->role,
            ],
        ];
    }
}


