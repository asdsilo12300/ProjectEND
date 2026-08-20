<?php

namespace App\Services;

use App\Models\Plant;
use App\Models\PlantConditionRule;
use App\Models\PlantGrowthStage;
use App\Models\PlantVisualVariant;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

class KnownPlantProfileService
{
    /**
     * Fill a known profile only when an older record is missing its generated
     * growth track, condition rules, or visual variants. This lets an admin
     * re-save a plant created before the profile was introduced without
     * overwriting a complete profile that was intentionally tuned later.
     */
    public function applyIfMissing(Plant $plant): bool
    {
        $profile = $this->profileKey($plant);
        if ($profile === null) {
            return false;
        }

        $requiredStages = $profile === 'sunflower'
            ? ['Germination', 'Vegetative growth', 'Flowering']
            : ['Bulb establishment', 'Leaf emergence', 'Flowering'];

        $hasStages = $plant->stages()
            ->whereIn('stage_name', $requiredStages)
            ->count() === count($requiredStages);
        $hasRules = $plant->conditionRules()->withTrashed()->exists();
        $hasVisuals = $plant->visualVariants()->withTrashed()->exists();

        return $hasStages && $hasRules && $hasVisuals ? false : $this->apply($plant);
    }

    public function apply(Plant $plant): bool
    {
        $profile = $this->profileKey($plant);
        if ($profile === null) {
            return false;
        }

        DB::transaction(function () use ($plant, $profile): void {
            $environment = $profile === 'sunflower'
                ? $this->sunflowerEnvironment()
                : $this->tulipEnvironment();
            if (! Schema::hasColumn('plants', 'real_maturity_days')) {
                unset($environment['real_maturity_days'], $environment['growth_reference_url']);
            }
            $plant->update($environment);

            if ($profile === 'sunflower') {
                $this->ensureSunflowerGrowthTrack($plant);
                $this->syncSunflowerRules($plant);
                $this->syncSunflowerVisuals($plant);
            } else {
                $this->ensureGrowthTrack($plant);
                $this->syncTulipRules($plant);
                $this->syncTulipVisuals($plant);
            }
        });

        return true;
    }

    private function profileKey(Plant $plant): ?string
    {
        if ($this->isTulip($plant)) {
            return 'tulip';
        }

        return $this->isSunflower($plant) ? 'sunflower' : null;
    }

    private function isTulip(Plant $plant): bool
    {
        $englishName = Str::lower(trim((string) $plant->name_en));
        $thaiName = trim((string) $plant->name_th);

        return Str::contains($englishName, 'tulip') || $thaiName === 'ทิวลิป';
    }

    private function isSunflower(Plant $plant): bool
    {
        $englishName = Str::lower(trim((string) $plant->name_en));
        $thaiName = trim((string) $plant->name_th);

        return Str::contains($englishName, 'sunflower')
            || Str::contains($englishName, 'helianthus')
            || Str::contains($thaiName, 'ทานตะวัน');
    }

    /** @return array<string, int|string> */
    private function sunflowerEnvironment(): array
    {
        return [
            // A 90-day baseline sits in the 85–95 day range used by
            // extension production guides. Admins can still edit the
            // maturity value for a specific cultivar after creation.
            'real_maturity_days' => 90,
            'growth_reference_url' => 'https://yardandgarden.extension.iastate.edu/how-to/growing-sunflowers-and-their-varieties',
            'water_min' => 40,
            'water_max' => 75,
            'light_min' => 65,
            'light_max' => 100,
            'fertilizer_min' => 20,
            'fertilizer_max' => 55,
            'soil_humidity_min' => 35,
            'soil_humidity_max' => 70,
            'air_humidity_min' => 40,
            'air_humidity_max' => 75,
            'soil_temp_min' => 18,
            'soil_temp_max' => 30,
            'air_temp_min' => 18,
            'air_temp_max' => 32,
        ];
    }

    /** @return array<string, int|string> */
    private function tulipEnvironment(): array
    {
        return [
            'real_maturity_days' => 112,
            'growth_reference_url' => 'https://extension.umn.edu/gardening-minnesota/growing-bulbs-indoors',
            'water_min' => 35,
            'water_max' => 60,
            'light_min' => 60,
            'light_max' => 100,
            'fertilizer_min' => 20,
            'fertilizer_max' => 45,
            'soil_humidity_min' => 40,
            'soil_humidity_max' => 65,
            'air_humidity_min' => 45,
            'air_humidity_max' => 70,
            'soil_temp_min' => 4,
            'soil_temp_max' => 13,
            'air_temp_min' => 10,
            'air_temp_max' => 18,
        ];
    }

