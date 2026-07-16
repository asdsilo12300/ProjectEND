<?php

use App\Http\Controllers\Api\AdminContentController;
use App\Http\Controllers\Api\AdminDashboardController;
use App\Http\Controllers\Api\AdminResourceController;
use App\Http\Controllers\Api\AdminUserController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\CommunityController;
use App\Http\Controllers\Api\ContentController;
use App\Http\Controllers\Api\FriendController;
use App\Http\Controllers\Api\GameProgressController;
use App\Http\Controllers\Api\GoogleAuthController;
use App\Http\Controllers\Api\ModelAssetController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\PasswordResetController;
use App\Http\Controllers\Api\PlantController;
use App\Http\Controllers\Api\PlantHistoryController;
use App\Http\Controllers\Api\PlantModelController;
use App\Http\Controllers\Api\PostController;
use App\Http\Controllers\Api\ShopController;
use App\Http\Controllers\Api\SimulatorController;
use Illuminate\Support\Facades\Route;

Route::options('/{any}', fn () => response()->noContent())->where('any', '.*');

Route::prefix('auth')->group(function (): void {
    Route::post('/register', [AuthController::class, 'register'])->middleware('throttle:3,1');
    Route::post('/login', [AuthController::class, 'login'])->middleware('throttle:5,1');
    Route::get('/google/redirect', [GoogleAuthController::class, 'redirect'])->middleware('throttle:20,1');
    Route::get('/google/callback', [GoogleAuthController::class, 'callback'])->middleware('throttle:30,1');
});

Route::get('/plants', [PlantController::class, 'index']);
Route::get('/plants/{plant}', [PlantController::class, 'show']);
Route::get('/plants/{plant}/stages', [PlantController::class, 'stages']);
Route::get('/contents', [ContentController::class, 'index']);
Route::get('/contents/{slug}', [ContentController::class, 'show']);
Route::get('/shop/items', [ShopController::class, 'index']);
Route::get('/posts', [PostController::class, 'index']);
Route::get('/model-assets', [ModelAssetController::class, 'index']);
Route::get('/model-assets/{key}', [ModelAssetController::class, 'show']);

// Dev-only test upload route (no auth); enabled only when APP_DEBUG is true.
if (config('app.debug')) {
    Route::post('/dev/upload-model', [PlantModelController::class, 'uploadTest']);
}

