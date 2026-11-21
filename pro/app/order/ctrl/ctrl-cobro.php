<?php
require_once __DIR__ . '/../../../core/security/_Session.php';
if (empty($_POST['opc'])) exit(0);

require_once __DIR__ . '/core-order.php';
require_once __DIR__ . '/../mdl/mdl-whatsapp.php';

/*  Pedidos › cobrar (Etapa 3).

    Reglas que no se ven en el codigo de un vistazo:
      - Cobrar exige el turno de HOY abierto: cada pago entra al turno abierto de
        la sucursal (payment.turn_id), no al turno en que se capturo el pedido.
      - Varios metodos en un cobro (hasta 6, sin repetir). En efectivo se guarda
        lo recibido y el cambio; en los demas lo recibido es el monto.
      - Nunca se cobra de mas: la suma no pasa del saldo.
      - El estado lo pone el dinero (statusFor): sin pagos Cotizacion, con saldo
        Pendiente, sin saldo Pagado. Lo que mande el navegador no cuenta.
      - Descuento: uno por pedido, con motivo y tope (max_percent sobre el subtotal).
        Un motivo con requires_authorization lo aplica solo quien puede cancelar.
        El total nuevo no puede quedar por debajo de lo ya abonado.
        Si el pedido es de un turno o dia cerrado, el descuento lo autoriza Dueño
        o Supervisor (moneyBlock): mueve lo vendido de ese corte.
      - Quitar el descuento (como alpha): quien edita pedidos, en una cotizacion o
        un pendiente; el total vuelve al subtotal. Un pendiente de un corte
        cerrado lo autoriza Dueño o Supervisor (core::undiscountBlock).
      - Quitar un pago = borrado logico (active 0 + deleted_at) con motivo y solo
        con permiso delete. Un pago de un turno cerrado no se quita: se reabre antes.
      - Cambiar la forma de un pago (como alpha): Dueño o Supervisor (permiso
        cancel), solo con el turno de ese pago abierto. El importe no cambia.
      - La ventana de pagos (payOptions) abre aunque no se pueda cobrar: trae los
        pagos del pedido y dice en can_pay / pay_block por que no (rol, pedido o
        turno). Quien decide de verdad son payOrder y deletePayment.
      - Pedido nuevo con anticipo (payDraft): la ventana abre ANTES de guardar.
        El pedido lo crea addOrder solo al confirmar el cobro; si se cierra la
        ventana no queda nada guardado.
      - La observacion del cobro va pegada al concepto del pago
        (payment.description): «Abono · Ref. 4471».
      - Se valida todo ANTES de la primera escritura: transaction() solo deshace
        si algo lanza una excepcion. */
class ctrl extends core {
    use WhatsAppNotices;

    const MAX_PAYMENTS = 6;
    const MAX_AMOUNT   = 1000000;
    const MAX_NOTE     = 200;

    // -- Ventana de pagos --

