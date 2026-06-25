<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SimulationPest extends Model
{
    public $timestamps = false;

    protected $fillable = [
        'simulator_id',
        'pest_id',
        'status',
        'appeared_at',
        'treated_at',
    ];

    protected function casts(): array
    {
        return [
            'appeared_at' => 'datetime',
            'treated_at' => 'datetime',
        ];
    }

    public function simulator(): BelongsTo
    {
        return $this->belongsTo(Simulator::class);
    }

    public function pest(): BelongsTo
    {
        return $this->belongsTo(Pest::class);
    }
}
