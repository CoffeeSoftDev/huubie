<?php
session_start();
if (empty($_POST['opc'])) exit(0);

require_once '../mdl/mdl-pos.php';
date_default_timezone_set('America/Mexico_City');

class ctrl extends mdl {

    function init() {
        $sub_id = $_SESSION['SUB'];

        $company_id = $_SESSION['COMPANY_ID'] ?? null;
        if (!$company_id) {
            $suc        = $this->getSucursalByID([$sub_id]);
            $company_id = $suc ? $suc['idCompany'] : 0;
        }

        $products = $this->lsProducts([$sub_id, $company_id]);
        $turno    = $this->getOpenShiftBySubsidiary([$sub_id]);
        $folio    = $this->getMaxOrderFolio();

        return [
            'products'        => is_array($products) ? $products : [],
            'turno'           => $this->turnoData($turno),
            'id_sub'          => $sub_id,
            'sucursal'        => $_SESSION['SUBSIDIARIE_NAME'] ?? '',
            'vendedor'        => $turno ? $turno['employee_name'] : '',
            'folio'           => $folio,
            'rol'             => $_SESSION['ROLID'] ?? 0,
            'paymentTypes'    => $this->lsPaymentTypes() ?: [],
            'discountReasons' => $this->lsDiscountReasons() ?: []
        ];
    }

    private function turnoData($turno) {
        if (!$turno) return null;

        $metrics = $this->getShiftMetrics([$turno['id']]);
        return [
            'id'             => $turno['id'],
            'nombre'         => $turno['shift_name'],
            'opened_at'      => $turno['opened_at'],
            'opening_amount' => (float)$turno['opening_amount'],
            'employee'       => $turno['employee_name'],
            'ventas'         => (float)$metrics['total_sales'],
            'ordenes'        => (int)$metrics['total_orders']
        ];
    }

    // =========================================================================
    // Turno (HU-08 — mismo cash_shift que el módulo de pedidos)
    // =========================================================================

    function openShift() {
        $sub_id = $_SESSION['SUB'];

        $existing = $this->getOpenShiftBySubsidiary([$sub_id]);
        if ($existing) {
            return [
                'status'  => 409,
                'message' => 'Ya existe un turno abierto para esta sucursal.',
                'turno'   => $this->turnoData($existing)
            ];
        }

        $shift_name     = trim($_POST['shift_name'] ?? '');
        $opening_amount = floatval($_POST['opening_amount'] ?? 0);

        if ($opening_amount < 0) {
            return ['status' => 400, 'message' => 'El fondo de caja no puede ser negativo'];
        }

        $this->createCashShift([
            'values' => 'subsidiary_id, employee_id, shift_name, opened_at, opening_amount, status, active',
            'data'   => [$sub_id, $_SESSION['ID'], $shift_name, date('Y-m-d H:i:s'), $opening_amount, 'open', 1]
        ]);

        $max   = $this->getMaxCashShift();
        $turno = $max ? $this->getCashShiftById($max['id']) : null;

        if (!$turno) {
            return ['status' => 500, 'message' => 'Error al crear el turno'];
        }

        return [
            'status'   => 200,
            'message'  => 'Turno abierto correctamente',
            'turno'    => $this->turnoData($turno),
            'vendedor' => $turno['employee_name']
        ];
    }

