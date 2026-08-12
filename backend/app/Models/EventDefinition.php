<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

class EventDefinition extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'event_key', 'name_en', 'name_th', 'description_en', 'description_th',
        'mode_scope', 'severity', 'weight', 'trigger_chance', 'warning_ticks',
        'duration_ticks', 'cooldown_ticks', 'conditions', 'effects',
        'response_action_keys', 'is_harmful', 'is_active',
    ];

    protected function casts(): array
    {
        return [
            'conditions' => 'array', 'effects' => 'array', 'response_action_keys' => 'array',
            'is_harmful' => 'boolean', 'is_active' => 'boolean',
            'weight' => 'integer', 'trigger_chance' => 'integer', 'warning_ticks' => 'integer',
            'duration_ticks' => 'integer', 'cooldown_ticks' => 'integer',
        ];
    }

    public function simulationEvents(): HasMany
    {
        return $this->hasMany(SimulationEvent::class);
    }
}
