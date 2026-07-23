<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    private const ITEMS = [
        [
            'name' => 'Aphid Prank',
            'description' => 'Send aphids to one active plant in a friend garden.',
            'image_url' => '/storage/icon%20picture/aphid-Photoroom.png',
            'effect_type' => 'friend_pest:aphid',
        ],
        [
            'name' => 'Snail Prank',
            'description' => 'Send a snail to one active plant in a friend garden.',
            'image_url' => '/storage/icon%20picture/snails-Photoroom.png',
            'effect_type' => 'friend_pest:snail',
        ],
    ];

    public function up(): void
    {
        DB::transaction(function (): void {
            foreach (self::ITEMS as $prankItem) {
                $item = DB::table('items')->where('name', $prankItem['name'])->first();
                $values = [
                    'type' => 'cosmetic',
                    'description' => $prankItem['description'],
                    'image_url' => $prankItem['image_url'],
                    'effect_type' => $prankItem['effect_type'],
                    'effect_value' => 1,
                    'rarity' => 'common',
                    'is_active' => true,
                    'deleted_at' => null,
                    'updated_at' => now(),
                ];

                if ($item) {
                    DB::table('items')->where('id', $item->id)->update($values);
                    $itemId = $item->id;
                } else {
                    $itemId = DB::table('items')->insertGetId([
                        'name' => $prankItem['name'],
                        ...$values,
                        'created_at' => now(),
                    ]);
                }

                DB::table('shop_items')->updateOrInsert(
                    ['item_id' => $itemId],
                    [
                        'price_coin' => 100,
                        'price_gem' => 0,
                        'stock_limit' => null,
                        'is_active' => true,
                        'starts_at' => null,
                        'ends_at' => null,
                        'deleted_at' => null,
                    ],
                );
            }
        });
    }

    public function down(): void
    {
        DB::transaction(function (): void {
            $itemIds = DB::table('items')
                ->whereIn('name', array_column(self::ITEMS, 'name'))
                ->pluck('id');

            DB::table('shop_items')->whereIn('item_id', $itemIds)->delete();
            DB::table('item_usages')->whereIn('item_id', $itemIds)->delete();
            DB::table('user_items')->whereIn('item_id', $itemIds)->delete();
            DB::table('items')->whereIn('id', $itemIds)->delete();
        });
    }
};
