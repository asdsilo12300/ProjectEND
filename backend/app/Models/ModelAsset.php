<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class ModelAsset extends Model
{
    protected $fillable = [
        'asset_key',
        'label',
        'type',
        'url',
        'metadata',
    ];

    protected function casts(): array
    {
        return [
            'metadata' => 'array',
        ];
    }
}
