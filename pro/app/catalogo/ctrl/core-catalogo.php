<?php
require_once __DIR__ . '/../../../core/security/_Session.php';
require_once __DIR__ . '/../../../core/security/_Permission.php';
require_once __DIR__ . '/../mdl/mdl-catalogo.php';

/*  Base de los ctrl del Catalogo: una pestaña = un ctrl que extiende esta clase.

    Permission::dispatch solo ejecuta los metodos declarados en la clase ctrl de
    cada archivo. Por eso aqui todo es protected y las operaciones (ls*, get*,
    add*, edit*, status*) se escriben publicas en cada ctrl.

    Ojo: dispatch valida la seccion 'catalogo', no cada accion. Quien entra a la
    seccion puede hacer todas las operaciones. */
class core extends mdl {

    private $scopeCache = null;
    private $mainCache  = null;

    // -- Empresa y sucursal --

    /*  root entra sin empresa ni sucursal (0): trabaja con la primera empresa y
        su primera sucursal activa. La sucursal de la sesion solo cuenta si es de
        esa empresa y sigue activa. */
    protected function scope() {
        if ($this->scopeCache !== null) return $this->scopeCache;

        $sessionCompany = isset($_SESSION['company_id']) ? (int) $_SESSION['company_id'] : 0;
        $sessionBranch  = isset($_SESSION['branch_id'])  ? (int) $_SESSION['branch_id']  : 0;

        $company   = $sessionCompany > 0 ? $this->qCompany($sessionCompany) : $this->qFirstCompany();
        $companyId = $company ? (int) $company['id'] : 0;
        $branch    = null;

        if ($companyId > 0 && $sessionBranch > 0) {
            $candidate = $this->qBranch($sessionBranch);

            if ($candidate && (int) $candidate['company_id'] === $companyId) $branch = $candidate;
        }

        if ($branch === null && $companyId > 0) $branch = $this->qFirstBranch($companyId);

        $this->scopeCache = [
            'company_id' => $companyId,
            'company'    => $company ? $company['name'] : '',
            'branch_id'  => $branch ? (int) $branch['id'] : 0,
            'branch'     => $branch ? $branch['name'] : ''
        ];

        return $this->scopeCache;
    }

    protected function companyId() {
        return $this->scope()['company_id'];
    }

    protected function branchId() {
        return $this->scope()['branch_id'];
    }

    /*  Matriz = la primera sucursal activa de la empresa (decision F, 13/11/2026).
        Es convencion, la base no la marca. Igual que mainBranchId() de Pedidos:
        sus productos los venden todas las sucursales que no tengan uno propio
        con el mismo nombre. */
    protected function mainBranch() {
        if ($this->mainCache === null) {
            $this->mainCache = $this->companyId() > 0 ? ($this->qFirstBranch($this->companyId()) ?: []) : [];
        }

        return $this->mainCache;
    }

    protected function mainBranchId() {
        return isset($this->mainBranch()['id']) ? (int) $this->mainBranch()['id'] : 0;
    }

    protected function isMainBranch() {
        return $this->branchId() > 0 && $this->branchId() === $this->mainBranchId();
    }

    // Llevan 'row' para que una tabla pinte vacio en vez de quedarse cargando.
    protected function needCompany() {
        if ($this->companyId() > 0) return null;

        return ['status' => 409, 'message' => 'No hay una empresa activa para el catálogo.', 'row' => []];
    }

    protected function needBranch() {
        $fail = $this->needCompany();
        if ($fail) return $fail;

        if ($this->branchId() > 0) return null;

        return ['status' => 409, 'message' => 'La empresa no tiene una sucursal activa.', 'row' => []];
    }

    // -- Plantillas (company_id NULL) --

    protected function isTemplate($row) {
        return $row && $row['company_id'] === null;
    }

    protected function lockedTemplate() {
        return $this->fail(409, 'Es una plantilla de Huubie: la ven todas las empresas y no se edita.');
    }

    // -- Respuestas --

    protected function ok($message, $extra = []) {
        return array_merge(['status' => 200, 'message' => $message], $extra);
    }

    protected function fail($status, $message) {
        return ['status' => $status, 'message' => $message];
    }

    // $what completa la frase: 'una categoría con ese nombre'.
    protected function duplicated($row, $what) {
        $hint = (int) $row['active'] === 0 ? ' Está en el filtro «Inactivos».' : '';

        return $this->fail(409, "Ya existe {$what}.{$hint}");
    }

