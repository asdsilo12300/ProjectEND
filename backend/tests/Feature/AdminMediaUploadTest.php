<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\AdminMediaController;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;
use Tests\TestCase;

class AdminMediaUploadTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::dropIfExists('admin_activity_logs');
        Schema::dropIfExists('users');

        Schema::create('users', function (Blueprint $table): void {
            $table->id();
            $table->string('username');
            $table->string('email');
            $table->string('password')->nullable();
            $table->string('role')->default('admin');
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

        Storage::fake('public');
        config()->set('services.media.driver', 'laravel');
        config()->set('services.media.disk', 'public');
    }

    public function test_admin_can_upload_an_image_to_an_approved_scope(): void
    {
        $admin = User::query()->create([
            'username' => 'admin',
            'email' => 'admin@example.test',
            'role' => 'admin',
        ]);
        $request = $this->uploadRequest('plants', $admin);

        $response = app(AdminMediaController::class)->uploadImage($request);
        $payload = $response->getData(true);

        $this->assertSame(201, $response->status());
        $this->assertStringStartsWith('/storage/admin-images/plants/', $payload['data']['reference']);
        $this->assertCount(1, Storage::disk('public')->allFiles('admin-images/plants'));
        $this->assertDatabaseHas('admin_activity_logs', [
            'admin_id' => $admin->id,
            'action' => 'uploaded',
            'target_type' => 'plants-image',
        ]);
    }

    public function test_upload_rejects_an_unapproved_storage_scope(): void
    {
        $admin = User::query()->create([
            'username' => 'admin',
            'email' => 'admin@example.test',
            'role' => 'admin',
        ]);

        try {
            app(AdminMediaController::class)->uploadImage($this->uploadRequest('../../private', $admin));
            $this->fail('An arbitrary media directory must not be accepted.');
        } catch (ValidationException $exception) {
            $this->assertArrayHasKey('scope', $exception->errors());
        }

        $this->assertSame([], Storage::disk('public')->allFiles());
    }

    private function uploadRequest(string $scope, User $admin): Request
    {
        $png = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zl9sAAAAASUVORK5CYII=', true);
        $file = UploadedFile::fake()->createWithContent('plant.png', $png);
        $request = Request::create('/api/admin/media/images', 'POST', ['scope' => $scope], [], ['upload' => $file]);
        $request->setUserResolver(fn () => $admin);

        return $request;
    }
}
