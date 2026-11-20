<?php
require_once __DIR__ . '/../../../core/security/_Session.php';
if (empty($_POST['opc'])) exit(0);

require_once __DIR__ . '/core-order.php';
require_once __DIR__ . '/../mdl/mdl-whatsapp.php';
require_once __DIR__ . '/../mdl/mdl-whatsapp-agente.php';
require_once __DIR__ . '/../mdl/mdl-tienda.php';
require_once __DIR__ . '/../mdl/mdl-portal.php';
require_once __DIR__ . '/../mdl/mdl-whatsapp-ia.php';
require_once __DIR__ . '/../mdl/mdl-whatsapp-pedidos.php';
require_once __DIR__ . '/../mdl/mdl-whatsapp-recordatorios.php';
require_once __DIR__ . '/../mdl/mdl-whatsapp-dueno.php';
require_once __DIR__ . '/../mdl/mdl-whatsapp-automatico.php';
require_once __DIR__ . '/../../../core/helpers/_WhatsAppMeta.php';
require_once __DIR__ . '/../../../core/helpers/_IaOllama.php';

/*  Ventas › WhatsApp: la bandeja de conversaciones con los clientes (agente,
    F2), los avisos que salen solos (pedido nuevo, cierre de turno, cierre del
    dia), a quien le llegan, el historial y la conexion.

    Reglas que no se ven en el codigo de un vistazo:
      - La seccion es pos-whatsapp (show, create, update). Con show se ve todo;
        con create se cambian plantillas, destinatarios y el horario del agente,
        se comprueba la conexion y se manda el mensaje de prueba; con update se
        atiende la bandeja (contestar, simular, asignar sucursal).
      - Plantillas, destinatarios y conversaciones son de la EMPRESA; un
        destinatario con sucursal solo recibe los avisos de esa sucursal.
      - Hay dos proveedores: los avisos salen por WhatsApp (_WhatsApp.php) y la
        bandeja por Meta (_WhatsAppMeta.php). Sus tokens viven en
        pro/core/config/.env: esta pagina solo dice cual esta puesto y que
        falta, nunca un valor.
      - Sin token nada sale a la red: el historial y la bandeja lo marcan
        «Simulado». El simulador (escribir como cliente) solo existe asi.
      - Pasadas 24 h desde el ultimo mensaje del cliente, la bandeja no deja
        mandar texto libre (regla de Meta; las plantillas llegan en F5).
      - Abrir la bandeja tambien corre lo automatico pendiente del agente (el
        menu de sucursales), solo si el agente esta en horario.
      - El agente de clientes (F3) PROPONE: la propuesta queda en wa_proposal
        y sale cuando una persona la manda (tal cual o cambiada), salvo los
        temas que la empresa puso en automatico (F6, ver abajo).
        En prod las automaticas las arma cron-whatsapp-agente.php; aqui solo
        el simulador (agentAuto) y el boton «Proponer» (proposeNow). Llamar
        al modelo tarda: cada peticion suelta la sesion antes.
      - Contestar a mano retira la propuesta abierta del chat.
      - Pedidos y comprobantes por chat (F4, mdl-whatsapp-pedidos.php): una
        propuesta puede traer un pedido (action 'order'). El pedido se crea al
        MANDARLA, dentro de la misma transaccion que la marca como decidida, y
        cae en Tienda en linea › Nuevos; «{folio}» del texto se cambia por el
        folio real. Si el pedido ya no se puede crear, la propuesta no sale.
        Si se crea y Meta rechaza el mensaje, el pedido se queda.
      - Un chat que el agente paso a una persona (wa_chat.mode 'human') no
        recibe propuestas automaticas hasta «Devolver al agente» (agentBack) o
        24 h. El aviso a la sucursal queda en el historial con tipo 'handoff'.
      - El catalogo del agente (saveAgent / saveAgentProducts) es el de Tienda
        en linea o una lista propia de productos de la empresa.
      - Recordatorios de adeudo (F5, mdl-whatsapp-recordatorios.php): la
        pestaña muestra quien recibiria hoy ANTES de mandar nada. Encender el
        automatico y «Mandar los de hoy» piden create; salen como plantilla
        aprobada de Meta, en horario, uno por semana por cliente.
      - BAJA (wa_chat.opt_out) apaga recordatorios y plantillas, no las
        respuestas: lo que el cliente escribe se le puede contestar.
      - «Ya abrimos» (sendReopen) es la plantilla para retomar un chat que se
        quedo sin respuesta mas de 24 h.
      - Agente del dueño (F6, mdl-whatsapp-dueno.php): un destinatario con
        «Pregunta» (can_ask) le escribe al numero del agente y le contesta
        directo con ventas, turno, pedidos pendientes y cartera. Marcarlo pide
        create, igual que los demas avisos. Su chat sale en la bandeja con la
        marca «Dueño».
      - Respuestas que salen solas (F6, mdl-whatsapp-automatico.php): con
        create se encienden por tema en «Agente» (saveAgent, auto_topics).
        Solo horario/direccion/pago y catalogo; lo demas sigue en la bandeja.
      - Metricas (lsMetrics, show): conversaciones resueltas sin persona,
        tiempo de respuesta y propuestas por tema.
      - La prueba queda en el historial con tipo 'test'. */
class ctrl extends core {

    use WhatsAppNotices, WhatsAppInbox, WhatsAppAgentFlow, OnlineStore, CustomerPortal, WhatsAppAgentAI, WhatsAppAgentOrders, WhatsAppReminders,
        WhatsAppOwnerAgent, WhatsAppAgentAuto;

    const WA         = 'pos-whatsapp';
    const MAX_BODY   = 2000;
    const MAX_NAME   = 80;
    const MAX_SEARCH = 60;
    const TYPES      = ['order', 'turn', 'day'];
    const MEDIA      = ['image' => 'Foto', 'audio' => 'Audio', 'video' => 'Video', 'document' => 'Documento',
                        'sticker' => 'Sticker', 'location' => 'Ubicación', 'contacts' => 'Contacto', 'reaction' => 'Reacción',
                        'template' => 'Plantilla'];

    // -- Arranque --

    public function init() {
        $scope = $this->scope();
        $types = [];

        foreach ($this->waTypes() as $key => $type) {
            $vars = [];

            foreach ($type['vars'] as $var => $label) $vars[] = ['key' => $var, 'label' => $label];

            $types[] = ['key' => $key, 'name' => $type['name'], 'when' => $type['when'], 'vars' => $vars];
        }

        $branches = array_map(function ($b) {
            return ['id' => (int) $b['id'], 'valor' => (string) $b['name']];
        }, $this->companyId() > 0 ? $this->qCompanyBranches($this->companyId()) : []);

        return [
            'status'    => 200,
            'scope'     => ['company' => $scope['company'], 'branch' => $scope['branch']],
            'wa'        => Permission::actions(self::WA),
            'conn'      => (new WhatsApp())->status(),
            'agentConn' => (new WhatsAppMeta())->status(),
            'agent'     => $this->agentInfo($this->companyId() > 0 ? $this->qWaAgent($this->companyId()) : null),
            'replyMax'  => WhatsAppMeta::MAX_TEXT,
            'types'     => $types,
            'branches'  => $branches,
            'today'     => date('Y-m-d')
        ];
    }

    // -- Bandeja --

    /*  Los chats de la empresa. Antes corre lo automatico pendiente (menu de
        sucursales), que solo sale con el agente en horario. */
    public function lsChats() {
        $fail = $this->needWa('show') ?: $this->needBranch();
        if ($fail) return $fail;

        $search = mb_substr((string) preg_replace('/\s+/u', ' ', $this->post('search')), 0, self::MAX_SEARCH, 'UTF-8');
        $branch = $this->post('branch');
        if ($branch !== 'none') $branch = (int) $branch > 0 ? (string) (int) $branch : '';

        $companyId = $this->companyId();

        session_write_close();

        return $this->attempt(function () use ($companyId, $search, $branch) {
            $swept = 0;

            try {
                $swept = $this->inboxSweep($companyId);
            } catch (Throwable $e) {
                $this->inboxLog('[ AGENTE ] :: barrido de la bandeja :: ' . $e->getMessage());
            }

            $open = $this->qWaOpenProposalMap($companyId, date('Y-m-d H:i:s', $this->inboxNow() - $this->agentStaleSeconds()));
            $rows = [];

            foreach ($this->qWaChatList($companyId, $search, $branch) as $c) $rows[] = $this->chatRow($c, $open[(int) $c['id']] ?? '');

            return [
                'status' => 200,
                'row'    => $rows,
                'count'  => count($rows),
                'swept'  => $swept,
                'agent'  => $this->agentInfo($this->qWaAgent($companyId))
            ];
        }, 'No se pudieron cargar las conversaciones.');
    }

    // El hilo de un chat. Quien puede atender lo deja como leido.
    public function getChat() {
        $fail = $this->needWa('show') ?: $this->needBranch();
        if ($fail) return $fail;

        $id = $this->postId();

        return $this->attempt(function () use ($id) {
            $chat = $id > 0 ? $this->qWaChat($id, $this->companyId()) : null;
            if (!$chat) return $this->fail(404, 'Esa conversación ya no existe.');

            $messages = [];
            foreach ($this->qWaThread($id) as $m) $messages[] = $this->messageRow($m);

            if (Permission::can(self::WA, 'update')) {
                try {
                    $this->qWaSeen($id, date('Y-m-d H:i:s', $this->inboxNow()));
                } catch (Throwable $e) {
                    $this->inboxLog('[ BANDEJA ] :: no se marco como leido el chat ' . $id);
                }
            }

            $head = $this->chatHead($chat);
            $last = $messages ? $messages[count($messages) - 1] : null;

            // «Ya abrimos»: '' = no aplica (ventana abierta o ya contestado); 'ok' = se puede; si no, por que no.
            $block          = $this->reopenBlock($chat, $this->qWaAgent($this->companyId()), $last);
            $head['reopen'] = in_array($block, ['window', 'answered'], true) ? '' : ($block === '' ? 'ok' : $block);

            return [
                'status'   => 200,
                'chat'     => $head,
                'messages' => $messages,
                'proposal' => $this->proposalOut($id),
                'ai'       => (bool) $this->agentModel()
            ];
        }, 'No se pudo abrir la conversación.');
    }

