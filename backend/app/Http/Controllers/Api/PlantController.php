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
                Plant::query()->withTrashed()->playable()->with(['stages', 'knowledge'])->orderBy('name_th')->get(),
            )->response()->getData(true)['data'] ?? [],
        );

        return response()
            ->json(['data' => $plants])
            // Plant availability controls whether a user may start or resume a
            // simulation. Do not let a browser reuse a catalog captured before
            // an administrator moved a species to trash.
            ->header('Cache-Control', 'no-store, private');
    }

    public function show(Plant $plant): PlantResource
    {
        return new PlantResource($plant->load(['stages', 'knowledge']));
    }

    public function stages(Plant $plant): AnonymousResourceCollection
    {
        return PlantStageResource::collection($plant->stages()->get());
    }

}
