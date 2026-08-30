SET NAMES utf8mb4;

START TRANSACTION;

SET @plant_id := (
  SELECT id
  FROM plants
  WHERE name_en IN ('Elephant Ear', 'Simulation Sprout')
  ORDER BY FIELD(name_en, 'Elephant Ear', 'Simulation Sprout')
  LIMIT 1
);

INSERT INTO plants (
  name_th, name_en, description, base_image_url, base_model_url,
  water_min, water_max, light_min, light_max, fertilizer_min, fertilizer_max,
  soil_humidity_min, soil_humidity_max, air_humidity_min, air_humidity_max,
  soil_temp_min, soil_temp_max, air_temp_min, air_temp_max
)
SELECT
  'ต้นหูช้าง', 'Elephant Ear',
  'Starter elephant ear plant for learning how environment factors affect growth and visual state.',
  '/storage/icon%20picture/Elephant%20Ear-Photoroom.png',
  'models/plant.gltf',
  40, 75, 45, 85, 25, 65, 35, 75, 40, 80, 18, 32, 18, 34
WHERE @plant_id IS NULL;

SET @plant_id := COALESCE(@plant_id, LAST_INSERT_ID());

UPDATE plants
SET
  name_th = 'ต้นหูช้าง',
  name_en = 'Elephant Ear',
  description = 'Starter elephant ear plant for learning how environment factors affect growth and visual state.',
  base_image_url = '/storage/icon%20picture/Elephant%20Ear-Photoroom.png',
  base_model_url = 'models/plant.gltf',
  water_min = 40,
  water_max = 75,
  light_min = 45,
  light_max = 85,
  fertilizer_min = 25,
  fertilizer_max = 65,
  soil_humidity_min = 35,
  soil_humidity_max = 75,
  air_humidity_min = 40,
  air_humidity_max = 80,
  soil_temp_min = 18,
  soil_temp_max = 32,
  air_temp_min = 18,
  air_temp_max = 34,
  deleted_at = NULL
WHERE id = @plant_id;

UPDATE plant_growth_stages
SET stage_name = 'Seedling', required_growth_point = 0, description = 'Early stage', model_url = 'models/plant.gltf'
WHERE plant_id = @plant_id AND stage_no = 1;
INSERT INTO plant_growth_stages (plant_id, stage_no, stage_name, required_growth_point, description, model_url)
SELECT @plant_id, 1, 'Seedling', 0, 'Early stage', 'models/plant.gltf'
WHERE NOT EXISTS (SELECT 1 FROM plant_growth_stages WHERE plant_id = @plant_id AND stage_no = 1);

UPDATE plant_growth_stages
SET stage_name = 'Sprout', required_growth_point = 40, description = 'Visible sprout', model_url = 'models/plant.gltf'
WHERE plant_id = @plant_id AND stage_no = 2;
INSERT INTO plant_growth_stages (plant_id, stage_no, stage_name, required_growth_point, description, model_url)
SELECT @plant_id, 2, 'Sprout', 40, 'Visible sprout', 'models/plant.gltf'
WHERE NOT EXISTS (SELECT 1 FROM plant_growth_stages WHERE plant_id = @plant_id AND stage_no = 2);

UPDATE plant_growth_stages
SET stage_name = 'Young Plant', required_growth_point = 100, description = 'Stable young plant', model_url = 'models/plant.gltf'
WHERE plant_id = @plant_id AND stage_no = 3;
INSERT INTO plant_growth_stages (plant_id, stage_no, stage_name, required_growth_point, description, model_url)
SELECT @plant_id, 3, 'Young Plant', 100, 'Stable young plant', 'models/plant.gltf'
WHERE NOT EXISTS (SELECT 1 FROM plant_growth_stages WHERE plant_id = @plant_id AND stage_no = 3);

DELETE FROM plant_visual_variants WHERE plant_id = @plant_id;
INSERT INTO plant_visual_variants
  (plant_id, stage_id, state_key, label, model_url, leaf_color, stem_color, leaf_state, stem_state, scale, priority, is_active, created_at, updated_at)
