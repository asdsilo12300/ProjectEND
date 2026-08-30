<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\AdminActivityLog;
use App\Services\MediaStorage;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;

class AdminMediaController extends Controller
{
    /** @var array<string, string> */
    private const IMAGE_DIRECTORIES = [
        'plants' => 'admin-images/plants',
        'plant-guides' => 'admin-images/plant-guides',
        'plant-stages' => 'admin-images/plant-stages',
        'pests' => 'admin-images/pests',
        'pest-guides' => 'admin-images/pest-guides',
        'items' => 'admin-images/items',
        'item-types' => 'admin-images/item-types',
        'achievements' => 'admin-images/achievements',
    ];

    public function __construct(private readonly MediaStorage $media) {}

    public function uploadImage(Request $request): JsonResponse
    {
        $data = $request->validate([
            'scope' => ['required', 'string', Rule::in(array_keys(self::IMAGE_DIRECTORIES))],
        ]);

        $scope = $data['scope'];
        $request->validate([
            'upload' => $scope === 'item-types'
                ? ['required', 'file', 'mimes:svg', 'max:512']
                : ['required', 'image', 'mimes:jpg,jpeg,png,webp,gif', 'max:8192'],
        ]);
        $file = $request->file('upload');
        if ($scope === 'item-types') {
            $svg = $this->sanitizeSvg((string) file_get_contents($file->getRealPath()));
            $path = self::IMAGE_DIRECTORIES[$scope].'/'.Str::uuid().'.svg';
            if (! $this->media->put($path, $svg, 'image/svg+xml')) {
                throw ValidationException::withMessages(['upload' => 'Unable to store this SVG icon.']);
            }
        } else {
            $path = $this->media->storeUploadedFile($file, self::IMAGE_DIRECTORIES[$scope]);
        }

        AdminActivityLog::record($request->user(), 'uploaded', $scope.'-image', null, [
            'path' => $path,
            'size' => $file->getSize(),
            'mime' => $scope === 'item-types' ? 'image/svg+xml' : $file->getMimeType(),
        ]);

        return response()->json(['data' => [
            'reference' => $this->media->reference($path),
            'url' => $this->media->publicUrl($path),
            'mime' => $scope === 'item-types' ? 'image/svg+xml' : $file->getMimeType(),
            'size' => $file->getSize(),
        ]], 201);
    }

    private function sanitizeSvg(string $svg): string
    {
        if ($svg === '' || preg_match('/<!DOCTYPE|<!ENTITY/i', $svg)) {
            throw ValidationException::withMessages(['upload' => 'The SVG file contains unsupported markup.']);
        }

        $document = new \DOMDocument();
        $previous = libxml_use_internal_errors(true);
        $loaded = $document->loadXML($svg, LIBXML_NONET | LIBXML_NOERROR | LIBXML_NOWARNING);
        libxml_clear_errors();
        libxml_use_internal_errors($previous);
        if (! $loaded || strtolower((string) $document->documentElement?->localName) !== 'svg') {
            throw ValidationException::withMessages(['upload' => 'Choose a valid SVG icon.']);
        }

        foreach (['script', 'foreignObject', 'iframe', 'object', 'embed', 'image', 'use'] as $tag) {
            $nodes = $document->getElementsByTagName($tag);
            for ($index = $nodes->length - 1; $index >= 0; $index--) {
                $nodes->item($index)?->parentNode?->removeChild($nodes->item($index));
            }
        }
        foreach ($document->getElementsByTagName('*') as $element) {
            for ($index = $element->attributes->length - 1; $index >= 0; $index--) {
                $attribute = $element->attributes->item($index);
                $name = strtolower((string) $attribute?->nodeName);
                $value = strtolower(trim((string) $attribute?->nodeValue));
                if (str_starts_with($name, 'on') || str_contains($value, 'javascript:') || str_contains($value, 'data:') || str_contains($value, 'url(')) {
                    $element->removeAttributeNode($attribute);
                }
            }
        }

        return (string) $document->saveXML($document->documentElement);
    }
}
