<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\PostResource;
use App\Models\Comment;
use App\Models\CommentLike;
use App\Models\Friendship;
use App\Models\PlantHistory;
use App\Models\Post;
use App\Models\PostLike;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Validation\Rule;

class PostController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        return PostResource::collection(
            Post::query()
                ->with(['user', 'plantHistory.plant.stages', 'plantHistory.finalStage'])
                ->withCount(['comments', 'likes'])
                ->where('visibility', 'public')
                ->latest()
                ->get()
        );
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
            ->get()
            ->map(fn (Friendship $friendship) => $friendship->requester_id === $user->id ? $friendship->addressee_id : $friendship->requester_id)
            ->push($user->id)
            ->unique()
            ->values()
            ->all();

        return PostResource::collection(
            Post::query()
                ->with(['user', 'plantHistory.plant.stages', 'plantHistory.finalStage'])
                ->withCount(['comments', 'likes'])
                ->whereIn('user_id', $friendIds)
                ->whereIn('visibility', ['public', 'friends'])
                ->latest()
                ->get()
        );
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

        return new PostResource($post->load(['user', 'plantHistory.plant.stages', 'plantHistory.finalStage']));
    }

    public function comment(Request $request, Post $post): JsonResponse
    {
        $data = $request->validate([
            'comment_text' => ['required', 'string'],
        ]);

        $comment = Comment::query()->create([
            'post_id' => $post->id,
            'user_id' => $request->user()->id,
            'comment_text' => $data['comment_text'],
            'status' => 'visible',
        ]);

        return response()->json([
            'data' => $this->commentPayload($comment->load(['user', 'likes', 'replies']), $request->user()->id),
            'comments_count' => $post->comments()->count(),
        ], 201);
    }

    public function reply(Request $request, Post $post, Comment $comment): JsonResponse
    {
        abort_unless((int) $comment->post_id === (int) $post->id, 404);

        $data = $request->validate([
            'comment_text' => ['required', 'string'],
        ]);

        $reply = Comment::query()->create([
            'post_id' => $post->id,
            'user_id' => $request->user()->id,
            'parent_id' => $comment->id,
            'comment_text' => $data['comment_text'],
            'status' => 'visible',
        ]);

        return response()->json([
            'data' => $this->commentPayload($reply->load(['user', 'likes', 'replies']), $request->user()->id),
            'parent_id' => $comment->id,
            'comments_count' => $post->comments()->count(),
        ], 201);
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
}
