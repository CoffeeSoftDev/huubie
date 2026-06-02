<?php
/**
 * ============================================================================
 *  PROTOTIPO PORTABLE · Streaming de IA con efecto "typewriter" tipo Claude
 * ============================================================================
 *
 *  Un solo archivo, autocontenido. Copia esta carpeta a cualquier proyecto
 *  PHP (Apache/WAMP/Nginx) y funciona. No depende de librerias externas.
 *
 *  Soporta DOS proveedores; se elige por el id del modelo:
 *    - id con "/"  -> OpenRouter (formato OpenAI: SSE "data: {json}")
 *    - id sin "/"  -> Ollama Cloud (formato NDJSON: una linea JSON por chunk)
 *
 *  Demuestra:
 *    - Recibir el stream del LLM con cURL (CURLOPT_WRITEFUNCTION) sin esperar
 *      a la respuesta completa.
 *    - Reenviarlo al navegador en vivo con Server-Sent Events (SSE) + flush.
 *    - Pintarlo palabra a palabra a ritmo constante (sensacion Claude).
 *
 *  COMO USAR:
 *    1) Pon tu(s) API key(s) abajo en $CONFIG.
 *    2) Abre este archivo en el navegador y dale a "Enviar".
 * ----------------------------------------------------------------------------
 */

$CONFIG = [
    'timeout'   => 120,

    // En Windows/WAMP cURL suele necesitar el bundle de certificados para HTTPS.
    // Deja '' si tu servidor ya valida SSL (Linux normalmente no lo necesita).
    'ca_bundle' => '',   // ej: 'c:/wamp64/bin/php/extras/ssl/cacert.pem'

    // ── Credenciales por proveedor ──────────────────────────────────────────
    'ollama' => [
        'api_key'   => 'PEGA_AQUI_TU_API_KEY_OLLAMA',
        'base_url'  => 'https://ollama.com',
        'chat_path' => '/api/chat',
        'format'    => 'ndjson',          // Ollama: una linea JSON por chunk
    ],
    'openrouter' => [
        'api_key'   => 'PEGA_AQUI_TU_API_KEY_OPENROUTER',
        'base_url'  => 'https://openrouter.ai/api/v1',
        'chat_path' => '/chat/completions',
        'format'    => 'openai',          // OpenRouter/OpenAI: SSE "data: {json}"
    ],

    // ── Modelos del selector: value => [etiqueta, grupo] ────────────────────
    // El proveedor se deduce del id (con "/" => OpenRouter).
    'models'    => [
        'minimax-m3:cloud'           => ['MiniMax M3',                'Ollama Cloud'],
        'minimax-m2.7:cloud'         => ['MiniMax M2.7',              'Ollama Cloud'],
        'qwen3-coder:480b-cloud'     => ['Qwen3 Coder 480B',          'Ollama Cloud'],
        'kimi-k2.6:cloud'            => ['Kimi K2.6',                 'Ollama Cloud'],
        'openai/gpt-oss-120b:free'   => ['GPT-OSS 120B (free)',       'OpenRouter (free)'],
        'z-ai/glm-4.5-air:free'      => ['GLM 4.5 Air (free)',        'OpenRouter (free)'],
        'nvidia/nemotron-3-super-120b-a12b:free' => ['Nemotron 3 Super 120B (free)', 'OpenRouter (free)'],
        'google/gemma-4-31b-it:free' => ['Gemma 4 31B (free, vision)','OpenRouter (free)'],
    ],
    'default'   => 'minimax-m3:cloud',
];

/*
 * Fallback de credenciales (comodidad SOLO dentro de este proyecto): si no
 * editaste las keys arriba, las toma del .env del visor. Al copiar la carpeta
 * a otro proyecto ese .env no existe, asi que simplemente rellena $CONFIG.
 */
$envPath = __DIR__ . '/../../../credentials/.env';
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
        if (!empty($env['OLLAMA_CA_BUNDLE']))          $CONFIG['ca_bundle'] = $env['OLLAMA_CA_BUNDLE'];
        elseif (!empty($env['OPENROUTER_CA_BUNDLE']))  $CONFIG['ca_bundle'] = $env['OPENROUTER_CA_BUNDLE'];
    }
}

/** ¿Una key sigue sin configurar? */
function key_missing($k) {
    return $k === '' || strncmp($k, 'PEGA_AQUI', 9) === 0;
}

