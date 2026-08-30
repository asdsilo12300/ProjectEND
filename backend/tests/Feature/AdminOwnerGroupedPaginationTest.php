<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\AdminResourceController;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class AdminOwnerGroupedPaginationTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::dropIfExists('comment_likes');
        Schema::dropIfExists('post_likes');
        Schema::dropIfExists('simulator_comments');
        Schema::dropIfExists('comments');
        Schema::dropIfExists('posts');
        Schema::dropIfExists('plant_histories');
        Schema::dropIfExists('simulators');
        Schema::dropIfExists('plants');
        Schema::dropIfExists('users');

        Schema::create('users', function (Blueprint $table): void {
            $table->id();
            $table->string('username');
            $table->string('email');
            $table->string('avatar_url')->nullable();
            $table->timestamps();
        });
        Schema::create('plants', function (Blueprint $table): void {
            $table->id();
            $table->string('name_th');
            $table->string('name_en')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
        Schema::create('simulators', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->unsignedBigInteger('plant_id')->nullable();
            $table->string('mode')->default('greenhouse');
            $table->integer('health')->default(100);
            $table->integer('growth_point')->default(0);
            $table->string('status')->default('active');
            $table->string('share_visibility')->default('private');
            $table->timestamp('started_at')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
        Schema::create('posts', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->unsignedBigInteger('plant_history_id')->nullable();
            $table->unsignedBigInteger('simulator_id')->nullable();
            $table->text('caption')->nullable();
            $table->string('visibility')->default('private');
            $table->timestamps();
            $table->softDeletes();
        });
        Schema::create('comments', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('post_id')->nullable();
            $table->unsignedBigInteger('user_id');
            $table->unsignedBigInteger('parent_id')->nullable();
            $table->text('comment_text');
            $table->string('status')->default('visible');
            $table->timestamps();
            $table->softDeletes();
        });
        Schema::create('simulator_comments', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('simulator_id')->nullable();
            $table->unsignedBigInteger('user_id');
            $table->text('comment_text');
            $table->string('status')->default('visible');
            $table->timestamps();
            $table->softDeletes();
        });
        Schema::create('post_likes', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('post_id');
            $table->unsignedBigInteger('user_id');
            $table->timestamp('created_at')->nullable();
        });
        Schema::create('comment_likes', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('comment_id');
            $table->unsignedBigInteger('user_id');
        });
        Schema::create('plant_histories', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->unsignedBigInteger('plant_id')->nullable();
            $table->integer('final_health')->default(100);
            $table->integer('total_score')->default(0);
            $table->integer('duration_seconds')->default(0);
            $table->string('visibility')->default('private');
            $table->timestamp('created_at')->nullable();
            $table->softDeletes();
        });

        DB::table('users')->insert([
            ['id' => 1, 'username' => 'owner-one', 'email' => 'one@example.test'],
            ['id' => 2, 'username' => 'owner-two', 'email' => 'two@example.test'],
            ['id' => 3, 'username' => 'owner-three', 'email' => 'three@example.test'],
        ]);
    }

    public function test_simulation_pages_are_split_by_owner_instead_of_individual_records(): void
    {
        $rows = [];
        for ($index = 1; $index <= 25; $index++) {
            $rows[] = $this->simulationRow($index, 1, '2026-08-01 08:00:00');
        }
        $rows[] = $this->simulationRow(26, 2, '2026-08-02 08:00:00');
        $rows[] = $this->simulationRow(27, 3, '2026-08-03 08:00:00');
        DB::table('simulators')->insert($rows);

        $controller = app(AdminResourceController::class);
        $firstPage = $controller->index(
            Request::create('/api/admin/resources/simulators?group_by=user&per_page=2&page=1', 'GET', ['group_by' => 'user', 'per_page' => 2, 'page' => 1]),
            'simulators',
        )->getData(true);

        $this->assertSame(3, $firstPage['total']);
        $this->assertSame(2, $firstPage['last_page']);
        $this->assertSame(2, $firstPage['group_count']);
        $this->assertSame([1, 2], array_values(array_unique(array_column($firstPage['data'], 'user_id'))));
        $this->assertCount(26, $firstPage['data']);

        $secondPage = $controller->index(
            Request::create('/api/admin/resources/simulators?group_by=user&per_page=2&page=2', 'GET', ['group_by' => 'user', 'per_page' => 2, 'page' => 2]),
            'simulators',
        )->getData(true);

        $this->assertSame([3], array_values(array_unique(array_column($secondPage['data'], 'user_id'))));
        $this->assertCount(1, $secondPage['data']);
    }

    public function test_plant_history_pages_use_the_same_owner_grouping(): void
    {
        $rows = [];
        for ($index = 1; $index <= 25; $index++) {
            $rows[] = [
                'id' => $index,
                'user_id' => 1,
                'final_health' => 100,
                'total_score' => 100,
                'duration_seconds' => 60,
                'visibility' => 'private',
                'created_at' => '2026-08-01 08:00:00',
            ];
        }
        $rows[] = [
            'id' => 26,
            'user_id' => 2,
            'final_health' => 90,
            'total_score' => 90,
            'duration_seconds' => 60,
            'visibility' => 'public',
            'created_at' => '2026-08-02 08:00:00',
        ];
        DB::table('plant_histories')->insert($rows);

        $payload = app(AdminResourceController::class)->index(
            Request::create('/api/admin/resources/plant-histories?group_by=user&per_page=10&page=1', 'GET', ['group_by' => 'user', 'per_page' => 10, 'page' => 1]),
            'plant-histories',
        )->getData(true);

        $this->assertSame(2, $payload['total']);
        $this->assertSame(2, $payload['group_count']);
        $this->assertSame([1, 2], array_values(array_unique(array_column($payload['data'], 'user_id'))));
        $this->assertCount(26, $payload['data']);
    }

    public function test_community_tables_are_also_paginated_by_author(): void
    {
        $posts = [];
        $comments = [];
        $simulatorComments = [];
        for ($index = 1; $index <= 26; $index++) {
            $userId = $index <= 25 ? 1 : 2;
            $createdAt = $userId === 1 ? '2026-08-01 08:00:00' : '2026-08-02 08:00:00';
            $posts[] = ['id' => $index, 'user_id' => $userId, 'caption' => "Post {$index}", 'visibility' => 'public', 'created_at' => $createdAt, 'updated_at' => $createdAt];
            $comments[] = ['id' => $index, 'user_id' => $userId, 'comment_text' => "Comment {$index}", 'status' => 'visible', 'created_at' => $createdAt, 'updated_at' => $createdAt];
            $simulatorComments[] = ['id' => $index, 'user_id' => $userId, 'comment_text' => "Simulation comment {$index}", 'status' => 'visible', 'created_at' => $createdAt, 'updated_at' => $createdAt];
        }
        DB::table('posts')->insert($posts);
        DB::table('comments')->insert($comments);
        DB::table('simulator_comments')->insert($simulatorComments);

        $controller = app(AdminResourceController::class);
        foreach (['posts', 'comments', 'simulator-comments'] as $resource) {
            $payload = $controller->index(
                Request::create("/api/admin/resources/{$resource}?group_by=user&per_page=10&page=1", 'GET', ['group_by' => 'user', 'per_page' => 10, 'page' => 1]),
                $resource,
            )->getData(true);

            $this->assertSame(2, $payload['total'], "{$resource} should count authors, not records.");
            $this->assertSame([1, 2], array_values(array_unique(array_column($payload['data'], 'user_id'))));
            $this->assertCount(26, $payload['data']);
        }
    }

    /** @return array<string, mixed> */
    private function simulationRow(int $id, int $userId, string $createdAt): array
    {
        return [
            'id' => $id,
            'user_id' => $userId,
            'mode' => 'greenhouse',
            'health' => 100,
            'growth_point' => 0,
            'status' => 'cancelled',
            'share_visibility' => 'private',
            'started_at' => $createdAt,
            'created_at' => $createdAt,
            'updated_at' => $createdAt,
        ];
    }
}
