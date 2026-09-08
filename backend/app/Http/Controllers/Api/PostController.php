<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\PostResource;
use App\Models\Comment;
use App\Models\CommentLike;
use App\Models\CommentReport;
use App\Models\Friendship;
use App\Models\PlantHistory;
use App\Models\Post;
use App\Models\PostLike;
use App\Models\SocialNotification;
use App\Services\JwtService;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Str;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\Rule;
use Throwable;

class PostController extends Controller
{
    public function index(Request $request): AnonymousResourceCollection
    {
        return PostResource::collection($this->feedQuery($this->viewerId($request))
            ->where('visibility', 'public')
            ->latest()
            ->paginate($this->perPage($request)));
    }

    public function friends(Request $request): AnonymousResourceCollection
    {
        $user = $request->user();
        $friendIds = Friendship::query()
            ->where('status', 'accepted')
            ->where(function ($query) use ($user): void {
                $query
                    ->where('requester_id', $user->id)
                    ->orWhere('addressee_id', $user->id);
            })
            ->get(['requester_id', 'addressee_id'])
            ->map(fn (Friendship $friendship) => $friendship->requester_id === $user->id ? $friendship->addressee_id : $friendship->requester_id)
            ->all();

        $friendIds[] = $user->id;
        $friendIds = array_values(array_unique(array_map('intval', $friendIds)));

        return PostResource::collection($this->feedQuery((int) $user->id)
            ->whereIn('user_id', $friendIds)
            ->whereIn('visibility', ['public', 'friends'])
            ->latest()
            ->paginate($this->perPage($request)));
    }

    public function store(Request $request): PostResource
    {
        $data = $request->validate([
            'plant_history_id' => ['nullable', 'exists:plant_histories,id'],
            'caption' => ['nullable', 'string'],
            'visibility' => ['nullable', Rule::in(['private', 'friends', 'public'])],
        ]);

        if (! empty($data['plant_history_id'])) {
            PlantHistory::query()
                ->where('id', $data['plant_history_id'])
                ->where('user_id', $request->user()->id)
                ->firstOrFail();
        }

        if (! empty($data['plant_history_id'])) {
            $post = Post::query()->updateOrCreate(
                [
                    'user_id' => $request->user()->id,
                    'plant_history_id' => $data['plant_history_id'],
                ],
                [
                    'caption' => $data['caption'] ?? null,
                    'visibility' => $data['visibility'] ?? 'public',
                ],
            );
        } else {
            $post = Post::query()->create([
                'user_id' => $request->user()->id,
                'plant_history_id' => null,
                'caption' => $data['caption'] ?? null,
                'visibility' => $data['visibility'] ?? 'public',
            ]);
        }

        $post->load($this->feedRelations())->loadCount(['comments', 'likes']);

        return new PostResource($post);
    }

    public function comment(Request $request, Post $post): JsonResponse
    {
        $data = $request->validate([
            'comment_text' => ['required', 'string', 'max:280'],
        ]);

        $comment = Comment::query()->create([
            'post_id' => $post->id,
            'user_id' => $request->user()->id,
            'comment_text' => $data['comment_text'],
            'status' => 'visible',
        ]);

        $this->notify(
            recipientId: (int) $post->user_id,
            actorId: (int) $request->user()->id,
            type: 'comment',
            post: $post,
            comment: $comment,
            excerpt: $data['comment_text'],
        );

        return response()->json([
            'data' => $this->commentPayload($comment->load(['user', 'likes', 'replies']), $request->user()->id),
            'comments_count' => $post->comments()->count(),
        ], 201);
    }