Route::middleware('jwt')->group(function (): void {
    Route::get('/me', [AuthController::class, 'me']);
    Route::patch('/me', [AuthController::class, 'updateProfile']);
    Route::post('/me/profile', [AuthController::class, 'updateProfile']);
    Route::post('/auth/password-reset/request', [PasswordResetController::class, 'requestOtp'])->middleware('throttle:3,10');
    Route::post('/auth/password-reset/verify', [PasswordResetController::class, 'verifyOtp'])->middleware('throttle:10,10');
    Route::post('/auth/password-reset/complete', [PasswordResetController::class, 'resetPassword'])->middleware('throttle:5,10');
    Route::get('/friends', [FriendController::class, 'index']);
    Route::get('/users/search', [FriendController::class, 'search']);
    Route::post('/friends/invite', [FriendController::class, 'invite']);
    Route::post('/friends/{friendship}/accept', [FriendController::class, 'accept']);
    Route::delete('/friends/{friendship}', [FriendController::class, 'destroy']);
    Route::get('/friends/{friendship}/simulator/latest', [FriendController::class, 'latestSimulator']);
    Route::get('/posts/friends', [PostController::class, 'friends']);
    Route::get('/community/leaderboard', [CommunityController::class, 'leaderboard']);

    Route::get('/simulators', [SimulatorController::class, 'index']);
    Route::get('/simulators/latest', [SimulatorController::class, 'latest']);
    Route::post('/simulators', [SimulatorController::class, 'store']);
    Route::get('/simulators/{simulator}', [SimulatorController::class, 'show']);
    Route::post('/simulators/{simulator}/logs', [SimulatorController::class, 'storeLog']);
    Route::post('/simulators/{simulator}/tick', [SimulatorController::class, 'tick']);
    Route::post('/simulators/{simulator}/sync', [SimulatorController::class, 'sync']);
    Route::get('/simulators/{simulator}/comments', [SimulatorController::class, 'comments']);
    Route::post('/simulators/{simulator}/comments', [SimulatorController::class, 'storeComment']);
    Route::post('/simulators/{simulator}/finish', [SimulatorController::class, 'finish']);
    Route::post('/simulators/{simulator}/uproot', [SimulatorController::class, 'uproot']);
    Route::post('/simulators/{simulator}/share', [SimulatorController::class, 'share']);
    Route::get('/spectator/simulators/{simulator}', [SimulatorController::class, 'spectate']);
    Route::post('/simulators/{simulator}/claim-maturity-reward', [SimulatorController::class, 'claimMaturityReward']);
    Route::post('/simulators/{simulator}/use-item', [SimulatorController::class, 'useItem']);

    Route::get('/inventory', [ShopController::class, 'inventory']);
    Route::post('/shop/items/{shopItem}/buy', [ShopController::class, 'buy']);
    Route::get('/quests', [GameProgressController::class, 'quests']);
    Route::get('/achievements', [GameProgressController::class, 'achievements']);
    Route::post('/daily-login', [GameProgressController::class, 'dailyLogin']);

    Route::get('/plant-histories', [PlantHistoryController::class, 'index']);
    Route::post('/simulators/{simulator}/histories', [PlantHistoryController::class, 'storeForSimulator']);
    Route::post('/plant-histories/{history}/visibility', [PlantHistoryController::class, 'updateVisibility']);
    Route::post('/plant-histories/{history}/publish', [PlantHistoryController::class, 'publish']);
    Route::delete('/plant-histories/{history}', [PlantHistoryController::class, 'destroy']);

    Route::post('/posts', [PostController::class, 'store']);
    Route::get('/posts/{post}/comments', [PostController::class, 'comments']);
    Route::post('/posts/{post}/comments', [PostController::class, 'comment']);
    Route::post('/posts/{post}/comments/{comment}/replies', [PostController::class, 'reply']);
    Route::post('/posts/{post}/comments/{comment}/likes', [PostController::class, 'likeComment']);
    Route::delete('/posts/{post}/comments/{comment}/likes', [PostController::class, 'unlikeComment']);
    Route::post('/posts/{post}/likes', [PostController::class, 'like']);
    Route::delete('/posts/{post}/likes', [PostController::class, 'unlike']);

    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::post('/notifications/{notification}/read', [NotificationController::class, 'read']);

    // Model files can change the whole simulation and are admin-only.
    Route::post('/plants/{plant}/model', [PlantModelController::class, 'uploadBaseModel'])->middleware('admin');
    Route::post('/plants/{plant}/stages/{stage}/model', [PlantModelController::class, 'uploadStageModel'])->middleware('admin');

    Route::prefix('admin')->middleware('admin')->group(function (): void {
        Route::get('/dashboard', [AdminDashboardController::class, 'index']);
        Route::get('/contents', [AdminContentController::class, 'index']);
        Route::post('/contents', [AdminContentController::class, 'store']);
        Route::post('/contents/images', [AdminContentController::class, 'uploadImage']);
        Route::put('/contents/{content}', [AdminContentController::class, 'update']);
        Route::delete('/contents/{content}', [AdminContentController::class, 'destroy']);
        Route::get('/users', [AdminUserController::class, 'index']);
        Route::patch('/users/{user}', [AdminUserController::class, 'update']);
        Route::get('/resources/lookups', [AdminResourceController::class, 'lookups']);
        Route::get('/resources/{resource}', [AdminResourceController::class, 'index']);
        Route::post('/resources/{resource}', [AdminResourceController::class, 'store']);
        Route::put('/resources/{resource}/{record}', [AdminResourceController::class, 'update']);
        Route::delete('/resources/{resource}/{record}', [AdminResourceController::class, 'destroy']);

    });
});
