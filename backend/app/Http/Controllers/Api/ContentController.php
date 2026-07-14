<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Content;
use Illuminate\Http\JsonResponse;

class ContentController extends Controller
{
    public function index(): JsonResponse
    {
        $contents = Content::query()
            ->where('status', 'published')
            ->where(function ($query): void {
                $query->whereNull('published_at')->orWhere('published_at', '<=', now());
            })
            ->orderBy('sort_order')
            ->orderBy('id')
            ->get([
                'id', 'slug', 'category', 'icon', 'eyebrow', 'eyebrow_th', 'title', 'title_th',
                'summary', 'summary_th', 'cover_image_url', 'cover_image_alt', 'cover_image_alt_th',
                'image_credit', 'image_credit_url', 'reading_minutes', 'sort_order', 'published_at', 'updated_at',
            ]);

        return response()->json(['data' => $contents]);
    }

    public function show(string $slug): JsonResponse
    {
        $content = Content::query()
            ->where('slug', $slug)
            ->where('status', 'published')
            ->where(function ($query): void {
                $query->whereNull('published_at')->orWhere('published_at', '<=', now());
            })
            ->firstOrFail();

        return response()->json(['data' => $content]);
    }
}
