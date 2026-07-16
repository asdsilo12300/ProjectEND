<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\PlantHistoryResource;
use App\Http\Resources\SimulatorResource;
use App\Models\PlantConditionRule;
use App\Models\PlantHistory;
use App\Models\Post;
use App\Models\Simulator;
use App\Services\MediaStorage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Resources\Json\AnonymousResourceCollection;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;

class PlantHistoryController extends Controller
{
    public function __construct(private readonly MediaStorage $media) {}

    public function index(Request $request): AnonymousResourceCollection
    {
        $search = trim((string) $request->query('q', ''));

        $histories = PlantHistory::query()
            ->with(['plant.stages', 'finalStage'])
            ->where('user_id', $request->user()->id)
            ->when($search !== '', function ($query) use ($search): void {
                $query->where(function ($inner) use ($search): void {
                    $inner
                        ->whereLike('analysis_result', "%{$search}%", caseSensitive: false)
                        ->orWhereLike('direction', "%{$search}%", caseSensitive: false)
                        ->orWhereHas('plant', function ($plantQuery) use ($search): void {
                            $plantQuery
                                ->whereLike('name_th', "%{$search}%", caseSensitive: false)
                                ->orWhereLike('name_en', "%{$search}%", caseSensitive: false);
                        })
                        ->orWhereHas('finalStage', function ($stageQuery) use ($search): void {
                            $stageQuery->whereLike('stage_name', "%{$search}%", caseSensitive: false);
                        });
                });
            })
            ->latest('created_at')
            ->get();

        return PlantHistoryResource::collection($histories);
    }

    public function storeForSimulator(Request $request, Simulator $simulator): PlantHistoryResource
    {
        abort_unless($simulator->user_id === $request->user()->id, 403);

        $data = $request->validate([
            'visibility' => ['nullable', Rule::in(['private', 'friends', 'public'])],
            'snapshot_image_url' => ['nullable', 'string', 'max:2048'],
            'snapshot_image_data' => ['nullable', 'string', 'max:7500000'],
        ]);

        $history = DB::transaction(function () use ($data, $request, $simulator): PlantHistory {
            $lockedSimulator = Simulator::query()
                ->whereKey($simulator->getKey())
                ->lockForUpdate()
                ->firstOrFail();

            abort_unless($lockedSimulator->user_id === $request->user()->id, 403);
            abort_unless(in_array($lockedSimulator->status, ['active', 'completed'], true), 409, 'Only an active or completed simulation can be harvested.');

            $existingHistory = PlantHistory::query()
                ->withTrashed()
                ->where('simulator_id', $lockedSimulator->id)
                ->where('user_id', $request->user()->id)
                ->latest('id')
                ->first();

            if ($existingHistory) {
                if ($existingHistory->trashed()) {
                    $existingHistory->restore();
                }

                if ($lockedSimulator->status !== 'completed') {
                    $lockedSimulator->forceFill([
                        'status' => 'completed',
                        'share_visibility' => 'private',
                        'state_version' => ((int) $lockedSimulator->state_version) + 1,
                        'ended_at' => $lockedSimulator->ended_at ?? now(),
                    ])->save();
                }

                Post::query()->where('simulator_id', $lockedSimulator->id)->delete();

                return $existingHistory;
            }

            $lockedSimulator->load(['plant.stages', 'plant.conditionRules', 'currentStage', 'activePests.pest']);
            $matchedRules = $this->matchedRules($lockedSimulator);
            $activePestCount = $lockedSimulator->activePests->count();
            $score = $this->totalScore($lockedSimulator, $matchedRules, $activePestCount);
            $analysis = $this->analysisText($lockedSimulator, $matchedRules, $activePestCount);
            $direction = $this->directionText($matchedRules, $activePestCount);
            $snapshotImageUrl = $data['snapshot_image_url'] ?? $this->storeSnapshotImage($data['snapshot_image_data'] ?? null, $lockedSimulator->id);

            if ($lockedSimulator->status !== 'completed') {
                $lockedSimulator->forceFill([
                    'status' => 'completed',
                    'share_visibility' => 'private',
                    'state_version' => ((int) $lockedSimulator->state_version) + 1,
                    'ended_at' => now(),
                ])->save();
            }

            $history = PlantHistory::query()->create([
                'simulator_id' => $lockedSimulator->id,
                'user_id' => $request->user()->id,
                'plant_id' => $lockedSimulator->plant_id,
                'final_stage_id' => $lockedSimulator->current_stage_id,
                'final_health' => (int) round((float) $lockedSimulator->health),
                'total_score' => $score,
                'duration_days' => $this->durationDays($lockedSimulator),
                'visibility' => $data['visibility'] ?? 'private',
                'snapshot_image_url' => $snapshotImageUrl,
                'game_state' => $this->gameState($lockedSimulator),
                'analysis_result' => $analysis,
                'direction' => $direction,
            ]);

            if ($history->visibility !== 'private') {
                $post = Post::query()->withTrashed()->where('simulator_id', $lockedSimulator->id)->first();

                if ($post) {
                    $post->restore();
                    $post->forceFill([
                        'plant_history_id' => $history->id,
                        'simulator_id' => null,
                        'visibility' => $history->visibility,
                    ])->save();
                } else {
                    Post::query()->create([
                        'user_id' => $request->user()->id,
                        'plant_history_id' => $history->id,
                        'simulator_id' => null,
                        'caption' => 'Harvested a plant and saved the complete game state.',
                        'visibility' => $history->visibility,
                    ]);
                }
            } else {
                Post::query()->where('simulator_id', $lockedSimulator->id)->delete();
            }

            return $history;
        });

        return new PlantHistoryResource($history->load(['plant.stages', 'finalStage']));
    }

