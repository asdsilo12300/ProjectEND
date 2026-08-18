<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('simulators', function (Blueprint $table): void {
            $table->string('climate_zone', 32)->nullable();
            $table->string('season_key', 40)->nullable();
            $table->unsignedTinyInteger('start_month')->nullable();
            $table->timestampTz('simulated_datetime')->nullable();
            $table->unsignedInteger('calendar_day')->default(0);
            $table->decimal('biological_days', 10, 3)->default(0);
            $table->unsignedBigInteger('weather_seed')->nullable();
            $table->string('weather_source', 48)->nullable();
            $table->string('weather_profile_version', 32)->nullable();
        });

        Schema::create('simulation_weather_days', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('simulator_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('day_index');
            $table->date('simulated_date');
            $table->string('season_key', 40);
            $table->unsignedSmallInteger('weather_code')->nullable();
            $table->decimal('temperature_mean', 6, 2);
            $table->decimal('temperature_min', 6, 2);
            $table->decimal('temperature_max', 6, 2);
            $table->decimal('soil_temperature', 6, 2)->nullable();
            $table->decimal('humidity', 6, 2);
            $table->decimal('precipitation', 8, 2)->default(0);
            $table->decimal('rain', 8, 2)->default(0);
            $table->decimal('snowfall', 8, 2)->default(0);
            $table->decimal('wind_speed', 7, 2)->default(0);
            $table->decimal('wind_gust', 7, 2)->default(0);
            $table->decimal('wind_direction', 6, 2)->default(0);
            $table->decimal('cloud_cover', 6, 2)->default(0);
            $table->decimal('shortwave_radiation', 8, 2)->default(0);
            $table->decimal('evapotranspiration', 7, 2)->default(0);
            $table->decimal('soil_moisture', 8, 5)->nullable();
            $table->decimal('daylight_hours', 6, 2)->default(12);
            $table->string('source', 48);
            $table->boolean('is_forecast')->default(false);
            $table->json('metadata')->nullable();
            $table->timestamps();
            $table->unique(['simulator_id', 'day_index']);
            $table->index(['simulator_id', 'simulated_date']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('simulation_weather_days');
        Schema::table('simulators', function (Blueprint $table): void {
            $table->dropColumn([
                'climate_zone', 'season_key', 'start_month', 'simulated_datetime',
                'calendar_day', 'biological_days', 'weather_seed', 'weather_source',
                'weather_profile_version',
            ]);
        });
    }
};
