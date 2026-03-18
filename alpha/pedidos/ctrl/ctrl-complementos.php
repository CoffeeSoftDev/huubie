<?php
session_start();
if (empty($_POST['opc'])) exit(0);

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

require_once '../mdl/mdl-complementos.php';

class Complementos extends MComplementos {

    function init() {
        $sub_id = $_SESSION['SUB'];

        return [
            'loyalty_config' => $this->getLoyaltyConfigBySubsidiary([$sub_id]),
            'tables'         => $this->listTables([$sub_id]),
            'access'         => $_SESSION['ROLID'],
            'sub_id'         => $sub_id,
        ];
    }

    // === LEALTAD ===

    function editLoyaltyConfig() {
        $status  = 500;
        $message = 'Error al guardar configuracion';
        $sub_id  = $_SESSION['SUB'];

        $existing = $this->getLoyaltyConfigBySubsidiary([$sub_id]);

        if ($existing) {
            $_POST['id'] = $existing['id'];
            $update = $this->updateLoyaltyConfig($this->util->sql($_POST, 1));
            if ($update) {
                $status  = 200;
                $message = 'Configuracion de lealtad actualizada';
            }
        } else {
            $_POST['subsidiary_id'] = $sub_id;
            $_POST['created_at'] = date('Y-m-d H:i:s');
            $create = $this->createLoyaltyConfig($this->util->sql($_POST));
            if ($create) {
                $status  = 200;
                $message = 'Configuracion de lealtad creada';
            }
        }

        return ['status' => $status, 'message' => $message];
    }

    function addLoyaltyPoints() {
        $status  = 500;
        $message = 'Error al agregar puntos';
        $sub_id  = $_SESSION['SUB'];

        $client_id = $_POST['client_id'];
        $order_id  = $_POST['order_id'];
        $total     = floatval($_POST['total']);

        $config = $this->getLoyaltyConfigBySubsidiary([$sub_id]);
        if (!$config) {
            return ['status' => 404, 'message' => 'No hay configuracion de lealtad activa'];
        }

        $points = floor($total * floatval($config['points_per_peso']));

        $clientPoints = $this->getClientLoyaltyPoints([$client_id, $sub_id]);

        if ($clientPoints) {
            $newBalance = intval($clientPoints['points_balance']) + $points;
            $this->updateLoyaltyPointsBalance([$newBalance, $points, $client_id, $sub_id]);
        } else {
            $data = $this->util->sql([
                'client_id'      => $client_id,
                'points_balance' => $points,
                'total_earned'   => $points,
                'total_redeemed' => 0,
                'subsidiary_id'  => $sub_id,
            ]);
            $this->createLoyaltyPoints($data);
        }

        $txData = $this->util->sql([
            'client_id'      => $client_id,
            'order_id'       => $order_id,
            'type'           => 'earn',
            'points'         => $points,
            'description'    => 'Puntos por compra #' . $order_id,
            'employee_id'    => $_SESSION['ID'],
            'subsidiary_id'  => $sub_id,
            'created_at'     => date('Y-m-d H:i:s'),
        ]);
        $this->createLoyaltyTransaction($txData);

        $status  = 200;
        $message = $points . ' puntos agregados';

        return ['status' => $status, 'message' => $message, 'points_earned' => $points];
    }

    function redeemLoyaltyPoints() {
        $status  = 500;
        $message = 'Error al canjear puntos';
        $sub_id  = $_SESSION['SUB'];

        $client_id = $_POST['client_id'];
        $points    = intval($_POST['points']);

        $config = $this->getLoyaltyConfigBySubsidiary([$sub_id]);
        if (!$config) {
            return ['status' => 404, 'message' => 'No hay configuracion de lealtad activa'];
        }

        if ($points < intval($config['min_points_redeem'])) {
            return ['status' => 400, 'message' => 'Puntos minimos para canjear: ' . $config['min_points_redeem']];
        }

        $clientPoints = $this->getClientLoyaltyPoints([$client_id, $sub_id]);
        if (!$clientPoints || intval($clientPoints['points_balance']) < $points) {
            return ['status' => 400, 'message' => 'Puntos insuficientes'];
        }

        $discount = $points * floatval($config['peso_per_point']);

        $redeem = $this->updateLoyaltyPointsRedeem([$points, $points, $client_id, $sub_id, $points]);

        if ($redeem) {
            $txData = $this->util->sql([
                'client_id'      => $client_id,
                'order_id'       => 0,
                'type'           => 'redeem',
                'points'         => $points,
                'description'    => 'Canje de ' . $points . ' puntos por $' . number_format($discount, 2),
                'employee_id'    => $_SESSION['ID'],
                'subsidiary_id'  => $sub_id,
                'created_at'     => date('Y-m-d H:i:s'),
            ]);
            $this->createLoyaltyTransaction($txData);

            $status  = 200;
            $message = 'Canje exitoso';
        }

        return [
            'status'   => $status,
            'message'  => $message,
            'discount' => $discount,
            'points'   => $points,
        ];
    }

