<?php
/**
 * Introspeccion de MySQL para el chat (CoffeeIA).
 *
 * Permite que el usuario diga en lenguaje natural "conectate a la base de reginas
 * y genera el grafico" y el backend:
 *   1. detecta la base nombrada contra las bases locales reales,
 *   2. lee su esquema (tablas/columnas/PK/FK) de INFORMATION_SCHEMA,
 *   3. lo inyecta al contexto del modelo (que dibuja el Excalidraw con datos reales),
 *   4. opcionalmente ejecuta SELECT de solo lectura (datos en vivo) via tool-calling.
 *
 * Credenciales: server-side (db-config.php). Nunca se mandan al modelo.
 */

require_once __DIR__ . '/db-config.php';

class DbIntrospectException extends RuntimeException {}

/* ── Conexion (singleton por request) ──────────────────────────── */

function db_pdo() {
    static $pdo = null;
    if ($pdo instanceof PDO) return $pdo;
    try {
        $dsn = 'mysql:host=' . DB_HOST . ';port=' . DB_PORT . ';charset=utf8mb4';
        $pdo = new PDO($dsn, DB_USER, DB_PASS, [
            PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
            PDO::ATTR_EMULATE_PREPARES   => false,
        ]);
    } catch (Throwable $e) {
        throw new DbIntrospectException('No se pudo conectar a MySQL: ' . $e->getMessage());
    }
    return $pdo;
}

/* ── Bases disponibles ─────────────────────────────────────────── */

function db_list_schemas() {
    static $cache = null;
    if ($cache !== null) return $cache;

    $sys = array_filter(array_map('trim', explode(',', DB_SYSTEM_SCHEMAS)));
    $in  = implode(',', array_fill(0, count($sys), '?'));
    $sql = "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA"
         . ($in ? " WHERE SCHEMA_NAME NOT IN ($in)" : '')
         . " ORDER BY SCHEMA_NAME";
    $st = db_pdo()->prepare($sql);
    $st->execute(array_values($sys));
    $all = $st->fetchAll(PDO::FETCH_COLUMN);

    // Lista blanca opcional.
    $allow = array_filter(array_map('trim', explode(',', DB_ALLOWED_SCHEMAS)));
    if ($allow) {
        $allowLc = array_map('strtolower', $allow);
        $all = array_values(array_filter($all, fn($s) => in_array(strtolower($s), $allowLc, true)));
    }
    return $cache = $all;
}

/**
 * Alias de busqueda de un schema: nombre completo + partes tras el primer y ultimo
 * guion bajo. Asi "reginas" cae en "fayxzvov_reginas" y "gvsl_finanzas3"/"finanzas3"
 * caen en "rfwsmqex_gvsl_finanzas3".
 */
function db_schema_aliases($schema) {
    $s = strtolower($schema);
    $aliases = [$s];
    if (($p = strpos($s, '_')) !== false && $p + 1 < strlen($s)) {
        $aliases[] = substr($s, $p + 1);          // tras el PRIMER "_"
    }
    if (($p = strrpos($s, '_')) !== false && $p + 1 < strlen($s)) {
        $aliases[] = substr($s, $p + 1);          // tras el ULTIMO "_"
    }
    return array_values(array_unique($aliases));
}

/**
 * Resuelve un nombre amigable a el/los schema(s) reales.
 * @return array{matches: string[]} schemas que coinciden (0, 1 o varios = ambiguo).
 */
function db_resolve_schema($name) {
    $q = strtolower(trim($name));
    if ($q === '') return ['matches' => []];
    $schemas = db_list_schemas();

    // 1) Match exacto por nombre completo.
    foreach ($schemas as $s) {
        if (strtolower($s) === $q) return ['matches' => [$s]];
    }
    // 2) Match exacto por alias.
    $byAlias = [];
    foreach ($schemas as $s) {
        if (in_array($q, db_schema_aliases($s), true)) $byAlias[] = $s;
    }
    if ($byAlias) return ['matches' => array_values(array_unique($byAlias))];

    // 3) Substring (la palabra aparece dentro del nombre del schema).
    $bySub = [];
    foreach ($schemas as $s) {
        if (strpos(strtolower($s), $q) !== false) $bySub[] = $s;
    }
    return ['matches' => array_values(array_unique($bySub))];
}

