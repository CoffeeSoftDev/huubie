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

$t0 = microtime(true);

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
$tokensUsed  = $result['eval_count'] ?? ($result['usage']['completion_tokens'] ?? 0);
$credits     = $tokensUsed > 0 ? round($tokensUsed / 1000, 4) : 0;
$modelUsed   = $result['model'] ?? ($model ?: 'qwen3-coder:480b-cloud');

echo json_encode([
    'ok'              => true,
    'reply'           => $reply,
    'model'           => $modelUsed,
    'elapsed_ms'      => $elapsed,
    'tokens_used'     => (int) $tokensUsed,
    'credits_estimate'=> $credits,
], JSON_UNESCAPED_UNICODE);
