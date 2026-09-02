<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            $table->string('currency', 3)->default('XOF')->after('amount');
            $table->unique('payment_reference');
            $table->unique('bictorys_transaction_id');
        });
    }

    public function down(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            $table->dropUnique(['payment_reference']);
            $table->dropUnique(['bictorys_transaction_id']);
            $table->dropColumn('currency');
        });
    }
};
