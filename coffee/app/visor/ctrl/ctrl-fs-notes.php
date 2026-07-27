<?php
/**
 * Documentacion de conversaciones DENTRO de la carpeta conectada (CoffeeIA).
 *
 * La conexion a carpetas (fs-introspect.php) es de SOLO LECTURA a proposito. Este
 * endpoint abre la unica excepcion: guardar la conversacion del chat como documento
 * markdown en la propia carpeta de trabajo, para que quede como documentacion del
 * proyecto y se pueda retomar despues.
 *
 * Acciones (POST FormData / GET para lecturas), siempre con `folder` = carpeta
 * conectada (nombre amigable o ruta):
 *   save -> escribe/actualiza un .md dentro de la carpeta (overwrite=1 para pisar)
 *   list -> lista los .md de la carpeta que son conversaciones de CoffeeIA
 *   read -> devuelve el contenido de uno de esos documentos
 *
 * Restricciones de escritura: la carpeta debe resolverse dentro de FS_ALLOWED_ROOTS,
 * la ruta destino es relativa (sin ".."), solo extension .md/.markdown, nunca en
 * carpetas vetadas (credentials, .git, node_modules...) y el directorio final se
 * revalida con realpath contra la carpeta conectada.
 */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

require_once __DIR__ . '/fs-introspect.php';
require_once __DIR__ . '/../../ctrl/auth-session.php';
require_once __DIR__ . '/../../ctrl/auth-db.php';
require_once __DIR__ . '/../../ctrl/auth-helpers.php';

define('NOTES_MAX_BYTES',    4194304);   // 4 MB por documento
define('NOTES_MAX_SCAN',     4000);      // archivos revisados al listar
define('NOTES_MARKER',       'coffeeia: conversacion');
define('NOTES_HEAD_BYTES',   1200);      // cabecera leida para detectar el marcador

