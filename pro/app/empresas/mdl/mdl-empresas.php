<?php
require_once __DIR__ . '/../../../core/database/_CRUD.php';
require_once __DIR__ . '/../../../core/helpers/_Utileria.php';

class mdl extends CRUD {
    public $util;
    public $bd;

    public function __construct() {
        $this->util = new Utileria;
        // Sin prefijo: companies y branches viven en la base del .env (DB_NAME).
        $this->bd   = '';
    }

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

        return $this->_Read($query, null);
    }

    function getCompanyById($array) {
        $query = "
            SELECT id, name
            FROM {$this->bd}companies
            WHERE id = ? AND status = 'active'
            LIMIT 1
        ";

        $sql = $this->_Read($query, $array);
        return empty($sql) ? null : $sql[0];
    }

    function getModuleByCode($array) {
        $query = "
            SELECT id, name, icon, description, route
            FROM {$this->bd}modules
            WHERE code = ? AND is_active = 1
            LIMIT 1
        ";

        $sql = $this->_Read($query, $array);
        return empty($sql) ? null : $sql[0];
    }

    function listBranchesByCompany($array) {
        $query = "
            SELECT id, name
            FROM {$this->bd}branches
            WHERE company_id = ? AND is_active = 1
            ORDER BY name ASC
        ";

        return $this->_Read($query, $array);
    }
}
?>
