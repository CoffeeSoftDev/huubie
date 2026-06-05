<?php
/**
 * Constructor de contexto compartido de CoffeeIA.
 *
 * Toma el body del request (mensajes + archivo abierto + anclados + modos) y
 * devuelve [messages, model] listos para pasar a cualquier cliente LLM.
 *
 * Lo usan por igual:
 *   - ctrl-coffeeia.php        (respuesta completa, JSON)
 *   - ctrl-coffeeia-stream.php (streaming SSE)
 * para que la logica de contexto no se duplique ni se desincronice.
 */

require_once __DIR__ . '/llm-client.php';
require_once __DIR__ . '/path-helper.php';

if (!defined('COFFEEIA_MAX_FILE_BYTES')) define('COFFEEIA_MAX_FILE_BYTES', 65536);
if (!defined('COFFEEIA_PROMPTS_DIR'))    define('COFFEEIA_PROMPTS_DIR', __DIR__ . '/../prompts');

/**
 * @param array $body  Payload JSON decodificado del request.
 * @return array{messages: array, model: ?string}
 */
function coffeeia_build_context(array $body) {
    $messages = isset($body['messages']) && is_array($body['messages']) ? $body['messages'] : [];
    $model    = isset($body['model']) && $body['model'] !== '' ? $body['model'] : null;

    // Normaliza cada mensaje a {role, content, images?} (descarta el preview dataUrl).
    $messages = array_map(function ($m) {
        if (!is_array($m)) return ['role' => 'user', 'content' => (string) $m];
        $out = [
            'role'    => isset($m['role']) ? $m['role'] : 'user',
            'content' => isset($m['content']) ? (string) $m['content'] : '',
        ];
        if (isset($m['images']) && is_array($m['images']) && !empty($m['images'])) {
            $imgs = [];
            foreach ($m['images'] as $img) {
                if (!is_string($img) || $img === '') continue;
                $imgs[] = preg_replace('/^data:[^;]+;base64,/', '', $img);
            }
            if (!empty($imgs)) $out['images'] = $imgs;
        }
        return $out;
    }, $messages);

    // Si hay imagenes y no se fijo modelo, enruta al modelo de vision.
    $hasImages = false;
    foreach ($messages as $m) { if (!empty($m['images'])) { $hasImages = true; break; } }
    if ($hasImages && ($model === null || $model === '')) {
        $model = llm_vision_model_for($model);
    }

    $currentFile        = isset($body['currentFile'])        ? trim($body['currentFile'])        : '';
    $currentFilePath    = isset($body['currentFilePath'])    ? trim($body['currentFilePath'])    : '';
    $currentFileContent = isset($body['currentFileContent']) ? $body['currentFileContent']       : '';
    $customPath         = isset($body['customPath'])         ? trim($body['customPath'])         : '';
    $editorMode         = !empty($body['editorMode']);
    $canvasMode         = !empty($body['canvasMode']);

    // "Alma" de Coffee (identidad + capacidades).
    // El Playground puede inyectar el prompt de un agente concreto via
    // `systemOverride`; si no viene, se usa el alma por defecto (coffee-system.md).
    // Cambio puramente aditivo: el Visor nunca manda systemOverride → mismo comportamiento.
    $systemOverride = isset($body['systemOverride']) ? trim((string) $body['systemOverride']) : '';
    if ($systemOverride !== '') {
        $systemPrompt = $systemOverride;
    } else {
        $soulPath     = COFFEEIA_PROMPTS_DIR . '/coffee-system.md';
        $systemPrompt = is_file($soulPath) ? (string) @file_get_contents($soulPath) : '';
        if (trim($systemPrompt) === '') {
            $systemPrompt = 'Eres CoffeeIA, asistente oficial del framework CoffeeSoft. Responde en espanol, claro y directo.';
        }
    }
    if ($editorMode) {
        $editorPath = COFFEEIA_PROMPTS_DIR . '/editor-mode.md';
        if (is_file($editorPath)) {
            $editorBlock = trim((string) @file_get_contents($editorPath));
            if ($editorBlock !== '') $systemPrompt .= "\n\n" . $editorBlock . "\n";
        }
    }
    if ($canvasMode) {
        $canvasPath = COFFEEIA_PROMPTS_DIR . '/lienzo-mode.md';
        if (is_file($canvasPath)) {
            $canvasBlock = trim((string) @file_get_contents($canvasPath));
            if ($canvasBlock !== '') $systemPrompt .= "\n\n" . $canvasBlock . "\n";
        }
    }

    // Contenido del archivo actual: enviado por el front, o leido de disco.
    $fileContent = '';
    if ($currentFileContent !== '') {
        $fileContent = $currentFileContent;
    } elseif ($currentFilePath !== '' && is_file($currentFilePath)) {
        $read = @file_get_contents($currentFilePath);
        if ($read !== false) $fileContent = $read;
    } elseif ($currentFile !== '') {
        $candidates = [];
        if ($customPath !== '') $candidates[] = $customPath . DIRECTORY_SEPARATOR . $currentFile;
        // Resolver el .claude real (Apache como servicio no tiene USERPROFILE util).
        if (function_exists('coffee_user_home')) {
            $agentsDir = coffee_user_home() . '/.claude/agents';
        } else {
            $agentsDir = realpath(__DIR__ . '/../../../../../.claude/agents');
        }
        if ($agentsDir && is_dir($agentsDir)) $candidates[] = $agentsDir . DIRECTORY_SEPARATOR . $currentFile;
        foreach ($candidates as $cand) {
            if (is_file($cand)) {
                $read = @file_get_contents($cand);
                if ($read !== false) { $fileContent = $read; break; }
            }
        }
    }

    // Documentos en contexto: el actual + los anclados.
    $ctxDocs = [];
    if ($currentFile !== '' && $fileContent !== '') {
        if (strlen($fileContent) > COFFEEIA_MAX_FILE_BYTES) {
            // mb_strcut corta por bytes SIN partir un caracter UTF-8 multibyte.
            // (substr partia el ultimo caracter -> UTF-8 invalido -> json_encode
            // fallaba -> body vacio -> Ollama respondia "HTTP 400: EOF".)
            $fileContent = mb_strcut($fileContent, 0, COFFEEIA_MAX_FILE_BYTES, 'UTF-8') . "\n\n[... truncado a 64KB ...]";
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
            $pfContent = mb_strcut($pfContent, 0, COFFEEIA_MAX_FILE_BYTES, 'UTF-8') . "\n\n[... truncado a 64KB ...]";
        }
        $ctxDocs[] = ['label' => 'archivo anclado al contexto', 'name' => $pfName, 'content' => $pfContent];
    }

    // Consolida todo en un unico mensaje system.
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
    return ['messages' => array_merge($prepend, $messages), 'model' => $model];
}
