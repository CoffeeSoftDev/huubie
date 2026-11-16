<?php
require_once __DIR__ . '/../../../core/security/_Session.php';
if (empty($_POST['opc'])) exit(0);

require_once __DIR__ . '/core-order.php';
require_once __DIR__ . '/../mdl/mdl-credito.php';
require_once __DIR__ . '/../mdl/mdl-lealtad.php';
require_once __DIR__ . '/../mdl/mdl-ticket.php';

/*  Ventas › Historial (V2 del plan de Ventas).

    Reglas que no se ven en el codigo de un vistazo:
      - Solo ventas de mostrador: sale_type_id 3. Pedidos tiene su propia lista.
      - Quien puede cancelar en pos-ventas (Dueño o Supervisor) ve todo, cancela,
        quita pagos y cambia el cliente. La Cajera ve solo SUS ventas del turno
        abierto y las imprime: own() le fija usuario y turno en cada consulta.
      - Lo que se debe = total + propina (la propina va aparte del total).
      - Cancelar:
          pagos del turno abierto      -> borrado logico: salen del corte.
          pagos de un turno cerrado    -> saldo a favor del cliente (customer.wallet).
          turno cerrado sin cliente    -> 409: ese dinero no tiene a donde ir.
      - Quitar un pago deja la venta Pendiente (nunca Cotizacion) y se vuelve a
        cobrar aqui mismo, en el turno abierto. Sin descuentos en el historial.
      - Venta a credito (V3): tiene un 'cargo' vivo en receivable.
          cobrarla aqui            -> cada pago es tambien un 'abono' del cliente.
          quitar un abono          -> se anula con su pago: el cliente vuelve a deber.
          quitar el pago de origen -> 409 (el cargo ya no cuadraria): se cancela.
          cancelarla               -> se anulan cargo y abonos: ya no debe nada.
          cambiarle el cliente     -> 409: el adeudo es de quien la compro.
      - Monedero (V3): aqui no se cobra con monedero, solo en «Vender». Al quitar
        o cancelar un pago hecho con monedero, el dinero regresa al monedero.
      - Tarjeta de lealtad (V4): si la venta abono puntos (kind 'puntos' en
        receivable), cancelarla los anula y los quita del monedero sin dejarlo
        negativo. Esa venta no cambia de cliente. Quitar un pago NO recalcula
        los puntos: se quedan como se dieron al vender.
      - Se valida todo ANTES de la primera escritura: transaction() solo deshace
        si algo lanza una excepcion. */
class ctrl extends core {

    use CreditLedger;
    use LoyaltyCards;
    use TicketLink;

    const SALES        = 'pos-ventas';
    const HISTORY      = 'pos-historial';
    const SALE_TYPE    = 3;
    const MAX_PAYMENTS = 6;
    const MAX_AMOUNT   = 1000000;
    const MAX_NOTE     = 200;
    const MAX_REASON   = 255;
    const MAX_ROWS     = 2000;

    private $ownCache = false;

    // -- Arranque --

    public function init() {
        $fail = $this->needBranch();
        if ($fail) return $fail;

        $scope   = $this->scope();
        $methods = [];

        foreach ($this->saleMethods() as $method) {
            $methods[] = ['id' => (int) $method['id'], 'valor' => $method['name']];
        }

        // El monedero no se cobra aqui, pero si se puede filtrar por el.
        $purse = $this->qWalletMethod($this->branchId());

        if ($purse) $methods[] = ['id' => (int) $purse['id'], 'valor' => $purse['name']];

        return [
            'status'    => 200,
            // logo: el del ticket impreso (ordPrintTicket, pedido-detalle.js).
            'scope'     => ['company' => $scope['company'], 'branch' => $scope['branch'], 'logo' => $this->companyLogo()],
            'actions'   => $this->actions(),
            'history'   => Permission::actions(self::HISTORY),
            'sales'     => Permission::actions(self::SALES),
            'tickets'   => Permission::actions(self::TICKETS),
            'today'     => date('Y-m-d'),
            'turn'      => $this->turnBrief(),
            'day'       => $this->dayBrief(),
            'user'      => ['id' => $this->userId(), 'name' => $this->userName()],
            'branch_id' => $this->branchId(),
            'can_all'   => $this->canAll(),
            'methods'   => $methods
        ];
    }

    // -- Lista --

    public function lsSales() {
        $fail = $this->needBranch();
        if ($fail) return $fail;

        return $this->attempt(function () {
            $own = $this->own();
            $fi  = $this->postDate('fi', date('Y-m-d'));
            $ff  = $this->postDate('ff', date('Y-m-d'));

            if ($fi > $ff) list($fi, $ff) = [$ff, $fi];

            $from = $fi . ' 00:00:00';
            $to   = $this->dayRange($ff)[1];

            $filters = [
                'branch_id' => $this->branchId(),
                'from'      => $from,
                'to'        => $to,
                'turn_id'   => $own ? $own['turn_id'] : max(0, $this->postId('turn_id')),
                'user_id'   => $own ? $own['user_id'] : 0,
                'method_id' => max(0, $this->postId('method_id'))
            ];

            $open   = $this->qOpenTurn($this->branchId());
            $openId = $open ? (int) $open['id'] : 0;
            $print  = Permission::can(self::HISTORY, 'print');
            $all    = $this->canAll();

            $rows    = [];
            $summary = ['count' => 0, 'total' => 0, 'tips' => 0, 'cancelled' => 0];

            foreach ($this->qListSales($filters) as $sale) {
                $rows[] = $this->saleRow($sale, $openId, $print, $all);

                if ((int) $sale['sale_status_id'] === self::CANCELLED) {
                    $summary['cancelled']++;
                    continue;
                }

                $summary['count']++;
                $summary['total'] += (float) $sale['total'];
                $summary['tips']  += (float) $sale['tip_amount'];
            }

            $summary['total'] = round($summary['total'], 2);
            $summary['tips']  = round($summary['tips'], 2);

            $turns = [];

            if (!$own) {
                foreach ($this->qTurnsInRange($this->branchId(), $from, $to) as $turn) {
                    $opened  = strtotime($turn['opened_at']);
                    $turns[] = [
                        'id'    => (int) $turn['id'],
                        'valor' => 'Turno ' . $turn['folio'] . ' · ' . date('d/m', $opened) . ' ' . date('g:i A', $opened) . ($turn['status'] === 'open' ? ' (abierto)' : '')
                    ];
                }
            }

            return [
                'status'  => 200,
                'row'     => $rows,
                'summary' => $summary,
                'turns'   => $turns,
                'own'     => $own ? ['turn_folio' => $own['turn_folio'], 'open' => $own['turn_id'] > 0] : null,
                'branch'  => $this->scope()['branch']
            ];
        }, 'No se pudo cargar el historial de ventas.');
    }