    // La abre quien cobra o quien ve el dinero del pedido. Sin saldo o sin turno abre en consulta.
    public function payOptions() {
        $access = $this->need('create') === null ? null : $this->need('show', 'ver los pagos de un pedido');
        $fail   = $access ?: $this->needBranch();
        if ($fail) return $fail;

        $id = $this->postId();

        // Pedido de otra sucursal: se abre en la suya. Cobrar o quitar pagos lo decide la regla de alpha.
        $fail = $this->adoptOrderBranch($id, null);
        if ($fail) return $fail;

        return $this->attempt(function () use ($id) {
            $order = $id > 0 ? $this->qGetOrder($id, $this->branchId()) : null;

            if (!$order) return $this->fail(404, "El pedido P{$id} no existe en " . $this->scope()['branch'] . '.');

            $foreign = $this->branchId() !== $this->homeBranchId()
                ? $this->foreignBlock('pay', $this->branchId(), $this->scope()['branch'])
                : '';

            $total = round((float) $order['total'], 2);
            $paid  = round((float) $order['paid'], 2);
            $stop  = $foreign !== '' ? ['kind' => 'role', 'title' => 'Solo consulta', 'message' => $foreign, 'day' => false] : $this->payStop($order);
            $alive = (int) $order['sale_status_id'] !== self::CANCELLED;
            $given = (int) $order['delivery_status'] === 1;

            return [
                'status' => 200,
                'order'  => [
                    'id'              => (int) $order['id'],
                    'folio'           => $order['folio'] ?: $order['id'],
                    'customer'        => $order['customer'],
                    'phone'           => $order['phone'],
                    'status_id'       => (int) $order['sale_status_id'],
                    'status'          => $order['status'],
                    'cancelled'       => !$alive,
                    'delivered'       => $given,
                    'subtotal'        => round((float) $order['subtotal'], 2),
                    'discount_amount' => round((float) $order['discount_amount'], 2),
                    'discount_reason' => $order['discount_reason'],
                    'total'           => $total,
                    'paid'            => $paid,
                    'balance'         => round($total - $paid, 2),
                    'delivery_date'   => (string) $order['delivery_date']
                ],
                'payments'      => $this->qPayments($id),
                'can_pay'       => $stop === null,
                'pay_block'     => $stop,
                // La misma regla que el detalle (orderCan): entregado o cancelado no suelta pagos.
                'can_delete'    => $alive && !$given && $foreign === '' && $this->need('delete') === null,
                'methods'       => $this->qPaymentMethods($this->branchId()),
                'reasons'       => $this->qDiscountReasons($this->companyId()),
                'can_authorize' => $this->need('cancel') === null,
                'disc_block'    => $this->moneyBlock($order),
                'turn'          => $this->turnBrief(),
                'branch_id'     => $this->branchId(),
                'branches'      => $this->payBranches()
            ];
        }, 'No se pudieron abrir los pagos.');
    }

    // Pedido nuevo con anticipo: la ventana abre ANTES de guardar. Sin pedido todavía: sin pagos
    // ni descuento previo. El pedido lo crea addOrder (ctrl-pedidos) al confirmar el cobro.
    public function payDraft() {
        $fail = $this->need('create', 'cobrar pedidos') ?: $this->needBranch();
        if ($fail) return $fail;

        return $this->attempt(function () {
            $stop = $this->turnStop();

            return [
                'status'        => 200,
                'payments'      => [],
                'can_pay'       => $stop === null,
                'pay_block'     => $stop,
                'can_delete'    => false,
                'methods'       => $this->qPaymentMethods($this->branchId()),
                'reasons'       => $this->qDiscountReasons($this->companyId()),
                'can_authorize' => $this->need('cancel') === null,
                'disc_block'    => '',
                'turn'          => $this->turnBrief(),
                'branch_id'     => $this->branchId(),
                'branches'      => $this->payBranches()
            ];
        }, 'No se pudieron abrir los pagos.');
    }

    /*  Sucursales donde se puede cobrar el pedido (como alpha): cada una con su
        turno, lo que le impide cobrar (block) y sus formas de pago. Así la
        ventana cambia de sucursal sin volver a preguntar. */
    // session = la de la sesión (homeBranchId), aunque el pedido sea de otra: ahí se abre turno.
    private function payBranches() {
        $session = $this->homeBranchId();
        $list    = [];

        foreach ($this->qCompanyBranches($this->companyId()) as $branch) {
            $id   = (int) $branch['id'];
            $turn = $this->qOpenTurn($id);
            $stop = $this->needTurn($id, $branch['name']);

            $list[] = [
                'id'      => $id,
                'name'    => $branch['name'],
                'session' => $id === $session,
                'turn'    => $turn ? [
                    'id'        => (int) $turn['id'],
                    'folio'     => (string) $turn['folio'],
                    'opened_at' => (string) $turn['opened_at'],
                    'opened_by' => trim((string) $turn['opened_by']),
                    'old'       => substr((string) $turn['opened_at'], 0, 10) !== date('Y-m-d')
                ] : null,
                'block'   => $stop ? ['title' => $stop['title'], 'message' => $stop['message'], 'day' => !empty($stop['day'])] : null,
                'methods' => $this->qPaymentMethods($id)
            ];
        }

        return $list;
    }

