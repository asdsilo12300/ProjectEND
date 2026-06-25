<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Content;
use Illuminate\Http\JsonResponse;

class ContentController extends Controller
{
    public function show(string $slug): JsonResponse
    {
        $content = Content::query()
            ->where('slug', $slug)
            ->where('status', 'published')
            ->firstOrFail();

        return response()->json(['data' => $content]);
    }
}
