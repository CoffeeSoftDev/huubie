<?php
/*  Agente de WhatsApp: lo que el webhook y la bandeja escriben y leen.
    Lo usan ctrl-whatsapp-webhook.php (F1) y ctrl-whatsapp.php (bandeja, F2),
    los dos sobre la clase mdl (mdl-order.php).

      wa_agent    el numero de cada empresa (phone_number_id de Meta).
      wa_chat     una conversacion por empresa y telefono.
      wa_message  cada mensaje; provider_id (el wamid) es unico.

    Las escrituras de un mensaje que llega solo se llaman dentro de
    transaction(): ahi un error de la base sube como excepcion y se deshace
    todo el mensaje.

    TODO lo de aqui es protected o private: Permission::dispatch despacha
    cualquier metodo publico que tenga el ctrl, tambien los de un trait. */
trait WhatsAppInbox {

    // n = 0: el numero no esta dado de alta. null = la base no contesto.
    protected function qWaAgentByNumber($phoneNumberId) {
        return $this->qRow("
            SELECT COUNT(*) AS n, MAX(company_id) AS company_id
            FROM {$this->pos}wa_agent
            WHERE phone_number_id = ?
        ", [$phoneNumberId]);
    }

    /*  Crea el chat si falta y lo deja bloqueado hasta el commit: dos avisos del
        mismo telefono se forman uno detras del otro. El nombre del perfil solo
        se cambia si llega uno. Devuelve el id, o 0. */
    protected function qWaLockChat($companyId, $phone, $waId, $name, $now) {
        $this->qWaRun("
            INSERT INTO {$this->pos}wa_chat (company_id, phone, wa_id, name, mode, opt_out, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'agent', 0, ?, ?)
            ON DUPLICATE KEY UPDATE
                wa_id = VALUES(wa_id),
                name  = IF(VALUES(name) = '', name, VALUES(name))
        ", [$companyId, $phone, $waId, $name, $now, $now]);

        $row = $this->qRow("
            SELECT id
            FROM {$this->pos}wa_chat
            WHERE company_id = ? AND phone = ?
            LIMIT 1
            FOR UPDATE
        ", [$companyId, $phone]);

        return $row === null ? 0 : (int) $row['id'];
    }

    protected function qWaMessageExists($providerId) {
        return $this->qCount("
            SELECT COUNT(*)
            FROM {$this->pos}wa_message
            WHERE provider_id = ?
        ", [$providerId]) > 0;
    }

    protected function qCreateWaMessage($array) {
        return $this->qInsertInto('wa_message', $array);
    }

    // last_in_at y last_message_at nunca van hacia atras: un aviso viejo que llega tarde no las mueve.
    protected function qWaTouchChat($chatId, $sentAt, $now) {
        $this->qWaRun("
            UPDATE {$this->pos}wa_chat
            SET last_in_at      = GREATEST(IFNULL(last_in_at, ?), ?),
                last_message_at = GREATEST(IFNULL(last_message_at, ?), ?),
                updated_at      = ?
            WHERE id = ?
        ", [$sentAt, $sentAt, $sentAt, $sentAt, $now, $chatId]);
    }

    // -- Numero de la empresa --

    protected function qWaAgent($companyId) {
        return $this->qRow("
            SELECT id, company_id, phone_number_id, IFNULL(display_phone, '') AS display_phone,
                   enabled, hours, IFNULL(catalog_mode, 'store') AS catalog_mode, IFNULL(auto_topics, '') AS auto_topics, updated_at
            FROM {$this->pos}wa_agent
            WHERE company_id = ?
            LIMIT 1
        ", [$companyId]);
    }

    // 1 si el telefono del chat c es de un destinatario con «Pregunta» (agente del dueño, F6).
    private function qWaOwnerSql() {
        return "EXISTS (SELECT 1 FROM {$this->pos}wa_recipient wr
                        WHERE wr.company_id = c.company_id AND wr.phone = c.phone AND wr.active = 1 AND IFNULL(wr.can_ask, 0) = 1)";
    }

    // -- Bandeja --

    /*  Los chats de la empresa, el mas reciente arriba.
          $branch  '' = todos · 'none' = sin sucursal · id = esa sucursal
          unread   mensajes del cliente guardados despues de seen_at */
    protected function qWaChatList($companyId, $search = '', $branch = '') {
        $where = '';
        $data  = [$companyId];

        if ($branch === 'none') {
            $where .= ' AND c.branch_id IS NULL';
        } else if ((int) $branch > 0) {
            $where .= ' AND c.branch_id = ?';
            $data[] = (int) $branch;
        }

        if ($search !== '') {
            $like   = '%' . addcslashes($search, '%_\\') . '%';
            $where .= ' AND (c.name LIKE ? OR c.phone LIKE ?)';
            $data[] = $like;
            $data[] = $like;
        }

        return $this->qRows("
            SELECT c.id, c.phone, c.wa_id, c.name, c.branch_id, IFNULL(b.name, '') AS branch,
                   c.opt_out, c.last_in_at, c.last_message_at, c.seen_at, c.menu_at,
                   IFNULL(c.mode, 'agent') AS mode, c.human_until, IFNULL(c.handoff_note, '') AS handoff_note,
                   (SELECT COUNT(*)
                    FROM {$this->pos}wa_message mi
                    WHERE mi.chat_id = c.id AND mi.direction = 'in'
                        AND (c.seen_at IS NULL OR mi.created_at > c.seen_at)) AS unread,
                   IFNULL(lm.body, '') AS last_body, IFNULL(lm.type, '') AS last_type,
                   IFNULL(lm.direction, '') AS last_dir, IFNULL(lm.status, '') AS last_status,
                   {$this->qWaOwnerSql()} AS owner
            FROM {$this->pos}wa_chat c
            LEFT JOIN {$this->bd}branches b ON b.id = c.branch_id
            LEFT JOIN {$this->pos}wa_message lm
                   ON lm.id = (SELECT MAX(m2.id) FROM {$this->pos}wa_message m2 WHERE m2.chat_id = c.id)
            WHERE c.company_id = ?{$where}
            ORDER BY c.last_message_at DESC, c.id DESC
            LIMIT 200
        ", $data);
    }

    protected function qWaChat($chatId, $companyId) {
        return $this->qRow("
            SELECT c.id, c.company_id, c.phone, c.wa_id, c.name, c.branch_id, IFNULL(b.name, '') AS branch,
                   c.opt_out, c.opt_out_at, c.last_in_at, c.last_message_at, c.seen_at, c.menu_at, c.customer_id,
                   IFNULL(c.mode, 'agent') AS mode, c.human_until, IFNULL(c.handoff_note, '') AS handoff_note,
                   {$this->qWaOwnerSql()} AS owner
            FROM {$this->pos}wa_chat c
            LEFT JOIN {$this->bd}branches b ON b.id = c.branch_id
            WHERE c.id = ? AND c.company_id = ?
            LIMIT 1
        ", [$chatId, $companyId]);
    }

    protected function qWaChatByPhone($companyId, $phone) {
        return $this->qRow("
            SELECT id, wa_id
            FROM {$this->pos}wa_chat
            WHERE company_id = ? AND phone = ?
            LIMIT 1
        ", [$companyId, $phone]);
    }

    // Los ultimos 200 mensajes, del mas viejo al mas nuevo. auto = propuesta que salio sola (F6).
    protected function qWaThread($chatId) {
        return $this->qRows("
            SELECT t.*
            FROM (
                SELECT m.id, m.direction, m.type, IFNULL(m.body, '') AS body, IFNULL(m.media_type, '') AS media_type,
                       m.status, IFNULL(m.error, '') AS error, m.sent_at, m.user_id, m.receipt_id,
                       IFNULL(CONCAT_WS(' ', u.name, u.last_name), '') AS user,
                       EXISTS (SELECT 1 FROM {$this->pos}wa_proposal p WHERE p.sent_message_id = m.id AND p.auto_sent = 1) AS auto
                FROM {$this->pos}wa_message m
                LEFT JOIN {$this->bd}users u ON u.id = m.user_id
                WHERE m.chat_id = ?
                ORDER BY m.id DESC
                LIMIT 200
            ) t
            ORDER BY t.id
        ", [$chatId]);
    }

    protected function qWaSeen($chatId, $now) {
        $this->qWaRun("UPDATE {$this->pos}wa_chat SET seen_at = ? WHERE id = ?", [$now, $chatId]);
    }

    // $branchId null = vuelve a «sin sucursal».
    protected function qWaSetBranch($chatId, $branchId, $now) {
        $this->qWaRun("UPDATE {$this->pos}wa_chat SET branch_id = ?, updated_at = ? WHERE id = ?", [$branchId, $now, $chatId]);
    }

    // Solo si sigue sin sucursal: la eleccion del cliente no pisa la que puso una persona.
    protected function qWaChooseBranch($chatId, $branchId, $now) {
        $this->qWaRun("
            UPDATE {$this->pos}wa_chat
            SET branch_id = ?, updated_at = ?
            WHERE id = ? AND branch_id IS NULL
        ", [$branchId, $now, $chatId]);
    }

    // Empresa con una sola sucursal activa: todos sus chats son de esa.
    protected function qWaAssignAll($companyId, $branchId, $now) {
        $this->qWaRun("
            UPDATE {$this->pos}wa_chat
            SET branch_id = ?, updated_at = ?
            WHERE company_id = ? AND branch_id IS NULL
        ", [$branchId, $now, $companyId]);
    }

    // -- Lo que sale --

    protected function qWaTouchOut($chatId, $now) {
        $this->qWaRun("
            UPDATE {$this->pos}wa_chat
            SET last_message_at = GREATEST(IFNULL(last_message_at, ?), ?),
                updated_at      = ?
            WHERE id = ?
        ", [$now, $now, $now, $chatId]);
    }

    protected function qWaHasOut($chatId) {
        return $this->qCount("
            SELECT COUNT(*)
            FROM {$this->pos}wa_message
            WHERE chat_id = ? AND direction = 'out'
        ", [$chatId]) > 0;
    }

    /*  Los chats a los que les toca el menu de sucursales: sin sucursal, sin
        menu, sin baja, con la ventana de 24 h abierta y sin nada que haya
        salido de Huubie (si una persona ya contesto, el menu sobra). Al
        dueño (F6) no le sale: ve las sucursales de su alta. */
    protected function qWaMenuPending($companyId, $since) {
        return $this->qRows("
            SELECT c.id
            FROM {$this->pos}wa_chat c
            WHERE c.company_id = ?
                AND c.branch_id IS NULL
                AND c.menu_at IS NULL
                AND c.opt_out = 0
                AND c.last_in_at >= ?
                AND NOT {$this->qWaOwnerSql()}
                AND NOT EXISTS (
                    SELECT 1 FROM {$this->pos}wa_message m
                    WHERE m.chat_id = c.id AND m.direction = 'out'
                )
            ORDER BY c.last_in_at, c.id
            LIMIT 20
        ", [$companyId, $since]);
    }

    // Dentro de transaction(): el chat queda apartado hasta el commit.
    protected function qWaLockChatById($chatId) {
        return $this->qRow("
            SELECT id, company_id, phone, wa_id, name, branch_id, opt_out, last_in_at, menu_at
            FROM {$this->pos}wa_chat
            WHERE id = ?
            LIMIT 1
            FOR UPDATE
        ", [$chatId]);
    }

    protected function qWaMarkMenu($chatId, $now) {
        $this->qWaRun("UPDATE {$this->pos}wa_chat SET menu_at = ?, updated_at = ? WHERE id = ?", [$now, $now, $chatId]);
    }

    // -- Statuses de Meta --

    // Solo mensajes que salieron de esa empresa.
    protected function qWaOutByProvider($companyId, $providerId) {
        return $this->qRow("
            SELECT m.id, m.status
            FROM {$this->pos}wa_message m
            INNER JOIN {$this->pos}wa_chat c ON c.id = m.chat_id
            WHERE m.provider_id = ? AND m.direction = 'out' AND c.company_id = ?
            LIMIT 1
        ", [$providerId, $companyId]);
    }

    // Solo avanza desde $from: un "entregado" que llega despues del "leido" no lo regresa.
    protected function qWaSetStatus($messageId, $status, $error, array $from) {
        $this->qWaRun("
            UPDATE {$this->pos}wa_message
            SET status = ?, error = COALESCE(?, error)
            WHERE id = ? AND status IN (" . $this->qIn($from) . ")
        ", array_merge([$status, $error, $messageId], $from));
    }

    // _CUD directo (varios ? en una misma expresion; _Update no los cuenta bien).
    private function qWaRun($query, array $data) {
        if ($this->_CUD($query, $data) !== true) {
            throw new RuntimeException('wa_chat: la base no acepto la escritura');
        }
    }
}

/*  Lo automatico del agente en F2 y el envio de la bandeja. Va con WhatsAppInbox.

    Reglas que no se ven en el codigo de un vistazo:
      - Fuera de horario (wa_agent.enabled = 0, o la hora no cae en un tramo de
        wa_agent.hours) NO sale nada automatico. Lo pendiente sale en el
        siguiente barrido con el agente abierto: cuando llega otro mensaje o
        cuando alguien tiene abierta la bandeja.
      - Lo unico automatico de F2 es el menu de sucursales (una vez por chat) y
        la confirmacion de la sucursal elegida. Con una sola sucursal activa no
        hay menu: el chat se le asigna directo.
      - Nada sale si pasaron 24 h desde el ultimo mensaje del cliente (regla de
        Meta: despues de eso solo plantillas aprobadas, F5).
      - Un chat del simulador (wa_id 'SIM-...') nunca sale a la red.
      - «BAJA» (el mensaje entero) deja opt_out = 1: no le llegan recordatorios
        ni plantillas, ni el menu de sucursales. Lo que escriba se le sigue
        pudiendo contestar. «ALTA» lo deshace (F5). */
trait WhatsAppAgentFlow {

    private $inboxMetaCache = null;

    protected function inboxMeta() {
        if ($this->inboxMetaCache === null) $this->inboxMetaCache = new WhatsAppMeta();

        return $this->inboxMetaCache;
    }

    // El reloj del agente (el arnes lo fija para probar horarios).
    protected function inboxNow() {
        return time();
    }

    protected function inboxLog($message) {
        WhatsAppMeta::log($message);
    }

    // -- Lo que llega --

    /*  Un mensaje del cliente, dentro de transaction(). Devuelve el id del chat, o 0 si ya estaba (Meta lo repitio).
        media_path solo lo trae el simulador (el archivo ya esta en storage/whatsapp); lo de Meta se baja con media_id. */
    protected function inboxSave($companyId, array $msg) {
        $now    = date('Y-m-d H:i:s', $this->inboxNow());
        $sentAt = date('Y-m-d H:i:s', $msg['sent_at']);

        $chatId = $this->qWaLockChat($companyId, $msg['phone'], $msg['wa_id'], $msg['name'], $now);
        if ($chatId <= 0) throw new RuntimeException('wa_chat: no se pudo abrir el chat');

        if ($this->qWaMessageExists($msg['wamid'])) return 0;

        $this->inboxMust($this->qCreateWaMessage([
            'values' => ['chat_id', 'direction', 'provider_id', 'type', 'body', 'media_id', 'media_type', 'media_path', 'status', 'sent_at', 'raw', 'created_at'],
            'data'   => [$chatId, 'in', $msg['wamid'], $msg['type'], $msg['body'], $msg['media_id'], $msg['media_type'], $msg['media_path'] ?? null, 'received', $sentAt, $msg['raw'], $now],
        ]), 'wa_message');

        $this->qWaTouchChat($chatId, $sentAt, $now);

        // BAJA apaga recordatorios y plantillas (lo que inicia la empresa); ALTA los vuelve a encender.
        $word = in_array($msg['type'], ['text', 'button', 'interactive'], true) ? $this->inboxKeyword($msg['body']) : '';

        if ($word === 'baja') $this->qWaRun("UPDATE {$this->pos}wa_chat SET opt_out = 1, opt_out_at = ?, updated_at = ? WHERE id = ?", [$sentAt, $now, $chatId]);
        if ($word === 'alta') $this->qWaRun("UPDATE {$this->pos}wa_chat SET opt_out = 0, opt_out_at = NULL, updated_at = ? WHERE id = ?", [$now, $chatId]);

        return $chatId;
    }

    // 'baja' | 'alta' si el mensaje es solo esa palabra (sin importar mayusculas, acentos ni signos); si no, ''.
    protected function inboxKeyword($text) {
        $word = (string) preg_replace('/[^a-z]+/', '', $this->inboxFold($text));

        return in_array($word, ['baja', 'alta'], true) ? $word : '';
    }

    /*  Despues de guardar (fuera de la transaccion): la respuesta al menu y el
        barrido. $replies = [chat_id => el texto mas nuevo del cliente]. */
    protected function inboxAfter($companyId, array $replies) {
        foreach ($replies as $chatId => $text) $this->inboxChoose($companyId, (int) $chatId, (string) $text);

        return $this->inboxSweep($companyId);
    }

    // ¿Con quien se queda? Solo cuenta si ya se le mando el menu y sigue sin sucursal.
    protected function inboxChoose($companyId, $chatId, $text) {
        $chat = $this->qWaChat($chatId, $companyId);
        if (!$chat || $chat['branch_id'] !== null || $chat['menu_at'] === null) return null;

        $branch = $this->inboxPickBranch($companyId, $text);
        if ($branch === null) return null;

        $this->qWaChooseBranch($chatId, $branch['id'], date('Y-m-d H:i:s', $this->inboxNow()));

        $agent = $this->qWaAgent($companyId);
        if ($this->inboxIsOpen($agent) && $this->inboxWindowOpen($chat['last_in_at'])) {
            $this->inboxSend($agent, $chat, "Listo, te atiende *{$branch['name']}*. Cuéntanos en qué te ayudamos.", null);
        }

        return $branch['id'];
    }

    // «2», «2.» o el nombre tal cual (sin importar mayusculas ni acentos), en el orden del menu.
    protected function inboxPickBranch($companyId, $text) {
        $branches = $this->qCompanyBranches($companyId);
        $text     = trim((string) $text);

        if (preg_match('/^(\d{1,2})\.?$/', $text, $m)) {
            $i = (int) $m[1] - 1;

            return isset($branches[$i]) ? ['id' => (int) $branches[$i]['id'], 'name' => (string) $branches[$i]['name']] : null;
        }

        $key = $this->inboxFold($text);
        if ($key === '') return null;

        foreach ($branches as $b) {
            if ($this->inboxFold($b['name']) === $key) return ['id' => (int) $b['id'], 'name' => (string) $b['name']];
        }

        return null;
    }

    private function inboxFold($text) {
        $text = mb_strtolower(trim((string) $text), 'UTF-8');

        return strtr($text, ['á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ü' => 'u', 'ñ' => 'n']);
    }

    // -- Barrido --

    /*  Lo automatico pendiente de la empresa. Devuelve cuantos menus salieron.
        Con una sola sucursal activa solo asigna (no manda nada). */
    protected function inboxSweep($companyId) {
        $branches = $this->qCompanyBranches($companyId);
        $now      = $this->inboxNow();

        if (count($branches) === 1) {
            $this->qWaAssignAll($companyId, (int) $branches[0]['id'], date('Y-m-d H:i:s', $now));

            return 0;
        }

        if (count($branches) < 2) return 0;

        $agent = $this->qWaAgent($companyId);
        if (!$this->inboxIsOpen($agent)) return 0;

        $sent = 0;

        foreach ($this->qWaMenuPending($companyId, date('Y-m-d H:i:s', $now - 86400)) as $row) {
            if ($this->inboxSendMenu($agent, (int) $row['id'], $branches)) $sent++;
        }

        return $sent;
    }

    // Aparta el chat (menu_at) y luego manda: dos barridos a la vez no lo mandan dos veces.
    protected function inboxSendMenu(array $agent, $chatId, array $branches) {
        $now   = $this->inboxNow();
        $since = date('Y-m-d H:i:s', $now - 86400);

        $chat = $this->transaction(function () use ($chatId, $now, $since) {
            $row = $this->qWaLockChatById($chatId);

            if (!$row || $row['branch_id'] !== null || $row['menu_at'] !== null || (int) $row['opt_out'] === 1) return null;
            if ($row['last_in_at'] === null || $row['last_in_at'] < $since) return null;
            if ($this->qWaHasOut($chatId)) return null;

            $this->qWaMarkMenu($chatId, date('Y-m-d H:i:s', $now));

            return $row;
        });

        if (!$chat) return false;

        $this->inboxSend($agent, $chat, $this->inboxMenuText($agent['company_id'], $branches, $chat['name']), null);

        return true;
    }

    protected function inboxMenuText($companyId, array $branches, $name) {
        $company = $this->qCompany($companyId);
        $first   = trim((string) strtok(trim((string) $name), ' '));
        $lines   = [];

        foreach (array_values($branches) as $i => $b) $lines[] = ($i + 1) . '. ' . $b['name'];

        return '¡Hola' . ($first !== '' ? ' ' . $first : '') . '! Gracias por escribir'
            . ($company && $company['name'] !== '' ? ' a *' . $company['name'] . '*' : '') . ".\n"
            . "¿Con qué sucursal te atendemos? Responde con el número:\n\n"
            . implode("\n", $lines);
    }

    // -- Horario y ventana --

    /*  Agente encendido y la hora cae en un tramo del dia (0 = domingo).
        hours = {"1":[["09:00","20:00"]], ...}; "24:00" cierra a medianoche. */
    protected function inboxIsOpen($agent, $ts = null) {
        if (!$agent || (int) $agent['enabled'] !== 1) return false;

        $ts    = $ts === null ? $this->inboxNow() : $ts;
        $hours = json_decode((string) $agent['hours'], true);
        $hm    = date('H:i', $ts);

        if (!is_array($hours) || !isset($hours[date('w', $ts)]) || !is_array($hours[date('w', $ts)])) return false;

        foreach ($hours[date('w', $ts)] as $range) {
            if (!is_array($range) || count($range) !== 2) continue;

            list($from, $to) = array_values($range);

            if (is_string($from) && is_string($to) && $hm >= $from && $hm < $to) return true;
        }

        return false;
    }

    // La ventana de 24 h de Meta: abierta mientras el ultimo mensaje del cliente tenga menos de 24 h.
    protected function inboxWindowOpen($lastInAt) {
        if (!$lastInAt) return false;

        $ts = strtotime((string) $lastInAt);

        return $ts !== false && $ts >= $this->inboxNow() - 86400;
    }

    // -- Envio --

    /*  Manda y guarda el mensaje que sale ('out'). $userId null = el agente.
        Devuelve la respuesta de WhatsAppMeta::send() mas message_id. */
    protected function inboxSend(array $agent, array $chat, $text, $userId) {
        $sent = strpos((string) $chat['wa_id'], 'SIM-') === 0
            ? WhatsAppMeta::simulated(WhatsAppMeta::metaPhone($chat['phone']))
            : $this->inboxMeta()->send($agent['phone_number_id'], $chat['phone'], $text);

        $now = date('Y-m-d H:i:s', $this->inboxNow());

        $messageId = $this->transaction(function () use ($chat, $text, $userId, $sent, $now) {
            $this->inboxMust($this->qCreateWaMessage([
                'values' => ['chat_id', 'direction', 'provider_id', 'type', 'body', 'status', 'error', 'user_id', 'sent_at', 'created_at'],
                'data'   => [(int) $chat['id'], 'out', $sent['provider_id'], 'text', $text, $sent['status'],
                             $sent['detail'] !== '' ? mb_substr($sent['detail'], 0, 255, 'UTF-8') : null,
                             $userId ?: null, $now, $now],
            ]), 'wa_message');

            $id = $this->qLastInsertId();

            $this->qWaTouchOut((int) $chat['id'], $now);

            return $id;
        });

        if ($sent['status'] === 'failed') $this->inboxLog("[ ENVIO ] :: chat {$chat['id']} :: {$sent['detail']}");

        return array_merge($sent, ['message_id' => $messageId]);
    }

    private function inboxMust($result, $what) {
        if ($result !== true) {
            throw new RuntimeException($what . ': ' . (is_string($result) ? $result : 'sin respuesta de la base'));
        }

        return true;
    }
}
