<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('plant_visual_variants', function (Blueprint $table) {
            $table->id();
            $table->foreignId('plant_id')->constrained('plants')->cascadeOnDelete();
            $table->foreignId('stage_id')->nullable()->constrained('plant_growth_stages')->nullOnDelete();
            $table->string('state_key', 80);
            $table->string('label', 120)->nullable();
            $table->string('model_url')->nullable();
            $table->string('leaf_color', 24)->nullable();
            $table->string('stem_color', 24)->nullable();
            $table->string('leaf_state', 80)->nullable();
            $table->string('stem_state', 80)->nullable();
            $table->decimal('scale', 5, 2)->default(1.00);
            $table->unsignedInteger('priority')->default(0);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['plant_id', 'state_key']);
            $table->index(['stage_id', 'state_key']);
            $table->index(['is_active', 'priority']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('plant_visual_variants');
    }
};
