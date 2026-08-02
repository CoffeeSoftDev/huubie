<?php
declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Este sincronizador solo puede ejecutarse desde la terminal.\n");
}

$appDir = dirname(__DIR__);
$origen = 'c:/wamp64/www/app';
$dryRun = false;

foreach (array_slice($argv, 1) as $arg) {
    if ($arg === '--dry-run' || $arg === '-n') $dryRun = true;
    elseif (strpos($arg, '--origen=') === 0) $origen = str_replace('\\', '/', substr($arg, 9));
    else exit("Uso: sync-desde-servidor.php [--dry-run] [--origen=RUTA]\n");
}
$origen = rtrim($origen, '/');

// Bases que se traen del servidor. Antes de copiar cada una se compara su
// esquema con la local: si al servidor le falta una columna que el codigo nuevo
// de aqui ya usa, la copia rompe la app y por eso se aborta.
$bases = [
    'data/auth.sqlite',
    'visor/data/chats.sqlite',
    'visor/data/pg-threads.sqlite',
    'visor/data/prefs.sqlite',
    'visor/data/studio-threads.sqlite',
    'visor/data/tools.sqlite',
    'visor/data/todo-shares.sqlite',
];

// Secretos que no son texto. El .env NO entra aqui: el local tiene su propia
// API key, su MySQL y su OPENROUTER_APP_*, y el del servidor los pisaria.
$secretos = ['cacert.pem', 'coffeedrive.json', 'ollama-cloud.json'];

// Carpetas que se reemplazan completas. users/ va junto con auth.sqlite: los
// documentos viven en users/<id>/ y si el id no coincide se pierde el mapeo.
$carpetas = ['visor/documents/users', 'visor/documents/shared', 'visor/documents/template'];

$errores = 0;
$copiados = 0;

function aviso(string $tipo, string $msg): void
{
    echo "[$tipo] $msg\n";
}

function fallar(string $msg): void
{
    fwrite(STDERR, "[ERROR] $msg\n");
    exit(1);
}

function esquema(string $file): ?array
{
    if (!is_file($file)) return null;
    try {
        $pdo = new PDO('sqlite:' . $file);
        $out = [];
        $tablas = $pdo->query("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")
            ->fetchAll(PDO::FETCH_COLUMN);
        foreach ($tablas as $t) {
            $cols = $pdo->query("PRAGMA table_info(\"$t\")")->fetchAll(PDO::FETCH_ASSOC);
            $out[$t] = array_column($cols, 'name');
        }
        return $out;
    } catch (Throwable $e) {
        return null;
    }
}

// Devuelve la lista de tablas/columnas que el destino tiene y el origen no.
function incompatibilidades(array $orig, array $dest): array
{
    $faltan = [];
    foreach ($dest as $tabla => $cols) {
        if (!isset($orig[$tabla])) { $faltan[] = "tabla '$tabla'"; continue; }
        $dif = array_diff($cols, $orig[$tabla]);
        if ($dif) $faltan[] = "'$tabla'.(" . implode(', ', $dif) . ")";
    }
    return $faltan;
}

function copiarDir(string $desde, string $hacia): int
{
    $n = 0;
    $it = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($desde, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::SELF_FIRST
    );
    foreach ($it as $item) {
        $destino = $hacia . '/' . $it->getSubPathName();
        if ($item->isDir()) {
            if (!is_dir($destino)) @mkdir($destino, 0775, true);
        } elseif (copy($item->getPathname(), $destino)) {
            $n++;
        }
    }
    return $n;
}

// El servidor guarda los saltos de linea con LF y Windows con CRLF. Copiar un
// archivo que solo cambia en eso lo deja igual pero git lo marca como
// modificado, asi que el diff se llena de cambios que no lo son.
function mismoContenido(string $a, string $b): bool
{
    if (!is_file($a) || !is_file($b)) return false;
    if (filesize($a) === filesize($b) && md5_file($a) === md5_file($b)) return true;

    $ext = strtolower(pathinfo($a, PATHINFO_EXTENSION));
    if (!in_array($ext, ['md', 'json', 'html', 'txt', 'sql', 'css', 'js', 'php', 'excalidraw'])) return false;

    return str_replace("\r", '', (string) file_get_contents($a))
        === str_replace("\r", '', (string) file_get_contents($b));
}

