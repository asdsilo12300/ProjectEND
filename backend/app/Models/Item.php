<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

class Item extends Model
{
    use SoftDeletes;

    private ?Pest $resolvedPrankPest = null;
    private bool $prankPestResolved = false;

    protected $fillable = [
        'name',
        'type',
        'description',
        'image_url',
        'model_url',
        'effect_type',
        'effect_value',
        'rarity',
        'is_active',
        'action_key',
        'mode_scope',
        'effect_payload',
        'animation_key',
        'animation_preset_id',
    ];

    protected function casts(): array
    {
        return ['is_active' => 'boolean', 'effect_payload' => 'array'];
    }

    public function typeDefinition(): BelongsTo
    {
        return $this->belongsTo(ItemType::class, 'type', 'key');
    }

    public function animationPreset(): BelongsTo
    {
        return $this->belongsTo(AnimationPreset::class);
    }

    public function getImageUrlAttribute(?string $storedValue): ?string
    {
        return $this->linkedPrankPest()?->image_url ?: $storedValue;
    }

    public function getModelUrlAttribute(?string $storedValue): ?string
    {
        return $this->linkedPrankPest()?->model_url ?: $storedValue;
    }

    private function linkedPrankPest(): ?Pest
    {
        if ($this->prankPestResolved) return $this->resolvedPrankPest;

        $this->prankPestResolved = true;
        if (($this->attributes['type'] ?? null) !== 'prank') return null;

        $payload = $this->effect_payload;
        $pestId = is_array($payload) ? ($payload['pest_id'] ?? null) : null;
        $this->resolvedPrankPest = $pestId ? Pest::query()->find($pestId) : null;

        return $this->resolvedPrankPest;
    }
}
