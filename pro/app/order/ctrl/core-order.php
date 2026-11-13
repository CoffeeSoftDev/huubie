<?php
require_once __DIR__ . '/../../../core/security/_Session.php';
require_once __DIR__ . '/../../../core/security/_Permission.php';
require_once __DIR__ . '/../mdl/mdl-order.php';

/*  Base de los ctrl de Pedidos (la forma de Catalogo).

    Permission::dispatch solo ejecuta los metodos declarados en la clase ctrl de
    cada archivo. Por eso aqui todo es protected y las operaciones (ls*, get*)
    se escriben publicas en cada ctrl.

    dispatch valida que se vea la SECCION. Cada operacion pide ademas su accion
    con need(): ver no es lo mismo que imprimir o cancelar. */
class core extends mdl {

    const SECTION = 'pos-pedidos';

    private $scopeCache = null;

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

    // Llevan 'row' para que la tabla pinte vacio en vez de quedarse cargando.
    protected function needBranch() {
        if ($this->companyId() === 0) {
            return ['status' => 409, 'message' => 'No hay una empresa activa.', 'row' => []];
        }

        if ($this->branchId() === 0) {
            return ['status' => 409, 'message' => 'La empresa no tiene una sucursal activa.', 'row' => []];
        }

        return null;
    }

    // -- Permiso por accion --

    protected function actions() {
        return Permission::actions(self::SECTION);
    }

    // null si puede; si no, la respuesta 403 con la frase completa.
    protected function need($action) {
        if (Permission::can(self::SECTION, $action)) return null;

        $what = [
            'show'   => 'ver pedidos',
            'create' => 'crear pedidos',
            'update' => 'editar pedidos',
            'cancel' => 'cancelar pedidos',
            'delete' => 'eliminar pedidos',
            'print'  => 'imprimir pedidos'
        ];

        $text = isset($what[$action]) ? $what[$action] : $action;

        return ['status' => 403, 'message' => "Tu rol no tiene permiso para {$text} en esta sucursal.", 'row' => []];
    }

    // -- Respuestas --

    protected function ok($message, $extra = []) {
        return array_merge(['status' => 200, 'message' => $message], $extra);
    }

    protected function fail($status, $message) {
        return ['status' => $status, 'message' => $message];
    }

    // dispatch no atrapa excepciones: sin esto el cliente recibiria un 500 vacio.
    protected function attempt(callable $fn, $message) {
        try {
            return $fn();
        } catch (Throwable $e) {
            $this->writeToLog('[ PEDIDOS ] :: ' . $e->getMessage());

            return ['status' => 500, 'message' => $message, 'row' => []];
        }
    }

    // -- Lectura del POST --

    protected function post($key, $default = '') {
        return isset($_POST[$key]) ? trim((string) $_POST[$key]) : $default;
    }

    protected function postId($key = 'id') {
        return (int) $this->post($key, '0');
    }

    // Un select sin eleccion llega como '' o '0'.
    protected function selectOrNull($key) {
        $value = $this->post($key);

        return ($value === '' || $value === '0') ? null : (int) $value;
    }

    // 'AAAA-MM-DD' valida o $default.
    protected function postDate($key, $default) {
        $value = $this->post($key);
        $date  = DateTime::createFromFormat('Y-m-d', $value);

        return ($date && $date->format('Y-m-d') === $value) ? $value : $default;
    }
}

// -- Formato --
// La tabla y el detalle pintan HTML: todo lo que venga de la base pasa por h().

if (!function_exists('h')) {
    function h($text) {
        return htmlspecialchars((string) $text, ENT_QUOTES, 'UTF-8');
    }
}

// El signo va antes del $: "-$55.00", no "$-55.00".
if (!function_exists('money')) {
    function money($number) {
        $number = round((float) $number, 2);

        return ($number < 0 ? '-' : '') . '$' . number_format(abs($number), 2);
    }
}

// 'AAAA-MM-DD...' -> 'DD/MM/AAAA'. Vacio o invalido -> ''.
if (!function_exists('dmy')) {
    function dmy($date) {
        $time = $date ? strtotime($date) : false;

        return $time ? date('d/m/Y', $time) : '';
    }
}

// '16:00:00' -> '4:00 PM'.
if (!function_exists('hour12')) {
    function hour12($time) {
        $stamp = $time ? strtotime('2000-01-01 ' . $time) : false;

        return $stamp ? date('g:i A', $stamp) : '';
    }
}
