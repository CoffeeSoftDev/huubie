<?php
session_start();
if (empty($_POST['opc'])) exit(0);

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

require_once '../mdl/mdl-cocina.php';

class Cocina extends MCocina {

    function init() {
        $sub_id = $_SESSION['SUB'];

        return [
            'sub_id'  => $sub_id,
            'sub_name' => $_SESSION['SUBSIDIARIE_NAME'],
        ];
    }

    function lsOrders() {
        $sub_id = $_SESSION['SUB'];
        $orders = $this->listAllKdsOrders([$sub_id]);
        $result = [];

        if (is_array($orders)) {
            foreach ($orders as $order) {
                $items = $this->listOrderItemsForKds([$order['id']]);
                $order['items'] = $items;

                $totalItems = intval($order['total_items']);
                $delivered = intval($order['items_delivered']);
                $ready = intval($order['items_ready']);
                $preparing = intval($order['items_preparing']);

                if ($delivered >= $totalItems && $totalItems > 0) {
                    $order['kds_general_status'] = 'entregado';
                } else if (($ready + $delivered) >= $totalItems && $totalItems > 0) {
                    $order['kds_general_status'] = 'listo';
                } else if ($preparing > 0) {
                    $order['kds_general_status'] = 'preparando';
                } else {
                    $order['kds_general_status'] = 'pendiente';
                }

                $result[] = $order;
            }
        }

        return [
            'orders' => $result,
        ];
    }

    function statusKdsItem() {
        $status  = 500;
        $message = 'Error al actualizar estado';

        $package_id = $_POST['package_id'];
        $order_id   = $_POST['order_id'];
        $new_status = $_POST['status'];
        $sub_id     = $_SESSION['SUB'];

        $existing = null;
        $items = $this->listOrderItemsForKds([$order_id]);
        if (is_array($items)) {
            foreach ($items as $item) {
                if ($item['package_id'] == $package_id && $item['kds_id']) {
                    $existing = $item;
                    break;
                }
            }
        }

        if (!$existing || !$existing['kds_id']) {
            $data = $this->util->sql([
                'order_id'      => $order_id,
                'package_id'    => $package_id,
                'status'        => $new_status,
                'subsidiary_id' => $sub_id,
                'employee_id'   => $_SESSION['ID'],
                'started_at'    => ($new_status === 'preparando') ? date('Y-m-d H:i:s') : null,
                'completed_at'  => ($new_status === 'listo') ? date('Y-m-d H:i:s') : null,
                'delivered_at'  => ($new_status === 'entregado') ? date('Y-m-d H:i:s') : null,
                'created_at'    => date('Y-m-d H:i:s'),
            ]);
            $this->createKdsItem($data);
            $status  = 200;
            $message = 'Estado actualizado';
        } else {
            $update = $this->updateKdsItemStatus([
                $new_status, $new_status, $new_status, $new_status, $existing['kds_id']
            ]);

            if ($update) {
                $status  = 200;
                $message = 'Estado actualizado';
            }
        }

        return ['status' => $status, 'message' => $message];
    }

    function statusAllItems() {
        $status  = 500;
        $message = 'Error al actualizar';

        $order_id   = $_POST['order_id'];
        $new_status = $_POST['status'];
        $sub_id     = $_SESSION['SUB'];

        $items = $this->listOrderItemsForKds([$order_id]);

        if (is_array($items)) {
            foreach ($items as $item) {
                if ($item['kds_id']) {
                    $this->updateKdsItemStatus([
                        $new_status, $new_status, $new_status, $new_status, $item['kds_id']
                    ]);
                } else {
                    $data = $this->util->sql([
                        'order_id'      => $order_id,
                        'package_id'    => $item['package_id'],
                        'status'        => $new_status,
                        'subsidiary_id' => $sub_id,
                        'employee_id'   => $_SESSION['ID'],
                        'started_at'    => ($new_status === 'preparando' || $new_status === 'listo' || $new_status === 'entregado') ? date('Y-m-d H:i:s') : null,
                        'completed_at'  => ($new_status === 'listo' || $new_status === 'entregado') ? date('Y-m-d H:i:s') : null,
                        'delivered_at'  => ($new_status === 'entregado') ? date('Y-m-d H:i:s') : null,
                        'created_at'    => date('Y-m-d H:i:s'),
                    ]);
                    $this->createKdsItem($data);
                }
            }
            $status  = 200;
            $message = 'Todos los items actualizados';
        }

        return ['status' => $status, 'message' => $message];
    }
}

$fn = $_POST['opc'];
$obj = new Cocina();
echo json_encode($obj->$fn());
