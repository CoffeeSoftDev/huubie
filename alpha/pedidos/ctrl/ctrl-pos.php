<?php
session_start();
if (empty($_POST['opc'])) exit(0);

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

require_once '../mdl/mdl-pos.php';

class POS extends MPos {

    function init() {
        $sub_id = isset($_POST['subsidiary_id']) && $_SESSION['ROLID'] == 1
            ? intval($_POST['subsidiary_id'])
            : $_SESSION['SUB'];

        $openShift = $this->getOpenShiftBySubsidiary([$sub_id]);

        $result = [
            'products'          => $this->lsProductos([1]),
            'categories'        => $this->getAllCategory([1]),
            'method_pay'        => $this->lsMethodPay(),
            'access'            => $_SESSION['ROLID'],
            'subsidiary_id'     => $sub_id,
            'subsidiaries_name' => $_SESSION['SUBSIDIARIE_NAME'],
            'open_shift'        => $openShift ? [
                'has_open_shift' => true,
                'shift_id'       => $openShift['id'],
                'opened_at'      => $openShift['opened_at'],
                'shift_name'     => $openShift['shift_name'],
                'employee_name'  => $openShift['employee_name'],
                'opening_amount' => $openShift['opening_amount'],
                'subsidiary_id'  => $openShift['subsidiary_id'],
            ] : ['has_open_shift' => false]
        ];

        if ($_SESSION['ROLID'] == 1) {
            $result['subsidiaries'] = $this->lsSubsidiaries();
        }

        return $result;
    }

    function addQuickSale() {
        $status  = 500;
        $message = 'Error al registrar la venta';

        $sub_id = $_SESSION['SUB'];
        $openShift = $this->getOpenShiftBySubsidiary([$sub_id]);

        if (!$openShift) {
            return [
                'status'  => 403,
                'message' => 'No hay turno abierto. Abre un turno antes de vender.'
            ];
        }

        $items    = json_decode($_POST['items'], true);
        $payments = json_decode($_POST['payments'], true);
        $total    = floatval($_POST['total']);
        $note     = $_POST['note'];

        $clientName = 'Mostrador';
        $client = $this->getClientByName([$clientName]);

        if (!$client) {
            $this->createClient($this->util->sql([
                'name'            => $clientName,
                'phone'           => '',
                'email'           => '',
                'date_create'     => date('Y-m-d H:i:s'),
                'subsidiaries_id' => $sub_id,
                'active'          => 1,
            ]));
            $client = $this->getClientByName([$clientName]);
        }

        $orderData = $this->util->sql([
            'note'            => $note,
            'date_order'      => date('Y-m-d'),
            'time_order'      => date('H:i:s'),
            'date_creation'   => date('Y-m-d H:i:s'),
            'client_id'       => $client['id'],
            'status'          => 3,
            'type_id'         => 3,
            'total_pay'       => $total,
            'subsidiaries_id' => $sub_id,
            'order_type'      => 'mostrador',
            'cash_shift_id'   => $openShift['id'],
            'delivery_type'   => 0,
        ]);

        $insert = $this->createOrder($orderData);

        if (!$insert) {
            return ['status' => 500, 'message' => 'Error al crear la orden'];
        }

        $maxOrder = $this->getMaxOrder();
        $orderId  = $maxOrder['id'];

        foreach ($items as $item) {
            $packageData = $this->util->sql([
                'pedidos_id' => $orderId,
                'product_id' => $item['id'],
                'quantity'   => $item['qty'],
                'price'      => $item['price'],
            ]);
            $this->createProduct($packageData);
        }

        $totalPaid = 0;
        foreach ($payments as $pay) {
            $payData = $this->util->sql([
                'pay'           => floatval($pay['amount']),
                'date_pay'      => date('Y-m-d H:i:s'),
                'type'          => 2,
                'method_pay_id' => intval($pay['method_id']),
                'description'   => $pay['label'],
                'order_id'      => $orderId,
                'tip'           => floatval($pay['tip']),
            ]);
            $this->addMethodPay($payData);
            $totalPaid += floatval($pay['amount']);
        }

        $status  = 200;
        $message = 'Venta registrada correctamente';

        $change = $totalPaid - $total;

        return [
            'status'   => $status,
            'message'  => $message,
            'order_id' => $orderId,
            'change'   => $change > 0 ? $change : 0,
        ];
    }

