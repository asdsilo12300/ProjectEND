<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table): void {
            $table->index('status', 'admin_perf_users_status');
            $table->index('created_at', 'admin_perf_users_created_at');
        });

        Schema::table('simulators', function (Blueprint $table): void {
            $table->index(['status', 'deleted_at'], 'admin_perf_simulators_status');
            $table->index('created_at', 'admin_perf_simulators_created_at');
        });

        Schema::table('plant_histories', function (Blueprint $table): void {
            $table->index('created_at', 'admin_perf_histories_created_at');
        });

        Schema::table('posts', function (Blueprint $table): void {
            $table->index('created_at', 'admin_perf_posts_created_at');
        });

        Schema::table('comments', function (Blueprint $table): void {
            $table->index(['status', 'deleted_at'], 'admin_perf_comments_status');
        });

        Schema::table('simulator_comments', function (Blueprint $table): void {
            $table->index(['status', 'deleted_at'], 'admin_perf_sim_comments_status');
        });

        Schema::table('admin_activity_logs', function (Blueprint $table): void {
            $table->index(['created_at', 'id'], 'admin_perf_activity_recent');
        });
    }

    public function down(): void
    {
        Schema::table('admin_activity_logs', fn (Blueprint $table) => $table->dropIndex('admin_perf_activity_recent'));
        Schema::table('simulator_comments', fn (Blueprint $table) => $table->dropIndex('admin_perf_sim_comments_status'));
        Schema::table('comments', fn (Blueprint $table) => $table->dropIndex('admin_perf_comments_status'));
        Schema::table('posts', fn (Blueprint $table) => $table->dropIndex('admin_perf_posts_created_at'));
        Schema::table('plant_histories', fn (Blueprint $table) => $table->dropIndex('admin_perf_histories_created_at'));
        Schema::table('simulators', function (Blueprint $table): void {
            $table->dropIndex('admin_perf_simulators_status');
            $table->dropIndex('admin_perf_simulators_created_at');
        });
        Schema::table('users', function (Blueprint $table): void {
            $table->dropIndex('admin_perf_users_status');
            $table->dropIndex('admin_perf_users_created_at');
        });
    }
};
