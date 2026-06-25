<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Plant;
use App\Models\PlantGrowthStage;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

class PlantModelController extends Controller
{
    public function uploadBaseModel(Request $request, Plant $plant)
    {
        $request->validate([
            'model' => 'required|file',
        ]);

        $file = $request->file('model');
        $path = $file->store('models', 'public');

        $plant->update(['base_model_url' => $path]);

        return response()->json([
            'message' => 'Model uploaded',
            'path' => $path,
            'url' => Storage::url($path),
        ], 201);
    }

    public function uploadStageModel(Request $request, Plant $plant, PlantGrowthStage $stage)
    {
        $request->validate([
            'model' => 'required|file',
        ]);

        $file = $request->file('model');
        $path = $file->store('models', 'public');

        $stage->update(['model_url' => $path]);

        return response()->json([
            'message' => 'Stage model uploaded',
            'path' => $path,
            'url' => Storage::url($path),
        ], 201);
    }

    // Dev-only: store model file without DB binding (for testing)
    public function uploadTest(Request $request)
    {
        $request->validate([
            'model' => 'required|file',
        ]);

        $file = $request->file('model');
        $path = $file->store('models', 'public');

        return response()->json([
            'message' => 'Test model uploaded',
            'path' => $path,
            'url' => Storage::url($path),
        ], 201);
    }
}
