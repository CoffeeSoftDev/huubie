<?php
if (empty($_POST['opc'])) exit(0);

// session_start();
require_once '../mdl/mdl-inventario.php';

class ctrl extends mdl {

    function init() {
        return [
            'productos'   => $this->lsProductos(),
            'almacenes'   => $this->lsAlmacenes(),
            'origenes'    => $this->lsInflowOrigins(),
            'proveedores' => $this->lsSuppliers([$_SESSION['companies_id']]),
            'motivos'     => $this->lsShrinkageReasons()
        ];
    }

    function addMovimiento() {
        $tipo        = $_POST['tipo'];
        $warehouseId = $_POST['warehouse_id'];
        $note        = $_POST['note'];
        $lineas      = json_decode($_POST['lineas'], true);

        if (empty($lineas)) {
            return ['status' => 400, 'message' => 'Debe agregar al menos un insumo'];
        }

        $companies_id    = $_SESSION['companies_id'];
        $subsidiaries_id = $_SESSION['subsidiaries_id'];
        $userId          = $_SESSION['user_id'];
        $today           = date('Y-m-d');

        if ($tipo == 'Salida') {
            foreach ($lineas as $l) {
                $row  = $this->getStockRow([$l['item_id'], $warehouseId]);
                $disp = $row ? floatval($row['quantity']) : 0;
                if (floatval($l['quantity']) > $disp) {
                    return ['status' => 400, 'message' => 'Stock insuficiente. Disponible: ' . $disp];
                }
            }
        }

        $totalProducts = count($lineas);
        $totalUnits    = 0;
        $totalCost     = 0;
        foreach ($lineas as $l) {
            $totalUnits += floatval($l['quantity']);
            $totalCost  += floatval($l['quantity']) * floatval($l['cost']);
        }

        $movType = $tipo == 'Entrada' ? 'ENTRADA' : 'MERMA';

        if ($tipo == 'Entrada') {
            $folio = $this->nextFolio('ENT-', 'inventory_inflow');
            $this->insertInflow([$folio, $note, $totalProducts, $totalUnits, $totalCost, $today, 'Aplicada', $warehouseId, $userId, $subsidiaries_id, $companies_id]);
            $headerId = $this->getMaxId('inventory_inflow');
        } else {
            $folio = $this->nextFolio('SAL-', 'inventory_shrinkage');
            $this->insertShrinkage([$folio, $note, $totalProducts, $totalUnits, $totalCost, $today, 'Aplicada', $warehouseId, $userId, $subsidiaries_id, $companies_id]);
            $headerId = $this->getMaxId('inventory_shrinkage');
        }

        foreach ($lineas as $l) {
            $itemId = $l['item_id'];
            $qty    = floatval($l['quantity']);
            $cost   = floatval($l['cost']);
            $sub    = $qty * $cost;
            $unitId = array_key_exists('unit_id', $l) ? $l['unit_id'] : null;

            $row       = $this->getStockRow([$itemId, $warehouseId]);
            $prev      = $row ? floatval($row['quantity']) : 0;
            $post      = $tipo == 'Entrada' ? $prev + $qty : $prev - $qty;
            $signedQty = $tipo == 'Entrada' ? $qty : -$qty;

            if ($tipo == 'Entrada') {
                $this->insertInflowDetail([$qty, $cost, $sub, $prev, $post, $itemId, $headerId, $unitId]);
            } else {
                $this->insertShrinkageDetail([$qty, $cost, $sub, $prev, $post, $itemId, $headerId]);
            }

            if ($row) {
                $this->updateStockQty([$post, $row['id']]);
            } else {
                $this->insertStock([$post, $warehouseId, $itemId, $companies_id]);
            }

            $this->insertMovement([$movType, $folio, $signedQty, $prev, $post, $cost, $sub, 'Aplicada', $itemId, $warehouseId, $userId, $subsidiaries_id, $companies_id]);
        }

        return [
            'status'  => 200,
            'message' => 'Movimiento aplicado correctamente',
            'folio'   => $folio
        ];
    }

