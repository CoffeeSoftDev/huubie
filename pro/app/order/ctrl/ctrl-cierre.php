<?php
require_once __DIR__ . '/../../../core/security/_Session.php';
if (empty($_POST['opc'])) exit(0);

require_once __DIR__ . '/core-order.php';

/*  Pedidos › cierre del día: ver, cerrar y reabrir.

    Reglas que no se ven en el código de un vistazo:
      - El día de un turno es el día en que se abrió. Un día = sus turnos.
      - Vendido del día = pedidos y ventas de esos turnos en Pendiente o Pagado.
      - Cobrado del día = pagos que entraron en esos turnos, de cualquier pedido.
        Origen 'venta' si el pedido es de ese mismo día; 'abono' si es de otro.
      - Cerrar pide al menos un turno y todos cerrados. Hoy no se cierra si
        falta cerrar un día anterior (ventana de 15 días, como alpha).
      - El cierre guarda una foto en daily_closure (+ _payment y _status) y
        liga turn.daily_closure_id y sale.daily_closure_id.
      - Reabrir no borra: marca reopened_at en ese renglón y suelta las ligas.
        Cerrar otra vez crea un renglón nuevo (así viene la historia de alpha).
      - Solo se reabre el último día cerrado y si no hay turnos en días posteriores.
      - total_shifts es un CONTEO de turnos (así lo dejó alpha); turns_count también.

    Permisos: cerrar = create (la cajera). Reabrir = cancel (Dueño, Supervisor). */
class ctrl extends core {

    // -- Lectura --

    // Sin fecha: hoy. Un día cerrado se lee de su foto; uno abierto, en vivo.
    public function getDay() {
        $fail = $this->need('show') ?: $this->needBranch();
        if ($fail) return $fail;

        $today = date('Y-m-d');
        $day   = $this->postDate('date', $today);

        if ($day > $today) return $this->fail(422, 'No se puede ver el cierre de un día que no ha llegado.');

        return $this->attempt(function () use ($day, $today) {
            $branchId    = $this->branchId();
            [$from, $to] = $this->dayRange($day);

            $closure = $this->qDayClosure($branchId, $from, $to);
            $turns   = $this->dayTurns($branchId, $from, $to);
            $pending = $this->pendingDays();

            return [
                'status'   => 200,
                'branch'   => $this->scope()['branch'],
                'today'    => $today,
                'date'     => $day,
                'closed'   => (bool) $closure,
                'closure'  => $closure ? $this->closureInfo($closure) : null,
                'summary'  => $closure ? $this->closureStats($closure) : $this->dayStats($branchId, $from, $to),
                'turns'    => $turns,
                'reopens'  => array_map([$this, 'closureInfo'], $this->qDayReopens($branchId, $from, $to)),
                'pending'  => $pending,
                'warnings' => $closure ? [] : $this->dayWarnings($day, $turns),
                'can'      => $this->dayCan($day, $closure, $turns, $pending),
                'brief'    => $this->turnBrief(),
                'day'      => $this->dayBrief()
            ];
        }, 'No se pudo leer el cierre del día.');
    }

    /*  Un turno cerrado muestra lo vendido de su corte; 'live' es lo de hoy si ya no cuadra.
        Esperado y contado solo existen en un turno cerrado (los guarda el corte Z). */
    private function dayTurns($branchId, $from, $to) {
        return array_map(function ($t) {
            $closed = $t['status'] !== 'open';
            $live   = round((float) $t['sold'], 2);
            $cut    = round((float) $t['total_sales'], 2);

            return [
                'id'            => (int) $t['id'],
                'folio'         => (string) $t['folio'],
                'closed'        => $closed,
                'opened_at'     => $t['opened_at'],
                'closed_at'     => $t['closed_at'],
                'opened_by'     => trim((string) $t['opened_by']),
                'sold'          => $closed ? $cut : $live,
                'live'          => $live,
                'changed'       => $closed && abs($live - $cut) >= 0.005,
                'collected'     => round((float) $t['collected'], 2),
                'opening_cash'  => round((float) $t['opening_cash'], 2),
                'expected_cash' => $closed ? round((float) $t['expected_cash'], 2) : null,
                'counted_cash'  => $closed ? round((float) $t['counted_cash'], 2) : null,
                'difference'    => $closed ? round((float) $t['counted_cash'] - (float) $t['expected_cash'], 2) : null
            ];
        }, $this->qDayTurns($branchId, $from, $to));
    }

    // -- Lista de cierres (pos-tickets) --

    public function lsDays() {
        $fail = $this->need('show') ?: $this->needBranch();
        if ($fail) return $fail;

        return $this->attempt(function () {
            [$from, $to] = $this->postRange();

            $rows = array_map([$this, 'closureRow'], $this->qClosureList($this->branchId(), $from, $to));

            return ['status' => 200, 'row' => $rows, 'count' => count($rows), 'branch' => $this->scope()['branch']];
        }, 'No se pudieron leer los cierres del día.');
    }

