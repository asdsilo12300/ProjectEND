<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Achievement;
use App\Models\AdminActivityLog;
use App\Models\Comment;
use App\Models\Item;
use App\Models\ModelAsset;
use App\Models\Pest;
use App\Models\PestConditionRule;
use App\Models\Plant;
use App\Models\PlantConditionRule;
use App\Models\PlantGrowthStage;
use App\Models\PlantHistory;
use App\Models\PlantVisualVariant;
use App\Models\Post;
use App\Models\Quest;
use App\Models\ShopItem;
use App\Models\Simulator;
use App\Models\SimulatorComment;
use App\Services\AdminDataCache;
use App\Services\KnownPlantProfileService;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;

class AdminResourceController extends Controller
{
    public function __construct(private readonly AdminDataCache $cache) {}

    public function lookups(): JsonResponse
    {
        $lookups = $this->cache->rememberLookups(fn (): array => [
            'plants' => Plant::query()->orderBy('name_en')->get(['id', 'name_th', 'name_en'])->toArray(),
            'stages' => PlantGrowthStage::query()->orderBy('plant_id')->orderBy('stage_no')->get(['id', 'plant_id', 'stage_no', 'stage_name'])->toArray(),
            'pests' => Pest::query()->orderBy('name_en')->get(['id', 'name_th', 'name_en'])->toArray(),
            'items' => Item::query()->orderBy('name')->get(['id', 'name', 'type'])->toArray(),
        ]);

        return response()->json(['data' => $lookups]);
    }

    public function index(Request $request, string $resource): JsonResponse
    {
        $config = $this->catalogConfig($resource);

        if ($config !== null) {
            $query = $config['model']::query();
            $this->applyTrashedScope($query, $request);
            if ($config['with'] !== []) {
                $query->with($config['with']);
            }
            if ($config['with_count'] !== []) {
                $query->withCount($config['with_count']);
            }
            $this->applySearch($query, $request, $config['search']);

            $payload = $query->orderBy('id')->paginate(25)->toArray();

            return response()->json([...$payload, 'resource' => $resource, 'mode' => 'catalog']);
        }

        return $this->moderationIndex($request, $resource);
    }

    public function store(Request $request, string $resource): JsonResponse
    {
        $config = $this->catalogConfig($resource);
        abort_if($config === null, 404, 'This resource cannot be created here.');

        $data = $request->validate($this->rules($resource, null, $request));
        $record = DB::transaction(function () use ($config, $data, $resource) {
            $record = $config['model']::query()->create($data);

            if ($resource === 'plants' && $record instanceof Plant) {
                $record->stages()->createMany([
                    ['stage_no' => 1, 'stage_name' => 'Seedling', 'required_growth_point' => 0, 'model_url' => $record->base_model_url, 'description' => 'Automatically created starting stage.'],
                    ['stage_no' => 2, 'stage_name' => 'Sprout', 'required_growth_point' => 40, 'model_url' => $record->base_model_url, 'description' => 'Automatically created intermediate stage.'],
                    ['stage_no' => 3, 'stage_name' => 'Mature', 'required_growth_point' => 100, 'model_url' => $record->base_model_url, 'description' => 'Automatically created mature stage.'],
                ]);

                app(KnownPlantProfileService::class)->apply($record);
            }

            return $record;
        });

        $freshRecord = $record->fresh($resource === 'plants' ? ['stages'] : []);
        AdminActivityLog::record($request->user(), 'created', $resource, $record->id, ['after' => $freshRecord->toArray()]);

        return response()->json(['data' => $freshRecord], 201);
    }

    public function update(Request $request, string $resource, int $record): JsonResponse
    {
        $config = $this->catalogConfig($resource);
        if ($config !== null) {
            $model = $config['model']::query()->findOrFail($record);
            $before = $model->toArray();
            $model->fill($request->validate($this->rules($resource, $record, $request)))->save();
            AdminActivityLog::record($request->user(), 'updated', $resource, $model->id, ['before' => $before, 'after' => $model->fresh()->toArray()]);

            return response()->json(['data' => $model->fresh()]);
        }

        return $this->moderationUpdate($request, $resource, $record);
    }