VALUES
  (@plant_id, NULL, 'healthy', 'Healthy', NULL, '#9bcf82', '#7a5a2f', 'upright', 'upright', 1.00, 10, 1, NOW(), NOW()),
  (@plant_id, NULL, 'underwatered', 'Underwatered', NULL, '#9a6a3a', '#6f4a2a', 'wilted', 'leaning', 0.92, 80, 1, NOW(), NOW()),
  (@plant_id, NULL, 'overwatered', 'Overwatered', NULL, '#7f9964', '#6b5b35', 'drooping', 'soft', 0.95, 70, 1, NOW(), NOW()),
  (@plant_id, NULL, 'nutrient_deficient', 'Nutrient deficient', NULL, '#d6c66b', '#8a743e', 'yellowing', 'thin', 0.90, 65, 1, NOW(), NOW()),
  (@plant_id, NULL, 'heat_stress', 'Heat stress', NULL, '#c6773e', '#7a4b2f', 'burnt_edges', 'dry', 0.92, 75, 1, NOW(), NOW()),
  (@plant_id, NULL, 'burnt', 'Fertilizer burn', NULL, '#b87536', '#704326', 'root_burn', 'dry', 0.88, 72, 1, NOW(), NOW()),
  (@plant_id, NULL, 'cold_stress', 'Cold stress', NULL, '#65816f', '#5f6f5b', 'darkened', 'slow', 0.90, 60, 1, NOW(), NOW()),
  (@plant_id, NULL, 'stunted', 'Stunted', NULL, '#7b6f3f', '#5c4a28', 'small', 'short', 0.68, 100, 1, NOW(), NOW());

DELETE FROM plant_condition_rules WHERE plant_id = @plant_id;
INSERT INTO plant_condition_rules
  (plant_id, factor, operator, min_value, max_value, visual_state, severity, health_delta, growth_delta, analysis_result, direction, is_active, created_at, updated_at)
VALUES
  (@plant_id, 'water', 'below', 35, NULL, 'underwatered', 80, -14, -8, 'Water is too low; leaves begin to wilt and brown.', 'Increase water before the next cycle.', 1, NOW(), NOW()),
  (@plant_id, 'water', 'above', NULL, 82, 'overwatered', 70, -10, -6, 'Water is too high; roots may be oxygen-starved.', 'Reduce watering and let soil moisture settle.', 1, NOW(), NOW()),
  (@plant_id, 'fertilizer', 'below', 25, NULL, 'nutrient_deficient', 65, -8, -6, 'Fertilizer is low; leaves may yellow from nutrient deficiency.', 'Apply a small fertilizer amount and compare growth.', 1, NOW(), NOW()),
  (@plant_id, 'fertilizer', 'above', NULL, 75, 'burnt', 72, -12, -7, 'Fertilizer is too high and may burn the roots.', 'Lower fertilizer to avoid root burn.', 1, NOW(), NOW()),
  (@plant_id, 'air_temp', 'above', NULL, 34, 'heat_stress', 75, -10, -5, 'Air temperature is high; leaf edges may dry or burn.', 'Provide shade or lower heat exposure.', 1, NOW(), NOW()),
  (@plant_id, 'air_temp', 'below', 16, NULL, 'cold_stress', 60, -8, -5, 'Air temperature is low; growth slows down.', 'Move the plant to a warmer condition.', 1, NOW(), NOW()),
  (@plant_id, 'soil_humidity', 'above', NULL, 82, 'overwatered', 68, -8, -4, 'Soil humidity is very high and may invite fungal growth.', 'Let soil drain before adding more water.', 1, NOW(), NOW());

UPDATE pests SET name_th = 'เพลี้ย', model_url = 'models/aphid-static.glb', base_chance = 0, damage_per_turn = 5, behavior = 'More likely in dry and hot air.', deleted_at = NULL WHERE name_en = 'aphid';
INSERT INTO pests (name_th, name_en, description, image_url, model_url, base_chance, damage_per_turn, behavior)
SELECT 'เพลี้ย', 'aphid', NULL, NULL, 'models/aphid-static.glb', 0, 5, 'More likely in dry and hot air.'
WHERE NOT EXISTS (SELECT 1 FROM pests WHERE name_en = 'aphid');