    // La sucursal que cobra: la que eligió la pantalla si es de la empresa y está activa.
    private function payBranch() {
        $id = $this->intOf($this->post('pay_branch'));

        if ($id === null || $id <= 0 || $id === $this->branchId()) {
            return ['id' => $this->branchId(), 'name' => $this->scope()['branch'], 'cross' => false];
        }

        $branch = $this->qBranch($id);

        if (!$branch || (int) $branch['company_id'] !== $this->companyId()) {
            return $this->fail(422, 'La sucursal que cobra ya no está disponible.');
        }

        return ['id' => $id, 'name' => $branch['name'], 'cross' => true];
    }

    // null = se puede cobrar. Si no, quien lo impide: el rol, el pedido o el turno.
    private function payStop($order) {
        if ($this->need('create') !== null) {
            return ['kind' => 'role', 'title' => 'Solo consulta', 'message' => 'Tu rol no puede cobrar pedidos en esta sucursal.', 'day' => false];
        }

        $block = $this->payBlock($order);

        if ($block !== '') {
            return ['kind' => 'order', 'title' => 'No se puede cobrar', 'message' => $block, 'day' => false];
        }

        return $this->turnStop();
    }

    // null = hay turno de hoy abierto. Si no, el aviso de turno que muestra la ventana de pagos.
    private function turnStop() {
        $closed = $this->needTurn();

        if ($closed) {
            return ['kind' => 'turn', 'title' => $closed['title'], 'message' => $closed['message'], 'day' => !empty($closed['day'])];
        }

        return null;
    }

    // -- Cobrar --

