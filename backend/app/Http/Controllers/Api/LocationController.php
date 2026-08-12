<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Http;

class LocationController extends Controller
{
    public function search(Request $request): JsonResponse
    {
        $data = $request->validate(['q' => ['required', 'string', 'min:2', 'max:120']]);
        $key = 'location-search:'.sha1(mb_strtolower(trim($data['q'])));
        $results = Cache::remember($key, now()->addHours(6), fn () => Http::withHeaders(['User-Agent' => config('app.name').'/1.0'])
            ->timeout(8)->retry(2, 150)->get('https://nominatim.openstreetmap.org/search', [
                'q' => $data['q'], 'format' => 'jsonv2', 'limit' => 6, 'addressdetails' => 1,
            ])->throw()->collect()->map(fn ($row) => [
                'name' => $row['display_name'] ?? '', 'latitude' => (float) ($row['lat'] ?? 0),
                'longitude' => (float) ($row['lon'] ?? 0), 'type' => $row['type'] ?? null,
            ])->values()->all());
        return response()->json(['data' => $results]);
    }

    public function reverse(Request $request): JsonResponse
    {
        $data = $request->validate(['latitude' => ['required', 'numeric', 'between:-90,90'], 'longitude' => ['required', 'numeric', 'between:-180,180']]);
        $key = 'location-reverse:'.round($data['latitude'], 4).':'.round($data['longitude'], 4);
        $result = Cache::remember($key, now()->addHours(12), fn () => Http::withHeaders(['User-Agent' => config('app.name').'/1.0'])
            ->timeout(8)->retry(2, 150)->get('https://nominatim.openstreetmap.org/reverse', [
                'lat' => $data['latitude'], 'lon' => $data['longitude'], 'format' => 'jsonv2', 'zoom' => 12,
            ])->throw()->json());
        return response()->json(['data' => ['name' => $result['display_name'] ?? 'Selected location', 'latitude' => (float) $data['latitude'], 'longitude' => (float) $data['longitude']]]);
    }

    public function weather(Request $request): JsonResponse
    {
        $data = $request->validate(['latitude' => ['required', 'numeric', 'between:-90,90'], 'longitude' => ['required', 'numeric', 'between:-180,180']]);
        $key = 'weather-preview:'.round($data['latitude'], 3).':'.round($data['longitude'], 3);
        $weather = Cache::remember($key, now()->addMinutes(10), fn () => Http::timeout(8)->retry(2, 150)
            ->get('https://api.open-meteo.com/v1/forecast', [
                'latitude' => $data['latitude'], 'longitude' => $data['longitude'],
                'current' => 'temperature_2m,relative_humidity_2m,precipitation,rain,weather_code,wind_speed_10m,is_day',
                'daily' => 'precipitation_sum,precipitation_probability_max', 'timezone' => 'auto', 'forecast_days' => 1,
            ])->throw()->json());
        return response()->json(['data' => $weather]);
    }
}
