<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('plants') && ! Schema::hasColumn('plants', 'base_model_url')) {
            Schema::table('plants', function (Blueprint $table) {
                $table->string('base_model_url')->nullable()->after('base_image_url');
            });
        }

        if (Schema::hasTable('plant_growth_stages') && ! Schema::hasColumn('plant_growth_stages', 'model_url')) {
            Schema::table('plant_growth_stages', function (Blueprint $table) {
                $table->string('model_url')->nullable()->after('image_url');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('plants') && Schema::hasColumn('plants', 'base_model_url')) {
            Schema::table('plants', function (Blueprint $table) {
                $table->dropColumn('base_model_url');
            });
        }

        if (Schema::hasTable('plant_growth_stages') && Schema::hasColumn('plant_growth_stages', 'model_url')) {
            Schema::table('plant_growth_stages', function (Blueprint $table) {
                $table->dropColumn('model_url');
            });
        }
    }
};
