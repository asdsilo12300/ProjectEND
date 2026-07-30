<?php

return [
    'cache_store' => env('PUBLIC_CATALOG_CACHE_STORE', 'file'),
    'cache_seconds' => (int) env('PUBLIC_CATALOG_CACHE_SECONDS', 300),
    'browser_cache_seconds' => (int) env('PUBLIC_CATALOG_BROWSER_CACHE_SECONDS', 30),
];
