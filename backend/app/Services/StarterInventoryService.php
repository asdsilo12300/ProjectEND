<?php

namespace App\Services;

use App\Models\Item;
use App\Models\User;
use App\Models\UserItem;

class StarterInventoryService
{
    /** @var array<string, int> */
    private const QUANTITIES = [
        'Insect Spray' => 7,
        'Snail Spray' => 7,
        'Fungus Spray' => 7,
    ];

    public function grant(User $user): void
    {
        $now = now();
        $rows = Item::query()
            ->where('is_active', true)
            ->whereIn('name', array_keys(self::QUANTITIES))
            ->pluck('id', 'name')
            ->map(fn (int $itemId, string $name) => [
                'user_id' => $user->id,
                'item_id' => $itemId,
                'quantity' => self::QUANTITIES[$name],
                'updated_at' => $now,
            ])
            ->values()
            ->all();

        if ($rows !== []) {
            UserItem::query()->insert($rows);
        }
    }
}
