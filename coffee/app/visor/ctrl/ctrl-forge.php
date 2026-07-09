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
 * Templates de módulo (copias REALES de un módulo que ya corre, separadas en
 * index/ctrl/mdl/src, guardadas en documents/module-template/<slug>/):
 *   - POST  action=clonemodule       → clona una carpeta del proyecto como template
 *   - GET  ?action=modtemplates      → lista los templates de módulo guardados
 *   - POST  action=applymodtemplate  → aplica un template a proyecto+carpeta (dry=1 previsualiza)
 *   - POST  action=deletemodtemplate → elimina un template de módulo
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

/**
 * VirtualHosts de Apache cuyo DocumentRoot cae DENTRO de www. Permite que el
 * frontend componga la URL pública real de un módulo (p.ej. grupovaroch/erp-gv
 * se sirve por www.erp-pro.com), en vez de asumir el origen del visor.
 * Devuelve [{server, rel, docRoot}] con `rel` = docroot relativo a www.
 */
function forge_vhosts($wwwRoot) {
    $out = [];
    if ($wwwRoot === '') return $out;
    $wampDir = str_replace('\\', '/', dirname($wwwRoot));   // p.ej. c:/wamp64
    $files   = glob($wampDir . '/bin/apache/*/conf/extra/httpd-vhosts.conf') ?: [];
    $wwwLower = strtolower($wwwRoot);
    foreach ($files as $cf) {
        $txt = @file_get_contents($cf);
        if ($txt === false) continue;
        if (!preg_match_all('#<VirtualHost\b[^>]*>(.*?)</VirtualHost>#is', $txt, $blocks)) continue;
        foreach ($blocks[1] as $blk) {
            if (!preg_match('#^\s*ServerName\s+(\S+)#im', $blk, $sn)) continue;
            if (!preg_match('#^\s*DocumentRoot\s+"?([^"\r\n]+)"?#im', $blk, $dr)) continue;
            $server  = trim($sn[1]);
            $docRoot = rtrim(str_replace('\\', '/', trim($dr[1])), '/');
            $docRoot = str_replace('${INSTALL_DIR}', $wampDir, $docRoot);
            // Solo vhosts servidos desde dentro de www (los externos no aplican).
            if (strpos(strtolower($docRoot) . '/', $wwwLower . '/') !== 0) continue;
            $rel = ltrim(substr($docRoot, strlen($wwwRoot)), '/');
            $out[$server] = ['server' => $server, 'rel' => $rel, 'docRoot' => $docRoot];
        }
    }
    return array_values($out);
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

/* ── Templates de módulo ─────────────────────────────────────────
 * Un template es la copia REAL (byte a byte) de la carpeta de un módulo que ya
 * funciona, clasificada por partes (index / ctrl / mdl / src / otros) y con un
 * manifiesto template.json. Se guarda fuera de los proyectos, en el visor. */

$MT_ROOT = str_replace('\\', '/', dirname(__DIR__)) . '/documents/module-template';

// Carpetas que nunca forman parte del código de un módulo.
$MT_SKIP_DIRS = ['.git', '.svn', 'node_modules', 'vendor', '__pycache__', '.idea', '.vscode'];
// Extensiones que no aportan a un módulo funcional (paquetes, binarios de SO, logs).
$MT_SKIP_EXTS = ['zip', 'rar', '7z', 'gz', 'tar', 'exe', 'dll', 'msi', 'log', 'bak'];
const MT_MAX_FILE_BYTES  = 8388608;    // 8 MB por archivo
const MT_MAX_TOTAL_BYTES = 83886080;   // 80 MB por template
const MT_MAX_FILES       = 1500;

/** Slug de carpeta (gemelo del pgSlugify del frontend). */
function forge_slug($name) {
    $s = strtolower(trim((string) $name));
    if (function_exists('iconv')) {
        $t = @iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $s);
        if ($t !== false) $s = $t;
    }
    $s = preg_replace('/[^a-z0-9]+/', '-', $s);
    $s = trim($s, '-');
    return $s !== '' ? $s : 'template';
}

