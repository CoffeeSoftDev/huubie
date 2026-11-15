<?php
require_once __DIR__ . '/../../../core/security/_Session.php';

if (empty($_POST['opc'])) exit(0);

require_once __DIR__ . '/core-order.php';
require_once __DIR__ . '/../mdl/mdl-credito.php';
require_once __DIR__ . '/../mdl/mdl-portal.php';

/*  Clientes › Comprobantes: lo que mandan los clientes desde su enlace
    (portal.php) y el enlace mismo.

    Permisos:
      - Ver la bandeja y el enlace pide ver Clientes. «Nuevo enlace» pide editarlos.
      - Abonar o rechazar pide poder cobrar: pedidos (pos-pedidos › create) o
        ventas (pos-ventas › create). Cada folio que toca el abono pide el suyo.

    Abonar:
      - Entra al turno abierto de la sucursal, como un cobro de mostrador. Sin
        turno no se abona; rechazar si se puede.
      - Primero el folio elegido (el del cliente o el que ponga quien revisa); lo
        que sobra, del folio mas viejo al mas nuevo. Una cotizacion solo recibe
        si es la elegida: es su anticipo.
      - Cada pago lleva «Comprobante C<id>» en su descripcion.
      - Dentro de la transaccion, como addCreditPayment: se bloquean el
        comprobante, las ventas y el turno, y los saldos se leen despues. */
class ctrl extends core {
    use CreditLedger, CustomerPortal;

    const CLIENTS    = 'pos-clientes';
    const SALES      = 'pos-ventas';
    const MAX_AMOUNT = 1000000;
    const MAX_REASON = 255;
    const LIST_MAX   = 100;

    // -- Bandeja --

    // El numero de la insignia del boton «Comprobantes».
    public function countReceipts() {
        $fail = $this->needClients('show') ?: $this->needBranch();
        if ($fail) return $fail;

        return $this->attempt(function () {
            return ['status' => 200, 'counts' => $this->qReceiptCounts($this->branchId())];
        }, 'No se pudieron contar los comprobantes.');
    }

    // status = pending (en revision) o reviewed (abonados y rechazados).
    public function lsReceipts() {
        $fail = $this->needClients('show') ?: $this->needBranch();
        if ($fail) return $fail;

        $tab = $this->post('status') === 'reviewed' ? 'reviewed' : 'pending';

        return $this->attempt(function () use ($tab) {
            $rows = $this->qReceiptList($this->branchId(), $tab, self::LIST_MAX);

            return [
                'status' => 200,
                'tab'    => $tab,
                'rows'   => array_map(fn ($row) => $this->receiptRow($row), $rows),
                'counts' => $this->qReceiptCounts($this->branchId()),
                'limit'  => self::LIST_MAX
            ];
        }, 'No se pudieron leer los comprobantes.');
    }

    // El comprobante y, si sigue en revision, lo que debe el cliente hoy y con que se puede abonar.
    public function getReceipt() {
        $fail = $this->needClients('show') ?: $this->needBranch();
        if ($fail) return $fail;

        $id = $this->postId();
        if ($id <= 0) return $this->fail(422, 'Falta el comprobante.');

        return $this->attempt(function () use ($id) {
            $row = $this->qReceipt($id, $this->branchId());

            if (!$row) return $this->fail(404, 'Ese comprobante no existe en esta sucursal.');

            $receipt = $this->receiptRow($row);
            $answer  = ['status' => 200, 'receipt' => $receipt, 'can_review' => false];

            if ($receipt['status'] !== 'pending') return $answer;

            $debts   = $this->portalDebts($receipt['customer_id'], $this->branchId(), date('Y-m-d'));
            $methods = $this->receiptMethods();
            $review  = $this->needReview();
            $turn    = $review ? null : $this->needTurn();
            $block   = '';

            if ($review)       $block = $review['message'];
            elseif ($turn)     $block = $turn['message'];
            elseif (!$methods) $block = 'No hay un método para transferencias. Agrégalo en Catálogo › Métodos de pago.';

            return array_merge($answer, [
                'can_review' => $review === null,
                'can_apply'  => $block === '',
                'block'      => $block,
                'block_day'  => $turn && !empty($turn['day']),
                'debts'      => array_map(fn ($sale) => $this->debtRow($sale, false), $debts['items']),
                'quotes'     => array_map(fn ($sale) => $this->debtRow($sale, true), $debts['quotes']),
                'debt'       => $debts['debt'],
                'methods'    => $methods,
                'method_id'  => $this->defaultMethod($methods)
            ]);
        }, 'No se pudo abrir el comprobante.');
    }

