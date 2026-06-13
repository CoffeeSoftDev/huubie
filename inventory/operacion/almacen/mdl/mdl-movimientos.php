<?php
require_once '../../../conf/_CRUD.php';
require_once '../../../conf/_Utileria.php';

class mdl extends CRUD {

    public $util;
    public $bd;
    public $bdErp;

    public function __construct() {
        $this->util  = new Utileria;
        $this->bd    = 'fayxzvov_inventory.';
        $this->bdErp = 'fayxzvov_erp.';
    }

    // ─────────────────────────────────────────────────────────────────
    //  CATALOGOS
    // ─────────────────────────────────────────────────────────────────

    function lsSucursales($array) {
        $query = "
            SELECT id, name AS valor, company_id AS companies_id
            FROM {$this->bdErp}branches
            WHERE company_id = ? AND is_active = 1
            ORDER BY name ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    // ─────────────────────────────────────────────────────────────────
    //  MOVIMIENTOS (vista unificada sobre inventory_movement)
    // ─────────────────────────────────────────────────────────────────

    function listMovimientos($array) {
        $where = 'mv.companies_id = ?';
        $data  = [$array['companies_id']];

        if (!empty($array['branch_id'])) {
            $where .= ' AND mv.branch_id = ?';
            $data[] = $array['branch_id'];
        }
        if (!empty($array['movement_type'])) {
            $where .= ' AND mv.movement_type = ?';
            $data[] = $array['movement_type'];
        }
        if (!empty($array['fi']) && !empty($array['ff'])) {
            $where .= ' AND DATE(mv.occurred_at) BETWEEN ? AND ?';
            $data[] = $array['fi'];
            $data[] = $array['ff'];
        }
        if (!empty($array['q'])) {
            $where .= ' AND (mv.folio LIKE ? OR i.name LIKE ?)';
            $data[] = '%' . $array['q'] . '%';
            $data[] = '%' . $array['q'] . '%';
        }

        $query = "
            SELECT
                mv.movement_uid,
                mv.movement_type,
                mv.folio,
                mv.note,
                mv.quantity,
                mv.stock_prev,
                mv.stock_post,
                mv.cost_unit,
                mv.cost_total,
                mv.occurred_at,
                mv.created_at,
                mv.status,
                mv.item_id,
                i.name              AS item_name,
                ia.sku,
                mv.warehouse_id,
                w.name              AS warehouse_name,
                mv.branch_id,
                b.name              AS branch_name,
                mv.user_id,
                TRIM(CONCAT(COALESCE(u.name, ''), ' ', COALESCE(u.last_name, ''))) AS user_name,
                mv.companies_id
            FROM {$this->bd}inventory_movement mv
            LEFT JOIN {$this->bd}item            i  ON i.id  = mv.item_id
            LEFT JOIN {$this->bd}item_attribute  ia ON ia.item_id = i.id AND ia.active = 1
            LEFT JOIN {$this->bd}warehouse       w  ON w.id  = mv.warehouse_id
            LEFT JOIN {$this->bdErp}branches     b  ON b.id  = mv.branch_id
            LEFT JOIN {$this->bdErp}users        u  ON u.id  = mv.user_id
            WHERE {$where}
            ORDER BY mv.occurred_at DESC, mv.stock_post DESC
            LIMIT 500
        ";
        $r = $this->_Read($query, $data);
        return is_array($r) ? $r : [];
    }

    function getMovimientoKpis($array) {
        $where = 'mv.companies_id = ?';
        $data  = [$array['companies_id']];

        if (!empty($array['branch_id'])) {
            $where .= ' AND mv.branch_id = ?';
            $data[] = $array['branch_id'];
        }
        if (!empty($array['fi']) && !empty($array['ff'])) {
            $where .= ' AND DATE(mv.occurred_at) BETWEEN ? AND ?';
            $data[] = $array['fi'];
            $data[] = $array['ff'];
        }

        $query = "
            SELECT
                COUNT(*) AS total,
                COUNT(CASE WHEN mv.movement_type = 'ENTRADA'       THEN 1 END) AS total_entradas,
                COUNT(CASE WHEN mv.movement_type = 'MERMA'         THEN 1 END) AS total_mermas,
                COUNT(CASE WHEN mv.movement_type = 'TRANSFERENCIA' THEN 1 END) AS total_traspasos
            FROM {$this->bd}inventory_movement mv
            WHERE {$where}
        ";
        $r = $this->_Read($query, $data);
        return !empty($r) ? $r[0] : [
            'total' => 0, 'total_entradas' => 0,
            'total_mermas' => 0, 'total_traspasos' => 0
        ];
    }
}
