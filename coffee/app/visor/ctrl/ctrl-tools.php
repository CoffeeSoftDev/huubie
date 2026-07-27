<?php
/**
 * ABC de las HERRAMIENTAS del chat (CoffeeIA) sobre data/tools.sqlite.
 *
 * Gemelo del admin de modelos, pero server-side: el catalogo tiene que vivir en el
 * servidor porque quien EJECUTA las tools es PHP (tools-registry.php), no el navegador.
 *
 * Acciones (`action` por POST o GET):
 *   list   -> catalogo completo (builtin + creadas por el usuario) con params y uso 24h
 *   get    -> una herramienta por id
 *   save   -> alta/edicion. Las builtin solo aceptan cambios de apariencia
 *   status -> activa/desactiva (es el "elegir que tools usa el agente")
 *   delete -> elimina una herramienta HTTP (las builtin no se borran)
 *   test   -> ejecuta la herramienta con argumentos de prueba y devuelve el resultado
 */

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

require_once __DIR__ . '/tools-registry.php';

function tools_out($data) {
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_INVALID_UTF8_SUBSTITUTE);
    exit;
}
function tools_fail($msg, $code = 400) {
    http_response_code($code);
    tools_out(['success' => false, 'message' => $msg]);
}

/** Arma la spec (formato OpenAI) desde los campos del formulario. */
function tools_build_schema($name, $description, array $params) {
    $props    = [];
    $required = [];
    foreach ($params as $p) {
        $pname = trim((string) ($p['name'] ?? ''));
        if ($pname === '') continue;
        $props[$pname] = [
            'type'        => (string) ($p['type'] ?? 'string'),
            'description' => (string) ($p['description'] ?? ''),
        ];
        if (!empty($p['required'])) $required[] = $pname;
    }
    return json_encode([
        'type'     => 'function',
        'function' => [
            'name'        => $name,
            'description' => $description,
            'parameters'  => [
                'type'       => 'object',
                'properties' => (object) $props,
                'required'   => $required,
            ],
        ],
    ], JSON_UNESCAPED_UNICODE);
}

$action = $_POST['action'] ?? $_GET['action'] ?? '';

// Los payloads con estructura (params, headers, args) llegan como JSON en un campo.
$jsonField = function ($key) {
    $raw = $_POST[$key] ?? $_GET[$key] ?? '';
    if (is_array($raw)) return $raw;
    $v = json_decode((string) $raw, true);
    return is_array($v) ? $v : [];
};

