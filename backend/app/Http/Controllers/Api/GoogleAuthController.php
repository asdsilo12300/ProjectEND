<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\GoogleAvatarService;
use App\Services\JwtService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Str;
use RuntimeException;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

class GoogleAuthController extends Controller
{
    private const MESSAGE_TYPE = 'plant-growth-google-auth';

    public function __construct(
        private readonly JwtService $jwt,
        private readonly GoogleAvatarService $googleAvatars,
    ) {
    }

    public function redirect(): RedirectResponse|Response
    {
        $clientId = trim((string) config('services.google.client_id'));
        $clientSecret = trim((string) config('services.google.client_secret'));

        if ($clientId === '' || $clientSecret === '') {
            return $this->callbackPage([
                'type' => self::MESSAGE_TYPE,
                'error' => 'Google login is not configured yet. Add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to backend/.env.',
            ]);
        }

        $state = Str::random(64);
        $verifier = $this->base64UrlEncode(random_bytes(64));
        $challenge = $this->base64UrlEncode(hash('sha256', $verifier, true));

        Cache::put($this->stateCacheKey($state), [
            'code_verifier' => $verifier,
        ], now()->addMinutes(10));

        $query = http_build_query([
            'client_id' => $clientId,
            'redirect_uri' => config('services.google.redirect'),
            'response_type' => 'code',
            'scope' => 'openid email profile',
            'state' => $state,
            'code_challenge' => $challenge,
            'code_challenge_method' => 'S256',
            'prompt' => 'select_account',
        ], '', '&', PHP_QUERY_RFC3986);

        return redirect()->away('https://accounts.google.com/o/oauth2/v2/auth?'.$query);
    }

    public function callback(Request $request): Response
    {
        $state = (string) $request->query('state', '');
        $stateData = $state !== '' ? Cache::pull($this->stateCacheKey($state)) : null;

        if (! is_array($stateData) || empty($stateData['code_verifier'])) {
            return $this->callbackPage([
                'type' => self::MESSAGE_TYPE,
                'error' => 'The Google sign-in request expired or was invalid. Please try again.',
            ]);
        }

        if ($request->filled('error')) {
            return $this->callbackPage([
                'type' => self::MESSAGE_TYPE,
                'error' => $request->query('error') === 'access_denied'
                    ? 'Google sign-in was cancelled.'
                    : 'Google could not complete sign-in. Please try again.',
            ]);
        }

        if (! $request->filled('code')) {
            return $this->callbackPage([
                'type' => self::MESSAGE_TYPE,
                'error' => 'The Google sign-in request expired or was invalid. Please try again.',
            ]);
        }

        try {
            $tokenResponse = Http::asForm()
                ->acceptJson()
                ->timeout($this->timeout())
                ->post('https://oauth2.googleapis.com/token', [
                    'client_id' => config('services.google.client_id'),
                    'client_secret' => config('services.google.client_secret'),
                    'code' => (string) $request->query('code'),
                    'code_verifier' => $stateData['code_verifier'],
                    'grant_type' => 'authorization_code',
                    'redirect_uri' => config('services.google.redirect'),
                ])
                ->throw()
                ->json();

            $accessToken = (string) ($tokenResponse['access_token'] ?? '');

            if ($accessToken === '') {
                throw new RuntimeException('Google did not return an access token.');
            }

            $profile = Http::withToken($accessToken)
                ->acceptJson()
                ->timeout($this->timeout())
                ->get('https://openidconnect.googleapis.com/v1/userinfo')
                ->throw()
                ->json();

            $localAvatarUrl = $this->googleAvatars->cache(
                (string) ($profile['sub'] ?? ''),
                (string) ($profile['picture'] ?? ''),
            );
            $user = $this->findOrCreateUser($profile, $localAvatarUrl);
            $user->forceFill(['last_login_at' => now()])->save();

            return $this->callbackPage([
                'type' => self::MESSAGE_TYPE,
                'token' => $this->jwt->issue($user),
            ]);
        } catch (Throwable $error) {
            Log::warning('Google OAuth callback failed.', [
                'exception' => $error::class,
                'message' => $error->getMessage(),
            ]);

            return $this->callbackPage([
                'type' => self::MESSAGE_TYPE,
                'error' => $error instanceof RuntimeException && str_starts_with($error->getMessage(), 'This email')
                    ? $error->getMessage()
                    : 'Unable to sign in with Google right now. Please try again.',
            ]);
        }
    }

