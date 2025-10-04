<?php
session_start();
if (empty($_POST['opc'])) exit(0);


header("Access-Control-Allow-Origin: *"); // Permite solicitudes de cualquier origen
header("Access-Control-Allow-Methods: GET, POST, OPTIONS"); // Métodos permitidos
header("Access-Control-Allow-Headers: Content-Type"); // Encabezados permitidos

require_once '../mdl/mdl-reservaciones.php';
class ctrl extends MPedidos{

    function init(){
        return [
            'status' => $this->lsEstatus()
        ];
    }

    // Reservations.
    function lsReservation() {
        $__row = [];

        $idEstatus = $_POST['status'];
        $fi        = $_POST['fi'];
        $ff        = $_POST['ff'];
        $sub       = $_SESSION['SUB'];

        $Sucursal  = $this->getSucursalByID([$sub]);

        $ls = $this->listReservations([
            'subsidiaries_id' => $Sucursal['idSucursal'],
            'fi'              => $fi,
            'ff'              => $ff,
            'status'          => 1
        ]);

        foreach ($ls as $key) {
            $date_creation = formatSpanishDate($key['date_creation'], 'normal');
            $Folio         = formatSucursal($Sucursal['name'], $Sucursal['sucursal'], $key['id']);

            $__row[] = [
                'id'       => $key['id'],
                'folio'    => $Folio,
                'Creación' => $date_creation,
                'Cliente'  => [
                    'html' => "<p class='text-gray-300'>{$key['name_event']}</p>
                            <p class='text-gray-500'>{$key['name_client']}</p>",
                ],

                'Fecha de evento' => formatSpanishDate($key['date_start'], 'normal'),
                'Horario'         => $key['hours_start'],
                'Total'           => [
                    "html"  => evaluar($total),
                    "class" => "text-end bg-[#283341]"
                ],
                'Ubicación' => $key['location'],
                'Estado'    => status($key['estado']),
                'dropdown'  => dropdown($key['id'], $key['estado'])
            ];
        }

        return [
            "row" => $__row,
            'ls'  => $ls,
            $_SESSION['SUB'],
            'id'  => $Sucursal['idSucursal'],
        ];
    }

    function getReservation() {
        $status = 500;
        $message = 'Error al obtener datos';

        $get = $this->getReservationById([$_POST['id']]);

        if ($get) {
            $status = 200;
            $message = 'Datos obtenidos correctamente';
        }

        return [
            'status' => $status,
            'message' => $message,
            'data' => $get
        ];

    }

    function addReservation() {

        $status  = 500;
        $message = 'Error al crear la reservación';

        $date_start = formatDateTime($_POST['date_start'], $_POST['time_start']);
        unset($_POST['time_start']);

        $_POST['date_start']        = $date_start;
        $_POST['date_creation']     = date('Y-m-d H:i:s');
        $_POST['subsidiaries_id']   = $_SESSION['SUB'];
        $_POST['category_id']       = 2;
        $_POST['status_process_id'] = 1;

        $create = $this->createReservation($this->util->sql($_POST));

        if ($create) {

            $status  = 200;
            $message = 'Reservación creada exitosamente';
        }

        return [
            'status'  => $status,
            'message' => $message
        ];

    }

    function editReservation() {

        $status  = 500;
        $message = 'Error al actualizar la reservación';

        $update = $this->updateReservation($this->util->sql($_POST, 1));

        if ($update) {
            $status  = 200;
            $message = 'Reservación actualizada correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message,
        ];
        
    }

    function cancelReservation(){
        $status  = 500;
        $message = 'Error al cancelar el evento.';

        $update = $this->updateReservation($this->util->sql($_POST, 1));

        if ($update) {
            $status  = 200;
            $message = 'Reservación cancelada correctamente.';
        }

        return [
            'status'  => $status,
            'message' => $message,
        ];
    }

     // History.
     function getHistory(){
        
        $lsHistories = $this -> getReservationHistories([ $_POST['id'] ]);
        
        
        return [ 
          
            'history' => $lsHistories 
        ];
      
    }

     function addHistory(){
        
        $_POST['date_action']   = date('Y-m-d H:i:s'); 
        $_POST['usr_users_id']   =$_SESSION['USR'];

        $values      = $this -> util -> sql($_POST);
        $success     = $this -> addHistories($values);
        $lsHistories = $this -> getReservationHistories([$_POST['reservation_id']]);

        
        return [
            'success' => $success,
            'history' => $lsHistories    
        ];
    }


    


}


// Complements.
function dropdown($id, $status) {

    $instancia = 'app';

    $options = [
        ['Ver', 'icon-eye', "{$instancia}.viewReservation({$id})"],
        ['Editar', 'icon-pencil', "{$instancia}.editReservation({$id})"],
        ['Historial', 'icon-history', "{$instancia}.history({$id})"],
        ['Cancelar', 'icon-block-1', "{$instancia}.cancelReservation({$id})"],
    ];

    if ($status == 2) { // Cancelado
        $options = [
            ['Ver', 'icon-eye', "{$instancia}.viewReservation({$id})"],
            ['Historial', 'icon-history', "{$instancia}.history({$id})"],

        ];
    } elseif ($status == 3) { // Pagado
        $options = [
            ['Ver', 'icon-eye', "{$instancia}.viewReservation({$id})"],
            ['Historial', 'icon-history', "{$instancia}.history({$id})"],

        ];
    }

    return array_map(fn($opt) => [
        'text'    => $opt[0],
        'icon'    => $opt[1],
        'onclick' => $opt[2],
    ], $options);
}

function status($idEstado) {
    $estados = [
        1 => ['bg' => '#EBD9FF', 'text' => '#6B3FA0', 'label' => 'Reservación'], // Lila
        2 => ['bg' => '#B9FCD3', 'text' => '#032B1A', 'label' => 'Si llego'],         // Verde
        3 => ['bg' => '#E5E7EB', 'text' => '#374151', 'label' => 'No llego'],      // Gris
        4 => ['bg' => '#572A34', 'text' => '#E05562', 'label' => 'Cancelado'],      // Gris
    ];

    if (isset($estados[$idEstado])) {
        $estado = $estados[$idEstado];
        return "<span class='w-32 inline-block text-center bg-[{$estado['bg']}] text-[{$estado['text']}] text-xs font-semibold px-3 py-1 rounded'>{$estado['label']}</span>";
    }

    return '';
}

function formatSucursal($compania, $sucursal, $numero = null){

    $letraCompania = strtoupper(substr(trim($compania), 0, 1));
    $letraSucursal = strtoupper(substr(trim($sucursal), 0, 1));

    $number = $numero ?? rand(1, 99);

    $formattedNumber = str_pad($number, 2, '0', STR_PAD_LEFT);

    return 'R-'.$letraCompania . $letraSucursal .'-'. $formattedNumber;
}

function formatDateTime($date, $time) {
    if (!empty($date) && !empty($time)) {
        $datetime = DateTime::createFromFormat('Y-m-d H:i', "$date $time");
        return $datetime ? $datetime->format('Y-m-d H:i:s') : null;
    }
    return null;
}



$obj    = new ctrl();
$fn     = $_POST['opc'];

$encode = [];
$encode = $obj->$fn();
echo json_encode($encode);


?>
