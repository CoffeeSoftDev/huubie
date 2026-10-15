<?php
session_start();
if (empty($_POST['opc'])) exit(0);


header("Access-Control-Allow-Origin: *"); // Permite solicitudes de cualquier origen
header("Access-Control-Allow-Methods: GET, POST, OPTIONS"); // Métodos permitidos
header("Access-Control-Allow-Headers: Content-Type"); // Encabezados permitidos

require_once '../mdl/mdl-pedidos.php';
require_once '../../conf/_Message.php';

class ctrl extends MPedidos{

    const ROL_PRODUCCION = 8;

    function init(){

        $orderResult = $this->getOrderID([$_POST['id']]);
        $order = is_array($orderResult) && !empty($orderResult) ? $orderResult[0] : null;

        if ($order) {
            $order['folio'] = formatFolio($order['subsidiaries_id'], $order['id']);
        }

        $orderProducts = $this->getOrderById([$_POST['id']]);
        if (!is_array($orderProducts)) {
            $orderProducts = [];
        }

        $payments = $this->getListPayment([$_POST['id']]);
        $totalPaid = $this->getTotalPaidByOrder([$_POST['id']]);

        return [
            'modifier'   => $this->getCategory(),
            'products'   => $this->lsProductos([1, $_SESSION['SUB']]),
            'id'         => $_POST['id'],
            'list'       => $orderProducts,
            'order'      => $order ?? ['id' => $_POST['id']],
            'payments'   => $payments,
            'total_paid' => $totalPaid,
            // El panel del ticket lo usa para decidir si ofrece la baja de una linea
            // bloqueada. Es solo la pista visual: quien autoriza es removeProduct().
            'rolId'      => $_SESSION['ROLID'] ?? 0
        ];
    }

    function getModificador(){

        $ls = $this->getAllModifiers([1]);
        $__row = [];

        $__row[] =[
            'id'     => 0,
            'text'   => 'Pastel',
            'active' => 'true'
        ];

        foreach ($ls as $key ) {

            $__row[] = [
                'id'   =>  $key['id'],
                'text' =>  $key['text'],
            ];

        }

        return $__row;


    }

    function getCategory(){

        $ls = $this->getAllCategory([1]);
        $__row = [];

        $totalGeneral = array_sum(array_map(function ($c) {
            return intval($c['total'] ?? 0);
        }, $ls));

        $__row[] =[
            'id'     => 0,
            'text'   => 'Todos los Productos',
            'total'  => $totalGeneral,
            'active' => 'true'
        ];

        foreach ($ls as $key ) {

            $__row[] = [
                'id'    =>  $key['id'],
                'text'  =>  $key['text'],
                'total' =>  intval($key['total'] ?? 0),
            ];

        }

        return $__row;


    }

    // Products.
    function lsProducto() {
        $__row = [];
        if ($_POST['id'] == 0) {
             $ls = $this->lsProductos([1, $_SESSION['SUB']]);
        }else{
            $ls = $this->listProductsById([$_POST['id'], $_SESSION['SUB']]);
        }

        foreach ($ls as $key) {
            $__row[] = [
                'id'    => $key['id'],
                'valor'  => $key['valor'],
                'price' => $key['price'],
                'image' => $key['image'],
                'desc'  => $key['description'],
                'opc'   => 0
            ];
        }

        return [
            'id' => $ls,
            'products'=>   $__row
        ];
    }

    function getProduct() {
            $status = 500;
            $message = 'Error al obtener los datos';
            $images = [];
            $getProduct = $this->getOrderPackageByID([$_POST['id']]);

            if ($getProduct) {
                $status = 200;
                $message = 'Datos obtenidos correctamente.';
                $images = $this->getOrderImages([$getProduct['id']]);
            }

            return [
                'status'  => $status,
                'message' => $message,
                'data'    => $getProduct,
                'images'  => $images,
            ];
    }

    function getProductDetails() {
        $id = $_POST['id'];
        $status = 404;
        $message = 'Producto no encontrado';
        $data = null;

        $product = $this->getProductById($id);
        
        if ($product) {
            $status = 200;
            $message = 'Producto encontrado';
            $data = $product;
        }

        return [
            'status' => $status,
            'message' => $message,
            'data' => $data
        ];
    }

    function addProduct() {
        $status  = 500;
        $message = 'No se pudo agregar el producto';

        $_POST['date_creation'] = date('Y-m-d H:i:s');
        $_POST['status']        = 1;

        $create = $this->createProduct($this->util->sql($_POST));

        if ($create) {
            $status  = 200;
            $message = 'Producto agregado correctamente';
            
            // Actualizar el total de la orden
            $this->updateTotalOrder($_POST['pedidos_id']);
        }

        $orderProducts = $this->getOrderById([$_POST['pedidos_id']]);
        if (!is_array($orderProducts)) {
            $orderProducts = [];
        }

        return [
            'status'  => $status,
            'message' => $message,
            'list'    => $orderProducts
        ];

    }

