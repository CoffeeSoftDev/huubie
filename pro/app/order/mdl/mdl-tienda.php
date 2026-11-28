<?php
/*  Tienda en linea (V8 del plan de Ventas).

    Va aparte de mdl-order.php, que no se toca. Lo usan ctrl-tienda (la pagina
    interna, con sesion) y ctrl-pedir (el enlace publico, SIN sesion) con
    `use OnlineStore;`.

    Reglas que no se ven en el codigo de un vistazo:
      - online_store es una fila por sucursal. Sin fila = la tienda nunca se
        configuro: ctrl-tienda la crea apagada la primera vez que se abre.
      - Que productos salen: el mismo filtro de Pedidos (qCatalogProducts:
        los de la sucursal mas los de la Matriz que la sucursal no repite por
        nombre) y ademas product.in_catalog = 1, el switch «Catálogo» de
        Catálogo › Productos. Un producto de la Matriz es de todas las
        sucursales que lo comparten: prenderlo aqui lo prende en todas.
      - Paquetes (kind 'bundle') y pasteles personalizados no salen: Pedidos
        no sabe editarlos y un pedido aceptado se edita en Pedidos.
      - Un pedido de la tienda es una venta con sale_type_id 4 (E-commerce) en
        Cotizacion. Aceptarlo la pasa a sale_type_id 1 (Pedido). online_order
        guarda lo que el cliente escribio (nombre y telefono tal cual), la
        entrega, el pago y la IP.
      - Todo es protected: Permission::dispatch ejecuta cualquier metodo publico
        del ctrl que llegue en `opc`, y los de un trait cuentan como suyos. */
trait OnlineStore {

    // -- Tienda --

    protected function storeColumns() {
        return "
                os.id,
                os.branch_id,
                os.active,
                os.token,
                IFNULL(os.title, '')      AS title,
                IFNULL(os.message, '')    AS message,
                IFNULL(os.whatsapp, '')   AS whatsapp,
                IFNULL(os.accent, '')     AS accent,
                IFNULL(os.bank_info, '')  AS bank_info,
                os.pickup,
                os.delivery,
                os.pay_transfer,
                os.pay_store,
                os.lead_days,
                os.updated_at";
    }

