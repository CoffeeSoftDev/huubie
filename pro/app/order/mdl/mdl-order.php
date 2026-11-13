<?php
require_once __DIR__ . '/../../../core/database/_CRUD.php';
require_once __DIR__ . '/../../../core/helpers/_Utileria.php';

/*  Modelo de Pedidos. Lee la lista y el detalle; escribe la captura (Etapa 2).
    Las escrituras (qCreate*, qUpdate*) solo se llaman dentro de transaction().

    Dos bases en el mismo servidor:
      fayxzvov_app  (la del .env) empresas, sucursales y usuarios. Sin prefijo: $this->bd.
      fayxzvov_pos  los pedidos. Con prefijo: $this->pos.

    Un pedido es una venta con sale_type_id = 1 (sale_type "Pedido").
      sale.total            ya es NETO (subtotal - descuento).
      pagado                suma de payment vivos (active y sin deleted_at).
      saldo                 total - pagado. Negativo = pago de mas ("a favor").
      delivery_method       0 recoge en tienda, 1 envio a domicilio.
      delivery_status       0 sin entregar, 1 entregado, 2 en produccion.
      folio                 hoy es el mismo id. Se busca por s.id, nunca
                            comparando folio contra texto (collations).

    "Activo" se lee con IFNULL(active, 1): un NULL cuenta como activo. */
class mdl extends CRUD {
    public $util;
    public $bd;
    public $pos;

    public function __construct() {
        $this->util = new Utileria;
        $this->bd   = '';
        $this->pos  = 'fayxzvov_pos.';
    }

    // -- Ayudantes --

    protected function qRows($query, $data = []) {
        $sql = $this->_Read($query, $data);
        return is_array($sql) ? $sql : [];
    }

    protected function qRow($query, $data = []) {
        $sql = $this->qRows($query, $data);
        return empty($sql) ? null : $sql[0];
    }

    protected function qCount($query, $data = []) {
        $row = $this->qRow($query, $data);
        return $row === null ? 0 : (int) reset($row);
    }

    // '?,?,?' para un IN (...). Nunca con un arreglo vacio.
    protected function qIn(array $ids) {
        return implode(',', array_fill(0, count($ids), '?'));
    }