    // Cifras de la foto del cierre: no se mueven aunque un pedido cambie después.
    private function closureRow($c) {
        $info   = $this->closureInfo($c);
        $day    = substr((string) $c['closure_date'], 0, 10);
        $orders = (int) $c['orders_count'];
        $sales  = (int) $c['sales_count'];
        $off    = (int) $c['cancelled_count'];
        $note   = $info['note'] !== '' ? '<span class="block text-[11px] text-gray-400 truncate max-w-[220px]">' . h($info['note']) . '</span>' : '';

        return [
            'id'          => $info['id'],
            'Día'         => '<span class="font-semibold whitespace-nowrap">' . dmy($day) . '</span>' . $note,
            'Folio'       => '<span class="text-gray-600">' . h($info['folio']) . '</span>',
            'Turnos'      => $info['turns'],
            'Pedidos'     => $orders . ' · ' . $sales . ($off ? '<span class="block text-[11px] text-red-600 whitespace-nowrap">' . $off . ($off === 1 ? ' cancelado' : ' cancelados') . '</span>' : ''),
            'Vendido'     => '<span class="font-semibold">' . money($info['total']) . '</span>',
            'Efectivo'    => money($c['total_cash']),
            'Cerró'       => '<span class="text-gray-600 whitespace-nowrap">' . dmy($info['closed_at']) . ' · ' . hour12(substr((string) $info['closed_at'], 11)) . '</span><span class="block text-[11px] text-gray-400">' . h($info['closed_by'] ?: '—') . '</span>',
            'dropdown'    => [['icon' => 'icon-eye', 'text' => 'Ver cierre', 'onclick' => "orderClosure.open('{$day}')"]]
        ];
    }

    // Lo del día en vivo, con la misma forma que la foto de un cierre.
    private function dayStats($branchId, $from, $to) {
        $totals = $this->qDayTotals($branchId, $from, $to) ?: [];
        $get    = function ($key) use ($totals) {
            return isset($totals[$key]) ? $totals[$key] : 0;
        };

        return $this->summaryOf(
            $this->qDayMethods($branchId, $from, $to),
            $this->qDayStatuses($branchId, $from, $to),
            [
                'subtotal'        => (float) $get('subtotal'),
                'discount'        => (float) $get('discount'),
                'tip'             => (float) $get('tip'),
                'total'           => (float) $get('total'),
                'orders_count'    => (int) $get('orders_count'),
                'sales_count'     => (int) $get('sales_count'),
                'cancelled_count' => (int) $get('cancelled_count'),
                'first_folio'     => $get('first_id') ? (string) $get('first_id') : '',
                'last_folio'      => $get('last_id') ? (string) $get('last_id') : ''
            ]
        );
    }

    private function closureStats($closure) {
        return $this->summaryOf(
            $this->qClosureMethods((int) $closure['id']),
            $this->qClosureStatuses((int) $closure['id']),
            [
                'subtotal'        => (float) $closure['subtotal'],
                'discount'        => (float) $closure['discount'],
                'tip'             => (float) $closure['tip'],
                'total'           => (float) $closure['total'],
                'orders_count'    => (int) $closure['orders_count'],
                'sales_count'     => (int) $closure['sales_count'],
                'cancelled_count' => (int) $closure['cancelled_count'],
                'first_folio'     => (string) $closure['first_folio'],
                'last_folio'      => (string) $closure['last_folio']
            ]
        );
    }

    // Cobrado y efectivo salen de los renglones por método, vivos o de la foto.
    private function summaryOf($methods, $statuses, $base) {
        $collected = 0;
        $cash      = 0;

        foreach ($methods as &$method) {
            $method['amount']   = round((float) $method['amount'], 2);
            $method['payments'] = (int) $method['payments'];
            $collected += $method['amount'];

            if ((int) $method['is_cash'] === 1) $cash += $method['amount'];
        }
        unset($method);

        foreach ($statuses as &$status) {
            $status['amount'] = round((float) $status['amount'], 2);
            $status['orders'] = (int) $status['orders'];
        }
        unset($status);

        foreach (['subtotal', 'discount', 'tip', 'total'] as $key) $base[$key] = round($base[$key], 2);

        return array_merge($base, [
            'collected' => round($collected, 2),
            'cash'      => round($cash, 2),
            'methods'   => $methods,
            'statuses'  => $statuses
        ]);
    }

