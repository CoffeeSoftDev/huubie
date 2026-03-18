<?php
session_start();
if (empty($_POST['opc'])) exit(0);

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

require_once '../mdl/mdl-inventario.php';

class Inventario extends MInventario {

    function init() {
        $sub_id = $_SESSION['SUB'];

        return [
            'units'     => $this->lsUnits(),
            'suppliers' => $this->lsSuppliers([$sub_id]),
            'products'  => $this->lsProducts([1, $sub_id]),
            'supplies'  => $this->lsSupplies([$sub_id]),
            'counts'    => $this->getSuppliesCounts([$sub_id]),
            'access'    => $_SESSION['ROLID'],
        ];
    }

    // === INSUMOS ===

    function ls() {
        $sub_id = $_SESSION['SUB'];
        $__row = [];

        $supplies = $this->listSupplies([$sub_id]);

        if (is_array($supplies)) {
            foreach ($supplies as $key) {
                $stockAlert = '';
                if ($key['min_stock'] > 0 && $key['stock'] <= $key['min_stock']) {
                    $stockAlert = ' <i class="icon-attention text-red-400" title="Stock bajo"></i>';
                }

                $__row[] = [
                    'id'         => $key['id'],
                    'Insumo'     => $key['name'],
                    'SKU'        => $key['sku'] ? $key['sku'] : '-',
                    'Stock'      => [
                        'html'  => number_format($key['stock'], 2) . ' ' . $key['unit_abbr'] . $stockAlert,
                        'class' => 'text-center'
                    ],
                    'Min'        => ['html' => number_format($key['min_stock'], 2), 'class' => 'text-center'],
                    'Costo'      => ['html' => evaluar($key['cost']), 'class' => 'text-end'],
                    'Proveedor'  => $key['supplier_name'] ? $key['supplier_name'] : '-',
                    'dropdown'   => dropdownSupply($key['id'])
                ];
            }
        }

        return ['row' => $__row];
    }

    function showSupply() {
        $sub_id = $_SESSION['SUB'];
        return $this->getSuppliesCounts([$sub_id]);
    }

    function addSupply() {
        $status  = 500;
        $message = 'No se pudo agregar el insumo';
        $sub_id  = $_SESSION['SUB'];

        $exists = $this->existsSupplyByName([$_POST['name'], $sub_id]);

        if ($exists === 0 || $exists === false) {
            $_POST['subsidiary_id'] = $sub_id;
            $_POST['created_at'] = date('Y-m-d H:i:s');
            $_POST['stock'] = floatval($_POST['stock']);

            $create = $this->createSupply($this->util->sql($_POST));

            if ($create) {
                $status  = 200;
                $message = 'Insumo agregado correctamente';
            }
        } else {
            $status  = 409;
            $message = 'Ya existe un insumo con ese nombre';
        }

        return ['status' => $status, 'message' => $message];
    }

    function getSupply() {
        $supply = $this->getSupplyById([$_POST['id']]);

        if ($supply) {
            return ['status' => 200, 'data' => $supply];
        }

        return ['status' => 404, 'message' => 'Insumo no encontrado'];
    }

    function editSupply() {
        $status  = 500;
        $message = 'Error al editar el insumo';

        $edit = $this->updateSupply($this->util->sql($_POST, 1));

        if ($edit) {
            $status  = 200;
            $message = 'Insumo editado correctamente';
        }

        return ['status' => $status, 'message' => $message];
    }

    function deleteSupply() {
        $status  = 500;
        $message = 'Error al eliminar';

        $values = $this->util->sql(['id' => $_POST['id']], 1);
        $delete = $this->deleteSupplyById($values);

        if ($delete) {
            $status  = 200;
            $message = 'Insumo eliminado correctamente';
        }

        return ['status' => $status, 'message' => $message];
    }

    // === PROVEEDORES ===