    function closeShift() {
        $shift_id = $_POST['shift_id'] ?? 0;
        $shift    = $this->getCashShiftById($shift_id);

        if (!$shift) {
            return ['status' => 404, 'message' => 'Turno no encontrado'];
        }
        if ($shift['status'] !== 'open') {
            return ['status' => 409, 'message' => 'Este turno ya fue cerrado'];
        }

        $closed_at     = date('Y-m-d H:i:s');
        $opened_at     = $shift['opened_at'];
        $subsidiary_id = $shift['subsidiary_id'];

        // Métricas combinadas pedidos + POS (mismo comportamiento que el módulo de pedidos)
        $metrics = $this->getShiftSalesMetrics([$shift_id, $opened_at, $closed_at, $subsidiary_id]);

        $total_sales    = (float)$metrics['total_sales'];
        $cash_sales     = (float)$metrics['cash_sales'];
        $card_sales     = (float)$metrics['card_sales'];
        $transfer_sales = (float)$metrics['transfer_sales'];
        $total_orders   = (int)$metrics['total_orders'];

        $this->closeCashShift([
            $closed_at, $total_sales, $cash_sales, $card_sales,
            $transfer_sales, $total_orders, $shift_id
        ]);

        // Desglose de pagos del turno
        $payments = [
            ['method_id' => 1, 'amount' => $cash_sales],
            ['method_id' => 2, 'amount' => $card_sales],
            ['method_id' => 3, 'amount' => $transfer_sales]
        ];
        foreach ($payments as $pay) {
            $this->createShiftPayment([
                'values' => 'cash_shift_id, payment_method_id, amount',
                'data'   => [$shift_id, $pay['method_id'], $pay['amount']]
            ]);
        }

        // Conteo por status
        $statuses = [
            ['status_id' => 1, 'amount' => (int)$metrics['quotation_count']],
            ['status_id' => 2, 'amount' => (int)$metrics['pending_count']],
            ['status_id' => 4, 'amount' => (int)$metrics['cancelled_count']]
        ];
        foreach ($statuses as $st) {
            $this->createShiftStatusProcess([
                'values' => 'cash_shift_id, status_process_id, amount',
                'data'   => [$shift_id, $st['status_id'], $st['amount']]
            ]);
        }

        // Ligar órdenes huérfanas de la ventana al turno
        $this->updateOrdersCashShift([$shift_id, $opened_at, $closed_at, $subsidiary_id]);

        return [
            'status'  => 200,
            'message' => 'Turno cerrado correctamente',
            'shift'   => $this->getCashShiftById($shift_id),
            'metrics' => $metrics
        ];
    }

    function getShiftsByDate() {
        if (($_SESSION['ROLID'] ?? 0) == 1) {
            $subsidiaries_id = $_POST['subsidiaries_id'] ?? $_SESSION['SUB'];
        } else {
            $subsidiaries_id = $_SESSION['SUB'];
        }

        $date   = $_POST['date'] ?? date('Y-m-d');
        $shifts = $this->getShiftsBySubsidiaryDate([$date, $subsidiaries_id]);

        return [
            'status' => 200,
            'shifts' => is_array($shifts) ? $shifts : []
        ];
    }

    function getOpenShifts() {
        if (($_SESSION['ROLID'] ?? 0) == 1) {
            $subsidiaries_id = $_POST['subsidiaries_id'] ?? $_SESSION['SUB'];
        } else {
            $subsidiaries_id = $_SESSION['SUB'];
        }

        $shifts = $this->getAllOpenShiftsBySubsidiary([$subsidiaries_id]);

        return [
            'status' => 200,
            'shifts' => is_array($shifts) ? $shifts : []
        ];
    }

    // Ticket de corte del turno (cerrado: valores guardados; abierto: en tiempo real)
    function getShiftTicket() {
        $shift_id = $_POST['shift_id'] ?? 0;
        $shift    = $this->getCashShiftById($shift_id);

        if (!$shift) {
            return ['status' => 404, 'message' => 'Turno no encontrado'];
        }

        $subsidiary      = $this->getSucursalByID([$shift['subsidiary_id']]);
        $subsidiary_name = $subsidiary ? $subsidiary['name'] : 'Sucursal';

        if ($shift['status'] === 'closed') {
            $statusCounts    = $this->getShiftStatusCounts([$shift_id]);
            $quotation_count = 0; $pending_count = 0; $cancelled_count = 0;
            foreach ($statusCounts as $sc) {
                switch ($sc['status_process_id']) {
                    case 1: $quotation_count = (int)$sc['amount']; break;
                    case 2: $pending_count   = (int)$sc['amount']; break;
                    case 4: $cancelled_count = (int)$sc['amount']; break;
                }
            }

            return [
                'status'          => 200,
                'shift'           => $shift,
                'subsidiary_name' => $subsidiary_name,
                'logo'            => $_SESSION['LOGO'] ?? '',
                'data' => [
                    'total_sales'     => $shift['total_sales'],
                    'cash_sales'      => $shift['cash'],
                    'card_sales'      => $shift['card'],
                    'transfer_sales'  => $shift['transfer'],
                    'total_orders'    => $shift['total_orders'],
                    'quotation_count' => $quotation_count,
                    'pending_count'   => $pending_count,
                    'cancelled_count' => $cancelled_count
                ]
            ];
        }

        $metrics = $this->getShiftSalesMetrics([
            $shift_id,
            $shift['opened_at'],
            date('Y-m-d H:i:s'),
            $shift['subsidiary_id']
        ]);

        return [
            'status'          => 200,
            'shift'           => $shift,
            'subsidiary_name' => $subsidiary_name,
            'logo'            => $_SESSION['LOGO'] ?? '',
            'data'            => $metrics
        ];
    }

