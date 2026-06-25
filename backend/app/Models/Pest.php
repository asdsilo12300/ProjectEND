<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Pest extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'name_th',
        'name_en',
        'description',
        'image_url',
        'model_url',
        'base_chance',
        'damage_per_turn',
        'behavior',
    ];

    protected function casts(): array
    {
        return [
            'base_chance' => 'decimal:2',
            'damage_per_turn' => 'integer',
        ];
    }

    public function conditionRules(): HasMany
    {
        return $this->hasMany(PestConditionRule::class);
    }
}
