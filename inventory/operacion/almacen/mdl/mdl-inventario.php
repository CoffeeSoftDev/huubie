<?php
require_once '../../../conf/_CRUD.php';
require_once '../../../conf/_Utileria.php';
session_start();

class mdl extends CRUD {
    protected $util;
    public $bd;
    public $erp;

    public function __construct() {
        $this->util = new Utileria;
        $this->bd = "fayxzvov_inventory.";
        $this->erp = "fayxzvov_erp.";
    }

    // Selects

    function lsProductos() {
        $query = "
            SELECT i.id, i.name AS valor, ia.unit_id, COALESCE(ia.cost_unit, i.price, 0) AS cost_unit
            FROM {$this->bd}item i
            LEFT JOIN {$this->bd}item_attribute ia ON ia.item_id = i.id AND ia.active = 1
            WHERE i.active = 1
            AND i.companies_id = ".$_SESSION['company_id']."
            ORDER BY i.name ASC
        ";
        return $this->_Read($query, []);
    }

    function lsAlmacenes() {
        $query = "
            SELECT id, name AS valor, is_default
            FROM {$this->bd}warehouse
            WHERE active = 1
            AND companies_id = ".$_SESSION['company_id']."
            ORDER BY is_default DESC, name ASC
        ";
        return $this->_Read($query, []);
    }

    // Existencia actual de un item en un almacén

    function getStockRow($array) {
        $query = "
            SELECT id, quantity
            FROM {$this->bd}stock
            WHERE item_id = ? AND warehouse_id = ? AND active = 1
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return $r[0] ?? null;
    }

    function insertStock($array) {
        $query = "
            INSERT INTO {$this->bd}stock (quantity, last_movement_at, warehouse_id, item_id, companies_id)
            VALUES (?, NOW(), ?, ?, ?)
        ";
        return $this->_CUD($query, $array);
    }

    function updateStockQty($array) {
        $query = "
            UPDATE {$this->bd}stock
            SET quantity = ?, last_movement_at = NOW(), updated_at = NOW()
            WHERE id = ?
        ";
        return $this->_CUD($query, $array);
    }

    // Folio incremental por tabla

    function nextFolio($prefix, $tabla) {
        $query = "
            SELECT folio
            FROM {$this->bd}{$tabla}
            WHERE companies_id = ? AND folio LIKE ?
            ORDER BY id DESC
            LIMIT 1
        ";
        $r = $this->_Read($query, [$_SESSION['company_id'], $prefix . '%']);
        $next = 1;
        if (!empty($r)) {
            $num  = (int) preg_replace('/[^0-9]/', '', substr($r[0]['folio'], strlen($prefix)));
            $next = $num + 1;
        }
        return $prefix . str_pad($next, 4, '0', STR_PAD_LEFT);
    }

    function getMaxId($tabla) {
        $query = "SELECT MAX(id) AS id FROM {$this->bd}{$tabla}";
        $r = $this->_Read($query, []);
        return $r[0]['id'] ?? 0;
    }

    // Entradas