    // Una fila de la tabla. Las claves son los encabezados.
    private function saleRow($s, $openId, $print, $all) {
        $id        = (int) $s['id'];
        $statusId  = (int) $s['sale_status_id'];
        $cancelled = $statusId === self::CANCELLED;
        $inTurn    = $openId > 0 && (int) $s['turn_id'] === $openId;
        $stamp     = strtotime($s['created_at']);
        $seller    = trim((string) $s['seller']);
        $methods   = trim((string) $s['methods']);

        $menu = [['icon' => 'icon-eye', 'text' => 'Ver', 'onclick' => "orderDetail.show({$id})"]];

        if ($print)               $menu[] = ['icon' => 'icon-print', 'text' => 'Imprimir', 'onclick' => "orderDetail.print({$id})"];
        if ($all && !$cancelled)  $menu[] = ['icon' => 'icon-cancel', 'text' => 'Cancelar', 'onclick' => "orderDetail.cancel({$id})"];

        return [
            'id'       => $id,
            'Folio'    => $this->cellFolio($id, $s['folio'], $inTurn, $cancelled),
            'Fecha'    => '<span class="text-gray-600 whitespace-nowrap">' . shortDate($s['created_at']) . '</span>'
                        . ($stamp ? '<div class="ord-sub">' . date('g:i A', $stamp) . '</div>' : ''),
            'Cliente'  => $this->cellCustomer($s['customer'], $s['phone']),
            'Atendió'  => $seller !== '' ? '<span class="text-gray-700">' . h($seller) . '</span>' : '<span class="text-gray-400">Sin registro</span>',
            'Turno'    => $s['turn_folio'] !== '' ? '<span class="text-gray-600 whitespace-nowrap">' . h($s['turn_folio']) . '</span>' : $this->cellZero(),
            'Métodos'  => $methods !== '' ? '<span class="text-gray-600">' . h($methods) . '</span>' : $this->cellZero(),
            'Total'    => $this->cellTotal($s['total'], $s['subtotal'], $s['discount_amount']),
            'Propina'  => (float) $s['tip_amount'] > 0.005 ? '<span class="text-gray-700 whitespace-nowrap">' . money($s['tip_amount']) . '</span>' : $this->cellZero(),
            'Estado'   => $this->statusPill($statusId, $s['status'], $this->dueOf($s) - (float) $s['paid'], (int) $s['on_credit'] > 0),
            'dropdown' => $menu
        ];
    }

    // -- Celdas (las de Pedidos con «V») --

    private function cellFolio($id, $folio, $inTurn, $cancelled) {
        $dot    = $inTurn ? '<span class="ord-dot" aria-label="Del turno abierto"></span>' : '';
        $mark   = $cancelled ? ' data-cancelled="1"' : '';
        $number = $folio !== null && $folio !== '' ? $folio : $id;

        return '<button type="button" class="ord-folio" onclick="orderDetail.show(' . (int) $id . ')"' . $mark . '>'
             .   $dot . 'V' . h($number)
             . '</button>';
    }

    private function cellCustomer($name, $phone) {
        if (trim((string) $name) === '') return '<span class="text-gray-500">Público en general</span>';

        $html = '<div class="font-semibold text-gray-800"><span class="ord-cliente">' . h($name) . '</span></div>';

        if ($phone !== '') $html .= '<div class="ord-sub">' . h($phone) . '</div>';

        return $html;
    }

    private function cellZero() {
        return '<span class="text-gray-400">-</span>';
    }

    // Con descuento: el neto en verde y el bruto tachado debajo.
    private function cellTotal($total, $subtotal, $discount) {
        if (abs((float) $total) < 0.005) return $this->cellZero();

        if ((float) $discount > 0) {
            return '<span class="font-bold text-emerald-700 whitespace-nowrap">' . money($total) . '</span>'
                 . '<div class="text-[11px] text-gray-400 line-through whitespace-nowrap">' . money($subtotal) . '</div>';
        }

        return '<span class="font-semibold text-gray-800 whitespace-nowrap">' . money($total) . '</span>';
    }

    // Con saldo lo dice debajo: «A crédito» si se vendio asi, «Saldo» si se quito un pago.
    private function statusPill($statusId, $name, $balance, $onCredit = false) {
        $tones = [
            self::QUOTE     => 'bg-[#EAF0FA] text-[#2A55A3]',
            self::PENDING   => 'bg-amber-50 text-amber-700',
            self::PAID      => 'bg-emerald-50 text-emerald-700',
            self::CANCELLED => 'bg-red-50 text-red-700'
        ];

        $tone = isset($tones[$statusId]) ? $tones[$statusId] : 'bg-slate-100 text-slate-600';
        $owes = '';

        if ($statusId !== self::CANCELLED && $balance > 0.005) {
            $owes = $onCredit
                  ? '<div class="text-[11px] font-semibold text-amber-700 whitespace-nowrap">A crédito ' . money($balance) . '</div>'
                  : '<div class="text-[11px] font-semibold text-red-600 whitespace-nowrap">Saldo ' . money($balance) . '</div>';
        }

        return '<span class="ord-pill ' . $tone . '">' . h($name !== '' ? $name : 'Sin estado') . '</span>' . $owes;
    }

    // -- Detalle --

    public function getOrder() {
        $fail = $this->needBranch();
        if ($fail) return $fail;

        $id = $this->postId();

        return $this->attempt(function () use ($id) {
            $sale = $id > 0 ? $this->qGetSale($id, $this->own()) : null;

            if (!$sale) return $this->fail(404, $this->missing($id));

            return $this->saleBundle($sale);
        }, 'No se pudo abrir la venta.');
    }

