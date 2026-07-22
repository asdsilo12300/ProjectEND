<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AdminActivityLog;
use App\Models\Content;
use App\Models\User;
use App\Services\AdminDataCache;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;

class AdminDashboardController extends Controller
{
    private const STALE_ACTIVE_SIMULATION_DAYS = 7;

    public function __construct(private readonly AdminDataCache $cache) {}

    public function index(Request $request): JsonResponse
    {
        $days = (int) $request->query('days', 7);
        $days = in_array($days, [7, 14, 30], true) ? $days : 7;

        $data = $this->cache->rememberDashboard($days, fn (): array => $this->dashboardData($days));

        return response()->json(['data' => $data]);
    }

    private function dashboardData(int $days): array
    {
        $start = CarbonImmutable::today()->subDays($days - 1);
        $now = CarbonImmutable::now();
        $summary = $this->summary($now->subDays(self::STALE_ACTIVE_SIMULATION_DAYS));

        $metrics = [
            'users' => $summary['users'],
            'active_users' => $summary['active_users'],
            'simulations' => $summary['simulations'],
            'harvests' => $summary['harvests'],
            'community_posts' => $summary['community_posts'],
            'post_comments' => $summary['post_comments'],
            'simulator_comments' => $summary['simulator_comments'],
            'published_contents' => $summary['published_contents'],
            'draft_contents' => $summary['draft_contents'],
            'plants' => $summary['plants'],
            'plant_stages' => $summary['plant_stages'],
            'plant_rules' => $summary['plant_rules'],
            'plant_variants' => $summary['plant_variants'],
            'pests' => $summary['pests'],
            'pest_rules' => $summary['pest_rules'],
            'items' => $summary['items'],
            'shop_items' => $summary['shop_items'],
            'quests' => $summary['quests'],
            'achievements' => $summary['achievements'],
            'model_assets' => $summary['model_assets'],
            'admin_actions' => $summary['admin_actions'],
            'active_simulations' => $summary['active_simulations'],
            'hidden_comments' => $summary['hidden_comments'],
        ];

        $systemGroups = [
            ['key' => 'accounts', 'label' => 'Accounts', 'value' => $metrics['users'], 'section' => 'users'],
            ['key' => 'learning', 'label' => 'Learning content', 'value' => $metrics['published_contents'] + $metrics['draft_contents'], 'section' => 'contents'],
            ['key' => 'game_data', 'label' => 'Game data', 'value' => $metrics['plants'] + $metrics['plant_stages'] + $metrics['plant_rules'] + $metrics['plant_variants'] + $metrics['pests'] + $metrics['pest_rules'] + $metrics['items'] + $metrics['shop_items'] + $metrics['quests'] + $metrics['achievements'] + $metrics['model_assets'], 'section' => 'plants'],
            ['key' => 'activity', 'label' => 'Simulation activity', 'value' => $metrics['simulations'] + $metrics['harvests'], 'section' => 'simulations'],
            ['key' => 'community', 'label' => 'Community', 'value' => $metrics['community_posts'] + $metrics['post_comments'] + $metrics['simulator_comments'], 'section' => 'community'],
            ['key' => 'audit', 'label' => 'Admin audit', 'value' => $metrics['admin_actions'], 'section' => 'activity'],
        ];

        return [
            'metrics' => $metrics,
            'system_overview' => [
                'total' => collect($systemGroups)->sum('value'),
                'groups' => $systemGroups,
            ],
            'trend_days' => $days,
            'trend' => $this->trend($start, $days),
            'attention' => $this->attention($now, $summary),
            'recent_users' => User::query()
                ->latest()
                ->limit(5)
                ->get(['id', 'username', 'email', 'avatar_url', 'role', 'status', 'level', 'created_at'])
                ->toArray(),
            'recent_contents' => Content::query()
                ->latest('updated_at')
                ->limit(5)
                ->get(['id', 'slug', 'title', 'title_th', 'status', 'version', 'updated_at'])
                ->toArray(),
            'generated_at' => $now->toIso8601String(),
        ];
    }

