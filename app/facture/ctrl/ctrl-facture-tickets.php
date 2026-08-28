<?php
session_start();
if (empty($_POST['opc'])) exit(0);

require_once '../mdl/mdl-facture-tickets.php';

// Que parte de la venta del dia se factura es politica de la casa, no un dato de
// la base: por eso vive aqui y no en una tabla. Es el valor con el que abre el
// dia; desde la barra se puede aplicar otro (ver metaDelDia).
define('META_FACTURACION', 0.7);

class ctrl extends mdl {

    public $branch;

    // El reparto arma decenas de papeles seguidos y todos preguntan lo mismo: que
    // productos hay en cada catalogo y que montos se pueden cerrar con ellos. Las
    // dos respuestas se guardan aqui para no rehacerlas ticket por ticket.
    public $catalogos = [];
    public $alcances  = [];

    // El tope del ajuste de cuadre es de la sucursal y no cambia entre papeles, asi
    // que se lee una vez y no en cada uno (ver tolerancia).
    public $toleranciaAjuste = null;

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
            'dias'    => $dias,
            'dia'     => $dia ?: ($dias[0]['id'] ?? date('Y-m-d')),
            // El default de la meta lo pone el servidor: es politica de la casa y
            // escribirlo tambien en el JS lo dejaria divergir en cuanto uno cambie.
            'metaPct' => round(META_FACTURACION * 100),
            'emisor'  => $this->emisor()
        ];
    }

    // -- Meta de facturacion --

    // Cuanto de la venta del dia se factura al 16%. El acuerdo se escribe de dos
    // formas —un porcentaje de la venta o una cantidad cerrada— y las dos dicen lo
    // mismo: un importe objetivo. Aqui se resuelve a ese importe, y de el sale todo
    // lo demas (el objetivo del 0%, el porcentaje que se muestra, el reparto).
    //
    // Viaja en cada peticion en vez de guardarse: la meta decide que ticket va a
    // que tasa, asi que el listado, el cierre y la hoja tienen que verla igual.
    // Sin nada capturado se aplica el default de la casa.
    function metaDelDia($total) {
        $total = (float) $total;
        $modo  = $_POST['metaModo']  ?? 'pct';
        $valor = $_POST['metaValor'] ?? '';

        if ($valor === '' || !is_numeric($valor)) return $total * META_FACTURACION;

        $objetivo = $modo === 'monto' ? (float) $valor : $total * ((float) $valor / 100);

        // Facturar mas de lo que se vendio no existe, y una meta negativa tampoco:
        // el objetivo se acota al monto procesable del dia.
        return max(0, min($objetivo, $total));
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
        $dia      = $_POST['dia'] ?? date('Y-m-d');
        $ventas   = $this->listTicketsByDay($this->filtros());
        $conteo   = $this->getTicketDayCounts([$this->branchId(), $dia]);
        $__row    = [];

        // El dia COMPLETO, sin el filtro del buscador: de el salen la numeracion de
        // las notas y el reparto previsto, y las dos cosas dejarian de ser ciertas
        // calculadas sobre un listado filtrado.
        $completo = $this->listSaleDayForSplit([$this->branchId(), $dia]);
        $notas    = $this->notasDeVentas($completo);
        $plan     = $this->planReparto($completo);

        $c = $conteo[0] ?? [
            'tickets' => 0, 'facturados'      => 0, 'cero'       => 0, 'generados'      => 0,
            'total'   => 0, 'total_facturado' => 0, 'total_cero' => 0, 'generados_cero' => 0
        ];

        // Un solo papel guardado ya dice que el dia se repartio: el reparto es de
        // todo el dia o de nada, no deja medios cierres.
        $repartido = (int) $c['generados'] > 0;

        foreach ($ventas as $item) {
            // La linea de corte se pinta sobre una sola fila: la primera que ya no
            // cabe en el 16%. Con el buscador activo puede no estar en el listado, y
            // entonces no se pinta ninguna, que es lo correcto.
            $esCorte = (int) $plan['corte'] === (int) $item['id'];

            $__row[] = $this->ticketRow($item, (int) ($notas[$item['id']] ?? 0), $esCorte, $repartido);
        }

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
            'kpis'   => $this->kpisDelDia($c),
            'corte'  => $this->resumenCorte($plan)
        ];
    }

    // El pie de la tabla explica la linea con los numeros del reparto previsto: sin
    // esto la raya es una marca sin nombre. Los montos van escritos, como los del
    // resto del modulo.
    function resumenCorte($plan) {
        return [
            'hay'           => $plan['corte'] !== null,
            'cuenta16'      => $plan['cuenta16'] + $plan['facturados'],
            'logradoTexto'  => money($plan['logrado16']),
            'objetivoTexto' => money($plan['objetivo']),
            'cuenta0'       => $plan['cuenta0'],
            'monto0Texto'   => money($plan['monto0'])
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
        $objetivo  = $this->metaDelDia($total);

        // Lo que no va al 16% va al 0%: el objetivo de la tasa cero es el
        // complemento de la meta, no un porcentaje aparte. Derivarlo asi mantiene
        // las dos tarjetas sumando la venta del dia si la meta cambia.
        $objetivoCero = $total - $objetivo;

        // Lo que el reparto dejo de verdad en el cero, contra lo que debio dejar. El
        // mejor ajuste toma ventas completas y no puede partir un ticket, asi que la
        // diferencia siempre existe: mostrarla evita que se lea como error.
        $obtenidoCero = (float) $c['total_cero'];
        $difCero      = $obtenidoCero - $objetivoCero;

        return [
            // El porcentaje sale del objetivo, no al reves: capturado como cantidad
            // es el que resulta, y casi nunca es redondo.
            'metaPct'           => pctTexto($total > 0 ? $objetivo / $total * 100 : 0),
            'metaCeroPct'       => pctTexto($total > 0 ? $objetivoCero / $total * 100 : 0),
            // La pantalla lo dice en el subtitulo: una cantidad fija no se mueve
            // aunque el dia siga vendiendo, y un porcentaje si.
            'metaModo'          => ($_POST['metaModo'] ?? 'pct') === 'monto' ? 'monto' : 'pct',
            'total'             => $total,
            'objetivo'          => $objetivo,
            'totalTexto'        => money($total),
            'objetivoTexto'     => money($objetivo),
            'objetivoCeroTexto' => money($objetivoCero),
            'obtenidoCeroTexto' => money($obtenidoCero),
            'difCeroTexto'      => ($difCero >= 0 ? '+' : '-') . money(abs($difCero)),
            // Sin reparto corrido no hay nada obtenido que contrastar: la tarjeta
            // muestra solo el objetivo en vez de un cero que parece un faltante.
            'ceroGenerado'      => (int) $c['generados_cero'] > 0,
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
        return $this->notasDeVentas($this->listSaleDayForSplit([$this->branchId(), $dia]));
    }

    // La numeracion sobre una lista ya consultada. El listado pide el dia completo
    // para el reparto previsto y de esa misma pasada saca las notas, en vez de
    // repetir la consulta.
    function notasDeVentas($ventas) {
        $notas = [];
        $lugar = 0;

        foreach ($ventas as $item) {
            $lugar++;
            $notas[$item['id']] = $lugar;
        }

        return $notas;
    }

    function ticketRow($item, $nota, $esCorte = false, $repartido = true) {
        $tasa = tasaEfectiva($item);

        $row = [
            'id'     => $item['folio'],
            'Nota'   => notaCelda($nota, !empty($item['virtual_id'])),
            'Folio'  => '<span data-folio="' . $item['folio'] . '" class="font-mono text-[10px] text-gray-400">' . $item['folio'] . '</span>',
            'Estado' => badgeEstado($item, $tasa),
            'Monto'  => '<span class="font-semibold text-white">' . money($item['total']) . '</span>',
            'a'      => accionTicket($item, $tasa, $repartido)
        ];

        // La linea de corte. createCoffeeTable3 lee 'opc' antes de armar las celdas
        // y lo borra, asi que no sale como columna: con 3 le pone a la fila un borde
        // superior de 2px del color que el JS pasa en border_group.
        if ($esCorte) $row['opc'] = 3;

        return $row;
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

        // La venta que llego sin su comanda no tiene renglones que ensenar. En vez
        // del papel con un solo CONSUMO se muestra la propuesta armada del catalogo
        // de IVA, que es exactamente la que guardaria el reparto: las dos se
        // siembran con el folio.
        $propuesta = false;

        if (!$generado && empty($lineas) && tasaDe($item) > 0) {
            $armado    = $this->armarPapel($item['total'], $this->catalogo(0.16), semillaFolio($item['folio']));
            $lineas    = $armado['lineas'];
            $propuesta = !empty($lineas);
        }

        $ticket = array_merge($this->cabecera($item), $this->papelDe($item, $lineas, $generado), [
            'generado' => $generado
        ]);

        // El papel propuesto no es el consumo real de nadie: son productos del
        // catalogo, y la pantalla tiene que decirlo mientras no se guarde. papelDe
        // no puede saberlo, porque para el son los renglones de una venta sin papel.
        if ($propuesta) $ticket['grupo'] = 'ivaGenerado';

        return ['status' => 200, 'ticket' => $ticket];
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
            'ticket' => array_merge([
                'lineas'   => $lineas,
                'subtotal' => money($item['virtual_subtotal'])
            ], $this->ajusteDe($item['virtual_discount']))
        ];
    }

    // -- Corrida de generacion --

    // Abre el registro del proceso que esta por armar papeles. Se abre ANTES y no
    // despues porque cada ticket guarda de que corrida salio, y ese id tiene que
    // existir cuando se inserta el primero.
    //
    // Solo el cierre del dia trae plan: es el unico camino que aplica la meta del
    // 70/30. La pasada de los pendientes al 0% y el ticket suelto no reparten
    // nada, y sus columnas de reparto se quedan en cero en vez de heredar un
    // objetivo que nadie les aplico.
    function abrirCorrida($kind, $dia, $plan = null) {
        $campos = [
            'kind'                 => $kind,
            'issue_date'           => $dia,
            'adjustment_tolerance' => $this->tolerancia(),
            'user_name'            => $_SESSION['NAME'] ?? '',
            // El null va explicito y no como cadena vacia: esta insercion es
            // multiple, y ahi util->sql no traduce '' a NULL como en la de una
            // sola fila. Una columna INT no acepta la cadena vacia.
            'user_id'              => (int) ($_SESSION['USR'] ?? 0) ?: null,
            'branch_id'            => $this->branchId()
        ];

        if ($plan) {
            // El modo y el valor se guardan tal como se pidieron, no solo el
            // objetivo en pesos: "70%" y "$15,631.70" son la misma orden, pero al
            // auditar importa cual de las dos se dio.
            $valor = $_POST['metaValor'] ?? '';

            $campos = array_merge($campos, [
                'goal_mode'   => is_numeric($valor) ? ($_POST['metaModo'] ?? 'pct') : 'pct',
                'goal_value'  => is_numeric($valor) ? (float) $valor : META_FACTURACION * 100,
                'goal_amount' => $plan['objetivo'],
                'day_total'   => $plan['total'],
                'billed_16'   => $plan['facturado'] + $plan['monto16'],
                'count_16'    => $plan['cuenta16'] + $plan['facturados'],
                'cut_sale_id' => $plan['corte'] ?: null
            ]);
        }

        if (!$this->createGenerationRun($this->util->sql([$campos]))) return 0;

        $max = $this->getMaxGenerationRunId();

        return (int) ($max[0]['id'] ?? 0);
    }

    // Lo que de verdad quedo armado, que no siempre es lo que el plan previo: una
    // venta cuyo monto el catalogo no puede cerrar se queda sin papel y cuenta
    // como tal.
    function cerrarCorrida($runId, $conteos) {
        if (!$runId) return false;

        $conteos['id'] = $runId;

        return $this->updateGenerationRun($this->util->sql($conteos, 1));
    }

    // -- Ajuste de cuadre --

    // Hasta donde acepta la casa que el papel se cuadre con un descuento. Se captura
    // en Emisor y vive en la sucursal, junto a la comision de propina: es politica
    // de la casa, no un dato de la venta. El 0 se lee como SIN TOPE.
    //
    // Se resuelve una sola vez por corrida porque la hoja imprimible arma decenas de
    // papeles seguidos y todos son de la misma sucursal.
    function tolerancia() {
        if ($this->toleranciaAjuste === null) {
            $ls = $this->getEmisor([$this->branchId()]);

            $this->toleranciaAjuste = (float) ($ls[0]['adjustment_tolerance'] ?? 0);
        }

        return $this->toleranciaAjuste;
    }

    // El ajuste con el que se cuadro el papel, el tope que lo mide y el veredicto.
    // Los tres viajan juntos porque la pantalla no muestra el numero a secas: dice
    // tambien si se paso, y eso es lo que evita que la diferencia sea silenciosa.
    //
    // `conAjuste` va aparte de `descuento` para que el JS no tenga que parsear el
    // importe ya formateado.
    function ajusteDe($descuento) {
        $ajuste = round(max(0, (float) $descuento), 2);
        $tope   = $this->tolerancia();

        return [
            'descuento'       => money($ajuste),
            'tolerancia'      => money($tope),
            'conAjuste'       => $ajuste > 0,
            'fueraTolerancia' => $tope > 0 && $ajuste > $tope
        ];
    }

    // -- Armado del papel --

    // Los dos catalogos con los que se inventa un ticket: los puente para la tasa
    // 0% y los que llevan IVA para la venta al 16% que llego sin su comanda. Se
    // piden una sola vez por corrida, que arma decenas de papeles seguidos.
    function catalogo($tasa) {
        $clave = $tasa > 0 ? '16' : '0';

        if (!isset($this->catalogos[$clave])) {
            $this->catalogos[$clave] = $tasa > 0
                ? $this->listTaxProducts([$this->branchId()])
                : $this->listBridgeProducts([$this->branchId()]);
        }

        return $this->catalogos[$clave];
    }

    // El papel de un ticket inventado. Primero se busca la combinacion de productos
    // que da el total EXACTO y solo cuando no existe se arma con descuento: el
    // descuento es la excepcion, no la salida de siempre.
    //
    // La semilla es el folio y no el reloj: el mismo ticket sale siempre con los
    // mismos productos (se mire en el panel o se imprima un ano despues) y dos
    // tickets distintos salen con mezclas distintas.
    function armarPapel($total, $productos, $semilla) {
        if (empty($productos)) return ['lineas' => [], 'subtotal' => 0];

        $exacto = $this->armarExacto($total, $productos, $semilla);

        if ($exacto !== null) return $exacto;

        return $this->armarConDescuento($total, $productos, $semilla);
    }

    // Que montos enteros se pueden pagar exacto con los precios del catalogo:
    // alcance[$m] dice si existe alguna combinacion que sume $m. La tabla se guarda
    // y se extiende, porque el reparto hace la misma pregunta para cada papel del
    // dia y lo unico que cambia es el tope.
    //
    // Es lo que permite armar sin descuento: en cada paso solo se eligen precios
    // que dejan un resto que TAMBIEN se puede cerrar, asi que nunca se llega a un
    // sobrante imposible del que haya que salir descontando.
    function tablaAlcance($precios, $tope, $clave) {
        $alcance = isset($this->alcances[$clave]) ? $this->alcances[$clave] : [true];

        if (count($alcance) >= $tope + 1) return $alcance;

        for ($m = count($alcance); $m <= $tope; $m++) {
            $alcance[$m] = false;

            foreach ($precios as $precio) {
                if ($precio <= $m && $alcance[$m - $precio]) {
                    $alcance[$m] = true;
                    break;
                }
            }
        }

        $this->alcances[$clave] = $alcance;

        return $alcance;
    }

    // Los precios enteros del catalogo, de mayor a menor y sin repetir. El armado
    // exacto trabaja en pesos: los pocos productos con centavos quedan fuera de la
    // combinacion (con ellos el total nunca cerraria redondo) y siguen disponibles
    // para el armado con descuento.
    function preciosDe($productos) {
        $precios = [];

        foreach ($productos as $producto) {
            $precio = (float) $producto['price'];

            if ($precio <= 0 || $precio != floor($precio)) continue;

            $precios[(int) $precio] = true;
        }

        $precios = array_keys($precios);
        rsort($precios);

        return $precios;
    }

    // Los productos agrupados por precio, para elegir cual de los que cuestan lo
    // mismo se imprime: el papel dice ARRACHERA CESAR, no "$235".
    function productosPorPrecio($productos) {
        $__row = [];

        foreach ($productos as $producto) {
            $precio = (float) $producto['price'];

            if ($precio <= 0 || $precio != floor($precio)) continue;

            $__row[(int) $precio][] = $producto;
        }

        return $__row;
    }

    // La combinacion que suma EXACTO el total del ticket. Devuelve null cuando no
    // la hay: un total con centavos, o un catalogo cuyos precios no cierran ese
    // monto.
    //
    // Las partidas no se eligen al azar entre todo lo que cabe: se apunta a lo que
    // deberia costar cada una para que el papel salga con unas pocas, y no con
    // ochenta renglones del producto mas barato.
    function armarExacto($total, $productos, $semilla) {
        $monto = (float) $total;

        if ($monto <= 0 || $monto != floor($monto)) return null;

        $monto   = (int) $monto;
        $precios = $this->preciosDe($productos);

        if (empty($precios)) return null;

        $clave   = md5(implode(',', $precios));
        $alcance = $this->tablaAlcance($precios, $monto, $clave);

        if (empty($alcance[$monto])) return null;

        $porPrecio = $this->productosPorPrecio($productos);
        $partidas  = min(12, max(3, (int) round($monto / 220)));
        $restante  = $monto;
        $puestas   = 0;
        $cuenta    = [];

        mt_srand($semilla);

        while ($restante > 0) {
            $objetivo = $restante / max(1, $partidas - $puestas);
            $caben    = [];

            foreach ($precios as $precio) {
                if ($precio <= $restante && $alcance[$restante - $precio]) $caben[] = $precio;
            }

            // La tabla garantiza que siempre queda salida; esto es por si el
            // catalogo cambio entre que se lleno y esta pasada.
            if (empty($caben)) return null;

            usort($caben, function ($a, $b) use ($objetivo) {
                $da = abs($a - $objetivo);
                $db = abs($b - $objetivo);

                if ($da == $db) return 0;

                return $da < $db ? -1 : 1;
            });

            // Entre los tres precios mas cercanos a lo que deberia costar la
            // partida, uno al azar: con el mas cercano a secas dos tickets del
            // mismo monto saldrian identicos.
            $precio  = $caben[mt_rand(0, min(2, count($caben) - 1))];
            $lista   = $porPrecio[$precio];
            $elegido = $lista[mt_rand(0, count($lista) - 1)];
            $id      = $elegido['id'];

            if (isset($cuenta[$id])) $cuenta[$id]['cant']++;
            else                     $cuenta[$id] = ['producto' => $elegido, 'cant' => 1];

            $restante -= $precio;
            $puestas++;
        }

        return $this->renglonesDe($cuenta);
    }

    // El armado de respaldo: se apunta a lo que deberia costar cada partida igual
    // que el exacto y, cuando ya no cabe ningun producto completo, se agrega una
    // pieza mas del mas barato. Esa ultima pieza se pasa del monto a proposito y el
    // excedente se descuenta, para que el papel cuadre EXACTO contra lo que se cobro.
    //
    // Es la excepcion (un total con centavos, un catalogo que no cierra el monto) y
    // por eso el descuento vive aqui y no en el armado exacto.
    function armarConDescuento($total, $productos, $semilla) {
        $restante = (float) $total;
        $partidas = min(12, max(3, (int) round($restante / 220)));
        $puestas  = 0;
        $cuenta   = [];

        mt_srand($semilla);

        while (true) {
            $caben = [];
            foreach ($productos as $producto) {
                if ((float) $producto['price'] <= $restante) $caben[] = $producto;
            }

            if (empty($caben)) break;

            // Sin esto el papel del catalogo con IVA salia con cuarenta renglones:
            // eligiendo al azar entre todo lo que cabe, la mayoria de las vueltas
            // agarra un producto barato y el bucle no para hasta que el restante es
            // menor al mas barato de todos. Cuando ya se pusieron las partidas que
            // se apuntaron, el objetivo pasa a ser el restante completo y se cierra
            // con lo mas caro que quepa.
            $objetivo = $restante / max(1, $partidas - $puestas);

            usort($caben, function ($a, $b) use ($objetivo) {
                $da = abs((float) $a['price'] - $objetivo);
                $db = abs((float) $b['price'] - $objetivo);

                if ($da == $db) return 0;

                return $da < $db ? -1 : 1;
            });

            $elegido = $caben[mt_rand(0, min(2, count($caben) - 1))];
            $id      = $elegido['id'];

            if (isset($cuenta[$id])) $cuenta[$id]['cant']++;
            else                     $cuenta[$id] = ['producto' => $elegido, 'cant' => 1];

            $restante -= (float) $elegido['price'];
            $puestas++;
        }

        if ($restante > 0.009) {
            $barato = end($productos);
            $id     = $barato['id'];

            if (isset($cuenta[$id])) $cuenta[$id]['cant']++;
            else                     $cuenta[$id] = ['producto' => $barato, 'cant' => 1];
        }

        return $this->renglonesDe($cuenta);
    }

    // Los renglones del papel a partir de lo que se junto, y lo que suman. El mismo
    // producto elegido dos veces sale en un solo renglon con su cantidad.
    function renglonesDe($cuenta) {
        $lineas   = [];
        $subtotal = 0;

        foreach ($cuenta as $renglon) {
            $linea     = $this->lineaPuente($renglon['producto'], $renglon['cant']);
            $lineas[]  = $linea;
            $subtotal += $linea['amount'];
        }

        return ['lineas' => $lineas, 'subtotal' => $subtotal];
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

    // El papel que se propone para una venta, armado con el catalogo de la tasa que
    // le toca. Es la misma llamada que hace el reparto y con la misma semilla, asi
    // que lo que se ve en el panel es exactamente lo que se guarda.
    function armarTicket($item, $tasa = 0) {
        $productos = $this->catalogo($tasa);

        if (empty($productos)) {
            return [
                'status'  => 400,
                'message' => $tasa > 0
                    ? 'No hay productos con IVA dados de alta. Registralos en Catalogos para poder armar el ticket.'
                    : 'No hay productos de tasa 0% dados de alta. Registralos en Catalogos para poder armar el ticket.'
            ];
        }

        $total  = (float) $item['total'];
        $armado = $this->armarPapel($total, $productos, semillaFolio($item['folio']));

        if (empty($armado['lineas'])) {
            return ['status' => 400, 'message' => 'No se pudo armar un ticket que cuadre con ' . money($total)];
        }

        $subtotal = $armado['subtotal'];

        return [
            'status'   => 200,
            'lineas'   => $armado['lineas'],
            'subtotal' => $subtotal,
            'ticket'   => array_merge([
                'lineas'   => array_map(function ($linea) {
                    return [
                        'cant'    => cantidad($linea['quantity']),
                        'nombre'  => $linea['description'],
                        'importe' => money($linea['amount'])
                    ];
                }, $armado['lineas']),
                'subtotal' => money($subtotal)
            ], $this->ajusteDe($subtotal - $total))
        ];
    }


    // -- Acciones --

    function generate() {
        $folio     = $_POST['folio'] ?? '';
        $resultado = $this->generarFolio($folio);

        return $resultado;
    }

    // La regla del reparto, separada de quien la ejecuta: en orden de folio se
    // acumula al 16% hasta cubrir la meta y lo que sigue se va al 0%. Asi los del
    // cero quedan juntos al final del dia en vez de salteados, que es como se ve un
    // corte de caja de verdad.
    //
    // Lo ya facturado esta congelado y SIEMPRE es del 16%: cuenta desde el arranque
    // aunque su folio caiga tarde, porque lo que importa es el total de la tasa.
    //
    // El que cruza la meta entra completo: partir una venta no se puede, y quedarse
    // abajo dejaria el 0% pasado de su propio objetivo.
    //
    // No toca nada: solo dice a que tasa cae cada venta. La consultan los dos lados
    // —el listado, que la dibuja como la linea de corte antes de repartir, y
    // generateDay(), que la aplica— para que lo que se ve en pantalla sea
    // exactamente el reparto que el cierre va a hacer.
    function planReparto($ventas) {
        $total     = 0;
        $facturado = 0;
        $cuentaFac = 0;

        foreach ($ventas as $item) {
            $total += (float) $item['total'];

            if (!esFacturado($item['status_name'])) continue;

            $facturado += (float) $item['total'];
            $cuentaFac++;
        }

        $objetivo = $this->metaDelDia($total);

        // Los facturados ya estan dentro del 16%, asi que la cuenta arranca con
        // ellos: sobre ese piso se van sumando las ventas en orden de folio.
        $acumulado = $facturado;

        $grupo    = [];
        $corte    = null;
        $monto16  = 0;
        $monto0   = 0;
        $cuenta16 = 0;
        $cuenta0  = 0;

        foreach ($ventas as $item) {
            if (esFacturado($item['status_name'])) {
                $grupo[$item['id']] = '16';
                continue;
            }

            if ($acumulado < $objetivo) {
                $acumulado          += (float) $item['total'];
                $monto16            += (float) $item['total'];
                $grupo[$item['id']]  = '16';
                $cuenta16++;
                continue;
            }

            $monto0             += (float) $item['total'];
            $grupo[$item['id']]  = '0';
            $cuenta0++;

            // La primera que ya no cabe: es el renglon donde el dia cambia de tasa y
            // sobre el que se pinta la linea.
            if ($corte === null) $corte = $item['id'];
        }

        return [
            'grupo'      => $grupo,
            'corte'      => $corte,
            'total'      => $total,
            'objetivo'   => $objetivo,
            'facturado'  => $facturado,
            'facturados' => $cuentaFac,
            'logrado16'  => $acumulado,
            'monto16'    => $monto16,
            'monto0'     => $monto0,
            'cuenta16'   => $cuenta16,
            'cuenta0'    => $cuenta0
        ];
    }

    // El cierre del dia completo: aplica el reparto que planReparto() decidio y arma
    // el papel que a cada grupo le falte.
    //
    // Que papel se guarda de cada grupo:
    //
    //   0%   siempre lleva papel inventado, armado con los productos puente.
    //   16%  manda el real. Con su comanda cargada el ticket ya tiene con que
    //        imprimir y no se le toca nada; solo la venta que llego sin detalle
    //        recibe papel armado con el catalogo de IVA, que si no sale un ticket
    //        con un unico renglon que dice CONSUMO.
    //
    // La tasa viaja EN el papel (tax_rate) y es lo que distingue un grupo del otro,
    // ahora que los dos pueden tener ticket guardado: antes bastaba con que el
    // ticket existiera.
    function generateDay() {
        $dia    = $_POST['dia'] ?? date('Y-m-d');
        $ventas = $this->listSaleDayForSplit([$this->branchId(), $dia]);

        if (empty($ventas)) {
            $criterio = $this->esWansoft() ? 'pagadas con tarjeta de credito' : 'cobradas por banco';

            return ['status' => 400, 'message' => 'No hay ventas ' . $criterio . ' en el dia'];
        }

        $puente = $this->catalogo(0);

        if (empty($puente)) {
            return [
                'status'  => 400,
                'message' => 'No hay productos de tasa 0% dados de alta. Registralos en Catalogos para poder armar los tickets.'
            ];
        }

        // El catalogo de IVA solo hace falta si alguna venta del 16% llego sin su
        // comanda, asi que no se exige por adelantado como el puente: el dia con el
        // detallado cargado se reparte igual sin el.
        $conIva = $this->catalogo(0.16);
        $plan   = $this->planReparto($ventas);

        // El reparto queda escrito antes de tocar un solo papel: con que meta se
        // pidio, que objetivo salio de ella y en que venta corta el dia. Sin esto
        // el 70/30 solo vive en esta peticion, y manana la pantalla recalcula el
        // corte con la meta que tenga puesta la barra.
        $runId = $this->abrirCorrida('dia', $dia, $plan);

        // Los papeles se cuentan aqui y no en el plan: el plan dice a que tasa cae
        // la venta, pero el papel puede no armarse (sin productos que cuadren el
        // monto), y el resumen tiene que contar lo que de verdad quedo con ticket.
        $monto0    = 0;
        $cuenta0   = 0;
        $armados16 = 0;
        $sinPapel  = 0;
        $lugar     = 0;

        foreach ($ventas as $item) {
            $lugar++;

            if (esFacturado($item['status_name'])) continue;

            // El papel de la corrida anterior se suelta siempre: la venta pudo
            // cambiar de grupo, y si se queda en el mismo se rehace igual.
            if (!empty($item['virtual_id'])) {
                $this->deleteVirtualTicketBySale($this->util->sql(['id' => $item['virtual_id']], 1));
            }

            if ($plan['grupo'][$item['id']] === '16') {
                // Con su comanda cargada el ticket imprime lo que de verdad
                // consumieron: ese papel manda y no se inventa nada encima.
                if (!empty($item['tiene_detalle'])) continue;

                // La venta que el POS no reporta con impuesto no puede recibir un
                // papel al 16%: se queda como esta y el listado la sigue marcando.
                $tasa = tasaDe($item);

                if ($tasa <= 0 || empty($conIva)) continue;

                if ($this->guardarTicketVirtual($item, $conIva, $lugar, $dia, $tasa, $runId)) $armados16++;
                else                                                                          $sinPapel++;

                continue;
            }

            // Grupo 0%: la nota es el lugar de la venta en el dia, el mismo que la
            // pantalla ya venia mostrando antes de generar nada.
            if (!$this->guardarTicketVirtual($item, $puente, $lugar, $dia, 0, $runId)) {
                $sinPapel++;
                continue;
            }

            $monto0 += (float) $item['total'];
            $cuenta0++;
        }

        $this->cerrarCorrida($runId, [
            'billed_0' => $monto0,
            'count_0'  => $cuenta0,
            'no_paper' => $sinPapel
        ]);

        return array_merge(
            [
                'status'  => 200,
                'message' => number_format($cuenta0) . ' ticket(s) al 0% generados · ' . number_format($plan['cuenta16'] + $plan['facturados']) . ' al 16%'
                             . ($armados16 > 0 ? ' (' . number_format($armados16) . ' con papel del catalogo)' : ''),
                'dia'     => $dia
            ],
            $this->resumenReparto([
                'dia'        => $dia,
                'total'      => $plan['total'],
                'objetivo'   => $plan['objetivo'],
                'facturado'  => $plan['facturado'],
                'monto16'    => $plan['monto16'],
                'monto0'     => $monto0,
                'tickets'    => count($ventas),
                'facturados' => $plan['facturados'],
                'cuenta16'   => $plan['cuenta16'],
                'cuenta0'    => $cuenta0,
                'armados16'  => $armados16,
                'sinPapel'   => $sinPapel
            ])
        );
    }

    // Deshacer el reparto del dia: se van las notas y la corrida que las armo, y el
    // dia vuelve a como estaba antes de cerrarlo.
    //
    // El orden no es de estilo, lo impone la FK: fk_vt_run es RESTRICT, asi que la
    // corrida no se borra mientras le cuelgue un solo papel. Los renglones de cada
    // nota se van con ella por el CASCADE de virtual_ticket_id.
    //
    // Se borra de verdad, no se marca inactivo: una nota que ya no existe no puede
    // seguir apartando su numero, y el dia se vuelve a numerar por el lugar de cada
    // venta en cuanto se reparte otra vez.
    function deleteDay() {
        $dia    = $_POST['dia'] ?? date('Y-m-d');
        $conteo = $this->getTicketDayCounts([$this->branchId(), $dia]);
        $notas  = (int) ($conteo[0]['generados'] ?? 0);

        if ($notas === 0) {
            return ['status' => 400, 'message' => 'El dia no tiene tickets generados'];
        }

        $donde = [$dia, $this->branchId()];

        if (!$this->deleteVirtualTicketByDay($donde)) {
            return ['status' => 500, 'message' => 'No se pudieron eliminar los tickets del dia'];
        }

        $this->deleteGenerationRunByDay($donde);

        return [
            'status'  => 200,
            'message' => number_format($notas) . ' ticket(s) eliminados · el dia queda sin repartir',
            'dia'     => $dia
        ];
    }


    // El corte que se le muestra al usuario al terminar. Los montos salen escritos
    // de aqui: la pantalla imprime, no calcula, igual que el papel del ticket.
    //
    // El logrado del 16% incluye lo facturado, porque el objetivo del 70% es de la
    // tasa completa y no solo de lo que el reparto movio.
    function resumenReparto($r) {
        $objetivoCero = $r['total'] - $r['objetivo'];
        $logrado16    = $r['facturado'] + $r['monto16'];
        $dif16        = $logrado16 - $r['objetivo'];
        $dif0         = $r['monto0'] - $objetivoCero;

        return [
            'fechaTexto'        => date('d/m/Y', strtotime($r['dia'] ?? date('Y-m-d'))),
            'metaPct'           => pctTexto($r['total'] > 0 ? $r['objetivo'] / $r['total'] * 100 : 0),
            'metaCeroPct'       => pctTexto($r['total'] > 0 ? $objetivoCero / $r['total'] * 100 : 0),
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
            // Los del 16% que llegaron sin comanda y estrenaron papel del catalogo.
            // Van aparte porque no son ventas de mas: son las mismas, contadas por
            // el papel con el que se imprimen.
            'armados16'         => $r['armados16'] ?? 0,
            'cuenta16Total'     => $r['cuenta16'] + $r['facturados'],
            'cuenta0'           => $r['cuenta0'],
            'sinPapel'          => $r['sinPapel']
        ];
    }

    // El papel del 0%: renglones puente al azar que suman el total de la venta, con
    // el descuento de cuadre. La tasa viaja en el ticket, no en la venta: `sale`
    // sigue diciendo lo que trajo el POS.
    // Guarda el papel inventado de una venta: el ticket que lo encabeza y sus
    // renglones. La tasa se guarda CON el papel porque la venta sigue diciendo lo
    // que trajo el POS, y es lo que despues distingue el ticket del 0% del que se
    // armo con el catalogo de IVA.
    //
    // El subtotal guardado es lo que suman los renglones, no la base gravable: de
    // ahi sale el descuento de cuadre. La base y el impuesto del papel al 16% se
    // desglosan al imprimir (ver desgloseFiscal), igual que en el ticket real.
    function guardarTicketVirtual($item, $productos, $nota, $dia, $tasa, $runId = null) {
        $armado   = $this->armarPapel($item['total'], $productos, semillaFolio($item['folio']));
        $subtotal = $armado['subtotal'];
        $total    = (float) $item['total'];

        if (empty($armado['lineas'])) return false;

        $base = $tasa > 0 ? round($total / (1 + $tasa), 2) : $total;

        $creado = $this->createVirtualTicket($this->util->sql([[
            'note_number' => $nota,
            'subtotal'    => $subtotal,
            'discount'    => max(0, round($subtotal - $total, 2)),
            'tax_rate'    => $tasa,
            'tax'         => $tasa > 0 ? round($total - $base, 2) : 0,
            'total'       => $total,
            'issue_date'  => $dia,
            'sale_id'     => $item['id'],
            // De que corrida salio este papel. Es lo que permite auditar despues
            // con que meta se repartio el dia en que se armo.
            'generation_run_id' => $runId ?: null,
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

    // Los papeles del dia completo, listos para el navegador: los que tienen ticket
    // guardado con sus renglones inventados (al 0% o al 16%, segun el catalogo con
    // el que se armaron) y el resto con los productos reales de la comanda. Los
    // detalles se piden de una vez, no uno por ticket.
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
            $esVirtual = !empty($item['virtual_id']);
            $lineas    = $esVirtual ? ($virtuales[$item['id']] ?? []) : ($reales[$item['folio']] ?? []);
            $tickets[] = $this->papelDe($item, $lineas, $esVirtual);
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

    function papelDe($item, $lineas, $esVirtual) {
        $total = (float) $item['total'];

        // El ticket real de un dia sin comandas cargadas se quedaria sin renglones:
        // el papel saldria en blanco y con el descuento en negativo. Se imprime
        // entonces el consumo como una sola partida, que es lo unico que la venta
        // sabe de si misma cuando su detalle no esta en el sistema y todavia no se
        // le armo papel.
        if (!$esVirtual && empty($lineas)) {
            $lineas = [['description' => 'CONSUMO', 'quantity' => 1, 'amount' => $total]];
        }

        $suma = 0;
        foreach ($lineas as $linea) $suma += (float) $linea['amount'];

        // La tasa la manda el papel que se entrega y no la que trajo el POS: la
        // venta que el reparto mando al 0% sigue diciendo 16% en `sale`.
        //
        // Los dos papeles cierran distinto y por eso el desglose no es uno solo:
        //
        //   0%  no traslada impuesto. El subtotal es lo que suman los productos y
        //       el excedente se va como descuento de cuadre.
        //   16% SI traslada, lo mismo si los renglones son el consumo real que si
        //       se armaron del catalogo. El descuento solo aparece cuando los
        //       renglones suman mas que el total: una cortesia en el papel real, un
        //       cuadre en el armado que no cerro exacto.
        //
        // De donde sale el desglose del 16% depende del POS: ver desgloseFiscal. En
        // Wansoft el total del papel es solo la parte cobrada con tarjeta, asi que
        // imprimir el subtotal de la venta completa dejaria un papel donde la base
        // mas el IVA no dan el total.
        $tasa      = tasaEfectiva($item);
        $descuento = $esVirtual ? (float) $item['virtual_discount'] : max(0, $suma - $total);

        list($subtotal, $iva) = $tasa > 0
            ? $this->desgloseFiscal($item, $total, $tasa)
            : [$total + $descuento, 0];

        return array_merge($this->cabecera($item), [
            'nota'      => $esVirtual ? '#' . $item['note_number'] : $item['folio'],
            'tasaText'  => porcentaje($tasa),
            // Tres papeles distintos, y el copy de la pantalla los nombra: el
            // inventado al 0%, el inventado con IVA y el consumo real.
            'grupo'     => $esVirtual
                ? ($tasa > 0 ? 'ivaGenerado' : 'cero')
                : (esFacturado($item['status_name']) ? 'facturado' : 'real'),
            'lineas'    => array_map(function ($linea) {
                return [
                    'cant'    => cantidad($linea['quantity']),
                    'nombre'  => $linea['description'],
                    'importe' => money($linea['amount'])
                ];
            }, $lineas),
            'subtotal'  => money($subtotal),
            // El papel dice "IVA:" a secas, como el del POS: el importe ya dice si
            // hubo impuesto y a que tasa se factura la venta se ve en pantalla.
            'iva'       => money($iva),
            'total'     => money($total)
        ], $this->ajusteDe($descuento));
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
        $monto0    = 0;

        // Una sola corrida para toda la pasada: abrir una por ticket llenaria la
        // bitacora de corridas de un solo papel y perderia lo que esto es, que es
        // completar de un golpe los que faltaban.
        $runId = $this->abrirCorrida('cero', $dia);

        foreach ($pendientes as $item) {
            $resultado = $this->generarFolio($item['folio'], $runId);

            if ($resultado['status'] === 200) {
                $generados++;
                $monto0 += (float) $item['total'];
                $ultimo  = $item['folio'];
                continue;
            }

            // Sin productos puente ninguno va a poder armarse: se corta aqui en vez
            // de repetir el mismo error una vez por ticket.
            if ($resultado['status'] === 400) return $resultado;
        }

        $this->cerrarCorrida($runId, [
            'billed_0' => $monto0,
            'count_0'  => $generados,
            'no_paper' => count($pendientes) - $generados
        ]);

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
    function generarFolio($folio, $runId = null) {
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

        // Regenerar un papel a mano tambien es un proceso de generacion. Cuando la
        // pasada de pendientes ya abrio la suya se hereda, y si no se abre una de
        // este solo ticket.
        if (!$runId) $runId = $this->abrirCorrida('folio', $dia);

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
            'discount'    => max(0, round($subtotal - $total, 2)),
            'tax_rate'    => 0,
            'tax'         => 0,
            'total'       => $total,
            'issue_date'  => $dia,
            'sale_id'     => $item['id'],
            'generation_run_id' => $runId ?: null,
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
//
// La tasa se lee del papel y no se deduce de que exista: el reparto guarda ticket
// para los dos grupos, asi que "tiene papel" ya no significa 0%.
function tasaEfectiva($item) {
    if (!empty($item['virtual_id'])) {
        return isset($item['virtual_tax_rate']) ? (float) $item['virtual_tax_rate'] : 0;
    }

    return tasaDe($item);
}

function money($valor) {
    return '$' . number_format((float) $valor, 2);
}

function porcentaje($tasa) {
    return round($tasa * 100) . '%';
}

// El porcentaje de la meta, que a diferencia de la tasa casi nunca es redondo:
// capturada como cantidad, $10,000 de una venta de $22,331 da 44.8%. Se imprime
// con un decimal solo cuando lo necesita, para no leer "70.0%" el resto del tiempo.
function pctTexto($pct) {
    return rtrim(rtrim(number_format(round((float) $pct, 1), 1), '0'), '.');
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

// Tres estados: el facturado esta bloqueado (no se le arma nada), el de tasa 0
// pide ticket virtual y el resto queda pendiente de facturar.
function badgeEstado($item, $tasa) {
    if (esFacturado($item['status_name'])) {
        return '<span class="badge-base b-green"><i data-lucide="lock" class="w-3 h-3"></i>Facturado ' . $item['invoice_series'] . '</span>';
    }

    // El ticket generado dice a que tasa se armo su papel: al 0% el que el reparto
    // mando a esa tasa, al 16% el de la venta que llego sin comanda y estreno papel
    // del catalogo de IVA. El color separa las dos tasas de un vistazo: azul el
    // 16%, gris el 0%.
    if (!empty($item['virtual_id'])) {
        $tono = $tasa == 0 ? 'b-gray' : 'b-blue';

        return '<span class="badge-base ' . $tono . '">IVA ' . porcentaje($tasa) . '</span>';
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
// bloqueado, el del dia sin repartir no se puede abrir todavia, y el resto abre su
// ticket virtual.
function accionTicket($item, $tasa, $repartido = true) {
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

    // Antes de repartir el dia no hay ticket que ver: lo unico que se podria
    // mostrar es una propuesta, y abrirla ahi invita a leerla como el papel
    // definitivo cuando todavia no se decidio ni a que tasa va la venta.
    if (!$repartido) {
        return [
            [
                'class'   => 'btn-icon-view',
                'html'    => '<i data-lucide="eye-off" class="w-3.5 h-3.5 text-gray-500"></i>',
                'title'   => 'Genera los tickets del dia para poder verlo',
                'onclick' => 'tickets.pendingNotice()'
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
