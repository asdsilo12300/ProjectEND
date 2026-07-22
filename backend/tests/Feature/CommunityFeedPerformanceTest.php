<?php

namespace Tests\Feature;

use App\Models\Friendship;
use App\Models\Post;
use App\Models\PostLike;
use App\Models\User;
use App\Services\JwtService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class CommunityFeedPerformanceTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        foreach (['post_likes', 'comments', 'posts', 'plant_histories', 'friendships', 'users'] as $table) {
            Schema::dropIfExists($table);
        }

        Schema::create('users', function (Blueprint $table): void {
            $table->id();
            $table->string('username')->unique();
            $table->string('email')->unique();
            $table->string('password');
            $table->string('avatar_url')->nullable();
            $table->string('cover_url')->nullable();
            $table->text('bio')->nullable();
            $table->string('role')->default('member');
            $table->string('status')->default('active');
            $table->unsignedInteger('level')->default(1);
            $table->unsignedInteger('experience')->default(0);
            $table->unsignedInteger('coin')->default(0);
            $table->unsignedInteger('gem')->default(0);
            $table->timestamp('last_login_at')->nullable();
            $table->timestamps();
        });

        Schema::create('friendships', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('requester_id');
            $table->foreignId('addressee_id');
            $table->string('status')->default('pending');
            $table->timestamp('accepted_at')->nullable();
            $table->timestamps();
        });

        Schema::create('plant_histories', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id');
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('posts', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id');
            $table->foreignId('plant_history_id')->nullable();
            $table->foreignId('simulator_id')->nullable();
            $table->text('caption')->nullable();
            $table->string('visibility')->default('public');
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('comments', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('post_id');
            $table->foreignId('user_id');
            $table->foreignId('parent_id')->nullable();
            $table->text('comment_text');
            $table->string('status')->default('visible');
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('post_likes', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('post_id');
            $table->foreignId('user_id');
            $table->timestamp('created_at')->nullable();
            $table->unique(['post_id', 'user_id']);
        });
    }

    public function test_public_and_friend_feeds_are_paginated_without_per_post_queries(): void
    {
        $viewer = $this->createUser('viewer');
        $friend = $this->createUser('friend');

        Friendship::query()->create([
            'requester_id' => $viewer->id,
            'addressee_id' => $friend->id,
            'status' => 'accepted',
            'accepted_at' => now(),
        ]);

        $likedPost = Post::query()->create([
            'user_id' => $friend->id,
            'caption' => 'First plant update',
            'visibility' => 'public',
        ]);
        Post::query()->create([
            'user_id' => $friend->id,
            'caption' => 'Friends only update',
            'visibility' => 'friends',
        ]);
        Post::query()->create([
            'user_id' => $viewer->id,
            'caption' => 'My update',
            'visibility' => 'public',
        ]);
        PostLike::query()->create([
            'post_id' => $likedPost->id,
            'user_id' => $viewer->id,
        ]);

        DB::flushQueryLog();
        DB::enableQueryLog();

        $public = $this->withToken(app(JwtService::class)->issue($viewer))
            ->getJson('/api/posts?per_page=15')
            ->assertOk()
            ->assertJsonPath('meta.current_page', 1)
            ->assertJsonCount(2, 'data');

        $this->assertTrue((bool) collect($public->json('data'))->firstWhere('id', $likedPost->id)['liked_by_me']);
        $this->assertLessThanOrEqual(8, count(DB::getQueryLog()));

        $this->withToken(app(JwtService::class)->issue($viewer))
            ->getJson('/api/posts/friends?per_page=15')
            ->assertOk()
            ->assertJsonCount(3, 'data');
    }

    private function createUser(string $username): User
    {
        return User::query()->create([
            'username' => $username,
            'email' => $username.'@example.com',
            'password' => Hash::make('password123'),
            'status' => 'active',
        ]);
    }
}
