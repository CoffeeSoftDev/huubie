<?php
session_start();
if (empty($_POST['opc'])) exit(0);

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

require_once '../mdl/mdl-tickets.php';

class Tickets extends MTickets {

    function init() {
        $sub_id = $_SESSION['SUB'];
        $config = $this->getTicketConfigBySubsidiary([$sub_id]);

        return [
            'config'    => $config,
            'logo'      => $_SESSION['LOGO'],
            'sub_name'  => $_SESSION['SUBSIDIARIE_NAME'],
        ];
    }

    function getTicketData() {
        $order_id = $_POST['order_id'];
        $sub_id   = $_SESSION['SUB'];

        $order    = $this->getOrderById([$order_id]);
        $items    = $this->getOrderItemsById([$order_id]);
        $payments = $this->getOrderPaymentsById([$order_id]);
        $config   = $this->getTicketConfigBySubsidiary([$sub_id]);
        $subsidiary = $this->getSucursalById([$sub_id]);

        if (!$order) {
            return ['status' => 404, 'message' => 'Orden no encontrada'];
        }

        $totalPaid = 0;
        if (is_array($payments)) {
            foreach ($payments as $p) {
                $totalPaid += floatval($p['pay']);
            }
        }

        return [
            'status'    => 200,
            'order'     => $order,
            'items'     => $items,
            'payments'  => $payments,
            'config'    => $config,
            'logo'      => $_SESSION['LOGO'],
            'subsidiary' => $subsidiary,
            'total_paid' => $totalPaid,
            'change'     => max(0, $totalPaid - floatval($order['total_pay'])),
        ];
    }

    function addTicketLog() {
        $status  = 500;
        $message = 'Error al registrar el ticket';

        $sub_id   = $_SESSION['SUB'];
        $order_id = $_POST['order_id'];
        $type     = $_POST['type'];

        $folio = '';
        if ($type === 'venta' || $type === 'reimpresion') {
            $order = $this->getOrderById([$order_id]);
            if ($order && !empty($order['folio_ticket'])) {
                $folio = $order['folio_ticket'];
            } else {
                $today = date('Y-m-d');
                $count = $this->getTicketCountByDate([$today, $sub_id]);
                $folio = 'T-' . date('Ymd') . '-' . str_pad(intval($count['count']) + 1, 4, '0', STR_PAD_LEFT);
                $this->updateOrderFolio([$folio, $order_id]);
            }
        }

        $logData = $this->util->sql([
            'order_id'      => $order_id,
            'cash_shift_id' => $_POST['cash_shift_id'],
            'type'          => $type,
            'employee_id'   => $_SESSION['ID'],
            'subsidiary_id' => $sub_id,
            'printed_at'    => date('Y-m-d H:i:s'),
            'folio'         => $folio,
        ]);

        $create = $this->createTicketLog($logData);

        if ($create) {
            $status  = 200;
            $message = 'Ticket registrado correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message,
            'folio'   => $folio,
        ];
    }

    function getComandaData() {
        $order_id = $_POST['order_id'];

        $order = $this->getOrderById([$order_id]);
        $items = $this->getOrderItemsById([$order_id]);

        if (!$order) {
            return ['status' => 404, 'message' => 'Orden no encontrada'];
        }

        return [
            'status' => 200,
            'order'  => $order,
            'items'  => $items,
        ];
    }

    function lsSales() {
        $fi = $_POST['fi'];
        $ff = $_POST['ff'];
        $sub_id = $_SESSION['SUB'];
        $__row = [];

        $sales = $this->listSalesByDate([$fi, $ff, $sub_id]);

        if (is_array($sales)) {
            foreach ($sales as $key) {
                $__row[] = [
                    'id'      => $key['id'],
                    'Folio'   => $key['folio_ticket'] ? $key['folio_ticket'] : '#' . $key['id'],
                    'Cliente' => $key['client_name'],
                    'Total'   => [
                        'html'  => evaluar($key['total_pay']),
                        'class' => 'text-end'
                    ],
                    'Tipo'    => orderType($key['order_type']),
                    'Estado'  => statusOrder($key['status']),
                    'Fecha'   => formatSpanishDate($key['date_creation']),
                    'dropdown' => dropdownSales($key['id'])
                ];
            }
        }

        return ['row' => $__row];
    }

    function editTicketConfig() {
        $status  = 500;
        $message = 'Error al guardar configuracion';

        $sub_id = $_SESSION['SUB'];
        $existing = $this->getTicketConfigBySubsidiary([$sub_id]);

        if ($existing) {
            $_POST['id'] = $existing['id'];
            $update = $this->updateTicketConfig($this->util->sql($_POST, 1));
            if ($update) {
                $status  = 200;
                $message = 'Configuracion actualizada correctamente';
            }
        } else {
            $_POST['subsidiary_id'] = $sub_id;
            $_POST['created_at'] = date('Y-m-d H:i:s');
            $create = $this->createTicketConfig($this->util->sql($_POST));
            if ($create) {
                $status  = 200;
                $message = 'Configuracion creada correctamente';
            }
        }

        return [
            'status'  => $status,
            'message' => $message,
        ];
    }
}

function orderType($type) {
    $types = [
        'pedido'     => '<span class="px-2 py-1 rounded-md text-sm font-semibold bg-[#1e3a5f] text-[#60a5fa]">Pedido</span>',
        'mostrador'  => '<span class="px-2 py-1 rounded-md text-sm font-semibold bg-[#014737] text-[#3FC189]">Mostrador</span>',
    ];
    return $types[$type] ?? '<span class="px-2 py-1 rounded-md text-sm font-semibold bg-gray-600 text-gray-300">N/A</span>';
}

function statusOrder($statusId) {
    $statuses = [
        1 => '<span class="px-2 py-1 rounded-md text-sm font-semibold bg-[#1e3a5f] text-[#60a5fa]">Cotizacion</span>',
        2 => '<span class="px-2 py-1 rounded-md text-sm font-semibold bg-[#8a4600] text-[#f0ad28]">Pendiente</span>',
        3 => '<span class="px-2 py-1 rounded-md text-sm font-semibold bg-[#014737] text-[#3FC189]">Pagado</span>',
        4 => '<span class="px-2 py-1 rounded-md text-sm font-semibold bg-[#721c24] text-[#ba464d]">Cancelado</span>',
    ];
    return $statuses[$statusId] ?? '<span class="badge bg-secondary">Desconocido</span>';
}

function dropdownSales($id) {
    return [
        ['icon' => 'icon-print', 'text' => 'Imprimir ticket', 'onclick' => "tickets.printSaleTicket($id)"],
        ['icon' => 'icon-doc-text', 'text' => 'Comanda cocina', 'onclick' => "tickets.printComanda($id)"],
        ['icon' => 'icon-clock', 'text' => 'Reimprimir', 'onclick' => "tickets.reprintTicket($id)"],
    ];
}

$fn = $_POST['opc'];
$obj = new Tickets();
echo json_encode($obj->$fn());
