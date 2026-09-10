<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            $table->dropUnique('reservations_slot_key_unique');
            $table->unique(['terrain_id', 'slot_key'], 'reservations_terrain_slot_unique');
        });
    }

    public function down(): void
    {
        Schema::table('reservations', function (Blueprint $table) {
            $table->dropUnique('reservations_terrain_slot_unique');
            $table->unique('slot_key', 'reservations_slot_key_unique');
        });
    }
};