    public function destroy(Request $request, string $resource, int $record): JsonResponse
    {
        if ($resource === 'activity-logs') {
            abort(405, 'Audit logs cannot be deleted.');
        }

        $config = $this->catalogConfig($resource);
        $modelClass = $config['model'] ?? $this->moderationModel($resource);
        abort_if($modelClass === null, 404, 'Unknown management resource.');
        abort_unless($this->usesSoftDeletes($modelClass), 409, 'This resource is not configured for safe deletion.');
        $model = $modelClass::query()->findOrFail($record);
        $before = $model->toArray();

        try {
            $model->delete();
        } catch (QueryException) {
            return response()->json(['message' => 'This record is still used by related data and cannot be deleted. Disable or archive it instead.'], 422);
        }

        AdminActivityLog::record($request->user(), 'soft_deleted', $resource, $record, ['before' => $before]);

        return response()->json(['message' => 'Record moved to trash.']);
    }

    public function restore(Request $request, string $resource, int $record): JsonResponse
    {
        abort_if($resource === 'activity-logs', 405, 'Audit logs cannot be changed.');

        $config = $this->catalogConfig($resource);
        $modelClass = $config['model'] ?? $this->moderationModel($resource);
        abort_if($modelClass === null, 404, 'Unknown management resource.');
        abort_unless($this->usesSoftDeletes($modelClass), 409, 'This resource does not support restoration.');

        $model = $modelClass::onlyTrashed()->findOrFail($record);
        $model->restore();
        AdminActivityLog::record($request->user(), 'restored', $resource, $record, [
            'after' => $model->fresh()->toArray(),
        ]);

        return response()->json(['message' => 'Record restored.', 'data' => $model->fresh()]);
    }

    private function catalogConfig(string $resource): ?array
    {
        return match ($resource) {
            'plants' => ['model' => Plant::class, 'with' => [], 'with_count' => ['stages', 'conditionRules', 'visualVariants'], 'search' => ['name_th', 'name_en']],
            'plant-stages' => ['model' => PlantGrowthStage::class, 'with' => ['plant:id,name_th,name_en'], 'with_count' => [], 'search' => ['stage_name', 'description']],
            'plant-rules' => ['model' => PlantConditionRule::class, 'with' => ['plant:id,name_th,name_en'], 'with_count' => [], 'search' => ['factor', 'visual_state', 'analysis_result']],
            'plant-variants' => ['model' => PlantVisualVariant::class, 'with' => ['plant:id,name_th,name_en', 'stage:id,stage_name'], 'with_count' => [], 'search' => ['state_key', 'label']],
            'pests' => ['model' => Pest::class, 'with' => [], 'with_count' => ['conditionRules'], 'search' => ['name_th', 'name_en', 'description']],
            'pest-rules' => ['model' => PestConditionRule::class, 'with' => ['pest:id,name_th,name_en', 'plant:id,name_th,name_en'], 'with_count' => [], 'search' => ['factor']],
            'items' => ['model' => Item::class, 'with' => [], 'with_count' => [], 'search' => ['name', 'type', 'description']],
            'shop-items' => ['model' => ShopItem::class, 'with' => ['item:id,name,type,image_url'], 'with_count' => [], 'search' => []],
            'model-assets' => ['model' => ModelAsset::class, 'with' => [], 'with_count' => [], 'search' => ['asset_key', 'label', 'type', 'url']],
            'quests' => ['model' => Quest::class, 'with' => [], 'with_count' => [], 'search' => ['title', 'description', 'quest_type']],
            'achievements' => ['model' => Achievement::class, 'with' => [], 'with_count' => [], 'search' => ['title', 'description', 'condition_type']],
            default => null,
        };
    }

