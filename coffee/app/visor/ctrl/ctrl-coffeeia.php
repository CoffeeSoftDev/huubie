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
$editorMode         = !empty($body['editorMode']);

define('COFFEEIA_MAX_FILE_BYTES', 65536);

$systemPrompt = 'Eres CoffeeIA, asistente oficial del framework CoffeeSoft. ' .
    'Ayudas con modulos MVC (ctrl PHP + mdl PHP + JS), componentes jQuery con TailwindCSS, ' .
    'mockups (CoffeeMagic), validacion de BD via MCP. ' .
    'Responde en espanol, claro y directo.';

if ($editorMode) {
    $systemPrompt .= "\n\n=== MODO EDITOR ACTIVO ===\n" .
        "El usuario quiere modificar el ARCHIVO ABIERTO EN EL VISOR. Cuando te pida un cambio, responde en este formato EXACTO:\n\n" .
        "1) Una linea breve explicando que cambio vas a proponer (max 1 frase).\n" .
        "2) Uno o varios bloques <edit-replace> con el cambio puntual:\n\n" .
        "<edit-replace>\n" .
        "<find>texto EXACTO copiado del documento, caracter por caracter, incluyendo saltos de linea y espacios</find>\n" .
        "<with>texto nuevo que reemplaza al anterior</with>\n" .
        "</edit-replace>\n\n" .
        "REGLAS CRITICAS:\n" .
        "- El contenido de <find> DEBE existir literal en el archivo abierto. No parafrasees, no resumas, no cortes a la mitad de una palabra. Copia tal cual.\n" .
        "- Haz que <find> sea lo MINIMO indispensable para que sea unico en el documento. Si una frase corta podria aparecer varias veces, incluye lineas vecinas hasta que sea unica.\n" .
        "- Para varios cambios, emite varios bloques <edit-replace> consecutivos.\n" .
        "- NO uses ` ni codifiques el contenido. Pega texto plano dentro de <find> y <with>.\n" .
        "- NO modifiques los archivos anclados, solo el ARCHIVO ABIERTO.\n" .
        "- Si el usuario te hace una pregunta que NO pide editar, responde normal sin bloques.\n";
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
