<?php
require_once __DIR__ . '/../../../core/security/_Session.php';
if (empty($_POST['opc'])) exit(0);

require_once __DIR__ . '/core-order.php';
require_once __DIR__ . '/../mdl/mdl-credito.php';

/*  Pedidos › Clientes (Etapa 6a): el directorio de clientes de la sucursal.

    Reglas que no se ven en el codigo de un vistazo:
      - La seccion es pos-clientes. Ver, agregar y editar: Dueño, Cajera y
        Supervisor. Activar o desactivar pide 'delete' (hoy solo Dueño).
      - No se borra: se desactiva. Un cliente inactivo deja de salir en la
        captura; sus pedidos siguen igual.
      - El telefono es la llave practica: 10 digitos y unico entre los activos
        de la sucursal.
      - Pedidos, vendido y por cobrar cuentan pedidos de cualquier sucursal;
        desde el historial solo se abre el detalle de los de esta.
      - La BD no tiene bitacora de clientes: una edicion no deja rastro.

    Credito y monedero (V3 del plan de Ventas):
      - Dar credito y fijar el limite pide 'delete' (hoy solo Dueño). A los
        demas roles esos dos campos se les ignoran: no fallan, no se guardan.
      - Abonar pide 'create' de pos-ventas: es cobrar, no editar al cliente.
      - Un abono es una fila de payment (entra al corte del turno abierto) mas
        su fila 'abono' en receivable. Se reparte de la venta mas vieja a la
        mas nueva.
      - El monedero solo se muestra: sube al cancelar una venta ya cortada y
        baja al pagar con el en «Vender». */
class ctrl extends core {

    use CreditLedger;

    const CLIENTS     = 'pos-clientes';
    const SALES       = 'pos-ventas';
    const HISTORY_MAX = 200;
    const MOVES_MAX   = 50;
    const MAX_AMOUNT  = 1000000;

    // Ordenes de la lista: nombre, mas pedidos, mas vendido, mayor saldo, ultimo pedido.
    const SORTS = ['name', 'orders', 'sold', 'due', 'recent'];

    // -- Arranque --

    public function init() {
        $scope = $this->scope();

        return [
            'status'  => 200,
            'scope'   => ['company' => $scope['company'], 'branch' => $scope['branch']],
            'actions' => $this->actions(),
            'clients' => Permission::actions(self::CLIENTS),
            'tickets' => Permission::actions(self::TICKETS),
            'today'   => date('Y-m-d'),
            'turn'    => $this->turnBrief(),
            'day'     => $this->dayBrief()
        ];
    }

    // -- Lista --

    public function lsCustomers() {
        $fail = $this->needClients('show') ?: $this->needBranch();
        if ($fail) return $fail;

        $status = $this->post('status', '1');
        $active = $status === 'all' ? null : ($status === '0' ? 0 : 1);
        $sort   = in_array($this->post('sort'), self::SORTS, true) ? $this->post('sort') : 'name';

        return $this->attempt(function () use ($active, $sort) {
            $actions  = Permission::actions(self::CLIENTS);
            $rows     = [];
            $accounts = [];

            // qCustomerList solo cuenta pedidos: el credito y el monedero se leen aparte.
            foreach ($this->qCreditCustomers($this->branchId()) as $account) {
                $accounts[(int) $account['id']] = $account;
            }

            foreach ($this->qCustomerList($this->branchId(), $active, $sort) as $customer) {
                $id     = (int) $customer['id'];
                $rows[] = $this->customerRow($customer, $actions, isset($accounts[$id]) ? $accounts[$id] : null);
            }

            return [
                'status' => 200,
                'row'    => $rows,
                'count'  => count($rows),
                'branch' => $this->scope()['branch']
            ];
        }, 'No se pudo cargar la lista de clientes.');
    }

