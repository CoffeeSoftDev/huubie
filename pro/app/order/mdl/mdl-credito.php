<?php
/*  Credito por cliente y monedero (V3 del plan de Ventas).

    Va aparte de mdl-order.php, que es compartido con Pedidos y no se toca.
    Lo usan ctrl-ventas, ctrl-historial y ctrl-clientes con `use CreditLedger;`.

    Reglas que no se ven en el codigo de un vistazo:
      - receivable guarda la cuenta del cliente: un 'cargo' al vender a credito
        y un 'abono' cada vez que paga. Lo que debe = cargos - abonos vivos.
      - Un abono SIEMPRE es tambien una fila de payment: asi entra solo al corte
        del turno en que se cobro. Por eso el corte NO debe sumar receivable:
        contaria el dinero dos veces.
      - El abono copia venta, metodo, monto y paid_at de su pago: con eso se
        emparejan al quitar el pago.
      - Por venta: cargo - abonos = lo que se debe - lo pagado.
      - El monedero es customer.wallet. Se paga con el metodo de code PUNTOS,
        que esta oculto (is_visible 0): qPaymentMethods no lo lista.
      - Todo es protected: Permission::dispatch ejecuta cualquier metodo publico
        del ctrl que llegue en `opc`, y los de un trait cuentan como suyos. */
trait CreditLedger {

    // -- Cliente --