    private function attention(CarbonImmutable $now, array $summary): array
    {
        $counts = [
            'suspended_users' => $summary['suspended_users'],
            'draft_contents' => $summary['draft_contents'],
            'hidden_post_comments' => $summary['hidden_post_comments'],
            'suspended_post_comments' => $summary['suspended_post_comments'],
            'hidden_simulator_comments' => $summary['hidden_simulator_comments'],
            'suspended_simulator_comments' => $summary['suspended_simulator_comments'],
            'failed_simulations' => $summary['failed_simulations'],
            'cancelled_simulations' => $summary['cancelled_simulations'],
            'stale_active_simulations' => $summary['stale_active_simulations'],
            'missing_model_assets' => $summary['missing_model_assets'],
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
            'recent_admin_actions' => $this->recentAdminActions(),
        ];
    }

    /**
     * Read every dashboard counter in one database round trip. The previous
     * implementation issued a separate count query for every card and alert.
     */
    private function summary(CarbonImmutable $staleCutoff): array
    {
        $row = DB::selectOne(<<<'SQL'
            SELECT
                (SELECT COUNT(*) FROM users) AS users,
                (SELECT COUNT(*) FROM users WHERE status = 'active') AS active_users,
                (SELECT COUNT(*) FROM users WHERE status = 'suspended') AS suspended_users,
                (SELECT COUNT(*) FROM simulators) AS simulations,
                (SELECT COUNT(*) FROM simulators WHERE deleted_at IS NULL AND status = 'active') AS active_simulations,
                (SELECT COUNT(*) FROM simulators WHERE deleted_at IS NULL AND status = 'failed') AS failed_simulations,
                (SELECT COUNT(*) FROM simulators WHERE deleted_at IS NULL AND status = 'cancelled') AS cancelled_simulations,
                (SELECT COUNT(*) FROM simulators WHERE deleted_at IS NULL AND status = 'active' AND (started_at <= ? OR (started_at IS NULL AND created_at <= ?))) AS stale_active_simulations,
                (SELECT COUNT(*) FROM plant_histories) AS harvests,
                (SELECT COUNT(*) FROM posts) AS community_posts,
                (SELECT COUNT(*) FROM comments WHERE deleted_at IS NULL) AS post_comments,
                (SELECT COUNT(*) FROM comments WHERE deleted_at IS NULL AND status <> 'visible') +
                    (SELECT COUNT(*) FROM simulator_comments WHERE deleted_at IS NULL AND status <> 'visible') AS hidden_comments,
                (SELECT COUNT(*) FROM comments WHERE deleted_at IS NULL AND status = 'hidden') AS hidden_post_comments,
                (SELECT COUNT(*) FROM comments WHERE deleted_at IS NULL AND status = 'suspended') AS suspended_post_comments,
                (SELECT COUNT(*) FROM simulator_comments WHERE deleted_at IS NULL) AS simulator_comments,
                (SELECT COUNT(*) FROM simulator_comments WHERE deleted_at IS NULL AND status = 'hidden') AS hidden_simulator_comments,
                (SELECT COUNT(*) FROM simulator_comments WHERE deleted_at IS NULL AND status = 'suspended') AS suspended_simulator_comments,
                (SELECT COUNT(*) FROM contents WHERE deleted_at IS NULL AND status = 'published') AS published_contents,
                (SELECT COUNT(*) FROM contents WHERE deleted_at IS NULL AND status = 'draft') AS draft_contents,
                (SELECT COUNT(*) FROM plants WHERE deleted_at IS NULL) AS plants,
                (SELECT COUNT(*) FROM plant_growth_stages WHERE deleted_at IS NULL) AS plant_stages,
                (SELECT COUNT(*) FROM plant_condition_rules WHERE deleted_at IS NULL) AS plant_rules,
                (SELECT COUNT(*) FROM plant_visual_variants WHERE deleted_at IS NULL) AS plant_variants,
                (SELECT COUNT(*) FROM pests WHERE deleted_at IS NULL) AS pests,
                (SELECT COUNT(*) FROM pest_condition_rules WHERE deleted_at IS NULL) AS pest_rules,
                (SELECT COUNT(*) FROM items WHERE deleted_at IS NULL) AS items,
                (SELECT COUNT(*) FROM shop_items WHERE deleted_at IS NULL) AS shop_items,
                (SELECT COUNT(*) FROM quests WHERE deleted_at IS NULL) AS quests,
                (SELECT COUNT(*) FROM achievements WHERE deleted_at IS NULL) AS achievements,
                (SELECT COUNT(*) FROM model_assets WHERE deleted_at IS NULL) AS model_assets,
                (SELECT COUNT(*) FROM model_assets WHERE deleted_at IS NULL AND (url IS NULL OR TRIM(url) = '')) AS missing_model_assets,
                (SELECT COUNT(*) FROM admin_activity_logs) AS admin_actions
            SQL, [$staleCutoff, $staleCutoff]);

        return collect((array) $row)
            ->map(static fn (mixed $value): int => (int) $value)
            ->all();
    }

