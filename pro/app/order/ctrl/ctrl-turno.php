<?php
require_once __DIR__ . '/../../../core/security/_Session.php';
if (empty($_POST['opc'])) exit(0);

require_once __DIR__ . '/core-order.php';

/*  Pedidos › turno de caja: abrir, corte Z y reabrir.

    Reglas que no se ven en el codigo de un vistazo:
      - Un solo turno abierto por sucursal. Abrir pide el fondo inicial (puede ser $0).
      - Esperado en caja = fondo + pagos en efectivo del turno (payment.turn_id).
      - Vendido = total de pedidos y ventas del turno en Pendiente o Pagado.
      - El corte Z congela el turno: guarda contado, esperado y vendido en turn y
        rehace sus renglones de turn_payment (por metodo) y turn_status (por estado).
      - Un turno de otro dia se puede cerrar; crear y cobrar lo piden cerrado.
      - Reabrir: solo el ultimo turno de la sucursal, abierto HOY, sin otro abierto,
        con motivo. El motivo se acumula en reopen_reason con fecha y hora.
      - Dia de caja (ctrl-cierre): con el dia de hoy cerrado o un dia anterior sin
        cerrar no se abre turno; con el dia cerrado tampoco se reabre uno.
      - Un turno cerrado se lee de su foto (turn y turn_status), no en vivo: un
        pedido que se cobra, edita o cancela despues no mueve su corte. Si lo vivo
        ya no coincide, la vista lo avisa (changed) y Recalcular rehace la foto.
      - Recalcular: turno cerrado y su dia sin cerrar. Lo contado, las fechas y
        quien cerro no cambian. La nota queda en reopen_reason con fecha y hora.

    Permisos: abrir y cerrar = create (la cajera). Reabrir y recalcular = cancel (Dueño, Supervisor). */
class ctrl extends core {

    const MAX_CASH = 1000000;

    // -- Lectura --

    // Sin id: el turno abierto; si no hay, el ultimo cerrado.
    public function getTurn() {
        $fail = ($this->post('detail') === '1' ? $this->needTickets() : $this->need('show')) ?: $this->needBranch();
        if ($fail) return $fail;

        $id = $this->postId();

        return $this->attempt(function () use ($id) {
            $branchId = $this->branchId();
            $open     = $this->qOpenTurn($branchId);

            if ($id > 0) {
                $turn = $this->qGetTurn($id, $branchId);

                if (!$turn) return $this->fail(404, "El turno {$id} no existe en " . $this->scope()['branch'] . '.');
            } else {
                $turn = $open ? $this->qGetTurn((int) $open['id'], $branchId) : $this->qLastTurn($branchId);
            }

            return [
                'status' => 200,
                'branch' => $this->scope()['branch'],
                'user'   => isset($_SESSION['user']) ? trim((string) $_SESSION['user']) : '',
                'today'  => date('Y-m-d'),
                'turn'   => $turn ? $this->turnView($turn) : null,
                'detail' => $turn && $this->post('detail') === '1' ? $this->cutDetail([(int) $turn['id']]) : null,
                'brief'  => $this->turnBrief(),
                'day'    => $this->dayBrief(),
                'can'    => $this->turnCan($turn, $open)
            ];
        }, 'No se pudo leer el turno.');
    }

    // -- Lista de turnos (visor de Cortes) --

    public function lsTurns() {
        $fail = $this->needTickets() ?: $this->needBranch();
        if ($fail) return $fail;

        return $this->attempt(function () {
            [$from, $to] = $this->postRange();

            $items   = array_map([$this, 'turnItem'], $this->qTurnList($this->branchId(), $from, $to));
            $changed = count(array_filter($items, function ($t) { return $t['changed']; }));

            return ['status' => 200, 'items' => $items, 'count' => count($items), 'changed' => $changed, 'branch' => $this->scope()['branch']];
        }, 'No se pudieron leer los turnos.');
    }