    // La forma de orderBundle (lo que pinta OrderDetail) mas el ticket.
    private function saleBundle($sale) {
        $id       = (int) $sale['id'];
        $lines    = $this->qOrderLines($id);
        $payments = $this->qPayments($id);
        $alive    = (int) $sale['sale_status_id'] !== self::CANCELLED;
        $due      = $this->dueOf($sale);
        $owes     = $due - round((float) $sale['paid'], 2) > 0.005;
        $charge   = $alive ? $this->qSaleCharge($id) : null;
        $credit   = $charge ? max(round($due - (float) $sale['paid'], 2), 0) : 0;
        $points   = $alive ? $this->qSalePoints($id) : null;
        // El adeudo, el monedero y los puntos son de quien compro: esa venta ya no cambia de cliente.
        $tied     = $charge || $points || $this->paidWithWallet($payments);

        foreach ($lines as &$line) {
            $line['images']    = [];
            $line['modifiers'] = [];
        }
        unset($line);

        $sale['tip_amount'] = round((float) $sale['tip_amount'], 2);
        $sale['due']        = $due;
        $sale['on_credit']  = $charge ? 1 : 0;
        $sale['credit']     = $credit;

        $actions = Permission::actions(self::HISTORY);

        return [
            'status'   => 200,
            'branch'   => $this->scope()['branch'],
            'order'    => $sale,
            'lines'    => $lines,
            'payments' => $payments,
            'history'  => $this->qHistory($id),
            'actions'  => $actions,
            'can'      => [
                'pay'            => $alive && $owes && Permission::can(self::SALES, 'create'),
                'pay_reason'     => '',
                'delete_payment' => $alive && $this->canAll(),
                'cancel'         => $alive && $this->canAll(),
                'cancel_reason'  => $alive ? '' : 'La venta ya está cancelada.',
                'customer'       => $alive && !$tied && $this->canCustomer(),
                'edit'           => false,
                'edit_reason'    => '',
                'money'          => true,
                'money_reason'   => '',
                'deliver'        => false,
                'settle'         => false,
                'undeliver'      => false
            ],
            'limited'  => false,
            'ticket'   => $this->ticketOf($sale, $lines, $payments, $credit, $points ? (float) $points['amount'] : 0),
            // V7: el enlace al ticket va con el mismo permiso que imprimirlo.
            'share'    => in_array('print', (array) $actions, true) ? $this->ticketShare($id, $sale['phone']) : null
        ];
    }

    // La forma de ticketData de ctrl-ventas, con lo guardado. $credit = lo que sigue a credito; $points = abonado al monedero.
    private function ticketOf($s, array $lines, array $payments, $credit = 0, $points = 0) {
        $tip      = round((float) $s['tip_amount'], 2);
        $total    = round((float) $s['total'], 2);
        $discount = round((float) $s['discount_amount'], 2);
        $cardType = (string) ($s['card_type'] ?? '');
        $cardNum  = (string) ($s['card_number'] ?? '');
        // El descuento de una tarjeta no tiene motivo: se nombra por su tipo, como al vender.
        $reason   = (string) $s['discount_reason'] !== '' ? $s['discount_reason'] : ($cardType !== '' ? 'Tarjeta ' . $cardType : '');

        return [
            'folio'         => (string) ($s['folio'] ?: $s['id']),
            'branch'        => $this->scope()['branch'],
            'date'          => $s['created_at'],
            'user'          => trim((string) $s['created_by']),
            'customer'      => trim((string) $s['customer']) !== '' ? $s['customer'] : 'Público en general',
            'card'          => $cardNum !== '' ? ['type' => $cardType, 'number' => $cardNum] : null,
            'points'        => round((float) $points, 2),
            'lines'         => array_map(fn ($l) => [
                'name'     => $l['name'] !== '' && $l['name'] !== null ? $l['name'] : $l['product_name'],
                'quantity' => (float) $l['quantity'],
                'price'    => round((float) $l['price'], 2),
                'details'  => (string) $l['details'],
                // Neto: el descuento del renglon (Ventas) ya va restado.
                'discount' => round((float) $l['discount_amount'], 2),
                'amount'   => round((float) $l['price'] * (float) $l['quantity'] - (float) $l['discount_amount'], 2)
            ], $lines),
            'subtotal'      => round((float) $s['subtotal'], 2),
            'discount'      => $discount > 0 ? ['amount' => $discount, 'reason' => $reason] : null,
            'tip'           => $tip,
            'total'         => $total,
            'charged'       => round($total + $tip - $credit, 2),
            'credit'        => round((float) $credit, 2),
            'payments'      => array_map(fn ($p) => [
                'method'   => $p['method'] !== '' ? $p['method'] : 'Sin método',
                'cash'     => (int) $p['is_cash'] === 1,
                'amount'   => round((float) $p['amount'], 2),
                'tendered' => round((float) $p['tendered_amount'], 2),
                'change'   => round((float) $p['change_amount'], 2)
            ], $payments),
            'cancelled'     => (int) $s['sale_status_id'] === self::CANCELLED,
            'cancel_reason' => (string) $s['cancel_reason']
        ];
    }

    // -- Ventana de pagos (la de OrderPay) --

    public function payOptions() {
        $fail = $this->needBranch();
        if ($fail) return $fail;

        $id = $this->postId();

        return $this->attempt(function () use ($id) {
            $sale = $id > 0 ? $this->qGetSale($id, $this->own()) : null;

            if (!$sale) return $this->fail(404, $this->missing($id));

            $due   = $this->dueOf($sale);
            $tip   = round((float) $sale['tip_amount'], 2);
            $paid  = round((float) $sale['paid'], 2);
            $stop  = $this->payStop($sale);
            $alive = (int) $sale['sale_status_id'] !== self::CANCELLED;

            return [
                'status' => 200,
                'order'  => [
                    'id'              => (int) $sale['id'],
                    'folio'           => $sale['folio'] ?: $sale['id'],
                    'customer'        => $sale['customer'] !== '' ? $sale['customer'] : 'Público en general',
                    'phone'           => $sale['phone'],
                    'status_id'       => (int) $sale['sale_status_id'],
                    'status'          => $sale['status'],
                    'cancelled'       => !$alive,
                    'delivered'       => false,
                    // La ventana compara contra total: aqui total = lo que se debe (con propina).
                    'subtotal'        => round((float) $sale['subtotal'] + $tip, 2),
                    'discount_amount' => round((float) $sale['discount_amount'], 2),
                    'discount_reason' => $sale['discount_reason'],
                    'total'           => $due,
                    'tip_amount'      => $tip,
                    'paid'            => $paid,
                    'balance'         => round($due - $paid, 2)
                ],
                'payments'      => $this->qPayments($id),
                'can_pay'       => $stop === null,
                'pay_block'     => $stop,
                'can_delete'    => $alive && $this->canAll(),
                'methods'       => $this->saleMethods(),
                'reasons'       => [],
                'can_authorize' => false,
                'disc_block'    => '',
                'turn'          => $this->turnBrief(),
                // Una sola sucursal: la ventana la muestra, pero aquí no se cobra en otra.
                'branch_id'     => $this->branchId(),
                'branch_name'   => $this->scope()['branch']
            ];
        }, 'No se pudieron abrir los pagos.');
    }

