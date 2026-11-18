<?php
/*  Lealtad › Programa › Niveles (plan: lealtad/docs/plan-crecimiento.html, etapa L4).

    Cada nivel es un tipo de tarjeta con level_min_spend: el gasto minimo en 12
    meses. La escalera de la empresa son sus tipos ACTIVOS con level_min_spend,
    del minimo mas bajo al mas alto. Una tarjeta esta en la escalera si su tipo
    es uno de esos; las de otros tipos (empleado, sellos…) no cambian nunca.

    Va en la misma clase que LoyaltyCards, LoyaltyProgram, LoyaltyWhatsApp y los
    traits de WhatsApp: ctrl-tarjetas (la caja «Niveles» y «Revisar niveles»),
    LoyaltyNotifier (mdl-lealtad-whatsapp.php: «sube al cobrar» desde Vender) y
    la tarea de cada hora (lealtad/ctrl/cron-lealtad.php: la revision del mes).

    Reglas que no se ven en el codigo de un vistazo:
      - Gasto de 12 meses = ventas vivas (pendientes o pagadas) con esa tarjeta,
        mas las de su cliente dueño sin ella (pedidos incluidos). total ya es neto.
      - Nivel que le toca: el mas alto cuyo minimo alcanza; si no alcanza
        ninguno, el mas bajo.
      - Sube al cobrar (Vender, loyaltyLevelUp): solo sube. Baja en la revision
        (cada mes con la tarea diaria, o con «Revisar niveles»), que tambien sube.
      - Con Niveles apagado, o con menos de 2 niveles, nada se mueve.
      - Cada cambio: card.card_type_id, una fila en card_level_log y, si el dueño
        acepto mensajes, la plantilla 'nivel' (fila 'nivel' en loyalty_notice).
      - El cambio va en UNA transaccion con la tarjeta apartada (FOR UPDATE) y
        vuelve a mirar su tipo: dos cobros a la vez no la suben dos veces.
      - Todo es protected o private: Permission::dispatch despacha cualquier
        metodo publico del ctrl, tambien los de un trait. */
trait LoyaltyLevels {

    // -- Consultas --

