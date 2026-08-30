<?php

namespace Tests\Feature;

use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class ItemTypeMigrationTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Schema::dropIfExists('item_types');
        Schema::dropIfExists('items');
        Schema::create('items', function (Blueprint $table): void {
            $table->id();
            $table->string('type');
        });
    }

    public function test_migration_seeds_standard_and_existing_item_types(): void
    {
        DB::table('items')->insert([
            ['id' => 1, 'type' => 'pesticide'],
            ['id' => 2, 'type' => 'custom_tool'],
        ]);

        $migration = require database_path('migrations/2026_08_28_000001_create_item_types_table.php');
        $migration->up();

        foreach (['care', 'treatment', 'condition', 'prank', 'custom_tool'] as $key) {
            $this->assertDatabaseHas('item_types', ['key' => $key, 'is_active' => true]);
        }
        $this->assertDatabaseHas('item_types', [
            'key' => 'treatment',
            'name_en' => 'Plant treatment tools',
            'name_th' => 'อุปกรณ์รักษาพืช',
        ]);
        $this->assertDatabaseHas('items', ['id' => 1, 'type' => 'treatment']);
        $this->assertDatabaseHas('item_types', [
            'key' => 'custom_tool',
            'name_en' => 'Custom Tool',
        ]);
    }

    public function test_alignment_migration_updates_an_already_deployed_legacy_catalog(): void
    {
        Schema::create('item_types', function (Blueprint $table): void {
            $table->id();
            $table->string('key')->unique();
            $table->string('name_en');
            $table->string('name_th');
            $table->text('description')->nullable();
            $table->unsignedInteger('sort_order')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();
        });
        DB::table('item_types')->insert([
            ['key' => 'pesticide', 'name_en' => 'Pest control', 'name_th' => 'สารกำจัดศัตรูพืช'],
            ['key' => 'cosmetic', 'name_en' => 'Cosmetic', 'name_th' => 'ของตกแต่ง'],
            ['key' => 'custom_tool', 'name_en' => 'Custom tool', 'name_th' => 'เครื่องมือกำหนดเอง'],
        ]);
        DB::table('items')->insert([
            ['id' => 1, 'type' => 'pesticide'],
            ['id' => 2, 'type' => 'cosmetic'],
            ['id' => 3, 'type' => 'custom_tool'],
        ]);

        $migration = require database_path('migrations/2026_08_28_000002_align_item_types_with_game_categories.php');
        $migration->up();

        $this->assertDatabaseHas('items', ['id' => 1, 'type' => 'treatment']);
        $this->assertDatabaseHas('items', ['id' => 2, 'type' => 'prank']);
        $this->assertDatabaseHas('items', ['id' => 3, 'type' => 'custom_tool']);
        $this->assertDatabaseHas('item_types', ['key' => 'care', 'name_th' => 'อุปกรณ์ดูแลพืช']);
        $this->assertDatabaseHas('item_types', ['key' => 'treatment', 'name_th' => 'อุปกรณ์รักษาพืช']);
        $this->assertDatabaseHas('item_types', ['key' => 'condition', 'name_th' => 'เครื่องมือปรับสภาพ']);
        $this->assertDatabaseHas('item_types', ['key' => 'prank', 'name_th' => 'ไอเทมแกล้งเพื่อน']);
        $this->assertDatabaseHas('item_types', ['key' => 'custom_tool', 'is_active' => true]);
    }
}
