<?php

if (empty($_POST['opc'])) exit(0);
session_start();
header("Access-Control-Allow-Origin: *"); // Permite solicitudes de cualquier origen
header("Access-Control-Allow-Methods: GET, POST, OPTIONS"); // Métodos permitidos
header("Access-Control-Allow-Headers: Content-Type"); // Encabezados permitidos

// incluir tu modelo
require_once '../mdl/mdl-calendario.php';


$encode = [];

class ctrlCalendario extends MCalendarioPedidos{

    const ROL_PRODUCCION = 8;

    function init() {
        $rolId = $_SESSION['ROLID'];
        $company = $_SESSION['COMPANY_ID'];
        
        return [
            'subsidiaries'    => $this->getSubsidiariesByCompany([$company]),
            'subsidiariesCobro' => $this->getSubsidiariesByCompany([$company]),
            'isAdmin'         => $rolId == 1,
            // El front condiciona botones por perfil (ej. Supervisor 6 no opera).
            'rolId'           => $rolId,
            'subsidiaryName'  => $_SESSION['SUBSIDIARIE_NAME'] ?? '',
            'subsidiaryId'    => $_SESSION['SUB'] ?? null
        ];
    }
    
    function getCalendar()  {
        // Validar variables de sesión con valores por defecto
        $rolId      = $_SESSION['ROLID'];
        $sessionSub = $_SESSION['SUB'];

        // El calendario es vista de consulta: cualquier usuario puede filtrar por
        // una sucursal o por "Todas" (0). Si no llega filtro, usa la de sesion.
        $subsidiaries_id = isset($_POST['subsidiaries_id']) && $_POST['subsidiaries_id'] !== ''
            ? $_POST['subsidiaries_id']
            : $sessionSub;

        $event = [];
        $statuses = isset($_POST['statuses']) ? explode(',', $_POST['statuses']) : ['1', '2', '3', '4'];
        $delivery = isset($_POST['delivery']) ? explode(',', $_POST['delivery']) : ['0', '1'];

        // Produccion no ve cotizaciones (estado 1). Sin estados el modelo no filtra y
        // traeria todos, por eso se corta aqui si solo pidio cotizaciones.
        if ($rolId == self::ROL_PRODUCCION) {
            $statuses = array_values(array_diff($statuses, ['1']));
            if (empty($statuses)) return [];
        }

        $getCalendar = $this->getOrders($statuses, $delivery, $subsidiaries_id);

        foreach ($getCalendar as $key) {
            $color = '';
            if ($key['idStatus'] == 1) $color = "#6E95C0"; // cotizacion
            elseif ($key['idStatus'] == 2) $color = "#FE6F00"; // pediente
            elseif ($key['idStatus'] == 3) $color = "#0E9E6E"; // pagado
            elseif ($key['idStatus'] == 4) $color = "#E60001"; // cancelado

            $delivered = 'No Entregado';
            
            if ($key['is_delivered'] == 1) {
                $delivered = 'Entregado';

            }else if($key['is_delivered'] == 2){

                $delivered = 'Para Producir';
            }

            $type = 'Recogida en Tienda';
            if ($key['delivery_type'] == 1) {
                $type = 'Envío a Domicilio';                
            }
            
            $event[] = [
                'id'       => $key['id'],
                'title'    => $key['name_client'],
                'start' => date('Y-m-d', strtotime($key['date_order'])),
                'hour'    =>$key['time_order'],
                'status'   => $key['status_label'],
                'location' => $key['location'],
                'client'   => $key['name_client'],
                'delivery' => $delivered,
                'type'     => $type,
                'color'    => $color,
                'folio'    => formatFolio($key['subsidiaries_id'], $key['id']),
                // Palomeo de Produccion: fecha y hora en que se marco como elaborado.
                'produced'   => $key['produced_at'] ? 1 : 0,
                'producedAt' => $key['produced_at'] ?? ''
            ];
        }
        return $event;
    }

    // Produccion palomea los pedidos que ya elaboro (produced = 1) o quita la
    // palomita (0). Solo ese rol, y solo pedidos de su empresa que no sean
    // cotizacion: el id llega del navegador y no se confia en el.
    function statusProduction() {
        if ($_SESSION['ROLID'] != self::ROL_PRODUCCION) {
            return ['status' => 403, 'message' => 'Solo Producción puede palomear los pedidos.'];
        }

        $order       = $this->getOrderID([$_POST['id']]);
        $companySubs = array_column($this->getSubsidiariesByCompany([$_SESSION['COMPANY_ID']]), 'id');

        if (empty($order) || !in_array($order[0]['subsidiaries_id'], $companySubs) || $order[0]['status'] == 1) {
            return ['status' => 404, 'message' => 'El pedido no existe o no es de tu empresa.'];
        }

        $produced = $_POST['produced'] == 1;
        $now      = date('Y-m-d H:i:s');

        $data = [
            'produced_by' => $produced ? $_SESSION['ID'] : '',
            'produced_at' => $produced ? $now : '',
            'id'          => $_POST['id']
        ];

        $update = $this->updateOrderProduction($this->util->sql($data, 1));

        return [
            'status'     => $update ? 200 : 500,
            'message'    => $update ? 'Palomita guardada.' : 'No se pudo guardar la palomita.',
            'producedAt' => $produced ? date('d/m/Y h:i A', strtotime($now)) : ''
        ];
    }

    function updateDeliveryStatus() {
        $status = 500;
        $message = 'Error al actualizar el estado de entrega';

        if ($_SESSION['ROLID'] == self::ROL_PRODUCCION) {
            return [
                'status'  => 403,
                'message' => 'Tu perfil de Producción solo puede consultar los pedidos.'
            ];
        }

        $id           = $_POST['id'] ?? null;
        $is_delivered = $_POST['is_delivered'] ?? null;
        
        if (!$id || !isset($is_delivered)) {
            return [
                'status' => 400,
                'message' => 'Parámetros incompletos'
            ];
        }
        
        $order = $this->getOrderID([$id]);
        
            
        $update = $this->updateOrderDeliveryStatus([
            'id' => $id,
            'is_delivered' => $is_delivered
        ]);
        
        if ($update) {
            $status     = 200;
            $statusText = $is_delivered == 1 ? 'entregado' : 'no entregado';
            $message    = "El pedido fue marcado como {$statusText}";
        }
        
        return [
            'status' => $status,
            'message' => $message,
            'order'   => $order,
            'data' => [
                'id' => $id,
                'is_delivered' => $is_delivered
            ]
        ];
    }
}

// Complements.

function formatFolio($subsidiariesId = null, $numero = null) {
    $sucursal = ($subsidiariesId === null || $subsidiariesId === '') ? 'X' : str_pad($subsidiariesId, 2, '0', STR_PAD_LEFT);
    return 'P' . $numero . '-' . $sucursal;
}

$obj    = new ctrlCalendario();
$fn     = $_POST['opc'];
$encode = $obj->$fn();
echo json_encode($encode);