UPDATE pests SET name_th = 'หอยทาก', model_url = 'models/snails.gltf', base_chance = 0, damage_per_turn = 6, behavior = 'More likely when soil is wet or rain is present.', deleted_at = NULL WHERE name_en = 'snail';
INSERT INTO pests (name_th, name_en, description, image_url, model_url, base_chance, damage_per_turn, behavior)
SELECT 'หอยทาก', 'snail', NULL, NULL, 'models/snails.gltf', 0, 6, 'More likely when soil is wet or rain is present.'
WHERE NOT EXISTS (SELECT 1 FROM pests WHERE name_en = 'snail');

UPDATE pests SET name_th = 'เชื้อรา', model_url = NULL, base_chance = 0, damage_per_turn = 7, behavior = 'More likely with high humidity and wet soil.', deleted_at = NULL WHERE name_en = 'fungus';
INSERT INTO pests (name_th, name_en, description, image_url, model_url, base_chance, damage_per_turn, behavior)
SELECT 'เชื้อรา', 'fungus', NULL, NULL, NULL, 0, 7, 'More likely with high humidity and wet soil.'
WHERE NOT EXISTS (SELECT 1 FROM pests WHERE name_en = 'fungus');

SET @aphid_id := (SELECT id FROM pests WHERE name_en = 'aphid' ORDER BY id LIMIT 1);
SET @snail_id := (SELECT id FROM pests WHERE name_en = 'snail' ORDER BY id LIMIT 1);
SET @fungus_id := (SELECT id FROM pests WHERE name_en = 'fungus' ORDER BY id LIMIT 1);

DELETE FROM pest_condition_rules WHERE pest_id IN (@aphid_id, @snail_id, @fungus_id);
INSERT INTO pest_condition_rules
  (pest_id, plant_id, factor, operator, min_value, max_value, chance_delta, severity, is_active, created_at, updated_at)
VALUES
  (@aphid_id, NULL, 'air_humidity', 'below', 35, NULL, 35, 40, 1, NOW(), NOW()),
  (@aphid_id, NULL, 'air_temp', 'above', NULL, 32, 30, 35, 1, NOW(), NOW()),
  (@snail_id, NULL, 'soil_humidity', 'above', NULL, 72, 65, 45, 1, NOW(), NOW()),
  (@snail_id, NULL, 'rain', 'above', NULL, 0.5, 35, 35, 1, NOW(), NOW()),
  (@fungus_id, NULL, 'air_humidity', 'above', NULL, 78, 42, 45, 1, NOW(), NOW()),
  (@fungus_id, NULL, 'soil_humidity', 'above', NULL, 78, 46, 50, 1, NOW(), NOW());

UPDATE items SET type = 'pesticide', description = 'Retired manual-removal item kept for historical records.', image_url = '/storage/icon%20picture/hand-Photoroom.png', effect_type = 'manual_pest_control:aphid,snail', effect_value = 0, rarity = 'common', is_active = 0 WHERE name = 'Hand Pick';
INSERT INTO items (name, type, description, image_url, effect_type, effect_value, rarity, is_active)
SELECT 'Hand Pick', 'pesticide', 'Retired manual-removal item kept for historical records.', '/storage/icon%20picture/hand-Photoroom.png', 'manual_pest_control:aphid,snail', 0, 'common', 0
WHERE NOT EXISTS (SELECT 1 FROM items WHERE name = 'Hand Pick');

UPDATE items SET type = 'pesticide', description = 'Clears aphids with 100% success.', image_url = '/storage/icon%20picture/Insecticide%20spray-Photoroom.png', effect_type = 'pest_control:aphid', effect_value = 100, rarity = 'common', is_active = 1 WHERE name = 'Insect Spray';
INSERT INTO items (name, type, description, image_url, effect_type, effect_value, rarity, is_active)
SELECT 'Insect Spray', 'pesticide', 'Clears aphids with 100% success.', '/storage/icon%20picture/Insecticide%20spray-Photoroom.png', 'pest_control:aphid', 100, 'common', 1
WHERE NOT EXISTS (SELECT 1 FROM items WHERE name = 'Insect Spray');

