<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('item_types') || ! Schema::hasColumn('item_types', 'icon')) return;

        Schema::table('item_types', function (Blueprint $table): void {
            $table->text('icon')->change();
        });

        DB::table('item_types')
            ->where(fn ($query) => $query->whereNull('icon')->orWhere('icon', 'not like', '%.svg%'))
            ->update(['icon' => '/game-icons/item-types/general.svg', 'updated_at' => now()]);

        foreach ([
            'care' => '/game-icons/item-types/care.svg',
            'treatment' => '/game-icons/item-types/treatment.svg',
            'condition' => '/game-icons/item-types/condition.svg',
            'prank' => '/game-icons/item-types/prank.svg',
        ] as $key => $icon) {
            DB::table('item_types')->where('key', $key)->update(['icon' => $icon, 'updated_at' => now()]);
        }
    }

    public function down(): void
    {
        // Keep SVG references because the admin interface no longer supports
        // library icon codes.
    }
};
