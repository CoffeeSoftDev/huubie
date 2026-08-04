<?php
/**
 * Registro de HERRAMIENTAS del chat (CoffeeIA).
 *
 * Hasta ahora las tools estaban hardcodeadas en el codigo (fs_tool_specs,
 * db_tool_specs, web_tool_spec) y se activaban solas segun la conexion. Aqui viven
 * en SQLite (data/tools.sqlite), asi el usuario puede ELEGIR cuales estan activas y
 * CREAR nuevas de tipo HTTP que el modelo invoca como cualquier otra.
 *
 * Dos familias:
 *   - builtin : las del codigo (list_dir/read_file/grep_files, run_select, fetch_url).
 *               Su schema es el del codigo (fuente de verdad); de la fila solo se
 *               usan `active` y la apariencia (label/description/category/icon).
 *   - http    : las que crea el usuario. Schema, endpoint, metodo y headers salen
 *               de la fila y se ejecutan con cURL.
 *
 * `source` dice de que depende la tool: fs (carpeta conectada), db (base conectada),
 * ftp (servidores remotos declarados en credentials/.env), web (siempre) o http
 * (siempre). El loop de turno solo declara las que su contexto puede resolver.
 */

require_once __DIR__ . '/fs-introspect.php';
require_once __DIR__ . '/db-introspect.php';
require_once __DIR__ . '/web-fetch.php';
require_once __DIR__ . '/ftp-introspect.php';
require_once __DIR__ . '/todo-tool.php';
require_once __DIR__ . '/agent-tools.php';
require_once __DIR__ . '/agent-brain.php';

if (!defined('TOOLS_DB_PATH'))      define('TOOLS_DB_PATH', __DIR__ . '/../data/tools.sqlite');
if (!defined('TOOLS_ENV_PATH'))     define('TOOLS_ENV_PATH', __DIR__ . '/../../credentials/.env');
if (!defined('TOOLS_HTTP_TIMEOUT')) define('TOOLS_HTTP_TIMEOUT', 25);      // segundos por llamada
if (!defined('TOOLS_HTTP_MAX'))     define('TOOLS_HTTP_MAX', 20000);       // chars devueltos al modelo

/**
 * Superficies de chat del visor. Una tool puede limitarse a algunas de ellas.
 * `key` es lo que cada pagina manda en el payload como `surface`.
 */
function tools_surfaces_catalog() {
    return [
        ['key' => 'visor',      'label' => 'Visor',      'description' => 'Chat del documento abierto'],
        ['key' => 'coffeeia',   'label' => 'CoffeeIA',   'description' => 'Chat de pantalla completa'],
        ['key' => 'playground', 'label' => 'Playground', 'description' => 'Sandbox de agentes'],
    ];
}

/**
 * Agentes disponibles. Es lo que coffeeia.js y playground.js mandan como `agentKey`;
 * el Visor usa el primero.
 *
 * Salen del registro (data/agents.sqlite, ver agents-registry.php), donde ademas viven
 * su prompt, sus reglas y su memoria. La lista de abajo es el respaldo para cuando el
 * registro no responde: son las mismas tres claves con que se sembraba.
 */
function tools_agents_catalog() {
    $fromDb = agents_catalog();
    if (!empty($fromDb)) return $fromDb;

    return [
        ['key' => 'CoffeeIA.md',            'label' => 'CoffeeIA',           'description' => 'Framework y modulos'],
        ['key' => 'CoffeeMagic.md',         'label' => 'CoffeeMagic',        'description' => 'Templates y UI'],
        ['key' => 'coffee-intelligence.md', 'label' => 'CoffeeIntelligence', 'description' => 'Modelado de datos'],
    ];
}

/** Normaliza una asignacion CSV dejando solo claves del catalogo. Vacio = sin limite. */
function tools_clean_scope($csv, array $catalog) {
    $valid = [];
    foreach ($catalog as $c) $valid[] = $c['key'];
    $out = [];
    foreach (explode(',', (string) $csv) as $k) {
        $k = trim($k);
        if ($k !== '' && in_array($k, $valid, true) && !in_array($k, $out, true)) $out[] = $k;
    }
    // Marcarlas TODAS equivale a no limitar: se guarda vacio para que el catalogo
    // pueda crecer sin dejar tools ancladas a la lista vieja.
    return count($out) === count($valid) ? '' : implode(',', $out);
}

