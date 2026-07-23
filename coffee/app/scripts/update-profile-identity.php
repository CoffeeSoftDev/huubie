<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Este actualizador solo puede ejecutarse desde la terminal.\n");
}

$appDir = dirname(__DIR__);
$dbPath = $appDir . '/data/auth.sqlite';
$requiredColumns = ['short_name', 'specialty', 'avatar_type', 'avatar_value'];

function stopUpdate(string $message, int $code = 1): void
{
    fwrite(STDERR, "[ERROR] {$message}\n");
    exit($code);
}

function profileColumns(PDO $pdo): array
{
    $rows = $pdo->query('PRAGMA table_info(profiles)')->fetchAll(PDO::FETCH_ASSOC);
    return array_column($rows, 'name');
}

function missingColumns(array $current, array $required): array
{
    return array_values(array_diff($required, $current));
}

echo "CoffeeSoft - Actualizador de identidad de perfiles\n";
echo "=================================================\n";

if (!extension_loaded('pdo_sqlite')) {
    stopUpdate('La extension pdo_sqlite no esta habilitada.');
}

if (is_file($dbPath)) {
    try {
        $probe = new PDO('sqlite:' . $dbPath);
        $missing = missingColumns(profileColumns($probe), $requiredColumns);
        if ($missing) {
            $backup = $dbPath . '.backup-' . date('Ymd-His');
            if (!copy($dbPath, $backup)) stopUpdate('No se pudo respaldar auth.sqlite.');
            echo "[OK] Respaldo creado: {$backup}\n";
        } else {
            echo "[OK] La base de datos ya tiene la migracion.\n";
        }
    } catch (Throwable $error) {
        stopUpdate('No se pudo revisar auth.sqlite: ' . $error->getMessage());
    }
} else {
    echo "[INFO] auth.sqlite no existe; se creara automaticamente.\n";
}

try {
    require_once $appDir . '/ctrl/auth-db.php';
    $pdo = auth_pdo();
    $missing = missingColumns(profileColumns($pdo), $requiredColumns);
    if ($missing) stopUpdate('Columnas pendientes: ' . implode(', ', $missing));
    echo "[OK] Columnas de identidad verificadas.\n";
} catch (Throwable $error) {
    stopUpdate('Fallo la migracion: ' . $error->getMessage());
}

$uploadDir = $appDir . '/uploads/avatars';
if (!is_dir($uploadDir) && !mkdir($uploadDir, 0775, true)) {
    stopUpdate('No se pudo crear uploads/avatars.');
}
if (!is_writable($uploadDir)) {
    stopUpdate('uploads/avatars no tiene permisos de escritura.');
}

echo "[OK] Carpeta de avatares disponible.\n";

$accessFile = $uploadDir . '/.htaccess';
$accessRules = "Options -Indexes\n<FilesMatch \"\\.(php|phtml|phar|cgi|pl|py|sh)$\">\n    Require all denied\n</FilesMatch>\n";
if (!is_file($accessFile) && file_put_contents($accessFile, $accessRules) === false) {
    stopUpdate('No se pudo proteger la carpeta de avatares.');
}

echo "[OK] Proteccion de uploads verificada.\n";
if (!extension_loaded('fileinfo')) {
    echo "[WARN] Habilita fileinfo para permitir la carga segura de imagenes.\n";
}

echo "\nActualizacion completada correctamente.\n";
exit(0);