<?php
/**
 * Introspeccion de CARPETAS locales para el chat (CoffeeIA).
 *
 * Gemelo de db-introspect.php pero para el sistema de archivos. Permite que el
 * usuario diga "conectate a la carpeta costsys y dime como se calcula el costo"
 * y el backend:
 *   1. resuelve "costsys" a una carpeta real dentro de la whitelist (FS_ALLOWED_ROOTS),
 *   2. inyecta su ARBOL de archivos al contexto del modelo (rutas + tamanos),
 *   3. expone herramientas de SOLO LECTURA (list_dir/read_file/grep_files) por
 *      tool-calling para que el modelo navegue el proyecto bajo demanda.
 *
 * Todo el acceso esta sandbox-eado: una ruta solo se sirve si, ya resuelta con
 * realpath, sigue dentro de la carpeta conectada.
 */

require_once __DIR__ . '/fs-config.php';

class FsIntrospectException extends RuntimeException {}

/* ── Utilidades de ruta ────────────────────────────────────────── */

function fs_norm($p) {
    return rtrim(str_replace('\\', '/', (string) $p), '/');
}

/** Raices permitidas, normalizadas y existentes. */
function fs_allowed_roots() {
    static $cache = null;
    if ($cache !== null) return $cache;
    $roots = [];
    foreach (explode(',', FS_ALLOWED_ROOTS) as $r) {
        $r = trim($r);
        if ($r === '') continue;
        $real = realpath($r);
        if ($real !== false && is_dir($real)) $roots[] = fs_norm($real);
    }
    return $cache = array_values(array_unique($roots));
}

/** true si $path (ya existente) vive dentro de alguna raiz permitida. */
function fs_path_allowed($path) {
    $real = realpath($path);
    if ($real === false) return false;
    $real = fs_norm($real);
    foreach (fs_allowed_roots() as $root) {
        if ($real === $root || strpos($real . '/', $root . '/') === 0) return true;
    }
    return false;
}

/** true si $child esta dentro de $root (ambos se resuelven con realpath). */
function fs_is_within($root, $child) {
    $r = realpath($root);
    $c = realpath($child);
    if ($r === false || $c === false) return false;
    $r = fs_norm($r); $c = fs_norm($c);
    return $c === $r || strpos($c . '/', $r . '/') === 0;
}

/**
 * Ruta RELATIVA a la raiz permitida que contiene $abs (p.ej. "ERP-GV/DEV/coffee/costsys").
 * Sirve para mostrar candidatos DISTINGUIBLES: si dos carpetas se llaman igual, su basename
 * no las diferencia pero su ruta relativa si. Si no cae en ninguna raiz, devuelve la absoluta.
 */
function fs_rel_to_root($abs) {
    $abs = fs_norm($abs);
    foreach (fs_allowed_roots() as $root) {
        if ($abs === $root) return basename($abs);
        if (strpos($abs . '/', $root . '/') === 0) {
            return ltrim(substr($abs, strlen($root)), '/');
        }
    }
    return $abs;
}

/**
 * Desempata carpetas HOMONIMAS por pistas de ruta. Dadas varias rutas candidatas y una
 * lista de pistas (tokens que podrian ser carpetas ancestro, ej. "erp-gv", "coffee"),
 * devuelve el subconjunto cuya ruta contiene MAS pistas como segmentos. Asi "costsys de
 * coffee" se queda solo con ERP-GV/DEV/coffee/costsys. Si ninguna pista aplica, devuelve
 * las rutas originales (sigue ambiguo, no adivina).
 *
 * @param string[] $paths  rutas absolutas candidatas.
 * @param string[] $hints  tokens en minusculas que podrian ser carpetas ancestro.
 * @return string[]
 */
