<?php
/**
 * ============================================================================
 *  PROTOTIPO · Bot de WhatsApp (Cloud API de Meta) + LLM
 * ============================================================================
 *
 *  Mismo nucleo que prototipo/stream pero, en vez de SSE/typewriter al navegador,
 *  conversa por WhatsApp:
 *
 *    WhatsApp --(webhook POST)--> este archivo --(prompt)--> LLM (Ollama/OpenRouter)
 *        ^                                                          |
 *        |---------(Graph API: enviar mensaje)<--- respuesta full --|
 *
 *  WhatsApp NO hace streaming: se acumula toda la respuesta del modelo y se manda
 *  en UN mensaje (o partido si supera el limite de WhatsApp).
 *
 *  Dos endpoints en un solo archivo:
 *    - GET  -> verificacion del webhook (Meta manda hub.challenge una sola vez).
 *    - POST -> mensajes entrantes (Meta te notifica cada mensaje del usuario).
 *
 *  COMO USAR: ver README.md de esta carpeta (config, ngrok y panel de Meta).
 * ----------------------------------------------------------------------------
 */

$CONFIG = [
    'timeout'   => 120,
    'ca_bundle' => '',   // Windows/WAMP: 'c:/wamp64/bin/php/extras/ssl/cacert.pem'

    // ── WhatsApp Cloud API (Meta) ───────────────────────────────────────────
    'whatsapp' => [
        // Token que TU inventas; lo pones igual aqui y en el panel de Meta al
        // configurar el webhook. Meta lo reenvia en la verificacion (GET).
        'verify_token'    => 'huubie-coffeebot-2026',
        // Token de acceso de tu app de Meta (temporal de 24h o permanente de System User).
        'access_token'    => 'EAASZBRYNQCM0BRhFjMOGaZB0VZCBJpyvR285Ag7X96UmK9DMvEbk5F4tJvzRPFOb0ZCYDlkEeF8K2PxA4L3Sza0K9LV36zKhKOS2WbNSkxL8NfnLdAPVJeHlHqcJDZARKaEiXbwNGCxUWlJLtvRT2razmXZCxKzhgAZAXfzSLir5eQWXTo8ZAZBIDDJZBiIimedvDQZARMVConiySKZCaa279kcKhtYtyqSx4A1j8ZCqqZADp2K3pHItZBPq7RKOZBl3OAd01etMjVOT2JHNXZCxHDFkFGiUZD',
        // Phone Number ID que te da Meta (NO es el numero; es un id numerico).
        'phone_number_id' => '1144291168767775',
        'graph_version'   => 'v25.0',
    ],

    // ── Modelo a usar para responder ────────────────────────────────────────
    // con "/" => OpenRouter; sin "/" => Ollama. Si dejas '' se toma el
    // OLLAMA_DEFAULT_MODEL del .env (ver fallback mas abajo).
    'model' => '',

    // ── Credenciales del LLM (igual que prototipo/stream) ───────────────────
    'ollama' => [
        'api_key'   => 'PEGA_AQUI_TU_API_KEY_OLLAMA',
        'base_url'  => 'https://ollama.com',
        'chat_path' => '/api/chat',
        'format'    => 'ndjson',
    ],
    'openrouter' => [
        'api_key'   => 'PEGA_AQUI_TU_API_KEY_OPENROUTER',
        'base_url'  => 'https://openrouter.ai/api/v1',
        'chat_path' => '/chat/completions',
        'format'    => 'openai',
    ],

    // "Alma" de Coffee. Se prueba en orden; gana el primero que exista. La
    // primera es el agente CoffeeIA de Claude Code (alma completa); la segunda
    // es el alma del Visor como respaldo portable.
    'soul_paths' => [
        'C:/Users/SomxDev/.claude/agents/CoffeeIA.md',
        __DIR__ . '/../../prompts/coffee-system.md',
    ],

    // Adaptador de canal: se ANEXA al alma para ajustar la salida a WhatsApp
    // (texto plano; sin herramientas; WhatsApp no renderiza mermaid/chart/md).
    'whatsapp_adapter' => <<<TXT
=== CANAL: WHATSAPP (IMPORTANTE) ===
Estas respondiendo por WhatsApp, NO por el chat del Visor ni dentro de Claude Code.
En este canal NO tienes herramientas: no puedes leer archivos, steering files ni
indices, ni ejecutar comandos. Por lo tanto:
- Responde SOLO con tu conocimiento; NUNCA digas que vas a "leer" un archivo o
  consultar el indice embebido. Ignora cualquier instruccion de tu alma sobre
  leer steering files con Read(offset, limit): aqui no aplica.
- Texto PLANO, breve y conversacional (es un chat de telefono).
- NO emitas bloques ```mermaid ni ```chart: WhatsApp no los renderiza.
- Evita tablas y markdown enriquecido. Para enfasis usa el formato de WhatsApp:
  *negrita*, _cursiva_, ```monospace```.
- Si muestras codigo, fragmentos cortos. Si la respuesta seria larga, resume y
  ofrece ampliar.
TXT,
];

