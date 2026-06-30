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
require_once __DIR__ . '/db-introspect.php';
require_once __DIR__ . '/fs-introspect.php';

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
    $graphMode          = isset($body['graphMode']) ? trim((string) $body['graphMode']) : '';
    $graphTemplate      = isset($body['graphTemplate']) ? trim((string) $body['graphTemplate']) : '';

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
    // Modo grafica: la IA genera diagramas del tipo elegido (mermaid/drawio/excalidraw).
    if (in_array($graphMode, ['mermaid', 'drawio', 'excalidraw'], true)) {
        $graphPath = COFFEEIA_PROMPTS_DIR . '/grafica-' . $graphMode . '.md';
        if (is_file($graphPath)) {
            $graphBlock = trim((string) @file_get_contents($graphPath));
            if ($graphBlock !== '') $systemPrompt .= "\n\n" . $graphBlock . "\n";
        }
        // Sub-modo plantilla de Excalidraw: maestros corporativos por grupo + tabla
        // de campos en una sola etiqueta. Se anade DESPUES de las reglas base.
        if ($graphMode === 'excalidraw' && $graphTemplate === 'template') {
            $tplPath = COFFEEIA_PROMPTS_DIR . '/grafica-excalidraw-template.md';
            if (is_file($tplPath)) {
                $tplBlock = trim((string) @file_get_contents($tplPath));
                if ($tplBlock !== '') $systemPrompt .= "\n\n" . $tplBlock . "\n";
            }
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
        $abiertoLabel = $editorMode
            ? 'archivo abierto en el visor (TEXTO CRUDO — copia de aqui LITERAL para los <find>)'
            : 'archivo abierto en el visor';
        $ctxDocs[] = ['label' => $abiertoLabel, 'name' => $currentFile, 'content' => $fileContent];
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

    // ── Conexion a base de datos por lenguaje natural ───────────────────────────
    // Si el usuario pide "conectate a la base de X" / "diagrama de la base X", el
    // backend resuelve X contra las bases locales reales, lee su esquema y lo inyecta
    // como FUENTE DE VERDAD. Las credenciales viven en db-config (server-side).
    $dbConnect = isset($body['dbConnect']) ? trim((string) $body['dbConnect']) : '';
    $dbSchema  = null;

    $lastUser = '';
    for ($i = count($messages) - 1; $i >= 0; $i--) {
        if (($messages[$i]['role'] ?? '') === 'user') { $lastUser = (string)($messages[$i]['content'] ?? ''); break; }
    }

    // Desambiguacion BD vs CARPETA: la palabra calificadora manda. "tabla/base/esquema X"
    // -> base de datos; "carpeta/proyecto/directorio X" -> filesystem. Asi un nombre que
    // existe como ambas (p.ej. una tabla y una carpeta homonimas) no se confunde. Si el
    // usuario no califica y el nombre resuelve a ambas, mas abajo se pide que aclare.
    $dbExplicit = (bool) preg_match('/(base\s+de\s+datos|\bbases?\b|\besquema\b|\bschema\b|\bbd\b|\btablas?\b|modelo\s+de\s+datos)/iu', $lastUser);
    $fsExplicit = (bool) preg_match('/(\bcarpeta\b|\bproyecto\b|\bdirectorio\b|\bfolder\b|\brepositorio\b|\brepo\b|c[oó]digo\b|\barchivos?\b)/iu', $lastUser);

    // Gate barato: solo intentamos tocar MySQL si el mensaje huele a "base de datos".
    // El guard REAL es que ademas aparezca el alias de una base existente (db_detect_request),
    // asi que podemos ser amplios aqui sin inyectar de mas. Si el turno califica
    // explicitamente "carpeta/proyecto" (y NO "base/tabla"), no resolvemos como base.
    $dbIntentRe = '/(con[eé]ct\w*|\bbase\b|\besquema\b|\bschema\b|\bbd\b|\btablas?\b|modelo\s+de\s+datos)/iu';
    $wantDb = (($dbConnect !== '') || (bool) preg_match($dbIntentRe, $lastUser)) && !($fsExplicit && !$dbExplicit);

    if ($wantDb) {
        try {
            // 1) El mensaje ACTUAL manda: si nombra una base, cambia/define la conexion.
            $det = db_detect_request($lastUser, true);
            if ($det && $det['schema']) {
                $dbSchema = $det['schema'];
            } elseif ($det && !empty($det['candidates'])) {
                $systemBlock .= "\n\n=== BASE DE DATOS ===\n"
                    . "El usuario menciono una base ambigua. Candidatos: "
                    . implode(', ', $det['candidates'])
                    . ". Pide que elija una (por nombre exacto) antes de generar nada.\n";
            } elseif ($dbConnect !== '') {
                // 2) Sin base nombrada en este mensaje: mantiene la conexion pegajosa
                //    de la conversacion (el front reenvia la ultima base conectada).
                $dbSchema = db_canonical_schema($dbConnect);
            }
            if ($dbSchema) {
                $digest = db_schema_digest($dbSchema);
                $systemBlock .= "\n\n=== ESQUEMA DE BASE DE DATOS (FUENTE DE VERDAD) ===\n"
                    . "Te conectaste a la base '{$dbSchema}'. Usa EXCLUSIVAMENTE estos nombres reales de\n"
                    . "tablas y columnas (no inventes). Para diagramas, dibuja las tablas y relaciones\n"
                    . "reales que aparecen aqui.\n"
                    . "Si necesitas datos reales (conteos, ejemplos, agregados), ejecuta consultas SELECT\n"
                    . "de SOLO LECTURA con la herramienta run_select; nunca inventes numeros.\n"
                    . "Cuando muestres registros/filas, formatealos SIEMPRE como TABLA markdown\n"
                    . "(| columna | columna |\\n| --- | --- |\\n| valor | valor |), nunca como lista ni texto corrido.\n"
                    . "\n" . $digest;
            }
        } catch (Throwable $e) {
            $systemBlock .= "\n\n=== BASE DE DATOS ===\n"
                . "No se pudo leer el esquema solicitado: " . $e->getMessage() . "\n";
        }

        // Formato de salida para ESTRUCTURA de tablas: cajas monoespaciadas + diagrama
        // ASCII + Cardinalidades (db-rules.md §3.1) en vez de mermaid erDiagram/CREATE
        // TABLE. Solo cuando se trabaja con BD y NO hay un modo grafica explicito activo
        // (mermaid/excalidraw/drawio se respetan tal cual los eligio el usuario).
        if ($graphMode === '') {
            $fmtPath = COFFEEIA_PROMPTS_DIR . '/formato-tablas-caja.md';
            if (is_file($fmtPath)) {
                $fmt = trim((string) @file_get_contents($fmtPath));
                if ($fmt !== '') $systemBlock .= "\n\n" . $fmt . "\n";
            }
        }
    }

    // ── Conexion a una CARPETA local por lenguaje natural ───────────────────────
    // "conectate a la carpeta costsys y dime como se calcula el costo" -> el backend
    // resuelve costsys contra la whitelist (FS_ALLOWED_ROOTS), inyecta su arbol como
    // FUENTE DE VERDAD y deja que el modelo lea archivos bajo demanda (list_dir/
    // read_file/grep_files). El acceso esta sandbox-eado a esa carpeta.
    $folderConnect = isset($body['folderConnect']) ? trim((string) $body['folderConnect']) : '';
    $fsRoot = null;

    // Si el turno califica explicitamente "base/tabla/esquema" (y NO "carpeta/proyecto"),
    // no resolvemos como carpeta: es una consulta de BD.
    $fsIntentRe = '/(con[eé]ct\w*|\bcarpeta\b|\bproyecto\b|\bdirectorio\b|\bfolder\b|\brepositorio\b|\brepo\b|c[oó]digo\s+de)/iu';
    $wantFs = (($folderConnect !== '') || (bool) preg_match($fsIntentRe, $lastUser)) && !($dbExplicit && !$fsExplicit);

    if ($wantFs) {
        try {
            // El mensaje ACTUAL manda: si nombra una carpeta, cambia/define la conexion.
            // Solo escaneamos el indice de carpetas si el mensaje tiene intencion
            // explicita; si ya hay conexion pegajosa y el turno no habla de carpetas,
            // reusamos la ruta sin reindexar.
            $det = preg_match($fsIntentRe, $lastUser) ? fs_detect_request($lastUser, true) : null;
            if ($det && $det['path']) {
                $fsRoot = $det['path'];
            } elseif ($det && !empty($det['candidates'])) {
                $systemBlock .= "\n\n=== CARPETA ===\n"
                    . "El usuario menciono una carpeta ambigua. Candidatos: "
                    . implode(', ', array_map('basename', $det['candidates']))
                    . ". Pide que elija una (por nombre exacto) antes de continuar.\n";
            } elseif ($folderConnect !== '') {
                // Sin carpeta nombrada en este mensaje: mantiene la conexion pegajosa.
                $fsRoot = fs_canonical_folder($folderConnect);
            }
            if ($fsRoot) {
                $tree = fs_tree_digest($fsRoot);
                $systemBlock .= "\n\n=== CARPETA CONECTADA (FUENTE DE VERDAD) ===\n"
                    . "Te conectaste a la carpeta '" . basename($fsRoot) . "'. Para responder usa\n"
                    . "EXCLUSIVAMENTE su contenido real: explora con list_dir, localiza con grep_files y\n"
                    . "lee con read_file (todas SOLO LECTURA). Nunca inventes rutas ni codigo: si no estas\n"
                    . "seguro, abre el archivo. Cita las rutas relativas de los archivos que uses.\n"
                    . "\n" . $tree;
            }
        } catch (Throwable $e) {
            $systemBlock .= "\n\n=== CARPETA ===\n"
                . "No se pudo conectar a la carpeta solicitada: " . $e->getMessage() . "\n";
        }
    }

    // Ambiguedad real: el nombre resolvio a la vez una BASE y una CARPETA homonimas y el
    // usuario no califico cual. No adivinamos: pedimos que aclare y no activamos ninguna
    // herramienta (el esquema/arbol ya inyectados le dan contexto para preguntar bien).
    if ($dbSchema && $fsRoot) {
        $systemBlock .= "\n\n=== ACLARAR: BASE DE DATOS vs CARPETA ===\n"
            . "El nombre solicitado coincide a la vez con una BASE DE DATOS ('{$dbSchema}') y con\n"
            . "una CARPETA ('" . basename($fsRoot) . "'). NO asumas cual: pregunta al usuario si se\n"
            . "refiere a la base de datos o a la carpeta de archivos antes de continuar.\n";
        $dbSchema = null;
        $fsRoot   = null;
    }

    $prepend = [['role' => 'system', 'content' => $systemBlock]];
    return ['messages' => array_merge($prepend, $messages), 'model' => $model, 'db' => $dbSchema, 'fs' => $fsRoot];
}

/**
 * Suma incremental de los contadores de uso (tokens/costo) entre rondas de tool-calling.
 */
function coffeeia_merge_usage(array $acc, array $u) {
    foreach (['prompt_tokens', 'completion_tokens', 'total_tokens'] as $k) {
        if (isset($u[$k])) $acc[$k] = ($acc[$k] ?? 0) + (int) $u[$k];
    }
    if (isset($u['cost'])) $acc['cost'] = ($acc['cost'] ?? 0) + (float) $u['cost'];
    return $acc;
}

/**
 * Normaliza el uso de tokens de una respuesta de chat sin importar el proveedor:
 * OpenRouter lo trae en usage.{prompt,completion}_tokens; Ollama en la raiz como
 * prompt_eval_count / eval_count.
 */
function coffeeia_extract_usage(array $res) {
    $u = isset($res['usage']) && is_array($res['usage']) ? $res['usage'] : [];
    if (!isset($u['prompt_tokens'])     && isset($res['prompt_eval_count'])) $u['prompt_tokens']     = (int) $res['prompt_eval_count'];
    if (!isset($u['completion_tokens']) && isset($res['eval_count']))        $u['completion_tokens'] = (int) $res['eval_count'];
    return $u;
}

/**
 * Loop agentico de SOLO LECTURA: deja que el modelo invoque run_select contra la base
 * conectada, ejecuta las consultas y le devuelve las filas, hasta que produce su
 * respuesta final (o se agota el tope de rondas). NO hace streaming: corre las rondas
 * de herramienta de forma sincrona; el endpoint emite el texto final despues.
 *
 * @param object   $client    cliente LLM con chat() que soporte 'tools'.
 * @param array    $messages  mensajes ya armados (incluye el system con el esquema).
 * @param string   $model
 * @param string   $schema    base conectada.
 * @param callable $onStatus  fn(string) opcional para avisar "consultando ..." al UI.
 * @return array{final: string, usage: array, rounds: int}
 */
function coffeeia_run_db_tools($client, array $messages, $model, $schema, callable $onStatus = null, $maxRounds = 4) {
    $tools = db_tool_specs();
    $usage = [];
    $final = '';
    $rounds = 0;

    for ($round = 0; $round < $maxRounds; $round++) {
        $rounds = $round + 1;
        $res = $client->chat($messages, $model, ['tools' => $tools]);
        $usage = coffeeia_merge_usage($usage, coffeeia_extract_usage($res));

        $toolCalls = $res['tool_calls'] ?? [];
        if (empty($toolCalls)) {                       // el modelo ya respondio
            $final = (string)($res['content'] ?? '');
            break;
        }

        // Registra el turno del asistente (con las llamadas) y ejecuta cada herramienta.
        $messages[] = [
            'role'       => 'assistant',
            'content'    => (string)($res['content'] ?? ''),
            'tool_calls' => $toolCalls,
        ];
        foreach ($toolCalls as $tc) {
            $fn  = $tc['function']['name'] ?? '';
            // OpenRouter manda arguments como STRING JSON; Ollama como OBJETO ya parseado.
            $raw = $tc['function']['arguments'] ?? '{}';
            $args = is_array($raw) ? $raw : json_decode((string) $raw, true);
            if (!is_array($args)) $args = [];
            if ($onStatus) $onStatus(isset($args['sql']) ? $args['sql'] : $fn);
            $result = db_run_tool($fn, $args, $schema);
            $messages[] = [
                'role'         => 'tool',
                'tool_call_id' => $tc['id'] ?? '',
                'name'         => $fn,
                'content'      => $result,
            ];
        }
    }

    // Si agoto las rondas pidiendo herramientas sin cerrar, fuerza una respuesta final.
    if ($final === '') {
        $res = $client->chat($messages, $model, []);
        $usage = coffeeia_merge_usage($usage, coffeeia_extract_usage($res));
        $final = (string)($res['content'] ?? '');
    }

    return ['final' => $final, 'usage' => $usage, 'rounds' => $rounds];
}

/**
 * Loop agentico de SOLO LECTURA sobre una CARPETA conectada: deja que el modelo
 * invoque list_dir/read_file/grep_files para navegar el proyecto, ejecuta cada
 * herramienta (sandbox a $root) y le devuelve el resultado, hasta su respuesta final
 * (o el tope de rondas). Gemelo de coffeeia_run_db_tools pero para el filesystem.
 *
 * @param object   $client    cliente LLM con chat() que soporte 'tools'.
 * @param array    $messages  mensajes ya armados (incluye el system con el arbol).
 * @param string   $model
 * @param string   $root      carpeta conectada (ruta absoluta ya resuelta).
 * @param callable $onStatus  fn(string) opcional para avisar "leyendo ..." al UI.
 * @return array{final: string, usage: array, rounds: int}
 */
function coffeeia_run_fs_tools($client, array $messages, $model, $root, callable $onStatus = null, $maxRounds = 6) {
    $tools = fs_tool_specs();
    $usage = [];
    $final = '';
    $rounds = 0;

    for ($round = 0; $round < $maxRounds; $round++) {
        $rounds = $round + 1;
        $res = $client->chat($messages, $model, ['tools' => $tools]);
        $usage = coffeeia_merge_usage($usage, coffeeia_extract_usage($res));

        $toolCalls = $res['tool_calls'] ?? [];
        if (empty($toolCalls)) {                       // el modelo ya respondio
            $final = (string)($res['content'] ?? '');
            break;
        }

        $messages[] = [
            'role'       => 'assistant',
            'content'    => (string)($res['content'] ?? ''),
            'tool_calls' => $toolCalls,
        ];
        foreach ($toolCalls as $tc) {
            $fn  = $tc['function']['name'] ?? '';
            // OpenRouter manda arguments como STRING JSON; Ollama como OBJETO ya parseado.
            $raw = $tc['function']['arguments'] ?? '{}';
            $args = is_array($raw) ? $raw : json_decode((string) $raw, true);
            if (!is_array($args)) $args = [];
            if ($onStatus) $onStatus(fs_tool_label($fn, $args));
            $result = fs_run_tool($fn, $args, $root);
            $messages[] = [
                'role'         => 'tool',
                'tool_call_id' => $tc['id'] ?? '',
                'name'         => $fn,
                'content'      => $result,
            ];
        }
    }

    if ($final === '') {
        $res = $client->chat($messages, $model, []);
        $usage = coffeeia_merge_usage($usage, coffeeia_extract_usage($res));
        $final = (string)($res['content'] ?? '');
    }

    return ['final' => $final, 'usage' => $usage, 'rounds' => $rounds];
}
