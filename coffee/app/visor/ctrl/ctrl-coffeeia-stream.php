<?php
/**
 * Endpoint de chat de CoffeeIA en modo STREAMING (Server-Sent Events).
 * Gemelo de ctrl-coffeeia.php pero emite los tokens conforme se generan,
 * usando OllamaClient/OpenRouterClient::chatStream(). Mismo contexto exacto
 * (coffeeia-context.php), distinto transporte.
 *
 * Eventos SSE emitidos:
 *   event: chunk  data: {"t":"<fragmento de texto>"}
 *   event: done   data: {"ok":true,"elapsed_ms":..,"tokens_used":..,"credits_estimate":..,"model":".."}
 *   event: error  data: {"error":"<mensaje>"}
 */

require_once __DIR__ . '/coffeeia-context.php';

// SSE de larga duracion: sin limite de ejecucion. En Windows/WAMP el tiempo de
// cURL cuenta contra max_execution_time, asi que sin esto PHP mataria el script
// (~120s) antes de que el modelo termine, dando "no devolvio respuesta".
@set_time_limit(0);
@ignore_user_abort(false);

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

$raw  = file_get_contents('php://input');
$body = json_decode($raw, true);
if (!is_array($body)) {
    $send('error', ['error' => 'Payload JSON invalido']);
    exit;
}

$ctx         = coffeeia_build_context($body);
$model       = $ctx['model'];
$effort      = $ctx['effort'] ?? '';   // esfuerzo de razonamiento elegido en la UI
$allMessages = $ctx['messages'];
$dbSchema    = $ctx['db'] ?? null;
$fsRoot      = $ctx['fs'] ?? null;
$canvasMode  = !empty($ctx['canvas']);
$dbMode      = isset($body['dbMode']) ? trim((string) $body['dbMode']) : '';

// Cuando el tool-calling no funciona (modelo sin tools o que no las usa), aqui se
// guarda el motivo y viaja en el evento `done` como `tools_fallback` para que el
// frontend lo muestre — antes el fallback era SILENCIOSO y el usuario no sabia por
// que su template salia sin datos.
$toolsFallback = null;

$t0       = microtime(true);
$provider = llm_is_openrouter_model($model) ? 'OpenRouter' : 'Ollama';

// URLs pegadas en el mensaje: ya se descargaron e inyectaron al contexto en
// coffeeia_build_context (clonar paginas web). Se avisa para que el usuario
// sepa que el modelo trabaja con el HTML/CSS real de la pagina.
$webPages = isset($ctx['web']) && is_array($ctx['web']) ? $ctx['web'] : [];
if (!empty($webPages)) {
    $send('thinking', ['t' => "\n[página web consultada: " . implode(', ', $webPages) . "]\n"]);
}

// Tope de rondas de herramientas POR PROVEEDOR. Ollama Cloud es tarifa plana:
// se le da margen amplio para que explore la base/carpeta lo que haga falta y
// SIEMPRE llegue a una respuesta. OpenRouter cobra por token (y el prompt crece
// con cada ronda), así que ahí el tope es conservador.
$isOR         = llm_is_openrouter_model($model);
$dbRounds     = $isOR ? 6 : 12;
$fsRounds     = $isOR ? ($canvasMode ? 10 : 6)  : ($canvasMode ? 14 : 10);
$hybridRounds = $isOR ? ($canvasMode ? 12 : 8)  : ($canvasMode ? 16 : 12);

