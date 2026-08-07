<?php
/**
 * Alta idempotente del agente coffee-clown y su regla en el registro del visor
 * (data/agents.sqlite), mas el reparto de las herramientas del cajon de TODOs.
 *
 * Molde: load-coffee-planner.php. Inserta lo que falta y actualiza el contenido del
 * .md si ya existia. Nunca pisa el prompt editado desde la UI salvo con --force.
 *
 * La regla de patrones se COMPARTE con CoffeePlanner (agent_knowledge_share): una
 * sola fuente, dos lectores — al planear un sprint conviene saber que se corrige
 * siempre.
 *
 * Uso (local): php coffee/app/scripts/load-coffee-clown.php [--force]
 */
if (php_sapi_name() !== 'cli') exit(0);

require_once __DIR__ . '/../visor/ctrl/agents-registry.php';
require_once __DIR__ . '/../visor/ctrl/tools-registry.php';

const CLOWN_KEY  = 'coffee-clown.md';
const CLOWN_NAME = 'CoffeeClown';

// Solo las de LECTURA se acotan a este agente: son suyas y a los demas chats solo
// les gastarian contexto. `todo_propose` se queda abierta a todos — hoy cualquier
// chat puede anotar tareas y eso no se toca.
const CLOWN_TOOLS = ['todo_list', 'todo_read', 'todo_stats'];

function clown_rules() {
    return [
        [
            'file'   => 'patrones-de-correccion.md',
            'desc'   => 'Como se lee el cajon de TODOs para saber que se corrige una y otra vez: de donde salen '
                      . 'los numeros (todo_stats), la taxonomia de siete categorias, las tres condiciones que '
                      . 'convierten una correccion repetida en regla y como se redacta ese borrador',
            'when'   => 'SIEMPRE antes de responder que se repite, que se corrige mas o de proponer una regla. '
                      . 'Tambien al planear un sprint, para no volver a especificar lo que siempre se corrige',
            'shared' => 'coffee-planner.md',
        ],
    ];
}

$force = in_array('--force', $argv, true);
$now   = date('Y-m-d H:i:s');
$home  = agents_home();
$pdo   = agents_db();

// ── 1) El agente ────────────────────────────────────────────────────────────
$promptPath = $home . '/' . CLOWN_KEY;
if (!is_file($promptPath)) {
    echo "ERROR: no existe $promptPath\n";
    exit(1);
}

$prompt = (string) file_get_contents($promptPath);
$mtime  = date('Y-m-d H:i:s', filemtime($promptPath));

$st = $pdo->prepare('SELECT id, prompt_system FROM agents WHERE agent_key = ?');
$st->execute([CLOWN_KEY]);
$agent = $st->fetch(PDO::FETCH_ASSOC);