function fs_refine_by_hints(array $paths, array $hints) {
    if (count($paths) <= 1 || empty($hints)) return $paths;
    $best = []; $bestScore = -1;
    foreach ($paths as $p) {
        $segs  = array_map('strtolower', explode('/', fs_norm($p)));
        $score = 0;
        foreach ($hints as $h) {
            if ($h !== '' && in_array($h, $segs, true)) $score++;
        }
        if ($score > $bestScore)      { $bestScore = $score; $best = [$p]; }
        elseif ($score === $bestScore) { $best[] = $p; }
    }
    // Solo refinamos si alguna pista discrimino de verdad (score > 0 y no todas empatan).
    if ($bestScore > 0 && count($best) < count($paths)) return array_values(array_unique($best));
    return $paths;
}

/* ── Carpetas conectables (primer nivel de cada raiz) ───────────── */

/**
 * Proyectos disponibles: subcarpetas de primer nivel de cada raiz permitida.
 * @return array<string,string>  nombre => ruta absoluta
 */
function fs_list_projects() {
    static $cache = null;
    if ($cache !== null) return $cache;
    $ignoreLc = fs_ignored_dirs();
    $out = [];
    foreach (fs_allowed_roots() as $root) {
        foreach (@scandir($root) ?: [] as $e) {
            if ($e === '.' || $e === '..') continue;
            if (in_array(strtolower($e), $ignoreLc, true)) continue;
            $full = $root . '/' . $e;
            if (is_dir($full)) $out[$e] = $full;
        }
    }
    return $cache = $out;
}

/**
 * Indice recursivo (acotado y cacheado) de carpetas dentro de las raices permitidas:
 * nombre_en_minusculas => [rutas absolutas]. Permite resolver carpetas ANIDADAS
 * (ej. www/GrupoVaroch/costsys) por nombre, no solo las de primer nivel. Acotado por
 * profundidad y un presupuesto de carpetas para no recorrer el disco entero.
 */
function fs_folder_index($maxDepth = 4) {
    static $cache = null;
    if ($cache !== null) return $cache;
    $ignore = fs_ignored_dirs();
    $index  = [];
    $budget = 8000;   // tope de carpetas a indexar (defensa contra arboles enormes)
    $seen   = 0;

    $walk = function ($dir, $depth) use (&$walk, &$index, &$seen, $budget, $maxDepth, $ignore) {
        if ($depth > $maxDepth || $seen >= $budget) return;
        foreach (@scandir($dir) ?: [] as $e) {
            if ($e === '.' || $e === '..') continue;
            $full = $dir . '/' . $e;
            if (!is_dir($full)) continue;
            if (in_array(strtolower($e), $ignore, true)) continue;
            $seen++;
            $index[strtolower($e)][] = fs_norm($full);
            if ($seen >= $budget) return;
            $walk($full, $depth + 1);
        }
    };
    foreach (fs_allowed_roots() as $root) $walk($root, 1);
    return $cache = $index;
}

/**
 * Resuelve un nombre amigable o una ruta a la(s) carpeta(s) real(es).
 * @return array{matches: string[]}  rutas absolutas que coinciden (0, 1 o varias).
 */
function fs_resolve_folder($name) {
    $q = trim((string) $name);
    if ($q === '') return ['matches' => []];

    // 1) Ruta absoluta directa, si cae dentro de una raiz permitida.
    $maybe = fs_norm($q);
    if (is_dir($maybe) && fs_path_allowed($maybe)) {
        return ['matches' => [fs_norm(realpath($maybe))]];
    }

    // El query puede traer PISTAS de ruta: "coffee/costsys", "erp-gv costsys". El ultimo
    // segmento es el nombre de la carpeta objetivo; los anteriores son carpetas ancestro
    // que ayudan a desempatar homonimos.
    $parts  = array_values(array_filter(preg_split('#[\\\\/\s]+#', strtolower($q))));
    $target = !empty($parts) ? end($parts) : strtolower($q);
    $hints  = array_slice($parts, 0, -1);

    $index = fs_folder_index();

    // 2) Match exacto por nombre de carpeta (en cualquier nivel).
    if (isset($index[$target])) {
        $matches = array_values(array_unique($index[$target]));
    } else {
        // 3) Substring (la palabra aparece dentro del nombre de la carpeta).
        $matches = [];
        foreach ($index as $pn => $paths) {
            if (strpos($pn, $target) !== false) $matches = array_merge($matches, $paths);
        }
        $matches = array_values(array_unique($matches));
    }

    // 4) Si el usuario dio pistas de ruta, refinamos entre los homonimos.
    if (count($matches) > 1 && !empty($hints)) {
        $matches = fs_refine_by_hints($matches, $hints);
    }
    return ['matches' => $matches];
}

