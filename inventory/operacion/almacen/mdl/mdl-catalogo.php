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

    function listCategory($array) {
        $query = "
            SELECT 
                idcategoria as id,
                nombreCategoria as valor,
                DATE_FORMAT(date_creation, '%d/%m/%Y') as date_creation,
                active
            FROM {$this->bd}mtto_categoria
            WHERE active = ?
            AND udn_id = ".$_SESSION['idUDN']."
            ORDER BY idcategoria DESC
        ";
        return $this->_Read($query, $array);
    }

    function getCategoryById($array) {
        $query = "
            SELECT *
            FROM {$this->bd}mtto_categoria
            WHERE idcategoria = ?
        ";
        $result = $this->_Read($query, $array);
        return $result[0] ?? null;
    }

    function createCategory($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}mtto_categoria",
            'values' => $array['values'],
            'data'   => $array['data']
        ]);
    }

    function updateCategory($array) {
        return $this->_Update([
            'table'  => "{$this->bd}mtto_categoria",
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data']
        ]);
    }

    function existsCategoryByName($array) {
        $query = "
            SELECT COUNT(*) as total
            FROM {$this->bd}mtto_categoria
            WHERE LOWER(nombreCategoria) = LOWER(?)
            AND active = 1
             AND udn_id = ".$_SESSION['idUDN']."
        ";
        $result = $this->_Read($query, $array);
        return $result[0]['total'] ?? 0;
    }

    // Area --

    function listArea($array) {
        $query = "
            SELECT 
                idArea as id,
                Nombre_Area as valor,
                DATE_FORMAT(date_creation, '%d/%m/%Y') as date_creation,
                active
            FROM {$this->bd}mtto_almacen_area
            WHERE active = ?
            AND udn_id = ".$_SESSION['idUDN']."
            
            ORDER BY idArea DESC
        ";
        return $this->_Read($query, $array);
    }

    function getAreaById($array) {
        $query = "
            SELECT *
            FROM {$this->bd}mtto_almacen_area
            WHERE idArea = ?
        ";
        $result = $this->_Read($query, $array);
        return $result[0] ?? null;
    }

    function createArea($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}mtto_almacen_area",
            'values' => $array['values'],
            'data'   => $array['data']
        ]);
    }

    function updateArea($array) {
        return $this->_Update([
            'table'  => "{$this->bd}mtto_almacen_area",
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data']
        ]);
    }



    function existsAreaByName($array) {
        $query = "
            SELECT COUNT(*) as total
            FROM {$this->bd}mtto_almacen_area
            WHERE LOWER(Nombre_Area) = LOWER(?)
            AND active = 1
            AND udn_id = ".$_SESSION['idUDN']."
        ";
        $result = $this->_Read($query, $array);
        return $result[0]['total'] ?? 0;
    }

    function listZone($array) {
        $query = "
            SELECT 
                id_zona as id,
                nombre_zona as valor,
                DATE_FORMAT(date_creation, '%d/%m/%Y') as date_creation,
                active
            FROM {$this->bd}mtto_almacen_zona
            WHERE active = ?
            AND udn_id = ".$_SESSION['idUDN']."
            ORDER BY id_zona DESC
        ";
        return $this->_Read($query, $array);
    }

    function getZoneById($array) {
        $query = "
            SELECT *
            FROM {$this->bd}mtto_almacen_zona
            WHERE id_zona = ?
        ";
        $result = $this->_Read($query, $array);
        return $result[0] ?? null;
    }

    function createZone($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}mtto_almacen_zona",
            'values' => $array['values'],
            'data'   => $array['data']
        ]);
    }

    function updateZone($array) {
        return $this->_Update([
            'table'  => "{$this->bd}mtto_almacen_zona",
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data']
        ]);
    }



    function existsZoneByName($array) {
        $query = "
            SELECT COUNT(*) as total
            FROM {$this->bd}mtto_almacen_zona
            WHERE LOWER(nombre_zona) = LOWER(?)
            AND active = 1
            AND udn_id = ".$_SESSION['idUDN']."
        ";
        $result = $this->_Read($query, $array);
        return $result[0]['total'] ?? 0;
    }
}
