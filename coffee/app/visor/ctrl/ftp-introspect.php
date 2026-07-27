<?php
/**
 * Lectura de SERVIDORES REMOTOS por FTP/FTPS/SFTP para el chat (CoffeeIA).
 * Gemelo de fs-introspect.php (carpeta local) pero contra un servidor remoto.
 *
 * Herramientas que expone al modelo:
 *   ftp_list  -> catalogo de servidores (sin argumentos) o listado de una carpeta
 *   ftp_read  -> contenido de UN archivo de texto
 *
 * SOLO LECTURA: no hay subida, borrado ni renombrado, ni siquiera internamente.
 * El transporte es cURL (libcurl trae ftp/ftps/sftp), asi que no hace falta la
 * extension ftp de PHP.
 *
 * Sandbox por servidor:
 *   - todo se ancla al ROOT del alias; "..", rutas absolutas y \ no escapan de ahi
 *   - los archivos sensibles (.env, llaves) no se listan ni se leen
 *   - los binarios se listan pero no se leen como texto
 *   - tope de entradas por listado y de bytes por archivo
 * Las credenciales viven solo en credentials/.env: el modelo maneja alias.
 */

require_once __DIR__ . '/ftp-config.php';

// ── Catalogo ────────────────────────────────────────────────────────────────

/** ¿Hay al menos un servidor configurado? Sin ellos las tools no se declaran. */
function ftp_has_servers() {
    return count(ftp_servers_config()) > 0;
}

/** Vista publica del catalogo: lo unico que pueden ver el modelo y el navegador. */
function ftp_servers_public() {
    $out = [];
    foreach (ftp_servers_config() as $alias => $s) {
        $out[] = [
            'server' => $alias,
            'label'  => $s['label'] !== '' ? $s['label'] : $alias,
            'scheme' => $s['scheme'],
            'host'   => $s['host'] . ($s['port'] ? ':' . $s['port'] : ''),
            'root'   => $s['root'] !== '' ? $s['root'] : '/',
        ];
    }
    return $out;
}

function ftp_server($alias) {
    $servers = ftp_servers_config();
    $alias = strtolower(trim((string) $alias));
    return isset($servers[$alias]) ? $servers[$alias] : null;
}

// ── Rutas ───────────────────────────────────────────────────────────────────

/** Normaliza una ruta relativa: sin "..", sin barras dobles, sin backslashes. */
function ftp_clean_path($path) {
    $path = str_replace('\\', '/', (string) $path);
    $out = [];
    foreach (explode('/', $path) as $seg) {
        if ($seg === '' || $seg === '.') continue;
        if ($seg === '..') { array_pop($out); continue; }   // nunca sube del root
        $out[] = $seg;
    }
    return implode('/', $out);
}

/** Ruta absoluta EN EL SERVIDOR, anclada al root del alias. */
function ftp_remote_path(array $server, $path) {
    $root = trim(str_replace('\\', '/', (string) $server['root']), '/');
    $rel  = ftp_clean_path($path);
    $full = '/' . ltrim($root . '/' . $rel, '/');
    return rtrim($full, '/') === '' ? '/' : rtrim($full, '/');
}

/** URL completa para cURL (con credenciales). Nunca se registra ni se devuelve. */
function ftp_url(array $server, $remotePath, $isDir = false) {
    $port = $server['port'] ? ':' . $server['port'] : '';
    $path = '/' . ltrim($remotePath, '/');
    // Cada segmento se escapa por separado para respetar las barras de la ruta.
    $path = implode('/', array_map('rawurlencode', explode('/', trim($path, '/'))));
    return $server['scheme'] . '://' . $server['host'] . $port . '/' . $path . ($isDir ? '/' : '');
}

/** ¿El nombre cae en la lista de archivos sensibles? */
function ftp_is_denied($name) {
    foreach (explode(',', FTP_DENY_FILES) as $pattern) {
        $pattern = trim($pattern);
        if ($pattern !== '' && fnmatch($pattern, $name, FNM_CASEFOLD)) return true;
    }
    return false;
}

function ftp_is_binary($name) {
    $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
    if ($ext === '') return false;
    return in_array($ext, array_map('trim', explode(',', FTP_BINARY_EXTS)), true);
}

// ── Transporte ──────────────────────────────────────────────────────────────

/**
 * Ejecuta una peticion cURL contra el servidor. Devuelve el cuerpo crudo.
 * @throws Exception con el mensaje de cURL si la operacion falla.
 */
