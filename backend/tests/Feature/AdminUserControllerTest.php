<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\AdminUserController;
use App\Services\AdminDataCache;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class AdminUserControllerTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::dropIfExists('plant_histories');
        Schema::dropIfExists('simulators');
        Schema::dropIfExists('users');

        Schema::create('users', function (Blueprint $table): void {
            $table->id();
            $table->string('username');
            $table->string('email');
            $table->string('avatar_url')->nullable();
            $table->string('role')->default('member');
            $table->string('status')->default('active');
            $table->unsignedInteger('level')->default(1);
            $table->unsignedInteger('coin')->default(0);
            $table->timestamp('last_login_at')->nullable();
            $table->timestamps();
        });

        Schema::create('simulators', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('plant_histories', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->timestamp('created_at')->nullable();
            $table->softDeletes();
        });

        DB::table('users')->insert([
            ['id' => 1, 'username' => 'admin', 'email' => 'admin@example.test', 'role' => 'admin', 'status' => 'active', 'level' => 5, 'coin' => 20, 'created_at' => now()->subDay(), 'updated_at' => now()],
            ['id' => 2, 'username' => 'learner', 'email' => 'learner@example.test', 'role' => 'member', 'status' => 'active', 'level' => 2, 'coin' => 10, 'created_at' => now(), 'updated_at' => now()],
        ]);
        DB::table('simulators')->insert([
            ['user_id' => 2, 'created_at' => now(), 'updated_at' => now()],
            ['user_id' => 2, 'created_at' => now(), 'updated_at' => now()],
        ]);
        DB::table('plant_histories')->insert(['user_id' => 2, 'created_at' => now()]);

        app(AdminDataCache::class)->clear();
    }

    public function test_user_list_uses_one_query_and_reuses_the_short_cache(): void
    {
        DB::flushQueryLog();
        DB::enableQueryLog();

        $controller = app(AdminUserController::class);
        $request = Request::create('/api/admin/users?page=1', 'GET', ['page' => 1]);
        $first = $controller->index($request)->getData(true);
        $coldQueryCount = count(DB::getQueryLog());
        $second = $controller->index($request)->getData(true);

        $this->assertSame(1, $coldQueryCount);
        $this->assertCount($coldQueryCount, DB::getQueryLog());
        $this->assertSame($first, $second);
        $this->assertSame(2, $first['total']);
        $this->assertSame(2, $first['data'][1]['simulators_count']);
        $this->assertSame(1, $first['data'][1]['plant_histories_count']);
        $this->assertArrayNotHasKey('admin_total_count', $first['data'][0]);
    }
}