    function lsProveedores() {
        $sub_id = $_SESSION['SUB'];
        $__row = [];

        $suppliers = $this->listSuppliers([$sub_id]);

        if (is_array($suppliers)) {
            foreach ($suppliers as $key) {
                $__row[] = [
                    'id'       => $key['id'],
                    'Nombre'   => $key['name'],
                    'Contacto' => $key['contact_name'] ? $key['contact_name'] : '-',
                    'Telefono' => $key['phone'] ? $key['phone'] : '-',
                    'Email'    => $key['email'] ? $key['email'] : '-',
                    'dropdown' => dropdownSupplier($key['id'])
                ];
            }
        }

        return ['row' => $__row];
    }

    function addSupplier() {
        $status  = 500;
        $message = 'Error al agregar proveedor';

        $_POST['subsidiary_id'] = $_SESSION['SUB'];
        $_POST['created_at'] = date('Y-m-d H:i:s');

        $create = $this->createSupplier($this->util->sql($_POST));

        if ($create) {
            $status  = 200;
            $message = 'Proveedor agregado correctamente';
        }

        return ['status' => $status, 'message' => $message];
    }

    function getProveedorData() {
        $supplier = $this->getSupplierById([$_POST['id']]);

        if ($supplier) {
            return ['status' => 200, 'data' => $supplier];
        }

        return ['status' => 404, 'message' => 'Proveedor no encontrado'];
    }

    function editSupplier() {
        $status  = 500;
        $message = 'Error al editar proveedor';

        $edit = $this->updateSupplier($this->util->sql($_POST, 1));

        if ($edit) {
            $status  = 200;
            $message = 'Proveedor editado correctamente';
        }

        return ['status' => $status, 'message' => $message];
    }

    function deleteSupplier() {
        $status  = 500;
        $message = 'Error al eliminar proveedor';

        $values = $this->util->sql(['id' => $_POST['id']], 1);
        $delete = $this->deleteSupplierById($values);

        if ($delete) {
            $status  = 200;
            $message = 'Proveedor eliminado correctamente';
        }

        return ['status' => $status, 'message' => $message];
    }

    // === RECETAS ===

    function lsRecipes() {
        $product_id = $_POST['product_id'];
        $__row = [];

        $recipes = $this->listRecipesByProduct([$product_id]);

        if (is_array($recipes)) {
            foreach ($recipes as $key) {
                $__row[] = [
                    'id'        => $key['id'],
                    'Insumo'    => $key['supply_name'],
                    'Cantidad'  => ['html' => number_format($key['quantity'], 2) . ' ' . $key['unit_abbr'], 'class' => 'text-center'],
                    'dropdown'  => dropdownRecipe($key['id'], $product_id)
                ];
            }
        }

        return ['row' => $__row];
    }

    function addRecipe() {
        $status  = 500;
        $message = 'Error al agregar ingrediente';

        $create = $this->createRecipe($this->util->sql($_POST));

        if ($create) {
            $status  = 200;
            $message = 'Ingrediente agregado correctamente';
        }

        return ['status' => $status, 'message' => $message];
    }

    function deleteRecipe() {
        $status  = 500;
        $message = 'Error al eliminar ingrediente';

        $values = $this->util->sql(['id' => $_POST['id']], 1);
        $delete = $this->deleteRecipeById($values);

        if ($delete) {
            $status  = 200;
            $message = 'Ingrediente eliminado correctamente';
        }

        return ['status' => $status, 'message' => $message];
    }

    // === MERMAS Y AJUSTES ===

    function lsAdjustments() {
        $fi = $_POST['fi'];
        $ff = $_POST['ff'];
        $sub_id = $_SESSION['SUB'];
        $__row = [];

        $adjustments = $this->listAdjustments([$sub_id, $fi, $ff]);

        if (is_array($adjustments)) {
            foreach ($adjustments as $key) {
                $__row[] = [
                    'id'       => $key['id'],
                    'Insumo'   => $key['supply_name'],
                    'Tipo'     => adjustmentType($key['type']),
                    'Cantidad' => ['html' => number_format($key['quantity'], 2) . ' ' . $key['unit_abbr'], 'class' => 'text-center'],
                    'Motivo'   => $key['reason'],
                    'Empleado' => $key['employee_name'],
                    'Fecha'    => formatSpanishDate($key['created_at']),
                ];
            }
        }

        return ['row' => $__row];
    }

