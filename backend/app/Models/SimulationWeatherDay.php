<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SimulationWeatherDay extends Model
{
    protected $fillable = [
        'simulator_id', 'day_index', 'simulated_date', 'season_key', 'weather_code',
        'temperature_mean', 'temperature_min', 'temperature_max', 'soil_temperature',
        'humidity', 'precipitation', 'rain', 'snowfall', 'wind_speed', 'wind_gust',
        'wind_direction', 'cloud_cover', 'shortwave_radiation', 'evapotranspiration',
        'soil_moisture', 'daylight_hours', 'source', 'is_forecast', 'metadata',
    ];

    protected function casts(): array
    {
        return [
            'simulated_date' => 'date',
            'is_forecast' => 'boolean',
            'metadata' => 'array',
            'temperature_mean' => 'float',
            'temperature_min' => 'float',
            'temperature_max' => 'float',
            'soil_temperature' => 'float',
            'humidity' => 'float',
            'precipitation' => 'float',
            'rain' => 'float',
            'snowfall' => 'float',
            'wind_speed' => 'float',
            'wind_gust' => 'float',
            'wind_direction' => 'float',
            'cloud_cover' => 'float',
            'shortwave_radiation' => 'float',
            'evapotranspiration' => 'float',
            'soil_moisture' => 'float',
            'daylight_hours' => 'float',
        ];
    }

    public function simulator(): BelongsTo
    {
        return $this->belongsTo(Simulator::class);
    }
}
