<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\FriendController;
use App\Http\Controllers\Api\PlantController;
use App\Http\Controllers\Api\SimulatorController;
use App\Models\Friendship;
use App\Models\Item;
use App\Models\Plant;
use App\Models\Pest;
use App\Models\SimulationLog;
use App\Models\SimulationPest;
use App\Models\Simulator;
use App\Models\User;
use App\Models\UserItem;
use App\Services\PublicCatalogCache;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\TestCase;

class SimulatorSnapshotTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->buildSchema();
    }

    public function test_sync_updates_environment_without_mutating_canonical_state_or_creating_logs(): void
    {
        [$simulator, $stages] = $this->seedSimulator();

        app(SimulatorController::class)->sync(
            $this->request($this->snapshotPayload([
                'growth_point' => 100,
                'health' => 0,
                'visual_state' => 'stunted',
                'water' => 61,
            ])),
            $simulator,
        );

        $freshSimulator = $simulator->fresh();
        $this->assertSame(0, (int) $freshSimulator->growth_point);
        $this->assertSame(100, (int) $freshSimulator->health);
        $this->assertSame($stages[1], (int) $freshSimulator->current_stage_id);
        $this->assertSame('healthy', $freshSimulator->visual_state);
        $this->assertSame('active', $freshSimulator->status);
        $this->assertSame(61, (int) $freshSimulator->water);
        $this->assertSame(2, (int) $freshSimulator->state_version);
        $this->assertSame(0, SimulationLog::query()->count());

        app(SimulatorController::class)->sync(
            $this->request($this->snapshotPayload(['growth_point' => 100, 'water' => 61])),
            $simulator->fresh(),
        );

        $this->assertSame(61, (int) $simulator->fresh()->water);
        $this->assertSame(3, (int) $simulator->fresh()->state_version);
        $this->assertSame(0, SimulationLog::query()->count());
    }

    public function test_sync_rejects_completed_simulation_without_reactivating_it(): void
    {
        [$simulator] = $this->seedSimulator();
        $simulator->update(['status' => 'completed']);

        try {
            app(SimulatorController::class)->sync(
                $this->request($this->snapshotPayload(['water' => 80])),
                $simulator->fresh(),
            );
            $this->fail('Expected completed simulation sync to be rejected.');
        } catch (HttpException $exception) {
            $this->assertSame(409, $exception->getStatusCode());
        }

        $this->assertSame('completed', $simulator->fresh()->status);
        $this->assertSame(55, (int) $simulator->fresh()->water);
    }

    public function test_explicit_log_uses_canonical_state_without_mutating_simulator(): void
    {
        [$simulator, $stages] = $this->seedSimulator();
        $payload = $this->snapshotPayload(['growth_point' => 100, 'health' => 1, 'water' => 99]) + [
            'day_no' => 1,
            'score' => 200,
        ];

        app(SimulatorController::class)->storeLog(
            $this->request($payload),
            $simulator,
        );

        $freshSimulator = $simulator->fresh();
        $this->assertSame($stages[1], (int) $freshSimulator->current_stage_id);
        $this->assertSame(0, (int) $freshSimulator->growth_point);
        $this->assertSame(100, (int) $freshSimulator->health);
        $this->assertSame(55, (int) $freshSimulator->water);
        $this->assertDatabaseHas('simulation_logs', [
            'simulator_id' => $simulator->id,
            'day_no' => 1,
            'growth_point' => 0,
            'health' => 100,
            'water' => 55,
            'score' => 100,
        ]);
    }

    public function test_starting_simulations_reuses_the_same_species_and_allows_a_second_species(): void
    {
        $elephantEar = $this->seedPlayablePlant('Elephant Ear');
        $tulip = $this->seedPlayablePlant('Tulip', [
            'water_min' => 35,
            'water_max' => 60,
            'light_min' => 60,
            'light_max' => 100,
            'fertilizer_min' => 20,
            'fertilizer_max' => 45,
            'soil_humidity_min' => 40,
            'soil_humidity_max' => 65,
            'air_humidity_min' => 45,
            'air_humidity_max' => 70,
            'soil_temp_min' => 4,
            'soil_temp_max' => 13,
            'air_temp_min' => 10,
            'air_temp_max' => 18,
        ]);
        $controller = app(SimulatorController::class);

        $firstElephant = $controller->store($this->startRequest($elephantEar->id, 'greenhouse'))->resource;
        $duplicateElephant = $controller->store($this->startRequest($elephantEar->id, 'outdoor'))->resource;
        $firstTulip = $controller->store($this->startRequest($tulip->id, 'outdoor'))->resource;

        $this->assertSame($firstElephant->id, $duplicateElephant->id);
        $this->assertSame('greenhouse', $duplicateElephant->mode);
        $this->assertNotSame($firstElephant->id, $firstTulip->id);
        $this->assertSame(2, Simulator::query()->where('user_id', 99)->where('status', 'active')->count());
        $this->assertDatabaseHas('simulators', ['user_id' => 99, 'plant_id' => $elephantEar->id, 'status' => 'active']);
        $this->assertDatabaseHas('simulators', ['user_id' => 99, 'plant_id' => $tulip->id, 'status' => 'active']);
        $this->assertSame(48, (int) $firstTulip->water);
        $this->assertSame(80, (int) $firstTulip->light);
        $this->assertSame(33, (int) $firstTulip->fertilizer);
        $this->assertSame(53, (int) $firstTulip->soil_humidity);
        $this->assertSame(58, (int) $firstTulip->air_humidity);
        $this->assertEquals(8.5, (float) $firstTulip->soil_temp);
        $this->assertEquals(14.0, (float) $firstTulip->air_temp);
    }

    public function test_accepted_friend_can_discover_and_spectate_a_private_active_simulation(): void
    {
        [$simulator] = $this->seedSimulator();
        $simulator->update([
            'mode' => 'outdoor',
            'location_name' => 'Owner garden',
            'latitude' => 18.7816,
            'longitude' => 99.0064,
        ]);
        $owner = User::query()->forceCreate([
            'id' => 99,
            'username' => 'garden-owner',
            'email' => 'owner@example.test',
            'password' => 'password',
        ]);
        $viewer = User::query()->forceCreate([
            'id' => 100,
            'username' => 'garden-friend',
            'email' => 'friend@example.test',
            'password' => 'password',
        ]);
        $viewerSimulator = $simulator->replicate();
        $viewerSimulator->forceFill([
            'user_id' => $viewer->id,
            'location_name' => 'Viewer garden',
            'latitude' => 13.7563,
            'longitude' => 100.5018,
        ])->save();
        $friendship = Friendship::query()->create([
            'requester_id' => $owner->id,
            'addressee_id' => $viewer->id,
            'status' => 'accepted',
            'accepted_at' => now(),
        ]);

        $request = Request::create('/api/friends/'.$friendship->id.'/simulator/latest', 'GET');
        $request->setUserResolver(fn () => $viewer);

        $latest = app(FriendController::class)->latestSimulator($request, $friendship);
        $spectator = app(SimulatorController::class)->spectate($request, $simulator->fresh());
        $comments = app(SimulatorController::class)->comments($request, $simulator->fresh());

        $this->assertSame($simulator->id, $latest->resource->id);
        $this->assertSame($simulator->id, $spectator->resource->id);
        $this->assertNotSame($viewerSimulator->id, $latest->resource->id);
        $this->assertSame('outdoor', $spectator->resource->mode);
        $this->assertSame('Owner garden', $spectator->resource->location_name);
        $this->assertEquals(18.7816, (float) $spectator->resource->latitude);
        $this->assertEquals(99.0064, (float) $spectator->resource->longitude);
        $this->assertSame('private', $spectator->resource->share_visibility);
        $this->assertSame([], $comments->getData(true)['data']);
    }

    public function test_public_live_simulator_comments_are_available_to_a_non_friend_viewer(): void
    {
        [$simulator] = $this->seedSimulator();
        $simulator->update(['share_visibility' => 'public']);

        $viewer = User::query()->forceCreate([
            'id' => 100,
            'username' => 'public-viewer',
            'email' => 'public-viewer@example.test',
            'password' => 'password',
        ]);
        $request = Request::create('/api/simulators/'.$simulator->id.'/comments', 'GET');
        $request->setUserResolver(fn () => $viewer);

        $comments = app(SimulatorController::class)->comments($request, $simulator->fresh());

        $this->assertSame([], $comments->getData(true)['data']);
    }

    public function test_simulator_comments_accept_280_characters_and_reject_281(): void
    {
        [$simulator] = $this->seedSimulator();

        $accepted = app(SimulatorController::class)->storeComment(
            $this->request(['comment_text' => str_repeat('a', 280)]),
            $simulator,
        );

        $this->assertSame(201, $accepted->getStatusCode());
        $this->assertSame(280, strlen($accepted->getData(true)['data']['comment_text']));

        try {
            app(SimulatorController::class)->storeComment(
                $this->request(['comment_text' => str_repeat('a', 281)]),
                $simulator->fresh(),
            );
            $this->fail('A simulator comment longer than 280 characters must be rejected.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('comment_text', $exception->errors());
        }
    }

    public function test_private_simulator_comments_remain_hidden_from_a_non_friend_viewer(): void
    {
        [$simulator] = $this->seedSimulator();
        $viewer = User::query()->forceCreate([
            'id' => 100,
            'username' => 'unrelated-viewer',
            'email' => 'unrelated-viewer@example.test',
            'password' => 'password',
        ]);
        $request = Request::create('/api/simulators/'.$simulator->id.'/comments', 'GET');
        $request->setUserResolver(fn () => $viewer);

        try {
            app(SimulatorController::class)->comments($request, $simulator->fresh());
            $this->fail('A private simulator conversation must not be visible to an unrelated viewer.');
        } catch (HttpException $exception) {
            $this->assertSame(403, $exception->getStatusCode());
        }
    }

    public function test_item_usage_returns_a_small_pest_delta_without_reloading_the_simulator_graph(): void
    {
        [$simulator] = $this->seedSimulator();
        $item = Item::query()->create([
            'name' => 'Fungus Spray',
            'type' => 'spray',
            'effect_type' => 'pest_control:fungus',
            'is_active' => true,
        ]);
        $pest = Pest::query()->create([
            'name_th' => 'Fungus',
            'name_en' => 'Fungus',
            'base_chance' => 20,
            'damage_per_turn' => 3,
        ]);
        $activePest = SimulationPest::query()->create([
            'simulator_id' => $simulator->id,
            'pest_id' => $pest->id,
            'status' => 'active',
            'appeared_at' => now(),
        ]);
        UserItem::query()->create([
            'user_id' => 99,
            'item_id' => $item->id,
            'quantity' => 3,
        ]);
        $request = Request::create('/api/simulators/'.$simulator->id.'/use-item', 'POST', [
            'item_id' => $item->id,
            'item_key' => 'antifungal-spray',
            'quantity' => 1,
        ]);
        $user = new User;
        $user->id = 99;
        $request->setUserResolver(fn () => $user);

        DB::flushQueryLog();
        DB::enableQueryLog();
        $response = app(SimulatorController::class)->useItem($request, $simulator);
        $queryCount = count(DB::getQueryLog());
        DB::disableQueryLog();
        $data = $response->getData(true)['data'];

        $this->assertTrue($data['success']);
        $this->assertSame([$activePest->id], $data['removed_pest_ids']);
        $this->assertSame($simulator->id, $data['simulator']['id']);
        $this->assertArrayNotHasKey('plant', $data['simulator']);
        $this->assertSame(2, $data['inventory']['quantity']);
        $this->assertSame('treated', $activePest->fresh()->status);
        $this->assertLessThanOrEqual(7, $queryCount);
    }

    public function test_soft_deleted_pest_is_not_returned_as_an_active_simulation_pest(): void
    {
        [$simulator] = $this->seedSimulator();
        $pest = Pest::query()->create([
            'name_th' => 'หนอน',
            'name_en' => 'Worm',
            'base_chance' => 20,
            'damage_per_turn' => 3,
        ]);
        $activePest = SimulationPest::query()->create([
            'simulator_id' => $simulator->id,
            'pest_id' => $pest->id,
            'status' => 'active',
            'appeared_at' => now(),
        ]);

        $pest->delete();

        $this->assertCount(0, $simulator->fresh()->activePests);
        $this->assertDatabaseHas('simulation_pests', [
            'id' => $activePest->id,
            'status' => 'active',
        ]);
    }

    public function test_deleted_plant_stays_in_catalog_as_unavailable_and_catalog_is_not_browser_cached(): void
    {
        $plant = $this->seedPlayablePlant('Maintenance Plant');
        $plant->delete();
        app(PublicCatalogCache::class)->clear();

        $response = app(PlantController::class)->index();

        $data = $response->getData(true)['data'];
        $this->assertCount(1, $data);
        $this->assertSame($plant->id, $data[0]['id']);
        $this->assertFalse($data[0]['is_available']);
        $this->assertStringContainsString('no-store', (string) $response->headers->get('Cache-Control'));
    }

    public function test_deleted_plant_simulation_is_reported_as_unavailable_and_cannot_sync(): void
    {
        [$simulator] = $this->seedSimulator();
        $simulator->plant->delete();

        $request = Request::create('/api/simulators?status=active', 'GET', ['status' => 'active']);
        $user = new User;
        $user->id = 99;
        $request->setUserResolver(fn () => $user);

        $payload = app(SimulatorController::class)->index($request)->response()->getData(true);
        $this->assertFalse($payload['data'][0]['plant_available']);
        $this->assertSame($simulator->plant_id, $payload['data'][0]['plant_id']);

        try {
            app(SimulatorController::class)->sync(
                $this->request($this->snapshotPayload(['water' => 80])),
                $simulator->fresh(),
            );
            $this->fail('A simulation for a deleted plant must be unavailable.');
        } catch (HttpException $exception) {
            $this->assertSame(423, $exception->getStatusCode());
            $this->assertSame('This plant species is currently under maintenance.', $exception->getMessage());
        }
    }

    /** @return array{0: Simulator, 1: array<int, int>} */
    private function seedSimulator(): array
    {
        $plant = Plant::query()->create([
            'name_th' => 'Snapshot Plant',
            'name_en' => 'Snapshot Plant',
        ]);
        $stages = [];

        foreach ([1 => 0, 2 => 40, 3 => 100] as $stageNo => $growthPoint) {
            $stage = $plant->stages()->create([
                'stage_no' => $stageNo,
                'stage_name' => "Stage {$stageNo}",
                'required_growth_point' => $growthPoint,
            ]);
            $stages[$stageNo] = $stage->id;
        }

        $simulator = Simulator::query()->create([
            'user_id' => 99,
            'plant_id' => $plant->id,
            'current_stage_id' => $stages[1],
            'health' => 100,
            'visual_state' => 'healthy',
            'water' => 55,
            'light' => 70,
            'fertilizer' => 45,
            'soil_humidity' => 55,
            'air_humidity' => 60,
            'soil_temp' => 25,
            'air_temp' => 27,
            'state_version' => 1,
            'status' => 'active',
        ]);

        return [$simulator, $stages];
    }

    /** @param array<string, int|float> $environment */
    private function seedPlayablePlant(string $name, array $environment = []): Plant
    {
        $plant = Plant::query()->create([
            'name_th' => $name,
            'name_en' => $name,
            'base_model_url' => '/plant.gltf',
            ...$environment,
        ]);

        foreach ([1 => 0, 2 => 40, 3 => 100] as $stageNo => $growthPoint) {
            $plant->stages()->create([
                'stage_no' => $stageNo,
                'stage_name' => "{$name} stage {$stageNo}",
                'required_growth_point' => $growthPoint,
                'model_url' => '/plant.gltf',
            ]);
        }

        return $plant;
    }

    /** @param array<string, mixed> $overrides */
    private function snapshotPayload(array $overrides = []): array
    {
        return array_replace([
            'growth_point' => 45,
            'health' => 90,
            'water' => 55,
            'light' => 70,
            'fertilizer' => 45,
            'soil_humidity' => 55,
            'air_humidity' => 60,
            'soil_temp' => 25,
            'air_temp' => 27,
            'visual_state' => 'healthy',
            'visual_overrides' => [],
            'analysis_result' => 'Snapshot test.',
            'direction' => 'Keep testing.',
        ], $overrides);
    }

    /** @param array<string, mixed> $payload */
    private function request(array $payload): Request
    {
        $request = Request::create('/api/simulators/1/sync', 'POST', $payload);
        $user = new User;
        $user->id = 99;
        $request->setUserResolver(fn () => $user);

        return $request;
    }

    private function startRequest(int $plantId, string $mode): Request
    {
        $request = Request::create('/api/simulators', 'POST', [
            'plant_id' => $plantId,
            'mode' => $mode,
        ]);
        $user = new User;
        $user->id = 99;
        $request->setUserResolver(fn () => $user);

        return $request;
    }

    private function buildSchema(): void
    {
        foreach ([
            'simulator_comments',
            'simulation_pests',
            'simulation_logs',
            'item_usages',
            'user_items',
            'items',
            'pest_condition_rules',
            'pests',
            'plant_visual_variants',
            'simulators',
            'plant_growth_stages',
            'plants',
            'friendships',
            'users',
        ] as $table) {
            Schema::dropIfExists($table);
        }

        Schema::create('users', function (Blueprint $table): void {
            $table->id();
            $table->string('username')->unique();
            $table->string('email')->unique();
            $table->string('password');
            $table->string('role')->default('member');
            $table->unsignedInteger('level')->default(1);
            $table->unsignedInteger('experience')->default(0);
            $table->unsignedInteger('coin')->default(0);
            $table->unsignedInteger('gem')->default(0);
            $table->string('status')->default('active');
            $table->timestamp('last_login_at')->nullable();
            $table->timestamps();
        });

        Schema::create('friendships', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('requester_id');
            $table->unsignedBigInteger('addressee_id');
            $table->string('status')->default('pending');
            $table->timestamp('accepted_at')->nullable();
            $table->timestamps();
        });

        Schema::create('items', function (Blueprint $table): void {
            $table->id();
            $table->string('name')->unique();
            $table->string('type')->nullable();
            $table->text('description')->nullable();
            $table->string('image_url')->nullable();
            $table->string('effect_type')->nullable();
            $table->decimal('effect_value', 8, 2)->nullable();
            $table->string('rarity')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('user_items', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->unsignedBigInteger('item_id');
            $table->unsignedInteger('quantity')->default(0);
            $table->timestamp('updated_at')->nullable();
        });

        Schema::create('item_usages', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->unsignedBigInteger('item_id');
            $table->unsignedBigInteger('simulator_id');
            $table->unsignedInteger('quantity')->default(0);
            $table->text('effect_result')->nullable();
            $table->timestamp('created_at')->nullable();
        });

        Schema::create('plants', function (Blueprint $table): void {
            $table->id();
            $table->string('name_th')->unique();
            $table->string('name_en')->nullable();
            $table->text('description')->nullable();
            $table->string('base_image_url')->nullable();
            $table->string('base_model_url')->nullable();
            foreach (['water', 'light', 'fertilizer', 'soil_humidity', 'air_humidity'] as $factor) {
                $table->unsignedInteger("{$factor}_min")->default(0);
                $table->unsignedInteger("{$factor}_max")->default(100);
            }
            $table->decimal('soil_temp_min', 5, 2)->default(0);
            $table->decimal('soil_temp_max', 5, 2)->default(50);
            $table->decimal('air_temp_min', 5, 2)->default(0);
            $table->decimal('air_temp_max', 5, 2)->default(50);
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('plant_growth_stages', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('plant_id');
            $table->unsignedInteger('stage_no');
            $table->string('stage_name');
            $table->unsignedInteger('required_growth_point')->default(0);
            $table->string('image_url')->nullable();
            $table->string('model_url')->nullable();
            $table->text('description')->nullable();
            $table->softDeletes();
        });

        Schema::create('plant_visual_variants', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('plant_id');
            $table->foreignId('stage_id')->nullable();
            $table->string('state_key');
            $table->string('label')->nullable();
            $table->string('model_url')->nullable();
            $table->string('leaf_color')->nullable();
            $table->string('stem_color')->nullable();
            $table->string('leaf_state')->nullable();
            $table->string('stem_state')->nullable();
            $table->decimal('scale', 5, 2)->default(1);
            $table->unsignedInteger('priority')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('pests', function (Blueprint $table): void {
            $table->id();
            $table->string('name_th')->unique();
            $table->string('name_en')->nullable();
            $table->text('description')->nullable();
            $table->string('image_url')->nullable();
            $table->string('model_url')->nullable();
            $table->decimal('base_chance', 5, 2)->default(0);
            $table->unsignedInteger('damage_per_turn')->default(0);
            $table->text('behavior')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('pest_condition_rules', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('pest_id');
            $table->foreignId('plant_id')->nullable();
            $table->string('factor');
            $table->string('operator');
            $table->decimal('min_value', 8, 2)->nullable();
            $table->decimal('max_value', 8, 2)->nullable();
            $table->decimal('chance_delta', 5, 2)->default(0);
            $table->unsignedInteger('severity')->default(1);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('simulators', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->foreignId('plant_id');
            $table->string('mode')->default('greenhouse');
            $table->string('location_name')->nullable();
            $table->decimal('latitude', 10, 7)->nullable();
            $table->decimal('longitude', 10, 7)->nullable();
            $table->string('season')->nullable();
            $table->unsignedInteger('growth_point')->default(0);
            $table->foreignId('current_stage_id')->nullable();
            $table->unsignedInteger('health')->default(100);
            $table->string('visual_state')->default('healthy');
            $table->foreignId('visual_variant_id')->nullable();
            $table->json('visual_overrides')->nullable();
            foreach (['water', 'light', 'fertilizer', 'soil_humidity', 'air_humidity'] as $factor) {
                $table->unsignedInteger($factor)->default(0);
            }
            $table->decimal('soil_temp', 5, 2)->default(0);
            $table->decimal('air_temp', 5, 2)->default(0);
            $table->string('status')->default('active');
            $table->string('share_visibility')->default('private');
            $table->unsignedBigInteger('state_version')->default(1);
            $table->timestamp('shared_at')->nullable();
            $table->string('live_snapshot_url')->nullable();
            $table->unsignedBigInteger('active_seconds')->default(0);
            $table->timestamp('last_active_at')->nullable();
            $table->timestamp('started_at')->nullable();
            $table->timestamp('ended_at')->nullable();
            $table->timestamp('maturity_reward_claimed_at')->nullable();
            $table->unsignedInteger('maturity_reward_amount')->default(0);
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('simulator_comments', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('simulator_id');
            $table->unsignedBigInteger('user_id');
            $table->text('comment_text');
            $table->string('status', 24)->default('visible');
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('simulation_logs', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('simulator_id');
            $table->unsignedInteger('day_no');
            $table->unsignedInteger('growth_point')->default(0);
            $table->unsignedInteger('health')->default(100);
            $table->string('visual_state')->nullable();
            $table->foreignId('visual_variant_id')->nullable();
            $table->json('visual_overrides')->nullable();
            foreach (['water', 'light', 'fertilizer', 'soil_humidity', 'air_humidity'] as $factor) {
                $table->unsignedInteger($factor)->default(0);
            }
            $table->decimal('soil_temp', 5, 2)->default(0);
            $table->decimal('air_temp', 5, 2)->default(0);
            $table->unsignedInteger('score')->default(0);
            $table->text('analysis_result')->nullable();
            $table->text('direction')->nullable();
            $table->timestamp('created_at')->nullable();
        });

        Schema::create('simulation_pests', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('simulator_id');
            $table->foreignId('pest_id');
            $table->string('status')->default('active');
            $table->timestamp('appeared_at')->nullable();
            $table->timestamp('treated_at')->nullable();
        });
    }
}