    // Una fila de la tabla. Las claves son los encabezados.
    private function customerRow($c, array $actions, $account) {
        $id     = (int) $c['id'];
        $active = (int) $c['active'] === 1;
        $orders = (int) $c['orders'];

        return [
            'id'            => $id,
            'Cliente'       => $this->cellCustomer($c['name'], $c['phone'], $c['email']),
            'Pedidos'       => $orders > 0 ? '<span class="font-semibold text-gray-800">' . $orders . '</span>' : $this->cellZero(),
            'Último pedido' => $c['last_order'] ? '<span class="text-gray-600 whitespace-nowrap">' . shortDate($c['last_order']) . '</span>' : $this->cellZero(),
            'Vendido'       => $this->cellMoney($c['sold'], 'font-semibold text-gray-800'),
            'Por cobrar'    => $this->cellMoney($c['due'], 'font-bold text-red-600'),
            'A favor'       => $this->cellMoney($c['credit'], 'font-semibold text-sky-700'),
            'Crédito'       => $this->cellCredit($account),
            'Monedero'      => $this->cellMoney($account ? $account['wallet'] : 0, 'font-semibold text-emerald-700'),
            'Estado'        => $this->activePill($active),
            'a'             => $this->rowActions($id, $active, $actions)
        ];
    }

    // -- Un cliente --

    public function getCustomer() {
        $fail = $this->needClients('show') ?: $this->needBranch();
        if ($fail) return $fail;

        return $this->attempt(function () {
            $customer = $this->qBranchCustomer($this->postId(), $this->branchId());

            if (!$customer) return $this->fail(404, 'Ese cliente no es de esta sucursal o ya no existe.');

            return ['status' => 200, 'row' => $this->customerBrief($customer)];
        }, 'No se pudo abrir el cliente.');
    }

    public function addCustomer() {
        $fail = $this->needClients('create') ?: $this->needBranch();
        if ($fail) return $fail;

        list($fail, $name, $phone, $email) = $this->customerFields();
        if ($fail) return $fail;

        $credit = $this->creditFields();
        if ($credit && $credit[0]) return $credit[0];

        return $this->attempt(function () use ($name, $phone, $email, $credit) {
            return $this->transaction(function () use ($name, $phone, $email, $credit) {
                $taken = $this->qCustomerPhoneTaken($this->branchId(), $phone, 0);

                if ($taken) return $this->fail(409, $this->takenText($taken));

                $values = ['name', 'phone', 'email', 'branch_id', 'active'];
                $data   = [$name, $phone, $email, $this->branchId(), 1];

                if ($credit) {
                    array_push($values, 'credit_enabled', 'credit_limit');
                    array_push($data, $credit[1], $credit[2]);
                }

                $this->must($this->qCreateCustomer(['values' => $values, 'data' => $data]), 'addCustomer');

                $id = $this->qLastInsertId();
                if ($id <= 0) throw new RuntimeException('addCustomer: sin id');

                return $this->ok('Cliente agregado.', ['id' => $id]);
            });
        }, 'No se pudo guardar el cliente.');
    }

    public function editCustomer() {
        $fail = $this->needClients('update') ?: $this->needBranch();
        if ($fail) return $fail;

        list($fail, $name, $phone, $email) = $this->customerFields();
        if ($fail) return $fail;

        $credit = $this->creditFields();
        if ($credit && $credit[0]) return $credit[0];

        $id = $this->postId();

        return $this->attempt(function () use ($id, $name, $phone, $email, $credit) {
            return $this->transaction(function () use ($id, $name, $phone, $email, $credit) {
                $customer = $this->qBranchCustomer($id, $this->branchId());

                if (!$customer) return $this->fail(404, 'Ese cliente no es de esta sucursal o ya no existe.');

                // Un inactivo puede repetir telefono: el choque se revisa al reactivarlo.
                if ((int) $customer['active'] === 1) {
                    $taken = $this->qCustomerPhoneTaken($this->branchId(), $phone, $id);

                    if ($taken) return $this->fail(409, $this->takenText($taken));
                }

                $values = ['name', 'phone', 'email'];
                $data   = [$name, $phone, $email];

                if ($credit) {
                    array_push($values, 'credit_enabled', 'credit_limit');
                    array_push($data, $credit[1], $credit[2]);
                }

                $values[] = 'updated_at = NOW()';
                $data[]   = $id;

                $this->must($this->qUpdateCustomer(['values' => $values, 'where' => ['id'], 'data' => $data]), 'editCustomer');

                return $this->ok('Cliente actualizado.', ['id' => $id]);
            });
        }, 'No se pudo guardar el cliente.');
    }

