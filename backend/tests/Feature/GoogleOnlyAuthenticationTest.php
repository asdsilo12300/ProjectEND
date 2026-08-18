<?php

namespace Tests\Feature;

use App\Models\Item;
use App\Models\User;
use App\Models\UserItem;
use App\Services\JwtService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class GoogleOnlyAuthenticationTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        foreach (['user_items', 'items', 'plant_histories', 'friendships', 'users'] as $table) {
            Schema::dropIfExists($table);
        }

        Schema::create('users', function (Blueprint $table): void {
            $table->id();
            $table->string('username')->unique();
            $table->string('email')->unique();
            $table->string('google_id')->nullable()->unique();
            $table->timestamp('email_verified_at')->nullable();
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
            $table->json('onboarding_progress')->nullable();
            $table->timestamp('last_login_at')->nullable();
            $table->timestamps();
        });

        Schema::create('friendships', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('requester_id');
            $table->foreignId('addressee_id');
            $table->string('status')->default('pending');
            $table->timestamps();
        });

        Schema::create('plant_histories', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id');
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('items', function (Blueprint $table): void {
            $table->id();
            $table->string('name')->unique();
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();
        });

        Schema::create('user_items', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id');
            $table->foreignId('item_id');
            $table->unsignedInteger('quantity')->default(0);
            $table->timestamp('updated_at')->nullable();
        });
    }

    public function test_password_and_email_verification_endpoints_are_not_available(): void
    {
        $this->postJson('/api/auth/register')->assertNotFound();
        $this->postJson('/api/auth/login')->assertNotFound();
        $this->postJson('/api/auth/email/verify-code')->assertNotFound();
        $this->postJson('/api/auth/email/resend')->assertNotFound();
        $this->postJson('/api/auth/password-reset/request')->assertNotFound();
    }

    public function test_google_redirect_is_the_only_public_authentication_entry_point(): void
    {
        config()->set('services.google.client_id', 'google-client-id');
        config()->set('services.google.client_secret', 'google-client-secret');
        config()->set('services.google.redirect', 'http://localhost:8000/api/auth/google/callback');

        $this->get('/api/auth/google/redirect')
            ->assertRedirect()
            ->assertRedirectContains('accounts.google.com/o/oauth2/v2/auth');
    }

    public function test_loading_me_does_not_restore_consumed_starter_items(): void
    {
        $user = User::query()->create([
            'username' => 'google_user',
            'email' => 'google@example.com',
            'google_id' => 'google-subject-id',
            'email_verified_at' => now(),
            'password' => Hash::make('unused-random-secret'),
        ]);
        $item = Item::query()->create([
            'name' => 'Insect Spray',
            'is_active' => true,
        ]);
        UserItem::query()->create([
            'user_id' => $user->id,
            'item_id' => $item->id,
            'quantity' => 1,
        ]);

        $this->withToken(app(JwtService::class)->issue($user))
            ->getJson('/api/me')
            ->assertOk()
            ->assertJsonPath('data.id', $user->id);

        $this->assertDatabaseHas('user_items', [
            'user_id' => $user->id,
            'item_id' => $item->id,
            'quantity' => 1,
        ]);
    }
}
