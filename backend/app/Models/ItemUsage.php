<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ItemUsage extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = ['user_id', 'item_id', 'simulator_id', 'quantity', 'effect_result'];
}
