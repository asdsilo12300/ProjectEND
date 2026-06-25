<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PlantHistory;
use App\Models\Post;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class PlantHistoryController extends Controller
{
    public function publish(Request $request, PlantHistory $history): JsonResponse
    {
        abort_unless($history->user_id === $request->user()->id, 403);

        $data = $request->validate([
            'caption' => ['nullable', 'string'],
            'visibility' => ['nullable', Rule::in(['private', 'friends', 'public'])],
        ]);

        $history->update(['visibility' => $data['visibility'] ?? 'public']);

        $post = Post::query()->create([
            'user_id' => $request->user()->id,
            'plant_history_id' => $history->id,
            'caption' => $data['caption'] ?? null,
            'visibility' => $data['visibility'] ?? 'public',
        ]);

        return response()->json(['data' => $post], 201);
    }
}