    function addAdjustment() {
        $status  = 500;
        $message = 'Error al registrar ajuste';
        $sub_id  = $_SESSION['SUB'];

        $supply = $this->getSupplyById([$_POST['supply_id']]);

        if (!$supply) {
            return ['status' => 404, 'message' => 'Insumo no encontrado'];
        }

        $previousStock = floatval($supply['stock']);
        $quantity      = floatval($_POST['quantity']);
        $type          = $_POST['type'];

        $newStock = $previousStock;
        $kardexType = 'ajuste';

        if ($type === 'merma' || $type === 'caducidad' || $type === 'danado' || $type === 'ajuste_negativo') {
            $newStock = $previousStock - $quantity;
            $kardexType = ($type === 'merma' || $type === 'caducidad' || $type === 'danado') ? 'merma' : 'ajuste';
        } else {
            $newStock = $previousStock + $quantity;
            $kardexType = 'ajuste';
        }

        if ($newStock < 0) $newStock = 0;

        $_POST['employee_id']   = $_SESSION['ID'];
        $_POST['subsidiary_id'] = $sub_id;
        $_POST['created_at']    = date('Y-m-d H:i:s');

        $create = $this->createAdjustment($this->util->sql($_POST));

        if ($create) {
            $this->updateSupplyStock([$newStock, $_POST['supply_id']]);

            $kardexData = $this->util->sql([
                'supply_id'      => $_POST['supply_id'],
                'type'           => $kardexType,
                'quantity'       => $quantity,
                'previous_stock' => $previousStock,
                'new_stock'      => $newStock,
                'cost'           => 0,
                'reference_type' => 'adjustment',
                'reason'         => $_POST['reason'],
                'employee_id'    => $_SESSION['ID'],
                'subsidiary_id'  => $sub_id,
                'created_at'     => date('Y-m-d H:i:s'),
            ]);

            $this->createKardex($kardexData);

            $status  = 200;
            $message = 'Ajuste registrado correctamente';
        }

        return ['status' => $status, 'message' => $message];
    }

    // === KARDEX ===

    function lsKardex() {
        $fi = $_POST['fi'];
        $ff = $_POST['ff'];
        $sub_id = $_SESSION['SUB'];
        $__row = [];

        $kardex = $this->listKardex([$sub_id, $fi, $ff]);

        if (is_array($kardex)) {
            foreach ($kardex as $key) {
                $__row[] = [
                    'id'        => $key['id'],
                    'Insumo'    => $key['supply_name'],
                    'Tipo'      => kardexType($key['type']),
                    'Cantidad'  => ['html' => number_format($key['quantity'], 2) . ' ' . $key['unit_abbr'], 'class' => 'text-center'],
                    'Anterior'  => ['html' => number_format($key['previous_stock'], 2), 'class' => 'text-center'],
                    'Nuevo'     => ['html' => number_format($key['new_stock'], 2), 'class' => 'text-center'],
                    'Motivo'    => $key['reason'] ? $key['reason'] : '-',
                    'Empleado'  => $key['employee_name'],
                    'Fecha'     => formatSpanishDate($key['created_at']),
                ];
            }
        }

        return ['row' => $__row];
    }

    function lsKardexBySupply() {
        $supply_id = $_POST['supply_id'];
        $__row = [];

        $kardex = $this->listKardexBySupply([$supply_id]);

        if (is_array($kardex)) {
            foreach ($kardex as $key) {
                $__row[] = [
                    'id'        => $key['id'],
                    'Tipo'      => kardexType($key['type']),
                    'Cantidad'  => ['html' => number_format($key['quantity'], 2), 'class' => 'text-center'],
                    'Anterior'  => ['html' => number_format($key['previous_stock'], 2), 'class' => 'text-center'],
                    'Nuevo'     => ['html' => number_format($key['new_stock'], 2), 'class' => 'text-center'],
                    'Motivo'    => $key['reason'] ? $key['reason'] : '-',
                    'Empleado'  => $key['employee_name'],
                    'Fecha'     => formatSpanishDate($key['created_at']),
                ];
            }
        }

        return ['row' => $__row];
    }

