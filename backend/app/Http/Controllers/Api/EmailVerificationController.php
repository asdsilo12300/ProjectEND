<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\EmailVerification;
use App\Models\User;
use App\Services\EmailVerificationService;
use App\Services\JwtService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

class EmailVerificationController extends Controller
{
    public function __construct(
        private readonly JwtService $jwt,
        private readonly EmailVerificationService $verification,
    ) {}

    public function verifyCode(Request $request): JsonResponse
    {
        $this->normalizeEmailInput($request);
        $data = $request->validate([
            'email' => ['required', 'email', 'max:191'],
            'otp' => ['required', 'digits:6'],
        ]);
        $maxAttempts = max(3, (int) config('email_verification.max_attempts', 5));

        $user = DB::transaction(function () use ($data, $maxAttempts): User {
            $user = User::query()
                ->whereRaw('LOWER(email) = ?', [$data['email']])
                ->lockForUpdate()
                ->first();

            if (! $user || $user->email_verified_at) {
                $this->invalidCode();
            }

            $challenge = EmailVerification::query()
                ->where('user_id', $user->id)
                ->whereNull('used_at')
                ->latest('id')
                ->lockForUpdate()
                ->first();

            if (! $challenge || $challenge->expires_at->isPast() || $challenge->attempts >= $maxAttempts) {
                throw ValidationException::withMessages([
                    'otp' => ['This code has expired. Request a new code.'],
                ]);
            }

            if (! hash_equals($challenge->otp_hash, $this->verification->digest($data['otp']))) {
                $challenge->increment('attempts');
                $remaining = max(0, $maxAttempts - $challenge->attempts);

                throw ValidationException::withMessages([
                    'otp' => [$remaining > 0
                        ? "Incorrect code. {$remaining} attempts remaining."
                        : 'Too many incorrect attempts. Request a new code.'],
                ]);
            }

            return $this->markVerified($user);
        });

        return $this->verifiedResponse($user);
    }

    public function verifyLink(Request $request): JsonResponse
    {
        $data = $request->validate([
            'token' => ['required', 'string', 'size:64'],
        ]);

        $user = DB::transaction(function () use ($data): User {
            $challenge = EmailVerification::query()
                ->where('token_hash', $this->verification->digest($data['token']))
                ->whereNull('used_at')
                ->lockForUpdate()
                ->first();

            if (! $challenge || $challenge->expires_at->isPast()) {
                throw ValidationException::withMessages([
                    'token' => ['This verification link has expired. Request a new email.'],
                ]);
            }

            $user = User::query()->whereKey($challenge->user_id)->lockForUpdate()->first();
            if (! $user) {
                throw ValidationException::withMessages([
                    'token' => ['This verification link is invalid.'],
                ]);
            }

            return $this->markVerified($user);
        });

        return $this->verifiedResponse($user);
    }

    public function resend(Request $request): JsonResponse
    {
        $this->normalizeEmailInput($request);
        $data = $request->validate([
            'email' => ['required', 'email', 'max:191'],
        ]);

        $user = User::query()->whereRaw('LOWER(email) = ?', [$data['email']])->first();

        // Keep the public response neutral for unknown or already verified emails.
        if (! $user || $user->email_verified_at) {
            return response()->json([
                'message' => 'If this email is awaiting verification, a new code will be sent.',
                'resend_available_in' => max(30, (int) config('email_verification.resend_cooldown_seconds', 60)),
            ]);
        }

        $latest = EmailVerification::query()
            ->where('user_id', $user->id)
            ->whereNull('used_at')
            ->latest('id')
            ->first();

        if ($latest && $latest->resend_available_at->isFuture()) {
            $retryAfter = max(1, now()->diffInSeconds($latest->resend_available_at));

            return response()->json([
                'message' => 'Please wait before requesting another verification email.',
                'retry_after' => $retryAfter,
                'resend_available_in' => $retryAfter,
            ], 429)->header('Retry-After', (string) $retryAfter);
        }

        $delivery = $this->verification->send($user, $request->ip());

        return response()->json([
            'message' => $delivery['delivered']
                ? 'A new verification code has been sent.'
                : 'We could not send the verification email. Please try again later.',
            'email_hint' => $this->verification->maskEmail($user->email),
            'delivery_status' => $delivery['delivered'] ? 'sent' : 'failed',
            'expires_in' => $delivery['expires_in'],
            'resend_available_in' => $delivery['delivered'] ? $delivery['resend_available_in'] : 0,
            'configuration_error' => config('app.debug') ? $delivery['configuration_error'] : null,
        ], $delivery['delivered'] ? 200 : 503);
    }

    private function markVerified(User $user): User
    {
        if (! $user->email_verified_at) {
            $user->forceFill([
                'email_verified_at' => now(),
                'last_login_at' => now(),
            ])->save();
        }

        EmailVerification::query()
            ->where('user_id', $user->id)
            ->whereNull('used_at')
            ->update(['used_at' => now()]);

        return $user->fresh();
    }

    private function verifiedResponse(User $user): JsonResponse
    {
        return response()->json([
            'message' => 'Email verified successfully.',
            'token' => $this->jwt->issue($user),
            'email_verified_at' => $user->email_verified_at?->toIso8601String(),
        ]);
    }

    private function invalidCode(): never
    {
        throw ValidationException::withMessages([
            'otp' => ['The verification code is invalid.'],
        ]);
    }

    private function normalizeEmailInput(Request $request): void
    {
        $email = $request->input('email');
        if (is_string($email)) {
            $request->merge(['email' => mb_strtolower(trim($email))]);
        }
    }
}
