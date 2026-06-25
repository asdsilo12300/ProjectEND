<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class ApiCors
{
    public function handle(Request $request, Closure $next): Response
    {
        if ($request->isMethod('OPTIONS')) {
            $response = response()->noContent();
        } else {
            $response = $next($request);
        }

        $origin = $request->headers->get('Origin', '*');
        $allowedOrigin = env('FRONTEND_URL', $origin);

        $response->headers->set('Access-Control-Allow-Origin', $allowedOrigin ?: '*');
        $response->headers->set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
        $response->headers->set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
        $response->headers->set('Access-Control-Allow-Credentials', 'true');

        return $response;
    }
}
