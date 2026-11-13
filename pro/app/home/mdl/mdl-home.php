<?php
require_once __DIR__ . '/../../../core/database/_CRUD.php';
require_once __DIR__ . '/../../../core/helpers/_Utileria.php';

/*  Lo que enseña el inicio de una empresa. Todo se pide por company_id: nada
    de aqui cruza de una empresa a otra.

    Las personas salen de employees (Capital Humano) y no de users: el equipo
    de una empresa incluye a quien no tiene cuenta. El nombre es el de su
    cuenta cuando la tiene y employees.full_name cuando no. */
class mdl extends CRUD {
    public $util;
    public $bd;

    // Como se nombra a un empleado, tenga cuenta o no.
    const EMPLOYEE_NAME = "TRIM(COALESCE(NULLIF(TRIM(CONCAT(COALESCE(u.name, ''), ' ', COALESCE(u.last_name, ''))), ''), e.full_name, ''))";

    public function __construct() {
        $this->util = new Utileria;
        // Sin prefijo: las tablas viven en la base del .env (DB_NAME).
        $this->bd   = '';
    }

    function getCompanyById($array) {
        $query = "
            SELECT
                c.id,
                c.name,
                c.ubication,
                c.status,
                (SELECT COUNT(*) FROM {$this->bd}branches b WHERE b.company_id = c.id AND b.is_active = 1)     AS branches,
                (SELECT COUNT(*) FROM {$this->bd}users u    WHERE u.company_id = c.id AND u.status = 'active') AS users
            FROM {$this->bd}companies c
            WHERE c.id = ?
            LIMIT 1
        ";

        $sql = $this->_Read($query, $array);
        return empty($sql) ? null : $sql[0];
    }

    function getUserById($array) {
        $query = "
            SELECT u.id, u.name, u.last_name, u.email, u.photo, u.color
            FROM {$this->bd}users u
            WHERE u.id = ?
            LIMIT 1
        ";

        $sql = $this->_Read($query, $array);
        return empty($sql) ? null : $sql[0];
    }

    // A quien acudir dentro de la empresa: su dueño.
    function getOwnerByCompany($array) {
        $query = "
            SELECT
                u.id,
                TRIM(CONCAT(COALESCE(u.name, ''), ' ', COALESCE(u.last_name, ''))) AS name,
                u.email,
                u.photo,
                u.color,
                e.phone
            FROM {$this->bd}users u
            LEFT JOIN {$this->bd}employees e ON e.user_id = u.id
            WHERE u.company_id = ? AND u.is_owner = 1 AND u.status = 'active'
            ORDER BY u.id ASC
            LIMIT 1
        ";

        $sql = $this->_Read($query, $array);
        return empty($sql) ? null : $sql[0];
    }

    // [company_id]. Los primeros del equipo, por antigüedad; el total sale aparte.
    function listTeamByCompany($array) {
        $query = "
            SELECT
                " . self::EMPLOYEE_NAME . " AS name,
                e.job_title,
                u.photo,
                u.color,
                b.name AS branch
            FROM {$this->bd}employees e
            LEFT JOIN {$this->bd}users u    ON u.id = e.user_id
            LEFT JOIN {$this->bd}branches b ON b.id = e.branch_id
            WHERE e.company_id = ?
              AND (u.id IS NULL OR u.status = 'active')
            ORDER BY e.hire_date IS NULL, e.hire_date ASC, e.id ASC
            LIMIT 8
        ";

        $sql = $this->_Read($query, $array);
        return is_array($sql) ? $sql : [];
    }

    function getTeamCount($array) {
        $query = "
            SELECT COUNT(*) AS total
            FROM {$this->bd}employees e
            LEFT JOIN {$this->bd}users u ON u.id = e.user_id
            WHERE e.company_id = ?
              AND (u.id IS NULL OR u.status = 'active')
        ";

        $sql = $this->_Read($query, $array);
        return empty($sql) ? 0 : (int) $sql[0]['total'];
    }

    // Cumpleaños del mes en curso, por dia. El mes lo pone MySQL con su reloj.
    function listBirthdaysByCompany($array) {
        $query = "
            SELECT
                " . self::EMPLOYEE_NAME . " AS name,
                u.photo,
                u.color,
                DAY(e.birth_date) AS day,
                (DAY(e.birth_date) = DAY(CURDATE())) AS today
            FROM {$this->bd}employees e
            LEFT JOIN {$this->bd}users u ON u.id = e.user_id
            WHERE e.company_id = ?
              AND e.birth_date IS NOT NULL
              AND MONTH(e.birth_date) = MONTH(CURDATE())
              AND (u.id IS NULL OR u.status = 'active')
            ORDER BY DAY(e.birth_date) ASC
        ";

        $sql = $this->_Read($query, $array);
        return is_array($sql) ? $sql : [];
    }

    // Aniversarios de ingreso del mes: quien cumple al menos un año.
    function listAnniversariesByCompany($array) {
        $query = "
            SELECT
                " . self::EMPLOYEE_NAME . " AS name,
                u.photo,
                u.color,
                DAY(e.hire_date) AS day,
                (YEAR(CURDATE()) - YEAR(e.hire_date)) AS years
            FROM {$this->bd}employees e
            LEFT JOIN {$this->bd}users u ON u.id = e.user_id
            WHERE e.company_id = ?
              AND e.hire_date IS NOT NULL
              AND MONTH(e.hire_date) = MONTH(CURDATE())
              AND YEAR(e.hire_date) < YEAR(CURDATE())
              AND (u.id IS NULL OR u.status = 'active')
            ORDER BY DAY(e.hire_date) ASC
        ";

        $sql = $this->_Read($query, $array);
        return is_array($sql) ? $sql : [];
    }

    // [subscription_id]. Lo que suma un plan Personalizado, al precio contratado.
    function getSubscriptionTotal($array) {
        $query = "SELECT SUM(price) AS total FROM {$this->bd}subscription_module WHERE subscription_id = ?";

        $sql = $this->_Read($query, $array);
        return empty($sql) || $sql[0]['total'] === null ? null : (float) $sql[0]['total'];
    }
}
?>