    public function reply(Request $request, Post $post, Comment $comment): JsonResponse
    {
        abort_unless((int) $comment->post_id === (int) $post->id, 404);

        $data = $request->validate([
            'comment_text' => ['required', 'string', 'max:280'],
        ]);

        $reply = Comment::query()->create([
            'post_id' => $post->id,
            'user_id' => $request->user()->id,
            'parent_id' => $comment->id,
            'comment_text' => $data['comment_text'],
            'status' => 'visible',
        ]);

        $this->notify(
            recipientId: (int) ($comment->user_id ?: $post->user_id),
            actorId: (int) $request->user()->id,
            type: 'reply',
            post: $post,
            comment: $reply,
            excerpt: $data['comment_text'],
        );

        return response()->json([
            'data' => $this->commentPayload($reply->load(['user', 'likes', 'replies']), $request->user()->id),
            'parent_id' => $comment->id,
            'comments_count' => $post->comments()->count(),
        ], 201);
    }

    public function reportComment(Request $request, Post $post, Comment $comment): JsonResponse
    {
        abort_unless((int) $comment->post_id === (int) $post->id, 404);
        abort_if((int) $comment->user_id === (int) $request->user()->id, 422, 'You cannot report your own comment.');

        $data = $request->validate([
            'reason' => ['required', Rule::in(['inappropriate', 'other'])],
            'details' => ['nullable', 'string', 'max:500', Rule::requiredIf(fn () => $request->input('reason') === 'other')],
        ]);

        $report = CommentReport::query()->updateOrCreate(
            [
                'reporter_id' => $request->user()->id,
                'comment_type' => 'post',
                'comment_id' => $comment->id,
            ],
            [
                'reason' => $data['reason'],
                'details' => trim((string) ($data['details'] ?? '')) ?: null,
                'status' => 'pending',
            ],
        );

        return response()->json(['data' => $report, 'message' => 'Comment reported.'], $report->wasRecentlyCreated ? 201 : 200);
    }

    public function comments(Request $request, Post $post): JsonResponse
    {
        $comments = $post->comments()
            ->with([
                'user',
                'likes',
                'replies.user',
                'replies.likes',
                'replies.replies.user',
                'replies.replies.likes',
            ])
            ->where('status', 'visible')
            ->whereNull('parent_id')
            ->oldest()
            ->get()
            ->map(fn (Comment $comment) => $this->commentPayload($comment, $request->user()?->id))
            ->values();

        return response()->json(['data' => $comments]);
    }

    public function like(Request $request, Post $post): JsonResponse
    {
        $like = PostLike::query()->firstOrCreate([
            'post_id' => $post->id,
            'user_id' => $request->user()->id,
        ]);

        if ($like->wasRecentlyCreated) {
            $this->notify(
                recipientId: (int) $post->user_id,
                actorId: (int) $request->user()->id,
                type: 'like',
                post: $post,
            );
        }

        return response()->json([
            'data' => $like,
            'liked_by_me' => true,
            'likes_count' => $post->likes()->count(),
        ], 201);
    }

    public function unlike(Request $request, Post $post): JsonResponse
    {
        PostLike::query()
            ->where('post_id', $post->id)
            ->where('user_id', $request->user()->id)
            ->delete();

        SocialNotification::query()
            ->where('recipient_id', $post->user_id)
            ->where('actor_id', $request->user()->id)
            ->where('post_id', $post->id)
            ->where('type', 'like')
            ->delete();

        return response()->json([
            'message' => 'Like removed.',
            'liked_by_me' => false,
            'likes_count' => $post->likes()->count(),
        ]);
    }

    public function likeComment(Request $request, Post $post, Comment $comment): JsonResponse
    {
        abort_unless((int) $comment->post_id === (int) $post->id, 404);

        $like = CommentLike::query()->firstOrCreate([
            'comment_id' => $comment->id,
            'user_id' => $request->user()->id,
        ]);

        if ($like->wasRecentlyCreated) {
            $this->notify(
                recipientId: (int) $comment->user_id,
                actorId: (int) $request->user()->id,
                type: 'comment_like',
                post: $post,
                comment: $comment,
                excerpt: $comment->comment_text,
            );
        }

        return response()->json([
            'data' => $like,
            'liked_by_me' => true,
            'likes_count' => $comment->likes()->count(),
        ], 201);
    }

