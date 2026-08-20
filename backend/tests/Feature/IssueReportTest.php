<?php

namespace Tests\Feature;

use App\Models\IssueReport;
use App\Models\User;
use App\Services\JwtService;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class IssueReportTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Schema::dropIfExists('issue_report_updates');
        Schema::dropIfExists('issue_report_attachments');
        Schema::dropIfExists('issue_reports');
        Schema::dropIfExists('admin_activity_logs');
        Schema::dropIfExists('users');
        Schema::create('users', function (Blueprint $table): void {
            $table->id();
            $table->string('name')->nullable();
            $table->string('username');
            $table->string('email')->unique();
            $table->timestamp('email_verified_at')->nullable();
            $table->string('password')->nullable();
            $table->rememberToken();
            $table->string('role')->default('user');
            $table->string('status')->default('active');
            $table->timestamps();
        });
        Schema::create('admin_activity_logs', function (Blueprint $table): void {
            $table->id();
            $table->foreignId('admin_id');
            $table->string('action');
            $table->string('target_type')->nullable();
            $table->unsignedBigInteger('target_id')->nullable();
            $table->text('detail')->nullable();
            $table->timestamp('created_at')->nullable();
        });
        $migration = require database_path('migrations/2026_08_20_100000_create_issue_reports_tables.php');
        $migration->up();
        Storage::fake('local');
        config()->set('services.private_media.driver', 'laravel');
        config()->set('services.private_media.disk', 'local');
    }

    public function test_user_can_submit_and_only_read_their_own_immutable_report(): void
    {
        $owner = User::factory()->create(['username' => 'reporter']);
        $other = User::factory()->create(['username' => 'other-user']);

        $created = $this->withToken($this->token($owner))->post('/api/issue-reports', [
            'category' => 'simulation',
            'subject' => '<b>Plant model is missing</b>',
            'description' => '<script>alert(1)</script>The plant is not visible.',
            'attachments' => [UploadedFile::fake()->createWithContent(
                'evidence.png',
                base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl9sAAAAASUVORK5CYII=', true),
            )],
        ]);

        $created->assertCreated()
            ->assertJsonPath('data.subject', 'Plant model is missing')
            ->assertJsonPath('data.attachments_count', 1);

        $report = IssueReport::query()->firstOrFail();
        $this->assertStringStartsWith('RPT-', $report->reference_code);
        $this->assertStringNotContainsString('<script>', $report->description);
        $this->withToken($this->token($owner))->getJson("/api/issue-reports/{$report->id}")->assertOk();
        $this->withToken($this->token($other))->getJson("/api/issue-reports/{$report->id}")->assertNotFound();
        $this->withToken($this->token($owner))->patchJson("/api/issue-reports/{$report->id}", [])->assertMethodNotAllowed();
        $this->withToken($this->token($owner))->deleteJson("/api/issue-reports/{$report->id}")->assertMethodNotAllowed();
    }

    public function test_admin_opening_and_updating_report_changes_shared_badge_and_history(): void
    {
        $owner = User::factory()->create(['username' => 'reporter']);
        $admin = User::factory()->create(['username' => 'administrator', 'role' => 'admin']);
        $report = IssueReport::query()->create([
            'reference_code' => 'RPT-20260820-TEST01',
            'reporter_id' => $owner->id,
            'reporter_username' => $owner->username,
            'reporter_email' => $owner->email,
            'category' => 'interface',
            'subject' => 'Low contrast text',
            'description' => 'Text cannot be read in light theme.',
            'status' => IssueReport::STATUS_NEW,
        ]);

        $this->withToken($this->token($admin))->getJson('/api/admin/issue-reports/summary')
            ->assertOk()->assertJsonPath('data.unseen', 1);

        $this->withToken($this->token($admin))->postJson("/api/admin/issue-reports/{$report->id}/seen")
            ->assertOk();
        $this->withToken($this->token($admin))->getJson('/api/admin/issue-reports/summary')
            ->assertJsonPath('data.unseen', 0);

        $this->withToken($this->token($admin))->patchJson("/api/admin/issue-reports/{$report->id}/status", [
            'status' => 'in_progress',
            'public_message' => 'We are correcting the theme contrast.',
        ])->assertOk()->assertJsonPath('data.status', 'in_progress');

        $this->assertDatabaseHas('issue_report_updates', [
            'issue_report_id' => $report->id,
            'admin_id' => $admin->id,
            'from_status' => 'new',
            'to_status' => 'in_progress',
        ]);
        $this->withToken($this->token($owner))->getJson("/api/issue-reports/{$report->id}")
            ->assertJsonPath('data.updates.0.public_message', 'We are correcting the theme contrast.');
    }

    private function token(User $user): string
    {
        return app(JwtService::class)->issue($user);
    }
}