/** Ruta canonica de una carpeta (acepta nombre amigable o ruta). Lanza si no/ambigua. */
function fs_canonical_folder($name) {
    $r = fs_resolve_folder($name);
    if (count($r['matches']) === 1) return $r['matches'][0];
    if (count($r['matches']) === 0) {
        throw new FsIntrospectException('Carpeta no disponible: ' . $name);
    }
    throw new FsIntrospectException(
        'Nombre de carpeta ambiguo "' . $name . '". Coincide con: '
        . implode(', ', array_map('fs_rel_to_root', $r['matches']))
        . '. Especifica un fragmento distintivo de la ruta (p.ej. "'
        . fs_rel_to_root($r['matches'][0]) . '").'
    );
}

/**
 * Detecta en el texto del usuario si pide conectarse a una carpeta y a cual.
 * @param string $text   ultimo mensaje del usuario.
 * @param bool   $force  si true, basta nombrar una carpeta aunque no use verbo de conexion.
 * @return array|null  ['path'=>?, 'candidates'=>[], 'requested'=>string]
 */
function fs_detect_request($text, $force = false) {
    $text = (string) $text;
    if (trim($text) === '') return null;

    $hasIntent = (bool) preg_match(
        '/(con[eé]ct\w*|\bcarpeta\b|\bproyecto\b|\bdirectorio\b|\bfolder\b|\brepositorio\b|\brepo\b|c[oó]digo\s+de)/iu',
        $text
    );
    if (!$hasIntent && !$force) return null;

    $low = mb_strtolower($text, 'UTF-8');
    $index = fs_folder_index();

    // 0) Fragmentos con pinta de RUTA ("coffee/templates/gv", "C:\wamp64\www\gv"):
    // se resuelven tal cual con fs_resolve_folder, que ya usa los segmentos previos
    // como pistas de desempate. Es la unica via fiable para carpetas de nombre corto
    // (ej. "gv") o para apuntar directo a una subcarpeta anidada. Si el fragmento
    // termina en un ARCHIVO ("...gv/login-varoch.html"), se prueba su carpeta padre.
    preg_match_all('#[a-z_.\-][a-z0-9_.\-:]*(?:[\\\\/][a-z0-9_.\-]+)+#u', $low, $pm);
    $fragCandidates = [];
    foreach (array_unique($pm[0]) as $frag) {
        $frag = rtrim($frag, '.,;:');
        $tries = [$frag];
        $parent = preg_replace('#[\\\\/][^\\\\/]*\.[a-z0-9]{1,5}$#u', '', $frag);
        if ($parent !== $frag && $parent !== '') $tries[] = $parent;
        foreach ($tries as $t) {
            $r = fs_resolve_folder($t);
            if (count($r['matches']) === 1) {
                return ['path' => $r['matches'][0], 'candidates' => $r['matches'], 'requested' => $text];
            }
            if (!empty($r['matches']) && empty($fragCandidates)) $fragCandidates = $r['matches'];
        }
    }
    if (!empty($fragCandidates)) {
        // La ruta escrita coincide con varias carpetas homonimas: que el usuario elija.
        return ['path' => null, 'candidates' => $fragCandidates, 'requested' => $text];
    }

    // Tokeniza el mensaje (palabras >= 2 chars) y busca cada token como nombre de
    // carpeta en el indice. Lookup O(1) por palabra: encuentra carpetas anidadas sin
    // recorrer todo el indice por cada nombre. Los tokens de 2 chars se aceptan solo
    // si no son palabras funcionales/tecnicas comunes (para no conectar una carpeta
    // por un "de"/"js" suelto); una carpeta corta vetada aqui ("js") sigue siendo
    // alcanzable escribiendo su ruta ("src/js"), que resuelve el bloque de arriba.
    preg_match_all('/[a-z0-9_\-]{2,}/u', $low, $m);
    $stop2 = ['de','la','el','en','un','al','lo','le','se','me','te','mi','tu','su','si','ya','no','ni','es','va','ve','da','of','to','in','on','at','is','it','an','or','as','by','be','do','go','my','we','he','js','ts','md','db','ui','id','px','ok'];
    $hits = [];   // ruta => peso (longitud del nombre que matcheo)
    foreach (array_unique($m[0]) as $tok) {
        if (strlen($tok) < 3 && in_array($tok, $stop2, true)) continue;
        if (isset($index[$tok])) {
            foreach ($index[$tok] as $p) $hits[$p] = max($hits[$p] ?? 0, strlen($tok));
        }
    }
    if (!$hits) return null;

    // Prioriza el nombre mas especifico (mas largo). Si empatan, es ambiguo.
    arsort($hits);
    $maxW = reset($hits);
    $top  = array_keys(array_filter($hits, fn($w) => $w === $maxW));

    // Desempate por pistas de ruta: si varias carpetas homonimas empatan, usamos el resto
    // de tokens del mensaje (posibles carpetas ancestro) para quedarnos con la mas
    // especifica. Ej: "conectate a costsys de coffee" -> ERP-GV/DEV/coffee/costsys.
    if (count($top) > 1) {
        $top = fs_refine_by_hints($top, array_unique($m[0]));
    }

    return [
        'path'       => count($top) === 1 ? $top[0] : null,
        'candidates' => $top,   // homonimos reales entre los que hay que desambiguar
        'requested'  => $text,
    ];
}

