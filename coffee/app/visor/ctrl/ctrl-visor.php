<?php
header('Cache-Control: no-store');

require_once __DIR__ . '/path-helper.php';

// Endpoint lazy-read para archivos de Drive (no devuelve JSON, devuelve el contenido raw)
if (($_GET['action'] ?? '') === 'driveread') {
    require_once __DIR__ . '/drive-client.php';
    $id   = $_GET['id']   ?? '';
    $mime = $_GET['mime'] ?? '';
    if (!$id) { header('Content-Type: text/plain'); http_response_code(400); echo '// ID requerido'; exit; }

    // Hojas binarias que el frontend renderiza con SheetJS (multi-hoja, formatos, fechas, etc).
    // Google Sheets nativo se exporta a xlsx para usar el mismo render del frontend.
    $xlsxMime    = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    $sheetMimes  = [$xlsxMime, 'application/vnd.ms-excel', 'application/vnd.oasis.opendocument.spreadsheet'];
    $isText      = strpos($mime, 'text/') === 0;
    $isCode      = in_array($mime, ['application/json','application/javascript','application/x-javascript','application/xml','application/sql']);
    $isGdoc      = strpos($mime, 'application/vnd.google-apps.') === 0;
    $isSheet     = in_array($mime, $sheetMimes, true);
    $isGSheet    = $mime === 'application/vnd.google-apps.spreadsheet';

    try {
        $drive = new DriveClient();

        // Spreadsheets -> bytes raw para que SheetJS renderice en frontend
        if ($isSheet || $isGSheet) {
            header('Content-Type: application/octet-stream');
            header('X-Visor-Format: spreadsheet-binary');
            if ($isGSheet) {
                echo $drive->exportFile($id, $xlsxMime);
            } else {
                echo $drive->downloadFile($id);
            }
            exit;
        }

        header('Content-Type: text/plain; charset=utf-8');
        if ($isText || $isCode) {
            echo $drive->downloadFile($id);
        } elseif ($isGdoc) {
            echo $drive->getFileContent(['id' => $id, 'mimeType' => $mime]);
        } else {
            echo "> Archivo no previsualizable en el visor.\n>\n> **Tipo:** `$mime`\n>\n> Usa el enlace 'Abrir en Drive' para verlo.";
        }
    } catch (Throwable $e) {
        http_response_code(500);
        header('Content-Type: text/plain; charset=utf-8');
        echo "> Error al leer el archivo desde Drive:\n>\n> " . $e->getMessage();
    }
    exit;
}

// Endpoint de diagnostico Drive (GET ?action=drivecheck)
// Reporta credenciales, email del SA, carpeta raiz y carpetas compartidas visibles.
if (($_GET['action'] ?? '') === 'drivecheck') {
    header('Content-Type: application/json; charset=utf-8');
    require_once __DIR__ . '/drive-config.php';

    $out = [
        'ok'              => false,
        'credentialsPath' => DRIVE_CREDENTIALS_PATH,
        'credentialsFound'=> file_exists(DRIVE_CREDENTIALS_PATH),
        'caBundleFound'   => file_exists(DRIVE_CA_BUNDLE),
        'rootFolderId'    => DRIVE_ROOT_FOLDER_ID,
        'serviceAccountEmail' => null,
        'rootFolderAccessible'=> false,
        'sharedFolders'   => [],
        'error'           => null,
    ];
    try {
        if (!$out['credentialsFound']) {
            throw new Exception('Falta el JSON del Service Account en: ' . DRIVE_CREDENTIALS_PATH);
        }
        $jsonRaw = @file_get_contents(DRIVE_CREDENTIALS_PATH);
        $jsonArr = json_decode($jsonRaw, true);
        $out['serviceAccountEmail'] = $jsonArr['client_email'] ?? null;

        require_once __DIR__ . '/drive-client.php';
        $drive = new DriveClient();

        // Carpeta raiz configurada
        try {
            $rootChildren = $drive->listChildren(DRIVE_ROOT_FOLDER_ID, 'all');
            $out['rootFolderAccessible'] = true;
            $out['rootChildrenCount'] = count($rootChildren);
        } catch (Throwable $e) {
            $out['rootFolderAccessible'] = false;
            $out['rootFolderError'] = $e->getMessage();
        }

        // Carpetas compartidas con el SA (lo que aparece en el dropdown del visor)
        $shared = $drive->listSharedFolders();
        foreach ($shared as $f) {
            $out['sharedFolders'][] = [
                'id'   => $f['id'],
                'name' => $f['name'],
                'mtime'=> $f['modifiedTime'] ?? null
            ];
        }
        $out['ok'] = true;
    } catch (Throwable $e) {
        $out['error'] = $e->getMessage();
    }
    echo json_encode($out, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT);
    exit;
}

