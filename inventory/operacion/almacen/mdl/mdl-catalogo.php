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

    function listCategory($array) {
        $query = "
            SELECT
                id,
                name as valor,
                DATE_FORMAT(created_at, '%d/%m/%Y') as date_creation,
                active
            FROM {$this->bd}presentations
            WHERE active = ?
            AND udn_id = ".$_SESSION['idUDN']."
            ORDER BY id DESC
        ";
        return $this->_Read($query, $array);
    }

    function getCategoryById($array) {
        $query = "
            SELECT *
            FROM {$this->bd}presentations
            WHERE id = ?
        ";
        $result = $this->_Read($query, $array);
        return $result[0] ?? null;
    }

    function createCategory($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}presentations",
            'values' => $array['values'],
            'data'   => $array['data']
        ]);
    }

    function updateCategory($array) {
        return $this->_Update([
            'table'  => "{$this->bd}presentations",
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data']
        ]);
    }

    function existsCategoryByName($array) {
        $query = "
            SELECT COUNT(*) as total
            FROM {$this->bd}presentations
            WHERE LOWER(name) = LOWER(?)
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
                id,
                name as valor,
                DATE_FORMAT(created_at, '%d/%m/%Y') as date_creation,
                active
            FROM {$this->bd}product_groups
            WHERE active = ?
            AND udn_id = ".$_SESSION['idUDN']."

            ORDER BY id DESC
        ";
        return $this->_Read($query, $array);
    }

    function getAreaById($array) {
        $query = "
            SELECT *
            FROM {$this->bd}product_groups
            WHERE id = ?
        ";
        $result = $this->_Read($query, $array);
        return $result[0] ?? null;
    }

    function createArea($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}product_groups",
            'values' => $array['values'],
            'data'   => $array['data']
        ]);
    }

    function updateArea($array) {
        return $this->_Update([
            'table'  => "{$this->bd}product_groups",
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data']
        ]);
    }



    function existsAreaByName($array) {
        $query = "
            SELECT COUNT(*) as total
            FROM {$this->bd}product_groups
            WHERE LOWER(name) = LOWER(?)
            AND active = 1
            AND udn_id = ".$_SESSION['idUDN']."
        ";
        $result = $this->_Read($query, $array);
        return $result[0]['total'] ?? 0;
    }

    function listZone($array) {
        $query = "
            SELECT
                id,
                name as valor,
                DATE_FORMAT(created_at, '%d/%m/%Y') as date_creation,
                active
            FROM {$this->bd}areas
            WHERE active = ?
            AND udn_id = ".$_SESSION['idUDN']."
            ORDER BY id DESC
        ";
        return $this->_Read($query, $array);
    }

    function getZoneById($array) {
        $query = "
            SELECT *
            FROM {$this->bd}areas
            WHERE id = ?
        ";
        $result = $this->_Read($query, $array);
        return $result[0] ?? null;
    }

    function createZone($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}areas",
            'values' => $array['values'],
            'data'   => $array['data']
        ]);
    }

    function updateZone($array) {
        return $this->_Update([
            'table'  => "{$this->bd}areas",
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data']
        ]);
    }



    function existsZoneByName($array) {
        $query = "
            SELECT COUNT(*) as total
            FROM {$this->bd}areas
            WHERE LOWER(name) = LOWER(?)
            AND active = 1
            AND udn_id = ".$_SESSION['idUDN']."
        ";
        $result = $this->_Read($query, $array);
        return $result[0]['total'] ?? 0;
    }
}
