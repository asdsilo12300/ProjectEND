<?php

return [
    'otp_ttl_minutes' => (int) env('PASSWORD_RESET_OTP_TTL_MINUTES', 10),
    'reset_token_ttl_minutes' => (int) env('PASSWORD_RESET_TOKEN_TTL_MINUTES', 10),
    'max_attempts' => (int) env('PASSWORD_RESET_OTP_MAX_ATTEMPTS', 5),
];
