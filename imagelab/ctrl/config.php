<?php
/**
 * ImageLab — configuracion. Proyecto autonomo: lee su propio imagelab/.env y no
 * depende de nada del visor.
 *
 * La pieza central es il_aliases(): el mapa alias -> motor real. El front manda
 * "v1", nunca un nombre de modelo, asi que el motor se cambia aqui sin tocar el
 * cliente. Es lo que hace TapEdit con su campo `m`.
 */

$_IL_ENV_PATH = __DIR__ . '/../.env';
$_IL_ENV = file_exists($_IL_ENV_PATH) ? parse_ini_file($_IL_ENV_PATH, false, INI_SCANNER_TYPED) : [];
if ($_IL_ENV === false) $_IL_ENV = [];

function il_env($key, $default = '') {
    global $_IL_ENV;
    return isset($_IL_ENV[$key]) ? $_IL_ENV[$key] : $default;
}

define('IL_PROVIDER', strtolower((string) il_env('IL_PROVIDER', 'auto')));
define('IL_TIMEOUT',  (int) il_env('IL_TIMEOUT', 180));
// En 1 el front ve provider y modelo reales; en 0 solo el alias, como TapEdit.
define('IL_REVEAL_ENGINE', (int) il_env('IL_REVEAL_ENGINE', 1) === 1);
// Con 0, solo atiende peticiones desde la propia maquina. Es un proyecto local.
define('IL_ALLOW_REMOTE', (int) il_env('IL_ALLOW_REMOTE', 0) === 1);

// Servidor local de difusion. ComfyUI y A1111 hablan idiomas distintos pero ambos
// exponen HTTP: cambiando la URL, el mismo driver sirve para tu PC o para una GPU
// rentada por horas.
define('IL_LOCAL_BASE_URL',   rtrim((string) il_env('IL_LOCAL_BASE_URL', ''), '/'));
define('IL_LOCAL_KIND',       strtolower((string) il_env('IL_LOCAL_KIND', 'comfyui')));
define('IL_LOCAL_CHECKPOINT', (string) il_env('IL_LOCAL_CHECKPOINT', ''));
define('IL_LOCAL_STEPS',      (int) il_env('IL_LOCAL_STEPS', 20));
define('IL_LOCAL_CFG',        (float) il_env('IL_LOCAL_CFG', 7.0));
define('IL_LOCAL_SAMPLER',    (string) il_env('IL_LOCAL_SAMPLER', 'euler'));
define('IL_LOCAL_SCHEDULER',  (string) il_env('IL_LOCAL_SCHEDULER', 'normal'));
define('IL_LOCAL_DENOISE',    (float) il_env('IL_LOCAL_DENOISE', 0.65));
define('IL_LOCAL_NEGATIVE',   (string) il_env('IL_LOCAL_NEGATIVE', 'lowres, blurry, watermark, text'));

define('IL_FAL_API_KEY',  (string) il_env('FAL_API_KEY', ''));
define('IL_FAL_BASE_URL', rtrim((string) il_env('FAL_BASE_URL', 'https://queue.fal.run'), '/'));
define('IL_REPLICATE_API_TOKEN', (string) il_env('REPLICATE_API_TOKEN', ''));
define('IL_REPLICATE_BASE_URL',  rtrim((string) il_env('REPLICATE_BASE_URL', 'https://api.replicate.com/v1'), '/'));
define('IL_VENICE_API_KEY',  (string) il_env('VENICE_API_KEY', ''));
define('IL_VENICE_BASE_URL', rtrim((string) il_env('VENICE_BASE_URL', 'https://api.venice.ai/api/v1'), '/'));
// Venice desenfoca contenido adulto por su cuenta salvo que se le diga que no.
define('IL_VENICE_SAFE_MODE', (int) il_env('IL_VENICE_SAFE_MODE', 1) === 1);

// Certificados para las llamadas HTTPS. Sin esto, cURL en WAMP falla al validar.
$_IL_CA = (string) il_env('IL_CA_BUNDLE', '');
if ($_IL_CA === '' || !file_exists($_IL_CA)) {
    foreach (['c:/wamp64/credentials/cacert.pem', __DIR__ . '/../cacert.pem'] as $candidate) {
        if (file_exists($candidate)) { $_IL_CA = $candidate; break; }
    }
}
define('IL_CA_BUNDLE', file_exists($_IL_CA) ? $_IL_CA : '');
unset($_IL_CA, $_IL_ENV_PATH);

/** Corta el paso a peticiones que no vengan de esta maquina, salvo que se permita. */
function il_guard_origin() {
    if (IL_ALLOW_REMOTE) return;
    $ip = $_SERVER['REMOTE_ADDR'] ?? '';
    if (in_array($ip, ['127.0.0.1', '::1', 'localhost'], true)) return;
    http_response_code(403);
    echo json_encode([
        'success' => false,
        'message' => 'ImageLab solo atiende peticiones locales. Pon IL_ALLOW_REMOTE=1 en el .env si de verdad lo quieres abierto.'
    ], JSON_UNESCAPED_UNICODE);
    exit;
}

/**
 * El servidor local esta vivo? Se consulta con timeout corto y se memoriza para no
 * castigar cada peticion. Sin esto, el catalogo ofreceria un motor apagado.
 */