    function getShiftOrders() {
        $shift_id = $_POST['shift_id'] ?? 0;
        $shift    = $this->getCashShiftById($shift_id);

        if (!$shift) {
            return ['status' => 404, 'message' => 'Turno no encontrado'];
        }

        $opened_at = $shift['opened_at'];
        $closed_at = $shift['status'] === 'closed' ? $shift['closed_at'] : date('Y-m-d H:i:s');

        $result = $this->getShiftDetailedOrders([$shift_id, $opened_at, $closed_at, $shift['subsidiary_id']]);

        return [
            'status'            => 200,
            'orders'            => $result['shift_orders'],
            'external_payments' => $result['external_payments']
        ];
    }

    function getActiveShifts() {
        $subsidiaries_id = $_POST['subsidiaries_id'] ?? '';
        $turnos = $this->lsCashShifts([$subsidiaries_id]);
        return [
            'turnos' => is_array($turnos) ? $turnos : []
        ];
    }

    function lsVentas() {
        $subsidiaries_id = $_POST['subsidiaries_id'] ?? 4;
        $cash_shift_id   = $_POST['cash_shift_id'] ?? '';
        $fi              = $_POST['fi'] ?? '2026-04-01';
        $ff              = $_POST['ff'] ?? '2026-05-15';
        $status          = $_POST['status'] ?? '';

        $ls = $this->listVentas([
            'subsidiaries_id' => $subsidiaries_id,
            'cash_shift_id'   => $cash_shift_id,
            'fi'              => $fi,
            'ff'              => $ff,
            'status'          => $status
        ]);

        if (!is_array($ls)) $ls = [];

        $__row = [];
        foreach ($ls as $item) {
            $isCancelled = (int)$item['status'] === 4;

            $a = [];
            $a[] = [
                'class'   => 'btn btn-sm btn-secondary me-1',
                'html'    => '<i class="icon-eye"></i>',
                'onclick' => 'app.onShowVenta(' . $item['id'] . ')'
            ];

            if ($isCancelled) {
                $a[] = ['class' => 'btn btn-sm btn-primary me-1 disabled',  'html' => '<i class="icon-pencil"></i>',      'onclick' => 'return false'];
                $a[] = ['class' => 'btn btn-sm btn-danger disabled',         'html' => '<i class="icon-trash-empty"></i>', 'onclick' => 'return false'];
            } else {
                $a[] = [
                    'class'   => 'btn btn-sm btn-primary me-1',
                    'html'    => '<i class="icon-pencil"></i>',
                    'onclick' => 'app.editarVenta(' . $item['id'] . ')'
                ];
                $a[] = [
                    'class'   => 'btn btn-sm btn-danger',
                    'html'    => '<i class="icon-trash-empty"></i>',
                    'onclick' => 'app.cancelarVenta(' . $item['id'] . ')'
                ];
            }

            $__row[] = [
                'id'        => $item['id'],
                'Folio'     => 'V-' . $item['id'],
                'Cliente'   => $item['client_name']
                                ? $item['client_name']
                                : '<span class="italic text-gray-400">N/A</span>',
                'Estatus'   => statusVenta($item['status']),
                'Fecha'     => formatSpanishDate($item['date_order']) . ' ' . substr($item['time_order'], 0, 5),
                'Total'     => evaluar($item['total_pay']),
                'Descuento' => $item['discount'] > 0 ? '-' . evaluar($item['discount']) : evaluar(0),
                'Pago'      => $item['payment_methods'] ?: '—',
                'a'         => $a
            ];
        }

        return ['row' => $__row];
    }

    function showVentas() {
        $subsidiaries_id = $_POST['subsidiaries_id'];
        $cash_shift_id   = $_POST['cash_shift_id'];
        $fi              = $_POST['fi'];
        $ff              = $_POST['ff'];

        $counts = $this->getVentaCounts([
            'subsidiaries_id' => $subsidiaries_id,
            'cash_shift_id'   => $cash_shift_id,
            'fi'              => $fi,
            'ff'              => $ff
        ]);

        return [
            'status' => 200,
            'counts' => $counts
        ];
    }

