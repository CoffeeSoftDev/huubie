<?php
require_once __DIR__ . '/../../../core/security/_Session.php';
if (empty($_POST['opc'])) exit(0);

require_once __DIR__ . '/core-order.php';
require_once __DIR__ . '/../mdl/mdl-tienda.php';

/*  Ventas › Tienda en linea (V8 del plan de Ventas): la pagina interna.

    Reglas que no se ven en el codigo de un vistazo:
      - La seccion es pos-ecommerce (show, update). Con show se ve la tienda y
        la bandeja; con update se configura, se eligen productos y se aceptan o
        rechazan los pedidos que llegan.
      - Una tienda por sucursal. La primera vez que alguien con update abre la
        pagina se crea apagada y con su enlace (token de 16 letras).
      - El enlace publico es app/order/pedir.php?t=<token>. «Nuevo enlace»
        cambia el token: el anterior deja de abrir.
      - Aceptar pasa la venta de tipo 4 (E-commerce) a tipo 1 (Pedido) y la
        cuelga del turno abierto de hoy, como cualquier pedido que se crea: por
        eso pide turno. Sigue en Cotizacion hasta que se cobre en Pedidos.
      - Rechazar (queda Cancelado y tipo 4) solo mientras no se acepta y sin
        abonos. Ya aceptado es un pedido como cualquier otro: se cancela en
        Pedidos con sus reglas, y en la bandeja sale «Cancelado en Pedidos».
      - El switch «En tienda» de un producto de la Matriz vale para todas las
        sucursales que lo comparten (product.in_catalog es del producto). */
class ctrl extends core {

    use OnlineStore;

    const STORE       = 'pos-ecommerce';
    const MAX_TITLE   = 80;
    const MAX_MESSAGE = 255;
    const MAX_BANK    = 500;
    const MAX_REASON  = 200;
    const MAX_LEAD    = 30;
    const ACCENT      = '#233876';

    // -- Arranque --

    public function init() {
        $scope = $this->scope();

        return [
            'status'  => 200,
            'scope'   => ['company' => $scope['company'], 'branch' => $scope['branch']],
            'actions' => $this->actions(),
            'store'   => Permission::actions(self::STORE),
            'accent'  => self::ACCENT,
            'tickets' => Permission::actions(self::TICKETS),
            'today'   => date('Y-m-d'),
            'turn'    => $this->turnBrief(),
            'day'     => $this->dayBrief()
        ];
    }

    // -- Tienda --

    /*  La tienda de la sucursal con sus cifras. Si no existe y el rol puede
        configurarla, se crea apagada. Sin update y sin tienda: store = null. */
    public function getStore() {
        $fail = $this->needStore('show') ?: $this->needBranch();
        if ($fail) return $fail;

        return $this->attempt(function () {
            $store = $this->qStore($this->branchId());

            if (!$store && Permission::can(self::STORE, 'update')) {
                $store = $this->transaction(function () {
                    $again = $this->qStore($this->branchId());
                    if ($again) return $again;

                    $this->must($this->qCreateStore([
                        'values' => ['branch_id', 'active', 'token', 'pickup', 'delivery', 'pay_transfer', 'pay_store', 'lead_days'],
                        'data'   => [$this->branchId(), 0, $this->freshToken(), 1, 0, 1, 1, 1]
                    ]), 'getStore');

                    return $this->qStore($this->branchId());
                });
            }

            [$from, $to] = $this->dayRange(date('Y-m-d'));

            $counts   = $this->qWebOrderCounts($this->branchId(), $from, $to);
            $products = $this->qStoreProducts($this->companyId(), $this->branchId(), $this->mainBranchId(), true);

            return [
                'status'   => 200,
                'branch'   => $this->scope()['branch'],
                'company'  => $this->scope()['company'],
                'store'    => $store ? $this->storeRow($store) : null,
                'counts'   => [
                    'pending'  => (int) $counts['pending'],
                    'today'    => (int) $counts['today'],
                    'accepted' => (int) $counts['accepted'],
                    'products' => count($products)
                ]
            ];
        }, 'No se pudo abrir la tienda en línea.');
    }

