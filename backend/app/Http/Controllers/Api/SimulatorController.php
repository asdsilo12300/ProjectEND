<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\SimulatorResource;
use App\Models\Friendship;
use App\Models\Item;
use App\Models\ItemUsage;
use App\Models\Pest;
use App\Models\Plant;
use App\Models\Post;
use App\Models\SimulationLog;
use App\Models\SimulationPest;
use App\Models\Simulator;
use App\Models\SimulatorComment;
use App\Models\SocialNotification;
use App\Models\UserItem;
use App\Services\MediaStorage;
use App\Services\PlantSimulationEngine;
use App\Services\SimulationActivityTracker;
use App\Services\SimulationEventService;
use App\Services\SimulationModeRewardService;
use App\Services\SeasonalWeatherService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class SimulatorController extends Controller
{
    public function __construct(
        private readonly MediaStorage $media,
        private readonly SimulationActivityTracker $activity,
    ) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $data = $request->validate([
            'status' => ['nullable', Rule::in(['active', 'completed', 'failed', 'cancelled'])],
        ]);

        return SimulatorResource::collection(
            Simulator::query()
                ->with($this->simulatorRelations())
                ->where('user_id', $request->user()->id)
                ->when($data['status'] ?? null, fn ($query, $status) => $query->where('status', $status))
                ->latest()
                ->get()
        );
    }

    public function latest(Request $request)
    {
        $simulator = Simulator::query()
            ->with($this->simulatorRelations())
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
            'plant_id' => ['required', Rule::exists('plants', 'id')->whereNull('deleted_at')],
            'mode' => ['required', Rule::in(['outdoor', 'greenhouse', 'seasonal'])],
            'location_name' => ['nullable', 'string', 'max:191'],
            'latitude' => ['nullable', 'required_if:mode,seasonal', 'numeric', 'between:-90,90'],
            'longitude' => ['nullable', 'required_if:mode,seasonal', 'numeric', 'between:-180,180'],
            'location_timezone' => ['nullable', 'string', 'max:80'],
            'season' => ['nullable', Rule::in(['summer', 'rainy', 'winter'])],
            'start_month' => ['nullable', 'required_if:mode,seasonal', 'integer', 'between:1,12'],
        ]);

        if (! app(SimulationModeRewardService::class)->isModeActive($data['mode'])) {
            throw ValidationException::withMessages([
                'mode' => 'This simulation mode is currently disabled by an administrator.',
            ]);
        }

        $plant = Plant::query()->playable()->with('stages')->find($data['plant_id']);
        if (! $plant) {
            throw ValidationException::withMessages([
                'plant_id' => 'This plant is not ready for simulation. Configure a base model and growth stages from 0 to 100 first.',
            ]);
        }
        $firstStage = $plant->stages->first();
        $initialEnvironment = $this->initialEnvironmentFor($plant);

        $simulator = DB::transaction(function () use ($data, $firstStage, $initialEnvironment, $request): Simulator {
            $activeSimulators = Simulator::query()
                ->where('user_id', $request->user()->id)
                ->where('plant_id', $data['plant_id'])
                ->where('status', 'active')
                ->latest('updated_at')
                ->latest('id')
                ->lockForUpdate()
                ->get();

            $existing = $activeSimulators->first();
            if ($existing) {
                $duplicateIds = $activeSimulators->skip(1)->pluck('id');
                if ($duplicateIds->isNotEmpty()) {
                    Simulator::query()->whereKey($duplicateIds->all())->update([
                        'status' => 'cancelled',
                        'share_visibility' => 'private',
                        'ended_at' => now(),
                    ]);
                }

                return $existing;
            }

            return Simulator::query()->create([
                ...$data,
                'user_id' => $request->user()->id,
                'current_stage_id' => $firstStage?->id,
                'health' => 100,
                'visual_state' => 'healthy',
                'visual_overrides' => ['leafColor' => '#9bcf82', 'stemColor' => '#7a5a2f', 'scale' => 1],
                'status' => 'active',
                'active_seconds' => 0,
                'last_active_at' => now(),
                'started_at' => now(),
                ...$initialEnvironment,
            ]);
        });

        if ($simulator->mode === 'seasonal') {
            if ($simulator->latitude === null || $simulator->longitude === null) {
                throw ValidationException::withMessages([
                    'location' => 'Seasonal Journey requires a saved latitude and longitude.',
                ]);
            }
            $simulator = app(SeasonalWeatherService::class)->ensureTimeline($simulator);
        }

        if (
            in_array($simulator->mode, ['outdoor', 'seasonal'], true)
            && Schema::hasColumn('simulators', 'starter_pack_granted_at')
            && ! $simulator->starter_pack_granted_at
        ) {
            $this->grantOutdoorStarterPack($simulator, (int) $request->user()->id);
        }

        return new SimulatorResource($simulator->load($this->simulatorRelations()));
    }

    public function show(Request $request, Simulator $simulator): SimulatorResource
    {
        abort_unless($simulator->user_id === $request->user()->id, 403);

        return new SimulatorResource($simulator->load($this->simulatorRelations()));
    }

    public function tick(
        Request $request,
        Simulator $simulator,
        PlantSimulationEngine $engine,
        SimulationEventService $events,
        SeasonalWeatherService $seasonalWeather,
    ): SimulatorResource
    {
        abort_unless($simulator->user_id === $request->user()->id, 403);
        $this->ensurePlantAvailable($simulator);

        $factors = $request->validate([
            'water' => ['required', 'integer', 'min:0', 'max:100'],
            'light' => ['required', 'integer', 'min:0', 'max:100'],
            'fertilizer' => ['required', 'integer', 'min:0', 'max:100'],
            'soil_humidity' => ['required', 'integer', 'min:0', 'max:100'],
            'air_humidity' => ['required', 'integer', 'min:0', 'max:100'],
            'soil_temp' => ['required', 'numeric', 'min:-20', 'max:80'],
            'air_temp' => ['required', 'numeric', 'min:-20', 'max:80'],
            'rain' => ['nullable', 'numeric', 'min:0', 'max:500'],
            'wind_speed' => ['nullable', 'numeric', 'min:0', 'max:300'],
            'root_temperature_controlled' => ['nullable', 'boolean'],
        ]);

        if ($simulator->mode === 'seasonal') {
            // The browser may preview the timeline, but the persisted owner
            // timeline remains authoritative for seasonal factors and friend views.
            $factors = [...$factors, ...$seasonalWeather->factorsForCurrentDay($simulator)];
        }

        // Water and nutrients are consumable plant reserves. They are owned by
        // the server so a stale browser slider/snapshot cannot refill them on
        // every cycle. Weather and scheduled events may still modify the
        // authoritative values after this point.
        $factors['water'] = (int) $simulator->water;
        $factors['fertilizer'] = (int) $simulator->fertilizer;

        $eventState = $events->advance($simulator, $factors);
        // PlantSimulationEngine acquires and reloads the locked Simulator
        // itself, so refreshing it here only added another network round trip.
        $updated = $engine->tick($simulator, $eventState['factors'], $eventState['resource_deltas']);
        if ($updated->mode === 'seasonal') {
            $updated = $seasonalWeather->synchronizeWithContext($updated);
        }
        // Reuse relations already queried by the event scheduler instead of
        // fetching them again while serializing the tick response.
        $updated->setRelation('simulationEvents', $eventState['events']);
        $updated->setRelation('modifiers', $eventState['modifiers']);
        $updated->loadMissing(['user']);
        $updated->setAttribute('event_tick_count', $eventState['tick']);

        return new SimulatorResource($updated);
    }

    public function seasonalContext(Request $request, Simulator $simulator, SeasonalWeatherService $seasonalWeather): JsonResponse
    {
        abort_unless((int) $simulator->user_id === (int) $request->user()->id, 403);
        abort_unless($simulator->mode === 'seasonal', 409, 'This simulation is not using Seasonal Journey mode.');

        return response()->json(['data' => $seasonalWeather->context($simulator)]);
    }

    private function grantOutdoorStarterPack(Simulator $simulator, int $userId): void
    {
        DB::transaction(function () use ($simulator, $userId): void {
            $locked = Simulator::query()->whereKey($simulator->id)->lockForUpdate()->firstOrFail();
            if ($locked->starter_pack_granted_at) {
                return;
            }

            $alreadyGranted = Simulator::query()
                ->where('user_id', $userId)
                ->where('id', '!=', $locked->id)
                ->whereNotNull('starter_pack_granted_at')
                ->exists();
            if ($alreadyGranted) {
                return;
            }

            $quantities = [
                'water' => 4,
                'fertilizer' => 3,
                'mulch' => 1,
                'shade' => 1,
                'windbreak' => 1,
                'frost-cover' => 1,
            ];
            Item::query()->whereIn('action_key', array_keys($quantities))->get()->each(
                function (Item $item) use ($userId, $quantities): void {
                    $inventory = UserItem::query()->firstOrNew([
                        'user_id' => $userId,
                        'item_id' => $item->id,
                    ]);
                    $inventory->quantity = (int) ($inventory->quantity ?? 0) + $quantities[$item->action_key];
                    $inventory->save();
                }
            );

            $locked->forceFill(['starter_pack_granted_at' => now()])->save();
        });
    }

    /** @return array<int, string> */
    private function simulatorRelations(): array
    {
        $relations = ['plant.stages', 'currentStage', 'visualVariant', 'activePests.pest.conditionRules'];
        if (Schema::hasTable('simulation_events')) {
            $relations[] = 'simulationEvents.definition';
        }
        if (Schema::hasTable('simulation_modifiers')) {
            $relations[] = 'modifiers.action';
        }

        return $relations;
    }

    public function sync(Request $request, Simulator $simulator): SimulatorResource
    {
        abort_unless($simulator->user_id === $request->user()->id, 403);
        $this->ensurePlantAvailable($simulator);

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

        $state = [
            'light' => $data['light'],
            'soil_humidity' => $data['soil_humidity'],
            'air_humidity' => $data['air_humidity'],
            'soil_temp' => $data['soil_temp'],
            'air_temp' => $data['air_temp'],
        ];

        $updated = DB::transaction(function () use ($simulator, $state): Simulator {
            $lockedSimulator = Simulator::query()
                ->whereKey($simulator->id)
                ->lockForUpdate()
                ->firstOrFail();

            abort_unless($lockedSimulator->status === 'active', 409, 'Only active simulations can be synchronized.');

            $lockedSimulator->update($state + $this->activity->attributes($lockedSimulator) + [
                'state_version' => ((int) $lockedSimulator->state_version) + 1,
            ]);

            return $lockedSimulator;
        });

        return new SimulatorResource($updated->fresh(['plant.stages', 'currentStage', 'visualVariant', 'activePests.pest.conditionRules']));
    }

    public function claimMaturityReward(Request $request, Simulator $simulator): JsonResponse
    {
        abort_unless($simulator->user_id === $request->user()->id, 403);
        $this->ensurePlantAvailable($simulator);

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
                    'experience_amount' => 0,
                    'balance' => $currentCoin,
                    'user' => $this->userRewardPayload($user),
                    'reason' => 'Plant is not fully grown yet.',
                    'simulator' => (new SimulatorResource($lockedSimulator->fresh(['plant.stages', 'currentStage', 'visualVariant', 'activePests.pest.conditionRules'])))->resolve($request),
                ];
            }

            if ($lockedSimulator->maturity_reward_claimed_at) {
                return [
                    'awarded' => false,
                    'amount' => 0,
                    'experience_amount' => 0,
                    'balance' => $currentCoin,
                    'user' => $this->userRewardPayload($user),
                    'reason' => 'Maturity reward already claimed.',
                    'simulator' => (new SimulatorResource($lockedSimulator->fresh(['plant.stages', 'currentStage', 'visualVariant', 'activePests.pest.conditionRules'])))->resolve($request),
                ];
            }

            $modeReward = app(\App\Services\SimulationModeRewardService::class)->forMode($lockedSimulator->mode);
            $amount = $modeReward['coin_reward'];
            $experienceAmount = $modeReward['experience_reward'];
            $user->forceFill(['coin' => $currentCoin + $amount])->save();
            $experienceReward = $user->addExperience($experienceAmount);
            $user->refresh();
            $lockedSimulator->forceFill([
                'maturity_reward_claimed_at' => now(),
                'maturity_reward_amount' => $amount,
            ])->save();

            return [
                'awarded' => true,
                'amount' => $amount,
                'experience_amount' => $experienceAmount,
                'experience_reward' => $experienceReward,
                'mode_reward' => $modeReward,
                'balance' => (int) $user->coin,
                'user' => $this->userRewardPayload($user),
                'simulator' => (new SimulatorResource($lockedSimulator->fresh(['plant.stages', 'currentStage', 'visualVariant', 'activePests.pest.conditionRules'])))->resolve($request),
            ];
        });

        return response()->json(['data' => $result]);
    }

    public function finish(Request $request, Simulator $simulator): JsonResponse
    {
        abort_unless($simulator->user_id === $request->user()->id, 403);
        $this->ensurePlantAvailable($simulator);
        abort_unless($simulator->status === 'active', 409, 'Only an active plant can be completed.');

        $simulator->update([
            'status' => 'completed',
            'share_visibility' => 'private',
            'state_version' => ((int) $simulator->state_version) + 1,
            'ended_at' => now(),
        ]);

        Post::query()->where('simulator_id', $simulator->id)->delete();

        return response()->json(['data' => ['id' => $simulator->id, 'status' => 'completed']]);
    }

    public function uproot(Request $request, Simulator $simulator): JsonResponse
    {
        abort_unless($simulator->user_id === $request->user()->id, 403);
        abort_unless($simulator->status === 'active', 409, 'Only an active plant can be uprooted.');

        $simulator->forceFill([
            'status' => 'cancelled',
            'share_visibility' => 'private',
            'ended_at' => now(),
            'state_version' => ((int) $simulator->state_version) + 1,
        ])->save();

        Post::query()->where('simulator_id', $simulator->id)->delete();

        return response()->json(['data' => ['id' => $simulator->id, 'status' => 'cancelled']]);
    }

    public function share(Request $request, Simulator $simulator): JsonResponse
    {
        abort_unless($simulator->user_id === $request->user()->id, 403);
        $this->ensurePlantAvailable($simulator);
        abort_unless($simulator->status === 'active', 409, 'Only an active plant can be shared live.');

        $data = $request->validate([
            'visibility' => ['required', Rule::in(['private', 'friends', 'public'])],
            'caption' => ['nullable', 'string', 'max:1200'],
            'snapshot_image_data' => ['nullable', 'string', 'max:9000000'],
        ]);

        $liveSnapshotUrl = $simulator->live_snapshot_url;
        if ($data['visibility'] !== 'private' && ! empty($data['snapshot_image_data'])) {
            $liveSnapshotUrl = $this->storeLiveSnapshot($data['snapshot_image_data'], $simulator->id) ?? $liveSnapshotUrl;
        }

        $simulator->forceFill([
            'share_visibility' => $data['visibility'],
            'shared_at' => $data['visibility'] === 'private' ? null : now(),
            'live_snapshot_url' => $liveSnapshotUrl,
            'state_version' => ((int) $simulator->state_version) + 1,
        ])->save();

        $post = Post::query()->withTrashed()->firstOrNew([
            'user_id' => $request->user()->id,
            'simulator_id' => $simulator->id,
        ]);

        if ($data['visibility'] === 'private') {
            if ($post->exists) {
                $post->delete();
            }
        } else {
            if ($post->exists && $post->trashed()) {
                $post->restore();
            }
            $post->fill([
                'plant_history_id' => null,
                'caption' => $data['caption'] ?? 'My plant is growing live. Open the garden to watch its progress.',
                'visibility' => $data['visibility'],
            ])->save();
        }

        return response()->json([
            'data' => (new SimulatorResource($simulator->fresh(['user', 'plant.stages', 'currentStage', 'visualVariant', 'activePests.pest.conditionRules'])))->resolve($request),
        ]);
    }

    public function spectate(Request $request, Simulator $simulator): SimulatorResource
    {
        $this->ensurePlantAvailable($simulator);
        if ($simulator->status !== 'active' || $simulator->ended_at) {
            abort(410, 'This live garden is no longer available.');
        }

        $viewer = $request->user();
        $isOwner = $simulator->user_id === $viewer->id;
        $isFriend = Friendship::query()
            ->where('status', 'accepted')
            ->where(function ($query) use ($viewer, $simulator): void {
                $query->where(function ($pair) use ($viewer, $simulator): void {
                    $pair->where('requester_id', $viewer->id)->where('addressee_id', $simulator->user_id);
                })->orWhere(function ($pair) use ($viewer, $simulator): void {
                    $pair->where('requester_id', $simulator->user_id)->where('addressee_id', $viewer->id);
                });
            })
            ->exists();

        // A private simulation is hidden from the community feed, but accepted
        // friends still need access through the dedicated friend-garden flow.
        abort_unless($isOwner || $isFriend || $simulator->share_visibility === 'public', 403);

        return new SimulatorResource($simulator->load(['user', 'plant.stages', 'currentStage', 'visualVariant', 'activePests.pest.conditionRules']));
    }

    private function storeLiveSnapshot(string $imageData, int $simulatorId): ?string
    {
        if (! preg_match('/^data:image\/(png|jpeg|webp);base64,(.+)$/s', $imageData, $matches)) {
            return null;
        }

        $binary = base64_decode($matches[2], true);
        if ($binary === false || strlen($binary) > 6 * 1024 * 1024) {
            return null;
        }

        $extension = $matches[1] === 'jpeg' ? 'jpg' : $matches[1];
        $path = 'live-snapshots/simulator-'.$simulatorId.'-'.Str::uuid().'.'.$extension;
        if (! $this->media->put($path, $binary, 'image/'.$matches[1])) {
            return null;
        }

        return $this->media->reference($path);
    }

    public function storeLog(Request $request, Simulator $simulator): SimulatorResource
    {
        abort_unless($simulator->user_id === $request->user()->id, 403);
        $this->ensurePlantAvailable($simulator);

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
            $lockedSimulator = Simulator::query()
                ->whereKey($simulator->id)
                ->lockForUpdate()
                ->firstOrFail();
            $activePestCount = $lockedSimulator->activePests()->count();

            SimulationLog::query()->updateOrCreate(
                ['simulator_id' => $simulator->id, 'day_no' => $data['day_no']],
                [
                    'simulator_id' => $lockedSimulator->id,
                    'day_no' => $data['day_no'],
                    'growth_point' => $lockedSimulator->growth_point,
                    'health' => $lockedSimulator->health,
                    'visual_state' => $lockedSimulator->visual_state,
                    'visual_variant_id' => $lockedSimulator->visual_variant_id,
                    'visual_overrides' => $lockedSimulator->visual_overrides,
                    'water' => $lockedSimulator->water,
                    'light' => $lockedSimulator->light,
                    'fertilizer' => $lockedSimulator->fertilizer,
                    'soil_humidity' => $lockedSimulator->soil_humidity,
                    'air_humidity' => $lockedSimulator->air_humidity,
                    'soil_temp' => $lockedSimulator->soil_temp,
                    'air_temp' => $lockedSimulator->air_temp,
                    'score' => max(0, (int) $lockedSimulator->growth_point + (int) $lockedSimulator->health - ($activePestCount * 8)),
                    'analysis_result' => $data['analysis_result'] ?? 'Current simulation state recorded.',
                    'direction' => $data['direction'] ?? 'Continue from the authoritative simulation state.',
                ]
            );
        });

        return new SimulatorResource($simulator->fresh(['plant.stages', 'currentStage', 'visualVariant', 'activePests.pest.conditionRules']));
    }

    public function useItem(Request $request, Simulator $simulator): JsonResponse
    {
        $userId = (int) $request->user()->id;
        abort_unless((int) $simulator->user_id === $userId, 403);
        $this->ensurePlantAvailable($simulator);

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
            'snail-spray' => 'Snail Spray',
            'antifungal-spray' => 'Fungus Spray',
        ];

        $item = Item::query()
            ->where('is_active', true)
            ->when(! empty($data['item_id']), fn ($query) => $query->where('id', $data['item_id']))
            ->when(empty($data['item_id']), function ($query) use ($data, $itemAliases) {
                $name = $itemAliases[$data['item_key']] ?? $data['item_key'];
                $query->where('name', $name);
            })
            ->firstOrFail();

        $effectType = strtolower((string) $item->effect_type);
        $isHandPick = strtolower($item->name) === 'hand pick'
            || str_starts_with($effectType, 'manual_pest_control');

        $result = DB::transaction(function () use ($isHandPick, $item, $quantity, $simulator, $userId) {
            $effectType = strtolower((string) $item->effect_type);
            $targetText = str_contains($effectType, ':') ? explode(':', $effectType, 2)[1] : '';
            $userItem = null;

            if (! $isHandPick) {
                $userItem = UserItem::query()
                    ->where('user_id', $userId)
                    ->where('item_id', $item->id)
                    ->lockForUpdate()
                    ->first();

                abort_if(! $userItem || $userItem->quantity < $quantity, 422, 'Not enough item quantity.');
                $userItem->setRelation('item', $item);
            }

            if ($isHandPick && $targetText === '') {
                $targetText = 'aphid,snail';
            }

            $targets = collect(explode(',', $targetText))
                ->map(fn ($target) => trim(strtolower($target)))
                ->filter()
                ->merge(Pest::query()
                    ->whereHas('knowledge', fn ($query) => $query->whereJsonContains('treatment_action_keys', $item->action_key))
                    ->pluck('name_en')
                    ->map(fn ($name) => strtolower((string) $name)))
                ->unique()
                ->values();

            $matchedPests = collect();
            $removedPests = collect();
            $failedPests = collect();

            if ($targets->isNotEmpty()) {
                $matchedPests = SimulationPest::query()
                    ->select('simulation_pests.*')
                    ->addSelect('pests.name_en as pest_name_en')
                    ->join('pests', 'pests.id', '=', 'simulation_pests.pest_id')
                    ->where('simulator_id', $simulator->id)
                    ->where('simulation_pests.status', 'active')
                    ->whereIn(DB::raw('LOWER(pests.name_en)'), $targets->all())
                    ->lockForUpdate()
                    ->get();

                foreach ($matchedPests as $pest) {
                    $pestName = strtolower((string) $pest->getAttribute('pest_name_en'));
                    $successRate = $this->itemSuccessRate($item, $pestName, $isHandPick);

                    if (random_int(1, 100) <= $successRate) {
                        $pest->forceFill([
                            'status' => 'treated',
                            'treated_at' => now(),
                        ])->save();

                        $removedPests->push($pest);
                    } else {
                        $failedPests->push($pest);
                    }
                }
            }

            if (! $isHandPick && $matchedPests->isNotEmpty()) {
                $nextQuantity = max(0, (int) $userItem->quantity - $quantity);
                $userItem->forceFill(['quantity' => $nextQuantity])->save();
            }

            $targetNames = $targets->implode(', ');
            $removedNames = $removedPests->map(fn (SimulationPest $pest) => $pest->getAttribute('pest_name_en'))->filter()->values();
            $failedNames = $failedPests->map(fn (SimulationPest $pest) => $pest->getAttribute('pest_name_en'))->filter()->values();

            $message = match (true) {
                $removedNames->isNotEmpty() && $failedNames->isNotEmpty() => $item->name.' removed '.$removedNames->implode(', ').', but missed '.$failedNames->implode(', ').'.',
                $removedNames->isNotEmpty() => $item->name.' removed '.$removedNames->implode(', ').'.',
                $failedNames->isNotEmpty() => $item->name.' missed '.$failedNames->implode(', ').'. Try again.',
                $matchedPests->isEmpty() && $targetNames => $item->name.' targets '.$targetNames.', but no active pest was found.',
                default => $item->name.' used successfully.',
            };

            $usage = ItemUsage::query()->create([
                'user_id' => $userId,
                'item_id' => $item->id,
                'simulator_id' => $simulator->id,
                'quantity' => $isHandPick ? 0 : ($matchedPests->isNotEmpty() ? $quantity : 0),
                'effect_result' => $message,
            ]);

            return [
                'usage' => $usage,
                'message' => $message,
                'targets' => $targets,
                'removed_pests' => $removedNames,
                'removed_pest_ids' => $removedPests->pluck('id')->map(fn ($id) => (int) $id)->values(),
                'failed_pests' => $failedNames,
                'success' => $removedNames->isNotEmpty(),
                'inventory' => $userItem,
            ];
        });

        return response()->json([
            'data' => [
                ...$result,
                'simulator' => $this->simulatorDeltaPayload($simulator),
            ],
        ], 201);
    }

    private function simulatorDeltaPayload(Simulator $simulator): array
    {
        return [
            'id' => $simulator->id,
            'plant_id' => $simulator->plant_id,
            'status' => $simulator->status,
            'state_version' => (int) ($simulator->state_version ?? 1),
            'updated_at' => $simulator->updated_at?->toISOString(),
        ];
    }

    private function simulationPestDeltaPayload(SimulationPest $simulationPest, Pest $pest): array
    {
        return [
            'id' => $simulationPest->id,
            'status' => $simulationPest->status,
            'appeared_at' => $simulationPest->appeared_at?->toISOString(),
            'risk_chance' => min(100, max(0, (int) round((float) $pest->base_chance))),
            'pest' => [
                'id' => $pest->id,
                'name_th' => $pest->name_th,
                'name_en' => $pest->name_en,
                'model_url' => $this->publicAssetUrl($pest->model_url),
                'image_url' => $this->publicAssetUrl($pest->image_url),
                'damage_per_turn' => (int) $pest->damage_per_turn,
            ],
        ];
    }

    private function publicAssetUrl(?string $path): ?string
    {
        if (! $path || Str::startsWith($path, ['http://', 'https://', '/'])) {
            return $path;
        }

        return $this->media->reference($path);
    }

    private function itemSuccessRate(Item $item, string $target, bool $isHandPick): int
    {
        if ($isHandPick) {
            return match ($target) {
                'aphid' => 40,
                'snail' => 80,
                default => 50,
            };
        }

        return str_starts_with(strtolower((string) $item->effect_type), 'pest_control') ? 100 : 0;
    }

    public function prank(Request $request, Simulator $simulator): JsonResponse
    {
        $userId = (int) $request->user()->id;
        abort_if((int) $simulator->user_id === $userId, 422, 'Prank items can only be used in a friend garden.');
        $this->ensurePlantAvailable($simulator);
        abort_unless($simulator->status === 'active', 422, 'This friend plant is not available.');

        $this->authorizeSimulatorConversation($request, $simulator);

        $data = $request->validate([
            'item_id' => ['nullable', 'integer', 'required_without:item_key', Rule::exists('items', 'id')->whereNull('deleted_at')],
            'item_key' => ['nullable', 'string', 'max:100', 'required_without:item_id'],
        ]);
        $item = Item::query()
            ->where('is_active', true)
            ->where('effect_type', 'like', 'friend_pest:%')
            ->when(
                ! empty($data['item_id']),
                fn ($query) => $query->whereKey($data['item_id']),
                function ($query) use ($data): void {
                    $itemKey = strtolower((string) ($data['item_key'] ?? ''));
                    $legacyName = match ($itemKey) {
                        'aphid-prank' => 'Aphid Prank',
                        'snail-prank' => 'Snail Prank',
                        default => null,
                    };
                    $query->where(function ($nested) use ($itemKey, $legacyName): void {
                        $nested->where('action_key', $itemKey);
                        if ($legacyName) $nested->orWhere('name', $legacyName);
                    });
                },
            )
            ->firstOrFail();
        $linkedPestId = data_get($item->effect_payload, 'pest_id');
        $effectPestKey = Str::after(strtolower((string) $item->effect_type), 'friend_pest:');
        $pest = $linkedPestId
            ? Pest::query()->findOrFail($linkedPestId)
            : Pest::query()->get()->first(fn (Pest $candidate) => Str::slug((string) ($candidate->name_en ?: $candidate->name_th)) === $effectPestKey);
        abort_unless($pest, 422, 'The pest linked to this prank item is no longer available.');
        $targetPestName = (string) ($pest->name_en ?: $pest->name_th ?: 'pest');

        $result = DB::transaction(function () use ($item, $pest, $simulator, $targetPestName, $userId) {
            $lockedSimulator = Simulator::query()->lockForUpdate()->findOrFail($simulator->id);
            abort_unless($lockedSimulator->status === 'active', 422, 'This friend plant is no longer active.');

            $activePest = SimulationPest::query()
                ->where('simulator_id', $lockedSimulator->id)
                ->where('pest_id', $pest->id)
                ->where('status', 'active')
                ->lockForUpdate()
                ->first();
            abort_if($activePest, 422, ucfirst($targetPestName).' is already active on this plant.');

            $inventory = UserItem::query()
                ->where('user_id', $userId)
                ->where('item_id', $item->id)
                ->lockForUpdate()
                ->first();
            abort_if(! $inventory || $inventory->quantity < 1, 422, 'This prank item is out of stock.');

            $simulationPest = SimulationPest::query()->create([
                'simulator_id' => $lockedSimulator->id,
                'pest_id' => $pest->id,
                'status' => 'active',
                'appeared_at' => now(),
                'treated_at' => null,
            ]);

            $inventory->forceFill([
                'quantity' => max(0, (int) $inventory->quantity - 1),
            ])->save();
            $inventory->setRelation('item', $item);
            $lockedSimulator->forceFill([
                'state_version' => ((int) $lockedSimulator->state_version) + 1,
                'updated_at' => now(),
            ])->save();

            $message = "{$targetPestName} was sent to your friend's plant.";
            $notificationExcerpt = "{$targetPestName} appeared on your active plant.";

            ItemUsage::query()->create([
                'user_id' => $userId,
                'item_id' => $item->id,
                'simulator_id' => $lockedSimulator->id,
                'quantity' => 1,
                'effect_result' => $message,
            ]);

            SocialNotification::query()->create([
                'recipient_id' => $lockedSimulator->user_id,
                'actor_id' => $userId,
                'post_id' => null,
                'comment_id' => null,
                'type' => 'garden_prank',
                'excerpt' => $notificationExcerpt,
            ]);

            return [
                'message' => $message,
                'inventory' => $inventory,
                'simulation_pest' => $this->simulationPestDeltaPayload($simulationPest, $pest),
                'simulator' => $this->simulatorDeltaPayload($lockedSimulator),
            ];
        });

        return response()->json([
            'data' => [
                'message' => $result['message'],
                'inventory' => $result['inventory'],
                'simulation_pest' => $result['simulation_pest'],
                'simulator' => $result['simulator'],
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
            'comment_text' => ['required', 'string', 'max:280'],
        ]);

        $comment = SimulatorComment::query()->create([
            'simulator_id' => $simulator->id,
            'user_id' => $request->user()->id,
            'comment_text' => trim($data['comment_text']),
            'status' => 'visible',
        ]);

        if ((int) $simulator->user_id !== (int) $request->user()->id) {
            SocialNotification::query()->create([
                'recipient_id' => $simulator->user_id,
                'actor_id' => $request->user()->id,
                'post_id' => null,
                'comment_id' => null,
                'simulator_id' => $simulator->id,
                'simulator_comment_id' => $comment->id,
                'type' => 'garden_comment',
                'excerpt' => Str::limit($comment->comment_text, 220),
            ]);
        }

        return response()->json(['data' => $this->commentPayload($comment->load('user'))], 201);
    }

    private function authorizeSimulatorConversation(Request $request, Simulator $simulator): void
    {
        $userId = (int) $request->user()->id;

        if ((int) $simulator->user_id === $userId || $simulator->share_visibility === 'public') {
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

    private function userRewardPayload($user): array
    {
        return [
            'id' => $user->id,
            'username' => $user->username,
            'email' => $user->email,
            'avatar_url' => $user->avatar_url,
            'role' => $user->role,
            'level' => $user->level,
            'experience' => $user->experience,
            'level_progress' => $user->levelProgress(),
            'coin' => $user->coin,
            'gem' => $user->gem,
            'status' => $user->status,
        ];
    }

    private function ensurePlantAvailable(Simulator $simulator): void
    {
        abort_unless($simulator->hasAvailablePlant(), 423, 'This plant species is currently under maintenance.');
    }

    /**
     * Water and nutrients are reserves, so a newly planted specimen starts
     * fully supplied. The remaining environmental factors start in the middle
     * of the species-specific healthy range.
     *
     * @return array<string, int|float>
     */
    private function initialEnvironmentFor(Plant $plant): array
    {
        return [
            'water' => 100,
            'light' => $this->rangeMidpoint($plant->light_min, $plant->light_max, 72),
            'fertilizer' => 100,
            'soil_humidity' => $this->rangeMidpoint($plant->soil_humidity_min, $plant->soil_humidity_max, 62),
            'air_humidity' => $this->rangeMidpoint($plant->air_humidity_min, $plant->air_humidity_max, 58),
            'soil_temp' => $this->rangeMidpoint($plant->soil_temp_min, $plant->soil_temp_max, 25, false),
            'air_temp' => $this->rangeMidpoint($plant->air_temp_min, $plant->air_temp_max, 29, false),
        ];
    }

    private function rangeMidpoint(mixed $min, mixed $max, int|float $fallback, bool $asInteger = true): int|float
    {
        if (! is_numeric($min) || ! is_numeric($max)) {
            return $fallback;
        }

        $minimum = (float) $min;
        $maximum = (float) $max;
        if ($minimum > $maximum) {
            return $fallback;
        }

        $midpoint = max($minimum, min($maximum, ($minimum + $maximum) / 2));

        return $asInteger ? (int) round($midpoint) : round($midpoint, 2);
    }
}
