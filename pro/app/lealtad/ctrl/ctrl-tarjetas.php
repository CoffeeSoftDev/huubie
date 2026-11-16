<?php
require_once __DIR__ . '/../../../core/security/_Session.php';
if (empty($_POST['opc'])) exit(0);

// La base (empresa, sucursal, respuestas) y el modelo son los de Pedidos: Vender e Historial usan el mismo trait.
require_once __DIR__ . '/../../order/ctrl/core-order.php';
require_once __DIR__ . '/../../order/mdl/mdl-lealtad.php';

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
      - El tipo da UN beneficio: descuento o puntos, nunca los dos (typeFields
        lo rechaza). Un tipo guardado antes de esta regla puede traer los dos:
        se sigue leyendo, y al editarlo hay que dejarle uno.
      - El tipo guarda el color con que se dibuja la tarjeta (card_type.color,
        #RRGGBB). Sin color va en celeste claro (CARD_COLOR).
      - La tarjeta no guarda saldo: los puntos caen en el monedero del cliente
        (customer.wallet).
      - Leer la tarjeta al vender NO pasa por aqui: lo hace ctrl-ventas con el
        permiso de vender. Esta pagina es solo para administrarlas.
      - La BD no tiene bitacora de tarjetas: una edicion no deja rastro. */
class ctrl extends core {

    use LoyaltyCards;

    const POINTS     = 'pos-puntos';
    const MAX_NUMBER = 40;
    const MAX_HOLDER = 150;
    const MAX_NAME   = 80;
    const CARD_COLOR = '#BAE6FD';

    // -- Arranque --

    // Sin turno, dia ni permisos de Pedidos: esta pagina no carga el detalle, el turno ni el cobro.
    public function init() {
        $scope = $this->scope();

        return [
            'status'    => 200,
            'scope'     => ['company' => $scope['company'], 'branch' => $scope['branch']],
            'points'    => Permission::actions(self::POINTS),
            'cardColor' => self::CARD_COLOR
        ];
    }

    // -- Tarjetas: lista --

    public function lsCards() {
        $fail = $this->needPoints('show') ?: $this->needBranch();
        if ($fail) return $fail;

        $active = $this->statusFilter();

        return $this->attempt(function () use ($active) {
            $canEdit = Permission::can(self::POINTS, 'update');
            $rows    = [];

            foreach ($this->qCards($this->branchId(), $active) as $card) {
                $rows[] = $this->cardRow($card, $canEdit);
            }

            return [
                'status' => 200,
                'row'    => $rows,
                'count'  => count($rows),
                'types'  => count($this->qCardTypes($this->branchId(), 1)),
                'branch' => $this->scope()['branch']
            ];
        }, 'No se pudo cargar la lista de tarjetas.');
    }

    // Una fila de la tabla. Las claves son los encabezados.
    private function cardRow($c, $canEdit) {
        $id     = (int) $c['id'];
        $active = (int) $c['active'] === 1;
        $sales  = (int) $c['sales'];

        return [
            'id'        => $id,
            'Cliente'   => $this->cellOwner($c),
            'Tarjeta'   => $this->cellCard($c['number'], $c['holder']),
            'Tipo'      => $this->cellType($c['type'], (int) $c['type_active'] === 1, $c['type_color']),
            'Beneficio' => $this->cellBenefit($c),
            'Ventas'    => $sales > 0 ? '<span class="font-semibold text-gray-800">' . $sales . '</span>' : $this->cellZero(),
            'Estado'    => $this->activePill($active, 'Activa', 'Inactiva'),
            'a'         => $canEdit ? $this->rowActions('Card', $id, $active) : []
        ];
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

        return $this->attempt(function () use ($number, $holder, $typeId, $customerId) {
            return $this->transaction(function () use ($number, $holder, $typeId, $customerId) {
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

    // -- Tipos: lista --

    public function lsCardTypes() {
        $fail = $this->needPoints('show') ?: $this->needBranch();
        if ($fail) return $fail;

        $active = $this->statusFilter();

        return $this->attempt(function () use ($active) {
            $canEdit = Permission::can(self::POINTS, 'update');
            $rows    = [];

            foreach ($this->qCardTypes($this->branchId(), $active) as $type) {
                $rows[] = $this->typeRow($type, $canEdit);
            }

            return [
                'status' => 200,
                'row'    => $rows,
                'count'  => count($rows),
                'branch' => $this->scope()['branch']
            ];
        }, 'No se pudo cargar la lista de tipos de tarjeta.');
    }

    private function typeRow($t, $canEdit) {
        $id     = (int) $t['id'];
        $active = (int) $t['active'] === 1;
        $cards  = (int) $t['cards'];

        return [
            'id'        => $id,
            'Tipo'      => $this->typeName($t['name'], $t['color']),
            'Beneficio' => $this->cellBenefit($t),
            'Tarjetas'  => $cards > 0 ? '<span class="font-semibold text-gray-800">' . $cards . '</span>' : $this->cellZero(),
            'Estado'    => $this->activePill($active, 'Activo', 'Inactivo'),
            'a'         => $canEdit ? $this->rowActions('Type', $id, $active) : []
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

        list($fail, $name, $discount, $points, $color) = $this->typeFields();
        if ($fail) return $fail;

        return $this->attempt(function () use ($name, $discount, $points, $color) {
            return $this->transaction(function () use ($name, $discount, $points, $color) {
                $taken = $this->qCardTypeNameTaken($this->branchId(), $name, 0);

                if ($taken) return $this->fail(409, "Ya hay un tipo de tarjeta llamado {$taken['name']} en esta empresa.");

                $this->must($this->qCreateCardType([
                    'values' => ['name', 'discount_percent', 'points_percent', 'color', 'branch_id', 'active'],
                    'data'   => [$name, $discount, $points, $color, $this->branchId(), 1]
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

        list($fail, $name, $discount, $points, $color) = $this->typeFields();
        if ($fail) return $fail;

        $id = $this->postId();

        return $this->attempt(function () use ($id, $name, $discount, $points, $color) {
            return $this->transaction(function () use ($id, $name, $discount, $points, $color) {
                $type = $this->qCardType($id, $this->branchId());

                if (!$type) return $this->fail(404, 'Ese tipo de tarjeta no es de esta empresa o ya no existe.');

                $taken = $this->qCardTypeNameTaken($this->branchId(), $name, $id);

                if ($taken) return $this->fail(409, "Ya hay un tipo de tarjeta llamado {$taken['name']} en esta empresa.");

                $this->must($this->qUpdateCardType([
                    'values' => ['name', 'discount_percent', 'points_percent', 'color', 'updated_at = NOW()'],
                    'where'  => ['id'],
                    'data'   => [$name, $discount, $points, $color, $id]
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

    /*  [respuesta de error | null, nombre, descuento, puntos, color] ya limpios.
        Un solo beneficio: llega descuento o llegan puntos, el otro en 0.
        Color vacio = NULL (celeste por defecto). */
    private function typeFields() {
        $name     = trim((string) preg_replace('/\s+/u', ' ', $this->post('name')));
        $discount = $this->percentOf($this->post('discount_percent'));
        $points   = $this->percentOf($this->post('points_percent'));
        $color    = strtoupper(trim((string) $this->post('color')));
        $bad      = function ($text) { return [$this->fail(422, $text), '', 0, 0, null]; };

        if ($name === '')                           return $bad('Escribe el nombre del tipo de tarjeta.');
        if ($this->tooLong($name, self::MAX_NAME))  return $bad('El nombre admite hasta ' . self::MAX_NAME . ' caracteres.');
        if ($discount === null)                     return $bad('El descuento va de 0 a 100, con hasta 2 decimales.');
        if ($points === null)                       return $bad('Los puntos van de 0 a 100, con hasta 2 decimales.');
        if ($discount > 0 && $points > 0)           return $bad('Una tarjeta da descuento o da puntos, no los dos. Elige uno.');
        if ($discount <= 0 && $points <= 0)         return $bad('Pon un porcentaje mayor a 0: si no, la tarjeta no hace nada.');

        if ($color !== '' && !preg_match('/^#[0-9A-F]{6}$/', $color)) {
            return $bad('El color va como # y 6 letras o números, por ejemplo ' . self::CARD_COLOR . '.');
        }

        return [null, $name, $discount, $points, $color === '' ? null : $color];
    }

    // Un porcentaje de 0 a 100. Vacio = 0; invalido = null.
    private function percentOf($raw) {
        $value = $this->amountOf($raw, 0, 2);

        return $value === null || $value > 100 ? null : $value;
    }

    private function takenText($taken) {
        return "Ya hay una tarjeta con el número {$taken['number']} en esta empresa.";
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
            'color'            => $this->colorOf($t['color']),
            'active'           => (int) $t['active']
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

            $options[] = [
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

    // name va aparte para la vista previa de la tarjeta (valor trae tambien el telefono).
    private function customerOptions($keepId) {
        $options = [];

        foreach ($this->qCustomerOptions($this->branchId(), $keepId) as $customer) {
            $name  = trim((string) $customer['name']) !== '' ? trim($customer['name']) : 'Sin nombre';
            $phone = trim((string) $customer['phone']);

            $options[] = ['id' => (int) $customer['id'], 'valor' => $phone !== '' ? "{$name} · {$phone}" : $name, 'name' => $name];
        }

        return $options;
    }

    // «10 % descuento» o «5 % puntos». Un tipo de antes de la regla puede traer los dos.
    private function typeText($t) {
        $parts = [];

        if ((float) $t['discount_percent'] > 0) $parts[] = $this->percentText($t['discount_percent']) . ' descuento';
        if ((float) $t['points_percent'] > 0)   $parts[] = $this->percentText($t['points_percent']) . ' puntos';

        return $parts ? implode(' · ', $parts) : 'sin beneficio';
    }

    // 10 → «10 %»; 7.5 → «7.5 %».
    private function percentText($value) {
        return rtrim(rtrim(number_format((float) $value, 2, '.', ''), '0'), '.') . ' %';
    }

    // -- Celdas --

    private function cellZero() {
        return '<span class="text-gray-400">-</span>';
    }

    // Lo que da el tipo, en una sola columna. $t trae discount_percent y points_percent (un tipo o una tarjeta).
    private function cellBenefit($t) {
        if (round((float) $t['discount_percent'], 2) <= 0 && round((float) $t['points_percent'], 2) <= 0) return $this->cellZero();

        return '<span class="font-semibold text-gray-800 whitespace-nowrap">' . $this->typeText($t) . '</span>';
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

    // -- Acciones de la fila --

    private function actionBtnClass($variant, $last = false) {
        $base = 'inline-flex items-center px-2 py-1 text-sm rounded-md border transition ';
        $tone = $variant === 'danger'
              ? 'border-red-200 text-red-500 hover:bg-red-50 hover:text-red-600'
              : 'border-gray-200 text-gray-600 hover:bg-gray-50 hover:text-gray-900';

        return $base . $tone . ($last ? '' : ' me-1');
    }

    // $kind: 'Card' o 'Type'. aria-label y no title: en este framework title dispara un popover.
    private function rowActions($kind, $id, $active) {
        return [
            [
                'class'      => $this->actionBtnClass('neutral'),
                'html'       => '<i data-lucide="pencil" class="w-4 h-4"></i>',
                'aria-label' => 'Editar',
                'onclick'    => "loyalty.edit{$kind}({$id})"
            ],
            [
                'class'      => $this->actionBtnClass($active ? 'danger' : 'neutral', true),
                'html'       => '<i data-lucide="' . ($active ? 'toggle-right' : 'toggle-left') . '" class="w-4 h-4"></i>',
                'aria-label' => $active ? 'Desactivar' : 'Activar',
                'onclick'    => "loyalty.status{$kind}({$id}, " . ($active ? 0 : 1) . ')'
            ]
        ];
    }
}

Permission::dispatch(new ctrl(), ctrl::POINTS);