    public function saveStore() {
        $fail = $this->needStore('update') ?: $this->needBranch();
        if ($fail) return $fail;

        list($fail, $in) = $this->storeFields();
        if ($fail) return $fail;

        return $this->attempt(function () use ($in) {
            return $this->transaction(function () use ($in) {
                $store = $this->qStore($this->branchId());

                if (!$store) return $this->fail(404, 'La tienda de esta sucursal no existe. Recarga la página.');

                $this->must($this->qUpdateStore([
                    'values' => ['title', 'message', 'whatsapp', 'accent', 'bank_info', 'pickup', 'delivery', 'pay_transfer', 'pay_store', 'lead_days', 'updated_at = NOW()'],
                    'where'  => ['id'],
                    'data'   => [
                        $in['title'], $in['message'], $in['whatsapp'], $in['accent'], $in['bank_info'],
                        $in['pickup'], $in['delivery'], $in['pay_transfer'], $in['pay_store'], $in['lead_days'],
                        (int) $store['id']
                    ]
                ]), 'saveStore');

                return $this->ok('Tienda guardada.');
            });
        }, 'No se pudo guardar la tienda.');
    }

    // Abre o cierra la tienda. Cerrada, el enlace muestra «Tienda cerrada» y no recibe pedidos.
    public function toggleStore() {
        $fail = $this->needStore('update') ?: $this->needBranch();
        if ($fail) return $fail;

        $active = $this->post('active') === '1' ? 1 : 0;

        return $this->attempt(function () use ($active) {
            return $this->transaction(function () use ($active) {
                $store = $this->qStore($this->branchId());

                if (!$store) return $this->fail(404, 'La tienda de esta sucursal no existe. Recarga la página.');

                $this->must($this->qUpdateStore([
                    'values' => ['active', 'updated_at = NOW()'],
                    'where'  => ['id'],
                    'data'   => [$active, (int) $store['id']]
                ]), 'toggleStore');

                if ($active === 0) return $this->ok('Tienda cerrada. El enlace ya no recibe pedidos.');

                $products = $this->qStoreProducts($this->companyId(), $this->branchId(), $this->mainBranchId(), true);

                if (!$products) return $this->ok('Tienda abierta, pero sin productos: elige cuáles salen en la pestaña «Productos».');

                return $this->ok('Tienda abierta. Ya puedes compartir el enlace.');
            });
        }, 'No se pudo cambiar la tienda.');
    }

    // Cambia el token. Quien tenga el enlace anterior ve «enlace no válido».
    public function newStoreLink() {
        $fail = $this->needStore('update') ?: $this->needBranch();
        if ($fail) return $fail;

        return $this->attempt(function () {
            return $this->transaction(function () {
                $store = $this->qStore($this->branchId());

                if (!$store) return $this->fail(404, 'La tienda de esta sucursal no existe. Recarga la página.');

                $token = $this->freshToken();

                $this->must($this->qUpdateStore([
                    'values' => ['token', 'updated_at = NOW()'],
                    'where'  => ['id'],
                    'data'   => [$token, (int) $store['id']]
                ]), 'newStoreLink');

                return $this->ok('Enlace nuevo listo. El anterior ya no abre la tienda.', ['link' => $this->storeLink($token)]);
            });
        }, 'No se pudo cambiar el enlace.');
    }

    // -- Productos --

    public function lsStoreProducts() {
        $fail = $this->needStore('show') ?: $this->needBranch();
        if ($fail) return $fail;

        $filter = $this->post('state', 'all');

        return $this->attempt(function () use ($filter) {
            $canEdit    = Permission::can(self::STORE, 'update');
            $mainId     = $this->mainBranchId();
            $isMain     = $mainId === $this->branchId();
            $rows       = [];
            $categories = [];
            $inStore    = 0;

            foreach ($this->qStoreProducts($this->companyId(), $this->branchId(), $mainId) as $p) {
                $on = (int) $p['in_catalog'] === 1;

                if ($on) $inStore++;

                $category = trim((string) $p['category']) !== '' ? $p['category'] : 'Sin categoría';
                $categories[$category] = true;

                if ($filter === 'on' && !$on)  continue;
                if ($filter === 'off' && $on)  continue;

                $rows[] = $this->productRow($p, $on, $canEdit, !$isMain && (int) $p['branch_id'] === $mainId, $category);
            }

            $options = [];
            foreach (array_keys($categories) as $name) $options[] = ['id' => $name, 'valor' => $name];

            return [
                'status'     => 200,
                'row'        => $rows,
                'count'      => count($rows),
                'in_store'   => $inStore,
                'categories' => $options,
                'branch'     => $this->scope()['branch']
            ];
        }, 'No se pudo cargar la lista de productos.');
    }

