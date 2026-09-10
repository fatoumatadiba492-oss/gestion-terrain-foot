<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class TerrainSlot extends Model
{
    use HasFactory;

    protected $fillable = [
        'terrain_id', 'day_of_week', 'start_time', 'end_time', 'price', 'is_active',
    ];

    protected function casts(): array
    {
        return [
            'day_of_week' => 'integer',
            'price' => 'integer',
            'is_active' => 'boolean',
        ];
    }

    public function terrain(): BelongsTo
    {
        return $this->belongsTo(Terrain::class);
    }

    public function reservations(): HasMany
    {
        return $this->hasMany(Reservation::class, 'terrain_id', 'terrain_id');
    }
}
