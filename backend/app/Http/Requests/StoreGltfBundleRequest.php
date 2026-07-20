<?php

namespace App\Http\Requests;

use Closure;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Http\UploadedFile;
use Illuminate\Validation\Validator;

class StoreGltfBundleRequest extends FormRequest
{
    private const MODEL_EXTENSIONS = ['gltf'];

    private const RESOURCE_EXTENSIONS = ['bin', 'png', 'jpg', 'jpeg', 'webp'];

    public function authorize(): bool
    {
        return true;
    }

    public function rules(): array
    {
        return [
            'model' => [
                'required',
                'file',
                'max:51200',
                $this->extensionRule(self::MODEL_EXTENSIONS, 'The main model must be a .gltf file.'),
            ],
            'resources' => ['sometimes', 'array', 'max:100'],
            'resources.*' => [
                'file',
                'max:51200',
                $this->extensionRule(
                    self::RESOURCE_EXTENSIONS,
                    'Supporting files may only be .bin, .png, .jpg, .jpeg, or .webp files.',
                ),
            ],
            'resource_paths' => ['sometimes', 'array', 'max:100'],
            'resource_paths.*' => ['nullable', 'string', 'max:500'],
        ];
    }

    public function after(): array
    {
        return [
            function (Validator $validator): void {
                $resources = $this->file('resources', []);
                $paths = $this->input('resource_paths', []);

                if ($paths !== [] && count($paths) !== count($resources)) {
                    $validator->errors()->add('resource_paths', 'Every supporting file must have one relative path.');
                }

                $files = array_filter([$this->file('model'), ...$resources], fn ($file) => $file instanceof UploadedFile);
                $totalBytes = array_sum(array_map(fn (UploadedFile $file): int => (int) $file->getSize(), $files));

                if ($totalBytes > 150 * 1024 * 1024) {
                    $validator->errors()->add('model', 'The complete model package may not exceed 150 MB.');
                }
            },
        ];
    }

    /** @return array<int, UploadedFile> */
    public function resourceFiles(): array
    {
        return array_values(array_filter(
            $this->file('resources', []),
            fn ($file) => $file instanceof UploadedFile,
        ));
    }

    /** @return array<int, string> */
    public function resourcePaths(): array
    {
        return array_values(array_map('strval', $this->input('resource_paths', [])));
    }

    private function extensionRule(array $allowed, string $message): Closure
    {
        return static function (string $attribute, mixed $value, Closure $fail) use ($allowed, $message): void {
            if (! $value instanceof UploadedFile) {
                return;
            }

            if (! in_array(strtolower($value->getClientOriginalExtension()), $allowed, true)) {
                $fail($message);
            }
        };
    }
}
