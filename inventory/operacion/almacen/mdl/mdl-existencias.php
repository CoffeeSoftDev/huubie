<?php
require_once '../../../conf/_CRUD.php';
require_once '../../../conf/_Utileria.php';
session_start();

class mdl extends CRUD {
    protected $util;
    public $bd;

    public function __construct() {
        $this->util = new Utileria;
        $this->bd = "fayxzvov_inventory.";
    }

    // Selects para filtros

    function lsZonas() {
        $query = "
            SELECT id, name AS valor
            FROM {$this->bd}warehouse_area
            WHERE active = 1
            AND companies_id = ".$_SESSION['company_id']."
            ORDER BY name ASC
        ";
        return $this->_Read($query, []);
    }

    function lsCategorias() {
        $query = "
            SELECT id, name AS valor
            FROM {$this->bd}item_category
            WHERE active = 1
            AND companies_id = ".$_SESSION['company_id']."
            ORDER BY name ASC
        ";
        return $this->_Read($query, []);
    }

    function lsAreas() {
        $query = "
            SELECT id, code AS valor
            FROM {$this->bd}unit
            WHERE active = 1
            AND companies_id = ".$_SESSION['company_id']."
            ORDER BY code ASC
        ";
        return $this->_Read($query, []);
    }

    // Existencias

    function listExistencias($filters) {
        $whereConditions = ['i.companies_id = '.$_SESSION['company_id'], 'i.active = 1'];
        $params = [];

        if (!empty($filters['zona']) && $filters['zona'] != 'Todos') {
            $whereConditions[] = 'ia.warehouse_area_id = ?';
            $params[] = $filters['zona'];
        }

        if (!empty($filters['area']) && $filters['area'] != 'Todos') {
            $whereConditions[] = 'ia.unit_id = ?';
            $params[] = $filters['area'];
        }

        if (!empty($filters['categoria']) && $filters['categoria'] != 'Todos') {
            $whereConditions[] = 'i.category_id = ?';
            $params[] = $filters['categoria'];
        }

        $whereClause = implode(' AND ', $whereConditions);

        $query = "
            SELECT
                i.id,
                i.name AS producto,
                u.code AS presentacion,
                ia.stock_min AS inventario_min,
                ia.cost_unit AS Costo,
                i.price AS PrecioVenta,
                COALESCE(st.qty, 0) AS cantidad,
                st.last_mov AS fecha_mayoreo,
                0 AS stock_inicial,
                ic.name AS categoria,
                wa.name AS area
            FROM {$this->bd}item i
            LEFT JOIN {$this->bd}item_attribute ia ON ia.item_id = i.id AND ia.active = 1
            LEFT JOIN {$this->bd}item_category  ic ON ic.id = i.category_id
            LEFT JOIN {$this->bd}unit           u  ON u.id  = ia.unit_id
            LEFT JOIN {$this->bd}warehouse_area wa ON wa.id = ia.warehouse_area_id
            LEFT JOIN (
                SELECT item_id, SUM(quantity) AS qty, MAX(last_movement_at) AS last_mov
                FROM {$this->bd}stock
                WHERE active = 1
                GROUP BY item_id
            ) st ON st.item_id = i.id
            WHERE $whereClause
            ORDER BY i.name ASC
        ";

        return $this->_Read($query, $params);
    }

    function getResumen($filters) {
        $whereConditions = ['i.companies_id = '.$_SESSION['company_id'], 'i.active = 1'];
        $params = [];

        if (!empty($filters['zona']) && $filters['zona'] != 'Todos') {
            $whereConditions[] = 'ia.warehouse_area_id = ?';
            $params[] = $filters['zona'];
        }

        if (!empty($filters['area']) && $filters['area'] != 'Todos') {
            $whereConditions[] = 'ia.unit_id = ?';
            $params[] = $filters['area'];
        }

        if (!empty($filters['categoria']) && $filters['categoria'] != 'Todos') {
            $whereConditions[] = 'i.category_id = ?';
            $params[] = $filters['categoria'];
        }

        $whereClause = implode(' AND ', $whereConditions);

        $query = "
            SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN cantidad >  stock_min THEN 1 ELSE 0 END) AS disponibles,
                SUM(CASE WHEN cantidad <= stock_min AND cantidad > 0 THEN 1 ELSE 0 END) AS stock_bajo,
                SUM(CASE WHEN cantidad =  0 THEN 1 ELSE 0 END) AS agotados,
                SUM(cantidad * costo) AS valor_total
            FROM (
                SELECT
                    i.id,
                    COALESCE(st.qty, 0)        AS cantidad,
                    COALESCE(ia.stock_min, 0)  AS stock_min,
                    COALESCE(ia.cost_unit, 0)  AS costo
                FROM {$this->bd}item i
                LEFT JOIN {$this->bd}item_attribute ia ON ia.item_id = i.id AND ia.active = 1
                LEFT JOIN (
                    SELECT item_id, SUM(quantity) AS qty
                    FROM {$this->bd}stock
                    WHERE active = 1
                    GROUP BY item_id
                ) st ON st.item_id = i.id
                WHERE $whereClause
            ) t
        ";

        return $this->_Read($query, $params);
    }

    function getProductoById($id) {
        $query = "
            SELECT
                i.*,
                ia.sku,
                ia.cost_unit,
                ia.stock_min,
                ic.name AS categoria_nombre,
                u.code  AS unidad,
                wa.name AS area_nombre,
                COALESCE(st.qty, 0) AS cantidad
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
            WHERE i.id = ? AND i.companies_id = ".$_SESSION['company_id']."
        ";
        $result = $this->_Read($query, [$id]);
        return $result[0] ?? null;
    }
}
