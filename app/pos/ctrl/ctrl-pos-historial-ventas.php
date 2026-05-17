<?php
session_start();
if (empty($_POST['opc'])) exit(0);

require_once '../mdl/mdl-pos-historial-ventas.php';

class ctrl extends mdl {

    function init() {
        $subsidiaries_id = $_SESSION['SUB'] ?? '';
        $sucursales = $this->lsSucursales();
        $turnos     = $subsidiaries_id ? $this->lsCashShifts([$subsidiaries_id]) : [];
        return [
            'subsidiaries_id' => (int) $subsidiaries_id,
            'sucursales'      => $sucursales,
            'turnos'          => is_array($turnos) ? $turnos : []
        ];
    }

    function getActiveShifts() {
        $subsidiaries_id = $_POST['subsidiaries_id'] ?? '';
        $turnos = $this->lsCashShifts([$subsidiaries_id]);
        return [
            'turnos' => is_array($turnos) ? $turnos : []
        ];
    }

    function lsVentas() {
        $subsidiaries_id = $_POST['subsidiaries_id'];
        $cash_shift_id   = $_POST['cash_shift_id'];
        $fTurno          = $_POST['fTurno'];
        $fi              = $_POST['fi'];
        $ff              = $_POST['ff'];
        $status          = $_POST['status'];

        $ls = $this->listVentas([
            'subsidiaries_id' => $subsidiaries_id,
            'cash_shift_id'   => $cash_shift_id,
            'fTurno'          => $fTurno,
            'fi'              => $fi,
            'ff'              => $ff,
            'status'          => $status
        ]);

        if (!is_array($ls)) $ls = [];

        $__row = [];
        foreach ($ls as $item) {
            $isCancelled = (int)$item['status'] === 4;

            $btnBase = 'inline-flex items-center justify-center w-7 h-7 rounded text-[12px] transition-colors me-1';
            $btnView = $btnBase . ' bg-slate-600 hover:bg-slate-500 text-white';
            $btnOff  = $btnBase . ' bg-red-600 hover:bg-red-500 text-white';
            $btnDis  = $btnBase . ' bg-red-900/40 text-amber-300/50 cursor-not-allowed';

            $a = [];
            $a[] = [
                'class'   => $btnView,
                'html'    => '<i class="icon-eye"></i>',
                'onclick' => 'app.getVenta(' . $item['id'] . ')'
            ];

            if ($isCancelled) {
                $a[] = ['class' => $btnDis, 'html' => '<i class="icon-block-1"></i>', 'onclick' => 'return false'];
            } else {
                $a[] = [
                    'class'   => $btnOff,
                    'html'    => '<i class="icon-block-1"></i>',
                    'onclick' => 'app.cancelVenta(' . $item['id'] . ')'
                ];
            }

            $descuento = abs((float) $item['discount']);

            $__row[] = [
                'id'        => $item['id'],
                'Folio'     => 'V-' . $item['id'],
                'Cliente'   => $item['client_name']
                                ? $item['client_name']
                                : '<span class="italic text-gray-400">N/A</span>',
                'Estatus'   => statusVenta($item['status']),
                'Fecha'     => $item['fecha_formatted'],
                'Total'     => evaluar($item['total_pay']),
                'Descuento' => $descuento > 0
                                ? '<span class="text-red-400">-$' . number_format($descuento, 2, '.', ',') . '</span>'
                                : '$0.00',
                'Pago'      => paymentBadges($item['payment_codes'], $item['payment_methods']),
                'a'         => $a
            ];
        }

        return ['row' => $__row];
    }

    function showVentas() {
        $subsidiaries_id = $_POST['subsidiaries_id'];
        $cash_shift_id   = $_POST['cash_shift_id'];
        $fTurno          = $_POST['fTurno'];
        $fi              = $_POST['fi'];
        $ff              = $_POST['ff'];

        $counts = $this->getVentaCounts([
            'subsidiaries_id' => $subsidiaries_id,
            'cash_shift_id'   => $cash_shift_id,
            'fTurno'          => $fTurno,
            'fi'              => $fi,
            'ff'              => $ff
        ]);

        return [
            'status' => 200,
            'counts' => $counts
        ];
    }

