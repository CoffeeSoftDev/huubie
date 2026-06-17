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
                // Mismo formato que la columna "Destino" de traspasos: chip con la
                // sucursal a la que se solicita (titulo) y el almacen como subtitulo.
                $fila['Solicitar a'] = $this->sucChipCell($r['branch_id'], $r['branch_name'], $r['warehouse_name']);
            }

            $fila['Proveedor']  = $r['supplier_name'] ?: '<span class="italic text-gray-400">N/A</span>';
            if (!$withTarget) {
                // En la gestion el almacen va en columna propia; en la vista
                // solicitante ya queda embebido dentro del chip "Solicitar a".
                $fila['Almacen'] = $r['warehouse_name'] ?: '-';
            }
            $fila['Materiales'] = (int) $r['total_products'];
            // $fila['Total']      = evaluar((float) $r['total_cost']);
            $fila['a']          = $a;

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

    // Estrategia edit: soft-delete de renglones anteriores + reinsercion.
    // Garantiza quantity_received = 0 en renglones nuevos (OC no aprobada).
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

        // Si el payload incluye campos de cabecera opcionales, se actualizan.
        if (!empty($payload['supplier_id']) || isset($payload['warehouse_id']) || isset($payload['note']) || isset($payload['destination_branch_id']) || !empty($payload['branch_id']) || !empty($payload['date_order'])) {
            $fields = [];
            $vals   = [];
            // branch_id ("Solicitar a") y date_order solo se tocan si traen valor real (NOT NULL en BD).
            if (!empty($payload['branch_id']))            { $fields[] = 'branch_id = ?';            $vals[] = (int) $payload['branch_id']; }
            if (!empty($payload['date_order']))           { $fields[] = 'date_order = ?';           $vals[] = $payload['date_order']; }
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

        $originId = 1; // inflow_origin COMPRA

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

            $this->updateDetailReceived([$qtyNow, (int) $r['id']]);
        }

        $detailUpdated = $this->qGetOrdenDetail([$id]);
        $allReceived   = true;
        $anyReceived   = false;
        foreach ($detailUpdated as $d) {
            if ((float) $d['quantity_received'] > 0) $anyReceived = true;
            if ((float) $d['quantity_received'] < (float) $d['quantity_ordered']) $allReceived = false;
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

    // Las entradas generadas en recepciones parciales previas NO se revierten al cancelar;
    // solo se bloquea seguir recibiendo contra esta OC.
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

    // Solo la sucursal destino puede aprobar/rechazar solicitudes inter-sucursal.
    // Si la orden no tiene destino definido o es mono-sucursal, no se restringe.
    private function puedeGestionarDestino($header) {
        $dest = (int) ($header['destination_branch_id'] ?? 0);
        $orig = (int) ($header['branch_id'] ?? 0);
        $interSucursal = $dest > 0 && $dest !== $orig;
        if (!$interSucursal || $this->branchId <= 0) return true;
        return $this->branchId === $dest;
    }

    private function statusBadge($status) {
        $map = [
            'Borrador'   => ['#475569', '#F1F5F9'],
            'Solicitada' => ['#D97706', '#FEF3C7'],
            'Aprobada'   => ['#C05A40', '#FBEAE5'],
            'Parcial'    => ['#EA580C', '#FFEDD5'],
            'Recibida'   => ['#16A34A', '#DCFCE7'],
            'Rechazada'  => ['#DC2626', '#FEE2E2'],
            'Cancelada'  => ['#DC2626', '#FEE2E2']
        ];
        $c = $map[$status] ?? ['#475569', '#F1F5F9'];
        // "Solicitada" espera accion (aprobar/rechazar): se marca con un puntito que pulsa.
        if ($status === 'Solicitada') {
            return '<span class="inline-flex items-center gap-1.5 text-[10px] font-semibold px-3 py-1 rounded" style="background:' . $c[1] . ';color:' . $c[0] . ';">'
                 . '<span class="cs-pulse-dot" style="background:' . $c[0] . ';"></span>SOLICITADA</span>';
        }
        return badge(strtoupper($status), $c[0], 100, $c[1]);
    }

    // Formato "16 jun 26 10:00 Am" — sin strftime, mes en espanol, AM/PM capitalizado.
    private function fechaHoraSolicitud($dt) {
        if (empty($dt) || $dt === '0000-00-00 00:00:00') return '-';
        $ts = strtotime($dt);
        if ($ts === false) return '-';

        $meses = ['', 'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
        $mes   = $meses[(int) date('n', $ts)];
        $ampm  = ucfirst(strtolower(date('A', $ts)));

        return date('d', $ts) . ' ' . $mes . ' ' . date('y', $ts) . ' ' . date('g:i', $ts) . ' ' . $ampm;
    }

    private function sucChipCell($branchId, $branchName, $whName) {
        $palette = [
            ['icon' => 'text-blue-400',   'bg' => 'rgba(59,130,246,0.15)',  'border' => 'rgba(59,130,246,0.35)'],
            ['icon' => 'text-green-400',  'bg' => 'rgba(63,193,137,0.15)',  'border' => 'rgba(63,193,137,0.35)'],
            ['icon' => 'text-purple-400', 'bg' => 'rgba(168,85,247,0.15)',  'border' => 'rgba(168,85,247,0.35)'],
            ['icon' => 'text-pink-400',   'bg' => 'rgba(244,114,182,0.15)', 'border' => 'rgba(244,114,182,0.35)'],
            ['icon' => 'text-orange-400', 'bg' => 'rgba(251,146,60,0.15)',  'border' => 'rgba(251,146,60,0.35)'],
            ['icon' => 'text-cyan-400',   'bg' => 'rgba(34,211,238,0.15)',  'border' => 'rgba(34,211,238,0.35)']
        ];
        $name = $branchName ?: '-';
        $idx  = $branchId ? ((int) $branchId % count($palette)) : 0;
        $p    = $palette[$idx];
        $wh   = $whName
            ? "<div class='text-[10px] text-gray-500 truncate'>{$whName}</div>"
            : "";
        return "<div class='flex items-center gap-2 w-full text-left'>"
             . "<div class='w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0' style='background:{$p['bg']};border:1px solid {$p['border']};'>"
             . "<i data-lucide='store' class='w-4 h-4 {$p['icon']}'></i></div>"
             . "<div class='min-w-0'><div class='font-semibold text-gray-800 truncate leading-tight'>{$name}</div>{$wh}</div>"
             . "</div>";
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

    // Surtido inter-sucursal: reabasto opcional (ENT-) + salida (SI-, motivo SURTIDO_SUC).
    // Clampeado al pendiente y al stock real. Todo en una transaccion atomica.
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

        $items = json_decode($_POST['items'] ?? '{}', true);
        if (!is_array($items)) $items = [];

        $detalle = $this->qGetOrdenDetail([$id]);
        if (empty($detalle)) return ['status' => 400, 'message' => 'La solicitud no tiene renglones'];

        $reasonId = $this->getShrinkageReasonId(['SURTIDO_SUC']);
        if (!$reasonId) return ['status' => 500, 'message' => 'Falta configurar el motivo de salida (SURTIDO_SUC)'];

        $byId = [];
        foreach ($detalle as $renglon) $byId[(string) $renglon['id']] = $renglon;

        try {
            return $this->transaction(function () use ($id, $header, $warehouseId, $items, $byId, $reasonId) {
                if (empty($header['warehouse_id'])) $this->updateOrdenWarehouse([$warehouseId, $id]);

                $note = trim($_POST['note']) ?: ('Surtido de solicitud ' . $header['folio']);

                // Se surte el pendiente completo aunque el stock no alcance: el almacen
                // queda en deficit (negativo) y el faltante (qtyNow - disponible) genera una
                // OC de reabasto pendiente que el encargado debera comprar/registrar.
                $stockCache = [];
                $toSupply   = [];
                $faltantes  = [];
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
                    $qtyNow = min((float) $qty, $pending); // ya NO se topa al disponible
                    if ($qtyNow <= 0) continue;

                    $prev = $avail;
                    $post = $avail - $qtyNow;              // puede quedar negativo (deficit)
                    $stockCache[$pid]['qty'] = $post;

                    $faltante = $qtyNow - $avail;          // lo que no se tenia -> a comprar
                    if ($faltante > 0) $faltantes[] = ['detail' => $d, 'qty' => $faltante];

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
                    throw new Exception('No se indicaron cantidades a surtir');
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
                    // Si el producto no tenia fila de stock en el almacen, se crea con el
                    // valor resultante (que puede ser negativo: refleja el deficit a cubrir).
                    if ($r['stock_id'] > 0) $this->updateStockQuantity([$r['post'], $r['stock_id']]);
                    else                    $this->insertStockRow([$r['post'], $warehouseId, $r['product_id'], $this->companiesId]);
                    $this->updateDetailReceived([$r['qty'], $r['detail_row_id']]);
                }

                // El faltante genera una OC de reabasto pendiente (la compra a registrar).
                $reabFolio = $this->createReabastoOrden($header, $warehouseId, $faltantes);

                $detailUpdated = $this->qGetOrdenDetail([$id]);
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
                if ($reabFolio) $msg .= " Se generó la orden de reabasto {$reabFolio} (pendiente de compra).";
                $msg .= " Solicitud ahora {$newStatus}.";

                return [
                    'status'         => 200,
                    'message'        => $msg,
                    'salida_folio'   => $siFolio,
                    'reabasto_folio' => $reabFolio,
                    'orden_status'   => $newStatus
                ];
            });
        } catch (\Throwable $e) {
            return ['status' => 500, 'message' => 'No se pudo surtir: ' . $e->getMessage()];
        }
    }

    // Genera una OC de reabasto pendiente (REAB-, Aprobada, sin proveedor) por el faltante
    // que el stock no alcanzo a cubrir al surtir. El encargado la recibe cuando registra la
    // compra real, y esa entrada repone el almacen y cuadra el deficit. Devuelve el folio
    // REAB- o null si no hubo faltante.
    private function createReabastoOrden($header, $warehouseId, $faltantes) {
        if (empty($faltantes)) return null;

        $folio    = $this->nextFolio('REAB-', 'purchase_order', $this->companiesId);
        $totProds = count($faltantes);
        $totUnits = 0;
        $totCost  = 0.0;
        $totBase  = 0.0;
        foreach ($faltantes as $f) {
            $cost = $f['detail']['cost'] !== null ? (float) $f['detail']['cost'] : 0.0;
            $base = $f['detail']['price_without_tax'] !== null ? (float) $f['detail']['price_without_tax'] : 0.0;
            $totUnits += $f['qty'];
            $totCost  += $f['qty'] * $cost;
            $totBase  += $f['qty'] * $base;
        }

        $this->insertOrden([
            $folio,
            null,                       // proveedor: lo asigna el encargado al comprar
            (int) $header['branch_id'], // sucursal que repone su almacen
            null,                       // destination_branch_id
            $warehouseId,               // almacen a reponer
            date('Y-m-d'),
            null,                       // expected_date
            'Reabasto por surtido de la solicitud ' . $header['folio'],
            $totProds,
            $totUnits,
            $totCost,
            $totBase,
            'Aprobada',                 // lista para recibir (registrar la compra)
            $this->userId,
            $this->companiesId
        ]);

        $row    = $this->_Read(
            "SELECT id FROM {$this->bd}purchase_order WHERE folio = ? AND companies_id = ? LIMIT 1",
            [$folio, $this->companiesId]
        );
        $reabId = (int) ($row[0]['id'] ?? 0);
        if ($reabId <= 0) throw new Exception('No se pudo generar la orden de reabasto');

        foreach ($faltantes as $f) {
            $d        = $f['detail'];
            $cost     = $d['cost'] !== null ? (float) $d['cost'] : null;
            $base     = $d['price_without_tax'] !== null ? (float) $d['price_without_tax'] : null;
            $tax      = $d['tax'] !== null ? (float) $d['tax'] : 0;
            $subtotal = $cost !== null ? $f['qty'] * $cost : 0.0;
            $this->insertOrdenDetail([
                $reabId,
                (int) $d['product_id'],
                !empty($d['unit_id']) ? (int) $d['unit_id'] : null,
                $f['qty'],
                $base,
                $tax,
                $cost,
                $subtotal
            ]);
        }

        return $folio;
    }

}

$obj = new ctrl();
$opc = $_POST['opc'];
if (!method_exists($obj, $opc)) {
    echo json_encode(['status' => 405, 'message' => "opc '{$opc}' no implementado"]);
    exit(0);
}
echo json_encode($obj->{$opc}());
