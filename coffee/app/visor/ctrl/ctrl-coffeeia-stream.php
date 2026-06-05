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

$t0       = microtime(true);
$provider = llm_is_openrouter_model($model) ? 'OpenRouter' : 'Ollama';

try {
    $client = llm_client_for($model);
    if (!method_exists($client, 'chatStream')) {
        throw new Exception('El proveedor no soporta streaming.');
    }

    $result = $client->chatStream($allMessages, $model, [], function ($piece) use ($send) {
        if ($piece !== '') $send('chunk', ['t' => $piece]);
    });

    $meta       = isset($result['meta']) && is_array($result['meta']) ? $result['meta'] : [];
    $tokensUsed = $meta['eval_count'] ?? ($meta['usage']['completion_tokens'] ?? 0);
    $credits    = $tokensUsed > 0 ? round($tokensUsed / 1000, 4) : 0;

    $send('done', [
        'ok'               => true,
        'elapsed_ms'       => (int) round((microtime(true) - $t0) * 1000),
        'tokens_used'      => (int) $tokensUsed,
        'credits_estimate' => $credits,
        'model'            => $meta['model'] ?? ($model ?: ''),
    ]);
} catch (Throwable $e) {
    $send('error', ['error' => "Error al conectar con $provider: " . $e->getMessage()]);
}
exit;