    function addMovement() {
        $status  = 500;
        $message = 'Error al registrar el movimiento';

        $shift_id = $_POST['cash_shift_id'];
        $shift = $this->getCashShiftById($shift_id);

        if (!$shift || $shift['status'] !== 'open') {
            return ['status' => 403, 'message' => 'El turno no esta abierto'];
        }

        $data = $this->util->sql([
            'cash_shift_id' => $shift_id,
            'type'          => $_POST['type'],
            'amount'        => floatval($_POST['amount']),
            'reason'        => $_POST['reason'],
            'employee_id'   => $_SESSION['ID'],
            'created_at'    => date('Y-m-d H:i:s'),
        ]);

        $create = $this->createMovement($data);

        if ($create) {
            $status  = 200;
            $message = 'Movimiento registrado correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message,
        ];
    }

    function lsMovements() {
        $shift_id = $_POST['cash_shift_id'];
        $movements = $this->listMovementsByShift([$shift_id]);
        $__row = [];

        if (is_array($movements)) {
            foreach ($movements as $key) {
                $typeLabel = movementType($key['type']);
                $__row[] = [
                    'id'     => $key['id'],
                    'Tipo'   => $typeLabel,
                    'Monto'  => [
                        'html'  => evaluar($key['amount']),
                        'class' => 'text-end'
                    ],
                    'Motivo'    => $key['reason'],
                    'Empleado'  => $key['employee_name'],
                    'Fecha'     => formatSpanishDate($key['created_at']),
                    'dropdown'  => dropdownMovement($key['id'], $shift_id)
                ];
            }
        }

        return ['row' => $__row];
    }

    function deleteMovement() {
        $status  = 500;
        $message = 'Error al eliminar el movimiento';

        $values = $this->util->sql(['id' => $_POST['id']], 1);
        $delete = $this->deleteMovementById($values);

        if ($delete) {
            $status  = 200;
            $message = 'Movimiento eliminado correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message,
        ];
    }

