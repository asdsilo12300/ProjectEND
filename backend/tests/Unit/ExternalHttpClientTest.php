<?php

namespace Tests\Unit;

use App\Services\ExternalHttpClient;
use Tests\TestCase;

class ExternalHttpClientTest extends TestCase
{
    public function test_it_uses_an_explicit_ca_bundle_when_configured(): void
    {
        config()->set('services.external_http.verify_ssl', true);
        config()->set('services.external_http.ca_bundle', __FILE__);

        $verification = app(ExternalHttpClient::class)->certificateVerification();

        $this->assertSame(__FILE__, $verification);
    }

    public function test_ssl_can_only_be_disabled_in_a_local_or_testing_environment(): void
    {
        config()->set('services.external_http.verify_ssl', false);
        config()->set('services.external_http.ca_bundle', null);

        $verification = app(ExternalHttpClient::class)->certificateVerification();

        $this->assertFalse($verification);
    }
}
