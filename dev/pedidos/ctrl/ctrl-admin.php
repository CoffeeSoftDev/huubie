<?php
    session_start();
    
    header("Access-Control-Allow-Origin: *");
    header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
    header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");
    
    if (empty($_POST['opc'])) exit(0);

    require_once '../mdl/mdl-admin.php';

    class ctrl extends mdl {


        function init() {
            return [
                'category' => $this->lsCategory([1]),
                'modifier' => $this->getAllModifiers([1]),
            ];
        }

        // Products.

        function listProductos() {
            $active = $_POST['estado'];
            $sesion = $_SESSION['SUB'] ?? 4;
            $data   = $this->lsProductos([ $active, $sesion]);
            $rows   = [];

            foreach ($data as $item) {
                $a = [];

                if ($active == 1) {
                    $a[] = [
                        'class'   => 'btn btn-sm btn-primary me-1',
                        'html'    => '<i class="icon-pencil"></i>',
                        'onclick' => 'app.editProducto(' . $item['id'] . ')'
                    ];

                    $a[] = [
                        'class'   => 'btn btn-sm btn-danger',
                        'html'    => '<i class="icon-toggle-on"></i>',
                        'onclick' => 'app.statusProducto(' . $item['id'] . ', ' . $item['active'] . ')'
                    ];
                } else {
                    $a[] = [
                        'class'   => 'btn btn-sm btn-outline-danger',
                        'html'    => '<i class="icon-toggle-off"></i>',
                        'onclick' => 'app.statusProducto(' . $item['id'] . ', ' . $item['active'] . ')'
                    ];
                }

                $rows[] = [
                    'id'       => $item['id'],
                    'Producto' => [
                            'class' => ' justify-start  px-2 py-2 ',
                            'html'  => renderProductImage($item['image'],$item['valor'])
                    ],
                    'Precio'          => evaluar($item['price']),
                    'Estado'          => renderStatus($item['active']),

                    // 'Inventario'  => $item['active'],
                    'Categoria'   => $item['classification'],
                    'Descripción' => $item['description'],

                    'a'               => $a
                ];
            }

            return [
                'row' => $rows,
                'ls'  => $data,
                $_SESSION['SUB']
            ];
        }

        function getProducto() {
            $id = $_POST['id'];
            $status = 404;
            $message = 'Producto no encontrado';
            $data = null;

            $producto = $this->getProductoById($id);

            if ($producto > 0) {
                $status  = 200;
                $message = 'Producto encontrado';
                $data    = $producto;
            }

            return [
                'status'  => $status,
                'message' => $message,
                'data'    => $data
            ];
        }

        function addProduct() {

            $status                   = 500;
            $message                  = 'No se pudo agregar el producto';
            $_POST['date_creation']   = date('Y-m-d H:i:s');
            $_POST['subsidiaries_id'] = $_SESSION['SUB'];

            $ruta                     = 'alpha_files/'.$_SESSION['COMPANY'].'/'.$_SESSION['SUB'].'/pedidos/';
            $oldFile                  = $_SERVER['DOCUMENT_ROOT'].'/'.$ruta;


            if (!file_exists($oldFile)) {
                mkdir($oldFile, 0777, true);
            }

            $exists = $this->existsProductoByName([$_POST['name'], $_SESSION['SUB']]);

            if (!$exists) {

                // Subir archivos si existen
                if (!empty($_FILES['archivos']['name'][0])) {
                    $files_up = [];

                    foreach ($_FILES['archivos']['name'] as $i => $nombreOriginal) {
                        if ($_FILES['archivos']['error'][$i] === UPLOAD_ERR_OK) {

                            $temporal    = $_FILES['archivos']['tmp_name'][$i];
                            $ext         = pathinfo($nombreOriginal, PATHINFO_EXTENSION);
                            $nuevoNombre = substr(md5(uniqid('', true)), 0, 8) . '.' . strtolower($ext);
                            $destino     = $oldFile.$nuevoNombre;

                        if (move_uploaded_file($temporal, $destino)) {
                            $_POST['image'] =  $ruta.$nuevoNombre;
                        }


                        }
                    }
                }


                $create = $this->createProducto($this->util->sql($_POST));
                if ($create) {
                    $status = 200;
                    $message = 'Producto agregado correctamente';
                }


            } else {
                $status = 409;
                $message = 'Ya existe un producto con ese nombre.';
            }

            return [

                'status'  => $status,
                'message' => $message,
                'data'    => $exists,


            ];
        }

        function editProduct() {
            $id      = $_POST['id'];
            $status  = 500;
            $message = 'Error al editar producto';

            // if (!$this->existsOtherProductoByName([$_POST['name'], $id, $_SESSION['SUB']])) {
            //     $status  = 409;
            //     $message = 'Ya existe otro producto con ese nombre.';
            //     return [
            //         'status'  => $status,
            //         'message' => $message,
            //         'post'    => $_POST
            //     ];
            // }

            $ruta    = 'alpha_files/' . $_SESSION['COMPANY'] . '/' . $_SESSION['SUB'] . '/pedidos/';
            $oldFile = $_SERVER['DOCUMENT_ROOT'] . '/' . $ruta;

            if (!file_exists($oldFile)) {
                mkdir($oldFile, 0777, true);
            }

            // Subida de imagen si existe
            $image = null;
            if (!empty($_FILES['archivos']['name'][0])) {
                foreach ($_FILES['archivos']['name'] as $i => $nombreOriginal) {
                    if ($_FILES['archivos']['error'][$i] === UPLOAD_ERR_OK) {
                        $temporal    = $_FILES['archivos']['tmp_name'][$i];
                        $ext         = pathinfo($nombreOriginal, PATHINFO_EXTENSION);
                        $nuevoNombre = substr(md5(uniqid('', true)), 0, 8) . '.' . strtolower($ext);
                        $destino     = $oldFile . $nuevoNombre;

                        if (move_uploaded_file($temporal, $destino)) {
                            $image = $ruta . $nuevoNombre;
                            break; // Solo se sube una imagen
                        }
                    }
                }
            }

            $data = [
                'name'            => $_POST['name'],
                'price'           => $_POST['price'],
                'description'     => $_POST['description'],
                'category_id'     => $_POST['category_id'],
                'subsidiaries_id' => $_SESSION['SUB']
            ];

            if ($image) {
                $data['image'] = $image;
            }

            $data['id'] = $id;
            $edit = $this->updateProducto( $this->util->sql($data, 1));

            if ($edit) {
                $status  = 200;
                $message = 'Producto editado correctamente';
            }

            return [
                'status'  => $status,
                'message' => $message,
                'post'    => $data
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
                'message' => $message,
                'update' => $update

            ];
        }

        // Category.

        function listCategory() {
            $__row = [];

            $ls    = $this->lsCategory([$_POST['active']]);

            foreach ($ls as $key) {

                $a = [];

                if ($key['active'] == 1) {
                    $a[] = [
                        'class'   => 'btn btn-sm btn-primary me-1',
                        'html'    => '<i class="icon-pencil"></i>',
                        'onclick' => 'category.editCategory(' . $key['id'] . ')'
                    ];

                    $a[] = [
                        'class'   => 'btn btn-sm btn-danger',
                        'html'    => '<i class="icon-toggle-on"></i>',
                        'onclick' => 'category.statusCategory(' . $key['id'] . ', ' . $key['active'] . ')'
                    ];
                } else {

                    $a[] = [
                        'class'   => 'btn btn-sm btn-outline-danger',
                        'html'    => '<i class="icon-toggle-off"></i>',
                        'onclick' => 'category.statusCategory(' . $key['id'] . ', ' . $key['active'] . ')'
                    ];
                }


                $__row[] = [
                    'id'          => $key['id'],
                    'Nombre'      => $key['valor'],
                    'Descripción' => $key['description'],
                    'Estado'      => renderStatus($key['active']),
                    'a'           => $a
                ];
            }

            return [
                'row' => $__row,
                'ls'  => $ls
            ];
        }

        function addCategory() {

            $_POST['date_creation']   = date('Y-m-d H:i:s');
            $_POST['active']          = 1;
            $_POST['subsidiaries_id'] = $_SESSION['SUB'];

            $data   = $this->util->sql($_POST);
            $create = $this->createCategory($data);

            return [
                'status'  => $create ? 200 : 500,
                'message' => $create ? 'Categoría agregada correctamente.' : 'No se pudo agregar.',
                $create,
                $data
            ];
        }

        function getCategories() {

            $get = $this->getCategoryById([$_POST['id']]);

            return [
                'status'  => $get ? 200 : 500,
                'message' => $get ? 'Datos obtenidos.' : 'Error al obtener.',
                'data'    => $get,
                'data'    => $get,
            ];
        }

        function editCategory() {

            $edit = $this->updateCategory($this->util->sql($_POST, 1));

            return [
                'status' => $edit ? 200 : 500,
                'message' => $edit ? 'Categoría actualizada.' : 'No se pudo actualizar.'
            ];
        }

        function statusCategory() {

            $update = $this->updateCategory($this->util->sql($_POST, 1));

            return [
                'status' => $update ? 200 : 500,
                'message' => $update ? 'Estado actualizado' : 'Error al cambiar estado'
            ];
        }

        // Client.

        function listClient() {
            $__row = [];

            $ls = $this->lsClient([1, $_SESSION['SUB']]);

            foreach ($ls as $key) {

                $a = [];

                $a[] = [
                    'class'   => 'btn btn-sm btn-primary me-1',
                    'html'    => '<i class="icon-pencil"></i>',
                    'onclick' => 'client.editClient(' . $key['id'] . ')'
                ];

                $a[] = [
                    'class'   => 'btn btn-sm btn-danger',
                    'html'    => '<i class="icon-trash"></i>',
                    'onclick' => 'client.deleteClient(' . $key['id'] . ')'
                ];

                $__row[] = [
                    'id'         => $key['id'],
                    'Nombre'     => $key['name'],
                    'Correo'     => $key['email'],
                    'Teléfono'   => $key['phone'],
                    'Registrado' => formatSpanishDate($key['date_create']),
                    'a'          => $a
                ];
            }

            return [
                'row' => $__row,
                'ls'  => $ls
            ];
        }

        function addClient() {
            // Validar teléfono
            if (!empty($_POST['phone'])) {
                $phone = preg_replace('/\D/', '', $_POST['phone']);
                if (strlen($phone) !== 10) {
                    return [
                        'status'  => 400,
                        'message' => 'El teléfono debe tener exactamente 10 dígitos.'
                    ];
                }
                $_POST['phone'] = $phone;
            }

            $_POST['date_create']    = date('Y-m-d H:i:s');
            $_POST['active']         = 1;
            $_POST['subsidiaries_id'] = $_SESSION['SUB'];

            $data   = $this->util->sql($_POST);
            $create = $this->createClient($data);

            return [
                'status'  => $create ? 200 : 500,
                'message' => $create ? 'Cliente registrado correctamente.' : 'Error al registrar.',
                $create,
                $data
            ];
        }

        function getClient() {
            $get = $this->getClientById([$_POST['id']]);

            return [
                'status'  => $get ? 200 : 500,
                'message' => $get ? 'Datos obtenidos.' : 'Error al obtener.',
                'data'    => $get
            ];
        }

        function editClient() {
            // Validar teléfono
            if (!empty($_POST['phone'])) {
                $phone = preg_replace('/\D/', '', $_POST['phone']);
                if (strlen($phone) !== 10) {
                    return [
                        'status'  => 400,
                        'message' => 'El teléfono debe tener exactamente 10 dígitos.'
                    ];
                }
                $_POST['phone'] = $phone;
            }

            $edit = $this->updateClient($this->util->sql($_POST, 1));

            return [
                'status' => $edit ? 200 : 500,
                'message' => $edit ? 'Cliente actualizado.' : 'No se pudo actualizar.',
                'post'=>$this->util->sql($_POST, 1)
            ];
        }

        function deleteClient() {
            $update = $this->updateClient($this->util->sql([
                'active' => 0,
                'id' => $_POST['id']
            ], 1));

            return [
                'status' => $update ? 200 : 500,
                'message' => $update ? 'Cliente eliminado correctamente.' : 'Error al eliminar.'
            ];
        }

        // Modifier.
        function listModifier() {
            $estado = $_POST['status'] ?? 1;

            $modifier = $this->getAllModifiers([$estado]);

            $rows = [];

            foreach ($modifier as $key) {
                $a = [];

                $a[] = [
                    'class'   => 'btn btn-sm btn-primary me-1',
                        'html'    => '<i class="icon-pencil"></i>',
                    'onclick' => 'mod.editModifier(' . $key['id'] . ')'
                ];

                $a[] = [
                    'class'   => 'btn btn-sm btn-danger  me-1',
                    'html'    => '<i class="icon-toggle-on"></i>',
                    'onclick' => 'mod.statusModifier(' . $key['id'] . ', ' . $key['active'] . ')'
                ];

                $a[] = [
                    'class'   => 'btn btn-sm btn-success',
                    'html'    => '<i class="icon-eye"></i>',
                    'onclick' => 'mod.showProducts(' . $key['id'] . ')'
                ];

                $productText = '';
                $prods = $this->getAllProducstModifiers([$key['id']]);
                
                if (!empty($prods)) {
                    $names = [];
                    foreach ($prods as $p) {
                        if (!empty($p['name'])) {
                            $names[] = '<span class="inline-flex items-center gap-2 justify-center min-w-[100px] px-2 py-1 rounded text-xs font-semibold bg-gray-700 text-gray-200  me-1" >' . $p['name'] . '</span>';
                        }
                    }

                    $productText = implode(' ', $names); 
                }

                $rows[] = [
                    'id'          => $key['id'],
                    'Nombre'      => $key['name'],
                    'Productos'   => $productText,
                    'Estado'      => renderStatus($key['active']),
                    'a' => $a,
                ];
            }

            return ['row' => $rows, 'ls' => $modifier];
        }

        function addModifier() {
            $_POST['date_creation'] = date('Y-m-d H:i:s');
            $_POST['active']        = 1;
            $_POST['cant']          = 1;

            // Verifica si ya existe el modificador
            $existe = $this->existsModifier([$_POST['name']]);

            if ($existe) {
                return [
                    'status'  => 400,
                    'message' => 'Ya existe un producto con ese nombre en este modificador.',
                ];
            }

            $create = $this->createModifier($this->util->sql($_POST));
            $idProduct = $this->maxModifier();

           
            return [
                'id'      => $idProduct,
                'status'  => $create ? 200 : 500,
              
            ];
        }

        function editModifier() {
            $edit = $this->updateModifier($this->util->sql($_POST, 1));

            return [
                'status'  => $edit ? 200 : 500,
                'message' => $edit ? "Se actualizó correctamente." : "Error al editar.",
            ];
        }

        function getModifier() {
            $data = $this->getModifierById([$_POST['id']]);

            return [
                'status'  => $data ? 200 : 500,
                'message' => $data ? 'Datos encontrados.' : 'No encontrado.',
                'data'    => $data,
                'ls'    => $this->getAllProducstModifiers([$_POST['id']]),

            ];
        }

        public function statusModifier() {

            $updated = $this->updateModifier($this->util->sql($_POST, 1));

            return [
                'status'  => $updated ? 200 : 500,
                'message' => $updated ? 'Estado actualizado.' : 'Error al actualizar estado.',
                'active'  => $_POST['active'],
                $updated
            ];
        }

        function deleteProductModifier() {

            $del = $this->updateProductModifier($this->util->sql([
                'active' => 0,
                'id'     => $_POST['id']

            ],1));

            return [
                'data'    => $this->getAllProducstModifiers([$_POST['idProduct']]),
                'status' => $del ? 200 : 500,
                'message' => $del ? 'Cliente eliminado correctamente.' : 'Error al eliminar.'
            ];
        }

        // Modifier Product.

        function addProductModifier(){

            $_POST['date_creation'] = date('Y-m-d H:i:s');
            $_POST['active']        = 1;
            
            // Verifica si ya existe el producto
            $existe = $this->existsProductModifier([$_POST['name'], $_POST['modifier_id']]);
            
            if ($existe) {
                return [
                    'status'  => 400,
                    'message' => 'Ya existe un producto con ese nombre en este modificador.',
                    'data'    => $this->getAllProducstModifiers([$_POST['modifier_id']]),
                ];
            }
            
            $create = $this->createProductModifier($this->util->sql($_POST));
            
            return [
                'data'    => $this->getAllProducstModifiers([$_POST['modifier_id']]),
                'status'  => $create ? 200 : 500,
                $existe,
                'message' => $create ? "Modificador agregado correctamente." : "Error al guardar.",
            ];
        }

        function getProductModifier() {
            $data = $this->getProductModifierById([$_POST['id']]);

            return [
                'status'  => $data ? 200 : 500,
                'message' => $data ? 'Datos encontrados.' : 'No encontrado.',
                'data'    => $data,
                'ls'    => $this->getAllProducstModifiers([$_POST['id']]),

            ];
        }

        function editProductModifier() {
            $edit = $this->updateProductModifier($this->util->sql($_POST, 1));

            return [
                'status'  => $edit ? 200 : 500,
                'message' => $edit ? "Se actualizó correctamente." : "Error al editar.",
            ];
        }

        function updateProductModifierPrice() {
            $id = $_POST['id'];
            $price = $_POST['price'];
            
            // Validar que el precio sea válido
            if (!is_numeric($price) || $price < 0) {
                return [
                    'status'  => 400,
                    'message' => 'El precio debe ser un número válido mayor o igual a 0.'
                ];
            }
            
            $update = $this->updateProductModifier($this->util->sql([
                'price' => $price,
                'id' => $id
            ], 1));

            return [
                'status'  => $update ? 200 : 500,
                'message' => $update ? 'Precio actualizado correctamente.' : 'Error al actualizar el precio.',
                'data' => [
                    'id' => $id,
                    'price' => $price
                ]
            ];
        }


        // modifierProduct.

        public function lsModifierProduct() {
            $__row      = [];
            $active     = $_POST['estado'];
            if($_POST['modifier'] == 0){
                $list = $this->lsModifierOrderProducts([$active]);
          
            }else{

                $list = $this->lsModifierOrderProducts([$active,$_POST['modifier']]);
            }

            foreach ($list as $key) {
                $a = [];

                $a[] = [
                    'class' => 'btn btn-sm btn-primary me-1',
                    'html' => '<i class="icon-pencil"></i>',
                    'onclick' => 'product.editModifier(' . $key['id'] . ')'
                ];

                $a[] = [
                    'class' => 'btn btn-sm btn-danger',
                    'html' => '<i class="icon-toggle-on"></i>',
                    'onclick' => 'product.statusModifier(' . $key['id'] . ', ' . $key['active'] . ')'
                ];

                $__row[] = [
                    'id'          => $key['id'],
                    'Nombre'      => $key['name'],
                    'Modificador' => $key['modifier'],
                    // 'Cantidad'    => evaluar($key['price']),
                    'Precio'      => evaluar($key['price']),
                    'Estado'      => renderStatus($key['active']),
                    'a'           => $a
                ];
            }

            return ['row' => $__row, 'ls' => $list];
        }

        public function statusModifierProduct() {
            $update          = $this->updateModifierProduct($this->util->sql($_POST, 1));
            $status          = $update ? 200 : 500;

            return [
                'status' => $status,
                'message' => $status === 200 ? 'Estado actualizado' : 'Error al actualizar estado'
            ];
        }






    }

