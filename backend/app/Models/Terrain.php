<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;

class Terrain extends Model
{
    use HasFactory;

    protected $fillable = [
        'owner_id', 'name', 'slug', 'description', 'address', 'quartier', 'city',
        'latitude', 'longitude', 'phone', 'image', 'type', 'capacity', 'status',
    ];

    protected function casts(): array
    {
        return [
            'latitude' => 'decimal:7',
            'longitude' => 'decimal:7',
            'capacity' => 'integer',
        ];
    }

    public function owner(): BelongsTo
    {
        return $this->belongsTo(User::class, 'owner_id');
    }

    public function slots(): HasMany
    {
        return $this->hasMany(TerrainSlot::class);
    }

    public function reservations(): HasMany
    {
        return $this->hasMany(Reservation::class);
    }
}
