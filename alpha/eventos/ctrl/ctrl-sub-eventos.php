<?php
if (empty($_POST['opc'])) exit(0);
session_start();
setlocale(LC_TIME, 'es_ES.UTF-8');
date_default_timezone_set('America/Mexico_City');

header("Access-Control-Allow-Origin: *"); // Permite solicitudes de cualquier origen
header("Access-Control-Allow-Methods: GET, POST, OPTIONS"); // Métodos permitidos
header("Access-Control-Allow-Headers: Content-Type"); // Encabezados permitidos


require_once '../mdl/mdl-sub-eventos.php';


class ctrl extends mdl{

    function init() {
        return [
            'eventos' => $this->lsEventos(),
            'status'  => $this->lsStatus()
        ];
    }

    //  Event.

    function addEvent() {
        $date_start = formatDateTime($_POST['date_start'], $_POST['time_start']);
        unset($_POST['time_start']);

        $_POST['date_start']        = $date_start;
        $_POST['date_creation']     = date('Y-m-d H:i:s');
        $_POST['subsidiaries_id']   = $_SESSION['SUB'];
        $_POST['status_process_id'] = 1;                    // Cotización
        $_POST['method_pay_id']     = null;

        // Crear evento
        $created = $this->createEvent($this->util->sql($_POST));
        if (!$created) {
            return [
                'status'  => 500,
                'message' => 'Error al crear el Evento.'
            ];
        }

        $id_event    = $this->maxEvent();
        $message     = 'Sigue continuando con sub-evento 🍽️';
        $infoPayment = null;

        $history = "Se creó el evento {$_POST['name_event']}";
        $this->addHistories($this->util->sql([
            'title'         => 'Evento creado',
            'evt_events_id' => $id_event,
            'comment'       => $history,
            'action'        => $history,
            'date_action'   => date('Y-m-d H:i:s'),
            'type'          => 'creation',
            'usr_users_id'  => $_SESSION['USR']
        ]));

        // Registrar anticipo si existe
        // if (!empty($_POST['advanced_pay'])) {
        //     $infoPayment = $this->addPayment($id_event);
        // }

        return [
            'status'      => 200,
            'message'     => $message,
            'infoPayment' => $infoPayment,

            'data'        => [ 'id' => $id_event ]
        ];
    }

    function getEvent(){
        $status = 500;
        $message = 'Error al obtener los datos';
        $getEvent = $this->getEventById([$_POST['id']]);

           // Separar fecha y hora de inicio y fin agregando a getEvent time_start y time_end
        $getEvent['time_start'] = date('H:i', strtotime($getEvent['date_start']));
        $getEvent['time_end']   = date('H:i', strtotime($getEvent['date_end']));
        $getEvent['date_start'] = date('Y-m-d', strtotime($getEvent['date_start']));
        $getEvent['date_end']   = date('Y-m-d', strtotime($getEvent['date_end']));


        if ($getEvent) {
            $status = 200;
            $message = 'Datos obtenidos correctamente.';
        }

        return [
            'status'  => $status,
            'message' => $message,
            'data'    => $getEvent,
        ];
    }

    function editEvents() {
        // EVENTO
        $status     = 500;
        $message    = 'Error al editar el Evento.';
        $date_start = formatDateTime($_POST['date_start'], $_POST['time_start']);

        unset($_POST['time_start']);

        $_POST['date_start'] = $date_start;

        // 🧩 Validar tipo de evento según anticipo
        if (empty($_POST['advanced_pay']) || $_POST['advanced_pay'] == 0) {
            $_POST['status_process_id'] = 1;     // Cotización
            $_POST['method_pay_id']     = null;
        } else {
            $_POST['status_process_id'] = 2;     // Pendiente
        }


        // 👉 Mover ID al final
         $id  = $_POST['id'];  unset($_POST['id']);
         $_POST['id'] = $id;

        // Actualizar evento
        $update = $this->updateEvent($this->util->sql($_POST, 1));

        if ($update) {
            $status  = 200;
            $message = 'Datos del evento editados correctamente.';
        }

        return [
            'status'  => $status,
            'message' => $message,
        ];
    }

    // Payment.