    // null = se puede cobrar. Si no, quien lo impide: el rol, la venta o el turno.
    private function payStop($sale) {
        if (!Permission::can(self::SALES, 'create')) {
            return ['kind' => 'role', 'title' => 'Solo consulta', 'message' => 'Tu rol no puede cobrar ventas en esta sucursal.', 'day' => false];
        }

        $block = $this->saleBlock($sale);

        if ($block !== '') {
            return ['kind' => 'order', 'title' => 'No se puede cobrar', 'message' => $block, 'day' => false];
        }

        $closed = $this->needTurn();

        if ($closed) {
            return ['kind' => 'turn', 'title' => $closed['title'], 'message' => $closed['message'], 'day' => !empty($closed['day'])];
        }

        return null;
    }

    // '' = se puede cobrar.
    private function saleBlock($s) {
        if ((int) $s['sale_status_id'] === self::CANCELLED) return 'Una venta cancelada no se cobra.';
        if ($this->dueOf($s) - round((float) $s['paid'], 2) <= 0.005) return 'La venta no tiene saldo pendiente.';

        return '';
    }

    // -- Cobrar el saldo --

    public function payOrder() {
        $fail = $this->needSales('create') ?: $this->needBranch();
        if ($fail) return $fail;

        $id    = $this->postId();
        $token = $this->post('token');

        $again = $this->tokenResult($token);
        if ($again) return $again;

        if ($id <= 0) return $this->fail(422, 'Falta la venta.');

        $payments = $this->paymentsInput();
        if (isset($payments['status'])) return $payments;

        if ($this->post('discount') !== '') return $this->fail(422, 'En el historial no se aplican descuentos.');

        $note = trim((string) preg_replace('/\s+/u', ' ', $this->post('note')));

        if ($this->tooLong($note, self::MAX_NOTE)) return $this->fail(422, 'La observación admite hasta ' . self::MAX_NOTE . ' caracteres.');
        if (empty($payments))                      return $this->fail(422, 'Escribe cuánto paga el cliente.');

        $closed = $this->needTurn();
        if ($closed) return $closed;

        $answer = $this->attempt(function () use ($id, $payments, $note) {
            return $this->transaction(function () use ($id, $payments, $note) {
                $sale = $this->qLockSale($id, $this->own());

                if (!$sale) return $this->fail(404, $this->missing($id));

                $block = $this->saleBlock($sale);
                if ($block !== '') return $this->fail(409, $block);

                $turn = $this->qLockOpenTurn($this->branchId());

                if (!$turn) {
                    return ['status' => 423, 'title' => 'Sin turno abierto', 'message' => 'El turno se cerró mientras cobrabas. Abre uno nuevo e intenta otra vez.'];
                }

                $due        = $this->dueOf($sale);
                $paidBefore = round((float) $sale['paid'], 2);

                $rows = $this->paymentRows($payments, round($due - $paidBefore, 2));
                if (isset($rows['status'])) return $rows;

                // Venta a credito: lo que se cobre aqui tambien baja la cuenta del cliente.
                $charge = $this->qSaleCharge($id);

                $paidNow = 0;
                $change  = 0;

                foreach ($rows as $row) {
                    $paidNow += $row['amount'];
                    $change  += $row['change'];
                }

                $paidNow     = round($paidNow, 2);
                $left        = round($due - ($paidBefore + $paidNow), 2);
                $status      = $left <= 0.005 ? self::PAID : self::PENDING;
                $description = $left <= 0.005 ? 'Liquidación' : 'Abono';
                $concept     = $note !== '' ? $description . ' · ' . $note : $description;
                $now         = date('Y-m-d H:i:s');
                $data        = [];

                foreach ($rows as $row) {
                    $data[] = [
                        $id, $this->branchId(), $this->userId() ?: null, (int) $turn['id'], $row['method_id'],
                        $row['amount'], $row['tendered'], $row['change'], $concept, $now, 1
                    ];
                }

                $this->must($this->qCreatePayment([
                    'values' => ['sale_id', 'branch_id', 'user_id', 'turn_id', 'payment_method_id', 'amount', 'tendered_amount', 'change_amount', 'description', 'paid_at', 'active'],
                    'data'   => $data
                ]), 'payOrder payment');

                if ($charge) {
                    $this->saveCreditPayments($id, (int) $charge['customer_id'], (int) $turn['id'], $rows, $now, 'Abono a crédito');
                }

                $remark =$note !== '' ? ' Observación: ' . $note . (preg_match('/[.!?]$/u', $note) ? '' : '.') : '';

                $this->log($id, 'payment', $description, $this->paymentsText($rows) . ' ' . $this->leftText($left) . $remark);

                if ($status !== (int) $sale['sale_status_id']) {
                    $this->must($this->qUpdateOrder([
                        'values' => ['sale_status_id', 'updated_at = NOW()'],
                        'where'  => ['id'],
                        'data'   => [$status, $id]
                    ]), 'payOrder status');
                }

                return $this->ok('Cobro de ' . money($paidNow) . " registrado en V{$id}.", [
                    'id'          => $id,
                    'paid'        => $paidNow,
                    'change'      => round($change, 2),
                    'balance'     => $left,
                    'sale_status' => $status
                ]);
            });
        }, 'No se pudo registrar el cobro.');

        $this->rememberToken($token, $answer);

        return $answer;
    }

    // -- Quitar un pago --