    private function rules(string $resource, ?int $id = null, ?Request $request = null): array
    {
        $requiredPercent = ['required', 'integer', 'between:0,100'];
        $nullableUrl = ['nullable', 'string', 'max:2048'];
        $activePlant = Rule::exists('plants', 'id')->whereNull('deleted_at');
        $plantId = (int) $request?->input('plant_id', 0);
        $activeStageForPlant = Rule::exists('plant_growth_stages', 'id')->whereNull('deleted_at')->where('plant_id', $plantId);
        $activePest = Rule::exists('pests', 'id')->whereNull('deleted_at');
        $activeItem = Rule::exists('items', 'id')->whereNull('deleted_at');

        return match ($resource) {
            'plants' => [
                'name_th' => ['required', 'string', 'max:191', Rule::unique('plants', 'name_th')->ignore($id)],
                'name_en' => ['nullable', 'string', 'max:191'], 'description' => ['nullable', 'string', 'max:5000'],
                'base_image_url' => $nullableUrl, 'base_model_url' => ['required', 'string', 'max:2048'],
                'real_maturity_days' => ['sometimes', 'required', 'integer', 'between:1,3650'],
                'growth_reference_url' => ['nullable', 'url', 'max:2048'],
                'water_min' => $requiredPercent, 'water_max' => $requiredPercent, 'light_min' => $requiredPercent, 'light_max' => $requiredPercent,
                'fertilizer_min' => $requiredPercent, 'fertilizer_max' => $requiredPercent, 'soil_humidity_min' => $requiredPercent, 'soil_humidity_max' => $requiredPercent,
                'air_humidity_min' => $requiredPercent, 'air_humidity_max' => $requiredPercent,
                'soil_temp_min' => ['required', 'numeric', 'between:-50,100'], 'soil_temp_max' => ['required', 'numeric', 'between:-50,100'],
                'air_temp_min' => ['required', 'numeric', 'between:-50,100'], 'air_temp_max' => ['required', 'numeric', 'between:-50,100'],
            ],
            'plant-stages' => ['plant_id' => ['required', $activePlant], 'stage_no' => ['required', 'integer', 'between:1,99', Rule::unique('plant_growth_stages', 'stage_no')->where('plant_id', $plantId)->ignore($id)], 'stage_name' => ['required', 'string', 'max:191'], 'required_growth_point' => ['required', 'integer', 'min:0'], 'image_url' => $nullableUrl, 'model_url' => $nullableUrl, 'description' => ['nullable', 'string', 'max:5000']],
            'plant-rules' => ['plant_id' => ['required', $activePlant], 'factor' => ['required', 'string', 'max:80'], 'operator' => ['required', Rule::in(['below', 'above', 'between', 'outside'])], 'min_value' => ['nullable', 'numeric'], 'max_value' => ['nullable', 'numeric'], 'visual_state' => ['required', 'string', 'max:80'], 'severity' => ['required', 'integer', 'between:1,10'], 'health_delta' => ['required', 'integer', 'between:-100,100'], 'growth_delta' => ['required', 'integer', 'between:-100,100'], 'analysis_result' => ['nullable', 'string', 'max:2000'], 'direction' => ['nullable', 'string', 'max:2000'], 'is_active' => ['required', 'boolean']],
            'plant-variants' => ['plant_id' => ['required', $activePlant], 'stage_id' => ['nullable', $activeStageForPlant], 'state_key' => ['required', 'string', 'max:100'], 'label' => ['nullable', 'string', 'max:191'], 'model_url' => $nullableUrl, 'leaf_color' => ['nullable', 'string', 'max:30'], 'stem_color' => ['nullable', 'string', 'max:30'], 'leaf_state' => ['nullable', 'string', 'max:80'], 'stem_state' => ['nullable', 'string', 'max:80'], 'scale' => ['required', 'numeric', 'between:0.01,20'], 'priority' => ['required', 'integer', 'between:0,999'], 'is_active' => ['required', 'boolean']],
            'pests' => ['name_th' => ['required', 'string', 'max:191', Rule::unique('pests', 'name_th')->ignore($id)], 'name_en' => ['nullable', 'string', 'max:191'], 'description' => ['nullable', 'string', 'max:5000'], 'image_url' => $nullableUrl, 'model_url' => $nullableUrl, 'base_chance' => ['required', 'numeric', 'between:0,100'], 'damage_per_turn' => ['required', 'integer', 'between:0,100'], 'behavior' => ['nullable', 'string', 'max:5000']],
            'pest-rules' => ['pest_id' => ['required', $activePest], 'plant_id' => ['nullable', $activePlant], 'factor' => ['required', 'string', 'max:80'], 'operator' => ['required', Rule::in(['below', 'above', 'between', 'outside'])], 'min_value' => ['nullable', 'numeric'], 'max_value' => ['nullable', 'numeric'], 'chance_delta' => ['required', 'numeric', 'between:-100,100'], 'severity' => ['required', 'integer', 'between:1,10'], 'is_active' => ['required', 'boolean']],
            'items' => ['name' => ['required', 'string', 'max:191'], 'type' => ['required', Rule::in(['seed', 'water', 'fertilizer', 'pesticide', 'booster', 'cosmetic'])], 'description' => ['nullable', 'string', 'max:5000'], 'image_url' => $nullableUrl, 'effect_type' => ['nullable', 'string', 'max:100'], 'effect_value' => ['required', 'integer', 'between:-10000,10000'], 'rarity' => ['required', Rule::in(['common', 'rare', 'epic', 'legendary'])], 'is_active' => ['required', 'boolean']],
            'shop-items' => ['item_id' => ['required', $activeItem, Rule::unique('shop_items', 'item_id')->ignore($id)], 'price_coin' => ['required', 'integer', 'min:0'], 'price_gem' => ['required', 'integer', 'min:0'], 'stock_limit' => ['nullable', 'integer', 'min:0'], 'is_active' => ['required', 'boolean'], 'starts_at' => ['nullable', 'date'], 'ends_at' => ['nullable', 'date', 'after_or_equal:starts_at']],
            'model-assets' => ['asset_key' => ['required', 'string', 'max:191', Rule::unique('model_assets', 'asset_key')->ignore($id)], 'label' => ['nullable', 'string', 'max:191'], 'type' => ['required', 'string', 'max:80'], 'url' => ['required', 'string', 'max:2048'], 'metadata' => ['nullable', 'array']],
            'quests' => ['title' => ['required', 'string', 'max:191'], 'description' => ['nullable', 'string', 'max:5000'], 'quest_type' => ['required', Rule::in(['daily', 'weekly', 'story', 'event'])], 'target_type' => ['required', 'string', 'max:100'], 'target_value' => ['required', 'integer', 'min:1'], 'reward_exp' => ['required', 'integer', 'min:0'], 'reward_coin' => ['required', 'integer', 'min:0'], 'reward_gem' => ['required', 'integer', 'min:0'], 'is_active' => ['required', 'boolean']],
            'achievements' => ['title' => ['required', 'string', 'max:191'], 'description' => ['nullable', 'string', 'max:5000'], 'condition_type' => ['required', 'string', 'max:100'], 'condition_value' => ['required', 'integer', 'min:1'], 'reward_exp' => ['required', 'integer', 'min:0'], 'reward_coin' => ['required', 'integer', 'min:0'], 'badge_image_url' => $nullableUrl, 'is_active' => ['required', 'boolean']],
            default => [],
        };
    }

