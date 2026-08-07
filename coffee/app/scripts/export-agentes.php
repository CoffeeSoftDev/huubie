<?php
declare(strict_types=1);

/**
 * Exporta la configuracion de AGENTES de este equipo a un ZIP portatil.
 *
 * El repositorio lleva el codigo; este pack lleva lo que vive FUERA del repo y por
 * eso no se clona: los .md de ~/.claude que leen Claude Code y el Visor, el registro
 * de agentes del Visor (agents.sqlite), el catalogo de tools y el cajon de TODOs.
 *
 * Lo que NUNCA entra al pack: credenciales (.env, cacert.pem, coffeedrive.json, la
 * sesion OAuth de Claude Code), las conversaciones (chats/pg-threads/studio-threads)
 * y las preferencias por usuario. El detalle y el porque estan en pack/INSTALAR.md.
 *
 * Uso:
 *   php export-agentes.php [--salida=RUTA] [--sin-todos] [--con-chats-no]
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Este exportador solo puede ejecutarse desde la terminal.\n");
}

if (!class_exists('ZipArchive')) fallar('La extension zip de PHP no esta activa.');

$appDir   = str_replace('\\', '/', dirname(__DIR__));   // coffee/app
$packSrc  = __DIR__ . '/pack';
$salida   = $appDir . '/dist/agentes-pack.zip';
$conTodos = true;

foreach (array_slice($argv, 1) as $arg) {
    if (strpos($arg, '--salida=') === 0) $salida = str_replace('\\', '/', substr($arg, 9));
    elseif ($arg === '--sin-todos')      $conTodos = false;
    else exit("Uso: export-agentes.php [--salida=RUTA] [--sin-todos]\n");
}

require_once $appDir . '/visor/ctrl/path-helper.php';

$home       = rtrim(str_replace('\\', '/', coffee_user_home()), '/');
$claudeHome = $home . '/.claude';
$dataDir    = $appDir . '/visor/data';
$docsDir    = $appDir . '/visor/documents';
$tmpDir     = sys_get_temp_dir() . '/agentes-pack-' . getmypid();

$inventario = [];
$avisos     = [];

function aviso(string $tipo, string $msg): void
{
    echo "[$tipo] $msg\n";
}

function fallar(string $msg): void
{
    fwrite(STDERR, "[ERROR] $msg\n");
    exit(1);
}

function borrarArbol(string $dir): void
{
    if (!is_dir($dir)) return;
    foreach (scandir($dir) ?: [] as $item) {
        if ($item === '.' || $item === '..') continue;
        $full = $dir . '/' . $item;
        is_dir($full) ? borrarArbol($full) : @unlink($full);
    }
    @rmdir($dir);
}

/**
 * Copia un arbol al staging. $excluir son patrones fnmatch sobre el NOMBRE del
 * archivo: asi se dejan fuera los .backup-*.md y los .rar/.zip que el usuario
 * guarda al lado de sus reglas y no aportan nada al equipo nuevo.
 */
function copiarArbol(string $origen, string $destino, array $excluir, int &$n): void
{
    if (!is_dir($origen)) return;
    if (!is_dir($destino)) @mkdir($destino, 0775, true);

    foreach (scandir($origen) ?: [] as $item) {
        if ($item === '.' || $item === '..') continue;
        $src = $origen . '/' . $item;
        $dst = $destino . '/' . $item;

        if (is_dir($src)) { copiarArbol($src, $dst, $excluir, $n); continue; }

        foreach ($excluir as $patron) {
            if (fnmatch($patron, $item)) continue 2;
        }
        if (@copy($src, $dst)) $n++;
    }
}

/** Copia una base sqlite consolidando el WAL, para no llevarse una foto a medias. */
function copiarSqlite(string $origen, string $destino): bool
{
    if (!is_file($origen)) return false;
    try {
        $pdo = new PDO('sqlite:' . $origen);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $pdo->exec('PRAGMA wal_checkpoint(TRUNCATE)');
        $pdo = null;
    } catch (Throwable $e) {
        // Una base sin WAL o abierta por otro proceso se copia igual.
    }
    return @copy($origen, $destino);
}

function tamanoLegible(int $bytes): string
{
    if ($bytes >= 1048576) return round($bytes / 1048576, 1) . ' MB';
    if ($bytes >= 1024)    return round($bytes / 1024) . ' KB';
    return $bytes . ' B';
}

// ── Staging ─────────────────────────────────────────────────────────────────

borrarArbol($tmpDir);
if (!@mkdir($tmpDir, 0775, true)) fallar("No se pudo crear el staging en $tmpDir");

