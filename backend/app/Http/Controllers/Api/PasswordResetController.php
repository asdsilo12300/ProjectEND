<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Mail\PasswordResetOtpMail;
use App\Models\PasswordResetOtp;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password;
use Illuminate\Validation\ValidationException;
use Throwable;

class PasswordResetController extends Controller
{
    public function requestOtp(Request $request): JsonResponse
    {
        if ($configurationError = $this->mailConfigurationError()) {
            return response()->json([
                'message' => 'Email delivery is not configured yet. Please contact the administrator.',
                'configuration_error' => config('app.debug') ? $configurationError : null,
            ], 503);
        }

        $user = $request->user();
        $ttl = max(5, (int) config('password_reset.otp_ttl_minutes', 10));
        $otp = (string) random_int(100000, 999999);

        PasswordResetOtp::query()
            ->where('user_id', $user->id)
            ->whereNull('consumed_at')
            ->update(['consumed_at' => now()]);

        $challenge = PasswordResetOtp::query()->create([
            'user_id' => $user->id,
            'otp_hash' => $this->digest($otp),
            'attempts' => 0,
            'expires_at' => now()->addMinutes($ttl),
            'requested_ip' => $request->ip(),
        ]);

        try {
            Mail::to($user->email)->send(new PasswordResetOtpMail($otp, $user->username, $ttl));
        } catch (Throwable $error) {
            $challenge->forceFill(['consumed_at' => now()])->save();
            report($error);

            return response()->json([
                'message' => 'We could not send the verification email. Please try again later.',
            ], 503);
        }

        return response()->json([
            'message' => 'Verification code sent.',
            'email_hint' => $this->maskEmail($user->email),
            'expires_in' => $ttl * 60,
        ]);
    }

    public function verifyOtp(Request $request): JsonResponse
    {
        $data = $request->validate([
            'otp' => ['required', 'digits:6'],
        ]);
        $maxAttempts = max(3, (int) config('password_reset.max_attempts', 5));

        $challenge = PasswordResetOtp::query()
            ->where('user_id', $request->user()->id)
            ->whereNull('consumed_at')
            ->latest('id')
            ->first();

        if (! $challenge || $challenge->expires_at->isPast() || $challenge->attempts >= $maxAttempts) {
            throw ValidationException::withMessages(['otp' => ['This code has expired. Request a new code.']]);
        }

        if (! hash_equals($challenge->otp_hash, $this->digest($data['otp']))) {
            $challenge->increment('attempts');
            $remaining = max(0, $maxAttempts - $challenge->attempts);

            throw ValidationException::withMessages([
                'otp' => [$remaining > 0 ? "Incorrect code. {$remaining} attempts remaining." : 'Too many incorrect attempts. Request a new code.'],
            ]);
        }

        $plainToken = Str::random(64);
        $challenge->forceFill([
            'verified_at' => now(),
            'reset_token_hash' => $this->digest($plainToken),
        ])->save();

        return response()->json([
            'message' => 'Code verified.',
            'reset_token' => $plainToken,
        ]);
    }

    public function resetPassword(Request $request): JsonResponse
    {
        $data = $request->validate([
            'reset_token' => ['required', 'string', 'size:64'],
            'password' => ['required', 'confirmed', Password::min(8)->letters()->numbers()],
        ]);
        $tokenTtl = max(5, (int) config('password_reset.reset_token_ttl_minutes', 10));

        $challenge = PasswordResetOtp::query()
            ->where('user_id', $request->user()->id)
            ->whereNotNull('verified_at')
            ->whereNull('consumed_at')
            ->latest('id')
            ->first();

        if (! $challenge
            || $challenge->verified_at->copy()->addMinutes($tokenTtl)->isPast()
            || ! hash_equals((string) $challenge->reset_token_hash, $this->digest($data['reset_token']))) {
            throw ValidationException::withMessages([
                'reset_token' => ['This password reset session has expired. Start again.'],
            ]);
        }

        DB::transaction(function () use ($request, $challenge, $data): void {
            $request->user()->forceFill([
                'password' => Hash::make($data['password']),
            ])->save();
            $challenge->forceFill(['consumed_at' => now()])->save();
        });

        return response()->json(['message' => 'Your password has been updated.']);
    }

    private function digest(string $value): string
    {
        return hash_hmac('sha256', $value, (string) config('app.key'));
    }

    private function maskEmail(string $email): string
    {
        [$name, $domain] = array_pad(explode('@', $email, 2), 2, '');
        $visible = mb_substr($name, 0, min(2, mb_strlen($name)));

        return $visible.str_repeat('*', max(3, mb_strlen($name) - mb_strlen($visible))).'@'.$domain;
    }

    private function mailConfigurationError(): ?string
    {
        if (app()->environment('testing')) {
            return null;
        }

        $mailer = (string) config('mail.default');
        if (in_array($mailer, ['log', 'array'], true)) {
            return 'MAIL_MAILER must use a real delivery transport such as smtp.';
        }

        if ($mailer !== 'smtp') {
            return null;
        }

        $smtp = (array) config('mail.mailers.smtp', []);
        $required = [
            'MAIL_HOST' => $smtp['host'] ?? null,
            'MAIL_USERNAME' => $smtp['username'] ?? null,
            'MAIL_PASSWORD' => $smtp['password'] ?? null,
            'MAIL_FROM_ADDRESS' => config('mail.from.address'),
        ];

        $missing = array_keys(array_filter($required, static fn ($value): bool => blank($value) || $value === 'null'));

        return $missing ? 'Missing SMTP values: '.implode(', ', $missing).'.' : null;
    }
}
