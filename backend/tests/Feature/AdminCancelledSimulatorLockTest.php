<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\AdminResourceController;
use App\Models\Simulator;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Symfony\Component\HttpKernel\Exception\HttpException;
use Tests\TestCase;

class AdminCancelledSimulatorLockTest extends TestCase
{
    private User $admin;

    protected function setUp(): void
    {
        parent::setUp();

        Schema::dropIfExists('admin_activity_logs');
        Schema::dropIfExists('simulators');
        Schema::dropIfExists('users');

        Schema::create('users', function (Blueprint $table): void {
            $table->id();
            $table->string('username');
            $table->string('email');
            $table->string('password')->nullable();
            $table->string('role')->default('admin');
            $table->timestamps();
        });
        Schema::create('simulators', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('user_id');
            $table->unsignedBigInteger('plant_id')->nullable();
            $table->string('mode')->default('greenhouse');
            $table->string('status')->default('active');
            $table->string('share_visibility')->default('private');
            $table->timestamps();
            $table->softDeletes();
        });
        Schema::create('admin_activity_logs', function (Blueprint $table): void {
            $table->id();
            $table->unsignedBigInteger('admin_id');
            $table->string('action');
            $table->string('target_type')->nullable();
            $table->unsignedBigInteger('target_id')->nullable();
            $table->text('detail')->nullable();
            $table->timestamp('created_at')->nullable();
        });

        DB::table('users')->insert([
            'id' => 1,
            'username' => 'admin',
            'email' => 'admin@example.test',
            'role' => 'admin',
        ]);
        $this->admin = User::query()->findOrFail(1);
    }

    public function test_cancelled_simulation_cannot_be_moderated_again(): void
    {
        $simulator = $this->cancelledSimulator();
        $request = Request::create("/api/admin/resources/simulators/{$simulator->id}", 'PUT', [
            'status' => 'completed',
            'share_visibility' => 'public',
        ]);
        $request->setUserResolver(fn () => $this->admin);

        try {
            app(AdminResourceController::class)->update($request, 'simulators', $simulator->id);
            $this->fail('A cancelled simulation should be locked.');
        } catch (HttpException $exception) {
            $this->assertSame(405, $exception->getStatusCode());
        }

        $this->assertDatabaseHas('simulators', [
            'id' => $simulator->id,
            'status' => 'cancelled',
            'share_visibility' => 'private',
        ]);
    }

    public function test_active_simulation_is_also_read_only_for_administrators(): void
    {
        $simulator = Simulator::query()->create([
            'user_id' => $this->admin->id,
            'mode' => 'greenhouse',
            'status' => 'active',
            'share_visibility' => 'private',
        ]);
        $request = Request::create("/api/admin/resources/simulators/{$simulator->id}", 'PUT', [
            'status' => 'completed',
            'share_visibility' => 'public',
        ]);
        $request->setUserResolver(fn () => $this->admin);

        try {
            app(AdminResourceController::class)->update($request, 'simulators', $simulator->id);
            $this->fail('Simulation records should be view-only for administrators.');
        } catch (HttpException $exception) {
            $this->assertSame(405, $exception->getStatusCode());
        }

        $this->assertDatabaseHas('simulators', [
            'id' => $simulator->id,
            'status' => 'active',
            'share_visibility' => 'private',
        ]);
    }

    public function test_cancelled_simulation_cannot_be_deleted(): void
    {
        $simulator = $this->cancelledSimulator();
        $controller = app(AdminResourceController::class);
        $deleteRequest = Request::create("/api/admin/resources/simulators/{$simulator->id}", 'DELETE');
        $deleteRequest->setUserResolver(fn () => $this->admin);

        try {
            $controller->destroy($deleteRequest, 'simulators', $simulator->id);
            $this->fail('Simulation records should be permanent.');
        } catch (HttpException $exception) {
            $this->assertSame(405, $exception->getStatusCode());
        }

        $this->assertNull(Simulator::withTrashed()->findOrFail($simulator->id)->deleted_at);
    }

    private function cancelledSimulator(): Simulator
    {
        return Simulator::query()->create([
            'user_id' => $this->admin->id,
            'mode' => 'greenhouse',
            'status' => 'cancelled',
            'share_visibility' => 'private',
        ]);
    }
}
