<?php
/*  Lealtad › Programa › Cumpleaños (plan: lealtad/docs/plan-crecimiento.html, etapa L2).

    El dia de su cumpleaños, el cliente con tarjeta recibe un WhatsApp de
    felicitacion (plantilla 'cumple') y un regalo que cae solo:
      - tarjeta de sellos: birthday_stamps sellos (card_stamp kind 'regalo');
      - tarjeta de puntos: birthday_points pesos al monedero (customer.wallet y
        una fila receivable 'puntos' sin venta, para saber de donde salio);
      - tarjeta de descuento, o regalo en 0: solo la felicitacion.

    Va en la misma clase que LoyaltyCards, LoyaltyProgram, LoyaltyWhatsApp y los
    traits de WhatsApp. Lo usan lealtad/ctrl/ctrl-tarjetas.php («Felicitar a
    los de hoy») y la tarea de cada hora (lealtad/ctrl/cron-lealtad.php).

    Reglas que no se ven en el codigo de un vistazo:
      - Le toca a: cliente activo de la empresa, con cumpleaños, con una tarjeta
        que se pueda usar (la mas reciente: activa y con su tipo activo), que
        acepto mensajes (whatsapp_optin_at), con WhatsApp de 10 digitos y que no
        escribio BAJA. Sin permiso de mensajes no hay regalo: van juntos.
      - Una vez al año: cualquier fila 'cumple' de loyalty_notice de este año
        cuenta, haya salido o no el mensaje (el regalo ya se dio).
      - 29 de febrero: en años no bisiestos se felicita el 28.
      - El regalo y la fila 'pending' van en UNA transaccion, con el cliente
        apartado (FOR UPDATE): dos corridas a la vez no regalan dos veces. El
        WhatsApp va despues; si falla, el regalo se queda y la fila dice como
        salio ('failed' o 'skip').
      - Las fechas son las de PHP (hora de Mexico), como created_at.
      - Todo es protected o private: Permission::dispatch despacha cualquier
        metodo publico del ctrl, tambien los de un trait. */
trait LoyaltyBirthday {

    // -- Consultas --

