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
        
        $mes       = $array[0];
        $anio      = $array[1];
        $zona      = $array[2];
        $area      = $array[3];
        $categoria = $array[4];

        $whereConditions = [];
        $params = [$mes, $anio];

        if ($zona != 'Todos') {
            $whereConditions[] = 'a.id_zona = ?';
            $params[] = $zona;
        }

        if ($area != 'Todos') {
            $whereConditions[] = 'a.Area = ?';
            $params[] = $area;
        }

        if ($categoria != 'Todos') {
            $whereConditions[] = 'a.id_categoria = ?';
            $params[] = $categoria;
        }

        $whereExtra = count($whereConditions) > 0 ? 'AND ' . implode(' AND ', $whereConditions) : '';

        $query = "
            SELECT 
                m.id_movimiento,
                m.folio,
                DATE_FORMAT(m.fecha, '%d/%m/%Y') as fecha,
                m.tipo_movimiento,
                m.total_productos,
                m.total_unidades,
                m.estado,
                m.fecha_creacion,
                m.user_id,
                d.id_detalle,
                d.id_producto,
                d.cantidad,
                d.stock_anterior,
                d.stock_resultante,
                a.idAlmacen,
                a.CodigoEquipo,
                a.Equipo as nombre_producto,
                a.id_categoria,
                a.id_zona,
                a.Area,
                COALESCE(cat.nombreCategoria, 'Sin categoría') AS nombre_grupo,
                COALESCE(z.nombre_zona, 'Sin zona') AS nombre_zona,
                COALESCE(ar.nombre_area, 'Sin área') AS nombre_area
            FROM {$this->bd}mtto_inventario_movimientos m
            INNER JOIN {$this->bd}mtto_inventario_detalle d ON m.id_movimiento = d.id_movimiento
            INNER JOIN {$this->bd}mtto_almacen a ON d.id_producto = a.idAlmacen
            LEFT JOIN {$this->bd}mtto_categoria cat ON a.id_categoria = cat.idcategoria
            LEFT JOIN {$this->bd}mtto_almacen_zona z ON a.id_zona = z.id_zona
            LEFT JOIN {$this->bd}mtto_almacen_area ar ON a.Area = ar.idArea
            WHERE
            m.udn_id = ".$_SESSION['idUDN']."
            and MONTH(m.fecha) = ? 
            AND YEAR(m.fecha) = ?
            $whereExtra
            ORDER BY m.fecha DESC, m.id_movimiento DESC
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
            $whereConditions[] = 'a.id_zona = ?';
            $params[] = $zona;
        }

        if ($area != 'Todos') {
            $whereConditions[] = 'a.Area = ?';
            $params[] = $area;
        }

        if ($categoria != 'Todos') {
            $whereConditions[] = 'a.id_categoria = ?';
            $params[] = $categoria;
        }

        $whereExtra = count($whereConditions) > 0 ? 'AND ' . implode(' AND ', $whereConditions) : '';

        $query = "
            SELECT 
                m.tipo_movimiento,
                COUNT(DISTINCT m.id_movimiento) as total_movimientos,
                SUM(d.cantidad) as total_unidades
            FROM {$this->bd}mtto_inventario_movimientos m
            INNER JOIN {$this->bd}mtto_inventario_detalle d ON m.id_movimiento = d.id_movimiento
            INNER JOIN {$this->bd}mtto_almacen a ON d.id_producto = a.idAlmacen
            LEFT JOIN {$this->bd}mtto_categoria cat ON a.id_categoria = cat.idcategoria
            LEFT JOIN {$this->bd}mtto_almacen_zona z ON a.id_zona = z.id_zona
            LEFT JOIN {$this->bd}mtto_almacen_area ar ON a.Area = ar.idArea
            WHERE 
             m.udn_id = ".$_SESSION['idUDN']."
            AND MONTH(m.fecha) = ? 
            AND YEAR(m.fecha) = ?
            $whereExtra
            GROUP BY m.tipo_movimiento
        ";
        
        return $this->_Read($query, $params);
    }

    function lsCategorias() {
        $query = "
            SELECT  
                idcategoria AS id,
                nombreCategoria as valor
            FROM {$this->bd}mtto_categoria  
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
