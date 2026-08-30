<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class PestKnowledge extends Model
{
    use SoftDeletes;

    protected $table = 'pest_knowledge';

    protected $fillable = [
        'pest_id',
        'scientific_name',
        'family',
        'category_en',
        'category_th',
        'summary_en',
        'summary_th',
        'signs_en',
        'signs_th',
        'favorable_conditions_en',
        'favorable_conditions_th',
        'prevention_en',
        'prevention_th',
        'photo_url',
        'photo_source_url',
        'treatment_action_keys',
        'sources',
    ];

    protected function casts(): array
    {
        return [
            'signs_en' => 'array',
            'signs_th' => 'array',
            'favorable_conditions_en' => 'array',
            'favorable_conditions_th' => 'array',
            'prevention_en' => 'array',
            'prevention_th' => 'array',
            'treatment_action_keys' => 'array',
            'sources' => 'array',
        ];
    }

    public function pest(): BelongsTo
    {
        return $this->belongsTo(Pest::class)->withTrashed();
    }
}
