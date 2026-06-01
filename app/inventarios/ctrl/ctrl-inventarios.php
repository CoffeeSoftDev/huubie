<?php
session_start();
if (empty($_POST['opc'])) exit(0);

require_once '../mdl/mdl-inventarios.php';

class ctrl extends mdl {

    public $companiesId;
    public $subsidiariesId;
    public $userId;

    public function __construct() {
        parent::__construct();
        $this->companiesId    = (int) ($_SESSION['COM'] ?? $_SESSION['COMPANY_ID'] ?? $_POST['companies_id']    ?? 4);
        $this->subsidiariesId = (int) ($_SESSION['SUB'] ?? $_POST['subsidiaries_id'] ?? 0);
        $this->userId         = (int) ($_SESSION['USR'] ?? $_SESSION['ID']         ?? $_POST['user_id']         ?? 1);
    }

    // ─────────────────────────────────────────────────────────────────
    //  INIT — payload comun para todos los submodulos
    // ─────────────────────────────────────────────────────────────────

    function init() {
        $productos = array_map(function ($p) {
            return [
                'id'     => (string) $p['id'],
                'sku'    => $p['sku'] ?: '',
                'nombre' => $p['nombre'],
                'costo'  => (float) $p['costo'],
                'precio' => (float) ($p['precio'] ?? 0),
                'stock'  => 0,
                'image'  => $p['image'] ?? '',
                'icon'   => 'package',
                'bg'     => 'bg-gray-700/40',
                'color'  => 'text-gray-300'
            ];
        }, $this->qProductsForTransfer([$this->companiesId]));

        return [
            'status'             => 200,
            'companies_id'       => $this->companiesId,
            'subsidiaries_id'    => $this->subsidiariesId,
            'user_id'            => $this->userId,
            'sucursales'         => $this->lsSucursales([$this->companiesId]),
            'almacenes'          => $this->lsWarehouses(['companies_id' => $this->companiesId]),
            'areas'              => $this->lsAreas([$this->companiesId]),
            'unidades'           => $this->lsUnits(),
            'proveedores'        => $this->lsSuppliers([$this->companiesId]),
            'productos'          => $productos,
            'origenes_entrada'   => $this->lsInflowOrigins(),
            'estados_entrada'    => [
                ['id' => '',          'valor' => 'Todos los estados'],
                ['id' => 'Aplicada',  'valor' => 'Aplicada'],
                ['id' => 'Pendiente', 'valor' => 'Pendiente'],
                ['id' => 'Cancelada', 'valor' => 'Cancelada']
            ],
            'motivos_merma'      => $this->lsShrinkageReasons(),
            'motivos_ajuste'     => $this->lsAdjustmentReasons(),
            'estados_traspaso'   => $this->lsTransferStatuses(),
            'categorias'         => $this->lsCategories([])
        ];
    }

    // ─────────────────────────────────────────────────────────────────
    //  STOCK
    // ─────────────────────────────────────────────────────────────────

    function lsStock() {
        $rows = $this->qStock([
            'companies_id'    => $this->companiesId,
            'subsidiaries_id' => $_POST['subsidiaries_id']  ?? '',
            'category_id'     => $_POST['category_id']      ?? '',
            'q'               => $_POST['q']                ?? ''
        ]);
        $row = [];
        foreach ($rows as $r) {
            $qty = (float) $r['quantity_total'];
            $min = (float) $r['stock_min'];
            $row[] = [
                'id'         => $r['product_id'],
                'SKU'        => $r['sku'] ?: '-',
                'Producto'   => $r['product_name'],
                'Categoria'  => $r['category_name'] ?: '-',
                'Stock'      => evaluar($qty, ''),
                'Min'        => evaluar($min, ''),
                'Max'        => evaluar((float) $r['stock_max'], ''),
                'Unidad'     => $r['unit_code'] ?: '-',
                'Estado'     => $this->_levelBadge($qty, $min),
                'a'          => [
                    [
                        'class'   => 'btn btn-sm btn-secondary me-1',
                        'html'    => '<i class="icon-eye"></i>',
                        'onclick' => "app.selectProduct({$r['product_id']})"
                    ]
                ]
            ];
        }
        return ['status' => 200, 'row' => $row];
    }

    function showStock() {
        $kpis = $this->getStockKpis([
            'companies_id'    => $this->companiesId,
            'subsidiaries_id' => $_POST['subsidiaries_id'] ?? ''
        ]);
        return ['status' => 200, 'counts' => $kpis];
    }

    function getProducto() {
        $product_id = (int) $_POST['id'];
        $product    = $this->getProduct([$product_id]);
        if (empty($product)) {
            return ['status' => 404, 'message' => 'Producto no encontrado'];
        }
        $sucursales = $this->getStockByProduct([$product_id]);
        $movs       = $this->getMovimientosByProduct([$product_id, $this->companiesId]);

        return [
            'status'    => 200,
            'producto'  => $product,
            'almacenes' => $sucursales,
            'movs'      => $movs
        ];
    }

    // ─────────────────────────────────────────────────────────────────
    //  ENTRADAS
    // ─────────────────────────────────────────────────────────────────

