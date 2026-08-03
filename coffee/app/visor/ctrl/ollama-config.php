<?php
/**
 * Configuracion del cliente Ollama Cloud.
 * Lee variables desde coffee/app/credentials/.env
 */

require_once __DIR__ . '/../../ctrl/credentials-path.php';

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
// Ollama retira modelos sin aviso y devuelve HTTP 410: este respaldo solo entra
// si el .env no declara la clave, asi que debe apuntar a un modelo vigente.
define('OLLAMA_DEFAULT_MODEL', $_OLLAMA_ENV['OLLAMA_DEFAULT_MODEL'] ?? 'glm-5.2:cloud');
define('OLLAMA_VISION_MODEL',  $_OLLAMA_ENV['OLLAMA_VISION_MODEL']  ?? 'kimi-k2.7-code:cloud');
define('OLLAMA_TIMEOUT',       (int)($_OLLAMA_ENV['OLLAMA_TIMEOUT'] ?? 240));
// El .env puede traer una ruta de la maquina donde se configuro; si ahi no hay
// nada (tipico al subir al servidor) se usa el cacert.pem que viaja con el
// proyecto en coffee/app/credentials/.
$_OLLAMA_CA = (string)($_OLLAMA_ENV['OLLAMA_CA_BUNDLE'] ?? '');
if ($_OLLAMA_CA === '' || !file_exists($_OLLAMA_CA)) {
    $_OLLAMA_CA_FILE = coffee_credential_path('cacert.pem');
    $_OLLAMA_CA = file_exists($_OLLAMA_CA_FILE) ? $_OLLAMA_CA_FILE : '';
    unset($_OLLAMA_CA_FILE);
}
define('OLLAMA_CA_BUNDLE', $_OLLAMA_CA);

unset($_OLLAMA_ENV, $_OLLAMA_CA);
