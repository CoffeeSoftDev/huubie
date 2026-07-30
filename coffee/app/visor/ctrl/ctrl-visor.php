<?php
header('Cache-Control: no-store');

require_once __DIR__ . '/path-helper.php';
require_once __DIR__ . '/../../ctrl/auth-session.php';
require_once __DIR__ . '/../../ctrl/auth-db.php';
require_once __DIR__ . '/../../ctrl/auth-helpers.php';

function coffee_visor_header_user() {
    $u = auth_current_user();
    if (!$u) return ['initials' => 'US', 'name' => 'Usuario', 'role' => 'Miembro'];
    return ['initials' => coffee_auth_initials($u['name']), 'name' => $u['name'], 'role' => 'Miembro'];
}

// ── Biblioteca POR USUARIO ──────────────────────────────────────────────────
// Cada cuenta tiene su propio arbol en documents/users/<id>/ y el visor solo
// lista y escribe dentro de esa carpeta: nadie ve ni toca los documentos de
// otro. Las carpetas de sistema (template/, module-template/, chats/) siguen
// colgando de documents/ porque no pertenecen a ningun usuario — las gestionan
// el Playground y el Forge con sus propios endpoints.
function coffee_visor_documents_base() {
    return rtrim(str_replace('\\', '/', __DIR__ . '/../documents'), '/');
}

// Identidad de la carpeta: el id numerico de la sesion. Sin sesion iniciada se
// cae a "_guest" en vez de a la raiz compartida, para que una peticion sin
// cookie nunca alcance los documentos de una cuenta real.
function coffee_visor_user_key() {
    $id = isset($_SESSION['user_id']) ? (int) $_SESSION['user_id'] : 0;
    return $id > 0 ? (string) $id : '_guest';
}

// Raiz de documentos del usuario en curso. Se crea al vuelo: una cuenta nueva
// entra al visor con su carpeta vacia, sin paso de alta manual.
function coffee_visor_docs_root() {
    $root = coffee_visor_documents_base() . '/users/' . coffee_visor_user_key();
    if (!is_dir($root)) @mkdir($root, 0775, true);
    return $root;
}

// Prefijo de los relPath que se exponen al frontend (clave de los iconos por
// archivo en data/icons.json).
function coffee_visor_docs_rel_prefix() {
    return 'coffee/app/visor/documents/users/' . coffee_visor_user_key();
}

// ── Carpeta compartida ──────────────────────────────────────────────────────
// documents/shared/ es el terreno comun: cuelga del arbol de TODOS los usuarios
// como un proyecto mas (en celeste, para que no se confunda con los propios) y
// todos pueden leer y escribir en ella. No vive dentro de ninguna biblioteca:
// es una raiz aparte que el sandbox autoriza explicitamente.
function coffee_visor_shared_name() {
    return 'Compartido';
}

function coffee_visor_shared_root() {
    $root = coffee_visor_documents_base() . '/shared';
    if (!is_dir($root)) @mkdir($root, 0775, true);
    return $root;
}

function coffee_visor_shared_rel_prefix() {
    return 'coffee/app/visor/documents/shared';
}

// Hojas de calculo que el visor renderiza con SheetJS. Son BINARIAS (salvo csv/tsv),
// asi que no pasan por 'save' ni por el editor de texto: entran por 'upload' y se
// leen por 'readbin'.
function coffee_visor_sheet_exts() {
    return ['xlsx', 'xlsm', 'xlsb', 'xls', 'ods', 'csv', 'tsv'];
}

// Hoja REALMENTE binaria: csv/tsv son texto y se siguen tratando como tal (se
// editan y viajan en el JSON del arbol); el resto solo se lee por readbin.
function coffee_visor_is_binary_sheet($fileName) {
    $ext = strtolower(pathinfo((string) $fileName, PATHINFO_EXTENSION));
    return in_array($ext, coffee_visor_sheet_exts(), true)
        && !in_array($ext, ['csv', 'tsv'], true);
}

// Medios que el visor previsualiza SIN convertir: imagenes (<img>) y PDF (<iframe>).
// Igual que las hojas binarias, sus bytes no viajan en el JSON del arbol: el
// frontend los pide por 'readbin', que los sirve con su Content-Type real para
// que el navegador los pinte inline.
function coffee_visor_image_exts() {
    return ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'avif', 'ico'];
}
function coffee_visor_pdf_exts() {
    return ['pdf'];
}
function coffee_visor_media_exts() {
    return array_merge(coffee_visor_image_exts(), coffee_visor_pdf_exts());
}

// Documentos de texto que se pueden SUBIR (arrastrandolos al explorador). Es la
// lista editable del visor menos todo lo ejecutable: documents/ cuelga del
// docroot de Apache, asi que un .php subido se serviria como codigo. Crear un
// .php desde el editor sigue siendo posible; subir uno, no.
function coffee_visor_text_upload_exts() {
    return [
        'md', 'markdown', 'txt', 'json', 'yml', 'yaml', 'toml', 'xml',
        'html', 'htm', 'css', 'scss', 'js', 'ts', 'sql', 'ini', 'conf',
        'log', 'env', 'sh', 'py', 'rb', 'go', 'rs', 'java', 'c', 'cpp',
        'cs', 'drawio', 'excalidraw'
    ];
}

// Todo lo que acepta ?action=upload: hojas + medios + texto.
function coffee_visor_upload_exts() {
    return array_merge(
        coffee_visor_sheet_exts(),
        coffee_visor_media_exts(),
        coffee_visor_text_upload_exts()
    );
}

// ¿El archivo entra en el arbol de la biblioteca? Lo que se puede subir se tiene
// que poder ver: si no, un .txt arrastrado desaparece del explorador.
function coffee_visor_tree_listable($fileName) {
    $ext = strtolower(pathinfo((string) $fileName, PATHINFO_EXTENSION));
    if (preg_match('/^todo.*\.json$/', strtolower((string) $fileName))) return true;
    return in_array($ext, coffee_visor_upload_exts(), true);
}

// Nombre con el que se muestra en el explorador: los .md pierden la extension
// (titulo del documento), todo.json se rotula TODO y el resto va tal cual.
function coffee_visor_tree_label($fileName) {
    $lower = strtolower((string) $fileName);
    if ($lower === 'todo.json') return 'TODO';
    if (preg_match('/\.(md|markdown)$/i', (string) $fileName)) {
        return preg_replace('/\.(md|markdown)$/i', '', (string) $fileName);
    }
    return (string) $fileName;
}