/**
 * Detecta en el texto del usuario si pide conectarse a una base y a cual.
 * @param string $text   ultimo mensaje del usuario.
 * @param bool   $force  si true (p.ej. modo grafica activo), basta con nombrar una
 *                       base aunque no use verbos de conexion.
 * @return array|null  ['schema'=>?, 'candidates'=>[], 'requested'=>string]
 */
function db_detect_request($text, $force = false) {
    $text = (string) $text;
    if (trim($text) === '') return null;

    $hasIntent = (bool) preg_match(
        '/(con[eé]ct\w*|base\s+de\s+datos|\besquema\b|\bschema\b|\bbd\b|diagrama\s+de\s+(la\s+)?base|modelo\s+de\s+datos|estructura\s+de\s+(la\s+)?base|tablas?\s+de)/iu',
        $text
    );
    if (!$hasIntent && !$force) return null;

    $low = mb_strtolower($text, 'UTF-8');

    // Alias que son palabras GENERICAS del espanol y aparecen en prosa normal:
    // "rellena el formulario con datos reales" NO debe conectar 'nombre_base_datos'
    // por su alias 'datos' (pisaba incluso la conexion pegajosa). Una base cuyo
    // alias este vetado sigue siendo alcanzable escribiendo su nombre completo.
    static $stopAliases = ['datos', 'base'];

    // Busca cualquier alias de base como PALABRA COMPLETA dentro del texto.
    $hits = [];      // schema => peso (longitud del alias que matcheo)
    foreach (db_list_schemas() as $s) {
        foreach (db_schema_aliases($s) as $a) {
            if (strlen($a) < 3) continue;   // evita alias triviales
            if (in_array($a, $stopAliases, true)) continue;
            if (preg_match('/(?<![a-z0-9_])' . preg_quote($a, '/') . '(?![a-z0-9_])/u', $low)) {
                $hits[$s] = max($hits[$s] ?? 0, strlen($a));
            }
        }
    }
    if (!$hits) return null;

    // Prioriza el alias mas especifico (mas largo). Si empatan, es ambiguo.
    arsort($hits);
    $maxW = reset($hits);
    $top  = array_keys(array_filter($hits, fn($w) => $w === $maxW));

    return [
        'schema'     => count($top) === 1 ? $top[0] : null,
        'candidates' => array_keys($hits),
        'requested'  => $text,
    ];
}

/**
 * Devuelve el nombre real (canonico) de un schema a partir de un nombre exacto o
 * amigable. Lanza si no existe o si es ambiguo.
 */
function db_canonical_schema($name) {
    foreach (db_list_schemas() as $s) {
        if (strtolower($s) === strtolower($name)) return $s;
    }
    $r = db_resolve_schema($name);
    if (count($r['matches']) === 1) return $r['matches'][0];
    if (count($r['matches']) === 0) {
        throw new DbIntrospectException('Base no disponible: ' . $name);
    }
    throw new DbIntrospectException(
        'Nombre de base ambiguo "' . $name . '". Coincide con: ' . implode(', ', $r['matches'])
    );
}

/* ── Digest del esquema (texto compacto para el modelo) ─────────── */

/**
 * Resumen del esquema: seccion de RELACIONES (todas las tablas, compacto) + seccion
 * de COLUMNAS (detalle por tabla hasta un presupuesto de caracteres). Acotado para
 * no reventar el contexto. Devuelve string listo para inyectar.
 */
