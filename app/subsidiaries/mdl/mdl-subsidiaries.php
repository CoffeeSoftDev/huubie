<?php
require_once '../../conf/_CRUD.php';
require_once '../../conf/_Utileria.php';

class mdl extends CRUD {
    protected $util;

    public function __construct() {
        $this->util = new Utileria;
    }

    function getBranchesByUser($array) {
        $query = "
            SELECT subsidiaries.id, subsidiaries.name, subsidiaries.ubication, subsidiaries.active, subsidiaries.logo
            FROM usr_user_subsidiaries
            INNER JOIN subsidiaries ON subsidiaries.id = usr_user_subsidiaries.subsidiaries_id
            WHERE usr_user_subsidiaries.usr_users_id = ?
                AND subsidiaries.enabled = 1
            ORDER BY subsidiaries.active DESC, subsidiaries.name ASC
        ";
        return $this->_Read($query, $array);
    }

    function getBranchesByCompany($array) {
        $query = "
            SELECT id, name, ubication, active, logo
            FROM subsidiaries
            WHERE companies_id = ?
                AND enabled = 1
            ORDER BY active DESC, name ASC
        ";
        return $this->_Read($query, $array);
    }
}
