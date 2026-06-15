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
                ic.warehouse_id,
                w.name as warehouse_name,
                DATE_FORMAT(ic.created_at, '%d/%m/%Y') as date_creation,
                ic.active
            FROM {$this->bd}item_category ic
            LEFT JOIN {$this->bd}warehouse w ON w.id = ic.warehouse_id
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

    // Área -> warehouse_area

    function listArea($array) {
        $query = "
            SELECT
                id,
                name as valor,
                description,
                color_hex,
                DATE_FORMAT(created_at, '%d/%m/%Y') as date_creation,
                active
            FROM {$this->bd}warehouse_area
            WHERE active = ?
            AND companies_id = ".$_SESSION['company_id']."
            ORDER BY id DESC
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

    function existsAreaByName($array) {
        $query = "
            SELECT COUNT(*) as total
            FROM {$this->bd}warehouse_area
            WHERE LOWER(name) = LOWER(?)
            AND active = 1
            AND companies_id = ".$_SESSION['company_id']."
        ";
        $result = $this->_Read($query, $array);
        return $result[0]['total'] ?? 0;
    }

    // Unidad -> unit

    function listUnit($array) {
        $query = "
            SELECT
                id,
                code,
                name as valor,
                DATE_FORMAT(created_at, '%d/%m/%Y') as date_creation,
                active
            FROM {$this->bd}unit
            WHERE active = ?
            AND companies_id = ".$_SESSION['company_id']."
            ORDER BY id DESC
        ";
        return $this->_Read($query, $array);
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
                active
            FROM {$this->bd}inflow_origin
            WHERE active = ?
            ORDER BY id DESC
        ";
        return $this->_Read($query, $array);
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
                active
            FROM {$this->bd}shrinkage_reason
            WHERE active = ?
            ORDER BY id DESC
        ";
        return $this->_Read($query, $array);
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

    // Almacenes -> warehouse

    function listWarehouse($array) {
        $query = "
            SELECT
                w.id,
                w.name as valor,
                w.is_default,
                wa.name as area_name,
                b.name as branch_name,
                DATE_FORMAT(w.created_at, '%d/%m/%Y') as date_creation,
                w.active
            FROM {$this->bd}warehouse w
            LEFT JOIN {$this->bd}warehouse_area wa ON w.warehouse_area_id = wa.id
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

    // Areas activas para selects de formularios
    function listAreasSelect() {
        $query = "
            SELECT id, name as valor
            FROM {$this->bd}warehouse_area
            WHERE active = 1
            AND companies_id = ".$_SESSION['company_id']."
            ORDER BY name ASC
        ";
        return $this->_Read($query, []);
    }

    // Almacenes activos para selects de formularios (cada categoría pertenece a un almacén)
    function listWarehousesSelect() {
        $query = "
            SELECT id, name as valor
            FROM {$this->bd}warehouse
            WHERE active = 1
            AND companies_id = ".$_SESSION['company_id']."
            ORDER BY name ASC
        ";
        return $this->_Read($query, []);
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
