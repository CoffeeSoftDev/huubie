<?php
/*  Tarjetas de lealtad y puntos (V4 del plan de Ventas).

    Va aparte de mdl-order.php y de mdl-credito.php, que no se tocan.
    Lo usan lealtad/ctrl/ctrl-tarjetas, ctrl-ventas y ctrl-historial con `use LoyaltyCards;`,
    y lealtad/tarjeta.php (la tarjeta digital, SIN sesion: solo lee qDigitalCard,
    qCardTotals, qCardWallet y qCardMoves).

    Reglas que no se ven en el codigo de un vistazo:
      - card_type dice que da la tarjeta (descuento O puntos: uno solo, lo cuida
        ctrl-tarjetas) y de que color se dibuja; card es el plastico: un numero,
        un titular impreso y, si se quiere, un cliente dueño.
      - card_type.color solo lo lee la pagina Lealtad › Tarjetas (qCardTypes, qCardType y
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
      - Ningun nombre se repite con CreditLedger ni con TicketLink (ctrl-ventas y
        ctrl-historial usan los tres): dos traits en la misma clase no pueden
        traer el mismo metodo.
      - El resumen y la ficha solo leen: cuentan ventas vivas (pendientes o
        pagadas, no borradas) de toda la empresa.
      - Sellos (lealtad/docs/plan-sellos.html): un tipo con stamp_goal > 0 da
        sellos en lugar de descuento o puntos. Los sellos son de la TARJETA y
        viven en card_stamp (sello +n, canje -meta); los de hoy = la suma viva.
      - card.token es el enlace de la tarjeta digital (tarjeta.php?t=<token>).
        NULL = sin enlace. Cambiarlo deja sin efecto el anterior. El enlace abre
        solo si la tarjeta y su tipo estan activos. */
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
                {$this->stampColumns('t')},
                IFNULL(t.color, '')            AS color,
                IFNULL(t.active, 1)            AS active,
                t.level_min_spend,
                (
                    SELECT COUNT(*)
                    FROM {$this->crm}card c
                    WHERE c.card_type_id = t.id
                        AND IFNULL(c.active, 1) = 1
                ) AS cards
            FROM {$this->crm}card_type t
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
                {$this->stampColumns('card_type')},
                IFNULL(color, '')            AS color,
                IFNULL(active, 1)            AS active,
                level_min_spend
            FROM {$this->crm}card_type
            WHERE id = ?
                AND {$this->qSameCompany('branch_id')}
            LIMIT 1
        ", [$id, $branchId]);
    }

    // Otro tipo de la empresa con ese nombre, activo o no.
    protected function qCardTypeNameTaken($branchId, $name, $exceptId) {
        return $this->qRow("
            SELECT id, name
            FROM {$this->crm}card_type
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

    /*  Los sellos del tipo (alias de la tabla card_type). stamp_goal > 0 = tipo de
        sellos: 1 sello por cada stamp_amount pagados; con stamp_goal, el premio
        reward_name, que descuenta hasta reward_value. stamp_icon: el icono de
        Lucide del sello ('' = circulo liso). */
    protected function stampColumns($alias) {
        return "IFNULL({$alias}.stamp_amount, 0)   AS stamp_amount,
                IFNULL({$alias}.stamp_goal, 0)     AS stamp_goal,
                IFNULL({$alias}.reward_name, '')   AS reward_name,
                IFNULL({$alias}.reward_value, 0)   AS reward_value,
                IFNULL({$alias}.stamp_icon, '')    AS stamp_icon";
    }

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
                {$this->stampColumns('t')},
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

    /*  Tarjetas de la empresa con el color de su tipo, sus ventas vivas (cuantas y la
        ultima) y el monedero de hoy del cliente. $active y $typeId null = sin filtro. */
    protected function qCards($branchId, $active = null, $typeId = null) {
        $where = '';
        $data  = [$branchId];

        if ($active !== null) {
            $where .= ' AND IFNULL(c.active, 1) = ?';
            $data[] = $active;
        }

        if ($typeId !== null) {
            $where .= ' AND c.card_type_id = ?';
            $data[] = $typeId;
        }

        return $this->qRows("
            SELECT
                {$this->cardColumns()},
                IFNULL(t.color, '')            AS type_color,
                IFNULL(cu.wallet, 0)           AS wallet,
                (
                    SELECT IFNULL(SUM(cs.qty), 0)
                    FROM {$this->crm}card_stamp cs
                    WHERE cs.card_id = c.id
                        AND cs.active = 1
                        AND cs.deleted_at IS NULL
                ) AS stamps,
                (
                    SELECT COUNT(*)
                    FROM {$this->pos}sale s
                    WHERE s.card_id = c.id
                        AND {$this->qLiveSaleSql('s')}
                ) AS sales,
                (
                    SELECT MAX(s.created_at)
                    FROM {$this->pos}sale s
                    WHERE s.card_id = c.id
                        AND {$this->qLiveSaleSql('s')}
                ) AS last_sale
            FROM {$this->crm}card c
            LEFT JOIN {$this->crm}card_type t  ON t.id  = c.card_type_id
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
            FROM {$this->crm}card c
            LEFT JOIN {$this->crm}card_type t  ON t.id  = c.card_type_id
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
            FROM {$this->crm}card
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
            FROM {$this->crm}card c
            INNER JOIN {$this->crm}card_type t ON t.id  = c.card_type_id AND IFNULL(t.active, 1) = 1
            LEFT JOIN {$this->pos}customer cu  ON cu.id = c.customer_id
            WHERE {$this->qSameCompany('c.branch_id')}
                AND c.number = ?
                AND IFNULL(c.active, 1) = 1
            ORDER BY c.id
            LIMIT 1
        ", [$branchId, $number]);
    }

    // La misma, por id: es la que valida addSale. El color es para la tarjeta chica de «Venta cobrada».
    protected function qSaleCard($id, $branchId) {
        return $this->qRow("
            SELECT
                {$this->cardColumns()},
                IFNULL(t.color, '') AS color
            FROM {$this->crm}card c
            INNER JOIN {$this->crm}card_type t ON t.id  = c.card_type_id AND IFNULL(t.active, 1) = 1
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

    /*  Lo que la pantalla de Vender necesita de una tarjeta. customer_id null = sin dueño (o su dueño ya no vende aqui).
        Sellos: stamps = los de hoy (nunca menos de 0) y rewards = premios completos que puede canjear. */
    protected function cardBrief($card) {
        $owner = $card['owner_id'] !== null ? (int) $card['owner_id'] : null;
        $goal  = (int) $card['stamp_goal'];
        $have  = $goal > 0 ? max($this->qCardStamps((int) $card['id']), 0) : 0;

        return [
            'id'               => (int) $card['id'],
            'number'           => (string) $card['number'],
            'holder'           => (string) $card['holder'],
            'type'             => (string) $card['type'],
            'discount_percent' => round((float) $card['discount_percent'], 2),
            'points_percent'   => round((float) $card['points_percent'], 2),
            'stamp_goal'       => $goal,
            'stamp_amount'     => round((float) $card['stamp_amount'], 2),
            'reward_name'      => (string) $card['reward_name'],
            'reward_value'     => round((float) $card['reward_value'], 2),
            'stamps'           => $have,
            'rewards'          => $goal > 0 ? intdiv($have, $goal) : 0,
            'customer_id'      => $owner,
            'customer'         => $owner ? (string) $card['customer'] : ''
        ];
    }

    // -- Sellos --

    /*  Los sellos de hoy de una tarjeta: la suma de sus movimientos vivos. Puede
        quedar debajo de 0 si se cancelo una venta cuyos sellos ya se canjearon;
        quien la muestra usa max(…, 0). */
    protected function qCardStamps($cardId) {
        return $this->qCount("
            SELECT IFNULL(SUM(qty), 0)
            FROM {$this->crm}card_stamp
            WHERE card_id = ? AND active = 1 AND deleted_at IS NULL
        ", [$cardId]);
    }

    // Dentro de transaction(): aparta la tarjeta hasta el commit. Dos cobros con el mismo premio se forman.
    protected function qLockCard($cardId) {
        return $this->qRow("SELECT id FROM {$this->crm}card WHERE id = ? LIMIT 1 FOR UPDATE", [$cardId]);
    }

    protected function qCreateStamp($array) {
        return $this->qInsertInto('card_stamp', $array);
    }

    // Los movimientos vivos de sellos de una venta: lo que se deshace al cancelarla.
    protected function qSaleStamps($saleId) {
        return $this->qRows("
            SELECT id, card_id, kind, qty, amount
            FROM {$this->crm}card_stamp
            WHERE sale_id = ? AND active = 1 AND deleted_at IS NULL
            ORDER BY id
        ", [$saleId]);
    }

    // Para la ficha y la tarjeta digital: sellos ganados, premios canjeados y lo que descontaron (solo movimientos vivos).
    protected function qCardStampTotals($cardId) {
        return $this->qRow("
            SELECT
                IFNULL(SUM(IF(kind = 'sello', qty, 0)), 0)     AS earned,
                IFNULL(SUM(kind = 'canje'), 0)                 AS rewards,
                IFNULL(SUM(IF(kind = 'canje', amount, 0)), 0)  AS saved
            FROM {$this->crm}card_stamp
            WHERE card_id = ? AND active = 1 AND deleted_at IS NULL
        ", [$cardId]);
    }

    // Anula los sellos de una venta (borrado logico): los que dio se quitan y los que canjeo regresan.
    protected function voidSaleStamps($saleId, $what) {
        $this->must($this->qUpdateIn('card_stamp', [
            'values' => ['active', 'deleted_at = NOW()', 'deleted_user_id'],
            'where'  => ['sale_id', 'active'],
            'data'   => [0, $this->userId() ?: null, $saleId, 1]
        ]), $what);
    }

    /*  Los sellos que da una venta: 1 por cada $amount de lo pagado con metodos
        que dan puntos (el monedero y lo que queda a credito no cuentan), sin pasar
        del total. Los pesos que no completan un sello no se guardan. */
    protected function stampsOf(array $rows, $total, $amount, array $earning) {
        $amount = (float) $amount;

        if ($amount <= 0) return 0;

        $base = 0;

        foreach ($rows as $row) {
            if (in_array((int) $row['method_id'], $earning, true)) $base += (float) $row['amount'];
        }

        $base = min(round($base, 2), round((float) $total, 2));

        return $base > 0 ? (int) floor(($base + 0.0001) / $amount) : 0;
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

    // -- Resumen y ficha (solo lectura: Lealtad › Tarjetas) --

    // Venta viva: pendiente o pagada y no borrada.
    protected function qLiveSaleSql($alias) {
        return "{$alias}.sale_status_id IN (2, 3) AND IFNULL({$alias}.active, 1) = 1";
    }

    /*  El descuento que dio la tarjeta en una venta. ctrl-ventas lo guarda sin motivo
        (discount_reason_id null) y con la nota «Tarjeta <tipo> · <numero>», o «Premio …»
        si se canjeo un premio de sellos: uno con motivo es manual. */
    protected function qCardDiscountSql($alias) {
        return "IF({$alias}.discount_reason_id IS NULL AND ({$alias}.discount_note LIKE 'Tarjeta %' OR {$alias}.discount_note LIKE 'Premio %'), IFNULL({$alias}.discount_amount, 0), 0)";
    }

    // Los puntos vivos que dio una venta, en dinero (0 si no dio).
    protected function qSalePointsSql($alias) {
        return "(SELECT IFNULL(SUM(r.amount), 0)
                   FROM {$this->pos}receivable r
                  WHERE r.sale_id = {$alias}.id
                    AND r.kind = 'puntos'
                    AND IFNULL(r.active, 1) = 1
                    AND r.deleted_at IS NULL)";
    }

    /*  Tarjetas activas de la empresa y cuantas tienen cliente. El cliente cuenta si
        esta activo y es de la empresa: la misma regla que owner_id en cardColumns(). */
    protected function qLoyaltyCardCount($branchId) {
        return $this->qRow("
            SELECT
                COUNT(*) AS cards,
                IFNULL(SUM(cu.id IS NOT NULL AND IFNULL(cu.active, 1) = 1), 0) AS owned
            FROM {$this->crm}card c
            LEFT JOIN {$this->pos}customer cu ON cu.id = c.customer_id
                AND {$this->qSameCompany('cu.branch_id')}
            WHERE {$this->qSameCompany('c.branch_id')}
                AND IFNULL(c.active, 1) = 1
        ", [$branchId, $branchId]);
    }

    // Ventas vivas con tarjeta en la empresa entre dos fechas [from, to).
    protected function qLoyaltySales($branchId, $from, $to) {
        return $this->qRow("
            SELECT
                COUNT(*)                                        AS sales,
                IFNULL(SUM(s.total), 0)                         AS sold,
                IFNULL(SUM({$this->qCardDiscountSql('s')}), 0)  AS discount,
                IFNULL(SUM({$this->qSalePointsSql('s')}), 0)    AS points
            FROM {$this->pos}sale s
            WHERE s.card_id IS NOT NULL
                AND {$this->qSameCompany('s.branch_id')}
                AND {$this->qLiveSaleSql('s')}
                AND s.created_at >= ?
                AND s.created_at < ?
        ", [$branchId, $from, $to]);
    }

    // Saldo a favor de hoy en los monederos de los clientes activos de la empresa, y cuantos lo tienen.
    protected function qLoyaltyWallet($branchId) {
        return $this->qRow("
            SELECT
                IFNULL(SUM(IF(cu.wallet > 0, cu.wallet, 0)), 0) AS wallet,
                IFNULL(SUM(cu.wallet > 0), 0)                    AS holders
            FROM {$this->pos}customer cu
            WHERE {$this->qSameCompany('cu.branch_id')}
                AND IFNULL(cu.active, 1) = 1
        ", [$branchId]);
    }

    // Si la empresa tiene algun tipo de sellos (activo o no): el resumen solo muestra sellos si los hay.
    protected function qLoyaltyHasStamps($branchId) {
        return $this->qCount("
            SELECT COUNT(*)
            FROM {$this->crm}card_type t
            WHERE {$this->qSameCompany('t.branch_id')}
                AND IFNULL(t.stamp_goal, 0) > 0
        ", [$branchId]) > 0;
    }

    // Sellos dados y premios canjeados en la empresa entre dos fechas [from, to): solo movimientos vivos.
    protected function qLoyaltyStamps($branchId, $from, $to) {
        return $this->qRow("
            SELECT
                IFNULL(SUM(IF(cs.kind = 'sello', cs.qty, 0)), 0)     AS given,
                IFNULL(SUM(cs.kind = 'canje'), 0)                    AS rewards,
                IFNULL(SUM(IF(cs.kind = 'canje', cs.amount, 0)), 0)  AS saved
            FROM {$this->crm}card_stamp cs
            INNER JOIN {$this->crm}card c ON c.id = cs.card_id
            WHERE {$this->qSameCompany('c.branch_id')}
                AND cs.active = 1
                AND cs.deleted_at IS NULL
                AND cs.created_at >= ?
                AND cs.created_at < ?
        ", [$branchId, $from, $to]);
    }

    // Ventas vivas por tipo entre dos fechas. Cuenta por el tipo que la tarjeta tiene HOY.
    protected function qCardTypeSales($branchId, $from, $to) {
        return $this->qRows("
            SELECT
                c.card_type_id,
                COUNT(*)                                        AS sales,
                IFNULL(SUM(s.total), 0)                         AS sold,
                IFNULL(SUM({$this->qCardDiscountSql('s')}), 0)  AS discount,
                IFNULL(SUM({$this->qSalePointsSql('s')}), 0)    AS points
            FROM {$this->pos}sale s
            INNER JOIN {$this->crm}card c ON c.id = s.card_id
            WHERE {$this->qSameCompany('s.branch_id')}
                AND {$this->qLiveSaleSql('s')}
                AND s.created_at >= ?
                AND s.created_at < ?
            GROUP BY c.card_type_id
        ", [$branchId, $from, $to]);
    }

    // Totales de toda la vida de una tarjeta. Quien llama ya la valido con qCard.
    protected function qCardTotals($cardId) {
        return $this->qRow("
            SELECT
                COUNT(*)                                        AS sales,
                IFNULL(SUM(s.total), 0)                         AS sold,
                IFNULL(SUM({$this->qCardDiscountSql('s')}), 0)  AS discount,
                IFNULL(SUM({$this->qSalePointsSql('s')}), 0)    AS points,
                MAX(s.created_at)                               AS last_sale
            FROM {$this->pos}sale s
            WHERE s.card_id = ?
                AND {$this->qLiveSaleSql('s')}
        ", [$cardId]);
    }

    // Las ultimas ventas vivas de una tarjeta, la mas reciente primero.
    protected function qCardMoves($cardId, $limit) {
        $limit = max(1, (int) $limit);

        return $this->qRows("
            SELECT
                s.id,
                IFNULL(s.folio, '')             AS folio,
                s.created_at,
                IFNULL(s.total, 0)              AS total,
                {$this->qCardDiscountSql('s')}  AS discount,
                {$this->qSalePointsSql('s')}    AS points,
                (SELECT IFNULL(SUM(cs.qty), 0) FROM {$this->crm}card_stamp cs
                  WHERE cs.sale_id = s.id AND cs.kind = 'sello' AND cs.active = 1 AND cs.deleted_at IS NULL) AS stamps,
                (SELECT IFNULL(SUM(cs.amount), 0) FROM {$this->crm}card_stamp cs
                  WHERE cs.sale_id = s.id AND cs.kind = 'canje' AND cs.active = 1 AND cs.deleted_at IS NULL) AS reward,
                IFNULL(b.name, '')              AS branch
            FROM {$this->pos}sale s
            LEFT JOIN {$this->bd}branches b ON b.id = s.branch_id
            WHERE s.card_id = ?
                AND {$this->qLiveSaleSql('s')}
            ORDER BY s.created_at DESC, s.id DESC
            LIMIT {$limit}
        ", [$cardId]);
    }

    // El monedero de hoy del dueño de la tarjeta (la tarjeta no guarda saldo). 0 si no existe.
    protected function qCardWallet($customerId) {
        $row = $this->qRow("
            SELECT IFNULL(wallet, 0) AS wallet
            FROM {$this->pos}customer
            WHERE id = ?
            LIMIT 1
        ", [$customerId]);

        return $row ? round((float) $row['wallet'], 2) : 0.0;
    }

    // -- Tarjeta digital --

    // El token del enlace de una tarjeta. '' = aun no tiene. Quien llama ya la valido con qCard.
    protected function qCardLinkToken($cardId) {
        $row = $this->qRow("SELECT IFNULL(token, '') AS token FROM {$this->crm}card WHERE id = ? LIMIT 1", [$cardId]);

        return $row ? (string) $row['token'] : '';
    }

    protected function qCardTokenTaken($token) {
        return $this->qCount("SELECT COUNT(*) FROM {$this->crm}card WHERE token = ?", [$token]) > 0;
    }

    /*  Pone el token del enlace. $onlyEmpty: solo si aun no tiene (asi, si dos
        personas lo piden a la vez, gana la primera y la segunda lee el suyo).
        Devuelve true o el aviso del CRUD; el ctrl usa must(). */
    protected function qSetCardToken($cardId, $token, $onlyEmpty) {
        return $this->_CUD(
            "UPDATE {$this->crm}card SET token = ? WHERE id = ?" . ($onlyEmpty ? ' AND token IS NULL' : ''),
            [$token, $cardId]
        );
    }

    /*  La tarjeta del enlace publico, con su tipo, su dueño y la tienda donde se
        dio de alta. Null si el token no existe o la tarjeta o su tipo estan inactivos. */
    protected function qDigitalCard($token) {
        return $this->qRow("
            SELECT
                {$this->cardColumns()},
                c.branch_id,
                co.id                     AS company_id,
                IFNULL(t.color, '')       AS color,
                IFNULL(b.name, '')        AS branch,
                IFNULL(b.logo, '')        AS branch_logo,
                IFNULL(co.name, '')       AS company,
                IFNULL(co.logo, '')       AS company_logo,
                IFNULL(os.title, '')      AS title
            FROM {$this->crm}card c
            INNER JOIN {$this->crm}card_type t ON t.id = c.card_type_id AND IFNULL(t.active, 1) = 1
            LEFT JOIN {$this->pos}customer cu  ON cu.id = c.customer_id
            INNER JOIN {$this->bd}branches b   ON b.id = c.branch_id
            INNER JOIN {$this->bd}companies co ON co.id = b.company_id
            LEFT JOIN {$this->pos}online_store os ON os.branch_id = c.branch_id
            WHERE c.token = ?
                AND IFNULL(c.active, 1) = 1
            LIMIT 1
        ", [$token]);
    }
}
