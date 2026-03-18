<?php
session_start();
if (empty($_POST['opc'])) exit(0);

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

require_once '../mdl/mdl-reportes.php';

class Reportes extends MReportes {

    function init() {
        $sub_id = $_SESSION['SUB'];

        $data = [
            'access' => $_SESSION['ROLID'],
            'sub_id' => $sub_id,
        ];

        if ($_SESSION['ROLID'] == 1) {
            $data['subsidiaries'] = $this->lsSubsidiaries();
        }

        return $data;
    }

    function showSalesSummary() {
        $fi = $_POST['fi'];
        $ff = $_POST['ff'];
        $sub_id = $_POST['sub_id'];

        $summary = $this->getGeneralSalesSummary([$fi, $ff, $sub_id]);
        $cancellation = $this->getCancellationCounts([$fi, $ff, $sub_id]);
        $discounts = $this->getDiscountCounts([$fi, $ff, $sub_id]);

        return [
            'summary'      => $summary,
            'cancellation' => $cancellation,
            'discounts'    => $discounts,
        ];
    }

    function showSalesByHour() {
        $fi = $_POST['fi'];
        $ff = $_POST['ff'];
        $sub_id = $_POST['sub_id'];

        $data = $this->getSalesByHour([$fi, $ff, $sub_id]);

        $hours = [];
        $sales = [];
        $orders = [];

        for ($h = 0; $h < 24; $h++) {
            $hours[] = str_pad($h, 2, '0', STR_PAD_LEFT) . ':00';
            $found = false;
            if (is_array($data)) {
                foreach ($data as $row) {
                    if (intval($row['hora']) === $h) {
                        $sales[] = floatval($row['total_sales']);
                        $orders[] = intval($row['total_orders']);
                        $found = true;
                        break;
                    }
                }
            }
            if (!$found) {
                $sales[] = 0;
                $orders[] = 0;
            }
        }

        return [
            'hours'  => $hours,
            'sales'  => $sales,
            'orders' => $orders,
        ];
    }

    function showSalesByProduct() {
        $fi = $_POST['fi'];
        $ff = $_POST['ff'];
        $sub_id = $_POST['sub_id'];

        $data = $this->getSalesByProduct([$fi, $ff, $sub_id]);
        $__row = [];

        if (is_array($data)) {
            $rank = 1;
            foreach ($data as $key) {
                $__row[] = [
                    'id'       => $rank,
                    '#'        => $rank,
                    'Producto' => $key['product_name'],
                    'Cantidad' => ['html' => intval($key['total_qty']), 'class' => 'text-center'],
                    'Monto'    => ['html' => evaluar($key['total_amount']), 'class' => 'text-end'],
                ];
                $rank++;
            }
        }

        $top10 = is_array($data) ? array_slice($data, 0, 10) : [];

        return [
            'row'   => $__row,
            'top10' => $top10,
        ];
    }

    function showSalesByCategory() {
        $fi = $_POST['fi'];
        $ff = $_POST['ff'];
        $sub_id = $_POST['sub_id'];

        $data = $this->getSalesByCategory([$fi, $ff, $sub_id]);
        $__row = [];

        if (is_array($data)) {
            foreach ($data as $key) {
                $__row[] = [
                    'id'        => $key['category_name'],
                    'Categoria' => $key['category_name'],
                    'Pedidos'   => ['html' => intval($key['total_orders']), 'class' => 'text-center'],
                    'Productos' => ['html' => intval($key['total_qty']), 'class' => 'text-center'],
                    'Monto'     => ['html' => evaluar($key['total_amount']), 'class' => 'text-end'],
                ];
            }
        }

        return [
            'row'  => $__row,
            'data' => $data,
        ];
    }

    function showSalesByEmployee() {
        $fi = $_POST['fi'];
        $ff = $_POST['ff'];
        $sub_id = $_POST['sub_id'];

        $data = $this->getSalesByEmployee([$fi, $ff, $sub_id]);
        $__row = [];

        if (is_array($data)) {
            foreach ($data as $key) {
                $__row[] = [
                    'id'        => $key['employee_name'],
                    'Empleado'  => $key['employee_name'] ? $key['employee_name'] : 'Sin asignar',
                    'Pedidos'   => ['html' => intval($key['total_orders']), 'class' => 'text-center'],
                    'Ventas'    => ['html' => evaluar($key['total_sales']), 'class' => 'text-end'],
                    'Propinas'  => ['html' => evaluar($key['total_tips']), 'class' => 'text-end'],
                ];
            }
        }

        return [
            'row'  => $__row,
            'data' => $data,
        ];
    }

