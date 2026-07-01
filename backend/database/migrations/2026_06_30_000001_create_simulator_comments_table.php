<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('simulator_comments', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('simulator_id')->constrained('simulators')->cascadeOnDelete();
            $table->foreignId('user_id')->constrained('users')->cascadeOnDelete();
            $table->text('comment_text');
            $table->string('status', 24)->default('visible');
            $table->timestamps();
            $table->softDeletes();

            $table->index(['simulator_id', 'status', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('simulator_comments');
    }
};