    private function gameState(Simulator $simulator): array
    {
        $resource = (new SimulatorResource(
            $simulator->fresh(['user', 'plant.stages', 'currentStage', 'visualVariant', 'activePests.pest.conditionRules'])
        ))->resolve(request());

        return [
            'schema_version' => 1,
            'captured_at' => now()->toISOString(),
            'simulator' => $resource,
        ];
    }

    public function destroy(Request $request, PlantHistory $history): JsonResponse
    {
        abort_unless($history->user_id === $request->user()->id, 403);

        $history->delete();

        return response()->json(['data' => ['id' => $history->id, 'deleted' => true]]);
    }

    public function publish(Request $request, PlantHistory $history): JsonResponse
    {
        abort_unless($history->user_id === $request->user()->id, 403);

        $data = $request->validate([
            'caption' => ['nullable', 'string'],
            'visibility' => ['nullable', Rule::in(['private', 'friends', 'public'])],
        ]);

        $history->update(['visibility' => $data['visibility'] ?? 'public']);

        $post = Post::query()->updateOrCreate(
            [
                'user_id' => $request->user()->id,
                'plant_history_id' => $history->id,
            ],
            [
                'caption' => $data['caption'] ?? $history->analysis_result,
                'visibility' => $data['visibility'] ?? 'public',
            ],
        );

        return response()->json(['data' => $post], 201);
    }

    public function updateVisibility(Request $request, PlantHistory $history): JsonResponse
    {
        abort_unless($history->user_id === $request->user()->id, 403);

        $data = $request->validate([
            'visibility' => ['required', Rule::in(['private', 'friends', 'public'])],
            'caption' => ['nullable', 'string'],
        ]);

        $visibility = $data['visibility'];
        $history->update(['visibility' => $visibility]);

        if ($visibility === 'private') {
            Post::query()
                ->where('user_id', $request->user()->id)
                ->where('plant_history_id', $history->id)
                ->update(['visibility' => 'private']);
        } else {
            Post::query()->updateOrCreate(
                [
                    'user_id' => $request->user()->id,
                    'plant_history_id' => $history->id,
                ],
                [
                    'caption' => $data['caption'] ?? $history->analysis_result,
                    'visibility' => $visibility,
                ],
            );
        }

        return response()->json([
            'data' => new PlantHistoryResource($history->fresh(['plant.stages', 'finalStage'])),
        ]);
    }

    private function storeSnapshotImage(?string $imageData, int $simulatorId): ?string
    {
        if (! $imageData) {
            return null;
        }

        if (! preg_match('/^data:image\/(png|jpeg|webp);base64,/', $imageData, $matches)) {
            return null;
        }

        $extension = $matches[1] === 'jpeg' ? 'jpg' : $matches[1];
        $base64 = substr($imageData, strpos($imageData, ',') + 1);
        $binary = base64_decode($base64, true);

        if ($binary === false || strlen($binary) > 5 * 1024 * 1024) {
            return null;
        }

        $path = 'plant-history-snapshots/simulator-'.$simulatorId.'-'.Str::uuid().'.'.$extension;
        if (! $this->media->put($path, $binary, 'image/'.$matches[1])) {
            return null;
        }

        return $this->media->reference($path);
    }

