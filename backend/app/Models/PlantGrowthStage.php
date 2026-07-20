<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class PlantGrowthStage extends Model
{
    use SoftDeletes;

    public $timestamps = false;

    protected $fillable = [
        'plant_id',
        'stage_no',
        'stage_name',
        'required_growth_point',
        'image_url',
        'model_url',
        'description',
    ];

    public function plant(): BelongsTo
    {
        return $this->belongsTo(Plant::class)->withTrashed();
    }

    public function visualVariants(): HasMany
    {
        return $this->hasMany(PlantVisualVariant::class, 'stage_id');
    }
}