    // dispatch no atrapa excepciones: sin esto el cliente recibiria un 500 vacio.
    protected function attempt(callable $fn, $message) {
        try {
            return $fn();
        } catch (Throwable $e) {
            $this->writeToLog('[ CATALOGO ] :: ' . $e->getMessage());

            return $this->fail(500, $message);
        }
    }

    // _Insert, _Update y _CUD avisan con un string o false; aqui se vuelve excepcion.
    protected function must($result, $what) {
        if ($result !== true) {
            throw new RuntimeException($what . ': ' . (is_string($result) ? $result : 'sin respuesta de la base'));
        }

        return true;
    }

    // -- Lectura del POST --

    protected function post($key, $default = '') {
        return isset($_POST[$key]) ? trim((string) $_POST[$key]) : $default;
    }

    protected function postId($key = 'id') {
        return (int) $this->post($key, '0');
    }

    protected function flag($key) {
        return in_array(strtolower($this->post($key)), ['1', 'true', 'on'], true) ? 1 : 0;
    }

    protected function activeFilter() {
        return $this->post('active', '1') === '0' ? 0 : 1;
    }

    protected function textOrNull($key) {
        $value = $this->post($key);

        return $value === '' ? null : $value;
    }

    protected function tooLong($value, $max) {
        return $value !== null && mb_strlen($value, 'UTF-8') > $max;
    }

    // Monto >= 0. Vacio = $default. Invalido o negativo = null.
    protected function amount($key, $default = 0, $decimals = 2) {
        $raw = str_replace(['$', ',', ' '], '', $this->post($key));

        if ($raw === '') return $default;
        if (!preg_match('/^(\d+(\.\d*)?|\.\d+)$/', $raw)) return null;

        return round((float) $raw, $decimals);
    }

    // De 0 a 100. Invalido o mayor a 100 = null.
    protected function percent($key, $default = 0) {
        $value = $this->amount($key, $default);

        return ($value === null || $value > 100) ? null : $value;
    }

    // 'Cortesía Mesa' -> 'CORTESIA_MESA'. Vacio = null.
    protected function code($key) {
        $value = mb_strtoupper($this->post($key), 'UTF-8');
        $value = strtr($value, ['Á' => 'A', 'É' => 'E', 'Í' => 'I', 'Ó' => 'O', 'Ú' => 'U', 'Ü' => 'U', 'Ñ' => 'N']);
        $value = preg_replace('/\s+/', '_', $value);
        $value = preg_replace('/[^A-Z0-9_]/', '', $value);

        return $value === '' ? null : $value;
    }

    protected function intOrNull($key) {
        $value = $this->post($key);

        return preg_match('/^-?\d+$/', $value) ? (int) $value : null;
    }

    // Un select sin eleccion llega como '' o '0'.
    protected function selectOrNull($key) {
        $value = $this->post($key);

        return ($value === '' || $value === '0') ? null : (int) $value;
    }

    // Arreglo mandado como JSON. Lo que no sea arreglo = null.
    protected function postedJson($key) {
        $value = json_decode($this->post($key), true);

        return is_array($value) ? $value : null;
    }

    // -- Catalogos fijos --

    protected function statusFilter() {
        return [
            ['id' => '1', 'valor' => 'Activos'],
            ['id' => '0', 'valor' => 'Inactivos']
        ];
    }

    protected function paymentKinds() {
        return [
            ['id' => 'efectivo',      'valor' => 'Efectivo'],
            ['id' => 'tarjeta',       'valor' => 'Tarjeta'],
            ['id' => 'transferencia', 'valor' => 'Transferencia'],
            ['id' => 'vales',         'valor' => 'Vales'],
            ['id' => 'puntos',        'valor' => 'Puntos']
        ];
    }

    // -- Validaciones compartidas --

    // null si la categoría sirve; si no, la respuesta de error. $keepId: la que ya tenía (se acepta inactiva).
    protected function categoryProblem($categoryId, $keepId = 0) {
        if ($categoryId === null) return null;

        $category = $this->qGetCategory($categoryId, $this->branchId());

        if (!$category) return $this->fail(400, 'La categoría elegida no existe.');

        if ((int) $category['active'] === 0 && (int) $category['id'] !== (int) $keepId) {
            return $this->fail(409, 'La categoría elegida está inactiva. Actívala o elige otra.');
        }

        return null;
    }

