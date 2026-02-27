<?php
require_once('../../../conf/_CRUD.php');

class Dashboard extends CRUD {
    
    public function getTotalProductos() {
        $query = "SELECT COUNT(*) as total FROM productos WHERE estado = 1";
        $result = $this->_Read($query, []);
        return $result[0]['total'] ?? 0;
    }
    
    public function getStockTotal() {
        $query = "SELECT SUM(cantidad) as total FROM inventario";
        $result = $this->_Read($query, []);
        return $result[0]['total'] ?? 0;
    }
    
    public function getProductosBajos() {
        $query = "SELECT COUNT(*) as total 
                  FROM inventario i 
                  INNER JOIN productos p ON i.idProducto = p.idProducto 
                  WHERE i.cantidad <= p.stockMinimo";
        $result = $this->_Read($query, []);
        return $result[0]['total'] ?? 0;
    }
    
    public function getValorInventario() {
        $query = "SELECT SUM(i.cantidad * p.precio) as total 
                  FROM inventario i 
                  INNER JOIN productos p ON i.idProducto = p.idProducto";
        $result = $this->_Read($query, []);
        return $result[0]['total'] ?? 0;
    }
    
    public function getMovimientosRecientes() {
        $query = "SELECT 
                    DATE_FORMAT(m.fecha, '%d/%m/%Y') as fecha,
                    p.nombre as producto,
                    m.tipo,
                    m.cantidad
                  FROM movimientos m
                  INNER JOIN productos p ON m.idProducto = p.idProducto
                  ORDER BY m.fecha DESC
                  LIMIT 10";
        return $this->_Read($query, []);
    }
    
    public function getListaProductosBajos() {
        $query = "SELECT 
                    p.nombre,
                    i.cantidad as stock
                  FROM inventario i
                  INNER JOIN productos p ON i.idProducto = p.idProducto
                  WHERE i.cantidad <= p.stockMinimo
                  ORDER BY i.cantidad ASC
                  LIMIT 5";
        return $this->_Read($query, []);
    }
}
