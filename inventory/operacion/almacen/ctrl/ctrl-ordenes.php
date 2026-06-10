<?php
session_start();
if (empty($_POST['opc'])) exit(0);

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

require_once '../mdl/mdl-ordenes.php';
require_once '../../../conf/coffeSoft.php';

class ctrl extends mdl {

    public $companiesId;
    public $branchId;
    public $userId;

    public function __construct() {
        parent::__construct();
        $this->companiesId = (int) ($_SESSION['company_id'] ?? $_POST['companies_id'] ?? 0);
        $this->branchId    = (int) ($_SESSION['branch_id']  ?? $_POST['branch_id']    ?? 0);
        $this->userId      = (int) ($_SESSION['user_id']    ?? $_POST['user_id']      ?? 0);
    }

    // -----------------------------------------------------------------------
    // init
    // -----------------------------------------------------------------------

    function init() {
        $productos = array_map(function ($p) {
            return [
                'id'                => (string) $p['id'],
                'sku'               => $p['sku'] ?: '',
                'nombre'            => $p['nombre'],
                'categoria'         => $p['categoria'] ?: 'Sin categoria',
                'costo'             => (float) $p['costo'],
                'precio'            => (float) ($p['precio'] ?? 0),
                'price_without_tax' => $p['price_without_tax'] !== null ? (float) $p['price_without_tax'] : null,
                'tax'               => $p['tax'] !== null ? (float) $p['tax'] : null,
                'stock'             => 0,
                'image'             => $p['image'] ?? '',
                'icon'              => 'package',
                'bg'                => 'bg-gray-100',
                'color'             => 'text-gray-500'
            ];
        }, $this->qProductsForTransfer([$this->companiesId]));

        return [
            'status'         => 200,
            'companies_id'   => $this->companiesId,
            'branch_id'      => $this->branchId,
            'user_id'        => $this->userId,
            'sucursales'     => $this->lsSucursales([$this->companiesId]),
            'almacenes'      => $this->lsWarehouses(['companies_id' => $this->companiesId]),
            'proveedores'    => $this->lsSuppliers([$this->companiesId]),
            'productos'      => $productos,
            'estados_orden'  => [
                ['id' => '',          'valor' => 'Todos los estados'],
                ['id' => 'Activas',   'valor' => 'Activas (sin Cancelada)'],
                ['id' => 'Borrador',  'valor' => 'Borrador'],
                ['id' => 'Solicitada','valor' => 'Solicitada'],
                ['id' => 'Aprobada',  'valor' => 'Aprobada'],
                ['id' => 'Parcial',   'valor' => 'Parcial'],
                ['id' => 'Recibida',  'valor' => 'Recibida'],
                ['id' => 'Rechazada', 'valor' => 'Rechazada'],
                ['id' => 'Cancelada', 'valor' => 'Cancelada']
            ]
        ];
    }

    // -----------------------------------------------------------------------
    // Listado
    // -----------------------------------------------------------------------

    function lsOrdenes() {
        $mine = !empty($_POST['mine']) ? $this->userId : null;

        $rows = $this->qOrdenes([
            'companies_id' => $this->companiesId,
            'branch_id'    => $_POST['branch_id']   ?? '',
            'supplier_id'  => $_POST['supplier_id'] ?? '',
            'status'       => $_POST['status']      ?? '',
            'fi'           => $_POST['fi']           ?? '',
            'ff'           => $_POST['ff']           ?? '',
            'q'            => $_POST['q']            ?? '',
            'mine'         => $mine
        ]);

        $row = [];
        foreach ($rows as $r) {
            $a = [
                [
                    'class'   => 'btn btn-sm btn-secondary me-1',
                    'html'    => '<i class="icon-eye"></i>',
                    'onclick' => "app.selectOrden('{$r['folio']}', {$r['id']})"
                ]
            ];

            $row[] = [
                'id'         => $r['id'],
                'Folio'      => $r['folio'],
                'Fecha'      => formatSpanishDate($r['date_order']),
                'Estado'     => $this->statusBadge($r['status']),
                'Proveedor'  => $r['supplier_name'] ?: '<span class="italic text-gray-400">N/A</span>',
                'Almacen'    => $r['warehouse_name'] ?: '-',
                'Materiales' => (int) $r['total_products'],
                'Total'      => evaluar((float) $r['total_cost']),
                'a'          => $a
            ];
        }
        return ['status' => 200, 'row' => $row];
    }

