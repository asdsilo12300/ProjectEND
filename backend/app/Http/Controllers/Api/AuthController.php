<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\JwtService;
use App\Services\MediaStorage;
use App\Services\StarterInventoryService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AuthController extends Controller
{
    public function __construct(
        private readonly JwtService $jwt,
        private readonly MediaStorage $media,
        private readonly StarterInventoryService $starterInventory,
    ) {}

    public function register(Request $request): JsonResponse
    {
        $this->normalizeEmailInput($request);

        $data = $request->validate([
            'username' => ['required', 'string', 'max:80', 'unique:users,username'],
            'email' => ['required', 'email', 'max:191', $this->uniqueEmailIgnoringCase()],
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

            $this->starterInventory->grant($user);

            return $user;
        });

        return response()->json([
            'token' => $this->jwt->issue($user),
            'user' => $this->userPayload($user),
        ], 201);
    }

    public function login(Request $request): JsonResponse
    {
        $this->normalizeEmailInput($request);

        $data = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::query()
            ->whereRaw('LOWER(email) = ?', [$data['email']])
            ->first();

        if (! $user || ! Hash::check($data['password'], $user->password)) {
            throw ValidationException::withMessages([
                'email' => ['The provided credentials are incorrect.'],
            ]);
        }

        $user->forceFill(['last_login_at' => now()])->save();

        return response()->json([
            'token' => $this->jwt->issue($user),
            'user' => $this->userPayload($user),
        ]);
    }

    public function me(Request $request): JsonResponse
    {
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
            $this->media->deleteFromReference($avatarUrl);

            $path = $this->media->storeUploadedFile($request->file('avatar'), 'profile-avatars');
            $avatarUrl = $this->media->publicUrl($path);
        }

        if ($request->hasFile('cover')) {
            $this->media->deleteFromReference($coverUrl);

            $path = $this->media->storeUploadedFile($request->file('cover'), 'profile-covers');
            $coverUrl = $this->media->publicUrl($path);
        }

        $user->forceFill([
            'username' => $data['username'],
            'bio' => $data['bio'] ?? null,
            'avatar_url' => $avatarUrl,
            'cover_url' => $coverUrl,
        ])->save();

        return response()->json(['data' => $this->userPayload($user->fresh())]);
    }

    public function updateOnboarding(Request $request): JsonResponse
    {
        $data = $request->validate([
            'page' => ['required', 'string', Rule::in(['lab', 'lab-items', 'lab-friends', 'navigation', 'shop', 'history', 'community', 'settings'])],
            'version' => ['required', 'integer', 'min:1', 'max:1000'],
            'state' => ['required', 'string', Rule::in(['completed', 'dismissed'])],
        ]);

        $user = $request->user();
        $progress = is_array($user->onboarding_progress) ? $user->onboarding_progress : [];
        $progress[$data['page']] = [
            'version' => (int) $data['version'],
            'state' => $data['state'],
            'updated_at' => now()->toIso8601String(),
        ];

        $user->forceFill(['onboarding_progress' => $progress])->save();

        return response()->json([
            'data' => [
                'onboarding_progress' => $progress,
            ],
        ]);
    }

    private function normalizeEmailInput(Request $request): void
    {
        $email = $request->input('email');

        if (is_string($email)) {
            $request->merge(['email' => mb_strtolower(trim($email))]);
        }
    }

    private function uniqueEmailIgnoringCase(): \Closure
    {
        return function (string $attribute, mixed $value, \Closure $fail): void {
            if (User::query()->whereRaw('LOWER(email) = ?', [(string) $value])->exists()) {
                $fail('The email has already been taken.');
            }
        };
    }

    private function userPayload(User $user): array
    {
        $user->loadCount([
            'plantHistories',
            'requestedFriendships as accepted_requested_friendships_count' => fn ($query) => $query->where('status', 'accepted'),
            'receivedFriendships as accepted_received_friendships_count' => fn ($query) => $query->where('status', 'accepted'),
        ]);

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
            'friends_count' => (int) $user->accepted_requested_friendships_count
                + (int) $user->accepted_received_friendships_count,
            'plant_histories_count' => (int) $user->plant_histories_count,
            'plants_count' => (int) $user->plant_histories_count,
            'coin' => $user->coin,
            'gem' => $user->gem,
            'status' => $user->status,
            'onboarding_progress' => $user->onboarding_progress ?? [],
        ];
    }

}
