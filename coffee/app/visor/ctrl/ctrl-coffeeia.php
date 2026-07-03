<?php
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/coffeeia-context.php';

$raw  = file_get_contents('php://input');
$body = json_decode($raw, true);

if (!is_array($body)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Payload JSON invalido']);
    exit;
}

$ctx         = coffeeia_build_context($body);
$model       = $ctx['model'];
$allMessages = $ctx['messages'];
$dbSchema    = $ctx['db'] ?? null;
$fsRoot      = $ctx['fs'] ?? null;
$canvasMode  = !empty($ctx['canvas']);

$t0 = microtime(true);

// Carpeta + base conectadas A LA VEZ: loop HIBRIDO con ambas familias de herramientas
// (leer codigo real + consultar datos reales). Si el modelo no soporta tools o falla,
// caemos al chat normal de abajo (arbol y esquema ya van inyectados en el contexto).
if ($dbSchema && $fsRoot) {
    try {
        $client = llm_client_for($model);
        $r = coffeeia_run_hybrid_tools($client, $allMessages, $model, $dbSchema, $fsRoot, null, $canvasMode ? 12 : 8);
        $usage = $r['usage'];
        echo json_encode([
            'ok'                => true,
            'reply'             => $r['final'],
            'model'             => $model,
            'elapsed_ms'        => (int) round((microtime(true) - $t0) * 1000),
            'tokens_used'       => (int)($usage['completion_tokens'] ?? 0),
            'prompt_tokens'     => (int)($usage['prompt_tokens'] ?? 0),
            'completion_tokens' => (int)($usage['completion_tokens'] ?? 0),
            'cost_usd'          => isset($usage['cost']) ? (float) $usage['cost'] : null,
            'credits_estimate'  => isset($usage['completion_tokens']) ? round($usage['completion_tokens'] / 1000, 4) : 0,
            'db'                => $dbSchema,
            'fs'                => $fsRoot,
        ], JSON_UNESCAPED_UNICODE);
        exit;
    } catch (Throwable $e) {
        // Modelo sin tools o error: seguimos al chat normal de abajo.
    }
}

// SELECT en vivo: base conectada (sin carpeta) -> loop de tool-calling (OpenRouter u
// Ollama tool-capable). Si el modelo no soporta tools o falla, caemos al chat normal
// de abajo (el esquema ya esta inyectado en el contexto).
if ($dbSchema && !$fsRoot) {
    try {
        $client = llm_client_for($model);
        $r = coffeeia_run_db_tools($client, $allMessages, $model, $dbSchema, null, 4);
        $usage = $r['usage'];
        echo json_encode([
            'ok'                => true,
            'reply'             => $r['final'],
            'model'             => $model,
            'elapsed_ms'        => (int) round((microtime(true) - $t0) * 1000),
            'tokens_used'       => (int)($usage['completion_tokens'] ?? 0),
            'prompt_tokens'     => (int)($usage['prompt_tokens'] ?? 0),
            'completion_tokens' => (int)($usage['completion_tokens'] ?? 0),
            'cost_usd'          => isset($usage['cost']) ? (float) $usage['cost'] : null,
            'credits_estimate'  => isset($usage['completion_tokens']) ? round($usage['completion_tokens'] / 1000, 4) : 0,
            'db'                => $dbSchema,
        ], JSON_UNESCAPED_UNICODE);
        exit;
    } catch (Throwable $e) {
        // Modelo sin tools o consulta fallida: seguimos al chat normal de abajo.
    }
}

// Carpeta conectada: navegacion por tool-calling (list_dir/read_file/grep_files).
// Si el modelo no soporta tools o falla, caemos al chat normal (arbol ya inyectado).
if ($fsRoot && !$dbSchema) {
    try {
        $client = llm_client_for($model);
        $r = coffeeia_run_fs_tools($client, $allMessages, $model, $fsRoot, null, $canvasMode ? 10 : 6);
        $usage = $r['usage'];
        echo json_encode([
            'ok'                => true,
            'reply'             => $r['final'],
            'model'             => $model,
            'elapsed_ms'        => (int) round((microtime(true) - $t0) * 1000),
            'tokens_used'       => (int)($usage['completion_tokens'] ?? 0),
            'prompt_tokens'     => (int)($usage['prompt_tokens'] ?? 0),
            'completion_tokens' => (int)($usage['completion_tokens'] ?? 0),
            'cost_usd'          => isset($usage['cost']) ? (float) $usage['cost'] : null,
            'credits_estimate'  => isset($usage['completion_tokens']) ? round($usage['completion_tokens'] / 1000, 4) : 0,
            'fs'                => $fsRoot,
        ], JSON_UNESCAPED_UNICODE);
        exit;
    } catch (Throwable $e) {
        // Modelo sin tools o error: seguimos al chat normal de abajo.
    }
}

try {
    $client = llm_client_for($model);
    $result = $client->chat($allMessages, $model);
} catch (Throwable $e) {
    http_response_code(500);
    $provider = llm_is_openrouter_model($model) ? 'OpenRouter' : 'Ollama';
    echo json_encode(['ok' => false, 'error' => "Error al conectar con $provider: " . $e->getMessage()]);
    exit;
}

$elapsed = (int) round((microtime(true) - $t0) * 1000);

$reply       = $result['message']['content'] ?? ($result['response'] ?? '');
$usage       = isset($result['usage']) && is_array($result['usage']) ? $result['usage'] : [];
$modelUsed   = $result['model'] ?? ($model ?: 'qwen3-coder:480b-cloud');

// Desglose de tokens. Ollama usa prompt_eval_count/eval_count; OpenRouter (dialecto
// OpenAI) usa prompt_tokens/completion_tokens. Tomamos lo que exista.
$inTokens    = $result['prompt_eval_count'] ?? ($usage['prompt_tokens']     ?? 0);
$outTokens   = $result['eval_count']        ?? ($usage['completion_tokens'] ?? 0);
$tokensUsed  = (int) $outTokens;

// Costo REAL en USD: solo OpenRouter lo devuelve (usage.cost) gracias a usage.include.
// Para Ollama (local/cloud propio) no hay costo monetario -> null.
$costUsd     = isset($usage['cost']) ? (float) $usage['cost'] : null;

// "Credits" estimado heredado (tokens de salida / 1000). Se mantiene como fallback
// para Ollama, donde no hay costo real que mostrar.
$credits     = $tokensUsed > 0 ? round($tokensUsed / 1000, 4) : 0;

echo json_encode([
    'ok'              => true,
    'reply'           => $reply,
    'model'           => $modelUsed,
    'elapsed_ms'      => $elapsed,
    'tokens_used'     => (int) $tokensUsed,
    'prompt_tokens'   => (int) $inTokens,
    'completion_tokens'=> (int) $outTokens,
    'cost_usd'        => $costUsd,
    'credits_estimate'=> $credits,
], JSON_UNESCAPED_UNICODE);