// Clase de medio del archivo por extension: 'image' | 'pdf' | '' (no es medio).
function coffee_visor_media_kind($fileName) {
    $ext = strtolower(pathinfo((string) $fileName, PATHINFO_EXTENSION));
    if (in_array($ext, coffee_visor_image_exts(), true)) return 'image';
    if (in_array($ext, coffee_visor_pdf_exts(), true))   return 'pdf';
    return '';
}

// Content-Type con el que 'readbin' sirve un medio. Sin el correcto el navegador
// descarga el archivo en vez de pintarlo dentro del visor.
function coffee_visor_media_mime($fileName) {
    $ext = strtolower(pathinfo((string) $fileName, PATHINFO_EXTENSION));
    $map = [
        'png'  => 'image/png',   'jpg'  => 'image/jpeg', 'jpeg' => 'image/jpeg',
        'gif'  => 'image/gif',   'webp' => 'image/webp', 'svg'  => 'image/svg+xml',
        'bmp'  => 'image/bmp',   'avif' => 'image/avif', 'ico'  => 'image/x-icon',
        'pdf'  => 'application/pdf'
    ];
    return isset($map[$ext]) ? $map[$ext] : 'application/octet-stream';
}

// Archivo cuyo contenido NO cabe (o no tiene sentido) en el JSON del arbol:
// hoja binaria o medio. Todos se leen despues por 'readbin'.
function coffee_visor_is_lazy_binary($fileName) {
    return coffee_visor_is_binary_sheet($fileName) || coffee_visor_media_kind($fileName) !== '';
}

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
        coffee_visor_docs_root(),
        coffee_visor_shared_root(),
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

    // Salvaguarda anti-sobrescritura: al CREAR un archivo nuevo (p. ej. un todo.json)
    // el cliente manda failIfExists=1. Si el archivo ya existe NO se pisa; se devuelve
    // exists=true para que el cliente abra el que ya estaba. Las ediciones normales
    // (guardado del documento) no mandan la bandera y sobrescriben como siempre.
    if (($_POST['failIfExists'] ?? '') === '1' && is_file($target)) {
        echo json_encode(['success' => false, 'exists' => true, 'message' => 'El archivo ya existe', 'fullPath' => $target]);
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

    $allowedExts = array_merge([
        'md','markdown','txt','json','yml','yaml','toml','xml','csv','tsv',
        'html','htm','css','scss','js','ts','php','py','rb','go','rs',
        'java','c','cpp','cs','sh','sql','ini','conf','log','env','drawio','excalidraw'
    ], coffee_visor_sheet_exts(), coffee_visor_media_exts());
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
        coffee_visor_docs_root(),
        coffee_visor_shared_root(),
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

// Endpoint para MOVER un archivo local a otra carpeta (POST move).
// Mismo sandbox que save/delete: el origen y la carpeta destino deben caer dentro
// de un root conocido. No sobrescribe si el destino ya tiene un archivo con ese nombre.
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST' && ($_POST['action'] ?? '') === 'move') {
    header('Content-Type: application/json; charset=utf-8');

    $fullPath   = trim($_POST['fullPath']   ?? '');
    $destDir    = trim($_POST['destDir']    ?? '');
    $customPath = trim($_POST['customPath'] ?? '');

    if ($fullPath === '' || $destDir === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'fullPath y destDir requeridos']);
        exit;
    }

    $allowedExts = array_merge([
        'md','markdown','txt','json','yml','yaml','toml','xml','csv','tsv',
        'html','htm','css','scss','js','ts','php','py','rb','go','rs',
        'java','c','cpp','cs','sh','sql','ini','conf','log','env','drawio','excalidraw'
    ], coffee_visor_sheet_exts(), coffee_visor_media_exts());
    $ext = strtolower(pathinfo($fullPath, PATHINFO_EXTENSION));
    if (!in_array($ext, $allowedExts, true)) {
        echo json_encode(['success' => false, 'message' => "Extension no movible: .$ext"]);
        exit;
    }

    $userHome    = coffee_user_home();
    $CLAUDE_HOME = str_replace('\\', '/', $userHome) . '/.claude';
    $allowedRoots = [
        $CLAUDE_HOME . '/agents',
        $CLAUDE_HOME . '/commands',
        $CLAUDE_HOME . '/steering',
        coffee_visor_docs_root(),
        coffee_visor_shared_root(),
    ];
    if ($customPath !== '') $allowedRoots[] = str_replace('\\', '/', $customPath);

    $insideSandbox = function ($absReal) use ($allowedRoots) {
        $absReal = rtrim(str_replace('\\', '/', $absReal), '/');
        foreach ($allowedRoots as $root) {
            $rootReal = realpath($root);
            if ($rootReal === false) continue;
            $rootReal = rtrim(str_replace('\\', '/', $rootReal), '/');
            if (strpos($absReal . '/', $rootReal . '/') === 0) return true;
        }
        return false;
    };

    // Origen: existe, es archivo y está dentro del sandbox.
    $srcReal = realpath(str_replace('\\', '/', $fullPath));
    if ($srcReal === false || !is_file($srcReal)) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'El archivo no existe']);
        exit;
    }
    if (!$insideSandbox($srcReal)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Origen fuera del sandbox del visor']);
        exit;
    }

    // Carpeta destino: existe, es directorio y está dentro del sandbox.
    $dstDirReal = realpath(str_replace('\\', '/', $destDir));
    if ($dstDirReal === false || !is_dir($dstDirReal)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'La carpeta destino no existe']);
        exit;
    }
    if (!$insideSandbox($dstDirReal)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Destino fuera del sandbox del visor']);
        exit;
    }

    $srcReal    = str_replace('\\', '/', $srcReal);
    $dstDirReal = rtrim(str_replace('\\', '/', $dstDirReal), '/');
    $dstFull    = $dstDirReal . '/' . basename($srcReal);

    if (dirname($srcReal) === $dstDirReal) {
        echo json_encode(['success' => true, 'moved' => false, 'message' => 'El archivo ya está en esa carpeta', 'fullPath' => $srcReal]);
        exit;
    }
    if (file_exists($dstFull)) {
        echo json_encode(['success' => false, 'message' => 'Ya existe un archivo con ese nombre en la carpeta destino']);
        exit;
    }
    if (!@rename($srcReal, $dstFull)) {
        $err = error_get_last();
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'No se pudo mover: ' . ($err['message'] ?? 'IO error')]);
        exit;
    }

    echo json_encode(['success' => true, 'moved' => true, 'message' => 'Archivo movido', 'fullPath' => $dstFull]);
    exit;
}

