<?php

namespace Tests\Feature;

use App\Http\Controllers\Api\AdminResourceController;
use App\Models\Item;
use App\Models\User;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Tests\TestCase;

class AdminSoftDeleteTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();

        Schema::dropIfExists('admin_activity_logs');
        Schema::dropIfExists('items');
        Schema::dropIfExists('users');

        Schema::create('users', function (Blueprint $table): void {
            $table->id();
            $table->string('username');
            $table->string('email');
            $table->string('password')->nullable();
            $table->string('role')->default('admin');
            $table->timestamps();
        });
        Schema::create('items', function (Blueprint $table): void {
            $table->id();
            $table->string('name');
            $table->string('type');
            $table->text('description')->nullable();
            $table->string('image_url')->nullable();
            $table->string('effect_type')->nullable();
            $table->integer('effect_value')->default(0);
            $table->string('rarity')->default('common');
            $table->boolean('is_active')->default(true);
            $table->timestamps();
            $table->softDeletes();
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
    }

    public function test_admin_delete_moves_a_record_to_trash_and_restore_recovers_it(): void
    {
        $admin = User::query()->create([
            'username' => 'admin',
            'email' => 'admin@example.test',
            'role' => 'admin',
        ]);
        $item = Item::query()->create([
            'name' => 'Safe spray',
            'type' => 'pesticide',
            'effect_value' => 1,
            'rarity' => 'common',
            'is_active' => true,
        ]);
        $controller = app(AdminResourceController::class);

        $deleteRequest = Request::create('/api/admin/resources/items/'.$item->id, 'DELETE');
        $deleteRequest->setUserResolver(fn () => $admin);
        $response = $controller->destroy($deleteRequest, 'items', $item->id);

        $this->assertSame(200, $response->status());
        $this->assertNotNull(Item::withTrashed()->findOrFail($item->id)->deleted_at);
        $this->assertNull(Item::query()->find($item->id));

        $trashRequest = Request::create('/api/admin/resources/items?trashed=only', 'GET');
        $trashPayload = $controller->index($trashRequest, 'items')->getData(true);
        $this->assertSame([$item->id], array_column($trashPayload['data'], 'id'));

        $restoreRequest = Request::create('/api/admin/resources/items/'.$item->id.'/restore', 'POST');
        $restoreRequest->setUserResolver(fn () => $admin);
        $controller->restore($restoreRequest, 'items', $item->id);

        $this->assertNotNull(Item::query()->find($item->id));
        $this->assertDatabaseHas('admin_activity_logs', ['action' => 'soft_deleted', 'target_id' => $item->id]);
        $this->assertDatabaseHas('admin_activity_logs', ['action' => 'restored', 'target_id' => $item->id]);
    }
}
