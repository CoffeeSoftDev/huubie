<?php
require_once __DIR__ . '/../../conf/_Session.php';
if (empty($_POST['opc'])) exit(0);

require_once '../mdl/mdl-coffeeia.php';

// Configuración básica de coffeeIA para los chats de inventory: encendido o
// apagado (el ícono del Catálogo), tono, modelo de razonamiento, esfuerzo y modelo
// para imagen. Es global (una fila) y manda sobre el .env; lo que se deja en
// "Predeterminado" sigue saliendo del .env.
class ctrl extends mdl {

    const CONFIG_ID = 1;
    const MAX_TONO  = 500;

    // 'auto' = no guardar nada (NULL) y dejar que mande el .env. No es '' porque
    // el formulario trata un select vacío como campo sin llenar.
    const AUTO = 'auto';

    /*  Las listas son las de erp-pro, medidas contra Ollama Cloud: elegir modelo
        a ciegas es elegir por el nombre, y el nombre no dice si tarda medio
        segundo o nueve. Razonamiento: pro/app/dev/ctrl/ctrl-souls.php (04/09 y
        14/09/2026) + gpt-oss:120b-cloud medido aquí el 23/09/2026 con el catálogo
        real. Imagen: mirarImagen() de pro/auth/ctrl/ctrl-coffeeia.php; glm-5.2
        y minimax-m2.7 NO ven (contestan 400), por eso no están. */
    const MODELOS = [
        ['id' => 'gpt-oss:120b-cloud',        'nombre' => 'gpt-oss 120B',        'nota' => '1,2 s · casi no razona; el más rápido'],
        ['id' => 'deepseek-v4.1-flash:cloud', 'nombre' => 'DeepSeek V4.1 Flash', 'nota' => '0,8 s · razona poco'],
        ['id' => 'glm-5.3',                   'nombre' => 'GLM 5.3',             'nota' => '1,7 s · razona bastante'],
        ['id' => 'glm-5.3-flash',             'nombre' => 'GLM 5.3 Flash',       'nota' => '2,8 s'],
        ['id' => 'glm-5.2:cloud',             'nombre' => 'GLM 5.2',             'nota' => '5,7 s'],
        ['id' => 'deepseek-v4-pro:cloud',     'nombre' => 'DeepSeek V4 Pro',     'nota' => '6,5 s · razona mucho'],
        ['id' => 'qwen3.5:cloud',             'nombre' => 'Qwen 3.5',            'nota' => '9,4 s · el que más razona']
    ];

    const ESFUERZOS = [
        ['id' => 'off',    'nombre' => 'Sin razonar', 'nota' => 'el más rápido, y el que más se equivoca'],
        ['id' => 'low',    'nombre' => 'Poco',        'nota' => 'el que usa hoy'],
        ['id' => 'medium', 'nombre' => 'Normal',      'nota' => ''],
        ['id' => 'high',   'nombre' => 'Bastante',    'nota' => 'más lento']
    ];

    const VISIONES = [
        ['id' => 'kimi-k2.7-code', 'nombre' => 'Kimi K2.7', 'nota' => '1,8 s'],
        ['id' => 'gemma4:31b',     'nombre' => 'Gemma 4',   'nota' => '1,5 s'],
        ['id' => 'kimi-k3',        'nombre' => 'Kimi K3',   'nota' => '3,9 s'],
        ['id' => 'kimi-k2.6',      'nombre' => 'Kimi K2.6', 'nota' => '6,3 s']
    ];

    function init() {
        return [
            'status'    => 200,
            'modelos'   => $this->toSelect(self::MODELOS),
            'esfuerzos' => $this->toSelect(self::ESFUERZOS),
            'visiones'  => $this->toSelect(self::VISIONES)
        ];
    }

    function lsCoffeeIAConfig() {
        $c = $this->getCoffeeIAConfig([self::CONFIG_ID]);

        if (!$c) return ['status' => 200, 'row' => [], 'message' => 'Falta correr las migraciones 2026-09-30_coffeeia-config.sql y 2026-10-06_coffeeia-activo.sql'];

        $row = [
            ['Ajuste' => 'Estado',                  'Valor' => renderActive($c['active']),                                 'Para qué sirve' => 'Encendido: el ícono de coffeeIA sale abajo en el menú lateral del Catálogo. Apagado: no sale y el chat no contesta.'],
            ['Ajuste' => 'Tono',                    'Valor' => renderTone($c['tone']),                                     'Para qué sirve' => 'Cómo redacta lo que te contesta. Se suma a las instrucciones de cada chat.'],
            ['Ajuste' => 'Modelo para razonamiento', 'Valor' => renderChoice($c['model'], self::MODELOS),                  'Para qué sirve' => 'El que entiende lo que pides, lo cruza con el catálogo y contesta.'],
            ['Ajuste' => 'Esfuerzo',                'Valor' => renderChoice($c['effort'], self::ESFUERZOS),                'Para qué sirve' => 'Cuánto piensa antes de contestar. Más esfuerzo, más lento.'],
            ['Ajuste' => 'Modelo para imagen',      'Valor' => renderChoice($c['vision_model'], self::VISIONES),           'Para qué sirve' => 'El que lee las fotos y los tickets y los pasa a texto.']
        ];

        foreach ($row as $i => $r) $row[$i] = ['id' => $i + 1] + $r;

        return ['status' => 200, 'row' => $row];
    }

