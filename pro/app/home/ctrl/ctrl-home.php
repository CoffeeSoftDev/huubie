<?php
require_once __DIR__ . '/../../../core/security/_Session.php';
if (empty($_POST['opc'])) exit(0);

require_once __DIR__ . '/../mdl/mdl-home.php';
require_once __DIR__ . '/../../../core/security/_Permission.php';
require_once __DIR__ . '/../../../core/helpers/_CoffeeSoft.php';
require_once __DIR__ . '/../../../core/billing/_Billing.php';

/*  EL INICIO DE UNA EMPRESA.

    Es la unica pagina que ve cualquiera con sesion, este como este su empresa:
    no pasa por Permission::page(). Tiene dos vistas (data.view):

      owner    el dueño (y root): el tablero de la empresa. Si no esta al
               corriente (Plan::state()) aqui se entera de por que y cuanto
               debe, y sus modulos salen con candado.
      modules  todos los demas: solo sus modulos, para entrar a trabajar. */
class ctrl extends mdl {
    const OPS = ['init', 'checkout'];

    // El modulo de donde salen las cifras del dia (modules.code).
    const POS_MODULE = 'pedidos';

    // Dias hacia atras en que se buscan entregas atrasadas y dias sin cierre.
    const LATE_DAYS = 7;
    const CUT_DAYS  = 15;

    function init() {
        $companyId = Plan::companyId();

        // Viene de regreso de pagar: se le pregunta a Stripe por esa sesion y,
        // si esta pagada, se activa ANTES de leer el estado del plan.
        $paid = false;

        if (!empty($_POST['session_id'])) {
            $sub  = (new Billing(4))->reconcile($_POST['session_id']);
            $paid = $sub && (int) $sub['company_id'] === $companyId;
        }

        $company   = $this->getCompanyById([$companyId]);

        if (!$company) {
            return ['status' => 404, 'message' => 'Tu empresa ya no existe. Contacta a soporte.'];
        }

        $user  = $this->getUserById([Session::user()]);
        $state = Plan::state();

        $data = [
            'view' => $this->isOwner() ? 'owner' : 'modules',
            'user' => [
                'name'    => trim((string) $user['name']) ?: $_SESSION['user'],
                'full'    => trim($user['name'] . ' ' . $user['last_name']),
                'rol'     => $_SESSION['rol'],
                'photo'   => userPhotoUrl($user['photo'], 4),
                'color'   => $user['color'] ?: '',
                'branch'  => $_SESSION['branch'],
                // root no es de la empresa: la esta viendo como su dueño.
                'viewing' => !empty($_SESSION['is_root']) ? 1 : 0,
            ],
            'modules' => $this->modules($state),
        ];

        // Quien no es dueño solo ve sus modulos: no se le manda el resto del
        // tablero (precios, cumpleaños). Del plan, si sus modulos
        // abren; del dueño, a quien avisarle si no.
        if ($data['view'] === 'modules') {
            $owner = $this->getOwnerByCompany([$companyId]);

            $data['plan']  = ['ok' => $state['ok'] ? 1 : 0];
            $data['owner'] = $owner ? ['name' => $owner['name']] : null;

            return ['status' => 200, 'data' => $data];
        }

        $data['company'] = [
            'name'      => $company['name'],
            'ubication' => $company['ubication'] ?: '',
            'rfc'       => (string) $company['rfc'],
            'logo'      => companyLogoUrl($company['logo'], 4),
            'status'    => $company['status'],
            'branches'  => (int) $company['branches'],
            'users'     => (int) $company['users'],
        ];
        $data['paid']          = $paid ? 1 : 0;
        $data['plan']          = $this->plan($state);
        $data['owner']         = $this->owner($companyId);
        $data['business']      = $this->business($companyId);
        $data['attention']     = $this->attention($data['business'], $company);
        $data['shortcuts']     = $this->shortcuts();
        $data['birthdays']     = $this->people($this->listBirthdaysByCompany([$companyId]));
        $data['anniversaries'] = $this->people($this->listAnniversariesByCompany([$companyId]));

        return ['status' => 200, 'data' => $data];
    }

    /*  El inicio completo (empresa, plan, equipo) es del dueño. root entra a
        una empresa como su dueño (app/empresas pone is_owner), asi que tambien
        lo ve. Los demas ven solo sus modulos. */
    private function isOwner() {
        return !empty($_SESSION['is_owner']) || !empty($_SESSION['is_root']);
    }

    /*  "Pagar ahora": manda al dueño a la pagina de pago de Stripe con la
        suscripcion de su empresa. Al volver, init() la concilia. */
    function checkout() {
        if (!$this->canPay(Plan::state())) {
            return ['status' => 403, 'message' => 'El pago en línea no está disponible para tu cuenta. Contáctanos.'];
        }

        $billing = new Billing(4);

        list($url, $error) = $billing->checkout(
            $billing->currentSubscriptionId(Plan::companyId()),
            $billing->url . 'app/home/?session_id={CHECKOUT_SESSION_ID}',
            $billing->url . 'app/home/'
        );

        return $error
             ? ['status' => 502, 'message' => $error]
             : ['status' => 200, 'url' => $url];
    }

