<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserItem extends Model
{
    public const CREATED_AT = null;

    protected $fillable = ['user_id', 'item_id', 'quantity'];

    public function item(): BelongsTo
    {
        return $this->belongsTo(Item::class);
    }
}
