<?php
require_once __DIR__ . '/../../../core/security/_Session.php';
if (empty($_POST['opc'])) exit(0);

require_once __DIR__ . '/core-order.php';

/*  Pedidos › lista y detalle. Etapa 1: SOLO CONSULTA, nada escribe.

    Reglas que no se ven en el codigo de un vistazo:
      - Buscar "1557", "P1557" o "P1557-04" encuentra el pedido 1557.
      - Con busqueda se ignoran el periodo y el estado; el tipo se respeta.
      - Saldo = total - pagado (sale.total ya es neto).
      - Punto verde = el pedido es del turno abierto de la sucursal. */
class ctrl extends core {

    // Estados de sale_status (plantillas de Huubie, iguales en todas las bases).
    const QUOTE     = 1;
    const PENDING   = 2;
    const PAID      = 3;
    const CANCELLED = 4;

    // -- Arranque --

    public function init() {
        $scope = $this->scope();

        return [
            'status'   => 200,
            'scope'    => ['company' => $scope['company'], 'branch' => $scope['branch']],
            'actions'  => $this->actions(),
            'statuses' => $scope['company_id'] > 0 ? $this->qStatuses($scope['company_id']) : [],
            'today'    => date('Y-m-d')
        ];
    }

    // -- Lista --

    public function lsOrders() {
        $fail = $this->need('show') ?: $this->needBranch();
        if ($fail) return $fail;

        return $this->attempt(function () {
            $filters = $this->listFilters();
            $turn    = $this->qOpenTurn($this->branchId());
            $turnId  = $turn ? (int) $turn['id'] : 0;
            $print   = in_array('print', $this->actions(), true);

            $rows = [];

            foreach ($this->qListOrders($filters) as $order) {
                $rows[] = $this->orderRow($order, $turnId, $print);
            }

            $answer = [
                'status' => 200,
                'row'    => $rows,
                'count'  => count($rows),
                'mode'   => $filters['search'] !== null ? 'search' : 'range',
                'branch' => $this->scope()['branch']
            ];

            if ($filters['search'] !== null) {
                $id = $filters['search']['id'];

                $answer['total'] = $this->qCountOrders($filters);
                $answer['exact'] = $id > 0 && !empty($rows) && (int) $rows[0]['id'] === $id;
            }

            return $answer;
        }, 'No se pudo cargar la lista de pedidos.');
    }

    // Filtros del POST, ya limpios.
    private function listFilters() {
        $fi = $this->postDate('fi', date('Y-m-01'));
        $ff = $this->postDate('ff', date('Y-m-t'));

        if ($fi > $ff) list($fi, $ff) = [$ff, $fi];

        $type = $this->post('order_type');

        return [
            'branch_id'  => $this->branchId(),
            'date_type'  => $this->post('date_type') === 'delivery' ? 'delivery' : 'created',
            'fi'         => $fi,
            'ff'         => $ff,
            'status'     => $this->selectOrNull('status'),
            'order_type' => in_array($type, ['custom', 'normal'], true) ? $type : '',
            'search'     => $this->searchTerms($this->post('q'))
        ];
    }

    /*  null = sin busqueda. Dos letras minimo, salvo que sea un folio.
          "P1557" / "P1557-04"  solo folio.
          "1557"                folio, nombre o telefono (el folio exacto sale primero).
          "Ana"                 nombre o telefono (si tiene 3 digitos o mas). */
    private function searchTerms($q) {
        $q = mb_substr(trim($q), 0, 60, 'UTF-8');

        if ($q === '') return null;

        if (preg_match('/^P(\d+)(?:-\d+)?$/i', $q, $m)) {
            return ['id' => (int) $m[1], 'like' => null, 'phone' => null];
        }

        $id = preg_match('/^(\d+)(?:-\d+)?$/', $q, $m) ? (int) $m[1] : 0;

        if ($id === 0 && mb_strlen($q, 'UTF-8') < 2) return null;

        $digits = preg_replace('/\D/', '', $q);

        return [
            'id'    => $id,
            'like'  => '%' . addcslashes($q, '%_\\') . '%',
            'phone' => strlen($digits) >= 3 ? '%' . $digits . '%' : null
        ];
    }

