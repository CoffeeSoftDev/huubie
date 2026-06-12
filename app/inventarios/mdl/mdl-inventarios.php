<?php
require_once '../../conf/_CRUD.php';
require_once '../../conf/_Utileria.php';

class mdl extends CRUD {
    public $util;
    public $bd;
    public $bdAlpha;
    public $bdAdmin;

    public function __construct() {
        $this->util    = new Utileria;
        $this->bd      = 'fayxzvov_reginas.';
        $this->bdAlpha = 'fayxzvov_alpha.';
        $this->bdAdmin = 'fayxzvov_admin.';
    }

    // ─────────────────────────────────────────────────────────────────
    //  CATALOGOS BASE
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

    function lsWarehouses($array) {
        $where = 'w.active = 1 AND w.companies_id = ?';
        $data  = [$array['companies_id']];

        if (!empty($array['subsidiaries_id'])) {
            $where .= ' AND w.subsidiaries_id = ?';
            $data[] = $array['subsidiaries_id'];
        }

        $query = "
            SELECT
                w.id,
                w.name,
                w.name AS valor,
                w.is_default,
                w.subsidiaries_id,
                w.warehouse_area_id,
                wa.name AS area_name,
                wa.color_hex AS area_color,
                s.name  AS subsidiary_name
            FROM {$this->bd}warehouse w
            LEFT JOIN {$this->bd}warehouse_area wa ON wa.id = w.warehouse_area_id
            LEFT JOIN {$this->bdAlpha}subsidiaries s ON s.id = w.subsidiaries_id
            WHERE {$where}
            ORDER BY s.name ASC, w.is_default DESC, w.name ASC
        ";
        $r = $this->_Read($query, $data);
        return is_array($r) ? $r : [];
    }