// Carpeta + base conectadas A LA VEZ: loop HIBRIDO con ambas familias de herramientas
// (leer codigo real de la carpeta + consultar datos reales con run_select). Es el flujo
// "recrea la pantalla y rellena sus tablas/formularios con datos de la base". Si el
// modelo no soporta tools o falla, caemos al streaming normal (arbol y esquema ya van
// inyectados en el contexto).
if ($dbSchema && $fsRoot) {
    try {
        $client = llm_client_for($model);
        if ($effort !== '') $client->setThink($effort);
        $onStatus = function ($label) use ($send) {
            $send('thinking', ['t' => "\n[{$label}]\n"]);
        };
        // Mas rondas que los loops simples: explorar + leer archivos + varias consultas.
        $r = coffeeia_run_hybrid_tools($client, $allMessages, $model, $dbSchema, $fsRoot, $onStatus, $hybridRounds);

        // Un final VACIO se trata como fallo → catch (plan B + streaming normal).
        if (trim((string) $r['final']) === '') {
            throw new Exception('el modelo agotó las rondas sin entregar respuesta');
        }

        $final = (string) $r['final'];
        foreach (preg_split('/(\s+)/u', $final, -1, PREG_SPLIT_DELIM_CAPTURE) as $piece) {
            if ($piece !== '') $send('chunk', ['t' => $piece]);
        }

        $u         = $r['usage'];
        $inTokens  = (int)($u['prompt_tokens']     ?? 0);
        $outTokens = (int)($u['completion_tokens'] ?? 0);
        $costUsd   = isset($u['cost']) ? (float) $u['cost'] : null;
        $credits   = $outTokens > 0 ? round($outTokens / 1000, 4) : 0;

        $send('done', [
            'ok'                => true,
            'elapsed_ms'        => (int) round((microtime(true) - $t0) * 1000),
            'tokens_used'       => $outTokens,
            'prompt_tokens'     => $inTokens,
            'completion_tokens' => $outTokens,
            'cost_usd'          => $costUsd,
            'credits_estimate'  => $credits,
            'model'             => $model ?: '',
            'db'                => $dbSchema,
            'fs'                => $fsRoot,
            'tool_rounds'       => $r['rounds'],
            'truncated'         => $r['truncated'] ?? false,
            // rounds<=1 = el modelo respondio a la primera SIN invocar herramienta alguna.
            'tools_fallback'    => ($r['rounds'] <= 1 && $dbMode === 'data')
                                    ? 'El modelo respondió sin consultar la base ni la carpeta: los datos del template pueden no ser reales.'
                                    : null,
        ]);
        exit;
    } catch (Throwable $e) {
        // Modelo sin tools o error: avisamos (antes era silencioso), precargamos filas
        // reales de las tablas nombradas (plan B) y seguimos al streaming normal.
        $inj = coffeeia_inject_sample_rows($allMessages, $dbSchema);
        $allMessages = $inj['messages'];
        $toolsFallback = $inj['tables']
            ? 'Las consultas en vivo no se completaron (' . $e->getMessage() . '); se precargaron filas reales de: ' . implode(', ', $inj['tables']) . '.'
            : 'Las consultas en vivo no se completaron (' . $e->getMessage() . ') y el mensaje no nombra ninguna tabla: los datos pueden no ser reales. Nombra la tabla o cambia de modelo.';
        $send('thinking', ['t' => "\n[consultas en vivo no completadas: genero con contexto precargado]\n"]);
    }
}

