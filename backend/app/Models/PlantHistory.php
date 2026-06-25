<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class PlantHistory extends Model
{
    use SoftDeletes;

    public const UPDATED_AT = null;

    protected $fillable = [
        'simulator_id',
        'user_id',
        'plant_id',
        'final_stage_id',
        'final_health',
        'total_score',
        'duration_days',
        'visibility',
        'snapshot_image_url',
        'analysis_result',
        'direction',
    ];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function plant(): BelongsTo
    {
        return $this->belongsTo(Plant::class);
    }
}
