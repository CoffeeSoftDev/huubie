<?php
require_once __DIR__ . '/../../../core/security/_Session.php';
if (empty($_POST['opc'])) exit(0);

require_once __DIR__ . '/core-order.php';

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
      - Quitar un pago = borrado logico (active 0 + deleted_at) con motivo y solo
        con permiso delete. Un pago de un turno cerrado no se quita: se reabre antes.
      - Se valida todo ANTES de la primera escritura: transaction() solo deshace
        si algo lanza una excepcion. */
class ctrl extends core {

    const MAX_PAYMENTS = 6;
    const MAX_AMOUNT   = 1000000;

    // -- Opciones del cobro --

    public function payOptions() {
        $fail = $this->need('create', 'cobrar pedidos') ?: $this->needBranch();
        if ($fail) return $fail;

        $id = $this->postId();

        return $this->attempt(function () use ($id) {
            $closed = $this->needTurn();
            if ($closed) return $closed;

            $order = $id > 0 ? $this->qGetOrder($id, $this->branchId()) : null;

            if (!$order) return $this->fail(404, "El pedido P{$id} no existe en " . $this->scope()['branch'] . '.');

            $block = $this->payBlock($order);
            if ($block !== '') return $this->fail(409, $block);

            $total = round((float) $order['total'], 2);
            $paid  = round((float) $order['paid'], 2);

            return [
                'status' => 200,
                'order'  => [
                    'id'              => (int) $order['id'],
                    'folio'           => $order['folio'] ?: $order['id'],
                    'customer'        => $order['customer'],
                    'phone'           => $order['phone'],
                    'status_id'       => (int) $order['sale_status_id'],
                    'status'          => $order['status'],
                    'subtotal'        => round((float) $order['subtotal'], 2),
                    'discount_amount' => round((float) $order['discount_amount'], 2),
                    'discount_reason' => $order['discount_reason'],
                    'total'           => $total,
                    'paid'            => $paid,
                    'balance'         => round($total - $paid, 2)
                ],
                'methods'       => $this->qPaymentMethods($this->companyId()),
                'reasons'       => $this->qDiscountReasons($this->companyId()),
                'can_authorize' => $this->need('cancel') === null,
                'disc_block'    => $this->moneyBlock($order),
                'turn'          => $this->turnBrief()
            ];
        }, 'No se pudo preparar el cobro.');
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

        $payments = $this->paymentsInput();
        if (isset($payments['status'])) return $payments;

        $discount = $this->discountInput();
        if (isset($discount['status'])) return $discount;

        if (empty($payments) && $discount === null) return $this->fail(422, 'Escribe cuánto paga el cliente.');

        $closed = $this->needTurn();
        if ($closed) return $closed;

        $answer = $this->attempt(function () use ($id, $payments, $discount) {
            return $this->transaction(function () use ($id, $payments, $discount) {
                $order = $this->qLockOrder($id, $this->branchId());

                if (!$order) return $this->fail(404, "El pedido P{$id} no existe en " . $this->scope()['branch'] . '.');

                $block = $this->payBlock($order);
                if ($block !== '') return $this->fail(409, $block);

                $money = $discount !== null ? $this->moneyBlock($order) : '';
                if ($money !== '') return $this->fail(409, $money);

                $turn = $this->qLockOpenTurn($this->branchId());

                if (!$turn) {
                    return ['status' => 423, 'title' => 'Sin turno abierto', 'message' => 'El turno se cerró mientras cobrabas. Abre uno nuevo e intenta otra vez.'];
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
                $rows    = $this->paymentRows($payments, $balance);
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
                    $now         = date('Y-m-d H:i:s');
                    $data        = [];

                    foreach ($rows as $row) {
                        $data[] = [
                            $id, $this->branchId(), $this->userId() ?: null, (int) $turn['id'], $row['method_id'],
                            $row['amount'], $row['tendered'], $row['change'], $description, $now, 1
                        ];
                    }

                    $this->must($this->qCreatePayment([
                        'values' => ['sale_id', 'branch_id', 'user_id', 'turn_id', 'payment_method_id', 'amount', 'tendered_amount', 'change_amount', 'description', 'paid_at', 'active'],
                        'data'   => $data
                    ]), 'payOrder payment');

                    $this->log($id, 'payment', $description, $this->paymentsText($rows) . ' ' . $this->leftText($left));
                }

                if ($status !== (int) $order['sale_status_id']) {
                    $this->must($this->qUpdateOrder([
                        'values' => ['sale_status_id', 'updated_at = NOW()'],
                        'where'  => ['id'],
                        'data'   => [$status, $id]
                    ]), 'payOrder status');
                }

                $message = $rows ? 'Cobro de ' . money($paidNow) . " registrado en P{$id}." : "Descuento aplicado en P{$id}.";

                return $this->ok($message, [
                    'id'      => $id,
                    'paid'    => $paidNow,
                    'change'  => round($change, 2),
                    'balance'     => $left,
                    'sale_status' => $status
                ]);
            });
        }, 'No se pudo registrar el cobro.');

        $this->rememberToken($token, $answer);

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
    private function paymentRows(array $payments, $balance) {
        if (!$payments) return [];

        $methods = [];

        foreach ($this->qPaymentMethods($this->companyId()) as $method) {
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

        return $this->attempt(function () use ($id, $paymentId, $reason) {
            return $this->transaction(function () use ($id, $paymentId, $reason) {
                $order = $this->qLockOrder($id, $this->branchId());

                if (!$order) return $this->fail(404, "El pedido P{$id} no existe en " . $this->scope()['branch'] . '.');

                if ((int) $order['sale_status_id'] === self::CANCELLED) {
                    return $this->fail(409, 'El pedido está cancelado: lo pagado ya pasó a saldo a favor.');
                }

                $payment = $this->qGetPayment($paymentId, $id);

                if (!$payment) return $this->fail(404, 'Ese pago ya no existe o ya se quitó.');

                if ($payment['turn_status'] === 'closed') {
                    return $this->fail(409, 'Ese pago es del turno ' . $payment['turn_folio'] . ', que ya cerró. Reábrelo para quitarlo.');
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

                $this->log($id, 'deletion', 'Pago quitado', $payment['method'] . ' ' . money($payment['amount']) . ' · Motivo: ' . $reason . '. ' . $this->leftText($left));

                return $this->ok('Pago quitado. ' . $this->leftText($left), ['id' => $id, 'balance' => $left, 'sale_status' => $status]);
            });
        }, 'No se pudo quitar el pago.');
    }
}

Permission::dispatch(new ctrl(), core::SECTION);