    function lsMovimientos() {
        $fi   = $_POST['fi'];
        $ff   = $_POST['ff'];
        $tipo = $_POST['tipo_movimiento'];

        $ls   = $this->listMovimientos([$fi, $ff, $tipo, $tipo]);
        $rows = [];

        foreach ($ls as $m) {
            $signo  = $m['quantity'] >= 0 ? '+' : '';
            $color  = $m['quantity'] >= 0 ? 'text-green-600' : 'text-red-600';

            $rows[] = [
                'id'          => $m['id'],
                'Folio'       => $m['folio'],
                'Fecha'       => $m['fecha'],
                'Tipo'        => renderTipoMovimiento($m['tipo']),
                'Insumo'      => $m['producto'],
                'Cantidad'    => [
                    'html'  => '<span class="' . $color . ' font-bold">' . $signo . $m['quantity'] . '</span>',
                    'class' => 'text-center'
                ],
                'Stock'       => $m['stock_post'],
                'Costo'       => [
                    'html'  => '$' . number_format($m['cost_total'], 2),
                    'class' => 'text-end'
                ],
                'Responsable' => $m['responsable']
            ];
        }

        return ['row' => $rows];
    }

    function getResumenInventario() {
        $resumen = $this->getResumenStock();

        return [
            'status'           => 200,
            'total_productos'  => $resumen['total_productos'] ?? 0,
            'total_unidades'   => $resumen['total_unidades'] ?? 0,
            'productos_bajos'  => $resumen['productos_bajos'] ?? 0,
            'valor_inventario' => '$' . number_format($resumen['valor_inventario'] ?? 0, 2)
        ];
    }

    function lsProductosBajoStock() {
        $ls   = $this->listProductosBajoStock([]);
        $rows = [];

        foreach ($ls as $item) {
            $rows[] = [
                'id'       => $item['id'],
                'Insumo'   => $item['nombre'],
                'Stock'    => [
                    'html'  => '<span class="text-red-600 font-bold">' . $item['stock_actual'] . '</span>',
                    'class' => 'text-center'
                ],
                'Mínimo'   => $item['minimo'],
                'Estado'   => '<span class="px-2 py-1 rounded-md text-xs font-semibold bg-red-100 text-red-700">Bajo stock</span>'
            ];
        }

        return ['row' => $rows];
    }

    function lsHistorialProducto() {
        $idProducto = $_POST['id_producto'];
        $ls         = $this->listHistorialProducto([$idProducto]);
        $rows       = [];

        foreach ($ls as $m) {
            $signo = $m['quantity'] >= 0 ? '+' : '';
            $color = $m['quantity'] >= 0 ? 'text-green-600' : 'text-red-600';

            $rows[] = [
                'id'             => $m['id'],
                'Fecha'          => $m['fecha'],
                'Folio'          => $m['folio'],
                'Tipo'           => renderTipoMovimiento($m['tipo']),
                'Cantidad'       => [
                    'html'  => '<span class="' . $color . ' font-bold">' . $signo . $m['quantity'] . '</span>',
                    'class' => 'text-center'
                ],
                'Stock Anterior' => $m['stock_prev'],
                'Stock Final'    => $m['stock_post']
            ];
        }

        return ['row' => $rows];
    }

    // ─────────────────────────────────────────────────────────────────
    //  Entradas (inventory_inflow)
    // ─────────────────────────────────────────────────────────────────

    function initEntradas() {
        return [
            'status'      => 200,
            'origenes'    => $this->lsInflowOrigins(),
            'almacenes'   => $this->lsAlmacenes(),
            'proveedores' => $this->lsSuppliers([$_SESSION['companies_id']]),
            'productos'   => $this->lsProductos()
        ];
    }

