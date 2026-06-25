<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class PostLike extends Model
{
    public const UPDATED_AT = null;

    protected $fillable = ['post_id', 'user_id'];
}