function notes_fail($msg, $code = 400) {
    http_response_code($code);
    echo json_encode(['success' => false, 'message' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * Normaliza la ruta relativa del documento y valida que sea escribible: relativa,
 * sin "..", sin caracteres invalidos, .md/.markdown y fuera de carpetas vetadas.
 */
function notes_safe_rel($rel) {
    $rel = str_replace('\\', '/', trim((string) $rel));
    if ($rel === '') throw new FsIntrospectException('Falta el nombre del documento.');
    if (preg_match('#^([a-zA-Z]:|/|~)#', $rel)) {
        throw new FsIntrospectException('La ruta debe ser relativa a la carpeta conectada: ' . $rel);
    }

    $segs = [];
    foreach (explode('/', $rel) as $seg) {
        $seg = trim($seg);
        if ($seg === '' || $seg === '.') continue;
        if ($seg === '..') throw new FsIntrospectException('Ruta no permitida (contiene ".."): ' . $rel);
        if (preg_match('/[<>:"|?*]/', $seg)) throw new FsIntrospectException('Caracter no permitido en la ruta: ' . $seg);
        $segs[] = $seg;
    }
    if (empty($segs))      throw new FsIntrospectException('Ruta vacia.');
    if (count($segs) > 8)  throw new FsIntrospectException('Demasiados niveles de carpeta en la ruta.');

    $clean = implode('/', $segs);
    $ext   = strtolower(pathinfo($clean, PATHINFO_EXTENSION));
    if (!in_array($ext, ['md', 'markdown'], true)) {
        throw new FsIntrospectException('Solo se guardan documentos .md');
    }
    if (fs_is_denied_file($clean)) {
        throw new FsIntrospectException('Nombre de archivo restringido: ' . basename($clean));
    }
    foreach (array_slice($segs, 0, -1) as $dirSeg) {
        if (in_array(strtolower($dirSeg), fs_ignored_dirs(), true)) {
            throw new FsIntrospectException('No se escribe dentro de la carpeta "' . $dirSeg . '".');
        }
    }
    return $clean;
}

/** Metadatos del frontmatter de un documento de conversacion (cabecera del archivo). */
function notes_meta_from_head($head) {
    $meta = [];
    if (!preg_match('/^---\r?\n(.*?)(\r?\n---|\z)/s', $head, $m)) return $meta;
    foreach (preg_split('/\r?\n/', $m[1]) as $line) {
        if (!preg_match('/^([a-z_]+)\s*:\s*(.*)$/i', trim($line), $kv)) continue;
        $meta[strtolower($kv[1])] = trim($kv[2]);
    }
    return $meta;
}

/**
 * Busca en la carpeta los .md que son conversaciones de CoffeeIA (marcador en el
 * frontmatter). Recorrido acotado por NOTES_MAX_SCAN e ignorando carpetas vetadas.
 */
function notes_scan($root) {
    $root   = fs_norm(realpath($root) ?: $root);
    $ignore = fs_ignored_dirs();
    $docs   = [];
    $seen   = 0;
    $queue  = [$root];

    while (!empty($queue) && $seen < NOTES_MAX_SCAN) {
        $dir = array_shift($queue);
        foreach (@scandir($dir) ?: [] as $e) {
            if ($e === '.' || $e === '..') continue;
            $full = $dir . '/' . $e;
            if (is_dir($full)) {
                if (!in_array(strtolower($e), $ignore, true)) $queue[] = $full;
                continue;
            }
            $ext = strtolower(pathinfo($e, PATHINFO_EXTENSION));
            if (!in_array($ext, ['md', 'markdown'], true)) continue;
            if (++$seen >= NOTES_MAX_SCAN) break;

            $head = @file_get_contents($full, false, null, 0, NOTES_HEAD_BYTES);
            if ($head === false || strpos($head, NOTES_MARKER) === false) continue;

            $meta = notes_meta_from_head($head);
            $docs[] = [
                'path'     => ltrim(substr(fs_norm($full), strlen($root)), '/'),
                'title'    => $meta['titulo'] ?? pathinfo($e, PATHINFO_FILENAME),
                'uid'      => $meta['uid'] ?? '',
                'model'    => $meta['modelo'] ?? '',
                'msgCount' => isset($meta['mensajes']) ? (int) $meta['mensajes'] : 0,
                'updated'  => $meta['actualizado'] ?? date('Y-m-d H:i:s', (int) @filemtime($full)),
                'size'     => fs_fmt_size(@filesize($full)),
                'mtime'    => (int) @filemtime($full),
            ];
        }
    }

    usort($docs, function ($a, $b) { return $b['mtime'] - $a['mtime']; });
    return $docs;
}

if (!auth_current_user()) notes_fail('Sesion no valida. Vuelve a iniciar sesion.', 401);

$action = $_POST['action'] ?? $_GET['action'] ?? '';
$folder = trim($_POST['folder'] ?? $_GET['folder'] ?? '');

try {
    if ($folder === '') notes_fail('No hay carpeta conectada.');
    $root = fs_canonical_folder($folder);   // valida whitelist y resuelve nombre amigable

    switch ($action) {

        case 'save': {
            $rel     = notes_safe_rel($_POST['path'] ?? '');
            $content = (string) ($_POST['content'] ?? '');
            if (trim($content) === '')                 notes_fail('El documento viene vacio.');
            if (strlen($content) > NOTES_MAX_BYTES)    notes_fail('Documento demasiado grande (max 4 MB).');

            $target = fs_norm($root) . '/' . $rel;
            $dir    = dirname($target);
            if (!is_dir($dir) && !@mkdir($dir, 0775, true)) {
                notes_fail('No se pudo crear la carpeta destino: ' . dirname($rel), 500);
            }
            // Revalidacion con realpath: defensa contra symlinks o normalizaciones raras.
            if (!fs_is_within($root, $dir)) {
                notes_fail('Ruta fuera de la carpeta conectada: ' . $rel, 403);
            }

            $exists = is_file($target);
            if ($exists && !fs_is_within($root, $target)) {
                notes_fail('Ruta fuera de la carpeta conectada: ' . $rel, 403);
            }
            if ($exists && ($_POST['overwrite'] ?? '') !== '1') {
                echo json_encode([
                    'success' => false,
                    'exists'  => true,
                    'message' => 'Ya existe un documento en esa ruta',
                    'path'    => $rel
                ], JSON_UNESCAPED_UNICODE);
                exit;
            }

            if (@file_put_contents($target, $content) === false) {
                $err = error_get_last();
                notes_fail('No se pudo escribir el documento: ' . ($err['message'] ?? 'error de IO'), 500);
            }
            clearstatcache(true, $target);   // tamano/mtime frescos tras reescribir

            echo json_encode([
                'success'  => true,
                'path'     => $rel,
                'fullPath' => fs_norm($target),
                'folder'   => $root,
                'name'     => basename($root),
                'created'  => !$exists,
                'size'     => fs_fmt_size(@filesize($target)),
                'mtime'    => date('Y-m-d H:i:s', (int) @filemtime($target)),
            ], JSON_UNESCAPED_UNICODE);
            break;
        }

        case 'list': {
            echo json_encode([
                'success' => true,
                'folder'  => $root,
                'name'    => basename($root),
                'docs'    => notes_scan($root),
            ], JSON_UNESCAPED_UNICODE);
            break;
        }

        case 'read': {
            $rel  = notes_safe_rel($_GET['path'] ?? $_POST['path'] ?? '');
            $file = fs_norm($root) . '/' . $rel;
            if (!is_file($file))                     notes_fail('No existe el documento: ' . $rel, 404);
            if (!fs_is_within($root, $file))         notes_fail('Ruta fuera de la carpeta conectada: ' . $rel, 403);
            if (@filesize($file) > NOTES_MAX_BYTES)  notes_fail('Documento demasiado grande (max 4 MB).');

            $raw = @file_get_contents($file);
            if ($raw === false) notes_fail('No se pudo leer el documento: ' . $rel, 500);

            echo json_encode([
                'success' => true,
                'folder'  => $root,
                'path'    => $rel,
                'content' => $raw,
                'size'    => fs_fmt_size(@filesize($file)),
                'mtime'   => date('Y-m-d H:i:s', (int) @filemtime($file)),
            ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
            break;
        }

        default:
            notes_fail('Accion no reconocida: ' . $action);
    }
} catch (FsIntrospectException $e) {
    notes_fail($e->getMessage());
} catch (Throwable $e) {
    notes_fail('Error al procesar el documento: ' . $e->getMessage(), 500);
}
