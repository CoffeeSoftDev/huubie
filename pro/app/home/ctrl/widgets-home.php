<?php
require_once __DIR__ . '/../mdl/mdl-home.php';
require_once __DIR__ . '/../mdl/mdl-home-layout.php';
require_once __DIR__ . '/../../../core/security/_Permission.php';

/*  LOS DATOS DE CADA TARJETA DEL INICIO DEL DUEÑO.

    Cada tarjeta del catalogo (home_widgets) dice en `fn` cual funcion de esta
    clase arma sus datos: 'topProductos' -> $this->topProductos(). run() solo
    corre las que estan en HomeLayout::FUNCTIONS, y aqui las unicas funciones
    PUBLICAS son esas; lo demas es privado. Varias tarjetas pueden usar la misma
    funcion (cambia su nombre, su modulo o su zona). Una funcion nueva: su
    entrada en HomeLayout::FUNCTIONS, su funcion aqui y como se pinta en home.js
    (HOME_WIDGETS); sus tarjetas se dan de alta en Developer › Accesos › Inicio.

    El inicio solo le pide a cada funcion lo de las tarjetas que el dueño puso
    en su inicio, y solo de modulos que le abren hoy (HomeLayout::usable): una
    de Ventas no corre en una empresa sin Ventas.

    Todo es de la empresa de la sesion, de todas sus sucursales activas. Lo que
    varias tarjetas comparten (las cifras de hoy) se calcula una sola vez. */
class HomeWidgets {
    // El modulo de donde salen las cifras de venta (modules.code).
    const POS_MODULE = 'pedidos';

    // Dias hacia atras en que se buscan entregas atrasadas y dias sin cierre.
    const LATE_DAYS = 7;
    const CUT_DAYS  = 15;

    // La grafica de ventas por dia y cuantos dias adelante se ven las entregas.
    const SALES_DAYS    = 14;
    const DELIVERY_DAYS = 2;

    const NOT_PUBLIC = ['run'];

    private $db;
    private $cid;
    private $company;
    private $plan;
    private $business = false;

    // $db: el modelo del inicio. $company: su fila (getCompanyById). $plan: ctrl-home :: plan().
    function __construct(mdl $db, $companyId, array $company, array $plan) {
        $this->db      = $db;
        $this->cid     = (int) $companyId;
        $this->company = $company;
        $this->plan    = $plan;
    }

    /*  Los datos de una tarjeta. $fn viene de la base: solo se acepta una de
        HomeLayout::FUNCTIONS que sea funcion publica de ESTA clase (no de mdl ni
        de CRUD). */
    function run($fn) {
        $fn = (string) $fn;

        if (!isset(HomeLayout::FUNCTIONS[$fn]) || in_array($fn, self::NOT_PUBLIC, true) || !method_exists($this, $fn)) {
            throw new \Exception("La tarjeta pide una funcion que no existe: {$fn}");
        }

        $method = new \ReflectionMethod($this, $fn);

        if (!$method->isPublic() || $method->isStatic() || $method->getDeclaringClass()->getName() !== self::class) {
            throw new \Exception("La tarjeta pide una funcion que no es de tarjeta: {$fn}");
        }

        return $this->{$fn}();
    }

    // =============================================================== General