    // -- Abonar --

    public function applyReceipt() {
        $fail = $this->needClients('show') ?: $this->needBranch() ?: $this->needReview();
        if ($fail) return $fail;

        $id    = $this->postId();
        $token = $this->post('token');

        $again = $this->tokenResult($token);
        if ($again) return $again;

        if ($id <= 0) return $this->fail(422, 'Falta el comprobante.');

        $amount   = $this->amountOf($this->post('amount'), null);
        $methodId = $this->intOf($this->post('method_id'));
        $target   = $this->intOf($this->post('sale_id', '0'));

        if ($amount === null || $amount <= 0)     return $this->fail(422, 'Escribe cuánto se abona.');
        if ($amount > self::MAX_AMOUNT)           return $this->fail(422, 'Un abono no puede pasar de ' . money(self::MAX_AMOUNT) . '.');
        if ($methodId === null || $methodId <= 0) return $this->fail(422, 'Elige con qué método entra el abono.');
        if ($target === null || $target < 0)      return $this->fail(422, 'Elige a qué folio va el abono.');

        $closed = $this->needTurn();
        if ($closed) return $closed;

        $answer = $this->attempt(function () use ($id, $amount, $methodId, $target) {
            $method = null;

            foreach ($this->receiptMethods() as $option) {
                if ($option['id'] === $methodId) $method = $option;
            }

            if (!$method) return $this->fail(422, 'Ese método de pago ya no está disponible.');

            $receipt = $this->qReceipt($id, $this->branchId());

            if (!$receipt)                         return $this->fail(404, 'Ese comprobante no existe en esta sucursal.');
            if ($receipt['status'] !== 'pending') return $this->fail(409, 'Este comprobante ya se revisó. Recarga la lista.');

            $customerId = (int) $receipt['customer_id'];
            $name       = $this->customerName($receipt['customer']);
            $today      = date('Y-m-d');
            $before     = $this->portalDebts($customerId, $this->branchId(), $today);
            $ids        = array_merge(array_column($before['items'], 'id'), array_column($before['quotes'], 'id'));

            if ($target > 0) $ids[] = $target;

            if (!$ids) return $this->fail(409, "{$name} ya no debe nada en esta sucursal. Si el pago no corresponde, recházalo con un motivo.");

            return $this->transaction(function () use ($id, $amount, $method, $target, $customerId, $name, $today, $ids) {
                $locked = $this->qLockReceipt($id, $this->branchId());

                if (!$locked || $locked['status'] !== 'pending') return $this->fail(409, 'Otra persona ya revisó este comprobante. Recarga la lista.');

                $sales = array_flip($this->qLockSales($ids));
                $turn  = $this->qLockOpenTurn($this->branchId());

                if (!$turn) {
                    return ['status' => 423, 'title' => 'Sin turno abierto', 'message' => 'El turno se cerró mientras revisabas. Abre uno nuevo e intenta otra vez.'];
                }

                $debts = $this->portalDebts($customerId, $this->branchId(), $today);
                $queue = $this->applyQueue($debts, $sales, $target);

                if (isset($queue['status'])) return $queue;

                $cap = 0;
                foreach ($queue as $sale) $cap += $sale['left'];
                $cap = round($cap, 2);

                if ($cap <= 0.005)          return $this->fail(409, "{$name} ya no debe nada en esta sucursal. Si el pago no corresponde, recházalo con un motivo.");
                if ($amount > $cap + 0.005) return $this->fail(422, 'Estás abonando ' . money($amount) . ' y lo más que se puede abonar es ' . money($cap) . '.');

                $parts = $this->applyParts($queue, $amount);

                // Antes de escribir: un fail devuelto dentro de transaction() se confirma.
                $canOrders = Permission::can(self::SECTION, 'create');
                $canSales  = Permission::can(self::SALES, 'create');

                foreach ($parts as $part) {
                    if ($part['kind'] === 'order' && !$canOrders) return $this->fail(403, "Tu rol no tiene permiso para cobrar pedidos y el abono toca {$part['folio']}.");
                    if ($part['kind'] === 'credit' && !$canSales) return $this->fail(403, "Tu rol no tiene permiso para cobrar ventas a crédito y el abono toca {$part['folio']}.");
                }

                $stamp  = date('Y-m-d H:i:s');
                $turnId = (int) $turn['id'];
                $folio  = $this->receiptFolio($id);
                $data   = [];

                foreach ($parts as $part) {
                    $data[] = [
                        $part['id'], $this->branchId(), $this->userId() ?: null, $turnId, $method['id'],
                        $part['pay'], $part['pay'], 0, $part['concept'] . ' · Comprobante ' . $folio, $stamp, 1
                    ];
                }

                $this->must($this->qCreatePayment([
                    'values' => ['sale_id', 'branch_id', 'user_id', 'turn_id', 'payment_method_id', 'amount', 'tendered_amount', 'change_amount', 'description', 'paid_at', 'active'],
                    'data'   => $data
                ]), 'applyReceipt payment');

                foreach ($parts as $part) {
                    if ($part['kind'] === 'credit') {
                        $this->saveCreditPayments($part['id'], $customerId, $turnId, [['method_id' => $method['id'], 'amount' => $part['pay']]], $stamp, 'Abono a crédito · Comprobante ' . $folio);
                    }

                    if ($part['state'] !== $part['status']) {
                        $this->must($this->qUpdateOrder([
                            'values' => ['sale_status_id', 'updated_at = NOW()'],
                            'where'  => ['id'],
                            'data'   => [$part['state'], $part['id']]
                        ]), 'applyReceipt status');
                    }

                    $this->log(
                        $part['id'],
                        'payment',
                        $part['title'],
                        $method['name'] . ' ' . money($part['pay']) . " por el comprobante {$folio} que mandó el cliente. " . $this->leftText($part['after'], $part['kind'])
                    );
                }

                $this->must($this->qUpdateReceipt([
                    'values' => ['status', 'sale_id', 'applied_amount', 'payment_method_id', 'turn_id', 'reviewed_user_id', 'reviewed_at', 'updated_at'],
                    'where'  => ['id'],
                    'data'   => ['applied', $target > 0 ? $target : null, $amount, $method['id'], $turnId, $this->userId() ?: null, $stamp, $stamp, $id]
                ]), 'applyReceipt receipt');

                // La cotizacion elegida empieza a deber con su anticipo.
                $quote = $queue[0]['quote'] ? $queue[0]['left'] : 0;
                $after = round($debts['debt'] + $quote - $amount, 2);
                $where = count($parts) === 1 ? " a {$parts[0]['folio']}" : ' en ' . count($parts) . ' folios';

                return $this->ok("Comprobante {$folio} abonado: " . money($amount) . $where . '.', [
                    'id'     => $id,
                    'paid'   => $amount,
                    'folios' => array_column($parts, 'folio'),
                    'debt'   => max($after, 0),
                    'detail' => $after <= 0.005 ? "{$name} quedó al corriente en esta sucursal." : "{$name} todavía debe " . money($after) . '.'
                ]);
            });
        }, 'No se pudo abonar el comprobante.');

        $this->rememberToken($token, $answer);

        return $answer;
    }

