<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('social_notifications', function (Blueprint $table): void {
            if (! Schema::hasColumn('social_notifications', 'simulator_id')) {
                $table->unsignedBigInteger('simulator_id')->nullable()->after('comment_id');
                $table->index(['simulator_id', 'type'], 'social_notifications_simulator_type_index');
            }

            if (! Schema::hasColumn('social_notifications', 'simulator_comment_id')) {
                $table->unsignedBigInteger('simulator_comment_id')->nullable()->after('simulator_id');
            }
        });
    }

    public function down(): void
    {
        Schema::table('social_notifications', function (Blueprint $table): void {
            if (Schema::hasColumn('social_notifications', 'simulator_id')) {
                $table->dropIndex('social_notifications_simulator_type_index');
            }

            $columns = array_filter(
                ['simulator_id', 'simulator_comment_id'],
                fn (string $column) => Schema::hasColumn('social_notifications', $column),
            );

            if ($columns) {
                $table->dropColumn($columns);
            }
        });
    }
};
