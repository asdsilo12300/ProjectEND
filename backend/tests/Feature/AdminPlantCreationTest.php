<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\AdminResourceController;
use App\Models\Plant;
use App\Models\PlantConditionRule;
use App\Models\PlantGrowthStage;
use App\Models\PlantVisualVariant;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class AdminPlantCreationTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::dropIfExists('admin_activity_logs');
        Schema::dropIfExists('plant_visual_variants');
        Schema::dropIfExists('plant_condition_rules');
        Schema::dropIfExists('plant_growth_stages');
        Schema::dropIfExists('plants');
        Schema::dropIfExists('users');

        Schema::create('users', function (Blueprint $table): void {
            $table->id();
            $table->string('username');
            $table->string('email');
            $table->string('password')->nullable();
            $table->string('role')->default('admin');
            $table->timestamps();
        });
        Schema::create('plants', function (Blueprint $table): void {
            $table->id();
            $table->string('name_th')->unique();
            $table->string('name_en')->nullable();
            $table->text('description')->nullable();
            $table->string('base_image_url')->nullable();
            $table->string('base_model_url');
            foreach (['water', 'light', 'fertilizer', 'soil_humidity', 'air_humidity'] as $factor) {
                $table->integer("{$factor}_min");
                $table->integer("{$factor}_max");
            }
            foreach (['soil_temp', 'air_temp'] as $factor) {
                $table->decimal("{$factor}_min", 8, 2);
                $table->decimal("{$factor}_max", 8, 2);
            }
            $table->timestamps();
            $table->softDeletes();
        });
        Schema::create('plant_growth_stages', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('plant_id');
            $table->integer('stage_no');
            $table->string('stage_name');
            $table->integer('required_growth_point');
            $table->string('image_url')->nullable();
            $table->string('model_url')->nullable();
            $table->text('description')->nullable();
            $table->softDeletes();
            $table->unique(['plant_id', 'stage_no']);
        });
        Schema::create('plant_condition_rules', function (Blueprint $table): void {
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
        Schema::create('admin_activity_logs', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('admin_id');
            $table->string('action');
            $table->string('target_type')->nullable();
            $table->unsignedBigInteger('target_id')->nullable();
            $table->text('detail')->nullable();
            $table->timestamp('created_at')->nullable();
        });
    }

    public function test_new_plant_gets_a_complete_default_growth_track(): void
    {
        $admin = User::query()->create(['username' => 'admin', 'email' => 'admin@example.test', 'role' => 'admin']);
        $controller = app(AdminResourceController::class);
        $request = Request::create('/api/admin/resources/plants', 'POST', $this->plantPayload('Fern', 'เฟิร์น'));
        $request->setUserResolver(fn () => $admin);

        $response = $controller->store($request, 'plants');
        $plant = Plant::query()->firstOrFail();

        $this->assertSame(201, $response->status());
        $this->assertSame([0, 40, 100], $plant->stages()->pluck('required_growth_point')->all());
        $this->assertSame(
            ['/storage/model-bundles/test/model.gltf'],
            $plant->stages()->pluck('model_url')->unique()->values()->all(),
        );
        $this->assertTrue(Plant::query()->playable()->whereKey($plant->id)->exists());

        $plant->stages()->where('required_growth_point', 100)->firstOrFail()->delete();
        $this->assertFalse(Plant::query()->playable()->whereKey($plant->id)->exists());
    }

    public function test_stage_number_is_unique_per_plant_and_variant_stage_must_belong_to_plant(): void
    {
        $admin = User::query()->create(['username' => 'admin', 'email' => 'admin@example.test', 'role' => 'admin']);
        $controller = app(AdminResourceController::class);
        $firstPlant = $this->createPlant($controller, $admin, 'Fern', 'เฟิร์น');
        $secondPlant = $this->createPlant($controller, $admin, 'Palm', 'ปาล์ม');

        $duplicate = Request::create('/api/admin/resources/plant-stages', 'POST', [
            'plant_id' => $firstPlant->id,
            'stage_no' => 1,
            'stage_name' => 'Duplicate',
            'required_growth_point' => 10,
        ]);
        $duplicate->setUserResolver(fn () => $admin);

        try {
            $controller->store($duplicate, 'plant-stages');
            $this->fail('Duplicate stage number should fail validation.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('stage_no', $exception->errors());
        }

        $foreignStage = PlantGrowthStage::query()->where('plant_id', $firstPlant->id)->firstOrFail();
        $variant = Request::create('/api/admin/resources/plant-variants', 'POST', [
            'plant_id' => $secondPlant->id,
            'stage_id' => $foreignStage->id,
            'state_key' => 'healthy',
            'scale' => 1,
            'priority' => 0,
            'is_active' => true,
        ]);
        $variant->setUserResolver(fn () => $admin);

        try {
            $controller->store($variant, 'plant-variants');
            $this->fail('A visual stage from another plant should fail validation.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('stage_id', $exception->errors());
        }
    }

    public function test_new_tulip_receives_a_realistic_environment_profile_rules_and_visuals(): void
    {
        $admin = User::query()->create(['username' => 'admin', 'email' => 'admin@example.test', 'role' => 'admin']);
        $controller = app(AdminResourceController::class);
        $request = Request::create('/api/admin/resources/plants', 'POST', $this->plantPayload('Tulip', 'ทิวลิป'));
        $request->setUserResolver(fn () => $admin);

        $response = $controller->store($request, 'plants');
        $tulip = Plant::query()->where('name_en', 'Tulip')->firstOrFail();

        $this->assertSame(201, $response->status());
        $this->assertSame(35, $tulip->water_min);
        $this->assertSame(60, $tulip->water_max);
        $this->assertSame(60, $tulip->light_min);
        $this->assertSame(100, $tulip->light_max);
        $this->assertSame('4.00', $tulip->soil_temp_min);
        $this->assertSame('18.00', $tulip->air_temp_max);
        $this->assertSame(['Bulb establishment', 'Leaf emergence', 'Flowering'], $tulip->stages()->pluck('stage_name')->all());
        $this->assertCount(13, PlantConditionRule::query()->where('plant_id', $tulip->id)->get());
        $this->assertCount(11, PlantVisualVariant::query()->where('plant_id', $tulip->id)->get());
        $this->assertTrue(Plant::query()->playable()->whereKey($tulip->id)->exists());
    }

    private function createPlant(AdminResourceController $controller, User $admin, string $englishName, string $thaiName): Plant
    {
        $request = Request::create('/api/admin/resources/plants', 'POST', $this->plantPayload($englishName, $thaiName));
        $request->setUserResolver(fn () => $admin);
        $controller->store($request, 'plants');

        return Plant::query()->where('name_en', $englishName)->firstOrFail();
    }

    /** @return array<string, int|string> */
    private function plantPayload(string $englishName, string $thaiName): array
    {
        return [
            'name_en' => $englishName,
            'name_th' => $thaiName,
            'base_model_url' => '/storage/model-bundles/test/model.gltf',
            'water_min' => 30, 'water_max' => 80,
            'light_min' => 30, 'light_max' => 90,
            'fertilizer_min' => 20, 'fertilizer_max' => 70,
            'soil_humidity_min' => 30, 'soil_humidity_max' => 80,
            'air_humidity_min' => 30, 'air_humidity_max' => 80,
            'soil_temp_min' => 18, 'soil_temp_max' => 32,
            'air_temp_min' => 18, 'air_temp_max' => 35,
        ];
    }
}
