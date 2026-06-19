<?php
/**
 * Backend de la Fábrica de Módulos (Forge).
 *
 * El agente (vía Ollama/OpenRouter, NO claude.exe) genera un módulo cuyos
 * archivos vienen marcados con `// @file: ruta/relativa`. Este controlador:
 *   - GET  ?action=projects     → proyectos destino permitidos (subcarpetas de www)
 *   - POST  action=preview      → diff por archivo (nuevo/modificado), SIN escribir
 *   - POST  action=materialize  → escribe los archivos aprobados al proyecto
 *
 * Seguridad: cada destino debe caer DENTRO de la raíz del proyecto elegido, que
 * a su vez vive dentro de www. Sin path traversal, sin rutas absolutas, sólo
 * extensiones de texto/código en lista blanca.
 */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

// www = 5 niveles arriba de /coffee/app/visor/ctrl
$WWW_ROOT = realpath(__DIR__ . '/../../../../..');
$WWW_ROOT = $WWW_ROOT !== false ? str_replace('\\', '/', $WWW_ROOT) : '';

// Extensiones escribibles (gemelo de la lista del visor + las de un módulo).
$ALLOWED_EXTS = [
    'php','js','mjs','ts','css','scss','less','html','htm','vue','astro',
    'md','markdown','json','yml','yaml','xml','sql','txt','csv','svg'
];

/** Subcarpetas de www = proyectos destino. */
function forge_projects($wwwRoot) {
    $out = [];
    if ($wwwRoot === '' || !is_dir($wwwRoot)) return $out;
    foreach (@scandir($wwwRoot) ?: [] as $e) {
        if ($e === '.' || $e === '..' || $e[0] === '.') continue;
        $full = $wwwRoot . '/' . $e;
        if (!is_dir($full)) continue;
        $out[] = ['key' => $e, 'name' => $e, 'path' => $full];
    }
    usort($out, function ($a, $b) { return strcasecmp($a['name'], $b['name']); });
    return $out;
}

/** Resuelve la raíz absoluta de un proyecto destino validado contra la whitelist. */
function forge_project_root($wwwRoot, $key) {
    foreach (forge_projects($wwwRoot) as $p) {
        if ($p['key'] === $key) return $p['path'];
    }
    return null;
}

/**
 * Valida y resuelve la ruta relativa de un archivo dentro de la raíz del proyecto.
 * @return array{ok:bool, target?:string, reason?:string}
 */
function forge_resolve($projectRoot, $rel, $allowedExts) {
    $rel = str_replace('\\', '/', trim((string) $rel));
    $rel = ltrim($rel, '/');                         // sin raíz absoluta
    if ($rel === '')                       return ['ok' => false, 'reason' => 'ruta vacía'];
    if (preg_match('#(^|/)\.\.(/|$)#', $rel)) return ['ok' => false, 'reason' => 'path traversal'];
    if (preg_match('#^[A-Za-z]:#', $rel))  return ['ok' => false, 'reason' => 'ruta absoluta no permitida'];

    $ext = strtolower(pathinfo($rel, PATHINFO_EXTENSION));
    if (!in_array($ext, $allowedExts, true)) return ['ok' => false, 'reason' => "extensión .$ext no permitida"];

    $target  = rtrim($projectRoot, '/') . '/' . $rel;
    $rootReal = str_replace('\\', '/', realpath($projectRoot));
    // El dir padre puede no existir aún: validamos contra el ancestro más cercano.
    $dir = dirname($target);
    $probe = $dir;
    while ($probe && !is_dir($probe)) $probe = dirname($probe);
    $probeReal = $probe ? str_replace('\\', '/', realpath($probe)) : false;
    if ($probeReal === false || strpos($probeReal . '/', $rootReal . '/') !== 0) {
        return ['ok' => false, 'reason' => 'fuera de la raíz del proyecto'];
    }
    return ['ok' => true, 'target' => $target];
}

