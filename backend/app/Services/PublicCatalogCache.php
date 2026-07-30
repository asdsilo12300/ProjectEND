<?php

namespace App\Services;

use Closure;
use Illuminate\Contracts\Cache\Repository;
use Illuminate\Support\Facades\Cache;
use Throwable;

class PublicCatalogCache
{
    private const CATALOGS = ['plants', 'contents', 'shop-items', 'model-assets'];

    public function remember(string $catalog, Closure $callback): mixed
    {
        if (! in_array($catalog, self::CATALOGS, true)) {
            return $callback();
        }

        try {
            return $this->store()->remember(
                $this->key($catalog),
                max(1, (int) config('catalog.cache_seconds', 300)),
                $callback,
            );
        } catch (Throwable $error) {
            report($error);

            return $callback();
        }
    }

    public function clear(): void
    {
        try {
            foreach (self::CATALOGS as $catalog) {
                $this->store()->forget($this->key($catalog));
            }
        } catch (Throwable $error) {
            report($error);
        }
    }

    private function key(string $catalog): string
    {
        return "public-catalog:v3:{$catalog}";
    }

    private function store(): Repository
    {
        return Cache::store((string) config('catalog.cache_store', 'file'));
    }
}
