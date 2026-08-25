<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\SimulatorController;
use App\Models\SimulationModeReward;
use App\Services\SimulationModeRewardService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class SimulationModeAvailabilityTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::dropIfExists('simulation_mode_rewards');
        Schema::dropIfExists('plants');

        Schema::create('simulation_mode_rewards', function (Blueprint $table): void {
            $table->id();
            $table->string('mode')->unique();
            $table->string('name_en');
            $table->string('name_th');
            $table->unsignedInteger('experience_reward');
            $table->unsignedInteger('coin_reward');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        Schema::create('plants', function (Blueprint $table): void {
            $table->id();
            $table->string('name_th');
            $table->timestamps();
            $table->softDeletes();
        });

        SimulationModeReward::query()->insert([
            [
                'mode' => 'greenhouse',
                'name_en' => 'Environment Control',
                'name_th' => 'โหมดควบคุมสภาพแวดล้อม',
                'experience_reward' => 20,
                'coin_reward' => 20,
                'is_active' => false,
                'created_at' => now(),
                'updated_at' => now(),
            ],
            [
                'mode' => 'outdoor',
                'name_en' => 'Outdoor',
                'name_th' => 'โหมดกลางแจ้ง',
                'experience_reward' => 150,
                'coin_reward' => 200,
                'is_active' => true,
                'created_at' => now(),
                'updated_at' => now(),
            ],
        ]);
    }

    public function test_catalog_preserves_the_disabled_admin_status(): void
    {
        $catalog = collect(app(SimulationModeRewardService::class)->catalog())->keyBy('mode');

        $this->assertFalse($catalog->get('greenhouse')['is_active']);
        $this->assertTrue($catalog->get('outdoor')['is_active']);
        $this->assertSame(20, $catalog->get('greenhouse')['coin_reward']);
    }

    public function test_a_disabled_mode_cannot_start_a_new_simulation(): void
    {
        $plantId = DB::table('plants')->insertGetId([
            'name_th' => 'Test plant',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $request = Request::create('/api/simulators', 'POST', [
            'plant_id' => $plantId,
            'mode' => 'greenhouse',
        ]);

        try {
            app(SimulatorController::class)->store($request);
            $this->fail('A disabled mode was allowed to start.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('mode', $exception->errors());
            $this->assertStringContainsString('disabled', $exception->errors()['mode'][0]);
        }
    }
}
