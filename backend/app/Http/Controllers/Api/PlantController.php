<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\PlantResource;
use App\Http\Resources\PlantStageResource;
use App\Models\Plant;
use App\Services\PublicCatalogCache;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class PlantController extends Controller
{
    public function __construct(private readonly PublicCatalogCache $cache) {}

    public function index(): JsonResponse
    {
        $plants = $this->cache->remember(
            'plants',
            fn (): array => PlantResource::collection(
                Plant::query()->playable()->with('stages')->orderBy('name_th')->get(),
            )->resolve(),
        );

        return response()
            ->json(['data' => $plants])
            ->header('Cache-Control', $this->publicCacheControl());
    }

    public function show(Plant $plant): PlantResource
    {
        return new PlantResource($plant->load('stages'));
    }

    public function stages(Plant $plant): AnonymousResourceCollection
    {
        return PlantStageResource::collection($plant->stages()->get());
    }

    private function publicCacheControl(): string
    {
        $seconds = max(0, (int) config('catalog.browser_cache_seconds', 30));

        return "public, max-age={$seconds}, stale-while-revalidate=300";
    }
}