    public function payOrder() {
        $fail = $this->need('create', 'cobrar pedidos') ?: $this->needBranch();
        if ($fail) return $fail;

        $id    = $this->postId();
        $token = $this->post('token');

        $again = $this->tokenResult($token);
        if ($again) return $again;

        if ($id <= 0) return $this->fail(422, 'Falta el pedido.');

        $fail = $this->adoptOrderBranch($id, 'pay');
        if ($fail) return $fail;

        $payments = $this->paymentsInput();
        if (isset($payments['status'])) return $payments;

        $discount = $this->discountInput();
        if (isset($discount['status'])) return $discount;

        $note = trim((string) preg_replace('/\s+/u', ' ', $this->post('note')));

        if ($this->tooLong($note, self::MAX_NOTE)) return $this->fail(422, 'La observación admite hasta ' . self::MAX_NOTE . ' caracteres.');

        if (empty($payments) && $discount === null) return $this->fail(422, 'Escribe cuánto paga el cliente.');

        $branch = $this->payBranch();
        if (isset($branch['status'])) return $branch;

        $closed = $this->needTurn($branch['id'], $branch['cross'] ? $branch['name'] : '');
        if ($closed) return $closed;

        $answer = $this->attempt(function () use ($id, $payments, $discount, $note, $branch) {
            return $this->transaction(function () use ($id, $payments, $discount, $note, $branch) {
                $order = $this->qLockOrder($id, $this->branchId());

                if (!$order) return $this->fail(404, "El pedido P{$id} no existe en " . $this->scope()['branch'] . '.');

                $block = $this->payBlock($order);
                if ($block !== '') return $this->fail(409, $block);

                $money = $discount !== null ? $this->moneyBlock($order) : '';
                if ($money !== '') return $this->fail(409, $money);

                $turn = $this->qLockOpenTurn($branch['id']);

                if (!$turn) {
                    return ['status' => 423, 'title' => 'Sin turno abierto', 'message' => $branch['cross']
                        ? 'El turno de ' . $branch['name'] . ' se cerró mientras cobrabas. Elige otra sucursal o pide que abran uno.'
                        : 'El turno se cerró mientras cobrabas. Abre uno nuevo e intenta otra vez.'];
                }

                $paidBefore = round((float) $order['paid'], 2);
                $total      = round((float) $order['total'], 2);
                $applied    = null;

                if ($discount !== null) {
                    $applied = $this->discountCheck($order, $discount, $paidBefore);
                    if (isset($applied['status'])) return $applied;

                    $total = $applied['total'];
                }

                $balance = round($total - $paidBefore, 2);
                $rows    = $this->paymentRows($payments, $balance, $branch['id']);
                if (isset($rows['status'])) return $rows;

                $paidNow = 0;
                $change  = 0;

                foreach ($rows as $row) {
                    $paidNow += $row['amount'];
                    $change  += $row['change'];
                }

                $paidNow = round($paidNow, 2);
                $paid    = round($paidBefore + $paidNow, 2);
                $left    = round($total - $paid, 2);
                $status  = $this->statusFor($total, $paid);

                if ($applied !== null) {
                    $this->must($this->qUpdateOrder([
                        'values' => ['discount_amount', 'discount_percent', 'discount_reason_id', 'discount_note', 'discount_user_id', 'total', 'updated_at = NOW()'],
                        'where'  => ['id'],
                        'data'   => [$applied['amount'], $applied['percent'], $applied['reason_id'], $applied['note'], $this->userId() ?: null, $total, $id]
                    ]), 'payOrder discount');

                    $cutNote = (int) $order['sale_status_id'] === self::PENDING ? $this->cutNote($order) : '';

                    $this->log($id, 'discount', 'Descuento', $applied['text'] . ' Total: ' . money($total) . '.' . ($cutNote !== '' ? ' ' . $cutNote : ''));
                }

                if ($rows) {
                    $description = $paid + 0.005 >= $total ? 'Liquidación' : ($paidBefore <= 0 ? 'Anticipo' : 'Abono');
                    $concept     = $note !== '' ? $description . ' · ' . $note : $description;
                    $now         = date('Y-m-d H:i:s');
                    $data        = [];

                    foreach ($rows as $row) {
                        $data[] = [
                            $id, $branch['id'], $this->userId() ?: null, (int) $turn['id'], $row['method_id'],
                            $row['amount'], $row['tendered'], $row['change'], $concept, $now, 1
                        ];
                    }

                    $this->must($this->qCreatePayment([
                        'values' => ['sale_id', 'branch_id', 'user_id', 'turn_id', 'payment_method_id', 'amount', 'tendered_amount', 'change_amount', 'description', 'paid_at', 'active'],
                        'data'   => $data
                    ]), 'payOrder payment');

                    $remark = $note !== '' ? ' Observación: ' . $note . (preg_match('/[.!?]$/u', $note) ? '' : '.') : '';
                    $where  = $branch['cross'] ? ' Cobrado en ' . $branch['name'] . ', turno ' . $turn['folio'] . '.' : '';

                    $this->log($id, 'payment', $description, $this->paymentsText($rows) . ' ' . $this->leftText($left) . $where . $remark);
                }

                if ($status !== (int) $order['sale_status_id']) {
                    $this->must($this->qUpdateOrder([
                        'values' => ['sale_status_id', 'updated_at = NOW()'],
                        'where'  => ['id'],
                        'data'   => [$status, $id]
                    ]), 'payOrder status');
                }

                $message = $rows
                    ? 'Cobro de ' . money($paidNow) . " registrado en P{$id}" . ($branch['cross'] ? ' (caja de ' . $branch['name'] . ').' : '.')
                    : "Descuento aplicado en P{$id}.";

                return $this->ok($message, [
                    'id'      => $id,
                    'paid'    => $paidNow,
                    'change'  => round($change, 2),
                    'balance'     => $left,
                    'sale_status' => $status,
                    'first_payment' => (int) $order['sale_status_id'] === self::QUOTE && $status !== self::QUOTE
                ]);
            });
        }, 'No se pudo registrar el cobro.');

        $this->rememberToken($token, $answer);

        // El anticipo que vuelve pedido a la cotizacion: aviso por WhatsApp (nunca tumba el cobro).
        if (!empty($answer['first_payment'])) {
            session_write_close();
            $this->notifyOrder($id);
        }

        return $answer;
    }

    // -- Cobro: lectura y validacion --

