<?php
// Almacen de conversaciones de CoffeeIA en SQLite. Autocontenido: crea la BD y la
// tabla al vuelo. Acciones via POST FormData (campo `action`):
//   save   -> inserta o actualiza una conversacion (upsert por uid)
//   list   -> lista las conversaciones (resumen, sin el cuerpo de mensajes)
//   get    -> devuelve una conversacion completa por uid
//   delete -> elimina una conversacion por uid
//
// El historial es PRIVADO de cada cuenta: el dueño sale de la sesion, no de lo que
// mande el cliente, y toda consulta filtra por el. Un user_id en el POST se ignora.
require_once __DIR__ . '/library-roots.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function chats_fail($msg, $code = 400) {
    http_response_code($code);
    echo json_encode(['success' => false, 'message' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}

if (!extension_loaded('pdo_sqlite')) {
    chats_fail('La extension pdo_sqlite de PHP no esta habilitada en el servidor', 500);
}

// ── Conexion / esquema ──────────────────────────────────────────────────────
$dataDir = __DIR__ . '/../data';
if (!is_dir($dataDir) && !@mkdir($dataDir, 0775, true)) {
    chats_fail('No se pudo crear el directorio de datos', 500);
}

try {
    $pdo = new PDO('sqlite:' . $dataDir . '/chats.sqlite');
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec('PRAGMA journal_mode = WAL');
    $pdo->exec('
        CREATE TABLE IF NOT EXISTS chats (
            id         INTEGER PRIMARY KEY AUTOINCREMENT,
            uid        TEXT UNIQUE NOT NULL,
            title      TEXT NOT NULL DEFAULT "Sin titulo",
            user_id    TEXT NOT NULL DEFAULT "",
            model      TEXT NOT NULL DEFAULT "",
            doc        TEXT NOT NULL DEFAULT "",
            app        TEXT NOT NULL DEFAULT "",
            messages   TEXT NOT NULL DEFAULT "[]",
            msg_count  INTEGER NOT NULL DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        )
    ');

    // `app` = modulo de origen ("visor" | "coffeeia"). El Visor y CoffeeIA comparten
    // esta tabla pero sus conversaciones son SEPARADAS: cada uno lista solo las
    // suyas. Migracion suave para bases creadas antes de que existiera la columna.
    $cols = $pdo->query('PRAGMA table_info(chats)')->fetchAll(PDO::FETCH_COLUMN, 1);
    if (!in_array('app', $cols, true)) {
        $pdo->exec('ALTER TABLE chats ADD COLUMN app TEXT NOT NULL DEFAULT ""');
    }
} catch (Throwable $e) {
    chats_fail('No se pudo abrir la base de datos: ' . $e->getMessage(), 500);
}

// Dueño de todo lo que pase por aqui. Misma clave que la biblioteca de documentos,
// para que una cuenta sea la misma cosa en todo el visor.
$userId = coffee_visor_user_key();

$action = $_POST['action'] ?? $_GET['action'] ?? '';

try {
    switch ($action) {

        case 'save': {
            $messagesRaw = $_POST['messages'] ?? '[]';
            $decoded     = json_decode($messagesRaw, true);
            if (!is_array($decoded)) chats_fail('El campo messages no es un JSON valido');
            if (count($decoded) === 0) chats_fail('No hay mensajes que guardar');

            $title = trim($_POST['title'] ?? '');
            if ($title === '') $title = 'Conversacion ' . date('Y-m-d H:i');
            $title = mb_substr($title, 0, 160);

            $uid    = trim($_POST['uid'] ?? '');
            $model  = trim($_POST['model'] ?? '');
            $doc    = trim($_POST['doc'] ?? '');
            $app    = trim($_POST['app'] ?? '');   // modulo de origen: visor | coffeeia
            $count  = count($decoded);
            $now    = date('Y-m-d H:i:s');

            // Re-serializar para normalizar/compactar lo recibido.
            $messages = json_encode($decoded, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

            // ¿Existe ya? -> update; si no -> insert. El uid de otra cuenta no se
            // toca: se responde 403 en vez de reescribirle la conversacion.
            $exists = false;
            if ($uid !== '') {
                $chk = $pdo->prepare('SELECT user_id FROM chats WHERE uid = ?');
                $chk->execute([$uid]);
                $owner = $chk->fetchColumn();
                if ($owner !== false) {
                    if ((string) $owner !== $userId) chats_fail('Esa conversacion es de otra cuenta', 403);
                    $exists = true;
                }
            }

            if ($exists) {
                // Si el cliente no manda `app`, se conserva el que ya tiene la fila
                // (no se pierde el origen al re-guardar desde un cliente antiguo).
                $st = $pdo->prepare("
                    UPDATE chats
                       SET title = ?, user_id = ?, model = ?, doc = ?,
                           app = CASE WHEN ? = '' THEN app ELSE ? END,
                           messages = ?, msg_count = ?, updated_at = ?
                     WHERE uid = ? AND user_id = ?
                ");
                $st->execute([$title, $userId, $model, $doc, $app, $app, $messages, $count, $now, $uid, $userId]);
            } else {
                if ($uid === '') $uid = 'chat_' . bin2hex(random_bytes(8));
                $st = $pdo->prepare('
                    INSERT INTO chats (uid, title, user_id, model, doc, app, messages, msg_count, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ');
                $st->execute([$uid, $title, $userId, $model, $doc, $app, $messages, $count, $now, $now]);
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
            // Cada modulo lista SOLO sus conversaciones: el Visor y CoffeeIA comparten
            // la tabla pero no el historial. Sin `app` se devuelven las de la cuenta
            // en curso, de cualquier modulo.
            $app = trim($_POST['app'] ?? $_GET['app'] ?? '');

            $where  = ['user_id = ?'];
            $params = [$userId];
            if ($app !== '') { $where[] = 'app = ?'; $params[] = $app; }
            $sql = 'SELECT uid, title, user_id, model, doc, app, msg_count, created_at, updated_at
                      FROM chats WHERE ' . implode(' AND ', $where)
                 . ' ORDER BY updated_at DESC LIMIT 200';

            $st = $pdo->prepare($sql);
            $st->execute($params);
            echo json_encode([
                'success' => true,
                'rows'    => $st->fetchAll(PDO::FETCH_ASSOC)
            ], JSON_UNESCAPED_UNICODE);
            break;
        }

        case 'get': {
            $uid = trim($_POST['uid'] ?? $_GET['uid'] ?? '');
            if ($uid === '') chats_fail('Falta el uid');
            // El uid entra por la URL: sin el filtro por dueño, conocerlo bastaria
            // para leer la conversacion de otra cuenta.
            $st = $pdo->prepare('SELECT * FROM chats WHERE uid = ? AND user_id = ?');
            $st->execute([$uid, $userId]);
            $row = $st->fetch(PDO::FETCH_ASSOC);
            if (!$row) chats_fail('Conversacion no encontrada', 404);
            $row['messages'] = json_decode($row['messages'], true) ?: [];
            echo json_encode(['success' => true, 'chat' => $row], JSON_UNESCAPED_UNICODE);
            break;
        }

        case 'delete': {
            $uid = trim($_POST['uid'] ?? '');
            if ($uid === '') chats_fail('Falta el uid');
            $st = $pdo->prepare('DELETE FROM chats WHERE uid = ? AND user_id = ?');
            $st->execute([$uid, $userId]);
            echo json_encode(['success' => true, 'deleted' => $st->rowCount()], JSON_UNESCAPED_UNICODE);
            break;
        }

        default:
            chats_fail('Accion no reconocida: ' . $action);
    }
} catch (Throwable $e) {
    chats_fail('Error en la base de datos: ' . $e->getMessage(), 500);
}