/* ── Digest del arbol (texto compacto para el modelo) ──────────── */

/**
 * Arbol jerarquico (indentado) acotado por profundidad (maxDepth) y total de entradas
 * (FS_MAX_TREE_ENTRIES), ignorando FS_IGNORE_DIRS. Da una vista PANORAMICA inicial; el
 * modelo profundiza con list_dir. Devuelve string listo para inyectar al contexto.
 */
function fs_tree_digest($root, array $opts = []) {
    $limit    = (int)($opts['limit'] ?? FS_MAX_TREE_ENTRIES);
    $maxDepth = (int)($opts['maxDepth'] ?? 2);
    $root     = fs_norm(realpath($root) ?: $root);
    $ignore   = fs_ignored_dirs();

    $lines = [];
    $state = ['count' => 0, 'truncated' => false, 'dirs' => 0, 'files' => 0];

    $walk = function ($dir, $depth) use (&$walk, &$lines, &$state, $limit, $maxDepth, $ignore) {
        $entries = @scandir($dir);
        if ($entries === false) return;
        sort($entries);
        $subdirs = []; $files = [];
        foreach ($entries as $e) {
            if ($e === '.' || $e === '..') continue;
            if (is_dir($dir . '/' . $e)) {
                if (in_array(strtolower($e), $ignore, true)) continue;
                $subdirs[] = $e;
            } else {
                $files[] = $e;
            }
        }
        $indent = str_repeat('  ', $depth);
        foreach ($subdirs as $e) {
            if ($state['count'] >= $limit) { $state['truncated'] = true; return; }
            $lines[] = $indent . $e . '/';
            $state['count']++; $state['dirs']++;
            if ($depth < $maxDepth) $walk($dir . '/' . $e, $depth + 1);
            else                    $state['truncated'] = true;
        }
        foreach ($files as $e) {
            if (fs_is_denied_file($e)) continue;
            if ($state['count'] >= $limit) { $state['truncated'] = true; return; }
            $lines[] = $indent . $e . '  (' . fs_fmt_size(@filesize($dir . '/' . $e)) . ')';
            $state['count']++; $state['files']++;
        }
    };
    $walk($root, 0);

    $out  = 'CARPETA CONECTADA: ' . basename($root) . '  (' . $state['files'] . ' archivos, '
          . $state['dirs'] . " subcarpetas mostradas)\n";
    $out .= 'RUTA: ' . $root . "\n\n";
    $out .= "== ARBOL (profundidad <= {$maxDepth}) ==\n" . implode("\n", $lines) . "\n";
    if ($state['truncated']) {
        $out .= "\n(arbol parcial: hay mas contenido o profundidad. Usa list_dir para explorar subcarpetas\n"
              . "concretas. Si la tarea se centra en una sola parte del proyecto, sugiere al usuario\n"
              . "reconectarse a esa subcarpeta -- p.ej. 'conectate a " . basename($root) . "/sub/carpeta' --\n"
              . "para trabajar con un arbol completo en vez de parcial.)\n";
    }
    return $out;
}

