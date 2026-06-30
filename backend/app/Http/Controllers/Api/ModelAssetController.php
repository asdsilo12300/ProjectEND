<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\ModelAsset;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Str;

class ModelAssetController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'data' => ModelAsset::query()
                ->orderBy('asset_key')
                ->get()
                ->map(fn (ModelAsset $asset) => $this->serialize($asset))
                ->values(),
        ]);
    }

    public function show(string $key): JsonResponse
    {
        $asset = ModelAsset::query()->where('asset_key', $key)->firstOrFail();

        return response()->json(['data' => $this->serialize($asset)]);
    }

    private function serialize(ModelAsset $asset): array
    {
        return [
            'id' => $asset->id,
            'asset_key' => $asset->asset_key,
            'label' => $asset->label,
            'type' => $asset->type,
            'url' => $this->publicUrl($asset->url),
            'metadata' => $asset->metadata ?? [],
        ];
    }

    private function publicUrl(?string $path): ?string
    {
        if (! $path) {
            return null;
        }

        if (Str::startsWith($path, ['http://', 'https://', '/'])) {
            return $path;
        }

        return '/storage/' . ltrim($path, '/');
    }
}
