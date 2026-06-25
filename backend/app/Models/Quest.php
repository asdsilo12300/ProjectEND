<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Quest extends Model
{
    protected $fillable = [
        'title',
        'description',
        'quest_type',
        'target_type',
        'target_value',
        'reward_exp',
        'reward_coin',
        'reward_gem',
        'is_active',
    ];

    protected function casts(): array
    {
        return ['is_active' => 'boolean'];
    }
}
