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
    
    function init() {
        $rolId = $_SESSION['ROLID'];
        $company = $_SESSION['COMPANY_ID'];
        
        return [
            'subsidiaries' => $this->getSubsidiariesByCompany([$company]),
            'isAdmin' => $rolId == 1
        ];
    }
    
    function getCalendar()  {
        // Validar variables de sesión con valores por defecto
        $rolId      = $_SESSION['ROLID'];
        $sessionSub = $_SESSION['SUB'];

        // Si es admin (rol 1), usar la sucursal del POST, sino usar la de sesión
        if ($rolId == 1) {
            // Validar que subsidiaries_id exista y no sea vacío
            $subsidiaries_id = isset($_POST['subsidiaries_id']) ? $_POST['subsidiaries_id'] : 0;
        } else {
            $subsidiaries_id = $sessionSub;
        }

        $event = [];
        $statuses = isset($_POST['statuses']) ? explode(',', $_POST['statuses']) : ['1', '2', '3', '4'];
        $delivery = isset($_POST['delivery']) ? explode(',', $_POST['delivery']) : ['0', '1'];
        
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
                'color'    => $color
            ];
        }
        return $event;
    }
}

$obj    = new ctrlCalendario();
$fn     = $_POST['opc'];
$encode = $obj->$fn();
echo json_encode($encode);
