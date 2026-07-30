<?php
session_start();
if (empty($_POST['opc'])) exit(0);

require_once '../mdl/mdl-facture-ventas.php';

class ctrl extends mdl {

    public $branch;
    public $userId;

    public function __construct() {
        parent::__construct();
        $this->branch = $this->resolveBranch();
        $this->userId = (int) ($_SESSION['USR'] ?? $_POST['user_id'] ?? 1);
    }

    // El facturador tiene su propia tabla branch: el id de sucursal de la sesion
    // de Huubie (SUB) es de otro esquema y no cruza con este. Se resuelve contra
    // fayxzvov_facturacion.branch y se cachea en sesion.
    function resolveBranch() {
        if (!empty($_SESSION['FACTURE_BRANCH'])) return (int) $_SESSION['FACTURE_BRANCH'];

        $ls = $this->getBranch();
        $id = (int) ($ls[0]['id'] ?? 0);
        if ($id > 0) $_SESSION['FACTURE_BRANCH'] = $id;

        return $id;
    }

    // branch_id admite NULL: sin sucursal dada de alta el modulo lee las filas
    // sin sucursal en vez de romper la FK.
    function branchId() {
        return $this->branch > 0 ? $this->branch : null;
    }

    // El POS desglosa seis formas de pago (EFECTIVO, DEBITO, VISA, MASTERCARD,
    // AMERICAN EXPRESS, TRANSFERENCIA), pero para facturar solo importa por donde
    // entro el cobro: efectivo o banco. Las tarjetas y las transferencias van
    // juntas en "Bancos", que es como se piden los complementos de pago.
    function init() {
        $estados = [['id' => '', 'valor' => 'Todos los estados']];
        foreach ($this->lsSaleStatus() as $item) {
            $estados[] = ['id' => $item['valor'], 'valor' => ucfirst(strtolower($item['valor']))];
        }

        // La tasa 0% no es un estado del POS: se deduce del impuesto del ticket,
        // por eso se agrega al final del catalogo y no sale de sale_status.
        $estados[] = ['id' => 'zero', 'valor' => 'IVA 0%'];

        return [
            'formas' => [
                ['id' => '',         'valor' => 'Todas las formas'],
                ['id' => 'efectivo', 'valor' => 'Efectivo'],
                ['id' => 'bancos',   'valor' => 'Bancos (tarjetas y transferencias)']
            ],
            'estados' => $estados,
            'periodo' => $this->lastPeriod()
        ];
    }

    // -- Filtros --

    // Sin tickets cargados no hay periodo que abrir: se cae al mes en curso.
    function lastPeriod() {
        $ls = $this->getLastPeriod([$this->branchId()]);
        $fi = $ls[0]['fi'] ?? '';
        $ff = $ls[0]['ff'] ?? '';

        return [
            'fi' => $fi ?: date('Y-m-01'),
            'ff' => $ff ?: date('Y-m-t')
        ];
    }

    // Los nombres de las tarjetas no se escriben en el SQL: se leen del catalogo
    // de la sucursal y todo lo que no es EFECTIVO cae en "Bancos". Asi, si el POS
    // da de alta otra tarjeta, entra sola al filtro.
    function formasDe($grupo) {
        $nombres = [];

        foreach ($this->lsPaymentMethod([$this->branchId()]) as $item) {
            $esEfectivo = strtoupper($item['valor']) === 'EFECTIVO';
            if ($grupo === 'efectivo' ? $esEfectivo : !$esEfectivo) $nombres[] = $item['valor'];
        }

        return $nombres;
    }

    // El rango de la filterBar acota por dia completo: operation_date guarda la
    // hora del POS, asi que el corte del dia final va a las 23:59:59. En modo Dia
    // el picker manda el mismo dia en fi y ff.
    function filtros() {
        $periodo = $this->lastPeriod();
        $fi      = ($_POST['fi'] ?? '') ?: $periodo['fi'];
        $ff      = ($_POST['ff'] ?? '') ?: $periodo['ff'];
        $forma   = $_POST['forma']  ?? '';
        $estado  = $_POST['estado'] ?? '';

        $filters = '';
        $data    = [$this->branchId(), $fi . ' 00:00:00', $ff . ' 23:59:59'];

        // Un ticket multipago entra en los dos grupos: se pregunta por existencia
        // de un pago del grupo, no por la forma del ticket completo.
        $nombres = $forma !== '' ? $this->formasDe($forma) : [];

        if ($nombres) {
            $in = implode(',', array_fill(0, count($nombres), '?'));

            $filters .= "
                AND EXISTS (
                    SELECT 1
                    FROM {$this->bd}detail_sale_payment p
                    LEFT JOIN {$this->bd}payment_method pm ON pm.id = p.payment_method_id
                    WHERE p.active = 1 AND p.sale_folio = s.folio AND pm.name IN ({$in})
                )
            ";
            $data = array_merge($data, $nombres);
        }

        // 'zero' se resuelve por impuesto; el resto son estados de sale_status y
        // llegan con su propio nombre.
        if ($estado === 'zero') {
            $filters .= " AND s.tax = 0 ";
        } elseif ($estado !== '') {
            $filters .= " AND st.name = ? ";
            $data[]   = $estado;
        }

        return [
            'filters' => $filters,
            'data'    => $data,
            'fi'      => $fi,
            'ff'      => $ff
        ];
    }