    // [{method_id, amount, tendered}] limpio, o la respuesta 422. Sin pagos = [].
    private function paymentsInput() {
        $raw = $this->post('payments');

        if ($raw === '') return [];

        $list = $this->postedJson('payments');

        if ($list === null)                     return $this->fail(422, 'Los pagos llegaron mal. Recarga la página e intenta de nuevo.');
        if (count($list) > self::MAX_PAYMENTS) return $this->fail(422, 'Un cobro admite hasta ' . self::MAX_PAYMENTS . ' métodos de pago.');

        $clean = [];
        $seen  = [];

        foreach ($list as $item) {
            $methodId = is_array($item) && isset($item['method_id']) ? $this->intOf($item['method_id']) : null;
            $amount   = is_array($item) && isset($item['amount']) ? $this->amountOf($item['amount'], null) : null;
            $tendered = is_array($item) && isset($item['tendered']) ? $this->amountOf($item['tendered'], $amount) : $amount;

            if ($methodId === null || $methodId <= 0) return $this->fail(422, 'Elige el método de cada pago.');
            if ($amount === null || $amount <= 0)     return $this->fail(422, 'Cada pago necesita un monto mayor a $0.');
            if ($amount > self::MAX_AMOUNT || $tendered === null || $tendered > self::MAX_AMOUNT) {
                return $this->fail(422, 'Un pago no puede pasar de ' . money(self::MAX_AMOUNT) . '.');
            }

            if (isset($seen[$methodId])) return $this->fail(422, 'Usa cada método una sola vez por cobro.');

            $seen[$methodId] = true;
            $clean[]         = ['method_id' => $methodId, 'amount' => $amount, 'tendered' => $tendered];
        }

        return $clean;
    }

    // null = sin descuento. Si no: {reason_id, percent|amount, note} limpio, o la respuesta 422.
    private function discountInput() {
        if ($this->post('discount') === '') return null;

        $raw = $this->postedJson('discount');

        if ($raw === null) return $this->fail(422, 'El descuento llegó mal. Recarga la página e intenta de nuevo.');

        $reasonId = isset($raw['reason_id']) ? $this->intOf($raw['reason_id']) : null;
        $percent  = isset($raw['percent']) && $raw['percent'] !== '' ? $this->amountOf($raw['percent'], null) : null;
        $amount   = isset($raw['amount']) && $raw['amount'] !== '' ? $this->amountOf($raw['amount'], null) : null;
        $note     = isset($raw['note']) ? trim((string) preg_replace('/\s+/u', ' ', (string) $raw['note'])) : '';

        if ($reasonId === null || $reasonId <= 0) return $this->fail(422, 'Elige el motivo del descuento.');
        if ($percent === null && $amount === null) return $this->fail(422, 'Escribe el descuento en % o en pesos.');
        if ($percent !== null && $percent > 100)   return $this->fail(422, 'El descuento no puede pasar de 100 %.');
        if ($this->tooLong($note, 255))             return $this->fail(422, 'La nota del descuento admite hasta 255 caracteres.');

        return ['reason_id' => $reasonId, 'percent' => $percent, 'amount' => $amount, 'note' => $note === '' ? null : $note];
    }

    // Con el pedido bloqueado: el descuento ya calculado o la respuesta de error.
    private function discountCheck($order, $discount, $paidBefore) {
        if ((float) $order['discount_amount'] > 0) {
            return $this->fail(409, 'El pedido ya tiene un descuento de ' . money($order['discount_amount']) . '. Solo se aplica uno.');
        }

        $reason = null;

        foreach ($this->qDiscountReasons($this->companyId()) as $row) {
            if ((int) $row['id'] === $discount['reason_id']) $reason = $row;
        }

        if (!$reason) return $this->fail(422, 'Ese motivo de descuento ya no existe.');

        if ((int) $reason['requires_authorization'] === 1 && $this->need('cancel') !== null) {
            return $this->fail(403, 'El motivo «' . $reason['name'] . '» lo autoriza un Dueño o Supervisor.');
        }

        $subtotal = round((float) $order['subtotal'], 2);
        $amount   = $discount['percent'] !== null ? round($subtotal * $discount['percent'] / 100, 2) : $discount['amount'];
        $cap      = round($subtotal * (float) $reason['max_percent'] / 100, 2);

        if ($amount <= 0) return $this->fail(422, 'El descuento tiene que ser mayor a $0.');

        if ($amount > $cap + 0.005) {
            return $this->fail(422, 'El motivo «' . $reason['name'] . '» permite hasta ' . (float) $reason['max_percent'] . ' % (' . money($cap) . ').');
        }

        $total = round((float) $order['total'] - $amount, 2);

        if ($total < 0) return $this->fail(422, 'El descuento no puede ser mayor que el total.');

        if ($total + 0.005 < $paidBefore) {
            return $this->fail(409, 'Con ese descuento el total (' . money($total) . ') queda por debajo de lo ya abonado (' . money($paidBefore) . ').');
        }

        $percent = $subtotal > 0 ? round($amount / $subtotal * 100, 2) : 0;
        $text    = 'Descuento de ' . money($amount) . ' (' . $percent . ' %) · Motivo: ' . $reason['name'] . '.';

        if ($discount['note'] !== null) $text .= ' Nota: ' . $discount['note'] . '.';

        return [
            'reason_id' => (int) $reason['id'],
            'amount'    => $amount,
            'percent'   => $percent,
            'note'      => $discount['note'],
            'total'     => $total,
            'text'      => $text
        ];
    }