    // === ORDENES DE COMPRA ===

    function lsPurchaseOrders() {
        $fi = $_POST['fi'];
        $ff = $_POST['ff'];
        $sub_id = $_SESSION['SUB'];
        $__row = [];

        $orders = $this->listPurchaseOrders([$sub_id, $fi, $ff]);

        if (is_array($orders)) {
            foreach ($orders as $key) {
                $__row[] = [
                    'id'        => $key['id'],
                    'Folio'     => $key['folio'],
                    'Proveedor' => $key['supplier_name'],
                    'Total'     => ['html' => evaluar($key['total']), 'class' => 'text-end'],
                    'Estado'    => purchaseStatus($key['status']),
                    'Fecha'     => formatSpanishDate($key['created_at']),
                    'dropdown'  => dropdownPurchase($key['id'], $key['status'])
                ];
            }
        }

        return ['row' => $__row];
    }

    function addPurchaseOrder() {
        $status  = 500;
        $message = 'Error al crear orden de compra';
        $sub_id  = $_SESSION['SUB'];

        $today = date('Y-m-d');
        $count = $this->getPurchaseOrderCountByDate([$today, $sub_id]);
        $folio = 'OC-' . date('Ymd') . '-' . str_pad(intval($count['count']) + 1, 3, '0', STR_PAD_LEFT);

        $_POST['folio']         = $folio;
        $_POST['employee_id']   = $_SESSION['ID'];
        $_POST['subsidiary_id'] = $sub_id;
        $_POST['created_at']    = date('Y-m-d H:i:s');
        $_POST['status']        = 'borrador';

        $create = $this->createPurchaseOrder($this->util->sql($_POST));

        if ($create) {
            $maxId = $this->getMaxPurchaseOrderId();
            $status  = 200;
            $message = 'Orden de compra creada correctamente';
            return ['status' => $status, 'message' => $message, 'id' => $maxId['id'], 'folio' => $folio];
        }

        return ['status' => $status, 'message' => $message];
    }

    function getPurchaseOrder() {
        $order = $this->getPurchaseOrderById([$_POST['id']]);
        $items = $this->listPurchaseOrderItems([$_POST['id']]);

        if ($order) {
            return ['status' => 200, 'data' => $order, 'items' => $items];
        }

        return ['status' => 404, 'message' => 'Orden no encontrada'];
    }

    function editPurchaseOrder() {
        $status  = 500;
        $message = 'Error al editar orden de compra';

        $edit = $this->updatePurchaseOrder($this->util->sql($_POST, 1));

        if ($edit) {
            $status  = 200;
            $message = 'Orden de compra actualizada';
        }

        return ['status' => $status, 'message' => $message];
    }

    function statusPurchaseOrder() {
        $status  = 500;
        $message = 'Error al actualizar estado';
        $sub_id  = $_SESSION['SUB'];

        $newStatus = $_POST['status'];
        $poId      = $_POST['id'];

        $edit = $this->updatePurchaseOrder($this->util->sql($_POST, 1));

        if ($edit && $newStatus === 'recibida') {
            $items = $this->listPurchaseOrderItems([$poId]);

            if (is_array($items)) {
                foreach ($items as $item) {
                    $supply = $this->getSupplyById([$item['supply_id']]);

                    if ($supply) {
                        $previousStock = floatval($supply['stock']);
                        $received = floatval($item['quantity_ordered']);
                        $newStock = $previousStock + $received;

                        $this->updateSupplyStock([$newStock, $item['supply_id']]);

                        $kardexData = $this->util->sql([
                            'supply_id'      => $item['supply_id'],
                            'type'           => 'compra',
                            'quantity'       => $received,
                            'previous_stock' => $previousStock,
                            'new_stock'      => $newStock,
                            'cost'           => $item['unit_cost'],
                            'reference_id'   => $poId,
                            'reference_type' => 'purchase_order',
                            'reason'         => 'Recepcion de OC #' . $poId,
                            'employee_id'    => $_SESSION['ID'],
                            'subsidiary_id'  => $sub_id,
                            'created_at'     => date('Y-m-d H:i:s'),
                        ]);

                        $this->createKardex($kardexData);
                    }
                }
            }

            $status  = 200;
            $message = 'Mercancia recibida y stock actualizado';
        } else if ($edit) {
            $status  = 200;
            $message = 'Estado actualizado correctamente';
        }

        return ['status' => $status, 'message' => $message];
    }

