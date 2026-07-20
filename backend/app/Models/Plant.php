<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Plant extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'name_th',
        'name_en',
        'description',
        'base_image_url',
        'base_model_url',
        'water_min',
        'water_max',
        'light_min',
        'light_max',
        'fertilizer_min',
        'fertilizer_max',
        'soil_humidity_min',
        'soil_humidity_max',
        'air_humidity_min',
        'air_humidity_max',
        'soil_temp_min',
        'soil_temp_max',
        'air_temp_min',
        'air_temp_max',
    ];

    protected function casts(): array
    {
        return [
            'soil_temp_min' => 'decimal:2',
            'soil_temp_max' => 'decimal:2',
            'air_temp_min' => 'decimal:2',
            'air_temp_max' => 'decimal:2',
        ];
    }

    public function stages(): HasMany
    {
        return $this->hasMany(PlantGrowthStage::class)->orderBy('stage_no');
    }

    public function visualVariants(): HasMany
    {
        return $this->hasMany(PlantVisualVariant::class);
    }

    public function conditionRules(): HasMany
    {
        return $this->hasMany(PlantConditionRule::class);
    }

    /**
     * Only plants with a base model plus a complete 0-100 growth track are
     * safe to expose to the simulation UI.
     */
    public function scopePlayable(Builder $query): Builder
    {
        return $query
            ->whereNotNull('base_model_url')
            ->where('base_model_url', '<>', '')
            ->whereHas('stages', fn (Builder $stages): Builder => $stages->where('required_growth_point', '<=', 0))
            ->whereHas('stages', fn (Builder $stages): Builder => $stages->where('required_growth_point', '>=', 100));
    }
}