function ftp_curl(array $server, $url, array $extraOpts = []) {
    $ch = curl_init($url);
    $opts = [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CONNECTTIMEOUT => FTP_CONNECT_TIMEOUT,
        CURLOPT_TIMEOUT        => FTP_TIMEOUT,
        CURLOPT_FTP_USE_EPSV   => 1,
        CURLOPT_FTPSSLAUTH     => CURLFTPAUTH_DEFAULT,
        CURLOPT_SSL_VERIFYPEER => FTP_VERIFY_CERT ? true : false,
        CURLOPT_SSL_VERIFYHOST => FTP_VERIFY_CERT ? 2 : 0,
    ];
    if ($server['user'] !== '') {
        $opts[CURLOPT_USERPWD] = $server['user'] . ':' . $server['pass'];
    }
    // FTPS explicito: se pide TLS sobre el puerto FTP normal.
    if ($server['scheme'] === 'ftps') $opts[CURLOPT_USE_SSL] = CURLUSESSL_ALL;
    if (!FTP_PASSIVE) $opts[CURLOPT_FTPPORT] = '-';

    curl_setopt_array($ch, $opts + $extraOpts);
    $body = curl_exec($ch);
    $err  = curl_error($ch);
    $code = curl_errno($ch);
    curl_close($ch);

    if ($body === false) {
        // El mensaje de cURL puede traer la URL con credenciales: se limpia.
        $safe = preg_replace('#(ftps?|sftp)://[^/@\s]+@#i', '$1://', $err);
        throw new Exception('no se pudo consultar el servidor (' . $code . '): ' . $safe);
    }
    return $body;
}

/**
 * Parsea una linea de listado FTP. Soporta el formato Unix (el habitual) y el
 * de servidores Windows/IIS. Devuelve null si la linea no es un archivo util.
 */
function ftp_parse_line($line) {
    $line = trim($line);
    if ($line === '' || preg_match('/^total\s+\d+/i', $line)) return null;

    // Unix:  drwxr-xr-x  3 user group  4096 Jan 12 10:00 nombre con espacios
    if (preg_match('/^([\-dl])([rwxsStT\-]{9})\s+\d+\s+\S+\s+\S+\s+(\d+)\s+(\S+\s+\S+\s+\S+)\s+(.+)$/', $line, $m)) {
        $name = $m[5];
        // Enlaces simbolicos: "link -> destino"; nos quedamos con el nombre.
        if ($m[1] === 'l' && strpos($name, ' -> ') !== false) $name = substr($name, 0, strpos($name, ' -> '));
        return ['name' => $name, 'dir' => $m[1] === 'd', 'size' => (int) $m[3], 'modified' => $m[4]];
    }

    // Windows/IIS:  01-12-24  10:00AM  <DIR>  nombre   |   01-12-24  10:00AM  1234  archivo.txt
    if (preg_match('/^(\d{2}-\d{2}-\d{2,4}\s+\d{2}:\d{2}(?:AM|PM)?)\s+(<DIR>|\d+)\s+(.+)$/i', $line, $m)) {
        $isDir = strtoupper($m[2]) === '<DIR>';
        return ['name' => trim($m[3]), 'dir' => $isDir, 'size' => $isDir ? 0 : (int) $m[2], 'modified' => $m[1]];
    }

    // Formato desconocido: se toma la ultima palabra como nombre (mejor que perderlo).
    $parts = preg_split('/\s+/', $line);
    $name = end($parts);
    return $name ? ['name' => $name, 'dir' => false, 'size' => 0, 'modified' => ''] : null;
}

// ── Operaciones ─────────────────────────────────────────────────────────────

/** Lista una carpeta remota. */
function ftp_list_dir($alias, $path = '') {
    $server = ftp_server($alias);
    if (!$server) throw new Exception('servidor desconocido: ' . $alias . '. Llama a ftp_list sin argumentos para ver los disponibles.');

    $remote = ftp_remote_path($server, $path);
    $raw    = ftp_curl($server, ftp_url($server, $remote, true));

    $dirs = [];
    $files = [];
    $truncated = false;
    foreach (preg_split('/\r\n|\r|\n/', $raw) as $line) {
        $entry = ftp_parse_line($line);
        if (!$entry || $entry['name'] === '.' || $entry['name'] === '..') continue;
        if (ftp_is_denied($entry['name'])) continue;               // credenciales del server: invisibles
        if (count($dirs) + count($files) >= FTP_MAX_LIST_ENTRIES) { $truncated = true; break; }

        if ($entry['dir']) {
            $dirs[] = $entry['name'];
        } else {
            $files[] = [
                'name'     => $entry['name'],
                'size'     => $entry['size'],
                'modified' => $entry['modified'],
                'readable' => !ftp_is_binary($entry['name']),
            ];
        }
    }

    sort($dirs);
    usort($files, function ($a, $b) { return strcmp($a['name'], $b['name']); });

    return [
        'server'    => $alias,
        'path'      => ftp_clean_path($path),
        'dirs'      => $dirs,
        'files'     => $files,
        'truncated' => $truncated,
    ];
}

