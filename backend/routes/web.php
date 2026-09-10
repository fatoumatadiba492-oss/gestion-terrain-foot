<?php

use App\Http\Controllers\ReservationController;
use App\Http\Controllers\TerrainController;
use Illuminate\Support\Facades\Route;

Route::view('/', 'welcome');

Route::prefix('api')->middleware('throttle:30,1')->group(function () {
    Route::get('/terrains', [TerrainController::class, 'index'])
        ->name('terrains.index');
    Route::get('/terrains/{terrain}', [TerrainController::class, 'show'])
        ->name('terrains.show');

    Route::get('/reservations/availability', [ReservationController::class, 'availability'])
        ->name('reservations.availability');
    Route::post('/reservations', [ReservationController::class, 'store'])
        ->name('reservations.store');

    Route::middleware(['auth:sanctum', 'admin'])->prefix('admin')->group(function () {
        Route::post('/terrains', [TerrainController::class, 'store'])
            ->name('admin.terrains.store');
        Route::put('/terrains/{terrain}', [TerrainController::class, 'update'])
            ->name('admin.terrains.update');
        Route::delete('/terrains/{terrain}', [TerrainController::class, 'destroy'])
            ->name('admin.terrains.destroy');
    });
});

Route::post('/webhooks/bictorys', [ReservationController::class, 'handleWebhook'])
    ->middleware('throttle:120,1')
    ->name('bictorys.webhook');

Route::get('/reservations/{reservation}/payment-return', [ReservationController::class, 'paymentReturn'])
    ->name('reservations.payment-return');

Route::post('/agent/scan', [ReservationController::class, 'scanTicket'])
    ->middleware(['scanner.token', 'throttle:60,1'])
    ->name('reservations.scan');
