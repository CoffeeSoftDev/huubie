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

    function lsWarehouses($array) {
        $where = 'w.active = 1 AND w.companies_id = ?';
        $data  = [$array['companies_id']];

        if (!empty($array['branch_id'])) {
            $where .= ' AND w.branch_id = ?';
            $data[] = $array['branch_id'];
        }

        $query = "
            SELECT
                w.id,
                w.name,
                w.name AS valor,
                w.is_default,
                w.branch_id,
                w.warehouse_area_id,
                wa.name AS area_name,
                wa.color_hex AS area_color,
                s.name AS branch_name
            FROM {$this->bd}warehouse w
            LEFT JOIN {$this->bd}warehouse_area wa ON wa.id = w.warehouse_area_id
            LEFT JOIN {$this->bdErp}branches s ON s.id = w.branch_id
            WHERE {$where}
            ORDER BY s.name ASC, w.is_default DESC, w.name ASC
        ";
        $r = $this->_Read($query, $data);
        return is_array($r) ? $r : [];
    }

    function lsInflowOrigins() {
        $query = "
            SELECT id, code, name, name AS valor, color_hex, requires_supplier
            FROM {$this->bd}inflow_origin
            WHERE active = 1
            ORDER BY id ASC
        ";
        $r = $this->_Read($query, null);
        if (!is_array($r)) return [];
        foreach ($r as &$o) {
            // requires_supplier se administra por dato en la tabla inflow_origin,
            // no por code. Asi cualquier origen puede exigir proveedor sin tocar codigo.
            $o['requires_supplier'] = (int) $o['requires_supplier'];
        }
        return $r;
    }

    function lsSuppliers($array) {
        $query = "
            SELECT id, name, name AS valor
            FROM {$this->bd}supplier
            WHERE active = 1 AND companies_id = ?
            ORDER BY name ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    function findSupplierByName($array) {
        $query = "
            SELECT id, name
            FROM {$this->bd}supplier
            WHERE active = 1 AND companies_id = ? AND LOWER(name) = LOWER(?)
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    function insertSupplier($array) {
        $query = "
            INSERT INTO {$this->bd}supplier
                (name, contact_name, phone, email, companies_id)
            VALUES (?, ?, ?, ?, ?)
        ";
        return $this->_CUD($query, $array);
    }

    function qProductsForTransfer($array) {
        $query = "
            SELECT
                i.id                                       AS id,
                i.name                                     AS nombre,
                ia.sku                                     AS sku,
                ic.name                                    AS categoria,
                COALESCE(ia.cost_unit, i.price, 0)         AS costo,
                i.price                                    AS precio,
                i.price_without_tax                        AS price_without_tax,
                i.tax                                      AS tax,
                i.image                                    AS image
            FROM {$this->bd}item i
            LEFT JOIN {$this->bd}item_attribute  ia ON ia.item_id = i.id AND ia.active = 1
            LEFT JOIN {$this->bd}item_category   ic ON ic.id = i.category_id
            WHERE i.active = 1 AND i.companies_id = ?
            ORDER BY i.name ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    function getInflowOrigin($array) {
        $query = "
            SELECT id, code, name, color_hex, requires_supplier
            FROM {$this->bd}inflow_origin
            WHERE id = ?
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    function qEntradas($array) {
        $where = 'i.active = 1 AND i.companies_id = ?';
        $data  = [$array['companies_id']];

        if (!empty($array['branch_id'])) {
            $where .= ' AND i.branch_id = ?';
            $data[] = $array['branch_id'];
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
            $where .= ' AND (i.date_inflow IS NULL OR DATE(i.date_inflow) BETWEEN ? AND ?)';
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
                i.status,
                i.date_inflow,
                i.inflow_origin_id,
                io.name        AS origin_name,
                io.code        AS origin_code,
                io.color_hex   AS origin_color,
                io.bg_hex      AS origin_bg,
                io.icon        AS origin_icon,
                i.warehouse_id,
                w.name         AS warehouse_name,
                i.branch_id,
                s.name         AS branch_name,
                i.supplier_id,
                sp.name        AS supplier_name,
                i.user_id,
                TRIM(CONCAT(COALESCE(u.name, ''), ' ', COALESCE(u.last_name, '')))    AS user_name,
                i.confirmed_user_id,
                TRIM(CONCAT(COALESCE(cu.name, ''), ' ', COALESCE(cu.last_name, '')))  AS confirmed_user_name,
                i.confirmed_at
            FROM {$this->bd}inventory_inflow i
            LEFT JOIN {$this->bd}inflow_origin      io ON io.id = i.inflow_origin_id
            LEFT JOIN {$this->bd}warehouse           w  ON w.id  = i.warehouse_id
            LEFT JOIN {$this->bdErp}branches       s  ON s.id  = i.branch_id
            LEFT JOIN {$this->bd}supplier            sp ON sp.id = i.supplier_id
            LEFT JOIN {$this->bdErp}users            u  ON u.id  = i.user_id
            LEFT JOIN {$this->bdErp}users            cu ON cu.id = i.confirmed_user_id
            WHERE {$where}
            ORDER BY i.date_inflow DESC, i.id DESC
        ";
        $r = $this->_Read($query, $data);
        return is_array($r) ? $r : [];
    }

    function getEntradaKpis($array) {
        $where = 'i.active = 1 AND i.companies_id = ?';
        $data  = [$array['companies_id']];

        if (!empty($array['branch_id'])) {
            $where .= ' AND i.branch_id = ?';
            $data[] = $array['branch_id'];
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
            $where .= ' AND (i.date_inflow IS NULL OR DATE(i.date_inflow) BETWEEN ? AND ?)';
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
                COUNT(i.id)                        AS total_entradas,
                IFNULL(SUM(i.total_cost), 0)       AS total_costo,
                IFNULL(SUM(i.total_units), 0)      AS total_unidades,
                SUM(i.status = 'Aplicada')         AS total_aplicadas
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
                io.name        AS origin_name,
                io.code        AS origin_code,
                io.color_hex   AS origin_color,
                io.bg_hex      AS origin_bg,
                io.icon        AS origin_icon,
                w.name         AS warehouse_name,
                s.name         AS branch_name,
                sp.name        AS supplier_name,
                TRIM(CONCAT(COALESCE(u.name, ''), ' ', COALESCE(u.last_name, '')))    AS user_name,
                TRIM(CONCAT(COALESCE(cu.name, ''), ' ', COALESCE(cu.last_name, '')))  AS confirmed_user_name
            FROM {$this->bd}inventory_inflow i
            LEFT JOIN {$this->bd}inflow_origin    io ON io.id = i.inflow_origin_id
            LEFT JOIN {$this->bd}warehouse         w  ON w.id  = i.warehouse_id
            LEFT JOIN {$this->bdErp}branches     s  ON s.id  = i.branch_id
            LEFT JOIN {$this->bd}supplier          sp ON sp.id = i.supplier_id
            LEFT JOIN {$this->bdErp}users          u  ON u.id  = i.user_id
            LEFT JOIN {$this->bdErp}users          cu ON cu.id = i.confirmed_user_id
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
                d.price_without_tax,
                d.tax,
                d.previous_stock,
                d.resulting_stock,
                d.batch_code,
                d.expires_at,
                d.item_id AS product_id,
                i.name AS product_name,
                ia.sku,
                i.image
            FROM {$this->bd}detail_inventory_inflow d
            INNER JOIN {$this->bd}item i ON i.id = d.item_id
            LEFT  JOIN {$this->bd}item_attribute ia ON ia.item_id = i.id AND ia.active = 1
            WHERE d.inventory_inflow_id = ? AND d.active = 1
            ORDER BY d.id ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    function insertEntrada($array) {
        $query = "
            INSERT INTO {$this->bd}inventory_inflow
                (folio, note, total_products, total_units, total_cost,
                 total_price_without_tax,
                 status, inflow_origin_id, warehouse_id, supplier_id,
                 branch_id, user_id, companies_id, date_inflow)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ";
        return $this->_CUD($query, $array);
    }

    function insertEntradaDetail($array) {
        $query = "
            INSERT INTO {$this->bd}detail_inventory_inflow
                (batch_code, quantity, cost, subtotal, price_without_tax, tax,
                 previous_stock, resulting_stock,
                 expires_at, item_id, inventory_inflow_id, unit_id)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
        ";
        return $this->_CUD($query, $array);
    }

    // Refleja en el item el ultimo costo capturado en la entrada: base sin
    // impuesto, porcentaje de tax y precio recalculado (misma formula que el
    // catalogo: price = price_without_tax + price_without_tax * tax / 100).
    function updateItemTax($array) {
        $query = "
            UPDATE {$this->bd}item
            SET price = ?, price_without_tax = ?, tax = ?
            WHERE id = ? AND companies_id = ?
        ";
        return $this->_CUD($query, $array);
    }

    function confirmEntradaDetail($array) {
        $query = "
            UPDATE {$this->bd}detail_inventory_inflow
            SET confirmed_quantity = ?, subtotal = ?, previous_stock = ?, resulting_stock = ?
            WHERE id = ?
        ";
        return $this->_CUD($query, $array);
    }

    function updateEntradaTotals($array) {
        $query = "
            UPDATE {$this->bd}inventory_inflow
            SET total_units = ?, total_cost = ?, total_price_without_tax = ?, updated_at = NOW()
            WHERE id = ?
        ";
        return $this->_CUD($query, $array);
    }

    function qApplyEntrada($array) {
        $query = "
            UPDATE {$this->bd}inventory_inflow
            SET status = 'Aplicada', confirmed_user_id = ?, confirmed_at = NOW(), updated_at = NOW()
            WHERE id = ?
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

    function getStockRow($array) {
        $query = "
            SELECT id, quantity
            FROM {$this->bd}stock
            WHERE item_id = ? AND warehouse_id = ? AND active = 1
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    function insertStockRow($array) {
        $query = "
            INSERT INTO {$this->bd}stock
                (quantity, last_movement_at, warehouse_id, item_id, companies_id)
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

    // -- Formatos (plantillas reutilizables de lote) --

    // Cabeceras visibles para el contexto actual segun el scope guardado:
    // company (toda la empresa), subsidiary (misma sucursal) o user (solo el dueno).
    function qLsFormatos($array) {
        $query = "
            SELECT id, name, scope, created_at
            FROM {$this->bd}inflow_format
            WHERE active = 1 AND companies_id = ?
              AND ( scope = 'company'
                 OR (scope = 'subsidiary' AND branch_id = ?)
                 OR (scope = 'user' AND user_id = ?) )
            ORDER BY created_at DESC, id DESC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    // Renglones de un conjunto de formatos, enriquecidos con los datos vigentes
    // del catalogo (nombre/sku/categoria/costo/imagen) para rearmar el lote igual
    // que init(). El costo se toma del catalogo, no se congela en el formato.
    function qFormatoItems($ids) {
        if (empty($ids)) return [];
        $place = implode(',', array_fill(0, count($ids), '?'));
        $query = "
            SELECT
                fi.inflow_format_id                AS inflow_format_id,
                fi.quantity                        AS cantidad,
                i.id                               AS id,
                i.name                             AS nombre,
                ia.sku                             AS sku,
                ic.name                            AS categoria,
                COALESCE(ia.cost_unit, i.price, 0) AS costo,
                i.price_without_tax                AS price_without_tax,
                i.tax                              AS tax,
                i.image                            AS image
            FROM {$this->bd}inflow_format_item fi
            INNER JOIN {$this->bd}item            i  ON i.id = fi.item_id AND i.active = 1
            LEFT  JOIN {$this->bd}item_attribute  ia ON ia.item_id = i.id AND ia.active = 1
            LEFT  JOIN {$this->bd}item_category   ic ON ic.id = i.category_id
            WHERE fi.active = 1 AND fi.inflow_format_id IN ({$place})
            ORDER BY i.name ASC
        ";
        $r = $this->_Read($query, $ids);
        return is_array($r) ? $r : [];
    }

    function insertFormato($array) {
        $query = "
            INSERT INTO {$this->bd}inflow_format
                (name, scope, user_id, branch_id, companies_id)
            VALUES (?,?,?,?,?)
        ";
        return $this->_CUD($query, $array);
    }

    // _CUD no devuelve el id generado (cierra la conexion); recuperamos el ultimo
    // del usuario+empresa, mismo patron que saveEntrada con el folio.
    function qLastFormatoId($array) {
        $query = "
            SELECT id
            FROM {$this->bd}inflow_format
            WHERE companies_id = ? AND user_id = ?
            ORDER BY id DESC
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? (int) $r[0]['id'] : 0;
    }

    function insertFormatoItem($array) {
        $query = "
            INSERT INTO {$this->bd}inflow_format_item
                (quantity, item_id, inflow_format_id)
            VALUES (?,?,?)
        ";
        return $this->_CUD($query, $array);
    }

    function qGetFormato($array) {
        $query = "
            SELECT id, name, scope, user_id, branch_id, companies_id
            FROM {$this->bd}inflow_format
            WHERE id = ? AND companies_id = ?
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    function qDeleteFormato($array) {
        $query = "
            UPDATE {$this->bd}inflow_format
            SET active = 0, updated_at = NOW()
            WHERE id = ? AND companies_id = ?
        ";
        return $this->_CUD($query, $array);
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
            $folio = $r[0]['folio'];
            $num   = (int) preg_replace('/[^0-9]/', '', substr($folio, strlen($prefix)));
            $next  = $num + 1;
        }
        return $prefix . str_pad($next, 4, '0', STR_PAD_LEFT);
    }
}
