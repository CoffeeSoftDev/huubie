<?php

require_once '../../../conf/_CRUD.php';
require_once '../../../conf/_Utileria.php';

class mdl extends CRUD {
    protected $util;
    public $bd;

    public function __construct() {
        $this->util = new Utileria;
        $this->bd   = "fayxzvov_inventory.";
    }

    // Selects para filtros / formularios

    function lsCategories() {
        $query = "
            SELECT id, name AS valor
            FROM {$this->bd}item_category
            WHERE active = 1
            AND companies_id = ".$_SESSION['company_id']."
            ORDER BY name ASC
        ";
        return $this->_Read($query, []);
    }

    function lsUnits() {
        $query = "
            SELECT id, code, name AS valor
            FROM {$this->bd}unit
            WHERE active = 1
            AND companies_id = ".$_SESSION['company_id']."
            ORDER BY name ASC
        ";
        return $this->_Read($query, []);
    }

    function lsAreas() {
        $query = "
            SELECT id, name AS valor
            FROM {$this->bd}warehouse_area
            WHERE active = 1
            AND companies_id = ".$_SESSION['company_id']."
            ORDER BY name ASC
        ";
        return $this->_Read($query, []);
    }

    function lsProveedores() {
        $query = "
            SELECT id, name AS valor
            FROM {$this->bd}supplier
            WHERE active = 1
            AND companies_id = ".$_SESSION['company_id']."
            ORDER BY name ASC
        ";
        return $this->_Read($query, []);
    }

    function lsWarehouses() {
        $query = "
            SELECT id, name AS valor
            FROM {$this->bd}warehouse
            WHERE active = 1
            AND companies_id = ".$_SESSION['company_id']."
            ORDER BY name ASC
        ";
        return $this->_Read($query, []);
    }

    // Insumos (item + item_attribute + stock)

    function listMateriales($filters) {
        $query = "
            SELECT
                i.id,
                i.name,
                i.image,
                i.price,
                i.active,
                i.created_at,
                ia.sku,
                ia.cost_unit AS cost,
                ia.stock_min,
                ia.stock_max,
                ia.shelf_life_days,
                ia.description,
                ic.name AS categoria,
                u.code  AS unidad,
                wa.name AS area,
                COALESCE(st.qty, 0) AS quantity
            FROM {$this->bd}item i
            LEFT JOIN {$this->bd}item_attribute ia ON ia.item_id = i.id AND ia.active = 1
            LEFT JOIN {$this->bd}item_category  ic ON ic.id = i.category_id
            LEFT JOIN {$this->bd}unit           u  ON u.id  = ia.unit_id
            LEFT JOIN {$this->bd}warehouse_area wa ON wa.id = ia.warehouse_area_id
            LEFT JOIN (
                SELECT item_id, SUM(quantity) AS qty
                FROM {$this->bd}stock
                WHERE active = 1
                GROUP BY item_id
            ) st ON st.item_id = i.id
            WHERE i.companies_id = ".$_SESSION['company_id']."
        ";

        $params = [];

        if (!empty($filters['categoria'])) {
            $query .= " AND i.category_id = ?";
            $params[] = $filters['categoria'];
        }

        if (!empty($filters['area'])) {
            $query .= " AND ia.warehouse_area_id = ?";
            $params[] = $filters['area'];
        }

        // Almacén: cada categoría pertenece a un almacén (item_category.warehouse_id),
        // así que el producto se filtra por la categoría asignada a ese almacén.
        if (!empty($filters['almacen'])) {
            $query .= " AND i.category_id IN (
                SELECT id FROM {$this->bd}item_category WHERE warehouse_id = ?
            )";
            $params[] = $filters['almacen'];
        }

        if (isset($filters['estado']) && $filters['estado'] !== '') {
            $query .= " AND i.active = ?";
            $params[] = $filters['estado'];
        }

        $query .= " ORDER BY i.id DESC";

        return $this->_Read($query, $params);
    }

    function getMaterialById($id) {
        $query = "
            SELECT
                i.*,
                ia.id AS attribute_id,
                ia.sku,
                ia.description,
                ia.shelf_life_days,
                ia.cost_unit,
                ia.stock_min,
                ia.stock_max,
                ia.warehouse_area_id,
                ia.unit_id
            FROM {$this->bd}item i
            LEFT JOIN {$this->bd}item_attribute ia ON ia.item_id = i.id AND ia.active = 1
            WHERE i.id = ?
        ";
        $result = $this->_Read($query, [$id]);
        return $result[0] ?? null;
    }

    function existsItemBySku($array) {
        $query = "
            SELECT COUNT(*) as count
            FROM {$this->bd}item_attribute
            WHERE sku = ? AND active = 1
            AND companies_id = ".$_SESSION['company_id']."
        ";
        $result = $this->_Read($query, $array);
        return $result[0]['count'] > 0;
    }

    function getNextSku() {
        $query = "
            SELECT COALESCE(MAX(id), 0) + 1 as next_id
            FROM {$this->bd}item
        ";
        $result = $this->_Read($query, []);
        $nextId = $result[0]['next_id'];
        return 'ITM-' . str_pad($nextId, 3, '0', STR_PAD_LEFT);
    }

    function createMaterial($data) {
        return $this->_Insert([
            'table'  => "{$this->bd}item",
            'values' => $data['values'],
            'data'   => $data['data']
        ]);
    }

    function getMaxItemId() {
        $query = "SELECT MAX(id) AS id FROM {$this->bd}item";
        $result = $this->_Read($query, []);
        return $result[0]['id'] ?? 0;
    }

    function createItemAttribute($data) {
        return $this->_Insert([
            'table'  => "{$this->bd}item_attribute",
            'values' => $data['values'],
            'data'   => $data['data']
        ]);
    }

    function updateMaterial($data) {
        return $this->_Update([
            'table'  => "{$this->bd}item",
            'values' => $data['values'],
            'where'  => $data['where'],
            'data'   => $data['data']
        ]);
    }

    function updateItemAttribute($data) {
        return $this->_Update([
            'table'  => "{$this->bd}item_attribute",
            'values' => $data['values'],
            'where'  => $data['where'],
            'data'   => $data['data']
        ]);
    }
}