    // Respuesta a mano. Sin token sale como 'simulated'; con la ventana de 24 h cerrada no sale.
    public function sendReply() {
        $fail = $this->needWa('update', 'contestar en WhatsApp') ?: $this->needBranch();
        if ($fail) return $fail;

        $id   = $this->postId();
        $text = trim(str_replace("\r", '', (string) ($_POST['text'] ?? '')));

        if ($text === '') return $this->fail(422, 'Escribe el mensaje.');
        if ($this->tooLong($text, WhatsAppMeta::MAX_TEXT)) return $this->fail(422, 'El mensaje admite hasta ' . number_format(WhatsAppMeta::MAX_TEXT) . ' caracteres.');

        $companyId = $this->companyId();
        $userId    = $this->userId();

        return $this->attempt(function () use ($id, $text, $companyId, $userId) {
            $chat = $id > 0 ? $this->qWaChat($id, $companyId) : null;
            if (!$chat) return $this->fail(404, 'Esa conversación ya no existe.');

            if (!$this->inboxWindowOpen($chat['last_in_at'])) {
                return $this->fail(409, 'Pasaron más de 24 h desde el último mensaje del cliente: WhatsApp solo deja mandarle una plantilla aprobada.');
            }

            $agent = $this->qWaAgent($companyId);
            $sim   = $this->isSim($chat['wa_id']);

            if (!$agent && !$sim) return $this->fail(409, 'La empresa no tiene número de WhatsApp dado de alta.');

            session_write_close();

            $sent = $this->inboxSend($agent ?: [], $chat, $text, $userId);

            try {
                $this->qWaSeen($id, date('Y-m-d H:i:s', $this->inboxNow()));
            } catch (Throwable $e) {
                $this->inboxLog('[ BANDEJA ] :: no se marco como leido el chat ' . $id);
            }

            // Ya contesto una persona: la propuesta abierta sobra.
            try {
                $this->qWaRetireOpen($id, $userId ?: null, date('Y-m-d H:i:s', $this->inboxNow()));
            } catch (Throwable $e) {
                $this->inboxLog('[ BANDEJA ] :: no se retiro la propuesta del chat ' . $id);
            }

            $messages = [
                'sent'      => 'Mensaje enviado.',
                'simulated' => 'Modo simulado: quedó en la conversación y no salió a la red.',
                'failed'    => 'No salió: ' . ($sent['detail'] !== '' ? $sent['detail'] : 'Meta no lo aceptó.')
            ];

            return [
                'status'     => $sent['status'] === 'failed' ? 409 : 200,
                'message'    => $messages[$sent['status']] ?? $messages['failed'],
                'sent'       => $sent['status'],
                'message_id' => (int) $sent['message_id']
            ];
        }, 'No se pudo mandar el mensaje.');
    }

    /*  Escribir como si fuera el cliente, sin Meta. Solo sin WHATSAPP_META_TOKEN.
        El chat queda con wa_id 'SIM-…': nada de el sale a la red. Corre lo
        automatico igual que un mensaje real (menu, sucursal elegida, horario).
        Con $_FILES['file'] el cliente «manda» una foto o un PDF (para probar
        comprobantes): se guarda en storage/whatsapp/<empresa> y el texto es su pie. */
    public function simulate() {
        $fail = $this->needWa('update', 'usar el simulador') ?: $this->needBranch();
        if ($fail) return $fail;

        if (!(new WhatsAppMeta())->status()['simulated']) {
            return $this->fail(409, 'El simulador solo funciona mientras no haya token de Meta: con token, prueba desde un teléfono.');
        }

        $phone = preg_replace('/\D/', '', $this->post('phone'));
        $name  = trim((string) preg_replace('/\s+/u', ' ', $this->post('name')));
        $text  = trim(str_replace("\r", '', (string) ($_POST['text'] ?? '')));

        if (!preg_match('/^\d{10}$/', $phone))              return $this->fail(422, 'El teléfono del cliente va a 10 dígitos.');
        if ($this->tooLong($name, WhatsAppMeta::MAX_NAME))  return $this->fail(422, 'El nombre admite hasta ' . WhatsAppMeta::MAX_NAME . ' caracteres.');
        if ($this->tooLong($text, WhatsAppMeta::MAX_TEXT))  return $this->fail(422, 'El mensaje admite hasta ' . number_format(WhatsAppMeta::MAX_TEXT) . ' caracteres.');

        $file = $this->simFile();
        if (isset($file['status'])) return $file;

        if ($text === '' && !$file) return $this->fail(422, 'Escribe lo que manda el cliente, o adjunta una foto.');

        $companyId = $this->companyId();

        session_write_close();

        return $this->attempt(function () use ($companyId, $phone, $name, $text, $file) {
            $existing = $this->qWaChatByPhone($companyId, $phone);

            if ($existing && !$this->isSim($existing['wa_id'])) {
                return $this->fail(409, 'Ese teléfono ya tiene una conversación real; usa otro para simular.');
            }

            $path = null;
            $rel  = null;

            if ($file) {
                $dir = $this->agentWaDir($companyId);

                if (!is_dir($dir) && !@mkdir($dir, 0775, true) && !is_dir($dir)) {
                    throw new RuntimeException('simulador: no se pudo crear la carpeta de archivos de la empresa ' . $companyId);
                }

                $stored = bin2hex(random_bytes(16)) . '.' . $file['ext'];
                $path   = $dir . '/' . $stored;
                $rel    = $companyId . '/' . $stored;

                if (@file_put_contents($path, $file['bytes'], LOCK_EX) !== strlen($file['bytes'])) {
                    @unlink($path);

                    throw new RuntimeException('simulador: no se pudo guardar el archivo');
                }
            }

            $msg = [
                'phone_number_id' => '',
                'wa_id'           => 'SIM-52' . $phone,
                'phone'           => $phone,
                'name'            => $name,
                'wamid'           => 'sim.' . bin2hex(random_bytes(12)),
                'type'            => $file ? ($file['ext'] === 'pdf' ? 'document' : 'image') : 'text',
                'body'            => $text,
                'media_id'        => $file ? 'SIM-' . bin2hex(random_bytes(8)) : null,
                'media_type'      => $file ? $file['mime'] : null,
                'media_path'      => $rel,
                'sent_at'         => $this->inboxNow(),
                'raw'             => null,
                'skip'            => ''
            ];

            try {
                $chatId = $this->transaction(function () use ($companyId, $msg) {
                    return $this->inboxSave($companyId, $msg);
                });
            } catch (Throwable $e) {
                if ($path !== null) @unlink($path);

                throw $e;
            }

            if ($chatId <= 0) {
                if ($path !== null) @unlink($path);

                return $this->fail(500, 'No se pudo guardar el mensaje del cliente.');
            }

            $menus = 0;

            try {
                $menus = $this->inboxAfter($companyId, [$chatId => $text]);
            } catch (Throwable $e) {
                $this->inboxLog('[ AGENTE ] :: simulador :: ' . $e->getMessage());
            }

            $open = $this->inboxIsOpen($this->qWaAgent($companyId));

            $message = 'Mensaje del cliente guardado.';
            if (!$open)     $message .= ' El agente está fuera de horario: no salió nada automático.';
            else if ($menus) $message .= ' Salió el menú de sucursales (simulado).';

            return $this->ok($message, ['chat_id' => $chatId, 'open' => $open, 'menus' => $menus]);
        }, 'No se pudo simular el mensaje.');
    }

    // '' = sin sucursal. Una persona puede cambiarla siempre (la del menu no la pisa).
    public function setChatBranch() {
        $fail = $this->needWa('update', 'asignar la sucursal de una conversación') ?: $this->needBranch();
        if ($fail) return $fail;

        $id     = $this->postId();
        $branch = $this->selectOrNull('branch_id');

        if ($branch !== null && !in_array($branch, array_map('intval', array_column($this->qCompanyBranches($this->companyId()), 'id')), true)) {
            return $this->fail(422, 'Esa sucursal no es de la empresa.');
        }

        return $this->attempt(function () use ($id, $branch) {
            if ($id <= 0 || !$this->qWaChat($id, $this->companyId())) return $this->fail(404, 'Esa conversación ya no existe.');

            $this->qWaSetBranch($id, $branch, date('Y-m-d H:i:s'));

            return $this->ok($branch !== null ? 'Sucursal asignada.' : 'La conversación quedó sin sucursal.');
        }, 'No se pudo asignar la sucursal.');
    }

    // -- Propuestas del agente --

    /*  La propuesta automatica de un chat, como la arma el cron (horario, tope
        por hora, lo ya contestado). La pide la pantalla despues del
        simulador. Que no toque proponer no es error: state lo dice. */
    public function agentAuto() {
        $fail = $this->needWa('update', 'usar el agente de WhatsApp') ?: $this->needBranch();
        if ($fail) return $fail;

        $id        = $this->postId();
        $companyId = $this->companyId();

        session_write_close();

        return $this->attempt(function () use ($id, $companyId) {
            if ($id <= 0 || !$this->qWaChat($id, $companyId)) return $this->fail(404, 'Esa conversación ya no existe.');

            $r = $this->agentPropose($companyId, $id, null);

            return [
                'status'   => 200,
                'state'    => $r['state'],
                'reason'   => $r['reason'],
                'message'  => $r['message'],
                'proposal' => $this->proposalOut($id)
            ];
        }, 'No se pudo armar la propuesta.');
    }

    // «Proponer»: a mano, sin tope por hora, pero solo con el agente en horario.
    public function proposeNow() {
        $fail = $this->needWa('update', 'pedirle propuestas al agente') ?: $this->needBranch();
        if ($fail) return $fail;

        $id        = $this->postId();
        $companyId = $this->companyId();
        $userId    = (int) $this->userId();

        session_write_close();

        return $this->attempt(function () use ($id, $companyId, $userId) {
            if ($id <= 0 || !$this->qWaChat($id, $companyId)) return $this->fail(404, 'Esa conversación ya no existe.');

            $r = $this->agentPropose($companyId, $id, $userId);

            if (in_array($r['state'], ['skip', 'off'], true) && $r['reason'] !== 'nothing') return $this->fail(409, $r['message']);

            return [
                'status'   => 200,
                'state'    => $r['state'],
                'message'  => $r['message'],
                'proposal' => $this->proposalOut($id)
            ];
        }, 'No se pudo armar la propuesta.');
    }

    // Para la pantalla mientras el agente arma la propuesta.
    public function getProposal() {
        $fail = $this->needWa('show') ?: $this->needBranch();
        if ($fail) return $fail;

        $id = $this->postId();

        return $this->attempt(function () use ($id) {
            if ($id <= 0 || !$this->qWaChat($id, $this->companyId())) return $this->fail(404, 'Esa conversación ya no existe.');

            return ['status' => 200, 'proposal' => $this->proposalOut($id)];
        }, 'No se pudo leer la propuesta.');
    }

