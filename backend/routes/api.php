<?php

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\ContentController;
use App\Http\Controllers\Api\FriendController;
use App\Http\Controllers\Api\GameProgressController;
use App\Http\Controllers\Api\ModelAssetController;
use App\Http\Controllers\Api\PlantController;
use App\Http\Controllers\Api\PlantHistoryController;
use App\Http\Controllers\Api\PostController;
use App\Http\Controllers\Api\SimulatorController;
use App\Http\Controllers\Api\ShopController;
use Illuminate\Support\Facades\Route;

Route::options('/{any}', fn () => response()->noContent())->where('any', '.*');

Route::prefix('auth')->group(function (): void {
    Route::post('/register', [AuthController::class, 'register']);
    Route::post('/login', [AuthController::class, 'login']);
});

Route::get('/plants', [PlantController::class, 'index']);
Route::get('/plants/{plant}', [PlantController::class, 'show']);
Route::get('/plants/{plant}/stages', [PlantController::class, 'stages']);
Route::get('/contents/{slug}', [ContentController::class, 'show']);
Route::get('/shop/items', [ShopController::class, 'index']);
Route::get('/posts', [PostController::class, 'index']);
Route::get('/model-assets', [ModelAssetController::class, 'index']);
Route::get('/model-assets/{key}', [ModelAssetController::class, 'show']);

// Dev-only test upload route (no auth) â€” only enabled when APP_DEBUG is true
if (env('APP_DEBUG', false)) {
    Route::post('/dev/upload-model', [\App\Http\Controllers\Api\PlantModelController::class, 'uploadTest']);
}

Route::middleware('jwt')->group(function (): void {
    Route::get('/me', [AuthController::class, 'me']);
    Route::get('/friends', [FriendController::class, 'index']);
    Route::get('/users/search', [FriendController::class, 'search']);
    Route::post('/friends/invite', [FriendController::class, 'invite']);
    Route::post('/friends/{friendship}/accept', [FriendController::class, 'accept']);

    Route::get('/simulators', [SimulatorController::class, 'index']);
    Route::get('/simulators/latest', [SimulatorController::class, 'latest']);
    Route::post('/simulators', [SimulatorController::class, 'store']);
    Route::get('/simulators/{simulator}', [SimulatorController::class, 'show']);
    Route::post('/simulators/{simulator}/logs', [SimulatorController::class, 'storeLog']);
    Route::post('/simulators/{simulator}/tick', [SimulatorController::class, 'tick']);
    Route::post('/simulators/{simulator}/sync', [SimulatorController::class, 'sync']);
    Route::post('/simulators/{simulator}/use-item', [SimulatorController::class, 'useItem']);

    Route::get('/inventory', [ShopController::class, 'inventory']);
    Route::post('/shop/items/{shopItem}/buy', [ShopController::class, 'buy']);
    Route::get('/quests', [GameProgressController::class, 'quests']);
    Route::get('/achievements', [GameProgressController::class, 'achievements']);
    Route::post('/daily-login', [GameProgressController::class, 'dailyLogin']);

    Route::post('/plant-histories/{history}/publish', [PlantHistoryController::class, 'publish']);

    Route::post('/posts', [PostController::class, 'store']);
    Route::post('/posts/{post}/comments', [PostController::class, 'comment']);
    Route::post('/posts/{post}/likes', [PostController::class, 'like']);
    Route::delete('/posts/{post}/likes', [PostController::class, 'unlike']);

    // Upload 3D model files (GLB) and save path to DB
    Route::post('/plants/{plant}/model', [\App\Http\Controllers\Api\PlantModelController::class, 'uploadBaseModel']);
    Route::post('/plants/{plant}/stages/{stage}/model', [\App\Http\Controllers\Api\PlantModelController::class, 'uploadStageModel']);
});