    private function moderationIndex(Request $request, string $resource): JsonResponse
    {
        $query = match ($resource) {
            'posts' => Post::query()->with('user:id,username,email,avatar_url')->withCount(['comments', 'likes']),
            'comments' => Comment::query()->with('user:id,username,email,avatar_url')->withCount(['replies', 'likes']),
            'simulator-comments' => SimulatorComment::query()->with(['user:id,username,email,avatar_url', 'simulator:id,user_id,plant_id,status']),
            'simulators' => Simulator::query()->with(['user:id,username,email,avatar_url', 'plant:id,name_th,name_en'])->withCount('posts'),
            'plant-histories' => PlantHistory::query()->with(['user:id,username,email,avatar_url', 'plant:id,name_th,name_en']),
            'activity-logs' => AdminActivityLog::query()->with('admin:id,username,email'),
            default => abort(404, 'Unknown management resource.'),
        };

        if ($resource !== 'activity-logs') {
            $this->applyTrashedScope($query, $request);
        }

        $search = trim((string) $request->query('search', ''));
        if ($search !== '') {
            $query->where(function ($nested) use ($resource, $search): void {
                $like = '%'.$search.'%';
                if ($resource === 'posts') {
                    $nested->whereLike('caption', $like, caseSensitive: false)->orWhereHas('user', fn ($user) => $user->whereLike('username', $like, caseSensitive: false)->orWhereLike('email', $like, caseSensitive: false));
                } elseif (in_array($resource, ['comments', 'simulator-comments'], true)) {
                    $nested->whereLike('comment_text', $like, caseSensitive: false)->orWhereHas('user', fn ($user) => $user->whereLike('username', $like, caseSensitive: false));
                } elseif ($resource === 'activity-logs') {
                    $nested->whereLike('action', $like, caseSensitive: false)->orWhereLike('target_type', $like, caseSensitive: false)->orWhereLike('detail', $like, caseSensitive: false);
                } else {
                    $nested->where('id', (int) $search)->orWhereHas('user', fn ($user) => $user->whereLike('username', $like, caseSensitive: false)->orWhereLike('email', $like, caseSensitive: false));
                }
            });
        }

        if ($request->filled('status')) {
            $statusColumn = in_array($resource, ['posts', 'plant-histories'], true) ? 'visibility' : 'status';
            if ($resource !== 'activity-logs') {
                $query->where($statusColumn, (string) $request->query('status'));
            }
        }

        $orderColumn = $resource === 'activity-logs' ? 'id' : 'created_at';

        return response()->json($query->orderBy($orderColumn)->orderBy('id')->paginate(25));
    }

