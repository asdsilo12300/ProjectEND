<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Simulator extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'user_id',
        'plant_id',
        'mode',
        'location_name',
        'latitude',
        'longitude',
        'season',
        'growth_point',
        'current_stage_id',
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
        'status',
        'share_visibility',
        'state_version',
        'shared_at',
        'live_snapshot_url',
        'started_at',
        'ended_at',
        'maturity_reward_claimed_at',
        'maturity_reward_amount',
    ];

    protected function casts(): array
    {
        return [
            'latitude' => 'decimal:7',
            'longitude' => 'decimal:7',
            'soil_temp' => 'decimal:2',
            'air_temp' => 'decimal:2',
            'visual_overrides' => 'array',
            'started_at' => 'datetime',
            'ended_at' => 'datetime',
            'maturity_reward_claimed_at' => 'datetime',
            'maturity_reward_amount' => 'integer',
            'state_version' => 'integer',
            'shared_at' => 'datetime',
        ];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function plant(): BelongsTo
    {
        return $this->belongsTo(Plant::class)->withTrashed();
    }

    public function currentStage(): BelongsTo
    {
        return $this->belongsTo(PlantGrowthStage::class, 'current_stage_id')->withTrashed();
    }

    public function visualVariant(): BelongsTo
    {
        return $this->belongsTo(PlantVisualVariant::class, 'visual_variant_id')->withTrashed();
    }

    public function logs(): HasMany
    {
        return $this->hasMany(SimulationLog::class);
    }

    public function activePests(): HasMany
    {
        return $this->hasMany(SimulationPest::class)->where('status', 'active')->with('pest');
    }

    public function posts(): HasMany
    {
        return $this->hasMany(Post::class);
    }
}