    // -- Rechazar --

    public function rejectReceipt() {
        $fail = $this->needClients('show') ?: $this->needBranch() ?: $this->needReview();
        if ($fail) return $fail;

        $id     = $this->postId();
        $token  = $this->post('token');
        $reason = trim((string) preg_replace('/\s+/u', ' ', $this->post('reason')));

        $again = $this->tokenResult($token);
        if ($again) return $again;

        if ($id <= 0)                                  return $this->fail(422, 'Falta el comprobante.');
        if ($reason === '')                            return $this->fail(422, 'Escribe el motivo: el cliente lo va a leer.');
        if ($this->tooLong($reason, self::MAX_REASON)) return $this->fail(422, 'El motivo admite hasta ' . self::MAX_REASON . ' caracteres.');

        $answer = $this->attempt(function () use ($id, $reason) {
            return $this->transaction(function () use ($id, $reason) {
                $locked = $this->qLockReceipt($id, $this->branchId());

                if (!$locked)                        return $this->fail(404, 'Ese comprobante no existe en esta sucursal.');
                if ($locked['status'] !== 'pending') return $this->fail(409, 'Otra persona ya revisó este comprobante. Recarga la lista.');

                $stamp = date('Y-m-d H:i:s');

                $this->must($this->qUpdateReceipt([
                    'values' => ['status', 'reject_reason', 'reviewed_user_id', 'reviewed_at', 'updated_at'],
                    'where'  => ['id'],
                    'data'   => ['rejected', $reason, $this->userId() ?: null, $stamp, $stamp, $id]
                ]), 'rejectReceipt');

                return $this->ok('Comprobante ' . $this->receiptFolio($id) . ' rechazado. El cliente verá el motivo en su enlace.', ['id' => $id]);
            });
        }, 'No se pudo rechazar el comprobante.');

        $this->rememberToken($token, $answer);

        return $answer;
    }

