<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('simulation_modifiers', function (Blueprint $table): void {
            $table->timestampTz('expires_at')->nullable()->after('ends_tick');
            $table->index(['simulator_id', 'expires_at']);
        });
    }

    public function down(): void
    {
        Schema::table('simulation_modifiers', function (Blueprint $table): void {
            $table->dropIndex(['simulator_id', 'expires_at']);
            $table->dropColumn('expires_at');
        });
    }
};
