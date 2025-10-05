<?php
session_start();

// Manejar preflight OPTIONS request
if ($_SERVER['REQUEST_METHOD'] == 'OPTIONS') {
    header("Access-Control-Allow-Origin: *");
    header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
    header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
    exit(0);
}

header("Access-Control-Allow-Origin: *"); // Permite solicitudes de cualquier origen
header("Access-Control-Allow-Methods: GET, POST, OPTIONS"); // Métodos permitidos
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With"); // Encabezados permitidos

if (empty($_POST['opc'])) exit(0);

require_once '../mdl/mdl-pedidos.php';

class Pedidos extends MPedidos{
    function init(){
        return [
            'modifier' => $this->getAllModifiers([1]),
            'products' => $this->lsProductos([1,$_SESSION['SUB']]),
            'clients'   => $this->getAllClients([$_SESSION['SUB']]),
            'status'   =>  $this->lsStatus(),
        ];
    }



    // Order.
    public function listOrders() {
        $rows = [];
        $Sucursal = $this->getSucursalByID([$_SESSION['SUB']]);

        $orders   = $this->getOrders([
            'fi'              => $_POST['fi'] ?? '',
            'ff'              => $_POST['ff'] ?? '',
            'status'          => $_POST['status'] ,
            // 'subsidiaries_id' => $_SESSION['SUB'] ?? 1
        ]);

        foreach ($orders as $order) {
            $advanceExtra = 0;
            $discount     = $order['discount'] ?? 0;
            $total        = $order['total_pay'] ?? 0;
            $totalPagado  = $this->getTotalPaidByOrder([$order['id']]);

            $totalGral     = $total - $discount;
            $saldo         = $total - $discount - $totalPagado;

            $htmlTotal = $discount
                ? "<div class='text-end'>
                        <p title='Con descuento aplicado' class='text-green-400 cursor-pointer font-semibold'>" . evaluar($totalGral) . "</p>
                        <p class='line-through text-gray-500 text-[10px]'>" . evaluar($total) . "</p>
                        <p class='text-gray-500 text-[10px]'><i class='icon-tag'></i> Descuento: " . evaluar($discount) . "</p>
                    </div>"
                : number_format($total, 2);


            $Folio         = formatSucursal($Sucursal['name'], $Sucursal['sucursal'], $order['id']);


            // list.

            $rows[] = [
                'id'       => $order['id'],
                'folio'    => $Folio,
                'Creación' => formatSpanishDate($order['date_creation']),

                'Cliente' => [
                    'html' => "<p class='text-gray-300'>{$order['name_client']}</p><p class='text-gray-500'>{$order['location']}</p>"
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
                'Hora de entrega'         => $order['time_order'] ,
                // 'Personas'         => '',
                'Estado'          => status($order['idStatus']),
                // 'Entregado'          => '',
                'dropdown'        => dropdownOrder($order['id'], $order['idStatus']),
            ];
        }

        return [
            'row'    => $rows,
            'orders' => $orders
        ];

    }

    public function addOrder(){

        $client = $this->getClientName([$_POST['name']]);

        if (empty($client['id'])) {
            $data_client = $this->util->sql([
                'name'            => $_POST['name'],
                'phone'           => $_POST['phone'],
                'email'           => $_POST['mail'],
                'date_create'     => date('Y-m-d H:i:s'),
                'subsidiaries_id' => $_SESSION['SUB'],
                'active'          => 1,
            ]);

            $this->createClient($data_client);

            $client = $this->getClientName([$_POST['name']]);

        }

        $data = $this->util->sql([
            'note'            => $_POST['note'],
            'date_birthday'   => $_POST['date_birthday'],
            'date_order'      => $_POST['date_order'],
            'time_order'      => $_POST['time_order'],
            'date_creation'   => date('Y-m-d H:i:s'),
            'client_id'       => $client['id'],
            'status'          => 1,
            'type_id'         => 1,
            'subsidiaries_id' => $_SESSION['SUB'],

        ]);

        $insert = $this->createOrder($data);


        if ($insert) {

            $folio  = $this->getMaxOrder();

            return [
                'status'  => 200,
                'message' => 'Pedido registrado correctamente.',
                'data'    => $insert,
                 'id'      => $folio['id'],
                 'client'  => $client
            ];
        }

        return [

            'status'  => 500,
            'message' => 'Error al registrar el pedido.',
            'data'    => $folio['id']
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

    function getOrderDetails() {
        $status = 500;
        $message = 'Error al obtener detalles del pedido';
        $data = null;
        $SUB = $_SESSION['SUB'] ?? 4;

        $orderId = $_POST['id'];
        
        // Obtener información básica del pedido
        $order = $this->getOrderID([$orderId]);
        
        if ($order) {
            $orderData = $order[0];
            
        //     // Obtener sucursal para el folio
            $sucursal = $this->getSucursalByID([$SUB]);
            $folio = formatSucursal($sucursal['name'], $sucursal['sucursal'], $orderData['id']);
            
            // Calcular totales
            $totalPagado = $this->getTotalPaidByOrder([$orderId]);
            $discount    = $orderData['discount'] ?? 0;
            $total       = $orderData['total_pay'] ?? 0;
            $saldo       = $total - $discount - $totalPagado;
            
            // Obtener productos del pedido (si existen tablas relacionadas)
            $products = $this->getOrderProducts([$orderId]) ?? [];
            
         
            
            // Obtener detalles de productos personalizados
            foreach ($products as &$product) {
                if (isset($product['customer_id']) && $product['customer_id'] !== null) {
                    $customDetails = $this->getCustomerProducts([$product['customer_id']]);
                    if ($customDetails) {
                        $product = array_merge($product, $customDetails);
                    }
                }
            }
            unset($product); // Limpiar referencia
            
            $data = [
                'order' => array_merge($orderData, [
                    'folio' => $folio,
                    'total_paid' => $totalPagado,
                    'balance' => $saldo,
                    'formatted_date_order' => $orderData['date_order'],
                    'formatted_date_creation' =>$orderData['date_creation']
                ]),
                'products' => $products,
                'summary' => [
                    'total' => $total,
                    'paid' => $totalPagado,
                    'discount' => $discount,
                    'balance' => $saldo
                ]
            ];
            
            $status = 200;
            $message = 'Detalles obtenidos correctamente';
        }

        return [
            'status' => $status,
            'message' =>  $sucursal,
            'data' => $data,
            'order'=> $order 
        ];
    }

    function editOrder() {
        $status  = 500;
        $message = 'No se pudo actualizar el pedido';

        $update = $this->updateOrder($this->util->sql([
            'date_order' => $_POST['date_order'],
            'time_order' => $_POST['time_order'],
            'note'       => $_POST['note'],
            'id'         => $_POST['id'],

        ], 1));

        if ($update) {
            $status  = 200;
            $message = 'Pedido actualizado correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message
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
        }

        return [
            'status'  => $status,
            'message' => $message,
            'data'    => $this->initHistoryPay()
         
        ];
    }

    function logHistory($eventId, $message) {
        // $this->addHistories($this->util->sql([
        //     'title'         => 'Abono',
        //     'evt_events_id' => $eventId,
        //     'comment'       => $message,
        //     'action'        => $message,
        //     'date_action'   => date('Y-m-d H:i:s'),
        //     'type'          => 'payment',
        //     'usr_users_id'  => $_SESSION['USR']
        // ]));
    }

    function initHistoryPay(){
        $ls                  = $this->getOrderID([$_POST['id']]);
        $methods             = $this-> getMethodPayment([$_POST['id']]);
        $ls[0]['total_paid'] = array_sum(array_column($methods, 'pay'));

        $PaymentsDetails     = 0;

        return [
            'order'  => $ls[0],
            'details' => [
                'pagado'   => $ls[0]['total_paid'],
                'total'    => $ls[0]['total_pay'],
                'discount' => $ls[0]['discount'],
                'restante' => $ls[0]['total_pay'] - $ls[0]['total_paid'],
            ]
        ];
    }

    function getHistory(){

        $Order = $this -> getOrderID([ $_POST['id'] ]);
        $payment     = $this -> getListPayment([$_POST['id']]);

        $totalPagado = 0;
        foreach ($payment as $key) {
            $totalPagado += $key['pay'];
        }

        $info = [

            'pagado'   => $totalPagado,
            'total'    => $Order[0]['total_pay'],
            'discount' => $Order[0]['discount'],
            'restante' => $Order[0]['total_pay'] - $totalPagado,

        ];

        return [

           'pagado'   => $totalPagado,
            'total'    => $Order[0]['total_pay'],
            'discount' => $Order[0]['discount'],
            'restante' => $Order[0]['total_pay'] - $totalPagado,
        ];

    }


    function deletePay() {
        
        $values = $this->util->sql([
            'id' => $_POST['idPay']
        ], 1);

        $delete = $this->deletePayment($values);

        return [
            'status'  => $delete ? 200 : 400,
            'message' => $delete ? "Pago eliminado correctamente." : "No se pudo eliminar el pago.",
            'initHistoryPay'    => $this->initHistoryPay()
        ];
    }

    function getPayment(){

         $ls      = $this->getOrderID([$_POST['id']]);
         $methods = $this-> getMethodPayment([$_POST['id']]);

         return [
            'order'    => $ls[0],
            'total_paid'  => array_sum(array_column($methods, 'pay'))
         ];

    }

     function listPayment() {

        $data = $this->getListPayment([$_POST['id']]);
        $__row = [];
        $icono = '<i class="icon-credit-card"></i>';

        $lastId = !empty($data) ? end($data)['id'] : null;

        foreach ($data as $key) {

            if ($key['method_pay'] == 'Efectivo') {
                $icono = '<i class="icon-money"></i>';
            } elseif ($key['method_pay'] == 'Transferencia') {
                $icono = '<i class="icon-exchange"></i>';
            } else {
                $icono = '<i class="icon-credit-card"></i>';
            }

            $a = [];

            // if ($key['id'] == $lastId){

                $a[] = [
                            'icon'  => '',
                            'class' => 'pointer text-red-200 hover:text-red-900 p-2',
                            'html'  => '<i class="icon-trash"></i>',
                            'onClick' => "app.deletePay({$key['id']},{$_POST['id']})"
                ];
            // }

            $__row[] = [
                'id'           => $key['id'],

                'Fecha de Pago'=> [
                    'html'  => '<i class="icon-calendar-2"></i> ' . formatSpanishDate($key['date_pay']),
                ],
                'Método'       => [
                    'html'  => $icono .' '. $key['method_pay'],
                ],
              
                'Monto'        => [
                    'html'  => '$ ' . number_format($key['pay'], 2),
                ],
                'a'=> $a
            ];
        }

        return [
            'row'   => $__row,
            $data
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



}

//


// Complements.
function dropdownOrder($id, $status) {
    $instancia = 'app';

    $options = [
        ['Ver', 'icon-eye', "{$instancia}.showOrderDetails({$id})"],
        ['Editar', 'icon-pencil', "{$instancia}.editOrder({$id})"],
        ['Cancelar', 'icon-block-1', "{$instancia}.cancelOrder({$id})"],
        ['Pagar', 'icon-money', "{$instancia}.historyPay({$id})"],
        ['Imprimir', 'icon-print', "{$instancia}.printOrder({$id})"],
    ];

    if ($status == 2) { // Pendiente
        $options = [
            ['Ver', 'icon-eye', "{$instancia}.showOrderDetails({$id})"],
            ['Pagar', 'icon-money', "{$instancia}.historyPay({$id})"],
            ['Imprimir', 'icon-print', "{$instancia}.printOrder({$id})"],
            ['Editar', 'icon-pencil', "{$instancia}.editOrder({$id})"],
        ];
    } elseif ($status == 3) { // Pagado
        $options = [
            ['Ver', 'icon-eye', "{$instancia}.showOrderDetails({$id})"],
        ];
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
            return '<span class="bg-[#9EBBDB] w-32 text-[#2A55A3] text-xs font-semibold mr-2 px-3 py-1 rounded">COTIZACIÓN</span>';
        case 2:
            return '<span class="bg-[#633112] w-32 text-[#F2C215] text-xs font-semibold mr-2 px-3 py-1 rounded">PENDIENTE</span>';
        case 3:
            return '<span class="bg-[#014737] w-32 text-[#3FC189] text-xs font-semibold mr-2 px-3 py-1 rounded">PAGADO</span>';
        case 4:
            return '<span class="bg-[#572A34] w-32 text-[#E05562] text-xs font-semibold mr-2 px-3 py-1 rounded">CANCELADO</span>';

    }
}

function dropdownEvent($id, $status, $hasSubEvent = 0) {
    $actions = [];

    $actions[] = btnDropdown("Ver", "eye", "app.edit({$id})");

    if ($status == 1) {
        $actions[] = btnDropdown("Editar", "edit", "app.edit({$id})");
        if (!$hasSubEvent) {
            $actions[] = btnDropdown("Eliminar", "trash", "app.remove({$id})");
        }
    }

    return dropdownBtn($actions);
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