<?php
/**
 * ABC de los AGENTES sobre data/agents.sqlite: su ficha, sus archivos de reglas y su
 * memoria persistente. Es lo que administra la pagina agents.php.
 *
 * Mismo patron que ctrl-tools.php (su gemelo para el catalogo de herramientas): una
 * sola entrada, `action` por POST o GET, respuesta {success, ...}.
 *
 * Agentes:  list · get · save · status · reload · delete
 * Reglas:   rules · rule · ruleSave · ruleStatus · ruleShare · ruleDelete
 * Memoria:  memories · memoryAdd · memoryDelete
 *
 * Las tools asignadas no viven aqui: son la columna `agents` de tools.sqlite y se
 * escriben con ctrl-tools.php (action=assign). Este controlador solo las LEE para
 * pintar la pestana Herramientas de la ficha.
 */

require_once __DIR__ . '/../../ctrl/auth-session.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

require_once __DIR__ . '/agents-registry.php';
require_once __DIR__ . '/agent-brain.php';
require_once __DIR__ . '/tools-registry.php';

function agents_out($data) {
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}
function agents_fail($msg, $code = 400) {
    http_response_code($code);
    agents_out(['success' => false, 'message' => $msg]);
}

/** Campo que viaja como JSON en un solo parametro (tags, rules, examples, evals). */
function agents_json_field($key) {
    $raw = $_POST[$key] ?? $_GET[$key] ?? '';
    if (is_array($raw)) return $raw;
    $v = json_decode((string) $raw, true);
    return is_array($v) ? $v : [];
}

function agents_post($key, $default = '') {
    $v = $_POST[$key] ?? $_GET[$key] ?? $default;
    return is_string($v) ? trim($v) : $v;
}

/** Nombres de las tools asignadas a un agente, como CSV (para el respaldo). */
function agents_tools_csv($agentKey) {
    $names = [];
    foreach (tools_all() as $t) {
        if (in_array($agentKey, $t['agents'], true)) $names[] = $t['name'];
    }
    return implode(',', $names);
}

/**
 * Reescribe la asignacion de UN agente en cada fila de tools.sqlite, dejando intacta
 * la de los demas. La columna `agents` es un CSV compartido: pisarla con la lista de
 * esta pantalla borraria lo que otras superficies configuraron.
 */
function agents_apply_tools($agentKey, $wanted) {
    $want = array_filter(array_map('trim', explode(',', (string) $wanted)));
    $now  = date('Y-m-d H:i:s');
    $st   = tools_db()->prepare('UPDATE tools SET agents = ?, date_update = ? WHERE id = ?');

    foreach (tools_all() as $t) {
        $keys = $t['agents'];                       // ya viene expandido: vacio = todos
        $has  = in_array($agentKey, $keys, true);
        $on   = in_array($t['name'], $want, true);
        if ($has === $on) continue;

        if ($on) $keys[] = $agentKey;
        else     $keys = array_values(array_filter($keys, function ($k) use ($agentKey) { return $k !== $agentKey; }));

        $st->execute([tools_clean_scope(implode(',', $keys), tools_agents_catalog()), $now, $t['id']]);
    }
}

/** Herramientas del catalogo que este agente tiene declaradas. */
function agents_tools_for($agentKey) {
    $out = [];
    foreach (tools_all() as $t) {
        $out[] = [
            'id'       => $t['id'],
            'name'     => $t['name'],
            'label'    => $t['label'],
            'category' => $t['category'],
            'icon'     => $t['icon'],
            'source'   => $t['source'],
            'active'   => $t['active'],
            'assigned' => in_array($agentKey, $t['agents'], true),
            // Abierta = la fila no limita a nadie, asi que tambien la heredan los
            // agentes que se creen despues. Limitada = solo los que estan listados
            // hoy; uno nuevo naceria sin ella.
            'open'     => !empty($t['agents_open']),
            'shared'   => count($t['agents']),
        ];
    }
    return $out;
}

$action = agents_post('action');

