<?php
/*  Respuestas que salen solas y metricas del agente (F6 del plan de WhatsApp).

    Va con WhatsAppAgentAI (mdl-whatsapp-ia.php), que es quien decide si una
    propuesta sale sola, y con WhatsAppInbox + WhatsAppAgentFlow sobre la
    clase mdl. Lo usan ctrl-whatsapp.php y cron-whatsapp-agente.php.

    Reglas que no se ven en el codigo de un vistazo:
      - Cada propuesta lleva un tema segun lo que consulto (wa_proposal.topic):
        negocio (horario, direccion, pago), catalogo, pedidos, saldo,
        comprobante, persona (paso a una persona), charla (no consulto nada) y
        dueno (agente del dueño). Si consulto varias cosas, gana la mas
        delicada: comprobante > persona > saldo > pedidos > catalogo > negocio.
      - Solo negocio y catalogo pueden salir solos (wa_agent.auto_topics). Para
        que salga sola: armada por el barrido (no a mano), lista ('pending'),
        sin pedido ni paso a persona, todo lo que consulto es de temas en
        automatico, ninguna consulta fallo, y al mandarla sigue siendo la
        respuesta al ultimo mensaje del cliente sin que una persona haya
        contestado. Lo demas se queda en la bandeja como siempre.
      - Saldo, pedidos, comprobantes y lo que no consulto nada siempre pasan
        por una persona: tocan dinero o datos del cliente, o el modelo pudo
        contestar sin datos.
      - La que sale sola queda 'sent' con auto_sent = 1 y sin decided_by; su
        mensaje lleva user_id NULL (el agente).
      - Metricas: una «conversacion» es un chat con mensajes del cliente en un
        dia. Sin persona = el agente contesto solo, no quedo nada del cliente
        sin respuesta, y nadie de la sucursal escribio ni se paso a una
        persona ese dia. El tiempo de respuesta va
        del primer mensaje del cliente sin contestar a la primera respuesta
        (del agente sola o de una persona); el menu de sucursales y las
        plantillas no cuentan como respuesta. Los chats del dueño van aparte.
      - TODO es protected o private: Permission::dispatch despacha cualquier
        metodo publico del ctrl, tambien los de un trait. */
trait WhatsAppAgentAuto {

    // -- Consultas --