    private function totalScore(Simulator $simulator, Collection $matchedRules, int $activePestCount): int
    {
        $maxGrowthPoint = max(100, (int) $simulator->plant->stages->max('required_growth_point'));
        $growthPercent = min(100, max(0, ((float) $simulator->growth_point / $maxGrowthPoint) * 100));
        $health = min(100, max(0, (float) $simulator->health));
        $stressPenalty = min(100, $matchedRules->sum(fn ($rule) => max(0, (int) $rule->severity)) / 2 + ($activePestCount * 8));
        $environmentFit = max(0, 100 - $stressPenalty);

        return (int) min(100, max(0, round(($growthPercent * 0.45) + ($health * 0.35) + ($environmentFit * 0.20))));
    }

    private function durationDays(Simulator $simulator): int
    {
        if (! $simulator->started_at) {
            return 1;
        }

        return max(1, (int) ceil(max(1, $simulator->started_at->diffInHours(now())) / 24));
    }

    private function matchedRules(Simulator $simulator): Collection
    {
        $factors = [
            'water' => $simulator->water,
            'light' => $simulator->light,
            'fertilizer' => $simulator->fertilizer,
            'soil_humidity' => $simulator->soil_humidity,
            'air_humidity' => $simulator->air_humidity,
            'soil_temp' => $simulator->soil_temp,
            'air_temp' => $simulator->air_temp,
        ];

        return $simulator->plant->conditionRules
            ->filter(fn (PlantConditionRule $rule) => $rule->is_active && array_key_exists($rule->factor, $factors) && $this->matchesRule($rule, (float) $factors[$rule->factor]))
            ->sortByDesc(fn (PlantConditionRule $rule) => (int) $rule->severity)
            ->values();
    }

    private function matchesRule(PlantConditionRule $rule, float $value): bool
    {
        $min = $rule->min_value === null ? null : (float) $rule->min_value;
        $max = $rule->max_value === null ? null : (float) $rule->max_value;

        return match ($rule->operator) {
            'below' => $min !== null && $value < $min,
            'above' => $max !== null && $value > $max,
            'between' => $min !== null && $max !== null && $value >= $min && $value <= $max,
            'outside' => $min !== null && $max !== null && ($value < $min || $value > $max),
            default => false,
        };
    }

    private function analysisText(Simulator $simulator, Collection $matchedRules, int $activePestCount): string
    {
        $growthPoint = (float) $simulator->growth_point;
        $health = (int) round((float) $simulator->health);

        if ($growthPoint >= 100) {
            return $this->thai('\\u0e1e\\u0e37\\u0e0a\\u0e42\\u0e15\\u0e40\\u0e15\\u0e47\\u0e21\\u0e27\\u0e31\\u0e22\\u0e41\\u0e25\\u0e49\\u0e27 \\u0e1a\\u0e31\\u0e19\\u0e17\\u0e36\\u0e01\\u0e23\\u0e2d\\u0e1a\\u0e2a\\u0e21\\u0e1a\\u0e39\\u0e23\\u0e13\\u0e4c\\u0e14\\u0e49\\u0e27\\u0e22\\u0e2a\\u0e38\\u0e02\\u0e20\\u0e32\\u0e1e ').$health.'%';
        }

        if ($matchedRules->isEmpty() && $activePestCount === 0) {
            return $this->thai('\\u0e2a\\u0e20\\u0e32\\u0e1e\\u0e41\\u0e27\\u0e14\\u0e25\\u0e49\\u0e2d\\u0e21\\u0e40\\u0e2b\\u0e21\\u0e32\\u0e30\\u0e2a\\u0e21 \\u0e1e\\u0e37\\u0e0a\\u0e40\\u0e15\\u0e34\\u0e1a\\u0e42\\u0e15\\u0e44\\u0e14\\u0e49\\u0e15\\u0e48\\u0e2d\\u0e40\\u0e19\\u0e37\\u0e48\\u0e2d\\u0e07\\u0e41\\u0e25\\u0e30\\u0e2a\\u0e38\\u0e02\\u0e20\\u0e32\\u0e1e\\u0e04\\u0e07\\u0e17\\u0e35\\u0e48');
        }

        $stressNames = $matchedRules
            ->take(2)
            ->map(fn (PlantConditionRule $rule) => $this->stressLabel($rule))
            ->filter()
            ->unique()
            ->values();

        $parts = [];

        if ($stressNames->isNotEmpty()) {
            $parts[] = $this->thai('\\u0e1e\\u0e1a\\u0e04\\u0e27\\u0e32\\u0e21\\u0e40\\u0e04\\u0e23\\u0e35\\u0e22\\u0e14\\u0e08\\u0e32\\u0e01').$stressNames->implode($this->thai('\\u0e41\\u0e25\\u0e30'));
        }

        if ($activePestCount > 0) {
            $parts[] = $this->thai('\\u0e21\\u0e35\\u0e28\\u0e31\\u0e15\\u0e23\\u0e39\\u0e1e\\u0e37\\u0e0a ').$activePestCount.$this->thai(' \\u0e08\\u0e38\\u0e14');
        }

        return implode(' '.$this->thai('\\u0e41\\u0e25\\u0e30').' ', $parts).' '.$this->thai('\\u0e17\\u0e33\\u0e43\\u0e2b\\u0e49\\u0e1e\\u0e37\\u0e0a\\u0e42\\u0e15\\u0e0a\\u0e49\\u0e32\\u0e25\\u0e07\\u0e2b\\u0e23\\u0e37\\u0e2d\\u0e2a\\u0e38\\u0e02\\u0e20\\u0e32\\u0e1e\\u0e25\\u0e14\\u0e25\\u0e07');
    }