    public function deletePayment() {
        $fail = $this->needAll('quitar pagos de una venta') ?: $this->needBranch();
        if ($fail) return $fail;

        $id        = $this->postId();
        $paymentId = $this->postId('payment_id');
        $reason    = trim((string) preg_replace('/\s+/u', ' ', $this->post('reason')));

        if ($id <= 0 || $paymentId <= 0)          return $this->fail(422, 'Falta el pago.');
        if ($reason === '')                       return $this->fail(422, 'Escribe por qué se quita el pago.');
        if ($this->tooLong($reason, self::MAX_NOTE)) return $this->fail(422, 'El motivo admite hasta ' . self::MAX_NOTE . ' caracteres.');

        return $this->attempt(function () use ($id, $paymentId, $reason) {
            return $this->transaction(function () use ($id, $paymentId, $reason) {
                $sale = $this->qLockSale($id, null);

                if (!$sale) return $this->fail(404, $this->missing($id));

                if ((int) $sale['sale_status_id'] === self::CANCELLED) {
                    return $this->fail(409, 'La venta está cancelada: sus pagos ya no se mueven.');
                }

                $payment = $this->qGetPayment($paymentId, $id);

                if (!$payment) return $this->fail(404, 'Ese pago ya no existe o ya se quitó.');

                if ($payment['turn_status'] === 'closed') {
                    return $this->fail(409, 'Ese pago es del turno ' . $payment['turn_folio'] . ', que ya cerró. Reábrelo para quitarlo.');
                }

                // Credito y monedero: se decide todo antes de escribir.
                $ledger     = $this->qPaymentLedger($paymentId);
                $charge     = $this->qSaleCharge($id);
                $customerId = (int) $sale['customer_id'];
                $abono      = null;
                $purse      = !$charge && $customerId > 0 && $ledger && $this->isWalletCode($ledger['method_code']);

                if ($charge) {
                    $abono = $ledger
                           ? $this->qCreditPaymentOf($id, (int) $ledger['payment_method_id'], (float) $ledger['amount'], $ledger['paid_at'])
                           : null;

                    // Sin abono es el pago con el que se vendio: quitarlo descuadra el cargo.
                    if (!$abono) {
                        return $this->fail(409, 'Ese pago es de cuando se vendió a crédito: quitarlo descuadra lo que el cliente debe. Si hubo un error, cancela la venta.');
                    }
                }

                $this->must($this->qUpdatePayment([
                    'values' => ['active', 'deleted_at = NOW()', 'deleted_user_id', 'updated_at = NOW()'],
                    'where'  => ['id'],
                    'data'   => [0, $this->userId() ?: null, $paymentId]
                ]), 'deletePayment');

                $extra = '';

                if ($abono) {
                    $this->voidReceivable((int) $abono['id'], 'deletePayment credit');

                    $extra = ' El abono se anuló: el cliente vuelve a deber ese monto.';
                }

                if ($purse) {
                    $this->moveWallet($customerId, (float) $payment['amount'], 'deletePayment wallet');

                    $extra = ' ' . money($payment['amount']) . ' regresan al monedero de ' . ($this->qCustomerName($customerId) ?: 'el cliente') . '.';
                }

                $due    = $this->dueOf($sale);
                $paid   = round((float) $sale['paid'] - (float) $payment['amount'], 2);
                $left   = round($due - $paid, 2);
                $status = $left <= 0.005 ? self::PAID : self::PENDING;

                if ($status !== (int) $sale['sale_status_id']) {
                    $this->must($this->qUpdateOrder([
                        'values' => ['sale_status_id', 'updated_at = NOW()'],
                        'where'  => ['id'],
                        'data'   => [$status, $id]
                    ]), 'deletePayment status');
                }

                $this->log($id, 'deletion', 'Pago quitado', $payment['method'] . ' ' . money($payment['amount']) . ' · Motivo: ' . $reason . '. ' . $this->leftText($left) . $extra);

                return $this->ok('Pago quitado. ' . $this->leftText($left) . $extra, ['id' => $id, 'balance' => $left, 'sale_status' => $status]);
            });
        }, 'No se pudo quitar el pago.');
    }

    // -- Cancelar --