    // Activa o desactiva. No borra: los pedidos del cliente se quedan.
    public function statusCustomer() {
        $fail = $this->needClients('delete') ?: $this->needBranch();
        if ($fail) return $fail;

        $id     = $this->postId();
        $active = $this->post('active') === '1' ? 1 : 0;

        return $this->attempt(function () use ($id, $active) {
            return $this->transaction(function () use ($id, $active) {
                $customer = $this->qBranchCustomer($id, $this->branchId());

                if (!$customer) return $this->fail(404, 'Ese cliente no es de esta sucursal o ya no existe.');

                if ((int) $customer['active'] === $active) {
                    return $this->ok($active === 1 ? 'El cliente ya estaba activo.' : 'El cliente ya estaba inactivo.', ['id' => $id]);
                }

                if ($active === 1) {
                    $phone = preg_replace('/\D/', '', $customer['phone']);
                    $taken = $phone !== '' ? $this->qCustomerPhoneTaken($this->branchId(), $phone, $id) : null;

                    if ($taken) return $this->fail(409, $this->takenText($taken) . ' Cambia el teléfono antes de reactivarlo.');
                }

                $this->must($this->qUpdateCustomer([
                    'values' => ['active', 'updated_at = NOW()'],
                    'where'  => ['id'],
                    'data'   => [$active, $id]
                ]), 'statusCustomer');

                return $this->ok($active === 1 ? 'Cliente reactivado.' : 'Cliente desactivado.', ['id' => $id]);
            });
        }, 'No se pudo cambiar el estado del cliente.');
    }

    // -- Historial --

    public function lsHistory() {
        $fail = $this->needClients('show') ?: $this->needBranch();
        if ($fail) return $fail;

        return $this->attempt(function () {
            $branchId = $this->branchId();
            $customer = $this->qBranchCustomer($this->postId(), $branchId);

            if (!$customer) return $this->fail(404, 'Ese cliente no es de esta sucursal o ya no existe.');

            $canOpen = Permission::can(self::SECTION, 'show');
            $orders  = [];
            $summary = ['orders' => 0, 'sold' => 0.0, 'paid' => 0.0, 'due' => 0.0, 'cancelled' => 0, 'quotes' => 0];

            // Se pide uno de mas para saber si la lista quedo cortada.
            $found = $this->qCustomerHistory((int) $customer['id'], self::HISTORY_MAX + 1);
            $more  = count($found) > self::HISTORY_MAX;

            if ($more) array_pop($found);

            foreach ($found as $o) {
                $statusId = (int) $o['sale_status_id'];
                $total    = (float) $o['total'];
                $paid     = (float) $o['paid'];
                $alive    = in_array($statusId, [self::PENDING, self::PAID], true);
                $due      = $statusId === self::PENDING ? max(round($total - $paid, 2), 0) : 0;

                if ($alive) {
                    $summary['orders']++;
                    $summary['sold'] += $total;
                    $summary['paid'] += $paid;
                    $summary['due']  += $due;
                }

                if ($statusId === self::CANCELLED) $summary['cancelled']++;
                if ($statusId === self::QUOTE)     $summary['quotes']++;

                $orders[] = [
                    'id'          => (int) $o['id'],
                    'folio'       => 'P' . ($o['folio'] !== null && $o['folio'] !== '' ? $o['folio'] : $o['id']),
                    'created'     => dmy($o['created_at']),
                    'delivery'    => dmy($o['delivery_date']),
                    'status'      => $this->statusPill($statusId, $o['status']),
                    'total'       => money($total),
                    'paid'        => money($paid),
                    'due'         => $due > 0 ? money($due) : '',
                    'branch'      => $o['branch'],
                    'same_branch' => (int) $o['branch_id'] === $branchId,
                    'can_open'    => $canOpen && (int) $o['branch_id'] === $branchId
                ];
            }

            $account = $this->qCreditCustomer((int) $customer['id']);
            $credit  = $this->creditView((int) $customer['id'], $account);

            return [
                'status'   => 200,
                'customer' => $this->customerBrief($customer, $account),
                'credit'   => $credit,
                'methods'  => $credit['can_pay'] ? $this->payMethods() : [],
                'summary'  => [
                    'orders'    => $summary['orders'],
                    'sold'      => money($summary['sold']),
                    'paid'      => money($summary['paid']),
                    'due'       => money($summary['due']),
                    'has_due'   => $summary['due'] > 0.004,
                    'cancelled' => $summary['cancelled'],
                    'quotes'    => $summary['quotes']
                ],
                'row'      => $orders,
                'more'     => $more,
                'max'      => self::HISTORY_MAX
            ];
        }, 'No se pudo cargar el historial del cliente.');
    }

