<?php
require_once __DIR__ . '/../../../core/security/_Session.php';
if (empty($_POST['opc'])) exit(0);

// La base (empresa, sucursal, respuestas) y el modelo son los de Pedidos: Vender e Historial usan el mismo trait.
require_once __DIR__ . '/../../order/ctrl/core-order.php';
require_once __DIR__ . '/../../order/mdl/mdl-lealtad.php';

// Tarjeta digital por WhatsApp: el chat y la plantilla de Meta de Ventas › WhatsApp (los mismos de los recordatorios).
require_once __DIR__ . '/../../order/mdl/mdl-whatsapp-agente.php';
require_once __DIR__ . '/../../order/mdl/mdl-whatsapp-recordatorios.php';
require_once __DIR__ . '/../../../core/helpers/_WhatsAppMeta.php';
require_once __DIR__ . '/../../order/mdl/mdl-lealtad-programa.php';
require_once __DIR__ . '/../../order/mdl/mdl-lealtad-whatsapp.php';
require_once __DIR__ . '/../../order/mdl/mdl-lealtad-cumple.php';
require_once __DIR__ . '/../../order/mdl/mdl-lealtad-regreso.php';
require_once __DIR__ . '/../../order/mdl/mdl-lealtad-niveles.php';

/*  Lealtad › Tarjetas (antes Ventas › Puntos, V4 del plan de Ventas):
    tipos de tarjeta y tarjetas.

    Reglas que no se ven en el codigo de un vistazo:
      - La seccion sigue siendo pos-puntos (los codes no cambian) y hoy solo la
        tiene el Dueño (show, create, update). No hay permiso 'delete':
        activar o desactivar pide 'update'.
      - La seccion es del modulo lealtad: la abre solo la empresa que tenga
        Lealtad en su plan (Plan::allows mira el modulo de la seccion).
      - No se borra: se desactiva. Una tarjeta inactiva, o con su tipo inactivo,
        deja de leerse en «Vender»; las ventas que ya la usaron siguen igual.
      - Tarjetas y tipos son de toda la empresa (como los clientes): se ven y
        se usan en cualquier sucursal. branch_id solo dice donde se dieron de alta.
      - El numero es la llave: mayusculas, sin espacios, unico en la empresa
        (cuentan tambien las inactivas, asi reactivar nunca choca).
      - El tipo da UN beneficio: descuento, puntos o sellos (typeFields rechaza
        dos). Un tipo guardado antes de esta regla puede traer descuento y
        puntos: se sigue leyendo, y al editarlo hay que dejarle uno.
      - Sellos (docs/plan-sellos.html): 1 sello por cada stamp_amount pagados;
        con stamp_goal sellos, el premio reward_name descuenta hasta
        reward_value. Se ganan y se canjean en Vender (etapas S2 y S3).
      - El tipo guarda el color con que se dibuja la tarjeta (card_type.color,
        #RRGGBB). Sin color va en celeste claro (CARD_COLOR).
      - La tarjeta no guarda saldo: los puntos caen en el monedero del cliente
        (customer.wallet).
      - Leer la tarjeta al vender NO pasa por aqui: lo hace ctrl-ventas con el
        permiso de vender. Esta pagina es solo para administrarlas.
      - La BD no tiene bitacora de tarjetas: una edicion no deja rastro.
      - El resumen (getSummary), la galeria de tipos (lsCardTypes) y la ficha
        (getCardDetail) solo leen. Cuentan ventas vivas (pendientes o pagadas)
        de toda la empresa; «el mes» es el de hoy, por fecha de la venta.
      - Tarjeta digital: el enlace tarjeta.php?t=<card.token> abre la tarjeta en
        el telefono del cliente, sin sesion, con un QR que lleva el NUMERO (lo
        mismo que escribe el lector en Vender). getCardLink lo crea la primera
        vez (pide 'update'); despues verlo pide 'show'. newCardLink pone otro
        token y el enlace anterior deja de abrir.
      - Tarjeta digital por WhatsApp: sale como plantilla de Meta ('tarjeta')
        por el numero de la empresa (wa_agent), como los recordatorios de
        saldo: queda en la conversacion del cliente en Ventas › WhatsApp y no
        le llega a quien escribio BAJA. Sin wa_agent no sale nada; sin
        WHATSAPP_META_TOKEN es simulada (no sale a la red). Sale al dar de alta
        una tarjeta con cliente (si se deja marcado) o con «Mandar desde el
        WhatsApp de la tienda» (sendCardWhatsApp, pide 'update'). No mira el
        horario del agente: lo dispara una persona en el mostrador.
      - Programa (docs/plan-crecimiento.html): ajustes por EMPRESA
        (loyalty_setting). Registro solo: un QR por SUCURSAL (loyalty_signup)
        abre registro.php, donde el cliente se da de alta y recibe la tarjeta
        de bienvenida. El enlace se crea la primera vez que lo pide alguien con
        'update'; newSignupLink lo cambia y el cartel impreso deja de servir.
      - Cumpleaños (mdl-lealtad-cumple.php): felicitacion por WhatsApp y regalo
        (sellos o dinero al monedero) el dia de su cumpleaños, una vez al año y
        solo a quien acepto mensajes. Sale sola con la tarea de cada hora
        (ctrl/cron-lealtad.php); «Felicitar a los de hoy» (sendBirthdays, pide
        'update') la adelanta.
      - Te extrañamos (mdl-lealtad-regreso.php): a quien lleva winback_days dias
        sin comprar, con su motivo para volver; una vez cada winback_days dias y
        con tope diario. Igual: la tarea de cada hora, o «Mandar los de hoy» (sendWinbacks).
      - Niveles (mdl-lealtad-niveles.php): tipos con level_min_spend forman la
        escalera. Sube al cobrar (Vender, por LoyaltyNotifier); la revision del
        mes (la tarea de cada hora, desde el dia 1, o «Revisar niveles» con
        applyLevels) sube y baja a todas. Un tipo de sellos no es nivel.
      - El Programa es su propia seccion (lealtad-programa, programa.php). Sus
        opc siguen aqui; ctrl-programa.php hereda esta clase, deja pasar solo
        las suyas y cambia PAGE: con eso init, needPoints y programReply
        miran el permiso de Programa y no el de Tarjetas. */
class ctrl extends core {

    use LoyaltyCards, WhatsAppInbox, WhatsAppAgentFlow, WhatsAppReminders, LoyaltyWhatsApp, LoyaltyProgram, LoyaltyBirthday, LoyaltyWinback, LoyaltyLevels;

    const POINTS     = 'pos-puntos';
    const PAGE       = 'pos-puntos'; // la sección que pide permiso (ctrl-programa.php la cambia; se lee con static::). No es core::SECTION (Pedidos).
    const MAX_NUMBER = 40;
    const MAX_HOLDER = 150;
    const MAX_NAME   = 80;
    const CARD_COLOR = '#BAE6FD';
    const MOVES      = 10;
    const MIN_GOAL   = 2;        // sellos para el premio
    const MAX_GOAL   = 20;
    const MAX_MONEY  = 100000;   // $ por sello y valor del premio
    const MAX_GIFT   = 10000;    // $ de regalo de cumpleaños al monedero
    const BDAY_BACK  = 7;        // la lista de cumpleaños: dias atras
    const BDAY_AHEAD = 30;       // y dias adelante
    const BDAY_RUN   = 200;      // felicitaciones por clic
    const WB_RUN     = 100;      // «te extrañamos» por clic (además del tope diario)
    const WB_LIST    = 300;      // renglones de la lista de te extrañamos
    const LEVEL_RUN  = 100;      // cambios de nivel por clic (cada aviso tarda)
    const MAX_LEVEL  = 10000000; // $ de gasto mínimo de un nivel

    // -- Arranque --

    // Sin turno, dia ni permisos de Pedidos: esta pagina no carga el detalle, el turno ni el cobro.
    public function init() {
        $scope = $this->scope();

        return [
            'status'    => 200,
            'scope'     => ['company' => $scope['company'], 'branch' => $scope['branch']],
            'points'    => Permission::actions(static::PAGE),
            'cardColor' => self::CARD_COLOR,
            'whatsapp'  => $this->loyaltyWaState()
        ];
    }

    // -- Resumen --

    /*  Las cifras de arriba de la pagina. Ventas, descuento y puntos son del mes;
        tarjetas y monederos, de hoy. value ya va con formato. */
    public function getSummary() {
        $fail = $this->needPoints('show') ?: $this->needBranch();
        if ($fail) return $fail;

        return $this->attempt(function () {
            $branchId        = $this->branchId();
            list($from, $to) = $this->monthRange();

            $cards   = $this->qLoyaltyCardCount($branchId);
            $sales   = $this->qLoyaltySales($branchId, $from, $to);
            $wallet  = $this->qLoyaltyWallet($branchId);
            $owned   = (int) $cards['owned'];
            $holders = (int) $wallet['holders'];

            // Sellos: solo si la empresa tiene algún tipo de sellos. El premio ya cuenta en «Descuento dado».
            $stamps  = null;

            if ($this->qLoyaltyHasStamps($branchId)) {
                $s       = $this->qLoyaltyStamps($branchId, $from, $to);
                $rewards = (int) $s['rewards'];
                $stamps  = [
                    'label' => 'Sellos dados',
                    'value' => (string) (int) $s['given'],
                    'hint'  => $rewards > 0 ? $this->countText($rewards, 'premio canjeado', 'premios canjeados') . ' · ' . money($s['saved']) : 'Ningún premio canjeado',
                    'icon'  => 'stamp',
                    'tone'  => 'indigo'
                ];
            }

            return [
                'status' => 200,
                'note'   => ucfirst($this->monthLabel()) . ' · todas las sucursales de la empresa',
                'tiles'  => array_values(array_filter([
                    [
                        'label' => 'Tarjetas activas',
                        'value' => (string) (int) $cards['cards'],
                        'hint'  => $owned > 0 ? "{$owned} con cliente" : 'Ninguna con cliente',
                        'icon'  => 'credit-card',
                        'tone'  => 'blue'
                    ],
                    [
                        'label' => 'Ventas con tarjeta',
                        'value' => (string) (int) $sales['sales'],
                        'hint'  => 'Suman ' . money($sales['sold']) . ' en el mes',
                        'icon'  => 'receipt',
                        'tone'  => 'teal'
                    ],
                    [
                        'label' => 'Descuento dado',
                        'value' => money($sales['discount']),
                        'hint'  => 'Lo que ahorraron los clientes',
                        'icon'  => 'badge-percent',
                        'tone'  => 'orange'
                    ],
                    [
                        'label' => 'Puntos abonados',
                        'value' => money($sales['points']),
                        'hint'  => 'Al monedero de los clientes',
                        'icon'  => 'star',
                        'tone'  => 'purple'
                    ],
                    $stamps,
                    [
                        'label' => 'Saldo en monederos',
                        'value' => money($wallet['wallet']),
                        'hint'  => $holders > 0 ? 'Hoy, ' . $this->countText($holders, 'cliente con saldo', 'clientes con saldo') : 'Hoy, ningún cliente con saldo',
                        'icon'  => 'wallet',
                        'tone'  => 'green'
                    ]
                ]))
            ];
        }, 'No se pudo cargar el resumen de tarjetas.');
    }

    // -- Tarjetas: lista --

    public function lsCards() {
        $fail = $this->needPoints('show') ?: $this->needBranch();
        if ($fail) return $fail;

        $active = $this->statusFilter();
        $typeId = $this->typeFilter();

        return $this->attempt(function () use ($active, $typeId) {
            $canEdit = Permission::can(self::POINTS, 'update');
            $types   = $this->qCardTypes($this->branchId());
            $rows    = [];

            foreach ($this->qCards($this->branchId(), $active, $typeId) as $card) {
                $rows[] = $this->cardRow($card, $canEdit);
            }

            return [
                'status'     => 200,
                'row'        => $rows,
                'count'      => count($rows),
                'types'      => count(array_filter($types, fn ($t) => (int) $t['active'] === 1)),
                'typeFilter' => $this->typeFilterOptions($types),
                'branch'     => $this->scope()['branch']
            ];
        }, 'No se pudo cargar la lista de tarjetas.');
    }

