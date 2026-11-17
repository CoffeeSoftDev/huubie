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
require_once __DIR__ . '/../../order/mdl/mdl-lealtad-whatsapp.php';

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
        horario del agente: lo dispara una persona en el mostrador. */
class ctrl extends core {

    use LoyaltyCards, WhatsAppInbox, WhatsAppAgentFlow, WhatsAppReminders, LoyaltyWhatsApp;

    const POINTS     = 'pos-puntos';
    const MAX_NUMBER = 40;
    const MAX_HOLDER = 150;
    const MAX_NAME   = 80;
    const CARD_COLOR = '#BAE6FD';
    const MOVES      = 10;
    const MIN_GOAL   = 2;        // sellos para el premio
    const MAX_GOAL   = 20;
    const MAX_MONEY  = 100000;   // $ por sello y valor del premio

    // -- Arranque --

    // Sin turno, dia ni permisos de Pedidos: esta pagina no carga el detalle, el turno ni el cobro.
    public function init() {
        $scope = $this->scope();

        return [
            'status'    => 200,
            'scope'     => ['company' => $scope['company'], 'branch' => $scope['branch']],
            'points'    => Permission::actions(self::POINTS),
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

            $types = [];

            foreach ($this->qCardTypes($this->branchId(), $active) as $type) {
                $id      = (int) $type['id'];
                $types[] = $this->typeTile($type, isset($month[$id]) ? $month[$id] : null);
            }

            return [
                'status' => 200,
                'types'  => $types,
                'count'  => count($types),
                'branch' => $this->scope()['branch']
            ];
        }, 'No se pudo cargar la lista de tipos de tarjeta.');
    }

    // Un tipo de la galeria. $month: sus ventas del mes (null = ninguna). Todo va como texto plano.
    private function typeTile($t, $month) {
        $cards = (int) $t['cards'];
        $sales = $month ? (int) $month['sales'] : 0;

        return $this->stampFace($t) + [
            'id'        => (int) $t['id'],
            'name'      => (string) $t['name'],
            'color'     => $this->colorOf($t['color']),
            'discount'  => round((float) $t['discount_percent'], 2),
            'points'    => round((float) $t['points_percent'], 2),
            'benefit'   => $this->typeText($t),
            'active'    => (int) $t['active'] === 1,
            'cards'     => $cards,
            'cardsText' => $cards > 0 ? $this->countText($cards, 'tarjeta activa', 'tarjetas activas') : 'Sin tarjetas activas',
            'salesText' => $sales > 0 ? $this->countText($sales, 'venta', 'ventas') . ' este mes · ' . money($month['sold']) : 'Sin ventas este mes'
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

        list($fail, $name, $discount, $points, $color, $stamps) = $this->typeFields();
        if ($fail) return $fail;

        return $this->attempt(function () use ($name, $discount, $points, $color, $stamps) {
            return $this->transaction(function () use ($name, $discount, $points, $color, $stamps) {
                $taken = $this->qCardTypeNameTaken($this->branchId(), $name, 0);

                if ($taken) return $this->fail(409, "Ya hay un tipo de tarjeta llamado {$taken['name']} en esta empresa.");

                $this->must($this->qCreateCardType([
                    'values' => ['name', 'discount_percent', 'points_percent', 'stamp_amount', 'stamp_goal', 'reward_name', 'reward_value', 'stamp_icon', 'color', 'branch_id', 'active'],
                    'data'   => array_merge([$name, $discount, $points], $stamps, [$color, $this->branchId(), 1])
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

        list($fail, $name, $discount, $points, $color, $stamps) = $this->typeFields();
        if ($fail) return $fail;

        $id = $this->postId();

        return $this->attempt(function () use ($id, $name, $discount, $points, $color, $stamps) {
            return $this->transaction(function () use ($id, $name, $discount, $points, $color, $stamps) {
                $type = $this->qCardType($id, $this->branchId());

                if (!$type) return $this->fail(404, 'Ese tipo de tarjeta no es de esta empresa o ya no existe.');

                $taken = $this->qCardTypeNameTaken($this->branchId(), $name, $id);

                if ($taken) return $this->fail(409, "Ya hay un tipo de tarjeta llamado {$taken['name']} en esta empresa.");

                $this->must($this->qUpdateCardType([
                    'values' => ['name', 'discount_percent', 'points_percent', 'stamp_amount', 'stamp_goal', 'reward_name', 'reward_value', 'stamp_icon', 'color', 'updated_at = NOW()'],
                    'where'  => ['id'],
                    'data'   => array_merge([$name, $discount, $points], $stamps, [$color, $id])
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
        if (Permission::can(self::POINTS, $action)) return null;

        $what = [
            'show'   => 'ver tarjetas y puntos',
            'create' => 'agregar tarjetas ni tipos de tarjeta',
            'update' => 'editar tarjetas ni tipos de tarjeta'
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

    /*  [respuesta de error | null, nombre, descuento, puntos, color, sellos] ya limpios.
        Un solo beneficio: descuento, puntos o sellos; los otros en 0.
        sellos = [$ por sello, meta, premio, valor del premio, icono]; sin sellos, los 5 en NULL.
        Color vacio = NULL (celeste por defecto). */
    private function typeFields() {
        $name     = trim((string) preg_replace('/\s+/u', ' ', $this->post('name')));
        $discount = $this->percentOf($this->post('discount_percent'));
        $points   = $this->percentOf($this->post('points_percent'));
        $goal     = $this->post('stamp_goal') === '' ? 0 : $this->intOf($this->post('stamp_goal'));
        $color    = strtoupper(trim((string) $this->post('color')));
        $none     = [null, null, null, null, null];
        $bad      = function ($text) use ($none) { return [$this->fail(422, $text), '', 0, 0, null, $none]; };

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

        return [null, $name, $discount, $points, $color === '' ? null : $color, $stamps];
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

Permission::dispatch(new ctrl(), ctrl::POINTS);
