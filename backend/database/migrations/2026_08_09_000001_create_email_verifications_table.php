<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Verification becomes mandatory for accounts created after this rollout.
        // Existing accounts remain usable and are treated as already verified.
        if (Schema::hasColumn('users', 'email_verified_at')) {
            DB::table('users')
                ->whereNull('email_verified_at')
                ->update(['email_verified_at' => DB::raw('COALESCE(created_at, CURRENT_TIMESTAMP)')]);
        }

        Schema::create('email_verifications', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('otp_hash', 64);
            $table->string('token_hash', 64)->unique();
            $table->unsignedTinyInteger('attempts')->default(0);
            $table->timestamp('expires_at');
            $table->timestamp('resend_available_at');
            $table->timestamp('used_at')->nullable();
            $table->string('requested_ip', 45)->nullable();
            $table->timestamps();

            $table->index(['user_id', 'used_at', 'created_at'], 'email_verifications_user_index');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('email_verifications');
    }
};
