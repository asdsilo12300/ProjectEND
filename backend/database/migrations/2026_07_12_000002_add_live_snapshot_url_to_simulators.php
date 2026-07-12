<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('simulators', 'live_snapshot_url')) {
            return;
        }

        Schema::table('simulators', function (Blueprint $table): void {
            $table->string('live_snapshot_url', 255)->nullable()->after('shared_at');
        });
    }

    public function down(): void
    {
        if (! Schema::hasColumn('simulators', 'live_snapshot_url')) {
            return;
        }

        Schema::table('simulators', function (Blueprint $table): void {
            $table->dropColumn('live_snapshot_url');
        });
    }
};