    // Productos, servicios y paquetes no repiten nombre en la sucursal. $tab: 'products' o 'bundles', la pestaña que pregunta.
    protected function nameTaken($dup, $tab) {
        $what  = $dup['kind'] === 'bundle' ? 'un paquete' : ($dup['kind'] === 'service' ? 'un servicio' : 'un producto');
        $owner = $dup['kind'] === 'bundle' ? 'bundles' : 'products';
        $what .= ' con ese nombre';

        if ($owner !== $tab) $what .= $owner === 'bundles' ? ' en la pestaña Paquetes' : ' en la pestaña Productos';

        return $this->duplicated($dup, $what);
    }

    // -- Acciones de la fila --

    protected function actionBtnClass($variant, $last = false) {
        $base = 'inline-flex items-center px-2 py-1 text-sm rounded-md border transition ';
        $tone = $variant === 'danger'
              ? 'border-red-200 text-red-500 hover:bg-red-50 hover:text-red-600'
              : 'border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900';

        return $base . $tone . ($last ? '' : ' me-1');
    }

    /*  Boton de la columna 'a': $jsObj es la global de la pestaña ('categories').
        aria-label y no title: en este framework title dispara un popover. */
    protected function rowActions($jsObj, $id, $active, $locked = false) {
        if ($locked) {
            return [[
                'class'      => $this->actionBtnClass('neutral', true),
                'html'       => '<i class="icon-lock"></i>',
                'aria-label' => 'Plantilla de Huubie: solo lectura',
                'onclick'    => 'catalogoPlantilla()'
            ]];
        }

        $isActive = (int) $active === 1;

        return [
            [
                'class'      => $this->actionBtnClass('neutral'),
                'html'       => '<i class="icon-pencil"></i>',
                'aria-label' => 'Editar',
                'onclick'    => "{$jsObj}.edit({$id})"
            ],
            [
                'class'      => $this->actionBtnClass($isActive ? 'danger' : 'neutral', true),
                'html'       => '<i class="' . ($isActive ? 'icon-toggle-on' : 'icon-toggle-off') . '"></i>',
                'aria-label' => $isActive ? 'Desactivar' : 'Activar',
                'onclick'    => "{$jsObj}.status({$id}, " . ($isActive ? 0 : 1) . ')'
            ]
        ];
    }
}

// -- Celdas de la tabla --
// La tabla pinta cada celda como HTML: todo lo que venga de la base pasa por h().

if (!function_exists('h')) {
    function h($text) {
        return htmlspecialchars((string) $text, ENT_QUOTES, 'UTF-8');
    }
}

if (!function_exists('money')) {
    function money($number) {
        return '$' . number_format((float) $number, 2);
    }
}

if (!function_exists('renderActive')) {
    function renderActive($active) {
        $base = 'px-2 py-1 rounded-md text-sm font-semibold ';

        if ($active === null || $active === '') {
            return '<span class="' . $base . 'bg-slate-50 text-slate-500">Desconocido</span>';
        }

        return (int) $active === 1
            ? '<span class="' . $base . 'bg-emerald-50 text-emerald-700">Activo</span>'
            : '<span class="' . $base . 'bg-red-50 text-red-700">Inactivo</span>';
    }
}

if (!function_exists('chip')) {
    function chip($text, $tone = 'slate') {
        $tones = [
            'slate'   => 'bg-slate-100 text-slate-600',
            'emerald' => 'bg-emerald-50 text-emerald-700',
            'amber'   => 'bg-amber-50 text-amber-700',
            'sky'     => 'bg-sky-50 text-sky-700',
            'violet'  => 'bg-violet-50 text-violet-700',
            'red'     => 'bg-red-50 text-red-700'
        ];

        $class = isset($tones[$tone]) ? $tones[$tone] : $tones['slate'];

        return '<span class="cp-chip ' . $class . '">' . h($text) . '</span>';
    }
}

if (!function_exists('cellTitle')) {
    function cellTitle($title, $sub = '') {
        $html = '<div class="cp-celda-titulo">' . h($title) . '</div>';

        if ($sub === null || $sub === '') return $html;

        return $html . '<div class="cp-celda-sub">' . h($sub) . '</div>';
    }
}

if (!function_exists('originBadge')) {
    function originBadge($companyId) {
        return $companyId === null ? chip('Plantilla', 'violet') : chip('Propio', 'slate');
    }
}

if (!function_exists('yesNo')) {
    function yesNo($value) {
        return (int) $value === 1 ? chip('Sí', 'emerald') : '<span class="cp-celda-sub">No</span>';
    }
}
