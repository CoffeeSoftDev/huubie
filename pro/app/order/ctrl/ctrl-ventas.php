<?php
require_once __DIR__ . '/../../../core/security/_Session.php';
if (empty($_POST['opc'])) exit(0);

require_once __DIR__ . '/core-order.php';
require_once __DIR__ . '/../mdl/mdl-credito.php';
require_once __DIR__ . '/../mdl/mdl-lealtad.php';
require_once __DIR__ . '/../mdl/mdl-ticket.php';

// Opcional: el aviso de «premio listo» por WhatsApp (Lealtad). Sin el archivo, Vender cobra igual y no avisa.
if (is_file(__DIR__ . '/../mdl/mdl-lealtad-whatsapp.php')) require_once __DIR__ . '/../mdl/mdl-lealtad-whatsapp.php';

/*  Ventas › vender en mostrador (V1 del plan de Ventas; credito y monedero de V3;
    tarjeta de lealtad y puntos de V4).

    Reglas que no se ven en el codigo de un vistazo:
      - Una venta nace pagada: sale_type_id 3 (POS) y sale_status_id 3 (Pagado).
        Venta, renglones y pagos se guardan en UNA transaccion; no pasa por Pedidos.
      - Credito: si el cobro no cubre lo que se debe y llega credit = 1, el resto
        se carga a la cuenta del cliente (receivable 'cargo') y la venta nace en
        2 Pendiente; se paga despues con abonos. Exige un cliente con credito
        autorizado y limite suficiente.
      - Monedero: se paga con el metodo de code PUNTOS, que esta oculto, y baja
        customer.wallet. Exige un cliente con saldo suficiente.
      - Credito y monedero se revisan DENTRO de la transaccion, con el cliente
        bloqueado: asi dos cajas no gastan el mismo saldo. Orden de bloqueos:
        turno y luego cliente.
      - Exige el turno de HOY abierto: la venta y sus pagos entran a ese turno.
      - El precio del catalogo sale de la base; lo que mande el navegador no cuenta.
        La linea libre trae su propio nombre y precio.
      - folio = id. En pantalla se muestra «V» + folio.
      - Se entrega en el mostrador: delivery_method 0 (recoge) y delivery_status 1
        (entregado). Pedidos, Calendario y Dashboard filtran el tipo 1: no la ven.
      - La propina va aparte del total (tip_amount): los pagos suman total + propina.
        El corte la reparte entre los pagos (qDayMethods).
      - Descuento: uno por venta, con motivo y tope (max_percent sobre el subtotal).
        Un motivo con requires_authorization lo aplica solo quien tiene
        «Autorizar descuento» en pos-ventas (core::AUTH_DISCOUNT; hoy Dueño y Supervisor).
      - Descuento por producto: cada renglon puede traer el suyo, con las mismas
        reglas pero sobre su importe (precio × cantidad). Se guarda en detail_sale
        (discount_amount, discount_percent, discount_reason_id). El subtotal de la
        venta ya va neto: el descuento de la venta y el de la tarjeta se calculan
        despues, sobre ese subtotal.
      - Tarjeta de lealtad: llega card_id y se valida aqui (activa, con su tipo
        activo, de la sucursal). Si tiene dueño, la venta es de ese cliente.
        Si su tipo trae descuento, ESE es el descuento de la venta: motivo NULL y
        discount_note «Tarjeta <tipo> · <numero>». No se junta con otro descuento.
      - Puntos: el % del tipo sobre lo pagado con metodos que dan puntos
        (earns_points), sin propina, sin monedero y sin lo que queda a credito.
        Son dinero: suben el monedero del cliente de la venta y dejan una fila
        receivable 'puntos' para poder quitarlos si la venta se cancela.
        Sin cliente no hay puntos.
      - Sellos (Lealtad, plan-sellos.html): un tipo con stamp_goal da 1 sello por
        cada stamp_amount de lo pagado con metodos que dan puntos (como los
        puntos, pero sin pedir cliente: los sellos son de la tarjeta). Con
        redeem = 1 se canjea un premio: es el descuento de la venta (hasta
        reward_value, sin pasar del subtotal; nota «Premio …»), no se junta con
        otro y quita stamp_goal sellos. El saldo se revisa antes y otra vez con
        la tarjeta apartada (qLockCard): dos cajas no canjean el mismo premio.
      - Niveles (Lealtad, plan-crecimiento.html): ya guardada la venta, si la
        tarjeta alcanza el gasto de un nivel mas alto, sube y se le avisa
        (LoyaltyNotifier::levelUp). Si eso falla, la venta queda igual.
      - Sin cliente = Público en general (customer_id NULL).
      - Se valida todo ANTES de la primera escritura: transaction() solo deshace
        si algo lanza una excepcion. */
class ctrl extends core {

    use CreditLedger;
    use LoyaltyCards;
    use TicketLink;

    const SALES        = 'pos-ventas';
    const SALE_TYPE    = 3;
    const MAX_LINES    = 100;
    const MAX_PAYMENTS = 6;
    const MAX_AMOUNT   = 1000000;
    const MAX_TIP      = 999999;
    const MAX_CARD     = 40;

    // -- Arranque --

    public function init() {
        $fail = $this->needBranch();
        if ($fail) return $fail;

        $scope = $this->scope();

        return [
            'status'    => 200,
            // logo: el del ticket impreso (ordPrintTicket, pedido-detalle.js).
            'scope'     => ['company' => $scope['company'], 'branch' => $scope['branch'], 'logo' => $this->companyLogo()],
            'actions'   => $this->actions(),
            'sales'     => Permission::actions(self::SALES),
            'tickets'   => Permission::actions(self::TICKETS),
            'today'     => date('Y-m-d'),
            'turn'      => $this->turnBrief(),
            'day'       => $this->dayBrief(),
            'turns'     => $this->branchTurns(),   // selector de sucursal de la barra
            'user'      => ['id' => $this->userId(), 'name' => $this->userName()],
            'branch_id' => $this->branchId()
        ];
    }

    // -- Opciones de la pantalla --

