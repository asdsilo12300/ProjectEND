<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\AdminDashboardController;
use App\Services\AdminDataCache;
use Carbon\CarbonImmutable;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class AdminDashboardControllerTest extends TestCase
{
    private CarbonImmutable $now;

    protected function setUp(): void
    {
        parent::setUp();

        $this->now = CarbonImmutable::parse('2026-07-16 12:00:00');
        CarbonImmutable::setTestNow($this->now);
        $this->buildSchema();
        $this->seedDashboardData();
        app(AdminDataCache::class)->clear();
    }

    protected function tearDown(): void
    {
        CarbonImmutable::setTestNow();
        parent::tearDown();
    }

    public function test_dashboard_adds_actionable_attention_data_without_removing_existing_payload(): void
    {
        $response = app(AdminDashboardController::class)->index(
            Request::create('/api/admin/dashboard?days=7', 'GET'),
        );
        $data = $response->getData(true)['data'];

        $this->assertArrayHasKey('metrics', $data);
        $this->assertArrayHasKey('system_overview', $data);
        $this->assertArrayHasKey('trend', $data);
        $this->assertArrayHasKey('recent_users', $data);
        $this->assertArrayHasKey('recent_contents', $data);
        $this->assertSame(7, $data['trend_days']);
        $this->assertCount(7, $data['trend']);

        $attention = $data['attention'];
        $this->assertSame(7, $attention['stale_active_simulation_days']);
        $this->assertSame(11, $attention['total']);
        $this->assertSame(1, $attention['counts']['suspended_users']);
        $this->assertSame(1, $attention['counts']['draft_contents']);
        $this->assertSame(1, $attention['counts']['hidden_post_comments']);
        $this->assertSame(1, $attention['counts']['suspended_post_comments']);
        $this->assertSame(1, $attention['counts']['hidden_simulator_comments']);
        $this->assertSame(1, $attention['counts']['suspended_simulator_comments']);
        $this->assertSame(4, $attention['counts']['moderated_comments']);
        $this->assertSame(1, $attention['counts']['failed_simulations']);
        $this->assertSame(1, $attention['counts']['cancelled_simulations']);
        $this->assertSame(2, $attention['counts']['stale_active_simulations']);
        $this->assertSame(1, $attention['counts']['missing_model_assets']);
        $this->assertSame(4, $data['metrics']['hidden_comments']);
        $this->assertSame('/avatars/suspended.webp', $data['recent_users'][0]['avatar_url']);

        $this->assertSame([
            'moderated_comments',
            'draft_contents',
            'suspended_users',
            'failed_simulations',
            'cancelled_simulations',
            'stale_active_simulations',
            'missing_model_assets',
        ], array_column($attention['items'], 'key'));
        $attentionByKey = array_column($attention['items'], null, 'key');
        $this->assertSame('models', $attentionByKey['missing_model_assets']['section']);
    }

    public function test_dashboard_returns_only_the_five_most_recent_admin_actions_with_admin_context(): void
    {
        $response = app(AdminDashboardController::class)->index(
            Request::create('/api/admin/dashboard', 'GET'),
        );
        $actions = $response->getData(true)['data']['attention']['recent_admin_actions'];

        $this->assertCount(5, $actions);
        $this->assertSame(
            ['action-6', 'action-5', 'action-4', 'action-3', 'action-2'],
            array_column($actions, 'action'),
        );
        $this->assertSame('admin-user', $actions[0]['admin']['username']);
        $this->assertSame('admin@example.test', $actions[0]['admin']['email']);
    }

    public function test_dashboard_uses_a_compact_query_set_and_returns_identical_cached_data(): void
    {
        DB::flushQueryLog();
        DB::enableQueryLog();

        $controller = app(AdminDashboardController::class);
        $request = Request::create('/api/admin/dashboard?days=7', 'GET');
        $first = $controller->index($request)->getData(true);
        $coldQueryCount = count(DB::getQueryLog());
        $second = $controller->index($request)->getData(true);

        $this->assertLessThanOrEqual(5, $coldQueryCount);
        $this->assertCount($coldQueryCount, DB::getQueryLog());
        $this->assertSame($first, $second);
        $this->assertCount(2, $second['data']['recent_users']);
        $this->assertCount(2, $second['data']['recent_contents']);
    }

    private function seedDashboardData(): void
    {
        DB::table('users')->insert([
            [
                'id' => 1,
                'username' => 'admin-user',
                'email' => 'admin@example.test',
                'role' => 'admin',
                'status' => 'active',
                'level' => 10,
                'avatar_url' => null,
                'created_at' => $this->now->subDays(20),
                'updated_at' => $this->now,
            ],
            [
                'id' => 2,
                'username' => 'suspended-user',
                'email' => 'suspended@example.test',
                'role' => 'member',
                'status' => 'suspended',
                'level' => 1,
                'avatar_url' => '/avatars/suspended.webp',
                'created_at' => $this->now->subDay(),
                'updated_at' => $this->now,
            ],
        ]);

        DB::table('contents')->insert([
            [
                'id' => 1,
                'slug' => 'draft-content',
                'title' => 'Draft content',
                'title_th' => null,
                'status' => 'draft',
                'version' => 1,
                'created_at' => $this->now->subDays(2),
                'updated_at' => $this->now->subDay(),
            ],
            [
                'id' => 2,
                'slug' => 'published-content',
                'title' => 'Published content',
                'title_th' => null,
                'status' => 'published',
                'version' => 1,
                'created_at' => $this->now->subDays(2),
                'updated_at' => $this->now,
            ],
        ]);

        DB::table('comments')->insert([
            ['status' => 'visible', 'created_at' => $this->now, 'updated_at' => $this->now],
            ['status' => 'hidden', 'created_at' => $this->now, 'updated_at' => $this->now],
            ['status' => 'suspended', 'created_at' => $this->now, 'updated_at' => $this->now],
        ]);
        DB::table('simulator_comments')->insert([
            ['status' => 'hidden', 'created_at' => $this->now, 'updated_at' => $this->now],
            ['status' => 'suspended', 'created_at' => $this->now, 'updated_at' => $this->now],
        ]);

        DB::table('simulators')->insert([
            ['status' => 'failed', 'started_at' => $this->now->subDay(), 'created_at' => $this->now->subDay(), 'updated_at' => $this->now],
            ['status' => 'cancelled', 'started_at' => $this->now->subDay(), 'created_at' => $this->now->subDay(), 'updated_at' => $this->now],
            ['status' => 'active', 'started_at' => $this->now->subDays(8), 'created_at' => $this->now->subDays(8), 'updated_at' => $this->now],
            ['status' => 'active', 'started_at' => null, 'created_at' => $this->now->subDays(8), 'updated_at' => $this->now],
            ['status' => 'active', 'started_at' => $this->now->subDays(6), 'created_at' => $this->now->subDays(20), 'updated_at' => $this->now],
        ]);

        DB::table('model_assets')->insert([
            ['asset_key' => 'valid-model', 'url' => '/models/valid.glb', 'created_at' => $this->now, 'updated_at' => $this->now],
            ['asset_key' => 'missing-model', 'url' => '', 'created_at' => $this->now, 'updated_at' => $this->now],
        ]);

        foreach (range(1, 6) as $index) {
            DB::table('admin_activity_logs')->insert([
                'admin_id' => 1,
                'action' => "action-{$index}",
                'target_type' => 'contents',
                'target_id' => $index,
                'detail' => null,
                'created_at' => $this->now->subMinutes(6 - $index),
            ]);
        }
    }

    private function buildSchema(): void
    {
        foreach ([
            'admin_activity_logs',
            'model_assets',
            'achievements',
            'quests',
            'shop_items',
            'items',
            'pest_condition_rules',
            'pests',
            'plant_visual_variants',
            'plant_condition_rules',
            'plant_growth_stages',
            'plants',
            'contents',
            'simulator_comments',
            'comments',
            'posts',
            'plant_histories',
            'simulators',
            'users',
        ] as $table) {
            Schema::dropIfExists($table);
        }

        Schema::create('users', function (Blueprint $table): void {
            $table->id();
            $table->string('username');
            $table->string('email');
            $table->string('role')->default('member');
            $table->string('status')->default('active');
            $table->unsignedInteger('level')->default(1);
            $table->string('avatar_url')->nullable();
            $table->timestamps();
        });

        Schema::create('simulators', function (Blueprint $table): void {
            $table->id();
            $table->string('status')->default('active');
            $table->timestamp('started_at')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('plant_histories', function (Blueprint $table): void {
            $table->id();
            $table->timestamp('created_at')->nullable();
            $table->softDeletes();
        });

        Schema::create('posts', function (Blueprint $table): void {
            $table->id();
            $table->timestamps();
            $table->softDeletes();
        });

        foreach (['comments', 'simulator_comments'] as $tableName) {
            Schema::create($tableName, function (Blueprint $table): void {
                $table->id();
                $table->string('status')->default('visible');
                $table->timestamps();
                $table->softDeletes();
            });
        }

        Schema::create('contents', function (Blueprint $table): void {
            $table->id();
            $table->string('slug');
            $table->string('title');
            $table->string('title_th')->nullable();
            $table->string('status')->default('draft');
            $table->unsignedInteger('version')->default(1);
            $table->timestamps();
            $table->softDeletes();
        });

        foreach (['plants', 'pests'] as $tableName) {
            Schema::create($tableName, function (Blueprint $table): void {
                $table->id();
                $table->softDeletes();
            });
        }

        foreach ([
            'plant_growth_stages',
            'plant_condition_rules',
            'plant_visual_variants',
            'pest_condition_rules',
            'items',
            'shop_items',
            'quests',
            'achievements',
        ] as $tableName) {
            Schema::create($tableName, function (Blueprint $table): void {
                $table->id();
                $table->softDeletes();
            });
        }

        Schema::create('model_assets', function (Blueprint $table): void {
            $table->id();
            $table->string('asset_key');
            $table->string('url')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('admin_activity_logs', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('admin_id');
            $table->string('action');
            $table->string('target_type')->nullable();
            $table->unsignedBigInteger('target_id')->nullable();
            $table->text('detail')->nullable();
            $table->timestamp('created_at')->nullable();
        });
    }
}
