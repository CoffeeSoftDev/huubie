<?php
session_start();
if (empty($_POST['opc'])) exit(0);


header("Access-Control-Allow-Origin: *"); // Permite solicitudes de cualquier origen
header("Access-Control-Allow-Methods: GET, POST, OPTIONS"); // Métodos permitidos
header("Access-Control-Allow-Headers: Content-Type"); // Encabezados permitidos

require_once '../mdl/mdl-pedidos.php';

class ctrl extends MPedidos{

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

$obj = new ctrl();
echo json_encode($obj->{$_POST['opc']}());
?>
