<?php
if (empty($_POST['opc'])) exit(0);
session_start();
setlocale(LC_TIME, 'es_ES.UTF-8');
date_default_timezone_set('America/Mexico_City');

header("Access-Control-Allow-Origin: *"); // Permite solicitudes de cualquier origen
header("Access-Control-Allow-Methods: GET, POST, OPTIONS"); // Métodos permitidos
header("Access-Control-Allow-Headers: Content-Type"); // Encabezados permitidos

// Incluir el modelo correspondiente
require_once '../mdl/mdl-payment.php';

class Payment extends MPayment {

    // Info event.
    public function getFormatedEvent(){

        // Info Event.

        $Event                  = $this -> getEventsByID([$_POST['idEvent']]);
        $Event['day']           = formatSpanishDay($Event['date_start']);
        $Event['date_start']    = formatSpanishDate($Event['date_start'], 'normal');
        $Event['date_end']      = formatSpanishDate($Event['date_end'], 'normal');
        $Event['date_creation'] = formatSpanishDate($Event['date_creation'], 'normal');
        $type = 'Event';

        $SubEvent = [];

        // Data Payment
        $payment = $this -> getPaymentByID([$_POST['idEvent']]);


        // Info SubEvent.
        $ls       = $this -> listSubEvents([ $_POST['idEvent'] ]);

        if (count($ls) > 0) { // existen sub eventos
            $type = 'SubEvent';
            foreach($ls as $key){


                $menu   = $this -> getPackagesBySubEventId([$key['id']]);
                $dishes = $this -> getProductsPackageId([$menu[0]['package_id']]);
                $extras = $this -> getExtrasBySubEventId([$key['id']]);

                $menu['dishes'] = $dishes;
                $SubEvent[] = [

                    'id'              => $key['id'],
                    'name_subevent'   => $key['name_subevent'],
                    'date'            => $key['date'],
                    'date_start'      => $key['date_start'],
                    'date_end'        => $key['date_end'],
                    'time_start'      => $key['time_start'],
                    'time_end'        => $key['time_end'],
                    'total_pay'       => $key['total_pay'],
                    'location'        => $key['location'],
                    'quantity_people' => $key['quantity_people'],
                    'menu'            => $menu,
                    'extra'          => $extras,
              
                ];



            }
        
        } else{ // no existen 


            // 📦 Si no hay subeventos, usar menu del evento.
            $lsPackage   = $this->getPackagesByEventId([$_POST['idEvent']]);
            $extras      = $this -> getExtrasByEvent([$_POST['idEvent']]);

            $data = [];
            foreach($lsPackage as $menu){
                
                $dishes = $this->getProductsPackageId([$menu['idPackage']]);

                $data[] = [
                    'idPackage'     => $menu['idPackage'],
                    'id'            => $menu['id'],
                    'name'          => $menu['name'],
                    'active'        => $menu['active'],
                    'date_creation' => $menu['date_creation'],
                    'description'   => $menu['description'],
                    'event_id'      => $menu['event_id'],
                    'package_id'    => $menu['package_id'],
                    'price'         => $menu['price'],
                    'price_person'  => $menu['price_person'],
                    'quantity'      => $menu['quantity'],
                    'subevent_id'   => $menu['subevent_id'],
                    'dishes'        => $dishes
                ];


            }

          
        }


        $company = [
            'location' => $_SESSION['UBICATION'],
            'logo'     => $_SESSION['LOGO']
        ];
        

        return[
            'type'     => $type,
            'Event'    => $Event,
            'data'     => $data,
            'SubEvent' => $SubEvent,
            'Payment'  => $payment,
            'menu'     => $data,
            'extras'   => $extras,
            'ls'       => $ls,
            'company'  => $company,
            'clausules' => $this->listClausules([1, $_SESSION['COMPANY_ID']])
        ];

    }