    /*  REQUIERE TU ATENCION: lo que el dueño tiene que saber o mandar hacer
        hoy, cada cosa con a donde ir (rutas relativas a pro/). Vacio = todo en
        orden. Lo de Ventas solo si la empresa lo tiene y le abre. */
    function atencion() {
        $items    = [];
        $business = $this->business();

        if ($business) {
            $sum = $business['today'];

            if ($sum['to_deliver'] > 0) {
                $items[] = [
                    'icon'  => 'package',
                    'title' => $this->count($sum['to_deliver'], 'pedido por entregar hoy', 'pedidos por entregar hoy'),
                    'text'  => $this->perBranch($business['branches'], 'to_deliver') ?: 'Revisa a qué hora sale cada uno.',
                    'route' => 'app/order/calendario.php',
                    'go'    => 'Ver calendario',
                ];
            }

            if ($sum['due'] > 0) {
                $items[] = [
                    'icon'  => 'hand-coins',
                    'title' => '$' . number_format($sum['due'], 2) . ' por cobrar en las entregas de hoy',
                    'text'  => $this->count($sum['due_orders'], 'pedido se entrega', 'pedidos se entregan') . ' con saldo pendiente.',
                    'route' => 'app/order/lista-pedidos.php',
                    'go'    => 'Ver pedidos',
                ];
            }

            if ($sum['late'] > 0) {
                $items[] = [
                    'icon'  => 'alarm-clock',
                    'title' => $this->count($sum['late'], 'pedido atrasado', 'pedidos atrasados') . ' o sin marcar como entregado',
                    'text'  => trim('Su entrega era en los últimos ' . self::LATE_DAYS . ' días. ' . $this->perBranch($business['branches'], 'late')),
                    'route' => 'app/order/lista-pedidos.php',
                    'go'    => 'Ver pedidos',
                ];
            }

            foreach ($business['branches'] as $branch) {
                if ($branch['unclosed'] === 0) continue;

                $items[] = [
                    'icon'  => 'calendar-x',
                    'title' => $branch['name'] . ': ' . $this->count($branch['unclosed'], 'día sin cierre', 'días sin cierre'),
                    'text'  => $branch['turn'] === 'old'
                        ? 'Su turno sigue abierto desde otro día: hay que cerrarlo para poder vender.'
                        : 'Hubo turnos y no se hizo el cierre del día.',
                    'route' => 'app/order/cortes.php',
                    'go'    => 'Ver cortes',
                ];
            }
        }

        if (trim((string) $this->company['rfc']) === '') {
            $items[] = [
                'icon'  => 'file-warning',
                'title' => 'Falta el RFC de tu empresa',
                'text'  => 'Complétalo para poder emitir tus facturas.',
                'route' => 'app/configuracion/',
                'go'    => 'Configurar',
            ];
        }

        return $items;
    }

    // El plan, su estado y cuando se paga (el mismo que lee el aviso de pago).
    function suscripcion() {
        return $this->plan;
    }

    /*  Las tarjetas de los modulos ya vienen en data.modules (las usa tambien
        el hub de submodulos). Aqui solo Mi perfil y Configuración del dueño,
        que el rail ya no trae (ctrl-nav :: extras). root los conserva en el
        rail. */
    function modulos() {
        if (empty($_SESSION['is_owner']) || !empty($_SESSION['is_root'])) return ['shortcuts' => []];

        return ['shortcuts' => [
            ['code' => 'perfil', 'name' => 'Mi perfil', 'icon' => 'user-round', 'text' => 'Tus datos, tu foto y tu contraseña.', 'route' => 'app/perfil/', 'locked' => 0, 'submodules' => []],
            ['code' => 'configuracion', 'name' => 'Configuración', 'icon' => 'settings', 'text' => 'Empresa, sucursales, usuarios, roles y plan.', 'route' => 'app/configuracion/', 'locked' => 0, 'submodules' => []],
        ]];
    }

    /*  Lo ultimo que paso en la empresa. Es de todos los modulos: cada modulo
        que la empresa tiene y le abre aporta lo suyo. Hoy solo Ventas tiene
        bitacora (history_log); el dia que otro la tenga, se suma aqui. */
    function actividad() {
        $rows = [];

        if ($this->allows(self::POS_MODULE)) {
            foreach ($this->db->listActivityByCompany([$this->cid]) as $row) {
                $rows[] = [
                    'icon'   => 'pos:' . (string) $row['type'],
                    'text'   => (string) $row['action'],
                    'folio'  => (string) $row['folio'],
                    'branch' => $row['branch'],
                    'user'   => (string) $row['user'],
                    'at'     => (string) $row['created_at'],
                ];
            }
        }

        usort($rows, function ($a, $b) { return strcmp($b['at'], $a['at']); });

        return array_slice($rows, 0, 6);
    }

    // ================================================================ Ventas

    // Las cuatro cifras de hoy de toda la empresa, contra el mismo dia de la semana pasada.
    function ventasHoy() {
        $b = $this->business();
        return $b ? ['today' => $b['today'], 'before' => $b['before']] : null;
    }

    // Como va hoy cada sucursal y como esta su caja.
    function ventasSucursal() {
        $b = $this->business();
        return $b ? $b['branches'] : [];
    }

