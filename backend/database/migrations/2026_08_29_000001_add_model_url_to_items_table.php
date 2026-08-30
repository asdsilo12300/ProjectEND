<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('items') && ! Schema::hasColumn('items', 'model_url')) {
            Schema::table('items', function (Blueprint $table): void {
                $table->string('model_url', 2048)->nullable();
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasTable('items') && Schema::hasColumn('items', 'model_url')) {
            Schema::table('items', function (Blueprint $table): void {
                $table->dropColumn('model_url');
            });
        }
    }
};
