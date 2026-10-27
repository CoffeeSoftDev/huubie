<?php
require_once '../../../conf/_CRUD.php';
require_once '../../../conf/_Utileria.php';
require_once __DIR__ . '/mdl-borrado.php';
require_once __DIR__ . '/mdl-presentaciones.php';
require_once __DIR__ . '/mdl-visibilidad.php';
require_once __DIR__ . '/mdl-folios.php';

class mdl extends CRUD {

    // Folio por sucursal: nextFolio (OC-KAF-0001, REAB-, SI-, ENT-).
    use FolioSucursal;

    // Presentaciones (paquetes) en la captura del pedido: se guardan como su producto base.
    use PresentacionesCaptura;

    // Borrado real con su stock (CoffeeIA): deletePedidoFullById y compañía.
    use BorradoInventario;

    // Qué productos ve la sucursal: los suyos y los de Matriz.
    use VisibilidadProductos;

    public $util;
    public $bd;
    public $bdErp;

    public function __construct() {
        $this->util  = new Utileria;
        $this->bd    = 'fayxzvov_inventory.';
        $this->bdErp = 'fayxzvov_erp.';
    }

    // -----------------------------------------------------------------------
    // Catalogos compartidos (copiados de mdl-entradas, modulo independiente)
    // -----------------------------------------------------------------------

