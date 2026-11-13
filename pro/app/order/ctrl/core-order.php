<?php
require_once __DIR__ . '/../../../core/security/_Session.php';
require_once __DIR__ . '/../../../core/security/_Permission.php';
require_once __DIR__ . '/../mdl/mdl-order.php';

/*  Base de los ctrl de Pedidos (la forma de Catalogo).

    Permission::dispatch solo ejecuta los metodos declarados en la clase ctrl de
    cada archivo. Por eso aqui todo es protected y las operaciones (ls*, get*)
    se escriben publicas en cada ctrl.

    dispatch valida que se vea la SECCION. Cada operacion pide ademas su accion
    con need(): ver no es lo mismo que imprimir o cancelar.

    Escrituras: siempre dentro de transaction() y cada _Insert/_Update pasa por
    must(), que vuelve excepcion el string o false con el que avisa el CRUD. */
class core extends mdl {

    const SECTION = 'pos-pedidos';

    // Estados de sale_status (plantillas de Huubie, iguales en todas las bases).
    const QUOTE     = 1;
    const PENDING   = 2;
    const PAID      = 3;
    const CANCELLED = 4;

    // Días hacia atrás en que se buscan días sin cerrar (como alpha).
    const PENDING_WINDOW = 15;

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

    // Matriz = la primera sucursal activa de la empresa: en BD no hay marca.
    protected function mainBranchId() {
        $main = $this->qFirstBranch($this->companyId());

        return $main ? (int) $main['id'] : $this->branchId();
    }

    /*  Crear exige el turno de HOY abierto, como alpha: sin turno el pedido no
        tiene a que corte sumar, y uno de otro dia se cierra antes de seguir.
        Sin turno, si el dia ya se cerro o falta cerrar uno anterior, lo dice
        con day = true para que la pantalla ofrezca el cierre. Editar no lo exige. */
    protected function needTurn() {
        $turn = $this->qOpenTurn($this->branchId());

        if (!$turn) {
            $block = $this->dayBlock();

            if ($block !== '') {
                return [
                    'status'  => 423,
                    'title'   => $this->dayClosedToday() ? 'Día cerrado' : 'Día pendiente de cierre',
                    'message' => $block,
                    'day'     => true,
                    'row'     => []
                ];
            }

            return [
                'status'  => 423,
                'title'   => 'Sin turno abierto',
                'message' => 'Abre un turno de caja en esta sucursal antes de crear o cobrar pedidos.',
                'row'     => []
            ];
        }

        $opened = substr((string) $turn['opened_at'], 0, 10);

        if ($opened !== date('Y-m-d')) {
            return [
                'status'  => 423,
                'title'   => 'Turno pendiente de otro día',
                'message' => 'El turno ' . $turn['folio'] . ' sigue abierto desde el ' . date('d/m/Y', strtotime($opened)) . '. Ciérralo antes de crear o cobrar pedidos.',
                'row'     => []
            ];
        }

        return null;
    }

    // El turno abierto para la cabecera. old = abierto en otro dia.
    protected function turnBrief() {
        $turn = $this->branchId() > 0 ? $this->qOpenTurn($this->branchId()) : null;

        if (!$turn) return null;

        return [
            'id'        => (int) $turn['id'],
            'folio'     => (string) $turn['folio'],
            'opened_at' => (string) $turn['opened_at'],
            'old'       => substr((string) $turn['opened_at'], 0, 10) !== date('Y-m-d')
        ];
    }

    // -- Día de caja --

    // [inicio del día, inicio del siguiente) para comparar fechas con hora.
    protected function dayRange($day) {
        return [$day . ' 00:00:00', date('Y-m-d', strtotime($day . ' +1 day')) . ' 00:00:00'];
    }

    // fi/ff del POST (por defecto, el mes en curso) -> [desde, hasta) para las listas de cortes.
    protected function postRange() {
        $fi = $this->postDate('fi', date('Y-m-01'));
        $ff = $this->postDate('ff', date('Y-m-t'));

        if ($fi > $ff) list($fi, $ff) = [$ff, $fi];

        return [$fi . ' 00:00:00', $this->dayRange($ff)[1]];
    }

