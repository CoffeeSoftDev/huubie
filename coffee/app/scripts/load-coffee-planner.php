<?php
/**
 * Alta idempotente del agente coffee-planner y su archivo de reglas en el registro
 * del visor (data/agents.sqlite).
 *
 * El seed de agents-registry.php solo corre con las tablas vacias, asi que un agente
 * nuevo se da de alta con un script como este: inserta lo que falta y actualiza el
 * contenido del .md si ya existia. Nunca pisa el prompt editado desde la UI salvo que
 * se pase --force.
 *
 * Uso (local): php coffee/app/scripts/load-coffee-planner.php [--force]
 */
if (php_sapi_name() !== 'cli') exit(0);

require_once __DIR__ . '/../visor/ctrl/agents-registry.php';

const PLANNER_KEY  = 'coffee-planner.md';
const PLANNER_NAME = 'CoffeePlanner';
const PLANNER_RULE = 'historias-de-usuario.md';

$force = in_array('--force', $argv, true);
$now   = date('Y-m-d H:i:s');
$home  = agents_home();
$pdo   = agents_db();

// ── 1) El agente ────────────────────────────────────────────────────────────
$promptPath = $home . '/' . PLANNER_KEY;
if (!is_file($promptPath)) {
    echo "ERROR: no existe $promptPath\n";
    exit(1);
}

$prompt = (string) file_get_contents($promptPath);
$mtime  = date('Y-m-d H:i:s', filemtime($promptPath));

$st = $pdo->prepare('SELECT id, prompt_system FROM agents WHERE agent_key = ?');
$st->execute([PLANNER_KEY]);
$agent = $st->fetch(PDO::FETCH_ASSOC);

if ($agent === false) {
    $ins = $pdo->prepare('
        INSERT INTO agents
            (agent_key, name, description, tags, img, prompt_system, soul, render, model,
             source_file, source_mtime, brain_standalone, active, date_creation, date_update)
        VALUES (?, ?, ?, ?, "", ?, "", "markdown", ?, ?, ?, 0, 1, ?, ?)
    ');
    $ins->execute([
        PLANNER_KEY, PLANNER_NAME, 'Historias de usuario y sprints',
        json_encode(['planeacion', 'historias', 'sprints'], JSON_UNESCAPED_UNICODE),
        $prompt, 'glm-5.2:cloud', $promptPath, $mtime, $now, $now,
    ]);
    $agentId = (int) $pdo->lastInsertId();
    echo "INSERT agente " . PLANNER_NAME . " (id $agentId, " . strlen($prompt) . " bytes)\n";
} else {
    $agentId = (int) $agent['id'];
    if ($force || trim((string) $agent['prompt_system']) === '') {
        $up = $pdo->prepare('
            UPDATE agents SET prompt_system = ?, source_file = ?, source_mtime = ?, date_update = ?
            WHERE id = ?
        ');
        $up->execute([$prompt, $promptPath, $mtime, $now, $agentId]);
        echo "UPDATE agente " . PLANNER_NAME . " (id $agentId, prompt recargado)\n";
    } else {
        echo "SKIP   agente " . PLANNER_NAME . " (id $agentId, ya existe; usa --force para recargar el prompt)\n";
    }
}

// ── 2) Su archivo de reglas ─────────────────────────────────────────────────
$rulePath = $home . '/grimorios/' . PLANNER_RULE;
if (!is_file($rulePath)) {
    echo "ERROR: no existe $rulePath\n";
    exit(1);
}

$content = (string) file_get_contents($rulePath);
$desc    = 'Formato Varoch de historias de usuario: tabla (Yo / En el apartado / Quiero / Beneficio / Criterios / Sprint / Points / Fecha), criterios como especificacion de pantalla (filterBar, cards, columnas, modales), una historia por perfil y checklist';
$when    = 'SIEMPRE que se pidan historias de usuario, backlog, criterios de aceptacion, planeacion de sprint o el desglose funcional de un modulo. Se lee ANTES de escribir la primera historia';

$st = $pdo->prepare('SELECT id FROM agent_knowledge WHERE agent_id = ? AND name = ?');
$st->execute([$agentId, PLANNER_RULE]);
$ruleId = $st->fetchColumn();

if ($ruleId === false) {
    $ins = $pdo->prepare('
        INSERT INTO agent_knowledge
            (name, description, tags, content, when_to_use, rules, examples, evals,
             priority, source_file, active, date_creation, date_update, agent_id)
        VALUES (?, ?, "[]", ?, ?, "[]", "[]", "[]", "critical", ?, 1, ?, ?, ?)
    ');
    $ins->execute([PLANNER_RULE, $desc, $content, $when, $rulePath, $now, $now, $agentId]);
    echo "INSERT regla  " . PLANNER_RULE . " (id " . $pdo->lastInsertId() . ", " . strlen($content) . " bytes)\n";
} else {
    $up = $pdo->prepare('
        UPDATE agent_knowledge
        SET content = ?, description = ?, when_to_use = ?, priority = "critical",
            source_file = ?, date_update = ?
        WHERE id = ?
    ');
    $up->execute([$content, $desc, $when, $rulePath, $now, (int) $ruleId]);
    echo "UPDATE regla  " . PLANNER_RULE . " (id $ruleId, " . strlen($content) . " bytes)\n";
}

echo "Listo.\n";