    function lsEntradas() {
        $rows = $this->qEntradas([
            'companies_id'    => $this->companiesId,
            'subsidiaries_id' => $_POST['subsidiaries_id'] ?? '',
            'origin_id'       => $_POST['origin_id']       ?? '',
            'status'          => $_POST['status']          ?? '',
            'fi'              => $_POST['fi']              ?? '',
            'ff'              => $_POST['ff']              ?? '',
            'q'               => $_POST['q']               ?? ''
        ]);

        $row = [];
        foreach ($rows as $r) {
            $row[] = [
                'id'           => $r['id'],
                'Folio'        => $r['folio'],
                'Origen'       => $this->_pillBadge($r['origin_name'], $r['origin_color']),
                'Sucursal'     => $r['subsidiary_name'] ?: '-',
                'Almacen'      => $r['warehouse_name']  ?: '-',
                'Proveedor'    => $r['supplier_name']   ?: '<span class="italic text-gray-400">N/A</span>',
                'Productos'    => (int) $r['total_products'],
                'Costo'        => evaluar((float) $r['total_cost']),
                'Fecha'        => $r['date_inflow'],
                'Estado'       => $this->_statusBadge($r['status']),
                'Registrado'   => $r['user_name'] ?: '-',
                'a' => [
                    [
                        'class'   => 'btn btn-sm btn-secondary me-1',
                        'html'    => '<i class="icon-eye"></i>',
                        'onclick' => "app.selectEntrada('{$r['folio']}', {$r['id']})"
                    ]
                ]
            ];
        }
        return ['status' => 200, 'row' => $row];
    }

    function showEntradas() {
        $kpis = $this->getEntradaKpis([
            'companies_id'    => $this->companiesId,
            'subsidiaries_id' => $_POST['subsidiaries_id'] ?? '',
            'origin_id'       => $_POST['origin_id']       ?? '',
            'status'          => $_POST['status']          ?? '',
            'fi'              => $_POST['fi']              ?? '',
            'ff'              => $_POST['ff']              ?? '',
            'q'               => $_POST['q']               ?? ''
        ]);
        return ['status' => 200, 'counts' => $kpis];
    }

    function getEntrada() {
        $id      = (int) $_POST['id'];
        $header  = $this->qGetEntrada([$id]);
        if (!$header) return ['status' => 404, 'message' => 'Entrada no encontrada'];
        $detail  = $this->qGetEntradaDetail([$id]);
        return ['status' => 200, 'header' => $header, 'detail' => $detail];
    }

    function saveEntrada() {
        $payload   = json_decode($_POST['payload'] ?? '[]', true);
        $productos = $payload['productos'] ?? [];

        if (empty($productos)) {
            return ['status' => 400, 'message' => 'No se enviaron renglones'];
        }

        // El estado lo decide el ORIGEN, no el cliente: una orden de produccion
        // entra Pendiente (el panadero la confirma despues) y NO aplica stock
        // hasta confirmarse. El resto de origenes entra Aplicada y aplica stock.
        $origin       = $this->getInflowOrigin([(int) $payload['inflow_origin_id']]);
        $isProduction = $origin && $origin['code'] === 'PRODUCTION';
        $status       = $isProduction ? 'Pendiente' : 'Aplicada';

        $folio = $this->nextFolio('ENT-', 'inventory_inflow', $this->companiesId);

        $totalProducts = count($productos);
        $totalUnits    = 0;
        $totalCost     = 0;
        foreach ($productos as $p) {
            $totalUnits += (float) $p['quantity'];
            $totalCost  += (float) $p['quantity'] * (float) $p['cost'];
        }

        $ok = $this->insertEntrada([
            $folio,
            $payload['note'] ?? null,
            $totalProducts,
            $totalUnits,
            $totalCost,
            // date_inflow lo fija el INSERT con CURDATE() (hora actual del servidor)
            $status,
            (int) $payload['inflow_origin_id'],
            (int) $payload['warehouse_id'],
            !empty($payload['supplier_id']) ? (int) $payload['supplier_id'] : null,
            (int) ($payload['subsidiaries_id'] ?? $this->subsidiariesId),
            $this->userId,
            $this->companiesId
        ]);

        if (!$ok) return ['status' => 500, 'message' => 'No se pudo registrar la entrada'];

        $inflowRow = $this->_Read(
            "SELECT id FROM {$this->bd}inventory_inflow WHERE folio = ? AND companies_id = ? LIMIT 1",
            [$folio, $this->companiesId]
        );
        $inflowId = (int) ($inflowRow[0]['id'] ?? 0);

        foreach ($productos as $p) {
            $productId = (int) $p['product_id'];
            $warehouse = (int) $payload['warehouse_id'];
            $qty       = (float) $p['quantity'];
            $cost      = (float) $p['cost'];
            $subtotal  = $qty * $cost;

            $stockRow = $this->getStockRow([$productId, $warehouse]);
            $prev     = $stockRow ? (float) $stockRow['quantity'] : 0;
            // Pendiente (produccion): el stock aun no se aplica -> resulting = previous.
            $post     = $isProduction ? $prev : $prev + $qty;

            $this->insertEntradaDetail([
                $p['batch_code'] ?? null,
                $qty,
                $cost,
                $subtotal,
                $prev,
                $post,
                $p['expires_at'] ?? null,
                $productId,
                $inflowId,
                !empty($p['unit_id']) ? (int) $p['unit_id'] : null
            ]);

            if (!$isProduction) {
                if ($stockRow) {
                    $this->updateStockQuantity([$post, (int) $stockRow['id']]);
                } else {
                    $this->insertStockRow([$post, $warehouse, $productId, $this->companiesId]);
                }
            }
        }

        return [
            'status'  => 200,
            'message' => $isProduction ? 'Orden de produccion registrada (pendiente de confirmar)' : 'Entrada registrada',
            'folio'   => $folio,
            'id'      => $inflowId,
            'pending' => $isProduction
        ];
    }

