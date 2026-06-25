<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\PostResource;
use App\Models\Comment;
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
                ->with('user')
                ->withCount(['comments', 'likes'])
                ->where('visibility', 'public')
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

        $post = Post::query()->create([
            ...$data,
            'user_id' => $request->user()->id,
            'visibility' => $data['visibility'] ?? 'public',
        ]);

        return new PostResource($post->load('user'));
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

        return response()->json(['data' => $comment], 201);
    }

    public function like(Request $request, Post $post): JsonResponse
    {
        $like = PostLike::query()->firstOrCreate([
            'post_id' => $post->id,
            'user_id' => $request->user()->id,
        ]);

        return response()->json(['data' => $like], 201);
    }

    public function unlike(Request $request, Post $post): JsonResponse
    {
        PostLike::query()
            ->where('post_id', $post->id)
            ->where('user_id', $request->user()->id)
            ->delete();

        return response()->json(['message' => 'Like removed.']);
    }
}