/** Lee un archivo de texto remoto. */
function ftp_read_file($alias, $path) {
    $server = ftp_server($alias);
    if (!$server) throw new Exception('servidor desconocido: ' . $alias . '. Llama a ftp_list sin argumentos para ver los disponibles.');

    $rel = ftp_clean_path($path);
    if ($rel === '') throw new Exception('falta la ruta del archivo');

    $name = basename($rel);
    if (ftp_is_denied($name))  throw new Exception('archivo protegido: no se puede leer ' . $name);
    if (ftp_is_binary($name))  throw new Exception('archivo binario: ' . $name . ' no se lee como texto');

    $remote = ftp_remote_path($server, $rel);
    // Se pide un rango para no descargar archivos enormes por accidente.
    $body = ftp_curl($server, ftp_url($server, $remote), [
        CURLOPT_RANGE => '0-' . (FTP_MAX_FILE_BYTES - 1),
    ]);

    $truncated = strlen($body) >= FTP_MAX_FILE_BYTES;
    // El servidor puede ignorar el rango: se recorta igual.
    if ($truncated) $body = substr($body, 0, FTP_MAX_FILE_BYTES);

    return [
        'server'    => $alias,
        'path'      => $rel,
        'bytes'     => strlen($body),
        'truncated' => $truncated,
        'content'   => $body,
    ];
}

// ── Specs y despacho (formato OpenAI) ───────────────────────────────────────

function ftp_tool_specs() {
    return [
        [
            'type' => 'function',
            'function' => [
                'name'        => 'ftp_list',
                'description' => 'Explora un SERVIDOR REMOTO por FTP/SFTP en solo lectura. Llamala PRIMERO sin '
                               . 'argumentos para ver el catalogo de servidores configurados (alias, host y carpeta '
                               . 'raiz); luego con server=<alias> y path para listar carpetas y archivos. Usala para '
                               . 'saber que hay publicado en el servidor antes de leer nada.',
                'parameters'  => [
                    'type' => 'object',
                    'properties' => [
                        'server' => ['type' => 'string', 'description' => 'Alias del servidor tal como aparece en el catalogo. Vacio = devuelve el catalogo.'],
                        'path'   => ['type' => 'string', 'description' => 'Ruta RELATIVA a la carpeta raiz del servidor (vacio o "." = raiz).'],
                    ],
                    'required' => [],
                ],
            ],
        ],
        [
            'type' => 'function',
            'function' => [
                'name'        => 'ftp_read',
                'description' => 'Lee el contenido de UN archivo de texto de un servidor remoto (FTP/SFTP) y lo '
                               . 'devuelve. Usala para responder con el codigo o la configuracion REAL que esta '
                               . 'publicada; nunca inventes el contenido. Los binarios y los archivos de '
                               . 'credenciales no se pueden leer.',
                'parameters'  => [
                    'type' => 'object',
                    'properties' => [
                        'server' => ['type' => 'string', 'description' => 'Alias del servidor.'],
                        'path'   => ['type' => 'string', 'description' => 'Ruta RELATIVA del archivo dentro de la carpeta raiz del servidor.'],
                    ],
                    'required' => ['server', 'path'],
                ],
            ],
        ],
    ];
}

/** Etiqueta legible del estado que se le muestra al usuario mientras corre. */
function ftp_tool_label($name, array $args) {
    $server = isset($args['server']) ? trim((string) $args['server']) : '';
    $path   = isset($args['path'])   ? trim((string) $args['path'])   : '';
    if ($name === 'ftp_read') return 'descargando ' . ($path !== '' ? $path : 'archivo') . ($server ? ' de ' . $server : '');
    if ($server === '')       return 'buscando servidores remotos';
    return 'explorando ' . $server . ($path !== '' ? '/' . $path : '');
}

/**
 * Ejecuta la herramienta y devuelve el resultado como STRING JSON (lo que espera
 * un mensaje role=tool). Los errores se devuelven como JSON, no se lanzan: el
 * modelo los lee y corrige.
 */
function ftp_run_tool($name, array $args) {
    try {
        $server = isset($args['server']) ? trim((string) $args['server']) : '';
        $path   = isset($args['path'])   ? (string) $args['path']         : '';

        switch ($name) {
            case 'ftp_list':
                // Sin servidor: catalogo. Es el punto de entrada del modelo.
                if ($server === '') {
                    $servers = ftp_servers_public();
                    return json_encode($servers
                        ? ['servers' => $servers, 'hint' => 'Vuelve a llamar a ftp_list con server=<alias> para listar su contenido.']
                        : ['error' => 'no hay servidores remotos configurados en credentials/.env'],
                        JSON_UNESCAPED_UNICODE);
                }
                return json_encode(ftp_list_dir($server, $path), JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);

            case 'ftp_read':
                return json_encode(ftp_read_file($server, $path), JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
        }
        return json_encode(['error' => 'Herramienta desconocida: ' . $name], JSON_UNESCAPED_UNICODE);
    } catch (Throwable $e) {
        return json_encode(['error' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
    }
}