    function editProduct() {
        $status  = 500;
        $message = 'Error al editar producto';
        $company = $_SESSION['COMPANY'] ?? 'coffee';
        $sub     = $_SESSION['SUB'] ?? '1';

        // images.
        $ruta    = 'alpha_files/' .$company. '/' . $sub . '/order/images/';
        $oldFile = $_SERVER['DOCUMENT_ROOT'] . '/' . $ruta;

        if (!file_exists($oldFile)) {
            mkdir($oldFile, 0777, true);
        }

        $image = [];

        if (!empty($_FILES['archivos']['name'][0])) {

            $this->removeOrderImages([$_POST['id']]);

            foreach ($_FILES['archivos']['name'] as $i => $nombreOriginal) {
                if ($_FILES['archivos']['error'][$i] === UPLOAD_ERR_OK) {

                    $temporal    = $_FILES['archivos']['tmp_name'][$i];
                    $ext         = pathinfo($nombreOriginal, PATHINFO_EXTENSION);
                    $nuevoNombre = substr(md5(uniqid('', true)), 0, 8) . '.' . strtolower($ext);
                    $destino     = $oldFile . $nuevoNombre;

                    if (move_uploaded_file($temporal, $destino)) {


                        $this->addOrderImages($this->util->sql([
                            'path'          => $ruta.$nuevoNombre,
                            'name'          => $nuevoNombre,
                            'original_name' => $nombreOriginal,
                            'date_created'  => date('Y-m-d H:i:s'),
                            'package_id'    => $_POST['id']
                        ]));



                    }
                }
            }

        }


        $edit = $this->updatePackage($this->util->sql([
            'dedication'    => $_POST['dedication'],
            'order_details' => $_POST['order_details'],
            'id'            => $_POST['id'],
        ], 1));



        if ($edit) {
            $status  = 200;
            $message = 'Producto editado correctamente';
        }

        $orderProducts = $this->getOrderById([$_POST['idFolio']]);
        if (!is_array($orderProducts)) {
            $orderProducts = [];
        }

        return [
            'status'  => $status,
            'message' => $message,
            'files'   => $image,
            'list'    => $orderProducts
        ];
    }

    function quantityProduct() {
        $status = 500;
        $message = 'No se pudo actualizar la cantidad del producto';

        $id         = $_POST['id'];
        $quantity   = intval($_POST['quantity']);
        $pedidos_id = $_POST['pedidos_id'];

        // Estado previo del producto (nombre, precio unitario y cantidad) ANTES de
        // actualizar, para registrar en la bitacora el impacto en el precio de linea.
        $prevProd = null;
        foreach ((array) $this->getOrderById([$pedidos_id]) as $p) {
            if ($p['id'] == $id) { $prevProd = $p; break; }
        }

        // Validar que la cantidad sea mayor a 0
        if ($quantity <= 0) {
            $status = 400;
            $message = 'La cantidad debe ser mayor a 0';
        } else {
            $values = $this->util->sql([
                'quantity' => $quantity,
                'id' => $id
            ], 1);

            $update = $this->updatePackage($values);

            if ($update) {
                $status = 200;
                $message = 'Cantidad actualizada correctamente';

                // Actualizar el total de la orden
                $this->updateTotalOrder($pedidos_id);

                // Bitacora: el cambio de cantidad sube o baja el precio de linea. Solo
                // en EDICION; al armar un pedido nuevo (isEdit=0) no se registra.
                if (!empty($_POST['isEdit']) && $prevProd) {
                    $prevQty   = intval($prevProd['quantity'] ?? 0);
                    $unit      = floatval($prevProd['price'] ?? 0);
                    $prevTotal = $unit * $prevQty;
                    $newTotal  = $unit * $quantity;
                    if ($prevQty !== $quantity) {
                        $title = $newTotal >= $prevTotal ? 'Aumento de precio' : 'Reducción de precio';
                        $msg   = "{$prevProd['name']}: {$prevQty} » {$quantity} uds ("
                               . evaluar($prevTotal) . ' » ' . evaluar($newTotal) . ')';
                        $this->logOrderHistory($pedidos_id, $msg, 'price', $title);
                    }
                }
            }
        }

        $orderProducts = $this->getOrderById([$pedidos_id]);
        if (!is_array($orderProducts)) {
            $orderProducts = [];
        }

        return [
            'status' => $status,
            'message' => $message,
            'list' => $orderProducts
        ];
    }

