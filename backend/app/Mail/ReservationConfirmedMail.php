<?php

namespace App\Mail;

use App\Models\Reservation;
use Illuminate\Bus\Queueable;
use Illuminate\Mail\Mailable;
use Illuminate\Mail\Mailables\Content;
use Illuminate\Mail\Mailables\Envelope;
use Illuminate\Queue\SerializesModels;

class ReservationConfirmedMail extends Mailable
{
    use Queueable, SerializesModels;

    public $reservation;
    public $qrCodeImage;

    public function __construct(Reservation $reservation, string $qrCodeImage)
    {
        $this->reservation = $reservation;
        $this->qrCodeImage = $qrCodeImage;
    }

    public function envelope(): Envelope
    {
        return new Envelope(
            subject: 'Confirmation de réservation - Terrain Municipal Birane Ly',
        );
    }

    public function content(): Content
    {
        return new Content(
            view: 'emails.reservation-confirmed', // Vue Blade pour l'e-mail
        );
    }
}