    public function saleOptions() {
        $fail = $this->needSales('create') ?: $this->needBranch();
        if ($fail) return $fail;

        return $this->attempt(function () {
            $customers  = [];
            $products   = [];
            $categories = [];
            $accounts   = [];

            foreach ($this->qCreditCustomers($this->branchId()) as $a) {
                $accounts[(int) $a['id']] = $this->creditBrief($a, $a['debt']);
            }

            foreach ($this->qCustomerOptions($this->branchId(), 0) as $c) {
                $id      = (int) $c['id'];
                $account = isset($accounts[$id]) ? $accounts[$id] : null;

                $customers[] = [
                    'id'     => $id,
                    'valor'  => $this->customerLabel($c['name'], $c['phone']),
                    'wallet' => $account ? $account['wallet'] : 0,
                    'credit' => $account ? $account['available'] : 0
                ];
            }

            // El monedero va aparte de los metodos: la pantalla lo ofrece solo si el cliente tiene saldo.
            $purse   = $this->qWalletMethod($this->branchId());
            $methods = array_values(array_filter(
                $this->qPaymentMethods($this->branchId()),
                fn ($m) => !$this->isWalletCode($m['code'])
            ));

            foreach ($this->qCatalogProducts($this->companyId(), $this->branchId(), $this->mainBranchId()) as $p) {
                $category = $p['category'] !== '' ? $p['category'] : 'Sin categoría';
                $key      = mb_strtolower($category, 'UTF-8');

                if (!isset($categories[$key])) {
                    $categories[$key] = ['id' => (int) $p['category_id'], 'name' => $category, 'total' => 0];
                }

                $categories[$key]['total']++;

                $products[] = [
                    'id'          => (int) $p['id'],
                    'valor'       => $p['name'] . ' · ' . money($p['price']),
                    'name'        => $p['name'],
                    'price'       => (float) $p['price'],
                    'category_id' => $categories[$key]['id'],
                    'category'    => $category,
                    'image'       => $p['image'],
                    'sku'         => $p['sku'],
                    'barcode'     => $p['barcode']
                ];
            }

            usort($categories, fn ($a, $b) => strcasecmp($a['name'], $b['name']));

            return [
                'status'        => 200,
                'branch'        => $this->scope()['branch'],
                'today'         => date('Y-m-d'),
                'customers'     => $customers,
                'products'      => $products,
                'categories'    => $categories,
                'groups'        => [],
                'methods'       => $methods,
                'wallet_method' => $purse ? ['id' => (int) $purse['id'], 'name' => $purse['name'], 'code' => $purse['code'], 'is_cash' => 0] : null,
                'reasons'       => $this->qDiscountReasons($this->companyId()),
                'can_authorize' => $this->needSales(self::AUTH_DISCOUNT) === null,
                'turn'          => $this->turnBrief(),
                'day'           => $this->dayBrief()
            ];
        }, 'No se pudo abrir la venta.');
    }

    // -- Cliente nuevo --

    public function addCustomer() {
        $fail = $this->needSales('create') ?: $this->needBranch();
        if ($fail) return $fail;

        $name  = trim((string) preg_replace('/\s+/u', ' ', $this->post('name')));
        $phone = preg_replace('/\D/', '', $this->post('phone'));

        if ($name === '')               return $this->fail(422, 'Escribe el nombre del cliente.');
        if ($this->tooLong($name, 120)) return $this->fail(422, 'El nombre admite hasta 120 caracteres.');
        if (strlen($phone) !== 10)      return $this->fail(422, 'El teléfono debe tener 10 dígitos.');

        return $this->attempt(function () use ($name, $phone) {
            return $this->transaction(function () use ($name, $phone) {
                $found = $this->qFindCustomerByPhone($this->branchId(), $phone);

                if ($found) {
                    $label = $found['name'] !== '' ? $found['name'] : 'otro cliente';

                    return $this->ok("Ese teléfono ya es de {$label}. Se eligió ese cliente.", [
                        'existing' => true,
                        'customer' => ['id' => (int) $found['id'], 'valor' => $this->customerLabel($found['name'], $found['phone'])]
                            + $this->accountOf((int) $found['id'])
                    ]);
                }

                $this->must($this->qCreateCustomer([
                    'values' => ['name', 'phone', 'branch_id', 'active'],
                    'data'   => [$name, $phone, $this->branchId(), 1]
                ]), 'addCustomer');

                $id = $this->qLastInsertId();

                if ($id <= 0) throw new RuntimeException('addCustomer: sin id');

                return $this->ok('Cliente agregado.', [
                    'existing' => false,
                    'customer' => ['id' => $id, 'valor' => $this->customerLabel($name, $phone), 'wallet' => 0, 'credit' => 0]
                ]);
            });
        }, 'No se pudo guardar el cliente.');
    }

    // -- Tarjeta de lealtad --

    // Lee una tarjeta por su numero: lo que descuenta, los puntos que da y su dueño.
    public function getCard() {
        $fail = $this->needSales('create') ?: $this->needBranch();
        if ($fail) return $fail;

        $number = strtoupper((string) preg_replace('/\s+/u', '', $this->post('number')));

        if ($number === '') return $this->fail(422, 'Escribe o lee el número de la tarjeta.');

        if (!preg_match('/^[A-Z0-9-]{3,' . self::MAX_CARD . '}$/', $number)) {
            return $this->fail(422, 'Ese número de tarjeta no es válido: lleva letras, números o guiones.');
        }

        return $this->attempt(function () use ($number) {
            $card = $this->qCardByNumber($this->branchId(), $number);

            if (!$card) return $this->fail(404, "No hay una tarjeta activa con el número {$number} en esta empresa.");

            $brief = $this->cardBrief($card);
            $owner = null;

            if ($brief['customer_id']) {
                $owner = ['id' => $brief['customer_id'], 'valor' => $this->customerLabel($card['customer'], $card['customer_phone'])]
                    + $this->accountOf($brief['customer_id']);
            }

            return ['status' => 200, 'card' => $brief, 'customer' => $owner];
        }, 'No se pudo leer la tarjeta.');
    }

    // -- Cobrar la venta --

