<?php

return [
    'dashboard_cache_store' => env('ADMIN_DASHBOARD_CACHE_STORE', 'file'),
    'dashboard_cache_seconds' => (int) env('ADMIN_DASHBOARD_CACHE_SECONDS', 30),
    'lookup_cache_seconds' => (int) env('ADMIN_LOOKUP_CACHE_SECONDS', 300),
    'user_cache_seconds' => (int) env('ADMIN_USER_CACHE_SECONDS', 15),
];
