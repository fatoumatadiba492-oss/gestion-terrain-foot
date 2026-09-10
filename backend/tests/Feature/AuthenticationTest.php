<?php

namespace Tests\Feature;

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Hash;
use Tests\TestCase;

class AuthenticationTest extends TestCase
{
    use RefreshDatabase;

    public function test_admin_can_login_and_access_protected_endpoint(): void
    {
        $user = User::factory()->create([
            'email' => 'admin@example.com',
            'password' => Hash::make('secret-password'),
            'role' => 'admin',
        ]);

        $login = $this->postJson('/api/auth/login', [
            'email' => 'admin@example.com',
            'password' => 'secret-password',
        ]);

        $login->assertOk()
            ->assertJsonPath('user.id', $user->id)
            ->assertJsonPath('user.role', 'admin');

        $token = $login->json('token');

        $this->withToken($token)
            ->getJson('/api/auth/me')
            ->assertOk()
            ->assertJsonPath('user.email', 'admin@example.com');
    }

    public function test_client_cannot_login_to_management_space(): void
    {
        User::factory()->create([
            'email' => 'client@example.com',
            'password' => Hash::make('secret-password'),
            'role' => 'client',
        ]);

        $this->postJson('/api/auth/login', [
            'email' => 'client@example.com',
            'password' => 'secret-password',
        ])->assertForbidden();
    }

    public function test_admin_endpoint_rejects_missing_or_invalid_token(): void
    {
        $this->getJson('/api/auth/me')->assertUnauthorized();

        $this->withToken('invalid-token')
            ->getJson('/api/auth/me')
            ->assertUnauthorized();
    }

    public function test_logout_revokes_the_current_token(): void
    {
        User::factory()->create([
            'email' => 'admin@example.com',
            'password' => Hash::make('secret-password'),
            'role' => 'admin',
        ]);

        $token = $this->postJson('/api/auth/login', [
            'email' => 'admin@example.com',
            'password' => 'secret-password',
        ])->json('token');

        $this->withToken($token)
            ->postJson('/api/auth/logout')
            ->assertOk();

        $this->withToken($token)
            ->getJson('/api/auth/me')
            ->assertUnauthorized();
    }
}