    function removeProduct() {

        $status     = 500;
        $message    = 'No se pudo eliminar el producto del pedido';
        $pedidos_id = $_POST['pedidos_id'] ?? null;
        $motivo     = trim($_POST['reason'] ?? '');

        if (empty($pedidos_id)) {
            return [
                'status'  => 400,
                'message' => 'Falta el pedido al que pertenece la partida.'
            ];
        }

        // La linea se lee ANTES de borrarla: de ahi salen el nombre y el precio para
        // la bitacora, y el is_today que decide si la baja necesita autorizacion.
        $lineas = (array) $this->getOrderById([$pedidos_id]);
        $linea  = null;

        foreach ($lineas as $p) {
            if ($p['id'] == $_POST['id']) {
                $linea = $p;
                break;
            }
        }

        if (!$linea) {
            return [
                'status'  => 404,
                'message' => 'La partida no pertenece a este pedido.'
            ];
        }

        $orderResult = $this->getOrderID([$pedidos_id]);
        $order       = is_array($orderResult) && !empty($orderResult) ? $orderResult[0] : [];

        $denegado = $this->removeLineDenial($pedidos_id, $order, $linea, $lineas, $motivo);

        if ($denegado) return $denegado;

        $productName  = $linea['name'];
        $productPrice = $linea['price'];

        $values = $this->util->sql([
            'id' => $_POST['id']
        ], 1);

        $delete = $this->deleteProduct($values);

        if ($delete) {
            $status = 200;
            $message = 'Producto eliminado del pedido correctamente';

            // Actualizar el total de la orden
            $this->updateTotalOrder($pedidos_id);

            // Solo se registra en la bitacora si es EDICION de un pedido existente.
            // Al crear (armado inicial en el catalogo) no se loguea cada producto: el
            // front manda isEdit=0 y el resumen se registra al crear el pedido.
            // La baja autorizada (con motivo) se registra siempre: es el unico rastro
            // de que alguien quito una partida que el armado normal ya no tocaba.
            if (!empty($_POST['isEdit']) || $motivo !== '') {
                $etiqueta = $productName !== null ? $productName : '#' . $_POST['id'];
                $detalle  = "Se eliminó el producto {$etiqueta} (" . evaluar($productPrice) . ')';

                if ($motivo !== '') $detalle .= " — Motivo: {$motivo}";

                $this->logOrderHistory($pedidos_id, $detalle, 'edition');
            }
        }

        return [
            'status'  => $status,
            'message' => $message,
            // La baja autorizada no toca la lista del panel al pulsar (puede negarse),
            // asi que el ticket se repinta con lo que quedo realmente en el pedido.
            'list'    => $this->getOrderById([$pedidos_id])
        ];
    }

    // Dos reglas distintas sobre la misma baja: quien puede pedirla, y si el pedido
    // aguanta perderla. Devuelve null cuando la eliminacion procede.
    private function removeLineDenial($pedidos_id, $order, $linea, $lineas, $motivo) {

        // Linea que el armado normal ya no toca (de un dia anterior, o de un pedido
        // liquidado): dejar de ser correccion de captura y pasa a ser autorizacion.
        $bloqueada = ($order['status'] ?? 0) == 3 || empty($linea['is_today']);

        if ($bloqueada) {
            if (!in_array($_SESSION['ROLID'] ?? 0, [1, 6])) {
                return [
                    'status'  => 403,
                    'message' => 'Solo un administrador o un supervisor puede eliminar esta partida.'
                ];
            }

            if (mb_strlen($motivo) < 5) {
                return [
                    'status'  => 400,
                    'message' => 'Escribe el motivo de la eliminación (mínimo 5 caracteres).'
                ];
            }
        }

        $pagado = floatval($this->getTotalPaidByOrder([$pedidos_id]));

        if ($pagado <= 0) return null;

        // Con dinero cobrado la baja deja de ser un permiso del rol: solo procede
        // sobre la linea repetida, que es el rastro de la doble captura. Cualquier
        // otra correccion pasa por cancelar el folio y generar uno nuevo.
        if (empty($linea['is_repeated'])) {
            return [
                'status'  => 409,
                'message' => 'Esta partida no se puede eliminar. Si hay que corregir el pedido, cancela el folio y genera uno nuevo.'
            ];
        }

        // El pedido no puede valer menos de lo ya cobrado: quedaria un saldo a favor
        // sin respaldo y el corte no cuadraria contra el detalle.
        $restante = -floatval($order['discount'] ?? 0);

        foreach ($lineas as $p) {
            if ($p['id'] == $linea['id']) continue;
            $restante += floatval($p['price'] ?? 0) * intval($p['quantity'] ?? 0);
        }

        if ($restante < $pagado) {
            return [
                'status'  => 409,
                'message' => 'El pedido quedaría en ' . evaluar($restante) . ' y ya tiene '
                           . evaluar($pagado) . ' cobrados. Devuelve o reasigna el abono antes de quitar esta partida.'
            ];
        }

        return null;
    }

