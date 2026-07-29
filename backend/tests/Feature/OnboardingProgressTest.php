<?php

namespace Tests\Feature;

use App\Models\User;
use App\Services\JwtService;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

class OnboardingProgressTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_user_can_store_page_onboarding_progress(): void
    {
        $user = User::factory()->create();
        $token = app(JwtService::class)->issue($user);

        $this->withToken($token)
            ->patchJson('/api/me/onboarding', [
                'page' => 'lab',
                'version' => 1,
                'state' => 'completed',
            ])
            ->assertOk()
            ->assertJsonPath('data.onboarding_progress.lab.version', 1)
            ->assertJsonPath('data.onboarding_progress.lab.state', 'completed');

        $this->assertDatabaseHas('users', ['id' => $user->id]);
        $this->assertSame('completed', $user->fresh()->onboarding_progress['lab']['state']);

        $this->withToken($token)
            ->getJson('/api/me')
            ->assertOk()
            ->assertJsonPath('data.onboarding_progress.lab.state', 'completed');
    }

    public function test_onboarding_page_is_restricted_to_known_user_pages(): void
    {
        $user = User::factory()->create();

        $this->withToken(app(JwtService::class)->issue($user))
            ->patchJson('/api/me/onboarding', [
                'page' => 'admin',
                'version' => 1,
                'state' => 'completed',
            ])
            ->assertUnprocessable()
            ->assertJsonValidationErrors('page');
    }

    public function test_a_user_can_store_a_specialized_lab_guide(): void
    {
        $user = User::factory()->create();

        $this->withToken(app(JwtService::class)->issue($user))
            ->patchJson('/api/me/onboarding', [
                'page' => 'lab-friends',
                'version' => 2,
                'state' => 'completed',
            ])
            ->assertOk()
            ->assertJsonPath('data.onboarding_progress.lab-friends.version', 2)
            ->assertJsonPath('data.onboarding_progress.lab-friends.state', 'completed');
    }
}
