<?php
session_start();
if (empty($_POST['opc'])) exit(0);

header("Access-Control-Allow-Origin: *"); // Permite solicitudes de cualquier origen
header("Access-Control-Allow-Methods: GET, POST, OPTIONS"); // Métodos permitidos
header("Access-Control-Allow-Headers: Content-Type"); // Encabezados permitidos

require_once '../mdl/mdl-pedidos.php';

class Pedidos extends MPedidos{

    function init(){
        $subsidiaries = $this->lsSubsidiaries();
        $dailyClosure = $this->checkDailyClosure();

        // Verificar turno abierto para la sucursal del usuario
        $sub_id = $_SESSION['SUB'];
        $openShift = $this->getOpenShiftBySubsidiary([$sub_id]);

        return [
            'modifier'          => $this->getAllModifiers([1]),
            'products'          => $this->lsProductos([1,$_SESSION['SUB']]),
            'clients'           => $this->getAllClients([$_SESSION['SUB']]),
            'status'            => $this->lsStatus(),
            'sucursales'        => $subsidiaries['data'],
            'access'            => $_SESSION['ROLID'],
            'subsidiaries_name' => $_SESSION['SUBSIDIARIE_NAME'],
            'daily_closure'     => $dailyClosure,
            'open_shift'        => $openShift ? [
                'has_open_shift' => true,
                'shift_id'       => $openShift['id'],
                'opened_at'      => $openShift['opened_at'],
                'shift_name'     => $openShift['shift_name'],
                'employee_name'  => $openShift['employee_name']
            ] : ['has_open_shift' => false]
        ];
    }

    function checkDailyClosure() {
        $subsidiaries_id = isset($_POST['subsidiaries_id']) && $_POST['subsidiaries_id'] != '0' 
            ? $_POST['subsidiaries_id'] 
            : $_SESSION['SUB'];
        
        $today = date('Y-m-d');
        $closure = $this->getDailyClosureByDate([$today, $subsidiaries_id]);
        
        return [
            'is_closed'      => !empty($closure),
            'closure_id'     => $closure['id'] ?? null,
            'closed_by'      => $closure['closed_by_name'] ?? null,
            'closed_at'      => $closure['created_at'] ?? null,
            'subsidiary_id'  => $subsidiaries_id
        ];
    }


