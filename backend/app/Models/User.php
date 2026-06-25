<?php

namespace App\Models;

use Database\Factories\UserFactory;
use Illuminate\Database\Eloquent\Attributes\Hidden;
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
        'password',
        'avatar_url',
        'role',
        'level',
        'experience',
        'coin',
        'gem',
        'status',
        'last_login_at',
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
        ];
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
}
