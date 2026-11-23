<?php
/*  Tickets/Cierre › vista «Tickets» (el «Reporte por tickets» de alpha/order-visor).

    Lee pedidos (P: sale_type 1 y 4) y ventas de mostrador (V: 2 y 3) de una
    sucursal. Lo cobrado = pagos vivos (qPaidSql), de cualquier turno.

    Todo es protected: Permission::dispatch ejecuta cualquier metodo publico
    del ctrl que llegue en 'opc', y los de un trait cuentan. */
trait TicketVisor {

    // Los tickets capturados en [desde, hasta), lo mas nuevo arriba. $limit: uno de mas para saber si se corto.
    protected function qTicketList($branchId, $from, $to, $limit) {
        return $this->qRows("
            SELECT
                s.id,
                s.folio,
                s.sale_type_id,
                s.sale_status_id,
                s.created_at,
                s.delivery_date,
                s.delivery_time,
                s.total,
                IFNULL(s.tip_amount, 0) AS tip_amount,
                IFNULL(st.name, '')     AS status,
                IFNULL(c.name, '')      AS customer,
                CONCAT_WS(' ', u.name, u.last_name) AS seller,
                IFNULL(t.folio, '')     AS turn_folio,
                {$this->qPaidSql('s')} AS paid
            FROM {$this->pos}sale s
            LEFT JOIN {$this->pos}sale_status st ON st.id = s.sale_status_id
            LEFT JOIN {$this->pos}customer c     ON c.id  = s.customer_id
            LEFT JOIN {$this->bd}users u         ON u.id  = s.user_id
            LEFT JOIN {$this->pos}turn t         ON t.id  = s.turn_id
            WHERE s.branch_id = ?
                AND s.sale_type_id IN (1, 2, 3, 4)
                AND IFNULL(s.active, 1) = 1
                AND s.created_at >= ?
                AND s.created_at < ?
            ORDER BY s.created_at DESC, s.id DESC
            LIMIT " . (int) $limit, [$branchId, $from, $to]);
    }

    /*  Un ticket de la sucursal, de cualquier tipo, con lo que piden los dos
        formatos: el de pedido (OrderDetail.ticketHtml) y el de venta
        (ordTicketHtml). on_credit, points y stamps: lo de ticketOf en ctrl-historial. */
    protected function qTicketSale($id, $branchId) {
        return $this->qRow("
            SELECT
                s.id,
                s.folio,
                s.sale_type_id,
                s.note,
                s.location,
                s.delivery_method,
                s.delivery_status,
                s.cancel_reason,
                s.discount_note,
                s.subtotal,
                s.discount_amount,
                s.discount_percent,
                IFNULL(s.tip_amount, 0) AS tip_amount,
                s.total,
                s.delivery_date,
                s.delivery_time,
                s.cancelled_at,
                s.created_at,
                s.sale_status_id,
                s.turn_id,
                {$this->qCutSql('s')},
                IFNULL(st.name, '')   AS status,
                IFNULL(c.name, '')    AS customer,
                IFNULL(c.phone, '')   AS phone,
                IFNULL(dr.name, '')   AS discount_reason,
                IFNULL(cd.number, '') AS card_number,
                IFNULL(ct.name, '')   AS card_type,
                CONCAT_WS(' ', uc.name, uc.last_name) AS created_by,
                CONCAT_WS(' ', ux.name, ux.last_name) AS cancelled_by,
                (SELECT COUNT(*)
                   FROM {$this->pos}receivable r
                  WHERE r.sale_id = s.id
                    AND r.kind = 'cargo'
                    AND IFNULL(r.active, 1) = 1
                    AND r.deleted_at IS NULL) AS on_credit,
                (SELECT IFNULL(SUM(r.amount), 0)
                   FROM {$this->pos}receivable r
                  WHERE r.sale_id = s.id
                    AND r.kind = 'puntos'
                    AND IFNULL(r.active, 1) = 1
                    AND r.deleted_at IS NULL) AS points,
                (SELECT IFNULL(SUM(cs.qty), 0)
                   FROM {$this->crm}card_stamp cs
                  WHERE cs.sale_id = s.id
                    AND cs.kind = 'sello'
                    AND cs.active = 1
                    AND cs.deleted_at IS NULL) AS stamps,
                {$this->qPaidSql('s')} AS paid
            FROM {$this->pos}sale s
            LEFT JOIN {$this->pos}sale_status st     ON st.id = s.sale_status_id
            LEFT JOIN {$this->pos}customer c         ON c.id  = s.customer_id
            LEFT JOIN {$this->pos}discount_reason dr ON dr.id = s.discount_reason_id
            LEFT JOIN {$this->crm}card cd            ON cd.id = s.card_id
            LEFT JOIN {$this->crm}card_type ct       ON ct.id = cd.card_type_id
            LEFT JOIN {$this->bd}users uc            ON uc.id = s.user_id
            LEFT JOIN {$this->bd}users ux            ON ux.id = s.cancel_user_id
            WHERE s.id = ?
                AND s.branch_id = ?
                AND s.sale_type_id IN (1, 2, 3, 4)
                AND IFNULL(s.active, 1) = 1
            LIMIT 1
        ", [$id, $branchId]);
    }
}
