<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('terrain_slots', function (Blueprint $table) {
            $table->id();
            $table->foreignId('terrain_id')->constrained()->cascadeOnDelete();
            $table->unsignedTinyInteger('day_of_week');
            $table->time('start_time');
            $table->time('end_time');
            $table->unsignedInteger('price');
            $table->boolean('is_active')->default(true);
            $table->timestamps();

            $table->unique(
                ['terrain_id', 'day_of_week', 'start_time', 'end_time'],
                'terrain_slots_schedule_unique'
            );
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('terrain_slots');
    }
};
