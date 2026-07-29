<?php
session_start();
if (empty($_POST['opc'])) exit(0);

require_once '../mdl/mdl-facture-tickets.php';

class ctrl extends mdl {

    public $subsidiariesId;
    public $userId;

    public function __construct() {
        parent::__construct();
        $this->subsidiariesId = (int) ($_SESSION['SUB'] ?? $_POST['subsidiaries_id'] ?? 0);
        $this->userId         = (int) ($_SESSION['USR'] ?? $_POST['user_id'] ?? 1);
    }

    // subsidiaries_id apunta por FK a fayxzvov_alpha.subsidiaries: un 0 sin
    // sucursal en sesion rompe la restriccion, y la columna admite NULL.
    function branchId() {
        return $this->subsidiariesId > 0 ? $this->subsidiariesId : null;
    }

    function init() {
        $formas = [['id' => '', 'valor' => 'Todas las formas']];
        foreach ($this->lsPaymentMethod([$this->branchId()]) as $item) {
            $formas[] = ['id' => $item['valor'], 'valor' => $item['valor']];
        }

        return [
            'formas'  => $formas,
            'estados' => [
                ['id' => '',         'valor' => 'Todos los estados'],
                ['id' => 'pending',  'valor' => 'Pendiente'],
                ['id' => 'invoiced', 'valor' => 'Facturado'],
                ['id' => 'zero',     'valor' => 'IVA 0%']
            ]
        ];
    }

    // -- Filtros --

    // El rango de la filterBar acota por dia completo: operation_date guarda la
    // hora del POS, asi que el corte del dia final va a las 23:59:59.
    function filtros() {
        $fi     = $_POST['fi'] ?: date('Y-m-01');
        $ff     = $_POST['ff'] ?: date('Y-m-t');
        $forma  = $_POST['forma']  ?? '';
        $estado = $_POST['estado'] ?? '';

        $filters = '';
        $data    = [$this->branchId(), $fi . ' 00:00:00', $ff . ' 23:59:59'];

        if ($forma !== '') {
            $filters .= "
                AND EXISTS (
                    SELECT 1
                    FROM {$this->bd}detail_sale_payment p
                    LEFT JOIN {$this->bd}payment_method pm ON pm.id = p.payment_method_id
                    WHERE p.active = 1 AND p.sale_folio = s.folio AND pm.name = ?
                )
            ";
            $data[] = $forma;
        }

        if ($estado === 'pending')  $filters .= " AND (st.name IS NULL OR st.name <> 'FACTURADO') ";
        if ($estado === 'invoiced') $filters .= " AND st.name = 'FACTURADO' ";
        if ($estado === 'zero')     $filters .= " AND s.tax = 0 ";

        return ['filters' => $filters, 'data' => $data];
    }

    // -- Listado --

    function lsTickets() {
        $__row   = [];
        $filtros = $this->filtros();
        $sum     = $this->sumTickets($filtros);

        foreach ($this->listTickets($filtros) as $item) {
            $tasa = tasaDe($item);

            $__row[] = [
                'id'             => $item['folio'],
                'Folio'          => '<span data-folio="' . $item['folio'] . '" class="font-mono text-[10px] text-gray-400">' . $item['folio'] . '</span>',
                'Fecha'          => '<span class="text-gray-400 whitespace-nowrap">' . date('d/m/Y', strtotime($item['operation_date'])) . '</span>',
                'Forma de pago'  => badgeMetodo($item['payment_name']),
                'Metodo'         => '<span class="text-gray-400">PUE</span>',
                'Estado fiscal'  => badgeEstadoFiscal($item['status_name'], $item['tax']),
                'Tasa'           => badgeTasa($tasa),
                'Subtotal'       => '<span class="text-gray-400">' . money($item['subtotal']) . '</span>',
                'IVA'            => '<span class="text-gray-400">' . money($item['tax']) . '</span>',
                'IEPS'           => '<span class="text-gray-400">' . money(0) . '</span>',
                'Total'          => '<span class="font-semibold text-white">' . money($item['total']) . '</span>',
                'Factura'        => badgeFactura($item['invoice_series']),
                'a'              => actionButtons($item['folio'])
            ];
        }

        // El listado va topado: un mes completo son ~3 800 tickets y la tabla los
        // pinta todos en el DOM. El total real viaja aparte para que el pie lo diga.
        return [
            'row'   => $__row,
            'thead' => '',
            'total' => (int) ($sum[0]['tickets'] ?? count($__row))
        ];
    }