    // Lo vendido cada dia de los ultimos SALES_DAYS dias, hoy incluido (hasta esta hora).
    function ventasDias() {
        $from = date('Y-m-d', strtotime('-' . (self::SALES_DAYS - 1) . ' days'));
        $to   = date('Y-m-d', strtotime('+1 day'));

        $byDay = [];
        foreach ($this->db->listSalesByDay([$this->cid, $from, $to]) as $row) $byDay[$row['day']] = $row;

        $days = [];
        for ($i = self::SALES_DAYS - 1; $i >= 0; $i--) {
            $day    = date('Y-m-d', strtotime("-{$i} days"));
            $days[] = [
                'day'     => $day,
                'sold'    => round((float) ($byDay[$day]['sold'] ?? 0), 2),
                'tickets' => (int) ($byDay[$day]['tickets'] ?? 0),
            ];
        }

        return ['days' => $days];
    }

    // Los 10 productos que mas vendieron en el mes, por importe (ver mdl :: listTopProducts).
    function topProductos() {
        list($from, $to) = $this->month();

        return array_map(function ($row) {
            return ['name' => (string) $row['name'], 'qty' => (float) $row['qty'], 'amount' => round((float) $row['amount'], 2)];
        }, $this->db->listTopProducts([$this->cid, $from, $to]));
    }

    // Los 5 clientes que mas compraron en el mes.
    function topClientes() {
        list($from, $to) = $this->month();

        return array_map(function ($row) {
            return ['name' => (string) $row['name'], 'orders' => (int) $row['orders'], 'total' => round((float) $row['total'], 2)];
        }, $this->db->listTopCustomers([$this->cid, $from, $to]));
    }

    // Los pedidos por entregar de hoy a DELIVERY_DAYS dias, con su saldo.
    function entregas() {
        $from = date('Y-m-d');
        $to   = date('Y-m-d', strtotime('+' . self::DELIVERY_DAYS . ' days'));
        $args = [$this->cid, $from, $to];

        return [
            'total' => $this->db->countUpcomingDeliveries($args),
            'rows'  => array_map(function ($row) {
                return [
                    'folio'    => (string) $row['folio'],
                    'date'     => (string) $row['delivery_date'],
                    'time'     => (string) $row['delivery_time'],
                    'customer' => (string) $row['customer'],
                    'branch'   => (string) $row['branch'],
                    'due'      => round(max((float) $row['total'] - (float) $row['paid'], 0), 2),
                ];
            }, $this->db->listUpcomingDeliveries($args)),
        ];
    }

    // ======================================================== Capital Humano

    // Las cuentas activas de la empresa que cumplen años este mes (users.birth_date).
    function cumpleanos() {
        return $this->people($this->db->listBirthdaysByCompany([$this->cid]));
    }

    // =============================================================== Lealtad

    /*  Las tarjetas activas y las nuevas del mes, y cuanto de lo vendido en el
        mes fue con tarjeta (share: de 0 a 1, null sin ventas en el mes). */
    function lealtadMes() {
        list($from, $to) = $this->month();

        $cards = $this->db->getLoyaltyCards([$from, $this->cid]);
        $sales = $this->db->getLoyaltySales([$this->cid, $from, $to]);

        $all = 0.0;
        foreach ($this->db->listSalesByBranch([$this->cid, $from, $to]) as $row) $all += (float) $row['sold'];

        return [
            'cards'     => (int) $cards['cards'],
            'new_cards' => (int) $cards['new_cards'],
            'sales'     => (int) $sales['sales'],
            'sold'      => round((float) $sales['sold'], 2),
            'share'     => $all > 0 ? round((float) $sales['sold'] / $all, 4) : null,
        ];
    }

    // ============================================================== Comunes

