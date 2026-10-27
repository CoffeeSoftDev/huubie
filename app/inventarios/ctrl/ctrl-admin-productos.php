<?php
session_start();
if (empty($_POST['opc'])) exit(0);

require_once '../mdl/mdl-admin-productos.php';
// require_once '../../conf/coffeSoft.php';

class ctrl extends mdl {

    public $companiesId;
    public $subsidiariesId;
    public $userId;

    public function __construct() {
        parent::__construct();
        $this->companiesId    = (int) ($_SESSION['COM'] ?? $_SESSION['COMPANY_ID'] ?? $_POST['companies_id']    ?? 4);
        $this->subsidiariesId = (int) ($_SESSION['SUB'] ?? $_POST['subsidiaries_id'] ?? 0);
        $this->userId         = (int) ($_SESSION['USR'] ?? $_SESSION['ID']           ?? $_POST['user_id']         ?? 1);
    }

    function init() {
        return [
            'status'          => 200,
            'companies_id'    => $this->companiesId,
            'subsidiaries_id' => $this->subsidiariesId,
            'categorias'      => $this->lsCategoriesSelect(),
            'areas'           => $this->lsAreasSelect([$this->companiesId]),
            'unidades'        => $this->lsUnitsSelect(),
            'proveedores'     => $this->lsSuppliersSelect([$this->companiesId]),
            'sucursales'      => $this->lsSubsidiariesSelect([$this->companiesId])
        ];
    }

    // Productos

    function lsProducts() {
        $rows = $this->listProducts([
            'companies_id'      => $this->companiesId,
            'active'            => $_POST['active'],
            'category_id'       => $_POST['category_id'],
            'warehouse_area_id' => $_POST['warehouse_area_id'],
            'unit_id'           => $_POST['unit_id']
        ]);

        $__row = [];
        foreach ($rows as $item) {
            $__row[] = [
                'id'        => $item['id'],
                'SKU'       => skuPill($item['sku']),
                'Producto'  => [
                    'class' => 'justify-start px-2 py-2',
                    'html'  => productImageCell($item['image'], $item['name'], $item['id'])
                ],
                'Categoria' => $item['category_name'] ?: '-',
                'Area'      => colorSwatch($item['area_color'], $item['area_name']),
                'Unidad'    => $item['unit_code'] ?: '-',
                'Costo'     => [
                    'html'  => evaluar((float) $item['cost_unit']),
                    'class' => 'text-end'
                ],
                'Min'       => [
                    'html'  => (float) $item['stock_min'],
                    'class' => 'text-center'
                ],
                'Max'       => [
                    'html'  => (float) $item['stock_max'],
                    'class' => 'text-center'
                ],
                'a'         => actionButtons('productos', $item['id'], $item['active'])
            ];
        }
        return ['row' => $__row, 'thead' => ''];
    }

    function getProduct() {
        $status  = 404;
        $message = 'Producto no encontrado';
        $data    = $this->getProductById([(int) $_POST['id']]);

        if ($data) {
            $status  = 200;
            $message = 'Producto encontrado';
        }
        return ['status' => $status, 'message' => $message, 'data' => $data];
    }