// Endpoint para guardar archivos en Drive (POST drivewrite)
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST' && ($_POST['action'] ?? '') === 'drivewrite') {
    header('Content-Type: application/json; charset=utf-8');
    require_once __DIR__ . '/drive-client.php';

    $id      = trim($_POST['id']      ?? '');
    $content = $_POST['content']      ?? '';
    $mime    = trim($_POST['mime']    ?? '');

    if ($id === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'id requerido']);
        exit;
    }
    // Si llega un mime Google Apps nativo, defaultear a markdown.
    if ($mime === '' || strpos($mime, 'application/vnd.google-apps.') === 0) {
        $mime = 'text/markdown';
    }
    // Whitelist: solo aceptar mimes de texto (markdown/html/plain).
    if (!in_array($mime, ['text/markdown', 'text/html', 'text/plain'], true)) {
        $mime = 'text/markdown';
    }

    try {
        $drive = new DriveClient();
        $meta  = $drive->updateFile($id, $content, $mime);

        $sizeRaw = isset($meta['size']) ? (int)$meta['size'] : null;
        $sizeFmt = $sizeRaw !== null
            ? ($sizeRaw < 1024 ? $sizeRaw . ' B' : ($sizeRaw < 1024 * 1024 ? round($sizeRaw / 1024) . ' KB' : round($sizeRaw / (1024 * 1024), 1) . ' MB'))
            : null;
        $mtime = !empty($meta['modifiedTime']) ? date('Y-m-d H:i:s', strtotime($meta['modifiedTime'])) : null;

        echo json_encode([
            'success' => true,
            'message' => 'Guardado en Drive',
            'size'    => $sizeFmt,
            'mtime'   => $mtime
        ]);
    } catch (Throwable $e) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'Error Drive: ' . $e->getMessage()]);
    }
    exit;
}

// Endpoint para guardar archivos locales (POST)
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST' && ($_POST['action'] ?? '') === 'save') {
    header('Content-Type: application/json; charset=utf-8');

    $fullPath   = trim($_POST['fullPath']   ?? '');
    $customPath = trim($_POST['customPath'] ?? '');
    $content    = $_POST['content'] ?? '';

    if ($fullPath === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'fullPath requerido']);
        exit;
    }

    // Extensiones de texto admitidas
    $allowedExts = [
        'md','markdown','txt','json','yml','yaml','toml','xml','csv','tsv',
        'html','htm','css','scss','js','ts','php','py','rb','go','rs',
        'java','c','cpp','cs','sh','sql','ini','conf','log','env','drawio','excalidraw'
    ];
    $ext = strtolower(pathinfo($fullPath, PATHINFO_EXTENSION));
    if (!in_array($ext, $allowedExts, true)) {
        echo json_encode(['success' => false, 'message' => "Extension no editable: .$ext"]);
        exit;
    }

    // Sandbox: validar que el archivo cae dentro de un root conocido
    $userHome    = coffee_user_home();
    $CLAUDE_HOME = str_replace('\\', '/', $userHome) . '/.claude';
    $allowedRoots = [
        $CLAUDE_HOME . '/agents',
        $CLAUDE_HOME . '/commands',
        $CLAUDE_HOME . '/steering',
        str_replace('\\', '/', __DIR__ . '/../documents'),
    ];
    if ($customPath !== '') $allowedRoots[] = str_replace('\\', '/', $customPath);

    $target  = str_replace('\\', '/', $fullPath);
    $dir     = dirname($target);
    $dirReal = realpath($dir);
    if ($dirReal === false) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Carpeta destino no existe']);
        exit;
    }
    $dirReal = str_replace('\\', '/', $dirReal);

    $inside = false;
    foreach ($allowedRoots as $root) {
        $rootReal = realpath($root);
        if ($rootReal === false) continue;
        $rootReal = rtrim(str_replace('\\', '/', $rootReal), '/');
        if (strpos($dirReal . '/', $rootReal . '/') === 0) { $inside = true; break; }
    }
    if (!$inside) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Ruta fuera del sandbox del visor']);
        exit;
    }

    $bytes = @file_put_contents($target, $content);
    if ($bytes === false) {
        $err = error_get_last();
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'No se pudo escribir: ' . ($err['message'] ?? 'IO error')]);
        exit;
    }

    $size    = filesize($target);
    $sizeFmt = $size < 1024 ? $size . ' B' : ($size < 1024 * 1024 ? round($size / 1024) . ' KB' : round($size / (1024 * 1024), 1) . ' MB');
    echo json_encode([
        'success' => true,
        'message' => 'Guardado',
        'size'    => $sizeFmt,
        'bytes'   => $bytes,
        'mtime'   => date('Y-m-d H:i:s', filemtime($target))
    ]);
    exit;
}

