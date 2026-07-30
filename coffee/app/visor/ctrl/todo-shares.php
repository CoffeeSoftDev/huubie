<?php
// Comparticiones de listas TODO entre cuentas. La lista NO se mueve ni se copia:
// sigue viviendo en la biblioteca de su dueno (documents/users/<owner>/...) y aqui
// solo se registra quien mas puede verla y con que permiso. Asi el todo.json sigue
// siendo un archivo del proyecto y no hay dos versiones que reconciliar.
//
// Identidad de una lista compartida: owner_id + rel (ruta relativa a la biblioteca
// del dueno). Sobrevive a que el archivo cambie de titulo, y si lo mueven de carpeta
// la comparticion deja de resolver — que es justo lo que debe pasar.
require_once __DIR__ . '/library-roots.php';
require_once __DIR__ . '/../../ctrl/auth-db.php';

if (!function_exists('todo_shares_pdo')) {

    function todo_shares_pdo() {
        static $pdo = null;
        if ($pdo) return $pdo;

        $dataDir = __DIR__ . '/../data';
        if (!is_dir($dataDir) && !@mkdir($dataDir, 0775, true)) {
            throw new RuntimeException('No se pudo crear el directorio de datos (' . $dataDir . ')');
        }

        $pdo = new PDO('sqlite:' . $dataDir . '/todo-shares.sqlite');
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $pdo->exec('PRAGMA journal_mode = WAL');
        $pdo->exec('
            CREATE TABLE IF NOT EXISTS todo_shares (
                owner_id   INTEGER NOT NULL,
                rel        TEXT NOT NULL,
                target_id  INTEGER NOT NULL,
                permission TEXT NOT NULL DEFAULT "edit",
                created_at TEXT NOT NULL,
                PRIMARY KEY (owner_id, rel, target_id)
            )
        ');
        $pdo->exec('CREATE INDEX IF NOT EXISTS idx_todo_shares_target ON todo_shares(target_id)');
        return $pdo;
    }

    // Id numerico de la sesion, o 0 si no hay cuenta iniciada. Compartir exige
    // cuenta real: el perfil invitado no tiene con quien compartir ni quien lo
    // identifique del otro lado.
    function todo_shares_user_id() {
        return isset($_SESSION['user_id']) ? (int) $_SESSION['user_id'] : 0;
    }

    function todo_shares_norm_rel($rel) {
        $rel = trim(str_replace('\\', '/', (string) $rel), '/');
        // Una lista solo se comparte por su ruta literal: sin saltos hacia arriba
        // nadie puede registrar un permiso sobre algo fuera de su biblioteca.
        if ($rel === '' || preg_match('#(^|/)\.\.(/|$)#', $rel)) return '';
        return $rel;
    }

    function todo_shares_perm($value) {
        return ((string) $value === 'view') ? 'view' : 'edit';
    }

    // ── Catalogo de cuentas ─────────────────────────────────────────────────
    // Se lee de auth.sqlite (la misma tabla del login). Solo nombre y correo: el
    // selector de compartir no necesita ni debe conocer nada mas.
    function todo_shares_users() {
        try {
            $st = auth_pdo()->query('SELECT id, name, email, avatar_url FROM users ORDER BY name COLLATE NOCASE');
            $rows = $st->fetchAll(PDO::FETCH_ASSOC) ?: [];
        } catch (Throwable $e) {
            return [];
        }
        return array_map(function ($u) {
            return [
                'id'     => (int) $u['id'],
                'name'   => (string) $u['name'],
                'email'  => (string) $u['email'],
                'avatar' => $u['avatar_url'] ?: ''
            ];
        }, $rows);
    }

    // Mapa id => ficha, para resolver nombres sin una consulta por fila.
    function todo_shares_users_map() {
        static $map = null;
        if ($map !== null) return $map;
        $map = [];
        foreach (todo_shares_users() as $u) $map[$u['id']] = $u;
        return $map;
    }

    function todo_shares_user_label($id) {
        $map = todo_shares_users_map();
        if (isset($map[(int) $id])) return $map[(int) $id]['name'] ?: $map[(int) $id]['email'];
        return 'Usuario ' . (int) $id;
    }

    // ── Consultas ───────────────────────────────────────────────────────────
    // Lo que YO comparto, agrupado por lista: { rel => [ {id, name, email, permission} ] }.
    function todo_shares_by_owner($ownerId) {
        $st = todo_shares_pdo()->prepare('SELECT rel, target_id, permission FROM todo_shares WHERE owner_id = ?');
        $st->execute([(int) $ownerId]);

        $out = [];
        foreach ($st->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
            $map = todo_shares_users_map();
            $u   = $map[(int) $row['target_id']] ?? null;
            $out[$row['rel']][] = [
                'id'         => (int) $row['target_id'],
                'name'       => $u ? $u['name']  : todo_shares_user_label($row['target_id']),
                'email'      => $u ? $u['email'] : '',
                'permission' => todo_shares_perm($row['permission'])
            ];
        }
        return $out;
    }

    // Lo que comparten CONMIGO: una fila por lista, con el dueno resuelto.
    function todo_shares_for_target($targetId) {
        $st = todo_shares_pdo()->prepare('SELECT owner_id, rel, permission FROM todo_shares WHERE target_id = ?');
        $st->execute([(int) $targetId]);

        $out = [];
        foreach ($st->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
            $out[] = [
                'ownerId'    => (int) $row['owner_id'],
                'ownerName'  => todo_shares_user_label($row['owner_id']),
                'rel'        => (string) $row['rel'],
                'permission' => todo_shares_perm($row['permission'])
            ];
        }
        return $out;
    }

    // Permiso que tiene $userId sobre una lista ajena, o null si no se la comparten.
    function todo_shares_permission_of($ownerId, $rel, $userId) {
        $rel = todo_shares_norm_rel($rel);
        if ($rel === '' || (int) $userId <= 0) return null;

        $st = todo_shares_pdo()->prepare('SELECT permission FROM todo_shares WHERE owner_id = ? AND rel = ? AND target_id = ?');
        $st->execute([(int) $ownerId, $rel, (int) $userId]);
        $perm = $st->fetchColumn();
        return $perm === false ? null : todo_shares_perm($perm);
    }

    // ── Altas y bajas ───────────────────────────────────────────────────────
    function todo_shares_set($ownerId, $rel, $targetId, $permission) {
        $rel = todo_shares_norm_rel($rel);
        if ($rel === '') return false;

        $st = todo_shares_pdo()->prepare('
            INSERT INTO todo_shares (owner_id, rel, target_id, permission, created_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(owner_id, rel, target_id) DO UPDATE SET permission = excluded.permission
        ');
        $st->execute([(int) $ownerId, $rel, (int) $targetId, todo_shares_perm($permission), date('c')]);
        return true;
    }

    function todo_shares_remove($ownerId, $rel, $targetId) {
        $rel = todo_shares_norm_rel($rel);
        if ($rel === '') return false;

        $st = todo_shares_pdo()->prepare('DELETE FROM todo_shares WHERE owner_id = ? AND rel = ? AND target_id = ?');
        $st->execute([(int) $ownerId, $rel, (int) $targetId]);
        return true;
    }

    // Al borrar o mover una lista quedaria un permiso apuntando a la nada. No es
    // peligroso (la ruta ya no resuelve), pero se limpia para que el panel del
    // dueno no muestre comparticiones fantasma.
    function todo_shares_forget($ownerId, $rel) {
        $rel = todo_shares_norm_rel($rel);
        if ($rel === '') return false;

        $st = todo_shares_pdo()->prepare('DELETE FROM todo_shares WHERE owner_id = ? AND rel = ?');
        $st->execute([(int) $ownerId, $rel]);
        return true;
    }
}
