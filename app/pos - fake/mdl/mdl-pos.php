<?php
require_once '../../conf/_CRUD.php';
require_once '../../conf/_Utileria.php';

class mdl extends CRUD {
    public $util;
    public $bd;

    public function __construct() {
        $this->util = new Utileria;
        $this->bd   = 'rfwsmqex_pos.';
    }

    function listPos() {
        return $this->_Select([
            'table'  => "{$this->bd}pos",
            'values' => '*',
            'where'  => '1'
        ]);
    }
}
