<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AdminActivityLog;
use App\Models\User;
use App\Services\AdminDataCache;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Pagination\LengthAwarePaginator;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AdminUserController extends Controller
{
    private const USERS_PER_PAGE = 15;

    public function __construct(private readonly AdminDataCache $cache) {}

    public function index(Request $request): JsonResponse
    {
        $search = trim((string) $request->query('search', ''));
        $role = trim((string) $request->query('role', ''));
        $page = max(1, (int) $request->query('page', 1));

        $payload = $this->cache->rememberUsers(compact('search', 'role', 'page'), function () use ($request, $search, $role, $page): array {
            $columns = ['id', 'username', 'email', 'avatar_url', 'role', 'status', 'level', 'coin', 'last_login_at', 'created_at'];
            $query = User::query()
                ->select($columns)
                ->selectRaw('COUNT(*) OVER() AS admin_total_count')
                ->withCount(['simulators', 'plantHistories'])
                ->when($search !== '', function ($query) use ($search): void {
                    $like = "%{$search}%";
                    $query->where(fn ($nested) => $nested
                        ->whereLike('username', $like, caseSensitive: false)
                        ->orWhereLike('email', $like, caseSensitive: false));
                })
                ->when($role !== '', fn ($query) => $query->where('role', $role))
                ->orderBy('created_at')
                ->orderBy('id')
                ->forPage($page, self::USERS_PER_PAGE);

            $users = $query->get();
            $total = (int) ($users->first()?->admin_total_count ?? 0);
            $users->each(static fn (User $user) => $user->makeHidden('admin_total_count'));

            return (new LengthAwarePaginator(
                $users,
                $total,
                self::USERS_PER_PAGE,
                $page,
                ['path' => $request->url(), 'query' => $request->query()],
            ))->toArray();
        });

        return response()->json($payload);
    }

    public function update(Request $request, User $user): JsonResponse
    {
        $data = $request->validate([
            'role' => ['required', Rule::in(['member', 'admin'])],
            'status' => ['required', Rule::in(['active', 'suspended'])],
        ]);

        if ($request->user()->is($user) && ($data['role'] !== 'admin' || $data['status'] !== 'active')) {
            throw ValidationException::withMessages(['user' => 'You cannot remove your own administrator access.']);
        }

        if ($user->role === 'admin' && $data['role'] !== 'admin' && User::query()->where('role', 'admin')->count() <= 1) {
            throw ValidationException::withMessages(['role' => 'At least one administrator must remain.']);
        }

        $before = $user->only(['role', 'status']);
        $user->forceFill($data)->save();
        AdminActivityLog::record($request->user(), 'updated_access', 'users', $user->id, ['before' => $before, 'after' => $data]);

        return response()->json(['data' => $user->fresh()]);
    }
}
