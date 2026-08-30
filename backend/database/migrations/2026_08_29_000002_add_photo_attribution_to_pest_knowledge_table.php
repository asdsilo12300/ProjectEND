<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('pest_knowledge')) {
            return;
        }

        $columns = [
            'photo_url',
            'photo_source_url',
        ];

        foreach ($columns as $column) {
            if (! Schema::hasColumn('pest_knowledge', $column)) {
                Schema::table('pest_knowledge', function (Blueprint $table) use ($column): void {
                    $table->string($column, 2048)->nullable();
                });
            }
        }
    }

    public function down(): void
    {
        if (! Schema::hasTable('pest_knowledge')) {
            return;
        }

        $columns = [
            'photo_url',
            'photo_source_url',
        ];

        $existing = array_values(array_filter(
            $columns,
            fn (string $column): bool => Schema::hasColumn('pest_knowledge', $column),
        ));

        if ($existing !== []) {
            Schema::table('pest_knowledge', fn (Blueprint $table) => $table->dropColumn($existing));
        }
    }
};
