<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('pest_condition_rules', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pest_id')->constrained('pests')->cascadeOnDelete();
            $table->foreignId('plant_id')->nullable()->constrained('plants')->cascadeOnDelete();
            $table->string('factor', 80);
            $table->enum('operator', ['below', 'above', 'between', 'outside']);
            $table->decimal('min_value', 8, 2)->nullable();
            $table->decimal('max_value', 8, 2)->nullable();
            $table->decimal('chance_delta', 5, 2)->default(0);
            $table->unsignedInteger('severity')->default(1);
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->index(['pest_id', 'is_active']);
            $table->index(['plant_id', 'factor']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pest_condition_rules');
    }
};
