<?php
session_start();
if (empty($_POST['opc'])) exit(0);

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

require_once '../mdl/mdl-reportes.php';
require_once '../../conf/_Utileria.php';

class ctrl extends MReportes {

    function init() {
        if ($_SESSION['ROLID'] != 1) {
            return ['status' => 403, 'message' => 'No tienes permisos'];
        }

        $subsidiaries = $this->lsSubsidiaries();

        return [
            'access'     => $_SESSION['ROLID'],
            'sucursales' => $subsidiaries['data'],
            'sub_id'     => $_SESSION['SUB'],
        ];
    }

    function lsSubsidiaries() {
        $status  = 500;
        $message = 'Error al obtener las sucursales';
        $data    = [];

        if ($_SESSION['ROLID'] == 1) {
            $subsidiaries = $this->getSubsidiariesByCompany([$_SESSION['COMPANY_ID']]);
            if ($subsidiaries) {
                $status  = 200;
                $message = 'Sucursales obtenidas correctamente';
                $data    = $subsidiaries;
            }
        } else {
            $status  = 403;
            $message = 'No tienes permisos para acceder a esta información';
        }

        return [
            'status'  => $status,
            'message' => $message,
            'data'    => $data
        ];
    }

    function lsTickets() {
        if ($_SESSION['ROLID'] != 1) {
            return ['status' => 403, 'message' => 'No tienes permisos'];
        }

        $fi     = $_POST['fi'];
        $ff     = $_POST['ff'];
        $sub_id = $_POST['sub_id'];

        $ls    = $this->listTickets([$fi, $ff, $sub_id, $sub_id]);
        $__row = [];

        $totalImporte       = 0;
        $totalDescuento     = 0;
        $totalEfectivo      = 0;
        $totalTarjeta       = 0;
        $totalTransferencia = 0;

        if (is_array($ls)) {
            foreach ($ls as $ticket) {
                $totalImporte       += floatval($ticket['importe']);
                $totalDescuento     += floatval($ticket['descuento_importe']);
                $totalEfectivo      += floatval($ticket['efectivo']);
                $totalTarjeta       += floatval($ticket['tarjeta']);
                $totalTransferencia += floatval($ticket['transferencia']);

                $__row[] = [
                    'id'            => $ticket['folio_cuenta'],
                    'Folio'         => str_pad($ticket['folio_cuenta'], 8, '0', STR_PAD_LEFT),
                    'Fecha'         => formatSpanishDate($ticket['fecha']),
                    'Cuenta'        => $ticket['cuenta'],
                    'Descuento'     => [
                        'html'  => evaluar($ticket['descuento_importe']),
                        'class' => 'text-end'
                    ],
                    'Importe'       => [
                        'html'  => evaluar($ticket['importe']),
                        'class' => 'text-end bg-[#283341] font-bold'
                    ],
                    'Efectivo'      => [
                        'html'  => evaluar($ticket['efectivo']),
                        'class' => 'text-end'
                    ],
                    'Tarjeta'       => [
                        'html'  => evaluar($ticket['tarjeta']),
                        'class' => 'text-end'
                    ],
                    'Transferencia' => [
                        'html'  => evaluar($ticket['transferencia']),
                        'class' => 'text-end'
                    ],
                    'opc' => 0
                ];
            }
        }

        return [
            'row'    => $__row,
            'totals' => [
                'importe'       => evaluar($totalImporte),
                'descuento'     => evaluar($totalDescuento),
                'efectivo'      => evaluar($totalEfectivo),
                'tarjeta'       => evaluar($totalTarjeta),
                'transferencia' => evaluar($totalTransferencia),
                'total_tickets' => count($__row),
            ]
        ];
    }

