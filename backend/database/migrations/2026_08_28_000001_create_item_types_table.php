<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('item_types')) {
            Schema::create('item_types', function (Blueprint $table): void {
                $table->id();
                $table->string('key', 100)->unique();
                $table->string('name_en', 191);
                $table->string('name_th', 191);
                $table->text('description')->nullable();
                $table->text('description_en')->nullable();
                $table->text('description_th')->nullable();
                $table->string('icon', 2048)->default('/game-icons/item-types/general.svg');
                $table->unsignedInteger('sort_order')->default(0)->index();
                $table->boolean('is_active')->default(true)->index();
                $table->timestamps();
                $table->softDeletes()->index();
            });
        }

        $defaults = [
            'care' => ['Plant care tools', 'อุปกรณ์ดูแลพืช', 'Water, feed, and protect the active plant.', 'ให้น้ำ ปุ๋ย และดูแลพืช', '/game-icons/item-types/care.svg'],
            'treatment' => ['Plant treatment tools', 'อุปกรณ์รักษาพืช', 'Treat pests and diseases detected on the active plant.', 'เลือกอุปกรณ์ให้ตรงกับศัตรูพืช', '/game-icons/item-types/treatment.svg'],
            'condition' => ['Condition tools', 'เครื่องมือปรับสภาพ', 'Adjust and protect the growing conditions around the plant.', 'ปรับสภาพและป้องกันสภาพอากาศรอบต้น', '/game-icons/item-types/condition.svg'],
            'prank' => ['Friend prank items', 'ไอเทมแกล้งเพื่อน', 'Use while visiting a friend garden.', 'ใช้เมื่อเข้าไปเยี่ยมชมสวนของเพื่อน', '/game-icons/item-types/prank.svg'],
        ];

        $this->remapExistingItems();

        $existingKeys = Schema::hasTable('items')
            ? DB::table('items')->whereNotNull('type')->distinct()->pluck('type')->map(fn ($key) => trim((string) $key))->filter()->values()->all()
            : [];
        $keys = array_values(array_unique([...array_keys($defaults), ...$existingKeys]));
        $now = now();
        $rows = [];
        foreach ($keys as $index => $key) {
            [$nameEn, $nameTh, $descriptionEn, $descriptionTh, $icon] = $defaults[$key] ?? [str($key)->headline()->toString(), str($key)->headline()->toString(), null, null, '/game-icons/item-types/general.svg'];
            $rows[] = [
                'key' => $key,
                'name_en' => $nameEn,
                'name_th' => $nameTh,
                'description' => $descriptionEn,
                'description_en' => $descriptionEn,
                'description_th' => $descriptionTh,
                'icon' => $icon,
                'sort_order' => ($index + 1) * 10,
                'is_active' => true,
                'created_at' => $now,
                'updated_at' => $now,
            ];
        }
        DB::table('item_types')->upsert($rows, ['key'], ['name_en', 'name_th', 'description', 'description_en', 'description_th', 'icon', 'sort_order', 'is_active', 'updated_at']);

        if (Schema::hasTable('items') && DB::getDriverName() === 'pgsql') {
            DB::statement('ALTER TABLE items DROP CONSTRAINT IF EXISTS items_type_check');
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('item_types');
    }

    private function remapExistingItems(): void
    {
        if (! Schema::hasTable('items')) {
            return;
        }

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