    // -- Crédito --

    /*  Abona a lo que el cliente debe a credito. El dinero entra al turno
        abierto y se reparte de la venta mas vieja a la mas nueva.

        El orden importa:
          - Fuera de la transaccion solo se averigua QUE ventas bloquear.
          - Dentro, lo primero es bloquearlas y luego el turno. Los saldos se
            leen despues: asi ya incluyen lo que otro cobro confirmo mientras
            este esperaba el bloqueo.
          - Una venta a credito que nacio entre una cosa y otra no se toca
            aqui: queda para el siguiente abono. */
    public function addCreditPayment() {
        $fail = $this->needClients('show') ?: $this->needBranch();
        if ($fail) return $fail;

        if (!Permission::can(self::SALES, 'create')) {
            return ['status' => 403, 'message' => 'Tu rol no tiene permiso para cobrar en esta sucursal.', 'row' => []];
        }

        $id    = $this->postId();
        $token = $this->post('token');

        $again = $this->tokenResult($token);
        if ($again) return $again;

        if ($id <= 0) return $this->fail(422, 'Falta el cliente.');

        $amount   = $this->amountOf($this->post('amount'), null);
        $methodId = $this->intOf($this->post('method_id'));

        if ($amount === null || $amount <= 0) return $this->fail(422, 'Escribe cuánto abona el cliente.');
        if ($amount > self::MAX_AMOUNT)       return $this->fail(422, 'Un abono no puede pasar de ' . money(self::MAX_AMOUNT) . '.');
        if ($methodId === null || $methodId <= 0) return $this->fail(422, 'Elige el método de pago.');

        $tendered = $this->amountOf($this->post('tendered'), $amount);

        if ($tendered === null || $tendered > self::MAX_AMOUNT) return $this->fail(422, 'Lo recibido no es un monto válido.');

        $closed = $this->needTurn();
        if ($closed) return $closed;

        $answer = $this->attempt(function () use ($id, $amount, $methodId, $tendered) {
            $method = null;

            foreach ($this->payMethods() as $option) {
                if ($option['id'] === $methodId) $method = $option;
            }

            if (!$method) return $this->fail(422, 'Ese método de pago ya no está disponible.');

            $cash = $method['is_cash'] === 1;

            if ($cash && $tendered + 0.005 < $amount) {
                return $this->fail(422, 'Lo recibido en efectivo (' . money($tendered) . ') no alcanza para ' . money($amount) . '.');
            }

            $tendered = $cash ? $tendered : $amount;
            $customer = $this->qBranchCustomer($id, $this->branchId());

            if (!$customer) return $this->fail(404, 'Ese cliente no es de esta sucursal o ya no existe.');

            $name = trim((string) $customer['name']) !== '' ? trim($customer['name']) : 'El cliente';
            $ids  = array_map(fn ($sale) => (int) $sale['id'], $this->qCreditSales($id));

            if (!$ids) return $this->fail(409, "{$name} no debe nada a crédito.");

            return $this->transaction(function () use ($id, $amount, $method, $cash, $tendered, $name, $ids) {
                $locked = array_flip($this->qLockSales($ids));
                $turn   = $this->qLockOpenTurn($this->branchId());

                if (!$turn) {
                    return ['status' => 423, 'title' => 'Sin turno abierto', 'message' => 'El turno se cerró mientras cobrabas. Abre uno nuevo e intenta otra vez.'];
                }

                $open = [];
                $debt = 0;

                foreach ($this->qCreditSales($id) as $sale) {
                    if (!isset($locked[(int) $sale['id']])) continue;

                    $left = round((float) $sale['total'] + (float) $sale['tip_amount'] - (float) $sale['paid'], 2);

                    if ($left <= 0.005) continue;

                    $open[] = ['id' => (int) $sale['id'], 'left' => $left];
                    $debt  += $left;
                }

                $debt = round($debt, 2);

                if ($debt <= 0.005)          return $this->fail(409, "{$name} ya no debe nada a crédito.");
                if ($amount > $debt + 0.005) return $this->fail(422, 'Estás abonando ' . money($amount) . ' y debe ' . money($debt) . '.');

                // De la venta mas vieja a la mas nueva.
                $parts = [];
                $rest  = $amount;

                foreach ($open as $sale) {
                    if ($rest <= 0.005) break;

                    $pay     = round(min($rest, $sale['left']), 2);
                    $rest    = round($rest - $pay, 2);
                    $parts[] = ['id' => $sale['id'], 'amount' => $pay, 'left' => round($sale['left'] - $pay, 2)];
                }

                $now    = date('Y-m-d H:i:s');
                $turnId = (int) $turn['id'];
                $change = round($tendered - $amount, 2);
                $last   = count($parts) - 1;
                $data   = [];

                // El cambio se anota una sola vez, en el ultimo pago.
                foreach ($parts as $i => $part) {
                    $extra  = $i === $last ? $change : 0;
                    $data[] = [
                        $part['id'], $this->branchId(), $this->userId() ?: null, $turnId, $method['id'],
                        $part['amount'], round($part['amount'] + $extra, 2), $extra, 'Abono a crédito', $now, 1
                    ];
                }

                $this->must($this->qCreatePayment([
                    'values' => ['sale_id', 'branch_id', 'user_id', 'turn_id', 'payment_method_id', 'amount', 'tendered_amount', 'change_amount', 'description', 'paid_at', 'active'],
                    'data'   => $data
                ]), 'addCreditPayment payment');

                foreach ($parts as $part) {
                    $settled = $part['left'] <= 0.005;

                    $this->saveCreditPayments($part['id'], $id, $turnId, [['method_id' => $method['id'], 'amount' => $part['amount']]], $now, 'Abono a crédito');

                    if ($settled) {
                        $this->must($this->qUpdateOrder([
                            'values' => ['sale_status_id', 'updated_at = NOW()'],
                            'where'  => ['id'],
                            'data'   => [self::PAID, $part['id']]
                        ]), 'addCreditPayment status');
                    }

                    $this->log(
                        $part['id'],
                        'payment',
                        $settled ? 'Liquidación' : 'Abono a crédito',
                        $method['name'] . ' ' . money($part['amount']) . ' abonados desde Clientes. ' . ($settled ? 'Venta liquidada.' : 'Resta ' . money($part['left']) . '.')
                    );
                }

                $left = round($debt - $amount, 2);
                $text = $left <= 0.005 ? "{$name} quedó al corriente." : "{$name} todavía debe " . money($left) . '.';

                return $this->ok('Abono de ' . money($amount) . ' registrado.', [
                    'id'     => $id,
                    'paid'   => $amount,
                    'change' => $cash ? $change : 0,
                    'debt'   => max($left, 0),
                    'sales'  => count($parts),
                    'detail' => $text
                ]);
            });
        }, 'No se pudo registrar el abono.');

        $this->rememberToken($token, $answer);

        return $answer;
    }