    // -----------------------------------------------------------------------
    // KPIs
    // -----------------------------------------------------------------------

    function showOrdenes() {
        $counts = $this->getOrdenKpis([
            'companies_id' => $this->companiesId,
            'branch_id'    => $_POST['branch_id']   ?? '',
            'supplier_id'  => $_POST['supplier_id'] ?? '',
            'status'       => $_POST['status']      ?? '',
            'fi'           => $_POST['fi']           ?? '',
            'ff'           => $_POST['ff']           ?? '',
            'q'            => $_POST['q']            ?? ''
        ]);
        return ['status' => 200, 'counts' => $counts];
    }

    // -----------------------------------------------------------------------
    // Detalle de una orden
    // -----------------------------------------------------------------------

    function getOrden() {
        $id     = (int) $_POST['id'];
        $header = $this->qGetOrden([$id]);
        if (!$header) return ['status' => 404, 'message' => 'Orden no encontrada'];

        $header['status_badge'] = $this->statusBadge($header['status']);
        $detail = $this->qGetOrdenDetail([$id]);
        return ['status' => 200, 'header' => $header, 'detail' => $detail];
    }

    // -----------------------------------------------------------------------
    // Crear proveedor inline (identico a ctrl-entradas)
    // -----------------------------------------------------------------------

    function createSupplier() {
        $name = trim($_POST['name'] ?? '');
        if ($name === '') {
            return ['status' => 400, 'message' => 'El nombre del proveedor es obligatorio'];
        }

        $existing = $this->findSupplierByName([$this->companiesId, $name]);
        if ($existing) {
            return [
                'status'  => 200,
                'message' => 'El proveedor ya existia, se reutilizo',
                'id'      => (int) $existing['id'],
                'valor'   => $existing['name'],
                'existed' => true
            ];
        }

        $ok = $this->insertSupplier([
            $name,
            trim($_POST['contact_name'] ?? '') ?: null,
            trim($_POST['phone']        ?? '') ?: null,
            trim($_POST['email']        ?? '') ?: null,
            $this->companiesId
        ]);
        if (!$ok) return ['status' => 500, 'message' => 'No se pudo crear el proveedor'];

        $row = $this->findSupplierByName([$this->companiesId, $name]);
        return [
            'status'  => 200,
            'message' => 'Proveedor creado',
            'id'      => (int) ($row['id'] ?? 0),
            'valor'   => $name,
            'existed' => false
        ];
    }

    // -----------------------------------------------------------------------
    // Crear OC (Borrador o Solicitada directamente)
    // -----------------------------------------------------------------------

