<?php

namespace App\Services;

use App\Models\Plant;
use App\Models\SimulationWeatherDay;
use App\Models\Simulator;
use Carbon\CarbonImmutable;
use Illuminate\Support\Arr;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;

class SeasonalWeatherService
{
    public const PROFILE_VERSION = 'open-meteo-v1';

    private const DAILY_FIELDS = [
        'weather_code', 'temperature_2m_mean', 'temperature_2m_min', 'temperature_2m_max',
        'precipitation_sum', 'rain_sum', 'snowfall_sum', 'wind_speed_10m_max',
        'wind_gusts_10m_max', 'wind_direction_10m_dominant', 'shortwave_radiation_sum',
        'et0_fao_evapotranspiration', 'daylight_duration',
    ];

    public function __construct(private readonly ExternalHttpClient $externalHttp) {}

    public function ensureTimeline(Simulator $simulator): Simulator
    {
        if ($simulator->mode !== 'seasonal') {
            return $simulator;
        }
        // Looking up the current day answers both questions we need here:
        // whether a timeline exists and which row should be synchronized.
        // The previous exists() + dayFor() path added a full database round
        // trip to every seasonal tick.
        $currentDay = $this->dayFor($simulator, (int) $simulator->calendar_day);
        if ($currentDay) {
            return $this->synchronize($simulator, $currentDay);
        }

        $latitude = (float) $simulator->latitude;
        $longitude = (float) $simulator->longitude;
        $timezone = $simulator->location_timezone ?: $this->resolveTimezone($latitude, $longitude);
        $startMonth = max(1, min(12, (int) ($simulator->start_month ?: now()->month)));
        $seed = (int) ($simulator->weather_seed ?: sprintf('%u', crc32(implode(':', [
            $simulator->id, round($latitude, 4), round($longitude, 4), $startMonth,
        ]))));

        $history = $this->historicalProfile($latitude, $longitude);
        $climate = $this->classifyClimate($history, $latitude);
        $startDate = $startMonth === now()->month
            ? CarbonImmutable::today()->startOfDay()
            : CarbonImmutable::create(now()->year, $startMonth, 1)->startOfDay();
        $forecast = $startMonth === now()->month ? $this->forecastProfile($latitude, $longitude) : [];
        $rows = $this->buildTimeline($simulator, $history, $forecast, $climate, $startDate, $seed, $latitude);

        DB::transaction(function () use ($simulator, $rows, $climate, $seed, $startDate, $timezone): void {
            SimulationWeatherDay::query()->where('simulator_id', $simulator->id)->delete();
            foreach (array_chunk($rows, 100) as $chunk) {
                SimulationWeatherDay::query()->insert($chunk);
            }
            $first = $rows[0] ?? null;
            $simulator->forceFill([
                'climate_zone' => $climate['zone'],
                'location_timezone' => $timezone,
                'season_key' => $first['season_key'] ?? null,
                'simulated_datetime' => $startDate->setTime(12, 0),
                'calendar_day' => 0,
                'biological_days' => 0,
                'weather_seed' => $seed,
                'weather_source' => $first['source'] ?? 'seasonal_model',
                'weather_profile_version' => self::PROFILE_VERSION,
            ])->save();
        });

        return $this->synchronize($simulator->fresh());
    }

    /** @return array<string, int|float> */
    public function factorsForCurrentDay(Simulator $simulator): array
    {
        $day = $this->dayFor($simulator, (int) $simulator->calendar_day);
        if (! $day) {
            $simulator = $this->ensureTimeline($simulator);
            $day = $this->dayFor($simulator, (int) $simulator->calendar_day);
        }
        if (! $day) {
            return [];
        }

        $radiation = max(0, (float) $day->shortwave_radiation);
        $soilMoisture = $day->soil_moisture === null
            ? min(100, max(0, 38 + ((float) $day->precipitation * 3) - ((float) $day->evapotranspiration * 2)))
            : min(100, max(0, (float) $day->soil_moisture * 200));

        return [
            'light' => (int) min(100, max(0, round($radiation * 4.2))),
            'soil_humidity' => (int) round($soilMoisture),
            'air_humidity' => (int) min(100, max(0, round((float) $day->humidity))),
            'soil_temp' => round((float) ($day->soil_temperature ?? $day->temperature_mean), 2),
            'air_temp' => round((float) $day->temperature_mean, 2),
            'rain' => round((float) $day->rain, 2),
            'wind_speed' => round((float) $day->wind_speed, 2),
            'wind_gust' => round((float) $day->wind_gust, 2),
            'wind_direction' => round((float) $day->wind_direction, 2),
            'snowfall' => round((float) $day->snowfall, 2),
            'cloud_cover' => round((float) $day->cloud_cover, 2),
            'shortwave_radiation' => $radiation,
            'evapotranspiration' => round((float) $day->evapotranspiration, 2),
        ];
    }