// SELECT en vivo: si hay una base conectada (sin carpeta), corremos las rondas de
// tool-calling de forma sincrona (sirve para OpenRouter y para modelos Ollama
// tool-capable como GLM o qwen3-coder) y luego emitimos la respuesta final. Si el
// modelo no soporta tools o falla, caemos al streaming normal (el esquema ya esta
// inyectado -> el grafico sale).
if ($dbSchema && !$fsRoot) {
    try {
        $client = llm_client_for($model);
        // El loop ya manda etiquetas completas ("ronda 1/4: …", "consultando SELECT …").
        $onStatus = function ($label) use ($send) {
            $send('thinking', ['t' => "\n[{$label}]\n"]);
        };
        $r = coffeeia_run_db_tools($client, $allMessages, $model, $dbSchema, $onStatus, $dbRounds);

        // Un final VACIO jamas debe llegar al usuario como done ok (se veia
        // "el agente no devolvio respuesta"): se trata como fallo y cae al
        // catch (plan B con filas precargadas + streaming normal).
        if (trim((string) $r['final']) === '') {
            throw new Exception('el modelo agotó las rondas sin entregar respuesta');
        }

        // "Streaming" del texto final: lo troceamos por palabras para que el UI lo
        // pinte progresivamente (la consulta a la base ya se hizo arriba).
        $final = (string) $r['final'];
        foreach (preg_split('/(\s+)/u', $final, -1, PREG_SPLIT_DELIM_CAPTURE) as $piece) {
            if ($piece !== '') $send('chunk', ['t' => $piece]);
        }

        $u          = $r['usage'];
        $inTokens   = (int)($u['prompt_tokens']     ?? 0);
        $outTokens  = (int)($u['completion_tokens'] ?? 0);
        $costUsd    = isset($u['cost']) ? (float) $u['cost'] : null;
        $credits    = $outTokens > 0 ? round($outTokens / 1000, 4) : 0;

        $send('done', [
            'ok'                => true,
            'elapsed_ms'        => (int) round((microtime(true) - $t0) * 1000),
            'tokens_used'       => $outTokens,
            'prompt_tokens'     => $inTokens,
            'completion_tokens' => $outTokens,
            'cost_usd'          => $costUsd,
            'credits_estimate'  => $credits,
            'model'             => $model ?: '',
            'db'                => $dbSchema,
            'tool_rounds'       => $r['rounds'],
            'truncated'         => $r['truncated'] ?? false,
            // rounds<=1 = el modelo respondio a la primera SIN ejecutar ningun SELECT.
            'tools_fallback'    => ($r['rounds'] <= 1 && $dbMode === 'data')
                                    ? 'El modelo respondió sin ejecutar consultas a la base: los datos del template pueden no ser reales.'
                                    : null,
        ]);
        exit;
    } catch (Throwable $e) {
        // Modelo sin tools o consulta fallida: aun NO emitimos chunks, asi que es
        // seguro continuar al streaming normal de abajo. Antes este fallback era
        // SILENCIOSO ("template sin datos" sin explicacion); ahora avisamos y
        // precargamos filas reales de las tablas nombradas (plan B).
        $inj = coffeeia_inject_sample_rows($allMessages, $dbSchema);
        $allMessages = $inj['messages'];
        $toolsFallback = $inj['tables']
            ? 'Las consultas en vivo no se completaron (' . $e->getMessage() . '); se precargaron filas reales de: ' . implode(', ', $inj['tables']) . '.'
            : 'Las consultas en vivo no se completaron (' . $e->getMessage() . ') y el mensaje no nombra ninguna tabla: los datos pueden no ser reales. Nombra la tabla o cambia de modelo.';
        $send('thinking', ['t' => "\n[consultas en vivo no completadas: genero con filas precargadas]\n"]);
    }
}

