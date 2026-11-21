<?php
require_once __DIR__ . '/../../../core/security/_Session.php';
require_once __DIR__ . '/../../../core/security/_Permission.php';
require_once __DIR__ . '/../../../core/helpers/_CoffeeSoft.php';
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

    // El visor de Cortes (menú «Tickets/Cierre») tiene su propia sección.
    const TICKETS = 'pos-tickets';

    // El calendario (Producción): palomea «ya se elaboró» con su 'update'.
    const CALENDAR = 'pos-calendario';

    // Estados de sale_status (plantillas de Huubie, iguales en todas las bases).
    const QUOTE     = 1;
    const PENDING   = 2;
    const PAID      = 3;
    const CANCELLED = 4;

    // Días hacia atrás en que se buscan días sin cerrar (como alpha).
    const PENDING_WINDOW = 15;

    // Contraseña (entregar, cancelar, quitar un pago, editar la entrega de un pagado):
    // fallos seguidos que se toleran y segundos de espera después.
    const KEY_TRIES = 5;
    const KEY_WAIT  = 300;

    private $scopeCache   = null;
    private $viewCache    = [];
    private $foreignCache = [];
    private $adopted      = null;   // adoptOrderBranch: ['home', 'branch_id', 'branch']

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

    // -- Todas las sucursales --

    /*  Las sucursales que el usuario puede ver juntas en $section (code):
        Dueño y root, todas las activas de la empresa, como la barra; los
        demás, aquellas donde su rol tiene 'show'. Solo sirve para CONSULTAR:
        toda escritura sigue atada a branchId(). [id => nombre] */
    protected function viewBranches($section) {
        if (isset($this->viewCache[$section])) return $this->viewCache[$section];

        $all  = !empty($_SESSION['is_owner']) || !empty($_SESSION['is_root']) ? 1 : 0;
        $rows = $this->companyId() > 0 ? $this->qViewBranches($this->companyId(), $all, $this->userId(), $section) : [];
        $list = [];

        foreach ($rows as $row) $list[(int) $row['id']] = $row['name'];

        return $this->viewCache[$section] = $list;
    }

    /*  Para la barra: se ofrece «Todas las sucursales» si ve más de una.
        key = empresa:usuario, para que la elección guardada en el navegador
        no pase a otra cuenta. null = no se ofrece. */
    protected function allOffer($section) {
        $count = count($this->viewBranches($section) + [$this->branchId() => '']);

        return $count > 1 ? ['key' => $this->companyId() . ':' . $this->userId(), 'count' => $count] : null;
    }

    // Las sucursales de la consulta: la activa y, con all = 1, las demás que deja ver.
    protected function readBranches($section) {
        $ids = [$this->branchId()];

        if ($this->post('all') === '1') $ids = array_merge($ids, array_keys($this->viewBranches($section)));

        return array_values(array_unique(array_map('intval', $ids)));
    }

    // De cuál de esas sucursales es el pedido: [branch_id, branch] o null.
    protected function orderBranch($id, $section) {
        return $id > 0 ? $this->qOrderBranch($id, $this->readBranches($section)) : null;
    }

    // -- Pedido de otra sucursal (reglas de alpha) --

    /*  Lo que alpha deja hacer con un pedido de OTRA sucursal
        (alpha/pedidos › dropdownOrder y canWriteOrder), en los roles de pro:
          Dueño y root (Administrador)      todo, como en la suya
          Supervisor (permiso cancel)       solo editar los datos de entrega
          Cajero (create, sin cancel)       editar el pedido siempre; entregar,
                                            deshacer, cancelar y datos de entrega
                                            si ESA sucursal tiene turno abierto
          los demás                         ver e imprimir
        Cobrar el pedido ajeno: solo Dueño y root (el menú de alpha no da
        «Pagar» a nadie más). Cada acción sigue pidiendo además su permiso (need).
        $act: edit | pay | cancel | deliver | delivery | delete. '' = puede. */
    protected function foreignBlock($act, $branchId, $name) {
        $branchId = (int) $branchId;

        if (!isset($this->foreignCache[$branchId])) $this->foreignCache[$branchId] = $this->foreignRules($branchId, (string) $name);

        return $this->foreignCache[$branchId][$act] ?? "Es de {$name}: solo puedes verlo e imprimirlo.";
    }

    // Las reglas de foreignBlock para una sucursal: se arman una vez por petición.
    private function foreignRules($branchId, $name) {
        $acts = ['edit', 'pay', 'cancel', 'deliver', 'delivery', 'delete'];

        if ($this->isOwner()) return array_fill_keys($acts, '');

        $actions = $this->actions();

        if (in_array('cancel', $actions, true)) {
            $rules = array_fill_keys($acts, "Es de {$name}: en otra sucursal, el Supervisor solo edita los datos de entrega.");
            $rules['delivery'] = '';

            return $rules;
        }

        $rules = array_fill_keys($acts, "Es de {$name}: solo puedes verlo e imprimirlo.");

        if (in_array('create', $actions, true)) {
            $turn = $this->qOpenTurn($branchId)
                ? ''
                : "Es de {$name} y esa sucursal no tiene turno abierto: ahí se abre el turno para cambiarlo.";

            $rules['edit']     = '';
            $rules['deliver']  = $turn;
            $rules['delivery'] = $turn;
            $rules['cancel']   = $turn;
            $rules['pay']      = "Es de {$name}: cobrar un pedido de otra sucursal lo hace el Dueño.";
        }

        return $rules;
    }

    // true = el pedido es de la sucursal activa o la regla de alpha deja hacer $act ($o trae branch_id y branch).
    protected function orderMay($o, $act) {
        if ((int) $o['branch_id'] === $this->branchId()) return true;

        return $this->foreignBlock($act, (int) $o['branch_id'], (string) ($o['branch'] ?? '')) === '';
    }

    /*  El detalle de un pedido de otra sucursal (vista «todas»): lo mismo que
        uno propio (orderCan), menos lo que la regla de alpha no deja. */
    protected function foreignCan($order, $place, $payments = null) {
        $branchId = (int) $place['branch_id'];
        $name     = (string) $place['branch'];
        $can      = $this->orderCan($order, $payments);

        // Llave de orderCan => acción de foreignBlock. «Cobrar y entregar» pide las dos.
        $map = [
            'edit' => 'edit', 'cancel' => 'cancel', 'pay' => 'pay', 'settle' => 'pay', 'delete_payment' => 'pay',
            'deliver' => 'deliver', 'undeliver' => 'deliver', 'delivery' => 'delivery', 'delete' => 'delete'
        ];

        foreach ($map as $key => $act) {
            $why = $this->foreignBlock($act, $branchId, $name);

            if (!$can[$key] || $why === '') continue;

            $can[$key] = false;

            if (array_key_exists($key . '_reason', $can)) $can[$key . '_reason'] = $why;
        }

        if ($can['settle'] && $this->foreignBlock('deliver', $branchId, $name) !== '') $can['settle'] = false;

        $can['delivery_key'] = $can['delivery_key'] && $can['delivery'];

        $any = $can['edit'] || $can['cancel'] || $can['pay'] || $can['settle'] || $can['deliver'] || $can['undeliver'] || $can['delivery'];

        $can['foreign_reason'] = $any
            ? "Es de {$name}: los cambios se guardan en esa sucursal."
            : "Es de {$name}: solo puedes verlo e imprimirlo.";

        return $can;
    }

    /*  Una petición sobre un pedido de OTRA sucursal (vista «todas»): si el rol
        ve esa sucursal y la regla de alpha deja $act, trabaja en la sucursal del
        pedido (su turno, su catálogo, su corte), como si se hubiera elegido en
        la barra. La franja de caja sigue en la de la sesión (homeBranchId).
        $act = null: solo lectura. null = sigue; si no, el 403 con el porqué. */
    protected function adoptOrderBranch($id, $act) {
        if ($id <= 0 || $this->branchId() === 0 || $this->adopted) return null;

        if ($this->qOrderBranch($id, [$this->branchId()])) return null;

        $others = array_keys($this->viewBranches(self::SECTION));
        $place  = $others ? $this->qOrderBranch($id, $others) : null;

        // No es de ninguna que vea: el endpoint contesta su 404 de siempre.
        if (!$place) return null;

        $why = $act === null ? '' : $this->foreignBlock($act, (int) $place['branch_id'], $place['branch']);

        if ($why !== '') return ['status' => 403, 'message' => $why, 'row' => []];

        $this->adopted = ['home' => $this->branchId(), 'branch_id' => (int) $place['branch_id'], 'branch' => (string) $place['branch']];

        $this->scopeCache['branch_id'] = (int) $place['branch_id'];
        $this->scopeCache['branch']    = (string) $place['branch'];

        return null;
    }

    // La sucursal de la sesión, aunque la petición trabaje en la de un pedido ajeno (adoptOrderBranch).
    protected function homeBranchId() {
        return $this->adopted ? $this->adopted['home'] : $this->branchId();
    }

    // Matriz = la primera sucursal activa de la empresa: en BD no hay marca.
    protected function mainBranchId() {
        $main = $this->qFirstBranch($this->companyId());

        return $main ? (int) $main['id'] : $this->branchId();
    }

    // URL del logo de la empresa para el ticket impreso ('' si no ha subido uno).
    // 4 = los dirname() de app/order/ctrl/ a pro/ (companyLogoUrl, _CoffeeSoft.php).
    protected function companyLogo() {
        $row = $this->qCompanyLogo($this->companyId());

        return $row ? companyLogoUrl($row['logo'], 4) : '';
    }

    /*  Crear exige el turno de HOY abierto, como alpha: sin turno el pedido no
        tiene a que corte sumar, y uno de otro dia se cierra antes de seguir.
        Sin turno, si el dia ya se cerro o falta cerrar uno anterior, lo dice
        con day = true para que la pantalla ofrezca el cierre. Editar no lo exige.
        $branchId / $name: otra sucursal (cobro cruzado); por defecto la de la sesión. */
    protected function needTurn($branchId = null, $name = '') {
        $branchId = $branchId === null ? $this->branchId() : (int) $branchId;
        $where    = $name !== '' ? $name : 'esta sucursal';
        $turn     = $this->qOpenTurn($branchId);

        if (!$turn) {
            $block = $this->dayBlock($branchId, $where);

            if ($block !== '') {
                return [
                    'status'  => 423,
                    'title'   => $this->dayClosedToday($branchId) ? 'Día cerrado' : 'Día pendiente de cierre',
                    'message' => $block,
                    'day'     => true,
                    'row'     => []
                ];
            }

            return [
                'status'  => 423,
                'title'   => 'Sin turno abierto',
                'message' => "Abre un turno de caja en {$where} antes de crear o cobrar pedidos.",
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

    // El turno abierto para la franja de caja. old = abierto en otro dia.
    // Las cifras (fondo, vendido, conteos) solo van con el turno de hoy: el viejo solo pide cerrarse.
    // Siempre de la sucursal de la sesión (homeBranchId): la franja no cambia por un pedido ajeno.
    protected function turnBrief() {
        $turn = $this->homeBranchId() > 0 ? $this->qOpenTurn($this->homeBranchId()) : null;

        if (!$turn) return null;

        $old   = substr((string) $turn['opened_at'], 0, 10) !== date('Y-m-d');
        $brief = [
            'id'           => (int) $turn['id'],
            'folio'        => (string) $turn['folio'],
            'opened_at'    => (string) $turn['opened_at'],
            'opened_by'    => trim((string) $turn['opened_by']),
            'opening_cash' => round((float) $turn['opening_cash'], 2),
            'old'          => $old
        ];

        if (!$old) {
            $totals = $this->qTurnTotals((int) $turn['id']) ?: [];

            $brief['total_sales']  = round((float) ($totals['total_sales'] ?? 0), 2);
            $brief['orders_count'] = (int) ($totals['orders_count'] ?? 0);
            $brief['sales_count']  = (int) ($totals['sales_count'] ?? 0);
        }

        return $brief;
    }

    /*  Qué sucursal de la empresa tiene turno: { branch_id: 'open' | 'old' }.
        open = abierto hoy; old = sigue abierto desde otro día (needTurn no deja
        capturar hasta cerrarlo). Sin llave = sin turno. Lo pintan el selector de
        sucursal de la barra (init de Pedidos y Ventas) y el de la captura (formOptions). */
    protected function branchTurns() {
        $turns = [];

        foreach ($this->qOpenTurnsByCompany($this->companyId()) as $row) {
            $turns[(int) $row['branch_id']] = substr((string) $row['opened_at'], 0, 10) === date('Y-m-d') ? 'open' : 'old';
        }

        return (object) $turns;
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

    // $branchId null = la sucursal de la sesión (igual en los tres de abajo).
    protected function dayClosedToday($branchId = null) {
        return $this->dayClosedOn(date('Y-m-d'), $branchId);
    }

    // $day = 'AAAA-MM-DD'. true si la sucursal tiene un cierre vigente ese día.
    protected function dayClosedOn($day, $branchId = null) {
        [$from, $to] = $this->dayRange($day);

        return (bool) $this->qDayClosure($branchId === null ? $this->branchId() : (int) $branchId, $from, $to);
    }

    // Días anteriores a hoy con turnos y sin cierre, dentro de la ventana de alpha.
    protected function pendingDays($branchId = null) {
        $branchId = $branchId === null ? $this->branchId() : (int) $branchId;
        $today    = date('Y-m-d');
        $from  = date('Y-m-d', strtotime($today . ' -' . self::PENDING_WINDOW . ' days')) . ' 00:00:00';

        return array_map(function ($row) {
            return [
                'date'       => (string) $row['day'],
                'turns'      => (int) $row['turns'],
                'open_turns' => (int) $row['open_turns']
            ];
        }, $this->qPendingDays($branchId, $from, $today . ' 00:00:00'));
    }

    // '' = hoy se puede abrir turno. Si no, la frase que lo impide.
    protected function dayBlock($branchId = null, $where = 'esta sucursal') {
        if ($this->dayClosedToday($branchId)) {
            return "El día de hoy ya se cerró en {$where}. Para volver a operar, root lo reabre desde «Cierre del día».";
        }

        $pending = $this->pendingDays($branchId);

        if ($pending) {
            return 'Falta cerrar el día ' . dmy($pending[0]['date']) . '. Ciérralo desde «Cierre del día» antes de abrir el turno de hoy.';
        }

        return '';
    }

    // El día para la cabecera: cerrado hoy, días anteriores sin cerrar, cuántos turnos
    // se abrieron hoy y cuántos ya se cerraron. Sin un turno cerrado (ni día pendiente),
    // «Cierre del día» sale apagado en todas las pantallas (orderTurn.dayReady).
    protected function dayBrief() {
        $home = $this->homeBranchId();

        if ($home === 0) return null;

        [$from, $to] = $this->dayRange(date('Y-m-d'));

        // branch_id y user_id: con ellos la pantalla busca los tickets en espera de Ventas
        // y sabe cuáles son de quien cierra (orderTurn.openWork).
        return [
            'branch_id'    => $home,
            'user_id'      => $this->userId(),
            'closed'       => $this->dayClosedToday($home),
            'pending'      => array_column($this->pendingDays($home), 'date'),
            'turns'        => $this->qDayTurnCount($home, $from, $to),
            'closed_turns' => $this->qDayClosedTurnCount($home, $from, $to)
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

    // El visor de Cortes pide ver la sección pos-tickets, no la de Pedidos.
    protected function needTickets() {
        if (Permission::can(self::TICKETS, 'show')) return null;

        return ['status' => 403, 'message' => 'Tu rol no tiene permiso para ver los cortes en esta sucursal.', 'row' => []];
    }

    // Quien no ve Pedidos y entra solo por el calendario (Producción): ve el pedido sin dinero.
    protected function limited() {
        return $this->need('show') !== null;
    }

    /*  Dueño: el de la cuenta (is_owner), root, o quien tiene el rol Dueño en la
        sucursal activa. El rol del sistema es 'owner'; Reginas tiene el suyo, 'dueno'. */
    protected function isOwner() {
        if (!empty($_SESSION['is_owner']) || !empty($_SESSION['is_root'])) return true;

        return in_array($this->qRoleCode($this->userId(), (int) ($_SESSION['branch_id'] ?? 0)), ['owner', 'dueno'], true);
    }

    // root = la cuenta de Developer (administra la plataforma). Es la única que elimina pedidos y reabre días.
    protected function isRoot() {
        return !empty($_SESSION['is_root']);
    }

    /*  Palomea «ya se elaboró»: Producción ('update' del calendario) y el Dueño.
        Lo mandan el detalle de Pedidos y el del calendario: el visor es uno solo. */
    protected function producer() {
        if (Permission::can(self::CALENDAR, 'update')) return true;

        return Permission::can(self::CALENDAR, 'show') && $this->isOwner();
    }

    // -- Reglas de cobro --

    // '' = se puede cobrar. La entrega no bloquea: el saldo se cubre al entregar.
    protected function payBlock($o) {
        $status  = (int) $o['sale_status_id'];
        $balance = round((float) $o['total'] - (float) $o['paid'], 2);

        if ($status === self::CANCELLED) return 'Un pedido cancelado no se cobra.';
        if ($status === self::QUOTE && (float) $o['total'] <= 0 && (float) $o['paid'] <= 0) return 'El pedido no tiene productos ni importe. Edítalo para agregarlos antes de cobrar.';
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

    // -- Detalle del corte --

    /*  El folio como sale en pantalla (lista de Pedidos e Historial): «P» los
        pedidos, también los de la tienda en línea; «V» las ventas de mostrador
        (sale_type 2 y 3). Sin folio guardado, el id. */
    protected function saleFolio($typeId, $folio, $id = 0) {
        $number = $folio !== null && $folio !== '' ? $folio : $id;

        return (in_array((int) $typeId, [2, 3], true) ? 'V' : 'P') . $number;
    }

    /*  El modo Detallado del visor de Cortes: cada pedido y cada cobro de esos
        turnos. Es en vivo: la foto del corte Z solo guarda totales. */
    protected function cutDetail(array $turnIds) {
        $sales = array_map(function ($s) {
            return [
                'id'        => (int) $s['id'],
                'folio'     => $this->saleFolio($s['sale_type_id'], $s['folio'], $s['id']),
                'customer'  => trim((string) $s['customer']),
                'status_id' => (int) $s['sale_status_id'],
                'status'    => (string) $s['status'],
                'order'     => (int) $s['sale_type_id'] === 1,
                'subtotal'  => round((float) $s['subtotal'], 2),
                'discount'  => round(abs((float) $s['discount']), 2),
                'total'     => round((float) $s['total'], 2),
                'at'        => $s['created_at']
            ];
        }, $this->qCutSales($turnIds));

        $payments = array_map(function ($p) {
            return [
                'id'       => (int) $p['id'],
                'folio'    => $this->saleFolio($p['sale_type_id'], $p['folio'], $p['sale_id']),
                'customer' => trim((string) $p['customer']),
                'method'   => (string) $p['method'],
                'amount'   => round((float) $p['amount'], 2),
                'at'       => $p['paid_at'],
                'other'    => (int) $p['other'] === 1
            ];
        }, $this->qCutPayments($turnIds));

        return ['sales' => $sales, 'payments' => $payments];
    }

    /*  '' = el aviso de WhatsApp del pedido se puede mandar otra vez (el
        «Reenviar» de alpha). Solo un pedido de verdad: la cotización aún no lo
        es y el cancelado ya no. Quién (Dueño o Supervisor) lo revisa el ctrl. */
    protected function noticeBlock($o) {
        $status = (int) $o['sale_status_id'];

        if ($status === self::QUOTE)     return 'Una cotización no avisa: el aviso sale cuando se vuelve pedido.';
        if ($status === self::CANCELLED) return 'Un pedido cancelado no avisa.';

        return '';
    }

    // -- Reglas de captura --

    // '' = se puede editar. Si no, el motivo en una frase.
    protected function editBlock($o) {
        $status = (int) $o['sale_status_id'];

        if ($status === self::CANCELLED) return 'Un pedido cancelado no se edita.';
        if ($status === self::PAID)      return 'Un pedido pagado no se edita.';
        if ($status !== self::QUOTE && $status !== self::PENDING) return 'Este pedido no se puede editar en su estado actual.';
        if ((int) $o['delivery_status'] === 1) return 'Un pedido entregado no se edita.';

        return '';
    }

    /*  '' = se puede cancelar. Lo que queda a favor pide cliente: ahí se guarda.
        Un pagado lo cancela Dueño o Supervisor (permiso cancel, como todo
        cancelar): lo cobrado en un turno abierto se anula (cancelSplit). Sin
        $payments (la lista) no se sabe cuánto queda a favor: lo revisan el
        detalle y cancelOrder antes de escribir. */
    protected function cancelBlock($o, $payments = null) {
        $status = (int) $o['sale_status_id'];

        if ($status === self::CANCELLED) return 'El pedido ya está cancelado.';
        if (!in_array($status, [self::QUOTE, self::PENDING, self::PAID], true)) return 'Este pedido no se puede cancelar en su estado actual.';
        if ((int) $o['delivery_status'] === 1) return 'Un pedido entregado no se cancela.';

        if ($status === self::PAID && $payments === null) return '';

        $kept = $status === self::PAID ? $this->cancelSplit($o, $payments)['kept'] : round((float) $o['paid'], 2);

        if ($kept > 0 && (int) $o['customer_id'] <= 0) {
            return 'Tiene ' . money($kept) . ' cobrados en turnos ya cerrados y no tiene cliente: no hay a quién dejar el saldo a favor.';
        }

        return '';
    }

    /*  Cancelar un PAGADO: los pagos de un turno que sigue abierto (los del día)
        se desactivan y salen de su corte; lo cobrado en turnos ya cerrados
        queda como saldo a favor, porque esos cortes no cambian.
        undo = los pagos a desactivar · undone = su suma · kept = lo que queda a favor. */
    protected function cancelSplit($o, array $payments) {
        $undo = array_values(array_filter($payments, function ($p) {
            return $p['turn_status'] === 'open';
        }));

        $undone = round(array_sum(array_map(function ($p) { return (float) $p['amount']; }, $undo)), 2);

        return ['undo' => $undo, 'undone' => $undone, 'kept' => round((float) $o['paid'] - $undone, 2)];
    }

    // '' = se puede eliminar. Con abonos no: se cancela, para conservar el rastro del dinero.
    protected function deleteBlock($o) {
        if (abs((float) $o['paid']) >= 0.005) return 'Un pedido cobrado no se elimina: cancélalo para conservar el rastro del dinero.';

        return '';
    }

    /*  Opcion "multiple" del pastel: se suma por cantidad, no por porcion.
        Igual que alpha: grupo marcado como extra o cuyo nombre dice "decoraci".
        Sin grupo tambien cuenta como multiple (no hay grupo que limite a una). */
    protected function isMultiple($isExtra, $groupName, $groupId = 1) {
        if ((int) $groupId <= 0) return true;
        if ((int) $isExtra === 1) return true;

        return mb_stripos((string) $groupName, 'decoraci', 0, 'UTF-8') !== false;
    }

    // -- Entrega --

    /*  '' = se puede marcar entregado. Decisión 5: el saldo se cubre al entregar,
        así que con saldo primero se cobra; la pantalla encadena las dos cosas. */
    protected function deliverBlock($o) {
        $status  = (int) $o['sale_status_id'];
        $balance = round((float) $o['total'] - (float) $o['paid'], 2);

        if ($status === self::CANCELLED)        return 'Un pedido cancelado no se entrega.';
        if ((int) $o['delivery_status'] === 1) return 'El pedido ya se entregó.';
        if ($balance > 0.005)                   return 'Tiene saldo de ' . money($balance) . ': cóbralo antes de entregar.';
        if (!in_array($status, [self::QUOTE, self::PENDING, self::PAID], true)) return 'Este pedido no se puede entregar en su estado actual.';

        return '';
    }

    // Solo el saldo impide entregar: se ofrece «Cobrar y entregar».
    protected function settleFirst($o) {
        return (int) $o['sale_status_id'] !== self::CANCELLED
            && (int) $o['delivery_status'] !== 1
            && round((float) $o['total'] - (float) $o['paid'], 2) > 0.005;
    }

    /*  Entregar pide la contraseña de quien opera, la misma con la que entra
        (como alpha). null = correcta. Las respuestas llevan key = true para que
        la pantalla deje la ventana abierta y marque el campo.
        KEY_TRIES fallos seguidos hacen esperar KEY_WAIT segundos: sin ese freno
        la contraseña se podría adivinar probando desde una caja abierta.
        $what completa los avisos: «para entregar», «para cancelar», «para quitar
        un pago», «para editar la entrega». */
    protected function needKey($what = 'entregar') {
        $guard = isset($_SESSION['order_key']) && is_array($_SESSION['order_key']) ? $_SESSION['order_key'] : [];
        $fails = isset($guard['fails']) ? (int) $guard['fails'] : 0;
        $until = isset($guard['until']) ? (int) $guard['until'] : 0;

        if ($until > time()) {
            $minutes = (int) ceil(($until - time()) / 60);

            return ['status' => 429, 'message' => 'Demasiados intentos. Espera ' . ($minutes === 1 ? '1 minuto' : "{$minutes} minutos") . ' y vuelve a intentar.', 'key' => true];
        }

        // Sin trim: la contraseña se compara tal cual se escribió, igual que al entrar.
        $key  = isset($_POST['key']) ? (string) $_POST['key'] : '';
        $hash = $this->qUserPassword($this->userId());

        if ($hash === '') {
            return ['status' => 409, 'message' => "Tu usuario no tiene contraseña. Pide al Dueño que te asigne una para poder {$what}.", 'key' => true];
        }

        if ($key === '') return ['status' => 401, 'message' => "Escribe tu contraseña para {$what}.", 'key' => true];

        if (!password_verify($key, $hash)) {
            $fails++;

            $_SESSION['order_key'] = $fails >= self::KEY_TRIES
                ? ['fails' => 0, 'until' => time() + self::KEY_WAIT]
                : ['fails' => $fails, 'until' => 0];

            $left = self::KEY_TRIES - $fails;

            return [
                'status'  => 401,
                'message' => $left <= 0
                    ? 'Contraseña incorrecta. Espera ' . (int) ceil(self::KEY_WAIT / 60) . ' minutos y vuelve a intentar.'
                    : 'Contraseña incorrecta. Te ' . ($left === 1 ? 'queda 1 intento' : "quedan {$left} intentos") . '.',
                'key'     => true
            ];
        }

        unset($_SESSION['order_key']);

        return null;
    }

    /*  Marca entregado. Valida despues de bloquear el pedido (FOR UPDATE): dos
        clics o dos cajas a la vez no lo entregan dos veces. sale no tiene
        delivered_at: la hora queda en la bitacora. Pide 'update' de Pedidos y
        la contraseña de quien entrega, antes de tocar la base. */
    protected function deliver($id) {
        $fail = $this->need('update', 'entregar pedidos') ?: $this->needBranch();
        if ($fail) return $fail;

        if ($id <= 0) return $this->fail(422, 'Falta el pedido.');

        $fail = $this->adoptOrderBranch($id, 'deliver') ?: $this->needKey();
        if ($fail) return $fail;

        return $this->attempt(function () use ($id) {
            return $this->transaction(function () use ($id) {
                $order = $this->qLockOrder($id, $this->branchId());

                if (!$order) return $this->fail(404, "El pedido P{$id} no existe en " . $this->scope()['branch'] . '.');

                $block = $this->deliverBlock($order);
                if ($block !== '') return $this->fail(409, $block);

                $this->must($this->qUpdateOrder([
                    'values' => ['delivery_status'],
                    'where'  => ['id'],
                    'data'   => [1, $id]
                ]), 'deliver');

                $how = (int) $order['delivery_method'] === 1 ? 'envío a domicilio' : 'recoge en tienda';

                $this->log($id, 'delivery', 'Pedido entregado',
                    'Entregado el ' . date('d/m/Y') . ' a las ' . hour12(date('H:i:s')) . " ({$how}).");

                return $this->ok("Pedido P{$id} entregado.", ['id' => $id]);
            });
        }, 'No se pudo marcar el pedido como entregado.');
    }

    // '' = se puede deshacer la entrega.
    protected function undeliverBlock($o) {
        if ((int) $o['sale_status_id'] === self::CANCELLED) return 'Un pedido cancelado no tiene entrega que deshacer.';
        if ((int) $o['delivery_status'] !== 1)              return 'El pedido no está entregado.';

        return '';
    }

    /*  Regresa el pedido a «sin entregar» (se marcó por error). Lo autoriza
        Dueño o Supervisor (permiso cancel, decisión 4) y pide motivo, como los
        demás reversos; sin contraseña. El motivo queda en la bitácora. */
    protected function undeliver($id) {
        $fail = $this->need('cancel', 'deshacer entregas') ?: $this->needBranch();
        if ($fail) return $fail;

        if ($id <= 0) return $this->fail(422, 'Falta el pedido.');

        $reason = trim((string) preg_replace('/\s+/u', ' ', $this->post('reason')));

        if ($reason === '')               return $this->fail(422, 'Escribe por qué se deshace la entrega.');
        if ($this->tooLong($reason, 200)) return $this->fail(422, 'El motivo admite hasta 200 caracteres.');

        $fail = $this->adoptOrderBranch($id, 'deliver');
        if ($fail) return $fail;

        return $this->attempt(function () use ($id, $reason) {
            return $this->transaction(function () use ($id, $reason) {
                $order = $this->qLockOrder($id, $this->branchId());

                if (!$order) return $this->fail(404, "El pedido P{$id} no existe en " . $this->scope()['branch'] . '.');

                $block = $this->undeliverBlock($order);
                if ($block !== '') return $this->fail(409, $block);

                $this->must($this->qUpdateOrder([
                    'values' => ['delivery_status'],
                    'where'  => ['id'],
                    'data'   => [0, $id]
                ]), 'undeliver');

                $this->log($id, 'delivery', 'Entrega deshecha', "Motivo: {$reason}");

                return $this->ok("Se deshizo la entrega del pedido P{$id}.", ['id' => $id]);
            });
        }, 'No se pudo deshacer la entrega.');
    }

    // -- Datos de entrega --

    /*  '' = se pueden cambiar los datos de entrega. A diferencia de editBlock,
        el pagado sí entra: aquí no se tocan productos ni dinero. */
    protected function deliveryBlock($o) {
        $status = (int) $o['sale_status_id'];

        if ($status === self::CANCELLED) return 'Un pedido cancelado no se edita.';
        if (!in_array($status, [self::QUOTE, self::PENDING, self::PAID], true)) return 'Este pedido no se puede editar en su estado actual.';
        if ((int) $o['delivery_status'] === 1) return 'Un pedido entregado no se edita.';

        return '';
    }

    /*  «Editar datos de entrega» (como alpha): solo fecha, hora, tipo de
        entrega, dirección y nota. Lo abren Pedidos y Calendario desde el
        detalle, así que no depende de ver la tabla. Pide 'update' de Pedidos.
        Un pedido pagado lo autoriza Dueño o Supervisor (permiso cancel) con su
        contraseña. Todo se valida antes de escribir: transaction() confirma lo
        hecho aunque se devuelva un fail. */
    protected function editDelivery($id) {
        $fail = $this->need('update', 'editar la entrega de pedidos') ?: $this->needBranch();
        if ($fail) return $fail;

        if ($id <= 0) return $this->fail(422, 'Falta el pedido.');

        $method   = $this->post('delivery_method') === '1' ? 1 : 0;
        $date     = $this->postDate('delivery_date', null);
        $time     = $this->postTime('delivery_time');
        $location = $method === 1 ? trim((string) preg_replace('/\s+/u', ' ', $this->post('location'))) : '';
        $note     = $this->textOrNull('note');

        if ($date === null)                    return $this->fail(422, 'Elige la fecha de entrega.');
        if ($time === null)                    return $this->fail(422, 'Elige la hora de entrega.');
        // Con envío a domicilio la dirección es opcional, igual que en la captura.
        if ($this->tooLong($location, 255))    return $this->fail(422, 'La dirección admite hasta 255 caracteres.');
        if ($this->tooLong($note, 2000))       return $this->fail(422, 'La nota admite hasta 2,000 caracteres.');

        $fail = $this->adoptOrderBranch($id, 'delivery');
        if ($fail) return $fail;

        $in = [
            'method'   => $method,
            'date'     => $date,
            'time'     => $time,
            'location' => $location === '' ? null : $location,
            'note'     => $note
        ];

        return $this->attempt(function () use ($id, $in) {
            return $this->transaction(function () use ($id, $in) {
                $order = $this->qLockOrder($id, $this->branchId());

                if (!$order) return $this->fail(404, "El pedido P{$id} no existe en " . $this->scope()['branch'] . '.');

                $block = $this->deliveryBlock($order);
                if ($block !== '') return $this->fail(409, $block);

                // La fecha que ya tenía se respeta aunque haya pasado: solo una nueva no puede ser anterior a hoy.
                if ((string) $order['delivery_date'] !== $in['date'] && $in['date'] < date('Y-m-d')) {
                    return $this->fail(422, 'La fecha de entrega no puede ser anterior a hoy.');
                }

                $paid = (int) $order['sale_status_id'] === self::PAID;

                if ($paid) {
                    $fail = $this->need('cancel', 'editar la entrega de un pedido pagado') ?: $this->needKey('editar la entrega');
                    if ($fail) return $fail;
                }

                $changes = $this->deliveryChanges($order, $in);

                if (empty($changes)) return $this->ok('Sin cambios.', ['id' => $id, 'unchanged' => true, 'changes' => []]);

                $this->must($this->qUpdateOrder([
                    'values' => ['delivery_method', 'delivery_date', 'delivery_time', 'location', 'note', 'edit_user_id', 'updated_at = NOW()'],
                    'where'  => ['id'],
                    'data'   => [$in['method'], $in['date'], $in['time'], $in['location'], $in['note'], $this->userId() ?: null, $id]
                ]), 'editDelivery');

                $this->log($id, 'edition', 'Pedido editado',
                    implode(' · ', array_column($changes, 'log')) . ($paid ? ' (pedido pagado, autorizado con contraseña)' : ''));

                // La pantalla lista cada cambio: campo, antes y después.
                $shown = array_map(function ($c) {
                    return ['field' => $c['field'], 'before' => $c['before'], 'after' => $c['after']];
                }, $changes);

                return $this->ok("Entrega del pedido P{$id} actualizada.", ['id' => $id, 'changes' => $shown]);
            });
        }, 'No se pudo guardar la entrega.');
    }

    /*  Lo que cambia de la entrega: campo, antes, después y su renglón de
        bitácora (log), con las mismas frases que deja editar el pedido. */
    protected function deliveryChanges($order, array $in) {
        $names   = ['Recoge en tienda', 'Envío a domicilio'];
        $changes = [];

        if ((string) $order['delivery_date'] !== $in['date']) {
            $before    = dmy($order['delivery_date']) ?: 'sin fecha';
            $after     = dmy($in['date']);
            $changes[] = ['field' => 'Fecha de entrega', 'before' => $before, 'after' => $after, 'log' => "Fecha de entrega: {$before} » {$after}"];
        }

        if (substr((string) $order['delivery_time'], 0, 5) !== substr($in['time'], 0, 5)) {
            $before    = hour12($order['delivery_time']) ?: 'sin hora';
            $after     = hour12($in['time']);
            $changes[] = ['field' => 'Hora de entrega', 'before' => $before, 'after' => $after, 'log' => "Hora: {$before} » {$after}"];
        }

        $was = (int) $order['delivery_method'] === 1 ? 1 : 0;

        if ($was !== $in['method']) {
            $changes[] = ['field' => 'Tipo de entrega', 'before' => $names[$was], 'after' => $names[$in['method']], 'log' => "Entrega: {$names[$was]} » {$names[$in['method']]}"];
        }

        $place = trim((string) preg_replace('/\s+/u', ' ', (string) $order['location']));

        if ($in['location'] !== null && $place !== $in['location']) {
            $changes[] = ['field' => 'Dirección', 'before' => $place !== '' ? $place : 'sin dirección', 'after' => $in['location'], 'log' => 'Dirección: ' . $in['location']];
        }

        $note = trim((string) $order['note']);

        if ($note !== (string) $in['note']) {
            $changes[] = ['field' => 'Nota', 'before' => $note !== '' ? $note : 'sin nota', 'after' => $in['note'] !== null ? $in['note'] : 'sin nota', 'log' => 'Nota actualizada'];
        }

        return $changes;
    }

    // -- Detalle --

    /*  El detalle completo: lo abren Pedidos y Calendario con el mismo modal.
        Cada ctrl valida antes su permiso de ver. A quien no ve Pedidos
        (Producción) le llega sin importes ni abonos: limited = true.
        Con all = 1 (vista «todas») también abre el de otra sucursal que el rol
        deja ver en $section: foreign = true, con las reglas de alpha (foreignCan). */
    protected function orderBundle($id, $section = self::SECTION) {
        $branch  = $this->scope()['branch'];
        $order   = $id > 0 ? $this->qGetOrder($id, $this->branchId()) : null;
        $place   = null;
        $foreign = false;

        if (!$order && $this->post('all') === '1') {
            $place = $this->orderBranch($id, $section);

            if ($place) {
                $order   = $this->qGetOrder($id, (int) $place['branch_id']);
                $foreign = (bool) $order;
            }
        }

        if (!$order) {
            $where = count($this->readBranches($section)) > 1 ? 'tus sucursales' : $branch;

            return $this->fail(404, "El pedido P{$id} no existe en {$where}.");
        }

        $lines   = $this->qOrderLines($id);
        $lineIds = array_map('intval', array_column($lines, 'id'));
        $images  = $this->groupBy($this->qLineImages($lineIds), 'detail_sale_id');
        $customs = [];

        foreach ($lines as $line) {
            if ((int) $line['is_custom'] === 1) $customs[] = (int) $line['product_id'];
        }

        $modifiers = $this->groupBy($this->qProductModifiers(array_values(array_unique($customs))), 'product_id');

        foreach ($lines as &$line) {
            $line['images']    = isset($images[$line['id']]) ? $images[$line['id']] : [];
            $line['modifiers'] = ((int) $line['is_custom'] === 1 && isset($modifiers[$line['product_id']]))
                               ? $modifiers[$line['product_id']]
                               : [];

            foreach ($line['modifiers'] as &$modifier) {
                $modifier['multiple'] = $this->isMultiple($modifier['is_extra'], $modifier['group_name'], $modifier['modifier_group_id']);
            }
            unset($modifier);
        }
        unset($line);

        $payments = $this->qPayments($id);

        $bundle = [
            'status'   => 200,
            'branch'   => $foreign ? $place['branch'] : $branch,
            'order'    => $order,
            'lines'    => $lines,
            'payments' => $payments,
            'history'  => $this->qHistory($id),
            'actions'  => $this->actions(),
            'can'      => $foreign ? $this->foreignCan($order, $place, $payments) : $this->orderCan($order, $payments),
            'limited'  => false,
            'foreign'  => $foreign
        ];

        // El dinero de otra sucursal sale solo si ahí el rol ve Pedidos.
        $limited = $foreign ? !isset($this->viewBranches(self::SECTION)[(int) $place['branch_id']]) : $this->limited();

        return $limited ? $this->withoutMoney($bundle) : $bundle;
    }

    /*  El detalle sin dinero. Se quita aquí y no en la pantalla: lo que no viaja
        no se puede ver ni con las herramientas del navegador. */
    protected function withoutMoney($bundle) {
        foreach (['subtotal', 'discount_amount', 'discount_percent', 'discount_note', 'discount_reason', 'total', 'paid'] as $key) {
            unset($bundle['order'][$key]);
        }

        foreach ($bundle['lines'] as &$line) {
            unset($line['price'], $line['discount_amount']);

            foreach ($line['modifiers'] as &$modifier) {
                unset($modifier['price']);
            }
            unset($modifier);
        }
        unset($line);

        // Los motivos pueden traer cifras («Tiene saldo de $700…»).
        foreach (['edit_reason', 'money_reason', 'cancel_reason', 'pay_reason', 'deliver_reason'] as $key) {
            if (strpos((string) $bundle['can'][$key], '$') !== false) $bundle['can'][$key] = 'No disponible para tu rol.';
        }

        $bundle['payments'] = [];
        $bundle['history']  = $this->historyWithoutMoney($bundle['history']);
        $bundle['limited']  = true;

        return $bundle;
    }

    /*  La bitácora sin dinero. Cobros, descuentos, precios y pagos quitados no
        salen. Del resto, cada cambio va separado por « · »: se quitan los que
        traen «$»; si antes de la raya («Pedido creado — total $800») hay texto
        limpio, ese se conserva. Un renglón que se queda sin texto no sale,
        salvo el de creación, que dice quién capturó y cuándo. */
    protected function historyWithoutMoney(array $rows) {
        $clean = function ($text) {
            $parts = [];

            foreach (explode(' · ', (string) $text) as $part) {
                if (strpos($part, '$') !== false) $part = trim(explode(' — ', $part)[0]);

                if ($part !== '' && strpos($part, '$') === false) $parts[] = $part;
            }

            return implode(' · ', $parts);
        };

        $out = [];

        foreach ($rows as $row) {
            if (in_array($row['type'], ['payment', 'discount', 'price', 'deletion'], true)) continue;

            $had = $row['action'] !== '' || $row['detail'] !== '';

            $row['action'] = $clean($row['action']);
            $row['detail'] = $clean($row['detail']);

            if ($had && $row['action'] === '' && $row['detail'] === '' && $row['type'] !== 'event') continue;

            $out[] = $row;
        }

        return $out;
    }

    // Lo que se puede hacer con el pedido y, si no, por que. $payments: sus pagos (qPayments), para cancelar un pagado.
    protected function orderCan($order, $payments = null) {
        $update  = $this->need('update') === null;
        $edit    = $update ? $this->editBlock($order) : 'Tu rol no puede editar pedidos.';
        $cancel  = $this->need('cancel') === null ? $this->cancelBlock($order, $payments) : 'Tu rol no puede cancelar pedidos.';
        $pay     = $this->need('create') === null ? $this->payBlock($order) : 'Tu rol no puede cobrar pedidos.';
        $deliver = $update ? $this->deliverBlock($order) : 'Tu rol no puede entregar pedidos.';
        $money   = $this->moneyBlock($order);
        $alive   = (int) $order['sale_status_id'] !== self::CANCELLED;
        $given   = (int) $order['delivery_status'] === 1;
        $undo    = $this->need('cancel') === null && $this->undeliverBlock($order) === '';
        $delete  = $this->isRoot() ? $this->deleteBlock($order) : 'Solo root (Developer) puede eliminar pedidos.';

        // Datos de entrega: el pagado lo edita solo Dueño o Supervisor, con contraseña.
        $isPaid   = (int) $order['sale_status_id'] === self::PAID;
        $delivery = !$update ? 'Tu rol no puede editar pedidos.' : $this->deliveryBlock($order);

        if ($delivery === '' && $isPaid && $this->need('cancel') !== null) $delivery = 'La entrega de un pedido pagado la edita Dueño o Supervisor.';

        $notice = $this->need('cancel') === null ? $this->noticeBlock($order) : 'Solo Dueño o Supervisor envían el aviso por WhatsApp.';

        return [
            'notify'          => $notice === '',
            'notify_reason'   => $notice,
            'edit'            => $edit === '',
            'edit_reason'     => $edit,
            'money'           => $money === '',
            'money_reason'    => $money,
            'cut'             => $this->closedCut($order),
            'cancel'          => $cancel === '',
            'cancel_reason'   => $cancel,
            'pay'             => $pay === '',
            'pay_reason'      => $pay,
            'deliver'         => $deliver === '',
            'deliver_reason'  => $deliver,
            'settle'          => $update && $pay === '' && $this->settleFirst($order),
            'undeliver'       => $undo,
            'delivery'        => $delivery === '',
            'delivery_reason' => $delivery,
            'delivery_key'    => $delivery === '' && $isPaid,
            'delete'          => $delete === '',
            'delete_reason'   => $delete,
            // Entregado = el dinero ya se cerró con el cliente: primero se deshace la entrega.
            'delete_payment'  => $alive && !$given && $this->need('delete') === null
        ];
    }

    protected function groupBy(array $rows, $key) {
        $groups = [];

        foreach ($rows as $row) {
            $groups[$row[$key]][] = $row;
        }

        return $groups;
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

// Fecha de la lista como en alpha/pedidos (formatSpanishDate): "Hoy" resaltado,
// "Ayer" o '13/nov/2026'. Sin strftime (deprecado). Vacio o invalido -> ''.
if (!function_exists('shortDate')) {
    function shortDate($date) {
        $time = $date && strpos($date, '0000-00-00') !== 0 ? strtotime($date) : false;

        if (!$time) return '';

        $day = date('Y-m-d', $time);

        if ($day === date('Y-m-d'))                      return '<span class="text-amber-600 font-semibold">Hoy</span>';
        if ($day === date('Y-m-d', strtotime('-1 day'))) return 'Ayer';

        $months = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

        return date('d', $time) . '/' . $months[(int) date('n', $time) - 1] . '/' . date('Y', $time);
    }
}

// '16:00:00' -> '4:00 PM'.
if (!function_exists('hour12')) {
    function hour12($time) {
        $stamp = $time ? strtotime('2000-01-01 ' . $time) : false;

        return $stamp ? date('g:i A', $stamp) : '';
    }
}