    function deleteAllProducts() {
        $status  = 500;
        $message = 'No se pudo eliminar el producto';
        $pedidos_id = $_POST['pedidos_id'];

        $values = $this->util->sql([
            'pedidos_id' => $pedidos_id
        ], 1);

        $delete = $this->deleteProduct($values);

        if ($delete) {
            $status  = 200;
            $message = 'Se eliminaron todos los productos del pedido correctamente.';

            // Actualizar el total de la orden (será 0 si no hay productos)
            $this->updateTotalOrder($pedidos_id);

            if (!empty($_POST['isEdit'])) {
                $this->logOrderHistory($pedidos_id, 'Se eliminaron todos los productos del pedido', 'edition');
            }
        }

        $orderProducts = $this->getOrderById([$pedidos_id]);
        if (!is_array($orderProducts)) {
            $orderProducts = [];
        }

        return [
            'status'  => $status,
            'message' => $message,
            'list'    => $orderProducts
        ];
    }

    function lsProductOrderPackage() {
        $__row = [];
        $ls = $this->getOrderById([$_POST['id']]);

        // Validar que ls sea un array válido
        if (is_array($ls)) {
            foreach ($ls as $key) {
                $__row[] = [
                    'id'    => $key['id'],
                    'name'  => $key['name'],
                    'price' => evaluar($key['price']),
                    'desc'  => $key['description'],
                    'opc'   => 0
                ];
            }
        }

        return ['row' => $__row];
    }

    // Candado de turno para cobrar. Aqui el pago se inserta sin sucursal propia, asi
    // que el dinero cae en la sucursal del pedido (COALESCE del cierre): es ahi donde
    // debe haber turno abierto de hoy. Mismo criterio que ctrl-pedidos.php::addPayment.
    private function cobroShiftGuard($orderId) {
        $order = $this->getOrderID([$orderId]);
        $subId = $order[0]['subsidiaries_id'] ?? null;

        if (empty($subId)) {
            return [
                'status'  => 403,
                'message' => 'No se pudo determinar la sucursal que cobra el pago.'
            ];
        }

        $sucursal = $this->getSucursalByID([$subId]);
        $nombre   = $sucursal['sucursal'] ?? "sucursal {$subId}";
        $shift    = $this->getOpenShiftBySubsidiary([$subId]);

        if (empty($shift)) {
            return [
                'status'  => 403,
                'message' => "La sucursal {$nombre} no tiene turno abierto. Debe abrir su turno de caja para registrar este pago."
            ];
        }

        if (!empty($shift['opened_at']) && date('Y-m-d', strtotime($shift['opened_at'])) !== date('Y-m-d')) {
            $fecha = date('d/m/Y', strtotime($shift['opened_at']));
            return [
                'status'  => 403,
                'message' => "La sucursal {$nombre} tiene un turno del {$fecha} sin cerrar. Debe cerrarlo y abrir el turno de hoy para registrar este pago."
            ];
        }

        return null;
    }

    // Doble clic en "Aceptar" del cobro: la segunda peticion trae el mismo pago segundos
    // despues y se guardaba dos veces (pedido 1417: dos abonos de $350 en el mismo
    // segundo, quedo como Pagado). Mismo candado que ctrl-pedidos.php::addPayment.
    private function duplicatePaymentGuard($orderId, $pay) {
        $metodo = ($_POST['method_pay_id'] ?? '') === '' ? null : $_POST['method_pay_id'];
        $desde  = date('Y-m-d H:i:s', time() - 10);

        if (!$this->getRecentPayment([$orderId, $pay, $metodo, $desde])) return null;

        return [
            'status'  => 409,
            'message' => 'Este pago ya se registró hace unos segundos y no se duplicó. Si es otro pago por el mismo importe, espera unos segundos y vuelve a registrarlo.'
        ];
    }

