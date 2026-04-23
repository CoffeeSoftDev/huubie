<?php
session_start();
if (empty($_POST['opc'])) exit(0);

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

require_once '../mdl/mdl-paquetes.php';

class ctrl extends mdl {
    // INFORMACIÓN DE PAQUETES
    function listPaquetes() {
        $active = $_POST['estado-paquetes'];
        $data   = $this->getPaquetes([$active, $_SESSION['SUB']]);
        $rows   = [];
        
        foreach ($data as $item) {
            $a = [];

            if($active == 1) {
                // Si es activo mostrar estos botones.
                $a[] = [
                    'class'   => 'btn btn-sm btn-primary me-1',
                    'html'    => '<i class="icon-pencil"></i>',
                    'onclick' => 'app.editPaquete('.$item['id'].')'
                ];
    
                $a[] = [
                    'class'   => 'btn btn-sm btn-danger me-1',
                    'html'    => '<i class="icon-toggle-on"></i>',
                    'onclick' => 'app.statusPaquete('.$item['id'].', '.$item['active'].')'
                ];

                $a[] = [
                    'class'   => 'btn btn-sm btn-success',
                    'html'    => '<i class="icon-eye"></i>',
                    'onclick' => 'app.showPaquete('.$item['id'].')'
                ];
            } else {
                // Si es inactivo mostrar estos botones.
                $a[] = [
                    'class'   => 'btn btn-sm btn-outline-danger ',
                    'html'    => '<i class="icon-toggle-off"></i>',
                    'onclick' => 'app.statusPaquete('.$item['id'].', '.$item['active'].')'
                ];
            }
            
            $rows[] = [
                'id'             => $item['id'],
                'Paquete'        => $item['name'],
                'Descripción'    => $item['description'],
                'Precio/Persona' => "$" . number_format($item['price_person'], 2),
                'Fecha creación' => formatSpanishDate($item['date_creation']),
                'a'              => $a
            ];
        }

        return [
            'row' => $rows,
            'ls'  => $data
        ];
    }

    function getPaquete() {
        $id      = $_POST['id'];
        $status  = 404;
        $message = 'Paquete no encontrado';
        $data    = null;

        $paquete = $this->getPaqueteById($id);

        if ($paquete > 0) {
            $status  = 200;
            $message = 'Paquete encontrado';
            $data    = [
                'id'            => $paquete['id'],
                'name'          => $paquete['name'],
                'description'   => $paquete['description'],
                'price_person'  => $paquete['price_person'],
                'date_creation' => $paquete['date_creation'],
                'products'      => $this->getPaqueteProductos([$id])
            ];
        }

        return [
            'status'  => $status,
            'message' => $message,
            'data'    => $data
        ];
    }

    function addPaquete() {
        $status = 500;
        $message = 'No se pudo agregar el paquete';
        $_POST['date_creation'] = date('Y-m-d H:i:s');
        $_POST['subsidiaries_id'] = $_SESSION['SUB'];
        $products = json_decode($_POST['products'], true);
        unset($_POST['products']);

        if (!$this->existsPaqueteByName([$_POST['name'], $_SESSION['SUB']])) {
            $create = $this->createPaquete($this->util->sql($_POST));
            if ($create) {
                $status = 200;
                $message = 'Paquete agregado correctamente';
                $package_id = $this->maxPaqueteID();
                
                // Eliminar productos del paquete si ya existen
                $this->deletePaqueteProductos($this->util->sql(['package_id' => $package_id], 1));

                // Agregar productos al paquete
                if (!empty($products)) {
                    $data = [];
                    foreach ($products as $product) {
                        $data[] = [
                            'package_id' => $package_id,
                            'products_id' => $product['id'],
                            'quantity' => $product['quantity'],
                            'date_creation' => date('Y-m-d H:i:s')
                        ];
                    }
                    // Insección múltiple de productos al paquete
                    $this->createPaqueteProductos($this->util->sql($data));
                }
            }
        } else {
            $status = 409;
            $message = 'Ya existe un paquete con ese nombre.';
        }

        return [
            'status' => $status,
            'message' => $message
        ];
    }