    function addProduct() {
        $status  = 500;
        $message = 'No se pudo agregar el producto';

        // Se guarda el nombre tal como se escribio (solo se recortan espacios laterales).
        $_POST['name'] = trim($_POST['name'] ?? '');

        $exists = $this->existsProductByName([$_POST['name'], $this->companiesId]);
        if ($exists) {
            return ['status' => 409, 'message' => 'Ya existe un producto con ese nombre'];
        }

        $subsidiary = $this->subsidiariesId ? $this->subsidiariesId : null;

        $create = $this->createProductMaster([
            $_POST['name'],
            (float) $_POST['price'],
            (int) $_POST['category_id'],
            $_POST['description'],
            $subsidiary,
            $this->companiesId
        ]);

        if ($create) {
            $productId = $this->getLastProductId([$this->companiesId, $_POST['name']]);

            if ($productId > 0) {
                $sku = $this->resolveSku($_POST['sku'] ?? '', $productId);

                if ($this->skuExists([$sku, $this->companiesId, $productId])) {
                    return ['status' => 409, 'message' => "El SKU '{$sku}' ya esta en uso por otro producto"];
                }

                $attr = $this->createProductAttribute([
                    $sku,
                    $_POST['attribute_description'],
                    $_POST['shelf_life_days'] !== '' ? (int) $_POST['shelf_life_days'] : null,
                    (float) $_POST['cost_unit'],
                    (float) $_POST['stock_min'],
                    (float) $_POST['stock_max'],
                    $_POST['warehouse_area_id'] !== '' ? (int) $_POST['warehouse_area_id'] : null,
                    $_POST['unit_id'] !== '' ? (int) $_POST['unit_id'] : null,
                    $productId,
                    $this->companiesId
                ]);

                if ($attr !== true) {
                    return ['status' => 500, 'message' => 'Producto creado, pero no se pudieron guardar los atributos'];
                }
            }

            $status  = 200;
            $message = 'Producto agregado correctamente';
        }
        return ['status' => $status, 'message' => $message];
    }

    private function resolveSku($raw, $productId) {
        $sku = trim((string) $raw);
        return $sku !== '' ? $sku : 'SKU-' . $productId;
    }

    function editProduct() {
        $id      = (int) $_POST['id'];
        $status  = 500;
        $message = 'No se pudo editar el producto';

        // Se guarda el nombre tal como se escribio (solo se recortan espacios laterales).
        $_POST['name'] = trim($_POST['name'] ?? '');

        $values = $this->util->sql([
            'name'        => $_POST['name'],
            'price'       => (float) $_POST['price'],
            'category_id' => (int) $_POST['category_id'],
            'description' => $_POST['description'],
            'id'          => $id
        ], 1);

        $edit = $this->updateProductMaster($values);

        $sku = $this->resolveSku($_POST['sku'] ?? '', $id);

        if ($this->skuExists([$sku, $this->companiesId, $id])) {
            return ['status' => 409, 'message' => "El SKU '{$sku}' ya esta en uso por otro producto"];
        }

        $shelfLife = $_POST['shelf_life_days'] !== '' ? (int) $_POST['shelf_life_days'] : null;
        $areaId    = $_POST['warehouse_area_id'] !== '' ? (int) $_POST['warehouse_area_id'] : null;
        $unitId    = $_POST['unit_id'] !== '' ? (int) $_POST['unit_id'] : null;

        $hasAttribute = $this->getAttributeByProduct([$id]);
        if ($hasAttribute) {
            $attr = $this->updateProductAttribute([
                $sku,
                $_POST['attribute_description'],
                $shelfLife,
                (float) $_POST['cost_unit'],
                (float) $_POST['stock_min'],
                (float) $_POST['stock_max'],
                $areaId,
                $unitId,
                $id
            ]);
        } else {
            $attr = $this->createProductAttribute([
                $sku,
                $_POST['attribute_description'],
                $shelfLife,
                (float) $_POST['cost_unit'],
                (float) $_POST['stock_min'],
                (float) $_POST['stock_max'],
                $areaId,
                $unitId,
                $id,
                $this->companiesId
            ]);
        }

        if ($edit === true && $attr === true) {
            $status  = 200;
            $message = 'Producto actualizado correctamente';
        }
        return ['status' => $status, 'message' => $message];
    }

    function statusProduct() {
        $status  = 500;
        $message = 'No se pudo cambiar el estado';
        $update  = $this->updateProductStatus([(int) $_POST['active'], (int) $_POST['id']]);

        if ($update) {
            $status  = 200;
            $message = 'Estado actualizado correctamente';
        }
        return ['status' => $status, 'message' => $message];
    }

    // Categorias

