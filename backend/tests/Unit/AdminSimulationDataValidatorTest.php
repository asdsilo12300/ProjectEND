<?php

namespace Tests\Unit;

use App\Services\AdminSimulationDataValidator;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;
use Tests\TestCase;

class AdminSimulationDataValidatorTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        foreach (['model_assets', 'achievements', 'quests', 'simulation_mode_rewards', 'event_definitions', 'shop_items', 'items', 'item_types', 'pest_condition_rules', 'pest_knowledge', 'pests', 'plant_knowledge', 'plant_visual_variants', 'plant_condition_rules', 'plant_growth_stages', 'plants'] as $table) {
            Schema::dropIfExists($table);
        }

        Schema::create('plants', fn (Blueprint $table) => $this->namedTable($table));
        Schema::create('plant_growth_stages', function (Blueprint $table): void {
            $this->baseTable($table); $table->unsignedBigInteger('plant_id'); $table->string('stage_name'); $table->integer('required_growth_point');
        });
        Schema::create('plant_condition_rules', function (Blueprint $table): void {
            $this->baseTable($table); $table->unsignedBigInteger('plant_id'); $this->conditionColumns($table);
        });
        Schema::create('plant_visual_variants', function (Blueprint $table): void {
            $this->baseTable($table); $table->unsignedBigInteger('plant_id'); $table->unsignedBigInteger('stage_id')->nullable(); $table->string('state_key');
        });
        Schema::create('plant_knowledge', function (Blueprint $table): void {
            $this->baseTable($table); $table->unsignedBigInteger('plant_id');
        });
        Schema::create('pests', fn (Blueprint $table) => $this->namedTable($table));
        Schema::create('pest_knowledge', function (Blueprint $table): void {
            $this->baseTable($table); $table->unsignedBigInteger('pest_id');
        });
        Schema::create('pest_condition_rules', function (Blueprint $table): void {
            $this->baseTable($table); $table->unsignedBigInteger('pest_id'); $table->unsignedBigInteger('plant_id')->nullable(); $this->conditionColumns($table);
        });
        Schema::create('items', function (Blueprint $table): void {
            $this->baseTable($table); $table->string('name'); $table->string('action_key')->nullable();
        });
        Schema::create('item_types', function (Blueprint $table): void {
            $this->baseTable($table); $table->string('key'); $table->string('name_en'); $table->string('name_th');
        });
        Schema::create('shop_items', function (Blueprint $table): void {
            $this->baseTable($table); $table->unsignedBigInteger('item_id');
        });
        Schema::create('event_definitions', function (Blueprint $table): void {
            $this->baseTable($table); $table->string('name_en'); $table->string('name_th');
        });
        Schema::create('simulation_mode_rewards', function (Blueprint $table): void {
            $table->id(); $table->string('mode');
        });
        Schema::create('quests', function (Blueprint $table): void {
            $this->baseTable($table); $table->string('title'); $table->string('quest_type'); $table->string('target_type'); $table->integer('target_value');
        });
        Schema::create('achievements', function (Blueprint $table): void {
            $this->baseTable($table); $table->string('title'); $table->string('condition_type'); $table->integer('condition_value');
        });
        Schema::create('model_assets', function (Blueprint $table): void {
            $this->baseTable($table); $table->string('asset_key');
        });
    }

    public function test_every_simulation_catalog_rejects_its_duplicate_identity(): void
    {
        DB::table('plants')->insert(['id' => 1, 'name_en' => 'Tulip', 'name_th' => 'ทิวลิป']);
        DB::table('pests')->insert(['id' => 1, 'name_en' => 'aphid', 'name_th' => 'เพลี้ย']);
        DB::table('plant_knowledge')->insert(['id' => 1, 'plant_id' => 1]);
        DB::table('pest_knowledge')->insert(['id' => 1, 'pest_id' => 1]);
        DB::table('items')->insert(['id' => 1, 'name' => 'Insect Spray', 'action_key' => 'aphid-treatment']);
        DB::table('item_types')->insert(['id' => 1, 'key' => 'treatment', 'name_en' => 'Plant treatment tools', 'name_th' => 'อุปกรณ์รักษาพืช']);
        DB::table('shop_items')->insert(['id' => 1, 'item_id' => 1]);
        DB::table('event_definitions')->insert(['id' => 1, 'name_en' => 'Heat Wave', 'name_th' => 'คลื่นความร้อน']);
        DB::table('simulation_mode_rewards')->insert(['id' => 1, 'mode' => 'greenhouse']);
        DB::table('quests')->insert(['id' => 1, 'title' => 'Start', 'quest_type' => 'daily', 'target_type' => 'simulation_started', 'target_value' => 1]);
        DB::table('achievements')->insert(['id' => 1, 'title' => 'First Grow', 'condition_type' => 'simulation_completed', 'condition_value' => 1]);
        DB::table('model_assets')->insert(['id' => 1, 'asset_key' => 'plant.tulip']);

        $this->assertHasError('plants', ['name_en' => ' tulip ', 'name_th' => 'ทิวลิป'], 'name_en');
        $this->assertHasError('pests', ['name_en' => 'APHID', 'name_th' => 'เพลี้ย'], 'name_en');
        $this->assertHasError('plant-knowledge', ['plant_id' => 1], 'plant_id');
        $this->assertHasError('pest-knowledge', ['pest_id' => 1], 'pest_id');
        $this->assertHasError('items', ['name' => 'insect spray', 'action_key' => 'other'], 'name');
        $this->assertHasError('item-types', ['key' => 'TREATMENT', 'name_en' => 'Other', 'name_th' => 'อื่น'], 'key');
        $this->assertHasError('shop-items', ['item_id' => 1], 'item_id');
        $this->assertHasError('event-definitions', ['name_en' => 'heat wave', 'name_th' => 'อื่น', 'conditions' => []], 'name_en');
        $this->assertHasError('simulation-mode-rewards', ['mode' => 'greenhouse'], 'mode');
        $this->assertHasError('quests', ['title' => 'start', 'quest_type' => 'weekly', 'target_type' => 'item_used', 'target_value' => 2], 'title');
        $this->assertHasError('achievements', ['title' => 'first grow', 'condition_type' => 'level_reached', 'condition_value' => 2], 'title');
        $this->assertHasError('model-assets', ['asset_key' => 'PLANT.TULIP'], 'asset_key');
    }

    public function test_plant_subtables_reject_duplicate_or_overlapping_rows_but_updates_ignore_the_current_row(): void
    {
        DB::table('plant_growth_stages')->insert(['id' => 10, 'plant_id' => 1, 'stage_name' => 'Seedling', 'required_growth_point' => 0]);
        DB::table('plant_visual_variants')->insert(['id' => 20, 'plant_id' => 1, 'stage_id' => null, 'state_key' => 'healthy']);
        DB::table('plant_condition_rules')->insert(['id' => 30, 'plant_id' => 1, 'factor' => 'water', 'operator' => 'below', 'min_value' => 35, 'max_value' => null, 'is_active' => true]);

        $this->assertHasError('plant-stages', ['plant_id' => 1, 'stage_name' => 'seedling', 'required_growth_point' => 0], 'stage_name');
        $this->assertHasError('plant-variants', ['plant_id' => 1, 'stage_id' => null, 'state_key' => 'healthy'], 'state_key');
        $this->assertHasError('plant-rules', ['plant_id' => 1, 'factor' => 'water', 'operator' => 'between', 'min_value' => 20, 'max_value' => 50, 'is_active' => true], 'factor');
        $this->assertEmpty($this->errors('plant-rules', ['plant_id' => 1, 'factor' => 'water', 'operator' => 'below', 'min_value' => 35, 'max_value' => null, 'is_active' => true], 30));
    }

    public function test_pest_rules_reject_duplicates_and_overlaps_inside_the_same_pest_and_plant_scope(): void
    {
        DB::table('pest_condition_rules')->insert(['id' => 40, 'pest_id' => 1, 'plant_id' => null, 'factor' => 'air_humidity', 'operator' => 'above', 'min_value' => null, 'max_value' => 70, 'is_active' => true]);

        $this->assertHasError('pest-rules', ['pest_id' => 1, 'plant_id' => null, 'factor' => 'air_humidity', 'operator' => 'above', 'min_value' => null, 'max_value' => 70, 'is_active' => true], 'factor');
        $this->assertHasError('pest-rules', ['pest_id' => 1, 'plant_id' => null, 'factor' => 'air_humidity', 'operator' => 'between', 'min_value' => 60, 'max_value' => 90, 'is_active' => true], 'factor');
        $this->assertEmpty($this->errors('pest-rules', ['pest_id' => 1, 'plant_id' => 2, 'factor' => 'air_humidity', 'operator' => 'between', 'min_value' => 60, 'max_value' => 90, 'is_active' => true]));
    }

    public function test_ranges_and_repeated_list_entries_are_rejected(): void
    {
        $this->assertHasError('plants', ['water_min' => 80, 'water_max' => 40], 'water_max');
        $this->assertHasError('plant-knowledge', ['plant_id' => 2, 'care_en' => ['Water well', ' water well ']], 'care_en');
        $this->assertHasError('pest-knowledge', ['pest_id' => 2, 'sources' => [['url' => 'https://example.test'], ['url' => 'https://example.test']]], 'sources');
        $this->assertHasError('event-definitions', ['name_en' => 'Rain', 'name_th' => 'ฝน', 'conditions' => [['factor' => 'water', 'operator' => 'between', 'min' => 80, 'max' => 20]]], 'conditions.0.max');
        $this->assertHasError('event-definitions', ['name_en' => 'Wind', 'name_th' => 'ลม', 'conditions' => [], 'response_action_keys' => ['windbreak', 'WINDBREAK']], 'response_action_keys');
    }

    /** @param array<string, mixed> $data */
    private function errors(string $resource, array $data, ?int $recordId = null): array
    {
        $validator = Validator::make($data, []);
        app(AdminSimulationDataValidator::class)->validate($resource, $data, $recordId, $validator);
        return $validator->errors()->toArray();
    }

    /** @param array<string, mixed> $data */
    private function assertHasError(string $resource, array $data, string $field): void
    {
        $this->assertArrayHasKey($field, $this->errors($resource, $data), "{$resource} should reject {$field}.");
    }

    private function baseTable(Blueprint $table): void
    {
        $table->id(); $table->softDeletes();
    }

    private function namedTable(Blueprint $table): void
    {
        $this->baseTable($table); $table->string('name_en')->nullable(); $table->string('name_th');
    }

    private function conditionColumns(Blueprint $table): void
    {
        $table->string('factor'); $table->string('operator'); $table->decimal('min_value')->nullable(); $table->decimal('max_value')->nullable(); $table->boolean('is_active')->default(true);
    }
}