    /*  Manda la propuesta, tal cual (sent) o cambiada (edited). Se marca antes
        de mandar, con la fila apartada: dos clics no la mandan dos veces.
        Si trae un pedido (action 'order'), se crea ahi mismo y «{folio}» del
        texto se cambia por su folio; si la persona lo borro, el folio va al final. */
    public function sendProposal() {
        $fail = $this->needWa('update', 'contestar en WhatsApp') ?: $this->needBranch();
        if ($fail) return $fail;

        $id   = $this->postId();
        $text = trim(str_replace("\r", '', (string) ($_POST['text'] ?? '')));

        if ($text === '') return $this->fail(422, 'La respuesta no puede ir vacía.');
        if ($this->tooLong($text, WhatsAppMeta::MAX_TEXT)) return $this->fail(422, 'El mensaje admite hasta ' . number_format(WhatsAppMeta::MAX_TEXT) . ' caracteres.');

        $companyId = $this->companyId();
        $userId    = (int) $this->userId();

        return $this->attempt(function () use ($id, $text, $companyId, $userId) {
            $now = date('Y-m-d H:i:s', $this->inboxNow());

            $claim = $this->transaction(function () use ($id, $text, $companyId, $userId, $now) {
                $p = $id > 0 ? $this->qWaLockProposal($id, $companyId) : null;

                if (!$p)                       return $this->fail(404, 'Esa propuesta ya no existe.');
                if ($p['status'] !== 'pending') return $this->fail(409, 'Esa propuesta ya se mandó o se descartó.');

                $chat = $this->qWaChat((int) $p['chat_id'], $companyId);

                if (!$chat)                                      return $this->fail(404, 'Esa conversación ya no existe.');
                if (!$this->inboxWindowOpen($chat['last_in_at'])) return $this->fail(409, 'Pasaron más de 24 h desde el último mensaje del cliente: WhatsApp solo deja mandarle una plantilla aprobada.');

                $agent = $this->qWaAgent($companyId);
                if (!$agent && !$this->isSim($chat['wa_id'])) return $this->fail(409, 'La empresa no tiene número de WhatsApp dado de alta.');

                $status  = $text === trim((string) $p['body']) ? 'sent' : 'edited';
                $isOrder = $p['action'] === 'order' && $p['sale_id'] === null;
                $saleId  = 0;

                if (!$isOrder && strpos($text, '{folio}') !== false) {
                    return $this->fail(422, 'La respuesta trae «{folio}», pero esta propuesta no crea un pedido. Quita esa parte o pide otra propuesta.');
                }

                if ($isOrder && $this->tooLong($text, WhatsAppMeta::MAX_TEXT - 40)) {
                    return $this->fail(422, 'El mensaje es muy largo para llevar el folio del pedido: acórtalo un poco.');
                }

                // El pedido se crea aqui, con la propuesta apartada. Si ya no se puede (409), no se escribio nada y la propuesta no sale.
                if ($isOrder) {
                    $order = $this->agentOrderCreate($p, $chat, $agent ?: [], $userId);

                    if ($order['status'] !== 200) return $this->fail(409, $order['message']);

                    $saleId = (int) $order['sale_id'];
                }

                $final = $this->folioIn($text, $saleId);

                $this->qWaDecideProposal($id, $status, $final, $userId ?: null, $now);

                return ['status' => 200, 'chat' => $chat, 'agent' => $agent ?: [], 'decided' => $status, 'text' => $final, 'sale_id' => $saleId];
            });

            if ($claim['status'] !== 200) return $claim;

            session_write_close();

            $chat = $claim['chat'];
            $sent = $this->inboxSend($claim['agent'], $chat, $claim['text'], $userId);

            try {
                $this->qWaSetProposalMessage($id, (int) $sent['message_id']);
                $this->qWaSeen((int) $chat['id'], $now);
            } catch (Throwable $e) {
                $this->inboxLog('[ BANDEJA ] :: propuesta ' . $id . ' :: ' . $e->getMessage());
            }

            $messages = [
                'sent'      => 'Respuesta enviada.',
                'simulated' => 'Modo simulado: quedó en la conversación y no salió a la red.',
                'failed'    => 'No salió: ' . ($sent['detail'] !== '' ? $sent['detail'] : 'Meta no lo aceptó.')
            ];

            $folio   = $claim['sale_id'] > 0 ? 'P' . $claim['sale_id'] : '';
            $message = $messages[$sent['status']] ?? $messages['failed'];

            if ($folio !== '') {
                $message .= $sent['status'] === 'failed'
                    ? " El pedido {$folio} sí se creó: está en Tienda en línea › Nuevos."
                    : " Se creó el pedido {$folio}: acéptalo en Tienda en línea › Nuevos.";
            }

            return [
                'status'     => $sent['status'] === 'failed' ? 409 : 200,
                'message'    => $message,
                'sent'       => $sent['status'],
                'decided'    => $claim['decided'],
                'message_id' => (int) $sent['message_id'],
                'sale_id'    => $claim['sale_id'] > 0 ? $claim['sale_id'] : null,
                'folio'      => $folio
            ];
        }, 'No se pudo mandar la respuesta.');
    }

    public function discardProposal() {
        $fail = $this->needWa('update', 'descartar propuestas del agente') ?: $this->needBranch();
        if ($fail) return $fail;

        $id        = $this->postId();
        $companyId = $this->companyId();
        $userId    = (int) $this->userId();

        return $this->attempt(function () use ($id, $companyId, $userId) {
            return $this->transaction(function () use ($id, $companyId, $userId) {
                $p = $id > 0 ? $this->qWaLockProposal($id, $companyId) : null;

                if (!$p) return $this->fail(404, 'Esa propuesta ya no existe.');
                if (!in_array($p['status'], ['pending', 'failed', 'working'], true)) return $this->fail(409, 'Esa propuesta ya se mandó o se descartó.');

                $this->qWaDecideProposal($id, 'discarded', (string) $p['body'], $userId ?: null, date('Y-m-d H:i:s', $this->inboxNow()));

                return $this->ok('Propuesta descartada.');
            });
        }, 'No se pudo descartar la propuesta.');
    }

    // «Devolver al agente»: el chat deja de estar con una persona y el agente vuelve a proponer solo.
    public function agentBack() {
        $fail = $this->needWa('update', 'atender las conversaciones de WhatsApp') ?: $this->needBranch();
        if ($fail) return $fail;

        $id = $this->postId();

        return $this->attempt(function () use ($id) {
            if ($id <= 0 || !$this->qWaChat($id, $this->companyId())) return $this->fail(404, 'Esa conversación ya no existe.');

            $this->qWaAgentBack($id, date('Y-m-d H:i:s', $this->inboxNow()));

            return $this->ok('El agente vuelve a proponer en esta conversación.');
        }, 'No se pudo devolver la conversación al agente.');
    }

    // -- Agente --

    public function getAgent() {
        $fail = $this->needWa('show') ?: $this->needBranch();
        if ($fail) return $fail;

        return $this->attempt(function () {
            return [
                'status' => 200,
                'agent'  => $this->agentInfo($this->qWaAgent($this->companyId()), true),
                'conn'   => (new WhatsAppMeta())->status()
            ];
        }, 'No se pudo cargar el agente.');
    }

    /*  Encendido, horario por dia y de donde sale el catalogo del agente.
        hours = {"0":[["09:00","20:00"]], ...}; un dia sin tramos = cerrado.
        Cierre "00:00" = medianoche ("24:00"). catalog_mode: 'store' (Tienda en
        linea) u 'own' (la lista de saveAgentProducts); si no llega, se queda
        como estaba. auto_topics (F6): los temas que salen solos, separados por
        coma ('negocio', 'catalogo'); '' = todo a la bandeja; si no llega, se
        queda como estaba. */
    public function saveAgent() {
        $fail = $this->needWa('create', 'cambiar el agente de WhatsApp') ?: $this->needBranch();
        if ($fail) return $fail;

        $enabled = $this->post('enabled') === '1' ? 1 : 0;
        $hours   = $this->hoursIn($this->postedJson('hours'));
        $mode    = isset($_POST['catalog_mode']) ? ($this->post('catalog_mode') === 'own' ? 'own' : 'store') : null;
        $topics  = isset($_POST['auto_topics']) ? $this->agentAutoTopics(['auto_topics' => $this->post('auto_topics')]) : null;

        if (is_string($hours)) return $this->fail(422, $hours);
        if ($enabled && !array_filter($hours)) return $this->fail(422, 'Pon horario al menos a un día, o deja el agente apagado.');

        return $this->attempt(function () use ($enabled, $hours, $mode, $topics) {
            $agent = $this->qWaAgent($this->companyId());
            if (!$agent) return $this->fail(404, 'La empresa todavía no tiene número de WhatsApp para el agente. Lo da de alta soporte.');

            if ($mode === null) $mode = (string) $agent['catalog_mode'] === 'own' ? 'own' : 'store';
            if ($topics === null) $topics = $this->agentAutoTopics($agent);

            if ($mode === 'own' && !$this->qWaAgentProductIds($this->companyId())) {
                return $this->fail(422, 'La lista propia está vacía: elige los productos en «Elegir productos», o usa el catálogo de la Tienda en línea.');
            }

            $this->must($this->qUpdateIn('wa_agent', [
                'values' => ['enabled', 'hours', 'catalog_mode', 'auto_topics', 'updated_user_id', 'updated_at'],
                'where'  => ['id', 'company_id'],
                'data'   => [$enabled, json_encode((object) $hours), $mode, $topics ? implode(',', $topics) : null, $this->userId() ?: null, date('Y-m-d H:i:s'), (int) $agent['id'], $this->companyId()]
            ]), 'saveAgent');

            return $this->ok($enabled ? 'Agente encendido.' : 'Agente apagado: los mensajes se guardan y nada sale solo.', [
                'agent' => $this->agentInfo($this->qWaAgent($this->companyId()), true)
            ]);
        }, 'No se pudo guardar el agente.');
    }

    // Los productos de la empresa para armar la lista propia del agente; picked = ya esta en la lista.
    public function lsAgentProducts() {
        $fail = $this->needWa('show') ?: $this->needBranch();
        if ($fail) return $fail;

        return $this->attempt(function () {
            $picked = array_flip($this->qWaAgentProductIds($this->companyId()));
            $rows   = [];
            $count  = 0;

            foreach ($this->qWaCompanyProducts($this->companyId()) as $p) {
                $on = isset($picked[(int) $p['id']]);
                if ($on) $count++;

                $rows[] = [
                    'id'       => (int) $p['id'],
                    'name'     => trim((string) $p['name']),
                    'price'    => round((float) $p['price'], 2),
                    'category' => (string) $p['category'] !== '' ? (string) $p['category'] : 'Otros',
                    'branch'   => (string) $p['branch'],
                    'store'    => (int) $p['in_catalog'] === 1,
                    'picked'   => $on
                ];
            }

            return ['status' => 200, 'row' => $rows, 'count' => count($rows), 'picked' => $count];
        }, 'No se pudieron cargar los productos.');
    }

