<?php
require_once '../../conf/_CRUD.php';
require_once '../../conf/_Utileria.php';

class mdl extends CRUD {
    protected $util;

    public function __construct() {
        $this->util = new Utileria;
    }

    /**
     * Sucursales a las que el usuario tiene acceso.
     * Los dueños (is_owner = 1) ven todas las sucursales activas de su compañía;
     * el resto ven su sucursal de pertenencia (users.branch_id) más las asignadas
     * en users_braches.
     *
     * @param array $array [user_id, company_id, is_owner, user_id, user_id]
     */
    function getBranchesByUser($array) {
        $query = "
            SELECT
                b.id,
                b.name,
                b.ubication,
                b.is_active AS active,
                b.logo,
                c.name AS company,
                TRIM(CONCAT(COALESCE(u.name, ''), ' ', COALESCE(u.last_name, ''))) AS user
            FROM branches b
            INNER JOIN companies c ON c.id = b.company_id
            INNER JOIN users u     ON u.id = ?
            WHERE b.company_id = ?
                AND b.is_active = 1
                AND ( ? = 1
                    OR b.id = (SELECT branch_id FROM users WHERE id = ?)
                    OR b.id IN (SELECT branch_id FROM users_braches WHERE user_id = ?)
                )
            ORDER BY b.name
        ";
        return $this->_Read($query, $array);
    }

    /**
     * Valida que una sucursal exista, esté activa y pertenezca a la compañía.
     *
     * @param array $array [id, company_id]
     */
    function getBranchById($array) {
        $query = "
            SELECT id, name
            FROM branches
            WHERE id = ?
                AND company_id = ?
                AND is_active = 1
            LIMIT 1
        ";
        $result = $this->_Read($query, $array);
        return !empty($result) ? $result[0] : null;
    }
}