    public function addSale() {
        $fail = $this->needSales('create') ?: $this->needBranch();
        if ($fail) return $fail;

        $token = $this->post('token');
        $again = $this->tokenResult($token);
        if ($again) return $again;

        $closed = $this->needTurn();
        if ($closed) return $closed;

        $answer = $this->attempt(function () {
            $in = $this->saleInput();
            if (isset($in['status'])) return $in;

            $card = $this->cardInput($in);
            if (isset($card['status'])) return $card;

            $redeem = $this->post('redeem') === '1';
            $wrong  = $redeem ? $this->rewardFail($card) : null;
            if ($wrong) return $wrong;

            $lines = $this->resolveLines($in['lines']);
            if (isset($lines['status'])) return $lines;

            $subtotal = $this->linesTotal($lines);
            $total    = $subtotal;
            $applied  = null;

            $discount = $this->discountInput();
            if (isset($discount['status'])) return $discount;

            $cardOff = $card ? ($redeem ? $this->rewardDiscount($subtotal, $card) : $this->cardDiscount($subtotal, $card)) : null;

            if ($cardOff && $discount !== null) {
                return $this->fail(422, $redeem
                    ? 'El premio ya es el descuento de la venta. Quita el otro descuento o no canjees el premio.'
                    : 'La tarjeta ya trae su descuento. Quita el otro descuento o quita la tarjeta.');
            }

            if ($discount !== null) {
                $applied = $this->discountCheck($subtotal, $discount);
                if (isset($applied['status'])) return $applied;

                $total = $applied['total'];
            }

            if ($cardOff) {
                $applied = $cardOff;
                $total   = $cardOff['total'];
            }

            $due = round($total + $in['tip'], 2);

            $payments = $this->paymentsInput();
            if (isset($payments['status'])) return $payments;

            $rows = $this->paymentRows($payments, $due);
            if (isset($rows['status'])) return $rows;

            $paid   = 0;
            $change = 0;
            $wallet = 0;

            foreach ($rows as $row) {
                $paid   += $row['amount'];
                $change += $row['change'];

                if ($row['wallet']) $wallet += $row['amount'];
            }

            $paid   = round($paid, 2);
            $wallet = round($wallet, 2);
            $credit = $paid + 0.005 < $due ? round($due - $paid, 2) : 0.0;

            if ($credit > 0 && $this->post('credit') !== '1') return $this->fail(422, 'Faltan ' . money($credit) . ' por cobrar.');
            if ($credit > 0 && !$in['customer_id'])           return $this->fail(422, 'Elige un cliente para vender a crédito.');
            if ($wallet > 0 && !$in['customer_id'])           return $this->fail(422, 'Elige un cliente para pagar con su monedero.');

            // Puntos: solo con cliente, y solo sobre lo pagado con metodos que dan puntos (el monedero nunca da).
            $points = 0.0;

            if ($card && $in['customer_id'] && (float) $card['points_percent'] > 0) {
                $earning = array_values(array_filter($rows, fn ($row) => !$row['wallet']));
                $points  = $this->pointsOf($earning, $total, $card['points_percent'], $this->qEarningMethodIds($this->branchId()));
            }

            // Sellos: sin pedir cliente (son de la tarjeta), sobre la misma base que los puntos.
            $stamps = 0;

            if ($card && (int) $card['stamp_goal'] > 0) {
                $earning = array_values(array_filter($rows, fn ($row) => !$row['wallet']));
                $stamps  = $this->stampsOf($earning, $total, $card['stamp_amount'], $this->qEarningMethodIds($this->branchId()));
            }

            $sale = [
                'in' => $in, 'lines' => $lines, 'subtotal' => $subtotal, 'total' => $total, 'due' => $due,
                'applied' => $applied, 'rows' => $rows, 'credit' => $credit, 'wallet' => $wallet,
                'card' => $card, 'points' => $points, 'stamps' => $stamps, 'reward' => $redeem ? $cardOff : null
            ];

            $done = $this->transaction(function () use ($sale, $change) {
                $turn = $this->qLockOpenTurn($this->branchId());

                if (!$turn) {
                    return ['status' => 423, 'title' => 'Sin turno abierto', 'message' => 'El turno se cerró mientras cobrabas. Abre uno nuevo e intenta otra vez.'];
                }

                // Con sellos o premio, la tarjeta queda apartada; el premio se revisa otra vez ya apartada (nada se ha escrito).
                if ($sale['stamps'] > 0 || $sale['reward']) {
                    $this->qLockCard((int) $sale['card']['id']);

                    if ($sale['reward'] && $this->qCardStamps((int) $sale['card']['id']) < (int) $sale['card']['stamp_goal']) {
                        return $this->fail(409, 'Ese premio ya se canjeó en otra venta. Quita el premio y cobra otra vez.');
                    }
                }

                $usesAccount = $sale['credit'] > 0 || $sale['wallet'] > 0;
                $earns       = $sale['points'] > 0;

                // Todavia no se escribio nada: un rechazo aqui no deja la venta a medias.
                if ($usesAccount) {
                    $fail = $this->accountCheck($this->qCreditCustomer($sale['in']['customer_id'], true), $sale);
                    if ($fail) return $fail;
                } elseif ($earns) {
                    // Mismo orden de bloqueos que el credito: turno y luego cliente.
                    $this->qCreditCustomer($sale['in']['customer_id'], true);
                }

                $id      = $this->saveSale($sale, (int) $turn['id']);
                $message = $sale['credit'] > 0
                    ? "Venta V{$id} registrada: " . money($sale['credit']) . ' a crédito.'
                    : "Venta V{$id} cobrada.";

                // Lo que quedó en la tarjeta (ya con lo de esta venta): para la pantalla y el ticket.
                $sale['stamps_info'] = $this->stampsInfo($sale);

                return $this->ok($message, [
                    'id'       => $id,
                    'folio'    => (string) $id,
                    'change'   => round($change, 2),
                    'credit'   => $sale['credit'],
                    'points'   => $sale['points'],
                    'stamps'   => $sale['stamps_info'],
                    'customer' => $usesAccount || $earns ? ['id' => $sale['in']['customer_id']] + $this->accountOf($sale['in']['customer_id']) : null,
                    'ticket'   => $this->ticketData($id, $sale),
                    // V7: el enlace al ticket va con el mismo permiso que imprimirlo.
                    'share'    => Permission::can(self::SALES, 'print') ? $this->ticketShare($id, $sale['in']['phone']) : null
                ]);
            });

            // Premio listo: el aviso va con la venta ya guardada; si no sale, solo se informa.
            if ((int) ($done['status'] ?? 0) === 200 && !empty($done['stamps'])) {
                $done['stamps']['whatsapp'] = $this->rewardNotice($sale, $done['stamps']);
            }

            // Nivel (Lealtad › Programa › Niveles): con esta venta la tarjeta puede subir. La venta ya quedó.
            if ((int) ($done['status'] ?? 0) === 200 && !empty($sale['card'])) {
                $level = $this->levelNotice((int) $sale['card']['id']);

                if ($level) $done['level'] = $level;
            }

            return $done;
        }, 'No se pudo registrar la venta.');

        $this->rememberToken($token, $answer);

        return $answer;
    }