    public function unlikeComment(Request $request, Post $post, Comment $comment): JsonResponse
    {
        abort_unless((int) $comment->post_id === (int) $post->id, 404);

        CommentLike::query()
            ->where('comment_id', $comment->id)
            ->where('user_id', $request->user()->id)
            ->delete();

        SocialNotification::query()
            ->where('recipient_id', $comment->user_id)
            ->where('actor_id', $request->user()->id)
            ->where('comment_id', $comment->id)
            ->where('type', 'comment_like')
            ->delete();

        return response()->json([
            'message' => 'Like removed.',
            'liked_by_me' => false,
            'likes_count' => $comment->likes()->count(),
        ]);
    }

    private function commentPayload(Comment $comment, ?int $viewerId = null): array
    {
        $likes = $comment->relationLoaded('likes') ? $comment->likes : $comment->likes()->get();
        $replies = $comment->relationLoaded('replies') ? $comment->replies : collect();

        return [
            'id' => $comment->id,
            'post_id' => $comment->post_id,
            'parent_id' => $comment->parent_id,
            'comment_text' => $comment->comment_text,
            'created_at' => $comment->created_at,
            'likes_count' => $likes->count(),
            'liked_by_me' => $viewerId ? $likes->contains('user_id', $viewerId) : false,
            'reported_by_me' => $viewerId && Schema::hasTable('comment_reports')
                ? $comment->reports()->where('reporter_id', $viewerId)->exists()
                : false,
            'replies' => $replies
                ->where('status', 'visible')
                ->sortBy('created_at')
                ->values()
                ->map(fn (Comment $reply) => $this->commentPayload($reply, $viewerId))
                ->all(),
            'user' => [
                'id' => $comment->user?->id,
                'username' => $comment->user?->username,
                'avatar_url' => $comment->user?->avatar_url,
                'level' => $comment->user?->level,
            ],
        ];
    }

    private function notify(int $recipientId, int $actorId, string $type, Post $post, ?Comment $comment = null, ?string $excerpt = null): void
    {
        if ($recipientId === $actorId) {
            return;
        }

        SocialNotification::query()->create([
            'recipient_id' => $recipientId,
            'actor_id' => $actorId,
            'post_id' => $post->id,
            'comment_id' => $comment?->id,
            'type' => $type,
            'excerpt' => $excerpt ? Str::limit(trim($excerpt), 220) : null,
        ]);
    }

    private function feedQuery(?int $viewerId): Builder
    {
        return Post::query()
            ->with($this->feedRelations())
            ->withCount(['comments', 'likes'])
            ->when($viewerId, fn (Builder $query, int $id) => $query->withExists([
                'likes as liked_by_me' => fn (Builder $likes) => $likes->where('user_id', $id),
            ]));
    }

    private function feedRelations(): array
    {
        return [
            'user' => fn ($query) => $query->withCount([
                'plantHistories',
                'requestedFriendships as accepted_requested_friendships_count' => fn (Builder $friendships) => $friendships->where('status', 'accepted'),
                'receivedFriendships as accepted_received_friendships_count' => fn (Builder $friendships) => $friendships->where('status', 'accepted'),
            ]),
            'plantHistory' => fn ($query) => $query->with(['plant.stages', 'finalStage']),
            'simulator.plant',
        ];
    }

    private function viewerId(Request $request): ?int
    {
        if ($request->user()) {
            return (int) $request->user()->id;
        }

        $token = $request->bearerToken();
        if (! $token) {
            return null;
        }

        try {
            return app(JwtService::class)->userIdFromToken($token);
        } catch (Throwable) {
            return null;
        }
    }

    private function perPage(Request $request): int
    {
        return max(1, min(30, (int) $request->integer('per_page', 15)));
    }
}