    function showKpis() {
        $sum = $this->sumTickets($this->filtros());
        $sum = $sum[0] ?? ['tickets' => 0, 'monto' => 0, 'facturados' => 0, 'cero' => 0];

        return [
            'tickets'    => (int) $sum['tickets'],
            'monto'      => (float) $sum['monto'],
            'montoTexto' => money($sum['monto']),
            'facturados' => (int) $sum['facturados'],
            'cero'       => (int) $sum['cero']
        ];
    }

    // -- Detalle fiscal --

    function getTicket() {
        $folio = $_POST['folio'] ?? '';
        $ls    = $this->getTicketByFolio([$folio, $this->branchId()]);

        if (empty($ls)) {
            return ['status' => 404, 'message' => 'El ticket no existe'];
        }

        $item  = $ls[0];
        $tasa  = tasaDe($item);
        $extra = $this->getTicketWaiter([$folio]);

        return [
            'status' => 200,
            'ticket' => [
                'folio'    => $item['folio'],
                'fecha'    => date('d/m/Y H:i', strtotime($item['operation_date'])),
                'mesa'     => $extra[0]['table_number']  ?? '',
                'mesero'   => $extra[0]['waiter_name']   ?? '',
                'pago'     => $item['payment_name'] ?: 'SIN PAGO REGISTRADO',
                'metodo'   => 'PUE',
                'tasa'     => porcentaje($tasa),
                'subtotal' => money($item['subtotal']),
                'iva'      => money($item['tax']),
                'ieps'     => money(0),
                'total'    => money($item['total']),
                'estado'   => estadoTexto($item['status_name'], $item['tax']),
                'factura'  => $item['invoice_series'] ?: 'SIN FACTURA',
                'badge'    => badgeEstadoFiscal($item['status_name'], $item['tax'])
            ]
        ];
    }
}

// Complements

// Ningun Excel trae la tasa: se deduce del par subtotal/impuesto del ticket.
function tasaDe($item) {
    $subtotal = (float) $item['subtotal'];
    return $subtotal > 0 ? round((float) $item['tax'] / $subtotal, 2) : 0;
}

function money($valor) {
    return '$' . number_format((float) $valor, 2);
}

function porcentaje($tasa) {
    return round($tasa * 100) . '%';
}

function esFacturado($statusName) {
    return strtoupper((string) $statusName) === 'FACTURADO';
}

function estadoTexto($statusName, $tax) {
    if (esFacturado($statusName))  return 'FACTURADO';
    if ((float) $tax == 0)         return 'IVA 0%';
    return 'PENDIENTE';
}

function badgeEstadoFiscal($statusName, $tax) {
    if (esFacturado($statusName)) return '<span class="badge-base b-green"><i data-lucide="lock" class="w-3 h-3"></i>Facturado</span>';
    if ((float) $tax == 0)        return '<span class="badge-base b-yellow">IVA 0%</span>';
    return '<span class="badge-base b-gray">Pendiente</span>';
}

// Un ticket puede pagarse con dos formas: el modelo permite hasta 3 pagos.
function badgeMetodo($payment) {
    if (!$payment) return '<span class="cell-null">Sin pago</span>';

    $tone = strpos(strtoupper($payment), 'EFECTIVO') !== false ? 'b-green' : 'b-terra';
    return '<span class="badge-base ' . $tone . '">' . $payment . '</span>';
}

function badgeTasa($tasa) {
    $tone = $tasa == 0 ? 'b-yellow' : 'b-terra';
    return '<span class="badge-base ' . $tone . '">' . porcentaje($tasa) . '</span>';
}

function badgeFactura($serie) {
    if (!$serie) return '<span class="cell-null">Sin factura</span>';
    return '<span class="badge-base b-terra">' . $serie . '</span>';
}

function actionButtons($folio) {
    return [
        [
            'class'   => 'btn-ghost !py-1 !px-2 text-[11px]',
            'html'    => '<i data-lucide="eye" class="w-3.5 h-3.5"></i>Ver',
            'onclick' => "app.selectTicket('{$folio}')"
        ],
        [
            'class'   => 'btn-ghost !py-1 !px-2 text-[11px]',
            'html'    => '<i data-lucide="printer" class="w-3.5 h-3.5"></i>Ticket',
            'onclick' => "tickets.openGenerador('{$folio}')"
        ]
    ];
}

$obj = new ctrl();
echo json_encode($obj->{$_POST['opc']}());
