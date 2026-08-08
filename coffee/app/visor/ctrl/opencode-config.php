<?php
/**
 * Configuracion del gateway OpenCode (Zen y Go). API OpenAI-compatible, mismo
 * dialecto que OpenRouter — por eso el cliente reusa aquel motor.
 *
 * Dos destinos posibles, se elige con OPENCODE_BASE_URL:
 *   - Zen  https://opencode.ai/zen/v1      → los modelos *-free responden SIN key.
 *   - Go   https://opencode.ai/zen/go/v1   → suscripcion; sin key devuelve 401.
 *
 * A diferencia de OpenRouter, aqui la key puede ir vacia (tier free) y por eso
 * este archivo NO revienta si falta: el que decide es el modelo que se pida.
 */

require_once __DIR__ . '/../../ctrl/credentials-path.php';

define('OPENCODE_ENV_PATH', __DIR__ . '/../../credentials/.env');

if (!file_exists(OPENCODE_ENV_PATH)) {
    throw new RuntimeException(
        'Falta archivo .env en coffee/app/credentials/. ' .
        'Copia .env.example a .env y rellena el bloque OPENCODE_*.'
    );
}

$_OPENCODE_ENV = parse_ini_file(OPENCODE_ENV_PATH, false, INI_SCANNER_TYPED);
if ($_OPENCODE_ENV === false) {
    throw new RuntimeException('No se pudo parsear coffee/app/credentials/.env');
}

// Prefijo con el que viajan los ids en el frontend ('opencode/glm-5.2'). Los ids
// de OpenCode son pelones ('glm-5.2') y chocarian con los de Ollama Cloud
// ('glm-5.2:cloud'), asi que el prefijo es lo unico que distingue al proveedor.
define('OPENCODE_PREFIX', 'opencode/');

define('OPENCODE_API_KEY',       $_OPENCODE_ENV['OPENCODE_API_KEY']       ?? '');
define('OPENCODE_BASE_URL',      $_OPENCODE_ENV['OPENCODE_BASE_URL']      ?? 'https://opencode.ai/zen/v1');
define('OPENCODE_DEFAULT_MODEL', $_OPENCODE_ENV['OPENCODE_DEFAULT_MODEL'] ?? 'deepseek-v4-flash-free');
define('OPENCODE_VISION_MODEL',  $_OPENCODE_ENV['OPENCODE_VISION_MODEL']  ?? 'opencode/mimo-v2.5-free');
define('OPENCODE_TIMEOUT',       (int)($_OPENCODE_ENV['OPENCODE_TIMEOUT'] ?? 600));

// Mismo criterio que Ollama/OpenRouter: si la ruta del .env no resuelve (se
// configuro en otra maquina), se cae al cacert.pem que viaja con el proyecto.
$_OPENCODE_CA = (string)($_OPENCODE_ENV['OPENCODE_CA_BUNDLE'] ?? '');
if ($_OPENCODE_CA === '' || !file_exists($_OPENCODE_CA)) {
    $_OPENCODE_CA_FILE = coffee_credential_path('cacert.pem');
    $_OPENCODE_CA = file_exists($_OPENCODE_CA_FILE) ? $_OPENCODE_CA_FILE : '';
    unset($_OPENCODE_CA_FILE);
}
define('OPENCODE_CA_BUNDLE', $_OPENCODE_CA);

define('OPENCODE_APP_TITLE', $_OPENCODE_ENV['OPENCODE_APP_TITLE'] ?? 'Huubie Visor');

unset($_OPENCODE_ENV, $_OPENCODE_CA);
