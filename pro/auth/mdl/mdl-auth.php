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
                u.login_attempts,
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

    function addLoginAttempt($array) {
        $query = "UPDATE {$this->bd}users SET login_attempts = login_attempts + 1 WHERE id = ?";
        return $this->_CUD($query, $array);
    }

    function resetLoginAttempts($array) {
        $query = "UPDATE {$this->bd}users SET login_attempts = 0 WHERE id = ?";
        return $this->_CUD($query, $array);
    }

    // Recuperar contraseña:

    // reset_vigente lo resuelve MySQL con su NOW(): el reloj que pone la
    // caducidad (setResetCode) y el que la revisa es uno solo.
    function getUserForReset($array) {
        $query = "
            SELECT
                u.id,
                u.name,
                u.email,
                u.reset_code,
                u.reset_tries,
                (u.reset_expires IS NOT NULL AND u.reset_expires > NOW()) AS reset_vigente
            FROM {$this->bd}users u
            WHERE LOWER(u.email) = LOWER(?)
                AND u.status = 'active'
            LIMIT 1
        ";

        $sql = $this->_Read($query, $array);
        return empty($sql) ? null : $sql[0];
    }

    // [hash del codigo, minutos de vigencia, id]
    function setResetCode($array) {
        $query = "
            UPDATE {$this->bd}users
               SET reset_code    = ?,
                   reset_expires = DATE_ADD(NOW(), INTERVAL ? MINUTE),
                   reset_tries   = 0
             WHERE id = ?
        ";
        return $this->_CUD($query, $array);
    }

    function addResetTry($array) {
        $query = "UPDATE {$this->bd}users SET reset_tries = reset_tries + 1 WHERE id = ?";
        return $this->_CUD($query, $array);
    }

    function clearResetCode($array) {
        $query = "
            UPDATE {$this->bd}users
               SET reset_code    = NULL,
                   reset_expires = NULL,
                   reset_tries   = 0
             WHERE id = ?
        ";
        return $this->_CUD($query, $array);
    }

    // [password bcrypt, id]. El codigo se gasta y la cuenta se desbloquea en el
    // mismo UPDATE: quien llega aqui casi siempre venia de quedarse fuera.
    function setNewPassword($array) {
        $query = "
            UPDATE {$this->bd}users
               SET password       = ?,
                   reset_code     = NULL,
                   reset_expires  = NULL,
                   reset_tries    = 0,
                   login_attempts = 0
             WHERE id = ?
        ";
        return $this->_CUD($query, $array);
    }
}
?>
