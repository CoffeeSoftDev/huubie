<?php
// Almacen de HILOS de conversacion del Playground en SQLite. Aislado del visor
// (no comparte la BD chats.sqlite) para no entrelazar datos ni romperlo. Crea la
// BD y la tabla al vuelo. A diferencia de ctrl-chats.php, persiste tambien los
// `templates` (renders del sandbox) y un `meta` (tema/agente/canvas) para poder
// restaurar el estado completo del hilo y seguir iterando.
//
// Acciones via POST FormData (campo `action`):
//   save   -> inserta o actualiza un hilo (upsert por uid)
//   list   -> lista los hilos (resumen, SIN messages/templates pesados)
//   get    -> devuelve un hilo completo por uid
//   rename -> cambia SOLO el titulo de un hilo por uid (no toca messages/templates)
//   delete -> elimina un hilo por uid
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function pgt_fail($msg, $code = 400) {
    http_response_code($code);
    echo json_encode(['success' => false, 'message' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}

if (!extension_loaded('pdo_sqlite')) {
    pgt_fail('La extension pdo_sqlite de PHP no esta habilitada en el servidor', 500);
}

// ── Conexion / esquema ──────────────────────────────────────────────────────
$dataDir = __DIR__ . '/../data';
if (!is_dir($dataDir) && !@mkdir($dataDir, 0775, true)) {
    pgt_fail('No se pudo crear el directorio de datos', 500);
}

try {
    $pdo = new PDO('sqlite:' . $dataDir . '/pg-threads.sqlite');
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec('PRAGMA journal_mode = WAL');
    $pdo->exec('
        CREATE TABLE IF NOT EXISTS threads (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            uid        TEXT UNIQUE NOT NULL,
            title      TEXT NOT NULL DEFAULT "Sin titulo",
            user_id    TEXT NOT NULL DEFAULT "",
            model      TEXT NOT NULL DEFAULT "",
            meta       TEXT NOT NULL DEFAULT "{}",
            messages   TEXT NOT NULL DEFAULT "[]",
            templates  TEXT NOT NULL DEFAULT "[]",
            msg_count  INTEGER NOT NULL DEFAULT 0,
            tpl_count  INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    ');
} catch (Throwable $e) {
    pgt_fail('No se pudo abrir la base de datos: ' . $e->getMessage(), 500);
}

$action = $_POST['action'] ?? $_GET['action'] ?? '';

try {
    switch ($action) {

        case 'save': {
            $messagesRaw = $_POST['messages'] ?? '[]';
            $decoded     = json_decode($messagesRaw, true);
            if (!is_array($decoded)) pgt_fail('El campo messages no es un JSON valido');
            if (count($decoded) === 0) pgt_fail('No hay mensajes que guardar');

            $tplRaw  = $_POST['templates'] ?? '[]';
            $tplDec  = json_decode($tplRaw, true);
            if (!is_array($tplDec)) $tplDec = [];

            $metaRaw = $_POST['meta'] ?? '{}';
            $metaDec = json_decode($metaRaw, true);
            if (!is_array($metaDec)) $metaDec = [];

            $title = trim($_POST['title'] ?? '');
            if ($title === '') $title = 'Hilo ' . date('Y-m-d H:i');
            $title = mb_substr($title, 0, 160);

            $uid    = trim($_POST['uid'] ?? '');
            $userId = trim($_POST['user_id'] ?? '');
            $model  = trim($_POST['model'] ?? '');
            $count  = count($decoded);
            $tcount = count($tplDec);
            $now    = date('Y-m-d H:i:s');

            // Re-serializar para normalizar/compactar lo recibido.
            $messages  = json_encode($decoded, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            $templates = json_encode($tplDec,  JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            $meta      = json_encode($metaDec, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

            // ¿Existe ya? -> update; si no -> insert.
            $exists = false;
            if ($uid !== '') {
                $chk = $pdo->prepare('SELECT 1 FROM threads WHERE uid = ?');
                $chk->execute([$uid]);
                $exists = (bool) $chk->fetchColumn();
            }

            if ($exists) {
                $st = $pdo->prepare('
                    UPDATE threads
                       SET title = ?, user_id = ?, model = ?, meta = ?,
                           messages = ?, templates = ?, msg_count = ?, tpl_count = ?, updated_at = ?
                     WHERE uid = ?
                ');
                $st->execute([$title, $userId, $model, $meta, $messages, $templates, $count, $tcount, $now, $uid]);
            } else {
                if ($uid === '') $uid = 'th_' . bin2hex(random_bytes(8));
                $st = $pdo->prepare('
                    INSERT INTO threads (uid, title, user_id, model, meta, messages, templates, msg_count, tpl_count, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ');
                $st->execute([$uid, $title, $userId, $model, $meta, $messages, $templates, $count, $tcount, $now, $now]);
            }

            echo json_encode([
                'success'    => true,
                'uid'        => $uid,
                'title'      => $title,
                'updated_at' => $now
            ], JSON_UNESCAPED_UNICODE);
            break;
        }

        case 'list': {
            // No devolvemos messages/templates (pueden ser grandes); solo el resumen.
            $userId = trim($_POST['user_id'] ?? $_GET['user_id'] ?? '');
            if ($userId !== '') {
                $st = $pdo->prepare('
                    SELECT uid, title, user_id, model, msg_count, tpl_count, created_at, updated_at
                      FROM threads WHERE user_id = ? ORDER BY updated_at DESC LIMIT 200
                ');
                $st->execute([$userId]);
            } else {
                $st = $pdo->query('
                    SELECT uid, title, user_id, model, msg_count, tpl_count, created_at, updated_at
                      FROM threads ORDER BY updated_at DESC LIMIT 200
                ');
            }
            echo json_encode([
                'success' => true,
                'rows'    => $st->fetchAll(PDO::FETCH_ASSOC)
            ], JSON_UNESCAPED_UNICODE);
            break;
        }

        case 'get': {
            $uid = trim($_POST['uid'] ?? $_GET['uid'] ?? '');
            if ($uid === '') pgt_fail('Falta el uid');
            $st = $pdo->prepare('SELECT * FROM threads WHERE uid = ?');
            $st->execute([$uid]);
            $row = $st->fetch(PDO::FETCH_ASSOC);
            if (!$row) pgt_fail('Hilo no encontrado', 404);
            $row['messages']  = json_decode($row['messages'], true)  ?: [];
            $row['templates'] = json_decode($row['templates'], true) ?: [];
            $row['meta']      = json_decode($row['meta'], true)      ?: [];
            echo json_encode(['success' => true, 'thread' => $row], JSON_UNESCAPED_UNICODE);
            break;
        }

        case 'rename': {
            $uid   = trim($_POST['uid'] ?? '');
            $title = trim($_POST['title'] ?? '');
            if ($uid === '')   pgt_fail('Falta el uid');
            if ($title === '') pgt_fail('El título no puede estar vacío');
            $title = mb_substr($title, 0, 160);
            $now   = date('Y-m-d H:i:s');
            $st = $pdo->prepare('UPDATE threads SET title = ?, updated_at = ? WHERE uid = ?');
            $st->execute([$title, $now, $uid]);
            if ($st->rowCount() === 0) pgt_fail('Hilo no encontrado', 404);
            echo json_encode([
                'success'    => true,
                'uid'        => $uid,
                'title'      => $title,
                'updated_at' => $now
            ], JSON_UNESCAPED_UNICODE);
            break;
        }

        case 'delete': {
            $uid = trim($_POST['uid'] ?? '');
            if ($uid === '') pgt_fail('Falta el uid');
            $st = $pdo->prepare('DELETE FROM threads WHERE uid = ?');
            $st->execute([$uid]);
            echo json_encode(['success' => true, 'deleted' => $st->rowCount()], JSON_UNESCAPED_UNICODE);
            break;
        }

        default:
            pgt_fail('Accion no reconocida: ' . $action);
    }
} catch (Throwable $e) {
    pgt_fail('Error en la base de datos: ' . $e->getMessage(), 500);
}
