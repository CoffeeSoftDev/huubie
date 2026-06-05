<?php
require_once '../../../conf/_CRUD.php';
require_once '../../../conf/_Utileria.php';

class mdl extends CRUD {
    protected $util;
    public $bd;

    public function __construct() {
        $this->util = new Utileria;
        $this->bd = "fayxzvov_inventory.";
    }

    // Categoría -> item_category

    function listCategory($array) {
        $query = "
            SELECT
                id,
                name as valor,
                DATE_FORMAT(created_at, '%d/%m/%Y') as date_creation,
                active
            FROM {$this->bd}item_category
            WHERE active = ?
            AND companies_id = ".$_SESSION['companies_id']."
            ORDER BY id DESC
        ";
        return $this->_Read($query, $array);
    }

    function getCategoryById($array) {
        $query = "
            SELECT *
            FROM {$this->bd}item_category
            WHERE id = ?
        ";
        $result = $this->_Read($query, $array);
        return $result[0] ?? null;
    }

    function createCategory($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}item_category",
            'values' => $array['values'],
            'data'   => $array['data']
        ]);
    }

    function updateCategory($array) {
        return $this->_Update([
            'table'  => "{$this->bd}item_category",
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data']
        ]);
    }

    function existsCategoryByName($array) {
        $query = "
            SELECT COUNT(*) as total
            FROM {$this->bd}item_category
            WHERE LOWER(name) = LOWER(?)
            AND active = 1
            AND companies_id = ".$_SESSION['companies_id']."
        ";
        $result = $this->_Read($query, $array);
        return $result[0]['total'] ?? 0;
    }

    // Área -> warehouse_area

    function listArea($array) {
        $query = "
            SELECT
                id,
                name as valor,
                description,
                color_hex,
                DATE_FORMAT(created_at, '%d/%m/%Y') as date_creation,
                active
            FROM {$this->bd}warehouse_area
            WHERE active = ?
            AND companies_id = ".$_SESSION['companies_id']."
            ORDER BY id DESC
        ";
        return $this->_Read($query, $array);
    }

    function getAreaById($array) {
        $query = "
            SELECT *
            FROM {$this->bd}warehouse_area
            WHERE id = ?
        ";
        $result = $this->_Read($query, $array);
        return $result[0] ?? null;
    }

    function createArea($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}warehouse_area",
            'values' => $array['values'],
            'data'   => $array['data']
        ]);
    }

    function updateArea($array) {
        return $this->_Update([
            'table'  => "{$this->bd}warehouse_area",
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data']
        ]);
    }

    function existsAreaByName($array) {
        $query = "
            SELECT COUNT(*) as total
            FROM {$this->bd}warehouse_area
            WHERE LOWER(name) = LOWER(?)
            AND active = 1
            AND companies_id = ".$_SESSION['companies_id']."
        ";
        $result = $this->_Read($query, $array);
        return $result[0]['total'] ?? 0;
    }

    // Unidad -> unit

    function listZone($array) {
        $query = "
            SELECT
                id,
                code,
                name as valor,
                DATE_FORMAT(created_at, '%d/%m/%Y') as date_creation,
                active
            FROM {$this->bd}unit
            WHERE active = ?
            AND companies_id = ".$_SESSION['companies_id']."
            ORDER BY id DESC
        ";
        return $this->_Read($query, $array);
    }

    function getZoneById($array) {
        $query = "
            SELECT *
            FROM {$this->bd}unit
            WHERE id = ?
        ";
        $result = $this->_Read($query, $array);
        return $result[0] ?? null;
    }

    function createZone($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}unit",
            'values' => $array['values'],
            'data'   => $array['data']
        ]);
    }

    function updateZone($array) {
        return $this->_Update([
            'table'  => "{$this->bd}unit",
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data']
        ]);
    }

    function existsZoneByName($array) {
        $query = "
            SELECT COUNT(*) as total
            FROM {$this->bd}unit
            WHERE LOWER(name) = LOWER(?)
            AND active = 1
            AND companies_id = ".$_SESSION['companies_id']."
        ";
        $result = $this->_Read($query, $array);
        return $result[0]['total'] ?? 0;
    }
}
