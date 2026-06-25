<?php

namespace Tests\Unit;

use App\Models\Pest;
use App\Models\PestConditionRule;
use App\Models\Plant;
use App\Models\PlantConditionRule;
use App\Models\PlantVisualVariant;
use App\Models\SimulationPest;
use App\Models\Simulator;
use App\Services\PlantSimulationEngine;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class PlantSimulationEngineTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->buildSchema();
    }

    public function test_healthy_conditions_keep_plant_healthy(): void
    {
        [$plant, $simulator] = $this->seedPlantAndSimulator();
        $this->seedVariant($plant, 'healthy');

        $result = app(PlantSimulationEngine::class)->tick($simulator, $this->healthyFactors());

        $this->assertSame('healthy', $result->visual_state);
        $this->assertSame(100, (int) $result->health);
        $this->assertGreaterThan(0, (int) $result->growth_point);
    }

    public function test_low_water_sets_underwatered_visual_state(): void
    {
        [$plant, $simulator] = $this->seedPlantAndSimulator();
        $this->seedVariant($plant, 'underwatered');
        PlantConditionRule::query()->create([
            'plant_id' => $plant->id,
            'factor' => 'water',
            'operator' => 'below',
            'min_value' => 35,
            'visual_state' => 'underwatered',
            'severity' => 80,
            'health_delta' => -14,
            'growth_delta' => -8,
            'direction' => 'Increase water.',
        ]);

        $result = app(PlantSimulationEngine::class)->tick($simulator, $this->healthyFactors(['water' => 20]));

        $this->assertSame('underwatered', $result->visual_state);
        $this->assertLessThan(100, (int) $result->health);
        $this->assertSame('wilted', $result->visual_overrides['leafState']);
    }

    public function test_low_fertilizer_sets_nutrient_deficient_visual_state(): void
    {
        [$plant, $simulator] = $this->seedPlantAndSimulator();
        $this->seedVariant($plant, 'nutrient_deficient');
        PlantConditionRule::query()->create([
            'plant_id' => $plant->id,
            'factor' => 'fertilizer',
            'operator' => 'below',
            'min_value' => 25,
            'visual_state' => 'nutrient_deficient',
            'severity' => 65,
            'health_delta' => -8,
            'growth_delta' => -6,
        ]);

        $result = app(PlantSimulationEngine::class)->tick($simulator, $this->healthyFactors(['fertilizer' => 10]));

        $this->assertSame('nutrient_deficient', $result->visual_state);
        $this->assertSame('yellowing', $result->visual_overrides['leafState']);
    }

    public function test_high_fertilizer_sets_burnt_visual_state(): void
    {
        [$plant, $simulator] = $this->seedPlantAndSimulator();
        $this->seedVariant($plant, 'burnt');
        PlantConditionRule::query()->create([
            'plant_id' => $plant->id,
            'factor' => 'fertilizer',
            'operator' => 'above',
            'max_value' => 75,
            'visual_state' => 'burnt',
            'severity' => 72,
            'health_delta' => -12,
            'growth_delta' => -7,
        ]);

        $result = app(PlantSimulationEngine::class)->tick($simulator, $this->healthyFactors(['fertilizer' => 90]));

        $this->assertSame('burnt', $result->visual_state);
        $this->assertSame('root_burn', $result->visual_overrides['leafState']);
        $this->assertSame('#b87536', $result->visual_overrides['leafColor']);
    }

    public function test_growth_point_stops_at_final_stage_requirement(): void
    {
        [$plant, $simulator] = $this->seedPlantAndSimulator();
        $this->seedVariant($plant, 'healthy');
        $simulator->update(['growth_point' => 96]);

        $result = app(PlantSimulationEngine::class)->tick($simulator->fresh(), $this->healthyFactors());

        $this->assertSame(100, (int) $result->growth_point);
        $this->assertSame(3, (int) $result->currentStage->stage_no);
    }
    public function test_high_humidity_activates_fungus_pest(): void
    {
        [, $simulator] = $this->seedPlantAndSimulator();
        $fungus = Pest::query()->create([
            'name_th' => 'เชื้อรา',
            'name_en' => 'fungus',
            'base_chance' => 0,
            'damage_per_turn' => 7,
        ]);
        PestConditionRule::query()->create([
            'pest_id' => $fungus->id,
            'factor' => 'air_humidity',
            'operator' => 'above',
            'max_value' => 78,
            'chance_delta' => 100,
            'severity' => 50,
        ]);

        $result = app(PlantSimulationEngine::class)->tick($simulator, $this->healthyFactors(['air_humidity' => 90]));

        $this->assertSame(1, SimulationPest::query()->where('simulator_id', $result->id)->where('status', 'active')->count());
    }

    private function buildSchema(): void
    {
        foreach (['simulation_pests', 'simulation_logs', 'pest_condition_rules', 'pests', 'plant_condition_rules', 'plant_visual_variants', 'simulators', 'plant_growth_stages', 'plants'] as $table) {
            Schema::dropIfExists($table);
        }

        Schema::create('plants', function (Blueprint $table) {
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

        Schema::create('plant_growth_stages', function (Blueprint $table) {
            $table->id();
            $table->foreignId('plant_id');
            $table->unsignedInteger('stage_no');
            $table->string('stage_name');
            $table->unsignedInteger('required_growth_point')->default(0);
            $table->string('image_url')->nullable();
            $table->string('model_url')->nullable();
            $table->text('description')->nullable();
        });

        Schema::create('plant_visual_variants', function (Blueprint $table) {
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

        Schema::create('plant_condition_rules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('plant_id');
            $table->string('factor');
            $table->string('operator');
            $table->decimal('min_value', 8, 2)->nullable();
            $table->decimal('max_value', 8, 2)->nullable();
            $table->string('visual_state');
            $table->unsignedInteger('severity')->default(1);
            $table->integer('health_delta')->default(0);
            $table->integer('growth_delta')->default(0);
            $table->text('analysis_result')->nullable();
            $table->text('direction')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('pests', function (Blueprint $table) {
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

        Schema::create('pest_condition_rules', function (Blueprint $table) {
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

        Schema::create('simulators', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('user_id')->default(1);
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
            $table->timestamp('started_at')->nullable();
            $table->timestamp('ended_at')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('simulation_logs', function (Blueprint $table) {
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

        Schema::create('simulation_pests', function (Blueprint $table) {
            $table->id();
            $table->foreignId('simulator_id');
            $table->foreignId('pest_id');
            $table->string('status')->default('active');
            $table->timestamp('appeared_at')->nullable();
            $table->timestamp('treated_at')->nullable();
        });
    }

    /** @return array{0: Plant, 1: Simulator} */
    private function seedPlantAndSimulator(): array
    {
        $plant = Plant::query()->create(['name_th' => 'ต้นทดสอบ', 'name_en' => 'Test Plant', 'base_model_url' => '/plant.gltf']);
        $stage = $plant->stages()->create(['stage_no' => 1, 'stage_name' => 'Seedling', 'required_growth_point' => 0, 'model_url' => '/plant.gltf']);
        $plant->stages()->create(['stage_no' => 2, 'stage_name' => 'Sprout', 'required_growth_point' => 40, 'model_url' => '/plant.gltf']);
        $plant->stages()->create(['stage_no' => 3, 'stage_name' => 'Young Plant', 'required_growth_point' => 100, 'model_url' => '/plant.gltf']);
        $simulator = Simulator::query()->create([
            'plant_id' => $plant->id,
            'current_stage_id' => $stage->id,
            'health' => 100,
            'visual_state' => 'healthy',
            'started_at' => now(),
        ]);

        return [$plant, $simulator];
    }

    private function seedVariant(Plant $plant, string $state): void
    {
        $presets = [
            'healthy' => ['leaf_color' => '#9bcf82', 'stem_color' => '#7a5a2f', 'leaf_state' => 'upright', 'stem_state' => 'upright', 'scale' => 1],
            'underwatered' => ['leaf_color' => '#9a6a3a', 'stem_color' => '#6f4a2a', 'leaf_state' => 'wilted', 'stem_state' => 'leaning', 'scale' => 0.92],
            'nutrient_deficient' => ['leaf_color' => '#d6c66b', 'stem_color' => '#8a743e', 'leaf_state' => 'yellowing', 'stem_state' => 'thin', 'scale' => 0.9],
            'burnt' => ['leaf_color' => '#b87536', 'stem_color' => '#704326', 'leaf_state' => 'root_burn', 'stem_state' => 'dry', 'scale' => 0.88],
        ];

        PlantVisualVariant::query()->create($presets[$state] + [
            'plant_id' => $plant->id,
            'state_key' => $state,
            'label' => $state,
            'priority' => 10,
            'is_active' => true,
        ]);
    }

    /** @param array<string, int|float> $override */
    private function healthyFactors(array $override = []): array
    {
        return array_merge([
            'water' => 55,
            'light' => 70,
            'fertilizer' => 45,
            'soil_humidity' => 55,
            'air_humidity' => 60,
            'soil_temp' => 25,
            'air_temp' => 27,
            'rain' => 0,
        ], $override);
    }
}