    /*  La lista propia del agente, completa: lo que no llegue se quita. Solo
        entran productos de la empresa que Pedidos sabe vender. No se puede
        dejar vacia mientras el agente la este usando. */
    public function saveAgentProducts() {
        $fail = $this->needWa('create', 'cambiar el agente de WhatsApp') ?: $this->needBranch();
        if ($fail) return $fail;

        $posted = $this->postedJson('product_ids');
        if ($posted === null) return $this->fail(422, 'La lista no llegó bien; recarga la página.');

        $ids = [];

        foreach ($posted as $value) {
            if (is_scalar($value) && (int) $value > 0) $ids[(int) $value] = (int) $value;
        }

        $ids = array_values($ids);

        if (count($ids) > 500) return $this->fail(422, 'La lista propia admite hasta 500 productos.');

        return $this->attempt(function () use ($ids) {
            $companyId = $this->companyId();
            $agent     = $this->qWaAgent($companyId);

            if (!$agent) return $this->fail(404, 'La empresa todavía no tiene número de WhatsApp para el agente. Lo da de alta soporte.');

            if (!$ids && (string) $agent['catalog_mode'] === 'own') {
                return $this->fail(422, 'El agente está usando la lista propia: deja al menos un producto, o cámbialo antes a «Tienda en línea».');
            }

            $this->transaction(function () use ($companyId, $ids) {
                $this->qWaReplaceAgentProducts($companyId, $ids, date('Y-m-d H:i:s'));

                return true;
            });

            $info = $this->agentInfo($agent, true);
            $n    = $info['own_count'];

            return $this->ok($n === 1 ? 'Lista guardada: 1 producto.' : "Lista guardada: {$n} productos.", ['agent' => $info]);
        }, 'No se pudo guardar la lista.');
    }

    // -- Recordatorios de adeudo --

    // Quien debe y si le toca recordatorio hoy. No manda nada.
    public function lsReminders() {
        $fail = $this->needWa('show') ?: $this->needBranch();
        if ($fail) return $fail;

        $companyId = $this->companyId();

        return $this->attempt(function () use ($companyId) {
            $agent  = $this->qWaReminderAgent($companyId);
            $list   = $this->reminderList($companyId);
            $count  = ['send' => 0, 'cap' => 0, 'other' => 0, 'week' => 0, 'baja' => 0, 'phone' => 0];
            $order  = ['send' => 0, 'cap' => 1, 'other' => 2, 'week' => 3, 'baja' => 4, 'phone' => 5];
            $sample = null;

            foreach ($list as $r) {
                $count[$r['state']]++;
                if (!$sample && $r['state'] === 'send') $sample = $r;
            }

            usort($list, function ($a, $b) use ($order) {
                return $order[$a['state']] <=> $order[$b['state']] ?: $b['debt'] <=> $a['debt'];
            });

            $meta    = new WhatsAppMeta();
            $company = $this->qCompany($companyId);
            $base    = $this->agentPublicBase();
            $preview = $this->waTemplateFill('saldo', [
                $sample ? $this->waFirstName($sample['name']) : 'Laura',
                $this->waBusinessLabel($company ? $company['name'] : '', $sample ? $sample['branch'] : $this->scope()['branch']),
                $this->agentMoney($sample ? $sample['debt'] : 450),
                ($base !== '' ? $base : 'https://…') . '/portal.php?t=…'
            ]);

            return [
                'status'   => 200,
                'row'      => array_map([$this, 'reminderRow'], $list),
                'count'    => $count,
                'today'    => $this->qWaRemindersSince($companyId, date('Y-m-d', $this->inboxNow()) . ' 00:00:00'),
                'dailyCap' => $this->reminderDailyCap(),
                'agent'    => [
                    'exists'    => (bool) $agent,
                    'enabled'   => $agent ? (int) $agent['enabled'] : 0,
                    'open'      => $agent ? $this->inboxIsOpen($agent) : false,
                    'reminders' => $agent ? (int) $agent['reminders'] : 0
                ],
                'template' => [
                    'saldo'   => array_merge($meta->templates()['saldo'], ['text' => $this->waTemplateText('saldo'), 'preview' => $preview]),
                    'abrimos' => array_merge($meta->templates()['abrimos'], ['text' => $this->waTemplateText('abrimos')])
                ],
                'simulated' => $meta->status()['simulated']
            ];
        }, 'No se pudo armar la lista de recordatorios.');
    }

    // Enciende o apaga los recordatorios automaticos (los manda el cron, en horario).
    public function toggleReminders() {
        $fail = $this->needWa('create', 'cambiar los recordatorios de WhatsApp') ?: $this->needBranch();
        if ($fail) return $fail;

        $on = $this->post('on') === '1';

        return $this->attempt(function () use ($on) {
            if (!$this->qWaReminderAgent($this->companyId())) {
                return $this->fail(404, 'La empresa todavía no tiene número de WhatsApp para el agente. Lo da de alta soporte.');
            }

            $this->qWaSetReminders($this->companyId(), $on, $this->userId(), date('Y-m-d H:i:s'));

            return $this->ok($on
                ? 'Recordatorios automáticos encendidos: salen solos en el horario del agente, uno por semana por cliente.'
                : 'Recordatorios automáticos apagados. La lista se sigue viendo y se puede mandar a mano.');
        }, 'No se pudieron cambiar los recordatorios.');
    }

    // «Mandar los de hoy»: los que la lista marca «Sale hoy», en horario del agente.
    public function sendReminders() {
        $fail = $this->needWa('create', 'mandar recordatorios de WhatsApp') ?: $this->needBranch();
        if ($fail) return $fail;

        $companyId = $this->companyId();
        $userId    = (int) $this->userId();

        return $this->attempt(function () use ($companyId, $userId) {
            $agent = $this->qWaReminderAgent($companyId);

            if (!$agent)                     return $this->fail(404, 'La empresa todavía no tiene número de WhatsApp para el agente. Lo da de alta soporte.');
            if (!$this->inboxIsOpen($agent)) return $this->fail(409, 'El agente está apagado o fuera de horario: los recordatorios solo salen en su horario.');

            session_write_close();

            $r    = $this->reminderRun($companyId, $userId ?: null, $this->reminderDailyCap(), time() + 100);
            $done = $r['sent'] + $r['simulated'];

            if (!$done && !$r['failed'] && !$r['skip']) return $this->fail(409, 'Hoy no le toca recordatorio a nadie.');

            $parts = [];
            if ($r['sent'])      $parts[] = $r['sent'] === 1 ? '1 enviado' : "{$r['sent']} enviados";
            if ($r['simulated']) $parts[] = $r['simulated'] === 1 ? '1 simulado (no salió a la red)' : "{$r['simulated']} simulados (no salieron a la red)";
            if ($r['failed'])    $parts[] = $r['failed'] === 1 ? '1 no salió' : "{$r['failed']} no salieron";
            if ($r['skip'])      $parts[] = $r['skip'] === 1 ? '1 se saltó' : "{$r['skip']} se saltaron";

            $message = 'Recordatorios: ' . implode(', ', $parts) . '.';
            if ($r['detail'] !== '' && ($r['failed'] || $r['skip'])) $message .= ' ' . $r['detail'];

            return ['status' => $done ? 200 : 409, 'message' => $message, 'result' => $r];
        }, 'No se pudieron mandar los recordatorios.');
    }

    /*  «Ya abrimos»: la plantilla para retomar un chat que se quedo sin respuesta
        mas de 24 h. El mensaje se aparta (con el chat bloqueado) antes de
        mandarlo: dos clics no la mandan dos veces. */
    public function sendReopen() {
        $fail = $this->needWa('update', 'contestar en WhatsApp') ?: $this->needBranch();
        if ($fail) return $fail;

        $id        = $this->postId();
        $companyId = $this->companyId();
        $userId    = (int) $this->userId();

        return $this->attempt(function () use ($id, $companyId, $userId) {
            $now = date('Y-m-d H:i:s', $this->inboxNow());

            $claim = $this->transaction(function () use ($id, $companyId, $userId, $now) {
                $chat = $id > 0 ? $this->qWaChat($id, $companyId) : null;
                if (!$chat || !$this->qWaLockChatById($id)) return $this->fail(404, 'Esa conversación ya no existe.');

                $agent = $this->qWaAgent($companyId);
                $why   = [
                    'window'   => 'La ventana de 24 h está abierta: contéstale normal.',
                    'answered' => 'Lo último de la conversación ya es nuestro: espera a que el cliente escriba.',
                    'baja'     => 'El cliente escribió BAJA: no se le mandan plantillas.',
                    'agent'    => 'La empresa no tiene número de WhatsApp dado de alta.',
                    'closed'   => 'El agente está apagado o fuera de horario: «Ya abrimos» sale en su horario.'
                ];
                $block = $this->reopenBlock($chat, $agent, $this->qWaLastMessage($id));

                if ($block !== '') return $this->fail(409, $why[$block]);

                $params    = $this->reopenParams($chat);
                $messageId = $this->waTemplateClaim($chat, $this->waTemplateFill('abrimos', $params), $userId, $now);

                return ['status' => 200, 'chat' => $chat, 'agent' => $agent, 'params' => $params, 'message_id' => $messageId];
            });

            if ($claim['status'] !== 200) return $claim;

            session_write_close();

            $sent = $this->waTemplateDeliver($claim['agent'], $claim['chat'], 'abrimos', $claim['params'], $claim['message_id']);

            try {
                $this->qWaSeen($id, $now);
            } catch (Throwable $e) {
                $this->inboxLog('[ BANDEJA ] :: no se marco como leido el chat ' . $id);
            }

            $messages = [
                'sent'      => '«Ya abrimos» enviado. Cuando el cliente conteste, se abre otra vez la ventana de 24 h.',
                'simulated' => 'Modo simulado: «Ya abrimos» quedó en la conversación y no salió a la red.',
                'failed'    => 'No salió: ' . ($sent['detail'] !== '' ? $sent['detail'] : 'Meta no lo aceptó.')
            ];

            return [
                'status'     => $sent['status'] === 'failed' ? 409 : 200,
                'message'    => $messages[$sent['status']] ?? $messages['failed'],
                'sent'       => $sent['status'],
                'message_id' => (int) $sent['message_id']
            ];
        }, 'No se pudo mandar «Ya abrimos».');
    }