    protected function dayClosedToday() {
        return $this->dayClosedOn(date('Y-m-d'));
    }

    // $day = 'AAAA-MM-DD'. true si la sucursal tiene un cierre vigente ese día.
    protected function dayClosedOn($day) {
        [$from, $to] = $this->dayRange($day);

        return (bool) $this->qDayClosure($this->branchId(), $from, $to);
    }

    // Días anteriores a hoy con turnos y sin cierre, dentro de la ventana de alpha.
    protected function pendingDays() {
        $today = date('Y-m-d');
        $from  = date('Y-m-d', strtotime($today . ' -' . self::PENDING_WINDOW . ' days')) . ' 00:00:00';

        return array_map(function ($row) {
            return [
                'date'       => (string) $row['day'],
                'turns'      => (int) $row['turns'],
                'open_turns' => (int) $row['open_turns']
            ];
        }, $this->qPendingDays($this->branchId(), $from, $today . ' 00:00:00'));
    }

    // '' = hoy se puede abrir turno. Si no, la frase que lo impide.
    protected function dayBlock() {
        if ($this->dayClosedToday()) {
            return 'El día de hoy ya se cerró en esta sucursal. Reábrelo desde «Cierre del día» para volver a operar.';
        }

        $pending = $this->pendingDays();

        if ($pending) {
            return 'Falta cerrar el día ' . dmy($pending[0]['date']) . '. Ciérralo desde «Cierre del día» antes de abrir el turno de hoy.';
        }

        return '';
    }