// Endpoint para ELIMINAR un archivo local (POST delete).
// Mismo sandbox que 'save': solo borra dentro de los roots conocidos (o el customPath
// activo). No toca Drive (eso requeriria otro endpoint).
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST' && ($_POST['action'] ?? '') === 'delete') {
    header('Content-Type: application/json; charset=utf-8');

    $fullPath   = trim($_POST['fullPath']   ?? '');
    $customPath = trim($_POST['customPath'] ?? '');

    if ($fullPath === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'fullPath requerido']);
        exit;
    }

    $allowedExts = [
        'md','markdown','txt','json','yml','yaml','toml','xml','csv','tsv',
        'html','htm','css','scss','js','ts','php','py','rb','go','rs',
        'java','c','cpp','cs','sh','sql','ini','conf','log','env','drawio','excalidraw'
    ];
    $ext = strtolower(pathinfo($fullPath, PATHINFO_EXTENSION));
    if (!in_array($ext, $allowedExts, true)) {
        echo json_encode(['success' => false, 'message' => "Extension no eliminable: .$ext"]);
        exit;
    }

    $userHome    = coffee_user_home();
    $CLAUDE_HOME = str_replace('\\', '/', $userHome) . '/.claude';
    $allowedRoots = [
        $CLAUDE_HOME . '/agents',
        $CLAUDE_HOME . '/commands',
        $CLAUDE_HOME . '/steering',
        str_replace('\\', '/', __DIR__ . '/../documents'),
    ];
    if ($customPath !== '') $allowedRoots[] = str_replace('\\', '/', $customPath);

    $target     = str_replace('\\', '/', $fullPath);
    $targetReal = realpath($target);
    if ($targetReal === false || !is_file($targetReal)) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'El archivo no existe']);
        exit;
    }
    $targetReal = str_replace('\\', '/', $targetReal);

    $inside = false;
    foreach ($allowedRoots as $root) {
        $rootReal = realpath($root);
        if ($rootReal === false) continue;
        $rootReal = rtrim(str_replace('\\', '/', $rootReal), '/');
        if (strpos($targetReal, $rootReal . '/') === 0) { $inside = true; break; }
    }
    if (!$inside) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Ruta fuera del sandbox del visor']);
        exit;
    }

    if (!@unlink($targetReal)) {
        $err = error_get_last();
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'No se pudo eliminar: ' . ($err['message'] ?? 'IO error')]);
        exit;
    }

    echo json_encode(['success' => true, 'message' => 'Archivo eliminado']);
    exit;
}