    // -- Metricas --

    /*  Como va el agente en el periodo (today | 7 | 30): conversaciones
        resueltas sin persona, tiempo de respuesta, propuestas por tema y
        preguntas del dueño. Solo lee. */
    public function lsMetrics() {
        $fail = $this->needWa('show') ?: $this->needBranch();
        if ($fail) return $fail;

        $period = in_array($this->post('period'), ['today', '7', '30'], true) ? $this->post('period') : '7';

        [$from, $to] = $this->periodRange($period);

        $companyId = $this->companyId();

        return $this->attempt(function () use ($companyId, $from, $to) {
            $m    = $this->agentMetrics($companyId, $from, $to);
            $rows = [];

            foreach ($m['topics'] as $t) {
                if ($t['total'] > 0 || $t['can_auto']) $rows[] = $this->metricRow($t);
            }

            $m['response']['agent']['text']  = $this->secondsText($m['response']['agent']['median']);
            $m['response']['person']['text'] = $this->secondsText($m['response']['person']['median']);
            $m['owner']['text']              = $m['owner']['median_ms'] !== null ? $this->secondsText((int) round($m['owner']['median_ms'] / 1000)) : '';

            unset($m['topics']);

            return array_merge(['status' => 200, 'row' => $rows, 'from' => dmy(substr($from, 0, 10)), 'to' => dmy(date('Y-m-d', strtotime($to) - 1))], $m);
        }, 'No se pudieron calcular las métricas.');
    }

    // -- Avisos --

    // Los tres avisos con su texto vigente y si es el de fabrica.
    public function getNotices() {
        $fail = $this->needWa('show') ?: $this->needBranch();
        if ($fail) return $fail;

        return $this->attempt(function () {
            $defaults = $this->waDefaults();
            $notices  = [];

            foreach (self::TYPES as $type) {
                $notice = $this->waNotice($this->companyId(), $type);

                $notices[] = array_merge($notice, [
                    'default'    => $defaults[$type],
                    'preview'    => WhatsApp::fill($notice['body'], $this->waSample($type)),
                    'recipients' => count($this->qWaRecipients($this->companyId(), $this->branchId(), $type)),
                    'updated_at' => $notice['updated_at'] ? dmy(substr($notice['updated_at'], 0, 10)) : ''
                ]);
            }

            return ['status' => 200, 'row' => $notices];
        }, 'No se pudieron cargar los avisos.');
    }

    public function saveNotice() {
        $fail = $this->needWa('create') ?: $this->needBranch();
        if ($fail) return $fail;

        $type   = $this->post('type');
        $body   = rtrim(str_replace("\r", '', (string) ($_POST['body'] ?? '')));
        $active = $this->post('active') === '0' ? 0 : 1;

        if (!in_array($type, self::TYPES, true)) return $this->fail(422, 'Ese aviso no existe.');
        if (trim($body) === '')                  return $this->fail(422, 'El mensaje no puede ir vacío.');
        if ($this->tooLong($body, self::MAX_BODY)) return $this->fail(422, 'El mensaje admite hasta ' . number_format(self::MAX_BODY) . ' caracteres.');

        return $this->attempt(function () use ($type, $body, $active) {
            $this->noticeUpsert($type, $body, $active);

            return $this->ok($active ? 'Aviso guardado.' : 'Aviso guardado y pausado: no sale a nadie.');
        }, 'No se pudo guardar el aviso.');
    }

    // Enciende o pausa un aviso sin tocar su texto.
    public function toggleNotice() {
        $fail = $this->needWa('create') ?: $this->needBranch();
        if ($fail) return $fail;

        $type   = $this->post('type');
        $active = $this->post('active') === '1' ? 1 : 0;

        if (!in_array($type, self::TYPES, true)) return $this->fail(422, 'Ese aviso no existe.');

        return $this->attempt(function () use ($type, $active) {
            $notice = $this->waNotice($this->companyId(), $type);

            $this->noticeUpsert($type, $notice['body'], $active);

            return $this->ok($active ? 'Aviso encendido.' : 'Aviso pausado: no sale a nadie.');
        }, 'No se pudo cambiar el aviso.');
    }

    // El texto como le llegaria a WhatsApp, con datos de ejemplo.
    public function previewNotice() {
        $fail = $this->needWa('show') ?: $this->needBranch();
        if ($fail) return $fail;

        $type = $this->post('type');
        $body = str_replace("\r", '', (string) ($_POST['body'] ?? ''));

        if (!in_array($type, self::TYPES, true)) return $this->fail(422, 'Ese aviso no existe.');
        if ($this->tooLong($body, self::MAX_BODY)) return $this->fail(422, 'El mensaje admite hasta ' . number_format(self::MAX_BODY) . ' caracteres.');

        return ['status' => 200, 'text' => WhatsApp::fill($body, $this->waSample($type))];
    }

    // -- Destinatarios --

    public function lsRecipients() {
        $fail = $this->needWa('show') ?: $this->needBranch();
        if ($fail) return $fail;

        return $this->attempt(function () {
            $canEdit = Permission::can(self::WA, 'create');
            $rows    = [];

            foreach ($this->qWaRecipientList($this->companyId()) as $r) $rows[] = $this->recipientRow($r, $canEdit);

            return ['status' => 200, 'row' => $rows, 'count' => count($rows)];
        }, 'No se pudieron cargar los destinatarios.');
    }

    public function getRecipient() {
        $fail = $this->needWa('show') ?: $this->needBranch();
        if ($fail) return $fail;

        $id = $this->postId();

        return $this->attempt(function () use ($id) {
            $r = $id > 0 ? $this->qWaRecipient($id, $this->companyId()) : null;

            if (!$r) return $this->fail(404, 'Ese destinatario ya no existe.');

            return [
                'status' => 200,
                'row'    => [
                    'id'           => (int) $r['id'],
                    'name'         => (string) $r['name'],
                    'phone'        => (string) $r['phone'],
                    'branch_id'    => $r['branch_id'] !== null ? (int) $r['branch_id'] : '',
                    'notify_order' => (int) $r['notify_order'],
                    'notify_turn'  => (int) $r['notify_turn'],
                    'notify_day'   => (int) $r['notify_day'],
                    'can_ask'      => (int) $r['can_ask'],
                    'active'       => (int) $r['active']
                ]
            ];
        }, 'No se pudo abrir el destinatario.');
    }

    /*  id 0 = nuevo. can_ask (F6) = puede preguntarle al agente del dueño: solo
        un telefono de 10 digitos (un grupo no escribe al agente). Basta con
        eso o con un aviso. */
    public function saveRecipient() {
        $fail = $this->needWa('create') ?: $this->needBranch();
        if ($fail) return $fail;

        $id     = $this->postId();
        $name   = trim((string) preg_replace('/\s+/u', ' ', $this->post('name')));
        $phone  = WhatsApp::phone($this->post('phone'));
        $branch = $this->selectOrNull('branch_id');
        $ask    = $this->post('can_ask') === '1' ? 1 : 0;
        $flags  = [];

        foreach (['notify_order', 'notify_turn', 'notify_day'] as $key) $flags[$key] = $this->post($key) === '1' ? 1 : 0;

        if ($name === '')                         return $this->fail(422, 'Escribe el nombre de quien recibe los avisos.');
        if ($this->tooLong($name, self::MAX_NAME)) return $this->fail(422, 'El nombre admite hasta ' . self::MAX_NAME . ' caracteres.');
        if ($phone === '')                        return $this->fail(422, 'El teléfono va a 10 dígitos (sin lada de país) o como grupo, por ejemplo 120363000000000000@g.us.');
        if ($ask && !preg_match('/^\d{10}$/', $phone)) return $this->fail(422, 'Un grupo no puede preguntarle al agente: usa un teléfono de 10 dígitos.');
        if (!array_sum($flags) && !$ask)          return $this->fail(422, 'Marca al menos un aviso, o que pueda preguntarle al agente.');

        if ($branch !== null && !in_array($branch, array_map('intval', array_column($this->qCompanyBranches($this->companyId()), 'id')), true)) {
            return $this->fail(422, 'Esa sucursal no es de la empresa.');
        }

        return $this->attempt(function () use ($id, $name, $phone, $branch, $flags, $ask) {
            $now = date('Y-m-d H:i:s');

            if ($id > 0) {
                if (!$this->qWaRecipient($id, $this->companyId())) return $this->fail(404, 'Ese destinatario ya no existe.');

                $this->must($this->qUpdateIn('wa_recipient', [
                    'values' => ['name', 'phone', 'branch_id', 'notify_order', 'notify_turn', 'notify_day', 'can_ask', 'updated_at'],
                    'where'  => ['id', 'company_id'],
                    'data'   => [$name, $phone, $branch, $flags['notify_order'], $flags['notify_turn'], $flags['notify_day'], $ask, $now, $id, $this->companyId()]
                ]), 'saveRecipient');

                return $this->ok('Destinatario guardado.');
            }

            $this->must($this->qInsertInto('wa_recipient', [
                'values' => ['company_id', 'branch_id', 'name', 'phone', 'notify_order', 'notify_turn', 'notify_day', 'can_ask', 'active', 'created_at', 'updated_at'],
                'data'   => [$this->companyId(), $branch, $name, $phone, $flags['notify_order'], $flags['notify_turn'], $flags['notify_day'], $ask, 1, $now, $now]
            ]), 'saveRecipient');

            return $this->ok('Destinatario agregado.');
        }, 'No se pudo guardar el destinatario.');
    }

    // Pausado no recibe nada, pero no se pierde.
    public function toggleRecipient() {
        $fail = $this->needWa('create') ?: $this->needBranch();
        if ($fail) return $fail;

        $id     = $this->postId();
        $active = $this->post('active') === '1' ? 1 : 0;

        return $this->attempt(function () use ($id, $active) {
            if ($id <= 0 || !$this->qWaRecipient($id, $this->companyId())) return $this->fail(404, 'Ese destinatario ya no existe.');

            $this->must($this->qUpdateIn('wa_recipient', [
                'values' => ['active', 'updated_at'],
                'where'  => ['id', 'company_id'],
                'data'   => [$active, date('Y-m-d H:i:s'), $id, $this->companyId()]
            ]), 'toggleRecipient');

            return $this->ok($active ? 'Destinatario activo.' : 'Destinatario pausado: no recibe avisos.');
        }, 'No se pudo cambiar el destinatario.');
    }

