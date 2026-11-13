<?php
require_once __DIR__ . '/../../../core/security/_Session.php';
if (empty($_POST['opc'])) exit(0);

require_once __DIR__ . '/../mdl/mdl-home.php';
require_once __DIR__ . '/../../../core/security/_Permission.php';
require_once __DIR__ . '/../../../core/helpers/_CoffeeSoft.php';
require_once __DIR__ . '/../../../core/billing/_Billing.php';

/*  EL INICIO DE UNA EMPRESA.

    Es la unica pagina que ve cualquiera con sesion, este como este su empresa:
    no pasa por Permission::page(). Si la empresa no esta al corriente
    (Plan::state()) aqui es donde se entera: el inicio le dice por que y cuanto
    debe, y sus modulos salen con candado. */
class ctrl extends mdl {
    const OPS = ['init', 'checkout'];

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

        return [
            'status' => 200,
            'data'   => [
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
                'company' => [
                    'name'      => $company['name'],
                    'ubication' => $company['ubication'] ?: '',
                    'status'    => $company['status'],
                    'branches'  => (int) $company['branches'],
                    'users'     => (int) $company['users'],
                ],
                'paid'          => $paid ? 1 : 0,
                'plan'          => $this->plan($state),
                'modules'       => $this->modules($state),
                'owner'         => $this->owner($companyId),
                'team'          => [
                    'total'  => $this->getTeamCount([$companyId]),
                    'people' => $this->people($this->listTeamByCompany([$companyId])),
                ],
                'birthdays'     => $this->people($this->listBirthdaysByCompany([$companyId])),
                'anniversaries' => $this->people($this->listAnniversariesByCompany([$companyId])),
            ]
        ];
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

    private function modules($state) {
        $modules = [];

        foreach (Permission::modules() as $module) {
            $modules[] = [
                'name'   => $module['name'],
                'icon'   => $module['icon'] ?: 'layout-grid',
                'text'   => $module['description'] ?: '',
                'route'  => trim((string) $module['route']),
                'locked' => $state['ok'] ? 0 : 1,
            ];
        }

        return $modules;
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