    // Pagos contra los metodos de la base y el saldo. Devuelve los renglones o la respuesta de error.
    // $branchId = la sucursal que cobra: sus formas de pago son las que valen.
    private function paymentRows(array $payments, $balance, $branchId) {
        if (!$payments) return [];

        $methods = [];

        foreach ($this->qPaymentMethods($branchId) as $method) {
            $methods[(int) $method['id']] = $method;
        }

        $rows = [];
        $sum  = 0;

        foreach ($payments as $payment) {
            if (!isset($methods[$payment['method_id']])) return $this->fail(422, 'Uno de los métodos de pago ya no está disponible.');

            $method = $methods[$payment['method_id']];
            $cash   = (int) $method['is_cash'] === 1;

            if ($cash && $payment['tendered'] + 0.005 < $payment['amount']) {
                return $this->fail(422, 'Lo recibido en efectivo (' . money($payment['tendered']) . ') no alcanza para ' . money($payment['amount']) . '.');
            }

            $tendered = $cash ? $payment['tendered'] : $payment['amount'];
            $sum     += $payment['amount'];

            $rows[] = [
                'method_id' => $payment['method_id'],
                'method'    => $method['name'],
                'cash'      => $cash,
                'amount'    => $payment['amount'],
                'tendered'  => $tendered,
                'change'    => round($tendered - $payment['amount'], 2)
            ];
        }

        if (round($sum, 2) > $balance + 0.005) {
            return $this->fail(422, 'Estás cobrando ' . money($sum) . ' y el saldo es ' . money($balance) . '.');
        }

        return $rows;
    }

    private function paymentsText(array $rows) {
        $parts = [];

        foreach ($rows as $row) {
            $text = $row['method'] . ' ' . money($row['amount']);

            if ($row['cash'] && $row['change'] > 0) {
                $text .= ' (recibió ' . money($row['tendered']) . ', cambio ' . money($row['change']) . ')';
            }

            $parts[] = $text;
        }

        return implode(' + ', $parts) . '.';
    }

    private function leftText($left) {
        return $left <= 0.005 ? 'Queda pagado.' : 'Saldo: ' . money($left) . '.';
    }

    // -- Quitar un pago --