    /*  Un turno cerrado muestra lo vendido de su corte; 'live' es lo de hoy.
        changed: lo vivo ya no cuadra con el corte (aviso rápido; el modal compara todo). */
    private function turnItem($t) {
        $closed = $t['status'] !== 'open';
        $live   = round((float) $t['sold'], 2);
        $cut    = round((float) $t['total_sales'], 2);

        return [
            'id'           => (int) $t['id'],
            'folio'        => (string) $t['folio'],
            'closed'       => $closed,
            'opened_at'    => $t['opened_at'],
            'closed_at'    => $t['closed_at'],
            'opened_by'    => trim((string) $t['opened_by']),
            'closed_by'    => trim((string) $t['closed_by']),
            'opening_cash' => round((float) $t['opening_cash'], 2),
            'sold'         => $closed ? $cut : $live,
            'live'         => $live,
            'changed'      => $closed && abs($live - $cut) >= 0.005,
            'difference'   => $closed ? round((float) $t['counted_cash'] - (float) $t['expected_cash'], 2) : null,
            'reopened'     => !empty($t['reopened_at']),
            'day_closed'   => (int) $t['day_closed'] > 0
        ];
    }

    private function turnView($turn) {
        $id      = (int) $turn['id'];
        $closed  = $turn['status'] !== 'open';
        $opening = (float) $turn['opening_cash'];
        $stats   = $this->turnStats($id, $opening);

        $totals = $closed
            ? ['total_sales' => (float) $turn['total_sales'], 'orders_count' => (int) $turn['orders_count'], 'sales_count' => (int) $turn['sales_count']]
            : $stats['totals'];

        $expected = $closed ? (float) $turn['expected_cash'] : $stats['expected'];
        $counted  = $closed ? (float) $turn['counted_cash'] : null;
        $cut      = $closed ? $this->cutStatuses($id) : [];
        $changed  = $closed ? $this->turnDrift($turn, $stats, $cut) : null;

        return [
            'id'            => $id,
            'folio'         => (string) $turn['folio'],
            'status'        => (string) $turn['status'],
            'closed'        => $closed,
            'old'           => substr((string) $turn['opened_at'], 0, 10) !== date('Y-m-d'),
            'opened_at'     => $turn['opened_at'],
            'closed_at'     => $turn['closed_at'],
            'reopened_at'   => $turn['reopened_at'],
            'opened_by'     => trim((string) $turn['opened_by']),
            'closed_by'     => trim((string) $turn['closed_by']),
            'reopened_by'   => trim((string) $turn['reopened_by']),
            'reopen_reason' => (string) $turn['reopen_reason'],
            'opening_cash'  => $opening,
            'cash_sales'    => $stats['cash_sales'],
            'collected'     => $stats['collected'],
            'expected_cash' => $expected,
            'counted_cash'  => $counted,
            'difference'    => $closed ? round($counted - $expected, 2) : null,
            'total_sales'   => round((float) $totals['total_sales'], 2),
            'orders_count'  => (int) $totals['orders_count'],
            'sales_count'   => (int) $totals['sales_count'],
            'methods'       => $stats['methods'],
            'statuses'      => $changed ? $cut : $stats['statuses'],
            'changed'       => $changed
        ];
    }

    // La foto por estado del corte Z. orders = null: turn_status no guarda cuántos.
    private function cutStatuses($turnId) {
        return array_map(function ($row) {
            return ['id' => $row['id'], 'name' => $row['name'], 'orders' => null, 'amount' => round((float) $row['amount'], 2)];
        }, $this->qTurnCutStatuses($turnId));
    }

    /*  null = el corte coincide con sus pedidos. Si no, las cifras en vivo
        (vendido, conteos y esperado) para avisar y para recalcular. */
    private function turnDrift($turn, $stats, $cut) {
        $live = [
            'total_sales'   => round((float) $stats['totals']['total_sales'], 2),
            'orders_count'  => (int) $stats['totals']['orders_count'],
            'sales_count'   => (int) $stats['totals']['sales_count'],
            'expected_cash' => $stats['expected']
        ];

        $same = abs($live['total_sales'] - (float) $turn['total_sales']) < 0.005
            && $live['orders_count'] === (int) $turn['orders_count']
            && $live['sales_count'] === (int) $turn['sales_count']
            && abs($live['expected_cash'] - (float) $turn['expected_cash']) < 0.005
            && $this->amountsById($stats['statuses']) == $this->amountsById($cut);

        return $same ? null : $live;
    }

    // [estado => importe] sin renglones en cero, para comparar la foto con lo vivo.
    private function amountsById($rows) {
        $amounts = [];

        foreach ($rows as $row) {
            if (abs((float) $row['amount']) >= 0.005) $amounts[(int) $row['id']] = round((float) $row['amount'], 2);
        }

        ksort($amounts);

        return $amounts;
    }