UPDATE items SET type = 'pesticide', description = 'Clears snails with 100% success.', image_url = '/storage/icon%20picture/snail%20spray.png', effect_type = 'pest_control:snail', effect_value = 100, rarity = 'common', is_active = 1 WHERE name = 'Snail Spray';
INSERT INTO items (name, type, description, image_url, effect_type, effect_value, rarity, is_active)
SELECT 'Snail Spray', 'pesticide', 'Clears snails with 100% success.', '/storage/icon%20picture/snail%20spray.png', 'pest_control:snail', 100, 'common', 1
WHERE NOT EXISTS (SELECT 1 FROM items WHERE name = 'Snail Spray');

UPDATE items SET type = 'pesticide', description = 'Clears fungus with 100% success.', image_url = '/storage/icon%20picture/Antifungal%20spray-Photoroom.png', effect_type = 'pest_control:fungus', effect_value = 100, rarity = 'common', is_active = 1 WHERE name = 'Fungus Spray';
INSERT INTO items (name, type, description, image_url, effect_type, effect_value, rarity, is_active)
SELECT 'Fungus Spray', 'pesticide', 'Clears fungus with 100% success.', '/storage/icon%20picture/Antifungal%20spray-Photoroom.png', 'pest_control:fungus', 100, 'common', 1
WHERE NOT EXISTS (SELECT 1 FROM items WHERE name = 'Fungus Spray');

DELETE si FROM shop_items si JOIN items i ON i.id = si.item_id WHERE i.name IN ('Insect Spray', 'Snail Spray', 'Fungus Spray', 'Snail Trap');
DELETE FROM items WHERE name = 'Snail Trap';

INSERT INTO shop_items (item_id, price_coin, price_gem, stock_limit, is_active, starts_at, ends_at)
SELECT id, 50, 0, NULL, 1, NULL, NULL FROM items WHERE name = 'Insect Spray';
INSERT INTO shop_items (item_id, price_coin, price_gem, stock_limit, is_active, starts_at, ends_at)
SELECT id, 25, 0, NULL, 1, NULL, NULL FROM items WHERE name = 'Snail Spray';
INSERT INTO shop_items (item_id, price_coin, price_gem, stock_limit, is_active, starts_at, ends_at)
SELECT id, 50, 0, NULL, 1, NULL, NULL FROM items WHERE name = 'Fungus Spray';

INSERT INTO model_assets (asset_key, label, type, url, metadata, created_at, updated_at)
VALUES
  ('plant.original', 'Original plant model', 'plant', 'models/plant.gltf', JSON_OBJECT('source', 'database-seed'), NOW(), NOW()),
  ('ground.dirt', 'Dirt ground model', 'scene', 'models/dirt.gltf', JSON_OBJECT('source', 'database-seed'), NOW(), NOW()),
  ('pest.aphid', 'Aphid pest model', 'pest', 'models/aphid-static.glb', JSON_OBJECT('source', 'database-seed'), NOW(), NOW()),
  ('pest.snail', 'Snail pest model', 'pest', 'models/snails.gltf', JSON_OBJECT('source', 'database-seed'), NOW(), NOW())
ON DUPLICATE KEY UPDATE
  label = VALUES(label),
  type = VALUES(type),
  url = VALUES(url),
  metadata = VALUES(metadata),
  updated_at = NOW();

INSERT INTO user_items (user_id, item_id, quantity)
SELECT u.id, i.id,
  CASE i.name
    WHEN 'Insect Spray' THEN 7
    WHEN 'Snail Spray' THEN 7
    WHEN 'Fungus Spray' THEN 7
  END
FROM users u
JOIN items i ON i.name IN ('Insect Spray', 'Snail Spray', 'Fungus Spray')
ON DUPLICATE KEY UPDATE
  quantity = GREATEST(quantity, VALUES(quantity));

COMMIT;
