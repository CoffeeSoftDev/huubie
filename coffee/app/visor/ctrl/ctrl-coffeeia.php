<?php
header('Content-Type: application/json; charset=utf-8');

require_once __DIR__ . '/llm-client.php';

$raw = file_get_contents('php://input');
$body = json_decode($raw, true);

if (!is_array($body)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Payload JSON invalido']);
    exit;
}

$messages           = isset($body['messages']) && is_array($body['messages']) ? $body['messages'] : [];
$model              = isset($body['model']) && $body['model'] !== '' ? $body['model'] : null;

// Normaliza cada mensaje para que solo conserve los campos que Ollama espera
// (role, content, images). Esto evita reenviar el preview dataUrl al backend.
$messages = array_map(function ($m) {
    if (!is_array($m)) return ['role' => 'user', 'content' => (string) $m];
    $out = [
        'role'    => isset($m['role']) ? $m['role'] : 'user',
        'content' => isset($m['content']) ? (string) $m['content'] : '',
    ];
    if (isset($m['images']) && is_array($m['images']) && !empty($m['images'])) {
        // Saneamos: aceptamos solo strings base64 (sin prefijo data:).
        $imgs = [];
        foreach ($m['images'] as $img) {
            if (!is_string($img) || $img === '') continue;
            $imgs[] = preg_replace('/^data:[^;]+;base64,/', '', $img);
        }
        if (!empty($imgs)) $out['images'] = $imgs;
    }
    return $out;
}, $messages);

// Detecta si alguno de los mensajes incluye imagenes para enrutar al modelo de vision.
$hasImages = false;
foreach ($messages as $m) {
    if (!empty($m['images'])) { $hasImages = true; break; }
}
if ($hasImages && ($model === null || $model === '')) {
    $model = llm_vision_model_for($model);
}

$currentFile        = isset($body['currentFile'])        ? trim($body['currentFile'])        : '';
$currentFilePath    = isset($body['currentFilePath'])    ? trim($body['currentFilePath'])    : '';
$currentFileContent = isset($body['currentFileContent']) ? $body['currentFileContent']       : '';
$customPath         = isset($body['customPath'])         ? trim($body['customPath'])         : '';
$editorMode         = !empty($body['editorMode']);
$canvasMode         = !empty($body['canvasMode']);

define('COFFEEIA_MAX_FILE_BYTES', 65536);
define('COFFEEIA_PROMPTS_DIR', __DIR__ . '/../prompts');

// Carga el "alma" de Coffee (identidad + capacidades de render) desde markdown
// externo, editable sin tocar PHP. Si falta el archivo, usa un fallback minimo.
$soulPath     = COFFEEIA_PROMPTS_DIR . '/coffee-system.md';
$systemPrompt = is_file($soulPath) ? (string) @file_get_contents($soulPath) : '';
if (trim($systemPrompt) === '') {
    $systemPrompt = 'Eres CoffeeIA, asistente oficial del framework CoffeeSoft. Responde en espanol, claro y directo.';
}

// El modo editor agrega su bloque de instrucciones desde otro markdown externo.
if ($editorMode) {
    $editorPath = COFFEEIA_PROMPTS_DIR . '/editor-mode.md';
    if (is_file($editorPath)) {
        $editorBlock = trim((string) @file_get_contents($editorPath));
        if ($editorBlock !== '') {
            $systemPrompt .= "\n\n" . $editorBlock . "\n";
        }
    }
}

// El modo lienzo reactiva la generacion de componentes HTML renderizables
// (el frontend los muestra como vista previa en iframe). Solo bajo demanda.
if ($canvasMode) {
    $canvasPath = COFFEEIA_PROMPTS_DIR . '/lienzo-mode.md';
    if (is_file($canvasPath)) {
        $canvasBlock = trim((string) @file_get_contents($canvasPath));
        if ($canvasBlock !== '') {
            $systemPrompt .= "\n\n" . $canvasBlock . "\n";
        }
    }
}

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

// Recolecta documentos en contexto: el actual + los anclados.
$ctxDocs = [];

if ($currentFile !== '' && $fileContent !== '') {
    if (strlen($fileContent) > COFFEEIA_MAX_FILE_BYTES) {
        $fileContent = substr($fileContent, 0, COFFEEIA_MAX_FILE_BYTES) . "\n\n[... truncado a 64KB ...]";
    }
    $ctxDocs[] = ['label' => 'archivo abierto en el visor', 'name' => $currentFile, 'content' => $fileContent];
}

$pinnedFiles = isset($body['pinnedFiles']) && is_array($body['pinnedFiles']) ? $body['pinnedFiles'] : [];
foreach ($pinnedFiles as $pf) {
    if (!is_array($pf)) continue;
    $pfName = isset($pf['file']) ? trim($pf['file']) : '';
    if ($pfName === '' || $pfName === $currentFile) continue;
    $pfContent = isset($pf['content']) ? $pf['content'] : '';
    if ($pfContent === '' && !empty($pf['fullPath']) && is_file($pf['fullPath'])) {
        $read = @file_get_contents($pf['fullPath']);
        if ($read !== false) $pfContent = $read;
    }
    if ($pfContent === '') continue;
    if (strlen($pfContent) > COFFEEIA_MAX_FILE_BYTES) {
        $pfContent = substr($pfContent, 0, COFFEEIA_MAX_FILE_BYTES) . "\n\n[... truncado a 64KB ...]";
    }
    $ctxDocs[] = ['label' => 'archivo anclado al contexto', 'name' => $pfName, 'content' => $pfContent];
}

// Consolidamos todo en un solo mensaje system (algunos endpoints de Ollama Cloud
// ignoran systems consecutivos).
$systemBlock = $systemPrompt;
if (!empty($ctxDocs)) {
    $systemBlock .= "\n\n=== DOCUMENTOS EN CONTEXTO ===\n";
    $systemBlock .= "El usuario ha cargado los siguientes documentos. Usalos como fuente de verdad para responder:\n\n";
    foreach ($ctxDocs as $doc) {
        $systemBlock .= "--- INICIO DOC ({$doc['label']}): {$doc['name']} ---\n";
        $systemBlock .= $doc['content'];
        $systemBlock .= "\n--- FIN DOC: {$doc['name']} ---\n\n";
    }
}

$prepend = [['role' => 'system', 'content' => $systemBlock]];

$allMessages = array_merge($prepend, $messages);

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
