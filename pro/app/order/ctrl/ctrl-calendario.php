<?php
require_once __DIR__ . '/../../../core/security/_Session.php';
if (empty($_POST['opc'])) exit(0);

require_once __DIR__ . '/core-order.php';

/*  Pedidos › Calendario (Etapa 4: producir y entregar). Como alpha.

    Reglas que no se ven en el codigo de un vistazo:
      - La seccion es pos-calendario: entra quien la vea, aunque no vea Pedidos
        (Produccion). El detalle lo sirve este ctrl con el mismo armado que Pedidos.
      - Palomear «ya se elaboro» pide 'update' del CALENDARIO (Produccion) o
        ser el Dueño (core::isOwner). Solo llena produced_at y quien; no cambia la entrega.
      - Entregar pide 'update' de PEDIDOS, sin saldo (decision 5: el saldo se
        cobra al entregar; la pantalla encadena cobro y entrega) y la contraseña
        de quien entrega (core::needKey).
      - «Editar entrega» (fecha, hora, tipo, direccion y nota) tambien se hace
        desde aqui: pide 'update' de PEDIDOS (core::editDelivery). Un pagado lo
        edita Dueño o Supervisor, con su contraseña.
      - Quien no ve Pedidos ve solo pendientes y pagados: ni cotizaciones ni
        cancelados, como Produccion en alpha. Tampoco ve dinero: el calendario
        le llega sin total, abonado ni saldo, y el detalle sin importes, abonos
        ni los renglones de cobro de la bitacora (core::withoutMoney). */
class ctrl extends core {

    // CALENDAR ('pos-calendario') y producer() viven en core: el detalle de Pedidos también palomea.
    const RANGE_MAX = 62;

    // -- Arranque --

    public function init() {
        $scope = $this->scope();

        return [
            'status'   => 200,
            'scope'    => ['company' => $scope['company'], 'branch' => $scope['branch'], 'logo' => $this->companyLogo()],
            'actions'  => $this->actions(),
            'calendar' => Permission::actions(self::CALENDAR),
            'producer' => $this->producer(),
            'statuses' => $scope['company_id'] > 0 ? $this->qStatuses($scope['company_id']) : [],
            'today'    => date('Y-m-d'),
            'turn'     => $this->turnBrief(),
            'day'      => $this->dayBrief(),
            'all'      => $this->allOffer(self::CALENDAR)
        ];
    }

    // -- Calendario --

    /*  all = 1: los pedidos de todas las sucursales que el rol deja ver en el
        calendario. El dinero y las cotizaciones de cada una salen solo si ahí
        el rol ve Pedidos (la misma regla que la sucursal activa). */
    public function getCalendar() {
        $fail = $this->needCalendar('show') ?: $this->needBranch();
        if ($fail) return $fail;

        return $this->attempt(function () {
            [$fi, $ff] = $this->calendarRange();

            $active   = $this->branchId();
            $branches = $this->readBranches(self::CALENDAR);
            $limited  = $this->limited();
            $money    = count($branches) > 1 ? $this->viewBranches(self::SECTION) : [];
            $events   = [];

            foreach ($this->qCalendarOrders($branches, $fi, $ff) as $o) {
                $status  = (int) $o['sale_status_id'];
                $foreign = (int) $o['branch_id'] !== $active;
                $lim     = $foreign ? !isset($money[(int) $o['branch_id']]) : $limited;

                if ($lim && !in_array($status, [self::PENDING, self::PAID], true)) continue;

                $events[] = $this->event($o, $lim) + [
                    'branch'   => (string) $o['branch'],
                    'branchId' => (int) $o['branch_id'],
                    'foreign'  => $foreign
                ];
            }

            return [
                'status'  => 200,
                'events'  => $events,
                'fi'      => $fi,
                'ff'      => $ff,
                'limited' => $limited,
                'branch'  => $this->scope()['branch'],
                'all'     => count($branches) > 1
            ];
        }, 'No se pudo cargar el calendario.');
    }

    // Un folio que no esta en lo visible: su fecha de entrega para saltar a ella.
    public function locateOrder() {
        $fail = $this->needCalendar('show') ?: $this->needBranch();
        if ($fail) return $fail;

        $q = trim($this->post('q'));

        if (!preg_match('/^P?(\d+)(?:-\d+)?$/i', $q, $m)) return $this->fail(422, 'Escribe un folio, por ejemplo P1557.');

        $id      = (int) $m[1];
        $order   = $this->qGetOrder($id, $this->branchId());
        $limited = $this->limited();

        // Vista «todas»: también el de otra sucursal que el rol deja ver.
        if (!$order && $this->post('all') === '1') {
            $place = $this->orderBranch($id, self::CALENDAR);

            if ($place) {
                $order   = $this->qGetOrder($id, (int) $place['branch_id']);
                $limited = !isset($this->viewBranches(self::SECTION)[(int) $place['branch_id']]);
            }
        }

        if (!$order) {
            $where = count($this->readBranches(self::CALENDAR)) > 1 ? 'tus sucursales' : $this->scope()['branch'];

            return $this->fail(404, "El pedido P{$id} no existe en {$where}.");
        }

        $status = (int) $order['sale_status_id'];

        if ($limited && !in_array($status, [self::PENDING, self::PAID], true)) {
            return $this->fail(404, "El pedido P{$id} no está en el calendario de producción.");
        }

        if (empty($order['delivery_date'])) return $this->fail(409, "El pedido P{$id} no tiene fecha de entrega.");

        return ['status' => 200, 'id' => $id, 'date' => (string) $order['delivery_date']];
    }

    // -- Detalle --