    function lsEntradas() {
        $ls = $this->listEntradas([
            'companies_id'    => $_SESSION['companies_id'],
            'subsidiaries_id' => $_SESSION['subsidiaries_id'],
            'origin_id'       => $_POST['origin_id'] ?? '',
            'status'          => $_POST['status']    ?? '',
            'fi'              => $_POST['fi']         ?? '',
            'ff'              => $_POST['ff']         ?? ''
        ]);

        $rows = [];
        foreach ($ls as $e) {
            $rows[] = [
                'id'          => $e['id'],
                'Folio'       => $e['folio'],
                'Fecha'       => $e['date_inflow'],
                'Origen'      => $e['origin_name'] ?: '-',
                'Almacén'     => $e['warehouse_name'] ?: '-',
                'Proveedor'   => $e['supplier_name'] ?: '-',
                'Productos'   => ['html' => $e['total_products'], 'class' => 'text-center'],
                'Unidades'    => ['html' => $e['total_units'], 'class' => 'text-center'],
                'Costo'       => ['html' => '$' . number_format($e['total_cost'], 2), 'class' => 'text-end'],
                'Estado'      => renderEstadoInv($e['status']),
                'Responsable' => $e['user_name'] ?: '-',
                'a' => [
                    [
                        'class'   => 'btn btn-sm btn-secondary me-1',
                        'html'    => '<i class="icon-eye"></i>',
                        'onclick' => 'entradas.verEntrada(' . $e['id'] . ')'
                    ],
                    [
                        'class'   => $e['status'] === 'Cancelada' ? 'btn btn-sm btn-outline-danger disabled' : 'btn btn-sm btn-danger',
                        'html'    => '<i class="icon-cancel"></i>',
                        'onclick' => 'entradas.cancelEntrada(' . $e['id'] . ')'
                    ]
                ]
            ];
        }
        return ['row' => $rows];
    }

    function showEntradas() {
        $kpis = $this->getEntradaKpis([
            'companies_id'    => $_SESSION['companies_id'],
            'subsidiaries_id' => $_SESSION['subsidiaries_id'],
            'fi'              => $_POST['fi'] ?? '',
            'ff'              => $_POST['ff'] ?? ''
        ]);
        return ['status' => 200, 'counts' => $kpis];
    }

    function getEntrada() {
        $id     = $_POST['id'];
        $header = $this->getEntradaHeader([$id]);
        if (!$header) return ['status' => 404, 'message' => 'Entrada no encontrada'];
        $detail = $this->getEntradaDetail([$id]);
        return ['status' => 200, 'header' => $header, 'detail' => $detail];
    }

    function saveEntrada() {
        $payload   = json_decode($_POST['payload'], true);
        $productos = $payload['productos'] ?? [];

        if (empty($productos)) {
            return ['status' => 400, 'message' => 'Debe agregar al menos un producto'];
        }

        $companiesId    = $_SESSION['companies_id'];
        $subsidiariesId = $_SESSION['subsidiaries_id'];
        $userId         = $_SESSION['user_id'];
        $warehouseId    = $payload['warehouse_id'];
        $originId       = $payload['inflow_origin_id'];
        $supplierId     = !empty($payload['supplier_id']) ? $payload['supplier_id'] : null;
        $note           = $payload['note'] ?? null;
        $dateInflow     = !empty($payload['date_inflow']) ? $payload['date_inflow'] : date('Y-m-d');

        $totalProducts = count($productos);
        $totalUnits    = 0;
        $totalCost     = 0;
        foreach ($productos as $p) {
            $totalUnits += floatval($p['quantity']);
            $totalCost  += floatval($p['quantity']) * floatval($p['cost']);
        }

        $folio = $this->nextFolio('ENT-', 'inventory_inflow');
        $this->insertEntrada([
            $folio, $note, $totalProducts, $totalUnits, $totalCost, $dateInflow, 'Aplicada',
            $originId, $warehouseId, $supplierId, $subsidiariesId, $userId, $companiesId
        ]);
        $headerId = $this->getMaxId('inventory_inflow');

        foreach ($productos as $p) {
            $itemId  = $p['item_id'];
            $qty     = floatval($p['quantity']);
            $cost    = floatval($p['cost']);
            $sub     = $qty * $cost;
            $batch   = !empty($p['batch_code']) ? $p['batch_code'] : null;
            $expires = !empty($p['expires_at']) ? $p['expires_at'] : null;
            $unitId  = !empty($p['unit_id']) ? $p['unit_id'] : null;

            $row  = $this->getStockRow([$itemId, $warehouseId]);
            $prev = $row ? floatval($row['quantity']) : 0;
            $post = $prev + $qty;

            $this->insertEntradaDetail([$batch, $qty, $cost, $sub, $prev, $post, $expires, $itemId, $headerId, $unitId]);

            if ($row) {
                $this->updateStockQty([$post, $row['id']]);
            } else {
                $this->insertStock([$post, $warehouseId, $itemId, $companiesId]);
            }

            $this->insertMovement(['ENTRADA', $folio, $qty, $prev, $post, $cost, $sub, 'Aplicada', $itemId, $warehouseId, $userId, $subsidiariesId, $companiesId]);
        }

        return ['status' => 200, 'message' => 'Entrada registrada correctamente', 'folio' => $folio, 'id' => $headerId];
    }

