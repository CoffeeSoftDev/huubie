<?php
require_once __DIR__ . '/../../../core/security/_Session.php';
if (empty($_POST['opc'])) exit(0);

require_once __DIR__ . '/core-order.php';
require_once __DIR__ . '/../mdl/mdl-tickets.php';

/*  Tickets/Cierre › vista «Tickets»: el «Reporte por tickets» de
    alpha/order-visor con los datos del POS.

    Reglas que no se ven en el codigo de un vistazo:
      - Pedidos (P: sale_type 1, y 4 = tienda en linea sin aceptar) y ventas de
        mostrador (V: 2 y 3) de la sucursal activa, por fecha de captura.
      - Vendido = total de los tickets en Pendiente o Pagado (la regla del corte).
        La cotizacion y lo cancelado salen en la lista, pero no suman.
      - Cobrado = pagos vivos del ticket, de cualquier turno.
      - Solo lectura. Entra por pos-tickets ('show'); imprimir lo decide la
        pantalla con 'print' de pos-tickets. */
class ctrl extends core {

    use TicketVisor;

    const MAX_ROWS = 2000;
    const KINDS    = [1 => 'order', 2 => 'counter', 3 => 'counter', 4 => 'online'];
    const STATUSES = [1 => 'Cotización', 2 => 'Pendiente', 3 => 'Pagado', 4 => 'Cancelado'];

    // -- Lista --

    public function lsTickets() {
        $fail = $this->needTickets() ?: $this->needBranch();
        if ($fail) return $fail;

        return $this->attempt(function () {
            [$from, $to] = $this->postRange();

            $rows  = $this->qTicketList($this->branchId(), $from, $to, self::MAX_ROWS + 1);
            $more  = count($rows) > self::MAX_ROWS;
            $items = array_map([$this, 'ticketItem'], array_slice($rows, 0, self::MAX_ROWS));
            $kinds = ['order' => 0, 'counter' => 0, 'online' => 0];
            $sold  = 0;

            foreach ($items as $item) {
                $kinds[$item['kind']]++;
                $sold += $item['sold'];
            }

            return [
                'status' => 200,
                'items'  => $items,
                'count'  => count($items),
                'more'   => $more,
                'sold'   => round($sold, 2),
                'kinds'  => $kinds,
                'branch' => $this->scope()['branch']
            ];
        }, 'No se pudieron leer los tickets.');
    }

    // Un renglon de la lista. balance = lo que falta cobrar (total + propina - cobrado).
    private function ticketItem($s) {
        $status = (int) $s['sale_status_id'];
        $total  = round((float) $s['total'], 2);
        $tip    = round((float) $s['tip_amount'], 2);
        $paid   = round((float) $s['paid'], 2);
        $alive  = $status !== self::CANCELLED;
        $type   = (int) $s['sale_type_id'];

        return [
            'id'         => (int) $s['id'],
            'folio'      => $this->saleFolio($type, $s['folio'], $s['id']),
            'kind'       => self::KINDS[$type] ?? 'order',
            'created_at' => $s['created_at'],
            'delivery'   => $s['delivery_date'] ? trim(substr((string) $s['delivery_date'], 0, 10) . ' ' . substr((string) $s['delivery_time'], 0, 5)) : '',
            'customer'   => trim((string) $s['customer']),
            'seller'     => trim((string) $s['seller']),
            'turn'       => (string) $s['turn_folio'],
            'status_id'  => $status,
            'status'     => $this->statusName($status, $s['status']),
            'total'      => $total,
            'tip'        => $tip,
            'paid'       => $paid,
            'balance'    => $alive ? max(round($total + $tip - $paid, 2), 0) : 0,
            'sold'       => in_array($status, [self::PENDING, self::PAID], true) ? $total : 0
        ];
    }

    // -- Detalle --

    public function getTicket() {
        $fail = $this->needTickets() ?: $this->needBranch();
        if ($fail) return $fail;

        $id = $this->postId();

        return $this->attempt(function () use ($id) {
            $sale = $id > 0 ? $this->qTicketSale($id, $this->branchId()) : null;

            if (!$sale) return $this->fail(404, "El ticket {$id} no existe en " . $this->scope()['branch'] . '.');

            $type     = (int) $sale['sale_type_id'];
            $kind     = self::KINDS[$type] ?? 'order';
            $lines    = $this->ticketLines($id);
            $payments = $this->qPayments($id);

            $sale['status'] = $this->statusName((int) $sale['sale_status_id'], $sale['status']);

            return [
                'status'   => 200,
                'branch'   => $this->scope()['branch'],
                'kind'     => $kind,
                'folio'    => $this->saleFolio($type, $sale['folio'], $id),
                'order'    => $sale,
                'lines'    => $lines,
                'payments' => $payments,
                'history'  => $this->qHistory($id),
                'limited'  => false,
                // La venta de mostrador se imprime con ordTicketHtml; el pedido, con OrderDetail.ticketHtml.
                'ticket'   => $kind === 'counter' ? $this->counterTicket($sale, $lines, $payments) : null
            ];
        }, 'No se pudo abrir el ticket.');
    }

