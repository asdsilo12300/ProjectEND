<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DailyLogin extends Model
{
    public $timestamps = false;

    protected $fillable = ['user_id', 'login_date', 'streak_day', 'reward_claimed'];

    protected function casts(): array
    {
        return [
            'login_date' => 'date',
            'reward_claimed' => 'boolean',
        ];
    }
}