    function lsCategories() {
        $rows = $this->listCategories(['active' => $_POST['active']]);

        $__row = [];
        foreach ($rows as $item) {
            $__row[] = [
                'id'        => $item['id'],
                'Categoria' => $item['classification'],
                'Productos' => [
                    'html'  => (int) $item['product_count'],
                    'class' => 'text-center'
                ],
                'a'         => actionButtons('categorias', $item['id'], $item['active'])
            ];
        }
        return ['row' => $__row, 'thead' => ''];
    }

    function getCategory() {
        $data = $this->getCategoryById([(int) $_POST['id']]);
        return [
            'status'  => $data ? 200 : 404,
            'message' => $data ? 'Categoria encontrada' : 'Categoria no encontrada',
            'data'    => $data
        ];
    }

    function addCategory() {
        $create = $this->createCategory([$_POST['classification'], $_POST['description']]);
        return [
            'status'  => $create ? 200 : 500,
            'message' => $create ? 'Categoria agregada correctamente' : 'No se pudo agregar la categoria'
        ];
    }

    function editCategory() {
        $values = $this->util->sql([
            'classification' => $_POST['classification'],
            'description'    => $_POST['description'],
            'id'             => (int) $_POST['id']
        ], 1);
        $edit = $this->updateCategory($values);
        return [
            'status'  => $edit !== false ? 200 : 500,
            'message' => $edit !== false ? 'Categoria actualizada correctamente' : 'No se pudo editar la categoria'
        ];
    }

    function statusCategory() {
        $update = $this->updateCategoryStatus([(string) $_POST['active'], (int) $_POST['id']]);
        return [
            'status'  => $update ? 200 : 500,
            'message' => $update ? 'Estado actualizado correctamente' : 'No se pudo cambiar el estado'
        ];
    }

    // Almacenes

    function lsWarehouses() {
        $rows = $this->listWarehouses([
            'companies_id' => $this->companiesId,
            'active'       => $_POST['active']
        ]);

        $__row = [];
        foreach ($rows as $item) {
            $__row[] = [
                'id'        => $item['id'],
                'Almacen'   => $item['name'],
                'Sucursal'  => $item['subsidiary_name'] ?: '-',
                'Area'      => colorSwatch($item['area_color'], $item['area_name']),
                'Default'   => [
                    'html'  => boolBadge($item['is_default'], 'SI', 'NO'),
                    'class' => 'text-center'
                ],
                'a'         => actionButtons('almacenes', $item['id'], $item['active'])
            ];
        }
        return ['row' => $__row, 'thead' => ''];
    }

    function getWarehouse() {
        $data = $this->getWarehouseById([(int) $_POST['id']]);
        return [
            'status'  => $data ? 200 : 404,
            'message' => $data ? 'Almacen encontrado' : 'Almacen no encontrado',
            'data'    => $data
        ];
    }

    function addWarehouse() {
        $create = $this->createWarehouse([
            $_POST['name'],
            (int) $_POST['is_default'],
            $_POST['warehouse_area_id'] !== '' ? (int) $_POST['warehouse_area_id'] : null,
            (int) $_POST['subsidiaries_id'],
            $this->companiesId
        ]);
        return [
            'status'  => $create ? 200 : 500,
            'message' => $create ? 'Almacen agregado correctamente' : 'No se pudo agregar el almacen'
        ];
    }

    function editWarehouse() {
        $values = $this->util->sql([
            'name'              => $_POST['name'],
            'is_default'        => (int) $_POST['is_default'],
            'warehouse_area_id' => $_POST['warehouse_area_id'] !== '' ? (int) $_POST['warehouse_area_id'] : null,
            'subsidiaries_id'   => (int) $_POST['subsidiaries_id'],
            'id'                => (int) $_POST['id']
        ], 1);
        $edit = $this->updateWarehouse($values);
        return [
            'status'  => $edit !== false ? 200 : 500,
            'message' => $edit !== false ? 'Almacen actualizado correctamente' : 'No se pudo editar el almacen'
        ];
    }

    function statusWarehouse() {
        $update = $this->updateWarehouseStatus([(int) $_POST['active'], (int) $_POST['id']]);
        return [
            'status'  => $update ? 200 : 500,
            'message' => $update ? 'Estado actualizado correctamente' : 'No se pudo cambiar el estado'
        ];
    }