/** ¿La tool aplica a este destino? Asignacion vacia = aplica a todos. */
function tools_scope_match($csv, $value) {
    $csv = trim((string) $csv);
    if ($csv === '') return true;
    if ($value === '') return true;   // la superficie no se identifico: no se filtra
    return in_array($value, array_map('trim', explode(',', $csv)), true);
}

// Nombres reservados: son las builtin, no se pueden pisar con una tool HTTP.
// Las de source 'brain' (memoria y reglas del agente) viven en agent-tools.php.
function tools_builtin_catalog() {
    return array_merge([
        [
            'name'        => 'list_dir',
            'label'       => 'Listar carpeta',
            'description' => 'Explora la estructura del proyecto conectado (subcarpetas y archivos).',
            'category'    => 'Carpeta',
            'icon'        => 'folder-tree',
            'source'      => 'fs',
        ],
        [
            'name'        => 'read_file',
            'label'       => 'Leer archivo',
            'description' => 'Lee un archivo de texto real de la carpeta conectada.',
            'category'    => 'Carpeta',
            'icon'        => 'file-text',
            'source'      => 'fs',
        ],
        [
            'name'        => 'grep_files',
            'label'       => 'Buscar en archivos',
            'description' => 'Busca texto literal dentro del proyecto conectado y devuelve las coincidencias.',
            'category'    => 'Carpeta',
            'icon'        => 'search',
            'source'      => 'fs',
        ],
        [
            'name'        => 'todo_propose',
            'label'       => 'Proponer tareas',
            'description' => 'Propone tareas para la lista TODO. No las guarda: el usuario elige cuales acepta.',
            'category'    => 'TODO',
            'icon'        => 'list-checks',
            'source'      => 'todo',
        ],
        [
            'name'        => 'run_select',
            'label'       => 'Consultar la base',
            'description' => 'Ejecuta SELECT/SHOW/DESCRIBE de solo lectura contra la base conectada.',
            'category'    => 'Datos',
            'icon'        => 'database',
            'source'      => 'db',
        ],
        [
            'name'        => 'fetch_url',
            'label'       => 'Descargar URL',
            'description' => 'Descarga una pagina o recurso http(s) publico para consultarlo o clonarlo.',
            'category'    => 'Web',
            'icon'        => 'globe',
            'source'      => 'web',
        ],
        [
            'name'        => 'ftp_list',
            'label'       => 'Explorar servidor remoto',
            'description' => 'Lista carpetas y archivos de un servidor FTP/SFTP configurado (solo lectura).',
            'category'    => 'Servidor remoto',
            'icon'        => 'server',
            'source'      => 'ftp',
        ],
        [
            'name'        => 'ftp_read',
            'label'       => 'Leer archivo remoto',
            'description' => 'Descarga y lee un archivo de texto publicado en un servidor FTP/SFTP.',
            'category'    => 'Servidor remoto',
            'icon'        => 'file-down',
            'source'      => 'ftp',
        ],
    ], brain_tool_catalog());
}

/** Spec (formato OpenAI) de una builtin, tomada del codigo que la implementa. */
function tools_builtin_spec($name) {
    static $map = null;
    if ($map === null) {
        $map = [];
        foreach (fs_tool_specs() as $spec)  $map[$spec['function']['name']] = $spec;
        foreach (db_tool_specs() as $spec)  $map[$spec['function']['name']] = $spec;
        foreach (ftp_tool_specs() as $spec) $map[$spec['function']['name']] = $spec;
        foreach (todo_tool_specs() as $spec) $map[$spec['function']['name']] = $spec;
        foreach (brain_tool_specs() as $spec) $map[$spec['function']['name']] = $spec;
        $web = web_tool_spec();
        $map[$web['function']['name']] = $web;
    }
    return isset($map[$name]) ? $map[$name] : null;
}

// ── Conexion / esquema ──────────────────────────────────────────────────────

