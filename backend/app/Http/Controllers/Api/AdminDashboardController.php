<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\AdminDataCache;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Throwable;

class AdminDashboardController extends Controller
{
    private const STALE_ACTIVE_SIMULATION_DAYS = 7;

    public function __construct(private readonly AdminDataCache $cache) {}

    public function index(Request $request): JsonResponse
    {
        $selection = $this->trendSelection($request);
        $cacheKey = "{$selection['period']}:{$selection['value']}";

        $data = $this->cache->rememberDashboard($cacheKey, fn (): array => $this->dashboardData($selection));

        return response()->json(['data' => $data]);
    }

    private function dashboardData(array $trendSelection): array
    {
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
            ['key' => 'learning', 'label' => 'Plant content', 'value' => $metrics['published_contents'] + $metrics['draft_contents'], 'section' => 'contents'],
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
            'trend_days' => $trendSelection['days'],
            'trend_period' => $trendSelection['period'],
            'trend_value' => $trendSelection['value'],
            'trend_label' => $trendSelection['label'],
            'trend' => $this->trend($trendSelection),
            'attention' => $this->attention($now, $summary),
            'recent_users' => User::query()
                ->latest()
                ->limit(5)
                ->get(['id', 'username', 'email', 'avatar_url', 'role', 'status', 'level', 'created_at'])
                ->toArray(),
            'recent_user_activities' => $this->recentUserActivities(),
            'generated_at' => $now->toIso8601String(),
        ];
    }

    private function trendSelection(Request $request): array
    {
        $period = strtolower((string) $request->query('period', ''));
        $today = CarbonImmutable::today();

        if (!in_array($period, ['day', 'month', 'year'], true)) {
            $days = (int) $request->query('days', 7);
            $days = in_array($days, [7, 14, 30], true) ? $days : 7;
            $start = $today->subDays($days - 1);

            return [
                'period' => 'range',
                'value' => (string) $days,
                'label' => "Last {$days} days",
                'unit' => 'day',
                'start' => $start,
                'end' => $today->addDay(),
                'days' => $days,
            ];
        }

        $rawValue = trim((string) $request->query('value', ''));

        if ($period === 'day') {
            $date = $this->parseTrendValue($rawValue, '!Y-m-d', 'Y-m-d', $today);

            return [
                'period' => 'day',
                'value' => $date->format('Y-m-d'),
                'label' => $date->format('j M Y'),
                'unit' => 'hour',
                'start' => $date->startOfDay(),
                'end' => $date->addDay()->startOfDay(),
                'days' => 1,
            ];
        }

        if ($period === 'month') {
            $month = $this->parseTrendValue($rawValue, '!Y-m', 'Y-m', $today->startOfMonth())->startOfMonth();

            return [
                'period' => 'month',
                'value' => $month->format('Y-m'),
                'label' => $month->format('F Y'),
                'unit' => 'day',
                'start' => $month,
                'end' => $month->addMonth(),
                'days' => $month->daysInMonth,
            ];
        }

        $yearNumber = ctype_digit($rawValue) ? (int) $rawValue : $today->year;
        if ($yearNumber < 2000 || $yearNumber > 2100) {
            $yearNumber = $today->year;
        }
        $year = CarbonImmutable::create($yearNumber, 1, 1)->startOfYear();

        return [
            'period' => 'year',
            'value' => $year->format('Y'),
            'label' => $year->format('Y'),
            'unit' => 'month',
            'start' => $year,
            'end' => $year->addYear(),
            'days' => $year->daysInYear,
        ];
    }

    private function parseTrendValue(
        string $value,
        string $parseFormat,
        string $outputFormat,
        CarbonImmutable $fallback,
    ): CarbonImmutable {
        try {
            $parsed = CarbonImmutable::createFromFormat($parseFormat, $value);
            if ($parsed instanceof CarbonImmutable && $parsed->format($outputFormat) === $value) {
                return $parsed;
            }
        } catch (Throwable) {
            // Invalid picker values fall back to the matching current period.
        }

        return $fallback;
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

    /**
     * Build one chronological feed from the main user activity tables.
     * UNION ALL keeps this to one database round trip even as more activity
     * types are displayed and filtered on the dashboard.
     */
    private function recentUserActivities(): array
    {
        $activity = DB::table('users as actors')
            ->selectRaw("
                actors.id AS event_id,
                'user_registered' AS type,
                'accounts' AS category,
                actors.id AS user_id,
                actors.username,
                actors.email,
                actors.avatar_url,
                actors.email AS subject,
                actors.email AS subject_th,
                actors.created_at AS occurred_at
            ");

        $activity
            ->unionAll(
                DB::table('simulators as events')
                    ->join('users as actors', 'actors.id', '=', 'events.user_id')
                    ->leftJoin('plants', 'plants.id', '=', 'events.plant_id')
                    ->whereNull('events.deleted_at')
                    ->selectRaw("
                        events.id AS event_id,
                        'simulation_started' AS type,
                        'simulation' AS category,
                        actors.id AS user_id,
                        actors.username,
                        actors.email,
                        actors.avatar_url,
                        COALESCE(plants.name_en, plants.name_th, events.status) AS subject,
                        COALESCE(plants.name_th, plants.name_en, events.status) AS subject_th,
                        events.created_at AS occurred_at
                    "),
            )
            ->unionAll(
                DB::table('plant_histories as events')
                    ->join('users as actors', 'actors.id', '=', 'events.user_id')
                    ->leftJoin('plants', 'plants.id', '=', 'events.plant_id')
                    ->whereNull('events.deleted_at')
                    ->selectRaw("
                        events.id AS event_id,
                        'plant_saved' AS type,
                        'simulation' AS category,
                        actors.id AS user_id,
                        actors.username,
                        actors.email,
                        actors.avatar_url,
                        COALESCE(plants.name_en, plants.name_th) AS subject,
                        COALESCE(plants.name_th, plants.name_en) AS subject_th,
                        events.created_at AS occurred_at
                    "),
            )
            ->unionAll(
                DB::table('posts as events')
                    ->join('users as actors', 'actors.id', '=', 'events.user_id')
                    ->whereNull('events.deleted_at')
                    ->selectRaw("
                        events.id AS event_id,
                        'post_created' AS type,
                        'community' AS category,
                        actors.id AS user_id,
                        actors.username,
                        actors.email,
                        actors.avatar_url,
                        SUBSTR(events.caption, 1, 100) AS subject,
                        SUBSTR(events.caption, 1, 100) AS subject_th,
                        events.created_at AS occurred_at
                    "),
            )
            ->unionAll(
                DB::table('comments as events')
                    ->join('users as actors', 'actors.id', '=', 'events.user_id')
                    ->whereNull('events.deleted_at')
                    ->selectRaw("
                        events.id AS event_id,
                        'post_commented' AS type,
                        'community' AS category,
                        actors.id AS user_id,
                        actors.username,
                        actors.email,
                        actors.avatar_url,
                        SUBSTR(events.comment_text, 1, 100) AS subject,
                        SUBSTR(events.comment_text, 1, 100) AS subject_th,
                        events.created_at AS occurred_at
                    "),
            )
            ->unionAll(
                DB::table('simulator_comments as events')
                    ->join('users as actors', 'actors.id', '=', 'events.user_id')
                    ->whereNull('events.deleted_at')
                    ->selectRaw("
                        events.id AS event_id,
                        'simulation_commented' AS type,
                        'community' AS category,
                        actors.id AS user_id,
                        actors.username,
                        actors.email,
                        actors.avatar_url,
                        SUBSTR(events.comment_text, 1, 100) AS subject,
                        SUBSTR(events.comment_text, 1, 100) AS subject_th,
                        events.created_at AS occurred_at
                    "),
            )
            ->unionAll(
                DB::table('post_likes as events')
                    ->join('users as actors', 'actors.id', '=', 'events.user_id')
                    ->selectRaw("
                        events.id AS event_id,
                        'post_liked' AS type,
                        'reaction' AS category,
                        actors.id AS user_id,
                        actors.username,
                        actors.email,
                        actors.avatar_url,
                        NULL AS subject,
                        NULL AS subject_th,
                        events.created_at AS occurred_at
                    "),
            )
            ->unionAll(
                DB::table('comment_likes as events')
                    ->join('users as actors', 'actors.id', '=', 'events.user_id')
                    ->selectRaw("
                        events.id AS event_id,
                        'comment_liked' AS type,
                        'reaction' AS category,
                        actors.id AS user_id,
                        actors.username,
                        actors.email,
                        actors.avatar_url,
                        NULL AS subject,
                        NULL AS subject_th,
                        events.created_at AS occurred_at
                    "),
            )
            ->unionAll(
                DB::table('item_usages as events')
                    ->join('users as actors', 'actors.id', '=', 'events.user_id')
                    ->leftJoin('items', 'items.id', '=', 'events.item_id')
                    ->selectRaw("
                        events.id AS event_id,
                        'item_used' AS type,
                        'inventory' AS category,
                        actors.id AS user_id,
                        actors.username,
                        actors.email,
                        actors.avatar_url,
                        items.name AS subject,
                        items.name AS subject_th,
                        events.created_at AS occurred_at
                    "),
            )
            ->unionAll(
                DB::table('wallet_transactions as events')
                    ->join('users as actors', 'actors.id', '=', 'events.user_id')
                    ->where('events.type', 'spend')
                    ->selectRaw("
                        events.id AS event_id,
                        'shop_purchase' AS type,
                        'inventory' AS category,
                        actors.id AS user_id,
                        actors.username,
                        actors.email,
                        actors.avatar_url,
                        events.reference_type AS subject,
                        events.reference_type AS subject_th,
                        events.created_at AS occurred_at
                    "),
            );

        return DB::query()
            ->fromSub($activity, 'user_activity')
            ->latest('occurred_at')
            ->latest('event_id')
            ->limit(60)
            ->get()
            ->map(static fn (object $event): array => [
                'id' => "{$event->type}:{$event->event_id}",
                'type' => $event->type,
                'category' => $event->category,
                'subject' => $event->subject,
                'subject_th' => $event->subject_th,
                'occurred_at' => $event->occurred_at,
                'user' => [
                    'id' => $event->user_id,
                    'username' => $event->username,
                    'email' => $event->email,
                    'avatar_url' => $event->avatar_url,
                ],
            ])
            ->all();
    }

    private function trend(array $selection): array
    {
        /** @var CarbonImmutable $start */
        $start = $selection['start'];
        /** @var CarbonImmutable $end */
        $end = $selection['end'];
        $unit = $selection['unit'];
        $activity = DB::table('users')
            ->selectRaw("'users' AS source, created_at")
            ->where('created_at', '>=', $start)
            ->where('created_at', '<', $end)
            ->unionAll(DB::table('simulators')->selectRaw("'simulations' AS source, created_at")->where('created_at', '>=', $start)->where('created_at', '<', $end))
            ->unionAll(DB::table('posts')->selectRaw("'posts' AS source, created_at")->where('created_at', '>=', $start)->where('created_at', '<', $end))
            ->unionAll(DB::table('plant_histories')->selectRaw("'harvests' AS source, created_at")->where('created_at', '>=', $start)->where('created_at', '<', $end));

        $bucketExpression = $this->trendBucketExpression($unit);

        $series = DB::query()
            ->fromSub($activity, 'activity')
            ->selectRaw("source, {$bucketExpression} AS trend_bucket, COUNT(*) AS aggregate")
            ->groupBy('source', 'trend_bucket')
            ->get()
            ->groupBy('source')
            ->map(static fn ($rows) => $rows->pluck('aggregate', 'trend_bucket'));

        $points = match ($unit) {
            'hour' => collect(range(0, 23))->map(fn (int $hour): array => [
                'at' => $start->addHours($hour),
                'key' => $start->addHours($hour)->format('Y-m-d H'),
                'label' => $start->addHours($hour)->format('H:00'),
            ])->all(),
            'month' => collect(range(0, 11))->map(fn (int $month): array => [
                'at' => $start->addMonths($month),
                'key' => $start->addMonths($month)->format('Y-m'),
                'label' => $start->addMonths($month)->format('M'),
            ])->all(),
            default => collect(range(0, $start->diffInDays($end) - 1))->map(fn (int $day): array => [
                'at' => $start->addDays($day),
                'key' => $start->addDays($day)->format('Y-m-d'),
                'label' => $selection['period'] === 'range' && $selection['days'] === 7
                    ? $start->addDays($day)->format('D')
                    : $start->addDays($day)->format('j M'),
            ])->all(),
        };

        return collect($points)->map(function (array $point) use ($series): array {
            /** @var CarbonImmutable $date */
            $date = $point['at'];
            $key = $point['key'];
            return [
                'date' => $date->toIso8601String(),
                'label' => $point['label'],
                'users' => (int) ($series->get('users', collect())[$key] ?? 0),
                'simulations' => (int) ($series->get('simulations', collect())[$key] ?? 0),
                'posts' => (int) ($series->get('posts', collect())[$key] ?? 0),
                'harvests' => (int) ($series->get('harvests', collect())[$key] ?? 0),
            ];
        })->all();
    }

    private function trendBucketExpression(string $unit): string
    {
        $driver = DB::connection()->getDriverName();

        if ($driver === 'pgsql') {
            return match ($unit) {
                'hour' => "TO_CHAR(created_at, 'YYYY-MM-DD HH24')",
                'month' => "TO_CHAR(created_at, 'YYYY-MM')",
                default => "TO_CHAR(created_at, 'YYYY-MM-DD')",
            };
        }

        if ($driver === 'mysql') {
            return match ($unit) {
                'hour' => "DATE_FORMAT(created_at, '%Y-%m-%d %H')",
                'month' => "DATE_FORMAT(created_at, '%Y-%m')",
                default => "DATE_FORMAT(created_at, '%Y-%m-%d')",
            };
        }

        return match ($unit) {
            'hour' => "STRFTIME('%Y-%m-%d %H', created_at)",
            'month' => "STRFTIME('%Y-%m', created_at)",
            default => "STRFTIME('%Y-%m-%d', created_at)",
        };
    }
}
