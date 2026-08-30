<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('animation_presets')) {
            Schema::create('animation_presets', function (Blueprint $table): void {
                $table->id();
                $table->string('key', 100)->unique();
                $table->string('name_en');
                $table->string('name_th');
                $table->text('description_en')->nullable();
                $table->text('description_th')->nullable();
                $table->string('motion_type', 60);
                $table->string('effect_type', 40)->default('none');
                $table->string('target_type', 40)->default('plant');
                $table->unsignedInteger('duration_ms')->default(1200);
                $table->decimal('speed', 5, 2)->default(1);
                $table->decimal('amplitude', 5, 2)->default(1);
                $table->string('particle_color', 20)->default('#dff8ed');
                $table->unsignedSmallInteger('particle_count')->default(24);
                $table->decimal('scale', 5, 2)->default(1);
                $table->boolean('is_active')->default(true);
                $table->timestamps();
                $table->softDeletes();
            });
        }

        $now = now();
        $presets = [
            ['watering-can', 'Watering can', 'บัวรดน้ำ', 'water', 'soil'],
            ['fertilizer-pour', 'Fertilizer pour', 'เทปุ๋ย', 'fertilizer', 'soil'],
            ['pest-spray', 'Pest spray', 'ฉีดกำจัดศัตรูพืช', 'spray', 'pest'],
            ['hand-pick', 'Hand pick', 'หยิบออกด้วยมือ', 'none', 'pest'],
            ['soil-mix', 'Mix soil', 'ผสมดิน', 'drainage', 'soil'],
            ['straw-mulch', 'Spread mulch', 'คลุมดิน', 'none', 'soil'],
            ['shade-cover', 'Place shade cover', 'ติดตั้งผ้าบังแดด', 'none', 'scene'],
            ['windbreak', 'Place windbreak', 'ติดตั้งแนวกันลม', 'none', 'scene'],
            ['frost-cover', 'Place frost cover', 'คลุมกันหนาว', 'none', 'scene'],
            ['place-down', 'Place and settle', 'วางลงข้างต้น', 'none', 'plant'],
            ['pour-liquid', 'Pour liquid', 'เทของเหลว', 'water', 'soil'],
            ['scatter', 'Scatter material', 'หว่านวัสดุ', 'fertilizer', 'soil'],
            ['spray-mist', 'Spray mist', 'ฉีดละออง', 'spray', 'plant'],
            ['dig-mix', 'Dig and mix', 'ขุดและผสม', 'drainage', 'soil'],
            ['sweep', 'Sweep across', 'กวาดด้านข้าง', 'none', 'plant'],
            ['spin-activate', 'Spin to activate', 'หมุนเพื่อเปิดใช้งาน', 'light', 'plant'],
            ['hover-pulse', 'Hover and pulse', 'ลอยและเต้นเป็นจังหวะ', 'light', 'plant'],
            ['bounce-drop', 'Drop and bounce', 'ตกและเด้ง', 'none', 'soil'],
            ['shake-use', 'Shake while working', 'เขย่าขณะใช้งาน', 'none', 'plant'],
        ];

        foreach ($presets as [$key, $nameEn, $nameTh, $effect, $target]) {
            DB::table('animation_presets')->updateOrInsert(
                ['key' => $key],
                [
                    'name_en' => $nameEn,
                    'name_th' => $nameTh,
                    'motion_type' => $key,
                    'effect_type' => $effect,
                    'target_type' => $target,
                    'duration_ms' => 1200,
                    'speed' => 1,
                    'amplitude' => 1,
                    'particle_color' => '#dff8ed',
                    'particle_count' => 24,
                    'scale' => 1,
                    'is_active' => true,
                    'created_at' => $now,
                    'updated_at' => $now,
                ],
            );
        }

        if (! Schema::hasColumn('items', 'animation_preset_id')) {
            Schema::table('items', function (Blueprint $table): void {
                $table->foreignId('animation_preset_id')->nullable()->after('animation_key')->constrained('animation_presets')->nullOnDelete();
            });
        }

        DB::table('animation_presets')->orderBy('id')->get(['id', 'key'])->each(function ($preset): void {
            DB::table('items')->where('animation_key', $preset->key)->update(['animation_preset_id' => $preset->id]);
        });
    }

    public function down(): void
    {
        if (Schema::hasColumn('items', 'animation_preset_id')) {
            Schema::table('items', function (Blueprint $table): void {
                $table->dropConstrainedForeignId('animation_preset_id');
            });
        }
        Schema::dropIfExists('animation_presets');
    }
};
