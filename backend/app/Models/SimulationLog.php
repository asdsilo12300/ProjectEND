<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SimulationLog extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = [
        'simulator_id',
        'day_no',
        'growth_point',
        'health',
        'visual_state',
        'visual_variant_id',
        'visual_overrides',
        'water',
        'light',
        'fertilizer',
        'soil_humidity',
        'air_humidity',
        'soil_temp',
        'air_temp',
        'score',
        'analysis_result',
        'direction',
    ];

    protected function casts(): array
    {
        return [
            'visual_overrides' => 'array',
            'soil_temp' => 'decimal:2',
            'air_temp' => 'decimal:2',
        ];
    }

    public function simulator(): BelongsTo
    {
        return $this->belongsTo(Simulator::class);
    }
}