    function confirmEntrada() {
        $id     = (int) $_POST['id'];
        $header = $this->qGetEntrada([$id]);

        if (!$header) {
            return ['status' => 404, 'message' => 'Entrada no encontrada'];
        }
        if ($header['status'] !== 'Pendiente') {
            return ['status' => 400, 'message' => 'La entrada no esta pendiente de confirmar'];
        }

        // Aplica el stock de la orden de produccion al almacen destino.
        $warehouse = (int) $header['warehouse_id'];
        $detail    = $this->qGetEntradaDetail([$id]);
        foreach ($detail as $d) {
            $productId = (int) $d['product_id'];
            $qty       = (float) $d['quantity'];

            $stockRow = $this->getStockRow([$productId, $warehouse]);
            $prev     = $stockRow ? (float) $stockRow['quantity'] : 0;
            $post     = $prev + $qty;

            // Recalcula el snapshot del renglon con el stock actual al confirmar.
            $this->updateEntradaDetailStock([$prev, $post, (int) $d['id']]);

            if ($stockRow) {
                $this->updateStockQuantity([$post, (int) $stockRow['id']]);
            } else {
                $this->insertStockRow([$post, $warehouse, $productId, $this->companiesId]);
            }
        }

        $r = $this->qApplyEntrada([$this->userId, $id]);
        return [
            'status'  => $r ? 200 : 500,
            'message' => $r ? 'Produccion confirmada y stock aplicado' : 'No se pudo confirmar la produccion'
        ];
    }

    function reverseEntrada() {
        $id     = (int) $_POST['id'];
        $header = $this->qGetEntrada([$id]);

        if (!$header) {
            return ['status' => 404, 'message' => 'Entrada no encontrada'];
        }
        if ($header['status'] === 'Cancelada') {
            return ['status' => 400, 'message' => 'La entrada ya esta cancelada'];
        }

        // Solo se revierte stock si la entrada estaba Aplicada. Una orden de
        // produccion Pendiente nunca aplico stock, asi que solo cambia de estado.
        if ($header['status'] === 'Aplicada') {
            $warehouse = (int) $header['warehouse_id'];
            $detail    = $this->qGetEntradaDetail([$id]);
            foreach ($detail as $d) {
                $productId = (int) $d['product_id'];
                $qty       = (float) $d['quantity'];
                $stockRow  = $this->getStockRow([$productId, $warehouse]);
                if ($stockRow) {
                    $post = max(0, (float) $stockRow['quantity'] - $qty);
                    $this->updateStockQuantity([$post, (int) $stockRow['id']]);
                }
            }
        }

        $r = $this->qReverseEntrada([$id]);
        return [
            'status'  => $r ? 200 : 500,
            'message' => $r ? 'Entrada cancelada' : 'No se pudo cancelar'
        ];
    }

    // ─────────────────────────────────────────────────────────────────
    //  MERMAS
    // ─────────────────────────────────────────────────────────────────

    function lsMermas() {
        $rows = $this->qMermas([
            'companies_id'    => $this->companiesId,
            'subsidiaries_id' => $_POST['subsidiaries_id'] ?? '',
            'reason_id'       => $_POST['reason_id']       ?? '',
            'fi'              => $_POST['fi']              ?? '',
            'ff'              => $_POST['ff']              ?? '',
            'q'               => $_POST['q']               ?? ''
        ]);

        $row = [];
        foreach ($rows as $r) {
            $row[] = [
                'id'         => $r['id'],
                'Folio'      => $r['folio'],
                'Motivo'     => $this->_pillBadge($r['reason_name'], $r['reason_color']),
                'Sucursal'   => $r['subsidiary_name'] ?: '-',
                'Almacen'    => $r['warehouse_name']  ?: '-',
                'Productos'  => (int) $r['total_products'],
                'Unidades'   => (float) $r['total_units'],
                'Costo'      => '<span class="text-red-400">' . evaluar((float) $r['total_cost_loss']) . '</span>',
                'Fecha'      => date('Y-m-d H:i', strtotime($r['created_at'])),
                'Estado'     => $this->_statusBadge($r['status']),
                'Registrado' => $r['user_name'] ?: '-',
                'a' => [
                    [
                        'class'   => 'btn btn-sm btn-secondary me-1',
                        'html'    => '<i class="icon-eye"></i>',
                        'onclick' => "mermas.getMerma({$r['id']})"
                    ]
                ]
            ];
        }
        return ['status' => 200, 'row' => $row];
    }

    function showMermas() {
        $kpis = $this->getMermaKpis([
            'companies_id'    => $this->companiesId,
            'subsidiaries_id' => $_POST['subsidiaries_id'] ?? '',
            'fi'              => $_POST['fi']              ?? '',
            'ff'              => $_POST['ff']              ?? ''
        ]);
        return ['status' => 200, 'counts' => $kpis];
    }

    function getMerma() {
        $id     = (int) $_POST['id'];
        $header = $this->qGetMerma([$id]);
        if (!$header) return ['status' => 404, 'message' => 'Merma no encontrada'];
        $detail = $this->qGetMermaDetail([$id]);
        return ['status' => 200, 'header' => $header, 'detail' => $detail];
    }