    // payment.
    function addPayment() {

        $status  = 500;
        $message = 'No se pudo registrar el pago';

        $id        = $_POST['id'];
        $pay       = floatval($_POST['advanced_pay'] ?? 0);
        $total_pay = floatval($_POST['total'] ?? 0);
        $discount  = floatval($_POST['discount'] ?? 0);
        $target    = intval($_POST['target_status'] ?? 0);

        // Sin turno abierto en la sucursal donde cae el dinero el abono quedaria
        // fuera de todo corte. El guardado SIN cobro si pasa (cotizacion/pendiente).
        if ($pay > 0) {
            $guard = $this->cobroShiftGuard($id);
            if ($guard) return $guard;

            $duplicado = $this->duplicatePaymentGuard($id, $pay);
            if ($duplicado) return $duplicado;
        }

        // Estado previo del pedido para la bitacora (antes -> despues).
        $prev    = $this->getOrderID([$id]);
        $prevRow = (is_array($prev) && !empty($prev)) ? $prev[0] : null;

        // OJO: no reescribir date_creation aqui. Este update corre en cada pago o
        // confirmacion y pisaba la fecha del pedido con la del dia, "mudando" el
        // pedido de corte (mismo pisado que se quito de ctrl-pedidos.php en c3a5622).
        $post = [
            'total_pay' => $total_pay,
            'discount'  => $discount,
            'id'        => $id
        ];

        $values = $this->util->sql($post, 1);
        $insert = $this->updateOrder($values);

        if ($pay > 0) {
            $values_pay = [
                'pay'           => $pay,
                'date_pay'      => date('Y-m-d H:i:s'),
                'type'          => 2,
                'method_pay_id' => $_POST['method_pay_id'] ?? null,
                'order_id'      => $id,
            ];

            $addPay = $this->addMethodPay($this->util->sql($values_pay));

        }

        // El estado se decide hasta aqui, con el pago ya escrito: contra el total que
        // updateTotalOrder recalcula de las lineas y la suma real de order_payments.
        // El 'saldo' que mandaba el front sale del texto en pantalla, y con el panel
        // desincronizado (una linea ya en la BD sin pintar) marcaba Pagado un pedido
        // con saldo vivo: pedidos 493 y 958, cobrados por la mitad de su total.
        $totalReal = $this->updateTotalOrder($id);
        $paidReal  = $this->getTotalPaidByOrder([$id]);
        $neto      = $totalReal - $discount;

        if ($paidReal <= 0) {
            $type_id = ($target === 2) ? 2 : 1;
        } else {
            $type_id = ($paidReal >= $neto - 0.005) ? 3 : 2;
        }

        $this->updateOrder($this->util->sql([
            'type_id' => $type_id,
            'status'  => $type_id,
            'id'      => $id
        ], 1));

        // La respuesta y la bitacora reportan el total que quedo guardado, no el que
        // venia del front.
        $total_pay          = $totalReal;
        $post['total_pay']  = $totalReal;
        $post['type_id']    = $type_id;
        $post['status']     = $type_id;

        if ($insert) {
            $status  = 200;
            $message = 'Pago registrado correctamente';

            // Bitacora: el guardado SIN cobro tambien deja rastro (la operacion que
            // fue invisible en el caso del pedido 774; ver docs/estrategia-bitacora.md).
            if ($pay > 0) {
                $methodNames = [1 => 'Efectivo', 2 => 'Tarjeta', 3 => 'Transferencia'];
                $methodName  = $methodNames[intval($_POST['method_pay_id'] ?? 0)] ?? 'Otro método';
                $this->logOrderHistory($id, 'Se registró un pago de ' . evaluar($pay) . " ({$methodName})", 'payment');
            } else {
                $labels      = [1 => 'Cotización', 2 => 'Pendiente', 3 => 'Pagado'];
                $targetLabel = $labels[$type_id] ?? 'Pendiente';
                // Nº de productos del pedido, para el resumen junto al total.
                $n = count((array) $this->getOrderById([$id]));
                $msg = "Pedido guardado como {$targetLabel} sin cobro — total " . evaluar($total_pay)
                     . ", {$n} producto" . ($n === 1 ? '' : 's');
                // El descuento se INDICA explicitamente (con el neto), no se resta en silencio.
                if ($discount > 0) {
                    $msg .= '. Descuento ' . evaluar($discount) . ', neto ' . evaluar($total_pay - $discount);
                }
                // Diff de total respecto al estado previo (util al re-guardar una edicion).
                if ($prevRow && floatval($prevRow['total_pay']) != $total_pay) {
                    $msg .= ' (total ' . evaluar($prevRow['total_pay']) . ' » ' . evaluar($total_pay) . ')';
                }
                $this->logOrderHistory($id, $msg, 'edition');
            }
        }

        return [
            'status'     => $status,
            'message'    => $message,
            'data'       => $post,
            'total_pay'  => $total_pay
        ];
    }