function fs_fmt_size($bytes) {
    $bytes = (int) $bytes;
    if ($bytes < 1024) return $bytes . ' B';
    if ($bytes < 1048576) return round($bytes / 1024, 1) . ' KB';
    return round($bytes / 1048576, 1) . ' MB';
}

function fs_is_binary_ext($path) {
    static $bin = null;
    if ($bin === null) $bin = array_filter(array_map('trim', explode(',', FS_BINARY_EXTS)));
    $ext = strtolower(pathinfo($path, PATHINFO_EXTENSION));
    return $ext !== '' && in_array($ext, $bin, true);
}

/** Carpetas a ocultar en toda exploracion: ruido (FS_IGNORE_DIRS) + sensibles (FS_DENY_DIRS). */
function fs_ignored_dirs() {
    static $cache = null;
    if ($cache === null) {
        $csv = FS_IGNORE_DIRS . ',' . (defined('FS_DENY_DIRS') ? FS_DENY_DIRS : '');
        $cache = array_values(array_unique(array_map('strtolower',
            array_filter(array_map('trim', explode(',', $csv))))));
    }
    return $cache;
}

/**
 * true si el nombre del archivo coincide con un patron sensible (FS_DENY_FILES).
 * Los archivos sensibles no se leen, no se grep-ean y no aparecen en arbol/listados:
 * su contenido nunca debe llegar al contexto de un LLM externo.
 */
function fs_is_denied_file($path) {
    static $patterns = null;
    if ($patterns === null) {
        $csv = defined('FS_DENY_FILES') ? FS_DENY_FILES : '';
        $patterns = array_filter(array_map('trim', explode(',', $csv)));
    }
    $name = strtolower(basename($path));
    foreach ($patterns as $p) {
        if (fnmatch(strtolower($p), $name)) return true;
    }
    return false;
}

/* ── Operaciones de SOLO LECTURA (sandbox a $root) ─────────────── */

/** Resuelve una ruta relativa contra la raiz y valida el sandbox. */
function fs_resolve_in_root($root, $rel) {
    $rel = str_replace('\\', '/', (string) $rel);
    $rel = ltrim($rel, '/');
    $target = fs_norm($root) . ($rel !== '' ? '/' . $rel : '');
    if (!file_exists($target)) {
        throw new FsIntrospectException('No existe: ' . $rel);
    }
    if (!fs_is_within($root, $target)) {
        throw new FsIntrospectException('Ruta fuera de la carpeta conectada: ' . $rel);
    }
    return $target;
}

