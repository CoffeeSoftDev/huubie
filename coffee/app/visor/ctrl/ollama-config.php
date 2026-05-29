<?php
/**
 * Configuracion del cliente Ollama Cloud.
 * Lee variables desde coffee/app/credentials/.env
 */

define('OLLAMA_ENV_PATH', __DIR__ . '/../../credentials/.env');

if (!file_exists(OLLAMA_ENV_PATH)) {
    throw new RuntimeException(
        'Falta archivo .env en coffee/app/credentials/. ' .
        'Copia .env.example a .env y rellena OLLAMA_API_KEY.'
    );
}

$_OLLAMA_ENV = parse_ini_file(OLLAMA_ENV_PATH, false, INI_SCANNER_TYPED);
if ($_OLLAMA_ENV === false) {
    throw new RuntimeException('No se pudo parsear coffee/app/credentials/.env');
}

define('OLLAMA_API_KEY',       $_OLLAMA_ENV['OLLAMA_API_KEY']       ?? '');
define('OLLAMA_BASE_URL',      $_OLLAMA_ENV['OLLAMA_BASE_URL']      ?? 'https://ollama.com');
define('OLLAMA_DEFAULT_MODEL', $_OLLAMA_ENV['OLLAMA_DEFAULT_MODEL'] ?? 'qwen3-coder:480b-cloud');
define('OLLAMA_TIMEOUT',       (int)($_OLLAMA_ENV['OLLAMA_TIMEOUT'] ?? 120));
define('OLLAMA_CA_BUNDLE',     $_OLLAMA_ENV['OLLAMA_CA_BUNDLE']     ?? '');

unset($_OLLAMA_ENV);