    function saveOrden() {
        $payload   = json_decode($_POST['payload'] ?? '[]', true);
        $productos = $payload['productos'] ?? [];

        if (empty($productos)) {
            return ['status' => 400, 'message' => 'No se enviaron renglones'];
        }

        $submit = !empty($payload['submit']);
        $status = $submit ? 'Solicitada' : 'Borrador';
        $folio  = $this->nextFolio('OC-', 'purchase_order', $this->companiesId);

        // Normaliza el desglose de impuesto igual que saveEntrada.
        // El costo con impuesto es el valor pivote; la base se deriva.
        // Si el solicitante no manda costo, los campos de costo quedan null.
        $norm = [];
        foreach ($productos as $p) {
            $tax  = ($p['tax']  ?? '') === '' || $p['tax']  === null ? 0.0  : (float) $p['tax'];
            $base = ($p['price_without_tax'] ?? '') === '' || $p['price_without_tax'] === null ? null : (float) $p['price_without_tax'];
            $cost = ($p['cost'] ?? '') === '' || $p['cost'] === null ? null : (float) $p['cost'];

            if ($cost !== null) {
                $base = $tax > 0 ? $cost / (1 + $tax / 100) : $cost;
            } elseif ($base !== null) {
                $cost = $base + ($base * $tax / 100);
                $base = $tax > 0 ? $cost / (1 + $tax / 100) : $cost;
            }
            // Si ambos son null el solicitante no ingresa costos -> se mantienen null.

            $norm[] = [
                'product_id'        => (int) $p['product_id'],
                'quantity'          => (float) $p['quantity'],
                'price_without_tax' => $base,
                'tax'               => $tax,
                'cost'              => $cost,
                'unit_id'           => !empty($p['unit_id']) ? (int) $p['unit_id'] : null
            ];
        }

        $totalProducts = count($norm);
        $totalUnits    = 0;
        $totalCost     = 0.0;
        $totalBase     = 0.0;
        foreach ($norm as $p) {
            $totalUnits += $p['quantity'];
            if ($p['cost'] !== null) {
                $totalCost += $p['quantity'] * $p['cost'];
            }
            if ($p['price_without_tax'] !== null) {
                $totalBase += $p['quantity'] * $p['price_without_tax'];
            }
        }

        $ok = $this->insertOrden([
            $folio,
            !empty($payload['supplier_id'])   ? (int) $payload['supplier_id']   : null,
            (int) ($payload['branch_id']       ?? $this->branchId),
            !empty($payload['warehouse_id'])  ? (int) $payload['warehouse_id']  : null,
            !empty($payload['date_order'])    ? $payload['date_order']           : date('Y-m-d'),
            !empty($payload['expected_date']) ? $payload['expected_date']        : null,
            $payload['note'] ?? null,
            $totalProducts,
            $totalUnits,
            $totalCost,
            $totalBase,
            $status,
            $this->userId,
            $this->companiesId
        ]);

        if (!$ok) return ['status' => 500, 'message' => 'No se pudo registrar la orden'];

        // _CUD no devuelve el id generado; lo recuperamos por folio.
        $ordenRow = $this->_Read(
            "SELECT id FROM {$this->bd}purchase_order WHERE folio = ? AND companies_id = ? LIMIT 1",
            [$folio, $this->companiesId]
        );
        $ordenId = (int) ($ordenRow[0]['id'] ?? 0);

        foreach ($norm as $p) {
            $subtotal = ($p['cost'] !== null) ? $p['quantity'] * $p['cost'] : 0.0;
            $this->insertOrdenDetail([
                $ordenId,
                $p['product_id'],
                $p['unit_id'],
                $p['quantity'],
                $p['price_without_tax'],
                $p['tax'],
                $p['cost'],
                $subtotal
            ]);
        }

        return [
            'status'  => 200,
            'message' => $submit ? 'Solicitud de compra enviada' : 'Borrador guardado',
            'folio'   => $folio,
            'id'      => $ordenId,
            'pending' => !$submit
        ];
    }

    // -----------------------------------------------------------------------
    // Editar OC (solo Borrador o Solicitada)
    // Estrategia: soft-delete de renglones anteriores + reinsercion.
    // Es la opcion mas simple y garantiza que quantity_received quede en 0
    // en los renglones nuevos (una OC no aprobada no ha recibido nada aun).
    // -----------------------------------------------------------------------

