<?php
require_once '../../conf/_CRUD.php';
require_once '../../conf/_Utileria.php';

class mdl extends CRUD {

    public $util;
    public $bd;

    function __construct() {
        $this->util = new Utileria();
        $this->bd = "fayxzvov_admin.";
    }

    // Companies
    function listCompanies($array) {
        $query = "
            SELECT
                c.id,
                c.social_name,
                c.address,
                c.rfc,
                c.logo,
                c.ubication,
                c.phone,
                c.name_bd,
                c.enabled,
                cu.full_name AS customer_name
            FROM {$this->bd}companies c
            LEFT JOIN {$this->bd}customers cu ON c.customers_id = cu.id
            WHERE c.enabled = ?
            ORDER BY c.id ASC
        ";
        return $this->_Read($query, $array);
    }

    function getCompanyById($array) {
        $query = "
            SELECT
                c.id,
                c.social_name,
                c.address,
                c.rfc,
                c.logo,
                c.ubication,
                c.phone,
                c.name_bd,
                c.enabled,
                c.customers_id
            FROM {$this->bd}companies c
            WHERE c.id = ?
        ";
        return $this->_Read($query, $array);
    }

    function createCompany($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}companies",
            'values' => $array['values'],
            'data'   => $array['data']
        ]);
    }

    function updateCompany($array) {
        return $this->_Update([
            'table'  => "{$this->bd}companies",
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data'],
        ]);
    }

    function existsCompanyByName($array) {
        $query = "SELECT id FROM {$this->bd}companies WHERE LOWER(social_name) = LOWER(?) AND enabled = 1";
        $res = $this->_Read($query, $array);
        return count($res) > 0;
    }

    function existsOtherCompanyByName($array) {
        $query = "SELECT id FROM {$this->bd}companies WHERE LOWER(social_name) = LOWER(?) AND id != ? AND enabled = 1";
        $res = $this->_Read($query, $array);
        return count($res) > 0;
    }

    // Customers
    function listCustomers($array) {
        $query = "
            SELECT
                id,
                name,
                paternal_surname,
                maternal_surname,
                full_name,
                enabled
            FROM {$this->bd}customers
            WHERE enabled = ?
            ORDER BY full_name ASC
        ";
        return $this->_Read($query, $array);
    }

    function getCustomerById($array) {
        $query = "
            SELECT *
            FROM {$this->bd}customers
            WHERE id = ?
        ";
        return $this->_Read($query, $array);
    }

    function createCustomer($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}customers",
            'values' => $array['values'],
            'data'   => $array['data']
        ]);
    }

    function updateCustomer($array) {
        return $this->_Update([
            'table'  => "{$this->bd}customers",
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data'],
        ]);
    }

    function existsCustomerByName($array) {
        $query = "SELECT id FROM {$this->bd}customers WHERE LOWER(full_name) = LOWER(?) AND enabled = 1";
        $res = $this->_Read($query, $array);
        return count($res) > 0;
    }

    function existsOtherCustomerByName($array) {
        $query = "SELECT id FROM {$this->bd}customers WHERE LOWER(full_name) = LOWER(?) AND id != ? AND enabled = 1";
        $res = $this->_Read($query, $array);
        return count($res) > 0;
    }

    // Modules
    function listModules() {
        $query = "
            SELECT
                id,
                name,
                route,
                file_path,
                nickname,
                description,
                image
            FROM {$this->bd}modules
            ORDER BY name ASC
        ";
        return $this->_Read($query, null);
    }

    function getModuleById($array) {
        $query = "
            SELECT *
            FROM {$this->bd}modules
            WHERE id = ?
        ";
        return $this->_Read($query, $array);
    }

    function createModule($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}modules",
            'values' => $array['values'],
            'data'   => $array['data']
        ]);
    }

    function updateModule($array) {
        return $this->_Update([
            'table'  => "{$this->bd}modules",
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data'],
        ]);
    }

    function deleteModuleById($array) {
        return $this->_Delete([
            'table' => "{$this->bd}modules",
            'where' => $array['where'],
            'data'  => $array['data'],
        ]);
    }

    // Module-Company (pivot)
    function listModulesByCompany($array) {
        $query = "
            SELECT
                mc.id,
                m.name AS module_name,
                m.nickname,
                m.description,
                m.route,
                mc.module_id,
                mc.company_id
            FROM {$this->bd}module_company mc
            INNER JOIN {$this->bd}modules m ON mc.module_id = m.id
            WHERE mc.company_id = ?
            ORDER BY m.name ASC
        ";
        return $this->_Read($query, $array);
    }

    function createModuleCompany($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}module_company",
            'values' => $array['values'],
            'data'   => $array['data']
        ]);
    }

    function deleteModuleCompanyById($array) {
        return $this->_Delete([
            'table' => "{$this->bd}module_company",
            'where' => $array['where'],
            'data'  => $array['data'],
        ]);
    }

    function existsModuleCompany($array) {
        $query = "SELECT id FROM {$this->bd}module_company WHERE module_id = ? AND company_id = ?";
        $res = $this->_Read($query, $array);
        return count($res) > 0;
    }

    // Users (fayxzvov_admin.users)
    function listAdminUsers($array) {
        $query = "
            SELECT
                u.id,
                u.user,
                u.enabled,
                u.active,
                u.name_database,
                c.full_name AS customer_name
            FROM {$this->bd}users u
            LEFT JOIN {$this->bd}customers c ON u.customers_id = c.id
            WHERE u.enabled = ?
            ORDER BY u.user ASC
        ";
        return $this->_Read($query, $array);
    }

    function getAdminUserById($array) {
        $query = "
            SELECT *
            FROM {$this->bd}users
            WHERE id = ?
        ";
        return $this->_Read($query, $array);
    }

    function createAdminUser($array) {
        return $this->_Insert([
            'table'  => "{$this->bd}users",
            'values' => $array['values'],
            'data'   => $array['data']
        ]);
    }

    function updateAdminUser($array) {
        return $this->_Update([
            'table'  => "{$this->bd}users",
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data'],
        ]);
    }

    function existsAdminUserByName($array) {
        $query = "SELECT id FROM {$this->bd}users WHERE LOWER(user) = LOWER(?) AND enabled = 1";
        $res = $this->_Read($query, $array);
        return count($res) > 0;
    }

    function existsOtherAdminUserByName($array) {
        $query = "SELECT id FROM {$this->bd}users WHERE LOWER(user) = LOWER(?) AND id != ? AND enabled = 1";
        $res = $this->_Read($query, $array);
        return count($res) > 0;
    }

    // Selects para filtros
    function lsCustomers() {
        $query = "
            SELECT id, full_name AS valor
            FROM {$this->bd}customers
            WHERE enabled = 1
            ORDER BY full_name ASC
        ";
        return $this->_Read($query, null);
    }

    function lsCompanies() {
        $query = "
            SELECT id, social_name AS valor
            FROM {$this->bd}companies
            WHERE enabled = 1
            ORDER BY social_name ASC
        ";
        return $this->_Read($query, null);
    }

    function lsModules() {
        $query = "
            SELECT id, name AS valor
            FROM {$this->bd}modules
            ORDER BY name ASC
        ";
        return $this->_Read($query, null);
    }
}