    private function ensureGrowthTrack(Plant $plant): void
    {
        if (! $plant->base_model_url) {
            return;
        }

        $stages = [
            ['stage_no' => 1, 'stage_name' => 'Bulb establishment', 'required_growth_point' => 0, 'description' => 'The chilled bulb establishes roots before visible shoot growth.'],
            ['stage_no' => 2, 'stage_name' => 'Leaf emergence', 'required_growth_point' => 40, 'description' => 'Leaves and the flower stem emerge as active growth begins.'],
            ['stage_no' => 3, 'stage_name' => 'Flowering', 'required_growth_point' => 100, 'description' => 'The stem reaches maturity and the tulip flower opens.'],
        ];

        foreach ($stages as $stageData) {
            $stage = PlantGrowthStage::withTrashed()->firstOrNew([
                'plant_id' => $plant->id,
                'stage_no' => $stageData['stage_no'],
            ]);

            if (! $stage->exists || Str::startsWith((string) $stage->description, 'Automatically created')) {
                $stage->fill($stageData);
            }

            if (! $stage->model_url) {
                $stage->model_url = $plant->base_model_url;
            }

            $stage->plant_id = $plant->id;
            $stage->deleted_at = null;
            $stage->save();
        }
    }

    private function ensureSunflowerGrowthTrack(Plant $plant): void
    {
        if (! $plant->base_model_url) {
            return;
        }

        $stages = [
            ['stage_no' => 1, 'stage_name' => 'Germination', 'required_growth_point' => 0, 'description' => 'The seed germinates and the first root and shoot emerge.'],
            ['stage_no' => 2, 'stage_name' => 'Vegetative growth', 'required_growth_point' => 40, 'description' => 'The sunflower builds leaves and a strong upright stem.'],
            ['stage_no' => 3, 'stage_name' => 'Flowering', 'required_growth_point' => 100, 'description' => 'The flower head opens and the plant reaches biological maturity.'],
        ];

        foreach ($stages as $stageData) {
            $stage = PlantGrowthStage::withTrashed()->firstOrNew([
                'plant_id' => $plant->id,
                'stage_no' => $stageData['stage_no'],
            ]);

            if (! $stage->exists || Str::startsWith((string) $stage->description, 'Automatically created')) {
                $stage->fill($stageData);
            }

            if (! $stage->model_url) {
                $stage->model_url = $plant->base_model_url;
            }

            $stage->plant_id = $plant->id;
            $stage->deleted_at = null;
            $stage->save();
        }
    }

