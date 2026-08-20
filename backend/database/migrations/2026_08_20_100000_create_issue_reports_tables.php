<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('issue_reports', function (Blueprint $table): void {
            $table->id();
            $table->string('reference_code', 32)->unique();
            $table->foreignId('reporter_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('reporter_username');
            $table->string('reporter_email');
            $table->string('category', 32)->index();
            $table->string('subject', 160);
            $table->text('description');
            $table->string('status', 32)->default('new')->index();
            $table->timestamp('first_seen_at')->nullable()->index();
            $table->timestamp('resolved_at')->nullable();
            $table->timestamps();
            $table->index(['reporter_id', 'created_at']);
            $table->index(['status', 'created_at']);
        });

        Schema::create('issue_report_attachments', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('issue_report_id')->constrained()->cascadeOnDelete();
            $table->string('storage_path')->unique();
            $table->string('original_name');
            $table->string('mime_type', 80);
            $table->unsignedBigInteger('size_bytes');
            $table->unsignedInteger('width')->nullable();
            $table->unsignedInteger('height')->nullable();
            $table->timestamp('created_at')->useCurrent();
        });

        Schema::create('issue_report_updates', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('issue_report_id')->constrained()->cascadeOnDelete();
            $table->foreignId('admin_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('from_status', 32)->nullable();
            $table->string('to_status', 32);
            $table->text('public_message')->nullable();
            $table->timestamp('created_at')->useCurrent();
            $table->index(['issue_report_id', 'created_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('issue_report_updates');
        Schema::dropIfExists('issue_report_attachments');
        Schema::dropIfExists('issue_reports');
    }
};