    function saveMerma() {
        $payload   = json_decode($_POST['payload'] ?? '[]', true);
        $productos = $payload['productos'] ?? [];

        if (empty($productos)) {
            return ['status' => 400, 'message' => 'No se enviaron renglones'];
        }

        $folio         = $this->nextFolio('M-', 'inventory_shrinkage', $this->companiesId);
        $totalProducts = count($productos);
        $totalUnits    = 0;
        $totalLoss     = 0;
        foreach ($productos as $p) {
            $totalUnits += (float) $p['quantity'];
            $totalLoss  += (float) $p['quantity'] * (float) $p['cost'];
        }

        $ok = $this->insertMerma([
            $folio,
            $payload['note']         ?? null,
            $payload['evidence_url'] ?? null,
            $totalProducts,
            $totalUnits,
            $totalLoss,
            $payload['status']       ?? 'Aplicada',
            (int) $payload['shrinkage_reason_id'],
            (int) $payload['warehouse_id'],
            (int) ($payload['subsidiaries_id'] ?? $this->subsidiariesId),
            $this->userId,
            $this->companiesId
        ]);

        if (!$ok) return ['status' => 500, 'message' => 'No se pudo registrar la merma'];

        $mermaRow = $this->_Read(
            "SELECT id FROM {$this->bd}inventory_shrinkage WHERE folio = ? AND companies_id = ? LIMIT 1",
            [$folio, $this->companiesId]
        );
        $mermaId = (int) ($mermaRow[0]['id'] ?? 0);

        foreach ($productos as $p) {
            $productId = (int) $p['product_id'];
            $warehouse = (int) $payload['warehouse_id'];
            $qty       = (float) $p['quantity'];
            $cost      = (float) $p['cost'];

            $stockRow = $this->getStockRow([$productId, $warehouse]);
            $prev     = $stockRow ? (float) $stockRow['quantity'] : 0;
            $post     = max(0, $prev - $qty);

            $this->insertMermaDetail([
                $qty,
                $cost,
                $qty * $cost,
                $prev,
                $post,
                $productId,
                $mermaId
            ]);

            if ($stockRow) {
                $this->updateStockQuantity([$post, (int) $stockRow['id']]);
            }
        }

        return ['status' => 200, 'message' => 'Merma registrada', 'folio' => $folio, 'id' => $mermaId];
    }

    function reverseMerma() {
        $id = (int) $_POST['id'];
        $r  = $this->qReverseMerma([$id]);
        return [
            'status'  => $r ? 200 : 500,
            'message' => $r ? 'Merma revertida' : 'No se pudo revertir'
        ];
    }

    // ─────────────────────────────────────────────────────────────────
    //  TRASPASOS
    // ─────────────────────────────────────────────────────────────────

    function getCatalogosTraspaso() {
        $cid = $this->companiesId;

        $sucursales = $this->lsSucursales([$cid]);
        $almacenes  = $this->lsWarehouses(['companies_id' => $cid]);
        $categorias = $this->lsCategories([]);

        $productos = $this->qProductsForTransfer([$cid]);
        $stockRows = $this->qStockBySubsidiary([$cid]);

        $stockMap = [];
        foreach ($stockRows as $s) {
            $pid = (int) $s['product_id'];
            $sid = (string) $s['subsidiaries_id'];
            if (!isset($stockMap[$pid])) $stockMap[$pid] = [];
            $stockMap[$pid][$sid] = (float) $s['qty'];
        }

        foreach ($productos as &$p) {
            $pid = (int) $p['id'];
            $p['id']           = (string) $p['id'];
            $p['categoria']    = $p['categoria'] ?: '-';
            $p['sku']          = $p['sku'] ?: '';
            $p['icon']         = 'package';
            $p['bg']           = 'bg-gray-700/40';
            $p['color']        = 'text-gray-300';
            $p['stockPorSuc']  = isset($stockMap[$pid]) ? (object) $stockMap[$pid] : (object) [];
        }
        unset($p);

        return [
            'status'       => 200,
            'sucursales'   => $sucursales,
            'almacenes'    => $almacenes,
            'categorias'   => $categorias,
            'productos'    => $productos,
            'transformMap' => (object) []
        ];
    }

    function lsTraspasos() {
        $rows = $this->qTraspasos([
            'companies_id'                => $this->companiesId,
            'status_id'                   => $_POST['status_id']                   ?? '',
            'origin_subsidiaries_id'      => $_POST['origin_subsidiaries_id']      ?? '',
            'destination_subsidiaries_id' => $_POST['destination_subsidiaries_id'] ?? '',
            'fi'                          => $_POST['fi']                          ?? '',
            'ff'                          => $_POST['ff']                          ?? '',
            'q'                           => $_POST['q']                           ?? ''
        ]);

        $row = [];
        foreach ($rows as $r) {
            $isTerminal = (int) $r['status_terminal'];
            $a = [
                [
                    'class'   => 'btn btn-sm btn-secondary me-1',
                    'html'    => '<i class="icon-eye"></i>',
                    'onclick' => "app.selectTraspaso('{$r['folio']}')"
                ]
            ];
            if (!$isTerminal) {
                $a[] = [
                    'class'   => 'btn btn-sm btn-success me-1',
                    'html'    => '<i class="icon-ok"></i>',
                    'onclick' => "traspasos.confirmTraspaso({$r['id']})"
                ];
            }

            $row[] = [
                'id'         => $r['id'],
                'Folio'      => $r['folio'],
                'Origen'     => $r['origin_subsidiary_name']      ?: '-',
                'Destino'    => $r['destination_subsidiary_name'] ?: '-',
                'Productos'  => (int) $r['total_products'],
                'Unidades'   => (float) $r['total_units'],
                'Costo'      => evaluar((float) $r['total_cost']),
                'Solicitud'  => date('Y-m-d H:i', strtotime($r['date_request'])),
                'Solicito'   => $r['requested_user_name'] ?: '-',
                'Recibio'    => $r['received_user_name']  ?: '-',
                'Estado'     => $this->_pillBadge($r['status_name'], $r['status_color']),
                'a'          => $a
            ];
        }
        return ['status' => 200, 'row' => $row];
    }

