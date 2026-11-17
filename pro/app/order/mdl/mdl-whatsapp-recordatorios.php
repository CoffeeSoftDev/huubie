<?php
/*  Recordatorios de adeudo y plantillas de Meta (F5 del plan de WhatsApp).

    Va con WhatsAppInbox + WhatsAppAgentFlow (mdl-whatsapp-agente.php),
    CustomerPortal (mdl-portal.php) y WhatsAppAgentAI (mdl-whatsapp-ia.php,
    de ahi salen el enlace publico, el token del portal y el formato) sobre la
    clase mdl. Lo usan ctrl-whatsapp.php y cron-whatsapp-agente.php.

    Reglas que no se ven en el codigo de un vistazo:
      - Fuera de la ventana de 24 h, Meta solo deja mandar una plantilla
        aprobada: el texto lo aprueba Meta y Huubie solo pone los valores
        ({{1}}, {{2}}…). waTemplateText() es la copia de lo aprobado; si se
        cambia en Meta hay que cambiarla aqui. Nombres en el .env
        (WHATSAPP_META_TPL_*), ver _WhatsAppMeta.php.
      - Quien debe: lo mismo que ve el cliente en su portal (portalDebts):
        pedidos con anticipo o pendientes y ventas a credito. Las cotizaciones
        sin anticipo no cuentan. Un renglon por cliente y sucursal.
      - Quien recibe hoy: telefono de 10 digitos, sin BAJA (wa_chat.opt_out),
        sin recordatorio en los ultimos 7 dias (por telefono, en toda la
        empresa; uno fallido no cuenta) y uno solo por cliente: si debe en
        dos sucursales, sale el de la deuda mayor. Tope de 50 por empresa al dia.
      - Solo sale en horario del agente. El automatico (wa_agent.reminders)
        lo manda el cron, a lo mas 20 por corrida; «Mandar los de hoy» lo hace
        a mano. Los dos pasan por el mismo apartado (transaccion con el chat
        bloqueado): dos corridas a la vez no le mandan dos al mismo cliente.
      - El recordatorio vive en la conversacion del cliente (wa_message tipo
        'template'); si no habia chat, se crea con la sucursal del adeudo. Sin
        token de Meta el chat nace como simulado ('SIM-…') y nada sale a la red.
      - El enlace del portal sale de WHATSAPP_PUBLIC_URL (el cron no tiene
        host). Sin el, no sale ningun recordatorio.
      - «Ya abrimos» solo para un chat cuyo ultimo mensaje es del cliente y
        lleva mas de 24 h sin respuesta, en horario y sin BAJA (salvo que haya
        escrito despues de la BAJA).
      - TODO es protected o private: Permission::dispatch despacha cualquier
        metodo publico del ctrl, tambien los de un trait. */
trait WhatsAppReminders {

    // -- Consultas --

