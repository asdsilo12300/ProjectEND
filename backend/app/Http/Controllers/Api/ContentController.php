<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Content;
use App\Services\PublicCatalogCache;
use Illuminate\Http\JsonResponse;

class ContentController extends Controller
{
    public function __construct(private readonly PublicCatalogCache $cache) {}

    public function index(): JsonResponse
    {
        $contents = $this->cache->remember('contents', fn () => Content::query()
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
            ])
            ->toArray());

        return response()
            ->json(['data' => $contents])
            ->header('Cache-Control', $this->publicCacheControl());
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

    private function publicCacheControl(): string
    {
        $seconds = max(0, (int) config('catalog.browser_cache_seconds', 30));

        return "public, max-age={$seconds}, stale-while-revalidate=300";
    }
}
