<?php
/**
 * ImageLab — API. El mismo pipeline que usa TapEdit, con motor intercambiable:
 *
 *   presign  -> permiso de subida de un solo uso, con caducidad
 *   upload   -> recibe el archivo, lo valida y lo deja en uploads/in/
 *   run      -> payload compacto { m, q, res, ar, fmt, p, i }; devuelve un jobId opaco
 *   status   -> polling; al terminar re-codifica el resultado y lo publica en uploads/out/
 *   catalog  -> operaciones disponibles hoy
 *   recent   -> ultimos trabajos
 *
 * Por que upload y run van separados: subir y generar tienen tiempos y limites
 * distintos. Con el archivo ya en el servidor, `run` viaja como un JSON de 200 bytes
 * y se puede reintentar sin volver a subir la foto.
 */

require_once __DIR__ . '/config.php';
require_once __DIR__ . '/drivers.php';
require_once __DIR__ . '/jobs.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

il_guard_origin();

if (session_status() === PHP_SESSION_NONE) {
    session_name('imagelab_sid');
    session_set_cookie_params(['lifetime' => 0, 'path' => '/', 'httponly' => true, 'samesite' => 'Lax']);
    session_start();
}

function il_fail($msg, $code = 400) {
    http_response_code($code);
    echo json_encode(['success' => false, 'message' => $msg], JSON_UNESCAPED_UNICODE);
    exit;
}
function il_ok(array $data) {
    echo json_encode(['success' => true] + $data, JSON_UNESCAPED_UNICODE);
    exit;
}

const IL_EXT_BY_MIME  = ['image/png' => 'png', 'image/jpeg' => 'jpg', 'image/webp' => 'webp'];
const IL_MAX_UPLOAD   = 12582912;   // 12 MB
const IL_INPUT_MAX_PX = 1536;       // lado maximo con el que la foto viaja al proveedor
const IL_PRESIGN_TTL  = 900;        // 15 minutos

// Sin login: cada navegador es su propio dueno. Basta para separar trabajos.
$owner  = session_id();
$action = $_GET['action'] ?? $_POST['action'] ?? '';

/** Carpeta fisica uploads/<sub>/<fecha>, creada al vuelo. */
function il_dir($sub) {
    $dir = __DIR__ . '/../uploads/' . $sub . '/' . date('Y-m-d');
    if (!is_dir($dir) && !@mkdir($dir, 0775, true)) il_fail('No se pudo crear ' . $dir, 500);
    return $dir;
}

/** URL web de la raiz del proyecto, deducida del script actual. */
function il_base_url() {
    return rtrim(dirname(dirname($_SERVER['SCRIPT_NAME'] ?? '')), '/\\');
}

/** Ruta fisica a partir de una URL nuestra de uploads. Null si no es nuestra. */
function il_path_from_url($url) {
    $prefix = il_base_url() . '/uploads/';
    if (strpos((string) $url, $prefix) !== 0) return null;
    $rel = substr($url, strlen($prefix));
    if (strpos($rel, '..') !== false) return null;
    $path = __DIR__ . '/../uploads/' . $rel;
    return is_file($path) ? $path : null;
}

/**
 * Publica un binario como imagen propia: lo re-codifica con GD y lo escribe en out/.
 * Recodificar no es cosmetica — al pasar por GD se pierden EXIF, iTXt y cualquier
 * firma del generador. Es lo que hace TapEdit con sharp, y por eso su PNG llego
 * limpio cuando le buscamos los metadatos.
 */
function il_publish($binary, $fmt) {
    $img = @imagecreatefromstring($binary);
    if ($img === false) il_fail('El proveedor devolvio algo que no es una imagen', 502);

    $fmt  = in_array($fmt, ['png', 'webp'], true) ? $fmt : 'jpg';
    $name = bin2hex(random_bytes(8)) . '.' . $fmt;
    $path = il_dir('out') . '/' . $name;

    if ($fmt === 'png')      { imagesavealpha($img, true); $done = @imagepng($img, $path, 6); }
    elseif ($fmt === 'webp') { $done = @imagewebp($img, $path, 90); }
    else {
        $flat = imagecreatetruecolor(imagesx($img), imagesy($img));
        imagefill($flat, 0, 0, imagecolorallocate($flat, 255, 255, 255));
        imagecopy($flat, $img, 0, 0, 0, 0, imagesx($img), imagesy($img));
        $done = @imagejpeg($flat, $path, 90);
        imagedestroy($flat);
    }
    imagedestroy($img);
    if (!$done) il_fail('No se pudo escribir el resultado en uploads/out', 500);

    if ($fmt === 'jpg') il_strip_jpeg_comment($path);

    $info = @getimagesize($path);
    return [
        'url'    => il_base_url() . '/uploads/out/' . date('Y-m-d') . '/' . $name,
        'width'  => $info ? (int) $info[0] : 0,
        'height' => $info ? (int) $info[1] : 0,
        'bytes'  => (int) filesize($path),
    ];
}

