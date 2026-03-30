<?php
session_start();
if (empty($_POST['opc'])) exit(0);

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

require_once '../mdl/mdl-cierre.php';

class Cierre extends MCierre {

    private function resolveSubsidiary() {
        if ($_SESSION['ROLID'] == 1) {
            return $_POST['subsidiaries_id'];
        }
        return $_SESSION['SUB'];
    }

    function showCierre() {
        $date            = $_POST['date'];
        $subsidiaries_id = $this->resolveSubsidiary();

        if ($subsidiaries_id == 0 || $subsidiaries_id == '0') {
            return ['status' => 400, 'message' => 'Selecciona una sucursal'];
        }

        $checks   = [];
        $can_close = true;

        $existing = $this->getDailyClosureByDate([$date, $subsidiaries_id]);
        if ($existing) {
            $checks[] = ['key' => 'no_existing', 'ok' => false, 'blocker' => true, 'label' => 'Ya existe un cierre para esta fecha', 'detail' => 'Cerrado por ' . $existing['closed_by_name']];
            $can_close = false;
        } else {
            $checks[] = ['key' => 'no_existing', 'ok' => true, 'blocker' => true, 'label' => 'Sin cierre previo', 'detail' => 'No existe cierre para esta fecha y sucursal'];
        }

        $openShifts = $this->listOpenShifts([$date, $subsidiaries_id]);
        if (count($openShifts) > 0) {
            $items = [];
            foreach ($openShifts as $shift) {
                $items[] = ['id' => $shift['id'], 'name' => $shift['shift_name'], 'opened_at' => $shift['opened_at'], 'employee' => $shift['employee_name']];
            }
            $checks[] = ['key' => 'shifts_closed', 'ok' => false, 'blocker' => true, 'label' => count($openShifts) . ' turno(s) sin cerrar', 'items' => $items];
            $can_close = false;
        } else {
            $metrics = $this->getConsolidatedMetrics([$date, $subsidiaries_id]);
            $checks[] = ['key' => 'shifts_closed', 'ok' => true, 'blocker' => true, 'label' => 'Todos los turnos cerrados', 'detail' => $metrics['total_shifts'] . ' turno(s) cerrado(s) correctamente'];
        }

        $orphans = $this->listOrphanOrders([$date, $subsidiaries_id]);
        if (count($orphans) > 0) {
            $items = [];
            foreach ($orphans as $order) {
                $items[] = ['folio' => $order['folio'], 'date' => $order['date_creation'], 'total' => floatval($order['total_pay'])];
            }
            $checks[] = ['key' => 'orphan_orders', 'ok' => false, 'blocker' => false, 'label' => count($orphans) . ' pedido(s) sin turno asignado', 'items' => $items];
        } else {
            $checks[] = ['key' => 'orphan_orders', 'ok' => true, 'blocker' => false, 'label' => 'Todos los pedidos tienen turno', 'detail' => ''];
        }

        $pending = $this->listPendingBalance([$date, $subsidiaries_id]);
        if (count($pending) > 0) {
            $items = [];
            foreach ($pending as $order) {
                $items[] = ['folio' => $order['folio'], 'date' => $order['date_creation'], 'total' => floatval($order['total_pay']), 'paid' => floatval($order['total_paid']), 'pending' => floatval($order['pending_balance'])];
            }
            $checks[] = ['key' => 'pending_balance', 'ok' => false, 'blocker' => false, 'label' => count($pending) . ' pedido(s) con saldo pendiente', 'items' => $items];
        } else {
            $checks[] = ['key' => 'pending_balance', 'ok' => true, 'blocker' => false, 'label' => 'Sin saldos pendientes', 'detail' => ''];
        }

        $payments = $this->getConsolidatedPayments([$date, $subsidiaries_id]);
        $cash = 0; $card = 0; $transfer = 0;
        if (is_array($payments)) {
            foreach ($payments as $pay) {
                switch ($pay['method_pay_id']) {
                    case 1: $cash     = floatval($pay['total_paid']); break;
                    case 2: $card     = floatval($pay['total_paid']); break;
                    case 3: $transfer = floatval($pay['total_paid']); break;
                }
            }
        }
        $checks[] = ['key' => 'payments_ok', 'ok' => true, 'blocker' => false, 'label' => 'Formas de pago registradas', 'detail' => "Efectivo: $" . number_format($cash, 2) . " | Tarjeta: $" . number_format($card, 2) . " | Transf: $" . number_format($transfer, 2)];

        if (!isset($metrics)) {
            $metrics = $this->getConsolidatedMetrics([$date, $subsidiaries_id]);
        }
        $discount = $this->getDiscountTotal([$date, $subsidiaries_id]);
        $shifts   = $this->listShiftsDetail([$date, $subsidiaries_id]);

        $sub = $this->getSubsidiaryName([$subsidiaries_id]);
        $subsidiary_name = $sub ? $sub['sucursal'] : 'Sucursal';

        return [
            'status'          => 200,
            'can_close'       => $can_close,
            'checks'          => $checks,
            'summary'         => [
                'total_sales'    => floatval($metrics['total_sales']),
                'total_orders'   => intval($metrics['total_orders']),
                'total_shifts'   => intval($metrics['total_shifts']),
                'total_cash'     => $cash,
                'total_card'     => $card,
                'total_transfer' => $transfer,
                'total_discount' => $discount
            ],
            'shifts'           => $shifts,
            'subsidiary_name'  => $subsidiary_name
        ];
    }

