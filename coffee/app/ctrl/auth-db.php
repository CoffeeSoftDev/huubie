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
    $pdo->exec('PRAGMA foreign_keys = ON');
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

    $userColumns = array_column($pdo->query('PRAGMA table_info(users)')->fetchAll(PDO::FETCH_ASSOC), 'name');
    if (!in_array('pin_hash', $userColumns, true)) {
        $pdo->exec('ALTER TABLE users ADD COLUMN pin_hash TEXT');
    }

    $pdo->exec("
        CREATE TABLE IF NOT EXISTS profiles (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id     INTEGER NOT NULL,
            name         TEXT NOT NULL COLLATE NOCASE,
            short_name   TEXT NOT NULL DEFAULT '',
            role         TEXT NOT NULL DEFAULT '',
            specialty    TEXT NOT NULL DEFAULT '',
            description  TEXT NOT NULL DEFAULT '',
            color        TEXT NOT NULL DEFAULT '#6366F1',
            avatar_type  TEXT NOT NULL DEFAULT 'initials',
            avatar_value TEXT NOT NULL DEFAULT '',
            is_active   INTEGER NOT NULL DEFAULT 0 CHECK (is_active IN (0, 1)),
            created_at  TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at  TEXT NOT NULL DEFAULT (datetime('now')),
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )
    ");

    $profileColumns = array_column($pdo->query('PRAGMA table_info(profiles)')->fetchAll(PDO::FETCH_ASSOC), 'name');
    $profileMigrations = [
        'short_name'   => "ALTER TABLE profiles ADD COLUMN short_name TEXT NOT NULL DEFAULT ''",
        'specialty'    => "ALTER TABLE profiles ADD COLUMN specialty TEXT NOT NULL DEFAULT ''",
        'avatar_type'  => "ALTER TABLE profiles ADD COLUMN avatar_type TEXT NOT NULL DEFAULT 'initials'",
        'avatar_value' => "ALTER TABLE profiles ADD COLUMN avatar_value TEXT NOT NULL DEFAULT ''"
    ];
    foreach ($profileMigrations as $column => $query) {
        if (!in_array($column, $profileColumns, true)) $pdo->exec($query);
    }

    $pdo->exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_user_name ON profiles(user_id, name)');
    $pdo->exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_one_active ON profiles(user_id) WHERE is_active = 1');

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

function auth_list_profiles(int $userId): array
{
    $st = auth_pdo()->prepare('SELECT * FROM profiles WHERE user_id = ? ORDER BY is_active DESC, name ASC');
    $st->execute([$userId]);
    return $st->fetchAll(PDO::FETCH_ASSOC);
}

function auth_find_profile(int $id, int $userId): ?array
{
    $st = auth_pdo()->prepare('SELECT * FROM profiles WHERE id = ? AND user_id = ?');
    $st->execute([$id, $userId]);
    $profile = $st->fetch(PDO::FETCH_ASSOC);
    return $profile ?: null;
}

function auth_active_profile(int $userId): ?array
{
    $st = auth_pdo()->prepare('SELECT * FROM profiles WHERE user_id = ? AND is_active = 1 LIMIT 1');
    $st->execute([$userId]);
    $profile = $st->fetch(PDO::FETCH_ASSOC);
    return $profile ?: null;
}