/**
 * Borra los segmentos COM del JPEG. GD firma lo que produce con
 * "CREATOR: gd-jpeg v1.0 ..." y eso cuenta que detras hay PHP — el mismo tipo de
 * rastro que fuimos a buscar en los archivos de TapEdit y no encontramos.
 */
function il_strip_jpeg_comment($path) {
    $b = @file_get_contents($path);
    if ($b === false || strlen($b) < 4 || substr($b, 0, 2) !== "\xFF\xD8") return;

    $out = "\xFF\xD8";
    $i   = 2;
    while ($i < strlen($b) - 1 && ord($b[$i]) === 0xFF) {
        $marker = ord($b[$i + 1]);
        if ($marker === 0xDA) break;                 // empieza el scan: lo demas es imagen
        $len = @unpack('n', substr($b, $i + 2, 2));
        if (!$len) return;
        $len = $len[1];
        if ($marker !== 0xFE) $out .= substr($b, $i, 2 + $len);
        $i += 2 + $len;
    }
    @file_put_contents($path, $out . substr($b, $i));
}

/**
 * La foto de entrada como data URI, para los proveedores de nube. Es obligatorio en
 * local: fal y Replicate tienen que DESCARGAR la imagen, y a http://localhost no
 * llegan. Asi viaja dentro del propio POST y funciona igual aqui que en un servidor.
 */
function il_input_data_uri($path) {
    $bin = @file_get_contents($path);
    if ($bin === false) il_fail('No se pudo leer la imagen de entrada', 500);

    $img = @imagecreatefromstring($bin);
    if ($img === false) il_fail('La imagen de entrada no es valida');

    $max = max(imagesx($img), imagesy($img));
    if ($max > IL_INPUT_MAX_PX) {
        $scale   = IL_INPUT_MAX_PX / $max;
        $resized = imagescale($img, (int) round(imagesx($img) * $scale), (int) round(imagesy($img) * $scale));
        if ($resized !== false) { imagedestroy($img); $img = $resized; }
    }
    ob_start();
    imagejpeg($img, null, 88);
    $out = ob_get_clean();
    imagedestroy($img);

    return 'data:image/jpeg;base64,' . base64_encode($out);
}