    function insertInflow($array) {
        $query = "
            INSERT INTO {$this->bd}inventory_inflow
                (folio, note, total_products, total_units, total_cost, date_inflow, status,
                 warehouse_id, user_id, subsidiaries_id, companies_id)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)
        ";
        return $this->_CUD($query, $array);
    }

    function insertInflowDetail($array) {
        $query = "
            INSERT INTO {$this->bd}detail_inventory_inflow
                (quantity, cost, subtotal, previous_stock, resulting_stock, item_id, inventory_inflow_id, unit_id)
            VALUES (?,?,?,?,?,?,?,?)
        ";
        return $this->_CUD($query, $array);
    }

    // Salidas

    function insertShrinkage($array) {
        $query = "
            INSERT INTO {$this->bd}inventory_shrinkage
                (folio, note, total_products, total_units, total_cost, date_shrinkage, status,
                 warehouse_id, user_id, subsidiaries_id, companies_id)
            VALUES (?,?,?,?,?,?,?,?,?,?,?)
        ";
        return $this->_CUD($query, $array);
    }

    function insertShrinkageDetail($array) {
        $query = "
            INSERT INTO {$this->bd}detail_inventory_shrinkage
                (quantity, cost, subtotal, previous_stock, resulting_stock, item_id, inventory_shrinkage_id)
            VALUES (?,?,?,?,?,?,?)
        ";
        return $this->_CUD($query, $array);
    }

    // Kardex

    function insertMovement($array) {
        $query = "
            INSERT INTO {$this->bd}inventory_movement
                (movement_type, folio, quantity, stock_prev, stock_post, cost_unit, cost_total,
                 occurred_at, status, item_id, warehouse_id, user_id, subsidiaries_id, companies_id)
            VALUES (?,?,?,?,?,?,?,NOW(),?,?,?,?,?,?)
        ";
        return $this->_CUD($query, $array);
    }

    // Listados / reportes (kardex)

    function listMovimientos($array) {
        $query = "
            SELECT
                mv.id,
                mv.folio,
                DATE_FORMAT(mv.occurred_at, '%d/%m/%Y %H:%i') AS fecha,
                mv.movement_type AS tipo,
                i.name AS producto,
                mv.quantity,
                mv.stock_prev,
                mv.stock_post,
                mv.cost_total,
                mv.status,
                u.fullname AS responsable
            FROM {$this->bd}inventory_movement mv
            LEFT JOIN {$this->bd}item i ON i.id = mv.item_id
            LEFT JOIN fayxzvov_erp.users u ON u.id = mv.user_id
            WHERE DATE(mv.occurred_at) BETWEEN ? AND ?
            AND (? = 'Todos' OR mv.movement_type = ?)
            AND mv.companies_id = ".$_SESSION['company_id']."
            ORDER BY mv.id DESC
        ";
        return $this->_Read($query, $array);
    }

    function getResumenStock() {
        $query = "
            SELECT
                COUNT(DISTINCT i.id) AS total_productos,
                COALESCE(SUM(t.qty), 0) AS total_unidades,
                COALESCE(SUM(t.qty * COALESCE(ia.cost_unit, 0)), 0) AS valor_inventario,
                SUM(CASE WHEN COALESCE(t.qty,0) <= COALESCE(ia.stock_min,0) THEN 1 ELSE 0 END) AS productos_bajos
            FROM {$this->bd}item i
            LEFT JOIN {$this->bd}item_attribute ia ON ia.item_id = i.id AND ia.active = 1
            LEFT JOIN (
                SELECT item_id, SUM(quantity) AS qty
                FROM {$this->bd}stock WHERE active = 1 GROUP BY item_id
            ) t ON t.item_id = i.id
            WHERE i.active = 1 AND i.companies_id = ".$_SESSION['company_id']."
        ";
        $r = $this->_Read($query, []);
        return $r[0] ?? null;
    }

    function listProductosBajoStock($array) {
        $query = "
            SELECT
                i.id,
                i.name AS nombre,
                COALESCE(t.qty, 0) AS stock_actual,
                COALESCE(ia.stock_min, 0) AS minimo
            FROM {$this->bd}item i
            LEFT JOIN {$this->bd}item_attribute ia ON ia.item_id = i.id AND ia.active = 1
            LEFT JOIN (
                SELECT item_id, SUM(quantity) AS qty
                FROM {$this->bd}stock WHERE active = 1 GROUP BY item_id
            ) t ON t.item_id = i.id
            WHERE i.active = 1 AND i.companies_id = ".$_SESSION['company_id']."
            AND COALESCE(t.qty, 0) <= COALESCE(ia.stock_min, 0)
            ORDER BY stock_actual ASC
        ";
        return $this->_Read($query, $array);
    }

    function listHistorialProducto($array) {
        $query = "
            SELECT
                mv.id,
                DATE_FORMAT(mv.occurred_at, '%d/%m/%Y %H:%i') AS fecha,
                mv.folio,
                mv.movement_type AS tipo,
                mv.quantity,
                mv.stock_prev,
                mv.stock_post
            FROM {$this->bd}inventory_movement mv
            WHERE mv.item_id = ?
            AND mv.companies_id = ".$_SESSION['company_id']."
            ORDER BY mv.id DESC
        ";
        return $this->_Read($query, $array);
    }

    // ─────────────────────────────────────────────────────────────────
    //  Catalogos Entradas / Salidas
    // ─────────────────────────────────────────────────────────────────

    function lsInflowOrigins() {
        $query = "
            SELECT id, code, name AS valor, requires_supplier, color_hex, icon
            FROM {$this->bd}inflow_origin
            WHERE active = 1
            ORDER BY id ASC
        ";
        return $this->_Read($query, []);
    }

    function lsShrinkageReasons() {
        $query = "
            SELECT id, code, name AS valor, color_hex, icon
            FROM {$this->bd}shrinkage_reason
            WHERE active = 1
            ORDER BY id ASC
        ";
        return $this->_Read($query, []);
    }

    function lsSuppliers($array) {
        $query = "
            SELECT id, name AS valor, contact_name, phone
            FROM {$this->bd}supplier
            WHERE active = 1 AND companies_id = ?
            ORDER BY name ASC
        ";
        return $this->_Read($query, $array);
    }

    // ─────────────────────────────────────────────────────────────────
    //  Entradas (inventory_inflow)
    // ─────────────────────────────────────────────────────────────────

    function listEntradas($array) {
        $where = 'i.active = 1 AND i.companies_id = ?';
        $data  = [$array['companies_id']];

        if (!empty($array['subsidiaries_id'])) {
            $where .= ' AND i.subsidiaries_id = ?';
            $data[] = $array['subsidiaries_id'];
        }
        if (!empty($array['origin_id'])) {
            $where .= ' AND i.inflow_origin_id = ?';
            $data[] = $array['origin_id'];
        }
        if (!empty($array['status'])) {
            if ($array['status'] === 'Activas') {
                $where .= " AND i.status <> 'Cancelada'";
            } else {
                $where .= ' AND i.status = ?';
                $data[] = $array['status'];
            }
        }
        if (!empty($array['fi']) && !empty($array['ff'])) {
            $where .= ' AND i.date_inflow BETWEEN ? AND ?';
            $data[] = $array['fi'];
            $data[] = $array['ff'];
        }

        $query = "
            SELECT
                i.id, i.folio, i.note, i.total_products, i.total_units, i.total_cost,
                i.date_inflow, i.status,
                io.name AS origin_name, io.color_hex AS origin_color,
                w.name  AS warehouse_name,
                sp.name AS supplier_name,
                s.name  AS subsidiary_name,
                u.fullname AS user_name
            FROM {$this->bd}inventory_inflow i
            LEFT JOIN {$this->bd}inflow_origin io ON io.id = i.inflow_origin_id
            LEFT JOIN {$this->bd}warehouse     w  ON w.id  = i.warehouse_id
            LEFT JOIN {$this->bd}supplier      sp ON sp.id = i.supplier_id
            LEFT JOIN {$this->erp}subsidiaries s  ON s.id  = i.subsidiaries_id
            LEFT JOIN {$this->erp}users        u  ON u.id  = i.user_id
            WHERE {$where}
            ORDER BY i.date_inflow DESC, i.id DESC
        ";
        return $this->_Read($query, $data);
    }

    function getEntradaKpis($array) {
        $where = 'i.active = 1 AND i.companies_id = ?';
        $data  = [$array['companies_id']];

        if (!empty($array['subsidiaries_id'])) {
            $where .= ' AND i.subsidiaries_id = ?';
            $data[] = $array['subsidiaries_id'];
        }
        if (!empty($array['fi']) && !empty($array['ff'])) {
            $where .= ' AND i.date_inflow BETWEEN ? AND ?';
            $data[] = $array['fi'];
            $data[] = $array['ff'];
        }

        $query = "
            SELECT
                COUNT(i.id)                                       AS total_entradas,
                IFNULL(SUM(i.total_cost), 0)                      AS total_costo,
                IFNULL(SUM(i.total_units), 0)                     AS total_unidades,
                COUNT(CASE WHEN i.status = 'Aplicada' THEN 1 END) AS total_aplicadas
            FROM {$this->bd}inventory_inflow i
            WHERE {$where}
        ";
        $r = $this->_Read($query, $data);
        return $r[0] ?? ['total_entradas' => 0, 'total_costo' => 0, 'total_unidades' => 0, 'total_aplicadas' => 0];
    }

    function getEntradaHeader($array) {
        $query = "
            SELECT
                i.*,
                io.name AS origin_name, io.code AS origin_code,
                w.name  AS warehouse_name,
                sp.name AS supplier_name,
                s.name  AS subsidiary_name,
                u.fullname AS user_name
            FROM {$this->bd}inventory_inflow i
            LEFT JOIN {$this->bd}inflow_origin io ON io.id = i.inflow_origin_id
            LEFT JOIN {$this->bd}warehouse     w  ON w.id  = i.warehouse_id
            LEFT JOIN {$this->bd}supplier      sp ON sp.id = i.supplier_id
            LEFT JOIN {$this->erp}subsidiaries s  ON s.id  = i.subsidiaries_id
            LEFT JOIN {$this->erp}users        u  ON u.id  = i.user_id
            WHERE i.id = ?
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return $r[0] ?? null;
    }

    function getEntradaDetail($array) {
        $query = "
            SELECT
                d.id, d.batch_code, d.quantity, d.cost, d.subtotal,
                d.previous_stock, d.resulting_stock, d.expires_at,
                d.item_id, it.name AS item_name, ia.sku, un.code AS unit_code
            FROM {$this->bd}detail_inventory_inflow d
            INNER JOIN {$this->bd}item it ON it.id = d.item_id
            LEFT  JOIN {$this->bd}item_attribute ia ON ia.item_id = it.id AND ia.active = 1
            LEFT  JOIN {$this->bd}unit un ON un.id = d.unit_id
            WHERE d.inventory_inflow_id = ? AND d.active = 1
            ORDER BY d.id ASC
        ";
        return $this->_Read($query, $array);
    }

    function insertEntrada($array) {
        $query = "
            INSERT INTO {$this->bd}inventory_inflow
                (folio, note, total_products, total_units, total_cost, date_inflow, status,
                 inflow_origin_id, warehouse_id, supplier_id, subsidiaries_id, user_id, companies_id)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
        ";
        return $this->_CUD($query, $array);
    }

    function insertEntradaDetail($array) {
        $query = "
            INSERT INTO {$this->bd}detail_inventory_inflow
                (batch_code, quantity, cost, subtotal, previous_stock, resulting_stock,
                 expires_at, item_id, inventory_inflow_id, unit_id)
            VALUES (?,?,?,?,?,?,?,?,?,?)
        ";
        return $this->_CUD($query, $array);
    }

    function cancelEntradaById($array) {
        $query = "
            UPDATE {$this->bd}inventory_inflow
            SET status = 'Cancelada', updated_at = NOW()
            WHERE id = ?
        ";
        return $this->_CUD($query, $array);
    }

    // ─────────────────────────────────────────────────────────────────
    //  Salidas (inventory_shrinkage)
    // ─────────────────────────────────────────────────────────────────

    function listSalidas($array) {
        $where = 'm.active = 1 AND m.companies_id = ?';
        $data  = [$array['companies_id']];

        if (!empty($array['subsidiaries_id'])) {
            $where .= ' AND m.subsidiaries_id = ?';
            $data[] = $array['subsidiaries_id'];
        }
        if (!empty($array['reason_id'])) {
            $where .= ' AND m.shrinkage_reason_id = ?';
            $data[] = $array['reason_id'];
        }
        if (!empty($array['status'])) {
            if ($array['status'] === 'Activas') {
                $where .= " AND m.status <> 'Cancelada'";
            } else {
                $where .= ' AND m.status = ?';
                $data[] = $array['status'];
            }
        }
        if (!empty($array['fi']) && !empty($array['ff'])) {
            $where .= ' AND m.date_shrinkage BETWEEN ? AND ?';
            $data[] = $array['fi'];
            $data[] = $array['ff'];
        }

        $query = "
            SELECT
                m.id, m.folio, m.note, m.total_products, m.total_units, m.total_cost,
                m.date_shrinkage, m.status,
                sr.name AS reason_name, sr.color_hex AS reason_color,
                w.name  AS warehouse_name,
                s.name  AS subsidiary_name,
                u.fullname AS user_name
            FROM {$this->bd}inventory_shrinkage m
            LEFT JOIN {$this->bd}shrinkage_reason sr ON sr.id = m.shrinkage_reason_id
            LEFT JOIN {$this->bd}warehouse        w  ON w.id  = m.warehouse_id
            LEFT JOIN {$this->erp}subsidiaries    s  ON s.id  = m.subsidiaries_id
            LEFT JOIN {$this->erp}users           u  ON u.id  = m.user_id
            WHERE {$where}
            ORDER BY m.date_shrinkage DESC, m.id DESC
        ";
        return $this->_Read($query, $data);
    }

    function getSalidaKpis($array) {
        $where = "m.active = 1 AND m.status <> 'Cancelada' AND m.companies_id = ?";
        $data  = [$array['companies_id']];

        if (!empty($array['subsidiaries_id'])) {
            $where .= ' AND m.subsidiaries_id = ?';
            $data[] = $array['subsidiaries_id'];
        }
        if (!empty($array['fi']) && !empty($array['ff'])) {
            $where .= ' AND m.date_shrinkage BETWEEN ? AND ?';
            $data[] = $array['fi'];
            $data[] = $array['ff'];
        }

        $query = "
            SELECT
                COUNT(m.id)                     AS total_salidas,
                IFNULL(SUM(m.total_cost), 0)    AS total_costo,
                IFNULL(SUM(m.total_units), 0)   AS total_unidades
            FROM {$this->bd}inventory_shrinkage m
            WHERE {$where}
        ";
        $r = $this->_Read($query, $data);
        return $r[0] ?? ['total_salidas' => 0, 'total_costo' => 0, 'total_unidades' => 0];
    }

    function getSalidaHeader($array) {
        $query = "
            SELECT
                m.*,
                sr.name AS reason_name, sr.code AS reason_code,
                w.name  AS warehouse_name,
                s.name  AS subsidiary_name,
                u.fullname AS user_name
            FROM {$this->bd}inventory_shrinkage m
            LEFT JOIN {$this->bd}shrinkage_reason sr ON sr.id = m.shrinkage_reason_id
            LEFT JOIN {$this->bd}warehouse        w  ON w.id  = m.warehouse_id
            LEFT JOIN {$this->erp}subsidiaries    s  ON s.id  = m.subsidiaries_id
            LEFT JOIN {$this->erp}users           u  ON u.id  = m.user_id
            WHERE m.id = ?
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return $r[0] ?? null;
    }

    function getSalidaDetail($array) {
        $query = "
            SELECT
                d.id, d.quantity, d.cost, d.subtotal,
                d.previous_stock, d.resulting_stock,
                d.item_id, it.name AS item_name, ia.sku
            FROM {$this->bd}detail_inventory_shrinkage d
            INNER JOIN {$this->bd}item it ON it.id = d.item_id
            LEFT  JOIN {$this->bd}item_attribute ia ON ia.item_id = it.id AND ia.active = 1
            WHERE d.inventory_shrinkage_id = ? AND d.active = 1
            ORDER BY d.id ASC
        ";
        return $this->_Read($query, $array);
    }

    function insertSalida($array) {
        $query = "
            INSERT INTO {$this->bd}inventory_shrinkage
                (folio, note, total_products, total_units, total_cost, date_shrinkage, status,
                 shrinkage_reason_id, warehouse_id, subsidiaries_id, user_id, companies_id)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
        ";
        return $this->_CUD($query, $array);
    }

    function insertSalidaDetail($array) {
        $query = "
            INSERT INTO {$this->bd}detail_inventory_shrinkage
                (quantity, cost, subtotal, previous_stock, resulting_stock, item_id, inventory_shrinkage_id)
            VALUES (?,?,?,?,?,?,?)
        ";
        return $this->_CUD($query, $array);
    }

    function cancelSalidaById($array) {
        $query = "
            UPDATE {$this->bd}inventory_shrinkage
            SET status = 'Cancelada', updated_at = NOW()
            WHERE id = ?
        ";
        return $this->_CUD($query, $array);
    }
}
