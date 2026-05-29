<?php
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/ollama-client.php';

$raw = file_get_contents('php://input');
$body = json_decode($raw, true);

if (!is_array($body)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Payload JSON invalido']);
    exit;
}

$messages           = isset($body['messages']) && is_array($body['messages']) ? $body['messages'] : [];
$model              = isset($body['model']) && $body['model'] !== '' ? $body['model'] : null;
$currentFile        = isset($body['currentFile'])        ? trim($body['currentFile'])        : '';
$currentFilePath    = isset($body['currentFilePath'])    ? trim($body['currentFilePath'])    : '';
$currentFileContent = isset($body['currentFileContent']) ? $body['currentFileContent']       : '';
$customPath         = isset($body['customPath'])         ? trim($body['customPath'])         : '';

$systemPrompt = 'Eres CoffeeIA, asistente oficial del framework CoffeeSoft. ' .
    'Ayudas con modulos MVC (ctrl PHP + mdl PHP + JS), componentes jQuery con TailwindCSS, ' .
    'mockups (CoffeeMagic), validacion de BD via MCP. ' .
    'Responde en espanol, claro y directo. ' .
    'Si el usuario te pregunta sobre un archivo del visor, te pasare su contenido en el contexto.';

$prepend = [['role' => 'system', 'content' => $systemPrompt]];

// Estrategia para obtener el contenido del archivo actual:
// 1) Usar el contenido enviado por el frontend (ya lo tiene en memoria).
// 2) Si no, leer desde currentFilePath (ruta absoluta).
// 3) Fallback legacy: customPath + currentFile / .claude/agents + currentFile.
$fileContent = '';

if ($currentFileContent !== '') {
    $fileContent = $currentFileContent;
} elseif ($currentFilePath !== '' && is_file($currentFilePath)) {
    $read = @file_get_contents($currentFilePath);
    if ($read !== false) $fileContent = $read;
} elseif ($currentFile !== '') {
    $candidates = [];
    if ($customPath !== '') $candidates[] = $customPath . DIRECTORY_SEPARATOR . $currentFile;
    $agentsDir = realpath(__DIR__ . '/../../../../../.claude/agents');
    if ($agentsDir) $candidates[] = $agentsDir . DIRECTORY_SEPARATOR . $currentFile;
    foreach ($candidates as $cand) {
        if (is_file($cand)) {
            $read = @file_get_contents($cand);
            if ($read !== false) { $fileContent = $read; break; }
        }
    }
}

if ($currentFile !== '' && $fileContent !== '') {
    if (strlen($fileContent) > 16384) {
        $fileContent = substr($fileContent, 0, 16384) . "\n\n[... truncado a 16KB ...]";
    }
    $prepend[] = [
        'role'    => 'system',
        'content' => "Archivo abierto en el visor: {$currentFile}\n\n{$fileContent}"
    ];
}

$allMessages = array_merge($prepend, $messages);

$t0 = microtime(true);

try {
    $client = new OllamaClient();
    $result = $client->chat($allMessages, $model);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode(['ok' => false, 'error' => 'Error al conectar con Ollama: ' . $e->getMessage()]);
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
