<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class SimulatorComment extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'simulator_id',
        'user_id',
        'comment_text',
        'status',
    ];

    public function simulator(): BelongsTo
    {
        return $this->belongsTo(Simulator::class);
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}