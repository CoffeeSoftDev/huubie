<?php
/**
 * Configuracion del cliente OpenRouter (API OpenAI-compatible).
 * Lee variables desde coffee/app/credentials/.env (el mismo .env de Ollama).
 */

define('OPENROUTER_ENV_PATH', __DIR__ . '/../../credentials/.env');

if (!file_exists(OPENROUTER_ENV_PATH)) {
    throw new RuntimeException(
        'Falta archivo .env en coffee/app/credentials/. ' .
        'Copia .env.example a .env y rellena OPENROUTER_API_KEY.'
    );
}

$_OPENROUTER_ENV = parse_ini_file(OPENROUTER_ENV_PATH, false, INI_SCANNER_TYPED);
if ($_OPENROUTER_ENV === false) {
    throw new RuntimeException('No se pudo parsear coffee/app/credentials/.env');
}

define('OPENROUTER_API_KEY',       $_OPENROUTER_ENV['OPENROUTER_API_KEY']       ?? '');
define('OPENROUTER_BASE_URL',      $_OPENROUTER_ENV['OPENROUTER_BASE_URL']      ?? 'https://openrouter.ai/api/v1');
define('OPENROUTER_DEFAULT_MODEL', $_OPENROUTER_ENV['OPENROUTER_DEFAULT_MODEL'] ?? 'anthropic/claude-sonnet-4');
define('OPENROUTER_VISION_MODEL',  $_OPENROUTER_ENV['OPENROUTER_VISION_MODEL']  ?? 'google/gemini-2.0-flash-001');
define('OPENROUTER_TIMEOUT',       (int)($_OPENROUTER_ENV['OPENROUTER_TIMEOUT'] ?? 240));
define('OPENROUTER_CA_BUNDLE',     $_OPENROUTER_ENV['OPENROUTER_CA_BUNDLE']     ?? '');

// Cabeceras opcionales para el ranking/identificacion en openrouter.ai.
define('OPENROUTER_APP_TITLE',     $_OPENROUTER_ENV['OPENROUTER_APP_TITLE']     ?? 'Huubie Visor');
define('OPENROUTER_APP_REFERER',   $_OPENROUTER_ENV['OPENROUTER_APP_REFERER']   ?? '');

unset($_OPENROUTER_ENV);
