<?php
define('AUTH_ENV_PATH', __DIR__ . '/../credentials/.env');

$_AUTH_ENV = [];
if (file_exists(AUTH_ENV_PATH)) {
    $parsed = parse_ini_file(AUTH_ENV_PATH, false, INI_SCANNER_TYPED);
    if (is_array($parsed)) {
        $_AUTH_ENV = $parsed;
    }
}

define('GOOGLE_CLIENT_ID', trim((string)($_AUTH_ENV['GOOGLE_CLIENT_ID'] ?? '')));

$_AUTH_CA = (string)($_AUTH_ENV['AUTH_CA_BUNDLE'] ?? '');
if ($_AUTH_CA === '' && file_exists('c:/wamp64/credentials/cacert.pem')) {
    $_AUTH_CA = 'c:/wamp64/credentials/cacert.pem';
}
define('AUTH_CA_BUNDLE', $_AUTH_CA);

unset($_AUTH_ENV, $_AUTH_CA);

function auth_google_configured(): bool
{
    return GOOGLE_CLIENT_ID !== '' && strpos(GOOGLE_CLIENT_ID, 'REEMPLAZA') === false;
}
