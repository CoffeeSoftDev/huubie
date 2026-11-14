<?php
require_once __DIR__ . '/../../../core/security/_Session.php';
if (empty($_POST['opc'])) exit(0);

require_once __DIR__ . '/core-order.php';

/*  Ventas › vender en mostrador (V1 del plan de Ventas).

    Reglas que no se ven en el codigo de un vistazo:
      - Una venta nace pagada: sale_type_id 3 (POS) y sale_status_id 3 (Pagado).
        Venta, renglones y pagos se guardan en UNA transaccion; no pasa por Pedidos.
      - Exige el turno de HOY abierto: la venta y sus pagos entran a ese turno.
      - El precio del catalogo sale de la base; lo que mande el navegador no cuenta.
        La linea libre trae su propio nombre y precio.
      - folio = id. En pantalla se muestra «V» + folio.
      - Se entrega en el mostrador: delivery_method 0 (recoge) y delivery_status 1
        (entregado). Pedidos, Calendario y Dashboard filtran el tipo 1: no la ven.
      - La propina va aparte del total (tip_amount): los pagos suman total + propina.
        El corte la reparte entre los pagos (qDayMethods).
      - Descuento: uno por venta, con motivo y tope (max_percent sobre el subtotal).
        Un motivo con requires_authorization lo aplica solo quien puede cancelar en
        pos-ventas (Dueño o Supervisor).
      - Sin cliente = Público en general (customer_id NULL).
      - Se valida todo ANTES de la primera escritura: transaction() solo deshace
        si algo lanza una excepcion. */
class ctrl extends core {

    const SALES        = 'pos-ventas';
    const SALE_TYPE    = 3;
    const MAX_LINES    = 100;
    const MAX_PAYMENTS = 6;
    const MAX_AMOUNT   = 1000000;
    const MAX_TIP      = 999999;

    // -- Arranque --

