<?php
session_start();
if (empty($_POST['opc'])) exit(0);

require_once '../mdl/mdl-coffee-ia.php';
require_once '../../conf/_IaOllama.php';

// CoffeeIA desde el Administrador: modelos, esfuerzo, prompt y a qué empresas
// les llega cada asistente. Lo que aquí queda en NULL sigue al .env y al
// archivo de prompt del módulo (ver docs/sql/2026-09-30_coffee-ia.sql).
class ctrl extends mdl {

    private $thinks = ['off', 'low', 'medium', 'high'];

    // Un prompt más largo que esto ya no es un prompt: es un catálogo.
    const PROMPT_MAX = 20000;

    function init() {
        return [
            'status'       => 200,
            'statusFilter' => [
                ['id' => '1', 'valor' => 'Activos'],
                ['id' => '0', 'valor' => 'Inactivos']
            ],
            'thinks' => [
                ['id' => '',       'valor' => 'Automático'],
                ['id' => 'off',    'valor' => 'Sin razonar (off)'],
                ['id' => 'low',    'valor' => 'Bajo (low)'],
                ['id' => 'medium', 'valor' => 'Medio (medium)'],
                ['id' => 'high',   'valor' => 'Alto (high)']
            ],
            'assistants' => $this->lsAssistantsForSelect(),
            'defaults'   => IaOllama::porDefecto()
        ];
    }

    // -- Asistentes --

    function lsAssistants() {
        $row      = [];
        $defaults = IaOllama::porDefecto();
        $ls       = $this->listAssistants([(int) $_POST['active']]);

        foreach ($ls as $a) {
            $row[] = [
                'id'          => $a['id'],
                'Asistente'   => renderAssistantName($a),
                'Módulo'      => htmlspecialchars((string) $a['module']),
                'Modelo'      => renderModel($a['text_model'], $defaults['text_model']),
                'Visión'      => renderModel($a['vision_model'], $defaults['vision_model']),
                'Esfuerzo'    => renderModel($a['think'], $defaults['think'] !== '' ? $defaults['think'] : 'no se manda'),
                'Prompt'      => renderPromptSource((int) $a['custom_prompt'] === 1, $a['prompt_file']),
                'Empresas'    => renderCompaniesOff((int) $a['companies_off']),
                'Actualizado' => $a['updated'] ?: '-',
                'Estado'      => renderAssistantActive($a['is_active']),
                'a'           => $this->assistantActions($a)
            ];
        }

        return ['status' => 200, 'row' => $row, 'ls' => $ls];
    }

    function getAssistant() {
        $data = $this->getAssistantById([(int) $_POST['id']]);
        if ($data) unset($data['prompt']);

        return [
            'status'  => $data ? 200 : 404,
            'message' => $data ? 'OK' : 'El asistente no existe',
            'data'    => $data
        ];
    }

    // El code no se edita: es la llave con la que el módulo encuentra su asistente.
    function editAssistant() {
        $id = (int) $_POST['id'];
        if (!$this->getAssistantById([$id])) return ['status' => 404, 'message' => 'El asistente no existe'];

        $name = trim($_POST['name']);
        if ($name === '')             return ['status' => 400, 'message' => 'Escribe el nombre del asistente'];
        if (mb_strlen($name) > 80)    return ['status' => 400, 'message' => 'El nombre admite máximo 80 caracteres'];

        $description = trim($_POST['description']);
        if (mb_strlen($description) > 255) return ['status' => 400, 'message' => 'La descripción admite máximo 255 caracteres'];

        $textModel   = $this->model('text_model');
        $visionModel = $this->model('vision_model');
        if ($textModel === false)   return ['status' => 400, 'message' => 'El modelo de texto solo admite letras, números y . : / - _ (ej. gpt-oss:120b-cloud)'];
        if ($visionModel === false) return ['status' => 400, 'message' => 'El modelo de visión solo admite letras, números y . : / - _ (ej. kimi-k2.7-code)'];

        $ok = $this->updateAssistant([
            'values' => ['name', 'description', 'text_model', 'vision_model', 'think', 'updated_at', 'updated_by'],
            'where'  => ['id'],
            'data'   => [
                $name,
                $description === '' ? null : $description,
                $textModel,
                $visionModel,
                $this->think(),
                date('Y-m-d H:i:s'),
                $this->userId(),
                $id
            ]
        ]);

        return [
            'status'  => $ok === true ? 200 : 500,
            'message' => $ok === true ? 'Asistente actualizado. La siguiente pregunta ya usa estos ajustes.' : 'No se pudo actualizar el asistente'
        ];
    }