// Complements.


  function renderProductImage($foto, $nombre) {
    $src = !empty($foto) ? 'https://huubie.com.mx/' . $foto : '';

    $img = !empty($src)
        ? '<img src="' . $src . '" alt="Imagen Producto" class="w-12 h-12 bg-gray-500 rounded-md object-cover" />'
        : '<div class="w-12 h-12 bg-[#1F2A37] rounded-md flex items-center justify-center">
                <i class=" icon-birthday text-gray-500"></i>
        </div>';

    return '
        <div class="flex items-center justify-start gap-2">
            ' . $img . '
            <div class="text-sm text-white">' . htmlspecialchars($nombre) . '</div>
        </div>';
  }

  function renderStatus($estatus) {
        switch ($estatus) {
            case 1:
                return '<span class="px-2 py-1 rounded-md text-sm font-semibold bg-[#014737] text-[#3FC189]">Activo</span>';
            case 0:
                return '<span class="px-2 py-1 rounded-md text-sm font-semibold bg-[#721c24] text-[#ba464d]">Inactivo</span>';
            case 2:
                return '<span class="px-2 py-1 rounded-md text-sm font-semibold bg-[#8a4600] text-[#f0ad28]">Borrador</span>';
            default:
                return '<span class="px-2 py-1 rounded-md text-sm font-semibold bg-gray-500 text-white">Desconocido</span>';
        }
  }




$obj = new ctrl();
echo json_encode($obj->{$_POST['opc']}());