    public function getEvent(){

        $Event               = $this -> getEventsByID([$_POST['idEvent']]);
        $Event['day']        = formatSpanishDay($Event['date_start']);
        $Event['date_start'] = formatSpanishDate($Event['date_start'], 'normal');
        $Event['date_end']   = formatSpanishDate($Event['date_end'], 'normal');
        
        // Datos del cliente
        
        $advanced   = $this->getAdvancedPay([$_POST['idEvent']]);
        
        $Event['advance_pay']   = $advanced['totalPay'];

        // ** Menu
        $listTime = $this -> getTimeByEvent([$_POST['idEvent']]);
        $__menu = [];

        foreach($listTime as $time){

            $__menu[] =[
                'id'       => '',
                'cantidad' => ['html' =>$time['valor'].'° tiempo','class' => 'bg-gray-100 p-1 font-bold'],
                'platillo' => ['class' => 'bg-gray-100 p-1'],
                'tipo'     => ['class' => 'bg-gray-100 p-1'],
                'opc'      => 1
            ];

             $listMenu = $this -> getMenuByID([$_POST['idEvent'],$time['valor']]);


             foreach($listMenu as $menu){

                    $__menu[] =[
                        'id'       => $menu['id_event'],
                        'cantidad' => $menu['quantity'],
                        'platillo' => $menu['dish'],
                        'tipo'     => $menu['classification'],
                        'opc'      => 0
                    ];

             }

        }

        $listMenu = $this -> getMenu([$_POST['idEvent']]);

        // Data Payment
        $payment = $this -> getPaymentByID([$_POST['idEvent']]);


        return[
            'Event'    => $Event,
            'Payment'  => $payment,
            'Menu'     => ['row' => $__menu ,'thead' => '','data'=> $listMenu],
            'sucursal' => $_SESSION['SUB']
        ];
    }

    public function getDataEvent() {

        $Event               = $this -> getEventsByID([$_POST['idEvent']]);
        $Event['day']        = formatSpanishDay($Event['date_start']);
        $Event['date_start'] = formatSpanishDate($Event['date_start'], 'normal');
        $Event['date_end']   = formatSpanishDate($Event['date_end'], 'normal');

        $__row   = [];

        $paquete = [];

        $ls    = $this-> lsSubEvent([$_POST['idEvent']]);

        
        
        foreach ($ls as $key ) {
            
            $__row[] = [
                'id'               => $key['id'],
                'Tipo paquete'     => $key['type'],
                'Nombre de evento' => $key['name_sub_event'],
                'Fecha inicio'     => $key['date_start'].' a las '.$key['time_start'].' hrs',
                'No personas'      => $key['quantity_people'],
                'notes'            => $key['notes'],
                'opc'              => 0
            ];


             $__row[] = [
                'id'           => $key['id'],
                'Tipo paquete' => '<strong>Descripción del Menú </strong>',
                'colgroup'     => true
            ];


            $lsMenu    = $this-> lsMenu([$key['id']]);

            foreach ($lsMenu as $_key ) {
                
                $__row[] = [
                    'id'               => $_key['id'],
                    'Tipo paquete'     => '<b>Cantidad:</b>',
                    'Nombre de evento' => $_key['quantity'],
                    'Fecha inicio'     => '<b>Precio por persona:</b>',
                    'No personas'      => $_key['pay_person'],
                    'notes'            => '',
                    'opc'              => 0
                ];

            }

        }

      
        $Package = [
        
            'row' => $__row,
            'thead' => ['Tipo paquete', 'Nombre de evento',
                'Fecha inicio',
                'No personas',
                'notes',
            ],
            'sub' => $ls

        ];

        $listMenu = $this -> getMenuByID([$_POST['idEvent']]);
        $__menu = [];
        foreach($listMenu as $menu){

            $__menu[] =[
                'id'            => $menu['id_event'],
                'cantidad'      => $menu['quantity'],
                'platillo'          => $menu['dish'],
                'Clasificacion' => $menu['classification'],
                'opc'           => 0
            ];

        }
        
        return[
            'Event'        => $Event,
            'Menu'       => ['row' => $__menu ,'thead' => ''], 
            'EventPackage' => [],
            'hello'       => ''

        ];
    }

