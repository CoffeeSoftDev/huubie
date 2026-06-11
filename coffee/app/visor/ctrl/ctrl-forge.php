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
    echo json_encode(['success' => true, 'wwwRoot' => $WWW_ROOT, 'projects' => forge_projects($WWW_ROOT)],
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