    // -- Escritura (dentro de la transaccion) --

    private function saveSale(array $sale, $turnId) {
        $in      = $sale['in'];
        $applied = $sale['applied'];
        $credit  = $sale['credit'];
        $userId  = $this->userId() ?: null;

        $this->must($this->qCreateOrder([
            'values' => [
                'branch_id', 'customer_id', 'user_id', 'turn_id', 'sale_type_id', 'sale_status_id', 'delivery_method', 'delivery_status',
                'note', 'subtotal', 'discount_amount', 'discount_percent', 'discount_reason_id', 'discount_note', 'discount_user_id',
                'tip_amount', 'total', 'card_id', 'active'
            ],
            'data' => [
                $this->branchId(), $in['customer_id'], $userId, $turnId, self::SALE_TYPE, $credit > 0 ? self::PENDING : self::PAID, 0, 1,
                $in['note'], $sale['subtotal'],
                $applied ? $applied['amount'] : 0,
                $applied ? $applied['percent'] : 0,
                $applied ? $applied['reason_id'] : null,
                $applied ? $applied['note'] : null,
                $applied ? $userId : null,
                $in['tip'], $sale['total'],
                $sale['card'] ? (int) $sale['card']['id'] : null,
                1
            ]
        ]), 'addSale');

        $id = $this->qLastInsertId();

        if ($id <= 0) throw new RuntimeException('addSale: sin id');

        $this->must($this->qUpdateOrder(['values' => ['folio'], 'where' => ['id'], 'data' => [(string) $id, $id]]), 'addSale folio');

        $cuts = [];

        foreach ($sale['lines'] as $line) {
            $off = $line['discount'];

            $this->must($this->qCreateLine([
                'values' => ['sale_id', 'product_id', 'name', 'price', 'quantity', 'details', 'discount_amount', 'discount_percent', 'discount_reason_id', 'active'],
                'data'   => [
                    $id, $line['product_id'], $line['name'], $line['price'], $line['quantity'], $line['details'],
                    $off ? $off['amount'] : 0,
                    $off ? $off['percent'] : 0,
                    $off ? $off['reason_id'] : null,
                    1
                ]
            ]), 'addSale line');

            if ($off) $cuts[] = $line['name'] . ' −' . money($off['amount']) . ' (' . $off['percent'] . ' %) · Motivo: ' . $off['reason'];
        }

        $this->savePayments($id, $turnId, $sale['rows']);

        if ($sale['wallet'] > 0) $this->moveWallet($in['customer_id'], -$sale['wallet'], 'addSale wallet');
        if ($credit > 0)         $this->saveCreditCharge($id, $in['customer_id'], $turnId, $credit);

        // Los puntos son dinero: suben el monedero y dejan su fila para poder quitarlos al cancelar.
        if ($sale['points'] > 0) {
            $this->savePoints($id, $in['customer_id'], $turnId, $sale['points'], "Puntos de la venta V{$id}");
            $this->moveWallet($in['customer_id'], $sale['points'], 'addSale points');
        }

        // Sellos: el premio quita la meta y lo que se pagó suma los suyos. Cada uno deja su fila (cancelar la anula).
        if ($sale['reward']) $this->saveStamp($id, 'canje', -(int) $sale['card']['stamp_goal'], $sale['reward']['amount'], $sale);
        if ($sale['stamps'] > 0) $this->saveStamp($id, 'sello', (int) $sale['stamps'], 0, $sale);

        $tip   = $in['tip'] > 0 ? ' + propina ' . money($in['tip']) : '';
        $title = $credit > 0 ? 'Venta a crédito' : 'Venta cobrada';

        $this->log($id, 'event', $title, 'Venta de mostrador — total ' . money($sale['total']) . $tip . ', ' . $this->productsText(count($sale['lines'])) . '.');

        if ($cuts)    $this->log($id, 'discount', 'Descuento por producto', implode('; ', $cuts) . '.');
        if ($applied) $this->log($id, 'discount', 'Descuento', $applied['text'] . ' Total: ' . money($sale['total']) . '.');
        if ($sale['rows']) $this->log($id, 'payment', 'Venta', $this->paymentsText($sale['rows']));

        if ($credit > 0) {
            $name = $in['customer'] !== '' ? $in['customer'] : 'el cliente';

            $this->log($id, 'payment', 'A crédito', money($credit) . " a la cuenta de {$name}.");
        }

        if ($sale['card']) $this->log($id, 'event', 'Tarjeta', $this->cardText($sale));

        return $id;
    }

    private function savePayments($saleId, $turnId, array $rows) {
        if (!$rows) return;

        $now  = date('Y-m-d H:i:s');
        $data = [];

        foreach ($rows as $row) {
            $data[] = [
                $saleId, $this->branchId(), $this->userId() ?: null, $turnId, $row['method_id'],
                $row['amount'], $row['tendered'], $row['change'], 'Venta', $now, 1
            ];
        }

        $this->must($this->qCreatePayment([
            'values' => ['sale_id', 'branch_id', 'user_id', 'turn_id', 'payment_method_id', 'amount', 'tendered_amount', 'change_amount', 'description', 'paid_at', 'active'],
            'data'   => $data
        ]), 'addSale payment');
    }

    // Lo que el navegador imprime como ticket, con lo que quedo guardado.
    private function ticketData($id, array $sale) {
        $applied = $sale['applied'];
        $card    = $sale['card'];

        return [
            'card'     => $card ? ['type' => (string) $card['type'], 'number' => (string) $card['number']] : null,
            'points'   => $sale['points'],
            'stamps'   => $sale['stamps_info'] ?? null,
            'folio'    => (string) $id,
            'branch'   => $this->scope()['branch'],
            'date'     => date('Y-m-d H:i:s'),
            'user'     => $this->userName(),
            'customer' => $sale['in']['customer'] !== '' ? $sale['in']['customer'] : 'Público en general',
            // amount ya va neto del descuento del renglon.
            'lines'    => array_map(fn ($l) => [
                'name'     => $l['name'],
                'quantity' => $l['quantity'],
                'price'    => $l['price'],
                'details'  => (string) $l['details'],
                'discount' => $l['discount'] ? $l['discount']['amount'] : 0,
                'reason'   => $l['discount'] ? $l['discount']['reason'] : '',
                'amount'   => round($l['price'] * $l['quantity'] - ($l['discount'] ? $l['discount']['amount'] : 0), 2)
            ], $sale['lines']),
            'subtotal' => $sale['subtotal'],
            'discount' => $applied ? ['amount' => $applied['amount'], 'reason' => $applied['reason']] : null,
            'tip'      => $sale['in']['tip'],
            'total'    => $sale['total'],
            'charged'  => round($sale['due'] - $sale['credit'], 2),
            'credit'   => $sale['credit'],
            'payments' => array_map(fn ($r) => [
                'method'   => $r['method'],
                'cash'     => $r['cash'],
                'amount'   => $r['amount'],
                'tendered' => $r['tendered'],
                'change'   => $r['change']
            ], $sale['rows'])
        ];
    }

