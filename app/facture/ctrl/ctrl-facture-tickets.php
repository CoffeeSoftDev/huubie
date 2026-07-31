<?php
session_start();
if (empty($_POST['opc'])) exit(0);

require_once '../mdl/mdl-facture-tickets.php';

// Que parte de la venta del dia se factura es politica de la casa, no un dato de
// la base: por eso vive aqui y no en una tabla. Resumen ofrece el mismo numero
// como selector (60/80/100); en Tickets es fijo porque el modulo trabaja el
// cierre del dia contra una sola meta.
define('META_FACTURACION', 0.7);

class ctrl extends mdl {

    public $branch;

    public function __construct() {
        parent::__construct();
        $this->branch = $this->resolveBranch();
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

    // El dia no se elige solo: el Excel del POS se sube en diferido, asi que el
    // modulo abre en el ultimo dia que tiene cobros por banco. Con ?dia= entra
    // directo a ese dia si tiene ventas.
    function init() {
        $dias = $this->lsDias([$this->branchId()]);
        $pide = $_POST['dia'] ?? '';
        $dia  = '';

        foreach ($dias as $item) {
            if ($item['id'] === $pide) $dia = $pide;
        }

        return [
            'dias'   => $dias,
            'dia'    => $dia ?: ($dias[0]['id'] ?? date('Y-m-d')),
            'emisor' => $this->emisor()
        ];
    }

    function emisor() {
        $ls = $this->getEmisor([$this->branchId()]);

        if (empty($ls)) return ['razon' => '', 'domicilio' => '', 'telefono' => ''];

        return [
            'razon'     => $ls[0]['business_name'] ?: $ls[0]['company_name'],
            'domicilio' => $ls[0]['fiscal_address'],
            'telefono'  => $ls[0]['phone']
        ];
    }

    // -- Filtros --

    function filtros() {
        $like = '%' . trim($_POST['q'] ?? '') . '%';

        return [$this->branchId(), $_POST['dia'] ?? date('Y-m-d'), $like, $like, $like];
    }

    // -- Listado del dia --

    // La nota es el consecutivo del dia: cuando el ticket ya se genero es la que
    // quedo guardada, y mientras no exista se muestra la posicion que le tocaria.
    function lsTickets() {
        $ventas = $this->listTicketsByDay($this->filtros());
        $conteo = $this->getTicketDayCounts([$this->branchId(), $_POST['dia'] ?? date('Y-m-d')]);
        $__row  = [];
        $orden  = 0;

        foreach ($ventas as $item) {
            $orden++;
            $__row[] = $this->ticketRow($item, $orden);
        }

        $c = $conteo[0] ?? [
            'tickets' => 0, 'facturados'      => 0, 'cero' => 0, 'generados' => 0,
            'total'   => 0, 'total_facturado' => 0
        ];

        return [
            'row'    => $__row,
            'thead'  => '',
            'counts' => [
                'tickets'    => (int) $c['tickets'],
                'facturados' => (int) $c['facturados'],
                'cero'       => (int) $c['cero'],
                'generados'  => (int) $c['generados'],
                'mostrados'  => count($__row)
            ],
            'kpis'   => $this->kpisDelDia($c)
        ];
    }

    // Las tarjetas del encabezado. Los montos viajan ya escritos: la pantalla los
    // imprime, no los calcula, igual que el papel del ticket.
    //
    // El universo es el mismo que lista la tabla (lo cobrado por banco), asi que
    // estos numeros NO cuadran con los de Resumen, que suma tambien el efectivo. Es
    // a proposito y las tarjetas lo dicen.
    //
    // Lo facturado son las ventas congeladas: las que el POS reporta FACTURADO y ya
    // traen folio de factura. El ticket virtual no mueve esta cifra, porque generar
    // el papel no factura nada todavia.
    function kpisDelDia($c) {
        $total     = (float) $c['total'];
        $facturado = (float) $c['total_facturado'];
        $objetivo  = $total * META_FACTURACION;

        // Lo que no va al 16% va al 0%: el objetivo de la tasa cero es el
        // complemento de la meta, no un porcentaje aparte. Derivarlo asi mantiene
        // las dos tarjetas sumando la venta del dia si la meta cambia.
        $objetivoCero = $total * (1 - META_FACTURACION);

        return [
            'metaPct'           => round(META_FACTURACION * 100),
            'metaCeroPct'       => round((1 - META_FACTURACION) * 100),
            'totalTexto'        => money($total),
            'objetivoTexto'     => money($objetivo),
            'objetivoCeroTexto' => money($objetivoCero),
            'facturadoTexto'    => money($facturado),
            // Rebasar la meta no deja un negativo en pantalla: ya no falta nada.
            'porFacturarTexto'  => money(max(0, $objetivo - $facturado)),
            'tickets'           => (int) $c['tickets'],
            'facturados'        => (int) $c['facturados']
        ];
    }

    function ticketRow($item, $orden) {
        $tasa = tasaDe($item);

        return [
            'id'     => $item['folio'],
            'Nota'   => notaCelda($item['note_number'], $orden),
            'Folio'  => '<span data-folio="' . $item['folio'] . '" class="font-mono text-[10px] text-gray-400">' . $item['folio'] . '</span>',
            'Tasa'   => badgeTasa($tasa),
            'Estado' => badgeEstado($item, $tasa),
            'Monto'  => '<span class="font-semibold text-white">' . money($item['total']) . '</span>',
            'a'      => accionTicket($item, $tasa)
        ];
    }

    // -- Ticket virtual --

    // El papel se arma con lo que ya esta guardado; si el ticket todavia no se
    // genero se devuelve la propuesta (los mismos renglones que se guardarian) para
    // que se pueda ver antes de decidir.
    function getTicket() {
        $folio = $_POST['folio'] ?? '';
        $ls    = $this->getTicketByFolio([$folio, $this->branchId()]);

        if (empty($ls)) return ['status' => 404, 'message' => 'La venta no existe'];

        $item     = $ls[0];
        $generado = !empty($item['virtual_id']);
        $armado   = $generado ? $this->ticketGuardado($item) : $this->armarTicket($item);

        if ($armado['status'] !== 200) return $armado;

        return [
            'status' => 200,
            'ticket' => array_merge($this->cabecera($item), $armado['ticket'], [
                'generado' => $generado
            ])
        ];
    }

    // Datos del ticket que no dependen de los productos puente: son los del ticket
    // real del POS y se imprimen igual este o no generado. La nota solo existe
    // cuando el ticket ya se guardo, porque es el consecutivo que se entrega.
    function cabecera($item) {
        $tasa = tasaDe($item);

        return [
            'folio'    => $item['folio'],
            'nota'     => $item['note_number'] ? '#' . $item['note_number'] : 'POR ASIGNAR',
            'fecha'    => date('d/m/Y', strtotime($item['operation_date'])),
            'hora'     => date('H:i', strtotime($item['operation_date'])),
            'mesa'     => $item['table_number'] ?: '',
            'mesero'   => $item['waiter_name'] ?: '',
            'metodo'   => $item['payment_name'] ?: 'SIN PAGO REGISTRADO',
            'tasa'     => $tasa,
            'tasaText' => porcentaje($tasa),
            'total'    => money($item['total']),
            'estado'   => estadoTexto($item, $tasa),
            'factura'  => $item['invoice_series'] ?: ''
        ];
    }

    function ticketGuardado($item) {
        $lineas = [];

        foreach ($this->listVirtualDetail([$item['virtual_id']]) as $renglon) {
            $lineas[] = [
                'cant'    => cantidad($renglon['quantity']),
                'nombre'  => $renglon['description'],
                'importe' => money($renglon['amount'])
            ];
        }

        return [
            'status' => 200,
            'ticket' => [
                'lineas'    => $lineas,
                'subtotal'  => money($item['virtual_subtotal']),
                'descuento' => money($item['virtual_discount'])
            ]
        ];
    }

    // Arma los renglones que suman el total del ticket con los productos marcados
    // como puente en Catalogos: del mas caro al mas barato se mete la cantidad que
    // cabe, y cuando ya no cabe ninguno completo se agrega una pieza mas del mas
    // barato. Esa ultima pieza se pasa del monto a proposito: el excedente se
    // descuenta para que el papel cuadre EXACTO con lo que se cobro.
    function armarTicket($item) {
        $puente = $this->listBridgeProducts([$this->branchId()]);

        if (empty($puente)) {
            return [
                'status'  => 400,
                'message' => 'No hay productos auxiliares dados de alta. Registralos en Catalogos para poder armar el ticket.'
            ];
        }

        $total    = (float) $item['total'];
        $restante = $total;
        $cuenta   = [];

        foreach ($puente as $producto) {
            $precio = (float) $producto['price'];
            $cant   = (int) floor($restante / $precio);

            if ($cant <= 0) continue;

            $cuenta[$producto['id']] = ['producto' => $producto, 'cant' => $cant];
            $restante -= $cant * $precio;
        }

        // Lo que queda no lo cubre ninguna pieza completa: la cierra el puente mas
        // barato, que es el que menos excedente deja. Si ese producto ya tiene
        // renglon se le suma la pieza ahi, para no repetirlo dos veces en el papel.
        if ($restante > 0.009) {
            $barato = end($puente);
            $id     = $barato['id'];

            if (isset($cuenta[$id])) $cuenta[$id]['cant']++;
            else                     $cuenta[$id] = ['producto' => $barato, 'cant' => 1];
        }

        $lineas   = [];
        $subtotal = 0;

        foreach ($cuenta as $renglon) {
            $linea    = $this->lineaPuente($renglon['producto'], $renglon['cant']);
            $lineas[] = $linea;
            $subtotal += $linea['amount'];
        }

        return [
            'status'   => 200,
            'lineas'   => $lineas,
            'subtotal' => $subtotal,
            'ticket'   => [
                'lineas'    => array_map(function ($linea) {
                    return [
                        'cant'    => cantidad($linea['quantity']),
                        'nombre'  => $linea['description'],
                        'importe' => money($linea['amount'])
                    ];
                }, $lineas),
                'subtotal'  => money($subtotal),
                'descuento' => money($subtotal - $total)
            ]
        ];
    }

    function lineaPuente($producto, $cant) {
        return [
            'description' => $producto['name'],
            'quantity'    => $cant,
            'unit_price'  => (float) $producto['price'],
            'amount'      => $cant * (float) $producto['price'],
            'product_id'  => $producto['id']
        ];
    }

    // -- Acciones --

    function generate() {
        $folio     = $_POST['folio'] ?? '';
        $resultado = $this->generarFolio($folio);

        return $resultado;
    }

    // Genera de una sola pasada los tickets del dia que van al 0% y no tienen uno:
    // es el trabajo repetitivo del cierre, y hacerlo ticket por ticket seria una
    // peticion por cada uno.
    function generateAllZero() {
        $dia        = $_POST['dia'] ?? date('Y-m-d');
        $pendientes = $this->listPendingZero([$this->branchId(), $dia]);

        if (empty($pendientes)) {
            return ['status' => 400, 'message' => 'No hay tickets con IVA 0% por generar en el dia'];
        }

        $generados = 0;
        $ultimo    = '';

        foreach ($pendientes as $item) {
            $resultado = $this->generarFolio($item['folio']);

            if ($resultado['status'] === 200) {
                $generados++;
                $ultimo = $item['folio'];
                continue;
            }

            // Sin productos puente ninguno va a poder armarse: se corta aqui en vez
            // de repetir el mismo error una vez por ticket.
            if ($resultado['status'] === 400) return $resultado;
        }

        return [
            'status'    => $generados > 0 ? 200 : 500,
            'message'   => $generados > 0
                ? number_format($generados) . ' ticket(s) virtual(es) generados'
                : 'No se pudo generar ningun ticket virtual',
            'generados' => $generados,
            'folio'     => $ultimo
        ];
    }

    // Regenerar es volver a armar el mismo ticket: se borra el anterior (sus
    // renglones se van con el) y se conserva su numero de nota, porque la nota ya
    // se entrego y no puede cambiar de numero.
    function generarFolio($folio) {
        $ls = $this->getTicketByFolio([$folio, $this->branchId()]);

        if (empty($ls)) return ['status' => 404, 'message' => 'La venta no existe'];

        $item = $ls[0];

        if (esFacturado($item['status_name'])) {
            return ['status' => 400, 'message' => 'El ticket ya esta facturado con el folio ' . $item['invoice_series']];
        }

        $armado = $this->armarTicket($item);
        if ($armado['status'] !== 200) return $armado;

        $dia  = date('Y-m-d', strtotime($item['operation_date']));
        $nota = (int) $item['note_number'];

        if (!empty($item['virtual_id'])) {
            $this->deleteVirtualTicket($this->util->sql(['id' => $item['virtual_id']], 1));
        }

        if ($nota === 0) {
            $siguiente = $this->getNextNote([$dia, $this->branchId()]);
            $nota      = (int) ($siguiente[0]['nota'] ?? 1);
        }

        $subtotal = $armado['subtotal'];
        $total    = (float) $item['total'];

        $creado = $this->createVirtualTicket($this->util->sql([[
            'note_number' => $nota,
            'subtotal'    => $subtotal,
            'discount'    => $subtotal - $total,
            'total'       => $total,
            'issue_date'  => $dia,
            'sale_id'     => $item['id'],
            'branch_id'   => $this->branchId()
        ]]));

        if (!$creado) return ['status' => 500, 'message' => 'No se pudo guardar el ticket virtual'];

        $max      = $this->getMaxVirtualTicketId();
        $ticketId = (int) ($max[0]['id'] ?? 0);
        $renglones = [];

        foreach ($armado['lineas'] as $linea) {
            $renglones[] = [
                'description'       => $linea['description'],
                'quantity'          => $linea['quantity'],
                'unit_price'        => $linea['unit_price'],
                'amount'            => $linea['amount'],
                'product_id'        => $linea['product_id'],
                'virtual_ticket_id' => $ticketId
            ];
        }

        $this->createVirtualDetail($this->util->sql($renglones));

        return [
            'status'  => 200,
            'message' => 'Ticket virtual generado con la nota #' . $nota,
            'nota'    => $nota,
            'folio'   => $folio
        ];
    }
}

// Complements

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

// La cantidad se imprime entera cuando lo es: los puente se venden por pieza.
function cantidad($valor) {
    $valor = (float) $valor;

    if ($valor == floor($valor)) return number_format($valor, 0);

    return rtrim(rtrim(number_format($valor, 3), '0'), '.');
}

function esFacturado($statusName) {
    return strtoupper((string) $statusName) === 'FACTURADO';
}

// La nota ya generada se dice con su numero; la que aun no existe se muestra en
// gris con la posicion que le tocaria en el dia.
function notaCelda($nota, $orden) {
    if ($nota) return '<span class="font-bold text-gray-300">#' . $nota . '</span>';

    return '<span class="text-gray-500">#' . $orden . '</span>';
}

function badgeTasa($tasa) {
    $tone = $tasa == 0 ? 'b-yellow' : 'b-terra';
    return '<span class="badge-base ' . $tone . '">' . porcentaje($tasa) . '</span>';
}

// Tres estados: el facturado esta bloqueado (no se le arma nada), el de tasa 0
// pide ticket virtual y el resto queda pendiente de facturar.
function badgeEstado($item, $tasa) {
    if (esFacturado($item['status_name'])) {
        return '<span class="badge-base b-green"><i data-lucide="lock" class="w-3 h-3"></i>Facturado ' . $item['invoice_series'] . '</span>';
    }

    if (!empty($item['virtual_id'])) {
        return '<span class="badge-base b-blue">Ticket generado</span>';
    }

    if ($tasa == 0) return '<span class="badge-base b-yellow">Requiere ticket virtual</span>';

    return '<span class="badge-base b-gray">No facturado</span>';
}

function estadoTexto($item, $tasa) {
    if (esFacturado($item['status_name'])) return 'FACTURADO';
    if ($tasa == 0)                        return 'IVA 0%';

    return $item['status_name'] ? strtoupper($item['status_name']) : 'SIN ESTADO';
}

// Una accion por fila y segun el estado: el facturado solo avisa que esta
// bloqueado, el resto abre su ticket virtual (y lo genera si no existe).
function accionTicket($item, $tasa) {
    $folio = $item['folio'];

    if (esFacturado($item['status_name'])) {
        return [
            [
                'class'   => 'btn-icon-view',
                'html'    => '<i data-lucide="lock" class="w-3.5 h-3.5"></i>',
                'title'   => 'Facturado: no se le arma ticket virtual',
                'onclick' => "tickets.lockedNotice('{$folio}')"
            ]
        ];
    }

    $icono = empty($item['virtual_id']) ? 'eye' : 'eye-off';
    $texto = empty($item['virtual_id']) ? 'Armar el ticket virtual' : 'Ver el ticket virtual';

    return [
        [
            'class'   => 'btn-icon-view',
            'html'    => '<i data-lucide="' . $icono . '" class="w-3.5 h-3.5"></i>',
            'title'   => $texto,
            'onclick' => "app.selectTicket('{$folio}')"
        ]
    ];
}

$obj = new ctrl();
echo json_encode($obj->{$_POST['opc']}());