echo "\nExportando configuracion de agentes\n";
echo "Origen: $claudeHome\n";
echo str_repeat('-', 68) . "\n";

// 1. Definiciones que lee Claude Code y de las que se sembro el Visor.
$excluirMd = ['*.backup-*.md', '*.rar', '*.zip', '*.tmp'];

foreach (['agents', 'steering', 'commands'] as $carpeta) {
    $src = $claudeHome . '/' . $carpeta;
    if (!is_dir($src)) { $avisos[] = "~/.claude/$carpeta no existe en este equipo"; continue; }
    $n = 0;
    copiarArbol($src, $tmpDir . '/claude/' . $carpeta, $excluirMd, $n);
    $inventario['claude/' . $carpeta] = $n;
    aviso('OK', sprintf('%-10s %d archivos', $carpeta, $n));
}

// settings.json viaja como REFERENCIA, nunca para pisar el del equipo destino:
// ahi viven sus permisos, sus hooks y sus preferencias. Se audita antes de copiar
// por si alguna vez alguien mete una API key en el archivo equivocado.
if (is_file($claudeHome . '/settings.json')) {
    $crudo = (string) file_get_contents($claudeHome . '/settings.json');
    if (preg_match('/"(api[_-]?key|secret|password|accessToken|refreshToken)"\s*:\s*"[^"]{8,}"/i', $crudo)) {
        $avisos[] = 'settings.json contiene algo que parece un secreto: NO se incluyo en el pack';
        aviso('SALTA', 'settings.json (posible secreto dentro)');
    } else {
        @mkdir($tmpDir . '/claude', 0775, true);
        @copy($claudeHome . '/settings.json', $tmpDir . '/claude/settings.reference.json');
        $inventario['claude/settings.reference.json'] = 1;
        aviso('OK', 'settings.reference.json (referencia, no se instala encima)');
    }
}

// 2. Registro del Visor. agents.sqlite va completo (prompts, reglas, memoria).
@mkdir($tmpDir . '/visor/data', 0775, true);

foreach (['agents.sqlite', 'tools.sqlite'] as $base) {
    if (!copiarSqlite($dataDir . '/' . $base, $tmpDir . '/visor/data/' . $base)) {
        $avisos[] = "$base no se pudo copiar";
        aviso('SALTA', $base);
        continue;
    }
    $inventario['visor/data/' . $base] = 1;
    aviso('OK', $base);
}

// La telemetria de llamadas no aporta al equipo nuevo y arrastra rutas y consultas
// de este. Se purga sobre la COPIA, nunca sobre la base viva.
$toolsCopia = $tmpDir . '/visor/data/tools.sqlite';
if (is_file($toolsCopia)) {
    try {
        $pdo = new PDO('sqlite:' . $toolsCopia);
        $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $borradas = $pdo->exec('DELETE FROM tool_calls');
        $pdo->exec('VACUUM');
        $pdo = null;
        aviso('OK', "tool_calls purgado ($borradas registros de telemetria)");
    } catch (Throwable $e) {
        $avisos[] = 'no se pudo purgar tool_calls: ' . $e->getMessage();
    }
}

// 3. Cajon de TODOs: las listas son todo*.json dentro de la biblioteca de cada
// usuario y de la carpeta compartida. Viajan con su ruta relativa intacta porque
// esa ruta es la identidad de la lista (todos_entry la usa como `key`).
if ($conTodos) {
    $listas = 0;

    $recolectar = function (string $raiz, string $prefijoRel) use ($tmpDir, &$listas) {
        if (!is_dir($raiz)) return;
        $it = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($raiz, FilesystemIterator::SKIP_DOTS),
            RecursiveIteratorIterator::SELF_FIRST
        );
        foreach ($it as $file) {
            if (!$file->isFile()) continue;
            if (!preg_match('/^todo[^\/\\\\]*\.json$/i', $file->getFilename())) continue;

            $rel = ltrim(str_replace('\\', '/', substr($file->getPathname(), strlen($raiz))), '/');
            $dst = $tmpDir . '/visor/documents/' . $prefijoRel . '/' . $rel;
            @mkdir(dirname($dst), 0775, true);
            if (@copy($file->getPathname(), $dst)) $listas++;
        }
    };

    $recolectar($docsDir . '/users',  'users');
    $recolectar($docsDir . '/shared', 'shared');

    $inventario['visor/documents (listas todo*.json)'] = $listas;
    aviso('OK', "$listas listas de TODO");

    // Quien comparte que lista con quien. Se instala aparte porque referencia ids
    // de usuario de ESTE equipo: si las cuentas del destino son otras, sobra.
    if (copiarSqlite($dataDir . '/todo-shares.sqlite', $tmpDir . '/visor/data/todo-shares.sqlite')) {
        $inventario['visor/data/todo-shares.sqlite'] = 1;
        aviso('OK', 'todo-shares.sqlite (comparticiones; ojo con los ids de usuario)');
    }
    // todo-link.sqlite NO se exporta: son codigos de vinculacion de un solo uso.
}

