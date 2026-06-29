<?php
require_once('../../../conf/_CRUD.php');
require_once('../../../conf/_Utileria.php');

class MAdminFolios extends CRUD {
    protected $util;
    protected $bd;

    public function __construct() {
        $this->util = new Utileria;
        $this->bd   = 'fayxzvov_reginas.';
    }

    function lsSucursales() {
        $query = "SELECT
            s.id AS id,
            s.name AS valor,
            c.social_name AS company
        FROM fayxzvov_alpha.subsidiaries s
        INNER JOIN fayxzvov_admin.companies c ON s.companies_id = c.id
        WHERE s.active = 1
        ORDER BY c.social_name, s.name";
        return $this->_Read($query, null);
    }

    function lsStatus() {
        $query = "SELECT id AS id, status AS valor FROM {$this->bd}status_process";
        return $this->_Read($query, null);
    }

    function countWithoutSubsidiary() {
        $query = "SELECT COUNT(*) AS total FROM {$this->bd}`order` WHERE subsidiaries_id IS NULL";
        $result = $this->_Read($query, null);
        return $result ? (int) $result[0]['total'] : 0;
    }

    function getFolios($data) {
        $params = [
            $data['fi'] . ' 00:00:00',
            $data['ff'] . ' 23:59:59'
        ];

        $query = "SELECT
            o.id AS id,
            DATE_FORMAT(o.date_creation, '%Y-%m-%d %h:%i %p') AS date_creation,
            o.status,
            o.total_pay,
            o.subsidiaries_id,
            oc.name AS name_client,
            oc.phone AS phone,
            sp.status AS status_label,
            s.name AS subsidiary_name,
            c.social_name AS company_name
        FROM {$this->bd}`order` o
        LEFT JOIN {$this->bd}order_clients oc ON o.client_id = oc.id
        LEFT JOIN {$this->bd}status_process sp ON o.status = sp.id
        LEFT JOIN fayxzvov_alpha.subsidiaries s ON o.subsidiaries_id = s.id
        LEFT JOIN fayxzvov_admin.companies c ON s.companies_id = c.id
        WHERE o.date_creation BETWEEN ? AND ?";

        if (!empty($data['only_without'])) {
            $query .= " AND o.subsidiaries_id IS NULL";
        } elseif (!empty($data['subsidiaries_id']) && $data['subsidiaries_id'] != '0') {
            $query .= " AND o.subsidiaries_id = ?";
            $params[] = $data['subsidiaries_id'];
        }

        if (!empty($data['status']) && $data['status'] != '0') {
            $query .= " AND o.status = ?";
            $params[] = $data['status'];
        }

        $query .= " ORDER BY o.date_creation DESC";
        return $this->_Read($query, $params);
    }

    function updateFolioSubsidiary($subsidiaries_id, $id) {
        return $this->_Update([
            'table'  => "{$this->bd}`order`",
            'values' => ['subsidiaries_id'],
            'where'  => ['id'],
            'data'   => [$subsidiaries_id, $id]
        ]);
    }
}
