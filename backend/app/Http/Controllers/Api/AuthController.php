<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Friendship;
use App\Models\Item;
use App\Models\User;
use App\Models\UserItem;
use App\Services\JwtService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function __construct(private readonly JwtService $jwt)
    {
    }

    public function register(Request $request): JsonResponse
    {
        $data = $request->validate([
            'username' => ['required', 'string', 'max:80', 'unique:users,username'],
            'email' => ['required', 'email', 'max:191', 'unique:users,email'],
            'password' => ['required', 'string', 'min:8', 'confirmed'],
            'password_confirmation' => ['required', 'string'],
        ]);

        $user = DB::transaction(function () use ($data): User {
            $user = User::query()->create([
                'username' => $data['username'],
                'email' => $data['email'],
                'password' => Hash::make($data['password']),
                'role' => 'member',
                'status' => 'active',
            ]);

            $this->grantStarterItems($user);

            return $user;
        });

        return response()->json([
            'token' => $this->jwt->issue($user),
            'user' => $this->userPayload($user),
        ], 201);
    }

    public function login(Request $request): JsonResponse
    {
        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::query()->where('email', $data['email'])->first();

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        $user->forceFill(['last_login_at' => now()])->save();
        $this->grantStarterItems($user);

        return response()->json([
            'token' => $this->jwt->issue($user),
            'user' => $this->userPayload($user),
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        $this->grantStarterItems($request->user());

        return response()->json(['data' => $this->userPayload($request->user())]);
    }

    public function updateProfile(Request $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'username' => ['required', 'string', 'max:80', Rule::unique('users', 'username')->ignore($user->id)],
            'bio' => ['nullable', 'string', 'max:500'],
            'avatar' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:2048'],
            'cover' => ['nullable', 'image', 'mimes:jpg,jpeg,png,webp', 'max:4096'],
        ]);

        $avatarUrl = $user->avatar_url;
        $coverUrl = $user->cover_url;

        if ($request->hasFile('avatar')) {
            if ($avatarUrl && str_starts_with($avatarUrl, '/storage/profile-avatars/')) {
                Storage::disk('public')->delete(str_replace('/storage/', '', $avatarUrl));
            }

            $path = $request->file('avatar')->store('profile-avatars', 'public');
            $avatarUrl = Storage::url($path);
        }

        if ($request->hasFile('cover')) {
            if ($coverUrl && str_starts_with($coverUrl, '/storage/profile-covers/')) {
                Storage::disk('public')->delete(str_replace('/storage/', '', $coverUrl));
            }

            $path = $request->file('cover')->store('profile-covers', 'public');
            $coverUrl = Storage::url($path);
        }

        $user->forceFill([
            'username' => $data['username'],
            'bio' => $data['bio'] ?? null,
            'avatar_url' => $avatarUrl,
            'cover_url' => $coverUrl,
        ])->save();

        return response()->json(['data' => $this->userPayload($user->fresh())]);
    }

    private function grantStarterItems(User $user): void
    {
        $starterQuantities = [
            'Hand Pick' => 10,
            'Insect Spray' => 7,
            'Snail Spray' => 7,
            'Fungus Spray' => 7,
        ];

        Item::query()
            ->where('is_active', true)
            ->whereIn('name', array_keys($starterQuantities))
            ->get()
            ->each(function (Item $item) use ($starterQuantities, $user): void {
                $inventory = UserItem::query()->firstOrNew([
                    'user_id' => $user->id,
                    'item_id' => $item->id,
                ]);

                $inventory->quantity = max($starterQuantities[$item->name] ?? 0, (int) ($inventory->quantity ?? 0));
                $inventory->save();
            });
    }
    private function userPayload(User $user): array
    {
        return [
            'id' => $user->id,
            'username' => $user->username,
            'email' => $user->email,
            'avatar_url' => $user->avatar_url,
            'cover_url' => $user->cover_url,
            'bio' => $user->bio,
            'role' => $user->role,
            'level' => $user->level,
            'experience' => $user->experience,
            'level_progress' => $user->levelProgress(),
            'friends_count' => $this->acceptedFriendsCount($user),
            'plant_histories_count' => $user->plantHistories()->count(),
            'plants_count' => $user->plantHistories()->count(),
            'coin' => $user->coin,
            'gem' => $user->gem,
            'status' => $user->status,
        ];
    }

    private function acceptedFriendsCount(User $user): int
    {
        return Friendship::query()
            ->where('status', 'accepted')
            ->where(function ($query) use ($user): void {
                $query
                    ->where('requester_id', $user->id)
                    ->orWhere('addressee_id', $user->id);
            })
            ->count();
    }
}