    // El día para la cabecera: cerrado hoy y días anteriores sin cerrar.
    protected function dayBrief() {
        if ($this->branchId() === 0) return null;

        return [
            'closed'  => $this->dayClosedToday(),
            'pending' => array_column($this->pendingDays(), 'date')
        ];
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
    protected function need($action, $text = null) {
        if (Permission::can(self::SECTION, $action)) return null;

        $what = [
            'show'   => 'ver pedidos',
            'create' => 'crear pedidos',
            'update' => 'editar pedidos',
            'cancel' => 'cancelar pedidos',
            'delete' => 'eliminar pedidos',
            'print'  => 'imprimir pedidos'
        ];

        if ($text === null) $text = isset($what[$action]) ? $what[$action] : $action;

        return ['status' => 403, 'message' => "Tu rol no tiene permiso para {$text} en esta sucursal.", 'row' => []];
    }

    // -- Reglas de cobro --

    // '' = se puede cobrar. La entrega no bloquea: el saldo se cubre al entregar.
    protected function payBlock($o) {
        $status  = (int) $o['sale_status_id'];
        $balance = round((float) $o['total'] - (float) $o['paid'], 2);

        if ($status === self::CANCELLED) return 'Un pedido cancelado no se cobra.';
        if ($balance <= 0) return 'El pedido no tiene saldo pendiente.';
        if (!in_array($status, [self::QUOTE, self::PENDING, self::PAID], true)) return 'Este pedido no se puede cobrar en su estado actual.';

        return '';
    }

    // El estado lo pone el dinero: sin pagos Cotizacion, con saldo Pendiente, sin saldo Pagado.
    // Una cortesia del 100 % (total $0) queda Pagada aunque no haya pagos.
    protected function statusFor($total, $paid) {
        if ($paid <= 0 && $total > 0.005) return self::QUOTE;

        return round($total - $paid, 2) <= 0.005 ? self::PAID : self::PENDING;
    }

    // -- Corte cerrado --

    // '' = el pedido no cuenta en un corte cerrado. Si no, en cuál, para armar la frase.
    protected function closedCut($o) {
        if (!empty($o['closure_day']))         return 'es del día ' . dmy($o['closure_day']) . ', que ya se cerró';
        if ($o['turn_status'] === 'closed')     return 'es del turno ' . $o['turn_folio'] . ', que ya se cerró';

        return '';
    }

    /*  Decisión 4: lo que mueve el dinero de un corte cerrado (editar el total,
        cancelar, descontar al cobrar) lo autoriza Dueño o Supervisor (permiso
        cancel). Solo aplica a Pendiente: la cotización no cuenta en lo vendido. */
    protected function moneyBlock($o) {
        if ((int) $o['sale_status_id'] !== self::PENDING) return '';

        $cut = $this->closedCut($o);

        if ($cut === '' || $this->need('cancel') === null) return '';

        return "Este pedido {$cut}: cambiar su total lo autoriza Dueño o Supervisor.";
    }

    // La nota que queda en la bitácora cuando se toca el dinero de un corte cerrado.
    protected function cutNote($o) {
        $cut = $this->closedCut($o);

        return $cut === '' ? '' : ucfirst($cut) . ': su corte no cambia.';
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

    // 'HH:MM' o 'HH:MM:SS' valida -> 'HH:MM:00'. Otra cosa = null.
    protected function postTime($key) {
        $value = $this->post($key);

        if (!preg_match('/^([01]\d|2[0-3]):([0-5]\d)(?::[0-5]\d)?$/', $value, $m)) return null;

        return $m[1] . ':' . $m[2] . ':00';
    }

    protected function textOrNull($key) {
        $value = $this->post($key);

        return $value === '' ? null : $value;
    }

    // Arreglo mandado como JSON. Lo que no sea arreglo = null.
    protected function postedJson($key) {
        $value = json_decode($this->post($key), true);

        return is_array($value) ? $value : null;
    }

    // -- Validacion --

    protected function tooLong($value, $max) {
        return $value !== null && mb_strlen((string) $value, 'UTF-8') > $max;
    }

    // Monto >= 0 de un valor suelto. Vacio = $default. Invalido o negativo = null.
    protected function amountOf($raw, $default = 0, $decimals = 2) {
        $raw = str_replace(['$', ',', ' '], '', trim((string) $raw));

        if ($raw === '') return $default;
        if (!preg_match('/^(\d+(\.\d*)?|\.\d+)$/', $raw)) return null;

        return round((float) $raw, $decimals);
    }

    // Entero de un valor suelto. Otra cosa = null.
    protected function intOf($raw) {
        $raw = trim((string) $raw);

        return preg_match('/^-?\d+$/', $raw) ? (int) $raw : null;
    }

    // -- Escritura --

    // _Insert, _Update y _CUD avisan con un string o false; aqui se vuelve excepcion.
    protected function must($result, $what) {
        if ($result !== true) {
            throw new RuntimeException($what . ': ' . (is_string($result) ? $result : 'sin respuesta de la base'));
        }

        return true;
    }

    // Quien hace la operacion. 0 = sesion sin usuario.
    protected function userId() {
        return isset($_SESSION['user_id']) ? (int) $_SESSION['user_id'] : 0;
    }

    // -- Bitacora y doble envio --

    protected function log($saleId, $type, $title, $text) {
        $this->must($this->qCreateHistory([
            'values' => ['sale_id', 'user_id', 'type', 'title', 'action', 'detail', 'active'],
            'data'   => [$saleId, $this->userId() ?: null, $type, mb_substr($title, 0, 50, 'UTF-8'), mb_substr($text, 0, 255, 'UTF-8'), $text, 1]
        ]), 'log');
    }

    /*  Un mismo envio (doble clic, red que reintenta) no guarda dos veces: la
        sesion recuerda las ultimas 20 respuestas por token. PHP no suelta la
        sesion hasta terminar la peticion, asi que el segundo envio espera al
        primero y encuentra su respuesta. */
    protected function tokenResult($token) {
        if (!preg_match('/^[a-f0-9]{16,64}$/', $token)) {
            return $this->fail(400, 'Falta el identificador del envío. Recarga la página e intenta de nuevo.');
        }

        return isset($_SESSION['order_tokens'][$token]) ? $_SESSION['order_tokens'][$token] : null;
    }

    protected function rememberToken($token, $answer) {
        if (!isset($answer['status']) || $answer['status'] !== 200) return;

        $tokens = isset($_SESSION['order_tokens']) && is_array($_SESSION['order_tokens']) ? $_SESSION['order_tokens'] : [];

        unset($tokens[$token]);
        $tokens[$token] = $answer;

        $_SESSION['order_tokens'] = array_slice($tokens, -20, 20, true);
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