    function lsShifts() {
        if ($_SESSION['ROLID'] != 1) {
            return ['status' => 403, 'message' => 'No tienes permisos'];
        }

        $fi     = $_POST['fi'];
        $ff     = $_POST['ff'];
        $sub_id = $_POST['sub_id'];

        $ls    = $this->listShifts([$sub_id, $sub_id, $fi, $ff]);
        $__row = [];

        if (is_array($ls)) {
            foreach ($ls as $shift) {
                $__row[] = [
                    'id'             => $shift['id'],
                    'Responsable'    => $shift['employee_name'] ? $shift['employee_name'] : 'Sin asignar',
                    'Apertura'       => formatSpanishDate($shift['opened_at']),
                    'Cierre'         => $shift['closed_at'] ? formatSpanishDate($shift['closed_at']) : 'Abierto',
                    'Total'          => [
                        'html'  => evaluar($shift['total_sales']),
                        'class' => 'text-end bg-[#283341] font-bold'
                    ],
                    'Efectivo'       => [
                        'html'  => evaluar($shift['total_cash']),
                        'class' => 'text-end'
                    ],
                    'Tarjeta'        => [
                        'html'  => evaluar($shift['total_card']),
                        'class' => 'text-end'
                    ],
                    'Transferencia'  => [
                        'html'  => evaluar($shift['total_transfer']),
                        'class' => 'text-end'
                    ],
                    'Pedidos'        => [
                        'html'  => $shift['total_orders'],
                        'class' => 'text-center'
                    ],
                    'Estado'         => statusShift($shift['status']),
                    'opc'            => 0
                ];
            }
        }

        return ['row' => $__row];
    }

    function lsDailyTickets() {
        if ($_SESSION['ROLID'] != 1) {
            return ['status' => 403, 'message' => 'No tienes permisos'];
        }

        $fi     = $_POST['fi'];
        $ff     = $_POST['ff'];
        $sub_id = $_POST['sub_id'];

        $ls    = $this->listDailyTickets([$fi, $ff, $sub_id, $sub_id]);
        $__row = [];

        $grandImporte       = 0;
        $grandDescuento     = 0;
        $grandEfectivo      = 0;
        $grandTarjeta       = 0;
        $grandTransferencia = 0;
        $grandTickets       = 0;

        if (is_array($ls)) {
            foreach ($ls as $daily) {
                $grandImporte       += floatval($daily['importe']);
                $grandDescuento     += floatval($daily['descuento']);
                $grandEfectivo      += floatval($daily['efectivo']);
                $grandTarjeta       += floatval($daily['tarjeta']);
                $grandTransferencia += floatval($daily['transferencia']);
                $grandTickets       += intval($daily['total_tickets']);

                $__row[] = [
                    'id'            => $daily['fecha'],
                    'Fecha'         => formatSpanishDate($daily['fecha']),
                    'Tickets'       => [
                        'html'  => $daily['total_tickets'],
                        'class' => 'text-center'
                    ],
                    'Descuento'     => [
                        'html'  => evaluar($daily['descuento']),
                        'class' => 'text-end'
                    ],
                    'Importe'       => [
                        'html'  => evaluar($daily['importe']),
                        'class' => 'text-end bg-[#283341] font-bold'
                    ],
                    'Efectivo'      => [
                        'html'  => evaluar($daily['efectivo']),
                        'class' => 'text-end'
                    ],
                    'Tarjeta'       => [
                        'html'  => evaluar($daily['tarjeta']),
                        'class' => 'text-end'
                    ],
                    'Transferencia' => [
                        'html'  => evaluar($daily['transferencia']),
                        'class' => 'text-end'
                    ],
                    'opc' => 0
                ];
            }
        }

        return [
            'row'    => $__row,
            'totals' => [
                'importe'       => evaluar($grandImporte),
                'descuento'     => evaluar($grandDescuento),
                'efectivo'      => evaluar($grandEfectivo),
                'tarjeta'       => evaluar($grandTarjeta),
                'transferencia' => evaluar($grandTransferencia),
                'total_tickets' => $grandTickets,
            ]
        ];
    }