    protected function qStore($branchId) {
        return $this->qRow("
            SELECT {$this->storeColumns()}
            FROM {$this->pos}online_store os
            WHERE os.branch_id = ?
            LIMIT 1
        ", [$branchId]);
    }

    // La tienda del enlace con su sucursal y su empresa. Null si el token no existe o la sucursal ya no opera.
    protected function qStoreByToken($token) {
        return $this->qRow("
            SELECT
                {$this->storeColumns()},
                IFNULL(b.name, '')       AS branch,
                IFNULL(b.ubication, '')  AS address,
                IFNULL(b.logo, '')       AS branch_logo,
                b.company_id,
                IFNULL(co.name, '')      AS company,
                IFNULL(co.logo, '')      AS company_logo
            FROM {$this->pos}online_store os
            INNER JOIN {$this->bd}branches b   ON b.id  = os.branch_id AND IFNULL(b.is_active, 1) = 1
            INNER JOIN {$this->bd}companies co ON co.id = b.company_id
            WHERE os.token = ?
            LIMIT 1
        ", [$token]);
    }

    // Otra tienda con ese token (la probabilidad es minima, pero el UNIQUE lo rechazaria).
    protected function qStoreTokenTaken($token) {
        return $this->qCount("SELECT COUNT(*) FROM {$this->pos}online_store WHERE token = ?", [$token]) > 0;
    }

    protected function qCreateStore($array) {
        return $this->qInsertInto('online_store', $array);
    }

    protected function qUpdateStore($array) {
        return $this->qUpdateIn('online_store', $array);
    }

    // -- Productos --

    /*  El catalogo de la sucursal (filtro de Pedidos) con su marca de tienda.
        $onlyStore = true deja solo los que salen en la tienda (in_catalog = 1).
        Params: [empresa, sucursal, matriz, sucursal, sucursal]. */
    protected function qStoreProducts($companyId, $branchId, $mainId, $onlyStore = false) {
        $store = $onlyStore ? 'AND IFNULL(p.in_catalog, 0) = 1' : '';

        return $this->qRows("
            SELECT
                p.id,
                p.name,
                IFNULL(p.description, '')  AS description,
                IFNULL(p.price, 0)         AS price,
                IFNULL(c.id, 0)            AS category_id,
                IFNULL(TRIM(c.name), '')   AS category,
                IFNULL(c.icon, '')         AS category_icon,
                IFNULL(p.image, '')        AS image,
                IFNULL(p.in_catalog, 0)    AS in_catalog,
                p.branch_id
            FROM {$this->pos}product p
            LEFT JOIN {$this->pos}category c
                ON c.id = p.category_id
                AND IFNULL(c.active, 1) = 1
            WHERE p.company_id = ?
                AND p.branch_id IN (?, ?)
                AND IFNULL(p.is_custom, 0) = 0
                AND p.kind IN ('product', 'service')
                AND IFNULL(p.active, 1) = 1
                {$store}
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
            ORDER BY (c.id IS NULL), c.name, p.name, p.id
        ", [$companyId, $branchId, $mainId, $branchId, $branchId]);
    }

    // Prende o apaga «sale en la tienda» de varios productos. Los ids ya vienen validados.
    protected function qSetInCatalog(array $ids, $on) {
        if (empty($ids)) return true;

        $data = array_merge([(int) $on], array_values($ids));

        return $this->_CUD("
            UPDATE {$this->pos}product
            SET in_catalog = ?, updated_at = NOW()
            WHERE id IN ({$this->qIn($ids)})
        ", $data);
    }

    // -- Pedidos de la tienda --

    /*  La bandeja. $state: 'new' por aceptar, 'accepted', 'cancelled' o 'all'.
        Solo ventas que nacieron en la tienda (tienen fila en online_order). */
    protected function qWebOrders($branchId, $state, $from, $to) {
        $where = [
            'new'       => 'AND s.sale_type_id = 4 AND s.sale_status_id <> 4',
            'accepted'  => 'AND s.sale_type_id = 1 AND s.sale_status_id <> 4',
            'cancelled' => 'AND s.sale_status_id = 4',
            'all'       => ''
        ];

        $filter = isset($where[$state]) ? $where[$state] : '';

        return $this->qRows("
            SELECT
                s.id,
                s.folio,
                s.sale_type_id,
                s.sale_status_id,
                s.delivery_method,
                s.delivery_date,
                s.delivery_time,
                s.total,
                s.created_at,
                IFNULL(st.name, '')  AS status,
                o.customer_name,
                o.phone,
                o.delivery,
                o.payment,
                (
                    SELECT COUNT(*)
                    FROM {$this->pos}detail_sale d
                    WHERE d.sale_id = s.id
                        AND IFNULL(d.active, 1) = 1
                ) AS lines_count,
                {$this->qPaidSql('s')} AS paid
            FROM {$this->pos}online_order o
            INNER JOIN {$this->pos}sale s        ON s.id = o.sale_id
            LEFT JOIN {$this->pos}sale_status st ON st.id = s.sale_status_id
            WHERE o.branch_id = ?
                AND s.branch_id = ?
                AND IFNULL(s.active, 1) = 1
                AND o.created_at >= ?
                AND o.created_at < ?
                {$filter}
            ORDER BY (s.sale_type_id = 4 AND s.sale_status_id <> 4) DESC, s.id DESC
        ", [$branchId, $branchId, $from, $to]);
    }

    // Un pedido de la tienda de esa sucursal, aceptado o no.
    protected function qWebOrder($id, $branchId) {
        return $this->qRow("
            SELECT
                s.id,
                s.folio,
                s.sale_type_id,
                s.sale_status_id,
                s.delivery_method,
                s.delivery_date,
                s.delivery_time,
                IFNULL(s.location, '')       AS location,
                IFNULL(s.note, '')           AS note,
                IFNULL(s.cancel_reason, '')  AS cancel_reason,
                s.subtotal,
                s.total,
                s.created_at,
                s.customer_id,
                IFNULL(st.name, '')          AS status,
                o.customer_name,
                o.phone,
                IFNULL(o.email, '')          AS email,
                o.delivery,
                o.payment,
                {$this->qPaidSql('s')} AS paid
            FROM {$this->pos}online_order o
            INNER JOIN {$this->pos}sale s        ON s.id = o.sale_id
            LEFT JOIN {$this->pos}sale_status st ON st.id = s.sale_status_id
            WHERE s.id = ?
                AND s.branch_id = ?
                AND IFNULL(s.active, 1) = 1
            LIMIT 1
        ", [$id, $branchId]);
    }

    // El mismo, bloqueado hasta el commit (FOR UPDATE). Solo dentro de transaction().
    protected function qLockWebOrder($id, $branchId) {
        return $this->qRow("
            SELECT
                s.id,
                s.sale_type_id,
                s.sale_status_id,
                s.delivery_status,
                s.total,
                o.customer_name,
                {$this->qPaidSql('s')} AS paid
            FROM {$this->pos}sale s
            INNER JOIN {$this->pos}online_order o ON o.sale_id = s.id
            WHERE s.id = ?
                AND s.branch_id = ?
                AND IFNULL(s.active, 1) = 1
            LIMIT 1
            FOR UPDATE
        ", [$id, $branchId]);
    }

    // Cifras del panel: por aceptar (sin limite de fecha) y recibidos hoy.
    protected function qWebOrderCounts($branchId, $todayFrom, $todayTo) {
        return $this->qRow("
            SELECT
                IFNULL(SUM(s.sale_type_id = 4 AND s.sale_status_id <> 4), 0)          AS pending,
                IFNULL(SUM(o.created_at >= ? AND o.created_at < ?), 0)                AS today,
                IFNULL(SUM(s.sale_type_id = 1 AND s.sale_status_id <> 4), 0)          AS accepted
            FROM {$this->pos}online_order o
            INNER JOIN {$this->pos}sale s ON s.id = o.sale_id
            WHERE o.branch_id = ?
                AND IFNULL(s.active, 1) = 1
        ", [$todayFrom, $todayTo, $branchId]) ?: ['pending' => 0, 'today' => 0, 'accepted' => 0];
    }

    // -- Limite de pedidos --

    protected function qOrdersFromIp($ip, $since) {
        return $this->qCount("
            SELECT COUNT(*)
            FROM {$this->pos}online_order
            WHERE ip = ?
                AND created_at >= ?
        ", [$ip, $since]);
    }

    protected function qOrdersFromPhone($branchId, $phone, $since) {
        return $this->qCount("
            SELECT COUNT(*)
            FROM {$this->pos}online_order
            WHERE branch_id = ?
                AND phone = ?
                AND created_at >= ?
        ", [$branchId, $phone, $since]);
    }

    // -- Cliente --

    /*  El cliente de la empresa con ese telefono, comparando los ultimos 10
        digitos (asi «+52 993 123 4567» y «9931234567» son el mismo). */
    protected function qStoreCustomer($branchId, $phone10) {
        return $this->qRow("
            SELECT id, IFNULL(name, '') AS name, IFNULL(email, '') AS email
            FROM {$this->pos}customer
            WHERE {$this->qSameCompany('branch_id')}
                AND IFNULL(active, 1) = 1
                AND RIGHT(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(IFNULL(phone, ''), ' ', ''), '-', ''), '(', ''), ')', ''), '+', ''), 10) = ?
            ORDER BY id
            LIMIT 1
        ", [$branchId, $phone10]);
    }

    protected function qCreateWebOrder($array) {
        return $this->qInsertInto('online_order', $array);
    }
}
