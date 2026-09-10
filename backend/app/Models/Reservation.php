<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Reservation extends Model
{
    use HasFactory;

    protected $fillable = [
        'terrain_id', 'name', 'email', 'phone', 'date', 'heure', 'slot_key', 'amount', 'currency',
        'qr_token', 'qr_code_path', 'status', 'is_used', 'used_at', 'paid_at',
        'payment_reference', 'bictorys_transaction_id', 'gateway_payload',
    ];

    protected function casts(): array
    {
        return [
            'gateway_payload' => 'array',
            'amount' => 'integer',
            'paid_at' => 'datetime',
            'used_at' => 'datetime',
            'is_used' => 'boolean',
        ];
    }

    public function terrain(): BelongsTo
    {
        return $this->belongsTo(Terrain::class);
    }
}