    function lsCorte() {
        if ($_SESSION['ROLID'] != 1) {
            return ['status' => 403, 'message' => 'No tienes permisos'];
        }

        $fi     = $_POST['fi'];
        $ff     = $_POST['ff'];
        $sub_id = $_POST['sub_id'];

        $shiftSummary = $this->getShiftSummary([$sub_id, $sub_id, $fi, $ff]);
        $orderStats   = $this->getOrderStats([$fi, $ff, $sub_id, $sub_id]);
        $payments     = $this->getPaymentBreakdown([$fi, $ff, $sub_id, $sub_id]);
        $categorias   = $this->getSalesByCategory([$fi, $ff, $sub_id, $sub_id]);
        $shifts       = $this->listShifts([$sub_id, $sub_id, $fi, $ff]);

        $shiftRows = [];
        if (is_array($shifts)) {
            foreach ($shifts as $shift) {
                $shiftRows[] = [
                    'id'            => $shift['id'],
                    'employee_name' => $shift['employee_name'] ? $shift['employee_name'] : 'Sin asignar',
                    'opened_at'     => formatSpanishDate($shift['opened_at']),
                    'closed_at'     => $shift['closed_at'] ? formatSpanishDate($shift['closed_at']) : 'Abierto',
                    'total_sales'   => evaluar($shift['total_sales']),
                    'total_cash'    => evaluar($shift['total_cash']),
                    'total_card'    => evaluar($shift['total_card']),
                    'total_transfer'=> evaluar($shift['total_transfer']),
                    'total_orders'  => $shift['total_orders'],
                    'status'        => $shift['status'],
                ];
            }
        }

        $ventaBruta      = floatval($shiftSummary['venta_bruta']);
        $totalDescuentos = floatval($orderStats['importe_descuentos']);
        $ventaNeta       = $ventaBruta - $totalDescuentos;
        $totalEfectivo   = floatval($payments['efectivo']);
        $totalTarjeta    = floatval($payments['tarjeta']);
        $totalTransf     = floatval($payments['transferencia']);
        $saldoFinal      = $totalEfectivo + $totalTarjeta + $totalTransf;

        return [
            'status'  => 200,
            'summary' => [
                'venta_bruta'        => evaluar($ventaBruta),
                'total_efectivo'     => evaluar($totalEfectivo),
                'total_tarjeta'      => evaluar($totalTarjeta),
                'total_transferencia'=> evaluar($totalTransf),
                'total_descuentos'   => evaluar($totalDescuentos),
                'total_tickets'      => intval($orderStats['total_cuentas']),
                'efectivo_inicial'   => evaluar($shiftSummary['efectivo_inicial']),
                'venta_neta'         => evaluar($ventaNeta),
                'saldo_final'        => evaluar($saldoFinal),
            ],
            'cuentas' => [
                'total'             => intval($orderStats['total_cuentas']),
                'cotizaciones'      => intval($orderStats['cotizaciones']),
                'pendientes'        => intval($orderStats['pendientes']),
                'pagadas'           => intval($orderStats['pagadas']),
                'canceladas'        => intval($orderStats['canceladas']),
                'con_descuento'     => intval($orderStats['con_descuento']),
                'importe_descuentos'=> evaluar($orderStats['importe_descuentos']),
                'cuenta_promedio'   => evaluar($orderStats['cuenta_promedio']),
                'folio_inicial'     => $orderStats['folio_inicial'] ? $orderStats['folio_inicial'] : '-',
                'folio_final'       => $orderStats['folio_final'] ? $orderStats['folio_final'] : '-',
            ],
            'pagos' => [
                'efectivo'      => evaluar($totalEfectivo),
                'tarjeta'       => evaluar($totalTarjeta),
                'transferencia' => evaluar($totalTransf),
            ],
            'categorias' => $categorias,
            'shifts'     => $shiftRows,
        ];
    }