    public function synchronize(Simulator $simulator, ?SimulationWeatherDay $day = null): Simulator
    {
        if ($simulator->mode !== 'seasonal') {
            return $simulator;
        }
        $day ??= $this->dayFor($simulator, (int) $simulator->calendar_day);
        if (! $day) {
            return $simulator;
        }

        $simulator->forceFill([
            'season_key' => $day->season_key,
            'simulated_datetime' => $day->simulated_date->setTime(12, 0),
            'weather_source' => $day->source,
        ])->save();

        // Keep the in-memory model returned by PlantSimulationEngine. Apart
        // from avoiding another remote database query, this preserves the
        // calculated pest risks and plant-need rates attached to this tick.
        return $simulator;
    }

    /**
     * Synchronize the persisted season while also preparing the exact context
     * used by SimulatorResource. The tick endpoint needs both; doing them in
     * one path prevents it from loading today's weather row twice.
     */
    public function synchronizeWithContext(Simulator $simulator): Simulator
    {
        if ($simulator->mode !== 'seasonal') {
            return $simulator;
        }

        $context = $this->context($simulator);
        $current = $context['current'] ?? null;
        if (! is_array($current)) {
            return $this->synchronize($simulator);
        }

        $simulator->forceFill([
            'season_key' => $context['season_key'] ?? $simulator->season_key,
            'simulated_datetime' => $simulator->simulated_datetime,
            'weather_source' => $context['weather_source'] ?? $simulator->weather_source,
        ])->save();
        $simulator->setAttribute('seasonal_context_payload', $context);

        return $simulator;
    }

    /** @return array<string, mixed>|null */
    public function context(Simulator $simulator): ?array
    {
        if ($simulator->mode !== 'seasonal') {
            return null;
        }
        $index = (int) $simulator->calendar_day;
        $days = SimulationWeatherDay::query()
            ->where('simulator_id', $simulator->id)
            ->whereBetween('day_index', [$index, $index + 5])
            ->orderBy('day_index')->get();
        if ($days->isEmpty()) {
            $simulator = $this->ensureTimeline($simulator);
            $days = SimulationWeatherDay::query()
                ->where('simulator_id', $simulator->id)
                ->whereBetween('day_index', [$index, $index + 5])
                ->orderBy('day_index')->get();
            if ($days->isEmpty()) {
                return null;
            }
        }

        $current = $days->first();
        $nextSeason = SimulationWeatherDay::query()
            ->where('simulator_id', $simulator->id)
            ->where('day_index', '>', $index)
            ->where('season_key', '!=', $current->season_key)
            ->orderBy('day_index')->first();

        return [
            'climate_zone' => $simulator->climate_zone,
            'season_key' => $current->season_key,
            'start_month' => (int) $simulator->start_month,
            'calendar_day' => $index,
            'biological_days' => round((float) $simulator->biological_days, 2),
            'simulated_datetime' => $simulator->simulated_datetime?->toIso8601String(),
            'seconds_per_day' => 18,
            'weather_seed' => (int) $simulator->weather_seed,
            'weather_profile_version' => $simulator->weather_profile_version,
            'location_timezone' => $simulator->location_timezone,
            'weather_source' => $current->source,
            'source_label_en' => $current->is_forecast ? 'Real forecast' : 'Simulated from real historical weather',
            'source_label_th' => $current->is_forecast ? 'พยากรณ์จริง' : 'จำลองจากข้อมูลอากาศจริง',
            'current' => $this->serializeDay($current),
            'forecast' => $days->skip(1)->take(5)->map(fn ($day) => $this->serializeDay($day))->values(),
            'next_season' => $nextSeason ? [
                'season_key' => $nextSeason->season_key,
                'starts_in_days' => max(0, (int) $nextSeason->day_index - $index),
                'date' => $nextSeason->simulated_date->toDateString(),
            ] : null,
        ];
    }