    // -- Lectura y validacion --

    // {customer_id, customer, note, tip, lines} limpio, o la respuesta 422.
    private function saleInput() {
        $customerId = $this->postId('customer_id');
        $customer   = null;

        if ($customerId > 0) {
            // El cliente es de toda la empresa: vale el de cualquiera de sus sucursales.
            $customer = $this->qGetCustomer($customerId);
            $isLocal  = $customer && (int) $customer['company_id'] === $this->companyId() && (int) $customer['active'] === 1;

            if (!$isLocal) return $this->fail(422, 'Ese cliente no está disponible en esta empresa.');
        }

        $note = $this->textOrNull('note');
        $tip  = $this->amountOf($this->post('tip'), 0);

        if ($this->tooLong($note, 255))                return $this->fail(422, 'La nota admite hasta 255 caracteres.');
        if ($tip === null || $tip > self::MAX_TIP)     return $this->fail(422, 'Escribe una propina válida.');

        $lines = $this->postedJson('lines');

        if (!$lines)                          return $this->fail(422, 'Agrega al menos un producto.');
        if (count($lines) > self::MAX_LINES)  return $this->fail(422, 'Una venta admite hasta ' . self::MAX_LINES . ' productos.');

        return [
            'customer_id' => $customer ? (int) $customer['id'] : null,
            'customer'    => $customer ? trim((string) $customer['name']) : '',
            'phone'       => $customer ? (string) $customer['phone'] : '',
            'note'        => $note,
            'tip'         => $tip,
            'lines'       => array_values($lines)
        ];
    }

    // Renglones con nombre y precio de la base (catalogo) o los suyos (linea libre),
    // cada uno con su descuento ya validado (o null).
    private function resolveLines(array $raw) {
        $lines   = [];
        $reasons = null;

        foreach ($raw as $n => $item) {
            $pos = 'Producto ' . ($n + 1);

            if (!is_array($item)) return $this->fail(422, "{$pos}: llegó vacío.");

            $type     = isset($item['type']) ? (string) $item['type'] : '';
            $quantity = $this->intOf(isset($item['quantity']) ? $item['quantity'] : '');
            $details  = $this->cleanText(isset($item['details']) ? $item['details'] : '');

            if (!in_array($type, ['product', 'free'], true))             return $this->fail(422, "{$pos}: tipo desconocido.");
            if ($quantity === null || $quantity < 1 || $quantity > 9999) return $this->fail(422, "{$pos}: la cantidad va de 1 a 9,999.");
            if ($this->tooLong($details, 255))                           return $this->fail(422, "{$pos}: los detalles admiten hasta 255 caracteres.");

            if ($type === 'product') {
                $productId = isset($item['product_id']) ? (int) $item['product_id'] : 0;
                $product   = $productId > 0 ? $this->qGetCatalogProduct($productId, $this->companyId(), $this->branchId(), $this->mainBranchId()) : null;

                if (!$product) return $this->fail(422, "{$pos}: ese producto ya no está en el catálogo.");

                $line = [
                    'product_id' => (int) $product['id'],
                    'name'       => $product['name'],
                    'price'      => round((float) $product['price'], 2),
                    'quantity'   => $quantity,
                    'details'    => $details
                ];
            } else {
                $name  = $this->cleanText(isset($item['name']) ? $item['name'] : '');
                $price = $this->amountOf(isset($item['price']) ? $item['price'] : '', null);

                if ($name === null)                     return $this->fail(422, "{$pos}: escribe el nombre.");
                if ($this->tooLong($name, 150))         return $this->fail(422, "{$pos}: el nombre admite hasta 150 caracteres.");
                if ($price === null || $price > 999999) return $this->fail(422, "{$pos}: escribe un precio válido.");

                $line = ['product_id' => null, 'name' => $name, 'price' => $price, 'quantity' => $quantity, 'details' => $details];
            }

            $line['discount'] = null;

            if (isset($item['discount']) && $item['discount'] !== '' && $item['discount'] !== null) {
                if ($reasons === null) $reasons = $this->qDiscountReasons($this->companyId());

                $gross    = round($line['price'] * $line['quantity'], 2);
                $discount = $this->lineDiscount($item['discount'], $gross, $pos, $reasons);

                if (isset($discount['status'])) return $discount;

                $line['discount'] = $discount;
            }

            $lines[] = $line;
        }

        return $lines;
    }

    // Descuento de un renglon: {reason_id, reason, amount, percent} o la respuesta de error.
    // El monto se recalcula aqui; del navegador solo cuentan motivo, modo y valor.
    private function lineDiscount($raw, $gross, $pos, array $reasons) {
        if (!is_array($raw)) return $this->fail(422, "{$pos}: el descuento llegó mal. Recarga la página e intenta de nuevo.");

        $reasonId = isset($raw['reason_id']) ? $this->intOf($raw['reason_id']) : null;
        $mode     = isset($raw['mode']) ? (string) $raw['mode'] : '';
        $value    = isset($raw['value']) ? $this->amountOf($raw['value'], null) : null;
        $reason   = null;

        if ($reasonId === null || $reasonId <= 0)            return $this->fail(422, "{$pos}: elige el motivo del descuento.");
        if (!in_array($mode, ['percent', 'amount'], true))   return $this->fail(422, "{$pos}: el descuento va en % o en pesos.");
        if ($value === null || $value <= 0)                  return $this->fail(422, "{$pos}: el descuento tiene que ser mayor a 0.");
        if ($mode === 'percent' && $value > 100)             return $this->fail(422, "{$pos}: el descuento no puede pasar de 100 %.");

        foreach ($reasons as $row) {
            if ((int) $row['id'] === $reasonId) $reason = $row;
        }

        if (!$reason) return $this->fail(422, "{$pos}: ese motivo de descuento ya no existe.");

        if ((int) $reason['requires_authorization'] === 1 && $this->needSales(self::AUTH_DISCOUNT) !== null) {
            return $this->fail(403, "{$pos}: el motivo «{$reason['name']}» lo autoriza un Dueño o Supervisor.");
        }

        $amount = $mode === 'percent' ? round($gross * $value / 100, 2) : $value;
        $cap    = round($gross * (float) $reason['max_percent'] / 100, 2);

        if ($amount <= 0)          return $this->fail(422, "{$pos}: el descuento tiene que ser mayor a \$0.");
        if ($amount > $cap + 0.005) {
            return $this->fail(422, "{$pos}: el motivo «{$reason['name']}» permite hasta " . (float) $reason['max_percent'] . ' % (' . money($cap) . ').');
        }
        if ($amount > $gross + 0.005) return $this->fail(422, "{$pos}: el descuento no puede ser mayor que el importe.");

        return [
            'reason_id' => (int) $reason['id'],
            'reason'    => $reason['name'],
            'amount'    => $amount,
            'percent'   => $gross > 0 ? round($amount / $gross * 100, 2) : 0
        ];
    }