/** Parte del módulo a la que pertenece una ruta relativa a su raíz. */
function forge_part($rel) {
    if (preg_match('#^index\.(php|html?)$#i', $rel)) return 'index';
    $seg = strtolower(explode('/', $rel)[0]);
    if ($seg === 'ctrl') return 'ctrl';
    if ($seg === 'mdl')  return 'mdl';
    if ($seg === 'src')  return 'src';
    return 'otros';
}

/**
 * Recorre la carpeta del módulo y devuelve sus archivos relativos, aplicando
 * los filtros de carpeta/extensión/tamaño. @return array{files:array, skipped:int}
 */
function forge_scan_module($dir, $skipDirs, $skipExts) {
    $files = []; $skipped = 0;
    $walk = function ($abs, $rel) use (&$walk, &$files, &$skipped, $skipDirs, $skipExts) {
        foreach (@scandir($abs) ?: [] as $e) {
            if ($e === '.' || $e === '..') continue;
            $full     = $abs . '/' . $e;
            $childRel = ($rel === '' ? '' : $rel . '/') . $e;
            if (is_dir($full)) {
                if (in_array(strtolower($e), $skipDirs, true) || $e[0] === '.') { $skipped++; continue; }
                $walk($full, $childRel);
                continue;
            }
            $ext   = strtolower(pathinfo($e, PATHINFO_EXTENSION));
            $bytes = (int) @filesize($full);
            if (in_array($ext, $skipExts, true) || $bytes > MT_MAX_FILE_BYTES) { $skipped++; continue; }
            $files[] = ['rel' => $childRel, 'bytes' => $bytes, 'part' => forge_part($childRel)];
        }
    };
    $walk(rtrim($dir, '/'), '');
    return ['files' => $files, 'skipped' => $skipped];
}

/** Borra una carpeta recursivamente (solo se usa dentro de MT_ROOT). */
function forge_rrmdir($dir) {
    foreach (@scandir($dir) ?: [] as $e) {
        if ($e === '.' || $e === '..') continue;
        $full = $dir . '/' . $e;
        if (is_dir($full)) forge_rrmdir($full);
        else @unlink($full);
    }
    @rmdir($dir);
}

/** Raíz validada de un template por slug (null si no existe o slug inválido). */
function forge_mt_dir($mtRoot, $slug) {
    if (!preg_match('/^[a-z0-9][a-z0-9-]*$/', (string) $slug)) return null;
    $dir = $mtRoot . '/' . $slug;
    return is_dir($dir) ? $dir : null;
}