try {
    switch ($action) {

        // ── Agentes ─────────────────────────────────────────────────────────

        case 'list': {
            agents_out([
                'success' => true,
                'agents'  => agents_all(),
                'user_id' => agents_user_id(),
            ]);
        }

        // Catalogo minimo para los selectores de agente del chat (clave, nombre y
        // descripcion). `list` tambien serviria, pero arrastra el prompt completo de
        // cada agente: decenas de KB en cada carga de pagina solo para pintar un
        // <select>.
        case 'catalog': {
            agents_out(['success' => true, 'agents' => agents_catalog(true)]);
        }

        case 'get': {
            $agent = agents_get((int) agents_post('id'));
            if (!$agent) agents_fail('Agente no encontrado', 404);

            $userId = agents_user_id();
            $st = agents_db()->prepare('SELECT COUNT(*) FROM agent_config_backup WHERE agent_id = ?');
            $st->execute([$agent['id']]);

            agents_out([
                'success'    => true,
                'agent'      => $agent,
                'rules'      => agents_rules($agent['id']),
                'borrowed'   => agents_rules_borrowed($agent['id']),
                'memories'   => agents_memories($agent['agent_key'], $userId),
                'budget'     => agents_budget($agent),
                'tools'      => agents_tools_for($agent['agent_key']),
                'peers'      => agents_catalog(false),
                'has_backup' => (int) $st->fetchColumn() > 0,
            ]);
        }

        case 'save': {
            $id   = (int) agents_post('id');
            $name = agents_post('name');
            $key  = agents_post('agent_key');
            if ($name === '') agents_fail('Escribe el nombre del agente');

            $now = date('Y-m-d H:i:s');
            $fields = [
                'name'             => mb_substr($name, 0, 120),
                'description'      => mb_substr(agents_post('description'), 0, 500),
                'tags'             => json_encode(agents_json_field('tags'), JSON_UNESCAPED_UNICODE),
                'img'              => agents_post('img'),
                'prompt_system'    => (string) ($_POST['prompt_system'] ?? ''),
                'soul'             => (string) ($_POST['soul'] ?? ''),
                'render'           => in_array(agents_post('render'), ['markdown', 'html', 'code'], true) ? agents_post('render') : 'markdown',
                'model'            => agents_post('model'),
                'brain_standalone' => agents_post('brain_standalone') == '1' ? 1 : 0,
                'active'           => agents_post('active') == '0' ? 0 : 1,
                'date_update'      => $now,
            ];

            if ($id > 0) {
                if (!agents_get($id)) agents_fail('Agente no encontrado', 404);
                $set = [];
                foreach (array_keys($fields) as $c) $set[] = "$c = ?";
                $sql = 'UPDATE agents SET ' . implode(', ', $set) . ' WHERE id = ?';
                agents_db()->prepare($sql)->execute(array_merge(array_values($fields), [$id]));
            } else {
                // La clave es la identidad del agente: viaja en tools.agents y en
                // chats.doc. Si no la dan, se deriva del nombre con la forma de un .md.
                if ($key === '') {
                    $key = preg_replace('/[^A-Za-z0-9_-]/', '-', $name) . '.md';
                }
                $st = agents_db()->prepare('SELECT COUNT(*) FROM agents WHERE agent_key = ?');
                $st->execute([$key]);
                if ((int) $st->fetchColumn() > 0) agents_fail('Ya existe un agente con la clave ' . $key, 409);

                $fields['agent_key']     = $key;
                $fields['source_file']   = '';
                $fields['source_mtime']  = '';
                $fields['date_creation'] = $now;

                $cols = array_keys($fields);
                $sql  = 'INSERT INTO agents (' . implode(', ', $cols) . ') VALUES ('
                      . implode(', ', array_fill(0, count($cols), '?')) . ')';
                agents_db()->prepare($sql)->execute(array_values($fields));
                $id = (int) agents_db()->lastInsertId();
            }

            agents_out(['success' => true, 'id' => $id, 'message' => 'Agente guardado']);
        }

        case 'status': {
            $id = (int) agents_post('id');
            if (!agents_get($id)) agents_fail('Agente no encontrado', 404);
            $st = agents_db()->prepare('UPDATE agents SET active = ?, date_update = ? WHERE id = ?');
            $st->execute([agents_post('active') == '1' ? 1 : 0, date('Y-m-d H:i:s'), $id]);
            agents_out(['success' => true, 'message' => agents_post('active') == '1' ? 'Agente activado' : 'Agente desactivado']);
        }

        // Vuelve a leer el .md de origen. Explicito a proposito: el mismo archivo lo
        // usa Claude Code y pisar el prompt editado sin avisar seria perder trabajo.
        case 'reload': {
            $agent = agents_get((int) agents_post('id'));
            if (!$agent) agents_fail('Agente no encontrado', 404);
            if ($agent['source_file'] === '' || !is_file($agent['source_file'])) {
                agents_fail('Este agente no tiene archivo de origen en disco');
            }

            $content = (string) @file_get_contents($agent['source_file']);
            $st = agents_db()->prepare('UPDATE agents SET prompt_system = ?, source_mtime = ?, date_update = ? WHERE id = ?');
            $st->execute([
                $content,
                date('Y-m-d H:i:s', filemtime($agent['source_file'])),
                date('Y-m-d H:i:s'),
                $agent['id'],
            ]);
            agents_out(['success' => true, 'message' => 'Prompt recargado desde ' . basename($agent['source_file'])]);
        }

        case 'delete': {
            $agent = agents_get((int) agents_post('id'));
            if (!$agent) agents_fail('Agente no encontrado', 404);
            // Las reglas y los shares caen con el (FK ON DELETE CASCADE); las memorias
            // van por agent_key y hay que barrerlas aparte.
            agents_db()->prepare('DELETE FROM agent_memories WHERE agent_key = ?')->execute([$agent['agent_key']]);
            agents_db()->prepare('DELETE FROM agents WHERE id = ?')->execute([$agent['id']]);
            agents_out(['success' => true, 'message' => 'Agente eliminado']);
        }

        // ── Configuración desde el Lab ──────────────────────────────────────
        //
        // Pisa la configuración REAL del agente (la que usan todos los chats), así
        // que antes se respalda la que había. `restore` aplica el respaldo y deja en
        // su lugar lo que estaba: el botón alterna entre las dos versiones.

        case 'configSave': {
            $agent = agents_get((int) agents_post('id'));
            if (!$agent) agents_fail('Agente no encontrado', 404);

            $now      = date('Y-m-d H:i:s');
            $toolsCsv = agents_tools_csv($agent['agent_key']);

            $st = agents_db()->prepare('
                INSERT INTO agent_config_backup
                    (prompt_system, soul, model, temperature, effort, tools_csv, date_creation, agent_id)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT (agent_id) DO UPDATE SET
                    prompt_system = excluded.prompt_system,
                    soul          = excluded.soul,
                    model         = excluded.model,
                    temperature   = excluded.temperature,
                    effort        = excluded.effort,
                    tools_csv     = excluded.tools_csv,
                    date_creation = excluded.date_creation
            ');
            $st->execute([
                $agent['prompt_system'], $agent['soul'], $agent['model'],
                $agent['temperature'], $agent['effort'], $toolsCsv, $now, $agent['id'],
            ]);

            $temp = (float) agents_post('temperature', 0.7);
            if ($temp < 0) $temp = 0;
            if ($temp > 2) $temp = 2;

            $st = agents_db()->prepare('
                UPDATE agents SET prompt_system = ?, soul = ?, model = ?, temperature = ?, effort = ?, date_update = ?
                WHERE id = ?
            ');
            $st->execute([
                (string) ($_POST['prompt_system'] ?? ''),
                (string) ($_POST['soul'] ?? ''),
                agents_post('model'),
                $temp,
                in_array(agents_post('effort'), ['', 'off', 'low', 'medium', 'high', 'max'], true) ? agents_post('effort') : '',
                $now,
                $agent['id'],
            ]);

            // Las tools viven en tools.sqlite: se reescribe la asignación de este
            // agente en cada fila, respetando la de los demás.
            if (isset($_POST['tools'])) {
                agents_apply_tools($agent['agent_key'], (string) $_POST['tools']);
            }

            agents_out(['success' => true, 'message' => 'Configuración guardada en ' . $agent['name'], 'has_backup' => true]);
        }

        case 'configRestore': {
            $agent = agents_get((int) agents_post('id'));
            if (!$agent) agents_fail('Agente no encontrado', 404);

            $st = agents_db()->prepare('SELECT * FROM agent_config_backup WHERE agent_id = ?');
            $st->execute([$agent['id']]);
            $backup = $st->fetch(PDO::FETCH_ASSOC);
            if (!$backup) agents_fail('Este agente no tiene una configuración respaldada', 404);

            $now      = date('Y-m-d H:i:s');
            $current  = agents_tools_csv($agent['agent_key']);

            $st = agents_db()->prepare('
                UPDATE agents SET prompt_system = ?, soul = ?, model = ?, temperature = ?, effort = ?, date_update = ?
                WHERE id = ?
            ');
            $st->execute([
                $backup['prompt_system'], $backup['soul'], $backup['model'],
                $backup['temperature'], $backup['effort'], $now, $agent['id'],
            ]);
            agents_apply_tools($agent['agent_key'], (string) $backup['tools_csv']);

            // Lo que acabamos de pisar pasa a ser el respaldo: el botón alterna.
            $st = agents_db()->prepare('
                UPDATE agent_config_backup
                SET prompt_system = ?, soul = ?, model = ?, temperature = ?, effort = ?, tools_csv = ?, date_creation = ?
                WHERE agent_id = ?
            ');
            $st->execute([
                $agent['prompt_system'], $agent['soul'], $agent['model'],
                $agent['temperature'], $agent['effort'], $current, $now, $agent['id'],
            ]);

            agents_out([
                'success' => true,
                'message' => 'Configuración anterior restaurada',
                'config'  => [
                    'prompt_system' => $backup['prompt_system'],
                    'soul'          => $backup['soul'],
                    'model'         => $backup['model'],
                    'temperature'   => (float) $backup['temperature'],
                    'effort'        => $backup['effort'],
                    'tools'         => array_values(array_filter(explode(',', (string) $backup['tools_csv']))),
                ],
            ]);
        }

        // ── Reglas ──────────────────────────────────────────────────────────

        case 'rules': {
            $id = (int) agents_post('id');
            if (!agents_get($id)) agents_fail('Agente no encontrado', 404);
            agents_out(['success' => true, 'rules' => agents_rules($id), 'borrowed' => agents_rules_borrowed($id)]);
        }

        case 'rule': {
            $rule = agents_rule_get((int) agents_post('id'));
            if (!$rule) agents_fail('Archivo de reglas no encontrado', 404);
            agents_out(['success' => true, 'rule' => $rule]);
        }

        case 'ruleSave': {
            $id      = (int) agents_post('id');
            $agentId = (int) agents_post('agent_id');
            $name    = agents_post('name');
            if ($name === '') agents_fail('Escribe el nombre del archivo: es lo que pide read_rules');

            $now  = date('Y-m-d H:i:s');
            $data = [
                'name'        => mb_substr($name, 0, 100),
                'description' => mb_substr(agents_post('description'), 0, 255),
                'tags'        => json_encode(agents_json_field('tags'), JSON_UNESCAPED_UNICODE),
                'content'     => (string) ($_POST['content'] ?? ''),
                'when_to_use' => mb_substr(agents_post('when_to_use'), 0, 500),
                'rules'       => json_encode(agents_json_field('rules'), JSON_UNESCAPED_UNICODE),
                'examples'    => json_encode(agents_json_field('examples'), JSON_UNESCAPED_UNICODE),
                'priority'    => in_array(agents_post('priority'), AGENTS_PRIORITIES, true) ? agents_post('priority') : 'medium',
                'active'      => agents_post('active') == '0' ? 0 : 1,
                'date_update' => $now,
            ];

            if ($id > 0) {
                $current = agents_rule_get($id);
                if (!$current) agents_fail('Archivo de reglas no encontrado', 404);
                $agentId = $current['agent_id'];
            }
            if (!agents_get($agentId)) agents_fail('Agente no encontrado', 404);

            // UNIQUE(agent_id, name): se avisa antes para no devolver un error de SQL.
            $st = agents_db()->prepare('SELECT COUNT(*) FROM agent_knowledge WHERE agent_id = ? AND LOWER(name) = LOWER(?) AND id != ?');
            $st->execute([$agentId, $data['name'], $id]);
            if ((int) $st->fetchColumn() > 0) agents_fail('Este agente ya tiene un archivo con ese nombre', 409);

            if ($id > 0) {
                $set = [];
                foreach (array_keys($data) as $c) $set[] = "$c = ?";
                agents_db()->prepare('UPDATE agent_knowledge SET ' . implode(', ', $set) . ' WHERE id = ?')
                           ->execute(array_merge(array_values($data), [$id]));
            } else {
                $data['date_creation'] = $now;
                $data['agent_id']      = $agentId;
                $cols = array_keys($data);
                agents_db()->prepare('INSERT INTO agent_knowledge (' . implode(', ', $cols) . ') VALUES ('
                                   . implode(', ', array_fill(0, count($cols), '?')) . ')')
                           ->execute(array_values($data));
                $id = (int) agents_db()->lastInsertId();
            }

            agents_out(['success' => true, 'id' => $id, 'message' => 'Regla guardada']);
        }

        // Solo las activas entran al indice del prompt y las ve read_rules.
        case 'ruleStatus': {
            $id = (int) agents_post('id');
            if (!agents_rule_get($id)) agents_fail('Archivo de reglas no encontrado', 404);
            $active = agents_post('active') == '1' ? 1 : 0;
            agents_db()->prepare('UPDATE agent_knowledge SET active = ?, date_update = ? WHERE id = ?')
                       ->execute([$active, date('Y-m-d H:i:s'), $id]);
            agents_out(['success' => true, 'message' => $active ? 'Regla activada' : 'Regla deshabilitada']);
        }

        // Reescribe con quien se comparte. El contenido vive en el dueno: editarlo
        // alcanza a todos los que lo leen, no se duplica la fila.
        case 'ruleShare': {
            $id   = (int) agents_post('id');
            $rule = agents_rule_get($id);
            if (!$rule) agents_fail('Archivo de reglas no encontrado', 404);

            agents_db()->prepare('DELETE FROM agent_knowledge_share WHERE knowledge_id = ?')->execute([$id]);

            $targets = [];
            foreach (explode(',', (string) agents_post('agent_ids')) as $raw) {
                $aid = (int) trim($raw);
                if ($aid > 0 && $aid !== $rule['agent_id'] && !in_array($aid, $targets, true)) $targets[] = $aid;
            }

            $now = date('Y-m-d H:i:s');
            $ins = agents_db()->prepare('INSERT OR IGNORE INTO agent_knowledge_share (date_creation, knowledge_id, agent_id) VALUES (?, ?, ?)');
            foreach ($targets as $aid) $ins->execute([$now, $id, $aid]);

            agents_out([
                'success'     => true,
                'shared_with' => $targets,
                'message'     => empty($targets)
                    ? 'La regla dejo de compartirse'
                    : 'Compartida con ' . count($targets) . ' agente' . (count($targets) !== 1 ? 's' : ''),
            ]);
        }

        // Borrado fisico: libera el nombre (UNIQUE agent_id + name) para volver a subirlo.
        case 'ruleDelete': {
            $id = (int) agents_post('id');
            if (!agents_rule_get($id)) agents_fail('Archivo de reglas no encontrado', 404);
            agents_db()->prepare('DELETE FROM agent_knowledge WHERE id = ?')->execute([$id]);
            agents_out(['success' => true, 'message' => 'Regla borrada']);
        }

        // ── Memoria ─────────────────────────────────────────────────────────

        case 'memories': {
            $agent = agents_get((int) agents_post('id'));
            if (!$agent) agents_fail('Agente no encontrado', 404);
            agents_out([
                'success'  => true,
                'memories' => agents_memories($agent['agent_key'], agents_user_id()),
                'max'      => BRAIN_MAX_MEMORIES,
            ]);
        }

        case 'memoryAdd': {
            $agent = agents_get((int) agents_post('id'));
            if (!$agent) agents_fail('Agente no encontrado', 404);

            $res = brain_save_memory(['content' => agents_post('content')], $agent['agent_key'], agents_user_id());
            if (isset($res['error'])) agents_fail($res['error']);
            agents_out(['success' => true, 'id' => $res['id'], 'message' => 'Memoria guardada']);
        }

        case 'memoryDelete': {
            $agent = agents_get((int) agents_post('id'));
            if (!$agent) agents_fail('Agente no encontrado', 404);

            $res = brain_forget_memory(['id' => (int) agents_post('memory_id')], $agent['agent_key'], agents_user_id());
            if (isset($res['error'])) agents_fail($res['error'], 404);
            agents_out(['success' => true, 'message' => 'Memoria olvidada']);
        }

        default:
            agents_fail('Accion no reconocida: ' . $action);
    }
} catch (Throwable $e) {
    agents_fail('Error en el registro de agentes: ' . $e->getMessage(), 500);
}