    function showCorteX() {
        $shift_id = $_POST['shift_id'];
        $shift = $this->getCashShiftById($shift_id);

        if (!$shift) {
            return ['status' => 404, 'message' => 'Turno no encontrado'];
        }

        $subsidiary_id = $shift['subsidiary_id'];
        $subsidiary = $this->getSucursalByID([$subsidiary_id]);
        $subsidiary_name = ($subsidiary && isset($subsidiary['name'])) ? $subsidiary['name'] : 'Sucursal';

        $opened_at = $shift['opened_at'];
        $now = $shift['status'] === 'closed' ? $shift['closed_at'] : date('Y-m-d H:i:s');

        $metrics = $this->getShiftSalesMetrics([$opened_at, $now, $subsidiary_id]);

        $movements = $this->getMovementTotalsByShift([$shift_id]);
        $totalRetiros   = floatval($movements['total_retiros']);
        $totalDepositos = floatval($movements['total_depositos']);
        $totalGastos    = floatval($movements['total_gastos']);

        $discounts = $this->getShiftDiscountTotal([$opened_at, $now, $subsidiary_id]);
        $totalDiscount  = floatval($discounts['total_discount']);

        $cancelledTotal = $this->getShiftCancelledTotal([$opened_at, $now, $subsidiary_id]);
        $totalCancelled = floatval($cancelledTotal['total_cancelled']);

        $cashInDrawer = floatval($shift['opening_amount'])
            + floatval($metrics['cash_sales'])
            - $totalRetiros
            + $totalDepositos;

        $corteData = [
            'total_sales'     => $metrics['total_sales'],
            'cash_sales'      => $metrics['cash_sales'],
            'card_sales'      => $metrics['card_sales'],
            'transfer_sales'  => $metrics['transfer_sales'],
            'total_orders'    => $metrics['total_orders'],
            'quotation_count' => $metrics['quotation_count'],
            'pending_count'   => $metrics['pending_count'],
            'cancelled_count' => $metrics['cancelled_count'],
            'opening_amount'  => $shift['opening_amount'],
            'total_retiros'   => $totalRetiros,
            'total_depositos' => $totalDepositos,
            'total_gastos'    => $totalGastos,
            'cash_in_drawer'  => $cashInDrawer,
            'total_discount'  => $totalDiscount,
            'total_cancelled' => $totalCancelled,
        ];

        $this->createCorteXLog([
            'values' => 'cash_shift_id, employee_id, subsidiary_id, generated_at, total_sales, total_cash, total_card, total_transfer, total_orders, opening_amount, total_retiros, total_depositos, cash_in_drawer, total_discount, total_cancelled',
            'data'   => [
                $shift_id,
                $_SESSION['ID'],
                $subsidiary_id,
                date('Y-m-d H:i:s'),
                $corteData['total_sales'],
                $corteData['cash_sales'],
                $corteData['card_sales'],
                $corteData['transfer_sales'],
                $corteData['total_orders'],
                $corteData['opening_amount'],
                $totalRetiros,
                $totalDepositos,
                $cashInDrawer,
                $totalDiscount,
                $totalCancelled,
            ]
        ]);

        return [
            'status'          => 200,
            'message'         => 'Corte X generado correctamente',
            'data'            => $corteData,
            'shift'           => $shift,
            'subsidiary_name' => $subsidiary_name,
            'logo'            => $_SESSION['LOGO'],
        ];
    }

    function showCorteZ() {
        $shift_id = $_POST['shift_id'];
        $closing_cash_counted = floatval($_POST['closing_cash_counted']);

        $shift = $this->getCashShiftById($shift_id);

        if (!$shift) {
            return ['status' => 404, 'message' => 'Turno no encontrado'];
        }

        if ($shift['status'] !== 'open') {
            return ['status' => 409, 'message' => 'Este turno ya fue cerrado'];
        }

        $subsidiary_id = $shift['subsidiary_id'];
        $subsidiary = $this->getSucursalByID([$subsidiary_id]);
        $subsidiary_name = ($subsidiary && isset($subsidiary['name'])) ? $subsidiary['name'] : 'Sucursal';

        $opened_at = $shift['opened_at'];
        $closed_at = date('Y-m-d H:i:s');

        $metrics = $this->getShiftSalesMetrics([$opened_at, $closed_at, $subsidiary_id]);

        $movements = $this->getMovementTotalsByShift([$shift_id]);
        $totalRetiros   = floatval($movements['total_retiros']);
        $totalDepositos = floatval($movements['total_depositos']);

        $discounts = $this->getShiftDiscountTotal([$opened_at, $closed_at, $subsidiary_id]);
        $totalDiscount = floatval($discounts['total_discount']);

        $cancelledTotal = $this->getShiftCancelledTotal([$opened_at, $closed_at, $subsidiary_id]);
        $totalCancelled = floatval($cancelledTotal['total_cancelled']);

        $cashExpected = floatval($shift['opening_amount'])
            + floatval($metrics['cash_sales'])
            - $totalRetiros
            + $totalDepositos;

        $cashDifference = $closing_cash_counted - $cashExpected;

        $today = date('Y-m-d');
        $countZ = $this->getCorteZCountByDate([$today, $subsidiary_id]);
        $folioZ = 'Z-' . date('Ymd') . '-' . str_pad(intval($countZ['count']) + 1, 3, '0', STR_PAD_LEFT);

        $total_sales    = floatval($metrics['total_sales']);
        $cash_sales     = floatval($metrics['cash_sales']);
        $card_sales     = floatval($metrics['card_sales']);
        $transfer_sales = floatval($metrics['transfer_sales']);
        $total_orders   = intval($metrics['total_orders']);

        $this->closeCashShiftZ([
            $closed_at, $total_sales, $cash_sales, $card_sales,
            $transfer_sales, $total_orders, $closing_cash_counted,
            $cashDifference, $folioZ, $totalDiscount, $totalCancelled,
            $shift_id
        ]);

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

        $this->updateOrdersCashShift([$shift_id, $opened_at, $closed_at, $subsidiary_id]);

        $topProducts = $this->getShiftTopProducts([$opened_at, $closed_at, $subsidiary_id]);

        return [
            'status'          => 200,
            'message'         => 'Corte Z realizado correctamente',
            'folio_z'         => $folioZ,
            'logo'            => $_SESSION['LOGO'],
            'subsidiary_name' => $subsidiary_name,
            'shift'           => $this->getCashShiftById($shift_id),
            'data' => [
                'total_sales'          => $total_sales,
                'total_discount'       => $totalDiscount,
                'total_cancelled'      => $totalCancelled,
                'total_net'            => $total_sales - $totalDiscount - $totalCancelled,
                'cash_sales'           => $cash_sales,
                'card_sales'           => $card_sales,
                'transfer_sales'       => $transfer_sales,
                'total_orders'         => $total_orders,
                'opening_amount'       => $shift['opening_amount'],
                'total_retiros'        => $totalRetiros,
                'total_depositos'      => $totalDepositos,
                'cash_expected'        => $cashExpected,
                'closing_cash_counted' => $closing_cash_counted,
                'cash_difference'      => $cashDifference,
                'quotation_count'      => $metrics['quotation_count'],
                'pending_count'        => $metrics['pending_count'],
                'cancelled_count'      => $metrics['cancelled_count'],
                'top_products'         => $topProducts,
            ]
        ];
    }