    /** @return array<string, mixed> */
    public function preview(float $latitude, float $longitude, int $month, ?Plant $plant = null): array
    {
        $month = max(1, min(12, $month));
        $history = $this->historicalProfile($latitude, $longitude);
        $climate = $this->classifyClimate($history, $latitude);
        $monthRows = collect($history)->filter(fn ($row) => (int) CarbonImmutable::parse($row['date'])->month === $month);
        $temperature = $monthRows->isNotEmpty() ? (float) $monthRows->avg('temperature_2m_mean') : (float) $this->fallbackWeather(CarbonImmutable::create(2024, $month, 15), $latitude, 42)['temperature_2m_mean'];
        $rain = $monthRows->isNotEmpty() ? (float) $monthRows->avg('precipitation_sum') : 0;
        $seasonKey = $this->seasonKey($climate, $month, $latitude);
        $score = 75;
        if ($plant) {
            $minimum = (float) $plant->air_temp_min;
            $maximum = (float) $plant->air_temp_max;
            $distance = $temperature < $minimum ? $minimum - $temperature : ($temperature > $maximum ? $temperature - $maximum : 0);
            $score = max(0, min(100, (int) round(100 - ($distance * 9) - ($rain > 18 ? 12 : 0))));
        }

        return [
            'climate_zone' => $climate['zone'],
            'season_key' => $seasonKey,
            'month' => $month,
            'temperature_mean' => round($temperature, 1),
            'precipitation_daily_mean' => round($rain, 1),
            'suitability_score' => $score,
            'suitability' => $score >= 80 ? 'excellent' : ($score >= 50 ? 'manageable' : 'high_risk'),
            'source' => $history === [] ? 'seasonal_model' : 'historical_reanalysis',
            'source_label_en' => $history === [] ? 'Deterministic climate model' : 'Historical weather profile',
            'source_label_th' => $history === [] ? 'แบบจำลองภูมิอากาศคงที่' : 'ข้อมูลอากาศย้อนหลัง',
            'location_timezone' => $this->resolveTimezone($latitude, $longitude),
        ];
    }

    private function resolveTimezone(float $latitude, float $longitude): string
    {
        $key = 'seasonal-timezone:'.round($latitude, 2).':'.round($longitude, 2);

        return Cache::remember($key, now()->addDays(30), function () use ($latitude, $longitude): string {
            try {
                $timezone = $this->externalHttp->request()->timeout(8)->retry(1, 150)->get('https://api.open-meteo.com/v1/forecast', [
                    'latitude' => $latitude,
                    'longitude' => $longitude,
                    'current' => 'temperature_2m',
                    'forecast_days' => 1,
                    'timezone' => 'auto',
                ])->throw()->json('timezone');

                return is_string($timezone) && $timezone !== '' ? $timezone : 'UTC';
            } catch (\Throwable $error) {
                Log::info('Seasonal timezone lookup unavailable.', ['message' => $error->getMessage()]);

                return 'UTC';
            }
        });
    }

    private function dayFor(Simulator $simulator, int $index): ?SimulationWeatherDay
    {
        $day = SimulationWeatherDay::query()
            ->where('simulator_id', $simulator->id)->where('day_index', $index)->first();
        if ($day) {
            return $day;
        }

        return SimulationWeatherDay::query()
            ->where('simulator_id', $simulator->id)->orderByDesc('day_index')->first();
    }

    /** @return array<int, array<string, mixed>> */
    private function historicalProfile(float $latitude, float $longitude): array
    {
        $endYear = now()->subYear()->year;
        $startYear = $endYear - 2;
        $cacheKey = 'seasonal-history:'.round($latitude, 2).':'.round($longitude, 2).":{$startYear}:{$endYear}";

        return Cache::remember($cacheKey, now()->addDays(30), function () use ($latitude, $longitude, $startYear, $endYear): array {
            try {
                $json = $this->externalHttp->request()->timeout(18)->retry(2, 250)->get('https://archive-api.open-meteo.com/v1/archive', [
                    'latitude' => $latitude,
                    'longitude' => $longitude,
                    'start_date' => "{$startYear}-01-01",
                    'end_date' => "{$endYear}-12-31",
                    'daily' => implode(',', self::DAILY_FIELDS),
                    'timezone' => 'auto',
                ])->throw()->json();

                return $this->rowsFromDaily((array) Arr::get($json, 'daily', []));
            } catch (\Throwable $error) {
                Log::warning('Seasonal historical weather unavailable; using deterministic fallback.', ['message' => $error->getMessage()]);

                return [];
            }
        });
    }

