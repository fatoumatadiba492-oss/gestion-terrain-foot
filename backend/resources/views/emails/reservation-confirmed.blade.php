<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Confirmation</title>
</head>
<body style="font-family: Arial, sans-serif; background-color: #f4f4f4; padding: 20px;">
    <div style="max-width: 600px; background: #ffffff; padding: 30px; border-radius: 8px; margin: auto;">
        <h2 style="color: #059669;">Terrain Municipal Birane Ly</h2>
        <p>Bonjour <strong>{{ $reservation->name }}</strong>,</p>
        <p>Votre réservation pour le <strong>{{ $reservation->date }}</strong> de <strong>{{ $reservation->heure }}</strong> a bien été confirmée et payée.</p>

        <div style="text-align: center; margin: 30px 0;">
            <p>Présentez ce QR Code à l'entrée du terrain :</p>
            <img src="data:image/png;base64,{{ base64_encode($qrCodeImage) }}" alt="QR Code d'accès" style="width: 200px; height: 200px;">
        </div>

        <p style="font-size: 12px; color: #666; text-align: center;">Terrain Municipal Birane Ly - Parcelles Assainies, Dakar</p>
    </div>
</body>
</html>