    function cancelEntrada() {
        $id     = $_POST['id'];
        $header = $this->getEntradaHeader([$id]);

        if (!$header) return ['status' => 404, 'message' => 'Entrada no encontrada'];
        if ($header['status'] === 'Cancelada') return ['status' => 400, 'message' => 'La entrada ya está cancelada'];

        $warehouseId = $header['warehouse_id'];
        $detail      = $this->getEntradaDetail([$id]);
        foreach ($detail as $d) {
            $row = $this->getStockRow([$d['item_id'], $warehouseId]);
            if ($row) {
                $post = max(0, floatval($row['quantity']) - floatval($d['quantity']));
                $this->updateStockQty([$post, $row['id']]);
            }
        }

        $this->cancelEntradaById([$id]);
        return ['status' => 200, 'message' => 'Entrada cancelada y stock revertido'];
    }

    // ─────────────────────────────────────────────────────────────────
    //  Salidas (inventory_shrinkage)
    // ─────────────────────────────────────────────────────────────────

    function initSalidas() {
        return [
            'status'    => 200,
            'motivos'   => $this->lsShrinkageReasons(),
            'almacenes' => $this->lsAlmacenes(),
            'productos' => $this->lsProductos()
        ];
    }

    function lsSalidas() {
        $ls = $this->listSalidas([
            'companies_id'    => $_SESSION['companies_id'],
            'subsidiaries_id' => $_SESSION['subsidiaries_id'],
            'reason_id'       => $_POST['reason_id'] ?? '',
            'status'          => $_POST['status']    ?? '',
            'fi'              => $_POST['fi']         ?? '',
            'ff'              => $_POST['ff']         ?? ''
        ]);

        $rows = [];
        foreach ($ls as $m) {
            $rows[] = [
                'id'          => $m['id'],
                'Folio'       => $m['folio'],
                'Fecha'       => $m['date_shrinkage'],
                'Motivo'      => $m['reason_name'] ?: '-',
                'Almacén'     => $m['warehouse_name'] ?: '-',
                'Productos'   => ['html' => $m['total_products'], 'class' => 'text-center'],
                'Unidades'    => ['html' => $m['total_units'], 'class' => 'text-center'],
                'Costo'       => ['html' => '<span class="text-red-600">$' . number_format($m['total_cost'], 2) . '</span>', 'class' => 'text-end'],
                'Estado'      => renderEstadoInv($m['status']),
                'Responsable' => $m['user_name'] ?: '-',
                'a' => [
                    [
                        'class'   => 'btn btn-sm btn-secondary me-1',
                        'html'    => '<i class="icon-eye"></i>',
                        'onclick' => 'salidas.verSalida(' . $m['id'] . ')'
                    ],
                    [
                        'class'   => $m['status'] === 'Cancelada' ? 'btn btn-sm btn-outline-danger disabled' : 'btn btn-sm btn-danger',
                        'html'    => '<i class="icon-cancel"></i>',
                        'onclick' => 'salidas.cancelSalida(' . $m['id'] . ')'
                    ]
                ]
            ];
        }
        return ['row' => $rows];
    }

    function showSalidas() {
        $kpis = $this->getSalidaKpis([
            'companies_id'    => $_SESSION['companies_id'],
            'subsidiaries_id' => $_SESSION['subsidiaries_id'],
            'fi'              => $_POST['fi'] ?? '',
            'ff'              => $_POST['ff'] ?? ''
        ]);
        return ['status' => 200, 'counts' => $kpis];
    }

    function getSalida() {
        $id     = $_POST['id'];
        $header = $this->getSalidaHeader([$id]);
        if (!$header) return ['status' => 404, 'message' => 'Salida no encontrada'];
        $detail = $this->getSalidaDetail([$id]);
        return ['status' => 200, 'header' => $header, 'detail' => $detail];
    }