    // Una fila de la tabla. Las claves son los encabezados; Cliente, Tarjeta y Tipo van primero (el buscador lee esas 3).
    private function cardRow($c, $canEdit) {
        $id     = (int) $c['id'];
        $active = (int) $c['active'] === 1;

        return [
            'id'        => $id,
            'Cliente'   => $this->cellOwner($c),
            'Tarjeta'   => $this->cellCard($c['number'], $c['holder']),
            'Tipo'      => $this->cellType($c['type'], (int) $c['type_active'] === 1, $c['type_color']),
            'Beneficio' => $this->cellBenefit($c),
            'Ventas'    => $this->cellSales((int) $c['sales'], $c['last_sale']),
            'Monedero'  => $this->cellWallet($c),
            'Estado'    => $this->activePill($active, 'Activa', 'Inactiva'),
            'a'         => $this->cardActions($id, $active, $canEdit)
        ];
    }

    // -- Tarjetas: ficha --

    // Solo lectura: la tarjeta, su cliente, lo que lleva comprado y sus ultimas compras.
    public function getCardDetail() {
        $fail = $this->needPoints('show') ?: $this->needBranch();
        if ($fail) return $fail;

        $id = $this->postId();

        return $this->attempt(function () use ($id) {
            $card = $id > 0 ? $this->qCard($id, $this->branchId()) : null;

            if (!$card) return $this->fail(404, 'Esa tarjeta no es de esta empresa o ya no existe.');

            $type   = $this->qCardType((int) $card['card_type_id'], $this->branchId());
            $totals = $this->qCardTotals($id);
            $wallet = $card['owner_id'] !== null ? $this->qCardWallet((int) $card['owner_id']) : null;
            $moves  = $this->qCardMoves($id, self::MOVES);
            $count  = (int) $totals['sales'];
            $shown  = count($moves);
            $goal   = (int) $card['stamp_goal'];
            $have   = $goal > 0 ? max($this->qCardStamps($id), 0) : 0;
            $stamps = $goal > 0 ? ['have' => $have, 'goal' => $goal] + $this->qCardStampTotals($id) : null;

            return [
                'status'   => 200,
                'birthday' => $card['owner_id'] !== null ? $this->detailBirthday((int) $card['owner_id']) : null,
                'level'    => $this->detailLevel($card),
                'card'     => $this->detailCard($card, $type) + ['stamps' => $have],
                'totals'   => $this->detailTotals($totals, $wallet, $stamps),
                'moves'    => array_map(fn ($m) => $this->moveRow($m), $moves),
                'moreText' => $count > $shown ? "Se muestran las {$shown} más recientes de {$count}." : ''
            ];
        }, 'No se pudo abrir la tarjeta.');
    }

    // -- Tarjetas: una --

    // Con id 0 solo devuelve las opciones del formulario (alta).
    public function getCard() {
        $fail = $this->needPoints('show') ?: $this->needBranch();
        if ($fail) return $fail;

        $id = $this->postId();

        return $this->attempt(function () use ($id) {
            $card = $id > 0 ? $this->qCard($id, $this->branchId()) : null;

            if ($id > 0 && !$card) return $this->fail(404, 'Esa tarjeta no es de esta empresa o ya no existe.');

            return [
                'status'    => 200,
                'row'       => $card ? $this->cardFormRow($card) : null,
                'types'     => $this->typeOptions($card ? (int) $card['card_type_id'] : 0),
                'customers' => $this->customerOptions($card ? (int) $card['customer_id'] : 0)
            ];
        }, 'No se pudo abrir la tarjeta.');
    }

    public function addCard() {
        $fail = $this->needPoints('create') ?: $this->needBranch();
        if ($fail) return $fail;

        list($fail, $number, $holder, $typeId, $customerId) = $this->cardFields();
        if ($fail) return $fail;

        $sendWa = $this->post('send_wa') === '1';

        return $this->attempt(function () use ($number, $holder, $typeId, $customerId, $sendWa) {
            $saved = $this->transaction(function () use ($number, $holder, $typeId, $customerId) {
                $fail = $this->linksFail($typeId, $customerId, null);
                if ($fail) return $fail;

                $taken = $this->qCardNumberTaken($this->branchId(), $number, 0);

                if ($taken) return $this->fail(409, $this->takenText($taken));

                $this->must($this->qCreateCard([
                    'values' => ['number', 'holder', 'branch_id', 'card_type_id', 'customer_id', 'active'],
                    'data'   => [$number, $holder, $this->branchId(), $typeId, $customerId, 1]
                ]), 'addCard');

                $id = $this->qLastInsertId();
                if ($id <= 0) throw new RuntimeException('addCard: sin id');

                return $this->ok('Tarjeta agregada.', ['id' => $id]);
            });

            // La tarjeta ya quedó guardada: el WhatsApp va aparte y, si falla, solo se avisa.
            if ($sendWa && (int) ($saved['status'] ?? 0) === 200) $saved['wa'] = $this->cardWaAfterAdd((int) $saved['id']);

            return $saved;
        }, 'No se pudo guardar la tarjeta.');
    }

    public function editCard() {
        $fail = $this->needPoints('update') ?: $this->needBranch();
        if ($fail) return $fail;

        list($fail, $number, $holder, $typeId, $customerId) = $this->cardFields();
        if ($fail) return $fail;

        $id = $this->postId();

        return $this->attempt(function () use ($id, $number, $holder, $typeId, $customerId) {
            return $this->transaction(function () use ($id, $number, $holder, $typeId, $customerId) {
                $card = $this->qCard($id, $this->branchId());

                if (!$card) return $this->fail(404, 'Esa tarjeta no es de esta empresa o ya no existe.');

                $fail = $this->linksFail($typeId, $customerId, $card);
                if ($fail) return $fail;

                $taken = $this->qCardNumberTaken($this->branchId(), $number, $id);

                if ($taken) return $this->fail(409, $this->takenText($taken));

                $this->must($this->qUpdateCard([
                    'values' => ['number', 'holder', 'card_type_id', 'customer_id', 'updated_at = NOW()'],
                    'where'  => ['id'],
                    'data'   => [$number, $holder, $typeId, $customerId, $id]
                ]), 'editCard');

                return $this->ok('Tarjeta actualizada.', ['id' => $id]);
            });
        }, 'No se pudo guardar la tarjeta.');
    }

    // Activa o desactiva. No borra: las ventas que la usaron se quedan.
    public function statusCard() {
        $fail = $this->needPoints('update') ?: $this->needBranch();
        if ($fail) return $fail;

        $id     = $this->postId();
        $active = $this->post('active') === '1' ? 1 : 0;

        return $this->attempt(function () use ($id, $active) {
            return $this->transaction(function () use ($id, $active) {
                $card = $this->qCard($id, $this->branchId());

                if (!$card) return $this->fail(404, 'Esa tarjeta no es de esta empresa o ya no existe.');

                if ((int) $card['active'] === $active) {
                    return $this->ok($active === 1 ? 'La tarjeta ya estaba activa.' : 'La tarjeta ya estaba inactiva.', ['id' => $id]);
                }

                $this->must($this->qUpdateCard([
                    'values' => ['active', 'updated_at = NOW()'],
                    'where'  => ['id'],
                    'data'   => [$active, $id]
                ]), 'statusCard');

                if ($active === 1 && (int) $card['type_active'] !== 1) {
                    return $this->ok('Tarjeta reactivada. Su tipo sigue inactivo: no se leerá en Vender hasta activarlo.', ['id' => $id]);
                }

                return $this->ok($active === 1 ? 'Tarjeta reactivada.' : 'Tarjeta desactivada.', ['id' => $id]);
            });
        }, 'No se pudo cambiar el estado de la tarjeta.');
    }

    // -- Tarjetas: cliente nuevo --

    /*  «Dar de alta cliente» de la lista de tarjetas: el mismo cliente de Pedidos ›
        Clientes (nombre, telefono de 10 digitos unico entre los activos de la
        empresa, correo opcional), sin credito. Pide 'create' de Tarjetas. */
    public function addCustomer() {
        $fail = $this->needPoints('create') ?: $this->needBranch();
        if ($fail) return $fail;

        $name  = trim((string) preg_replace('/\s+/u', ' ', $this->post('name')));
        $phone = preg_replace('/\D/', '', $this->post('phone'));
        $email = trim((string) $this->post('email'));

        if ($name === '')               return $this->fail(422, 'Escribe el nombre del cliente.');
        if ($this->tooLong($name, 120)) return $this->fail(422, 'El nombre admite hasta 120 caracteres.');
        if (strlen($phone) !== 10)      return $this->fail(422, 'El teléfono debe tener 10 dígitos.');

        if ($email !== '') {
            if ($this->tooLong($email, 120))                return $this->fail(422, 'El correo admite hasta 120 caracteres.');
            if (!filter_var($email, FILTER_VALIDATE_EMAIL)) return $this->fail(422, 'El correo no tiene un formato válido.');
        }

        return $this->attempt(function () use ($name, $phone, $email) {
            return $this->transaction(function () use ($name, $phone, $email) {
                $taken = $this->qCustomerPhoneTaken($this->branchId(), $phone, 0);

                if ($taken) {
                    $label = trim((string) $taken['name']) !== '' ? trim($taken['name']) : 'otro cliente';

                    return $this->fail(409, "Ese teléfono ya es de {$label}.");
                }

                $this->must($this->qCreateCustomer([
                    'values' => ['name', 'phone', 'email', 'branch_id', 'active'],
                    'data'   => [$name, $phone, $email === '' ? null : $email, $this->branchId(), 1]
                ]), 'addCustomer');

                $id = $this->qLastInsertId();
                if ($id <= 0) throw new RuntimeException('addCustomer: sin id');

                return $this->ok('Cliente agregado. Ya puedes elegirlo al dar de alta su tarjeta.', ['id' => $id]);
            });
        }, 'No se pudo guardar el cliente.');
    }

    // -- Tarjetas: tarjeta digital --

    // El enlace de la tarjeta digital. La primera vez lo crea, y eso pide 'update'; despues basta 'show'.
    public function getCardLink() {
        $fail = $this->needPoints('show') ?: $this->needBranch();
        if ($fail) return $fail;

        $id = $this->postId();

        return $this->attempt(function () use ($id) {
            $card = $id > 0 ? $this->qCard($id, $this->branchId()) : null;

            if (!$card) return $this->fail(404, 'Esa tarjeta no es de esta empresa o ya no existe.');

            if ($this->qCardLinkToken($id) === '' && !Permission::can(self::POINTS, 'update')) {
                return $this->fail(403, 'Esta tarjeta aún no tiene tarjeta digital. Pide a quien administra las tarjetas que la cree.');
            }

            return $this->linkReply($card, $this->loyaltyCardToken($id), '');
        }, 'No se pudo preparar la tarjeta digital.');
    }

    /*  «Mandar desde el WhatsApp de la tienda»: la plantilla 'tarjeta' al
        teléfono escrito en la ventana (10 dígitos). Pide 'update'. */
    public function sendCardWhatsApp() {
        $fail = $this->needPoints('update') ?: $this->needBranch();
        if ($fail) return $fail;

        $id    = $this->postId();
        $phone = $this->loyaltyPhone($this->post('phone'));

        if ($phone === '') return $this->fail(422, 'Escribe el WhatsApp del cliente: 10 dígitos.');

        return $this->attempt(function () use ($id, $phone) {
            $card = $id > 0 ? $this->qCard($id, $this->branchId()) : null;

            if (!$card) return $this->fail(404, 'Esa tarjeta no es de esta empresa o ya no existe.');

            if ((int) $card['active'] !== 1 || (int) $card['type_active'] !== 1) {
                return $this->fail(409, 'La tarjeta o su tipo están inactivos: el enlace no abriría. Reactívalos primero.');
            }

            $sent = $this->loyaltySendCard($card, $phone);

            if ($sent['status'] === 'skip')   return $this->fail(409, $sent['detail']);
            if ($sent['status'] === 'failed') return $this->fail(502, $sent['detail'] !== '' ? $sent['detail'] : 'Meta no aceptó el mensaje.');

            return $this->ok($this->cardWaText($sent), ['wa' => $sent]);
        }, 'No se pudo mandar la tarjeta por WhatsApp.');
    }

    // Token nuevo: el enlace anterior deja de abrir (para cuando se mandó a otra persona).
    public function newCardLink() {
        $fail = $this->needPoints('update') ?: $this->needBranch();
        if ($fail) return $fail;

        $id = $this->postId();

        return $this->attempt(function () use ($id) {
            $card = $id > 0 ? $this->qCard($id, $this->branchId()) : null;

            if (!$card) return $this->fail(404, 'Esa tarjeta no es de esta empresa o ya no existe.');

            $this->must($this->qSetCardToken($id, $this->loyaltyFreshToken(), false), 'newCardLink');

            $token = $this->qCardLinkToken($id);

            if ($token === '') throw new RuntimeException('newCardLink: sin token');

            return $this->linkReply($card, $token, 'Enlace nuevo listo. El anterior ya no abre.');
        }, 'No se pudo cambiar el enlace de la tarjeta.');
    }

