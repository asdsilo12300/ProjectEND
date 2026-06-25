<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class UserQuest extends Model
{
    protected $fillable = ['user_id', 'quest_id', 'progress', 'status', 'completed_at'];

    protected function casts(): array
    {
        return ['completed_at' => 'datetime'];
    }

    public function quest(): BelongsTo
    {
        return $this->belongsTo(Quest::class);
    }
}
