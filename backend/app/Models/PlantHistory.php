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
        'game_state',
        'analysis_result',
        'direction',
    ];

    protected function casts(): array
    {
        return ['game_state' => 'array'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function plant(): BelongsTo
    {
        return $this->belongsTo(Plant::class)->withTrashed();
    }

    public function finalStage(): BelongsTo
    {
        return $this->belongsTo(PlantGrowthStage::class, 'final_stage_id')->withTrashed();
    }
}