    // -- Programa: registro solo --

    // La pestaña «Programa»: el registro de la empresa y el enlace de esta sucursal.
    public function getProgram() {
        $fail = $this->needPoints('show') ?: $this->needBranch();
        if ($fail) return $fail;

        return $this->attempt(function () {
            return ['status' => 200] + $this->programReply();
        }, 'No se pudo cargar el programa.');
    }

    /*  Encender o apagar el registro y elegir la tarjeta de bienvenida (un tipo
        activo de la empresa). Pide 'update'. */
    public function saveSignup() {
        $fail = $this->needPoints('update') ?: $this->needBranch();
        if ($fail) return $fail;

        $enabled = $this->post('signup_enabled') === '1' ? 1 : 0;
        $typeId  = $this->postId('signup_type_id');

        if ($enabled === 1 && $typeId <= 0) return $this->fail(422, 'Elige la tarjeta que recibe quien se registra.');

        return $this->attempt(function () use ($enabled, $typeId) {
            $type = $typeId > 0 ? $this->qCardType($typeId, $this->branchId()) : null;

            if ($typeId > 0 && !$type) return $this->fail(404, 'Ese tipo de tarjeta no es de esta empresa o ya no existe.');
            if ($type && (int) $type['active'] !== 1) return $this->fail(409, 'Ese tipo de tarjeta está inactivo: actívalo o elige otro.');

            $this->transaction(function () use ($enabled, $typeId) {
                $this->must($this->qSaveLoyaltySetting($this->companyId(), [
                    'signup_enabled' => $enabled,
                    'signup_type_id' => $typeId > 0 ? $typeId : null
                ], $this->userId()), 'saveSignup');
            });

            return $this->ok($enabled === 1 ? 'Registro encendido. El QR ya da tarjetas.' : 'Registro apagado. El QR ya no da tarjetas.', $this->programReply());
        }, 'No se pudo guardar el registro.');
    }

    // Token nuevo para el QR de la sucursal: el cartel impreso antes deja de abrir.
    public function newSignupLink() {
        $fail = $this->needPoints('update') ?: $this->needBranch();
        if ($fail) return $fail;

        return $this->attempt(function () {
            $branchId = $this->branchId();

            $this->transaction(function () use ($branchId) {
                $token = $this->loyaltySignupToken();

                $this->must($this->qSignupLink($branchId) ? $this->qRenewSignupLink($branchId, $token) : $this->qCreateSignupLink($branchId, $token), 'newSignupLink');
            });

            return $this->ok('Enlace nuevo listo. Imprime el cartel otra vez: el anterior ya no abre.', $this->programReply());
        }, 'No se pudo cambiar el enlace de registro.');
    }

    // -- Programa: cumpleaños --

    /*  Encender la felicitacion y el regalo: sellos (tarjetas de sellos) y $ al
        monedero (tarjetas de puntos); 0 = solo la felicitacion. Pide 'update'. */
    public function saveBirthday() {
        $fail = $this->needPoints('update') ?: $this->needBranch();
        if ($fail) return $fail;

        $enabled = $this->post('birthday_enabled') === '1' ? 1 : 0;
        $stamps  = $this->post('birthday_stamps', '0');
        $points  = $this->post('birthday_points', '0');

        if (!preg_match('/^\d{1,2}$/', $stamps === '' ? '0' : $stamps) || (int) $stamps > self::MAX_GOAL) {
            return $this->fail(422, 'Los sellos de regalo van de 0 a ' . self::MAX_GOAL . '.');
        }

        if (!preg_match('/^\d{1,5}(\.\d{1,2})?$/', $points === '' ? '0' : $points) || (float) $points > self::MAX_GIFT) {
            return $this->fail(422, 'El regalo al monedero va de $0 a ' . money(self::MAX_GIFT) . ', con hasta 2 decimales.');
        }

        return $this->attempt(function () use ($enabled, $stamps, $points) {
            $this->transaction(function () use ($enabled, $stamps, $points) {
                $this->must($this->qSaveLoyaltySetting($this->companyId(), [
                    'birthday_enabled' => $enabled,
                    'birthday_stamps'  => (int) $stamps,
                    'birthday_points'  => round((float) $points, 2)
                ], $this->userId()), 'saveBirthday');
            });

            return $this->ok($enabled === 1 ? 'Cumpleaños encendido.' : 'Cumpleaños apagado.', $this->programReply());
        }, 'No se pudo guardar Cumpleaños.');
    }

    // La lista: de 7 días atrás a 30 adelante, con el regalo y el estado de cada uno.
    public function lsBirthdays() {
        $fail = $this->needPoints('show') ?: $this->needBranch();
        if ($fail) return $fail;

        return $this->attempt(function () {
            $setting = $this->qLoyaltySetting($this->companyId());
            $rows    = [];

            foreach ($this->loyaltyBirthdays(date('Y-m-d'), self::BDAY_BACK, self::BDAY_AHEAD, $setting) as $b) {
                $rows[] = [
                    'id'         => $b['customer_id'],
                    'Cliente'    => '<div class="font-semibold text-gray-800">' . h($b['name'] !== '' ? $b['name'] : 'Sin nombre') . '</div>'
                                  . ($b['phone'] !== '' ? '<div class="ord-sub">' . h($b['phone']) . '</div>' : ''),
                    'Cumpleaños' => '<span class="whitespace-nowrap">' . h($b['birthday']) . '</span><div class="ord-sub">' . $this->birthdayWhen($b['in']) . '</div>',
                    'Tarjeta'    => '<span class="font-semibold text-gray-800">' . h($b['type']) . '</span><div class="ord-sub">' . h($b['number']) . '</div>',
                    'Regalo'     => h($b['gift']['label']),
                    'Estado'     => $this->birthdayPill($b),
                    'a'          => [[
                        'class'      => $this->actionBtnClass('neutral', true),
                        'html'       => '<i data-lucide="eye" class="w-4 h-4"></i>',
                        'aria-label' => 'Ver tarjeta',
                        'onclick'    => "loyalty.listCard({$b['card_id']})"
                    ]]
                ];
            }

            return ['status' => 200, 'row' => $rows, 'count' => count($rows)];
        }, 'No se pudo cargar la lista de cumpleaños.');
    }

    /*  «Felicitar a los de hoy»: el regalo y el WhatsApp a quien le toca hoy.
        Pide 'update', Cumpleaños encendido y número de WhatsApp de la empresa. */
    public function sendBirthdays() {
        $fail = $this->needPoints('update') ?: $this->needBranch();
        if ($fail) return $fail;

        return $this->attempt(function () {
            $setting = $this->qLoyaltySetting($this->companyId());

            if ((int) $setting['birthday_enabled'] !== 1) return $this->fail(409, 'Cumpleaños está apagado: enciéndelo en «Configurar».');
            if (!$this->loyaltyWaState()['ready'])          return $this->fail(409, 'La empresa no tiene número de WhatsApp: se da de alta en Ventas › WhatsApp.');

            $c    = $this->loyaltyBirthdayRun(date('Y-m-d'), $setting, self::BDAY_RUN);
            $ok   = $c['sent'] + $c['simulated'];
            $text = $ok > 0 ? $this->countText($ok, 'cliente felicitado', 'clientes felicitados') . ($c['simulated'] > 0 ? ' (simulado)' : '') . '.' : 'Nadie felicitado.';

            if ($c['failed'] + $c['skip'] > 0) $text .= ' A ' . ($c['failed'] + $c['skip']) . ' no les salió el WhatsApp; su regalo sí quedó.';
            if ($c['done'] > 0)                $text .= ' ' . $c['done'] . ' ya estaban felicitados.';

            return $this->ok($text, $this->programReply() + ['counts' => $c]);
        }, 'No se pudo felicitar a los de hoy.');
    }

    /*  El cumpleaños del dueño de la tarjeta, desde la ficha (día y mes; 0 y 0
        lo borra). Pide 'update'. */
    public function setBirthday() {
        $fail = $this->needPoints('update') ?: $this->needBranch();
        if ($fail) return $fail;

        $id    = $this->postId();
        $day   = (int) $this->post('day', '0');
        $month = (int) $this->post('month', '0');

        if (($day || $month) && !($day && $month && checkdate($month, $day, 2000))) return $this->fail(422, 'Esa fecha no existe: revisa el día y el mes.');

        return $this->attempt(function () use ($id, $day, $month) {
            $card = $id > 0 ? $this->qCard($id, $this->branchId()) : null;

            if (!$card)                     return $this->fail(404, 'Esa tarjeta no es de esta empresa o ya no existe.');
            if ($card['owner_id'] === null) return $this->fail(409, 'La tarjeta no tiene cliente: el cumpleaños es del cliente.');

            $this->transaction(function () use ($card, $day, $month) {
                $this->must($this->qSetBirthday((int) $card['owner_id'], $day ? sprintf('2000-%02d-%02d', $month, $day) : null), 'setBirthday');
            });

            return $this->ok($day ? 'Cumpleaños guardado.' : 'Cumpleaños borrado.', ['birthday' => $this->detailBirthday((int) $card['owner_id'])]);
        }, 'No se pudo guardar el cumpleaños.');
    }

    // -- Programa: te extrañamos --

    // Encender, cuántos días sin comprar y el tope de mensajes por día. Pide 'update'.
    public function saveWinback() {
        $fail = $this->needPoints('update') ?: $this->needBranch();
        if ($fail) return $fail;

        $enabled = $this->post('winback_enabled') === '1' ? 1 : 0;
        $days    = $this->post('winback_days');
        $cap     = $this->post('winback_daily_cap');

        if (!preg_match('/^\d{1,3}$/', $days) || (int) $days < 7 || (int) $days > 365) return $this->fail(422, 'Los días sin comprar van de 7 a 365.');
        if (!preg_match('/^\d{1,4}$/', $cap) || (int) $cap < 1 || (int) $cap > 1000)    return $this->fail(422, 'El tope por día va de 1 a 1,000 mensajes.');

        return $this->attempt(function () use ($enabled, $days, $cap) {
            $this->transaction(function () use ($enabled, $days, $cap) {
                $this->must($this->qSaveLoyaltySetting($this->companyId(), [
                    'winback_enabled'   => $enabled,
                    'winback_days'      => (int) $days,
                    'winback_daily_cap' => (int) $cap
                ], $this->userId()), 'saveWinback');
            });

            return $this->ok($enabled === 1 ? 'Te extrañamos encendido.' : 'Te extrañamos apagado.', $this->programReply());
        }, 'No se pudo guardar Te extrañamos.');
    }

    // La lista: quien lleva los días sin comprar, su motivo y si le toca (o por qué no).
    public function lsWinbacks() {
        $fail = $this->needPoints('show') ?: $this->needBranch();
        if ($fail) return $fail;

        return $this->attempt(function () {
            $setting = $this->qLoyaltySetting($this->companyId());
            $list    = $this->loyaltyWinbacks((int) $setting['winback_days'], time());
            $rows    = [];

            foreach (array_slice($list, 0, self::WB_LIST) as $w) {
                $rows[] = [
                    'id'           => $w['customer_id'],
                    'Cliente'      => '<div class="font-semibold text-gray-800">' . h($w['name'] !== '' ? $w['name'] : 'Sin nombre') . '</div>'
                                    . ($w['phone'] !== '' ? '<div class="ord-sub">' . h($w['phone']) . '</div>' : ''),
                    'Última compra' => $w['bought']
                                    ? '<span class="whitespace-nowrap">' . date('d/m/Y', strtotime($w['ref'])) . '</span><div class="ord-sub">Hace ' . $w['away'] . ' días</div>'
                                    : '<span class="text-gray-400">Nunca</span><div class="ord-sub">Tarjeta de hace ' . $w['away'] . ' días</div>',
                    'Tarjeta'      => '<span class="font-semibold text-gray-800">' . h($w['type']) . '</span><div class="ord-sub">' . h($w['number']) . '</div>',
                    'Motivo'       => '<span class="text-[12.5px]">' . h($w['reason']) . '</span>',
                    'Estado'       => $this->winbackPill($w),
                    'a'            => [[
                        'class'      => $this->actionBtnClass('neutral', true),
                        'html'       => '<i data-lucide="eye" class="w-4 h-4"></i>',
                        'aria-label' => 'Ver tarjeta',
                        'onclick'    => "loyalty.listCard({$w['card_id']})"
                    ]]
                ];
            }

            $more = count($list) > self::WB_LIST ? 'Se muestran ' . self::WB_LIST . ' de ' . count($list) . ': los que dejaron de venir hace menos.' : '';

            return ['status' => 200, 'row' => $rows, 'count' => count($list), 'moreText' => $more, 'days' => (int) $setting['winback_days']];
        }, 'No se pudo cargar la lista.');
    }