    private function directionText(Collection $matchedRules, int $activePestCount): string
    {
        if ($matchedRules->isEmpty() && $activePestCount === 0) {
            return $this->thai('\\u0e23\\u0e31\\u0e01\\u0e29\\u0e32\\u0e04\\u0e48\\u0e32\\u0e1b\\u0e31\\u0e08\\u0e08\\u0e38\\u0e1a\\u0e31\\u0e19\\u0e44\\u0e27\\u0e49 \\u0e41\\u0e25\\u0e49\\u0e27\\u0e1a\\u0e31\\u0e19\\u0e17\\u0e36\\u0e01\\u0e40\\u0e1b\\u0e23\\u0e35\\u0e22\\u0e1a\\u0e40\\u0e17\\u0e35\\u0e22\\u0e1a\\u0e43\\u0e19\\u0e23\\u0e2d\\u0e1a\\u0e16\\u0e31\\u0e14\\u0e44\\u0e1b');
        }

        $directions = $matchedRules
            ->take(2)
            ->map(fn (PlantConditionRule $rule) => $this->directionLabel($rule))
            ->filter()
            ->unique()
            ->values();

        if ($activePestCount > 0) {
            $directions->push($this->thai('\\u0e08\\u0e31\\u0e14\\u0e01\\u0e32\\u0e23\\u0e28\\u0e31\\u0e15\\u0e23\\u0e39\\u0e1e\\u0e37\\u0e0a\\u0e17\\u0e35\\u0e48\\u0e1e\\u0e1a'));
        }

        return $directions->isEmpty() ? $this->thai('\\u0e1b\\u0e23\\u0e31\\u0e1a\\u0e1b\\u0e31\\u0e08\\u0e08\\u0e31\\u0e22\\u0e17\\u0e35\\u0e48\\u0e40\\u0e2a\\u0e35\\u0e48\\u0e22\\u0e07\\u0e01\\u0e48\\u0e2d\\u0e19\\u0e23\\u0e2d\\u0e1a\\u0e16\\u0e31\\u0e14\\u0e44\\u0e1b') : $directions->implode(' '.$this->thai('\\u0e41\\u0e25\\u0e30').' ');
    }

    private function stressLabel(PlantConditionRule $rule): string
    {
        $factor = $this->factorLabel($rule->factor);

        return match ($rule->operator) {
            'below' => $factor.$this->thai('\\u0e15\\u0e48\\u0e33'),
            'above' => $factor.$this->thai('\\u0e2a\\u0e39\\u0e07'),
            'outside' => $factor.$this->thai('\\u0e19\\u0e2d\\u0e01\\u0e0a\\u0e48\\u0e27\\u0e07\\u0e40\\u0e2b\\u0e21\\u0e32\\u0e30\\u0e2a\\u0e21'),
            default => $factor,
        };
    }