    protected function qWaReminderAgent($companyId) {
        return $this->qRow("
            SELECT id, company_id, phone_number_id, IFNULL(display_phone, '') AS display_phone,
                   enabled, hours, IFNULL(reminders, 0) AS reminders
            FROM {$this->pos}wa_agent
            WHERE company_id = ?
            LIMIT 1
        ", [$companyId]);
    }

    protected function qWaSetReminders($companyId, $on, $userId, $now) {
        $this->qWaRun("
            UPDATE {$this->pos}wa_agent
            SET reminders = ?, updated_user_id = ?, updated_at = ?
            WHERE company_id = ?
        ", [$on ? 1 : 0, $userId ?: null, $now, $companyId]);
    }

    /*  Las ventas de la sucursal que pueden deber algo, con las reglas de
        portalDebts: pedidos (1) en Cotizacion o Pendiente y ventas a credito
        (3) pendientes con su cargo vivo. La cartera del agente del dueño (F6)
        usa la misma lista. */
    protected function qWaDebtSales($branchId) {
        return $this->qRows("
            SELECT s.id, s.customer_id, s.sale_type_id, s.sale_status_id, s.created_at,
                   IFNULL(s.total, 0) AS total, IFNULL(s.tip_amount, 0) AS tip,
                   {$this->qPaidSql('s')} AS paid
            FROM {$this->pos}sale s
            WHERE s.branch_id = ?
                AND s.customer_id IS NOT NULL
                AND IFNULL(s.active, 1) = 1
                AND (
                    (s.sale_type_id = 1 AND s.sale_status_id IN (1, 2))
                    OR (
                        s.sale_type_id = 3 AND s.sale_status_id = 2
                        AND EXISTS (
                            SELECT 1 FROM {$this->pos}receivable r
                            WHERE r.sale_id = s.id AND r.kind = 'cargo'
                                AND IFNULL(r.active, 1) = 1 AND r.deleted_at IS NULL
                        )
                    )
                )
        ", [$branchId]);
    }

    // Los clientes activos de la empresa de la sucursal con esos ids.
    protected function qWaReminderCustomers(array $ids, $branchId) {
        if (!$ids) return [];

        return $this->qRows("
            SELECT c.id, IFNULL(c.name, '') AS name, IFNULL(c.phone, '') AS phone
            FROM {$this->pos}customer c
            WHERE c.id IN ({$this->qIn($ids)})
                AND IFNULL(c.active, 1) = 1
                AND {$this->qSameCompany('c.branch_id')}
        ", array_merge(array_values($ids), [$branchId]));
    }

    // [telefono => chat] de la empresa.
    protected function qWaChatsByPhone($companyId, array $phones) {
        $map = [];
        if (!$phones) return $map;

        foreach ($this->qRows("
            SELECT id, phone, wa_id, opt_out, opt_out_at
            FROM {$this->pos}wa_chat
            WHERE company_id = ? AND phone IN ({$this->qIn($phones)})
        ", array_merge([$companyId], array_values($phones))) as $row) {
            $map[(string) $row['phone']] = $row;
        }

        return $map;
    }

    // [telefono => el ultimo recordatorio que no fallo].
    protected function qWaLastReminders($companyId, array $phones) {
        $map = [];
        if (!$phones) return $map;

        foreach ($this->qRows("
            SELECT phone, MAX(created_at) AS last
            FROM {$this->pos}wa_reminder
            WHERE company_id = ? AND status <> 'failed' AND phone IN ({$this->qIn($phones)})
            GROUP BY phone
        ", array_merge([$companyId], array_values($phones))) as $row) {
            $map[(string) $row['phone']] = (string) $row['last'];
        }

        return $map;
    }

    protected function qWaRemindersSince($companyId, $since) {
        return $this->qCount("
            SELECT COUNT(*)
            FROM {$this->pos}wa_reminder
            WHERE company_id = ? AND status <> 'failed' AND created_at >= ?
        ", [$companyId, $since]);
    }

    protected function qWaLastReminderOf($companyId, $phone) {
        $row = $this->qRow("
            SELECT MAX(created_at) AS last
            FROM {$this->pos}wa_reminder
            WHERE company_id = ? AND phone = ? AND status <> 'failed'
        ", [$companyId, $phone]);

        return $row && $row['last'] !== null ? (string) $row['last'] : '';
    }

    protected function qCreateWaReminder($array) {
        return $this->qInsertInto('wa_reminder', $array);
    }

    protected function qWaFinishReminder($id, $status, $error) {
        $this->qWaRun("
            UPDATE {$this->pos}wa_reminder
            SET status = ?, error = ?
            WHERE id = ?
        ", [$status, $error !== '' ? mb_substr($error, 0, 255, 'UTF-8') : null, $id]);
    }

    /*  Dentro de transaction(): crea el chat si falta, SIN tocar uno que ya
        existe (su wa_id lo pone Meta), y lo deja apartado hasta el commit. */
    protected function qWaReminderChat($companyId, $phone, $waId, $name, $now) {
        $this->qWaRun("
            INSERT INTO {$this->pos}wa_chat (company_id, phone, wa_id, name, mode, opt_out, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'agent', 0, ?, ?)
            ON DUPLICATE KEY UPDATE id = id
        ", [$companyId, $phone, $waId, $name, $now, $now]);

        return $this->qRow("
            SELECT id, company_id, phone, wa_id, name, branch_id, opt_out, opt_out_at, last_in_at
            FROM {$this->pos}wa_chat
            WHERE company_id = ? AND phone = ?
            LIMIT 1
            FOR UPDATE
        ", [$companyId, $phone]);
    }

    // El ultimo mensaje del chat: ['dir' => 'in' | 'out', 'body'] o null si no hay.
    protected function qWaLastMessage($chatId) {
        $row = $this->qRow("
            SELECT direction, IFNULL(body, '') AS body
            FROM {$this->pos}wa_message
            WHERE chat_id = ?
            ORDER BY id DESC
            LIMIT 1
        ", [$chatId]);

        return $row ? ['dir' => (string) $row['direction'], 'body' => (string) $row['body']] : null;
    }

    protected function qWaFinishTemplate($messageId, array $sent) {
        $this->qWaRun("
            UPDATE {$this->pos}wa_message
            SET status = ?, provider_id = ?, error = ?
            WHERE id = ?
        ", [$sent['status'], $sent['provider_id'], $sent['detail'] !== '' ? mb_substr($sent['detail'], 0, 255, 'UTF-8') : null, $messageId]);
    }

    // -- Plantillas --

    /*  El texto de cada plantilla TAL CUAL debe quedar aprobada en Meta
        (categoria Utilidad, idioma español de México). {{n}} = los valores,
        en orden:
          saldo    1 nombre · 2 negocio · 3 saldo · 4 enlace del portal
          abrimos  1 nombre · 2 negocio
          tarjeta  1 nombre · 2 tipo de tarjeta · 3 negocio · 4 enlace de la tarjeta
          premio   1 nombre · 2 sellos de la meta · 3 negocio · 4 premio · 5 enlace de la tarjeta
                   (las dos de Lealtad: mdl-lealtad-whatsapp.php) */
    protected function waTemplateText($key) {
        $texts = [
            'saldo'   => "Hola {{1}}, te escribimos de *{{2}}*. Tienes un saldo pendiente de *{{3}}*.\n\n"
                       . "Aquí puedes ver el detalle y mandar tu comprobante: {{4}}\n\n"
                       . 'Si ya pagaste, no hagas caso a este mensaje. Para no recibir más recordatorios, responde BAJA.',
            'abrimos' => 'Hola {{1}}, ya estamos abiertos en *{{2}}*. Vimos tu mensaje: ¿seguimos con lo que necesitabas?',
            'tarjeta' => "Hola {{1}}, ya tienes tu tarjeta *{{2}}* de *{{3}}*.\n\n"
                       . "Ábrela en tu teléfono y enséñala en caja para usarla: {{4}}\n\n"
                       . 'Para no recibir mensajes de la tienda, responde BAJA.',
            'premio'  => "Hola {{1}}, ya juntaste tus {{2}} sellos en *{{3}}*. Tu premio *{{4}}* te espera: pídelo en caja cuando quieras.\n\n"
                       . "Tu tarjeta: {{5}}\n\n"
                       . 'Para no recibir mensajes de la tienda, responde BAJA.'
        ];

        return $texts[$key] ?? '';
    }

    protected function waTemplateFill($key, array $params) {
        $text = $this->waTemplateText($key);

        foreach (array_values($params) as $i => $value) {
            $text = str_replace('{{' . ($i + 1) . '}}', trim((string) preg_replace('/\s+/u', ' ', (string) $value)), $text);
        }

        return $text;
    }

    // El primer nombre para la plantilla: «ALEJANDRO» o «alejandro» → «Alejandro»; sin nombre, «cliente».
    protected function waFirstName($name) {
        $first = $this->agentFirstName($name);

        if ($first === '') return 'cliente';

        return mb_convert_case(mb_strtolower($first, 'UTF-8'), MB_CASE_TITLE, 'UTF-8');
    }

    // «Reginas Cuarta» si la sucursal ya lleva el nombre de la empresa; si no, «Empresa (Sucursal)».
    protected function waBusinessLabel($company, $branch) {
        $company = trim((string) $company);
        $branch  = trim((string) $branch);

        if ($branch === '')  return $company;
        if ($company === '') return $branch;

        return strpos($this->inboxFold($branch), $this->inboxFold($company)) !== false ? $branch : $company . ' (' . $branch . ')';
    }

    /*  Dentro de transaction(): deja el mensaje de la plantilla en el chat como
        'sending' antes de mandarlo. Asi un segundo clic ve que ya hay respuesta. */
    protected function waTemplateClaim(array $chat, $text, $userId, $now) {
        $this->inboxMust($this->qCreateWaMessage([
            'values' => ['chat_id', 'direction', 'provider_id', 'type', 'body', 'status', 'user_id', 'sent_at', 'created_at'],
            'data'   => [(int) $chat['id'], 'out', null, 'template', $text, 'sending', $userId ?: null, $now, $now],
        ]), 'wa_message');

        $id = $this->qLastInsertId();
        if ($id <= 0) throw new RuntimeException('plantilla: sin id del mensaje');

        $this->qWaTouchOut((int) $chat['id'], $now);

        return $id;
    }

    // Fuera de transaction(): manda la plantilla apartada y le pone su estado. Un chat 'SIM-…' nunca sale a la red.
    protected function waTemplateDeliver(array $agent, array $chat, $key, array $params, $messageId) {
        $sent = strpos((string) $chat['wa_id'], 'SIM-') === 0
            ? WhatsAppMeta::simulated(WhatsAppMeta::metaPhone($chat['phone']))
            : $this->inboxMeta()->sendTemplate($agent['phone_number_id'] ?? '', $chat['phone'], $key, $params);

        $this->qWaFinishTemplate($messageId, $sent);

        if ($sent['status'] === 'failed') $this->inboxLog("[ PLANTILLA ] :: chat {$chat['id']} :: {$sent['detail']}");

        return array_merge($sent, ['message_id' => (int) $messageId]);
    }

    // -- Recordatorios --

    protected function reminderDailyCap() {
        return 50;
    }

    /*  Los que deben en las sucursales activas de la empresa y si les toca hoy.
        Cada fila: customer_id, name, phone (10 digitos o ''), raw_phone,
        branch_id, branch, debt, folios, chat_id, last, opt_out_at, other, state.
        state: send (sale hoy) · cap (tope del dia) · other (sale el de otra
        sucursal) · week (ya recibio esta semana) · baja · phone (sin numero). */
    protected function reminderList($companyId) {
        $now     = $this->inboxNow();
        $weekAgo = date('Y-m-d H:i:s', $now - 7 * 86400);
        $free    = max(0, $this->reminderDailyCap() - $this->qWaRemindersSince($companyId, date('Y-m-d', $now) . ' 00:00:00'));
        $rows    = [];

        foreach ($this->qCompanyBranches($companyId) as $b) {
            $branchId = (int) $b['id'];
            $debts    = [];

            foreach ($this->qWaDebtSales($branchId) as $s) {
                $credit = (int) $s['sale_type_id'] === 3;
                $paid   = round((float) $s['paid'], 2);
                $left   = round((float) $s['total'] + ($credit ? (float) $s['tip'] : 0) - $paid, 2);

                if ($left <= 0.005) continue;

                // Cotizacion sin anticipo: todavia no debe nada (asi lo ve el portal).
                if (!$credit && (int) $s['sale_status_id'] !== 2 && $paid <= 0.005) continue;

                $id = (int) $s['customer_id'];

                if (!isset($debts[$id])) $debts[$id] = ['debt' => 0, 'folios' => 0];

                $debts[$id]['debt'] += $left;
                $debts[$id]['folios']++;
            }

            if (!$debts) continue;

            foreach ($this->qWaReminderCustomers(array_keys($debts), $branchId) as $c) {
                $phone = WhatsAppMeta::localPhone($c['phone']);

                $rows[] = [
                    'customer_id' => (int) $c['id'],
                    'name'        => trim((string) $c['name']),
                    'phone'       => preg_match('/^\d{10}$/', $phone) ? $phone : '',
                    'raw_phone'   => trim((string) $c['phone']),
                    'branch_id'   => $branchId,
                    'branch'      => (string) $b['name'],
                    'debt'        => round($debts[(int) $c['id']]['debt'], 2),
                    'folios'      => $debts[(int) $c['id']]['folios'],
                    'chat_id'     => null,
                    'last'        => '',
                    'opt_out_at'  => '',
                    'other'       => '',
                    'state'       => ''
                ];
            }
        }

        if (!$rows) return [];

        $phones = array_values(array_unique(array_filter(array_column($rows, 'phone'))));
        $chats  = $this->qWaChatsByPhone($companyId, $phones);
        $last   = $this->qWaLastReminders($companyId, $phones);

        // La deuda mayor primero: si alguien debe en dos sucursales, sale ese.
        usort($rows, function ($a, $b) {
            return $b['debt'] <=> $a['debt'] ?: strcmp($a['name'], $b['name']);
        });

        $taken = [];

        foreach ($rows as &$r) {
            $chat = $r['phone'] !== '' ? ($chats[$r['phone']] ?? null) : null;

            $r['chat_id']    = $chat ? (int) $chat['id'] : null;
            $r['last']       = $r['phone'] !== '' ? ($last[$r['phone']] ?? '') : '';
            $r['opt_out_at'] = $chat && $chat['opt_out_at'] !== null ? (string) $chat['opt_out_at'] : '';

            $key = 'c' . $r['customer_id'];

            if ($r['phone'] === '')                                $r['state'] = 'phone';
            else if ($chat && (int) $chat['opt_out'] === 1)        $r['state'] = 'baja';
            else if ($r['last'] !== '' && $r['last'] >= $weekAgo)  $r['state'] = 'week';
            else if (isset($taken[$key]) || isset($taken['p' . $r['phone']])) {
                $r['state'] = 'other';
                $r['other'] = $taken[$key] ?? $taken['p' . $r['phone']];
            }
            else if ($free <= 0)                                   $r['state'] = 'cap';
            else {
                $r['state'] = 'send';
                $taken[$key] = $taken['p' . $r['phone']] = $r['branch'];
                $free--;
            }
        }
        unset($r);

        return $rows;
    }

    /*  Manda el recordatorio de una fila de reminderList (state 'send').
        $userId null = el cron. Devuelve ['status' => sent|simulated|failed|skip, 'detail']. */
    protected function reminderSend(array $agent, array $row, $userId = null) {
        $companyId = (int) $agent['company_id'];
        $base      = $this->agentPublicBase();

        if ($base === '') return ['status' => 'skip', 'detail' => 'Falta WHATSAPP_PUBLIC_URL en el .env para armar el enlace del portal.'];

        $portal = $this->reminderPortal((int) $row['customer_id'], (int) $row['branch_id']);
        if (!$portal) return ['status' => 'skip', 'detail' => 'No se pudo crear el enlace del portal del cliente.'];

        $company = $this->qCompany($companyId);
        $params  = [
            $this->waFirstName($row['name']),
            $this->waBusinessLabel($company ? $company['name'] : '', $row['branch']),
            $this->agentMoney($row['debt']),
            $base . '/portal.php?t=' . rawurlencode((string) $portal['token'])
        ];

        $text    = $this->waTemplateFill('saldo', $params);
        $now     = $this->inboxNow();
        $stamp   = date('Y-m-d H:i:s', $now);
        $weekAgo = date('Y-m-d H:i:s', $now - 7 * 86400);
        $waId    = ($this->inboxMeta()->status()['simulated'] ? 'SIM-52' : '52') . $row['phone'];
        $name    = mb_substr((string) $row['name'], 0, 120, 'UTF-8');

        $claim = $this->transaction(function () use ($companyId, $row, $waId, $name, $text, $userId, $stamp, $weekAgo) {
            $chat = $this->qWaReminderChat($companyId, $row['phone'], $waId, $name, $stamp);

            if (!$chat) throw new RuntimeException('recordatorio: no se pudo abrir el chat');

            if ((int) $chat['opt_out'] === 1) return ['skip' => 'El cliente escribió BAJA.'];

            $last = $this->qWaLastReminderOf($companyId, $row['phone']);
            if ($last !== '' && $last >= $weekAgo) return ['skip' => 'Ya recibió un recordatorio esta semana.'];

            $this->qWaChooseBranch((int) $chat['id'], (int) $row['branch_id'], $stamp);

            $messageId = $this->waTemplateClaim($chat, $text, $userId, $stamp);

            $this->inboxMust($this->qCreateWaReminder([
                'values' => ['company_id', 'branch_id', 'customer_id', 'chat_id', 'phone', 'amount', 'message_id', 'status', 'user_id', 'created_at'],
                'data'   => [$companyId, (int) $row['branch_id'], (int) $row['customer_id'], (int) $chat['id'], $row['phone'], $row['debt'], $messageId, 'sending', $userId ?: null, $stamp]
            ]), 'wa_reminder');

            return ['chat' => $chat, 'message_id' => $messageId, 'id' => $this->qLastInsertId()];
        });

        if (isset($claim['skip'])) return ['status' => 'skip', 'detail' => $claim['skip']];

        $sent = $this->waTemplateDeliver($agent, $claim['chat'], 'saldo', $params, $claim['message_id']);

        $this->qWaFinishReminder((int) $claim['id'], $sent['status'], (string) $sent['detail']);

        return ['status' => $sent['status'], 'detail' => (string) $sent['detail']];
    }

    /*  Manda los de hoy de la empresa, en horario. $max: cuantos en esta
        vuelta; $until (timestamp): no empieza otro despues.
        Devuelve ['sent', 'simulated', 'failed', 'skip', 'detail']. */
    protected function reminderRun($companyId, $userId = null, $max = 20, $until = null) {
        $out   = ['sent' => 0, 'simulated' => 0, 'failed' => 0, 'skip' => 0, 'detail' => ''];
        $agent = $this->qWaReminderAgent($companyId);

        if (!$agent || !$this->inboxIsOpen($agent)) return $out;

        foreach ($this->reminderList($companyId) as $row) {
            if ($row['state'] !== 'send') continue;
            if ($max-- <= 0) break;
            if ($until !== null && time() >= $until) break;

            try {
                $r = $this->reminderSend($agent, $row, $userId);
            } catch (Throwable $e) {
                $this->inboxLog("[ RECORDATORIO ] :: cliente {$row['customer_id']} :: " . $e->getMessage());
                $r = ['status' => 'failed', 'detail' => 'No se pudo mandar.'];
            }

            $out[$r['status']] = ($out[$r['status']] ?? 0) + 1;

            if ($r['status'] !== 'sent' && $r['status'] !== 'simulated' && $out['detail'] === '') $out['detail'] = $r['detail'];

            // Sin enlace publico ninguno puede salir: no tiene caso seguir.
            if ($r['status'] === 'skip' && strpos($r['detail'], 'WHATSAPP_PUBLIC_URL') !== false) break;
        }

        return $out;
    }

    // El cron: solo con el automatico encendido y en horario. Devuelve cuantos salieron.
    protected function reminderSweep($companyId, $until = null) {
        $agent = $this->qWaReminderAgent($companyId);

        if (!$agent || (int) $agent['reminders'] !== 1 || !$this->inboxIsOpen($agent)) return 0;

        $r = $this->reminderRun($companyId, null, 20, $until);

        if ($r['detail'] !== '' && ($r['failed'] || $r['skip'])) $this->inboxLog("[ RECORDATORIO ] :: empresa {$companyId} :: {$r['detail']}");

        return $r['sent'] + $r['simulated'];
    }

    // El enlace del portal del cliente en esa sucursal; la primera vez se crea (igual que Clientes › Comprobantes).
    private function reminderPortal($customerId, $branchId) {
        $portal = $this->qPortal($customerId, $branchId);
        if ($portal) return $portal;

        $stamp = date('Y-m-d H:i:s', $this->inboxNow());

        try {
            $this->qCreatePortal([
                'values' => ['customer_id', 'branch_id', 'token', 'created_at', 'updated_at'],
                'data'   => [$customerId, $branchId, $this->agentPortalToken(), $stamp, $stamp]
            ]);
        } catch (Throwable $e) {
            $this->inboxLog('[ RECORDATORIO ] :: portal :: ' . $e->getMessage());
        }

        return $this->qPortal($customerId, $branchId);
    }

    // -- Ya abrimos --

    /*  '' = se puede mandar «Ya abrimos»; si no, por que:
          window    la ventana de 24 h sigue abierta (se contesta normal)
          answered  lo ultimo del chat ya es nuestro, o es un BAJA / ALTA (no espera respuesta)
          baja      escribio BAJA y no ha vuelto a escribir
          agent     la empresa no tiene numero
          closed    el agente esta fuera de horario
        $last = qWaLastMessage() (o lo mismo armado con el hilo). */
    protected function reopenBlock(array $chat, $agent, $last) {
        if ($this->inboxWindowOpen($chat['last_in_at']))                return 'window';
        if (!$last || $last['dir'] !== 'in')                            return 'answered';
        if ($this->inboxKeyword($last['body']) !== '')                  return 'answered';

        if ((int) $chat['opt_out'] === 1
            && ($chat['opt_out_at'] === null || $chat['last_in_at'] === null || (string) $chat['last_in_at'] <= (string) $chat['opt_out_at'])) {
            return 'baja';
        }

        if (!$agent)                     return 'agent';
        if (!$this->inboxIsOpen($agent)) return 'closed';

        return '';
    }

    // Los valores de «Ya abrimos» para ese chat (qWaChat: name, branch, company_id).
    protected function reopenParams(array $chat) {
        $company = $this->qCompany((int) $chat['company_id']);

        return [
            $this->waFirstName($chat['name']),
            $this->waBusinessLabel($company ? $company['name'] : '', $chat['branch'] ?? '')
        ];
    }
}