    public function cancelSale() {
        $fail = $this->needAll('cancelar ventas') ?: $this->needBranch();
        if ($fail) return $fail;

        $id     = $this->postId();
        $reason = trim((string) preg_replace('/\s+/u', ' ', $this->post('reason')));

        if ($id <= 0)                                 return $this->fail(422, 'Falta la venta.');
        if ($reason === '')                           return $this->fail(422, 'Escribe el motivo de la cancelación.');
        if ($this->tooLong($reason, self::MAX_REASON)) return $this->fail(422, 'El motivo admite hasta ' . self::MAX_REASON . ' caracteres.');

        return $this->attempt(function () use ($id, $reason) {
            return $this->transaction(function () use ($id, $reason) {
                $sale = $this->qLockSale($id, null);

                if (!$sale) return $this->fail(404, $this->missing($id));

                if ((int) $sale['sale_status_id'] === self::CANCELLED) {
                    return $this->fail(409, "La venta V{$id} ya estaba cancelada.");
                }

                /*  Lo cobrado en el turno abierto se devuelve; lo de un turno cerrado no
                    se toca y queda como saldo a favor. Lo pagado con monedero en el turno
                    abierto no es dinero de la caja: regresa al monedero. */
                $openIds = [];
                $open    = 0;
                $purse   = 0;
                $closed  = 0;

                foreach ($this->qPayments($id) as $payment) {
                    if ($payment['turn_status'] === 'closed') {
                        $closed += (float) $payment['amount'];
                        continue;
                    }

                    $openIds[] = (int) $payment['id'];

                    if ($this->isWalletCode($payment['method_code'])) $purse += (float) $payment['amount'];
                    else                                              $open  += (float) $payment['amount'];
                }

                $open       = round($open, 2);
                $closed     = round($closed, 2);
                $customerId = (int) $sale['customer_id'];
                $purse      = $customerId > 0 ? round($purse, 2) : 0;

                // Venta a credito: al cancelarla se anulan su cargo y sus abonos.
                $charge = $this->qSaleCharge($id);
                $debt   = $charge ? max(round($this->dueOf($sale) - (float) $sale['paid'], 2), 0) : 0;

                if ($closed > 0.005 && $customerId <= 0) {
                    return $this->fail(409, 'La venta tiene ' . money($closed) . ' cobrados en un turno que ya cerró y es de Público en general: ese dinero no tiene a dónde ir. Asígnale un cliente para dejarlo como saldo a favor.');
                }

                /*  Puntos de la tarjeta (V4): se quitan del monedero sin dejarlo negativo.
                    Si el monedero es del mismo cliente, cuenta lo que esta cancelacion le
                    regresa (monedero del turno abierto y saldo a favor de turnos cerrados). */
                $points   = $this->qSalePoints($id);
                $pointsTo = $points ? (int) $points['customer_id'] : 0;
                $holder   = $pointsTo > 0 ? $this->qCreditCustomer($pointsTo, true) : null;
                $clawed   = 0;

                if ($holder) {
                    $room   = (float) $holder['wallet'] + ($pointsTo === $customerId ? $purse + $closed : 0);
                    $clawed = round(min((float) $points['amount'], max($room, 0)), 2);
                }

                foreach ($openIds as $paymentId) {
                    $this->must($this->qUpdatePayment([
                        'values' => ['active', 'deleted_at = NOW()', 'deleted_user_id', 'updated_at = NOW()'],
                        'where'  => ['id'],
                        'data'   => [0, $this->userId() ?: null, $paymentId]
                    ]), 'cancelSale payment');
                }

                $this->must($this->qUpdateOrder([
                    'values' => ['sale_status_id', 'cancel_reason', 'cancelled_at = NOW()', 'cancel_user_id', 'updated_at = NOW()'],
                    'where'  => ['id'],
                    'data'   => [self::CANCELLED, $reason, $this->userId() ?: null, $id]
                ]), 'cancelSale');

                if ($points) $this->voidPoints((int) $points['id'], 'cancelSale points');
                if ($charge) $this->voidSaleLedger($id, 'cancelSale ledger');

                $cutNote = $this->cutNote($sale);
                $name    = $customerId > 0 ? ($this->qCustomerName($customerId) ?: 'el cliente') : '';
                $notes   = [];

                if ($open > 0.005)  $notes[] = 'Se devuelven ' . money($open) . ' del turno abierto: salen del corte.';
                if ($purse > 0.005) $notes[] = money($purse) . ' regresan al monedero de ' . $name . '.';
                if ($debt > 0.005)  $notes[] = 'Se anula el adeudo a crédito de ' . money($debt) . '.';

                if ($points) {
                    $earned = round((float) $points['amount'], 2);
                    $owner  = $holder ? (trim((string) $holder['name']) ?: 'el cliente') : 'el cliente';

                    if ($clawed >= $earned - 0.005) $notes[] = 'Se quitan ' . money($earned) . ' de puntos del monedero de ' . $owner . '.';
                    elseif ($clawed > 0.005)        $notes[] = 'De los ' . money($earned) . ' en puntos solo se quitan ' . money($clawed) . ': el monedero de ' . $owner . ' ya no tenía más.';
                    else                            $notes[] = 'Los ' . money($earned) . ' en puntos no se quitan: el monedero de ' . $owner . ' ya estaba en cero.';
                }

                $returned = implode(' ', $notes);

                $this->log($id, 'cancellation', 'Venta cancelada', trim('Motivo: ' . $reason . '. ' . $returned . ($cutNote !== '' ? ' ' . $cutNote : '')));

                $message = trim("Venta V{$id} cancelada. " . $returned);

                if ($purse > 0.005) $this->moveWallet($customerId, $purse, 'cancelSale purse');

                if ($closed > 0.005) {
                    $this->moveWallet($customerId, $closed, 'cancelSale wallet');

                    $wallet = 'Lo cobrado en turnos cerrados (' . money($closed) . ') queda como saldo a favor de ' . $name . '.';

                    $this->log($id, 'payment', 'Saldo a favor', $wallet);

                    $message .= ' ' . $wallet;
                }

                if ($clawed > 0.005) $this->moveWallet($pointsTo, -$clawed, 'cancelSale points');

                return $this->ok($message, ['id' => $id, 'returned' => $open, 'wallet' => round($closed + $purse, 2), 'credit' => $debt, 'points' => $clawed]);
            });
        }, 'No se pudo cancelar la venta.');
    }

    // -- Cambiar el cliente --

    public function customerOptions() {
        $fail = $this->needCustomer() ?: $this->needBranch();
        if ($fail) return $fail;

        $id = $this->postId();

        return $this->attempt(function () use ($id) {
            $sale = $id > 0 ? $this->qGetSale($id, null) : null;

            if (!$sale) return $this->fail(404, $this->missing($id));

            $customers = [];

            foreach ($this->qCustomerOptions($this->branchId(), (int) $sale['customer_id']) as $c) {
                $customers[] = ['id' => (int) $c['id'], 'valor' => $this->customerLabel($c['name'], $c['phone'])];
            }

            return ['status' => 200, 'customers' => $customers, 'customer_id' => (int) $sale['customer_id']];
        }, 'No se pudieron cargar los clientes.');
    }