/*
 * Fallback de credenciales del LLM desde el .env del visor (comodidad local).
 * El access_token de WhatsApp SI debes ponerlo arriba (no esta en ese .env).
 */
$envPath = __DIR__ . '/../../../credentials/.env';   // coffee/app/credentials/.env
if (is_file($envPath)) {
    $env = @parse_ini_file($envPath, false, INI_SCANNER_TYPED) ?: [];
    if (key_missing($CONFIG['ollama']['api_key']) && !empty($env['OLLAMA_API_KEY'])) {
        $CONFIG['ollama']['api_key'] = $env['OLLAMA_API_KEY'];
        if (!empty($env['OLLAMA_BASE_URL'])) $CONFIG['ollama']['base_url'] = $env['OLLAMA_BASE_URL'];
    }
    if (key_missing($CONFIG['openrouter']['api_key']) && !empty($env['OPENROUTER_API_KEY'])) {
        $CONFIG['openrouter']['api_key'] = $env['OPENROUTER_API_KEY'];
        if (!empty($env['OPENROUTER_BASE_URL'])) $CONFIG['openrouter']['base_url'] = $env['OPENROUTER_BASE_URL'];
    }
    if ($CONFIG['ca_bundle'] === '') {
        if (!empty($env['OLLAMA_CA_BUNDLE']))         $CONFIG['ca_bundle'] = $env['OLLAMA_CA_BUNDLE'];
        elseif (!empty($env['OPENROUTER_CA_BUNDLE'])) $CONFIG['ca_bundle'] = $env['OPENROUTER_CA_BUNDLE'];
    }
    if ($CONFIG['model'] === '' && !empty($env['OLLAMA_DEFAULT_MODEL'])) {
        $CONFIG['model'] = $env['OLLAMA_DEFAULT_MODEL'];
    }
}
// Ultimo recurso si no hubo .env ni se edito arriba.
if ($CONFIG['model'] === '') $CONFIG['model'] = 'qwen3-coder:480b-cloud';

/** ¿Una key/token sigue sin configurar? */
function key_missing($k) {
    return $k === '' || strncmp($k, 'PEGA_AQUI', 9) === 0;
}

/** Sub-config del proveedor LLM segun el id del modelo. */
function provider_for(array $cfg, $model) {
    return (strpos($model, '/') !== false) ? $cfg['openrouter'] : $cfg['ollama'];
}

/**
 * System prompt = "alma" de Coffee + el adaptador de canal de WhatsApp.
 * Carga la primera ruta de 'soul_paths' que exista, le limpia el frontmatter
 * YAML y el indice de steering (irrelevantes/inutiles en WhatsApp) y le anexa
 * el adaptador. Si no encuentra ninguna, cae a un prompt minimo.
 */
function build_system_prompt(array $cfg) {
    $soul  = '';
    $paths = !empty($cfg['soul_paths']) ? (array) $cfg['soul_paths'] : [];
    foreach ($paths as $p) {
        if ($p && is_file($p)) { $soul = (string) @file_get_contents($p); break; }
    }

    // Quita frontmatter YAML (--- ... --- al inicio). BOM opcional completo.
    $soul = preg_replace('/^(?:\xEF\xBB\xBF)?\s*---\r?\n.*?\r?\n---\r?\n/s', '', $soul, 1);
    // Quita el bloque del indice de steering: <!-- INDEX:START --> ... fin.
    $soul = preg_replace('/<!--\s*INDEX:START\s*-->.*$/s', '', $soul);
    $soul = trim($soul);

    if ($soul === '') {
        $soul = 'Eres CoffeeIA, asistente oficial del framework CoffeeSoft. Responde en espanol, claro y directo.';
    }
    $adapter = isset($cfg['whatsapp_adapter']) ? trim($cfg['whatsapp_adapter']) : '';
    return $adapter !== '' ? ($soul . "\n\n" . $adapter) : $soul;
}

