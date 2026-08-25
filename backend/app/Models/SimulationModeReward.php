<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SimulationModeReward extends Model
{
    protected $fillable = [
        'mode',
        'name_en',
        'name_th',
        'experience_reward',
        'coin_reward',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'experience_reward' => 'integer',
            'coin_reward' => 'integer',
            'is_active' => 'boolean',
        ];
    }
}