    function showTraspasos() {
        $kpis = $this->getTraspasoKpis([
            'companies_id' => $this->companiesId,
            'fi'           => $_POST['fi'] ?? '',
            'ff'           => $_POST['ff'] ?? ''
        ]);
        return ['status' => 200, 'counts' => $kpis];
    }

    function getTraspaso() {
        $id     = (int) $_POST['id'];
        $header = $this->qGetTraspaso([$id]);
        if (!$header) return ['status' => 404, 'message' => 'Traspaso no encontrado'];
        $detail  = $this->qGetTraspasoDetail([$id]);
        $history = $this->qGetTraspasoHistory([$id]);
        return [
            'status'  => 200,
            'header'  => $header,
            'detail'  => $detail,
            'history' => $history
        ];
    }

    function saveTraspaso() {
        $payload   = json_decode($_POST['payload'] ?? '[]', true);
        $productos = $payload['productos'] ?? [];

        if (empty($productos)) {
            return ['status' => 400, 'message' => 'No se enviaron renglones'];
        }

        $statusReq = $this->getTransferStatusByCode(['REQUESTED']);
        if (!$statusReq) return ['status' => 500, 'message' => 'Catalogo transfer_status sin REQUESTED'];

        $folio = $this->nextFolio('TRA-', 'inventory_transfer', $this->companiesId);

        $totalProducts = count($productos);
        $totalUnits    = 0;
        $totalCost     = 0;
        foreach ($productos as $p) {
            $totalUnits += (float) $p['quantity'];
            $totalCost  += (float) $p['quantity'] * (float) $p['cost'];
        }

        $ok = $this->insertTraspaso([
            $folio,
            $payload['note'] ?? null,
            $totalProducts,
            $totalUnits,
            $totalCost,
            (int) $statusReq['id'],
            (int) $payload['origin_warehouse_id'],
            (int) $payload['destination_warehouse_id'],
            (int) $payload['origin_subsidiaries_id'],
            (int) $payload['destination_subsidiaries_id'],
            $this->userId,
            $this->companiesId
        ]);

        if (!$ok) return ['status' => 500, 'message' => 'No se pudo registrar el traspaso'];

        $traspasoRow = $this->_Read(
            "SELECT id FROM {$this->bd}inventory_transfer WHERE folio = ? AND companies_id = ? LIMIT 1",
            [$folio, $this->companiesId]
        );
        $traspasoId = (int) ($traspasoRow[0]['id'] ?? 0);

        foreach ($productos as $p) {
            $productId  = (int) $p['product_id'];
            $originWh   = (int) $payload['origin_warehouse_id'];
            $qty        = (float) $p['quantity'];
            $cost       = (float) $p['cost'];

            $originStock = $this->getStockRow([$productId, $originWh]);
            $originPrev  = $originStock ? (float) $originStock['quantity'] : 0;
            $originPost  = max(0, $originPrev - $qty);

            $this->insertTraspasoDetail([
                $qty,
                $cost,
                $qty * $cost,
                $originPrev,
                $originPost,
                null,
                null,
                $productId,
                $traspasoId
            ]);
        }

        $this->insertTraspasoHistory([
            'Traspaso solicitado',
            (int) $statusReq['id'],
            $this->userId,
            $traspasoId
        ]);

        return ['status' => 200, 'message' => 'Traspaso solicitado', 'folio' => $folio, 'id' => $traspasoId];
    }

    function authorizeTraspaso() {
        $id = (int) $_POST['id'];
        $st = $this->getTransferStatusByCode(['AUTHORIZED']);
        $this->updateTraspasoStatus([(int) $st['id'], $id]);
        $this->setTraspasoAuthorized([$this->userId, $id]);
        $this->insertTraspasoHistory(['Traspaso autorizado', (int) $st['id'], $this->userId, $id]);
        return ['status' => 200, 'message' => 'Traspaso autorizado'];
    }

    function sendTraspaso() {
        $id = (int) $_POST['id'];
        $st = $this->getTransferStatusByCode(['IN_TRANSIT']);
        $this->updateTraspasoStatus([(int) $st['id'], $id]);
        $this->setTraspasoSent([$id]);

        $detail = $this->qGetTraspasoDetail([$id]);
        $header = $this->qGetTraspaso([$id]);
        foreach ($detail as $d) {
            $stockRow = $this->getStockRow([(int) $d['product_id'], (int) $header['origin_warehouse_id']]);
            if ($stockRow) {
                $post = max(0, (float) $stockRow['quantity'] - (float) $d['quantity']);
                $this->updateStockQuantity([$post, (int) $stockRow['id']]);
            }
        }

        $this->insertTraspasoHistory(['Traspaso enviado', (int) $st['id'], $this->userId, $id]);
        return ['status' => 200, 'message' => 'Traspaso enviado'];
    }