// Carpeta conectada: navegacion de archivos por tool-calling (list_dir/read_file/
// grep_files), igual patron que la base de datos. Si el modelo no soporta tools o
// falla, caemos al streaming normal (el arbol ya esta inyectado en el contexto).
if ($fsRoot && !$dbSchema) {
    try {
        $client = llm_client_for($model);
        if ($effort !== '') $client->setThink($effort);
        $onStatus = function ($label) use ($send) {
            $send('thinking', ['t' => "\n[{$label}]\n"]);
        };
        // Con lienzo activo el modelo necesita mas rondas: explorar + leer varios
        // archivos (vista, css, js) antes de generar el template.
        $r = coffeeia_run_fs_tools($client, $allMessages, $model, $fsRoot, $onStatus, $fsRounds);

        // Un final VACIO se trata como fallo → catch (streaming normal con el árbol).
        if (trim((string) $r['final']) === '') {
            throw new Exception('el modelo agotó las rondas sin entregar respuesta');
        }

        $final = (string) $r['final'];
        foreach (preg_split('/(\s+)/u', $final, -1, PREG_SPLIT_DELIM_CAPTURE) as $piece) {
            if ($piece !== '') $send('chunk', ['t' => $piece]);
        }

        $u         = $r['usage'];
        $inTokens  = (int)($u['prompt_tokens']     ?? 0);
        $outTokens = (int)($u['completion_tokens'] ?? 0);
        $costUsd   = isset($u['cost']) ? (float) $u['cost'] : null;
        $credits   = $outTokens > 0 ? round($outTokens / 1000, 4) : 0;

        $send('done', [
            'ok'                => true,
            'elapsed_ms'        => (int) round((microtime(true) - $t0) * 1000),
            'tokens_used'       => $outTokens,
            'prompt_tokens'     => $inTokens,
            'completion_tokens' => $outTokens,
            'cost_usd'          => $costUsd,
            'credits_estimate'  => $credits,
            'model'             => $model ?: '',
            'fs'                => $fsRoot,
            'tool_rounds'       => $r['rounds'],
            'truncated'         => $r['truncated'] ?? false,
        ]);
        exit;
    } catch (Throwable $e) {
        // Modelo sin tools o error: seguimos al streaming normal (arbol ya inyectado),
        // pero avisando — antes el fallback era silencioso.
        $toolsFallback = 'Este modelo no soporta lectura de carpetas en vivo (tools): respondo solo con el árbol del proyecto ya inyectado.';
        $send('thinking', ['t' => "\n[herramientas no disponibles con este modelo: genero con el árbol precargado]\n"]);
    }
}

try {
    $client = llm_client_for($model);
    if ($effort !== '') $client->setThink($effort);
    if (!method_exists($client, 'chatStream')) {
        throw new Exception('El proveedor no soporta streaming.');
    }

    $result = $client->chatStream($allMessages, $model, [], function ($piece, $kind = 'content') use ($send) {
        if ($piece === '') return;
        // 'thinking' = cadena de razonamiento (no es la respuesta); 'content' = respuesta.
        $send($kind === 'thinking' ? 'thinking' : 'chunk', ['t' => $piece]);
    });

    $meta       = isset($result['meta']) && is_array($result['meta']) ? $result['meta'] : [];
    $usage      = isset($meta['usage']) && is_array($meta['usage']) ? $meta['usage'] : [];

    $inTokens   = $meta['prompt_eval_count'] ?? ($usage['prompt_tokens']     ?? 0);
    $outTokens  = $meta['eval_count']        ?? ($usage['completion_tokens'] ?? 0);
    $tokensUsed = (int) $outTokens;

    // Costo REAL en USD solo lo trae OpenRouter (usage.cost). Ollama -> null.
    $costUsd    = isset($usage['cost']) ? (float) $usage['cost'] : null;
    $credits    = $tokensUsed > 0 ? round($tokensUsed / 1000, 4) : 0;

    // Corte por LIMITE DE TOKENS: Ollama lo marca en done_reason='length', OpenRouter
    // en finish_reason='length'. Es la causa de "template grande: el HTML se pinta pero
    // el <script> queda a la mitad y no reacciona". El frontend usa este flag para
    // auto-continuar la generacion hasta cerrar el template.
    $doneReason = $meta['done_reason'] ?? ($meta['finish_reason'] ?? '');
    $truncated  = ($doneReason === 'length');

    $send('done', [
        'ok'                => true,
        'elapsed_ms'        => (int) round((microtime(true) - $t0) * 1000),
        'tokens_used'       => (int) $tokensUsed,
        'prompt_tokens'     => (int) $inTokens,
        'completion_tokens' => (int) $outTokens,
        'cost_usd'          => $costUsd,
        'credits_estimate'  => $credits,
        'model'             => $meta['model'] ?? ($model ?: ''),
        'db'                => $dbSchema,
        'fs'                => $fsRoot,
        'tools_fallback'    => $toolsFallback,
        'truncated'         => $truncated,
    ]);
} catch (Throwable $e) {
    $send('error', ['error' => "Error al conectar con $provider: " . $e->getMessage()]);
}
exit;
