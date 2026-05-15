<?php
session_start();
if (empty($_POST['opc'])) exit(0);

require_once '../mdl/mdl-pos-pedidos.php';

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
        $subsidiaries_id = $_POST['subsidiaries_id'] ?? 4;
        $cash_shift_id   = $_POST['cash_shift_id'] ?? '';
        $fi              = $_POST['fi'] ?? '2026-04-01';
        $ff              = $_POST['ff'] ?? '2026-05-15';
        $status          = $_POST['status'] ?? '';

        $ls = $this->listVentas([
            'subsidiaries_id' => $subsidiaries_id,
            'cash_shift_id'   => $cash_shift_id,
            'fi'              => $fi,
            'ff'              => $ff,
            'status'          => $status
        ]);

        if (!is_array($ls)) $ls = [];

        $__row = [];
        foreach ($ls as $item) {
            $isCancelled = (int)$item['status'] === 4;

            $a = [];
            $a[] = [
                'class'   => 'btn btn-sm btn-secondary me-1',
                'html'    => '<i class="icon-eye"></i>',
                'onclick' => 'app.onShowVenta(' . $item['id'] . ')'
            ];

            if ($isCancelled) {
                $a[] = ['class' => 'btn btn-sm btn-primary me-1 disabled',  'html' => '<i class="icon-pencil"></i>',      'onclick' => 'return false'];
                $a[] = ['class' => 'btn btn-sm btn-danger disabled',         'html' => '<i class="icon-trash-empty"></i>', 'onclick' => 'return false'];
            } else {
                $a[] = [
                    'class'   => 'btn btn-sm btn-primary me-1',
                    'html'    => '<i class="icon-pencil"></i>',
                    'onclick' => 'app.editarVenta(' . $item['id'] . ')'
                ];
                $a[] = [
                    'class'   => 'btn btn-sm btn-danger',
                    'html'    => '<i class="icon-trash-empty"></i>',
                    'onclick' => 'app.cancelarVenta(' . $item['id'] . ')'
                ];
            }

            $__row[] = [
                'id'        => $item['id'],
                'Folio'     => 'V-' . $item['id'],
                'Cliente'   => $item['client_name']
                                ? $item['client_name']
                                : '<span class="italic text-gray-400">N/A</span>',
                'Estatus'   => statusVenta($item['status']),
                'Fecha'     => formatSpanishDate($item['date_order']) . ' ' . substr($item['time_order'], 0, 5),
                'Total'     => evaluar($item['total_pay']),
                'Descuento' => $item['discount'] > 0 ? '-' . evaluar($item['discount']) : evaluar(0),
                'Pago'      => $item['payment_methods'] ?: '—',
                'a'         => $a
            ];
        }

        return ['row' => $__row];
    }

    function showVentas() {
        $subsidiaries_id = $_POST['subsidiaries_id'];
        $cash_shift_id   = $_POST['cash_shift_id'];
        $fi              = $_POST['fi'];
        $ff              = $_POST['ff'];

        $counts = $this->getVentaCounts([
            'subsidiaries_id' => $subsidiaries_id,
            'cash_shift_id'   => $cash_shift_id,
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
                'estatus'      => $v['status'],
                'fecha'        => $v['date_order'] . 'T' . $v['time_order'],
                'sucursal'     => $v['sucursal_name'],
                'turno'        => $v['cash_shift_id'],
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

    function cancelVenta() {
        $id     = $_POST['id'];
        $status = 500;
        $message = 'No se pudo cancelar la venta';

        $values = $this->util->sql([
            'status'       => 4,
            'cancelled_at' => date('Y-m-d H:i:s'),
            'id'           => $id
        ], 1);

        $cancel = $this->updateVenta($values);

        if ($cancel) {
            $status  = 200;
            $message = 'Venta cancelada correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
    }
}

// Complements

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
