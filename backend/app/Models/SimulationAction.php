<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class SimulationAction extends Model
{
    protected $fillable = [
        'simulator_id', 'user_id', 'item_id', 'simulation_event_id', 'client_action_id',
        'action_key', 'animation_key', 'status', 'target_value', 'request_payload',
        'result_payload', 'message_code', 'applied_at',
    ];

    protected function casts(): array
    {
        return ['request_payload' => 'array', 'result_payload' => 'array', 'applied_at' => 'datetime'];
    }

    public function simulator(): BelongsTo { return $this->belongsTo(Simulator::class); }
    public function item(): BelongsTo { return $this->belongsTo(Item::class)->withTrashed(); }
    public function event(): BelongsTo { return $this->belongsTo(SimulationEvent::class, 'simulation_event_id'); }
    public function modifiers(): HasMany { return $this->hasMany(SimulationModifier::class); }
}