    public function deletePayment() {
        $fail = $this->need('delete', 'eliminar pagos') ?: $this->needBranch();
        if ($fail) return $fail;

        $id        = $this->postId();
        $paymentId = $this->postId('payment_id');
        $reason    = trim((string) preg_replace('/\s+/u', ' ', $this->post('reason')));

        if ($id <= 0 || $paymentId <= 0)  return $this->fail(422, 'Falta el pago.');
        if ($reason === '')               return $this->fail(422, 'Escribe por qué se quita el pago.');
        if ($this->tooLong($reason, 200)) return $this->fail(422, 'El motivo admite hasta 200 caracteres.');

        $fail = $this->adoptOrderBranch($id, 'pay');
        if ($fail) return $fail;

        return $this->attempt(function () use ($id, $paymentId, $reason) {
            return $this->transaction(function () use ($id, $paymentId, $reason) {
                $order = $this->qLockOrder($id, $this->branchId());

                if (!$order) return $this->fail(404, "El pedido P{$id} no existe en " . $this->scope()['branch'] . '.');

                if ((int) $order['sale_status_id'] === self::CANCELLED) {
                    return $this->fail(409, 'El pedido está cancelado: lo pagado ya pasó a saldo a favor.');
                }

                if ((int) $order['delivery_status'] === 1) {
                    return $this->fail(409, 'El pedido ya se entregó: para quitar un pago, primero deshaz la entrega.');
                }

                $payment = $this->qGetPayment($paymentId, $id);

                if (!$payment) return $this->fail(404, 'Ese pago ya no existe o ya se quitó.');

                if ($payment['turn_status'] === 'closed') {
                    return $this->fail(409, 'Ese pago es del turno ' . $payment['turn_folio'] . ', que ya cerró. Reábrelo para quitarlo.');
                }

                // Como alpha: con el pedido liquidado, quitar un pago pide además la contraseña.
                $settled = round((float) $order['total'] - (float) $order['paid'], 2) <= 0.005;

                if ($settled) {
                    $key = $this->needKey('quitar un pago');
                    if ($key) return $key;
                }

                $this->must($this->qUpdatePayment([
                    'values' => ['active', 'deleted_at = NOW()', 'deleted_user_id', 'updated_at = NOW()'],
                    'where'  => ['id'],
                    'data'   => [0, $this->userId() ?: null, $paymentId]
                ]), 'deletePayment');

                $total  = round((float) $order['total'], 2);
                $paid   = round((float) $order['paid'] - (float) $payment['amount'], 2);
                $left   = round($total - $paid, 2);
                $status = $this->statusFor($total, $paid);

                if ($status !== (int) $order['sale_status_id']) {
                    $this->must($this->qUpdateOrder([
                        'values' => ['sale_status_id', 'updated_at = NOW()'],
                        'where'  => ['id'],
                        'data'   => [$status, $id]
                    ]), 'deletePayment status');
                }

                $reopen = $settled && $left > 0.005 ? ' El pedido regresa a pendiente.' : '';

                $this->log($id, 'deletion', 'Pago quitado', $payment['method'] . ' ' . money($payment['amount']) . ' · Motivo: ' . $reason . '. ' . $this->leftText($left) . $reopen . ($settled ? ' Autorizado con contraseña.' : ''));

                return $this->ok('Pago quitado. ' . $this->leftText($left), ['id' => $id, 'balance' => $left, 'sale_status' => $status]);
            });
        }, 'No se pudo quitar el pago.');
    }

    // -- Cambiar la forma de un pago --