    /*  ¿Se le ofrece pagar en linea? Al dueño, con una suscripcion por cobrar
        y con Stripe configurado. Tambien a una empresa suspendida o cancelada:
        pagar la reactiva (Billing::activate). */
    private function canPay($state) {
        return !$state['ok']
            && $state['sub'] !== null
            && !empty($_SESSION['is_owner'])
            && Stripe::ready();
    }

    /*  El plan, y si no deja operar, por que. reason es el mismo de
        Plan::state(): company (la empresa no esta activa), none (sin plan),
        trial (la prueba termino), subscription (el pago no esta al corriente). */
    private function plan($state) {
        $sub = $state['sub'];

        return [
            'ok'       => $state['ok'] ? 1 : 0,
            'can_pay'  => $this->canPay($state) ? 1 : 0,
            'reason'   => $state['reason'],
            'name'     => $sub ? $sub['plan'] : '',
            'status'   => $sub ? $sub['status'] : '',
            'price'    => $sub ? $this->price($sub) : null,
            'currency' => $sub ? $sub['currency'] : 'MXN',
            'cycle'    => $sub ? $sub['cycle'] : '',
            // Fecha cruda (Y-m-d): la escribe en español el navegador (Page.date).
            'next'     => $sub && $sub['next'] ? substr($sub['next'], 0, 10) : '',
            // Solo en prueba: su ultimo dia y cuantos le quedan (negativo = ya termino).
            'trial_end'  => $sub ? $sub['trial_end'] : null,
            'trial_left' => $sub ? $sub['trial_left'] : null,
        ];
    }

    // El Personalizado no tiene precio fijo: es la suma de lo que se contrato,
    // al precio con el que se contrato (subscription_module.price).
    private function price($sub) {
        if ($sub['price'] !== null) return $sub['price'];

        return $sub['mode'] === 'custom' ? $this->getSubscriptionTotal([$sub['id']]) : null;
    }

    /*  Mi perfil y Configuración del dueño, como tarjetas junto a sus modulos:
        el rail ya no los trae (ctrl-nav :: extras). Abren aunque la empresa no
        este al corriente: ahi se paga. root los conserva en el rail. */
    private function shortcuts() {
        if (empty($_SESSION['is_owner']) || !empty($_SESSION['is_root'])) return [];

        return [
            ['code' => 'perfil', 'name' => 'Mi perfil', 'icon' => 'user-round', 'text' => 'Tus datos, tu foto y tu contraseña.', 'route' => 'app/perfil/', 'locked' => 0, 'submodules' => []],
            ['code' => 'configuracion', 'name' => 'Configuración', 'icon' => 'settings', 'text' => 'Empresa, sucursales, usuarios, roles y plan.', 'route' => 'app/configuracion/', 'locked' => 0, 'submodules' => []],
        ];
    }

    private function modules($state) {
        $modules = [];

        foreach (Permission::modules() as $module) {
            $cards = Permission::submodules($module['id']);

            $modules[] = [
                'code'   => (string) $module['code'],
                'name'   => $module['name'],
                'icon'   => $module['icon'] ?: 'layout-grid',
                'text'   => $module['description'] ?: '',
                // Con varios submodulos la tarjeta abre las de ellos (?module=code).
                'route'  => Permission::entry($module),
                'locked' => $state['ok'] ? 0 : 1,
                // Solo cuando hay de donde elegir: con uno, route ya entra a el.
                'submodules' => count($cards) > 1 ? $cards : [],
            ];
        }

        return $modules;
    }

