<?php
require_once __DIR__ . '/../../core/database/_CRUD.php';
require_once __DIR__ . '/../../core/helpers/_Utileria.php';

class mdl extends CRUD {
    public $util;
    public $bd;

    public function __construct() {
        $this->util = new Utileria;
        // Sin prefijo: las tablas de acceso viven en la base del .env (DB_NAME),
        // asi el nombre de la base se cambia en un solo sitio.
        $this->bd   = '';
    }

    function getUserByEmail($array) {
        $query = "
            SELECT
                u.id,
                u.name,
                u.last_name,
                u.email,
                u.password,
                u.photo,
                u.color,
                u.is_owner,
                u.company_id,
                u.branch_id,
                c.name   AS company,
                c.status AS company_status
            FROM {$this->bd}users u
            LEFT JOIN {$this->bd}companies c ON c.id = u.company_id
            WHERE LOWER(u.email) = LOWER(?)
                AND u.status = 'active'
            LIMIT 1
        ";

        $sql = $this->_Read($query, $array);
        return empty($sql) ? null : $sql[0];
    }

    // root es el rol del sistema: basta tenerlo en cualquier sucursal y no
    // depende de la empresa del usuario.
    function getRootRole($array) {
        $query = "
            SELECT r.id, r.name
            FROM {$this->bd}users_braches ub
            INNER JOIN {$this->bd}roles r ON r.id = ub.role_id AND r.is_active = 1
            WHERE ub.user_id = ?
                AND r.code = 'root'
            LIMIT 1
        ";

        $sql = $this->_Read($query, $array);
        return empty($sql) ? null : $sql[0];
    }

    // [user_id, company_id, is_owner]. El dueño entra a todas las sucursales
    // activas de su empresa; los demas solo a las que tienen con un rol activo.
    function listBranchesByUser($array) {
        $query = "
            SELECT
                b.id,
                b.name,
                ub.role_id,
                r.name AS rol
            FROM {$this->bd}branches b
            LEFT JOIN {$this->bd}users_braches ub ON ub.branch_id = b.id AND ub.user_id = ?
            LEFT JOIN {$this->bd}roles r ON r.id = ub.role_id AND r.is_active = 1
            WHERE b.company_id = ?
                AND b.is_active = 1
                AND (? = 1 OR r.id IS NOT NULL)
            ORDER BY b.name ASC
        ";

        return $this->_Read($query, $array);
    }
}
?>
