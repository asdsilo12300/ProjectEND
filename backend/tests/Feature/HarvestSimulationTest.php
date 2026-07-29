<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\PlantHistoryController;
use App\Models\Plant;
use App\Models\PlantHistory;
use App\Models\Simulator;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class HarvestSimulationTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->buildSchema();
    }

    public function test_harvest_is_atomic_and_idempotent_for_a_simulator(): void
    {
        $user = User::query()->create([
            'username' => 'harvest-test',
            'email' => 'harvest@example.com',
            'password' => 'secret',
        ]);
        $plant = Plant::query()->create([
            'name_th' => 'Harvest Plant',
            'name_en' => 'Harvest Plant',
        ]);
        $stage = $plant->stages()->create([
            'stage_no' => 3,
            'stage_name' => 'Young Plant',
            'required_growth_point' => 100,
        ]);
        $simulator = Simulator::query()->create([
            'user_id' => $user->id,
            'plant_id' => $plant->id,
            'current_stage_id' => $stage->id,
            'growth_point' => 100,
            'health' => 88,
            'visual_state' => 'healthy',
            'status' => 'active',
            'share_visibility' => 'private',
            'state_version' => 1,
            'active_seconds' => 0,
            'last_active_at' => now()->subSeconds(45),
            'started_at' => now()->subSeconds(45),
        ]);
        $request = Request::create('/api/simulators/1/histories', 'POST', [
            'visibility' => 'private',
            'growth_calculation' => [
                'cycle_seconds' => 30,
                'observed_growth_points_per_cycle' => 14,
                'recent_growth_percentages' => [0, 14, 28],
            ],
        ]);
        $request->setUserResolver(fn () => $user);
        $controller = app(PlantHistoryController::class);

        $first = $controller->storeForSimulator($request, $simulator);
        $second = $controller->storeForSimulator($request, $simulator);

        $this->assertSame($first->resource->id, $second->resource->id);
        $this->assertSame(1, PlantHistory::query()->count());
        $this->assertSame('completed', $simulator->fresh()->status);
        $this->assertSame(2, (int) $simulator->fresh()->state_version);
        $this->assertNotNull($simulator->fresh()->ended_at);
        $this->assertGreaterThanOrEqual(45, (int) $first->resource->duration_seconds);
        $this->assertLessThan(50, (int) $first->resource->duration_seconds);
        $this->assertSame(0, (int) $first->resource->duration_days);
        $growthCalculation = data_get($first->resource->game_state, 'growth_calculation');
        $this->assertSame(90, $growthCalculation['maturity_days']);
        $this->assertSame(30, $growthCalculation['cycle_seconds']);
        $this->assertEquals(14.0, $growthCalculation['observed_growth_points_per_cycle']);
        $this->assertEquals([0, 14, 28, 100], $growthCalculation['recent_growth_percentages']);
        $this->assertSame('complete', $growthCalculation['status']);
    }

    private function buildSchema(): void
    {
        foreach ([
            'posts',
            'plant_histories',
            'simulation_pests',
            'pest_condition_rules',
            'pests',
            'plant_condition_rules',
            'plant_visual_variants',
            'simulators',
            'plant_growth_stages',
            'plants',
            'users',
        ] as $table) {
            Schema::dropIfExists($table);
        }

        Schema::create('users', function (Blueprint $table): void {
            $table->id();
            $table->string('username');
            $table->string('email')->unique();
            $table->string('password');
            $table->string('avatar_url')->nullable();
            $table->unsignedInteger('level')->default(1);
            $table->timestamps();
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

        Schema::create('plant_condition_rules', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('plant_id');
            $table->string('factor');
            $table->string('operator');
            $table->decimal('min_value', 8, 2)->nullable();
            $table->decimal('max_value', 8, 2)->nullable();
            $table->string('visual_state')->default('healthy');
            $table->unsignedInteger('severity')->default(1);
            $table->integer('health_delta')->default(0);
            $table->integer('growth_delta')->default(0);
            $table->text('analysis_result')->nullable();
            $table->text('direction')->nullable();
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
            $table->foreignId('user_id');
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

        Schema::create('simulation_pests', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('simulator_id');
            $table->foreignId('pest_id');
            $table->string('status')->default('active');
            $table->timestamp('appeared_at')->nullable();
            $table->timestamp('treated_at')->nullable();
        });

        Schema::create('plant_histories', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('simulator_id');
            $table->foreignId('user_id');
            $table->foreignId('plant_id');
            $table->foreignId('final_stage_id')->nullable();
            $table->unsignedInteger('final_health')->default(100);
            $table->unsignedInteger('total_score')->default(0);
            $table->unsignedInteger('duration_days')->default(1);
            $table->unsignedBigInteger('duration_seconds')->nullable();
            $table->string('visibility')->default('private');
            $table->string('snapshot_image_url')->nullable();
            $table->json('game_state')->nullable();
            $table->text('analysis_result')->nullable();
            $table->text('direction')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('posts', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id');
            $table->foreignId('plant_history_id')->nullable();
            $table->foreignId('simulator_id')->nullable();
            $table->text('caption')->nullable();
            $table->string('visibility')->default('public');
            $table->timestamps();
            $table->softDeletes();
        });
    }
}