    /*  Prende o apaga «En tienda» de uno o varios productos. Solo los del
        catalogo de esta sucursal (los suyos y los de la Matriz que comparte). */
    public function setStoreProducts() {
        $fail = $this->needStore('update') ?: $this->needBranch();
        if ($fail) return $fail;

        $ids = $this->postedJson('ids');
        $on  = $this->post('on') === '1' ? 1 : 0;

        if (!$ids) return $this->fail(422, 'Elige al menos un producto.');

        $ids = array_values(array_unique(array_filter(array_map('intval', $ids), function ($id) { return $id > 0; })));

        if (!$ids)              return $this->fail(422, 'Elige al menos un producto.');
        if (count($ids) > 500)  return $this->fail(422, 'Son demasiados productos a la vez. Filtra la lista y vuelve a intentar.');

        return $this->attempt(function () use ($ids, $on) {
            return $this->transaction(function () use ($ids, $on) {
                $allowed = array_map('intval', array_column(
                    $this->qStoreProducts($this->companyId(), $this->branchId(), $this->mainBranchId()), 'id'
                ));

                $foreign = array_diff($ids, $allowed);

                if ($foreign) return $this->fail(404, 'Algún producto ya no está en el catálogo de esta sucursal. Recarga la lista.');

                $this->must($this->qSetInCatalog($ids, $on), 'setStoreProducts');

                $count = count($ids);
                $what  = $count === 1 ? 'El producto' : "{$count} productos";

                return $this->ok($on === 1 ? "{$what} ya sale" . ($count === 1 ? '' : 'n') . ' en la tienda.' : "{$what} ya no sale" . ($count === 1 ? '' : 'n') . ' en la tienda.');
            });
        }, 'No se pudo cambiar el producto.');
    }

    // -- Pedidos que llegan --

    public function lsWebOrders() {
        $fail = $this->needStore('show') ?: $this->needBranch();
        if ($fail) return $fail;

        $state = $this->post('state', 'new');
        if (!in_array($state, ['new', 'accepted', 'cancelled', 'all'], true)) $state = 'new';

        [$from, $to] = $this->periodRange($state === 'new' ? 'all' : $this->post('period', '30'));

        return $this->attempt(function () use ($state, $from, $to) {
            $canEdit = Permission::can(self::STORE, 'update');
            $rows    = [];
            $links   = [];

            foreach ($this->qWebOrders($this->branchId(), $state, $from, $to) as $o) {
                $rows[] = $this->orderRow($o, $canEdit);

                $links[(int) $o['id']] = $this->waLink($o['phone'], $this->waHello($o, $this->webState($o)));
            }

            // wa va aparte: cada clave de una fila es una columna de la tabla.
            return [
                'status' => 200,
                'row'    => $rows,
                'count'  => count($rows),
                'wa'     => (object) $links,
                'branch' => $this->scope()['branch']
            ];
        }, 'No se pudo cargar la bandeja de pedidos.');
    }