    // Sin prompt propio se entrega el del archivo, sin sus comentarios: es el
    // mismo texto que hoy le llega al modelo, listo para editarlo.
    function getPrompt() {
        $a = $this->getAssistantById([(int) $_POST['id']]);
        if (!$a) return ['status' => 404, 'message' => 'El asistente no existe'];

        $custom = trim((string) $a['prompt']) !== '';
        $file   = $this->promptFromFile($a['prompt_file']);

        return [
            'status' => 200,
            'data'   => [
                'id'     => $a['id'],
                'name'   => $a['name'],
                'file'   => $a['prompt_file'],
                'source' => $custom ? 'custom' : ($file !== '' ? 'file' : 'none'),
                'prompt' => $custom ? $a['prompt'] : $file
            ]
        ];
    }

    function editPrompt() {
        $id = (int) $_POST['id'];
        if (!$this->getAssistantById([$id])) return ['status' => 404, 'message' => 'El asistente no existe'];

        $prompt = trim(str_replace("\r\n", "\n", (string) $_POST['prompt']));
        if ($prompt === '')                          return ['status' => 400, 'message' => 'El prompt no puede ir vacío. Para volver al archivo usa «Volver al archivo».'];
        if (mb_strlen($prompt) > self::PROMPT_MAX)   return ['status' => 400, 'message' => 'El prompt admite máximo ' . number_format(self::PROMPT_MAX) . ' caracteres'];

        $ok = $this->updateAssistant([
            'values' => ['prompt', 'updated_at', 'updated_by'],
            'where'  => ['id'],
            'data'   => [$prompt, date('Y-m-d H:i:s'), $this->userId(), $id]
        ]);

        return [
            'status'  => $ok === true ? 200 : 500,
            'message' => $ok === true ? 'Prompt guardado. Desde ahora manda sobre el archivo.' : 'No se pudo guardar el prompt'
        ];
    }

    // NULL y no '': NULL es "sigue al archivo", y así lo que se edite en el
    // archivo vuelve a llegarle al modelo.
    function resetPrompt() {
        $id = (int) $_POST['id'];
        $a  = $this->getAssistantById([$id]);
        if (!$a) return ['status' => 404, 'message' => 'El asistente no existe'];

        $ok = $this->updateAssistant([
            'values' => ['prompt', 'updated_at', 'updated_by'],
            'where'  => ['id'],
            'data'   => [null, date('Y-m-d H:i:s'), $this->userId(), $id]
        ]);

        return [
            'status'  => $ok === true ? 200 : 500,
            'message' => $ok === true ? 'Listo. «' . $a['name'] . '» vuelve a usar el prompt del archivo.' : 'No se pudo restaurar el prompt'
        ];
    }

    // Apagado aquí, se apaga para todas las empresas: el ajuste por empresa no lo enciende.
    function statusAssistant() {
        $id     = (int) $_POST['id'];
        $active = (int) $_POST['active'] === 1 ? 1 : 0;
        if (!$this->getAssistantById([$id])) return ['status' => 404, 'message' => 'El asistente no existe'];

        $ok = $this->updateAssistant([
            'values' => ['is_active', 'updated_at', 'updated_by'],
            'where'  => ['id'],
            'data'   => [$active, date('Y-m-d H:i:s'), $this->userId(), $id]
        ]);

        if ($ok !== true) return ['status' => 500, 'message' => 'No se pudo cambiar el estado'];

        return [
            'status'  => 200,
            'message' => $active === 1 ? 'Asistente encendido' : 'Asistente apagado para todas las empresas'
        ];
    }

    // -- Empresas --

