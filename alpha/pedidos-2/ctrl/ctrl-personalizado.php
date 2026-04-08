<?php
session_start();
if (empty($_POST['opc'])) exit(0);

header("Access-Control-Allow-Origin: *"); // Permite solicitudes de cualquier origen
header("Access-Control-Allow-Methods: GET, POST, OPTIONS"); // Métodos permitidos
header("Access-Control-Allow-Headers: Content-Type"); // Encabezados permitidos

require_once '../mdl/mdl-personalizado.php';

class ctrl extends mdl {
    // PEDIDOS PERSONALIZADOS ----------------------------------
    // Obtener pedido personalizado
    function getCustomOrder() {
        $status  = 404;
        $message = 'Error al obtener el pedido personalizado';
        $data    = null;

        $get = $this->getByIdCustomOrder([$_POST['id']]);
        
        if ($get) {
            $status  = 200;
            $message = 'Datos obtenidos correctamente';
            $data    = [
            ];
        }

        return [
            'status'  => $status,
            'message' => $message,
            'data'    => $data
        ];
    }

    // Obtener pedido personalizado por ID de paquete en orden
    function getCustomOrderByPackageId() {
        $status  = 404;
        $message = 'Error al obtener el pedido personalizado';
        $data    = null;

        $orderPackage = $this->getOrderPackageById([$_POST['id']]);
        
        if ($orderPackage && $orderPackage['custom_id']) {
            $customOrder = $this->getByIdCustomOrder([$orderPackage['custom_id']]);
            
            if ($customOrder) {
                // Obtener items del pedido personalizado
                $items = $this->getProductsInOrderCustom([$customOrder['id']]);
                
                // Obtener imágenes del pedido
                $images = $this->getImagesByOrderPackageId([$_POST['id']]);
                
                $status  = 200;
                $message = 'Datos obtenidos correctamente';
                $data    = [
                    'id'            => $customOrder['id'],
                    'name'          => $customOrder['name'],
                    'price'         => $customOrder['price'],
                    'price_real'    => $customOrder['price_real'],
                    'portion_qty'   => $customOrder['portion_qty'],
                    'dedication'    => $orderPackage['dedication'],
                    'order_details' => $orderPackage['order_details'],
                    'items'         => $items,
                ];
            }
         
        }

        return [
            'status'  => $status,
            'message' => $message,
            'data'    => $data
        ];
    }

    // Editar pedido personalizado
    function editCustomOrder() {
        $status  = 500;
        $message = 'No se pudo actualizar el pedido personalizado';

        $items = ($_POST['items'] ? json_decode($_POST['items'], true) : []);
        $orderPackageId = $_POST['id'];
        $idCustom = $_POST['idCustom'];


        unset($_POST['items']);
        unset($_POST['id']);
        unset($_POST['idCustom']);

        // Obtener el custom_id del order_package
        $orderPackage = $this->getOrderPackageById([$orderPackageId]);
        $customData = [];
        $customData = [
            'name'        => $_POST['name'],
            'price'       => $_POST['price'],
            'price_real'  => $_POST['price_real'],
            'portion_qty' => $_POST['portion_qty'],
            'id'          => $idCustom,
        ];
        
        // Actualizar el pedido personalizado
        $update = $this->updateCustomOrder($this->util->sql($customData, 1));

        if ($update) {
            // Eliminar productos anteriores
            $this->deleteProductsInOrderCustom([$idCustom]);
            
            // Agregar nuevos productos
            if (!empty($items)) {
                $productos = [];
                foreach ($items as $item) {
                    $productos[] = [
                        'modifier_id'  => $item['modifier_id'],
                        'quantity'     => $item['quantity'],
                        'price'        => $item['price'],
                        'date_created' => date('Y-m-d H:i:s'),
                        'custom_id'    => $idCustom
                    ];
                }
                $this->createProductInOrderCustom($this->util->sql($productos));
            }

            // Actualizar el total de la orden
            $this->updateTotalOrder($orderPackageId);
            
            $status  = 200;
            $message = 'Pedido personalizado actualizado correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message,
            'data'    => [
                'id' => !empty($idCustom) ? $idCustom : null,
                'orderId' => $orderPackageId
            ]
        ];
    }

