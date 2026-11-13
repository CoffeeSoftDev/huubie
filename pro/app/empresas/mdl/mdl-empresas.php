<?php
require_once __DIR__ . '/../../../core/database/_CRUD.php';
require_once __DIR__ . '/../../../core/helpers/_Utileria.php';
require_once __DIR__ . '/../../../core/security/_Plan.php';

class mdl extends CRUD {
    public $util;
    public $bd;

    public function __construct() {
        $this->util = new Utileria;
        // Sin prefijo: companies y branches viven en la base del .env (DB_NAME).
        $this->bd   = '';
    }

    /*  Todas, tambien las que no estan activas: root tiene que poder entrar a
        una suspendida para ver lo mismo que ve su dueño (el aviso de pago).
        Con el plan y el estado de su ultima suscripcion. */
    function listCompanies() {
        $query = "
            SELECT
                c.id,
                c.name,
                c.ubication,
                c.status,
                s.status AS sub_status,
                (s.status = 'trial' AND " . Plan::trialEndSql() . " < CURDATE()) AS trial_over,
                p.name   AS plan,
                (
                    SELECT COUNT(*)
                    FROM {$this->bd}branches b
                    WHERE b.company_id = c.id AND b.is_active = 1
                ) AS branches
            FROM {$this->bd}companies c
            LEFT JOIN {$this->bd}subscriptions s ON s.id = (
                SELECT MAX(s2.id) FROM {$this->bd}subscriptions s2 WHERE s2.company_id = c.id
            )
            LEFT JOIN {$this->bd}plans p ON p.id = s.plan_id
            ORDER BY c.status = 'active' DESC, c.name ASC
        ";

        return $this->_Read($query, null);
    }

    function getCompanyById($array) {
        $query = "
            SELECT id, name
            FROM {$this->bd}companies
            WHERE id = ?
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