    // Una fila de la tabla. Las claves son los encabezados.
    private function orderRow($o, $turnId, $print) {
        $id        = (int) $o['id'];
        $statusId  = (int) $o['sale_status_id'];
        $cancelled = $statusId === self::CANCELLED;
        $custom    = (int) $o['is_custom'] === 1;
        $inTurn    = $turnId > 0 && (int) $o['turn_id'] === $turnId;

        $menu = [['icon' => 'icon-eye', 'text' => 'Ver', 'onclick' => "orderDetail.show({$id})"]];

        if ($print) {
            $menu[] = ['icon' => 'icon-print', 'text' => 'Imprimir', 'onclick' => "orderDetail.print({$id})"];
        }

        return [
            'id'               => $id,
            'Folio'            => $this->cellFolio($id, $o['folio'], $inTurn, $cancelled),
            'Creación'         => '<span class="text-gray-600">' . dmy($o['created_at']) . '</span>',
            'Cliente'          => $this->cellCustomer($o['customer'], $o['phone'], $custom),
            'Total'            => $this->cellTotal($o['total'], $o['subtotal'], $o['discount_amount']),
            'Abono'            => $this->cellPaid($o['paid']),
            'Saldo'            => $this->cellBalance((float) $o['total'] - (float) $o['paid']),
            'Fecha de entrega' => $this->cellDeliveryDate($o['delivery_date']),
            'Hora'             => '<span class="text-gray-600 whitespace-nowrap">' . hour12($o['delivery_time']) . '</span>',
            'Estado'           => $this->statusPill($statusId, $o['status']),
            'Entregado'        => $this->cellDelivered($statusId, (int) $o['delivery_status']),
            'Entrega'          => $this->cellMethod((int) $o['delivery_method']),
            'dropdown'         => $menu
        ];
    }

    // -- Celdas --

    private function cellFolio($id, $folio, $inTurn, $cancelled) {
        $dot  = $inTurn ? '<span class="ord-dot" aria-label="Del turno abierto"></span>' : '';
        $mark = $cancelled ? ' data-cancelled="1"' : '';

        return '<button type="button" class="ord-folio" onclick="orderDetail.show(' . (int) $id . ')"' . $mark . '>'
             .   $dot . 'P' . h($folio !== null && $folio !== '' ? $folio : $id)
             . '</button>';
    }

    private function cellCustomer($name, $phone, $custom) {
        $icon = $custom
              ? '<i data-lucide="cake" class="w-3.5 h-3.5 text-blue-600 shrink-0" aria-label="Pastel personalizado"></i>'
              : '';

        $html = '<div class="flex items-center gap-1.5 font-semibold text-gray-800">'
              .   $icon . '<span class="ord-cliente">' . h($name !== '' ? $name : 'Sin cliente') . '</span>'
              . '</div>';

        if ($phone !== '') $html .= '<div class="ord-sub">' . h($phone) . '</div>';

        return $html;
    }

    // Con descuento: el neto en verde y el bruto tachado debajo.
    private function cellTotal($total, $subtotal, $discount) {
        if ((float) $discount > 0) {
            return '<div class="font-bold text-emerald-700 whitespace-nowrap">' . money($total) . '</div>'
                 . '<div class="text-[11px] text-gray-400 line-through whitespace-nowrap">' . money($subtotal) . '</div>';
        }

        return '<span class="font-semibold text-gray-800 whitespace-nowrap">' . money($total) . '</span>';
    }

    private function cellPaid($paid) {
        $tone = (float) $paid > 0 ? 'text-emerald-700' : 'text-gray-400';

        return '<span class="' . $tone . ' whitespace-nowrap">' . money($paid) . '</span>';
    }