    // -- Enlace del cliente --

    // El enlace del cliente en la sucursal. La primera vez se crea.
    public function getPortalLink() {
        $fail = $this->needClients('show') ?: $this->needBranch();
        if ($fail) return $fail;

        $id = $this->postId();
        if ($id <= 0) return $this->fail(422, 'Falta el cliente.');

        return $this->attempt(function () use ($id) {
            $customer = $this->linkCustomer($id);
            if (isset($customer['status'])) return $customer;

            $portal = $this->qPortal($id, $this->branchId()) ?: $this->openPortal($id);

            return $this->linkAnswer($customer, $portal, '');
        }, 'No se pudo preparar el enlace.');
    }

    // Cambia el token: el enlace anterior deja de abrir.
    public function newPortalLink() {
        $fail = $this->needClients('update') ?: $this->needBranch();
        if ($fail) return $fail;

        $id = $this->postId();
        if ($id <= 0) return $this->fail(422, 'Falta el cliente.');

        return $this->attempt(function () use ($id) {
            $customer = $this->linkCustomer($id);
            if (isset($customer['status'])) return $customer;

            $portal = $this->qPortal($id, $this->branchId());

            if (!$portal) return $this->linkAnswer($customer, $this->openPortal($id), 'Enlace listo.');

            $this->must($this->qUpdatePortal([
                'values' => ['token', 'updated_at'],
                'where'  => ['id'],
                'data'   => [$this->freshPortalToken(), date('Y-m-d H:i:s'), (int) $portal['id']]
            ]), 'newPortalLink');

            return $this->linkAnswer($customer, $this->qPortal($id, $this->branchId()), 'Enlace nuevo listo: el anterior ya no abre.');
        }, 'No se pudo cambiar el enlace.');
    }

    // -- Complements --

    private function needClients($action) {
        if (Permission::can(self::CLIENTS, $action)) return null;

        $what = [
            'show'   => 'ver clientes',
            'update' => 'editar clientes'
        ];

        $text = isset($what[$action]) ? $what[$action] : 'hacer esto';

        return ['status' => 403, 'message' => "Tu rol no tiene permiso para {$text} en esta sucursal.", 'row' => []];
    }

    // Revisar es cobrar: pedidos o ventas.
    private function needReview() {
        if (Permission::can(self::SECTION, 'create') || Permission::can(self::SALES, 'create')) return null;

        return ['status' => 403, 'message' => 'Tu rol no tiene permiso para cobrar, así que no puede abonar ni rechazar comprobantes.', 'row' => []];
    }

    // Con que entra un comprobante: lo que no es efectivo. Monedero ya no viene de qPaymentMethods.
    private function receiptMethods() {
        $methods = [];

        foreach ($this->qPaymentMethods($this->branchId()) as $row) {
            if ((int) $row['is_cash'] === 1 || $this->isWalletCode($row['code'])) continue;

            $methods[] = ['id' => (int) $row['id'], 'name' => (string) $row['name'], 'code' => (string) $row['code']];
        }

        return $methods;
    }

