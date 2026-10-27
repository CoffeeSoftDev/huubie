<?php
require_once '../../conf/_CRUD.php';
require_once '../../conf/_Utileria.php';

class mdl extends CRUD {

    public $util;
    public $bd;
    public $bdAlpha;
    public $bdAdmin;

    public function __construct() {
        $this->util    = new Utileria;
        $this->bd      = 'fayxzvov_reginas.';
        $this->bdAlpha = 'fayxzvov_alpha.';
        $this->bdAdmin = 'fayxzvov_admin.';
    }

    // Selects (catalogos para formularios y filtros)

    function lsCategoriesSelect() {
        $query = "
            SELECT id, classification AS valor
            FROM {$this->bd}order_category
            WHERE active = '1'
            ORDER BY classification ASC
        ";
        $r = $this->_Read($query);
        return is_array($r) ? $r : [];
    }

    function lsAreasSelect($array) {
        $query = "
            SELECT id, name AS valor, color_hex
            FROM {$this->bd}warehouse_area
            WHERE companies_id = ? AND active = 1
            ORDER BY name ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    function lsUnitsSelect() {
        $query = "
            SELECT id, name AS valor, code
            FROM {$this->bd}unit
            WHERE active = 1
            ORDER BY name ASC
        ";
        $r = $this->_Read($query);
        return is_array($r) ? $r : [];
    }

    function lsSuppliersSelect($array) {
        $query = "
            SELECT id, name AS valor
            FROM {$this->bd}supplier
            WHERE companies_id = ? AND active = 1
            ORDER BY name ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    function lsSubsidiariesSelect($array) {
        $query = "
            SELECT id, name AS valor
            FROM {$this->bdAlpha}subsidiaries
            WHERE companies_id = ? AND active = 1
            ORDER BY name ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    // Productos (order_products + product_attribute)

    function listProducts($array) {
        $where = 'COALESCE(p.companies_id, ps.companies_id) = ?';
        $data  = [$array['companies_id']];

        if ($array['active'] !== '') {
            $where .= ' AND p.active = ?';
            $data[] = $array['active'];
        }
        if (!empty($array['category_id'])) {
            $where .= ' AND p.category_id = ?';
            $data[] = $array['category_id'];
        }
        if (!empty($array['warehouse_area_id'])) {
            $where .= ' AND pa.warehouse_area_id = ?';
            $data[] = $array['warehouse_area_id'];
        }
        if (!empty($array['unit_id'])) {
            $where .= ' AND pa.unit_id = ?';
            $data[] = $array['unit_id'];
        }

        $query = "
            SELECT
                p.id,
                p.name,
                p.price,
                p.image,
                p.active,
                p.category_id,
                oc.classification   AS category_name,
                pa.id               AS attribute_id,
                pa.sku,
                pa.cost_unit,
                pa.stock_min,
                pa.stock_max,
                pa.shelf_life_days,
                pa.warehouse_area_id,
                pa.unit_id,
                u.code              AS unit_code,
                wa.name             AS area_name,
                wa.color_hex        AS area_color
            FROM {$this->bd}order_products p
            LEFT JOIN {$this->bdAlpha}subsidiaries ps ON ps.id = p.subsidiaries_id
            LEFT JOIN {$this->bd}order_category    oc ON oc.id = p.category_id
            LEFT JOIN {$this->bd}product_attribute pa ON pa.product_id = p.id AND pa.active = 1
            LEFT JOIN {$this->bd}unit              u  ON u.id  = pa.unit_id
            LEFT JOIN {$this->bd}warehouse_area    wa ON wa.id = pa.warehouse_area_id
            WHERE {$where}
            ORDER BY p.id DESC
        ";
        $r = $this->_Read($query, $data);
        return is_array($r) ? $r : [];
    }

    function getProductById($array) {
        $query = "
            SELECT
                p.id,
                p.name,
                p.price,
                p.description,
                p.image,
                p.category_id,
                p.subsidiaries_id,
                p.active,
                pa.id               AS attribute_id,
                pa.sku,
                pa.description      AS attribute_description,
                pa.cost_unit,
                pa.stock_min,
                pa.stock_max,
                pa.shelf_life_days,
                pa.warehouse_area_id,
                pa.unit_id
            FROM {$this->bd}order_products p
            LEFT JOIN {$this->bd}product_attribute pa ON pa.product_id = p.id AND pa.active = 1
            WHERE p.id = ?
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    function getLastProductId($array) {
        $query = "
            SELECT p.id
            FROM {$this->bd}order_products p
            LEFT JOIN {$this->bdAlpha}subsidiaries ps ON ps.id = p.subsidiaries_id
            WHERE COALESCE(p.companies_id, ps.companies_id) = ? AND p.name = ?
            ORDER BY p.id DESC
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? (int) $r[0]['id'] : 0;
    }

    function getAttributeByProduct($array) {
        $query = "
            SELECT id
            FROM {$this->bd}product_attribute
            WHERE product_id = ?
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    function skuExists($array) {
        // $array = [sku, companies_id, excludeProductId]
        $query = "
            SELECT id
            FROM {$this->bd}product_attribute
            WHERE sku = ? AND companies_id = ? AND product_id <> ?
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && count($r) > 0;
    }

    function existsProductByName($array) {
        $query = "
            SELECT p.id
            FROM {$this->bd}order_products p
            LEFT JOIN {$this->bdAlpha}subsidiaries ps ON ps.id = p.subsidiaries_id
            WHERE LOWER(p.name) = LOWER(?) AND COALESCE(p.companies_id, ps.companies_id) = ? AND p.active = 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && count($r) > 0;
    }

    function createProductMaster($array) {
        $query = "
            INSERT INTO {$this->bd}order_products
                (name, price, category_id, description, subsidiaries_id, active, date_creation, companies_id)
            VALUES (?,?,?,?,?,1,NOW(),?)
        ";
        return $this->_CUD($query, $array);
    }

    function createProductAttribute($array) {
        $query = "
            INSERT INTO {$this->bd}product_attribute
                (sku, description, shelf_life_days, cost_unit, stock_min, stock_max,
                 warehouse_area_id, unit_id, product_id, companies_id)
            VALUES (?,?,?,?,?,?,?,?,?,?)
        ";
        return $this->_CUD($query, $array);
    }

    function updateProductMaster($array) {
        return $this->_Update([
            'table'  => "{$this->bd}order_products",
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data']
        ]);
    }

    function updateProductAttribute($array) {
        $query = "
            UPDATE {$this->bd}product_attribute
            SET sku = ?, description = ?, shelf_life_days = ?, cost_unit = ?,
                stock_min = ?, stock_max = ?, warehouse_area_id = ?, unit_id = ?, updated_at = NOW()
            WHERE product_id = ?
        ";
        return $this->_CUD($query, $array);
    }

    function updateProductStatus($array) {
        $query = "UPDATE {$this->bd}order_products SET active = ? WHERE id = ?";
        return $this->_CUD($query, $array);
    }

    // Categorias (order_category)

    function listCategories($array) {
        $where = '1 = 1';
        $data  = [];

        if (isset($array['active']) && $array['active'] !== '') {
            $where .= ' AND oc.active = ?';
            $data[] = $array['active'];
        }

        $query = "
            SELECT
                oc.id,
                oc.classification,
                oc.description,
                oc.active,
                (SELECT COUNT(*) FROM {$this->bd}order_products op
                 WHERE op.category_id = oc.id AND op.active = 1) AS product_count
            FROM {$this->bd}order_category oc
            WHERE {$where}
            ORDER BY oc.classification ASC
        ";
        $r = $this->_Read($query, $data);
        return is_array($r) ? $r : [];
    }

    function getCategoryById($array) {
        $query = "
            SELECT id, classification, description, active
            FROM {$this->bd}order_category
            WHERE id = ?
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    function createCategory($array) {
        $query = "
            INSERT INTO {$this->bd}order_category
                (classification, description, active, date_creation)
            VALUES (?,?,'1',NOW())
        ";
        return $this->_CUD($query, $array);
    }

    function updateCategory($array) {
        return $this->_Update([
            'table'  => "{$this->bd}order_category",
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data']
        ]);
    }

    function updateCategoryStatus($array) {
        $query = "UPDATE {$this->bd}order_category SET active = ? WHERE id = ?";
        return $this->_CUD($query, $array);
    }

    // Almacenes (warehouse)

    function listWarehouses($array) {
        $where = 'w.companies_id = ?';
        $data  = [$array['companies_id']];

        if (isset($array['active']) && $array['active'] !== '') {
            $where .= ' AND w.active = ?';
            $data[] = $array['active'];
        }

        $query = "
            SELECT
                w.id,
                w.name,
                w.is_default,
                w.active,
                w.subsidiaries_id,
                w.warehouse_area_id,
                s.name       AS subsidiary_name,
                wa.name      AS area_name,
                wa.color_hex AS area_color
            FROM {$this->bd}warehouse w
            LEFT JOIN {$this->bdAlpha}subsidiaries s ON s.id = w.subsidiaries_id
            LEFT JOIN {$this->bd}warehouse_area   wa ON wa.id = w.warehouse_area_id
            WHERE {$where}
            ORDER BY s.name ASC, w.is_default DESC, w.name ASC
        ";
        $r = $this->_Read($query, $data);
        return is_array($r) ? $r : [];
    }

    function getWarehouseById($array) {
        $query = "
            SELECT id, name, is_default, warehouse_area_id, subsidiaries_id, active
            FROM {$this->bd}warehouse
            WHERE id = ?
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    function createWarehouse($array) {
        $query = "
            INSERT INTO {$this->bd}warehouse
                (name, is_default, warehouse_area_id, subsidiaries_id, companies_id)
            VALUES (?,?,?,?,?)
        ";
        return $this->_CUD($query, $array);
    }

    function updateWarehouse($array) {
        return $this->_Update([
            'table'  => "{$this->bd}warehouse",
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data']
        ]);
    }

    function updateWarehouseStatus($array) {
        $query = "UPDATE {$this->bd}warehouse SET active = ? WHERE id = ?";
        return $this->_CUD($query, $array);
    }

    // Areas (warehouse_area)

    function listAreas($array) {
        $where = 'wa.companies_id = ?';
        $data  = [$array['companies_id']];

        if (isset($array['active']) && $array['active'] !== '') {
            $where .= ' AND wa.active = ?';
            $data[] = $array['active'];
        }

        $query = "
            SELECT
                wa.id,
                wa.name,
                wa.description,
                wa.color_hex,
                wa.active,
                (SELECT COUNT(*) FROM {$this->bd}product_attribute pa
                 WHERE pa.warehouse_area_id = wa.id AND pa.active = 1) AS product_count
            FROM {$this->bd}warehouse_area wa
            WHERE {$where}
            ORDER BY wa.name ASC
        ";
        $r = $this->_Read($query, $data);
        return is_array($r) ? $r : [];
    }

    function getAreaById($array) {
        $query = "
            SELECT id, name, description, color_hex, active
            FROM {$this->bd}warehouse_area
            WHERE id = ?
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    function createArea($array) {
        $query = "
            INSERT INTO {$this->bd}warehouse_area
                (name, description, color_hex, companies_id)
            VALUES (?,?,?,?)
        ";
        return $this->_CUD($query, $array);
    }

    function updateArea($array) {
        return $this->_Update([
            'table'  => "{$this->bd}warehouse_area",
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data']
        ]);
    }

    function updateAreaStatus($array) {
        $query = "UPDATE {$this->bd}warehouse_area SET active = ? WHERE id = ?";
        return $this->_CUD($query, $array);
    }

    // Unidades (unit)

    function listUnits($array) {
        $where = '1 = 1';
        $data  = [];

        if (isset($array['active']) && $array['active'] !== '') {
            $where .= ' AND u.active = ?';
            $data[] = $array['active'];
        }

        $query = "
            SELECT
                u.id,
                u.code,
                u.name,
                u.active,
                (SELECT COUNT(*) FROM {$this->bd}product_attribute pa
                 WHERE pa.unit_id = u.id AND pa.active = 1) AS product_count
            FROM {$this->bd}unit u
            WHERE {$where}
            ORDER BY u.name ASC
        ";
        $r = $this->_Read($query, $data);
        return is_array($r) ? $r : [];
    }

    function getUnitById($array) {
        $query = "
            SELECT id, code, name, active
            FROM {$this->bd}unit
            WHERE id = ?
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    function createUnit($array) {
        $query = "
            INSERT INTO {$this->bd}unit (code, name) VALUES (?,?)
        ";
        return $this->_CUD($query, $array);
    }

    function updateUnit($array) {
        return $this->_Update([
            'table'  => "{$this->bd}unit",
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data']
        ]);
    }

    function updateUnitStatus($array) {
        $query = "UPDATE {$this->bd}unit SET active = ? WHERE id = ?";
        return $this->_CUD($query, $array);
    }

    // Proveedores (supplier)

    function listSuppliers($array) {
        $where = 'sp.companies_id = ?';
        $data  = [$array['companies_id']];

        if (isset($array['active']) && $array['active'] !== '') {
            $where .= ' AND sp.active = ?';
            $data[] = $array['active'];
        }

        $query = "
            SELECT
                sp.id,
                sp.name,
                sp.contact_name,
                sp.phone,
                sp.email,
                sp.active,
                (SELECT COUNT(*) FROM {$this->bd}inventory_inflow ii
                 WHERE ii.supplier_id = sp.id AND ii.active = 1) AS inflow_count
            FROM {$this->bd}supplier sp
            WHERE {$where}
            ORDER BY sp.name ASC
        ";
        $r = $this->_Read($query, $data);
        return is_array($r) ? $r : [];
    }

    function getSupplierById($array) {
        $query = "
            SELECT id, name, contact_name, phone, email, active
            FROM {$this->bd}supplier
            WHERE id = ?
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    function createSupplier($array) {
        $query = "
            INSERT INTO {$this->bd}supplier
                (name, contact_name, phone, email, companies_id)
            VALUES (?,?,?,?,?)
        ";
        return $this->_CUD($query, $array);
    }

    function updateSupplier($array) {
        return $this->_Update([
            'table'  => "{$this->bd}supplier",
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data']
        ]);
    }

    function updateSupplierStatus($array) {
        $query = "UPDATE {$this->bd}supplier SET active = ? WHERE id = ?";
        return $this->_CUD($query, $array);
    }

    // Origenes de entrada (inflow_origin)

    function listInflowOrigins($array) {
        $where = '1 = 1';
        $data  = [];

        if (isset($array['active']) && $array['active'] !== '') {
            $where .= ' AND active = ?';
            $data[] = $array['active'];
        }

        $query = "
            SELECT id, code, name, icon, color_hex, requires_supplier, active
            FROM {$this->bd}inflow_origin
            WHERE {$where}
            ORDER BY id ASC
        ";
        $r = $this->_Read($query, $data);
        return is_array($r) ? $r : [];
    }

    function getInflowOriginById($array) {
        $query = "
            SELECT id, code, name, icon, color_hex, requires_supplier, active
            FROM {$this->bd}inflow_origin
            WHERE id = ?
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    function createInflowOrigin($array) {
        $query = "
            INSERT INTO {$this->bd}inflow_origin
                (code, name, icon, color_hex, requires_supplier)
            VALUES (?,?,?,?,?)
        ";
        return $this->_CUD($query, $array);
    }

    function updateInflowOrigin($array) {
        return $this->_Update([
            'table'  => "{$this->bd}inflow_origin",
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data']
        ]);
    }

    function updateInflowOriginStatus($array) {
        $query = "UPDATE {$this->bd}inflow_origin SET active = ? WHERE id = ?";
        return $this->_CUD($query, $array);
    }

    // Motivos de merma (shrinkage_reason)

    function listShrinkageReasons($array) {
        $where = '1 = 1';
        $data  = [];

        if (isset($array['active']) && $array['active'] !== '') {
            $where .= ' AND active = ?';
            $data[] = $array['active'];
        }

        $query = "
            SELECT id, code, name, icon, color_hex, active
            FROM {$this->bd}shrinkage_reason
            WHERE {$where}
            ORDER BY id ASC
        ";
        $r = $this->_Read($query, $data);
        return is_array($r) ? $r : [];
    }

    function getShrinkageReasonById($array) {
        $query = "
            SELECT id, code, name, icon, color_hex, active
            FROM {$this->bd}shrinkage_reason
            WHERE id = ?
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    function createShrinkageReason($array) {
        $query = "
            INSERT INTO {$this->bd}shrinkage_reason
                (code, name, icon, color_hex)
            VALUES (?,?,?,?)
        ";
        return $this->_CUD($query, $array);
    }

    function updateShrinkageReason($array) {
        return $this->_Update([
            'table'  => "{$this->bd}shrinkage_reason",
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data']
        ]);
    }

    function updateShrinkageReasonStatus($array) {
        $query = "UPDATE {$this->bd}shrinkage_reason SET active = ? WHERE id = ?";
        return $this->_CUD($query, $array);
    }

    // Motivos de ajuste (adjustment_reason)

    function listAdjustmentReasons($array) {
        $where = '1 = 1';
        $data  = [];

        if (isset($array['active']) && $array['active'] !== '') {
            $where .= ' AND active = ?';
            $data[] = $array['active'];
        }

        $query = "
            SELECT id, code, name, icon, color_hex, affects_cost, active
            FROM {$this->bd}adjustment_reason
            WHERE {$where}
            ORDER BY id ASC
        ";
        $r = $this->_Read($query, $data);
        return is_array($r) ? $r : [];
    }

    function getAdjustmentReasonById($array) {
        $query = "
            SELECT id, code, name, icon, color_hex, affects_cost, active
            FROM {$this->bd}adjustment_reason
            WHERE id = ?
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    function createAdjustmentReason($array) {
        $query = "
            INSERT INTO {$this->bd}adjustment_reason
                (code, name, icon, color_hex, affects_cost)
            VALUES (?,?,?,?,?)
        ";
        return $this->_CUD($query, $array);
    }

    function updateAdjustmentReason($array) {
        return $this->_Update([
            'table'  => "{$this->bd}adjustment_reason",
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data']
        ]);
    }

    function updateAdjustmentReasonStatus($array) {
        $query = "UPDATE {$this->bd}adjustment_reason SET active = ? WHERE id = ?";
        return $this->_CUD($query, $array);
    }

    // Estados de traspaso (transfer_status)

    function listTransferStatuses($array) {
        $where = '1 = 1';
        $data  = [];

        if (isset($array['active']) && $array['active'] !== '') {
            $where .= ' AND active = ?';
            $data[] = $array['active'];
        }

        $query = "
            SELECT id, code, name, order_index, is_terminal, color_hex, active
            FROM {$this->bd}transfer_status
            WHERE {$where}
            ORDER BY order_index ASC
        ";
        $r = $this->_Read($query, $data);
        return is_array($r) ? $r : [];
    }

    function getTransferStatusById($array) {
        $query = "
            SELECT id, code, name, order_index, is_terminal, color_hex, active
            FROM {$this->bd}transfer_status
            WHERE id = ?
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    function createTransferStatus($array) {
        $query = "
            INSERT INTO {$this->bd}transfer_status
                (code, name, order_index, is_terminal, color_hex)
            VALUES (?,?,?,?,?)
        ";
        return $this->_CUD($query, $array);
    }

    function updateTransferStatus($array) {
        return $this->_Update([
            'table'  => "{$this->bd}transfer_status",
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data']
        ]);
    }

    function updateTransferStatusActive($array) {
        $query = "UPDATE {$this->bd}transfer_status SET active = ? WHERE id = ?";
        return $this->_CUD($query, $array);
    }
}