    function lsShiftsWithTickets() {
        if ($_SESSION['ROLID'] != 1) {
            return ['status' => 403, 'message' => 'No tienes permisos'];
        }

        $fi     = $_POST['fi'];
        $ff     = $_POST['ff'];
        $sub_id = $_POST['sub_id'];

        $shifts          = $this->listShifts([$sub_id, $sub_id, $fi, $ff]);
        $ticketsInRange  = $this->listTickets([$fi, $ff, $sub_id, $sub_id]);

        $__row = [];

        $totalImporte       = 0;
        $totalDescuento     = 0;
        $totalEfectivo      = 0;
        $totalTarjeta       = 0;
        $totalTransferencia = 0;
        $totalTickets       = 0;

        $ticketsByShift = [];
        $orphanTickets  = [];

        if (is_array($ticketsInRange)) {
            foreach ($ticketsInRange as $ticket) {
                $shiftKey = $ticket['cash_shift_id'];
                if ($shiftKey) {
                    $ticketsByShift[$shiftKey][] = $ticket;
                } else {
                    $orphanTickets[] = $ticket;
                }
            }
        }

        $shiftIndex = 0;
        if (is_array($shifts)) {
            foreach ($shifts as $shift) {
                $shiftIndex++;
                $shiftId       = $shift['id'];
                $shiftTickets  = isset($ticketsByShift[$shiftId]) ? $ticketsByShift[$shiftId] : [];

                $shiftDescuento     = 0;
                $shiftImporte       = 0;
                $shiftEfectivo      = 0;
                $shiftTarjeta       = 0;
                $shiftTransferencia = 0;

                foreach ($shiftTickets as $ticket) {
                    $shiftDescuento     += floatval($ticket['descuento_importe']);
                    $shiftImporte       += floatval($ticket['importe']);
                    $shiftEfectivo      += floatval($ticket['efectivo']);
                    $shiftTarjeta       += floatval($ticket['tarjeta']);
                    $shiftTransferencia += floatval($ticket['transferencia']);
                }

                $responsable = $shift['employee_name'] ? $shift['employee_name'] : 'Sin asignar';
                $apertura    = formatSpanishDate($shift['opened_at']);
                $cierre      = $shift['closed_at'] ? formatSpanishDate($shift['closed_at']) : 'Abierto';
                $ticketCount = count($shiftTickets);

                $__row[] = [
                    'id'            => 'shift_' . $shiftId,
                    'Folio'         => '<i class="icon-clock"></i> Turno #' . $shiftIndex . ' - ' . $responsable,
                    'Fecha'         => $apertura . ' / ' . $cierre,
                    'Cuenta'        => [
                        'html'  => $ticketCount . ' ticket' . ($ticketCount === 1 ? '' : 's'),
                        'class' => 'text-center'
                    ],
                    'Producto'      => '',
                    'Descuento'     => [
                        'html'  => evaluar($shiftDescuento),
                        'class' => 'text-end'
                    ],
                    'Importe'       => [
                        'html'  => evaluar($shiftImporte),
                        'class' => 'text-end font-bold'
                    ],
                    'Efectivo'      => [
                        'html'  => evaluar($shiftEfectivo),
                        'class' => 'text-end'
                    ],
                    'Tarjeta'       => [
                        'html'  => evaluar($shiftTarjeta),
                        'class' => 'text-end'
                    ],
                    'Transferencia' => [
                        'html'  => evaluar($shiftTransferencia),
                        'class' => 'text-end'
                    ],
                    'opc'           => 1,
                ];

                foreach ($shiftTickets as $ticket) {
                    $totalImporte       += floatval($ticket['importe']);
                    $totalDescuento     += floatval($ticket['descuento_importe']);
                    $totalEfectivo      += floatval($ticket['efectivo']);
                    $totalTarjeta       += floatval($ticket['tarjeta']);
                    $totalTransferencia += floatval($ticket['transferencia']);
                    $totalTickets++;

                    $productos = $this->getProductsByOrder([$ticket['folio_cuenta']]);
                    $productoHtml = buildProductHtml($productos);

                    $__row[] = [
                        'id'            => $ticket['folio_cuenta'],
                        'Folio'         => str_pad($ticket['folio_cuenta'], 8, '0', STR_PAD_LEFT),
                        'Fecha'         => formatSpanishDate($ticket['fecha']),
                        'Cuenta'        => $ticket['cuenta'],
                        'Producto'      => [
                            'html'  => $productoHtml,
                            'class' => 'text-start'
                        ],
                        'Descuento'     => [
                            'html'  => evaluar($ticket['descuento_importe']),
                            'class' => 'text-end'
                        ],
                        'Importe'       => [
                            'html'  => evaluar($ticket['importe']),
                            'class' => 'text-end bg-[#283341] font-bold'
                        ],
                        'Efectivo'      => [
                            'html'  => evaluar($ticket['efectivo']),
                            'class' => 'text-end'
                        ],
                        'Tarjeta'       => [
                            'html'  => evaluar($ticket['tarjeta']),
                            'class' => 'text-end'
                        ],
                        'Transferencia' => [
                            'html'  => evaluar($ticket['transferencia']),
                            'class' => 'text-end'
                        ],
                        'opc'           => 0
                    ];
                }
            }
        }

        if (!empty($orphanTickets)) {
            $orphanDescuento     = 0;
            $orphanImporte       = 0;
            $orphanEfectivo      = 0;
            $orphanTarjeta       = 0;
            $orphanTransferencia = 0;

            foreach ($orphanTickets as $ticket) {
                $orphanDescuento     += floatval($ticket['descuento_importe']);
                $orphanImporte       += floatval($ticket['importe']);
                $orphanEfectivo      += floatval($ticket['efectivo']);
                $orphanTarjeta       += floatval($ticket['tarjeta']);
                $orphanTransferencia += floatval($ticket['transferencia']);
            }

            $orphanCount = count($orphanTickets);

            $__row[] = [
                'id'            => 'shift_sin_turno',
                'Folio'         => '<i class="icon-attention"></i> Sin turno asignado',
                'Fecha'         => '-',
                'Cuenta'        => [
                    'html'  => $orphanCount . ' ticket' . ($orphanCount === 1 ? '' : 's'),
                    'class' => 'text-center'
                ],
                'Producto'      => '',
                'Descuento'     => [
                    'html'  => evaluar($orphanDescuento),
                    'class' => 'text-end'
                ],
                'Importe'       => [
                    'html'  => evaluar($orphanImporte),
                    'class' => 'text-end font-bold'
                ],
                'Efectivo'      => [
                    'html'  => evaluar($orphanEfectivo),
                    'class' => 'text-end'
                ],
                'Tarjeta'       => [
                    'html'  => evaluar($orphanTarjeta),
                    'class' => 'text-end'
                ],
                'Transferencia' => [
                    'html'  => evaluar($orphanTransferencia),
                    'class' => 'text-end'
                ],
                'opc'           => 1,
                'color_group'   => 'bg-[#5F3A1E] text-white'
            ];

            foreach ($orphanTickets as $ticket) {
                $totalImporte       += floatval($ticket['importe']);
                $totalDescuento     += floatval($ticket['descuento_importe']);
                $totalEfectivo      += floatval($ticket['efectivo']);
                $totalTarjeta       += floatval($ticket['tarjeta']);
                $totalTransferencia += floatval($ticket['transferencia']);
                $totalTickets++;

                $productos = $this->getProductsByOrder([$ticket['folio_cuenta']]);
                $productoHtml = buildProductHtml($productos);

                $__row[] = [
                    'id'            => $ticket['folio_cuenta'],
                    'Folio'         => str_pad($ticket['folio_cuenta'], 8, '0', STR_PAD_LEFT),
                    'Fecha'         => formatSpanishDate($ticket['fecha']),
                    'Cuenta'        => $ticket['cuenta'],
                    'Producto'      => [
                        'html'  => $productoHtml,
                        'class' => 'text-start'
                    ],
                    'Descuento'     => [
                        'html'  => evaluar($ticket['descuento_importe']),
                        'class' => 'text-end'
                    ],
                    'Importe'       => [
                        'html'  => evaluar($ticket['importe']),
                        'class' => 'text-end bg-[#283341] font-bold'
                    ],
                    'Efectivo'      => [
                        'html'  => evaluar($ticket['efectivo']),
                        'class' => 'text-end'
                    ],
                    'Tarjeta'       => [
                        'html'  => evaluar($ticket['tarjeta']),
                        'class' => 'text-end'
                    ],
                    'Transferencia' => [
                        'html'  => evaluar($ticket['transferencia']),
                        'class' => 'text-end'
                    ],
                    'opc'           => 0
                ];
            }
        }

        return [
            'row'    => $__row,
            'totals' => [
                'importe'       => evaluar($totalImporte),
                'descuento'     => evaluar($totalDescuento),
                'efectivo'      => evaluar($totalEfectivo),
                'tarjeta'       => evaluar($totalTarjeta),
                'transferencia' => evaluar($totalTransferencia),
                'total_tickets' => $totalTickets,
            ]
        ];
    }

