<?php
// Sube imagenes "para el modulo": assets que el componente/template HTML generado
// referenciara con <img src>. Recibe POST JSON { images: [{ base64, mime, name }] },
// las guarda en uploads/module-assets/ y devuelve sus URLs web.
// Distinto de las imagenes de VISION (que viajan al modelo y no se persisten).
header('Content-Type: application/json; charset=utf-8');

function assets_fail($msg, $code = 400) {
    http_response_code($code);
    echo json_encode(['success' => false, 'message' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}

$raw  = file_get_contents('php://input');
$body = json_decode($raw, true);
if (!is_array($body) || empty($body['images']) || !is_array($body['images'])) {
    assets_fail('Payload invalido: se espera { images: [...] }');
}
if (count($body['images']) > 6) {
    assets_fail('Maximo 6 imagenes por envio');
}

// Solo formatos de imagen inofensivos (sin svg: puede embeber scripts).
$extByMime = [
    'image/png'  => 'png',
    'image/jpeg' => 'jpg',
    'image/webp' => 'webp',
    'image/gif'  => 'gif',
];

$destDir = realpath(__DIR__ . '/..');
if ($destDir === false) assets_fail('No se resolvio la carpeta del visor', 500);
$destDir .= DIRECTORY_SEPARATOR . 'uploads' . DIRECTORY_SEPARATOR . 'module-assets';
if (!is_dir($destDir) && !@mkdir($destDir, 0775, true)) {
    assets_fail('No se pudo crear uploads/module-assets', 500);
}

// URL web de la carpeta del visor (…/coffee/app/visor) a partir del script actual.
$baseUrl = rtrim(dirname(dirname($_SERVER['SCRIPT_NAME'] ?? '')), '/\\');

$files = [];
foreach ($body['images'] as $img) {
    $mime   = isset($img['mime']) ? strtolower(trim((string) $img['mime'])) : '';
    $base64 = isset($img['base64']) ? (string) $img['base64'] : '';
    $name   = isset($img['name']) ? (string) $img['name'] : 'imagen';
    if (!isset($extByMime[$mime])) {
        assets_fail('Formato no soportado: ' . $mime . ' (usa png, jpg, webp o gif)');
    }
    $bin = base64_decode($base64, true);
    if ($bin === false || $bin === '') assets_fail('Imagen corrupta: ' . $name);
    if (strlen($bin) > 8 * 1024 * 1024) assets_fail('Imagen demasiado grande (max 8 MB): ' . $name);

    // Verificar que el contenido ES una imagen (no confiar solo en el mime declarado).
    $info = @getimagesizefromstring($bin);
    if ($info === false) assets_fail('El archivo no es una imagen valida: ' . $name);

    $fileName = 'img-' . date('Ymd') . '-' . bin2hex(random_bytes(5)) . '.' . $extByMime[$mime];
    if (@file_put_contents($destDir . DIRECTORY_SEPARATOR . $fileName, $bin) === false) {
        assets_fail('No se pudo guardar: ' . $name, 500);
    }
    $files[] = [
        'name' => $name,
        'url'  => $baseUrl . '/uploads/module-assets/' . $fileName,
    ];
}

echo json_encode(['success' => true, 'files' => $files], JSON_UNESCAPED_UNICODE);