    function saveSalida() {
        $payload   = json_decode($_POST['payload'], true);
        $productos = $payload['productos'] ?? [];

        if (empty($productos)) {
            return ['status' => 400, 'message' => 'Debe agregar al menos un producto'];
        }

        $companiesId    = $_SESSION['companies_id'];
        $subsidiariesId = $_SESSION['subsidiaries_id'];
        $userId         = $_SESSION['user_id'];
        $warehouseId    = $payload['warehouse_id'];
        $reasonId       = $payload['shrinkage_reason_id'];
        $note           = $payload['note'] ?? null;
        $dateShrinkage  = !empty($payload['date_shrinkage']) ? $payload['date_shrinkage'] : date('Y-m-d');

        $totalProducts = count($productos);
        $totalUnits    = 0;
        $totalCost     = 0;
        foreach ($productos as $p) {
            $totalUnits += floatval($p['quantity']);
            $totalCost  += floatval($p['quantity']) * floatval($p['cost']);
        }

        $folio = $this->nextFolio('M-', 'inventory_shrinkage');
        $this->insertSalida([
            $folio, $note, $totalProducts, $totalUnits, $totalCost, $dateShrinkage, 'Aplicada',
            $reasonId, $warehouseId, $subsidiariesId, $userId, $companiesId
        ]);
        $headerId = $this->getMaxId('inventory_shrinkage');

        foreach ($productos as $p) {
            $itemId = $p['item_id'];
            $qty    = floatval($p['quantity']);
            $cost   = floatval($p['cost']);
            $sub    = $qty * $cost;

            $row  = $this->getStockRow([$itemId, $warehouseId]);
            $prev = $row ? floatval($row['quantity']) : 0;
            $post = max(0, $prev - $qty);

            $this->insertSalidaDetail([$qty, $cost, $sub, $prev, $post, $itemId, $headerId]);

            if ($row) {
                $this->updateStockQty([$post, $row['id']]);
            }

            $this->insertMovement(['MERMA', $folio, -$qty, $prev, $post, $cost, $sub, 'Aplicada', $itemId, $warehouseId, $userId, $subsidiariesId, $companiesId]);
        }

        return ['status' => 200, 'message' => 'Salida registrada correctamente', 'folio' => $folio, 'id' => $headerId];
    }

    function cancelSalida() {
        $id     = $_POST['id'];
        $header = $this->getSalidaHeader([$id]);

        if (!$header) return ['status' => 404, 'message' => 'Salida no encontrada'];
        if ($header['status'] === 'Cancelada') return ['status' => 400, 'message' => 'La salida ya está cancelada'];

        $warehouseId = $header['warehouse_id'];
        $detail      = $this->getSalidaDetail([$id]);
        foreach ($detail as $d) {
            $row = $this->getStockRow([$d['item_id'], $warehouseId]);
            if ($row) {
                $post = floatval($row['quantity']) + floatval($d['quantity']);
                $this->updateStockQty([$post, $row['id']]);
            } else {
                $this->insertStock([floatval($d['quantity']), $warehouseId, $d['item_id'], $_SESSION['companies_id']]);
            }
        }

        $this->cancelSalidaById([$id]);
        return ['status' => 200, 'message' => 'Salida cancelada y stock restaurado'];
    }
}

// Complements

function renderEstadoInv($estado) {
    switch ($estado) {
        case 'Aplicada':
            return '<span class="inline-block px-3 py-1 rounded-2xl text-xs font-semibold bg-green-100 text-green-700 min-w-[90px] text-center">Aplicada</span>';
        case 'Cancelada':
            return '<span class="inline-block px-3 py-1 rounded-2xl text-xs font-semibold bg-red-100 text-red-700 min-w-[90px] text-center">Cancelada</span>';
        case 'Pendiente':
            return '<span class="inline-block px-3 py-1 rounded-2xl text-xs font-semibold bg-yellow-100 text-yellow-700 min-w-[90px] text-center">Pendiente</span>';
        default:
            return $estado;
    }
}

function renderTipoMovimiento($tipo) {
    switch ($tipo) {
        case 'ENTRADA':
            return '<span class="inline-block px-3 py-1 rounded-2xl text-sm font-semibold bg-blue-100 text-blue-700 min-w-[100px] text-center"><i class="icon-up-big"></i> Entrada</span>';
        case 'MERMA':
            return '<span class="inline-block px-3 py-1 rounded-2xl text-sm font-semibold bg-red-100 text-red-700 min-w-[100px] text-center"><i class="icon-down-big"></i> Salida</span>';
        default:
            return $tipo;
    }
}

$obj = new ctrl();
echo json_encode($obj->{$_POST['opc']}());
