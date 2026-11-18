<?php
/*  Lealtad › Programa › Te extrañamos (plan: lealtad/docs/plan-crecimiento.html, etapa L3).

    A quien lleva winback_days dias sin comprar le llega un WhatsApp (plantilla
    'regreso') con su motivo para volver: los sellos que lleva, su monedero o el
    descuento de su tarjeta.

    Va en la misma clase que LoyaltyCards, LoyaltyProgram, LoyaltyWhatsApp y los
    traits de WhatsApp. Lo usan lealtad/ctrl/ctrl-tarjetas.php («Mandar los de
    hoy») y la tarea de cada hora (lealtad/ctrl/cron-lealtad.php).

    Reglas que no se ven en el codigo de un vistazo:
      - Le toca a: cliente activo de la empresa con una tarjeta que se pueda usar
        (la mas reciente), que acepto mensajes, con WhatsApp de 10 digitos, que
        no escribio BAJA y que no recibio otro «te extrañamos» en los ultimos
        winback_days dias.
      - «Sin comprar» = su ultima venta o pedido vivo en la empresa (con o sin
        tarjeta). Si nunca ha comprado, cuenta desde el alta de su tarjeta.
      - Tope diario: winback_daily_cap mensajes por empresa (se cuentan las filas
        'regreso' de hoy, salgan o no). Primero van los que dejaron de venir hace
        menos: son los que mas vuelven.
      - El mensaje se aparta (fila 'pending') en una transaccion con el cliente
        apartado: dos corridas a la vez no le escriben dos veces.
      - «Volvieron»: de los mensajes que salieron este mes, cuantos clientes
        compraron despues.
      - Las fechas son las de PHP (hora de Mexico), como created_at.
      - Todo es protected o private: Permission::dispatch despacha cualquier
        metodo publico del ctrl, tambien los de un trait. */
trait LoyaltyWinback {

    // -- Consultas --

