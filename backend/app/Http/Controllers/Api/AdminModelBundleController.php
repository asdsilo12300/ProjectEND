<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Requests\StoreGltfBundleRequest;
use App\Models\AdminActivityLog;
use App\Services\GltfBundleStorage;
use Illuminate\Http\JsonResponse;

class AdminModelBundleController extends Controller
{
    public function __construct(private readonly GltfBundleStorage $bundles) {}

    public function store(StoreGltfBundleRequest $request): JsonResponse
    {
        $bundle = $this->bundles->store(
            $request->file('model'),
            $request->resourceFiles(),
            $request->resourcePaths(),
        );

        AdminActivityLog::record($request->user(), 'uploaded', 'model-bundle', null, [
            'path' => $bundle['path'],
            'dependency_count' => $bundle['dependency_count'],
            'size' => $bundle['size'],
            'sha256' => $bundle['sha256'],
        ]);

        return response()->json([
            'message' => 'GLTF model package uploaded.',
            'data' => $bundle,
        ], 201);
    }
}