function db_schema_digest($schema, array $opts = []) {
    $budget = (int)($opts['budget'] ?? 14000);   // tope aprox de caracteres del bloque
    $pdo    = db_pdo();
    $schema = db_canonical_schema($schema);       // acepta nombre real o amigable

    // Tablas.
    $st = $pdo->prepare("SELECT TABLE_NAME FROM information_schema.TABLES
                         WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
                         ORDER BY TABLE_NAME");
    $st->execute([$schema]);
    $tables = $st->fetchAll(PDO::FETCH_COLUMN);
    $tableSet = array_flip(array_map('strtolower', $tables));

    // Todas las columnas del schema en una sola consulta.
    $st = $pdo->prepare("SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, COLUMN_KEY
                         FROM information_schema.COLUMNS
                         WHERE TABLE_SCHEMA = ?
                         ORDER BY TABLE_NAME, ORDINAL_POSITION");
    $st->execute([$schema]);
    $cols = [];
    foreach ($st->fetchAll(PDO::FETCH_ASSOC) as $r) {
        $cols[$r['TABLE_NAME']][] = $r;
    }

    // FKs declaradas (InnoDB) en una sola consulta.
    $st = $pdo->prepare("SELECT TABLE_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME
                         FROM information_schema.KEY_COLUMN_USAGE
                         WHERE TABLE_SCHEMA = ? AND REFERENCED_TABLE_NAME IS NOT NULL");
    $st->execute([$schema]);
    $fk = [];   // tabla.columna => tabla_referida
    foreach ($st->fetchAll(PDO::FETCH_ASSOC) as $r) {
        $fk[$r['TABLE_NAME'] . '.' . $r['COLUMN_NAME']] = $r['REFERENCED_TABLE_NAME'];
    }

    // Heuristica: una columna *_id apunta a la tabla cuyo nombre sale de quitar "_id"
    // (probando singular/plural) si existe en el schema.
    $guessRef = function ($col) use ($tableSet) {
        if (!preg_match('/^(.*)_id$/', $col, $m)) return null;
        $base = $m[1];
        foreach ([$base, $base . 's', $base . 'es', rtrim($base, 's')] as $cand) {
            if (isset($tableSet[strtolower($cand)])) return $cand;
        }
        return null;
    };

    $out  = "BASE DE DATOS CONECTADA: {$schema}  (" . count($tables) . " tablas)\n";

    // Seccion 1: relaciones (cobertura total, compacto) — alimenta el grafo de la izq.
    $out .= "\n== RELACIONES (col -> tabla; '->' FK declarada, '~>' por convencion *_id) ==\n";
    foreach ($tables as $t) {
        $rels = [];
        foreach (($cols[$t] ?? []) as $c) {
            $name = $c['COLUMN_NAME'];
            if (isset($fk["$t.$name"])) {
                $rels[] = "$name->{$fk["$t.$name"]}";
            } elseif (($g = $guessRef($name))) {
                $rels[] = "$name~>$g";
            }
        }
        $out .= "- {$t}" . ($rels ? ': ' . implode(', ', $rels) : '') . "\n";
    }

    // Seccion 2: columnas detalladas por tabla, hasta agotar presupuesto.
    $out .= "\n== COLUMNAS (detalle) ==\n";
    $omitted = [];
    foreach ($tables as $t) {
        $block = "\n[{$t}]\n";
        foreach (($cols[$t] ?? []) as $c) {
            $tag = '';
            if ($c['COLUMN_KEY'] === 'PRI') $tag = ' PK';
            $name = $c['COLUMN_NAME'];
            if (isset($fk["$t.$name"]))            $tag .= ' -> ' . $fk["$t.$name"];
            elseif (($g = $guessRef($name)))       $tag .= ' ~> ' . $g;
            $block .= "  {$name} {$c['COLUMN_TYPE']}{$tag}\n";
        }
        if (mb_strlen($out) + mb_strlen($block) > $budget) { $omitted[] = $t; continue; }
        $out .= $block;
    }
    if ($omitted) {
        $out .= "\n(columnas omitidas por tamano en: " . implode(', ', $omitted)
             .  ". Pide una tabla concreta para ver su detalle.)\n";
    }
    return $out;
}

/* ── SELECT en vivo (solo lectura) ─────────────────────────────── */

/**
 * Ejecuta una consulta de SOLO LECTURA contra un schema y devuelve filas (acotadas).
 * Rechaza todo lo que no sea SELECT/SHOW/DESCRIBE/EXPLAIN y cualquier multi-statement.
 *
 * @return array{columns: string[], rows: array, sql: string, truncated: bool}
 */
function db_safe_select($schema, $sql, $maxRows = null) {
    $maxRows = $maxRows ?: DB_MAX_ROWS;
    $sql = trim($sql);
    $sql = rtrim($sql, "; \t\n\r");                 // permite un ; final, nada mas

    if ($sql === '') throw new DbIntrospectException('Consulta vacia.');
    if (strpos($sql, ';') !== false) {
        throw new DbIntrospectException('Solo se permite UNA sentencia (sin ";").');
    }
    if (!preg_match('/^\s*(SELECT|SHOW|DESCRIBE|DESC|EXPLAIN|WITH)\b/i', $sql)) {
        throw new DbIntrospectException('Solo lectura: la consulta debe empezar con SELECT/SHOW/DESCRIBE/EXPLAIN.');
    }
    // Palabras prohibidas (escritura / acceso a ficheros / cambios de sesion).
    if (preg_match('/\b(INSERT|UPDATE|DELETE|REPLACE|DROP|ALTER|TRUNCATE|CREATE|GRANT|REVOKE|RENAME|LOCK|UNLOCK|CALL|SET|USE|INTO\s+OUTFILE|INTO\s+DUMPFILE|LOAD_FILE|LOAD\s+DATA|HANDLER)\b/i', $sql)) {
        throw new DbIntrospectException('La consulta contiene una operacion no permitida (solo lectura).');
    }

    // Resuelve schema real (acepta nombre real o amigable) y valida.
    $real = db_canonical_schema($schema);

    $pdo = db_pdo();
    // Fija el schema por defecto SIN inyeccion (nombre validado contra lista real).
    $pdo->exec('USE `' . str_replace('`', '', $real) . '`');

    // Fuerza un LIMIT defensivo si la consulta no lo trae (solo para SELECT/WITH).
    if (preg_match('/^\s*(SELECT|WITH)\b/i', $sql) && !preg_match('/\bLIMIT\s+\d+/i', $sql)) {
        $sql .= ' LIMIT ' . (int)$maxRows;
    }

    $st = $pdo->query($sql);
    $rows = $st->fetchAll(PDO::FETCH_ASSOC);
    $truncated = count($rows) >= $maxRows;
    if ($truncated) $rows = array_slice($rows, 0, $maxRows);
    $columns = $rows ? array_keys($rows[0]) : [];

    return ['columns' => $columns, 'rows' => $rows, 'sql' => $sql, 'truncated' => $truncated];
}

/* ── Tool-calling: expone run_select al modelo ─────────────────── */

/** Definicion de herramientas (formato OpenAI) que el modelo puede invocar. */
function db_tool_specs() {
    return [[
        'type' => 'function',
        'function' => [
            'name'        => 'run_select',
            'description' => 'Ejecuta una consulta SQL de SOLO LECTURA (SELECT/SHOW/DESCRIBE/EXPLAIN) '
                           . 'contra la base de datos ya conectada y devuelve las filas reales. '
                           . 'Usala para responder con datos verdaderos (conteos, agregados, ejemplos). '
                           . 'Nunca inventes datos: si necesitas un numero, consultalo aqui.',
            'parameters'  => [
                'type'       => 'object',
                'properties' => [
                    'sql' => [
                        'type'        => 'string',
                        'description' => 'UNA sola sentencia SELECT/SHOW/DESCRIBE (sin ";" multiples). '
                                       . 'Usa los nombres reales de tablas y columnas del esquema dado.',
                    ],
                ],
                'required'   => ['sql'],
            ],
        ],
    ]];
}

/**
 * Ejecuta una herramienta pedida por el modelo y devuelve el resultado como STRING
 * JSON (lo que espera un mensaje role=tool). Los errores se devuelven como JSON, no
 * se lanzan: el modelo lee el error y corrige la consulta.
 */
function db_run_tool($name, array $args, $schema) {
    if ($name !== 'run_select') {
        return json_encode(['error' => 'Herramienta desconocida: ' . $name], JSON_UNESCAPED_UNICODE);
    }
    $sql = isset($args['sql']) ? (string) $args['sql'] : '';
    try {
        $res = db_safe_select($schema, $sql);
        return json_encode([
            'sql'       => $res['sql'],
            'columns'   => $res['columns'],
            'rows'      => $res['rows'],
            'row_count' => count($res['rows']),
            'truncated' => $res['truncated'],
        ], JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    } catch (Throwable $e) {
        return json_encode(['error' => $e->getMessage()], JSON_UNESCAPED_UNICODE);
    }
}