/** Log simple a archivo (util porque el webhook no tiene pantalla). */
function wlog($msg) {
    @file_put_contents(__DIR__ . '/webhook.log',
        '[' . date('Y-m-d H:i:s') . '] ' . $msg . PHP_EOL, FILE_APPEND);
}

/* ========================================================================== */
/*  GET · Verificacion del webhook (Meta lo llama una vez al guardar la URL)   */
/* ========================================================================== */

if ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $mode      = $_GET['hub_mode']         ?? ($_GET['hub.mode']         ?? '');
    $token     = $_GET['hub_verify_token'] ?? ($_GET['hub.verify_token'] ?? '');
    $challenge = $_GET['hub_challenge']    ?? ($_GET['hub.challenge']    ?? '');

    if ($mode === 'subscribe' && $token === $CONFIG['whatsapp']['verify_token']) {
        header('Content-Type: text/plain');
        echo $challenge;            // OBLIGATORIO: devolver el challenge tal cual
    } else {
        http_response_code(403);
        echo 'Verificacion fallida';
    }
    exit;
}

/* ========================================================================== */
/*  POST · Mensaje entrante de WhatsApp                                        */
/* ========================================================================== */

if ($_SERVER['REQUEST_METHOD'] === 'POST') {

    // Responder 200 cuanto antes: Meta reintenta si tardas, lo que duplicaria
    // respuestas. Cerramos la conexion HTTP y seguimos procesando en segundo plano.
    $raw = file_get_contents('php://input');
    http_response_code(200);
    if (function_exists('fastcgi_finish_request')) {
        echo 'OK';
        fastcgi_finish_request();      // PHP-FPM
    } else {
        // Apache/mod_php: cerrar la conexion manualmente y seguir ejecutando.
        ignore_user_abort(true);
        ob_start();
        echo 'OK';
        header('Content-Length: ' . ob_get_length());
        header('Connection: close');
        @ob_end_flush();
        @flush();
    }

    $body = json_decode($raw, true) ?: [];
    $msg  = $body['entry'][0]['changes'][0]['value']['messages'][0] ?? null;

    // Notificaciones de estado (entregado/leido) o eventos sin mensaje: ignorar.
    if (!$msg || ($msg['type'] ?? '') !== 'text') {
        exit;
    }

    $from   = $msg['from'] ?? '';                 // telefono del usuario (E.164 sin +)
    $text   = trim($msg['text']['body'] ?? '');
    $msgId  = $msg['id'] ?? '';

    // Anti-duplicado simple: si ya vimos este message id, salir.
    $seen = __DIR__ . '/seen_' . preg_replace('/[^A-Za-z0-9]/', '', $msgId) . '.lock';
    if ($msgId && file_exists($seen)) { exit; }
    if ($msgId) { @touch($seen); }

    if ($from === '' || $text === '') { exit; }

    wlog("IN  {$from}: {$text}");

    // --- Pensar la respuesta con el LLM (acumulada, sin streaming) ----------
    $wa = $CONFIG['whatsapp'];
    if (key_missing($wa['access_token']) || key_missing($wa['phone_number_id'])) {
        wlog('ERROR: falta configurar access_token/phone_number_id de WhatsApp.');
        exit;
    }

    $messages = [
        ['role' => 'system', 'content' => build_system_prompt($CONFIG)],
        ['role' => 'user',   'content' => $text],
    ];

    try {
        $reply = llm_complete($CONFIG, $CONFIG['model'], $messages);
        $reply = trim($reply) !== '' ? $reply : '(sin respuesta del modelo)';
    } catch (Throwable $e) {
        $reply = 'Ups, fallo al pensar la respuesta: ' . $e->getMessage();
        wlog('ERROR LLM: ' . $e->getMessage());
    }

    // WhatsApp limita el texto a ~4096 chars por mensaje: partir si hace falta.
    foreach (str_split($reply, 3900) as $part) {
        wa_send($CONFIG, $from, $part);
    }
    wlog("OUT {$from}: " . mb_substr($reply, 0, 120) . '...');
    exit;
}

/* ========================================================================== */
/*  LLM · misma logica que prototipo/stream pero ACUMULANDO la respuesta       */
/* ========================================================================== */

