<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $now = now();
        $mulchId = DB::table('items')->where('action_key', 'mulch')->value('id');

        if ($mulchId) {
            DB::table('items')->where('id', $mulchId)->update([
                'name' => 'Straw Mulch',
                'description' => 'Use during heavy rain, low soil moisture, or excessive soil heat to help water and moisture last longer.',
                'image_url' => '/game-icons/care/straw-mulch-retention.png',
                'effect_type' => 'environment:mulch',
                'effect_value' => 20,
                'is_active' => true,
                'mode_scope' => 'outdoor',
                'effect_payload' => json_encode([
                    'strategy' => 'moisture_retention',
                    'duration_ticks' => 2,
                    'duration_seconds' => 30,
                    'availability' => [
                        'rain_min_mm' => 25,
                        'soil_humidity_below_plant_min' => true,
                        'soil_temperature_above_plant_max' => true,
                    ],
                ], JSON_THROW_ON_ERROR),
                'animation_key' => 'straw-mulch',
                'updated_at' => $now,
            ]);

            DB::table('shop_items')->updateOrInsert(
                ['item_id' => $mulchId],
                ['price_coin' => 30, 'price_gem' => 0, 'is_active' => true],
            );
        }

        $drainageIds = DB::table('items')->where('action_key', 'drainage')->pluck('id');
        if ($drainageIds->isNotEmpty()) {
            DB::table('items')->whereIn('id', $drainageIds)->update(['is_active' => false, 'updated_at' => $now]);
            DB::table('shop_items')->whereIn('item_id', $drainageIds)->update(['is_active' => false]);
        }

        DB::table('event_definitions')->where('event_key', 'light-rain')->update([
            'response_action_keys' => json_encode([], JSON_THROW_ON_ERROR),
            'updated_at' => $now,
        ]);
        DB::table('event_definitions')->where('event_key', 'heavy-rain')->update([
            'response_action_keys' => json_encode(['mulch'], JSON_THROW_ON_ERROR),
            'updated_at' => $now,
        ]);

        Cache::store((string) config('catalog.cache_store', 'file'))->forget('public-catalog:v3:shop-items');
    }

    public function down(): void
    {
        $drainageIds = DB::table('items')->where('action_key', 'drainage')->pluck('id');
        if ($drainageIds->isNotEmpty()) {
            DB::table('items')->whereIn('id', $drainageIds)->update(['is_active' => true, 'updated_at' => now()]);
            DB::table('shop_items')->whereIn('item_id', $drainageIds)->update(['is_active' => true]);
        }
        DB::table('event_definitions')->whereIn('event_key', ['light-rain', 'heavy-rain'])->update([
            'response_action_keys' => json_encode(['drainage'], JSON_THROW_ON_ERROR),
            'updated_at' => now(),
        ]);
        Cache::store((string) config('catalog.cache_store', 'file'))->forget('public-catalog:v3:shop-items');
    }
};
