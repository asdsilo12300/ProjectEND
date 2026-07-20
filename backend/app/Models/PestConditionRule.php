<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class PestConditionRule extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'pest_id',
        'plant_id',
        'factor',
        'operator',
        'min_value',
        'max_value',
        'chance_delta',
        'severity',
        'is_active',
    ];

    protected function casts(): array
    {
        return [
            'min_value' => 'decimal:2',
            'max_value' => 'decimal:2',
            'chance_delta' => 'decimal:2',
            'severity' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    public function pest(): BelongsTo
    {
        return $this->belongsTo(Pest::class)->withTrashed();
    }

    public function plant(): BelongsTo
    {
        return $this->belongsTo(Plant::class)->withTrashed();
    }
}
