<?php
require_once __DIR__ . '/../../../core/helpers/_WhatsApp.php';

/*  Agente de clientes: pedidos, pasar a una persona y comprobantes por chat
    (F4 del plan de WhatsApp).

    Va con WhatsAppAgentAI (mdl-whatsapp-ia.php), que es quien llama a estas
    tres herramientas, y con WhatsAppInbox + WhatsAppAgentFlow, OnlineStore y
    CustomerPortal sobre la clase mdl. Lo usan ctrl-whatsapp.php (bandeja) y
    cron-whatsapp-agente.php; el webhook no.

    Reglas que no se ven en el codigo de un vistazo:
      - pedido_borrador NO escribe nada: revisa lo que pide el cliente contra el
        catalogo del agente y deja el borrador en la propuesta
        (wa_proposal.action = 'order'). El pedido se crea cuando una persona
        MANDA la propuesta (agentOrderCreate), y ahi se revisa todo otra vez:
        si un producto salio del catalogo o cambio de precio, no se crea.
      - El pedido entra igual que uno de la tienda en linea: venta tipo 4 en
        Cotizacion, sin usuario ni turno, con su fila en online_order
        (ip 'whatsapp'). Cae en Tienda en linea › Nuevos y alguien lo acepta.
        Por eso la tienda de la sucursal tiene que estar encendida.
      - Solo productos del catalogo del agente y al precio de hoy. Lo que no
        esta ahi (pastel personalizado, encargo especial) va a pasar_a_persona.
      - pasar_a_persona deja el chat en 'human' 24 h con la nota de lo que
        quiere el cliente (wa_chat.handoff_note): el agente deja de proponer
        solo. Se aplica al armar la propuesta, no al mandarla. Avisa a los
        destinatarios que reciben «Pedido nuevo» (wa_recipient.notify_order)
        por _WhatsApp.php y queda en wa_log con tipo 'handoff'. Un chat del
        simulador no avisa a nadie: queda 'simulated'.
      - Si el cliente pide una persona con todas sus letras, no se llama al
        modelo: la propuesta sale de una regla (model = 'regla').
      - comprobante_guardar SI escribe al armar la propuesta: la foto o el PDF
        mas reciente del chat (24 h) pasa a customer_receipt en 'pending', igual
        que uno subido en el portal. Una foto da un solo comprobante
        (wa_message.receipt_id) y un cliente tiene a lo mas 3 en revision.
        Descartar la propuesta no lo borra: se revisa en Clientes › Comprobantes.
      - TODO es protected o private: Permission::dispatch despacha cualquier
        metodo publico del ctrl, tambien los de un trait. */
trait WhatsAppAgentOrders {

    // -- Consultas --