    function lsCompanyAccess() {
        $row         = [];
        $assistantId = (int) $_POST['assistants_id'];
        $assistant   = $this->getAssistantById([$assistantId]);

        if (!$assistant) return ['status' => 200, 'row' => [], 'ls' => []];

        $globalOff = (int) $assistant['is_active'] !== 1;
        $ls        = $this->listCompanyAccess([$assistantId]);

        foreach ($ls as $c) {
            $row[] = [
                'id'          => $c['id'],
                'Empresa'     => htmlspecialchars($c['name']),
                'CoffeeIA'    => renderCompanyAccess((int) $c['is_active'] === 1, $globalOff),
                'Cambió'      => $c['updated_by'] !== '' ? htmlspecialchars($c['updated_by']) : '-',
                'Actualizado' => $c['updated'] ?: '-',
                'a'           => $this->companyActions($c, $assistantId)
            ];
        }

        return ['status' => 200, 'row' => $row, 'ls' => $ls];
    }

    function statusCompanyAccess() {
        $companyId   = (int) $_POST['companies_id'];
        $assistantId = (int) $_POST['assistants_id'];
        $active      = (int) $_POST['active'] === 1 ? 1 : 0;

        if (!$this->existsCompanyById([$companyId]))     return ['status' => 404, 'message' => 'La empresa no existe'];
        if (!$this->getAssistantById([$assistantId]))    return ['status' => 404, 'message' => 'El asistente no existe'];

        $ok = $this->upsertCompanyAccess([$companyId, $assistantId, $active, date('Y-m-d H:i:s'), $this->userId()]);

        return [
            'status'  => $ok === true ? 200 : 500,
            'message' => $ok === true
                ? ($active === 1 ? 'CoffeeIA encendido para la empresa' : 'CoffeeIA apagado para la empresa')
                : 'No se pudo cambiar el acceso'
        ];
    }

    // -- Auxiliares --

    private function userId() {
        return (int) ($_SESSION['IDU'] ?? 0) ?: null;
    }

    // null = por defecto; false = no es un nombre de modelo válido.
    private function model($field) {
        $m = trim((string) $_POST[$field]);
        if ($m === '') return null;

        return preg_match('/^[A-Za-z0-9][A-Za-z0-9._:\/-]{0,79}$/', $m) ? $m : false;
    }

    private function think() {
        $t = strtolower(trim((string) $_POST['think']));
        return in_array($t, $this->thinks, true) ? $t : null;
    }

    // prompt_file viene de la BD, pero igual se exige que sea un .md dentro de inventory/.
    private function promptFromFile($relative) {
        $relative = trim((string) $relative);
        if ($relative === '' || strtolower(pathinfo($relative, PATHINFO_EXTENSION)) !== 'md') return '';

        $base = realpath(__DIR__ . '/../../');
        $file = realpath(__DIR__ . '/../../' . $relative);

        if ($base === false || $file === false || strpos($file, $base . DIRECTORY_SEPARATOR) !== 0 || !is_readable($file)) return '';

        $text = preg_replace('/<!--.*?-->/s', '', (string) file_get_contents($file));

        return trim(preg_replace("/\n{3,}/", "\n\n", str_replace("\r\n", "\n", $text)));
    }

    private function actionBtnClass($variant, $last = false) {
        $base = $variant === 'danger'
            ? 'inline-flex items-center px-2 py-1 text-sm rounded-md border border-red-200 text-red-500 hover:bg-red-50 hover:text-red-600 transition'
            : 'inline-flex items-center px-2 py-1 text-sm rounded-md border border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition';

        return $last ? $base : $base . ' me-1';
    }

    private function assistantActions($a) {
        $id       = (int) $a['id'];
        $isActive = (int) $a['is_active'] === 1;
        $actions  = [];

        $actions[] = [
            'class'   => $this->actionBtnClass('neutral'),
            'html'    => '<i class="icon-cog" title="Modelos"></i>',
            'onclick' => "assistants.editAssistant({$id})"
        ];

        $actions[] = [
            'class'   => $this->actionBtnClass('neutral'),
            'html'    => '<i class="icon-doc-text" title="Prompt"></i>',
            'onclick' => "assistants.editPrompt({$id})"
        ];

        if ((int) $a['custom_prompt'] === 1) {
            $actions[] = [
                'class'   => $this->actionBtnClass('neutral'),
                'html'    => '<i class="icon-cancel-circled" title="Volver al archivo"></i>',
                'onclick' => "assistants.resetPrompt({$id})"
            ];
        }

        $actions[] = [
            'class'   => $this->actionBtnClass($isActive ? 'danger' : 'neutral', true),
            'html'    => $isActive ? '<i class="icon-toggle-on"></i>' : '<i class="icon-toggle-off"></i>',
            'onclick' => 'assistants.statusAssistant(' . $id . ', ' . ($isActive ? 0 : 1) . ')'
        ];

        return $actions;
    }

