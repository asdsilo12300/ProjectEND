<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('item_types') || ! Schema::hasTable('items')) {
            return;
        }

        $needsDescriptionEn = ! Schema::hasColumn('item_types', 'description_en');
        $needsDescriptionTh = ! Schema::hasColumn('item_types', 'description_th');
        $needsIcon = ! Schema::hasColumn('item_types', 'icon');
        if ($needsDescriptionEn || $needsDescriptionTh || $needsIcon) {
            Schema::table('item_types', function (Blueprint $table) use ($needsDescriptionEn, $needsDescriptionTh, $needsIcon): void {
                if ($needsDescriptionEn) $table->text('description_en')->nullable();
                if ($needsDescriptionTh) $table->text('description_th')->nullable();
                if ($needsIcon) $table->string('icon', 2048)->default('/game-icons/item-types/general.svg');
            });
        }

        $now = now();
        DB::table('item_types')->upsert([
            ['key' => 'care', 'name_en' => 'Plant care tools', 'name_th' => 'อุปกรณ์ดูแลพืช', 'description' => 'Water, feed, and protect the active plant.', 'description_en' => 'Water, feed, and protect the active plant.', 'description_th' => 'ให้น้ำ ปุ๋ย และดูแลพืช', 'icon' => '/game-icons/item-types/care.svg', 'sort_order' => 10, 'is_active' => true, 'created_at' => $now, 'updated_at' => $now, 'deleted_at' => null],
            ['key' => 'treatment', 'name_en' => 'Plant treatment tools', 'name_th' => 'อุปกรณ์รักษาพืช', 'description' => 'Treat pests and diseases detected on the active plant.', 'description_en' => 'Treat pests and diseases detected on the active plant.', 'description_th' => 'เลือกอุปกรณ์ให้ตรงกับศัตรูพืช', 'icon' => '/game-icons/item-types/treatment.svg', 'sort_order' => 20, 'is_active' => true, 'created_at' => $now, 'updated_at' => $now, 'deleted_at' => null],
            ['key' => 'condition', 'name_en' => 'Condition tools', 'name_th' => 'เครื่องมือปรับสภาพ', 'description' => 'Adjust and protect the growing conditions around the plant.', 'description_en' => 'Adjust and protect the growing conditions around the plant.', 'description_th' => 'ปรับสภาพและป้องกันสภาพอากาศรอบต้น', 'icon' => '/game-icons/item-types/condition.svg', 'sort_order' => 30, 'is_active' => true, 'created_at' => $now, 'updated_at' => $now, 'deleted_at' => null],
            ['key' => 'prank', 'name_en' => 'Friend prank items', 'name_th' => 'ไอเทมแกล้งเพื่อน', 'description' => 'Use while visiting a friend garden.', 'description_en' => 'Use while visiting a friend garden.', 'description_th' => 'ใช้เมื่อเข้าไปเยี่ยมชมสวนของเพื่อน', 'icon' => '/game-icons/item-types/prank.svg', 'sort_order' => 40, 'is_active' => true, 'created_at' => $now, 'updated_at' => $now, 'deleted_at' => null],
        ], ['key'], ['name_en', 'name_th', 'description', 'description_en', 'description_th', 'icon', 'sort_order', 'is_active', 'updated_at', 'deleted_at']);

        $this->remapItems();

        DB::table('item_types')
            ->whereIn('key', ['seed', 'water', 'fertilizer', 'pesticide', 'booster', 'cosmetic', 'friend_prank'])
            ->whereNotIn('key', DB::table('items')->select('type')->whereNotNull('type'))
            ->update(['is_active' => false, 'deleted_at' => $now, 'updated_at' => $now]);
    }

    public function down(): void
    {
        // Item categories are user-managed data. Do not rewrite live item
        // assignments during a rollback.
    }

    private function remapItems(): void
    {
        $hasEffectType = Schema::hasColumn('items', 'effect_type');
        $hasActionKey = Schema::hasColumn('items', 'action_key');

        DB::table('items')
            ->where(function ($query) use ($hasEffectType): void {
                if ($hasEffectType) $query->where('effect_type', 'like', 'friend_pest:%');
                $query->orWhereIn('type', ['cosmetic', 'friend_prank']);
            })
            ->update(['type' => 'prank']);
        DB::table('items')
            ->where(function ($query) use ($hasEffectType, $hasActionKey): void {
                if ($hasEffectType) $query->where('effect_type', 'like', 'pest_control:%');
                if ($hasActionKey) $query->orWhereIn('action_key', ['aphid-treatment', 'snail-treatment', 'fungus-treatment']);
                $query->orWhere('type', 'pesticide');
            })
            ->update(['type' => 'treatment']);
        DB::table('items')
            ->where(function ($query) use ($hasActionKey): void {
                if ($hasActionKey) $query->whereIn('action_key', ['drainage', 'shade', 'windbreak', 'frost-cover', 'mulch']);
                $query->orWhere('type', 'booster');
            })
            ->update(['type' => 'condition']);
        DB::table('items')
            ->where(function ($query) use ($hasActionKey): void {
                if ($hasActionKey) $query->whereIn('action_key', ['water', 'fertilizer']);
                $query->orWhereIn('type', ['seed', 'water', 'fertilizer']);
            })
            ->update(['type' => 'care']);
    }
};
