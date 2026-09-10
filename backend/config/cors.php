<?php

return [
    'paths' => ['api/*'],
    'allowed_methods' => ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    // En production, remplacez les origines locales par le domaine exact du frontend.
    'allowed_origins' => explode(',', env('FRONTEND_ORIGINS', 'http://127.0.0.1:5500,http://localhost:5500,http://127.0.0.1:8080,http://localhost:8080')),
    'allowed_origins_patterns' => [],
    'allowed_headers' => ['Content-Type', 'Accept', 'X-Requested-With', 'Authorization'],
    'exposed_headers' => [],
    'max_age' => 0,
    'supports_credentials' => false,
];
