<?php
// Sincronizacion de listas TODO con clientes EXTERNOS (hoy: el chat de avatars).
//
// Es la gemela de ctrl-todos.php pero para llamadas servidor a servidor: alli la
// identidad la pone la sesion del navegador, aqui no hay navegador — la peticion
// llega de otro PHP. Por eso autentica con un token compartido (TODO_SYNC_TOKEN
// en coffee/app/credentials/.env) y el usuario destino viaja como parametro.
//
// Acciones (`action` por POST):
//   pull -> devuelve la lista completa (para que el cliente compare)
//   push -> alta de tareas (`sections`) y cierre de tareas ya existentes (`updates`)
//
// El token NO tiene valor por defecto: sin la clave en el .env el endpoint
// responde 503 y no atiende a nadie. Un default abriria la biblioteca entera de
// todos los usuarios a quien adivine la URL.
//
// La escritura es siempre INCREMENTAL: nunca se reescribe la lista entera desde
// fuera, porque el otro lado no puede saber que se editó aqui mientras tanto.

require_once __DIR__ . '/todos-lib.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

if (!defined('TODO_SYNC_ENV_PATH')) define('TODO_SYNC_ENV_PATH', __DIR__ . '/../../credentials/.env');

function sync_fail($msg, $code = 400) {
    http_response_code($code);
    echo json_encode(['success' => false, 'message' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}

/** Token compartido del .env. Vacio = la sincronizacion esta apagada. */
function sync_token() {
    $env = is_file(TODO_SYNC_ENV_PATH) ? parse_ini_file(TODO_SYNC_ENV_PATH, false, INI_SCANNER_RAW) : [];
    return is_array($env) ? trim((string) ($env['TODO_SYNC_TOKEN'] ?? '')) : '';
}

/**
 * Ruta absoluta de una lista dentro de la biblioteca de UN usuario concreto.
 * No se usa todos_root_of(): esa valida contra la biblioteca de la SESION, y aqui
 * no hay sesion. La ruta se arma desde la raiz del usuario destino y se comprueba
 * con realpath que el resultado sigue dentro de ella.
 */
function sync_resolve($userId, $rel) {
    $userId = (int) $userId;
    if ($userId <= 0) return null;

    $root = coffee_visor_docs_root_of($userId);
    if ($root === '' || !is_dir($root)) return null;
    $root = todos_norm(realpath($root));

    $rel = trim(str_replace('\\', '/', (string) $rel), '/');
    if ($rel === '' || strpos($rel, '..') !== false) return null;
    if (!todos_is_todo_file(basename($rel))) return null;

    $full = todos_norm($root . '/' . $rel);
    $dir  = realpath(dirname($full));
    if ($dir === false) return null;                       // la carpeta debe existir ya
    $dir = todos_norm($dir);
    if ($dir !== $root && strpos($dir, $root . '/') !== 0) return null;

    return $full;
}

// ── Autenticacion ───────────────────────────────────────────────────────────

$expected = sync_token();
if ($expected === '') {
    sync_fail('La sincronizacion no esta configurada en este servidor (falta TODO_SYNC_TOKEN).', 503);
}

$sent = $_SERVER['HTTP_X_TODO_TOKEN'] ?? '';
if (!is_string($sent) || $sent === '' || !hash_equals($expected, $sent)) {
    sync_fail('Token invalido.', 401);
}

// ── Acciones ────────────────────────────────────────────────────────────────

$action = $_POST['action'] ?? '';
$path   = sync_resolve($_POST['user'] ?? 0, $_POST['rel'] ?? '');
if ($path === null) sync_fail('Destino no valido: revisa el usuario y la ruta relativa (debe ser una carpeta existente de su biblioteca y un archivo todo*.json).', 403);

try {
    switch ($action) {

        // Estado remoto completo. `exists` en false no es un error: la lista
        // todavia no se ha publicado nunca y el cliente hara el primer push.
        case 'pull': {
            if (!is_file($path)) {
                echo json_encode(['success' => true, 'exists' => false, 'list' => null], JSON_UNESCAPED_UNICODE);
                break;
            }
            $shape = todos_shape((string) @file_get_contents($path), pathinfo($path, PATHINFO_FILENAME));
            echo json_encode([
                'success'  => true,
                'exists'   => true,
                'list'     => ['title' => $shape['title'], 'sections' => $shape['sections']],
                'mtime'    => @filemtime($path) ?: 0,
            ], JSON_UNESCAPED_UNICODE);
            break;
        }

        // Alta de tareas + cierre de las que el otro lado marco como hechas. Las
        // dos cosas en una llamada porque son el resultado de UN merge.
        case 'push': {
            $sections = json_decode((string) ($_POST['sections'] ?? '[]'), true);
            $updates  = json_decode((string) ($_POST['updates']  ?? '[]'), true);
            if (!is_array($sections)) $sections = [];
            if (!is_array($updates))  $updates  = [];
            if (empty($sections) && empty($updates)) sync_fail('No llego nada que sincronizar.');

            // La lista puede no existir: el primer push la crea con el titulo que
            // manda el cliente.
            $raw   = is_file($path) ? (string) @file_get_contents($path) : '';
            $shape = todos_shape($raw, trim((string) ($_POST['title'] ?? '')) ?: pathinfo($path, PATHINFO_FILENAME));

            $data = ['title' => $shape['title'], 'sections' => $shape['sections']];
            foreach ((array) $shape['extra'] as $k => $v) $data[$k] = $v;   // claves ajenas al cajon, intactas

            // Ids ya presentes: los que llegan se respetan tal cual (es lo que hace
            // idempotente el merge), y solo se inventa uno si viene vacio o repetido.
            $used = [];
            foreach ($data['sections'] as $sec) {
                $used[(string) $sec['id']] = true;
                foreach ($sec['tasks'] as $task) $used[(string) $task['id']] = true;
            }
            $mint = function ($given) use (&$used) {
                $id = trim((string) $given);
                if ($id === '' || isset($used[$id])) {
                    do { $id = 'sy-' . substr(md5(uniqid('', true)), 0, 6); } while (isset($used[$id]));
                }
                $used[$id] = true;
                return $id;
            };

            // 1) Cierres por id: lo que ya existe aqui no se duplica, se actualiza.
            $updated = 0;
            $byId    = [];
            foreach ($updates as $u) {
                if (is_array($u) && !empty($u['id'])) $byId[(string) $u['id']] = !empty($u['done']);
            }
            if ($byId) {
                foreach ($data['sections'] as $si => $sec) {
                    foreach ($sec['tasks'] as $ti => $task) {
                        $id = (string) $task['id'];
                        if (!array_key_exists($id, $byId)) continue;
                        if ((bool) $task['done'] === $byId[$id]) continue;
                        $data['sections'][$si]['tasks'][$ti]['done'] = $byId[$id];
                        $updated++;
                    }
                }
            }

            // 2) Altas: se emparejan las secciones por titulo para no duplicarlas.
            $index = [];
            foreach ($data['sections'] as $si => $sec) $index[mb_strtolower(trim((string) $sec['title']))] = $si;

            $added = 0;
            foreach ($sections as $incoming) {
                if (!is_array($incoming)) continue;
                $title = trim((string) ($incoming['title'] ?? $incoming['titulo'] ?? '')) ?: 'Pendientes';
                $key   = mb_strtolower($title);

                if (!isset($index[$key])) {
                    $data['sections'][] = ['id' => $mint(''), 'title' => $title, 'tasks' => []];
                    $index[$key] = count($data['sections']) - 1;
                }
                $target = $index[$key];

                foreach ((array) ($incoming['tasks'] ?? $incoming['tareas'] ?? []) as $task) {
                    if (!is_array($task)) continue;
                    $text = trim((string) ($task['text'] ?? ''));
                    if ($text === '') continue;

                    $new = ['id' => $mint($task['id'] ?? ''), 'text' => $text, 'done' => !empty($task['done'])];
                    foreach (['prio', 'tags', 'ref'] as $extra) {
                        if (isset($task[$extra]) && $task[$extra] !== '' && $task[$extra] !== []) $new[$extra] = $task[$extra];
                    }

                    $data['sections'][$target]['tasks'][] = $new;
                    $added++;
                }
            }

            $json = json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
            if (strlen($json) > TODOS_MAX_BYTES) sync_fail('La lista excede el tamano maximo.');
            if (@file_put_contents($path, $json) === false) sync_fail('No se pudo escribir la lista.', 500);

            echo json_encode([
                'success' => true,
                'added'   => $added,
                'updated' => $updated,
                'list'    => ['title' => $data['title'], 'sections' => $data['sections']],
            ], JSON_UNESCAPED_UNICODE);
            break;
        }

        default:
            sync_fail('Accion no reconocida: ' . $action);
    }
} catch (Throwable $e) {
    sync_fail('Error al sincronizar: ' . $e->getMessage(), 500);
}