    // [{method_id, amount, tendered}] limpio, o la respuesta 422. Sin pagos = [].
    private function paymentsInput() {
        $raw = $this->post('payments');

        if ($raw === '') return [];

        $list = $this->postedJson('payments');

        if ($list === null)                     return $this->fail(422, 'Los pagos llegaron mal. Recarga la página e intenta de nuevo.');
        if (count($list) > self::MAX_PAYMENTS) return $this->fail(422, 'Un cobro admite hasta ' . self::MAX_PAYMENTS . ' métodos de pago.');

        $clean = [];
        $seen  = [];

        foreach ($list as $item) {
            $methodId = is_array($item) && isset($item['method_id']) ? $this->intOf($item['method_id']) : null;
            $amount   = is_array($item) && isset($item['amount']) ? $this->amountOf($item['amount'], null) : null;
            $tendered = is_array($item) && isset($item['tendered']) ? $this->amountOf($item['tendered'], $amount) : $amount;

            if ($methodId === null || $methodId <= 0) return $this->fail(422, 'Elige el método de cada pago.');
            if ($amount === null || $amount <= 0)     return $this->fail(422, 'Cada pago necesita un monto mayor a $0.');

            if ($amount > self::MAX_AMOUNT || $tendered === null || $tendered > self::MAX_AMOUNT) {
                return $this->fail(422, 'Un pago no puede pasar de ' . money(self::MAX_AMOUNT) . '.');
            }

            if (isset($seen[$methodId])) return $this->fail(422, 'Usa cada método una sola vez por cobro.');

            $seen[$methodId] = true;
            $clean[]         = ['method_id' => $methodId, 'amount' => $amount, 'tendered' => $tendered];
        }

        return $clean;
    }

    // null = sin descuento. Si no: {reason_id, percent|amount, note} limpio, o la respuesta 422.
    private function discountInput() {
        if ($this->post('discount') === '') return null;

        $raw = $this->postedJson('discount');

        if ($raw === null) return $this->fail(422, 'El descuento llegó mal. Recarga la página e intenta de nuevo.');

        $reasonId = isset($raw['reason_id']) ? $this->intOf($raw['reason_id']) : null;
        $percent  = isset($raw['percent']) && $raw['percent'] !== '' ? $this->amountOf($raw['percent'], null) : null;
        $amount   = isset($raw['amount']) && $raw['amount'] !== '' ? $this->amountOf($raw['amount'], null) : null;
        $note     = isset($raw['note']) ? trim((string) preg_replace('/\s+/u', ' ', (string) $raw['note'])) : '';

        if ($reasonId === null || $reasonId <= 0)  return $this->fail(422, 'Elige el motivo del descuento.');
        if ($percent === null && $amount === null) return $this->fail(422, 'Escribe el descuento en % o en pesos.');
        if ($percent !== null && $percent > 100)   return $this->fail(422, 'El descuento no puede pasar de 100 %.');
        if ($this->tooLong($note, 255))            return $this->fail(422, 'La nota del descuento admite hasta 255 caracteres.');

        return ['reason_id' => $reasonId, 'percent' => $percent, 'amount' => $amount, 'note' => $note === '' ? null : $note];
    }

    // El descuento contra su motivo y su tope, o la respuesta de error.
    private function discountCheck($subtotal, array $discount) {
        $reason = null;

        foreach ($this->qDiscountReasons($this->companyId()) as $row) {
            if ((int) $row['id'] === $discount['reason_id']) $reason = $row;
        }

        if (!$reason) return $this->fail(422, 'Ese motivo de descuento ya no existe.');

        if ((int) $reason['requires_authorization'] === 1 && $this->needSales(self::AUTH_DISCOUNT) !== null) {
            return $this->fail(403, 'El motivo «' . $reason['name'] . '» lo autoriza un Dueño o Supervisor.');
        }

        $amount = $discount['percent'] !== null ? round($subtotal * $discount['percent'] / 100, 2) : $discount['amount'];
        $cap    = round($subtotal * (float) $reason['max_percent'] / 100, 2);

        if ($amount <= 0) return $this->fail(422, 'El descuento tiene que ser mayor a $0.');

        if ($amount > $cap + 0.005) {
            return $this->fail(422, 'El motivo «' . $reason['name'] . '» permite hasta ' . (float) $reason['max_percent'] . ' % (' . money($cap) . ').');
        }

        $total = round($subtotal - $amount, 2);

        if ($total < 0) return $this->fail(422, 'El descuento no puede ser mayor que el total.');

        $percent = $subtotal > 0 ? round($amount / $subtotal * 100, 2) : 0;
        $text    = 'Descuento de ' . money($amount) . ' (' . $percent . ' %) · Motivo: ' . $reason['name'] . '.';

        if ($discount['note'] !== null) $text .= ' Nota: ' . $discount['note'] . '.';

        return [
            'reason_id' => (int) $reason['id'],
            'reason'    => $reason['name'],
            'amount'    => $amount,
            'percent'   => $percent,
            'note'      => $discount['note'],
            'total'     => $total,
            'text'      => $text
        ];
    }