// Deja la carpeta destino igual a la de origen tocando lo menos posible: copia
// solo lo que cambio de verdad y borra lo que ya no existe en el servidor.
function sincronizarDir(string $desde, string $hacia): array
{
    $copiados = 0;
    $intactos = 0;
    $vistos   = [];

    if (!is_dir($hacia)) @mkdir($hacia, 0775, true);

    $it = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($desde, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::SELF_FIRST
    );
    foreach ($it as $item) {
        $rel     = $it->getSubPathName();
        $destino = "$hacia/$rel";
        $vistos[str_replace('\\', '/', $rel)] = true;

        if ($item->isDir()) {
            if (!is_dir($destino)) @mkdir($destino, 0775, true);
            continue;
        }
        if (mismoContenido($item->getPathname(), $destino)) { $intactos++; continue; }

        $dir = dirname($destino);
        if (!is_dir($dir)) @mkdir($dir, 0775, true);
        if (copy($item->getPathname(), $destino)) $copiados++;
    }

    $borrados = 0;
    if (is_dir($hacia)) {
        $it2 = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($hacia, FilesystemIterator::SKIP_DOTS),
            RecursiveIteratorIterator::CHILD_FIRST
        );
        foreach ($it2 as $item) {
            $rel = str_replace('\\', '/', $it2->getSubPathName());
            if (isset($vistos[$rel])) continue;
            if ($item->isDir()) @rmdir($item->getPathname());
            elseif (@unlink($item->getPathname())) $borrados++;
        }
    }

    return [$copiados, $intactos, $borrados];
}

function borrarDir(string $dir): void
{
    if (!is_dir($dir)) return;
    $it = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS),
        RecursiveIteratorIterator::CHILD_FIRST
    );
    foreach ($it as $item) {
        $item->isDir() ? @rmdir($item->getPathname()) : @unlink($item->getPathname());
    }
    @rmdir($dir);
}

echo "CoffeeSoft - Sincronizar datos del servidor hacia local\n";
echo "======================================================\n";
echo "Origen : $origen\n";
echo "Destino: $appDir\n";
if ($dryRun) echo "Modo   : SIMULACION, no se escribe nada\n";
echo "\n";

if (!extension_loaded('pdo_sqlite')) fallar('La extension pdo_sqlite no esta habilitada.');
if (!is_dir($origen))               fallar("No existe la carpeta de origen: $origen");
if (!is_dir("$origen/visor/data"))  fallar("El origen no parece una copia de coffee/app: falta visor/data.");

// Revision de esquemas antes de tocar nada: si una sola base es incompatible se
// aborta completo, para no dejar el entorno a medias.
echo "-- Revision de esquemas\n";
$aptas = [];
foreach ($bases as $rel) {
    $src = "$origen/$rel";
    $dst = "$appDir/$rel";
    if (!is_file($src)) { aviso('INFO', "$rel no esta en el origen, se omite."); continue; }

    $eo = esquema($src);
    if ($eo === null) { aviso('WARN', "$rel del origen no se pudo leer, se omite."); $errores++; continue; }

    $ed = esquema($dst);
    if ($ed === null) { aviso('OK', "$rel es nueva aqui, se copia sin riesgo."); $aptas[] = $rel; continue; }

    $malas = incompatibilidades($eo, $ed);
    if ($malas) {
        aviso('WARN', "$rel: al origen le falta " . implode(', ', $malas));
        $errores++;
        continue;
    }
    aviso('OK', "$rel compatible.");
    $aptas[] = $rel;
}

if ($errores) {
    echo "\n";
    fallar("$errores base(s) incompatibles. Actualiza primero el codigo del servidor o excluyelas a mano.");
}

