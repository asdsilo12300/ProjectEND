<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\SimulatorController;
use App\Models\Plant;
use App\Models\SimulationLog;
use App\Models\Simulator;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
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
            'simulation_pests',
            'simulation_logs',
            'pest_condition_rules',
            'pests',
            'plant_visual_variants',
            'simulators',
            'plant_growth_stages',
            'plants',
        ] as $table) {
            Schema::dropIfExists($table);
        }

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
            $table->timestamp('started_at')->nullable();
            $table->timestamp('ended_at')->nullable();
            $table->timestamp('maturity_reward_claimed_at')->nullable();
            $table->unsignedInteger('maturity_reward_amount')->default(0);
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