    function confirmTraspaso() {
        $id = (int) $_POST['id'];
        $st = $this->getTransferStatusByCode(['RECEIVED']);

        $header = $this->qGetTraspaso([$id]);
        $detail = $this->qGetTraspasoDetail([$id]);
        if (!$header) return ['status' => 404, 'message' => 'Traspaso no encontrado'];

        $destWh = (int) $header['destination_warehouse_id'];

        foreach ($detail as $d) {
            $productId = (int) $d['product_id'];
            $qty       = (float) $d['quantity'];

            $destStock = $this->getStockRow([$productId, $destWh]);
            $destPrev  = $destStock ? (float) $destStock['quantity'] : 0;
            $destPost  = $destPrev + $qty;

            $this->_CUD(
                "UPDATE {$this->bd}detail_inventory_transfer
                 SET destination_stock_prev = ?, destination_stock_post = ?
                 WHERE id = ?",
                [$destPrev, $destPost, (int) $d['id']]
            );

            if ($destStock) {
                $this->updateStockQuantity([$destPost, (int) $destStock['id']]);
            } else {
                $this->insertStockRow([$destPost, $destWh, $productId, $this->companiesId]);
            }
        }

        $this->updateTraspasoStatus([(int) $st['id'], $id]);
        $this->setTraspasoReceived([$this->userId, $id]);
        $this->insertTraspasoHistory(['Traspaso recibido', (int) $st['id'], $this->userId, $id]);

        return ['status' => 200, 'message' => 'Traspaso recibido'];
    }

    function rejectTraspaso() {
        $id    = (int) $_POST['id'];
        $note  = $_POST['note'] ?? 'Traspaso rechazado';
        $st    = $this->getTransferStatusByCode(['REJECTED']);

        $this->updateTraspasoStatus([(int) $st['id'], $id]);
        $this->insertTraspasoHistory([$note, (int) $st['id'], $this->userId, $id]);

        return ['status' => 200, 'message' => 'Traspaso rechazado'];
    }

    // ─────────────────────────────────────────────────────────────────
    //  AJUSTES
    // ─────────────────────────────────────────────────────────────────

    function lsAjustes() {
        $rows = $this->qAjustes([
            'companies_id'    => $this->companiesId,
            'subsidiaries_id' => $_POST['subsidiaries_id'] ?? '',
            'reason_id'       => $_POST['reason_id']       ?? '',
            'fi'              => $_POST['fi']              ?? '',
            'ff'              => $_POST['ff']              ?? ''
        ]);

        $row = [];
        foreach ($rows as $r) {
            $diff = (float) $r['total_diff_cost'];
            $diffHtml = $diff < 0
                ? '<span class="text-red-400">' . evaluar($diff) . '</span>'
                : '<span class="text-green-400">' . evaluar($diff) . '</span>';

            $row[] = [
                'id'         => $r['id'],
                'Folio'      => $r['folio'],
                'Tipo'       => ucfirst($r['adjustment_type']),
                'Motivo'     => $this->_pillBadge($r['reason_name'], $r['reason_color']),
                'Sucursal'   => $r['subsidiary_name'] ?: '-',
                'Almacen'    => $r['warehouse_name']  ?: '-',
                'Productos'  => (int) $r['total_products'],
                'Diferencia' => $diffHtml,
                'Fecha'      => $r['date_adjustment'] . ' ' . substr($r['time_adjustment'], 0, 5),
                'Estado'     => $this->_statusBadge($r['status']),
                'a' => [
                    [
                        'class'   => 'btn btn-sm btn-secondary me-1',
                        'html'    => '<i class="icon-eye"></i>',
                        'onclick' => "ajustes.getAjuste({$r['id']})"
                    ]
                ]
            ];
        }
        return ['status' => 200, 'row' => $row];
    }

    function showAjustes() {
        $kpis = $this->getAjusteKpis([
            'companies_id' => $this->companiesId,
            'fi'           => $_POST['fi'] ?? '',
            'ff'           => $_POST['ff'] ?? ''
        ]);
        return ['status' => 200, 'counts' => $kpis];
    }

    function getAjuste() {
        $id     = (int) $_POST['id'];
        $header = $this->qGetAjuste([$id]);
        if (!$header) return ['status' => 404, 'message' => 'Ajuste no encontrado'];
        $detail = $this->qGetAjusteDetail([$id]);
        return ['status' => 200, 'header' => $header, 'detail' => $detail];
    }

    function saveAjuste() {
        $payload   = json_decode($_POST['payload'] ?? '[]', true);
        $productos = $payload['productos'] ?? [];

        if (empty($productos)) {
            return ['status' => 400, 'message' => 'No se enviaron renglones'];
        }

        $folio          = $this->nextFolio('AJU-', 'inventory_adjustment', $this->companiesId);
        $totalProducts  = count($productos);
        $totalDiffUnits = 0;
        $totalDiffCost  = 0;
        foreach ($productos as $p) {
            $diff           = (float) $p['physical_quantity'] - (float) $p['system_quantity'];
            $totalDiffUnits += $diff;
            $totalDiffCost  += $diff * (float) $p['cost'];
        }

        $ok = $this->insertAjuste([
            $folio,
            $payload['note']            ?? null,
            $payload['adjustment_type'] ?? 'individual',
            $totalProducts,
            $totalDiffUnits,
            $totalDiffCost,
            $payload['date_adjustment'] ?? date('Y-m-d'),
            $payload['time_adjustment'] ?? date('H:i:s'),
            $payload['status']          ?? 'Aplicado',
            (int) $payload['adjustment_reason_id'],
            (int) $payload['warehouse_id'],
            (int) ($payload['subsidiaries_id'] ?? $this->subsidiariesId),
            $this->userId,
            !empty($payload['authorized_user_id']) ? (int) $payload['authorized_user_id'] : null,
            $this->companiesId
        ]);

        if (!$ok) return ['status' => 500, 'message' => 'No se pudo registrar el ajuste'];

        $ajusteRow = $this->_Read(
            "SELECT id FROM {$this->bd}inventory_adjustment WHERE folio = ? AND companies_id = ? LIMIT 1",
            [$folio, $this->companiesId]
        );
        $ajusteId = (int) ($ajusteRow[0]['id'] ?? 0);

        foreach ($productos as $p) {
            $productId = (int) $p['product_id'];
            $warehouse = (int) $payload['warehouse_id'];
            $sys       = (float) $p['system_quantity'];
            $phys      = (float) $p['physical_quantity'];
            $diff      = $phys - $sys;
            $cost      = (float) $p['cost'];

            $stockRow = $this->getStockRow([$productId, $warehouse]);
            $prev     = $stockRow ? (float) $stockRow['quantity'] : 0;
            $post     = max(0, $prev + $diff);

            $this->insertAjusteDetail([
                $sys,
                $phys,
                $diff,
                $cost,
                $diff * $cost,
                $prev,
                $post,
                $productId,
                $ajusteId
            ]);

            if ($stockRow) {
                if (($payload['adjustment_type'] ?? '') === 'fisico') {
                    $this->updateStockLastInventory([$post, (int) $stockRow['id']]);
                } else {
                    $this->updateStockQuantity([$post, (int) $stockRow['id']]);
                }
            } else {
                $this->insertStockRow([$post, $warehouse, $productId, $this->companiesId]);
            }
        }

        return ['status' => 200, 'message' => 'Ajuste registrado', 'folio' => $folio, 'id' => $ajusteId];
    }

