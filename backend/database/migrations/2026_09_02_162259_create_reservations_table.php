<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('reservations', function (Blueprint $table) {
            $table->id();
            $table->string('name');
            $table->string('email');
            $table->string('phone');
            $table->date('date');
            $table->string('heure'); // Ex: "18h-20h"
            $table->string('slot_key')->unique()->nullable(); // Empêche les doubles réservations d'un même créneau
            $table->decimal('amount', 10, 2);
            $table->string('qr_token')->unique();
            $table->string('qr_code_path')->nullable();
            $table->string('status')->default('pending'); // pending, paid, failed, expired, manual_review, cancelled
            $table->boolean('is_used')->default(false);
            $table->timestamp('used_at')->nullable();
            $table->timestamp('paid_at')->nullable();
            $table->string('payment_reference')->nullable();
            $table->string('bictorys_transaction_id')->nullable();
            $table->json('gateway_payload')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('reservations');
    }
};