    public function getOrder() {
        $fail = $this->needCalendar('show') ?: $this->needBranch();
        if ($fail) return $fail;

        $id = $this->postId();

        return $this->attempt(function () use ($id) {
            $bundle = $this->orderBundle($id, self::CALENDAR);

            // El de otra sucursal no se palomea desde aquí: toggleProduced escribe en la activa.
            if ($bundle['status'] === 200) $bundle['producer'] = !$bundle['foreign'] && $this->producer();

            return $bundle;
        }, 'No se pudo abrir el pedido.');
    }

    // -- Produccion --

    /*  produced = 1 lo marca, 0 lo desmarca. Dos clics seguidos no escriben dos
        veces: si ya esta como se pide, contesta igual sin tocar la base. */
    public function toggleProduced() {
        $fail = ($this->producer() ? null : $this->needCalendar('update', 'marcar pedidos como elaborados')) ?: $this->needBranch();
        if ($fail) return $fail;

        $id   = $this->postId();
        $want = $this->post('produced') === '1';

        if ($id <= 0) return $this->fail(422, 'Falta el pedido.');

        return $this->attempt(function () use ($id, $want) {
            return $this->transaction(function () use ($id, $want) {
                $order = $this->qLockOrder($id, $this->branchId());

                if (!$order) return $this->fail(404, "El pedido P{$id} no existe en " . $this->scope()['branch'] . '.');

                $block = $this->produceBlock($order);
                if ($block !== '') return $this->fail(409, $block);

                $has = !empty($order['produced_at']);

                if ($has === $want) return $this->produced($id, $order['produced_at']);

                $now = date('Y-m-d H:i:s');

                $this->must($this->qUpdateOrder([
                    'values' => ['produced_at', 'produced_user_id'],
                    'where'  => ['id'],
                    'data'   => [$want ? $now : null, $want ? ($this->userId() ?: null) : null, $id]
                ]), 'produced');

                // Lo marca Producción o el Dueño: quién, lo dice el usuario del renglón.
                $this->log($id, 'production',
                    $want ? 'Pedido elaborado' : 'Se quitó «elaborado»',
                    $want ? 'Marcado como elaborado el ' . date('d/m/Y') . ' a las ' . hour12(date('H:i:s')) . '.'
                          : 'Se quitó la marca de elaborado.');

                return $this->produced($id, $want ? $now : null);
            });
        }, 'No se pudo cambiar la marca de elaborado.');
    }

    // -- Entrega --

    public function deliverOrder() {
        return $this->deliver($this->postId());
    }

    public function undeliverOrder() {
        return $this->undeliver($this->postId());
    }

    public function editOrderDelivery() {
        return $this->editDelivery($this->postId());
    }

    // -- Ayudantes --

    // null si puede; si no, el 403 con la frase completa.
    private function needCalendar($action, $text = 'ver el calendario') {
        if (Permission::can(self::CALENDAR, $action)) return null;

        return ['status' => 403, 'message' => "Tu rol no tiene permiso para {$text} en esta sucursal.", 'row' => [], 'events' => []];
    }

    // fi/ff del POST, en orden y con tope: un mes en pantalla trae 6 semanas.
    private function calendarRange() {
        $fi = $this->postDate('fi', date('Y-m-01'));
        $ff = $this->postDate('ff', date('Y-m-t'));

        if ($fi > $ff) [$fi, $ff] = [$ff, $fi];

        $cap = date('Y-m-d', strtotime($fi . ' +' . self::RANGE_MAX . ' days'));

        return [$fi, min($ff, $cap)];
    }

    // '' = se puede palomear. Lo entregado ya salio de cocina.
    private function produceBlock($o) {
        $status = (int) $o['sale_status_id'];

        if ($status === self::CANCELLED)        return 'Un pedido cancelado no se elabora.';
        if ($status === self::QUOTE)            return 'Una cotización todavía no se elabora: primero se confirma con un anticipo.';
        if ((int) $o['delivery_status'] === 1) return 'El pedido ya se entregó: la marca de elaborado ya no cambia.';

        return '';
    }

    private function produced($id, $at) {
        return $this->ok($at ? "P{$id} marcado como elaborado." : "P{$id} sin marca de elaborado.", [
            'id'          => $id,
            'produced'    => $at ? 1 : 0,
            'produced_at' => $at ? (string) $at : ''
        ]);
    }

    // Una fila del calendario. Los colores los pone la pantalla. Con $limited va sin dinero.
    private function event($o, $limited = false) {
        $total = (float) $o['total'];
        $paid  = (float) $o['paid'];
        $time  = (string) $o['delivery_time'];

        $event = [
            'id'         => (int) $o['id'],
            'title'      => $o['customer'] !== '' ? $o['customer'] : 'Sin cliente',
            'start'      => (string) $o['delivery_date'],
            'allDay'     => true,
            'folio'      => 'P' . ($o['folio'] ?: $o['id']),
            'hour'       => $time !== '' ? substr($time, 0, 5) : '',
            'status'     => (int) $o['sale_status_id'],
            'statusText' => (string) $o['status'],
            'delivery'   => (int) $o['delivery_status'],
            'method'     => (int) $o['delivery_method'],
            'location'   => (string) $o['location'],
            'phone'      => (string) $o['phone'],
            'custom'     => (int) $o['is_custom'],
            'produced'   => empty($o['produced_at']) ? 0 : 1,
            'producedAt' => (string) $o['produced_at'],
            'photo'      => (string) $o['photo']
        ];

        if ($limited) return $event;

        return $event + [
            'total'   => round($total, 2),
            'paid'    => round($paid, 2),
            'balance' => round($total - $paid, 2)
        ];
    }
}

Permission::dispatch(new ctrl(), ctrl::CALENDAR);
