<?php
/**
 * Registro de AGENTES del chat (CoffeeIA).
 *
 * Hasta ahora un agente era un archivo .md suelto en ~/.claude/agents y el catalogo
 * vivia hardcodeado en tools-registry.php. Aqui vive en SQLite (data/agents.sqlite),
 * con su prompt, su alma, su modelo y —lo importante— sus ARCHIVOS DE REGLAS y su
 * MEMORIA persistente.
 *
 * La clave del agente (`agent_key`) sigue siendo el nombre del .md ('CoffeeIA.md'):
 * es lo que ya viaja en tools.agents (CSV de asignacion) y en chats.doc (el agente de
 * cada conversacion guardada). Cambiarla obligaria a migrar ambas cosas.
 *
 * Las reglas NO viajan completas al prompt: solo un indice de una linea por archivo
 * (name — description · cuando). El agente abre el que necesita con read_rules. Ese
 * es todo el punto: el grimorio de Coffee-Varoch pesa 100 KB (~25k tokens) y hoy se
 * inyecta entero en cada turno; su linea de indice pesa ~20 tokens.
 *
 * El .md de origen se guarda en source_file/source_mtime: la BD manda, pero la ficha
 * avisa si el archivo cambio en disco y ofrece recargarlo. Nunca se pisa solo, porque
 * el mismo .md lo sigue usando Claude Code.
 */

require_once __DIR__ . '/path-helper.php';

if (!defined('AGENTS_DB_PATH')) define('AGENTS_DB_PATH', __DIR__ . '/../data/agents.sqlite');

// Orden del indice del prompt: lo critico primero.
const AGENTS_PRIORITIES = ['critical', 'high', 'medium', 'low'];

// ── Conexion / esquema ──────────────────────────────────────────────────────

