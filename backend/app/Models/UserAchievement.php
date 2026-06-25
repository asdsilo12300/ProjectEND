<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class UserAchievement extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = ['user_id', 'achievement_id', 'unlocked_at'];

    protected function casts(): array
    {
        return ['unlocked_at' => 'datetime'];
    }
}
