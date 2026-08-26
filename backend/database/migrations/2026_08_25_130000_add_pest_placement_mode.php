<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('pests') || Schema::hasColumn('pests', 'placement_mode')) {
            return;
        }

        Schema::table('pests', function (Blueprint $table): void {
            $table->string('placement_mode', 32)->default('ground_random')->after('model_url');
        });

        DB::table('pests')->whereRaw('LOWER(name_en) = ?', ['aphid'])->update(['placement_mode' => 'leaf']);
        DB::table('pests')->whereRaw('LOWER(name_en) = ?', ['fungus'])->update(['placement_mode' => 'plant_surface']);
    }

    public function down(): void
    {
        if (Schema::hasTable('pests') && Schema::hasColumn('pests', 'placement_mode')) {
            Schema::table('pests', function (Blueprint $table): void {
                $table->dropColumn('placement_mode');
            });
        }
    }
};
