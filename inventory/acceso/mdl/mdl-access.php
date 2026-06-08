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

    function getSessionUser($array) {
        // [id usuario]
        $query = "
            SELECT
                u.id        AS id,
                TRIM(CONCAT(COALESCE(u.name, ''), ' ', COALESCE(u.last_name, ''))) AS user,
                u.email     AS email,
                u.photo     AS photo,
                u.is_owner  AS level,
                u.company_id AS company_id,
                c.name      AS company,
                u.branch_id AS branch_id,
                s.name      AS branch,
                r.name      AS rol
            FROM {$this->bd}users u
            LEFT JOIN {$this->bd}companies c ON c.id = u.company_id
            LEFT JOIN {$this->bd}branches s ON s.id = u.branch_id
            LEFT JOIN {$this->bd}users_braches ub ON ub.user_id = u.id
            LEFT JOIN {$this->bd}roles r ON r.id = ub.role_id
            WHERE u.id = ?
            LIMIT 1
        ";

        $result = $this->_Read($query, $array);
        return !empty($result) ? $result[0] : null;
    }

    function getUserByCredentials($array) {
        // [email]
        $query = "
            SELECT
                u.id         AS IDU,
                u.name       AS name,
                u.last_name  AS last_name,
                u.email      AS email,
                u.password   AS password,
                u.`key`      AS user_key,
                u.photo      AS photo,
                u.is_owner   AS is_owner,
                u.company_id AS company_id,
                c.name       AS company,
                u.branch_id  AS branch_id,
                b.name       AS branch
            FROM {$this->bd}users u
            LEFT JOIN {$this->bd}companies c ON c.id = u.company_id
            LEFT JOIN {$this->bd}branches b ON b.id = u.branch_id
            WHERE LOWER(u.email) = LOWER(?)
                AND u.status = 'active'
            LIMIT 1
        ";

        $result = $this->_Read($query, $array);
        return !empty($result) ? $result[0] : null;
    }
}