    public function init() {
        $fail = $this->needBranch();
        if ($fail) return $fail;

        $scope = $this->scope();

        return [
            'status'    => 200,
            'scope'     => ['company' => $scope['company'], 'branch' => $scope['branch']],
            'actions'   => $this->actions(),
            'sales'     => Permission::actions(self::SALES),
            'tickets'   => Permission::actions(self::TICKETS),
            'today'     => date('Y-m-d'),
            'turn'      => $this->turnBrief(),
            'day'       => $this->dayBrief(),
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

            foreach ($this->qCustomerOptions($this->branchId(), 0) as $c) {
                $customers[] = ['id' => (int) $c['id'], 'valor' => $this->customerLabel($c['name'], $c['phone'])];
            }

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
                'methods'       => $this->qPaymentMethods($this->companyId()),
                'reasons'       => $this->qDiscountReasons($this->companyId()),
                'can_authorize' => $this->needSales('cancel') === null,
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
                    'customer' => ['id' => $id, 'valor' => $this->customerLabel($name, $phone)]
                ]);
            });
        }, 'No se pudo guardar el cliente.');
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

            $lines = $this->resolveLines($in['lines']);
            if (isset($lines['status'])) return $lines;

            $subtotal = $this->linesTotal($lines);
            $total    = $subtotal;
            $applied  = null;

            $discount = $this->discountInput();
            if (isset($discount['status'])) return $discount;

            if ($discount !== null) {
                $applied = $this->discountCheck($subtotal, $discount);
                if (isset($applied['status'])) return $applied;

                $total = $applied['total'];
            }

            $due = round($total + $in['tip'], 2);

            $payments = $this->paymentsInput();
            if (isset($payments['status'])) return $payments;

            $rows = $this->paymentRows($payments, $due);
            if (isset($rows['status'])) return $rows;

            $paid   = 0;
            $change = 0;

            foreach ($rows as $row) {
                $paid   += $row['amount'];
                $change += $row['change'];
            }

            $paid = round($paid, 2);

            if ($paid + 0.005 < $due) return $this->fail(422, 'Faltan ' . money($due - $paid) . ' por cobrar.');

            $sale = ['in' => $in, 'lines' => $lines, 'subtotal' => $subtotal, 'total' => $total, 'due' => $due, 'applied' => $applied, 'rows' => $rows];

            return $this->transaction(function () use ($sale, $change) {
                $turn = $this->qLockOpenTurn($this->branchId());

                if (!$turn) {
                    return ['status' => 423, 'title' => 'Sin turno abierto', 'message' => 'El turno se cerró mientras cobrabas. Abre uno nuevo e intenta otra vez.'];
                }

                $id = $this->saveSale($sale, (int) $turn['id']);

                return $this->ok("Venta V{$id} cobrada.", [
                    'id'     => $id,
                    'folio'  => (string) $id,
                    'change' => round($change, 2),
                    'ticket' => $this->ticketData($id, $sale)
                ]);
            });
        }, 'No se pudo registrar la venta.');

        $this->rememberToken($token, $answer);

        return $answer;
    }

    // -- Escritura (dentro de la transaccion) --

    private function saveSale(array $sale, $turnId) {
        $in      = $sale['in'];
        $applied = $sale['applied'];
        $userId  = $this->userId() ?: null;

        $this->must($this->qCreateOrder([
            'values' => [
                'branch_id', 'customer_id', 'user_id', 'turn_id', 'sale_type_id', 'sale_status_id', 'delivery_method', 'delivery_status',
                'note', 'subtotal', 'discount_amount', 'discount_percent', 'discount_reason_id', 'discount_note', 'discount_user_id',
                'tip_amount', 'total', 'active'
            ],
            'data' => [
                $this->branchId(), $in['customer_id'], $userId, $turnId, self::SALE_TYPE, self::PAID, 0, 1,
                $in['note'], $sale['subtotal'],
                $applied ? $applied['amount'] : 0,
                $applied ? $applied['percent'] : 0,
                $applied ? $applied['reason_id'] : null,
                $applied ? $applied['note'] : null,
                $applied ? $userId : null,
                $in['tip'], $sale['total'], 1
            ]
        ]), 'addSale');

        $id = $this->qLastInsertId();

        if ($id <= 0) throw new RuntimeException('addSale: sin id');

        $this->must($this->qUpdateOrder(['values' => ['folio'], 'where' => ['id'], 'data' => [(string) $id, $id]]), 'addSale folio');

        foreach ($sale['lines'] as $line) {
            $this->must($this->qCreateLine([
                'values' => ['sale_id', 'product_id', 'name', 'price', 'quantity', 'details', 'active'],
                'data'   => [$id, $line['product_id'], $line['name'], $line['price'], $line['quantity'], $line['details'], 1]
            ]), 'addSale line');
        }

        $this->savePayments($id, $turnId, $sale['rows']);

        $tip = $in['tip'] > 0 ? ' + propina ' . money($in['tip']) : '';

        $this->log($id, 'event', 'Venta cobrada', 'Venta de mostrador — total ' . money($sale['total']) . $tip . ', ' . $this->productsText(count($sale['lines'])) . '.');

        if ($applied) $this->log($id, 'discount', 'Descuento', $applied['text'] . ' Total: ' . money($sale['total']) . '.');
        if ($sale['rows']) $this->log($id, 'payment', 'Venta', $this->paymentsText($sale['rows']));

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

        return [
            'folio'    => (string) $id,
            'branch'   => $this->scope()['branch'],
            'date'     => date('Y-m-d H:i:s'),
            'user'     => $this->userName(),
            'customer' => $sale['in']['customer'] !== '' ? $sale['in']['customer'] : 'Público en general',
            'lines'    => array_map(fn ($l) => [
                'name'     => $l['name'],
                'quantity' => $l['quantity'],
                'price'    => $l['price'],
                'details'  => (string) $l['details'],
                'amount'   => round($l['price'] * $l['quantity'], 2)
            ], $sale['lines']),
            'subtotal' => $sale['subtotal'],
            'discount' => $applied ? ['amount' => $applied['amount'], 'reason' => $applied['reason']] : null,
            'tip'      => $sale['in']['tip'],
            'total'    => $sale['total'],
            'charged'  => $sale['due'],
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
            $customer = $this->qGetCustomer($customerId);
            $isLocal  = $customer && (int) $customer['branch_id'] === $this->branchId() && (int) $customer['active'] === 1;

            if (!$isLocal) return $this->fail(422, 'Ese cliente no está disponible en esta sucursal.');
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
            'note'        => $note,
            'tip'         => $tip,
            'lines'       => array_values($lines)
        ];
    }

    // Renglones con nombre y precio de la base (catalogo) o los suyos (linea libre).
    private function resolveLines(array $raw) {
        $lines = [];

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

                $lines[] = [
                    'product_id' => (int) $product['id'],
                    'name'       => $product['name'],
                    'price'      => round((float) $product['price'], 2),
                    'quantity'   => $quantity,
                    'details'    => $details
                ];

                continue;
            }

            $name  = $this->cleanText(isset($item['name']) ? $item['name'] : '');
            $price = $this->amountOf(isset($item['price']) ? $item['price'] : '', null);

            if ($name === null)                     return $this->fail(422, "{$pos}: escribe el nombre.");
            if ($this->tooLong($name, 150))         return $this->fail(422, "{$pos}: el nombre admite hasta 150 caracteres.");
            if ($price === null || $price > 999999) return $this->fail(422, "{$pos}: escribe un precio válido.");

            $lines[] = ['product_id' => null, 'name' => $name, 'price' => $price, 'quantity' => $quantity, 'details' => $details];
        }

        return $lines;
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

        if ((int) $reason['requires_authorization'] === 1 && $this->needSales('cancel') !== null) {
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

    // Pagos contra los metodos de la base y lo que se cobra. Devuelve los renglones o la respuesta de error.
    private function paymentRows(array $payments, $due) {
        if (!$payments) return [];

        $methods = [];

        foreach ($this->qPaymentMethods($this->companyId()) as $method) {
            $methods[(int) $method['id']] = $method;
        }

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

    // -- Complements --

    // null si puede; si no, la respuesta 403 con la frase completa.
    private function needSales($action) {
        if (Permission::can(self::SALES, $action)) return null;

        $what = [
            'show'   => 'ver ventas',
            'create' => 'cobrar ventas',
            'cancel' => 'autorizar descuentos',
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

        foreach ($lines as $line) {
            $total += $line['price'] * $line['quantity'];
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
