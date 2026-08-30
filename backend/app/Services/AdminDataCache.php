<?php

namespace App\Services;

use Closure;
use Illuminate\Contracts\Cache\Repository;
use Illuminate\Support\Facades\Cache;
use stdClass;
use Throwable;

class AdminDataCache
{
    public function rememberDashboard(string $selection, Closure $callback): array
    {
        return $this->rememberArray(
            $this->dashboardKey($selection),
            max(1, (int) config('admin.dashboard_cache_seconds', 30)),
            $callback,
        );
    }

    public function rememberLookups(Closure $callback): array
    {
        return $this->rememberArray(
            'admin-data:lookups:v3',
            max(1, (int) config('admin.lookup_cache_seconds', 300)),
            $callback,
        );
    }

    public function rememberUsers(array $filters, Closure $callback): array
    {
        $version = $this->usersVersion();
        $signature = hash('sha256', json_encode([$version, $filters], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));

        return $this->rememberArray(
            "admin-data:users:v2:{$signature}",
            max(1, (int) config('admin.user_cache_seconds', 15)),
            $callback,
        );
    }

    public function clear(): void
    {
        try {
            $this->store()->put('admin-data:dashboard:version', (string) hrtime(true), 86400);
            $this->store()->forget('admin-data:lookups:v2');
            $this->store()->forget('admin-data:lookups:v3');
            $this->store()->put('admin-data:users:version', (string) hrtime(true), 86400);
        } catch (Throwable $error) {
            report($error);
        }
    }

    private function dashboardKey(string $selection): string
    {
        $version = $this->dashboardVersion();
        $signature = hash('sha256', "{$version}:{$selection}");

        return "admin-data:dashboard:v5:{$signature}";
    }

    private function store(): Repository
    {
        return Cache::store((string) config('admin.dashboard_cache_store', 'file'));
    }

    private function usersVersion(): string
    {
        try {
            return (string) $this->store()->get('admin-data:users:version', '1');
        } catch (Throwable $error) {
            report($error);

            return 'uncached';
        }
    }

    private function dashboardVersion(): string
    {
        try {
            return (string) $this->store()->get('admin-data:dashboard:version', '1');
        } catch (Throwable $error) {
            report($error);

            return 'uncached';
        }
    }

    private function rememberArray(string $key, int $seconds, Closure $callback): array
    {
        $missing = new stdClass;

        try {
            $cached = $this->store()->get($key, $missing);
            if ($cached !== $missing && is_array($cached)) {
                return $cached;
            }
        } catch (Throwable $error) {
            report($error);
        }

        $value = $callback();

        try {
            $this->store()->put($key, $value, $seconds);
        } catch (Throwable $error) {
            report($error);
        }

        return $value;
    }
}
