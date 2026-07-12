<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('simulators', function (Blueprint $table): void {
            if (! Schema::hasColumn('simulators', 'share_visibility')) {
                $table->string('share_visibility', 16)->default('private')->after('status');
            }
            if (! Schema::hasColumn('simulators', 'state_version')) {
                $table->unsignedBigInteger('state_version')->default(1)->after('share_visibility');
            }
            if (! Schema::hasColumn('simulators', 'shared_at')) {
                $table->timestamp('shared_at')->nullable()->after('state_version');
            }
            if (! Schema::hasColumn('simulators', 'live_snapshot_url')) {
                $table->string('live_snapshot_url', 255)->nullable()->after('shared_at');
            }
        });

        Schema::table('plant_histories', function (Blueprint $table): void {
            if (! Schema::hasColumn('plant_histories', 'game_state')) {
                $table->json('game_state')->nullable()->after('snapshot_image_url');
            }
        });

        Schema::table('posts', function (Blueprint $table): void {
            if (! Schema::hasColumn('posts', 'simulator_id')) {
                $table->unsignedBigInteger('simulator_id')->nullable()->after('plant_history_id');
                $table->index('simulator_id');
            }
        });

        if (! Schema::hasTable('social_notifications')) {
            Schema::create('social_notifications', function (Blueprint $table): void {
                $table->id();
                $table->unsignedBigInteger('recipient_id');
                $table->unsignedBigInteger('actor_id');
                $table->unsignedBigInteger('post_id')->nullable();
                $table->unsignedBigInteger('comment_id')->nullable();
                $table->string('type', 32);
                $table->string('excerpt', 240)->nullable();
                $table->timestamp('read_at')->nullable();
                $table->timestamps();
                $table->index(['recipient_id', 'read_at', 'created_at'], 'social_notifications_recipient_index');
                $table->index(['post_id', 'type']);
            });
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('social_notifications');

        Schema::table('posts', function (Blueprint $table): void {
            if (Schema::hasColumn('posts', 'simulator_id')) {
                $table->dropIndex(['simulator_id']);
                $table->dropColumn('simulator_id');
            }
        });

        Schema::table('plant_histories', function (Blueprint $table): void {
            if (Schema::hasColumn('plant_histories', 'game_state')) {
                $table->dropColumn('game_state');
            }
        });

        Schema::table('simulators', function (Blueprint $table): void {
            $columns = array_filter(['share_visibility', 'state_version', 'shared_at', 'live_snapshot_url'], fn (string $column) => Schema::hasColumn('simulators', $column));
            if ($columns) {
                $table->dropColumn($columns);
            }
        });
    }
};
