<!DOCTYPE html>
<html lang="fr">
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>Retour de paiement | Terrain Birane Ly</title>
    <style>
        body { margin: 0; padding: 2rem 1rem; background: #f0fdf4; color: #172033; font-family: Arial, sans-serif; }
        main { max-width: 32rem; margin: 0 auto; padding: 2rem; background: white; border-radius: 1rem; box-shadow: 0 10px 30px rgb(15 23 42 / 10%); text-align: center; }
        .status { color: {{ $reservation->status === 'paid' ? '#15803d' : '#b45309' }}; }
        .details { margin: 1.5rem 0; padding: 1rem; background: #f8fafc; text-align: left; border-radius: .75rem; }
        img { width: 12rem; height: 12rem; }
        a { display: inline-block; margin-top: 1rem; color: #166534; font-weight: bold; }
    </style>
</head>
<body>
    <main>
        @if ($reservation->status === 'paid')
            <h1 class="status">Paiement confirmé</h1>
            <p>Votre réservation est validée. Votre ticket est également envoyé par e-mail.</p>
            <div class="details">
                <p><strong>Référence :</strong> {{ $reservation->payment_reference }}</p>
                <p><strong>Date :</strong> {{ $reservation->date }}</p>
                <p><strong>Créneau :</strong> {{ $reservation->heure }}</p>
                <p><strong>Montant :</strong> {{ number_format((int) $reservation->amount, 0, ',', ' ') }} {{ $reservation->currency }}</p>
            </div>
            @if ($qrCodeImage)
                <img src="data:image/png;base64,{{ base64_encode($qrCodeImage) }}" alt="QR code du ticket">
                <p>Présentez ce QR code à l'entrée du terrain.</p>
            @endif
        @elseif ($reservation->status === 'failed')
            <h1 class="status">Paiement non confirmé</h1>
            <p>Le paiement n'a pas été validé. Aucun ticket n'a été émis.</p>
        @else
            <h1 class="status">Paiement en cours</h1>
            <p>Votre paiement est en cours de vérification. Votre ticket sera envoyé par e-mail dès confirmation.</p>
        @endif
        <a href="{{ url('/') }}">Retour au site</a>
    </main>
</body>
</html>