    // null = venta sin tarjeta. Si no: la tarjeta (activa, con tipo activo, de la empresa) o la respuesta de error.
    private function cardInput(array $in) {
        $cardId = $this->postId('card_id');

        if ($cardId <= 0) return null;

        $card = $this->qSaleCard($cardId, $this->branchId());

        if (!$card) return $this->fail(422, 'Esa tarjeta ya no está activa en esta empresa. Quítala del ticket o lee otra.');

        $owner = $card['owner_id'] !== null ? (int) $card['owner_id'] : 0;

        // Los puntos van al cliente de la venta: con dueño, la venta tiene que ser suya.
        if ($owner > 0 && $owner !== (int) $in['customer_id']) {
            $name = trim((string) $card['customer']) !== '' ? trim((string) $card['customer']) : 'su dueño';

            return $this->fail(422, "La tarjeta {$card['number']} es de {$name}. Elige a ese cliente o quita la tarjeta.");
        }

        return $card;
    }

    // El descuento que trae el tipo de la tarjeta, con la forma de discountCheck. null = no descuenta.
    private function cardDiscount($subtotal, array $card) {
        $amount = round($subtotal * (float) $card['discount_percent'] / 100, 2);

        if ($amount <= 0) return null;

        $percent = $subtotal > 0 ? round($amount / $subtotal * 100, 2) : 0;
        $label   = 'Tarjeta ' . $card['type'];
        $note    = $label . ' · ' . $card['number'];

        return [
            'reason_id' => null,
            'reason'    => $label,
            'amount'    => $amount,
            'percent'   => $percent,
            'note'      => $note,
            'total'     => round($subtotal - $amount, 2),
            'text'      => 'Descuento de ' . money($amount) . ' (' . $percent . ' %) · ' . $note . '.'
        ];
    }

    // Lo que hizo la tarjeta en la venta, para la bitacora.
    private function cardText(array $sale) {
        $card = $sale['card'];
        $text = 'Tarjeta ' . $card['type'] . ' · ' . $card['number'] . '.';

        if ($sale['points'] > 0) {
            $name  = $sale['in']['customer'] !== '' ? $sale['in']['customer'] : 'el cliente';
            $text .= ' Abonó ' . money($sale['points']) . " en puntos al monedero de {$name}.";
        }

        if ($sale['reward']) $text .= ' Canjeó el premio ' . $card['reward_name'] . ' (−' . money($sale['reward']['amount']) . ').';
        if ($sale['stamps'] > 0) $text .= ' Sumó ' . $sale['stamps'] . ($sale['stamps'] === 1 ? ' sello.' : ' sellos.');

        return $text;
    }

    // -- Sellos --

    // null = se puede canjear. Si no, la respuesta de error (antes de calcular nada).
    private function rewardFail($card) {
        if (!$card || (int) $card['stamp_goal'] <= 0) return $this->fail(422, 'Esa tarjeta no junta sellos: no hay premio que canjear.');

        if ($this->qCardStamps((int) $card['id']) < (int) $card['stamp_goal']) {
            return $this->fail(409, "La tarjeta {$card['number']} todavía no completa sus sellos: no hay premio que canjear.");
        }

        return null;
    }

    // El premio como descuento de la venta, con la forma de discountCheck: hasta su valor, sin pasar del subtotal.
    private function rewardDiscount($subtotal, array $card) {
        $amount = round(min((float) $card['reward_value'], (float) $subtotal), 2);

        if ($amount <= 0) return null;

        $percent = $subtotal > 0 ? round($amount / $subtotal * 100, 2) : 0;
        $label   = 'Premio ' . $card['reward_name'];
        $note    = $label . ' · ' . $card['type'] . ' · ' . $card['number'];

        return [
            'reason_id' => null,
            'reason'    => $label,
            'amount'    => $amount,
            'percent'   => $percent,
            'note'      => mb_substr($note, 0, 255, 'UTF-8'),
            'total'     => round($subtotal - $amount, 2),
            'text'      => 'Premio de la tarjeta: ' . money($amount) . ' (' . $percent . ' %) · ' . $note . '.'
        ];
    }

    private function saveStamp($saleId, $kind, $qty, $amount, array $sale) {
        $this->must($this->qCreateStamp([
            'values' => ['card_id', 'sale_id', 'kind', 'qty', 'amount', 'branch_id', 'user_id', 'created_at'],
            'data'   => [(int) $sale['card']['id'], $saleId, $kind, $qty, round((float) $amount, 2), $this->branchId(), $this->userId() ?: null, date('Y-m-d H:i:s')]
        ]), 'addSale ' . $kind);
    }

    /*  Si con esta venta la tarjeta completó un premio y su dueño tiene WhatsApp
        de 10 dígitos, le avisa con la plantilla 'premio' (LoyaltyNotifier). Se
        compara contra lo que tenía después de canjear y antes de sumar: un premio
        que ya estaba listo no se vuelve a avisar. null = no tocaba avisar. */
    private function rewardNotice(array $sale, array $info) {
        $card = $sale['card'];
        $goal = (int) $info['goal'];

        if ($goal <= 0 || (int) $info['earned'] <= 0 || $card['owner_id'] === null) return null;

        if (intdiv(max((int) $info['balance'], 0), $goal) <= intdiv(max((int) $info['balance'] - (int) $info['earned'], 0), $goal)) return null;

        $digits = (string) preg_replace('/\D/', '', (string) $card['customer_phone']);
        $phone  = strlen($digits) === 12 && strpos($digits, '52') === 0 ? substr($digits, 2) : $digits;

        if (strlen($phone) !== 10) return null;

        $notifier = $this->loyaltyNotifier();

        if (!$notifier) return null;

        try {
            return $notifier->rewardReady($card, $phone);
        } catch (Throwable $e) {
            $this->writeToLog('[ PREMIO WHATSAPP ] :: ' . $e->getMessage());

            return ['status' => 'failed', 'detail' => 'No se pudo mandar.'];
        }
    }

    /*  Si con esta venta la tarjeta ya alcanza un nivel más alto, sube y avisa
        (LoyaltyNotifier). null = no cambió, Niveles apagado o no está en el servidor. */
    private function levelNotice($cardId) {
        $notifier = $this->loyaltyNotifier();

        if (!$notifier || !method_exists($notifier, 'levelUp')) return null;

        try {
            return $notifier->levelUp($cardId);
        } catch (Throwable $e) {
            $this->writeToLog('[ NIVEL ] :: ' . $e->getMessage());

            return null;
        }
    }

    // El que manda el aviso (mdl-lealtad-whatsapp.php). null si el WhatsApp no está en el servidor.
    protected function loyaltyNotifier() {
        return class_exists('LoyaltyNotifier') ? new LoyaltyNotifier() : null;
    }