    /*  EL NEGOCIO DE HOY, de toda la empresa y por sucursal. null si la
        empresa no tiene Punto de venta o no esta al corriente: no hay cifras
        que enseñar.

        Hoy se compara contra el mismo dia de la semana pasada y HASTA ESTA
        HORA (un sabado a mediodia contra el sabado pasado a mediodia): contra
        ayer, o contra el dia completo, la comparacion no dice nada. */
    private function business($companyId) {
        $moduleId = Permission::moduleId(self::POS_MODULE);

        if ($moduleId === 0 || !Plan::allows($moduleId, self::POS_MODULE)) return null;

        $today     = date('Y-m-d');
        $tomorrow  = date('Y-m-d', strtotime('+1 day'));
        $yesterday = date('Y-m-d', strtotime('-1 day'));
        $weekAgo   = date('Y-m-d', strtotime('-7 days'));
        $weekNow   = date('Y-m-d H:i:s', strtotime('-7 days'));
        $lateFrom  = date('Y-m-d', strtotime('-' . self::LATE_DAYS . ' days'));
        $cutFrom   = date('Y-m-d', strtotime('-' . self::CUT_DAYS . ' days'));

        $sales    = $this->byBranch($this->listSalesByBranch([$companyId, $today, $tomorrow]));
        $paid     = $this->byBranch($this->listPaidByBranch([$companyId, $today, $tomorrow]));
        $deliver  = $this->byBranch($this->listDeliveriesByBranch([$companyId, $today, $today]));
        $late     = $this->byBranch($this->listDeliveriesByBranch([$companyId, $lateFrom, $yesterday]));
        $turns    = $this->byBranch($this->listOpenTurnsByBranch([$companyId]));
        $unclosed = $this->byBranch($this->listUnclosedDaysByBranch([$companyId, $cutFrom, $today]));

        $branches = [];
        $sum      = ['sold' => 0.0, 'paid' => 0.0, 'tickets' => 0, 'to_deliver' => 0, 'deliveries' => 0, 'due' => 0.0, 'due_orders' => 0, 'late' => 0];

        foreach ($this->listBranchesByCompany([$companyId]) as $branch) {
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

        foreach ($this->listSalesByBranch([$companyId, $weekAgo, $weekNow]) as $row) {
            $before['sold']    += (float) $row['sold'];
            $before['tickets'] += (int) $row['tickets'];
        }

        foreach ($this->listPaidByBranch([$companyId, $weekAgo, $weekNow]) as $row) $before['paid'] += (float) $row['paid'];

        return [
            'today'    => array_map(function ($value) { return is_float($value) ? round($value, 2) : $value; }, $sum),
            'before'   => ['sold' => round($before['sold'], 2), 'paid' => round($before['paid'], 2), 'tickets' => $before['tickets']],
            'branches' => $branches,
            'activity' => array_map(function ($row) {
                return [
                    'type'   => (string) $row['type'],
                    'text'   => (string) $row['action'],
                    'folio'  => (string) $row['folio'],
                    'branch' => $row['branch'],
                    'user'   => (string) $row['user'],
                    'at'     => (string) $row['created_at'],
                ];
            }, $this->listActivityByCompany([$companyId])),
        ];
    }

    private function byBranch($rows) {
        $map = [];

        foreach ($rows as $row) $map[(int) $row['branch_id']] = $row;

        return $map;
    }

    /*  REQUIERE TU ATENCION: lo que el dueño tiene que saber o mandar hacer
        hoy, cada cosa con a donde ir (rutas relativas a pro/). Vacio = todo en
        orden. Las pantallas de Punto de venta trabajan sobre la sucursal
        activa, por eso cada aviso nombra a las suyas. */
    private function attention($business, $company) {
        $items = [];

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
                    'route' => 'app/order/pedidos.php',
                    'go'    => 'Ver pedidos',
                ];
            }

            if ($sum['late'] > 0) {
                $items[] = [
                    'icon'  => 'alarm-clock',
                    'title' => $this->count($sum['late'], 'pedido atrasado', 'pedidos atrasados') . ' o sin marcar como entregado',
                    'text'  => trim('Su entrega era en los últimos ' . self::LATE_DAYS . ' días. ' . $this->perBranch($business['branches'], 'late')),
                    'route' => 'app/order/pedidos.php',
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

        if (trim((string) $company['rfc']) === '') {
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

    private function owner($companyId) {
        $owner = $this->getOwnerByCompany([$companyId]);
        if (!$owner) return null;

        return [
            'name'  => $owner['name'],
            'email' => $owner['email'],
            'phone' => $owner['phone'] ?: '',
            'photo' => userPhotoUrl($owner['photo'], 4),
            'color' => $owner['color'] ?: '',
            'me'    => (int) $owner['id'] === Session::user() ? 1 : 0,
        ];
    }

    private function people($rows) {
        return array_map(function ($row) {
            return [
                'name'   => $row['name'],
                'photo'  => userPhotoUrl($row['photo'] ?? '', 4),
                'color'  => $row['color'] ?: '',
                'job'    => $row['job_title'] ?? '',
                'branch' => $row['branch'] ?? '',
                'day'    => isset($row['day']) ? (int) $row['day'] : 0,
                'today'  => !empty($row['today']) ? 1 : 0,
                'years'  => isset($row['years']) ? (int) $row['years'] : 0,
            ];
        }, $rows);
    }
}

if (!in_array($_POST['opc'], ctrl::OPS, true)) exit(0);

header('Content-Type: application/json; charset=utf-8');

if (Session::user() === null) {
    echo json_encode(['status' => 401, 'message' => 'Tu sesión terminó. Vuelve a iniciar sesión.']);
    exit(0);
}

if (Plan::companyId() === 0) {
    echo json_encode(['status' => 409, 'message' => 'Elige primero una empresa.']);
    exit(0);
}

// Solo lee la sesion: se suelta para no formar en fila a la barra y al rail.
session_write_close();

$obj = new ctrl();
echo json_encode($obj->{$_POST['opc']}());
