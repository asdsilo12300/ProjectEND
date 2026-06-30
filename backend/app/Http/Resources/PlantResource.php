<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Str;

class PlantResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'name_th' => $this->name_th,
            'name_en' => $this->name_en,
            'description' => $this->description,
            'base_image_url' => $this->publicUrl($this->base_image_url),
            'base_model_url' => $this->publicUrl($this->base_model_url),
            'environment' => [
                'water' => ['min' => $this->water_min, 'max' => $this->water_max],
                'light' => ['min' => $this->light_min, 'max' => $this->light_max],
                'fertilizer' => ['min' => $this->fertilizer_min, 'max' => $this->fertilizer_max],
                'soil_humidity' => ['min' => $this->soil_humidity_min, 'max' => $this->soil_humidity_max],
                'air_humidity' => ['min' => $this->air_humidity_min, 'max' => $this->air_humidity_max],
                'soil_temp' => ['min' => (float) $this->soil_temp_min, 'max' => (float) $this->soil_temp_max],
                'air_temp' => ['min' => (float) $this->air_temp_min, 'max' => (float) $this->air_temp_max],
            ],
            'stages' => PlantStageResource::collection($this->whenLoaded('stages')),
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