    private function syncSunflowerRules(Plant $plant): void
    {
        $rules = [
            ['factor' => 'water', 'operator' => 'below', 'min_value' => 40, 'max_value' => null, 'visual_state' => 'underwatered', 'severity' => 6, 'health_delta' => -8, 'growth_delta' => -6, 'analysis_result' => 'The sunflower is running short of water. Early growth and flower development will slow first.', 'direction' => 'Water the root zone evenly, then let excess water drain away.'],
            ['factor' => 'water', 'operator' => 'above', 'min_value' => null, 'max_value' => 75, 'visual_state' => 'overwatered', 'severity' => 7, 'health_delta' => -8, 'growth_delta' => -5, 'analysis_result' => 'Too much water reduces oxygen around the roots and increases rot risk.', 'direction' => 'Pause watering and allow the growing medium to drain before the next cycle.'],
            ['factor' => 'soil_humidity', 'operator' => 'below', 'min_value' => 35, 'max_value' => null, 'visual_state' => 'dry_soil', 'severity' => 6, 'health_delta' => -8, 'growth_delta' => -5, 'analysis_result' => 'Dry soil limits root uptake and can make the stem and leaves wilt.', 'direction' => 'Restore moderate soil moisture without flooding the planting area.'],
            ['factor' => 'soil_humidity', 'operator' => 'above', 'min_value' => null, 'max_value' => 70, 'visual_state' => 'waterlogged', 'severity' => 8, 'health_delta' => -10, 'growth_delta' => -6, 'analysis_result' => 'Waterlogged soil deprives the roots of oxygen and favours fungal problems.', 'direction' => 'Improve drainage and wait for the surface to begin drying.'],
            ['factor' => 'light', 'operator' => 'below', 'min_value' => 65, 'max_value' => null, 'visual_state' => 'low_light', 'severity' => 6, 'health_delta' => -7, 'growth_delta' => -6, 'analysis_result' => 'Sunflowers need strong light to build a sturdy stem and flower head.', 'direction' => 'Move the plant toward a bright position with several hours of direct light.'],
            ['factor' => 'fertilizer', 'operator' => 'below', 'min_value' => 20, 'max_value' => null, 'visual_state' => 'nutrient_deficient', 'severity' => 4, 'health_delta' => -4, 'growth_delta' => -4, 'analysis_result' => 'Low nutrient availability is limiting leaf and flower development.', 'direction' => 'Apply a light, balanced feed rather than a heavy dose.'],
            ['factor' => 'fertilizer', 'operator' => 'above', 'min_value' => null, 'max_value' => 55, 'visual_state' => 'fertilizer_burn', 'severity' => 7, 'health_delta' => -8, 'growth_delta' => -5, 'analysis_result' => 'Excess fertilizer can build salts around the roots and scorch leaf edges.', 'direction' => 'Stop feeding and flush the medium while keeping drainage open.'],
            ['factor' => 'soil_temp', 'operator' => 'below', 'min_value' => 18, 'max_value' => null, 'visual_state' => 'cold_stress', 'severity' => 5, 'health_delta' => -6, 'growth_delta' => -5, 'analysis_result' => 'The root zone is below the active-growth range, so germination and root uptake slow down.', 'direction' => 'Protect the root zone from cold and return it to a warm, bright position gradually.'],
            ['factor' => 'soil_temp', 'operator' => 'above', 'min_value' => null, 'max_value' => 30, 'visual_state' => 'heat_stress', 'severity' => 7, 'health_delta' => -8, 'growth_delta' => -6, 'analysis_result' => 'A hot root zone increases water loss and can stress shallow roots.', 'direction' => 'Reduce heat around the soil, maintain airflow, and keep moisture even.'],
            ['factor' => 'air_temp', 'operator' => 'below', 'min_value' => 18, 'max_value' => null, 'visual_state' => 'cold_stress', 'severity' => 5, 'health_delta' => -6, 'growth_delta' => -5, 'analysis_result' => 'Cold air slows sunflower growth and makes young leaves more vulnerable.', 'direction' => 'Shelter young growth from cold air and frost.'],
            ['factor' => 'air_temp', 'operator' => 'above', 'min_value' => null, 'max_value' => 32, 'visual_state' => 'heat_stress', 'severity' => 7, 'health_delta' => -9, 'growth_delta' => -6, 'analysis_result' => 'Hot, dry air increases transpiration and can cause leaf edges to wilt.', 'direction' => 'Provide airflow and water the root zone before severe heat stress develops.'],
            ['factor' => 'air_humidity', 'operator' => 'below', 'min_value' => 40, 'max_value' => null, 'visual_state' => 'dry_air', 'severity' => 4, 'health_delta' => -4, 'growth_delta' => -3, 'analysis_result' => 'Very dry air increases water loss from the leaves.', 'direction' => 'Keep moisture consistent and avoid hot, drying airflow.'],
            ['factor' => 'air_humidity', 'operator' => 'above', 'min_value' => null, 'max_value' => 75, 'visual_state' => 'fungal_risk', 'severity' => 7, 'health_delta' => -6, 'growth_delta' => -4, 'analysis_result' => 'High humidity and wet foliage increase the risk of fungal leaf spots and mildew.', 'direction' => 'Improve air movement and avoid leaving the leaves wet for long periods.'],
        ];

        foreach ($rules as $ruleData) {
            $rule = PlantConditionRule::withTrashed()->updateOrCreate(
                [
                    'plant_id' => $plant->id,
                    'factor' => $ruleData['factor'],
                    'operator' => $ruleData['operator'],
                    'visual_state' => $ruleData['visual_state'],
                ],
                $ruleData + ['plant_id' => $plant->id, 'is_active' => true, 'deleted_at' => null],
            );

            if ($rule->trashed()) {
                $rule->restore();
            }
        }
    }

