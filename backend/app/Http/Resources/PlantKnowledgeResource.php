<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Str;

class PlantKnowledgeResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        $photo = $this->photo_url ? [
            'url' => $this->publicUrl($this->photo_url),
            'alt' => $this->photo_alt_en,
            'alt_th' => $this->photo_alt_th,
            'credit' => $this->photo_credit,
            'source_url' => $this->photo_source_url,
            'license' => $this->photo_license,
            'license_url' => $this->photo_license_url,
        ] : null;

        return [
            'id' => $this->id,
            'plant_id' => $this->plant_id,
            'scientific_name' => $this->scientific_name,
            'family' => $this->family,
            'category' => $this->category_en,
            'category_th' => $this->category_th,
            'summary' => $this->summary_en,
            'summary_th' => $this->summary_th,
            'care' => $this->care_en ?? [],
            'care_th' => $this->care_th ?? [],
            'caution' => $this->caution_en,
            'caution_th' => $this->caution_th,
            'photo' => $photo,
            'sources' => collect($this->sources ?? [])->map(function (array $source): array {
                return [
                    'label' => $source['label_en'] ?? $source['label'] ?? null,
                    'label_th' => $source['label_th'] ?? $source['labelTh'] ?? null,
                    'url' => $source['url'] ?? null,
                ];
            })->filter(fn (array $source): bool => filled($source['url']))->values()->all(),
        ];
    }

    private function publicUrl(?string $path): ?string
    {
        if (! $path) {
            return null;
        }

        if (Str::startsWith($path, ['http://', 'https://', '/'])) {
            return $path;
        }

        return '/storage/' . ltrim($path, '/');
    }
}