    // Los sellos de la tarjeta despues de la venta. null = la tarjeta no junta sellos.
    private function stampsInfo(array $sale) {
        $card = $sale['card'];

        if (!$card || (int) $card['stamp_goal'] <= 0) return null;

        $goal = (int) $card['stamp_goal'];
        $have = max($this->qCardStamps((int) $card['id']), 0);

        // type, color, icon y prize: para dibujar la tarjeta chica en «Venta cobrada» (el sello que cae).
        return [
            'earned'  => (int) $sale['stamps'],
            'balance' => $have,
            'goal'    => $goal,
            'rewards' => intdiv($have, $goal),
            'reward'  => $sale['reward'] ? ['name' => (string) $card['reward_name'], 'amount' => $sale['reward']['amount']] : null,
            'type'    => (string) $card['type'],
            'color'   => preg_match('/^#[0-9A-F]{6}$/i', (string) ($card['color'] ?? '')) ? strtoupper($card['color']) : '',
            'icon'    => (string) $card['stamp_icon'],
            'prize'   => (string) $card['reward_name']
        ];
    }

    // Pagos contra los metodos de la base y lo que se cobra. Devuelve los renglones o la respuesta de error.
    private function paymentRows(array $payments, $due) {
        if (!$payments) return [];

        $methods = [];

        foreach ($this->qPaymentMethods($this->branchId()) as $method) {
            $methods[(int) $method['id']] = $method;
        }

        // El monedero va aparte: qPaymentMethods no lo trae.
        $purse = $this->qWalletMethod($this->branchId());

        if ($purse) $methods[(int) $purse['id']] = $purse;

        $rows = [];
        $sum  = 0;

        foreach ($payments as $payment) {
            if (!isset($methods[$payment['method_id']])) return $this->fail(422, 'Uno de los métodos de pago ya no está disponible.');

            $method = $methods[$payment['method_id']];
            $cash   = (int) $method['is_cash'] === 1;

            if ($cash && $payment['tendered'] + 0.005 < $payment['amount']) {
                return $this->fail(422, 'Lo recibido en efectivo (' . money($payment['tendered']) . ') no alcanza para ' . money($payment['amount']) . '.');
            }

            $tendered = $cash ? $payment['tendered'] : $payment['amount'];
            $sum     += $payment['amount'];

            $rows[] = [
                'method_id' => $payment['method_id'],
                'method'    => $method['name'],
                'cash'      => $cash,
                'wallet'    => $this->isWalletCode($method['code']),
                'amount'    => $payment['amount'],
                'tendered'  => $tendered,
                'change'    => round($tendered - $payment['amount'], 2)
            ];
        }

        if (round($sum, 2) > $due + 0.005) {
            return $this->fail(422, 'Estás cobrando ' . money($sum) . ' y la venta es de ' . money($due) . '.');
        }

        return $rows;
    }

    // -- Credito y monedero --

    /*  El monedero y el credito del cliente contra lo que pide la venta.
        $account llega bloqueado (qCreditCustomer con $lock). null = alcanza. */
    private function accountCheck($account, array $sale) {
        $isLocal = $account && (int) $account['company_id'] === $this->companyId() && (int) $account['active'] === 1;

        if (!$isLocal) return $this->fail(422, 'Ese cliente no está disponible en esta empresa.');

        $name  = trim($account['name']) !== '' ? trim($account['name']) : 'el cliente';
        $debt  = $sale['credit'] > 0 ? $this->qCreditDebt((int) $account['id']) : 0;
        $brief = $this->creditBrief($account, $debt);

        if ($sale['wallet'] > $brief['wallet'] + 0.005) {
            return $this->fail(422, "El monedero de {$name} solo tiene " . money($brief['wallet']) . '.');
        }

        if ($sale['credit'] <= 0) return null;

        if (!$brief['enabled']) return $this->fail(422, "{$name} no tiene crédito autorizado.");

        if ($sale['credit'] > $brief['available'] + 0.005) {
            return $this->fail(422, "El crédito disponible de {$name} es " . money($brief['available']) . ' y faltan ' . money($sale['credit']) . '.');
        }

        return null;
    }

    // Monedero y credito disponible de un cliente, como los espera la pantalla.
    private function accountOf($customerId) {
        $brief = $this->creditBrief($this->qCreditCustomer($customerId), $this->qCreditDebt($customerId));

        return ['wallet' => $brief['wallet'], 'credit' => $brief['available']];
    }

    // -- Complements --

    // null si puede; si no, la respuesta 403 con la frase completa.
    private function needSales($action) {
        if (Permission::can(self::SALES, $action)) return null;

        $what = [
            'show'   => 'ver ventas',
            'create' => 'cobrar ventas',
            self::AUTH_DISCOUNT => 'autorizar descuentos',
            'print'  => 'imprimir tickets'
        ];

        $text = isset($what[$action]) ? $what[$action] : 'hacer esto';

        return ['status' => 403, 'message' => "Tu rol no tiene permiso para {$text} en esta sucursal.", 'row' => []];
    }

    private function userName() {
        return isset($_SESSION['user']) ? trim((string) $_SESSION['user']) : '';
    }

    private function customerLabel($name, $phone) {
        $name = trim((string) $name) !== '' ? trim($name) : 'Sin nombre';

        return trim((string) $phone) !== '' ? $name . ' · ' . trim($phone) : $name;
    }

    private function cleanText($value) {
        $value = trim((string) preg_replace('/\s+/u', ' ', (string) $value));

        return $value === '' ? null : $value;
    }

    private function linesTotal(array $lines) {
        $total = 0;

        // Neto: el descuento de cada renglon ya va restado.
        foreach ($lines as $line) {
            $total += $line['price'] * $line['quantity'] - ($line['discount'] ? $line['discount']['amount'] : 0);
        }

        return round($total, 2);
    }

    private function productsText($count) {
        return $count === 1 ? '1 producto' : "{$count} productos";
    }

    private function paymentsText(array $rows) {
        $parts = [];

        foreach ($rows as $row) {
            $text = $row['method'] . ' ' . money($row['amount']);

            if ($row['cash'] && $row['change'] > 0) {
                $text .= ' (recibió ' . money($row['tendered']) . ', cambio ' . money($row['change']) . ')';
            }

            $parts[] = $text;
        }

        return implode(' + ', $parts) . '.';
    }
}

Permission::dispatch(new ctrl(), ctrl::SALES);
