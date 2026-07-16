<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class AuthEmailNormalizationTest extends TestCase
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
        });

        Schema::create('user_items', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id');
            $table->foreignId('item_id');
            $table->unsignedInteger('quantity')->default(0);
            $table->timestamp('updated_at')->nullable();
        });
    }

    public function test_registration_trims_and_lowercases_email(): void
    {
        $response = $this->postJson('/api/auth/register', [
            'username' => 'normalized_user',
            'email' => '  Mixed.Case@Example.COM  ',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ]);

        $response
            ->assertCreated()
            ->assertJsonPath('user.email', 'mixed.case@example.com');

        $this->assertDatabaseHas('users', ['email' => 'mixed.case@example.com']);
    }

    public function test_login_matches_a_legacy_mixed_case_email(): void
    {
        User::query()->create([
            'username' => 'legacy_user',
            'email' => 'Legacy.User@Example.COM',
            'password' => Hash::make('password123'),
        ]);

        $this->postJson('/api/auth/login', [
            'email' => '  legacy.user@example.com ',
            'password' => 'password123',
        ])
            ->assertOk()
            ->assertJsonPath('user.email', 'Legacy.User@Example.COM');
    }

    public function test_registration_rejects_an_email_that_differs_only_by_case(): void
    {
        User::query()->create([
            'username' => 'existing_user',
            'email' => 'Existing.User@Example.COM',
            'password' => Hash::make('password123'),
        ]);

        $this->postJson('/api/auth/register', [
            'username' => 'duplicate_user',
            'email' => 'existing.user@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('email');
    }
}
