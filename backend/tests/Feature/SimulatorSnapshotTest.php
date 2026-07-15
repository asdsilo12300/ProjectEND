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