    function addCierre() {
        $date            = $_POST['date'];
        $subsidiaries_id = $this->resolveSubsidiary();

        if ($subsidiaries_id == 0 || $subsidiaries_id == '0') {
            return ['status' => 400, 'message' => 'Selecciona una sucursal'];
        }

        $existing = $this->getDailyClosureByDate([$date, $subsidiaries_id]);
        if ($existing) {
            return ['status' => 409, 'message' => 'Ya existe un cierre para esta fecha y sucursal'];
        }

        $openShifts = $this->listOpenShifts([$date, $subsidiaries_id]);
        if (count($openShifts) > 0) {
            return ['status' => 400, 'message' => 'Hay turnos sin cerrar. Cierra todos los turnos antes de continuar.'];
        }

        $metrics  = $this->getConsolidatedMetrics([$date, $subsidiaries_id]);
        $payments = $this->getConsolidatedPayments([$date, $subsidiaries_id]);
        $statuses = $this->getConsolidatedStatuses([$date, $subsidiaries_id]);
        $discount = $this->getDiscountTotal([$date, $subsidiaries_id]);

        $total_sales = floatval($metrics['total_sales']);

        $cash = 0; $card = 0; $transfer = 0;
        if (is_array($payments)) {
            foreach ($payments as $pay) {
                switch ($pay['method_pay_id']) {
                    case 1: $cash     = floatval($pay['total_paid']); break;
                    case 2: $card     = floatval($pay['total_paid']); break;
                    case 3: $transfer = floatval($pay['total_paid']); break;
                }
            }
        }

        $this->createClosure([
            'values' => 'total, tax, subtotal, employee_id, subsidiary_id, created_at, active, total_orders, closure_date, total_shifts, total_cash, total_card, total_transfer, total_discount, status, is_legacy',
            'data'   => [
                $total_sales,
                0,
                $total_sales,
                $_SESSION['ID'],
                $subsidiaries_id,
                date('Y-m-d H:i:s'),
                1,
                intval($metrics['total_orders']),
                $date,
                intval($metrics['total_shifts']),
                $cash,
                $card,
                $transfer,
                $discount,
                'closed',
                0
            ]
        ]);

        $maxId = $this->getMaxClosureId();
        $closure_id = $maxId['id'];

        $paymentRows = [
            ['method_id' => 1, 'amount' => $cash],
            ['method_id' => 2, 'amount' => $card],
            ['method_id' => 3, 'amount' => $transfer]
        ];
        foreach ($paymentRows as $row) {
            $this->createClosurePayments([
                'values' => 'daily_closure_id, payment_method_id, amount',
                'data'   => [$closure_id, $row['method_id'], $row['amount']]
            ]);
        }

        if (is_array($statuses)) {
            foreach ($statuses as $st) {
                $this->createClosureStatuses([
                    'values' => 'daily_closure_id, status_process_id, amount',
                    'data'   => [$closure_id, $st['status'], intval($st['count'])]
                ]);
            }
        }

        $this->updateOrdersClosure([$closure_id, $date, $subsidiaries_id]);

        return [
            'status'     => 200,
            'message'    => 'Cierre diario realizado correctamente',
            'closure_id' => $closure_id
        ];
    }