    function reverseAjuste() {
        $id = (int) $_POST['id'];
        $r  = $this->qReverseAjuste([$id]);
        return [
            'status'  => $r ? 200 : 500,
            'message' => $r ? 'Ajuste revertido' : 'No se pudo revertir'
        ];
    }

    // ─────────────────────────────────────────────────────────────────
    //  MOVIMIENTOS (vista unificada)
    // ─────────────────────────────────────────────────────────────────

    function lsMovimientos() {
        $rows = $this->qMovimientos([
            'companies_id'    => $this->companiesId,
            'subsidiaries_id' => $_POST['subsidiaries_id'] ?? '',
            'movement_type'   => $_POST['movement_type']   ?? '',
            'fi'              => $_POST['fi']              ?? '',
            'ff'              => $_POST['ff']              ?? '',
            'q'               => $_POST['q']               ?? ''
        ]);

        $row = [];
        foreach ($rows as $r) {
            $qty       = (float) $r['quantity'];
            $isOut     = $qty < 0;
            $qtyHtml   = $isOut
                ? '<span class="text-red-400">' . number_format($qty, 2) . '</span>'
                : '<span class="text-green-400">+' . number_format($qty, 2) . '</span>';

            $row[] = [
                'id'         => $r['movement_uid'],
                'Tipo'       => $this->_movementBadge($r['movement_type']),
                'Folio'      => $r['folio'],
                'Producto'   => ($r['product_name'] ?: 'Producto #' . $r['product_id']) . ($r['sku'] ? '<br><span class="text-[10px] text-gray-400">' . $r['sku'] . '</span>' : ''),
                'Cantidad'   => $qtyHtml,
                'Stock'      => number_format((float) $r['stock_prev'], 2) . ' → ' . number_format((float) $r['stock_post'], 2),
                'Costo'      => evaluar((float) $r['cost_total']),
                'Almacen'    => $r['warehouse_name'] ?: '-',
                'Sucursal'   => $r['subsidiary_name'] ?: '-',
                'Fecha'      => $r['occurred_at'],
                'Usuario'    => $r['user_name'] ?: '-'
            ];
        }
        return ['status' => 200, 'row' => $row];
    }

    function showMovimientos() {
        $kpis = $this->getMovimientoKpis([
            'companies_id'    => $this->companiesId,
            'subsidiaries_id' => $_POST['subsidiaries_id'] ?? '',
            'fi'              => $_POST['fi']              ?? '',
            'ff'              => $_POST['ff']              ?? ''
        ]);
        return ['status' => 200, 'counts' => $kpis];
    }

    // ─────────────────────────────────────────────────────────────────
    //  ADMIN ALMACENES / PRODUCT ATTRIBUTE
    // ─────────────────────────────────────────────────────────────────

    function lsAlmacenes() {
        $rows = $this->lsWarehouses([
            'companies_id'    => $this->companiesId,
            'subsidiaries_id' => $_POST['subsidiaries_id'] ?? ''
        ]);
        $row = [];
        foreach ($rows as $r) {
            $row[] = [
                'id'         => $r['id'],
                'Almacen'    => $r['name'],
                'Sucursal'   => $r['subsidiary_name'] ?: '-',
                'Area'       => $r['area_name'] ?: '-',
                'Default'    => $r['is_default'] ? 'Si' : 'No',
                'a' => [
                    ['class' => 'btn btn-sm btn-primary me-1', 'html' => '<i class="icon-pencil"></i>', 'onclick' => "almacenes.edit({$r['id']})"],
                    ['class' => 'btn btn-sm btn-danger', 'html' => '<i class="icon-trash-empty"></i>', 'onclick' => "almacenes.remove({$r['id']})"]
                ]
            ];
        }
        return ['status' => 200, 'row' => $row];
    }

    function saveAlmacen() {
        $ok = $this->insertWarehouse([
            $_POST['name'],
            (int) ($_POST['is_default'] ?? 0),
            !empty($_POST['warehouse_area_id']) ? (int) $_POST['warehouse_area_id'] : null,
            (int) $_POST['subsidiaries_id'],
            $this->companiesId
        ]);
        return ['status' => $ok ? 200 : 500, 'message' => $ok ? 'Almacen creado' : 'Error al crear'];
    }