// Helper de sandbox reutilizable por mkdir/renamedir: ¿la ruta real cae dentro de
// un root permitido (agents/commands/steering, la biblioteca del usuario en curso,
// la carpeta compartida o el customPath activo)?
if (!function_exists('coffee_visor_inside_sandbox')) {
    function coffee_visor_inside_sandbox($absReal, $customPath = '') {
        $userHome    = coffee_user_home();
        $CLAUDE_HOME = str_replace('\\', '/', $userHome) . '/.claude';
        $roots = [
            $CLAUDE_HOME . '/agents',
            $CLAUDE_HOME . '/commands',
            $CLAUDE_HOME . '/steering',
            coffee_visor_docs_root(),
            coffee_visor_shared_root(),
        ];
        if ($customPath !== '') $roots[] = str_replace('\\', '/', $customPath);
        $absReal = rtrim(str_replace('\\', '/', $absReal), '/');
        foreach ($roots as $root) {
            $rootReal = realpath($root);
            if ($rootReal === false) continue;
            $rootReal = rtrim(str_replace('\\', '/', $rootReal), '/');
            if (strpos($absReal . '/', $rootReal . '/') === 0) return true;
        }
        return false;
    }
}

// Sanea un nombre de carpeta: sin separadores, sin ".."/"." y sin caracteres
// invalidos de Windows. Devuelve '' si no es utilizable.
if (!function_exists('coffee_visor_safe_name')) {
    function coffee_visor_safe_name($name) {
        $name = trim(str_replace(['/', '\\'], '', (string) $name));
        if ($name === '' || $name === '.' || $name === '..') return '';
        if (preg_match('/[<>:"|?*\\x00-\\x1F]/', $name)) return '';
        return mb_substr($name, 0, 120);
    }
}

// "Compartido" es el nombre con el que la carpeta comun se cuelga del arbol: una
// carpeta propia homonima en la raiz de la biblioteca quedaria tapada por ella y
// el usuario creeria que perdio sus archivos. Se reserva el nombre en ese nivel
// (dentro de un proyecto no hay conflicto y se permite).
if (!function_exists('coffee_visor_name_reserved_at')) {
    function coffee_visor_name_reserved_at($parentReal, $name) {
        $rootReal = realpath(coffee_visor_docs_root());
        if ($rootReal === false) return false;
        $parentReal = rtrim(str_replace('\\', '/', $parentReal), '/');
        $rootReal   = rtrim(str_replace('\\', '/', $rootReal), '/');
        return $parentReal === $rootReal
            && strcasecmp(trim($name), coffee_visor_shared_name()) === 0;
    }
}

// Endpoint para CREAR una carpeta dentro del sandbox (POST mkdir).
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST' && ($_POST['action'] ?? '') === 'mkdir') {
    header('Content-Type: application/json; charset=utf-8');

    $parentDir  = trim($_POST['parentDir']  ?? '');
    $customPath = trim($_POST['customPath'] ?? '');
    $name       = coffee_visor_safe_name($_POST['name'] ?? '');

    if ($parentDir === '' || $name === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Nombre de carpeta inválido']);
        exit;
    }

    $parentReal = realpath(str_replace('\\', '/', $parentDir));
    if ($parentReal === false || !is_dir($parentReal)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'La carpeta contenedora no existe']);
        exit;
    }
    if (!coffee_visor_inside_sandbox($parentReal, $customPath)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Ruta fuera del sandbox del visor']);
        exit;
    }

    if (coffee_visor_name_reserved_at($parentReal, $name)) {
        echo json_encode(['success' => false, 'message' => '"' . coffee_visor_shared_name() . '" es el nombre de la carpeta compartida: elige otro']);
        exit;
    }

    $newDir = rtrim(str_replace('\\', '/', $parentReal), '/') . '/' . $name;
    if (file_exists($newDir)) {
        echo json_encode(['success' => false, 'message' => 'Ya existe una carpeta con ese nombre']);
        exit;
    }
    if (!@mkdir($newDir, 0775)) {
        $err = error_get_last();
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'No se pudo crear la carpeta: ' . ($err['message'] ?? 'IO error')]);
        exit;
    }

    echo json_encode(['success' => true, 'message' => 'Carpeta creada', 'name' => $name, 'fullPath' => $newDir]);
    exit;
}

// Endpoint para RENOMBRAR una carpeta dentro del sandbox (POST renamedir).
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST' && ($_POST['action'] ?? '') === 'renamedir') {
    header('Content-Type: application/json; charset=utf-8');

    $fullPath   = trim($_POST['fullPath']   ?? '');
    $customPath = trim($_POST['customPath'] ?? '');
    $newName    = coffee_visor_safe_name($_POST['newName'] ?? '');

    if ($fullPath === '' || $newName === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Nombre inválido']);
        exit;
    }

    $dirReal = realpath(str_replace('\\', '/', $fullPath));
    if ($dirReal === false || !is_dir($dirReal)) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'La carpeta no existe']);
        exit;
    }
    if (!coffee_visor_inside_sandbox($dirReal, $customPath)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Ruta fuera del sandbox del visor']);
        exit;
    }

    // La carpeta compartida no es de nadie: nadie la renombra ni la reubica.
    $sharedReal = realpath(coffee_visor_shared_root());
    if ($sharedReal !== false && str_replace('\\', '/', $dirReal) === rtrim(str_replace('\\', '/', $sharedReal), '/')) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'La carpeta compartida no se puede renombrar']);
        exit;
    }

    $parent = rtrim(str_replace('\\', '/', dirname($dirReal)), '/');
    $target = $parent . '/' . $newName;
    if (coffee_visor_name_reserved_at($parent, $newName)) {
        echo json_encode(['success' => false, 'message' => '"' . coffee_visor_shared_name() . '" es el nombre de la carpeta compartida: elige otro']);
        exit;
    }
    if (str_replace('\\', '/', $dirReal) === $target) {
        echo json_encode(['success' => true, 'message' => 'Sin cambios', 'fullPath' => $target]);
        exit;
    }
    if (file_exists($target)) {
        echo json_encode(['success' => false, 'message' => 'Ya existe una carpeta con ese nombre']);
        exit;
    }
    if (!@rename($dirReal, $target)) {
        $err = error_get_last();
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'No se pudo renombrar: ' . ($err['message'] ?? 'IO error')]);
        exit;
    }

    echo json_encode(['success' => true, 'message' => 'Carpeta renombrada', 'name' => $newName, 'fullPath' => $target]);
    exit;
}

