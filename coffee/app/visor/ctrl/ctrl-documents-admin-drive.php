<?php
/**
 * Controlador del Admin Docs — backend Google Drive (Service Account).
 * Mantiene el mismo contrato JSON que el JS consume.
 *
 * Acciones: list, mkdir, upload, rename, delete
 */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

require_once __DIR__ . '/drive-client.php';

$action = $_REQUEST['action'] ?? '';

function jsonResponse($ok, $msg, $data = []) {
    echo json_encode(array_merge(['success' => $ok, 'message' => $msg], $data), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function sanitizeName($name) {
    $name = preg_replace('/[^\w\s\-_áéíóúÁÉÍÓÚñÑ]/u', '', $name);
    $name = preg_replace('/\s+/', '_', trim($name));
    return substr($name, 0, 100);
}

function fmtSize($bytes) {
    $bytes = (int)$bytes;
    if ($bytes < 1024)        return $bytes . ' B';
    if ($bytes < 1024 * 1024) return round($bytes / 1024) . ' KB';
    return round($bytes / (1024 * 1024), 1) . ' MB';
}

function fmtMtime($iso) {
    if (!$iso) return '';
    $ts = strtotime($iso);
    return $ts ? date('Y-m-d H:i:s', $ts) : $iso;
}

try {
    $drive = new DriveClient();
} catch (Throwable $e) {
    jsonResponse(false, 'Drive no disponible: ' . $e->getMessage());
}

/* ── Helpers de resolucion por nombre ───────────────────── */

function findProject($drive, $name) {
    return $drive->findChildByName(DRIVE_ROOT_FOLDER_ID, $name, true);
}

function findType($drive, $projectId, $name) {
    return $drive->findChildByName($projectId, $name, true);
}

function findFile($drive, $typeId, $name) {
    return $drive->findChildByName($typeId, $name, false);
}

/* ── Acciones ───────────────────────────────────────────── */

try {
    switch ($action) {

        case 'list':
            $buildFiles = function ($items) {
                $files = [];
                foreach ($items as $f) {
                    $files[] = [
                        'id'    => $f['id'],
                        'name'  => $f['name'],
                        'size'  => fmtSize($f['size'] ?? 0),
                        'mtime' => fmtMtime($f['modifiedTime'] ?? ''),
                    ];
                }
                usort($files, function ($a, $b) { return strcasecmp($a['name'], $b['name']); });
                return $files;
            };

            $projects = [];

            // Particiona el root entre carpetas (proyectos) y archivos sueltos
            $rootChildren = $drive->listChildren(DRIVE_ROOT_FOLDER_ID, 'all');
            $rootFolders  = [];
            $rootLoose    = [];
            foreach ($rootChildren as $c) {
                if (($c['mimeType'] ?? '') === DRIVE_FOLDER_MIME) $rootFolders[] = $c;
                else                                              $rootLoose[]   = $c;
            }

            // Pseudo-proyecto "(general)" para archivos sueltos en la raiz
            if (!empty($rootLoose)) {
                $files = $buildFiles($rootLoose);
                $projects[] = [
                    'id'         => DRIVE_ROOT_FOLDER_ID,
                    'name'       => '(general)',
                    'isVirtual'  => true,
                    'totalFiles' => count($files),
                    'types'      => [[
                        'id'        => DRIVE_ROOT_FOLDER_ID,
                        'name'      => '(sin clasificar)',
                        'isVirtual' => true,
                        'files'     => $files,
                    ]],
                ];
            }

            foreach ($rootFolders as $proj) {
                $types      = [];
                $totalFiles = 0;

                $projChildren = $drive->listChildren($proj['id'], 'all');
                $typeFolders  = [];
                $projLoose    = [];
                foreach ($projChildren as $c) {
                    if (($c['mimeType'] ?? '') === DRIVE_FOLDER_MIME) $typeFolders[] = $c;
                    else                                              $projLoose[]   = $c;
                }

                // Pseudo-tipo "(sin clasificar)" para archivos sueltos dentro del proyecto
                if (!empty($projLoose)) {
                    $files = $buildFiles($projLoose);
                    $types[] = [
                        'id'        => $proj['id'],
                        'name'      => '(sin clasificar)',
                        'isVirtual' => true,
                        'files'     => $files,
                    ];
                    $totalFiles += count($files);
                }

                foreach ($typeFolders as $type) {
                    $rawFiles = $drive->listChildren($type['id'], 'file');
                    $files    = $buildFiles($rawFiles);
                    $types[]  = [
                        'id'    => $type['id'],
                        'name'  => $type['name'],
                        'files' => $files,
                    ];
                    $totalFiles += count($files);
                }

                usort($types, function ($a, $b) {
                    if ($a['name'] === '(sin clasificar)') return 1;
                    if ($b['name'] === '(sin clasificar)') return -1;
                    return strcasecmp($a['name'], $b['name']);
                });

                $projects[] = [
                    'id'         => $proj['id'],
                    'name'       => $proj['name'],
                    'totalFiles' => $totalFiles,
                    'types'      => $types,
                ];
            }

            usort($projects, function ($a, $b) {
                if ($a['name'] === '(general)') return 1;
                if ($b['name'] === '(general)') return -1;
                return strcasecmp($a['name'], $b['name']);
            });

            jsonResponse(true, 'OK', [
                'projects' => $projects,
                'rootId'   => DRIVE_ROOT_FOLDER_ID,
            ]);
            break;

        case 'mkdir':
            $target = $_POST['target'] ?? '';
            $name   = sanitizeName($_POST['name'] ?? '');
            if (!$name) jsonResponse(false, 'Nombre invalido');

            if ($target === 'project') {
                if ($drive->findChildByName(DRIVE_ROOT_FOLDER_ID, $name, true)) {
                    jsonResponse(false, 'Ya existe');
                }
                $drive->createFolder(DRIVE_ROOT_FOLDER_ID, $name);
                jsonResponse(true, 'Creado');

            } elseif ($target === 'type') {
                $projectName = sanitizeName($_POST['project'] ?? '');
                if (!$projectName) jsonResponse(false, 'Proyecto requerido');
                $project = findProject($drive, $projectName);
                if (!$project) jsonResponse(false, 'Proyecto no existe');
                if ($drive->findChildByName($project['id'], $name, true)) {
                    jsonResponse(false, 'Ya existe');
                }
                $drive->createFolder($project['id'], $name);
                jsonResponse(true, 'Creado');

            } else {
                jsonResponse(false, 'Target invalido');
            }
            break;

        case 'rename':
            $target  = $_POST['target']  ?? '';
            $oldName = sanitizeName($_POST['oldName'] ?? '');
            $newName = sanitizeName($_POST['newName'] ?? '');
            if (!$oldName || !$newName) jsonResponse(false, 'Nombres requeridos');
            if ($oldName === $newName)  jsonResponse(false, 'Mismo nombre');

            if ($target === 'type') {
                $projectName = sanitizeName($_POST['project'] ?? '');
                if (!$projectName) jsonResponse(false, 'Proyecto requerido');
                $project = findProject($drive, $projectName);
                if (!$project) jsonResponse(false, 'Proyecto no existe');
                $type = findType($drive, $project['id'], $oldName);
                if (!$type) jsonResponse(false, 'Tipo no existe');
                if ($drive->findChildByName($project['id'], $newName, true)) {
                    jsonResponse(false, 'Ya existe un destino con ese nombre');
                }
                $drive->renameItem($type['id'], $newName);
                jsonResponse(true, 'Renombrado');

            } elseif ($target === 'project') {
                $project = findProject($drive, $oldName);
                if (!$project) jsonResponse(false, 'Proyecto no existe');
                if ($drive->findChildByName(DRIVE_ROOT_FOLDER_ID, $newName, true)) {
                    jsonResponse(false, 'Ya existe un destino con ese nombre');
                }
                $drive->renameItem($project['id'], $newName);
                jsonResponse(true, 'Renombrado');

            } else {
                jsonResponse(false, 'Target invalido');
            }
            break;

        case 'upload':
            $projectName = sanitizeName($_POST['project'] ?? '');
            $typeName    = sanitizeName($_POST['type'] ?? '');
            if (!$projectName || !$typeName) jsonResponse(false, 'Proyecto y tipo requeridos');

            $project = findProject($drive, $projectName);
            if (!$project) jsonResponse(false, 'Proyecto no existe');
            $type = findType($drive, $project['id'], $typeName);
            if (!$type) jsonResponse(false, 'Tipo no existe');

            $files = $_FILES['files'] ?? [];
            if (empty($files['tmp_name'])) jsonResponse(false, 'Sin archivos');

            $maxSize = 20 * 1024 * 1024;
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

                // Resolver colisiones de nombre en Drive
                $counter = 1;
                while ($drive->findChildByName($type['id'], $safe, false)) {
                    $safe = $ext ? ($base . '_' . $counter . '.' . $ext) : ($base . '_' . $counter);
                    $counter++;
                }

                $mime = $files['type'][$i] ?? 'application/octet-stream';
                try {
                    $drive->uploadFile($type['id'], $safe, $tmp, $mime);
                    $results[] = ['name' => $safe, 'status' => 'success'];
                } catch (Throwable $e) {
                    $results[] = ['name' => $orig, 'status' => 'error', 'message' => $e->getMessage()];
                }
            }
            jsonResponse(true, 'Completado', ['results' => $results]);
            break;

        case 'delete':
            $target = $_POST['target'] ?? '';
            $id     = $_POST['id']     ?? '';

            // Borrado directo por ID (preferido — funciona con archivos sueltos virtuales)
            if ($id) {
                $drive->deleteItem($id);
                jsonResponse(true, ($target === 'file' ? 'Archivo eliminado' : 'Carpeta eliminada'));
            }

            $rawPath = trim($_POST['path'] ?? '', '/\\');
            if (!$rawPath) jsonResponse(false, 'Path o ID requerido');

            $parts = explode('/', $rawPath);
            $parts = array_map('sanitizeName', $parts);

            if ($target === 'file') {
                if (count($parts) !== 3) jsonResponse(false, 'Path invalido');
                [$projectName, $typeName, $fileName] = $parts;
                $project = findProject($drive, $projectName);
                if (!$project) jsonResponse(false, 'Proyecto no existe');
                $type = findType($drive, $project['id'], $typeName);
                if (!$type) jsonResponse(false, 'Tipo no existe');
                $file = findFile($drive, $type['id'], $fileName);
                if (!$file) jsonResponse(false, 'Archivo no existe');
                $drive->deleteItem($file['id']);
                jsonResponse(true, 'Archivo eliminado');

            } elseif ($target === 'folder') {
                if (count($parts) === 1) {
                    $project = findProject($drive, $parts[0]);
                    if (!$project) jsonResponse(false, 'Proyecto no existe');
                    $drive->deleteItem($project['id']);
                    jsonResponse(true, 'Carpeta eliminada');
                } elseif (count($parts) === 2) {
                    [$projectName, $typeName] = $parts;
                    $project = findProject($drive, $projectName);
                    if (!$project) jsonResponse(false, 'Proyecto no existe');
                    $type = findType($drive, $project['id'], $typeName);
                    if (!$type) jsonResponse(false, 'Tipo no existe');
                    $drive->deleteItem($type['id']);
                    jsonResponse(true, 'Carpeta eliminada');
                } else {
                    jsonResponse(false, 'Path invalido');
                }

            } else {
                jsonResponse(false, 'Target invalido');
            }
            break;

        default:
            jsonResponse(false, 'Accion no reconocida');
    }

} catch (DriveException $e) {
    jsonResponse(false, 'Drive error: ' . $e->getMessage());
} catch (Throwable $e) {
    jsonResponse(false, 'Error: ' . $e->getMessage());
}
