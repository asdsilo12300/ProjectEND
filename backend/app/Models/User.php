<?php

namespace App\Models;

use App\Services\MediaStorage;
use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Hidden;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Foundation\Auth\User as Authenticatable;
use Illuminate\Notifications\Notifiable;

#[Hidden(['password', 'remember_token'])]
class User extends Authenticatable
{
    /** @use HasFactory<UserFactory> */
    use HasFactory, Notifiable;

    protected $fillable = [
        'username',
        'email',
        'google_id',
        'email_verified_at',
        'password',
        'avatar_url',
        'cover_url',
        'bio',
        'role',
        'level',
        'experience',
        'coin',
        'gem',
        'status',
        'last_login_at',
        'onboarding_progress',
    ];

    /**
     * Get the attributes that should be cast.
     *
     * @return array<string, string>
     */
    protected function casts(): array
    {
        return [
            'email_verified_at' => 'datetime',
            'last_login_at' => 'datetime',
            'password' => 'hashed',
            'level' => 'integer',
            'experience' => 'integer',
            'coin' => 'integer',
            'gem' => 'integer',
            'onboarding_progress' => 'array',
        ];
    }

    protected function avatarUrl(): Attribute
    {
        return Attribute::get(
            fn (?string $value): ?string => app(MediaStorage::class)->normalizeReference($value),
        );
    }

    protected function coverUrl(): Attribute
    {
        return Attribute::get(
            fn (?string $value): ?string => app(MediaStorage::class)->normalizeReference($value),
        );
    }

    public function simulators(): HasMany
    {
        return $this->hasMany(Simulator::class);
    }

    public function plantHistories(): HasMany
    {
        return $this->hasMany(PlantHistory::class);
    }

    public function userItems(): HasMany
    {
        return $this->hasMany(UserItem::class);
    }

    public function socialNotifications(): HasMany
    {
        return $this->hasMany(SocialNotification::class, 'recipient_id');
    }

    public function emailVerifications(): HasMany
    {
        return $this->hasMany(EmailVerification::class);
    }

    public function requestedFriendships(): HasMany
    {
        return $this->hasMany(Friendship::class, 'requester_id');
    }

    public function receivedFriendships(): HasMany
    {
        return $this->hasMany(Friendship::class, 'addressee_id');
    }

    public function experienceRequiredForNextLevel(?int $level = null): int
    {
        $currentLevel = max(1, $level ?? (int) ($this->level ?? 1));

        return 100 + (($currentLevel - 1) * 50);
    }

    /**
     * Add experience to the current level bucket. When a level is completed,
     * experience rolls over into the next level instead of being discarded.
     *
     * @return array<string, int|bool>
     */
    public function addExperience(int $amount): array
    {
        $startingLevel = max(1, (int) ($this->level ?? 1));
        $level = $startingLevel;
        $experience = max(0, (int) ($this->experience ?? 0)) + max(0, $amount);

        while ($experience >= $this->experienceRequiredForNextLevel($level)) {
            $experience -= $this->experienceRequiredForNextLevel($level);
            $level++;
        }

        $this->forceFill([
            'level' => $level,
            'experience' => $experience,
        ])->save();

        return [
            'amount' => max(0, $amount),
            'level' => $level,
            'experience' => $experience,
            'next_level_experience' => $this->experienceRequiredForNextLevel($level),
            'leveled_up' => $level > $startingLevel,
        ];
    }

    /**
     * @return array<string, int|float>
     */
    public function levelProgress(): array
    {
        $level = max(1, (int) ($this->level ?? 1));
        $experience = max(0, (int) ($this->experience ?? 0));
        $required = $this->experienceRequiredForNextLevel($level);

        return [
            'level' => $level,
            'experience' => $experience,
            'next_level_experience' => $required,
            'percent' => $required > 0 ? round(min(100, ($experience / $required) * 100), 1) : 0,
        ];
    }
}