/** Lee el manifiesto de un template. */
function forge_mt_manifest($mtRoot, $slug) {
    $dir = forge_mt_dir($mtRoot, $slug);
    if ($dir === null) return null;
    $m = json_decode((string) @file_get_contents($dir . '/template.json'), true);
    return is_array($m) ? $m : null;
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
    echo json_encode(['success' => true, 'wwwRoot' => $WWW_ROOT, 'container' => $container,
        'projects' => forge_projects($WWW_ROOT), 'vhosts' => forge_vhosts($WWW_ROOT)],
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

// ── POST clonemodule ──────────────────────────────────────────
// Copia REAL de una carpeta del proyecto (el módulo) a documents/module-template/
// <slug>/files/**, con manifiesto que clasifica cada archivo por parte.
if ($isPost && $action === 'clonemodule') {
    $project = trim($_POST['project'] ?? '');
    $root    = forge_project_root($WWW_ROOT, $project);
    if ($root === null) { http_response_code(400); echo json_encode(['success' => false, 'message' => 'Proyecto inválido']); exit; }

    $rel = str_replace('\\', '/', trim($_POST['path'] ?? ''));
    $rel = trim($rel, '/');
    if (preg_match('#(^|/)\.\.(/|$)#', $rel)) { http_response_code(400); echo json_encode(['success' => false, 'message' => 'path traversal']); exit; }

    $srcDir   = $rel === '' ? $root : rtrim($root, '/') . '/' . $rel;
    $srcReal  = realpath($srcDir);
    $rootReal = str_replace('\\', '/', realpath($root));
    if ($srcReal === false || !is_dir($srcReal)
        || strpos(str_replace('\\', '/', $srcReal) . '/', $rootReal . '/') !== 0) {
        http_response_code(404); echo json_encode(['success' => false, 'message' => 'Carpeta no encontrada']); exit;
    }
    $srcReal = str_replace('\\', '/', $srcReal);

    $name = trim($_POST['name'] ?? '');
    if ($name === '') $name = basename($srcReal) ?: $project;

    $scan  = forge_scan_module($srcReal, $MT_SKIP_DIRS, $MT_SKIP_EXTS);
    $files = $scan['files'];
    if (!$files) { echo json_encode(['success' => false, 'message' => 'La carpeta no tiene archivos clonables']); exit; }
    if (count($files) > MT_MAX_FILES) {
        echo json_encode(['success' => false, 'message' => 'Demasiados archivos (' . count($files) . '); clona la carpeta del módulo, no el proyecto completo']); exit;
    }
    $total = 0;
    foreach ($files as $f) $total += $f['bytes'];
    if ($total > MT_MAX_TOTAL_BYTES) {
        echo json_encode(['success' => false, 'message' => 'La carpeta pesa demasiado (' . round($total / 1048576) . ' MB); clona solo el módulo']); exit;
    }

    // Slug único: si ya existe un template con ese nombre, sufija -2, -3…
    $slug = forge_slug($name);
    $base = $slug; $n = 2;
    while (is_dir($MT_ROOT . '/' . $slug)) { $slug = $base . '-' . $n; $n++; }

    $destBase = $MT_ROOT . '/' . $slug . '/files';
    $errors = [];
    foreach ($files as $f) {
        $to  = $destBase . '/' . $f['rel'];
        $dir = dirname($to);
        if (!is_dir($dir) && !@mkdir($dir, 0777, true)) { $errors[] = $f['rel'] . ': no se pudo crear la carpeta'; continue; }
        if (!@copy($srcReal . '/' . $f['rel'], $to))     { $errors[] = $f['rel'] . ': no se pudo copiar'; }
    }
    if ($errors) {
        forge_rrmdir($MT_ROOT . '/' . $slug);
        echo json_encode(['success' => false, 'message' => 'Falló la copia: ' . implode('; ', array_slice($errors, 0, 5))]); exit;
    }

    $parts = ['index' => 0, 'ctrl' => 0, 'mdl' => 0, 'src' => 0, 'otros' => 0];
    foreach ($files as $f) $parts[$f['part']]++;
    $manifest = [
        'name'       => $name,
        'slug'       => $slug,
        'source'     => ['project' => $project, 'path' => $rel],
        'createdAt'  => date('Y-m-d H:i:s'),
        'files'      => $files,
        'parts'      => $parts,
        'totalBytes' => $total,
        'skipped'    => $scan['skipped']
    ];
    @file_put_contents($MT_ROOT . '/' . $slug . '/template.json',
        json_encode($manifest, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT));

    echo json_encode(['success' => true, 'template' => $manifest], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

// ── GET modtemplates ──────────────────────────────────────────
if ($action === 'modtemplates') {
    $out = [];
    foreach (@scandir($MT_ROOT) ?: [] as $e) {
        if ($e === '.' || $e === '..') continue;
        $m = forge_mt_manifest($MT_ROOT, $e);
        if ($m) $out[] = $m;
    }
    usort($out, function ($a, $b) { return strcmp($b['createdAt'] ?? '', $a['createdAt'] ?? ''); });
    echo json_encode(['success' => true, 'templates' => $out], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

// ── POST applymodtemplate ─────────────────────────────────────
// Aplica un template a proyecto + carpeta destino. Con dry=1 solo compara
// (nuevo/sobrescribe/idéntico, por hash); sin dry copia disco a disco, lo que
// preserva binarios (imágenes, fuentes) y mantiene el módulo funcional.
if ($isPost && $action === 'applymodtemplate') {
    $slug = trim($_POST['slug'] ?? '');
    $m    = forge_mt_manifest($MT_ROOT, $slug);
    if ($m === null) { http_response_code(404); echo json_encode(['success' => false, 'message' => 'Template no encontrado']); exit; }

    $project = trim($_POST['project'] ?? '');
    $root    = forge_project_root($WWW_ROOT, $project);
    if ($root === null) { http_response_code(400); echo json_encode(['success' => false, 'message' => 'Proyecto destino inválido']); exit; }

    $dest = str_replace('\\', '/', trim($_POST['dest'] ?? ''));
    $dest = trim($dest, '/');
    if (preg_match('#(^|/)\.\.(/|$)#', $dest) || preg_match('#^[A-Za-z]:#', $dest)) {
        http_response_code(400); echo json_encode(['success' => false, 'message' => 'Carpeta destino inválida']); exit;
    }

    $dry      = ($_POST['dry'] ?? '') === '1';
    $filesDir = $MT_ROOT . '/' . $slug . '/files';   // slug ya validado por forge_mt_manifest
    $rootReal = str_replace('\\', '/', realpath($root));

    $results = []; $written = []; $errors = [];
    foreach (($m['files'] ?? []) as $f) {
        $rel     = $f['rel'];
        $destRel = ($dest === '' ? '' : $dest . '/') . $rel;
        $from    = $filesDir . '/' . $rel;
        $target  = rtrim($root, '/') . '/' . $destRel;

        if (!is_file($from)) {
            $row = ['path' => $destRel, 'status' => 'blocked', 'reason' => 'falta en el template'];
            $dry ? $results[] = $row : $errors[] = ['path' => $destRel, 'reason' => 'falta en el template'];
            continue;
        }
        // El padre puede no existir aún: validar contra el ancestro real más cercano.
        $probe = dirname($target);
        while ($probe && !is_dir($probe)) $probe = dirname($probe);
        $probeReal = $probe ? str_replace('\\', '/', realpath($probe)) : false;
        if ($probeReal === false || strpos($probeReal . '/', $rootReal . '/') !== 0) {
            $row = ['path' => $destRel, 'status' => 'blocked', 'reason' => 'fuera de la raíz del proyecto'];
            $dry ? $results[] = $row : $errors[] = ['path' => $destRel, 'reason' => 'fuera de la raíz del proyecto'];
            continue;
        }

        if ($dry) {
            $exists = is_file($target);
            $status = !$exists ? 'new' : (md5_file($target) === md5_file($from) ? 'identical' : 'modified');
            $results[] = [
                'path'     => $destRel,
                'status'   => $status,
                'newBytes' => (int) @filesize($from),
                'oldBytes' => $exists ? (int) @filesize($target) : 0
            ];
            continue;
        }

        $dir = dirname($target);
        if (!is_dir($dir) && !@mkdir($dir, 0777, true)) { $errors[] = ['path' => $destRel, 'reason' => 'no se pudo crear la carpeta']; continue; }
        if (!@copy($from, $target))                     { $errors[] = ['path' => $destRel, 'reason' => 'no se pudo escribir']; continue; }
        $written[] = ['path' => $destRel, 'bytes' => (int) @filesize($target)];
    }

    if ($dry) {
        echo json_encode(['success' => true, 'project' => $project, 'dest' => $dest, 'files' => $results],
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    } else {
        echo json_encode(['success' => count($errors) === 0, 'written' => $written, 'errors' => $errors],
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }
    exit;
}

// ── POST deletemodtemplate ────────────────────────────────────
if ($isPost && $action === 'deletemodtemplate') {
    $slug = trim($_POST['slug'] ?? '');
    $dir  = forge_mt_dir($MT_ROOT, $slug);
    if ($dir === null) { http_response_code(404); echo json_encode(['success' => false, 'message' => 'Template no encontrado']); exit; }
    forge_rrmdir($dir);
    echo json_encode(['success' => !is_dir($dir)]);
    exit;
}

http_response_code(400);
echo json_encode(['success' => false, 'message' => 'Acción no reconocida']);