    function lsCorteXHistory() {
        $shift_id = $_POST['shift_id'];
        $logs = $this->listCorteXByShift([$shift_id]);
        $__row = [];

        if (is_array($logs)) {
            foreach ($logs as $key) {
                $__row[] = [
                    'id'         => $key['id'],
                    'Fecha'      => formatSpanishDate($key['generated_at']),
                    'Ventas'     => ['html' => evaluar($key['total_sales']), 'class' => 'text-end'],
                    'Efectivo'   => ['html' => evaluar($key['total_cash']), 'class' => 'text-end'],
                    'Tarjeta'    => ['html' => evaluar($key['total_card']), 'class' => 'text-end'],
                    'Transf.'    => ['html' => evaluar($key['total_transfer']), 'class' => 'text-end'],
                    'En caja'    => ['html' => evaluar($key['cash_in_drawer']), 'class' => 'text-end'],
                    'Pedidos'    => ['html' => $key['total_orders'], 'class' => 'text-center'],
                ];
            }
        }

        return ['row' => $__row];
    }
}

function movementType($type) {
    $types = [
        'retiro'   => '<span class="px-2 py-1 rounded-md text-sm font-semibold bg-[#721c24] text-[#ba464d]">Retiro</span>',
        'deposito' => '<span class="px-2 py-1 rounded-md text-sm font-semibold bg-[#014737] text-[#3FC189]">Deposito</span>',
        'gasto'    => '<span class="px-2 py-1 rounded-md text-sm font-semibold bg-[#8a4600] text-[#f0ad28]">Gasto</span>',
    ];
    return $types[$type] ?? '<span class="badge bg-secondary">Desconocido</span>';
}

function dropdownMovement($id, $shift_id) {
    return [
        ['icon' => 'icon-trash', 'text' => 'Eliminar', 'onclick' => "pos.deleteMovement($id, $shift_id)"]
    ];
}

$fn = $_POST['opc'];
$obj = new POS();
echo json_encode($obj->$fn());
