<?php

namespace App\Services;

use Illuminate\Http\Client\PendingRequest;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class ExternalHttpClient
{
    private static bool $invalidBundleReported = false;

    public function request(): PendingRequest
    {
        return Http::acceptJson()->withOptions([
            'verify' => $this->certificateVerification(),
        ]);
    }

    public function certificateVerification(): bool|string
    {
        if (! (bool) config('services.external_http.verify_ssl', true)
            && app()->environment('local', 'testing')) {
            return false;
        }

        $configuredBundle = trim((string) config('services.external_http.ca_bundle', ''));
        if ($configuredBundle !== '') {
            if (is_file($configuredBundle)) {
                return $configuredBundle;
            }

            if (! self::$invalidBundleReported) {
                Log::warning('The configured external HTTP CA bundle does not exist.', [
                    'path' => $configuredBundle,
                ]);
                self::$invalidBundleReported = true;
            }
        }

        foreach ($this->candidateBundles() as $candidate) {
            if ($candidate !== '' && is_file($candidate)) {
                return $candidate;
            }
        }

        return true;
    }

    /** @return array<int, string> */
    private function candidateBundles(): array
    {
        $opensslLocations = function_exists('openssl_get_cert_locations')
            ? openssl_get_cert_locations()
            : [];

        return array_values(array_unique(array_filter([
            (string) ini_get('curl.cainfo'),
            (string) ini_get('openssl.cafile'),
            (string) getenv('CURL_CA_BUNDLE'),
            (string) getenv('SSL_CERT_FILE'),
            (string) ($opensslLocations['ini_cafile'] ?? ''),
            (string) ($opensslLocations['default_cert_file'] ?? ''),
            'C:\\Program Files\\Git\\mingw64\\etc\\ssl\\certs\\ca-bundle.crt',
            'C:\\Program Files\\Git\\usr\\ssl\\certs\\ca-bundle.crt',
        ], fn ($path) => is_string($path) && trim($path) !== '')));
    }
}
