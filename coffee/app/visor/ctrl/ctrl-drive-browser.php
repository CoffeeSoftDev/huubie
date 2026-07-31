<?php
// Explorador de Google Drive del launcher: navega las carpetas compartidas con la
// cuenta de servicio y abre un documento en el visor sin cambiar de carpeta.
//
// Se diferencia del origen "Drive" del selector: aquel arma el arbol ENTERO de una
// carpeta (una peticion por subcarpeta, profundidad fija de 3 niveles) y sustituye
// la biblioteca abierta. Aqui se pide un nivel cada vez, no hay tope de profundidad
// y lo que estabas viendo se queda como estaba.
//
// Acciones (`action` por POST o GET):
//   roots   -> carpetas compartidas con la cuenta de servicio (las "unidades")
//   list    -> hijos de una carpeta: subcarpetas y archivos, ya clasificados
//   search  -> busca por nombre dentro de una unidad (o en todo lo accesible)
//   preview -> primeras lineas de un archivo de texto, para el panel de vista previa
//
// El contenido completo NO se sirve aqui: al abrir, el visor usa el endpoint
// `driveread` de ctrl-visor.php que ya sabe exportar Google Docs y hojas.
require_once __DIR__ . '/../../ctrl/auth-session.php';
require_once __DIR__ . '/drive-client.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

const DRV_PREVIEW_BYTES = 1800;   // lo que cabe en el panel de vista previa