    function editOrden() {
        $id     = (int) $_POST['id'];
        $header = $this->qGetOrden([$id]);

        if (!$header) {
            return ['status' => 404, 'message' => 'Orden no encontrada'];
        }
        if (!in_array($header['status'], ['Borrador', 'Solicitada'], true)) {
            return ['status' => 400, 'message' => 'Solo se puede editar una orden en estado Borrador o Solicitada'];
        }

        $payload   = json_decode($_POST['payload'] ?? '[]', true);
        $productos = $payload['productos'] ?? [];

        if (empty($productos)) {
            return ['status' => 400, 'message' => 'No se enviaron renglones'];
        }

        // Soft-delete de renglones anteriores.
        $this->softDeleteOrdenDetails([$id]);

        $norm = [];
        foreach ($productos as $p) {
            $tax  = ($p['tax']  ?? '') === '' || $p['tax']  === null ? 0.0  : (float) $p['tax'];
            $base = ($p['price_without_tax'] ?? '') === '' || $p['price_without_tax'] === null ? null : (float) $p['price_without_tax'];
            $cost = ($p['cost'] ?? '') === '' || $p['cost'] === null ? null : (float) $p['cost'];

            if ($cost !== null) {
                $base = $tax > 0 ? $cost / (1 + $tax / 100) : $cost;
            } elseif ($base !== null) {
                $cost = $base + ($base * $tax / 100);
                $base = $tax > 0 ? $cost / (1 + $tax / 100) : $cost;
            }

            $norm[] = [
                'product_id'        => (int) $p['product_id'],
                'quantity'          => (float) $p['quantity'],
                'price_without_tax' => $base,
                'tax'               => $tax,
                'cost'              => $cost,
                'unit_id'           => !empty($p['unit_id']) ? (int) $p['unit_id'] : null
            ];
        }

        $totalProducts = count($norm);
        $totalUnits    = 0;
        $totalCost     = 0.0;
        $totalBase     = 0.0;
        foreach ($norm as $p) {
            $totalUnits += $p['quantity'];
            if ($p['cost'] !== null) {
                $totalCost += $p['quantity'] * $p['cost'];
            }
            if ($p['price_without_tax'] !== null) {
                $totalBase += $p['quantity'] * $p['price_without_tax'];
            }
        }

        foreach ($norm as $p) {
            $subtotal = ($p['cost'] !== null) ? $p['quantity'] * $p['cost'] : 0.0;
            $this->insertOrdenDetail([
                $id,
                $p['product_id'],
                $p['unit_id'],
                $p['quantity'],
                $p['price_without_tax'],
                $p['tax'],
                $p['cost'],
                $subtotal
            ]);
        }

        $this->updateOrdenTotals([$totalProducts, $totalUnits, $totalCost, $totalBase, $id]);

        // Si el payload incluye campos de cabecera opcionales, se actualizan.
        if (!empty($payload['supplier_id']) || isset($payload['warehouse_id']) || isset($payload['note'])) {
            $fields = [];
            $vals   = [];
            if (isset($payload['supplier_id']))  { $fields[] = 'supplier_id = ?';  $vals[] = !empty($payload['supplier_id']) ? (int) $payload['supplier_id'] : null; }
            if (isset($payload['warehouse_id']))  { $fields[] = 'warehouse_id = ?'; $vals[] = !empty($payload['warehouse_id']) ? (int) $payload['warehouse_id'] : null; }
            if (isset($payload['note']))          { $fields[] = 'note = ?';          $vals[] = $payload['note']; }
            if (isset($payload['expected_date'])) { $fields[] = 'expected_date = ?'; $vals[] = $payload['expected_date'] ?: null; }
            if (!empty($fields)) {
                $vals[] = $id;
                $this->_CUD(
                    "UPDATE {$this->bd}purchase_order SET " . implode(', ', $fields) . ", updated_at = NOW() WHERE id = ?",
                    $vals
                );
            }
        }

        return [
            'status'  => 200,
            'message' => 'Orden actualizada',
            'id'      => $id
        ];
    }

    // -----------------------------------------------------------------------
    // Transiciones de estado
    // -----------------------------------------------------------------------