    private function syncSunflowerVisuals(Plant $plant): void
    {
        $variants = [
            ['state_key' => 'healthy', 'label' => 'Healthy sunflower', 'leaf_color' => '#5f9d45', 'stem_color' => '#6d8e43', 'leaf_state' => 'upright', 'stem_state' => 'upright', 'scale' => 1.00, 'priority' => 10],
            ['state_key' => 'underwatered', 'label' => 'Wilted from low water', 'leaf_color' => '#8d8b43', 'stem_color' => '#6f6836', 'leaf_state' => 'wilted', 'stem_state' => 'leaning', 'scale' => 0.92, 'priority' => 70],
            ['state_key' => 'overwatered', 'label' => 'Waterlogged sunflower', 'leaf_color' => '#87985a', 'stem_color' => '#66805a', 'leaf_state' => 'drooping', 'stem_state' => 'soft', 'scale' => 0.94, 'priority' => 80],
            ['state_key' => 'dry_soil', 'label' => 'Dry soil stress', 'leaf_color' => '#9d8440', 'stem_color' => '#725f35', 'leaf_state' => 'wilted', 'stem_state' => 'leaning', 'scale' => 0.91, 'priority' => 65],
            ['state_key' => 'waterlogged', 'label' => 'Waterlogged roots', 'leaf_color' => '#7e965b', 'stem_color' => '#5f7757', 'leaf_state' => 'yellowing', 'stem_state' => 'soft', 'scale' => 0.91, 'priority' => 85],
            ['state_key' => 'low_light', 'label' => 'Weak low-light growth', 'leaf_color' => '#9faf66', 'stem_color' => '#84945e', 'leaf_state' => 'pale', 'stem_state' => 'thin', 'scale' => 0.88, 'priority' => 60],
            ['state_key' => 'nutrient_deficient', 'label' => 'Nutrient deficient', 'leaf_color' => '#b8b45b', 'stem_color' => '#8d8b48', 'leaf_state' => 'yellowing', 'stem_state' => 'thin', 'scale' => 0.90, 'priority' => 55],
            ['state_key' => 'fertilizer_burn', 'label' => 'Fertilizer salt burn', 'leaf_color' => '#9b673e', 'stem_color' => '#704b35', 'leaf_state' => 'burnt_edges', 'stem_state' => 'dry', 'scale' => 0.87, 'priority' => 82],
            ['state_key' => 'heat_stress', 'label' => 'Heat-stressed sunflower', 'leaf_color' => '#a7793d', 'stem_color' => '#785336', 'leaf_state' => 'wilted', 'stem_state' => 'leaning', 'scale' => 0.90, 'priority' => 78],
            ['state_key' => 'cold_stress', 'label' => 'Cold-stressed sunflower', 'leaf_color' => '#657e70', 'stem_color' => '#5f7060', 'leaf_state' => 'darkened', 'stem_state' => 'slow', 'scale' => 0.91, 'priority' => 65],
            ['state_key' => 'dry_air', 'label' => 'Dry-air stress', 'leaf_color' => '#a18755', 'stem_color' => '#766244', 'leaf_state' => 'wilted', 'stem_state' => 'dry', 'scale' => 0.92, 'priority' => 45],
            ['state_key' => 'fungal_risk', 'label' => 'Fungal humidity stress', 'leaf_color' => '#6f785a', 'stem_color' => '#626b52', 'leaf_state' => 'spotted', 'stem_state' => 'soft', 'scale' => 0.89, 'priority' => 88],
            ['state_key' => 'stunted', 'label' => 'Combined stress', 'leaf_color' => '#766b3f', 'stem_color' => '#5d4f33', 'leaf_state' => 'small', 'stem_state' => 'short', 'scale' => 0.70, 'priority' => 100],
        ];

        foreach ($variants as $variantData) {
            $variant = PlantVisualVariant::withTrashed()->updateOrCreate(
                ['plant_id' => $plant->id, 'stage_id' => null, 'state_key' => $variantData['state_key']],
                $variantData + ['plant_id' => $plant->id, 'stage_id' => null, 'is_active' => true, 'deleted_at' => null],
            );

            if ($variant->trashed()) {
                $variant->restore();
            }
        }
    }