    public function getWebOrder() {
        $fail = $this->needStore('show') ?: $this->needBranch();
        if ($fail) return $fail;

        $id = $this->postId();

        return $this->attempt(function () use ($id) {
            $o = $id > 0 ? $this->qWebOrder($id, $this->branchId()) : null;

            if (!$o) return $this->fail(404, 'Ese pedido de la tienda no es de esta sucursal o ya no existe.');

            $lines = array_map(function ($l) {
                return [
                    'name'     => (string) $l['name'],
                    'details'  => (string) $l['details'],
                    'price'    => round((float) $l['price'], 2),
                    'quantity' => round((float) $l['quantity'], 2),
                    'image'    => (string) $l['image']
                ];
            }, $this->qOrderLines($id));

            $state   = $this->webState($o);
            $canEdit = Permission::can(self::STORE, 'update');

            return [
                'status' => 200,
                'row'    => [
                    'id'            => (int) $o['id'],
                    'folio'         => 'P' . $o['folio'],
                    'state'         => $state,
                    'rejected'      => $state === 'cancelled' && (int) $o['sale_type_id'] === 4,
                    'status'        => (string) $o['status'],
                    'customer'      => (string) $o['customer_name'],
                    'phone'         => (string) $o['phone'],
                    'email'         => (string) $o['email'],
                    'delivery'      => $o['delivery'] === 'delivery' ? 'Envío a domicilio' : 'Recoge en tienda',
                    'address'       => (string) $o['location'],
                    'date'          => dmy($o['delivery_date']),
                    'time'          => hour12($o['delivery_time']),
                    'payment'       => $this->paymentText($o['payment']),
                    'note'          => (string) $o['note'],
                    'cancel_reason' => (string) $o['cancel_reason'],
                    'total'         => round((float) $o['total'], 2),
                    'paid'          => round((float) $o['paid'], 2),
                    'created'       => dmy($o['created_at']) . ' ' . hour12(substr((string) $o['created_at'], 11, 8)),
                    'lines'         => $lines,
                    'can_accept'    => $canEdit && $state === 'new',
                    'can_cancel'    => $canEdit && $state === 'new' && (float) $o['paid'] <= 0,
                    'wa'            => $this->waLink($o['phone'], $this->waHello($o, $state))
                ]
            ];
        }, 'No se pudo abrir el pedido.');
    }

    /*  Acepta: tipo 4 → tipo 1, del turno abierto de hoy y de quien acepta.
        Valida despues del FOR UPDATE: dos clics no lo aceptan dos veces. */
    public function acceptWebOrder() {
        $fail = $this->needStore('update', 'aceptar pedidos de la tienda') ?: $this->needBranch();
        if ($fail) return $fail;

        $fail = $this->needTurn();
        if ($fail) return $fail;

        $id = $this->postId();
        if ($id <= 0) return $this->fail(422, 'Falta el pedido.');

        return $this->attempt(function () use ($id) {
            return $this->transaction(function () use ($id) {
                $order = $this->qLockWebOrder($id, $this->branchId());

                if (!$order) return $this->fail(404, 'Ese pedido de la tienda no es de esta sucursal o ya no existe.');

                if ((int) $order['sale_status_id'] === self::CANCELLED) return $this->fail(409, 'El pedido ya se rechazó o se canceló: no se puede aceptar.');
                if ((int) $order['sale_type_id'] !== 4)                 return $this->fail(409, "El pedido P{$id} ya se aceptó. Está en Pedidos.");

                $turn = $this->qOpenTurn($this->branchId());
                if (!$turn) return $this->fail(423, 'Abre un turno de caja en esta sucursal antes de aceptar pedidos.');

                $this->must($this->qUpdateOrder([
                    'values' => ['sale_type_id', 'turn_id', 'user_id', 'updated_at = NOW()'],
                    'where'  => ['id'],
                    'data'   => [1, (int) $turn['id'], $this->userId() ?: null, $id]
                ]), 'acceptWebOrder');

                $this->log($id, 'event', 'Pedido de la tienda aceptado',
                    'Aceptado desde Tienda en línea el ' . date('d/m/Y') . ' a las ' . hour12(date('H:i:s')) . ' (turno ' . $turn['folio'] . ').');

                $o = $this->qWebOrder($id, $this->branchId());

                return $this->ok("Pedido P{$id} aceptado. Ya está en Pedidos como cotización.", [
                    'id' => $id,
                    'wa' => $o ? $this->waLink($o['phone'], $this->waHello($o, 'accepted')) : ''
                ]);
            });
        }, 'No se pudo aceptar el pedido.');
    }

