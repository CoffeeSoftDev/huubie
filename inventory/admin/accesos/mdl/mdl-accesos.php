<?php
require_once '../../../conf/_CRUD.php';
require_once '../../../conf/_Utileria.php';

class mdl extends CRUD {

    public $util;
    public $bd;

    public function __construct() {
        $this->util = new Utileria;
        $this->bd   = 'fayxzvov_erp.';
    }

    /* ====================== Empresa ====================== */

    function qCompany($array) {
        $query = "SELECT id, name FROM {$this->bd}companies WHERE id = ? LIMIT 1";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    /* ====================== Sucursales ====================== */

    // Sucursales de la empresa filtradas por estado (para la tabla).
    function qSubsidiaries($array) {
        // $array = [companies_id, active]
        $query = "
            SELECT id, name, address, phone, is_main, active, companies_id
            FROM {$this->bd}subsidiaries
            WHERE companies_id = ? AND active = ?
            ORDER BY is_main DESC, name ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    // Sucursales activas de la empresa en formato {id, valor} para selects.
    function qSubsidiariesForSelect($array) {
        // $array = [companies_id]
        $query = "
            SELECT id, name AS valor
            FROM {$this->bd}subsidiaries
            WHERE companies_id = ? AND active = 1
            ORDER BY name ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    function qSubsidiary($array) {
        // $array = [id, companies_id]
        $query = "SELECT * FROM {$this->bd}subsidiaries WHERE id = ? AND companies_id = ? LIMIT 1";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    function qInsertSubsidiary($array) {
        // [name, address, phone, is_main, companies_id]
        $query = "
            INSERT INTO {$this->bd}subsidiaries (name, address, phone, is_main, companies_id)
            VALUES (?, ?, ?, ?, ?)
        ";
        return $this->_CUD($query, $array);
    }

    function qUpdateSubsidiary($array) {
        // [name, address, phone, is_main, id, companies_id]
        $query = "
            UPDATE {$this->bd}subsidiaries
            SET name = ?, address = ?, phone = ?, is_main = ?
            WHERE id = ? AND companies_id = ?
        ";
        return $this->_CUD($query, $array);
    }

    function qSetSubsidiaryActive($array) {
        // [active, id, companies_id]
        $query = "UPDATE {$this->bd}subsidiaries SET active = ? WHERE id = ? AND companies_id = ?";
        return $this->_CUD($query, $array);
    }

    /* ====================== Usuarios ====================== */

    function qUsers($array) {
        // $array = [companies_id, active]
        $query = "
            SELECT
                u.id,
                u.fullname,
                u.username,
                u.email,
                u.phone,
                u.active,
                u.subsidiaries_id,
                DATE_FORMAT(u.last_login_at, '%d/%m/%Y %H:%i') AS last_login,
                s.name AS subsidiary_name
            FROM {$this->bd}users u
            LEFT JOIN {$this->bd}subsidiaries s ON s.id = u.subsidiaries_id
            WHERE u.companies_id = ? AND u.active = ?
            ORDER BY u.fullname ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    function qUser($array) {
        // [id, companies_id]
        $query = "
            SELECT id, fullname, username, email, phone, subsidiaries_id, active
            FROM {$this->bd}users
            WHERE id = ? AND companies_id = ?
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    function qUsernameExists($array) {
        // [username, companies_id]
        $query = "SELECT id FROM {$this->bd}users WHERE LOWER(username) = LOWER(?) AND companies_id = ?";
        $r = $this->_Read($query, $array);
        return is_array($r) && count($r) > 0;
    }

    function qUsernameExistsExcept($array) {
        // [username, companies_id, id]
        $query = "SELECT id FROM {$this->bd}users WHERE LOWER(username) = LOWER(?) AND companies_id = ? AND id <> ?";
        $r = $this->_Read($query, $array);
        return is_array($r) && count($r) > 0;
    }

    function qInsertUser($array) {
        // [fullname, username, email, phone, password, role_id, subsidiaries_id, companies_id]
        $query = "
            INSERT INTO {$this->bd}users
                (fullname, username, email, phone, password, role_id, subsidiaries_id, companies_id)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ";
        return $this->_CUD($query, $array);
    }

    function qUpdateUser($array) {
        // [fullname, username, email, phone, subsidiaries_id, id, companies_id]
        $query = "
            UPDATE {$this->bd}users
            SET fullname = ?, username = ?, email = ?, phone = ?, subsidiaries_id = ?
            WHERE id = ? AND companies_id = ?
        ";
        return $this->_CUD($query, $array);
    }

    function qUpdateUserPassword($array) {
        // [password, id, companies_id]
        $query = "UPDATE {$this->bd}users SET password = ? WHERE id = ? AND companies_id = ?";
        return $this->_CUD($query, $array);
    }

    function qSetUserActive($array) {
        // [active, id, companies_id]
        $query = "UPDATE {$this->bd}users SET active = ? WHERE id = ? AND companies_id = ?";
        return $this->_CUD($query, $array);
    }
}