    function getCierre() {
        $date            = $_POST['date'];
        $subsidiaries_id = $this->resolveSubsidiary();

        $closure = $this->getDailyClosureByDate([$date, $subsidiaries_id]);
        if (!$closure) {
            return ['status' => 404, 'message' => 'No hay cierre para esta fecha'];
        }

        $shifts   = $this->listShiftsDetail([$date, $subsidiaries_id]);
        $statuses = $this->getConsolidatedStatuses([$date, $subsidiaries_id]);

        $sub = $this->getSubsidiaryName([$subsidiaries_id]);
        $subsidiary_name = $sub ? $sub['sucursal'] : 'Sucursal';
        $company_name    = $sub ? $sub['company'] : '';

        $quotation_count = 0;
        $pending_count   = 0;
        $cancelled_count = 0;
        $delivered_count  = 0;
        if (is_array($statuses)) {
            foreach ($statuses as $st) {
                switch ($st['status']) {
                    case 1: $quotation_count = intval($st['count']); break;
                    case 2: $pending_count   = intval($st['count']); break;
                    case 3: $delivered_count  = intval($st['count']); break;
                    case 4: $cancelled_count = intval($st['count']); break;
                }
            }
        }

        return [
            'status'  => 200,
            'closure' => [
                'id'              => $closure['id'],
                'closure_date'    => $closure['closure_date'],
                'created_at'      => $closure['created_at'],
                'closed_by'       => $closure['closed_by_name'],
                'total_sales'     => floatval($closure['total']),
                'total_orders'    => intval($closure['total_orders']),
                'total_shifts'    => intval($closure['total_shifts']),
                'total_cash'      => floatval($closure['total_cash']),
                'total_card'      => floatval($closure['total_card']),
                'total_transfer'  => floatval($closure['total_transfer']),
                'total_discount'  => floatval($closure['total_discount']),
                'status'          => $closure['status']
            ],
            'shifts'            => $shifts,
            'subsidiary_name'   => $subsidiary_name,
            'company_name'      => $company_name,
            'counts'            => [
                'quotations' => $quotation_count,
                'pending'    => $pending_count,
                'delivered'  => $delivered_count,
                'cancelled'  => $cancelled_count
            ]
        ];
    }

    function statusCierre() {
        if ($_SESSION['ROLID'] != 1) {
            return ['status' => 403, 'message' => 'Solo administradores pueden reabrir un cierre'];
        }

        $closure_id = $_POST['closure_id'];
        $reason     = $_POST['reason'];

        if (empty($reason)) {
            return ['status' => 400, 'message' => 'Debes indicar el motivo de reapertura'];
        }

        $closure = $this->getClosureById([$closure_id]);
        if (!$closure) {
            return ['status' => 404, 'message' => 'Cierre no encontrado'];
        }

        if ($closure['status'] == 'reopened') {
            return ['status' => 409, 'message' => 'Este cierre ya fue reabierto'];
        }

        $this->updateClosureReopen([$_SESSION['ID'], $reason, date('Y-m-d H:i:s'), $closure_id]);
        $this->updateOrdersUnlink([$closure_id]);

        return [
            'status'  => 200,
            'message' => 'Cierre reabierto correctamente'
        ];
    }
}

$obj = new Cierre();
$encode = $obj->{$_POST['opc']}();
echo json_encode($encode);
