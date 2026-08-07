<?php
declare(strict_types=1);

/**
 * Instalador del pack de agentes CoffeeSoft.
 *
 * Se ejecuta desde la RAIZ del pack descomprimido y deja el equipo destino con la
 * misma configuracion de agentes que el equipo origen:
 *
 *   claude/            -> ~/.claude/{agents,steering,commands}   (lo que lee Claude Code)
 *   visor/data/        -> coffee/app/visor/data/*.sqlite         (registro y tools)
 *   visor/documents/   -> coffee/app/visor/documents/            (cajon de TODOs)
 *
 * Nada se pisa a ciegas: todo destino que ya existe se respalda con marca de tiempo
 * antes de reemplazarlo, y sin --force los .sqlite existentes ni se tocan (contienen
 * los prompts editados y la memoria del equipo destino, que no viajan en el pack).
 *
 * Uso:
 *   php instalar.php [--dry-run] [--force] [--solo=claude|visor|todos]
 *                    [--home=RUTA] [--repo=RUTA]
 */

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Este instalador solo puede ejecutarse desde la terminal.\n");
}

$packDir = str_replace('\\', '/', __DIR__);
$dryRun  = false;
$force   = false;
$solo    = '';
$homeArg = '';
$repoArg = '';

foreach (array_slice($argv, 1) as $arg) {
    if ($arg === '--dry-run' || $arg === '-n')      $dryRun = true;
    elseif ($arg === '--force' || $arg === '-f')    $force = true;
    elseif (strpos($arg, '--solo=') === 0)          $solo = substr($arg, 7);
    elseif (strpos($arg, '--home=') === 0)          $homeArg = str_replace('\\', '/', substr($arg, 7));
    elseif (strpos($arg, '--repo=') === 0)          $repoArg = str_replace('\\', '/', substr($arg, 7));
    else exit("Uso: instalar.php [--dry-run] [--force] [--solo=claude|visor|todos] [--home=RUTA] [--repo=RUTA]\n");
}

if ($solo !== '' && !in_array($solo, ['claude', 'visor', 'todos'], true)) {
    exit("--solo admite unicamente 'claude', 'visor' o 'todos'.\n");
}

$errores  = 0;
$copiados = 0;
$saltados = 0;

function aviso(string $tipo, string $msg): void
{
    echo "[$tipo] $msg\n";
}

function fallar(string $msg): void
{
    fwrite(STDERR, "[ERROR] $msg\n");
    exit(1);
}

function sello(): string
{
    return date('Ymd-His');
}

/**
 * Home del usuario donde vive .claude. Misma cascada que usa el Visor en
 * ctrl/path-helper.php, para que instalador y runtime nunca discrepen.
 */
function homeUsuario(string $override): string
{
    $norm = function ($p) { return rtrim(str_replace('\\', '/', (string) $p), '/'); };

    if ($override !== '') {
        $o = $norm($override);
        if (basename($o) === '.claude') return dirname($o);
        return $o;
    }

    $env = getenv('COFFEE_CLAUDE_HOME');
    if ($env) {
        $o = $norm($env);
        return basename($o) === '.claude' ? dirname($o) : $o;
    }

    $home = $norm(getenv('USERPROFILE') ?: getenv('HOME') ?: '');
    if ($home !== '') return $home;

    fallar('No se pudo determinar el home del usuario. Pasa --home=RUTA.');
}

/**
 * Raiz del repo destino: la carpeta que contiene coffee/app/visor/data. Se busca
 * subiendo desde donde esta el pack, porque lo normal es descomprimirlo dentro
 * del propio repo clonado.
 */
function raizRepo(string $override, string $packDir): string
{
    if ($override !== '') return rtrim($override, '/');

    $dir = $packDir;
    for ($i = 0; $i < 8; $i++) {
        if (is_dir($dir . '/coffee/app/visor')) return $dir;
        $padre = dirname($dir);
        if ($padre === $dir) break;
        $dir = $padre;
    }
    return '';
}

function copiarArbol(string $origen, string $destino, bool $dryRun, int &$copiados): void
{
    if (!is_dir($origen)) return;
    if (!$dryRun && !is_dir($destino)) @mkdir($destino, 0775, true);

    foreach (scandir($origen) ?: [] as $item) {
        if ($item === '.' || $item === '..') continue;
        $src = $origen . '/' . $item;
        $dst = $destino . '/' . $item;
        if (is_dir($src)) {
            copiarArbol($src, $dst, $dryRun, $copiados);
        } else {
            if (!$dryRun && !@copy($src, $dst)) {
                aviso('ERROR', "no se pudo copiar $item");
                continue;
            }
            $copiados++;
        }
    }
}