    // -- Complements --

    private function needClients($action) {
        if (Permission::can(self::CLIENTS, $action)) return null;

        $what = [
            'show'   => 'ver clientes',
            'create' => 'agregar clientes',
            'update' => 'editar clientes',
            'delete' => 'activar o desactivar clientes'
        ];

        $text = isset($what[$action]) ? $what[$action] : 'hacer esto';

        return ['status' => 403, 'message' => "Tu rol no tiene permiso para {$text} en esta sucursal.", 'row' => []];
    }

    // [respuesta de error | null, nombre, telefono, correo] ya limpios.
    private function customerFields() {
        $name  = trim((string) preg_replace('/\s+/u', ' ', $this->post('name')));
        $phone = preg_replace('/\D/', '', $this->post('phone'));
        $email = $this->post('email');

        if ($name === '')               return [$this->fail(422, 'Escribe el nombre del cliente.'), '', '', null];
        if ($this->tooLong($name, 120)) return [$this->fail(422, 'El nombre admite hasta 120 caracteres.'), '', '', null];
        if (strlen($phone) !== 10)      return [$this->fail(422, 'El teléfono debe tener 10 dígitos.'), '', '', null];

        if ($email !== '') {
            if ($this->tooLong($email, 120))                 return [$this->fail(422, 'El correo admite hasta 120 caracteres.'), '', '', null];
            if (!filter_var($email, FILTER_VALIDATE_EMAIL))  return [$this->fail(422, 'El correo no tiene un formato válido.'), '', '', null];
        }

        return [null, $name, $phone, $email === '' ? null : $email];
    }

