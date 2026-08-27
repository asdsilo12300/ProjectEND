<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('pest_knowledge')) {
            return;
        }

        Schema::create('pest_knowledge', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('pest_id')->unique()->constrained('pests')->cascadeOnDelete();
            $table->string('scientific_name')->nullable();
            $table->string('family')->nullable();
            $table->string('category_en')->nullable();
            $table->string('category_th')->nullable();
            $table->text('summary_en')->nullable();
            $table->text('summary_th')->nullable();
            $table->json('signs_en')->nullable();
            $table->json('signs_th')->nullable();
            $table->json('favorable_conditions_en')->nullable();
            $table->json('favorable_conditions_th')->nullable();
            $table->json('prevention_en')->nullable();
            $table->json('prevention_th')->nullable();
            $table->json('treatment_action_keys')->nullable();
            $table->json('sources')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('pest_knowledge');
    }
};
