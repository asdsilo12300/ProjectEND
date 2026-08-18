<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Plant;
use App\Services\ExternalHttpClient;
use App\Services\SeasonalWeatherService;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\Rule;

class LocationController extends Controller
{
    public function __construct(private readonly ExternalHttpClient $externalHttp) {}

    public function search(Request $request): JsonResponse
    {
        $data = $request->validate(['q' => ['required', 'string', 'min:2', 'max:120']]);
        $key = 'location-search:'.sha1(mb_strtolower(trim($data['q'])));

        try {
            $results = Cache::remember($key, now()->addHours(6), fn () => $this->nominatimRequest()
                ->get(config('services.nominatim.base_url').'/search', [
                    'q' => $data['q'], 'format' => 'jsonv2', 'limit' => 6, 'addressdetails' => 1,
                ])->throw()->collect()->map(fn ($row) => [
                    'name' => $row['display_name'] ?? '', 'latitude' => (float) ($row['lat'] ?? 0),
                    'longitude' => (float) ($row['lon'] ?? 0), 'type' => $row['type'] ?? null,
                ])->values()->all());
        } catch (\Throwable $error) {
            Log::warning('Location search provider unavailable.', [
                'provider' => 'nominatim',
                'exception' => $error::class,
                'message' => $error->getMessage(),
            ]);

            return $this->providerUnavailable('location.search_unavailable');
        }

        return response()->json(['data' => $results]);
    }

    public function reverse(Request $request): JsonResponse
    {
        $data = $request->validate(['latitude' => ['required', 'numeric', 'between:-90,90'], 'longitude' => ['required', 'numeric', 'between:-180,180']]);
        $key = 'location-reverse:'.round($data['latitude'], 4).':'.round($data['longitude'], 4);
        try {
            $result = Cache::remember($key, now()->addHours(12), fn () => $this->nominatimRequest()
                ->get(config('services.nominatim.base_url').'/reverse', [
                    'lat' => $data['latitude'], 'lon' => $data['longitude'], 'format' => 'jsonv2', 'zoom' => 12,
                ])->throw()->json());
        } catch (\Throwable $error) {
            Log::warning('Reverse geocoding provider unavailable.', [
                'provider' => 'nominatim',
                'exception' => $error::class,
                'message' => $error->getMessage(),
            ]);

            return $this->providerUnavailable('location.reverse_unavailable');
        }

        return response()->json(['data' => ['name' => $result['display_name'] ?? 'Selected location', 'latitude' => (float) $data['latitude'], 'longitude' => (float) $data['longitude']]]);
    }

    public function weather(Request $request): JsonResponse
    {
        $data = $request->validate(['latitude' => ['required', 'numeric', 'between:-90,90'], 'longitude' => ['required', 'numeric', 'between:-180,180']]);
        $key = 'weather-preview:'.round($data['latitude'], 3).':'.round($data['longitude'], 3);
        try {
            $weather = Cache::remember($key, now()->addMinutes(10), fn () => $this->externalHttp->request()
                ->timeout(8)->retry(2, 150)->get('https://api.open-meteo.com/v1/forecast', [
                    'latitude' => $data['latitude'], 'longitude' => $data['longitude'],
                    'current' => 'temperature_2m,relative_humidity_2m,precipitation,rain,weather_code,wind_speed_10m,is_day',
                    'daily' => 'precipitation_sum,precipitation_probability_max', 'timezone' => 'auto', 'forecast_days' => 1,
                ])->throw()->json());
        } catch (\Throwable $error) {
            Log::warning('Weather preview provider unavailable.', [
                'provider' => 'open-meteo',
                'exception' => $error::class,
                'message' => $error->getMessage(),
            ]);

            return $this->providerUnavailable('location.weather_unavailable');
        }

        return response()->json(['data' => $weather]);
    }

    public function seasonalPreview(Request $request, SeasonalWeatherService $seasonalWeather): JsonResponse
    {
        $data = $request->validate([
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
            'month' => ['required', 'integer', 'between:1,12'],
            'plant_id' => ['nullable', Rule::exists('plants', 'id')->whereNull('deleted_at')],
        ]);
        $plant = isset($data['plant_id']) ? Plant::query()->find($data['plant_id']) : null;

        return response()->json(['data' => $seasonalWeather->preview(
            (float) $data['latitude'],
            (float) $data['longitude'],
            (int) $data['month'],
            $plant,
        )]);
    }

    private function nominatimRequest(): PendingRequest
    {
        return $this->externalHttp->request()
            ->withHeaders(['User-Agent' => config('services.nominatim.user_agent')])
            ->timeout(8)
            ->retry(2, 150);
    }

    private function providerUnavailable(string $messageCode): JsonResponse
    {
        return response()->json([
            'message' => 'The location service is temporarily unavailable. Please try again.',
            'message_code' => $messageCode,
        ], 503);
    }
}
