<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('simulation_mode_rewards', function (Blueprint $table): void {
            $table->id();
            $table->string('mode', 32)->unique();
            $table->string('name_en', 120);
            $table->string('name_th', 120);
            $table->unsignedInteger('experience_reward')->default(0);
            $table->unsignedInteger('coin_reward')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();
        });

        DB::table('simulation_mode_rewards')->insert([
            ['mode' => 'greenhouse', 'name_en' => 'Environment Control', 'name_th' => 'โหมดควบคุมสภาพแวดล้อม', 'experience_reward' => 20, 'coin_reward' => 20, 'is_active' => true, 'created_at' => now(), 'updated_at' => now()],
            ['mode' => 'outdoor', 'name_en' => 'Outdoor', 'name_th' => 'โหมดกลางแจ้ง', 'experience_reward' => 150, 'coin_reward' => 200, 'is_active' => true, 'created_at' => now(), 'updated_at' => now()],
            ['mode' => 'seasonal', 'name_en' => 'Seasonal Journey', 'name_th' => 'โหมดปลูกตามฤดูกาล', 'experience_reward' => 300, 'coin_reward' => 500, 'is_active' => true, 'created_at' => now(), 'updated_at' => now()],
        ]);
    }

    public function down(): void
    {
        Schema::dropIfExists('simulation_mode_rewards');
    }
};