    public function setCustomer() {
        $fail = $this->needCustomer() ?: $this->needBranch();
        if ($fail) return $fail;

        $id         = $this->postId();
        $customerId = $this->selectOrNull('customer_id');
        $customer   = null;

        if ($id <= 0) return $this->fail(422, 'Falta la venta.');

        if ($customerId !== null) {
            $customer = $this->qGetCustomer($customerId);
            $isLocal  = $customer && (int) $customer['company_id'] === $this->companyId() && (int) $customer['active'] === 1;

            if (!$isLocal) return $this->fail(422, 'Ese cliente no está disponible en esta empresa.');
        }

        return $this->attempt(function () use ($id, $customerId, $customer) {
            return $this->transaction(function () use ($id, $customerId, $customer) {
                $sale = $this->qLockSale($id, null);

                if (!$sale) return $this->fail(404, $this->missing($id));

                if ((int) $sale['sale_status_id'] === self::CANCELLED) {
                    return $this->fail(409, 'Una venta cancelada no cambia de cliente.');
                }

                $before = (int) $sale['customer_id'];

                if ($before === (int) $customerId) return $this->ok('El cliente no cambió.', ['id' => $id]);

                if ($this->qSaleCharge($id)) {
                    return $this->fail(409, "La venta V{$id} se vendió a crédito: el adeudo es de quien la compró y no cambia de cliente. Si el cliente está mal, cancélala y véndela de nuevo.");
                }

                if ($this->paidWithWallet($this->qPayments($id))) {
                    return $this->fail(409, "La venta V{$id} se pagó con el monedero de su cliente y no cambia de cliente. Si está mal, cancélala y véndela de nuevo.");
                }

                if ($this->qSalePoints($id)) {
                    return $this->fail(409, "La venta V{$id} abonó puntos de tarjeta al monedero de su cliente y no cambia de cliente. Si está mal, cancélala y véndela de nuevo.");
                }

                $this->must($this->qUpdateOrder([
                    'values' => ['customer_id', 'updated_at = NOW()'],
                    'where'  => ['id'],
                    'data'   => [$customerId, $id]
                ]), 'setCustomer');

                $from = $before > 0 ? ($this->qCustomerName($before) ?: 'Sin nombre') : 'Público en general';
                $to   = $customer ? (trim((string) $customer['name']) ?: 'Sin nombre') : 'Público en general';

                $this->log($id, 'edition', 'Cliente cambiado', "Cliente: {$from} → {$to}.");

                return $this->ok("Venta V{$id}: ahora es de {$to}.", ['id' => $id, 'customer_id' => $customerId]);
            });
        }, 'No se pudo cambiar el cliente.');
    }

    // -- Quien ve que --

    // Dueño o Supervisor: quien puede cancelar en pos-ventas.
    private function canAll() {
        return Permission::can(self::SALES, 'cancel');
    }

    private function canCustomer() {
        return $this->canAll() || Permission::can(self::SALES, 'update');
    }

    /*  null = ve todo. Si no (Cajera): solo sus ventas del turno abierto de la
        sucursal. Sin usuario o sin turno, -1: la consulta no encuentra nada. */
    private function own() {
        if ($this->canAll()) return null;
        if ($this->ownCache !== false) return $this->ownCache;

        $turn = $this->qOpenTurn($this->branchId());

        $this->ownCache = [
            'user_id'    => $this->userId() ?: -1,
            'turn_id'    => $turn ? (int) $turn['id'] : -1,
            'turn_folio' => $turn ? (string) $turn['folio'] : ''
        ];

        return $this->ownCache;
    }

    private function needAll($text) {
        if ($this->canAll()) return null;

        return ['status' => 403, 'message' => "Tu rol no tiene permiso para {$text}: lo autoriza Dueño o Supervisor.", 'row' => []];
    }

    private function needCustomer() {
        if ($this->canCustomer()) return null;

        return ['status' => 403, 'message' => 'Tu rol no tiene permiso para cambiar el cliente de una venta.', 'row' => []];
    }

    private function needSales($action) {
        if (Permission::can(self::SALES, $action)) return null;

        $what = ['show' => 'ver ventas', 'create' => 'cobrar ventas', 'cancel' => 'cancelar ventas', 'print' => 'imprimir tickets'];
        $text = isset($what[$action]) ? $what[$action] : 'hacer esto';

        return ['status' => 403, 'message' => "Tu rol no tiene permiso para {$text} en esta sucursal.", 'row' => []];
    }

    // -- Ayudantes --

    // Lo que se debe: el total mas la propina.
    private function dueOf($s) {
        return round((float) $s['total'] + (float) $s['tip_amount'], 2);
    }

    // 404 con la frase de quien la busca: la Cajera solo encuentra lo suyo.
    private function missing($id) {
        if ($this->own()) return "La venta V{$id} no está entre tus ventas del turno abierto.";

        return "La venta V{$id} no existe en " . $this->scope()['branch'] . '.';
    }

    private function userName() {
        return isset($_SESSION['user']) ? trim((string) $_SESSION['user']) : '';
    }

    private function customerLabel($name, $phone) {
        $name = trim((string) $name) !== '' ? trim($name) : 'Sin nombre';

        return trim((string) $phone) !== '' ? $name . ' · ' . trim($phone) : $name;
    }

    // Los metodos con los que se cobra aqui: los visibles, sin el monedero (solo se usa al vender).
    private function saleMethods() {
        return array_values(array_filter(
            $this->qPaymentMethods($this->branchId()),
            fn ($m) => !$this->isWalletCode($m['code'])
        ));
    }

    // Algun pago vivo de la venta se hizo con el monedero del cliente.
    private function paidWithWallet(array $payments) {
        foreach ($payments as $payment) {
            if ($this->isWalletCode($payment['method_code'])) return true;
        }

        return false;
    }

