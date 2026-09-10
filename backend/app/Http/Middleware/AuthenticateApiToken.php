<?php

declare(strict_types=1);

namespace App\Http\Middleware;

use App\Models\User;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AuthenticateApiToken
{
    public function handle(Request $request, Closure $next): Response
    {
        $plainToken = $request->bearerToken();

        if (! $plainToken) {
            return response()->json(['message' => 'Authentification requise.'], 401);
        }

        $hash = hash('sha256', $plainToken);
        $user = User::query()
            ->where('api_token_hash', $hash)
            ->where(function ($query) {
                $query->whereNull('api_token_expires_at')
                    ->orWhere('api_token_expires_at', '>', now());
            })
            ->first();

        if (! $user) {
            return response()->json(['message' => 'Token invalide ou expiré.'], 401);
        }

        $request->setUserResolver(fn () => $user);

        return $next($request);
    }
}