    function submitOrden() {
        $id     = (int) $_POST['id'];
        $header = $this->qGetOrden([$id]);

        if (!$header) return ['status' => 404, 'message' => 'Orden no encontrada'];
        if ($header['status'] !== 'Borrador') {
            return ['status' => 400, 'message' => 'Solo se puede enviar una orden en estado Borrador'];
        }

        $r = $this->updateOrdenStatus(['Solicitada', $id]);
        return [
            'status'  => $r ? 200 : 500,
            'message' => $r ? 'Solicitud enviada para aprobacion' : 'No se pudo actualizar el estado'
        ];
    }

    function approveOrden() {
        $id     = (int) $_POST['id'];
        $header = $this->qGetOrden([$id]);

        if (!$header) return ['status' => 404, 'message' => 'Orden no encontrada'];
        if ($header['status'] !== 'Solicitada') {
            return ['status' => 400, 'message' => 'Solo se puede aprobar una orden en estado Solicitada'];
        }

        $r = $this->updateOrdenStatusApprove(['Aprobada', $this->userId, $id]);
        return [
            'status'  => $r ? 200 : 500,
            'message' => $r ? 'Orden aprobada' : 'No se pudo aprobar la orden'
        ];
    }

    function rejectOrden() {
        $id     = (int) $_POST['id'];
        $header = $this->qGetOrden([$id]);

        if (!$header) return ['status' => 404, 'message' => 'Orden no encontrada'];
        if ($header['status'] !== 'Solicitada') {
            return ['status' => 400, 'message' => 'Solo se puede rechazar una orden en estado Solicitada'];
        }

        $reason = trim($_POST['reason'] ?? '');
        $r = $this->updateOrdenStatusReject([$this->userId, $reason ?: null, $id]);
        return [
            'status'  => $r ? 200 : 500,
            'message' => $r ? 'Orden rechazada' : 'No se pudo rechazar la orden'
        ];
    }

    // -----------------------------------------------------------------------
    // Recepcion parcial o total de la OC -> genera entrada de inventario
    // -----------------------------------------------------------------------

