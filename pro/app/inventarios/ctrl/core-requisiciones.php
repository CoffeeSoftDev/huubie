<?php
require_once __DIR__ . '/core-inventarios.php';
require_once __DIR__ . '/../mdl/trait-requisicion-doc.php';

/*  Base de Requisiciones (quien pide, inv-requisiciones) y Surtir (quien
    surte, inv-surtir): las «Requisiciones» y el «Surtir» de
    inventory/operacion/almacen aplicados al Catálogo de pro (R4, 29/11/2026).

    La sucursal le pide a otra (casi siempre la Matriz):
      Borrador → En espera → Surtido parcialmente / Entregado → Confirmado
      o Rechazada (quien surte) / Cancelada (quien pide).
    Surtir saca del almacén de quien surte: una salida del sistema (motivo
    SURTIDO_SUC) y un renglón en requisition_supply. «Recibí» mete lo surtido
    al almacén de quien pidió: una entrada del sistema (tipo SURTIDO_SUC) ligada
    al mismo surtimiento. Así cada lado ve su movimiento en su kárdex.

    Un producto va una sola vez por requisición (el mismo dos veces se junta).

    Cada ctrl declara LADO ('pedidos' o 'entregas') y sus métodos públicos
    (Permission::dispatch solo corre los del ctrl). */
class coreReq extends core {

    use RequisicionDoc;

    const LADO      = 'pedidos';
    const MAX_LINES = 200;

    private $statusCache = null;

    // -- Estados --

    // {code: fila} de la empresa: BORRADOR, EN_ESPERA, SURTIDO_PARCIAL, ENTREGADO, CONFIRMADO, RECHAZADA, CANCELADA.
    protected function statuses() {
        if ($this->statusCache === null) {
            $this->statusCache = [];
            foreach ($this->qRequisitionStatuses($this->companyId()) as $s) $this->statusCache[$s['code']] = $s;
        }

        return $this->statusCache;
    }

    protected function statusId($code) {
        $s = $this->statuses()[$code] ?? null;
        if (!$s) throw new RuntimeException("Falta el estado de requisición {$code}");

        return (int) $s['id'];
    }

    // El filtro de estado; Surtir no ve borradores.
    protected function statusOptions() {
        $list = [['id' => '', 'valor' => 'Todos los estados']];

        foreach ($this->statuses() as $code => $s) {
            if (static::LADO === 'entregas' && $code === 'BORRADOR') continue;
            $list[] = ['id' => $code, 'valor' => $s['name'], 'icon' => $s['icon'], 'color' => $s['color_hex']];
        }

        return $list;
    }

    // Insignia con el ícono y el color del Catálogo › Estados de requisición (sin color: el del tema).
    protected function reqBadge($r) {
        $fg = $r['status_color'] ?: '#C05A40';

        return $this->badge($r['status_name'] ?: $r['status_code'], $fg, null, $r['status_icon'] ?: null);
    }

    protected function departmentList() {
        return array_map(function ($d) {
            return ['id' => (int) $d['id'], 'valor' => $d['name'], 'icon' => $d['icon'], 'color' => $d['color_hex']];
        }, $this->qDepartmentOptions($this->companyId()));
    }

    protected function branchList() {
        return array_map(function ($b) {
            return ['id' => (int) $b['id'], 'valor' => $b['name']];
        }, $this->qBranches($this->companyId()));
    }

    // -- Lectura --

    // La de este lado: la pidió la sucursal (pedidos) o se la piden (entregas).
    protected function sideRequisition($id) {
        $r = $this->qGetRequisition((int) $id, $this->companyId());
        if (!$r) return null;

        $mine = static::LADO === 'entregas'
            ? (int) $r['source_branch_id'] === $this->branchId() && $r['status_code'] !== 'BORRADOR'
            : (int) $r['branch_id'] === $this->branchId();

        return $mine ? $r : null;
    }

    // Columnas: Folio, Fecha, Lo necesita, Área, Surte | Pide, Productos, Estado
    protected function listRows() {
        [$from, $to] = $this->period();

        $code = array_key_exists($this->post('estado'), $this->statuses()) ? $this->post('estado') : '';
        $rows = [];

        foreach ($this->qRequisitionsOf($this->companyId(), $this->branchId(), static::LADO, $from, $to, $code) as $r) {
            $id    = (int) $r['id'];
            $open  = "app.selectRequisicion({$id})";
            $other = static::LADO === 'entregas' ? 'Pide' : 'Surte';

            $rows[] = [
                'id'          => $id,
                'Folio'       => $this->folioLink($r['folio'], $open),
                'Fecha'       => $this->dateTime(substr($r['created_at'], 0, 10), $r['created_at']),
                'Lo necesita' => $this->neededCell($r['needed_date']),
                'Área'        => $this->departmentPill($r),
                $other        => h(static::LADO === 'entregas' ? $r['branch'] : $r['source_branch']),
                'Productos'   => (int) $r['lines_count'],
                'Estado'      => $this->reqBadge($r),
                'a'           => [$this->rowIcon('eye', $open, 'Ver requisición')]
            ];
        }

        return $rows;
    }