    // Lo que se calcula en vivo de payment y sale.
    private function turnStats($turnId, $opening) {
        $methods   = $this->qTurnMethods($turnId);
        $cash      = 0;
        $collected = 0;

        foreach ($methods as &$method) {
            $method['amount']   = round((float) $method['amount'], 2);
            $method['payments'] = (int) $method['payments'];
            $collected += $method['amount'];

            if ((int) $method['is_cash'] === 1) $cash += $method['amount'];
        }
        unset($method);

        $statuses = $this->qTurnStatuses($turnId);

        foreach ($statuses as &$status) {
            $status['amount'] = round((float) $status['amount'], 2);
            $status['orders'] = (int) $status['orders'];
        }
        unset($status);

        $totals = $this->qTurnTotals($turnId) ?: ['total_sales' => 0, 'orders_count' => 0, 'sales_count' => 0];

        return [
            'methods'    => $methods,
            'statuses'   => $statuses,
            'totals'     => $totals,
            'cash_sales' => round($cash, 2),
            'collected'  => round($collected, 2),
            'expected'   => round($opening + $cash, 2)
        ];
    }

    private function turnCan($turn, $open) {
        $create = $this->need('create') === null;
        $boss   = $this->need('cancel') === null;
        $reopen = $boss ? $this->reopenBlock($turn, $open) : 'Tu rol no puede reabrir turnos.';
        $recalc = $boss ? $this->recalcBlock($turn) : 'Tu rol no puede recalcular turnos.';
        $day    = $create && !$open ? $this->dayBlock() : '';

        return [
            'open'          => $create && !$open && $day === '',
            'open_reason'   => $day,
            'close'         => $create && $turn && $turn['status'] === 'open',
            'reopen'        => $reopen === '',
            'reopen_reason' => $reopen,
            'recalc'        => $recalc === '',
            'recalc_reason' => $recalc
        ];
    }

    // '' = se puede recalcular. Con el día cerrado su foto manda: primero se reabre el día.
    private function recalcBlock($turn) {
        if (!$turn || $turn['status'] !== 'closed') return 'El turno no está cerrado.';

        $day = substr((string) $turn['opened_at'], 0, 10);

        if ($this->dayClosedOn($day)) return 'El día ' . dmy($day) . ' ya se cerró: para recalcular este turno reabre primero el día.';

        return '';
    }

    // '' = se puede reabrir. Si no, el motivo en una frase.
    private function reopenBlock($turn, $open) {
        if (!$turn || $turn['status'] !== 'closed') return 'El turno no está cerrado.';
        if ($open) return 'Ya hay un turno abierto en esta sucursal.';
        if ((int) $turn['id'] !== $this->qLastTurnId($this->branchId())) return 'Solo se reabre el último turno de la sucursal.';
        if (substr((string) $turn['opened_at'], 0, 10) !== date('Y-m-d')) return 'Solo se reabre un turno que se abrió hoy.';
        if ($this->dayClosedToday()) return 'El día de hoy ya se cerró: reabre primero el día.';

        return '';
    }

    // -- Abrir --

    public function openTurn() {
        $fail = $this->need('create', 'abrir turnos') ?: $this->needBranch();
        if ($fail) return $fail;

        $token = $this->post('token');
        $again = $this->tokenResult($token);
        if ($again) return $again;

        $cash = $this->amountOf($this->post('opening_cash'), null);

        if ($cash === null)          return $this->fail(422, 'Escribe con cuánto efectivo empieza el turno (puede ser $0).');
        if ($cash > self::MAX_CASH) return $this->fail(422, 'El fondo inicial no puede pasar de ' . money(self::MAX_CASH) . '.');

        $answer = $this->attempt(function () use ($cash) {
            return $this->transaction(function () use ($cash) {
                $open = $this->qLockOpenTurn($this->branchId());

                if ($open) return $this->fail(409, 'Ya hay un turno abierto en esta sucursal (turno ' . $open['folio'] . ').');

                $day = $this->dayBlock();
                if ($day !== '') return $this->fail(409, $day);

                $this->must($this->qCreateTurn([
                    'values' => ['branch_id', 'user_id', 'opening_cash', 'status', 'active'],
                    'data'   => [$this->branchId(), $this->userId() ?: null, $cash, 'open', 1]
                ]), 'openTurn');

                $id = $this->qLastInsertId();

                $this->must($this->qUpdateTurn([
                    'values' => ['folio', 'opened_at = NOW()', 'updated_at = NOW()'],
                    'where'  => ['id'],
                    'data'   => [(string) $id, $id]
                ]), 'openTurn folio');

                return $this->ok("Turno {$id} abierto con " . money($cash) . ' de fondo.', ['id' => $id]);
            });
        }, 'No se pudo abrir el turno.');

        if ($answer['status'] === 200) $answer['brief'] = $this->turnBrief();

        $this->rememberToken($token, $answer);

        return $answer;
    }