function fs_safe_list($root, $rel = '') {
    $dir = fs_resolve_in_root($root, $rel);
    if (!is_dir($dir)) throw new FsIntrospectException('No es una carpeta: ' . $rel);
    $ignore = fs_ignored_dirs();
    $dirs = []; $files = [];
    foreach (@scandir($dir) ?: [] as $e) {
        if ($e === '.' || $e === '..') continue;
        $full = $dir . '/' . $e;
        if (is_dir($full)) {
            if (in_array(strtolower($e), $ignore, true)) continue;
            $dirs[] = $e . '/';
        } else {
            if (fs_is_denied_file($e)) continue;
            $files[] = ['name' => $e, 'size' => fs_fmt_size(@filesize($full))];
        }
        if (count($dirs) + count($files) >= FS_MAX_LIST_ENTRIES) break;
    }
    sort($dirs);
    usort($files, fn($a, $b) => strcasecmp($a['name'], $b['name']));
    return ['path' => $rel ?: '.', 'dirs' => $dirs, 'files' => $files];
}

function fs_safe_read($root, $rel, $maxBytes = null) {
    $maxBytes = $maxBytes ?: FS_MAX_FILE_BYTES;
    $file = fs_resolve_in_root($root, $rel);
    if (!is_file($file)) throw new FsIntrospectException('No es un archivo: ' . $rel);
    if (fs_is_denied_file($file)) {
        throw new FsIntrospectException('Archivo restringido (credenciales/secretos): ' . $rel);
    }
    if (fs_is_binary_ext($file)) {
        throw new FsIntrospectException('Archivo binario (no legible como texto): ' . $rel);
    }
    $size = @filesize($file);
    $raw  = @file_get_contents($file, false, null, 0, $maxBytes + 1);
    if ($raw === false) throw new FsIntrospectException('No se pudo leer: ' . $rel);
    $truncated = strlen($raw) > $maxBytes;
    if ($truncated) {
        $raw = mb_strcut($raw, 0, $maxBytes, 'UTF-8') . "\n\n[... truncado a " . fs_fmt_size($maxBytes) . " ...]";
    }
    return ['path' => $rel, 'size' => fs_fmt_size($size), 'truncated' => $truncated, 'content' => $raw];
}

/**
 * Busca un texto/regex en los archivos de la carpeta (solo texto), acotado a
 * FS_MAX_GREP_HITS. Devuelve coincidencias {file, line, text}.
 */
function fs_safe_grep($root, $query, array $opts = []) {
    $query = (string) $query;
    if (trim($query) === '') throw new FsIntrospectException('Consulta de busqueda vacia.');
    $root   = fs_norm(realpath($root) ?: $root);
    $ignore = fs_ignored_dirs();
    $extFilter = isset($opts['ext']) && $opts['ext'] !== ''
        ? array_map('strtolower', array_filter(array_map('trim', explode(',', (string) $opts['ext']))))
        : null;

    // Tratamos la consulta como literal por defecto (case-insensitive).
    $needle = mb_strtolower($query, 'UTF-8');
    $hits = []; $scanned = 0; $truncated = false;

    $queue = [$root];
    while (!empty($queue) && count($hits) < FS_MAX_GREP_HITS) {
        $dir = array_shift($queue);
        foreach (@scandir($dir) ?: [] as $e) {
            if ($e === '.' || $e === '..') continue;
            $full = $dir . '/' . $e;
            if (is_dir($full)) {
                if (in_array(strtolower($e), $ignore, true)) continue;
                $queue[] = $full;
                continue;
            }
            if (fs_is_binary_ext($full) || fs_is_denied_file($full)) continue;
            if ($extFilter) {
                $ext = strtolower(pathinfo($full, PATHINFO_EXTENSION));
                if (!in_array($ext, $extFilter, true)) continue;
            }
            if (@filesize($full) > 2097152) continue;       // ignora archivos > 2MB
            $scanned++;
            $fh = @fopen($full, 'r');
            if (!$fh) continue;
            $rel = ltrim(substr(fs_norm($full), strlen($root)), '/');
            $ln = 0;
            while (($line = fgets($fh)) !== false) {
                $ln++;
                if (strpos(mb_strtolower($line, 'UTF-8'), $needle) !== false) {
                    $hits[] = ['file' => $rel, 'line' => $ln, 'text' => trim(mb_strcut($line, 0, 240, 'UTF-8'))];
                    if (count($hits) >= FS_MAX_GREP_HITS) { $truncated = true; break; }
                }
            }
            fclose($fh);
            if (count($hits) >= FS_MAX_GREP_HITS) break;
        }
    }
    return ['query' => $query, 'hits' => $hits, 'hit_count' => count($hits), 'files_scanned' => $scanned, 'truncated' => $truncated];
}

