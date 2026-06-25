<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Content extends Model
{
    protected $fillable = ['slug', 'title', 'body', 'source_code', 'status'];
}
