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
        // [branch_id activa, id usuario]
        // El rol y la sucursal salen de users_braches para la SUCURSAL ACTIVA: un
        // usuario puede tener un rol distinto por sucursal, asi que se empareja ub
        // por branch_id (no por LIMIT 1, que tomaba una fila arbitraria).
        $query = "
            SELECT
                u.id        AS id,
                TRIM(CONCAT(COALESCE(u.name, ''), ' ', COALESCE(u.last_name, ''))) AS user,
                u.email     AS email,
                u.photo     AS photo,
                u.is_owner  AS level,
                u.company_id AS company_id,
                c.name      AS company,
                ub.branch_id AS branch_id,
                s.name      AS branch,
                r.name      AS rol
            FROM {$this->bd}users u
            LEFT JOIN {$this->bd}companies c ON c.id = u.company_id
            LEFT JOIN {$this->bd}users_braches ub ON ub.user_id = u.id AND ub.branch_id = ?
            LEFT JOIN {$this->bd}branches s ON s.id = ub.branch_id
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

    function getBranchesByCompany($array) {
        $query = "
            SELECT
                id,
                name,
                ubication,
                is_active,
                logo
            FROM {$this->bd}branches
            WHERE company_id = ?
                AND is_active = 1
            ORDER BY name ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    function getBranchesByUser($array) {
        $query = "
            SELECT
                b.id,
                b.name,
                b.ubication,
                b.is_active,
                b.logo
            FROM {$this->bd}users_braches ub
            INNER JOIN {$this->bd}branches b ON b.id = ub.branch_id
            WHERE ub.user_id = ?
                AND b.is_active = 1
            ORDER BY b.name ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    function getBranchById($array) {
        $query = "
            SELECT
                id,
                name,
                company_id,
                ubication,
                is_active
            FROM {$this->bd}branches
            WHERE id = ?
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return !empty($r) ? $r[0] : null;
    }

    function userHasAccessToBranch($array) {
        $query = "
            SELECT 1
            FROM {$this->bd}users_braches
            WHERE user_id = ?
                AND branch_id = ?
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return !empty($r);
    }

    // Secciones a las que el usuario tiene acceso en una sucursal concreta.
    // Resuelve users_braches -> roles -> permissions -> sections. Base del menú dinámico.
    function getAccessibleSections($array) {
        // [user_id, branch_id]
        $query = "
            SELECT DISTINCT
                s.id, s.name, s.code, s.icon, s.route, s.orden,
                m.name AS module_name
            FROM {$this->bd}users_braches ub
            JOIN {$this->bd}permissions p ON p.role_id = ub.role_id AND p.is_active = 1
            JOIN {$this->bd}sections s    ON s.id = p.section_id AND s.is_active = 1
            LEFT JOIN {$this->bd}modules m ON m.id = s.module_id
            WHERE ub.user_id = ? AND ub.branch_id = ?
            ORDER BY m.orden ASC, s.orden ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    // Igual que getAccessibleSections pero acotado a un modulo, para que el
    // sidebar muestre solo las secciones del modulo en el que esta el usuario.
    function getAccessibleSectionsByModule($array) {
        // [user_id, branch_id, module_id]
        $query = "
            SELECT DISTINCT
                s.id, s.name, s.code, s.icon, s.route, s.orden,
                m.name AS module_name
            FROM {$this->bd}users_braches ub
            JOIN {$this->bd}permissions p ON p.role_id = ub.role_id AND p.is_active = 1
            JOIN {$this->bd}sections s    ON s.id = p.section_id AND s.is_active = 1
            LEFT JOIN {$this->bd}modules m ON m.id = s.module_id
            WHERE ub.user_id = ? AND ub.branch_id = ? AND s.module_id = ?
            ORDER BY s.orden ASC, s.id ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    // Modulos activos (id + route) ordenados por ruta mas larga primero, para
    // resolver a que modulo pertenece la pagina actual por prefijo de ruta.
    function getModulesForMatch() {
        $query = "
            SELECT id, route
            FROM {$this->bd}modules
            WHERE is_active = 1 AND route IS NOT NULL AND route <> ''
            ORDER BY CHAR_LENGTH(route) DESC
        ";
        $r = $this->_Read($query, null);
        return is_array($r) ? $r : [];
    }
}
