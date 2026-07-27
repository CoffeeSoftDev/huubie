<?php
/**
 * Configuracion de SERVIDORES REMOTOS (FTP/FTPS/SFTP) para el chat (CoffeeIA).
 * Lee del mismo coffee/app/credentials/.env que Ollama/OpenRouter/MySQL/carpetas.
 *
 * El agente los consulta en SOLO LECTURA con tool-calling (ftp_list / ftp_read).
 * Las credenciales viven UNICAMENTE aqui: el modelo solo conoce el ALIAS del
 * servidor, nunca el usuario ni la contrasena, y el navegador tampoco las recibe.
 *
 * Formato en el .env — una entrada por servidor:
 *
 *   FTP_PROD_URL  = ftps://usuario:clave@ftp.midominio.com:21
 *   FTP_PROD_ROOT = /public_html          ; opcional, carpeta a la que se ancla
 *   FTP_PROD_LABEL = Produccion           ; opcional, nombre legible
 *
 * El alias es lo que va entre FTP_ y _URL, en minusculas: aqui seria "prod".
 * Esquemas admitidos: ftp, ftps (FTP sobre TLS) y sftp (SSH). Si la contrasena
 * lleva caracteres raros (@ : / #), escribela URL-encoded (%40, %3A...).
 */

if (!defined('FTP_ENV_PATH')) define('FTP_ENV_PATH', __DIR__ . '/../../credentials/.env');

$_FTP_ENV = is_file(FTP_ENV_PATH) ? parse_ini_file(FTP_ENV_PATH, false, INI_SCANNER_RAW) : [];
if (!is_array($_FTP_ENV)) $_FTP_ENV = [];

// Limites defensivos (mismos criterios que la lectura de carpetas locales).
define('FTP_TIMEOUT',           (int)($_FTP_ENV['FTP_TIMEOUT']           ?? 25));     // segundos por operacion
define('FTP_CONNECT_TIMEOUT',   (int)($_FTP_ENV['FTP_CONNECT_TIMEOUT']   ?? 10));
define('FTP_MAX_FILE_BYTES',    (int)($_FTP_ENV['FTP_MAX_FILE_BYTES']    ?? 65536));  // tope por ftp_read
define('FTP_MAX_LIST_ENTRIES',  (int)($_FTP_ENV['FTP_MAX_LIST_ENTRIES']  ?? 300));    // entradas por ftp_list
// Modo pasivo: lo normal detras de un firewall/NAT. 0 = activo.
define('FTP_PASSIVE',           (int)($_FTP_ENV['FTP_PASSIVE']           ?? 1));
// Certificado del servidor en FTPS: 0 = no verificar (util con certificados
// autofirmados de hosting compartido). Ponlo en 1 si tu servidor tiene un
// certificado valido y quieres verificacion estricta.
define('FTP_VERIFY_CERT',       (int)($_FTP_ENV['FTP_VERIFY_CERT']       ?? 0));

// Extensiones binarias: aparecen en el listado pero NO se leen como texto.
define('FTP_BINARY_EXTS', (string)($_FTP_ENV['FTP_BINARY_EXTS']
    ?? 'png,jpg,jpeg,gif,webp,ico,bmp,pdf,zip,rar,7z,gz,tar,exe,dll,so,bin,mp4,mp3,wav,mov,avi,woff,woff2,ttf,eot,otf,lock,map,class,o,a,psd,ai'));

// Archivos SENSIBLES (patrones fnmatch sobre el nombre): nunca se leen ni se listan.
// Evita que credenciales del servidor remoto terminen en el contexto de un LLM.
define('FTP_DENY_FILES', (string)($_FTP_ENV['FTP_DENY_FILES']
    ?? '.env,.env.*,*.pem,*.key,*.p12,*.pfx,*.jks,*.keystore,id_rsa*,id_ed25519*,*.htpasswd,secrets.*,credentials.*'));

/**
 * Servidores declarados en el .env: [alias => [url, root, label, host, scheme]].
 * `url` lleva las credenciales y NUNCA sale de PHP; lo que viaja al modelo y al
 * navegador es solo alias/label/host/scheme (ver ftp_servers_public()).
 */
function ftp_servers_config() {
    static $servers = null;
    if ($servers !== null) return $servers;

    $env = is_file(FTP_ENV_PATH) ? parse_ini_file(FTP_ENV_PATH, false, INI_SCANNER_RAW) : [];
    if (!is_array($env)) $env = [];

    $servers = [];
    foreach ($env as $key => $value) {
        if (!preg_match('/^FTP_(.+)_URL$/', (string) $key, $m)) continue;
        $alias = strtolower($m[1]);
        $url   = trim((string) $value);
        if ($url === '') continue;

        $parts = parse_url($url);
        if (!$parts || empty($parts['host'])) continue;
        $scheme = strtolower($parts['scheme'] ?? 'ftp');
        if (!in_array($scheme, ['ftp', 'ftps', 'sftp'], true)) continue;

        $servers[$alias] = [
            'alias'  => $alias,
            'url'    => $url,
            'scheme' => $scheme,
            'host'   => $parts['host'],
            'port'   => isset($parts['port']) ? (int) $parts['port'] : null,
            'user'   => isset($parts['user']) ? urldecode($parts['user']) : '',
            'pass'   => isset($parts['pass']) ? urldecode($parts['pass']) : '',
            'root'   => trim((string)($env['FTP_' . $m[1] . '_ROOT'] ?? ($parts['path'] ?? '')), ' '),
            'label'  => trim((string)($env['FTP_' . $m[1] . '_LABEL'] ?? '')),
        ];
    }
    return $servers;
}

unset($_FTP_ENV);
