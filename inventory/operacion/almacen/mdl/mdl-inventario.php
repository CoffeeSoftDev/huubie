<?php
require_once '../../../conf/_CRUD.php';
require_once '../../../conf/_Utileria.php';


class mdl extends CRUD {
    protected $util;
    public $bd;

    public function __construct() {
        $this->util = new Utileria;
        $this->bd = "fayxzvov_mtto.";
    }

    function listMovimientos($array) {
        $query = "
            SELECT 
                id_movimiento,
                folio,
                DATE_FORMAT(fecha, '%d/%m/%Y') as fecha,
                tipo_movimiento,
                total_productos,
                total_unidades,
                estado,
                user_id,
                usser as responsable,
                DATE_FORMAT(fecha_creacion, '%d/%m/%Y %H:%i') as fecha_creacion
            FROM {$this->bd}mtto_inventario_movimientos
            LEFT JOIN fayxzvov_erp.usuarios ON fayxzvov_erp.usuarios.idUser = user_id
            WHERE fecha BETWEEN ? AND ?
            AND (? = 'Todos' OR tipo_movimiento = ?)
            AND udn_id = ".$_SESSION['idUDN']."
            ORDER BY id_movimiento DESC
        ";
        return $this->_Read($query, $array);
    }

    function getMovimientoById($id) {
        $query = "
            SELECT *
            FROM {$this->bd}mtto_inventario_movimientos
            WHERE id_movimiento = ?
        ";
        $result = $this->_Read($query, [$id]);
        return $result[0] ?? null;
    }

    function getMaxFolio($array) {
        $query = "
            SELECT COUNT(*) as max_numero
            FROM {$this->bd}mtto_inventario_movimientos
            WHERE 
                udn_id = ?
        ";
        $result = $this->_Read($query,$array);
       
        return $result[0]['max_numero'] ?? 0;
    }

    function createMovimiento($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}mtto_inventario_movimientos",
            'values' => $array['values'],
            'data'   => $array['data']
        ]);
    }

    function getMaxMovimientoId() {
        $query = "
            SELECT MAX(id_movimiento) AS id_movimiento
            FROM {$this->bd}mtto_inventario_movimientos
        ";
        $result = $this->_Read($query, []);
        return $result[0]['id_movimiento'] ?? 0;
    }

    function updateMovimiento($array) {
        return $this->_Update([
            'table'  => "{$this->bd}mtto_inventario_movimientos",
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data']
        ]);
    }

    function listDetalleMovimiento($array) {
        $query = "
            SELECT 
                d.id_detalle,
                d.id_movimiento,
                d.id_producto,
                a.Equipo as nombre_producto,
                d.cantidad,
                d.stock_anterior,
                d.stock_resultante,
                a.cantidad as stock_actual
            FROM {$this->bd}mtto_inventario_detalle d
            INNER JOIN {$this->bd}mtto_almacen a ON d.id_producto = a.idAlmacen
            WHERE d.id_movimiento = ?
            ORDER BY d.id_detalle ASC
        ";
        return $this->_Read($query, $array);
    }

    function createDetalleMovimiento($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}mtto_inventario_detalle",
            'values' => $array['values'],
            'data'   => $array['data']
        ]);
    }

    function deleteDetalleMovimientoById($array) {
        return $this->_Delete([
            'table' => "{$this->bd}mtto_inventario_detalle",
            'where' => $array['where'],
           'data'  => $array['data']
        ]);
    }

    function getStockProducto($idProducto) {
        $query = "
            SELECT cantidad as stock_actual
            FROM {$this->bd}mtto_almacen
            WHERE idAlmacen = ?
        ";
        $result = $this->_Read($query, [$idProducto]);
        return $result[0]['stock_actual'] ?? 0;
    }

    function updateStockProducto($array) {
        return $this->_Update([
            'table'  => "{$this->bd}mtto_almacen",
            'values' => $array['values'],
            'where'  => 'idAlmacen = ?',
            'data'   => $array['data']
        ]);
    }

    function lsTipoMovimiento() {
        $query = "
            SELECT 'Entrada' as id, 'Entrada' as valor
            UNION ALL
            SELECT 'Salida' as id, 'Salida' as valor
        ";
        return $this->_Read($query, []);
    }

    function lsProductos() {
        $query = "
            SELECT 
                idAlmacen as id,
                Equipo as valor,
                cantidad as stock_actual
            FROM {$this->bd}mtto_almacen
            WHERE Estado = 1
            ORDER BY Equipo ASC
        ";
        return $this->_Read($query, []);
    }

    function getResumenStock() {
        $query = "
            SELECT 
                COUNT(*) as total_productos,
                COALESCE(SUM(cantidad), 0) as total_unidades,
                COALESCE(SUM(cantidad * Costo), 0) as valor_inventario,
                (SELECT COUNT(*) FROM {$this->bd}mtto_almacen WHERE cantidad <= 5 AND Estado = 1) as productos_bajos
            FROM {$this->bd}mtto_almacen
            WHERE Estado = 1
        ";
        $result = $this->_Read($query, []);
        return $result[0] ?? null;
    }

    function listProductosBajoStock($array) {
        $query = "
            SELECT 
                idAlmacen as id,
                Equipo as nombre,
                cantidad as stock_actual,
                Costo
            FROM {$this->bd}mtto_almacen
            WHERE cantidad <= ? AND Estado = 1
            ORDER BY cantidad ASC
        ";
        return $this->_Read($query, $array);
    }

    function listHistorialProducto($array) {
        $query = "
            SELECT 
                d.id_detalle,
                d.cantidad,
                d.stock_anterior,
                d.stock_resultante,
                m.folio,
                m.tipo_movimiento,
                DATE_FORMAT(m.fecha, '%d/%m/%Y') as fecha
            FROM {$this->bd}mtto_inventario_detalle d
            INNER JOIN {$this->bd}mtto_inventario_movimientos m ON d.id_movimiento = m.id_movimiento
            WHERE d.id_producto = ?
            AND m.estado = 'Activa'
            ORDER BY m.fecha DESC, d.id_detalle DESC
        ";
        return $this->_Read($query, $array);
    }

    function getDetalleById($id) {
        $query = "
            SELECT *
            FROM {$this->bd}mtto_inventario_detalle
            WHERE id_detalle = ?
        ";
        $result = $this->_Read($query, [$id]);
        return $result[0] ?? null;
    }

    function updateDetalleMovimiento($array) {
        return $this->_Update([
            'table'  => "{$this->bd}mtto_inventario_detalle",
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data']
        ]);
    }
}