    // «Hoy» en rojo, «Mañana» en ámbar; si no, la fecha.
    protected function neededCell($date) {
        if (!$date) return '<span class="text-gray-300">-</span>';

        $today = $this->qNow()['today'];

        if ($date === $today) return '<span class="font-semibold text-red-600">Hoy</span>';
        if ($date === date('Y-m-d', strtotime($today . ' +1 day'))) return '<span class="font-semibold text-amber-600">Mañana</span>';

        return h($this->dateTime($date));
    }

    protected function departmentPill($r) {
        if (!$r['department']) return '<span class="text-gray-300">-</span>';

        return $this->badge($r['department'], $r['department_color'] ?: '#64748B', null, $r['department_icon'] ?: null);
    }

    // Header, renglones, surtimientos y qué botones lleva el visor de ESTE lado.
    protected function detailResponse($r) {
        $costs    = $this->costs();
        $lines    = $this->qRequisitionLines((int) $r['id']);
        $supplies = $this->qRequisitionSupplies((int) $r['id']);
        $users    = $this->names(array_merge([$r], $supplies), ['user_id', 'approved_user_id', 'confirmed_user_id']);
        $code     = $r['status_code'];
        $supplied = array_sum(array_map(function ($l) { return (float) $l['quantity_supplied']; }, $lines)) > 0;
        $pending  = count(array_filter($supplies, function ($s) { return !$s['inventory_inflow_id']; })) > 0;

        if (static::LADO === 'entregas') {
            $perms = [
                'supply' => $this->can('update') && in_array($code, ['EN_ESPERA', 'SURTIDO_PARCIAL'], true),
                'reject' => $this->can('cancel') && $code === 'EN_ESPERA' && !$supplied,
                'revert' => $this->can('cancel') && $pending && in_array($code, ['SURTIDO_PARCIAL', 'ENTREGADO'], true)
            ];
        } else {
            $perms = [
                'edit'    => $this->can('update') && in_array($code, ['BORRADOR', 'EN_ESPERA'], true),
                'send'    => ($this->can('create') || $this->can('update')) && $code === 'BORRADOR',
                'cancel'  => $this->can('cancel') && in_array($code, ['BORRADOR', 'EN_ESPERA'], true) && !$supplied,
                'receive' => $this->can('update') && $pending && in_array($code, ['SURTIDO_PARCIAL', 'ENTREGADO'], true)
            ];
        }

        $perms['print'] = $this->can('print');

        return [
            'status' => 200,
            'costs'  => $costs,
            'perms'  => $perms,
            'header' => [
                'id'               => (int) $r['id'],
                'folio'            => $r['folio'],
                'status_code'      => $code,
                'status_name'      => $r['status_name'],
                'status_badge'     => $this->reqBadge($r),
                'branch_id'        => (int) $r['branch_id'],
                'branch'           => $r['branch'],
                'source_branch_id' => (int) $r['source_branch_id'],
                'source_branch'    => $r['source_branch'],
                'warehouse'        => $r['warehouse'],
                'department_id'    => $r['department_id'] ? (int) $r['department_id'] : '',
                'department'       => $r['department'],
                'department_pill'  => $r['department'] ? $this->departmentPill($r) : '',
                'needed_date'      => $r['needed_date'],
                'created_at'       => $r['created_at'],
                'sent_at'          => $r['sent_at'],
                'approved_at'      => $r['approved_at'],
                'confirmed_at'     => $r['confirmed_at'],
                'note'             => $r['note'],
                'approval_note'    => $r['approval_note'],
                'reject_reason'    => $r['reject_reason'],
                'user_name'        => $users[(int) $r['user_id']] ?? '-',
                'approved_name'    => $r['approved_user_id'] ? ($users[(int) $r['approved_user_id']] ?? '-') : '',
                'confirmed_name'   => $r['confirmed_user_id'] ? ($users[(int) $r['confirmed_user_id']] ?? '-') : '',
                'total_products'   => (int) $r['total_products'],
                'total_units'      => (float) $r['total_units'],
                'total_cost'       => $costs ? (float) $r['total_cost'] : 0
            ],
            'detail' => array_map(function ($l) use ($costs) {
                return [
                    'id'                => (int) $l['id'],
                    'product_id'        => (int) $l['product_id'],
                    'name'              => $l['name'] ?: 'Producto borrado',
                    'sku'               => $l['sku'] ?: '',
                    'category'          => $l['category'] ?: '',
                    'unit_id'           => $l['unit_id'] ? (int) $l['unit_id'] : '',
                    'unit'              => $l['unit'] ?: 'PZA',
                    'decimals'          => (int) $l['decimals'],
                    'quantity'          => (float) $l['quantity'],
                    'quantity_supplied' => (float) $l['quantity_supplied'],
                    'note'              => $l['note'] ?: '',
                    'cost'              => $costs ? (float) $l['cost'] : 0,
                    'image'             => $this->photoUrl($l['image'])
                ];
            }, $lines),
            'supplies' => array_map(function ($s) use ($users, $costs) {
                return [
                    'id'          => (int) $s['id'],
                    'created_at'  => $s['created_at'],
                    'user_name'   => $users[(int) $s['user_id']] ?? '-',
                    'warehouse'   => $s['warehouse'] ?: '-',
                    'products'    => (int) $s['total_products'],
                    'units'       => (float) $s['total_units'],
                    'cost'        => $costs ? (float) $s['total_cost'] : 0,
                    'note'        => $s['note'] ?: '',
                    'outflow'     => $s['outflow_folio'] ?: '',
                    'inflow'      => $s['inflow_folio'] ?: '',
                    'received_at' => $s['received_at']
                ];
            }, $supplies)
        ];
    }