    // El cliente con su monedero y su credito. $lock: bloqueado hasta el commit (solo dentro de transaction()).
    protected function qCreditCustomer($id, $lock = false) {
        $for = $lock ? 'FOR UPDATE' : '';

        return $this->qRow("
            SELECT
                id,
                IFNULL(name, '')           AS name,
                branch_id,
                IFNULL(active, 1)          AS active,
                IFNULL(wallet, 0)          AS wallet,
                IFNULL(credit_enabled, 0)  AS credit_enabled,
                IFNULL(credit_limit, 0)    AS credit_limit
            FROM {$this->pos}customer
            WHERE id = ?
            LIMIT 1
            {$for}
        ", [$id]);
    }

    // Lo que el cliente debe a credito: cargos menos abonos vivos.
    protected function qCreditDebt($customerId) {
        $row = $this->qRow("
            SELECT IFNULL(SUM(IF(kind = 'cargo', amount, -amount)), 0) AS debt
            FROM {$this->pos}receivable
            WHERE customer_id = ?
                AND kind IN ('cargo', 'abono')
                AND IFNULL(active, 1) = 1
                AND deleted_at IS NULL
        ", [$customerId]);

        return $row ? round((float) $row['debt'], 2) : 0.0;
    }

    // Monedero, credito y adeudo de cada cliente de la sucursal.
    protected function qCreditCustomers($branchId) {
        return $this->qRows("
            SELECT
                c.id,
                IFNULL(c.wallet, 0)          AS wallet,
                IFNULL(c.credit_enabled, 0)  AS credit_enabled,
                IFNULL(c.credit_limit, 0)    AS credit_limit,
                IFNULL(x.debt, 0)            AS debt
            FROM {$this->pos}customer c
            LEFT JOIN (
                SELECT r.customer_id, SUM(IF(r.kind = 'cargo', r.amount, -r.amount)) AS debt
                FROM {$this->pos}receivable r
                WHERE r.kind IN ('cargo', 'abono')
                    AND IFNULL(r.active, 1) = 1
                    AND r.deleted_at IS NULL
                GROUP BY r.customer_id
            ) x ON x.customer_id = c.id
            WHERE c.branch_id = ?
        ", [$branchId]);
    }

    // Los numeros de un cliente ya redondeados: {enabled, limit, debt, available, wallet}.
    protected function creditBrief($customer, $debt) {
        $enabled = $customer && (int) $customer['credit_enabled'] === 1;
        $limit   = $customer ? round((float) $customer['credit_limit'], 2) : 0.0;
        $debt    = max(round((float) $debt, 2), 0);

        return [
            'enabled'   => $enabled,
            'limit'     => $limit,
            'debt'      => $debt,
            'available' => $enabled ? max(round($limit - $debt, 2), 0) : 0.0,
            'wallet'    => $customer ? max(round((float) $customer['wallet'], 2), 0) : 0.0
        ];
    }

    // -- Monedero --

    // El metodo «Monedero». Null = falta la migracion 2026-11-14_metodo-monedero.sql.
    protected function qWalletMethod($companyId) {
        return $this->qRow("
            SELECT id, name, IFNULL(code, '') AS code, 0 AS is_cash
            FROM {$this->pos}payment_method
            WHERE code = 'PUNTOS'
                AND (company_id = ? OR company_id IS NULL)
                AND IFNULL(active, 1) = 1
            ORDER BY company_id IS NULL, id
            LIMIT 1
        ", [$companyId]);
    }

    protected function isWalletCode($code) {
        return (string) $code === 'PUNTOS';
    }

    // Suma (o resta, con monto negativo) al monedero del cliente.
    protected function moveWallet($customerId, $amount, $what) {
        $this->must($this->qUpdateCustomer([
            'values' => ['wallet = IFNULL(wallet, 0) + ?', 'updated_at = NOW()'],
            'where'  => ['id'],
            'data'   => [round((float) $amount, 2), $customerId]
        ]), $what);
    }

    // -- Cuenta de credito: lectura --

    // El cargo vivo de una venta. Null = no se vendio a credito.
    protected function qSaleCharge($saleId) {
        return $this->qRow("
            SELECT id, amount, customer_id
            FROM {$this->pos}receivable
            WHERE sale_id = ?
                AND kind = 'cargo'
                AND IFNULL(active, 1) = 1
                AND deleted_at IS NULL
            ORDER BY id
            LIMIT 1
        ", [$saleId]);
    }

    // Un pago con lo que hace falta para hallar su abono y saber si fue con monedero.
    protected function qPaymentLedger($paymentId) {
        return $this->qRow("
            SELECT
                p.id,
                p.sale_id,
                p.amount,
                p.payment_method_id,
                p.paid_at,
                IFNULL(pm.code, '') AS method_code
            FROM {$this->pos}payment p
            LEFT JOIN {$this->pos}payment_method pm ON pm.id = p.payment_method_id
            WHERE p.id = ?
            LIMIT 1
        ", [$paymentId]);
    }

    // El abono que nacio con ese pago: misma venta, metodo, monto y hora.
    protected function qCreditPaymentOf($saleId, $methodId, $amount, $paidAt) {
        return $this->qRow("
            SELECT id
            FROM {$this->pos}receivable
            WHERE sale_id = ?
                AND kind = 'abono'
                AND payment_method_id = ?
                AND ABS(amount - ?) < 0.005
                AND paid_at = ?
                AND IFNULL(active, 1) = 1
                AND deleted_at IS NULL
            ORDER BY id
            LIMIT 1
        ", [$saleId, $methodId, $amount, $paidAt]);
    }

    // Cargos y abonos vivos del cliente, del mas nuevo al mas viejo.
    protected function qCreditMoves($customerId, $limit) {
        $limit = max(1, (int) $limit);

        return $this->qRows("
            SELECT
                r.id,
                r.kind,
                r.amount,
                IFNULL(r.description, '')            AS description,
                COALESCE(r.paid_at, r.created_at)    AS moved_at,
                r.sale_id,
                IFNULL(pm.name, '')                  AS method
            FROM {$this->pos}receivable r
            LEFT JOIN {$this->pos}payment_method pm ON pm.id = r.payment_method_id
            WHERE r.customer_id = ?
                AND r.kind IN ('cargo', 'abono')
                AND IFNULL(r.active, 1) = 1
                AND r.deleted_at IS NULL
            ORDER BY r.id DESC
            LIMIT {$limit}
        ", [$customerId]);
    }

    /*  Bloquea hasta el commit esas ventas y devuelve los ids que existen.
        Va por la llave primaria y SIN subconsultas a proposito:
          - por id solo se bloquean esas filas. Buscando por cliente se bloquean
            tambien los huecos del indice, y una venta nueva se queda esperando.
          - la transaccion fija su foto de lectura en la primera lectura normal y
            un bloqueo no cuenta: qCreditSales, que se llama despues, ya ve los
            pagos que otro cobro confirmo mientras este esperaba.
        Tiene que ser lo primero dentro de transaction(). */
    protected function qLockSales(array $ids) {
        $ids = array_values(array_unique(array_filter(array_map('intval', $ids), fn ($id) => $id > 0)));

        if (!$ids) return [];

        $marks = implode(', ', array_fill(0, count($ids), '?'));

        $rows = $this->qRows("
            SELECT id
            FROM {$this->pos}sale
            WHERE id IN ({$marks})
            ORDER BY id
            FOR UPDATE
        ", $ids);

        return array_map(fn ($row) => (int) $row['id'], $rows);
    }

    // Las ventas a credito del cliente que siguen pendientes, la mas vieja primero.
    protected function qCreditSales($customerId) {
        return $this->qRows("
            SELECT
                s.id,
                s.total,
                IFNULL(s.tip_amount, 0) AS tip_amount,
                {$this->qPaidSql('s')}  AS paid
            FROM {$this->pos}sale s
            WHERE s.customer_id = ?
                AND s.sale_type_id = 3
                AND s.sale_status_id = 2
                AND IFNULL(s.active, 1) = 1
                AND EXISTS (
                    SELECT 1
                    FROM {$this->pos}receivable r
                    WHERE r.sale_id = s.id
                        AND r.kind = 'cargo'
                        AND IFNULL(r.active, 1) = 1
                        AND r.deleted_at IS NULL
                )
            ORDER BY s.id
        ", [$customerId]);
    }

    // -- Cuenta de credito: escritura --

    protected function qCreateReceivable($array) {
        return $this->qInsertInto('receivable', $array);
    }

    protected function qUpdateReceivable($array) {
        return $this->qUpdateIn('receivable', $array);
    }

    // El cargo de una venta a credito: lo que quedo a deber al cobrarla.
    protected function saveCreditCharge($saleId, $customerId, $turnId, $amount) {
        $this->must($this->qCreateReceivable([
            'values' => ['kind', 'description', 'amount', 'branch_id', 'user_id', 'customer_id', 'sale_id', 'turn_id', 'active'],
            'data'   => ['cargo', "Crédito venta V{$saleId}", round((float) $amount, 2), $this->branchId(), $this->userId() ?: null, $customerId, $saleId, $turnId, 1]
        ]), 'credit charge');
    }

    /*  Un abono por cada pago ($rows: [{method_id, amount}]). $now es el paid_at
        de las filas de payment que se acaban de guardar: tiene que ser el mismo. */
    protected function saveCreditPayments($saleId, $customerId, $turnId, array $rows, $now, $description) {
        $data = [];

        foreach ($rows as $row) {
            $data[] = [
                'abono', $description, round((float) $row['amount'], 2), $now, $this->branchId(), $this->userId() ?: null,
                $customerId, $saleId, $turnId, $row['method_id'], 1
            ];
        }

        if (!$data) return;

        $this->must($this->qCreateReceivable([
            'values' => ['kind', 'description', 'amount', 'paid_at', 'branch_id', 'user_id', 'customer_id', 'sale_id', 'turn_id', 'payment_method_id', 'active'],
            'data'   => $data
        ]), 'credit payment');
    }

    // Anula un movimiento (borrado logico).
    protected function voidReceivable($id, $what) {
        $this->must($this->qUpdateReceivable([
            'values' => ['active', 'deleted_at = NOW()', 'deleted_user_id', 'updated_at = NOW()'],
            'where'  => ['id'],
            'data'   => [0, $this->userId() ?: null, $id]
        ]), $what);
    }

    // Anula el cargo y los abonos vivos de una venta: al cancelarla ya no se debe nada.
    protected function voidSaleLedger($saleId, $what) {
        $this->must($this->qUpdateReceivable([
            'values' => ['active', 'deleted_at = NOW()', 'deleted_user_id', 'updated_at = NOW()'],
            'where'  => ['sale_id', 'IFNULL(active, 1) = 1'],
            'data'   => [0, $this->userId() ?: null, $saleId]
        ]), $what);
    }
}