    function getVenta() {
        $id = $_POST['id'];

        $header = $this->getVentaById([$id]);
        $items  = $this->getVentaItems([$id]);
        $pagos  = $this->getVentaPagos([$id]);

        if (empty($header)) {
            return ['status' => 404, 'message' => 'Venta no encontrada'];
        }

        $v = $header[0];

        $itemsMapped = [];
        foreach ($items as $it) {
            $itemsMapped[] = [
                'id'           => $it['id'],
                'name'         => $it['order_details'] ?: 'Producto #' . $it['product_id'],
                'qty'          => (int)$it['quantity'],
                'price'        => (float)$it['price'],
                'discount'     => 0,
                'dedication'   => $it['dedication']
            ];
        }

        $pagosMapped = [];
        foreach ($pagos as $p) {
            $pagosMapped[] = [
                'clave'          => $p['payment_code'],
                'name'           => $p['payment_name'],
                'amount'         => (float)$p['amount'],
                'tendered'       => (float)$p['tendered_amount'],
                'change'         => (float)$p['change_amount']
            ];
        }

        $cliente = null;
        if ($v['client_id']) {
            $cliente = [
                'name'  => $v['client_name'],
                'phone' => $v['client_phone'],
                'email' => $v['client_email']
            ];
        }

        return [
            'status' => 200,
            'data'   => [
                'id'           => $v['id'],
                'folio'        => 'V-' . $v['id'],
                'estatus'      => $v['status'],
                'fecha'        => $v['date_order'] . 'T' . $v['time_order'],
                'sucursal'     => $v['sucursal_name'],
                'turno'        => $v['cash_shift_id'],
                'turnoCerrado' => !empty($v['daily_closure_id']),
                'nota'         => $v['note'],
                'cliente'      => $cliente,
                'items'        => $itemsMapped,
                'pagos'        => $pagosMapped
            ]
        ];
    }

