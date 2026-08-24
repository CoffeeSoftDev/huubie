<?php
/**
 * ImageLab — almacen de trabajos (SQLite, data/jobs.sqlite).
 *
 * Aqui vive el truco central del harness: el cliente recibe un id PROPIO y opaco, no
 * el del proveedor. La correspondencia jobId -> external_id se queda del lado
 * servidor. TapEdit resuelve lo mismo cifrando con AES el predictionId de Replicate;
 * una tabla es mas simple y ademas deja auditar lo que se gasto.
 */

require_once __DIR__ . '/config.php';

function il_jobs_pdo() {
    static $pdo = null;
    if ($pdo !== null) return $pdo;

    if (!extension_loaded('pdo_sqlite')) throw new RuntimeException('Falta la extension pdo_sqlite de PHP');

    $dataDir = __DIR__ . '/../data';
    if (!is_dir($dataDir) && !@mkdir($dataDir, 0775, true)) {
        throw new RuntimeException('No se pudo crear el directorio de datos (' . $dataDir . ')');
    }
    if (!is_writable($dataDir)) {
        throw new RuntimeException('El directorio de datos no tiene permiso de escritura: ' . $dataDir);
    }

    $pdo = new PDO('sqlite:' . $dataDir . '/jobs.sqlite');
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec('PRAGMA journal_mode = WAL');
    $pdo->exec('
        CREATE TABLE IF NOT EXISTS jobs (
            id          TEXT PRIMARY KEY,
            owner       TEXT NOT NULL DEFAULT "",
            task        TEXT NOT NULL,
            alias       TEXT NOT NULL,
            provider    TEXT NOT NULL,
            model       TEXT NOT NULL,
            params      TEXT NOT NULL DEFAULT "{}",
            external_id TEXT NOT NULL DEFAULT "",
            status      TEXT NOT NULL DEFAULT "starting",
            source_url  TEXT NOT NULL DEFAULT "",
            output_url  TEXT NOT NULL DEFAULT "",
            error       TEXT NOT NULL DEFAULT "",
            created_at  TEXT NOT NULL,
            updated_at  TEXT NOT NULL
        )
    ');
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_jobs_owner ON jobs (owner, created_at DESC)');
    return $pdo;
}

function il_jobs_create(array $job) {
    $now = date('c');
    $id  = 'job_' . bin2hex(random_bytes(16));

    $st = il_jobs_pdo()->prepare('
        INSERT INTO jobs (id, owner, task, alias, provider, model, params, status, created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, "starting", ?, ?)
    ');
    $st->execute([
        $id,
        (string)($job['owner'] ?? ''),
        (string) $job['task'],
        (string) $job['alias'],
        (string) $job['provider'],
        (string) $job['model'],
        json_encode($job['params'] ?? [], JSON_UNESCAPED_UNICODE),
        $now,
        $now,
    ]);
    return $id;
}

function il_jobs_get($id, $owner) {
    $st = il_jobs_pdo()->prepare('SELECT * FROM jobs WHERE id = ? AND owner = ?');
    $st->execute([(string) $id, (string) $owner]);
    $row = $st->fetch(PDO::FETCH_ASSOC);
    return $row === false ? null : $row;
}

function il_jobs_update($id, array $fields) {
    $allowed = ['external_id', 'status', 'source_url', 'output_url', 'error'];
    $sets = [];
    $vals = [];
    foreach ($fields as $k => $v) {
        if (!in_array($k, $allowed, true)) continue;
        $sets[] = $k . ' = ?';
        $vals[] = (string) $v;
    }
    if ($sets === []) return;
    $sets[] = 'updated_at = ?';
    $vals[] = date('c');
    $vals[] = (string) $id;

    il_jobs_pdo()->prepare('UPDATE jobs SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($vals);
}

function il_jobs_recent($owner, $limit = 24) {
    $st = il_jobs_pdo()->prepare('
        SELECT id, task, alias, provider, status, output_url, error, params, created_at
        FROM jobs WHERE owner = ? ORDER BY created_at DESC LIMIT ?
    ');
    $st->bindValue(1, (string) $owner, PDO::PARAM_STR);
    $st->bindValue(2, (int) $limit, PDO::PARAM_INT);
    $st->execute();
    return $st->fetchAll(PDO::FETCH_ASSOC);
}
