<?php

namespace Tests\Feature;

use App\Models\Comment;
use App\Models\Post;
use App\Models\SocialNotification;
use App\Models\User;
use App\Services\JwtService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class SocialNotificationTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        foreach (['social_notifications', 'comment_likes', 'post_likes', 'comments', 'posts', 'users'] as $table) {
            Schema::dropIfExists($table);
        }

        Schema::create('users', function (Blueprint $table): void {
            $table->id();
            $table->string('username')->unique();
            $table->string('email')->unique();
            $table->string('password');
            $table->string('avatar_url')->nullable();
            $table->string('role')->default('member');
            $table->string('status')->default('active');
            $table->unsignedInteger('level')->default(1);
            $table->unsignedInteger('experience')->default(0);
            $table->unsignedInteger('coin')->default(0);
            $table->unsignedInteger('gem')->default(0);
            $table->timestamps();
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

        Schema::create('comment_likes', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('comment_id');
            $table->foreignId('user_id');
            $table->unique(['comment_id', 'user_id']);
        });

        Schema::create('social_notifications', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('recipient_id');
            $table->foreignId('actor_id');
            $table->foreignId('post_id')->nullable();
            $table->foreignId('comment_id')->nullable();
            $table->string('type', 32);
            $table->string('excerpt', 240)->nullable();
            $table->timestamp('read_at')->nullable();
            $table->timestamps();
        });
    }

    public function test_social_actions_create_notifications_and_reading_one_updates_the_badge_count(): void
    {
        $owner = $this->createUser('owner');
        $commenter = $this->createUser('commenter');
        $responder = $this->createUser('responder');
        $post = Post::query()->create([
            'user_id' => $owner->id,
            'caption' => 'My plant update',
            'visibility' => 'public',
        ]);

        $this->withToken($this->token($commenter))
            ->postJson("/api/posts/{$post->id}/likes")
            ->assertCreated();

        $commentResponse = $this->withToken($this->token($commenter))
            ->postJson("/api/posts/{$post->id}/comments", ['comment_text' => 'Looks healthy'])
            ->assertCreated();
        $comment = Comment::query()->findOrFail($commentResponse->json('data.id'));

        $this->withToken($this->token($responder))
            ->postJson("/api/posts/{$post->id}/comments/{$comment->id}/likes")
            ->assertCreated();

        $this->withToken($this->token($responder))
            ->postJson("/api/posts/{$post->id}/comments/{$comment->id}/replies", ['comment_text' => 'I agree'])
            ->assertCreated();

        $ownerNotifications = $this->withToken($this->token($owner))
            ->getJson('/api/notifications')
            ->assertOk()
            ->assertJsonPath('unread_count', 2)
            ->assertJsonPath('unread_counts.community', 2)
            ->assertJsonPath('unread_counts.game', 0);

        $this->assertEqualsCanonicalizing(['comment', 'like'], collect($ownerNotifications->json('data'))->pluck('type')->all());
        $this->assertSame(['community'], collect($ownerNotifications->json('data'))->pluck('category')->unique()->values()->all());

        $notificationId = $ownerNotifications->json('data.0.id');
        $this->withToken($this->token($owner))
            ->postJson("/api/notifications/{$notificationId}/read")
            ->assertOk()
            ->assertJsonPath('data.is_read', true);

        $this->withToken($this->token($owner))
            ->getJson('/api/notifications')
            ->assertOk()
            ->assertJsonPath('unread_count', 1);

        $commenterNotifications = $this->withToken($this->token($commenter))
            ->getJson('/api/notifications')
            ->assertOk()
            ->assertJsonPath('unread_count', 2)
            ->assertJsonPath('unread_counts.community', 2)
            ->assertJsonPath('unread_counts.game', 0);

        $this->assertEqualsCanonicalizing(['comment_like', 'reply'], collect($commenterNotifications->json('data'))->pluck('type')->all());

        SocialNotification::query()->create([
            'recipient_id' => $owner->id,
            'actor_id' => $commenter->id,
            'type' => 'garden_prank',
            'excerpt' => 'Aphids appeared on your active plant.',
        ]);

        $mixedNotifications = $this->withToken($this->token($owner))
            ->getJson('/api/notifications')
            ->assertOk()
            ->assertJsonPath('unread_count', 2)
            ->assertJsonPath('unread_counts.community', 1)
            ->assertJsonPath('unread_counts.game', 1);

        $this->assertSame('game', collect($mixedNotifications->json('data'))->firstWhere('type', 'garden_prank')['category']);
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

    private function token(User $user): string
    {
        return app(JwtService::class)->issue($user);
    }
}
