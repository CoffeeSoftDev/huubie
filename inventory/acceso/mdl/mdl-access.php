<?php
require_once '../../conf/_CRUD.php';
require_once '../../conf/_Utileria.php';

class MAccess extends CRUD {
    protected $util;
    public $bd;

    public function __construct() {
        $this->util = new Utileria;
        $this->bd = "fayxzvov_erp.";
    }

    function getUserByData($array) {
        $query = "
            SELECT 
                u.id,
                u.user,
                u.key,
                u.fullname,
                u.photo,
                u.rol,
                u.rol_id,
                u.sucursal,
                u.active,
                c.company,
                c.DB,
                c.ubication,
                c.logo,
                c.id as company_id
            FROM users u
            LEFT JOIN companies c ON u.company_id = c.id
            WHERE u.user = ?
            AND u.active = 1
        ";
        
        $result = $this->_Read($query, $array);
        return !empty($result) ? $result[0] : null;
    }

    function getUserById($array) {
        $query = "
            SELECT 
                id,
                user,
                fullname,
                photo,
                rol,
                rol_id
            FROM users
            WHERE id = ?
        ";
        
        $result = $this->_Read($query, $array);
        return !empty($result) ? $result[0] : null;
    }
}
