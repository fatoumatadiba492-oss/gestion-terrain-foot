<?php

declare(strict_types=1);

namespace App\Http\Controllers;

use App\Mail\ReservationConfirmedMail;
use App\Models\Reservation;
use App\Models\Terrain;
use Carbon\Carbon;
use Illuminate\Database\QueryException;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use SimpleSoftwareIO\QrCode\Facades\QrCode;

class ReservationController extends Controller
{
    private const HOLD_MINUTES = 15;

    public function availability(Request $request)
    {
        $data = $this->validatedSlot($request, false);
        $terrain = $this->findReservableTerrain($data['terrain_id']);
        $slot = $this->findConfiguredSlot($terrain, $data['date'], $data['heure']);

        if (! $slot) {
            return response()->json(['available' => false, 'message' => 'Ce créneau n’est pas proposé par ce terrain.'], 404);
        }

        $slotKey = $this->slotKey($data['date'], $data['heure']);
        $taken = Reservation::query()
            ->where('terrain_id', $terrain->id)
            ->where('slot_key', $slotKey)
            ->whereIn('status', ['pending', 'paid', 'manual_review'])
            ->where(function ($query) {
                $query->where('status', 'paid')
                    ->orWhere('created_at', '>=', now()->subMinutes(self::HOLD_MINUTES));
            })
            ->exists();

        return response()->json([
            'available' => ! $taken,
            'terrain_id' => $terrain->id,
            'terrain' => $terrain->name,
            'amount' => (int) $slot->price,
            'currency' => 'XOF',
        ]);
    }

    /** Crée une réservation pending puis retourne l'URL de checkout Bictorys. */
    public function store(Request $request)
    {
        $data = $this->validatedSlot($request, true);
        $terrain = $this->findReservableTerrain($data['terrain_id']);
        $slot = $this->findConfiguredSlot($terrain, $data['date'], $data['heure']);

        if (! $slot) {
            throw ValidationException::withMessages(['heure' => 'Ce créneau n’est pas disponible pour ce terrain.']);
        }

        $amount = (int) $slot->price;

        if ((int) $data['amount'] !== $amount) {
            throw ValidationException::withMessages(['amount' => 'Le montant transmis ne correspond pas au tarif du créneau.']);
        }

        $slotKey = $this->slotKey($data['date'], $data['heure']);

        try {
            $reservation = DB::transaction(function () use ($data, $amount, $slotKey, $terrain) {
                Reservation::query()
                    ->where('status', 'pending')
                    ->where('created_at', '<', now()->subMinutes(self::HOLD_MINUTES))
                    ->whereNotNull('slot_key')
                    ->update(['status' => 'expired', 'slot_key' => null, 'updated_at' => now()]);

                return Reservation::create([
                    'terrain_id' => $terrain->id,
                    'name' => $data['name'],
                    'email' => $data['email'],
                    'phone' => $data['phone'],
                    'date' => $data['date'],
                    'heure' => $data['heure'],
                    'slot_key' => $slotKey,
                    'amount' => $amount,
                    'currency' => 'XOF',
                    'status' => 'pending',
                    'payment_reference' => 'BL-'.Str::upper(Str::random(12)),
                    'qr_token' => (string) Str::uuid(),
                    'is_used' => false,
                ]);
            });
        } catch (QueryException $exception) {
            if (in_array($exception->getCode(), ['23000', '23505'], true)) {
                return response()->json(['message' => 'Ce créneau vient d’être réservé.'], 409);
            }

            Log::error('Création de réservation impossible.', ['exception' => $exception->getMessage()]);
            return response()->json(['message' => 'Impossible de préparer la réservation.'], 500);
        }

        try {
            $response = Http::baseUrl(rtrim((string) config('services.bictorys.base_url'), '/'))
                ->acceptJson()
                ->asJson()
                ->withHeaders([
                    'X-Api-Key' => config('services.bictorys.public_key'),
                    'X-Amzn-Trace-Id' => (string) Str::uuid(),
                ])
                ->timeout(15)
                ->connectTimeout(5)
                ->post('/pay/v1/charges', array_filter([
                    'amount' => $reservation->amount,
                    'currency' => 'XOF',
                    'country' => 'SN',
                    'paymentReference' => $reservation->payment_reference,
                    'merchantReference' => (string) $reservation->id,
                    'successRedirectUrl' => route('reservations.payment-return', ['reservation' => $reservation, 'status' => 'success']),
                    'errorRedirectUrl' => route('reservations.payment-return', ['reservation' => $reservation, 'status' => 'failed']),
                    'customerObject' => ['name' => $reservation->name, 'email' => $reservation->email, 'phone' => $reservation->phone, 'country' => 'SN', 'locale' => 'fr-FR'],
                    'orderDetails' => [[
                        'name' => $terrain->name.' — '.Carbon::parse($reservation->date)->format('d/m/Y').' '.$reservation->heure,
                        'quantity' => 1,
                        'price' => $reservation->amount,
                    ]],
                    'payment_type' => $data['payment_method'] ?? null,
                ], static fn ($value) => $value !== null));

            $response->throw();
            $payload = $response->json();
            $paymentUrl = data_get($payload, 'paymentUrl')
                ?? data_get($payload, 'checkoutUrl')
                ?? data_get($payload, 'confirmationLink')
                ?? data_get($payload, 'url')
                ?? data_get($payload, 'data.paymentUrl')
                ?? data_get($payload, 'data.checkoutUrl')
                ?? data_get($payload, 'data.confirmationLink')
                ?? data_get($payload, 'data.url');

            if (! is_string($paymentUrl) || ! filter_var($paymentUrl, FILTER_VALIDATE_URL)) {
                throw new \RuntimeException('URL Bictorys absente ou invalide.');
            }

            $reservation->update([
                'bictorys_transaction_id' => data_get($payload, 'id') ?? data_get($payload, 'data.id'),
                'gateway_payload' => $payload,
            ]);

            return response()->json(['reservation_id' => $reservation->id, 'payment_url' => $paymentUrl], 201);
        } catch (ConnectionException|\Illuminate\Http\Client\RequestException|\RuntimeException $exception) {
            $reservation->update(['status' => 'failed', 'slot_key' => null]);
            Log::error('Initialisation Bictorys échouée.', ['reservation_id' => $reservation->id, 'message' => $exception->getMessage()]);
            return response()->json(['message' => 'Le paiement est temporairement indisponible.'], 502);
        }
    }