    private function recentAdminActions(): array
    {
        return DB::table('admin_activity_logs as logs')
            ->leftJoin('users as admins', 'admins.id', '=', 'logs.admin_id')
            ->latest('logs.created_at')
            ->latest('logs.id')
            ->limit(5)
            ->get([
                'logs.id', 'logs.admin_id', 'logs.action', 'logs.target_type',
                'logs.target_id', 'logs.detail', 'logs.created_at',
                'admins.username as admin_username', 'admins.email as admin_email',
            ])
            ->map(static fn (object $action): array => [
                'id' => $action->id,
                'admin_id' => $action->admin_id,
                'action' => $action->action,
                'target_type' => $action->target_type,
                'target_id' => $action->target_id,
                'detail' => $action->detail,
                'created_at' => $action->created_at,
                'admin' => $action->admin_id === null ? null : [
                    'id' => $action->admin_id,
                    'username' => $action->admin_username,
                    'email' => $action->admin_email,
                ],
            ])
            ->all();
    }

    private function trend(CarbonImmutable $start, int $days): array
    {
        $activity = DB::table('users')
            ->selectRaw("'users' AS source, created_at")
            ->where('created_at', '>=', $start)
            ->unionAll(DB::table('simulators')->selectRaw("'simulations' AS source, created_at")->where('created_at', '>=', $start))
            ->unionAll(DB::table('posts')->selectRaw("'posts' AS source, created_at")->where('created_at', '>=', $start))
            ->unionAll(DB::table('plant_histories')->selectRaw("'harvests' AS source, created_at")->where('created_at', '>=', $start));

        $series = DB::query()
            ->fromSub($activity, 'activity')
            ->selectRaw('source, DATE(created_at) AS trend_date, COUNT(*) AS aggregate')
            ->groupBy('source', 'trend_date')
            ->get()
            ->groupBy('source')
            ->map(static fn ($rows) => $rows->pluck('aggregate', 'trend_date'));

        return collect(range(0, $days - 1))->map(function (int $offset) use ($start, $series, $days): array {
            $day = $start->addDays($offset);
            $key = $day->toDateString();

            return [
                'date' => $key,
                'label' => $days === 7 ? $day->format('D') : $day->format('d M'),
                'users' => (int) ($series->get('users', collect())[$key] ?? 0),
                'simulations' => (int) ($series->get('simulations', collect())[$key] ?? 0),
                'posts' => (int) ($series->get('posts', collect())[$key] ?? 0),
                'harvests' => (int) ($series->get('harvests', collect())[$key] ?? 0),
            ];
        })->all();
    }
}