/** Mueve a un lado lo que ya existe, con marca de tiempo. Devuelve la ruta del respaldo. */
function respaldar(string $ruta, bool $dryRun): string
{
    if (!file_exists($ruta)) return '';
    $backup = $ruta . '.backup-' . sello();
    if ($dryRun) return $backup;
    if (!@rename($ruta, $backup)) {
        aviso('ERROR', "no se pudo respaldar " . basename($ruta));
        return '';
    }
    return $backup;
}

/**
 * Las columnas source_file de agents.sqlite guardan la ruta ABSOLUTA del .md en el
 * equipo origen. Sin reescribirlas, la ficha del agente en el destino cree que su
 * archivo desaparecio y ofrece recargar desde una ruta que no existe.
 */
function reapuntarRutas(string $sqlite, string $homeViejo, string $homeNuevo): int
{
    $viejo = rtrim(str_replace('\\', '/', $homeViejo), '/') . '/.claude';
    $nuevo = rtrim(str_replace('\\', '/', $homeNuevo), '/') . '/.claude';
    if ($viejo === $nuevo) return 0;

    $pdo = new PDO('sqlite:' . $sqlite);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

    $tocadas = 0;
    foreach (['agents', 'agent_knowledge'] as $tabla) {
        $st = $pdo->prepare("UPDATE $tabla SET source_file = REPLACE(source_file, :viejo, :nuevo) WHERE source_file LIKE :like");
        $st->execute([':viejo' => $viejo, ':nuevo' => $nuevo, ':like' => $viejo . '%']);
        $tocadas += $st->rowCount();
    }
    return $tocadas;
}

// ── Lectura del manifiesto ──────────────────────────────────────────────────

$manifiestoPath = $packDir . '/manifest.json';
if (!is_file($manifiestoPath)) fallar("Falta manifest.json. Ejecuta el instalador desde la raiz del pack descomprimido.");

$manifiesto = json_decode((string) file_get_contents($manifiestoPath), true);
if (!is_array($manifiesto)) fallar('manifest.json ilegible.');

$homeOrigen = (string) ($manifiesto['origen']['home'] ?? '');

echo "\n";
echo "Pack de agentes CoffeeSoft " . ($manifiesto['version'] ?? '?') . "\n";
echo "Exportado: " . ($manifiesto['fecha'] ?? '?') . " desde " . ($manifiesto['origen']['equipo'] ?? '?') . "\n";
if ($dryRun) echo "MODO SIMULACION: no se escribe nada.\n";
echo str_repeat('-', 68) . "\n";

// ── 1. Configuracion de Claude Code (~/.claude) ─────────────────────────────

if ($solo === '' || $solo === 'claude') {
    $home       = homeUsuario($homeArg);
    $claudeDest = $home . '/.claude';

    aviso('INFO', "Claude Code -> $claudeDest");
    if (!$dryRun && !is_dir($claudeDest)) @mkdir($claudeDest, 0775, true);

    foreach (['agents', 'steering', 'commands'] as $carpeta) {
        $src = $packDir . '/claude/' . $carpeta;
        if (!is_dir($src)) { aviso('SALTA', "$carpeta no viene en el pack"); $saltados++; continue; }

        $dst = $claudeDest . '/' . $carpeta;
        if (is_dir($dst)) {
            $bk = respaldar($dst, $dryRun);
            if ($bk !== '') aviso('BACKUP', basename($bk));
        }
        $antes = $copiados;
        copiarArbol($src, $dst, $dryRun, $copiados);
        aviso('OK', sprintf('%-9s %d archivos', $carpeta, $copiados - $antes));
    }

    // settings.json NO se pisa: trae permisos, hooks y preferencias propias del
    // equipo destino. Se deja al lado para comparar a mano.
    $settingsSrc = $packDir . '/claude/settings.reference.json';
    if (is_file($settingsSrc)) {
        $settingsDst = $claudeDest . '/settings.reference.json';
        if (!$dryRun) @copy($settingsSrc, $settingsDst);
        $copiados++;
        aviso('INFO', 'settings.reference.json copiado como referencia (settings.json NO se toco)');
    }
}

// ── 2. Registro de agentes y cajon de TODOs (dentro del repo) ───────────────

$repo = '';
if ($solo === '' || $solo === 'visor' || $solo === 'todos') {
    $repo = raizRepo($repoArg, $packDir);
    if ($repo === '') {
        aviso('SALTA', 'No se encontro un repo con coffee/app/visor cerca del pack. Usa --repo=RUTA para instalar las bases del Visor y los TODOs.');
        $saltados++;
    }
}

