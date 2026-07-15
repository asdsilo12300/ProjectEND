<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AdminActivityLog;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AdminUserController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $users = User::query()
            ->withCount(['simulators', 'plantHistories'])
            ->when($request->string('search')->trim()->isNotEmpty(), function ($query) use ($request): void {
                $search = '%'.$request->string('search')->trim().'%';
                $query->where(fn ($nested) => $nested
                    ->where('username', 'like', $search)
                    ->orWhere('email', 'like', $search));
            })
            ->when($request->filled('role'), fn ($query) => $query->where('role', $request->string('role')))
            ->orderBy('created_at')
            ->orderBy('id')
            ->paginate(15, ['id', 'username', 'email', 'avatar_url', 'role', 'status', 'level', 'coin', 'last_login_at', 'created_at']);

        return response()->json($users);
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
