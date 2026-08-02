<?php
/* Códigos de vinculación para aplicaciones externas (hoy: el TODO de avatars).
 *
 * El problema que resuelven: las cuentas viven en ESTE servidor (auth.sqlite) y
 * la otra aplicación corre en otro dominio. Si el usuario escribiera ahí su PIN,
 * la credencial cruzaría por una máquina que no es la dueña de las cuentas. Con
 * el código, la credencial no sale nunca de aquí: el usuario ya tiene sesión
 * abierta en el visor, pide un código, y lo pega allá.
 *
 * El código no es una credencial permanente: caduca a los 10 minutos, sirve una
 * sola vez y se puede revocar. Lo que la otra aplicación recibe al canjearlo es
 * el id de la cuenta, no una llave.
 *
 * Vive en su propia base y no en auth.sqlite: es un dato de integración, no de
 * identidad, y así una limpieza de códigos jamás puede tocar las cuentas.
 */

if (!defined('TODO_LINK_DB')) define('TODO_LINK_DB', __DIR__ . '/../data/todo-link.sqlite');

const TODO_LINK_TTL      = 600;   // 10 minutos de vida
const TODO_LINK_KEEP     = 30;    // días que se conservan los canjes, para poder revisarlos
const TODO_LINK_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   // sin I,O,0,1: se confunden al teclear

function todo_link_db() {
    static $pdo = null;
    if ($pdo !== null) return $pdo;

    $dir = dirname(TODO_LINK_DB);
    if (!is_dir($dir)) @mkdir($dir, 0775, true);

    $pdo = new PDO('sqlite:' . TODO_LINK_DB);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec('PRAGMA journal_mode = WAL');
    $pdo->exec('
        CREATE TABLE IF NOT EXISTS link_codes (
            code       TEXT PRIMARY KEY,
            user_id    INTEGER NOT NULL,
            app        TEXT NOT NULL DEFAULT "",
            created_at TEXT NOT NULL,
            expires_at TEXT NOT NULL,
            used_at    TEXT,
            used_by    TEXT
        )
    ');
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_link_user ON link_codes (user_id)');

    return $pdo;
}

/** Formato legible: 4KJ9-2XPQ. Se dicta y se teclea sin dudar de la O y el 0. */
function todo_link_generate($userId, $app = '') {
    $bruto = '';
    for ($i = 0; $i < 8; $i++) {
        $bruto .= TODO_LINK_ALPHABET[random_int(0, strlen(TODO_LINK_ALPHABET) - 1)];
    }
    $code = substr($bruto, 0, 4) . '-' . substr($bruto, 4);

    $now = time();
    todo_link_db()->prepare('
        INSERT INTO link_codes (code, user_id, app, created_at, expires_at)
        VALUES (?, ?, ?, ?, ?)
    ')->execute([
        $code, (int) $userId, (string) $app,
        date('Y-m-d H:i:s', $now), date('Y-m-d H:i:s', $now + TODO_LINK_TTL),
    ]);

    todo_link_purge();

    return ['code' => $code, 'expires_at' => date('Y-m-d H:i:s', $now + TODO_LINK_TTL), 'ttl' => TODO_LINK_TTL];
}

/**
 * Canjea el código y devuelve el id de la cuenta. Un código gastado o vencido no
 * dice cuál de las dos cosas fue: distinguirlo solo ayuda a quien esté probando
 * códigos al azar.
 */
function todo_link_redeem($code, $usedBy = '') {
    $code = strtoupper(trim((string) $code));
    if ($code === '') return null;
    if (strpos($code, '-') === false && strlen($code) === 8) {
        $code = substr($code, 0, 4) . '-' . substr($code, 4);   // aceptar sin guion
    }

    $st = todo_link_db()->prepare('SELECT * FROM link_codes WHERE code = ?');
    $st->execute([$code]);
    $row = $st->fetch(PDO::FETCH_ASSOC);

    if (!$row)                                        return null;
    if ($row['used_at'] !== null)                     return null;
    if (strtotime($row['expires_at']) < time())       return null;

    todo_link_db()->prepare('UPDATE link_codes SET used_at = ?, used_by = ? WHERE code = ?')
        ->execute([date('Y-m-d H:i:s'), (string) $usedBy, $code]);

    return (int) $row['user_id'];
}

/** Códigos vivos de una cuenta, para poder revocarlos desde el visor. */
function todo_link_active($userId) {
    $st = todo_link_db()->prepare('
        SELECT code, created_at, expires_at FROM link_codes
        WHERE user_id = ? AND used_at IS NULL AND expires_at > ?
        ORDER BY created_at DESC
    ');
    $st->execute([(int) $userId, date('Y-m-d H:i:s')]);
    return $st->fetchAll(PDO::FETCH_ASSOC);
}

function todo_link_revoke($code, $userId) {
    $st = todo_link_db()->prepare('DELETE FROM link_codes WHERE code = ? AND user_id = ?');
    $st->execute([strtoupper(trim((string) $code)), (int) $userId]);
    return $st->rowCount() > 0;
}

/** Los vencidos sin usar no dejan rastro útil; los canjeados se guardan un mes. */
function todo_link_purge() {
    try {
        todo_link_db()->prepare('DELETE FROM link_codes WHERE used_at IS NULL AND expires_at < ?')
            ->execute([date('Y-m-d H:i:s')]);
        todo_link_db()->prepare('DELETE FROM link_codes WHERE used_at IS NOT NULL AND used_at < ?')
            ->execute([date('Y-m-d H:i:s', time() - TODO_LINK_KEEP * 86400)]);
    } catch (Throwable $e) { /* la poda nunca debe romper una vinculación */ }
}
