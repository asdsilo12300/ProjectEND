<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('items', function (Blueprint $table): void {
            $table->string('action_key', 100)->nullable()->unique();
            $table->string('mode_scope', 24)->default('both');
            $table->json('effect_payload')->nullable();
            $table->string('animation_key', 100)->nullable();
        });

        Schema::table('simulators', function (Blueprint $table): void {
            $table->string('location_timezone', 80)->nullable();
            $table->timestamp('location_changed_at')->nullable();
            $table->unsignedInteger('event_tick_count')->default(0);
            $table->timestamp('last_harmful_event_at')->nullable();
            $table->timestamp('starter_pack_granted_at')->nullable();
        });

        Schema::create('event_definitions', function (Blueprint $table): void {
            $table->id();
            $table->string('event_key', 120)->unique();
            $table->string('name_en', 191);
            $table->string('name_th', 191);
            $table->text('description_en')->nullable();
            $table->text('description_th')->nullable();
            $table->string('mode_scope', 24)->default('both');
            $table->string('severity', 24)->default('low');
            $table->unsignedSmallInteger('weight')->default(10);
            $table->unsignedSmallInteger('trigger_chance')->default(15);
            $table->unsignedSmallInteger('warning_ticks')->default(1);
            $table->unsignedSmallInteger('duration_ticks')->default(1);
            $table->unsignedSmallInteger('cooldown_ticks')->default(3);
            $table->json('conditions')->nullable();
            $table->json('effects')->nullable();
            $table->json('response_action_keys')->nullable();
            $table->boolean('is_harmful')->default(true);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();
            $table->index(['mode_scope', 'is_active', 'severity']);
        });

        Schema::create('simulation_events', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('simulator_id')->constrained()->cascadeOnDelete();
            $table->foreignId('event_definition_id')->constrained()->cascadeOnDelete();
            $table->string('status', 24)->default('announced');
            $table->unsignedInteger('announced_tick');
            $table->unsignedInteger('starts_tick');
            $table->unsignedInteger('ends_tick');
            $table->unsignedBigInteger('seed')->default(0);
            $table->json('effect_snapshot')->nullable();
            $table->timestamp('resolved_at')->nullable();
            $table->string('resolved_by_action_key', 100)->nullable();
            $table->timestamps();
            $table->index(['simulator_id', 'status']);
        });

        Schema::create('simulation_actions', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('simulator_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->foreignId('item_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('simulation_event_id')->nullable()->constrained()->nullOnDelete();
            $table->uuid('client_action_id');
            $table->string('action_key', 100);
            $table->string('animation_key', 100)->nullable();
            $table->string('status', 24)->default('applying');
            $table->decimal('target_value', 8, 2)->nullable();
            $table->json('request_payload')->nullable();
            $table->json('result_payload')->nullable();
            $table->string('message_code', 160)->nullable();
            $table->timestamp('applied_at')->nullable();
            $table->timestamps();
            $table->unique(['user_id', 'client_action_id']);
            $table->index(['simulator_id', 'created_at']);
        });

        Schema::create('simulation_modifiers', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('simulator_id')->constrained()->cascadeOnDelete();
            $table->foreignId('simulation_action_id')->nullable()->constrained()->nullOnDelete();
            $table->foreignId('simulation_event_id')->nullable()->constrained()->nullOnDelete();
            $table->string('factor_key', 80);
            $table->decimal('add_value', 8, 2)->default(0);
            $table->decimal('multiply_value', 8, 4)->default(1);
            $table->unsignedInteger('starts_tick')->default(0);
            $table->unsignedInteger('ends_tick')->nullable();
            $table->timestamps();
            $table->index(['simulator_id', 'factor_key', 'ends_tick']);
        });

        $now = now();
        DB::table('event_definitions')->insert([
            $this->event('lamp-flicker', 'Lamp instability', 'แสงไม่เสถียร', 'greenhouse', 'low', 22, ['light' => -12], ['shade', 'light'], $now),
            $this->event('gentle-cycle', 'Stable growing window', 'ช่วงสภาพแวดล้อมสมบูรณ์', 'greenhouse', 'low', 14, ['water' => 3, 'air_humidity' => 3], [], $now, false),
            $this->event('light-rain', 'Light rain', 'ฝนตกเบา', 'outdoor', 'low', 24, ['water' => 10, 'soil_humidity' => 8], ['drainage'], $now, false),
            $this->event('heavy-rain', 'Heavy rain', 'ฝนตกหนัก', 'outdoor', 'medium', 12, ['water' => 22, 'soil_humidity' => 18], ['drainage'], $now),
            $this->event('heat-wave', 'Heat wave', 'คลื่นความร้อน', 'outdoor', 'high', 8, ['air_temp' => 8, 'soil_temp' => 5, 'water' => -14], ['shade', 'water'], $now),
            $this->event('strong-wind', 'Strong wind', 'ลมแรง', 'outdoor', 'medium', 12, ['air_humidity' => -12, 'water' => -8], ['windbreak'], $now),
            $this->event('cold-snap', 'Cold snap', 'อากาศเย็นฉับพลัน', 'outdoor', 'high', 7, ['air_temp' => -8, 'soil_temp' => -5], ['frost-cover'], $now),
        ]);

        $this->seedActionItems($now);
    }

    private function event(string $key, string $en, string $th, string $mode, string $severity, int $weight, array $effects, array $responses, $now, bool $harmful = true): array
    {
        return [
            'event_key' => $key, 'name_en' => $en, 'name_th' => $th,
            'description_en' => 'A naturally scheduled simulation event. Respond before the next update when a care action is suggested.',
            'description_th' => 'เหตุการณ์จำลองที่เกิดตามจังหวะอย่างเป็นธรรมชาติ ควรรับมือก่อนรอบอัปเดตถัดไปเมื่อระบบแนะนำ',
            'mode_scope' => $mode, 'severity' => $severity, 'weight' => $weight,
            'trigger_chance' => $severity === 'high' ? 8 : 16,
            'warning_ticks' => $severity === 'high' ? 1 : 0, 'duration_ticks' => 2,
            'cooldown_ticks' => $severity === 'high' ? 4 : 3,
            'conditions' => json_encode([], JSON_THROW_ON_ERROR),
            'effects' => json_encode(['factor_delta' => $effects], JSON_THROW_ON_ERROR),
            'response_action_keys' => json_encode($responses, JSON_THROW_ON_ERROR),
            'is_harmful' => $harmful, 'is_active' => true,
            'created_at' => $now, 'updated_at' => $now,
        ];
    }

    private function seedActionItems($now): void
    {
        $items = [
            ['Watering Dose', 'water', 'water', 22, 'watering-can', 'both', 20],
            ['Fertilizer Dose', 'fertilizer', 'fertilizer', 18, 'fertilizer-pour', 'both', 25],
            ['Drainage Mix', 'booster', 'drainage', 20, 'soil-mix', 'outdoor', 35],
            ['Shade Cloth', 'booster', 'shade', 20, 'shade-cover', 'outdoor', 40],
            ['Windbreak', 'booster', 'windbreak', 20, 'windbreak', 'outdoor', 40],
            ['Frost Cover', 'booster', 'frost-cover', 20, 'frost-cover', 'outdoor', 40],
        ];

        foreach ($items as [$name, $type, $action, $effect, $animation, $scope, $price]) {
            $id = DB::table('items')->where('action_key', $action)->value('id');
            if (! $id) {
                DB::table('items')->insertOrIgnore([
                    'name' => $name, 'type' => $type,
                    'description' => 'Consumable care action for the live plant simulation.',
                    'effect_type' => 'environment:'.$action, 'effect_value' => $effect,
                    'rarity' => 'common', 'is_active' => true, 'action_key' => $action,
                    'mode_scope' => $scope,
                    'effect_payload' => json_encode(['strategy' => 'toward_healthy_midpoint', 'duration_ticks' => 2, 'duration_seconds' => 30], JSON_THROW_ON_ERROR),
                    'animation_key' => $animation, 'created_at' => $now, 'updated_at' => $now,
                ]);
                $id = DB::table('items')->where('action_key', $action)->value('id');
            }
            // In --pretend mode PostgreSQL does not return rows for data queries.
            // Skipping the dependent shop row there keeps migration previews safe;
            // a real migration resolves the newly inserted id and creates it below.
            if ($id && ! DB::table('shop_items')->where('item_id', $id)->exists()) {
                DB::table('shop_items')->insert(['item_id' => $id, 'price_coin' => $price, 'price_gem' => 0, 'is_active' => true]);
            }
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('simulation_modifiers');
        Schema::dropIfExists('simulation_actions');
        Schema::dropIfExists('simulation_events');
        Schema::dropIfExists('event_definitions');
        Schema::table('simulators', fn (Blueprint $table) => $table->dropColumn(['location_timezone', 'location_changed_at', 'event_tick_count', 'last_harmful_event_at', 'starter_pack_granted_at']));
        Schema::table('items', function (Blueprint $table): void {
            $table->dropUnique(['action_key']);
            $table->dropColumn(['action_key', 'mode_scope', 'effect_payload', 'animation_key']);
        });
    }
};
