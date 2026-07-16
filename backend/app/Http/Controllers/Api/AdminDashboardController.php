<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Achievement;
use App\Models\AdminActivityLog;
use App\Models\Comment;
use App\Models\Content;
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
    private const STALE_ACTIVE_SIMULATION_DAYS = 7;

    public function index(Request $request): JsonResponse
    {
        $days = (int) $request->query('days', 7);
        $days = in_array($days, [7, 14, 30], true) ? $days : 7;
        $start = CarbonImmutable::today()->subDays($days - 1);
        $now = CarbonImmutable::now();

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
            'attention' => $this->attention($now),
            'recent_users' => User::query()
                ->latest()
                ->limit(5)
                ->get(['id', 'username', 'email', 'avatar_url', 'role', 'status', 'level', 'created_at']),
            'recent_contents' => Content::query()
                ->latest('updated_at')
                ->limit(5)
                ->get(['id', 'slug', 'title', 'title_th', 'status', 'version', 'updated_at']),
        ]]);
    }

    private function attention(CarbonImmutable $now): array
    {
        $staleCutoff = $now->subDays(self::STALE_ACTIVE_SIMULATION_DAYS);
        $counts = [
            'suspended_users' => User::query()->where('status', 'suspended')->count(),
            'draft_contents' => Content::query()->where('status', 'draft')->count(),
            'hidden_post_comments' => Comment::query()->where('status', 'hidden')->count(),
            'suspended_post_comments' => Comment::query()->where('status', 'suspended')->count(),
            'hidden_simulator_comments' => SimulatorComment::query()->where('status', 'hidden')->count(),
            'suspended_simulator_comments' => SimulatorComment::query()->where('status', 'suspended')->count(),
            'failed_simulations' => Simulator::query()->where('status', 'failed')->count(),
            'cancelled_simulations' => Simulator::query()->where('status', 'cancelled')->count(),
            'stale_active_simulations' => Simulator::query()
                ->where('status', 'active')
                ->where(function ($query) use ($staleCutoff): void {
                    $query->where('started_at', '<=', $staleCutoff)
                        ->orWhere(function ($fallback) use ($staleCutoff): void {
                            $fallback->whereNull('started_at')->where('created_at', '<=', $staleCutoff);
                        });
                })
                ->count(),
            // Asset URLs are required for registered model assets. Only count blank
            // values here; checking remote URL availability would make this endpoint
            // slow and could report transient network failures as broken content.
            'missing_model_assets' => ModelAsset::query()
                ->where(function ($query): void {
                    $query->whereNull('url')->orWhereRaw("TRIM(url) = ''");
                })
                ->count(),
        ];

        $moderatedComments = $counts['hidden_post_comments']
            + $counts['suspended_post_comments']
            + $counts['hidden_simulator_comments']
            + $counts['suspended_simulator_comments'];

        $counts['moderated_comments'] = $moderatedComments;

        $items = [
            ['key' => 'moderated_comments', 'value' => $moderatedComments, 'severity' => 'warning', 'section' => 'community'],
            ['key' => 'draft_contents', 'value' => $counts['draft_contents'], 'severity' => 'info', 'section' => 'contents'],
            ['key' => 'suspended_users', 'value' => $counts['suspended_users'], 'severity' => 'warning', 'section' => 'users'],
            ['key' => 'failed_simulations', 'value' => $counts['failed_simulations'], 'severity' => 'critical', 'section' => 'simulations'],
            ['key' => 'cancelled_simulations', 'value' => $counts['cancelled_simulations'], 'severity' => 'info', 'section' => 'simulations'],
            ['key' => 'stale_active_simulations', 'value' => $counts['stale_active_simulations'], 'severity' => 'warning', 'section' => 'simulations'],
            ['key' => 'missing_model_assets', 'value' => $counts['missing_model_assets'], 'severity' => 'warning', 'section' => 'models'],
        ];

        return [
            'total' => collect($items)->sum('value'),
            'updated_at' => $now->toIso8601String(),
            'stale_active_simulation_days' => self::STALE_ACTIVE_SIMULATION_DAYS,
            'counts' => $counts,
            'items' => $items,
            'recent_admin_actions' => AdminActivityLog::query()
                ->with('admin:id,username,email')
                ->latest('created_at')
                ->latest('id')
                ->limit(5)
                ->get(['id', 'admin_id', 'action', 'target_type', 'target_id', 'detail', 'created_at']),
        ];
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