    /** @return array<string, array<string, mixed>> */
    private function forecastProfile(float $latitude, float $longitude): array
    {
        try {
            $json = $this->externalHttp->request()->timeout(10)->retry(1, 200)->get('https://api.open-meteo.com/v1/forecast', [
                'latitude' => $latitude,
                'longitude' => $longitude,
                'daily' => implode(',', self::DAILY_FIELDS),
                'timezone' => 'auto',
                'forecast_days' => 7,
            ])->throw()->json();

            return collect($this->rowsFromDaily((array) Arr::get($json, 'daily', [])))
                ->keyBy('date')->all();
        } catch (\Throwable $error) {
            Log::info('Seasonal forecast overlay unavailable.', ['message' => $error->getMessage()]);

            return [];
        }
    }

    /** @return array<int, array<string, mixed>> */
    private function rowsFromDaily(array $daily): array
    {
        $times = (array) ($daily['time'] ?? []);
        $rows = [];
        foreach ($times as $index => $date) {
            $row = ['date' => (string) $date];
            foreach (self::DAILY_FIELDS as $field) {
                $row[$field] = $daily[$field][$index] ?? null;
            }
            $rows[] = $row;
        }

        return $rows;
    }

    /** @return array{zone:string,rainy_months:array<int,int>} */
    private function classifyClimate(array $history, float $latitude): array
    {
        if ($history === []) {
            return ['zone' => abs($latitude) < 23.5 ? 'tropical' : (abs($latitude) > 55 ? 'cold' : 'temperate'), 'rainy_months' => [6, 7, 8]];
        }

        $monthly = collect($history)->groupBy(fn ($row) => (int) CarbonImmutable::parse($row['date'])->month)
            ->map(fn ($rows) => [
                'temperature' => (float) $rows->avg('temperature_2m_mean'),
                'precipitation' => (float) $rows->sum('precipitation_sum') / max(1, $rows->pluck('date')->map(fn ($date) => substr($date, 0, 4))->unique()->count()),
            ]);
        $meanTemperature = (float) $monthly->avg('temperature');
        $coldestMonth = (float) $monthly->min('temperature');
        $annualPrecipitation = (float) $monthly->sum('precipitation');
        $rainyMonths = $monthly->sortByDesc('precipitation')->keys()->take(3)->map(fn ($month) => (int) $month)->all();

        $zone = match (true) {
            $annualPrecipitation < 500 => 'arid',
            $meanTemperature >= 18 && $coldestMonth >= 14 => 'tropical',
            $meanTemperature < 8 || $coldestMonth < -8 => 'cold',
            default => 'temperate',
        };

        return ['zone' => $zone, 'rainy_months' => $rainyMonths];
    }

