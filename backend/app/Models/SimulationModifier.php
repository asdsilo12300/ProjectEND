<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class SimulationModifier extends Model
{
    protected $fillable = [
        'simulator_id', 'simulation_action_id', 'simulation_event_id', 'factor_key',
        'add_value', 'multiply_value', 'starts_tick', 'ends_tick',
    ];

    protected function casts(): array
    {
        return ['add_value' => 'float', 'multiply_value' => 'float', 'starts_tick' => 'integer', 'ends_tick' => 'integer'];
    }

    public function simulator(): BelongsTo { return $this->belongsTo(Simulator::class); }
    public function action(): BelongsTo { return $this->belongsTo(SimulationAction::class, 'simulation_action_id'); }
    public function event(): BelongsTo { return $this->belongsTo(SimulationEvent::class, 'simulation_event_id'); }
}