    function editPaquete() {
        $id = $_POST['id'];
        $status = 500;
        $message = 'Error al editar paquete';
        $products = json_decode($_POST['products'], true);
        unset($_POST['products']);

        // Validar si el nombre ya existe en otro paquete
        if (!$this->existsOtherPaqueteByName([$_POST['name'], $id, $_SESSION['SUB']])) {
            $status = 409;
            $message = 'Ya existe otro paquete con ese nombre.';
        } else {
            $edit = $this->updatePaquete($this->util->sql($_POST, 1));
            if ($edit) {
                $status = 200;
                $message = 'Paquete editado correctamente';

                // Eliminar productos actuales del paquete
                $deleteRelation = $this->deletePaqueteProductos($this->util->sql(['package_id' => $id], 1));
                // Insertar nuevos productos
                if (!empty($products)) {
                    $data = [];
                    foreach ($products as $product) {
                        $data[] = [
                            'package_id'    => $id,
                            'products_id'   => $product['id'],
                            'quantity'      => $product['quantity'],
                            'date_creation' => date('Y-m-d H:i:s')
                        ];
                    }
                    $createRelation = $this->createPaqueteProductos($this->util->sql($data));
                    if ($createRelation) {
                        $message = 'Paquete y productos actualizados correctamente';
                    } else {
                        $status = 500;
                        $message = 'Error al agregar productos al paquete';
                    }
                }
            }
        }

        return [
            'status' => $status,
            'message' => $message,
        ];
    }

    function statusPaquete() {
        $status = 500;
        $message = 'No se pudo actualizar el estado del Paquete';

        $update = $this->updatePaquete($this->util->sql($_POST, 1));

        if ($update) {
            $status = 200;
            $message = 'El estado del Paquete se actualizó correctamente';
        }

        return [
            'status' => $status,
            'message' => $message
        ];
    }


    // INFORMACIÓN DE PRODUCTOS
    function listProductos() {
        $active = $_POST['estado_productos'];
        $data = $this->getProductos([$active, $_SESSION['SUB']]);
        $rows = [];

        foreach ($data as $item) { 
            $a = [];

            if($active == 1) {
                // Si es activo mostrar estos botones.
                $a[] = [
                    'class'   => 'btn btn-sm btn-primary me-1',
                    'html'    => '<i class="icon-pencil"></i>',
                    'onclick' => 'app.editProducto('.$item['id'].')'
                ];
    
                $a[] = [
                    'class'   => 'btn btn-sm btn-danger ',
                    'html'    => '<i class="icon-toggle-on"></i>',
                    'onclick' => 'app.statusProducto('.$item['id'].', '.$item['active'].' )'
                ];
            } else {
                // Si es inactivo mostrar estos botones.
                $a[] = [
                    'class'   => 'btn btn-sm btn-outline-danger',
                    'html'    => '<i class="icon-toggle-off"></i>',
                    'onclick' => 'app.statusProducto('.$item['id'].', '.$item['active'].' )'
                ];
            }

            $rows[] = [
                'id' => $item['id'],
                'Producto' => $item['valor'],
                'Precio' => "$" . number_format($item['price'], 2),
                'Clasificación' => $item['classification'],
                'Fecha creación' => formatSpanishDate($item['date_creation']),
                'a' => $a
            ];
        }

        return [
            'row' => $rows, 
            'ls' => $data
        ];
    }

    function getProducto() {
        $id = $_POST['id'];
        $status = 404;
        $message = 'Producto no encontrado';
        $data = null;

        $producto = $this->getProductoById($id);

        if ($producto > 0) {
            $status                 = 200;
            $message                = 'Producto encontrado';
            $data                   = $producto;
        }

        return [
            'status'  => $status,
            'message' => $message,
            'data'    => $data
        ];
    }

    function addProducto() {
        $status = 500; 
        $message = 'No se pudo agregar el producto';
        $_POST['date_creation'] = date('Y-m-d H:i:s');
        $_POST['subsidiaries_id'] = $_SESSION['SUB'];

        // Validar duplicado por nombre
        if (!$this->existsProductoByName([$_POST['name'], $_SESSION['SUB']])) {
            // Si no existe, crear el producto
            $create = $this->createProducto($this->util->sql($_POST));
            if ($create) {
                $status = 200; 
                $message = 'Producto agregado correctamente';
            } 
        } else {
            // Si ya existe, retornar conflicto
            $status = 409; 
            $message = 'Ya existe un producto con ese nombre.';
        }

        return [
            'status' => $status, 
            'message' => $message
        ];
    }

    function editProducto() {
        $id = $_POST['id'];
        $status = 500;
        $message = 'Error al editar producto';

        // Validar si el nombre ya existe en otro producto
        if (!$this->existsOtherProductoByName([$_POST['name'], $id, $_SESSION['SUB']])) {
            $status = 409;
            $message = 'Ya existe otro producto con ese nombre.';
        } else {
            // Intentar editar el producto
            $edit = $this->updateProducto($this->util->sql($_POST, 1));
            if ($edit) {
                $status = 200;
                $message = 'Producto editado correctamente';
            }
        }

        return [
            'status' => $status,
            'message' => $message
        ];
    }