    function getClientPoints() {
        $sub_id = $_SESSION['SUB'];
        $client_id = $_POST['client_id'];

        $points = $this->getClientLoyaltyPoints([$client_id, $sub_id]);
        $config = $this->getLoyaltyConfigBySubsidiary([$sub_id]);

        return [
            'status' => 200,
            'points' => $points,
            'config' => $config,
        ];
    }

    function lsLoyaltyClients() {
        $sub_id = $_SESSION['SUB'];
        $clients = $this->listTopLoyaltyClients([$sub_id]);
        $__row = [];

        if (is_array($clients)) {
            foreach ($clients as $key) {
                $__row[] = [
                    'id'        => $key['client_id'],
                    'Cliente'   => $key['client_name'],
                    'Telefono'  => $key['phone'] ? $key['phone'] : '-',
                    'Saldo'     => ['html' => '<span class="text-yellow-400 font-bold">' . number_format($key['points_balance']) . ' pts</span>', 'class' => 'text-center'],
                    'Ganados'   => ['html' => number_format($key['total_earned']), 'class' => 'text-center'],
                    'Canjeados' => ['html' => number_format($key['total_redeemed']), 'class' => 'text-center'],
                ];
            }
        }

        return ['row' => $__row];
    }

    function lsLoyaltyTransactions() {
        $sub_id = $_SESSION['SUB'];
        $transactions = $this->listLoyaltyTransactions([$sub_id]);
        $__row = [];

        if (is_array($transactions)) {
            foreach ($transactions as $key) {
                $__row[] = [
                    'id'          => $key['id'],
                    'Cliente'     => $key['client_name'],
                    'Tipo'        => loyaltyType($key['type']),
                    'Puntos'      => ['html' => ($key['type'] === 'redeem' ? '-' : '+') . number_format($key['points']), 'class' => 'text-center'],
                    'Descripcion' => $key['description'],
                    'Fecha'       => formatSpanishDate($key['created_at']),
                ];
            }
        }

        return ['row' => $__row];
    }

    // === MESAS ===

    function lsTables() {
        $sub_id = $_SESSION['SUB'];
        $tables = $this->listTables([$sub_id]);

        return ['tables' => $tables];
    }

    function addTable() {
        $status  = 500;
        $message = 'Error al agregar mesa';
        $sub_id  = $_SESSION['SUB'];

        $_POST['subsidiary_id'] = $sub_id;
        $_POST['created_at'] = date('Y-m-d H:i:s');

        $create = $this->createTable($this->util->sql($_POST));

        if ($create) {
            $status  = 200;
            $message = 'Mesa agregada correctamente';
        }

        return ['status' => $status, 'message' => $message];
    }

    function getTable() {
        $table = $this->getTableById([$_POST['id']]);

        if ($table) {
            return ['status' => 200, 'data' => $table];
        }

        return ['status' => 404, 'message' => 'Mesa no encontrada'];
    }

    function editTable() {
        $status  = 500;
        $message = 'Error al editar mesa';

        $edit = $this->updateTable($this->util->sql($_POST, 1));

        if ($edit) {
            $status  = 200;
            $message = 'Mesa editada correctamente';
        }

        return ['status' => $status, 'message' => $message];
    }

    function deleteTable() {
        $status  = 500;
        $message = 'Error al eliminar mesa';

        $values = $this->util->sql(['id' => $_POST['id']], 1);
        $delete = $this->deleteTableById($values);

        if ($delete) {
            $status  = 200;
            $message = 'Mesa eliminada correctamente';
        }

        return ['status' => $status, 'message' => $message];
    }

    function statusTable() {
        $status  = 500;
        $message = 'Error al actualizar estado';

        $update = $this->updateTableStatus([$_POST['status'], $_POST['order_id'], $_POST['id']]);

        if ($update) {
            $status  = 200;
            $message = 'Estado de mesa actualizado';
        }

        return ['status' => $status, 'message' => $message];
    }

    // === CODIGO DE BARRAS ===

    function editBarcode() {
        $status  = 500;
        $message = 'Error al guardar codigo de barras';

        $update = $this->updateProductBarcode([$_POST['barcode'], $_POST['product_id']]);

        if ($update) {
            $status  = 200;
            $message = 'Codigo de barras actualizado';
        }

        return ['status' => $status, 'message' => $message];
    }