    // Quien recibe «Pedido nuevo» en esa sucursal (o en todas): a ellos se les avisa que un cliente pide una persona.
    protected function qWaHandoffRecipients($companyId, $branchId) {
        return $this->qRows("
            SELECT id, IFNULL(name, '') AS name, phone
            FROM {$this->crm}wa_recipient
            WHERE company_id = ?
                AND (branch_id IS NULL OR branch_id = ?)
                AND active = 1
                AND notify_order = 1
            ORDER BY id
        ", [$companyId, $branchId]);
    }

    protected function qWaSetHuman($chatId, $until, $note, $now) {
        $this->qWaRun("
            UPDATE {$this->crm}wa_chat
            SET mode = 'human', human_until = ?, handoff_note = ?, updated_at = ?
            WHERE id = ?
        ", [$until, $note, $now, $chatId]);
    }

    // «Devolver al agente»: vuelve a proponer solo y se borra la nota.
    protected function qWaAgentBack($chatId, $now) {
        $this->qWaRun("
            UPDATE {$this->crm}wa_chat
            SET mode = 'agent', human_until = NULL, handoff_note = NULL, updated_at = ?
            WHERE id = ?
        ", [$now, $chatId]);
    }

    // Solo si el chat todavia no tiene cliente: el que puso una persona no se pisa.
    protected function qWaSetChatCustomer($chatId, $customerId, $now) {
        $this->qWaRun("
            UPDATE {$this->crm}wa_chat
            SET customer_id = ?, updated_at = ?
            WHERE id = ? AND customer_id IS NULL
        ", [$customerId, $now, $chatId]);
    }

    protected function qWaSetProposalSale($id, $saleId) {
        $this->qWaRun("UPDATE {$this->crm}wa_proposal SET sale_id = ? WHERE id = ?", [$saleId, $id]);
    }

    // La foto o el documento mas reciente que mando el cliente desde $since.
    protected function qWaLastMedia($chatId, $since) {
        return $this->qRow("
            SELECT id, type, IFNULL(media_id, '') AS media_id, IFNULL(media_type, '') AS media_type,
                   IFNULL(media_path, '') AS media_path, receipt_id
            FROM {$this->crm}wa_message
            WHERE chat_id = ? AND direction = 'in' AND type IN ('image', 'document') AND sent_at >= ?
            ORDER BY id DESC
            LIMIT 1
        ", [$chatId, $since]);
    }

    // Dentro de transaction(): el mensaje queda apartado hasta el commit.
    protected function qWaLockMessage($id) {
        return $this->qRow("
            SELECT id, receipt_id
            FROM {$this->crm}wa_message
            WHERE id = ?
            LIMIT 1
            FOR UPDATE
        ", [$id]);
    }

    protected function qWaSetMessageReceipt($id, $receiptId) {
        $this->qWaRun("
            UPDATE {$this->crm}wa_message
            SET receipt_id = ?
            WHERE id = ? AND receipt_id IS NULL
        ", [$receiptId, $id]);
    }

    // -- Catalogo propio del agente --

    protected function qWaAgentProductIds($companyId) {
        $ids = [];

        foreach ($this->qRows("SELECT product_id FROM {$this->crm}wa_agent_product WHERE company_id = ? ORDER BY product_id", [$companyId]) as $row) {
            $ids[] = (int) $row['product_id'];
        }

        return $ids;
    }

    /*  Dentro de transaction(): cambia la lista completa. Solo entran productos
        de la empresa que Pedidos sabe vender (activos, no personalizados, no
        paquetes): un id que no cumple se queda fuera sin avisar. */
    protected function qWaReplaceAgentProducts($companyId, array $ids, $now) {
        $this->qWaRun("DELETE FROM {$this->crm}wa_agent_product WHERE company_id = ?", [$companyId]);

        if (!$ids) return;

        $this->qWaRun("
            INSERT INTO {$this->crm}wa_agent_product (company_id, product_id, created_at)
            SELECT p.company_id, p.id, ?
            FROM {$this->pos}product p
            WHERE p.company_id = ?
                AND p.id IN ({$this->qIn($ids)})
                AND IFNULL(p.active, 1) = 1
                AND IFNULL(p.is_custom, 0) = 0
                AND p.kind IN ('product', 'service')
        ", array_merge([$now, $companyId], array_values($ids)));
    }

    // Lo que se puede poner en la lista propia: los productos de toda la empresa, con su sucursal.
    protected function qWaCompanyProducts($companyId) {
        return $this->qRows("
            SELECT p.id, p.name, IFNULL(p.price, 0) AS price, IFNULL(TRIM(c.name), '') AS category,
                   p.branch_id, IFNULL(b.name, '') AS branch, IFNULL(p.in_catalog, 0) AS in_catalog
            FROM {$this->pos}product p
            LEFT JOIN {$this->pos}category c ON c.id = p.category_id AND IFNULL(c.active, 1) = 1
            LEFT JOIN {$this->bd}branches b ON b.id = p.branch_id
            WHERE p.company_id = ?
                AND IFNULL(p.active, 1) = 1
                AND IFNULL(p.is_custom, 0) = 0
                AND p.kind IN ('product', 'service')
            ORDER BY (c.id IS NULL), c.name, p.name, p.id
            LIMIT 500
        ", [$companyId]);
    }

    // -- Catalogo del agente --

    /*  Los productos que el agente puede ofrecer y pedir en esa sucursal.
        $ctx: company_id, branch_id, main_id y agent['catalog_mode']. */
    protected function agentCatalogRows(array $ctx) {
        $mode = (string) ($ctx['agent']['catalog_mode'] ?? 'store');

        return $mode === 'own'
            ? $this->agentDedupe($this->qWaAgentProducts($ctx['company_id'], $ctx['branch_id'], $ctx['main_id']), $ctx['branch_id'])
            : $this->qStoreProducts($ctx['company_id'], $ctx['branch_id'], $ctx['main_id'], true);
    }

    // -- pedido_borrador --

    /*  Revisa el pedido que arma el modelo. No escribe nada.
          falta algo       listo false + falta / problemas
          completo         listo true, confirmado false + resumen
          confirmado       ademas _action 'order' (agentRun lo saca: no viaja al modelo) */
    protected function agentDraft(array $keep, array $ctx) {
        $handoff = ' Usa pasar_a_persona con lo que quiere el cliente.';
        $store   = $this->qStore($ctx['branch_id']);

        if (!$store || (int) $store['active'] !== 1) {
            return ['listo' => false, 'nota' => 'Esta sucursal no recibe pedidos por este medio.' . $handoff];
        }

        if ($ctx['phone10'] === '') {
            return ['listo' => false, 'nota' => 'No se puede registrar el pedido con este teléfono.' . $handoff];
        }

        $rows = $this->agentCatalogRows($ctx);

        if (!$rows) return ['listo' => false, 'nota' => 'El catálogo del agente está vacío.' . $handoff];

        $missing  = [];
        $problems = [];
        $lines    = [];
        $items    = isset($keep['productos']) && is_array($keep['productos']) ? $keep['productos'] : [];

        if (!$items) $missing[] = 'qué productos quiere';

        foreach ($items as $item) {
            $asked = (string) $item['nombre'];
            $match = $this->agentDraftMatch($asked, $rows);

            if (!isset($match['row'])) {
                $problems[] = $match['options']
                    ? "«{$asked}» puede ser: " . implode(', ', $match['options']) . '. Pregúntale cuál.'
                    : "«{$asked}» no está en el catálogo: si lo quiere así, usa pasar_a_persona.";
                continue;
            }

            $row   = $match['row'];
            $id    = (int) $row['id'];
            $qty   = (int) $item['cantidad'];
            $price = round((float) $row['price'], 2);
            $name  = trim((string) $row['name']);

            if ($qty < 1) {
                $problems[] = "Falta cuántas piezas quiere de «{$name}».";
                continue;
            }

            if ($price <= 0) {
                $problems[] = "«{$name}» no tiene precio en el catálogo: usa pasar_a_persona.";
                continue;
            }

            if (isset($lines[$id])) $lines[$id]['quantity'] += $qty;
            else $lines[$id] = ['product_id' => $id, 'name' => $name, 'price' => $price, 'quantity' => $qty];
        }

        foreach ($lines as $line) {
            if ($line['quantity'] > 999) $problems[] = "De «{$line['name']}» se piden hasta 999 piezas.";
        }

        // Entrega y pago: lo que la tienda de la sucursal acepta. Con una sola opcion, es esa.
        $way = $this->agentDraftOption(
            $this->agentDraftWay($keep['entrega'] ?? ''),
            ['pickup' => (int) $store['pickup'] === 1, 'delivery' => (int) $store['delivery'] === 1],
            ['pickup' => 'Esta sucursal no hace envíos: el pedido se recoge en la sucursal.', 'delivery' => 'Esta sucursal solo entrega a domicilio.'],
            'si lo recoge en la sucursal o es a domicilio',
            $missing, $problems
        );

        $pay = $this->agentDraftOption(
            $this->agentDraftPay($keep['pago'] ?? ''),
            ['store' => (int) $store['pay_store'] === 1, 'transfer' => (int) $store['pay_transfer'] === 1],
            ['store' => 'Esta sucursal no recibe transferencias: el pedido se paga en la sucursal.', 'transfer' => 'Esta sucursal solo recibe el pago por transferencia.'],
            'si paga por transferencia o en la sucursal',
            $missing, $problems
        );

        $now   = $this->inboxNow();
        $today = date('Y-m-d', $now);
        $lead  = max(0, (int) $store['lead_days']);
        $first = date('Y-m-d', strtotime("+{$lead} days", $now));
        $last  = date('Y-m-d', strtotime('+90 days', $now));
        $date  = '';
        $time  = '';

        if (trim((string) ($keep['fecha'] ?? '')) === '') {
            $missing[] = 'qué día lo quiere';
        } else {
            $date = $this->agentDraftDate($keep['fecha'], $now);

            if ($date === '') {
                $problems[] = 'No se entendió la fecha: pásala como AAAA-MM-DD.';
            } else if ($date < $first) {
                $problems[] = $lead === 0
                    ? 'La fecha de entrega no puede ser anterior a hoy.'
                    : 'Se piden ' . ($lead === 1 ? '1 día' : "{$lead} días") . ' de anticipación: la primera fecha disponible es el ' . $this->agentDayText($first) . '.';
                $date = '';
            } else if ($date > $last) {
                $problems[] = 'Se reciben pedidos hasta con 90 días de anticipación.';
                $date = '';
            }
        }

        if (trim((string) ($keep['hora'] ?? '')) === '') {
            $missing[] = 'a qué hora lo quiere';
        } else {
            $time = $this->agentDraftTime($keep['hora']);

            if ($time === '') {
                $problems[] = 'No se entendió la hora: pásala en 24 horas, como 17:30. Si no dijo si es de la mañana o de la tarde, pregúntale.';
            } else if ($date === $today && $time <= date('H:i:s', $now)) {
                $problems[] = 'Para hoy, la hora tiene que ser más tarde que la actual.';
                $time = '';
            }
        }

        $address = trim((string) preg_replace('/\s+/u', ' ', (string) ($keep['direccion'] ?? '')));
        $note    = trim((string) ($keep['nota'] ?? ''));

        if ($way === 'delivery' && $address === '') $missing[] = 'la dirección de entrega';

        $name = $this->agentDraftName($keep['nombre'] ?? '');
        if ($name === '' && $ctx['customer']) $name = $this->agentDraftName($ctx['customer']['name']);
        if ($name === '') $name = $this->agentDraftName($ctx['chat_name']);

        if (mb_strlen($name, 'UTF-8') < 2) $missing[] = 'a nombre de quién va el pedido';

        $total = 0;
        $shown = [];

        foreach ($lines as $line) {
            $total  += $line['price'] * $line['quantity'];
            $shown[] = $line['quantity'] . ' × ' . $line['name'] . ' (' . $this->agentMoney($line['price']) . ' c/u)';
        }

        $total = round($total, 2);

        if ($missing || $problems) {
            $out = ['listo' => false];

            if ($shown)    $out['productos'] = $shown;
            if ($missing)  $out['falta']     = $missing;
            if ($problems) $out['problemas'] = $problems;

            $out['siguiente'] = 'Pregúntale al cliente lo que falta en una sola pregunta breve. Todavía no hay pedido: no digas que quedó hecho.';

            return $out;
        }

        $summary = [
            'productos'   => $shown,
            'total'       => $this->agentMoney($total),
            'entrega'     => $way === 'delivery' ? 'Envío a domicilio: ' . $address : 'Recoge en sucursal',
            'fecha'       => $this->agentDayText($date),
            'hora'        => substr($time, 0, 5),
            'pago'        => $pay === 'transfer' ? 'Transferencia' : 'Paga en sucursal',
            'a_nombre_de' => $name
        ];

        if ($note !== '') $summary['nota'] = $note;

        $confirmed = in_array(strtolower((string) ($keep['confirmado'] ?? '')), ['true', '1', 'si', 'sí', 'yes'], true);

        if (!$confirmed) {
            return [
                'listo'      => true,
                'confirmado' => false,
                'resumen'    => $summary,
                'siguiente'  => 'Escríbele el resumen con el total y pregúntale si lo confirma. Cuando diga que sí, vuelve a llamar pedido_borrador con los mismos datos y confirmado = true.'
            ];
        }

        $out = [
            'listo'      => true,
            'confirmado' => true,
            'resumen'    => $summary,
            'siguiente'  => 'Escribe la confirmación con el resumen y un renglón que diga, tal cual: Folio: {folio}. El pedido se registra cuando una persona de la sucursal mande tu mensaje; ahí {folio} se cambia por el folio real. Di que la sucursal lo confirma en breve. No prometas existencias.'
        ];

        $bank = trim((string) $store['bank_info']);
        if ($pay === 'transfer' && $bank !== '') $out['datos_para_transferir'] = mb_substr($bank, 0, 500, 'UTF-8');

        $out['_action'] = ['type' => 'order', 'data' => [
            'branch_id' => (int) $ctx['branch_id'],
            'lines'     => array_values($lines),
            'total'     => $total,
            'delivery'  => $way,
            'payment'   => $pay,
            'date'      => $date,
            'time'      => $time,
            'address'   => $way === 'delivery' ? $address : null,
            'note'      => $note !== '' ? $note : null,
            'name'      => $name,
            'phone'     => $ctx['phone10']
        ]];

        return $out;
    }

    /*  Lo que eligio el cliente contra lo que la tienda acepta. Si la tienda
        acepta una sola opcion, es esa (y se avisa si pidio la otra). */
    private function agentDraftOption($asked, array $allowed, array $only, $question, array &$missing, array &$problems) {
        $open = array_keys(array_filter($allowed));

        if (!$open) {
            $problems[] = 'La tienda de la sucursal no tiene eso configurado: usa pasar_a_persona.';

            return '';
        }

        if (count($open) === 1) {
            if ($asked !== '' && $asked !== $open[0]) $problems[] = $only[$open[0]];

            return $open[0];
        }

        if ($asked === '') $missing[] = $question;

        return $asked;
    }

    /*  El producto del catalogo que pidio: el que se llama igual; si no, el
        unico que tiene todas sus palabras. Varios = opciones para preguntar. */
    private function agentDraftMatch($name, array $rows) {
        $key = $this->inboxFold($name);

        foreach ($rows as $row) {
            if ($this->inboxFold($row['name']) === $key) return ['row' => $row, 'options' => []];
        }

        $words = $this->agentWords($name);
        $hits  = [];

        foreach ($words ? $rows : [] as $row) {
            $hay = $this->inboxFold($row['name'] . ' ' . $row['category']);
            $all = true;

            foreach ($words as $w) {
                if (strpos($hay, $w) === false) {
                    $all = false;
                    break;
                }
            }

            if ($all) $hits[] = $row;
        }

        if (count($hits) === 1) return ['row' => $hits[0], 'options' => []];

        return ['options' => array_map(function ($r) {
            return trim((string) $r['name']) . ' (' . $this->agentMoney($r['price']) . ')';
        }, array_slice($hits, 0, 5))];
    }

    /*  La lista de productos como la mande el modelo: lista de {nombre,
        cantidad}, un solo objeto, JSON en texto o «2 pasteles, 1 gelatina».
        Devuelve [['nombre', 'cantidad']], a lo mas 20. */
    private function agentDraftItems($raw) {
        if (is_string($raw)) {
            $text = trim($raw);
            $json = $text !== '' && ($text[0] === '[' || $text[0] === '{') ? json_decode($text, true) : null;
            $raw  = is_array($json) ? $json : preg_split('/[,;\n]+/', $text);
        }

        if (!is_array($raw)) return [];

        if (isset($raw['nombre']) || isset($raw['producto']) || isset($raw['name'])) $raw = [$raw];

        $items = [];

        foreach ($raw as $item) {
            if (count($items) >= 20) break;

            $name = '';
            $qty  = 1;

            if (is_array($item)) {
                foreach (['nombre', 'producto', 'name'] as $k) {
                    if (isset($item[$k]) && is_scalar($item[$k])) {
                        $name = (string) $item[$k];
                        break;
                    }
                }

                foreach (['cantidad', 'qty', 'quantity'] as $k) {
                    if (isset($item[$k]) && is_scalar($item[$k])) {
                        $qty = (int) $item[$k];
                        break;
                    }
                }
            } else if (is_scalar($item)) {
                $name = (string) $item;

                if (preg_match('/^\s*(\d{1,3})\s*(?:x|pz|pzas?|piezas?)?\s+(.+)$/iu', $name, $m)) {
                    $qty  = (int) $m[1];
                    $name = $m[2];
                }
            }

            $name = mb_substr(trim((string) preg_replace('/\s+/u', ' ', $name)), 0, 80, 'UTF-8');

            if ($name !== '') $items[] = ['nombre' => $name, 'cantidad' => $qty];
        }

        return $items;
    }

    // «2 × Pastel, 1 × Gelatina»: como queda anotado en la propuesta.
    private function agentItemsText(array $items) {
        return mb_substr(implode(', ', array_map(function ($i) {
            return (int) ($i['cantidad'] ?? 1) . ' × ' . (string) ($i['nombre'] ?? '');
        }, $items)), 0, 200, 'UTF-8');
    }

    // AAAA-MM-DD, dd/mm[/aaaa], hoy, mañana o pasado mañana. '' = no se entendio.
    private function agentDraftDate($text, $now) {
        $t = trim((string) preg_replace('/\s+/', ' ', $this->inboxFold($text)));

        if ($t === 'hoy')           return date('Y-m-d', $now);
        if ($t === 'manana')        return date('Y-m-d', strtotime('+1 day', $now));
        if ($t === 'pasado manana') return date('Y-m-d', strtotime('+2 days', $now));

        if (preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', $t, $m)) {
            return checkdate((int) $m[2], (int) $m[3], (int) $m[1]) ? $t : '';
        }

        if (!preg_match('~^(\d{1,2})[/-](\d{1,2})(?:[/-](\d{4}|\d{2}))?$~', $t, $m)) return '';

        $day   = (int) $m[1];
        $month = (int) $m[2];

        if (isset($m[3]) && $m[3] !== '') {
            $year = (int) $m[3] + (strlen($m[3]) === 2 ? 2000 : 0);
        } else {
            // Sin año: la proxima vez que cae ese dia.
            $year = (int) date('Y', $now);

            if (sprintf('%04d-%02d-%02d', $year, $month, $day) < date('Y-m-d', $now)) $year++;
        }

        return checkdate($month, $day, $year) ? sprintf('%04d-%02d-%02d', $year, $month, $day) : '';
    }

    // 17:30, 5:30 pm, 5 pm, 17 hrs. «5» a secas no dice si es mañana o tarde: ''.
    private function agentDraftTime($text) {
        $t = str_replace(['.', ' '], '', $this->inboxFold($text));

        if (!preg_match('/^(\d{1,2})(?::(\d{2}))?(?::\d{2})?(am|pm|hrs?|h)?$/', $t, $m)) return '';

        $hour    = (int) $m[1];
        $hasMin  = isset($m[2]) && $m[2] !== '';
        $minutes = $hasMin ? (int) $m[2] : 0;
        $suffix  = $m[3] ?? '';

        if ($minutes > 59) return '';

        if ($suffix === 'am' || $suffix === 'pm') {
            if ($hour < 1 || $hour > 12) return '';

            if ($suffix === 'pm' && $hour < 12)  $hour += 12;
            if ($suffix === 'am' && $hour === 12) $hour = 0;
        } else {
            if ($hour > 23) return '';
            if ($suffix === '' && !$hasMin && $hour < 13) return '';
        }

        return sprintf('%02d:%02d:00', $hour, $minutes);
    }

    private function agentDraftWay($text) {
        $t = $this->inboxFold($text);

        if (preg_match('/domicilio|envio|enviar|llevar|delivery/', $t))       return 'delivery';
        if (preg_match('/recog|recoj|sucursal|tienda|local|pickup/', $t))     return 'pickup';

        return '';
    }

    private function agentDraftPay($text) {
        $t = $this->inboxFold($text);

        if (preg_match('/transfer|deposito|spei/', $t))                      return 'transfer';
        if (preg_match('/sucursal|tienda|efectivo|tarjeta|store/', $t))      return 'store';

        return '';
    }

    // El nombre lo escribe el cliente: solo letras, espacios, punto, apostrofo y guion.
    private function agentDraftName($name) {
        $name = (string) preg_replace('/[^\p{L}\p{M} .\'-]+/u', ' ', (string) $name);

        return mb_substr(trim((string) preg_replace('/\s+/u', ' ', $name)), 0, 120, 'UTF-8');
    }

    // «viernes 20/11/2026».
    private function agentDayText($date) {
        $days  = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
        $stamp = strtotime($date . ' 12:00:00');

        return $days[(int) date('w', $stamp)] . ' ' . date('d/m/Y', $stamp);
    }

    // -- Crear el pedido (al mandar la propuesta) --

    /*  Dentro de la transaction() de sendProposal, con la propuesta apartada.
        Revisa TODO antes de escribir (transaction() confirma lo que regrese un
        return): ['status' => 409, 'message'] no escribio nada. Si algo falla
        al escribir, lanza y se deshace todo. Devuelve ['status' => 200, 'sale_id']. */
    protected function agentOrderCreate(array $p, array $chat, array $agent, $userId) {
        $d     = json_decode((string) $p['action_data'], true);
        $again = ' Pide otra propuesta o atiéndelo a mano.';

        if (!is_array($d) || empty($d['lines']) || !is_array($d['lines'])) {
            return $this->agentRefuse('La propuesta no trae el pedido completo.' . $again);
        }

        $companyId = (int) $chat['company_id'];
        $branchId  = (int) ($d['branch_id'] ?? 0);

        if ($branchId <= 0 || $chat['branch_id'] === null || (int) $chat['branch_id'] !== $branchId) {
            return $this->agentRefuse('La conversación cambió de sucursal después de armar el pedido.' . $again);
        }

        $store = $this->qStore($branchId);

        if (!$store || (int) $store['active'] !== 1) {
            return $this->agentRefuse('La tienda en línea de la sucursal está apagada y el pedido no tendría dónde caer. Enciéndela en Tienda en línea o atiéndelo a mano.');
        }

        $main    = $this->qFirstBranch($companyId);
        $catalog = [];

        foreach ($this->agentCatalogRows([
            'company_id' => $companyId,
            'branch_id'  => $branchId,
            'main_id'    => $main ? (int) $main['id'] : $branchId,
            'agent'      => ['catalog_mode' => (string) ($agent['catalog_mode'] ?? 'store')]
        ]) as $row) {
            $catalog[(int) $row['id']] = $row;
        }

        $lines = [];
        $total = 0;

        foreach ($d['lines'] as $l) {
            $id    = is_array($l) ? (int) ($l['product_id'] ?? 0) : 0;
            $qty   = is_array($l) ? (int) ($l['quantity'] ?? 0) : 0;
            $price = is_array($l) ? round((float) ($l['price'] ?? 0), 2) : 0;

            if (!isset($catalog[$id])) {
                return $this->agentRefuse('Un producto del pedido ya no está en el catálogo del agente.' . $again);
            }

            $name = trim((string) $catalog[$id]['name']);

            if (round((float) $catalog[$id]['price'], 2) !== $price) {
                return $this->agentRefuse("Cambió el precio de «{$name}» después de armar el pedido." . $again);
            }

            if ($qty < 1 || $qty > 999 || $price <= 0 || isset($lines[$id])) {
                return $this->agentRefuse('Las cantidades del pedido no cuadran.' . $again);
            }

            $lines[$id] = ['product_id' => $id, 'name' => $name, 'price' => $price, 'quantity' => $qty];
            $total     += $price * $qty;
        }

        $total = round($total, 2);

        if (count($lines) > 60 || $total <= 0 || abs($total - round((float) ($d['total'] ?? 0), 2)) > 0.004) {
            return $this->agentRefuse('El total del pedido no cuadra con sus productos.' . $again);
        }

        $delivery = (string) ($d['delivery'] ?? '');
        $payment  = (string) ($d['payment'] ?? '');
        $ways     = ['pickup' => (int) $store['pickup'] === 1, 'delivery' => (int) $store['delivery'] === 1];
        $pays     = ['store' => (int) $store['pay_store'] === 1, 'transfer' => (int) $store['pay_transfer'] === 1];

        if (empty($ways[$delivery])) return $this->agentRefuse('La tienda de la sucursal ya no acepta esa forma de entrega.' . $again);
        if (empty($pays[$payment]))  return $this->agentRefuse('La tienda de la sucursal ya no acepta esa forma de pago.' . $again);

        $now   = $this->inboxNow();
        $stamp = date('Y-m-d H:i:s', $now);
        $date  = (string) ($d['date'] ?? '');
        $time  = (string) ($d['time'] ?? '');
        $day   = DateTime::createFromFormat('!Y-m-d', $date);
        $first = date('Y-m-d', strtotime('+' . max(0, (int) $store['lead_days']) . ' days', $now));
        $last  = date('Y-m-d', strtotime('+90 days', $now));

        if (!$day || $day->format('Y-m-d') !== $date || $date < $first || $date > $last) {
            return $this->agentRefuse('La fecha de entrega ya no se puede (la primera disponible es el ' . $this->agentDayText($first) . ').' . $again);
        }

        if (!preg_match('/^([01]\d|2[0-3]):[0-5]\d:00$/', $time) || ($date === date('Y-m-d', $now) && $time <= date('H:i:s', $now))) {
            return $this->agentRefuse('La hora de entrega ya pasó o no es válida.' . $again);
        }

        $address = $delivery === 'delivery' ? trim((string) ($d['address'] ?? '')) : null;
        $note    = trim((string) ($d['note'] ?? ''));
        $name    = $this->agentDraftName($d['name'] ?? '');
        $phone   = (string) ($d['phone'] ?? '');
        $digits  = preg_replace('/\D/', '', (string) $chat['phone']);

        if ($delivery === 'delivery' && ($address === '' || mb_strlen($address, 'UTF-8') > 255)) {
            return $this->agentRefuse('Falta la dirección de entrega.' . $again);
        }

        if (mb_strlen($name, 'UTF-8') < 2 || mb_strlen($note, 'UTF-8') > 2000) {
            return $this->agentRefuse('Falta a nombre de quién va el pedido.' . $again);
        }

        if (!preg_match('/^\d{10}$/', $phone) || strlen($digits) < 10 || substr($digits, -10) !== $phone) {
            return $this->agentRefuse('El pedido se armó para otro teléfono.' . $again);
        }

        // -- De aqui en adelante se escribe: cualquier falla lanza y se deshace todo. --

        $customer = isset($chat['customer_id']) && $chat['customer_id'] !== null
            ? $this->qAgentCustomer((int) $chat['customer_id'], $branchId)
            : null;

        if (!$customer) $customer = $this->qStoreCustomer($branchId, $phone);

        if ($customer) {
            $customerId = (int) $customer['id'];
        } else {
            $this->inboxMust($this->qCreateCustomer([
                'values' => ['name', 'phone', 'email', 'branch_id', 'active'],
                'data'   => [$name, $phone, null, $branchId, 1]
            ]), 'pedido por WhatsApp: cliente');

            $customerId = $this->qLastInsertId();
            if ($customerId <= 0) throw new RuntimeException('pedido por WhatsApp: cliente sin id');
        }

        $this->inboxMust($this->qCreateOrder([
            'values' => [
                'branch_id', 'customer_id', 'user_id', 'turn_id', 'sale_type_id', 'sale_status_id',
                'delivery_method', 'delivery_status', 'delivery_date', 'delivery_time', 'location', 'note',
                'subtotal', 'discount_amount', 'total', 'active'
            ],
            'data' => [
                $branchId, $customerId, null, null, 4, 1,
                $delivery === 'delivery' ? 1 : 0, 0, $date, $time, $address, $note !== '' ? $note : null,
                $total, 0, $total, 1
            ]
        ]), 'pedido por WhatsApp');

        $id = $this->qLastInsertId();
        if ($id <= 0) throw new RuntimeException('pedido por WhatsApp: sin id');

        $this->inboxMust($this->qUpdateOrder(['values' => ['folio'], 'where' => ['id'], 'data' => [(string) $id, $id]]), 'pedido por WhatsApp: folio');

        foreach ($lines as $line) {
            $this->inboxMust($this->qCreateLine([
                'values' => ['sale_id', 'product_id', 'name', 'price', 'quantity', 'details', 'dedication', 'active'],
                'data'   => [$id, $line['product_id'], $line['name'], $line['price'], $line['quantity'], null, null, 1]
            ]), 'pedido por WhatsApp: linea');
        }

        $this->inboxMust($this->qCreateWebOrder([
            'values' => ['sale_id', 'branch_id', 'customer_name', 'phone', 'email', 'delivery', 'payment', 'ip', 'created_at'],
            'data'   => [$id, $branchId, $name, $phone, null, $delivery, $payment, 'whatsapp', $stamp]
        ]), 'pedido por WhatsApp: origen');

        $count = count($lines);
        $text  = 'Pedido recibido por WhatsApp a nombre de ' . $name . ' (' . $phone . ') — total '
               . $this->agentMoney($total) . ', ' . ($count === 1 ? '1 producto' : "{$count} productos")
               . '. ' . ($delivery === 'delivery' ? 'Envío a domicilio' : 'Recoge en tienda')
               . ', ' . ($payment === 'transfer' ? 'Transferencia' : 'Paga en tienda') . '.';

        $this->inboxMust($this->qCreateHistory([
            'values' => ['sale_id', 'user_id', 'type', 'title', 'action', 'detail', 'active'],
            'data'   => [$id, $userId ?: null, 'event', 'Pedido por WhatsApp', mb_substr($text, 0, 255, 'UTF-8'), $text, 1]
        ]), 'pedido por WhatsApp: bitacora');

        $this->qWaSetChatCustomer((int) $chat['id'], $customerId, $stamp);
        $this->qWaSetProposalSale((int) $p['id'], $id);

        return ['status' => 200, 'sale_id' => $id];
    }

    private function agentRefuse($message) {
        return ['status' => 409, 'message' => $message];
    }

    // -- pasar_a_persona --

    protected function agentHandoff(array $keep, array $ctx) {
        $summary = trim((string) preg_replace('/\s+/u', ' ', (string) ($keep['resumen'] ?? '')));

        if (mb_strlen($summary, 'UTF-8') < 5) {
            return ['pasado' => false, 'falta' => 'resumen', 'siguiente' => 'Vuelve a llamarla con un resumen de lo que quiere el cliente.'];
        }

        return [
            'pasado'    => true,
            'siguiente' => 'Dile al cliente, en una frase, que una persona del equipo lo atiende en breve. No prometas tiempos, precios ni existencias.',
            '_action'   => ['type' => 'handoff', 'data' => ['summary' => mb_substr($summary, 0, 500, 'UTF-8')]]
        ];
    }

    /*  ¿El cliente pide una persona con todas sus letras? «quiero hablar con
        alguien», «pásame con un asesor», «que me atienda una persona», o el
        mensaje entero es «asesor». Lo demas lo decide el modelo. */
    protected function agentWantsPerson($body) {
        $t = (string) preg_replace('/[^a-z0-9 ]+/', ' ', $this->inboxFold($body));
        $t = trim((string) preg_replace('/\s+/', ' ', $t));

        if ($t === '' || strlen($t) > 200) return false;

        // «no quiero hablar con una persona»: eso lo lee el modelo.
        if (preg_match('/\b(?:no|ni|sin) (?:quiero |necesito |hace falta |tengo que )?(?:hablar|comunicar|pasar|que me atienda)/', $t)) return false;

        if (preg_match('/^(con )?(una |un )?(persona|humano|asesor|asesora)( real)?( por favor| porfa)?$/', $t)) return true;

        $ask = 'hablar con|(?:comunicar|comunicarme|comunicame|comuniqueme|comuniquenme|pasar|pasarme|pasame|paseme|pasenme) con|que me atienda|atiendame|atenderme';
        $who = '(?:a )?(?:una |un |el |la |algun |alguna )?(?:persona|humano|humana|asesor|asesora|encargado|encargada|gerente|alguien|ejecutivo|ejecutiva)';

        return (bool) preg_match('/\b(?:' . $ask . ') ' . $who . '\b/', $t);
    }

    // La propuesta de la regla: no pasa por el modelo.
    protected function agentRuleHandoff($body) {
        $said    = mb_substr(trim((string) preg_replace('/\s+/u', ' ', (string) $body)), 0, 200, 'UTF-8');
        $summary = 'El cliente pidió hablar con una persona: «' . $said . '»';

        return [
            'text'      => $this->agentHandoffText(),
            'tools'     => [[
                'name'    => 'pasar_a_persona',
                'args'    => ['resumen' => $summary],
                'ignored' => [],
                'summary' => 'Pasado a una persona (sin modelo)',
                'data'    => ''
            ]],
            'error'     => '',
            'ours_last' => false,
            'action'    => ['type' => 'handoff', 'data' => ['summary' => $summary]]
        ];
    }

    protected function agentHandoffText() {
        return 'Gracias, una persona del equipo te atiende en breve.';
    }

    /*  Deja el chat con una persona 24 h y avisa a la sucursal. Nunca lanza:
        la propuesta ya esta armada. Si el chat ya lo atendia una persona solo
        cambia la nota (no vuelve a avisar). $chat = fila de qWaChatAI. */
    protected function agentHandoffApply($companyId, array $chat, $summary) {
        try {
            $was = $this->agentIsHuman($chat);
            $now = $this->inboxNow();

            $this->qWaSetHuman((int) $chat['id'], date('Y-m-d H:i:s', $now + 86400), mb_substr((string) $summary, 0, 500, 'UTF-8'), date('Y-m-d H:i:s', $now));

            if (!$was) $this->agentHandoffNotify($companyId, $chat, (string) $summary);
        } catch (Throwable $e) {
            $this->inboxLog("[ AGENTE IA ] :: pasar a persona, chat {$chat['id']} :: " . $e->getMessage());
        }
    }

    // El aviso a quien recibe «Pedido nuevo». Devuelve a cuantos se les mando (o se simulo).
    protected function agentHandoffNotify($companyId, array $chat, $summary) {
        $branchId   = (int) $chat['branch_id'];
        $recipients = $this->qWaHandoffRecipients($companyId, $branchId);

        if (!$recipients) return 0;

        $digits = preg_replace('/\D/', '', (string) $chat['phone']);
        $phone  = strlen($digits) >= 10 ? substr($digits, -10) : $digits;
        $name   = $this->agentDraftName($chat['name']);

        $text = "*Cliente pide una persona* (WhatsApp)\n"
              . ((string) $chat['branch'] !== '' ? 'Sucursal: ' . $chat['branch'] . "\n" : '')
              . 'Cliente: ' . ($name !== '' ? $name . ' · ' : '') . $phone . "\n"
              . 'Qué necesita: ' . mb_substr($summary, 0, 300, 'UTF-8') . "\n\n"
              . 'Contéstale desde Huubie › WhatsApp › Conversaciones.';

        $sim  = strpos((string) $chat['wa_id'], 'SIM-') === 0;
        $wa   = $sim ? null : $this->agentNotifier();
        $ref  = 'Chat ' . (int) $chat['id'] . ($name !== '' ? ' · ' . $name : '');
        $done = 0;

        foreach ($recipients as $r) {
            if ($sim) {
                $sent = ['status' => 'simulated', 'provider' => 'simulado', 'detail' => ''];
            } else {
                try {
                    $sent = $wa->send($r['phone'], $text);
                } catch (Throwable $e) {
                    $sent = ['status' => 'failed', 'provider' => '', 'detail' => 'No se pudo llamar al proveedor.'];
                }
            }

            if ($sent['status'] !== 'failed') $done++;

            $this->agentWaLog($companyId, $branchId, $ref, (int) $r['id'], (string) $r['phone'], $sent, $text);
        }

        return $done;
    }

    // El que manda el aviso a la sucursal (el arnes lo cambia).
    protected function agentNotifier() {
        return new WhatsApp();
    }

    // Un renglon del historial de avisos. Si la base falla, el aviso ya salio: solo se anota.
    private function agentWaLog($companyId, $branchId, $reference, $recipientId, $phone, array $sent, $body) {
        try {
            $saved = $this->qInsertInto('wa_log', [
                'values' => ['company_id', 'branch_id', 'type', 'reference', 'recipient_id', 'phone', 'provider', 'status', 'error', 'body', 'user_id', 'created_at'],
                'data'   => [
                    $companyId, $branchId ?: null, 'handoff', mb_substr($reference, 0, 80, 'UTF-8'), $recipientId,
                    mb_substr($phone, 0, 60, 'UTF-8'), mb_substr((string) $sent['provider'], 0, 12, 'UTF-8'), mb_substr((string) $sent['status'], 0, 10, 'UTF-8'),
                    (string) $sent['detail'] !== '' ? mb_substr((string) $sent['detail'], 0, 255, 'UTF-8') : null, $body,
                    null, date('Y-m-d H:i:s', $this->inboxNow())
                ]
            ]);

            if ($saved !== true) $this->inboxLog('[ AGENTE IA wa_log ] :: ' . (is_string($saved) ? $saved : 'sin respuesta de la base'));
        } catch (Throwable $e) {
            $this->inboxLog('[ AGENTE IA wa_log ] :: ' . $e->getMessage());
        }
    }

    // -- comprobante_guardar --

    /*  La foto o el PDF mas reciente del chat pasa a comprobante en revision.
        Escribe (archivo + customer_receipt); si algo falla lanza y agentTool
        contesta que no se pudo. */
    protected function agentReceipt(array $keep, array $ctx) {
        $person = ' Usa pasar_a_persona para que alguien lo reciba.';

        if (!$ctx['customer']) {
            return ['guardado' => false, 'nota' => 'Este teléfono no está registrado como cliente.' . $person];
        }

        $now = $this->inboxNow();
        $msg = $this->qWaLastMedia($ctx['chat_id'], date('Y-m-d H:i:s', $now - 86400));

        if (!$msg) {
            return ['guardado' => false, 'nota' => 'El cliente no ha mandado foto ni PDF en las últimas 24 horas: pídele la foto de su comprobante.'];
        }

        if ($msg['receipt_id'] !== null) return $this->agentReceiptKnown((int) $msg['receipt_id']);

        $amount = $this->agentAmount($keep['monto'] ?? '');

        if ($amount <= 0) {
            return ['guardado' => false, 'falta' => 'monto', 'siguiente' => 'Pregúntale al cliente de cuánto fue el pago.'];
        }

        $customerId = (int) $ctx['customer']['id'];
        $branchId   = (int) $ctx['branch_id'];

        if ($this->qPendingReceipts($customerId, $branchId) >= 3) {
            return ['guardado' => false, 'nota' => 'El cliente ya tiene 3 comprobantes en revisión: una persona los revisa antes de recibir otro.'];
        }

        // Con folio: tiene que ser un pedido de este cliente. Uno de la tienda sin aceptar todavia no recibe abonos: va en la nota.
        $saleId = null;
        $target = 'a lo que debe';
        $extra  = '';

        if (preg_match('/(\d{1,9})/', (string) ($keep['folio'] ?? ''), $m)) {
            $rows = $this->qAgentOrders($branchId, $customerId, $ctx['phone10'] !== '' ? $ctx['phone10'] : 'x', (int) $m[1]);

            if (!$rows) {
                return ['guardado' => false, 'nota' => 'No hay un pedido con ese folio para este cliente en esta sucursal. Pregúntale el folio, o guárdalo sin folio.'];
            }

            $order = $rows[0];

            if ((int) $order['sale_status_id'] === 4) {
                return ['guardado' => false, 'nota' => 'Ese pedido está cancelado.' . $person];
            }

            $target = 'P' . (int) $order['id'];

            if ((int) $order['sale_type_id'] === 4 && (int) $order['sale_status_id'] === 1) {
                $extra = 'para el pedido ' . $target . ' (por aceptar)';
            } else {
                $saleId = (int) $order['id'];
            }
        }

        $said = trim((string) preg_replace('/\s+/u', ' ', (string) ($keep['nota'] ?? '')));
        $note = mb_substr(implode(' · ', array_filter(['Por WhatsApp', $extra, $said])), 0, 255, 'UTF-8');

        $media = $this->agentMediaBytes($msg, (int) $ctx['company_id']);

        if (!$media['ok']) {
            return ['guardado' => false, 'nota' => 'No se pudo leer el archivo que mandó el cliente.' . $person];
        }

        $kind = $this->agentFileKind($media['bytes']);

        if (!$kind) {
            return ['guardado' => false, 'nota' => 'El archivo no es una foto (JPG, PNG o WEBP) ni un PDF: pídele la foto de su comprobante.'];
        }

        $dir = $this->receiptDir($branchId);

        if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) {
            throw new RuntimeException('comprobante por WhatsApp: no se pudo crear la carpeta de la sucursal ' . $branchId);
        }

        $file  = bin2hex(random_bytes(16)) . '.' . $kind['ext'];
        $path  = $dir . '/' . $file;
        $size  = strlen($media['bytes']);
        $stamp = date('Y-m-d H:i:s', $now);
        $msgId = (int) $msg['id'];

        if (@file_put_contents($path, $media['bytes'], LOCK_EX) !== $size) {
            @unlink($path);

            throw new RuntimeException('comprobante por WhatsApp: no se pudo guardar el archivo');
        }

        try {
            $receiptId = $this->transaction(function () use ($msgId, $customerId, $branchId, $saleId, $amount, $note, $file, $kind, $size, $stamp) {
                $row = $this->qWaLockMessage($msgId);

                if (!$row) throw new RuntimeException('comprobante por WhatsApp: el mensaje ya no existe');

                // Otra propuesta lo guardo mientras tanto: se queda ese.
                if ($row['receipt_id'] !== null) return -1 * (int) $row['receipt_id'];

                $this->inboxMust($this->qCreateReceipt([
                    'values' => ['customer_id', 'branch_id', 'sale_id', 'amount', 'note', 'file', 'file_name', 'mime', 'size', 'status', 'ip', 'created_at', 'updated_at'],
                    'data'   => [$customerId, $branchId, $saleId, $amount, $note, $branchId . '/' . $file, 'whatsapp-' . $msgId . '.' . $kind['ext'], $kind['mime'], $size, 'pending', 'whatsapp', $stamp, $stamp]
                ]), 'comprobante por WhatsApp');

                $id = $this->qLastInsertId();
                if ($id <= 0) throw new RuntimeException('comprobante por WhatsApp: sin id');

                $this->qWaSetMessageReceipt($msgId, $id);

                return $id;
            });
        } catch (Throwable $e) {
            @unlink($path);

            throw $e;
        }

        if ($receiptId < 0) {
            @unlink($path);

            return $this->agentReceiptKnown(-1 * $receiptId);
        }

        return [
            'guardado'  => true,
            'folio'     => $this->receiptFolio($receiptId),
            'monto'     => $this->agentMoney($amount),
            'pedido'    => $target,
            'siguiente' => 'Dile que recibimos su comprobante y que una persona lo revisa. No confirmes que el pago llegó ni que el pedido quedó pagado.'
        ];
    }

    private function agentReceiptKnown($receiptId) {
        return [
            'guardado'  => true,
            'ya_estaba' => true,
            'folio'     => $this->receiptFolio($receiptId),
            'siguiente' => 'Ese comprobante ya estaba registrado: dile que una persona lo revisa. No confirmes que el pago llegó.'
        ];
    }

    // Monto mayor a 0 y hasta 1,000,000; 0 = no se entendio.
    private function agentAmount($text) {
        $t = str_replace(['$', ',', ' '], '', trim((string) $text));

        if (!preg_match('/^\d{1,7}(\.\d{1,2})?$/', $t)) return 0.0;

        $n = round((float) $t, 2);

        return $n > 0 && $n <= 1000000 ? $n : 0.0;
    }

    /*  Los bytes del archivo de un mensaje: del disco si se guardo (simulador)
        o de Meta con su media_id. Tope 5 MB. Devuelve ['ok', 'bytes']. */
    private function agentMediaBytes(array $msg, $companyId) {
        $none = ['ok' => false, 'bytes' => ''];
        $path = $this->agentWaPath($msg['media_path'], $companyId);

        if ($path !== null) {
            if (!is_file($path) || filesize($path) > 5242880) return $none;

            $bytes = @file_get_contents($path);

            return is_string($bytes) && $bytes !== '' ? ['ok' => true, 'bytes' => $bytes] : $none;
        }

        if ((string) $msg['media_id'] === '' || strpos((string) $msg['media_id'], 'SIM-') === 0) return $none;

        $r = $this->inboxMeta()->media($msg['media_id']);

        return $r['ok'] && $r['bytes'] !== '' ? ['ok' => true, 'bytes' => $r['bytes']] : $none;
    }

    // jpg, png, webp o pdf segun los bytes (nunca por el nombre): ['ext', 'mime'] o null.
    protected function agentFileKind($bytes) {
        $bytes = (string) $bytes;

        if ($bytes === '') return null;

        $types = $this->receiptTypes();

        if (strpos(substr($bytes, 0, 1024), '%PDF-') !== false) return ['ext' => 'pdf', 'mime' => $types['pdf']];

        $info = @getimagesizefromstring($bytes);
        $map  = [IMAGETYPE_JPEG => 'jpg', IMAGETYPE_PNG => 'png', IMAGETYPE_WEBP => 'webp'];

        if (!$info || !isset($map[$info[2]])) return null;

        return ['ext' => $map[$info[2]], 'mime' => $types[$map[$info[2]]]];
    }

    // Carpeta de los archivos que llegan por el chat (pro/storage/whatsapp/<empresa>).
    protected function agentWaDir($companyId) {
        return dirname(__DIR__, 3) . '/storage/whatsapp/' . (int) $companyId;
    }

    // Ruta en disco de wa_message.media_path. Null si no tiene la forma que guarda el simulador o es de otra empresa.
    protected function agentWaPath($file, $companyId) {
        $file = (string) $file;

        if (!preg_match('~^(\d+)/[a-f0-9]{32}\.(jpg|png|webp|pdf)$~', $file, $m)) return null;
        if ((int) $m[1] !== (int) $companyId) return null;

        return dirname(__DIR__, 3) . '/storage/whatsapp/' . $file;
    }
}
