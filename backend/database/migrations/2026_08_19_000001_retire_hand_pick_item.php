<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('items') || ! Schema::hasColumn('items', 'is_active')) {
            return;
        }

        $itemIds = DB::table('items')
            ->where(function ($query) {
                $query->where('name', 'Hand Pick');

                if (Schema::hasColumn('items', 'action_key')) {
                    $query->orWhere('action_key', 'manual-pest-control');
                }
            })
            ->pluck('id');

        if ($itemIds->isEmpty()) {
            return;
        }

        DB::table('items')->whereIn('id', $itemIds)->update([
            'is_active' => false,
            'updated_at' => now(),
        ]);

        if (Schema::hasTable('shop_items') && Schema::hasColumn('shop_items', 'is_active')) {
            DB::table('shop_items')->whereIn('item_id', $itemIds)->update(['is_active' => false]);
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('items') || ! Schema::hasColumn('items', 'is_active')) {
            return;
        }

        DB::table('items')->where('name', 'Hand Pick')->update([
            'is_active' => true,
            'updated_at' => now(),
        ]);
    }
};
