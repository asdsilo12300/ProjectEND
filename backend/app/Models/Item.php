<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Item extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'name',
        'type',
        'description',
        'image_url',
        'effect_type',
        'effect_value',
        'rarity',
        'is_active',
        'action_key',
        'mode_scope',
        'effect_payload',
        'animation_key',
    ];

    protected function casts(): array
    {
        return ['is_active' => 'boolean', 'effect_payload' => 'array'];
    }
}