    /**
     * @param array<string, mixed> $profile
     */
    private function findOrCreateUser(array $profile, ?string $localAvatarUrl): User
    {
        $googleId = trim((string) ($profile['sub'] ?? ''));
        $email = mb_strtolower(trim((string) ($profile['email'] ?? '')));
        $emailVerified = filter_var($profile['email_verified'] ?? false, FILTER_VALIDATE_BOOL);

        if ($googleId === '' || $email === '' || ! $emailVerified) {
            throw new RuntimeException('Google did not return a verified email address.');
        }

        return DB::transaction(function () use ($googleId, $email, $localAvatarUrl): User {
            $user = User::query()->where('google_id', $googleId)->lockForUpdate()->first();

            if (! $user) {
                $user = User::query()->whereRaw('LOWER(email) = ?', [$email])->lockForUpdate()->first();
            }

            if ($user && $user->google_id && ! hash_equals((string) $user->google_id, $googleId)) {
                throw new RuntimeException('This email is already linked to another Google account.');
            }

            if (! $user) {
                $user = User::query()->create([
                    'google_id' => $googleId,
                    'username' => $this->uniqueUsername((string) ($profile['name'] ?? ''), $email),
                    'email' => $email,
                    'email_verified_at' => now(),
                    'password' => Hash::make(Str::random(64)),
                    'avatar_url' => $localAvatarUrl,
                    'role' => 'member',
                    'status' => 'active',
                ]);

                return $user;
            }

            $updates = [
                'google_id' => $googleId,
                'email_verified_at' => $user->email_verified_at ?: now(),
            ];

            if ($localAvatarUrl && (! $user->avatar_url || str_contains((string) $user->avatar_url, 'googleusercontent.com'))) {
                $updates['avatar_url'] = $localAvatarUrl;
            }

            $user->forceFill($updates)->save();

            return $user;
        });
    }

    private function uniqueUsername(string $name, string $email): string
    {
        $source = trim($name) !== '' ? trim($name) : Str::before($email, '@');
        $base = preg_replace('/[^\pL\pN_-]+/u', '_', $source) ?: 'learner';
        $base = trim(mb_substr($base, 0, 68), '_-') ?: 'learner';
        $candidate = $base;
        $suffix = 1;

        while (User::query()->where('username', $candidate)->exists()) {
            $suffixText = '_'.$suffix++;
            $candidate = mb_substr($base, 0, 80 - mb_strlen($suffixText)).$suffixText;
        }

        return $candidate;
    }

    /**
     * @param array<string, string> $payload
     */
    private function callbackPage(array $payload): Response
    {
        return response()
            ->view('auth.google-callback', [
                'payload' => $payload,
                'frontendOrigin' => $this->frontendOrigin(),
            ])
            ->header('Content-Security-Policy', "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; base-uri 'none'; frame-ancestors 'none'")
            ->header('Referrer-Policy', 'no-referrer')
            ->header('Cache-Control', 'no-store, private');
    }

    private function stateCacheKey(string $state): string
    {
        return 'google-oauth-state:'.hash('sha256', $state);
    }

    private function timeout(): int
    {
        return max(3, min(30, (int) config('services.google.timeout', 10)));
    }

    private function frontendOrigin(): string
    {
        $configured = (string) config('services.google.frontend_origin', 'http://localhost:5173');
        $scheme = parse_url($configured, PHP_URL_SCHEME);
        $host = parse_url($configured, PHP_URL_HOST);
        $port = parse_url($configured, PHP_URL_PORT);

        if (! is_string($scheme) || ! in_array($scheme, ['http', 'https'], true) || ! is_string($host) || $host === '') {
            return 'http://localhost:5173';
        }

        return $scheme.'://'.$host.($port ? ':'.$port : '');
    }

    private function base64UrlEncode(string $value): string
    {
        return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    }
}
