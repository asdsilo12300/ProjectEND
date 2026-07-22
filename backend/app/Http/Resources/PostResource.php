<?php

namespace App\Http\Resources;

use App\Models\User;
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
            'user' => $this->user ? $this->postUserPayload($this->user) : null,
            'plant_history_id' => $this->plant_history_id,
            'plant_history' => $this->whenLoaded('plantHistory', fn () => new PlantHistoryResource($this->plantHistory)),
            'simulator_id' => $this->simulator_id,
            'live_simulator' => $this->whenLoaded('simulator', fn () => $this->simulator ? [
                'id' => $this->simulator->id,
                'status' => $this->simulator->status,
                'share_visibility' => $this->simulator->share_visibility ?? 'private',
                'state_version' => (int) ($this->simulator->state_version ?? 1),
                'growth_point' => (float) $this->simulator->growth_point,
                'health' => (int) $this->simulator->health,
                'visual_state' => $this->simulator->visual_state,
                'updated_at' => $this->simulator->updated_at,
                'snapshot_image_url' => $this->publicUrl($this->simulator->live_snapshot_url),
                'plant' => $this->simulator->plant ? [
                    'id' => $this->simulator->plant->id,
                    'name_en' => $this->simulator->plant->name_en,
                    'image_url' => $this->simulator->plant->image_url,
                ] : null,
            ] : null),
            'comments_count' => $this->comments_count ?? null,
            'likes_count' => $this->likes_count ?? null,
            'liked_by_me' => (bool) ($this->liked_by_me ?? false),
            'created_at' => $this->created_at,
        ];
    }

    private function postUserPayload(User $user): array
    {
        return [
            'id' => $user->id,
            'username' => $user->username,
            'email' => $user->email,
            'avatar_url' => $user->avatar_url,
            'cover_url' => $user->cover_url,
            'bio' => $user->bio,
            'level' => $user->level,
            'experience' => $user->experience,
            'level_progress' => $user->levelProgress(),
            'friends_count' => (int) ($user->accepted_requested_friendships_count ?? 0)
                + (int) ($user->accepted_received_friendships_count ?? 0),
            'plant_histories_count' => (int) ($user->plant_histories_count ?? 0),
            'plants_count' => (int) ($user->plant_histories_count ?? 0),
        ];
    }

    private function publicUrl(?string $path): ?string
    {
        if (! $path) return null;
        if (str_starts_with($path, 'http://') || str_starts_with($path, 'https://') || str_starts_with($path, '/')) return $path;

        return '/storage/'.ltrim($path, '/');
    }
}
