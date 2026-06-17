<?php
require_once '../../conf/_CRUD.php';
require_once '../../conf/_Utileria.php';

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

    /* ====================== Sucursales (branches) ====================== */

    // Sucursales de la empresa filtradas por estado (para la tabla).
    function qBranches($array) {
        // [company_id, is_active]
        $query = "
            SELECT id, name, ubication, logo, is_active, company_id
            FROM {$this->bd}branches
            WHERE company_id = ? AND is_active = ?
            ORDER BY name ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    // Sucursales activas de la empresa en formato {id, valor} para selects.
    function qBranchesForSelect($array) {
        // [company_id]
        $query = "
            SELECT id, name AS valor
            FROM {$this->bd}branches
            WHERE company_id = ? AND is_active = 1
            ORDER BY name ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    function qBranch($array) {
        // [id, company_id]
        $query = "
            SELECT id, name, ubication, logo, is_active, company_id
            FROM {$this->bd}branches
            WHERE id = ? AND company_id = ?
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    function qInsertBranch($array) {
        // [name, ubication, company_id]
        $query = "
            INSERT INTO {$this->bd}branches (name, ubication, company_id, is_active, created_at)
            VALUES (?, ?, ?, 1, NOW())
        ";
        return $this->_CUD($query, $array);
    }

    function qUpdateBranch($array) {
        // [name, ubication, id, company_id]
        $query = "
            UPDATE {$this->bd}branches
            SET name = ?, ubication = ?
            WHERE id = ? AND company_id = ?
        ";
        return $this->_CUD($query, $array);
    }

    function qSetBranchActive($array) {
        // [is_active, id, company_id]
        $query = "UPDATE {$this->bd}branches SET is_active = ? WHERE id = ? AND company_id = ?";
        return $this->_CUD($query, $array);
    }

    /* ====================== Usuarios ====================== */

    function qUsers($array) {
        // [company_id, status]
        $query = "
            SELECT
                u.id,
                u.name,
                u.last_name,
                u.email,
                u.status,
                u.is_owner,
                u.branch_id,
                u.color,
                DATE_FORMAT(u.created_at, '%d/%m/%Y %H:%i') AS created,
                b.name AS branch_name,
                (
                    SELECT GROUP_CONCAT(DISTINCT br.name ORDER BY br.name ASC SEPARATOR ', ')
                    FROM {$this->bd}users_braches ub
                    INNER JOIN {$this->bd}branches br ON br.id = ub.branch_id
                    WHERE ub.user_id = u.id
                ) AS branch_names
            FROM {$this->bd}users u
            LEFT JOIN {$this->bd}branches b ON b.id = u.branch_id
            WHERE u.company_id = ? AND u.status = ?
            ORDER BY u.name ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    function qUser($array) {
        // [id, company_id]
        $query = "
            SELECT id, name, last_name, email, branch_id, is_owner, status, color
            FROM {$this->bd}users
            WHERE id = ? AND company_id = ?
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    function qUserBranchIds($array) {
        // [user_id]
        $query = "
            SELECT branch_id
            FROM {$this->bd}users_braches
            WHERE user_id = ?
            ORDER BY branch_id ASC
        ";
        $r = $this->_Read($query, $array);
        if (!is_array($r) || empty($r)) return [];
        return array_column($r, 'branch_id');
    }

    function qEmailExists($array) {
        // [email, company_id]
        $query = "SELECT id FROM {$this->bd}users WHERE LOWER(email) = LOWER(?) AND company_id = ?";
        $r = $this->_Read($query, $array);
        return is_array($r) && count($r) > 0;
    }

    function qEmailExistsExcept($array) {
        // [email, company_id, id]
        $query = "SELECT id FROM {$this->bd}users WHERE LOWER(email) = LOWER(?) AND company_id = ? AND id <> ?";
        $r = $this->_Read($query, $array);
        return is_array($r) && count($r) > 0;
    }

    function qInsertUser($array) {
        // [name, last_name, email, password, key, branch_id, company_id, color]
        $query = "
            INSERT INTO {$this->bd}users
                (name, last_name, email, password, `key`, branch_id, company_id, color, status, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active', NOW())
        ";
        return $this->_CUD($query, $array);
    }

    function qLastInsertId() {
        $r = $this->_Read("SELECT LAST_INSERT_ID() AS id", []);
        return (is_array($r) && !empty($r)) ? (int) $r[0]['id'] : 0;
    }

    function qUpdateUser($array) {
        // [name, last_name, email, branch_id, color, id, company_id]
        $query = "
            UPDATE {$this->bd}users
            SET name = ?, last_name = ?, email = ?, branch_id = ?, color = ?, updated_at = NOW()
            WHERE id = ? AND company_id = ?
        ";
        return $this->_CUD($query, $array);
    }

    function qDeleteUserBranches($array) {
        // [user_id]
        $query = "DELETE FROM {$this->bd}users_braches WHERE user_id = ?";
        return $this->_CUD($query, $array);
    }

    function qInsertUserBranch($array) {
        // [user_id, branch_id]
        $query = "
            INSERT INTO {$this->bd}users_braches (user_id, branch_id, role_id)
            VALUES (?, ?, NULL)
        ";
        return $this->_CUD($query, $array);
    }

    function qUpdateUserPassword($array) {
        // [password, key, id, company_id]
        $query = "UPDATE {$this->bd}users SET password = ?, `key` = ? WHERE id = ? AND company_id = ?";
        return $this->_CUD($query, $array);
    }

    function qSetUserStatus($array) {
        // [status, id, company_id]
        $query = "UPDATE {$this->bd}users SET status = ? WHERE id = ? AND company_id = ?";
        return $this->_CUD($query, $array);
    }
}