    private function closureInfo($closure) {
        $turns = (int) $closure['turns_count'] ?: (int) $closure['total_shifts'];

        return [
            'id'            => (int) $closure['id'],
            'folio'         => (string) $closure['folio'],
            'closed_at'     => $closure['created_at'],
            'closed_by'     => trim((string) $closure['closed_by']),
            'reopened_at'   => $closure['reopened_at'],
            'reopened_by'   => trim((string) $closure['reopened_by']),
            'reopen_reason' => (string) $closure['reopen_reason'],
            'note'          => (string) $closure['note'],
            'total'         => round((float) $closure['total'], 2),
            'turns'         => $turns
        ];
    }

    private function dayWarnings($day, $turns) {
        $warnings = [];
        $open     = array_filter($turns, function ($t) { return !$t['closed']; });

        if (!$turns) $warnings[] = 'No hubo turnos este día.';

        foreach ($open as $turn) {
            $warnings[] = 'El turno ' . $turn['folio'] . ' sigue abierto: ciérralo antes de cerrar el día.';
        }

        // Aviso, no candado: el día se cierra con lo vivo; recalcular deja turno y día iguales.
        foreach ($turns as $turn) {
            if (!$turn['changed']) continue;

            $warnings[] = 'El turno ' . $turn['folio'] . ' cambió después de su corte (' . money($turn['sold']) . ' » ' . money($turn['live']) . '): recalcúlalo para que cuadre con el día.';
        }

        $undelivered = $this->qDayUndelivered($this->branchId(), $day);

        if ($undelivered > 0) {
            $warnings[] = $undelivered . ($undelivered === 1 ? ' pedido con entrega este día sigue' : ' pedidos con entrega este día siguen') . ' sin entregar.';
        }

        return $warnings;
    }

    private function dayCan($day, $closure, $turns, $pending) {
        $create = $this->need('create') === null;
        $boss   = $this->need('cancel') === null;

        $close  = $create ? $this->closeBlock($day, $closure, $turns, $pending) : 'Tu rol no puede cerrar el día.';
        $reopen = $boss ? $this->dayReopenBlock($closure, $day) : 'Tu rol no puede reabrir el día.';

        return [
            'close'         => $close === '',
            'close_reason'  => $close,
            'reopen'        => $reopen === '',
            'reopen_reason' => $reopen
        ];
    }

    // '' = se puede cerrar. $turns trae 'folio' y 'closed' o 'status'.
    private function closeBlock($day, $closure, $turns, $pending) {
        if ($closure) return 'El día ya está cerrado.';
        if (!$turns)  return 'No hubo turnos este día: no hay nada que cerrar.';

        $open = [];

        foreach ($turns as $turn) {
            $isOpen = isset($turn['status']) ? $turn['status'] === 'open' : !$turn['closed'];

            if ($isOpen) $open[] = $turn['folio'];
        }

        if ($open) {
            return (count($open) === 1 ? 'Cierra primero el turno ' : 'Cierra primero los turnos ') . implode(', ', $open) . '.';
        }

        if ($day === date('Y-m-d') && $pending) {
            return 'Cierra primero el día ' . dmy($pending[0]['date']) . '.';
        }

        return '';
    }

    // '' = se puede reabrir.
    private function dayReopenBlock($closure, $day) {
        if (!$closure) return 'El día no está cerrado.';

        $branchId = $this->branchId();

        if ((int) $closure['id'] !== $this->qLastClosureId($branchId)) return 'Solo se reabre el último día cerrado de la sucursal.';
        if ($this->qTurnsAfter($branchId, $this->dayRange($day)[1]) > 0) return 'Ya hay turnos en días posteriores: este día ya no se reabre.';

        return '';
    }

    // -- Cerrar --