try {
    switch ($action) {

        case 'catalog': {
            il_ok([
                'items'    => il_public_catalog(),
                'reveal'   => IL_REVEAL_ENGINE,
                'local'    => ['configured' => IL_LOCAL_BASE_URL !== '', 'alive' => il_local_alive(), 'kind' => IL_LOCAL_KIND],
                'defaults' => ['q' => 'standard', 'res' => '1K', 'ar' => '1:1', 'fmt' => 'jpg'],
            ]);
        }

        case 'presign': {
            $token = bin2hex(random_bytes(16));
            if (!isset($_SESSION['il_presign']) || !is_array($_SESSION['il_presign'])) $_SESSION['il_presign'] = [];
            foreach ($_SESSION['il_presign'] as $t => $exp) {
                if ($exp < time()) unset($_SESSION['il_presign'][$t]);
            }
            $_SESSION['il_presign'][$token] = time() + IL_PRESIGN_TTL;

            il_ok([
                'uploadToken' => $token,
                'uploadUrl'   => 'ctrl/api.php?action=upload',
                'expiresIn'   => IL_PRESIGN_TTL,
                'maxBytes'    => IL_MAX_UPLOAD,
                'accept'      => array_keys(IL_EXT_BY_MIME),
            ]);
        }

        case 'upload': {
            $token = (string)($_POST['t'] ?? '');
            $store = $_SESSION['il_presign'] ?? [];
            if ($token === '' || !isset($store[$token])) il_fail('Permiso de subida invalido; pide otro presign', 403);
            if ($store[$token] < time()) {
                unset($_SESSION['il_presign'][$token]);
                il_fail('El permiso de subida caduco', 403);
            }
            unset($_SESSION['il_presign'][$token]);          // un solo uso

            if (!isset($_FILES['file']) || $_FILES['file']['error'] !== UPLOAD_ERR_OK) il_fail('No llego el archivo (campo "file")');
            if ($_FILES['file']['size'] > IL_MAX_UPLOAD) il_fail('La imagen supera los 12 MB');

            $bin = @file_get_contents($_FILES['file']['tmp_name']);
            if ($bin === false || $bin === '') il_fail('Archivo vacio');

            // Se comprueba que el contenido SEA una imagen, sin confiar en el mime declarado.
            $info = @getimagesizefromstring($bin);
            if ($info === false) il_fail('El archivo no es una imagen valida');
            $mime = strtolower((string)($info['mime'] ?? ''));
            if (!isset(IL_EXT_BY_MIME[$mime])) il_fail('Formato no soportado: ' . $mime . ' (png, jpg o webp)');

            $name = 'src-' . bin2hex(random_bytes(8)) . '.' . IL_EXT_BY_MIME[$mime];
            if (@file_put_contents(il_dir('in') . '/' . $name, $bin) === false) il_fail('No se pudo guardar la imagen', 500);

            il_ok([
                'url'    => il_base_url() . '/uploads/in/' . date('Y-m-d') . '/' . $name,
                'width'  => (int) $info[0],
                'height' => (int) $info[1],
                'bytes'  => strlen($bin),
            ]);
        }

        case 'run': {
            $body = json_decode(file_get_contents('php://input'), true);
            if (!is_array($body)) il_fail('Payload invalido: se espera JSON');

            $alias  = (string)($body['m'] ?? 'v1');
            $prompt = trim((string)($body['p'] ?? ''));
            $res    = (string)($body['res'] ?? '1K');
            $ar     = (string)($body['ar'] ?? '1:1');
            $fmt    = strtolower((string)($body['fmt'] ?? 'jpg'));
            $input  = (string)($body['i'] ?? '');

            if ($prompt === '')            il_fail('Falta la instruccion (p)');
            if (mb_strlen($prompt) > 2000) il_fail('La instruccion es demasiado larga');

            $engine = il_resolve_alias($alias);
            if ($engine === null) {
                il_fail('El alias "' . $alias . '" no tiene motor disponible. Enciende el servidor local o pon FAL_API_KEY / VENICE_API_KEY / REPLICATE_API_TOKEN en el .env', 503);
            }

            // El local recibe la RUTA del archivo (lo sube a ComfyUI o lo lee en disco);
            // los de nube reciben un data URI, porque no pueden alcanzar tu localhost.
            $imageUrl  = '';
            $imagePath = '';
            if ($engine['task'] === 'edit') {
                if ($input === '') il_fail('Editar necesita una imagen: sube una primero');
                $path = il_path_from_url($input);
                if ($path === null) il_fail('La imagen de entrada no es una subida de este harness');
                $imagePath = $path;
                if ($engine['provider'] !== 'local') $imageUrl = il_input_data_uri($path);
            }

            list($w, $h) = il_dimensions($res, $ar);

            $jobId = il_jobs_create([
                'owner'    => $owner,
                'task'     => $engine['task'],
                'alias'    => $alias,
                'provider' => $engine['provider'],
                'model'    => $engine['model'],
                'params'   => ['q' => $engine['quality'], 'res' => $res, 'ar' => $ar, 'fmt' => $fmt, 'p' => $prompt, 'i' => $input],
            ]);

            try {
                $sub = il_driver($engine['provider'])->submit([
                    'task'      => $engine['task'],
                    'model'     => $engine['model'],
                    'prompt'    => $prompt,
                    'width'     => $w,
                    'height'    => $h,
                    'aspect'    => $ar,
                    'format'    => $fmt,
                    'imageUrl'  => $imageUrl,
                    'imagePath' => $imagePath,
                ]);
            } catch (ImageDriverException $e) {
                il_jobs_update($jobId, ['status' => 'failed', 'error' => $e->getMessage()]);
                il_fail($e->getMessage(), 502);
            }

            // Un servidor sincrono devuelve el binario en el mismo submit: se publica ya
            // y el primer status lo encuentra hecho.
            if (!empty($sub['data'])) {
                $published = il_publish($sub['data'], $fmt);
                il_jobs_update($jobId, [
                    'external_id' => $sub['externalId'],
                    'status'      => 'succeeded',
                    'output_url'  => $published['url'],
                ]);
            } else {
                il_jobs_update($jobId, [
                    'external_id' => $sub['externalId'],
                    'source_url'  => (string)($sub['sourceUrl'] ?? ''),
                    'status'      => 'starting',
                ]);
            }

            $out = ['jobId' => $jobId, 'status' => 'starting', 'size' => $w . 'x' . $h];
            if (IL_REVEAL_ENGINE) $out['engine'] = $engine['provider'] . ' · ' . $engine['model'];
            il_ok($out);
        }

        case 'status': {
            $jobId = (string)($_GET['id'] ?? '');
            $job   = il_jobs_get($jobId, $owner);
            if ($job === null) il_fail('Trabajo no encontrado', 404);

            $params = json_decode($job['params'], true) ?: [];
            // Sin 'status': lo pone cada respuesta. El operador + de arrays no pisa
            // claves existentes, asi que ponerlo aqui congelaria el estado inicial.
            $reply  = ['jobId' => $jobId];
            if (IL_REVEAL_ENGINE) $reply['engine'] = $job['provider'] . ' · ' . $job['model'];

            if ($job['status'] === 'succeeded' && $job['output_url'] !== '') {
                il_ok($reply + ['status' => 'succeeded', 'output' => $job['output_url']]);
            }
            if ($job['status'] === 'failed') {
                il_ok($reply + ['status' => 'failed', 'error' => $job['error']]);
            }

            try {
                $poll = il_driver($job['provider'])->poll($job['external_id'], $job);
            } catch (ImageDriverException $e) {
                il_jobs_update($jobId, ['status' => 'failed', 'error' => $e->getMessage()]);
                il_ok($reply + ['status' => 'failed', 'error' => $e->getMessage()]);
            }

            if ($poll['status'] !== 'succeeded') {
                il_jobs_update($jobId, ['status' => $poll['status'], 'error' => (string)($poll['error'] ?? '')]);
                il_ok($reply + ['status' => $poll['status'], 'error' => (string)($poll['error'] ?? '')]);
            }

            // Descarga desde el proveedor y republica bajo nuestro dominio. Con esto el
            // navegador nunca ve una URL de fal ni de Replicate: mismo efecto que el
            // cdn.tapedit.ai que nos dejo sin pistas cuando fuimos a mirar.
            $binary = $poll['data'] ?? null;
            if ($binary === null) {
                $dl = il_http('GET', (string) $poll['sourceUrl'], [], null, IL_TIMEOUT);
                if ($dl['status'] >= 400 || $dl['body'] === '') {
                    il_jobs_update($jobId, ['status' => 'failed', 'error' => 'No se pudo descargar el resultado (HTTP ' . $dl['status'] . ')']);
                    il_ok($reply + ['status' => 'failed', 'error' => 'No se pudo descargar el resultado del proveedor']);
                }
                $binary = $dl['body'];
            }

            $published = il_publish($binary, (string)($params['fmt'] ?? 'jpg'));
            il_jobs_update($jobId, [
                'status'     => 'succeeded',
                'source_url' => (string)($poll['sourceUrl'] ?? ''),
                'output_url' => $published['url'],
            ]);
            il_ok($reply + [
                'status' => 'succeeded',
                'output' => $published['url'],
                // El tamano real de la salida, que casi nunca es el que pediste: manda el
                // proveedor. Es el dato que delato el motor de TapEdit.
                'size'   => $published['width'] . 'x' . $published['height'],
                'bytes'  => $published['bytes'],
            ]);
        }

        case 'recent': {
            il_ok(['jobs' => il_jobs_recent($owner, 24)]);
        }
    }

    il_fail('Accion desconocida: ' . $action);

} catch (Throwable $e) {
    il_fail($e->getMessage(), 500);
}
