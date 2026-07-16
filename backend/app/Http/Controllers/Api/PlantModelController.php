<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Plant;
use App\Models\PlantGrowthStage;
use App\Services\MediaStorage;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;

class PlantModelController extends Controller
{
    public function __construct(private readonly MediaStorage $media) {}

    public function uploadBaseModel(Request $request, Plant $plant)
    {
        $request->validate([
            'model' => $this->modelRules(),
        ]);

        $file = $request->file('model');
        $path = $this->media->storeUploadedFile($file, 'models');

        $plant->update(['base_model_url' => $this->media->reference($path)]);

        return response()->json([
            'message' => 'Model uploaded',
            'path' => $path,
            'url' => $this->media->publicUrl($path),
        ], 201);
    }

    public function uploadStageModel(Request $request, Plant $plant, PlantGrowthStage $stage)
    {
        $request->validate([
            'model' => $this->modelRules(),
        ]);

        $file = $request->file('model');
        $path = $this->media->storeUploadedFile($file, 'models');

        $stage->update(['model_url' => $this->media->reference($path)]);

        return response()->json([
            'message' => 'Stage model uploaded',
            'path' => $path,
            'url' => $this->media->publicUrl($path),
        ], 201);
    }

    // Dev-only: store model file without DB binding (for testing)
    public function uploadTest(Request $request)
    {
        $request->validate([
            'model' => $this->modelRules(),
        ]);

        $file = $request->file('model');
        $path = $this->media->storeUploadedFile($file, 'models');

        return response()->json([
            'message' => 'Test model uploaded',
            'path' => $path,
            'url' => $this->media->publicUrl($path),
        ], 201);
    }

    private function modelRules(): array
    {
        return [
            'required',
            'file',
            'max:20480',
            static function (string $attribute, mixed $value, Closure $fail): void {
                if (! $value instanceof UploadedFile) {
                    return;
                }

                $extension = strtolower($value->getClientOriginalExtension());

                if (! in_array($extension, ['glb', 'gltf', 'bin'], true)) {
                    $fail('The model must be a GLB, GLTF, or BIN file.');
                }
            },
        ];
    }
}
