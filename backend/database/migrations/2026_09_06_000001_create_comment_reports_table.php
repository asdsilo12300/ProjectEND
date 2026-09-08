<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('comment_reports', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('reporter_id')->constrained('users')->cascadeOnDelete();
            $table->string('comment_type', 24);
            $table->unsignedBigInteger('comment_id');
            $table->string('reason', 32);
            $table->text('details')->nullable();
            $table->string('status', 24)->default('pending');
            $table->timestamps();

            $table->unique(['reporter_id', 'comment_type', 'comment_id'], 'comment_reports_unique_reporter');
            $table->index(['comment_type', 'comment_id', 'status'], 'comment_reports_lookup');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('comment_reports');
    }
};