    // Areas

    function lsAreas() {
        $rows = $this->listAreas([
            'companies_id' => $this->companiesId,
            'active'       => $_POST['active']
        ]);

        $__row = [];
        foreach ($rows as $item) {
            $__row[] = [
                'id'          => $item['id'],
                'Color'       => colorHexLabel($item['color_hex']),
                'Area'        => $item['name'],
                'Descripcion' => $item['description'] ?: '-',
                'Productos'   => [
                    'html'  => (int) $item['product_count'],
                    'class' => 'text-center'
                ],
                'a'           => actionButtons('areas', $item['id'], $item['active'])
            ];
        }
        return ['row' => $__row, 'thead' => ''];
    }

    function getArea() {
        $data = $this->getAreaById([(int) $_POST['id']]);
        return [
            'status'  => $data ? 200 : 404,
            'message' => $data ? 'Area encontrada' : 'Area no encontrada',
            'data'    => $data
        ];
    }

    function addArea() {
        $create = $this->createArea([
            $_POST['name'],
            $_POST['description'],
            $_POST['color_hex'],
            $this->companiesId
        ]);
        return [
            'status'  => $create ? 200 : 500,
            'message' => $create ? 'Area agregada correctamente' : 'No se pudo agregar el area'
        ];
    }

    function editArea() {
        $values = $this->util->sql([
            'name'        => $_POST['name'],
            'description' => $_POST['description'],
            'color_hex'   => $_POST['color_hex'],
            'id'          => (int) $_POST['id']
        ], 1);
        $edit = $this->updateArea($values);
        return [
            'status'  => $edit !== false ? 200 : 500,
            'message' => $edit !== false ? 'Area actualizada correctamente' : 'No se pudo editar el area'
        ];
    }

    function statusArea() {
        $update = $this->updateAreaStatus([(int) $_POST['active'], (int) $_POST['id']]);
        return [
            'status'  => $update ? 200 : 500,
            'message' => $update ? 'Estado actualizado correctamente' : 'No se pudo cambiar el estado'
        ];
    }

    // Unidades

    function lsUnits() {
        $rows = $this->listUnits(['active' => $_POST['active']]);

        $__row = [];
        foreach ($rows as $item) {
            $__row[] = [
                'id'        => $item['id'],
                'Code'      => skuPill($item['code']),
                'Nombre'    => $item['name'],
                'Productos' => [
                    'html'  => (int) $item['product_count'],
                    'class' => 'text-center'
                ],
                'a'         => actionButtons('unidades', $item['id'], $item['active'])
            ];
        }
        return ['row' => $__row, 'thead' => ''];
    }

    function getUnit() {
        $data = $this->getUnitById([(int) $_POST['id']]);
        return [
            'status'  => $data ? 200 : 404,
            'message' => $data ? 'Unidad encontrada' : 'Unidad no encontrada',
            'data'    => $data
        ];
    }

    function addUnit() {
        $create = $this->createUnit([$_POST['code'], $_POST['name']]);
        return [
            'status'  => $create ? 200 : 500,
            'message' => $create ? 'Unidad agregada correctamente' : 'No se pudo agregar la unidad'
        ];
    }

    function editUnit() {
        $values = $this->util->sql([
            'code' => $_POST['code'],
            'name' => $_POST['name'],
            'id'   => (int) $_POST['id']
        ], 1);
        $edit = $this->updateUnit($values);
        return [
            'status'  => $edit !== false ? 200 : 500,
            'message' => $edit !== false ? 'Unidad actualizada correctamente' : 'No se pudo editar la unidad'
        ];
    }

    function statusUnit() {
        $update = $this->updateUnitStatus([(int) $_POST['active'], (int) $_POST['id']]);
        return [
            'status'  => $update ? 200 : 500,
            'message' => $update ? 'Estado actualizado correctamente' : 'No se pudo cambiar el estado'
        ];
    }

    // Proveedores

