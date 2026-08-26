<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SocialNotification extends Model
{
    protected $fillable = [
        'recipient_id',
        'actor_id',
        'post_id',
        'comment_id',
        'simulator_id',
        'simulator_comment_id',
        'type',
        'excerpt',
        'read_at',
    ];

    protected function casts(): array
    {
        return ['read_at' => 'datetime'];
    }

    public function recipient(): BelongsTo
    {
        return $this->belongsTo(User::class, 'recipient_id');
    }

    public function actor(): BelongsTo
    {
        return $this->belongsTo(User::class, 'actor_id');
    }

    public function post(): BelongsTo
    {
        return $this->belongsTo(Post::class);
    }

    public function comment(): BelongsTo
    {
        return $this->belongsTo(Comment::class);
    }

    public function simulator(): BelongsTo
    {
        return $this->belongsTo(Simulator::class);
    }

    public function simulatorComment(): BelongsTo
    {
        return $this->belongsTo(SimulatorComment::class);
    }
}
