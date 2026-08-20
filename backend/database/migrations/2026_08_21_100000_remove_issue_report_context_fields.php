<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('issue_reports', function (Blueprint $table): void {
            $columns = array_values(array_filter(
                ['page_url', 'client_context'],
                fn (string $column): bool => Schema::hasColumn('issue_reports', $column),
            ));

            if ($columns !== []) {
                $table->dropColumn($columns);
            }
        });
    }

    public function down(): void
    {
        Schema::table('issue_reports', function (Blueprint $table): void {
            if (! Schema::hasColumn('issue_reports', 'page_url')) {
                $table->text('page_url')->nullable();
            }
            if (! Schema::hasColumn('issue_reports', 'client_context')) {
                $table->json('client_context')->nullable();
            }
        });
    }
};