    // -- Cerrar (corte Z) --

    public function closeTurn() {
        $fail = $this->need('create', 'cerrar turnos') ?: $this->needBranch();
        if ($fail) return $fail;

        $id    = $this->postId();
        $token = $this->post('token');

        $again = $this->tokenResult($token);
        if ($again) return $again;

        $counted = $this->amountOf($this->post('counted_cash'), null);

        if ($id <= 0)                   return $this->fail(422, 'Falta el turno.');
        if ($counted === null)          return $this->fail(422, 'Escribe cuánto efectivo contaste en caja (puede ser $0).');
        if ($counted > self::MAX_CASH) return $this->fail(422, 'El efectivo contado no puede pasar de ' . money(self::MAX_CASH) . '.');

        $answer = $this->attempt(function () use ($id, $counted) {
            return $this->transaction(function () use ($id, $counted) {
                $turn = $this->qLockTurn($id, $this->branchId());

                if (!$turn)                     return $this->fail(404, "El turno {$id} no existe en " . $this->scope()['branch'] . '.');
                if ($turn['status'] !== 'open') return $this->fail(409, 'El turno ' . $turn['folio'] . ' ya está cerrado.');

                $stats      = $this->turnStats($id, (float) $turn['opening_cash']);
                $totals     = $stats['totals'];
                $difference = round($counted - $stats['expected'], 2);

                $this->saveCutRows($id, $stats);

                $this->must($this->qUpdateTurn([
                    'values' => [
                        'counted_cash', 'expected_cash', 'total_sales', 'orders_count', 'sales_count',
                        'status', 'closed_at = NOW()', 'close_user_id', 'updated_at = NOW()'
                    ],
                    'where'  => ['id'],
                    'data'   => [
                        $counted, $stats['expected'], round((float) $totals['total_sales'], 2), (int) $totals['orders_count'], (int) $totals['sales_count'],
                        'closed', $this->userId() ?: null, $id
                    ]
                ]), 'closeTurn');

                return $this->ok('Turno ' . $turn['folio'] . ' cerrado. ' . $this->differenceText($difference), [
                    'id'         => $id,
                    'difference' => $difference
                ]);
            });
        }, 'No se pudo cerrar el turno.');

        if ($answer['status'] === 200) $answer['brief'] = $this->turnBrief();

        $this->rememberToken($token, $answer);

        return $answer;
    }

    private function differenceText($difference) {
        if (abs($difference) < 0.005) return 'La caja cuadra.';

        return ($difference > 0 ? 'Sobran ' : 'Faltan ') . money(abs($difference)) . '.';
    }

    // Rehace los renglones de la foto: apaga los de antes y escribe por método y por estado.
    private function saveCutRows($id, $stats) {
        $this->must($this->qUpdateTurnPayment([
            'values' => ['active', 'updated_at = NOW()'],
            'where'  => ['turn_id'],
            'data'   => [0, $id]
        ]), 'saveCutRows turn_payment');

        $this->must($this->qUpdateTurnStatus([
            'values' => ['active', 'updated_at = NOW()'],
            'where'  => ['turn_id'],
            'data'   => [0, $id]
        ]), 'saveCutRows turn_status');

        $byMethod = [];

        foreach ($stats['methods'] as $method) {
            $byMethod[] = [$id, $method['id'] !== null ? (int) $method['id'] : null, $method['amount'], 1];
        }

        if ($byMethod) {
            $this->must($this->qCreateTurnPayment([
                'values' => ['turn_id', 'payment_method_id', 'amount', 'active'],
                'data'   => $byMethod
            ]), 'saveCutRows turn_payment insert');
        }

        $byStatus = [];

        foreach ($stats['statuses'] as $status) {
            $byStatus[] = [$id, $status['id'] !== null ? (int) $status['id'] : null, $status['amount'], 1];
        }

        if ($byStatus) {
            $this->must($this->qCreateTurnStatus([
                'values' => ['turn_id', 'sale_status_id', 'amount', 'active'],
                'data'   => $byStatus
            ]), 'saveCutRows turn_status insert');
        }
    }

    // -- Recalcular --

