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
        $this->branch  = $this->resolveBranch();
        $this->posCode = $this->resolvePos();
    }

    // Las reglas de elegibilidad cambian segun el POS del que salio el Excel, y el
    // modelo las arma dentro del SQL: el code tiene que estar resuelto antes de la
    // primera consulta, por eso se hace aqui y no en cada opcion.
    //
    // No se cachea en sesion como la sucursal: cambiar el POS del emisor tiene que
    // reflejarse en el listado sin volver a entrar al sistema.
    function resolvePos() {
        $ls = $this->getPosCode([$this->branchId()]);

        return strtolower((string) ($ls[0]['code'] ?? ''));
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
    // modulo abre en el ultimo dia con ventas elegibles (ver ventaElegible en el
    // modelo). Con ?dia= entra directo a ese dia si tiene ventas.
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

    // El membrete del papel se reparte entre las dos tablas: la sucursal encabeza y
    // pone el LUGAR DE EXPEDICION (donde se cobro), y la empresa pone el lema y el
    // domicilio fiscal, que es el que va bajo el RFC.
    function emisor() {
        $ls = $this->getEmisor([$this->branchId()]);

        if (empty($ls)) return emisorVacio();

        return [
            'razon'      => $ls[0]['business_name'] ?: $ls[0]['company_name'],
            'lema'       => $ls[0]['company_name'],
            'rfc'        => $ls[0]['rfc'] ?: $ls[0]['company_rfc'],
            // Sin domicilio de empresa capturado se imprime el de la sucursal: mas
            // vale repetirlo abajo que dejar el papel sin direccion.
            'domicilio'  => $ls[0]['company_address'] ?: $ls[0]['fiscal_address'],
            'expedicion' => $ls[0]['fiscal_address'],
            'telefono'   => $ls[0]['phone'] ?: $ls[0]['company_phone']
        ];
    }

    // -- Filtros --

    function filtros() {
        $like = '%' . trim($_POST['q'] ?? '') . '%';

        return [$this->branchId(), $_POST['dia'] ?? date('Y-m-d'), $like, $like, $like];
    }

    // -- Listado del dia --

    // La nota es el lugar que ocupa la venta en el dia, y ese lugar no cambia
    // nunca: la venta numero 7 por folio es la nota 7 antes y despues de que se
    // reparta el dia.
    function lsTickets() {
        $ventas = $this->listTicketsByDay($this->filtros());
        $conteo = $this->getTicketDayCounts([$this->branchId(), $_POST['dia'] ?? date('Y-m-d')]);
        $notas  = $this->notasDelDia($_POST['dia'] ?? date('Y-m-d'));
        $__row  = [];

        foreach ($ventas as $item) {
            $__row[] = $this->ticketRow($item, (int) ($notas[$item['id']] ?? 0));
        }

        $c = $conteo[0] ?? [
            'tickets' => 0, 'facturados'      => 0, 'cero'       => 0, 'generados' => 0,
            'total'   => 0, 'total_facturado' => 0, 'total_cero' => 0
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
    // El universo es el mismo que lista la tabla (lo que ventaElegible deja pasar),
    // asi que estos numeros NO cuadran con los de Resumen, que suma todas las formas
    // de pago. Es a proposito y las tarjetas lo dicen.
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

        // Lo que el reparto dejo de verdad en el cero, contra lo que debio dejar. El
        // mejor ajuste toma ventas completas y no puede partir un ticket, asi que la
        // diferencia siempre existe: mostrarla evita que se lea como error.
        $obtenidoCero = (float) $c['total_cero'];
        $difCero      = $obtenidoCero - $objetivoCero;

        return [
            'metaPct'           => round(META_FACTURACION * 100),
            'metaCeroPct'       => round((1 - META_FACTURACION) * 100),
            'totalTexto'        => money($total),
            'objetivoTexto'     => money($objetivo),
            'objetivoCeroTexto' => money($objetivoCero),
            'obtenidoCeroTexto' => money($obtenidoCero),
            'difCeroTexto'      => ($difCero >= 0 ? '+' : '-') . money(abs($difCero)),
            // Sin reparto corrido no hay nada obtenido que contrastar: la tarjeta
            // muestra solo el objetivo en vez de un cero que parece un faltante.
            'ceroGenerado'      => (int) $c['generados'] > 0,
            'facturadoTexto'    => money($facturado),
            // Rebasar la meta no deja un negativo en pantalla: ya no falta nada.
            'porFacturarTexto'  => money(max(0, $objetivo - $facturado)),
            'tickets'           => (int) $c['tickets'],
            'facturados'        => (int) $c['facturados']
        ];
    }

    // La numeracion del dia: [sale_id => lugar]. Sale de listSaleDayForSplit, que
    // trae el dia COMPLETO ordenado por folio. No se cuentan aqui las filas que
    // devuelve el listado porque esas ya vienen filtradas por el buscador, y con una
    // busqueda activa la venta numero 7 dejaria de ser la nota 7.
    function notasDelDia($dia) {
        $notas = [];
        $lugar = 0;

        foreach ($this->listSaleDayForSplit([$this->branchId(), $dia]) as $item) {
            $lugar++;
            $notas[$item['id']] = $lugar;
        }

        return $notas;
    }

    function ticketRow($item, $nota) {
        $tasa = tasaEfectiva($item);

        return [
            'id'     => $item['folio'],
            'Nota'   => notaCelda($nota, !empty($item['virtual_id'])),
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

        // Sin ticket generado la venta se queda al 16% con lo que realmente
        // consumieron: se muestra SU papel, no una propuesta de productos puente.
        // El puente solo entra cuando la venta pasa al 0%, que es lo que decide el
        // reparto del dia (o el boton Generar de este mismo panel).
        $lineas = $generado
            ? $this->listVirtualDetail([$item['virtual_id']])
            : $this->listSaleDetailByFolio([$item['id']]);

        return [
            'status' => 200,
            'ticket' => array_merge($this->cabecera($item), $this->papelDe($item, $lineas, $generado), [
                'generado' => $generado
            ])
        ];
    }

    // Datos del ticket que no dependen de los productos puente: son los del ticket
    // real del POS y se imprimen igual este o no generado. La nota solo existe
    // cuando el ticket ya se guardo, porque es el consecutivo que se entrega.
    //
    // Mesa y mesero salen de la comanda cuando la hay: poco mas de la mitad de las
    // ventas la tienen cargada. El resto —y personas, orden, que el POS no exporta
    // nunca— se arman con la semilla del folio, para que el mismo ticket salga
    // siempre igual por mas veces que se imprima.
    function cabecera($item) {
        $tasa    = tasaEfectiva($item);
        $semilla = semillaFolio($item['folio']);

        return [
            'folio'     => $item['folio'],
            'nota'      => $item['note_number'] ? '#' . $item['note_number'] : 'POR ASIGNAR',
            'fecha'     => date('d/m/Y', strtotime($item['operation_date'])),
            'hora'      => date('H:i', strtotime($item['operation_date'])),
            'fechaHora' => date('d/m/Y h:i:s A', strtotime($item['operation_date'])),
            'mesa'      => $item['table_number'] ?: mesaFicticia($semilla),
            'mesero'    => $item['waiter_name'] ?: meseroFicticio($semilla),
            'personas'  => personasFicticias($semilla),
            'orden'     => ordenFicticia($semilla),
            'cajero'    => 'ADMINISTRACION',
            'metodo'    => $item['payment_name'] ?: 'SIN PAGO REGISTRADO',
            'tasa'      => $tasa,
            'tasaText'  => porcentaje($tasa),
            'total'     => money($item['total']),
            // El POS no exporta propina y el ticket la imprime siempre, en cero
            // cuando no la hubo.
            'propina'   => money(0),
            'letras'    => letras($item['total']),
            'estado'    => estadoTexto($item, $tasa),
            'factura'   => $item['invoice_series'] ?: ''
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

    // Arma los renglones que suman el total del ticket con los productos del
    // catalogo de tasa 0%: del mas caro al mas barato se mete la cantidad que
    // cabe, y cuando ya no cabe ninguno completo se agrega una pieza mas del mas
    // barato. Esa ultima pieza se pasa del monto a proposito: el excedente se
    // descuenta para que el papel cuadre EXACTO con lo que se cobro.
    function armarTicket($item) {
        $puente = $this->listBridgeProducts([$this->branchId()]);

        if (empty($puente)) {
            return [
                'status'  => 400,
                'message' => 'No hay productos de tasa 0% dados de alta. Registralos en Catalogos para poder armar el ticket.'
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

    // Misma cuenta que armarTicket, pero sin recorrer los puente del mas caro al
    // mas barato: se elige al azar entre los que todavia caben y se les suma una
    // pieza. El reparto del dia arma decenas de papeles de golpe y con el orden
    // fijo todos saldrian con la misma receta; asi cada ticket lleva su mezcla.
    //
    // El bucle siempre termina: cada vuelta descuenta al menos el puente mas
    // barato, y cuando ya no cabe ninguno se sale.
    function armarTicketAleatorio($total, $puente) {
        $restante = (float) $total;
        $cuenta   = [];

        while (true) {
            $caben = [];
            foreach ($puente as $producto) {
                if ((float) $producto['price'] <= $restante) $caben[] = $producto;
            }

            if (empty($caben)) break;

            $elegido = $caben[array_rand($caben)];
            $id      = $elegido['id'];

            if (isset($cuenta[$id])) $cuenta[$id]['cant']++;
            else                     $cuenta[$id] = ['producto' => $elegido, 'cant' => 1];

            $restante -= (float) $elegido['price'];
        }

        // Lo que queda no lo cubre ninguna pieza completa: la cierra el puente mas
        // barato y el excedente se va como descuento, para que el papel cuadre
        // EXACTO contra lo que se cobro. Es la misma salida que armarTicket.
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

        return ['lineas' => $lineas, 'subtotal' => $subtotal];
    }

    // -- Acciones --

    function generate() {
        $folio     = $_POST['folio'] ?? '';
        $resultado = $this->generarFolio($folio);

        return $resultado;
    }

    // El cierre del dia completo: decide que se factura al 16% y que se manda al
    // 0%, y arma el papel de los segundos.
    //
    // El reparto va folio por folio, de la primera venta del dia a la ultima: se
    // acumula al 16% hasta cubrir la meta y lo que sigue se va al 0%. Asi los del
    // cero quedan juntos al final del dia en vez de salteados, que es como se ve un
    // corte de caja de verdad.
    //
    // Lo ya facturado esta congelado y SIEMPRE es del 16%: cuenta desde el arranque
    // aunque su folio caiga tarde, porque lo que importa es el total de la tasa.
    //
    // Las del 16% conservan sus productos del POS y no se guardan aqui; lo que se
    // guarda es el complemento, los que pasan al 0% y necesitan un papel inventado.
    // Asi el reparto queda registrado sin tabla extra: la venta con ticket es del
    // cero, la que no lo tiene es del 16%.
    function generateDay() {
        $dia    = $_POST['dia'] ?? date('Y-m-d');
        $ventas = $this->listSaleDayForSplit([$this->branchId(), $dia]);

        if (empty($ventas)) {
            $criterio = $this->esWansoft() ? 'pagadas con tarjeta de credito' : 'cobradas por banco';

            return ['status' => 400, 'message' => 'No hay ventas ' . $criterio . ' en el dia'];
        }

        $puente = $this->listBridgeProducts([$this->branchId()]);

        if (empty($puente)) {
            return [
                'status'  => 400,
                'message' => 'No hay productos de tasa 0% dados de alta. Registralos en Catalogos para poder armar los tickets.'
            ];
        }

        $total     = 0;
        $facturado = 0;
        $cuentaFac = 0;

        foreach ($ventas as $item) {
            $total += (float) $item['total'];

            if (!esFacturado($item['status_name'])) continue;

            $facturado += (float) $item['total'];
            $cuentaFac++;
        }

        $objetivo = $total * META_FACTURACION;

        // Los facturados ya estan dentro del 16%, asi que la cuenta arranca con
        // ellos: sobre ese piso se van sumando las ventas en orden de folio.
        $acumulado = $facturado;

        $monto16  = 0;
        $monto0   = 0;
        $cuenta16 = 0;
        $cuenta0  = 0;
        $sinPapel = 0;
        $lugar    = 0;

        foreach ($ventas as $item) {
            $lugar++;

            if (esFacturado($item['status_name'])) continue;

            // Grupo 16%: se queda con su ticket real. Si venia de una corrida
            // anterior como ticket del cero, suelta ese papel.
            //
            // El que cruza la meta entra completo: partir una venta no se puede, y
            // quedarse abajo dejaria el 0% pasado de su propio objetivo.
            if ($acumulado < $objetivo) {
                if (!empty($item['virtual_id'])) {
                    $this->deleteVirtualTicketBySale($this->util->sql(['id' => $item['virtual_id']], 1));
                }

                $acumulado += (float) $item['total'];
                $monto16   += (float) $item['total'];
                $cuenta16++;
                continue;
            }

            // Grupo 0%: la nota es el lugar de la venta en el dia, el mismo que la
            // pantalla ya venia mostrando antes de generar nada.
            if (!empty($item['virtual_id'])) {
                $this->deleteVirtualTicketBySale($this->util->sql(['id' => $item['virtual_id']], 1));
            }

            if (!$this->guardarTicketCero($item, $puente, $lugar, $dia)) {
                $sinPapel++;
                continue;
            }

            $monto0 += (float) $item['total'];
            $cuenta0++;
        }

        return array_merge(
            [
                'status'  => 200,
                'message' => number_format($cuenta0) . ' ticket(s) al 0% generados · ' . number_format($cuenta16 + $cuentaFac) . ' al 16%',
                'dia'     => $dia
            ],
            $this->resumenReparto([
                'dia'        => $dia,
                'total'      => $total,
                'objetivo'   => $objetivo,
                'facturado'  => $facturado,
                'monto16'    => $monto16,
                'monto0'     => $monto0,
                'tickets'    => count($ventas),
                'facturados' => $cuentaFac,
                'cuenta16'   => $cuenta16,
                'cuenta0'    => $cuenta0,
                'sinPapel'   => $sinPapel
            ])
        );
    }

    // El corte que se le muestra al usuario al terminar. Los montos salen escritos
    // de aqui: la pantalla imprime, no calcula, igual que el papel del ticket.
    //
    // El logrado del 16% incluye lo facturado, porque el objetivo del 70% es de la
    // tasa completa y no solo de lo que el reparto movio.
    function resumenReparto($r) {
        $objetivoCero = $r['total'] * (1 - META_FACTURACION);
        $logrado16    = $r['facturado'] + $r['monto16'];
        $dif16        = $logrado16 - $r['objetivo'];
        $dif0         = $r['monto0'] - $objetivoCero;

        return [
            'fechaTexto'        => date('d/m/Y', strtotime($r['dia'] ?? date('Y-m-d'))),
            'metaPct'           => round(META_FACTURACION * 100),
            'metaCeroPct'       => round((1 - META_FACTURACION) * 100),
            'totalTexto'        => money($r['total']),
            'objetivoTexto'     => money($r['objetivo']),
            'objetivoCeroTexto' => money($objetivoCero),
            'facturadoTexto'    => money($r['facturado']),
            // Lo que el reparto tenia que cubrir con tickets: la meta menos lo que
            // los facturados ya aportaban.
            'porCubrirTexto'    => money(max(0, $r['objetivo'] - $r['facturado'])),
            'logrado16Texto'    => money($logrado16),
            'logrado0Texto'     => money($r['monto0']),
            'dif16Texto'        => ($dif16 >= 0 ? '+' : '-') . money(abs($dif16)),
            'dif0Texto'         => ($dif0  >= 0 ? '+' : '-') . money(abs($dif0)),
            'tickets'           => $r['tickets'],
            'facturados'        => $r['facturados'],
            'cuenta16'          => $r['cuenta16'],
            'cuenta16Total'     => $r['cuenta16'] + $r['facturados'],
            'cuenta0'           => $r['cuenta0'],
            'sinPapel'          => $r['sinPapel']
        ];
    }

    // El papel del 0%: renglones puente al azar que suman el total de la venta, con
    // el descuento de cuadre. La tasa viaja en el ticket, no en la venta: `sale`
    // sigue diciendo lo que trajo el POS.
    function guardarTicketCero($item, $puente, $nota, $dia) {
        $armado   = $this->armarTicketAleatorio($item['total'], $puente);
        $subtotal = $armado['subtotal'];
        $total    = (float) $item['total'];

        if (empty($armado['lineas'])) return false;

        $creado = $this->createVirtualTicket($this->util->sql([[
            'note_number' => $nota,
            'subtotal'    => $subtotal,
            'discount'    => $subtotal - $total,
            'tax_rate'    => 0,
            'tax'         => 0,
            'total'       => $total,
            'issue_date'  => $dia,
            'sale_id'     => $item['id'],
            'branch_id'   => $this->branchId()
        ]]));

        if (!$creado) return false;

        $max       = $this->getMaxVirtualTicketId();
        $ticketId  = (int) ($max[0]['id'] ?? 0);
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

        return (bool) $this->createVirtualDetail($this->util->sql($renglones));
    }

    // -- Hoja imprimible --

    // Los papeles del dia completo, listos para el navegador: los del 0% con sus
    // renglones guardados y el resto (facturados y 16%) con los productos reales
    // del comandas. Los tres detalles se piden de una vez, no uno por ticket.
    function showPrintSheet() {
        $ventas = $this->listTicketsByDay($this->filtros());

        if (empty($ventas)) {
            return ['status' => 400, 'message' => 'No hay tickets que imprimir en el dia'];
        }

        $dia      = $_POST['dia'] ?? date('Y-m-d');
        $reales   = agruparPorClave($this->listSaleDetailByDay([$this->branchId(), $dia]), 'sale_folio');
        $virtuales = agruparPorClave($this->listVirtualDetailByDay([$this->branchId(), $dia]), 'sale_id');

        $tickets = [];

        foreach ($ventas as $item) {
            $esCero  = !empty($item['virtual_id']);
            $lineas  = $esCero ? ($virtuales[$item['id']] ?? []) : ($reales[$item['folio']] ?? []);
            $tickets[] = $this->papelDe($item, $lineas, $esCero);
        }

        return [
            'status'  => 200,
            'emisor'  => $this->emisor(),
            'tickets' => $tickets
        ];
    }

    // Un papel de la hoja. El del cero ya trae su subtotal y su descuento
    // guardados; el real los saca de sus propios renglones, que es lo que el POS
    // cobro. Los importes salen escritos: el papel imprime, no calcula.
    // Base gravable e impuesto del papel al 16%, que no salen del mismo lado en los
    // dos POS. Soft Restaurant los exporta calculados en la venta y se respetan tal
    // cual, porque ahi el par puede no cuadrar contra el total cuando hubo cortesia.
    // En Wansoft se deducen del total que se esta imprimiendo, que es solo la parte
    // cobrada con tarjeta. En la cuenta no dividida ambas formas dan lo mismo.
    function desgloseFiscal($item, $total, $tasa) {
        if (!$this->esWansoft()) return [(float) $item['subtotal'], (float) $item['tax']];

        $base = $tasa > 0 ? round($total / (1 + $tasa), 2) : $total;

        return [$base, round($total - $base, 2)];
    }

    function papelDe($item, $lineas, $esCero) {
        $total = (float) $item['total'];

        // El ticket real de un dia sin comandas cargadas se quedaria sin renglones:
        // el papel saldria en blanco y con el descuento en negativo. Se imprime
        // entonces el consumo como una sola partida, que es lo unico que la venta
        // sabe de si misma cuando su detalle no esta en el sistema.
        if (!$esCero && empty($lineas)) {
            $lineas = [['description' => 'CONSUMO', 'quantity' => 1, 'amount' => $total]];
        }

        $suma = 0;
        foreach ($lineas as $linea) $suma += (float) $linea['amount'];

        // Los dos papeles cierran distinto y por eso el desglose no es uno solo:
        //
        //   0%  el papel es inventado y no traslada impuesto. Su subtotal es lo que
        //       suman los puente y el excedente se va como descuento de cuadre.
        //   16% el papel es el consumo real y SI traslada. El descuento solo aparece
        //       cuando los renglones suman mas que el total, que es como el POS
        //       registra una cortesia.
        //
        // De donde sale el desglose del 16% depende del POS: ver desgloseFiscal. En
        // Wansoft el total del papel es solo la parte cobrada con tarjeta, asi que
        // imprimir el subtotal de la venta completa dejaria un papel donde la base
        // mas el IVA no dan el total.
        $tasa      = $esCero ? 0 : tasaDe($item);
        $descuento = $esCero ? (float) $item['virtual_discount'] : max(0, $suma - $total);

        list($subtotal, $iva) = $esCero
            ? [(float) $item['virtual_subtotal'], 0]
            : $this->desgloseFiscal($item, $total, $tasa);

        return array_merge($this->cabecera($item), [
            'nota'      => $esCero ? '#' . $item['note_number'] : $item['folio'],
            'tasaText'  => porcentaje($tasa),
            'grupo'     => $esCero ? 'cero' : (esFacturado($item['status_name']) ? 'facturado' : 'real'),
            'lineas'    => array_map(function ($linea) {
                return [
                    'cant'    => cantidad($linea['quantity']),
                    'nombre'  => $linea['description'],
                    'importe' => money($linea['amount'])
                ];
            }, $lineas),
            'subtotal'  => money($subtotal),
            'descuento' => money($descuento),
            // El papel dice "IVA:" a secas, como el del POS: el importe ya dice si
            // hubo impuesto y a que tasa se factura la venta se ve en pantalla.
            'iva'       => money($iva),
            'total'     => money($total)
        ]);
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

        // El listado ya solo ofrece ventas elegibles, pero generarFolio se alcanza
        // con un folio cualquiera. En Wansoft la venta que no cumple las dos reglas
        // se niega aqui en vez de terminar con un papel que no debio existir; Soft
        // Restaurant no las tiene y se queda como estaba.
        $veto = $this->esWansoft() ? vetoDeGeneracion($item) : '';
        if ($veto) return ['status' => 400, 'message' => $veto];

        $armado = $this->armarTicket($item);
        if ($armado['status'] !== 200) return $armado;

        $dia = date('Y-m-d', strtotime($item['operation_date']));

        // La nota no se pide ni se inventa: es el lugar que la venta ocupa en su
        // dia, el mismo que ya se ve en el listado. Regenerar un ticket suelto no
        // la mueve.
        $notas = $this->notasDelDia($dia);
        $nota  = (int) ($notas[$item['id']] ?? 0);

        if ($nota === 0) return ['status' => 400, 'message' => 'La venta no aparece en el corte del dia'];

        if (!empty($item['virtual_id'])) {
            $this->deleteVirtualTicket($this->util->sql(['id' => $item['virtual_id']], 1));
        }

        $subtotal = $armado['subtotal'];
        $total    = (float) $item['total'];

        // El papel puente siempre va al 0%: la tasa vive en el ticket porque la
        // venta sigue diciendo lo que trajo el POS.
        $creado = $this->createVirtualTicket($this->util->sql([[
            'note_number' => $nota,
            'subtotal'    => $subtotal,
            'discount'    => $subtotal - $total,
            'tax_rate'    => 0,
            'tax'         => 0,
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

// Los renglones del dia llegan en una sola lista y hay que repartirlos entre sus
// tickets: agrupar aqui evita una consulta por papel.
function agruparPorClave($filas, $clave) {
    $__row = [];

    foreach ($filas as $fila) $__row[$fila[$clave]][] = $fila;

    return $__row;
}

// Ningun Excel trae la tasa: se deduce del par subtotal/impuesto de la venta.
function tasaDe($item) {
    $subtotal = (float) $item['subtotal'];
    return $subtotal > 0 ? round((float) $item['tax'] / $subtotal, 2) : 0;
}

// La tasa que vale es la del papel que se entrega, no la que trajo el POS: la
// venta que el reparto mando al 0% sigue diciendo 16% en `sale`, y sin esto la
// pantalla la seguiria mostrando al 16% con un ticket al cero en la mano.
function tasaEfectiva($item) {
    if (!empty($item['virtual_id'])) return 0;

    return tasaDe($item);
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

// Las dos reglas que deciden si una venta puede recibir papel, leidas del veredicto
// que getTicketByFolio ya calculo en la base. Devuelve el motivo del rechazo, o
// cadena vacia cuando la venta es elegible.
//
// El mensaje nombra el dato que la descalifica (la forma de pago, el estado) porque
// quien pide el ticket a mano necesita saber por que no salio.
function vetoDeGeneracion($item) {
    if (empty($item['es_credito'])) {
        $formas = $item['payment_name'] ?: 'sin pago registrado';

        return 'La venta se cobro con ' . $formas . ': solo se generan tickets de lo pagado con tarjeta de credito.';
    }

    if (empty($item['esta_pagada'])) {
        $estado = $item['operation_status'] ?: 'sin estado de operacion';

        return 'La venta esta ' . $estado . ': solo se generan tickets de las ventas Pagadas.';
    }

    return '';
}

function emisorVacio() {
    return ['razon' => '', 'lema' => '', 'rfc' => '', 'domicilio' => '', 'expedicion' => '', 'telefono' => ''];
}

// -- Renglones que el POS no exporta --
//
// Mesa, mesero, personas y orden se imprimen en todos los tickets del POS, pero
// el Excel solo trae los dos primeros y nada mas cuando la comanda del dia esta
// cargada. Los que faltan se arman a partir del folio: no es azar, es una funcion
// del folio, asi que el ticket 174291 muestra hoy y en un ano las mismas personas
// y la misma orden. Un rand() daria un papel distinto en cada impresion.
function semillaFolio($folio) {
    return crc32((string) $folio);
}

function mesaFicticia($semilla) {
    return (string) ($semilla % 20 + 1);
}

// Los mismos 17 nombres con los que la migracion 03 bautizo el catalogo de
// meseros: la venta sin comanda cargada se atiende con alguno de ellos.
function meseroFicticio($semilla) {
    $nombres = ['MAFER', 'DIANA', 'KARLA', 'JOSUE', 'BRENDA', 'IVAN', 'PAOLA', 'LUIS', 'ANDREA',
                'HUGO', 'XIMENA', 'CESAR', 'ROSY', 'ABEL', 'YARELI', 'OMAR', 'NALLELY'];

    return $nombres[intdiv($semilla, 20) % count($nombres)];
}

function personasFicticias($semilla) {
    return (string) (intdiv($semilla, 400) % 6 + 1);
}

function ordenFicticia($semilla) {
    return (string) (intdiv($semilla, 3000) % 99 + 1);
}

// -- Monto en letras --
//
// El renglon "SON:" del ticket. Se arma aqui, del lado del servidor, por la misma
// razon que los importes: el papel imprime, no calcula.
function letras($monto) {
    $monto    = round((float) $monto, 2);
    $entero   = (int) floor($monto);
    $centavos = str_pad((string) round(($monto - $entero) * 100), 2, '0', STR_PAD_LEFT);
    $moneda   = $entero == 1 ? 'PESO' : 'PESOS';

    // Delante del sustantivo el uno se apocopa: TRESCIENTOS OCHENTA Y UN PESOS,
    // no "OCHENTA Y UNO PESOS".
    $texto = preg_replace('/UNO$/', 'UN', enLetras($entero));

    return $texto . ' ' . $moneda . ' ' . $centavos . '/100 M.N.';
}

// Numero a letras en la forma corta del espanol de Mexico: sin "y" entre grupos
// (DOSCIENTOS TREINTA, no doscientos y treinta) y con las contracciones que el
// idioma exige (VEINTIUNO, CIEN, UN MIL).
function enLetras($n) {
    $n = (int) $n;

    if ($n === 0)   return 'CERO';
    if ($n < 0)     return 'MENOS ' . enLetras(-$n);

    $unidades = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE',
                 'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS', 'DIECISIETE',
                 'DIECIOCHO', 'DIECINUEVE', 'VEINTE'];
    $decenas  = ['', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA',
                 'OCHENTA', 'NOVENTA'];
    $centenas = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS',
                 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

    if ($n <= 20) return $unidades[$n];

    if ($n < 100) {
        $d = intdiv($n, 10);
        $u = $n % 10;

        // Los veintitantos van pegados; del treinta en adelante con "Y".
        if ($d === 2) return 'VEINTI' . $unidades[$u];

        return $decenas[$d] . ($u ? ' Y ' . $unidades[$u] : '');
    }

    if ($n === 100) return 'CIEN';

    if ($n < 1000) {
        $c = intdiv($n, 100);
        return $centenas[$c] . (($n % 100) ? ' ' . enLetras($n % 100) : '');
    }

    if ($n < 1000000) {
        $miles = intdiv($n, 1000);
        $texto = $miles === 1 ? 'MIL' : enLetras($miles) . ' MIL';
        return $texto . (($n % 1000) ? ' ' . enLetras($n % 1000) : '');
    }

    $millones = intdiv($n, 1000000);
    $texto    = $millones === 1 ? 'UN MILLON' : enLetras($millones) . ' MILLONES';

    return $texto . (($n % 1000000) ? ' ' . enLetras($n % 1000000) : '');
}

// El numero es el mismo se haya generado el ticket o no, porque es el lugar de la
// venta en el dia. Lo unico que cambia es el peso: en negrita la nota que ya viaja
// en un papel, en gris la que todavia no.
function notaCelda($nota, $generado) {
    $clase = $generado ? 'font-bold text-gray-300' : 'text-gray-500';

    return '<span class="' . $clase . '">#' . $nota . '</span>';
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

    // El ticket generado ES el del 0%: el reparto solo guarda papel para los que
    // pasan a esa tasa, asi que el badge lo dice en vez de dejarlo a deducir.
    if (!empty($item['virtual_id'])) {
        return '<span class="badge-base b-blue">IVA 0% · ticket generado</span>';
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

    $icono = empty($item['virtual_id']) ? '' : 'text-amber-500';

    $texto = empty($item['virtual_id']) ? 'Armar el ticket virtual' : 'Ver el ticket virtual';

    return [
        [
            'class'   => 'btn-icon-view',
            'html'    => '<i data-lucide="eye" class="w-3.5 h-3.5 ' . $icono . '"></i>',
            'title'   => $texto,
            'onclick' => "app.selectTicket('{$folio}')"
        ]
    ];
}

$obj = new ctrl();
echo json_encode($obj->{$_POST['opc']}());
