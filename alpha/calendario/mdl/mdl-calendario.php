<?php
require_once('../../conf/_CRUD.php');
require_once('../../conf/_Utileria.php');
class MCalendario extends CRUD {
    protected $util;
    public function __construct() {
        $this->util = new Utileria;
    }
}
?>