    /*  Clientes activos de la empresa con cumpleaños y una tarjeta que se pueda
        usar (la mas reciente), con su ultima felicitacion desde $yearStart y si
        escribieron BAJA en el WhatsApp de la empresa. */
    protected function qBirthdayRows($branchId, $companyId, $yearStart) {
        $phone = "RIGHT(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(IFNULL(cu.phone, ''), ' ', ''), '-', ''), '(', ''), ')', ''), '+', ''), 10)";

        return $this->qRows("
            SELECT
                cu.id                          AS customer_id,
                IFNULL(cu.name, '')            AS name,
                IFNULL(cu.phone, '')           AS phone,
                cu.birthday,
                cu.whatsapp_optin_at,
                c.id                           AS card_id,
                c.number,
                IFNULL(t.name, '')             AS type,
                IFNULL(t.discount_percent, 0)  AS discount_percent,
                IFNULL(t.points_percent, 0)    AS points_percent,
                IFNULL(t.stamp_goal, 0)        AS stamp_goal,
                (
                    SELECT n.created_at
                    FROM {$this->crm}loyalty_notice n
                    WHERE n.customer_id = cu.id AND n.kind = 'cumple' AND n.created_at >= ?
                    ORDER BY n.id DESC
                    LIMIT 1
                ) AS greeted_at,
                (
                    SELECT n.status
                    FROM {$this->crm}loyalty_notice n
                    WHERE n.customer_id = cu.id AND n.kind = 'cumple' AND n.created_at >= ?
                    ORDER BY n.id DESC
                    LIMIT 1
                ) AS greeted_status,
                IFNULL((
                    SELECT wc.opt_out
                    FROM {$this->crm}wa_chat wc
                    WHERE wc.company_id = ? AND wc.phone = {$phone}
                    LIMIT 1
                ), 0) AS opt_out
            FROM {$this->pos}customer cu
            INNER JOIN {$this->crm}card c ON c.id = (
                SELECT c2.id
                FROM {$this->crm}card c2
                INNER JOIN {$this->crm}card_type t2 ON t2.id = c2.card_type_id AND IFNULL(t2.active, 1) = 1
                WHERE c2.customer_id = cu.id
                    AND IFNULL(c2.active, 1) = 1
                    AND {$this->qSameCompany('c2.branch_id')}
                ORDER BY c2.id DESC
                LIMIT 1
            )
            INNER JOIN {$this->crm}card_type t ON t.id = c.card_type_id
            WHERE {$this->qSameCompany('cu.branch_id')}
                AND IFNULL(cu.active, 1) = 1
                AND cu.birthday IS NOT NULL
        ", [$yearStart, $yearStart, $companyId, $branchId, $branchId]);
    }

    // Si ya tiene una felicitacion desde $yearStart (salga o no el mensaje).
    protected function qBirthdayGreeted($customerId, $yearStart) {
        return $this->qCount("
            SELECT COUNT(*)
            FROM {$this->crm}loyalty_notice
            WHERE customer_id = ? AND kind = 'cumple' AND created_at >= ?
        ", [$customerId, $yearStart]) > 0;
    }

    // Felicitaciones de la empresa desde $since (las que apartaron regalo).
    protected function qBirthdayCount($companyId, $since) {
        return $this->qCount("
            SELECT COUNT(*)
            FROM {$this->crm}loyalty_notice
            WHERE company_id = ? AND kind = 'cumple' AND created_at >= ?
        ", [$companyId, $since]);
    }

    // El regalo en dinero al monedero (la fila receivable 'puntos' la deja savePoints).
    protected function qGiftWallet($customerId, $amount) {
        return $this->_CUD("UPDATE {$this->pos}customer SET wallet = IFNULL(wallet, 0) + ?, updated_at = NOW() WHERE id = ?", [round((float) $amount, 2), $customerId]);
    }

    // Para la ficha: cumpleaños, permiso de mensajes y la felicitacion de este año.
    protected function qCustomerBirthday($customerId, $yearStart) {
        return $this->qRow("
            SELECT
                cu.birthday,
                cu.whatsapp_optin_at,
                (
                    SELECT CONCAT(n.created_at, '|', n.status)
                    FROM {$this->crm}loyalty_notice n
                    WHERE n.customer_id = cu.id AND n.kind = 'cumple' AND n.created_at >= ?
                    ORDER BY n.id DESC
                    LIMIT 1
                ) AS greeted
            FROM {$this->pos}customer cu
            WHERE cu.id = ?
            LIMIT 1
        ", [$yearStart, $customerId]);
    }

    // El cumpleaños que se captura en la ficha. NULL lo borra. Año 2000 (bisiesto): el año no se pide.
    protected function qSetBirthday($customerId, $birthday) {
        return $this->_CUD("UPDATE {$this->pos}customer SET birthday = ?, updated_at = NOW() WHERE id = ?", [$birthday, $customerId]);
    }

    // -- Fechas --

    // El dia que se felicita en $year ('Y-m-d'). 29/02 en año no bisiesto → 28/02.
    protected function birthdayIn($birthday, $year) {
        $md = substr((string) $birthday, 5, 5);

        if ($md === '02-29' && !checkdate(2, 29, (int) $year)) $md = '02-28';

        return $year . '-' . $md;
    }

    // «14 de febrero».
    protected function birthdayText($birthday) {
        $months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
        $month  = (int) substr((string) $birthday, 5, 2);
        $day    = (int) substr((string) $birthday, 8, 2);

        return $month >= 1 && $month <= 12 && $day >= 1 ? $day . ' de ' . $months[$month - 1] : '';
    }

    // -- Regalo --

    /*  Lo que le toca segun su tarjeta y los ajustes: kind stamps | points | none,
        qty o amount, label (para la lista) y text (el {{3}} de la plantilla). */
    protected function birthdayGift(array $row, $stamps, $points) {
        $stamps = (int) $stamps;
        $points = round((float) $points, 2);

        if ((int) $row['stamp_goal'] > 0 && $stamps > 0) {
            $word = $stamps === 1 ? 'sello' : 'sellos';

            return ['kind' => 'stamps', 'qty' => $stamps, 'amount' => 0, 'label' => "{$stamps} {$word}", 'text' => "te regalamos {$stamps} {$word} en tu tarjeta"];
        }

        if ((int) $row['stamp_goal'] <= 0 && (float) $row['points_percent'] > 0 && $points > 0) {
            $money = '$' . number_format($points, 2);

            return ['kind' => 'points', 'qty' => 0, 'amount' => $points, 'label' => "{$money} al monedero", 'text' => "te regalamos {$money} en tu monedero"];
        }

        $discount = (float) $row['discount_percent'];
        $pct      = rtrim(rtrim(number_format($discount, 2, '.', ''), '0'), '.') . ' %';

        return [
            'kind'   => 'none',
            'qty'    => 0,
            'amount' => 0,
            'label'  => 'Solo felicitación',
            'text'   => (int) $row['stamp_goal'] <= 0 && $discount > 0 ? "te esperamos con tu {$pct} de descuento" : 'te esperamos con tu tarjeta'
        ];
    }

    // -- Lista --

    /*  Los cumpleaños de $back dias atras a $ahead dias adelante (hoy cuenta),
        el mas cercano primero. Cada uno con su regalo y su estado:
          due      le toca hoy y se le puede mandar
          done     ya se le felicito este año (greeted_status dice como salio)
          missed   ya paso y no se le felicito
          nooptin  no acepto mensajes · baja  escribio BAJA · nophone  sin WhatsApp valido
          soon     falta (en)
        $today 'Y-m-d'; $setting: los de qLoyaltySetting. */
    protected function loyaltyBirthdays($today, $back, $ahead, array $setting) {
        $year    = (int) substr($today, 0, 4);
        $todayTs = strtotime($today);
        $list    = [];

        foreach ($this->qBirthdayRows((int) $this->branchId(), (int) $this->companyId(), $year . '-01-01 00:00:00') as $r) {
            $date = $this->birthdayIn($r['birthday'], $year);
            $in   = (int) round((strtotime($date) - $todayTs) / 86400);

            // Ya paso hace mas de $back dias: cuenta el del año que viene.
            if ($in < -$back) {
                $date = $this->birthdayIn($r['birthday'], $year + 1);
                $in   = (int) round((strtotime($date) - $todayTs) / 86400);
            }

            if ($in < -$back || $in > $ahead) continue;

            $phone   = $this->loyaltyPhone($r['phone']);
            $greeted = $r['greeted_at'] !== null && (int) substr($date, 0, 4) === $year;
            $state   = 'soon';

            if ($greeted)                          $state = 'done';
            elseif ($in < 0)                       $state = 'missed';
            elseif ($r['whatsapp_optin_at'] === null) $state = 'nooptin';
            elseif ((int) $r['opt_out'] === 1)     $state = 'baja';
            elseif ($phone === '')                 $state = 'nophone';
            elseif ($in === 0)                     $state = 'due';

            $list[] = [
                'customer_id' => (int) $r['customer_id'],
                'card_id'     => (int) $r['card_id'],
                'name'        => trim((string) $r['name']),
                'phone'       => $phone,
                'number'      => (string) $r['number'],
                'type'        => (string) $r['type'],
                'date'        => $date,
                'in'          => $in,
                'birthday'    => $this->birthdayText($r['birthday']),
                'gift'        => $this->birthdayGift($r, $setting['birthday_stamps'], $setting['birthday_points']),
                'state'       => $state,
                'greeted_at'  => $greeted ? (string) $r['greeted_at'] : '',
                'greeted'     => $greeted ? (string) $r['greeted_status'] : ''
            ];
        }

        usort($list, fn ($a, $b) => [$a['in'], $a['name']] <=> [$b['in'], $b['name']]);

        return $list;
    }

    // -- Felicitar --

    /*  Felicita a los que les toca hoy, hasta $limit. Devuelve cuantos:
        sent, simulated, failed, skip y done (otro ya los felicito). */
    protected function loyaltyBirthdayRun($today, array $setting, $limit) {
        $count = ['sent' => 0, 'simulated' => 0, 'failed' => 0, 'skip' => 0, 'done' => 0];
        $made  = 0;

        foreach ($this->loyaltyBirthdays($today, 0, 0, $setting) as $row) {
            if ($row['state'] !== 'due') continue;
            if ($made >= $limit) break;

            $status = $this->loyaltyBirthdayGreet($row, $today);

            $count[isset($count[$status]) ? $status : 'failed']++;
            $made++;
        }

        return $count;
    }

    // Uno: el regalo y su fila apartada en una transaccion; despues, el WhatsApp.
    private function loyaltyBirthdayGreet(array $row, $today) {
        $customerId = $row['customer_id'];
        $cardId     = $row['card_id'];
        $gift       = $row['gift'];
        $year       = substr($today, 0, 4);

        $noticeId = $this->transaction(function () use ($customerId, $cardId, $gift, $year, $row) {
            $this->qLockCustomer($customerId);

            if ($this->qBirthdayGreeted($customerId, $year . '-01-01 00:00:00')) return 0;

            $id = $this->qClaimNotice((int) $this->companyId(), (int) $this->branchId(), $customerId, $cardId, $row['phone'], 'cumple', $gift['text'], $this->userId());

            if ($gift['kind'] === 'stamps') {
                $this->must($this->qCreateStamp([
                    'values' => ['card_id', 'sale_id', 'kind', 'qty', 'amount', 'branch_id', 'user_id', 'created_at'],
                    'data'   => [$cardId, null, 'regalo', $gift['qty'], 0, $this->branchId(), $this->userId() ?: null, date('Y-m-d H:i:s')]
                ]), 'cumple sellos');
            }

            if ($gift['kind'] === 'points') {
                $this->must($this->qGiftWallet($customerId, $gift['amount']), 'cumple monedero');
                $this->savePoints(null, $customerId, null, $gift['amount'], 'Regalo de cumpleaños ' . $year);
            }

            return $id;
        });

        if ($noticeId <= 0) return 'done';

        try {
            $card = $this->qCard($cardId, $this->branchId());

            if (!$card) {
                $this->qFinishNotice($noticeId, 'skip', 'La tarjeta ya no existe.');

                return 'skip';
            }

            return $this->loyaltySendBirthday($card, $row['phone'], $gift['text'], $noticeId)['status'];
        } catch (Throwable $e) {
            $this->qFinishNotice($noticeId, 'failed', 'No salió: ' . $e->getMessage());

            return 'failed';
        }
    }
}
