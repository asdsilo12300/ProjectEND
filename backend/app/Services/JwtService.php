<?php

namespace App\Services;

use App\Models\User;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Illuminate\Support\Carbon;
use RuntimeException;

class JwtService
{
    public function issue(User $user): string
    {
        $now = Carbon::now();

        return JWT::encode([
            'iss' => config('app.url'),
            'sub' => $user->id,
            'iat' => $now->timestamp,
            'exp' => $now->copy()->addDays(7)->timestamp,
        ], $this->secret(), 'HS256');
    }

    public function userIdFromToken(string $token): int
    {
        $payload = JWT::decode($token, new Key($this->secret(), 'HS256'));

        return (int) $payload->sub;
    }

    private function secret(): string
    {
        $secret = (string) env('JWT_SECRET', config('app.key'));

        if ($secret === '') {
            throw new RuntimeException('JWT_SECRET is not configured.');
        }

        return $secret;
    }
}
