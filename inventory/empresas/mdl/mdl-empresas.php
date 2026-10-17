<?php
require_once '../../conf/_CRUD.php';
require_once '../../conf/_Utileria.php';

// Modelo de la pantalla de Empresas (solo Super Admin): las empresas a las que
// puede entrar y sus sucursales, de fayxzvov_erp.
class mdl extends CRUD {

    public $util;
    public $bd;

    public function __construct() {
        $this->util = new Utileria;
        $this->bd   = 'fayxzvov_erp.';
    }

    // Empresas activas con cuántas sucursales activas tienen.
    function listCompanies() {
        $query = "
            SELECT
                c.id,
                c.name,
                c.ubication,
                (
                    SELECT COUNT(*)
                    FROM {$this->bd}branches b
                    WHERE b.company_id = c.id AND b.is_active = 1
                ) AS branches
            FROM {$this->bd}companies c
            WHERE c.status = 'active'
            ORDER BY c.name ASC
        ";
        $r = $this->_Read($query, null);
        return is_array($r) ? $r : [];
    }

    function getCompanyById($array) {
        // [id]
        $query = "
            SELECT id, name
            FROM {$this->bd}companies
            WHERE id = ? AND status = 'active'
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    // Sucursales activas de la empresa: la primera es con la que se entra.
    function listBranchesByCompany($array) {
        // [company_id]
        $query = "
            SELECT id, name
            FROM {$this->bd}branches
            WHERE company_id = ? AND is_active = 1
            ORDER BY name ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    // El módulo DEV (code = 'dev'): su card va junto a las empresas.
    function getModuleByCode($array) {
        // [code]
        $query = "
            SELECT id, name, icon, description, route
            FROM {$this->bd}modules
            WHERE code = ? AND is_active = 1
            ORDER BY id ASC
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }
}