/** Devuelve la sub-config del proveedor segun el id del modelo. */
function provider_for(array $cfg, $model) {
    return (strpos($model, '/') !== false) ? $cfg['openrouter'] : $cfg['ollama'];
}

/* ========================================================================== */
/*  BACKEND · POST = canal SSE                                                 */
/* ========================================================================== */

if ($_SERVER['REQUEST_METHOD'] === 'POST') {

    // --- Apagar TODO buffering para que los chunks salgan en vivo ---
    @ini_set('zlib.output_compression', '0');
    @ini_set('output_buffering', '0');
    @ini_set('implicit_flush', '1');
    if (function_exists('apache_setenv')) { @apache_setenv('no-gzip', '1'); } // Apache
    while (ob_get_level() > 0) { @ob_end_flush(); }
    ob_implicit_flush(true);

    header('Content-Type: text/event-stream; charset=utf-8');
    header('Cache-Control: no-cache');
    header('X-Accel-Buffering: no'); // Nginx: no bufferear

    $send = function ($event, $data) {
        echo "event: {$event}\n";
        echo 'data: ' . json_encode($data, JSON_UNESCAPED_UNICODE) . "\n\n";
        @ob_flush();
        @flush();
    };

    $body   = json_decode(file_get_contents('php://input'), true) ?: [];
    $prompt = isset($body['prompt']) && $body['prompt'] !== ''
        ? (string) $body['prompt']
        : 'Explica en 5 puntos que es el patron MVC. Tomate tu tiempo.';
    $model  = isset($body['model']) && $body['model'] !== '' ? $body['model'] : $CONFIG['default'];

    $prov = provider_for($CONFIG, $model);
    if (key_missing($prov['api_key'])) {
        $which = (strpos($model, '/') !== false) ? 'openrouter' : 'ollama';
        $send('error', ['error' => "Falta configurar la API key de {$which} en \$CONFIG."]);
        exit;
    }

    $messages = [
        ['role' => 'system', 'content' => 'Responde en espanol, claro y directo.'],
        ['role' => 'user',   'content' => $prompt],
    ];

    $t0 = microtime(true);
    try {
        stream_chat($CONFIG, $model, $messages, function ($piece) use ($send) {
            if ($piece !== '') $send('chunk', ['t' => $piece]);
        });
        $send('done', ['ok' => true, 'elapsed_ms' => (int) round((microtime(true) - $t0) * 1000)]);
    } catch (Throwable $e) {
        $send('error', ['error' => $e->getMessage()]);
    }
    exit;
}

/**
 * Habla con el LLM en streaming. Usa CURLOPT_WRITEFUNCTION para procesar la
 * respuesta conforme llega. cURL puede cortar a mitad de linea, asi que
 * bufferizamos y partimos por "\n".
 *
 * Soporta dos formatos segun el proveedor:
 *   - ndjson (Ollama):  {"message":{"content":"..."}, "done":false}  por linea
 *   - openai (OpenRouter): lineas "data: {json}" con choices[0].delta.content
 *                          y una "data: [DONE]" final que se ignora.
 */
