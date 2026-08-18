<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\MediaStorage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AuthController extends Controller
{
    public function __construct(
        private readonly MediaStorage $media,
    ) {}

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
            $avatarUrl = $this->media->reference($path);
        }

        if ($request->hasFile('cover')) {
            $this->media->deleteFromReference($coverUrl);

            $path = $this->media->storeUploadedFile($request->file('cover'), 'profile-covers');
            $coverUrl = $this->media->reference($path);
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
            'email_verified_at' => $user->email_verified_at?->toIso8601String(),
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