/** Llama al LLM en streaming y devuelve el texto completo concatenado. */
function llm_complete(array $cfg, $model, array $messages) {
    $prov     = provider_for($cfg, $model);
    if (key_missing($prov['api_key'])) {
        $which = (strpos($model, '/') !== false) ? 'openrouter' : 'ollama';
        throw new Exception("Falta la API key de {$which}.");
    }
    $isOpenAI = ($prov['format'] === 'openai');
    $payload  = ['model' => $model, 'messages' => $messages, 'stream' => true];

    $headers = [
        'Authorization: Bearer ' . $prov['api_key'],
        'Content-Type: application/json',
        'Accept: ' . ($isOpenAI ? 'text/event-stream' : 'application/x-ndjson'),
    ];
    if ($isOpenAI) $headers[] = 'X-Title: Prototipo WhatsApp';

    $out = '';
    $buffer = '';
    $ch = curl_init(rtrim($prov['base_url'], '/') . $prov['chat_path']);
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST => 'POST',
        CURLOPT_HTTPHEADER    => $headers,
        CURLOPT_TIMEOUT       => $cfg['timeout'],
        CURLOPT_POSTFIELDS    => json_encode($payload, JSON_UNESCAPED_UNICODE),
        CURLOPT_WRITEFUNCTION => function ($c, $data) use (&$buffer, &$out, $isOpenAI) {
            $buffer .= $data;
            while (($pos = strpos($buffer, "\n")) !== false) {
                $line   = trim(substr($buffer, 0, $pos));
                $buffer = substr($buffer, $pos + 1);
                if ($line === '') continue;
                if ($isOpenAI) {
                    if ($line[0] === ':') continue;
                    if (strncmp($line, 'data:', 5) !== 0) continue;
                    $json = trim(substr($line, 5));
                    if ($json === '[DONE]') continue;
                    $obj = json_decode($json, true);
                    $piece = is_array($obj) ? ($obj['choices'][0]['delta']['content'] ?? '') : '';
                } else {
                    $obj = json_decode($line, true);
                    $piece = is_array($obj) ? ($obj['message']['content'] ?? '') : '';
                }
                if ($piece !== '' && $piece !== null) $out .= $piece;
            }
            return strlen($data);
        },
    ]);
    if (!empty($cfg['ca_bundle']) && file_exists($cfg['ca_bundle'])) {
        curl_setopt($ch, CURLOPT_CAINFO, $cfg['ca_bundle']);
    }

    $ok   = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err  = curl_error($ch);
    curl_close($ch);

    if ($ok === false && $err !== '') throw new Exception('cURL: ' . $err);
    if ($code >= 400)                 throw new Exception("HTTP $code del proveedor LLM");
    return $out;
}

/* ========================================================================== */
/*  WhatsApp · enviar mensaje de texto por la Graph API de Meta                */
/* ========================================================================== */

/**
 * Normaliza el numero para enviar. WhatsApp entrega los mensajes de Mexico (y
 * Argentina) con un "1" (o "9") extra tras el codigo de pais que NO existe en la
 * red telefonica real: MX llega como 521XXXXXXXXXX pero el destinatario valido es
 * 52XXXXXXXXXX. Si no se quita, Meta responde (#131030) "not in allowed list".
 */
function wa_normalize_to($to) {
    $to = preg_replace('/\D/', '', (string) $to);   // solo digitos
    if (strpos($to, '521') === 0 && strlen($to) === 13) return '52' . substr($to, 3); // Mexico
    if (strpos($to, '549') === 0 && strlen($to) === 13) return '54' . substr($to, 3); // Argentina
    return $to;
}

function wa_send(array $cfg, $to, $text) {
    $wa  = $cfg['whatsapp'];
    $url = "https://graph.facebook.com/{$wa['graph_version']}/{$wa['phone_number_id']}/messages";

    $payload = [
        'messaging_product' => 'whatsapp',
        'to'                => wa_normalize_to($to),
        'type'              => 'text',
        'text'              => ['preview_url' => false, 'body' => $text],
    ];

    $ch = curl_init($url);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER     => [
            'Authorization: Bearer ' . $wa['access_token'],
            'Content-Type: application/json',
        ],
        CURLOPT_POSTFIELDS     => json_encode($payload, JSON_UNESCAPED_UNICODE),
        CURLOPT_TIMEOUT        => 30,
    ]);
    if (!empty($cfg['ca_bundle']) && file_exists($cfg['ca_bundle'])) {
        curl_setopt($ch, CURLOPT_CAINFO, $cfg['ca_bundle']);
    }

    $resp = curl_exec($ch);
    $code = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $err  = curl_error($ch);
    curl_close($ch);

    if ($resp === false || $code >= 400) {
        wlog("ERROR wa_send HTTP $code $err :: $resp");
    } else {
        wlog("OK wa_send HTTP $code :: $resp");
    }
}

// Cualquier otro metodo:
http_response_code(405);
echo 'Metodo no permitido';