// Endpoint para RENOMBRAR un archivo dentro del sandbox (POST renamefile).
// Si el nombre nuevo no trae extensión se conserva la original; la extensión
// resultante se valida con la misma lista blanca de 'save' y NUNCA se pisa un
// archivo existente en el destino.
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST' && ($_POST['action'] ?? '') === 'renamefile') {
    header('Content-Type: application/json; charset=utf-8');

    $fullPath   = trim($_POST['fullPath']   ?? '');
    $customPath = trim($_POST['customPath'] ?? '');
    $newName    = coffee_visor_safe_name($_POST['newName'] ?? '');

    if ($fullPath === '' || $newName === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Nombre inválido']);
        exit;
    }

    $fileReal = realpath(str_replace('\\', '/', $fullPath));
    if ($fileReal === false || !is_file($fileReal)) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'El archivo no existe']);
        exit;
    }
    if (!coffee_visor_inside_sandbox($fileReal, $customPath)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Ruta fuera del sandbox del visor']);
        exit;
    }

    $allowedExts = array_merge([
        'md','markdown','txt','json','yml','yaml','toml','xml','csv','tsv',
        'html','htm','css','scss','js','ts','php','py','rb','go','rs',
        'java','c','cpp','cs','sh','sql','ini','conf','log','env','drawio','excalidraw'
    ], coffee_visor_sheet_exts(), coffee_visor_media_exts());
    $origExt = strtolower(pathinfo($fileReal, PATHINFO_EXTENSION));
    $newExt  = strtolower(pathinfo($newName, PATHINFO_EXTENSION));
    if ($newExt === '' && $origExt !== '') {
        $newName .= '.' . $origExt;   // "notas" -> "notas.md"
        $newExt   = $origExt;
    }
    if (!in_array($newExt, $allowedExts, true)) {
        echo json_encode(['success' => false, 'message' => "Extensión no permitida: .$newExt"]);
        exit;
    }

    $parent = rtrim(str_replace('\\', '/', dirname($fileReal)), '/');
    $target = $parent . '/' . $newName;
    if (str_replace('\\', '/', $fileReal) === $target) {
        echo json_encode(['success' => true, 'message' => 'Sin cambios', 'name' => $newName, 'fullPath' => $target]);
        exit;
    }
    if (file_exists($target)) {
        echo json_encode(['success' => false, 'message' => 'Ya existe un archivo con ese nombre']);
        exit;
    }
    if (!@rename($fileReal, $target)) {
        $err = error_get_last();
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'No se pudo renombrar: ' . ($err['message'] ?? 'IO error')]);
        exit;
    }

    echo json_encode(['success' => true, 'message' => 'Archivo renombrado', 'name' => $newName, 'fullPath' => $target]);
    exit;
}

// Endpoint para ELIMINAR una carpeta y todo su contenido (POST deletedir).
// Mismo sandbox que el resto. Se niega a borrar una RAIZ (la biblioteca del
// usuario, .claude/agents, la carpeta conectada): vaciarlas de un clic seria
// catastrofico y ninguna se puede recuperar desde el visor. La raiz compartida
// SI se puede borrar — es una peticion explicita — pero el backend la vuelve a
// crear vacia en la siguiente carga, asi que el efecto real es vaciarla.
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST' && ($_POST['action'] ?? '') === 'deletedir') {
    header('Content-Type: application/json; charset=utf-8');

    $fullPath   = trim($_POST['fullPath']   ?? '');
    $customPath = trim($_POST['customPath'] ?? '');

    if ($fullPath === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'fullPath requerido']);
        exit;
    }

    $dirReal = realpath(str_replace('\\', '/', $fullPath));
    if ($dirReal === false || !is_dir($dirReal)) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'La carpeta no existe']);
        exit;
    }
    if (!coffee_visor_inside_sandbox($dirReal, $customPath)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Ruta fuera del sandbox del visor']);
        exit;
    }

    $dirReal    = rtrim(str_replace('\\', '/', $dirReal), '/');
    $sharedReal = realpath(coffee_visor_shared_root());
    $sharedReal = $sharedReal === false ? '' : rtrim(str_replace('\\', '/', $sharedReal), '/');
    $isShared   = ($sharedReal !== '' && $dirReal === $sharedReal);

    // Raices protegidas: borrarlas no es "eliminar una carpeta", es borrar la
    // biblioteca entera. La compartida se exceptua a proposito.
    $userHome    = coffee_user_home();
    $CLAUDE_HOME = str_replace('\\', '/', $userHome) . '/.claude';
    $protected   = [
        coffee_visor_docs_root(),
        coffee_visor_documents_base(),
        $CLAUDE_HOME . '/agents',
        $CLAUDE_HOME . '/commands',
        $CLAUDE_HOME . '/steering'
    ];
    if ($customPath !== '') $protected[] = $customPath;

    foreach ($protected as $root) {
        $rootReal = realpath($root);
        if ($rootReal === false) continue;
        if ($dirReal === rtrim(str_replace('\\', '/', $rootReal), '/')) {
            http_response_code(403);
            echo json_encode(['success' => false, 'message' => 'Esa es la carpeta raíz: no se puede eliminar desde el visor']);
            exit;
        }
    }

    // Borrado recursivo contando lo que se lleva por delante (el cliente ya
    // pregunto, pero el resumen deja claro que se perdio).
    $deleted = ['files' => 0, 'dirs' => 0];
    $rrmdir = function ($path) use (&$rrmdir, &$deleted) {
        foreach (array_diff(@scandir($path) ?: [], ['.', '..']) as $f) {
            $full = $path . '/' . $f;
            if (is_dir($full)) { $rrmdir($full); }
            else if (@unlink($full)) { $deleted['files']++; }
        }
        if (@rmdir($path)) { $deleted['dirs']++; return true; }
        return false;
    };

    if (!$rrmdir($dirReal)) {
        http_response_code(500);
        echo json_encode([
            'success' => false,
            'message' => 'No se pudo eliminar la carpeta (¿algún archivo abierto en otro programa?)',
            'deleted' => $deleted
        ]);
        exit;
    }

    echo json_encode([
        'success'  => true,
        'message'  => $isShared ? 'Carpeta compartida vaciada' : 'Carpeta eliminada',
        'isShared' => $isShared,
        'deleted'  => $deleted
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// Endpoint para MOVER una carpeta dentro de otra (POST movedir). Mismo sandbox.
// No permite mover una carpeta dentro de sí misma o de un descendiente (bucle).
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST' && ($_POST['action'] ?? '') === 'movedir') {
    header('Content-Type: application/json; charset=utf-8');

    $fullPath   = trim($_POST['fullPath']   ?? '');
    $destDir    = trim($_POST['destDir']    ?? '');
    $customPath = trim($_POST['customPath'] ?? '');

    if ($fullPath === '' || $destDir === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'fullPath y destDir requeridos']);
        exit;
    }

    $srcReal = realpath(str_replace('\\', '/', $fullPath));
    if ($srcReal === false || !is_dir($srcReal)) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'La carpeta no existe']);
        exit;
    }
    $dstDirReal = realpath(str_replace('\\', '/', $destDir));
    if ($dstDirReal === false || !is_dir($dstDirReal)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'La carpeta destino no existe']);
        exit;
    }
    if (!coffee_visor_inside_sandbox($srcReal, $customPath) || !coffee_visor_inside_sandbox($dstDirReal, $customPath)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Ruta fuera del sandbox del visor']);
        exit;
    }

    $srcReal    = str_replace('\\', '/', $srcReal);
    $dstDirReal = rtrim(str_replace('\\', '/', $dstDirReal), '/');

    // La raiz compartida se queda donde esta: moverla la sacaria del alcance de
    // los demas usuarios. Su CONTENIDO si se mueve libremente.
    $sharedReal = realpath(coffee_visor_shared_root());
    if ($sharedReal !== false && $srcReal === rtrim(str_replace('\\', '/', $sharedReal), '/')) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'La carpeta compartida no se puede mover']);
        exit;
    }

    // No mover una carpeta dentro de sí misma ni de un descendiente suyo.
    if ($dstDirReal === $srcReal || strpos($dstDirReal . '/', $srcReal . '/') === 0) {
        echo json_encode(['success' => false, 'message' => 'No puedes mover una carpeta dentro de sí misma']);
        exit;
    }

    $target = $dstDirReal . '/' . basename($srcReal);
    if (dirname($srcReal) === $dstDirReal) {
        echo json_encode(['success' => true, 'moved' => false, 'message' => 'La carpeta ya está ahí', 'fullPath' => $srcReal]);
        exit;
    }
    if (file_exists($target)) {
        echo json_encode(['success' => false, 'message' => 'Ya existe una carpeta con ese nombre en el destino']);
        exit;
    }
    if (!@rename($srcReal, $target)) {
        $err = error_get_last();
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'No se pudo mover la carpeta: ' . ($err['message'] ?? 'IO error')]);
        exit;
    }

    echo json_encode(['success' => true, 'moved' => true, 'message' => 'Carpeta movida', 'fullPath' => $target]);
    exit;
}