    // Rechaza un pedido que todavia no se acepta. Pide motivo: queda en la bitacora y se le puede mandar al cliente.
    public function cancelWebOrder() {
        $fail = $this->needStore('update', 'rechazar pedidos de la tienda') ?: $this->needBranch();
        if ($fail) return $fail;

        $id     = $this->postId();
        $reason = trim((string) preg_replace('/\s+/u', ' ', $this->post('reason')));

        if ($id <= 0)                                 return $this->fail(422, 'Falta el pedido.');
        if ($reason === '')                           return $this->fail(422, 'Escribe por qué no se puede atender el pedido.');
        if ($this->tooLong($reason, self::MAX_REASON)) return $this->fail(422, 'El motivo admite hasta ' . self::MAX_REASON . ' caracteres.');

        return $this->attempt(function () use ($id, $reason) {
            return $this->transaction(function () use ($id, $reason) {
                $order = $this->qLockWebOrder($id, $this->branchId());

                if (!$order) return $this->fail(404, 'Ese pedido de la tienda no es de esta sucursal o ya no existe.');

                if ((int) $order['sale_status_id'] === self::CANCELLED) return $this->fail(409, (int) $order['sale_type_id'] === 4 ? 'El pedido ya está rechazado.' : 'El pedido ya se canceló en Pedidos.');
                if ((int) $order['sale_type_id'] !== 4)                 return $this->fail(409, "El pedido P{$id} ya se aceptó: cancélalo desde Pedidos.");
                if ((float) $order['paid'] > 0)                         return $this->fail(409, 'Tiene abonos por ' . money($order['paid']) . ': cancélalo desde Pedidos para dejar el saldo a favor.');

                $this->must($this->qUpdateOrder([
                    'values' => ['sale_status_id', 'cancel_reason', 'cancelled_at = NOW()', 'cancel_user_id', 'updated_at = NOW()'],
                    'where'  => ['id'],
                    'data'   => [self::CANCELLED, $reason, $this->userId() ?: null, $id]
                ]), 'cancelWebOrder');

                $this->log($id, 'cancellation', 'Pedido de la tienda rechazado', 'Motivo: ' . $reason);

                $o = $this->qWebOrder($id, $this->branchId());

                return $this->ok("Pedido P{$id} rechazado.", [
                    'id' => $id,
                    'wa' => $o ? $this->waLink($o['phone'], $this->waHello($o, 'cancelled')) : ''
                ]);
            });
        }, 'No se pudo rechazar el pedido.');
    }

    // -- Complements --

    private function needStore($action, $text = null) {
        if (Permission::can(self::STORE, $action)) return null;

        $what = [
            'show'   => 'ver la tienda en línea',
            'update' => 'configurar la tienda en línea'
        ];

        if ($text === null) $text = isset($what[$action]) ? $what[$action] : 'hacer esto';

        return ['status' => 403, 'message' => "Tu rol no tiene permiso para {$text} en esta sucursal.", 'row' => []];
    }

    // 16 letras hexadecimales que ninguna otra tienda usa.
    private function freshToken() {
        for ($i = 0; $i < 5; $i++) {
            $token = bin2hex(random_bytes(8));

            if (!$this->qStoreTokenTaken($token)) return $token;
        }

        throw new RuntimeException('freshToken: sin token libre');
    }

