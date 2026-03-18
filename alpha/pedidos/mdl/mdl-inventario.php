<?php
require_once('../../conf/_CRUD.php');
require_once('../../conf/_Utileria.php');

class MInventario extends CRUD {
    protected $util;
    protected $bd;

    public function __construct() {
        $this->util = new Utileria;
        $this->bd   = 'fayxzvov_reginas.';
    }

    // === INSUMOS ===

    function listSupplies($array) {
        $query = "
            SELECT s.*, u.name AS unit_name, u.abbreviation AS unit_abbr,
                   sp.name AS supplier_name
            FROM {$this->bd}inv_supplies s
            LEFT JOIN {$this->bd}inv_units u ON s.unit_id = u.id
            LEFT JOIN {$this->bd}inv_suppliers sp ON s.supplier_id = sp.id
            WHERE s.subsidiary_id = ? AND s.active = 1
            ORDER BY s.name ASC
        ";
        return $this->_Read($query, $array);
    }

    function getSupplyById($array) {
        $query = "
            SELECT s.*, u.name AS unit_name, u.abbreviation AS unit_abbr
            FROM {$this->bd}inv_supplies s
            LEFT JOIN {$this->bd}inv_units u ON s.unit_id = u.id
            WHERE s.id = ?
        ";
        $result = $this->_Read($query, $array);
        return is_array($result) && !empty($result) ? $result[0] : null;
    }

    function existsSupplyByName($array) {
        $query = "
            SELECT COUNT(*) as count
            FROM {$this->bd}inv_supplies
            WHERE LOWER(name) = LOWER(?) AND subsidiary_id = ? AND active = 1
        ";
        $result = $this->_Read($query, $array);
        return $result[0]['count'] > 0;
    }

