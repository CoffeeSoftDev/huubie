<?php
require_once '../../../conf/_CRUD.php';
require_once '../../../conf/_Utileria.php';
session_start();

class mdl extends CRUD {
    protected $util;
    public $bd;

    public function __construct() {
        $this->util = new Utileria;
        $this->bd = "fayxzvov_mtto.";
    }

    // Selects para filtros

    function lsZonas() {
        $query = "
            SELECT id_zona as id, nombre_zona AS valor
            FROM {$this->bd}mtto_almacen_zona
            WHERE active = 1 and
            udn_id = ".$_SESSION['idUDN']."
            ORDER BY nombre_zona ASC
        ";
        return $this->_Read($query, []);
    }

    function lsCategorias() {
        $query = "
            SELECT idcategoria as id, nombreCategoria AS valor
            FROM {$this->bd}mtto_categoria
            WHERE active = 1  and
            udn_id = ".$_SESSION['idUDN']."
            ORDER BY nombreCategoria ASC
        ";
        return $this->_Read($query, []);
    }

    function lsAreas() {
        $query = "
            SELECT idArea as id, nombre_area AS valor
            FROM {$this->bd}mtto_almacen_area
            WHERE active = 1 AND udn_id = ".$_SESSION['idUDN']."
            ORDER BY nombre_area ASC
        ";
        return $this->_Read($query, []);
    }

    // Existencias

    function listExistencias($filters) {
        $whereConditions = ['a.UDN_Almacen = '.$_SESSION['idUDN']];
        $params = [];

        if (!empty($filters['zona']) && $filters['zona'] != 'Todos') {
            $whereConditions[] = 'a.id_zona = ?';
            $params[] = $filters['zona'];
        }

        if (!empty($filters['area']) && $filters['area'] != 'Todos') {
            $whereConditions[] = 'a.Area = ?';
            $params[] = $filters['area'];
        }

        if (!empty($filters['categoria']) && $filters['categoria'] != 'Todos') {
            $whereConditions[] = 'a.id_categoria = ?';
            $params[] = $filters['categoria'];
        }

        if (!empty($filters['estatus']) && $filters['estatus'] != 'Todos') {
            switch ($filters['estatus']) {
                case 'disponible':
                    $whereConditions[] = 'a.cantidad > a.inventario_min';
                    break;
                case 'bajo':
                    $whereConditions[] = 'a.cantidad <= a.inventario_min AND a.cantidad > 0';
                    break;
                case 'agotado':
                    $whereConditions[] = 'a.cantidad = 0';
                    break;
            }
        }

        $whereClause = implode(' AND ', $whereConditions);

        $query = "
            SELECT 
                a.idAlmacen as id,
                a.Equipo as producto,
                c.nombreCategoria as presentacion,
                a.inventario_min,
                a.Costo,
                a.PrecioVenta,
                a.cantidad,
                (SELECT MAX(m.fecha) 
                 FROM {$this->bd}mtto_inventario_movimientos m 
                 INNER JOIN {$this->bd}mtto_inventario_detalle d ON m.id_movimiento = d.id_movimiento 
                 WHERE d.id_producto = a.idAlmacen AND m.tipo_movimiento = 'Entrada'
                ) as fecha_mayoreo,
                (SELECT d.stock_anterior 
                 FROM {$this->bd}mtto_inventario_detalle d 
                 INNER JOIN {$this->bd}mtto_inventario_movimientos m ON d.id_movimiento = m.id_movimiento
                 WHERE d.id_producto = a.idAlmacen 
                 ORDER BY m.fecha ASC LIMIT 1
                ) as stock_inicial,
                z.nombre_zona as zona,
                ar.nombre_area as area
            FROM {$this->bd}mtto_almacen a
            LEFT JOIN {$this->bd}mtto_categoria c ON a.id_categoria = c.idcategoria
            LEFT JOIN {$this->bd}mtto_almacen_zona z ON a.id_zona = z.id_zona
            LEFT JOIN {$this->bd}mtto_almacen_area ar ON a.Area = ar.idArea
            WHERE $whereClause
            
            ORDER BY a.Equipo ASC
        ";

        return $this->_Read($query, $params);
    }

    function getResumen($filters) {
        $whereConditions = ['a.UDN_Almacen = '.$_SESSION['idUDN']];
        $params = [];

        if (!empty($filters['zona']) && $filters['zona'] != 'Todos') {
            $whereConditions[] = 'a.id_zona = ?';
            $params[] = $filters['zona'];
        }

        if (!empty($filters['area']) && $filters['area'] != 'Todos') {
            $whereConditions[] = 'a.Area = ?';
            $params[] = $filters['area'];
        }

        if (!empty($filters['categoria']) && $filters['categoria'] != 'Todos') {
            $whereConditions[] = 'a.id_categoria = ?';
            $params[] = $filters['categoria'];
        }

        $whereClause = implode(' AND ', $whereConditions);

        $query = "
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN a.cantidad > a.inventario_min THEN 1 ELSE 0 END) as disponibles,
                SUM(CASE WHEN a.cantidad <= a.inventario_min AND a.cantidad > 0 THEN 1 ELSE 0 END) as stock_bajo,
                SUM(CASE WHEN a.cantidad = 0 THEN 1 ELSE 0 END) as agotados,
                SUM(a.cantidad * a.Costo) as valor_total
            FROM {$this->bd}mtto_almacen a
            WHERE $whereClause
        ";

        return $this->_Read($query, $params);
    }

    function getProductoById($id) {
        $query = "
            SELECT 
                a.*,
                c.nombreCategoria as categoria_nombre,
                z.nombre_zona as zona_nombre,
                ar.nombre_area as area_nombre
            FROM {$this->bd}mtto_almacen a
            LEFT JOIN {$this->bd}mtto_categoria c ON a.id_categoria = c.idcategoria
            LEFT JOIN {$this->bd}mtto_almacen_zona z ON a.id_zona = z.id_zona
            LEFT JOIN {$this->bd}mtto_almacen_area ar ON a.Area = ar.idArea
            WHERE a.idAlmacen = ? AND a.UDN_Almacen = ".$_SESSION['idUDN']."
        ";
        $result = $this->_Read($query, [$id]);
        return $result[0] ?? null;
    }
}
