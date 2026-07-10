<?php
function auth_pdo(): PDO
{
    static $pdo = null;
    if ($pdo) return $pdo;

    if (!extension_loaded('pdo_sqlite')) {
        http_response_code(500);
        die(json_encode(['success' => false, 'message' => 'La extension pdo_sqlite de PHP no esta habilitada en el servidor']));
    }

    $dataDir = __DIR__ . '/../data';
    if (!is_dir($dataDir) && !@mkdir($dataDir, 0775, true)) {
        http_response_code(500);
        die(json_encode(['success' => false, 'message' => 'No se pudo crear el directorio de datos']));
    }

    $pdo = new PDO('sqlite:' . $dataDir . '/auth.sqlite');
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec('PRAGMA journal_mode = WAL');
    $pdo->exec("
        CREATE TABLE IF NOT EXISTS users (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            email         TEXT NOT NULL COLLATE NOCASE,
            name          TEXT NOT NULL,
            avatar_url    TEXT,
            google_id     TEXT,
            password_hash TEXT,
            created_at    TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at    TEXT NOT NULL DEFAULT (datetime('now')),
            CHECK (google_id IS NOT NULL OR password_hash IS NOT NULL)
        )
    ");
    $pdo->exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users(email)');
    $pdo->exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL');

    return $pdo;
}

function auth_find_by_id(int $id): ?array
{
    $st = auth_pdo()->prepare('SELECT * FROM users WHERE id = ?');
    $st->execute([$id]);
    $r = $st->fetch(PDO::FETCH_ASSOC);
    return $r ?: null;
}

function auth_find_by_email(string $email): ?array
{
    $st = auth_pdo()->prepare('SELECT * FROM users WHERE email = ?');
    $st->execute([$email]);
    $r = $st->fetch(PDO::FETCH_ASSOC);
    return $r ?: null;
}

function auth_find_by_google_id(string $googleId): ?array
{
    $st = auth_pdo()->prepare('SELECT * FROM users WHERE google_id = ?');
    $st->execute([$googleId]);
    $r = $st->fetch(PDO::FETCH_ASSOC);
    return $r ?: null;
}
