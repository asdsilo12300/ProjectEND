<?php

namespace App\Support;

use Illuminate\Validation\ValidationException;

final class LocalizedFieldLanguageValidator
{
    public static function validateOrFail(array $data): void
    {
        $errors = [];
        self::collectErrors($data, '', null, $errors);

        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }
    }

    private static function collectErrors(mixed $value, string $path, ?string $expectedLanguage, array &$errors): void
    {
        if (is_array($value)) {
            foreach ($value as $key => $nestedValue) {
                $nestedPath = $path === '' ? (string) $key : $path.'.'.$key;
                $nestedLanguage = is_string($key) ? (self::languageForKey($key) ?? $expectedLanguage) : $expectedLanguage;
                self::collectErrors($nestedValue, $nestedPath, $nestedLanguage, $errors);
            }

            return;
        }

        if (! is_string($value) || trim($value) === '' || $expectedLanguage === null) {
            return;
        }

        $plainText = str_contains(strtolower($path), 'html')
            ? html_entity_decode(strip_tags($value), ENT_QUOTES | ENT_HTML5, 'UTF-8')
            : $value;
        $hasThai = preg_match('/[\x{0E00}-\x{0E7F}]/u', $plainText) === 1;
        $hasLatin = preg_match('/[A-Za-z]/u', $plainText) === 1;
        $hasLetters = preg_match('/\p{L}/u', $plainText) === 1;
        $invalid = $expectedLanguage === 'th'
            ? $hasLatin || ($hasLetters && ! $hasThai)
            : $hasThai || ($hasLetters && ! $hasLatin);

        if ($invalid) {
            $errors[$path] = [$expectedLanguage === 'th'
                ? 'This field must use Thai. Remove English letters before saving.'
                : 'This field must use English. Remove Thai characters before saving.'];
        }
    }

    private static function languageForKey(string $key): ?string
    {
        $normalized = strtolower($key);
        if (preg_match('/(?:^|_)th$/', $normalized) === 1) {
            return 'th';
        }
        if (preg_match('/(?:^|_)en$/', $normalized) === 1) {
            return 'en';
        }

        return null;
    }
}
