<?php
/**
 * PROTOTIPO de streaming con Ollama Cloud (prueba aislada, no toca el visor).
 *
 *  - GET   → sirve una pagina de prueba con selector de modelo y consola.
 *  - POST  → abre un canal SSE (text/event-stream) y emite los tokens
 *            conforme Ollama los genera, usando OllamaClient::chatStream().
 *
 * Abrir en navegador:
 *   http://localhost/huubie/coffee/app/visor/ctrl/test-stream.php
 */

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    /* ── Modo SSE ────────────────────────────────────────── */
    require_once __DIR__ . '/ollama-client.php';

    // Apagar todo buffering para que los chunks salgan en vivo (clave en Apache/WAMP).
    @ini_set('zlib.output_compression', '0');
    @ini_set('output_buffering', '0');
    @ini_set('implicit_flush', '1');
    if (function_exists('apache_setenv')) { @apache_setenv('no-gzip', '1'); }
    while (ob_get_level() > 0) { @ob_end_flush(); }
    ob_implicit_flush(true);

    header('Content-Type: text/event-stream; charset=utf-8');
    header('Cache-Control: no-cache');
    header('X-Accel-Buffering: no'); // por si hay un proxy/nginx delante

    $send = function ($event, $data) {
        echo "event: {$event}\n";
        echo 'data: ' . json_encode($data, JSON_UNESCAPED_UNICODE) . "\n\n";
        @ob_flush();
        @flush();
    };

    $raw    = file_get_contents('php://input');
    $body   = json_decode($raw, true) ?: [];
    $prompt = isset($body['prompt']) && $body['prompt'] !== ''
        ? (string) $body['prompt']
        : 'Explica en 5 puntos que es el patron MVC. Tomate tu tiempo.';
    $model  = isset($body['model']) && $body['model'] !== '' ? $body['model'] : null;

    $t0 = microtime(true);
    try {
        $client = new OllamaClient();
        $client->chatStream(
            [
                ['role' => 'system', 'content' => 'Responde en espanol, claro y directo.'],
                ['role' => 'user',   'content' => $prompt],
            ],
            $model,
            [],
            function ($piece) use ($send) {
                $send('chunk', ['t' => $piece]);
            }
        );
        $send('done', ['ok' => true, 'elapsed_ms' => (int) round((microtime(true) - $t0) * 1000)]);
    } catch (Throwable $e) {
        $send('error', ['ok' => false, 'error' => $e->getMessage()]);
    }
    exit;
}

/* ── Modo pagina HTML ────────────────────────────────────── */
header('Content-Type: text/html; charset=utf-8');
?>
<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Prototipo streaming · Ollama</title>
<style>
    body { font-family: system-ui, sans-serif; max-width: 820px; margin: 36px auto; padding: 0 16px; background: #0f172a; color: #e2e8f0; }
    h1 { color: #a78bfa; font-size: 20px; }
    .sub { color: #94a3b8; font-size: 13px; margin-bottom: 20px; }
    .row { display: flex; gap: 8px; margin-bottom: 10px; }
    select, textarea, button { font-family: inherit; border-radius: 8px; border: 1px solid #475569; background: #1e293b; color: #e2e8f0; padding: 10px; }
    select { min-width: 220px; }
    textarea { flex: 1; resize: vertical; min-height: 56px; }
    button { background: #a78bfa; color: #0f172a; font-weight: 700; border: 0; cursor: pointer; padding: 10px 20px; }
    button:disabled { opacity: .5; cursor: not-allowed; }
    .out { white-space: pre-wrap; line-height: 1.55; background: #1e293b; border: 1px solid #334155; border-radius: 10px; padding: 18px 20px; margin-top: 16px; min-height: 120px; }
    .meta { color: #94a3b8; font-size: 12px; margin-top: 10px; }
    .err { color: #f87171; }
    .blink { animation: b 1s steps(2) infinite; } @keyframes b { 50% { opacity: 0; } }
</style>
</head>
<body>
    <h1>Prototipo de streaming · Ollama Cloud</h1>
    <div class="sub">El texto debe aparecer <b>token a token</b>, no de golpe. Si llega todo junto al final, el buffering de Apache no se desactivo.</div>

    <div class="row">
        <select id="model">
            <option value="minimax-m3:cloud">MiniMax M3</option>
            <option value="minimax-m2.7:cloud">MiniMax M2.7</option>
            <option value="qwen3-coder:480b-cloud">Qwen3 Coder 480B</option>
            <option value="qwen3.5:397b-cloud">Qwen 3.5 397B</option>
            <option value="kimi-k2.6:cloud">Kimi K2.6</option>
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

    // --- Typewriter tipo Claude --------------------------------------
    // Desacopla la RECEPCION (bloques de ~100 chars que llegan a saltos)
    // del PINTADO (caracter a caracter, ritmo constante). El stream llena
    // 'pending'; un loop de animacion lo vacia suave hacia 'shown'.
    let pending = '', shown = '', streamDone = false, raf = null, finalMeta = '';
    let last = performance.now(), credit = 0;

    out.innerHTML = '<span class="blink">▍</span>';

    // Toma la siguiente "palabra" (espacios + token + espacio final). Pintar
    // palabra a palabra es lo que da la sensacion Claude; letra a letra se
    // siente a maquina de escribir.
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

        // Ritmo en PALABRAS/seg (no caracteres). Base comoda tipo Claude;
        // acelera si se acumula backlog para no rezagarse en respuestas largas.
        // Sube 'wps' para mas rapido, bajalo para mas lento.
        const wps = 14 + Math.min(46, pending.length / 40);
        credit += (dt / 1000) * wps;

        let painted = false;
        while (credit >= 1 && pending.length) {
            shown  += takeWord();
            credit -= 1;
            painted = true;
        }
        if (painted) out.innerHTML = escapeHtml(shown) + '<span class="blink">▍</span>';
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
