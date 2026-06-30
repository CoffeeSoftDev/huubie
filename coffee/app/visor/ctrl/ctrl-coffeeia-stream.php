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
$allMessages = $ctx['messages'];
$dbSchema    = $ctx['db'] ?? null;
$fsRoot      = $ctx['fs'] ?? null;

$t0       = microtime(true);
$provider = llm_is_openrouter_model($model) ? 'OpenRouter' : 'Ollama';

// SELECT en vivo: si hay una base conectada, corremos las rondas de tool-calling de
// forma sincrona (sirve para OpenRouter y para modelos Ollama tool-capable como GLM o
// qwen3-coder) y luego emitimos la respuesta final. Si el modelo no soporta tools o
// falla, caemos al streaming normal (el esquema ya esta inyectado -> el grafico sale).
if ($dbSchema) {
    try {
        $client = llm_client_for($model);
        $onStatus = function ($sql) use ($send) {
            $send('thinking', ['t' => "\n[consultando {$sql}]\n"]);
        };
        $r = coffeeia_run_db_tools($client, $allMessages, $model, $dbSchema, $onStatus, 4);

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
        ]);
        exit;
    } catch (Throwable $e) {
        // Modelo sin tools o consulta fallida: aun NO emitimos chunks, asi que es
        // seguro continuar al streaming normal de abajo (con el esquema ya inyectado).
    }
}

// Carpeta conectada: navegacion de archivos por tool-calling (list_dir/read_file/
// grep_files), igual patron que la base de datos. Si el modelo no soporta tools o
// falla, caemos al streaming normal (el arbol ya esta inyectado en el contexto).
if ($fsRoot && !$dbSchema) {
    try {
        $client = llm_client_for($model);
        $onStatus = function ($label) use ($send) {
            $send('thinking', ['t' => "\n[{$label}]\n"]);
        };
        $r = coffeeia_run_fs_tools($client, $allMessages, $model, $fsRoot, $onStatus, 6);

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
        ]);
        exit;
    } catch (Throwable $e) {
        // Modelo sin tools o error: seguimos al streaming normal (arbol ya inyectado).
    }
}

try {
    $client = llm_client_for($model);
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
    ]);
} catch (Throwable $e) {
    $send('error', ['error' => "Error al conectar con $provider: " . $e->getMessage()]);
}
exit;
