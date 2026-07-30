<?php
require_once __DIR__ . '/credentials-path.php';

define('AUTH_ENV_PATH', __DIR__ . '/../credentials/.env');

$_AUTH_ENV = [];
if (file_exists(AUTH_ENV_PATH)) {
    $parsed = parse_ini_file(AUTH_ENV_PATH, false, INI_SCANNER_TYPED);
    if (is_array($parsed)) {
        $_AUTH_ENV = $parsed;
    }
}

define('GOOGLE_CLIENT_ID', trim((string)($_AUTH_ENV['GOOGLE_CLIENT_ID'] ?? '')));

// CA bundle para validar el SSL de Google. Sin override en el .env se toma el
// cacert.pem de coffee/app/credentials/ (o el de la ruta local historica).
$_AUTH_CA = (string)($_AUTH_ENV['AUTH_CA_BUNDLE'] ?? '');
if ($_AUTH_CA === '') {
    $_AUTH_CA_FILE = coffee_credential_path('cacert.pem');
    if (file_exists($_AUTH_CA_FILE)) $_AUTH_CA = $_AUTH_CA_FILE;
    unset($_AUTH_CA_FILE);
}
define('AUTH_CA_BUNDLE', $_AUTH_CA);

unset($_AUTH_ENV, $_AUTH_CA);

function auth_google_configured(): bool
{
    return GOOGLE_CLIENT_ID !== '' && strpos(GOOGLE_CLIENT_ID, 'REEMPLAZA') === false;
}
