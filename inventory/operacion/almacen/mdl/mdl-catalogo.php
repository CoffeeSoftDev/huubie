<?php
require_once '../../../conf/_CRUD.php';
require_once '../../../conf/_Utileria.php';

class mdl extends CRUD {
    protected $util;
    public $bd;

    public function __construct() {
        $this->util = new Utileria;
        $this->bd = "fayxzvov_inventory.";
    }

    // Categoría -> item_category

    function listCategory($array) {
        $query = "
            SELECT
                ic.id,
                ic.name as valor,
                DATE_FORMAT(ic.created_at, '%d/%m/%Y') as date_creation,
                ic.active
            FROM {$this->bd}item_category ic
            WHERE ic.active = ?
            AND ic.companies_id = ".$_SESSION['company_id']."
            ORDER BY ic.id DESC
        ";
        return $this->_Read($query, $array);
    }

    function getCategoryById($array) {
        $query = "
            SELECT *
            FROM {$this->bd}item_category
            WHERE id = ?
        ";
        $result = $this->_Read($query, $array);
        return $result[0] ?? null;
    }

    function createCategory($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}item_category",
            'values' => $array['values'],
            'data'   => $array['data']
        ]);
    }

    function updateCategory($array) {
        return $this->_Update([
            'table'  => "{$this->bd}item_category",
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data']
        ]);
    }

    function existsCategoryByName($array) {
        $query = "
            SELECT COUNT(*) as total
            FROM {$this->bd}item_category
            WHERE LOWER(name) = LOWER(?)
            AND active = 1
            AND companies_id = ".$_SESSION['company_id']."
        ";
        $result = $this->_Read($query, $array);
        return $result[0]['total'] ?? 0;
    }

    function countItemsByCategory($array) {
        $query = "
            SELECT COUNT(*) as total
            FROM {$this->bd}item
            WHERE category_id = ?
        ";
        $result = $this->_Read($query, $array);
        return $result[0]['total'] ?? 0;
    }

    function updateItemsCategoryNull($array) {
        return $this->_CUD("UPDATE {$this->bd}item SET category_id = NULL WHERE category_id = ?", $array);
    }

    function deleteCategoryById($array) {
        return $this->_Delete([
            'table' => "{$this->bd}item_category",
            'where' => 'id',
            'data'  => $array
        ]);
    }

    // Área -> warehouse_area (cada área es un lugar dentro de un almacén)

    function listArea($array) {
        $query = "
            SELECT
                wa.id,
                wa.name as valor,
                wa.description,
                wa.color_hex,
                wa.warehouse_id,
                w.name as almacen,
                DATE_FORMAT(wa.created_at, '%d/%m/%Y') as date_creation,
                wa.active
            FROM {$this->bd}warehouse_area wa
            LEFT JOIN {$this->bd}warehouse w ON w.id = wa.warehouse_id
            WHERE wa.active = ?
            AND wa.companies_id = ".$_SESSION['company_id']."
            ORDER BY wa.id DESC
        ";
        return $this->_Read($query, $array);
    }

    function getAreaById($array) {
        $query = "
            SELECT *
            FROM {$this->bd}warehouse_area
            WHERE id = ?
        ";
        $result = $this->_Read($query, $array);
        return $result[0] ?? null;
    }

    function createArea($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}warehouse_area",
            'values' => $array['values'],
            'data'   => $array['data']
        ]);
    }

    function updateArea($array) {
        return $this->_Update([
            'table'  => "{$this->bd}warehouse_area",
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data']
        ]);
    }

    // El nombre se repite solo entre almacenes distintos. Params: [name, warehouse_id, id a excluir]
    function existsAreaByName($array) {
        $query = "
            SELECT COUNT(*) as total
            FROM {$this->bd}warehouse_area
            WHERE LOWER(name) = LOWER(?)
            AND warehouse_id = ?
            AND id <> ?
            AND active = 1
            AND companies_id = ".$_SESSION['company_id']."
        ";
        $result = $this->_Read($query, $array);
        return $result[0]['total'] ?? 0;
    }

    // Entradas que llevaron producto a esta área: son historia.
    function countAreaMovements($array) {
        $query = "
            SELECT COUNT(*) as total
            FROM {$this->bd}inventory_inflow
            WHERE warehouse_area_id = ?
        ";
        $result = $this->_Read($query, $array);
        return $result[0]['total'] ?? 0;
    }

    function countItemsByArea($array) {
        $query = "
            SELECT COUNT(DISTINCT item_id) as total
            FROM {$this->bd}item_attribute
            WHERE warehouse_area_id = ?
        ";
        $result = $this->_Read($query, $array);
        return $result[0]['total'] ?? 0;
    }

    function updateAreaRefsNull($array) {
        $this->_CUD("UPDATE {$this->bd}item_attribute SET warehouse_area_id = NULL WHERE warehouse_area_id = ?", $array);
        return $this->_CUD("UPDATE {$this->bd}warehouse SET warehouse_area_id = NULL WHERE warehouse_area_id = ?", $array);
    }

    function deleteAreaById($array) {
        return $this->_Delete([
            'table' => "{$this->bd}warehouse_area",
            'where' => 'id',
            'data'  => $array
        ]);
    }

    // Unidad -> unit

    // sort_order lo agrega docs/sql/2026-10-02_unidad-orden.sql.
    function listUnit($array) {
        $query = "
            SELECT
                id,
                code,
                name as valor,
                sort_order,
                DATE_FORMAT(created_at, '%d/%m/%Y') as date_creation,
                active
            FROM {$this->bd}unit
            WHERE active = ?
            AND companies_id = ".$_SESSION['company_id']."
            ORDER BY sort_order ASC, id ASC
        ";
        return $this->_Read($query, $array);
    }

    function getMaxUnitSort() {
        $result = $this->_Read("SELECT COALESCE(MAX(sort_order), 0) AS total FROM {$this->bd}unit WHERE companies_id = ".$_SESSION['company_id'], null);
        return (int) ($result[0]['total'] ?? 0);
    }

    function getUnitById($array) {
        $query = "
            SELECT *
            FROM {$this->bd}unit
            WHERE id = ?
        ";
        $result = $this->_Read($query, $array);
        return $result[0] ?? null;
    }

    function createUnit($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}unit",
            'values' => $array['values'],
            'data'   => $array['data']
        ]);
    }

    function updateUnit($array) {
        return $this->_Update([
            'table'  => "{$this->bd}unit",
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data']
        ]);
    }

    function existsUnitByName($array) {
        $query = "
            SELECT COUNT(*) as total
            FROM {$this->bd}unit
            WHERE LOWER(name) = LOWER(?)
            AND active = 1
            AND companies_id = ".$_SESSION['company_id']."
        ";
        $result = $this->_Read($query, $array);
        return $result[0]['total'] ?? 0;
    }

    function countUnitUsage($array) {
        $id    = $array[0];
        $query = "
            SELECT
                (SELECT COUNT(*) FROM {$this->bd}item_attribute          WHERE unit_id = ?)
              + (SELECT COUNT(*) FROM {$this->bd}detail_inventory_inflow WHERE unit_id = ?)
              + (SELECT COUNT(*) FROM {$this->bd}detail_purchase_order   WHERE unit_id = ?) AS total
        ";
        $result = $this->_Read($query, [$id, $id, $id]);
        return $result[0]['total'] ?? 0;
    }

    function deleteUnitById($array) {
        return $this->_Delete([
            'table' => "{$this->bd}unit",
            'where' => 'id',
            'data'  => $array
        ]);
    }

    // Origen de entradas -> inflow_origin (catalogo global, sin companies_id)

    function listInflow($array) {
        $query = "
            SELECT
                id,
                code,
                name as valor,
                icon,
                color_hex,
                bg_hex,
                requires_supplier,
                sort_order,
                active
            FROM {$this->bd}inflow_origin
            WHERE active = ?
            ORDER BY sort_order ASC, id ASC
        ";
        return $this->_Read($query, $array);
    }

    function getMaxInflowSort() {
        $result = $this->_Read("SELECT COALESCE(MAX(sort_order), 0) AS total FROM {$this->bd}inflow_origin", null);
        return (int) ($result[0]['total'] ?? 0);
    }

    function getInflowById($array) {
        $query = "
            SELECT *
            FROM {$this->bd}inflow_origin
            WHERE id = ?
        ";
        $result = $this->_Read($query, $array);
        return $result[0] ?? null;
    }

    function createInflow($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}inflow_origin",
            'values' => $array['values'],
            'data'   => $array['data']
        ]);
    }

    function updateInflow($array) {
        return $this->_Update([
            'table'  => "{$this->bd}inflow_origin",
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data']
        ]);
    }

    function existsInflowByName($array) {
        $query = "
            SELECT COUNT(*) as total
            FROM {$this->bd}inflow_origin
            WHERE LOWER(name) = LOWER(?)
            AND active = 1
        ";
        $result = $this->_Read($query, $array);
        return $result[0]['total'] ?? 0;
    }

    // El código lo genera el servidor: se revisa contra activos e inactivos.
    function existsInflowCode($array) {
        $query = "
            SELECT COUNT(*) as total
            FROM {$this->bd}inflow_origin
            WHERE code = ?
        ";
        $result = $this->_Read($query, $array);
        return $result[0]['total'] ?? 0;
    }

    function countInflowUsage($array) {
        $query = "
            SELECT COUNT(*) as total
            FROM {$this->bd}inventory_inflow
            WHERE inflow_origin_id = ?
        ";
        $result = $this->_Read($query, $array);
        return $result[0]['total'] ?? 0;
    }

    function deleteInflowById($array) {
        return $this->_Delete([
            'table' => "{$this->bd}inflow_origin",
            'where' => 'id',
            'data'  => $array
        ]);
    }

    // Motivos de salida -> shrinkage_reason (catalogo global, sin companies_id)

    function listShrinkage($array) {
        $query = "
            SELECT
                id,
                code,
                name as valor,
                icon,
                color_hex,
                bg_hex,
                sort_order,
                active
            FROM {$this->bd}shrinkage_reason
            WHERE active = ?
            ORDER BY sort_order ASC, id ASC
        ";
        return $this->_Read($query, $array);
    }

    function getMaxShrinkageSort() {
        $result = $this->_Read("SELECT COALESCE(MAX(sort_order), 0) AS total FROM {$this->bd}shrinkage_reason", null);
        return (int) ($result[0]['total'] ?? 0);
    }

    function getShrinkageById($array) {
        $query = "
            SELECT *
            FROM {$this->bd}shrinkage_reason
            WHERE id = ?
        ";
        $result = $this->_Read($query, $array);
        return $result[0] ?? null;
    }

    function createShrinkage($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}shrinkage_reason",
            'values' => $array['values'],
            'data'   => $array['data']
        ]);
    }

    function updateShrinkage($array) {
        return $this->_Update([
            'table'  => "{$this->bd}shrinkage_reason",
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data']
        ]);
    }

    function existsShrinkageByName($array) {
        $query = "
            SELECT COUNT(*) as total
            FROM {$this->bd}shrinkage_reason
            WHERE LOWER(name) = LOWER(?)
            AND active = 1
        ";
        $result = $this->_Read($query, $array);
        return $result[0]['total'] ?? 0;
    }

    function existsShrinkageCode($array) {
        $query = "
            SELECT COUNT(*) as total
            FROM {$this->bd}shrinkage_reason
            WHERE code = ?
        ";
        $result = $this->_Read($query, $array);
        return $result[0]['total'] ?? 0;
    }

    function countShrinkageUsage($array) {
        $query = "
            SELECT COUNT(*) as total
            FROM {$this->bd}inventory_shrinkage
            WHERE shrinkage_reason_id = ?
        ";
        $result = $this->_Read($query, $array);
        return $result[0]['total'] ?? 0;
    }

    function deleteShrinkageById($array) {
        return $this->_Delete([
            'table' => "{$this->bd}shrinkage_reason",
            'where' => 'id',
            'data'  => $array
        ]);
    }

    // Estados de traspaso -> transfer_status
    // Catalogo de sistema: los codigos (code) son fijos y referenciados por el flujo,
    // por eso el admin es solo edicion (nombres/colores/etiquetas relativas), sin alta.
    // order_index se acomoda arrastrando filas (sortTransferStatus).

    function listTransferStatus($array) {
        $query = "
            SELECT
                id,
                code,
                name as valor,
                name_out,
                name_in,
                color_hex,
                bg_hex,
                order_index,
                active
            FROM {$this->bd}transfer_status
            WHERE active = ?
            ORDER BY order_index ASC, id ASC
        ";
        $result = $this->_Read($query, $array);
        return is_array($result) ? $result : [];
    }

    function getTransferStatusById($array) {
        $query = "
            SELECT *
            FROM {$this->bd}transfer_status
            WHERE id = ?
        ";
        $result = $this->_Read($query, $array);
        return $result[0] ?? null;
    }

    function updateTransferStatus($array) {
        return $this->_Update([
            'table'  => "{$this->bd}transfer_status",
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data']
        ]);
    }

    // Almacenes -> warehouse

    function listWarehouse($array) {
        $query = "
            SELECT
                w.id,
                w.name as valor,
                w.is_default,
                b.name as branch_name,
                DATE_FORMAT(w.created_at, '%d/%m/%Y') as date_creation,
                w.active
            FROM {$this->bd}warehouse w
            LEFT JOIN branches b ON b.id = w.branch_id
            WHERE w.active = ?
            AND w.companies_id = ".$_SESSION['company_id']."
            ORDER BY w.id DESC
        ";
        return $this->_Read($query, $array);
    }

    function getWarehouseById($array) {
        $query = "
            SELECT *
            FROM {$this->bd}warehouse
            WHERE id = ?
        ";
        $result = $this->_Read($query, $array);
        return $result[0] ?? null;
    }

    function createWarehouse($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}warehouse",
            'values' => $array['values'],
            'data'   => $array['data']
        ]);
    }

    function updateWarehouse($array) {
        return $this->_Update([
            'table'  => "{$this->bd}warehouse",
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data']
        ]);
    }

    function existsWarehouseByName($array) {
        $query = "
            SELECT COUNT(*) as total
            FROM {$this->bd}warehouse
            WHERE LOWER(name) = LOWER(?)
            AND active = 1
            AND companies_id = ".$_SESSION['company_id']."
        ";
        $result = $this->_Read($query, $array);
        return $result[0]['total'] ?? 0;
    }

    // Stock, movimientos y órdenes que cuelgan del almacén.
    function countWarehouseUsage($array) {
        $id    = $array[0];
        $query = "
            SELECT
                (SELECT COUNT(*) FROM {$this->bd}stock               WHERE warehouse_id = ?)
              + (SELECT COUNT(*) FROM {$this->bd}inventory_inflow    WHERE warehouse_id = ?)
              + (SELECT COUNT(*) FROM {$this->bd}inventory_shrinkage WHERE warehouse_id = ?)
              + (SELECT COUNT(*) FROM {$this->bd}inventory_transfer  WHERE origin_warehouse_id = ? OR destination_warehouse_id = ?)
              + (SELECT COUNT(*) FROM {$this->bd}purchase_order      WHERE warehouse_id = ?) AS total
        ";
        $result = $this->_Read($query, [$id, $id, $id, $id, $id, $id]);
        return $result[0]['total'] ?? 0;
    }

    function countAreasByWarehouse($array) {
        $query = "
            SELECT COUNT(*) as total
            FROM {$this->bd}warehouse_area
            WHERE warehouse_id = ?
        ";
        $result = $this->_Read($query, $array);
        return $result[0]['total'] ?? 0;
    }

    function deleteWarehouseById($array) {
        return $this->_Delete([
            'table' => "{$this->bd}warehouse",
            'where' => 'id',
            'data'  => $array
        ]);
    }

    // Proveedores -> supplier

    function listSupplier($array) {
        $query = "
            SELECT
                id,
                name as valor,
                contact_name,
                phone,
                email,
                DATE_FORMAT(created_at, '%d/%m/%Y') as date_creation,
                active
            FROM {$this->bd}supplier
            WHERE active = ?
            AND companies_id = ".$_SESSION['company_id']."
            ORDER BY id DESC
        ";
        return $this->_Read($query, $array);
    }

    function getSupplierById($array) {
        $query = "
            SELECT *
            FROM {$this->bd}supplier
            WHERE id = ?
        ";
        $result = $this->_Read($query, $array);
        return $result[0] ?? null;
    }

    function createSupplier($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}supplier",
            'values' => $array['values'],
            'data'   => $array['data']
        ]);
    }

    function updateSupplier($array) {
        return $this->_Update([
            'table'  => "{$this->bd}supplier",
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data']
        ]);
    }

    function existsSupplierByName($array) {
        $query = "
            SELECT COUNT(*) as total
            FROM {$this->bd}supplier
            WHERE LOWER(name) = LOWER(?)
            AND active = 1
            AND companies_id = ".$_SESSION['company_id']."
        ";
        $result = $this->_Read($query, $array);
        return $result[0]['total'] ?? 0;
    }

    function countSupplierUsage($array) {
        $id    = $array[0];
        $query = "
            SELECT
                (SELECT COUNT(*) FROM {$this->bd}inventory_inflow WHERE supplier_id = ?)
              + (SELECT COUNT(*) FROM {$this->bd}purchase_order   WHERE supplier_id = ?) AS total
        ";
        $result = $this->_Read($query, [$id, $id]);
        return $result[0]['total'] ?? 0;
    }

    function deleteSupplierById($array) {
        return $this->_Delete([
            'table' => "{$this->bd}supplier",
            'where' => 'id',
            'data'  => $array
        ]);
    }

    // Mismo criterio que el menú: acceso/mdl/mdl-access.php::userIsSuperAdmin.
    function isSuperAdmin($array) {
        // [user_id, branch_id]
        $query = "
            SELECT 1
            FROM fayxzvov_erp.users_braches ub
            JOIN fayxzvov_erp.roles r ON r.id = ub.role_id AND r.is_active = 1
            WHERE ub.user_id = ? AND ub.branch_id = ?
                AND r.code = 'superadmin'
            LIMIT 1
        ";
        return !empty($this->_Read($query, $array));
    }

    // Sucursales activas de la compañía para selects de formularios (cada almacén pertenece a una sucursal).
    // Params: [company_id]
    function listBranchesSelect($array) {
        $query = "
            SELECT b.id, b.name as valor
            FROM branches b
            WHERE b.company_id = ?
            AND b.is_active = 1
            ORDER BY b.name ASC
        ";
        return $this->_Read($query, $array);
    }
}