/* ── Tool-calling: expone las operaciones al modelo ────────────── */

/** Definicion de herramientas (formato OpenAI) que el modelo puede invocar. */
function fs_tool_specs() {
    return [
        [
            'type' => 'function',
            'function' => [
                'name'        => 'list_dir',
                'description' => 'Lista el contenido (subcarpetas y archivos) de una carpeta dentro del '
                               . 'proyecto conectado. Usala para explorar la estructura antes de leer.',
                'parameters'  => [
                    'type' => 'object',
                    'properties' => [
                        'path' => ['type' => 'string', 'description' => 'Ruta RELATIVA a la raiz del proyecto (vacio o "." = raiz).'],
                    ],
                    'required' => [],
                ],
            ],
        ],
        [
            'type' => 'function',
            'function' => [
                'name'        => 'read_file',
                'description' => 'Lee el contenido de UN archivo de texto del proyecto conectado y lo devuelve. '
                               . 'Usala para responder con el codigo/documentacion real; nunca inventes el contenido.',
                'parameters'  => [
                    'type' => 'object',
                    'properties' => [
                        'path' => ['type' => 'string', 'description' => 'Ruta RELATIVA del archivo dentro del proyecto.'],
                    ],
                    'required' => ['path'],
                ],
            ],
        ],
        [
            'type' => 'function',
            'function' => [
                'name'        => 'grep_files',
                'description' => 'Busca un texto literal (case-insensitive) en los archivos de texto del proyecto '
                               . 'y devuelve las coincidencias (archivo, linea, texto). Usala para localizar donde '
                               . 'se define/usa algo antes de leer el archivo completo.',
                'parameters'  => [
                    'type' => 'object',
                    'properties' => [
                        'query' => ['type' => 'string', 'description' => 'Texto a buscar.'],
                        'ext'   => ['type' => 'string', 'description' => 'Opcional: extensiones a filtrar separadas por coma (ej. "php,js").'],
                    ],
                    'required' => ['query'],
                ],
            ],
        ],
    ];
}

/**
 * Ejecuta una herramienta pedida por el modelo y devuelve el resultado como STRING
 * JSON (lo que espera un mensaje role=tool). Los errores se devuelven como JSON, no
 * se lanzan: el modelo lee el error y corrige.
 */
function fs_run_tool($name, array $args, $root) {
    try {
        switch ($name) {
            case 'list_dir':
                $res = fs_safe_list($root, isset($args['path']) ? (string) $args['path'] : '');
                break;
            case 'read_file':
                $res = fs_safe_read($root, isset($args['path']) ? (string) $args['path'] : '');
                break;
            case 'grep_files':
                $res = fs_safe_grep($root, isset($args['query']) ? (string) $args['query'] : '',
                    ['ext' => isset($args['ext']) ? (string) $args['ext'] : '']);
                break;
            default:
                return json_encode(['error' => 'Herramienta desconocida: ' . $name], JSON_UNESCAPED_UNICODE);
        }
        return json_encode($res, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    } catch (Throwable $e) {
        return json_encode(['error' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
    }
}

/** Etiqueta corta de una herramienta para el indicador "trabajando..." del UI. */
function fs_tool_label($name, array $args) {
    if ($name === 'read_file')  return 'leyendo ' . ($args['path'] ?? '');
    if ($name === 'list_dir')   return 'explorando ' . (($args['path'] ?? '') ?: '/');
    if ($name === 'grep_files') return 'buscando "' . ($args['query'] ?? '') . '"';
    return $name;
}
