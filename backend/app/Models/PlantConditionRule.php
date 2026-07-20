<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class PlantConditionRule extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'plant_id',
        'factor',
        'operator',
        'min_value',
        'max_value',
        'visual_state',
        'severity',
        'health_delta',
        'growth_delta',
        'analysis_result',
        'direction',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'min_value' => 'decimal:2',
            'max_value' => 'decimal:2',
            'severity' => 'integer',
            'health_delta' => 'integer',
            'growth_delta' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    public function plant(): BelongsTo
    {
        return $this->belongsTo(Plant::class)->withTrashed();
    }
}
