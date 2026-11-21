<?php
/*  Cierre del día › Corte Z (el reporte de alpha: pedidos-cierre.js ›
    renderExecutiveSummary). Todo sale de los turnos del día ($turnIds).

      - Ventas del día = pedidos y ventas de esos turnos.
      - Abono = lo cobrado de cada una en esos turnos; Quedó = lo que debía al
        terminar el día ($until = inicio del día siguiente).
      - Abonos anteriores = cobros en esos turnos a pedidos de otro día.
      - Cobros cruzados = cobros a ventas del día que entraron en otra sucursal.

    Todo es protected: Permission::dispatch ejecuta cualquier metodo publico
    del ctrl que llegue en 'opc', y los de un trait cuentan. */
trait DayReport {

    // Lo vivo de un pago: lo usan las cuatro consultas.
    private function qZLive($alias) {
        return "IFNULL({$alias}.active, 1) = 1 AND {$alias}.deleted_at IS NULL";
    }

    protected function qZSales(array $turnIds, $until) {
        $in = $this->qIn($turnIds);

        return $this->qRows("
            SELECT
                s.id,
                s.folio,
                s.sale_type_id,
                s.sale_status_id,
                IFNULL(st.name, '')                    AS status,
                s.turn_id,
                s.created_at,
                IFNULL(c.name, '')                     AS customer,
                IFNULL(s.subtotal, IFNULL(s.total, 0)) AS subtotal,
                IFNULL(s.discount_amount, 0)           AS discount,
                IFNULL(s.total, 0)                     AS total,
                IFNULL(s.tip_amount, 0)                AS tip,
                (SELECT IFNULL(SUM(p.amount), 0)
                   FROM {$this->pos}payment p
                  WHERE p.sale_id = s.id
                    AND p.turn_id IN ({$in})
                    AND {$this->qZLive('p')}) AS paid,
                (SELECT IFNULL(SUM(p.amount), 0)
                   FROM {$this->pos}payment p
                  WHERE p.sale_id = s.id
                    AND IFNULL(p.paid_at, p.created_at) < ?
                    AND {$this->qZLive('p')}) AS paid_upto,
                (SELECT GROUP_CONCAT(DISTINCT IFNULL(pm.name, 'Sin método') ORDER BY pm.name SEPARATOR ', ')
                   FROM {$this->pos}payment p
                   LEFT JOIN {$this->pos}payment_method pm ON pm.id = p.payment_method_id
                  WHERE p.sale_id = s.id
                    AND p.turn_id IN ({$in})
                    AND {$this->qZLive('p')}) AS methods
            FROM {$this->pos}sale s
            LEFT JOIN {$this->pos}sale_status st ON st.id = s.sale_status_id
            LEFT JOIN {$this->pos}customer c     ON c.id  = s.customer_id
            WHERE s.turn_id IN ({$in})
                AND IFNULL(s.active, 1) = 1
            ORDER BY s.created_at, s.id
        ", array_merge($turnIds, [$until], $turnIds, $turnIds));
    }

    // Un renglón por turno y pedido de otro día abonado en él.
    protected function qZPrev(array $turnIds, $until) {
        $in = $this->qIn($turnIds);

        return $this->qRows("
            SELECT
                p.turn_id,
                s.id,
                s.folio,
                s.sale_type_id,
                s.created_at           AS order_date,
                IFNULL(s.branch_id, 0) AS branch_id,
                IFNULL(b.name, '')     AS origin,
                IFNULL(c.name, '')     AS customer,
                IFNULL(s.total, 0)     AS total,
                IFNULL(s.tip_amount, 0) AS tip,
                SUM(p.amount)          AS paid,
                MAX(IFNULL(p.paid_at, p.created_at)) AS paid_at,
                GROUP_CONCAT(DISTINCT IFNULL(pm.name, 'Sin método') ORDER BY pm.name SEPARATOR ', ') AS methods,
                (SELECT IFNULL(SUM(x.amount), 0)
                   FROM {$this->pos}payment x
                  WHERE x.sale_id = s.id
                    AND IFNULL(x.paid_at, x.created_at) < ?
                    AND {$this->qZLive('x')}) AS paid_upto
            FROM {$this->pos}payment p
            JOIN {$this->pos}sale s                 ON s.id  = p.sale_id
            LEFT JOIN {$this->pos}payment_method pm ON pm.id = p.payment_method_id
            LEFT JOIN {$this->pos}customer c        ON c.id  = s.customer_id
            LEFT JOIN {$this->bd}branches b         ON b.id  = s.branch_id
            WHERE p.turn_id IN ({$in})
                AND {$this->qZLive('p')}
                AND (s.turn_id IS NULL OR s.turn_id NOT IN ({$in}))
            GROUP BY p.turn_id, s.id, s.folio, s.sale_type_id, s.created_at, s.branch_id, b.name, c.name, s.total, s.tip_amount
            ORDER BY p.turn_id, MIN(IFNULL(p.paid_at, p.created_at)), s.id
        ", array_merge([$until], $turnIds, $turnIds));
    }

    // Lo cobrado por turno y método. source: 'venta' (pedido del día) o 'abono' (de otro día).
    protected function qZMethods(array $turnIds) {
        $in = $this->qIn($turnIds);

        return $this->qRows("
            SELECT
                p.turn_id,
                IFNULL(pm.id, 0)              AS id,
                IFNULL(pm.name, 'Sin método') AS name,
                IFNULL(pm.is_cash, 0)         AS is_cash,
                IFNULL(pm.sort, 99)           AS sort,
                IF(s.turn_id IN ({$in}), 'venta', 'abono') AS source,
                COUNT(p.id)                   AS payments,
                IFNULL(SUM(p.amount), 0)      AS amount
            FROM {$this->pos}payment p
            LEFT JOIN {$this->pos}payment_method pm ON pm.id = p.payment_method_id
            LEFT JOIN {$this->pos}sale s            ON s.id  = p.sale_id
            WHERE p.turn_id IN ({$in})
                AND {$this->qZLive('p')}
            GROUP BY p.turn_id, pm.id, pm.name, pm.is_cash, pm.sort, source
            ORDER BY sort, id
        ", array_merge($turnIds, $turnIds));
    }

    // Ventas del día cobradas en otra sucursal: informativo, no entra a esta caja.
    protected function qZCross(array $turnIds, $branchId, $until) {
        $in = $this->qIn($turnIds);

        return $this->qRows("
            SELECT
                s.id,
                s.folio,
                s.sale_type_id,
                IFNULL(c.name, '')  AS customer,
                IFNULL(b.name, '')  AS branch,
                IFNULL(s.total, 0)  AS total,
                SUM(p.amount)       AS amount,
                (SELECT IFNULL(SUM(x.amount), 0)
                   FROM {$this->pos}payment x
                  WHERE x.sale_id = s.id
                    AND IFNULL(x.paid_at, x.created_at) < ?
                    AND {$this->qZLive('x')}) AS paid_upto
            FROM {$this->pos}payment p
            JOIN {$this->pos}sale s          ON s.id = p.sale_id
            LEFT JOIN {$this->pos}customer c ON c.id = s.customer_id
            LEFT JOIN {$this->bd}branches b  ON b.id = p.branch_id
            WHERE s.turn_id IN ({$in})
                AND IFNULL(s.active, 1) = 1
                AND (p.turn_id IS NULL OR p.turn_id NOT IN ({$in}))
                AND p.branch_id IS NOT NULL
                AND p.branch_id <> ?
                AND {$this->qZLive('p')}
            GROUP BY s.id, s.folio, s.sale_type_id, c.name, b.name, s.total, p.branch_id
            ORDER BY s.id
        ", array_merge([$until], $turnIds, $turnIds, [$branchId]));
    }
}