// Endpoint para SUBIR una hoja de calculo al sandbox (POST upload, multipart).
// A diferencia de 'save' el contenido llega en $_FILES —no en $_POST— porque son
// bytes binarios que no sobreviven a un campo de texto.
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST' && ($_POST['action'] ?? '') === 'upload') {
    header('Content-Type: application/json; charset=utf-8');

    $destDir    = trim($_POST['destDir']    ?? '');
    $customPath = trim($_POST['customPath'] ?? '');
    $overwrite  = ($_POST['overwrite'] ?? '') === '1';

    if ($destDir === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'destDir requerido']);
        exit;
    }

    $up = isset($_FILES['file']) && is_array($_FILES['file']) ? $_FILES['file'] : null;
    if ($up === null) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'No se recibió ningún archivo']);
        exit;
    }

    // php.ini puede rechazar el archivo antes de que llegue aqui (upload_max_filesize,
    // post_max_size): traducimos el codigo a un mensaje accionable.
    $upErr = isset($up['error']) ? (int) $up['error'] : UPLOAD_ERR_NO_FILE;
    if ($upErr !== UPLOAD_ERR_OK) {
        $errMap = [
            UPLOAD_ERR_INI_SIZE   => 'El archivo excede upload_max_filesize de php.ini',
            UPLOAD_ERR_FORM_SIZE  => 'El archivo excede el límite del formulario',
            UPLOAD_ERR_PARTIAL    => 'La subida quedó incompleta, vuelve a intentar',
            UPLOAD_ERR_NO_FILE    => 'No se recibió ningún archivo',
            UPLOAD_ERR_NO_TMP_DIR => 'Falta la carpeta temporal de PHP',
            UPLOAD_ERR_CANT_WRITE => 'PHP no pudo escribir el archivo temporal',
            UPLOAD_ERR_EXTENSION  => 'Una extensión de PHP bloqueó la subida'
        ];
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => $errMap[$upErr] ?? 'Error de subida']);
        exit;
    }
    if (!is_uploaded_file($up['tmp_name'])) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Origen inválido']);
        exit;
    }

    $name = coffee_visor_safe_name(basename(str_replace('\\', '/', $up['name'] ?? '')));
    if ($name === '') {
        echo json_encode(['success' => false, 'message' => 'Nombre de archivo inválido']);
        exit;
    }

    $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
    if (!in_array($ext, coffee_visor_upload_exts(), true)) {
        echo json_encode(['success' => false, 'message' => "Formato no permitido para subir: .$ext"]);
        exit;
    }
    // Doble red: aunque la extension final sea inocente, un "reporte.php.md" o un
    // ".htaccess" colado por un nombre raro no debe tocar disco.
    $lowerName = strtolower($name);
    if (preg_match('/\.(php\d?|phtml|phar|phps|cgi|pl|asp|aspx|jsp|exe|bat|cmd|dll)(\.|$)/', $lowerName)
        || strpos($lowerName, '.htaccess') !== false
        || strpos($lowerName, '.htpasswd') !== false) {
        echo json_encode(['success' => false, 'message' => 'Nombre de archivo no permitido']);
        exit;
    }

    $maxBytes = 25 * 1024 * 1024;
    if ((int) ($up['size'] ?? 0) > $maxBytes) {
        echo json_encode(['success' => false, 'message' => 'El archivo pesa más de 25 MB']);
        exit;
    }

    // Firma del archivo: la extension la pone el usuario, los bytes no mienten. Asi
    // no se cuela un ejecutable renombrado a .xlsx o a .png. Los formatos sin firma
    // fiable (.xls BIFF, csv/tsv, .ico, .bmp) se dejan pasar.
    $sigs = [
        'xlsx' => ['PK'],       'xlsm' => ['PK'],        'xlsb' => ['PK'], 'ods' => ['PK'],
        'png'  => ["\x89PNG"],  'jpg'  => ["\xFF\xD8\xFF"], 'jpeg' => ["\xFF\xD8\xFF"],
        'gif'  => ['GIF87a', 'GIF89a'],
        'pdf'  => ['%PDF-'],
        'webp' => ['RIFF'],     'avif' => ["\x00\x00\x00"]
    ];
    if (isset($sigs[$ext])) {
        $fh   = @fopen($up['tmp_name'], 'rb');
        $head = $fh ? fread($fh, 8) : '';
        if ($fh) fclose($fh);
        $ok = false;
        foreach ($sigs[$ext] as $sig) {
            if (strncmp($head, $sig, strlen($sig)) === 0) { $ok = true; break; }
        }
        if (!$ok) {
            echo json_encode(['success' => false, 'message' => "El archivo no es un .$ext válido (su contenido no corresponde al formato)"]);
            exit;
        }
    }
    // Un .svg es XML: se guarda tal cual pero se sirve con CSP sandbox (ver readbin).
    if ($ext === 'svg') {
        $head = (string) @file_get_contents($up['tmp_name'], false, null, 0, 1024);
        if (stripos($head, '<svg') === false && stripos($head, '<?xml') === false) {
            echo json_encode(['success' => false, 'message' => 'El archivo no es un .svg válido']);
            exit;
        }
    }

    $dirReal = realpath(str_replace('\\', '/', $destDir));
    if ($dirReal === false || !is_dir($dirReal)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'La carpeta destino no existe']);
        exit;
    }
    if (!coffee_visor_inside_sandbox($dirReal, $customPath)) {
        http_response_code(403);
        echo json_encode(['success' => false, 'message' => 'Carpeta destino fuera del sandbox del visor']);
        exit;
    }

    $dirReal = rtrim(str_replace('\\', '/', $dirReal), '/');
    $target  = $dirReal . '/' . $name;

    // Sin overwrite explicito no se pisa nada: el cliente pregunta y reintenta.
    if (is_file($target) && !$overwrite) {
        echo json_encode([
            'success' => false,
            'exists'  => true,
            'message' => 'Ya existe un archivo con ese nombre en la carpeta destino',
            'name'    => $name
        ]);
        exit;
    }

    if (!@move_uploaded_file($up['tmp_name'], $target)) {
        $err = error_get_last();
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'No se pudo guardar: ' . ($err['message'] ?? 'IO error')]);
        exit;
    }

    echo json_encode([
        'success'  => true,
        'message'  => 'Archivo subido',
        'name'     => $name,
        'fullPath' => $target,
        'size'     => fmtSize(filesize($target)),
        'mtime'    => date('Y-m-d H:i:s', filemtime($target))
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
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
    // Si el frontend manda un `slug` explicito (hilo activo: autoguardado sobre la
    // MISMA carpeta aunque cambie el titulo), se usa ese; si no, se deriva del nombre.
    $slugSrc = trim($_POST['slug'] ?? '');
    if ($slugSrc === '') $slugSrc = $name;
    $slug = strtolower($slugSrc);
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

    // Solo se persiste el HTML generado: nunca las imagenes adjuntas. Despojamos
    // el history de images/imagesPreview (base64) para no inflar meta.json.
    if (isset($metaArr['history']) && is_array($metaArr['history'])) {
        foreach ($metaArr['history'] as &$msg) {
            if (is_array($msg)) unset($msg['images'], $msg['imagesPreview']);
        }
        unset($msg);
    }

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
                // Parametros de transmutacion (modulo/entidad/pivote) que dejo el
                // Playground al mandar la plantilla al Studio. Null si nunca se transmuto.
                'transmute'  => is_array($metaArr['transmute'] ?? null) ? $metaArr['transmute'] : null,
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

// Endpoint para ELIMINAR una plantilla guardada (POST deletetemplate).
// Borra la carpeta documents/template/<slug>/ completa. El slug se sanea a
// nombre de carpeta simple y se valida que el destino quede dentro de la
// carpeta de plantillas (sin path traversal).
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST' && ($_POST['action'] ?? '') === 'deletetemplate') {
    header('Content-Type: application/json; charset=utf-8');

    $slug = basename(str_replace('\\', '/', trim($_POST['slug'] ?? '')));
    if ($slug === '' || $slug === '.' || $slug === '..') {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Slug inválido']);
        exit;
    }

    $baseDir  = str_replace('\\', '/', __DIR__ . '/../documents/template');
    $realBase = realpath($baseDir);
    $realDir  = realpath($baseDir . '/' . $slug);

    $insideBase = $realBase !== false && $realDir !== false
        && strpos(str_replace('\\', '/', $realDir), str_replace('\\', '/', $realBase) . '/') === 0;

    if (!$insideBase || !is_dir($realDir)) {
        http_response_code(404);
        echo json_encode(['success' => false, 'message' => 'Plantilla no encontrada']);
        exit;
    }

    $rrmdir = function ($path) use (&$rrmdir) {
        foreach (array_diff(@scandir($path) ?: [], ['.', '..']) as $f) {
            $full = $path . '/' . $f;
            is_dir($full) ? $rrmdir($full) : @unlink($full);
        }
        return @rmdir($path);
    };

    if (!$rrmdir($realDir)) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'No se pudo eliminar la plantilla']);
        exit;
    }

    echo json_encode(['success' => true, 'message' => 'Plantilla eliminada', 'slug' => $slug]);
    exit;
}

