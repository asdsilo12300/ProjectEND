<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PlantHistory;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class CommunityController extends Controller
{
    public function leaderboard(Request $request): JsonResponse
    {
        $levelLeaders = User::query()
            ->withCount('plantHistories')
            ->orderByDesc('level')
            ->orderByDesc('experience')
            ->orderByDesc('plant_histories_count')
            ->limit(10)
            ->get()
            ->map(fn (User $user) => $this->userRankPayload($user, 'level'))
            ->values();

        $growLeaders = User::query()
            ->withCount('plantHistories')
            ->whereHas('plantHistories')
            ->orderByDesc('plant_histories_count')
            ->orderByDesc('level')
            ->limit(10)
            ->get()
            ->map(fn (User $user) => $this->userRankPayload($user, 'plants'))
            ->values();

        return response()->json([
            'data' => [
                'levels' => $levelLeaders,
                'growers' => $growLeaders,
            ],
        ]);
    }

    private function userRankPayload(User $user, string $type): array
    {
        return [
            'id' => $user->id,
            'username' => $user->username,
            'email' => $user->email,
            'avatar_url' => $user->avatar_url,
            'cover_url' => $user->cover_url,
            'level' => (int) ($user->level ?? 1),
            'experience' => (int) ($user->experience ?? 0),
            'plants_count' => (int) ($user->plant_histories_count ?? PlantHistory::query()->where('user_id', $user->id)->count()),
            'score_label' => $type === 'level'
                ? 'Lv.'.(int) ($user->level ?? 1)
                : (int) ($user->plant_histories_count ?? 0).' saves',
            'level_progress' => $user->levelProgress(),
        ];
    }
}
