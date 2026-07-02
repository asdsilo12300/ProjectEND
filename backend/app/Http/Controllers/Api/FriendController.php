<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\SimulatorResource;
use App\Models\Friendship;
use App\Models\Simulator;
use App\Models\User;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class FriendController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $friendships = Friendship::query()
            ->with(['requester', 'addressee'])
            ->where('requester_id', $user->id)
            ->orWhere('addressee_id', $user->id)
            ->latest()
            ->get()
            ->map(fn (Friendship $friendship) => $this->friendPayload($friendship, $user->id))
            ->values();

        return response()->json([
            'data' => $friendships,
            'meta' => [
                'total' => $friendships->count(),
                'active_now' => $friendships->where('presence', 'online')->count(),
            ],
        ]);
    }

    public function search(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = trim((string) $request->query('q', ''));

        if ($query === '') {
            return response()->json(['data' => []]);
        }

        $existing = Friendship::query()
            ->where('requester_id', $user->id)
            ->orWhere('addressee_id', $user->id)
            ->get()
            ->flatMap(fn (Friendship $friendship) => [$friendship->requester_id, $friendship->addressee_id])
            ->unique()
            ->values()
            ->all();

        $results = User::query()
            ->where('id', '<>', $user->id)
            ->where(function ($builder) use ($query): void {
                $builder
                    ->where('username', 'like', "%{$query}%")
                    ->orWhere('email', 'like', "%{$query}%");
            })
            ->limit(8)
            ->get()
            ->map(fn (User $result) => $this->userPayload($result, in_array($result->id, $existing, true) ? 'connected' : 'none'))
            ->values();

        return response()->json(['data' => $results]);
    }

    public function invite(Request $request): JsonResponse
    {
        $user = $request->user();
        $data = $request->validate([
            'user_id' => ['required', 'integer', 'exists:users,id'],
        ]);

        $targetId = (int) $data['user_id'];

        if ($targetId === $user->id) {
            throw ValidationException::withMessages([
                'user_id' => ['You cannot invite yourself.'],
            ]);
        }

        $reverse = Friendship::query()
            ->where('requester_id', $targetId)
            ->where('addressee_id', $user->id)
            ->first();

        if ($reverse) {
            if ($reverse->status === 'pending') {
                $reverse->forceFill(['status' => 'accepted', 'accepted_at' => now()])->save();
            }

            return response()->json(['data' => $this->friendPayload($reverse->fresh(['requester', 'addressee']), $user->id)]);
        }

        $friendship = Friendship::query()->firstOrCreate(
            ['requester_id' => $user->id, 'addressee_id' => $targetId],
            ['status' => 'pending']
        );

        return response()->json(['data' => $this->friendPayload($friendship->fresh(['requester', 'addressee']), $user->id)], 201);
    }

    public function accept(Request $request, Friendship $friendship): JsonResponse
    {
        $user = $request->user();

        if ($friendship->addressee_id !== $user->id || $friendship->status !== 'pending') {
            throw ValidationException::withMessages([
                'friendship' => ['This friend request cannot be accepted.'],
            ]);
        }

        $friendship->forceFill([
            'status' => 'accepted',
            'accepted_at' => now(),
        ])->save();

        return response()->json([
            'data' => $this->friendPayload($friendship->fresh(['requester', 'addressee']), $user->id),
        ]);
    }


    public function destroy(Request $request, Friendship $friendship): JsonResponse
    {
        $user = $request->user();
        $isParticipant = $friendship->requester_id === $user->id || $friendship->addressee_id === $user->id;

        abort_unless($isParticipant, 403);

        $friendship->delete();

        return response()->json(['message' => 'Friend removed.']);
    }

    public function latestSimulator(Request $request, Friendship $friendship)
    {
        $user = $request->user();
        $isParticipant = $friendship->requester_id === $user->id || $friendship->addressee_id === $user->id;

        abort_unless($isParticipant && $friendship->status === 'accepted', 403);

        $friendId = $friendship->requester_id === $user->id ? $friendship->addressee_id : $friendship->requester_id;
        $simulator = $this->latestSimulatorForUser($friendId);

        if (! $simulator) {
            return response()->json(['data' => null]);
        }

        return new SimulatorResource($simulator);
    }
    private function friendPayload(Friendship $friendship, int $currentUserId): array
    {
        $other = $friendship->requester_id === $currentUserId ? $friendship->addressee : $friendship->requester;
        $direction = $friendship->requester_id === $currentUserId ? 'outgoing' : 'incoming';

        return [
            'id' => $friendship->id,
            'status' => $friendship->status,
            'direction' => $direction,
            'presence' => $this->presence($other),
            'user' => $this->userPayload($other),
            'latest_simulator' => $friendship->status === 'accepted'
                ? $this->latestSimulatorPayload($other->id)
                : null,
        ];
    }

    private function latestSimulatorForUser(int $userId): ?Simulator
    {
        return Simulator::query()
            ->with(['plant.stages', 'currentStage', 'visualVariant', 'activePests.pest.conditionRules'])
            ->where('user_id', $userId)
            ->whereNull('deleted_at')
            ->orderByRaw("CASE WHEN status = 'active' THEN 0 ELSE 1 END")
            ->latest('updated_at')
            ->latest('id')
            ->first();
    }

    private function latestSimulatorPayload(int $userId): ?array
    {
        $simulator = $this->latestSimulatorForUser($userId);

        return $simulator ? (new SimulatorResource($simulator))->resolve() : null;
    }

    private function userPayload(User $user, string $friendshipStatus = 'none'): array
    {
        return [
            'id' => $user->id,
            'username' => $user->username,
            'email' => $user->email,
            'avatar_url' => $user->avatar_url,
            'role' => $user->role,
            'level' => $user->level,
            'presence' => $this->presence($user),
            'friendship_status' => $friendshipStatus,
        ];
    }

    private function presence(User $user): string
    {
        return $user->last_login_at && $user->last_login_at->greaterThan(now()->subMinutes(15)) ? 'online' : 'offline';
    }
}