    function lsSuppliers() {
        $rows = $this->listSuppliers([
            'companies_id' => $this->companiesId,
            'active'       => $_POST['active']
        ]);

        $__row = [];
        foreach ($rows as $item) {
            $__row[] = [
                'id'        => $item['id'],
                'Proveedor' => $item['name'],
                'Contacto'  => $item['contact_name'] ?: '-',
                'Telefono'  => $item['phone'] ?: '-',
                'Email'     => $item['email'] ?: '-',
                'Entradas'  => [
                    'html'  => (int) $item['inflow_count'],
                    'class' => 'text-center'
                ],
                'a'         => actionButtons('proveedores', $item['id'], $item['active'])
            ];
        }
        return ['row' => $__row, 'thead' => ''];
    }

    function getSupplier() {
        $data = $this->getSupplierById([(int) $_POST['id']]);
        return [
            'status'  => $data ? 200 : 404,
            'message' => $data ? 'Proveedor encontrado' : 'Proveedor no encontrado',
            'data'    => $data
        ];
    }

    function addSupplier() {
        $create = $this->createSupplier([
            $_POST['name'],
            $_POST['contact_name'],
            $_POST['phone'],
            $_POST['email'],
            $this->companiesId
        ]);
        return [
            'status'  => $create ? 200 : 500,
            'message' => $create ? 'Proveedor agregado correctamente' : 'No se pudo agregar el proveedor'
        ];
    }

    function editSupplier() {
        $values = $this->util->sql([
            'name'         => $_POST['name'],
            'contact_name' => $_POST['contact_name'],
            'phone'        => $_POST['phone'],
            'email'        => $_POST['email'],
            'id'           => (int) $_POST['id']
        ], 1);
        $edit = $this->updateSupplier($values);
        return [
            'status'  => $edit !== false ? 200 : 500,
            'message' => $edit !== false ? 'Proveedor actualizado correctamente' : 'No se pudo editar el proveedor'
        ];
    }

    function statusSupplier() {
        $update = $this->updateSupplierStatus([(int) $_POST['active'], (int) $_POST['id']]);
        return [
            'status'  => $update ? 200 : 500,
            'message' => $update ? 'Estado actualizado correctamente' : 'No se pudo cambiar el estado'
        ];
    }

    // Origenes de entrada

    function lsInflowOrigins() {
        $rows = $this->listInflowOrigins(['active' => $_POST['active']]);

        $__row = [];
        foreach ($rows as $item) {
            $__row[] = [
                'id'       => $item['id'],
                'Code'     => skuPill($item['code']),
                'Origen'   => $item['name'],
                'Color'    => colorHexLabel($item['color_hex']),
                'Proveedor' => [
                    'html'  => boolBadge($item['requires_supplier'], 'SI', 'NO'),
                    'class' => 'text-center'
                ],
                'a'        => actionButtons('origenes', $item['id'], $item['active'])
            ];
        }
        return ['row' => $__row, 'thead' => ''];
    }

    function getInflowOrigin() {
        $data = $this->getInflowOriginById([(int) $_POST['id']]);
        return [
            'status'  => $data ? 200 : 404,
            'message' => $data ? 'Origen encontrado' : 'Origen no encontrado',
            'data'    => $data
        ];
    }

    function addInflowOrigin() {
        $create = $this->createInflowOrigin([
            $_POST['code'],
            $_POST['name'],
            $_POST['icon'],
            $_POST['color_hex'],
            (int) $_POST['requires_supplier']
        ]);
        return [
            'status'  => $create ? 200 : 500,
            'message' => $create ? 'Origen agregado correctamente' : 'No se pudo agregar el origen'
        ];
    }

    function editInflowOrigin() {
        $values = $this->util->sql([
            'code'              => $_POST['code'],
            'name'              => $_POST['name'],
            'icon'              => $_POST['icon'],
            'color_hex'         => $_POST['color_hex'],
            'requires_supplier' => (int) $_POST['requires_supplier'],
            'id'                => (int) $_POST['id']
        ], 1);
        $edit = $this->updateInflowOrigin($values);
        return [
            'status'  => $edit !== false ? 200 : 500,
            'message' => $edit !== false ? 'Origen actualizado correctamente' : 'No se pudo editar el origen'
        ];
    }

