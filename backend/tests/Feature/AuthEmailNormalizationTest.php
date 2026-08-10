<?php

namespace Tests\Feature;

use App\Mail\EmailVerificationMail;
use App\Models\Item;
use App\Models\User;
use App\Models\UserItem;
use App\Services\JwtService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class AuthEmailNormalizationTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        foreach (['email_verifications', 'user_items', 'items', 'plant_histories', 'friendships', 'users'] as $table) {
            Schema::dropIfExists($table);
        }

        Mail::fake();

        Schema::create('users', function (Blueprint $table): void {
            $table->id();
            $table->string('username')->unique();
            $table->string('email')->unique();
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
            $table->timestamp('last_login_at')->nullable();
            $table->timestamps();
        });

        Schema::create('email_verifications', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('user_id');
            $table->string('otp_hash', 64);
            $table->string('token_hash', 64)->unique();
            $table->unsignedTinyInteger('attempts')->default(0);
            $table->timestamp('expires_at');
            $table->timestamp('resend_available_at');
            $table->timestamp('used_at')->nullable();
            $table->string('requested_ip', 45)->nullable();
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
            ->assertJsonPath('email', 'mixed.case@example.com')
            ->assertJsonPath('requires_email_verification', true)
            ->assertJsonMissingPath('token');

        $this->assertDatabaseHas('users', ['email' => 'mixed.case@example.com']);
        Mail::assertSent(EmailVerificationMail::class, fn (EmailVerificationMail $mail): bool => $mail->hasTo('mixed.case@example.com'));
    }

    public function test_login_matches_a_legacy_mixed_case_email(): void
    {
        User::query()->create([
            'username' => 'legacy_user',
            'email' => 'Legacy.User@Example.COM',
            'email_verified_at' => now(),
            'password' => Hash::make('password123'),
        ]);

        $this->postJson('/api/auth/login', [
            'email' => '  legacy.user@example.com ',
            'password' => 'password123',
        ])
            ->assertOk()
            ->assertJsonPath('user.email', 'Legacy.User@Example.COM');
    }

    public function test_unverified_account_is_blocked_until_the_emailed_code_is_confirmed(): void
    {
        $this->postJson('/api/auth/register', [
            'username' => 'awaiting_verification',
            'email' => 'verify@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
        ])->assertCreated();

        $this->postJson('/api/auth/login', [
            'email' => 'verify@example.com',
            'password' => 'password123',
        ])
            ->assertForbidden()
            ->assertJsonPath('code', 'EMAIL_NOT_VERIFIED');

        $otp = null;
        Mail::assertSent(EmailVerificationMail::class, function (EmailVerificationMail $mail) use (&$otp): bool {
            if ($mail->hasTo('verify@example.com')) {
                $otp = $mail->otp;

                return true;
            }

            return false;
        });

        $this->assertNotNull($otp);

        $this->postJson('/api/auth/email/verify-code', [
            'email' => 'verify@example.com',
            'otp' => $otp,
        ])
            ->assertOk()
            ->assertJsonStructure(['token', 'email_verified_at']);

        $this->assertNotNull(User::query()->where('email', 'verify@example.com')->value('email_verified_at'));

        $this->postJson('/api/auth/login', [
            'email' => 'verify@example.com',
            'password' => 'password123',
        ])->assertOk()->assertJsonStructure(['token', 'user']);
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

    public function test_loading_me_does_not_restore_consumed_starter_items(): void
    {
        $user = User::query()->create([
            'username' => 'inventory_user',
            'email' => 'inventory@example.com',
            'password' => Hash::make('password123'),
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