    private function takenText($taken) {
        $label = trim((string) $taken['name']) !== '' ? trim($taken['name']) : 'otro cliente';

        return "Ese teléfono ya es de {$label}.";
    }

    // qBranchCustomer no trae monedero ni credito: salen de $account (o se leen aqui).
    private function customerBrief($c, $account = null) {
        $account = $account ?: $this->qCreditCustomer((int) $c['id']);

        return [
            'id'             => (int) $c['id'],
            'name'           => (string) $c['name'],
            'phone'          => (string) $c['phone'],
            'email'          => (string) $c['email'],
            'active'         => (int) $c['active'],
            'since'          => dmy($c['created_at']),
            'wallet'         => $account ? round((float) $account['wallet'], 2) : 0,
            'credit_enabled' => $account ? (int) $account['credit_enabled'] : 0,
            'credit_limit'   => $account ? round((float) $account['credit_limit'], 2) : 0
        ];
    }

    /*  Credito que llega del formulario: [respuesta de error | null, activado, limite].
        Null = no se toca: el rol no puede darlo o el formulario no lo mando. */
    private function creditFields() {
        if (!Permission::can(self::CLIENTS, 'delete')) return null;
        if (!isset($_POST['credit_enabled']) && !isset($_POST['credit_limit'])) return null;

        $enabled = $this->post('credit_enabled') === '1' ? 1 : 0;
        $limit   = $this->amountOf($this->post('credit_limit'), 0);

        if ($limit === null)            return [$this->fail(422, 'El límite de crédito no es un monto válido.'), 0, 0];
        if ($limit > self::MAX_AMOUNT)  return [$this->fail(422, 'El límite de crédito no puede pasar de ' . money(self::MAX_AMOUNT) . '.'), 0, 0];
        if ($enabled === 1 && $limit <= 0) return [$this->fail(422, 'Para dar crédito escribe un límite mayor a $0.'), 0, 0];

        return [null, $enabled, $limit];
    }

    // Con que se abona: los metodos visibles, sin el monedero (solo se usa al vender).
    private function payMethods() {
        $methods = [];

        foreach ($this->qPaymentMethods($this->companyId()) as $method) {
            if ($this->isWalletCode($method['code'])) continue;

            $methods[] = ['id' => (int) $method['id'], 'name' => (string) $method['name'], 'is_cash' => (int) $method['is_cash']];
        }

        return $methods;
    }

    // La cuenta del cliente para su historial: numeros, si se puede abonar y movimientos.
    private function creditView($customerId, $account) {
        $brief = $this->creditBrief($account, $this->qCreditDebt($customerId));
        $moves = [];

        foreach ($this->qCreditMoves($customerId, self::MOVES_MAX) as $move) {
            $charge = $move['kind'] === 'cargo';
            $time   = strtotime((string) $move['moved_at']);

            $moves[] = [
                'kind'   => $charge ? 'cargo' : 'abono',
                'label'  => $charge ? 'Venta a crédito' : 'Abono',
                'amount' => money($move['amount']),
                'folio'  => $move['sale_id'] ? 'V' . (int) $move['sale_id'] : '',
                'date'   => $time ? date('d/m/Y', $time) . ' ' . date('g:i A', $time) : '',
                'method' => $charge ? '' : (string) $move['method']
            ];
        }

        return [
            'enabled'    => $brief['enabled'],
            'limit'      => money($brief['limit']),
            'debt'       => money($brief['debt']),
            'available'  => money($brief['available']),
            'wallet'     => money($brief['wallet']),
            'debt_value' => $brief['debt'],
            'has_debt'   => $brief['debt'] > 0.005,
            'has_wallet' => $brief['wallet'] > 0.005,
            'can_pay'    => $brief['debt'] > 0.005 && Permission::can(self::SALES, 'create'),
            'moves'      => $moves
        ];
    }

    // -- Celdas --

