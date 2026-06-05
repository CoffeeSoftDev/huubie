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

    // Selects

    function lsProductos() {
        $query = "
            SELECT i.id, i.name AS valor, ia.unit_id
            FROM {$this->bd}item i
            LEFT JOIN {$this->bd}item_attribute ia ON ia.item_id = i.id AND ia.active = 1
            WHERE i.active = 1
            AND i.companies_id = ".$_SESSION['companies_id']."
            ORDER BY i.name ASC
        ";
        return $this->_Read($query, []);
    }

    function lsAlmacenes() {
        $query = "
            SELECT id, name AS valor, is_default
            FROM {$this->bd}warehouse
            WHERE active = 1
            AND companies_id = ".$_SESSION['companies_id']."
            ORDER BY is_default DESC, name ASC
        ";
        return $this->_Read($query, []);
    }

    // Existencia actual de un item en un almacén

    function getStockRow($array) {
        $query = "
            SELECT id, quantity
            FROM {$this->bd}stock
            WHERE item_id = ? AND warehouse_id = ? AND active = 1
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return $r[0] ?? null;
    }

    function insertStock($array) {
        $query = "
            INSERT INTO {$this->bd}stock (quantity, last_movement_at, warehouse_id, item_id, companies_id)
            VALUES (?, NOW(), ?, ?, ?)
        ";
        return $this->_CUD($query, $array);
    }

    function updateStockQty($array) {
        $query = "
            UPDATE {$this->bd}stock
            SET quantity = ?, last_movement_at = NOW(), updated_at = NOW()
            WHERE id = ?
        ";
        return $this->_CUD($query, $array);
    }

    // Folio incremental por tabla

    function nextFolio($prefix, $tabla) {
        $query = "
            SELECT folio
            FROM {$this->bd}{$tabla}
            WHERE companies_id = ? AND folio LIKE ?
            ORDER BY id DESC
            LIMIT 1
        ";
        $r = $this->_Read($query, [$_SESSION['companies_id'], $prefix . '%']);
        $next = 1;
        if (!empty($r)) {
            $num  = (int) preg_replace('/[^0-9]/', '', substr($r[0]['folio'], strlen($prefix)));
            $next = $num + 1;
        }
        return $prefix . str_pad($next, 4, '0', STR_PAD_LEFT);
    }

    function getMaxId($tabla) {
        $query = "SELECT MAX(id) AS id FROM {$this->bd}{$tabla}";
        $r = $this->_Read($query, []);
        return $r[0]['id'] ?? 0;
    }

    // Entradas

    function insertInflow($array) {
        $query = "
            INSERT INTO {$this->bd}inventory_inflow
                (folio, note, total_products, total_units, total_cost, date_inflow, status,
                 warehouse_id, user_id, subsidiaries_id, companies_id)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)
        ";
        return $this->_CUD($query, $array);
    }

    function insertInflowDetail($array) {
        $query = "
            INSERT INTO {$this->bd}detail_inventory_inflow
                (quantity, cost, subtotal, previous_stock, resulting_stock, item_id, inventory_inflow_id, unit_id)
            VALUES (?,?,?,?,?,?,?,?)
        ";
        return $this->_CUD($query, $array);
    }

    // Salidas

    function insertShrinkage($array) {
        $query = "
            INSERT INTO {$this->bd}inventory_shrinkage
                (folio, note, total_products, total_units, total_cost, date_shrinkage, status,
                 warehouse_id, user_id, subsidiaries_id, companies_id)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)
        ";
        return $this->_CUD($query, $array);
    }

    function insertShrinkageDetail($array) {
        $query = "
            INSERT INTO {$this->bd}detail_inventory_shrinkage
                (quantity, cost, subtotal, previous_stock, resulting_stock, item_id, inventory_shrinkage_id)
            VALUES (?,?,?,?,?,?,?)
        ";
        return $this->_CUD($query, $array);
    }

    // Kardex

    function insertMovement($array) {
        $query = "
            INSERT INTO {$this->bd}inventory_movement
                (movement_type, folio, quantity, stock_prev, stock_post, cost_unit, cost_total,
                 occurred_at, status, item_id, warehouse_id, user_id, subsidiaries_id, companies_id)
            VALUES (?,?,?,?,?,?,?,NOW(),?,?,?,?,?,?)
        ";
        return $this->_CUD($query, $array);
    }

    // Listados / reportes (kardex)

    function listMovimientos($array) {
        $query = "
            SELECT
                mv.id,
                mv.folio,
                DATE_FORMAT(mv.occurred_at, '%d/%m/%Y %H:%i') AS fecha,
                mv.movement_type AS tipo,
                i.name AS producto,
                mv.quantity,
                mv.stock_prev,
                mv.stock_post,
                mv.cost_total,
                mv.status,
                u.fullname AS responsable
            FROM {$this->bd}inventory_movement mv
            LEFT JOIN {$this->bd}item i ON i.id = mv.item_id
            LEFT JOIN fayxzvov_erp.users u ON u.id = mv.user_id
            WHERE DATE(mv.occurred_at) BETWEEN ? AND ?
            AND (? = 'Todos' OR mv.movement_type = ?)
            AND mv.companies_id = ".$_SESSION['companies_id']."
            ORDER BY mv.id DESC
        ";
        return $this->_Read($query, $array);
    }

    function getResumenStock() {
        $query = "
            SELECT
                COUNT(DISTINCT i.id) AS total_productos,
                COALESCE(SUM(t.qty), 0) AS total_unidades,
                COALESCE(SUM(t.qty * COALESCE(ia.cost_unit, 0)), 0) AS valor_inventario,
                SUM(CASE WHEN COALESCE(t.qty,0) <= COALESCE(ia.stock_min,0) THEN 1 ELSE 0 END) AS productos_bajos
            FROM {$this->bd}item i
            LEFT JOIN {$this->bd}item_attribute ia ON ia.item_id = i.id AND ia.active = 1
            LEFT JOIN (
                SELECT item_id, SUM(quantity) AS qty
                FROM {$this->bd}stock WHERE active = 1 GROUP BY item_id
            ) t ON t.item_id = i.id
            WHERE i.active = 1 AND i.companies_id = ".$_SESSION['companies_id']."
        ";
        $r = $this->_Read($query, []);
        return $r[0] ?? null;
    }

    function listProductosBajoStock($array) {
        $query = "
            SELECT
                i.id,
                i.name AS nombre,
                COALESCE(t.qty, 0) AS stock_actual,
                COALESCE(ia.stock_min, 0) AS minimo
            FROM {$this->bd}item i
            LEFT JOIN {$this->bd}item_attribute ia ON ia.item_id = i.id AND ia.active = 1
            LEFT JOIN (
                SELECT item_id, SUM(quantity) AS qty
                FROM {$this->bd}stock WHERE active = 1 GROUP BY item_id
            ) t ON t.item_id = i.id
            WHERE i.active = 1 AND i.companies_id = ".$_SESSION['companies_id']."
            AND COALESCE(t.qty, 0) <= COALESCE(ia.stock_min, 0)
            ORDER BY stock_actual ASC
        ";
        return $this->_Read($query, $array);
    }

    function listHistorialProducto($array) {
        $query = "
            SELECT
                mv.id,
                DATE_FORMAT(mv.occurred_at, '%d/%m/%Y %H:%i') AS fecha,
                mv.folio,
                mv.movement_type AS tipo,
                mv.quantity,
                mv.stock_prev,
                mv.stock_post
            FROM {$this->bd}inventory_movement mv
            WHERE mv.item_id = ?
            AND mv.companies_id = ".$_SESSION['companies_id']."
            ORDER BY mv.id DESC
        ";
        return $this->_Read($query, $array);
    }
}
