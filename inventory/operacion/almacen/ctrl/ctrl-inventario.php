<?php
if (empty($_POST['opc'])) exit(0);

session_start();
require_once '../mdl/mdl-inventario.php';

class ctrl extends mdl {

    function init() {
        return [
            'tipoMovimiento' => $this->lsTipoMovimiento(),
            'productos'      => $this->lsProductos()
        ];
    }

    function lsMovimientos() {
        $fi   = $_POST['fi'];
        $ff   = $_POST['ff'];
        $tipo = $_POST['tipo_movimiento'] ?? 'Todos';

        $ls   = $this->listMovimientos([$fi, $ff, $tipo, $tipo]);
        $rows = [];

        foreach ($ls as $item) {
            $a = [];

            if ($item['estado'] == 'Activa') {
                $a[] = [
                    'class'   => 'btn btn-sm btn-primary me-1',
                    'html'    => '<i class="icon-pencil"></i>',
                    'onclick' => 'captura.render(' . $item['id_movimiento'] . ')'
                ];
                $a[] = [
                    'class'   => 'btn btn-sm btn-danger',
                    'html'    => '<i class="icon-cancel"></i>',
                    'onclick' => 'inventario.cancelMovimiento(' . $item['id_movimiento'] . ')'
                ];
            }else{
               $a[] = [
                    'class'   => 'btn btn-sm btn-primary disabled me-1',
                    'html'    => '<i class="icon-pencil"></i>',
                ];
            }

            $rows[] = [
                'id'              => $item['id_movimiento'],
                'Folio'           => $item['folio'],
                'Fecha'           => $item['fecha'],
                'Tipo'            => renderTipoMovimiento($item['tipo_movimiento']),
                'Total Productos' => $item['total_productos'],
                'Total Unidades'  => $item['total_unidades'],
                'Estado'          => renderEstado($item['estado']),
                'Creado por'      => $item['responsable'],
                'a'               => $a
            ];
        }

        return [
            'row' => $rows,
            'ls'  => $ls
        ];
    }

    function addMovimiento() {
        $status      = 500;
        $message     = 'Error al crear movimiento';

        $maxFolio    = $this->getMaxFolio([$_SESSION['idUDN']]);
        $nuevoNumero = $maxFolio + 1;
        $folio       = formatFolio($nuevoNumero);

        $_POST['folio']          = $folio;
        $_POST['total_products'] = 0;
        $_POST['total_units']    = 0;
        $_POST['status']         = 'Activa';
        $_POST['user_id']        = $_SESSION['IDU'];
        $_POST['udn_id']         = $_SESSION['idUDN'];

        $create = $this->createMovimiento($this->util->sql($_POST));

        if ($create) {
            $status        = 200;
            $message       = 'Lista creada exitosamente';
            $id_movimiento = $this->getMaxMovimientoId();
        }

        return [
            'status'        => $status,
            'message'       => $message,
            'id_movimiento' => $id_movimiento,
            'folio'         => $folio,
            $_SESSION['idUDN'],
           $_POST

        ];
    }

    function getMovimiento() {
        $id      = $_POST['id'];
        $status  = 404;
        $message = 'Movimiento no encontrado';
        $data    = null;

        $movimiento = $this->getMovimientoById($id);

        if ($movimiento) {
            $status = 200;
            $message = 'Movimiento encontrado';
            $data = $movimiento;
        }

        return [
            'status'  => $status,
            'message' => $message,
            'data'    => $data
        ];
    }