    function showShiftDetail() {
        if ($_SESSION['ROLID'] != 1) {
            return ['status' => 403, 'message' => 'No tienes permisos'];
        }

        $id    = $_POST['id'];
        $shift = $this->getShiftDetailById([$id]);

        if (!$shift) {
            return ['status' => 500, 'message' => 'Turno no encontrado'];
        }

        $tickets = $this->getShiftTickets([$id]);
        $__row   = [];

        if (is_array($tickets)) {
            foreach ($tickets as $ticket) {
                $__row[] = [
                    'id'        => $ticket['folio_cuenta'],
                    'Folio'     => str_pad($ticket['folio_cuenta'], 8, '0', STR_PAD_LEFT),
                    'Fecha'     => formatSpanishDate($ticket['fecha']),
                    'Cuenta'    => $ticket['cuenta'],
                    'Descuento' => [
                        'html'  => evaluar($ticket['descuento_importe']),
                        'class' => 'text-end'
                    ],
                    'Importe'   => [
                        'html'  => evaluar($ticket['importe']),
                        'class' => 'text-end bg-[#283341] font-bold'
                    ],
                    'Efectivo'  => [
                        'html'  => evaluar($ticket['efectivo']),
                        'class' => 'text-end'
                    ],
                    'Tarjeta'   => [
                        'html'  => evaluar($ticket['tarjeta']),
                        'class' => 'text-end'
                    ],
                    'Transf.'   => [
                        'html'  => evaluar($ticket['transferencia']),
                        'class' => 'text-end'
                    ],
                    'opc' => 0
                ];
            }
        }

        return [
            'status'  => 200,
            'shift'   => $shift,
            'tickets' => $__row,
        ];
    }

