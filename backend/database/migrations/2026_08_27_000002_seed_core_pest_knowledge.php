<?php

use App\Services\PestKnowledgeProfileService;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('pest_knowledge') && Schema::hasTable('pests')) {
            app(PestKnowledgeProfileService::class)->syncCoreIfMissing();
        }
    }

    public function down(): void
    {
        // Knowledge records may be edited by administrators after deployment,
        // so rolling back must not delete their curated content.
    }
};