    function receiveOrden() {
        $id        = (int) $_POST['id'];
        $header    = $this->qGetOrden([$id]);

        if (!$header) return ['status' => 404, 'message' => 'Orden no encontrada'];
        if (!in_array($header['status'], ['Aprobada', 'Parcial'], true)) {
            return ['status' => 400, 'message' => 'Solo se puede recibir una orden Aprobada o Parcial'];
        }

        // El warehouse destino puede venir del POST (cuando la OC no lo tenia definido)
        // o del propio header de la OC.
        $warehouseId = !empty($_POST['warehouse_id'])
            ? (int) $_POST['warehouse_id']
            : (int) $header['warehouse_id'];

        if ($warehouseId <= 0) {
            return ['status' => 400, 'message' => 'Se requiere un almacen de destino para recibir la orden'];
        }

        // Si la OC no tenia almacen, lo fijamos ahora para trazabilidad.
        if (empty($header['warehouse_id'])) {
            $this->updateOrdenWarehouse([$warehouseId, $id]);
        }

        $items = json_decode($_POST['items'] ?? '{}', true);
        if (!is_array($items) || empty($items)) {
            return ['status' => 400, 'message' => 'No se indicaron materiales a recibir'];
        }

        $detail = $this->qGetOrdenDetail([$id]);
        if (empty($detail)) return ['status' => 400, 'message' => 'La orden no tiene renglones'];

        // Valida y clampea cantidades al pendiente real de cada renglon.
        $toReceive = [];
        foreach ($detail as $d) {
            $detailId  = (string) $d['id'];
            if (!array_key_exists($detailId, $items)) continue;

            $pending = (float) $d['quantity_ordered'] - (float) $d['quantity_received'];
            if ($pending <= 0) continue;

            $qtyNow = max(0, min((float) $items[$detailId], $pending));
            if ($qtyNow <= 0) continue;

            $toReceive[] = array_merge($d, ['qty_now' => $qtyNow]);
        }

        if (empty($toReceive)) {
            return ['status' => 400, 'message' => 'No hay cantidades validas a recibir o todos los renglones ya estan completos'];
        }

        // Genera folio de la nueva entrada de inventario.
        $entFolio = $this->nextFolio('ENT-', 'inventory_inflow', $this->companiesId);
        $note     = trim($_POST['note'] ?? '') ?: 'Recepcion de OC ' . $header['folio'];

        $totalProds  = count($toReceive);
        $totalUnits  = 0;
        $totalCost   = 0.0;
        $totalBase   = 0.0;
        foreach ($toReceive as $r) {
            $cost = $r['cost'] !== null ? (float) $r['cost'] : 0.0;
            $base = $r['price_without_tax'] !== null ? (float) $r['price_without_tax'] : 0.0;
            $totalUnits += $r['qty_now'];
            $totalCost  += $r['qty_now'] * $cost;
            $totalBase  += $r['qty_now'] * $base;
        }

        // inflow_origin COMPRA tiene id=1 segun el esquema.
        $originId = 1;

        $okInflow = $this->insertInflowFromOrden([
            $entFolio,
            $note,
            $totalProds,
            $totalUnits,
            $totalCost,
            $totalBase,
            'Aplicada',
            $originId,
            $warehouseId,
            $header['supplier_id'] ?: null,
            $header['branch_id'],
            $this->userId,
            $this->companiesId,
            date('Y-m-d'),
            $id
        ]);

        if (!$okInflow) return ['status' => 500, 'message' => 'No se pudo crear la entrada de inventario'];

        $inflowRow = $this->_Read(
            "SELECT id FROM {$this->bd}inventory_inflow WHERE folio = ? AND companies_id = ? LIMIT 1",
            [$entFolio, $this->companiesId]
        );
        $inflowId = (int) ($inflowRow[0]['id'] ?? 0);

        if ($inflowId <= 0) return ['status' => 500, 'message' => 'No se pudo recuperar la entrada generada'];

        // Procesa cada renglon recibido: stock + detalle de la entrada.
        foreach ($toReceive as $r) {
            $productId = (int) $r['product_id'];
            $qtyNow    = $r['qty_now'];
            $cost      = $r['cost'] !== null ? (float) $r['cost'] : 0.0;
            $base      = $r['price_without_tax'] !== null ? (float) $r['price_without_tax'] : 0.0;
            $tax       = $r['tax'] !== null ? (float) $r['tax'] : 0.0;
            $subtotal  = $qtyNow * $cost;

            $stockRow = $this->getStockRow([$productId, $warehouseId]);
            $prev     = $stockRow ? (float) $stockRow['quantity'] : 0.0;
            $post     = $prev + $qtyNow;

            $this->insertInflowDetail([
                $qtyNow,
                $cost,
                $subtotal,
                $base,
                $tax,
                $prev,
                $post,
                $productId,
                $inflowId,
                $r['unit_id'] ?: null
            ]);

            // Actualiza precio/costo en el catalogo del item si hay costo.
            if ($cost > 0) {
                $this->updateItemTax([$cost, $base, $tax, $productId, $this->companiesId]);
            }

            // Aplica el movimiento al stock.
            if ($stockRow) {
                $this->updateStockQuantity([$post, (int) $stockRow['id']]);
            } else {
                $this->insertStockRow([$post, $warehouseId, $productId, $this->companiesId]);
            }

            // Suma la cantidad recibida al renglon de la OC.
            $this->updateDetailReceived([$qtyNow, (int) $r['id']]);
        }

        // Recalcula el estado de la OC leyendo los renglones actualizados.
        $detailUpdated = $this->qGetOrdenDetail([$id]);
        $allReceived   = true;
        $anyReceived   = false;
        foreach ($detailUpdated as $d) {
            if ((float) $d['quantity_received'] > 0) $anyReceived = true;
            if ((float) $d['quantity_received'] < (float) $d['quantity_ordered']) $allReceived = false;
        }

        $newStatus = $allReceived ? 'Recibida' : ($anyReceived ? 'Parcial' : $header['status']);
        $this->updateOrdenStatus([$newStatus, $id]);

        $udsTxt  = (fmod($totalUnits, 1) == 0) ? (string) (int) $totalUnits : (string) round($totalUnits, 2);

        return [
            'status'       => 200,
            'message'      => "Recepcion registrada: entrada {$entFolio} generada, {$totalProds} materiales, {$udsTxt} uds. Orden ahora {$newStatus}",
            'entrada_folio'=> $entFolio,
            'orden_status' => $newStatus
        ];
    }