    /*  alpha › editPaymentMethod: Dueño o Supervisor (permiso cancel) y solo
        mientras el turno que recibió el pago siga abierto (su corte aún no se
        guarda). La forma nueva es de la sucursal que cobró. Lo recibido queda
        igual al importe: el cambio solo existe en efectivo y al cobrar. */
    public function changePaymentMethod() {
        $fail = $this->need('cancel', 'cambiar la forma de un pago') ?: $this->needBranch();
        if ($fail) return $fail;

        $id        = $this->postId();
        $paymentId = $this->postId('payment_id');
        $methodId  = $this->postId('method_id');

        if ($id <= 0 || $paymentId <= 0) return $this->fail(422, 'Falta el pago.');
        if ($methodId <= 0)              return $this->fail(422, 'Elige la forma de pago.');

        $fail = $this->adoptOrderBranch($id, 'pay');
        if ($fail) return $fail;

        return $this->attempt(function () use ($id, $paymentId, $methodId) {
            return $this->transaction(function () use ($id, $paymentId, $methodId) {
                $order = $this->qLockOrder($id, $this->branchId());

                if (!$order) return $this->fail(404, "El pedido P{$id} no existe en " . $this->scope()['branch'] . '.');

                if ((int) $order['sale_status_id'] === self::CANCELLED) {
                    return $this->fail(409, 'El pedido está cancelado: sus pagos ya no cambian.');
                }

                $payment = $this->qGetPayment($paymentId, $id);

                if (!$payment) return $this->fail(404, 'Ese pago ya no existe o ya se quitó.');

                if ($payment['turn_status'] === 'closed') {
                    return $this->fail(409, 'Ese pago es del turno ' . $payment['turn_folio'] . ', que ya cerró: su forma de pago ya no cambia.');
                }

                if ((int) $payment['payment_method_id'] === $methodId) {
                    return $this->ok('El pago ya estaba en esa forma de pago.', ['id' => $id, 'unchanged' => true]);
                }

                $branchId = (int) $payment['branch_id'] > 0 ? (int) $payment['branch_id'] : $this->branchId();
                $method   = null;

                foreach ($this->qPaymentMethods($branchId) as $row) {
                    if ((int) $row['id'] === $methodId) $method = $row;
                }

                if (!$method) return $this->fail(422, 'Esa forma de pago no está disponible en la sucursal que cobró.');

                $this->must($this->qUpdatePayment([
                    'values' => ['payment_method_id', 'tendered_amount', 'change_amount', 'updated_at = NOW()'],
                    'where'  => ['id'],
                    'data'   => [$methodId, round((float) $payment['amount'], 2), 0, $paymentId]
                ]), 'changePaymentMethod');

                $this->log($id, 'payment', 'Forma de pago cambiada',
                    'Pago de ' . money($payment['amount']) . ': ' . $payment['method'] . ' » ' . $method['name'] . '.');

                return $this->ok('Forma de pago cambiada: ' . $payment['method'] . ' » ' . $method['name'] . '.', ['id' => $id]);
            });
        }, 'No se pudo cambiar la forma de pago.');
    }

    // -- Quitar el descuento --

    /*  alpha › deleteDiscount: quien edita pedidos (en otra sucursal, con su
        turno abierto), en una cotización o un pendiente. El total vuelve al
        subtotal y el estado lo pone el dinero (statusFor). Un pendiente de un
        corte cerrado lo autoriza Dueño o Supervisor (core::undiscountBlock). */
    public function removeDiscount() {
        $fail = $this->need('update', 'quitar descuentos') ?: $this->needBranch();
        if ($fail) return $fail;

        $id = $this->postId();
        if ($id <= 0) return $this->fail(422, 'Falta el pedido.');

        $fail = $this->adoptOrderBranch($id, 'discount');
        if ($fail) return $fail;

        return $this->attempt(function () use ($id) {
            return $this->transaction(function () use ($id) {
                $order = $this->qLockOrder($id, $this->branchId());

                if (!$order) return $this->fail(404, "El pedido P{$id} no existe en " . $this->scope()['branch'] . '.');

                $block = $this->undiscountBlock($order);
                if ($block !== '') return $this->fail(409, $block);

                $amount = round((float) $order['discount_amount'], 2);
                $total  = round((float) $order['subtotal'], 2);
                $paid   = round((float) $order['paid'], 2);
                $status = $this->statusFor($total, $paid);

                $this->must($this->qUpdateOrder([
                    'values' => ['discount_amount', 'discount_percent', 'discount_reason_id', 'discount_note', 'discount_user_id', 'total', 'sale_status_id', 'updated_at = NOW()'],
                    'where'  => ['id'],
                    'data'   => [0, 0, null, null, null, $total, $status, $id]
                ]), 'removeDiscount');

                $cutNote = (int) $order['sale_status_id'] === self::PENDING ? $this->cutNote($order) : '';

                $this->log($id, 'discount', 'Descuento quitado', 'Se quitó el descuento de ' . money($amount) . '. Total: ' . money($total) . '. '
                    . $this->leftText(round($total - $paid, 2)) . ($cutNote !== '' ? ' ' . $cutNote : ''));

                return $this->ok("Descuento quitado en P{$id}. Total: " . money($total) . '.', ['id' => $id, 'total' => $total, 'sale_status' => $status]);
            });
        }, 'No se pudo quitar el descuento.');
    }
}

Permission::dispatch(new ctrl(), core::SECTION);