    // list Payment.
    function listPagos() {

        $data = $this->getListPayment([$_POST['id']]);
        $__row = [];
        $icono = '<i class="icon-credit-card"></i>';
        foreach ($data as $key) {
            if ($key['method_pay'] == 'Efectivo') {
                $icono = '<i class="icon-money"></i>';
            } elseif ($key['method_pay'] == 'Transferencia') {
                $icono = '<i class="icon-exchange"></i>';
            } else {
                $icono = '<i class="icon-credit-card"></i>';
            }
            $__row[] = [
                'id'           => $key['id'],
             
                'Fecha de Pago'=> [
                    'html'  => '<i class="icon-calendar-2"></i> ' . formatSpanishDate($key['date_pay']),
                //     'class' => 'text-white'
                ],
                'Método'       => [
                    'html'  => $icono .' '. $key['method_pay'],
                    // 'class' => 'text-center'
                ],
                'Tipo'         => [
                    'html'  =>  ($key['type'] == 1) ? '<span class="">Pago</span>' : '<span class="">Anticipo</span>' ,
                    // 'class' => 'text-center'
                ],
                
                'Monto'        => [
                    'html'  => '$ ' . number_format($key['pay'], 2),
                    // 'class' => 'text-green-500 font-semibold text-end'
                ],
                'opc' =>0
            ];
        }

        return [
            'row'   => $__row,
            $data
        ];
    }

    function getHistory(){
        
        $lsHistories = $this -> getHistoryEventByID([ $_POST['id'] ]);
        $payment     = $this -> getListPayment([$_POST['id']]);
        $Event       = $this -> getEventsByID([$_POST['id']]);

        $totalPagado = 0;
        foreach ($payment as $key) {
            $totalPagado += $key['pay'];
        }

        $info = [

            'pagado'   => $totalPagado,
            'total'    => $Event['total_pay'],
            'discount' => $Event['discount'],
            'restante' => $Event['total_pay'] - $totalPagado,

        ];
        
        return [ 
            'info'    => $info, 
            'payment' => $payment,
            'history' => $lsHistories 
        ];
      
    }

    function addPayment() {
        
        $status  = 500;
        $message = 'Error al agregar el pago.';

        // Fecha y usuario del pago
        $_POST['date_pay'] = date('Y-m-d H:i:s');
        $total             = $_POST['total'];
        $_POST['user_id']  = $_SESSION['USR'];
        unset($_POST['total']);

        // Registro del pago
        $addPay    = $this->addMethodPay($this->util->sql($_POST));
        $methodPay = $this->getMethodPay([$_POST['method_pay_id']]);
        $payAmount = evaluar($_POST['pay']);

        // Verificación y actualización del evento
        if ($addPay) {
            
            if ($total == $_POST['pay']) {
                $message = "Se liquidó deuda con {$payAmount} en {$methodPay}";
                $statusProcessId = 3;
            } else {
                $message = "Se pagó {$payAmount} en {$methodPay}";
                $statusProcessId = 2;
            }

            $this->updateEvent($this->util->sql([
                'status_process_id' => $statusProcessId,
                'id'                => $_POST['evt_events_id']
            ], 1));

            $status = 200;
        }

        // Historial del pago
        $this->logHistory($_POST['evt_events_id'], $message);

        // Respuesta final
        return [
            'status'  => $status,
            'message' => $message,
        ];
    }

    private function logHistory($eventId, $message) {

        $this->addHistories($this->util->sql([
            'title'         => 'Abono',
            'evt_events_id' => $eventId,
            'comment'       => $message,
            'action'        => $message,
            'date_action'   => date('Y-m-d H:i:s'),
            'type'          => 'payment',
            'usr_users_id'  => $_SESSION['USR']
        ]));
    }


   

    function addHistory(){
        
        $_POST['date_action']   = date('Y-m-d H:i:s'); 

        $values      = $this -> util -> sql($_POST);
        $success     = $this -> addHistories($values);
        $lsHistories = $this -> getHistoryEventByID([$_POST['evt_events_id']]);

        
        return [
            'success' => $success,
            'history' => $lsHistories    
        ];
    }

}

// Instancia del objeto
$obj = new Payment();
$fn = $_POST['opc'];
$response = $obj->$fn();

echo json_encode($response);