<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class Comment extends Model
{
    use SoftDeletes;

    protected $fillable = ['post_id', 'user_id', 'comment_text', 'status'];

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