    private function syncTulipRules(Plant $plant): void
    {
        $rules = [
            ['factor' => 'water', 'operator' => 'below', 'min_value' => 35, 'max_value' => null, 'visual_state' => 'underwatered', 'severity' => 7, 'health_delta' => -10, 'growth_delta' => -7, 'analysis_result' => 'The tulip is too dry, so its leaves and flower stem begin to lose turgor.', 'direction' => 'Water evenly, then allow excess water to drain away.'],
            ['factor' => 'water', 'operator' => 'above', 'min_value' => null, 'max_value' => 60, 'visual_state' => 'overwatered', 'severity' => 8, 'health_delta' => -12, 'growth_delta' => -7, 'analysis_result' => 'Excess water reduces oxygen around the bulb and raises the risk of bulb and root rot.', 'direction' => 'Reduce watering and keep the growing medium freely draining.'],
            ['factor' => 'soil_humidity', 'operator' => 'below', 'min_value' => 40, 'max_value' => null, 'visual_state' => 'underwatered', 'severity' => 6, 'health_delta' => -8, 'growth_delta' => -6, 'analysis_result' => 'Dry soil limits root activity and can shorten tulip flowering.', 'direction' => 'Restore moderate, even soil moisture without saturating the bulb.'],
            ['factor' => 'soil_humidity', 'operator' => 'above', 'min_value' => null, 'max_value' => 65, 'visual_state' => 'overwatered', 'severity' => 9, 'health_delta' => -14, 'growth_delta' => -8, 'analysis_result' => 'Waterlogged soil encourages soft bulb tissue and fungal decay.', 'direction' => 'Improve drainage and let the soil surface begin to dry before watering again.'],
            ['factor' => 'light', 'operator' => 'below', 'min_value' => 60, 'max_value' => null, 'visual_state' => 'low_light', 'severity' => 6, 'health_delta' => -5, 'growth_delta' => -7, 'analysis_result' => 'Insufficient light produces weak growth and may prevent a strong flower.', 'direction' => 'Provide a bright, full-sun position with about six hours of direct light.'],
            ['factor' => 'fertilizer', 'operator' => 'below', 'min_value' => 20, 'max_value' => null, 'visual_state' => 'nutrient_deficient', 'severity' => 5, 'health_delta' => -4, 'growth_delta' => -5, 'analysis_result' => 'Low nutrient availability reduces vigour and flower development.', 'direction' => 'Apply a light, balanced bulb feed rather than a heavy dose.'],
            ['factor' => 'fertilizer', 'operator' => 'above', 'min_value' => null, 'max_value' => 45, 'visual_state' => 'burnt', 'severity' => 8, 'health_delta' => -10, 'growth_delta' => -7, 'analysis_result' => 'Excess fertilizer raises salt levels and can brown leaf tips and stunt the tulip.', 'direction' => 'Stop feeding and flush the growing medium with clean water while preserving drainage.'],
            ['factor' => 'soil_temp', 'operator' => 'below', 'min_value' => 4, 'max_value' => null, 'visual_state' => 'cold_stress', 'severity' => 6, 'health_delta' => -6, 'growth_delta' => -5, 'analysis_result' => 'The root zone is colder than the active-growth range, slowing root and shoot development.', 'direction' => 'Raise the root-zone temperature gradually while keeping the bulb cool.'],
            ['factor' => 'soil_temp', 'operator' => 'above', 'min_value' => null, 'max_value' => 13, 'visual_state' => 'heat_stress', 'severity' => 7, 'health_delta' => -8, 'growth_delta' => -6, 'analysis_result' => 'A warm root zone shortens cool-season tulip development and increases stress.', 'direction' => 'Cool the soil and keep the container away from heat-retaining surfaces.'],
            ['factor' => 'air_temp', 'operator' => 'below', 'min_value' => 10, 'max_value' => null, 'visual_state' => 'cold_stress', 'severity' => 6, 'health_delta' => -6, 'growth_delta' => -5, 'analysis_result' => 'Cold air slows active shoot development and can mark exposed leaves during frost.', 'direction' => 'Protect emerging growth from frost and return it to a cool, sheltered position.'],
            ['factor' => 'air_temp', 'operator' => 'above', 'min_value' => null, 'max_value' => 18, 'visual_state' => 'heat_stress', 'severity' => 8, 'health_delta' => -9, 'growth_delta' => -7, 'analysis_result' => 'Warm air accelerates flowering and can scorch petal margins or weaken the stem.', 'direction' => 'Move the tulip to a cooler bright position and avoid hot, drying airflow.'],
            ['factor' => 'air_humidity', 'operator' => 'below', 'min_value' => 45, 'max_value' => null, 'visual_state' => 'dry_air', 'severity' => 4, 'health_delta' => -4, 'growth_delta' => -3, 'analysis_result' => 'Very dry air increases water loss from leaves and petals.', 'direction' => 'Keep conditions cool and avoid direct dry airflow while maintaining ventilation.'],
            ['factor' => 'air_humidity', 'operator' => 'above', 'min_value' => null, 'max_value' => 70, 'visual_state' => 'botrytis', 'severity' => 8, 'health_delta' => -10, 'growth_delta' => -6, 'analysis_result' => 'High humidity and wet foliage favour Botrytis spots, distortion, and grey-brown mould.', 'direction' => 'Increase air movement, keep foliage dry, and remove affected tissue promptly.'],
        ];

        foreach ($rules as $ruleData) {
            $rule = PlantConditionRule::withTrashed()->updateOrCreate(
                [
                    'plant_id' => $plant->id,
                    'factor' => $ruleData['factor'],
                    'operator' => $ruleData['operator'],
                    'visual_state' => $ruleData['visual_state'],
                ],
                $ruleData + ['plant_id' => $plant->id, 'is_active' => true, 'deleted_at' => null],
            );

            if ($rule->trashed()) {
                $rule->restore();
            }
        }
    }

