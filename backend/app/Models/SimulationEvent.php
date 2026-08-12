<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SimulationEvent extends Model
{
    protected $fillable = [
        'simulator_id', 'event_definition_id', 'status', 'announced_tick', 'starts_tick',
        'ends_tick', 'seed', 'effect_snapshot', 'resolved_at', 'resolved_by_action_key',
    ];

    protected function casts(): array
    {
        return ['effect_snapshot' => 'array', 'resolved_at' => 'datetime'];
    }

    public function simulator(): BelongsTo { return $this->belongsTo(Simulator::class); }
    public function definition(): BelongsTo { return $this->belongsTo(EventDefinition::class, 'event_definition_id')->withTrashed(); }
    public function modifiers(): HasMany { return $this->hasMany(SimulationModifier::class); }
}