    // Borrado real. El historial conserva el telefono de lo que ya se le mando.
    public function deleteRecipient() {
        $fail = $this->needWa('create') ?: $this->needBranch();
        if ($fail) return $fail;

        $id = $this->postId();

        return $this->attempt(function () use ($id) {
            if ($id <= 0 || !$this->qWaRecipient($id, $this->companyId())) return $this->fail(404, 'Ese destinatario ya no existe.');

            $this->must($this->_Delete([
                'table' => $this->crm . 'wa_recipient',
                'where' => ['id', 'company_id'],
                'data'  => [$id, $this->companyId()]
            ]), 'deleteRecipient');

            return $this->ok('Destinatario eliminado.');
        }, 'No se pudo eliminar el destinatario.');
    }

    // -- Historial --

    public function lsLog() {
        $fail = $this->needWa('show') ?: $this->needBranch();
        if ($fail) return $fail;

        $type = $this->post('type');
        if (!in_array($type, array_merge(self::TYPES, ['test', 'handoff']), true)) $type = '';

        [$from, $to] = $this->periodRange($this->post('period', '7'));

        return $this->attempt(function () use ($from, $to, $type) {
            $rows = [];

            foreach ($this->qWaLog($this->companyId(), $from, $to, $type) as $l) $rows[] = $this->logRow($l);

            return ['status' => 200, 'row' => $rows, 'count' => count($rows)];
        }, 'No se pudo cargar el historial.');
    }

    public function getLog() {
        $fail = $this->needWa('show') ?: $this->needBranch();
        if ($fail) return $fail;

        $id = $this->postId();

        return $this->attempt(function () use ($id) {
            $l = $id > 0 ? $this->qWaLogRow($id, $this->companyId()) : null;

            if (!$l) return $this->fail(404, 'Ese envío ya no existe.');

            return [
                'status' => 200,
                'row'    => [
                    'id'        => (int) $l['id'],
                    'type'      => $this->typeName($l['type']),
                    'reference' => (string) $l['reference'],
                    'recipient' => (string) $l['recipient'],
                    'phone'     => $this->phoneText($l['phone']),
                    'status'    => (string) $l['status'],
                    'provider'  => (string) $l['provider'],
                    'error'     => (string) $l['error'],
                    'body'      => (string) $l['body'],
                    'when'      => dmy(substr($l['created_at'], 0, 10)) . ' · ' . hour12(substr($l['created_at'], 11, 8))
                ]
            ];
        }, 'No se pudo abrir el envío.');
    }

    // -- Conexion --

    // Pregunta al proveedor si la instancia esta vinculada. No manda mensajes.
    public function checkConnection() {
        $fail = $this->needWa('create', 'comprobar la conexión de WhatsApp');
        if ($fail) return $fail;

        session_write_close();

        $wa = new WhatsApp();

        return ['status' => 200, 'conn' => $wa->status(), 'check' => $wa->check()];
    }

    /*  Un mensaje a un telefono escrito a mano. Con type, el aviso vigente con
        datos de ejemplo; sin type, un texto corto. Queda en el historial. */
    public function sendTest() {
        $fail = $this->needWa('create', 'mandar el mensaje de prueba') ?: $this->needBranch();
        if ($fail) return $fail;

        $phone = WhatsApp::phone($this->post('phone'));
        $type  = $this->post('type');

        if ($phone === '') return $this->fail(422, 'El teléfono va a 10 dígitos (sin lada de país) o como grupo …@g.us.');
        if ($type !== '' && !in_array($type, self::TYPES, true)) return $this->fail(422, 'Ese aviso no existe.');

        return $this->attempt(function () use ($phone, $type) {
            $text = $type !== ''
                ? WhatsApp::fill($this->waNotice($this->companyId(), $type)['body'], $this->waSample($type))
                : "✅ Mensaje de prueba de Huubie desde *{$this->scope()['branch']}*.\nSi lo lees, los avisos de WhatsApp ya llegan a este número.";

            session_write_close();

            $sent = (new WhatsApp())->send($phone, $text);

            $this->waLog([
                'branch_id'    => $this->branchId() ?: null,
                'type'         => 'test',
                'reference'    => 'Prueba' . ($type !== '' ? ' · ' . $this->typeName($type) : ''),
                'recipient_id' => null,
                'phone'        => $phone,
                'provider'     => $sent['provider'],
                'status'       => $sent['status'],
                'error'        => $sent['detail'] !== '' ? $sent['detail'] : null,
                'body'         => $text
            ]);

            $messages = [
                'sent'      => 'Mensaje enviado. Revisa el WhatsApp de ese número.',
                'simulated' => 'Modo simulado: el mensaje quedó en el historial y no salió a la red.',
                'failed'    => 'No salió: ' . ($sent['detail'] !== '' ? $sent['detail'] : 'el proveedor no lo aceptó.')
            ];

            return [
                'status'  => $sent['status'] === 'failed' ? 409 : 200,
                'message' => $messages[$sent['status']] ?? $messages['failed'],
                'sent'    => $sent['status'],
                'text'    => $text
            ];
        }, 'No se pudo mandar el mensaje de prueba.');
    }

    // -- Complements --

    private function needWa($action, $text = null) {
        if (Permission::can(self::WA, $action)) return null;

        $what = [
            'show'   => 'ver los avisos de WhatsApp',
            'create' => 'cambiar los avisos de WhatsApp',
            'update' => 'atender las conversaciones de WhatsApp'
        ];

        if ($text === null) $text = isset($what[$action]) ? $what[$action] : 'hacer esto';

        return ['status' => 403, 'message' => "Tu rol no tiene permiso para {$text}.", 'row' => []];
    }

    // Una fila por empresa y tipo: el UNIQUE (company_id, type) frena el doble alta.
    private function noticeUpsert($type, $body, $active) {
        $this->transaction(function () use ($type, $body, $active) {
            $now = date('Y-m-d H:i:s');

            if ($this->qWaNotice($this->companyId(), $type)) {
                $this->must($this->qUpdateIn('wa_notice', [
                    'values' => ['body', 'active', 'updated_user_id', 'updated_at'],
                    'where'  => ['company_id', 'type'],
                    'data'   => [$body, $active, $this->userId() ?: null, $now, $this->companyId(), $type]
                ]), 'noticeUpsert');

                return true;
            }

            $this->must($this->qInsertInto('wa_notice', [
                'values' => ['company_id', 'type', 'body', 'active', 'updated_user_id', 'created_at', 'updated_at'],
                'data'   => [$this->companyId(), $type, $body, $active, $this->userId() ?: null, $now, $now]
            ]), 'noticeUpsert');

            return true;
        });
    }

    // Periodo del filtro → [desde, hasta) sobre la fecha del envio.
    private function periodRange($period) {
        $tomorrow = date('Y-m-d', strtotime('+1 day')) . ' 00:00:00';
        $days     = ['today' => 0, '7' => 6, '30' => 29];

        if (!isset($days[$period])) return ['2000-01-01 00:00:00', $tomorrow];

        return [date('Y-m-d', strtotime('-' . $days[$period] . ' days')) . ' 00:00:00', $tomorrow];
    }

    private function typeName($type) {
        if ($type === 'test')    return 'Prueba';
        if ($type === 'handoff') return 'Cliente pide una persona';

        $types = $this->waTypes();

        return isset($types[$type]) ? $types[$type]['name'] : (string) $type;
    }

    // 9621234567 → 962 123 4567. Un grupo se queda como «Grupo».
    private function phoneText($phone) {
        $phone = (string) $phone;

        if (substr($phone, -5) === '@g.us') return 'Grupo';
        if (preg_match('/^\d{10}$/', $phone)) return substr($phone, 0, 3) . ' ' . substr($phone, 3, 3) . ' ' . substr($phone, 6);

        return $phone;
    }

    // -- Agente: datos para la pantalla --

    private function isSim($waId) {
        return strpos((string) $waId, 'SIM-') === 0;
    }

    /*  Lo que la pantalla sabe del numero; nunca el phone_number_id.
        $withCatalog suma cuantos productos tiene la lista propia (la pestaña
        «Agente»; la lista de chats lo pide cada 20 s y no lo necesita). */
    private function agentInfo($agent, $withCatalog = false) {
        $info = [
            'exists'       => (bool) $agent,
            'enabled'      => $agent ? (int) $agent['enabled'] : 0,
            'phone'        => $agent ? (string) $agent['display_phone'] : '',
            'open'         => $agent ? $this->inboxIsOpen($agent) : false,
            'hours'        => $this->hoursOut($agent ? $agent['hours'] : null),
            'catalog_mode' => $agent && (string) $agent['catalog_mode'] === 'own' ? 'own' : 'store',
            'auto_topics'  => $agent ? $this->agentAutoTopics($agent) : []
        ];

        if ($withCatalog) $info['own_count'] = $agent ? count($this->qWaAgentProductIds((int) $agent['company_id'])) : 0;

        return $info;
    }

    // «{folio}» → P123. Si la persona lo borro del texto, el folio va al final.
    private function folioIn($text, $saleId) {
        if ($saleId <= 0) return $text;

        $folio = 'P' . (int) $saleId;

        return strpos($text, '{folio}') !== false
            ? str_replace('{folio}', $folio, $text)
            : $text . "\n\nFolio de tu pedido: *{$folio}*";
    }

    /*  La foto o el PDF que «manda» el cliente en el simulador: ['bytes', 'ext',
        'mime'], null si no adjunto nada, o el error para la pantalla. El tipo
        sale del contenido, nunca del nombre. Tope 5 MB, como lo de Meta. */
    private function simFile() {
        $f = $_FILES['file'] ?? null;

        if (!is_array($f) || !isset($f['error']) || is_array($f['error']) || (int) $f['error'] === UPLOAD_ERR_NO_FILE) return null;

        $error = (int) $f['error'];
        $big   = 'El archivo pesa demasiado: sube una foto o un PDF de hasta 5 MB.';

        if ($error === UPLOAD_ERR_INI_SIZE || $error === UPLOAD_ERR_FORM_SIZE)          return $this->fail(413, $big);
        if ($error !== UPLOAD_ERR_OK || !is_uploaded_file((string) $f['tmp_name']))     return $this->fail(422, 'El archivo no terminó de subir. Intenta otra vez.');
        if ((int) $f['size'] <= 0)                                                      return $this->fail(422, 'El archivo está vacío.');
        if ((int) $f['size'] > 5242880)                                                 return $this->fail(413, $big);

        $bytes = (string) @file_get_contents((string) $f['tmp_name']);
        $kind  = $this->agentFileKind($bytes);

        if (!$kind) return $this->fail(415, 'Adjunta una foto (JPG, PNG o WEBP) o un PDF.');

        return ['bytes' => $bytes, 'ext' => $kind['ext'], 'mime' => $kind['mime']];
    }

