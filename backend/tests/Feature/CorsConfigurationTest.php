<?php

namespace Tests\Feature;

use Tests\TestCase;

class CorsConfigurationTest extends TestCase
{
    public function test_preflight_allows_only_a_configured_frontend_origin(): void
    {
        config()->set('cors.allowed_origins', ['https://academy.example.com']);

        $response = $this
            ->withHeaders([
                'Origin' => 'https://academy.example.com',
                'Access-Control-Request-Method' => 'GET',
                'Access-Control-Request-Headers' => 'Authorization, Content-Type',
            ])
            ->options('/api/plants');

        $response->assertNoContent();
        $response->assertHeader('Access-Control-Allow-Origin', 'https://academy.example.com');
    }

    public function test_preflight_never_reflects_an_unknown_origin(): void
    {
        config()->set('cors.allowed_origins', ['https://academy.example.com']);

        $response = $this
            ->withHeaders([
                'Origin' => 'https://attacker.example.com',
                'Access-Control-Request-Method' => 'GET',
            ])
            ->options('/api/plants');

        $response->assertNoContent();
        $response->assertHeader('Access-Control-Allow-Origin', 'https://academy.example.com');
        $this->assertNotSame(
            'https://attacker.example.com',
            $response->headers->get('Access-Control-Allow-Origin'),
        );
    }
}
