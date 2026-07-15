<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Content;
use App\Models\Comment;
use App\Models\Item;
use App\Models\Pest;
use App\Models\Plant;
use App\Models\PlantHistory;
use App\Models\Post;
use App\Models\Simulator;
use App\Models\SimulatorComment;
use App\Models\User;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class AdminDashboardController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $days = (int) $request->query('days', 7);
        $days = in_array($days, [7, 14, 30], true) ? $days : 7;
        $start = CarbonImmutable::today()->subDays($days - 1);

        return response()->json(['data' => [
            'metrics' => [
                'users' => User::query()->count(),
                'active_users' => User::query()->where('status', 'active')->count(),
                'simulations' => Simulator::query()->withTrashed()->count(),
                'harvests' => PlantHistory::query()->withTrashed()->count(),
                'community_posts' => Post::query()->withTrashed()->count(),
                'published_contents' => Content::query()->where('status', 'published')->count(),
                'draft_contents' => Content::query()->where('status', 'draft')->count(),
                'plants' => Plant::query()->count(),
                'pests' => Pest::query()->count(),
                'items' => Item::query()->count(),
                'active_simulations' => Simulator::query()->where('status', 'active')->count(),
                'hidden_comments' => Comment::query()->where('status', '!=', 'visible')->count()
                    + SimulatorComment::query()->where('status', '!=', 'visible')->count(),
            ],
            'trend_days' => $days,
            'trend' => $this->trend($start, $days),
            'recent_users' => User::query()
                ->latest()
                ->limit(5)
                ->get(['id', 'username', 'email', 'role', 'status', 'level', 'created_at']),
            'recent_contents' => Content::query()
                ->latest('updated_at')
                ->limit(5)
                ->get(['id', 'slug', 'title', 'title_th', 'status', 'version', 'updated_at']),
        ]]);
    }

    private function trend(CarbonImmutable $start, int $days): array
    {
        $users = User::query()
            ->where('created_at', '>=', $start)
            ->selectRaw('DATE(created_at) as trend_date, COUNT(*) as aggregate')
            ->groupBy('trend_date')
            ->pluck('aggregate', 'trend_date');

        $simulations = Simulator::query()
            ->withTrashed()
            ->where('created_at', '>=', $start)
            ->selectRaw('DATE(created_at) as trend_date, COUNT(*) as aggregate')
            ->groupBy('trend_date')
            ->pluck('aggregate', 'trend_date');

        return collect(range(0, $days - 1))->map(function (int $offset) use ($start, $users, $simulations, $days): array {
            $day = $start->addDays($offset);
            $key = $day->toDateString();

            return [
                'date' => $key,
                'label' => $days === 7 ? $day->format('D') : $day->format('d M'),
                'users' => (int) ($users[$key] ?? 0),
                'simulations' => (int) ($simulations[$key] ?? 0),
            ];
        })->all();
    }
}
