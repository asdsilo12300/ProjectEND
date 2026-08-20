<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SimulationModifier extends Model
{
    protected $fillable = [
        'simulator_id', 'simulation_action_id', 'simulation_event_id', 'factor_key',
        'add_value', 'multiply_value', 'starts_tick', 'ends_tick', 'expires_at',
    ];

    protected function casts(): array
    {
        return [
            'add_value' => 'float', 'multiply_value' => 'float',
            'starts_tick' => 'integer', 'ends_tick' => 'integer',
            'expires_at' => 'immutable_datetime',
        ];
    }

    public function scopeActiveAt(Builder $query, int $tick): Builder
    {
        return $query
            ->where('starts_tick', '<=', $tick)
            ->where(function (Builder $query) use ($tick): void {
                $query
                    ->where(function (Builder $timed): void {
                        $timed->whereNotNull('expires_at')->where('expires_at', '>', now());
                    })
                    ->orWhere(function (Builder $legacy) use ($tick): void {
                        $legacy->whereNull('expires_at')
                            ->where(fn (Builder $ends) => $ends->whereNull('ends_tick')->orWhere('ends_tick', '>=', $tick));
                    });
            });
    }

    public function isActiveAt(int $tick): bool
    {
        if ((int) $this->starts_tick > $tick) return false;
        if ($this->expires_at !== null) return $this->expires_at->isFuture();

        return $this->ends_tick === null || (int) $this->ends_tick >= $tick;
    }

    public function simulator(): BelongsTo { return $this->belongsTo(Simulator::class); }
    public function action(): BelongsTo { return $this->belongsTo(SimulationAction::class, 'simulation_action_id'); }
    public function event(): BelongsTo { return $this->belongsTo(SimulationEvent::class, 'simulation_event_id'); }
}
