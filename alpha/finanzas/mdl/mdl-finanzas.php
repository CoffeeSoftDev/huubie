<?php
require_once('../../conf/_CRUD.php');
require_once('../../conf/_Utileria.php');

class mdl extends CRUD {
    public $util;
    public $bd;

    public function __construct() {
        $this->util = new Utileria;
        $this->bd   = "fayxzvov_rrhh.";
    }

    function lsSubsidiaries() {
        $query = "
            SELECT id, name AS valor
            FROM {$this->bd}subsidiaries
            WHERE active = 1
            ORDER BY name
        ";
        return $this->_Read($query);
    }
}