    // Negativo = pago de mas: se muestra como saldo a favor del cliente.
    private function cellBalance($balance) {
        $balance = round($balance, 2);

        if ($balance > 0) {
            return '<span class="font-bold text-red-600 whitespace-nowrap">' . money($balance) . '</span>';
        }

        if ($balance < 0) {
            return '<span class="font-semibold text-sky-700 whitespace-nowrap">' . money(abs($balance)) . '</span>'
                 . '<div class="ord-sub">a favor</div>';
        }

        return '<span class="text-gray-400 whitespace-nowrap">$0.00</span>';
    }

    // "Hoy" y "Mañana" en ambar debajo de la fecha.
    private function cellDeliveryDate($date) {
        if (!$date) return '<span class="text-gray-400">Sin fecha</span>';

        $day  = date('Y-m-d', strtotime($date));
        $tag  = '';

        if ($day === date('Y-m-d'))                         $tag = 'Hoy';
        if ($day === date('Y-m-d', strtotime('+1 day')))    $tag = 'Mañana';

        return '<span class="text-gray-800 whitespace-nowrap">' . dmy($date) . '</span>'
             . ($tag !== '' ? '<div class="text-[11px] font-semibold text-amber-600">' . $tag . '</div>' : '');
    }

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

    // Una cotizacion o un pedido cancelado no se entregan.
    private function cellDelivered($statusId, $deliveryStatus) {
        if ($statusId === self::QUOTE || $statusId === self::CANCELLED) {
            return '<span class="ord-sub">No aplica</span>';
        }

        if ($deliveryStatus === 1) {
            return '<span class="ord-pill bg-emerald-50 text-emerald-700">'
                 .   '<i data-lucide="circle-check" class="w-3.5 h-3.5"></i>Entregado'
                 . '</span>';
        }

        if ($deliveryStatus === 2) {
            return '<span class="font-semibold text-blue-600 whitespace-nowrap">En producción</span>';
        }

        return '<span class="text-gray-400 whitespace-nowrap">Sin entregar</span>';
    }

    private function cellMethod($method) {
        list($icon, $text) = $method === 1 ? ['truck', 'Envío a domicilio'] : ['package', 'Recoge en tienda'];

        return '<span class="inline-flex items-center gap-1.5 text-gray-600 whitespace-nowrap">'
             .   '<i data-lucide="' . $icon . '" class="w-4 h-4 text-gray-400"></i>' . $text
             . '</span>';
    }

    // -- Detalle --

    public function getOrder() {
        $fail = $this->need('show') ?: $this->needBranch();
        if ($fail) return $fail;

        $id = $this->postId();

        return $this->attempt(function () use ($id) {
            $branch = $this->scope()['branch'];
            $order  = $id > 0 ? $this->qGetOrder($id, $this->branchId()) : null;

            if (!$order) {
                return $this->fail(404, "El pedido P{$id} no existe en {$branch}.");
            }

            $lines    = $this->qOrderLines($id);
            $lineIds  = array_map('intval', array_column($lines, 'id'));
            $images   = $this->groupBy($this->qLineImages($lineIds), 'detail_sale_id');
            $customs  = [];

            foreach ($lines as $line) {
                if ((int) $line['is_custom'] === 1) $customs[] = (int) $line['product_id'];
            }

            $modifiers = $this->groupBy($this->qProductModifiers(array_values(array_unique($customs))), 'product_id');

            foreach ($lines as &$line) {
                $line['images']    = isset($images[$line['id']]) ? $images[$line['id']] : [];
                $line['modifiers'] = ((int) $line['is_custom'] === 1 && isset($modifiers[$line['product_id']]))
                                   ? $modifiers[$line['product_id']]
                                   : [];
            }
            unset($line);

            return [
                'status'   => 200,
                'branch'   => $branch,
                'order'    => $order,
                'lines'    => $lines,
                'payments' => $this->qPayments($id),
                'history'  => $this->qHistory($id),
                'actions'  => $this->actions()
            ];
        }, 'No se pudo abrir el pedido.');
    }

    private function groupBy(array $rows, $key) {
        $groups = [];

        foreach ($rows as $row) {
            $groups[$row[$key]][] = $row;
        }

        return $groups;
    }
}

Permission::dispatch(new ctrl(), core::SECTION);