    private function companyActions($c, $assistantId) {
        $id       = (int) $c['id'];
        $isActive = (int) $c['is_active'] === 1;

        return [[
            'class'   => $this->actionBtnClass($isActive ? 'danger' : 'neutral', true),
            'html'    => $isActive ? '<i class="icon-toggle-on"></i>' : '<i class="icon-toggle-off"></i>',
            'onclick' => 'assistantCompanies.statusCompanyAccess(' . $id . ', ' . $assistantId . ', ' . ($isActive ? 0 : 1) . ')'
        ]];
    }
}

// Complements

function renderAssistantName($a) {
    $description = trim((string) $a['description']) !== ''
        ? '<span class="block text-xs text-gray-500 max-w-[320px] whitespace-normal">' . htmlspecialchars($a['description']) . '</span>'
        : '';

    return '<div class="flex flex-col">'
        . '<span class="font-semibold text-gray-900">' . htmlspecialchars($a['name']) . '</span>'
        . '<span class="text-[11px] text-gray-400">' . htmlspecialchars($a['code']) . '</span>'
        . $description
        . '</div>';
}

// Lo fijado en el tenant va en negro; lo que se hereda, en gris y con su origen.
function renderModel($value, $default) {
    $value = trim((string) $value);
    if ($value !== '') return '<span class="font-semibold text-gray-900">' . htmlspecialchars($value) . '</span>';

    return '<span class="text-gray-400">Por defecto · ' . htmlspecialchars((string) $default) . '</span>';
}

function renderPromptSource($custom, $file) {
    if ($custom) return '<span class="px-2 py-1 rounded-md text-sm font-semibold bg-blue-50 text-blue-700">Personalizado</span>';

    return trim((string) $file) !== ''
        ? '<span class="px-2 py-1 rounded-md text-sm font-semibold bg-gray-100 text-gray-600" title="' . htmlspecialchars($file) . '">Archivo</span>'
        : '<span class="px-2 py-1 rounded-md text-sm font-semibold bg-amber-50 text-amber-700">Sin prompt</span>';
}

function renderCompaniesOff($off) {
    if ($off === 0) return '<span class="text-gray-600">Todas</span>';

    return '<span class="px-2 py-1 rounded-md text-sm font-semibold bg-amber-50 text-amber-700">'
        . ($off === 1 ? '1 apagada' : $off . ' apagadas')
        . '</span>';
}

function renderAssistantActive($status) {
    return (int) $status === 1
        ? '<span class="px-2 py-1 rounded-md text-sm font-semibold bg-emerald-50 text-emerald-700">Activo</span>'
        : '<span class="px-2 py-1 rounded-md text-sm font-semibold bg-red-50 text-red-700">Inactivo</span>';
}

// Si el asistente está apagado arriba, la empresa no lo ve aunque aquí diga encendido.
function renderCompanyAccess($active, $globalOff) {
    if (!$active) return '<span class="px-2 py-1 rounded-md text-sm font-semibold bg-red-50 text-red-700">Apagado</span>';

    return $globalOff
        ? '<span class="px-2 py-1 rounded-md text-sm font-semibold bg-amber-50 text-amber-700" title="El asistente está apagado para todas">Encendido · asistente apagado</span>'
        : '<span class="px-2 py-1 rounded-md text-sm font-semibold bg-emerald-50 text-emerald-700">Encendido</span>';
}

if (empty($_SESSION['IDU'])) {
    echo json_encode(['status' => 401, 'message' => 'Tu sesión terminó. Vuelve a entrar.']);
    exit(0);
}

$obj = new ctrl();
$opc = $_POST['opc'];
if (!method_exists($obj, $opc) || !is_callable([$obj, $opc])) {
    echo json_encode(['status' => 405, 'message' => "opc '{$opc}' no implementado"]);
    exit(0);
}
echo json_encode($obj->{$opc}());
