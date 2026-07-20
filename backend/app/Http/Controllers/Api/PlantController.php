<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\PlantResource;
use App\Http\Resources\PlantStageResource;
use App\Models\Plant;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;

class PlantController extends Controller
{
    public function index(): AnonymousResourceCollection
    {
        return PlantResource::collection(
            Plant::query()->playable()->with('stages')->orderBy('name_th')->get()
        );
    }

    public function show(Plant $plant): PlantResource
    {
        return new PlantResource($plant->load('stages'));
    }

    public function stages(Plant $plant): AnonymousResourceCollection
    {
        return PlantStageResource::collection($plant->stages()->get());
    }
}
