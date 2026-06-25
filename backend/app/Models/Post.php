<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class Post extends Model
{
    use SoftDeletes;

    protected $fillable = ['user_id', 'plant_history_id', 'caption', 'visibility'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function plantHistory(): BelongsTo
    {
        return $this->belongsTo(PlantHistory::class);
    }

    public function comments(): HasMany
    {
        return $this->hasMany(Comment::class);
    }

    public function likes(): HasMany
    {
        return $this->hasMany(PostLike::class);
    }
}
