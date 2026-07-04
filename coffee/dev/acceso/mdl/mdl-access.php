<?php
require_once '../../conf/_CRUD.php';
require_once '../../conf/_Utileria.php';

class MAccess extends CRUD {
    protected $util;
    public $bd;

    public function __construct() {
        $this->util = new Utileria;
        $this->bd = "rfwsmqex_gv_erp.";
    }

    function getUserByCredentials($array) {
        // [email]
        $query = "
            SELECT
                u.id         AS id,
                u.name       AS name,
                u.last_name  AS last_name,
                u.email      AS email,
                u.password   AS password,
                u.photo      AS photo,
                u.is_owner   AS is_owner,
                u.active     AS active,
                c.id         AS company_id,
                c.name       AS company,
                b.id         AS branch_id,
                b.name       AS branch
            FROM {$this->bd}users u
            LEFT JOIN {$this->bd}companies c ON c.id = u.company_id
            LEFT JOIN {$this->bd}branches b ON b.id = u.branch_id
            WHERE LOWER(u.email) = LOWER(?)
                AND u.active = 1
            LIMIT 1
        ";

        $result = $this->_Read($query, $array);
        return !empty($result) ? $result[0] : null;
    }
}