    function editVenta() {
        $id     = $_POST['id'];
        $status = 500;
        $message = 'Error al actualizar la venta';

        $edit = $this->updateVenta($this->util->sql($_POST, 1));

        if ($edit) {
            $status  = 200;
            $message = 'Venta actualizada correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
    }

    function cancelVenta() {
        $id     = $_POST['id'];
        $status = 500;
        $message = 'No se pudo cancelar la venta';

        $values = $this->util->sql([
            'status'       => 4,
            'cancelled_at' => date('Y-m-d H:i:s'),
            'id'           => $id
        ], 1);

        $cancel = $this->updateVenta($values);

        if ($cancel) {
            $status  = 200;
            $message = 'Venta cancelada correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
    }

    // =========================================================================
    // Clientes (HU-02)
    // =========================================================================

    function searchClientsPos() {
        $term = trim($_POST['term'] ?? '');
        if (strlen($term) < 2) return ['status' => 200, 'clients' => []];

        $clients = $this->searchClients([$_SESSION['SUB'], $term]);
        return ['status' => 200, 'clients' => is_array($clients) ? $clients : []];
    }

    function createClientPos() {
        $name  = trim($_POST['name'] ?? '');
        $phone = preg_replace('/\D/', '', $_POST['phone'] ?? '');
        $email = trim($_POST['email'] ?? '');

        if ($name === '') {
            return ['status' => 400, 'message' => 'El nombre del cliente es obligatorio'];
        }

        $this->createClient([
            'values' => 'name, phone, email, active, date_create, subsidiaries_id',
            'data'   => [$name, $phone !== '' ? $phone : null, $email, 1, date('Y-m-d H:i:s'), $_SESSION['SUB']]
        ]);

        $client = $this->getLastClient([$_SESSION['SUB']]);

        return [
            'status'  => $client ? 200 : 500,
            'message' => $client ? 'Cliente registrado' : 'No se pudo registrar el cliente',
            'client'  => $client
        ];
    }

    // =========================================================================
    // Cobro (HU-03) — crea order tipo mostrador + items + pagos + descuentos
    // =========================================================================

    function payVenta() {
        $payload = json_decode($_POST['payload'] ?? '', true);

        if (empty($payload['items']) || !is_array($payload['items'])) {
            return ['status' => 400, 'message' => 'El ticket no tiene productos'];
        }
        if (empty($payload['payments']) || !is_array($payload['payments'])) {
            return ['status' => 400, 'message' => 'No se capturaron formas de pago'];
        }

        $sub_id = $_SESSION['SUB'];
        $turno  = $this->getOpenShiftBySubsidiary([$sub_id]);
        if (!$turno) {
            return ['status' => 409, 'message' => 'No hay un turno abierto. Abre un turno antes de cobrar.'];
        }

        // Precios reales desde BD — el cliente solo manda id, qty y descuento.
        $ids      = array_values(array_unique(array_map(fn($it) => (int)$it['id'], $payload['items'])));
        $rows     = $this->getProductsByIds($ids);
        $catalogo = [];
        foreach ($rows as $r) $catalogo[(int)$r['id']] = $r;

        $subtotal  = 0;
        $descItems = 0;
        $items     = [];
        foreach ($payload['items'] as $it) {
            $pid = (int)$it['id'];
            $qty = max(1, (int)$it['qty']);
            if (!isset($catalogo[$pid])) {
                return ['status' => 400, 'message' => 'Producto inválido en el ticket (#' . $pid . ')'];
            }
            $price   = (float)$catalogo[$pid]['price'];
            $discPct = min(100, max(0, (float)($it['discount'] ?? 0)));
            $bruto   = $price * $qty;

            $subtotal  += $bruto;
            $descItems += $bruto * ($discPct / 100);

            $items[] = [
                'id'        => $pid,
                'name'      => $catalogo[$pid]['name'],
                'qty'       => $qty,
                'price'     => $price,
                'cost'      => (float)($catalogo[$pid]['cost'] ?? 0),
                'discount'  => $discPct,
                'reason_id' => !empty($it['reason_id']) ? (int)$it['reason_id'] : null
            ];
        }

        // Descuento de cuenta (porcentaje o monto sobre la base tras descuentos por item)
        $base       = $subtotal - $descItems;
        $descCuenta = 0;
        $accDisc    = $payload['discount'] ?? null;
        if ($accDisc && (float)$accDisc['value'] > 0) {
            $descCuenta = $accDisc['type'] === 'porcentaje'
                ? $base * min(100, (float)$accDisc['value']) / 100
                : min((float)$accDisc['value'], $base);
        }

        $descuento = round($descItems + $descCuenta, 2);
        $total     = round($subtotal - $descuento, 2);

        $pagado = 0;
        foreach ($payload['payments'] as $p) $pagado += (float)$p['amount'];
        if (round($pagado, 2) < $total) {
            return ['status' => 400, 'message' => 'El pago capturado no cubre el total de la venta'];
        }

        // ── Orden (order_type mostrador + is_pos por compatibilidad) ──────────
        $now  = date('Y-m-d H:i:s');
        $note = trim($payload['note'] ?? '');

        $this->createVenta([
            'values' => 'date_creation, note, status, is_pos, total_pay, discount, info_discount, date_order, time_order, client_id, subsidiaries_id, cash_shift_id, order_type',
            'data'   => [
                $now,
                $note,
                3, // Pagado
                1,
                $total,
                $descuento,
                $accDisc ? json_encode($accDisc) : '',
                date('Y-m-d'),
                date('H:i:s'),
                !empty($payload['client_id']) ? (int)$payload['client_id'] : null,
                $sub_id,
                $turno['id'],
                'mostrador'
            ]
        ]);

        $max      = $this->getMaxOrderId();
        $order_id = $max ? (int)$max['id'] : 0;
        if (!$order_id) {
            return ['status' => 500, 'message' => 'No se pudo registrar la venta'];
        }

        // ── Items + descuentos por item ───────────────────────────────────────
        foreach ($items as $it) {
            $this->createOrderItem([
                'values' => 'date_creation, quantity, price, status, order_details, product_id, pedidos_id',
                'data'   => [$now, $it['qty'], $it['price'], 1, $it['name'], $it['id'], $order_id]
            ]);

            if ($it['discount'] > 0) {
                $pkg_id = $this->getMaxOrderPackageId();
                $monto  = $it['price'] * $it['qty'] * ($it['discount'] / 100);
                $this->createOrderDiscount([
                    'values' => 'scope, notes, amount, percentage, applied_at, order_id, order_package_id, pos_discount_reason_id, active',
                    'data'   => ['item', '', round($monto, 2), $it['discount'], $now, $order_id, $pkg_id, $it['reason_id'], 1]
                ]);
            }
        }

        // ── Salida de almacén por venta (kardex) ───────────────────────────────
        // Una merma con shrinkage_reason_id = 6 (Salida por venta) documenta la
        // baja de stock: header con folio VTA- + detalle con stock previo/resultante.
        $warehouse = $this->getDefaultWarehouse([$sub_id]);
        if ($warehouse) {
            $company_id = $_SESSION['COMPANY_ID'] ?? null;
            if (!$company_id) {
                $suc        = $this->getSucursalByID([$sub_id]);
                $company_id = $suc ? $suc['idCompany'] : 0;
            }

            $totalUnits = 0;
            $totalLoss  = 0;
            foreach ($items as $it) {
                $totalUnits += $it['qty'];
                $totalLoss  += $it['qty'] * $it['cost'];
            }

            $folio = $this->nextShrinkageFolio('VTA-', $company_id);
            $this->createShrinkage([
                $folio,
                'Salida por venta V-' . $order_id,
                null,
                count($items),
                $totalUnits,
                round($totalLoss, 2),
                'Aplicada',
                6, // shrinkage_reason: Salida por venta
                (int)$warehouse['id'],
                $sub_id,
                $_SESSION['ID'],
                $company_id
            ]);
            $shrinkage_id = $this->getShrinkageIdByFolio([$folio, $company_id]);

            foreach ($items as $it) {
                $stockRow = $this->getStockRow([$it['id'], (int)$warehouse['id']]);
                $prev     = $stockRow ? (float)$stockRow['quantity'] : 0;
                $post     = max(0, $prev - $it['qty']);

                $this->createShrinkageDetail([
                    $it['qty'],
                    $it['cost'],
                    round($it['qty'] * $it['cost'], 2),
                    $prev,
                    $post,
                    $it['id'],
                    $shrinkage_id
                ]);

                if ($stockRow) $this->updateStockQuantity([$post, (int)$stockRow['id']]);
            }
        }

        // ── Descuento de cuenta ────────────────────────────────────────────────
        if ($descCuenta > 0 && $accDisc) {
            $this->createOrderDiscount([
                'values' => 'scope, notes, amount, percentage, applied_at, order_id, pos_discount_reason_id, active',
                'data'   => [
                    'order',
                    trim($accDisc['notes'] ?? ''),
                    round($descCuenta, 2),
                    $accDisc['type'] === 'porcentaje' ? (float)$accDisc['value'] : 0,
                    $now,
                    $order_id,
                    !empty($accDisc['reason_id']) ? (int)$accDisc['reason_id'] : null,
                    1
                ]
            ]);
        }

        // ── Pagos ──────────────────────────────────────────────────────────────
        foreach ($payload['payments'] as $p) {
            $this->createOrderPayment([
                'values' => 'amount, tendered_amount, change_amount, paid_at, order_id, pos_payment_type_id, user_id, active',
                'data'   => [
                    (float)$p['amount'],
                    (float)($p['tendered'] ?? $p['amount']),
                    (float)($p['change'] ?? 0),
                    $now,
                    $order_id,
                    (int)$p['type_id'],
                    $_SESSION['ID'],
                    1
                ]
            ]);
        }

        return [
            'status'   => 200,
            'message'  => 'Venta registrada correctamente',
            'order_id' => $order_id,
            'folio'    => $this->getMaxOrderFolio(),
            'total'    => $total,
            'cambio'   => round($pagado - $total, 2),
            'turno'    => $this->turnoData($this->getCashShiftById($turno['id']))
        ];
    }
}

// Complements

function statusVenta($status) {
    $map = [
        1 => ['bg' => 'rgba(251,191,36,0.18)',  'color' => '#FBBF24', 'label' => 'PENDIENTE'],
        2 => ['bg' => 'rgba(28,100,242,0.18)',  'color' => '#1C64F2', 'label' => 'EN PROCESO'],
        3 => ['bg' => 'rgba(63,193,137,0.18)',  'color' => '#3FC189', 'label' => 'PAGADO'   ],
        4 => ['bg' => 'rgba(224,36,36,0.18)',   'color' => '#E02424', 'label' => 'CANCELADO'],
    ];
    $v = $map[(int)$status] ?? $map[1];
    return '<span class="px-2 py-0.5 rounded text-[10px] font-bold" style="background:' . $v['bg'] . ';color:' . $v['color'] . ';">' . $v['label'] . '</span>';
}

$obj = new ctrl();
echo json_encode($obj->{$_POST['opc']}());