    // La escalera: tipos activos de la empresa con gasto minimo (no de sellos), del mas bajo al mas alto.
    protected function qLevels($branchId) {
        return $this->qRows("
            SELECT
                t.id,
                t.name,
                t.level_min_spend,
                IFNULL(t.discount_percent, 0) AS discount_percent,
                IFNULL(t.points_percent, 0)   AS points_percent,
                IFNULL(t.color, '')           AS color
            FROM {$this->pos}card_type t
            WHERE {$this->qSameCompany('t.branch_id')}
                AND IFNULL(t.active, 1) = 1
                AND t.level_min_spend IS NOT NULL
                AND IFNULL(t.stamp_goal, 0) = 0
            ORDER BY t.level_min_spend, t.id
        ", [$branchId]);
    }

    // Otro tipo de la empresa en ese mismo gasto minimo (dos niveles no pueden empatar).
    protected function qLevelTaken($branchId, $minSpend, $exceptId) {
        return $this->qRow("
            SELECT id, name
            FROM {$this->pos}card_type
            WHERE {$this->qSameCompany('branch_id')}
                AND id <> ?
                AND IFNULL(active, 1) = 1
                AND level_min_spend = ?
            LIMIT 1
        ", [$branchId, $exceptId, $minSpend]);
    }

    /*  Gasto vivo de 12 meses de la tarjeta $alias: sus ventas y las de su dueño
        sin ella. Lleva DOS ? (los dos con la fecha desde). */
    protected function qLevelSpendSql($alias) {
        return "(
                (SELECT IFNULL(SUM(s.total), 0) FROM {$this->pos}sale s
                  WHERE s.card_id = {$alias}.id AND {$this->qLiveSaleSql('s')} AND s.created_at >= ?)
              + IF({$alias}.customer_id IS NULL, 0,
                (SELECT IFNULL(SUM(s.total), 0) FROM {$this->pos}sale s
                  WHERE s.customer_id = {$alias}.customer_id
                    AND (s.card_id IS NULL OR s.card_id <> {$alias}.id)
                    AND {$this->qLiveSaleSql('s')}
                    AND s.created_at >= ?))
            )";
    }

    /*  Las tarjetas activas de la empresa que estan en la escalera, con su gasto
        de 12 meses y lo necesario para el aviso. $cardId > 0 = solo esa. */
    protected function qLevelCards($branchId, $since, $cardId = 0) {
        $one  = $cardId > 0 ? 'AND c.id = ?' : '';
        $data = [$since, $since, $branchId];

        if ($cardId > 0) $data[] = $cardId;

        return $this->qRows("
            SELECT
                c.id,
                c.number,
                IFNULL(c.holder, '')        AS holder,
                c.card_type_id,
                c.customer_id,
                IFNULL(cu.name, '')         AS customer,
                IFNULL(cu.phone, '')        AS phone,
                cu.whatsapp_optin_at,
                t.name                      AS type,
                t.level_min_spend,
                {$this->qLevelSpendSql('c')} AS spend
            FROM {$this->pos}card c
            INNER JOIN {$this->pos}card_type t ON t.id = c.card_type_id
                AND IFNULL(t.active, 1) = 1
                AND t.level_min_spend IS NOT NULL
                AND IFNULL(t.stamp_goal, 0) = 0
            LEFT JOIN {$this->pos}customer cu ON cu.id = c.customer_id AND IFNULL(cu.active, 1) = 1
            WHERE {$this->qSameCompany('c.branch_id')}
                AND IFNULL(c.active, 1) = 1
                {$one}
            ORDER BY c.id
        ", $data);
    }

    // Subidas y bajadas de la empresa desde $since.
    protected function qLevelMoves($branchId, $since) {
        return $this->qRow("
            SELECT
                IFNULL(SUM(l.direction = 'sube'), 0) AS up,
                IFNULL(SUM(l.direction = 'baja'), 0) AS down
            FROM {$this->pos}card_level_log l
            INNER JOIN {$this->pos}card c ON c.id = l.card_id
            WHERE {$this->qSameCompany('c.branch_id')}
                AND l.created_at >= ?
        ", [$branchId, $since]) ?: ['up' => 0, 'down' => 0];
    }

    // Dentro de transaction(): la tarjeta apartada con su tipo de hoy.
    protected function qLockCardType($cardId) {
        return $this->qRow("SELECT id, card_type_id FROM {$this->pos}card WHERE id = ? LIMIT 1 FOR UPDATE", [$cardId]);
    }

    protected function qMoveCardLevel($cardId, $typeId) {
        return $this->_CUD("UPDATE {$this->pos}card SET card_type_id = ?, updated_at = NOW() WHERE id = ?", [$typeId, $cardId]);
    }

    protected function qLogLevel($cardId, $fromId, $toId, $spend, $direction, $userId) {
        return $this->_CUD("
            INSERT INTO {$this->pos}card_level_log (card_id, from_type_id, to_type_id, spend, direction, user_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ", [$cardId, $fromId, $toId, round((float) $spend, 2), $direction, $userId ?: null, date('Y-m-d H:i:s')]);
    }

    // Guarda cuándo se reviso la escalera completa (la tarea diaria la corre una vez al mes).
    protected function qLevelsReviewed($companyId) {
        return $this->qSaveLoyaltySetting($companyId, ['levels_reviewed_at' => date('Y-m-d H:i:s')], $this->userId());
    }

    // -- Reglas --

    // Desde cuándo cuenta el gasto: hoy hace 12 meses.
    protected function levelSince() {
        return date('Y-m-d H:i:s', strtotime('-12 months'));
    }

    // El nivel que le toca a un gasto: el mas alto cuyo minimo alcanza; si ninguno, el mas bajo. $levels ya ordenados.
    protected function levelFor(array $levels, $spend) {
        $pick = $levels[0];

        foreach ($levels as $level) {
            if ((float) $spend + 0.005 >= (float) $level['level_min_spend']) $pick = $level;
        }

        return $pick;
    }

    // El que sigue arriba de $typeId en la escalera. null = ya es el mas alto (o no esta).
    protected function levelAbove(array $levels, $typeId) {
        foreach ($levels as $i => $level) {
            if ((int) $level['id'] === (int) $typeId) return $levels[$i + 1] ?? null;
        }

        return null;
    }

    // Su lugar en la escalera (1 = el mas bajo). 0 = no esta.
    protected function levelPlace(array $levels, $typeId) {
        foreach ($levels as $i => $level) {
            if ((int) $level['id'] === (int) $typeId) return $i + 1;
        }

        return 0;
    }

    // Lo que da un nivel, dicho para el cliente: «10 % de descuento en cada compra».
    protected function levelPerk(array $level) {
        $pct = fn ($v) => rtrim(rtrim(number_format((float) $v, 2, '.', ''), '0'), '.') . ' %';

        if ((float) $level['discount_percent'] > 0) return $pct($level['discount_percent']) . ' de descuento en cada compra';
        if ((float) $level['points_percent'] > 0)   return 'el ' . $pct($level['points_percent']) . ' de lo que pagas de regreso en tu monedero';

        return '';
    }

    // -- Cambios --

    /*  Despues de un cobro en Vender: si la tarjeta ya alcanza un nivel mas alto,
        sube. Solo sube. null = no cambio (o Niveles apagado). */
    protected function loyaltyLevelUp($cardId) {
        $setting = $this->qLoyaltySetting((int) $this->companyId());

        if ((int) $setting['levels_enabled'] !== 1) return null;

        $levels = $this->qLevels((int) $this->branchId());

        if (count($levels) < 2) return null;

        $row = $this->qLevelCards((int) $this->branchId(), $this->levelSince(), $cardId)[0] ?? null;

        if (!$row) return null;

        $target = $this->levelFor($levels, $row['spend']);

        if ((float) $target['level_min_spend'] <= (float) $row['level_min_spend']) return null;

        return $this->levelChange($row, $target, $levels);
    }

    /*  La revision: cada tarjeta de la escalera con el nivel que le toca hoy.
        Devuelve solo las que cambian, con direction 'sube' | 'baja'. */
    protected function loyaltyLevelPlan() {
        $levels = $this->qLevels((int) $this->branchId());
        $plan   = [];

        if (count($levels) < 2) return [];

        foreach ($this->qLevelCards((int) $this->branchId(), $this->levelSince()) as $row) {
            $target = $this->levelFor($levels, $row['spend']);

            if ((int) $target['id'] === (int) $row['card_type_id']) continue;

            $plan[] = ['row' => $row, 'target' => $target, 'direction' => (float) $target['level_min_spend'] > (float) $row['level_min_spend'] ? 'sube' : 'baja'];
        }

        return $plan;
    }

    /*  Aplica la revision, hasta $limit cambios por vuelta (cada aviso tarda).
        Devuelve up, down, told (avisados), left (los que faltan). Al terminar
        sin pendientes, guarda levels_reviewed_at. */
    protected function loyaltyLevelReview($limit) {
        $levels = $this->qLevels((int) $this->branchId());
        $plan   = $this->loyaltyLevelPlan();
        $count  = ['up' => 0, 'down' => 0, 'told' => 0, 'left' => 0];

        foreach ($plan as $i => $change) {
            if ($i >= $limit) {
                $count['left'] = count($plan) - $limit;
                break;
            }

            $done = $this->levelChange($change['row'], $change['target'], $levels);

            if (!$done) continue;

            $count[$done['direction'] === 'sube' ? 'up' : 'down']++;

            if ($done['whatsapp'] && in_array($done['whatsapp']['status'], ['sent', 'simulated'], true)) $count['told']++;
        }

        if ($count['left'] === 0) $this->qLevelsReviewed((int) $this->companyId());

        return $count;
    }

    /*  Mueve una tarjeta a $target: el cambio, su bitacora y la fila del aviso en
        una transaccion; despues, el WhatsApp. null si otro ya la movio. */
    private function levelChange(array $row, array $target, array $levels) {
        $cardId    = (int) $row['id'];
        $fromId    = (int) $row['card_type_id'];
        $toId      = (int) $target['id'];
        $up        = (float) $target['level_min_spend'] > (float) $row['level_min_spend'];
        $direction = $up ? 'sube' : 'baja';
        $phone     = $this->loyaltyPhone($row['phone']);
        $tell      = $row['customer_id'] !== null && $row['whatsapp_optin_at'] !== null && $phone !== '';
        $change    = $this->levelChangeText($row, $target, $levels, $up);

        $noticeId = $this->transaction(function () use ($cardId, $fromId, $toId, $row, $direction, $tell, $phone, $change) {
            $card = $this->qLockCardType($cardId);

            if (!$card || (int) $card['card_type_id'] !== $fromId) return -1;

            $this->must($this->qMoveCardLevel($cardId, $toId), 'nivel tarjeta');
            $this->must($this->qLogLevel($cardId, $fromId, $toId, $row['spend'], $direction, $this->userId()), 'nivel bitacora');

            return $tell ? (int) $this->qClaimNotice((int) $this->companyId(), (int) $this->branchId(), (int) $row['customer_id'], $cardId, $phone, 'nivel', $change, $this->userId()) : 0;
        });

        $noticeId = (int) $noticeId;

        if ($noticeId < 0) return null;

        // color y perk: para la tarjeta chica de «Venta cobrada» en Vender.
        $out = ['from' => (string) $row['type'], 'to' => (string) $target['name'], 'direction' => $direction, 'whatsapp' => null,
                'color' => (string) ($target['color'] ?? ''), 'perk' => $this->levelPerk($target)];

        if ($noticeId === 0) return $out;

        try {
            $card = $this->qCard($cardId, $this->branchId());

            $out['whatsapp'] = $card ? $this->loyaltySendLevel($card, $phone, $target['name'], $change, $noticeId) : ['status' => 'skip', 'detail' => ''];
        } catch (Throwable $e) {
            $this->qFinishNotice($noticeId, 'failed', 'No salió: ' . $e->getMessage());

            $out['whatsapp'] = ['status' => 'failed', 'detail' => 'No se pudo mandar.'];
        }

        return $out;
    }

    // El {{4}} de la plantilla: lo nuevo que da al subir, o cuánto le falta para volver al bajar.
    private function levelChangeText(array $row, array $target, array $levels, $up) {
        if ($up) {
            $perk = $this->levelPerk($target);

            return $perk !== '' ? "¡Felicidades! Ahora tienes {$perk}." : '¡Felicidades por subir de nivel!';
        }

        $missing = max(0, (float) $row['level_min_spend'] - (float) $row['spend']);

        return 'Con $' . number_format($missing, 2) . ' más de compras vuelves a ' . $row['type'] . '.';
    }
}