    function lsAreas($array) {
        $query = "
            SELECT id, name, name AS valor, color_hex, description
            FROM {$this->bd}warehouse_area
            WHERE companies_id = ? AND active = 1
            ORDER BY name ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    function lsUnits() {
        $query = "
            SELECT id, code, name, code AS valor
            FROM {$this->bd}unit
            WHERE active = 1
            ORDER BY id ASC
        ";
        $r = $this->_Read($query);
        return is_array($r) ? $r : [];
    }

    function lsSuppliers($array) {
        $query = "
            SELECT id, name, name AS valor, contact_name, phone, email
            FROM {$this->bd}supplier
            WHERE companies_id = ? AND active = 1
            ORDER BY name ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    function lsInflowOrigins() {
        $query = "
            SELECT id, code, name, name AS valor, icon, color_hex, requires_supplier
            FROM {$this->bd}inflow_origin
            WHERE active = 1
            ORDER BY id ASC
        ";
        $r = $this->_Read($query);
        return is_array($r) ? $r : [];
    }

    function lsShrinkageReasons() {
        $query = "
            SELECT id, code, name, name AS valor, icon, color_hex
            FROM {$this->bd}shrinkage_reason
            WHERE active = 1
            ORDER BY id ASC
        ";
        $r = $this->_Read($query);
        return is_array($r) ? $r : [];
    }

    function lsAdjustmentReasons() {
        $query = "
            SELECT id, code, name, name AS valor, icon, color_hex, affects_cost
            FROM {$this->bd}adjustment_reason
            WHERE active = 1
            ORDER BY id ASC
        ";
        $r = $this->_Read($query);
        return is_array($r) ? $r : [];
    }

    function lsCategories($array) {
        $query = "
            SELECT id, classification AS name, classification AS valor
            FROM {$this->bd}order_category
            WHERE active = 1
            ORDER BY classification ASC
        ";
        $r = $this->_Read($query);
        return is_array($r) ? $r : [];
    }

    // ─────────────────────────────────────────────────────────────────
    //  CATALOGO PRODUCTOS (payload de init)
    // ─────────────────────────────────────────────────────────────────

    function qProductsForTransfer($array) {
        $query = "
            SELECT
                p.id                                       AS id,
                p.name                                     AS nombre,
                pa.sku                                     AS sku,
                oc.classification                          AS categoria,
                COALESCE(pa.cost_unit, p.price, 0)         AS costo,
                p.price                                    AS precio,
                p.image                                    AS image
            FROM {$this->bd}order_products p
            LEFT JOIN {$this->bdAlpha}subsidiaries  ps ON ps.id = p.subsidiaries_id
            LEFT JOIN {$this->bd}product_attribute  pa ON pa.product_id = p.id AND pa.active = 1
            LEFT JOIN {$this->bd}order_category     oc ON oc.id = p.category_id
            WHERE p.active = 1 AND COALESCE(p.companies_id, ps.companies_id) = ?
              AND (oc.id IS NULL OR oc.active = 1)
            ORDER BY p.name ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    // ─────────────────────────────────────────────────────────────────
    //  AJUSTES (inventory_adjustment)
    // ─────────────────────────────────────────────────────────────────

    function qAjustes($array) {
        $where = 'a.active = 1 AND a.companies_id = ?';
        $data  = [$array['companies_id']];

        if (!empty($array['subsidiaries_id'])) {
            $where .= ' AND a.subsidiaries_id = ?';
            $data[] = $array['subsidiaries_id'];
        }
        if (!empty($array['reason_id'])) {
            $where .= ' AND a.adjustment_reason_id = ?';
            $data[] = $array['reason_id'];
        }
        if (!empty($array['fi']) && !empty($array['ff'])) {
            $where .= ' AND a.date_adjustment BETWEEN ? AND ?';
            $data[] = $array['fi'];
            $data[] = $array['ff'];
        }

        $query = "
            SELECT
                a.id,
                a.folio,
                a.note,
                a.adjustment_type,
                a.total_products,
                a.total_diff_units,
                a.total_diff_cost,
                a.date_adjustment,
                a.time_adjustment,
                a.status,
                a.created_at,
                a.adjustment_reason_id,
                ar.name              AS reason_name,
                ar.color_hex         AS reason_color,
                a.warehouse_id,
                w.name               AS warehouse_name,
                a.subsidiaries_id,
                s.name               AS subsidiary_name,
                a.registered_user_id,
                ur.fullname          AS registered_user_name,
                a.authorized_user_id,
                ua.fullname          AS authorized_user_name
            FROM {$this->bd}inventory_adjustment a
            LEFT JOIN {$this->bd}adjustment_reason ar ON ar.id = a.adjustment_reason_id
            LEFT JOIN {$this->bd}warehouse         w  ON w.id  = a.warehouse_id
            LEFT JOIN {$this->bdAlpha}subsidiaries s  ON s.id  = a.subsidiaries_id
            LEFT JOIN {$this->bdAlpha}usr_users    ur ON ur.id = a.registered_user_id
            LEFT JOIN {$this->bdAlpha}usr_users    ua ON ua.id = a.authorized_user_id
            WHERE {$where}
            ORDER BY a.date_adjustment DESC, a.time_adjustment DESC
        ";
        $r = $this->_Read($query, $data);
        return is_array($r) ? $r : [];
    }

    function getAjusteKpis($array) {
        $where = 'a.active = 1 AND a.companies_id = ?';
        $data  = [$array['companies_id']];

        if (!empty($array['fi']) && !empty($array['ff'])) {
            $where .= ' AND a.date_adjustment BETWEEN ? AND ?';
            $data[] = $array['fi'];
            $data[] = $array['ff'];
        }

        $query = "
            SELECT
                COUNT(a.id)                          AS total_ajustes,
                IFNULL(SUM(a.total_diff_cost), 0)    AS total_diff_cost,
                IFNULL(SUM(a.total_diff_units), 0)   AS total_diff_units
            FROM {$this->bd}inventory_adjustment a
            WHERE {$where}
        ";
        $r = $this->_Read($query, $data);
        return !empty($r) ? $r[0] : [
            'total_ajustes'    => 0,
            'total_diff_cost'  => 0,
            'total_diff_units' => 0
        ];
    }

    function qGetAjuste($array) {
        $query = "
            SELECT
                a.*,
                ar.name AS reason_name,
                ar.color_hex AS reason_color,
                w.name  AS warehouse_name,
                s.name  AS subsidiary_name,
                ur.fullname AS registered_user_name,
                ua.fullname AS authorized_user_name
            FROM {$this->bd}inventory_adjustment a
            LEFT JOIN {$this->bd}adjustment_reason ar ON ar.id = a.adjustment_reason_id
            LEFT JOIN {$this->bd}warehouse         w  ON w.id  = a.warehouse_id
            LEFT JOIN {$this->bdAlpha}subsidiaries s  ON s.id  = a.subsidiaries_id
            LEFT JOIN {$this->bdAlpha}usr_users    ur ON ur.id = a.registered_user_id
            LEFT JOIN {$this->bdAlpha}usr_users    ua ON ua.id = a.authorized_user_id
            WHERE a.id = ?
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    function getAjusteDetail($array) {
        $query = "
            SELECT
                d.id,
                d.system_quantity,
                d.physical_quantity,
                d.difference,
                d.cost,
                d.cost_diff,
                d.previous_stock,
                d.resulting_stock,
                d.product_id,
                p.name              AS product_name,
                pa.sku
            FROM {$this->bd}detail_inventory_adjustment d
            INNER JOIN {$this->bd}order_products p ON p.id = d.product_id
            LEFT  JOIN {$this->bd}product_attribute pa ON pa.product_id = p.id AND pa.active = 1
            WHERE d.inventory_adjustment_id = ? AND d.active = 1
            ORDER BY d.id ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    function insertAjuste($array) {
        $query = "
            INSERT INTO {$this->bd}inventory_adjustment
                (folio, note, adjustment_type, total_products, total_diff_units,
                 total_diff_cost, date_adjustment, time_adjustment, status,
                 adjustment_reason_id, warehouse_id, subsidiaries_id,
                 registered_user_id, authorized_user_id, companies_id)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ";
        return $this->_CUD($query, $array);
    }

    function insertAjusteDetail($array) {
        $query = "
            INSERT INTO {$this->bd}detail_inventory_adjustment
                (system_quantity, physical_quantity, difference, cost, cost_diff,
                 previous_stock, resulting_stock, product_id, inventory_adjustment_id)
            VALUES (?,?,?,?,?,?,?,?,?)
        ";
        return $this->_CUD($query, $array);
    }

    function qReverseAjuste($array) {
        // status es ENUM('Pendiente','Aplicado','Cancelado'). Se unifica con el resto
        // del inventario (entradas/mermas usan 'Cancelada'); aqui en masculino.
        $query = "
            UPDATE {$this->bd}inventory_adjustment
            SET status = 'Cancelado', updated_at = NOW()
            WHERE id = ?
        ";
        return $this->_CUD($query, $array);
    }

    // ─────────────────────────────────────────────────────────────────
    //  STOCK (mantenimiento)
    // ─────────────────────────────────────────────────────────────────

    function getStockRow($array) {
        $query = "
            SELECT id, quantity
            FROM {$this->bd}stock
            WHERE product_id = ? AND warehouse_id = ? AND active = 1
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    function insertStockRow($array) {
        $query = "
            INSERT INTO {$this->bd}stock
                (quantity, last_movement_at, warehouse_id, product_id, companies_id)
            VALUES (?, NOW(), ?, ?, ?)
        ";
        return $this->_CUD($query, $array);
    }

    function updateStockQuantity($array) {
        $query = "
            UPDATE {$this->bd}stock
            SET quantity = ?, last_movement_at = NOW(), updated_at = NOW()
            WHERE id = ?
        ";
        return $this->_CUD($query, $array);
    }

    function updateStockLastInventory($array) {
        $query = "
            UPDATE {$this->bd}stock
            SET quantity = ?, last_movement_at = NOW(), last_inventory_at = NOW(), updated_at = NOW()
            WHERE id = ?
        ";
        return $this->_CUD($query, $array);
    }

    // ─────────────────────────────────────────────────────────────────
    //  FOLIOS / UTILIDADES
    // ─────────────────────────────────────────────────────────────────

    function nextFolio($prefix, $tabla, $companies_id) {
        $query = "
            SELECT folio
            FROM {$this->bd}{$tabla}
            WHERE companies_id = ? AND folio LIKE ?
            ORDER BY id DESC
            LIMIT 1
        ";
        $r = $this->_Read($query, [$companies_id, $prefix . '%']);
        $next = 1;
        if (!empty($r)) {
            $folio = $r[0]['folio'];
            $num = (int) preg_replace('/[^0-9]/', '', substr($folio, strlen($prefix)));
            $next = $num + 1;
        }
        return $prefix . str_pad($next, 4, '0', STR_PAD_LEFT);
    }

    // ─────────────────────────────────────────────────────────────────
    //  ALMACENES (admin)
    // ─────────────────────────────────────────────────────────────────

    function insertWarehouse($array) {
        $query = "
            INSERT INTO {$this->bd}warehouse
                (name, is_default, warehouse_area_id, subsidiaries_id, companies_id)
            VALUES (?,?,?,?,?)
        ";
        return $this->_CUD($query, $array);
    }

    function updateWarehouse($array) {
        return $this->_Update([
            'table'  => "{$this->bd}warehouse",
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data']
        ]);
    }

    function disableWarehouse($array) {
        $query = "UPDATE {$this->bd}warehouse SET active = 0 WHERE id = ?";
        return $this->_CUD($query, $array);
    }

    // ─────────────────────────────────────────────────────────────────
    //  PRODUCT ATTRIBUTE (admin)
    // ─────────────────────────────────────────────────────────────────

    function insertProductAttribute($array) {
        $query = "
            INSERT INTO {$this->bd}product_attribute
                (sku, description, shelf_life_days, cost_unit, stock_min, stock_max,
                 warehouse_area_id, unit_id, product_id, companies_id)
            VALUES (?,?,?,?,?,?,?,?,?,?)
        ";
        return $this->_CUD($query, $array);
    }

    function updateProductAttribute($array) {
        return $this->_Update([
            'table'  => "{$this->bd}product_attribute",
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data']
        ]);
    }
}