    function searchBarcode() {
        $sub_id = $_SESSION['SUB'];
        $barcode = $_POST['barcode'];

        $product = $this->getProductByBarcode([$barcode, $sub_id]);

        if ($product) {
            return ['status' => 200, 'product' => $product];
        }

        return ['status' => 404, 'message' => 'Producto no encontrado con ese codigo'];
    }

    // === CFDI ===

    function addCfdiInvoice() {
        $status  = 500;
        $message = 'Error al crear factura';
        $sub_id  = $_SESSION['SUB'];

        $_POST['employee_id']   = $_SESSION['ID'];
        $_POST['subsidiary_id'] = $sub_id;
        $_POST['status']        = 'pendiente';
        $_POST['created_at']    = date('Y-m-d H:i:s');

        $create = $this->createCfdiInvoice($this->util->sql($_POST));

        if ($create) {
            $status  = 200;
            $message = 'Solicitud de factura creada. Pendiente de timbrado.';
        }

        return ['status' => $status, 'message' => $message];
    }

    function lsCfdiInvoices() {
        $fi = $_POST['fi'];
        $ff = $_POST['ff'];
        $sub_id = $_SESSION['SUB'];

        $invoices = $this->listCfdiInvoices([$sub_id, $fi, $ff]);
        $__row = [];

        if (is_array($invoices)) {
            foreach ($invoices as $key) {
                $__row[] = [
                    'id'        => $key['id'],
                    'Pedido'    => '#' . $key['order_id'],
                    'RFC'       => $key['rfc_receptor'],
                    'Razon Social' => $key['razon_social_receptor'],
                    'Total'     => ['html' => evaluar($key['total']), 'class' => 'text-end'],
                    'UUID'      => $key['uuid'] ? substr($key['uuid'], 0, 12) . '...' : '-',
                    'Estado'    => cfdiStatus($key['status']),
                    'Fecha'     => formatSpanishDate($key['created_at']),
                ];
            }
        }

        return ['row' => $__row];
    }

    // === PERMISOS ===

    function lsPermissions() {
        $role_id = $_POST['role_id'];
        $sub_id  = $_SESSION['SUB'];

        $permissions = $this->listPermissionsByRole([$role_id, $sub_id]);

        return ['permissions' => $permissions];
    }

    function editPermissions() {
        $status  = 500;
        $message = 'Error al guardar permisos';
        $sub_id  = $_SESSION['SUB'];

        $role_id = $_POST['role_id'];
        $permissions = json_decode($_POST['permissions'], true);

        $this->deletePermissionsByRole([$role_id, $sub_id]);

        if (is_array($permissions)) {
            foreach ($permissions as $perm) {
                $data = $this->util->sql([
                    'role_id'       => $role_id,
                    'module'        => $perm['module'],
                    'permission'    => $perm['permission'],
                    'allowed'       => $perm['allowed'],
                    'subsidiary_id' => $sub_id,
                    'created_at'    => date('Y-m-d H:i:s'),
                ]);
                $this->createPermission($data);
            }
            $status  = 200;
            $message = 'Permisos actualizados correctamente';
        }

        return ['status' => $status, 'message' => $message];
    }
}

function loyaltyType($type) {
    $types = [
        'earn'   => '<span class="px-2 py-1 rounded-md text-sm font-semibold bg-[#014737] text-[#3FC189]">Ganado</span>',
        'redeem' => '<span class="px-2 py-1 rounded-md text-sm font-semibold bg-[#8a4600] text-[#f0ad28]">Canjeado</span>',
        'adjust' => '<span class="px-2 py-1 rounded-md text-sm font-semibold bg-[#1e3a5f] text-[#60a5fa]">Ajuste</span>',
    ];
    return $types[$type] ?? '<span class="badge bg-secondary">Desconocido</span>';
}

function cfdiStatus($status) {
    $statuses = [
        'pendiente' => '<span class="px-2 py-1 rounded-md text-sm font-semibold bg-[#8a4600] text-[#f0ad28]">Pendiente</span>',
        'timbrada'  => '<span class="px-2 py-1 rounded-md text-sm font-semibold bg-[#014737] text-[#3FC189]">Timbrada</span>',
        'cancelada' => '<span class="px-2 py-1 rounded-md text-sm font-semibold bg-[#721c24] text-[#ba464d]">Cancelada</span>',
        'error'     => '<span class="px-2 py-1 rounded-md text-sm font-semibold bg-[#721c24] text-[#ba464d]">Error</span>',
    ];
    return $statuses[$status] ?? '<span class="badge bg-secondary">Desconocido</span>';
}

$fn = $_POST['opc'];
$obj = new Complementos();
echo json_encode($obj->$fn());
