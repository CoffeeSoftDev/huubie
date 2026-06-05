<?php
require_once('../../../conf/_CRUD.php');

class Dashboard extends CRUD {

    protected $bd;

    public function __construct() {
        $this->bd = "fayxzvov_inventory.";
    }

    public function getTotalProductos() {
        $query = "SELECT COUNT(*) as total FROM {$this->bd}item WHERE active = 1 AND companies_id = ".$_SESSION['companies_id'];
        $result = $this->_Read($query, []);
        return $result[0]['total'] ?? 0;
    }

    public function getStockTotal() {
        $query = "
            SELECT COALESCE(SUM(st.quantity), 0) as total
            FROM {$this->bd}stock st
            INNER JOIN {$this->bd}item i ON i.id = st.item_id
            WHERE st.active = 1 AND i.active = 1
            AND i.companies_id = ".$_SESSION['companies_id'];
        $result = $this->_Read($query, []);
        return $result[0]['total'] ?? 0;
    }

    public function getProductosBajos() {
        $query = "
            SELECT COUNT(*) as total FROM (
                SELECT
                    i.id,
                    COALESCE(t.qty, 0) AS qty,
                    COALESCE(ia.stock_min, 0) AS min
                FROM {$this->bd}item i
                LEFT JOIN {$this->bd}item_attribute ia ON ia.item_id = i.id AND ia.active = 1
                LEFT JOIN (
                    SELECT item_id, SUM(quantity) AS qty
                    FROM {$this->bd}stock WHERE active = 1 GROUP BY item_id
                ) t ON t.item_id = i.id
                WHERE i.active = 1 AND i.companies_id = ".$_SESSION['companies_id']."
                HAVING qty <= min AND qty > 0
            ) x
        ";
        $result = $this->_Read($query, []);
        return $result[0]['total'] ?? 0;
    }

    public function getValorInventario() {
        $query = "
            SELECT COALESCE(SUM(st.quantity * COALESCE(ia.cost_unit, 0)), 0) as total
            FROM {$this->bd}stock st
            INNER JOIN {$this->bd}item i ON i.id = st.item_id
            LEFT JOIN {$this->bd}item_attribute ia ON ia.item_id = i.id AND ia.active = 1
            WHERE st.active = 1 AND i.active = 1
            AND i.companies_id = ".$_SESSION['companies_id'];
        $result = $this->_Read($query, []);
        return $result[0]['total'] ?? 0;
    }

    public function getMovimientosRecientes() {
        $query = "
            SELECT
                DATE_FORMAT(mv.occurred_at, '%d/%m/%Y') as fecha,
                i.name as producto,
                mv.movement_type as tipo,
                mv.quantity as cantidad
            FROM {$this->bd}inventory_movement mv
            INNER JOIN {$this->bd}item i ON i.id = mv.item_id
            WHERE mv.companies_id = ".$_SESSION['companies_id']."
            ORDER BY mv.id DESC
            LIMIT 10
        ";
        return $this->_Read($query, []);
    }

    public function getListaProductosBajos() {
        $query = "
            SELECT
                i.name as nombre,
                COALESCE(t.qty, 0) as stock
            FROM {$this->bd}item i
            LEFT JOIN {$this->bd}item_attribute ia ON ia.item_id = i.id AND ia.active = 1
            LEFT JOIN (
                SELECT item_id, SUM(quantity) AS qty
                FROM {$this->bd}stock WHERE active = 1 GROUP BY item_id
            ) t ON t.item_id = i.id
            WHERE i.active = 1 AND i.companies_id = ".$_SESSION['companies_id']."
            AND COALESCE(t.qty, 0) <= COALESCE(ia.stock_min, 0)
            ORDER BY stock ASC
            LIMIT 5
        ";
        return $this->_Read($query, []);
    }
}
