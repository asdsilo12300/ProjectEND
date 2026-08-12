<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Simulator;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class SimulationEventController extends Controller
{
    public function index(Request $request, Simulator $simulator): JsonResponse
    {
        abort_unless((int) $simulator->user_id === (int) $request->user()->id, 403);
        $events = $simulator->simulationEvents()->with('definition')->whereIn('status', ['announced', 'active'])->orderBy('starts_tick')->get();
        return response()->json(['data' => $events]);
    }
}