    function addPurchaseItem() {
        $status  = 500;
        $message = 'Error al agregar item';

        $_POST['total'] = floatval($_POST['quantity_ordered']) * floatval($_POST['unit_cost']);

        $create = $this->createPurchaseOrderItem($this->util->sql($_POST));

        if ($create) {
            $this->updatePurchaseOrderTotals([$_POST['purchase_order_id']]);
            $status  = 200;
            $message = 'Item agregado correctamente';
        }

        return ['status' => $status, 'message' => $message];
    }

    function deletePurchaseItem() {
        $status  = 500;
        $message = 'Error al eliminar item';

        $poId = $_POST['purchase_order_id'];
        $values = $this->util->sql(['id' => $_POST['id']], 1);
        $delete = $this->deletePurchaseOrderItemById($values);

        if ($delete) {
            $this->updatePurchaseOrderTotals([$poId]);
            $status  = 200;
            $message = 'Item eliminado correctamente';
        }

        return ['status' => $status, 'message' => $message];
    }

    // === DESCUENTO AUTOMATICO DE STOCK POR VENTA ===

    function deductStockBySale() {
        $status  = 500;
        $message = 'Error al descontar stock';
        $sub_id  = $_SESSION['SUB'];

        $items = json_decode($_POST['items'], true);

        foreach ($items as $item) {
            $recipes = $this->listRecipesByProduct([$item['id']]);

            if (is_array($recipes)) {
                foreach ($recipes as $recipe) {
                    $supply = $this->getSupplyById([$recipe['supply_id']]);

                    if ($supply) {
                        $previousStock = floatval($supply['stock']);
                        $deduction = floatval($recipe['quantity']) * intval($item['qty']);
                        $newStock = $previousStock - $deduction;
                        if ($newStock < 0) $newStock = 0;

                        $this->updateSupplyStock([$newStock, $recipe['supply_id']]);

                        $kardexData = $this->util->sql([
                            'supply_id'      => $recipe['supply_id'],
                            'type'           => 'venta',
                            'quantity'       => $deduction,
                            'previous_stock' => $previousStock,
                            'new_stock'      => $newStock,
                            'cost'           => 0,
                            'reference_id'   => $_POST['order_id'],
                            'reference_type' => 'order',
                            'reason'         => 'Venta #' . $_POST['order_id'],
                            'employee_id'    => $_SESSION['ID'],
                            'subsidiary_id'  => $sub_id,
                            'created_at'     => date('Y-m-d H:i:s'),
                        ]);

                        $this->createKardex($kardexData);
                    }
                }
            }
        }

        $status  = 200;
        $message = 'Stock descontado correctamente';

        return ['status' => $status, 'message' => $message];
    }
}

function dropdownSupply($id) {
    return [
        ['icon' => 'icon-pencil', 'text' => 'Editar', 'onclick' => "inv.editSupply($id)"],
        ['icon' => 'icon-list', 'text' => 'Kardex', 'onclick' => "inv.showKardexBySupply($id)"],
        ['icon' => 'icon-trash', 'text' => 'Eliminar', 'onclick' => "inv.deleteSupply($id)"],
    ];
}

function dropdownSupplier($id) {
    return [
        ['icon' => 'icon-pencil', 'text' => 'Editar', 'onclick' => "inv.editSupplier($id)"],
        ['icon' => 'icon-trash', 'text' => 'Eliminar', 'onclick' => "inv.deleteSupplier($id)"],
    ];
}

function dropdownRecipe($id, $productId) {
    return [
        ['icon' => 'icon-trash', 'text' => 'Eliminar', 'onclick' => "inv.deleteRecipe($id, $productId)"],
    ];
}

