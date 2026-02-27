<?php
require_once 'conf/_CRUD.php';
require_once 'conf/_Utileria.php';


class Routes extends CRUD {
    protected $util;
    public $bd;

    public function __construct() {
        $this->util = new Utileria;
        $this->bd = "fayxzvov_admin.";
    }

    function getRoutesByCompany($array){
        $query = "
            SELECT module_id, name, route, file_path
            FROM {$this->bd}module_company
            INNER JOIN {$this->bd}modules ON modules.id = module_id
            WHERE company_id = ?
        ";
        return $this->_Read($query, $array);
    }
}
