<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;
use Illuminate\Support\Str;

class PlantStageResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'stage_no' => $this->stage_no,
            'stage_name' => $this->stage_name,
            'required_growth_point' => $this->required_growth_point,
            'image_url' => $this->publicUrl($this->image_url),
            'model_url' => $this->publicUrl($this->model_url),
            'description' => $this->description,
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