try {
    switch ($action) {

        case 'list': {
            tools_out([
                'success'   => true,
                'tools'     => tools_all(),
                // Destinos posibles: el UI los pinta sin tener que duplicar el catalogo.
                'surfaces'  => tools_surfaces_catalog(),
                'agents'    => tools_agents_catalog(),
            ]);
        }

        // Asignacion rapida desde la tarjeta (sin abrir el editor).
        case 'assign': {
            $id   = (int) ($_POST['id'] ?? 0);
            $tool = tools_get($id);
            if (!$tool) tools_fail('Herramienta no encontrada', 404);

            $surfaces = tools_clean_scope($_POST['surfaces'] ?? '', tools_surfaces_catalog());
            $agents   = tools_clean_scope($_POST['agents']   ?? '', tools_agents_catalog());
            $st = tools_db()->prepare('UPDATE tools SET surfaces = ?, agents = ?, date_update = ? WHERE id = ?');
            $st->execute([$surfaces, $agents, date('Y-m-d H:i:s'), $id]);
            tools_out(['success' => true, 'id' => $id, 'tool' => tools_get($id)]);
        }

        case 'get': {
            $tool = tools_get($_POST['id'] ?? $_GET['id'] ?? 0);
            if (!$tool) tools_fail('Herramienta no encontrada', 404);
            tools_out(['success' => true, 'tool' => $tool]);
        }

        case 'save': {
            $id          = (int) ($_POST['id'] ?? 0);
            $name        = strtolower(trim((string) ($_POST['name'] ?? '')));
            $label       = trim((string) ($_POST['label'] ?? ''));
            $description = trim((string) ($_POST['description'] ?? ''));
            $category    = trim((string) ($_POST['category'] ?? ''));
            $icon        = trim((string) ($_POST['icon'] ?? 'wrench')) ?: 'wrench';
            $method      = strtoupper(trim((string) ($_POST['method'] ?? 'GET')));
            $endpoint    = trim((string) ($_POST['endpoint'] ?? ''));
            $params      = $jsonField('params');
            $headers     = $jsonField('headers');
            // Asignacion: en que chats y a que agentes se declara. Vacio = a todos.
            $surfaces    = tools_clean_scope($_POST['surfaces'] ?? '', tools_surfaces_catalog());
            $agents      = tools_clean_scope($_POST['agents']   ?? '', tools_agents_catalog());
            $now         = date('Y-m-d H:i:s');
            $pdo         = tools_db();

            if ($label === '') tools_fail('El nombre visible es obligatorio');

            // Edicion de una builtin: apariencia y asignacion (su schema lo manda el codigo).
            $current = $id ? tools_get($id) : null;
            if ($current && $current['type'] === 'builtin') {
                $st = $pdo->prepare('UPDATE tools SET label = ?, description = ?, category = ?, icon = ?, surfaces = ?, agents = ?, date_update = ? WHERE id = ?');
                $st->execute([$label, $description, $category, $icon, $surfaces, $agents, $now, $id]);
                tools_out(['success' => true, 'id' => $id, 'tool' => tools_get($id)]);
            }

            // Herramienta HTTP (alta o edicion).
            if (!preg_match('/^[a-z][a-z0-9_]*$/', $name)) {
                tools_fail('El nombre tecnico debe ser snake_case (ej. get_weather)');
            }
            foreach (tools_builtin_catalog() as $b) {
                if ($b['name'] === $name) tools_fail('Ese nombre lo usa una herramienta base: elige otro');
            }
            if ($endpoint === '' || !preg_match('#^https?://#i', $endpoint)) {
                tools_fail('El endpoint es obligatorio y debe empezar con http:// o https://');
            }
            if (!in_array($method, ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], true)) $method = 'GET';

            $seen = [];
            foreach ($params as $p) {
                $pname = trim((string) ($p['name'] ?? ''));
                if ($pname === '') continue;
                if (!preg_match('/^[a-z][a-z0-9_]*$/', $pname)) tools_fail('Los parametros deben ser snake_case: ' . $pname);
                if (isset($seen[$pname])) tools_fail('Hay parametros repetidos: ' . $pname);
                $seen[$pname] = true;
            }

            // El nombre tecnico es UNIQUE: verificamos antes para dar un mensaje claro.
            $st = $pdo->prepare('SELECT id FROM tools WHERE name = ? AND id <> ?');
            $st->execute([$name, $id]);
            if ($st->fetch()) tools_fail('Ya existe una herramienta con el nombre ' . $name);

            $schema = tools_build_schema($name, $description, $params);
            $hdrs   = json_encode(array_values(array_filter($headers, function ($h) {
                return trim((string) ($h['key'] ?? '')) !== '';
            })), JSON_UNESCAPED_UNICODE);

            if ($id && $current) {
                $st = $pdo->prepare('
                    UPDATE tools SET name = ?, label = ?, description = ?, category = ?, icon = ?,
                                     method = ?, endpoint = ?, headers = ?, schema_json = ?,
                                     surfaces = ?, agents = ?, date_update = ?
                    WHERE id = ?
                ');
                $st->execute([$name, $label, $description, $category, $icon, $method, $endpoint, $hdrs, $schema, $surfaces, $agents, $now, $id]);
            } else {
                $st = $pdo->prepare('
                    INSERT INTO tools (name, label, description, category, icon, type, source, method, endpoint, headers, schema_json, surfaces, agents, active, date_creation, date_update)
                    VALUES (?, ?, ?, ?, ?, "http", "http", ?, ?, ?, ?, ?, ?, 1, ?, ?)
                ');
                $st->execute([$name, $label, $description, $category, $icon, $method, $endpoint, $hdrs, $schema, $surfaces, $agents, $now, $now]);
                $id = (int) $pdo->lastInsertId();
            }
            tools_out(['success' => true, 'id' => $id, 'tool' => tools_get($id)]);
        }

        case 'status': {
            $id     = (int) ($_POST['id'] ?? 0);
            $active = !empty($_POST['active']) && $_POST['active'] !== '0' ? 1 : 0;
            $tool   = tools_get($id);
            if (!$tool) tools_fail('Herramienta no encontrada', 404);

            $st = tools_db()->prepare('UPDATE tools SET active = ?, date_update = ? WHERE id = ?');
            $st->execute([$active, date('Y-m-d H:i:s'), $id]);
            tools_out(['success' => true, 'id' => $id, 'active' => $active]);
        }

        case 'delete': {
            $id   = (int) ($_POST['id'] ?? 0);
            $tool = tools_get($id);
            if (!$tool) tools_fail('Herramienta no encontrada', 404);
            if ($tool['type'] === 'builtin') tools_fail('Las herramientas base no se eliminan: desactivalas');

            tools_db()->prepare('DELETE FROM tools WHERE id = ?')->execute([$id]);
            tools_out(['success' => true, 'id' => $id]);
        }

        // Prueba manual desde el editor: ejecuta la tool tal cual la ejecutaria el modelo.
        case 'test': {
            $id   = (int) ($_POST['id'] ?? 0);
            $args = $jsonField('args');

            if ($id) {
                $tool = tools_get($id);
                if (!$tool) tools_fail('Herramienta no encontrada', 404);
                if ($tool['type'] === 'builtin') tools_fail('Las herramientas base se prueban desde el chat');
                $row = $tool;
            } else {
                // Alta sin guardar: se arma una fila temporal con lo que hay en el formulario.
                $name = strtolower(trim((string) ($_POST['name'] ?? 'prueba')));
                $row = [
                    'name'        => $name !== '' ? $name : 'prueba',
                    'label'       => trim((string) ($_POST['label'] ?? '')),
                    'type'        => 'http',
                    'method'      => strtoupper(trim((string) ($_POST['method'] ?? 'GET'))),
                    'endpoint'    => trim((string) ($_POST['endpoint'] ?? '')),
                    'headers'     => json_encode($jsonField('headers'), JSON_UNESCAPED_UNICODE),
                    'schema_json' => tools_build_schema($name !== '' ? $name : 'prueba', '', $jsonField('params')),
                ];
            }

            $t0     = microtime(true);
            $result = tools_run_http($row, $args);
            $parsed = json_decode($result, true);
            tools_out([
                'success'    => is_array($parsed) && !isset($parsed['error']),
                'message'    => is_array($parsed) && isset($parsed['error']) ? $parsed['error'] : 'Respuesta recibida',
                'elapsed_ms' => (int) round((microtime(true) - $t0) * 1000),
                'result'     => $result,
            ]);
        }

        default:
            tools_fail('Accion no reconocida: ' . $action);
    }
} catch (Throwable $e) {
    tools_fail('Error en el catalogo de herramientas: ' . $e->getMessage(), 500);
}