function il_local_alive() {
    static $alive = null;
    if ($alive !== null) return $alive;
    if (IL_LOCAL_BASE_URL === '') return $alive = false;

    $probe = IL_LOCAL_KIND === 'a1111'
        ? IL_LOCAL_BASE_URL . '/sdapi/v1/options'
        : IL_LOCAL_BASE_URL . '/system_stats';

    $ch = curl_init($probe);
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 2,
        CURLOPT_CONNECTTIMEOUT => 1,
        CURLOPT_NOBODY         => false,
    ]);
    curl_exec($ch);
    $code = (int) curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    return $alive = ($code >= 200 && $code < 500);
}

/**
 * Catalogo de operaciones. Cada alias lista candidatos EN ORDEN y gana el primero
 * disponible. El local va primero a proposito: si tienes ComfyUI encendido, no tiene
 * sentido pagar por generar un placeholder.
 */
function il_aliases() {
    return [
        'v1' => [
            'task' => 'generate', 'quality' => 'standard', 'label' => 'Rapido',
            'candidates' => [
                ['provider' => 'local',        'model' => 'txt2img'],
                ['provider' => 'fal',          'model' => 'fal-ai/flux/schnell'],
                ['provider' => 'venice',       'model' => 'qwen-image'],
                ['provider' => 'replicate',    'model' => 'black-forest-labs/flux-schnell'],
                ['provider' => 'pollinations', 'model' => 'sana'],
            ],
        ],
        'v2' => [
            'task' => 'generate', 'quality' => 'pro', 'label' => 'Calidad',
            'candidates' => [
                ['provider' => 'fal',       'model' => 'fal-ai/flux-pro/v1.1'],
                ['provider' => 'venice',    'model' => 'flux-2-max'],
                ['provider' => 'replicate', 'model' => 'black-forest-labs/flux-1.1-pro'],
            ],
        ],
        'e1' => [
            'task' => 'edit', 'quality' => 'standard', 'label' => 'Editar',
            'candidates' => [
                ['provider' => 'local',     'model' => 'img2img'],
                ['provider' => 'fal',       'model' => 'fal-ai/qwen-image-edit'],
                ['provider' => 'venice',    'model' => 'firered-image-edit'],
                ['provider' => 'replicate', 'model' => 'qwen/qwen-image-edit'],
            ],
        ],
        'e2' => [
            'task' => 'edit', 'quality' => 'pro', 'label' => 'Editar pro',
            'candidates' => [
                ['provider' => 'fal',       'model' => 'fal-ai/flux-pro/kontext'],
                ['provider' => 'venice',    'model' => 'gpt-image-2-edit'],
                ['provider' => 'replicate', 'model' => 'black-forest-labs/flux-kontext-pro'],
            ],
        ],
    ];
}

function il_provider_ready($provider) {
    switch ($provider) {
        case 'pollinations': return true;
        case 'local':        return il_local_alive();
        case 'fal':          return IL_FAL_API_KEY !== '';
        case 'venice':       return IL_VENICE_API_KEY !== '';
        case 'replicate':    return IL_REPLICATE_API_TOKEN !== '';
    }
    return false;
}

function il_resolve_alias($alias) {
    $aliases = il_aliases();
    if (!isset($aliases[$alias])) return null;
    $def = $aliases[$alias];

    $candidates = $def['candidates'];
    if (IL_PROVIDER !== 'auto' && IL_PROVIDER !== '') {
        usort($candidates, function ($a, $b) {
            return ($a['provider'] === IL_PROVIDER ? 0 : 1) - ($b['provider'] === IL_PROVIDER ? 0 : 1);
        });
    }
    foreach ($candidates as $c) {
        if (il_provider_ready($c['provider'])) {
            return [
                'alias'    => $alias,
                'task'     => $def['task'],
                'quality'  => $def['quality'],
                'label'    => $def['label'],
                'provider' => $c['provider'],
                'model'    => $c['model'],
            ];
        }
    }
    return null;
}

function il_public_catalog() {
    $out = [];
    foreach (il_aliases() as $alias => $def) {
        $resolved = il_resolve_alias($alias);
        $row = [
            'm'         => $alias,
            'task'      => $def['task'],
            'q'         => $def['quality'],
            'label'     => $def['label'],
            'available' => $resolved !== null,
        ];
        if ($resolved !== null && IL_REVEAL_ENGINE) {
            $row['engine'] = $resolved['provider'] === 'local'
                ? 'local · ' . IL_LOCAL_KIND
                : $resolved['provider'] . ' · ' . $resolved['model'];
        }
        $out[] = $row;
    }
    return $out;
}

/**
 * res + ar -> ancho y alto en multiplos de 64. Los modelos de difusion latente
 * comprimen la imagen 8 veces y solo trabajan en esa rejilla; por eso la salida de
 * TapEdit era 768x1024 y no un numero cualquiera.
 */
function il_dimensions($res, $ar) {
    $megapixels = ['512' => 0.26, '1K' => 1.0, '2K' => 4.0];
    $mp = $megapixels[strtoupper((string) $res)] ?? 1.0;

    $ratios = ['1:1' => [1, 1], '3:4' => [3, 4], '4:3' => [4, 3], '9:16' => [9, 16], '16:9' => [16, 9]];
    $r = $ratios[(string) $ar] ?? [1, 1];

    $base = sqrt(($mp * 1000000) / ($r[0] * $r[1]));
    $snap = function ($v) { return max(256, (int) (round($v / 64) * 64)); };
    return [$snap($base * $r[0]), $snap($base * $r[1])];
}