    /*  Clientes activos de la empresa con una tarjeta que se pueda usar (la mas
        reciente), su ultima compra viva, sus sellos, su ultimo «te extrañamos» y
        si escribieron BAJA. */
    protected function qWinbackRows($branchId, $companyId) {
        $phone = "RIGHT(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(IFNULL(cu.phone, ''), ' ', ''), '-', ''), '(', ''), ')', ''), '+', ''), 10)";

        return $this->qRows("
            SELECT
                cu.id                          AS customer_id,
                IFNULL(cu.name, '')            AS name,
                IFNULL(cu.phone, '')           AS phone,
                cu.whatsapp_optin_at,
                IFNULL(cu.wallet, 0)           AS wallet,
                c.id                           AS card_id,
                c.number,
                c.created_at                   AS card_at,
                IFNULL(t.name, '')             AS type,
                IFNULL(t.discount_percent, 0)  AS discount_percent,
                IFNULL(t.points_percent, 0)    AS points_percent,
                IFNULL(t.stamp_goal, 0)        AS stamp_goal,
                IFNULL(t.stamp_amount, 0)      AS stamp_amount,
                IFNULL(t.reward_name, '')      AS reward_name,
                GREATEST(
                    IFNULL((SELECT MAX(s.created_at) FROM {$this->pos}sale s WHERE s.customer_id = cu.id AND {$this->qLiveSaleSql('s')}), '1000-01-01'),
                    IFNULL((SELECT MAX(s.created_at) FROM {$this->pos}sale s WHERE s.card_id = c.id AND {$this->qLiveSaleSql('s')}), '1000-01-01')
                ) AS last_sale,
                (
                    SELECT IFNULL(SUM(cs.qty), 0)
                    FROM {$this->pos}card_stamp cs
                    WHERE cs.card_id = c.id AND cs.active = 1 AND cs.deleted_at IS NULL
                ) AS stamps,
                (
                    SELECT MAX(n.created_at)
                    FROM {$this->pos}loyalty_notice n
                    WHERE n.customer_id = cu.id AND n.kind = 'regreso'
                ) AS last_notice,
                IFNULL((
                    SELECT wc.opt_out
                    FROM {$this->pos}wa_chat wc
                    WHERE wc.company_id = ? AND wc.phone = {$phone}
                    LIMIT 1
                ), 0) AS opt_out
            FROM {$this->pos}customer cu
            INNER JOIN {$this->pos}card c ON c.id = (
                SELECT c2.id
                FROM {$this->pos}card c2
                INNER JOIN {$this->pos}card_type t2 ON t2.id = c2.card_type_id AND IFNULL(t2.active, 1) = 1
                WHERE c2.customer_id = cu.id
                    AND IFNULL(c2.active, 1) = 1
                    AND {$this->qSameCompany('c2.branch_id')}
                ORDER BY c2.id DESC
                LIMIT 1
            )
            INNER JOIN {$this->pos}card_type t ON t.id = c.card_type_id
            WHERE {$this->qSameCompany('cu.branch_id')}
                AND IFNULL(cu.active, 1) = 1
        ", [$companyId, $branchId, $branchId]);
    }

    // Si ya recibio un «te extrañamos» desde $since (salga o no).
    protected function qWinbackSentSince($customerId, $since) {
        return $this->qCount("
            SELECT COUNT(*)
            FROM {$this->pos}loyalty_notice
            WHERE customer_id = ? AND kind = 'regreso' AND created_at >= ?
        ", [$customerId, $since]) > 0;
    }

    // Filas 'regreso' de la empresa desde $since (el tope del dia cuenta todas).
    protected function qWinbackCount($companyId, $since) {
        return $this->qCount("
            SELECT COUNT(*)
            FROM {$this->pos}loyalty_notice
            WHERE company_id = ? AND kind = 'regreso' AND created_at >= ?
        ", [$companyId, $since]);
    }

    // Los que salieron desde $since y cuántos de esos clientes compraron después.
    protected function qWinbackBack($companyId, $since) {
        return $this->qRow("
            SELECT
                COUNT(*) AS sent,
                IFNULL(SUM(EXISTS (
                    SELECT 1
                    FROM {$this->pos}sale s
                    WHERE s.customer_id = n.customer_id
                        AND {$this->qLiveSaleSql('s')}
                        AND s.created_at > n.created_at
                )), 0) AS back
            FROM {$this->pos}loyalty_notice n
            WHERE n.company_id = ?
                AND n.kind = 'regreso'
                AND n.status IN ('sent', 'simulated')
                AND n.created_at >= ?
        ", [$companyId, $since]) ?: ['sent' => 0, 'back' => 0];
    }

    // -- Motivo --

    // Su motivo para volver, una oracion (el {{3}} de la plantilla): sellos, monedero o descuento.
    protected function winbackReason(array $r) {
        $goal = (int) $r['stamp_goal'];
        $pct  = fn ($v) => rtrim(rtrim(number_format((float) $v, 2, '.', ''), '0'), '.') . ' %';

        if ($goal > 0) {
            $have   = max((int) $r['stamps'], 0);
            $reward = trim((string) $r['reward_name']);

            if ($have >= $goal) return "Tu premio {$reward} ya está listo: pídelo en caja.";
            if ($have > 0)      return "Llevas {$have} de {$goal} sellos para tu {$reward}.";

            return 'Con cada $' . number_format((float) $r['stamp_amount'], (float) $r['stamp_amount'] == floor((float) $r['stamp_amount']) ? 0 : 2) . " que pagas juntas un sello para tu {$reward}.";
        }

        if ((float) $r['points_percent'] > 0) {
            if ((float) $r['wallet'] > 0.005) return 'Tienes $' . number_format((float) $r['wallet'], 2) . ' en tu monedero para tu próxima compra.';

            return 'Con tu tarjeta, el ' . $pct($r['points_percent']) . ' de lo que pagas regresa a tu monedero.';
        }

        if ((float) $r['discount_percent'] > 0) return 'Con tu tarjeta tienes ' . $pct($r['discount_percent']) . ' de descuento en cada compra.';

        return 'Te esperamos con tu tarjeta.';
    }

    // -- Lista --

    /*  Los que llevan $days dias o mas sin comprar, cada uno con su motivo y su estado:
          due      le toca
          sent     ya se le escribio en los ultimos $days dias (sent_at)
          nooptin  no acepto mensajes · baja  escribio BAJA · nophone  sin WhatsApp valido
        El que dejo de venir hace menos, primero. $now: marca de tiempo de PHP. */
    protected function loyaltyWinbacks($days, $now) {
        $days  = max(1, (int) $days);
        $since = date('Y-m-d H:i:s', $now - $days * 86400);
        $list  = [];

        foreach ($this->qWinbackRows((int) $this->branchId(), (int) $this->companyId()) as $r) {
            $bought = (string) $r['last_sale'] > '1000-01-01 23:59:59';
            $ref    = $bought ? (string) $r['last_sale'] : (string) $r['card_at'];
            $away   = (int) floor(($now - strtotime($ref)) / 86400);

            if ($away < $days) continue;

            $phone = $this->loyaltyPhone($r['phone']);
            $state = 'due';

            if ($r['last_notice'] !== null && (string) $r['last_notice'] >= $since) $state = 'sent';
            elseif ($r['whatsapp_optin_at'] === null)                                 $state = 'nooptin';
            elseif ((int) $r['opt_out'] === 1)                                        $state = 'baja';
            elseif ($phone === '')                                                    $state = 'nophone';

            $list[] = [
                'customer_id' => (int) $r['customer_id'],
                'card_id'     => (int) $r['card_id'],
                'name'        => trim((string) $r['name']),
                'phone'       => $phone,
                'number'      => (string) $r['number'],
                'type'        => (string) $r['type'],
                'bought'      => $bought,
                'ref'         => $ref,
                'away'        => $away,
                'reason'      => $this->winbackReason($r),
                'state'       => $state,
                'sent_at'     => $state === 'sent' ? (string) $r['last_notice'] : ''
            ];
        }

        usort($list, fn ($a, $b) => [$a['away'], $a['name']] <=> [$b['away'], $b['name']]);

        return $list;
    }

    // -- Mandar --

    /*  «Te extrañamos» a los que les toca, hasta $limit y sin pasar del tope del
        dia. Devuelve sent, simulated, failed, skip, done (otro ya les escribio) y
        cap (los que se quedaron por el tope). */
    protected function loyaltyWinbackRun(array $setting, $limit, $now) {
        $count = ['sent' => 0, 'simulated' => 0, 'failed' => 0, 'skip' => 0, 'done' => 0, 'cap' => 0];
        $days  = max(1, (int) $setting['winback_days']);
        $room  = max(0, (int) $setting['winback_daily_cap'] - $this->qWinbackCount((int) $this->companyId(), date('Y-m-d 00:00:00', $now)));
        $made  = 0;

        foreach ($this->loyaltyWinbacks($days, $now) as $row) {
            if ($row['state'] !== 'due') continue;

            if ($made >= min($limit, $room)) {
                $count['cap']++;
                continue;
            }

            $status = $this->loyaltyWinbackSend($row, $days, $now);

            $count[isset($count[$status]) ? $status : 'failed']++;
            $made++;
        }

        return $count;
    }

    // Uno: aparta la fila con el cliente apartado y despues manda el WhatsApp.
    private function loyaltyWinbackSend(array $row, $days, $now) {
        $customerId = $row['customer_id'];
        $since      = date('Y-m-d H:i:s', $now - $days * 86400);

        $noticeId = (int) $this->transaction(function () use ($row, $customerId, $since) {
            $this->qLockCustomer($customerId);

            if ($this->qWinbackSentSince($customerId, $since)) return 0;

            return (int) $this->qClaimNotice((int) $this->companyId(), (int) $this->branchId(), $customerId, $row['card_id'], $row['phone'], 'regreso', $row['reason'], $this->userId());
        });

        if ($noticeId <= 0) return 'done';

        try {
            $card = $this->qCard($row['card_id'], $this->branchId());

            if (!$card) {
                $this->qFinishNotice($noticeId, 'skip', 'La tarjeta ya no existe.');

                return 'skip';
            }

            return $this->loyaltySendWinback($card, $row['phone'], $row['reason'], $noticeId)['status'];
        } catch (Throwable $e) {
            $this->qFinishNotice($noticeId, 'failed', 'No salió: ' . $e->getMessage());

            return 'failed';
        }
    }
}
