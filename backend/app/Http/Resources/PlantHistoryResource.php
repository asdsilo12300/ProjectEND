<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PlantHistoryResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'simulator_id' => $this->simulator_id,
            'user_id' => $this->user_id,
            'plant_id' => $this->plant_id,
            'plant' => new PlantResource($this->whenLoaded('plant')),
            'final_stage_id' => $this->final_stage_id,
            'final_stage' => $this->whenLoaded('finalStage', fn () => new PlantStageResource($this->finalStage)),
            'final_health' => (int) $this->final_health,
            'health' => (int) $this->final_health,
            'total_score' => (int) $this->total_score,
            'duration_days' => (int) $this->duration_days,
            'duration_seconds' => $this->duration_seconds === null
                ? max(0, (int) $this->duration_days * 86400)
                : max(0, (int) $this->duration_seconds),
            'visibility' => $this->visibility,
            'snapshot_image_url' => $this->snapshot_image_url,
            'game_state' => $this->game_state,
            'analysis_result' => $this->analysis_result,
            'direction' => $this->direction,
            'created_at' => $this->created_at?->toISOString(),
        ];
    }
}