    function showComparative() {
        $fi1 = $_POST['fi1'];
        $ff1 = $_POST['ff1'];
        $fi2 = $_POST['fi2'];
        $ff2 = $_POST['ff2'];
        $sub_id = $_POST['sub_id'];

        $period1 = $this->getComparativePeriod([$fi1, $ff1, $sub_id]);
        $period2 = $this->getComparativePeriod([$fi2, $ff2, $sub_id]);

        $summary1 = $this->getGeneralSalesSummary([$fi1, $ff1, $sub_id]);
        $summary2 = $this->getGeneralSalesSummary([$fi2, $ff2, $sub_id]);

        $totalSales1 = floatval($summary1['total_sales']);
        $totalSales2 = floatval($summary2['total_sales']);
        $growth = $totalSales1 > 0 ? (($totalSales2 - $totalSales1) / $totalSales1) * 100 : 0;

        return [
            'period1'  => $period1,
            'period2'  => $period2,
            'summary1' => $summary1,
            'summary2' => $summary2,
            'growth'   => round($growth, 2),
        ];
    }

    function showPaymentMethods() {
        $fi = $_POST['fi'];
        $ff = $_POST['ff'];
        $sub_id = $_POST['sub_id'];

        $data = $this->getPaymentMethodSummary([$fi, $ff, $sub_id]);
        $__row = [];

        if (is_array($data)) {
            foreach ($data as $key) {
                $__row[] = [
                    'id'            => $key['method_pay'],
                    'Forma de pago' => $key['method_pay'],
                    'Pedidos'       => ['html' => intval($key['total_orders']), 'class' => 'text-center'],
                    'Monto'         => ['html' => evaluar($key['total_amount']), 'class' => 'text-end'],
                ];
            }
        }

        return [
            'row'  => $__row,
            'data' => $data,
        ];
    }

    function lsCancellations() {
        $fi = $_POST['fi'];
        $ff = $_POST['ff'];
        $sub_id = $_POST['sub_id'];

        $cancellations = $this->listCancellations([$fi, $ff, $sub_id]);
        $discounts = $this->getDiscountsSummary([$fi, $ff, $sub_id]);
        $cancelCounts = $this->getCancellationCounts([$fi, $ff, $sub_id]);
        $discountCounts = $this->getDiscountCounts([$fi, $ff, $sub_id]);

        $__rowCancel = [];
        if (is_array($cancellations)) {
            foreach ($cancellations as $key) {
                $__rowCancel[] = [
                    'id'          => $key['id'],
                    'Pedido'      => '#' . $key['id'],
                    'Cliente'     => $key['client_name'],
                    'Total'       => ['html' => evaluar($key['total_pay']), 'class' => 'text-end'],
                    'Motivo'      => $key['cancel_reason'] ? $key['cancel_reason'] : 'Sin motivo',
                    'Responsable' => $key['cancelled_by_name'] ? $key['cancelled_by_name'] : '-',
                    'Fecha'       => formatSpanishDate($key['date_creation']),
                ];
            }
        }

        $__rowDiscount = [];
        if (is_array($discounts)) {
            foreach ($discounts as $key) {
                $__rowDiscount[] = [
                    'id'        => $key['id'],
                    'Pedido'    => '#' . $key['id'],
                    'Cliente'   => $key['client_name'],
                    'Total'     => ['html' => evaluar($key['total_pay']), 'class' => 'text-end'],
                    'Descuento' => ['html' => evaluar($key['discount']), 'class' => 'text-end'],
                    'Motivo'    => $key['discount_reason'] ? $key['discount_reason'] : '-',
                    'Fecha'     => formatSpanishDate($key['date_creation']),
                ];
            }
        }

        return [
            'rowCancel'      => $__rowCancel,
            'rowDiscount'    => $__rowDiscount,
            'cancelCounts'   => $cancelCounts,
            'discountCounts' => $discountCounts,
        ];
    }

