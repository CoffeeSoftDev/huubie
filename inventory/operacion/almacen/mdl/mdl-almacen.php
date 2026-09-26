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

    // Insumos (item + item_attribute + stock)

    function listMateriales($filters) {
        $query = "
            SELECT
                i.id,
                i.name,
                i.image,
                i.price,
                i.price_without_tax,
                i.tax,
                i.active,
                i.created_at,
                ia.sku,
                ia.cost_unit,
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

    // Solo LLENA el SKU: si el producto ya tiene uno, no se toca.
    function updateItemAttributeSku($array) {
        // [sku, item_id]
        $query = "
            UPDATE {$this->bd}item_attribute
               SET sku = ?
             WHERE item_id = ?
               AND (sku IS NULL OR sku = '')
        ";
        return $this->_CUD($query, $array);
    }

    // Último consecutivo usado con un prefijo de SKU; 0 si el prefijo aún no tiene ninguno.
    function getSkuCounts($array) {
        // [posición donde empieza el consecutivo, companies_id, patrón del prefijo]
        $query = "
            SELECT COALESCE(MAX(CAST(SUBSTRING(sku, ?) AS UNSIGNED)), 0) AS last_consecutive
            FROM {$this->bd}item_attribute
            WHERE companies_id = ?
              AND sku REGEXP ?
        ";
        $result = $this->_Read($query, $array);
        return (int) ($result[0]['last_consecutive'] ?? 0);
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

    // Catálogos que toca el asistente IA (categoría, unidad, área, almacén, proveedor)

    // Lista blanca entidad -> tabla: el nombre de la tabla nunca sale de lo que
    // proponga el modelo ni de lo que mande el navegador.
    private function catalogTable($entity) {
        $tables = [
            'category'  => 'item_category',
            'unit'      => 'unit',
            'area'      => 'warehouse_area',
            'warehouse' => 'warehouse',
            'supplier'  => 'supplier'
        ];

        if (!isset($tables[$entity])) throw new Exception('Catálogo no permitido: ' . $entity);

        return $this->bd . $tables[$entity];
    }

    // Activos e inactivos: el asistente también reactiva.
    function listCatalog($entity) {
        $table = $this->catalogTable($entity);
        $query = "
            SELECT *
            FROM {$table}
            WHERE companies_id = ?
            ORDER BY name ASC
        ";
        return $this->_Read($query, [$_SESSION['company_id']]);
    }

    function createCatalog($entity, $data) {
        return $this->_Insert([
            'table'  => $this->catalogTable($entity),
            'values' => $data['values'],
            'data'   => $data['data']
        ]);
    }

    function updateCatalog($entity, $data) {
        return $this->_Update([
            'table'  => $this->catalogTable($entity),
            'values' => $data['values'],
            'where'  => $data['where'],
            'data'   => $data['data']
        ]);
    }

    function getMaxCatalogId($entity) {
        $table  = $this->catalogTable($entity);
        $result = $this->_Read("SELECT MAX(id) AS id FROM {$table}", []);
        return (int) ($result[0]['id'] ?? 0);
    }

    function lsBranches() {
        $query = "
            SELECT id, name AS valor
            FROM fayxzvov_erp.branches
            WHERE company_id = ?
            AND is_active = 1
            ORDER BY name ASC
        ";
        return $this->_Read($query, [$_SESSION['company_id']]);
    }
}
