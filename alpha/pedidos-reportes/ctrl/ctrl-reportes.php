<?php
session_start();
if (empty($_POST['opc'])) exit(0);

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

require_once '../mdl/mdl-reportes.php';

class Reportes extends MReportes {

    function init() {
        if ($_SESSION['ROLID'] != 1) {
            return ['status' => 403, 'message' => 'No tienes permisos'];
        }

        $subsidiaries = $this->lsSubsidiaries();

        return [
            'access'       => $_SESSION['ROLID'],
            'sucursales'   => $subsidiaries['data'],
            'sub_id'       => $_SESSION['SUB'],
        ];
    }

    function lsSubsidiaries() {
        $status  = 500;
        $message = 'Error al obtener las sucursales';
        $data    = [];

        if ($_SESSION['ROLID'] == 1) {
            $subsidiaries = $this->getSubsidiariesByCompany([$_SESSION['COMPANY_ID']]);
            if ($subsidiaries) {
                $status  = 200;
                $message = 'Sucursales obtenidas correctamente';
                $data    = $subsidiaries;
            }
        } else {
            $status  = 403;
            $message = 'No tienes permisos para acceder a esta información';
        }

        return [
            'status'  => $status,
            'message' => $message,
            'data'    => $data
        ];
    }

    function lsTickets() {
        if ($_SESSION['ROLID'] != 1) {
            return ['status' => 403, 'message' => 'No tienes permisos'];
        }

        $fi = $_POST['fi'];
        $ff = $_POST['ff'];
        $sub_id = isset($_POST['sub_id']) && $_POST['sub_id'] != '0'
            ? $_POST['sub_id']
            : '0';

        $ls = $this->listTickets([$fi, $ff, $sub_id, $sub_id]);
        $__row = [];

        $totalImporte = 0;
        $totalDescuento = 0;
        $totalPropina = 0;
        $totalEfectivo = 0;
        $totalTarjeta = 0;
        $totalTransferencia = 0;
        $totalCargo = 0;

        if (is_array($ls)) {
            foreach ($ls as $key) {
                $totalImporte += floatval($key['importe']);
                $totalDescuento += floatval($key['descuento_importe']);
                $totalPropina += floatval($key['propina']);
                $totalEfectivo += floatval($key['efectivo']);
                $totalTarjeta += floatval($key['tarjeta']);
                $totalTransferencia += floatval($key['transferencia']);

                $__row[] = [
                    'id'            => $key['folio_cuenta'],
                    'Folio'         => str_pad($key['folio_cuenta'], 8, '0', STR_PAD_LEFT),
                    'Fecha'         => formatSpanishDate($key['fecha']),
                    'Cuenta'        => $key['cuenta'],
                    // 'Tipo'          => $key['order_type'] == 'mostrador' ? 'Mostrador' : 'Pedido',
                    'Descuento'     => ['html' => evaluar($key['descuento_importe']), 'class' => 'text-end'],
                    // 'Propina'       => ['html' => evaluar($key['propina']), 'class' => 'text-end'],
                    'Importe'       => ['html' => evaluar($key['importe']), 'class' => 'text-end bg-[#283341] font-bold'],
                    'Efectivo'      => ['html' => evaluar($key['efectivo']), 'class' => 'text-end'],
                    'Tarjeta'       => ['html' => evaluar($key['tarjeta']), 'class' => 'text-end'],
                    'Transferencia' => ['html' => evaluar($key['transferencia']), 'class' => 'text-end'],
                    'opc'           => 0
                ];
            }
        }

        return [
            'row'    => $__row,
            'totals' => [
                'importe'       => evaluar($totalImporte),
                'descuento'     => evaluar($totalDescuento),
                'propina'       => evaluar($totalPropina),
                'efectivo'      => evaluar($totalEfectivo),
                'tarjeta'       => evaluar($totalTarjeta),
                'transferencia' => evaluar($totalTransferencia),
                'total_tickets' => count($__row),
            ]
        ];
    }

    function lsShifts() {
        if ($_SESSION['ROLID'] != 1) {
            return ['status' => 403, 'message' => 'No tienes permisos'];
        }

        $fi = $_POST['fi'];
        $ff = $_POST['ff'];
        $sub_id = isset($_POST['sub_id']) && $_POST['sub_id'] != '0'
            ? $_POST['sub_id']
            : '0';

        $ls = $this->listShifts([$sub_id, $sub_id, $fi, $ff]);
        $__row = [];

        if (is_array($ls)) {
            foreach ($ls as $key) {
                $statusHtml = $key['status'] == 'open'
                    ? '<span class="badge bg-success">Abierto</span>'
                    : '<span class="badge bg-secondary">Cerrado</span>';

                $diff = floatval($key['cash_difference']);
                $diffHtml = evaluar($diff);
                if ($diff < 0) $diffHtml = '<span class="text-red-400">' . $diffHtml . '</span>';
                else if ($diff > 0) $diffHtml = '<span class="text-green-400">+' . $diffHtml . '</span>';

                $__row[] = [
                    'id'           => $key['id'],
                    'Cajero'       => $key['employee_name'] ? $key['employee_name'] : 'Sin asignar',
                    'Apertura'     => formatSpanishDate($key['opened_at']),
                    'Cierre'       => $key['closed_at'] ? formatSpanishDate($key['closed_at']) : 'Abierto',
                    'Total'        => ['html' => evaluar($key['total_sales']), 'class' => 'text-end bg-[#283341] font-bold'],
                    'Efectivo'     => ['html' => evaluar($key['total_cash']), 'class' => 'text-end'],
                    'Tarjeta'      => ['html' => evaluar($key['total_card']), 'class' => 'text-end'],
                    'Transferencia'=> ['html' => evaluar($key['total_transfer']), 'class' => 'text-end'],
                    'Propinas'     => ['html' => evaluar($key['total_tips']), 'class' => 'text-end'],
                    'Descuentos'   => ['html' => evaluar($key['total_discount']), 'class' => 'text-end'],
                    'Pedidos'      => ['html' => $key['total_orders'], 'class' => 'text-center'],
                    'Diferencia'   => ['html' => $diffHtml, 'class' => 'text-end'],
                    'Estado'       => $statusHtml,
                    'opc'          => 0
                ];
            }
        }

        return ['row' => $__row];
    }

