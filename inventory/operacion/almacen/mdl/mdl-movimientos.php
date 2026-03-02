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

        $mes       = $array[0];
        $anio      = $array[1];
        $zona      = $array[2];
        $area      = $array[3];
        $categoria = $array[4];

        $whereConditions = [];
        $params = [$mes, $anio];

        if ($zona != 'Todos') {
            $whereConditions[] = 'a.area_id = ?';
            $params[] = $zona;
        }

        if ($area != 'Todos') {
            $whereConditions[] = 'a.group_id = ?';
            $params[] = $area;
        }

        if ($categoria != 'Todos') {
            $whereConditions[] = 'a.presentations_id = ?';
            $params[] = $categoria;
        }

        $whereExtra = count($whereConditions) > 0 ? 'AND ' . implode(' AND ', $whereConditions) : '';

        $query = "
            SELECT
                m.id as id_movimiento,
                m.folio,
                DATE_FORMAT(m.date, '%d/%m/%Y') as fecha,
                mt.name as tipo_movimiento,
                m.total_products as total_productos,
                m.total_units as total_unidades,
                m.status as estado,
                m.created_at as fecha_creacion,
                m.user_id,
                d.id as id_detalle,
                d.product_id as id_producto,
                d.quantity as cantidad,
                d.previous_stock as stock_anterior,
                d.resulting_stock as stock_resultante,
                a.id as idAlmacen,
                a.code,
                a.name as nombre_producto,
                a.presentations_id,
                a.area_id,
                a.group_id,
                COALESCE(cat.name, 'Sin categoría') AS nombre_grupo,
                COALESCE(z.name, 'Sin zona') AS nombre_zona,
                COALESCE(ar.name, 'Sin área') AS nombre_area
            FROM {$this->bd}inventory_movement m
            LEFT JOIN {$this->bd}movement_type mt ON m.movement_type_id = mt.id
            INNER JOIN {$this->bd}inventory_movement_detail d ON m.id = d.inventory_movement_id
            INNER JOIN {$this->bd}product a ON d.product_id = a.id
            LEFT JOIN {$this->bd}presentations cat ON a.presentations_id = cat.id
            LEFT JOIN {$this->bd}areas z ON a.area_id = z.id
            LEFT JOIN {$this->bd}product_groups ar ON a.group_id = ar.id
            WHERE
            m.udn_id = ".$_SESSION['idUDN']."
            and MONTH(m.date) = ?
            AND YEAR(m.date) = ?
            $whereExtra
            ORDER BY m.date DESC, m.id DESC
        ";

        return $this->_Read($query, $params);
    }

    function getResumenMovimientos($array) {
        $mes       = $array[0];
        $anio      = $array[1];
        $zona      = $array[2];
        $area      = $array[3];
        $categoria = $array[4];

        $whereConditions = [];
        $params = [$mes, $anio];

        if ($zona != 'Todos') {
            $whereConditions[] = 'a.area_id = ?';
            $params[] = $zona;
        }

        if ($area != 'Todos') {
            $whereConditions[] = 'a.group_id = ?';
            $params[] = $area;
        }

        if ($categoria != 'Todos') {
            $whereConditions[] = 'a.presentations_id = ?';
            $params[] = $categoria;
        }

        $whereExtra = count($whereConditions) > 0 ? 'AND ' . implode(' AND ', $whereConditions) : '';

        $query = "
            SELECT
                mt.name as tipo_movimiento,
                COUNT(DISTINCT m.id) as total_movimientos,
                SUM(d.quantity) as total_unidades
            FROM {$this->bd}inventory_movement m
            LEFT JOIN {$this->bd}movement_type mt ON m.movement_type_id = mt.id
            INNER JOIN {$this->bd}inventory_movement_detail d ON m.id = d.inventory_movement_id
            INNER JOIN {$this->bd}product a ON d.product_id = a.id
            LEFT JOIN {$this->bd}presentations cat ON a.presentations_id = cat.id
            LEFT JOIN {$this->bd}areas z ON a.area_id = z.id
            LEFT JOIN {$this->bd}product_groups ar ON a.group_id = ar.id
            WHERE
             m.udn_id = ".$_SESSION['idUDN']."
            AND MONTH(m.date) = ?
            AND YEAR(m.date) = ?
            $whereExtra
            GROUP BY mt.name
        ";

        return $this->_Read($query, $params);
    }

    function lsCategorias() {
        $query = "
            SELECT
                id,
                name as valor
            FROM {$this->bd}presentations
        ";
        return $this->_Read($query, []);
    }

    function lsMeses() {
        return [
            ['id' => '1', 'valor' => 'Enero'],
            ['id' => '2', 'valor' => 'Febrero'],
            ['id' => '3', 'valor' => 'Marzo'],
            ['id' => '4', 'valor' => 'Abril'],
            ['id' => '5', 'valor' => 'Mayo'],
            ['id' => '6', 'valor' => 'Junio'],
            ['id' => '7', 'valor' => 'Julio'],
            ['id' => '8', 'valor' => 'Agosto'],
            ['id' => '9', 'valor' => 'Septiembre'],
            ['id' => '10', 'valor' => 'Octubre'],
            ['id' => '11', 'valor' => 'Noviembre'],
            ['id' => '12', 'valor' => 'Diciembre']
        ];
    }

    function lsAnios() {
        $anioActual = date('Y');
        $anios = [];

        for ($i = 0; $i < 5; $i++) {
            $anio = $anioActual - $i;
            $anios[] = ['id' => $anio, 'valor' => $anio];
        }

        return $anios;
    }
}
