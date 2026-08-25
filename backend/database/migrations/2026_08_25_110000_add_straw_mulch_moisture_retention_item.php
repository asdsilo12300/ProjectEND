<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        $now = now();
        $itemId = DB::table('items')->where('action_key', 'mulch')->value('id');

        if (! $itemId) {
            // Keep every player's existing quantity: the old first card was
            // the one presented as moisture protection, so convert that row
            // and create a separate Drainage Mix below for heavy-rain care.
            $itemId = DB::table('items')->where('action_key', 'drainage')->value('id');
            if ($itemId) {
                DB::table('items')->where('id', $itemId)->update(['action_key' => 'mulch']);
            } else {
                $itemId = DB::table('items')->insertGetId([
                    'name' => 'Straw Mulch', 'type' => 'booster',
                    'effect_type' => 'environment:mulch', 'effect_value' => 20,
                    'rarity' => 'common', 'is_active' => true, 'action_key' => 'mulch',
                    'mode_scope' => 'outdoor', 'created_at' => $now, 'updated_at' => $now,
                ]);
            }
        }

        if ($itemId) {
            DB::table('items')->where('id', $itemId)->update([
                'name' => 'Straw Mulch',
                'description' => 'Straw ground cover that slows evaporation so water and soil moisture last longer.',
                'image_url' => '/game-icons/care/straw-mulch-retention.png',
                'effect_type' => 'environment:mulch',
                'effect_value' => 20,
                'is_active' => true,
                'mode_scope' => 'outdoor',
                'effect_payload' => json_encode([
                    'strategy' => 'moisture_retention',
                    'duration_ticks' => 2,
                    'duration_seconds' => 30,
                ], JSON_THROW_ON_ERROR),
                'animation_key' => 'straw-mulch',
                'updated_at' => $now,
            ]);
        }

        if ($itemId && ! DB::table('shop_items')->where('item_id', $itemId)->exists()) {
            DB::table('shop_items')->insert([
                'item_id' => $itemId,
                'price_coin' => 30,
                'price_gem' => 0,
                'is_active' => true,
            ]);
        } elseif ($itemId) {
            DB::table('shop_items')->where('item_id', $itemId)->update([
                'price_coin' => 30, 'price_gem' => 0, 'is_active' => true,
            ]);
        }

        // A deployment that already ran an earlier draft may still contain a
        // second drainage card. Retire it from both inventory and shop views.
        $drainageIds = DB::table('items')->where('action_key', 'drainage')->pluck('id');
        if ($drainageIds->isNotEmpty()) {
            DB::table('items')->whereIn('id', $drainageIds)->update(['is_active' => false, 'updated_at' => $now]);
            DB::table('shop_items')->whereIn('item_id', $drainageIds)->update(['is_active' => false]);
        }

        DB::table('event_definitions')->whereIn('event_key', ['light-rain', 'heavy-rain'])->update([
            'response_action_keys' => json_encode(['mulch'], JSON_THROW_ON_ERROR),
            'updated_at' => $now,
        ]);
    }

    public function down(): void
    {
        $mulchId = DB::table('items')->where('action_key', 'mulch')->value('id');
        if (! $mulchId) return;

        DB::table('items')->where('id', $mulchId)->update([
            'name' => 'Drainage Mix',
            'description' => 'Reduce excessive outdoor soil moisture after heavy rain.',
            'image_url' => null,
            'effect_type' => 'environment:drainage',
            'effect_value' => 20,
            'action_key' => 'drainage',
            'effect_payload' => json_encode(['strategy' => 'drainage', 'duration_ticks' => 2, 'duration_seconds' => 30], JSON_THROW_ON_ERROR),
            'animation_key' => 'soil-mix',
            'updated_at' => now(),
        ]);
        DB::table('shop_items')->where('item_id', $mulchId)->update(['price_coin' => 35]);
        DB::table('event_definitions')->whereIn('event_key', ['light-rain', 'heavy-rain'])->update([
            'response_action_keys' => json_encode(['drainage'], JSON_THROW_ON_ERROR),
            'updated_at' => now(),
        ]);
    }
};
