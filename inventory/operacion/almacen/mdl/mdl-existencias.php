<?php
require_once '../../../conf/_CRUD.php';
require_once '../../../conf/_Utileria.php';
session_start();

class mdl extends CRUD {
    protected $util;
    public $bd;

    public function __construct() {
        $this->util = new Utileria;
        $this->bd = "fayxzvov_almacen.";
    }

    // Selects para filtros

    function lsZonas() {
        $query = "
            SELECT id, name AS valor
            FROM {$this->bd}areas
            WHERE active = 1 and
            udn_id = ".$_SESSION['idUDN']."
            ORDER BY name ASC
        ";
        return $this->_Read($query, []);
    }

    function lsCategorias() {
        $query = "
            SELECT id, name AS valor
            FROM {$this->bd}presentations
            WHERE active = 1  and
            udn_id = ".$_SESSION['idUDN']."
            ORDER BY name ASC
        ";
        return $this->_Read($query, []);
    }

    function lsAreas() {
        $query = "
            SELECT id, name AS valor
            FROM {$this->bd}product_groups
            WHERE active = 1 AND udn_id = ".$_SESSION['idUDN']."
            ORDER BY name ASC
        ";
        return $this->_Read($query, []);
    }

    // Existencias

    function listExistencias($filters) {
        $whereConditions = ['a.udn_id = '.$_SESSION['idUDN']];
        $params = [];

        if (!empty($filters['zona']) && $filters['zona'] != 'Todos') {
            $whereConditions[] = 'a.area_id = ?';
            $params[] = $filters['zona'];
        }

        if (!empty($filters['area']) && $filters['area'] != 'Todos') {
            $whereConditions[] = 'a.group_id = ?';
            $params[] = $filters['area'];
        }

        if (!empty($filters['categoria']) && $filters['categoria'] != 'Todos') {
            $whereConditions[] = 'a.presentations_id = ?';
            $params[] = $filters['categoria'];
        }

        if (!empty($filters['estatus']) && $filters['estatus'] != 'Todos') {
            switch ($filters['estatus']) {
                case 'disponible':
                    $whereConditions[] = 'a.quantity > a.min_stock';
                    break;
                case 'bajo':
                    $whereConditions[] = 'a.quantity <= a.min_stock AND a.quantity > 0';
                    break;
                case 'agotado':
                    $whereConditions[] = 'a.quantity = 0';
                    break;
            }
        }

        $whereClause = implode(' AND ', $whereConditions);

        $query = "
            SELECT
                a.id,
                a.name as producto,
                c.name as presentacion,
                a.min_stock as inventario_min,
                a.cost as Costo,
                a.price as PrecioVenta,
                a.quantity as cantidad,
                (SELECT MAX(m.date)
                 FROM {$this->bd}inventory_movement m
                 INNER JOIN {$this->bd}inventory_movement_detail d ON m.id = d.inventory_movement_id
                 LEFT JOIN {$this->bd}movement_type mt ON m.movement_type_id = mt.id
                 WHERE d.product_id = a.id AND mt.name = 'Entrada'
                ) as fecha_mayoreo,
                (SELECT d.previous_stock
                 FROM {$this->bd}inventory_movement_detail d
                 INNER JOIN {$this->bd}inventory_movement m ON d.inventory_movement_id = m.id
                 WHERE d.product_id = a.id
                 ORDER BY m.date ASC LIMIT 1
                ) as stock_inicial,
                z.name as zona,
                ar.name as area
            FROM {$this->bd}product a
            LEFT JOIN {$this->bd}presentations c ON a.presentations_id = c.id
            LEFT JOIN {$this->bd}areas z ON a.area_id = z.id
            LEFT JOIN {$this->bd}product_groups ar ON a.group_id = ar.id
            WHERE $whereClause

            ORDER BY a.name ASC
        ";

        return $this->_Read($query, $params);
    }

    function getResumen($filters) {
        $whereConditions = ['a.udn_id = '.$_SESSION['idUDN']];
        $params = [];

        if (!empty($filters['zona']) && $filters['zona'] != 'Todos') {
            $whereConditions[] = 'a.area_id = ?';
            $params[] = $filters['zona'];
        }

        if (!empty($filters['area']) && $filters['area'] != 'Todos') {
            $whereConditions[] = 'a.group_id = ?';
            $params[] = $filters['area'];
        }

        if (!empty($filters['categoria']) && $filters['categoria'] != 'Todos') {
            $whereConditions[] = 'a.presentations_id = ?';
            $params[] = $filters['categoria'];
        }

        $whereClause = implode(' AND ', $whereConditions);

        $query = "
            SELECT
                COUNT(*) as total,
                SUM(CASE WHEN a.quantity > a.min_stock THEN 1 ELSE 0 END) as disponibles,
                SUM(CASE WHEN a.quantity <= a.min_stock AND a.quantity > 0 THEN 1 ELSE 0 END) as stock_bajo,
                SUM(CASE WHEN a.quantity = 0 THEN 1 ELSE 0 END) as agotados,
                SUM(a.quantity * a.cost) as valor_total
            FROM {$this->bd}product a
            WHERE $whereClause
        ";

        return $this->_Read($query, $params);
    }

    function getProductoById($id) {
        $query = "
            SELECT
                a.*,
                c.name as categoria_nombre,
                z.name as zona_nombre,
                ar.name as area_nombre
            FROM {$this->bd}product a
            LEFT JOIN {$this->bd}presentations c ON a.presentations_id = c.id
            LEFT JOIN {$this->bd}areas z ON a.area_id = z.id
            LEFT JOIN {$this->bd}product_groups ar ON a.group_id = ar.id
            WHERE a.id = ? AND a.udn_id = ".$_SESSION['idUDN']."
        ";
        $result = $this->_Read($query, [$id]);
        return $result[0] ?? null;
    }
}
