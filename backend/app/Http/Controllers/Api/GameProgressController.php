<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Achievement;
use App\Models\DailyLogin;
use App\Models\Quest;
use App\Models\UserAchievement;
use App\Models\UserQuest;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class GameProgressController extends Controller
{
    public function quests(Request $request): JsonResponse
    {
        $quests = Quest::query()->where('is_active', true)->get();
        $userQuests = UserQuest::query()
            ->where('user_id', $request->user()->id)
            ->get()
            ->keyBy('quest_id');

        return response()->json([
            'data' => $quests->map(fn (Quest $quest) => [
                ...$quest->toArray(),
                'user_progress' => $userQuests->get($quest->id),
            ]),
        ]);
    }

    public function achievements(Request $request): JsonResponse
    {
        $achievements = Achievement::query()->where('is_active', true)->get();
        $unlocked = UserAchievement::query()
            ->where('user_id', $request->user()->id)
            ->pluck('unlocked_at', 'achievement_id');

        return response()->json([
            'data' => $achievements->map(fn (Achievement $achievement) => [
                ...$achievement->toArray(),
                'unlocked_at' => $unlocked->get($achievement->id),
            ]),
        ]);
    }

    public function dailyLogin(Request $request): JsonResponse
    {
        $today = now()->toDateString();
        $yesterday = now()->subDay()->toDateString();

        $latest = DailyLogin::query()
            ->where('user_id', $request->user()->id)
            ->orderByDesc('login_date')
            ->first();

        $streak = $latest?->login_date?->toDateString() === $yesterday
            ? $latest->streak_day + 1
            : 1;

        $login = DailyLogin::query()->firstOrCreate(
            ['user_id' => $request->user()->id, 'login_date' => $today],
            ['streak_day' => $streak, 'reward_claimed' => false]
        );

        return response()->json(['data' => $login]);
    }
}