    function lsSubsidiaries(){

        $status  = 500;
        $message = 'Error al obtener las sucursales';
        $data    = [];

        // Solo permitir si el rol es 1 (admin)

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

    function getProductsOrder() {
        $status  = 404;
        $message = 'Error al obtener los productos de la orden';
        $data    = null;

        $get = $this->getOrderById([$_POST['order_id']]);

        // Validar que get sea un array válido
        if (is_array($get) && !empty($get)) {
            $status  = 200;
            $message = 'Datos obtenidos correctamente';
            $data    = $get;
        }

        return [
            'status'  => $status,
            'message' => $message,
            'data'    => $data
        ];
    }

    // Order.
    public function listOrders() {
        $rows = [];
        
        // Validar variables de sesión con valores por defecto
        $rolId      = $_SESSION['ROLID'] ;
        $sessionSub = $_SESSION['SUB'];
        
        // Si es admin (rol 1), usar la sucursal del POST, sino usar la de sesión
        if ($rolId == 1) {
            // Validar que subsidiaries_id exista y no sea vacío
            $subsidiaries_id = $_POST['subsidiaries_id'];
        } else {
            $subsidiaries_id = $sessionSub;
        }
      
        $orders   = $this->getOrders([

            'fi'              => $_POST['fi'] ?? '',
            'ff'              => $_POST['ff'] ?? '',
            'status'          => $_POST['status'],
            'subsidiaries_id' => $subsidiaries_id

        ]);

        foreach ($orders as $order) {

            $advanceExtra = 0;
            $discount     = $order['discount'] ?? 0;
            $total        = $order['total_pay'] ?? 0;
            $totalPagado  = $this->getTotalPaidByOrder([$order['id']]);

            $totalGral     = $total - $discount;
            $saldo         = $total - $discount - $totalPagado;
            $hasDiscount   = $discount > 0;

            $Sucursal = $this->getSucursalByID([$order['subsidiaries_id']]);
            if (!$Sucursal) $Sucursal = ['name' => '', 'sucursal' => ''];

            $htmlTotal = $hasDiscount
                ? "<div class='text-end'>
                        <p title='Con descuento aplicado' class='text-green-400 cursor-pointer font-semibold'>" . evaluar($totalGral) . "</p>
                        <p class='line-through text-gray-500 text-[10px]'>".evaluar($total) ."</p>
                        <p class='text-gray-500 text-[10px]'><i class='icon-tag'></i> Descuento: " . evaluar($discount) . "</p>
                    </div>"
                : number_format($total, 2);


            $Folio   = formatSucursal($Sucursal['name'], $Sucursal['sucursal'], $order['id']);


            // list.

            $rows[] = [
                'id'       => $order['id'],
                'folio'    => $Folio,
                'Creación' => formatSpanishDate($order['date_creation']),

                'Cliente' => [
                    'html' => "
                        <p class='text-gray-300'>{$order['name_client']}</p>
                        <p class='text-gray-500'><i class='icon-phone'></i> {$order['phone']}</p>
                    "
                ],
                'Abono' => [
                    'html' =>  evaluar($totalPagado),
                    'class' => "text-[#3FC189] text-end bg-[#283341]"
                ],

                'Total' => [
                    'html'  => $htmlTotal,
                    'class' => "text-end bg-[#283341]"
                ],

                'Saldo' => [
                    'html' => evaluar($saldo),
                    'class' => "text-[#E05562] text-end bg-[#283341]"
                ],

                'Fecha de entrega' => formatSpanishDate($order['date_order']),
                'Hora de entrega'  => $order['time_order'],
                'Estado'           => status($order['idStatus']),
                
             
                
                'Entregado' => [
                    'html' => renderDeliveryStatus(array_merge($order, ['folio' => $Folio])),
                    'class' => 'text-center'
                ],

                'Tipo' => [
                    'html' => renderDeliveryType($order['delivery_type']),
                    'class' => 'text-center'
                ],
                
                'dropdown'        => dropdownOrder($order['id'], $order['idStatus'], floatval($order['discount'] ?? 0)),
            ];
        }

        return [
            'row'    => $rows,
            'orders' => $orders,
         $subsidiaries_id
        ];

    }

    public function addOrder(){

        $client = $this->getClientName([$_POST['name']]);
        $folio = null;

        if ($_SESSION['ROLID'] == 1) {
            $subsidiaries_id = $_POST['subsidiaries_id'] ;
        }else{
            $subsidiaries_id = $_SESSION['SUB'];
        }

        if (!is_array($client) || empty($client['id'])) {
            $data_client = $this->util->sql([
                'name'            => $_POST['name'],
                'phone'           => $_POST['phone'],
                'email'           => $_POST['mail'],
                'date_create'     => date('Y-m-d H:i:s'),
                'subsidiaries_id' => $subsidiaries_id ,
                'active'          => 1,
            ]);

            $this->createClient($data_client);

            $client = $this->getClientName([$_POST['name']]);
            
            // Validar que el cliente se haya creado correctamente
            if (!is_array($client) || empty($client['id'])) {
                return [
                    'status'  => 500,
                    'message' => 'Error al crear o encontrar el cliente.',
                ];
            }

        }

       

        $data = $this->util->sql([
            'note'            => $_POST['note'],
            'date_birthday'   => $_POST['date_birthday'],
            'date_order'      => $_POST['date_order'],
            'time_order'      => $_POST['time_order'],
            'delivery_type'   => $_POST['delivery_type'],
            'date_creation'   => date('Y-m-d H:i:s'),
            'client_id'       => $client['id'],
            'status'          => 1,
            'type_id'         => 1,
            'subsidiaries_id' => $subsidiaries_id ,

        ]);

        $insert = $this->createOrder($data);


        if ($insert) {

            $folio  = $this->getMaxOrder();

            return [
                'status'  => 200,
                'message' => 'Pedido registrado correctamente.',
                'sub' =>  $subsidiaries_id,
                'data'    => $insert,
                 'id'      => $folio['id'],
                 'client'  => $client
            ];
        }

        return [

            'status'  => 500,
            'message' => 'Error al registrar el pedido.',
            'data'    => $folio['id'],
           
        ];
    }

    function getOrder() {
        $status  = 500;
        $message = 'Error al obtener el pedido';
        $data    = null;

        $get = $this->getOrderID([$_POST['id']]);
        
        if ($get) {
            $status  = 200;
            $message = 'Datos obtenidos correctamente';
            $data    = $get;
        }

        return [
            'status'  => $status,
            'message' => $message,
            'data'    => $data[0]
        ];
    }

    function editOrder() {
        $status  = 500;
        $message = 'No se pudo actualizar el pedido';
        $statusQuery = false;

        if ($_SESSION['ROLID'] == 1) {
            $subsidiaries_id = $_POST['subsidiaries_id'];
        } else {
            $subsidiaries_id = $_SESSION['SUB'];
        }

        // Buscar si existe un cliente con el nombre proporcionado
        $client = $this->getClientName([$_POST['name']]);
        $client_id = null;

        if (!is_array($client) || empty($client['id'])) {
            // El cliente no existe, crear uno nuevo
            $data_client = $this->util->sql([
                'name'            => $_POST['name'],
                'phone'           => $_POST['phone'],
                'email'           => $_POST['email'] ?? '',
                'date_create'     => date('Y-m-d H:i:s'),
                'subsidiaries_id' => $subsidiaries_id,
                'active'          => 1,
            ]);

            $this->createClient($data_client);
            $client = $this->getClientName([$_POST['name']]);
            
            if (!is_array($client) || empty($client['id'])) {
                return [
                    'status'  => 500,
                    'message' => 'Error al crear el cliente.',
                ];
            }
            
            $client_id = $client['id'];
        } else {
            // El cliente existe, actualizar sus datos
            $client_id = $client['id'];
            
            $update = $this->updateClient($this->util->sql([
                'name'  => $_POST['name'],
                'phone' => $_POST['phone'],
                'email' => $_POST['email'] ?? '',
                'id'    => $client_id
            ], 1));

            $statusQuery = ['update' => $update];
        }

        // Actualizar el pedido con el client_id (nuevo o existente)
        $update = $this->updateOrder($this->util->sql([
            'date_order'      => $_POST['date_order'],
            'time_order'      => $_POST['time_order'],
            'note'            => $_POST['note'],
            'delivery_type'   => $_POST['delivery_type'],
            'subsidiaries_id' => $subsidiaries_id,
            'client_id'       => $client_id,
            'id'              => $_POST['id'],
        ], 1));

        if ($update) {
            $status  = 200;
            $message = 'Pedido actualizado correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message,
            'clients' => $statusQuery
        ];
    }

    function cancelOrder(){
        $status  = 500;
        $message = 'Error al cancelar el evento.';

        $update = $this->updateOrder($this->util->sql($_POST, 1));

        if ($update) {
            $status  = 200;
            $message = 'Evento cancelado correctamente.';
        }

        return [
            'status'  => $status,
            'message' => $message,
        ];
    }

    function getOrderDetails() {

        $status  = 500;
        $message = 'Error al obtener detalles del pedido';
        $data    = null;
        $SUB     = $_SESSION['SUB'] ;

        $orderId = $_POST['id'];
        
        // Obtener información básica del pedido
        $order = $this->getOrderID([$orderId]);
        
        if ($order) {
            $order[0]['logo'] = $_SESSION['LOGO'];
            $subsidiaries_id    = $order[0]['subsidiaries_id'];
            $orderData = $order[0];
            
            // Obtener sucursal para el folio
            $sucursal = $this->getSucursalByID([$subsidiaries_id]);
            $folio = formatSucursal($sucursal['name'], $sucursal['sucursal'], $orderData['id']);
            
            // Calcular totales
            $totalPagado = $this->getTotalPaidByOrder([$orderId]);
            $discount    = $orderData['discount'] ?? 0;
            $total       = $orderData['total_pay'] ?? 0;
            $saldo       = $total - $discount - $totalPagado;



            $products =[];
            
            // Obtener productos del pedido (si existen tablas relacionadas)
            $products = $this->getOrderById([$orderId]);
            // Validar que products sea un array válido
            if ($products === null) {
                $products = ['data' => ''];
            }
            
            // Obtener métodos de pago del pedido
            $paymentMethods = $this->getMethodPayment([$orderId]);
            if ($paymentMethods === null || !is_array($paymentMethods)) {
                $paymentMethods = [];
            }
            
            $data = [
                
                'order' => array_merge($orderData, [
                    'folio'                   => $folio,
                    'total_paid'              => $totalPagado,
                    'balance'                 => $saldo,
                    'formatted_date_order'    => $orderData['date_order'],
                    'formatted_date_creation' => $orderData['date_creation'],
                    'subsidiarie_name'        => $sucursal['sucursal']
                ]),

                'products'       => $products,
                'paymentMethods' => $paymentMethods,
                'clausules'      => $this->listClausules([1, $_SESSION['COM']]),

                'summary' => [
                    'total'    => $total,
                    'paid'     => $totalPagado,
                    'discount' => $discount,
                    'balance'  => $saldo
                ]
            ];
            
            $status = 200;
            $message = 'Detalles obtenidos correctamente';
        }

        return [
            'status' => $status,
            'message' =>  $message ,
            'data' => $data,
            'order'=> $order ,
            
        ];
    }


    // Payments.
    function addPayment() {

        $status  = 500;
        $message = 'No se pudo registrar el pago';

        $id         = $_POST['id'];
        $pay        = floatval($_POST['advanced_pay']);
        $total_pay  = floatval($_POST['total']);
        $saldo      = floatval($_POST['saldo']);

        // 🧠 Lógica corregida:
        if ($pay <= 0) {
            $type_id = 1; // Cotización sin abono
        } else if ($pay ==  $saldo) {
            $type_id = 3; // Pago completo
        } else {
            $type_id = 2; // Abono parcial
        }

        // Agregar registro de pago. 

        if ($pay > 0) {
            $values_pay = [
                'pay'           => $pay,
                'date_pay'      => date('Y-m-d H:i:s'),
                'type'          => 2,
                'method_pay_id' => $_POST['method_pay_id'],
                'description'   => $_POST['description'],
                'order_id'      => $id,
            ];

            $addPay = $this->addMethodPay($this->util->sql($values_pay));
        }

        // Actualizar id de formato.
        $values = $this->util->sql([
            'total_pay'     => $total_pay,
            'type_id'       => $type_id,
            'status'        => $type_id,
            
            'date_creation' => date('Y-m-d'),
            'id'            => $id

          ], 1);

        $insert = $this->registerPayment($values);
        
        if ($addPay) {
            $status  = 200;
            $message = 'Pago registrado correctamente';
            
          $success =  $this->logHistory("Se registró un pago de " . evaluar($pay), 'payment');
        }

        return [
            'status'  => $status,
            'message' => $message,
            'data'    => $this->initHistoryPay(),
            'success' => $success,
            'insert'  => ['ok'=>$insert, 'data' => $values]
         
        ];
    }

    function initHistoryPay(){
          // Obtener sucursal para el folio
        $SUB      = $_SESSION['SUB'] ?? 4;
        $sucursal = $this->getSucursalByID([$SUB]);
      

        $ls                  = $this->getOrderID([$_POST['id']]);
        $methods             = $this-> getMethodPayment([$_POST['id']]);
        $ls[0]['total_paid'] = array_sum(array_column($methods, 'pay'));

         $folio    = formatSucursal($sucursal['name'], $sucursal['sucursal'], $ls[0]['folio']);
        $ls[0]['folio']      = $folio;

        $PaymentsDetails     = 0;
        $discount            = $ls[0]['discount'] ?? 0;

        return [
            'order'  => $ls[0],
            'details' => [
                'pagado'   => $ls[0]['total_paid'],
                'total'    => $ls[0]['total_pay'],
                'discount' => $discount,
                'restante' => $ls[0]['total_pay'] - $discount - $ls[0]['total_paid'],
            ]
        ];
    }

    function deletePay() {
        
        $values = $this->util->sql([
            'id' => $_POST['idPay']
        ], 1);

        $delete = $this->deletePayment($values);

          // histories.
        $amount  = evaluar($_POST['amount']);
        $success = $this->logHistory("Se eliminó un pago de {$amount}", 'payment', 'Eliminar');





        return [
            'status'         => $delete ? 200 : 400,
            'message'        => $delete ? "Pago eliminado correctamente." : "No se pudo eliminar el pago.",
            'initHistoryPay' => $this->initHistoryPay(),
        ];
    }

    function getPayment(){

         $ls      = $this->getOrderID([$_POST['id']]);
         $methods = $this-> getMethodPayment([$_POST['id']]);

        //  sumar todos los productos.

        

         return [
            'order'    => $ls[0],
            'total_paid'  => array_sum(array_column($methods, 'pay'))
         ];

    }

    function listPayment() {
        $data  = $this->getListPayment([$_POST['id']]);
        $__row = [];

        foreach ($data as $key) {
            $icono = '<i class="icon-credit-card"></i>';

            if ($key['method_pay'] == 'Efectivo') {
                $icono = '<i class="icon-money"></i>';
            } elseif ($key['method_pay'] == 'Transferencia') {
                $icono = '<i class="icon-exchange"></i>';
            }

            $a = [];

            if ($_SESSION['ROLID'] == 1) {
                $a[] = [
                    'class'   => 'pointer text-red-200 hover:text-red-900 p-2',
                    'html'    => '<i class="icon-trash"></i>',
                    'onClick' => "app.deletePay({$key['id']},{$_POST['id']})"
                ];
            }else{
                $a[] = [
                    'class' =>''
                ];
            }

            $__row[] = [
                'id'            => $key['id'],
                'Fecha de Pago' => [
                    'html' => '<i class="icon-calendar-2"></i> ' . formatSpanishDate($key['date_pay']),
                ],
                'Método' => [
                    'html' => $icono . ' ' . $key['method_pay'],
                ],
                'Monto' => [
                    'html' => '$ ' . number_format($key['pay'], 2),
                ],

                'Observación' =>  $key['description'],

                
                'a' => $a
            ];
        }

        return [
            'row' => $__row,
            $data
        ];
    }

    // Clients.
    function getListClients() {
        $status  = 500;
        $message = 'Error al obtener los clientes';
        $data    = [];

        $clients = $this->getAllClients([$_SESSION['SUB']]);
        
        if ($clients) {
            $status  = 200;
            $message = 'Clientes obtenidos correctamente';
            $data    = $clients;
        }

        return [
            'status'  => $status,
            'message' => $message,
            'data'    => $data
        ];
    }




    // History

    function getHistory(){
        $status  = 200;
        $message = 'Historial obtenido correctamente';
        $history = $this->listHistories([$_POST['id']]);

        return [
            'status'  => $status,
            'message' => $message,
            'history' => $history
        ];
    }

    function addHistory(){
        $status  = 500;
        $message = 'Error al agregar el comentario';

        $_POST['date_action']   = date('Y-m-d H:i:s');
        // $_POST['usr_users_id']  = $_SESSION['ID'];
      

        $data = $this->util->sql($_POST);
        $add  = $this->addHistories($data);

        if ($add) {
            $status  = 200;
            $message = 'Comentario agregado correctamente';
        }

        $history = $this->listHistories([$_POST['order_id']]);

        return [
            'status'  => $status,
            'message' => $message,
            'history' => $history,
            'data'    => $data
        ];
    }


    // Estos son los modificadores
    function getModifiers() {
        $status  = 404;
        $message = 'No se encontraron datos';
        $data    = [];

        $list = $this->getAllModifiers([1]); //activos

        if (!empty($list)) {
            foreach ($list as $row) {
                $options = [];

                $modifierProducts = $this->lsModifierByID([$row['id']]) ?: [];
                foreach ($modifierProducts as $mod) {
                    $price = isset($mod['price']) ? $mod['price'] : 0.0;
                    $options[] = [
                        'id'             => $mod['id'],
                        'name'           => $mod['name'],
                        'price'          => $price,
                    ];
                }

                $data[] = [
                    'id'      => $row['id'],
                    'name'    => $row['text'],
                    'isExtra' => $row['isExtra'],
                    'options' => $options,
                ];
            }

            $status  = 200;
            $message = 'Datos obtenidos correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message,
            'data'    => $data,
        ];
    }


    // Dashboard Metrics
    function getDashboardMetrics() {
        $status = 500;
        $message = 'Error al obtener métricas del dashboard';
        $data = null;

        try {
            $month = $_POST['month'] ?? date('n');
            $year = $_POST['year'] ?? date('Y');
            $subsidiariesId = $_SESSION['SUB'] ?? 1;

            // Get total orders for the month
            $totalOrders = $this->getOrdersByMonth([$month, $year, $subsidiariesId]);
            
            // Get completed sales (status = 3)
            $completedSales = $this->getCompletedSales([$month, $year, $subsidiariesId]);
            
            // Get pending sales (status = 1 or 2)
            $pendingSales = $this->getPendingSales([$month, $year, $subsidiariesId]);
            
            // Get chart data for the month
            $chartData = $this->getOrdersChartData([$month, $year, $subsidiariesId]);

            // Get previous month data for trends
            $prevMonth = $month == 1 ? 12 : $month - 1;
            $prevYear = $month == 1 ? $year - 1 : $year;
            
            $prevTotalOrders = $this->getOrdersByMonth([$prevMonth, $prevYear, $subsidiariesId]);
            $prevCompletedSales = $this->getCompletedSales([$prevMonth, $prevYear, $subsidiariesId]);
            $prevPendingSales = $this->getPendingSales([$prevMonth, $prevYear, $subsidiariesId]);

            $data = [
                'totalOrders' => count($totalOrders),
                'completedSales' => [
                    'count' => $completedSales['count'] ?? 0,
                    'amount' => $completedSales['amount'] ?? 0
                ],
                'pendingSales' => [
                    'count' => $pendingSales['count'] ?? 0,
                    'amount' => $pendingSales['amount'] ?? 0
                ],
                'chartData' => $chartData,
                'previousTotalOrders' => count($prevTotalOrders),
                'previousCompletedSales' => [
                    'count' => $prevCompletedSales['count'] ?? 0,
                    'amount' => $prevCompletedSales['amount'] ?? 0
                ],
                'previousPendingSales' => [
                    'count' => $prevPendingSales['count'] ?? 0,
                    'amount' => $prevPendingSales['amount'] ?? 0
                ]
            ];

            $status = 200;
            $message = 'Métricas obtenidas correctamente';

        } catch (Exception $e) {
            $message = 'Error interno del servidor: ' . $e->getMessage();
        }

        return [
            'status' => $status,
            'message' => $message,
            'data' => $data
        ];
    }

    function reportVentas() {
        $sucursal = $_POST['sucursal'] ?? 'all';
        $fechaInicio = $_POST['fechaInicio'] ?? date('Y-m-01');
        $fechaFin = $_POST['fechaFin'] ?? date('Y-m-t');

        $params = [
            'sucursal' => $sucursal,
            'fechaInicio' => $fechaInicio,
            'fechaFin' => $fechaFin
        ];

        $orders = $this->getOrdersByDateRange($params);
        
        $totalPedidos = count($orders);
        $ventasTotales = 0;
        $pendienteCobrar = 0;
        $chartData = [0, 0, 0, 0];
        $details = [];

        if ($totalPedidos > 0) {
            foreach ($orders as $order) {
                $total = floatval($order['total_pay'] - ($order['discount'] ?? 0));
                $pagado = floatval($this->getTotalPaidByOrder([$order['id']]));
                
                $ventasTotales += $total;
                $pendienteCobrar += ($total - $pagado);
                
                $statusIndex = intval($order['status']) - 1;
                if ($statusIndex >= 0 && $statusIndex < 4) {
                    $chartData[$statusIndex]++;
                }
                
                $details[] = [
                    'Folio' => $order['folio'],
                    'Cliente' => $order['client_name'],
                    'Fecha' => formatSpanishDate($order['date_creation']),
                    'Total' => evaluar($total),
                    'Estado' => status($order['status'])
                ];
            }
        } else {
            $chartData = [10, 5, 15, 2];
            $details = [
                ['Folio' => 'P-HT-01', 'Cliente' => 'Cliente Demo', 'Fecha' => '15 Octubre 2025', 'Total' => '$1,500.00', 'Estado' => status(3)],
                ['Folio' => 'P-HT-02', 'Cliente' => 'Cliente Demo 2', 'Fecha' => '14 Octubre 2025', 'Total' => '$2,300.00', 'Estado' => status(2)],
            ];
            $totalPedidos = 32;
            $ventasTotales = 45000;
            $pendienteCobrar = 5000;
        }

        $ticketPromedio = $totalPedidos > 0 ? $ventasTotales / $totalPedidos : 0;

        return [
            'summary' => [
                'totalPedidos' => $totalPedidos,
                'ventasTotales' => evaluar($ventasTotales),
                'ticketPromedio' => evaluar($ticketPromedio),
                'pendienteCobrar' => evaluar($pendienteCobrar)
            ],
            'chartData' => $chartData,
            'details' => $details
        ];
    }

    function reportProductos() {
        $sucursal    = $_POST['sucursal'] ?? 'all';
        $fechaInicio = $_POST['fechaInicio'] ?? date('Y-m-01');
        $fechaFin    = $_POST['fechaFin'] ?? date('Y-m-t');

        $params = [
            'sucursal' => $sucursal,
            'fechaInicio' => $fechaInicio,
            'fechaFin' => $fechaFin,
            'limit' => 100
        ];

        $productos = $this->getProductSalesByDateRange($params);
        
        $topProductos = [];
        $allProductos = [];

        if (is_array($productos) && count($productos) > 0) {
            foreach ($productos as $index => $producto) {
                $data = [
                    '#' => $index + 1,
                    'name' => $producto['name'],
                    'quantity' => intval($producto['quantity']),
                    'total' => evaluar(floatval($producto['total'] ?? 0))
                ];
                
                if ($index < 10) {
                    $topProductos[] = $data;
                }
                
                $allProductos[] = [
                    '#' => $index + 1,
                    'Producto' => $producto['name'],
                    'Cantidad' => intval($producto['quantity']),
                    'Total Ventas' => evaluar(floatval($producto['total'] ?? 0))
                ];
            }
        } 

        return [
            'topProductos' => $topProductos,
            'allProductos' => $allProductos
        ];
    }

    function reportClientes() {
        $sucursal = $_POST['sucursal'] ?? 'all';
        $fechaInicio = $_POST['fechaInicio'] ?? date('Y-m-01');
        $fechaFin = $_POST['fechaFin'] ?? date('Y-m-t');

        $params = [
            'sucursal' => $sucursal,
            'fechaInicio' => $fechaInicio,
            'fechaFin' => $fechaFin,
            'limit' => 100
        ];

        $clientes = $this->getClientPurchasesByDateRange($params);
        
        $totalClientes = is_array($clientes) ? count($clientes) : 0;
        $clientesNuevos = 0;
        $clientesFrecuentes = 0;
        $topClientes = [];
        $allClientes = [];

        if ($totalClientes > 0) {
            foreach ($clientes as $index => $cliente) {
                $purchases = intval($cliente['purchases']);
                
                if ($purchases >= 3) {
                    $clientesFrecuentes++;
                } else if ($purchases == 1) {
                    $clientesNuevos++;
                }
                
                $data = [
                    '#' => $index + 1,
                    'name' => $cliente['name'],
                    'purchases' => $purchases,
                    'total' => evaluar(floatval($cliente['total'] ?? 0))
                ];
                
                if ($index < 10) {
                    $topClientes[] = $data;
                }
                
                $allClientes[] = [
                    '#' => $index + 1,
                    'Cliente' => $cliente['name'],
                    'Teléfono' => $cliente['phone'] ?? 'N/A',
                    'Compras' => $purchases,
                    'Total Gastado' => evaluar(floatval($cliente['total'] ?? 0))
                ];
            }
        } else {
            $totalClientes = 45;
            $clientesNuevos = 12;
            $clientesFrecuentes = 18;
            $topClientes = [
                ['#' => 1, 'name' => 'María González', 'purchases' => 24, 'total' => '$45,890.00'],
                ['#' => 2, 'name' => 'Juan Pérez', 'purchases' => 21, 'total' => '$38,750.00'],
                ['#' => 3, 'name' => 'Ana Martínez', 'purchases' => 19, 'total' => '$34,200.00'],
                ['#' => 4, 'name' => 'Carlos Rodríguez', 'purchases' => 17, 'total' => '$31,450.00'],
                ['#' => 5, 'name' => 'Laura Sánchez', 'purchases' => 16, 'total' => '$29,800.00'],
            ];
            $allClientes = $topClientes;
        }

        return [
            'summary' => [
                'totalClientes' => $totalClientes,
                'clientesNuevos' => $clientesNuevos,
                'clientesFrecuentes' => $clientesFrecuentes
            ],
            'topClientes' => $topClientes,
            'allClientes' => $allClientes
        ];
    }

    function apiDashboard() {
        $sucursal = $_POST['sucursal'] ?? $_SESSION['SUB'];
        $mes1 = intval($_POST['mes1'] ?? date('n'));
        $anio1 = intval($_POST['anio1'] ?? date('Y'));
        $mes2 = intval($_POST['mes2'] ?? date('n'));
        $anio2 = intval($_POST['anio2'] ?? date('Y') - 1);

        $params1 = [
            'mes' => $mes1,
            'anio' => $anio1,
            'subsidiariesId' => $sucursal
        ];

        $params2 = [
            'mes' => $mes2,
            'anio' => $anio2,
            'subsidiariesId' => $sucursal
        ];

        $metrics1 = $this->getOrdersDashboard($params1);
        $ordersByStatus1 = $this->getOrdersByStatus($params1);
        $ordersByStatus2 = $this->getOrdersByStatus($params2);
        $ordersByDay1 = $this->getOrdersByDay($params1);
        $ordersByDay2 = $this->getOrdersByDay($params2);
        $ordersByWeekday1 = $this->getOrdersByWeekday($params1);
        $ordersByWeekday2 = $this->getOrdersByWeekday($params2);

        $cotizaciones = 0;
        $abonados = 0;
        $pagados = 0;
        $cancelados = 0;
        $totalVentas = 0;
        $totalIngresos = 0;

        foreach ($ordersByStatus1 as $status) {
            switch ($status['status']) {
                case 1:
                    $cotizaciones = $status['count'];
                    break;
                case 2:
                    $abonados = $status['count'];
                    $totalIngresos += $status['total'];
                    break;
                case 3:
                    $pagados = $status['count'];
                    $totalVentas += $status['total'];
                    $totalIngresos += $status['total'];
                    break;
                case 4:
                    $cancelados = $status['count'];
                    break;
            }
        }

        $pendienteCobrar = $totalVentas - $totalIngresos;

        $dashboard = [
            'cotizaciones'    => $cotizaciones,
            'ventasTotales'   => evaluar($totalVentas),
            'ingresos'        => evaluar($totalIngresos),
            'pendienteCobrar' => evaluar($pendienteCobrar),
        ];

        $statusCounts1 = [0, 0, 0, 0];
        $statusCounts2 = [0, 0, 0, 0];

        foreach ($ordersByStatus1 as $status) {
            $statusCounts1[$status['status'] - 1] = $status['count'];
        }

        foreach ($ordersByStatus2 as $status) {
            $statusCounts2[$status['status'] - 1] = $status['count'];
        }

        $barras = [
            'dataset' => [
                'labels' => ['Cotizaciones', 'Abonados', 'Pagados', 'Cancelados'],
                'A' => $statusCounts1,
                'B' => $statusCounts2
            ],
            'anioA' => $anio1,
            'anioB' => $anio2
        ];

        $labels = [];
        $tooltip = [];
        $data1 = [];
        $data2 = [];

        foreach ($ordersByDay1 as $day) {
            $labels[] = date('d', strtotime($day['fecha']));
            $tooltip[] = date('d M Y', strtotime($day['fecha']));
            $data1[] = floatval($day['total']);
        }

        $data2Map = [];
        foreach ($ordersByDay2 as $day) {
            $dayNum = date('d', strtotime($day['fecha']));
            $data2Map[$dayNum] = floatval($day['total']);
        }

        foreach ($labels as $label) {
            $data2[] = $data2Map[$label] ?? 0;
        }

        $linear = [
            'labels' => $labels,
            'tooltip' => $tooltip,
            'datasets' => [
                [
                    'label' => "Período $mes1/$anio1",
                    'data' => $data1,
                    'borderColor' => '#103B60',
                    'backgroundColor' => 'rgba(16, 59, 96, 0.1)',
                    'tension' => 0.4
                ],
                [
                    'label' => "Período $mes2/$anio2",
                    'data' => $data2,
                    'borderColor' => '#8CC63F',
                    'backgroundColor' => 'rgba(140, 198, 63, 0.1)',
                    'tension' => 0.4
                ]
            ]
        ];

        $weekdayLabels = [];
        $weekdayData1 = [];
        $weekdayData2 = [];

        $weekdayMap1 = [];
        foreach ($ordersByWeekday1 as $day) {
            $weekdayMap1[$day['dia']] = floatval($day['total']);
        }

        $weekdayMap2 = [];
        foreach ($ordersByWeekday2 as $day) {
            $weekdayMap2[$day['dia']] = floatval($day['total']);
        }

        $daysOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
        $daysSpanish = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

        foreach ($daysOrder as $index => $day) {
            $weekdayLabels[] = $daysSpanish[$index];
            $weekdayData1[] = $weekdayMap1[$day] ?? 0;
            $weekdayData2[] = $weekdayMap2[$day] ?? 0;
        }

        $barDays = [
            'labels' => $weekdayLabels,
            'dataA' => $weekdayData1,
            'dataB' => $weekdayData2,
            'yearA' => $anio2,
            'yearB' => $anio1
        ];

        $daysTranslation = [
            'Monday' => 'Lunes',
            'Tuesday' => 'Martes',
            'Wednesday' => 'Miércoles',
            'Thursday' => 'Jueves',
            'Friday' => 'Viernes',
            'Saturday' => 'Sábado',
            'Sunday' => 'Domingo'
        ];

        $topWeek = [];
        foreach ($ordersByWeekday1 as $day) {
            $topWeek[] = [
                'dia' => $daysTranslation[$day['dia']] ?? $day['dia'],
                'promedio' => floatval($day['promedio']),
                'veces' => intval($day['veces']),
                'clientes' => intval($day['clientes'])
            ];
        }

        usort($topWeek, function($a, $b) {
            return $b['promedio'] <=> $a['promedio'];
        });

        return [
            'dashboard' => $dashboard,
            'barras' => $barras,
            'linear' => $linear,
            'barDays' => $barDays,
            'topWeek' => $topWeek
        ];
    }

    function logHistory($message, $type = 'general', $title = 'Registro de actividad') {
        $history = [
            'title'         => $title,
            'order_id'      => $_POST['id'],
            'comment'       => $message,
            'action'        => $message,
            'date_action'   => date('Y-m-d H:i:s'),
            'type'          => $type,
            'usr_users_id'  => $_SESSION['USR'] ?? 1,
        ];

        return $this->addHistories($this->util->sql($history));
    }

    function updateDeliveryStatus() {
        $status = 500;
        $message = 'Error al actualizar el estado de entrega';
        
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

    function deleteOrder() {
        $status  = 500;
        $message = 'Error al eliminar el pedido';

        if ($_SESSION['ROLID'] != 1) {
            return [
                'status'  => 403,
                'message' => 'No tienes permisos para eliminar pedidos'
            ];
        }

       
        
        $delete = $this->deleteOrderById([$_POST['id']]);

        if ($delete) {
            $status  = 200;
            $message = 'Pedido eliminado correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message,
            $delete
        ];
    }

    function getDailyClose() {
        $status  = 500;
        $message = 'Error al obtener resumen del día';
        $data    = null;


        if ($_SESSION['ROLID'] == 1 ) {

            $subsidiaries_id = $_POST['subsidiaries_id'];
        
        } else {
            $subsidiaries_id = $_SESSION['SUB'];
        }

        // Obtener información de la sucursal
        $subsidiary_name = '';
        $is_all_subsidiaries = false;

        if ($subsidiaries_id == 0 || $subsidiaries_id == '0') {
            // Modo "todas las sucursales"
            $subsidiary_name = 'TODAS LAS SUCURSALES';
            $is_all_subsidiaries = true;
        } else {
            // Obtener nombre de sucursal específica
            $subsidiary = $this->getSucursalByID([$subsidiaries_id]);
            if ($subsidiary && isset($subsidiary['name'])) {
                $subsidiary_name = $subsidiary['name'];
            } else {
                $subsidiary_name = 'Sucursal Desconocida';
            }
        }

        $summary = $this->getDailySalesMetrics([
            $_POST['date'],
            $subsidiaries_id
        ]);
        
        // Verificar que los datos de pagos se obtengan correctamente
        if ($summary && $summary['total_orders'] > 0) {
            $status  = 200;
            $message = 'Resumen obtenido correctamente';
            $data    = [
                'total_sales'          => $summary['total_sales'],
                'card_sales'           => $summary['card_sales'],
                'cash_sales'           => $summary['cash_sales'],
                'transfer_sales'       => $summary['transfer_sales'],
                'total_orders'         => $summary['total_orders'],
                'quotation_count'      => $summary['quotation_count'],
                'cancelled_count'      => $summary['cancelled_count'],
                'pending_count'        => $summary['pending_count'],
                'subsidiary_name'      => $subsidiary_name,
                'is_all_subsidiaries'  => $is_all_subsidiaries
            ];
        } else {
            $status  = 404;
            $message = 'No hay pedidos registrados para esta fecha';
            $data    = [
                'quotation_count'      => $summary['quotation_count'] ?? 0,
                'cancelled_count'      => $summary['cancelled_count'] ?? 0,
                'pending_count'        => $summary['pending_count'] ?? 0,
                'subsidiary_name'      => $subsidiary_name,
                'is_all_subsidiaries'  => $is_all_subsidiaries
            ];
        }

        $data['logo'] = $_SESSION['LOGO'];

        // Verificar si ya existe un cierre para esta fecha/sucursal
        $closure_exists = false;
        $closure_id     = null;
        if (!$is_all_subsidiaries) {
            $closure = $this->getDailyClosureByDate([$_POST['date'], $subsidiaries_id]);
            if ($closure) {
                $closure_exists = true;
                $closure_id     = $closure['id'];
                $closed_by      = $closure['closed_by_name'];
                $closed_at      = $closure['created_at'];

                // Sobreescribir con los datos guardados del cierre
                $closure_payments = $this->getClosurePayments($closure_id);
                if (is_array($closure_payments)) {
                    $data['cash_sales']     = 0;
                    $data['card_sales']     = 0;
                    $data['transfer_sales'] = 0;
                    foreach ($closure_payments as $cp) {
                        switch ($cp['payment_method_id']) {
                            case 1: $data['cash_sales']     = $cp['amount']; break;
                            case 2: $data['card_sales']     = $cp['amount']; break;
                            case 3: $data['transfer_sales'] = $cp['amount']; break;
                        }
                    }
                }

                $closure_statuses = $this->getClosureStatusProcess($closure_id);
                if (is_array($closure_statuses)) {
                    $data['quotation_count'] = 0;
                    $data['pending_count']   = 0;
                    $data['cancelled_count'] = 0;
                    foreach ($closure_statuses as $cs) {
                        switch ($cs['status_process_id']) {
                            case 1: $data['quotation_count'] = $cs['amount']; break;
                            case 2: $data['pending_count']   = $cs['amount']; break;
                            case 4: $data['cancelled_count'] = $cs['amount']; break;
                        }
                    }
                }

                $data['total_sales']  = $closure['total'];
                $data['total_orders'] = $closure['total_orders'];
            }
        }

        $data['closure_exists'] = $closure_exists;
        $data['closure_id']     = $closure_id;
        $data['closed_by']      = $closed_by ?? null;
        $data['closed_at']      = $closed_at ?? null;

        return [
            'status'  => $status,
            'message' => $message,
            'data'    => $data,
            'sumary'  => $summary,
            $subsidiaries_id
        ];
    }

    function saveDailyClose() {
        $status  = 500;
        $message = 'Error al realizar el cierre del día';

        if ($_SESSION['ROLID'] == 1) {
            $subsidiaries_id = $_POST['subsidiaries_id'];
        } else {
            $subsidiaries_id = $_SESSION['SUB'];
        }

        if ($subsidiaries_id == 0 || $subsidiaries_id == '0') {
            return ['status' => 400, 'message' => 'No se puede cerrar todas las sucursales a la vez'];
        }

        $date = $_POST['date'];

        $existing = $this->getDailyClosureByDate([$date, $subsidiaries_id]);
        if ($existing) {
            return ['status' => 409, 'message' => 'Ya existe un cierre para esta fecha y sucursal', 'closure_id' => $existing['id']];
        }

        $summary = $this->getDailySalesMetrics([$date, $subsidiaries_id]);
        if (!$summary || $summary['total_orders'] <= 0) {
            return ['status' => 404, 'message' => 'No hay pedidos para cerrar en esta fecha'];
        }

        $total_sales = floatval($summary['total_sales']);

        $closure_id = $this->createDailyClosure([
            'values' => 'total, tax, subtotal, employee_id, subsidiary_id, created_at, active, total_orders',
            'data'   => [
                $total_sales,
                0,
                $total_sales,
                $_SESSION['ID'],
                $subsidiaries_id,
                date('Y-m-d H:i:s'),
                1,
                $summary['total_orders']
            ]
        ]);

        if (!$closure_id) {
            return ['status' => 500, 'message' => 'Error al crear el cierre'];
        }

        // Guardar formas de pago
        $payments = [
            ['method_id' => 1, 'amount' => floatval($summary['cash_sales'])],
            ['method_id' => 2, 'amount' => floatval($summary['card_sales'])],
            ['method_id' => 3, 'amount' => floatval($summary['transfer_sales'])]
        ];

        foreach ($payments as $pay) {
            $this->createClosurePayment([
                'values' => 'daily_closure_id, payment_method_id, amount',
                'data'   => [$closure_id, $pay['method_id'], $pay['amount']]
            ]);
        }

        // Guardar status de pedidos
        $statuses = [
            ['status_id' => 1, 'amount' => intval($summary['quotation_count'])],
            ['status_id' => 2, 'amount' => intval($summary['pending_count'])],
            ['status_id' => 4, 'amount' => intval($summary['cancelled_count'])]
        ];

        foreach ($statuses as $st) {
            $this->createClosureStatusProcess([
                'values' => 'daily_closure_id, status_process_id, amount',
                'data'   => [$closure_id, $st['status_id'], $st['amount']]
            ]);
        }

        // Asignar folio de cierre a pedidos del día
        $this->updateOrdersDailyClosure([$closure_id, $date, $subsidiaries_id]);

        return [
            'status'     => 200,
            'message'    => 'Cierre realizado correctamente',
            'closure_id' => $closure_id
        ];
    }

    // =============================================
    // Cash Shift (Turnos)
    // =============================================

    function openShift() {
        if ($_SESSION['ROLID'] == 1) {
            $subsidiaries_id = $_POST['subsidiaries_id'] ?? $_SESSION['SUB'];
        } else {
            $subsidiaries_id = $_SESSION['SUB'];
        }

        // Validar que no exista turno abierto
        $existing = $this->getOpenShiftBySubsidiary([$subsidiaries_id]);
        if ($existing) {
            return [
                'status'  => 409,
                'message' => 'Ya existe un turno abierto para esta sucursal. Ciérralo antes de abrir uno nuevo.'
            ];
        }

        $shift_name     = $_POST['shift_name'] ?? null;
        $opening_amount = floatval($_POST['opening_amount'] ?? 0);

        $this->createCashShift([
            'values' => 'subsidiary_id, employee_id, shift_name, opened_at, opening_amount, status, active',
            'data'   => [
                $subsidiaries_id,
                $_SESSION['ID'],
                $shift_name,
                date('Y-m-d H:i:s'),
                $opening_amount,
                'open',
                1
            ]
        ]);

        $max = $this->getMaxCashShift();
        $shift_id = $max ? $max['id'] : null;

        if (!$shift_id) {
            return ['status' => 500, 'message' => 'Error al crear el turno'];
        }

        $shift = $this->getCashShiftById($shift_id);

        return [
            'status'   => 200,
            'message'  => 'Turno abierto correctamente',
            'shift_id' => $shift_id,
            'shift'    => $shift
        ];
    }

    function closeShift() {
        $shift_id = $_POST['shift_id'];

        $shift = $this->getCashShiftById($shift_id);
        if (!$shift) {
            return ['status' => 404, 'message' => 'Turno no encontrado'];
        }
        if ($shift['status'] !== 'open') {
            return ['status' => 409, 'message' => 'Este turno ya fue cerrado'];
        }

        $closed_at = date('Y-m-d H:i:s');
        $opened_at = $shift['opened_at'];
        $subsidiary_id = $shift['subsidiary_id'];

        // Calcular métricas del turno
        $metrics = $this->getShiftSalesMetrics([$opened_at, $closed_at, $subsidiary_id]);

        $total_sales    = floatval($metrics['total_sales']);
        $cash_sales     = floatval($metrics['cash_sales']);
        $card_sales     = floatval($metrics['card_sales']);
        $transfer_sales = floatval($metrics['transfer_sales']);
        $total_orders   = intval($metrics['total_orders']);

        // Cerrar turno
        $this->closeCashShift([
            $closed_at, $total_sales, $cash_sales, $card_sales,
            $transfer_sales, $total_orders, $shift_id
        ]);

        // Guardar desglose de pagos
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

        // Guardar conteo por status
        $statuses = [
            ['status_id' => 1, 'amount' => intval($metrics['quotation_count'])],
            ['status_id' => 2, 'amount' => intval($metrics['pending_count'])],
            ['status_id' => 4, 'amount' => intval($metrics['cancelled_count'])]
        ];
        foreach ($statuses as $st) {
            $this->createShiftStatusProcess([
                'values' => 'cash_shift_id, status_process_id, amount',
                'data'   => [$shift_id, $st['status_id'], $st['amount']]
            ]);
        }

        // Vincular órdenes al turno
        $this->updateOrdersCashShift([$shift_id, $opened_at, $closed_at, $subsidiary_id]);

        // Retornar datos actualizados
        $updatedShift = $this->getCashShiftById($shift_id);
        $date = date('Y-m-d', strtotime($opened_at));
        $shifts = $this->getShiftsBySubsidiaryDate([$date, $subsidiary_id]);

        return [
            'status'  => 200,
            'message' => 'Turno cerrado correctamente',
            'shift'   => $updatedShift,
            'shifts'  => $shifts,
            'metrics' => $metrics
        ];
    }

    function getShiftsByDate() {
        if ($_SESSION['ROLID'] == 1) {
            $subsidiaries_id = $_POST['subsidiaries_id'] ?? $_SESSION['SUB'];
        } else {
            $subsidiaries_id = $_SESSION['SUB'];
        }

        $date = $_POST['date'] ?? date('Y-m-d');
        $shifts = $this->getShiftsBySubsidiaryDate([$date, $subsidiaries_id]);

        return [
            'status' => 200,
            'shifts' => is_array($shifts) ? $shifts : []
        ];
    }

    function getShiftMetrics() {
        $shift_id = $_POST['shift_id'];
        $shift = $this->getCashShiftById($shift_id);

        if (!$shift) {
            return ['status' => 404, 'message' => 'Turno no encontrado'];
        }

        $subsidiary_id = $shift['subsidiary_id'];

        // Obtener nombre de sucursal
        $subsidiary = $this->getSucursalByID([$subsidiary_id]);
        $subsidiary_name = ($subsidiary && isset($subsidiary['name'])) ? $subsidiary['name'] : 'Sucursal';

        if ($shift['status'] === 'closed') {
            // Retornar datos guardados
            return [
                'status'          => 200,
                'shift'           => $shift,
                'subsidiary_name' => $subsidiary_name,
                'logo'            => $_SESSION['LOGO'],
                'data' => [
                    'total_sales'     => $shift['total_sales'],
                    'cash_sales'      => $shift['total_cash'],
                    'card_sales'      => $shift['total_card'],
                    'transfer_sales'  => $shift['total_transfer'],
                    'total_orders'    => $shift['total_orders'],
                    'quotation_count' => 0,
                    'pending_count'   => 0,
                    'cancelled_count' => 0
                ]
            ];
        }

        // Turno abierto: calcular en tiempo real
        $opened_at = $shift['opened_at'];
        $now = date('Y-m-d H:i:s');
        $metrics = $this->getShiftSalesMetrics([$opened_at, $now, $subsidiary_id]);

        return [
            'status'          => 200,
            'shift'           => $shift,
            'subsidiary_name' => $subsidiary_name,
            'logo'            => $_SESSION['LOGO'],
            'data'            => $metrics
        ];
    }

    function getShiftOrders() {
        $shift_id = $_POST['shift_id'];
        $shift = $this->getCashShiftById($shift_id);

        if (!$shift) {
            return ['status' => 404, 'message' => 'Turno no encontrado'];
        }

        $opened_at = $shift['opened_at'];
        $closed_at = $shift['status'] === 'closed' ? $shift['closed_at'] : date('Y-m-d H:i:s');
        $subsidiary_id = $shift['subsidiary_id'];

        $orders = $this->getShiftDetailedOrders([$opened_at, $closed_at, $subsidiary_id]);

        return [
            'status' => 200,
            'orders' => is_array($orders) ? $orders : []
        ];
    }

    function checkOpenShift() {
        if ($_SESSION['ROLID'] == 1) {
            $subsidiaries_id = $_POST['subsidiaries_id'] ?? $_SESSION['SUB'];
        } else {
            $subsidiaries_id = $_SESSION['SUB'];
        }

        $openShift = $this->getOpenShiftBySubsidiary([$subsidiaries_id]);

        if ($openShift) {
            return [
                'status'         => 200,
                'has_open_shift' => true,
                'shift_id'       => $openShift['id'],
                'opened_at'      => $openShift['opened_at'],
                'shift_name'     => $openShift['shift_name'],
                'employee_name'  => $openShift['employee_name']
            ];
        }

        return [
            'status'         => 200,
            'has_open_shift' => false
        ];
    }

    // Discount
    function addDiscount() {
        $status  = 500;
        $message = "Error al aplicar el descuento";

        // if ($_SESSION['ROLID'] != 1) {
        //     return [
        //         'status'  => 403,
        //         'message' => 'No tienes permisos para aplicar descuentos'
        //     ];
        // }

        $id       = $_POST['id'];
        $discount = floatval($_POST['discount'] ?? 0);
        $info     = $_POST['info_discount'] ?? '';

        $order    = $this->getOrderID([$id])[0];
        $totalPay = floatval($order['total_pay']);


        // if ($discount > $totalPay) {
        //     return [
        //         'status'  => 400,
        //         'message' => 'El descuento no puede ser mayor al total del pedido ($' . number_format($totalPay, 2) . ')'
        //     ];
        // }

        $values = [
            'discount'      => $discount,
            'info_discount' => $info,
            'id'            => $id
        ];

        $updateData = $this->util->sql($values, 1);
        $update     = $this->updateOrder($updateData);

        if ($update) {
            $status  = 200;
            $message = "Descuento aplicado correctamente";

            $this->logHistory(
                "Descuento aplicado: $" . number_format($discount, 2) . ($info ? " - Motivo: {$info}" : ""),
                'discount',
                'Descuento aplicado'
            );
        }

        return [
            'status'  => $status,
            'message' => $message,
            'data'    => 
            $update ? 
            [
                'discount'    => $discount,
                'total_pay'   => $totalPay,
                'total_final' => $totalPay - $discount,
                'update'      => $updateData
            ]
             : null
        ];
    }

    function getDiscount() {
        $id = $_POST['id'];

        $order = $this->getOrderID([$id])[0];
        if (!$order) {
            return [
                'status'  => 404,
                'message' => 'El pedido especificado no existe'
            ];
        }

        $totalPay   = 0;
        $discount   = 0;
        $totalPaid  = 0;
        $totalFinal = 0;
        $balance    = 0;

        $totalPay   = $order['total_pay']  ?? 0;
        $discount   = floatval($order['discount'] ?? 0);
        // $totalPaid  = floatval($order['total_paid'] ?? 0);
        $totalFinal = $totalPay - $discount;
        // $balance    = $totalFinal - $totalPaid;

        return [
            'status'      => 200,
            'message'     => 'Información de descuento obtenida',
            'ls'          => $order,
            'data'        => [
                'id'           => $id,
                'total_pay'    => $totalPay,
                'discount'     => $discount,
                'info_discount'=> $order['info_discount'] ?? '',
                'total_final'  => $totalFinal,
                'total_paid'   => $totalPaid,
                'balance'      => $balance,
                'hasDiscount'  => $discount > 0
            ]
        ];
    }

    function editDiscount() {
        if ($_SESSION['ROLID'] != 1) {
            return [
                'status'  => 403,
                'message' => 'No tienes permisos para editar descuentos'
            ];
        }

        $id          = $_POST['id'];
        $newDiscount = floatval($_POST['discount'] ?? 0);
        $info        = $_POST['info_discount'] ?? '';

        $order = $this->getOrderID([$id])[0];
        if (!$order) {
            return [
                'status'  => 404,
                'message' => 'El pedido especificado no existe'
            ];
        }

        $totalPay    = floatval($order['total_pay']);
        $oldDiscount = floatval($order['discount'] ?? 0);

        if ($newDiscount < 0) {
            return [
                'status'  => 400,
                'message' => 'El monto del descuento no puede ser negativo'
            ];
        }

        if ($newDiscount > $totalPay) {
            return [
                'status'  => 400,
                'message' => 'El descuento no puede ser mayor al total del pedido ($' . number_format($totalPay, 2) . ')'
            ];
        }

        $updateData = $this->util->sql([
            'discount'      => $newDiscount,
            'info_discount' => $info,
            'id'            => $id
        ], 1);

        $update = $this->updateOrder($updateData);

        if ($update) {
            $this->logHistory(
                "Descuento modificado: $" . number_format($oldDiscount, 2) . " → $" . number_format($newDiscount, 2) . ($info ? " - Motivo: {$info}" : ""),
                'discount',
                'Descuento editado'
            );

            return [
                'status'  => 200,
                'message' => 'Descuento actualizado correctamente',
                'data'    => [
                    'old_discount' => $oldDiscount,
                    'new_discount' => $newDiscount,
                    'total_pay'    => $totalPay,
                    'total_final'  => $totalPay - $newDiscount
                ]
            ];
        }

        return [
            'status'  => 500,
            'message' => 'Error al actualizar el descuento'
        ];
    }

    function deleteDiscount() {
        // if ($_SESSION['ROLID'] != 1) {
        //     return [
        //         'status'  => 403,
        //         'message' => 'No tienes permisos para eliminar descuentos'
        //     ];
        // }

        $id = $_POST['id'];

        $order = $this->getOrderID([$id])[0];
        if (!$order) {
            return [
                'status'  => 404,
                'message' => 'El pedido especificado no existe'
            ];
        }

        $oldDiscount = floatval($order['discount'] ?? 0);

        if ($oldDiscount == 0) {
            return [
                'status'  => 400,
                'message' => 'Este pedido no tiene descuento aplicado'
            ];
        }

        $updateData = $this->util->sql([
            'discount'      => 0,
            'info_discount' => '',
            'id'            => $id
        ], 1);

        $update = $this->updateOrder($updateData);

        if ($update) {
            $this->logHistory(
                "Descuento eliminado: $" . number_format($oldDiscount, 2),
                'discount',
                'Descuento eliminado'
            );

            return [
                'status'  => 200,
                'message' => 'Descuento eliminado correctamente',
                'data'    => [
                    'deleted_discount' => $oldDiscount
                ]
            ];
        }

        return [
            'status'  => 500,
            'message' => 'Error al eliminar el descuento'
        ];
    }

}

   //


// Complements.
function dropdownOrder($id, $status, $discount = 0) {
    $instancia = 'app';
    $impresion = 'payment';
    $rolId     = $_SESSION['ROLID'] ?? 0;
    $owner     = $_SESSION['OWNER'] ?? 0;
    $hasDiscount = $discount > 0;

    $options = [
        ['Ver', 'icon-eye', "{$instancia}.showOrder({$id})"],
        ['Editar', 'icon-pencil', "{$instancia}.editOrder({$id})"],
        ['Cancelar', 'icon-block-1', "{$instancia}.cancelOrder({$id})"],
        ['Pagar', 'icon-money', "{$instancia}.historyPay({$id})"],
        ['Historial', 'icon-history', "{$instancia}.showHistory({$id})"],
        ['Imprimir', 'icon-print', "{$instancia}.printOrder({$id})"],
    ];

    if ($status == 2) { // Pendiente
        $options = [
            ['Ver', 'icon-eye', "{$instancia}.showOrder({$id})"],
            ['Editar', 'icon-pencil', "{$instancia}.editOrder({$id})"],
            ['Pagar', 'icon-money', "{$instancia}.historyPay({$id})"],
            ['Imprimir', 'icon-print', "{$instancia}.printOrder({$id})"],
        ];
        if ($rolId == 1) {
            $options[] = ['Historial', 'icon-history', "{$instancia}.showHistory({$id})"];
        }

        if ($hasDiscount) {
            $options[] = ['Editar descuento', 'icon-percent', "{$instancia}.editDiscount({$id})"];
            $options[] = ['Eliminar descuento', 'icon-cancel', "{$instancia}.deleteDiscount({$id})"];
        } else {
            $options[] = ['Aplicar descuento', 'icon-percent', "{$instancia}.addDiscount({$id})"];
        }

        if ($owner == 1) {
            $options[] = ['Eliminar', 'icon-trash', "{$instancia}.deleteOrder({$id})"];
        }
    } elseif ($status == 3) { // Pagado
        $options = [
            ['Ver', 'icon-eye', "{$instancia}.showOrder({$id})"],
            ['Imprimir', 'icon-print', "{$instancia}.printOrder({$id})"],
        ];

        if ($owner == 1) {
            $options[] = ['Historial', 'icon-history', "{$instancia}.showHistory({$id})"];
        }
    } elseif ($status == 1) { // Cotización
        $options = [
            ['Ver', 'icon-eye', "{$instancia}.showOrder({$id})"],
            ['Editar', 'icon-pencil', "{$instancia}.editOrder({$id})"],
        ];
        // Solo agrega "Cancelar" si el rol no es 3
        if ($rolId != 3) {
            $options[] = ['Cancelar', 'icon-block-1', "{$instancia}.cancelOrder({$id})"];
        }
        $options[] = ['Pagar', 'icon-money', "{$instancia}.historyPay({$id})"];
        $options[] = ['Imprimir', 'icon-print', "{$instancia}.printOrder({$id})"];

        if ($hasDiscount) {
            $options[] = ['Editar descuento', 'icon-percent', "{$instancia}.editDiscount({$id})"];
            $options[] = ['Eliminar descuento', 'icon-cancel', "{$instancia}.deleteDiscount({$id})"];
        } else {
            $options[] = ['Aplicar descuento', 'icon-percent', "{$instancia}.addDiscount({$id})"];
        }

        if ($owner == 1) {
            $options[] = ['Eliminar', 'icon-trash', "{$instancia}.deleteOrder({$id})"];
        }
    } elseif ($status == 4) { // Cancelado
        $options = [
            ['Ver', 'icon-eye', "{$instancia}.showOrder({$id})"],
        ];

        if ($owner == 1) {
            $options[] = ['Eliminar', 'icon-trash', "{$instancia}.deleteOrder({$id})"];
        }
    }

    return array_map(fn($opt) => [
        'text' => $opt[0],
        'icon' => $opt[1],
        'onclick' => $opt[2],
    ], $options);
}


function status($idEstado){
    switch ($idEstado) {
        case 1:
            return '<span class="bg-[#9EBBDB] w-32 text-[#2A55A3] text-[10px] font-semibold mr-2 px-3 py-1 rounded">COTIZACIÓN</span>';
        case 2:
            return '<span class="bg-[#633112] w-32 text-[#F2C215] text-[10px] font-semibold mr-2 px-3 py-1 rounded">PENDIENTE</span>';
        case 3:
            return '<span class="bg-[#014737] w-32 text-[#3FC189] text-[10px] font-semibold mr-2 px-3 py-1 rounded">PAGADO</span>';
        case 4:
            return '<span class="bg-[#572A34] w-32 text-[#E05562] text-[10px] font-semibold mr-2 px-3 py-1 rounded">CANCELADO</span>';

    }
}

function renderDeliveryType($deliveryType) {
    $deliveryType = $deliveryType ?? 'local';
    
    if ($deliveryType == 1) {
        return '<i class="icon-motorcycle text-amber-500 text-xl" title="Entrega a domicilio"></i>';
    } else {
        return '<i class="icon-home text-gray-300 text-xl" title="Entrega local"></i>';
    }
}

function renderDeliveryStatus($order) {
    $orderId     = $order['id'];
    $status      = $order['idStatus'];
    $isDelivered = isset($order['is_delivered']) ? intval($order['is_delivered']) : 0;
    $folio       = $order['folio'] ?? '';

    if ($status == 1) {
        return '<span text="text-gray-400">No aplica</span>';
    }

    // Estados: 0 = No entregado, 1 = Entregado, 2 = Para producir
    switch ($isDelivered) {
        case 1:
            $bgColor = 'bg-[#014737]';
            $textColor = 'text-[#3FC189]';
            $icon = 'icon-ok';
            $text = 'Entregado';
            break;
        case 2:
            $bgColor = 'bg-[#831843]';
            $textColor = 'text-[#f472b6]';
            $icon = 'icon-birthday';
            $text = 'Para producir';
            break;
        default:
            $bgColor = 'bg-[#572A34]';
            $textColor = 'text-[#E05562]';
            $icon = 'icon-cancela';
            $text = 'No entregado';
            break;
    }

    $clickable = $status != 4;
    $cursorClass = $clickable ? 'cursor-pointer hover:opacity-80' : 'cursor-not-allowed opacity-60';
    $onclick = $clickable ? "onclick=\"app.handleDeliveryClick({$orderId}, {$isDelivered}, '{$folio}')\"" : '';

    return "<span
                class=\"{$bgColor} w-32 {$textColor} text-[10px] font-semibold mr-2 px-2 py-1 rounded {$cursorClass}\"
                {$onclick}
                data-order-id=\"{$orderId}\"
                data-delivered=\"{$isDelivered}\">
                <i class=\"{$icon}\"></i> {$text}
            </span>";
}



function formatSucursal($compania, $sucursal, $numero = null){

    $letraCompania = strtoupper(substr(trim($compania), 0, 1));
    $letraSucursal = strtoupper(substr(trim($sucursal), 0, 1));

    $number = $numero ?? rand(1, 99);

    $formattedNumber = str_pad($number, 2, '0', STR_PAD_LEFT);

    return 'P-'.$letraCompania . $letraSucursal .'-'. $formattedNumber;
}

function formatDateTime($date, $time) {
    if (!empty($date) && !empty($time)) {
        $datetime = DateTime::createFromFormat('Y-m-d H:i', "$date $time");
        return $datetime ? $datetime->format('Y-m-d H:i:s') : null;
    }
    return null;
}



$obj    = new Pedidos();
$fn     = $_POST['opc'];

$encode = [];
$encode = $obj->$fn();
echo json_encode($encode);


?>