    function editMovimiento() {
        $id      = $_POST['id'];
        $status  = 500;
        $message = 'Error al editar movimiento';

        $edit    = $this->updateMovimiento($this->util->sql($_POST, 1));

        if ($edit) {
            $status = 200;
            $message = 'Movimiento actualizado correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
    }

    function cancelMovimiento() {
        $id      = $_POST['id'];
        $status  = 500;
        $message = 'Error al cancelar movimiento';

        $movimiento = $this->getMovimientoById($id);

        if ($movimiento && $movimiento['status'] == 'Activa') {
            $detalles = $this->listDetalleMovimiento([$id]);

            foreach ($detalles as $detalle) {
                $stockAnterior = $detalle['stock_anterior'];
                $this->updateStockProducto([
                    'values' => 'quantity = ?',
                    'data'   => [$stockAnterior, $detalle['id_producto']]
                ]);
            }

            $cancel = $this->updateMovimiento([
                'values' => 'status = ?',
                'where'  => 'id = ?',
                'data'   => ['Cancelada', $id]
            ]);

            if ($cancel) {
                $status = 200;
                $message = 'Movimiento cancelado y stock revertido';
            }
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
    }

    // Capture Details

    function lsDetalleMovimiento() {
        $idMovimiento = $_POST['id_movimiento'];
        $ls           = $this->listDetalleMovimiento([$idMovimiento]);
        $rows         = [];

        foreach ($ls as $item) {
            $rows[] = [
                'id'       => $item['id_detalle'],
                '#'                => count($rows) + 1,
                'Producto'         => $item['nombre_producto'],
                'Stock Actual'     => $item['stock_actual'],
                'Cantidad'         => [
                    'html'  => '<span class="text-green-600 font-bold">+' . $item['cantidad'] . '</span>',
                    'class' => 'text-center '
                ],
                'Stock Resultante' => $item['stock_resultante'],
                'a'                => [
                    [
                        'class'   => 'btn btn-sm btn-danger',
                        'html'    => '<i class="icon-trash"></i>',
                        'onclick' => 'captura.deleteProducto(' . $item['id_detalle'] . ')'
                    ]
                ]
            ];
        }

        return [
            'row' => $rows,
            'ls'  => $ls,
            '$_SESION' => $_COOKIE
        ];
    }

    function addProductoMovimiento() {
        $status  = 500;
        $message = 'Error al agregar producto';

        $idMovimiento = $_POST['id_movimiento'];
        $idProducto   = $_POST['product_id'];
        $cantidad     = intval($_POST['quantity']);

        if ($cantidad <= 0) {
            return [
                'status'  => 400,
                'message' => 'La cantidad debe ser mayor a cero'
            ];
        }

        $stockActual     = $this->getStockProducto($idProducto);
        $movimiento      = $this->getMovimientoById($idMovimiento);
        $tipoMovimiento  = $movimiento['tipo_movimiento'];

        $stockResultante = ($tipoMovimiento == 'Entrada')
            ? $stockActual + $cantidad
            : $stockActual - $cantidad;

        $_POST['previous_stock']  = $stockActual;
        $_POST['resulting_stock'] = $stockResultante;

        $create = $this->createDetalleMovimiento($this->util->sql($_POST));

        if ($create) {
            $status = 200;
            $message = 'Producto agregado exitosamente';
        }

        return [
            'status'           => $status,
            'message'          => $message,
            'stock_actual'     => $stockActual,
            'stock_resultante' => $stockResultante
        ];
    }

    function deleteProductoMovimiento() {
        $idDetalle = $_POST['id'];
        $status    = 500;
        $message   = 'Error al eliminar producto';


        $values = $this->util->sql(['id' => $idDetalle], 1);

        $delete    = $this->deleteDetalleMovimientoById($values);

        if ($delete) {
            $status = 200;
            $message = 'Producto eliminado correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message,
             $values,
             $delete
        ];
    }

    function getResumenInventario() {
        $resumen = $this->getResumenStock();

        return [
            'status'           => 200,
            'total_productos'  => $resumen['total_productos'] ?? 0,
            'total_unidades'   => $resumen['total_unidades'] ?? 0,
            'productos_bajos'  => $resumen['productos_bajos'] ?? 0,
            'valor_inventario' => $resumen['valor_inventario'] ?? 0
        ];
    }

    function lsProductosBajoStock() {
        $minimo = $_POST['stock_minimo'] ?? 5;
        $ls     = $this->listProductosBajoStock([$minimo]);
        $rows   = [];

        foreach ($ls as $item) {
            $rows[] = [
                'id'       => $item['id'],
                'Producto' => $item['nombre'],
                'Stock'    => [
                    'html'  => '<span class="text-red-600 font-bold">' . $item['stock_actual'] . '</span>',
                    'class' => 'text-center'
                ],
                'Mínimo'   => $minimo,
                'Estado'   => '<span class="px-2 py-1 rounded-md text-xs font-semibold bg-red-100 text-red-700">Bajo Stock</span>'
            ];
        }

        return [
            'row' => $rows,
            'ls'  => $ls
        ];
    }

    function lsHistorialProducto() {
        $idProducto = $_POST['id_producto'];
        $ls         = $this->listHistorialProducto([$idProducto]);
        $rows       = [];

        foreach ($ls as $item) {
            $cantidadHtml = $item['tipo_movimiento'] == 'Entrada'
                ? '<span class="text-green-600 font-bold">+' . $item['cantidad'] . '</span>'
                : '<span class="text-red-600 font-bold">-' . $item['cantidad'] . '</span>';

            $rows[] = [
                'id'               => $item['id_detalle'],
                'Fecha'            => $item['fecha'],
                'Folio'            => $item['folio'],
                'Tipo'             => renderTipoMovimiento($item['tipo_movimiento']),
                'Cantidad'         => [
                    'html'  => $cantidadHtml,
                    'class' => 'text-center'
                ],
                'Stock Anterior'   => $item['stock_anterior'],
                'Stock Resultante' => $item['stock_resultante']
            ];
        }

        return [
            'row' => $rows,
            'ls'  => $ls
        ];
    }

    function editMovimientoDetalle() {
        $idDetalle = $_POST['id'];
        $cantidad  = intval($_POST['quantity']);
        $status    = 500;
        $message   = 'Error al actualizar cantidad';

        if ($cantidad <= 0) {
            return [
                'status'  => 400,
                'message' => 'La cantidad debe ser mayor a cero'
            ];
        }

        $detalle    = $this->getDetalleById($idDetalle);
        $movimiento = $this->getMovimientoById($detalle['id_movimiento']);

        if ($movimiento['status'] != 'Activa') {
            return [
                'status'  => 400,
                'message' => 'No se puede editar un movimiento cerrado'
            ];
        }

        $stockActual     = $this->getStockProducto($detalle['id_producto']);
        $tipoMovimiento  = $movimiento['tipo_movimiento'];

        $stockResultante = ($tipoMovimiento == 'Entrada')
            ? $stockActual + $cantidad
            : $stockActual - $cantidad;

        $update = $this->updateDetalleMovimiento([
            'values' => 'quantity = ?, resulting_stock = ?',
            'where'  => 'id = ?',
            'data'   => [$cantidad, $stockResultante, $idDetalle]
        ]);

        if ($update) {
            $status = 200;
            $message = 'Cantidad actualizada correctamente';
        }

        return [
            'status'           => $status,
            'message'          => $message,
            'stock_resultante' => $stockResultante
        ];
    }

    function getDetalleMovimiento() {
        $idDetalle = $_POST['id'];
        $status    = 404;
        $message   = 'Detalle no encontrado';
        $data      = null;

        $detalle = $this->getDetalleById($idDetalle);

        if ($detalle) {
            $status = 200;
            $message = 'Detalle encontrado';
            $data = $detalle;
        }

        return [
            'status'  => $status,
            'message' => $message,
            'data'    => $data
        ];
    }

    function validarStock() {
        $idProducto     = $_POST['product_id'];
        $cantidad       = intval($_POST['quantity']);
        $tipoMovimiento = $_POST['tipo_movimiento'];

        $stockActual = $this->getStockProducto($idProducto);

        if ($tipoMovimiento == 'Salida' && $cantidad > $stockActual) {
            return [
                'status'       => 400,
                'message'      => 'Stock insuficiente. Disponible: ' . $stockActual,
                'stock_actual' => $stockActual,
                'valido'       => false
            ];
        }

        $stockResultante = ($tipoMovimiento == 'Entrada')
            ? $stockActual + $cantidad
            : $stockActual - $cantidad;

        return [
            'status'           => 200,
            'message'          => 'Stock válido',
            'stock_actual'     => $stockActual,
            'stock_resultante' => $stockResultante,
            'valido'           => true
        ];
    }

    function guardarMovimiento() {
        $idMovimiento = $_POST['id_movimiento'];
        $status       = 500;
        $message      = 'Error al guardar movimiento';

        $detalles = $this->listDetalleMovimiento([$idMovimiento]);

        if (count($detalles) == 0) {
            return [
                'status'  => 400,
                'message' => 'Debe agregar al menos un producto'
            ];
        }

        $movimiento      = $this->getMovimientoById($idMovimiento);
        $tipoMovimiento  = $movimiento['tipo_movimiento'];

        $totalProductos  = count($detalles);
        $totalUnidades   = 0;

        foreach ($detalles as $detalle) {
            $totalUnidades += $detalle['cantidad'];

            $nuevoStock = $detalle['stock_resultante'];
            $this->updateStockProducto([
                'values' => 'quantity = ?',
                'data'   => [$nuevoStock, $detalle['id_producto']]
            ]);
        }

        $update = $this->updateMovimiento([
            'values' => 'total_products = ?, total_units = ?, status = ?',
            'where'  => 'id = ?',
            'data'   => [$totalProductos, $totalUnidades, 'Activa', $idMovimiento]
        ]);

        if ($update) {
            $status = 200;
            $message = 'Lista guardada exitosamente';
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
    }
}

// Complements

function renderEstado($estado) {
    switch ($estado) {
        case 'Activa':
            return '<span class="inline-block px-3 py-1 rounded-2xl text-sm font-semibold bg-green-100 text-green-700 min-w-[100px] text-center">Activa</span>';
        case 'Cancelada':
            return '<span class="inline-block px-3 py-1 rounded-2xl text-sm font-semibold bg-red-100 text-red-700 min-w-[100px] text-center">Cancelada</span>';
        default:
            return '<span class="inline-block px-3 py-1 rounded-2xl text-sm font-semibold bg-gray-100 text-gray-700 min-w-[100px] text-center">Desconocido</span>';
    }
}

function renderTipoMovimiento($tipo) {
    switch ($tipo) {
        case 'Entrada':
            return '<span class="inline-block px-3 py-1 rounded-2xl text-sm font-semibold bg-blue-100 text-blue-700 min-w-[100px] text-center"> <i class="icon-up-big"></i> Entrada</span>';
        case 'Salida':
            return '<span class="inline-block px-3 py-1 rounded-2xl text-sm font-semibold bg-red-100 text-red-700 min-w-[100px] text-center"><i class=" icon-down-big"></i>  Salida</span>';
        default:
            return $tipo;
    }
}

function formatFolio($numero) {
    return 'MOV-' . str_pad($numero, 3, '0', STR_PAD_LEFT);
}

$obj = new ctrl();
echo json_encode($obj->{$_POST['opc']}());
