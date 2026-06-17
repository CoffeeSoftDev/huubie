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
        $_POST += ['companies_id' => 0, 'branch_id' => 0, 'user_id' => 0];
        $this->companiesId = (int) ($_SESSION['company_id'] ?? $_POST['companies_id']);
        $this->branchId    = (int) ($_SESSION['branch_id']  ?? $_POST['branch_id']);
        $this->userId      = (int) ($_SESSION['user_id']    ?? $_POST['user_id']);
    }

    function init() {
        $productos = array_map(function ($producto) {
            return [
                'id'                => (string) $producto['id'],
                'sku'               => $producto['sku'] ?: '',
                'nombre'            => $producto['nombre'],
                'categoria'         => $producto['categoria'] ?: 'Sin categoria',
                'costo'             => (float) $producto['costo'],
                'precio'            => (float) ($producto['precio'] ?? 0),
                'price_without_tax' => $producto['price_without_tax'] !== null ? (float) $producto['price_without_tax'] : null,
                'tax'               => $producto['tax'] !== null ? (float) $producto['tax'] : null,
                'stock'             => 0,
                'image'             => $producto['image'] ?? '',
                'icon'              => 'package',
                'bg'                => 'bg-gray-100',
                'color'             => 'text-gray-500'
            ];
        }, $this->qProductsForTransfer([$this->companiesId]));

        return [
            'status'        => 200,
            'companies_id'  => $this->companiesId,
            'branch_id'     => $this->branchId,
            'user_id'       => $this->userId,
            'sucursales'    => $this->lsSucursales(['company_id' => $this->companiesId, 'user_id' => $this->userId, 'is_owner' => (int) ($_SESSION['is_owner'] ?? 0)]),
            'almacenes'     => $this->lsWarehouses(['companies_id' => $this->companiesId]),
            'proveedores'   => $this->lsSuppliers([$this->companiesId]),
            'productos'     => $productos,
            'estados_orden' => [
                ['id' => '',           'valor' => 'Todos los estados'],
                ['id' => 'Activas',    'valor' => 'Activas (sin Cancelada)'],
                ['id' => 'Borrador',   'valor' => 'Borrador'],
                ['id' => 'Solicitada', 'valor' => 'Solicitada'],
                ['id' => 'Aprobada',   'valor' => 'Aprobada'],
                ['id' => 'Parcial',    'valor' => 'Parcial'],
                ['id' => 'Recibida',   'valor' => 'Recibida'],
                ['id' => 'Rechazada',  'valor' => 'Rechazada'],
                ['id' => 'Cancelada',  'valor' => 'Cancelada']
            ]
        ];
    }

    function lsOrdenes() {
        $_POST += ['mine' => 0, 'withTarget' => 0, 'branch_id' => '', 'supplier_id' => '', 'status' => '', 'fi' => '', 'ff' => '', 'q' => ''];

        // withTarget: vista solicitante (suma "Solicitar a" y muestra fecha+hora del pedido).
        $mine       = $_POST['mine'] ? $this->userId : null;
        $withTarget = (bool) $_POST['withTarget'];

        $ordenes = $this->qOrdenes([
            'companies_id' => $this->companiesId,
            'branch_id'    => $_POST['branch_id'],
            'supplier_id'  => $_POST['supplier_id'],
            'status'       => $_POST['status'],
            'fi'           => $_POST['fi'],
            'ff'           => $_POST['ff'],
            'q'            => $_POST['q'],
            'mine'         => $mine
        ]);

        $__row = [];
        foreach ($ordenes as $orden) {
            $fila = [
                'id'     => $orden['id'],
                'Folio'  => $orden['folio'],
                'Fecha'  => $withTarget
                    ? fechaHoraSolicitud($orden['created_at'] ?? $orden['date_order'])
                    : formatSpanishDate($orden['date_order']),
            ];

            if ($withTarget) {
                $fila['Solicitar a'] = $orden['branch_name'] ?: '<span class="italic text-gray-400">-</span>';
            }

            $fila['Proveedor']  = $orden['supplier_name'] ?: '<span class="italic text-gray-400">N/A</span>';
            $fila['Almacen']    = $orden['warehouse_name'] ?: '-';
            $fila['Materiales'] = (int) $orden['total_products'];
            $fila['Estado']     = statusBadge($orden['status']);
            $fila['a']          = actionButtons($orden['folio'], $orden['id']);

            $__row[] = $fila;
        }

        return ['status' => 200, 'row' => $__row, 'thead' => ''];
    }

    function showOrdenes() {
        $_POST += ['mine' => 0, 'branch_id' => '', 'supplier_id' => '', 'status' => '', 'fi' => '', 'ff' => '', 'q' => ''];

        $mine = $_POST['mine'] ? $this->userId : null;

        $counts = $this->getOrdenKpis([
            'companies_id' => $this->companiesId,
            'branch_id'    => $_POST['branch_id'],
            'supplier_id'  => $_POST['supplier_id'],
            'status'       => $_POST['status'],
            'fi'           => $_POST['fi'],
            'ff'           => $_POST['ff'],
            'q'            => $_POST['q'],
            'mine'         => $mine
        ]);
        return ['status' => 200, 'counts' => $counts];
    }

    function getOrden() {
        $id     = (int) $_POST['id'];
        $header = $this->qGetOrden([$id]);
        if (!$header) return ['status' => 404, 'message' => 'Orden no encontrada'];

        $header['status_badge'] = statusBadge($header['status']);
        $detail = $this->qGetOrdenDetail([$id]);
        return ['status' => 200, 'header' => $header, 'detail' => $detail];
    }

    function createSupplier() {
        $_POST += ['name' => '', 'contact_name' => '', 'phone' => '', 'email' => ''];

        $name = trim($_POST['name']);
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
            trim($_POST['contact_name']) ?: null,
            trim($_POST['phone']) ?: null,
            trim($_POST['email']) ?: null,
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

    function saveOrden() {
        $_POST += ['payload' => '[]'];

        $payload   = json_decode($_POST['payload'], true);
        $productos = $payload['productos'] ?? [];

        if (empty($productos)) {
            return ['status' => 400, 'message' => 'No se enviaron renglones'];
        }

        $submit = !empty($payload['submit']);
        $status = $submit ? 'Solicitada' : 'Borrador';
        $folio  = $this->nextFolio('OC-', 'purchase_order', $this->companiesId);

        // El costo con impuesto es el pivote; la base sin impuesto se deriva.
        // Si el solicitante no manda costo, los campos de costo quedan null.
        $norm = [];
        foreach ($productos as $producto) {
            $tax  = ($producto['tax']  ?? '') === '' || $producto['tax']  === null ? 0.0  : (float) $producto['tax'];
            $base = ($producto['price_without_tax'] ?? '') === '' || $producto['price_without_tax'] === null ? null : (float) $producto['price_without_tax'];
            $cost = ($producto['cost'] ?? '') === '' || $producto['cost'] === null ? null : (float) $producto['cost'];

            if ($cost !== null) {
                $base = $tax > 0 ? $cost / (1 + $tax / 100) : $cost;
            } elseif ($base !== null) {
                $cost = $base + ($base * $tax / 100);
                $base = $tax > 0 ? $cost / (1 + $tax / 100) : $cost;
            }

            $norm[] = [
                'product_id'        => (int) $producto['product_id'],
                'quantity'          => (float) $producto['quantity'],
                'price_without_tax' => $base,
                'tax'               => $tax,
                'cost'              => $cost,
                'unit_id'           => !empty($producto['unit_id']) ? (int) $producto['unit_id'] : null
            ];
        }

        $totalProducts = count($norm);
        $totalUnits    = 0;
        $totalCost     = 0.0;
        $totalBase     = 0.0;
        foreach ($norm as $renglon) {
            $totalUnits += $renglon['quantity'];
            if ($renglon['cost'] !== null) {
                $totalCost += $renglon['quantity'] * $renglon['cost'];
            }
            if ($renglon['price_without_tax'] !== null) {
                $totalBase += $renglon['quantity'] * $renglon['price_without_tax'];
            }
        }

        $ok = $this->insertOrden([
            $folio,
            !empty($payload['supplier_id'])   ? (int) $payload['supplier_id']   : null,
            (int) ($payload['branch_id']       ?? $this->branchId),
            !empty($payload['destination_branch_id']) ? (int) $payload['destination_branch_id'] : null,
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

        // _CUD no devuelve el id generado; se recupera por folio.
        $ordenRow = $this->_Read(
            "SELECT id FROM {$this->bd}purchase_order WHERE folio = ? AND companies_id = ? LIMIT 1",
            [$folio, $this->companiesId]
        );
        $ordenId = (int) ($ordenRow[0]['id'] ?? 0);

        foreach ($norm as $renglon) {
            $subtotal = ($renglon['cost'] !== null) ? $renglon['quantity'] * $renglon['cost'] : 0.0;
            $this->insertOrdenDetail([
                $ordenId,
                $renglon['product_id'],
                $renglon['unit_id'],
                $renglon['quantity'],
                $renglon['price_without_tax'],
                $renglon['tax'],
                $renglon['cost'],
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

    // Editar OC (solo Borrador o Solicitada): soft-delete de renglones previos +
    // reinsercion, para que quantity_received quede en 0 en los renglones nuevos.
    function editOrden() {
        $_POST += ['payload' => '[]'];

        $id     = (int) $_POST['id'];
        $header = $this->qGetOrden([$id]);

        if (!$header) {
            return ['status' => 404, 'message' => 'Orden no encontrada'];
        }
        if (!in_array($header['status'], ['Borrador', 'Solicitada'], true)) {
            return ['status' => 400, 'message' => 'Solo se puede editar una orden en estado Borrador o Solicitada'];
        }

        $payload   = json_decode($_POST['payload'], true);
        $productos = $payload['productos'] ?? [];

        if (empty($productos)) {
            return ['status' => 400, 'message' => 'No se enviaron renglones'];
        }

        $this->softDeleteOrdenDetails([$id]);

        $norm = [];
        foreach ($productos as $producto) {
            $tax  = ($producto['tax']  ?? '') === '' || $producto['tax']  === null ? 0.0  : (float) $producto['tax'];
            $base = ($producto['price_without_tax'] ?? '') === '' || $producto['price_without_tax'] === null ? null : (float) $producto['price_without_tax'];
            $cost = ($producto['cost'] ?? '') === '' || $producto['cost'] === null ? null : (float) $producto['cost'];

            if ($cost !== null) {
                $base = $tax > 0 ? $cost / (1 + $tax / 100) : $cost;
            } elseif ($base !== null) {
                $cost = $base + ($base * $tax / 100);
                $base = $tax > 0 ? $cost / (1 + $tax / 100) : $cost;
            }

            $norm[] = [
                'product_id'        => (int) $producto['product_id'],
                'quantity'          => (float) $producto['quantity'],
                'price_without_tax' => $base,
                'tax'               => $tax,
                'cost'              => $cost,
                'unit_id'           => !empty($producto['unit_id']) ? (int) $producto['unit_id'] : null
            ];
        }

        $totalProducts = count($norm);
        $totalUnits    = 0;
        $totalCost     = 0.0;
        $totalBase     = 0.0;
        foreach ($norm as $renglon) {
            $totalUnits += $renglon['quantity'];
            if ($renglon['cost'] !== null) {
                $totalCost += $renglon['quantity'] * $renglon['cost'];
            }
            if ($renglon['price_without_tax'] !== null) {
                $totalBase += $renglon['quantity'] * $renglon['price_without_tax'];
            }
        }

        foreach ($norm as $renglon) {
            $subtotal = ($renglon['cost'] !== null) ? $renglon['quantity'] * $renglon['cost'] : 0.0;
            $this->insertOrdenDetail([
                $id,
                $renglon['product_id'],
                $renglon['unit_id'],
                $renglon['quantity'],
                $renglon['price_without_tax'],
                $renglon['tax'],
                $renglon['cost'],
                $subtotal
            ]);
        }

        $this->updateOrdenTotals([$totalProducts, $totalUnits, $totalCost, $totalBase, $id]);

        if (!empty($payload['supplier_id']) || isset($payload['warehouse_id']) || isset($payload['note']) || isset($payload['destination_branch_id'])) {
            $fields = [];
            $vals   = [];
            if (isset($payload['supplier_id']))           { $fields[] = 'supplier_id = ?';           $vals[] = !empty($payload['supplier_id']) ? (int) $payload['supplier_id'] : null; }
            if (isset($payload['destination_branch_id'])) { $fields[] = 'destination_branch_id = ?'; $vals[] = !empty($payload['destination_branch_id']) ? (int) $payload['destination_branch_id'] : null; }
            if (isset($payload['warehouse_id']))          { $fields[] = 'warehouse_id = ?';          $vals[] = !empty($payload['warehouse_id']) ? (int) $payload['warehouse_id'] : null; }
            if (isset($payload['note']))                  { $fields[] = 'note = ?';                  $vals[] = $payload['note']; }
            if (isset($payload['expected_date']))         { $fields[] = 'expected_date = ?';         $vals[] = $payload['expected_date'] ?: null; }
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

    function submitOrden() {
        $id     = (int) $_POST['id'];
        $header = $this->qGetOrden([$id]);

        if (!$header) return ['status' => 404, 'message' => 'Orden no encontrada'];
        if ($header['status'] !== 'Borrador') {
            return ['status' => 400, 'message' => 'Solo se puede enviar una orden en estado Borrador'];
        }

        $ok = $this->updateOrdenStatus(['Solicitada', $id]);
        return [
            'status'  => $ok ? 200 : 500,
            'message' => $ok ? 'Solicitud enviada para aprobacion' : 'No se pudo actualizar el estado'
        ];
    }

    function approveOrden() {
        $id     = (int) $_POST['id'];
        $header = $this->qGetOrden([$id]);

        if (!$header) return ['status' => 404, 'message' => 'Orden no encontrada'];
        if ($header['status'] !== 'Solicitada') {
            return ['status' => 400, 'message' => 'Solo se puede aprobar una orden en estado Solicitada'];
        }
        if (!$this->puedeGestionarDestino($header)) {
            return ['status' => 403, 'message' => 'Solo la sucursal de destino puede aprobar esta solicitud'];
        }

        $ok = $this->updateOrdenStatusApprove(['Aprobada', $this->userId, $id]);
        return [
            'status'  => $ok ? 200 : 500,
            'message' => $ok ? 'Orden aprobada' : 'No se pudo aprobar la orden'
        ];
    }

    function rejectOrden() {
        $_POST += ['reason' => ''];

        $id     = (int) $_POST['id'];
        $header = $this->qGetOrden([$id]);

        if (!$header) return ['status' => 404, 'message' => 'Orden no encontrada'];
        if ($header['status'] !== 'Solicitada') {
            return ['status' => 400, 'message' => 'Solo se puede rechazar una orden en estado Solicitada'];
        }
        if (!$this->puedeGestionarDestino($header)) {
            return ['status' => 403, 'message' => 'Solo la sucursal de destino puede rechazar esta solicitud'];
        }

        $reason = trim($_POST['reason']);
        $ok = $this->updateOrdenStatusReject([$this->userId, $reason ?: null, $id]);
        return [
            'status'  => $ok ? 200 : 500,
            'message' => $ok ? 'Orden rechazada' : 'No se pudo rechazar la orden'
        ];
    }

    // Recepcion parcial o total de la OC: genera una entrada de inventario.
    function receiveOrden() {
        $_POST += ['warehouse_id' => 0, 'items' => '{}', 'note' => ''];

        $id     = (int) $_POST['id'];
        $header = $this->qGetOrden([$id]);

        if (!$header) return ['status' => 404, 'message' => 'Orden no encontrada'];
        if (!in_array($header['status'], ['Aprobada', 'Parcial'], true)) {
            return ['status' => 400, 'message' => 'Solo se puede recibir una orden Aprobada o Parcial'];
        }

        $warehouseId = $_POST['warehouse_id'] ? (int) $_POST['warehouse_id'] : (int) $header['warehouse_id'];

        if ($warehouseId <= 0) {
            return ['status' => 400, 'message' => 'Se requiere un almacen de destino para recibir la orden'];
        }

        if (empty($header['warehouse_id'])) {
            $this->updateOrdenWarehouse([$warehouseId, $id]);
        }

        $items = json_decode($_POST['items'], true);
        if (!is_array($items) || empty($items)) {
            return ['status' => 400, 'message' => 'No se indicaron materiales a recibir'];
        }

        $detalle = $this->qGetOrdenDetail([$id]);
        if (empty($detalle)) return ['status' => 400, 'message' => 'La orden no tiene renglones'];

        // Valida y clampea cada cantidad al pendiente real del renglon.
        $toReceive = [];
        foreach ($detalle as $renglon) {
            $detailId = (string) $renglon['id'];
            if (!array_key_exists($detailId, $items)) continue;

            $pending = (float) $renglon['quantity_ordered'] - (float) $renglon['quantity_received'];
            if ($pending <= 0) continue;

            $qtyNow = max(0, min((float) $items[$detailId], $pending));
            if ($qtyNow <= 0) continue;

            $toReceive[] = array_merge($renglon, ['qty_now' => $qtyNow]);
        }

        if (empty($toReceive)) {
            return ['status' => 400, 'message' => 'No hay cantidades validas a recibir o todos los renglones ya estan completos'];
        }

        $entFolio = $this->nextFolio('ENT-', 'inventory_inflow', $this->companiesId);
        $note     = trim($_POST['note']) ?: 'Recepcion de OC ' . $header['folio'];

        $totalProds = count($toReceive);
        $totalUnits = 0;
        $totalCost  = 0.0;
        $totalBase  = 0.0;
        foreach ($toReceive as $linea) {
            $cost = $linea['cost'] !== null ? (float) $linea['cost'] : 0.0;
            $base = $linea['price_without_tax'] !== null ? (float) $linea['price_without_tax'] : 0.0;
            $totalUnits += $linea['qty_now'];
            $totalCost  += $linea['qty_now'] * $cost;
            $totalBase  += $linea['qty_now'] * $base;
        }

        // inflow_origin COMPRA = id 1.
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

        foreach ($toReceive as $linea) {
            $productId = (int) $linea['product_id'];
            $qtyNow    = $linea['qty_now'];
            $cost      = $linea['cost'] !== null ? (float) $linea['cost'] : 0.0;
            $base      = $linea['price_without_tax'] !== null ? (float) $linea['price_without_tax'] : 0.0;
            $tax       = $linea['tax'] !== null ? (float) $linea['tax'] : 0.0;
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
                $linea['unit_id'] ?: null
            ]);

            if ($cost > 0) {
                $this->updateItemTax([$cost, $base, $tax, $productId, $this->companiesId]);
            }

            if ($stockRow) {
                $this->updateStockQuantity([$post, (int) $stockRow['id']]);
            } else {
                $this->insertStockRow([$post, $warehouseId, $productId, $this->companiesId]);
            }

            $this->updateDetailReceived([$qtyNow, (int) $linea['id']]);
        }

        // Recalcula el estado leyendo los renglones actualizados.
        $detalleActualizado = $this->qGetOrdenDetail([$id]);
        $allReceived = true;
        $anyReceived = false;
        foreach ($detalleActualizado as $renglon) {
            if ((float) $renglon['quantity_received'] > 0) $anyReceived = true;
            if ((float) $renglon['quantity_received'] < (float) $renglon['quantity_ordered']) $allReceived = false;
        }

        $newStatus = $allReceived ? 'Recibida' : ($anyReceived ? 'Parcial' : $header['status']);
        $this->updateOrdenStatus([$newStatus, $id]);

        $udsTxt = (fmod($totalUnits, 1) == 0) ? (string) (int) $totalUnits : (string) round($totalUnits, 2);

        return [
            'status'        => 200,
            'message'       => "Recepcion registrada: entrada {$entFolio} generada, {$totalProds} materiales, {$udsTxt} uds. Orden ahora {$newStatus}",
            'entrada_folio' => $entFolio,
            'orden_status'  => $newStatus
        ];
    }

    // Cancelar OC: las entradas ya generadas en recepciones parciales previas NO
    // se revierten; solo se bloquea seguir recibiendo contra esta OC.
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

        $ok = $this->updateOrdenStatus(['Cancelada', $id]);
        return [
            'status'  => $ok ? 200 : 500,
            'message' => $ok ? 'Orden cancelada' : 'No se pudo cancelar la orden'
        ];
    }

    function printOrden() {
        $id     = (int) $_POST['id'];
        $header = $this->qGetOrden([$id]);
        if (!$header) return ['status' => 404, 'message' => 'Orden no encontrada'];

        $header['status_badge'] = statusBadge($header['status']);
        $detail = $this->qGetOrdenDetail([$id]);
        return ['status' => 200, 'header' => $header, 'detail' => $detail];
    }

    // Solo la sucursal destino (a quien se le pide) puede aprobar/rechazar/surtir
    // una solicitud inter-sucursal. Sin destino distinto o sin sucursal de sesion,
    // no se restringe (conserva el comportamiento previo).
    private function puedeGestionarDestino($header) {
        $dest = (int) ($header['destination_branch_id'] ?? 0);
        $orig = (int) ($header['branch_id'] ?? 0);
        $interSucursal = $dest > 0 && $dest !== $orig;
        if (!$interSucursal || $this->branchId <= 0) return true;
        return $this->branchId === $dest;
    }

    function stockByWarehouse() {
        $_POST += ['warehouse_id' => 0];

        $warehouseId = (int) $_POST['warehouse_id'];
        if ($warehouseId <= 0) return ['status' => 400, 'message' => 'Almacen no valido'];

        $map = [];
        foreach ($this->qStockByWarehouse([$warehouseId]) as $registro) {
            $map[(string) $registro['item_id']] = (float) $registro['quantity'];
        }
        return ['status' => 200, 'stock' => $map];
    }

    // Surtido a sucursal: reabasto opcional (entrada que sube stock) + surtido
    // (salida SURTIDO_SUC que descuenta), todo en una transaccion.
    function fulfillOrden() {
        $_POST += ['warehouse_id' => 0, 'items' => '{}', 'replenish' => '{}', 'note' => ''];

        $id     = (int) $_POST['id'];
        $header = $this->qGetOrden([$id]);

        if (!$header) return ['status' => 404, 'message' => 'Solicitud no encontrada'];
        if (!in_array($header['status'], ['Solicitada', 'Aprobada', 'Parcial'], true)) {
            return ['status' => 400, 'message' => 'Solo se puede surtir una solicitud Solicitada, Aprobada o Parcial'];
        }
        if (!$this->puedeGestionarDestino($header)) {
            return ['status' => 403, 'message' => 'Solo la sucursal de destino puede surtir esta solicitud'];
        }

        $warehouseId = $_POST['warehouse_id'] ? (int) $_POST['warehouse_id'] : (int) $header['warehouse_id'];
        if ($warehouseId <= 0) {
            return ['status' => 400, 'message' => 'Se requiere un almacen de origen para surtir'];
        }

        $items     = json_decode($_POST['items'], true);
        $replenish = json_decode($_POST['replenish'], true);
        if (!is_array($items))     $items     = [];
        if (!is_array($replenish)) $replenish = [];

        $detalle = $this->qGetOrdenDetail([$id]);
        if (empty($detalle)) return ['status' => 400, 'message' => 'La solicitud no tiene renglones'];

        $reasonId = $this->getShrinkageReasonId(['SURTIDO_SUC']);
        if (!$reasonId) return ['status' => 500, 'message' => 'Falta configurar el motivo de salida (SURTIDO_SUC)'];

        $byId = [];
        foreach ($detalle as $renglon) $byId[(string) $renglon['id']] = $renglon;

        try {
            return $this->transaction(function () use ($id, $header, $warehouseId, $items, $replenish, $byId, $reasonId) {
                if (empty($header['warehouse_id'])) $this->updateOrdenWarehouse([$warehouseId, $id]);

                $note = trim($_POST['note']) ?: ('Surtido de solicitud ' . $header['folio']);

                // 1) Reabasto opcional: entrada que sube stock.
                $entFolio = $this->applyReplenish($id, $header, $warehouseId, $replenish, $byId);

                // 2) Surtido: salida que descuenta del stock ya reabastecido.
                $stockCache = [];
                $toSupply   = [];
                foreach ($items as $detailId => $qty) {
                    $detailId = (string) $detailId;
                    if (!isset($byId[$detailId])) continue;

                    $renglon = $byId[$detailId];
                    $pending = (float) $renglon['quantity_ordered'] - (float) $renglon['quantity_received'];
                    if ($pending <= 0) continue;

                    $pid = (int) $renglon['product_id'];
                    if (!isset($stockCache[$pid])) {
                        $sr = $this->getStockRow([$pid, $warehouseId]);
                        $stockCache[$pid] = ['id' => $sr ? (int) $sr['id'] : 0, 'qty' => $sr ? (float) $sr['quantity'] : 0.0];
                    }

                    $avail  = $stockCache[$pid]['qty'];
                    $qtyNow = min((float) $qty, $pending, $avail);
                    if ($qtyNow <= 0) continue;

                    $prev = $avail;
                    $post = $avail - $qtyNow;
                    $stockCache[$pid]['qty'] = $post;

                    $toSupply[] = [
                        'detail_row_id' => (int) $renglon['id'],
                        'product_id'    => $pid,
                        'cost'          => $renglon['cost'] !== null ? (float) $renglon['cost'] : 0.0,
                        'qty'           => $qtyNow,
                        'prev'          => $prev,
                        'post'          => $post,
                        'stock_id'      => $stockCache[$pid]['id']
                    ];
                }

                if (empty($toSupply)) {
                    throw new Exception('No hay stock disponible para surtir las cantidades indicadas');
                }

                $siFolio  = $this->nextFolio('SI-', 'inventory_shrinkage', $this->companiesId);
                $totProds = count($toSupply);
                $totUnits = 0;
                $totCost  = 0.0;
                foreach ($toSupply as $linea) {
                    $totUnits += $linea['qty'];
                    $totCost  += $linea['qty'] * $linea['cost'];
                }

                $this->insertShrinkageFromOrden([
                    $siFolio, $note, $totProds, $totUnits, $totCost,
                    'Aplicada', $reasonId, $warehouseId,
                    $header['branch_id'], $this->userId, $this->companiesId, date('Y-m-d')
                ]);
                $shrRow = $this->_Read(
                    "SELECT id FROM {$this->bd}inventory_shrinkage WHERE folio = ? AND companies_id = ? LIMIT 1",
                    [$siFolio, $this->companiesId]
                );
                $shrId = (int) ($shrRow[0]['id'] ?? 0);
                if ($shrId <= 0) throw new Exception('No se pudo generar la salida de surtido');

                foreach ($toSupply as $linea) {
                    $this->insertShrinkageDetail([
                        $linea['qty'], $linea['cost'], $linea['qty'] * $linea['cost'], $linea['prev'], $linea['post'], $linea['product_id'], $shrId
                    ]);
                    if ($linea['stock_id'] > 0) $this->updateStockQuantity([$linea['post'], $linea['stock_id']]);
                    $this->updateDetailReceived([$linea['qty'], $linea['detail_row_id']]);
                }

                // 3) Recalcula el estado leyendo los renglones actualizados.
                $detalleActualizado = $this->qGetOrdenDetail([$id]);
                $allDone = true;
                $anyDone = false;
                foreach ($detalleActualizado as $renglon) {
                    if ((float) $renglon['quantity_received'] > 0) $anyDone = true;
                    if ((float) $renglon['quantity_received'] < (float) $renglon['quantity_ordered']) $allDone = false;
                }
                $newStatus = $allDone ? 'Recibida' : ($anyDone ? 'Parcial' : $header['status']);
                $this->updateOrdenStatus([$newStatus, $id]);

                $udsTxt = (fmod($totUnits, 1) == 0) ? (string) (int) $totUnits : (string) round($totUnits, 2);
                $msg    = "Surtido registrado: salida {$siFolio}, {$totProds} materiales, {$udsTxt} uds.";
                if ($entFolio) $msg .= " Reabasto {$entFolio} aplicado.";
                $msg .= " Solicitud ahora {$newStatus}.";

                return [
                    'status'        => 200,
                    'message'       => $msg,
                    'salida_folio'  => $siFolio,
                    'entrada_folio' => $entFolio,
                    'orden_status'  => $newStatus
                ];
            });
        } catch (\Throwable $e) {
            return ['status' => 500, 'message' => 'No se pudo surtir: ' . $e->getMessage()];
        }
    }

    // Reabasto: genera una entrada (inventory_inflow, origen COMPRA) por las
    // cantidades indicadas y sube el stock. Devuelve el folio ENT- o null.
    private function applyReplenish($id, $header, $warehouseId, $replenish, $byId) {
        $repLines = [];
        foreach ($replenish as $detailId => $qty) {
            $qty = (float) $qty;
            if ($qty <= 0 || !isset($byId[(string) $detailId])) continue;
            $repLines[] = array_merge($byId[(string) $detailId], ['rep_qty' => $qty]);
        }
        if (empty($repLines)) return null;

        $entFolio = $this->nextFolio('ENT-', 'inventory_inflow', $this->companiesId);
        $totUnits = 0;
        $totCost  = 0.0;
        $totBase  = 0.0;
        foreach ($repLines as $linea) {
            $cost = $linea['cost'] !== null ? (float) $linea['cost'] : 0.0;
            $base = $linea['price_without_tax'] !== null ? (float) $linea['price_without_tax'] : 0.0;
            $totUnits += $linea['rep_qty'];
            $totCost  += $linea['rep_qty'] * $cost;
            $totBase  += $linea['rep_qty'] * $base;
        }

        $this->insertInflowFromOrden([
            $entFolio, 'Reabasto para surtir ' . $header['folio'],
            count($repLines), $totUnits, $totCost, $totBase,
            'Aplicada', 1, $warehouseId, $header['supplier_id'] ?: null,
            $header['branch_id'], $this->userId, $this->companiesId, date('Y-m-d'), $id
        ]);
        $inflowRow = $this->_Read(
            "SELECT id FROM {$this->bd}inventory_inflow WHERE folio = ? AND companies_id = ? LIMIT 1",
            [$entFolio, $this->companiesId]
        );
        $inflowId = (int) ($inflowRow[0]['id'] ?? 0);
        if ($inflowId <= 0) throw new Exception('No se pudo generar la entrada de reabasto');

        foreach ($repLines as $linea) {
            $productId = (int) $linea['product_id'];
            $qtyRep    = $linea['rep_qty'];
            $cost      = $linea['cost'] !== null ? (float) $linea['cost'] : 0.0;
            $base      = $linea['price_without_tax'] !== null ? (float) $linea['price_without_tax'] : 0.0;
            $tax       = $linea['tax'] !== null ? (float) $linea['tax'] : 0.0;

            $stockRow = $this->getStockRow([$productId, $warehouseId]);
            $prev     = $stockRow ? (float) $stockRow['quantity'] : 0.0;
            $post     = $prev + $qtyRep;

            $this->insertInflowDetail([
                $qtyRep, $cost, $qtyRep * $cost, $base, $tax,
                $prev, $post, $productId, $inflowId, $linea['unit_id'] ?: null
            ]);
            if ($stockRow) $this->updateStockQuantity([$post, (int) $stockRow['id']]);
            else           $this->insertStockRow([$post, $warehouseId, $productId, $this->companiesId]);
        }

        return $entFolio;
    }

}

// Complements.

function actionButtons($folio, $id) {
    return [
        [
            'class'   => 'inline-flex items-center justify-center w-9 h-9 p-2 text-[#9CA3AF] hover:text-[#C05A40] transition-colors cursor-pointer bg-transparent border-0',
            'html'    => '<i data-lucide="eye" class="w-4 h-4"></i>',
            'onclick' => "app.selectOrden('{$folio}', {$id})"
        ]
    ];
}

function statusBadge($status) {
    // [color de texto, color de fondo] - modelo pastel de 2 colores.
    $map = [
        'Borrador'   => ['#475569', '#F1F5F9'],
        'Solicitada' => ['#D97706', '#FEF3C7'],
        'Aprobada'   => ['#C05A40', '#FBEAE5'],
        'Parcial'    => ['#EA580C', '#FFEDD5'],
        'Recibida'   => ['#16A34A', '#DCFCE7'],
        'Rechazada'  => ['#DC2626', '#FEE2E2'],
        'Cancelada'  => ['#DC2626', '#FEE2E2']
    ];
    $colores = $map[$status] ?? ['#475569', '#F1F5F9'];
    return badge(strtoupper($status), $colores[0], 100, $colores[1]);
}

// Fecha y hora del pedido en espanol, p.ej. "16 jun 26 10:00 Am".
function fechaHoraSolicitud($dt) {
    if (empty($dt) || $dt === '0000-00-00 00:00:00') return '-';
    $ts = strtotime($dt);
    if ($ts === false) return '-';

    $meses = ['', 'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    $mes   = $meses[(int) date('n', $ts)];
    $ampm  = ucfirst(strtolower(date('A', $ts)));

    return date('d', $ts) . ' ' . $mes . ' ' . date('y', $ts) . ' ' . date('g:i', $ts) . ' ' . $ampm;
}

$obj = new ctrl();
$opc = $_POST['opc'];
if (!method_exists($obj, $opc)) {
    echo json_encode(['status' => 405, 'message' => "opc '{$opc}' no implementado"]);
    exit(0);
}
echo json_encode($obj->{$opc}());