    private function moderationUpdate(Request $request, string $resource, int $record): JsonResponse
    {
        $modelClass = $this->moderationModel($resource);
        abort_if($modelClass === null || $resource === 'activity-logs', 404, 'This resource cannot be changed.');
        $model = $modelClass::query()->findOrFail($record);
        $before = $model->toArray();
        $data = match ($resource) {
            'posts', 'plant-histories' => $request->validate(['visibility' => ['required', Rule::in(['private', 'friends', 'public'])]]),
            'comments', 'simulator-comments' => $request->validate(['status' => ['required', Rule::in(['visible', 'hidden', 'suspended'])]]),
            'simulators' => $request->validate(['status' => ['required', Rule::in(['active', 'completed', 'failed', 'cancelled'])], 'share_visibility' => ['required', Rule::in(['private', 'friends', 'public'])]]),
            default => [],
        };
        $model->forceFill($data)->save();
        AdminActivityLog::record($request->user(), 'moderated', $resource, $model->id, ['before' => $before, 'after' => $model->fresh()->toArray()]);

        return response()->json(['data' => $model->fresh()]);
    }

    private function moderationModel(string $resource): ?string
    {
        return match ($resource) {
            'posts' => Post::class, 'comments' => Comment::class, 'simulator-comments' => SimulatorComment::class,
            'simulators' => Simulator::class, 'plant-histories' => PlantHistory::class, 'activity-logs' => AdminActivityLog::class,
            default => null,
        };
    }

    private function applySearch($query, Request $request, array $columns): void
    {
        $search = trim((string) $request->query('search', ''));
        if ($search === '' || $columns === []) {
            return;
        }
        $query->where(function ($nested) use ($columns, $search): void {
            foreach ($columns as $index => $column) {
                $method = $index === 0 ? 'whereLike' : 'orWhereLike';
                $nested->{$method}($column, '%'.$search.'%', caseSensitive: false);
            }
        });
    }

    private function applyTrashedScope($query, Request $request): void
    {
        if ($request->query('trashed') === 'only') {
            $query->onlyTrashed();
        } elseif ($request->query('trashed') === 'with') {
            $query->withTrashed();
        }
    }

    private function usesSoftDeletes(string $modelClass): bool
    {
        return in_array(SoftDeletes::class, class_uses_recursive($modelClass), true);
    }
}
