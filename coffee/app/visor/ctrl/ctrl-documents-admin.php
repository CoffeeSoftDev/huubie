<?php
header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$BASE_DIR = realpath(__DIR__ . '/../documents');
if ($BASE_DIR === false) {
    $BASE_DIR = __DIR__ . '/../documents';
    if (!is_dir($BASE_DIR)) {
        @mkdir($BASE_DIR, 0755, true);
    }
    $BASE_DIR = realpath($BASE_DIR);
}

$action = $_REQUEST['action'] ?? '';

function sanitizeName($name) {
    $name = preg_replace('/[^\w\s\-_áéíóúÁÉÍÓÚñÑ]/u', '', $name);
    $name = preg_replace('/\s+/', '_', trim($name));
    return substr($name, 0, 100);
}

function jsonResponse($ok, $msg, $data = []) {
    echo json_encode(array_merge(['success' => $ok, 'message' => $msg], $data), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function isInsideDocuments($path) {
    global $BASE_DIR;
    $base = realpath($BASE_DIR);
    if ($base === false) return false;

    // Si el path aun no existe (ej. mkdir), validar contra el directorio padre
    $real = realpath($path);
    if ($real !== false) {
        return strpos($real, $base) === 0;
    }

    // Para rutas que no existen todavia: construir path absoluto y validar
    $abs = str_replace('\\', '/', $path);
    $baseNorm = str_replace('\\', '/', $base);

    // Rechazar si contiene .. o componentes peligrosos
    if (strpos($abs, '..') !== false) return false;

    return strpos($abs, $baseNorm) === 0;
}

function fmtSize($bytes) {
    if ($bytes < 1024)         return $bytes . ' B';
    if ($bytes < 1024 * 1024)  return round($bytes / 1024) . ' KB';
    return round($bytes / (1024 * 1024), 1) . ' MB';
}

function deleteFolderRecursive($dir) {
    if (!is_dir($dir)) return false;
    $files = array_diff(scandir($dir), ['.', '..']);
    foreach ($files as $file) {
        $path = $dir . '/' . $file;
        is_dir($path) ? deleteFolderRecursive($path) : unlink($path);
    }
    return rmdir($dir);
}

switch ($action) {

    case 'list':
        $projects = [];
        if (!is_dir($BASE_DIR)) {
            jsonResponse(true, 'OK', ['projects' => $projects]);
        }
        $entries = scandir($BASE_DIR);
        if ($entries === false) jsonResponse(true, 'OK', ['projects' => $projects]);

        foreach ($entries as $proj) {
            if ($proj === '.' || $proj === '..') continue;
            $projPath = $BASE_DIR . '/' . $proj;
            if (!is_dir($projPath)) continue;

            $types = [];
            $totalFiles = 0;
            $typeEntries = scandir($projPath);
            if ($typeEntries === false) continue;

            foreach ($typeEntries as $type) {
                if ($type === '.' || $type === '..') continue;
                $typePath = $projPath . '/' . $type;
                if (!is_dir($typePath)) continue;

                $files = [];
                $fileEntries = scandir($typePath);
                if ($fileEntries === false) continue;

                foreach ($fileEntries as $f) {
                    if ($f === '.' || $f === '..') continue;
                    $full = $typePath . '/' . $f;
                    if (!is_file($full)) continue;
                    $files[] = [
                        'name'  => $f,
                        'size'  => fmtSize(filesize($full)),
                        'mtime' => date('Y-m-d H:i:s', filemtime($full))
                    ];
                }

                usort($files, function ($a, $b) { return strcasecmp($a['name'], $b['name']); });
                $types[] = ['name' => $type, 'files' => $files];
                $totalFiles += count($files);
            }

            usort($types, function ($a, $b) {
                if ($a['name'] === '(sin clasificar)') return 1;
                if ($b['name'] === '(sin clasificar)') return -1;
                return strcasecmp($a['name'], $b['name']);
            });
            $projects[] = ['name' => $proj, 'totalFiles' => $totalFiles, 'types' => $types];
        }

        usort($projects, function ($a, $b) { return strcasecmp($a['name'], $b['name']); });
        jsonResponse(true, 'OK', ['projects' => $projects]);
        break;

    case 'mkdir':
        $target = $_POST['target'] ?? '';
        $name   = sanitizeName($_POST['name'] ?? '');
        if (!$name) jsonResponse(false, 'Nombre invalido');

        if ($target === 'project') {
            $path = $BASE_DIR . '/' . $name;
        } elseif ($target === 'type') {
            $project = sanitizeName($_POST['project'] ?? '');
            if (!$project) jsonResponse(false, 'Proyecto requerido');
            $path = $BASE_DIR . '/' . $project . '/' . $name;
        } else {
            jsonResponse(false, 'Target invalido');
        }

        if (!isInsideDocuments($path)) jsonResponse(false, 'Ruta no permitida');
        if (is_dir($path)) jsonResponse(false, 'Ya existe');
        mkdir($path, 0755, true) ? jsonResponse(true, 'Creado') : jsonResponse(false, 'Error al crear');
        break;

    case 'rename':
        $target  = $_POST['target']  ?? '';
        $oldName = sanitizeName($_POST['oldName'] ?? '');
        $newName = sanitizeName($_POST['newName'] ?? '');
        if (!$oldName || !$newName) jsonResponse(false, 'Nombres requeridos');
        if ($oldName === $newName)  jsonResponse(false, 'Mismo nombre');

        if ($target === 'type') {
            $project = sanitizeName($_POST['project'] ?? '');
            if (!$project) jsonResponse(false, 'Proyecto requerido');
            $oldPath = $BASE_DIR . '/' . $project . '/' . $oldName;
            $newPath = $BASE_DIR . '/' . $project . '/' . $newName;
        } elseif ($target === 'project') {
            $oldPath = $BASE_DIR . '/' . $oldName;
            $newPath = $BASE_DIR . '/' . $newName;
        } else {
            jsonResponse(false, 'Target invalido');
        }

        if (!isInsideDocuments($oldPath) || !isInsideDocuments($newPath)) jsonResponse(false, 'Ruta no permitida');
        if (!is_dir($oldPath)) jsonResponse(false, 'No existe');
        if (is_dir($newPath)) jsonResponse(false, 'Ya existe un destino con ese nombre');
        rename($oldPath, $newPath) ? jsonResponse(true, 'Renombrado') : jsonResponse(false, 'Error al renombrar');
        break;

    case 'upload':
        $project = sanitizeName($_POST['project'] ?? '');
        $type    = sanitizeName($_POST['type'] ?? '');
        if (!$project || !$type) jsonResponse(false, 'Proyecto y tipo requeridos');

        $targetDir = $BASE_DIR . '/' . $project . '/' . $type;
        if (!isInsideDocuments($targetDir)) jsonResponse(false, 'Ruta no permitida');
        if (!is_dir($targetDir)) jsonResponse(false, 'Tipo no existe');

        $files = $_FILES['files'] ?? [];
        if (empty($files['tmp_name'])) jsonResponse(false, 'Sin archivos');

        $maxSize = 20 * 1024 * 1024; // 20MB
        $results = [];
        foreach ($files['tmp_name'] as $i => $tmp) {
            if ($tmp === '') continue;
            $orig = $files['name'][$i];
            if ($files['size'][$i] > $maxSize) {
                $results[] = ['name' => $orig, 'status' => 'error', 'message' => 'Maximo 20MB'];
                continue;
            }
            $ext  = strtolower(pathinfo($orig, PATHINFO_EXTENSION));
            $ext  = preg_replace('/[^a-z0-9]/i', '', $ext);
            $base = sanitizeName(pathinfo($orig, PATHINFO_FILENAME));
            if (!$base) $base = 'archivo';
            $safe = $ext ? ($base . '.' . $ext) : $base;
            $dest = $targetDir . '/' . $safe;
            $counter = 1;
            while (file_exists($dest)) {
                $safe = $ext ? ($base . '_' . $counter . '.' . $ext) : ($base . '_' . $counter);
                $dest = $targetDir . '/' . $safe;
                $counter++;
            }
            move_uploaded_file($tmp, $dest)
                ? $results[] = ['name' => $safe, 'status' => 'success']
                : $results[] = ['name' => $orig, 'status' => 'error', 'message' => 'Error al mover'];
        }
        jsonResponse(true, 'Completado', ['results' => $results]);
        break;

    case 'delete':
        $target  = $_POST['target'] ?? '';
        $rawPath = $_POST['path'] ?? '';
        $path = realpath($BASE_DIR . '/' . ltrim($rawPath, '/\\'));

        if (!$path || !isInsideDocuments($path)) jsonResponse(false, 'Ruta no permitida');
        if ($path === realpath($BASE_DIR)) jsonResponse(false, 'No puede eliminar la raiz');

        if ($target === 'file' && is_file($path)) {
            unlink($path) ? jsonResponse(true, 'Archivo eliminado') : jsonResponse(false, 'Error');
        } elseif ($target === 'folder' && is_dir($path)) {
            deleteFolderRecursive($path) ? jsonResponse(true, 'Carpeta eliminada') : jsonResponse(false, 'Error');
        } else {
            jsonResponse(false, 'Recurso no encontrado');
        }
        break;

    case 'save':
        $rawPath = $_POST['path'] ?? '';
        $content = $_POST['content'] ?? '';
        if (!$rawPath) jsonResponse(false, 'Ruta requerida');

        $path = $BASE_DIR . '/' . ltrim($rawPath, '/\\');
        if (!isInsideDocuments($path)) jsonResponse(false, 'Ruta no permitida');
        if (substr($path, -3) !== '.md') jsonResponse(false, 'Solo archivos .md');

        $dir = dirname($path);
        if (!is_dir($dir)) jsonResponse(false, 'Directorio no existe');

        $bytes = file_put_contents($path, $content, LOCK_EX);
        if ($bytes === false) jsonResponse(false, 'Error al guardar');
        jsonResponse(true, 'Guardado');
        break;

    case 'create_md':
        $project = sanitizeName($_POST['project'] ?? '');
        $type    = sanitizeName($_POST['type'] ?? '');
        $rawName = trim($_POST['name'] ?? '');
        if (!$project || !$type) jsonResponse(false, 'Proyecto y tipo requeridos');
        if ($rawName === '')     jsonResponse(false, 'Nombre requerido');

        // Sanitizar nombre y asegurar extension .md
        $base = preg_replace('/\.md$/i', '', $rawName);
        $base = sanitizeName($base);
        if (!$base) jsonResponse(false, 'Nombre invalido');
        $filename = $base . '.md';

        $typeDir = $BASE_DIR . '/' . $project . '/' . $type;
        if (!isInsideDocuments($typeDir)) jsonResponse(false, 'Ruta no permitida');
        if (!is_dir($typeDir))             jsonResponse(false, 'Tipo no existe');

        $path = $typeDir . '/' . $filename;
        if (file_exists($path)) jsonResponse(false, 'Ya existe un archivo con ese nombre');

        // Plantilla minima con frontmatter
        $today   = date('Y-m-d');
        $title   = $base;
        $content = "---\n" .
                   "name: {$title}\n" .
                   "description: \n" .
                   "date: {$today}\n" .
                   "---\n\n" .
                   "# {$title}\n\n";

        $bytes = file_put_contents($path, $content, LOCK_EX);
        if ($bytes === false) jsonResponse(false, 'Error al crear');

        jsonResponse(true, 'Documento creado', [
            'file'    => $filename,
            'relPath' => $project . '/' . $type . '/' . $filename
        ]);
        break;

    default:
        jsonResponse(false, 'Accion no reconocida');
}