    /*  EL NEGOCIO DE HOY, de toda la empresa y por sucursal. null si la
        empresa no tiene Ventas o no le abre: no hay cifras que enseñar.

        Hoy se compara contra el mismo dia de la semana pasada y HASTA ESTA
        HORA (un sabado a mediodia contra el sabado pasado a mediodia): contra
        ayer, o contra el dia completo, la comparacion no dice nada. */
    private function business() {
        if ($this->business !== false) return $this->business;

        if (!$this->allows(self::POS_MODULE)) return $this->business = null;

        $db        = $this->db;
        $cid       = $this->cid;
        $today     = date('Y-m-d');
        $tomorrow  = date('Y-m-d', strtotime('+1 day'));
        $yesterday = date('Y-m-d', strtotime('-1 day'));
        $weekAgo   = date('Y-m-d', strtotime('-7 days'));
        $weekNow   = date('Y-m-d H:i:s', strtotime('-7 days'));
        $lateFrom  = date('Y-m-d', strtotime('-' . self::LATE_DAYS . ' days'));
        $cutFrom   = date('Y-m-d', strtotime('-' . self::CUT_DAYS . ' days'));

        $sales    = $this->byBranch($db->listSalesByBranch([$cid, $today, $tomorrow]));
        $paid     = $this->byBranch($db->listPaidByBranch([$cid, $today, $tomorrow]));
        $deliver  = $this->byBranch($db->listDeliveriesByBranch([$cid, $today, $today]));
        $late     = $this->byBranch($db->listDeliveriesByBranch([$cid, $lateFrom, $yesterday]));
        $turns    = $this->byBranch($db->listOpenTurnsByBranch([$cid]));
        $unclosed = $this->byBranch($db->listUnclosedDaysByBranch([$cid, $cutFrom, $today]));

        $branches = [];
        $sum      = ['sold' => 0.0, 'paid' => 0.0, 'tickets' => 0, 'to_deliver' => 0, 'deliveries' => 0, 'due' => 0.0, 'due_orders' => 0, 'late' => 0];

        foreach ($db->listBranchesByCompany([$cid]) as $branch) {
            $id    = (int) $branch['id'];
            $since = $turns[$id]['since'] ?? null;

            $row = [
                'name'       => $branch['name'],
                'sold'       => round((float) ($sales[$id]['sold'] ?? 0), 2),
                'paid'       => round((float) ($paid[$id]['paid'] ?? 0), 2),
                'tickets'    => (int) ($sales[$id]['tickets'] ?? 0),
                'to_deliver' => (int) ($deliver[$id]['pending'] ?? 0),
                'deliveries' => (int) ($deliver[$id]['total'] ?? 0),
                'due'        => round((float) ($deliver[$id]['due'] ?? 0), 2),
                'due_orders' => (int) ($deliver[$id]['due_orders'] ?? 0),
                'late'       => (int) ($late[$id]['pending'] ?? 0),
                // Caja: open (turno de hoy), old (sigue abierto el de otro dia) o none.
                'turn'       => $since === null ? 'none' : ($since === $today ? 'open' : 'old'),
                'turn_since' => $since,
                'unclosed'   => (int) ($unclosed[$id]['days'] ?? 0),
            ];

            foreach ($sum as $key => $value) $sum[$key] = $value + $row[$key];

            $branches[] = $row;
        }

        $before = ['sold' => 0.0, 'paid' => 0.0, 'tickets' => 0];

        foreach ($db->listSalesByBranch([$cid, $weekAgo, $weekNow]) as $row) {
            $before['sold']    += (float) $row['sold'];
            $before['tickets'] += (int) $row['tickets'];
        }

        foreach ($db->listPaidByBranch([$cid, $weekAgo, $weekNow]) as $row) $before['paid'] += (float) $row['paid'];

        return $this->business = [
            'today'    => array_map(function ($value) { return is_float($value) ? round($value, 2) : $value; }, $sum),
            'before'   => ['sold' => round($before['sold'], 2), 'paid' => round($before['paid'], 2), 'tickets' => $before['tickets']],
            'branches' => $branches,
        ];
    }

    // ¿La empresa tiene este modulo y le abre hoy?
    private function allows($code) {
        $id = Permission::moduleId($code);
        return $id !== 0 && Plan::allows($id, $code);
    }

    // [primer dia del mes, primer dia del siguiente).
    private function month() {
        return [date('Y-m-01'), date('Y-m-01', strtotime('first day of next month'))];
    }

    private function byBranch($rows) {
        $map = [];
        foreach ($rows as $row) $map[(int) $row['branch_id']] = $row;
        return $map;
    }

    private function count($n, $one, $many) {
        return $n . ' ' . ($n === 1 ? $one : $many);
    }

    // "Guadalupe 3 · Kafeto 1". '' con una sola sucursal: el total ya lo dice.
    private function perBranch($branches, $key) {
        if (count($branches) < 2) return '';

        $parts = [];
        foreach ($branches as $branch) {
            if ($branch[$key] > 0) $parts[] = $branch['name'] . ' ' . $branch[$key];
        }

        return implode(' · ', $parts);
    }

    private function people($rows) {
        return array_map(function ($row) {
            return [
                'name'   => $row['name'],
                'photo'  => userPhotoUrl($row['photo'] ?? '', 4),
                'color'  => $row['color'] ?: '',
                'day'    => isset($row['day']) ? (int) $row['day'] : 0,
                'today'  => !empty($row['today']) ? 1 : 0,
            ];
        }, $rows);
    }
}
?>