if ($repo !== '' && ($solo === '' || $solo === 'visor')) {
    $dataDir = $repo . '/coffee/app/visor/data';
    aviso('INFO', "Visor -> $dataDir");
    if (!$dryRun && !is_dir($dataDir)) @mkdir($dataDir, 0775, true);

    // todo-shares referencia ids de usuario del equipo origen: solo tiene sentido
    // si el destino comparte esas cuentas, y por eso no se instala sin --force.
    $bases = ['agents.sqlite', 'tools.sqlite', 'todo-shares.sqlite'];

    foreach ($bases as $base) {
        $src = $packDir . '/visor/data/' . $base;
        if (!is_file($src)) { aviso('SALTA', "$base no viene en el pack"); $saltados++; continue; }

        $dst = $dataDir . '/' . $base;
        if ($base === 'todo-shares.sqlite' && !$force) {
            aviso('SALTA', 'todo-shares.sqlite (referencia ids de usuario del equipo origen; instalalo con --force solo si las cuentas son las mismas)');
            $saltados++;
            continue;
        }
        if (is_file($dst) && !$force) {
            aviso('SALTA', "$base ya existe en el destino (usa --force para reemplazarlo; se respalda antes)");
            $saltados++;
            continue;
        }
        if (is_file($dst)) {
            $bk = respaldar($dst, $dryRun);
            if ($bk !== '') aviso('BACKUP', basename($bk));
        }
        if (!$dryRun && !@copy($src, $dst)) { aviso('ERROR', "no se pudo copiar $base"); $errores++; continue; }
        $copiados++;
        aviso('OK', $base);

        if ($base === 'agents.sqlite' && !$dryRun && $homeOrigen !== '') {
            try {
                $n = reapuntarRutas($dst, $homeOrigen, homeUsuario($homeArg));
                if ($n > 0) aviso('OK', "$n rutas source_file reapuntadas al home local");
            } catch (Throwable $e) {
                aviso('ERROR', 'no se pudieron reapuntar las rutas: ' . $e->getMessage());
                $errores++;
            }
        }
    }

    // El .env con las API keys nunca viaja en el pack: solo la plantilla.
    $envDestino = $repo . '/coffee/app/credentials/.env';
    if (is_file($packDir . '/visor/credentials/.env.example') && !is_file($envDestino)) {
        aviso('FALTA', 'coffee/app/credentials/.env no existe en el destino. Copia .env.example y pon tus propias API keys (Ollama / OpenRouter).');
    }
}

// ── 3. Listas del cajon de TODOs ────────────────────────────────────────────
// Cada lista es un todo*.json cuya RUTA RELATIVA es su identidad (el cajon la usa
// como `key`), asi que se restituye tal cual bajo visor/documents/.

if ($repo !== '' && ($solo === '' || $solo === 'todos')) {
    $origenTodos  = $packDir . '/visor/documents';
    $destinoTodos = $repo . '/coffee/app/visor/documents';

    if (!is_dir($origenTodos)) {
        aviso('SALTA', 'el pack no trae listas de TODO');
        $saltados++;
    } else {
        aviso('INFO', "TODOs -> $destinoTodos");
        $puestas = 0;
        $chocan  = 0;

        $it = new RecursiveIteratorIterator(
            new RecursiveDirectoryIterator($origenTodos, FilesystemIterator::SKIP_DOTS),
            RecursiveIteratorIterator::SELF_FIRST
        );
        foreach ($it as $file) {
            if (!$file->isFile()) continue;
            $rel = ltrim(str_replace('\\', '/', substr($file->getPathname(), strlen($origenTodos))), '/');
            $dst = $destinoTodos . '/' . $rel;

            if (is_file($dst) && !$force) { $chocan++; continue; }
            if (is_file($dst)) respaldar($dst, $dryRun);
            if (!$dryRun) {
                @mkdir(dirname($dst), 0775, true);
                if (!@copy($file->getPathname(), $dst)) { aviso('ERROR', "no se pudo copiar $rel"); $errores++; continue; }
            }
            $puestas++;
            $copiados++;
        }

        aviso('OK', "$puestas listas instaladas");
        if ($chocan > 0) {
            aviso('SALTA', "$chocan listas ya existian en el destino (usa --force para reemplazarlas; se respaldan antes)");
            $saltados += $chocan;
        }
        aviso('INFO', 'Las listas viven en documents/users/<id>/: si las cuentas del equipo nuevo tienen otros ids, mueve las carpetas al id correcto.');
    }
}

echo str_repeat('-', 68) . "\n";
printf("Archivos escritos: %d · saltados: %d · errores: %d\n", $copiados, $saltados, $errores);
if ($dryRun) echo "Simulacion: vuelve a ejecutar sin --dry-run para aplicar.\n";
echo "\nSiguiente paso: abre el Visor y entra a agents.php para confirmar el registro.\n";

exit($errores > 0 ? 1 : 0);