    private function cellCustomer($name, $phone, $email) {
        $sub = array_filter([trim((string) $phone), trim((string) $email)], 'strlen');

        $html = '<div class="font-semibold text-gray-800"><span class="ord-cliente">' . h(trim((string) $name) !== '' ? $name : 'Sin nombre') . '</span></div>';

        if (!empty($sub)) $html .= '<div class="ord-sub">' . h(implode(' · ', $sub)) . '</div>';

        return $html;
    }

    // Monto en cero: un guion en lugar de $0.00.
    private function cellZero() {
        return '<span class="text-gray-400">-</span>';
    }

    private function cellMoney($amount, $tone) {
        if (round((float) $amount, 2) <= 0) return $this->cellZero();

        return '<span class="' . $tone . ' whitespace-nowrap">' . money($amount) . '</span>';
    }

    // Lo que debe a credito y, debajo, su limite. Guion = sin credito y sin adeudo.
    private function cellCredit($account) {
        $brief = $this->creditBrief($account, $account ? $account['debt'] : 0);

        if (!$brief['enabled'] && $brief['debt'] <= 0.005) return $this->cellZero();

        $tone = $brief['debt'] > 0.005 ? 'font-bold text-amber-600' : 'text-gray-400';
        $sub  = $brief['enabled'] ? 'de ' . money($brief['limit']) : 'Crédito apagado';

        return '<div class="' . $tone . ' whitespace-nowrap">' . money($brief['debt']) . '</div>'
             . '<div class="ord-sub whitespace-nowrap">' . $sub . '</div>';
    }

    private function activePill($active) {
        return $active
             ? '<span class="ord-pill bg-emerald-50 text-emerald-700">Activo</span>'
             : '<span class="ord-pill bg-slate-100 text-slate-600">Inactivo</span>';
    }

    // Mismos tonos que la lista de pedidos.
    private function statusPill($statusId, $name) {
        $tones = [
            self::QUOTE     => 'bg-[#EAF0FA] text-[#2A55A3]',
            self::PENDING   => 'bg-amber-50 text-amber-700',
            self::PAID      => 'bg-emerald-50 text-emerald-700',
            self::CANCELLED => 'bg-red-50 text-red-700'
        ];

        $tone = isset($tones[$statusId]) ? $tones[$statusId] : 'bg-slate-100 text-slate-600';

        return '<span class="ord-pill ' . $tone . '">' . h($name !== '' ? $name : 'Sin estado') . '</span>';
    }

    // -- Acciones de la fila --

    private function actionBtnClass($variant, $last = false) {
        $base = 'inline-flex items-center px-2 py-1 text-sm rounded-md border transition ';
        $tone = $variant === 'danger'
              ? 'border-red-200 text-red-500 hover:bg-red-50 hover:text-red-600'
              : 'border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900';

        return $base . $tone . ($last ? '' : ' me-1');
    }

    // aria-label y no title: en este framework title dispara un popover.
    private function rowActions($id, $active, array $actions) {
        $buttons = [[
            'variant'    => 'neutral',
            'html'       => '<i data-lucide="history" class="w-4 h-4"></i>',
            'aria-label' => 'Historial de pedidos',
            'onclick'    => "customers.history({$id})"
        ]];

        if (in_array('update', $actions, true)) {
            $buttons[] = [
                'variant'    => 'neutral',
                'html'       => '<i data-lucide="pencil" class="w-4 h-4"></i>',
                'aria-label' => 'Editar',
                'onclick'    => "customers.edit({$id})"
            ];
        }

        if (in_array('delete', $actions, true)) {
            $buttons[] = [
                'variant'    => $active ? 'danger' : 'neutral',
                'html'       => '<i data-lucide="' . ($active ? 'toggle-right' : 'toggle-left') . '" class="w-4 h-4"></i>',
                'aria-label' => $active ? 'Desactivar' : 'Activar',
                'onclick'    => "customers.status({$id}, " . ($active ? 0 : 1) . ')'
            ];
        }

        $last = count($buttons) - 1;
        $row  = [];

        foreach ($buttons as $i => $button) {
            $row[] = [
                'class'      => $this->actionBtnClass($button['variant'], $i === $last),
                'html'       => $button['html'],
                'aria-label' => $button['aria-label'],
                'onclick'    => $button['onclick']
            ];
        }

        return $row;
    }
}

Permission::dispatch(new ctrl(), ctrl::CLIENTS);