    // Lo pagado de un pedido. Se repite en lista y detalle: que no discrepen.
    protected function qPaidSql($alias) {
        return "(SELECT IFNULL(SUM(p.amount), 0)
                   FROM {$this->pos}payment p
                  WHERE p.sale_id = {$alias}.id
                    AND IFNULL(p.active, 1) = 1
                    AND p.deleted_at IS NULL)";
    }

    // 1 si alguna linea viva es un pastel personalizado.
    protected function qCustomSql($alias) {
        return "EXISTS (SELECT 1
                          FROM {$this->pos}detail_sale d
                          INNER JOIN {$this->pos}product pr ON pr.id = d.product_id
                         WHERE d.sale_id = {$alias}.id
                           AND IFNULL(d.active, 1) = 1
                           AND pr.is_custom = 1)";
    }

    // -- Empresa y sucursal (fayxzvov_app) --

    public function qFirstCompany() {
        return $this->qRow("
            SELECT id, name
            FROM {$this->bd}companies
            ORDER BY (status = 'active') DESC, id
            LIMIT 1
        ");
    }

    public function qCompany($id) {
        return $this->qRow("SELECT id, name FROM {$this->bd}companies WHERE id = ? LIMIT 1", [$id]);
    }

    public function qFirstBranch($companyId) {
        return $this->qRow("
            SELECT id, name, company_id
            FROM {$this->bd}branches
            WHERE company_id = ?
                AND IFNULL(is_active, 1) = 1
            ORDER BY id
            LIMIT 1
        ", [$companyId]);
    }

    public function qBranch($id) {
        return $this->qRow("
            SELECT id, name, company_id
            FROM {$this->bd}branches
            WHERE id = ?
                AND IFNULL(is_active, 1) = 1
            LIMIT 1
        ", [$id]);
    }

    // -- Catalogos del filtro --

    // Los de la empresa y las plantillas de Huubie (company_id NULL).
    public function qStatuses($companyId) {
        return $this->qRows("
            SELECT id, name AS valor
            FROM {$this->pos}sale_status
            WHERE (company_id = ? OR company_id IS NULL)
                AND IFNULL(active, 1) = 1
            ORDER BY id
        ", [$companyId]);
    }

    // El turno abierto de la sucursal (el mas reciente si hubiera dos).
    // Sin opened_at cuenta la fecha en que se creo el registro.
    public function qOpenTurn($branchId) {
        return $this->qRow("
            SELECT id, folio, IFNULL(opened_at, created_at) AS opened_at
            FROM {$this->pos}turn
            WHERE branch_id = ?
                AND status = 'open'
                AND IFNULL(active, 1) = 1
            ORDER BY id DESC
            LIMIT 1
        ", [$branchId]);
    }

    // -- Lista --

    /*  $f: branch_id, date_type ('created'|'delivery'), fi, ff, status (int|null),
        order_type ('custom'|'normal'|''), search (null o
        ['id' => int, 'like' => '%texto%'|null, 'phone' => '%digitos%'|null]).

        Con busqueda se ignoran fecha y estado (se busca en toda la historia de
        la sucursal) y se respeta el tipo. Va con tope de 50: el exacto primero. */
    public function qListOrders(array $f) {
        list($where, $data) = $this->qOrdersWhere($f);

        if ($f['search'] !== null) {
            $order = 'ORDER BY (s.id = ?) DESC, s.id DESC LIMIT 50';
            $data[] = $f['search']['id'];
        } elseif ($f['date_type'] === 'delivery') {
            $order = 'ORDER BY s.delivery_date, s.delivery_time, s.id';
        } else {
            $order = 'ORDER BY s.id DESC';
        }

        return $this->qRows("
            SELECT
                s.id,
                s.folio,
                s.created_at,
                s.delivery_date,
                s.delivery_time,
                s.delivery_method,
                s.delivery_status,
                s.sale_status_id,
                IFNULL(st.name, '') AS status,
                s.subtotal,
                s.discount_amount,
                s.total,
                s.turn_id,
                s.customer_id,
                IFNULL(c.name, '')  AS customer,
                IFNULL(c.phone, '') AS phone,
                {$this->qPaidSql('s')} AS paid,
                {$this->qCustomSql('s')} AS is_custom
            FROM {$this->pos}sale s
            LEFT JOIN {$this->pos}sale_status st ON st.id = s.sale_status_id
            LEFT JOIN {$this->pos}customer c     ON c.id = s.customer_id
            WHERE {$where}
            {$order}
        ", $data);
    }

    // Cuantos pedidos cumplen la busqueda, sin el tope de 50.
    public function qCountOrders(array $f) {
        list($where, $data) = $this->qOrdersWhere($f);

        return $this->qCount("
            SELECT COUNT(*)
            FROM {$this->pos}sale s
            LEFT JOIN {$this->pos}customer c ON c.id = s.customer_id
            WHERE {$where}
        ", $data);
    }

    // El WHERE comun de lista y conteo: [sql, datos].
    private function qOrdersWhere(array $f) {
        $where = ['s.branch_id = ?', 's.sale_type_id = 1', 'IFNULL(s.active, 1) = 1'];
        $data  = [$f['branch_id']];

        if ($f['search'] !== null) {
            $or     = ['s.id = ?'];
            $data[] = $f['search']['id'];

            // "P1557" o "P1557-04" son folio y nada mas: like y phone llegan en null.
            if ($f['search']['like'] !== null) {
                $or[]   = 'c.name LIKE ?';
                $data[] = $f['search']['like'];
            }

            // Telefono sin espacios ni guiones, solo con 3 digitos o mas.
            if ($f['search']['phone'] !== null) {
                $or[]   = "REPLACE(REPLACE(IFNULL(c.phone, ''), ' ', ''), '-', '') LIKE ?";
                $data[] = $f['search']['phone'];
            }

            $where[] = '(' . implode(' OR ', $or) . ')';
        } else {
            if ($f['date_type'] === 'delivery') {
                $where[] = 's.delivery_date BETWEEN ? AND ?';
            } else {
                $where[] = 's.created_at >= ? AND s.created_at < DATE_ADD(?, INTERVAL 1 DAY)';
            }

            $data[] = $f['fi'];
            $data[] = $f['ff'];

            if ($f['status'] !== null) {
                $where[] = 's.sale_status_id = ?';
                $data[]  = $f['status'];
            }
        }

        if ($f['order_type'] === 'custom') $where[] = $this->qCustomSql('s');
        if ($f['order_type'] === 'normal') $where[] = 'NOT ' . $this->qCustomSql('s');

        return [implode(' AND ', $where), $data];
    }

    // -- Calendario --

    /*  Los pedidos que se entregan entre fi y ff. La foto es la primera de
        referencia (pastel personalizado) o, si no hay, la del primer producto. */
    public function qCalendarOrders($branchId, $fi, $ff) {
        return $this->qRows("
            SELECT
                s.id,
                s.folio,
                s.delivery_date,
                s.delivery_time,
                s.delivery_method,
                s.delivery_status,
                s.sale_status_id,
                s.location,
                s.total,
                s.produced_at,
                IFNULL(st.name, '') AS status,
                IFNULL(c.name, '')  AS customer,
                IFNULL(c.phone, '') AS phone,
                {$this->qPaidSql('s')} AS paid,
                {$this->qCustomSql('s')} AS is_custom,
                COALESCE(
                    (SELECT si.path
                       FROM {$this->pos}sale_image si
                       INNER JOIN {$this->pos}detail_sale di ON di.id = si.detail_sale_id
                      WHERE di.sale_id = s.id
                        AND IFNULL(di.active, 1) = 1
                        AND IFNULL(si.active, 1) = 1
                      ORDER BY si.id
                      LIMIT 1),
                    (SELECT NULLIF(pi.image, '')
                       FROM {$this->pos}detail_sale dp
                       INNER JOIN {$this->pos}product pi ON pi.id = dp.product_id
                      WHERE dp.sale_id = s.id
                        AND IFNULL(dp.active, 1) = 1
                        AND IFNULL(pi.image, '') <> ''
                      ORDER BY dp.id
                      LIMIT 1),
                    ''
                ) AS photo
            FROM {$this->pos}sale s
            LEFT JOIN {$this->pos}sale_status st ON st.id = s.sale_status_id
            LEFT JOIN {$this->pos}customer c     ON c.id = s.customer_id
            WHERE s.branch_id = ?
                AND s.sale_type_id = 1
                AND IFNULL(s.active, 1) = 1
                AND s.delivery_date BETWEEN ? AND ?
            ORDER BY s.delivery_date, s.delivery_time, s.id
        ", [$branchId, $fi, $ff]);
    }

    // -- Detalle --

    // Solo si es un pedido de esa sucursal: el id solo no basta.
    public function qGetOrder($id, $branchId) {
        return $this->qRow("
            SELECT
                s.id,
                s.folio,
                s.note,
                s.location,
                s.delivery_method,
                s.delivery_status,
                s.cancel_reason,
                s.discount_note,
                s.subtotal,
                s.discount_amount,
                s.discount_percent,
                s.total,
                s.delivery_date,
                s.delivery_time,
                s.birthday_date,
                s.cancelled_at,
                s.produced_at,
                s.created_at,
                s.sale_status_id,
                s.customer_id,
                s.turn_id,
                s.daily_closure_id,
                {$this->qCutSql('s')},
                IFNULL(st.name, '')  AS status,
                IFNULL(c.name, '')   AS customer,
                IFNULL(c.phone, '')  AS phone,
                IFNULL(c.email, '')  AS email,
                IFNULL(dr.name, '')  AS discount_reason,
                CONCAT_WS(' ', uc.name, uc.last_name) AS created_by,
                CONCAT_WS(' ', up.name, up.last_name) AS produced_by,
                CONCAT_WS(' ', ux.name, ux.last_name) AS cancelled_by,
                {$this->qPaidSql('s')} AS paid
            FROM {$this->pos}sale s
            LEFT JOIN {$this->pos}sale_status st     ON st.id = s.sale_status_id
            LEFT JOIN {$this->pos}customer c         ON c.id  = s.customer_id
            LEFT JOIN {$this->pos}discount_reason dr ON dr.id = s.discount_reason_id
            LEFT JOIN {$this->bd}users uc            ON uc.id = s.user_id
            LEFT JOIN {$this->bd}users up            ON up.id = s.produced_user_id
            LEFT JOIN {$this->bd}users ux            ON ux.id = s.cancel_user_id
            WHERE s.id = ?
                AND s.branch_id = ?
                AND s.sale_type_id = 1
                AND IFNULL(s.active, 1) = 1
            LIMIT 1
        ", [$id, $branchId]);
    }

    public function qOrderLines($saleId) {
        return $this->qRows("
            SELECT
                d.id,
                d.name,
                d.details,
                d.dedication,
                d.price,
                d.quantity,
                d.discount_amount,
                d.product_id,
                IFNULL(p.is_custom, 0)   AS is_custom,
                IFNULL(p.image, '')      AS image,
                IFNULL(p.portion_qty, 0) AS portion_qty,
                IFNULL(p.name, '')       AS product_name
            FROM {$this->pos}detail_sale d
            LEFT JOIN {$this->pos}product p ON p.id = d.product_id
            WHERE d.sale_id = ?
                AND IFNULL(d.active, 1) = 1
            ORDER BY d.id
        ", [$saleId]);
    }

    // Fotos de referencia de las lineas (pasteles personalizados).
    public function qLineImages(array $lineIds) {
        if (empty($lineIds)) return [];

        return $this->qRows("
            SELECT id, path, IFNULL(original_name, name) AS name, detail_sale_id
            FROM {$this->pos}sale_image
            WHERE detail_sale_id IN ({$this->qIn($lineIds)})
                AND IFNULL(active, 1) = 1
            ORDER BY detail_sale_id, id
        ", array_values($lineIds));
    }

    /*  La personalizacion de un pastel: cada pastel personalizado es su propio
        producto y sus opciones viven en product_modifier. El precio de la fila
        manda; si viene NULL, el del modificador. */
    public function qProductModifiers(array $productIds) {
        if (empty($productIds)) return [];

        return $this->qRows("
            SELECT
                pm.id,
                pm.product_id,
                pm.modifier_id,
                mo.modifier_group_id,
                IFNULL(mg.name, 'Otros')          AS group_name,
                IFNULL(mg.is_extra, 0)            AS is_extra,
                IFNULL(mo.name, '')               AS name,
                IFNULL(pm.quantity, 1)            AS quantity,
                IFNULL(pm.price, IFNULL(mo.price, 0)) AS price,
                IFNULL(pm.details, '')            AS details
            FROM {$this->pos}product_modifier pm
            INNER JOIN {$this->pos}modifier mo        ON mo.id = pm.modifier_id
            LEFT JOIN {$this->pos}modifier_group mg   ON mg.id = mo.modifier_group_id
            WHERE pm.product_id IN ({$this->qIn($productIds)})
                AND IFNULL(pm.active, 1) = 1
            ORDER BY pm.product_id, mg.id, pm.id
        ", array_values($productIds));
    }

    public function qPayments($saleId) {
        return $this->qRows("
            SELECT
                p.id,
                p.amount,
                p.tendered_amount,
                p.change_amount,
                p.description,
                p.turn_id,
                COALESCE(p.paid_at, p.created_at) AS paid_at,
                IFNULL(pmt.name, '')  AS method,
                IFNULL(pmt.code, '')  AS method_code,
                IFNULL(pmt.is_cash, 0) AS is_cash,
                CONCAT_WS(' ', u.name, u.last_name) AS received_by
            FROM {$this->pos}payment p
            LEFT JOIN {$this->pos}payment_method pmt ON pmt.id = p.payment_method_id
            LEFT JOIN {$this->bd}users u             ON u.id = p.user_id
            WHERE p.sale_id = ?
                AND IFNULL(p.active, 1) = 1
                AND p.deleted_at IS NULL
            ORDER BY COALESCE(p.paid_at, p.created_at), p.id
        ", [$saleId]);
    }

    // La bitacora, lo mas nuevo arriba.
    public function qHistory($saleId) {
        return $this->qRows("
            SELECT
                h.id,
                IFNULL(h.title, '')  AS title,
                IFNULL(h.action, '') AS action,
                IFNULL(h.detail, '') AS detail,
                IFNULL(h.type, '')   AS type,
                h.created_at,
                CONCAT_WS(' ', u.name, u.last_name) AS user_name
            FROM {$this->pos}history_log h
            LEFT JOIN {$this->bd}users u ON u.id = h.user_id
            WHERE h.sale_id = ?
                AND IFNULL(h.active, 1) = 1
            ORDER BY h.created_at DESC, h.id DESC
        ", [$saleId]);
    }

    // -- Captura: opciones del formulario --

    /*  Clientes vivos de la sucursal. $keepId deja en la lista al cliente que ya
        tenia el pedido aunque sea de otra sucursal o este dado de baja. */
    public function qCustomerOptions($branchId, $keepId = 0) {
        return $this->qRows("
            SELECT id, IFNULL(name, '') AS name, IFNULL(phone, '') AS phone
            FROM {$this->pos}customer
            WHERE (branch_id = ? AND IFNULL(active, 1) = 1)
                OR id = ?
            ORDER BY name, id
        ", [$branchId, $keepId]);
    }

    public function qGetCustomer($id) {
        return $this->qRow("
            SELECT
                id,
                IFNULL(name, '')   AS name,
                IFNULL(phone, '')  AS phone,
                branch_id,
                IFNULL(active, 1)  AS active
            FROM {$this->pos}customer
            WHERE id = ?
            LIMIT 1
        ", [$id]);
    }

    // El telefono se compara sin espacios ni guiones.
    public function qFindCustomerByPhone($branchId, $phone) {
        return $this->qRow("
            SELECT id, IFNULL(name, '') AS name, IFNULL(phone, '') AS phone
            FROM {$this->pos}customer
            WHERE branch_id = ?
                AND IFNULL(active, 1) = 1
                AND REPLACE(REPLACE(IFNULL(phone, ''), ' ', ''), '-', '') = ?
            ORDER BY id
            LIMIT 1
        ", [$branchId, $phone]);
    }

    /*  Lo que se puede pedir: lo de la sucursal mas lo que comparte la Matriz.
        Si la sucursal tiene uno con el mismo nombre, se ofrece el suyo y el de
        la Matriz se esconde. Mismo filtro de Catalogo. La categoria inactiva no
        esconde el producto: cae en "Sin categoria". */
    public function qCatalogProducts($companyId, $branchId, $mainId) {
        return $this->qRows("
            SELECT
                p.id,
                p.name,
                IFNULL(p.price, 0)      AS price,
                IFNULL(c.id, 0)         AS category_id,
                IFNULL(TRIM(c.name), '') AS category,
                IFNULL(p.image, '')     AS image,
                IFNULL(p.sku, '')       AS sku,
                IFNULL(p.barcode, '')   AS barcode
            FROM {$this->pos}product p
            LEFT JOIN {$this->pos}category c
                ON c.id = p.category_id
                AND IFNULL(c.active, 1) = 1
            WHERE p.company_id = ?
                AND p.branch_id IN (?, ?)
                AND IFNULL(p.is_custom, 0) = 0
                AND p.kind IN ('product', 'service')
                AND IFNULL(p.active, 1) = 1
                AND NOT (
                    p.branch_id <> ?
                    AND EXISTS (
                        SELECT 1
                        FROM {$this->pos}product o
                        WHERE o.company_id = p.company_id
                            AND o.branch_id = ?
                            AND LOWER(TRIM(o.name)) = LOWER(TRIM(p.name))
                            AND IFNULL(o.is_custom, 0) = 0
                            AND o.kind IN ('product', 'service')
                            AND IFNULL(o.active, 1) = 1
                    )
                )
            ORDER BY p.name, p.id
        ", [$companyId, $branchId, $mainId, $branchId, $branchId]);
    }

    public function qGetCatalogProduct($id, $companyId, $branchId, $mainId) {
        return $this->qRow("
            SELECT p.id, p.name, IFNULL(p.price, 0) AS price
            FROM {$this->pos}product p
            WHERE p.id = ?
                AND p.company_id = ?
                AND p.branch_id IN (?, ?)
                AND IFNULL(p.is_custom, 0) = 0
                AND p.kind IN ('product', 'service')
                AND IFNULL(p.active, 1) = 1
                AND NOT (
                    p.branch_id <> ?
                    AND EXISTS (
                        SELECT 1
                        FROM {$this->pos}product o
                        WHERE o.company_id = p.company_id
                            AND o.branch_id = ?
                            AND LOWER(TRIM(o.name)) = LOWER(TRIM(p.name))
                            AND IFNULL(o.is_custom, 0) = 0
                            AND o.kind IN ('product', 'service')
                            AND IFNULL(o.active, 1) = 1
                    )
                )
            LIMIT 1
        ", [$id, $companyId, $branchId, $mainId, $branchId, $branchId]);
    }

    // Opciones vivas del pastel: grupos de la empresa y plantillas (company_id NULL).
    public function qModifierOptions($companyId) {
        return $this->qRows("
            SELECT
                mo.id,
                IFNULL(mo.name, '')    AS name,
                IFNULL(mo.price, 0)    AS price,
                mg.id                  AS group_id,
                IFNULL(mg.name, '')    AS group_name,
                IFNULL(mg.is_extra, 0) AS is_extra
            FROM {$this->pos}modifier mo
            INNER JOIN {$this->pos}modifier_group mg ON mg.id = mo.modifier_group_id
            WHERE (mg.company_id = ? OR mg.company_id IS NULL)
                AND IFNULL(mg.active, 1) = 1
                AND IFNULL(mo.active, 1) = 1
            ORDER BY mg.id, mo.id
        ", [$companyId]);
    }

    // Los modificadores pedidos, vivos o no: el ctrl decide cual acepta.
    public function qModifiersByIds(array $ids, $companyId) {
        if (empty($ids)) return [];

        $data   = array_values($ids);
        $data[] = $companyId;

        return $this->qRows("
            SELECT
                mo.id,
                IFNULL(mo.name, '')    AS name,
                IFNULL(mo.price, 0)    AS price,
                mg.id                  AS group_id,
                IFNULL(mg.name, '')    AS group_name,
                IFNULL(mg.is_extra, 0) AS is_extra,
                IF(IFNULL(mo.active, 1) = 1 AND IFNULL(mg.active, 1) = 1, 1, 0) AS alive
            FROM {$this->pos}modifier mo
            INNER JOIN {$this->pos}modifier_group mg ON mg.id = mo.modifier_group_id
            WHERE mo.id IN ({$this->qIn($ids)})
                AND (mg.company_id = ? OR mg.company_id IS NULL)
        ", $data);
    }

    // -- Captura: candado --

    /*  El pedido bloqueado hasta el commit (FOR UPDATE): dos personas editando o
        cobrando a la vez esperan turno en vez de pisarse. Solo en transaction(). */
    public function qLockOrder($id, $branchId) {
        return $this->qRow("
            SELECT
                s.id,
                s.customer_id,
                s.sale_status_id,
                s.delivery_status,
                s.delivery_method,
                s.delivery_date,
                s.delivery_time,
                s.location,
                s.note,
                s.subtotal,
                s.discount_amount,
                s.total,
                s.turn_id,
                s.daily_closure_id,
                s.produced_at,
                s.produced_user_id,
                {$this->qCutSql('s')},
                {$this->qPaidSql('s')} AS paid
            FROM {$this->pos}sale s
            WHERE s.id = ?
                AND s.branch_id = ?
                AND s.sale_type_id = 1
                AND IFNULL(s.active, 1) = 1
            LIMIT 1
            FOR UPDATE
        ", [$id, $branchId]);
    }

    /*  El corte en que cuenta el pedido: folio y estado de su turno y el día de su
        cierre. Subconsultas a proposito: dentro de FOR UPDATE no bloquean el turno. */
    protected function qCutSql($alias) {
        return "IFNULL((SELECT tc.folio FROM {$this->pos}turn tc WHERE tc.id = {$alias}.turn_id), '') AS turn_folio,
                IFNULL((SELECT tc.status FROM {$this->pos}turn tc WHERE tc.id = {$alias}.turn_id), '') AS turn_status,
                (SELECT DATE(dc.closure_date) FROM {$this->pos}daily_closure dc WHERE dc.id = {$alias}.daily_closure_id) AS closure_day";
    }

    // -- Captura: escrituras --
    // Devuelven true o el aviso del CRUD (string o false); el ctrl usa must().

    protected function qInsertInto($table, $array) {
        return $this->_Insert([
            'table'  => $this->pos . $table,
            'values' => $array['values'],
            'data'   => $array['data']
        ]);
    }

    protected function qUpdateIn($table, $array) {
        return $this->_Update([
            'table'  => $this->pos . $table,
            'values' => $array['values'],
            'where'  => $array['where'],
            'data'   => $array['data']
        ]);
    }

    // Solo dentro de transaction(): fuera, _CUD ya cerro la conexion.
    public function qLastInsertId() {
        return (int) $this->mysql->lastInsertId();
    }

    public function qCreateOrder($array) {
        return $this->qInsertInto('sale', $array);
    }

    public function qUpdateOrder($array) {
        return $this->qUpdateIn('sale', $array);
    }

    public function qCreateLine($array) {
        return $this->qInsertInto('detail_sale', $array);
    }

    public function qUpdateLine($array) {
        return $this->qUpdateIn('detail_sale', $array);
    }

    public function qCreateProduct($array) {
        return $this->qInsertInto('product', $array);
    }

    public function qUpdateProduct($array) {
        return $this->qUpdateIn('product', $array);
    }

    public function qCreateProductModifier($array) {
        return $this->qInsertInto('product_modifier', $array);
    }

    public function qUpdateProductModifier($array) {
        return $this->qUpdateIn('product_modifier', $array);
    }

    public function qCreateImage($array) {
        return $this->qInsertInto('sale_image', $array);
    }

    public function qUpdateImage($array) {
        return $this->qUpdateIn('sale_image', $array);
    }

    public function qCreateCustomer($array) {
        return $this->qInsertInto('customer', $array);
    }

    public function qCreateHistory($array) {
        return $this->qInsertInto('history_log', $array);
    }

    // -- Turno: lectura --

    protected function qTurnSelect() {
        return "
            SELECT
                t.id,
                t.folio,
                t.status,
                IFNULL(t.opening_cash, 0)  AS opening_cash,
                IFNULL(t.counted_cash, 0)  AS counted_cash,
                IFNULL(t.expected_cash, 0) AS expected_cash,
                IFNULL(t.total_sales, 0)   AS total_sales,
                IFNULL(t.orders_count, 0)  AS orders_count,
                IFNULL(t.sales_count, 0)   AS sales_count,
                IFNULL(t.opened_at, t.created_at) AS opened_at,
                t.closed_at,
                t.reopened_at,
                IFNULL(t.reopen_reason, '') AS reopen_reason,
                CONCAT_WS(' ', uo.name, uo.last_name) AS opened_by,
                CONCAT_WS(' ', uc.name, uc.last_name) AS closed_by,
                CONCAT_WS(' ', ur.name, ur.last_name) AS reopened_by
            FROM {$this->pos}turn t
            LEFT JOIN {$this->bd}users uo ON uo.id = t.user_id
            LEFT JOIN {$this->bd}users uc ON uc.id = t.close_user_id
            LEFT JOIN {$this->bd}users ur ON ur.id = t.reopened_user_id";
    }

    public function qGetTurn($id, $branchId) {
        return $this->qRow($this->qTurnSelect() . "
            WHERE t.id = ?
                AND t.branch_id = ?
                AND IFNULL(t.active, 1) = 1
            LIMIT 1
        ", [$id, $branchId]);
    }

    // El ultimo turno de la sucursal, abierto o cerrado.
    public function qLastTurn($branchId) {
        return $this->qRow($this->qTurnSelect() . "
            WHERE t.branch_id = ?
                AND IFNULL(t.active, 1) = 1
            ORDER BY t.id DESC
            LIMIT 1
        ", [$branchId]);
    }

    // Solo en transaction(): abrir, cerrar o reabrir esperan a quien llego antes.
    public function qLockTurn($id, $branchId) {
        return $this->qRow("
            SELECT id, folio, status, IFNULL(opening_cash, 0) AS opening_cash,
                   IFNULL(opened_at, created_at) AS opened_at, IFNULL(reopen_reason, '') AS reopen_reason,
                   IFNULL(expected_cash, 0) AS expected_cash, IFNULL(total_sales, 0) AS total_sales,
                   IFNULL(orders_count, 0) AS orders_count, IFNULL(sales_count, 0) AS sales_count
            FROM {$this->pos}turn
            WHERE id = ?
                AND branch_id = ?
                AND IFNULL(active, 1) = 1
            LIMIT 1
            FOR UPDATE
        ", [$id, $branchId]);
    }

    public function qLockOpenTurn($branchId) {
        return $this->qRow("
            SELECT id, folio
            FROM {$this->pos}turn
            WHERE branch_id = ?
                AND status = 'open'
                AND IFNULL(active, 1) = 1
            ORDER BY id DESC
            LIMIT 1
            FOR UPDATE
        ", [$branchId]);
    }

    public function qLastTurnId($branchId) {
        return $this->qCount("
            SELECT IFNULL(MAX(id), 0)
            FROM {$this->pos}turn
            WHERE branch_id = ?
                AND IFNULL(active, 1) = 1
        ", [$branchId]);
    }

    // Lo cobrado en el turno por metodo (pagos vivos, de cualquier venta).
    public function qTurnMethods($turnId) {
        return $this->qRows("
            SELECT
                pm.id,
                IFNULL(pm.name, 'Sin método') AS name,
                IFNULL(pm.is_cash, 0)         AS is_cash,
                COUNT(p.id)                   AS payments,
                IFNULL(SUM(p.amount), 0)      AS amount
            FROM {$this->pos}payment p
            LEFT JOIN {$this->pos}payment_method pm ON pm.id = p.payment_method_id
            WHERE p.turn_id = ?
                AND IFNULL(p.active, 1) = 1
                AND p.deleted_at IS NULL
            GROUP BY pm.id, pm.name, pm.is_cash, pm.sort
            ORDER BY IFNULL(pm.sort, 99), pm.id
        ", [$turnId]);
    }

    // Las ventas y pedidos del turno por estado.
    public function qTurnStatuses($turnId) {
        return $this->qRows("
            SELECT
                s.sale_status_id             AS id,
                IFNULL(st.name, 'Sin estado') AS name,
                COUNT(s.id)                  AS orders,
                IFNULL(SUM(s.total), 0)      AS amount
            FROM {$this->pos}sale s
            LEFT JOIN {$this->pos}sale_status st ON st.id = s.sale_status_id
            WHERE s.turn_id = ?
                AND IFNULL(s.active, 1) = 1
            GROUP BY s.sale_status_id, st.name
            ORDER BY s.sale_status_id
        ", [$turnId]);
    }

    // Vendido = pendientes + pagados (la cotizacion y lo cancelado no cuentan).
    public function qTurnTotals($turnId) {
        return $this->qRow("
            SELECT
                IFNULL(SUM(IF(s.sale_status_id IN (2, 3), s.total, 0)), 0)                     AS total_sales,
                IFNULL(SUM(IF(s.sale_status_id IN (2, 3) AND s.sale_type_id = 1, 1, 0)), 0)  AS orders_count,
                IFNULL(SUM(IF(s.sale_status_id IN (2, 3) AND s.sale_type_id <> 1, 1, 0)), 0) AS sales_count
            FROM {$this->pos}sale s
            WHERE s.turn_id = ?
                AND IFNULL(s.active, 1) = 1
        ", [$turnId]);
    }

    // La foto por estado que guardó el corte Z (solo importe: turn_status no lleva conteo).
    public function qTurnCutStatuses($turnId) {
        return $this->qRows("
            SELECT
                x.sale_status_id              AS id,
                IFNULL(ss.name, 'Sin estado') AS name,
                IFNULL(x.amount, 0)           AS amount
            FROM {$this->pos}turn_status x
            LEFT JOIN {$this->pos}sale_status ss ON ss.id = x.sale_status_id
            WHERE x.turn_id = ?
                AND IFNULL(x.active, 1) = 1
            ORDER BY x.sale_status_id
        ", [$turnId]);
    }

    // -- Cortes: listas --

    // Turnos abiertos en [$from, $to) con su foto y lo vendido en vivo (para ver si cambió).
    public function qTurnList($branchId, $from, $to) {
        return $this->qRows("
            SELECT
                t.id,
                t.folio,
                t.status,
                IFNULL(t.opened_at, t.created_at) AS opened_at,
                t.closed_at,
                t.reopened_at,
                IFNULL(t.opening_cash, 0)  AS opening_cash,
                IFNULL(t.expected_cash, 0) AS expected_cash,
                IFNULL(t.counted_cash, 0)  AS counted_cash,
                IFNULL(t.total_sales, 0)   AS total_sales,
                CONCAT_WS(' ', uo.name, uo.last_name) AS opened_by,
                CONCAT_WS(' ', uc.name, uc.last_name) AS closed_by,
                (SELECT IFNULL(SUM(s.total), 0)
                   FROM {$this->pos}sale s
                  WHERE s.turn_id = t.id
                    AND s.sale_status_id IN (2, 3)
                    AND IFNULL(s.active, 1) = 1) AS sold,
                (SELECT COUNT(*)
                   FROM {$this->pos}daily_closure d
                  WHERE d.branch_id = t.branch_id
                    AND DATE(d.closure_date) = DATE(IFNULL(t.opened_at, t.created_at))
                    AND d.reopened_at IS NULL
                    AND IFNULL(d.active, 1) = 1) AS day_closed
            FROM {$this->pos}turn t
            LEFT JOIN {$this->bd}users uo ON uo.id = t.user_id
            LEFT JOIN {$this->bd}users uc ON uc.id = t.close_user_id
            WHERE " . $this->qDayTurnWhere('t') . "
            ORDER BY t.id DESC
        ", [$branchId, $from, $to]);
    }

    // Cierres del día vigentes con closure_date en [$from, $to).
    public function qClosureList($branchId, $from, $to) {
        return $this->qRows($this->qClosureSelect() . "
            WHERE d.branch_id = ?
                AND d.closure_date >= ?
                AND d.closure_date < ?
                AND d.reopened_at IS NULL
                AND IFNULL(d.active, 1) = 1
            ORDER BY d.closure_date DESC, d.id DESC
        ", [$branchId, $from, $to]);
    }

    // -- Cobro: lectura --

    public function qPaymentMethods($companyId) {
        return $this->qRows("
            SELECT id, name, IFNULL(code, '') AS code, IFNULL(is_cash, 0) AS is_cash
            FROM {$this->pos}payment_method
            WHERE (company_id = ? OR company_id IS NULL)
                AND IFNULL(active, 1) = 1
                AND IFNULL(is_visible, 1) = 1
            ORDER BY IFNULL(sort, 99), id
        ", [$companyId]);
    }

    public function qDiscountReasons($companyId) {
        return $this->qRows("
            SELECT id, name, IFNULL(max_percent, 100) AS max_percent, IFNULL(requires_authorization, 0) AS requires_authorization
            FROM {$this->pos}discount_reason
            WHERE (company_id = ? OR company_id IS NULL)
                AND IFNULL(active, 1) = 1
            ORDER BY id
        ", [$companyId]);
    }

    // Un pago vivo del pedido, con el estado del turno en que entro.
    public function qGetPayment($paymentId, $saleId) {
        return $this->qRow("
            SELECT
                p.id,
                p.amount,
                p.turn_id,
                IFNULL(pm.name, 'Sin método') AS method,
                IFNULL(t.status, '')          AS turn_status,
                IFNULL(t.folio, '')           AS turn_folio
            FROM {$this->pos}payment p
            LEFT JOIN {$this->pos}payment_method pm ON pm.id = p.payment_method_id
            LEFT JOIN {$this->pos}turn t            ON t.id = p.turn_id
            WHERE p.id = ?
                AND p.sale_id = ?
                AND IFNULL(p.active, 1) = 1
                AND p.deleted_at IS NULL
            LIMIT 1
        ", [$paymentId, $saleId]);
    }

    public function qCustomerName($customerId) {
        $row = $this->qRow("SELECT name FROM {$this->pos}customer WHERE id = ? LIMIT 1", [$customerId]);

        return $row ? (string) $row['name'] : '';
    }

    // La contraseña cifrada de quien opera. '' = no tiene.
    public function qUserPassword($userId) {
        $row = $this->qRow("SELECT password FROM {$this->bd}users WHERE id = ? LIMIT 1", [$userId]);

        return $row ? (string) $row['password'] : '';
    }

    // -- Turno y cobro: escrituras --

    public function qCreateTurn($array) {
        return $this->qInsertInto('turn', $array);
    }

    public function qUpdateTurn($array) {
        return $this->qUpdateIn('turn', $array);
    }

    public function qCreateTurnPayment($array) {
        return $this->qInsertInto('turn_payment', $array);
    }

    public function qUpdateTurnPayment($array) {
        return $this->qUpdateIn('turn_payment', $array);
    }

    public function qCreateTurnStatus($array) {
        return $this->qInsertInto('turn_status', $array);
    }

    public function qUpdateTurnStatus($array) {
        return $this->qUpdateIn('turn_status', $array);
    }

    public function qCreatePayment($array) {
        return $this->qInsertInto('payment', $array);
    }

    public function qUpdatePayment($array) {
        return $this->qUpdateIn('payment', $array);
    }

    public function qUpdateCustomer($array) {
        return $this->qUpdateIn('customer', $array);
    }

    // -- Cierre del día: lectura --

    // Los turnos de un día = los que se ABRIERON en [$from, $to). Pide 3 parámetros.
    protected function qDayTurnWhere($alias) {
        return "{$alias}.branch_id = ?
                AND IFNULL({$alias}.opened_at, {$alias}.created_at) >= ?
                AND IFNULL({$alias}.opened_at, {$alias}.created_at) < ?
                AND IFNULL({$alias}.active, 1) = 1";
    }

    // Los turnos del día con lo vendido y lo cobrado en vivo.
    public function qDayTurns($branchId, $from, $to) {
        return $this->qRows("
            SELECT
                t.id,
                t.folio,
                t.status,
                IFNULL(t.opening_cash, 0)  AS opening_cash,
                IFNULL(t.counted_cash, 0)  AS counted_cash,
                IFNULL(t.expected_cash, 0) AS expected_cash,
                IFNULL(t.total_sales, 0)   AS total_sales,
                IFNULL(t.opened_at, t.created_at) AS opened_at,
                t.closed_at,
                CONCAT_WS(' ', uo.name, uo.last_name) AS opened_by,
                (SELECT IFNULL(SUM(s.total), 0)
                   FROM {$this->pos}sale s
                  WHERE s.turn_id = t.id
                    AND s.sale_status_id IN (2, 3)
                    AND IFNULL(s.active, 1) = 1) AS sold,
                (SELECT IFNULL(SUM(p.amount), 0)
                   FROM {$this->pos}payment p
                  WHERE p.turn_id = t.id
                    AND IFNULL(p.active, 1) = 1
                    AND p.deleted_at IS NULL) AS collected
            FROM {$this->pos}turn t
            LEFT JOIN {$this->bd}users uo ON uo.id = t.user_id
            WHERE " . $this->qDayTurnWhere('t') . "
            ORDER BY t.id
        ", [$branchId, $from, $to]);
    }

    // Vendido del día: pedidos y ventas de sus turnos (la cotización no cuenta).
    public function qDayTotals($branchId, $from, $to) {
        return $this->qRow("
            SELECT
                IFNULL(SUM(IF(s.sale_status_id IN (2, 3), s.subtotal, 0)), 0)                AS subtotal,
                IFNULL(SUM(IF(s.sale_status_id IN (2, 3), s.discount_amount, 0)), 0)         AS discount,
                IFNULL(SUM(IF(s.sale_status_id IN (2, 3), s.tip_amount, 0)), 0)              AS tip,
                IFNULL(SUM(IF(s.sale_status_id IN (2, 3), s.total, 0)), 0)                   AS total,
                IFNULL(SUM(IF(s.sale_status_id IN (2, 3) AND s.sale_type_id = 1, 1, 0)), 0)  AS orders_count,
                IFNULL(SUM(IF(s.sale_status_id IN (2, 3) AND s.sale_type_id <> 1, 1, 0)), 0) AS sales_count,
                IFNULL(SUM(IF(s.sale_status_id = 4, 1, 0)), 0)                               AS cancelled_count,
                MIN(IF(s.sale_status_id <> 1, s.id, NULL))                                   AS first_id,
                MAX(IF(s.sale_status_id <> 1, s.id, NULL))                                   AS last_id
            FROM {$this->pos}sale s
            JOIN {$this->pos}turn t ON t.id = s.turn_id
            WHERE " . $this->qDayTurnWhere('t') . "
                AND IFNULL(s.active, 1) = 1
        ", [$branchId, $from, $to]);
    }

    /*  Cobrado del día: pagos que entraron en sus turnos, por método y origen.
        'venta' = el pedido es de ese mismo día; 'abono' = el pedido es de otro día. */
    public function qDayMethods($branchId, $from, $to) {
        return $this->qRows("
            SELECT
                pm.id,
                IFNULL(pm.name, 'Sin método') AS name,
                IFNULL(pm.is_cash, 0)         AS is_cash,
                IF(st.id IS NULL, 'abono', 'venta') AS source,
                COUNT(p.id)                   AS payments,
                IFNULL(SUM(p.amount), 0)      AS amount
            FROM {$this->pos}payment p
            JOIN {$this->pos}turn t                 ON t.id = p.turn_id
            LEFT JOIN {$this->pos}payment_method pm ON pm.id = p.payment_method_id
            LEFT JOIN {$this->pos}sale s            ON s.id = p.sale_id
            LEFT JOIN {$this->pos}turn st           ON st.id = s.turn_id
                AND st.branch_id = t.branch_id
                AND IFNULL(st.opened_at, st.created_at) >= ?
                AND IFNULL(st.opened_at, st.created_at) < ?
            WHERE " . $this->qDayTurnWhere('t') . "
                AND IFNULL(p.active, 1) = 1
                AND p.deleted_at IS NULL
            GROUP BY pm.id, pm.name, pm.is_cash, pm.sort, source
            ORDER BY IFNULL(pm.sort, 99), pm.id, source DESC
        ", [$from, $to, $branchId, $from, $to]);
    }

    // Los pedidos y ventas del día por estado.
    public function qDayStatuses($branchId, $from, $to) {
        return $this->qRows("
            SELECT
                s.sale_status_id              AS id,
                IFNULL(ss.name, 'Sin estado') AS name,
                COUNT(s.id)                   AS orders,
                IFNULL(SUM(s.total), 0)       AS amount
            FROM {$this->pos}sale s
            JOIN {$this->pos}turn t              ON t.id = s.turn_id
            LEFT JOIN {$this->pos}sale_status ss ON ss.id = s.sale_status_id
            WHERE " . $this->qDayTurnWhere('t') . "
                AND IFNULL(s.active, 1) = 1
            GROUP BY s.sale_status_id, ss.name
            ORDER BY s.sale_status_id
        ", [$branchId, $from, $to]);
    }

    // Pedidos con entrega ese día que siguen sin entregar (aviso, no bloquea).
    public function qDayUndelivered($branchId, $day) {
        return $this->qCount("
            SELECT COUNT(*)
            FROM {$this->pos}sale s
            WHERE s.branch_id = ?
                AND s.delivery_date = ?
                AND s.sale_type_id = 1
                AND s.sale_status_id IN (2, 3)
                AND IFNULL(s.delivery_status, 0) = 0
                AND IFNULL(s.active, 1) = 1
        ", [$branchId, $day]);
    }

    protected function qClosureSelect() {
        return "
            SELECT
                d.id,
                d.folio,
                d.closure_date,
                d.created_at,
                d.reopened_at,
                IFNULL(d.reopen_reason, '')  AS reopen_reason,
                IFNULL(d.note, '')           AS note,
                IFNULL(d.subtotal, 0)        AS subtotal,
                IFNULL(d.discount, 0)        AS discount,
                IFNULL(d.tip, 0)             AS tip,
                IFNULL(d.total, 0)           AS total,
                IFNULL(d.total_shifts, 0)    AS total_shifts,
                IFNULL(d.total_cash, 0)      AS total_cash,
                IFNULL(d.sales_count, 0)     AS sales_count,
                IFNULL(d.orders_count, 0)    AS orders_count,
                IFNULL(d.cancelled_count, 0) AS cancelled_count,
                IFNULL(d.turns_count, 0)     AS turns_count,
                IFNULL(d.first_folio, '')    AS first_folio,
                IFNULL(d.last_folio, '')     AS last_folio,
                CONCAT_WS(' ', uc.name, uc.last_name) AS closed_by,
                CONCAT_WS(' ', ur.name, ur.last_name) AS reopened_by
            FROM {$this->pos}daily_closure d
            LEFT JOIN {$this->bd}users uc ON uc.id = d.user_id
            LEFT JOIN {$this->bd}users ur ON ur.id = d.reopened_user_id";
    }

    // El cierre vigente del día: sin reapertura. Si hay dos (historia de alpha), el último.
    public function qDayClosure($branchId, $from, $to) {
        return $this->qRow($this->qClosureSelect() . "
            WHERE d.branch_id = ?
                AND d.closure_date >= ?
                AND d.closure_date < ?
                AND d.reopened_at IS NULL
                AND IFNULL(d.active, 1) = 1
            ORDER BY d.id DESC
            LIMIT 1
        ", [$branchId, $from, $to]);
    }

    // Los cierres del día que se reabrieron, del más viejo al más nuevo.
    public function qDayReopens($branchId, $from, $to) {
        return $this->qRows($this->qClosureSelect() . "
            WHERE d.branch_id = ?
                AND d.closure_date >= ?
                AND d.closure_date < ?
                AND d.reopened_at IS NOT NULL
                AND IFNULL(d.active, 1) = 1
            ORDER BY d.id
        ", [$branchId, $from, $to]);
    }

    public function qClosureMethods($closureId) {
        return $this->qRows("
            SELECT
                pm.id,
                IFNULL(pm.name, 'Sin método') AS name,
                IFNULL(pm.is_cash, 0)         AS is_cash,
                IFNULL(x.source, '')          AS source,
                IFNULL(x.payments_count, 0)   AS payments,
                IFNULL(x.amount, 0)           AS amount
            FROM {$this->pos}daily_closure_payment x
            LEFT JOIN {$this->pos}payment_method pm ON pm.id = x.payment_method_id
            WHERE x.daily_closure_id = ?
                AND IFNULL(x.active, 1) = 1
            ORDER BY IFNULL(pm.sort, 99), pm.id, x.source DESC
        ", [$closureId]);
    }

    // El importe es la foto del cierre; el número de pedidos sale de los ligados.
    public function qClosureStatuses($closureId) {
        return $this->qRows("
            SELECT
                x.sale_status_id              AS id,
                IFNULL(ss.name, 'Sin estado') AS name,
                (SELECT COUNT(*)
                   FROM {$this->pos}sale s
                  WHERE s.daily_closure_id = x.daily_closure_id
                    AND s.sale_status_id = x.sale_status_id
                    AND IFNULL(s.active, 1) = 1) AS orders,
                IFNULL(x.amount, 0)           AS amount
            FROM {$this->pos}daily_closure_status x
            LEFT JOIN {$this->pos}sale_status ss ON ss.id = x.sale_status_id
            WHERE x.daily_closure_id = ?
                AND IFNULL(x.active, 1) = 1
            ORDER BY x.sale_status_id
        ", [$closureId]);
    }

    // Días en [$from, $to) con turnos y sin cierre vigente.
    public function qPendingDays($branchId, $from, $to) {
        return $this->qRows("
            SELECT
                DATE(IFNULL(t.opened_at, t.created_at)) AS day,
                COUNT(t.id)                              AS turns,
                SUM(IF(t.status = 'open', 1, 0))         AS open_turns
            FROM {$this->pos}turn t
            WHERE " . $this->qDayTurnWhere('t') . "
                AND NOT EXISTS (
                    SELECT 1
                    FROM {$this->pos}daily_closure d
                    WHERE d.branch_id = t.branch_id
                        AND DATE(d.closure_date) = DATE(IFNULL(t.opened_at, t.created_at))
                        AND d.reopened_at IS NULL
                        AND IFNULL(d.active, 1) = 1
                )
            GROUP BY DATE(IFNULL(t.opened_at, t.created_at))
            ORDER BY day
        ", [$branchId, $from, $to]);
    }

    // El último día cerrado de la sucursal (vigente).
    public function qLastClosureId($branchId) {
        return $this->qCount("
            SELECT IFNULL(MAX(id), 0)
            FROM {$this->pos}daily_closure
            WHERE branch_id = ?
                AND reopened_at IS NULL
                AND IFNULL(active, 1) = 1
                AND closure_date = (
                    SELECT MAX(closure_date)
                    FROM {$this->pos}daily_closure
                    WHERE branch_id = ?
                        AND reopened_at IS NULL
                        AND IFNULL(active, 1) = 1
                )
        ", [$branchId, $branchId]);
    }

    // Turnos abiertos desde $to en adelante (días posteriores).
    public function qTurnsAfter($branchId, $to) {
        return $this->qCount("
            SELECT COUNT(*)
            FROM {$this->pos}turn
            WHERE branch_id = ?
                AND IFNULL(opened_at, created_at) >= ?
                AND IFNULL(active, 1) = 1
        ", [$branchId, $to]);
    }

    // Solo en transaction(): cerrar y abrir turno esperan a quien llegó antes.
    public function qLockDayTurns($branchId, $from, $to) {
        return $this->qRows("
            SELECT t.id, t.folio, t.status
            FROM {$this->pos}turn t
            WHERE " . $this->qDayTurnWhere('t') . "
            ORDER BY t.id
            FOR UPDATE
        ", [$branchId, $from, $to]);
    }

    public function qLockDayClosure($branchId, $from, $to) {
        return $this->qRow("
            SELECT id, folio, closure_date
            FROM {$this->pos}daily_closure
            WHERE branch_id = ?
                AND closure_date >= ?
                AND closure_date < ?
                AND reopened_at IS NULL
                AND IFNULL(active, 1) = 1
            ORDER BY id DESC
            LIMIT 1
            FOR UPDATE
        ", [$branchId, $from, $to]);
    }

    // -- Cierre del día: escrituras --

    public function qCreateClosure($array) {
        return $this->qInsertInto('daily_closure', $array);
    }

    public function qUpdateClosure($array) {
        return $this->qUpdateIn('daily_closure', $array);
    }

    public function qCreateClosurePayment($array) {
        return $this->qInsertInto('daily_closure_payment', $array);
    }

    public function qCreateClosureStatus($array) {
        return $this->qInsertInto('daily_closure_status', $array);
    }

    // Liga los turnos del día y sus pedidos y ventas (sin cotizaciones) al cierre.
    public function qLinkClosure($closureId, array $turnIds) {
        if (!$turnIds) return true;

        $in = $this->qIn($turnIds);

        $turns = $this->_CUD("
            UPDATE {$this->pos}turn
            SET daily_closure_id = ?
            WHERE id IN ({$in})
        ", array_merge([$closureId], $turnIds));

        $sales = $this->_CUD("
            UPDATE {$this->pos}sale
            SET daily_closure_id = ?
            WHERE turn_id IN ({$in})
                AND sale_status_id <> 1
                AND IFNULL(active, 1) = 1
        ", array_merge([$closureId], $turnIds));

        return $turns === true && $sales === true;
    }

    // Al reabrir: el cierre suelta sus turnos y pedidos.
    public function qUnlinkClosure($closureId) {
        $turns = $this->_CUD("UPDATE {$this->pos}turn SET daily_closure_id = NULL WHERE daily_closure_id = ?", [$closureId]);
        $sales = $this->_CUD("UPDATE {$this->pos}sale SET daily_closure_id = NULL WHERE daily_closure_id = ?", [$closureId]);

        return $turns === true && $sales === true;
    }
}
