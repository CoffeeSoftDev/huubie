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
require_once __DIR__ . '/web-fetch.php';

if (!defined('COFFEEIA_MAX_FILE_BYTES')) define('COFFEEIA_MAX_FILE_BYTES', 65536);
if (!defined('COFFEEIA_PROMPTS_DIR'))    define('COFFEEIA_PROMPTS_DIR', __DIR__ . '/../prompts');

/**
 * @param array $body  Payload JSON decodificado del request.
 * @return array{messages: array, model: ?string}
 */
function coffeeia_build_context(array $body) {
    $messages = isset($body['messages']) && is_array($body['messages']) ? $body['messages'] : [];
    $model    = isset($body['model']) && $body['model'] !== '' ? $body['model'] : null;
    // Esfuerzo de razonamiento elegido en la UI (selector). Se valida contra la
    // lista permitida; cualquier otro valor equivale a 'auto' (default del modelo).
    $effort   = isset($body['effort']) ? trim((string) $body['effort']) : '';
    if (!in_array($effort, ['off', 'low', 'medium', 'high', 'max'], true)) $effort = '';

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
    // Modo de uso de la base. 'data' (Playground): el modelo CONSTRUYE una UI poblada
    // con datos reales (run_select), por eso NO se inyecta el formato de cajas ASCII ni
    // se le pide describir el esquema. Vacio (Visor): comportamiento clasico (describir/
    // diagramar el esquema, filas como tabla markdown).
    $dbMode    = isset($body['dbMode']) ? trim((string) $body['dbMode']) : '';
    $dbSchema  = null;
    $dbFromMessage = false;   // true si la base la NOMBRO el usuario en este turno (no pegajosa)

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

    // Interruptores de herramientas (Playground): permiten APAGAR la resolucion de
    // base de datos y/o carpeta aunque el mensaje "huela" a ellas (la deteccion por
    // lenguaje natural se activa sola con palabras como "base", "tablas" o rutas).
    // Si el flag no viaja (Visor y clientes existentes), quedan ACTIVAS.
    $dbToolsOn = !isset($body['dbTools']) || !empty($body['dbTools']);
    $fsToolsOn = !isset($body['fsTools']) || !empty($body['fsTools']);

    // Gate barato: solo intentamos tocar MySQL si el mensaje huele a "base de datos".
    // El guard REAL es que ademas aparezca el alias de una base existente (db_detect_request),
    // asi que podemos ser amplios aqui sin inyectar de mas. Si el turno califica
    // explicitamente "carpeta/proyecto" (y NO "base/tabla"), no resolvemos como base.
    $dbIntentRe = '/(con[eé]ct\w*|\bbase\b|\besquema\b|\bschema\b|\bbd\b|\btablas?\b|modelo\s+de\s+datos)/iu';
    $wantDb = $dbToolsOn && (($dbConnect !== '') || (bool) preg_match($dbIntentRe, $lastUser)) && !($fsExplicit && !$dbExplicit);

    if ($wantDb) {
        try {
            // 1) El mensaje ACTUAL manda: si nombra una base, cambia/define la conexion.
            $det = db_detect_request($lastUser, true);
            if ($det && $det['schema']) {
                $dbSchema = $det['schema'];
                $dbFromMessage = true;
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
                if ($dbMode === 'data') {
                    // Playground: construir un componente/template poblado con datos REALES.
                    $systemBlock .= "\n\n=== ESQUEMA DE BASE DE DATOS (FUENTE DE VERDAD) ===\n"
                        . "Te conectaste a la base '{$dbSchema}'. Usa EXCLUSIVAMENTE estos nombres reales de\n"
                        . "tablas y columnas (no inventes). Para obtener los datos que mostrara el componente,\n"
                        . "ejecuta consultas SELECT de SOLO LECTURA con la herramienta run_select y escribe esos\n"
                        . "valores REALES dentro del HTML que devuelves; nunca inventes datos ni numeros.\n"
                        . "NO describas el esquema ni dibujes diagramas/cajas: entrega el componente solicitado\n"
                        . "como UN bloque ```html, ya poblado con las filas obtenidas.\n"
                        . "\n" . $digest;
                } else {
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
            }
        } catch (Throwable $e) {
            $systemBlock .= "\n\n=== BASE DE DATOS ===\n"
                . "No se pudo leer el esquema solicitado: " . $e->getMessage() . "\n";
        }

        // Formato de salida para ESTRUCTURA de tablas: cajas monoespaciadas + diagrama
        // ASCII + Cardinalidades (db-rules.md §3.1) en vez de mermaid erDiagram/CREATE
        // TABLE. Solo cuando se trabaja con BD y NO hay un modo grafica explicito activo
        // (mermaid/excalidraw/drawio se respetan tal cual los eligio el usuario). En modo
        // 'data' (Playground) NO se inyecta: ahi el modelo construye una UI con datos
        // reales, no describe la estructura como cajas de texto.
        if ($graphMode === '' && $dbMode !== 'data') {
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
    $fsFromMessage = false;   // true si la carpeta la NOMBRO el usuario en este turno (no pegajosa)

    // Si el turno califica explicitamente "base/tabla/esquema" (y NO "carpeta/proyecto"),
    // no resolvemos como carpeta: es una consulta de BD.
    $fsIntentRe = '/(con[eé]ct\w*|\bcarpeta\b|\bproyecto\b|\bdirectorio\b|\bfolder\b|\brepositorio\b|\brepo\b|c[oó]digo\s+de)/iu';
    // Una RUTA escrita en el mensaje ("coffee/templates/gv", "C:\wamp64\www\gv") tambien
    // cuenta como intencion de carpeta: es la forma natural de responder a la pregunta de
    // desambiguacion o de apuntar directo a una subcarpeta sin decir "carpeta". Las URLs
    // http(s) NO cuentan como ruta local (se atienden con la consulta web de mas abajo).
    $lastUserNoUrls = preg_replace('#https?://[^\s"\'<>()\[\]{}]+#iu', ' ', $lastUser);
    $fsIntent = (bool) preg_match($fsIntentRe, $lastUser)
             || (bool) preg_match('#[a-z_.\-][\w.\-]*[\\\\/][\w.\-]+#iu', $lastUserNoUrls);
    $wantFs = $fsToolsOn && (($folderConnect !== '') || $fsIntent) && !($dbExplicit && !$fsExplicit);

    if ($wantFs) {
        try {
            // El mensaje ACTUAL manda: si nombra una carpeta, cambia/define la conexion.
            // Solo escaneamos el indice de carpetas si el mensaje tiene intencion
            // explicita; si ya hay conexion pegajosa y el turno no habla de carpetas,
            // reusamos la ruta sin reindexar.
            $det = $fsIntent ? fs_detect_request($lastUser, true) : null;
            if ($det && $det['path']) {
                $fsRoot = $det['path'];
                $fsFromMessage = true;
            } elseif ($det && !empty($det['candidates'])) {
                $systemBlock .= "\n\n=== CARPETA ===\n"
                    . "El usuario menciono una carpeta ambigua (varias con el mismo nombre). "
                    . "Candidatos (ruta relativa): "
                    . implode(', ', array_map('fs_rel_to_root', $det['candidates']))
                    . ". Pide que elija una escribiendo un fragmento distintivo de la ruta "
                    . "(p.ej. la carpeta padre) antes de continuar.\n";
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
                    . "Si te piden RECREAR, portar o mejorar una pantalla de esta carpeta, el estilo visual\n"
                    . "sale del CODIGO FUENTE leido (su paleta, su tono light/dark, su tipografia), NO de un\n"
                    . "estilo por defecto — salvo que el usuario tenga un tema/sistema de diseno activado en\n"
                    . "este contexto, que entonces manda sobre el estilo del fuente.\n"
                    . "\n" . $tree;
                if ($canvasMode) {
                    $systemBlock .= "\n=== CARPETA + LIENZO ===\n"
                        . "El usuario quiere GENERAR un template usando la carpeta conectada como base\n"
                        . "(recrear una pantalla existente o proponer una version mejorada). El flujo es:\n"
                        . "1. Explora y LEE primero los archivos reales relevantes (vista, CSS, JS).\n"
                        . "2. Despues genera el template nuevo en el lienzo segun las reglas del modo lienzo\n"
                        . "   (respeta su PRIORIDAD DE ESTILO: tema activado > estilo del fuente > default).\n"
                        . "La regla de 'nunca inventes codigo' aplica a DESCRIBIR lo existente; el template\n"
                        . "que generas es codigo NUEVO y debe basarse fielmente en la estructura, textos y\n"
                        . "estilos que leiste, no en suposiciones. No generes el template sin haber leido antes.\n";
                }
            }
        } catch (Throwable $e) {
            $systemBlock .= "\n\n=== CARPETA ===\n"
                . "No se pudo conectar a la carpeta solicitada: " . $e->getMessage() . "\n";
        }
    }

    // Cuando quedan resueltas una BASE y una CARPETA a la vez (nombradas este turno o
    // pegajosas), se MANTIENEN AMBAS: el endpoint corre un loop HIBRIDO con las
    // herramientas de las dos fuentes (list_dir/read_file/grep_files + run_select).
    // Es el flujo "recrea la pantalla de la carpeta y rellenala con datos reales":
    // el codigo/estructura sale del filesystem y las filas/valores de MySQL.
    // (Antes se anulaban entre si o una cedia el turno, y el modelo se quedaba sin
    // una de las dos fuentes — p.ej. la carpeta costsys vs la base gvsl_costsys.)
    if ($dbSchema && $fsRoot) {
        $systemBlock .= "\n\n=== CARPETA + BASE DE DATOS (USA AMBAS FUENTES) ===\n"
            . "Tienes DOS fuentes conectadas a la vez:\n"
            . "- CARPETA '" . basename($fsRoot) . "': codigo/estructura real (list_dir, grep_files, read_file).\n"
            . "- BASE '{$dbSchema}': datos reales (run_select, SOLO LECTURA).\n"
            . "Si generas o recreas una pantalla con tablas, formularios, selects, cards o KPIs:\n"
            . "1. LEE primero el codigo fuente relevante de la carpeta (estructura, campos, estilos).\n"
            . "2. POBLA esos componentes con filas y valores REALES obtenidos con run_select usando\n"
            . "   los nombres reales del esquema: los <option> de un select, las filas de una tabla y\n"
            . "   los valores de un formulario salen de la base; nunca los inventes. Si una consulta\n"
            . "   no devuelve filas, muestra un estado vacio honesto.\n";
    }

    // ── Pagina web pegada en el mensaje (clonar/consultar una URL) ──────────────
    // Si el ultimo mensaje trae URLs http(s), se descargan server-side y su HTML/CSS
    // real entra al contexto como fuente de verdad. Asi "clona https://ejemplo.com"
    // funciona con CUALQUIER modelo, incluso sin tool-calling; en los loops agenticos
    // el modelo ademas puede bajar mas recursos con la herramienta fetch_url.
    $webPages = [];
    $webUrls  = web_extract_urls($lastUser);
    if (!empty($webUrls)) {
        $wb = web_context_block($webUrls);
        if ($wb['block'] !== '') $systemBlock .= "\n\n" . $wb['block'] . "\n";
        $webPages = $wb['fetched'];
    }

    $prepend = [['role' => 'system', 'content' => $systemBlock]];
    return ['messages' => array_merge($prepend, $messages), 'model' => $model, 'effort' => $effort, 'db' => $dbSchema, 'fs' => $fsRoot, 'canvas' => $canvasMode, 'web' => $webPages];
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

/* ── Disciplina de herramientas (compartida por los tres loops) ──────────────
 * Los LLM a veces ANUNCIAN una consulta en prosa ("Voy a explorar las tablas…")
 * y cierran el turno sin ejecutarla; el loop interpreta "sin tool_calls" como
 * respuesta final y el usuario recibe un mensaje a medias. Dos defensas:
 * 1) regla en el system al entrar al loop (previene), 2) deteccion de intencion
 * inconclusa + ronda de rescate (corrige). */

/** Regla anti-narración: se anexa como system al entrar a un loop de tools. */
function coffeeia_tool_discipline_msg() {
    return ['role' => 'system', 'content' =>
        'REGLA DE HERRAMIENTAS: nunca anuncies en prosa que "vas a" consultar, explorar o leer algo — '
      . 'ejecuta la herramienta correspondiente en ese MISMO turno y encadena las llamadas que hagan '
      . 'falta hasta tener el dato. Tu respuesta final debe estar COMPLETA, sin acciones pendientes.'];
}

/** ¿La respuesta CIERRA anunciando una accion pendiente en vez de ejecutarla?
 *  (p.ej. "…Voy a explorar las tablas que tienen FK hacia udn:") */
function coffeeia_looks_unfinished($text) {
    $t = mb_strtolower(trim((string) $text), 'UTF-8');
    if ($t === '') return false;
    // Si ya entrego un bloque de codigo/template, se considera completa aunque narre pasos.
    if (strpos($t, '```') !== false) return false;
    // Solo cuenta el TRAMO FINAL: una intencion al inicio seguida de la respuesta
    // completa no debe disparar el rescate.
    $tail = mb_substr($t, -400);
    return (bool) preg_match(
        '/((voy|vamos|procedo|proceder[eé])\s+a|d[eé]jame|perm[ií]teme|let me|i\'ll|i will)\s+'
      . '(explorar|consultar|revisar|buscar|leer|verificar|inspeccionar|obtener|ejecutar|traer|analizar|'
      . 'explore|check|query|read|look|run)\b[^.!?]{0,160}[:…]?\s*$/u',
        $tail
    );
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
    $rescued = false;
    $trunc = false;   // corte por limite de tokens en la respuesta final (done/finish_reason = 'length')
    $messages[] = coffeeia_tool_discipline_msg();

    // (int)$rescued: la ronda de rescate concede UNA iteracion extra sobre el tope.
    for ($round = 0; $round < $maxRounds + (int) $rescued; $round++) {
        $rounds = $round + 1;
        // Fase en lenguaje natural (sin jerga de "rondas"): cada chat() es una
        // llamada COMPLETA al modelo (ahí se va el tiempo, no en MySQL); avisar
        // en cuál va evita el "silencio" largo.
        if ($onStatus) $onStatus($round === 0 ? 'entendiendo tu petición…'
            : ($round === 1 ? 'analizando los resultados…' : 'generando la respuesta con los datos…'));
        $res = $client->chat($messages, $model, ['tools' => $tools]);
        $usage = coffeeia_merge_usage($usage, coffeeia_extract_usage($res));

        $toolCalls = $res['tool_calls'] ?? [];
        if (empty($toolCalls)) {                       // el modelo ya respondio
            $final = (string)($res['content'] ?? '');
            $trunc = ((($res['done_reason'] ?? $res['finish_reason'] ?? '')) === 'length');
            // Ronda de RESCATE (una sola vez): anuncio una consulta en prosa sin
            // ejecutarla — se le devuelve la pelota con la orden de hacerla YA.
            if (!$rescued && coffeeia_looks_unfinished($final)) {
                $rescued = true;
                if ($onStatus) $onStatus('completando una consulta pendiente…');
                $messages[] = ['role' => 'assistant', 'content' => $final];
                $messages[] = ['role' => 'user', 'content' =>
                    'No anuncies la acción: ejecútala AHORA con tus herramientas y entrega en este mismo turno la respuesta completa con los datos obtenidos.'];
                $final = '';
                continue;
            }
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
            if ($onStatus) $onStatus('consultando ' . (isset($args['sql']) ? $args['sql'] : $fn));
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
        if ($onStatus) $onStatus('redactando la respuesta final…');
        // Orden explicita de cierre: sin ella, algunos modelos (GLM) devuelven
        // contenido VACIO aqui porque intentan seguir llamando herramientas que
        // ya no estan declaradas — y el usuario recibia "no devolvio respuesta".
        $messages[] = ['role' => 'user', 'content' =>
            'Se acabaron las rondas de herramientas. Con los datos YA obtenidos arriba, '
          . 'entrega AHORA tu respuesta final completa; no llames a ninguna herramienta.'];
        $res = $client->chat($messages, $model, []);
        $usage = coffeeia_merge_usage($usage, coffeeia_extract_usage($res));
        $final = (string)($res['content'] ?? '');
        $trunc = ((($res['done_reason'] ?? $res['finish_reason'] ?? '')) === 'length');
    }

    return ['final' => $final, 'usage' => $usage, 'rounds' => $rounds, 'truncated' => $trunc];
}

/**
 * Plan B cuando el modelo NO soporta tool-calling: precarga filas REALES de las
 * tablas que el usuario nombro en su ultimo mensaje y las inyecta como mensaje
 * system, para que el template salga poblado aunque el modelo no sepa invocar
 * run_select. Si el mensaje no nombra ninguna tabla del esquema, no inyecta nada
 * (meter tablas al azar solo gasta contexto).
 *
 * @return array{messages: array, tables: string[]}  mensajes (quiza ampliados) y
 *         las tablas cuyas filas se precargaron (vacio = no se inyecto).
 */
function coffeeia_inject_sample_rows(array $messages, $schema, $maxTables = 3, $rowsPerTable = 8) {
    $lastUser = '';
    for ($i = count($messages) - 1; $i >= 0; $i--) {
        if (($messages[$i]['role'] ?? '') === 'user') { $lastUser = mb_strtolower((string)($messages[$i]['content'] ?? ''), 'UTF-8'); break; }
    }
    if ($lastUser === '') return ['messages' => $messages, 'tables' => []];

    try {
        $res = db_safe_select($schema, 'SHOW TABLES');
    } catch (Throwable $e) {
        return ['messages' => $messages, 'tables' => []];
    }
    $names = [];
    foreach ($res['rows'] as $r) { $names[] = (string) reset($r); }

    // Tablas nombradas como PALABRA COMPLETA en el mensaje ("recetas" matchea la
    // tabla recetas pero no receta), mismas reglas que db_detect_request.
    $picked = [];
    foreach ($names as $n) {
        $a = mb_strtolower($n, 'UTF-8');
        if (preg_match('/(?<![a-z0-9_])' . preg_quote($a, '/') . '(?![a-z0-9_])/u', $lastUser)) $picked[] = $n;
    }
    if (!$picked) return ['messages' => $messages, 'tables' => []];
    $picked = array_slice($picked, 0, $maxTables);

    $block = "=== FILAS REALES PRECARGADAS (run_select NO disponible con este modelo) ===\n"
           . "No puedes ejecutar consultas en este turno. Usa EXACTAMENTE las filas de abajo\n"
           . "para poblar el componente; no inventes otras ni alteres sus valores.\n";
    $loaded = [];
    foreach ($picked as $t) {
        try {
            $q = db_safe_select($schema, 'SELECT * FROM `' . str_replace('`', '', $t) . '`', $rowsPerTable);
        } catch (Throwable $e) { continue; }
        // Valores largos truncados: son muestras para UI, no un dump completo.
        $rows = array_map(function ($row) {
            foreach ($row as $k => $v) {
                if (is_string($v) && mb_strlen($v) > 120) $row[$k] = mb_substr($v, 0, 117) . '...';
            }
            return $row;
        }, $q['rows']);
        $block .= "\n-- Tabla {$t} (primeras " . count($rows) . " filas reales) --\n"
                . json_encode(['columns' => $q['columns'], 'rows' => $rows], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE) . "\n";
        $loaded[] = $t;
    }
    if ($loaded) $messages[] = ['role' => 'system', 'content' => $block];
    return ['messages' => $messages, 'tables' => $loaded];
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
    $tools = array_merge(fs_tool_specs(), [web_tool_spec()]);
    $usage = [];
    $final = '';
    $rounds = 0;
    $rescued = false;
    $trunc = false;   // corte por limite de tokens en la respuesta final (done/finish_reason = 'length')
    $messages[] = coffeeia_tool_discipline_msg();

    // (int)$rescued: la ronda de rescate concede UNA iteracion extra sobre el tope.
    for ($round = 0; $round < $maxRounds + (int) $rescued; $round++) {
        $rounds = $round + 1;
        // Fase en lenguaje natural (sin jerga de "rondas").
        if ($onStatus) $onStatus($round === 0 ? 'entendiendo tu petición…'
            : ($round === 1 ? 'revisando lo leído…' : 'generando la respuesta con lo leído…'));
        $res = $client->chat($messages, $model, ['tools' => $tools]);
        $usage = coffeeia_merge_usage($usage, coffeeia_extract_usage($res));

        $toolCalls = $res['tool_calls'] ?? [];
        if (empty($toolCalls)) {                       // el modelo ya respondio
            $final = (string)($res['content'] ?? '');
            $trunc = ((($res['done_reason'] ?? $res['finish_reason'] ?? '')) === 'length');
            // Ronda de RESCATE (una sola vez): anuncio una lectura en prosa sin
            // ejecutarla — se le devuelve la pelota con la orden de hacerla YA.
            if (!$rescued && coffeeia_looks_unfinished($final)) {
                $rescued = true;
                if ($onStatus) $onStatus('completando una acción pendiente…');
                $messages[] = ['role' => 'assistant', 'content' => $final];
                $messages[] = ['role' => 'user', 'content' =>
                    'No anuncies la acción: ejecútala AHORA con tus herramientas y entrega en este mismo turno la respuesta completa con lo leído.'];
                $final = '';
                continue;
            }
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
            if ($onStatus) $onStatus($fn === 'fetch_url' ? web_tool_label($args) : fs_tool_label($fn, $args));
            $result = $fn === 'fetch_url' ? web_run_tool($args) : fs_run_tool($fn, $args, $root);
            $messages[] = [
                'role'         => 'tool',
                'tool_call_id' => $tc['id'] ?? '',
                'name'         => $fn,
                'content'      => $result,
            ];
        }
    }

    if ($final === '') {
        if ($onStatus) $onStatus('redactando la respuesta final…');
        // Orden explicita de cierre: sin ella, algunos modelos (GLM) devuelven
        // contenido VACIO aqui porque intentan seguir llamando herramientas que
        // ya no estan declaradas — y el usuario recibia "no devolvio respuesta".
        $messages[] = ['role' => 'user', 'content' =>
            'Se acabaron las rondas de herramientas. Con los datos YA obtenidos arriba, '
          . 'entrega AHORA tu respuesta final completa; no llames a ninguna herramienta.'];
        $res = $client->chat($messages, $model, []);
        $usage = coffeeia_merge_usage($usage, coffeeia_extract_usage($res));
        $final = (string)($res['content'] ?? '');
        $trunc = ((($res['done_reason'] ?? $res['finish_reason'] ?? '')) === 'length');
    }

    return ['final' => $final, 'usage' => $usage, 'rounds' => $rounds, 'truncated' => $trunc];
}

/**
 * Loop agentico HIBRIDO de SOLO LECTURA: carpeta + base conectadas A LA VEZ. Expone
 * las herramientas de ambas fuentes (list_dir/read_file/grep_files + run_select) y
 * despacha cada llamada al sandbox que corresponda. Es el flujo "recrea la pantalla
 * de la carpeta y rellenala con datos reales de la base": el codigo sale del
 * filesystem y las filas/valores de MySQL.
 *
 * @param object   $client    cliente LLM con chat() que soporte 'tools'.
 * @param array    $messages  mensajes ya armados (incluye arbol + esquema en el system).
 * @param string   $model
 * @param string   $schema    base conectada.
 * @param string   $root      carpeta conectada (ruta absoluta ya resuelta).
 * @param callable $onStatus  fn(string) opcional para avisar "leyendo…/consultando…" al UI.
 * @return array{final: string, usage: array, rounds: int}
 */
function coffeeia_run_hybrid_tools($client, array $messages, $model, $schema, $root, callable $onStatus = null, $maxRounds = 8) {
    $tools   = array_merge(fs_tool_specs(), db_tool_specs(), [web_tool_spec()]);
    $fsNames = ['list_dir', 'read_file', 'grep_files'];
    $usage = [];
    $final = '';
    $rounds = 0;
    $rescued = false;
    $trunc = false;   // corte por limite de tokens en la respuesta final (done/finish_reason = 'length')
    $messages[] = coffeeia_tool_discipline_msg();

    // (int)$rescued: la ronda de rescate concede UNA iteracion extra sobre el tope.
    for ($round = 0; $round < $maxRounds + (int) $rescued; $round++) {
        $rounds = $round + 1;
        // Fase en lenguaje natural (sin jerga de "rondas").
        if ($onStatus) $onStatus($round === 0 ? 'entendiendo tu petición…'
            : ($round === 1 ? 'analizando lo obtenido…' : 'generando la respuesta con lo obtenido…'));
        $res = $client->chat($messages, $model, ['tools' => $tools]);
        $usage = coffeeia_merge_usage($usage, coffeeia_extract_usage($res));

        $toolCalls = $res['tool_calls'] ?? [];
        if (empty($toolCalls)) {                       // el modelo ya respondio
            $final = (string)($res['content'] ?? '');
            $trunc = ((($res['done_reason'] ?? $res['finish_reason'] ?? '')) === 'length');
            // Ronda de RESCATE (una sola vez): anuncio una accion en prosa sin
            // ejecutarla — se le devuelve la pelota con la orden de hacerla YA.
            if (!$rescued && coffeeia_looks_unfinished($final)) {
                $rescued = true;
                if ($onStatus) $onStatus('completando una acción pendiente…');
                $messages[] = ['role' => 'assistant', 'content' => $final];
                $messages[] = ['role' => 'user', 'content' =>
                    'No anuncies la acción: ejecútala AHORA con tus herramientas y entrega en este mismo turno la respuesta completa con los datos obtenidos.'];
                $final = '';
                continue;
            }
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
            $isFs  = in_array($fn, $fsNames, true);
            $isWeb = $fn === 'fetch_url';
            if ($onStatus) $onStatus($isWeb ? web_tool_label($args) : ($isFs ? fs_tool_label($fn, $args) : ('consultando ' . ($args['sql'] ?? $fn))));
            $result = $isWeb ? web_run_tool($args) : ($isFs ? fs_run_tool($fn, $args, $root) : db_run_tool($fn, $args, $schema));
            $messages[] = [
                'role'         => 'tool',
                'tool_call_id' => $tc['id'] ?? '',
                'name'         => $fn,
                'content'      => $result,
            ];
        }
    }

    if ($final === '') {
        if ($onStatus) $onStatus('redactando la respuesta final…');
        // Orden explicita de cierre: sin ella, algunos modelos (GLM) devuelven
        // contenido VACIO aqui porque intentan seguir llamando herramientas que
        // ya no estan declaradas — y el usuario recibia "no devolvio respuesta".
        $messages[] = ['role' => 'user', 'content' =>
            'Se acabaron las rondas de herramientas. Con los datos YA obtenidos arriba, '
          . 'entrega AHORA tu respuesta final completa; no llames a ninguna herramienta.'];
        $res = $client->chat($messages, $model, []);
        $usage = coffeeia_merge_usage($usage, coffeeia_extract_usage($res));
        $final = (string)($res['content'] ?? '');
        $trunc = ((($res['done_reason'] ?? $res['finish_reason'] ?? '')) === 'length');
    }

    return ['final' => $final, 'usage' => $usage, 'rounds' => $rounds, 'truncated' => $trunc];
}
