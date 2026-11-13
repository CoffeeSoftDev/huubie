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
    public function qOpenTurn($branchId) {
        return $this->qRow("
            SELECT id, folio, opened_at
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
                p.description,
                COALESCE(p.paid_at, p.created_at) AS paid_at,
                IFNULL(pmt.name, '') AS method,
                IFNULL(pmt.code, '') AS method_code
            FROM {$this->pos}payment p
            LEFT JOIN {$this->pos}payment_method pmt ON pmt.id = p.payment_method_id
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

    // Lo que se puede pedir del catalogo: el mismo filtro de Catalogo.
    public function qCatalogProducts($companyId, $branchId) {
        return $this->qRows("
            SELECT p.id, p.name, IFNULL(p.price, 0) AS price
            FROM {$this->pos}product p
            WHERE p.company_id = ?
                AND p.branch_id = ?
                AND IFNULL(p.is_custom, 0) = 0
                AND p.kind IN ('product', 'service')
                AND IFNULL(p.active, 1) = 1
            ORDER BY p.name, p.id
        ", [$companyId, $branchId]);
    }

    public function qGetCatalogProduct($id, $companyId, $branchId) {
        return $this->qRow("
            SELECT p.id, p.name, IFNULL(p.price, 0) AS price
            FROM {$this->pos}product p
            WHERE p.id = ?
                AND p.company_id = ?
                AND p.branch_id = ?
                AND IFNULL(p.is_custom, 0) = 0
                AND p.kind IN ('product', 'service')
                AND IFNULL(p.active, 1) = 1
            LIMIT 1
        ", [$id, $companyId, $branchId]);
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
}
