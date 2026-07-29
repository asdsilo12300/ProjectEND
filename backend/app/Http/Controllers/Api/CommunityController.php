<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Comment;
use App\Models\PlantHistory;
use App\Models\Post;
use App\Models\PostLike;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Validation\Rule;

class CommunityController extends Controller
{
    public function insights(Request $request): JsonResponse
    {
        $data = $request->validate([
            'days' => ['nullable', 'integer', Rule::in([7, 30, 90])],
        ]);

        $days = (int) ($data['days'] ?? 30);
        $userId = (int) $request->user()->id;
        $end = CarbonImmutable::now()->endOfDay();
        $start = $end->startOfDay()->subDays($days - 1);
        $dates = collect(range(0, $days - 1))
            ->map(fn (int $offset) => $start->addDays($offset)->toDateString())
            ->all();

        $posts = Post::query()
            ->where('user_id', $userId)
            ->whereBetween('created_at', [$start, $end])
            ->pluck('created_at');

        $likesReceived = PostLike::query()
            ->join('posts', 'posts.id', '=', 'post_likes.post_id')
            ->where('posts.user_id', $userId)
            ->where('post_likes.user_id', '<>', $userId)
            ->whereNull('posts.deleted_at')
            ->whereBetween('post_likes.created_at', [$start, $end])
            ->pluck('post_likes.created_at');

        $receivedCommentsQuery = fn (): Builder => Comment::query()
            ->join('posts', 'posts.id', '=', 'comments.post_id')
            ->where('posts.user_id', $userId)
            ->where('comments.user_id', '<>', $userId)
            ->where('comments.status', 'visible')
            ->whereNull('posts.deleted_at')
            ->whereBetween('comments.created_at', [$start, $end]);

        $commentsReceived = $receivedCommentsQuery()
            ->whereNull('comments.parent_id')
            ->pluck('comments.created_at');
        $repliesReceived = $receivedCommentsQuery()
            ->whereNotNull('comments.parent_id')
            ->pluck('comments.created_at');

        $likesGiven = PostLike::query()
            ->where('user_id', $userId)
            ->whereBetween('created_at', [$start, $end])
            ->pluck('created_at');

        $writtenCommentsQuery = fn (): Builder => Comment::query()
            ->where('user_id', $userId)
            ->where('status', 'visible')
            ->whereBetween('created_at', [$start, $end]);

        $commentsWritten = $writtenCommentsQuery()
            ->whereNull('parent_id')
            ->pluck('created_at');
        $repliesWritten = $writtenCommentsQuery()
            ->whereNotNull('parent_id')
            ->pluck('created_at');

        return response()->json([
            'data' => [
                'days' => $days,
                'from' => $start->toDateString(),
                'to' => $end->toDateString(),
                'content' => $this->insightSeries($dates, [
                    'posts' => $posts,
                    'likes' => $likesReceived,
                    'comments' => $commentsReceived,
                    'replies' => $repliesReceived,
                ]),
                'activity' => $this->insightSeries($dates, [
                    'posts' => $posts,
                    'likes' => $likesGiven,
                    'comments' => $commentsWritten,
                    'replies' => $repliesWritten,
                ]),
            ],
        ]);
    }

    public function leaderboard(Request $request): JsonResponse
    {
        $levelLeaders = User::query()
            ->withCount([
                'plantHistories',
                'requestedFriendships as accepted_requested_friendships_count' => fn ($friendships) => $friendships->where('status', 'accepted'),
                'receivedFriendships as accepted_received_friendships_count' => fn ($friendships) => $friendships->where('status', 'accepted'),
            ])
            ->orderByDesc('level')
            ->orderByDesc('experience')
            ->orderByDesc('plant_histories_count')
            ->limit(10)
            ->get()
            ->map(fn (User $user) => $this->userRankPayload($user, 'level'))
            ->values();

        $growLeaders = User::query()
            ->withCount([
                'plantHistories',
                'requestedFriendships as accepted_requested_friendships_count' => fn ($friendships) => $friendships->where('status', 'accepted'),
                'receivedFriendships as accepted_received_friendships_count' => fn ($friendships) => $friendships->where('status', 'accepted'),
            ])
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
            'bio' => $user->bio,
            'level' => (int) ($user->level ?? 1),
            'experience' => (int) ($user->experience ?? 0),
            'friends_count' => (int) ($user->accepted_requested_friendships_count ?? 0)
                + (int) ($user->accepted_received_friendships_count ?? 0),
            'plants_count' => (int) ($user->plant_histories_count ?? PlantHistory::query()->where('user_id', $user->id)->count()),
            'score_label' => $type === 'level'
                ? 'Lv.'.(int) ($user->level ?? 1)
                : (int) ($user->plant_histories_count ?? 0).' saves',
            'level_progress' => $user->levelProgress(),
        ];
    }

    /**
     * @param  array<string>  $dates
     * @param  array<string, Collection<int, mixed>>  $events
     * @return array{totals: array<string, int>, series: array<int, array<string, int|string>>}
     */
    private function insightSeries(array $dates, array $events): array
    {
        $timezone = (string) config('app.timezone', 'UTC');
        $counts = [];

        foreach ($events as $metric => $timestamps) {
            $counts[$metric] = array_fill_keys($dates, 0);
            foreach ($timestamps as $timestamp) {
                $date = CarbonImmutable::parse($timestamp)->setTimezone($timezone)->toDateString();
                if (array_key_exists($date, $counts[$metric])) {
                    $counts[$metric][$date]++;
                }
            }
        }

        return [
            'totals' => collect($events)
                ->map(fn (Collection $timestamps) => $timestamps->count())
                ->map(fn (int $count) => $count)
                ->all(),
            'series' => collect($dates)
                ->map(function (string $date) use ($counts): array {
                    $row = ['date' => $date];
                    foreach ($counts as $metric => $values) {
                        $row[$metric] = (int) ($values[$date] ?? 0);
                    }

                    return $row;
                })
                ->values()
                ->all(),
        ];
    }
}
