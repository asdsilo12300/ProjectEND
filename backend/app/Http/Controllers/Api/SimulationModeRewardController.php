<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Services\SimulationModeRewardService;
use Illuminate\Http\JsonResponse;

class SimulationModeRewardController extends Controller
{
    public function __invoke(SimulationModeRewardService $rewards): JsonResponse
    {
        return response()->json(['data' => $rewards->catalog()]);
    }
}
