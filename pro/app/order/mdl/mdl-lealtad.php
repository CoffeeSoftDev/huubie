<?php
/*  Tarjetas de lealtad y puntos (V4 del plan de Ventas).

    Va aparte de mdl-order.php y de mdl-credito.php, que no se tocan.
    Lo usan ctrl-puntos, ctrl-ventas y ctrl-historial con `use LoyaltyCards;`.

    Reglas que no se ven en el codigo de un vistazo:
      - card_type dice que da la tarjeta (descuento O puntos: uno solo, lo cuida
        ctrl-puntos) y de que color se dibuja; card es el plastico: un numero,
        un titular impreso y, si se quiere, un cliente dueño.
      - card_type.color solo lo lee la pagina Puntos (qCardTypes, qCardType y
        qCards). cardColumns() no lo trae: Vender e Historial no dependen de el.
      - card NO guarda saldo. Los puntos son dinero: se suman a customer.wallet
        (el monedero de V3) y se gastan pagando con «Monedero».
      - Cada abono de puntos deja una fila en receivable con kind = 'puntos' y la
        venta que los dio: con eso se sabe cuanto quitar si la venta se cancela.
        Las cuentas de credito solo leen 'cargo' y 'abono': no la ven.
      - Dan puntos los pagos con metodos que tienen earns_points = 1. El Monedero
        no da (seria ganar puntos con puntos) y lo que queda a credito tampoco.
      - Tarjetas y tipos son de toda la empresa, como los clientes: branch_id es
        la sucursal de alta y los filtros van con qSameCompany (mdl-order.php).
        Numero de tarjeta y nombre de tipo no se repiten dentro de la empresa.
      - Todo es protected: Permission::dispatch ejecuta cualquier metodo publico
        del ctrl que llegue en `opc`, y los de un trait cuentan como suyos.
      - Ningun nombre se repite con CreditLedger: dos traits en la misma clase
        no pueden traer el mismo metodo. */
trait LoyaltyCards {

    // -- Tipos de tarjeta --