    function showTips() {
        $fi = $_POST['fi'];
        $ff = $_POST['ff'];
        $sub_id = $_POST['sub_id'];

        $byEmployee = $this->getTipsByEmployee([$fi, $ff, $sub_id]);
        $byShift = $this->getTipsByShift([$fi, $ff, $sub_id]);

        $__rowEmployee = [];
        if (is_array($byEmployee)) {
            foreach ($byEmployee as $key) {
                $__rowEmployee[] = [
                    'id'       => $key['employee_name'],
                    'Empleado' => $key['employee_name'] ? $key['employee_name'] : 'Sin asignar',
                    'Pedidos'  => ['html' => intval($key['total_orders']), 'class' => 'text-center'],
                    'Propinas' => ['html' => evaluar($key['total_tips']), 'class' => 'text-end'],
                ];
            }
        }

        $__rowShift = [];
        if (is_array($byShift)) {
            foreach ($byShift as $key) {
                $__rowShift[] = [
                    'id'       => $key['shift_id'],
                    'Turno'    => $key['shift_name'] ? $key['shift_name'] : 'Turno #' . $key['shift_id'],
                    'Cajero'   => $key['employee_name'],
                    'Apertura' => formatSpanishDate($key['opened_at']),
                    'Cierre'   => $key['closed_at'] ? formatSpanishDate($key['closed_at']) : 'Abierto',
                    'Propinas' => ['html' => evaluar($key['total_tips']), 'class' => 'text-end'],
                ];
            }
        }

        return [
            'rowEmployee' => $__rowEmployee,
            'rowShift'    => $__rowShift,
        ];
    }

    function lsAccountsReceivable() {
        $sub_id = $_POST['sub_id'];

        $accounts = $this->getAccountsReceivable([$sub_id]);
        $totals = $this->getAccountsReceivableTotals([$sub_id]);

        $__row = [];
        if (is_array($accounts)) {
            foreach ($accounts as $key) {
                $daysClass = '';
                $days = intval($key['days_overdue']);
                if ($days > 30) $daysClass = 'text-red-400 font-bold';
                else if ($days > 15) $daysClass = 'text-yellow-400';

                $__row[] = [
                    'id'        => $key['id'],
                    'Pedido'    => '#' . $key['id'],
                    'Cliente'   => $key['client_name'],
                    'Telefono'  => $key['client_phone'] ? $key['client_phone'] : '-',
                    'Total'     => ['html' => evaluar($key['total_pay']), 'class' => 'text-end'],
                    'Abonado'   => ['html' => evaluar($key['total_paid']), 'class' => 'text-end'],
                    'Saldo'     => ['html' => evaluar($key['balance']), 'class' => 'text-end font-bold text-red-400'],
                    'Dias'      => ['html' => '<span class="' . $daysClass . '">' . $days . ' dias</span>', 'class' => 'text-center'],
                    'Fecha'     => formatSpanishDate($key['date_creation']),
                ];
            }
        }

        return [
            'row'    => $__row,
            'totals' => $totals,
        ];
    }

    function lsCorteZHistory() {
        $fi = $_POST['fi'];
        $ff = $_POST['ff'];
        $sub_id = $_POST['sub_id'];

        $cortes = $this->listCorteZHistory([$sub_id, $fi, $ff]);
        $__row = [];

        if (is_array($cortes)) {
            foreach ($cortes as $key) {
                $diff = floatval($key['cash_difference']);
                $diffHtml = evaluar($diff);
                if ($diff < 0) $diffHtml = '<span class="text-red-400">' . $diffHtml . '</span>';
                else if ($diff > 0) $diffHtml = '<span class="text-green-400">+' . $diffHtml . '</span>';

                $__row[] = [
                    'id'          => $key['id'],
                    'Folio'       => $key['folio_z'],
                    'Cajero'      => $key['employee_name'],
                    'Apertura'    => formatSpanishDate($key['opened_at']),
                    'Cierre'      => formatSpanishDate($key['closed_at']),
                    'Ventas'      => ['html' => evaluar($key['total_sales']), 'class' => 'text-end'],
                    'Efectivo'    => ['html' => evaluar($key['total_cash']), 'class' => 'text-end'],
                    'Tarjeta'     => ['html' => evaluar($key['total_card']), 'class' => 'text-end'],
                    'Transf.'     => ['html' => evaluar($key['total_transfer']), 'class' => 'text-end'],
                    'Diferencia'  => ['html' => $diffHtml, 'class' => 'text-end'],
                    'Pedidos'     => ['html' => $key['total_orders'], 'class' => 'text-center'],
                ];
            }
        }

        return ['row' => $__row];
    }
}

$fn = $_POST['opc'];
$obj = new Reportes();
echo json_encode($obj->$fn());