function tools_db() {
    static $pdo = null;
    if ($pdo !== null) return $pdo;

    $dir = dirname(TOOLS_DB_PATH);
    if (!is_dir($dir)) @mkdir($dir, 0775, true);

    $pdo = new PDO('sqlite:' . TOOLS_DB_PATH);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec('PRAGMA journal_mode = WAL');
    $pdo->exec('
        CREATE TABLE IF NOT EXISTS tools (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            name          TEXT NOT NULL UNIQUE,
            label         TEXT NOT NULL DEFAULT "",
            description   TEXT NOT NULL DEFAULT "",
            category      TEXT NOT NULL DEFAULT "",
            icon          TEXT NOT NULL DEFAULT "wrench",
            type          TEXT NOT NULL DEFAULT "http",
            source        TEXT NOT NULL DEFAULT "http",
            method        TEXT NOT NULL DEFAULT "GET",
            endpoint      TEXT NOT NULL DEFAULT "",
            headers       TEXT NOT NULL DEFAULT "[]",
            schema_json   TEXT NOT NULL DEFAULT "",
            active        INTEGER NOT NULL DEFAULT 1,
            date_creation TEXT NOT NULL DEFAULT "",
            date_update   TEXT NOT NULL DEFAULT ""
        )
    ');
    $pdo->exec('
        CREATE TABLE IF NOT EXISTS tool_calls (
            id        INTEGER PRIMARY KEY AUTOINCREMENT,
            tool_name TEXT NOT NULL,
            called_at TEXT NOT NULL,
            ok        INTEGER NOT NULL DEFAULT 1
        )
    ');
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_tool_calls_at ON tool_calls (called_at)');

    tools_migrate($pdo);
    tools_seed_builtins($pdo);
    return $pdo;
}

/**
 * Columnas que se agregaron despues de la primera version de la tabla. SQLite no
 * tiene ADD COLUMN IF NOT EXISTS, asi que se consulta el esquema vivo.
 *   surfaces / agents -> asignacion: en que chats y a que agentes se le declara.
 *                        CSV vacio = a todos (comportamiento original).
 */
function tools_migrate(PDO $pdo) {
    $cols = [];
    foreach ($pdo->query('PRAGMA table_info(tools)')->fetchAll(PDO::FETCH_ASSOC) as $c) $cols[] = $c['name'];
    if (!in_array('surfaces', $cols, true)) $pdo->exec('ALTER TABLE tools ADD COLUMN surfaces TEXT NOT NULL DEFAULT ""');
    if (!in_array('agents',   $cols, true)) $pdo->exec('ALTER TABLE tools ADD COLUMN agents   TEXT NOT NULL DEFAULT ""');
}

/** Alta idempotente de las builtin: solo inserta las que faltan (respeta lo editado). */
function tools_seed_builtins(PDO $pdo) {
    $now = date('Y-m-d H:i:s');
    $ins = $pdo->prepare('
        INSERT OR IGNORE INTO tools
            (name, label, description, category, icon, type, source, method, endpoint, headers, schema_json, active, date_creation, date_update)
        VALUES (?, ?, ?, ?, ?, "builtin", ?, "", "", "[]", "", 1, ?, ?)
    ');
    foreach (tools_builtin_catalog() as $t) {
        $ins->execute([$t['name'], $t['label'], $t['description'], $t['category'], $t['icon'], $t['source'], $now, $now]);
    }
}

// ── Lectura ─────────────────────────────────────────────────────────────────

/** Todas las tools con su spec resuelta y los parametros ya desglosados para la UI. */
function tools_all() {
    $rows = tools_db()->query('SELECT * FROM tools ORDER BY type ASC, category ASC, name ASC')->fetchAll(PDO::FETCH_ASSOC);
    $counts = tools_call_counts();
    $out = [];
    foreach ($rows as $r) {
        $r['active']   = (int) $r['active'];
        $r['id']       = (int) $r['id'];
        $r['builtin']  = $r['type'] === 'builtin';
        $r['calls24h'] = isset($counts[$r['name']]) ? (int) $counts[$r['name']] : 0;
        $spec          = tools_spec_of($r);
        $r['spec']     = $spec;
        $r['params']   = tools_params_of($spec);
        $r['headers']  = tools_json_array($r['headers']);
        // Asignacion como listas para el UI (vacio en la fila = a todos).
        $r['surfaces'] = tools_scope_list($r['surfaces'] ?? '', tools_surfaces_catalog());
        $r['agents']   = tools_scope_list($r['agents']   ?? '', tools_agents_catalog());
        $out[] = $r;
    }
    return $out;
}

/** CSV guardado -> lista de claves. Vacio = todas las del catalogo. */
function tools_scope_list($csv, array $catalog) {
    $csv = trim((string) $csv);
    if ($csv === '') {
        $all = [];
        foreach ($catalog as $c) $all[] = $c['key'];
        return $all;
    }
    return array_values(array_filter(array_map('trim', explode(',', $csv))));
}

function tools_get($id) {
    $st = tools_db()->prepare('SELECT * FROM tools WHERE id = ?');
    $st->execute([(int) $id]);
    $row = $st->fetch(PDO::FETCH_ASSOC);
    if (!$row) return null;
    $row['active']  = (int) $row['active'];
    $row['id']      = (int) $row['id'];
    $row['builtin'] = $row['type'] === 'builtin';
    $row['spec']     = tools_spec_of($row);
    $row['params']   = tools_params_of($row['spec']);
    $row['headers']  = tools_json_array($row['headers']);
    $row['surfaces'] = tools_scope_list($row['surfaces'] ?? '', tools_surfaces_catalog());
    $row['agents']   = tools_scope_list($row['agents']   ?? '', tools_agents_catalog());
    return $row;
}

function tools_get_by_name($name) {
    $st = tools_db()->prepare('SELECT * FROM tools WHERE name = ?');
    $st->execute([(string) $name]);
    $row = $st->fetch(PDO::FETCH_ASSOC);
    return $row ?: null;
}

/** Llamadas de las ultimas 24 h por tool (para el contador de la UI). */
function tools_call_counts() {
    try {
        $st = tools_db()->prepare('SELECT tool_name, COUNT(*) AS calls FROM tool_calls WHERE called_at >= ? GROUP BY tool_name');
        $st->execute([date('Y-m-d H:i:s', time() - 86400)]);
        $out = [];
        foreach ($st->fetchAll(PDO::FETCH_ASSOC) as $r) $out[$r['tool_name']] = (int) $r['calls'];
        return $out;
    } catch (Throwable $e) {
        return [];
    }
}

// Acepta el JSON crudo de la fila o la lista ya decodificada (tools_get la devuelve
// decodificada y esa misma fila se reusa para la prueba manual del editor).
function tools_json_array($raw) {
    if (is_array($raw)) return $raw;
    $v = json_decode((string) $raw, true);
    return is_array($v) ? $v : [];
}

/** Spec efectiva de una fila: la del codigo si es builtin, la guardada si es HTTP. */
function tools_spec_of(array $row) {
    if (($row['type'] ?? '') === 'builtin') {
        $spec = tools_builtin_spec($row['name']);
        return $spec ?: null;
    }
    $spec = json_decode((string) ($row['schema_json'] ?? ''), true);
    return is_array($spec) && isset($spec['function']['name']) ? $spec : null;
}

/** Parametros de una spec como lista plana [{name,type,description,required}]. */
function tools_params_of($spec) {
    if (!is_array($spec)) return [];
    $props    = $spec['function']['parameters']['properties'] ?? [];
    $required = $spec['function']['parameters']['required']   ?? [];
    if (!is_array($props)) return [];
    $out = [];
    foreach ($props as $name => $def) {
        $out[] = [
            'name'        => (string) $name,
            'type'        => (string) ($def['type'] ?? 'string'),
            'description' => (string) ($def['description'] ?? ''),
            'required'    => is_array($required) && in_array($name, $required, true),
        ];
    }
    return $out;
}

// ── Specs para el turno ─────────────────────────────────────────────────────

/**
 * Specs de las tools ACTIVAS que el contexto del turno puede resolver y que estan
 * asignadas a esta superficie y a este agente.
 *
 * @param array  $sources  fuentes disponibles: 'fs' (carpeta), 'db' (base). 'web' y
 *                         'http' se incluyen siempre que la tool este activa.
 * @param string $surface  visor | coffeeia | playground ('' = sin filtrar).
 * @param string $agent    agentKey, p.ej. CoffeeMagic.md ('' = sin filtrar).
 * @return array{specs: array, names: array<string,array>}  specs para el cliente LLM
 *         y mapa nombre => fila (para el despacho).
 */
function tools_for_turn(array $sources, $surface = '', $agent = '') {
    try {
        $rows = tools_db()->query('SELECT * FROM tools WHERE active = 1')->fetchAll(PDO::FETCH_ASSOC);
    } catch (Throwable $e) {
        return ['specs' => [], 'names' => []];
    }

    // Las del cerebro solo tienen sentido con un agente identificado y con algo que
    // aportar: sin reglas ni memorias, declararlas solo gasta contexto.
    $hasBrain = tools_brain_available($agent);

    $specs = [];
    $names = [];
    foreach ($rows as $row) {
        $source = (string) $row['source'];
        if (($source === 'fs' || $source === 'db') && !in_array($source, $sources, true)) continue;
        // Sin servidores en credentials/.env no tiene sentido ofrecerlas.
        if ($source === 'ftp' && !ftp_has_servers()) continue;
        if ($source === 'brain' && !$hasBrain) continue;
        if (!tools_scope_match($row['surfaces'] ?? '', (string) $surface)) continue;
        if (!tools_scope_match($row['agents']   ?? '', (string) $agent))   continue;
        $spec = tools_spec_of($row);
        if (!$spec) continue;
        $specs[] = $spec;
        $names[$row['name']] = $row;
    }
    return ['specs' => $specs, 'names' => $names];
}

/**
 * ¿Vale la pena declararle a este agente las herramientas de su cerebro?
 *
 * Solo si esta identificado y tiene algo que leer o recordar. El usuario de la sesion
 * entra aqui porque la memoria es por (agente, usuario): un agente sin reglas puede
 * seguir teniendo memorias de ESTE usuario y nada mas.
 */
function tools_brain_available($agent) {
    if ((string) $agent === '') return false;
    static $cache = [];
    if (isset($cache[$agent])) return $cache[$agent];

    return $cache[$agent] = brain_has_context($agent, agents_user_id());
}

/**
 * ¿Hay alguna herramienta activa que funcione SIN carpeta ni base conectada?
 * Es lo que decide si un chat sin conexiones entra al loop agentico: las tools
 * propias (http) y las de servidor remoto (ftp) se valen por si mismas.
 *
 * `fetch_url` (source web) queda FUERA a proposito: esta activa por defecto y
 * convertiria cualquier conversacion normal en un turno agentico sin streaming.
 * Cuando hace falta, entra por el pre-fetch de URLs del contexto.
 *
 * Las de `brain` siguen el MISMO criterio y por eso tampoco entran solas: un agente
 * con reglas convertiria todos sus chats en turnos sin streaming. Quien lo prefiera lo
 * enciende por agente con `brain_standalone` (pestana Herramientas de su ficha); si no,
 * sus reglas se declaran cuando ya hay otro motivo para abrir el loop (carpeta o base
 * conectada), y mientras tanto el prompt lleva sus reglas criticas completas.
 */
function tools_has_standalone($surface = '', $agent = '') {
    if ((string) $agent !== '' && tools_brain_available($agent)) {
        $row = agents_get_by_key($agent);
        if ($row && (int) $row['brain_standalone'] === 1) return true;
    }

    try {
        // `todo` entra aqui aunque no dependa de nada externo: sin ella, pedir "anotame
        // esto" en un chat sin carpeta ni base conectada no abria ningun loop de
        // herramientas y el modelo no llegaba a ver todo_propose.
        $rows = tools_db()->query('SELECT source, surfaces, agents FROM tools WHERE active = 1 AND source IN ("http", "ftp", "todo")')->fetchAll(PDO::FETCH_ASSOC);
    } catch (Throwable $e) {
        return false;
    }
    foreach ($rows as $row) {
        if ($row['source'] === 'ftp' && !ftp_has_servers()) continue;   // sin servidores no hay nada que consultar
        if (!tools_scope_match($row['surfaces'], (string) $surface)) continue;
        if (!tools_scope_match($row['agents'],   (string) $agent))   continue;
        return true;
    }
    return false;
}

// ── Ejecucion ───────────────────────────────────────────────────────────────

/** Etiqueta legible del estado que se manda al UI mientras corre la tool. */
function tools_label($name, array $args, array $row = null) {
    if ($name === 'run_select') return 'consultando ' . (isset($args['sql']) ? $args['sql'] : $name);
    if ($name === 'fetch_url')  return web_tool_label($args);
    if (in_array($name, ['list_dir', 'read_file', 'grep_files'], true)) return fs_tool_label($name, $args);
    if (in_array($name, ['ftp_list', 'ftp_read'], true)) return ftp_tool_label($name, $args);
    if ($name === 'todo_propose') return todo_tool_label($args);
    if (in_array($name, ['read_rules', 'save_memory', 'forget_memory', 'write_rule'], true)) return brain_tool_label($name, $args);
    $label = $row && $row['label'] !== '' ? $row['label'] : $name;
    return 'ejecutando ' . $label;
}

/**
 * Ejecuta la tool que pidio el modelo y devuelve el resultado como STRING JSON
 * (lo que espera un mensaje role=tool). Los errores viajan como JSON: el modelo
 * los lee y corrige.
 */
function tools_run($name, array $args, array $ctx = [], array $row = null) {
    $root   = $ctx['fs'] ?? null;
    $schema = $ctx['db'] ?? null;
    $ok     = true;

    try {
        if (in_array($name, ['list_dir', 'read_file', 'grep_files'], true)) {
            $result = $root ? fs_run_tool($name, $args, $root)
                            : json_encode(['error' => 'no hay carpeta conectada'], JSON_UNESCAPED_UNICODE);
        } elseif ($name === 'run_select') {
            $result = $schema ? db_run_tool($name, $args, $schema)
                              : json_encode(['error' => 'no hay base de datos conectada'], JSON_UNESCAPED_UNICODE);
        } elseif ($name === 'fetch_url') {
            $result = web_run_tool($args);
        } elseif (in_array($name, ['ftp_list', 'ftp_read'], true)) {
            $result = ftp_run_tool($name, $args);
        } elseif ($name === 'todo_propose') {
            // No devuelve datos al modelo: aparta la propuesta para la interfaz.
            $result = todo_run_tool($name, $args);
        } elseif (in_array($name, ['read_rules', 'save_memory', 'forget_memory', 'write_rule'], true)) {
            $payload = brain_run_tool($name, $args, (string) ($ctx['agent'] ?? ''), agents_user_id());
            $ok      = !isset($payload['error']);
            $result  = json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
        } else {
            if ($row === null) $row = tools_get_by_name($name);
            if (!$row || (int) $row['active'] !== 1) {
                $ok = false;
                $result = json_encode(['error' => 'Herramienta desconocida o inactiva: ' . $name], JSON_UNESCAPED_UNICODE);
            } else {
                $result = tools_run_http($row, $args);
            }
        }
    } catch (Throwable $e) {
        $ok = false;
        $result = json_encode(['error' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
    }

    tools_log_call($name, $ok);
    return $result;
}

function tools_log_call($name, $ok = true) {
    try {
        $st = tools_db()->prepare('INSERT INTO tool_calls (tool_name, called_at, ok) VALUES (?, ?, ?)');
        $st->execute([(string) $name, date('Y-m-d H:i:s'), $ok ? 1 : 0]);
        // Poda: el contador solo mira 24 h, no tiene sentido guardar historia infinita.
        tools_db()->prepare('DELETE FROM tool_calls WHERE called_at < ?')
                  ->execute([date('Y-m-d H:i:s', time() - 7 * 86400)]);
    } catch (Throwable $e) { /* el log de uso nunca debe romper el turno */ }
}

/** Secretos disponibles para ${VAR}: primero el .env de credentials, luego el entorno. */
function tools_env($key) {
    static $env = null;
    if ($env === null) {
        $env = is_file(TOOLS_ENV_PATH) ? parse_ini_file(TOOLS_ENV_PATH, false, INI_SCANNER_RAW) : [];
        if (!is_array($env)) $env = [];
    }
    if (array_key_exists($key, $env)) return (string) $env[$key];
    $v = getenv($key);
    return $v === false ? '' : (string) $v;
}

/** Sustituye ${VAR} por el secreto correspondiente (vacio si no existe). */
function tools_expand_secrets($text) {
    return preg_replace_callback('/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/', function ($m) {
        return tools_env($m[1]);
    }, (string) $text);
}

/**
 * Ejecuta una tool HTTP creada por el usuario.
 *
 * - Los parametros declarados que aparecen como {param} en el endpoint se sustituyen
 *   ahi; el resto viaja en query string (GET/DELETE/HEAD) o como JSON body.
 * - En headers y endpoint, ${VAR} se resuelve contra credentials/.env: el secreto
 *   nunca vive en la base de tools ni pasa por el navegador.
 */
function tools_run_http(array $row, array $args) {
    $endpoint = tools_expand_secrets($row['endpoint'] ?? '');
    $method   = strtoupper((string) ($row['method'] ?? 'GET'));
    if ($endpoint === '') return json_encode(['error' => 'la herramienta no tiene endpoint configurado'], JSON_UNESCAPED_UNICODE);
    if (!preg_match('#^https?://#i', $endpoint)) return json_encode(['error' => 'el endpoint debe ser http(s)'], JSON_UNESCAPED_UNICODE);
    if (!in_array($method, ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], true)) $method = 'GET';

    // Solo se mandan los parametros declarados en el schema (el modelo a veces inventa).
    $declared = [];
    foreach (tools_params_of(tools_spec_of($row)) as $p) $declared[] = $p['name'];
    $payload = [];
    foreach ($args as $k => $v) {
        if (in_array((string) $k, $declared, true)) $payload[(string) $k] = $v;
    }

    // {param} en la ruta: se sustituye y ya no viaja en query/body.
    $endpoint = preg_replace_callback('/\{([A-Za-z_][A-Za-z0-9_]*)\}/', function ($m) use (&$payload) {
        $key = $m[1];
        if (!array_key_exists($key, $payload)) return $m[0];
        $val = (string) $payload[$key];
        unset($payload[$key]);
        return rawurlencode($val);
    }, $endpoint);

    $headers = ['Accept: application/json, text/plain, */*'];
    foreach (tools_json_array($row['headers'] ?? '[]') as $h) {
        $key = trim((string) ($h['key'] ?? ''));
        if ($key === '') continue;
        $headers[] = $key . ': ' . tools_expand_secrets($h['value'] ?? '');
    }

    $body = null;
    if (in_array($method, ['GET', 'DELETE'], true)) {
        if (!empty($payload)) {
            $endpoint .= (strpos($endpoint, '?') === false ? '?' : '&') . http_build_query($payload);
        }
    } elseif (!empty($payload)) {
        $body = json_encode($payload, JSON_UNESCAPED_UNICODE);
        $headers[] = 'Content-Type: application/json; charset=utf-8';
    }

    $ch = curl_init($endpoint);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_CUSTOMREQUEST  => $method,
        CURLOPT_HTTPHEADER     => $headers,
        CURLOPT_TIMEOUT        => TOOLS_HTTP_TIMEOUT,
        CURLOPT_CONNECTTIMEOUT => 10,
        CURLOPT_FOLLOWLOCATION => true,
        CURLOPT_MAXREDIRS      => 3,
        CURLOPT_SSL_VERIFYPEER => false,   // mismo criterio que el resto de clientes del visor (WAMP local)
        CURLOPT_USERAGENT      => 'CoffeeIA-Tools/1.0',
    ]);
    if ($body !== null) curl_setopt($ch, CURLOPT_POSTFIELDS, $body);

    $raw    = curl_exec($ch);
    $err    = curl_error($ch);
    $status = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($raw === false) {
        return json_encode(['error' => 'fallo la llamada: ' . $err], JSON_UNESCAPED_UNICODE);
    }

    $truncated = false;
    if (mb_strlen($raw, 'UTF-8') > TOOLS_HTTP_MAX) {
        $raw = mb_substr($raw, 0, TOOLS_HTTP_MAX, 'UTF-8');
        $truncated = true;
    }

    $parsed = json_decode($raw, true);
    $out = [
        'tool'      => $row['name'],
        'status'    => $status,
        'truncated' => $truncated,
    ];
    if (is_array($parsed)) $out['data'] = $parsed; else $out['body'] = $raw;
    return json_encode($out, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
}