    // Transferencia si la hay; si no, el primero.
    private function defaultMethod(array $methods) {
        foreach ($methods as $method) {
            if (strtoupper($method['code']) === 'TRANSFER') return $method['id'];
        }

        return $methods ? $methods[0]['id'] : 0;
    }

    /*  Los folios en el orden en que reciben: el elegido primero y luego lo que
        debe, del mas viejo al mas nuevo. Solo los bloqueados ($sales, id => i):
        uno que nacio mientras tanto queda para el siguiente abono. */
    private function applyQueue(array $debts, array $sales, $target) {
        $chosen = null;

        if ($target > 0) {
            foreach ($debts['items'] as $sale) {
                if ($sale['id'] === $target && isset($sales[$sale['id']])) $chosen = $sale + ['quote' => false];
            }

            foreach ($debts['quotes'] as $sale) {
                if ($sale['id'] === $target && isset($sales[$sale['id']])) $chosen = $sale + ['quote' => true];
            }

            if (!$chosen) return $this->fail(409, 'Ese folio ya no tiene saldo para abonar. Elige otro o «Todo lo que debe».');
        }

        $queue = $chosen ? [$chosen] : [];

        foreach ($debts['items'] as $sale) {
            if (!isset($sales[$sale['id']]) || ($chosen && $sale['id'] === $chosen['id'])) continue;

            $queue[] = $sale + ['quote' => false];
        }

        return $queue;
    }

    // El abono repartido: cuanto recibe cada folio, como queda y como se llama su pago.
    private function applyParts(array $queue, $amount) {
        $parts = [];
        $rest  = $amount;

        foreach ($queue as $sale) {
            if ($rest <= 0.005) break;

            $pay  = round(min($rest, $sale['left']), 2);
            $rest = round($rest - $pay, 2);

            if ($sale['kind'] === 'order') {
                $paid  = round($sale['paid'] + $pay, 2);
                $title = $paid + 0.005 >= $sale['total'] ? 'Liquidación' : ($sale['paid'] <= 0 ? 'Anticipo' : 'Abono');

                $parts[] = $sale + [
                    'pay'     => $pay,
                    'after'   => round($sale['total'] - $paid, 2),
                    'title'   => $title,
                    'concept' => $title,
                    'state'   => $this->statusFor($sale['total'], $paid)
                ];

                continue;
            }

            $after = round($sale['left'] - $pay, 2);

            $parts[] = $sale + [
                'pay'     => $pay,
                'after'   => $after,
                'title'   => $after <= 0.005 ? 'Liquidación' : 'Abono a crédito',
                'concept' => 'Abono a crédito',
                'state'   => $after <= 0.005 ? self::PAID : self::PENDING
            ];
        }

        return $parts;
    }

    private function leftText($left, $kind) {
        if ($kind === 'credit') return $left <= 0.005 ? 'Venta liquidada.' : 'Resta ' . money($left) . '.';

        return $left <= 0.005 ? 'Queda pagado.' : 'Saldo: ' . money($left) . '.';
    }

    private function customerName($name) {
        $name = trim((string) $name);

        return $name !== '' ? $name : 'El cliente';
    }

    // El cliente de la empresa y activo, o la respuesta de error. Inactivo, su enlace no abre.
    private function linkCustomer($id) {
        $customer = $this->qBranchCustomer($id, $this->branchId());

        if (!$customer)                      return $this->fail(404, 'Ese cliente no es de esta empresa o ya no existe.');
        if ((int) $customer['active'] !== 1) return $this->fail(409, 'El cliente está inactivo: actívalo para compartir su enlace.');

        return $customer;
    }

    // La primera vez: la fila del enlace. Si dos personas lo piden a la vez, la segunda lee la de la primera.
    private function openPortal($customerId) {
        $stamp = date('Y-m-d H:i:s');

        try {
            $result = $this->qCreatePortal([
                'values' => ['customer_id', 'branch_id', 'token', 'created_at', 'updated_at'],
                'data'   => [$customerId, $this->branchId(), $this->freshPortalToken(), $stamp, $stamp]
            ]);
        } catch (Throwable $e) {
            $result = $e->getMessage();
        }

        $portal = $this->qPortal($customerId, $this->branchId());

        if (!$portal) $this->must($result, 'openPortal');

        return $portal;
    }

