<?php

namespace Tests\Feature;

use App\Models\Reservation;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class ReservationFlowTest extends TestCase
{
    use RefreshDatabase;

    public function test_a_free_slot_is_available(): void
    {
        $date = today()->addDay()->toDateString();

        $response = $this->getJson("/api/reservations/availability?date={$date}&heure=16:00-18:00");

        $response->assertOk()
            ->assertJson(['available' => true, 'amount' => 15000, 'currency' => 'XOF']);
    }

    public function test_a_pending_slot_is_not_available(): void
    {
        $date = today()->addDay()->toDateString();
        Reservation::create($this->reservationData($date, '16:00-18:00', [
            'slot_key' => $date.'_16:00-18:00',
        ]));

        $response = $this->getJson("/api/reservations/availability?date={$date}&heure=16:00-18:00");

        $response->assertOk()->assertJson(['available' => false]);
    }

    public function test_reservation_uses_the_official_amount_and_returns_payment_url(): void
    {
        Http::fake([
            '*' => Http::response(['paymentUrl' => 'https://payments.example.test/checkout'], 201),
        ]);

        $date = today()->addDay()->toDateString();
        $response = $this->postJson('/api/reservations', [
            'name' => 'Mamadou Ndiaye',
            'email' => 'mamadou@gmail.com',
            'phone' => '77 123 45 67',
            'date' => $date,
            'heure' => '16h - 18h',
            'amount' => 15000,
            'payment_method' => 'wave_money',
        ]);

        $response->assertCreated()
            ->assertJsonPath('payment_url', 'https://payments.example.test/checkout');
        $this->assertDatabaseHas('reservations', [
            'date' => $date,
            'heure' => '16:00-18:00',
            'amount' => 15000,
            'status' => 'pending',
        ]);
    }

    public function test_scanning_requires_the_token_and_a_paid_ticket_can_only_be_used_once(): void
    {
        config(['services.scanner.token' => 'test-token']);
        $reservation = Reservation::create($this->reservationData(today()->addDay()->toDateString(), '16:00-18:00', [
            'status' => 'paid',
        ]));

        $this->postJson('/agent/scan', ['qr_token' => $reservation->qr_token])
            ->assertUnauthorized();

        $this->withHeader('Authorization', 'Bearer test-token')
            ->postJson('/agent/scan', ['qr_token' => $reservation->qr_token])
            ->assertOk()
            ->assertJson(['valid' => true]);

        $this->withHeader('Authorization', 'Bearer test-token')
            ->postJson('/agent/scan', ['qr_token' => $reservation->qr_token])
            ->assertStatus(409)
            ->assertJson(['valid' => false]);
    }

    private function reservationData(string $date, string $heure, array $overrides = []): array
    {
        return array_merge([
            'name' => 'Mamadou Ndiaye',
            'email' => 'mamadou@gmail.com',
            'phone' => '+221771234567',
            'date' => $date,
            'heure' => $heure,
            'slot_key' => $date.'_'.$heure,
            'amount' => 15000,
            'currency' => 'XOF',
            'qr_token' => fake()->uuid(),
            'status' => 'pending',
            'is_used' => false,
        ], $overrides);
    }
}