    // El pedido que se crea al mandar la propuesta, listo para la tarjeta. Null si el borrador no se entiende.
    private function draftOut($json) {
        $d = json_decode((string) $json, true);

        if (!is_array($d) || empty($d['lines']) || !is_array($d['lines'])) return null;

        $lines = [];

        foreach ($d['lines'] as $l) {
            if (!is_array($l)) continue;

            $qty = (int) ($l['quantity'] ?? 0);

            $lines[] = ['name' => (string) ($l['name'] ?? ''), 'quantity' => $qty, 'amount' => round((float) ($l['price'] ?? 0) * $qty, 2)];
        }

        $date = (string) ($d['date'] ?? '');
        $time = (string) ($d['time'] ?? '');
        $home = ($d['delivery'] ?? '') === 'delivery';
        $when = [];

        if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $date))     $when[] = dmy($date);
        if (preg_match('/^\d{2}:\d{2}(:\d{2})?$/', $time))  $when[] = hour12($time);

        return [
            'lines'    => $lines,
            'total'    => round((float) ($d['total'] ?? 0), 2),
            'delivery' => $home ? 'Envío a domicilio' : 'Recoge en sucursal',
            'address'  => $home ? (string) ($d['address'] ?? '') : '',
            'when'     => implode(' · ', $when),
            'payment'  => ($d['payment'] ?? '') === 'transfer' ? 'Transferencia' : 'Paga en sucursal',
            'name'     => (string) ($d['name'] ?? ''),
            'note'     => (string) ($d['note'] ?? '')
        ];
    }

    // Siempre 7 listas de tramos (0 = domingo). Lo que no se entiende = cerrado.
    private function hoursOut($json) {
        $hours = json_decode((string) $json, true);
        $out   = [];

        for ($day = 0; $day < 7; $day++) {
            $ranges = [];
            $list   = is_array($hours) && isset($hours[$day]) && is_array($hours[$day]) ? $hours[$day] : [];

            foreach ($list as $range) {
                if (is_array($range) && count($range) === 2) $ranges[] = array_map('strval', array_values($range));
            }

            $out[] = $ranges;
        }

        return $out;
    }

    // Valida el horario que manda la pantalla. Devuelve las 7 listas o el texto del error.
    private function hoursIn($hours) {
        if (!is_array($hours)) return 'El horario no llegó bien; recarga la página.';

        $days = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
        $hhmm = '/^([01]\d|2[0-3]):[0-5]\d$/';
        $out  = [];

        for ($day = 0; $day < 7; $day++) {
            $list = isset($hours[$day]) && is_array($hours[$day]) ? $hours[$day] : [];
            if (count($list) > 3) return "El {$days[$day]} admite hasta 3 tramos.";

            $ranges = [];

            foreach ($list as $range) {
                list($from, $to) = is_array($range) && count($range) === 2 ? array_map('strval', array_values($range)) : ['', ''];

                if ($to === '00:00' || $to === '24:00') $to = '24:00';

                if (!preg_match($hhmm, $from) || ($to !== '24:00' && !preg_match($hhmm, $to))) {
                    return "Revisa las horas del {$days[$day]}.";
                }

                if ($to <= $from) return "El {$days[$day]} cierra antes de abrir.";

                $ranges[] = [$from, $to];
            }

            $out[$day] = $ranges;
        }

        return $out;
    }

    // -- Bandeja: filas --

    // $proposal = 'pending' | 'working' | '' (para la marca «Propuesta» de la lista).
    private function chatRow($c, $proposal = '') {
        return [
            'proposal'    => (string) $proposal,
            'id'          => (int) $c['id'],
            'name'        => $c['name'] !== '' ? (string) $c['name'] : $this->phoneText($c['phone']),
            'phone'       => $this->phoneText($c['phone']),
            'branch_id'   => $c['branch_id'] !== null ? (int) $c['branch_id'] : null,
            'branch'      => $c['branch_id'] !== null ? ($c['branch'] !== '' ? (string) $c['branch'] : 'Sucursal borrada') : '',
            'unread'      => (int) $c['unread'],
            'preview'     => $this->preview($c['last_type'], $c['last_body']),
            'last_dir'    => (string) $c['last_dir'],
            'last_status' => (string) $c['last_status'],
            'when'        => $this->whenText($c['last_message_at']),
            'window'      => $this->inboxWindowOpen($c['last_in_at']),
            'opt_out'     => (int) $c['opt_out'] === 1,
            'sim'         => $this->isSim($c['wa_id']),
            'human'       => $this->agentIsHuman($c),
            'owner'       => (int) $c['owner'] === 1
        ];
    }

    /*  La propuesta abierta del chat para la tarjeta de la bandeja, o null.
        Una 'working' de mas de 3 min sale como fallida. outdated = el cliente
        escribio despues de que se armo. */
    private function proposalOut($chatId) {
        $p = $this->qWaOpenProposal($chatId);
        if (!$p) return null;

        $status = (string) $p['status'];
        $error  = (string) $p['error'];
        $stamp  = strtotime((string) $p['created_at']);

        if ($status === 'working' && $stamp && $stamp < $this->inboxNow() - $this->agentStaleSeconds()) {
            $status = 'failed';
            $error  = 'El agente tardó demasiado; vuelve a pedirla.';
        }

        $labels = [
            'catalogo_buscar' => 'Catálogo',
            'negocio_datos'   => 'Datos del negocio',
            'pedido_estado'   => 'Estado de pedido',
            'saldo_cliente'   => 'Saldo',
            'portal_enlace'   => 'Portal',
            'pedido_borrador'     => 'Pedido',
            'pasar_a_persona'     => 'Pasar a persona',
            'comprobante_guardar' => 'Comprobante',
            'ventas_hoy'          => 'Ventas del día',
            'turno_estado'        => 'Turno',
            'pedidos_pendientes'  => 'Pedidos pendientes',
            'cartera'             => 'Cartera'
        ];

        $tools = [];
        $used  = json_decode((string) $p['tools_used'], true);

        foreach (is_array($used) ? $used : [] as $t) {
            if (!is_array($t)) continue;

            $name = (string) ($t['name'] ?? '');

            $tools[] = [
                'name'    => $name,
                'label'   => $labels[$name] ?? $name,
                'args'    => is_array($t['args'] ?? null) ? $t['args'] : [],
                'ignored' => is_array($t['ignored'] ?? null) ? array_values($t['ignored']) : [],
                'summary' => (string) ($t['summary'] ?? ''),
                'data'    => (string) ($t['data'] ?? '')
            ];
        }

        $last   = $this->qWaLastIn($chatId);
        $action = in_array($p['action'], ['order', 'handoff'], true) ? (string) $p['action'] : '';
        $note   = $action === 'handoff' ? json_decode((string) $p['action_data'], true) : null;
        $topics = $this->agentTopicList();

        // action: lo que pasa ademas del texto. draft = el pedido que se crea al mandarla; handoff = por que paso a una persona.
        return [
            'id'       => (int) $p['id'],
            'status'   => $status,
            'body'     => (string) $p['body'],
            'tools'    => $tools,
            'model'    => (string) $p['model'],
            'seconds'  => $p['elapsed_ms'] !== null ? round((int) $p['elapsed_ms'] / 1000, 1) : null,
            'error'    => $error,
            'auto'     => $p['requested_by'] === null,
            'outdated' => $last && (int) $last['id'] > (int) $p['message_id'],
            'when'     => $stamp ? date('g:i A', $stamp) : '',
            'action'   => $action,
            'draft'    => $action === 'order' ? $this->draftOut($p['action_data']) : null,
            'handoff'  => is_array($note) ? (string) ($note['summary'] ?? '') : '',
            'owner'    => $p['kind'] === 'owner',
            'topic'    => isset($topics[$p['topic']]) ? $topics[$p['topic']]['name'] : ''
        ];
    }

    private function chatHead($c) {
        $closes = $c['last_in_at'] ? strtotime($c['last_in_at']) + 86400 : 0;
        $human  = $this->agentIsHuman($c);
        $until  = $human && $c['human_until'] !== null ? strtotime((string) $c['human_until']) : 0;

        return [
            'opt_out_at'  => $c['opt_out'] && $c['opt_out_at'] ? dmy(substr((string) $c['opt_out_at'], 0, 10)) : '',
            'human'       => $human,
            'human_until' => $until ? dmy(date('Y-m-d', $until)) . ' · ' . date('g:i A', $until) : '',
            'handoff'     => $human ? (string) $c['handoff_note'] : '',
            'id'        => (int) $c['id'],
            'name'      => $c['name'] !== '' ? (string) $c['name'] : $this->phoneText($c['phone']),
            'phone'     => $this->phoneText($c['phone']),
            'branch_id' => $c['branch_id'] !== null ? (int) $c['branch_id'] : null,
            'branch'    => $c['branch_id'] !== null ? ($c['branch'] !== '' ? (string) $c['branch'] : 'Sucursal borrada') : '',
            'opt_out'   => (int) $c['opt_out'] === 1,
            'sim'       => $this->isSim($c['wa_id']),
            'window'    => $this->inboxWindowOpen($c['last_in_at']),
            'closes'    => $closes ? dmy(date('Y-m-d', $closes)) . ' · ' . date('g:i A', $closes) : '',
            'owner'     => (int) $c['owner'] === 1
        ];
    }

    private function messageRow($m) {
        $stamp = strtotime((string) $m['sent_at']);
        $out   = $m['direction'] === 'out';

        return [
            'id'     => (int) $m['id'],
            'dir'    => $out ? 'out' : 'in',
            'type'   => (string) $m['type'],
            'label'  => self::MEDIA[$m['type']] ?? '',
            'body'   => (string) $m['body'],
            'status' => (string) $m['status'],
            'error'  => (string) $m['error'],
            'date'   => $stamp ? date('Y-m-d', $stamp) : '',
            'hour'   => $stamp ? date('g:i A', $stamp) : '',
            'user'   => $out ? ($m['user_id'] !== null ? ((string) $m['user'] !== '' ? (string) $m['user'] : 'Usuario') : ((int) $m['auto'] === 1 ? 'Agente · salió sola' : 'Agente')) : '',
            'receipt' => $m['receipt_id'] !== null ? $this->receiptFolio((int) $m['receipt_id']) : ''
        ];
    }

    // Una linea para la lista: el texto, o «Foto · pie» si es un archivo.
    private function preview($type, $body) {
        $body  = trim((string) preg_replace('/\s+/u', ' ', (string) $body));
        $label = self::MEDIA[$type] ?? ($type !== '' && $type !== 'text' ? 'Mensaje' : '');

        if ($label !== '') $body = $body !== '' ? $label . ' · ' . $body : $label;

        return mb_strimwidth($body, 0, 90, '…', 'UTF-8');
    }

    // Hoy = la hora; ayer = «Ayer»; antes = dd/mm/aaaa.
    private function whenText($datetime) {
        $stamp = $datetime ? strtotime((string) $datetime) : false;
        if (!$stamp) return '';

        $day = date('Y-m-d', $stamp);

        if ($day === date('Y-m-d', $this->inboxNow()))                     return date('g:i A', $stamp);
        if ($day === date('Y-m-d', strtotime('-1 day', $this->inboxNow()))) return 'Ayer';

        return dmy($day);
    }

    // -- Celdas --

    private function recipientRow($r, $canEdit) {
        $id     = (int) $r['id'];
        $active = (int) $r['active'] === 1;
        $pills  = '';

        foreach (['order' => 'Pedido', 'turn' => 'Turno', 'day' => 'Día'] as $type => $label) {
            if ((int) $r['notify_' . $type] === 1) $pills .= '<span class="ord-pill wsp-pill me-1">' . $label . '</span>';
        }

        // F6: le pregunta al agente del dueño (ventas, turno, pedidos, cartera).
        if ((int) $r['can_ask'] === 1) $pills .= '<span class="ord-pill bg-emerald-50 text-emerald-700 me-1" title="Puede preguntarle al agente">Pregunta</span>';

        $row = [
            'id'           => $id,
            'Destinatario' => '<div class="font-semibold text-gray-800">' . h($r['name']) . '</div>'
                            . '<div class="ord-sub whitespace-nowrap">' . h($this->phoneText($r['phone'])) . '</div>',
            'Sucursal'     => $r['branch_id'] !== null
                            ? h($r['branch'] !== '' ? $r['branch'] : 'Sucursal borrada')
                            : '<span class="text-gray-500">Todas</span>',
            'Recibe'       => $pills,
            'Estado'       => $active
                            ? '<span class="ord-pill bg-emerald-50 text-emerald-700">Activo</span>'
                            : '<span class="ord-pill bg-slate-100 text-slate-500">Pausado</span>',
            'a'            => []
        ];

        if (!$canEdit) return $row;

        $row['a'] = [
            [
                'class'      => $this->actionBtnClass('neutral'),
                'html'       => '<i data-lucide="pencil" class="w-4 h-4"></i><span class="ms-1">Editar</span>',
                'aria-label' => 'Editar destinatario',
                'onclick'    => "wap.editRecipient({$id})"
            ],
            [
                'class'      => $this->actionBtnClass('neutral'),
                'html'       => '<i data-lucide="' . ($active ? 'pause' : 'play') . '" class="w-4 h-4"></i><span class="ms-1">' . ($active ? 'Pausar' : 'Activar') . '</span>',
                'aria-label' => $active ? 'Pausar destinatario' : 'Activar destinatario',
                'onclick'    => "wap.toggleRecipient({$id}, " . ($active ? 0 : 1) . ')'
            ],
            [
                'class'      => $this->actionBtnClass('danger', true),
                'html'       => '<i data-lucide="trash-2" class="w-4 h-4"></i>',
                'aria-label' => 'Eliminar destinatario',
                'onclick'    => "wap.deleteRecipient({$id})"
            ]
        ];

        return $row;
    }

    // Un renglon de la lista de recordatorios (reminderList).
    private function reminderRow($r) {
        $pill = function ($text, $tone, $sub = '') {
            $tones = [
                'ok'   => 'bg-emerald-50 text-emerald-700',
                'mute' => 'bg-slate-100 text-slate-600',
                'bad'  => 'bg-rose-50 text-rose-700'
            ];

            return '<span class="ord-pill ' . $tones[$tone] . '">' . h($text) . '</span>'
                 . ($sub !== '' ? '<div class="ord-sub">' . h($sub) . '</div>' : '');
        };

        $last  = $r['last'] !== '' ? strtotime($r['last']) : 0;
        $state = [
            'send'  => $pill('Sale hoy', 'ok'),
            'cap'   => $pill('Mañana', 'mute', 'Hoy ya salió el tope de ' . $this->reminderDailyCap()),
            'other' => $pill('Otra sucursal', 'mute', 'Le llega el de ' . $r['other']),
            'week'  => $pill('Esta semana ya', 'mute', $last ? 'Vuelve a salir el ' . date('d/m/Y', $last + 7 * 86400) : ''),
            'baja'  => $pill('BAJA', 'bad', $r['opt_out_at'] !== '' ? 'Desde el ' . dmy(substr($r['opt_out_at'], 0, 10)) : 'No recibe recordatorios'),
            'phone' => $pill('Sin WhatsApp', 'bad', $r['raw_phone'] !== '' ? 'Teléfono no válido' : 'Sin teléfono')
        ][$r['state']] ?? h($r['state']);

        $folios = (int) $r['folios'];

        return [
            'id'                   => (int) $r['customer_id'],
            'Cliente'              => '<div class="font-semibold text-gray-800">' . h($r['name'] !== '' ? $r['name'] : 'Sin nombre') . '</div>'
                                    . '<div class="ord-sub whitespace-nowrap">' . h($r['phone'] !== '' ? $this->phoneText($r['phone']) : ($r['raw_phone'] !== '' ? $r['raw_phone'] : '—')) . '</div>',
            'Sucursal'             => h($r['branch']),
            'Debe'                 => '<div class="font-semibold text-gray-800 whitespace-nowrap">' . money($r['debt']) . '</div>'
                                    . '<div class="ord-sub">' . ($folios === 1 ? '1 folio' : $folios . ' folios') . '</div>',
            'Último recordatorio'  => $last
                                    ? '<div class="whitespace-nowrap">' . date('d/m/Y', $last) . '</div><div class="ord-sub">' . date('g:i A', $last) . '</div>'
                                    : '<span class="text-gray-500">Nunca</span>',
            'Estado'               => $state,
            'a'                    => []
        ];
    }

    // Un renglon de Metricas: un tema y que paso con sus propuestas.
    private function metricRow(array $t) {
        $mode = $t['key'] === 'dueno'
            ? '<span class="ord-pill bg-emerald-50 text-emerald-700">Directo</span>'
            : ($t['auto_on']
                ? '<span class="ord-pill bg-emerald-50 text-emerald-700">Sale sola</span>'
                : '<span class="ord-pill bg-slate-100 text-slate-600">' . ($t['can_auto'] ? 'Bandeja' : 'Siempre bandeja') . '</span>');

        $decided = $t['sent'] + $t['edited'] + $t['discarded'];
        $pct     = function ($n) use ($decided) {
            return $decided > 0 ? '<div class="ord-sub">' . round($n * 100 / $decided) . '%</div>' : '';
        };
        $num     = function ($n, $sub = '') {
            return '<div class="font-semibold text-gray-800">' . number_format((int) $n) . '</div>' . $sub;
        };

        return [
            'id'            => $t['key'],
            'Tema'          => '<div class="font-semibold text-gray-800">' . h($t['name']) . '</div>',
            'Cómo sale'     => $mode,
            'Propuestas'    => $num($t['total']),
            'Salieron solas' => $num($t['auto']),
            'Tal cual'      => $num($t['sent'], $pct($t['sent'])),
            'Cambiadas'     => $num($t['edited'], $pct($t['edited'])),
            'Descartadas'   => $num($t['discarded'], $pct($t['discarded'])),
            'Fallidas'      => $num($t['failed'])
        ];
    }

    // 45 s · 3 min · 1 h 20 min. '' sin dato.
    private function secondsText($seconds) {
        if ($seconds === null) return '';

        $s = (int) $seconds;

        if ($s < 60)   return $s . ' s';
        if ($s < 3600) return intdiv($s, 60) . ' min' . ($s % 60 && $s < 600 ? ' ' . ($s % 60) . ' s' : '');

        $min = intdiv($s % 3600, 60);

        return intdiv($s, 3600) . ' h' . ($min ? ' ' . $min . ' min' : '');
    }

    private function logRow($l) {
        $id     = (int) $l['id'];
        $status = [
            'sent'      => '<span class="ord-pill bg-emerald-50 text-emerald-700">Enviado</span>',
            'simulated' => '<span class="ord-pill bg-slate-100 text-slate-600">Simulado</span>',
            'failed'    => '<span class="ord-pill bg-rose-50 text-rose-700">Falló</span>'
        ][$l['status']] ?? h($l['status']);

        if ($l['status'] === 'failed' && $l['error'] !== '') {
            $status .= '<div class="ord-sub text-rose-600">' . h(mb_strimwidth($l['error'], 0, 60, '…', 'UTF-8')) . '</div>';
        }

        $to = $l['recipient'] !== '' ? '<div class="font-semibold text-gray-800">' . h($l['recipient']) . '</div>' : '';

        return [
            'id'       => $id,
            'Fecha'    => '<div class="font-semibold text-gray-800 whitespace-nowrap">' . dmy(substr($l['created_at'], 0, 10)) . '</div>'
                        . '<div class="ord-sub whitespace-nowrap">' . hour12(substr($l['created_at'], 11, 8)) . '</div>',
            'Aviso'    => '<div class="font-semibold text-gray-800">' . h($this->typeName($l['type'])) . '</div>'
                        . '<div class="ord-sub">' . h($l['reference']) . '</div>',
            'Para'     => $to . '<div class="ord-sub whitespace-nowrap">' . h($this->phoneText($l['phone'])) . '</div>',
            'Sucursal' => h($l['branch']),
            'Estado'   => $status,
            'a'        => [[
                'class'      => $this->actionBtnClass('neutral', true),
                'html'       => '<i data-lucide="eye" class="w-4 h-4"></i><span class="ms-1">Ver</span>',
                'aria-label' => 'Ver el mensaje',
                'onclick'    => "wap.viewLog({$id})"
            ]]
        ];
    }

    private function actionBtnClass($variant, $last = false) {
        $base  = 'inline-flex items-center px-2 py-1 text-sm rounded-md border transition ';
        $tones = [
            'danger'  => 'border-red-200 text-red-500 hover:bg-red-50 hover:text-red-600',
            'neutral' => 'border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900'
        ];

        return $base . $tones[$variant] . ($last ? '' : ' me-1');
    }
}

Permission::dispatch(new ctrl(), ctrl::WA);
