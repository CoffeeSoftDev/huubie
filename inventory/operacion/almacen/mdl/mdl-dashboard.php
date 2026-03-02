<?php
require_once('../../../conf/_CRUD.php');

class Dashboard extends CRUD {

    protected $bd;

    public function __construct() {
        $this->bd = "fayxzvov_almacen.";
    }

    public function getTotalProductos() {
        $query = "SELECT COUNT(*) as total FROM {$this->bd}product WHERE active = 1 AND udn_id = ".$_SESSION['idUDN'];
        $result = $this->_Read($query, []);
        return $result[0]['total'] ?? 0;
    }

    public function getStockTotal() {
        $query = "SELECT COALESCE(SUM(quantity), 0) as total FROM {$this->bd}product WHERE active = 1 AND udn_id = ".$_SESSION['idUDN'];
        $result = $this->_Read($query, []);
        return $result[0]['total'] ?? 0;
    }

    public function getProductosBajos() {
        $query = "SELECT COUNT(*) as total
                  FROM {$this->bd}product
                  WHERE quantity <= min_stock AND quantity > 0 AND active = 1
                  AND udn_id = ".$_SESSION['idUDN'];
        $result = $this->_Read($query, []);
        return $result[0]['total'] ?? 0;
    }

    public function getValorInventario() {
        $query = "SELECT COALESCE(SUM(quantity * cost), 0) as total
                  FROM {$this->bd}product
                  WHERE active = 1 AND udn_id = ".$_SESSION['idUDN'];
        $result = $this->_Read($query, []);
        return $result[0]['total'] ?? 0;
    }

    public function getMovimientosRecientes() {
        $query = "SELECT
                    DATE_FORMAT(m.date, '%d/%m/%Y') as fecha,
                    p.name as producto,
                    mt.name as tipo,
                    d.quantity as cantidad
                  FROM {$this->bd}inventory_movement m
                  INNER JOIN {$this->bd}inventory_movement_detail d ON m.id = d.inventory_movement_id
                  INNER JOIN {$this->bd}product p ON d.product_id = p.id
                  LEFT JOIN {$this->bd}movement_type mt ON m.movement_type_id = mt.id
                  WHERE m.udn_id = ".$_SESSION['idUDN']."
                  ORDER BY m.date DESC
                  LIMIT 10";
        return $this->_Read($query, []);
    }

    public function getListaProductosBajos() {
        $query = "SELECT
                    name as nombre,
                    quantity as stock
                  FROM {$this->bd}product
                  WHERE quantity <= min_stock AND active = 1
                  AND udn_id = ".$_SESSION['idUDN']."
                  ORDER BY quantity ASC
                  LIMIT 5";
        return $this->_Read($query, []);
    }
}