    // Aviso de WhatsApp del pedido (normal o personalizado) a los destinatarios de
    // Admin > WhatsApp. El front lo llama al terminar el pedido (un liquidado no pasa
    // por Terminar y no avisa). La primera vez sale "Pedidos"; despues, si algo cambio
    // desde el ultimo aviso, sale "Pedido editado" con los cambios. Sin cambios no sale.
    function addOrderNotice() {
        $orderId = $_POST['id'];
        $order   = $this->getOrderID([$orderId])[0] ?? null;
        $branch  = $order ? $this->getSucursalByID([$order['subsidiaries_id']]) : null;

        if (!$order || !$branch || $branch['idCompany'] != $_SESSION['COMPANY_ID']) {
            return [
                'status'  => 404,
                'message' => 'El pedido no existe o no es de tu empresa.'
            ];
        }

        $lines = (array) $this->getOrderById([$orderId]);

        if (empty($lines)) {
            return [
                'status'  => 200,
                'message' => 'El pedido no lleva productos',
                'data'    => ['enviados' => 0, 'fallidos' => 0]
            ];
        }

        // Cada envio tarda unos segundos: se suelta la sesion para no frenar las
        // demas peticiones del cajero mientras sale el aviso.
        session_write_close();

        $folio     = formatFolio($order['subsidiaries_id'], $order['id']);
        $reference = "Pedido #{$folio}";

        // Mismo neto que addPayment: total de las lineas menos el descuento.
        $total = floatval($order['total_pay']) - floatval($order['discount']);
        $paid  = $this->getTotalPaidByOrder([$orderId]);

        // Solo las fotos de los pasteles personalizados viajan como imagen.
        $photos = $this->orderNoticePhotos($lines);

        // Los datos nuevos van al final: los avisos ya guardados se comparan por los
        // que tienen en comun (ver abajo).
        $snapshot  = [
            'fecha'      => (string) $order['date_order'],
            'hora'       => (string) $order['time_order'],
            'cliente'    => oneLine($order['name']),
            'telefono'   => oneLine($order['phone']),
            'estatus'    => orderStatusText($order['status']),
            'productos'  => $this->orderNoticeProducts($lines),
            'total'      => noticeMoney($total),
            'anticipo'   => $paid > 0 ? noticeMoney($paid) : '',
            'forma_pago' => $this->orderNoticeMethods((array) $this->getMethodPayment([$orderId])),
            'restante'   => noticeMoney(max(0, $total - $paid)),
            'fotos'      => array_column($photos, 'path')
        ];

        $vars = array_merge($snapshot, [
            'folio'     => $folio,
            'sucursal'  => $branch['sucursal'],
            'productos' => implode("\n", $snapshot['productos'])
        ]);

        $msg  = new Message();
        $last = $msg->lastAviso($branch['idCompany'], $reference);

        // El aviso conserva su clave 'personalizado' (destinatarios, plantilla e
        // historial ya guardados con ella); en Admin se muestra como "Pedidos".
        if (!$last) {
            $images = $this->orderNoticeImages($photos, $folio);
            $result = $msg->aviso('personalizado', $branch['idCompany'], $vars, $reference, $order['subsidiaries_id'], true, $snapshot, $images);

            return [
                'status'  => 200,
                'message' => "Aviso enviado a {$result['enviados']} destinatario(s)",
                'data'    => $result
            ];
        }

        // Estricto: con == PHP 7 compara como numeros los textos numericos (telefonos).
        // Un snapshot guardado antes de sumar los datos de pago no los trae: solo se
        // comparan los que tiene.
        $before = $last['snapshot'];

        if ($before !== null && array_intersect_key($snapshot, $before) === $before) {
            return [
                'status'  => 200,
                'message' => 'El pedido no cambió desde el último aviso',
                'data'    => ['enviados' => 0, 'fallidos' => 0]
            ];
        }

        // Los avisos de antes de guardar el snapshot no tienen contra que comparar:
        // {cambios} va vacio y su seccion no sale.
        $vars['cambios'] = $before ? implode("\n", $this->orderNoticeChanges($before, $snapshot)) : '';

        // Solo las fotos que el aviso anterior no llevaba. Uno guardado antes de mandar
        // fotos no las trae en su snapshot: ninguna habia salido, van todas.
        $sentPhotos = (array) ($before['fotos'] ?? []);
        $newPhotos  = array_values(array_filter($photos, function ($photo) use ($sentPhotos) {
            return !in_array($photo['path'], $sentPhotos, true);
        }));

        $images = $this->orderNoticeImages($newPhotos, $folio);
        $result = $msg->aviso('edicion', $branch['idCompany'], $vars, $reference, $order['subsidiaries_id'], false, $snapshot, $images);

        return [
            'status'  => 200,
            'message' => "Aviso de edición enviado a {$result['enviados']} destinatario(s)",
            'data'    => $result
        ];
    }

