<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('plant_condition_rules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('plant_id')->constrained('plants')->cascadeOnDelete();
            $table->string('factor', 80);
            $table->enum('operator', ['below', 'above', 'between', 'outside']);
            $table->decimal('min_value', 8, 2)->nullable();
            $table->decimal('max_value', 8, 2)->nullable();
            $table->string('visual_state', 80);
            $table->unsignedInteger('severity')->default(1);
            $table->integer('health_delta')->default(0);
            $table->integer('growth_delta')->default(0);
            $table->text('analysis_result')->nullable();
            $table->text('direction')->nullable();
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['plant_id', 'factor', 'is_active']);
            $table->index(['visual_state', 'severity']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('plant_condition_rules');
    }
};