    public function handleWebhook(Request $request)
    {
        $incomingSecret = (string) $request->header('X-Secret-Key');
        $webhookSecret = (string) config('services.bictorys.webhook_secret');
        if ($incomingSecret === '' || $webhookSecret === '' || ! hash_equals($webhookSecret, $incomingSecret)) {
            Log::warning('Webhook Bictorys rejeté.', ['ip' => $request->ip()]);
            return response()->json(['message' => 'Unauthorized'], 401);
        }

        $payload = $request->json()->all();
        validator($payload, [
            'id' => ['required', 'string', 'max:100'],
            'paymentReference' => ['required', 'string', 'max:100'],
            'amount' => ['required', 'integer', 'min:1'],
            'currency' => ['required', 'string', 'size:3'],
            'status' => ['required', 'string', 'max:30'],
        ])->validate();

        $status = Str::lower((string) $payload['status']);
        if (! in_array($status, ['succeeded', 'authorized'], true)) {
            if (in_array($status, ['failed', 'cancelled', 'reversed'], true)) {
                Reservation::query()->where('payment_reference', $payload['paymentReference'])->where('status', 'pending')
                    ->update(['status' => 'failed', 'slot_key' => null, 'gateway_payload' => $payload]);
            }
            return response()->json(['received' => true]);
        }

        try {
            DB::transaction(function () use ($payload) {
                $reservation = Reservation::query()->where('payment_reference', $payload['paymentReference'])->lockForUpdate()->firstOrFail();
                if ($reservation->status === 'paid') return;
                if ((int) $payload['amount'] !== (int) $reservation->amount || strtoupper((string) $payload['currency']) !== 'XOF') {
                    $reservation->update(['status' => 'manual_review', 'gateway_payload' => $payload]);
                    Log::critical('Montant Bictorys incohérent.', ['reservation_id' => $reservation->id]);
                    return;
                }
                $verified = $this->verifyGatewayTransaction((string) $payload['id']);
                if (! in_array($verified['status'], ['succeeded', 'authorized'], true)
                    || $verified['paymentReference'] !== $reservation->payment_reference
                    || $verified['amount'] !== (int) $reservation->amount
                    || $verified['currency'] !== 'XOF') {
                    throw new \RuntimeException('Vérification transactionnelle Bictorys invalide.');
                }
                $reservation->update(['status' => 'paid', 'paid_at' => now(), 'bictorys_transaction_id' => $payload['id'], 'gateway_payload' => $payload]);
                $this->sendTicket($reservation->fresh());
            });
            return response()->json(['received' => true]);
        } catch (\Throwable $exception) {
            Log::error('Traitement webhook Bictorys échoué.', ['message' => $exception->getMessage(), 'transaction_id' => $payload['id']]);
            return response()->json(['message' => 'Temporary failure'], 500);
        }
    }

    public function scanTicket(Request $request)
    {
        $token = $request->validate(['qr_token' => ['required', 'uuid']])['qr_token'];
        return DB::transaction(function () use ($token) {
            $reservation = Reservation::query()->where('qr_token', $token)->lockForUpdate()->first();
            if (! $reservation) return response()->json(['valid' => false, 'message' => 'Ticket introuvable.'], 404);
            if ($reservation->status !== 'paid') return response()->json(['valid' => false, 'message' => 'Ce ticket n’est pas réglé.'], 403);
            if ($reservation->is_used) return response()->json(['valid' => false, 'message' => 'Ce ticket a déjà été utilisé.', 'used_at' => $reservation->used_at?->toIso8601String()], 409);
            $reservation->update(['is_used' => true, 'used_at' => now()]);
            return response()->json(['valid' => true, 'message' => 'Entrée autorisée. Bon match !', 'client' => $reservation->name, 'creneau' => $reservation->date.' ('.$reservation->heure.')']);
        });
    }