    public function recalcTurn() {
        $fail = $this->need('cancel', 'recalcular turnos') ?: $this->needBranch();
        if ($fail) return $fail;

        $id    = $this->postId();
        $token = $this->post('token');

        $again = $this->tokenResult($token);
        if ($again) return $again;

        if ($id <= 0) return $this->fail(422, 'Falta el turno.');

        $answer = $this->attempt(function () use ($id) {
            return $this->transaction(function () use ($id) {
                $turn = $this->qLockTurn($id, $this->branchId());

                if (!$turn) return $this->fail(404, "El turno {$id} no existe en " . $this->scope()['branch'] . '.');

                $block = $this->recalcBlock($turn);
                if ($block !== '') return $this->fail(409, $block);

                $stats = $this->turnStats($id, (float) $turn['opening_cash']);
                $live  = $this->turnDrift($turn, $stats, $this->cutStatuses($id));

                if (!$live) return $this->ok('El turno ' . $turn['folio'] . ' ya coincide con sus pedidos.', ['id' => $id, 'unchanged' => true]);

                $this->saveCutRows($id, $stats);

                $note  = 'Recalculado: vendido ' . money($turn['total_sales']) . ' » ' . money($live['total_sales']);
                $note .= abs($live['expected_cash'] - (float) $turn['expected_cash']) >= 0.005
                    ? ' · esperado ' . money($turn['expected_cash']) . ' » ' . money($live['expected_cash'])
                    : '';

                $stamp = date('d/m/Y g:i A') . ' · ' . $note;
                $prior = trim((string) $turn['reopen_reason']);
                $notes = $prior === '' ? $stamp : $prior . "\n" . $stamp;

                $this->must($this->qUpdateTurn([
                    'values' => ['expected_cash', 'total_sales', 'orders_count', 'sales_count', 'reopen_reason', 'updated_at = NOW()'],
                    'where'  => ['id'],
                    'data'   => [$live['expected_cash'], $live['total_sales'], $live['orders_count'], $live['sales_count'], $notes, $id]
                ]), 'recalcTurn');

                return $this->ok('Turno ' . $turn['folio'] . ' recalculado. ' . $note . '.', ['id' => $id]);
            });
        }, 'No se pudo recalcular el turno.');

        $this->rememberToken($token, $answer);

        return $answer;
    }

    // -- Reabrir --

    public function reopenTurn() {
        $fail = $this->need('cancel', 'reabrir turnos') ?: $this->needBranch();
        if ($fail) return $fail;

        $id     = $this->postId();
        $reason = trim((string) preg_replace('/\s+/u', ' ', $this->post('reason')));

        if ($id <= 0)                     return $this->fail(422, 'Falta el turno.');
        if ($reason === '')               return $this->fail(422, 'Escribe por qué se reabre el turno.');
        if ($this->tooLong($reason, 200)) return $this->fail(422, 'El motivo admite hasta 200 caracteres.');

        $answer = $this->attempt(function () use ($id, $reason) {
            return $this->transaction(function () use ($id, $reason) {
                $turn = $this->qLockTurn($id, $this->branchId());

                if (!$turn) return $this->fail(404, "El turno {$id} no existe en " . $this->scope()['branch'] . '.');

                $block = $this->reopenBlock($turn, $this->qLockOpenTurn($this->branchId()));
                if ($block !== '') return $this->fail(409, $block);

                $stamp = date('d/m/Y g:i A') . ' · ' . $reason;
                $prior = trim((string) $turn['reopen_reason']);
                $notes = $prior === '' ? $stamp : $prior . "\n" . $stamp;

                $this->must($this->qUpdateTurn([
                    'values' => ['status', 'reopened_at = NOW()', 'reopened_user_id', 'reopen_reason', 'closed_at', 'close_user_id', 'updated_at = NOW()'],
                    'where'  => ['id'],
                    'data'   => ['open', $this->userId() ?: null, $notes, null, null, $id]
                ]), 'reopenTurn');

                return $this->ok('Turno ' . $turn['folio'] . ' reabierto.', ['id' => $id]);
            });
        }, 'No se pudo reabrir el turno.');

        if ($answer['status'] === 200) $answer['brief'] = $this->turnBrief();

        return $answer;
    }
}

// La lista y el modo Detallado son del visor de Cortes: entran por pos-tickets.
$opc   = isset($_POST['opc']) ? (string) $_POST['opc'] : '';
$visor = $opc === 'lsTurns' || ($opc === 'getTurn' && ($_POST['detail'] ?? '') === '1');

Permission::dispatch(new ctrl(), $visor ? core::TICKETS : core::SECTION);