    function editAlmacen() {
        $values = $this->util->sql([
            'name'              => $_POST['name'],
            'is_default'        => (int) ($_POST['is_default'] ?? 0),
            'warehouse_area_id' => !empty($_POST['warehouse_area_id']) ? (int) $_POST['warehouse_area_id'] : null,
            'subsidiaries_id'   => (int) $_POST['subsidiaries_id'],
            'id'                => (int) $_POST['id']
        ], 1);
        $r = $this->updateWarehouse($values);
        return ['status' => $r ? 200 : 500, 'message' => $r ? 'Almacen actualizado' : 'Error al actualizar'];
    }

    function removeAlmacen() {
        $r = $this->disableWarehouse([(int) $_POST['id']]);
        return ['status' => $r ? 200 : 500, 'message' => $r ? 'Almacen desactivado' : 'Error'];
    }

    function saveProductAttribute() {
        $ok = $this->insertProductAttribute([
            $_POST['sku'],
            $_POST['description'] ?? null,
            !empty($_POST['shelf_life_days']) ? (int) $_POST['shelf_life_days'] : null,
            (float) ($_POST['cost_unit'] ?? 0),
            (float) ($_POST['stock_min'] ?? 0),
            (float) ($_POST['stock_max'] ?? 0),
            !empty($_POST['warehouse_area_id']) ? (int) $_POST['warehouse_area_id'] : null,
            !empty($_POST['unit_id']) ? (int) $_POST['unit_id'] : null,
            (int) $_POST['product_id'],
            $this->companiesId
        ]);
        return ['status' => $ok ? 200 : 500, 'message' => $ok ? 'Atributo guardado' : 'Error al guardar'];
    }

    // ─────────────────────────────────────────────────────────────────
    //  HELPERS DE PRESENTACION
    // ─────────────────────────────────────────────────────────────────

    private function _levelBadge($qty, $min) {
        if ($qty <= 0) {
            $c = ['bg' => 'rgba(224,36,36,0.18)', 'fg' => '#E02424', 'lbl' => 'AGOTADO'];
        } elseif ($qty <= $min) {
            $c = ['bg' => 'rgba(251,191,36,0.18)', 'fg' => '#FBBF24', 'lbl' => 'BAJO'];
        } else {
            $c = ['bg' => 'rgba(63,193,137,0.18)', 'fg' => '#3FC189', 'lbl' => 'OK'];
        }
        return "<span class='px-2 py-0.5 rounded text-[10px] font-bold' style='background:{$c['bg']};color:{$c['fg']};'>{$c['lbl']}</span>";
    }

    private function _statusBadge($status) {
        $map = [
            'Aplicada'  => ['bg' => 'rgba(63,193,137,0.18)', 'fg' => '#3FC189'],
            'Aplicado'  => ['bg' => 'rgba(63,193,137,0.18)', 'fg' => '#3FC189'],
            'Pendiente' => ['bg' => 'rgba(251,191,36,0.18)', 'fg' => '#FBBF24'],
            'Cancelada' => ['bg' => 'rgba(224,36,36,0.18)',  'fg' => '#E02424'],
            'Revertida' => ['bg' => 'rgba(224,36,36,0.18)',  'fg' => '#E02424'],
            'Revertido' => ['bg' => 'rgba(224,36,36,0.18)',  'fg' => '#E02424']
        ];
        $c = $map[$status] ?? ['bg' => 'rgba(156,163,175,0.18)', 'fg' => '#9CA3AF'];
        return "<span class='px-2 py-0.5 rounded text-[10px] font-bold' style='background:{$c['bg']};color:{$c['fg']};'>" . strtoupper($status) . "</span>";
    }

    private function _pillBadge($label, $colorHex) {
        $label = $label ?: '-';
        $color = $colorHex ?: '#9CA3AF';
        $hex   = ltrim($color, '#');
        $r = hexdec(substr($hex, 0, 2));
        $g = hexdec(substr($hex, 2, 2));
        $b = hexdec(substr($hex, 4, 2));
        $bg = "rgba($r,$g,$b,0.18)";
        return "<span class='px-2 py-0.5 rounded text-[10px] font-bold' style='background:{$bg};color:{$color};'>{$label}</span>";
    }

    private function _movementBadge($type) {
        $map = [
            'ENTRADA'       => ['bg' => 'rgba(63,193,137,0.18)', 'fg' => '#3FC189'],
            'MERMA'         => ['bg' => 'rgba(224,36,36,0.18)',  'fg' => '#E02424'],
            'TRANSFERENCIA' => ['bg' => 'rgba(96,165,250,0.18)', 'fg' => '#60A5FA'],
            'AJUSTE'        => ['bg' => 'rgba(167,139,250,0.18)','fg' => '#A78BFA']
        ];
        $c = $map[$type] ?? ['bg' => 'rgba(156,163,175,0.18)', 'fg' => '#9CA3AF'];
        return "<span class='px-2 py-0.5 rounded text-[10px] font-bold' style='background:{$c['bg']};color:{$c['fg']};'>{$type}</span>";
    }
}

$obj = new ctrl();
$opc = $_POST['opc'];
if (!method_exists($obj, $opc)) {
    echo json_encode(['status' => 405, 'message' => "opc '{$opc}' no implementado"]);
    exit(0);
}
echo json_encode($obj->{$opc}());
