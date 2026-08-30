<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class AnimationPreset extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'key',
        'name_en',
        'name_th',
        'description_en',
        'description_th',
        'motion_type',
        'effect_type',
        'target_type',
        'duration_ms',
        'speed',
        'amplitude',
        'particle_color',
        'particle_count',
        'scale',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'duration_ms' => 'integer',
            'speed' => 'float',
            'amplitude' => 'float',
            'particle_count' => 'integer',
            'scale' => 'float',
            'is_active' => 'boolean',
        ];
    }

    public function items(): HasMany
    {
        return $this->hasMany(Item::class);
    }
}