    // Solo si sigue 'pending': si una persona la decidio mientras tanto, se queda como la dejo.
    protected function qWaAutoDecide($id, $now) {
        $this->qWaRun("
            UPDATE {$this->crm}wa_proposal
            SET status = 'sent', auto_sent = 1, decided_by = NULL, decided_at = ?
            WHERE id = ? AND status = 'pending'
        ", [$now, $id]);
    }

    protected function qWaMetricProposals($companyId, $from, $to) {
        return $this->qRows("
            SELECT p.id, p.chat_id, IFNULL(p.kind, 'customer') AS kind, p.status, IFNULL(p.auto_sent, 0) AS auto_sent,
                   p.topic, IFNULL(p.tools_used, '') AS tools_used, IFNULL(p.action, '') AS action,
                   p.decided_by, p.requested_by, p.elapsed_ms, p.created_at
            FROM {$this->crm}wa_proposal p
            INNER JOIN {$this->crm}wa_chat c ON c.id = p.chat_id
            WHERE c.company_id = ? AND p.created_at >= ? AND p.created_at < ?
            ORDER BY p.id
            LIMIT 20000
        ", [$companyId, $from, $to]);
    }

    // auto = el mensaje es una propuesta que salio sola.
    protected function qWaMetricMessages($companyId, $from, $to) {
        return $this->qRows("
            SELECT m.id, m.chat_id, m.direction, m.type, LEFT(IFNULL(m.body, ''), 20) AS body, m.user_id, m.sent_at,
                   EXISTS (SELECT 1 FROM {$this->crm}wa_proposal p WHERE p.sent_message_id = m.id AND p.auto_sent = 1) AS auto
            FROM {$this->crm}wa_message m
            INNER JOIN {$this->crm}wa_chat c ON c.id = m.chat_id
            WHERE c.company_id = ? AND m.sent_at >= ? AND m.sent_at < ?
            ORDER BY m.chat_id, m.id
            LIMIT 50000
        ", [$companyId, $from, $to]);
    }

    // Los chats de numeros del equipo con «Pregunta» (agente del dueño).
    protected function qWaOwnerChatIds($companyId) {
        return array_map('intval', array_column($this->qRows("
            SELECT c.id
            FROM {$this->crm}wa_chat c
            WHERE c.company_id = ?
                AND EXISTS (
                    SELECT 1 FROM {$this->crm}wa_recipient r
                    WHERE r.company_id = c.company_id AND r.phone = c.phone AND r.active = 1 AND IFNULL(r.can_ask, 0) = 1
                )
        ", [$companyId]), 'id'));
    }

    // -- Temas --

    // Los temas en el orden de la pantalla; auto = puede salir solo.
    protected function agentTopicList() {
        return [
            'negocio'     => ['name' => 'Horario, dirección y pago', 'auto' => true],
            'catalogo'    => ['name' => 'Catálogo y precios', 'auto' => true],
            'pedidos'     => ['name' => 'Pedidos', 'auto' => false],
            'saldo'       => ['name' => 'Saldo y portal', 'auto' => false],
            'comprobante' => ['name' => 'Comprobantes de pago', 'auto' => false],
            'persona'     => ['name' => 'Pasar a una persona', 'auto' => false],
            'charla'      => ['name' => 'Sin consultar datos', 'auto' => false],
            'dueno'       => ['name' => 'Preguntas del dueño', 'auto' => false]
        ];
    }

    // Los temas en automatico de la empresa (solo los que pueden salir solos).
    protected function agentAutoTopics($agent) {
        $list = $this->agentTopicList();
        $out  = [];

        foreach (explode(',', (string) ($agent['auto_topics'] ?? '')) as $key) {
            $key = trim($key);

            if (isset($list[$key]) && $list[$key]['auto'] && !in_array($key, $out, true)) $out[] = $key;
        }

        return $out;
    }

    /*  El tema de una propuesta por lo que consulto. $tools = wa_proposal.tools_used
        (ya decodificado); $action 'order' | 'handoff' | ''.
        Devuelve ['topic', 'all' (los de cada consulta), 'clean' (ninguna fallo)]. */
    protected function agentTopicOf(array $tools, $action = '') {
        $rank  = ['negocio' => 1, 'catalogo' => 2, 'pedidos' => 3, 'saldo' => 4, 'persona' => 5, 'comprobante' => 6];
        $map   = [
            'negocio_datos'   => 'negocio', 'catalogo_buscar' => 'catalogo', 'pedido_estado' => 'pedidos', 'pedido_borrador' => 'pedidos',
            'saldo_cliente'   => 'saldo', 'portal_enlace' => 'saldo', 'pasar_a_persona' => 'persona', 'comprobante_guardar' => 'comprobante',
            'ventas_hoy'      => 'dueno', 'turno_estado' => 'dueno', 'pedidos_pendientes' => 'dueno', 'cartera' => 'dueno'
        ];
        $all   = [];
        $clean = true;

        foreach ($tools as $t) {
            if (!is_array($t)) continue;

            $topic = $map[(string) ($t['name'] ?? '')] ?? 'charla';

            if (!in_array($topic, $all, true)) $all[] = $topic;
            if (!empty($t['failed'])) $clean = false;
        }

        if ($action === 'order' && !in_array('pedidos', $all, true)) $all[] = 'pedidos';
        if ($action === 'handoff' && !in_array('persona', $all, true)) $all[] = 'persona';

        if (in_array('dueno', $all, true)) return ['topic' => 'dueno', 'all' => $all, 'clean' => $clean];
        if (!$all) return ['topic' => 'charla', 'all' => [], 'clean' => $clean];

        $topic = 'charla';
        $best  = 0;

        foreach ($all as $key) {
            if (($rank[$key] ?? 0) > $best) {
                $best  = $rank[$key];
                $topic = $key;
            }
        }

        return ['topic' => $topic, 'all' => $all, 'clean' => $clean];
    }

    // Sale sola: consulto algo, nada fallo, sin pedido ni paso a persona y todo de temas en automatico.
    protected function agentAutoAllowed($agent, array $topic, $action = '') {
        if ($action !== '' && $action !== null) return false;
        if (!$topic['all'] || !$topic['clean']) return false;

        $on = $this->agentAutoTopics($agent);
        if (!$on) return false;

        foreach ($topic['all'] as $key) {
            if (!in_array($key, $on, true)) return false;
        }

        return true;
    }

    /*  Manda sola una propuesta lista. La marca 'sent' con el chat apartado y
        despues manda: dos barridos a la vez no la mandan dos veces. No sale si
        el cliente ya escribio otra cosa, si una persona contesto, si cerro la
        ventana o el horario, o si el chat paso a una persona. Devuelve lo de
        inboxSend() (con message_id) o null si no salio. */
    protected function agentAutoSend($companyId, array $chat, $proposalId) {
        $now    = date('Y-m-d H:i:s', $this->inboxNow());
        $chatId = (int) $chat['id'];

        $claim = $this->transaction(function () use ($companyId, $chatId, $proposalId, $now) {
            if (!$this->qWaLockChatById($chatId)) return null;

            $p = $this->qWaLockProposal($proposalId, $companyId);
            if (!$p || $p['status'] !== 'pending' || trim((string) $p['body']) === '' || $p['action'] !== '') return null;

            $last = $this->qWaLastIn($chatId);
            if (!$last || (int) $last['id'] !== (int) $p['message_id']) return null;
            if ($this->qWaAnswered($chatId, (int) $p['message_id'])) return null;

            $fresh = $this->qWaChatAI($chatId, $companyId);
            $agent = $this->qWaAgentAI($companyId);

            if (!$fresh || !$agent || !$this->inboxIsOpen($agent) || !$this->inboxWindowOpen($fresh['last_in_at'])) return null;
            if ($this->agentIsHuman($fresh)) return null;

            $this->qWaAutoDecide($proposalId, $now);

            return ['body' => (string) $p['body'], 'agent' => $agent, 'chat' => $fresh];
        });

        if (!$claim) return null;

        $sent = $this->inboxSend($claim['agent'], $claim['chat'], $claim['body'], null);

        try {
            $this->qWaSetProposalMessage($proposalId, (int) $sent['message_id']);
        } catch (Throwable $e) {
            $this->inboxLog("[ AUTOMATICO ] :: propuesta {$proposalId} :: " . $e->getMessage());
        }

        return $sent;
    }

    // -- Metricas --

    /*  Lo del periodo [$from, $to): conversaciones con y sin persona, tiempo de
        respuesta, propuestas por tema y preguntas del dueño. */
    protected function agentMetrics($companyId, $from, $to) {
        $owners  = array_flip($this->qWaOwnerChatIds($companyId));
        $props   = $this->qWaMetricProposals($companyId, $from, $to);
        $list    = $this->agentTopicList();
        $autoOn  = $this->agentAutoTopics($this->qWaAgentAI($companyId));
        $topics  = [];
        $handoff = [];
        $owner   = ['answered' => 0, 'pending' => 0, 'failed' => 0, 'ms' => []];

        foreach ($list as $key => $t) {
            $topics[$key] = ['key' => $key, 'name' => $t['name'], 'can_auto' => $t['auto'], 'auto_on' => in_array($key, $autoOn, true),
                             'total' => 0, 'auto' => 0, 'sent' => 0, 'edited' => 0, 'discarded' => 0, 'failed' => 0, 'pending' => 0];
        }

        foreach ($props as $p) {
            $status = (string) $p['status'];
            if ($status === 'working') continue;

            // Descartada sola (no habia nada que contestar o llego otra mas nueva): no cuenta.
            if ($status === 'discarded' && $p['decided_by'] === null) continue;

            $isOwner = $p['kind'] === 'owner';
            $topic   = (string) $p['topic'];

            // Las de antes de F6 no traen tema: sale de lo que consultaron.
            if ($topic === '' || !isset($topics[$topic])) {
                $used  = json_decode((string) $p['tools_used'], true);
                $topic = $isOwner ? 'dueno' : $this->agentTopicOf(is_array($used) ? $used : [], (string) $p['action'])['topic'];
            }

            if ($p['action'] === 'handoff') $handoff[(int) $p['chat_id'] . '|' . substr((string) $p['created_at'], 0, 10)] = true;

            if ($isOwner) {
                if ((int) $p['auto_sent'] === 1 || in_array($status, ['sent', 'edited'], true)) $owner['answered']++;
                else if ($status === 'failed') $owner['failed']++;
                else if ($status === 'pending') $owner['pending']++;

                if ((int) $p['auto_sent'] === 1 && $p['elapsed_ms'] !== null) $owner['ms'][] = (int) $p['elapsed_ms'];
            }

            $row = &$topics[$topic];
            $row['total']++;

            if ((int) $p['auto_sent'] === 1) $row['auto']++;
            else if ($status === 'sent')     $row['sent']++;
            else if ($status === 'edited')   $row['edited']++;
            else if ($status === 'discarded') $row['discarded']++;
            else if ($status === 'failed')   $row['failed']++;
            else if ($status === 'pending')  $row['pending']++;

            unset($row);
        }

        // Conversaciones (chat + dia) y tiempos de respuesta, sin los chats del dueño.
        $days    = [];
        $times   = ['agent' => [], 'person' => []];
        $waiting = [];

        foreach ($this->qWaMetricMessages($companyId, $from, $to) as $m) {
            $chatId = (int) $m['chat_id'];
            if (isset($owners[$chatId])) continue;

            $stamp = strtotime((string) $m['sent_at']);
            $key   = $chatId . '|' . substr((string) $m['sent_at'], 0, 10);

            if ($m['direction'] === 'in') {
                if ($this->inboxKeyword($m['body']) !== '') continue;

                if (!isset($days[$key])) $days[$key] = ['agent' => false, 'person' => false, 'open' => false];
                if (!isset($waiting[$chatId])) $waiting[$chatId] = $stamp;

                // Hasta que alguien conteste, ese dia queda con una pregunta abierta.
                $days[$key]['open'] = true;

                continue;
            }

            $who = (int) $m['auto'] === 1 ? 'agent' : ($m['user_id'] !== null && $m['type'] === 'text' ? 'person' : '');
            if ($who === '') continue;

            if (isset($days[$key])) {
                $days[$key][$who]   = true;
                $days[$key]['open'] = false;
            }

            if (isset($waiting[$chatId])) {
                $times[$who][] = max(0, $stamp - $waiting[$chatId]);
                unset($waiting[$chatId]);
            }
        }

        $conv = ['total' => count($days), 'agent' => 0, 'person' => 0, 'none' => 0];

        // Sin persona = el agente contesto y no quedo nada del cliente sin respuesta ese dia.
        foreach ($days as $key => $d) {
            if ($d['person'] || isset($handoff[$key])) $conv['person']++;
            else if ($d['agent'] && !$d['open'])       $conv['agent']++;
            else                                       $conv['none']++;
        }

        $conv['pct_agent'] = $conv['total'] > 0 ? round($conv['agent'] * 100 / $conv['total'], 1) : null;

        return [
            'conversations' => $conv,
            'response'      => [
                'agent'  => ['count' => count($times['agent']), 'median' => $this->agentMedian($times['agent'])],
                'person' => ['count' => count($times['person']), 'median' => $this->agentMedian($times['person'])]
            ],
            'topics'        => array_values($topics),
            'owner'         => [
                'answered'  => $owner['answered'],
                'pending'   => $owner['pending'],
                'failed'    => $owner['failed'],
                'median_ms' => $this->agentMedian($owner['ms'])
            ],
            'auto_on'       => $autoOn
        ];
    }

    // null sin datos.
    private function agentMedian(array $values) {
        if (!$values) return null;

        sort($values);

        $n   = count($values);
        $mid = intdiv($n, 2);

        return $n % 2 ? $values[$mid] : (int) round(($values[$mid - 1] + $values[$mid]) / 2);
    }
}
