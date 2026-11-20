<?php
/*  Lealtad › Programa: ajustes por empresa, registro solo del cliente y la
    bitacora de mensajes de lealtad (plan: lealtad/docs/plan-crecimiento.html).

    Va con LoyaltyCards (mdl-lealtad.php) sobre la clase mdl. Lo usan
    lealtad/ctrl/ctrl-tarjetas.php (los ajustes y el enlace) y
    lealtad/registro.php (la pagina publica, SIN sesion).

    Reglas que no se ven en el codigo de un vistazo:
      - loyalty_setting es UNA fila por empresa; si no existe, valen los
        valores de fabrica (todo apagado). Se guarda con INSERT … ON DUPLICATE.
      - El enlace de registro es por SUCURSAL (loyalty_signup): la tarjeta se da
        de alta en la sucursal del QR y su chat de WhatsApp queda en ella.
      - El registro no ensena la tarjeta de un telefono que ya era cliente: se
        la manda a su WhatsApp. Solo un cliente nuevo ve su tarjeta en pantalla.
      - Todo es protected o private: Permission::dispatch despacha cualquier
        metodo publico del ctrl, tambien los de un trait. */
trait LoyaltyProgram {

    // -- Ajustes --

    // Los ajustes de la empresa; sin fila, los de fabrica (todo apagado).
    protected function qLoyaltySetting($companyId) {
        $row  = $this->qRow("SELECT * FROM {$this->crm}loyalty_setting WHERE company_id = ? LIMIT 1", [$companyId]);
        $base = [
            'signup_enabled'     => 0,
            'signup_type_id'     => null,
            'winback_enabled'    => 0,
            'winback_days'       => 30,
            'winback_daily_cap'  => 50,
            'birthday_enabled'   => 0,
            'birthday_stamps'    => 0,
            'birthday_points'    => 0,
            'levels_enabled'     => 0,
            'levels_reviewed_at' => null
        ];

        foreach ($base as $key => $value) {
            if ($row && array_key_exists($key, $row)) $base[$key] = $row[$key];
        }

        return ['company_id' => (int) $companyId] + $base;
    }

