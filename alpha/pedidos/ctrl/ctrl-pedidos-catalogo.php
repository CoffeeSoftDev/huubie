<?php
session_start();
if (empty($_POST['opc'])) exit(0);


header("Access-Control-Allow-Origin: *"); // Permite solicitudes de cualquier origen
header("Access-Control-Allow-Methods: GET, POST, OPTIONS"); // Métodos permitidos
header("Access-Control-Allow-Headers: Content-Type"); // Encabezados permitidos

require_once '../mdl/mdl-pedidos.php';

class ctrl extends MPedidos{

    function init(){

        $order = $this ->getOrderID([$_POST['id']])[0];

        $orderProducts = $this->getOrderById([$_POST['id']]);
        if (!is_array($orderProducts)) {
            $orderProducts = [];
        }

        return [
            'modifier' => $this->getCategory(),
            'products' => $this->lsProductos([1, $_SESSION['SUB']]),
            'id'       => $_POST['id'],
            'list'     => $orderProducts,
            'order'    => $order
        ];
    }

    function getModificador(){

        $ls = $this->getAllModifiers([1]);
        $__row = [];

        $__row[] =[
            'id'     => 0,
            'text'   => '🎂 '.'Pastel',
            'active' => 'true'
        ];

        foreach ($ls as $key ) {

            $__row[] = [
                'id'   =>  $key['id'],
                'text' =>  '📦 '.$key['text'],
            ];

        }

        return $__row;


    }

    function getCategory(){

        $ls = $this->getAllCategory([1]);
        $__row = [];

        $__row[] =[
            'id'     => 0,
            'text'   => '🎂 '.'Todos los Productos',
            'active' => 'true'
        ];

        foreach ($ls as $key ) {

            $__row[] = [
                'id'   =>  $key['id'],
                'text' =>  '🧁 '.$key['text'],
            ];

        }

        return $__row;


    }

    // Products.
    function lsProducto() {
        $__row = [];
        // $ls = $this->lsModifierByID([$_POST['id']]);
        if ($_POST['id'] == 0) {
             $ls = $this->lsProductos([1,4]);
        }else{

            $ls = $this->listProductsById([$_POST['id']]);
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

        $status = 500;
        $message = 'No se pudo eliminar el producto del pedido';
        $pedidos_id = $_POST['pedidos_id'] ?? null;

        $values = $this->util->sql([
            'id' => $_POST['id']
        ], 1);

        $delete = $this->deleteProduct($values);

        if ($delete && $pedidos_id) {
            $status = 200;
            $message = 'Producto eliminado del pedido correctamente';
            
            // Actualizar el total de la orden
            $this->updateTotalOrder($pedidos_id);
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
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

    // payment.
    function addPayment() {

        $status  = 500;
        $message = 'No se pudo registrar el pago';

        $id         = $_POST['id'];
        $pay        = floatval($_POST['advanced_pay']);
        $total_pay  = floatval($_POST['total']);
        $saldo      = floatval($_POST['saldo']);
        $total_paid = floatval($_POST['total_paid'] ?? 0);

        if ($total_paid > 0) {
            $type_id = 2; // Ya tiene abonos previos, mantener como abono parcial
        } else if ($pay <= 0) {
            $type_id = 1; // Cotización sin abono
        } else if ($pay == $saldo) {
            $type_id = 3; // Pago completo
        } else {
            $type_id = 2; // Abono parcial
        }

        $post = [
            'total_pay'     => $total_pay,
            'type_id'       => $type_id,
            'status'        => $type_id,
            'date_creation' => date('Y-m-d'),
            'id'            => $id
        ];

        $values = $this->util->sql($post, 1);
        $insert = $this->updateOrder($values);
        $this->updateTotalOrder($id);
        // // Registrar método de pago solo si hay abono
        
        if ($pay > 0) {
            $values_pay = [
                'pay'           => $pay,
                'date_pay'      => date('Y-m-d H:i:s'),
                'type'          => 2,
                'method_pay_id' => $_POST['method_pay_id'],
                'order_id'      => $id,
            ];

            $addPay = $this->addMethodPay($this->util->sql($values_pay));
             
        }

        if ($insert) {
            $status  = 200;
            $message = 'Pago registrado correctamente';
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

$obj = new ctrl();
echo json_encode($obj->{$_POST['opc']}());
?>
