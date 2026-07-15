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
            // Sucursales de la empresa para el selector "Sucursal de cobro" (todos los roles,
            // sin la restriccion admin de lsSubsidiaries que alimenta el filtro de navbar).
            'sucursales_cobro'  => $this->getSubsidiariesByCompany([$_SESSION['COMPANY_ID']]),
            'access'            => $_SESSION['ROLID'],
            'subsidiaries_name' => $_SESSION['SUBSIDIARIE_NAME'],
            'user_name'         => $_SESSION['USER'] ?? '',
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

        // El estado "dia cerrado" debe medirse por la JORNADA cerrada (closure_date),
        // no por cuando se ejecuto el cierre (created_at). Si no, cerrar la jornada
        // anterior a la mañana siguiente marca "hoy" como cerrado (su created_at cae
        // hoy) y bloquea letrero + boton "Nuevo Pedido" con un turno de hoy abierto.
        // Mismo criterio que el candado de openShift() (getDailyClosureByClosureDate).
        $today = date('Y-m-d');
        $closure = $this->getDailyClosureByClosureDate([$today, $subsidiaries_id]);

        // Verificar turno abierto para la sucursal seleccionada
        $openShift = $this->getOpenShiftBySubsidiary([$subsidiaries_id]);

        return [
            'is_closed'      => !empty($closure),
            'closure_id'     => $closure['id'] ?? null,
            'closed_by'      => $closure['closed_by_name'] ?? null,
            'closed_at'      => $closure['created_at'] ?? null,
            'subsidiary_id'  => $subsidiaries_id,
            'open_shift'     => $openShift ? [
                'has_open_shift' => true,
                'shift_id'       => $openShift['id'],
                'opened_at'      => $openShift['opened_at'],
                'shift_name'     => $openShift['shift_name'],
                'employee_name'  => $openShift['employee_name']
            ] : ['has_open_shift' => false]
        ];
    }


    function lsSubsidiaries(){

        $status  = 500;
        $message = 'Error al obtener las sucursales';
        $data    = [];

        // Roles con filtro de navbar (admin 1, cajero 2, vendedor 3) reciben la lista
        // de sucursales de la empresa para el selector del Cierre del dia.

        if (in_array($_SESSION['ROLID'], [1, 2, 3, 6, 7])) {

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

        // La lista es solo consulta: cualquier rol puede filtrar por el selector
        // de navbar (incluye "0" = todas las sucursales). Si no llega un valor
        // util (URLSearchParams envia null/undefined como texto), se usa la
        // sucursal de sesion. Las operaciones (cobro, cierre) NO usan esto: siguen
        // atadas a $_SESSION['SUB'].
        $postSub = $_POST['subsidiaries_id'] ?? null;
        $subsidiaries_id = ($postSub === null || $postSub === '' || $postSub === 'null' || $postSub === 'undefined')
            ? $sessionSub
            : $postSub;
      
        $currentSubForShift = ($subsidiaries_id && $subsidiaries_id != '0') ? $subsidiaries_id : $sessionSub;
        $currentShift = $this->getOpenShiftBySubsidiary([$currentSubForShift]);
        $currentShiftId = $currentShift ? $currentShift['id'] : null;

        $orders = $this->getOrders([

            'fi'              => $_POST['fi'] ?? '',
            'ff'              => $_POST['ff'] ?? '',
            'status'          => $_POST['status'],
            'subsidiaries_id' => $subsidiaries_id

        ]) ?? [];

        foreach ($orders as $order) {

            $advanceExtra = 0;
            $discount     = $order['discount'] ?? 0;
            $total        = $order['total_pay'] ?? 0;
            $totalPagado  = $this->getTotalPaidByOrder([$order['id']]);

            $totalGral     = $total - $discount;
            $saldo         = $total - $discount - $totalPagado;
            $hasDiscount   = $discount > 0;

            $htmlTotal = $hasDiscount
                ? "<div class='text-end'>
                        <p title='Con descuento aplicado' class='text-green-400 cursor-pointer font-semibold'>" . evaluar($totalGral) . "</p>
                        <p class='line-through text-gray-500 text-[10px]'>".evaluar($total) ."</p>
                        <p class='text-gray-500 text-[10px]'><i class='icon-tag'></i> Descuento: " . evaluar($discount) . "</p>
                    </div>"
                : number_format($total, 2);


            $Folio   = formatSucursal($order['subsidiaries_id'], $order['id']);

            $isCurrentShift = $currentShiftId && $order['cash_shift_id'] == $currentShiftId;
            $shiftDot = $isCurrentShift
                ? "<span class='inline-block w-1.5 h-1.5 bg-green-400 rounded-full shift-pulse mr-1.5'></span>"
                : "<span class='inline-block w-1.5 h-1.5 bg-gray-500 rounded-full mr-1.5'></span>";

            $rows[] = [
                'id'       => $order['id'],
                'folio'    => ['html' => "<span class='flex items-center'>{$shiftDot}{$Folio}</span>"],
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
                
                'dropdown'        => dropdownOrder($order['id'], $order['idStatus'], floatval($order['discount'] ?? 0), $order['subsidiaries_id'] ?? null),
            ];
        }

        return [
            'row'    => $rows,
            'orders' => $orders,
         $subsidiaries_id
        ];

    }

    // Listado ligero para el Reporte por tickets del order-visor: a diferencia de
    // listOrders() no arma HTML para createTable, solo orquesta getOrders() +
    // getTotalPaidByOrder() y devuelve JSON crudo por pedido. Es solo lectura
    // (no exige turno abierto ni valida canWriteOrder).
    public function listOrdersTicket() {
        $sessionSub = $_SESSION['SUB'];

        // Misma normalizacion que listOrders: "0" = todas las sucursales, sin
        // valor util cae a la sucursal de sesion.
        $postSub = $_POST['subsidiaries_id'] ?? null;
        $subsidiaries_id = ($postSub === null || $postSub === '' || $postSub === 'null' || $postSub === 'undefined')
            ? $sessionSub
            : $postSub;

        $orders = $this->getOrders([
            'fi'              => $_POST['fi'] ?? '',
            'ff'              => $_POST['ff'] ?? '',
            'subsidiaries_id' => $subsidiaries_id
        ]) ?? [];

        $rows = [];
        foreach ($orders as $order) {
            $discount    = $order['discount'] ?? 0;
            $total       = $order['total_pay'] ?? 0;
            $totalPagado = $this->getTotalPaidByOrder([$order['id']]);

            $rows[] = [
                'id'              => $order['id'],
                'folio'           => formatSucursal($order['subsidiaries_id'], $order['id']),
                'date_creation'   => $order['date_creation'],
                'date_order'      => $order['date_order'],
                'time_order'      => $order['time_order'],
                'name_client'     => $order['name_client'],
                'phone'           => $order['phone'],
                'status'          => (int) $order['idStatus'],
                'status_label'    => $order['status_label'],
                'total_pay'       => (float) $total,
                'discount'        => (float) $discount,
                'total_paid'      => (float) $totalPagado,
                'balance'         => (float) ($total - $discount - $totalPagado),
                'subsidiaries_id' => $order['subsidiaries_id'],
            ];
        }

        return [
            'status'  => 200,
            'message' => 'Pedidos obtenidos correctamente',
            'data'    => $rows
        ];
    }

    public function addOrder(){

        $client = $this->getClientName([$_POST['name']]);
        $folio = null;

        // La sucursal del pedido NO puede quedar vacia: si se inserta NULL el pedido
        // nace huerfano (no cae en ningun cierre ni corte de caja). Los roles con
        // selector en el formulario (admin 1, cajero 2, vendedor 3) la mandan por
        // POST; URLSearchParams puede enviar ''/'null'/'undefined' y "Todas las
        // sucursales" manda '0'. Sin valor util, el admin se corta antes de escribir
        // y cajero/vendedor caen a su sucursal de sesion (front viejo sin selector).
        if (in_array($_SESSION['ROLID'], [1, 2, 3, 6, 7])) {
            $postSub = $_POST['subsidiaries_id'] ?? null;
            $noSub   = ($postSub === null || $postSub === '' || $postSub === 'null'
                        || $postSub === 'undefined' || $postSub === '0' || $postSub === 0);
            $subsidiaries_id = $noSub
                ? ($_SESSION['ROLID'] == 1 ? null : $_SESSION['SUB'])
                : $postSub;
        } else {
            $subsidiaries_id = $_SESSION['SUB'];
        }

        if (empty($subsidiaries_id)) {
            return ['status' => 400, 'message' => 'Selecciona una sucursal específica antes de crear el pedido.'];
        }

        if (!is_array($client) || empty($client['id'])) {
            $data_client = $this->util->sql([
                'name'            => $_POST['name'],
                'phone'           => $_POST['phone'],
                'email'           => $_POST['email'],
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

       

        // Candado: no se puede crear un pedido si la sucursal no tiene un turno de
        // caja abierto ("sucursal abierta" = turno abierto). Sin turno el pedido
        // naceria huerfano (no cae en ningun cierre ni corte de caja). Se valida
        // aqui en el backend para que no se pueda evadir desde el front (estado
        // obsoleto, admin que cambio de sucursal, etc).
        $openShift = $this->getOpenShiftBySubsidiary([$subsidiaries_id]);
        if (!$openShift) {
            return [
                'status'  => 423,
                'message' => 'La sucursal no tiene un turno abierto. Abre el turno en "Cierre del día" antes de crear el pedido.'
            ];
        }
        $cash_shift_id = $openShift['id'];

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
            'subsidiaries_id' => $subsidiaries_id,
            'cash_shift_id'   => $cash_shift_id,
        ]);

        $insert = $this->createOrder($data);


        if ($insert) {

            $folio  = $this->getMaxOrder();

            $entrega = trim(($_POST['date_order'] ?? '') . ' ' . ($_POST['time_order'] ?? ''));
            $this->logOrderHistory($folio['id'], 'Pedido creado' . ($entrega !== '' ? " — entrega {$entrega}" : ''), 'creation');

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

        // Estado previo para la bitacora (diff antes -> despues). Se lee ANTES de tocar
        // cliente y pedido; getOrderID trae fecha/hora ya formateadas y el nombre/telefono
        // del cliente actual del pedido.
        $prevOrder = $this->getOrderID([$_POST['id']]);
        $prevOrder = is_array($prevOrder) && isset($prevOrder[0]) ? $prevOrder[0] : [];

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
        // La sucursal (subsidiaries_id) NO se reescribe en edición: queda fija
        // desde la creación del pedido para que un pedido no cambie de sucursal.
        $update = $this->updateOrder($this->util->sql([
            'date_order'      => $_POST['date_order'],
            'time_order'      => $_POST['time_order'],
            'note'            => $_POST['note'],
            'delivery_type'   => $_POST['delivery_type'],
            'client_id'       => $client_id,
            'id'              => $_POST['id'],
        ], 1));

        if ($update) {
            $status  = 200;
            $message = 'Pedido actualizado correctamente';
            $this->logOrderEditionDiff($prevOrder);
        }

        return [
            'status'  => $status,
            'message' => $message,
            'clients' => $statusQuery
        ];
    }

    // Registra en la bitacora los campos de cabecera que cambiaron en una edicion.
    // Compara el estado previo (getOrderID, con fecha/hora ya formateadas) contra el
    // $_POST entrante, normalizando fecha/hora al MISMO formato para no marcar como
    // cambio lo que solo difiere en representacion. No registra nada si nada cambio.
    private function logOrderEditionDiff($prev) {
        if (empty($prev)) return;

        $fmtDate = function ($ymd) {
            $d = DateTime::createFromFormat('Y-m-d', (string) $ymd);
            return $d ? $d->format('d/m/Y') : (string) $ymd;
        };
        $fmtTime = function ($hm) {
            $d = DateTime::createFromFormat('H:i', (string) $hm)
                ?: DateTime::createFromFormat('H:i:s', (string) $hm);
            return $d ? $d->format('h:i A') : (string) $hm;
        };
        $deliveryLabel = function ($v) {
            $map = ['0' => 'Local', '1' => 'A domicilio'];
            return isset($map[(string) $v]) ? $map[(string) $v] : "Tipo {$v}";
        };

        // [etiqueta, valor previo, valor nuevo] ya normalizados al mismo formato.
        $campos = [
            ['Cliente',  trim((string) ($prev['name']  ?? '')),          trim((string) ($_POST['name']  ?? ''))],
            ['Teléfono', trim((string) ($prev['phone'] ?? '')),          trim((string) ($_POST['phone'] ?? ''))],
            ['Entrega',  (string) ($prev['date_order'] ?? ''),           $fmtDate($_POST['date_order'] ?? '')],
            ['Hora',     (string) ($prev['time_order'] ?? ''),           $fmtTime($_POST['time_order'] ?? '')],
            ['Tipo',     $deliveryLabel($prev['delivery_type'] ?? ''),   $deliveryLabel($_POST['delivery_type'] ?? '')],
            ['Nota',     trim((string) ($prev['note'] ?? '')),           trim((string) ($_POST['note'] ?? ''))],
        ];

        $cambios = [];
        foreach ($campos as $c) {
            if ($c[1] !== $c[2]) {
                $antes   = $c[1] === '' ? '—' : $c[1];
                $despues = $c[2] === '' ? '—' : $c[2];
                $cambios[] = "{$c[0]}: {$antes} → {$despues}";
            }
        }

        if (!$cambios) return;

        $this->logHistory(implode(' · ', $cambios), 'edition', 'Pedido editado');
    }

    // Permite mutar un pedido si el usuario es admin, si el pedido pertenece a su
    // sucursal de sesion, o si es personal rotativo (cajero 2, vendedor 3) y la
    // sucursal del pedido tiene turno abierto: misma regla que el candado de
    // creacion, para que quien vende en otra sucursal tambien pueda operar ahi.
    private function canWriteOrder($orderId) {
        if (($_SESSION['ROLID'] ?? 0) == 1) return true;
        $o = $this->getOrderID([$orderId]);
        if (!isset($o[0]['subsidiaries_id'])) return false;
        if ($o[0]['subsidiaries_id'] == ($_SESSION['SUB'] ?? null)) return true;
        if (!in_array($_SESSION['ROLID'] ?? 0, [2, 3])) return false;
        return (bool) $this->getOpenShiftBySubsidiary([$o[0]['subsidiaries_id']]);
    }

    function cancelOrder(){
        if (!$this->canWriteOrder($_POST['id'] ?? null)) {
            return ['status' => 403, 'message' => 'Solo puedes operar pedidos de tu sucursal'];
        }

        $status  = 500;
        $message = 'Error al cancelar el evento.';

        $update = $this->updateOrder($this->util->sql($_POST, 1));

        if ($update) {
            $status  = 200;
            $message = 'Evento cancelado correctamente.';
            $this->logHistory('Pedido cancelado', 'cancellation');
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
            if (!$sucursal) {
                $sucursal = ['name' => '', 'sucursal' => 'SIN SUCURSAL'];
            }
            $folio = formatSucursal($subsidiaries_id, $orderData['id']);
            
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

            // Historial de pagos: cada abono con fecha/metodo/sucursal de cobro.
            // paymentMethods solo trae totales agrupados por metodo, no sirve como historial.
            $payments = $this->getListPayment([$orderId]);
            if (!is_array($payments)) {
                $payments = [];
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
                'payments'       => $payments,
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

            // Sucursal donde se cobra el pago (cobro cruzado): selector del modal
            // para admin; si no llega (cajero), se usa la sucursal de su sesion.
            $sucursalCobro = $_POST['payment_subsidiaries_id'] ?? null;
            if (empty($sucursalCobro)) {
                $sucursalCobro = $_SESSION['SUB'] ?? null;
            }

            $values_pay = [
                'pay'             => $pay,
                'date_pay'        => date('Y-m-d H:i:s'),
                'type'            => 2,
                'method_pay_id'   => $_POST['method_pay_id'],
                'description'     => $_POST['description'],
                'order_id'        => $id,
                'subsidiaries_id' => $sucursalCobro,
            ];

            $addPay = $this->addMethodPay($this->util->sql($values_pay));
        }

        // Actualizar id de formato.
        $values = $this->util->sql([
            'total_pay'     => $total_pay,
            'type_id'       => $type_id,
            'status'        => $type_id,
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

         $folio    = formatSucursal($SUB, $ls[0]['folio']);
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

            // Sucursal donde se cobro el pago. Si difiere de la del pedido es cobro cruzado.
            $subName   = $key['subsidiary_name'] ?? '—';
            $esCruzado = !empty($key['subsidiaries_id']) && $key['subsidiaries_id'] != $key['order_subsidiary_id'];
            $subBadge  = $esCruzado
                ? '<span class="px-2 py-0.5 rounded bg-amber-900/40 text-amber-300 text-xs" title="Cobrado en sucursal distinta a la del pedido"><i class="icon-exchange"></i> ' . $subName . '</span>'
                : '<span class="px-2 py-0.5 rounded bg-slate-700 text-gray-200 text-xs">' . $subName . '</span>';

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

                'Sucursal' => [
                    'html' => $subBadge,
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

    // Wrapper de logOrderHistory (mdl-pedidos) para las llamadas existentes que
    // toman el pedido de $_POST['id'].
    function logHistory($message, $type = 'general', $title = 'Registro de actividad') {
        return $this->logOrderHistory($_POST['id'] ?? null, $message, $type, $title);
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

        if (!$this->canWriteOrder($id)) {
            return [
                'status'  => 403,
                'message' => 'Solo puedes operar pedidos de tu sucursal'
            ];
        }

        $order = $this->getOrderID([$id]);
        
            
        $update = $this->updateOrderDeliveryStatus([
            'id' => $id,
            'is_delivered' => $is_delivered
        ]);
        
        if ($update) {
            $status     = 200;
            // is_delivered tiene 3 estados: 0 = no entregado, 1 = entregado, 2 = para
            // producir (ver handleDeliveryClick en app.js).
            $deliveryLabels = [0 => 'no entregado', 1 => 'entregado', 2 => 'para producir'];
            $statusText = $deliveryLabels[(int) $is_delivered] ?? "estado {$is_delivered}";
            $message    = "El pedido fue marcado como {$statusText}";
            // Bitacora: queda registrado quien marco la entrega y cuando (logHistory
            // toma el id de $_POST['id'], ya presente en este request).
            $this->logHistory("Pedido marcado como {$statusText}", 'delivery', 'Entrega');
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

    // =============================================
    // Cash Shift (Turnos)
    // =============================================

    function openShift() {
        // Roles con filtro de navbar (admin 1, cajero 2, vendedor 3) operan turno/cierre
        // sobre la sucursal seleccionada en el modal; si no llega una util, usan su sesion.
        if (in_array($_SESSION['ROLID'], [1, 2, 3, 6, 7])) {
            $postSub = $_POST['subsidiaries_id'] ?? null;
            $subsidiaries_id = ($postSub !== null && $postSub !== '' && $postSub != '0')
                ? $postSub
                : $_SESSION['SUB'];
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

        // El turno siempre nace hoy (opened_at = NOW): no hay forma de abrir turnos
        // de dias pasados. Por eso basta verificar el cierre de HOY: si el dia ya se
        // cerro, los pedidos del turno nuevo quedarian fuera del corte Z (addCierre
        // ya no vuelve a correr para esa fecha y nacerian sin daily_closure_id).
        $today   = date('Y-m-d');
        $closure = $this->getDailyClosureByClosureDate([$today, $subsidiaries_id]);
        if ($closure) {
            return [
                'status'  => 423,
                'message' => 'El día de hoy ya fue cerrado en esta sucursal por ' . ($closure['closed_by_name'] ?: 'un administrador') . '. Un administrador debe reabrir el cierre antes de abrir un turno nuevo.'
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
        $metrics = $this->getShiftSalesMetrics([$shift_id, $opened_at, $closed_at, $subsidiary_id]);

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
        // Roles con filtro de navbar (admin 1, cajero 2, vendedor 3) operan turno/cierre
        // sobre la sucursal seleccionada en el modal; si no llega una util, usan su sesion.
        if (in_array($_SESSION['ROLID'], [1, 2, 3, 6, 7])) {
            $postSub = $_POST['subsidiaries_id'] ?? null;
            $subsidiaries_id = ($postSub !== null && $postSub !== '' && $postSub != '0')
                ? $postSub
                : $_SESSION['SUB'];
        } else {
            $subsidiaries_id = $_SESSION['SUB'];
        }

        $date = $_POST['date'] ?? date('Y-m-d');
        $shifts = $this->getShiftsBySubsidiaryDate([$date, $subsidiaries_id]);
        $shifts = is_array($shifts) ? $shifts : [];

        // Los turnos abiertos aun no tienen total_sales/cash/card/transfer guardados
        // (se calculan al cerrar); se rellenan en tiempo real con la MISMA logica del
        // ticket (getShiftMetrics) para que las listas cuadren con el TOTAL CAJA.
        $now = date('Y-m-d H:i:s');
        foreach ($shifts as &$s) {
            if ($s['status'] === 'open') {
                $m = $this->getShiftSalesMetrics([$s['id'], $s['opened_at'], $now, $s['subsidiary_id']]);
                $s['total_sales']  = $m['total_sales'];
                $s['cash']         = $m['cash_sales'];
                $s['card']         = $m['card_sales'];
                $s['transfer']     = $m['transfer_sales'];
                $s['total_orders'] = $m['total_orders'];
            }
        }
        unset($s);

        return [
            'status' => 200,
            'shifts' => $shifts
        ];
    }

    function getOpenShifts() {
        // Roles con filtro de navbar (admin 1, cajero 2, vendedor 3) operan turno/cierre
        // sobre la sucursal seleccionada en el modal; si no llega una util, usan su sesion.
        if (in_array($_SESSION['ROLID'], [1, 2, 3, 6, 7])) {
            $postSub = $_POST['subsidiaries_id'] ?? null;
            $subsidiaries_id = ($postSub !== null && $postSub !== '' && $postSub != '0')
                ? $postSub
                : $_SESSION['SUB'];
        } else {
            $subsidiaries_id = $_SESSION['SUB'];
        }

        $shifts = $this->getAllOpenShiftsBySubsidiary([$subsidiaries_id]);

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
        $company_name    = ($subsidiary && isset($subsidiary['name']))     ? $subsidiary['name']     : '';
        $subsidiary_name = ($subsidiary && isset($subsidiary['sucursal'])) ? $subsidiary['sucursal'] : 'Sucursal';

        if ($shift['status'] === 'closed') {
            // Obtener conteos de status guardados
            $statusCounts = $this->getShiftStatusCounts([$shift_id]);
            $quotation_count = 0; $pending_count = 0; $cancelled_count = 0;
            foreach ($statusCounts as $sc) {
                switch ($sc['status_process_id']) {
                    case 1: $quotation_count = intval($sc['amount']); break;
                    case 2: $pending_count   = intval($sc['amount']); break;
                    case 4: $cancelled_count = intval($sc['amount']); break;
                }
            }

            // Pedidos de turnos anteriores cobrados durante este turno
            $closed_at = $shift['closed_at'];
            $prev = $this->getShiftPrevPaymentsSummary([$closed_at, $shift['opened_at'], $closed_at, $shift_id, $subsidiary_id]);

            return [
                'status'          => 200,
                'shift'           => $shift,
                'subsidiary_name' => $subsidiary_name,
                'company_name'    => $company_name,
                'logo'            => $_SESSION['LOGO'],
                'data' => [
                    'total_sales'     => $shift['total_sales'],
                    'cash_sales'      => $shift['cash'],
                    'card_sales'      => $shift['card'],
                    'transfer_sales'  => $shift['transfer'],
                    'total_orders'    => $shift['total_orders'],
                    'quotation_count' => $quotation_count,
                    'pending_count'   => $pending_count,
                    'cancelled_count' => $cancelled_count,
                    'prev_count'      => intval($prev['prev_count']),
                    'prev_paid'       => intval($prev['prev_paid']),
                    'prev_pending'    => intval($prev['prev_pending'])
                ]
            ];
        }

        // Turno abierto: calcular en tiempo real
        $opened_at = $shift['opened_at'];
        $now = date('Y-m-d H:i:s');
        $metrics = $this->getShiftSalesMetrics([$shift_id, $opened_at, $now, $subsidiary_id]);

        // Pedidos de turnos anteriores cobrados durante este turno
        $prev = $this->getShiftPrevPaymentsSummary([$now, $opened_at, $now, $shift_id, $subsidiary_id]);
        $metrics['prev_count']   = intval($prev['prev_count']);
        $metrics['prev_paid']    = intval($prev['prev_paid']);
        $metrics['prev_pending'] = intval($prev['prev_pending']);

        return [
            'status'          => 200,
            'shift'           => $shift,
            'subsidiary_name' => $subsidiary_name,
            'company_name'    => $company_name,
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

        $opened_at     = $shift['opened_at'];
        $closed_at     = $shift['status'] === 'closed' ? $shift['closed_at'] : date('Y-m-d H:i:s');
        $subsidiary_id = $shift['subsidiary_id'];

        $result = $this->getShiftDetailedOrders([$shift_id, $opened_at, $closed_at, $subsidiary_id]);

        $addFolio = function ($order) use ($subsidiary_id) {
            $order['folio'] = formatSucursal($subsidiary_id, $order['id']);
            return $order;
        };

        // El sufijo del folio identifica la sucursal de origen del pedido. En un cobro
        // cruzado el pedido es de otra sucursal, asi que conserva su origen y no la del cierre.
        $addFolioOrigin = function ($order) use ($subsidiary_id) {
            $originSub = isset($order['origin_subsidiary_id']) && $order['origin_subsidiary_id'] !== null
                ? $order['origin_subsidiary_id']
                : $subsidiary_id;
            $order['folio'] = formatSucursal($originSub, $order['id']);
            return $order;
        };

        $shiftOrders      = array_map($addFolio, $result['shift_orders']);
        $externalPayments = array_map($addFolioOrigin, $result['external_payments']);
        // Grupo 3: pedidos de este turno cobrados en otra sucursal. El pedido es de esta
        // sucursal (su folio usa $subsidiary_id), lo que cambia es dónde se cobró.
        $crossPayments    = array_map($addFolio, $result['cross_payments']);

        return [
            'status'            => 200,
            'orders'            => $shiftOrders,
            'external_payments' => $externalPayments,
            'cross_payments'    => $crossPayments
        ];
    }

    function checkOpenShift() {
        // Roles con filtro de navbar (admin 1, cajero 2, vendedor 3) operan turno/cierre
        // sobre la sucursal seleccionada en el modal; si no llega una util, usan su sesion.
        if (in_array($_SESSION['ROLID'], [1, 2, 3, 6, 7])) {
            $postSub = $_POST['subsidiaries_id'] ?? null;
            $subsidiaries_id = ($postSub !== null && $postSub !== '' && $postSub != '0')
                ? $postSub
                : $_SESSION['SUB'];
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

        if (!$this->canWriteOrder($_POST['id'] ?? null)) {
            return [
                'status'  => 403,
                'message' => 'Solo puedes operar pedidos de tu sucursal'
            ];
        }

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
        if (!$this->canWriteOrder($_POST['id'] ?? null)) {
            return [
                'status'  => 403,
                'message' => 'Solo puedes operar pedidos de tu sucursal'
            ];
        }

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
function dropdownOrder($id, $status, $discount = 0, $orderSub = null) {
    $instancia = 'app';
    $impresion = 'payment';
    $rolId     = $_SESSION['ROLID'] ?? 0;
    $owner     = $_SESSION['OWNER'] ?? 0;
    $hasDiscount = $discount > 0;

    // Cajero/no-admin viendo un pedido de OTRA sucursal (filtro de vista): solo lectura.
    // Sin acciones de mutacion (cancelar, descuentos, editar, pagar).
    if ($rolId != 1 && $orderSub !== null && $orderSub != ($_SESSION['SUB'] ?? null)) {
        return array_map(fn($opt) => [
            'text'    => $opt[0],
            'icon'    => $opt[1],
            'onclick' => $opt[2],
        ], [
            ['Ver', 'icon-eye', "{$instancia}.showOrder({$id})"],
            ['Imprimir', 'icon-print', "{$instancia}.printOrder({$id})"],
        ]);
    }

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

        if ($rolId == 1 || $owner == 1) {
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



function formatSucursal($subsidiariesId = null, $numero = null){

    $sucursal = ($subsidiariesId === null || $subsidiariesId === '') ? 'X' : str_pad($subsidiariesId, 2, '0', STR_PAD_LEFT);

    $number = $numero ?? rand(1, 99);

    return 'P' . $number . '-' . $sucursal;
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