// Endpoint para GUARDAR una plantilla del Playground (POST savetemplate).
// Cada plantilla vive en documents/template/<slug>/ con:
//   template.html  -> el render listo para reutilizar
//   meta.json      -> tema, agente, modelo, prompt, conversacion, etc.
// La carpeta se crea si no existe (a diferencia de la accion 'save' generica).
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST' && ($_POST['action'] ?? '') === 'savetemplate') {
    header('Content-Type: application/json; charset=utf-8');

    $name = trim($_POST['name'] ?? '');
    $html = $_POST['html'] ?? '';
    $meta = $_POST['meta'] ?? '';

    if ($name === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Falta el nombre de la plantilla']);
        exit;
    }
    if (trim($html) === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'No hay render que guardar']);
        exit;
    }

    // Slug seguro para nombre de carpeta: minusculas, sin acentos ni caracteres raros.
    $slug = strtolower($name);
    $slug = strtr($slug, ['á'=>'a','é'=>'e','í'=>'i','ó'=>'o','ú'=>'u','ñ'=>'n','ü'=>'u']);
    $slug = preg_replace('/[^a-z0-9]+/', '-', $slug);
    $slug = trim($slug, '-');
    if ($slug === '') $slug = 'plantilla';

    $baseDir = str_replace('\\', '/', __DIR__ . '/../documents/template');
    $dir     = $baseDir . '/' . $slug;

    if (!is_dir($dir) && !@mkdir($dir, 0777, true)) {
        $err = error_get_last();
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'No se pudo crear la carpeta: ' . ($err['message'] ?? 'IO error')]);
        exit;
    }

    // meta.json: guarda el nombre original (con acentos), el slug y la marca de tiempo.
    $metaArr = json_decode($meta, true);
    if (!is_array($metaArr)) $metaArr = [];
    $metaArr['name']      = $name;
    $metaArr['slug']      = $slug;
    $metaArr['savedAt']   = date('Y-m-d H:i:s');

    $okHtml = @file_put_contents($dir . '/template.html', $html);
    $okMeta = @file_put_contents($dir . '/meta.json', json_encode($metaArr, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT));

    if ($okHtml === false || $okMeta === false) {
        $err = error_get_last();
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'No se pudo escribir la plantilla: ' . ($err['message'] ?? 'IO error')]);
        exit;
    }

    echo json_encode([
        'success' => true,
        'message' => 'Plantilla guardada',
        'slug'    => $slug,
        'name'    => $name,
        'path'    => 'coffee/app/visor/documents/template/' . $slug
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

// Endpoint para LISTAR las plantillas guardadas (GET listtemplates).
// Devuelve cada carpeta de documents/template/ con su meta.json + el HTML del render.
if (($_GET['action'] ?? '') === 'listtemplates') {
    header('Content-Type: application/json; charset=utf-8');

    $baseDir   = str_replace('\\', '/', __DIR__ . '/../documents/template');
    $templates = [];

    if (is_dir($baseDir)) {
        $entries = @scandir($baseDir);
        foreach (($entries ?: []) as $e) {
            if ($e === '.' || $e === '..') continue;
            $dir = $baseDir . '/' . $e;
            $htmlFile = $dir . '/template.html';
            if (!is_dir($dir) || !is_file($htmlFile)) continue;

            $metaArr = [];
            if (is_file($dir . '/meta.json')) {
                $decoded = json_decode(@file_get_contents($dir . '/meta.json'), true);
                if (is_array($decoded)) $metaArr = $decoded;
            }
            $html = @file_get_contents($htmlFile);

            $templates[] = [
                'slug'    => $e,
                'name'    => $metaArr['name']    ?? $e,
                'title'   => $metaArr['title']   ?? ($metaArr['name'] ?? $e),
                'theme'   => $metaArr['theme']   ?? null,
                'themeLabel' => $metaArr['themeLabel'] ?? null,
                'agentKey'   => $metaArr['agentKey']   ?? null,
                'agentLabel' => $metaArr['agentLabel'] ?? null,
                'model'      => $metaArr['model']       ?? null,
                'prompt'     => $metaArr['prompt']      ?? '',
                'userText'   => $metaArr['userText']    ?? '',
                'isDoc'      => !empty($metaArr['isDoc']),
                'history'    => is_array($metaArr['history'] ?? null) ? $metaArr['history'] : [],
                'savedAt'    => $metaArr['savedAt'] ?? (is_file($htmlFile) ? date('Y-m-d H:i:s', filemtime($htmlFile)) : ''),
                'size'       => fmtSize(strlen((string)$html)),
                'html'       => (string)$html
            ];
        }
        usort($templates, function ($a, $b) { return strcmp($b['savedAt'], $a['savedAt']); });
    }

    echo json_encode(['success' => true, 'templates' => $templates], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

// Endpoint para navegar el filesystem (modal "Examinar..." del custom picker)
if (($_GET['action'] ?? '') === 'listdir') {
    header('Content-Type: application/json; charset=utf-8');

    $reqPath  = isset($_GET['path']) ? trim($_GET['path']) : '';
    $userHome = coffee_user_home();

    // Si no hay path → devolver drives (Windows) + atajos
    if ($reqPath === '') {
        $drives = [];
        if (stripos(PHP_OS, 'WIN') === 0) {
            foreach (range('A', 'Z') as $letter) {
                $d = $letter . ':/';
                if (@is_dir($d)) $drives[] = ['name' => $letter . ':', 'full' => $d];
            }
        } else {
            $drives[] = ['name' => '/', 'full' => '/'];
        }
        echo json_encode([
            'path'    => '',
            'parent'  => null,
            'drives'  => $drives,
            'home'    => $userHome,
            'dirs'    => []
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    $normalized = str_replace('\\', '/', $reqPath);
    $real       = realpath($normalized);
    if ($real === false || !is_dir($real)) {
        http_response_code(400);
        echo json_encode(['error' => 'Ruta no existe o no es carpeta', 'path' => $normalized]);
        exit;
    }
    $real = str_replace('\\', '/', $real);

    $entries = @scandir($real);
    $dirs    = [];
    if ($entries !== false) {
        foreach ($entries as $e) {
            if ($e === '.' || $e === '..') continue;
            $full = rtrim($real, '/') . '/' . $e;
            if (!is_dir($full)) continue;
            // saltar carpetas ocultas/inaccesibles silenciosamente
            $dirs[] = ['name' => $e, 'full' => $full];
        }
        usort($dirs, function ($a, $b) { return strcasecmp($a['name'], $b['name']); });
    }

    // Calcular parent (null si estamos en raiz de drive)
    $parent = null;
    if (preg_match('#^[A-Za-z]:/?$#', $real)) {
        $parent = '';
    } else {
        $p = dirname($real);
        $parent = ($p === $real) ? '' : str_replace('\\', '/', $p);
    }

    echo json_encode([
        'path'   => $real,
        'parent' => $parent,
        'home'   => $userHome,
        'dirs'   => $dirs
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

header('Content-Type: application/json; charset=utf-8');

$userHome    = coffee_user_home();
$CLAUDE_HOME = str_replace('\\', '/', $userHome) . '/.claude';

$PRESETS = [
    'agents' => [
        'label'      => 'Agentes',
        'path'       => $CLAUDE_HOME . '/agents',
        'subfolder'  => 'grimorios',
        'subLabel'   => 'Grimorios',
        'pathLabel'  => '.claude/agents',
        'relPrefix'  => '.claude/agents'
    ],
    'commands' => [
        'label'      => 'Comandos',
        'path'       => $CLAUDE_HOME . '/commands',
        'subfolder'  => null,
        'subLabel'   => null,
        'pathLabel'  => '.claude/commands',
        'relPrefix'  => '.claude/commands'
    ],
    'steering' => [
        'label'      => 'Steering',
        'path'       => $CLAUDE_HOME . '/steering',
        'subfolder'  => null,
        'subLabel'   => null,
        'pathLabel'  => '.claude/steering',
        'relPrefix'  => '.claude/steering'
    ],
    'grimoires' => [
        'label'      => 'Solo Grimorios',
        'path'       => $CLAUDE_HOME . '/agents/grimorios',
        'subfolder'  => null,
        'subLabel'   => null,
        'pathLabel'  => '.claude/agents/grimorios',
        'relPrefix'  => '.claude/agents/grimorios'
    ],
    'documents' => [
        'label'      => 'Documents',
        'path'       => __DIR__ . '/../documents',
        'subfolder'  => null,
        'subLabel'   => null,
        'pathLabel'  => 'coffee/app/visor/documents',
        'relPrefix'  => 'coffee/app/visor/documents',
        'mode'       => 'tree'
    ],
];

// Auto-descubrimiento: agrega un preset por cada carpeta de Drive compartida con el SA
function discoverDrivePresets() {
    try {
        require_once __DIR__ . '/drive-client.php';
        $drive = new DriveClient();
        $folders = $drive->listSharedFolders();
        $out = [];
        foreach ($folders as $f) {
            $out['drive:' . $f['id']] = [
                'label'         => 'Drive · ' . $f['name'],
                'path'          => 'drive://' . $f['name'],
                'subfolder'     => null,
                'subLabel'      => null,
                'pathLabel'     => 'Google Drive · ' . $f['name'],
                'relPrefix'     => 'drive/' . $f['id'],
                'mode'          => 'drive',
                'driveFolderId' => $f['id']
            ];
        }
        return $out;
    } catch (Throwable $e) {
        return [];
    }
}
$PRESETS = array_merge($PRESETS, discoverDrivePresets());

$folderKey  = isset($_GET['folder']) ? trim($_GET['folder']) : 'agents';
$customPath = isset($_GET['path'])   ? trim($_GET['path'])   : '';

function presetList($presets) {
    $out = [];
    foreach ($presets as $key => $p) {
        $isDrive = ($p['mode'] ?? '') === 'drive';
        $out[] = [
            'key'      => $key,
            'label'    => $p['label'],
            'path'     => $p['path'],
            'exists'   => $isDrive ? true : is_dir($p['path'])
        ];
    }
    return $out;
}

function parseFrontmatter($raw) {
    $fm = [
        'name'        => null, 'description' => null, 'model' => null,
        'type'        => null, 'project'     => null,
        'status'      => null, 'date'        => null
    ];
    if (preg_match('/^---\r?\n(.*?)\r?\n---/s', $raw, $m)) {
        $block = $m[1];
        foreach (explode("\n", $block) as $line) {
            if (preg_match('/^([\w-]+):\s*(.+?)\s*$/', $line, $kv)) {
                $key = $kv[1];
                $val = trim($kv[2], " \t\"'");
                if (array_key_exists($key, $fm)) $fm[$key] = $val;
            }
        }
    }
    return $fm;
}

function fmtSize($bytes) {
    if ($bytes < 1024)         return $bytes . ' B';
    if ($bytes < 1024 * 1024)  return round($bytes / 1024) . ' KB';
    return round($bytes / (1024 * 1024), 1) . ' MB';
}

function readSection($dir, $section, $relPrefix, $exts = ['md']) {
    $items = [];
    if (!is_dir($dir)) return $items;
    $files = scandir($dir);
    if ($files === false) return $items;

    foreach ($files as $f) {
        if ($f === '.' || $f === '..') continue;
        $full = $dir . '/' . $f;
        if (is_dir($full))                continue;
        $ext = strtolower(pathinfo($f, PATHINFO_EXTENSION));
        if (!in_array($ext, $exts, true)) continue;

        $raw = file_get_contents($full);
        if ($raw === false) continue;

        // Solo .md/.markdown ocultan la extension en el display name
        $name = in_array($ext, ['md', 'markdown'], true)
            ? preg_replace('/\.(md|markdown)$/i', '', $f)
            : $f;

        $items[] = [
            'name'        => $name,
            'file'        => $f,
            'section'     => $section,
            'size'        => fmtSize(filesize($full)),
            'isBackup'    => (stripos($name, 'backup') !== false),
            'frontmatter' => parseFrontmatter($raw),
            'raw'         => $raw,
            'mtime'       => date('Y-m-d H:i:s', filemtime($full)),
            'fullPath'    => str_replace('\\', '/', $full),
            'relPath'     => $relPrefix . '/' . $f
        ];
    }

    usort($items, function ($a, $b) {
        return strcasecmp($a['name'], $b['name']);
    });

    return $items;
}

function readDocumentsTree($baseDir, $relPrefix) {
    $documents = [];
    if (!is_dir($baseDir)) return $documents;

    $projects = scandir($baseDir);
    if ($projects === false) return $documents;
    sort($projects);

    foreach ($projects as $proj) {
        if ($proj === '.' || $proj === '..') continue;
        $projPath = $baseDir . '/' . $proj;
        if (!is_dir($projPath)) continue;

        $types = [];
        $uncategorized = [];
        $entries = scandir($projPath);
        if ($entries === false) continue;

        foreach ($entries as $entry) {
            if ($entry === '.' || $entry === '..') continue;
            $entryPath = $projPath . '/' . $entry;

            if (is_dir($entryPath)) {
                $files = scandir($entryPath);
                if ($files === false) continue;
                $typeItems = [];
                foreach ($files as $f) {
                    if (substr($f, -3) !== '.md') continue;
                    $full = $entryPath . '/' . $f;
                    if (!is_file($full)) continue;
                    $raw = file_get_contents($full);
                    if ($raw === false) continue;
                    $name = preg_replace('/\.md$/', '', $f);
                    $typeItems[] = [
                        'name'        => $name,
                        'file'        => $f,
                        'section'     => 'documents',
                        'size'        => fmtSize(filesize($full)),
                        'isBackup'    => (stripos($name, 'backup') !== false),
                        'frontmatter' => parseFrontmatter($raw),
                        'raw'         => $raw,
                        'mtime'       => date('Y-m-d H:i:s', filemtime($full)),
                        'fullPath'    => str_replace('\\', '/', $full),
                        'relPath'     => $relPrefix . '/' . $proj . '/' . $entry . '/' . $f,
                        'project'     => $proj,
                        'type'        => $entry
                    ];
                }
                usort($typeItems, function ($a, $b) {
                    return strcasecmp($a['name'], $b['name']);
                });
                if (count($typeItems)) $types[$entry] = $typeItems;
            } else if (substr($entry, -3) === '.md') {
                $full = $entryPath;
                if (!is_file($full)) continue;
                $raw = file_get_contents($full);
                if ($raw === false) continue;
                $name = preg_replace('/\.md$/', '', $entry);
                $uncategorized[] = [
                    'name'        => $name,
                    'file'        => $entry,
                    'section'     => 'documents',
                    'size'        => fmtSize(filesize($full)),
                    'isBackup'    => (stripos($name, 'backup') !== false),
                    'frontmatter' => parseFrontmatter($raw),
                    'raw'         => $raw,
                    'mtime'       => date('Y-m-d H:i:s', filemtime($full)),
                    'fullPath'    => str_replace('\\', '/', $full),
                    'relPath'     => $relPrefix . '/' . $proj . '/' . $entry,
                    'project'     => $proj,
                    'type'        => '(sin clasificar)'
                ];
            }
        }

        if (count($uncategorized)) {
            usort($uncategorized, function ($a, $b) {
                return strcasecmp($a['name'], $b['name']);
            });
            $types['(sin clasificar)'] = $uncategorized;
        }

        if (count($types)) {
            uksort($types, function ($a, $b) {
                if ($a === '(sin clasificar)') return 1;
                if ($b === '(sin clasificar)') return -1;
                return strcasecmp($a, $b);
            });
            $documents[$proj] = $types;
        }
    }

    return $documents;
}

function readDriveTree($relPrefix, $folderId) {
    require_once __DIR__ . '/drive-client.php';
    $drive = new DriveClient();
    $documents = [];

    $rootChildren = $drive->listChildren($folderId, 'all');
    $rootFolders  = [];
    $rootLoose    = [];
    foreach ($rootChildren as $c) {
        if (($c['mimeType'] ?? '') === DRIVE_FOLDER_MIME) $rootFolders[] = $c;
        else                                              $rootLoose[]   = $c;
    }

    // Lazy: solo metadatos. El contenido se descarga bajo demanda via ?action=driveread
    $buildFile = function ($f, $projectName, $typeName, $relPrefix) {
        $name = $f['name'];
        $displayName = preg_replace('/\.md$/', '', $name);
        return [
            'name'        => $displayName,
            'file'        => $name,
            'section'     => 'documents',
            'size'        => fmtSize($f['size'] ?? 0),
            'isBackup'    => (stripos($displayName, 'backup') !== false),
            'frontmatter' => ['name' => null, 'description' => null, 'model' => null, 'type' => null, 'project' => null, 'status' => null, 'date' => null],
            'raw'         => '',
            'lazyDrive'   => true,
            'mtime'       => isset($f['modifiedTime']) ? date('Y-m-d H:i:s', strtotime($f['modifiedTime'])) : '',
            'fullPath'    => 'drive://' . $f['id'],
            'relPath'     => $relPrefix . '/' . $projectName . '/' . $typeName . '/' . $name,
            'project'     => $projectName,
            'type'        => $typeName,
            'driveId'     => $f['id'],
            'mimeType'    => $f['mimeType'] ?? ''
        ];
    };

    // Archivos sueltos en la raiz → pseudo-proyecto "(general)" / pseudo-tipo "(sin clasificar)"
    if (!empty($rootLoose)) {
        $items = [];
        foreach ($rootLoose as $f) {
            $items[] = $buildFile($f, '(general)', '(sin clasificar)', $relPrefix);
        }
        usort($items, function ($a, $b) { return strcasecmp($a['name'], $b['name']); });
        $documents['(general)'] = ['(sin clasificar)' => $items];
    }

    // Proyectos reales (carpetas en root)
    foreach ($rootFolders as $proj) {
        $projChildren = $drive->listChildren($proj['id'], 'all');
        $typeFolders  = [];
        $projLoose    = [];
        foreach ($projChildren as $c) {
            if (($c['mimeType'] ?? '') === DRIVE_FOLDER_MIME) $typeFolders[] = $c;
            else                                              $projLoose[]   = $c;
        }

        $types = [];

        if (!empty($projLoose)) {
            $items = [];
            foreach ($projLoose as $f) {
                $items[] = $buildFile($f, $proj['name'], '(sin clasificar)', $relPrefix);
            }
            usort($items, function ($a, $b) { return strcasecmp($a['name'], $b['name']); });
            $types['(sin clasificar)'] = $items;
        }

        foreach ($typeFolders as $type) {
            $rawFiles = $drive->listChildren($type['id'], 'file');
            $items = [];
            foreach ($rawFiles as $f) {
                $items[] = $buildFile($f, $proj['name'], $type['name'], $relPrefix);
            }
            usort($items, function ($a, $b) { return strcasecmp($a['name'], $b['name']); });
            if (count($items)) $types[$type['name']] = $items;
        }

        if (count($types)) {
            uksort($types, function ($a, $b) {
                if ($a === '(sin clasificar)') return 1;
                if ($b === '(sin clasificar)') return -1;
                return strcasecmp($a, $b);
            });
            $documents[$proj['name']] = $types;
        }
    }

    return $documents;
}

if ($folderKey === 'custom' && $customPath !== '') {
    $normalized = str_replace('\\', '/', $customPath);
    $baseLabel  = basename($normalized);
    $rootDir    = $normalized;
    $subDir     = $normalized . '/grimorios';
    $subLabel   = 'grimorios';
    $pathLabel  = $normalized;
    $relPrefix  = $normalized;
    $activeKey  = 'custom';
    $activeLbl  = $baseLabel !== '' ? $baseLabel : 'Custom';
    $isValid    = is_dir($rootDir);
    $preset     = ['mode' => 'flat']; // evita warning en linea $mode = ($preset['mode'] ?? 'flat')
} else {
    // Migracion: la antigua key 'drive' apunta al primer preset Drive descubierto
    if ($folderKey === 'drive') {
        foreach (array_keys($PRESETS) as $k) {
            if (strpos($k, 'drive:') === 0) { $folderKey = $k; break; }
        }
    }
    if (!isset($PRESETS[$folderKey])) $folderKey = 'agents';
    $preset    = $PRESETS[$folderKey];
    $rootDir   = $preset['path'];
    $subDir    = $preset['subfolder'] ? $rootDir . '/' . $preset['subfolder'] : null;
    $subLabel  = $preset['subLabel'];
    $pathLabel = $preset['pathLabel'];
    $relPrefix = $preset['relPrefix'];
    $activeKey = $folderKey;
    $activeLbl = $preset['label'];
    // Drive no es filesystem — su validez se evalua al construir el arbol
    $isValid   = ($preset['mode'] ?? '') === 'drive' ? true : is_dir($rootDir);
}

$mode = ($preset['mode'] ?? 'flat');

if ($mode === 'drive') {
    try {
        $folderId = $preset['driveFolderId'] ?? null;
        if (!$folderId) throw new Exception('Preset Drive sin folderId');
        $documents = readDriveTree($relPrefix, $folderId);
        $valid = true;
        $errMsg = null;
    } catch (Throwable $e) {
        $documents = [];
        $valid = false;
        $errMsg = $e->getMessage();
    }
    $payload = [
        'header' => [
            'title'        => 'Visor de Agentes',
            'subtitle'     => 'CoffeeSoft Library',
            'user'         => ['initials' => 'RV', 'name' => 'Rosy V.', 'role' => 'Guardiana'],
            'pathLabel'    => $pathLabel,
            'source'       => 'Drive',
            'currentKey'   => $activeKey,
            'currentLabel' => $activeLbl,
            'currentPath'  => $rootDir,
            'valid'        => $valid,
            'presets'      => presetList($PRESETS),
            'sectionLabel' => null,
            'error'        => $errMsg
        ],
        'documents' => $documents,
        'agents'    => [],
        'grimoires' => []
    ];
} elseif ($mode === 'tree') {
    $documents = readDocumentsTree($rootDir, $relPrefix);
    $payload = [
        'header' => [
            'title'        => 'Visor de Agentes',
            'subtitle'     => 'CoffeeSoft Library',
            'user'         => ['initials' => 'RV', 'name' => 'Rosy V.', 'role' => 'Guardiana'],
            'pathLabel'    => $pathLabel,
            'source'       => 'Local',
            'currentKey'   => $activeKey,
            'currentLabel' => $activeLbl,
            'currentPath'  => str_replace('\\', '/', $rootDir),
            'valid'        => $isValid,
            'presets'      => presetList($PRESETS),
            'sectionLabel' => null
        ],
        'documents' => $documents,
        'agents'    => [],
        'grimoires' => []
    ];
} else {
    // En modo custom: aceptar todas las extensiones editables.
    // En presets (.claude/agents/commands/etc): solo .md como siempre.
    $sectionExts = ($folderKey === 'custom')
        ? ['md','markdown','txt','json','yml','yaml','toml','xml','csv','tsv',
           'html','htm','css','scss','js','ts','php','py','rb','go','rs',
           'java','c','cpp','cs','sh','sql','ini','conf','log','env','drawio','excalidraw']
        : ['md','drawio','excalidraw'];

    $agents    = readSection($rootDir, 'agentes', $relPrefix, $sectionExts);
    $grimoires = $subDir ? readSection($subDir, 'grimorios', $relPrefix . '/grimorios', $sectionExts) : [];

    // Carpetas + ruta padre (solo en modo custom — para navegacion)
    $folders    = [];
    $parentPath = null;
    if ($folderKey === 'custom' && is_dir($rootDir)) {
        $entries = @scandir($rootDir);
        if ($entries !== false) {
            foreach ($entries as $e) {
                if ($e === '.' || $e === '..') continue;
                if ($e[0] === '.') continue; // ocultar carpetas dotfiles
                $full = rtrim(str_replace('\\', '/', $rootDir), '/') . '/' . $e;
                if (is_dir($full)) $folders[] = ['name' => $e, 'fullPath' => $full];
            }
            usort($folders, function ($a, $b) { return strcasecmp($a['name'], $b['name']); });
        }
        $real = realpath($rootDir);
        if ($real !== false) {
            $real   = str_replace('\\', '/', $real);
            $parent = dirname($real);
            $parent = str_replace('\\', '/', $parent);
            if ($parent !== $real && !preg_match('#^[A-Za-z]:/?$#', $real)) {
                $parentPath = $parent;
            }
        }
    }
    $payload = [
        'header' => [
            'title'        => 'Visor de Agentes',
            'subtitle'     => 'CoffeeSoft Library',
            'user'         => ['initials' => 'RV', 'name' => 'Rosy V.', 'role' => 'Guardiana'],
            'pathLabel'    => $pathLabel,
            'source'       => 'Local',
            'currentKey'   => $activeKey,
            'currentLabel' => $activeLbl,
            'currentPath'  => str_replace('\\', '/', $rootDir),
            'parentPath'   => $parentPath,
            'valid'        => $isValid,
            'presets'      => presetList($PRESETS),
            'sectionLabel' => $subLabel
        ],
        'agents'    => $agents,
        'grimoires' => $grimoires,
        'folders'   => $folders
    ];
}

echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