    // Variable {cambios}: los datos del pedido como "antes → ahora" y los productos
    // completos, ➕ los nuevos y ➖ los quitados. Un producto que se modifico sale como
    // quitado (como estaba) y nuevo (como quedo).
    private function orderNoticeChanges($before, $after) {
        $labels = [
            'fecha'      => 'Fecha',
            'hora'       => 'Hora',
            'cliente'    => 'Cliente',
            'telefono'   => 'Tel',
            'estatus'    => 'Estatus',
            'total'      => 'Total',
            'anticipo'   => 'Anticipo',
            'forma_pago' => 'Forma de pago',
            'restante'   => 'Restante'
        ];

        $changes = [];

        foreach ($labels as $key => $label) {
            // Dato que el aviso anterior no guardaba: no hay "antes" que mostrar.
            if (!array_key_exists($key, $before)) continue;

            $old = (string) ($before[$key] ?? '');
            $new = (string) ($after[$key] ?? '');

            if ($old !== $new) {
                $changes[] = "• {$label}: " . ($old !== '' ? $old : '—') . ' → ' . ($new !== '' ? $new : '—');
            }
        }

        if (array_key_exists('fotos', $before)) {
            $newPhotos  = count(array_diff($after['fotos'], $before['fotos']));
            $gonePhotos = count(array_diff($before['fotos'], $after['fotos']));

            if ($newPhotos)  $changes[] = '📷 ' . $newPhotos . ($newPhotos === 1 ? ' foto nueva' : ' fotos nuevas');
            if ($gonePhotos) $changes[] = '📷 ' . $gonePhotos . ($gonePhotos === 1 ? ' foto quitada' : ' fotos quitadas');
        }

        $removed = (array) ($before['productos'] ?? []);
        $added   = [];

        foreach ($after['productos'] as $block) {
            $index = array_search($block, $removed, true);

            if ($index === false) $added[] = $block;
            else unset($removed[$index]);
        }

        // Cada bloque empieza con "• ": la viñeta se cambia por la marca.
        foreach ($added as $block)   $changes[] = '➕ ' . substr($block, strlen('• '));
        foreach ($removed as $block) $changes[] = '➖ ' . substr($block, strlen('• '));

        return $changes;
    }

    // Fotos de los pasteles personalizados, en el orden del pedido. Las de productos
    // normales no se mandan.
    private function orderNoticePhotos($lines) {
        $photos = [];

        foreach ($lines as $line) {
            if (!$line['is_custom']) continue;

            foreach ((array) $line['images'] as $image) {
                if (empty($image['path'])) continue;

                $photos[] = [
                    'path'    => $image['path'],
                    'name'    => $image['name'] ?: basename($image['path']),
                    'product' => "Pastel personalizado «{$line['name']}»"
                ];
            }
        }

        return $photos;
    }

    // Una imagen por foto para Message::aviso(). La primera lleva el aviso completo como
    // pie; el pie de aqui es para las demas, que llegan como mensajes aparte.
    private function orderNoticeImages($photos, $folio) {
        $total  = count($photos);
        $images = [];

        foreach ($photos as $index => $photo) {
            $count = 'foto ' . ($index + 1) . " de {$total}";

            // Misma raiz donde la guarda ctrl-pedidos-personalizado::addOrderImages.
            $images[] = [
                'file'      => rtrim($_SERVER['DOCUMENT_ROOT'], '/\\') . '/' . ltrim($photo['path'], '/'),
                'name'      => $photo['name'],
                'caption'   => "📷 Pedido #{$folio} · {$photo['product']} · {$count}",
                'reference' => "Pedido #{$folio} · {$count}"
            ];
        }

        return $images;
    }

    // Variable {forma_pago}: el metodo si solo hubo uno; con varios, cada uno con lo
    // que se cobro por el. Sin pagos queda vacia y su renglon no sale.
    private function orderNoticeMethods($methods) {
        if (count($methods) === 1) return $methods[0]['method_pay'];

        return implode(' · ', array_map(function ($method) {
            return $method['method_pay'] . ' ' . noticeMoney($method['pay']);
        }, $methods));
    }

