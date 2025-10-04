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

        return [
            'modifier' => $this->getCategory(),
            'products' => $this->lsProductos([1, $_SESSION['SUB']]),
            'id'       => $_POST['id'],
            'list'     => $this-> getOrderById([$_POST['id']]),
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
            $getProduct = $this -> getOrderPackageByID([$_POST['id']]);


            // // if ($getProduct) {
            // //     $status = 200;
            // //     $message = 'Datos obtenidos correctamente.';
            // // }

            return [
                'status'  => $status,
                'message' => $message,
                'data'    => $getProduct,
                'images'  => $this->getOrderImages([$getProduct['id']]),
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

        }

        return [
            'status'  => $status,
            'message' => $message,
            'list'    => $this->  getOrderById([$_POST['pedidos_id']])
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

        return [
            'status'  => $status,
            'message' => $message,
            'files'   => $image,
            'list'    => $this-> getOrderById([$_POST['idFolio']])
        ];
    }

    function removeProduct() {

        $status = 500;
        $message = 'No se pudo eliminar el producto del pedido';

        $values = $this->util->sql([
            'id' => $_POST['id']
        ], 1);

        $delete = $this->deleteProduct($values);

        if ($delete) {
            $status = 200;
            $message = 'Producto eliminado del pedido correctamente';

            // $productos = $this->getPedidoDetailByID([$_POST['pedidos_id']]);
        }

        return [
            'status'  => $status,
            'message' => $message,
            'POST'    => $delete
        ];
    }

    function deleteAllProducts() {
        $status  = 500;
        $message = 'No se pudo eliminar el producto';


        $values = $this->util->sql([
            'pedidos_id' => $_POST['pedidos_id']
        ], 1);

        $delete = $this->deleteProduct($values);

        if ($delete) {
            $status  = 200;
            $message = 'Se eliminaron todos los productos del pedido correctamente.';
        }

        return [
            'status'  => $status,
            'message' => $message,
            'list'    => $this->  getOrderById([$_POST['pedidos_id']])
        ];
    }

    function lsProductOrderPackage() {
        $__row = [];
        $ls = $this->getOrderById([$_POST['id']]);

        foreach ($ls as $key) {

            $__row[] = [
                'id'    => $key['id'],
                'name'  => $key['name'],
                'price' => evaluar($key['price']),
                'desc'  => $key['description'],
                'opc'   => 0
            ];
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

        // 🧠 Lógica corregida:
        if ($pay <= 0) {
            $type_id = 1; // Cotización sin abono
        } else if ($pay ==  $saldo) {
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
        $insert = $this->registerPayment($values);

        // // Registrar método de pago solo si hay abono
        
        // if ($pay > 0) {
        //     $values_pay = [
        //         'pay'           => $pay,
        //         'date_pay'      => date('Y-m-d H:i:s'),
        //         'type'          => 2,
        //         'method_pay_id' => $_POST['method_pay_id'],
        //         'order_id'      => $id,
        //     ];

        //     $addPay = $this->addMethodPay($this->util->sql($values_pay));
        // }

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

        foreach ($ls as $key) {

            $__row[] = [
                'id'           => $key['id'],
                'name'         => $key['name'],
                'price'        => $key['price'],
                'quantity'     => $key['quantity'],
                'description'  => $key['description'],
                'dedication'   => $key['dedication'],
                'order_details'=> $key['order_details'],
                'customer_id'  => $key['customer_id'],
                'data_customer'=> $key['data_customer'],
                'image'        => $key['image'],
                'images'       => $key['images'] ?? [],
                'product_name' => $key['name'],
                'unit_price'   => $key['price'],
                'total_price'  => $key['price'] * $key['quantity'],
                'opc'          => 0
            ];
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




}

$obj = new ctrl();
echo json_encode($obj->{$_POST['opc']}());
?>