    /*  «Mandar los de hoy»: el WhatsApp a los que les toca, sin pasar del tope
        del día. Pide 'update', Te extrañamos encendido y número de la empresa. */
    public function sendWinbacks() {
        $fail = $this->needPoints('update') ?: $this->needBranch();
        if ($fail) return $fail;

        return $this->attempt(function () {
            $setting = $this->qLoyaltySetting($this->companyId());

            if ((int) $setting['winback_enabled'] !== 1) return $this->fail(409, 'Te extrañamos está apagado: enciéndelo en «Configurar».');
            if (!$this->loyaltyWaState()['ready'])        return $this->fail(409, 'La empresa no tiene número de WhatsApp: se da de alta en Ventas › WhatsApp.');

            $c    = $this->loyaltyWinbackRun($setting, self::WB_RUN, time());
            $ok   = $c['sent'] + $c['simulated'];
            $text = $ok > 0 ? $this->countText($ok, 'mensaje enviado', 'mensajes enviados') . ($c['simulated'] > 0 ? ' (simulado)' : '') . '.' : 'No salió ningún mensaje.';

            if ($c['failed'] + $c['skip'] > 0) $text .= ' A ' . ($c['failed'] + $c['skip']) . ' no les salió.';
            if ($c['cap'] > 0)                 $text .= ' ' . $c['cap'] . ' se quedan para después (tope).';

            return $this->ok($text, $this->programReply() + ['counts' => $c]);
        }, 'No se pudieron mandar los mensajes.');
    }

    private function winbackPill(array $w) {
        $pill = fn ($tone, $text) => '<span class="ord-pill ' . $tone . '">' . $text . '</span>';

        switch ($w['state']) {
            case 'due':     return $pill('bg-indigo-50 text-indigo-700', 'Le toca');
            case 'sent':    return $pill('bg-emerald-50 text-emerald-700', 'Escrito el ' . date('d/m', strtotime($w['sent_at'])));
            case 'nooptin': return $pill('bg-slate-100 text-slate-600', 'No aceptó mensajes');
            case 'baja':    return $pill('bg-slate-100 text-slate-600', 'Escribió BAJA');
            case 'nophone': return $pill('bg-slate-100 text-slate-600', 'Sin WhatsApp válido');
        }

        return $pill('bg-slate-100 text-slate-600', '-');
    }

    // -- Programa: niveles --

    // Encender o apagar los niveles (la escalera se arma en los tipos). Pide 'update'.
    public function saveLevels() {
        $fail = $this->needPoints('update') ?: $this->needBranch();
        if ($fail) return $fail;

        $enabled = $this->post('levels_enabled') === '1' ? 1 : 0;

        return $this->attempt(function () use ($enabled) {
            $this->transaction(function () use ($enabled) {
                $this->must($this->qSaveLoyaltySetting($this->companyId(), ['levels_enabled' => $enabled], $this->userId()), 'saveLevels');
            });

            return $this->ok($enabled === 1 ? 'Niveles encendido. Revisa los niveles para acomodar las tarjetas de hoy.' : 'Niveles apagado.', $this->programReply());
        }, 'No se pudo guardar Niveles.');
    }

