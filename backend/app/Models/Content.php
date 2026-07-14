<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Content extends Model
{
    protected $fillable = [
        'slug',
        'category',
        'icon',
        'eyebrow',
        'eyebrow_th',
        'title',
        'title_th',
        'summary',
        'summary_th',
        'body_html',
        'body_html_th',
        'cover_image_url',
        'cover_image_alt',
        'cover_image_alt_th',
        'image_credit',
        'image_credit_url',
        'references',
        'reading_minutes',
        'sort_order',
        'version',
        'source_code',
        'status',
        'published_at',
    ];

    protected function casts(): array
    {
        return [
            'references' => 'array',
            'published_at' => 'datetime',
            'reading_minutes' => 'integer',
            'sort_order' => 'integer',
            'version' => 'integer',
        ];
    }
}
