<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('model_assets', function (Blueprint $table) {
            $table->id();
            $table->string('asset_key')->unique();
            $table->string('label')->nullable();
            $table->string('type', 40)->default('model');
            $table->string('url');
            $table->json('metadata')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('model_assets');
    }
};