    // El enlace publico, armado como el del ticket: este archivo vive en app/order/ctrl/.
    private function storeLink($token) {
        $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
              || strtolower((string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https';
        $host  = (string) ($_SERVER['HTTP_HOST'] ?? 'localhost');
        $base  = rtrim(str_replace('\\', '/', dirname(dirname((string) ($_SERVER['SCRIPT_NAME'] ?? '/')))), '/');

        return ($https ? 'https' : 'http') . '://' . $host . $base . '/pedir.php?t=' . rawurlencode($token);
    }

    private function storeRow($s) {
        return [
            'active'       => (int) $s['active'],
            'link'         => $this->storeLink($s['token']),
            'title'        => (string) $s['title'],
            'message'      => (string) $s['message'],
            'whatsapp'     => (string) $s['whatsapp'],
            'accent'       => $s['accent'] !== '' ? (string) $s['accent'] : self::ACCENT,
            'bank_info'    => (string) $s['bank_info'],
            'pickup'       => (int) $s['pickup'],
            'delivery'     => (int) $s['delivery'],
            'pay_transfer' => (int) $s['pay_transfer'],
            'pay_store'    => (int) $s['pay_store'],
            'lead_days'    => (int) $s['lead_days']
        ];
    }

    /*  [respuesta de error | null, campos limpios]. WhatsApp: 10 digitos (se
        aceptan espacios y guiones). Color: #RRGGBB; el azul de Huubie se guarda NULL. */
    private function storeFields() {
        $flag  = function ($key) { return $this->post($key) === '1' ? 1 : 0; };
        $clean = function ($key) { return trim((string) preg_replace('/[ \t]+/u', ' ', $this->post($key))); };
        $bad   = function ($text) { return [$this->fail(422, $text), null]; };

        $title    = $clean('title');
        $message  = $clean('message');
        $bank     = trim(str_replace("\r", '', $this->post('bank_info')));
        $whatsapp = preg_replace('/[\s\-().]/', '', $this->post('whatsapp'));
        $accent   = strtoupper(trim($this->post('accent')));
        $lead     = $this->intOf($this->post('lead_days', '1'));

        if ($this->tooLong($title, self::MAX_TITLE))     return $bad('El nombre de la tienda admite hasta ' . self::MAX_TITLE . ' caracteres.');
        if ($this->tooLong($message, self::MAX_MESSAGE)) return $bad('El mensaje de bienvenida admite hasta ' . self::MAX_MESSAGE . ' caracteres.');
        if ($this->tooLong($bank, self::MAX_BANK))       return $bad('Los datos de transferencia admiten hasta ' . self::MAX_BANK . ' caracteres.');

        if ($whatsapp !== '' && !preg_match('/^\d{10}$/', $whatsapp)) return $bad('El WhatsApp de la sucursal va a 10 dígitos, sin lada de país.');
        if ($accent !== '' && !preg_match('/^#[0-9A-F]{6}$/', $accent)) return $bad('El color va como # y 6 letras o números, por ejemplo ' . self::ACCENT . '.');
        if ($lead === null || $lead < 0 || $lead > self::MAX_LEAD)    return $bad('La anticipación va de 0 a ' . self::MAX_LEAD . ' días.');

        $in = [
            'title'        => $title === '' ? null : $title,
            'message'      => $message === '' ? null : $message,
            'whatsapp'     => $whatsapp === '' ? null : $whatsapp,
            'accent'       => ($accent === '' || $accent === self::ACCENT) ? null : $accent,
            'bank_info'    => $bank === '' ? null : $bank,
            'pickup'       => $flag('pickup'),
            'delivery'     => $flag('delivery'),
            'pay_transfer' => $flag('pay_transfer'),
            'pay_store'    => $flag('pay_store'),
            'lead_days'    => $lead
        ];

        if (!$in['pickup'] && !$in['delivery'])        return $bad('Deja al menos una forma de entrega: recoger en tienda o envío a domicilio.');
        if (!$in['pay_transfer'] && !$in['pay_store']) return $bad('Deja al menos una forma de pago: transferencia o pago en tienda.');
        if ($in['pay_transfer'] && $in['bank_info'] === null) return $bad('Con transferencia, escribe los datos de la cuenta: el cliente los ve al terminar su pedido.');

        return [null, $in];
    }

    // 'new' por aceptar, 'accepted' ya en Pedidos, 'cancelled'.
    private function webState($o) {
        if ((int) $o['sale_status_id'] === self::CANCELLED) return 'cancelled';

        return (int) $o['sale_type_id'] === 4 ? 'new' : 'accepted';
    }

    // Periodo del filtro → [desde, hasta) sobre la fecha en que llego el pedido.
    private function periodRange($period) {
        $tomorrow = date('Y-m-d', strtotime('+1 day')) . ' 00:00:00';
        $days     = ['today' => 0, '7' => 6, '30' => 29];

        if (!isset($days[$period])) return ['2000-01-01 00:00:00', $tomorrow];

        return [date('Y-m-d', strtotime('-' . $days[$period] . ' days')) . ' 00:00:00', $tomorrow];
    }

    private function paymentText($payment) {
        return $payment === 'transfer' ? 'Transferencia' : 'Paga en tienda';
    }

    // https://wa.me/52XXXXXXXXXX?text=... o '' sin telefono valido.
    private function waLink($phone, $text) {
        $digits = substr(preg_replace('/\D/', '', (string) $phone), -10);

        if (strlen($digits) !== 10) return '';

        return 'https://wa.me/52' . $digits . '?text=' . rawurlencode($text);
    }

    // El mensaje para el cliente segun como va su pedido.
    private function waHello($o, $state) {
        $name  = trim((string) $o['customer_name']);
        $first = $name !== '' ? explode(' ', $name)[0] : '';
        $hi    = 'Hola' . ($first !== '' ? " {$first}" : '') . ', te escribimos de ' . $this->scope()['branch'] . '.';
        $folio = 'P' . $o['folio'];
        $when  = trim(dmy($o['delivery_date']) . ' ' . hour12($o['delivery_time']));

        if ($state === 'accepted') {
            return "{$hi} Confirmamos tu pedido {$folio} para el {$when}. Total: " . money($o['total']) . '. ¡Gracias por tu compra!';
        }

        if ($state === 'cancelled') {
            $why = trim((string) ($o['cancel_reason'] ?? ''));

            return "{$hi} Lo sentimos, no podemos atender tu pedido {$folio}" . ($why !== '' ? ": {$why}" : '.') . ' Si quieres, te ayudamos a armar otro.';
        }

        return "{$hi} Recibimos tu pedido {$folio} para el {$when}.";
    }

    // -- Celdas --

    private function productRow($p, $on, $canEdit, $shared, $category) {
        $id    = (int) $p['id'];
        $name  = '<div class="font-semibold text-gray-800">' . h($p['name']) . '</div>';
        $desc  = trim((string) $p['description']);

        if ($desc !== '') $name .= '<div class="ord-sub tnd-desc">' . h(mb_strimwidth($desc, 0, 90, '…', 'UTF-8')) . '</div>';

        return [
            'id'          => $id,
            'Producto'    => '<div class="tnd-prod">' . $this->productThumb($p['image'], $p['name']) . '<div class="min-w-0">' . $name . '</div></div>',
            'Categoría'   => h($category),
            'Precio'      => '<span class="font-semibold text-gray-800">' . money($p['price']) . '</span>',
            'Origen'      => $shared
                ? '<span class="ord-pill bg-violet-50 text-violet-700">Matriz</span><div class="ord-sub">Cambia en todas las sucursales</div>'
                : '<span class="ord-pill bg-slate-100 text-slate-600">Sucursal</span>',
            'En tienda'   => $on
                ? '<span class="ord-pill bg-emerald-50 text-emerald-700">Sí sale</span>'
                : '<span class="ord-pill bg-slate-100 text-slate-500">No sale</span>',
            'a'           => $canEdit ? [[
                'class'      => $this->actionBtnClass($on ? 'danger' : 'primary', true),
                'html'       => '<i data-lucide="' . ($on ? 'eye-off' : 'store') . '" class="w-4 h-4"></i><span class="ms-1">' . ($on ? 'Quitar' : 'Agregar') . '</span>',
                'aria-label' => $on ? 'Quitar de la tienda' : 'Agregar a la tienda',
                'onclick'    => "store.toggleProduct({$id}, " . ($on ? 0 : 1) . ', ' . ($shared ? 1 : 0) . ')'
            ]] : []
        ];
    }

    // Miniatura de la foto; sin foto, las iniciales.
    private function productThumb($path, $name) {
        $path = trim((string) $path);

        if ($path === '') return '<span class="tnd-thumb tnd-thumb-vacia">' . h($this->initials($name)) . '</span>';

        $src = preg_match('#^https?://#i', $path)
            ? $path
            : '/' . implode('/', array_map('rawurlencode', explode('/', ltrim($path, '/'))));

        return '<img src="' . h($src) . '" alt="" loading="lazy" class="tnd-thumb" data-initials="' . h($this->initials($name)) . '" onerror="storeThumbError(this)">';
    }

    private function initials($name) {
        $words = preg_split('/\s+/u', trim((string) $name), -1, PREG_SPLIT_NO_EMPTY);
        $text  = '';

        foreach (array_slice($words, 0, 2) as $w) $text .= mb_strtoupper(mb_substr($w, 0, 1, 'UTF-8'), 'UTF-8');

        return $text !== '' ? $text : '?';
    }

    private function orderRow($o, $canEdit) {
        $id    = (int) $o['id'];
        $state = $this->webState($o);
        $paid  = round((float) $o['paid'], 2);
        $lines = (int) $o['lines_count'];

        $pill = [
            'new'       => '<span class="ord-pill bg-amber-50 text-amber-700">Por aceptar</span>',
            'accepted'  => '<span class="ord-pill bg-emerald-50 text-emerald-700">En Pedidos</span>',
            // Tipo 4: se rechazo desde la tienda. Tipo 1: se acepto y luego se cancelo en Pedidos.
            'cancelled' => (int) $o['sale_type_id'] === 4
                ? '<span class="ord-pill bg-rose-50 text-rose-700">Rechazado</span>'
                : '<span class="ord-pill bg-slate-100 text-slate-600">Cancelado en Pedidos</span>'
        ][$state];

        $customer = '<div class="font-semibold text-gray-800"><span class="ord-cliente">' . h($o['customer_name']) . '</span></div>'
                  . '<div class="ord-sub">' . h($o['phone']) . '</div>';

        $when = '<div class="font-semibold text-gray-800 whitespace-nowrap">' . shortDate($o['delivery_date'])
              . ($o['delivery_time'] ? ' · ' . hour12($o['delivery_time']) : '') . '</div>'
              . '<div class="ord-sub">' . ($o['delivery'] === 'delivery' ? 'Envío a domicilio' : 'Recoge en tienda') . '</div>';

        $pay = '<div class="text-gray-700 whitespace-nowrap">' . $this->paymentText($o['payment']) . '</div>'
             . ($paid > 0 ? '<div class="ord-sub text-emerald-600">Abonado ' . money($paid) . '</div>' : '');

        return [
            'id'      => $id,
            'Pedido'  => '<div class="font-semibold text-gray-800">P' . h($o['folio']) . '</div>'
                       . '<div class="ord-sub whitespace-nowrap">Llegó ' . strip_tags(shortDate($o['created_at'])) . ' · ' . hour12(substr((string) $o['created_at'], 11, 8)) . '</div>',
            'Cliente' => $customer,
            'Entrega' => $when,
            'Pago'    => $pay,
            'Total'   => '<div class="font-semibold text-gray-800 whitespace-nowrap">' . money($o['total']) . '</div>'
                       . '<div class="ord-sub">' . ($lines === 1 ? '1 producto' : "{$lines} productos") . '</div>',
            'Estado'  => $pill,
            'a'       => $this->orderActions($id, $state, $canEdit, $paid, $o)
        ];
    }

    private function actionBtnClass($variant, $last = false) {
        $base  = 'inline-flex items-center px-2 py-1 text-sm rounded-md border transition ';
        $tones = [
            'danger'  => 'border-red-200 text-red-500 hover:bg-red-50 hover:text-red-600',
            'primary' => 'border-emerald-200 text-emerald-600 hover:bg-emerald-50 hover:text-emerald-700',
            'neutral' => 'border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900'
        ];

        return $base . $tones[$variant] . ($last ? '' : ' me-1');
    }

    // aria-label y no title: en este framework title dispara un popover.
    private function orderActions($id, $state, $canEdit, $paid, $o) {
        $wa      = $this->waLink($o['phone'], $this->waHello($o, $state));
        $actions = [[
            'class'      => $this->actionBtnClass('neutral'),
            'html'       => '<i data-lucide="eye" class="w-4 h-4"></i>',
            'aria-label' => 'Ver pedido',
            'onclick'    => "store.viewOrder({$id})"
        ]];

        if ($wa !== '') {
            $actions[] = [
                'class'      => $this->actionBtnClass('neutral', !$canEdit || $state !== 'new'),
                'html'       => '<i data-lucide="message-circle" class="w-4 h-4"></i>',
                'aria-label' => 'Escribir por WhatsApp',
                'onclick'    => "store.openWa({$id})"
            ];
        }

        if ($canEdit && $state === 'new') {
            $actions[] = [
                'class'      => $this->actionBtnClass('primary', $paid > 0),
                'html'       => '<i data-lucide="check" class="w-4 h-4"></i><span class="ms-1">Aceptar</span>',
                'aria-label' => 'Aceptar pedido',
                'onclick'    => "store.acceptOrder({$id})"
            ];

            if ($paid <= 0) {
                $actions[] = [
                    'class'      => $this->actionBtnClass('danger', true),
                    'html'       => '<i data-lucide="x" class="w-4 h-4"></i>',
                    'aria-label' => 'Rechazar pedido',
                    'onclick'    => "store.cancelOrder({$id})"
                ];
            }
        }

        return $actions;
    }
}

Permission::dispatch(new ctrl(), ctrl::STORE);