    // -----------------------------------------------------------------------
    // Cancelar OC
    // Las entradas ya generadas en recepciones parciales previas NO se revierten;
    // solo se bloquea la posibilidad de seguir recibiendo contra esta OC.
    // -----------------------------------------------------------------------

    function cancelOrden() {
        $id     = (int) $_POST['id'];
        $header = $this->qGetOrden([$id]);

        if (!$header) return ['status' => 404, 'message' => 'Orden no encontrada'];
        if ($header['status'] === 'Recibida') {
            return ['status' => 400, 'message' => 'No se puede cancelar una orden ya recibida completamente'];
        }
        if ($header['status'] === 'Cancelada') {
            return ['status' => 400, 'message' => 'La orden ya esta cancelada'];
        }

        $r = $this->updateOrdenStatus(['Cancelada', $id]);
        return [
            'status'  => $r ? 200 : 500,
            'message' => $r ? 'Orden cancelada' : 'No se pudo cancelar la orden'
        ];
    }

    // -----------------------------------------------------------------------
    // Imprimir OC (devuelve el mismo shape que getOrden para que el front
    // arme el documento; igual que printEntrada hace en entradas)
    // -----------------------------------------------------------------------

    function printOrden() {
        $id     = (int) $_POST['id'];
        $header = $this->qGetOrden([$id]);
        if (!$header) return ['status' => 404, 'message' => 'Orden no encontrada'];

        $header['status_badge'] = $this->statusBadge($header['status']);
        $detail = $this->qGetOrdenDetail([$id]);
        return ['status' => 200, 'header' => $header, 'detail' => $detail];
    }

    // -----------------------------------------------------------------------
    // Badge de estado por color
    // -----------------------------------------------------------------------

    private function statusBadge($status) {
        $map = [
            'Borrador'   => ['bg' => 'rgba(156,163,175,0.18)', 'fg' => '#9CA3AF'],
            'Solicitada' => ['bg' => 'rgba(251,191,36,0.18)',  'fg' => '#FBBF24'],
            'Aprobada'   => ['bg' => 'rgba(192,90,64,0.18)',   'fg' => '#C05A40'],
            'Parcial'    => ['bg' => 'rgba(249,115,22,0.18)',  'fg' => '#F97316'],
            'Recibida'   => ['bg' => 'rgba(63,193,137,0.18)',  'fg' => '#3FC189'],
            'Rechazada'  => ['bg' => 'rgba(224,36,36,0.18)',   'fg' => '#E02424'],
            'Cancelada'  => ['bg' => 'rgba(224,36,36,0.18)',   'fg' => '#E02424']
        ];
        $c = $map[$status] ?? ['bg' => 'rgba(156,163,175,0.18)', 'fg' => '#9CA3AF'];
        return "<span class='px-2 py-0.5 rounded text-[10px] font-bold' style='background:{$c['bg']};color:{$c['fg']};'>" . strtoupper($status) . "</span>";
    }

}

$obj = new ctrl();
$opc = $_POST['opc'];
if (!method_exists($obj, $opc)) {
    echo json_encode(['status' => 405, 'message' => "opc '{$opc}' no implementado"]);
    exit(0);
}
echo json_encode($obj->{$opc}());
