<?php
require_once __DIR__ . '/../../../core/security/_Session.php';
if (empty($_POST['opc'])) exit(0);

require_once __DIR__ . '/core-order.php';
require_once __DIR__ . '/../mdl/mdl-whatsapp.php';

/*  Ventas › WhatsApp: los avisos que salen solos (pedido nuevo, cierre de turno,
    cierre del dia), a quien le llegan, el historial y la conexion.

    Reglas que no se ven en el codigo de un vistazo:
      - La seccion es pos-whatsapp (show, create). Con show se ve todo; con
        create se cambian plantillas y destinatarios, se comprueba la conexion
        y se manda el mensaje de prueba.
      - Plantillas y destinatarios son de la EMPRESA; un destinatario con
        sucursal solo recibe los avisos de esa sucursal.
      - El proveedor y su token viven en pro/core/config/.env: esta pagina solo
        dice cual esta puesto y que falta, nunca un valor.
      - Sin proveedor (o «simulado») nada sale a la red: el historial lo marca
        «Simulado».
      - La prueba queda en el historial con tipo 'test'. */
class ctrl extends core {

    use WhatsAppNotices;

    const WA         = 'pos-whatsapp';
    const MAX_BODY   = 2000;
    const MAX_NAME   = 80;
    const TYPES      = ['order', 'turn', 'day'];

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
            'status'   => 200,
            'scope'    => ['company' => $scope['company'], 'branch' => $scope['branch']],
            'wa'       => Permission::actions(self::WA),
            'conn'     => (new WhatsApp())->status(),
            'types'    => $types,
            'branches' => $branches,
            'today'    => date('Y-m-d')
        ];
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
                    'active'       => (int) $r['active']
                ]
            ];
        }, 'No se pudo abrir el destinatario.');
    }

    // id 0 = nuevo.
    public function saveRecipient() {
        $fail = $this->needWa('create') ?: $this->needBranch();
        if ($fail) return $fail;

        $id     = $this->postId();
        $name   = trim((string) preg_replace('/\s+/u', ' ', $this->post('name')));
        $phone  = WhatsApp::phone($this->post('phone'));
        $branch = $this->selectOrNull('branch_id');
        $flags  = [];

        foreach (['notify_order', 'notify_turn', 'notify_day'] as $key) $flags[$key] = $this->post($key) === '1' ? 1 : 0;

        if ($name === '')                         return $this->fail(422, 'Escribe el nombre de quien recibe los avisos.');
        if ($this->tooLong($name, self::MAX_NAME)) return $this->fail(422, 'El nombre admite hasta ' . self::MAX_NAME . ' caracteres.');
        if ($phone === '')                        return $this->fail(422, 'El teléfono va a 10 dígitos (sin lada de país) o como grupo, por ejemplo 120363000000000000@g.us.');
        if (!array_sum($flags))                   return $this->fail(422, 'Marca al menos un aviso para este destinatario.');

        if ($branch !== null && !in_array($branch, array_map('intval', array_column($this->qCompanyBranches($this->companyId()), 'id')), true)) {
            return $this->fail(422, 'Esa sucursal no es de la empresa.');
        }

        return $this->attempt(function () use ($id, $name, $phone, $branch, $flags) {
            $now = date('Y-m-d H:i:s');

            if ($id > 0) {
                if (!$this->qWaRecipient($id, $this->companyId())) return $this->fail(404, 'Ese destinatario ya no existe.');

                $this->must($this->qUpdateIn('wa_recipient', [
                    'values' => ['name', 'phone', 'branch_id', 'notify_order', 'notify_turn', 'notify_day', 'updated_at'],
                    'where'  => ['id', 'company_id'],
                    'data'   => [$name, $phone, $branch, $flags['notify_order'], $flags['notify_turn'], $flags['notify_day'], $now, $id, $this->companyId()]
                ]), 'saveRecipient');

                return $this->ok('Destinatario guardado.');
            }

            $this->must($this->qInsertInto('wa_recipient', [
                'values' => ['company_id', 'branch_id', 'name', 'phone', 'notify_order', 'notify_turn', 'notify_day', 'active', 'created_at', 'updated_at'],
                'data'   => [$this->companyId(), $branch, $name, $phone, $flags['notify_order'], $flags['notify_turn'], $flags['notify_day'], 1, $now, $now]
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
                'table' => $this->pos . 'wa_recipient',
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
        if (!in_array($type, array_merge(self::TYPES, ['test']), true)) $type = '';

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
            'create' => 'cambiar los avisos de WhatsApp'
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
        if ($type === 'test') return 'Prueba';

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

    // -- Celdas --

    private function recipientRow($r, $canEdit) {
        $id     = (int) $r['id'];
        $active = (int) $r['active'] === 1;
        $pills  = '';

        foreach (['order' => 'Pedido', 'turn' => 'Turno', 'day' => 'Día'] as $type => $label) {
            if ((int) $r['notify_' . $type] === 1) $pills .= '<span class="ord-pill wsp-pill me-1">' . $label . '</span>';
        }

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