// Respaldo. Va dentro de coffee/app para que el .gitignore del proyecto lo tape.
$stamp  = date('Ymd-His');
$backup = "$appDir/_sync_backup_$stamp";
echo "\n-- Respaldo\n";
if ($dryRun) {
    aviso('INFO', "Se crearia $backup");
} else {
    if (!mkdir($backup, 0775, true)) fallar("No se pudo crear $backup");
    foreach ($aptas as $rel) {
        if (!is_file("$appDir/$rel")) continue;
        $d = $backup . '/' . dirname($rel);
        if (!is_dir($d)) @mkdir($d, 0775, true);
        copy("$appDir/$rel", "$backup/$rel");
    }
    foreach ($carpetas as $rel) {
        if (!is_dir("$appDir/$rel")) continue;
        @mkdir("$backup/$rel", 0775, true);
        copiarDir("$appDir/$rel", "$backup/$rel");
    }
    @mkdir("$backup/credentials", 0775, true);
    foreach ($secretos as $s) {
        if (is_file("$appDir/credentials/$s")) copy("$appDir/credentials/$s", "$backup/credentials/$s");
    }
    aviso('OK', "Respaldo en _sync_backup_$stamp");
}

echo "\n-- Bases de datos\n";
foreach ($aptas as $rel) {
    if ($dryRun) { aviso('INFO', "copiaria $rel"); continue; }
    $d = dirname("$appDir/$rel");
    if (!is_dir($d)) @mkdir($d, 0775, true);
    if (copy("$origen/$rel", "$appDir/$rel")) { aviso('OK', $rel); $copiados++; }
    else { aviso('WARN', "no se pudo copiar $rel"); $errores++; }
}
// Los respaldos que el propio visor genera se versionan, asi que tambien viajan.
foreach (glob("$origen/visor/data/*.sqlite.backup-*") ?: [] as $b) {
    $rel = 'visor/data/' . basename($b);
    if ($dryRun) { aviso('INFO', "copiaria $rel"); continue; }
    if (copy($b, "$appDir/$rel")) $copiados++;
}
foreach (['visor/data/icons.json'] as $rel) {
    if (!is_file("$origen/$rel")) continue;
    if ($dryRun) { aviso('INFO', "copiaria $rel"); continue; }
    if (copy("$origen/$rel", "$appDir/$rel")) { aviso('OK', $rel); $copiados++; }
}

echo "\n-- Documentos\n";
foreach ($carpetas as $rel) {
    if (!is_dir("$origen/$rel")) { aviso('INFO', "$rel no esta en el origen, se omite."); continue; }
    if ($dryRun) { aviso('INFO', "sincronizaria $rel"); continue; }
    [$n, $iguales, $fuera] = sincronizarDir("$origen/$rel", "$appDir/$rel");
    $detalle = "$n copiados, $iguales sin cambios" . ($fuera ? ", $fuera borrados" : '');
    aviso('OK', "$rel ($detalle)");
    $copiados += $n;
}

echo "\n-- Credenciales\n";
foreach ($secretos as $s) {
    if (!is_file("$origen/credentials/$s")) { aviso('WARN', "$s no esta en el origen."); continue; }
    if ($dryRun) { aviso('INFO', "copiaria credentials/$s"); continue; }
    if (copy("$origen/credentials/$s", "$appDir/credentials/$s")) { aviso('OK', "credentials/$s"); $copiados++; }
    else { aviso('WARN', "no se pudo copiar $s"); $errores++; }
}

// El .env no se copia, solo se avisa: pisarlo borraria la configuracion local.
$envOrigen  = "$origen/credentials/.env";
$envDestino = "$appDir/credentials/.env";
if (is_file($envOrigen) && is_file($envDestino)) {
    $a = @parse_ini_file($envOrigen, false, INI_SCANNER_TYPED) ?: [];
    $b = @parse_ini_file($envDestino, false, INI_SCANNER_TYPED) ?: [];
    $nuevas = array_diff(array_keys($a), array_keys($b));
    if ($nuevas) {
        aviso('WARN', 'El .env del servidor trae claves que aqui no estan: ' . implode(', ', $nuevas));
        aviso('INFO', 'Agregalas a mano; el .env no se sobrescribe para no perder tu API key ni tu MySQL.');
    } else {
        aviso('OK', '.env sin claves nuevas.');
    }
}

echo "\n";
if ($dryRun) {
    echo "Simulacion terminada. Sin --dry-run se aplicarian los cambios.\n";
    exit(0);
}

echo "Sincronizacion completada: $copiados archivo(s).\n";
if ($errores) echo "Con $errores aviso(s). Revisa la salida.\n";
echo "Respaldo previo: _sync_backup_$stamp\n";
echo "\nOJO: entras con las contrasenas del servidor, no con las de antes.\n";
exit($errores ? 1 : 0);