    function getCoffeeIA() {
        $c = $this->getCoffeeIAConfig([self::CONFIG_ID]);

        if (!$c) return ['status' => 404, 'message' => 'Falta correr las migraciones 2026-09-30_coffeeia-config.sql y 2026-10-06_coffeeia-activo.sql'];

        return [
            'status' => 200,
            'data'   => [
                'active'       => (int) $c['active'] === 1 ? '1' : '0',
                'tone'         => (string) $c['tone'],
                'model'        => $c['model']        ?: self::AUTO,
                'effort'       => $c['effort']       ?: self::AUTO,
                'vision_model' => $c['vision_model'] ?: self::AUTO
            ]
        ];
    }

    function editCoffeeIA() {
        if (!$this->getCoffeeIAConfig([self::CONFIG_ID])) {
            return ['status' => 404, 'message' => 'Falta correr las migraciones 2026-09-30_coffeeia-config.sql y 2026-10-06_coffeeia-activo.sql'];
        }

        $tone = trim(preg_replace('/\s+/u', ' ', (string) $_POST['tone']));

        if (mb_strlen($tone) > self::MAX_TONO) return ['status' => 400, 'message' => 'El tono admite hasta ' . self::MAX_TONO . ' caracteres.'];

        $model  = $this->choice('model', self::MODELOS);
        $effort = $this->choice('effort', self::ESFUERZOS);
        $vision = $this->choice('vision_model', self::VISIONES);

        if ($model === false)  return ['status' => 400, 'message' => 'Ese modelo no está en la lista.'];
        if ($effort === false) return ['status' => 400, 'message' => 'Ese nivel de esfuerzo no está en la lista.'];
        if ($vision === false) return ['status' => 400, 'message' => 'Ese modelo para imagen no está en la lista.'];

        $active = ($_POST['active'] ?? '1') === '0' ? 0 : 1;

        // Sin util->sql(): los NULL son a propósito (NULL = manda el .env).
        $ok = $this->updateCoffeeIAConfig([
            'values' => ['active', 'tone', 'model', 'effort', 'vision_model', 'updated_at'],
            'where'  => ['id'],
            'data'   => [$active, $tone === '' ? null : $tone, $model, $effort, $vision, date('Y-m-d H:i:s'), self::CONFIG_ID]
        ]);

        return [
            'status'  => $ok === true ? 200 : 500,
            'message' => $ok === true ? 'Listo: la próxima pregunta a coffeeIA ya usa esta configuración.' : 'No se pudo guardar la configuración'
        ];
    }

    // -- Complementos --

    // null = Predeterminado; false = valor que no está en la lista.
    private function choice($key, $list) {
        $v = trim((string) ($_POST[$key] ?? ''));

        if ($v === '' || $v === self::AUTO) return null;

        return in_array($v, array_column($list, 'id'), true) ? $v : false;
    }

    private function toSelect($list) {
        $out = [['id' => self::AUTO, 'valor' => 'Predeterminado']];

        foreach ($list as $x) {
            $out[] = ['id' => $x['id'], 'valor' => $x['nombre'] . ($x['nota'] !== '' ? ' · ' . $x['nota'] : '')];
        }

        return $out;
    }
}

// Complements

function renderActive($active) {
    return (int) $active === 1
        ? '<span class="px-2 py-1 rounded-md text-sm font-semibold bg-green-100 text-green-700">Encendido</span>'
        : '<span class="px-2 py-1 rounded-md text-sm font-semibold bg-red-100 text-red-700">Apagado</span>';
}

function renderTone($tone) {
    $tone = trim((string) $tone);

    return $tone === ''
        ? '<span class="text-gray-400">Sin tono propio</span>'
        : '<span class="text-gray-800">' . htmlspecialchars($tone) . '</span>';
}

function renderChoice($value, $list) {
    $value = trim((string) $value);

    if ($value === '') return '<span class="px-2 py-1 rounded-md text-sm font-semibold bg-gray-100 text-gray-600">Predeterminado</span>';

    foreach ($list as $x) {
        if ($x['id'] === $value) {
            return '<span class="font-semibold text-gray-900">' . htmlspecialchars($x['nombre']) . '</span>'
                . ($x['nota'] !== '' ? ' <span class="text-xs text-gray-400">' . htmlspecialchars($x['nota']) . '</span>' : '');
        }
    }

    return '<span class="text-gray-800">' . htmlspecialchars($value) . '</span>';
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