    /** @return array<int, array<string, mixed>> */
    private function buildTimeline(Simulator $simulator, array $history, array $forecast, array $climate, CarbonImmutable $startDate, int $seed, float $latitude): array
    {
        $historyByMonthDayYear = collect($history)->groupBy(fn ($row) => substr($row['date'], 5));
        $years = collect($history)->pluck('date')->map(fn ($date) => (int) substr($date, 0, 4))->unique()->values();
        $now = now();
        $rows = [];

        for ($dayIndex = 0; $dayIndex < 730; $dayIndex++) {
            $simulatedDate = $startDate->addDays($dayIndex);
            $dateKey = $simulatedDate->toDateString();
            $isForecast = isset($forecast[$dateKey]);
            $profile = $forecast[$dateKey] ?? null;

            if (! $profile && $historyByMonthDayYear->isNotEmpty()) {
                $monthDay = $simulatedDate->format('m-d');
                $candidates = $historyByMonthDayYear->get($monthDay, collect());
                if ($candidates->isEmpty() && $monthDay === '02-29') {
                    $candidates = $historyByMonthDayYear->get('02-28', collect());
                }
                if ($candidates->isNotEmpty()) {
                    $profile = $candidates->values()->get(abs($seed + intdiv($dayIndex, 30)) % $candidates->count());
                }
            }
            $profile ??= $this->fallbackWeather($simulatedDate, $latitude, $seed);
            $seasonKey = $this->seasonKey($climate, $simulatedDate->month, $latitude);
            $source = $isForecast ? 'forecast' : ($history === [] ? 'seasonal_model' : 'historical_reanalysis');
            $temperature = $this->number($profile, 'temperature_2m_mean', 25);
            $precipitation = max(0, $this->number($profile, 'precipitation_sum', 0));
            $evapotranspiration = max(0, $this->number($profile, 'et0_fao_evapotranspiration', 3));
            // Open-Meteo exposes these signals hourly rather than in this
            // compact daily request. Derive stable daily scene values from
            // precipitation, temperature and ET0 instead of making a second
            // multi-year hourly download.
            $derivedHumidity = min(96, max(25, 48 + min(38, $precipitation * 2.2) - max(0, $temperature - 30) * 1.4));
            $derivedCloud = min(100, max(8, 20 + min(72, $precipitation * 5)));
            $derivedSoilMoisture = min(0.55, max(0.05, 0.2 + ($precipitation * 0.009) - ($evapotranspiration * 0.012)));

            $rows[] = [
                'simulator_id' => $simulator->id,
                'day_index' => $dayIndex,
                'simulated_date' => $dateKey,
                'season_key' => $seasonKey,
                'weather_code' => $this->number($profile, 'weather_code', 0),
                'temperature_mean' => $temperature,
                'temperature_min' => $this->number($profile, 'temperature_2m_min', 20),
                'temperature_max' => $this->number($profile, 'temperature_2m_max', 30),
                'soil_temperature' => $this->number($profile, 'soil_temperature_0_to_7cm_mean', $temperature + 0.8),
                'humidity' => $this->number($profile, 'relative_humidity_2m_mean', $derivedHumidity),
                'precipitation' => $precipitation,
                'rain' => max(0, $this->number($profile, 'rain_sum', $this->number($profile, 'precipitation_sum', 0))),
                'snowfall' => max(0, $this->number($profile, 'snowfall_sum', 0)),
                'wind_speed' => max(0, $this->number($profile, 'wind_speed_10m_max', 8)),
                'wind_gust' => max(0, $this->number($profile, 'wind_gusts_10m_max', 12)),
                'wind_direction' => $this->number($profile, 'wind_direction_10m_dominant', 0),
                'cloud_cover' => min(100, max(0, $this->number($profile, 'cloud_cover_mean', $derivedCloud))),
                'shortwave_radiation' => max(0, $this->number($profile, 'shortwave_radiation_sum', 15)),
                'evapotranspiration' => $evapotranspiration,
                'soil_moisture' => $this->nullableNumber($profile, 'soil_moisture_0_to_7cm_mean') ?? $derivedSoilMoisture,
                'daylight_hours' => max(0, $this->number($profile, 'daylight_duration', 43200) / 3600),
                'source' => $source,
                'is_forecast' => $isForecast,
                'metadata' => json_encode(['source_date' => $profile['date'] ?? null, 'profile_years' => $years->all()], JSON_THROW_ON_ERROR),
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }

        return $rows;
    }

    private function seasonKey(array $climate, int $month, float $latitude): string
    {
        $adjusted = $latitude < 0 ? (($month + 5) % 12) + 1 : $month;

        return match ($climate['zone']) {
            'tropical' => in_array($adjusted, $climate['rainy_months'], true)
                ? 'rainy'
                : (in_array($adjusted, [3, 4, 5], true) ? 'hot' : 'cool_dry'),
            'cold' => match (true) {
                in_array($adjusted, [3, 4, 5], true) => 'thaw',
                in_array($adjusted, [6, 7, 8], true) => 'short_summer',
                in_array($adjusted, [9, 10, 11], true) => 'autumn',
                default => 'deep_winter',
            },
            'arid' => in_array($adjusted, $climate['rainy_months'], true)
                ? 'short_rain'
                : (in_array($adjusted, [4, 5, 6, 7, 8, 9], true) ? 'hot_dry' : 'cool_dry'),
            default => match (true) {
                in_array($adjusted, [3, 4, 5], true) => 'spring',
                in_array($adjusted, [6, 7, 8], true) => 'summer',
                in_array($adjusted, [9, 10, 11], true) => 'autumn',
                default => 'winter',
            },
        };
    }

    /** @return array<string, mixed> */
    private function fallbackWeather(CarbonImmutable $date, float $latitude, int $seed): array
    {
        $day = (int) $date->dayOfYear;
        $hemisphereOffset = $latitude < 0 ? M_PI : 0;
        $season = sin((($day - 80) / 365) * 2 * M_PI + $hemisphereOffset);
        $tropical = abs($latitude) < 23.5;
        $base = $tropical ? 27 : (16 - min(10, abs($latitude) / 9));
        $amplitude = $tropical ? 3 : min(18, 7 + abs($latitude) / 5);
        $noise = ((abs(crc32("{$seed}:{$day}")) % 1000) / 1000) - 0.5;
        $temperature = $base + ($amplitude * $season) + ($noise * 4);
        $rainChance = $tropical ? (0.35 + 0.25 * sin((($day - 150) / 365) * 2 * M_PI)) : 0.25;
        $rain = (($noise + 0.5) < $rainChance) ? max(0, ($noise + 0.5) * 18) : 0;

        return [
            'date' => $date->toDateString(), 'weather_code' => $rain > 0 ? 61 : 1,
            'temperature_2m_mean' => $temperature, 'temperature_2m_min' => $temperature - 5,
            'temperature_2m_max' => $temperature + 6, 'soil_temperature_0_to_7cm_mean' => $temperature + 1,
            'relative_humidity_2m_mean' => min(95, max(30, 58 + $rain * 1.5)),
            'precipitation_sum' => $rain, 'rain_sum' => $rain,
            'snowfall_sum' => $temperature < 0 ? $rain * 0.7 : 0,
            'wind_speed_10m_max' => 8 + abs($noise) * 18, 'wind_gusts_10m_max' => 14 + abs($noise) * 24,
            'wind_direction_10m_dominant' => abs(crc32("wind:{$seed}:{$day}")) % 360,
            'cloud_cover_mean' => $rain > 0 ? 82 : 30 + abs($noise) * 35,
            'shortwave_radiation_sum' => max(2, 16 + $season * 6 - $rain * 0.25),
            'et0_fao_evapotranspiration' => max(0.5, 2.5 + max(0, $temperature - 22) * 0.12),
            'soil_moisture_0_to_7cm_mean' => min(0.5, max(0.08, 0.22 + $rain * 0.008)),
            'daylight_duration' => ($tropical ? 12 : 12 + $season * 3.5) * 3600,
        ];
    }

    /** @return array<string, mixed> */
    private function serializeDay(SimulationWeatherDay $day): array
    {
        $risk = match (true) {
            $day->precipitation >= 25 => 'heavy_rain',
            $day->temperature_max >= 36 => 'heat_wave',
            $day->wind_gust >= 45 => 'strong_wind',
            $day->temperature_min <= 3 || $day->snowfall > 0 => 'cold_snap',
            default => null,
        };

        return [
            'day_index' => (int) $day->day_index,
            'date' => $day->simulated_date->toDateString(),
            'season_key' => $day->season_key,
            'weather_code' => $day->weather_code,
            'temperature_mean' => (float) $day->temperature_mean,
            'temperature_min' => (float) $day->temperature_min,
            'temperature_max' => (float) $day->temperature_max,
            'soil_temperature' => (float) $day->soil_temperature,
            'humidity' => (float) $day->humidity,
            'precipitation' => (float) $day->precipitation,
            'rain' => (float) $day->rain,
            'snowfall' => (float) $day->snowfall,
            'wind_speed' => (float) $day->wind_speed,
            'wind_gust' => (float) $day->wind_gust,
            'wind_direction' => (float) $day->wind_direction,
            'cloud_cover' => (float) $day->cloud_cover,
            'shortwave_radiation' => (float) $day->shortwave_radiation,
            'evapotranspiration' => (float) $day->evapotranspiration,
            'soil_moisture' => $day->soil_moisture === null ? null : (float) $day->soil_moisture,
            'daylight_hours' => (float) $day->daylight_hours,
            'source' => $day->source,
            'is_forecast' => (bool) $day->is_forecast,
            'risk' => $risk,
            'recommended_action' => match ($risk) {
                'heavy_rain' => 'drainage', 'heat_wave' => 'shade', 'strong_wind' => 'windbreak',
                'cold_snap' => 'frost-cover', default => null,
            },
        ];
    }

    private function number(array $row, string $key, float|int $fallback): float
    {
        return is_numeric($row[$key] ?? null) ? (float) $row[$key] : (float) $fallback;
    }

    private function nullableNumber(array $row, string $key): ?float
    {
        return is_numeric($row[$key] ?? null) ? (float) $row[$key] : null;
    }
}