    function statusInflowOrigin() {
        $update = $this->updateInflowOriginStatus([(int) $_POST['active'], (int) $_POST['id']]);
        return [
            'status'  => $update ? 200 : 500,
            'message' => $update ? 'Estado actualizado correctamente' : 'No se pudo cambiar el estado'
        ];
    }

    // Motivos de merma

    function lsShrinkageReasons() {
        $rows = $this->listShrinkageReasons(['active' => $_POST['active']]);

        $__row = [];
        foreach ($rows as $item) {
            $__row[] = [
                'id'     => $item['id'],
                'Code'   => skuPill($item['code']),
                'Motivo' => $item['name'],
                'Color'  => colorHexLabel($item['color_hex']),
                'a'      => actionButtons('mermas', $item['id'], $item['active'])
            ];
        }
        return ['row' => $__row, 'thead' => ''];
    }

    function getShrinkageReason() {
        $data = $this->getShrinkageReasonById([(int) $_POST['id']]);
        return [
            'status'  => $data ? 200 : 404,
            'message' => $data ? 'Motivo encontrado' : 'Motivo no encontrado',
            'data'    => $data
        ];
    }

    function addShrinkageReason() {
        $create = $this->createShrinkageReason([
            $_POST['code'],
            $_POST['name'],
            $_POST['icon'],
            $_POST['color_hex']
        ]);
        return [
            'status'  => $create ? 200 : 500,
            'message' => $create ? 'Motivo agregado correctamente' : 'No se pudo agregar el motivo'
        ];
    }

    function editShrinkageReason() {
        $values = $this->util->sql([
            'code'      => $_POST['code'],
            'name'      => $_POST['name'],
            'icon'      => $_POST['icon'],
            'color_hex' => $_POST['color_hex'],
            'id'        => (int) $_POST['id']
        ], 1);
        $edit = $this->updateShrinkageReason($values);
        return [
            'status'  => $edit !== false ? 200 : 500,
            'message' => $edit !== false ? 'Motivo actualizado correctamente' : 'No se pudo editar el motivo'
        ];
    }

    function statusShrinkageReason() {
        $update = $this->updateShrinkageReasonStatus([(int) $_POST['active'], (int) $_POST['id']]);
        return [
            'status'  => $update ? 200 : 500,
            'message' => $update ? 'Estado actualizado correctamente' : 'No se pudo cambiar el estado'
        ];
    }

    // Motivos de ajuste

    function lsAdjustmentReasons() {
        $rows = $this->listAdjustmentReasons(['active' => $_POST['active']]);

        $__row = [];
        foreach ($rows as $item) {
            $__row[] = [
                'id'      => $item['id'],
                'Code'    => skuPill($item['code']),
                'Motivo'  => $item['name'],
                'Color'   => colorHexLabel($item['color_hex']),
                'Costo'   => [
                    'html'  => boolBadge($item['affects_cost'], 'SI', 'NO'),
                    'class' => 'text-center'
                ],
                'a'       => actionButtons('ajustes', $item['id'], $item['active'])
            ];
        }
        return ['row' => $__row, 'thead' => ''];
    }

    function getAdjustmentReason() {
        $data = $this->getAdjustmentReasonById([(int) $_POST['id']]);
        return [
            'status'  => $data ? 200 : 404,
            'message' => $data ? 'Motivo encontrado' : 'Motivo no encontrado',
            'data'    => $data
        ];
    }

    function addAdjustmentReason() {
        $create = $this->createAdjustmentReason([
            $_POST['code'],
            $_POST['name'],
            $_POST['icon'],
            $_POST['color_hex'],
            (int) $_POST['affects_cost']
        ]);
        return [
            'status'  => $create ? 200 : 500,
            'message' => $create ? 'Motivo agregado correctamente' : 'No se pudo agregar el motivo'
        ];
    }

