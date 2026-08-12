<?php

namespace Tests\Unit;

use App\Models\Item;
use App\Models\Plant;
use App\Models\SimulationAction;
use App\Models\Simulator;
use App\Models\UserItem;
use App\Services\SimulationActionService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class SimulationActionServiceTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        $this->buildSchema();
    }

    public function test_replaying_the_same_client_action_does_not_consume_inventory_twice(): void
    {
        [$simulator, $item] = $this->seedSimulation('greenhouse');
        $payload = [
            'client_action_id' => '8c61554c-2e46-4e37-a9d5-7deff7510eef',
            'action_key' => 'water',
            'item_id' => $item->id,
            'target_value' => null,
            'event_id' => null,
        ];

        $first = app(SimulationActionService::class)->apply($simulator, 1, $payload);
        $replayed = app(SimulationActionService::class)->apply($simulator->fresh(), 1, $payload);

        $this->assertFalse($first['replayed']);
        $this->assertTrue($replayed['replayed']);
        $this->assertSame(1, (int) UserItem::query()->firstOrFail()->quantity);
        $this->assertSame(1, SimulationAction::query()->count());
        $this->assertGreaterThan(0, (int) $simulator->fresh()->water);
        $this->assertSame(
            (int) $first['simulator']->water,
            (int) $replayed['simulator']->water,
        );
    }

    public function test_greenhouse_control_can_experiment_without_an_item(): void
    {
        [$simulator] = $this->seedSimulation('greenhouse');

        $result = app(SimulationActionService::class)->apply($simulator, 1, [
            'client_action_id' => 'a55542d0-7994-402e-95b1-70c942179ac4',
            'action_key' => 'light',
            'item_id' => null,
            'target_value' => 96,
            'event_id' => null,
        ]);

        $this->assertSame(96, (int) $result['simulator']->light);
        $this->assertNull($result['inventory_quantity']);
    }

    public function test_watering_item_refills_the_reserve_by_its_dose(): void
    {
        [$simulator, $item] = $this->seedSimulation('greenhouse');
        $simulator->update(['water' => 46]);

        $result = app(SimulationActionService::class)->apply($simulator->fresh(), 1, [
            'client_action_id' => '3334ca56-ec24-42d5-a88a-e0c6dc4cf242',
            'action_key' => 'water',
            'item_id' => $item->id,
            'target_value' => null,
            'event_id' => null,
        ]);

        $this->assertSame(66, (int) $result['simulator']->water);
        $this->assertSame(1, (int) $result['inventory_quantity']);
    }

    public function test_watering_item_never_overfills_the_reserve(): void
    {
        [$simulator, $item] = $this->seedSimulation('greenhouse');
        $simulator->update(['water' => 94]);

        $result = app(SimulationActionService::class)->apply($simulator->fresh(), 1, [
            'client_action_id' => '4e191203-b61d-4db2-bfc5-03dd0aa3dc52',
            'action_key' => 'water',
            'item_id' => $item->id,
            'target_value' => null,
            'event_id' => null,
        ]);

        $this->assertSame(100, (int) $result['simulator']->water);
    }

    public function test_watering_item_is_not_consumed_when_reserve_is_already_full(): void
    {
        [$simulator, $item] = $this->seedSimulation('greenhouse');
        $simulator->update(['water' => 100]);

        try {
            app(SimulationActionService::class)->apply($simulator->fresh(), 1, [
                'client_action_id' => '098a4489-fdfa-4781-b0f7-a70d26ca760b',
                'action_key' => 'water',
                'item_id' => $item->id,
                'target_value' => null,
                'event_id' => null,
            ]);
            $this->fail('A full reserve must reject an unnecessary watering action.');
        } catch (ValidationException) {
            $this->assertSame(2, (int) UserItem::query()->firstOrFail()->quantity);
            $this->assertSame(0, SimulationAction::query()->count());
        }
    }

    public function test_outdoor_control_requires_an_inventory_item(): void
    {
        [$simulator] = $this->seedSimulation('outdoor');

        $this->expectException(ValidationException::class);
        app(SimulationActionService::class)->apply($simulator, 1, [
            'client_action_id' => '74e36ffb-22f4-4c4f-b667-25a50b36de19',
            'action_key' => 'water',
            'item_id' => null,
            'target_value' => 75,
            'event_id' => null,
        ]);
    }

    /** @return array{Simulator, Item} */
    private function seedSimulation(string $mode): array
    {
        $plant = Plant::query()->create([
            'name_th' => 'พืชทดสอบ', 'name_en' => 'Test plant',
            'water_min' => 40, 'water_max' => 80,
            'light_min' => 40, 'light_max' => 90,
            'fertilizer_min' => 20, 'fertilizer_max' => 70,
            'soil_humidity_min' => 40, 'soil_humidity_max' => 80,
            'air_humidity_min' => 40, 'air_humidity_max' => 80,
            'soil_temp_min' => 18, 'soil_temp_max' => 32,
            'air_temp_min' => 18, 'air_temp_max' => 35,
        ]);
        $simulator = Simulator::query()->create([
            'user_id' => 1, 'plant_id' => $plant->id, 'mode' => $mode,
            'water' => 0, 'light' => 50, 'fertilizer' => 40,
            'soil_humidity' => 50, 'air_humidity' => 50,
            'soil_temp' => 24, 'air_temp' => 26,
            'health' => 100, 'growth_point' => 0, 'visual_state' => 'healthy',
            'status' => 'active', 'state_version' => 1, 'event_tick_count' => 0,
        ]);
        $item = Item::query()->create([
            'name' => 'Watering Dose', 'type' => 'water', 'effect_type' => 'environment:water',
            'effect_value' => 20, 'rarity' => 'common', 'is_active' => true,
            'action_key' => 'water', 'mode_scope' => 'both',
            'effect_payload' => ['duration_ticks' => 2], 'animation_key' => 'watering-can',
        ]);
        UserItem::query()->create(['user_id' => 1, 'item_id' => $item->id, 'quantity' => 2]);

        return [$simulator, $item];
    }

    private function buildSchema(): void
    {
        foreach (['simulation_modifiers', 'simulation_actions', 'user_items', 'items', 'simulators', 'plants'] as $table) {
            Schema::dropIfExists($table);
        }

        Schema::create('plants', function (Blueprint $table): void {
            $table->id();
            $table->string('name_th'); $table->string('name_en')->nullable();
            foreach (['water', 'light', 'fertilizer', 'soil_humidity', 'air_humidity'] as $factor) {
                $table->integer("{$factor}_min")->default(0); $table->integer("{$factor}_max")->default(100);
            }
            $table->decimal('soil_temp_min', 5, 2); $table->decimal('soil_temp_max', 5, 2);
            $table->decimal('air_temp_min', 5, 2); $table->decimal('air_temp_max', 5, 2);
            $table->timestamps(); $table->softDeletes();
        });
        Schema::create('simulators', function (Blueprint $table): void {
            $table->id(); $table->unsignedBigInteger('user_id'); $table->unsignedBigInteger('plant_id');
            $table->string('mode'); $table->string('status');
            foreach (['water', 'light', 'fertilizer', 'soil_humidity', 'air_humidity', 'health', 'growth_point'] as $field) $table->integer($field)->default(0);
            $table->decimal('soil_temp', 5, 2); $table->decimal('air_temp', 5, 2);
            $table->string('visual_state')->nullable(); $table->integer('state_version')->default(1);
            $table->integer('event_tick_count')->default(0); $table->timestamps(); $table->softDeletes();
        });
        Schema::create('items', function (Blueprint $table): void {
            $table->id(); $table->string('name'); $table->string('type'); $table->text('description')->nullable();
            $table->string('image_url')->nullable(); $table->string('effect_type')->nullable(); $table->integer('effect_value')->default(0);
            $table->string('rarity'); $table->boolean('is_active')->default(true); $table->string('action_key')->nullable();
            $table->string('mode_scope')->default('both'); $table->json('effect_payload')->nullable(); $table->string('animation_key')->nullable();
            $table->timestamps(); $table->softDeletes();
        });
        Schema::create('user_items', function (Blueprint $table): void {
            $table->id(); $table->unsignedBigInteger('user_id'); $table->unsignedBigInteger('item_id');
            $table->integer('quantity')->default(0); $table->timestamp('updated_at')->nullable();
        });
        Schema::create('simulation_actions', function (Blueprint $table): void {
            $table->id(); $table->unsignedBigInteger('simulator_id'); $table->unsignedBigInteger('user_id');
            $table->unsignedBigInteger('item_id')->nullable(); $table->unsignedBigInteger('simulation_event_id')->nullable();
            $table->uuid('client_action_id'); $table->string('action_key'); $table->string('animation_key')->nullable();
            $table->string('status'); $table->decimal('target_value', 8, 2)->nullable();
            $table->json('request_payload')->nullable(); $table->json('result_payload')->nullable();
            $table->string('message_code')->nullable(); $table->timestamp('applied_at')->nullable(); $table->timestamps();
            $table->unique(['user_id', 'client_action_id']);
        });
        Schema::create('simulation_modifiers', function (Blueprint $table): void {
            $table->id(); $table->unsignedBigInteger('simulator_id'); $table->unsignedBigInteger('simulation_action_id')->nullable();
            $table->unsignedBigInteger('simulation_event_id')->nullable(); $table->string('factor_key');
            $table->decimal('add_value', 8, 2)->default(0); $table->decimal('multiply_value', 8, 4)->default(1);
            $table->integer('starts_tick')->default(0); $table->integer('ends_tick')->nullable(); $table->timestamps();
        });
    }
}