function dropdownPurchase($id, $status) {
    $options = [
        ['icon' => 'icon-eye', 'text' => 'Ver detalle', 'onclick' => "inv.showPurchaseOrder($id)"],
    ];

    if ($status === 'borrador') {
        $options[] = ['icon' => 'icon-paper-plane', 'text' => 'Enviar', 'onclick' => "inv.statusPurchaseOrder($id, 'enviada')"];
    }

    if ($status === 'enviada') {
        $options[] = ['icon' => 'icon-ok', 'text' => 'Recibir mercancia', 'onclick' => "inv.statusPurchaseOrder($id, 'recibida')"];
    }

    if ($status !== 'recibida' && $status !== 'cancelada') {
        $options[] = ['icon' => 'icon-cancel', 'text' => 'Cancelar', 'onclick' => "inv.statusPurchaseOrder($id, 'cancelada')"];
    }

    return $options;
}

function adjustmentType($type) {
    $types = [
        'merma'            => '<span class="px-2 py-1 rounded-md text-sm font-semibold bg-[#721c24] text-[#ba464d]">Merma</span>',
        'ajuste_positivo'  => '<span class="px-2 py-1 rounded-md text-sm font-semibold bg-[#014737] text-[#3FC189]">Ajuste +</span>',
        'ajuste_negativo'  => '<span class="px-2 py-1 rounded-md text-sm font-semibold bg-[#8a4600] text-[#f0ad28]">Ajuste -</span>',
        'caducidad'        => '<span class="px-2 py-1 rounded-md text-sm font-semibold bg-[#5b2c6f] text-[#c39bd3]">Caducidad</span>',
        'danado'           => '<span class="px-2 py-1 rounded-md text-sm font-semibold bg-[#721c24] text-[#ba464d]">Danado</span>',
    ];
    return $types[$type] ?? '<span class="badge bg-secondary">Desconocido</span>';
}

function kardexType($type) {
    $types = [
        'entrada'  => '<span class="px-2 py-1 rounded-md text-sm font-semibold bg-[#014737] text-[#3FC189]">Entrada</span>',
        'salida'   => '<span class="px-2 py-1 rounded-md text-sm font-semibold bg-[#721c24] text-[#ba464d]">Salida</span>',
        'ajuste'   => '<span class="px-2 py-1 rounded-md text-sm font-semibold bg-[#8a4600] text-[#f0ad28]">Ajuste</span>',
        'merma'    => '<span class="px-2 py-1 rounded-md text-sm font-semibold bg-[#721c24] text-[#ba464d]">Merma</span>',
        'venta'    => '<span class="px-2 py-1 rounded-md text-sm font-semibold bg-[#1e3a5f] text-[#60a5fa]">Venta</span>',
        'compra'   => '<span class="px-2 py-1 rounded-md text-sm font-semibold bg-[#014737] text-[#3FC189]">Compra</span>',
    ];
    return $types[$type] ?? '<span class="badge bg-secondary">Desconocido</span>';
}

function purchaseStatus($status) {
    $statuses = [
        'borrador'  => '<span class="px-2 py-1 rounded-md text-sm font-semibold bg-gray-600 text-gray-300">Borrador</span>',
        'enviada'   => '<span class="px-2 py-1 rounded-md text-sm font-semibold bg-[#1e3a5f] text-[#60a5fa]">Enviada</span>',
        'recibida'  => '<span class="px-2 py-1 rounded-md text-sm font-semibold bg-[#014737] text-[#3FC189]">Recibida</span>',
        'parcial'   => '<span class="px-2 py-1 rounded-md text-sm font-semibold bg-[#8a4600] text-[#f0ad28]">Parcial</span>',
        'cancelada' => '<span class="px-2 py-1 rounded-md text-sm font-semibold bg-[#721c24] text-[#ba464d]">Cancelada</span>',
    ];
    return $statuses[$status] ?? '<span class="badge bg-secondary">Desconocido</span>';
}

$fn = $_POST['opc'];
$obj = new Inventario();
echo json_encode($obj->$fn());
