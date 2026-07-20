<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreGltfBundleRequest;
use App\Models\Plant;
use App\Models\PlantGrowthStage;
use App\Services\GltfBundleStorage;

class PlantModelController extends Controller
{
    public function __construct(private readonly GltfBundleStorage $bundles) {}

    public function uploadBaseModel(StoreGltfBundleRequest $request, Plant $plant)
    {
        $bundle = $this->storeBundle($request);
        $plant->update(['base_model_url' => $bundle['reference']]);

        return response()->json([
            'message' => 'Plant model package uploaded.',
            'data' => $bundle,
        ], 201);
    }

    public function uploadStageModel(StoreGltfBundleRequest $request, Plant $plant, PlantGrowthStage $stage)
    {
        abort_unless((int) $stage->plant_id === (int) $plant->id, 404);
        $bundle = $this->storeBundle($request);
        $stage->update(['model_url' => $bundle['reference']]);

        return response()->json([
            'message' => 'Growth-stage model package uploaded.',
            'data' => $bundle,
        ], 201);
    }

    private function storeBundle(StoreGltfBundleRequest $request): array
    {
        return $this->bundles->store(
            $request->file('model'),
            $request->resourceFiles(),
            $request->resourcePaths(),
        );
    }
}