    function editAdjustmentReason() {
        $values = $this->util->sql([
            'code'         => $_POST['code'],
            'name'         => $_POST['name'],
            'icon'         => $_POST['icon'],
            'color_hex'    => $_POST['color_hex'],
            'affects_cost' => (int) $_POST['affects_cost'],
            'id'           => (int) $_POST['id']
        ], 1);
        $edit = $this->updateAdjustmentReason($values);
        return [
            'status'  => $edit !== false ? 200 : 500,
            'message' => $edit !== false ? 'Motivo actualizado correctamente' : 'No se pudo editar el motivo'
        ];
    }

    function statusAdjustmentReason() {
        $update = $this->updateAdjustmentReasonStatus([(int) $_POST['active'], (int) $_POST['id']]);
        return [
            'status'  => $update ? 200 : 500,
            'message' => $update ? 'Estado actualizado correctamente' : 'No se pudo cambiar el estado'
        ];
    }

    // Estados de traspaso

    function lsTransferStatuses() {
        $rows = $this->listTransferStatuses(['active' => $_POST['active']]);

        $__row = [];
        foreach ($rows as $item) {
            $__row[] = [
                'id'       => $item['id'],
                'Code'     => skuPill($item['code']),
                'Estado'   => $item['name'],
                'Orden'    => [
                    'html'  => (int) $item['order_index'],
                    'class' => 'text-center'
                ],
                'Terminal' => [
                    'html'  => boolBadge($item['is_terminal'], 'SI', 'NO'),
                    'class' => 'text-center'
                ],
                'Color'    => colorHexLabel($item['color_hex']),
                'a'        => actionButtons('estados', $item['id'], $item['active'])
            ];
        }
        return ['row' => $__row, 'thead' => ''];
    }

    function getTransferStatus() {
        $data = $this->getTransferStatusById([(int) $_POST['id']]);
        return [
            'status'  => $data ? 200 : 404,
            'message' => $data ? 'Estado encontrado' : 'Estado no encontrado',
            'data'    => $data
        ];
    }

    function addTransferStatus() {
        $create = $this->createTransferStatus([
            $_POST['code'],
            $_POST['name'],
            (int) $_POST['order_index'],
            (int) $_POST['is_terminal'],
            $_POST['color_hex']
        ]);
        return [
            'status'  => $create ? 200 : 500,
            'message' => $create ? 'Estado agregado correctamente' : 'No se pudo agregar el estado'
        ];
    }

    function editTransferStatus() {
        $values = $this->util->sql([
            'code'        => $_POST['code'],
            'name'        => $_POST['name'],
            'order_index' => (int) $_POST['order_index'],
            'is_terminal' => (int) $_POST['is_terminal'],
            'color_hex'   => $_POST['color_hex'],
            'id'          => (int) $_POST['id']
        ], 1);
        $edit = $this->updateTransferStatus($values);
        return [
            'status'  => $edit !== false ? 200 : 500,
            'message' => $edit !== false ? 'Estado actualizado correctamente' : 'No se pudo editar el estado'
        ];
    }

    function statusTransferStatus() {
        $update = $this->updateTransferStatusActive([(int) $_POST['active'], (int) $_POST['id']]);
        return [
            'status'  => $update ? 200 : 500,
            'message' => $update ? 'Estado actualizado correctamente' : 'No se pudo cambiar el estado'
        ];
    }
}

// Complements.

function actionButtons($entidad, $id, $active) {
    $isActive    = ((int) $active === 1) || ($active === '1');
    $toggleIcon  = $isActive ? 'icon-toggle-on' : 'icon-toggle-off';
    $toggleColor = $isActive ? 'text-green-400' : 'text-gray-500';
    $next        = $isActive ? 0 : 1;

    return [
        [
            'class'   => 'inline-flex items-center px-2 py-1 text-sm rounded bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 border border-blue-500/30 me-1',
            'html'    => '<i class="icon-pencil"></i>',
            'onclick' => "{$entidad}.edit({$id})"
        ],
        [
            'class'   => "inline-flex items-center px-2 py-1 text-sm rounded bg-gray-500/15 hover:bg-gray-500/25 {$toggleColor} border border-gray-500/30",
            'html'    => "<i class=\"{$toggleIcon}\"></i>",
            'onclick' => "{$entidad}.status({$id}, {$next})"
        ]
    ];
}