    // Las empresas con algo encendido en Lealtad › Programa (la tarea de cada hora).
    protected function qLoyaltyCompaniesOn() {
        return $this->qRows("
            SELECT company_id
            FROM {$this->crm}loyalty_setting
            WHERE birthday_enabled = 1 OR winback_enabled = 1 OR levels_enabled = 1
            ORDER BY company_id
        ");
    }

    /*  Guarda solo las columnas que llegan ($values: columna => valor; las pone
        el ctrl de una lista fija). Devuelve true o el aviso del CRUD. */
    protected function qSaveLoyaltySetting($companyId, array $values, $userId) {
        $cols  = array_keys($values);
        $marks = implode(', ', array_fill(0, count($cols), '?'));
        $set   = implode(', ', array_map(fn ($c) => "{$c} = VALUES({$c})", $cols));

        return $this->_CUD("
            INSERT INTO {$this->crm}loyalty_setting (company_id, " . implode(', ', $cols) . ", updated_user_id, created_at, updated_at)
            VALUES (?, {$marks}, ?, NOW(), NOW())
            ON DUPLICATE KEY UPDATE {$set}, updated_user_id = VALUES(updated_user_id), updated_at = NOW()
        ", array_merge([$companyId], array_values($values), [$userId ?: null]));
    }

    // -- Enlace de registro --

    protected function qSignupLink($branchId) {
        return $this->qRow("SELECT id, branch_id, token, created_at FROM {$this->crm}loyalty_signup WHERE branch_id = ? LIMIT 1", [$branchId]);
    }

    protected function qSignupTokenTaken($token) {
        return $this->qCount("SELECT COUNT(*) FROM {$this->crm}loyalty_signup WHERE token = ?", [$token]) > 0;
    }

    // La primera vez de la sucursal. Si dos lo piden a la vez, gana el primero.
    protected function qCreateSignupLink($branchId, $token) {
        return $this->_CUD("
            INSERT INTO {$this->crm}loyalty_signup (branch_id, token, created_at) VALUES (?, ?, NOW())
            ON DUPLICATE KEY UPDATE id = id
        ", [$branchId, $token]);
    }

    // Token nuevo: el QR impreso antes deja de servir.
    protected function qRenewSignupLink($branchId, $token) {
        return $this->_CUD("UPDATE {$this->crm}loyalty_signup SET token = ?, created_at = NOW() WHERE branch_id = ?", [$token, $branchId]);
    }

    // 32 caracteres hex que no use otro enlace de registro.
    protected function loyaltySignupToken() {
        for ($i = 0; $i < 5; $i++) {
            $token = bin2hex(random_bytes(16));

            if (!$this->qSignupTokenTaken($token)) return $token;
        }

        throw new RuntimeException('loyaltySignupToken: sin token libre');
    }

    /*  Lo que dejo el registro en la empresa entre $from y $to: tarjetas nuevas
        (nueva) y numeros que ya eran clientes (reenviada). */
    protected function qSignupStats($companyId, $from, $to) {
        return $this->qRow("
            SELECT
                IFNULL(SUM(l.result = 'nueva'), 0)     AS created,
                IFNULL(SUM(l.result = 'reenviada'), 0) AS resent
            FROM {$this->crm}loyalty_signup_log l
            INNER JOIN {$this->bd}branches b ON b.id = l.branch_id
            WHERE b.company_id = ?
                AND l.created_at >= ?
                AND l.created_at < ?
        ", [$companyId, $from, $to]) ?: ['created' => 0, 'resent' => 0];
    }

    /*  El enlace publico con su sucursal (activa), su empresa, la tienda en linea
        (titulo y color) y el tipo de bienvenida. Null si el token no existe. */
    protected function qSignupByToken($token) {
        return $this->qRow("
            SELECT
                ls.branch_id,
                IFNULL(b.name, '')            AS branch,
                IFNULL(b.logo, '')            AS branch_logo,
                b.company_id,
                IFNULL(co.name, '')           AS company,
                IFNULL(co.logo, '')           AS company_logo,
                IFNULL(os.title, '')          AS title,
                IFNULL(os.accent, '')         AS accent,
                IFNULL(st.signup_enabled, 0)  AS signup_enabled,
                st.signup_type_id,
                IFNULL(t.name, '')            AS type,
                IFNULL(t.color, '')           AS color,
                IFNULL(t.discount_percent, 0) AS discount_percent,
                IFNULL(t.points_percent, 0)   AS points_percent,
                {$this->stampColumns('t')},
                IF(t.id IS NULL, 0, IFNULL(t.active, 1)) AS type_active
            FROM {$this->crm}loyalty_signup ls
            INNER JOIN {$this->bd}branches b       ON b.id = ls.branch_id AND IFNULL(b.is_active, 1) = 1
            INNER JOIN {$this->bd}companies co     ON co.id = b.company_id
            LEFT JOIN {$this->crm}loyalty_setting st ON st.company_id = b.company_id
            LEFT JOIN {$this->crm}card_type t      ON t.id = st.signup_type_id
                                                  AND t.branch_id IN (SELECT tb.id FROM {$this->bd}branches tb WHERE tb.company_id = b.company_id)
            LEFT JOIN {$this->pos}online_store os  ON os.branch_id = ls.branch_id
            WHERE ls.token = ?
            LIMIT 1
        ", [$token]);
    }

    // -- Registro --

    /*  Registros que hicieron algo (tarjeta nueva o reenviada) desde una conexion
        desde $since: el tope del formulario. Lo que se rechazo no cuenta. */
    protected function qSignupAttempts($ip, $since) {
        return $this->qCount("
            SELECT COUNT(*)
            FROM {$this->crm}loyalty_signup_log
            WHERE ip = ?
                AND created_at >= ?
                AND result IN ('nueva', 'reenviada')
        ", [$ip, $since]);
    }

    // Si a ese telefono ya se le dio o reenvio su tarjeta desde $since (no se le manda otra vez).
    protected function qSignupPhoneRecent($phone, $since) {
        return $this->qCount("
            SELECT COUNT(*)
            FROM {$this->crm}loyalty_signup_log
            WHERE phone = ?
                AND created_at >= ?
                AND result IN ('nueva', 'reenviada')
        ", [$phone, $since]) > 0;
    }

    /*  created_at con la hora de PHP (como online_order): los topes y el resumen
        del mes comparan contra fechas de PHP, no contra NOW() de MySQL. */
    protected function qLogSignup($branchId, $ip, $phone, $customerId, $cardId, $result) {
        return $this->_CUD("
            INSERT INTO {$this->crm}loyalty_signup_log (branch_id, ip, phone, customer_id, card_id, result, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ", [$branchId, mb_substr((string) $ip, 0, 45), $phone !== '' ? $phone : null, $customerId ?: null, $cardId ?: null, $result, date('Y-m-d H:i:s')]);
    }

    /*  Dentro de transaction(): aparta el enlace de la sucursal hasta el commit.
        Dos registros a la vez con el mismo telefono no crean dos clientes. */
    protected function qLockSignup($branchId) {
        return $this->qRow("SELECT id FROM {$this->crm}loyalty_signup WHERE branch_id = ? LIMIT 1 FOR UPDATE", [$branchId]);
    }

    /*  El cliente activo de la empresa con ese telefono, por los ultimos 10
        digitos (como la tienda en linea: «+52 993 123 4567» = «9931234567»). */
    protected function qSignupCustomer($branchId, $phone10) {
        return $this->qRow("
            SELECT id, IFNULL(name, '') AS name
            FROM {$this->pos}customer
            WHERE {$this->qSameCompany('branch_id')}
                AND IFNULL(active, 1) = 1
                AND RIGHT(REPLACE(REPLACE(REPLACE(REPLACE(REPLACE(IFNULL(phone, ''), ' ', ''), '-', ''), '(', ''), ')', ''), '+', ''), 10) = ?
            ORDER BY id
            LIMIT 1
        ", [$branchId, $phone10]);
    }

    // La tarjeta que el cliente puede usar hoy (activa y con su tipo activo), la mas reciente. Null si no tiene.
    protected function qOwnedCard($customerId, $branchId) {
        return $this->qRow("
            SELECT
                {$this->cardColumns()}
            FROM {$this->crm}card c
            INNER JOIN {$this->crm}card_type t ON t.id  = c.card_type_id AND IFNULL(t.active, 1) = 1
            LEFT JOIN {$this->pos}customer cu  ON cu.id = c.customer_id
            WHERE c.customer_id = ?
                AND {$this->qSameCompany('c.branch_id')}
                AND IFNULL(c.active, 1) = 1
            ORDER BY c.id DESC
            LIMIT 1
        ", [$customerId, $branchId]);
    }

    // Acepto mensajes de la tienda (registro solo, o al mandarle su tarjeta). No pisa la primera fecha.
    protected function qMarkOptin($customerId) {
        return $this->_CUD("UPDATE {$this->pos}customer SET whatsapp_optin_at = IFNULL(whatsapp_optin_at, NOW()) WHERE id = ?", [$customerId]);
    }

    /*  El cumpleaños solo si no se sabia (el registro no pisa lo que capturo el
        personal). El año no se pide: va 2000, bisiesto, para que quepa el 29/02. */
    protected function qSetBirthdayIfEmpty($customerId, $birthday) {
        return $this->_CUD("UPDATE {$this->pos}customer SET birthday = IFNULL(birthday, ?) WHERE id = ?", [$birthday, $customerId]);
    }

    // 8 digitos al azar que no use otra tarjeta de la empresa.
    protected function loyaltyFreshNumber($branchId) {
        for ($i = 0; $i < 10; $i++) {
            $number = (string) random_int(10000000, 99999999);

            if (!$this->qCardNumberTaken($branchId, $number, 0)) return $number;
        }

        throw new RuntimeException('loyaltyFreshNumber: sin numero libre');
    }

    // -- Bitacora de mensajes --

    /*  Un mensaje de lealtad: kind bienvenida | premio | regreso | cumple | nivel;
        status sent | simulated | failed | skip. Nunca truena: es solo la bitacora.
        created_at con la hora de PHP: de ahi salen «uno cada N dias» y «uno por año». */
    protected function qLogNotice($companyId, $branchId, $customerId, $cardId, $phone, $kind, $status, $detail, $userId) {
        try {
            $this->_CUD("
                INSERT INTO {$this->crm}loyalty_notice (company_id, branch_id, customer_id, card_id, phone, kind, status, detail, user_id, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ", [
                $companyId, $branchId ?: null, $customerId ?: null, $cardId ?: null, (string) $phone, $kind, $status,
                $detail !== '' && $detail !== null ? mb_substr((string) $detail, 0, 255, 'UTF-8') : null,
                $userId ?: null, date('Y-m-d H:i:s')
            ]);
        } catch (Throwable $e) {
            // La bitacora no debe tumbar un envio que ya salio.
        }
    }

    /*  Cuantos mensajes de lealtad salieron desde $from, por clase (bienvenida,
        premio, cumple, regreso, nivel). Solo los que salieron o se simularon. */
    protected function qNoticeCounts($companyId, $from) {
        $out = [];

        foreach ($this->qRows("
            SELECT kind, COUNT(*) AS sent
            FROM {$this->crm}loyalty_notice
            WHERE company_id = ?
                AND created_at >= ?
                AND status IN ('sent', 'simulated')
            GROUP BY kind
        ", [$companyId, $from]) as $row) {
            $out[(string) $row['kind']] = (int) $row['sent'];
        }

        return $out;
    }

    // Dentro de transaction(): aparta al cliente hasta el commit (cumpleaños y te extrañamos).
    protected function qLockCustomer($customerId) {
        return $this->qRow("SELECT id FROM {$this->pos}customer WHERE id = ? LIMIT 1 FOR UPDATE", [$customerId]);
    }

    /*  Dentro de transaction(): aparta la fila de un mensaje que va con regalo
        (status 'pending'). Devuelve su id: el envio la cierra con qFinishNotice. */
    protected function qClaimNotice($companyId, $branchId, $customerId, $cardId, $phone, $kind, $detail, $userId) {
        $this->must($this->_CUD("
            INSERT INTO {$this->crm}loyalty_notice (company_id, branch_id, customer_id, card_id, phone, kind, status, detail, user_id, created_at)
            VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)
        ", [$companyId, $branchId ?: null, $customerId, $cardId, (string) $phone, $kind, mb_substr((string) $detail, 0, 255, 'UTF-8'), $userId ?: null, date('Y-m-d H:i:s')]), 'qClaimNotice');

        $id = $this->qLastInsertId();
        if ($id <= 0) throw new RuntimeException('qClaimNotice: sin id');

        return $id;
    }

    // Como salio el mensaje de una fila apartada (el detalle se suma al regalo). Nunca truena: el regalo ya quedo.
    protected function qFinishNotice($id, $status, $detail) {
        try {
            $this->_CUD("UPDATE {$this->crm}loyalty_notice SET status = ?, detail = LEFT(CONCAT_WS(' · ', detail, ?), 255) WHERE id = ?", [
                $status, $detail !== '' && $detail !== null ? mb_substr((string) $detail, 0, 255, 'UTF-8') : null, $id
            ]);
        } catch (Throwable $e) {
            // Solo bitacora.
        }
    }
}
