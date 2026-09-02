<?php

use App\Http\Controllers\ReservationController;
use Illuminate\Support\Facades\Route;

Route::view('/', 'welcome');

Route::prefix('api')->middleware('throttle:30,1')->group(function () {
    Route::get('/reservations/availability', [ReservationController::class, 'availability'])
        ->name('reservations.availability');
    Route::post('/reservations', [ReservationController::class, 'store'])
        ->name('reservations.store');
});

// Configurez cette URL HTTPS dans le tableau de bord Bictorys.
Route::post('/webhooks/bictorys', [ReservationController::class, 'handleWebhook'])
    ->middleware('throttle:120,1')
    ->name('bictorys.webhook');

Route::get('/reservations/{reservation}/payment-return', [ReservationController::class, 'paymentReturn'])
    ->name('reservations.payment-return');

// Ajouter auth + une ability dédiée avant la mise en production.
Route::post('/agent/scan', [ReservationController::class, 'scanTicket'])
    ->middleware(['scanner.token', 'throttle:60,1'])
    ->name('reservations.scan');