function previewButton($entidad, $id) {
    return [
        'class'   => 'inline-flex items-center px-2 py-1 text-sm rounded bg-green-500/15 hover:bg-green-500/25 text-green-400 border border-green-500/30 me-1',
        'html'    => '<i class="icon-eye"></i>',
        'onclick' => "{$entidad}.preview({$id})"
    ];
}

function productImageCell($image, $name, $id = 0) {
    // Caja de tamano fijo (flex-shrink-0) para que las cards respeten el tamano aunque
    // el nombre sea largo. El icono gris vive de fondo; la imagen lo cubre si carga.
    // Fallback en cadena: local -> produccion -> icono gris (al remover el <img>).
    $path  = ltrim((string) $image, '/');
    $local = !empty($path) ? '/' . $path : '';
    $prod  = !empty($path) ? 'https://huubie.com.mx/' . $path : '';
    $label = trim((string) $name);
    $id    = (int) $id;

    $imgTag = !empty($local)
        ? '<img src="' . $local . '" data-prod="' . $prod . '"'
            . ' onerror="if(this.dataset.prod){this.src=this.dataset.prod;this.dataset.prod=\'\';}else{this.remove();}"'
            . ' alt="Producto" class="absolute inset-0 w-full h-full object-cover" />'
        : '';

    // Clic sobre la miniatura -> ficha completa del producto. El hover (ring + escala)
    // indica al usuario que la miniatura es interactiva.
    $click = $id ? ' onclick="productos.preview(' . $id . ')" title="Clic para ver detalle"' : '';
    $hover = $id ? ' cursor-pointer transition duration-150 hover:ring-2 hover:ring-blue-400/60 hover:scale-105' : '';

    return '
        <div class="flex items-center gap-3">
            <div class="relative flex-shrink-0 w-10 h-10 rounded-md bg-[#1F2A37] flex items-center justify-center overflow-hidden' . $hover . '"' . $click . '>
                <i class="icon-birthday text-gray-500 text-lg"></i>
                ' . $imgTag . '
            </div>
            <span class="text-sm text-white">' . $label . '</span>
        </div>';
}

function skuPill($code) {
    if (empty($code)) {
        return '<span class="font-mono text-[10px] text-gray-500 border border-dashed border-gray-600 rounded px-2 py-0.5 uppercase">SIN SKU</span>';
    }
    return '<span class="font-mono text-xs text-gray-300 bg-[#1a2332] border border-gray-700 rounded px-2 py-0.5">' . $code . '</span>';
}

function colorSwatch($hex, $label) {
    if (empty($label)) {
        return '<span class="text-gray-500">--</span>';
    }
    $color = $hex ?: '#6B7280';
    return '<span class="inline-block w-2.5 h-2.5 rounded-full mr-1.5 align-middle border border-white/15" style="background:' . $color . '"></span>' . $label;
}

function colorHexLabel($hex) {
    $color = $hex ?: '#6B7280';
    return '<span class="inline-block w-4 h-4 rounded-full mr-1.5 align-middle border border-white/15" style="background:' . $color . '"></span>'
         . '<span class="font-mono text-xs text-gray-400">' . $color . '</span>';
}

function boolBadge($value, $trueLabel, $falseLabel) {
    if ((int) $value === 1) {
        return '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-[rgba(63,193,137,0.15)] text-[#3FC189]">' . $trueLabel . '</span>';
    }
    return '<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-[rgba(234,2,52,0.15)] text-[#EA0234]">' . $falseLabel . '</span>';
}

$obj = new ctrl();
echo json_encode($obj->{$_POST['opc']}());
