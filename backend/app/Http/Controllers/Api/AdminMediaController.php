<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AdminActivityLog;
use App\Services\MediaStorage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AdminMediaController extends Controller
{
    /** @var array<string, string> */
    private const IMAGE_DIRECTORIES = [
        'plants' => 'admin-images/plants',
        'plant-guides' => 'admin-images/plant-guides',
        'plant-stages' => 'admin-images/plant-stages',
        'pests' => 'admin-images/pests',
        'items' => 'admin-images/items',
        'achievements' => 'admin-images/achievements',
    ];

    public function __construct(private readonly MediaStorage $media) {}

    public function uploadImage(Request $request): JsonResponse
    {
        $data = $request->validate([
            'scope' => ['required', 'string', Rule::in(array_keys(self::IMAGE_DIRECTORIES))],
            'upload' => ['required', 'image', 'mimes:jpg,jpeg,png,webp,gif', 'max:8192'],
        ]);

        $scope = $data['scope'];
        $file = $request->file('upload');
        $path = $this->media->storeUploadedFile($file, self::IMAGE_DIRECTORIES[$scope]);

        AdminActivityLog::record($request->user(), 'uploaded', $scope.'-image', null, [
            'path' => $path,
            'size' => $file->getSize(),
            'mime' => $file->getMimeType(),
        ]);

        return response()->json(['data' => [
            'reference' => $this->media->reference($path),
            'url' => $this->media->publicUrl($path),
            'mime' => $file->getMimeType(),
            'size' => $file->getSize(),
        ]], 201);
    }
}
