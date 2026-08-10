<?php

return [
    'otp_ttl_minutes' => (int) env('EMAIL_VERIFICATION_OTP_TTL_MINUTES', 15),
    'max_attempts' => (int) env('EMAIL_VERIFICATION_OTP_MAX_ATTEMPTS', 5),
    'resend_cooldown_seconds' => (int) env('EMAIL_VERIFICATION_RESEND_COOLDOWN_SECONDS', 60),
    'frontend_url' => rtrim((string) env('FRONTEND_URL', 'http://localhost:5173'), '/'),
];
