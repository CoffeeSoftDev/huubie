<?php
// Preferencias del visor en SQLite (antes solo vivian en localStorage del navegador).
// Almacen clave-valor por usuario: cuentas Claude del panel de creditos, recordatorios
// disparados, modelos LLM habilitados y modelo activo. Autocontenido: crea BD y tabla al vuelo.
// Acciones (`action` por POST o GET):
//   list -> devuelve todas las preferencias del usuario  { prefs: { clave: valorCrudo } }
//   set  -> guarda una preferencia (upsert por usuario+clave)
//
// El valor se guarda como el string CRUDO que el cliente tiene en localStorage (JSON o texto
// plano). Asi el servidor no necesita conocer la forma de cada preferencia.
require_once __DIR__ . '/../../ctrl/auth-session.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function prefs_fail($msg, $code = 400) {
    http_response_code($code);
    echo json_encode(['success' => false, 'message' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}

// Solo estas claves se persisten. Cualquier otra se rechaza (el cliente no dicta el esquema).
const PREFS_ALLOWED = [
    'coffeeia:claude:accounts',       // creditos: cuentas Claude registradas
    'coffeeia:claude:reminderFired',  // creditos: recordatorios ya disparados
    'coffeeia:global:enabledModels',  // LLM: modelos habilitados
    'coffeeia:global:activeModel',    // LLM: modelo activo
    'coffeeia:global:modelCatalog',   // LLM: catalogo editable de modelos (CRUD del admin)
    'visor:shortcuts:v1',             // sidebar: accesos directos (URLs configurables)
    'visor:recentViews:v1',           // sidebar: documentos vistos recientemente
    'visor:recentCreated:v1'          // sidebar: documentos creados recientemente
];
const PREFS_MAX_BYTES = 262144;   // 256 KB por preferencia

if (!extension_loaded('pdo_sqlite')) {
    prefs_fail('La extension pdo_sqlite de PHP no esta habilitada en el servidor', 500);
}

// ── Conexion / esquema ──────────────────────────────────────────────────────
$dataDir = __DIR__ . '/../data';
if (!is_dir($dataDir) && !@mkdir($dataDir, 0775, true)) {
    prefs_fail('No se pudo crear el directorio de datos', 500);
}

try {
    $pdo = new PDO('sqlite:' . $dataDir . '/prefs.sqlite');
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec('PRAGMA journal_mode = WAL');
    $pdo->exec('
        CREATE TABLE IF NOT EXISTS prefs (
            user_id    TEXT NOT NULL DEFAULT "",
            pref_key   TEXT NOT NULL,
            pref_value TEXT NOT NULL DEFAULT "",
            updated_at TEXT NOT NULL,
            PRIMARY KEY (user_id, pref_key)
        )
    ');
} catch (Throwable $e) {
    prefs_fail('No se pudo abrir la base de datos: ' . $e->getMessage(), 500);
}

// Usuario de la sesion. Sin sesion iniciada las preferencias caen en el perfil
// invitado ("") — mismo criterio que los chats, que aceptan user_id vacio.
$userId = isset($_SESSION['user_id']) ? (string) $_SESSION['user_id'] : '';

$action = $_POST['action'] ?? $_GET['action'] ?? '';

try {
    switch ($action) {

        case 'list': {
            $st = $pdo->prepare('SELECT pref_key, pref_value FROM prefs WHERE user_id = ?');
            $st->execute([$userId]);
            $prefs = [];
            foreach ($st->fetchAll(PDO::FETCH_ASSOC) as $row) {
                if (in_array($row['pref_key'], PREFS_ALLOWED, true)) {
                    $prefs[$row['pref_key']] = $row['pref_value'];
                }
            }
            echo json_encode([
                'success' => true,
                'user_id' => $userId,
                'prefs'   => (object) $prefs
            ], JSON_UNESCAPED_UNICODE);
            break;
        }

        case 'set': {
            $key = trim($_POST['key'] ?? '');
            if (!in_array($key, PREFS_ALLOWED, true)) prefs_fail('Preferencia no permitida: ' . $key);

            $value = (string) ($_POST['value'] ?? '');
            if (strlen($value) > PREFS_MAX_BYTES) prefs_fail('La preferencia excede el tamano maximo');

            $st = $pdo->prepare('
                INSERT INTO prefs (user_id, pref_key, pref_value, updated_at)
                VALUES (?, ?, ?, ?)
                ON CONFLICT(user_id, pref_key)
                DO UPDATE SET pref_value = excluded.pref_value, updated_at = excluded.updated_at
            ');
            $st->execute([$userId, $key, $value, date('Y-m-d H:i:s')]);

            echo json_encode(['success' => true, 'key' => $key], JSON_UNESCAPED_UNICODE);
            break;
        }

        default:
            prefs_fail('Accion no reconocida: ' . $action);
    }
} catch (Throwable $e) {
    prefs_fail('Error en la base de datos: ' . $e->getMessage(), 500);
}