    // Las lineas con las opciones del pastel personalizado: el ticket de pedido las pone debajo.
    private function ticketLines($saleId) {
        $lines   = $this->qOrderLines($saleId);
        $customs = [];

        foreach ($lines as $line) {
            if ((int) $line['is_custom'] === 1) $customs[] = (int) $line['product_id'];
        }

        $modifiers = $this->groupBy($this->qProductModifiers(array_values(array_unique($customs))), 'product_id');

        foreach ($lines as &$line) {
            $line['modifiers'] = ((int) $line['is_custom'] === 1 && isset($modifiers[$line['product_id']])) ? $modifiers[$line['product_id']] : [];
        }
        unset($line);

        return $lines;
    }

    /*  El ticket de venta con la forma de ticketOf (ctrl-historial): lo mismo
        que sale al reimprimir desde el Historial. credit = lo que sigue a
        crédito; points = lo abonado al monedero; stamps = sellos de esta compra. */
    private function counterTicket($s, array $lines, array $payments) {
        $alive    = (int) $s['sale_status_id'] !== self::CANCELLED;
        $tip      = round((float) $s['tip_amount'], 2);
        $total    = round((float) $s['total'], 2);
        $discount = round((float) $s['discount_amount'], 2);
        $credit   = $alive && (int) $s['on_credit'] > 0 ? max(round($total + $tip - (float) $s['paid'], 2), 0) : 0;
        $points   = $alive ? round((float) $s['points'], 2) : 0;
        $stamps   = $alive ? (int) $s['stamps'] : 0;
        $cardType = (string) $s['card_type'];
        $cardNum  = (string) $s['card_number'];
        // Sin motivo: el premio de sellos se nombra por su nota y el descuento de una tarjeta por su tipo, como al vender.
        $prize    = strpos((string) $s['discount_note'], 'Premio ') === 0 ? trim(explode(' · ', (string) $s['discount_note'])[0]) : '';
        $reason   = (string) $s['discount_reason'] !== '' ? $s['discount_reason'] : ($prize !== '' ? $prize : ($cardType !== '' ? 'Tarjeta ' . $cardType : ''));

        return [
            'folio'         => (string) ($s['folio'] ?: $s['id']),
            'branch'        => $this->scope()['branch'],
            'date'          => $s['created_at'],
            'user'          => trim((string) $s['created_by']),
            'customer'      => trim((string) $s['customer']) !== '' ? $s['customer'] : 'Público en general',
            'card'          => $cardNum !== '' ? ['type' => $cardType, 'number' => $cardNum] : null,
            'points'        => $points,
            'lines'         => array_map(fn ($l) => [
                'name'     => $l['name'] !== '' && $l['name'] !== null ? $l['name'] : $l['product_name'],
                'quantity' => (float) $l['quantity'],
                'price'    => round((float) $l['price'], 2),
                'details'  => (string) $l['details'],
                'discount' => round((float) $l['discount_amount'], 2),
                'amount'   => round((float) $l['price'] * (float) $l['quantity'] - (float) $l['discount_amount'], 2)
            ], $lines),
            'subtotal'      => round((float) $s['subtotal'], 2),
            'discount'      => $discount > 0 ? ['amount' => $discount, 'reason' => $reason] : null,
            'tip'           => $tip,
            'total'         => $total,
            'charged'       => round($total + $tip - $credit, 2),
            'credit'        => $credit,
            'payments'      => array_map(fn ($p) => [
                'method'   => $p['method'] !== '' ? $p['method'] : 'Sin método',
                'cash'     => (int) $p['is_cash'] === 1,
                'amount'   => round((float) $p['amount'], 2),
                'tendered' => round((float) $p['tendered_amount'], 2),
                'change'   => round((float) $p['change_amount'], 2)
            ], $payments),
            'cancelled'     => !$alive,
            'cancel_reason' => (string) $s['cancel_reason'],
            'stamps'        => $stamps > 0 ? ['earned' => $stamps, 'balance' => null, 'goal' => null, 'rewards' => 0, 'reward' => null] : null
        ];
    }

    // -- Ayudantes --

    private function statusName($id, $name) {
        $name = trim((string) $name);

        return $name !== '' ? $name : (self::STATUSES[$id] ?? 'Sin estado');
    }
}

Permission::dispatch(new ctrl(), core::TICKETS);
