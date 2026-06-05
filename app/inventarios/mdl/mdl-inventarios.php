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

    function getInflowOrigin($array) {
        $query = "
            SELECT id, code, name, requires_supplier
            FROM {$this->bd}inflow_origin
            WHERE id = ?
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
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

    function lsTransferStatuses() {
        $query = "
            SELECT id, code, name, name AS valor, order_index, is_terminal, color_hex
            FROM {$this->bd}transfer_status
            WHERE active = 1
            ORDER BY order_index ASC
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
    //  STOCK
    // ─────────────────────────────────────────────────────────────────

    function qStock($array) {
        // El stock se ubica por el ALMACEN (stock.warehouse_id -> warehouse.subsidiaries_id),
        // NO por la sucursal del catalogo del producto. Por eso se pre-agrega en una
        // subconsulta por producto: asi el SUM no se infla aunque hubiera mas de un
        // product_attribute activo, y el filtro de sucursal aplica sobre el almacen.
        //   - Con sucursal: INNER JOIN -> solo productos con existencias en esa sucursal,
        //     sumando unicamente el stock de sus almacenes.
        //   - Sin sucursal: LEFT JOIN  -> consolidado de todas (productos sin stock incluidos).
        $stockWhere  = 'st.active = 1';
        $stockParams = [];
        $joinType    = 'LEFT';
        if (!empty($array['subsidiaries_id'])) {
            $stockWhere   .= ' AND w.subsidiaries_id = ?';
            $stockParams[] = $array['subsidiaries_id'];
            $joinType      = 'INNER';
        }

        $where       = 'p.active = 1 AND COALESCE(p.companies_id, ps.companies_id) = ?';
        $whereParams = [$array['companies_id']];

        if (!empty($array['category_id'])) {
            $where .= ' AND p.category_id = ?';
            $whereParams[] = $array['category_id'];
        }

        if (!empty($array['q'])) {
            $where .= ' AND (p.name LIKE ? OR pa.sku LIKE ?)';
            $whereParams[] = '%' . $array['q'] . '%';
            $whereParams[] = '%' . $array['q'] . '%';
        }

        $having = '';
        if (!empty($array['nivel'])) {
            if ($array['nivel'] === 'ok') {
                $having = 'HAVING quantity_total > COALESCE(pa.stock_min, 0)';
            } elseif ($array['nivel'] === 'bajo') {
                $having = 'HAVING quantity_total > 0 AND quantity_total <= COALESCE(pa.stock_min, 0)';
            } elseif ($array['nivel'] === 'agotado') {
                $having = 'HAVING quantity_total <= 0';
            }
        }

        // Orden de los placeholders: primero el de la subconsulta (FROM), luego los del WHERE.
        $data = array_merge($stockParams, $whereParams);

        $query = "
            SELECT
                p.id                AS product_id,
                p.name              AS product_name,
                pa.sku              AS sku,
                p.category_id,
                oc.classification   AS category_name,
                pa.cost_unit        AS cost_unit,
                pa.stock_min        AS stock_min,
                pa.stock_max        AS stock_max,
                pa.shelf_life_days  AS shelf_life_days,
                u.code              AS unit_code,
                u.name              AS unit_name,
                wa.name             AS area_name,
                wa.color_hex        AS area_color,
                IFNULL(s.quantity_total, 0) AS quantity_total,
                s.last_movement_at          AS last_movement_at,
                s.last_inventory_at         AS last_inventory_at
            FROM {$this->bd}order_products p
            LEFT JOIN {$this->bdAlpha}subsidiaries ps ON ps.id = p.subsidiaries_id
            LEFT JOIN {$this->bd}order_category    oc ON oc.id = p.category_id
            LEFT JOIN {$this->bd}product_attribute pa ON pa.product_id = p.id AND pa.active = 1
            LEFT JOIN {$this->bd}unit              u  ON u.id  = pa.unit_id
            LEFT JOIN {$this->bd}warehouse_area    wa ON wa.id = pa.warehouse_area_id
            {$joinType} JOIN (
                SELECT
                    st.product_id,
                    SUM(st.quantity)          AS quantity_total,
                    MAX(st.last_movement_at)  AS last_movement_at,
                    MAX(st.last_inventory_at) AS last_inventory_at
                FROM {$this->bd}stock st
                INNER JOIN {$this->bd}warehouse w ON w.id = st.warehouse_id AND w.active = 1
                WHERE {$stockWhere}
                GROUP BY st.product_id
            ) s ON s.product_id = p.id
            WHERE {$where}
            GROUP BY p.id
            {$having}
            ORDER BY p.name ASC
        ";
        $r = $this->_Read($query, $data);
        return is_array($r) ? $r : [];
    }

    function getStockKpis($array) {
        // Coherente con qStock: el stock se filtra por la sucursal del ALMACEN.
        //   - Con sucursal: INNER JOIN -> KPIs solo de productos con existencias en ella.
        //   - Sin sucursal: LEFT JOIN  -> consolidado (todos los productos de la empresa).
        $stockWhere  = 'st.active = 1';
        $stockParams = [];
        $joinType    = 'LEFT';
        if (!empty($array['subsidiaries_id'])) {
            $stockWhere   .= ' AND w.subsidiaries_id = ?';
            $stockParams[] = $array['subsidiaries_id'];
            $joinType      = 'INNER';
        }

        $where       = 'p.active = 1 AND COALESCE(p.companies_id, ps.companies_id) = ?';
        $whereParams = [$array['companies_id']];

        $data = array_merge($stockParams, $whereParams);

        $query = "
            SELECT
                COUNT(DISTINCT p.id) AS total_productos,
                SUM(CASE WHEN COALESCE(s.q, 0) > COALESCE(pa.stock_min, 0) THEN 1 ELSE 0 END) AS total_ok,
                SUM(CASE WHEN COALESCE(s.q, 0) > 0 AND COALESCE(s.q, 0) <= COALESCE(pa.stock_min, 0) THEN 1 ELSE 0 END) AS total_bajo,
                SUM(CASE WHEN COALESCE(s.q, 0) = 0 THEN 1 ELSE 0 END) AS total_agotado
            FROM {$this->bd}order_products p
            LEFT JOIN {$this->bdAlpha}subsidiaries ps ON ps.id = p.subsidiaries_id
            LEFT JOIN {$this->bd}product_attribute pa ON pa.product_id = p.id AND pa.active = 1
            {$joinType} JOIN (
                SELECT st.product_id, SUM(st.quantity) AS q
                FROM {$this->bd}stock st
                INNER JOIN {$this->bd}warehouse w ON w.id = st.warehouse_id AND w.active = 1
                WHERE {$stockWhere}
                GROUP BY st.product_id
            ) s ON s.product_id = p.id
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
                st.last_inventory_at,
                w.id                AS warehouse_id,
                w.name              AS warehouse_name,
                w.subsidiaries_id,
                s.name              AS subsidiary_name,
                wa.name             AS area_name,
                wa.color_hex        AS area_color
            FROM {$this->bd}stock st
            INNER JOIN {$this->bd}warehouse      w  ON w.id = st.warehouse_id
            LEFT  JOIN {$this->bd}warehouse_area wa ON wa.id = w.warehouse_area_id
            LEFT  JOIN {$this->bdAlpha}subsidiaries s ON s.id = w.subsidiaries_id
            WHERE st.product_id = ? AND st.active = 1
            ORDER BY s.name ASC, w.name ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    function getProduct($array) {
        $query = "
            SELECT
                p.id,
                p.name,
                p.price,
                p.category_id,
                p.subsidiaries_id,
                p.companies_id,
                oc.classification   AS category_name,
                pa.id               AS attribute_id,
                pa.sku,
                pa.description      AS attribute_description,
                pa.cost_unit,
                pa.stock_min,
                pa.stock_max,
                pa.shelf_life_days,
                pa.warehouse_area_id,
                pa.unit_id,
                u.code              AS unit_code,
                u.name              AS unit_name,
                wa.name             AS area_name
            FROM {$this->bd}order_products p
            LEFT JOIN {$this->bd}order_category   oc ON oc.id = p.category_id
            LEFT JOIN {$this->bd}product_attribute pa ON pa.product_id = p.id AND pa.active = 1
            LEFT JOIN {$this->bd}unit              u  ON u.id  = pa.unit_id
            LEFT JOIN {$this->bd}warehouse_area    wa ON wa.id = pa.warehouse_area_id
            WHERE p.id = ?
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    // ─────────────────────────────────────────────────────────────────
    //  CATALOGO PRODUCTOS + STOCK POR SUCURSAL (modal de traspasos)
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
            ORDER BY p.name ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    function qStockBySubsidiary($array) {
        $query = "
            SELECT
                st.product_id       AS product_id,
                w.subsidiaries_id   AS subsidiaries_id,
                SUM(st.quantity)    AS qty
            FROM {$this->bd}stock st
            INNER JOIN {$this->bd}warehouse w ON w.id = st.warehouse_id
            WHERE st.active = 1 AND w.companies_id = ?
            GROUP BY st.product_id, w.subsidiaries_id
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    // ─────────────────────────────────────────────────────────────────
    //  ENTRADAS (inventory_inflow)
    // ─────────────────────────────────────────────────────────────────

    function qEntradas($array) {
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
            // 'Activas' = pseudo-estado del filtro: todo menos Cancelada.
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

        if (!empty($array['q'])) {
            $where .= ' AND (i.folio LIKE ? OR i.note LIKE ?)';
            $data[] = '%' . $array['q'] . '%';
            $data[] = '%' . $array['q'] . '%';
        }

        $query = "
            SELECT
                i.id,
                i.folio,
                i.note,
                i.total_products,
                i.total_units,
                i.total_cost,
                i.date_inflow,
                i.status,
                i.created_at,
                i.inflow_origin_id,
                io.name              AS origin_name,
                io.color_hex         AS origin_color,
                io.icon              AS origin_icon,
                i.warehouse_id,
                w.name               AS warehouse_name,
                i.supplier_id,
                sp.name              AS supplier_name,
                i.subsidiaries_id,
                s.name               AS subsidiary_name,
                i.user_id,
                u.fullname           AS user_name
            FROM {$this->bd}inventory_inflow i
            LEFT JOIN {$this->bd}inflow_origin io ON io.id = i.inflow_origin_id
            LEFT JOIN {$this->bd}warehouse     w  ON w.id  = i.warehouse_id
            LEFT JOIN {$this->bd}supplier      sp ON sp.id = i.supplier_id
            LEFT JOIN {$this->bdAlpha}subsidiaries s ON s.id = i.subsidiaries_id
            LEFT JOIN {$this->bdAlpha}usr_users    u ON u.id = i.user_id
            WHERE {$where}
            ORDER BY i.date_inflow DESC, i.created_at DESC
        ";
        $r = $this->_Read($query, $data);
        return is_array($r) ? $r : [];
    }

    function getEntradaKpis($array) {
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
            // 'Activas' = pseudo-estado del filtro: todo menos Cancelada.
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
        if (!empty($array['q'])) {
            $where .= ' AND (i.folio LIKE ? OR i.note LIKE ?)';
            $data[] = '%' . $array['q'] . '%';
            $data[] = '%' . $array['q'] . '%';
        }

        $query = "
            SELECT
                COUNT(i.id)                                      AS total_entradas,
                IFNULL(SUM(i.total_cost), 0)                     AS total_costo,
                IFNULL(SUM(i.total_units), 0)                    AS total_unidades,
                COUNT(CASE WHEN i.status = 'Aplicada' THEN 1 END) AS total_aplicadas
            FROM {$this->bd}inventory_inflow i
            WHERE {$where}
        ";
        $r = $this->_Read($query, $data);
        return !empty($r) ? $r[0] : [
            'total_entradas'  => 0,
            'total_costo'     => 0,
            'total_unidades'  => 0,
            'total_aplicadas' => 0
        ];
    }

    function qGetEntrada($array) {
        $query = "
            SELECT
                i.*,
                io.name      AS origin_name,
                io.code      AS origin_code,
                io.color_hex AS origin_color,
                w.name       AS warehouse_name,
                sp.name      AS supplier_name,
                s.name       AS subsidiary_name,
                u.fullname   AS user_name,
                cu.fullname  AS confirmed_user_name
            FROM {$this->bd}inventory_inflow i
            LEFT JOIN {$this->bd}inflow_origin io ON io.id = i.inflow_origin_id
            LEFT JOIN {$this->bd}warehouse     w  ON w.id  = i.warehouse_id
            LEFT JOIN {$this->bd}supplier      sp ON sp.id = i.supplier_id
            LEFT JOIN {$this->bdAlpha}subsidiaries s ON s.id = i.subsidiaries_id
            LEFT JOIN {$this->bdAlpha}usr_users    u  ON u.id  = i.user_id
            LEFT JOIN {$this->bdAlpha}usr_users    cu ON cu.id = i.confirmed_user_id
            WHERE i.id = ?
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    function qGetEntradaDetail($array) {
        $query = "
            SELECT
                d.id,
                d.quantity,
                d.confirmed_quantity,
                d.cost,
                d.subtotal,
                d.previous_stock,
                d.resulting_stock,
                d.batch_code,
                d.expires_at,
                d.product_id,
                p.name              AS product_name,
                p.image             AS image,
                pa.sku,
                d.unit_id,
                un.code             AS unit_code
            FROM {$this->bd}detail_inventory_inflow d
            INNER JOIN {$this->bd}order_products p   ON p.id  = d.product_id
            LEFT  JOIN {$this->bd}product_attribute pa ON pa.product_id = p.id AND pa.active = 1
            LEFT  JOIN {$this->bd}unit un            ON un.id = d.unit_id
            WHERE d.inventory_inflow_id = ? AND d.active = 1
            ORDER BY d.id ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    function insertEntrada($array) {
        // date_inflow se fija con CURDATE() del servidor (hora actual del registro),
        // no desde el cliente, para evitar desfases de zona horaria.
        $query = "
            INSERT INTO {$this->bd}inventory_inflow
                (folio, note, total_products, total_units, total_cost, date_inflow,
                 status, inflow_origin_id, warehouse_id, supplier_id,
                 subsidiaries_id, user_id, companies_id)
            VALUES (?,?,?,?,?,CURDATE(),?,?,?,?,?,?,?)
        ";
        return $this->_CUD($query, $array);
    }

    function insertEntradaDetail($array) {
        $query = "
            INSERT INTO {$this->bd}detail_inventory_inflow
                (batch_code, quantity, cost, subtotal, previous_stock, resulting_stock,
                 expires_at, product_id, inventory_inflow_id, unit_id)
            VALUES (?,?,?,?,?,?,?,?,?,?)
        ";
        return $this->_CUD($query, $array);
    }

    function qReverseEntrada($array) {
        $query = "
            UPDATE {$this->bd}inventory_inflow
            SET status = 'Cancelada', updated_at = NOW()
            WHERE id = ?
        ";
        return $this->_CUD($query, $array);
    }

    // Confirma una orden de produccion Pendiente: pasa a Aplicada y registra el confirmador.
    function qApplyEntrada($array) {
        $query = "
            UPDATE {$this->bd}inventory_inflow
            SET status = 'Aplicada', confirmed_user_id = ?, confirmed_at = NOW(), updated_at = NOW()
            WHERE id = ? AND status = 'Pendiente'
        ";
        return $this->_CUD($query, $array);
    }

    // Confirma un renglon de produccion: guarda la cantidad real que entro
    // (confirmed_quantity, sin tocar la reportada en quantity), recalcula el
    // subtotal con esa cantidad y fija el snapshot de stock al momento de aplicar.
    function confirmEntradaDetail($array) {
        // [confirmed_quantity, subtotal, previous_stock, resulting_stock, id]
        $query = "
            UPDATE {$this->bd}detail_inventory_inflow
            SET confirmed_quantity = ?, subtotal = ?, previous_stock = ?, resulting_stock = ?
            WHERE id = ?
        ";
        return $this->_CUD($query, $array);
    }

    // Recalcula los totales del header tras confirmar con cantidades reales.
    function updateEntradaTotals($array) {
        // [total_units, total_cost, id]
        $query = "
            UPDATE {$this->bd}inventory_inflow
            SET total_units = ?, total_cost = ?, updated_at = NOW()
            WHERE id = ?
        ";
        return $this->_CUD($query, $array);
    }

    // ─────────────────────────────────────────────────────────────────
    //  TRASPASOS (inventory_transfer)
    // ─────────────────────────────────────────────────────────────────

    function qTraspasos($array) {
        $where = 't.active = 1 AND t.companies_id = ?';
        $data  = [$array['companies_id']];

        if (!empty($array['status_id'])) {
            $where .= ' AND t.status_id = ?';
            $data[] = $array['status_id'];
        }
        if (!empty($array['origin_subsidiaries_id'])) {
            $where .= ' AND t.origin_subsidiaries_id = ?';
            $data[] = $array['origin_subsidiaries_id'];
        }
        if (!empty($array['destination_subsidiaries_id'])) {
            $where .= ' AND t.destination_subsidiaries_id = ?';
            $data[] = $array['destination_subsidiaries_id'];
        }
        if (!empty($array['fi']) && !empty($array['ff'])) {
            $where .= ' AND DATE(t.date_request) BETWEEN ? AND ?';
            $data[] = $array['fi'];
            $data[] = $array['ff'];
        }
        if (!empty($array['q'])) {
            $where .= ' AND (t.folio LIKE ? OR t.note LIKE ?)';
            $data[] = '%' . $array['q'] . '%';
            $data[] = '%' . $array['q'] . '%';
        }

        $query = "
            SELECT
                t.id,
                t.folio,
                t.note,
                t.total_products,
                t.total_units,
                t.total_cost,
                t.date_request,
                t.date_authorized,
                t.date_sent,
                t.date_received,
                t.status_id,
                ts.code              AS status_code,
                ts.name              AS status_name,
                ts.color_hex         AS status_color,
                ts.is_terminal       AS status_terminal,
                t.origin_warehouse_id,
                wo.name              AS origin_warehouse_name,
                t.destination_warehouse_id,
                wd.name              AS destination_warehouse_name,
                t.origin_subsidiaries_id,
                so.name              AS origin_subsidiary_name,
                t.destination_subsidiaries_id,
                sd.name              AS destination_subsidiary_name,
                t.requested_user_id,
                ur.fullname          AS requested_user_name,
                t.authorized_user_id,
                ua.fullname          AS authorized_user_name,
                t.received_user_id,
                urc.fullname         AS received_user_name
            FROM {$this->bd}inventory_transfer t
            LEFT JOIN {$this->bd}transfer_status ts ON ts.id = t.status_id
            LEFT JOIN {$this->bd}warehouse       wo ON wo.id = t.origin_warehouse_id
            LEFT JOIN {$this->bd}warehouse       wd ON wd.id = t.destination_warehouse_id
            LEFT JOIN {$this->bdAlpha}subsidiaries so  ON so.id  = t.origin_subsidiaries_id
            LEFT JOIN {$this->bdAlpha}subsidiaries sd  ON sd.id  = t.destination_subsidiaries_id
            LEFT JOIN {$this->bdAlpha}usr_users    ur  ON ur.id  = t.requested_user_id
            LEFT JOIN {$this->bdAlpha}usr_users    ua  ON ua.id  = t.authorized_user_id
            LEFT JOIN {$this->bdAlpha}usr_users    urc ON urc.id = t.received_user_id
            WHERE {$where}
            ORDER BY t.date_request DESC
        ";
        $r = $this->_Read($query, $data);
        return is_array($r) ? $r : [];
    }

    function getTraspasoKpis($array) {
        $where = 't.active = 1 AND t.companies_id = ?';
        $data  = [$array['companies_id']];

        if (!empty($array['fi']) && !empty($array['ff'])) {
            $where .= ' AND DATE(t.date_request) BETWEEN ? AND ?';
            $data[] = $array['fi'];
            $data[] = $array['ff'];
        }

        $query = "
            SELECT
                COUNT(t.id) AS total,
                COUNT(CASE WHEN ts.code = 'REQUESTED'  THEN 1 END) AS pendientes,
                COUNT(CASE WHEN ts.code = 'AUTHORIZED' THEN 1 END) AS autorizados,
                COUNT(CASE WHEN ts.code = 'IN_TRANSIT' THEN 1 END) AS en_transito,
                COUNT(CASE WHEN ts.code = 'RECEIVED'   THEN 1 END) AS recibidos,
                COUNT(CASE WHEN ts.code = 'REJECTED'   THEN 1 END) AS rechazados
            FROM {$this->bd}inventory_transfer t
            LEFT JOIN {$this->bd}transfer_status ts ON ts.id = t.status_id
            WHERE {$where}
        ";
        $r = $this->_Read($query, $data);
        return !empty($r) ? $r[0] : [
            'total' => 0, 'pendientes' => 0, 'autorizados' => 0,
            'en_transito' => 0, 'recibidos' => 0, 'rechazados' => 0
        ];
    }

    function qGetTraspaso($array) {
        $query = "
            SELECT
                t.*,
                ts.code AS status_code,
                ts.name AS status_name,
                ts.color_hex AS status_color,
                wo.name AS origin_warehouse_name,
                wd.name AS destination_warehouse_name,
                so.name AS origin_subsidiary_name,
                sd.name AS destination_subsidiary_name,
                ur.fullname  AS requested_user_name,
                ua.fullname  AS authorized_user_name,
                urc.fullname AS received_user_name
            FROM {$this->bd}inventory_transfer t
            LEFT JOIN {$this->bd}transfer_status ts ON ts.id = t.status_id
            LEFT JOIN {$this->bd}warehouse       wo ON wo.id = t.origin_warehouse_id
            LEFT JOIN {$this->bd}warehouse       wd ON wd.id = t.destination_warehouse_id
            LEFT JOIN {$this->bdAlpha}subsidiaries so  ON so.id  = t.origin_subsidiaries_id
            LEFT JOIN {$this->bdAlpha}subsidiaries sd  ON sd.id  = t.destination_subsidiaries_id
            LEFT JOIN {$this->bdAlpha}usr_users    ur  ON ur.id  = t.requested_user_id
            LEFT JOIN {$this->bdAlpha}usr_users    ua  ON ua.id  = t.authorized_user_id
            LEFT JOIN {$this->bdAlpha}usr_users    urc ON urc.id = t.received_user_id
            WHERE t.id = ?
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    function getTraspasoDetail($array) {
        $query = "
            SELECT
                d.id,
                d.quantity,
                d.cost,
                d.subtotal,
                d.origin_stock_prev,
                d.origin_stock_post,
                d.destination_stock_prev,
                d.destination_stock_post,
                d.product_id,
                p.name              AS product_name,
                pa.sku
            FROM {$this->bd}detail_inventory_transfer d
            INNER JOIN {$this->bd}order_products p ON p.id = d.product_id
            LEFT  JOIN {$this->bd}product_attribute pa ON pa.product_id = p.id AND pa.active = 1
            WHERE d.inventory_transfer_id = ? AND d.active = 1
            ORDER BY d.id ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    function getTraspasoHistory($array) {
        $query = "
            SELECT
                h.id,
                h.note,
                h.transitioned_at,
                h.status_id,
                ts.code              AS status_code,
                ts.name              AS status_name,
                ts.color_hex         AS status_color,
                h.user_id,
                u.fullname           AS user_name
            FROM {$this->bd}inventory_transfer_history h
            LEFT JOIN {$this->bd}transfer_status ts ON ts.id = h.status_id
            LEFT JOIN {$this->bdAlpha}usr_users    u ON u.id  = h.user_id
            WHERE h.inventory_transfer_id = ? AND h.active = 1
            ORDER BY h.transitioned_at DESC, h.id DESC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    function insertTraspaso($array) {
        $query = "
            INSERT INTO {$this->bd}inventory_transfer
                (folio, note, total_products, total_units, total_cost, date_request,
                 status_id, origin_warehouse_id, destination_warehouse_id,
                 origin_subsidiaries_id, destination_subsidiaries_id,
                 requested_user_id, companies_id)
            VALUES (?,?,?,?,?,NOW(),?,?,?,?,?,?,?)
        ";
        return $this->_CUD($query, $array);
    }

    function insertTraspasoDetail($array) {
        $query = "
            INSERT INTO {$this->bd}detail_inventory_transfer
                (quantity, cost, subtotal, origin_stock_prev, origin_stock_post,
                 destination_stock_prev, destination_stock_post,
                 product_id, inventory_transfer_id)
            VALUES (?,?,?,?,?,?,?,?,?)
        ";
        return $this->_CUD($query, $array);
    }

    function insertTraspasoHistory($array) {
        $query = "
            INSERT INTO {$this->bd}inventory_transfer_history
                (note, transitioned_at, status_id, user_id, inventory_transfer_id)
            VALUES (?, NOW(), ?, ?, ?)
        ";
        return $this->_CUD($query, $array);
    }

    function updateTraspasoStatus($array) {
        $query = "
            UPDATE {$this->bd}inventory_transfer
            SET status_id = ?, updated_at = NOW()
            WHERE id = ?
        ";
        return $this->_CUD($query, $array);
    }

    function setTraspasoSent($array) {
        $query = "
            UPDATE {$this->bd}inventory_transfer
            SET date_sent = NOW(), updated_at = NOW()
            WHERE id = ?
        ";
        return $this->_CUD($query, $array);
    }

    function setTraspasoReceived($array) {
        $query = "
            UPDATE {$this->bd}inventory_transfer
            SET date_received = NOW(), received_user_id = ?, updated_at = NOW()
            WHERE id = ?
        ";
        return $this->_CUD($query, $array);
    }

    function setTraspasoAuthorized($array) {
        $query = "
            UPDATE {$this->bd}inventory_transfer
            SET date_authorized = NOW(), authorized_user_id = ?, updated_at = NOW()
            WHERE id = ?
        ";
        return $this->_CUD($query, $array);
    }

    function getTransferStatusByCode($array) {
        $query = "SELECT id, code, name, is_terminal FROM {$this->bd}transfer_status WHERE code = ? LIMIT 1";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
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
    //  MOVIMIENTOS (vista unificada)
    // ─────────────────────────────────────────────────────────────────

    function qMovimientos($array) {
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
            ORDER BY mv.occurred_at DESC
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

    function getMovimientosByProduct($array) {
        $query = "
            SELECT
                mv.movement_uid,
                mv.movement_type,
                mv.folio,
                mv.quantity,
                mv.cost_unit,
                mv.cost_total,
                mv.occurred_at,
                mv.warehouse_id,
                w.name AS warehouse_name,
                mv.note
            FROM {$this->bd}inventory_movement mv
            LEFT JOIN {$this->bd}warehouse w ON w.id = mv.warehouse_id
            WHERE mv.product_id = ? AND mv.companies_id = ?
            ORDER BY mv.occurred_at DESC
            LIMIT 20
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
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