// 4. Plantilla de credenciales. El .env real jamas entra al pack.
if (is_file($appDir . '/credentials/.env.example')) {
    @mkdir($tmpDir . '/visor/credentials', 0775, true);
    @copy($appDir . '/credentials/.env.example', $tmpDir . '/visor/credentials/.env.example');
    $inventario['visor/credentials/.env.example'] = 1;
    aviso('OK', '.env.example (sin claves)');
}

// 5. Instalador y documentacion del pack.
$n = 0;
copiarArbol($packSrc, $tmpDir, [], $n);
aviso('OK', "instalador y docs ($n archivos)");

// 6. Manifiesto: lo que el instalador necesita saber del equipo origen, sobre todo
// el home, para reapuntar las rutas absolutas que guarda agents.sqlite.
$agentesEnBase = [];
if (is_file($tmpDir . '/visor/data/agents.sqlite')) {
    try {
        $pdo = new PDO('sqlite:' . $tmpDir . '/visor/data/agents.sqlite');
        foreach ($pdo->query('SELECT agent_key, name FROM agents ORDER BY agent_key') as $r) {
            $agentesEnBase[] = ['key' => $r['agent_key'], 'name' => $r['name']];
        }
        $pdo = null;   // sin cerrar, el -wal/-shm que abre PDO seguiria vivo al zipear
    } catch (Throwable $e) {
        $avisos[] = 'no se pudo leer el listado de agentes: ' . $e->getMessage();
    }
}

$manifiesto = [
    'pack'    => 'agentes-coffeesoft',
    'version' => '1.0.0',
    'fecha'   => date('c'),
    'origen'  => [
        'equipo' => php_uname('n'),
        'home'   => $home,
        'repo'   => 'huubie',
    ],
    'contenido'  => $inventario,
    'agentes'    => $agentesEnBase,
    'no_incluye' => [
        'credentials/.env y demas secretos',
        '~/.claude/.credentials.json (sesion OAuth)',
        'chats.sqlite, pg-threads.sqlite, studio-threads.sqlite',
        'prefs.sqlite',
        'todo-link.sqlite (codigos de un solo uso)',
        'tool_calls (telemetria, purgada)',
    ],
    'avisos' => $avisos,
];
file_put_contents($tmpDir . '/manifest.json', json_encode($manifiesto, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));

// ── ZIP ─────────────────────────────────────────────────────────────────────

$dirSalida = dirname($salida);
if (!is_dir($dirSalida) && !@mkdir($dirSalida, 0775, true)) fallar("No se pudo crear $dirSalida");
if (is_file($salida)) @unlink($salida);

$zip = new ZipArchive();
if ($zip->open($salida, ZipArchive::CREATE | ZipArchive::OVERWRITE) !== true) fallar("No se pudo crear $salida");

$total = 0;
$it = new RecursiveIteratorIterator(
    new RecursiveDirectoryIterator($tmpDir, FilesystemIterator::SKIP_DOTS),
    RecursiveIteratorIterator::SELF_FIRST
);
foreach ($it as $file) {
    $rel = ltrim(str_replace('\\', '/', substr($file->getPathname(), strlen($tmpDir))), '/');
    if ($file->isDir()) { $zip->addEmptyDir($rel); continue; }

    // Los diarios de SQLite no viajan: un -wal huerfano junto a una base copiada
    // es basura en el mejor caso y una lectura inconsistente en el peor.
    if (preg_match('/\.sqlite(-wal|-shm|-journal)$/i', $file->getFilename())) continue;

    $zip->addFile($file->getPathname(), $rel);
    $total++;
}
$zip->close();
borrarArbol($tmpDir);

echo str_repeat('-', 68) . "\n";
printf("ZIP: %s (%s, %d archivos)\n", $salida, tamanoLegible((int) filesize($salida)), $total);

if ($avisos) {
    echo "\nAvisos:\n";
    foreach ($avisos as $a) echo "  - $a\n";
}

echo "\nEn el equipo nuevo: descomprimir dentro del repo y ejecutar\n";
echo "  php instalar.php --dry-run\n";
exit(0);