    // Lo que haría la revisión: cada tarjeta que cambia, su gasto y de qué nivel a cuál. Solo lee.
    public function lsLevelChanges() {
        $fail = $this->needPoints('show') ?: $this->needBranch();
        if ($fail) return $fail;

        return $this->attempt(function () {
            $rows = [];
            $plan = $this->loyaltyLevelPlan();

            foreach ($plan as $p) {
                $r      = $p['row'];
                $name   = trim((string) $r['customer']) !== '' ? $r['customer'] : ($r['holder'] !== '' ? $r['holder'] : 'Sin cliente');
                $up     = $p['direction'] === 'sube';
                $rows[] = [
                    'id'              => (int) $r['id'],
                    'Tarjeta'         => '<div class="font-semibold text-gray-800">' . h($name) . '</div><div class="ord-sub">' . h($r['number']) . '</div>',
                    'Gasto 12 meses'  => money($r['spend']),
                    'Nivel hoy'       => h($r['type']),
                    'Nivel nuevo'     => '<span class="font-semibold text-gray-800">' . h($p['target']['name']) . '</span>',
                    'Cambio'          => '<span class="ord-pill ' . ($up ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700') . '">' . ($up ? 'Sube' : 'Baja') . '</span>'
                ];
            }

            return ['status' => 200, 'row' => $rows, 'count' => count($plan), 'up' => count(array_filter($plan, fn ($p) => $p['direction'] === 'sube'))];
        }, 'No se pudo revisar los niveles.');
    }

    /*  «Revisar niveles»: sube y baja las tarjetas que no están en su nivel, hasta
        LEVEL_RUN por clic. Pide 'update' y Niveles encendido. */
    public function applyLevels() {
        $fail = $this->needPoints('update') ?: $this->needBranch();
        if ($fail) return $fail;

        return $this->attempt(function () {
            $setting = $this->qLoyaltySetting($this->companyId());

            if ((int) $setting['levels_enabled'] !== 1) return $this->fail(409, 'Niveles está apagado: enciéndelo en «Configurar».');

            $c     = $this->loyaltyLevelReview(self::LEVEL_RUN);
            $moved = $c['up'] + $c['down'];
            $text  = $moved > 0 ? "{$c['up']} subieron y {$c['down']} bajaron." : 'Todas las tarjetas ya estaban en su nivel.';

            if ($c['told'] > 0) $text .= ' ' . $this->countText($c['told'], 'aviso', 'avisos') . ' por WhatsApp.';
            if ($c['left'] > 0) $text .= " Faltan {$c['left']}: vuelve a revisar.";

            return $this->ok($text, $this->programReply() + ['counts' => $c]);
        }, 'No se pudieron revisar los niveles.');
    }

    /*  Para la ficha: en qué nivel está, cuánto gastó en 12 meses y cuánto le
        falta para el siguiente. null = su tipo no está en la escalera. */
    private function detailLevel($card) {
        if ((int) $card['active'] !== 1) return null;

        $levels = $this->qLevels($this->branchId());
        $place  = $this->levelPlace($levels, (int) $card['card_type_id']);

        if (!$place || count($levels) < 2) return null;

        $row   = $this->qLevelCards($this->branchId(), $this->levelSince(), (int) $card['id'])[0] ?? null;
        $spend = $row ? (float) $row['spend'] : 0.0;
        $above = $this->levelAbove($levels, (int) $card['card_type_id']);
        $text  = money($spend) . ' en 12 meses';
        $from  = 0.0;

        foreach ($levels as $l) {
            if ((int) $l['id'] === (int) $card['card_type_id']) $from = (float) $l['level_min_spend'];
        }

        // La barra va del mínimo de su nivel al del siguiente; en el más alto, llena.
        $goal = $above ? (float) $above['level_min_spend'] : $spend;
        $pct  = $above && $goal > $from ? max(0, min(1, ($spend - $from) / ($goal - $from))) : 1;

        if (!$above)                     $text .= ' · es el nivel más alto';
        elseif ($spend + 0.005 >= $goal) $text .= " · ya alcanza {$above['name']}: sube en su próxima compra o en la revisión";
        else                             $text .= ' · le faltan ' . money($goal - $spend) . " para {$above['name']}";

        return [
            'title' => "Nivel {$card['type']} · {$place} de " . count($levels),
            'text'  => $text,
            'note'  => (int) $this->qLoyaltySetting($this->companyId())['levels_enabled'] === 1 ? '' : 'Niveles está apagado: no sube ni baja.',
            'bar'   => [
                'head'  => !$above ? 'Está en el nivel más alto' : ($spend + 0.005 >= $goal ? "Ya alcanza {$above['name']}" : 'Faltan ' . $this->moneyShort($goal - $spend) . " para {$above['name']}"),
                'side'  => $above ? $this->moneyShort($spend) . ' de ' . $this->moneyShort($goal) : $this->moneyShort($spend),
                'pct'   => round($pct * 100, 1),
                'top'   => !$above
            ]
        ];
    }

    // «Hoy», «Mañana», «En 3 días», «Hace 2 días».
    private function birthdayWhen($in) {
        if ($in === 0)  return 'Hoy';
        if ($in === 1)  return 'Mañana';
        if ($in === -1) return 'Ayer';

        return $in > 0 ? "En {$in} días" : 'Hace ' . abs($in) . ' días';
    }

    // El estado de un cumpleaños en la lista, como píldora.
    private function birthdayPill(array $b) {
        $pill = fn ($tone, $text) => '<span class="ord-pill ' . $tone . '">' . $text . '</span>';
        $when = $b['greeted_at'] !== '' ? ' el ' . date('d/m', strtotime($b['greeted_at'])) : '';

        switch ($b['state']) {
            case 'done':
                if ($b['greeted'] === 'sent')      return $pill('bg-emerald-50 text-emerald-700', 'Felicitado' . $when);
                if ($b['greeted'] === 'simulated') return $pill('bg-emerald-50 text-emerald-700', 'Felicitado' . $when . ' (simulado)');
                if ($b['greeted'] === 'pending')   return $pill('bg-slate-100 text-slate-600', 'Mandando…');

                return $pill('bg-amber-50 text-amber-700', 'Regalo dado; el WhatsApp no salió');
            case 'due':     return $pill('bg-indigo-50 text-indigo-700', 'Le toca hoy');
            case 'missed':  return $pill('bg-amber-50 text-amber-700', 'No se felicitó');
            case 'nooptin': return $pill('bg-slate-100 text-slate-600', 'No aceptó mensajes');
            case 'baja':    return $pill('bg-slate-100 text-slate-600', 'Escribió BAJA');
            case 'nophone': return $pill('bg-slate-100 text-slate-600', 'Sin WhatsApp válido');
        }

        return $pill('bg-slate-100 text-slate-600', 'Próximo');
    }

    /*  El cumpleaños para la ficha: el texto, día y mes (para el formulario), si
        acepta mensajes y cómo le fue este año. Null si el cliente no existe. */
    private function detailBirthday($customerId) {
        $row = $this->qCustomerBirthday($customerId, date('Y-01-01 00:00:00'));

        if (!$row) return null;

        $birthday = (string) $row['birthday'];
        $greeted  = (string) $row['greeted'];
        $status   = '';

        if ($greeted !== '') {
            list($at, $how) = array_pad(explode('|', $greeted, 2), 2, '');
            $status = 'Felicitado el ' . date('d/m/Y', strtotime($at)) . (in_array($how, ['sent', 'simulated', 'pending'], true) ? '' : ' (el WhatsApp no salió)');
        }

        return [
            'text'   => $birthday !== '' ? $this->birthdayText($birthday) : '',
            'day'    => $birthday !== '' ? (int) substr($birthday, 8, 2) : 0,
            'month'  => $birthday !== '' ? (int) substr($birthday, 5, 2) : 0,
            'optin'  => $row['whatsapp_optin_at'] !== null ? 'Acepta mensajes desde el ' . date('d/m/Y', strtotime($row['whatsapp_optin_at'])) : 'No ha aceptado mensajes de la tienda',
            'status' => $status
        ];
    }

    /*  Lo que pinta la pestaña: el registro (encendido, tipo de bienvenida y si
        sirve hoy), el enlace de esta sucursal, cuántos se registraron en el mes
        y los tipos activos para elegir. Sin enlace y con 'update', lo crea. */
    private function programReply() {
        $scope    = $this->scope();
        $branchId = $this->branchId();
        $setting  = $this->qLoyaltySetting($this->companyId());
        $canEdit  = Permission::can(static::PAGE, 'update');
        $link     = $this->qSignupLink($branchId);

        if (!$link && $canEdit) {
            $this->transaction(function () use ($branchId) {
                $this->must($this->qCreateSignupLink($branchId, $this->loyaltySignupToken()), 'programReply');
            });

            $link = $this->qSignupLink($branchId);
        }

        $typeId = (int) $setting['signup_type_id'];
        $type   = $typeId > 0 ? $this->qCardType($typeId, $branchId) : null;
        $types  = [];

        foreach ($this->qCardTypes($branchId, 1) as $t) {
            $types[] = ['id' => (int) $t['id'], 'valor' => (string) $t['name'], 'benefit' => $this->typeText($t)];
        }

        list($from, $to) = $this->monthRange();

        $stats   = $this->qSignupStats($this->companyId(), $from, $to);
        $created = (int) $stats['created'];
        $enabled = (int) $setting['signup_enabled'] === 1;
        $usable  = $type && (int) $type['active'] === 1;
        $wa      = $this->loyaltyWaState();

        return [
            'can_edit' => $canEdit,
            'signup'   => [
                'enabled'   => $enabled,
                'type_id'   => $type ? $typeId : 0,
                'type'      => $type ? (string) $type['name'] : '',
                'benefit'   => $type ? $this->typeText($type) : '',
                'perk'      => $type ? $this->perkText($type) : '',
                'color'     => $type ? $this->colorOf($type['color']) : self::CARD_COLOR,
                'note'      => $this->signupNote($enabled, $type, $usable),
                'live'      => $enabled && $usable,
                'url'       => $link ? $this->loyaltySignupUrl($link['token']) : '',
                'since'     => $link ? date('d/m/Y', strtotime((string) $link['created_at'])) : '',
                'branch'    => (string) $scope['branch'],
                'company'   => (string) $scope['company'],
                'month'     => $created,
                'monthText' => $created > 0 ? $this->countText($created, 'tarjeta nueva', 'tarjetas nuevas') . ' en ' . $this->monthLabel() : 'Nadie se ha registrado en ' . $this->monthLabel()
            ],
            'birthday' => $this->birthdayReply($setting, $wa),
            'winback'  => $this->winbackReply($setting, $wa),
            'levels'   => $this->levelsReply($setting),
            'messages' => $this->programMessages($setting, $type),
            'types'    => $types,
            'whatsapp' => $wa
        ];
    }

    /*  «Mensajes que salen solos» de la pestaña Programa: cada plantilla de
        lealtad con cuándo sale, cuántos salieron este mes (sent o simulated) y su
        texto con datos de ejemplo (la vista previa del teléfono).
        toggle: el ajuste que lo enciende (birthday, winback o levels); '' = sale
        siempre que la empresa tenga WhatsApp. $welcome: el tipo de bienvenida. */
    private function programMessages(array $setting, $welcome) {
        $business = trim((string) $this->scope()['company']);
        $sent     = $this->qNoticeCounts($this->companyId(), date('Y-m-01 00:00:00'));
        $link     = '…/tarjeta.php?t=…';
        $stamps   = (int) $setting['birthday_stamps'];
        $points   = round((float) $setting['birthday_points'], 2);
        $days     = max(1, (int) $setting['winback_days']);
        $cap      = (int) $setting['winback_daily_cap'];
        $prize    = null;

        // El premio de ejemplo: el del primer tipo de sellos activo de la empresa.
        foreach ($this->qCardTypes($this->branchId(), 1) as $t) {
            if ((int) $t['stamp_goal'] > 0) { $prize = $t; break; }
        }

        $goal   = $prize ? (int) $prize['stamp_goal'] : 10;
        $reward = $prize ? trim((string) $prize['reward_name']) : 'Café gratis';
        $gift   = $stamps > 0 ? 'te regalamos ' . $this->countText($stamps, 'sello', 'sellos') . ' en tu tarjeta'
                : ($points > 0 ? 'te regalamos ' . money($points) . ' en tu monedero' : 'te esperamos con tu tarjeta');

        $rows = [
            ['key' => 'tarjeta', 'icon' => 'qr-code', 'title' => 'Tu tarjeta', 'when' => 'Al registrarse o cuando se la mandas desde Tarjetas',
             'toggle' => '', 'on' => true, 'sent' => $sent['bienvenida'] ?? 0,
             'params' => ['Mariana', $welcome ? (string) $welcome['name'] : 'Cliente Frecuente', $business, $link]],
            ['key' => 'premio', 'icon' => 'gift', 'title' => 'Premio listo', 'when' => 'Al cobrar la venta que completa sus sellos',
             'toggle' => '', 'on' => true, 'sent' => $sent['premio'] ?? 0,
             'params' => ['Mariana', (string) $goal, $business, $reward, $link]],
            ['key' => 'cumple', 'icon' => 'cake', 'title' => 'Cumpleaños', 'when' => 'En su día · ' . ($stamps > 0 || $points > 0 ? 'con regalo' : 'solo la felicitación'),
             'toggle' => 'birthday', 'on' => (int) $setting['birthday_enabled'] === 1, 'sent' => $sent['cumple'] ?? 0,
             'params' => ['Mariana', $business, $gift, $link]],
            ['key' => 'regreso', 'icon' => 'heart-handshake', 'title' => 'Te extrañamos', 'when' => "Si lleva {$days} días sin comprar · tope de {$cap} al día",
             'toggle' => 'winback', 'on' => (int) $setting['winback_enabled'] === 1, 'sent' => $sent['regreso'] ?? 0,
             'params' => ['Mariana', $business, "Llevas 7 de {$goal} sellos para tu {$reward}.", $link]],
            ['key' => 'nivel', 'icon' => 'trophy', 'title' => 'Nuevo nivel', 'when' => 'Al subir al cobrar o en la revisión de cada mes',
             'toggle' => 'levels', 'on' => (int) $setting['levels_enabled'] === 1, 'sent' => $sent['nivel'] ?? 0,
             'params' => ['Mariana', $business, 'VIP', '¡Felicidades! Ahora tienes 10 % de lo que pagas en puntos.', $link]]
        ];

        return array_map(function ($r) {
            $r['text']     = $this->waTemplateFill($r['key'], $r['params']);
            $r['sentText'] = $r['sent'] > 0 ? $this->countText($r['sent'], 'enviado', 'enviados') : 'Ninguno';

            unset($r['params']);

            return $r;
        }, $rows);
    }

    /*  La caja «Te extrañamos»: ajustes, a cuántos les toca hoy (y cuánto deja el
        tope), cuántos salieron este mes y cuántos de ellos volvieron. */
    private function winbackReply(array $setting, array $wa) {
        $now     = time();
        $days    = max(1, (int) $setting['winback_days']);
        $cap     = (int) $setting['winback_daily_cap'];
        $list    = $this->loyaltyWinbacks($days, $now);
        $due     = count(array_filter($list, fn ($w) => $w['state'] === 'due'));
        $today   = $this->qWinbackCount($this->companyId(), date('Y-m-d 00:00:00', $now));
        $room    = max(0, $cap - $today);
        $month   = $this->qWinbackBack($this->companyId(), date('Y-m-01 00:00:00', $now));
        $sent    = (int) $month['sent'];
        $enabled = (int) $setting['winback_enabled'] === 1;

        $note = '';

        if (!$enabled)         $note = 'Apagado: no sale ningún «te extrañamos».';
        elseif (!$wa['ready']) $note = 'La empresa no tiene número de WhatsApp: no sale nada.';
        elseif ($room === 0)   $note = 'Hoy ya se llegó al tope de ' . $cap . ' mensajes. Mañana sigue.';
        else                   $note = $this->autoNote();

        return [
            'enabled'   => $enabled,
            'days'      => $days,
            'cap'       => $cap,
            'daysText'  => "{$days} días o más sin comprar",
            'awayText'  => count($list) > 0 ? $this->countText(count($list), 'cliente', 'clientes') . ' en total' : 'Nadie',
            'dueText'   => $due > 0 ? "A {$due} les toca" . ($due > $room ? " · hoy caben {$room}" : '') : 'A nadie le toca hoy',
            'capText'   => "{$today} de {$cap} enviados hoy",
            'monthText' => $sent > 0 ? $this->countText($sent, 'mensaje', 'mensajes') . ' · volvieron ' . (int) $month['back'] : 'Ninguno este mes',
            'back'      => (int) $month['back'],
            'due'       => min($due, $room),
            'canSend'   => $enabled && $wa['ready'] && $due > 0 && $room > 0,
            'note'      => $note
        ];
    }

    /*  La tarea de cada hora (cron-lealtad.php) no corre sin WHATSAPP_PUBLIC_URL:
        sin ella, lo dice en la caja. '' = lo automático puede correr. */
    private function autoNote() {
        return $this->loyaltyPublicBase() === '' ? 'Lo automático aún no corre en este servidor (falta su dirección pública). Mientras, usa el botón.' : '';
    }

    /*  La caja «Niveles»: la escalera, cuántas tarjetas hay en ella, lo que se
        movió este mes y la última revisión. */
    private function levelsReply(array $setting) {
        $levels  = $this->qLevels($this->branchId());
        $moves   = $this->qLevelMoves($this->branchId(), date('Y-m-01 00:00:00'));
        $enabled = (int) $setting['levels_enabled'] === 1;
        $ladder  = implode(' → ', array_map(fn ($l) => $l['name'] . ' (' . money($l['level_min_spend']) . ')', $levels));
        $cards   = count($levels) >= 2 ? count($this->qLevelCards($this->branchId(), $this->levelSince())) : 0;
        $up      = (int) $moves['up'];
        $down    = (int) $moves['down'];

        $note = '';

        if (count($levels) < 2) $note = 'Faltan niveles: pon el «Gasto mínimo en 12 meses» en al menos 2 tipos de tarjeta (Tipos de tarjeta › Editar).';
        elseif (!$enabled)      $note = 'Apagado: ninguna tarjeta sube ni baja.';
        else                    $note = $this->autoNote();

        return [
            'enabled'    => $enabled,
            'count'      => count($levels),
            'ladderText' => $ladder !== '' ? $ladder : 'Sin niveles',
            'cardsText'  => $cards > 0 ? $this->countText($cards, 'tarjeta', 'tarjetas') : 'Ninguna',
            'monthText'  => $up + $down > 0 ? "{$up} subieron · {$down} bajaron" : 'Nadie ha cambiado de nivel',
            'up'         => $up,
            'down'       => $down,
            'reviewText' => $setting['levels_reviewed_at'] ? date('d/m/Y', strtotime((string) $setting['levels_reviewed_at'])) : 'Nunca',
            'canReview'  => $enabled && count($levels) >= 2,
            'note'       => $note
        ];
    }

    /*  La caja «Cumpleaños»: ajustes, quién cumple hoy y en 30 días, cuántos se
        felicitaron en el año y si se puede mandar hoy. */
    private function birthdayReply(array $setting, array $wa) {
        $list    = $this->loyaltyBirthdays(date('Y-m-d'), 0, self::BDAY_AHEAD, $setting);
        $today   = array_values(array_filter($list, fn ($b) => $b['in'] === 0));
        $due     = count(array_filter($today, fn ($b) => $b['state'] === 'due'));
        $next    = count($list) - count($today);
        $year    = $this->qBirthdayCount($this->companyId(), date('Y-01-01 00:00:00'));
        $enabled = (int) $setting['birthday_enabled'] === 1;
        $stamps  = (int) $setting['birthday_stamps'];
        $points  = round((float) $setting['birthday_points'], 2);

        $note = '';

        if (!$enabled)         $note = 'Apagado: nadie recibe felicitación ni regalo.';
        elseif (!$wa['ready']) $note = 'La empresa no tiene número de WhatsApp: no sale la felicitación ni el regalo.';
        else                   $note = $this->autoNote();

        $done      = count(array_filter($today, fn ($b) => $b['state'] === 'done'));
        $todayText = !$today ? 'Nadie cumple hoy' : implode(' · ', array_filter([
            $this->countText(count($today), 'cumple', 'cumplen') . ' hoy',
            $due > 0 && $due !== count($today) ? "a {$due} les toca" : '',
            $done > 0 ? $this->countText($done, 'felicitado', 'felicitados') : ''
        ]));

        return [
            'enabled'   => $enabled,
            'stamps'    => $stamps,
            'points'    => $points,
            'giftText'  => implode(' · ', array_filter([
                               $stamps > 0 ? $this->countText($stamps, 'sello', 'sellos') . ' en tarjetas de sellos' : '',
                               $points > 0 ? money($points) . ' al monedero en tarjetas de puntos' : ''
                           ])) ?: 'Solo la felicitación',
            'todayText' => $todayText,
            'nextText'  => $next > 0 ? $this->countText($next, 'cumpleaños', 'cumpleaños') . ' en los próximos ' . self::BDAY_AHEAD . ' días' : 'Ninguno en los próximos ' . self::BDAY_AHEAD . ' días',
            'yearText'  => $year > 0 ? $this->countText($year, 'felicitado', 'felicitados') . ' en ' . date('Y') : 'Nadie felicitado en ' . date('Y'),
            'due'       => $due,
            'canSend'   => $enabled && $wa['ready'] && $due > 0,
            'note'      => $note
        ];
    }

    // Lo que da la tarjeta, dicho para el cliente (el cartel): «Con 10 sellos, Café gratis: 1 sello por cada $100».
    private function perkText($t) {
        if ((int) $t['stamp_goal'] > 0) {
            return 'Con ' . (int) $t['stamp_goal'] . ' sellos, ' . trim((string) $t['reward_name']) . ': 1 sello por cada ' . $this->moneyShort($t['stamp_amount']);
        }

        $pct      = fn ($v) => rtrim(rtrim(number_format((float) $v, 2, '.', ''), '0'), '.') . ' %';
        $discount = (float) $t['discount_percent'];
        $points   = (float) $t['points_percent'];

        if ($discount > 0) return $pct($discount) . ' de descuento en cada compra';
        if ($points > 0)   return $pct($points) . ' de lo que pagas regresa a tu monedero';

        return '';
    }

    // Qué le pasa hoy a quien escanea el QR. '' = todo bien.
    private function signupNote($enabled, $type, $usable) {
        if (!$enabled) return 'Apagado: quien escanee el QR verá «Pide tu tarjeta en caja».';
        if (!$type)    return 'Falta elegir la tarjeta de bienvenida.';
        if (!$usable)  return 'La tarjeta de bienvenida está inactiva: el QR no da tarjetas hasta activarla o elegir otra.';

        return '';
    }

    // -- Tipos: galeria --

    // Cada tipo con lo necesario para dibujar su tarjeta, cuantas tiene y lo que vendio este mes. Los botones los pone el JS.
    public function lsCardTypes() {
        $fail = $this->needPoints('show') ?: $this->needBranch();
        if ($fail) return $fail;

        $active = $this->statusFilter();

        return $this->attempt(function () use ($active) {
            list($from, $to) = $this->monthRange();

            $month = [];

            foreach ($this->qCardTypeSales($this->branchId(), $from, $to) as $row) {
                $month[(int) $row['card_type_id']] = $row;
            }

            $types  = [];
            $ladder = array_map(fn ($l) => (int) $l['id'], $this->qLevels($this->branchId()));

            foreach ($this->qCardTypes($this->branchId(), $active) as $type) {
                $id      = (int) $type['id'];
                $types[] = $this->typeTile($type, isset($month[$id]) ? $month[$id] : null) + $this->levelTile($type, $ladder);
            }

            return [
                'status' => 200,
                'types'  => $types,
                'count'  => count($types),
                'branch' => $this->scope()['branch']
            ];
        }, 'No se pudo cargar la lista de tipos de tarjeta.');
    }

    /*  La insignia de nivel de un tipo en la galeria. levelTag: «Nivel 2» ('' = no es
        nivel); levelFrom: «Desde $5,000 en 12 meses»; levelTop: es el mas alto (la
        insignia sale dorada). $ladder: ids de la escalera, del mas bajo al mas alto. */
    private function levelTile($t, array $ladder) {
        if ($t['level_min_spend'] === null) return ['levelTag' => '', 'levelFrom' => '', 'levelTop' => false, 'levelPlace' => 0, 'levelMin' => null];

        $place = array_search((int) $t['id'], $ladder, true);
        $from  = 'Desde ' . $this->moneyShort($t['level_min_spend']) . ' en 12 meses';
        $min   = round((float) $t['level_min_spend'], 2);

        if ($place === false) return ['levelTag' => 'Fuera de la escalera', 'levelFrom' => $from, 'levelTop' => false, 'levelPlace' => 0, 'levelMin' => $min];

        // levelPlace (1 = el más bajo) y levelMin: la tarjeta «Niveles y beneficios» del tablero ordena y pinta la escalera.
        return [
            'levelTag'   => 'Nivel ' . ($place + 1),
            'levelFrom'  => $from,
            'levelTop'   => count($ladder) > 1 && $place + 1 === count($ladder),
            'levelPlace' => $place + 1,
            'levelMin'   => $min
        ];
    }

    /*  Un tipo de la galeria. $month: sus ventas del mes (null = ninguna): cuantas,
        cuanto sumaron y el descuento y los puntos que dieron. Todo va como texto plano. */
    private function typeTile($t, $month) {
        return $this->stampFace($t) + [
            'id'            => (int) $t['id'],
            'name'          => (string) $t['name'],
            'color'         => $this->colorOf($t['color']),
            'discount'      => round((float) $t['discount_percent'], 2),
            'points'        => round((float) $t['points_percent'], 2),
            'benefit'       => $this->typeText($t),
            'active'        => (int) $t['active'] === 1,
            'cards'         => (int) $t['cards'],
            'sales'         => $month ? (int) $month['sales'] : 0,
            'sold'          => $month ? round((float) $month['sold'], 2) : 0,
            'discountGiven' => $month ? round((float) $month['discount'], 2) : 0,
            'pointsGiven'   => $month ? round((float) $month['points'], 2) : 0
        ];
    }

    // -- Tipos: uno --

    public function getCardType() {
        $fail = $this->needPoints('show') ?: $this->needBranch();
        if ($fail) return $fail;

        return $this->attempt(function () {
            $type = $this->qCardType($this->postId(), $this->branchId());

            if (!$type) return $this->fail(404, 'Ese tipo de tarjeta no es de esta empresa o ya no existe.');

            return ['status' => 200, 'row' => $this->typeFormRow($type)];
        }, 'No se pudo abrir el tipo de tarjeta.');
    }

    public function addCardType() {
        $fail = $this->needPoints('create') ?: $this->needBranch();
        if ($fail) return $fail;

        list($fail, $name, $discount, $points, $color, $stamps, $level) = $this->typeFields();
        if ($fail) return $fail;

        return $this->attempt(function () use ($name, $discount, $points, $color, $stamps, $level) {
            return $this->transaction(function () use ($name, $discount, $points, $color, $stamps, $level) {
                $taken = $this->qCardTypeNameTaken($this->branchId(), $name, 0);

                if ($taken) return $this->fail(409, "Ya hay un tipo de tarjeta llamado {$taken['name']} en esta empresa.");

                $tie = $level !== null ? $this->qLevelTaken($this->branchId(), $level, 0) : null;

                if ($tie) return $this->fail(409, "El nivel {$tie['name']} ya empieza en " . money($level) . ': dos niveles no pueden tener el mismo gasto mínimo.');

                $this->must($this->qCreateCardType([
                    'values' => ['name', 'discount_percent', 'points_percent', 'stamp_amount', 'stamp_goal', 'reward_name', 'reward_value', 'stamp_icon', 'level_min_spend', 'color', 'branch_id', 'active'],
                    'data'   => array_merge([$name, $discount, $points], $stamps, [$level, $color, $this->branchId(), 1])
                ]), 'addCardType');

                $id = $this->qLastInsertId();
                if ($id <= 0) throw new RuntimeException('addCardType: sin id');

                return $this->ok('Tipo de tarjeta agregado.', ['id' => $id]);
            });
        }, 'No se pudo guardar el tipo de tarjeta.');
    }

    // El cambio vale para las ventas siguientes: las ya cobradas guardan su propio descuento.
    public function editCardType() {
        $fail = $this->needPoints('update') ?: $this->needBranch();
        if ($fail) return $fail;

        list($fail, $name, $discount, $points, $color, $stamps, $level) = $this->typeFields();
        if ($fail) return $fail;

        $id = $this->postId();

        return $this->attempt(function () use ($id, $name, $discount, $points, $color, $stamps, $level) {
            return $this->transaction(function () use ($id, $name, $discount, $points, $color, $stamps, $level) {
                $type = $this->qCardType($id, $this->branchId());

                if (!$type) return $this->fail(404, 'Ese tipo de tarjeta no es de esta empresa o ya no existe.');

                $taken = $this->qCardTypeNameTaken($this->branchId(), $name, $id);

                if ($taken) return $this->fail(409, "Ya hay un tipo de tarjeta llamado {$taken['name']} en esta empresa.");

                $tie = $level !== null ? $this->qLevelTaken($this->branchId(), $level, $id) : null;

                if ($tie) return $this->fail(409, "El nivel {$tie['name']} ya empieza en " . money($level) . ': dos niveles no pueden tener el mismo gasto mínimo.');

                $this->must($this->qUpdateCardType([
                    'values' => ['name', 'discount_percent', 'points_percent', 'stamp_amount', 'stamp_goal', 'reward_name', 'reward_value', 'stamp_icon', 'level_min_spend', 'color', 'updated_at = NOW()'],
                    'where'  => ['id'],
                    'data'   => array_merge([$name, $discount, $points], $stamps, [$level, $color, $id])
                ]), 'editCardType');

                return $this->ok('Tipo de tarjeta actualizado.', ['id' => $id]);
            });
        }, 'No se pudo guardar el tipo de tarjeta.');
    }

    // Al desactivar un tipo, sus tarjetas dejan de leerse en Vender (no se tocan).
    public function statusCardType() {
        $fail = $this->needPoints('update') ?: $this->needBranch();
        if ($fail) return $fail;

        $id     = $this->postId();
        $active = $this->post('active') === '1' ? 1 : 0;

        return $this->attempt(function () use ($id, $active) {
            return $this->transaction(function () use ($id, $active) {
                $type = $this->qCardType($id, $this->branchId());

                if (!$type) return $this->fail(404, 'Ese tipo de tarjeta no es de esta empresa o ya no existe.');

                if ((int) $type['active'] === $active) {
                    return $this->ok($active === 1 ? 'El tipo ya estaba activo.' : 'El tipo ya estaba inactivo.', ['id' => $id]);
                }

                $this->must($this->qUpdateCardType([
                    'values' => ['active', 'updated_at = NOW()'],
                    'where'  => ['id'],
                    'data'   => [$active, $id]
                ]), 'statusCardType');

                return $this->ok($active === 1 ? 'Tipo de tarjeta reactivado.' : 'Tipo de tarjeta desactivado.', ['id' => $id]);
            });
        }, 'No se pudo cambiar el estado del tipo de tarjeta.');
    }

    // -- Complements --

    private function needPoints($action) {
        if (Permission::can(static::PAGE, $action)) return null;

        $what = static::PAGE === self::POINTS ? [
            'show'   => 'ver tarjetas y puntos',
            'create' => 'agregar tarjetas ni tipos de tarjeta',
            'update' => 'editar tarjetas ni tipos de tarjeta'
        ] : [
            'show'   => 'ver el programa de lealtad',
            'update' => 'cambiar el programa de lealtad'
        ];

        $text = isset($what[$action]) ? $what[$action] : 'hacer esto';

        return ['status' => 403, 'message' => "Tu rol no tiene permiso para {$text} en esta sucursal.", 'row' => []];
    }

    // Filtro «Estado» de las dos listas: 1 activos, 0 inactivos, null todos.
    private function statusFilter() {
        $status = $this->post('status', '1');

        return $status === 'all' ? null : ($status === '0' ? 0 : 1);
    }

    // Filtro «Tipo» de la lista de tarjetas: un id o null (todos).
    private function typeFilter() {
        $type = $this->post('type', 'all');

        return ctype_digit($type) && (int) $type > 0 ? (int) $type : null;
    }

    // Opciones del filtro «Tipo»: todos los tipos de la empresa, los inactivos marcados. option_select pinta valor como HTML.
    private function typeFilterOptions($types) {
        return array_map(fn ($t) => [
            'id'    => (int) $t['id'],
            'valor' => h($t['name']) . ((int) $t['active'] === 1 ? '' : ' (inactivo)')
        ], $types);
    }

    // [desde, hasta) del mes de hoy, para comparar con created_at.
    private function monthRange() {
        return [date('Y-m-01 00:00:00'), date('Y-m-01 00:00:00', strtotime('first day of next month'))];
    }

    // «noviembre de 2026»
    private function monthLabel() {
        $months = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

        return $months[(int) date('n') - 1] . ' de ' . date('Y');
    }

    // «1 venta» o «3 ventas».
    private function countText($count, $one, $many) {
        return $count . ' ' . ($count === 1 ? $one : $many);
    }

    // [respuesta de error | null, numero, titular, tipo, cliente] ya limpios.
    private function cardFields() {
        $number     = strtoupper((string) preg_replace('/\s+/u', '', $this->post('number')));
        $holder     = trim((string) preg_replace('/\s+/u', ' ', $this->post('holder')));
        $typeId     = $this->postId('card_type_id');
        $customerId = $this->selectOrNull('customer_id');
        $max        = self::MAX_NUMBER;

        if ($number === '') return [$this->fail(422, 'Escribe o lee el número de la tarjeta.'), '', null, 0, null];

        if (!preg_match('/^[A-Z0-9-]{3,' . $max . '}$/', $number)) {
            return [$this->fail(422, "El número lleva de 3 a {$max} letras, números o guiones (sin acentos ni otros signos)."), '', null, 0, null];
        }

        if ($this->tooLong($holder, self::MAX_HOLDER)) return [$this->fail(422, 'El titular admite hasta ' . self::MAX_HOLDER . ' caracteres.'), '', null, 0, null];
        if ($typeId <= 0)                              return [$this->fail(422, 'Elige el tipo de tarjeta.'), '', null, 0, null];

        return [null, $number, $holder === '' ? null : $holder, $typeId, $customerId];
    }

    /*  El tipo y el cliente tienen que ser de la empresa y estar activos.
        Los que la tarjeta ya traia se respetan aunque hoy esten inactivos. */
    private function linksFail($typeId, $customerId, $card) {
        $branchId = (int) $this->branchId();
        $type     = $this->qCardType($typeId, $branchId);
        $sameType = $card && (int) $card['card_type_id'] === (int) $typeId;

        if (!$type) return $this->fail(404, 'Ese tipo de tarjeta no es de esta empresa o ya no existe.');

        if ((int) $type['active'] !== 1 && !$sameType) {
            return $this->fail(409, "El tipo {$type['name']} está inactivo. Actívalo o elige otro.");
        }

        if ($customerId === null) return null;

        $customer = $this->qGetCustomer($customerId);
        $same     = $card && (int) $card['customer_id'] === (int) $customerId;

        if (!$customer) return $this->fail(404, 'Ese cliente ya no existe.');

        if ($same) return null;

        if ((int) $customer['company_id'] !== (int) $this->companyId()) return $this->fail(404, 'Ese cliente no es de esta empresa.');
        if ((int) $customer['active'] !== 1)                            return $this->fail(409, 'Ese cliente está inactivo. Reactívalo en Clientes o elige otro.');

        return null;
    }

    /*  [respuesta de error | null, nombre, descuento, puntos, color, sellos, nivel] ya limpios.
        Un solo beneficio: descuento, puntos o sellos; los otros en 0.
        sellos = [$ por sello, meta, premio, valor del premio, icono]; sin sellos, los 5 en NULL.
        Color vacio = NULL (celeste por defecto). nivel = gasto minimo en 12 meses;
        vacio = NULL (no es nivel). Un tipo de sellos no puede ser nivel. */
    private function typeFields() {
        $name     = trim((string) preg_replace('/\s+/u', ' ', $this->post('name')));
        $discount = $this->percentOf($this->post('discount_percent'));
        $points   = $this->percentOf($this->post('points_percent'));
        $goal     = $this->post('stamp_goal') === '' ? 0 : $this->intOf($this->post('stamp_goal'));
        $color    = strtoupper(trim((string) $this->post('color')));
        $levelRaw = $this->post('level_min_spend');
        $level    = $levelRaw === '' ? null : $this->amountOf($levelRaw, 0, 2);
        $none     = [null, null, null, null, null];
        $bad      = function ($text) use ($none) { return [$this->fail(422, $text), '', 0, 0, null, $none, null]; };

        if ($levelRaw !== '' && ($level === null || $level > self::MAX_LEVEL)) return $bad('El gasto mínimo del nivel va de $0 a ' . money(self::MAX_LEVEL) . ', con hasta 2 decimales.');
        if ($level !== null && $goal > 0)                                    return $bad('Una tarjeta de sellos no puede ser nivel: al cambiar de nivel sus sellos se quedarían sin premio.');

        if ($name === '')                           return $bad('Escribe el nombre del tipo de tarjeta.');
        if ($this->tooLong($name, self::MAX_NAME))  return $bad('El nombre admite hasta ' . self::MAX_NAME . ' caracteres.');
        if ($discount === null)                     return $bad('El descuento va de 0 a 100, con hasta 2 decimales.');
        if ($points === null)                       return $bad('Los puntos van de 0 a 100, con hasta 2 decimales.');
        if ($goal === null || $goal < 0)            return $bad('Los sellos para el premio van en número entero.');

        $stamps = $none;

        if ($goal > 0) {
            $amount = $this->amountOf($this->post('stamp_amount'), 0, 2);
            $reward = trim((string) preg_replace('/\s+/u', ' ', $this->post('reward_name')));
            $value  = $this->amountOf($this->post('reward_value'), 0, 2);
            $icon   = strtolower(trim((string) $this->post('stamp_icon')));
            $max    = self::MAX_MONEY;

            if ($discount > 0 || $points > 0)                     return $bad('Una tarjeta da descuento, puntos o sellos: uno solo.');
            if ($goal < self::MIN_GOAL || $goal > self::MAX_GOAL) return $bad('Los sellos para el premio van de ' . self::MIN_GOAL . ' a ' . self::MAX_GOAL . '.');
            if ($amount === null || $amount <= 0 || $amount > $max) return $bad('Pon cuántos pesos dan un sello: más de $0.');
            if ($reward === '')                                   return $bad('Escribe el premio, por ejemplo «Café gratis».');
            if ($this->tooLong($reward, self::MAX_NAME))          return $bad('El premio admite hasta ' . self::MAX_NAME . ' caracteres.');
            if ($value === null || $value <= 0 || $value > $max)  return $bad('Pon el valor del premio (lo más que descuenta): más de $0.');

            // El icono es un nombre de Lucide («coffee», «cake-slice»). Vacío = círculo liso.
            if ($icon !== '' && !preg_match('/^[a-z0-9]+(-[a-z0-9]+)*$/', $icon)) return $bad('Ese icono no es válido: elígelo de la lista.');
            if (strlen($icon) > 40)                                             return $bad('Ese icono no es válido: elígelo de la lista.');

            $stamps = [$amount, $goal, $reward, $value, $icon === '' ? null : $icon];
        } else {
            if ($discount > 0 && $points > 0)   return $bad('Una tarjeta da descuento o da puntos, no los dos. Elige uno.');
            if ($discount <= 0 && $points <= 0) return $bad('Pon un porcentaje mayor a 0: si no, la tarjeta no hace nada.');
        }

        if ($color !== '' && !preg_match('/^#[0-9A-F]{6}$/', $color)) {
            return $bad('El color va como # y 6 letras o números, por ejemplo ' . self::CARD_COLOR . '.');
        }

        return [null, $name, $discount, $points, $color === '' ? null : $color, $stamps, $level];
    }

    // Un porcentaje de 0 a 100. Vacio = 0; invalido = null.
    private function percentOf($raw) {
        $value = $this->amountOf($raw, 0, 2);

        return $value === null || $value > 100 ? null : $value;
    }

    private function takenText($taken) {
        return "Ya hay una tarjeta con el número {$taken['number']} en esta empresa.";
    }

    // -- Tarjeta digital por WhatsApp (el envío y el enlace viven en LoyaltyWhatsApp) --

    // Al dar de alta: al teléfono del cliente dueño. Nunca truena: la tarjeta ya está guardada.
    private function cardWaAfterAdd($id) {
        try {
            $card  = $this->qCard($id, $this->branchId());
            $phone = $card && $card['owner_id'] !== null ? $this->loyaltyPhone($card['customer_phone']) : '';

            if (!$card || $card['owner_id'] === null) return ['status' => 'skip', 'detail' => 'La tarjeta no tiene cliente: no hay a quién mandarla.'];
            if ($phone === '')                        return ['status' => 'skip', 'detail' => 'El cliente no tiene un WhatsApp de 10 dígitos.'];

            return $this->loyaltySendCard($card, $phone);
        } catch (Throwable $e) {
            $this->writeToLog('[ TARJETA WHATSAPP ] :: ' . $e->getMessage());

            return ['status' => 'failed', 'detail' => 'No se pudo mandar.'];
        }
    }

    // El aviso de cómo salió, para la pantalla.
    private function cardWaText($sent) {
        if ($sent['status'] === 'simulated') return 'Mensaje simulado: sin token de Meta no sale a la red. Quedó en Ventas › WhatsApp.';
        if ($sent['status'] === 'sent')      return 'Tarjeta mandada por WhatsApp.';

        return (string) $sent['detail'];
    }

    /*  Lo que necesita la ventana «Tarjeta digital». name: el cliente dueño o, sin
        él, el titular. phone: 10 dígitos del dueño o ''. usable = el enlace abre. */
    private function linkReply($c, $token, $message) {
        $owner = $c['owner_id'] !== null;
        $name  = trim((string) $c['customer']);
        $phone = $owner ? substr((string) preg_replace('/\D/', '', (string) $c['customer_phone']), -10) : '';

        return $this->ok($message, [
            'id'        => (int) $c['id'],
            'link'      => $this->loyaltyHostLink($token),
            'number'    => (string) $c['number'],
            'type'      => (string) $c['type'],
            'name'      => $owner && $name !== '' ? $name : trim((string) $c['holder']),
            'phone'     => strlen($phone) === 10 ? $phone : '',
            'usable'    => (int) $c['active'] === 1 && (int) $c['type_active'] === 1,
            'can_renew' => Permission::can(self::POINTS, 'update')
        ]);
    }

    private function cardFormRow($c) {
        return [
            'id'           => (int) $c['id'],
            'number'       => (string) $c['number'],
            'holder'       => (string) $c['holder'],
            'card_type_id' => (int) $c['card_type_id'],
            'customer_id'  => $c['customer_id'] !== null ? (int) $c['customer_id'] : '',
            'active'       => (int) $c['active']
        ];
    }

    private function typeFormRow($t) {
        return [
            'id'               => (int) $t['id'],
            'name'             => (string) $t['name'],
            'discount_percent' => round((float) $t['discount_percent'], 2),
            'points_percent'   => round((float) $t['points_percent'], 2),
            'stamp_amount'     => round((float) $t['stamp_amount'], 2),
            'stamp_goal'       => (int) $t['stamp_goal'],
            'reward_name'      => (string) $t['reward_name'],
            'reward_value'     => round((float) $t['reward_value'], 2),
            'stamp_icon'       => (string) $t['stamp_icon'],
            'level_min_spend'  => $t['level_min_spend'] !== null ? round((float) $t['level_min_spend'], 2) : null,
            'color'            => $this->colorOf($t['color']),
            'active'           => (int) $t['active']
        ];
    }

    // Lo que el dibujo necesita de los sellos de un tipo (o de una tarjeta, que trae las mismas columnas).
    private function stampFace($t) {
        return [
            'goal'        => (int) $t['stamp_goal'],
            'stampAmount' => round((float) $t['stamp_amount'], 2),
            'reward'      => (string) $t['reward_name'],
            'rewardValue' => round((float) $t['reward_value'], 2),
            'icon'        => (string) $t['stamp_icon']
        ];
    }

    // El color guardado si es un #RRGGBB; si no (NULL o algo raro), el celeste por defecto.
    private function colorOf($raw) {
        $color = strtoupper(trim((string) $raw));

        return preg_match('/^#[0-9A-F]{6}$/', $color) ? $color : self::CARD_COLOR;
    }

    /*  Tipos activos para el formulario; $keepId conserva el que la tarjeta ya traia.
        name, discount, points y color son para la vista previa de la tarjeta: el select solo usa id y valor. */
    private function typeOptions($keepId) {
        $options = [];

        foreach ($this->qCardTypes($this->branchId()) as $type) {
            $active = (int) $type['active'] === 1;

            if (!$active && (int) $type['id'] !== $keepId) continue;

            $options[] = $this->stampFace($type) + [
                'id'       => (int) $type['id'],
                'valor'    => $type['name'] . ' · ' . $this->typeText($type) . ($active ? '' : ' (inactivo)'),
                'name'     => (string) $type['name'],
                'discount' => round((float) $type['discount_percent'], 2),
                'points'   => round((float) $type['points_percent'], 2),
                'color'    => $this->colorOf($type['color'])
            ];
        }

        return $options;
    }

    // name va aparte para la vista previa de la tarjeta (valor trae tambien el telefono); wa: su WhatsApp de 10 dígitos o ''.
    private function customerOptions($keepId) {
        $options = [];

        foreach ($this->qCustomerOptions($this->branchId(), $keepId) as $customer) {
            $name  = trim((string) $customer['name']) !== '' ? trim($customer['name']) : 'Sin nombre';
            $phone = trim((string) $customer['phone']);

            $options[] = ['id' => (int) $customer['id'], 'valor' => $phone !== '' ? "{$name} · {$phone}" : $name, 'name' => $name, 'wa' => $this->loyaltyPhone($phone)];
        }

        return $options;
    }

    // «10 % descuento», «5 % puntos» o «1 sello c/$100 · 10 = Café gratis». Un tipo de antes de la regla puede traer descuento y puntos.
    private function typeText($t) {
        if ((int) $t['stamp_goal'] > 0) {
            return '1 sello c/' . $this->moneyShort($t['stamp_amount']) . ' · ' . (int) $t['stamp_goal'] . ' = ' . trim((string) $t['reward_name']);
        }

        $parts = [];

        if ((float) $t['discount_percent'] > 0) $parts[] = $this->percentText($t['discount_percent']) . ' descuento';
        if ((float) $t['points_percent'] > 0)   $parts[] = $this->percentText($t['points_percent']) . ' puntos';

        return $parts ? implode(' · ', $parts) : 'sin beneficio';
    }

    // 10 → «10 %»; 7.5 → «7.5 %».
    private function percentText($value) {
        return rtrim(rtrim(number_format((float) $value, 2, '.', ''), '0'), '.') . ' %';
    }

    // «7 de 10 sellos»; con la meta cumplida (premio sin canjear), «12 juntados · premio listo».
    private function stampsText($have, $goal) {
        return $have >= $goal ? "{$have} juntados · premio listo" : "{$have} de {$goal} sellos";
    }

    // 100 → «$100»; 1500.5 → «$1,500.50». Sin centavos si son cero.
    private function moneyShort($value) {
        $value = round((float) $value, 2);

        return '$' . number_format($value, floor($value) == $value ? 0 : 2);
    }

    // -- Celdas --

    private function cellZero() {
        return '<span class="text-gray-400">-</span>';
    }

    // Lo que da el tipo, en una sola columna. $t trae discount_percent y points_percent (un tipo o una tarjeta).
    // Con sellos (las filas de qCards traen stamps): debajo, cuántos lleva.
    private function cellBenefit($t) {
        if (round((float) $t['discount_percent'], 2) <= 0 && round((float) $t['points_percent'], 2) <= 0 && (int) $t['stamp_goal'] <= 0) return $this->cellZero();

        $html = '<span class="font-semibold text-gray-800 whitespace-nowrap">' . h($this->typeText($t)) . '</span>';

        if ((int) $t['stamp_goal'] > 0 && isset($t['stamps'])) {
            $html .= '<div class="ord-sub whitespace-nowrap">' . $this->stampsText(max((int) $t['stamps'], 0), (int) $t['stamp_goal']) . '</div>';
        }

        return $html;
    }

    // El nombre del tipo con la muestra de su color.
    private function typeName($name, $color) {
        return '<span class="loy-type">'
             .   '<span class="loy-dot" style="background-color:' . $this->colorOf($color) . '"></span>'
             .   '<span class="font-semibold text-gray-800">' . h($name) . '</span>'
             . '</span>';
    }

    private function cellCard($number, $holder) {
        $html = '<div class="loy-number">' . h($number) . '</div>';

        if (trim((string) $holder) !== '') $html .= '<div class="ord-sub">' . h($holder) . '</div>';

        return $html;
    }

    private function cellType($name, $active, $color) {
        if (trim((string) $name) === '') return '<span class="ord-pill bg-amber-50 text-amber-700">Sin tipo</span>';

        $html = $this->typeName($name, $color);

        if (!$active) $html .= '<div class="ord-sub text-amber-600">Tipo inactivo: no se lee en Vender</div>';

        return $html;
    }

    // El dueño de la tarjeta. Sin dueño, los puntos van a quien compre con ella.
    private function cellOwner($c) {
        if ($c['customer_id'] === null) return $this->ownerBox('<span class="text-gray-400">Sin cliente</span>', false);

        $name = trim((string) $c['customer']) !== '' ? $c['customer'] : 'Sin nombre';
        $html = '<div class="font-semibold text-gray-800"><span class="ord-cliente">' . h($name) . '</span></div>';

        if ($c['owner_id'] === null) return $this->ownerBox($html . '<div class="ord-sub text-amber-600">Inactivo o de otra empresa</div>', true);

        if (trim((string) $c['customer_phone']) !== '') $html .= '<div class="ord-sub">' . h($c['customer_phone']) . '</div>';

        return $this->ownerBox($html, true);
    }

    // Círculo con el ícono de usuario a la izquierda del texto; apagado si la tarjeta no tiene cliente.
    private function ownerBox($html, $filled) {
        $avatar = '<span class="loy-avatar' . ($filled ? '' : ' is-empty') . '"><i data-lucide="user-round" class="w-4 h-4"></i></span>';

        return '<div class="loy-owner">' . $avatar . '<div class="min-w-0">' . $html . '</div></div>';
    }

    private function activePill($active, $on, $off) {
        return $active
             ? '<span class="ord-pill bg-emerald-50 text-emerald-700">' . $on . '</span>'
             : '<span class="ord-pill bg-slate-100 text-slate-600">' . $off . '</span>';
    }

    // Cuantas compras lleva y, debajo, la ultima.
    private function cellSales($sales, $last) {
        if ($sales <= 0) return $this->cellZero();

        return '<span class="font-semibold text-gray-800">' . $sales . '</span>'
             . '<div class="ord-sub whitespace-nowrap">Última: ' . shortDate($last) . '</div>';
    }

    // El monedero de hoy del cliente. Guion si la tarjeta no tiene cliente o su cliente ya no cuenta.
    private function cellWallet($c) {
        if ($c['owner_id'] === null) return $this->cellZero();

        $wallet = round((float) $c['wallet'], 2);

        return '<span class="loy-wallet' . ($wallet > 0 ? ' is-on' : '') . '">' . money($wallet) . '</span>';
    }

    // -- Ficha --

    // La tarjeta para la ficha: lo que se dibuja, su cliente y una nota si algo impide usarla.
    private function detailCard($c, $type) {
        $owner = $c['owner_id'] !== null;
        $name  = trim((string) $c['customer']) !== '' ? trim($c['customer']) : 'Sin nombre';

        return $this->stampFace($c) + [
            'id'       => (int) $c['id'],
            'number'   => (string) $c['number'],
            'holder'   => (string) $c['holder'],
            'type'     => (string) $c['type'],
            'benefit'  => $this->typeText($c),
            'color'    => $this->colorOf($type ? $type['color'] : ''),
            'discount' => round((float) $c['discount_percent'], 2),
            'points'   => round((float) $c['points_percent'], 2),
            'active'   => (int) $c['active'] === 1,
            'owner'    => $owner,
            'customer' => $c['customer_id'] === null ? 'Sin cliente' : $name,
            'phone'    => $owner ? (string) $c['customer_phone'] : '',
            'note'     => $this->detailNote($c)
        ];
    }

    // Lo que impide usarla o lo que hay que saber de su cliente. Vacio = nada que avisar.
    private function detailNote($c) {
        if ((int) $c['active'] !== 1)      return 'Tarjeta inactiva: no se lee en Vender.';
        if ((int) $c['type_active'] !== 1) return 'Su tipo está inactivo: no se lee en Vender.';
        if ($c['customer_id'] === null)    return 'Sin cliente: vale para quien la presente.';
        if ($c['owner_id'] === null)       return 'Su cliente está inactivo o es de otra empresa.';

        return '';
    }

    /*  Las cifras de la ficha. tone es la clase extra de la caja (cus-tile): is-wallet = verde.
        $stamps (tarjeta de sellos): have, goal, earned, rewards, saved. El premio ya
        sale en «Premios canjeados»: no se repite como descuento. */
    private function detailTotals($t, $wallet, $stamps = null) {
        $tiles = [
            ['label' => 'Compras',        'value' => (string) (int) $t['sales'], 'tone' => ''],
            ['label' => 'Total comprado', 'value' => money($t['sold']),          'tone' => '']
        ];

        if ($stamps) {
            $ready   = $stamps['have'] >= $stamps['goal'];
            $tiles[] = ['label' => 'Sellos hoy', 'value' => $this->stampsText($stamps['have'], $stamps['goal']), 'tone' => $ready ? 'is-wallet' : ''];
            $tiles[] = ['label' => 'Premios canjeados', 'value' => (int) $stamps['rewards'] . ((float) $stamps['saved'] > 0 ? ' · ' . money($stamps['saved']) : ''), 'tone' => ''];
        }

        if ((float) $t['discount'] > 0 && !$stamps) $tiles[] = ['label' => 'Descuento recibido', 'value' => money($t['discount']), 'tone' => ''];
        if ((float) $t['points'] > 0)   $tiles[] = ['label' => 'Puntos ganados',     'value' => money($t['points']),   'tone' => 'is-wallet'];
        if ($wallet !== null)           $tiles[] = ['label' => 'Monedero hoy',       'value' => money($wallet),        'tone' => $wallet > 0 ? 'is-wallet' : ''];

        $tiles[] = ['label' => 'Última compra', 'value' => $t['last_sale'] ? dmy($t['last_sale']) : 'Ninguna', 'tone' => ''];

        return $tiles;
    }

    // Una compra de la ficha. Las claves son los encabezados.
    private function moveRow($m) {
        return [
            'id'        => (int) $m['id'],
            'Fecha'     => shortDate($m['created_at']) . '<div class="ord-sub">' . date('g:i A', strtotime($m['created_at'])) . '</div>',
            'Folio'     => 'V' . h($m['folio'] !== '' ? $m['folio'] : $m['id']),
            'Sucursal'  => h($m['branch']),
            'Total'     => money($m['total']),
            'Beneficio' => $this->cellMove($m)
        ];
    }

    // Lo que dio la tarjeta en esa compra: descuento o premio, puntos y sellos (uno por renglón).
    private function cellMove($m) {
        $parts  = [];
        $stamps = (int) $m['stamps'];

        if ((float) $m['reward'] > 0)       $parts[] = '<span class="loy-move is-discount">Premio −' . money($m['reward']) . '</span>';
        elseif ((float) $m['discount'] > 0) $parts[] = '<span class="loy-move is-discount">-' . money($m['discount']) . ' descuento</span>';

        if ((float) $m['points'] > 0) $parts[] = '<span class="loy-move is-points">+' . money($m['points']) . ' puntos</span>';
        if ($stamps > 0)              $parts[] = '<span class="loy-move is-points">+' . $stamps . ($stamps === 1 ? ' sello' : ' sellos') . '</span>';

        return $parts ? implode('<br>', $parts) : $this->cellZero();
    }

    // -- Acciones de la fila --

    private function actionBtnClass($variant, $last = false) {
        $base = 'inline-flex items-center px-2 py-1 text-sm rounded-md border transition ';
        $tone = $variant === 'danger'
              ? 'border-red-200 text-red-500 hover:bg-red-50 hover:text-red-600'
              : 'border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900';

        return $base . $tone . ($last ? '' : ' me-1');
    }

    /*  Ver la ficha y la tarjeta digital siempre; editar y activar/desactivar solo con 'update'.
        aria-label y no title: en este framework title dispara un popover. */
    private function cardActions($id, $active, $canEdit) {
        $actions = [[
            'class'      => $this->actionBtnClass('neutral'),
            'html'       => '<i data-lucide="eye" class="w-4 h-4"></i>',
            'aria-label' => 'Ver tarjeta',
            'onclick'    => "loyalty.viewCard({$id})"
        ], [
            'class'      => $this->actionBtnClass('neutral', !$canEdit),
            'html'       => '<i data-lucide="qr-code" class="w-4 h-4"></i>',
            'aria-label' => 'Tarjeta digital',
            'onclick'    => "loyalty.shareCard({$id})"
        ]];

        if (!$canEdit) return $actions;

        $actions[] = [
            'class'      => $this->actionBtnClass('neutral'),
            'html'       => '<i data-lucide="pencil" class="w-4 h-4"></i>',
            'aria-label' => 'Editar',
            'onclick'    => "loyalty.editCard({$id})"
        ];

        $actions[] = [
            'class'      => $this->actionBtnClass($active ? 'danger' : 'neutral', true),
            'html'       => '<i data-lucide="' . ($active ? 'toggle-right' : 'toggle-left') . '" class="w-4 h-4"></i>',
            'aria-label' => $active ? 'Desactivar' : 'Activar',
            'onclick'    => "loyalty.statusCard({$id}, " . ($active ? 0 : 1) . ')'
        ];

        return $actions;
    }
}

// ctrl-programa.php carga esta clase sin despachar: despacha la suya.
if (!defined('LOYALTY_CTRL_LIB')) Permission::dispatch(new ctrl(), ctrl::POINTS);