    public function closeDay() {
        $fail = $this->need('create', 'cerrar el día') ?: $this->needBranch();
        if ($fail) return $fail;

        $token = $this->post('token');
        $again = $this->tokenResult($token);
        if ($again) return $again;

        $today = date('Y-m-d');
        $day   = $this->postDate('date', '');
        $note  = trim((string) preg_replace('/\s+/u', ' ', $this->post('note')));
        $note  = $note === '' ? null : $note;

        if ($day === '')                return $this->fail(422, 'Falta el día que se cierra.');
        if ($day > $today)              return $this->fail(422, 'No se puede cerrar un día que no ha llegado.');
        if ($this->tooLong($note, 255)) return $this->fail(422, 'La nota admite hasta 255 caracteres.');

        $answer = $this->attempt(function () use ($day, $today, $note) {
            return $this->transaction(function () use ($day, $today, $note) {
                $branchId    = $this->branchId();
                [$from, $to] = $this->dayRange($day);

                $turns = $this->qLockDayTurns($branchId, $from, $to);

                if ($this->qLockDayClosure($branchId, $from, $to)) return $this->fail(409, 'El día ' . dmy($day) . ' ya está cerrado.');

                $block = $this->closeBlock($day, null, $turns, $day === $today ? $this->pendingDays() : []);
                if ($block !== '') return $this->fail(409, $block);

                $stats   = $this->dayStats($branchId, $from, $to);
                $turnIds = array_map(function ($t) { return (int) $t['id']; }, $turns);

                $this->must($this->qCreateClosure([
                    'values' => [
                        'note', 'first_folio', 'last_folio', 'sales_count', 'cancelled_count', 'orders_count', 'turns_count',
                        'subtotal', 'discount', 'tax', 'tip', 'total', 'total_shifts', 'total_cash', 'cash_in', 'cash_out',
                        'closure_date', 'branch_id', 'user_id', 'active'
                    ],
                    'data'   => [
                        $note, $stats['first_folio'] ?: null, $stats['last_folio'] ?: null,
                        $stats['sales_count'], $stats['cancelled_count'], $stats['orders_count'], count($turnIds),
                        $stats['subtotal'], $stats['discount'], 0, $stats['tip'], $stats['total'], count($turnIds), $stats['cash'], 0, 0,
                        $from, $branchId, $this->userId() ?: null, 1
                    ]
                ]), 'closeDay');

                $id = $this->qLastInsertId();

                $this->must($this->qUpdateClosure([
                    'values' => ['folio', 'updated_at = NOW()'],
                    'where'  => ['id'],
                    'data'   => [(string) $id, $id]
                ]), 'closeDay folio');

                $byMethod = [];

                foreach ($stats['methods'] as $method) {
                    $byMethod[] = [$id, $method['id'] !== null ? (int) $method['id'] : null, $method['source'], $method['payments'], $method['amount'], 0, 1];
                }

                if ($byMethod) {
                    $this->must($this->qCreateClosurePayment([
                        'values' => ['daily_closure_id', 'payment_method_id', 'source', 'payments_count', 'amount', 'tip', 'active'],
                        'data'   => $byMethod
                    ]), 'closeDay daily_closure_payment');
                }

                $byStatus = [];

                foreach ($stats['statuses'] as $status) {
                    $byStatus[] = [$id, $status['id'] !== null ? (int) $status['id'] : null, $status['amount'], 1];
                }

                if ($byStatus) {
                    $this->must($this->qCreateClosureStatus([
                        'values' => ['daily_closure_id', 'sale_status_id', 'amount', 'active'],
                        'data'   => $byStatus
                    ]), 'closeDay daily_closure_status');
                }

                $this->must($this->qLinkClosure($id, $turnIds), 'closeDay ligas');

                return $this->ok('Día ' . dmy($day) . ' cerrado: ' . money($stats['total']) . ' vendido y ' . money($stats['collected']) . ' cobrado.', [
                    'id' => $id
                ]);
            });
        }, 'No se pudo cerrar el día.');

        if ($answer['status'] === 200) {
            $answer['brief'] = $this->turnBrief();
            $answer['day']   = $this->dayBrief();
        }

        $this->rememberToken($token, $answer);

        return $answer;
    }

    // -- Reabrir --

    public function reopenDay() {
        $fail = $this->need('cancel', 'reabrir el día') ?: $this->needBranch();
        if ($fail) return $fail;

        $day    = $this->postDate('date', '');
        $reason = trim((string) preg_replace('/\s+/u', ' ', $this->post('reason')));

        if ($day === '')                  return $this->fail(422, 'Falta el día que se reabre.');
        if ($reason === '')               return $this->fail(422, 'Escribe por qué se reabre el día.');
        if ($this->tooLong($reason, 200)) return $this->fail(422, 'El motivo admite hasta 200 caracteres.');

        $answer = $this->attempt(function () use ($day, $reason) {
            return $this->transaction(function () use ($day, $reason) {
                [$from, $to] = $this->dayRange($day);

                $closure = $this->qLockDayClosure($this->branchId(), $from, $to);

                $block = $this->dayReopenBlock($closure, $day);
                if ($block !== '') return $this->fail(409, $block);

                $id = (int) $closure['id'];

                $this->must($this->qUpdateClosure([
                    'values' => ['reopened_at = NOW()', 'reopened_user_id', 'reopen_reason', 'updated_at = NOW()'],
                    'where'  => ['id'],
                    'data'   => [$this->userId() ?: null, $reason, $id]
                ]), 'reopenDay');

                $this->must($this->qUnlinkClosure($id), 'reopenDay ligas');

                return $this->ok('Día ' . dmy($day) . ' reabierto.', ['id' => $id]);
            });
        }, 'No se pudo reabrir el día.');

        if ($answer['status'] === 200) {
            $answer['brief'] = $this->turnBrief();
            $answer['day']   = $this->dayBrief();
        }

        return $answer;
    }
}

Permission::dispatch(new ctrl(), core::SECTION);