    // Tipos de la empresa con cuantas tarjetas activas tiene cada uno. $active null = todos.
    protected function qCardTypes($branchId, $active = null) {
        $where = '';
        $data  = [$branchId];

        if ($active !== null) {
            $where  = 'AND IFNULL(t.active, 1) = ?';
            $data[] = $active;
        }

        return $this->qRows("
            SELECT
                t.id,
                t.name,
                IFNULL(t.discount_percent, 0)  AS discount_percent,
                IFNULL(t.points_percent, 0)    AS points_percent,
                IFNULL(t.color, '')            AS color,
                IFNULL(t.active, 1)            AS active,
                (
                    SELECT COUNT(*)
                    FROM {$this->pos}card c
                    WHERE c.card_type_id = t.id
                        AND IFNULL(c.active, 1) = 1
                ) AS cards
            FROM {$this->pos}card_type t
            WHERE {$this->qSameCompany('t.branch_id')}
                {$where}
            ORDER BY t.name, t.id
        ", $data);
    }

    // Un tipo de la empresa. Null si es de otra.
    protected function qCardType($id, $branchId) {
        return $this->qRow("
            SELECT
                id,
                name,
                IFNULL(discount_percent, 0)  AS discount_percent,
                IFNULL(points_percent, 0)    AS points_percent,
                IFNULL(color, '')            AS color,
                IFNULL(active, 1)            AS active
            FROM {$this->pos}card_type
            WHERE id = ?
                AND {$this->qSameCompany('branch_id')}
            LIMIT 1
        ", [$id, $branchId]);
    }

    // Otro tipo de la empresa con ese nombre, activo o no.
    protected function qCardTypeNameTaken($branchId, $name, $exceptId) {
        return $this->qRow("
            SELECT id, name
            FROM {$this->pos}card_type
            WHERE {$this->qSameCompany('branch_id')}
                AND id <> ?
                AND name = ?
            ORDER BY id
            LIMIT 1
        ", [$branchId, $exceptId, $name]);
    }

    protected function qCreateCardType($array) {
        return $this->qInsertInto('card_type', $array);
    }

    protected function qUpdateCardType($array) {
        return $this->qUpdateIn('card_type', $array);
    }

    // -- Tarjetas --

    // Columnas de una tarjeta con su tipo y su dueño. owner_id solo si el dueño sigue activo y es de la misma empresa.
    protected function cardColumns() {
        return "
                c.id,
                c.number,
                IFNULL(c.holder, '')           AS holder,
                IFNULL(c.active, 1)            AS active,
                c.card_type_id,
                c.customer_id,
                IFNULL(t.name, '')             AS type,
                IFNULL(t.discount_percent, 0)  AS discount_percent,
                IFNULL(t.points_percent, 0)    AS points_percent,
                IF(t.id IS NULL, 0, IFNULL(t.active, 1)) AS type_active,
                IFNULL(cu.name, '')            AS customer,
                IFNULL(cu.phone, '')           AS customer_phone,
                IF(cu.id IS NOT NULL AND IFNULL(cu.active, 1) = 1 AND EXISTS (
                    SELECT 1
                    FROM {$this->bd}branches ob
                    INNER JOIN {$this->bd}branches cb ON cb.company_id = ob.company_id
                    WHERE ob.id = cu.branch_id
                        AND cb.id = c.branch_id
                ), cu.id, NULL) AS owner_id";
    }

    // Tarjetas de la empresa con el color de su tipo y las ventas vivas de cada una. $active null = todas.
    protected function qCards($branchId, $active = null) {
        $where = '';
        $data  = [$branchId];

        if ($active !== null) {
            $where  = 'AND IFNULL(c.active, 1) = ?';
            $data[] = $active;
        }

        return $this->qRows("
            SELECT
                {$this->cardColumns()},
                IFNULL(t.color, '')            AS type_color,
                (
                    SELECT COUNT(*)
                    FROM {$this->pos}sale s
                    WHERE s.card_id = c.id
                        AND s.sale_status_id IN (2, 3)
                        AND IFNULL(s.active, 1) = 1
                ) AS sales
            FROM {$this->pos}card c
            LEFT JOIN {$this->pos}card_type t  ON t.id  = c.card_type_id
            LEFT JOIN {$this->pos}customer cu  ON cu.id = c.customer_id
            WHERE {$this->qSameCompany('c.branch_id')}
                {$where}
            ORDER BY c.number, c.id
        ", $data);
    }

    // Una tarjeta de la empresa, activa o no. Null si es de otra.
    protected function qCard($id, $branchId) {
        return $this->qRow("
            SELECT
                {$this->cardColumns()}
            FROM {$this->pos}card c
            LEFT JOIN {$this->pos}card_type t  ON t.id  = c.card_type_id
            LEFT JOIN {$this->pos}customer cu  ON cu.id = c.customer_id
            WHERE c.id = ?
                AND {$this->qSameCompany('c.branch_id')}
            LIMIT 1
        ", [$id, $branchId]);
    }

    // Otra tarjeta de la empresa con ese numero, activa o no. La columna no distingue mayusculas.
    protected function qCardNumberTaken($branchId, $number, $exceptId) {
        return $this->qRow("
            SELECT id, number
            FROM {$this->pos}card
            WHERE {$this->qSameCompany('branch_id')}
                AND id <> ?
                AND number = ?
            ORDER BY id
            LIMIT 1
        ", [$branchId, $exceptId, $number]);
    }

    // La tarjeta que se puede usar al vender: activa y con su tipo activo. Se busca por numero.
    protected function qCardByNumber($branchId, $number) {
        return $this->qRow("
            SELECT
                {$this->cardColumns()}
            FROM {$this->pos}card c
            INNER JOIN {$this->pos}card_type t ON t.id  = c.card_type_id AND IFNULL(t.active, 1) = 1
            LEFT JOIN {$this->pos}customer cu  ON cu.id = c.customer_id
            WHERE {$this->qSameCompany('c.branch_id')}
                AND c.number = ?
                AND IFNULL(c.active, 1) = 1
            ORDER BY c.id
            LIMIT 1
        ", [$branchId, $number]);
    }

    // La misma, por id: es la que valida addSale.
    protected function qSaleCard($id, $branchId) {
        return $this->qRow("
            SELECT
                {$this->cardColumns()}
            FROM {$this->pos}card c
            INNER JOIN {$this->pos}card_type t ON t.id  = c.card_type_id AND IFNULL(t.active, 1) = 1
            LEFT JOIN {$this->pos}customer cu  ON cu.id = c.customer_id
            WHERE c.id = ?
                AND {$this->qSameCompany('c.branch_id')}
                AND IFNULL(c.active, 1) = 1
            LIMIT 1
        ", [$id, $branchId]);
    }

    protected function qCreateCard($array) {
        return $this->qInsertInto('card', $array);
    }

    protected function qUpdateCard($array) {
        return $this->qUpdateIn('card', $array);
    }

    // Lo que la pantalla de Vender necesita de una tarjeta. customer_id null = sin dueño (o su dueño ya no vende aqui).
    protected function cardBrief($card) {
        $owner = $card['owner_id'] !== null ? (int) $card['owner_id'] : null;

        return [
            'id'               => (int) $card['id'],
            'number'           => (string) $card['number'],
            'holder'           => (string) $card['holder'],
            'type'             => (string) $card['type'],
            'discount_percent' => round((float) $card['discount_percent'], 2),
            'points_percent'   => round((float) $card['points_percent'], 2),
            'customer_id'      => $owner,
            'customer'         => $owner ? (string) $card['customer'] : ''
        ];
    }

    // -- Puntos --

    // Ids de los metodos de pago de la sucursal que dan puntos.
    protected function qEarningMethodIds($branchId) {
        $rows = $this->qRows("
            SELECT id
            FROM {$this->pos}payment_method
            WHERE (branch_id = ? OR company_id IS NULL)
                AND IFNULL(earns_points, 0) = 1
                AND IFNULL(active, 1) = 1
        ", [$branchId]);

        return array_map(fn ($row) => (int) $row['id'], $rows);
    }

    /*  Los puntos de una venta, en dinero. $rows: [{method_id, amount}] ya cobrados.
        La base es lo pagado con metodos que dan puntos, sin pasar del total:
        asi la propina no cuenta. */
    protected function pointsOf(array $rows, $total, $percent, array $earning) {
        $percent = (float) $percent;

        if ($percent <= 0) return 0.0;

        $base = 0;

        foreach ($rows as $row) {
            if (in_array((int) $row['method_id'], $earning, true)) $base += (float) $row['amount'];
        }

        $base = min(round($base, 2), round((float) $total, 2));

        return $base > 0 ? round($base * $percent / 100, 2) : 0.0;
    }

    // Los puntos vivos que dio una venta. Null = no dio.
    protected function qSalePoints($saleId) {
        return $this->qRow("
            SELECT id, amount, customer_id
            FROM {$this->pos}receivable
            WHERE sale_id = ?
                AND kind = 'puntos'
                AND IFNULL(active, 1) = 1
                AND deleted_at IS NULL
            ORDER BY id
            LIMIT 1
        ", [$saleId]);
    }

    // Deja constancia de los puntos abonados. El monedero lo mueve quien llama.
    protected function savePoints($saleId, $customerId, $turnId, $amount, $description) {
        $this->must($this->qInsertInto('receivable', [
            'values' => ['kind', 'description', 'amount', 'branch_id', 'user_id', 'customer_id', 'sale_id', 'turn_id', 'active'],
            'data'   => ['puntos', $description, round((float) $amount, 2), $this->branchId(), $this->userId() ?: null, $customerId, $saleId, $turnId, 1]
        ]), 'points');
    }

    // Anula el registro de puntos (borrado logico).
    protected function voidPoints($id, $what) {
        $this->must($this->qUpdateIn('receivable', [
            'values' => ['active', 'deleted_at = NOW()', 'deleted_user_id', 'updated_at = NOW()'],
            'where'  => ['id'],
            'data'   => [0, $this->userId() ?: null, $id]
        ]), $what);
    }
}
