<?php
require_once __DIR__ . '/../../../core/security/_Session.php';
if (empty($_POST['opc'])) exit(0);

require_once __DIR__ . '/core-order.php';
require_once __DIR__ . '/../mdl/mdl-credito.php';
require_once __DIR__ . '/../mdl/mdl-lealtad.php';
require_once __DIR__ . '/../mdl/mdl-ticket.php';

/*  Ventas › Vendido (antes «Historial»: V2 del plan de Ventas; desde el
    27/11/2026 se llama Vendido y vive en el menu de Ventas).

    Reglas que no se ven en el codigo de un vistazo:
      - Ventas de mostrador (V: sale_type_id 3) por fecha de captura o por turno.
      - Pedidos (P: tipo 1) por LO COBRADO: sus pagos que entraron en los turnos
        de la sucursal abiertos en el periodo (la regla del Corte Z), o en el
        turno elegido. El renglon trae solo eso cobrado; su saldo, el de siempre.
      - Todos ven lo mismo. Cobrar el saldo, quitar pagos, cancelar y
        descargar: solo quien cancela en pos-ventas (Dueño o Supervisor:
        canAll). Cambiar el cliente: quien edita en pos-ventas (update), como
        «Editar pedido» en Pedidos. La Cajera solo ve, imprime y manda el ticket.
      - Un pedido aqui es solo para ver (getPedido): se trabaja en Pedidos.
      - Lo cancelado sale en la lista, pero no suma.
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
    const ORDER_TYPE   = 1;
    const KINDS        = ['all', 'sale', 'order'];
    const MAX_PAYMENTS = 6;
    const MAX_AMOUNT   = 1000000;
    const MAX_NOTE     = 200;
    const MAX_REASON   = 255;
    const MAX_ROWS     = 2000;

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
            'tickets'   => Permission::actions(self::TICKETS),
            'today'     => date('Y-m-d'),
            'turn'      => $this->turnBrief(),
            'day'       => $this->dayBrief(),
            'user'      => ['id' => $this->userId(), 'name' => $this->userName()],
            'branch_id' => $this->branchId(),
            'can_all'   => $this->canAll(),
            // Descargar: solo Dueño o Supervisor (lsExport lo vuelve a revisar).
            'can_export' => $this->canAll(),
            'methods'   => $methods
        ];
    }

    // -- Lista --

    public function lsSales() {
        $fail = $this->needBranch();
        if ($fail) return $fail;

        return $this->attempt(function () {
            $filters = $this->listFilters();
            $items   = $this->listItems($filters);
            $open    = $this->qOpenTurn($this->branchId());
            $openId  = $open ? (int) $open['id'] : 0;
            $print   = Permission::can(self::HISTORY, 'print');
            $all     = $this->canAll();
            $rows    = [];

            foreach ($items as $item) {
                $rows[] = $item['kind'] === 'P'
                        ? $this->orderRow($item['data'], $openId, $print)
                        : $this->saleRow($item['data'], $openId, $print, $all);
            }

            $turns = [];

            foreach ($this->qTurnsInRange($this->branchId(), $filters['from'], $filters['to']) as $turn) {
                $opened  = strtotime($turn['opened_at']);
                $turns[] = [
                    'id'    => (int) $turn['id'],
                    'valor' => 'Turno ' . $turn['folio'] . ' · ' . date('d/m', $opened) . ' ' . date('g:i A', $opened) . ($turn['status'] === 'open' ? ' (abierto)' : '')
                ];
            }

            return [
                'status'  => 200,
                'row'     => $rows,
                'summary' => $this->summaryOf($items, $filters),
                'turns'   => $turns,
                'branch'  => $this->scope()['branch']
            ];
        }, 'No se pudo cargar lo vendido.');
    }

    // Lo que se ve en la lista, sin HTML, para el Excel. Solo Dueño o Supervisor.
    public function lsExport() {
        $fail = $this->needAll('descargar las ventas') ?: $this->needBranch();
        if ($fail) return $fail;

        return $this->attempt(function () {
            $rows = array_map([$this, 'exportRow'], $this->listItems($this->listFilters()));

            return ['status' => 200, 'row' => $rows];
        }, 'No se pudo preparar la descarga.');
    }

    // Periodo, turno, metodo y tipo (Todo · Ventas · Pedidos) de la barra de filtros.
    private function listFilters() {
        $fi = $this->postDate('fi', date('Y-m-d'));
        $ff = $this->postDate('ff', date('Y-m-d'));

        if ($fi > $ff) list($fi, $ff) = [$ff, $fi];

        $kind = (string) $this->post('kind');

        return [
            'branch_id' => $this->branchId(),
            'from'      => $fi . ' 00:00:00',
            'to'        => $this->dayRange($ff)[1],
            'turn_id'   => max(0, $this->postId('turn_id')),
            'method_id' => max(0, $this->postId('method_id')),
            'kind'      => in_array($kind, self::KINDS, true) ? $kind : 'all'
        ];
    }

    /*  Ventas (por captura) y pedidos (por cobro) en una sola lista, lo mas
        nuevo arriba. at = cuando se vendio la V o cuando se cobro la P. */
    private function listItems(array $f) {
        $items = [];

        if ($f['kind'] !== 'order') {
            foreach ($this->qListSales($f) as $sale) {
                $items[] = ['kind' => 'V', 'id' => (int) $sale['id'], 'at' => (string) $sale['created_at'], 'data' => $sale];
            }
        }

        if ($f['kind'] !== 'sale') {
            foreach ($this->qListOrderCharges($f) as $order) {
                $items[] = ['kind' => 'P', 'id' => (int) $order['id'], 'at' => (string) $order['charged_at'], 'data' => $order];
            }
        }

        usort($items, fn ($a, $b) => strcmp($b['at'], $a['at']) ?: $b['id'] <=> $a['id']);

        return array_slice($items, 0, self::MAX_ROWS);
    }

    /*  Los indicadores de arriba. Vendido = total de las V vivas + lo cobrado de
        las P vivas. methods = lo cobrado por forma de pago (con propina: es lo
        que entra a caja). credit = lo que las V dejaron a credito. */
    private function summaryOf(array $items, array $f) {
        $sum   = ['count' => 0, 'sales' => 0, 'orders' => 0, 'total' => 0, 'tips' => 0, 'credit' => 0, 'cancelled' => 0, 'methods' => []];
        $sales = [];
        $paid  = [];

        foreach ($items as $item) {
            $d = $item['data'];

            if ((int) $d['sale_status_id'] === self::CANCELLED) {
                $sum['cancelled']++;
                continue;
            }

            $sum['count']++;

            if ($item['kind'] === 'P') {
                $sum['orders']++;
                $sum['total'] += (float) $d['charged'];
                $paid[]        = $item['id'];
                continue;
            }

            $sum['sales']++;
            $sum['total'] += (float) $d['total'];
            $sum['tips']  += (float) $d['tip_amount'];
            $sales[]       = $item['id'];

            if ((int) $d['on_credit'] > 0) $sum['credit'] += max($this->dueOf($d) - (float) $d['paid'], 0);
        }

        $methods = [];

        foreach (array_merge($this->qSaleMethodTotals($sales), $this->qChargeMethodTotals($paid, $f)) as $m) {
            $key = (int) $m['id'];

            if (!isset($methods[$key])) $methods[$key] = ['name' => $m['name'], 'is_cash' => (int) $m['is_cash'], 'sort' => (int) $m['sort'], 'amount' => 0];

            $methods[$key]['amount'] += (float) $m['amount'];
        }

        usort($methods, fn ($a, $b) => $a['sort'] <=> $b['sort'] ?: strcmp($a['name'], $b['name']));

        $sum['methods'] = array_map(fn ($m) => ['name' => $m['name'], 'is_cash' => $m['is_cash'], 'amount' => round($m['amount'], 2)], $methods);
        $sum['total']   = round($sum['total'], 2);
        $sum['tips']    = round($sum['tips'], 2);
        $sum['credit']  = round($sum['credit'], 2);

        return $sum;
    }

    // Un renglon del Excel: texto plano, los importes como «$1,234.00» (createExcel los vuelve numero).
    private function exportRow(array $item) {
        $d       = $item['data'];
        $isOrder = $item['kind'] === 'P';
        $status  = (int) $d['sale_status_id'];
        $balance = $status === self::CANCELLED ? 0 : max(round($this->dueOf($d) - (float) $d['paid'], 2), 0);
        $seller  = trim((string) $d['seller']);

        return [
            'id'      => $item['id'],
            'Tipo'    => $isOrder ? 'Pedido' : 'Venta',
            'Folio'   => $this->saleFolio($isOrder ? self::ORDER_TYPE : self::SALE_TYPE, $d['folio'], $d['id']),
            'Fecha'   => date('d/m/Y g:i A', strtotime($item['at'])),
            'Cliente' => trim((string) $d['customer']) !== '' ? trim($d['customer']) : 'Público en general',
            'Atendió' => $seller !== '' ? $seller : 'Sin registro',
            'Turno'   => (string) ($isOrder ? $d['turns'] : $d['turn_folio']),
            'Métodos' => trim((string) $d['methods']),
            'Total'   => money($isOrder ? $d['charged'] : $d['total']),
            'Propina' => money($isOrder ? 0 : $d['tip_amount']),
            'Saldo'   => money($balance),
            'Estado'  => trim((string) $d['status']) !== '' ? $d['status'] : 'Sin estado'
        ];
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
            'Fecha'    => $this->cellDate($stamp),
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

    /*  Un pedido cobrado en el periodo. Fecha = su ultimo cobro del periodo;
        Atendió = quien lo cobro (si el pago no lo guardo, quien lo capturo);
        Total = lo cobrado en el periodo y, debajo, el total del pedido. */
    private function orderRow($o, $openId, $print) {
        $id        = (int) $o['id'];
        $statusId  = (int) $o['sale_status_id'];
        $cancelled = $statusId === self::CANCELLED;
        $inTurn    = $openId > 0 && in_array((string) $openId, explode(',', (string) $o['turn_ids']), true);
        $seller    = trim((string) $o['seller']);
        $methods   = trim((string) $o['methods']);
        $turns     = trim((string) $o['turns']);

        $menu = [['icon' => 'icon-eye', 'text' => 'Ver', 'onclick' => "orderDetail.showOrder({$id})"]];

        if ($print) $menu[] = ['icon' => 'icon-print', 'text' => 'Imprimir', 'onclick' => "orderDetail.print({$id}, 'order')"];

        return [
            'id'       => $id,
            'Folio'    => $this->cellFolio($id, $o['folio'], $inTurn, $cancelled, 'P'),
            'Fecha'    => $this->cellDate(strtotime($o['charged_at']), 'cobro'),
            'Cliente'  => $this->cellCustomer($o['customer'], $o['phone']),
            'Atendió'  => $seller !== '' ? '<span class="text-gray-700">' . h($seller) . '</span>' : '<span class="text-gray-400">Sin registro</span>',
            'Turno'    => $turns !== '' ? '<span class="text-gray-600 whitespace-nowrap">' . h($turns) . '</span>' : $this->cellZero(),
            'Métodos'  => $methods !== '' ? '<span class="text-gray-600">' . h($methods) . '</span>' : $this->cellZero(),
            'Total'    => $this->cellCharged($o['charged'], $o['total']),
            'Propina'  => $this->cellZero(),
            'Estado'   => $this->statusPill($statusId, $o['status'], $this->dueOf($o) - (float) $o['paid']),
            'dropdown' => $menu
        ];
    }

    // -- Celdas («V» venta, «P» pedido) --

    private function cellFolio($id, $folio, $inTurn, $cancelled, $kind = 'V') {
        $dot    = $inTurn ? '<span class="ord-dot" aria-label="Del turno abierto"></span>' : '';
        $mark   = $cancelled ? ' data-cancelled="1"' : '';
        $number = $folio !== null && $folio !== '' ? $folio : $id;
        $open   = $kind === 'P' ? 'orderDetail.showOrder(' . (int) $id . ')' : 'orderDetail.show(' . (int) $id . ')';
        $tag    = $kind === 'P' ? '<span class="ord-kind">Pedido</span>' : '';

        return '<button type="button" class="ord-folio" onclick="' . $open . '"' . $mark . '>'
             .   $dot . $kind . h($number)
             . '</button>' . $tag;
    }

    // La fecha y, debajo, la hora («· cobro» en los pedidos: es la hora en que se cobro).
    private function cellDate($stamp, $what = '') {
        if (!$stamp) return $this->cellZero();

        return '<span class="text-gray-600 whitespace-nowrap">' . shortDate(date('Y-m-d H:i:s', $stamp)) . '</span>'
             . '<div class="ord-sub">' . date('g:i A', $stamp) . ($what !== '' ? ' · ' . $what : '') . '</div>';
    }

    // Lo cobrado del pedido en el periodo y, si no es todo, de cuanto es el pedido.
    private function cellCharged($charged, $total) {
        $charged = round((float) $charged, 2);
        $total   = round((float) $total, 2);
        $html    = '<span class="font-semibold text-gray-800 whitespace-nowrap">' . money($charged) . '</span>';

        if (abs($total - $charged) > 0.005) {
            $html .= '<div class="text-[11px] text-gray-400 whitespace-nowrap">de ' . money($total) . '</div>';
        }

        return $html;
    }

    private function cellCustomer($name, $phone) {
        if (trim((string) $name) === '') return $this->customerBox('<span class="text-gray-500">Público en general</span>', false);

        $html = '<div class="font-semibold text-gray-800"><span class="ord-cliente">' . h($name) . '</span></div>';

        if ($phone !== '') $html .= '<div class="ord-sub">' . h($phone) . '</div>';

        return $this->customerBox($html, true);
    }

    // Círculo con el ícono de usuario a la izquierda (el de Puntos, order.css › .loy-avatar); apagado en Público en general.
    private function customerBox($html, $filled) {
        $avatar = '<span class="loy-avatar' . ($filled ? '' : ' is-empty') . '"><i data-lucide="user-round" class="w-4 h-4"></i></span>';

        return '<div class="loy-owner">' . $avatar . '<div class="min-w-0">' . $html . '</div></div>';
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
            $sale = $id > 0 ? $this->qGetSale($id) : null;

            if (!$sale) return $this->fail(404, $this->missing($id));

            return $this->saleBundle($sale);
        }, 'No se pudo abrir la venta.');
    }

    /*  Un pedido desde Vendido: el detalle de Pedidos (orderBundle), solo para
        ver. Sin acciones: el pedido se cobra, entrega o cancela en Pedidos.
        Imprimir va con el permiso de esta seccion. El de otra sucursal (se
        cobro aqui) se abre si el rol ve Vendido alla. */
    public function getPedido() {
        $fail = $this->needBranch();
        if ($fail) return $fail;

        $id = $this->postId();

        return $this->attempt(function () use ($id) {
            $bundle = $this->orderBundle($id, self::HISTORY);

            if ($bundle['status'] !== 200) return $bundle;

            $bundle['can']     = ['foreign_reason' => ''];
            $bundle['actions'] = Permission::actions(self::HISTORY);

            return $bundle;
        }, 'No se pudo abrir el pedido.');
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
            /*  La regla de cada boton es la de Pedidos: Enviar ticket = imprimir,
                Cambiar cliente = editar (update, como «Editar pedido») y
                Cancelar = cancel. Con los roles de hoy, la Cajera solo ve, imprime y manda el ticket. */
            'can'      => [
                'pay'            => $alive && $owes && $this->canAll() && Permission::can(self::SALES, 'create'),
                'pay_reason'     => '',
                'delete_payment' => $alive && $this->canAll(),
                'cancel'         => $alive && $this->canAll(),
                'cancel_reason'  => $alive ? '' : 'La venta ya está cancelada.',
                'customer'       => $alive && !$tied && Permission::can(self::SALES, 'update'),
                'edit'           => false,
                'edit_reason'    => '',
                'money'          => true,
                'money_reason'   => '',
                'deliver'        => false,
                'settle'         => false,
                'delivery_state' => false
            ],
            'limited'  => false,
            'ticket'   => $this->ticketOf($sale, $lines, $payments, $credit, $points ? (float) $points['amount'] : 0) + ['stamps' => $alive ? $this->saleStampsInfo($id) : null],
            // V7: el enlace al ticket va con el mismo permiso que imprimirlo.
            'share'    => in_array('print', (array) $actions, true) ? $this->ticketShare($id, $sale['phone']) : null
        ];
    }

    /*  Los sellos que sumo la venta, para la reimpresion. Solo lo de esta compra:
        cuantos tenia la tarjeta en ese momento no se guarda (balance null). */
    private function saleStampsInfo($saleId) {
        $rows   = $this->qSaleStamps($saleId);
        $earned = array_sum(array_map(fn ($r) => $r['kind'] === 'sello' ? (int) $r['qty'] : 0, $rows));

        return $earned > 0 ? ['earned' => $earned, 'balance' => null, 'goal' => null, 'rewards' => 0, 'reward' => null] : null;
    }

    // La forma de ticketData de ctrl-ventas, con lo guardado. $credit = lo que sigue a credito; $points = abonado al monedero.
    private function ticketOf($s, array $lines, array $payments, $credit = 0, $points = 0) {
        $tip      = round((float) $s['tip_amount'], 2);
        $total    = round((float) $s['total'], 2);
        $discount = round((float) $s['discount_amount'], 2);
        $cardType = (string) ($s['card_type'] ?? '');
        $cardNum  = (string) ($s['card_number'] ?? '');
        // El descuento de una tarjeta no tiene motivo: se nombra por su tipo, como al vender; el premio de sellos, por su nota («Premio Café gratis · …»).
        $prize    = strpos((string) ($s['discount_note'] ?? ''), 'Premio ') === 0 ? trim(explode(' · ', (string) $s['discount_note'])[0]) : '';
        $reason   = (string) $s['discount_reason'] !== '' ? $s['discount_reason'] : ($prize !== '' ? $prize : ($cardType !== '' ? 'Tarjeta ' . $cardType : ''));

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
            $sale = $id > 0 ? $this->qGetSale($id) : null;

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
        if (!$this->canAll() || !Permission::can(self::SALES, 'create')) {
            return ['kind' => 'role', 'title' => 'Solo ver', 'message' => 'Aquí el saldo lo cobra Dueño o Supervisor.', 'day' => false];
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
        $fail = $this->needAll('cobrar desde Vendido') ?: $this->needSales('create') ?: $this->needBranch();
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
                $sale = $this->qLockSale($id);

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
                $sale = $this->qLockSale($id);

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
                $sale = $this->qLockSale($id);

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

                // Sellos de la tarjeta (Lealtad): se anulan los que dio y regresa el premio que canjeó.
                $stampRows = $this->qSaleStamps($id);
                $stampsOut = array_sum(array_map(fn ($s) => $s['kind'] === 'sello' ? (int) $s['qty'] : 0, $stampRows));
                $stampsIn  = array_sum(array_map(fn ($s) => $s['kind'] === 'canje' ? -(int) $s['qty'] : 0, $stampRows));

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
                if ($stampRows) $this->voidSaleStamps($id, 'cancelSale stamps');

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

                if ($stampsOut > 0) $notes[] = 'Se quitan ' . $stampsOut . ($stampsOut === 1 ? ' sello' : ' sellos') . ' de la tarjeta.';
                if ($stampsIn > 0)  $notes[] = 'Regresan a la tarjeta los ' . $stampsIn . ' sellos del premio que se canjeó.';

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

                // Lo que la venta sacó del almacén regresa (core::invSaleBack).
                $this->invSaleBack($id, "Venta V{$id} cancelada: {$reason}");

                return $this->ok($message, ['id' => $id, 'returned' => $open, 'wallet' => round($closed + $purse, 2), 'credit' => $debt, 'points' => $clawed]);
            });
        }, 'No se pudo cancelar la venta.');
    }

    // -- Cambiar el cliente --

    public function customerOptions() {
        $fail = $this->needSales('update') ?: $this->needBranch();
        if ($fail) return $fail;

        $id = $this->postId();

        return $this->attempt(function () use ($id) {
            $sale = $id > 0 ? $this->qGetSale($id) : null;

            if (!$sale) return $this->fail(404, $this->missing($id));

            $customers = [];

            foreach ($this->qCustomerOptions($this->branchId(), (int) $sale['customer_id']) as $c) {
                $customers[] = ['id' => (int) $c['id'], 'valor' => $this->customerLabel($c['name'], $c['phone'])];
            }

            return ['status' => 200, 'customers' => $customers, 'customer_id' => (int) $sale['customer_id']];
        }, 'No se pudieron cargar los clientes.');
    }

    public function setCustomer() {
        $fail = $this->needSales('update') ?: $this->needBranch();
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
                $sale = $this->qLockSale($id);

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

    /*  Dueño o Supervisor: quien puede cancelar en pos-ventas. Todos ven todo;
        solo ellos cambian algo o descargan (la Cajera solo ve). */
    private function canAll() {
        return Permission::can(self::SALES, 'cancel');
    }

    private function needAll($text) {
        if ($this->canAll()) return null;

        return ['status' => 403, 'message' => "Tu rol no tiene permiso para {$text}: lo autoriza Dueño o Supervisor.", 'row' => []];
    }

    private function needSales($action) {
        if (Permission::can(self::SALES, $action)) return null;

        $what = ['show' => 'ver ventas', 'create' => 'cobrar ventas', 'update' => 'cambiar el cliente de una venta', 'cancel' => 'cancelar ventas', 'print' => 'imprimir tickets'];
        $text = isset($what[$action]) ? $what[$action] : 'hacer esto';

        return ['status' => 403, 'message' => "Tu rol no tiene permiso para {$text} en esta sucursal.", 'row' => []];
    }

    // -- Ayudantes --

    // Lo que se debe: el total mas la propina.
    private function dueOf($s) {
        return round((float) $s['total'] + (float) $s['tip_amount'], 2);
    }

    private function missing($id) {
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

    // La de qGetOrder con propina y vendedor.
    private function qGetSale($id) {
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
            LEFT JOIN {$this->crm}card cd            ON cd.id = s.card_id
            LEFT JOIN {$this->crm}card_type ct       ON ct.id = cd.card_type_id
            LEFT JOIN {$this->bd}users uc            ON uc.id = s.user_id
            LEFT JOIN {$this->bd}users ux            ON ux.id = s.cancel_user_id
            WHERE s.id = ?
                AND s.branch_id = ?
                AND s.sale_type_id = ?
                AND IFNULL(s.active, 1) = 1
            LIMIT 1
        ", [$id, $this->branchId(), self::SALE_TYPE]);
    }

    // La venta bloqueada hasta el commit. Solo dentro de transaction().
    private function qLockSale($id) {
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
            LIMIT 1
            FOR UPDATE
        ", [$id, $this->branchId(), self::SALE_TYPE]);
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

    // -- Consultas de pedidos cobrados (tipo 1) --

    /*  Los pagos que cuentan: los de los turnos de la sucursal abiertos en el
        periodo (qDayTurnWhere, la regla del Corte Z) o los del turno elegido.
        Un pago sin turno (los viejos de alpha) no entra. Agrega sus valores a $data. */
    private function chargeWhere(array $f, array &$data) {
        if ($f['turn_id'] !== 0) {
            array_push($data, $f['turn_id'], $f['branch_id']);

            return 't.id = ? AND t.branch_id = ?';
        }

        array_push($data, $f['branch_id'], $f['from'], $f['to']);

        return $this->qDayTurnWhere('t');
    }

    /*  Un renglon por pedido con lo cobrado en el periodo: cuanto, el ultimo
        cobro, con que metodos, en que turnos y quien cobro al ultimo
        (receiver_id; vacio si el pago no lo guardo). Con metodo, los pedidos
        que tengan un cobro del periodo con ese metodo. */
    private function qListOrderCharges(array $f) {
        $data   = [];
        $where  = $this->chargeWhere($f, $data);
        $having = '';

        if ($f['method_id'] > 0) {
            $having = 'HAVING SUM(p.payment_method_id = ?) > 0';
            $data[] = $f['method_id'];
        }

        return $this->qRows("
            SELECT
                s.id,
                s.folio,
                s.sale_status_id,
                s.subtotal,
                s.discount_amount,
                s.total,
                IFNULL(s.tip_amount, 0) AS tip_amount,
                IFNULL(st.name, '')     AS status,
                IFNULL(c.name, '')      AS customer,
                IFNULL(c.phone, '')     AS phone,
                ch.charged,
                ch.charged_at,
                ch.methods,
                ch.turns,
                ch.turn_ids,
                COALESCE(NULLIF(CONCAT_WS(' ', ur.name, ur.last_name), ''), CONCAT_WS(' ', u.name, u.last_name)) AS seller,
                {$this->qPaidSql('s')} AS paid
            FROM (
                SELECT
                    p.sale_id,
                    ROUND(SUM(p.amount), 2)                        AS charged,
                    MAX(COALESCE(p.paid_at, p.created_at))         AS charged_at,
                    GROUP_CONCAT(DISTINCT IFNULL(pm.name, 'Sin método') SEPARATOR ', ') AS methods,
                    GROUP_CONCAT(DISTINCT t.folio ORDER BY t.id SEPARATOR ', ')       AS turns,
                    GROUP_CONCAT(DISTINCT t.id ORDER BY t.id)                          AS turn_ids,
                    SUBSTRING_INDEX(GROUP_CONCAT(p.user_id ORDER BY COALESCE(p.paid_at, p.created_at) DESC, p.id DESC), ',', 1) AS receiver_id
                FROM {$this->pos}payment p
                JOIN {$this->pos}turn t                 ON t.id  = p.turn_id
                JOIN {$this->pos}sale sx                ON sx.id = p.sale_id AND sx.sale_type_id = " . self::ORDER_TYPE . "
                LEFT JOIN {$this->pos}payment_method pm ON pm.id = p.payment_method_id
                WHERE {$where}
                    AND IFNULL(p.active, 1) = 1
                    AND p.deleted_at IS NULL
                GROUP BY p.sale_id
                {$having}
            ) ch
            JOIN {$this->pos}sale s              ON s.id  = ch.sale_id
            LEFT JOIN {$this->pos}sale_status st ON st.id = s.sale_status_id
            LEFT JOIN {$this->pos}customer c     ON c.id  = s.customer_id
            LEFT JOIN {$this->bd}users ur        ON ur.id = ch.receiver_id
            LEFT JOIN {$this->bd}users u         ON u.id  = s.user_id
            WHERE IFNULL(s.active, 1) = 1
            ORDER BY ch.charged_at DESC, s.id DESC
            LIMIT " . self::MAX_ROWS, $data);
    }

    // Lo cobrado por metodo de las ventas de la lista (todos sus pagos vivos).
    private function qSaleMethodTotals(array $ids) {
        if (!$ids) return [];

        return $this->qRows("
            SELECT
                IFNULL(pm.id, 0)              AS id,
                IFNULL(pm.name, 'Sin método') AS name,
                IFNULL(pm.is_cash, 0)         AS is_cash,
                IFNULL(pm.sort, 99)           AS sort,
                IFNULL(SUM(p.amount), 0)      AS amount
            FROM {$this->pos}payment p
            LEFT JOIN {$this->pos}payment_method pm ON pm.id = p.payment_method_id
            WHERE p.sale_id IN (" . implode(',', array_fill(0, count($ids), '?')) . ")
                AND IFNULL(p.active, 1) = 1
                AND p.deleted_at IS NULL
            GROUP BY pm.id, pm.name, pm.is_cash, pm.sort
        ", array_values($ids));
    }

    // Lo cobrado por metodo de los pedidos de la lista, solo en el periodo (chargeWhere).
    private function qChargeMethodTotals(array $ids, array $f) {
        if (!$ids) return [];

        $data  = array_values($ids);
        $where = $this->chargeWhere($f, $data);

        return $this->qRows("
            SELECT
                IFNULL(pm.id, 0)              AS id,
                IFNULL(pm.name, 'Sin método') AS name,
                IFNULL(pm.is_cash, 0)         AS is_cash,
                IFNULL(pm.sort, 99)           AS sort,
                IFNULL(SUM(p.amount), 0)      AS amount
            FROM {$this->pos}payment p
            JOIN {$this->pos}turn t                 ON t.id  = p.turn_id
            LEFT JOIN {$this->pos}payment_method pm ON pm.id = p.payment_method_id
            WHERE p.sale_id IN (" . implode(',', array_fill(0, count($ids), '?')) . ")
                AND {$where}
                AND IFNULL(p.active, 1) = 1
                AND p.deleted_at IS NULL
            GROUP BY pm.id, pm.name, pm.is_cash, pm.sort
        ", $data);
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
