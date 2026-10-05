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

    function lsSucursales($array) {
        $companyId = $array['company_id'];
        $userId    = $array['user_id'];
        $isOwner   = (int) $array['is_owner'];

        if ($isOwner === 1) {
            $query = "
                SELECT id, name AS valor, company_id AS companies_id
                FROM {$this->bdErp}branches
                WHERE company_id = ? AND is_active = 1
                ORDER BY name ASC
            ";
            $r = $this->_Read($query, [$companyId]);
        } else {
            $query = "
                SELECT b.id, b.name AS valor, b.company_id AS companies_id
                FROM {$this->bdErp}branches b
                INNER JOIN {$this->bdErp}users_braches ub ON ub.branch_id = b.id
                WHERE b.company_id = ? AND b.is_active = 1 AND ub.user_id = ?
                ORDER BY b.name ASC
            ";
            $r = $this->_Read($query, [$companyId, $userId]);
        }
        return is_array($r) ? $r : [];
    }

    function lsCategories($array) {
        $query = "
            SELECT id, name AS valor
            FROM {$this->bd}item_category
            WHERE companies_id = ? AND active = 1
            ORDER BY name ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    function lsAreas($array) {
        $query = "
            SELECT id, name AS valor, color_hex, warehouse_id
            FROM {$this->bd}warehouse_area
            WHERE companies_id = ? AND active = 1
            ORDER BY name ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    function qStock($array) {
        $stockWhere  = 'st.active = 1';
        $stockParams = [];
        if (!empty($array['branch_id'])) {
            $stockWhere   .= ' AND w.branch_id = ?';
            $stockParams[] = $array['branch_id'];
        }

        $where       = 'i.active = 1 AND i.companies_id = ?';
        $whereParams = [$array['companies_id']];

        if (!empty($array['category_id'])) {
            $where .= ' AND i.category_id = ?';
            $whereParams[] = $array['category_id'];
        }

        if (!empty($array['area_id'])) {
            $where .= ' AND ia.warehouse_area_id = ?';
            $whereParams[] = $array['area_id'];
        }

        if (!empty($array['q'])) {
            $where .= ' AND (i.name LIKE ? OR ia.sku LIKE ?)';
            $whereParams[] = '%' . $array['q'] . '%';
            $whereParams[] = '%' . $array['q'] . '%';
        }

        if (!empty($array['movimiento'])) {
            $exists       = "SELECT 1 FROM {$this->bd}inventory_movement mvf
                             WHERE mvf.item_id = i.id AND mvf.companies_id = ?";
            $existsParams = [$array['companies_id']];
            if (!empty($array['branch_id'])) {
                $exists        .= ' AND mvf.branch_id = ?';
                $existsParams[] = $array['branch_id'];
            }
            if ($array['movimiento'] === 'con') {
                $where .= " AND EXISTS ($exists)";
                $whereParams = array_merge($whereParams, $existsParams);
            } elseif ($array['movimiento'] === 'sin') {
                $where .= " AND NOT EXISTS ($exists)";
                $whereParams = array_merge($whereParams, $existsParams);
            }
        }

        $having = '';
        if (!empty($array['nivel'])) {
            if ($array['nivel'] === 'ok') {
                $having = 'HAVING quantity_total > COALESCE(ia.stock_min, 0)';
            } elseif ($array['nivel'] === 'bajo') {
                $having = 'HAVING quantity_total > 0 AND quantity_total <= COALESCE(ia.stock_min, 0)';
            } elseif ($array['nivel'] === 'agotado') {
                $having = 'HAVING quantity_total <= 0';
            }
        }

        // Tipo del ultimo movimiento por item (para mostrar en la columna).
        // Respeta el filtro de sucursal si esta activo. Va primero en el SELECT,
        // por eso sus parametros se anteponen al resto.
        $lastMovSub    = "SELECT lm.movement_type
                          FROM {$this->bd}inventory_movement lm
                          WHERE lm.item_id = i.id AND lm.companies_id = i.companies_id";
        $lastMovParams = [];
        if (!empty($array['branch_id'])) {
            $lastMovSub      .= ' AND lm.branch_id = ?';
            $lastMovParams[]  = $array['branch_id'];
        }
        $lastMovSub .= ' ORDER BY lm.occurred_at DESC, lm.created_at DESC LIMIT 1';

        $data = array_merge($lastMovParams, $stockParams, $whereParams);

        $query = "
            SELECT
                i.id                AS product_id,
                i.name              AS product_name,
                i.image             AS image,
                ia.sku              AS sku,
                i.category_id,
                ic.name             AS category_name,
                ia.cost_unit        AS cost_unit,
                ia.stock_min        AS stock_min,
                ia.stock_max        AS stock_max,
                ia.shelf_life_days  AS shelf_life_days,
                u.code              AS unit_code,
                u.name              AS unit_name,
                wa.name             AS area_name,
                wa.color_hex        AS area_color,
                IFNULL(s.quantity_total, 0) AS quantity_total,
                s.last_movement_at          AS last_movement_at,
                ({$lastMovSub})             AS last_movement_type
            FROM {$this->bd}item i
            LEFT JOIN {$this->bd}item_category   ic ON ic.id = i.category_id
            LEFT JOIN {$this->bd}item_attribute  ia ON ia.item_id = i.id AND ia.active = 1
            LEFT JOIN {$this->bd}unit            u  ON u.id  = ia.unit_id
            LEFT JOIN {$this->bd}warehouse_area  wa ON wa.id = ia.warehouse_area_id
            LEFT JOIN (
                SELECT
                    st.item_id,
                    SUM(st.quantity)         AS quantity_total,
                    MAX(st.last_movement_at) AS last_movement_at
                FROM {$this->bd}stock st
                INNER JOIN {$this->bd}warehouse w ON w.id = st.warehouse_id AND w.active = 1
                WHERE {$stockWhere}
                GROUP BY st.item_id
            ) s ON s.item_id = i.id
            WHERE {$where}
            GROUP BY i.id
            {$having}
            ORDER BY quantity_total DESC, i.name ASC
        ";
        $r = $this->_Read($query, $data);
        return is_array($r) ? $r : [];
    }

    function getStockKpis($array) {
        $stockWhere  = 'st.active = 1';
        $stockParams = [];
        if (!empty($array['branch_id'])) {
            $stockWhere   .= ' AND w.branch_id = ?';
            $stockParams[] = $array['branch_id'];
        }

        $where       = 'i.active = 1 AND i.companies_id = ?';
        $whereParams = [$array['companies_id']];

        if (!empty($array['category_id'])) {
            $where        .= ' AND i.category_id = ?';
            $whereParams[] = $array['category_id'];
        }

        if (!empty($array['area_id'])) {
            $where        .= ' AND ia.warehouse_area_id = ?';
            $whereParams[] = $array['area_id'];
        }

        if (!empty($array['q'])) {
            $where        .= ' AND (i.name LIKE ? OR ia.sku LIKE ?)';
            $whereParams[] = '%' . $array['q'] . '%';
            $whereParams[] = '%' . $array['q'] . '%';
        }

        if (!empty($array['movimiento'])) {
            $exists       = "SELECT 1 FROM {$this->bd}inventory_movement mvf
                             WHERE mvf.item_id = i.id AND mvf.companies_id = ?";
            $existsParams = [$array['companies_id']];
            if (!empty($array['branch_id'])) {
                $exists        .= ' AND mvf.branch_id = ?';
                $existsParams[] = $array['branch_id'];
            }
            if ($array['movimiento'] === 'con') {
                $where      .= " AND EXISTS ($exists)";
                $whereParams = array_merge($whereParams, $existsParams);
            } elseif ($array['movimiento'] === 'sin') {
                $where      .= " AND NOT EXISTS ($exists)";
                $whereParams = array_merge($whereParams, $existsParams);
            }
        }

        $data = array_merge($stockParams, $whereParams);

        $query = "
            SELECT
                COUNT(DISTINCT i.id) AS total_productos,
                SUM(CASE WHEN COALESCE(s.q, 0) > COALESCE(ia.stock_min, 0) THEN 1 ELSE 0 END) AS total_ok,
                SUM(CASE WHEN COALESCE(s.q, 0) > 0 AND COALESCE(s.q, 0) <= COALESCE(ia.stock_min, 0) THEN 1 ELSE 0 END) AS total_bajo,
                SUM(CASE WHEN COALESCE(s.q, 0) = 0 THEN 1 ELSE 0 END) AS total_agotado
            FROM {$this->bd}item i
            LEFT JOIN {$this->bd}item_attribute ia ON ia.item_id = i.id AND ia.active = 1
            LEFT JOIN (
                SELECT st.item_id, SUM(st.quantity) AS q
                FROM {$this->bd}stock st
                INNER JOIN {$this->bd}warehouse w ON w.id = st.warehouse_id AND w.active = 1
                WHERE {$stockWhere}
                GROUP BY st.item_id
            ) s ON s.item_id = i.id
            WHERE {$where}
        ";
        $r = $this->_Read($query, $data);
        return !empty($r) ? $r[0] : [
            'total_productos' => 0,
            'total_ok'        => 0,
            'total_bajo'      => 0,
            'total_agotado'   => 0
        ];
    }

    function getStockByProduct($array) {
        $query = "
            SELECT
                st.id,
                st.quantity,
                st.last_movement_at,
                w.id                AS warehouse_id,
                w.name              AS warehouse_name,
                w.branch_id,
                s.name              AS branch_name,
                wa.name             AS area_name,
                wa.color_hex        AS area_color
            FROM {$this->bd}stock st
            INNER JOIN {$this->bd}warehouse      w  ON w.id = st.warehouse_id
            LEFT  JOIN {$this->bd}warehouse_area wa ON wa.id = w.warehouse_area_id
            LEFT  JOIN {$this->bdErp}branches s ON s.id = w.branch_id
            WHERE st.item_id = ? AND st.active = 1
            ORDER BY s.name ASC, w.name ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    function getProduct($array) {
        $query = "
            SELECT
                i.id,
                i.name,
                i.image,
                i.price,
                i.category_id,
                i.companies_id,
                ic.name             AS category_name,
                ia.id               AS attribute_id,
                ia.sku,
                ia.cost_unit,
                ia.stock_min,
                ia.stock_max,
                ia.shelf_life_days,
                ia.warehouse_area_id,
                ia.unit_id,
                u.code              AS unit_code,
                u.name              AS unit_name,
                wa.name             AS area_name
            FROM {$this->bd}item i
            LEFT JOIN {$this->bd}item_category   ic ON ic.id = i.category_id
            LEFT JOIN {$this->bd}item_attribute  ia ON ia.item_id = i.id AND ia.active = 1
            LEFT JOIN {$this->bd}unit            u  ON u.id  = ia.unit_id
            LEFT JOIN {$this->bd}warehouse_area  wa ON wa.id = ia.warehouse_area_id
            WHERE i.id = ?
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    function getMovimientosByProduct($array) {
        $query = "
            SELECT
                mv.movement_uid,
                mv.movement_type,
                mv.folio,
                mv.quantity,
                mv.cost_unit,
                mv.cost_total,
                mv.stock_prev,
                mv.stock_post,
                mv.occurred_at,
                mv.created_at,
                mv.warehouse_id,
                w.name AS warehouse_name,
                mv.branch_id,
                b.name AS branch_name
            FROM {$this->bd}inventory_movement mv
            LEFT JOIN {$this->bd}warehouse w ON w.id = mv.warehouse_id
            LEFT JOIN {$this->bdErp}branches b ON b.id = mv.branch_id
            WHERE mv.item_id = ? AND mv.companies_id = ?
            ORDER BY mv.created_at DESC
            LIMIT 20
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    // Actividad de movimiento agregada por dia de los ultimos 14 dias:
    // entradas (quantity > 0) y salidas (quantity < 0) por separado. Alimenta
    // la tendencia de comportamiento de 7 dias + el delta contra la semana
    // previa.
    function getMovActividadDiaria($array) {
        $query = "
            SELECT
                DATE(mv.occurred_at) AS dia,
                SUM(CASE WHEN mv.quantity > 0 THEN mv.quantity ELSE 0 END)      AS entrada,
                SUM(CASE WHEN mv.quantity < 0 THEN ABS(mv.quantity) ELSE 0 END) AS salida
            FROM {$this->bd}inventory_movement mv
            WHERE mv.item_id = ? AND mv.companies_id = ?
              AND mv.occurred_at >= DATE_SUB(CURDATE(), INTERVAL 13 DAY)
            GROUP BY DATE(mv.occurred_at)
            ORDER BY dia ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    // -- Conteo fisico (inventory_adjustment, migracion 2026-10-01_conteo-fisico.sql) --

    function getDefaultWarehouse($array) {
        // [branch_id, companies_id]
        $query = "
            SELECT id, name
            FROM {$this->bd}warehouse
            WHERE branch_id = ? AND companies_id = ? AND active = 1
            ORDER BY is_default DESC, id ASC
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    // Conteo que sigue abierto en el almacen: se retoma en vez de abrir otro.
    function getOpenConteo($array) {
        // [warehouse_id, companies_id]
        $query = "
            SELECT id
            FROM {$this->bd}inventory_adjustment
            WHERE warehouse_id = ? AND companies_id = ? AND active = 1
              AND adjustment_type = 'fisico'
              AND status IN ('Borrador', 'Pendiente')
            ORDER BY id DESC
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    function getReasonByCode($array) {
        $query = "
            SELECT id
            FROM {$this->bd}adjustment_reason
            WHERE code = ? AND active = 1
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    function nextFolio($prefix, $tabla, $companies_id) {
        $query = "
            SELECT folio
            FROM {$this->bd}{$tabla}
            WHERE companies_id = ? AND folio LIKE ?
            ORDER BY id DESC
            LIMIT 1
        ";
        $r    = $this->_Read($query, [$companies_id, $prefix . '%']);
        $next = 1;
        if (!empty($r)) {
            $num  = (int) preg_replace('/[^0-9]/', '', substr($r[0]['folio'], strlen($prefix)));
            $next = $num + 1;
        }
        return $prefix . str_pad($next, 4, '0', STR_PAD_LEFT);
    }

    function createConteo($array) {
        // [folio, adjustment_reason_id, registered_user_id, warehouse_id, branch_id, companies_id]
        $query = "
            INSERT INTO {$this->bd}inventory_adjustment
                (folio, adjustment_type, status, date_adjustment, time_adjustment,
                 adjustment_reason_id, registered_user_id, warehouse_id, branch_id, companies_id)
            VALUES (?, 'fisico', 'Borrador', CURDATE(), CURTIME(), ?, ?, ?, ?, ?)
        ";
        return $this->_CUD($query, $array);
    }

    function getConteoIdByFolio($array) {
        // [folio, companies_id]
        $query = "
            SELECT id
            FROM {$this->bd}inventory_adjustment
            WHERE folio = ? AND companies_id = ?
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    // Un renglon por producto activo; el costo es el ultimo de compra.
    function createConteoDetail($array) {
        // [inventory_adjustment_id, companies_id]
        $query = "
            INSERT INTO {$this->bd}detail_inventory_adjustment (inventory_adjustment_id, item_id, cost)
            SELECT ?, i.id, MAX(ia.cost_unit)
            FROM {$this->bd}item i
            LEFT JOIN {$this->bd}item_attribute ia ON ia.item_id = i.id AND ia.active = 1
            WHERE i.active = 1 AND i.companies_id = ?
            GROUP BY i.id
        ";
        return $this->_CUD($query, $array);
    }

    function createConteoHistory($array) {
        // [status, note, user_id, inventory_adjustment_id]
        $query = "
            INSERT INTO {$this->bd}inventory_adjustment_history (status, note, user_id, inventory_adjustment_id)
            VALUES (?, ?, ?, ?)
        ";
        return $this->_CUD($query, $array);
    }

    function getConteoById($array) {
        // [id, companies_id]
        $query = "
            SELECT
                r.*,
                w.name AS warehouse_name,
                ar.name AS reason_name,
                CONCAT_WS(' ', ur.name, ur.last_name) AS registered_name,
                CONCAT_WS(' ', ua.name, ua.last_name) AS authorized_name
            FROM {$this->bd}inventory_adjustment r
            LEFT JOIN {$this->bd}warehouse         w  ON w.id  = r.warehouse_id
            LEFT JOIN {$this->bd}adjustment_reason ar ON ar.id = r.adjustment_reason_id
            LEFT JOIN {$this->bdErp}users          ur ON ur.id = r.registered_user_id
            LEFT JOIN {$this->bdErp}users          ua ON ua.id = r.authorized_user_id
            WHERE r.id = ? AND r.companies_id = ? AND r.active = 1
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    // Credenciales del usuario en sesión para reconfirmar su contraseña al cancelar.
    function qUserPassword($array) {
        // [user_id]
        $query = "
            SELECT password, `key` AS user_key
            FROM {$this->bdErp}users
            WHERE id = ? AND status = 'active'
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    // Renglones con el stock vivo del almacen, ordenados por area (sin area al final).
    function listConteoDetail($array) {
        // [warehouse_id, inventory_adjustment_id]
        $query = "
            SELECT
                d.id                AS detail_id,
                d.item_id,
                d.system_quantity,
                d.physical_quantity,
                d.difference,
                d.cost,
                d.cost_diff,
                d.counted_at,
                d.previous_stock,
                d.resulting_stock,
                i.name              AS item_name,
                ia.sku              AS sku,
                u.code              AS unit_code,
                wa.id               AS area_id,
                wa.name             AS area_name,
                wa.color_hex        AS area_color,
                IFNULL(MAX(st.quantity), 0) AS stock_live,
                MAX(st.id)          AS stock_id
            FROM {$this->bd}detail_inventory_adjustment d
            INNER JOIN {$this->bd}item           i  ON i.id  = d.item_id
            LEFT JOIN {$this->bd}item_attribute  ia ON ia.item_id = i.id AND ia.active = 1
            LEFT JOIN {$this->bd}unit            u  ON u.id  = ia.unit_id
            LEFT JOIN {$this->bd}warehouse_area  wa ON wa.id = ia.warehouse_area_id AND wa.active = 1
            LEFT JOIN {$this->bd}stock           st ON st.item_id = d.item_id AND st.warehouse_id = ? AND st.active = 1
            WHERE d.inventory_adjustment_id = ? AND d.active = 1
            GROUP BY d.id
            ORDER BY wa.name IS NULL, wa.name ASC, i.name ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    function updateConteoDetail($array) {
        // [system_quantity, physical_quantity, difference, cost, cost_diff, id]
        $query = "
            UPDATE {$this->bd}detail_inventory_adjustment
            SET system_quantity = ?, physical_quantity = ?, difference = ?, cost = ?, cost_diff = ?, counted_at = NOW()
            WHERE id = ?
        ";
        return $this->_CUD($query, $array);
    }

    function clearConteoDetail($array) {
        // [id]
        $query = "
            UPDATE {$this->bd}detail_inventory_adjustment
            SET system_quantity = NULL, physical_quantity = NULL, difference = NULL, cost_diff = 0, counted_at = NULL
            WHERE id = ?
        ";
        return $this->_CUD($query, $array);
    }

    function updateConteoDetailStock($array) {
        // [previous_stock, resulting_stock, id]
        $query = "
            UPDATE {$this->bd}detail_inventory_adjustment
            SET previous_stock = ?, resulting_stock = ?
            WHERE id = ?
        ";
        return $this->_CUD($query, $array);
    }

    function updateConteoTotals($array) {
        // [inventory_adjustment_id, inventory_adjustment_id]
        $query = "
            UPDATE {$this->bd}inventory_adjustment r
            INNER JOIN (
                SELECT
                    inventory_adjustment_id,
                    COUNT(*)                                             AS total_products,
                    SUM(physical_quantity IS NOT NULL)                   AS total_counted,
                    SUM(physical_quantity IS NOT NULL AND difference <> 0) AS total_differences,
                    COALESCE(SUM(difference), 0)                         AS total_diff_units,
                    COALESCE(SUM(cost_diff), 0)                          AS total_diff_cost
                FROM {$this->bd}detail_inventory_adjustment
                WHERE inventory_adjustment_id = ? AND active = 1
                GROUP BY inventory_adjustment_id
            ) t ON t.inventory_adjustment_id = r.id
            SET r.total_products    = t.total_products,
                r.total_counted     = t.total_counted,
                r.total_differences = t.total_differences,
                r.total_diff_units  = t.total_diff_units,
                r.total_diff_cost   = t.total_diff_cost
            WHERE r.id = ?
        ";
        return $this->_CUD($query, $array);
    }

    function updateConteo($array) {
        return $this->_Update([
            'table'  => "{$this->bd}inventory_adjustment",
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data']
        ]);
    }

    function listAjustes($array) {
        $where = 'r.active = 1 AND r.companies_id = ?';
        $data  = [$array['companies_id']];

        if (!empty($array['branch_id'])) {
            $where .= ' AND r.branch_id = ?';
            $data[] = $array['branch_id'];
        }
        if (!empty($array['status'])) {
            $where .= ' AND r.status = ?';
            $data[] = $array['status'];
        }

        $query = "
            SELECT
                r.id,
                r.folio,
                r.status,
                r.date_adjustment,
                r.time_adjustment,
                r.total_products,
                r.total_counted,
                r.total_differences,
                r.total_diff_cost,
                w.name AS warehouse_name,
                CONCAT_WS(' ', ur.name, ur.last_name) AS registered_name,
                CONCAT_WS(' ', ua.name, ua.last_name) AS authorized_name
            FROM {$this->bd}inventory_adjustment r
            LEFT JOIN {$this->bd}warehouse w  ON w.id  = r.warehouse_id
            LEFT JOIN {$this->bdErp}users  ur ON ur.id = r.registered_user_id
            LEFT JOIN {$this->bdErp}users  ua ON ua.id = r.authorized_user_id
            WHERE {$where}
            ORDER BY r.id DESC
        ";
        $r = $this->_Read($query, $data);
        return is_array($r) ? $r : [];
    }

    function getStockRow($array) {
        // [item_id, warehouse_id]
        $query = "
            SELECT id, quantity
            FROM {$this->bd}stock
            WHERE item_id = ? AND warehouse_id = ? AND active = 1
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    function insertStockConteo($array) {
        // [quantity, warehouse_id, item_id, companies_id]
        $query = "
            INSERT INTO {$this->bd}stock
                (quantity, last_movement_at, last_inventory_at, warehouse_id, item_id, companies_id)
            VALUES (?, NOW(), NOW(), ?, ?, ?)
        ";
        return $this->_CUD($query, $array);
    }

    function updateStockConteo($array) {
        // [quantity, id]
        $query = "
            UPDATE {$this->bd}stock
            SET quantity = ?, last_movement_at = NOW(), last_inventory_at = NOW(), updated_at = NOW()
            WHERE id = ?
        ";
        return $this->_CUD($query, $array);
    }

    // Al cancelar un ajuste aplicado: no es inventario, no toca last_inventory_at.
    function updateStockQuantity($array) {
        // [quantity, id]
        $query = "
            UPDATE {$this->bd}stock
            SET quantity = ?, last_movement_at = NOW(), updated_at = NOW()
            WHERE id = ?
        ";
        return $this->_CUD($query, $array);
    }

    // Producto contado sin diferencia: solo queda la fecha del ultimo inventario.
    function updateStockInventoryAt($array) {
        // [id]
        $query = "
            UPDATE {$this->bd}stock
            SET last_inventory_at = NOW()
            WHERE id = ?
        ";
        return $this->_CUD($query, $array);
    }
}
