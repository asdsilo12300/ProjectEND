<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('simulators', function (Blueprint $table): void {
            if (! Schema::hasColumn('simulators', 'maturity_reward_claimed_at')) {
                $table->timestamp('maturity_reward_claimed_at')->nullable()->after('ended_at');
            }

            if (! Schema::hasColumn('simulators', 'maturity_reward_amount')) {
                $table->unsignedInteger('maturity_reward_amount')->default(0)->after('maturity_reward_claimed_at');
            }
        });
    }

    public function down(): void
    {
        Schema::table('simulators', function (Blueprint $table): void {
            if (Schema::hasColumn('simulators', 'maturity_reward_amount')) {
                $table->dropColumn('maturity_reward_amount');
            }

            if (Schema::hasColumn('simulators', 'maturity_reward_claimed_at')) {
                $table->dropColumn('maturity_reward_claimed_at');
            }
        });
    }
};
