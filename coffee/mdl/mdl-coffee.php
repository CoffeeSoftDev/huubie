<?php
require_once '../../conf/_CRUD.php';
require_once '../../conf/_Utileria.php';

class mdl extends CRUD {

    public $util;
    public $bd;

    function __construct() {
        parent::__construct();
        $this->util = new Utileria();
        $this->bd = "rfwsmqex_coffee.";
    }

    function listCoffee($array) {
        $query = "
            SELECT id, name, description, notes, created_at
            FROM {$this->bd}coffee
            WHERE DATE(created_at) BETWEEN ? AND ?
            ORDER BY id DESC
        ";
        return $this->_Read($query, $array);
    }

    function getCoffeeById($array) {
        $query = "
            SELECT *
            FROM {$this->bd}coffee
            WHERE id = ?
        ";
        return $this->_Read($query, $array);
    }

    function createCoffee($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}coffee",
            'values' => $array['values'],
            'data'   => $array['data']
        ]);
    }

    function updateCoffee($array) {
        return $this->_Update([
            'table'  => "{$this->bd}coffee",
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data'],
        ]);
    }

    function deleteCoffeeById($array) {
        return $this->_Delete([
            'table' => "{$this->bd}coffee",
            'where' => $array['where'],
            'data'  => $array['data'],
        ]);
    }
}