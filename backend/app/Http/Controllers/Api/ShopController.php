<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ShopItem;
use App\Models\UserItem;
use App\Models\WalletTransaction;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ShopController extends Controller
{
    public function index(): JsonResponse
    {
        $items = ShopItem::query()
            ->with('item')
            ->whereHas('item', fn ($query) => $query->whereNull('deleted_at')->where('is_active', true))
            ->where('is_active', true)
            ->get();

        return response()->json(['data' => $items]);
    }

    public function inventory(Request $request): JsonResponse
    {
        $items = UserItem::query()
            ->with('item')
            ->where('user_id', $request->user()->id)
            ->get();

        return response()->json(['data' => $items]);
    }

    public function buy(Request $request, ShopItem $shopItem): JsonResponse
    {
        $data = $request->validate([
            'quantity' => ['nullable', 'integer', 'min:1'],
        ]);

        $quantity = (int) ($data['quantity'] ?? 1);

        abort_unless(
            $shopItem->is_active
            && $shopItem->item()->whereNull('deleted_at')->where('is_active', true)->exists(),
            404,
            'This shop item is no longer available.',
        );

        $user = $request->user();
        $totalCoin = $shopItem->price_coin * $quantity;
        $totalGem = $shopItem->price_gem * $quantity;

        abort_if($user->coin < $totalCoin || $user->gem < $totalGem, 422, 'Not enough currency.');

        $inventory = DB::transaction(function () use ($quantity, $shopItem, $totalCoin, $totalGem, $user) {
            $user->decrement('coin', $totalCoin);
            $user->decrement('gem', $totalGem);

            if ($totalCoin > 0) {
                WalletTransaction::query()->create([
                    'user_id' => $user->id,
                    'currency' => 'coin',
                    'amount' => -$totalCoin,
                    'type' => 'spend',
                    'reference_type' => 'shop_item',
                    'reference_id' => $shopItem->id,
                ]);
            }

            if ($totalGem > 0) {
                WalletTransaction::query()->create([
                    'user_id' => $user->id,
                    'currency' => 'gem',
                    'amount' => -$totalGem,
                    'type' => 'spend',
                    'reference_type' => 'shop_item',
                    'reference_id' => $shopItem->id,
                ]);
            }

            $inventory = UserItem::query()->firstOrNew([
                'user_id' => $user->id,
                'item_id' => $shopItem->item_id,
            ]);

            $inventory->quantity = ($inventory->quantity ?? 0) + $quantity;
            $inventory->save();

            return $inventory->load('item');
        });

        return response()->json([
            'data' => $inventory,
            'user' => $user->refresh(),
        ], 201);
    }
}
