<?php

namespace App\Http\Middleware;

use App\Models\User;
use App\Services\JwtService;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class JwtAuthenticate
{
    public function __construct(private readonly JwtService $jwt)
    {
    }

    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->bearerToken();

        if (! $token) {
            return response()->json(['message' => 'Missing bearer token.'], 401);
        }

        try {
            $user = User::query()->findOrFail($this->jwt->userIdFromToken($token));
        } catch (Throwable) {
            return response()->json(['message' => 'Invalid or expired token.'], 401);
        }

        if ($user->status !== 'active') {
            return response()->json(['message' => 'This account is not active.'], 403);
        }

        $request->setUserResolver(fn () => $user);

        return $next($request);
    }
}
