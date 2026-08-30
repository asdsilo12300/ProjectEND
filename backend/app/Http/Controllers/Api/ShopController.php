<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ItemType;
use App\Models\ShopItem;
use App\Models\User;
use App\Models\UserItem;
use App\Models\WalletTransaction;
use App\Services\PublicCatalogCache;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class ShopController extends Controller
{
    public function __construct(private readonly PublicCatalogCache $cache) {}

    public function index(): JsonResponse
    {
        $items = $this->cache->remember('shop-items', fn () => ShopItem::query()
            ->with(['item.typeDefinition', 'item.animationPreset'])
            ->whereHas('item', fn ($query) => $query->whereNull('deleted_at')->where('is_active', true))
            ->where('is_active', true)
            ->get()
            ->toArray());

        // Keep retired legacy records out even when a previous catalog response
        // is still present in the browser/Redis cache during a deployment.
        $items = array_values(array_filter($items, function (array $shopItem): bool {
            $item = $shopItem['item'] ?? [];
            $name = strtolower(trim((string) ($item['name'] ?? '')));
            $actionKey = strtolower(trim((string) ($item['action_key'] ?? '')));

            return $name !== 'hand pick'
                && $actionKey !== 'manual-pest-control'
                && $actionKey !== 'drainage';
        }));

        $seconds = max(0, (int) config('catalog.browser_cache_seconds', 30));

        $itemTypes = ItemType::query()
            ->where('is_active', true)
            ->orderBy('sort_order')
            ->orderBy('name_en')
            ->get(['id', 'key', 'name_en', 'name_th', 'description_en', 'description_th', 'icon', 'sort_order'])
            ->toArray();

        return response()
            ->json(['data' => $items, 'item_types' => $itemTypes])
            ->header('Cache-Control', "public, max-age={$seconds}, stale-while-revalidate=300");
    }

    public function inventory(Request $request): JsonResponse
    {
        $items = UserItem::query()
            ->with(['item.typeDefinition', 'item.animationPreset'])
            ->whereHas('item', fn ($query) => $query->whereNull('deleted_at')->where('is_active', true))
            ->where('user_id', $request->user()->id)
            ->get();

        return response()->json(['data' => $items]);
    }

    public function buy(Request $request, ShopItem $shopItem): JsonResponse
    {
        $data = $request->validate([
            'quantity' => ['nullable', 'integer', 'min:1', 'max:99'],
        ]);

        $quantity = (int) ($data['quantity'] ?? 1);

        abort_unless(
            $shopItem->is_active
            && $shopItem->item()->whereNull('deleted_at')->where('is_active', true)->exists(),
            404,
            'This shop item is no longer available.',
        );

        [$inventory, $user, $totalCoin, $totalGem] = DB::transaction(function () use ($quantity, $request, $shopItem) {
            $user = User::query()->lockForUpdate()->findOrFail($request->user()->id);
            $totalCoin = $shopItem->price_coin * $quantity;
            $totalGem = $shopItem->price_gem * $quantity;

            abort_if($user->coin < $totalCoin || $user->gem < $totalGem, 422, 'Not enough currency.');

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

            return [$inventory->load(['item.typeDefinition', 'item.animationPreset']), $user->refresh(), $totalCoin, $totalGem];
        });

        return response()->json([
            'data' => $inventory,
            'user' => $user,
            'purchase' => [
                'quantity' => $quantity,
                'total_coin' => $totalCoin,
                'total_gem' => $totalGem,
            ],
        ], 201);
    }
}
