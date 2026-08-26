<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Http\Resources\SimulatorResource;
use App\Models\Friendship;
use App\Models\Simulator;
use App\Models\User;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Validation\ValidationException;

class FriendController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = $request->user();

        $friendships = Friendship::query()
            ->with([
                'requester' => fn ($query) => $this->withProfileCounts($query),
                'addressee' => fn ($query) => $this->withProfileCounts($query),
            ])
            ->where('requester_id', $user->id)
            ->orWhere('addressee_id', $user->id)
            ->latest()
            ->get();

        $friendUserIds = $friendships
            ->where('status', 'accepted')
            ->map(fn (Friendship $friendship) => $this->otherUserId($friendship, (int) $user->id))
            ->unique()
            ->values();

        $sharedSimulators = $friendUserIds->isEmpty()
            ? collect()
            : Simulator::query()
                ->with(['user', 'plant.stages', 'currentStage', 'visualVariant', 'activePests.pest.conditionRules'])
                ->whereIn('user_id', $friendUserIds)
                ->whereNull('deleted_at')
                ->where('status', 'active')
                ->whereHas('plant', fn ($query) => $query->whereNull('plants.deleted_at'))
                ->latest('updated_at')
                ->latest('id')
                ->get();
        $simulatorsByUser = $sharedSimulators->groupBy('user_id');
        $latestSimulators = $simulatorsByUser->map(fn (Collection $simulators) => $simulators->first());

        $friendships = $friendships
            ->map(fn (Friendship $friendship) => $this->friendPayload(
                $friendship,
                (int) $user->id,
                $latestSimulators,
                $simulatorsByUser,
            ))
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

        $results = $this->withProfileCounts(User::query())
            ->where('id', '<>', $user->id)
            ->where(function ($builder) use ($query): void {
                $builder
                    ->whereLike('username', "%{$query}%", caseSensitive: false)
                    ->orWhereLike('email', "%{$query}%", caseSensitive: false);
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
    private function friendPayload(
        Friendship $friendship,
        int $currentUserId,
        ?Collection $latestSimulators = null,
        ?Collection $simulatorsByUser = null,
    ): array
    {
        $isRequester = (int) $friendship->requester_id === $currentUserId;
        $other = $isRequester ? $friendship->addressee : $friendship->requester;
        $direction = $isRequester ? 'outgoing' : 'incoming';

        return [
            'id' => $friendship->id,
            'status' => $friendship->status,
            'direction' => $direction,
            'presence' => $this->presence($other),
            'user' => $this->userPayload($other),
            'latest_simulator' => $friendship->status === 'accepted'
                ? ($latestSimulators === null
                    ? $this->latestSimulatorPayload($other->id)
                    : $this->simulatorPayload($latestSimulators->get($other->id)))
                : null,
            'planted_simulators' => $friendship->status === 'accepted'
                ? ($simulatorsByUser?->get($other->id, collect()) ?? collect())
                    ->map(fn (Simulator $simulator) => $this->simulatorSummaryPayload($simulator))
                    ->values()
                    ->all()
                : [],
        ];
    }

    private function latestSimulatorForUser(int $userId): ?Simulator
    {
        return Simulator::query()
            ->with(['user', 'plant.stages', 'currentStage', 'visualVariant', 'activePests.pest.conditionRules'])
            ->where('user_id', $userId)
            ->whereNull('deleted_at')
            ->where('status', 'active')
            ->whereHas('plant', fn ($query) => $query->whereNull('plants.deleted_at'))
            ->latest('updated_at')
            ->latest('id')
            ->first();
    }

    private function latestSimulatorPayload(int $userId): ?array
    {
        return $this->simulatorPayload($this->latestSimulatorForUser($userId));
    }

    private function userPayload(User $user, string $friendshipStatus = 'none'): array
    {
        if (! array_key_exists('plant_histories_count', $user->getAttributes())) {
            $user->loadCount($this->profileCounts());
        }

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
            'presence' => $this->presence($user),
            'friendship_status' => $friendshipStatus,
        ];
    }

    private function withProfileCounts($query)
    {
        return $query->withCount($this->profileCounts());
    }

    private function profileCounts(): array
    {
        return [
            'plantHistories',
            'requestedFriendships as accepted_requested_friendships_count' => fn (Builder $query) => $query->where('status', 'accepted'),
            'receivedFriendships as accepted_received_friendships_count' => fn (Builder $query) => $query->where('status', 'accepted'),
        ];
    }

    private function otherUserId(Friendship $friendship, int $currentUserId): int
    {
        return (int) ((int) $friendship->requester_id === $currentUserId
            ? $friendship->addressee_id
            : $friendship->requester_id);
    }

    private function simulatorPayload(?Simulator $simulator): ?array
    {
        return $simulator ? (new SimulatorResource($simulator))->resolve() : null;
    }

    private function simulatorSummaryPayload(Simulator $simulator): array
    {
        return [
            'id' => $simulator->id,
            'plant_id' => $simulator->plant_id,
            'mode' => $simulator->mode,
            'status' => $simulator->status,
            'share_visibility' => $simulator->share_visibility,
            'updated_at' => $simulator->updated_at?->toISOString(),
            'plant' => $simulator->plant ? [
                'id' => $simulator->plant->id,
                'name_th' => $simulator->plant->name_th,
                'name_en' => $simulator->plant->name_en,
                'base_image_url' => $simulator->plant->base_image_url,
            ] : null,
        ];
    }

    private function presence(User $user): string
    {
        return $user->last_login_at && $user->last_login_at->greaterThan(now()->subMinutes(15)) ? 'online' : 'offline';
    }
}


