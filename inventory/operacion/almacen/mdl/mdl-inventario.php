<?php
require_once '../../../conf/_CRUD.php';
require_once '../../../conf/_Utileria.php';


class mdl extends CRUD {
    protected $util;
    public $bd;

    public function __construct() {
        $this->util = new Utileria;
        $this->bd = "fayxzvov_almacen.";
    }

    function listMovimientos($array) {
        $query = "
            SELECT
                m.id as id_movimiento,
                m.folio,
                DATE_FORMAT(m.date, '%d/%m/%Y') as fecha,
                mt.name as tipo_movimiento,
                m.total_products as total_productos,
                m.total_units as total_unidades,
                m.status as estado,
                m.user_id,
                usser as responsable,
                DATE_FORMAT(m.created_at, '%d/%m/%Y %H:%i') as fecha_creacion
            FROM {$this->bd}inventory_movement m
            LEFT JOIN {$this->bd}movement_type mt ON m.movement_type_id = mt.id
            LEFT JOIN fayxzvov_erp.usuarios ON fayxzvov_erp.usuarios.idUser = m.user_id
            WHERE m.date BETWEEN ? AND ?
            AND (? = 'Todos' OR mt.name = ?)
            AND m.udn_id = ".$_SESSION['idUDN']."
            ORDER BY m.id DESC
        ";
        return $this->_Read($query, $array);
    }

    function getMovimientoById($id) {
        $query = "
            SELECT m.*, mt.name as tipo_movimiento
            FROM {$this->bd}inventory_movement m
            LEFT JOIN {$this->bd}movement_type mt ON m.movement_type_id = mt.id
            WHERE m.id = ?
        ";
        $result = $this->_Read($query, [$id]);
        return $result[0] ?? null;
    }

    function getMaxFolio($array) {
        $query = "
            SELECT COUNT(*) as max_numero
            FROM {$this->bd}inventory_movement
            WHERE
                udn_id = ?
        ";
        $result = $this->_Read($query,$array);

        return $result[0]['max_numero'] ?? 0;
    }

    function createMovimiento($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}inventory_movement",
            'values' => $array['values'],
            'data'   => $array['data']
        ]);
    }

    function getMaxMovimientoId() {
        $query = "
            SELECT MAX(id) AS id_movimiento
            FROM {$this->bd}inventory_movement
        ";
        $result = $this->_Read($query, []);
        return $result[0]['id_movimiento'] ?? 0;
    }

    function updateMovimiento($array) {
        return $this->_Update([
            'table'  => "{$this->bd}inventory_movement",
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data']
        ]);
    }

    function listDetalleMovimiento($array) {
        $query = "
            SELECT
                d.id as id_detalle,
                d.inventory_movement_id as id_movimiento,
                d.product_id as id_producto,
                a.name as nombre_producto,
                d.quantity as cantidad,
                d.previous_stock as stock_anterior,
                d.resulting_stock as stock_resultante,
                a.quantity as stock_actual
            FROM {$this->bd}inventory_movement_detail d
            INNER JOIN {$this->bd}product a ON d.product_id = a.id
            WHERE d.inventory_movement_id = ?
            ORDER BY d.id ASC
        ";
        return $this->_Read($query, $array);
    }

    function createDetalleMovimiento($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}inventory_movement_detail",
            'values' => $array['values'],
            'data'   => $array['data']
        ]);
    }

    function deleteDetalleMovimientoById($array) {
        return $this->_Delete([
            'table' => "{$this->bd}inventory_movement_detail",
            'where' => $array['where'],
           'data'  => $array['data']
        ]);
    }

    function getStockProducto($idProducto) {
        $query = "
            SELECT quantity as stock_actual
            FROM {$this->bd}product
            WHERE id = ?
        ";
        $result = $this->_Read($query, [$idProducto]);
        return $result[0]['stock_actual'] ?? 0;
    }

    function updateStockProducto($array) {
        return $this->_Update([
            'table'  => "{$this->bd}product",
            'values' => $array['values'],
            'where'  => 'id = ?',
            'data'   => $array['data']
        ]);
    }

    function lsTipoMovimiento() {
        $query = "
            SELECT id, name as valor
            FROM {$this->bd}movement_type
            ORDER BY id ASC
        ";
        return $this->_Read($query, []);
    }

    function lsProductos() {
        $query = "
            SELECT
                id,
                name as valor,
                quantity as stock_actual
            FROM {$this->bd}product
            WHERE active = 1
            ORDER BY name ASC
        ";
        return $this->_Read($query, []);
    }

    function getResumenStock() {
        $query = "
            SELECT
                COUNT(*) as total_productos,
                COALESCE(SUM(quantity), 0) as total_unidades,
                COALESCE(SUM(quantity * cost), 0) as valor_inventario,
                (SELECT COUNT(*) FROM {$this->bd}product WHERE quantity <= 5 AND active = 1) as productos_bajos
            FROM {$this->bd}product
            WHERE active = 1
        ";
        $result = $this->_Read($query, []);
        return $result[0] ?? null;
    }

    function listProductosBajoStock($array) {
        $query = "
            SELECT
                id,
                name as nombre,
                quantity as stock_actual,
                cost
            FROM {$this->bd}product
            WHERE quantity <= ? AND active = 1
            ORDER BY quantity ASC
        ";
        return $this->_Read($query, $array);
    }

    function listHistorialProducto($array) {
        $query = "
            SELECT
                d.id as id_detalle,
                d.quantity as cantidad,
                d.previous_stock as stock_anterior,
                d.resulting_stock as stock_resultante,
                m.folio,
                mt.name as tipo_movimiento,
                DATE_FORMAT(m.date, '%d/%m/%Y') as fecha
            FROM {$this->bd}inventory_movement_detail d
            INNER JOIN {$this->bd}inventory_movement m ON d.inventory_movement_id = m.id
            LEFT JOIN {$this->bd}movement_type mt ON m.movement_type_id = mt.id
            WHERE d.product_id = ?
            AND m.status = 'Activa'
            ORDER BY m.date DESC, d.id DESC
        ";
        return $this->_Read($query, $array);
    }

    function getDetalleById($id) {
        $query = "
            SELECT
                d.*,
                d.inventory_movement_id as id_movimiento,
                d.product_id as id_producto,
                d.quantity as cantidad,
                d.previous_stock as stock_anterior,
                d.resulting_stock as stock_resultante
            FROM {$this->bd}inventory_movement_detail d
            WHERE d.id = ?
        ";
        $result = $this->_Read($query, [$id]);
        return $result[0] ?? null;
    }

    function updateDetalleMovimiento($array) {
        return $this->_Update([
            'table'  => "{$this->bd}inventory_movement_detail",
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data']
        ]);
    }
}