    // Variable {productos}: un bloque por producto (su viñeta y sus detalles). El
    // pastel personalizado lleva sus modificadores agrupados como en el armado.
    private function orderNoticeProducts($lines) {
        $text = [];

        foreach ($lines as $line) {
            $qty    = intval($line['quantity']);
            $detail = [];

            if ($line['is_custom']) {
                $title    = "• {$qty} × Pastel personalizado «{$line['name']}»";
                $portions = oneLine($line['portion_qty']);

                if ($portions !== '' && $portions !== '0') $detail[] = "Porciones: {$portions}";

                $groups = [];

                foreach ($line['customer_products'] as $item) {
                    $group = mb_strtolower(trim($item['modifier_name']), 'UTF-8');
                    $label = mb_strtoupper(mb_substr($group, 0, 1, 'UTF-8'), 'UTF-8') . mb_substr($group, 1, null, 'UTF-8');
                    $count = intval($item['custom_quantity']);

                    $groups[$label][] = $item['name'] . ($count > 1 ? " x{$count}" : '');
                }

                foreach ($groups as $label => $names) {
                    $detail[] = $label . ': ' . implode(', ', $names);
                }
            } else {
                $title = "• {$qty} × {$line['name']}";
            }

            if (oneLine($line['dedication']) !== '')    $detail[] = 'Dedicatoria: ' . oneLine($line['dedication']);
            if (oneLine($line['order_details']) !== '') $detail[] = 'Observaciones: ' . oneLine($line['order_details']);

            $images = count((array) $line['images']);
            if ($images > 0) $detail[] = imagesLabel($images);

            $text[] = $title . ($detail ? "\n   " . implode("\n   ", $detail) : '');
        }

        return $text;
    }

    function getPayment(){

         $ls      = $this->getOrderID([$_POST['id']]);
         $methods = $this-> getMethodPayment([$_POST['id']]);

         return [
            'order'    => $ls[0],
            'total_paid'  => array_sum(array_column($methods, 'pay'))
         ];

    }

    // Order.
    function getOrder(){

          // products.
        $__row = [];
        $ls    = $this->getOrderById([$_POST['id']]);

        // Validar que ls sea un array válido
        if (is_array($ls)) {
            foreach ($ls as $key) {
                $__row[] = [
                    'id'    => $key['id'],
                    'name'  => $key['name'],
                    'price' => $key['price'],
                    'desc'  => $key['description'],
                    'opc'   => 0
                ];
            }
        }

          $order            = $this-> getOrderID([$_POST['id']])[0];
          $order['logo']    = $_SESSION['LOGO'] ;
          $order['company'] = $_SESSION['COMPANY'] ;

          $ok               = $this-> getMethodPayment([$_POST['id']]);


         return [

            'order'          => $order,
            'products'       => $__row,
            'paymentMethods' => $ok

         ];

    }

    // Helper function to update order total
    private function updateTotalOrder($pedidos_id) {
        $orderProducts = $this->getOrderById([$pedidos_id]);
        
        if (is_array($orderProducts)) {
            $total = 0;
            foreach ($orderProducts as $product) {
                $price = floatval($product['price'] ?? 0);
                $qty = intval($product['quantity'] ?? 0);
                $total += $price * $qty;
            }
            
            // Actualizar el total_pay en la orden
            $this->updateOrder($this->util->sql([
                'total_pay' => $total,
                'id' => $pedidos_id
            ], 1));
            
            return $total;
        }
        
        return 0;
    }

}

// Complements.

function formatFolio($subsidiariesId = null, $numero = null) {
    $sucursal = ($subsidiariesId === null || $subsidiariesId === '') ? 'X' : str_pad($subsidiariesId, 2, '0', STR_PAD_LEFT);
    return 'P' . $numero . '-' . $sucursal;
}

// Texto del aviso en un renglon ('' si viene vacio, y el renglon no sale): sus saltos
// romperian la viñeta.
function oneLine($value) {
    return trim(preg_replace('/\s*(?:\r\n|\r|\n)\s*/', ' ', (string) $value));
}

// Dinero del aviso: "$1,250.00". evaluar() no sirve aqui: el 0 sale "-" y lo negativo
// lleva HTML.
function noticeMoney($value) {
    return '$' . number_format(floatval($value), 2);
}

function imagesLabel($total) {
    return $total == 1 ? '🖼️ 1 imagen adjunta' : "🖼️ {$total} imágenes adjuntas";
}

function orderStatusText($status) {
    $names = [
        1 => '📝 COTIZACIÓN',
        2 => '🟡 PENDIENTE',
        3 => '🟢 PAGADO',
        4 => '🔴 CANCELADO'
    ];

    return $names[$status] ?? '—';
}

// Produccion no edita pedidos: aqui solo se arman y modifican sus partidas.
if (($_SESSION['ROLID'] ?? 0) == ctrl::ROL_PRODUCCION) {
    echo json_encode([
        'status'  => 403,
        'message' => 'Tu perfil de Producción solo puede consultar los pedidos.'
    ]);
    exit;
}

$obj = new ctrl();
echo json_encode($obj->{$_POST['opc']}());
?>
