<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class PlantVisualVariant extends Model
{
    protected $fillable = [
        'plant_id',
        'stage_id',
        'state_key',
        'label',
        'model_url',
        'leaf_color',
        'stem_color',
        'leaf_state',
        'stem_state',
        'scale',
        'priority',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'scale' => 'decimal:2',
            'priority' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    public function plant(): BelongsTo
    {
        return $this->belongsTo(Plant::class);
    }

    public function stage(): BelongsTo
    {
        return $this->belongsTo(PlantGrowthStage::class, 'stage_id');
    }
}
