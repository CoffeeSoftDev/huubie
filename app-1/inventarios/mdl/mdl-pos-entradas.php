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

    function listProductsForInflow($array) {
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
    //  ENTRADAS (inventory_inflow)
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

    function getEntradaById($array) {
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

    function getEntradaIdByFolio($array) {
        $query = "
            SELECT id
            FROM {$this->bd}inventory_inflow
            WHERE folio = ? AND companies_id = ?
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? (int) $r[0]['id'] : 0;
    }

    function listEntradaDetail($array) {
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

    function createEntrada($array) {
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

    function createEntradaDetail($array) {
        $query = "
            INSERT INTO {$this->bd}detail_inventory_inflow
                (batch_code, quantity, cost, subtotal, previous_stock, resulting_stock,
                 expires_at, product_id, inventory_inflow_id, unit_id)
            VALUES (?,?,?,?,?,?,?,?,?,?)
        ";
        return $this->_CUD($query, $array);
    }

    function cancelEntrada($array) {
        $query = "
            UPDATE {$this->bd}inventory_inflow
            SET status = 'Cancelada', updated_at = NOW()
            WHERE id = ?
        ";
        return $this->_CUD($query, $array);
    }

    // Confirma una orden de produccion Pendiente: pasa a Aplicada y registra el confirmador.
    function applyEntrada($array) {
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

    // Edicion completa de un renglon existente: cantidad real (confirmed_quantity),
    // costo, subtotal y snapshot de stock. A diferencia de confirmEntradaDetail,
    // tambien actualiza el costo.
    function updateEntradaDetailFull($array) {
        // [confirmed_quantity, cost, subtotal, previous_stock, resulting_stock, id]
        $query = "
            UPDATE {$this->bd}detail_inventory_inflow
            SET confirmed_quantity = ?, cost = ?, subtotal = ?, previous_stock = ?, resulting_stock = ?
            WHERE id = ?
        ";
        return $this->_CUD($query, $array);
    }

    // Edicion de un renglon de una entrada PENDIENTE (orden de produccion): cambia la
    // cantidad PLANEADA (quantity, no confirmed_quantity) y el costo; el snapshot de
    // stock queda sin aplicar (previous = resulting).
    function updateEntradaDetailPlanned($array) {
        // [quantity, cost, subtotal, previous_stock, resulting_stock, id]
        $query = "
            UPDATE {$this->bd}detail_inventory_inflow
            SET quantity = ?, cost = ?, subtotal = ?, previous_stock = ?, resulting_stock = ?
            WHERE id = ?
        ";
        return $this->_CUD($query, $array);
    }

    // Baja logica de un renglon (al quitarlo en la edicion). El stock se revierte
    // aparte, antes de llamar a esto.
    function disableEntradaDetail($array) {
        // [id]
        $query = "
            UPDATE {$this->bd}detail_inventory_inflow
            SET active = 0
            WHERE id = ?
        ";
        return $this->_CUD($query, $array);
    }

    // Recalcula header completo tras una edicion: tipos, unidades, costo y nota.
    function updateEntradaHeaderFull($array) {
        // [total_products, total_units, total_cost, note, id]
        $query = "
            UPDATE {$this->bd}inventory_inflow
            SET total_products = ?, total_units = ?, total_cost = ?, note = ?, updated_at = NOW()
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

    function createStockRow($array) {
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

    // ─────────────────────────────────────────────────────────────────
    //  FOLIOS
    // ─────────────────────────────────────────────────────────────────

    function getNextFolio($prefix, $companies_id) {
        $query = "
            SELECT folio
            FROM {$this->bd}inventory_inflow
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
}
