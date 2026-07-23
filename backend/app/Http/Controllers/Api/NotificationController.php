<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\SocialNotification;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    private const COMMUNITY_TYPES = ['like', 'comment', 'reply', 'comment_like'];

    public function index(Request $request): JsonResponse
    {
        $unreadCounts = SocialNotification::query()
            ->where('recipient_id', $request->user()->id)
            ->whereNull('read_at')
            ->selectRaw('COUNT(*) as total')
            ->selectRaw(
                'SUM(CASE WHEN type IN (?, ?, ?, ?) THEN 1 ELSE 0 END) as community',
                self::COMMUNITY_TYPES,
            )
            ->first();
        $totalUnread = (int) ($unreadCounts?->total ?? 0);
        $communityUnread = (int) ($unreadCounts?->community ?? 0);

        $notifications = SocialNotification::query()
            ->with(['actor', 'post.plantHistory.plant', 'post.simulator.plant', 'comment'])
            ->where('recipient_id', $request->user()->id)
            ->latest()
            ->limit(80)
            ->get()
            ->map(fn (SocialNotification $notification) => $this->payload($notification));

        return response()->json([
            'data' => $notifications,
            'unread_count' => $totalUnread,
            'unread_counts' => [
                'community' => $communityUnread,
                'game' => max(0, $totalUnread - $communityUnread),
            ],
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
            'category' => in_array($notification->type, self::COMMUNITY_TYPES, true) ? 'community' : 'game',
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