    public function paymentReturn(Request $request, Reservation $reservation)
    {
        $qrCodeImage = null;
        if ($reservation->status === 'paid' && $reservation->qr_code_path && Storage::disk('local')->exists($reservation->qr_code_path)) {
            $qrCodeImage = Storage::disk('local')->get($reservation->qr_code_path);
        }
        return response()->view('payment-return', compact('reservation', 'qrCodeImage'));
    }

    private function validatedSlot(Request $request, bool $withCustomer): array
    {
        $request->merge([
            'heure' => $this->normalizeTimeRange((string) $request->input('heure')),
            'phone' => $this->normalizeSenegalPhone((string) $request->input('phone')),
            'email' => Str::lower(trim((string) $request->input('email'))),
            'name' => trim((string) $request->input('name')),
        ]);

        $rules = [
            'terrain_id' => ['required', 'integer', 'exists:terrains,id'],
            'date' => ['required', 'date_format:Y-m-d', 'after_or_equal:today'],
            'heure' => ['required', 'regex:/^([01][0-9]|2[0-3]):[0-5][0-9]-([01][0-9]|2[0-3]):[0-5][0-9]$/'],
        ];
        if ($withCustomer) {
            $rules += [
                'name' => ['required', 'string', 'min:2', 'max:120'],
                'email' => ['required', 'email:rfc,dns', 'max:150'],
                'phone' => ['required', 'regex:/^\+221[0-9]{9}$/'],
                'amount' => ['required', 'integer', 'min:1', 'max:10000000'],
                'payment_method' => ['nullable', 'in:wave_money,orange_money'],
            ];
        }
        $data = $request->validate($rules);
        [$start, $end] = explode('-', $data['heure']);
        if (Carbon::createFromFormat('H:i', $end)->lessThanOrEqualTo(Carbon::createFromFormat('H:i', $start))) {
            throw ValidationException::withMessages(['heure' => 'L’heure de fin doit être postérieure à l’heure de début.']);
        }
        return $data;
    }

    private function findReservableTerrain(int $terrainId): Terrain
    {
        $terrain = Terrain::query()->whereKey($terrainId)->where('status', 'active')->first();
        if (! $terrain) throw ValidationException::withMessages(['terrain_id' => 'Terrain indisponible.']);
        return $terrain;
    }

    private function findConfiguredSlot(Terrain $terrain, string $date, string $heure)
    {
        [$start, $end] = explode('-', $heure);
        $day = Carbon::createFromFormat('Y-m-d', $date)->isoWeekday();
        return $terrain->slots()->where('day_of_week', $day)->where('start_time', $start.':00')->where('end_time', $end.':00')->where('is_active', true)->first();
    }

    private function normalizeTimeRange(string $value): string
    {
        return preg_replace('/\s+/', '', str_replace('h', ':00', trim($value))) ?? '';
    }

    private function normalizeSenegalPhone(string $phone): string
    {
        $phone = preg_replace('/[^\d+]/', '', $phone) ?? '';
        if (str_starts_with($phone, '00221')) $phone = '+'.substr($phone, 2);
        if (preg_match('/^\d{9}$/', $phone) === 1) $phone = '+221'.$phone;
        return str_starts_with($phone, '221') ? '+'.$phone : $phone;
    }

    private function slotKey(string $date, string $heure): string
    {
        return $date.'_'.$heure;
    }

    private function verifyGatewayTransaction(string $transactionId): array
    {
        $response = Http::baseUrl(rtrim((string) config('services.bictorys.base_url'), '/'))->acceptJson()
            ->withHeaders(['X-Api-Key' => config('services.bictorys.public_key')])->timeout(15)->connectTimeout(5)
            ->get('/pay/v1/transactions/'.$transactionId.'/status');
        $response->throw();
        $data = $response->json('data', $response->json());
        return ['status' => Str::lower((string) data_get($data, 'status')), 'paymentReference' => (string) data_get($data, 'paymentReference'), 'amount' => (int) data_get($data, 'amount'), 'currency' => strtoupper((string) data_get($data, 'currency'))];
    }

    private function sendTicket(Reservation $reservation): void
    {
        $path = 'tickets/'.$reservation->qr_token.'.png';
        $image = QrCode::format('png')->size(500)->margin(2)->errorCorrection('H')->generate($reservation->qr_token);
        Storage::disk('local')->put($path, $image);
        $reservation->update(['qr_code_path' => $path]);
        Mail::to($reservation->email)->queue(new ReservationConfirmedMail($reservation->fresh(), $image));
    }
}