    // -- Calendario (por el día en que se necesita) --

    protected function calendarResponse() {
        $from  = $this->dateOrNull(substr($this->post('start'), 0, 10)) ?: date('Y-m-01');
        $to    = $this->dateOrNull(substr($this->post('end'), 0, 10)) ?: date('Y-m-t');
        $other = static::LADO === 'entregas' ? 'branch' : 'source_branch';

        $events = array_map(function ($r) use ($other) {
            $color = $r['status_color'] ?: '#C05A40';

            return [
                'id'              => (int) $r['id'],
                'title'           => $r['folio'] . ' · ' . $this->shortBranch($r[$other]),
                'start'           => $r['needed_date'],
                'allDay'          => true,
                'backgroundColor' => $color,
                'borderColor'     => $color,
                'textColor'       => '#FFFFFF',
                'extendedProps'   => ['status' => $r['status_name'], 'icon' => $r['status_icon'] ?: 'circle']
            ];
        }, array_values(array_filter(
            $this->qRequisitionsOf($this->companyId(), $this->branchId(), static::LADO, $from, $to, '', 'needed_date'),
            function ($r) { return !empty($r['needed_date']); }
        )));

        return ['status' => 200, 'events' => $events];
    }

    // -- Estado según lo surtido y lo recibido --

    // Todo surtido = Entregado (y si ya se recibió todo, Confirmado); algo = parcial; nada = En espera.
    protected function nextStatus($requisitionId, $finish = false) {
        $lines    = $this->qRequisitionLines($requisitionId);
        $supplies = $this->qRequisitionSupplies($requisitionId);
        $complete = true;
        $any      = false;

        foreach ($lines as $l) {
            if ((float) $l['quantity_supplied'] > 0) $any = true;
            if ((float) $l['quantity_supplied'] + 0.00001 < (float) $l['quantity']) $complete = false;
        }

        if (!$any) return 'EN_ESPERA';
        if (!$complete && !$finish) return 'SURTIDO_PARCIAL';

        foreach ($supplies as $s) if (!$s['inventory_inflow_id']) return 'ENTREGADO';

        return 'CONFIRMADO';
    }

    // -- El documento (Imprimir; la hoja vive en trait-requisicion-doc, que usa también el comprobante público) --

    protected function printResponse($r) {
        $costs = $this->costs();
        $lines = array_map(function ($l) use ($costs) {
            if (!$costs) $l['cost'] = 0;
            return $l;
        }, $this->qRequisitionLines((int) $r['id']));

        return ['status' => 200, 'html' => $this->documentHtml($r, $lines, $this->qRequisitionSupplies((int) $r['id']), $costs)];
    }

    // El enlace del comprobante (público, sin costos) que se comparte por WhatsApp.
    protected function shareResponse($r) {
        $token = $r['share_token'];

        if (!$token) {
            $token = bin2hex(random_bytes(16));

            return $this->attempt(function () use ($r, $token) {
                $this->must($this->qUpdateRequisition(['share_token'], [$token, (int) $r['id']]), 'share');

                return $this->ok('Enlace listo.', ['token' => $token, 'folio' => $r['folio'], 'branch' => $r['branch']]);
            }, 'No se pudo crear el enlace.');
        }

        return $this->ok('Enlace listo.', ['token' => $token, 'folio' => $r['folio'], 'branch' => $r['branch']]);
    }
}
