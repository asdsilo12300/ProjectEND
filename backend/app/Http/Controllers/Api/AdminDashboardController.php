<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Achievement;
use App\Models\AdminActivityLog;
use App\Models\Content;
use App\Models\Comment;
use App\Models\Item;
use App\Models\ModelAsset;
use App\Models\Pest;
use App\Models\PestConditionRule;
use App\Models\Plant;
use App\Models\PlantConditionRule;
use App\Models\PlantGrowthStage;
use App\Models\PlantHistory;
use App\Models\PlantVisualVariant;
use App\Models\Post;
use App\Models\Quest;
use App\Models\ShopItem;
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

        $metrics = [
            'users' => User::query()->count(),
            'active_users' => User::query()->where('status', 'active')->count(),
            'simulations' => Simulator::query()->withTrashed()->count(),
            'harvests' => PlantHistory::query()->withTrashed()->count(),
            'community_posts' => Post::query()->withTrashed()->count(),
            'post_comments' => Comment::query()->count(),
            'simulator_comments' => SimulatorComment::query()->count(),
            'published_contents' => Content::query()->where('status', 'published')->count(),
            'draft_contents' => Content::query()->where('status', 'draft')->count(),
            'plants' => Plant::query()->count(),
            'plant_stages' => PlantGrowthStage::query()->count(),
            'plant_rules' => PlantConditionRule::query()->count(),
            'plant_variants' => PlantVisualVariant::query()->count(),
            'pests' => Pest::query()->count(),
            'pest_rules' => PestConditionRule::query()->count(),
            'items' => Item::query()->count(),
            'shop_items' => ShopItem::query()->count(),
            'quests' => Quest::query()->count(),
            'achievements' => Achievement::query()->count(),
            'model_assets' => ModelAsset::query()->count(),
            'admin_actions' => AdminActivityLog::query()->count(),
            'active_simulations' => Simulator::query()->where('status', 'active')->count(),
            'hidden_comments' => Comment::query()->where('status', '!=', 'visible')->count()
                + SimulatorComment::query()->where('status', '!=', 'visible')->count(),
        ];

        $systemGroups = [
            ['key' => 'accounts', 'label' => 'Accounts', 'value' => $metrics['users'], 'section' => 'users'],
            ['key' => 'learning', 'label' => 'Learning content', 'value' => $metrics['published_contents'] + $metrics['draft_contents'], 'section' => 'contents'],
            ['key' => 'game_data', 'label' => 'Game data', 'value' => $metrics['plants'] + $metrics['plant_stages'] + $metrics['plant_rules'] + $metrics['plant_variants'] + $metrics['pests'] + $metrics['pest_rules'] + $metrics['items'] + $metrics['shop_items'] + $metrics['quests'] + $metrics['achievements'] + $metrics['model_assets'], 'section' => 'plants'],
            ['key' => 'activity', 'label' => 'Simulation activity', 'value' => $metrics['simulations'] + $metrics['harvests'], 'section' => 'simulations'],
            ['key' => 'community', 'label' => 'Community', 'value' => $metrics['community_posts'] + $metrics['post_comments'] + $metrics['simulator_comments'], 'section' => 'community'],
            ['key' => 'audit', 'label' => 'Admin audit', 'value' => $metrics['admin_actions'], 'section' => 'activity'],
        ];

        return response()->json(['data' => [
            'metrics' => $metrics,
            'system_overview' => [
                'total' => collect($systemGroups)->sum('value'),
                'groups' => $systemGroups,
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

        $posts = Post::query()
            ->withTrashed()
            ->where('created_at', '>=', $start)
            ->selectRaw('DATE(created_at) as trend_date, COUNT(*) as aggregate')
            ->groupBy('trend_date')
            ->pluck('aggregate', 'trend_date');

        $harvests = PlantHistory::query()
            ->withTrashed()
            ->where('created_at', '>=', $start)
            ->selectRaw('DATE(created_at) as trend_date, COUNT(*) as aggregate')
            ->groupBy('trend_date')
            ->pluck('aggregate', 'trend_date');

        return collect(range(0, $days - 1))->map(function (int $offset) use ($start, $users, $simulations, $posts, $harvests, $days): array {
            $day = $start->addDays($offset);
            $key = $day->toDateString();

            return [
                'date' => $key,
                'label' => $days === 7 ? $day->format('D') : $day->format('d M'),
                'users' => (int) ($users[$key] ?? 0),
                'simulations' => (int) ($simulations[$key] ?? 0),
                'posts' => (int) ($posts[$key] ?? 0),
                'harvests' => (int) ($harvests[$key] ?? 0),
            ];
        })->all();
    }
}
