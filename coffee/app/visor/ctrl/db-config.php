<?php
/**
 * Configuracion de conexion MySQL para el chat (CoffeeIA).
 * Lee variables desde coffee/app/credentials/.env (el mismo .env de Ollama/OpenRouter).
 *
 * El chat introspecciona el esquema de CUALQUIER base local y opcionalmente ejecuta
 * SELECT de solo lectura. Las credenciales SIEMPRE viven aqui (server-side); nunca
 * se mandan al modelo. Por defecto, el root local de WAMP (sin password).
 */

define('DB_ENV_PATH', __DIR__ . '/../../credentials/.env');

$_DB_ENV = is_file(DB_ENV_PATH) ? parse_ini_file(DB_ENV_PATH, false, INI_SCANNER_TYPED) : [];
if (!is_array($_DB_ENV)) $_DB_ENV = [];

define('DB_HOST', $_DB_ENV['DB_HOST'] ?? '127.0.0.1');
define('DB_PORT', (int)($_DB_ENV['DB_PORT'] ?? 3306));
define('DB_USER', $_DB_ENV['DB_USER'] ?? 'root');
define('DB_PASS', (string)($_DB_ENV['DB_PASS'] ?? ''));

// Esquemas de sistema que nunca se exponen al chat.
define('DB_SYSTEM_SCHEMAS', 'information_schema,mysql,performance_schema,sys');

// Tope de filas que puede devolver un SELECT en vivo (defensa, ademas del LIMIT).
define('DB_MAX_ROWS', (int)($_DB_ENV['DB_MAX_ROWS'] ?? 200));

// Lista blanca opcional de bases expuestas (CSV). Vacio = todas las no-sistema.
define('DB_ALLOWED_SCHEMAS', (string)($_DB_ENV['DB_ALLOWED_SCHEMAS'] ?? ''));

unset($_DB_ENV);