    // La Matriz (sucursal del almacén principal) va primero; las demás, por nombre.
    function lsSucursales($array) {
        $companyId = $array['company_id'];
        $userId    = $array['user_id'];
        $isOwner   = (int) $array['is_owner'];

        if ($isOwner === 1) {
            $query = "
                SELECT id, name AS valor, company_id AS companies_id
                FROM {$this->bdErp}branches
                WHERE company_id = ? AND is_active = 1
                ORDER BY id IN (SELECT branch_id FROM {$this->bd}warehouse WHERE is_main = 1 AND active = 1) DESC, name ASC
            ";
            $r = $this->_Read($query, [$companyId]);
        } else {
            $query = "
                SELECT b.id, b.name AS valor, b.company_id AS companies_id
                FROM {$this->bdErp}branches b
                INNER JOIN {$this->bdErp}users_braches ub ON ub.branch_id = b.id
                WHERE b.company_id = ? AND b.is_active = 1 AND ub.user_id = ?
                ORDER BY b.id IN (SELECT branch_id FROM {$this->bd}warehouse WHERE is_main = 1 AND active = 1) DESC, b.name ASC
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
                w.is_main,
                w.supply_moves_stock,
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

    // Categorías y proveedores: los de la sucursal; el administrador, todos.
    function lsSuppliers($array) {
        $query = "
            SELECT s.id, s.name, s.name AS valor
            FROM {$this->bd}supplier s
            WHERE s.active = 1 AND s.companies_id = ? {$this->filtroCatalogoSucursal('s')}
            ORDER BY s.name ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    function lsCategorias($array) {
        $query = "
            SELECT ic.id, ic.name AS valor
            FROM {$this->bd}item_category ic
            WHERE ic.active = 1 AND ic.companies_id = ? {$this->filtroCatalogoSucursal('ic')}
            ORDER BY ic.name ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    // Orden del Catálogo > Unidad (arrastre), igual que en Entradas.
    function lsUnidades($array) {
        $query = "
            SELECT id, name AS valor
            FROM {$this->bd}unit
            WHERE active = 1 AND companies_id = ?
            ORDER BY sort_order ASC, name ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    function findSupplierByName($array) {
        $query = "
            SELECT s.id, s.name
            FROM {$this->bd}supplier s
            WHERE s.active = 1 AND s.companies_id = ? AND LOWER(s.name) = LOWER(?) {$this->filtroCatalogoSucursal('s')}
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    // El alta exprés queda de la sucursal de la sesión.
    function insertSupplier($array) {
        $query = "
            INSERT INTO {$this->bd}supplier
                (name, contact_name, phone, email, companies_id, branch_id)
            VALUES (?, ?, ?, ?, ?, ?)
        ";
        return $this->_CUD($query, array_merge($array, [$this->sucursalNuevaCatalogo()]));
    }

    function qProductsForTransfer($array) {
        $query = "
            SELECT
                i.id                                       AS id,
                i.name                                     AS nombre,
                ia.sku                                     AS sku,
                ic.name                                    AS categoria,
                ia.unit_id                                 AS unit_id,
                COALESCE(ia.cost_unit, 0)                  AS costo_sin_iva,
                COALESCE(ia.cost_tax, i.tax, 0)            AS iva_compra,
                ROUND(COALESCE(ia.cost_unit, 0) * (1 + COALESCE(ia.cost_tax, i.tax, 0) / 100), 2) AS costo,
                i.image                                    AS image,
                ia.description                             AS descripcion,
                ia.stock_max                               AS stock_max,
                COALESCE(u.code, u.name)                   AS presentacion
            FROM {$this->bd}item i
            LEFT JOIN {$this->bd}item_attribute  ia ON ia.item_id = i.id AND ia.active = 1
            LEFT JOIN {$this->bd}item_category   ic ON ic.id = i.category_id
            LEFT JOIN {$this->bd}unit            u  ON u.id = ia.unit_id
            WHERE i.active = 1 AND i.companies_id = ? {$this->filtroProductosVisibles('i')}
            ORDER BY i.name ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    function getInflowOrigin($array) {
        // [id, companies_id]
        $query = "
            SELECT id, code, name, color_hex, requires_supplier
            FROM {$this->bd}inflow_origin
            WHERE id = ? AND companies_id = ?
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    function getInflowOriginId($array) {
        // [code, companies_id]
        $query = "
            SELECT id
            FROM {$this->bd}inflow_origin
            WHERE code = ? AND companies_id = ?
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? (int) $r[0]['id'] : null;
    }

    // -----------------------------------------------------------------------
    // Listado de ordenes
    // -----------------------------------------------------------------------

    // Las compras (folio CP-) comparten la tabla pero se gestionan en Compras.
    // vista 'pedidos': lo que pide la sucursal. 'entregas': lo que le piden a la
    // sucursal (ya enviado: el borrador solo lo ve quien lo arma).
    // Para las tarjetas del teléfono: nombres de los materiales y hace cuánto se pidió,
    // medido con el reloj de MySQL (el mismo que llena created_at; PHP corre en UTC).
    function qOrdenes($array) {
        $where = "po.active = 1 AND po.companies_id = ? AND po.folio NOT LIKE 'CP-%'";
        $data  = [$array['companies_id']];

        if (($array['vista'] ?? '') === 'entregas') {
            $where .= " AND po.status <> 'Borrador'";
            if (!empty($array['branch_id'])) {
                $where .= ' AND po.destination_branch_id = ?';
                $data[] = $array['branch_id'];
            } else {
                $where .= ' AND po.destination_branch_id IS NOT NULL';
            }
        } elseif (!empty($array['branch_id'])) {
            $where .= ' AND po.branch_id = ?';
            $data[] = $array['branch_id'];
        }
        $where .= $this->sqlEstado($array['status'] ?? '');
        if (!empty($array['fi']) && !empty($array['ff'])) {
            $where .= ' AND DATE(po.created_at) BETWEEN ? AND ?';
            $data[] = $array['fi'];
            $data[] = $array['ff'];
        }
        if (!empty($array['q'])) {
            $where .= ' AND (po.folio LIKE ? OR po.note LIKE ?)';
            $data[] = '%' . $array['q'] . '%';
            $data[] = '%' . $array['q'] . '%';
        }

        $query = "
            SELECT
                po.id,
                po.folio,
                po.note,
                po.total_products,
                po.total_units,
                po.total_cost,
                po.status,
                po.date_order,
                po.created_at,
                po.expected_date,
                po.warehouse_id,
                w.name         AS warehouse_name,
                po.branch_id,
                s.name         AS branch_name,
                po.destination_branch_id,
                ds.name        AS destination_branch_name,
                po.supplier_id,
                sp.name        AS supplier_name,
                po.user_id,
                TRIM(CONCAT(COALESCE(u.name, ''), ' ', COALESCE(u.last_name, '')))  AS user_name,
                po.approved_user_id,
                TRIM(CONCAT(COALESCE(au.name, ''), ' ', COALESCE(au.last_name, ''))) AS approved_user_name,
                po.approved_at,
                po.reject_reason,
                po.received_confirmed_user_id,
                (SELECT GROUP_CONCAT(i.name ORDER BY d.id SEPARATOR '|')
                   FROM {$this->bd}detail_purchase_order d
                   INNER JOIN {$this->bd}item i ON i.id = d.item_id
                  WHERE d.purchase_order_id = po.id AND d.active = 1) AS materiales,
                (SELECT COUNT(*)
                   FROM {$this->bd}inventory_inflow ii
                   INNER JOIN {$this->bd}inflow_origin io ON io.id = ii.inflow_origin_id AND io.code = 'SURTIDO_SUC'
                  WHERE ii.purchase_order_id = po.id AND ii.status = 'Aplicada' AND ii.confirmed_at IS NULL) AS surtidos_por_recibir,
                TIMESTAMPDIFF(MINUTE, po.created_at, NOW()) AS minutos,
                DATEDIFF(CURDATE(), DATE(po.created_at))    AS dias
            FROM {$this->bd}purchase_order po
            LEFT JOIN {$this->bd}warehouse        w  ON w.id  = po.warehouse_id
            LEFT JOIN {$this->bdErp}branches      s  ON s.id  = po.branch_id
            LEFT JOIN {$this->bdErp}branches      ds ON ds.id = po.destination_branch_id
            LEFT JOIN {$this->bd}supplier         sp ON sp.id = po.supplier_id
            LEFT JOIN {$this->bdErp}users         u  ON u.id  = po.user_id
            LEFT JOIN {$this->bdErp}users         au ON au.id = po.approved_user_id
            WHERE {$where}
            ORDER BY po.created_at DESC, po.id DESC
        ";
        $r = $this->_Read($query, $data);
        return is_array($r) ? $r : [];
    }

    // Calendario de Pedidos: lo que pide la sucursal y lo que le piden, en el día en que se
    // necesita (date_order). Los borradores solo los ve quien los arma. Sin sucursal
    // (dueño con «Todas») son los de toda la empresa.
    function qOrdenesCalendario($array) {
        $where = "po.active = 1 AND po.companies_id = ? AND po.folio NOT LIKE 'CP-%' AND po.date_order BETWEEN ? AND ?";
        $data  = [$array['companies_id'], $array['fi'], $array['ff']];

        // Mismo criterio que qOrdenes: Despacho ('entregas') solo ve lo que le piden y sin
        // borradores; Requisiciones ('pedidos'), lo que pide la sucursal. Sin lado, los dos.
        $lado = $array['lado'] ?? '';

        if ($lado === 'entregas') {
            $where .= " AND po.status <> 'Borrador'";
            if (!empty($array['branch_id'])) {
                $where .= ' AND po.destination_branch_id = ?';
                $data[] = $array['branch_id'];
            } else {
                $where .= ' AND po.destination_branch_id IS NOT NULL';
            }
        } elseif ($lado === 'pedidos') {
            if (!empty($array['branch_id'])) {
                $where .= ' AND po.branch_id = ?';
                $data[] = $array['branch_id'];
            }
        } elseif (!empty($array['branch_id'])) {
            $where .= " AND (po.branch_id = ? OR (po.destination_branch_id = ? AND po.status <> 'Borrador'))";
            $data[] = $array['branch_id'];
            $data[] = $array['branch_id'];
        }

        $where .= $this->sqlEstado($array['status'] ?? '');

        $query = "
            SELECT
                po.id,
                po.folio,
                po.status,
                po.received_confirmed_user_id,
                po.date_order,
                po.total_products,
                po.branch_id,
                s.name  AS branch_name,
                po.destination_branch_id,
                ds.name AS destination_branch_name
            FROM {$this->bd}purchase_order po
            LEFT JOIN {$this->bdErp}branches s  ON s.id  = po.branch_id
            LEFT JOIN {$this->bdErp}branches ds ON ds.id = po.destination_branch_id
            WHERE {$where}
            ORDER BY po.date_order ASC, po.id ASC
        ";
        $r = $this->_Read($query, $data);
        return is_array($r) ? $r : [];
    }

    // Rol del usuario en una sucursal (roles.code). [user_id, branch_id]
    function getRolSucursal($array) {
        $query = "
            SELECT r.code
            FROM {$this->bdErp}users_braches ub
            INNER JOIN {$this->bdErp}roles r ON r.id = ub.role_id AND r.is_active = 1
            WHERE ub.user_id = ? AND ub.branch_id = ?
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? (string) $r[0]['code'] : '';
    }

    // Filtro Estado de la Lista y del Calendario, con el mismo criterio que
    // ctrl::estadoRequisicion. Los reabastos (REAB-) son compras, no requisiciones: solo
    // salen con «Todos los estados».
    private function sqlEstado($estado) {
        $sql = [
            'EnEspera'       => "po.status = 'Solicitada'",
            'Entregado'      => "po.status IN ('Aprobada', 'Recibida') AND po.received_confirmed_user_id IS NULL",
            'SurtidoParcial' => "po.status = 'Parcial'",
            'Confirmado'     => "po.status = 'Recibida' AND po.received_confirmed_user_id IS NOT NULL"
        ];

        return isset($sql[$estado]) ? " AND po.folio NOT LIKE 'REAB-%' AND {$sql[$estado]}" : '';
    }

    // Día de hoy según MySQL, el mismo reloj que llena created_at (PHP corre en UTC).
    function getFechaBd() {
        $r = $this->_Read('SELECT CURDATE() AS hoy', []);
        return $r[0]['hoy'] ?? date('Y-m-d');
    }

    // -----------------------------------------------------------------------
    // Detalle de una orden (header + renglones)
    // -----------------------------------------------------------------------

    function qGetOrden($array) {
        $query = "
            SELECT
                po.*,
                w.name         AS warehouse_name,
                s.name         AS branch_name,
                ds.name        AS destination_branch_name,
                sp.name        AS supplier_name,
                TRIM(CONCAT(COALESCE(u.name, ''), ' ', COALESCE(u.last_name, '')))   AS user_name,
                TRIM(CONCAT(COALESCE(au.name, ''), ' ', COALESCE(au.last_name, ''))) AS approved_user_name,
                TRIM(CONCAT(COALESCE(cu.name, ''), ' ', COALESCE(cu.last_name, ''))) AS expected_date_user_name,
                TRIM(CONCAT(COALESCE(ru.name, ''), ' ', COALESCE(ru.last_name, ''))) AS received_confirmed_user_name,
                (SELECT GROUP_CONCAT(ii.folio ORDER BY ii.id SEPARATOR ', ')
                 FROM {$this->bd}inventory_inflow ii
                 INNER JOIN {$this->bd}inflow_origin io ON io.id = ii.inflow_origin_id AND io.code = 'SURTIDO_SUC'
                 WHERE ii.purchase_order_id = po.id AND ii.status = 'Aplicada')                     AS entradas_surtido,
                (SELECT COUNT(*)
                 FROM {$this->bd}inventory_inflow ii
                 INNER JOIN {$this->bd}inflow_origin io ON io.id = ii.inflow_origin_id AND io.code = 'SURTIDO_SUC'
                 WHERE ii.purchase_order_id = po.id AND ii.status = 'Aplicada' AND ii.confirmed_at IS NULL) AS surtidos_por_recibir
            FROM {$this->bd}purchase_order po
            LEFT JOIN {$this->bd}warehouse        w  ON w.id  = po.warehouse_id
            LEFT JOIN {$this->bdErp}branches      s  ON s.id  = po.branch_id
            LEFT JOIN {$this->bdErp}branches      ds ON ds.id = po.destination_branch_id
            LEFT JOIN {$this->bd}supplier         sp ON sp.id = po.supplier_id
            LEFT JOIN {$this->bdErp}users         u  ON u.id  = po.user_id
            LEFT JOIN {$this->bdErp}users         au ON au.id = po.approved_user_id
            LEFT JOIN {$this->bdErp}users         cu ON cu.id = po.expected_date_user_id
            LEFT JOIN {$this->bdErp}users         ru ON ru.id = po.received_confirmed_user_id
            WHERE po.id = ?
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    // unidad: la del renglón; si no trae, la del producto en Catálogo.
    // delivered_*: el producto que se entrega en lugar del pedido (Revisar y aprobar), con
    // su unidad y su último costo del Catálogo; vacío si se entrega lo pedido.
    function qGetOrdenDetail($array) {
        $query = "
            SELECT
                d.id,
                d.purchase_order_id,
                d.item_id AS product_id,
                d.unit_id,
                d.quantity_ordered,
                d.quantity_received,
                d.price_without_tax,
                d.tax,
                d.cost,
                d.subtotal,
                d.note,
                i.name  AS product_name,
                ia.sku,
                i.image,
                un.name AS unidad,
                d.delivered_item_id,
                di.name   AS delivered_name,
                dia.sku   AS delivered_sku,
                dia.unit_id AS delivered_unit_id,
                dun.name  AS delivered_unidad,
                COALESCE(dia.cost_unit, 0)            AS delivered_price_without_tax,
                COALESCE(dia.cost_tax, di.tax, 0)     AS delivered_tax,
                ROUND(COALESCE(dia.cost_unit, 0) * (1 + COALESCE(dia.cost_tax, di.tax, 0) / 100), 2) AS delivered_cost
            FROM {$this->bd}detail_purchase_order d
            INNER JOIN {$this->bd}item            i   ON i.id = d.item_id
            LEFT  JOIN {$this->bd}item_attribute  ia  ON ia.item_id = i.id AND ia.active = 1
            LEFT  JOIN {$this->bd}unit            un  ON un.id = COALESCE(d.unit_id, ia.unit_id)
            LEFT  JOIN {$this->bd}item            di  ON di.id = d.delivered_item_id
            LEFT  JOIN {$this->bd}item_attribute  dia ON dia.item_id = di.id AND dia.active = 1
            LEFT  JOIN {$this->bd}unit            dun ON dun.id = dia.unit_id
            WHERE d.purchase_order_id = ? AND d.active = 1
            ORDER BY d.id ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    // -----------------------------------------------------------------------
    // Enlace para compartir el comprobante (comprobante-requisicion.php)
    // -----------------------------------------------------------------------

    function getOrdenShareToken($array) {
        // [id, companies_id]
        $query = "
            SELECT id, share_token
            FROM {$this->bd}purchase_order
            WHERE id = ? AND companies_id = ? AND active = 1
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    // Solo si aún no tiene: dos clics a la vez no cambian el enlace ya enviado.
    function updateOrdenShareToken($array) {
        // [share_token, id]
        $query = "
            UPDATE {$this->bd}purchase_order
            SET share_token = ?
            WHERE id = ? AND share_token IS NULL
        ";
        return $this->_CUD($query, $array);
    }

    function getOrdenIdByShareToken($array) {
        // [share_token]
        $query = "
            SELECT id
            FROM {$this->bd}purchase_order
            WHERE share_token = ? AND active = 1
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? (int) $r[0]['id'] : 0;
    }

    // -----------------------------------------------------------------------
    // Insercion de cabecera y renglones de la OC
    // -----------------------------------------------------------------------

    function insertOrden($array) {
        $query = "
            INSERT INTO {$this->bd}purchase_order
                (folio, supplier_id, branch_id, destination_branch_id, warehouse_id,
                 date_order, expected_date, note,
                 total_products, total_units, total_cost, total_price_without_tax,
                 status, user_id, companies_id)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ";
        return $this->_CUD($query, $array);
    }

    function insertOrdenDetail($array) {
        $query = "
            INSERT INTO {$this->bd}detail_purchase_order
                (purchase_order_id, item_id, unit_id,
                 quantity_ordered, quantity_received,
                 price_without_tax, tax, cost, subtotal, note)
            VALUES (?,?,?,?,0,?,?,?,?,?)
        ";
        return $this->_CUD($query, $array);
    }

    // -----------------------------------------------------------------------
    // Actualizaciones de estado y totales de la OC
    // -----------------------------------------------------------------------

    function updateOrdenStatus($array) {
        $query = "
            UPDATE {$this->bd}purchase_order
            SET status = ?, updated_at = NOW()
            WHERE id = ?
        ";
        return $this->_CUD($query, $array);
    }

    function updateOrdenStatusApprove($array) {
        $query = "
            UPDATE {$this->bd}purchase_order
            SET status = ?, approved_user_id = ?, approval_note = ?, approved_at = NOW(), updated_at = NOW()
            WHERE id = ?
        ";
        return $this->_CUD($query, $array);
    }

    // Fecha compromiso del reabasto: cuándo se espera registrar la compra, quién la puso y cuándo.
    function updateOrdenCompromiso($array) {
        $query = "
            UPDATE {$this->bd}purchase_order
            SET expected_date = ?, expected_date_user_id = ?, expected_date_at = NOW(), updated_at = NOW()
            WHERE id = ?
        ";
        return $this->_CUD($query, $array);
    }

    function updateOrdenStatusReject($array) {
        $query = "
            UPDATE {$this->bd}purchase_order
            SET status = 'Rechazada', approved_user_id = ?, approved_at = NOW(),
                reject_reason = ?, updated_at = NOW()
            WHERE id = ?
        ";
        return $this->_CUD($query, $array);
    }

    function updateOrdenTotals($array) {
        $query = "
            UPDATE {$this->bd}purchase_order
            SET total_products = ?, total_units = ?,
                total_cost = ?, total_price_without_tax = ?,
                updated_at = NOW()
            WHERE id = ?
        ";
        return $this->_CUD($query, $array);
    }

    function updateOrdenWarehouse($array) {
        $query = "
            UPDATE {$this->bd}purchase_order
            SET warehouse_id = ?, updated_at = NOW()
            WHERE id = ?
        ";
        return $this->_CUD($query, $array);
    }

    // -----------------------------------------------------------------------
    // Detalle de la OC: soft-delete y actualizacion de cantidad recibida
    // -----------------------------------------------------------------------

    function softDeleteOrdenDetails($array) {
        $query = "
            UPDATE {$this->bd}detail_purchase_order
            SET active = 0
            WHERE purchase_order_id = ?
        ";
        return $this->_CUD($query, $array);
    }

    // Un renglón que el almacenista no aprobó sale del pedido.
    function softDeleteDetailRow($array) {
        $query = "
            UPDATE {$this->bd}detail_purchase_order
            SET active = 0
            WHERE id = ? AND purchase_order_id = ?
        ";
        return $this->_CUD($query, $array);
    }

    function updateDetailReceived($array) {
        $query = "
            UPDATE {$this->bd}detail_purchase_order
            SET quantity_received = quantity_received + ?
            WHERE id = ?
        ";
        return $this->_CUD($query, $array);
    }

    // Producto que se entrega en lugar del pedido: [delivered_item_id, renglón, pedido].
    function updateDetailDelivered($array) {
        $query = "
            UPDATE {$this->bd}detail_purchase_order
            SET delivered_item_id = ?
            WHERE id = ? AND purchase_order_id = ?
        ";
        return $this->_CUD($query, $array);
    }

    // Producto del Catálogo que se puede entregar: activo y de la empresa. [item_id, companies_id]
    function qItemEntrega($array) {
        $query = "
            SELECT id, name
            FROM {$this->bd}item
            WHERE id = ? AND companies_id = ? AND active = 1
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    // -- Revertir despacho --

    // Deshace lo que movió el despacho: cancela su salida (SI-) y la entrada a quien pidió
    // (ENT-) regresando el stock, cancela el reabasto (REAB-) que siga por recibir y deja los
    // renglones como antes de aprobar: vuelven los que se quitaron (los de la última captura,
    // porque editOrden reinserta todos) sin recibido ni producto a entregar.
    // Devuelve los folios por tipo. Corre dentro de la transacción de quien llama.
    function updateDespachoRevertido($id, $companiesId) {
        $ligas = $this->getPedidoLinksById($id);
        if ($ligas['compras']) throw new Exception("la compra {$ligas['compras'][0]} viene de este pedido");

        $hecho = ['salidas' => [], 'entradas' => [], 'reabastos' => [], 'recibidos' => []];
        $pares = [];

        foreach ($ligas['salidas_ids'] as $salidaId) {
            $h = $this->_Read("SELECT folio, status, warehouse_id FROM {$this->bd}inventory_shrinkage WHERE id = ? AND companies_id = ? LIMIT 1", [$salidaId, $companiesId]);
            if (empty($h) || $h[0]['status'] !== 'Aplicada') continue;

            $detalle = $this->_Read("
                SELECT item_id, quantity AS qty
                FROM {$this->bd}detail_inventory_shrinkage
                WHERE inventory_shrinkage_id = ? AND active = 1
            ", [$salidaId]);
            foreach ($detalle as $d) {
                $this->moverStockBorrado((int) $d['item_id'], (int) $h[0]['warehouse_id'], (float) $d['qty'], $companiesId);
                $pares[] = [$d['item_id'], $h[0]['warehouse_id']];
            }
            $this->_CUD("UPDATE {$this->bd}inventory_shrinkage SET status = 'Cancelada', updated_at = NOW() WHERE id = ?", [$salidaId]);
            $hecho['salidas'][] = $h[0]['folio'];
        }

        foreach ($ligas['entradas_ids'] as $entradaId) {
            $h = $this->_Read("SELECT folio, status, warehouse_id FROM {$this->bd}inventory_inflow WHERE id = ? AND companies_id = ? LIMIT 1", [$entradaId, $companiesId]);
            if (empty($h) || $h[0]['status'] !== 'Aplicada') continue;

            $detalle = $this->_Read("
                SELECT item_id, COALESCE(confirmed_quantity, quantity) AS qty
                FROM {$this->bd}detail_inventory_inflow
                WHERE inventory_inflow_id = ? AND active = 1
            ", [$entradaId]);
            foreach ($detalle as $d) {
                $this->moverStockBorrado((int) $d['item_id'], (int) $h[0]['warehouse_id'], -(float) $d['qty'], $companiesId);
                $pares[] = [$d['item_id'], $h[0]['warehouse_id']];
            }
            $this->_CUD("UPDATE {$this->bd}inventory_inflow SET status = 'Cancelada', updated_at = NOW() WHERE id = ?", [$entradaId]);
            $hecho['entradas'][] = $h[0]['folio'];
        }

        // El reabasto ya recibido completo es una compra real: se queda.
        foreach ($ligas['reabastos_ids'] as $reabId) {
            $h = $this->_Read("SELECT folio, status FROM {$this->bd}purchase_order WHERE id = ? LIMIT 1", [$reabId]);
            if (empty($h)) continue;

            if (in_array($h[0]['status'], ['Aprobada', 'Parcial'], true)) {
                $this->updateOrdenStatus(['Cancelada', $reabId]);
                $hecho['reabastos'][] = $h[0]['folio'];
            } elseif ($h[0]['status'] === 'Recibida') {
                $hecho['recibidos'][] = $h[0]['folio'];
            }
        }

        // Unos segundos de margen: una captura larga no se guarda en el mismo segundo.
        $ultima = $this->_Read("SELECT MAX(created_at) AS ultima FROM {$this->bd}detail_purchase_order WHERE purchase_order_id = ?", [$id]);
        if (!empty($ultima[0]['ultima'])) {
            $this->_CUD("
                UPDATE {$this->bd}detail_purchase_order
                SET active = 1
                WHERE purchase_order_id = ? AND active = 0 AND created_at >= ? - INTERVAL 5 SECOND
            ", [$id, $ultima[0]['ultima']]);
        }
        $this->_CUD("
            UPDATE {$this->bd}detail_purchase_order
            SET quantity_received = 0, delivered_item_id = NULL
            WHERE purchase_order_id = ? AND active = 1
        ", [$id]);

        $t = $this->_Read("
            SELECT COUNT(*) AS prods,
                   COALESCE(SUM(quantity_ordered), 0)                     AS uds,
                   COALESCE(SUM(quantity_ordered * cost), 0)              AS costo,
                   COALESCE(SUM(quantity_ordered * price_without_tax), 0) AS base
            FROM {$this->bd}detail_purchase_order
            WHERE purchase_order_id = ? AND active = 1
        ", [$id]);
        $this->updateOrdenTotals([(int) $t[0]['prods'], (float) $t[0]['uds'], (float) $t[0]['costo'], (float) $t[0]['base'], $id]);

        $this->updateKardexChains($pares, $companiesId);

        return $hecho;
    }

    // Pedido revertido: [status, id]. Pierde la aprobación y el «Recibí».
    function updateOrdenRevertida($array) {
        $query = "
            UPDATE {$this->bd}purchase_order
            SET status = ?,
                approved_user_id = NULL, approval_note = NULL, approved_at = NULL,
                received_confirmed_user_id = NULL, received_confirmed_at = NULL,
                updated_at = NOW()
            WHERE id = ?
        ";
        return $this->_CUD($query, $array);
    }

    // -----------------------------------------------------------------------
    // Insercion de entrada (inventory_inflow) vinculada a la OC
    // Incluye purchase_order_id — columna nueva en la tabla.
    // -----------------------------------------------------------------------

    function insertInflowFromOrden($array) {
        $query = "
            INSERT INTO {$this->bd}inventory_inflow
                (folio, note, total_products, total_units, total_cost,
                 total_price_without_tax, status,
                 inflow_origin_id, warehouse_id, supplier_id,
                 branch_id, user_id, companies_id, date_inflow, purchase_order_id)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)
        ";
        return $this->_CUD($query, $array);
    }

    // Almacén al que entra lo surtido a la sucursal que pidió: el principal, luego el
    // predeterminado, luego el más antiguo. [branch_id, companies_id]
    function qAlmacenSucursal($array) {
        $query = "
            SELECT id, name
            FROM {$this->bd}warehouse
            WHERE branch_id = ? AND companies_id = ? AND active = 1
            ORDER BY is_main DESC, is_default DESC, id ASC
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }

    // ¿El almacén descuenta y da entrada al surtir a otra sucursal? (Catálogo › Almacenes)
    function qMueveInventario($array) {
        $r = $this->_Read("SELECT supply_moves_stock FROM {$this->bd}warehouse WHERE id = ? LIMIT 1", $array);
        return !isset($r[0]) || (int) $r[0]['supply_moves_stock'] === 1;
    }

    // «Recibí» del pedido: [user_id, id]. Con [null, id] queda otra vez por confirmar
    // (llegó un surtido nuevo).
    function updateOrdenRecibi($array) {
        $query = "
            UPDATE {$this->bd}purchase_order
            SET received_confirmed_user_id = ?,
                received_confirmed_at = IF(? IS NULL, NULL, NOW()),
                updated_at = NOW()
            WHERE id = ?
        ";
        return $this->_CUD($query, [$array[0], $array[0], $array[1]]);
    }

    // -- Estados de la requisición --

    // Ícono y colores elegidos en Catálogo › Estados requisición (requisition_status, por
    // empresa). [companies_id]
    function lsEstadosRequisicion($array) {
        $query = "
            SELECT code, name, icon, color_hex, bg_hex
            FROM {$this->bd}requisition_status
            WHERE companies_id = ? AND active = 1
            ORDER BY order_index ASC, id ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    // -- Historial de surtimiento --

    // Un surtimiento de la requisición. exit_type: 'auto' (salida SI-) o 'manual' (sin
    // movimiento de almacén); note = por qué no se surtió. [purchase_order_id, exit_type,
    // inventory_shrinkage_id, warehouse_id, total_products, total_units, total_cost, note,
    // user_id, companies_id]
    function insertSurtido($array) {
        $query = "
            INSERT INTO {$this->bd}purchase_order_supply
                (purchase_order_id, exit_type, inventory_shrinkage_id, warehouse_id,
                 total_products, total_units, total_cost, note, user_id, companies_id)
            VALUES (?,?,?,?,?,?,?,?,?,?)
        ";
        return $this->_CUD($query, $array);
    }

    // Historial de surtimiento de la requisición, del primero al último. [purchase_order_id]
    function lsSurtidosOrden($array) {
        $query = "
            SELECT
                ps.id,
                ps.created_at,
                ps.exit_type,
                ps.total_products,
                ps.total_units,
                ps.total_cost,
                ps.note,
                sh.folio AS salida_folio,
                TRIM(CONCAT(COALESCE(u.name, ''), ' ', COALESCE(u.last_name, ''))) AS user_name
            FROM {$this->bd}purchase_order_supply ps
            LEFT JOIN {$this->bd}inventory_shrinkage sh ON sh.id = ps.inventory_shrinkage_id
            LEFT JOIN {$this->bdErp}users            u  ON u.id  = ps.user_id
            WHERE ps.purchase_order_id = ? AND ps.active = 1
            ORDER BY ps.created_at ASC, ps.id ASC
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    // Revertir el despacho borra su historial. [purchase_order_id]
    function updateSurtidosRevertidos($array) {
        $query = "
            UPDATE {$this->bd}purchase_order_supply
            SET active = 0
            WHERE purchase_order_id = ? AND active = 1
        ";
        return $this->_CUD($query, $array);
    }

    // Las entradas de surtido del pedido quedan confirmadas por quien dijo «Recibí».
    // [user_id, purchase_order_id, companies_id]
    function confirmEntradasSurtido($array) {
        $query = "
            UPDATE {$this->bd}inventory_inflow ii
            INNER JOIN {$this->bd}inflow_origin io ON io.id = ii.inflow_origin_id AND io.code = 'SURTIDO_SUC'
            SET ii.confirmed_user_id = ?, ii.confirmed_at = NOW(), ii.updated_at = NOW()
            WHERE ii.purchase_order_id = ? AND ii.companies_id = ? AND ii.status = 'Aplicada' AND ii.confirmed_at IS NULL
        ";
        return $this->_CUD($query, $array);
    }

    function insertInflowDetail($array) {
        $query = "
            INSERT INTO {$this->bd}detail_inventory_inflow
                (quantity, cost, subtotal, price_without_tax, tax,
                 previous_stock, resulting_stock,
                 item_id, inventory_inflow_id, unit_id)
            VALUES (?,?,?,?,?,?,?,?,?,?)
        ";
        return $this->_CUD($query, $array);
    }

    // -----------------------------------------------------------------------
    // Stock (copiado de mdl-entradas, necesario para receiveOrden)
    // -----------------------------------------------------------------------

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

    // Ultimo costo de compra: base sin IVA y tasa de la compra, en item_attribute.
    // item.price es el precio de venta y la recepcion ya no lo toca.
    function updateItemCost($array) {
        // [cost_unit, cost_tax, item_id, companies_id]
        $query = "
            UPDATE {$this->bd}item_attribute
            SET cost_unit = ?, cost_tax = ?
            WHERE item_id = ? AND companies_id = ?
        ";
        return $this->_CUD($query, $array);
    }

    // -----------------------------------------------------------------------
    // Surtido a sucursal: salida de inventario (inventory_shrinkage) + stock
    // -----------------------------------------------------------------------

    function getShrinkageReasonId($array) {
        // [code, companies_id]
        $query = "
            SELECT id
            FROM {$this->bd}shrinkage_reason
            WHERE code = ? AND companies_id = ?
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? (int) $r[0]['id'] : null;
    }

    // purchase_order_id liga la salida con su pedido (migración 2026-10-14).
    function insertShrinkageFromOrden($array) {
        $query = "
            INSERT INTO {$this->bd}inventory_shrinkage
                (folio, note, total_products, total_units, total_cost,
                 status, shrinkage_reason_id, warehouse_id,
                 branch_id, user_id, companies_id, date_shrinkage, purchase_order_id)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
        ";
        return $this->_CUD($query, $array);
    }

    function insertShrinkageDetail($array) {
        $query = "
            INSERT INTO {$this->bd}detail_inventory_shrinkage
                (quantity, cost, subtotal, previous_stock, resulting_stock,
                 item_id, inventory_shrinkage_id)
            VALUES (?,?,?,?,?,?,?)
        ";
        return $this->_CUD($query, $array);
    }

    function qStockByWarehouse($array) {
        $query = "
            SELECT item_id, quantity
            FROM {$this->bd}stock
            WHERE warehouse_id = ? AND active = 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    function getBranchProductCounts($array) {
        $query = "
            SELECT w.branch_id, COUNT(DISTINCT s.item_id) AS productos
            FROM {$this->bd}warehouse w
            INNER JOIN {$this->bd}stock s ON s.warehouse_id = w.id AND s.active = 1 AND s.quantity > 0
            WHERE w.active = 1 AND w.companies_id = ?
            GROUP BY w.branch_id
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) ? $r : [];
    }

    // -----------------------------------------------------------------------
    // CoffeeIA: eliminar pedidos desde el chat
    // -----------------------------------------------------------------------

    // Los pedidos que coinciden con el filtro que armó el modelo. `branch_ids` son las
    // sucursales del usuario (vacío = dueño, sin tope): pide o surte alguna de ellas.
    // `movido` > 0 = ya surtió o recibió material (renglones con recibido o entradas).
    // `ocultos` suma los que se eliminaron antes con active = 0: no salen en la lista,
    // pero siguen contando para el folio.
    function qPedidosIA($array) {
        $where = "po.companies_id = ? AND po.folio NOT LIKE 'CP-%'" . (empty($array['ocultos']) ? ' AND po.active = 1' : '');
        $data  = [$array['companies_id']];

        if (!empty($array['branch_ids'])) {
            $in     = implode(',', array_fill(0, count($array['branch_ids']), '?'));
            $where .= " AND (po.branch_id IN ({$in}) OR po.destination_branch_id IN ({$in}))";
            $data   = array_merge($data, $array['branch_ids'], $array['branch_ids']);
        }
        if (!empty($array['ids'])) {
            $where .= ' AND po.id IN (' . implode(',', array_fill(0, count($array['ids']), '?')) . ')';
            $data   = array_merge($data, $array['ids']);
        }
        if (!empty($array['folios'])) {
            $where .= ' AND po.folio IN (' . implode(',', array_fill(0, count($array['folios']), '?')) . ')';
            $data   = array_merge($data, $array['folios']);
        }
        if (!empty($array['kind'])) {
            $where .= $array['kind'] === 'reabasto' ? " AND po.folio LIKE 'REAB-%'" : " AND po.folio NOT LIKE 'REAB-%'";
        }
        if (!empty($array['status'])) {
            $where .= ' AND po.status IN (' . implode(',', array_fill(0, count($array['status']), '?')) . ')';
            $data   = array_merge($data, $array['status']);
        }
        if (!empty($array['branch'])) {
            $where .= ' AND po.branch_id = ?';
            $data[] = $array['branch'];
        }
        if (!empty($array['destination'])) {
            $where .= ' AND po.destination_branch_id = ?';
            $data[] = $array['destination'];
        }
        if (!empty($array['date_from'])) {
            $where .= ' AND po.date_order >= ?';
            $data[] = $array['date_from'];
        }
        if (!empty($array['date_to'])) {
            $where .= ' AND po.date_order <= ?';
            $data[] = $array['date_to'];
        }
        if (!empty($array['user_id'])) {
            $where .= ' AND po.user_id = ?';
            $data[] = $array['user_id'];
        }
        if (!empty($array['text'])) {
            $where .= ' AND po.note LIKE ?';
            $data[] = '%' . $array['text'] . '%';
        }
        if (!empty($array['product'])) {
            $where .= " AND EXISTS (
                SELECT 1
                FROM {$this->bd}detail_purchase_order dp
                INNER JOIN {$this->bd}item ip ON ip.id = dp.item_id
                WHERE dp.purchase_order_id = po.id AND dp.active = 1 AND ip.name LIKE ?
            )";
            $data[] = '%' . $array['product'] . '%';
        }

        $query = "
            SELECT
                po.id,
                po.folio,
                po.branch_id,
                po.status,
                po.active,
                po.date_order,
                po.created_at,
                po.note,
                po.total_products,
                po.total_cost,
                s.name  AS branch_name,
                ds.name AS destination_branch_name,
                TRIM(CONCAT(COALESCE(u.name, ''), ' ', COALESCE(u.last_name, ''))) AS user_name,
                (SELECT COUNT(*) FROM {$this->bd}detail_purchase_order d
                  WHERE d.purchase_order_id = po.id AND d.active = 1 AND d.quantity_received > 0)
                + (SELECT COUNT(*) FROM {$this->bd}inventory_inflow f WHERE f.purchase_order_id = po.id) AS movido
            FROM {$this->bd}purchase_order po
            LEFT JOIN {$this->bdErp}branches s  ON s.id  = po.branch_id
            LEFT JOIN {$this->bdErp}branches ds ON ds.id = po.destination_branch_id
            LEFT JOIN {$this->bdErp}users    u  ON u.id  = po.user_id
            WHERE {$where}
            ORDER BY po.date_order DESC, po.id DESC
        ";
        $r = $this->_Read($query, $data);
        return is_array($r) ? $r : [];
    }

    // Credenciales del usuario en sesión para confirmar con su contraseña (como mdl-stock).
    function qUserPassword($array) {
        $query = "
            SELECT password
            FROM {$this->bdErp}users
            WHERE id = ? AND status = 'active'
            LIMIT 1
        ";
        $r = $this->_Read($query, $array);
        return is_array($r) && !empty($r) ? $r[0] : null;
    }
}