// ── Iconos elegidos a mano ──────────────────────────────────────────────
// El explorador deduce el icono del nombre del archivo, pero el usuario puede
// forzar uno con clic derecho. La eleccion se guarda en data/icons.json como
// { relPath: iconKey } y es COMPARTIDA (vive en el servidor, no en el navegador).
//
// La clave es el relPath que ya expone el listado ("coffee/app/visor/documents/
// Proyecto/Tipo/archivo.md"): unico y estable entre maquinas. Si el archivo se
// mueve o renombra pierde su override y vuelve al icono automatico.
//
// iconKey se valida contra esta lista blanca; debe coincidir con DOC_KINDS en
// visor.js. Agregar un tipo = una entrada aqui y otra alla.
function coffee_visor_icon_keys() {
    return ['chat', 'db', 'flow', 'feat', 'plan', 'idea', 'note', 'dash', 'log', 'bug', 'guide'];
}

function coffee_visor_icons_file() {
    return str_replace('\\', '/', __DIR__ . '/../data/icons.json');
}

function coffee_visor_read_icons() {
    $file = coffee_visor_icons_file();
    if (!is_file($file)) return [];
    $decoded = json_decode((string)@file_get_contents($file), true);
    if (!is_array($decoded)) return [];

    // Descarta claves que ya no esten en la lista blanca (p. ej. un tipo retirado
    // de DOC_KINDS): mejor caer al icono automatico que pintar una clase muerta.
    $valid = coffee_visor_icon_keys();
    return array_filter($decoded, function ($v) use ($valid) {
        return is_string($v) && in_array($v, $valid, true);
    });
}