    private function syncTulipVisuals(Plant $plant): void
    {
        $variants = [
            ['state_key' => 'healthy', 'label' => 'Healthy tulip', 'leaf_color' => '#5f9b55', 'stem_color' => '#668f4f', 'leaf_state' => 'upright', 'stem_state' => 'upright', 'scale' => 1.00, 'priority' => 10],
            ['state_key' => 'underwatered', 'label' => 'Dry and wilted', 'leaf_color' => '#a48a4e', 'stem_color' => '#80653d', 'leaf_state' => 'wilted', 'stem_state' => 'leaning', 'scale' => 0.91, 'priority' => 70],
            ['state_key' => 'overwatered', 'label' => 'Waterlogged and yellowing', 'leaf_color' => '#9eaa68', 'stem_color' => '#78815a', 'leaf_state' => 'drooping', 'stem_state' => 'soft', 'scale' => 0.93, 'priority' => 85],
            ['state_key' => 'low_light', 'label' => 'Weak low-light growth', 'leaf_color' => '#a7b879', 'stem_color' => '#879c67', 'leaf_state' => 'pale', 'stem_state' => 'thin', 'scale' => 0.88, 'priority' => 60],
            ['state_key' => 'nutrient_deficient', 'label' => 'Nutrient deficient', 'leaf_color' => '#c6bd68', 'stem_color' => '#989057', 'leaf_state' => 'yellowing', 'stem_state' => 'thin', 'scale' => 0.90, 'priority' => 55],
            ['state_key' => 'burnt', 'label' => 'Fertilizer salt burn', 'leaf_color' => '#a66a3e', 'stem_color' => '#765037', 'leaf_state' => 'root_burn', 'stem_state' => 'dry', 'scale' => 0.86, 'priority' => 80],
            ['state_key' => 'heat_stress', 'label' => 'Heat-scorched', 'leaf_color' => '#b37a46', 'stem_color' => '#7d593b', 'leaf_state' => 'burnt_edges', 'stem_state' => 'soft', 'scale' => 0.89, 'priority' => 78],
            ['state_key' => 'cold_stress', 'label' => 'Cold injury', 'leaf_color' => '#667e79', 'stem_color' => '#637363', 'leaf_state' => 'darkened', 'stem_state' => 'slow', 'scale' => 0.90, 'priority' => 65],
            ['state_key' => 'dry_air', 'label' => 'Dry-air stress', 'leaf_color' => '#9b8559', 'stem_color' => '#796b4d', 'leaf_state' => 'wilted', 'stem_state' => 'dry', 'scale' => 0.92, 'priority' => 45],
            ['state_key' => 'botrytis', 'label' => 'Botrytis risk', 'leaf_color' => '#756f5f', 'stem_color' => '#6d6657', 'leaf_state' => 'spotted', 'stem_state' => 'soft', 'scale' => 0.88, 'priority' => 90],
            ['state_key' => 'stunted', 'label' => 'Combined stress', 'leaf_color' => '#7b7147', 'stem_color' => '#625538', 'leaf_state' => 'small', 'stem_state' => 'short', 'scale' => 0.68, 'priority' => 100],
        ];

        foreach ($variants as $variantData) {
            $variant = PlantVisualVariant::withTrashed()->updateOrCreate(
                ['plant_id' => $plant->id, 'stage_id' => null, 'state_key' => $variantData['state_key']],
                $variantData + ['plant_id' => $plant->id, 'stage_id' => null, 'is_active' => true, 'deleted_at' => null],
            );

            if ($variant->trashed()) {
                $variant->restore();
            }
        }
    }
}
