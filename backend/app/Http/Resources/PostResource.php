<?php

namespace App\Http\Resources;

use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\JsonResource;

class PostResource extends JsonResource
{
    public function toArray(Request $request): array
    {
        return [
            'id' => $this->id,
            'caption' => $this->caption,
            'visibility' => $this->visibility,
            'user' => [
                'id' => $this->user?->id,
                'username' => $this->user?->username,
                'avatar_url' => $this->user?->avatar_url,
            ],
            'plant_history_id' => $this->plant_history_id,
            'comments_count' => $this->comments_count ?? null,
            'likes_count' => $this->likes_count ?? null,
            'created_at' => $this->created_at,
        ];
    }
}
