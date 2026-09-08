<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Achievement;
use App\Models\AdminActivityLog;
use App\Models\AnimationPreset;
use App\Models\Comment;
use App\Models\CommentReport;
use App\Models\EventDefinition;
use App\Models\Item;
use App\Models\ItemType;
use App\Models\ModelAsset;
use App\Models\Pest;
use App\Models\PestConditionRule;
use App\Models\PestKnowledge;
use App\Models\Plant;
use App\Models\PlantConditionRule;
use App\Models\PlantGrowthStage;
use App\Models\PlantHistory;
use App\Models\PlantKnowledge;
use App\Models\PlantVisualVariant;
use App\Models\Post;
use App\Models\Quest;
use App\Models\ShopItem;
use App\Models\Simulator;
use App\Models\SimulatorComment;
use App\Models\SimulationModeReward;
use App\Services\AdminDataCache;
use App\Services\AdminSimulationDataValidator;
use App\Services\KnownPlantProfileService;
use App\Services\PlantKnowledgeProfileService;
use App\Services\PublicCatalogCache;
use App\Support\LocalizedFieldLanguageValidator;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Database\QueryException;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AdminResourceController extends Controller
{
    public function __construct(
        private readonly AdminDataCache $cache,
        private readonly PublicCatalogCache $catalogCache,
        private readonly AdminSimulationDataValidator $simulationDataValidator,
    ) {}

    public function lookups(): JsonResponse
    {
        $lookups = $this->cache->rememberLookups(fn (): array => [
            'plants' => Plant::query()->orderBy('name_en')->get(['id', 'name_th', 'name_en', 'base_image_url', 'base_model_url'])->toArray(),
            'stages' => PlantGrowthStage::query()->orderBy('plant_id')->orderBy('stage_no')->get(['id', 'plant_id', 'stage_no', 'stage_name', 'required_growth_point', 'image_url', 'model_url'])->toArray(),
            'plantVariants' => PlantVisualVariant::query()->where('is_active', true)->orderBy('plant_id')->orderByDesc('priority')->get(['id', 'plant_id', 'stage_id', 'state_key', 'label', 'model_url', 'leaf_color', 'stem_color', 'leaf_state', 'stem_state', 'scale', 'priority'])->toArray(),
            'pests' => Pest::query()->orderBy('name_en')->get(['id', 'name_th', 'name_en', 'image_url', 'model_url', 'placement_mode'])->toArray(),
            'items' => Item::query()->orderBy('name')->get(['id', 'name', 'type', 'action_key'])->toArray(),
            'itemTypes' => ItemType::query()->where('is_active', true)->orderBy('sort_order')->orderBy('name_en')->get(['id', 'key', 'name_en', 'name_th'])->toArray(),
            'animationPresets' => AnimationPreset::query()->where('is_active', true)->orderBy('name_en')->get()->toArray(),
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

            $perPage = min(250, max(1, (int) $request->input('per_page', 25)));
            $payload = $query->orderBy('id')->paginate($perPage)->toArray();

            return response()->json([...$payload, 'resource' => $resource, 'mode' => 'catalog']);
        }

        return $this->moderationIndex($request, $resource);
    }

    public function commentReportSummary(): JsonResponse
    {
        if (! Schema::hasTable('comment_reports')) {
            return response()->json(['data' => ['total' => 0, 'post' => 0, 'simulator' => 0]]);
        }

        $counts = CommentReport::query()
            ->where('status', 'pending')
            ->selectRaw('comment_type, COUNT(*) AS aggregate')
            ->groupBy('comment_type')
            ->pluck('aggregate', 'comment_type');

        $post = (int) ($counts['post'] ?? 0);
        $simulator = (int) ($counts['simulator'] ?? 0);

        return response()->json(['data' => [
            'total' => $post + $simulator,
            'post' => $post,
            'simulator' => $simulator,
        ]]);
    }

    public function resolveCommentReports(Request $request, string $resource, int $record): JsonResponse
    {
        abort_unless(in_array($resource, ['comments', 'simulator-comments'], true), 404, 'This resource does not support comment reports.');
        abort_unless(Schema::hasTable('comment_reports'), 404, 'Comment reporting is not available.');

        $modelClass = $this->moderationModel($resource);
        $model = $modelClass::query()->findOrFail($record);
        $commentType = $resource === 'comments' ? 'post' : 'simulator';
        $resolvedCount = CommentReport::query()
            ->where('comment_type', $commentType)
            ->where('comment_id', $model->id)
            ->where('status', 'pending')
            ->update(['status' => 'resolved', 'updated_at' => now()]);

        AdminActivityLog::record($request->user(), 'resolved-comment-reports', $resource, $model->id, ['resolved_count' => $resolvedCount]);

        return response()->json(['data' => ['resolved_count' => $resolvedCount]]);
    }

    public function store(Request $request, string $resource): JsonResponse
    {
        abort_if($resource === 'simulation-mode-rewards', 405, 'Simulation mode rows are fixed and cannot be added.');
        $config = $this->catalogConfig($resource);
        abort_if($config === null, 404, 'This resource cannot be created here.');

        $data = $this->validatedData($request, $resource);
        LocalizedFieldLanguageValidator::validateOrFail($data);
        if ($resource === 'item-types' && ! array_key_exists('sort_order', $data)) {
            $data['sort_order'] = ((int) ItemType::withTrashed()->max('sort_order')) + 10;
        }
        try {
            $record = DB::transaction(function () use ($config, $data, $resource) {
                $record = $config['model']::query()->create($data);

                if ($resource === 'plants' && $record instanceof Plant) {
                    $record->stages()->createMany([
                        ['stage_no' => 1, 'stage_name' => 'Seedling', 'required_growth_point' => 0, 'model_url' => $record->base_model_url, 'description' => 'Automatically created starting stage.'],
                        ['stage_no' => 2, 'stage_name' => 'Sprout', 'required_growth_point' => 40, 'model_url' => $record->base_model_url, 'description' => 'Automatically created intermediate stage.'],
                        ['stage_no' => 3, 'stage_name' => 'Mature', 'required_growth_point' => 100, 'model_url' => $record->base_model_url, 'description' => 'Automatically created mature stage.'],
                    ]);

                    app(KnownPlantProfileService::class)->apply($record);
                    app(PlantKnowledgeProfileService::class)->syncIfMissing($record);
                }

                return $record;
            });
        } catch (QueryException) {
            throw ValidationException::withMessages(['record' => 'This record conflicts with data already stored in this table. Check duplicate names, keys, and grouped values.']);
        }

        $freshRecord = $record->fresh($resource === 'plants' ? ['stages', 'knowledge'] : []);
        AdminActivityLog::record($request->user(), 'created', $resource, $record->id, ['after' => $freshRecord->toArray()]);
        $this->cache->clear();
        $this->catalogCache->clear();

        return response()->json(['data' => $freshRecord], 201);
    }

    public function update(Request $request, string $resource, int $record): JsonResponse
    {
        $config = $this->catalogConfig($resource);
        if ($config !== null) {
            $model = $config['model']::query()->findOrFail($record);
            $before = $model->toArray();
            $data = $this->validatedData($request, $resource, $record);
            LocalizedFieldLanguageValidator::validateOrFail($data);
            if ($resource === 'item-types' && $model instanceof ItemType && $model->items()->withTrashed()->exists()) {
                if ($model->key !== $data['key']) {
                    throw ValidationException::withMessages(['key' => 'This key is used by existing items and cannot be changed.']);
                }
                if (! $data['is_active']) {
                    throw ValidationException::withMessages(['is_active' => 'This type is used by existing items and cannot be disabled.']);
                }
            }
            if ($resource === 'animation-presets' && $model instanceof AnimationPreset && $model->items()->withTrashed()->exists() && ! $data['is_active']) {
                throw ValidationException::withMessages(['is_active' => 'This animation preset is used by existing items and cannot be disabled.']);
            }
            try {
                $model->fill($data)->save();
            } catch (QueryException) {
                throw ValidationException::withMessages(['record' => 'These changes conflict with data already stored in this table. Check duplicate names, keys, and grouped values.']);
            }

            // A known plant may have been created before its automatic
            // profile was added. Backfill only incomplete profiles so an
            // intentionally tuned, complete profile is never overwritten.
            if ($resource === 'plants' && $model instanceof Plant) {
                app(KnownPlantProfileService::class)->applyIfMissing($model->fresh());
            }

            // Keep the legacy animation key synchronized for older saved
            // simulations while the live catalog reads the richer preset.
            if ($resource === 'animation-presets' && $model instanceof AnimationPreset) {
                $model->items()->withTrashed()->update(['animation_key' => $model->motion_type]);
            }

            AdminActivityLog::record($request->user(), 'updated', $resource, $model->id, ['before' => $before, 'after' => $model->fresh()->toArray()]);
            $this->cache->clear();
            $this->catalogCache->clear();

            return response()->json(['data' => $model->fresh()]);
        }

        return $this->moderationUpdate($request, $resource, $record);
    }

    public function destroy(Request $request, string $resource, int $record): JsonResponse
    {
        abort_if(
            in_array($resource, ['simulators', 'plant-histories'], true),
            405,
            'Simulation and plant history records are permanent and cannot be deleted.',
        );
        abort_if($resource === 'simulation-mode-rewards', 405, 'Simulation mode rewards cannot be deleted.');
        if ($resource === 'activity-logs') {
            abort(405, 'Audit logs cannot be deleted.');
        }

        $config = $this->catalogConfig($resource);
        $modelClass = $config['model'] ?? $this->moderationModel($resource);
        abort_if($modelClass === null, 404, 'Unknown management resource.');
        abort_unless($this->usesSoftDeletes($modelClass), 409, 'This resource is not configured for safe deletion.');
        $model = $modelClass::query()->findOrFail($record);
        if ($resource === 'item-types' && $model instanceof ItemType && $model->items()->withTrashed()->exists()) {
            return response()->json(['message' => 'This item type is used by existing items and cannot be deleted. Move those items to another type first.'], 422);
        }
        if ($resource === 'animation-presets' && $model instanceof AnimationPreset && $model->items()->withTrashed()->exists()) {
            return response()->json(['message' => 'This animation preset is used by existing items and cannot be deleted. Move those items to another preset first.'], 422);
        }
        $before = $model->toArray();

        try {
            $model->delete();
        } catch (QueryException) {
            return response()->json(['message' => 'This record is still used by related data and cannot be deleted. Disable or archive it instead.'], 422);
        }

        AdminActivityLog::record($request->user(), 'soft_deleted', $resource, $record, ['before' => $before]);
        $this->cache->clear();
        $this->catalogCache->clear();

        return response()->json(['message' => 'Record moved to trash.']);
    }

    public function restore(Request $request, string $resource, int $record): JsonResponse
    {
        abort_if(
            in_array($resource, ['simulators', 'plant-histories'], true),
            405,
            'Simulation and plant history records are view-only and cannot be restored.',
        );
        abort_if($resource === 'activity-logs', 405, 'Audit logs cannot be changed.');

        $config = $this->catalogConfig($resource);
        $modelClass = $config['model'] ?? $this->moderationModel($resource);
        abort_if($modelClass === null, 404, 'Unknown management resource.');
        abort_unless($this->usesSoftDeletes($modelClass), 409, 'This resource does not support restoration.');

        $model = $modelClass::onlyTrashed()->findOrFail($record);
        abort_if(
            $resource === 'simulators' && $model->status === 'cancelled',
            409,
            'Cancelled simulations cannot be restored. They are retained as locked audit records.',
        );
        $model->restore();
        AdminActivityLog::record($request->user(), 'restored', $resource, $record, [
            'after' => $model->fresh()->toArray(),
        ]);
        $this->cache->clear();
        $this->catalogCache->clear();

        return response()->json(['message' => 'Record restored.', 'data' => $model->fresh()]);
    }

    public function generatePlantSetup(Request $request, Plant $plant): JsonResponse
    {
        $before = [
            'rules' => $plant->conditionRules()->count(),
            'visuals' => $plant->visualVariants()->count(),
        ];

        $factorProfiles = [
            'water' => ['underwatered', 'overwatered', 'water_min', 'water_max'],
            'light' => ['low_light', 'light_stress', 'light_min', 'light_max'],
            'fertilizer' => ['nutrient_deficient', 'fertilizer_burn', 'fertilizer_min', 'fertilizer_max'],
            'soil_humidity' => ['dry_soil', 'waterlogged', 'soil_humidity_min', 'soil_humidity_max'],
            'air_humidity' => ['dry_air', 'fungal_risk', 'air_humidity_min', 'air_humidity_max'],
            'soil_temp' => ['cold_stress', 'heat_stress', 'soil_temp_min', 'soil_temp_max'],
            'air_temp' => ['cold_stress', 'heat_stress', 'air_temp_min', 'air_temp_max'],
        ];

        $visualProfiles = [
            'healthy' => ['Healthy', '#5f9d45', '#6d8e43', 'upright', 'upright', 1.00, 10],
            'underwatered' => ['Low water', '#948744', '#71613b', 'wilted', 'leaning', .92, 70],
            'overwatered' => ['Excess water', '#80965d', '#617b58', 'drooping', 'soft', .94, 76],
            'low_light' => ['Low light', '#a2ae68', '#82905d', 'pale', 'thin', .90, 60],
            'light_stress' => ['Strong light', '#9a7240', '#72503a', 'burnt_edges', 'dry', .91, 72],
            'nutrient_deficient' => ['Low nutrients', '#b0aa56', '#898646', 'yellowing', 'thin', .91, 58],
            'fertilizer_burn' => ['Excess fertilizer', '#98633e', '#704b35', 'burnt_edges', 'dry', .88, 80],
            'dry_soil' => ['Dry soil', '#9d8240', '#735e35', 'wilted', 'leaning', .91, 66],
            'waterlogged' => ['Wet soil', '#78905a', '#5c7354', 'yellowing', 'soft', .91, 84],
            'dry_air' => ['Dry air', '#9c8252', '#756143', 'wilted', 'dry', .92, 52],
            'fungal_risk' => ['High humidity', '#6f795b', '#606b51', 'spotted', 'soft', .90, 86],
            'cold_stress' => ['Cold stress', '#647d70', '#5e7060', 'darkened', 'slow', .91, 68],
            'heat_stress' => ['Heat stress', '#a4773d', '#775336', 'wilted', 'leaning', .90, 78],
        ];

        DB::transaction(function () use ($factorProfiles, $plant, $visualProfiles): void {
            foreach ($factorProfiles as $factor => [$lowState, $highState, $minimumKey, $maximumKey]) {
                $minimum = $plant->{$minimumKey};
                $maximum = $plant->{$maximumKey};
                $lowRule = PlantConditionRule::withTrashed()->firstOrCreate(
                    ['plant_id' => $plant->id, 'factor' => $factor, 'operator' => 'below'],
                    ['visual_state' => $lowState, 'min_value' => $minimum, 'max_value' => null, 'severity' => 6, 'health_delta' => -7, 'growth_delta' => -5, 'analysis_result' => "{$factor} is below the suitable range.", 'direction' => "Raise {$factor} gradually toward the suitable range.", 'is_active' => true],
                );
                if ($lowRule->trashed()) $lowRule->restore();
                $highRule = PlantConditionRule::withTrashed()->firstOrCreate(
                    ['plant_id' => $plant->id, 'factor' => $factor, 'operator' => 'above'],
                    ['visual_state' => $highState, 'min_value' => null, 'max_value' => $maximum, 'severity' => 7, 'health_delta' => -8, 'growth_delta' => -5, 'analysis_result' => "{$factor} is above the suitable range.", 'direction' => "Lower {$factor} gradually toward the suitable range.", 'is_active' => true],
                );
                if ($highRule->trashed()) $highRule->restore();
            }

            foreach ($visualProfiles as $state => [$label, $leafColor, $stemColor, $leafState, $stemState, $scale, $priority]) {
                $variant = PlantVisualVariant::withTrashed()->firstOrCreate(
                    ['plant_id' => $plant->id, 'stage_id' => null, 'state_key' => $state],
                    ['label' => $label, 'model_url' => null, 'leaf_color' => $leafColor, 'stem_color' => $stemColor, 'leaf_state' => $leafState, 'stem_state' => $stemState, 'scale' => $scale, 'priority' => $priority, 'is_active' => true],
                );
                if ($variant->trashed()) $variant->restore();
            }
        });

        $plant->refresh()->loadCount(['conditionRules', 'visualVariants']);
        AdminActivityLog::record($request->user(), 'generated_plant_setup', 'plants', $plant->id, [
            'before' => $before,
            'after' => ['rules' => $plant->condition_rules_count, 'visuals' => $plant->visual_variants_count],
        ]);
        $this->cache->clear();
        $this->catalogCache->clear();

        return response()->json([
            'message' => 'Recommended plant rules and visual states were generated.',
            'data' => $plant,
        ]);
    }

    private function catalogConfig(string $resource): ?array
    {
        return match ($resource) {
            'plants' => ['model' => Plant::class, 'with' => [], 'with_count' => ['stages', 'conditionRules', 'visualVariants', 'knowledge'], 'search' => ['name_th', 'name_en']],
            'plant-knowledge' => ['model' => PlantKnowledge::class, 'with' => ['plant:id,name_th,name_en'], 'with_count' => [], 'search' => ['scientific_name', 'family', 'category_en', 'category_th', 'summary_en', 'summary_th']],
            'plant-stages' => ['model' => PlantGrowthStage::class, 'with' => ['plant:id,name_th,name_en'], 'with_count' => [], 'search' => ['stage_name', 'description']],
            'plant-rules' => ['model' => PlantConditionRule::class, 'with' => ['plant:id,name_th,name_en'], 'with_count' => [], 'search' => ['factor', 'visual_state', 'analysis_result']],
            'plant-variants' => ['model' => PlantVisualVariant::class, 'with' => ['plant:id,name_th,name_en', 'stage:id,stage_name'], 'with_count' => [], 'search' => ['state_key', 'label']],
            'pests' => ['model' => Pest::class, 'with' => [], 'with_count' => ['conditionRules', 'knowledge'], 'search' => ['name_th', 'name_en', 'description']],
            'pest-knowledge' => ['model' => PestKnowledge::class, 'with' => ['pest:id,name_th,name_en'], 'with_count' => [], 'search' => ['scientific_name', 'family', 'category_en', 'category_th', 'summary_en', 'summary_th']],
            'pest-rules' => ['model' => PestConditionRule::class, 'with' => ['pest:id,name_th,name_en', 'plant:id,name_th,name_en'], 'with_count' => [], 'search' => ['factor']],
            'item-types' => ['model' => ItemType::class, 'with' => [], 'with_count' => ['items'], 'search' => ['key', 'name_en', 'name_th', 'description_en', 'description_th']],
            'animation-presets' => ['model' => AnimationPreset::class, 'with' => [], 'with_count' => ['items'], 'search' => ['key', 'name_en', 'name_th', 'description_en', 'description_th']],
            'items' => ['model' => Item::class, 'with' => ['typeDefinition:key,name_en,name_th,description_en,description_th,icon,sort_order', 'animationPreset'], 'with_count' => [], 'search' => ['name', 'type', 'description']],
            'shop-items' => ['model' => ShopItem::class, 'with' => ['item:id,name,type,image_url'], 'with_count' => [], 'search' => []],
            'model-assets' => ['model' => ModelAsset::class, 'with' => [], 'with_count' => [], 'search' => ['asset_key', 'label', 'type', 'url']],
            'quests' => ['model' => Quest::class, 'with' => [], 'with_count' => [], 'search' => ['title', 'description', 'quest_type']],
            'achievements' => ['model' => Achievement::class, 'with' => [], 'with_count' => [], 'search' => ['title', 'description', 'condition_type']],
            'simulation-mode-rewards' => ['model' => SimulationModeReward::class, 'with' => [], 'with_count' => [], 'search' => ['mode', 'name_en', 'name_th']],
            'event-definitions' => ['model' => EventDefinition::class, 'with' => [], 'with_count' => ['simulationEvents'], 'search' => ['event_key', 'name_en', 'name_th', 'description_en', 'description_th']],
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
        $activeItemType = Rule::exists('item_types', 'key')->whereNull('deleted_at')->where('is_active', true);
        $activeItem = Rule::exists('items', 'id')->whereNull('deleted_at');
        $activeItemAction = Rule::exists('items', 'action_key')->whereNull('deleted_at')->where('is_active', true);
        $environmentFactors = ['water', 'light', 'fertilizer', 'soil_humidity', 'air_humidity', 'soil_temp', 'air_temp'];
        $visualStates = ['healthy', 'underwatered', 'overwatered', 'dry_soil', 'waterlogged', 'low_light', 'nutrient_deficient', 'fertilizer_burn', 'burnt', 'heat_stress', 'cold_stress', 'dry_air', 'fungal_risk', 'botrytis', 'wind_stress', 'stunted'];
        $leafStates = ['normal', 'upright', 'wilted', 'drooping', 'yellowing', 'pale', 'spotted', 'burnt_edges', 'root_burn', 'darkened', 'small'];
        $stemStates = ['normal', 'upright', 'leaning', 'soft', 'thin', 'dry', 'slow', 'short'];
        $itemAnimations = ['watering-can', 'fertilizer-pour', 'pest-spray', 'hand-pick', 'soil-mix', 'straw-mulch', 'shade-cover', 'windbreak', 'frost-cover', 'place-down', 'pour-liquid', 'scatter', 'spray-mist', 'dig-mix', 'sweep', 'spin-activate', 'hover-pulse', 'bounce-drop', 'shake-use'];

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
            'plant-rules' => ['plant_id' => ['required', $activePlant], 'factor' => ['required', Rule::in($environmentFactors)], 'operator' => ['required', Rule::in(['below', 'above', 'between', 'outside'])], 'min_value' => ['nullable', 'numeric'], 'max_value' => ['nullable', 'numeric'], 'visual_state' => ['required', Rule::in($visualStates)], 'severity' => ['required', 'integer', 'between:1,10'], 'health_delta' => ['required', 'integer', 'between:-100,100'], 'growth_delta' => ['required', 'integer', 'between:-100,100'], 'analysis_result' => ['nullable', 'string', 'max:2000'], 'direction' => ['nullable', 'string', 'max:2000'], 'is_active' => ['required', 'boolean']],
            'plant-variants' => ['plant_id' => ['required', $activePlant], 'stage_id' => ['nullable', $activeStageForPlant], 'state_key' => ['required', Rule::in($visualStates)], 'label' => ['nullable', 'string', 'max:191'], 'model_url' => $nullableUrl, 'leaf_color' => ['nullable', 'string', 'max:30'], 'stem_color' => ['nullable', 'string', 'max:30'], 'leaf_state' => ['nullable', Rule::in($leafStates)], 'stem_state' => ['nullable', Rule::in($stemStates)], 'scale' => ['required', 'numeric', 'between:0.01,20'], 'priority' => ['required', 'integer', 'between:0,999'], 'is_active' => ['required', 'boolean']],
            'plant-knowledge' => [
                'plant_id' => ['required', $activePlant, Rule::unique('plant_knowledge', 'plant_id')->ignore($id)],
                'scientific_name' => ['nullable', 'string', 'max:191'],
                'family' => ['nullable', 'string', 'max:191'],
                'category_en' => ['nullable', 'string', 'max:191'],
                'category_th' => ['nullable', 'string', 'max:191'],
                'summary_en' => ['nullable', 'string', 'max:10000'],
                'summary_th' => ['nullable', 'string', 'max:10000'],
                'care_en' => ['nullable', 'array'],
                'care_en.*' => ['string', 'max:2000'],
                'care_th' => ['nullable', 'array'],
                'care_th.*' => ['string', 'max:2000'],
                'caution_en' => ['nullable', 'string', 'max:5000'],
                'caution_th' => ['nullable', 'string', 'max:5000'],
                'photo_url' => $nullableUrl,
                'photo_alt_en' => ['nullable', 'string', 'max:500'],
                'photo_alt_th' => ['nullable', 'string', 'max:500'],
                'photo_credit' => ['nullable', 'string', 'max:255'],
                'photo_source_url' => $nullableUrl,
                'photo_license' => ['nullable', 'string', 'max:255'],
                'photo_license_url' => $nullableUrl,
                'sources' => ['nullable', 'array'],
                'sources.*' => ['array'],
                'sources.*.label_en' => ['nullable', 'string', 'max:255'],
                'sources.*.label_th' => ['nullable', 'string', 'max:255'],
                'sources.*.url' => ['required', 'url', 'max:2048'],
            ],
            'pests' => ['name_th' => ['required', 'string', 'max:191', Rule::unique('pests', 'name_th')->ignore($id)], 'name_en' => ['nullable', 'string', 'max:191'], 'description' => ['nullable', 'string', 'max:5000'], 'image_url' => $nullableUrl, 'model_url' => ['nullable', 'string', 'max:2048', 'required_unless:placement_mode,plant_surface'], 'placement_mode' => ['required', Rule::in(['ground_random', 'leaf', 'plant_surface'])], 'base_chance' => ['required', 'numeric', 'between:0,100'], 'damage_per_turn' => ['required', 'integer', 'between:0,100'], 'behavior' => ['nullable', 'string', 'max:5000']],
            'pest-knowledge' => [
                'pest_id' => ['required', $activePest, Rule::unique('pest_knowledge', 'pest_id')->ignore($id)],
                'scientific_name' => ['nullable', 'string', 'max:191'],
                'family' => ['nullable', 'string', 'max:191'],
                'category_en' => ['nullable', 'string', 'max:191'],
                'category_th' => ['nullable', 'string', 'max:191'],
                'summary_en' => ['nullable', 'string', 'max:10000'],
                'summary_th' => ['nullable', 'string', 'max:10000'],
                'signs_en' => ['nullable', 'array', 'max:30'],
                'signs_en.*' => ['string', 'max:2000'],
                'signs_th' => ['nullable', 'array', 'max:30'],
                'signs_th.*' => ['string', 'max:2000'],
                'favorable_conditions_en' => ['nullable', 'array', 'max:30'],
                'favorable_conditions_en.*' => ['string', 'max:2000'],
                'favorable_conditions_th' => ['nullable', 'array', 'max:30'],
                'favorable_conditions_th.*' => ['string', 'max:2000'],
                'prevention_en' => ['nullable', 'array', 'max:30'],
                'prevention_en.*' => ['string', 'max:2000'],
                'prevention_th' => ['nullable', 'array', 'max:30'],
                'prevention_th.*' => ['string', 'max:2000'],
                'photo_url' => $nullableUrl,
                'photo_source_url' => ['nullable', 'required_with:photo_url', 'url', 'max:2048'],
                'treatment_action_keys' => ['nullable', 'array', 'max:30'],
                'treatment_action_keys.*' => ['string', 'max:100', 'distinct', $activeItemAction],
                'sources' => ['nullable', 'array', 'max:30'],
                'sources.*' => ['array'],
                'sources.*.label_en' => ['nullable', 'string', 'max:255'],
                'sources.*.label_th' => ['nullable', 'string', 'max:255'],
                'sources.*.url' => ['required', 'url', 'max:2048'],
            ],
            'pest-rules' => ['pest_id' => ['required', $activePest], 'plant_id' => ['nullable', $activePlant], 'factor' => ['required', Rule::in($environmentFactors)], 'operator' => ['required', Rule::in(['below', 'above', 'between', 'outside'])], 'min_value' => ['nullable', 'numeric'], 'max_value' => ['nullable', 'numeric'], 'chance_delta' => ['required', 'numeric', 'between:-100,100'], 'severity' => ['required', 'integer', 'between:1,10'], 'is_active' => ['required', 'boolean']],
            'item-types' => ['key' => ['required', 'string', 'max:100', 'alpha_dash:ascii', Rule::unique('item_types', 'key')->ignore($id)], 'name_en' => ['required', 'string', 'max:191'], 'name_th' => ['required', 'string', 'max:191'], 'description_en' => ['nullable', 'string', 'max:2000'], 'description_th' => ['nullable', 'string', 'max:2000'], 'icon' => ['required', 'string', 'max:2048', function (string $attribute, mixed $value, \Closure $fail): void {
                $icon = trim((string) $value);
                $path = strtolower((string) parse_url($icon, PHP_URL_PATH));
                $isSvg = str_ends_with($path, '.svg') && (str_starts_with($icon, '/storage/') || str_starts_with($icon, '/api/media/') || str_starts_with($icon, '/game-icons/item-types/') || filter_var($icon, FILTER_VALIDATE_URL));
                if (! $isSvg) $fail('Upload an SVG icon. Other icon formats are not supported.');
            }], 'sort_order' => ['sometimes', 'integer', 'between:0,9999'], 'is_active' => ['required', 'boolean']],
            'animation-presets' => ['key' => ['required', 'string', 'max:100', 'alpha_dash:ascii', Rule::unique('animation_presets', 'key')->ignore($id)], 'name_en' => ['required', 'string', 'max:191'], 'name_th' => ['required', 'string', 'max:191'], 'description_en' => ['nullable', 'string', 'max:2000'], 'description_th' => ['nullable', 'string', 'max:2000'], 'motion_type' => ['required', Rule::in($itemAnimations)], 'effect_type' => ['required', Rule::in(['none', 'water', 'spray', 'fertilizer', 'drainage', 'light', 'air', 'temperature'])], 'target_type' => ['required', Rule::in(['plant', 'soil', 'pest', 'scene'])], 'duration_ms' => ['required', 'integer', 'between:300,10000'], 'speed' => ['required', 'numeric', 'between:0.1,5'], 'amplitude' => ['required', 'numeric', 'between:0,3'], 'particle_color' => ['required', 'regex:/^#[0-9a-fA-F]{6}$/'], 'particle_count' => ['required', 'integer', 'between:0,100'], 'scale' => ['required', 'numeric', 'between:0.1,5'], 'is_active' => ['required', 'boolean']],
            'items' => ['name' => ['required', 'string', 'max:191'], 'type' => ['required', 'string', $activeItemType], 'pest_id' => ['nullable', 'required_if:type,prank', $activePest], 'description' => ['nullable', 'string', 'max:5000'], 'image_url' => $nullableUrl, 'model_url' => $nullableUrl, 'effect_type' => ['nullable', 'string', 'max:100'], 'effect_value' => ['required', 'integer', 'between:-10000,10000'], 'action_key' => ['nullable', 'string', 'max:100', Rule::unique('items', 'action_key')->ignore($id)], 'animation_key' => ['nullable', 'string', 'max:100'], 'animation_preset_id' => ['nullable', Rule::exists('animation_presets', 'id')->whereNull('deleted_at')->where('is_active', true)], 'mode_scope' => ['required', Rule::in(['both', 'greenhouse', 'outdoor', 'seasonal'])], 'effect_payload' => ['nullable', 'array'], 'effect_payload.pest_id' => ['nullable', $activePest], 'effect_payload.strategy' => ['nullable', Rule::in(['refill_reserve', 'toward_healthy_midpoint', 'drainage', 'moisture_retention'])], 'effect_payload.resource' => ['nullable', Rule::in($environmentFactors)], 'effect_payload.duration_ticks' => ['nullable', 'integer', 'between:1,100'], 'effect_payload.duration_seconds' => ['nullable', 'integer', 'between:5,300'], 'rarity' => ['required', Rule::in(['common', 'rare', 'epic', 'legendary'])], 'is_active' => ['required', 'boolean']],
            'shop-items' => ['item_id' => ['required', $activeItem, Rule::unique('shop_items', 'item_id')->ignore($id)], 'price_coin' => ['required', 'integer', 'min:0'], 'price_gem' => ['required', 'integer', 'min:0'], 'stock_limit' => ['nullable', 'integer', 'min:0'], 'is_active' => ['required', 'boolean']],
            'model-assets' => ['asset_key' => ['required', 'string', 'max:191', Rule::unique('model_assets', 'asset_key')->ignore($id)], 'label' => ['nullable', 'string', 'max:191'], 'type' => ['required', Rule::in(['model', 'plant', 'scene', 'pest', 'item', 'action', 'effect'])], 'url' => ['required', 'string', 'max:2048'], 'metadata' => ['nullable', 'array']],
            'quests' => ['title' => ['required', 'string', 'max:191'], 'description' => ['nullable', 'string', 'max:5000'], 'quest_type' => ['required', Rule::in(['daily', 'weekly', 'story', 'event'])], 'target_type' => ['required', Rule::in(['simulation_started', 'simulation_completed', 'plant_harvested', 'item_used', 'item_purchased', 'post_created', 'comment_created', 'friend_added'])], 'target_value' => ['required', 'integer', 'min:1'], 'reward_exp' => ['required', 'integer', 'min:0'], 'reward_coin' => ['required', 'integer', 'min:0'], 'reward_gem' => ['required', 'integer', 'min:0'], 'is_active' => ['required', 'boolean']],
            'achievements' => ['title' => ['required', 'string', 'max:191'], 'description' => ['nullable', 'string', 'max:5000'], 'condition_type' => ['required', Rule::in(['simulation_started', 'simulation_completed', 'plant_harvested', 'perfect_health_harvest', 'item_used', 'item_purchased', 'post_created', 'friend_added', 'level_reached'])], 'condition_value' => ['required', 'integer', 'min:1'], 'reward_exp' => ['required', 'integer', 'min:0'], 'reward_coin' => ['required', 'integer', 'min:0'], 'badge_image_url' => $nullableUrl, 'is_active' => ['required', 'boolean']],
            'simulation-mode-rewards' => [
                'mode' => ['required', Rule::in(['greenhouse', 'outdoor', 'seasonal']), Rule::unique('simulation_mode_rewards', 'mode')->ignore($id)],
                'name_en' => ['required', 'string', 'max:120'],
                'name_th' => ['required', 'string', 'max:120'],
                'experience_reward' => ['required', 'integer', 'between:0,1000000'],
                'coin_reward' => ['required', 'integer', 'between:0,1000000'],
                'is_active' => ['required', 'boolean'],
            ],
            'event-definitions' => [
                'event_key' => ['required', 'string', 'max:120', Rule::unique('event_definitions', 'event_key')->ignore($id)],
                'name_en' => ['required', 'string', 'max:191'], 'name_th' => ['required', 'string', 'max:191'],
                'description_en' => ['nullable', 'string', 'max:4000'], 'description_th' => ['nullable', 'string', 'max:4000'],
                'mode_scope' => ['required', Rule::in(['both', 'greenhouse', 'outdoor', 'seasonal'])],
                'severity' => ['required', Rule::in(['low', 'medium', 'high'])],
                'weight' => ['required', 'integer', 'between:1,100'], 'trigger_chance' => ['required', 'integer', 'between:0,100'],
                'warning_ticks' => ['required', 'integer', 'between:0,20'], 'duration_ticks' => ['required', 'integer', 'between:1,50'],
                'cooldown_ticks' => ['required', 'integer', 'between:1,100'],
                'conditions' => ['nullable', 'array'], 'effects' => ['nullable', 'array'], 'response_action_keys' => ['nullable', 'array'],
                'conditions.*.factor' => ['nullable', 'string', Rule::in(['water', 'light', 'fertilizer', 'soil_humidity', 'air_humidity', 'soil_temp', 'air_temp', 'rain', 'wind_speed'])],
                'conditions.*.operator' => ['nullable', 'string', Rule::in(['above', 'above_or_equal', 'below', 'below_or_equal', 'between', 'outside', 'equals', '='])],
                'conditions.*.value' => ['nullable', 'numeric'], 'conditions.*.min' => ['nullable', 'numeric'], 'conditions.*.max' => ['nullable', 'numeric'],
                'effects.factor_delta' => ['nullable', 'array'], 'effects.factor_delta.*' => ['numeric', 'between:-100,100'],
                'response_action_keys.*' => ['string', 'max:100', 'distinct', $activeItemAction], 'is_harmful' => ['required', 'boolean'], 'is_active' => ['required', 'boolean'],
            ],
            default => [],
        };
    }

    /** @return array<string, mixed> */
    private function validatedData(Request $request, string $resource, ?int $recordId = null): array
    {
        if ($resource === 'item-types' && blank($request->input('key'))) {
            $request->merge([
                'key' => $recordId
                    ? ItemType::withTrashed()->findOrFail($recordId)->key
                    : $this->generateItemTypeKey((string) ($request->input('name_en') ?: $request->input('name_th'))),
            ]);
        }
        if ($resource === 'items' && blank($request->input('action_key'))) {
            $existingActionKey = $recordId
                ? Item::withTrashed()->findOrFail($recordId)->action_key
                : null;
            $request->merge([
                'action_key' => $existingActionKey
                    ?: $this->generateItemActionKey((string) $request->input('name')),
            ]);
        }
        if ($resource === 'animation-presets' && blank($request->input('key'))) {
            $request->merge([
                'key' => $recordId
                    ? AnimationPreset::withTrashed()->findOrFail($recordId)->key
                    : $this->generateAnimationPresetKey((string) ($request->input('name_en') ?: $request->input('name_th'))),
            ]);
        }
        if ($resource === 'shop-items') {
            $request->merge(['price_gem' => 0]);
        }

        $validator = Validator::make($request->all(), $this->rules($resource, $recordId, $request), [
            'unique' => 'Duplicate value: another active row already uses this :attribute.',
            'distinct' => 'Duplicate value: :attribute contains the same selection more than once.',
        ]);
        $validator->after(function ($validator) use ($recordId, $request, $resource): void {
            $this->simulationDataValidator->validate($resource, $request->all(), $recordId, $validator);
        });

        $data = $validator->validate();
        if ($resource === 'items') {
            $pestId = $data['pest_id'] ?? null;
            unset($data['pest_id']);
            if (($data['type'] ?? null) === 'prank') {
                $pest = Pest::query()->findOrFail($pestId);
                $pestKey = Str::slug((string) ($pest->name_en ?: $pest->name_th)) ?: 'pest-'.$pest->id;
                // Prank assets stay normalized: Item resolves them from the
                // linked pest, so an updated pest image/model is reflected
                // everywhere without copying or re-uploading files.
                $data['image_url'] = null;
                $data['model_url'] = null;
                $data['effect_type'] = 'friend_pest:'.$pestKey;
                $data['effect_value'] = 0;
                $data['mode_scope'] = 'both';
                $data['effect_payload'] = ['pest_id' => $pest->id];
                $data['animation_preset_id'] = null;
                $data['animation_key'] = null;
            } elseif (isset($data['effect_payload']['pest_id'])) {
                unset($data['effect_payload']['pest_id']);
            }
            $preset = ! empty($data['animation_preset_id'])
                ? AnimationPreset::query()->find($data['animation_preset_id'])
                : null;
            $data['animation_key'] = $preset?->motion_type ?: ($data['animation_key'] ?? null);
        }

        return $data;
    }

    private function generateItemTypeKey(string $name): string
    {
        $base = Str::slug($name) ?: 'item-type';
        $base = Str::limit($base, 90, '');
        $candidate = $base;
        $suffix = 2;

        while (ItemType::withTrashed()->where('key', $candidate)->exists()) {
            $candidate = Str::limit($base, 90 - strlen((string) $suffix), '').'-'.$suffix;
            $suffix++;
        }

        return $candidate;
    }

    private function generateAnimationPresetKey(string $name): string
    {
        $base = Str::limit(Str::slug($name) ?: 'animation-preset', 90, '');
        $candidate = $base;
        $suffix = 2;
        while (AnimationPreset::withTrashed()->where('key', $candidate)->exists()) {
            $candidate = Str::limit($base, 86, '').'-'.$suffix++;
        }

        return $candidate;
    }

    private function generateItemActionKey(string $name): string
    {
        $base = Str::limit(Str::slug($name) ?: 'item-action', 90, '');
        $candidate = $base;
        $suffix = 2;

        while (Item::withTrashed()->where('action_key', $candidate)->exists()) {
            $candidate = Str::limit($base, 88 - strlen((string) $suffix), '').'-'.$suffix;
            $suffix++;
        }

        return $candidate;
    }

    private function moderationIndex(Request $request, string $resource): JsonResponse
    {
        $reportRelations = Schema::hasTable('comment_reports') ? ['reports.reporter:id,username,email'] : [];
        $query = match ($resource) {
            'posts' => Post::query()->with('user:id,username,email,avatar_url')->withCount(['comments', 'likes']),
            'comments' => Comment::query()->with(array_merge(['user:id,username,email,avatar_url'], $reportRelations))->withCount(['replies', 'likes']),
            'simulator-comments' => SimulatorComment::query()->with(array_merge(['user:id,username,email,avatar_url', 'simulator:id,user_id,plant_id,status'], $reportRelations)),
            'simulators' => Simulator::query()->with([
                'user:id,username,email,avatar_url',
                'plant:id,name_th,name_en,base_image_url,base_model_url',
                'currentStage:id,stage_no,stage_name,required_growth_point,model_url',
                'visualVariant:id,state_key,label,model_url',
            ])->withCount('posts'),
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

        if (Schema::hasTable('comment_reports') && in_array($resource, ['comments', 'simulator-comments'], true)) {
            if ($request->query('reports') === 'reported') {
                $query->whereHas('reports', fn ($reports) => $reports->where('status', 'pending'));
            } elseif ($request->query('reports') === 'unreported') {
                $query->whereDoesntHave('reports', fn ($reports) => $reports->where('status', 'pending'));
            }
        }

        if ($request->query('group_by') === 'user' && in_array($resource, ['posts', 'comments', 'simulator-comments', 'simulators', 'plant-histories'], true)) {
            return $this->paginateModerationByOwner($query, $request);
        }

        $orderColumn = $resource === 'activity-logs' ? 'id' : 'created_at';

        return response()->json($query->orderBy($orderColumn)->orderBy('id')->paginate(25));
    }

    private function paginateModerationByOwner($query, Request $request): JsonResponse
    {
        $perPage = min(50, max(1, (int) $request->query('per_page', 10)));
        $ownerPaginator = (clone $query)
            ->reorder()
            ->select('user_id')
            ->selectRaw('MIN(created_at) AS first_record_at')
            ->groupBy('user_id')
            ->orderBy('first_record_at')
            ->orderBy('user_id')
            ->paginate($perPage);
        $ownerIds = collect($ownerPaginator->items())
            ->pluck('user_id')
            ->filter(fn ($ownerId) => $ownerId !== null)
            ->values();
        $ownerOrder = $ownerIds->flip()->all();

        $records = $ownerIds->isEmpty()
            ? collect()
            : (clone $query)
                ->whereIn('user_id', $ownerIds->all())
                ->orderBy('created_at')
                ->orderBy('id')
                ->get()
                ->sort(function ($left, $right) use ($ownerOrder): int {
                    $ownerComparison = ($ownerOrder[$left->user_id] ?? PHP_INT_MAX) <=> ($ownerOrder[$right->user_id] ?? PHP_INT_MAX);
                    if ($ownerComparison !== 0) {
                        return $ownerComparison;
                    }

                    $dateComparison = ($left->created_at?->getTimestamp() ?? 0) <=> ($right->created_at?->getTimestamp() ?? 0);

                    return $dateComparison !== 0 ? $dateComparison : $left->id <=> $right->id;
                });

        $payload = $ownerPaginator->toArray();
        $payload['data'] = $records->values()->toArray();
        $payload['grouped_by'] = 'user';
        $payload['group_count'] = $ownerIds->count();

        return response()->json($payload);
    }

    private function moderationUpdate(Request $request, string $resource, int $record): JsonResponse
    {
        abort_if(
            in_array($resource, ['simulators', 'plant-histories'], true),
            405,
            'Simulation and plant history records are view-only and cannot be changed.',
        );
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
        if (
            Schema::hasTable('comment_reports')
            && in_array($resource, ['comments', 'simulator-comments'], true)
            && in_array($data['status'] ?? null, ['hidden', 'suspended'], true)
        ) {
            CommentReport::query()
                ->where('comment_type', $resource === 'comments' ? 'post' : 'simulator')
                ->where('comment_id', $model->id)
                ->where('status', 'pending')
                ->update(['status' => 'resolved', 'updated_at' => now()]);
        }
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
