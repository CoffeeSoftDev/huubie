<?php
session_start();
if (empty($_POST['opc'])) exit(0);

require_once '../mdl/mdl-pos.php';

class ctrl extends mdl {

    function init() {
        $sub_id   = $_SESSION['SUB'];
        $products = $this->lsProducts([$sub_id]);
        $turno    = $this->getOpenShiftBySubsidiary([$sub_id]);
        $folio    = $this->getMaxOrderFolio();

        $turnoData = null;
        if ($turno) {
            $metrics   = $this->getShiftMetrics([$turno['id']]);
            $turnoData = [
                'id'      => $turno['id'],
                'nombre'  => $turno['shift_name'],
                'ventas'  => (float)$metrics['total_sales'],
                'ordenes' => (int)$metrics['total_orders']
            ];
        }

        return [
            'products' => $products,
            'turno'    => $turnoData,
            'id_sub'    => $sub_id,
            'sucursal' => $_SESSION['SUBSIDIARIE_NAME'] ?? '',
            'vendedor' => $turno ? $turno['employee_name'] : '',
            'folio'    => $folio
        ];
    }

    function lsVentas() {
        $subsidiaries_id = $_POST['subsidiaries_id'] ?? 4;
        $cash_shift_id   = $_POST['cash_shift_id'] ?? 1;
        $fi              = $_POST['fi'] ?? '2026-05-01';
        $ff              = $_POST['ff'] ?? '2026-05-15';
        $status          = $_POST['status'] ?? 1;

        $ls = $this->listVentas([
            'subsidiaries_id' => $subsidiaries_id,
            'cash_shift_id'   => $cash_shift_id,
            'fi'              => $fi,
            'ff'              => $ff,
            'status'          => $status
        ]);

        $__row = [];
        foreach ($ls as $item) {
            $isCancelled = $item['status'] === 'cancelada';

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
            'status'       => 'cancelada',
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
        'pagada'    => ['bg' => 'rgba(63,193,137,0.18)',  'color' => '#3FC189', 'label' => 'PAGADO'   ],
        'cancelada' => ['bg' => 'rgba(224,36,36,0.18)',   'color' => '#E02424', 'label' => 'CANCELADO'],
        'abierta'   => ['bg' => 'rgba(28,100,242,0.18)',  'color' => '#1C64F2', 'label' => 'ABIERTO'  ],
        'pendiente' => ['bg' => 'rgba(251,191,36,0.18)',  'color' => '#FBBF24', 'label' => 'PENDIENTE'],
    ];
    $v = $map[$status] ?? $map['pendiente'];
    return '<span class="px-2 py-0.5 rounded text-[10px] font-bold" style="background:' . $v['bg'] . ';color:' . $v['color'] . ';">' . $v['label'] . '</span>';
}

$obj = new ctrl();
echo json_encode($obj->{$_POST['opc']}());
