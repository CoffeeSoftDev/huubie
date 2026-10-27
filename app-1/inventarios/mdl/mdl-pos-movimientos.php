<?php
require_once '../../conf/_CRUD.php';
require_once '../../conf/_Utileria.php';

class mdl extends CRUD {
    public $util;
    public $bd;
    public $bdAlpha;

    public function __construct() {
        $this->util    = new Utileria;
        $this->bd      = 'fayxzvov_reginas.';
        $this->bdAlpha = 'fayxzvov_alpha.';
    }

    // ─────────────────────────────────────────────────────────────────
    //  CATALOGOS
    // ─────────────────────────────────────────────────────────────────

    function lsSucursales($array) {
        $query = "
            SELECT id, name AS valor, companies_id
            FROM {$this->bdAlpha}subsidiaries
            WHERE companies_id = ? AND active = 1
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

        if (!empty($array['subsidiaries_id'])) {
            $where .= ' AND mv.subsidiaries_id = ?';
            $data[] = $array['subsidiaries_id'];
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
            $where .= ' AND (mv.folio LIKE ? OR p.name LIKE ?)';
            $data[] = '%' . $array['q'] . '%';
            $data[] = '%' . $array['q'] . '%';
        }

        $query = "
            SELECT
                mv.movement_uid,
                mv.movement_type,
                mv.folio,
                mv.product_id,
                p.name              AS product_name,
                pa.sku,
                mv.quantity,
                mv.stock_prev,
                mv.stock_post,
                mv.cost_unit,
                mv.cost_total,
                mv.occurred_at,
                mv.warehouse_id,
                w.name              AS warehouse_name,
                mv.subsidiaries_id,
                s.name              AS subsidiary_name,
                mv.user_id,
                u.fullname          AS user_name,
                mv.note,
                mv.status,
                mv.companies_id
            FROM {$this->bd}inventory_movement mv
            LEFT JOIN {$this->bd}order_products p   ON p.id = mv.product_id
            LEFT JOIN {$this->bd}product_attribute pa ON pa.product_id = p.id AND pa.active = 1
            LEFT JOIN {$this->bd}warehouse        w  ON w.id  = mv.warehouse_id
            LEFT JOIN {$this->bdAlpha}subsidiaries s ON s.id = mv.subsidiaries_id
            LEFT JOIN {$this->bdAlpha}usr_users    u ON u.id = mv.user_id
            WHERE {$where}
            ORDER BY mv.stock_post DESC, mv.occurred_at DESC
            LIMIT 500
        ";
        $r = $this->_Read($query, $data);
        return is_array($r) ? $r : [];
    }

    function getMovimientoKpis($array) {
        $where = 'mv.companies_id = ?';
        $data  = [$array['companies_id']];

        if (!empty($array['subsidiaries_id'])) {
            $where .= ' AND mv.subsidiaries_id = ?';
            $data[] = $array['subsidiaries_id'];
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
                COUNT(CASE WHEN mv.movement_type = 'TRANSFERENCIA' THEN 1 END) AS total_traspasos,
                COUNT(CASE WHEN mv.movement_type = 'AJUSTE'        THEN 1 END) AS total_ajustes
            FROM {$this->bd}inventory_movement mv
            WHERE {$where}
        ";
        $r = $this->_Read($query, $data);
        return !empty($r) ? $r[0] : [
            'total' => 0, 'total_entradas' => 0, 'total_mermas' => 0,
            'total_traspasos' => 0, 'total_ajustes' => 0
        ];
    }
}