function coffee_visor_write_icons($icons) {
    $file = coffee_visor_icons_file();
    $dir  = dirname($file);
    if (!is_dir($dir) && !@mkdir($dir, 0775, true)) return false;
    $json = json_encode($icons, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    return @file_put_contents($file, $json, LOCK_EX) !== false;
}

// GET listicons: el mapa completo, que el frontend cachea al arrancar.
if (($_GET['action'] ?? '') === 'listicons') {
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode([
        'success' => true,
        'icons'   => (object)coffee_visor_read_icons()
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

// POST seticon: fija el icono de un archivo. icon vacio = volver al automatico.
if (($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST' && ($_POST['action'] ?? '') === 'seticon') {
    header('Content-Type: application/json; charset=utf-8');

    $path = trim($_POST['path'] ?? '');
    $icon = trim($_POST['icon'] ?? '');

    // `path` solo se usa como clave del JSON (nunca toca el filesystem), pero se
    // acota para que nadie engorde el archivo con una clave arbitraria.
    if ($path === '' || strlen($path) > 512) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Ruta de archivo inválida']);
        exit;
    }
    if ($icon !== '' && !in_array($icon, coffee_visor_icon_keys(), true)) {
        http_response_code(400);
        echo json_encode(['success' => false, 'message' => 'Icono desconocido']);
        exit;
    }

    $icons = coffee_visor_read_icons();
    if ($icon === '') unset($icons[$path]);
    else              $icons[$path] = $icon;

    if (!coffee_visor_write_icons($icons)) {
        http_response_code(500);
        echo json_encode(['success' => false, 'message' => 'No se pudo guardar el icono']);
        exit;
    }

    echo json_encode([
        'success' => true,
        'message' => $icon === '' ? 'Icono automático restaurado' : 'Icono actualizado',
        'icons'   => (object)$icons
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

// Endpoint para leer el contenido de un archivo (usado por el modulo Chat)
if (($_GET['action'] ?? '') === 'read') {
    header('Content-Type: application/json; charset=utf-8');
    $fp = isset($_GET['fullPath']) ? trim($_GET['fullPath']) : '';
    if ($fp === '') {
        echo json_encode(['success' => false, 'message' => 'fullPath requerido']);
        exit;
    }
    $target = realpath(str_replace('\\', '/', $fp));
    if ($target === false || !is_file($target)) {
        echo json_encode(['success' => false, 'message' => 'Archivo no encontrado']);
        exit;
    }
    $content = file_get_contents($target);
    if ($content === false) {
        echo json_encode(['success' => false, 'message' => 'No se pudo leer el archivo']);
        exit;
    }
    echo json_encode([
        'success'  => true,
        'content'  => $content,
        'mtime'    => date('Y-m-d H:i:s', filemtime($target)),
        'size'     => filesize($target)
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

// Endpoint lazy-read BINARIO para hojas locales (.xlsx/.xls/.ods) y para los medios
// (imagenes y PDF). No devuelve JSON: los bytes crudos van al frontend. Las hojas
// las renderiza SheetJS (igual que 'driveread', mismo header X-Visor-Format); los
// medios se sirven con su Content-Type real para que la URL de este mismo endpoint
// se pueda usar directo en un <img src> o en el <iframe> del PDF.
if (($_GET['action'] ?? '') === 'readbin') {
    $fp         = isset($_GET['fullPath'])   ? trim($_GET['fullPath'])   : '';
    $customPath = isset($_GET['customPath']) ? trim($_GET['customPath']) : '';

    $fail = function ($msg, $code) {
        http_response_code($code);
        header('Content-Type: text/plain; charset=utf-8');
        echo '> ' . $msg;
        exit;
    };

    if ($fp === '') $fail('fullPath requerido', 400);

    $target = realpath(str_replace('\\', '/', $fp));
    if ($target === false || !is_file($target)) $fail('Archivo no encontrado', 404);
    if (!coffee_visor_inside_sandbox($target, $customPath)) $fail('Ruta fuera del sandbox del visor', 403);

    $ext       = strtolower(pathinfo($target, PATHINFO_EXTENSION));
    $mediaKind = coffee_visor_media_kind($target);
    if ($mediaKind === '' && !in_array($ext, coffee_visor_sheet_exts(), true)) {
        $fail("Extensión no soportada: .$ext", 400);
    }

    if ($mediaKind !== '') {
        // El navegador pinta el archivo dentro del visor (inline), no lo descarga.
        // nosniff + sandbox: un .svg es XML que puede traer <script>; servido asi
        // no ejecuta nada aunque se abra en una pestana suelta.
        header('Content-Type: ' . coffee_visor_media_mime($target));
        header('Content-Disposition: inline; filename="' . basename($target) . '"');
        header('X-Content-Type-Options: nosniff');
        header('X-Visor-Format: ' . $mediaKind);
        if ($ext === 'svg') header("Content-Security-Policy: sandbox; default-src 'none'; style-src 'unsafe-inline'");
    } else {
        header('Content-Type: application/octet-stream');
        header('X-Visor-Format: spreadsheet-binary');
    }
    header('Content-Length: ' . filesize($target));
    readfile($target);
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
    // Biblioteca privada del usuario en curso (documents/users/<id>). La clave del
    // preset sigue siendo 'documents': es la que el frontend guarda en localStorage.
    'documents' => [
        'label'      => 'Mis documentos',
        'path'       => coffee_visor_docs_root(),
        'subfolder'  => null,
        'subLabel'   => null,
        'pathLabel'  => coffee_visor_docs_rel_prefix(),
        'relPrefix'  => coffee_visor_docs_rel_prefix(),
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
        'status'      => null, 'date'        => null,
        // Marcador de las conversaciones de CoffeeIA guardadas en la carpeta
        // (ctrl-fs-notes.php): el explorador las pinta con icono de bot.
        'coffeeia'    => null
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

        // Los binarios (hojas, imagenes, PDF) no viajan en el JSON: van por readbin.
        $isBin = coffee_visor_is_lazy_binary($f);
        $raw   = $isBin ? '' : file_get_contents($full);
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
            'lazyBinary'  => $isBin,
            'mediaKind'   => coffee_visor_media_kind($f),
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

// Lee UN proyecto de la biblioteca (carpeta de primer nivel): sus subcarpetas son
// los "tipos" y los archivos que cuelgan sueltos caen en "(sin clasificar)".
// `$relPrefix` ya incluye el proyecto y `$projLabel` es el nombre con el que el
// arbol lo agrupa — no tienen que coincidir con la carpeta fisica, y de ahi que la
// carpeta compartida pueda colgar del arbol de todos sin vivir dentro de ninguno.
function readProjectTypes($projPath, $relPrefix, $projLabel) {
    $types = [];
    $uncategorized = [];
    $entries = is_dir($projPath) ? scandir($projPath) : false;
    if ($entries === false) return $types;

    foreach ($entries as $entry) {
        if ($entry === '.' || $entry === '..') continue;
        $entryPath = $projPath . '/' . $entry;

        if (is_dir($entryPath)) {
            $files = scandir($entryPath);
            if ($files === false) continue;
            $typeItems = [];
            foreach ($files as $f) {
                // Todo lo listable: .md, TODOs (todo*.json), hojas, medios y el
                // resto de texto que el visor sabe abrir y que se puede subir.
                if (!coffee_visor_tree_listable($f)) continue;
                $full = $entryPath . '/' . $f;
                if (!is_file($full)) continue;
                // Los binarios no caben en el JSON del arbol (romperian json_encode):
                // el frontend pide sus bytes aparte con ?action=readbin.
                $isBin = coffee_visor_is_lazy_binary($f);
                $raw   = $isBin ? '' : file_get_contents($full);
                if ($raw === false) continue;
                $name = coffee_visor_tree_label($f);
                $typeItems[] = [
                    'name'        => $name,
                    'file'        => $f,
                    'section'     => 'documents',
                    'size'        => fmtSize(filesize($full)),
                    'isBackup'    => (stripos($name, 'backup') !== false),
                    'frontmatter' => parseFrontmatter($raw),
                    'raw'         => $raw,
                    'lazyBinary'  => $isBin,
                    'mediaKind'   => coffee_visor_media_kind($f),
                    'mtime'       => date('Y-m-d H:i:s', filemtime($full)),
                    'fullPath'    => str_replace('\\', '/', $full),
                    'relPath'     => $relPrefix . '/' . $entry . '/' . $f,
                    'project'     => $projLabel,
                    'type'        => $entry
                ];
            }
            usort($typeItems, function ($a, $b) {
                return strcasecmp($a['name'], $b['name']);
            });
            // Incluimos la sub-carpeta aunque esté vacía (explorador tipo Windows:
            // las carpetas recién creadas deben verse aunque no tengan archivos aún).
            $types[$entry] = $typeItems;
        } else if (coffee_visor_tree_listable($entry)) {
            $full = $entryPath;
            if (!is_file($full)) continue;
            $isBin = coffee_visor_is_lazy_binary($entry);
            $raw   = $isBin ? '' : file_get_contents($full);
            if ($raw === false) continue;
            $name = coffee_visor_tree_label($entry);
            $uncategorized[] = [
                'name'        => $name,
                'file'        => $entry,
                'section'     => 'documents',
                'size'        => fmtSize(filesize($full)),
                'isBackup'    => (stripos($name, 'backup') !== false),
                'frontmatter' => parseFrontmatter($raw),
                'raw'         => $raw,
                'lazyBinary'  => $isBin,
                'mediaKind'   => coffee_visor_media_kind($entry),
                'mtime'       => date('Y-m-d H:i:s', filemtime($full)),
                'fullPath'    => str_replace('\\', '/', $full),
                'relPath'     => $relPrefix . '/' . $entry,
                'project'     => $projLabel,
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

    uksort($types, function ($a, $b) {
        if ($a === '(sin clasificar)') return 1;
        if ($b === '(sin clasificar)') return -1;
        return strcasecmp($a, $b);
    });

    return $types;
}

function readDocumentsTree($baseDir, $relPrefix) {
    $documents = [];
    if (!is_dir($baseDir)) return $documents;

    $projects = scandir($baseDir);
    if ($projects === false) return $documents;
    sort($projects);

    // Carpetas de sistema dentro de documents/ (no son documentos del usuario):
    // se ocultan del explorador. 'template' y 'Chats' las gestionan el Playground/Chat,
    // 'module-template' el Forge, 'users' es el contenedor de las bibliotecas privadas
    // y 'shared' se inyecta aparte, con su nombre de carpeta compartida.
    $SYSTEM_DIRS = ['template', 'chats', 'module-template', 'users', 'shared'];

    foreach ($projects as $proj) {
        if ($proj === '.' || $proj === '..') continue;
        if (in_array(strtolower($proj), $SYSTEM_DIRS, true)) continue;
        $projPath = $baseDir . '/' . $proj;
        if (!is_dir($projPath)) continue;

        // Incluimos el proyecto aunque esté vacío (carpeta recién creada en la raíz).
        $documents[$proj] = readProjectTypes($projPath, $relPrefix . '/' . $proj, $proj);
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
            'title'        => 'CoffeeDocs',
            'subtitle'     => 'CoffeeSoft Library',
            'user'         => coffee_visor_header_user(),
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

    // La carpeta compartida se cuelga del arbol como un proyecto mas, pero su
    // contenido se lee de documents/shared. Va PRIMERA en el orden y el frontend
    // la pinta en celeste; `sharedFolder` en el header le dice cual es su ruta
    // real, porque no se puede derivar de currentPath como las demas.
    $sharedName = coffee_visor_shared_name();
    $sharedRoot = str_replace('\\', '/', coffee_visor_shared_root());
    if ($folderKey === 'documents') {
        unset($documents[$sharedName]);   // una carpeta propia homonima no la tapa
        $documents = array_merge(
            [$sharedName => readProjectTypes($sharedRoot, coffee_visor_shared_rel_prefix(), $sharedName)],
            $documents
        );
    }

    $payload = [
        'header' => [
            'title'        => 'CoffeeDocs',
            'subtitle'     => 'CoffeeSoft Library',
            'user'         => coffee_visor_header_user(),
            'pathLabel'    => $pathLabel,
            'source'       => 'Local',
            'currentKey'   => $activeKey,
            'currentLabel' => $activeLbl,
            'currentPath'  => str_replace('\\', '/', $rootDir),
            'valid'        => $isValid,
            'presets'      => presetList($PRESETS),
            'sectionLabel' => null,
            'sharedFolder' => ($folderKey === 'documents')
                ? ['name' => $sharedName, 'path' => $sharedRoot]
                : null
        ],
        'documents' => $documents,
        'agents'    => [],
        'grimoires' => []
    ];
} else {
    // En modo custom: aceptar todas las extensiones editables.
    // En presets (.claude/agents/commands/etc): solo .md como siempre.
    $sectionExts = ($folderKey === 'custom')
        ? array_merge(
            ['md','markdown','txt','json','yml','yaml','toml','xml','csv','tsv',
             'html','htm','css','scss','js','ts','php','py','rb','go','rs',
             'java','c','cpp','cs','sh','sql','ini','conf','log','env','drawio','excalidraw'],
            coffee_visor_sheet_exts(),
            coffee_visor_media_exts()
          )
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
                if (!is_dir($full)) continue;
                // Conteo de entradas visibles: alimenta la burbuja de la tarjeta.
                $count = 0;
                $inner = @scandir($full);
                if ($inner !== false) {
                    foreach ($inner as $child) {
                        if ($child === '.' || $child === '..' || $child[0] === '.') continue;
                        $count++;
                    }
                }
                $folders[] = ['name' => $e, 'fullPath' => $full, 'count' => $count];
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
            'title'        => 'CoffeeDocs',
            'subtitle'     => 'CoffeeSoft Library',
            'user'         => coffee_visor_header_user(),
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