    function addPayment($idEvent) {

        $values_pay = [
            'date_pay'      => date('Y-m-d H:i:s'),
            'type'          => 2,
            'method_pay_id' => $_POST['method_pay_id'],
            'pay'           => $_POST['advanced_pay']
        ];

        $addPay = $this->addMethodPay($this->util->sql($values_pay));

        if (!$addPay) {
            return [
                'status'  => 500,
                'message' => 'Error al agregar el pago'
            ];
        }

        $methodPay = $this->getMethodPay([$_POST['method_pay_id']]);
        $message   = 'Se dio un anticipo de ' . evaluar($_POST['advanced_pay']) . ' en ' . $methodPay;

        // Historial de acción
        $history = [
            'title'         => 'Anticipo',
            'evt_events_id' => $idEvent,
            'comment'       => $message,
            'action'        => $message,
            'date_action'   => date('Y-m-d H:i:s'),
            'type'          => 'payment'
        ];

        $success = $this->addHistories($this->util->sql($history));

        return [
            'status'        => $addPay,
            'statusMessage' => $success,
            'message'       => $message,
            'historys'       => $history,
        ];
    }


    // Discount.

    function applyDiscount() {
        $status = 500;
        $message   = 'No se pudo aplicar el descuento';
        $update    = $this->updateEvent($this->util->sql($_POST, 1));
        $descuento = evaluar($_POST['discount']);

        $data = [
            'title'         =>" Descuento aplicado de {$descuento}  ",
            'evt_events_id' => $_POST['id'],
            'comment'       => $_POST['info_discount'],
            'action'        => $_POST['info_discount'],
            'date_action'   => date('Y-m-d H:i:s'),
            'type'          => 'payment'
        ];

        $comment = $this->addHistories($this->util->sql($data));


        if ($update) {
            $status  = 200;
            $message = 'Descuento aplicado correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
    }

    function getDiscount(){
        $status = 500;
        $message = 'Error al obtener los datos';
        $get = $this->getEventById([$_POST['id']]);


        if ($get) {
            $status = 200;
            $message = 'Datos obtenidos correctamente.';
        }

        return [
            'status'  => $status,
            'message' => $message,
            'data'    => $get,
        ];
    }

    function removeDiscount() {
        $status = 500;
        $message = 'Error al quitar el descuento.';

        $DATA['discount']      = null;
        $DATA['info_discount'] = null;
        $DATA['id']            = $_POST['id'];

        $update = $this->updateEvent($this->util->sql($DATA, 1));

        if ($update) {
            $status  = 200;
            $message = 'Descuento eliminado correctamente.';
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
    }

    // Menus.
    function getInitMenu(){

        return [
            'classifications' => $this->getClassifications(),
            'products'        => $this->getProducts(),
            'packages'        => $this->getPackages(),
        ];
    }

    function addPackage() {

        $status                 = 500;
        $message                = 'No se pudo agregar el paquete';
        $_POST['date_creation'] = date('Y-m-d H:i:s');

        $package = $this-> getPackage([
            $_POST['package_id'],
        ]);
        
        $_POST['price']         = $package['price'];

        $exists = $this->getEventPackageByKeys([
            $_POST['subevent_id'],
            $_POST['package_id'],
        ]);

        if ($exists) {

            $newQty   = (int)$exists['quantity'] + (int)$_POST['quantity'];
            $newTotal = (float)$newQty * (float)$_POST['price'];

            $values = $this->util->sql([
                'quantity' => $newQty,
                'price'    => $_POST['quantity'],
                'id'       => $exists['id'],
            ], 1);
            
        
            $update = $this->updateEventPackageQuantity($values);
            
            if ($update) {
                $status  = 200;
                $message = 'Paquete actualizado correctamente';
            }


        }else {

            $data                   = $this->util->sql([
                'package_id'    => $_POST['package_id'],
                'quantity'      => $_POST['quantity'],
                'subevent_id'   => $_POST['subevent_id'],
                'price'         => $_POST['price'],
                'date_creation' => $_POST['date_creation'],
            ]); 

            $create   = $this -> createEventPackage($data);

            if ($create) {
                $status  = 200;
                $message = 'Paquete agregado correctamente';
            }

        }


       
      

        return [
            'status'  => $status,
            'message' => $message,
            'exist'   => $values,
            'sub'     => $this->lsMenu(),
        ];
    }

    function deletePackage() {
        $status  = 500;
        $message = 'No se pudo eliminar el paquete';

        $data   = $this->util->sql(['id' => $_POST['id']], 1);
        $delete = $this->removePackage($data);

        if ($delete) {
            $status = 200;
            $message = 'Paquete eliminado correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message,
            'sub'     => $this->lsMenu(),
        ];
    }

    function updatePackageQuantity() {
        $status  = 500;
        $message = 'No se pudo actualizar la cantidad';

        $data = $this->util->sql([
            'quantity' => $_POST['quantity'],
            'id'       => $_POST['id'],
        ],1);

        $update = $this->updateEventPackageQuantity($data);

        if ($update) {
            $status  = 200;
            $message = 'Cantidad actualizada correctamente';
        }

        return [
            'status' => $status,
            'message' => $message,
            'sub'    => $this->lsMenu()
        ];
    }

    function deleteExtra() {
        $status  = 500;
        $message = 'No se pudo eliminar el paquete';

        $data   = $this->util->sql(['id' => $_POST['id']], 1);
        $delete = $this->removePackage($data);

        if ($delete) {
            $status = 200;
            $message = 'Paquete eliminado correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message,
            'sub'     => $this->lsMenu(),
        ];
    }

    function addExtra() {
        $status  = 500;
        $message = 'No se pudo agregar el extra';

        $data    = $this->util->sql([
            'product_id'  => $_POST['product_id'],
            'quantity'    => $_POST['quantity'],
            'subevent_id' => $_POST['subevent_id'],
        ]);
        
        $create = $this->createEventExtra($data);
        
        if ($create) {
            $status  = 200;
            $message = 'Extra agregado correctamente';
        }
        
        return [
            'status'  => $status,
            'message' => $message,
            'sub'     => $this->lsMenu(),
        ];
    }

    function lsMenu(){

        $sub          = $this->getSubEventPackage([$_POST['subevent_id']]);
        $productosRaw = $this->getSubEventProduct([$_POST['subevent_id']]);

        // Agrupar paquetes por id del paquete
        $agrupados = [];
        $extras    = [];
        $menus     = [];
        $totalMenus = 0;
        $totalExtras = 0;

        foreach ($sub as $row) {
            $idP = $row['package_id'];

            if (!isset($agrupados[$idP])) {
                $agrupados[$idP] = [
                    'menu' => [
                        'id'               => $row['package_id'],
                        'idEvt'            => $row['idEvtPackage'],
                        'nombre'           => $row['package'],
                        'descripcion'      => $row['description'],
                        'precioPorPersona' => floatval($row['price_person']),
                        'platillos'        => [],
                        'bebidas'          => [],
                    ],
                    'cantidadPersonas' => intval($row['quantity']),
                ];
            }

            $platillo = [
                'id' => $row['idPr'],
                'nombre' => $row['product'],
                'precio' => floatval($row['priceProduct']),
            ];

            // Clasifica como bebida o platillo por el idC (id de clasificación)
            if ($row['idC'] == 2) {
                $agrupados[$idP]['menu']['bebidas'][] = $platillo;
            } else {
                $agrupados[$idP]['menu']['platillos'][] = $platillo;
            }
        }

        // Convertir a array de valores y sumar total de menús
        foreach ($agrupados as $item) {
            $menus[] = $item;

            // Suma el total de cada menú (precioPorPersona * cantidadPersonas)
            $precioPorPersona = isset($item['menu']['precioPorPersona']) ? floatval($item['menu']['precioPorPersona']) : 0;
            $cantidadPersonas = isset($item['cantidadPersonas']) ? intval($item['cantidadPersonas']) : 0;
            $totalMenus += $precioPorPersona * $cantidadPersonas;
        }

        // Formatear productos individuales (extras) y sumar su total
        foreach ($productosRaw as $row) {
            $precio = floatval($row['precioUnitario']);
            $cantidad = intval($row['quantity']);
            $extras[] = [
                'id'               => $row['product_id'],
                'idEvt'            => $row['idEvtPackage'],
                'nombre'           => $row['nombre'],
                'precio'           => $precio,
                'cantidad'         => $cantidad,
                'id_clasificacion' => $row['id_clasificacion'],
                'custom'           => false,
            ];
            $totalExtras += $precio * $cantidad;
        }

        // Calcula el total general
        $totalGeneral = $totalMenus + $totalExtras;

        $success =  $this-> updateSubEvento($this->util->sql([
            'total_pay' => $totalGeneral,
            'id'        => $_POST['subevent_id']
        ],1));


        // Actualizar evento.

        $idEvent = $_POST['evt_events_id'];

        $success = $this->updateTotalEvt($idEvent);


        return  [
            'menusSeleccionados'  => $menus,
            'extrasSeleccionados' => $extras,
            'totalMenus'          => $totalMenus,
            'totalExtras'         => $totalExtras,
            'totalGeneral'        => $totalGeneral, // <-- Aquí está tu total general
            'success'=>$success
        ];
    }

    // Sub Event.

    function listSubEvents() {
        $status   = 500;
        $message  = 'Error al obtener los datos.';
        $ls       = $this->getSubEventsByEventId([$_POST['id']]);
        $getEvent = $this->getEventById([$_POST['id']]);
        $__row    = [];

        foreach ($ls as $key ) {
             $__row[] = [
                'id'           => $key['id'],
                'SubEvento'    => $key['name_subevent'],
                'No personas'  => $key['quantity_people'],
                'Fecha evento' => formatSpanishDate($key['date_start'],'normal'),
                'Hora'         => "({$key['time_start']} - {$key['time_end']})",
                'Lugar'        => $key['location'],
                'Total'        => evaluar($key['total_pay']),
                'Tipo'         => $key['type_event'],
             ];
        }

        if ($ls) {
            $status  = 200;
            $message = 'Datos obtenidos correctamente.';
        }

        return [
            'status'  => $status,
            'message' => $message,
            'data'    => $__row,
            'ls'      => $ls,
            'event'   => $getEvent,
        ];
    }

    function getSubEvent(){
        $status = 500;
        $message = 'Error al obtener los datos';
        $data = $this->getSubEventoByID([$_POST['id']]);

        if ($data) {
            $status = 200;
            $message = 'Datos obtenidos correctamente.';
        }

        return [
            'status'  => $status,
            'data' => $data,
        ];
    }

    function addSubEvent() {
        $status = 500;
        $message                    = 'No se pudo insertar correctamente';
        $_POST['date_creation']     = date('Y-m-d H:i:s');
        $_POST['status_process_id'] = 1;

        $create = $this->createSubEvento($this->util->sql($_POST));
        $success = $this -> updateTotalEvent($_POST['evt_events_id']);

        if ($create) {
            $status  = 200;
            $message = 'Se agregó correctamente.';
            $id_subevent    = $this->maxSubEvent();

            $history = "Se creó el subevento {$_POST['name_subevent']}";
            $this->addHistories($this->util->sql([
                'title'         => 'Subevento creado',
                'evt_subevents_id' => $id_subevent,
                'comment'       => $history,
                'action'        => $history,
                'date_action'   => date('Y-m-d H:i:s'),
                'type'          => 'creation',
                'usr_users_id'  => $_SESSION['USR']
            ]));
        }

        return [
            'status'  => $status,
            'message' => $message,
        ];
    }

    function updateTotalEvent($idEvent){
        $subEvents = $this->getTotalSubEvents([$idEvent]);


        $sql_event = $this->util->sql([
            'total_pay'       => $subEvents['total'],
            'quantity_people' => $subEvents['quantity'],
            'id'              => $idEvent
        ],1);

        return $this->updateEvent($sql_event);

    }

    function editSubEvent() {

        $status  = 500;
        $message = 'Error al editar';
        $idEvent = $_POST['evt_events_id'];
        unset($_POST['evt_events_id']);

        $edit    = $this->updateSubEvento($this->util->sql($_POST, 1));
        $success = $this -> updateTotalEvent($idEvent);

        if ($edit) {
            $status  = 200;
            $message = 'Se ha editado correctamente';
        }
        return [
            'status'  => $status,
            'message' => $message,
             'OK'=>$success
        ];
    }

    function deleteSubEvent() {
        $status  = 500;
        $message = 'Error al eliminar';
        $idEvent = $_POST['evt_events_id'];
        unset($_POST['evt_events_id']);
        $delete  = $this->deleteSubEvento($this->util->sql($_POST, 1));
        $success = $this -> updateTotalEvent($idEvent);

        if ($delete) {
            $status = 200;
            $message = 'Subevento eliminado correctamente.';
        }
        return [
            'status'  => $status,
            'message' => $message,
            $delete
        ];
    }

    // Menu
    function getMenu(){
        $status = 500;
        $message = 'Error al obtener los datos';
        $getMenu = $this->getMenuById([$_POST['id_sub_event']]);

        if ($getMenu) {
            $status = 200;
            $message = 'Datos obtenidos correctamente.';
        }
        return [
            'status'  => $status,
            'message' => $message,
            'menu'    => $getMenu[0]
        ];
    }

    function addMenu() {
        $status = 500;
        $message = 'Error al agregar menu.';

        // Insertar menu
        $addMenu = $this->createMenu($this->util->sql($_POST));
        if ($addMenu == true) {
            $id_menu = $this->maxMenu();
            $status  = 200;
            $message = 'Por último, agrega los platillos. 🍜';
        }

        return [
            'status'   => $status,
            'message' => $message,
            'data'    => [
                'id' => $id_menu
            ]
        ];
    }

    // Dishes
    function lsDishes() {

        $__row   = [];
        $idSubEvent = $_POST['idSubEvent'];
        $getDish = $this->getDish([$_POST['id']]);

        $tiempo = '';
        foreach ($getDish as $key) {
            $a = [];

            $a[] = [
                "onclick" => "sub.editDish({$key['id']},{$_POST['id']},{$idSubEvent})",
                "class"   => 'btn btn-primary btn-sm me-1 text-white',
                "html"    => '<i class="icon-pencil"></i>',
            ];

            $a[] = [
              "onclick" => "sub.removeDish(" . $key['id'] . ",{$idSubEvent})",
              "class"   => 'btn btn-danger btn-sm text-white',
              "html"    => '<i class="icon-trash-empty"></i>',
            ];

            // Validar tiempo
            if ($key['tiempo'] == 1) {

                $tiempo = 'Primer tiempo';
            } else if ($key['tiempo'] == 2) {

                $tiempo = 'Segundo tiempo';

            } else if ($key['tiempo'] == 3) {

                $tiempo = 'Tercer tiempo';
            }

            $__row[] = [
                'id'            => $key['id'],
                'quantity'      => $key['quantity'],
                'clasificacion' => $key['clasificacion'],
                'dish'          => $key['dish'],
                'tiempo'        => $tiempo,
                'a'             => $a,
            ];
        }

        return [
            'row'   => $__row,
            'thead' => [
                'Cantidad',
                'Clasificación',
                'Nombre',
                'Tiempo',
                'Acciones'
            ],
            $getDish
        ];
    }

    function addDish(){

        $status  = 500;
        $message = 'Error al agregar platillos.';

        unset($_POST['id_sub_event']);


        // Insertar platillos
        $addDishes = $this -> createDish($this->util->sql($_POST));

        if ($addDishes == true) {

            $status  = 200;
        }

        return [
            'status'  => $status,
            'message' => $message,

            $_POST
        ];


    }

    function editDish(){
        $status = 500;
        $message = 'Error al editar platillo.';

        $dishes = [
            'quantity'         => $_POST['quantity'],
            'dish'             => $_POST['dish'],
            'tiempo'           => $_POST['tiempo'],
            'id_clasificacion' => $_POST['id_clasificacion'],
            'id'               => $_POST['id'],
        ];

        // Actualizar platillos
        $updatePlatillos = $this->updateDish($this->util->sql($dishes, 1));

        if ($updatePlatillos == true) {
            $status = 200;
            $message = 'Platillo editado correctamente. 👌';
        }

        return [
            'status' => $status,
            'message' => $message,
        ];
    }

    function removeDish(){
        $status = 500;
        $message = 'Error al eliminar platillo.';
        // Eliminar platillos
        $deletePlatillos = $this->deleteDish($this->util->sql($_POST, 1));
        if ($deletePlatillos == true) {
            $status = 200;
            $message = 'Platillo eliminado correctamente.';
        }

        return [
            'status' => $status,
            'message' => $message,
        ];
    }

    function getByIdDish(){

        $status = 500;
        $message = 'Error al obtener platillo.';
        $getDish = $this->getDishById([$_POST['id']]);

        if (count($getDish) > 0) {

            $status  = 200;
            $message = 'Platillo obtenido correctamente.';

        }

        return [

            'status'  => $status,
            'message' => $message,
            'data'    => $getDish
        ];

    }


    // Verdaderas funciones menu
     // MENU
    function getPackages(){

        $status = 500;
        $message = 'Error al obtener los menús precargados.';
        $subsidiary =  $_SESSION['SUB'] ? $_SESSION['SUB']:1;

        $dataRaw = $this->getMenus([$subsidiary]);

        $menus = [];

        $agrupados = [];
        foreach ($dataRaw as $row) {
            $idP = $row['package_id'];

            if (!isset($agrupados[$idP])) {
                $agrupados[$idP] = [
                    'id'               => $row['package_id'],
                    'idEvt'            => $row['idEvtPackage'],
                    'nombre'           => $row['package'],
                    'descripcion'      => $row['description'],
                    'precioPorPersona' => floatval($row['price_person']),
                    'platillos'        => [],
                    'bebidas'          => [],
                ];
            }

            $item = [
                'id' => $row['idPr'],
                'nombre' => $row['product'],
                'precio' => 0,
            ];

            if ($row['idC'] == 2) {
                $agrupados[$idP]['bebidas'][] = $item;
            } else {
                $agrupados[$idP]['platillos'][] = $item;
            }
        }

        foreach ($agrupados as $menu) {
            $menus[] = $menu;
        }

        return $menus;

        // return [
        //     'status' => 200,
        //     'message' => 'Menús cargados correctamente.',
        //     'data' => $menus,
        // ];
    }

    function getProducts(){
        $subsidiary =  $_SESSION['SUB'] ? $_SESSION['SUB']:1;

        $data = $this->getProductosExtras([$subsidiary]);

        $productos = array_map(function ($item) {
            return [
                'id' => $item['id'],
                'nombre' => $item['nombre'],
                'precio' => $item['precio'],
                'id_clasificacion' => $item['id_clasificacion'],
            ];
        }, $data);

        return $productos;

        // return [
        //     'status' => 200,
        //     'message' => 'Productos cargados correctamente.',
        //     'data' => $productos,
        // ];
    }

    function getClassifications(){

        $subsidiary = $_SESSION['SUB'] ? $_SESSION['SUB']:1;
        $data       = $this->getClasificaciones([$subsidiary]);

        $clasificaciones = array_map(function ($item) {
            return [
                'id' => $item['id'],
                'nombre' => $item['nombre'],
            ];
        }, $data);

        return $clasificaciones;

    }

    function addProduct() {
        $status = 500;
        $message = 'Error al agregar el producto personalizado.';


        $_POST['subsidiaries_id'] = $_SESSION['SUB']; // Asignar la sucursal actual
        $_POST['date_creation'] = date('Y-m-d H:i:s');



        $data = $this->util->sql([
            'name'              => $_POST['name'],
            'price'             => $_POST['price'],
            'id_classification' => $_POST['id_classification'],
            // 'subsidiaries_id'   => $_SESSION['SUB'],
            'date_creation'     => $_POST['date_creation']
        ]);

        // Insertar producto
        $create    = $this->createProduct($data);
        $idProduct = $this->maxProduct();

        $success = $this-> createSubEventPackage($this->util->sql([
            'product_id'    => $idProduct,
            'quantity'      => $_POST['quantity'],
            'price'         => $_POST['price'],
            'date_creation' => date('Y-m-d H:i:s'),
            'subevent_id'   => $_POST['subevent_id'],
        ]));

        // Actualizar total de Evento
        $idEvent = $_POST['evt_events_id'];



        if ($create == true) {

            $status  = 200;
            $message = 'Producto agregado correctamente. 👌';

            return [

                'status'  => $status,
                'message' => $message,
                'sub'     => $this->lsMenu(),

                'data' =>
                    [
                        'id' => $idProduct
                    ]
            ];
        }

        return [
            'status'  => $status,
            'message' => $message,

        ];
    }



    // Traer menus de un evento específico
    function getSubEventMenus(){
        $status = 500;
        $message = 'Error al obtener los menús relacionados a este evento.';
        $subevent_id = $_POST['subevent_id'];

        //Obtener paquetes relacionados al evento
        $paquetesRaw = $this->getSubEventPackage([$subevent_id]);
        $productosRaw = $this->getSubEventProduct([$subevent_id]);

        $menus = [];
        $extras = [];

        // Agrupar paquetes por id del paquete
        $agrupados = [];
        foreach ($paquetesRaw as $row) {
            $idP = $row['package_id'];

            if (!isset($agrupados[$idP])) {
                $agrupados[$idP] = [
                    'menu' => [
                        'id'               => $row['package_id'],
                        'idEvt'            => $row['idEvtPackage'],
                        'nombre'           => $row['package'],
                        'descripcion'      => $row['description'],
                        'precioPorPersona' => floatval($row['price_person']),
                        'platillos'        => [],
                        'bebidas'          => [],
                    ],
                    'cantidadPersonas' => intval($row['quantity']),
                ];
            }

            $platillo = [
                'id' => $row['idPr'],
                'nombre' => $row['product'],
                'precio' => floatval($row['priceProduct']),
            ];

            // Clasifica como bebida o platillo por el idC (id de clasificación)
            if ($row['idC'] == 2) {
                $agrupados[$idP]['menu']['bebidas'][] = $platillo;
            } else {
                $agrupados[$idP]['menu']['platillos'][] = $platillo;
            }
        }

        // Convertir a array de valores
        foreach ($agrupados as $item) {
            $menus[] = $item;
        }

        // Formatear productos individuales (extras)
        foreach ($productosRaw as $row) {
            $extras[] = [
                'id'               => $row['product_id'],
                'nombre'           => $row['nombre'],
                'idEvt'            => $row['idEvtPackage'],
                'precio'           => floatval($row['precioUnitario']),
                'cantidad'         => intval($row['quantity']),
                'id_clasificacion' => $row['id_clasificacion'],
                'custom'           => false,
            ];
        }

        // Calcular total de precios de menus (precioPorPersona * cantidadPersonas)
        $total_menus_precio = 0;
        foreach ($menus as $menu) {
            $total_menus_precio += $menu['menu']['precioPorPersona'] * $menu['cantidadPersonas'];
        }

        // Calcular total de precios de extras (precio * cantidad)
        $total_extras_precio = 0;
        foreach ($extras as $extra) {
            $total_extras_precio += $extra['precio'] * $extra['cantidad'];
        }

        $total_general_precio = $total_menus_precio + $total_extras_precio;

        $success =  $this-> updateSubEvento($this->util->sql([
            'total_pay' => $total_general_precio,
            'id'        => $subevent_id
        ],1));

        return [
            'status' => 200,
            'message' => 'Datos cargados correctamente.',
            'menus' => $menus,
            'extras' => $extras,
            'total' => $total_general_precio,
            $success
        ];
    }

    // Vincular menú con evento.
    function addSubEventMenus() {
        $status = 500;
        $message = 'Error al agregar menú.';
        $total = $_POST['total'];
        $menus = json_decode($_POST['menus'], true);
        $extras = json_decode($_POST['extras'], true);

        $success = false;

        // 📦 PAQUETES
        $dataPackage = [];
        foreach ($menus as $key) {
            if (!isset($key['menu']['precioPorPersona'], $key['cantidadPersonas'], $key['menu']['id'])) continue;

            $precio = $key['menu']['precioPorPersona'] * $key['cantidadPersonas'];
            $dataPackage[] = [
                'package_id'    => $key['menu']['id'],
                'quantity'      => $key['cantidadPersonas'],
                'price'         => $precio,
                'date_creation' => date('Y-m-d H:i:s'),
                'subevent_id'      => $_POST['id_subevent'],
            ];
        }

        if (!empty($dataPackage)) {
            $addEventPackage = $this->createEventPackage($this->util->sql($dataPackage));
            if ($addEventPackage === true) {
                $success = true;
            }
        }

        // 🧃 EXTRAS
        $dataProducts = [];
        foreach ($extras as $key) {
            if (!isset($key['precio'], $key['cantidad'], $key['id'])) continue;

            $precio = $key['precio'] * $key['cantidad'];
            $dataProducts[] = [
                'product_id'    => $key['id'],
                'quantity'      => $key['cantidad'],
                'price'         => $precio,
                'date_creation' => date('Y-m-d H:i:s'),
                'subevent_id'      => $_POST['id_subevent'],
            ];
        }

        if (!empty($dataProducts)) {
            $addEventExtras = $this->createEventPackage($this->util->sql($dataProducts));
            if ($addEventExtras === true) {
                $success = true;
            }
        }

        // 💰 Actualizar total
        // $this->updateSubEvent($this->util->sql([
        //     'total_pay' => $total,
        //     'id'        => $_POST['id_subevent'],
        // ], 1));

        // ✅ Mensaje único de éxito
        if ($success) {
            $status = 200;
            $message = 'Menú(s) y/o extra(s) agregados correctamente. 🍽️✨';
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
    }

    // Editar menú de evento
    function editSubEventMenus()
    {
        $status = 500;
        $message = 'Error al editar menú.';
        $total = $_POST['total'];
        $menus = json_decode($_POST['menus'], true);
        $extras = json_decode($_POST['extras'], true);
        $success = false;


        // Eliminar total
        $this->deleteSubEventPackage($this->util->sql([
            'subevent_id'  => $_POST['id_subevent'],
        ], 1));


        // 📦 PAQUETES
        $dataPackage = [];
        foreach ($menus as $key) {
            if (!isset($key['menu']['precioPorPersona'], $key['cantidadPersonas'], $key['menu']['id'])) continue;

            $precio = $key['menu']['precioPorPersona'] * $key['cantidadPersonas'];
            $dataPackage[] = [
                'package_id'    => $key['menu']['id'],
                'quantity'      => $key['cantidadPersonas'],
                'price'         => $precio,
                'date_creation' => date('Y-m-d H:i:s'),
                'subevent_id'      => $_POST['id_subevent'],
            ];
        }

        if (!empty($dataPackage)) {
            $addEventPackage = $this->createSubEventPackage($this->util->sql($dataPackage));
            if ($addEventPackage == true) {
                $success = true;
            }
        }

        // 🧃 EXTRAS
        $dataProducts = [];
        foreach ($extras as $key) {
            if (!isset($key['precio'], $key['cantidad'], $key['id'])) continue;

            $precio = $key['precio'] * $key['cantidad'];
            $dataProducts[] = [
                'product_id'    => $key['id'],
                'quantity'      => $key['cantidad'],
                'price'         => $precio,
                'date_creation' => date('Y-m-d H:i:s'),
                'subevent_id'      => $_POST['id_subevent'],
            ];
        }

        if (!empty($dataProducts)) {
            $addEventExtras = $this->createSubEventPackage($this->util->sql($dataProducts));
            if ($addEventExtras === true) {
                $success = true;
            }
        }

        // // 💰 Actualizar total
        // $this->updateSubEvent($this->util->sql([
        //     'total_pay' => $total,
        //     'id'        => $_POST['id_event'],
        // ], 1));

        // ✅ Mensaje único de éxito
        if ($success) {
            $status = 200;
            $message = 'Menú(s) y/o extra(s) agregados correctamente. 🍽️✨';
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
    }




}

// Complements.
function formatDateTime($date, $time) {
    if (!empty($date) && !empty($time)) {
        $datetime = DateTime::createFromFormat('Y-m-d H:i', "$date $time");
        return $datetime ? $datetime->format('Y-m-d H:i:s') : null;
    }
    return null;
}



$obj    = new ctrl();
$fn     = $_POST['opc'];
$encode = $obj->$fn();
echo json_encode($encode);
?>