    function createSupply($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}inv_supplies",
            'values' => $array['values'],
            'data'   => $array['data'],
        ]);
    }

    function updateSupply($array) {
        return $this->_Update([
            'table'  => "{$this->bd}inv_supplies",
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data'],
        ]);
    }

    function deleteSupplyById($array) {
        return $this->_Delete([
            'table' => "{$this->bd}inv_supplies",
            'where' => $array['where'],
            'data'  => $array['data'],
        ]);
    }

    function getSuppliesLowStock($array) {
        $query = "
            SELECT s.*, u.abbreviation AS unit_abbr
            FROM {$this->bd}inv_supplies s
            LEFT JOIN {$this->bd}inv_units u ON s.unit_id = u.id
            WHERE s.subsidiary_id = ? AND s.active = 1
            AND s.stock <= s.min_stock AND s.min_stock > 0
            ORDER BY (s.stock / s.min_stock) ASC
        ";
        return $this->_Read($query, $array);
    }

    function getSuppliesCounts($array) {
        $query = "
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN stock <= min_stock AND min_stock > 0 THEN 1 ELSE 0 END) as low_stock,
                SUM(CASE WHEN stock = 0 THEN 1 ELSE 0 END) as out_of_stock
            FROM {$this->bd}inv_supplies
            WHERE subsidiary_id = ? AND active = 1
        ";
        $result = $this->_Read($query, $array);
        return is_array($result) && !empty($result) ? $result[0] : ['total' => 0, 'low_stock' => 0, 'out_of_stock' => 0];
    }

    function updateSupplyStock($array) {
        $query = "
            UPDATE {$this->bd}inv_supplies
            SET stock = ?
            WHERE id = ?
        ";
        return $this->_CUD($query, $array);
    }

    // === UNIDADES ===

    function lsUnits() {
        $query = "
            SELECT id, CONCAT(name, ' (', abbreviation, ')') as valor
            FROM {$this->bd}inv_units
            WHERE active = 1
            ORDER BY name ASC
        ";
        return $this->_Read($query, null);
    }

    // === PROVEEDORES ===

    function listSuppliers($array) {
        $query = "
            SELECT *
            FROM {$this->bd}inv_suppliers
            WHERE subsidiary_id = ? AND active = 1
            ORDER BY name ASC
        ";
        return $this->_Read($query, $array);
    }

    function getSupplierById($array) {
        $query = "
            SELECT *
            FROM {$this->bd}inv_suppliers
            WHERE id = ?
        ";
        $result = $this->_Read($query, $array);
        return is_array($result) && !empty($result) ? $result[0] : null;
    }

    function createSupplier($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}inv_suppliers",
            'values' => $array['values'],
            'data'   => $array['data'],
        ]);
    }

    function updateSupplier($array) {
        return $this->_Update([
            'table'  => "{$this->bd}inv_suppliers",
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data'],
        ]);
    }

    function deleteSupplierById($array) {
        return $this->_Delete([
            'table' => "{$this->bd}inv_suppliers",
            'where' => $array['where'],
            'data'  => $array['data'],
        ]);
    }

    function lsSuppliers($array) {
        $query = "
            SELECT id, name as valor
            FROM {$this->bd}inv_suppliers
            WHERE subsidiary_id = ? AND active = 1
            ORDER BY name ASC
        ";
        return $this->_Read($query, $array);
    }

    // === RECETAS ===

    function listRecipesByProduct($array) {
        $query = "
            SELECT r.*, s.name AS supply_name, u.abbreviation AS unit_abbr
            FROM {$this->bd}inv_recipes r
            LEFT JOIN {$this->bd}inv_supplies s ON r.supply_id = s.id
            LEFT JOIN {$this->bd}inv_units u ON r.unit_id = u.id
            WHERE r.product_id = ? AND r.active = 1
        ";
        return $this->_Read($query, $array);
    }

    function createRecipe($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}inv_recipes",
            'values' => $array['values'],
            'data'   => $array['data'],
        ]);
    }

    function updateRecipe($array) {
        return $this->_Update([
            'table'  => "{$this->bd}inv_recipes",
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data'],
        ]);
    }

    function deleteRecipeById($array) {
        return $this->_Delete([
            'table' => "{$this->bd}inv_recipes",
            'where' => $array['where'],
            'data'  => $array['data'],
        ]);
    }

    function lsProducts($array) {
        $query = "
            SELECT id, name as valor
            FROM {$this->bd}order_products
            WHERE active = ? AND subsidiaries_id = ?
            ORDER BY name ASC
        ";
        return $this->_Read($query, $array);
    }

    function lsSupplies($array) {
        $query = "
            SELECT id, CONCAT(name, ' (', (SELECT abbreviation FROM {$this->bd}inv_units WHERE id = unit_id), ')') as valor
            FROM {$this->bd}inv_supplies
            WHERE subsidiary_id = ? AND active = 1
            ORDER BY name ASC
        ";
        return $this->_Read($query, $array);
    }

    // === KARDEX ===

    function listKardex($array) {
        $query = "
            SELECT k.*, s.name AS supply_name, u.fullname AS employee_name,
                   un.abbreviation AS unit_abbr
            FROM {$this->bd}inv_kardex k
            LEFT JOIN {$this->bd}inv_supplies s ON k.supply_id = s.id
            LEFT JOIN fayxzvov_alpha.usr_users u ON u.id = k.employee_id
            LEFT JOIN {$this->bd}inv_units un ON un.id = (SELECT unit_id FROM {$this->bd}inv_supplies WHERE id = k.supply_id)
            WHERE k.subsidiary_id = ?
            AND DATE(k.created_at) BETWEEN ? AND ?
            ORDER BY k.created_at DESC
        ";
        return $this->_Read($query, $array);
    }

    function listKardexBySupply($array) {
        $query = "
            SELECT k.*, u.fullname AS employee_name
            FROM {$this->bd}inv_kardex k
            LEFT JOIN fayxzvov_alpha.usr_users u ON u.id = k.employee_id
            WHERE k.supply_id = ?
            ORDER BY k.created_at DESC
            LIMIT 100
        ";
        return $this->_Read($query, $array);
    }

    function createKardex($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}inv_kardex",
            'values' => $array['values'],
            'data'   => $array['data'],
        ]);
    }

    // === MERMAS Y AJUSTES ===

    function listAdjustments($array) {
        $query = "
            SELECT a.*, s.name AS supply_name, u.fullname AS employee_name,
                   un.abbreviation AS unit_abbr
            FROM {$this->bd}inv_adjustments a
            LEFT JOIN {$this->bd}inv_supplies s ON a.supply_id = s.id
            LEFT JOIN fayxzvov_alpha.usr_users u ON u.id = a.employee_id
            LEFT JOIN {$this->bd}inv_units un ON un.id = (SELECT unit_id FROM {$this->bd}inv_supplies WHERE id = a.supply_id)
            WHERE a.subsidiary_id = ? AND a.active = 1
            AND DATE(a.created_at) BETWEEN ? AND ?
            ORDER BY a.created_at DESC
        ";
        return $this->_Read($query, $array);
    }

    function createAdjustment($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}inv_adjustments",
            'values' => $array['values'],
            'data'   => $array['data'],
        ]);
    }

    // === ORDENES DE COMPRA ===

    function listPurchaseOrders($array) {
        $query = "
            SELECT po.*, s.name AS supplier_name, u.fullname AS employee_name
            FROM {$this->bd}inv_purchase_orders po
            LEFT JOIN {$this->bd}inv_suppliers s ON po.supplier_id = s.id
            LEFT JOIN fayxzvov_alpha.usr_users u ON u.id = po.employee_id
            WHERE po.subsidiary_id = ? AND po.active = 1
            AND DATE(po.created_at) BETWEEN ? AND ?
            ORDER BY po.created_at DESC
        ";
        return $this->_Read($query, $array);
    }

    function getPurchaseOrderById($array) {
        $query = "
            SELECT po.*, s.name AS supplier_name, s.phone AS supplier_phone,
                   s.email AS supplier_email, u.fullname AS employee_name
            FROM {$this->bd}inv_purchase_orders po
            LEFT JOIN {$this->bd}inv_suppliers s ON po.supplier_id = s.id
            LEFT JOIN fayxzvov_alpha.usr_users u ON u.id = po.employee_id
            WHERE po.id = ?
        ";
        $result = $this->_Read($query, $array);
        return is_array($result) && !empty($result) ? $result[0] : null;
    }

    function createPurchaseOrder($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}inv_purchase_orders",
            'values' => $array['values'],
            'data'   => $array['data'],
        ]);
    }

    function updatePurchaseOrder($array) {
        return $this->_Update([
            'table'  => "{$this->bd}inv_purchase_orders",
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data'],
        ]);
    }

    function getMaxPurchaseOrderId() {
        $query = "SELECT MAX(id) as id FROM {$this->bd}inv_purchase_orders";
        $result = $this->_Read($query, null);
        return is_array($result) && !empty($result) ? $result[0] : ['id' => 0];
    }

    function getPurchaseOrderCountByDate($array) {
        $query = "
            SELECT COUNT(*) as count
            FROM {$this->bd}inv_purchase_orders
            WHERE DATE(created_at) = ? AND subsidiary_id = ?
        ";
        $result = $this->_Read($query, $array);
        return is_array($result) && !empty($result) ? $result[0] : ['count' => 0];
    }

    function listPurchaseOrderItems($array) {
        $query = "
            SELECT poi.*, s.name AS supply_name, u.abbreviation AS unit_abbr
            FROM {$this->bd}inv_purchase_order_items poi
            LEFT JOIN {$this->bd}inv_supplies s ON poi.supply_id = s.id
            LEFT JOIN {$this->bd}inv_units u ON u.id = (SELECT unit_id FROM {$this->bd}inv_supplies WHERE id = poi.supply_id)
            WHERE poi.purchase_order_id = ?
        ";
        return $this->_Read($query, $array);
    }

    function createPurchaseOrderItem($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}inv_purchase_order_items",
            'values' => $array['values'],
            'data'   => $array['data'],
        ]);
    }

    function deletePurchaseOrderItemById($array) {
        return $this->_Delete([
            'table' => "{$this->bd}inv_purchase_order_items",
            'where' => $array['where'],
            'data'  => $array['data'],
        ]);
    }

    function updatePurchaseOrderTotals($array) {
        $query = "
            UPDATE {$this->bd}inv_purchase_orders
            SET subtotal = (SELECT COALESCE(SUM(total), 0) FROM {$this->bd}inv_purchase_order_items WHERE purchase_order_id = ?),
                total = (SELECT COALESCE(SUM(total), 0) FROM {$this->bd}inv_purchase_order_items WHERE purchase_order_id = ?)
            WHERE id = ?
        ";
        return $this->_CUD($query, [$array[0], $array[0], $array[0]]);
    }
}