    // [{method_id, amount, tendered}] limpio, o la respuesta 422. Sin pagos = [].
    private function paymentsInput() {
        if ($this->post('payments') === '') return [];

        $list = $this->postedJson('payments');

        if ($list === null)                    return $this->fail(422, 'Los pagos llegaron mal. Recarga la página e intenta de nuevo.');
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

    // Pagos contra los metodos de la base y el saldo. Devuelve los renglones o la respuesta de error.
    private function paymentRows(array $payments, $balance) {
        $methods = [];

        foreach ($this->saleMethods() as $method) {
            $methods[(int) $method['id']] = $method;
        }

        $purse   = $this->qWalletMethod($this->branchId());
        $purseId = $purse ? (int) $purse['id'] : 0;

        $rows = [];
        $sum  = 0;

        foreach ($payments as $payment) {
            if ($purseId > 0 && (int) $payment['method_id'] === $purseId) {
                return $this->fail(422, 'El monedero solo se usa al vender: aquí cobra con otro método.');
            }

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

    // -- Consultas de ventas (tipo 3) --

    // La de qGetOrder con propina y vendedor. $own = solo lo de la Cajera.
    private function qGetSale($id, $own) {
        $data  = [$id, $this->branchId(), self::SALE_TYPE];
        $where = '';

        if ($own) {
            $where  = ' AND s.user_id = ? AND s.turn_id = ?';
            $data[] = $own['user_id'];
            $data[] = $own['turn_id'];
        }

        return $this->qRow("
            SELECT
                s.id,
                s.folio,
                s.note,
                s.cancel_reason,
                s.discount_note,
                s.subtotal,
                s.discount_amount,
                s.discount_percent,
                IFNULL(s.tip_amount, 0) AS tip_amount,
                s.total,
                s.delivery_method,
                s.delivery_status,
                s.cancelled_at,
                s.created_at,
                s.sale_status_id,
                s.customer_id,
                s.user_id,
                s.turn_id,
                s.daily_closure_id,
                {$this->qCutSql('s')},
                IFNULL(st.name, '')  AS status,
                IFNULL(c.name, '')   AS customer,
                IFNULL(c.phone, '')  AS phone,
                IFNULL(c.email, '')  AS email,
                IFNULL(dr.name, '')  AS discount_reason,
                s.card_id,
                IFNULL(cd.number, '') AS card_number,
                IFNULL(ct.name, '')   AS card_type,
                CONCAT_WS(' ', uc.name, uc.last_name) AS created_by,
                CONCAT_WS(' ', ux.name, ux.last_name) AS cancelled_by,
                {$this->qPaidSql('s')} AS paid
            FROM {$this->pos}sale s
            LEFT JOIN {$this->pos}sale_status st     ON st.id = s.sale_status_id
            LEFT JOIN {$this->pos}customer c         ON c.id  = s.customer_id
            LEFT JOIN {$this->pos}discount_reason dr ON dr.id = s.discount_reason_id
            LEFT JOIN {$this->pos}card cd            ON cd.id = s.card_id
            LEFT JOIN {$this->pos}card_type ct       ON ct.id = cd.card_type_id
            LEFT JOIN {$this->bd}users uc            ON uc.id = s.user_id
            LEFT JOIN {$this->bd}users ux            ON ux.id = s.cancel_user_id
            WHERE s.id = ?
                AND s.branch_id = ?
                AND s.sale_type_id = ?
                AND IFNULL(s.active, 1) = 1
                {$where}
            LIMIT 1
        ", $data);
    }

    // La venta bloqueada hasta el commit. Solo dentro de transaction().
    private function qLockSale($id, $own) {
        $data  = [$id, $this->branchId(), self::SALE_TYPE];
        $where = '';

        if ($own) {
            $where  = ' AND s.user_id = ? AND s.turn_id = ?';
            $data[] = $own['user_id'];
            $data[] = $own['turn_id'];
        }

        return $this->qRow("
            SELECT
                s.id,
                s.customer_id,
                s.sale_status_id,
                s.subtotal,
                s.discount_amount,
                IFNULL(s.tip_amount, 0) AS tip_amount,
                s.total,
                s.turn_id,
                s.daily_closure_id,
                {$this->qCutSql('s')},
                {$this->qPaidSql('s')} AS paid
            FROM {$this->pos}sale s
            WHERE s.id = ?
                AND s.branch_id = ?
                AND s.sale_type_id = ?
                AND IFNULL(s.active, 1) = 1
                {$where}
            LIMIT 1
            FOR UPDATE
        ", $data);
    }

    /*  La lista. Con turno se ignoran las fechas; con metodo, las ventas que
        tengan un pago vivo con ese metodo. */
    private function qListSales(array $f) {
        $data  = [$f['branch_id'], self::SALE_TYPE];
        $where = '';

        if ($f['turn_id'] !== 0) {
            $where .= ' AND s.turn_id = ?';
            $data[] = $f['turn_id'];
        } else {
            $where .= ' AND s.created_at >= ? AND s.created_at < ?';
            $data[] = $f['from'];
            $data[] = $f['to'];
        }

        if ($f['user_id'] !== 0) {
            $where .= ' AND s.user_id = ?';
            $data[] = $f['user_id'];
        }

        if ($f['method_id'] > 0) {
            $where .= " AND EXISTS (SELECT 1 FROM {$this->pos}payment pf
                                     WHERE pf.sale_id = s.id
                                       AND pf.payment_method_id = ?
                                       AND IFNULL(pf.active, 1) = 1
                                       AND pf.deleted_at IS NULL)";
            $data[] = $f['method_id'];
        }

        return $this->qRows("
            SELECT
                s.id,
                s.folio,
                s.created_at,
                s.sale_status_id,
                s.turn_id,
                s.subtotal,
                s.discount_amount,
                s.total,
                IFNULL(s.tip_amount, 0) AS tip_amount,
                IFNULL(st.name, '')     AS status,
                IFNULL(c.name, '')      AS customer,
                IFNULL(c.phone, '')     AS phone,
                CONCAT_WS(' ', u.name, u.last_name) AS seller,
                IFNULL(t.folio, '')     AS turn_folio,
                (SELECT GROUP_CONCAT(DISTINCT IFNULL(pm.name, 'Sin método') SEPARATOR ', ')
                   FROM {$this->pos}payment p
                   LEFT JOIN {$this->pos}payment_method pm ON pm.id = p.payment_method_id
                  WHERE p.sale_id = s.id
                    AND IFNULL(p.active, 1) = 1
                    AND p.deleted_at IS NULL) AS methods,
                (SELECT COUNT(*)
                   FROM {$this->pos}receivable r
                  WHERE r.sale_id = s.id
                    AND r.kind = 'cargo'
                    AND IFNULL(r.active, 1) = 1
                    AND r.deleted_at IS NULL) AS on_credit,
                {$this->qPaidSql('s')} AS paid
            FROM {$this->pos}sale s
            LEFT JOIN {$this->pos}sale_status st ON st.id = s.sale_status_id
            LEFT JOIN {$this->pos}customer c     ON c.id  = s.customer_id
            LEFT JOIN {$this->bd}users u         ON u.id  = s.user_id
            LEFT JOIN {$this->pos}turn t         ON t.id  = s.turn_id
            WHERE s.branch_id = ?
                AND s.sale_type_id = ?
                AND IFNULL(s.active, 1) = 1
                {$where}
            ORDER BY s.id DESC
            LIMIT " . self::MAX_ROWS, $data);
    }

    // Los turnos abiertos en el periodo, para el filtro.
    private function qTurnsInRange($branchId, $from, $to) {
        return $this->qRows("
            SELECT t.id, t.folio, t.status, IFNULL(t.opened_at, t.created_at) AS opened_at
            FROM {$this->pos}turn t
            WHERE " . $this->qDayTurnWhere('t') . "
            ORDER BY t.id DESC
            LIMIT 100
        ", [$branchId, $from, $to]);
    }
}

Permission::dispatch(new ctrl(), ctrl::HISTORY);
