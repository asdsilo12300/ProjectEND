<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('simulators', function (Blueprint $table) {
            if (! Schema::hasColumn('simulators', 'visual_state')) {
                $table->string('visual_state', 80)->default('healthy')->after('health');
            }
            if (! Schema::hasColumn('simulators', 'visual_variant_id')) {
                $table->foreignId('visual_variant_id')->nullable()->after('visual_state')->constrained('plant_visual_variants')->nullOnDelete();
            }
            if (! Schema::hasColumn('simulators', 'visual_overrides')) {
                $table->json('visual_overrides')->nullable()->after('visual_variant_id');
            }
        });

        Schema::table('simulation_logs', function (Blueprint $table) {
            if (! Schema::hasColumn('simulation_logs', 'visual_state')) {
                $table->string('visual_state', 80)->nullable()->after('health');
            }
            if (! Schema::hasColumn('simulation_logs', 'visual_variant_id')) {
                $table->foreignId('visual_variant_id')->nullable()->after('visual_state')->constrained('plant_visual_variants')->nullOnDelete();
            }
            if (! Schema::hasColumn('simulation_logs', 'visual_overrides')) {
                $table->json('visual_overrides')->nullable()->after('visual_variant_id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('simulation_logs', function (Blueprint $table) {
            if (Schema::hasColumn('simulation_logs', 'visual_variant_id')) {
                $table->dropConstrainedForeignId('visual_variant_id');
            }
            if (Schema::hasColumn('simulation_logs', 'visual_overrides')) {
                $table->dropColumn('visual_overrides');
            }
            if (Schema::hasColumn('simulation_logs', 'visual_state')) {
                $table->dropColumn('visual_state');
            }
        });

        Schema::table('simulators', function (Blueprint $table) {
            if (Schema::hasColumn('simulators', 'visual_variant_id')) {
                $table->dropConstrainedForeignId('visual_variant_id');
            }
            if (Schema::hasColumn('simulators', 'visual_overrides')) {
                $table->dropColumn('visual_overrides');
            }
            if (Schema::hasColumn('simulators', 'visual_state')) {
                $table->dropColumn('visual_state');
            }
        });
    }
};
