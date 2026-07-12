<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SocialNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $notifications = SocialNotification::query()
            ->with(['actor', 'post.plantHistory.plant', 'post.simulator.plant', 'comment'])
            ->where('recipient_id', $request->user()->id)
            ->latest()
            ->limit(80)
            ->get()
            ->map(fn (SocialNotification $notification) => $this->payload($notification));

        return response()->json([
            'data' => $notifications,
            'unread_count' => $notifications->where('is_read', false)->count(),
            'server_time' => now()->toISOString(),
        ]);
    }

    public function read(Request $request, SocialNotification $notification): JsonResponse
    {
        abort_unless($notification->recipient_id === $request->user()->id, 403);

        if (! $notification->read_at) {
            $notification->forceFill(['read_at' => now()])->save();
        }

        return response()->json(['data' => $this->payload($notification->loadMissing(['actor', 'post', 'comment']))]);
    }

    private function payload(SocialNotification $notification): array
    {
        $post = $notification->post;
        $plantName = $post?->plantHistory?->plant?->name_en
            ?? $post?->simulator?->plant?->name_en
            ?? 'plant update';

        return [
            'id' => $notification->id,
            'type' => $notification->type,
            'excerpt' => $notification->excerpt,
            'read_at' => $notification->read_at?->toISOString(),
            'is_read' => (bool) $notification->read_at,
            'created_at' => $notification->created_at?->toISOString(),
            'plant_name' => $plantName,
            'post_id' => $notification->post_id,
            'comment_id' => $notification->comment_id,
            'actor' => $notification->actor ? [
                'id' => $notification->actor->id,
                'username' => $notification->actor->username,
                'avatar_url' => $notification->actor->avatar_url,
                'level' => $notification->actor->level,
            ] : null,
        ];
    }
}