function drv_fail($msg, $code = 400) {
    http_response_code($code);
    echo json_encode(['success' => false, 'message' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}

// Sin sesion no se navega Drive: las carpetas compartidas son de la instalacion,
// no del publico.
if (empty($_SESSION['user_id'])) {
    drv_fail('Sesion requerida', 401);
}

// Clasifica un archivo por lo que el visor sabe hacer con el. `kind` decide el
// icono y `openable` si el boton Abrir se enciende — mismas reglas que aplica
// `driveread` al servir el contenido, para no ofrecer lo que luego no abre.
function drv_kind($mime, $name) {
    if ($mime === DRIVE_FOLDER_MIME) return ['folder', false];

    $sheetMimes = [
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-excel',
        'application/vnd.oasis.opendocument.spreadsheet'
    ];
    $codeMimes = ['application/json', 'application/javascript', 'application/x-javascript', 'application/xml', 'application/sql'];

    if ($mime === 'application/vnd.google-apps.document')    return ['gdoc',   true];
    if ($mime === 'application/vnd.google-apps.spreadsheet') return ['gsheet', true];
    if (in_array($mime, $sheetMimes, true))                  return ['sheet',  true];
    if (strpos($mime, 'text/') === 0)                        return ['text',   true];
    if (in_array($mime, $codeMimes, true))                   return ['text',   true];

    // Google Slides, Forms, PDF, imagenes: se listan (para no mentir sobre lo que
    // hay en la carpeta) pero el visor no los pinta desde Drive.
    if (strpos($mime, 'application/vnd.google-apps.') === 0) return ['gapp', false];
    if (strpos($mime, 'image/') === 0)                       return ['image', false];
    if ($mime === 'application/pdf')                         return ['pdf',   false];

    // Sin mime util, decide la extension: Drive marca muchos .md como octet-stream.
    $ext = strtolower(pathinfo((string) $name, PATHINFO_EXTENSION));
    if (in_array($ext, ['md','markdown','txt','json','yml','yaml','csv','xml','sql','js','ts','php','py','css','html','log','ini','conf','drawio','excalidraw'], true)) {
        return ['text', true];
    }
    return ['other', false];
}

function drv_size($bytes) {
    $bytes = (int) $bytes;
    if ($bytes <= 0)          return '';
    if ($bytes < 1024)        return $bytes . ' B';
    if ($bytes < 1048576)     return round($bytes / 1024) . ' KB';
    return round($bytes / 1048576, 1) . ' MB';
}

// Ficha de un archivo para la lista. `driveId` y `mimeType` son lo que el visor
// necesita para abrirlo despues con driveread.
function drv_entry($f) {
    list($kind, $openable) = drv_kind($f['mimeType'] ?? '', $f['name'] ?? '');
    return [
        'id'       => $f['id'],
        'name'     => $f['name'],
        'mimeType' => $f['mimeType'] ?? '',
        'kind'     => $kind,
        'isFolder' => $kind === 'folder',
        'openable' => $openable,
        'size'     => drv_size($f['size'] ?? 0),
        'mtime'    => isset($f['modifiedTime']) ? date('Y-m-d H:i:s', strtotime($f['modifiedTime'])) : '',
        'link'     => 'https://drive.google.com/open?id=' . $f['id']
    ];
}

// Carpetas primero y, dentro de cada grupo, por nombre: es el orden que espera
// cualquiera que venga de un explorador de archivos.
function drv_sort(&$items) {
    usort($items, function ($a, $b) {
        if ($a['isFolder'] !== $b['isFolder']) return $a['isFolder'] ? -1 : 1;
        return strcasecmp($a['name'], $b['name']);
    });
}

$action = $_POST['action'] ?? $_GET['action'] ?? '';

try {
    $drive = new DriveClient();

    switch ($action) {

        // Las "unidades": lo que alguien compartio con la cuenta de servicio. Si
        // esta vacio no es un error — es que nadie ha compartido nada todavia.
        case 'roots': {
            $roots = [];
            foreach ($drive->listSharedFolders() as $f) {
                $roots[] = [
                    'id'    => $f['id'],
                    'name'  => $f['name'],
                    'mtime' => isset($f['modifiedTime']) ? date('Y-m-d H:i:s', strtotime($f['modifiedTime'])) : ''
                ];
            }
            usort($roots, function ($a, $b) { return strcasecmp($a['name'], $b['name']); });

            echo json_encode(['success' => true, 'roots' => $roots], JSON_UNESCAPED_UNICODE);
            break;
        }

        case 'list': {
            $id = trim($_POST['id'] ?? $_GET['id'] ?? '');
            if ($id === '') drv_fail('Falta la carpeta a listar');

            $items = [];
            foreach ($drive->listChildren($id, 'all') as $f) {
                $items[] = drv_entry($f);
            }
            drv_sort($items);

            $folders = count(array_filter($items, function ($i) { return $i['isFolder']; }));
            echo json_encode([
                'success' => true,
                'id'      => $id,
                'items'   => $items,
                'totals'  => ['folders' => $folders, 'files' => count($items) - $folders]
            ], JSON_UNESCAPED_UNICODE);
            break;
        }

        // Busqueda por nombre. Con `root` se limita a esa unidad (Drive no filtra
        // por subarbol, asi que se acota por padre); sin el, busca en todo lo que
        // la cuenta de servicio alcanza.
        case 'search': {
            $q    = trim($_POST['q'] ?? $_GET['q'] ?? '');
            $root = trim($_POST['root'] ?? $_GET['root'] ?? '');
            if (mb_strlen($q) < 2) drv_fail('Escribe al menos dos letras');

            $safe  = str_replace("'", "\\'", $q);
            $query = "name contains '" . $safe . "' and trashed = false";
            if ($root !== '') $query .= " and '" . str_replace("'", "\\'", $root) . "' in parents";

            $items = [];
            foreach ($drive->searchFiles($query, 60) as $f) {
                $items[] = drv_entry($f);
            }
            drv_sort($items);

            echo json_encode(['success' => true, 'items' => $items, 'query' => $q], JSON_UNESCAPED_UNICODE);
            break;
        }

        // Asomo del contenido para el panel inferior. Solo texto: una hoja o un
        // Google Doc completo no aportan nada recortados a 1800 bytes.
        case 'preview': {
            $id   = trim($_POST['id'] ?? $_GET['id'] ?? '');
            $mime = trim($_POST['mime'] ?? $_GET['mime'] ?? '');
            $name = trim($_POST['name'] ?? $_GET['name'] ?? '');
            if ($id === '') drv_fail('Falta el archivo');

            list($kind, $openable) = drv_kind($mime, $name);
            if ($kind !== 'text') {
                echo json_encode([
                    'success'  => true,
                    'kind'     => $kind,
                    'openable' => $openable,
                    'text'     => '',
                    'note'     => $kind === 'gdoc'
                        ? 'Documento de Google: se convierte a Markdown al abrirlo.'
                        : ($openable ? 'Se abre en el visor con su propio lector.' : 'El visor no puede mostrar este tipo desde Drive.')
                ], JSON_UNESCAPED_UNICODE);
                break;
            }

            $raw  = (string) $drive->downloadFile($id);
            $text = mb_substr($raw, 0, DRV_PREVIEW_BYTES);
            echo json_encode([
                'success'   => true,
                'kind'      => $kind,
                'openable'  => true,
                'text'      => $text,
                'truncated' => strlen($raw) > strlen($text)
            ], JSON_UNESCAPED_UNICODE);
            break;
        }

        default:
            drv_fail('Accion no reconocida: ' . $action);
    }
} catch (DriveException $e) {
    // Fallo propio de Drive (credenciales, permisos, red): se distingue del resto
    // para que el modal pueda decir que revisar.
    drv_fail('Google Drive: ' . $e->getMessage(), 502);
} catch (Throwable $e) {
    drv_fail('Error en el explorador de Drive: ' . $e->getMessage(), 500);
}
