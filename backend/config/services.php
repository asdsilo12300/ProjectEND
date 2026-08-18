<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Mailgun, Postmark, AWS and more. This file provides the de facto
    | location for this type of information, allowing packages to have
    | a conventional file to locate the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env('AWS_DEFAULT_REGION', 'us-east-1'),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env('SLACK_BOT_USER_OAUTH_TOKEN'),
            'channel' => env('SLACK_BOT_USER_DEFAULT_CHANNEL'),
        ],
    ],

    'google' => [
        'client_id' => env('GOOGLE_CLIENT_ID'),
        'client_secret' => env('GOOGLE_CLIENT_SECRET'),
        'redirect' => env(
            'GOOGLE_REDIRECT_URI',
            rtrim((string) env('APP_URL', 'http://localhost:8000'), '/').'/api/auth/google/callback'
        ),
        'frontend_origin' => rtrim((string) env('FRONTEND_URL', 'http://localhost:5173'), '/'),
        'timeout' => (int) env('GOOGLE_OAUTH_TIMEOUT', 10),
    ],

    'media' => [
        'driver' => env('MEDIA_DRIVER', 'laravel'),
        'disk' => env('MEDIA_DISK', 'public'),
        'supabase_url' => env('SUPABASE_URL'),
        'supabase_key' => env('SUPABASE_SECRET_KEY', env('SUPABASE_SERVICE_ROLE_KEY')),
        'supabase_bucket' => env('SUPABASE_STORAGE_BUCKET', 'plant-media'),
        'timeout' => (int) env('SUPABASE_STORAGE_TIMEOUT', 30),
    ],

    'external_http' => [
        'verify_ssl' => env('EXTERNAL_HTTP_VERIFY_SSL', true),
        'ca_bundle' => env('EXTERNAL_HTTP_CA_BUNDLE'),
    ],

    'nominatim' => [
        'base_url' => rtrim((string) env('NOMINATIM_BASE_URL', 'https://nominatim.openstreetmap.org'), '/'),
        'user_agent' => env('NOMINATIM_USER_AGENT', 'PlantGrowthAcademy/1.0'),
    ],

];