    // Agregar pedido personalizado
    function addCustomOrder() {
        $status  = 500;
        $message = 'No se pudo agregar el pedido personalizado';
        $max = null;
        $maxOrden = null;

        $items   = ($_POST['items'] ? json_decode($_POST['items'], true) : []);
        unset($_POST['items']);
        $idPedido   = $_POST['orderId'];
        unset($_POST['orderId']);

        $insert = $this->createCustomOrder($this->util->sql($_POST));

        if ($insert) {
            $status  = 200;
            $message = 'Pedido personalizado agregado correctamente';
            $max = $this->maxCustomOrder();
            
             if ($max != null) {
                // Agregar ala orden 
                $this->createOrderPackage($this->util->sql([
                    'custom_id'     => $max,
                    'pedidos_id'    => $idPedido,
                    'quantity'      => 1,
                    'date_creation' => date('Y-m-d H:i:s'),
                    'status'        => 1
                ]));
                // El ID del nuevo paquete en la orden
                $maxOrden = $this->maxOrderPackage();

                // Agregar productos al pedido personalizado
                $productos = [];
                foreach ($items as $item) {
                    $productos[] = [
                        'modifier_id'  => $item['modifier_id'],
                        'quantity'     => $item['quantity'],
                        'price'        => $item['price'],
                        'date_created' => date('Y-m-d H:i:s'),
                        'custom_id'    => $max
                    ];
                }
                $add = $this->createProductInOrderCustom($this->util->sql($productos));

                   $this->updateTotalOrder($idPedido);
            }
        }

        return [
            'status'  => $status,
            'message' => 'oli',
            'data'    => [
                'id' => $max, 
                'orderId' => $maxOrden
            ],
            'items' => $items,
        ];
    }