    function lsPedidosDetalle() {
        if ($_SESSION['ROLID'] != 1) {
            return ['status' => 403, 'message' => 'No tienes permisos'];
        }

        $fi        = $_POST['fi'];
        $ff        = $_POST['ff'];
        $sub_id    = $_POST['sub_id'];
        $estado    = $_POST['estado'];
        $descuento = $_POST['descuento'];

        $ls = $this->listPedidosDetalle([
            $fi, $ff,
            $sub_id, $sub_id,
            $estado, $estado,
            $descuento, $descuento, $descuento
        ]);

        $__row = [];

        $totalImporte       = 0;
        $totalDescuento     = 0;
        $totalAbono         = 0;
        $totalSaldo         = 0;
        $totalEfectivo      = 0;
        $totalTarjeta       = 0;
        $totalTransferencia = 0;
        $totalPedidos       = 0;

        if (is_array($ls)) {
            foreach ($ls as $pedido) {
                $total      = floatval($pedido['total_pay']);
                $descuentoP = floatval($pedido['descuento_importe']);
                $abono      = floatval($pedido['abono']);
                $saldo      = $total - $abono;

                $totalImporte       += $total;
                $totalDescuento     += $descuentoP;
                $totalAbono         += $abono;
                $totalSaldo         += $saldo;
                $totalEfectivo      += floatval($pedido['efectivo']);
                $totalTarjeta       += floatval($pedido['tarjeta']);
                $totalTransferencia += floatval($pedido['transferencia']);
                $totalPedidos++;

                $entrega = $pedido['date_order']
                    ? formatSpanishDate($pedido['date_order']) . ' ' . $pedido['time_order']
                    : '-';

                $clienteHtml = '<div>' . $pedido['cuenta'] . '</div>'
                    . '<div class="text-xs text-gray-500">' . $pedido['phone'] . '</div>';

                $saldoClass = $saldo > 0
                    ? 'text-end text-red-400'
                    : 'text-end text-gray-500';

                $__row[] = [
                    'id'        => 'ped_' . $pedido['id'],
                    'Folio'     => str_pad($pedido['id'], 8, '0', STR_PAD_LEFT),
                    'Cliente'   => ['html' => $clienteHtml, 'class' => 'text-start'],
                    'Fecha'     => formatSpanishDate($pedido['fecha_creacion']),
                    'Abono'     => ['html' => evaluar($abono), 'class' => 'text-end text-green-400'],
                    'Total'     => ['html' => evaluar($total), 'class' => 'text-end font-bold'],
                    'Saldo'     => ['html' => evaluar($saldo), 'class' => $saldoClass],
                    'Entrega'   => $entrega,
                    'Estado'    => ['html' => renderStatusBadge($pedido['status']), 'class' => 'text-center'],
                    'Entregado' => ['html' => renderDeliveryBadge($pedido['is_delivered'], $pedido['status']), 'class' => 'text-center'],
                    'Tipo'      => ['html' => renderDeliveryTypeIcon($pedido['delivery_type']), 'class' => 'text-center'],
                    'opc'       => 1
                ];

                $items = $this->getPedidoItemsByOrder([$pedido['id']]);
                if (is_array($items)) {
                    foreach ($items as $item) {
                        $itemHtml = $item['nombre']
                            . ' <span class="text-gray-500">x' . intval($item['quantity']) . '</span>';

                        $__row[] = [
                            'id'        => 'ped_' . $pedido['id'] . '_item_' . $item['id'],
                            'Folio'     => '',
                            'Cliente'   => ['html' => $itemHtml, 'class' => 'text-start text-xs'],
                            'Fecha'     => '',
                            'Abono'     => '',
                            'Total'     => ['html' => evaluar($item['subtotal']), 'class' => 'text-end text-xs'],
                            'Saldo'     => '',
                            'Entrega'   => '',
                            'Estado'    => '',
                            'Entregado' => '',
                            'Tipo'      => '',
                            'opc'       => 0
                        ];
                    }
                }
            }
        }

        return [
            'row'    => $__row,
            'totals' => [
                'importe'       => evaluar($totalImporte),
                'descuento'     => evaluar($totalDescuento),
                'abono'         => evaluar($totalAbono),
                'saldo'         => evaluar($totalSaldo),
                'efectivo'      => evaluar($totalEfectivo),
                'tarjeta'       => evaluar($totalTarjeta),
                'transferencia' => evaluar($totalTransferencia),
                'total_pedidos' => $totalPedidos,
            ]
        ];
    }
}