    function lsDailyTickets() {
        if ($_SESSION['ROLID'] != 1) {
            return ['status' => 403, 'message' => 'No tienes permisos'];
        }

        $fi = $_POST['fi'];
        $ff = $_POST['ff'];
        $sub_id = isset($_POST['sub_id']) && $_POST['sub_id'] != '0'
            ? $_POST['sub_id']
            : '0';

        $ls = $this->listDailyTickets([$fi, $ff, $sub_id, $sub_id]);
        $__row = [];

        $grandImporte = 0;
        $grandDescuento = 0;
        $grandPropina = 0;
        $grandEfectivo = 0;
        $grandTarjeta = 0;
        $grandTransferencia = 0;
        $grandTickets = 0;

        if (is_array($ls)) {
            foreach ($ls as $key) {
                $grandImporte += floatval($key['importe']);
                $grandDescuento += floatval($key['descuento']);
                $grandPropina += floatval($key['propina']);
                $grandEfectivo += floatval($key['efectivo']);
                $grandTarjeta += floatval($key['tarjeta']);
                $grandTransferencia += floatval($key['transferencia']);
                $grandTickets += intval($key['total_tickets']);

                $__row[] = [
                    'id'            => $key['fecha'],
                    'Fecha'         => formatSpanishDate($key['fecha']),
                    'Tickets'       => ['html' => $key['total_tickets'], 'class' => 'text-center'],
                    'Descuento'     => ['html' => evaluar($key['descuento']), 'class' => 'text-end'],
                    'Importe'       => ['html' => evaluar($key['importe']), 'class' => 'text-end bg-[#283341] font-bold'],
                    'Efectivo'      => ['html' => evaluar($key['efectivo']), 'class' => 'text-end'],
                    'Tarjeta'       => ['html' => evaluar($key['tarjeta']), 'class' => 'text-end'],
                    'Transferencia' => ['html' => evaluar($key['transferencia']), 'class' => 'text-end'],
                    'opc'           => 0
                ];
            }
        }

        return [
            'row'    => $__row,
            'totals' => [
                'importe'       => evaluar($grandImporte),
                'descuento'     => evaluar($grandDescuento),
                'propina'       => evaluar($grandPropina),
                'efectivo'      => evaluar($grandEfectivo),
                'tarjeta'       => evaluar($grandTarjeta),
                'transferencia' => evaluar($grandTransferencia),
                'total_tickets' => $grandTickets,
            ]
        ];
    }

    function showShiftDetail() {
        if ($_SESSION['ROLID'] != 1) {
            return ['status' => 403, 'message' => 'No tienes permisos'];
        }

        $id = $_POST['id'];
        $shift = $this->getShiftDetailById([$id]);

        if (!$shift) {
            return ['status' => 500, 'message' => 'Turno no encontrado'];
        }

        $tickets = $this->getShiftTickets([$id]);
        $__row = [];

        if (is_array($tickets)) {
            foreach ($tickets as $key) {
                $__row[] = [
                    'id'        => $key['folio_cuenta'],
                    'Folio'     => str_pad($key['folio_cuenta'], 8, '0', STR_PAD_LEFT),
                    'Fecha'     => formatSpanishDate($key['fecha']),
                    'Cuenta'    => $key['cuenta'],
                    'Descuento' => ['html' => evaluar($key['descuento_importe']), 'class' => 'text-end'],
                    'Propina'   => ['html' => evaluar($key['propina']), 'class' => 'text-end'],
                    'Importe'   => ['html' => evaluar($key['importe']), 'class' => 'text-end bg-[#283341] font-bold'],
                    'Efectivo'  => ['html' => evaluar($key['efectivo']), 'class' => 'text-end'],
                    'Tarjeta'   => ['html' => evaluar($key['tarjeta']), 'class' => 'text-end'],
                    'Transf.'   => ['html' => evaluar($key['transferencia']), 'class' => 'text-end'],
                    'opc'       => 0
                ];
            }
        }

        return [
            'status'  => 200,
            'shift'   => $shift,
            'tickets' => $__row,
        ];
    }
}

$fn = $_POST['opc'];
$obj = new Reportes();
echo json_encode($obj->$fn());
