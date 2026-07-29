<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('plants', function (Blueprint $table): void {
            $table->unsignedSmallInteger('real_maturity_days')->default(90);
            $table->string('growth_reference_url', 2048)->nullable();
        });

        DB::table('plants')
            ->where(function ($query): void {
                $query
                    ->whereRaw("LOWER(COALESCE(name_en, '')) LIKE ?", ['%tulip%'])
                    ->orWhere('name_th', 'ทิวลิป');
            })
            ->update([
                'real_maturity_days' => 112,
                'growth_reference_url' => 'https://extension.umn.edu/gardening-minnesota/growing-bulbs-indoors',
            ]);

        DB::table('plants')
            ->where(function ($query): void {
                $query
                    ->whereRaw("LOWER(COALESCE(name_en, '')) LIKE ?", ['%elephant%ear%'])
                    ->orWhereRaw("LOWER(COALESCE(name_en, '')) LIKE ?", ['%xanthosoma%']);
            })
            ->update([
                'real_maturity_days' => 119,
                'growth_reference_url' => 'https://plant-directory.ifas.ufl.edu/plant-directory/xanthosoma-sagittifolium/',
            ]);
    }

    public function down(): void
    {
        Schema::table('plants', function (Blueprint $table): void {
            $table->dropColumn(['real_maturity_days', 'growth_reference_url']);
        });
    }
};