    private function directionLabel(PlantConditionRule $rule): string
    {
        return match ($rule->factor.':'.$rule->operator) {
            'water:below' => $this->thai('\\u0e40\\u0e1e\\u0e34\\u0e48\\u0e21\\u0e19\\u0e49\\u0e33\\u0e40\\u0e25\\u0e47\\u0e01\\u0e19\\u0e49\\u0e2d\\u0e22'),
            'water:above' => $this->thai('\\u0e25\\u0e14\\u0e19\\u0e49\\u0e33\\u0e41\\u0e25\\u0e30\\u0e1b\\u0e25\\u0e48\\u0e2d\\u0e22\\u0e14\\u0e34\\u0e19\\u0e23\\u0e30\\u0e1a\\u0e32\\u0e22'),
            'light:below' => $this->thai('\\u0e40\\u0e1e\\u0e34\\u0e48\\u0e21\\u0e41\\u0e2a\\u0e07\\u0e43\\u0e2b\\u0e49\\u0e1e\\u0e37\\u0e0a'),
            'light:above' => $this->thai('\\u0e25\\u0e14\\u0e41\\u0e2a\\u0e07\\u0e2b\\u0e23\\u0e37\\u0e2d\\u0e40\\u0e1e\\u0e34\\u0e48\\u0e21\\u0e23\\u0e48\\u0e21\\u0e40\\u0e07\\u0e32'),
            'fertilizer:below' => $this->thai('\\u0e40\\u0e1e\\u0e34\\u0e48\\u0e21\\u0e1b\\u0e38\\u0e4b\\u0e22\\u0e17\\u0e35\\u0e25\\u0e30\\u0e19\\u0e49\\u0e2d\\u0e22'),
            'fertilizer:above' => $this->thai('\\u0e25\\u0e14\\u0e1b\\u0e38\\u0e4b\\u0e22\\u0e41\\u0e25\\u0e30\\u0e1e\\u0e31\\u0e01\\u0e23\\u0e32\\u0e01'),
            'soil_humidity:above', 'air_humidity:above' => $this->thai('\\u0e04\\u0e27\\u0e1a\\u0e04\\u0e38\\u0e21\\u0e04\\u0e27\\u0e32\\u0e21\\u0e0a\\u0e37\\u0e49\\u0e19'),
            'soil_humidity:below', 'air_humidity:below' => $this->thai('\\u0e40\\u0e1e\\u0e34\\u0e48\\u0e21\\u0e04\\u0e27\\u0e32\\u0e21\\u0e0a\\u0e37\\u0e49\\u0e19\\u0e43\\u0e2b\\u0e49\\u0e40\\u0e2b\\u0e21\\u0e32\\u0e30\\u0e2a\\u0e21'),
            'soil_temp:above', 'air_temp:above' => $this->thai('\\u0e25\\u0e14\\u0e04\\u0e27\\u0e32\\u0e21\\u0e23\\u0e49\\u0e2d\\u0e19\\u0e23\\u0e2d\\u0e1a\\u0e1e\\u0e37\\u0e0a'),
            'soil_temp:below', 'air_temp:below' => $this->thai('\\u0e40\\u0e1e\\u0e34\\u0e48\\u0e21\\u0e2d\\u0e38\\u0e13\\u0e2b\\u0e20\\u0e39\\u0e21\\u0e34\\u0e43\\u0e2b\\u0e49\\u0e40\\u0e2b\\u0e21\\u0e32\\u0e30\\u0e2a\\u0e21'),
            default => $this->thai('\\u0e1b\\u0e23\\u0e31\\u0e1a').$this->factorLabel($rule->factor).$this->thai('\\u0e43\\u0e2b\\u0e49\\u0e2d\\u0e22\\u0e39\\u0e48\\u0e43\\u0e19\\u0e0a\\u0e48\\u0e27\\u0e07\\u0e40\\u0e2b\\u0e21\\u0e32\\u0e30\\u0e2a\\u0e21'),
        };
    }

    private function factorLabel(string $factor): string
    {
        return match ($factor) {
            'water' => $this->thai('\\u0e19\\u0e49\\u0e33'),
            'light' => $this->thai('\\u0e41\\u0e2a\\u0e07'),
            'fertilizer' => $this->thai('\\u0e1b\\u0e38\\u0e4b\\u0e22'),
            'soil_humidity' => $this->thai('\\u0e04\\u0e27\\u0e32\\u0e21\\u0e0a\\u0e37\\u0e49\\u0e19\\u0e14\\u0e34\\u0e19'),
            'air_humidity' => $this->thai('\\u0e04\\u0e27\\u0e32\\u0e21\\u0e0a\\u0e37\\u0e49\\u0e19\\u0e2d\\u0e32\\u0e01\\u0e32\\u0e28'),
            'soil_temp' => $this->thai('\\u0e2d\\u0e38\\u0e13\\u0e2b\\u0e20\\u0e39\\u0e21\\u0e34\\u0e14\\u0e34\\u0e19'),
            'air_temp' => $this->thai('\\u0e2d\\u0e38\\u0e13\\u0e2b\\u0e20\\u0e39\\u0e21\\u0e34\\u0e2d\\u0e32\\u0e01\\u0e32\\u0e28'),
            default => $factor,
        };
    }

    private function thai(string $escaped): string
    {
        return json_decode('"'.$escaped.'"') ?: $escaped;
    }
}
