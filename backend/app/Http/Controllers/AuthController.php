<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Str;

class AuthController extends Controller
{
    public function login(Request $request)
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
        ]);

        $user = User::query()->where('email', $credentials['email'])->first();

        if (! $user || ! Hash::check($credentials['password'], $user->password)) {
            return response()->json(['message' => 'Email ou mot de passe incorrect.'], 422);
        }

        if (! in_array($user->role, ['admin', 'manager'], true)) {
            return response()->json(['message' => 'Ce compte ne peut pas accéder à cet espace.'], 403);
        }

        $plainToken = Str::random(80);

        $user->forceFill([
            'api_token_hash' => hash('sha256', $plainToken),
            'api_token_expires_at' => now()->addHours(12),
        ])->save();

        return response()->json([
            'token' => $plainToken,
            'expires_at' => $user->api_token_expires_at?->toIso8601String(),
            'user' => $this->userPayload($user),
        ]);
    }

    public function me(Request $request)
    {
        return response()->json(['user' => $this->userPayload($request->user())]);
    }

    public function logout(Request $request)
    {
        $request->user()->forceFill([
            'api_token_hash' => null,
            'api_token_expires_at' => null,
        ])->save();

        return response()->json(['message' => 'Déconnexion réussie.']);
    }

    private function userPayload(User $user): array
    {
        return [
            'id' => $user->id,
            'name' => $user->name,
            'email' => $user->email,
            'role' => $user->role,
        ];
    }
}
