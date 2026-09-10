<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

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
}