    function getVenta() {
        $id = $_POST['id'];

        $header = $this->getVentaById([$id]);
        $items  = $this->getVentaItems([$id]);
        $pagos  = $this->getVentaPagos([$id]);

        if (empty($header)) {
            return ['status' => 404, 'message' => 'Venta no encontrada'];
        }

        $v = $header[0];

        $itemsMapped = [];
        foreach ($items as $it) {
            $itemsMapped[] = [
                'id'           => $it['id'],
                'name'         => $it['order_details'] ?: 'Producto #' . $it['product_id'],
                'qty'          => (int)$it['quantity'],
                'price'        => (float)$it['price'],
                'discount'     => 0,
                'dedication'   => $it['dedication']
            ];
        }

        $pagosMapped = [];
        foreach ($pagos as $p) {
            $pagosMapped[] = [
                'clave'          => $p['payment_code'],
                'name'           => $p['payment_name'],
                'amount'         => (float)$p['amount'],
                'tendered'       => (float)$p['tendered_amount'],
                'change'         => (float)$p['change_amount']
            ];
        }

        $cliente = null;
        if ($v['client_id']) {
            $cliente = [
                'name'  => $v['client_name'],
                'phone' => $v['client_phone'],
                'email' => $v['client_email']
            ];
        }

        return [
            'status' => 200,
            'data'   => [
                'id'           => $v['id'],
                'folio'        => 'V-' . $v['id'],
                'estatus'      => $v['status_label'],
                'fecha'        => $v['date_order'] . 'T' . $v['time_order'],
                'sucursal'     => $v['sucursal_name'],
                'turno'        => $v['cash_shift_id'] ? 'Turno #' . $v['cash_shift_id'] : '—',
                'turnoCerrado' => !empty($v['daily_closure_id']),
                'nota'         => $v['note'],
                'cliente'      => $cliente,
                'items'        => $itemsMapped,
                'pagos'        => $pagosMapped
            ]
        ];
    }

    function editVenta() {
        $id     = $_POST['id'];
        $status = 500;
        $message = 'Error al actualizar la venta';

        $edit = $this->updateVenta($this->util->sql($_POST, 1));

        if ($edit) {
            $status  = 200;
            $message = 'Venta actualizada correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
    }

    function reopenVenta() {
        $id   = $_POST['id']   ?? '';
        $user = $_POST['user'] ?? '';
        $key  = $_POST['key']  ?? '';

        if (empty($id) || empty($user) || empty($key)) {
            return ['status' => 400, 'message' => 'Usuario y clave de administrador son requeridos'];
        }

        $admin = $this->validateAdminUser([$user, md5($key)]);

        if (!$admin) {
            return ['status' => 401, 'message' => 'Credenciales incorrectas o el usuario no es administrador'];
        }

        $values = $this->util->sql([
            'status'       => 2,
            'cancelled_at' => null,
            'cancelled_by' => null,
            'id'           => $id
        ], 1);

        $reopen = $this->updateVenta($values);

        return $reopen
            ? ['status' => 200, 'message' => 'Venta reabierta correctamente']
            : ['status' => 500, 'message' => 'No se pudo reabrir la venta'];
    }

    function cancelVenta() {
        $id   = $_POST['id']   ?? '';
        $user = $_POST['user'] ?? '';
        $key  = $_POST['key']  ?? '';

        if (empty($id) || empty($user) || empty($key)) {
            return ['status' => 400, 'message' => 'Usuario y clave de administrador son requeridos'];
        }

        $admin = $this->validateAdminUser([$user, md5($key)]);

        if (!$admin) {
            return ['status' => 401, 'message' => 'Credenciales incorrectas o el usuario no es administrador'];
        }

        $values = $this->util->sql([
            'status'       => 4,
            'cancelled_at' => date('Y-m-d H:i:s'),
            'cancelled_by' => $admin['id'],
            'id'           => $id
        ], 1);

        $cancel = $this->updateVenta($values);

        return $cancel
            ? ['status' => 200, 'message' => 'Venta cancelada correctamente']
            : ['status' => 500, 'message' => 'No se pudo cancelar la venta'];
    }
}

// Complements

function paymentBadges($codes, $names) {
    if (empty($codes)) return '—';

    $arr   = array_filter(array_map('trim', explode(',', $codes)));
    $title = htmlspecialchars((string)$names, ENT_QUOTES);
    $html  = '<div class="inline-flex flex-wrap items-center gap-1" title="' . $title . '">';
    foreach ($arr as $code) {
        $html .= '<span class="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border border-gray-600/40 text-gray-300 bg-gray-700/20">' . htmlspecialchars($code, ENT_QUOTES) . '</span>';
    }
    $html .= '</div>';
    return $html;
}

function statusVenta($status) {
    $map = [
        1 => ['bg' => 'rgba(251,191,36,0.18)',  'color' => '#FBBF24', 'label' => 'PENDIENTE'],
        2 => ['bg' => 'rgba(28,100,242,0.18)',  'color' => '#1C64F2', 'label' => 'EN PROCESO'],
        3 => ['bg' => 'rgba(63,193,137,0.18)',  'color' => '#3FC189', 'label' => 'PAGADO'   ],
        4 => ['bg' => 'rgba(224,36,36,0.18)',   'color' => '#E02424', 'label' => 'CANCELADO'],
    ];
    $v = $map[(int)$status] ?? $map[1];
    return '<span class="px-2 py-0.5 rounded text-[10px] font-bold" style="background:' . $v['bg'] . ';color:' . $v['color'] . ';">' . $v['label'] . '</span>';
}

$obj = new ctrl();
echo json_encode($obj->{$_POST['opc']}());