function stream_chat(array $cfg, $model, array $messages, callable $onChunk) {
    $prov   = provider_for($cfg, $model);
    $isOpenAI = ($prov['format'] === 'openai');

    $payload = ['model' => $model, 'messages' => $messages, 'stream' => true];

    $headers = [
        'Authorization: Bearer ' . $prov['api_key'],
        'Content-Type: application/json',
        'Accept: ' . ($isOpenAI ? 'text/event-stream' : 'application/x-ndjson'),
    ];
    if ($isOpenAI) {
        // Cabeceras opcionales de ranking en openrouter.ai (no obligatorias).
        $headers[] = 'X-Title: Prototipo Stream';
    }

    $buffer = '';
    $ch = curl_init(rtrim($prov['base_url'], '/') . $prov['chat_path']);
    curl_setopt_array($ch, [
        CURLOPT_CUSTOMREQUEST => 'POST',
        CURLOPT_HTTPHEADER    => $headers,
        CURLOPT_TIMEOUT       => $cfg['timeout'],
        CURLOPT_POSTFIELDS    => json_encode($payload, JSON_UNESCAPED_UNICODE),
        CURLOPT_WRITEFUNCTION => function ($c, $data) use (&$buffer, $onChunk, $isOpenAI) {
            $buffer .= $data;
            while (($pos = strpos($buffer, "\n")) !== false) {
                $line   = trim(substr($buffer, 0, $pos));
                $buffer = substr($buffer, $pos + 1);
                if ($line === '') continue;

                if ($isOpenAI) {
                    if ($line[0] === ':') continue;                 // comentario keep-alive
                    if (strncmp($line, 'data:', 5) !== 0) continue;
                    $json = trim(substr($line, 5));
                    if ($json === '[DONE]') continue;
                    $obj = json_decode($json, true);
                    $piece = is_array($obj) ? ($obj['choices'][0]['delta']['content'] ?? '') : '';
                } else {
                    $obj = json_decode($line, true);
                    $piece = is_array($obj) ? ($obj['message']['content'] ?? '') : '';
                }
                if ($piece !== '' && $piece !== null) $onChunk($piece);
            }
            return strlen($data); // OBLIGATORIO: devolver bytes consumidos o cURL aborta
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
    if ($code >= 400)                 throw new Exception("HTTP $code del proveedor");
}

/* ========================================================================== */
/*  FRONTEND · GET = pagina de demo (tema LIGHT)                               */
/* ========================================================================== */

// Agrupa los modelos por su etiqueta de grupo para los <optgroup>.
$grouped = [];
foreach ($CONFIG['models'] as $value => $info) {
    $grouped[$info[1]][$value] = $info[0];
}

header('Content-Type: text/html; charset=utf-8');
?>
<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Streaming IA · efecto tipo Claude (light)</title>
<style>
    :root {
        --bg:        #f5f6f8;
        --card:      #ffffff;
        --text:      #1f2937;
        --muted:     #6b7280;
        --border:    #d8dce3;
        --accent:    #7c3aed;
        --accent-d:  #6d28d9;
        --err:       #dc2626;
    }
    * { box-sizing: border-box; }
    body {
        font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
        max-width: 820px; margin: 36px auto; padding: 0 16px;
        background: var(--bg); color: var(--text);
    }
    h1 { color: var(--accent-d); font-size: 20px; margin-bottom: 4px; }
    .sub { color: var(--muted); font-size: 13px; margin-bottom: 22px; }
    .row { display: flex; gap: 8px; margin-bottom: 10px; }
    select, textarea, button {
        font-family: inherit; font-size: 14px; border-radius: 9px;
        border: 1px solid var(--border); background: var(--card); color: var(--text);
        padding: 10px 12px;
    }
    select { min-width: 260px; cursor: pointer; }
    textarea { flex: 1; resize: vertical; min-height: 58px; }
    select:focus, textarea:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px rgba(124,58,237,.12); }
    button {
        background: var(--accent); color: #fff; font-weight: 700; border: 0; cursor: pointer;
        padding: 10px 22px; transition: background .15s ease;
    }
    button:hover:not(:disabled) { background: var(--accent-d); }
    button:disabled { opacity: .5; cursor: not-allowed; }
    .out {
        white-space: pre-wrap; line-height: 1.6; background: var(--card);
        border: 1px solid var(--border); border-radius: 12px; padding: 18px 20px;
        margin-top: 16px; min-height: 120px;
        box-shadow: 0 1px 3px rgba(16,24,40,.04);
    }
    .meta { color: var(--muted); font-size: 12px; margin-top: 10px; }
    .err  { color: var(--err); }
    .cursor {
        display: inline-block; color: var(--accent); font-weight: 700; margin-left: 1px;
        animation: blink 1s steps(2, start) infinite;
    }
    @keyframes blink { 0%, 50% { opacity: 1; } 50.01%, 100% { opacity: 0; } }
</style>
</head>
<body>
    <h1>Streaming IA · efecto tipo Claude</h1>
    <div class="sub">El texto aparece <b>palabra a palabra</b> conforme el modelo lo genera. Ollama Cloud + OpenRouter · tema light.</div>

    <div class="row">
        <select id="model">
            <?php foreach ($grouped as $group => $opts): ?>
                <optgroup label="<?= htmlspecialchars($group) ?>">
                    <?php foreach ($opts as $value => $label): ?>
                        <option value="<?= htmlspecialchars($value) ?>"<?= $value === $CONFIG['default'] ? ' selected' : '' ?>>
                            <?= htmlspecialchars($label) ?>
                        </option>
                    <?php endforeach; ?>
                </optgroup>
            <?php endforeach; ?>
        </select>
    </div>
    <div class="row">
        <textarea id="prompt" placeholder="Escribe un prompt...">Explica en 5 puntos que es el patron MVC. Tomate tu tiempo.</textarea>
        <button id="go">Enviar</button>
    </div>

    <div id="out" class="out"></div>
    <div id="meta" class="meta"></div>

<script>
const $ = (id) => document.getElementById(id);

function escapeHtml(s) {
    return String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
}

async function run() {
    const btn = $('go'), out = $('out'), meta = $('meta');
    btn.disabled = true;
    meta.textContent = 'conectando...';
    const t0 = performance.now();
    let firstAt = null;

    // --- Typewriter tipo Claude --------------------------------------------
    // Desacopla la RECEPCION (bloques que llegan a saltos) del PINTADO (palabra
    // a palabra, ritmo constante). El stream llena 'pending'; un loop de
    // animacion lo vacia suave hacia 'shown'.
    let pending = '', shown = '', streamDone = false, raf = null, finalMeta = '';
    let last = performance.now(), credit = 0;

    out.innerHTML = '<span class="cursor">▍</span>';

    // Toma la siguiente "palabra" (espacios + token + espacio final). Pintar por
    // palabra da la sensacion Claude; letra a letra se siente a maquina de escribir.
    function takeWord() {
        const m   = pending.match(/^\s*\S+\s*/);
        const len = m ? m[0].length : pending.length;
        const piece = pending.slice(0, len);
        pending = pending.slice(len);
        return piece;
    }
    function pump(now) {
        now = now || performance.now();
        const dt = Math.min(100, now - last); // cap por si la pestana estuvo inactiva
        last = now;
        // Ritmo en PALABRAS/seg. Sube 'wps' base para mas rapido, bajalo para mas lento.
        const wps = 14 + Math.min(46, pending.length / 40);
        credit += (dt / 1000) * wps;
        let painted = false;
        while (credit >= 1 && pending.length) { shown += takeWord(); credit -= 1; painted = true; }
        if (painted) out.innerHTML = escapeHtml(shown) + '<span class="cursor">▍</span>';
        if (!pending.length) credit = 0;
        if (streamDone && !pending.length) {
            out.innerHTML = escapeHtml(shown);   // fin real: quitamos el cursor
            meta.textContent = finalMeta;
            raf = null;
            return;
        }
        raf = requestAnimationFrame(pump);
    }
    const kick = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(pump); } };

    try {
        const res = await fetch(location.pathname, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt: $('prompt').value, model: $('model').value })
        });
        if (!res.ok || !res.body) throw new Error('HTTP ' + res.status);

        // Lectura del SSE: eventos separados por \n\n, lineas 'event:' y 'data:'.
        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = '';

        while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buf += dec.decode(value, { stream: true });

            let idx;
            while ((idx = buf.indexOf('\n\n')) !== -1) {
                const rawEvent = buf.slice(0, idx);
                buf = buf.slice(idx + 2);
                let ev = 'message', data = '';
                rawEvent.split('\n').forEach(l => {
                    if (l.startsWith('event:')) ev = l.slice(6).trim();
                    else if (l.startsWith('data:')) data += l.slice(5).trim();
                });
                const obj = data ? JSON.parse(data) : {};

                if (ev === 'chunk') {
                    if (firstAt === null) {
                        firstAt = performance.now();
                        meta.textContent = 'primer token en ' + Math.round(firstAt - t0) + ' ms · escribiendo...';
                    }
                    pending += obj.t || '';   // alimenta el typewriter
                    kick();
                } else if (ev === 'done') {
                    const total = Math.round(performance.now() - t0);
                    finalMeta = 'primer token: ' + Math.round((firstAt || t0) - t0) + ' ms · total: ' + total + ' ms';
                    streamDone = true;
                    kick();
                } else if (ev === 'error') {
                    pending = '';
                    out.innerHTML = '<span class="err">Error: ' + escapeHtml(obj.error || '?') + '</span>';
                    streamDone = true;
                }
            }
        }
        streamDone = true; // por si el stream cierra sin evento 'done'
        kick();
    } catch (e) {
        out.innerHTML = '<span class="err">Fallo: ' + escapeHtml(e.message) + '</span>';
    } finally {
        btn.disabled = false;
    }
}

$('go').addEventListener('click', run);
</script>
</body>
</html>