function forge_lines($s) { return $s === '' ? 0 : substr_count($s, "\n") + 1; }

/** Lee files del POST: JSON [{path, content}]. */
function forge_read_files() {
    $raw = $_POST['files'] ?? '';
    $arr = json_decode($raw, true);
    if (!is_array($arr)) return [];
    // Tolerar un objeto único {path,content} además del array [{...}] esperado.
    if (isset($arr['path']) || isset($arr['content'])) $arr = [$arr];
    $out = [];
    foreach ($arr as $f) {
        if (!is_array($f)) continue;
        $out[] = ['path' => (string) ($f['path'] ?? ''), 'content' => (string) ($f['content'] ?? '')];
    }
    return $out;
}

$action = $_GET['action'] ?? $_POST['action'] ?? '';
$isPost = ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST';

// ── GET projects ──────────────────────────────────────────────
if ($action === 'projects') {
    // Proyecto que ALOJA al visor (primer segmento de la ruta de este ctrl bajo
    // www). Para ese proyecto la URL de apertura se deduce sola en el frontend.
    $selfDir   = str_replace('\\', '/', __DIR__);
    $container = '';
    if ($WWW_ROOT !== '' && strpos($selfDir, $WWW_ROOT . '/') === 0) {
        $rest = substr($selfDir, strlen($WWW_ROOT) + 1);
        $container = explode('/', $rest)[0];
    }
    echo json_encode(['success' => true, 'wwwRoot' => $WWW_ROOT, 'container' => $container, 'projects' => forge_projects($WWW_ROOT)],
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

// ── GET readfile ──────────────────────────────────────────────
// Lee un archivo existente del proyecto (texto, whitelist) para importarlo como
// contexto del agente. Misma validación de seguridad que la escritura.
if ($action === 'readfile') {
    $project = trim($_GET['project'] ?? $_POST['project'] ?? '');
    $root    = forge_project_root($WWW_ROOT, $project);
    if ($root === null) { http_response_code(400); echo json_encode(['success' => false, 'message' => 'Proyecto inválido']); exit; }

    $rel = $_GET['path'] ?? $_POST['path'] ?? '';
    $res = forge_resolve($root, $rel, $ALLOWED_EXTS);
    if (!$res['ok'])              { http_response_code(400); echo json_encode(['success' => false, 'message' => $res['reason']]); exit; }
    if (!is_file($res['target'])) { http_response_code(404); echo json_encode(['success' => false, 'message' => 'No existe el archivo']); exit; }

    $content = (string) @file_get_contents($res['target']);
    echo json_encode(['success' => true, 'path' => $rel, 'content' => $content, 'bytes' => strlen($content)],
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

// ── GET listdir ───────────────────────────────────────────────
// Lista carpetas y archivos de una ruta del proyecto (para el explorador). Las
// carpetas siempre; los archivos marcan si su extensión es escribible/legible.
if ($action === 'listdir') {
    $project = trim($_GET['project'] ?? '');
    $root    = forge_project_root($WWW_ROOT, $project);
    if ($root === null) { http_response_code(400); echo json_encode(['success' => false, 'message' => 'Proyecto inválido']); exit; }

    $rel = str_replace('\\', '/', trim($_GET['path'] ?? ''));
    $rel = ltrim($rel, '/');
    if (preg_match('#(^|/)\.\.(/|$)#', $rel)) { http_response_code(400); echo json_encode(['success' => false, 'message' => 'path traversal']); exit; }

    $dir      = $rel === '' ? $root : rtrim($root, '/') . '/' . $rel;
    $dirReal  = realpath($dir);
    $rootReal = str_replace('\\', '/', realpath($root));
    if ($dirReal === false || strpos(str_replace('\\', '/', $dirReal) . '/', $rootReal . '/') !== 0 || !is_dir($dirReal)) {
        http_response_code(404); echo json_encode(['success' => false, 'message' => 'Carpeta no encontrada']); exit;
    }

    // Extensiones que además se pueden ABRIR en el sandbox (corren en el navegador).
    $openable = ['php', 'html', 'htm'];
    $entries = [];
    foreach (@scandir($dirReal) ?: [] as $e) {
        if ($e === '.' || $e === '..' || $e[0] === '.') continue;
        $full     = $dirReal . '/' . $e;
        $childRel = ($rel === '' ? '' : $rel . '/') . $e;
        if (is_dir($full)) {
            $entries[] = ['name' => $e, 'type' => 'dir', 'rel' => $childRel];
        } else {
            $ext = strtolower(pathinfo($e, PATHINFO_EXTENSION));
            $entries[] = [
                'name' => $e, 'type' => 'file', 'rel' => $childRel, 'ext' => $ext,
                'readable' => in_array($ext, $ALLOWED_EXTS, true),
                'openable' => in_array($ext, $openable, true)
            ];
        }
    }
    usort($entries, function ($a, $b) {
        if ($a['type'] !== $b['type']) return $a['type'] === 'dir' ? -1 : 1;
        return strcasecmp($a['name'], $b['name']);
    });
    echo json_encode(['success' => true, 'project' => $project, 'path' => $rel, 'entries' => $entries],
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

// ── POST preview ──────────────────────────────────────────────
if ($isPost && $action === 'preview') {
    $project = trim($_POST['project'] ?? '');
    $root    = forge_project_root($WWW_ROOT, $project);
    if ($root === null) { http_response_code(400); echo json_encode(['success' => false, 'message' => 'Proyecto destino inválido']); exit; }

    $results = [];
    foreach (forge_read_files() as $f) {
        $res = forge_resolve($root, $f['path'], $ALLOWED_EXTS);
        if (!$res['ok']) { $results[] = ['path' => $f['path'], 'status' => 'blocked', 'reason' => $res['reason']]; continue; }
        $exists  = is_file($res['target']);
        $old     = $exists ? (string) @file_get_contents($res['target']) : '';
        $new     = $f['content'];
        $status  = !$exists ? 'new' : ($old === $new ? 'identical' : 'modified');
        $results[] = [
            'path'     => $f['path'],
            'status'   => $status,
            'exists'   => $exists,
            'oldLines' => forge_lines($old),
            'newLines' => forge_lines($new),
            'oldContent' => $exists ? $old : null
        ];
    }
    echo json_encode(['success' => true, 'project' => $project, 'root' => $root, 'files' => $results],
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

// ── POST materialize ──────────────────────────────────────────
if ($isPost && $action === 'materialize') {
    $project = trim($_POST['project'] ?? '');
    $root    = forge_project_root($WWW_ROOT, $project);
    if ($root === null) { http_response_code(400); echo json_encode(['success' => false, 'message' => 'Proyecto destino inválido']); exit; }

    $written = []; $errors = [];
    foreach (forge_read_files() as $f) {
        $res = forge_resolve($root, $f['path'], $ALLOWED_EXTS);
        if (!$res['ok']) { $errors[] = ['path' => $f['path'], 'reason' => $res['reason']]; continue; }
        $dir = dirname($res['target']);
        if (!is_dir($dir) && !@mkdir($dir, 0777, true)) {
            $errors[] = ['path' => $f['path'], 'reason' => 'no se pudo crear la carpeta']; continue;
        }
        $bytes = @file_put_contents($res['target'], $f['content']);
        if ($bytes === false) {
            $err = error_get_last();
            $errors[] = ['path' => $f['path'], 'reason' => $err['message'] ?? 'IO error']; continue;
        }
        $written[] = ['path' => $f['path'], 'bytes' => $bytes, 'mtime' => date('Y-m-d H:i:s', filemtime($res['target']))];
    }
    echo json_encode(['success' => count($errors) === 0, 'written' => $written, 'errors' => $errors],
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

http_response_code(400);
echo json_encode(['success' => false, 'message' => 'Acción no reconocida']);
