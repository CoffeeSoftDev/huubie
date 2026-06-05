<?php
if (empty($_POST['opc'])) exit(0);

session_start();
require_once '../mdl/mdl-inventario.php';

class ctrl extends mdl {

    function init() {
        return [
            'productos' => $this->lsProductos(),
            'almacenes' => $this->lsAlmacenes()
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
}

// Complements

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