function agents_db() {
    static $pdo = null;
    if ($pdo !== null) return $pdo;

    $dir = dirname(AGENTS_DB_PATH);
    if (!is_dir($dir)) @mkdir($dir, 0775, true);

    $pdo = new PDO('sqlite:' . AGENTS_DB_PATH);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $pdo->exec('PRAGMA journal_mode = WAL');
    $pdo->exec('PRAGMA foreign_keys = ON');

    $pdo->exec('
        CREATE TABLE IF NOT EXISTS agents (
            id               INTEGER PRIMARY KEY AUTOINCREMENT,
            agent_key        TEXT NOT NULL UNIQUE,
            name             TEXT NOT NULL,
            description      TEXT NOT NULL DEFAULT "",
            tags             TEXT NOT NULL DEFAULT "[]",
            img              TEXT NOT NULL DEFAULT "",
            prompt_system    TEXT NOT NULL DEFAULT "",
            soul             TEXT NOT NULL DEFAULT "",
            render           TEXT NOT NULL DEFAULT "markdown",
            model            TEXT NOT NULL DEFAULT "",
            source_file      TEXT NOT NULL DEFAULT "",
            source_mtime     TEXT NOT NULL DEFAULT "",
            brain_standalone INTEGER NOT NULL DEFAULT 0,
            active           INTEGER NOT NULL DEFAULT 1,
            date_creation    TEXT NOT NULL DEFAULT "",
            date_update      TEXT NOT NULL DEFAULT ""
        )
    ');

    // Un archivo de reglas. `content` NUNCA viaja al prompt; lo lee read_rules.
    $pdo->exec('
        CREATE TABLE IF NOT EXISTS agent_knowledge (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            name          TEXT NOT NULL,
            description   TEXT NOT NULL DEFAULT "",
            tags          TEXT NOT NULL DEFAULT "[]",
            content       TEXT NOT NULL DEFAULT "",
            when_to_use   TEXT NOT NULL DEFAULT "",
            rules         TEXT NOT NULL DEFAULT "[]",
            examples      TEXT NOT NULL DEFAULT "[]",
            evals         TEXT NOT NULL DEFAULT "[]",
            priority      TEXT NOT NULL DEFAULT "medium",
            source_file   TEXT NOT NULL DEFAULT "",
            active        INTEGER NOT NULL DEFAULT 1,
            date_creation TEXT NOT NULL DEFAULT "",
            date_update   TEXT NOT NULL DEFAULT "",
            agent_id      INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
            UNIQUE (agent_id, name)
        )
    ');

    // Lectura del archivo de otro agente: el dueno sigue siendo agent_knowledge.agent_id.
    // Una sola fuente de verdad — editarlo alcanza a todos los que lo comparten.
    $pdo->exec('
        CREATE TABLE IF NOT EXISTS agent_knowledge_share (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            date_creation TEXT NOT NULL DEFAULT "",
            knowledge_id  INTEGER NOT NULL REFERENCES agent_knowledge(id) ON DELETE CASCADE,
            agent_id      INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
            UNIQUE (knowledge_id, agent_id)
        )
    ');

    // Memoria por (agente, usuario). agent_key y no agent_id: en runtime lo unico que
    // se conoce es la clave que viene en el payload del turno.
    $pdo->exec('
        CREATE TABLE IF NOT EXISTS agent_memories (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            agent_key     TEXT NOT NULL,
            user_id       TEXT NOT NULL DEFAULT "",
            content       TEXT NOT NULL,
            date_creation TEXT NOT NULL DEFAULT ""
        )
    ');
    $pdo->exec('CREATE INDEX IF NOT EXISTS idx_memories_agent_user ON agent_memories (agent_key, user_id)');

    // Respaldo de la configuracion antes de pisarla desde el Lab. UNO por agente y
    // se intercambia al restaurar: guardar deja lo viejo aqui, restaurar aplica lo
    // viejo y deja aqui lo que habia — asi el boton alterna entre las dos versiones
    // en vez de acumular una pila que nadie va a revisar.
    $pdo->exec('
        CREATE TABLE IF NOT EXISTS agent_config_backup (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            prompt_system TEXT NOT NULL DEFAULT "",
            soul          TEXT NOT NULL DEFAULT "",
            model         TEXT NOT NULL DEFAULT "",
            temperature   REAL NOT NULL DEFAULT 0.7,
            effort        TEXT NOT NULL DEFAULT "",
            tools_csv     TEXT NOT NULL DEFAULT "",
            date_creation TEXT NOT NULL DEFAULT "",
            agent_id      INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
            UNIQUE (agent_id)
        )
    ');

    agents_migrate($pdo);
    agents_seed($pdo);
    return $pdo;
}

/**
 * Columnas agregadas despues de la primera version. SQLite no tiene
 * ADD COLUMN IF NOT EXISTS, asi que se consulta el esquema vivo.
 *   temperature / effort -> ajustes de muestreo por agente (los edita el Lab).
 */
function agents_migrate(PDO $pdo) {
    $cols = [];
    foreach ($pdo->query('PRAGMA table_info(agents)')->fetchAll(PDO::FETCH_ASSOC) as $c) $cols[] = $c['name'];
    if (!in_array('temperature', $cols, true)) $pdo->exec('ALTER TABLE agents ADD COLUMN temperature REAL NOT NULL DEFAULT 0.7');
    if (!in_array('effort',      $cols, true)) $pdo->exec('ALTER TABLE agents ADD COLUMN effort      TEXT NOT NULL DEFAULT ""');
}

// ── Seed desde ~/.claude/agents ─────────────────────────────────────────────

/**
 * Agentes que se dan de alta la primera vez, con el .md que les da su prompt.
 * Es el mismo trio que estaba hardcodeado en tools_agents_catalog().
 */
function agents_seed_catalog() {
    return [
        [
            'agent_key'   => 'CoffeeIA.md',
            'name'        => 'CoffeeIA',
            'description' => 'Framework y modulos',
            'render'      => 'code',
            'tags'        => ['framework', 'modulos', 'php'],
        ],
        [
            'agent_key'   => 'CoffeeMagic.md',
            'name'        => 'CoffeeMagic',
            'description' => 'Templates y UI',
            'render'      => 'html',
            'tags'        => ['ui', 'templates', 'diseno'],
        ],
        [
            'agent_key'   => 'coffee-intelligence.md',
            'name'        => 'CoffeeIntelligence',
            'description' => 'Modelado de datos',
            'render'      => 'markdown',
            'tags'        => ['bd', 'modelado'],
        ],
    ];
}

/**
 * Reparto inicial de los grimorios: quien es DUENO de cada archivo y con quien se
 * comparte. Es el mismo reparto que hoy se hace a mano con los checkboxes del
 * Playground, solo que declarado una vez.
 */
function agents_seed_knowledge() {
    return [
        'grimorio-huubie-ui.md'      => ['owner' => 'CoffeeMagic.md', 'share' => ['CoffeeIA.md'], 'priority' => 'critical', 'when' => 'al generar UI del producto Huubie (tema dark, clases .cs-*)'],
        'grimorio-coffeesoft.md'     => ['owner' => 'CoffeeMagic.md', 'share' => ['CoffeeIA.md'], 'priority' => 'high',     'when' => 'al generar UI con la paleta Arcilla Invernal (terracota, light+dark)'],
        'grimorio-coffee-varoch.md'  => ['owner' => 'CoffeeMagic.md', 'share' => ['CoffeeIA.md'], 'priority' => 'high',     'when' => 'al generar UI de Grupo Varoch (azul institucional #003360)'],
        'grimorio-finanzas.md'       => ['owner' => 'CoffeeMagic.md', 'share' => [],              'priority' => 'medium',   'when' => 'al generar pantallas del dominio de finanzas'],
        'grimorio-rrhh.md'           => ['owner' => 'CoffeeMagic.md', 'share' => [],              'priority' => 'medium',   'when' => 'al generar pantallas del dominio de recursos humanos'],
        'grimorio-fuente.md'         => ['owner' => 'CoffeeMagic.md', 'share' => [],              'priority' => 'medium',   'when' => 'al trabajar tipografia y jerarquia visual'],
        'db-rules.md'                => ['owner' => 'coffee-intelligence.md', 'share' => ['CoffeeIA.md'], 'priority' => 'critical', 'when' => 'antes de proponer o modificar cualquier esquema de base de datos'],
    ];
}

/** Carpeta ~/.claude/agents resuelta (misma logica que usa el visor). */
function agents_home() {
    return str_replace('\\', '/', coffee_user_home()) . '/.claude/agents';
}

/**
 * Alta idempotente de los agentes y sus grimorios. Solo inserta lo que falta: si el
 * usuario edito un prompt desde la UI, un seed posterior no lo pisa.
 */
function agents_seed(PDO $pdo) {
    $now  = date('Y-m-d H:i:s');
    $home = agents_home();

    $count = (int) $pdo->query('SELECT COUNT(*) FROM agents')->fetchColumn();
    if ($count === 0) {
        $ins = $pdo->prepare('
            INSERT OR IGNORE INTO agents
                (agent_key, name, description, tags, img, prompt_system, soul, render, model,
                 source_file, source_mtime, brain_standalone, active, date_creation, date_update)
            VALUES (?, ?, ?, ?, "", ?, "", ?, "", ?, ?, 0, 1, ?, ?)
        ');
        foreach (agents_seed_catalog() as $a) {
            $path   = $home . '/' . $a['agent_key'];
            $prompt = is_file($path) ? (string) @file_get_contents($path) : '';
            $mtime  = is_file($path) ? date('Y-m-d H:i:s', filemtime($path)) : '';
            $ins->execute([
                $a['agent_key'], $a['name'], $a['description'],
                json_encode($a['tags'], JSON_UNESCAPED_UNICODE),
                $prompt, $a['render'],
                is_file($path) ? $path : '', $mtime,
                $now, $now,
            ]);
        }
    }

    $kCount = (int) $pdo->query('SELECT COUNT(*) FROM agent_knowledge')->fetchColumn();
    if ($kCount > 0) return;

    $ids = [];
    foreach ($pdo->query('SELECT id, agent_key FROM agents')->fetchAll(PDO::FETCH_ASSOC) as $r) {
        $ids[$r['agent_key']] = (int) $r['id'];
    }

    $insK = $pdo->prepare('
        INSERT OR IGNORE INTO agent_knowledge
            (name, description, tags, content, when_to_use, rules, examples, evals,
             priority, source_file, active, date_creation, date_update, agent_id)
        VALUES (?, ?, "[]", ?, ?, "[]", "[]", "[]", ?, ?, 1, ?, ?, ?)
    ');
    $insS = $pdo->prepare('
        INSERT OR IGNORE INTO agent_knowledge_share (date_creation, knowledge_id, agent_id)
        VALUES (?, ?, ?)
    ');

    foreach (agents_seed_knowledge() as $file => $cfg) {
        if (!isset($ids[$cfg['owner']])) continue;
        $path = $home . '/grimorios/' . $file;
        if (!is_file($path)) continue;

        $content = (string) @file_get_contents($path);
        $insK->execute([
            $file, agents_first_heading($content), $content, $cfg['when'],
            $cfg['priority'], $path, $now, $now, $ids[$cfg['owner']],
        ]);
        $kid = (int) $pdo->lastInsertId();
        if ($kid < 1) continue;

        foreach ($cfg['share'] as $target) {
            if (isset($ids[$target])) $insS->execute([$now, $kid, $ids[$target]]);
        }
    }
}

/**
 * Descripcion automatica de un .md. Si trae frontmatter se prefiere su `description`
 * (es la que el autor escribio a proposito); si no, el primer encabezado del cuerpo.
 * El frontmatter se salta entero: tomar su primera linea daba descripciones como
 * "name: grimorio-huubie-ui", que no describen nada.
 */
function agents_first_heading($content) {
    $lines = explode("\n", (string) $content);
    $start = 0;

    if (isset($lines[0]) && trim($lines[0]) === '---') {
        for ($i = 1; $i < count($lines); $i++) {
            if (trim($lines[$i]) === '---') { $start = $i + 1; break; }
            if (preg_match('/^description\s*:\s*(.+)$/i', trim($lines[$i]), $m)) {
                return mb_substr(trim($m[1], " \t\"'"), 0, 255);
            }
        }
    }

    for ($i = $start; $i < count($lines); $i++) {
        $line = trim($lines[$i]);
        if ($line === '' || strpos($line, '---') === 0) continue;
        $line = trim(preg_replace('/[*_`>]/', '', ltrim($line, '# ')));
        if ($line !== '') return mb_substr($line, 0, 255);
    }
    return '';
}

// ── Lectura ─────────────────────────────────────────────────────────────────

/** Catalogo para tools_agents_catalog() y para los selectores del chat. */
function agents_catalog($onlyActive = true) {
    try {
        $sql = 'SELECT agent_key, name, description FROM agents';
        if ($onlyActive) $sql .= ' WHERE active = 1';
        $sql .= ' ORDER BY id ASC';
        $out = [];
        foreach (agents_db()->query($sql)->fetchAll(PDO::FETCH_ASSOC) as $r) {
            $out[] = ['key' => $r['agent_key'], 'label' => $r['name'], 'description' => $r['description']];
        }
        return $out;
    } catch (Throwable $e) {
        return [];
    }
}

function agents_get($id) {
    $st = agents_db()->prepare('SELECT * FROM agents WHERE id = ?');
    $st->execute([(int) $id]);
    $row = $st->fetch(PDO::FETCH_ASSOC);
    return $row ? agents_decorate($row) : null;
}

function agents_get_by_key($key) {
    try {
        $st = agents_db()->prepare('SELECT * FROM agents WHERE agent_key = ?');
        $st->execute([(string) $key]);
        $row = $st->fetch(PDO::FETCH_ASSOC);
        return $row ? agents_decorate($row) : null;
    } catch (Throwable $e) {
        return null;
    }
}

/** Lista completa con contadores para el rail de la UI. */
function agents_all() {
    $rows = agents_db()->query('SELECT * FROM agents ORDER BY id ASC')->fetchAll(PDO::FETCH_ASSOC);
    $out  = [];
    foreach ($rows as $r) {
        $a  = agents_decorate($r);
        $id = $a['id'];

        $st = agents_db()->prepare('SELECT COUNT(*) FROM agent_knowledge WHERE agent_id = ? AND active = 1');
        $st->execute([$id]);
        $a['rules_count'] = (int) $st->fetchColumn();

        $st = agents_db()->prepare('SELECT COUNT(*) FROM agent_knowledge_share WHERE agent_id = ?');
        $st->execute([$id]);
        $a['borrowed_count'] = (int) $st->fetchColumn();

        $st = agents_db()->prepare('SELECT COUNT(*) FROM agent_memories WHERE agent_key = ?');
        $st->execute([$a['agent_key']]);
        $a['memories_count'] = (int) $st->fetchColumn();

        $out[] = $a;
    }
    return $out;
}

/** Campos calculados que la UI necesita en cada fila de agente. */
function agents_decorate(array $row) {
    $row['id']               = (int) $row['id'];
    $row['active']           = (int) $row['active'];
    $row['brain_standalone'] = (int) $row['brain_standalone'];
    $row['temperature']      = isset($row['temperature']) ? (float) $row['temperature'] : 0.7;
    $row['effort']           = isset($row['effort']) ? (string) $row['effort'] : '';
    $row['tags']             = agents_json_list($row['tags']);
    $row['prompt_chars']     = mb_strlen((string) $row['prompt_system']);
    $row['prompt_tokens']    = agents_tokens($row['prompt_chars']);
    $row['soul_chars']       = mb_strlen((string) $row['soul']);
    // El .md de origen cambio despues de la ultima importacion: la ficha ofrece
    // recargarlo, pero nunca se pisa solo (el mismo archivo lo usa Claude Code).
    $row['source_stale']     = false;
    if ($row['source_file'] !== '' && is_file($row['source_file'])) {
        $row['source_stale'] = date('Y-m-d H:i:s', filemtime($row['source_file'])) > (string) $row['source_mtime'];
    }
    return $row;
}

function agents_json_list($raw) {
    if (is_array($raw)) return $raw;
    $v = json_decode((string) $raw, true);
    return is_array($v) ? $v : [];
}

/** Aproximacion suficiente para los medidores de la UI: ~4 caracteres por token. */
function agents_tokens($chars) {
    return (int) round(((int) $chars) / 4);
}

/**
 * Usuario dueno de las memorias. Los endpoints de chat no abren sesion (son APIs sin
 * auth-guard), asi que se abre aqui — solo si todavia no se mando nada al navegador,
 * porque en el endpoint SSE cualquier session_start tardio seria un warning en medio
 * del stream. Sin sesion se cae al perfil invitado (''), igual que chats y prefs.
 */
function agents_user_id() {
    if (isset($_SESSION['user_id'])) return (string) $_SESSION['user_id'];
    if (session_status() === PHP_SESSION_NONE && !headers_sent()) {
        @include_once __DIR__ . '/../../ctrl/auth-session.php';
    }
    return isset($_SESSION['user_id']) ? (string) $_SESSION['user_id'] : '';
}

// ── Reglas ──────────────────────────────────────────────────────────────────

/** Archivos PROPIOS de un agente, ordenados como los ve el indice del prompt. */
function agents_rules($agentId) {
    $st = agents_db()->prepare('
        SELECT id, name, description, tags, when_to_use, priority, active, source_file,
               date_creation, date_update, LENGTH(content) AS size,
               rules, examples, evals
        FROM agent_knowledge
        WHERE agent_id = ?
        ORDER BY CASE priority WHEN "critical" THEN 1 WHEN "high" THEN 2 WHEN "medium" THEN 3 ELSE 4 END, name ASC
    ');
    $st->execute([(int) $agentId]);

    $shareMap = agents_share_map($agentId);
    $out = [];
    foreach ($st->fetchAll(PDO::FETCH_ASSOC) as $r) {
        $r['id']          = (int) $r['id'];
        $r['active']      = (int) $r['active'];
        $r['size']        = (int) $r['size'];
        $r['tokens']      = agents_tokens($r['size']);
        $r['tags']        = agents_json_list($r['tags']);
        $r['rules']       = count(agents_json_list($r['rules']));
        $r['examples']    = count(agents_json_list($r['examples']));
        $r['evals']       = agents_eval_summary(agents_json_list($r['evals']));
        $r['shared_with'] = isset($shareMap[$r['id']]) ? $shareMap[$r['id']] : [];
        $out[] = $r;
    }
    return $out;
}

/** knowledge_id => [agent_id, ...] de los archivos propios de este agente. */
function agents_share_map($agentId) {
    $st = agents_db()->prepare('
        SELECT s.knowledge_id, s.agent_id
        FROM agent_knowledge_share s
        INNER JOIN agent_knowledge k ON k.id = s.knowledge_id
        WHERE k.agent_id = ?
    ');
    $st->execute([(int) $agentId]);
    $map = [];
    foreach ($st->fetchAll(PDO::FETCH_ASSOC) as $r) {
        $map[(int) $r['knowledge_id']][] = (int) $r['agent_id'];
    }
    return $map;
}

/** Archivos que OTROS agentes le prestaron: solo lectura para este. */
function agents_rules_borrowed($agentId) {
    $st = agents_db()->prepare('
        SELECT k.id, k.name, k.description, k.priority, k.active, k.when_to_use,
               LENGTH(k.content) AS size, a.name AS owner
        FROM agent_knowledge_share s
        INNER JOIN agent_knowledge k ON k.id = s.knowledge_id
        INNER JOIN agents a ON a.id = k.agent_id
        WHERE s.agent_id = ?
        ORDER BY CASE k.priority WHEN "critical" THEN 1 WHEN "high" THEN 2 WHEN "medium" THEN 3 ELSE 4 END, k.name ASC
    ');
    $st->execute([(int) $agentId]);
    $out = [];
    foreach ($st->fetchAll(PDO::FETCH_ASSOC) as $r) {
        $r['id']     = (int) $r['id'];
        $r['active'] = (int) $r['active'];
        $r['size']   = (int) $r['size'];
        $r['tokens'] = agents_tokens($r['size']);
        $out[] = $r;
    }
    return $out;
}

function agents_rule_get($id) {
    $st = agents_db()->prepare('SELECT * FROM agent_knowledge WHERE id = ?');
    $st->execute([(int) $id]);
    $row = $st->fetch(PDO::FETCH_ASSOC);
    if (!$row) return null;

    $row['id']       = (int) $row['id'];
    $row['agent_id'] = (int) $row['agent_id'];
    $row['active']   = (int) $row['active'];
    $row['tags']     = agents_json_list($row['tags']);
    $row['rules']    = agents_json_list($row['rules']);
    $row['examples'] = agents_json_list($row['examples']);
    $row['evals']    = agents_json_list($row['evals']);
    $row['size']     = mb_strlen((string) $row['content']);
    $row['tokens']   = agents_tokens($row['size']);
    return $row;
}

/**
 * Resumen del banco de evals para la fila del listado: cuantos casos hay, cuantos se
 * corrieron y que porcentaje de criterios cumplio. Los casos sin correr no entran en
 * el promedio: arrastrarian el numero a cero sin haber probado nada.
 */
function agents_eval_summary(array $list) {
    $run = 0; $score = 0; $total = 0;
    foreach ($list as $case) {
        if (empty($case['total'])) continue;
        $run++;
        $score += (int) $case['score'];
        $total += (int) $case['total'];
    }
    return [
        'cases' => count($list),
        'run'   => $run,
        'pct'   => $total > 0 ? (int) round($score * 100 / $total) : 0,
    ];
}

// ── Presupuesto de contexto ─────────────────────────────────────────────────

/**
 * Cuanto pesa el cerebro de un agente: lo que SI viaja cada turno (prompt + alma +
 * indice + memorias) contra lo que queda on-demand. Es el marcador que justifica todo
 * el modelo de indice: sin el, nadie ve la diferencia entre inyectar 100 KB y 20 lineas.
 */
function agents_budget(array $agent) {
    $indexChars = 0;
    $poolChars  = 0;

    foreach (array_merge(agents_rules($agent['id']), agents_rules_borrowed($agent['id'])) as $r) {
        if ((int) $r['active'] !== 1) continue;
        // Lo que ocupa su linea de indice: "- name — description · cuando: ..."
        $indexChars += mb_strlen($r['name']) + mb_strlen((string) $r['description'])
                     + mb_strlen((string) (isset($r['when_to_use']) ? $r['when_to_use'] : '')) + 16;
        $poolChars  += (int) $r['size'];
    }

    $st = agents_db()->prepare('SELECT SUM(LENGTH(content)) FROM agent_memories WHERE agent_key = ?');
    $st->execute([$agent['agent_key']]);
    $memoryChars = (int) $st->fetchColumn();

    $fixed = (int) $agent['prompt_chars'] + (int) $agent['soul_chars'] + $indexChars + $memoryChars;

    return [
        'prompt_tokens' => agents_tokens($agent['prompt_chars'] + $agent['soul_chars']),
        'index_tokens'  => agents_tokens($indexChars),
        'memory_tokens' => agents_tokens($memoryChars),
        'fixed_tokens'  => agents_tokens($fixed),
        'pool_tokens'   => agents_tokens($poolChars),
        'pool_chars'    => $poolChars,
        // Lo que costaria el modelo viejo: todo el contenido inyectado cada turno.
        'legacy_tokens' => agents_tokens($fixed - $indexChars + $poolChars),
    ];
}

// ── Memoria ─────────────────────────────────────────────────────────────────

function agents_memories($agentKey, $userId, $limit = 200) {
    $st = agents_db()->prepare('
        SELECT id, content, date_creation
        FROM agent_memories
        WHERE agent_key = ? AND user_id = ?
        ORDER BY id DESC
        LIMIT ' . (int) $limit
    );
    $st->execute([(string) $agentKey, (string) $userId]);
    $out = [];
    foreach ($st->fetchAll(PDO::FETCH_ASSOC) as $r) {
        $r['id'] = (int) $r['id'];
        $out[] = $r;
    }
    return $out;
}