    function statusProducto() {
        $status = 500;
        $message = 'No se pudo actualizar el estado del producto';

        $update = $this->updateProducto($this->util->sql($_POST, 1));

        if ($update) {
            $status = 200;
            $message = 'El estado del producto se actualizó correctamente';
        }

        return [
            'status' => $status,
            'message' => $message
        ];
    }

    // INFORMACIÓN DE CLASIFICACIONES
    function listClasificaciones () {
        $active = $_POST['estado_clasificaciones'];
        $data = $this->getClasificaciones([$active, $_SESSION['SUB']]);
        $rows = [];

        foreach ($data as $item) {
            $a = [];

            if($active == 1) {
                // Si es activo mostrar estos botones.
                $a[] = [
                    'class'   => 'btn btn-sm btn-primary me-1',
                    'html'    => '<i class="icon-pencil"></i>',
                    'onclick' => 'app.editClasificacion('.$item['id'].')'
                ];
    
                $a[] = [
                    'class'   => 'btn btn-sm btn-danger ',
                    'html'    => '<i class="icon-toggle-on"></i>',
                    'onclick' => 'app.statusClasificacion('.$item['id'].', '.$item['active'].')'
                ];
            } else {
                // Si es inactivo mostrar estos botones.
                $a[] = [
                    'class'   => 'btn btn-sm btn-outline-danger',
                    'html'    => '<i class="icon-toggle-off"></i>',
                    'onclick' => 'app.statusClasificacion('.$item['id'].', '.$item['active'].')'
                ];
            }

            $rows[] = [
                'id' => $item['id'],
                'Clasificación' => $item['classification'],
                'Fecha creación' => formatSpanishDate($item['date_creation']),
                'a' => $a
            ];
        }

        return [ 
            'row' => $rows, 
            'ls' => $data
        ];
    }

    function getClasificacion() {
        $id = $_POST['id'];
        $status = 404;
        $message = 'Clasificación no encontrada';
        $data = null;

        $clasificacion = $this->getClasificacionById($id);

        if ($clasificacion > 0) {
            $status  = 200;
            $message = 'Clasificación encontrada';
            $data    = [
                'id' => $clasificacion['id'],
                'classification' => $clasificacion['classification'],
                'date_creation' => $clasificacion['date_creation']
            ];
        }

        return [
            'status'  => $status,
            'message' => $message,
            'data'    => $data
        ];
    }

    function addClasificacion() {
        $status = 500;
        $message = 'No se pudo agregar la clasificación';
        $_POST['date_creation'] = date('Y-m-d H:i:s');
        $_POST['subsidiaries_id'] = $_SESSION['SUB'];

        // Validar duplicado por nombre
        if (!$this->existsClasificacionByName([$_POST['classification'], $_SESSION['SUB']])) {
            // Si no existe, crear la clasificación
            $create = $this->createClasificacion($this->util->sql($_POST));
            if ($create) {
                $status = 200;
                $message = 'Clasificación agregada correctamente';
            }
        } else {
            // Si ya existe, retornar conflicto
            $status = 409;
            $message = 'Ya existe una clasificación con ese nombre.';
        }

        return [
            'status' => $status,
            'message' => $message
        ];
    }

    function editClasificacion() {
        $id = $_POST['id'];
        $status = 500;
        $message = 'Error al editar clasificación';

        // Validar si el nombre ya existe en otra clasificación
        if (!$this->existsOtherClasificacionByName([$_POST['classification'], $id, $_SESSION['SUB']])) {
            $status = 409;
            $message = 'Ya existe otra clasificación con ese nombre.';
        } else {
            // Intentar editar la clasificación
            $edit = $this->updateClasificacion($this->util->sql($_POST, 1));
            if ($edit) {
                $status = 200;
                $message = 'Clasificación editada correctamente';
            }
        }

        return [
            'status' => $status,
            'message' => $message
        ];
    }

    function statusClasificacion() {
        $status = 500;
        $message = 'No se pudo actualizar el estado de la clasificación';

        $update = $this->updateClasificacion($this->util->sql($_POST, 1));

        if ($update) {
            $status = 200;
            $message = 'El estado de la clasificación se actualizó correctamente';
        }

        return [
            'status' => $status,
            'message' => $message
        ];
    }
}

$obj = new ctrl();
echo json_encode($obj->{$_POST['opc']}());