    // -- Listado --

    function lsVentas() {
        $filtros = $this->filtros();
        $sum     = $this->sumVentas($filtros);

        // El bloque por dia solo aplica cuando el periodo abarca mas de un dia:
        // en modo Dia todas las ventas caen en la misma fecha y el encabezado de
        // grupo repetiria el filtro.
        $agrupa = $filtros['fi'] !== $filtros['ff'];
        $__row  = [];

        foreach ($this->porDia($this->listVentas($filtros), $agrupa) as $dia => $grupo) {
            if ($agrupa) $__row[] = grupoDiaRow($dia, count($grupo));

            foreach ($grupo as $item) $__row[] = $this->ventaRow($item);
        }

        // El listado va topado: un mes completo son ~3 800 ventas y la tabla las
        // pinta todas en el DOM. El total real viaja aparte para que el pie lo diga.
        return [
            'row'   => $__row,
            'thead' => '',
            'total' => (int) ($sum[0]['ventas'] ?? count($__row))
        ];
    }

    // La consulta ya viene ordenada por operation_date, asi que el agrupado
    // conserva el orden del dia. Sin agrupar, todo va en un solo bloque.
    function porDia($ventas, $agrupa) {
        if (!$agrupa) return ['' => $ventas];

        $dias = [];

        foreach ($ventas as $item) {
            $dias[date('Y-m-d', strtotime($item['operation_date']))][] = $item;
        }

        return $dias;
    }

