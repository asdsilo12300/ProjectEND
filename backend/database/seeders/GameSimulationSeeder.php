<?php

namespace Database\Seeders;

use App\Models\Pest;
use App\Models\PestConditionRule;
use App\Models\Plant;
use App\Models\PlantConditionRule;
use App\Models\PlantGrowthStage;
use App\Models\PlantVisualVariant;
use App\Models\ModelAsset;
use App\Models\Item;
use App\Models\ShopItem;
use Illuminate\Database\Seeder;

class GameSimulationSeeder extends Seeder
{
    public function run(): void
    {
        $plant = Plant::query()->updateOrCreate(
            ['name_en' => 'Simulation Sprout'],
            [
                'name_th' => 'Ã Â¸â€¢Ã Â¹â€°Ã Â¸â„¢Ã Â¸Â«Ã Â¸Â¹Ã Â¸Å Ã Â¹â€°Ã Â¸Â²Ã Â¸â€¡',
                'name_en' => 'Simulation Sprout',
                'description' => 'Starter plant for learning how environment factors affect growth and visual state.',
                'base_image_url' => null,
                'base_model_url' => 'models/plant.gltf',
                'water_min' => 40,
                'water_max' => 75,
                'light_min' => 45,
                'light_max' => 85,
                'fertilizer_min' => 25,
                'fertilizer_max' => 65,
                'soil_humidity_min' => 35,
                'soil_humidity_max' => 75,
                'air_humidity_min' => 40,
                'air_humidity_max' => 80,
                'soil_temp_min' => 18,
                'soil_temp_max' => 32,
                'air_temp_min' => 18,
                'air_temp_max' => 34,
            ]
        );

        $stages = [
            ['stage_no' => 1, 'stage_name' => 'Seedling', 'required_growth_point' => 0, 'description' => 'Early stage', 'model_url' => 'models/plant.gltf'],
            ['stage_no' => 2, 'stage_name' => 'Sprout', 'required_growth_point' => 40, 'description' => 'Visible sprout', 'model_url' => 'models/plant.gltf'],
            ['stage_no' => 3, 'stage_name' => 'Young Plant', 'required_growth_point' => 100, 'description' => 'Stable young plant', 'model_url' => 'models/plant.gltf'],
        ];

        foreach ($stages as $stage) {
            PlantGrowthStage::query()->updateOrCreate(
                ['plant_id' => $plant->id, 'stage_no' => $stage['stage_no']],
                $stage + ['plant_id' => $plant->id]
            );
        }

        $variants = [
            ['state_key' => 'healthy', 'label' => 'Healthy', 'leaf_color' => '#9bcf82', 'stem_color' => '#7a5a2f', 'leaf_state' => 'upright', 'stem_state' => 'upright', 'scale' => 1, 'priority' => 10],
            ['state_key' => 'underwatered', 'label' => 'Underwatered', 'leaf_color' => '#9a6a3a', 'stem_color' => '#6f4a2a', 'leaf_state' => 'wilted', 'stem_state' => 'leaning', 'scale' => 0.92, 'priority' => 80],
            ['state_key' => 'overwatered', 'label' => 'Overwatered', 'leaf_color' => '#7f9964', 'stem_color' => '#6b5b35', 'leaf_state' => 'drooping', 'stem_state' => 'soft', 'scale' => 0.95, 'priority' => 70],
            ['state_key' => 'nutrient_deficient', 'label' => 'Nutrient deficient', 'leaf_color' => '#d6c66b', 'stem_color' => '#8a743e', 'leaf_state' => 'yellowing', 'stem_state' => 'thin', 'scale' => 0.9, 'priority' => 65],
            ['state_key' => 'heat_stress', 'label' => 'Heat stress', 'leaf_color' => '#c6773e', 'stem_color' => '#7a4b2f', 'leaf_state' => 'burnt_edges', 'stem_state' => 'dry', 'scale' => 0.92, 'priority' => 75],
            ['state_key' => 'burnt', 'label' => 'Fertilizer burn', 'leaf_color' => '#b87536', 'stem_color' => '#704326', 'leaf_state' => 'root_burn', 'stem_state' => 'dry', 'scale' => 0.88, 'priority' => 72],
            ['state_key' => 'cold_stress', 'label' => 'Cold stress', 'leaf_color' => '#65816f', 'stem_color' => '#5f6f5b', 'leaf_state' => 'darkened', 'stem_state' => 'slow', 'scale' => 0.9, 'priority' => 60],
            ['state_key' => 'stunted', 'label' => 'Stunted', 'leaf_color' => '#7b6f3f', 'stem_color' => '#5c4a28', 'leaf_state' => 'small', 'stem_state' => 'short', 'scale' => 0.68, 'priority' => 100],
        ];

        foreach ($variants as $variant) {
            PlantVisualVariant::query()->updateOrCreate(
                ['plant_id' => $plant->id, 'stage_id' => null, 'state_key' => $variant['state_key']],
                $variant + ['plant_id' => $plant->id, 'stage_id' => null, 'is_active' => true]
            );
        }

        $rules = [
            ['factor' => 'water', 'operator' => 'below', 'min_value' => 35, 'visual_state' => 'underwatered', 'severity' => 80, 'health_delta' => -14, 'growth_delta' => -8, 'analysis_result' => 'Water is too low; leaves begin to wilt and brown.', 'direction' => 'Increase water before the next cycle.'],
            ['factor' => 'water', 'operator' => 'above', 'max_value' => 82, 'visual_state' => 'overwatered', 'severity' => 70, 'health_delta' => -10, 'growth_delta' => -6, 'analysis_result' => 'Water is too high; roots may be oxygen-starved.', 'direction' => 'Reduce watering and let soil moisture settle.'],
            ['factor' => 'fertilizer', 'operator' => 'below', 'min_value' => 25, 'visual_state' => 'nutrient_deficient', 'severity' => 65, 'health_delta' => -8, 'growth_delta' => -6, 'analysis_result' => 'Fertilizer is low; leaves may yellow from nutrient deficiency.', 'direction' => 'Apply a small fertilizer amount and compare growth.'],
            ['factor' => 'fertilizer', 'operator' => 'above', 'max_value' => 75, 'visual_state' => 'burnt', 'severity' => 72, 'health_delta' => -12, 'growth_delta' => -7, 'analysis_result' => 'Fertilizer is too high and may burn the roots.', 'direction' => 'Lower fertilizer to avoid root burn.'],
            ['factor' => 'air_temp', 'operator' => 'above', 'max_value' => 34, 'visual_state' => 'heat_stress', 'severity' => 75, 'health_delta' => -10, 'growth_delta' => -5, 'analysis_result' => 'Air temperature is high; leaf edges may dry or burn.', 'direction' => 'Provide shade or lower heat exposure.'],
            ['factor' => 'air_temp', 'operator' => 'below', 'min_value' => 16, 'visual_state' => 'cold_stress', 'severity' => 60, 'health_delta' => -8, 'growth_delta' => -5, 'analysis_result' => 'Air temperature is low; growth slows down.', 'direction' => 'Move the plant to a warmer condition.'],
            ['factor' => 'soil_humidity', 'operator' => 'above', 'max_value' => 82, 'visual_state' => 'overwatered', 'severity' => 68, 'health_delta' => -8, 'growth_delta' => -4, 'analysis_result' => 'Soil humidity is very high and may invite fungal growth.', 'direction' => 'Let soil drain before adding more water.'],
        ];

        foreach ($rules as $rule) {
            PlantConditionRule::query()->updateOrCreate(
                ['plant_id' => $plant->id, 'factor' => $rule['factor'], 'operator' => $rule['operator'], 'visual_state' => $rule['visual_state']],
                $rule + ['plant_id' => $plant->id, 'is_active' => true]
            );
        }

        $pests = [
            ['name_th' => 'Ã Â¹â‚¬Ã Â¸Å¾Ã Â¸Â¥Ã Â¸ÂµÃ Â¹â€°Ã Â¸Â¢', 'name_en' => 'aphid', 'model_url' => 'models/aphid.gltf', 'base_chance' => 0, 'damage_per_turn' => 5, 'behavior' => 'More likely in dry and hot air.'],
            ['name_th' => 'Ã Â¸Â«Ã Â¸Â­Ã Â¸Â¢Ã Â¸â€”Ã Â¸Â²Ã Â¸Â', 'name_en' => 'snail', 'model_url' => 'models/snails.gltf', 'base_chance' => 0, 'damage_per_turn' => 6, 'behavior' => 'More likely when soil is wet or rain is present.'],
            ['name_th' => 'Ã Â¹â‚¬Ã Â¸Å Ã Â¸Â·Ã Â¹â€°Ã Â¸Â­Ã Â¸Â£Ã Â¸Â²', 'name_en' => 'fungus', 'model_url' => null, 'base_chance' => 0, 'damage_per_turn' => 7, 'behavior' => 'More likely with high humidity and wet soil.'],
        ];

        foreach ($pests as $pestData) {
            Pest::query()->updateOrCreate(['name_en' => $pestData['name_en']], $pestData);
        }

        $aphid = Pest::query()->where('name_en', 'aphid')->first();
        $snail = Pest::query()->where('name_en', 'snail')->first();
        $fungus = Pest::query()->where('name_en', 'fungus')->first();

        $pestRules = [
            [$aphid, 'air_humidity', 'below', 35, null, 35, 40],
            [$aphid, 'air_temp', 'above', null, 32, 30, 35],
            [$snail, 'soil_humidity', 'above', null, 72, 65, 45],
            [$snail, 'rain', 'above', null, 0.5, 35, 35],
            [$fungus, 'air_humidity', 'above', null, 78, 42, 45],
            [$fungus, 'soil_humidity', 'above', null, 78, 46, 50],
        ];

        foreach ($pestRules as [$pest, $factor, $operator, $min, $max, $chance, $severity]) {
            if (! $pest) {
                continue;
            }

            PestConditionRule::query()->updateOrCreate(
                ['pest_id' => $pest->id, 'plant_id' => null, 'factor' => $factor, 'operator' => $operator],
                [
                    'pest_id' => $pest->id,
                    'plant_id' => null,
                    'factor' => $factor,
                    'operator' => $operator,
                    'min_value' => $min,
                    'max_value' => $max,
                    'chance_delta' => $chance,
                    'severity' => $severity,
                    'is_active' => true,
                ]
            );
        }
        $items = [
            [
                'name' => 'Hand Pick',
                'type' => 'pesticide',
                'description' => 'Manual removal. Aphid success 40%, snail success 80%. Does not consume inventory.',
                'image_url' => '/storage/icon%20picture/hand-Photoroom.png',
                'effect_type' => 'manual_pest_control:aphid,snail',
                'effect_value' => 0,
                'rarity' => 'common',
                'is_active' => true,
                'price_coin' => null,
            ],
            [
                'name' => 'Insect Spray',
                'type' => 'pesticide',
                'description' => 'Clears aphids with 100% success.',
                'image_url' => '/storage/icon%20picture/Insecticide%20spray-Photoroom.png',
                'effect_type' => 'pest_control:aphid',
                'effect_value' => 100,
                'rarity' => 'common',
                'is_active' => true,
                'price_coin' => 50,
            ],
            [
                'name' => 'Snail Spray',
                'type' => 'pesticide',
                'description' => 'Clears snails with 100% success.',
                'image_url' => '/storage/icon%20picture/snail%20spray.png',
                'effect_type' => 'pest_control:snail',
                'effect_value' => 100,
                'rarity' => 'common',
                'is_active' => true,
                'price_coin' => 25,
            ],
            [
                'name' => 'Fungus Spray',
                'type' => 'pesticide',
                'description' => 'Clears fungus with 100% success.',
                'image_url' => '/storage/icon%20picture/Antifungal%20spray-Photoroom.png',
                'effect_type' => 'pest_control:fungus',
                'effect_value' => 100,
                'rarity' => 'common',
                'is_active' => true,
                'price_coin' => 50,
            ],
        ];

        foreach ($items as $itemData) {
            $priceCoin = $itemData['price_coin'];
            unset($itemData['price_coin']);

            $item = Item::query()->updateOrCreate(
                ['name' => $itemData['name']],
                $itemData,
            );

            if ($priceCoin !== null) {
                ShopItem::query()->updateOrCreate(
                    ['item_id' => $item->id],
                    [
                        'price_coin' => $priceCoin,
                        'price_gem' => 0,
                        'stock_limit' => null,
                        'is_active' => true,
                        'starts_at' => null,
                        'ends_at' => null,
                    ],
                );
            }
        }


        $assets = [
            ['asset_key' => 'plant.original', 'label' => 'Original plant model', 'type' => 'plant', 'url' => 'models/plant.gltf'],
            ['asset_key' => 'ground.dirt', 'label' => 'Dirt ground model', 'type' => 'scene', 'url' => 'models/dirt.gltf'],
            ['asset_key' => 'pest.aphid', 'label' => 'Aphid pest model', 'type' => 'pest', 'url' => 'models/aphid.gltf'],
            ['asset_key' => 'pest.snail', 'label' => 'Snail pest model', 'type' => 'pest', 'url' => 'models/snails.gltf'],
        ];

        foreach ($assets as $asset) {
            ModelAsset::query()->updateOrCreate(
                ['asset_key' => $asset['asset_key']],
                $asset + ['metadata' => ['source' => 'frontend-public-import']]
            );
        }
    }
}

