<?php

$configuredOrigins = array_filter(array_map('trim', explode(',', env('FRONTEND_ORIGINS', ''))));

return [
    'paths' => ['api/*'],
    'allowed_methods' => ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    // En production, configure FRONTEND_ORIGINS avec le domaine exact du frontend.
    // 'null' correspond à l'origine utilisée par Firefox lorsqu'admin.html est ouvert directement en file://.
    'allowed_origins' => array_values(array_unique(array_merge([
        'null',
        'http://127.0.0.1:5500',
        'http://localhost:5500',
        'http://127.0.0.1:8080',
        'http://localhost:8080',
    ], $configuredOrigins))),
    'allowed_origins_patterns' => [],
    'allowed_headers' => ['Content-Type', 'Accept', 'X-Requested-With', 'Authorization'],
    'exposed_headers' => [],
    'max_age' => 0,
    'supports_credentials' => false,
];