    function editOrderPackage() {
        $status  = 500;
        $message = 'No se pudo actualizar el paquete en la orden';

        $update = $this->updateOrderPackage($this->util->sql($_POST, 1));

        if ($update) {
            $status  = 200;
            $message = 'Paquete en la orden actualizado correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
    }

    // Cancelar pedido personalizado
    function cancelCustomOrder() {
        $status  = 500;
        $message = 'Error al cancelar el pedido personalizado.';

        $update = $this->updateCustomOrder($this->util->sql($_POST, 1));

        if ($update) {
            $status  = 200;
            $message = 'Pedido personalizado cancelado correctamente.';
        }

        return [
            'status'  => $status,
            'message' => $message,
        ];
    }

    // MODIFICADORES Y PRODUCTOS DE LOS MODIFICADORES -------------
    // Agregar producto de modificador
    function addModifierProduct() {
        $status  = 500;
        $message = 'Error al agregar el producto del modificador';

        $_POST['date_creation'] = date('Y-m-d H:i:s');
        $_POST['active'] = 1;
        $insert = $this->createOrderModifierProduct($this->util->sql($_POST));

        if ($insert) {
            $status  = 200;
            $message = 'Producto del modificador agregado correctamente';
            $max = $this->maxOrderModifierProduct();
        }

        return [
            'status'  => $status,
            'message' => $message,
            'data'    => ['id' => $max]
        ];
    }

    // Agregar imagenes del pedido personalizado
    function addOrderImages() {

        $status  = 500;
        $message = 'Error al agregar las imágenes del pedido personalizado';
        $company = $_SESSION['COMPANY'] ;
        $sub     = $_SESSION['SUBSIDIARIE_NAME'] ;
        $packageId = $_POST['id'];

        // Verificar si existen imágenes previas y eliminarlas
        $existingImages = $this->getImagesByOrderPackageId([$packageId]);
        
        if (!empty($existingImages)) {
            foreach ($existingImages as $image) {
                // Eliminar archivo físico del servidor
                $fullPath = $_SERVER['DOCUMENT_ROOT'] . '/' . ltrim($image['path'], '/');
                
                if (file_exists($fullPath)) {
                    unlink($fullPath);
                }
                
                // Eliminar registro de la base de datos
                $this->deleteImageById([$image['id']]);
            }
        }

        // Configurar ruta para nuevas imágenes
        $ruta    = 'alpha_files/' .$company. '/' . $sub . '/order/images/custom/';
        $oldFile = $_SERVER['DOCUMENT_ROOT'] . '/' . $ruta;

        if (!file_exists($oldFile)) {
            mkdir($oldFile, 0777, true);
        }

        $values  = [];

        if (!empty($_FILES['archivos']['name'][0])) {
        
                foreach ($_FILES['archivos']['name'] as $i => $nombreOriginal) {
        
             if ($_FILES['archivos']['error'][$i] == UPLOAD_ERR_OK) {

                  $temporal    = $_FILES['archivos']['tmp_name'][$i];
                    $ext         = pathinfo($nombreOriginal, PATHINFO_EXTENSION);
                    $randomDigits = str_pad((string)random_int(0, 9999), 4, '0', STR_PAD_LEFT);
                    $hour = date('H');
                    $nuevoNombre = 'cake_' . $randomDigits . '_' . $hour . 'hrs.' . strtolower($ext);
                    $destino     = $oldFile . $nuevoNombre;
                    
                    if (move_uploaded_file($temporal, $destino)) {
                        $values[] = [
                            'path'          => $ruta.$nuevoNombre,
                            'name'          => $nuevoNombre,
                            'original_name' => $nombreOriginal,
                            'date_created'  => date('Y-m-d H:i:s'),
                            'package_id'    => $packageId
                        ];

                        $insert =  $this->createOrderImages($this->util->sql($values));
                        
                        if ($insert) {
                            $status  = 200;
                            $message = 'Imágenes del pedido personalizado agregadas correctamente';
                        }
                    }
                   }
            }
        }


     
        return [
            
            'status'    => $status,
            'message'   => $message,
            'end-point' => $values,

            'data'   => [
                'ruta'     => $ruta,
                '$oldFile' => $oldFile,
                'deleted_images' => count($existingImages)
            ]
        ];
    }

    // Obtener imágenes de un pedido
    function getOrderImages() {
        $status  = 404;
        $message = 'No se encontraron imágenes';
        $data    = [];

        $images = $this->getImagesByOrderPackageId([$_POST['order_package_id']]);
        
        if ($images > 0) {
            $status  = 200;
            $message = 'Imágenes obtenidas correctamente';
            $data    = $images;
        }

        return [
            'status'  => $status,
            'message' => $message,
            'data'    => $data
        ];
    }

    // Eliminar imagen de un pedido
    function deleteOrderImage() {
        $status  = 500;
        $message = 'No se pudo eliminar la imagen';

        // Obtener información de la imagen antes de eliminarla
        $image = $this->getImageById([$_POST['id']]);
        
        // if ($image > 0) {
            // Eliminar de la base de datos
        $delete = $this->deleteImageById([$_POST['id']]);
        
        if ($delete) {
            // Eliminar archivo físico del servidor
            $imagePath = !empty($image['path']) ? $image['path'] : (!empty($image['image_path']) ? $image['image_path'] : '');
            
            if (!empty($imagePath)) {
                // Construir ruta completa del archivo
                $fullPath = $_SERVER['DOCUMENT_ROOT'] . '/' . ltrim($imagePath, '/');
                
                // Verificar si el archivo existe y eliminarlo
                if (file_exists($fullPath)) {
                    if (unlink($fullPath)) {
                        $status  = 200;
                        $message = 'Imagen eliminada correctamente del servidor y base de datos';
                    } else {
                        $status  = 200;
                        $message = 'Imagen eliminada de la base de datos, pero no se pudo eliminar del servidor';
                    }
                } else {
                    $status  = 200;
                    $message = 'Imagen eliminada de la base de datos (archivo no encontrado en servidor)';
                }
            } else {
                $status  = 200;
                $message = 'Imagen eliminada de la base de datos';
            }
        }
        // }

        return [
            'status'  => $status,
            'message' => $message,
        ];
    }


    // Helper function to update order total
    private function updateTotalOrder($pedidos_id) {
        $orderProducts = $this->getOrderById([$pedidos_id]);
        
        if (is_array($orderProducts)) {
            $total = 0;
            foreach ($orderProducts as $product) {
                $price = floatval(!empty($product['price']) ? $product['price'] : 0);
                $qty = intval(!empty($product['quantity']) ? $product['quantity'] : 0);
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


$obj    = new ctrl();
$fn     = $_POST['opc'];

$encode = [];
$encode = $obj->$fn();
echo json_encode($encode);


?>