// Complements
function buildProductHtml($productos) {
    if (!is_array($productos) || empty($productos)) return '<span class="text-gray-500 text-xs">Sin productos</span>';

    $items = [];
    foreach ($productos as $producto) {
        $qty  = intval($producto['quantity']);
        $name = $producto['nombre'];
        $items[] = '<span class="text-xs">' . $qty . 'x ' . $name . '</span>';
    }

    return implode('<br>', $items);
}

function statusShift($status) {
    $statuses = [
        'open'   => ['bg' => 'bg-green-100', 'text' => 'text-green-700', 'label' => 'Abierto'],
        'closed' => ['bg' => 'bg-gray-100',  'text' => 'text-gray-700',  'label' => 'Cerrado'],
    ];

    $style = $statuses[$status] ?? ['bg' => 'bg-gray-100', 'text' => 'text-gray-700', 'label' => 'Desconocido'];
    return '<span class="px-2 py-1 rounded text-xs font-bold ' . $style['bg'] . ' ' . $style['text'] . '">' . $style['label'] . '</span>';
}

function renderStatusBadge($status) {
    $map = [
        1 => ['label' => 'COTIZACIÓN', 'class' => 'bg-blue-500/15 text-blue-400 border border-blue-500/30'],
        2 => ['label' => 'PENDIENTE',  'class' => 'bg-yellow-500/15 text-yellow-400 border border-yellow-500/30'],
        3 => ['label' => 'PAGADO',     'class' => 'bg-green-500/15 text-green-400 border border-green-500/30'],
        4 => ['label' => 'CANCELADO',  'class' => 'bg-red-500/15 text-red-400 border border-red-500/30'],
    ];

    $style = isset($map[$status]) ? $map[$status] : ['label' => 'N/A', 'class' => 'bg-gray-500/15 text-gray-400 border border-gray-500/30'];
    return '<span class="text-[11px] px-2 py-[2px] rounded-full font-medium ' . $style['class'] . '">' . $style['label'] . '</span>';
}

function renderDeliveryBadge($is_delivered, $status) {
    if ($status == 1) {
        return '<span class="text-xs text-gray-400">No aplica</span>';
    }

    $map = [
        0 => ['label' => 'No entregado',  'class' => 'bg-red-500/15 text-red-400 border border-red-500/30'],
        1 => ['label' => 'Entregado',     'class' => 'bg-green-500/15 text-green-400 border border-green-500/30'],
        2 => ['label' => 'Para producir', 'class' => 'bg-fuchsia-500/15 text-fuchsia-400 border border-fuchsia-500/30'],
    ];

    $style = isset($map[$is_delivered]) ? $map[$is_delivered] : ['label' => 'N/A', 'class' => 'bg-gray-500/15 text-gray-400 border border-gray-500/30'];
    return '<span class="text-[11px] px-2 py-[2px] rounded-full font-medium ' . $style['class'] . '">' . $style['label'] . '</span>';
}

function renderDeliveryTypeIcon($delivery_type) {
    if ($delivery_type == 1) {
        return '<i class="icon-motorcycle text-amber-500" title="Domicilio"></i>';
    }
    return '<i class="icon-home text-gray-300" title="Local"></i>';
}

$obj = new ctrl();
echo json_encode($obj->{$_POST['opc']}());
