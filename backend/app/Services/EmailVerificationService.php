<?php

namespace App\Services;

use App\Mail\EmailVerificationMail;
use App\Models\EmailVerification;
use App\Models\User;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Str;
use Throwable;

class EmailVerificationService
{
    /**
     * @return array{delivered: bool, expires_in: int, resend_available_in: int, configuration_error: ?string}
     */
    public function send(User $user, ?string $ipAddress = null): array
    {
        $ttl = max(5, (int) config('email_verification.otp_ttl_minutes', 15));
        $cooldown = max(30, (int) config('email_verification.resend_cooldown_seconds', 60));
        $otp = (string) random_int(100000, 999999);
        $plainToken = Str::random(64);

        EmailVerification::query()
            ->where('user_id', $user->id)
            ->whereNull('used_at')
            ->update(['used_at' => now()]);

        $challenge = EmailVerification::query()->create([
            'user_id' => $user->id,
            'otp_hash' => $this->digest($otp),
            'token_hash' => $this->digest($plainToken),
            'attempts' => 0,
            'expires_at' => now()->addMinutes($ttl),
            'resend_available_at' => now()->addSeconds($cooldown),
            'requested_ip' => $ipAddress,
        ]);

        $configurationError = $this->mailConfigurationError();
        if ($configurationError) {
            $challenge->forceFill(['used_at' => now()])->save();

            return [
                'delivered' => false,
                'expires_in' => $ttl * 60,
                'resend_available_in' => $cooldown,
                'configuration_error' => $configurationError,
            ];
        }

        try {
            Mail::to($user->email)->send(new EmailVerificationMail(
                $otp,
                $user->username,
                $ttl,
                $this->verificationUrl($user, $plainToken),
            ));
        } catch (Throwable $error) {
            $challenge->forceFill(['used_at' => now()])->save();
            report($error);

            return [
                'delivered' => false,
                'expires_in' => $ttl * 60,
                'resend_available_in' => $cooldown,
                'configuration_error' => null,
            ];
        }

        return [
            'delivered' => true,
            'expires_in' => $ttl * 60,
            'resend_available_in' => $cooldown,
            'configuration_error' => null,
        ];
    }

    public function digest(string $value): string
    {
        return hash_hmac('sha256', $value, (string) config('app.key'));
    }

    public function maskEmail(string $email): string
    {
        [$name, $domain] = array_pad(explode('@', $email, 2), 2, '');
        $visible = mb_substr($name, 0, min(2, mb_strlen($name)));

        return $visible.str_repeat('*', max(3, mb_strlen($name) - mb_strlen($visible))).'@'.$domain;
    }

    private function verificationUrl(User $user, string $plainToken): string
    {
        $query = http_build_query([
            'verify_email_token' => $plainToken,
            'email' => $user->email,
        ], '', '&', PHP_QUERY_RFC3986);

        return rtrim((string) config('email_verification.frontend_url'), '/').'/?'.$query;
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
