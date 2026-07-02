<?php
/**
 * Configuracion de acceso a CARPETAS locales para el chat (CoffeeIA).
 * Lee del mismo coffee/app/credentials/.env que Ollama/OpenRouter/MySQL.
 *
 * Permite que el chat "se conecte" a una carpeta de proyecto (ej. costsys) y la
 * navegue en SOLO LECTURA con tool-calling (list_dir / read_file / grep_files).
 * El acceso queda SANDBOX-eado a una whitelist de raices (FS_ALLOWED_ROOTS); el
 * modelo nunca ve rutas fuera de la carpeta conectada.
 */

if (!defined('FS_ENV_PATH')) define('FS_ENV_PATH', __DIR__ . '/../../credentials/.env');

$_FS_ENV = is_file(FS_ENV_PATH) ? parse_ini_file(FS_ENV_PATH, false, INI_SCANNER_TYPED) : [];
if (!is_array($_FS_ENV)) $_FS_ENV = [];

// Raices permitidas (CSV de rutas absolutas). Default: el www de WAMP (localhost).
// Cualquier carpeta a conectar debe vivir DENTRO de una de estas raices.
define('FS_ALLOWED_ROOTS', (string)($_FS_ENV['FS_ALLOWED_ROOTS'] ?? 'C:/wamp64/www'));

// Limites defensivos.
define('FS_MAX_FILE_BYTES',   (int)($_FS_ENV['FS_MAX_FILE_BYTES']   ?? 65536));  // tope por read_file
define('FS_MAX_TREE_ENTRIES', (int)($_FS_ENV['FS_MAX_TREE_ENTRIES'] ?? 600));    // entradas del arbol inyectado
define('FS_MAX_LIST_ENTRIES', (int)($_FS_ENV['FS_MAX_LIST_ENTRIES'] ?? 300));    // entradas por list_dir
define('FS_MAX_GREP_HITS',    (int)($_FS_ENV['FS_MAX_GREP_HITS']    ?? 80));     // coincidencias por grep_files

// Carpetas que nunca se exploran (ruido / dependencias / control de versiones).
define('FS_IGNORE_DIRS', (string)($_FS_ENV['FS_IGNORE_DIRS']
    ?? '.git,node_modules,vendor,dist,build,.next,.nuxt,.cache,coverage,tmp,.idea,.vscode'));

// Extensiones binarias: aparecen en el arbol pero NO se leen como texto.
define('FS_BINARY_EXTS', (string)($_FS_ENV['FS_BINARY_EXTS']
    ?? 'png,jpg,jpeg,gif,webp,ico,bmp,pdf,zip,rar,7z,gz,tar,exe,dll,so,bin,mp4,mp3,wav,mov,avi,woff,woff2,ttf,eot,otf,lock,map,class,o,a,psd,ai'));

// Archivos SENSIBLES (patrones fnmatch sobre el nombre): nunca se leen, ni se
// grep-ean, ni aparecen en arbol/listados. Evita que credenciales del propio www
// (p.ej. coffee/app/credentials/.env) terminen en el contexto de un LLM externo.
define('FS_DENY_FILES', (string)($_FS_ENV['FS_DENY_FILES']
    ?? '.env,.env.*,*.pem,*.key,*.p12,*.pfx,*.jks,*.keystore,id_rsa*,id_ed25519*,*.htpasswd,secrets.*,credentials.*'));

// Carpetas SENSIBLES: mismo tratamiento que FS_IGNORE_DIRS pero por motivo de
// seguridad (separadas para poder relajar el ruido sin exponer credenciales).
define('FS_DENY_DIRS', (string)($_FS_ENV['FS_DENY_DIRS'] ?? 'credentials,secrets,.ssh,.aws,.gnupg'));

unset($_FS_ENV);
