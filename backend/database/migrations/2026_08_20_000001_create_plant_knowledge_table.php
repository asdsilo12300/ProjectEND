<?php

use App\Models\Plant;
use App\Services\PlantKnowledgeProfileService;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('plant_knowledge')) {
            Schema::create('plant_knowledge', function (Blueprint $table): void {
                $table->id();
                $table->foreignId('plant_id')->unique()->constrained('plants')->cascadeOnDelete();
                $table->string('scientific_name')->nullable();
                $table->string('family')->nullable();
                $table->string('category_en')->nullable();
                $table->string('category_th')->nullable();
                $table->text('summary_en')->nullable();
                $table->text('summary_th')->nullable();
                $table->json('care_en')->nullable();
                $table->json('care_th')->nullable();
                $table->text('caution_en')->nullable();
                $table->text('caution_th')->nullable();
                $table->string('photo_url', 2048)->nullable();
                $table->string('photo_alt_en')->nullable();
                $table->string('photo_alt_th')->nullable();
                $table->string('photo_credit')->nullable();
                $table->string('photo_source_url', 2048)->nullable();
                $table->string('photo_license')->nullable();
                $table->string('photo_license_url', 2048)->nullable();
                $table->json('sources')->nullable();
                $table->timestamps();
                $table->softDeletes();
            });
        }

        if (Schema::hasTable('plants')) {
            $profiles = app(PlantKnowledgeProfileService::class);
            Plant::query()->each(fn (Plant $plant): bool => $profiles->syncIfMissing($plant));
        }
    }

    public function down(): void
    {
        Schema::dropIfExists('plant_knowledge');
    }
};