if ($agent === false) {
    $ins = $pdo->prepare('
        INSERT INTO agents
            (agent_key, name, description, tags, img, prompt_system, soul, render, model,
             source_file, source_mtime, brain_standalone, active, date_creation, date_update)
        VALUES (?, ?, ?, ?, "", ?, "", "markdown", ?, ?, ?, 0, 1, ?, ?)
    ');
    $ins->execute([
        CLOWN_KEY, CLOWN_NAME, 'Cuida el cajon de TODOs y dice que se repite',
        json_encode(['todo', 'pendientes', 'patrones'], JSON_UNESCAPED_UNICODE),
        $prompt, 'glm-5.2:cloud', $promptPath, $mtime, $now, $now,
    ]);
    $agentId = (int) $pdo->lastInsertId();
    echo "INSERT agente " . CLOWN_NAME . " (id $agentId, " . strlen($prompt) . " bytes)\n";
} else {
    $agentId = (int) $agent['id'];
    if ($force || trim((string) $agent['prompt_system']) === '') {
        $up = $pdo->prepare('
            UPDATE agents SET prompt_system = ?, source_file = ?, source_mtime = ?, date_update = ?
            WHERE id = ?
        ');
        $up->execute([$prompt, $promptPath, $mtime, $now, $agentId]);
        echo "UPDATE agente " . CLOWN_NAME . " (id $agentId, prompt recargado)\n";
    } else {
        echo "SKIP   agente " . CLOWN_NAME . " (id $agentId, ya existe; usa --force para recargar el prompt)\n";
    }
}

// ── 2) Su regla, y con quien se comparte ────────────────────────────────────
foreach (clown_rules() as $rule) {
    $rulePath = $home . '/grimorios/' . $rule['file'];
    if (!is_file($rulePath)) {
        echo "ERROR: no existe $rulePath\n";
        exit(1);
    }

    $content = (string) file_get_contents($rulePath);

    $st = $pdo->prepare('SELECT id FROM agent_knowledge WHERE agent_id = ? AND name = ?');
    $st->execute([$agentId, $rule['file']]);
    $ruleId = $st->fetchColumn();

    if ($ruleId === false) {
        $ins = $pdo->prepare('
            INSERT INTO agent_knowledge
                (name, description, tags, content, when_to_use, rules, examples, evals,
                 priority, source_file, active, date_creation, date_update, agent_id)
            VALUES (?, ?, "[]", ?, ?, "[]", "[]", "[]", "critical", ?, 1, ?, ?, ?)
        ');
        $ins->execute([$rule['file'], $rule['desc'], $content, $rule['when'], $rulePath, $now, $now, $agentId]);
        $ruleId = (int) $pdo->lastInsertId();
        echo "INSERT regla  " . $rule['file'] . " (id $ruleId, " . strlen($content) . " bytes)\n";
    } else {
        $ruleId = (int) $ruleId;
        $up = $pdo->prepare('
            UPDATE agent_knowledge
            SET content = ?, description = ?, when_to_use = ?, priority = "critical",
                source_file = ?, date_update = ?
            WHERE id = ?
        ');
        $up->execute([$content, $rule['desc'], $rule['when'], $rulePath, $now, $ruleId]);
        echo "UPDATE regla  " . $rule['file'] . " (id $ruleId, " . strlen($content) . " bytes)\n";
    }

    // Prestada a otro agente: el dueno sigue siendo CoffeeClown.
    if (($rule['shared'] ?? '') !== '') {
        $st = $pdo->prepare('SELECT id FROM agents WHERE agent_key = ?');
        $st->execute([$rule['shared']]);
        $otherId = $st->fetchColumn();

        if ($otherId === false) {
            echo "SKIP   comparticion (" . $rule['shared'] . " no esta dado de alta)\n";
        } else {
            $ins = $pdo->prepare('
                INSERT OR IGNORE INTO agent_knowledge_share (knowledge_id, agent_id, date_creation)
                VALUES (?, ?, ?)
            ');
            $ins->execute([$ruleId, (int) $otherId, $now]);
            echo "SHARE  regla  " . $rule['file'] . " -> " . $rule['shared'] . "\n";
        }
    }
}

// ── 3) Las herramientas del cajon, asignadas al agente ──────────────────────
// El catalogo de builtins ya las tiene; aqui solo se acota a quien las ve. Sin
// esto, todos los agentes del visor cargarian con las herramientas del TODO.
$pdo2 = tools_db();
foreach (CLOWN_TOOLS as $toolName) {
    $st = $pdo2->prepare('SELECT id, agents FROM tools WHERE name = ?');
    $st->execute([$toolName]);
    $row = $st->fetch(PDO::FETCH_ASSOC);

    if ($row === false) {
        echo "SKIP   tool   $toolName (no esta en el catalogo)\n";
        continue;
    }

    // La columna es CSV, y vacia significa "todos los agentes" (tools_scope_match).
    $agents = array_filter(array_map('trim', explode(',', (string) $row['agents'])));
    if (in_array(CLOWN_KEY, $agents, true)) {
        echo "SKIP   tool   $toolName (ya asignada)\n";
        continue;
    }

    $agents[] = CLOWN_KEY;
    $up = $pdo2->prepare('UPDATE tools SET agents = ? WHERE id = ?');
    $up->execute([implode(',', $agents), (int) $row['id']]);
    echo "TOOL   $toolName -> " . CLOWN_NAME . "\n";
}

echo "Listo.\n";