    // Todas las columnas salen de la venta y de sus pagos. La unica que no es
    // "IEPS", que va en cero porque el origen no desglosa ese impuesto: se pinta
    // igual para no dejar un hueco en el comprobante.
    function ventaRow($item) {
        $tasa = tasaDe($item);

        return [
            'id'             => $item['folio'],
            'Folio'          => '<span data-folio="' . $item['folio'] . '" class="font-mono text-[10px] text-gray-400">' . $item['folio'] . '</span>',
            'Fecha'          => '<span class="text-gray-400 whitespace-nowrap">' . date('d/m/Y', strtotime($item['operation_date'])) . '</span>',
            'Forma de pago'  => badgeMetodo($item['payment_name']),
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

    function showKpis() {
        $sum = $this->sumVentas($this->filtros());
        $sum = $sum[0] ?? ['ventas' => 0, 'monto' => 0, 'facturados' => 0, 'cero' => 0];

        return [
            'ventas'     => (int) $sum['ventas'],
            'monto'      => (float) $sum['monto'],
            'montoTexto' => money($sum['monto']),
            'facturados' => (int) $sum['facturados'],
            'cero'       => (int) $sum['cero']
        ];
    }

    // -- Detalle fiscal --

    function getVenta() {
        $folio = $_POST['folio'] ?? '';
        $ls    = $this->getVentaByFolio([$folio, $this->branchId()]);

        if (empty($ls)) {
            return ['status' => 404, 'message' => 'La venta no existe'];
        }

        $item = $ls[0];
        $tasa = tasaDe($item);

        // El detalle de la venta se completa con su comanda: mesa, mesero, horas y
        // los renglones que se consumieron. Vienen de comandas.xls, que es otra
        // hoja del export, asi que puede no haber nada que mostrar todavia.
        $cmd   = $this->getVentaComanda([$folio]);
        $cmd   = $cmd[0] ?? [];
        $items = $this->itemsDeComanda($folio);

        return [
            'status' => 200,
            'venta'  => [
                'folio'    => $item['folio'],
                'fecha'    => date('d/m/Y H:i', strtotime($item['operation_date'])),
                'mesa'     => $cmd['table_number'] ?? '',
                'mesero'   => $cmd['waiter_name']  ?? '',
                'comanda'  => $cmd['comanda_folio'] ?? '',
                'apertura' => hora($cmd['opened_at'] ?? null),
                'cierre'   => hora($cmd['closed_at'] ?? null),
                'items'    => $items,
                'consumo'  => money($cmd['importe'] ?? 0),
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

    // Renglones de la comanda listos para el papel de la venta.
    function itemsDeComanda($folio) {
        $__row = [];

        foreach ($this->listVentaItems([$folio]) as $item) {
            $__row[] = [
                'clave'     => $item['product_code'],
                'nombre'    => $item['description'],
                'cantidad'  => cantidad($item['quantity']),
                'descuento' => (float) $item['discount_percent'],
                'importe'   => money($item['amount'])
            ];
        }

        return $__row;
    }
}

// Complements

// Nombre del dia con su fecha, para el encabezado de cada bloque del rango.
function fechaLarga($dia) {
    $dias   = ['Domingo', 'Lunes', 'Martes', 'Miercoles', 'Jueves', 'Viernes', 'Sabado'];
    $tiempo = strtotime($dia);

    return $dias[(int) date('w', $tiempo)] . ' ' . date('d/m/Y', $tiempo);
}

// Encabezado del bloque de un dia. Lleva las mismas claves que la fila de venta
// (con 'a' vacio) porque DataTables exige el mismo numero de celdas en todas las
// filas: con un colspan la paginacion se rompe. opc = 1 la pinta como grupo.
function grupoDiaRow($dia, $ventas) {
    return [
        'id'             => 'dia' . str_replace('-', '', $dia),
        'opc'            => 1,
        'Folio'          => '<span class="whitespace-nowrap">' . fechaLarga($dia) . '</span>',
        'Fecha'          => '<span class="text-[10px] font-normal opacity-75 whitespace-nowrap">' . $ventas . ' ticket' . ($ventas === 1 ? '' : 's') . '</span>',
        'Forma de pago'  => '',
        'Estado fiscal'  => '',
        'Tasa'           => '',
        'Subtotal'       => '',
        'IVA'            => '',
        'IEPS'           => '',
        'Total'          => '',
        'Factura'        => '',
        'a'              => []
    ];
}

// Ningun Excel trae la tasa: se deduce del par subtotal/impuesto de la venta.
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

// Apertura y cierre de la comanda: del dia ya se habla en la fecha del ticket.
function hora($fecha) {
    return $fecha ? date('H:i', strtotime($fecha)) : '';
}

// La cantidad del POS es DOUBLE porque hay partidas al peso (0.096061): se
// imprime entera cuando lo es y con tres decimales cuando no.
function cantidad($valor) {
    $valor = (float) $valor;

    if ($valor == floor($valor)) return number_format($valor, 0);

    return rtrim(rtrim(number_format($valor, 3), '0'), '.');
}

function esFacturado($statusName) {
    return strtoupper((string) $statusName) === 'FACTURADO';
}

// El estado que no es FACTURADO se dice con el nombre que trae sale_status (el
// POS marca VENCIDO): "Pendiente" no existe en el catalogo.
function estadoTexto($statusName, $tax) {
    if (esFacturado($statusName)) return 'FACTURADO';
    if ((float) $tax == 0)        return 'IVA 0%';

    return $statusName ? strtoupper($statusName) : 'SIN ESTADO';
}

function badgeEstadoFiscal($statusName, $tax) {
    if (esFacturado($statusName)) return '<span class="badge-base b-green"><i data-lucide="lock" class="w-3 h-3"></i>Facturado</span>';
    if ((float) $tax == 0)        return '<span class="badge-base b-yellow">IVA 0%</span>';

    $texto = $statusName ? ucfirst(strtolower($statusName)) : 'Sin estado';
    return '<span class="badge-base b-gray">' . $texto . '</span>';
}

// Una venta puede pagarse con dos formas: el modelo permite hasta 3 pagos.
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

// Una sola accion en la fila y sin texto: abre el detalle fiscal de la venta en
// el panel de la derecha, que es la unica cosa que hace la fila.
function actionButtons($folio) {
    return [
        [
            'class'   => 'btn-ghost !py-1 !px-2 text-[11px]',
            'html'    => '<i data-lucide="eye" class="w-3.5 h-3.5"></i>',
            'onclick' => "app.selectVenta('{$folio}')"
        ]
    ];
}

$obj = new ctrl();
echo json_encode($obj->{$_POST['opc']}());
