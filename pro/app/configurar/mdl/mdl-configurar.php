<?php
require_once __DIR__ . '/../../../core/database/_CRUD.php';
require_once __DIR__ . '/../../../core/helpers/_Utileria.php';

// Los datos con los que el dueño termina de dar de alta su empresa. Todo se
// pide y se escribe por la empresa y el usuario de la sesion.
class mdl extends CRUD {
    public $util;
    public $bd;

    public function __construct() {
        $this->util = new Utileria;
        // Sin prefijo: las tablas viven en la base del .env (DB_NAME).
        $this->bd   = '';
    }

    // [user_id, company_id]. La sucursal es la primera de la empresa: la
    // "Matriz" que se creo con el alta.
    function getSetup($array) {
        $query = "
            SELECT
                c.name, c.rfc, c.ubication, c.setup_done_at,
                u.name AS user_name, u.last_name,
                e.phone,
                b.id AS branch_id, b.name AS branch, b.ubication AS branch_ubication
            FROM {$this->bd}users u
            INNER JOIN {$this->bd}companies c ON c.id = ?
            LEFT JOIN {$this->bd}employees e  ON e.user_id = u.id
            LEFT JOIN {$this->bd}branches b   ON b.id = (
                SELECT MIN(b2.id) FROM {$this->bd}branches b2 WHERE b2.company_id = c.id AND b2.is_active = 1
            )
            WHERE u.id = ?
            LIMIT 1
        ";
        $r = $this->_Read($query, [$array[1], $array[0]]);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    // [name, rfc, ubication, id]. Marca la empresa como configurada.
    function updateCompany($array) {
        $query = "
            UPDATE {$this->bd}companies
               SET name = ?, rfc = ?, ubication = ?, setup_done_at = COALESCE(setup_done_at, NOW())
             WHERE id = ?
        ";
        return $this->_CUD($query, $array);
    }

    // [name, ubication, id, company_id]
    function updateBranch($array) {
        return $this->_CUD("UPDATE {$this->bd}branches SET name = ?, ubication = ? WHERE id = ? AND company_id = ?", $array);
    }

    // [name, last_name, id]
    function updateUser($array) {
        return $this->_CUD("UPDATE {$this->bd}users SET name = ?, last_name = ?, updated_at = NOW() WHERE id = ?", $array);
    }

    // [phone, user_id]
    function updatePhone($array) {
        return $this->_CUD("UPDATE {$this->bd}employees SET phone = ?, updated_at = NOW() WHERE user_id = ?", $array);
    }
}
