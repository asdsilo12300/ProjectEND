<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class PlantKnowledge extends Model
{
    use SoftDeletes;

    protected $table = 'plant_knowledge';

    protected $fillable = [
        'plant_id',
        'scientific_name',
        'family',
        'category_en',
        'category_th',
        'summary_en',
        'summary_th',
        'care_en',
        'care_th',
        'caution_en',
        'caution_th',
        'photo_url',
        'photo_alt_en',
        'photo_alt_th',
        'photo_credit',
        'photo_source_url',
        'photo_license',
        'photo_license_url',
        'sources',
    ];

    protected function casts(): array
    {
        return [
            'care_en' => 'array',
            'care_th' => 'array',
            'sources' => 'array',
        ];
    }

    public function plant(): BelongsTo
    {
        return $this->belongsTo(Plant::class)->withTrashed();
    }
}
