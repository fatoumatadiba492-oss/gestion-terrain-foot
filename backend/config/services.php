<?php

return [
    'bictorys' => [
        'base_url' => env('BICTORYS_BASE_URL', 'https://api.test.bictorys.com'),
        // Ne jamais exposer ces valeurs côté navigateur.
        'public_key' => env('BICTORYS_API_KEY'),
        'webhook_secret' => env('BICTORYS_WEBHOOK_SECRET'),
    ],

    'scanner' => [
        'token' => env('SCANNER_TOKEN'),
    ],
];
