<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('contents')) {
            Schema::table('contents', function (Blueprint $table): void {
                if (! Schema::hasColumn('contents', 'category')) {
                    $table->string('category', 80)->nullable()->index();
                }
                if (! Schema::hasColumn('contents', 'icon')) {
                    $table->string('icon', 50)->default('eco');
                }
                if (! Schema::hasColumn('contents', 'eyebrow')) {
                    $table->string('eyebrow')->nullable();
                }
                if (! Schema::hasColumn('contents', 'eyebrow_th')) {
                    $table->string('eyebrow_th')->nullable();
                }
                if (! Schema::hasColumn('contents', 'title_th')) {
                    $table->string('title_th')->nullable();
                }
                if (! Schema::hasColumn('contents', 'summary')) {
                    $table->text('summary')->nullable();
                }
                if (! Schema::hasColumn('contents', 'summary_th')) {
                    $table->text('summary_th')->nullable();
                }
                if (! Schema::hasColumn('contents', 'body_html')) {
                    $table->longText('body_html')->nullable();
                }
                if (! Schema::hasColumn('contents', 'body_html_th')) {
                    $table->longText('body_html_th')->nullable();
                }
                if (! Schema::hasColumn('contents', 'cover_image_url')) {
                    $table->text('cover_image_url')->nullable();
                }
                if (! Schema::hasColumn('contents', 'cover_image_alt')) {
                    $table->string('cover_image_alt')->nullable();
                }
                if (! Schema::hasColumn('contents', 'cover_image_alt_th')) {
                    $table->string('cover_image_alt_th')->nullable();
                }
                if (! Schema::hasColumn('contents', 'image_credit')) {
                    $table->string('image_credit')->nullable();
                }
                if (! Schema::hasColumn('contents', 'image_credit_url')) {
                    $table->text('image_credit_url')->nullable();
                }
                if (! Schema::hasColumn('contents', 'references')) {
                    $table->json('references')->nullable();
                }
                if (! Schema::hasColumn('contents', 'reading_minutes')) {
                    $table->unsignedTinyInteger('reading_minutes')->default(5);
                }
                if (! Schema::hasColumn('contents', 'sort_order')) {
                    $table->unsignedSmallInteger('sort_order')->default(0)->index();
                }
                if (! Schema::hasColumn('contents', 'version')) {
                    $table->unsignedInteger('version')->default(1);
                }
                if (! Schema::hasColumn('contents', 'published_at')) {
                    $table->timestamp('published_at')->nullable()->index();
                }
            });

            if (Schema::hasColumn('contents', 'body')) {
                DB::table('contents')->whereNull('body_html')->update(['body_html' => DB::raw('body')]);
                DB::table('contents')->whereNull('body_html_th')->update(['body_html_th' => DB::raw('body')]);
                DB::table('contents')->whereNull('title_th')->update(['title_th' => DB::raw('title')]);
                DB::table('contents')->whereNull('summary')->update(['summary' => DB::raw('title')]);
                DB::table('contents')->whereNull('summary_th')->update(['summary_th' => DB::raw('title')]);
            }

            return;
        }

        Schema::create('contents', function (Blueprint $table): void {
            $table->id();
            $table->string('slug')->unique();
            $table->string('category', 80)->index();
            $table->string('icon', 50)->default('eco');
            $table->string('eyebrow')->nullable();
            $table->string('eyebrow_th')->nullable();
            $table->string('title');
            $table->string('title_th');
            $table->text('summary');
            $table->text('summary_th');
            $table->longText('body_html');
            $table->longText('body_html_th');
            $table->text('cover_image_url')->nullable();
            $table->string('cover_image_alt')->nullable();
            $table->string('cover_image_alt_th')->nullable();
            $table->string('image_credit')->nullable();
            $table->text('image_credit_url')->nullable();
            $table->json('references')->nullable();
            $table->unsignedTinyInteger('reading_minutes')->default(5);
            $table->unsignedSmallInteger('sort_order')->default(0)->index();
            $table->unsignedInteger('version')->default(1);
            $table->string('source_code')->nullable();
            $table->string('status', 30)->default('draft')->index();
            $table->timestamp('published_at')->nullable()->index();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        if (Schema::hasTable('contents') && Schema::hasColumn('contents', 'body')) {
            Schema::table('contents', function (Blueprint $table): void {
                $columns = [
                    'category', 'icon', 'eyebrow', 'eyebrow_th', 'title_th', 'summary', 'summary_th',
                    'body_html', 'body_html_th', 'cover_image_url', 'cover_image_alt', 'cover_image_alt_th',
                    'image_credit', 'image_credit_url', 'references', 'reading_minutes', 'sort_order', 'version',
                    'published_at',
                ];

                $table->dropColumn(array_values(array_filter(
                    $columns,
                    static fn (string $column): bool => Schema::hasColumn('contents', $column),
                )));
            });

            return;
        }

        Schema::dropIfExists('contents');
    }
};