    private function freshPortalToken() {
        for ($i = 0; $i < 5; $i++) {
            $token = bin2hex(random_bytes(16));

            if (!$this->qPortalTokenTaken($token)) return $token;
        }

        throw new RuntimeException('freshPortalToken: sin token libre');
    }

    // El mismo armado que storeLink (ctrl-tienda): app/order/portal.php?t=...
    private function portalLink($token) {
        $https = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') || strtolower((string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '')) === 'https';
        $host  = (string) ($_SERVER['HTTP_HOST'] ?? 'localhost');
        $base  = rtrim(str_replace('\\', '/', dirname(dirname((string) ($_SERVER['SCRIPT_NAME'] ?? '/')))), '/');

        return ($https ? 'https' : 'http') . '://' . $host . $base . '/portal.php?t=' . rawurlencode($token);
    }

    private function linkAnswer($customer, $portal, $message) {
        $debts = $this->portalDebts((int) $customer['id'], $this->branchId(), date('Y-m-d'));
        $name  = trim((string) $customer['name']);

        return $this->ok($message, [
            'link'      => $this->portalLink($portal['token']),
            'since'     => dmy($portal['updated_at']),
            'can_renew' => Permission::can(self::CLIENTS, 'update'),
            'branch'    => $this->scope()['branch'],
            'customer'  => [
                'id'    => (int) $customer['id'],
                'name'  => $name !== '' ? $name : 'Sin nombre',
                'phone' => (string) $customer['phone']
            ],
            'debt'      => $debts['debt'],
            'folios'    => count($debts['items']),
            'quotes'    => count($debts['quotes'])
        ]);
    }

    // -- Formato --

    private function receiptRow(array $r) {
        $id     = (int) $r['id'];
        $status = (string) $r['status'];
        $names  = ['pending' => 'En revisión', 'applied' => 'Abonado', 'rejected' => 'Rechazado'];
        $name   = trim((string) $r['customer']);

        return [
            'id'            => $id,
            'folio'         => $this->receiptFolio($id),
            'customer_id'   => (int) $r['customer_id'],
            'customer'      => $name !== '' ? $name : 'Sin nombre',
            'phone'         => (string) $r['phone'],
            'sale_id'       => (int) $r['sale_id'],
            'target'        => $this->receiptTarget($r['sale_id'], $r['sale_type_id']),
            'amount'        => round((float) $r['amount'], 2),
            'note'          => (string) $r['note'],
            'kind'          => $r['mime'] === 'application/pdf' ? 'pdf' : 'image',
            'file_url'      => 'ctrl/comprobante.php?id=' . $id,
            'file_name'     => (string) $r['file_name'],
            'size'          => $this->sizeText((int) $r['size']),
            'status'        => $status,
            'status_text'   => isset($names[$status]) ? $names[$status] : $status,
            'reject_reason' => (string) $r['reject_reason'],
            'applied'       => $r['applied_amount'] !== null ? round((float) $r['applied_amount'], 2) : null,
            'method'        => (string) $r['method'],
            'turn_folio'    => (string) $r['turn_folio'],
            'reviewer'      => trim((string) $r['reviewer']),
            'created_at'    => (string) $r['created_at'],
            'reviewed_at'   => (string) ($r['reviewed_at'] ?? '')
        ];
    }

    private function debtRow(array $sale, $quote) {
        return [
            'id'    => $sale['id'],
            'kind'  => $sale['kind'],
            'folio' => $sale['folio'],
            'quote' => $quote,
            'total' => $sale['total'],
            'paid'  => $sale['paid'],
            'left'  => $sale['left'],
            'date'  => dmy($sale['date'])
        ];
    }

    private function sizeText($bytes) {
        $kb = $bytes / 1024;

        return $kb >= 1024 ? number_format($kb / 1024, 1) . ' MB' : max(1, (int) round($kb)) . ' KB';
    }
}

Permission::dispatch(new ctrl(), ctrl::CLIENTS);
