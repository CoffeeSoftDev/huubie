<?php
session_start();
if (empty($_POST['opc'])) exit(0);

require_once '../mdl/mdl-facture-tickets.php';

// Que parte de la venta del dia se factura es politica de la casa, no un dato de
// la base: por eso vive aqui y no en una tabla. Es el valor con el que abre el
// dia; desde la barra se puede aplicar otro (ver metaDelDia).
define('META_FACTURACION', 0.7);

// Como se llama lo que ampara el folio que no cobro con tarjeta. Su papel no lleva
// productos —no hay nada que facturar en el— y en su lugar imprime este unico
// renglon en cero. Es el nombre con el que la casa se refiere a esas cuentas, y
// sale impreso: vive aqui y no repartido por el codigo.
// El movimiento que vino con Total $0.00 (punto 18) imprime esta misma partida: el
// documento del 18.1 la nombra «Servicio» y en la casa se llama asi. Es un solo
// nombre para el papel en cero, venga de una cuenta cobrada sin tarjeta o de un
// movimiento que no cobro nada.
define('CONCEPTO_SERVICIO', 'SERVICIO DE MESA');

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

    // El folio del registro maestro que se acaba de abrir (punto 29). Se guarda al
    // abrir la corrida porque abrirCorrida devuelve el id —que es lo que el ticket
    // necesita— y el resumen tiene que poder nombrar la ejecucion sin ir a leerla
    // otra vez.
    public $corridaFolio = '';

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

    // Un read que no pudo ejecutarse devuelve null, no una lista vacia (ver _Read
    // en _CRUD): el error se anota en el log y la funcion sigue. Recorrer ese null
    // imprime un Warning de PHP ANTES del JSON, y entonces la respuesta deja de ser
    // JSON: la pantalla se queda sin tabla, sin cifras y con los tres botones de la
    // barra a la vez, porque el JS no llega a leer nada.
    //
    // Todo lo que despues se recorre pasa por aqui: un dia sin datos —o una consulta
    // que fallo— tiene que llegar al frente como un dia vacio, no como una pantalla
    // rota.
    function filas($ls) {
        return is_array($ls) ? $ls : [];
    }

    // El dia no se elige solo: el Excel del POS se sube en diferido, asi que el
    // modulo abre en el ultimo dia con ventas elegibles (ver ventaElegible en el
    // modelo). Con ?dia= entra directo a ese dia si tiene ventas.
    function init() {
        $dias = $this->filas($this->lsDias([$this->branchId()]));
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

    // Las dos cifras del reparto tienen que sumar la venta con tarjeta del dia.
    //
    // Se comprueba aqui y no solo en la pantalla porque el cierre se puede llamar
    // sin pasar por el modal: la peticion trae las dos y el servidor es el que
    // decide si el reparto es valido.
    //
    // Sin `metaCero` no hay nada que comprobar y se responde vacio: es la peticion
    // de antes de que existiera el segundo campo, y sigue valiendo —el 0% es el
    // resto—. Asi la pantalla vieja y la nueva conviven mientras se despliega.
    function descuadreDelDia($total) {
        $cero = $_POST['metaCero'] ?? '';

        if ($cero === '' || !is_numeric($cero)) return '';

        $modo    = $_POST['metaModo'] ?? 'pct';
        $total   = (float) $total;
        $monto0  = $modo === 'monto' ? (float) $cero : $total * ((float) $cero / 100);
        $monto16 = $this->metaDelDia($total);
        $dif     = ($monto16 + $monto0) - $total;

        // La misma tolerancia con la que el modulo compara montos en todo el cierre.
        if (abs($dif) < 0.005) return '';

        return 'El reparto no cuadra: ' . ($dif > 0 ? 'sobran ' : 'faltan ') . money(abs($dif))
             . ' para que el IVA 16% y el IVA 0% sumen el Total Tarjeta de Credito (' . money($total) . ').';
    }

    // Con que combinacion de productos se arman los papeles inventados. Viaja en la
    // peticion porque nace en la vista previa: cada Regenerar la mueve un numero, y
    // el confirmar manda la que el usuario acepto (ver semillaFolio y el punto 20).
    //
    // Sin nada capturado vale 0, que es la combinacion de toda la vida.
    function semillaDelReparto() {
        $semilla = $_POST['semilla'] ?? 0;

        return is_numeric($semilla) ? max(0, (int) $semilla) : 0;
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
        $ventas   = $this->filas($this->listTicketsByDay($this->filtros()));
        $conteo   = $this->filas($this->getTicketDayCounts([$this->branchId(), $dia]));
        $__row    = [];

        // El dia COMPLETO, sin el filtro del buscador: de el salen la numeracion de
        // las notas y el reparto previsto, y las dos cosas dejarian de ser ciertas
        // calculadas sobre un listado filtrado.
        $completo = $this->filas($this->listSaleDayForSplit([$this->branchId(), $dia]));
        $notas    = $this->notasDeVentas($completo);
        $plan     = $this->planReparto($completo);

        $c = $conteo[0] ?? [
            'tickets' => 0, 'facturados'      => 0, 'cero'       => 0, 'generados'      => 0,
            'total'   => 0, 'total_facturado' => 0, 'total_cero' => 0, 'generados_cero' => 0,
            'servicio' => 0, 'movimientos'    => 0, 'generados_servicio' => 0
        ];

        // Un solo papel guardado ya dice que el dia se repartio: el reparto es de
        // todo el dia o de nada, no deja medios cierres.
        $repartido = (int) $c['generados'] > 0;

        // Se leen una vez y se usan dos: el cuadro de mudanzas y el paso 9 del
        // seguimiento cuentan lo mismo.
        $mudados = $this->mudadosDelDia($dia);

        foreach ($ventas as $item) {
            // La linea de corte se pinta sobre una sola fila: la primera que ya no
            // cabe en el 16%. Con el buscador activo puede no estar en el listado, y
            // entonces no se pinta ninguna, que es lo correcto.
            $esCorte = (int) $plan['corte'] === (int) $item['id'];

            // A que tasa la manda el reparto. Es lo que decide si su ojo abre: la
            // que cae del lado del 0% no tiene papel hasta que se genere el dia.
            $grupo = $plan['grupo'][$item['id']] ?? '';

            $__row[] = $this->ticketRow($item, (int) ($notas[$item['id']] ?? 0), $esCorte, $repartido, $grupo);
        }

        return [
            'row'    => $__row,
            'thead'  => '',
            'counts' => [
                'tickets'    => (int) $c['tickets'],
                // Las cuentas que se cobraron sin tarjeta. Viajan aparte de
                // 'tickets' porque no facturan, y el pie de la tabla las nombra:
                // el usuario tiene que poder ver de un vistazo que el listado
                // muestra el dia completo y no solo lo facturable.
                'servicio'   => (int) $c['servicio'],
                'facturados' => (int) $c['facturados'],
                'cero'       => (int) $c['cero'],
                'generados'  => (int) $c['generados'],
                'mostrados'  => count($__row)
            ],
            'kpis'    => $this->kpisDelDia($c),
            'corte'   => $this->resumenCorte($plan),
            // El registro de cargos que cambiaron de folio viaja con el listado y no
            // en una peticion aparte: son un punado de renglones en el peor dia, y
            // asi el cuadro que los muestra abre sin esperar nada.
            'mudados' => $mudados,
            // El registro maestro de cada ejecucion del dia (punto 29). Viaja con el
            // listado por lo mismo que los mudados: son un punado de filas y el
            // cuadro que las muestra abre sin esperar otra peticion.
            'generaciones' => $this->generacionesDelDia($dia)
        ];
    }

    // Los cargos que hoy estan amparados por un folio distinto del que los cobro.
    // Cada renglon se explica solo: de que cuenta salio, que folio lo factura,
    // cuanto es y con que se cobro esa cuenta destino —que es la razon por la que
    // puede amparar un cargo ajeno—.
    //
    // Solo Wansoft desglosa vouchers, asi que en el otro POS esto viene vacio y el
    // modulo no ensena el registro.
    function mudadosDelDia($dia) {
        if (!$this->esWansoft()) return [];

        // Sin `?: []` un fallo de lectura devuelve NULL, array_map lanza un warning
        // y ese warning se imprime ANTES del json_encode: el listado entero llega al
        // navegador como HTML invalido y la pantalla se queda en blanco. Un registro
        // accesorio no puede tumbar la pantalla que lo muestra.
        $ls = $this->listReassignedByDay([$this->branchId(), $dia]) ?: [];

        return array_map(function ($mov) {
            return [
                'origen'      => $mov['origen'],
                'destino'     => $mov['destino'],
                'montoTexto'  => money($mov['monto']),
                'pagoDestino' => strtolower($mov['pago_destino'] ?: 'otra forma de pago')
            ];
        }, $ls);
    }

    // -- Registro de generacion (punto 29) --

    // Que ejecuciones dejaron su registro maestro en este dia. Un dia puede tener
    // varias —el cierre completo, la pasada que completa los del 0% y cada ticket
    // regenerado a mano— y la auditoria tiene que verlas todas, no solo la ultima.
    //
    // Las cifras salen de la corrida y no se recalculan sobre el dia de hoy: es
    // justamente lo que el registro sirve para demostrar. El dia se puede recargar
    // despues, y entonces el archivo, los movimientos y las mudanzas ya no son los
    // que esa ejecucion vio.
    function generacionesDelDia($dia) {
        $ls = $this->listGenerationRuns([$this->branchId(), $dia]) ?: [];

        return array_map(function ($run) {
            return [
                'folio'        => $run['folio'] ?: '',
                'tipo'         => $this->nombreDeCorrida($run['kind']),
                'fechaTexto'   => date('d/m/Y', strtotime($run['issue_date'])),
                'creadoTexto'  => date('d/m/Y H:i', strtotime($run['created_at'])),
                'usuario'      => $run['user_name'] ?: 'sin usuario',
                'archivo'      => $run['source_file'] ?: '',
                'movimientos'  => (int) $run['movements_count'],
                'totalTexto'   => money($run['day_total']),
                'monto16Texto' => money($run['billed_16']),
                'monto0Texto'  => money($run['billed_0']),
                // Los papeles que de verdad cuelgan de la corrida, contados por el
                // modelo. Los tres conteos que siguen son los que ella congelo.
                'tickets'      => (int) $run['tickets'],
                'reasignados'  => (int) $run['reassigned_count'],
                // El papel de $0.00 no es el del 0%: aquel es tasa y este es
                // importe (punto 18), y por eso el punto 29 los pide por separado.
                'ceros'        => (int) $run['zero_ticket_count']
            ];
        }, $ls);
    }

    // Como se nombra cada camino en el registro: los tres `kind` de la corrida
    // escritos como el usuario los reconoce.
    function nombreDeCorrida($kind) {
        $nombres = [
            'dia'   => 'Cierre del dia',
            'cero'  => 'Pendientes al 0%',
            'folio' => 'Ticket regenerado'
        ];

        return $nombres[$kind] ?? $kind;
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
            'servicio'          => (int) $c['servicio'],
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

    function ticketRow($item, $nota, $esCorte = false, $repartido = true, $grupo = '') {
        $tasa = tasaEfectiva($item);

        $row = [
            'id'     => $item['folio'],
            'Nota'   => notaCelda($nota, !empty($item['virtual_id'])),
            // data-id es la identidad interna del papel (punto 22.1): existe solo
            // cuando el ticket ya se guardo, y el JS sigue buscando la fila por
            // data-folio, que es lo que el usuario ve y teclea.
            'Folio'  => '<span data-folio="' . $item['folio'] . '" data-id="' . (int) ($item['virtual_id'] ?? 0)
                        . '" class="font-mono text-[10px] text-gray-400">' . $item['folio'] . '</span>',
            'Estado' => badgeEstado($item, $tasa, $grupo) . badgeReasignacion($item),
            'Monto'  => montoCelda($item),
            'a'      => accionTicket($item, $repartido, $grupo)
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
        //
        // La que si la tiene pero por otro monto —cedio o recibio un cargo— tampoco
        // puede ensenarla: sumaria una cifra distinta a la del papel. Se le arma la
        // misma propuesta, que es tambien lo que el cierre le va a guardar.
        $propuesta = false;

        // El servicio de mesa no ensena consumo aunque su comanda este cargada: su
        // papel ampara la cuenta, no lo que se comio en ella, y con los productos a
        // la vista se leeria como un ticket facturable, que es justo lo que no es.
        // Sin renglones, papelDe le pone el suyo.
        if (!$generado && esServicio($item)) {
            $lineas = [];
        } elseif (!$generado && (empty($lineas) || !comandaCuadra($item)) && tasaDe($item) > 0) {
            $armado    = $this->armarPapel($item['total'], $this->catalogo(0.16), semillaFolio($item['folio'], $this->semillaDelReparto()));
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
        $total   = totalDelPapel($item);
        $origen  = folioOrigen($item);

        return [
            // Las tres identidades del punto 22.1. El id solo existe cuando el papel
            // ya se guardo: la propuesta que se ve antes de generar todavia no es un
            // documento y no tiene identidad que dar.
            'id'          => !empty($item['virtual_id']) ? (int) $item['virtual_id'] : null,
            'folio'       => $item['folio'],
            'folioOrigen' => $origen,
            'reasignado'  => $origen != $item['folio'],
            'nota'      => $item['note_number'] ? '#' . $item['note_number'] : 'POR ASIGNAR',
            'fecha'     => date('d/m/Y', strtotime($item['operation_date'])),
            'hora'      => date('H:i', strtotime($item['operation_date'])),
            'fechaHora' => date('d/m/Y h:i:s A', strtotime($item['operation_date'])),
            'mesa'      => $item['table_number'] ?: mesaFicticia($semilla),
            'mesero'    => $item['waiter_name'] ?: meseroFicticio($semilla),
            'personas'  => personasFicticias($semilla),
            'orden'     => ordenFicticia($semilla),
            'cajero'    => 'ADMINISTRACION',
            'metodo'    => $this->metodoDelPapel($item),
            // Cual de los dos papeles en cero es. La pantalla los explica distinto:
            // el servicio de mesa nombra el cobro que si hubo, y el movimiento en
            // cero no tiene ninguno que nombrar (regla 18.2).
            'ceroDeOrigen' => esServicio($item) && esCeroDeOrigen($item),
            'tasa'      => $tasa,
            'tasaText'  => porcentaje($tasa),
            'total'     => money($total),
            // El POS no exporta propina y el ticket la imprime siempre, en cero
            // cuando no la hubo.
            'propina'   => money(0),
            'letras'    => letras($total),
            'estado'    => estadoTexto($item, $tasa),
            'factura'   => $item['invoice_series'] ?: ''
        ];
    }

    // La forma de pago que imprime el papel es la del cargo que AMPARA, no la lista
    // de todo lo que se cobro en ese folio.
    //
    // La diferencia se ve en el folio que recibio un voucher mudado: la cuenta se
    // cobro en efectivo y ademas ampara un cargo con tarjeta, pero el papel se
    // emite solo por ese cargo, asi que anunciar el efectivo diria que respalda un
    // dinero que no viaja en el. Al reves pasa con el servicio de mesa, que ampara
    // exactamente lo que la cuenta cobro y lo dice tal cual.
    function metodoDelPapel($item) {
        if (esServicio($item)) {
            // El movimiento que vino con Total $0.00 no cobro nada, y Wansoft le
            // pega a veces un voucher vacio. Copiar esa forma de pago haria que el
            // papel anunciara un cargo con tarjeta que nunca existio.
            if (esCeroDeOrigen($item)) return 'SIN PAGO REGISTRADO';

            return $item['payment_real'] ?: 'SIN PAGO REGISTRADO';
        }

        if ($this->esWansoft()) return 'TARJETA DE CREDITO';

        return $item['payment_name'] ?: 'SIN PAGO REGISTRADO';
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
    // GEN- y seis digitos. El folio es un dato del modulo y no la llave de la fila:
    // el id lo reparte MySQL y un borrado le deja huecos, mientras que este numero
    // es el que se dicta por telefono y se anota en una aclaracion.
    //
    // El consecutivo sale de un MAX+1 y su unico candado es el UNIQUE de la
    // migracion 17 (ver el reintento en abrirCorrida).
    function folioDeCorrida() {
        $ls      = $this->filas($this->getNextGenerationRunFolio());
        $numero  = (int) ($ls[0]['siguiente'] ?? 0);

        return 'GEN-' . str_pad($numero ?: 1, 6, '0', STR_PAD_LEFT);
    }

    // De que archivo salio el dia que se esta generando. Se copia a la corrida en
    // vez de dejarlo colgado del lote: el lote se puede borrar al reimportar y el
    // registro maestro tiene que seguir diciendo de donde vinieron los movimientos.
    function archivoDelDia($dia) {
        $ls = $this->filas($this->getSourceFileByDay([$this->branchId(), $dia]));

        return (string) ($ls[0]['file_name'] ?? '');
    }

    function abrirCorrida($kind, $dia, $plan = null) {
        $campos = [
            // El registro maestro del punto 29: el numero con el que se nombra esta
            // ejecucion desde fuera de la base.
            'folio'                => $this->folioDeCorrida(),
            'kind'                 => $kind,
            'issue_date'           => $dia,
            'source_file'          => $this->archivoDelDia($dia),
            'adjustment_tolerance' => $this->tolerancia(),
            // Con que combinacion se armaron los papeles. El 0 es la de siempre
            // —el crc32 del folio a secas—, y cualquier otro numero salio de un
            // Regenerar en la vista previa (punto 20). Se guarda para que rehacer
            // el dia pueda reproducir los mismos papeles.
            'paper_seed'           => $this->semillaDelReparto(),
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

        if (!$this->createGenerationRun($this->util->sql([$campos]))) {
            // El folio se calcula con un MAX+1 y el UNIQUE de la tabla es su unico
            // candado: dos cierres a la misma hora piden el mismo numero y el
            // segundo rebota. Se reintenta una vez con el consecutivo ya movido,
            // que en un modulo de un cierre por dia y por sucursal alcanza.
            $campos['folio'] = $this->folioDeCorrida();

            if (!$this->createGenerationRun($this->util->sql([$campos]))) return 0;
        }

        $this->corridaFolio = $campos['folio'];

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

    // -- Reasignacion de cargos --

    // Un folio ampara UN cargo con tarjeta. Wansoft exporta un renglon por voucher,
    // asi que la cuenta que se partio entre dos tarjetas deja dos cargos con el
    // mismo folio, y hoy el modulo los suma en un solo ticket:
    //
    //     6275  TARJETA DE CREDITO    236.00
    //     6275  TARJETA DE CREDITO  1,070.00   ->  un ticket de 1,306.00
    //
    // Ese ticket no se puede entregar: son dos clientes y cada uno pide su
    // comprobante del voucher que firmo, pero el folio es uno solo. La regla de la
    // casa es que el folio se queda con el primer cargo y los demas se mudan a un
    // folio que ese dia se cobro sin tarjeta —el servicio de mesa—, que es el que
    // no va a pedir factura:
    //
    //     6275 conserva 236.00  ·  los 1,070.00 se van al 6279, que era EFECTIVO
    //
    // La mudanza vive en la base (assigned_folio, ver migra-09) y no se recalcula
    // en cada pantalla: el destino tiene que ser el mismo hoy y al reimprimir.
    //
    // Es el primer paso del cierre y se recalcula entero, nunca en capas: los
    // cargos vuelven primero a su folio y desde ahi se reparten otra vez. Rehacer
    // el dia sobre un reparto anterior iria mudando cargos ya mudados hasta que
    // ningun folio guarde relacion con lo que el POS cobro.
    //
    // Solo Wansoft: Soft Restaurant no desglosa vouchers y su universo se arma con
    // otro criterio (ver ventaElegible).
    function reasignarCargos($dia) {
        if (!$this->esWansoft()) return [];

        $this->clearReassignmentsByDay([$this->branchId(), $dia]);

        $movimientos = $this->planReasignacion(
            $this->listSaleDayForSplit([$this->branchId(), $dia]),
            $this->listCardPaymentsByDay([$this->branchId(), $dia])
        );

        foreach ($movimientos as $mov) {
            if ($mov['destino'] === null) continue;

            $this->reassignPayment([$mov['destino'], $mov['id']]);
        }

        return $movimientos;
    }

    // Que cargo se muda y a donde. No toca nada: devuelve la lista para que el
    // cierre la aplique y la pueda contar en su resumen.
    //
    // Se queda el primero que el POS capturo, no el mas grande: es el cobro con el
    // que la cuenta se cerro y el que la conciliacion bancaria va a encontrar
    // primero bajo ese folio.
    function planReasignacion($ventas, $pagos) {
        $porFolio = [];

        foreach ($pagos as $pago) $porFolio[$pago['sale_folio']][] = $pago;

        $sobrantes = [];

        foreach ($porFolio as $folio => $cargos) {
            for ($i = 1; $i < count($cargos); $i++) {
                $sobrantes[] = [
                    'id'      => (int) $cargos[$i]['id'],
                    'origen'  => (string) $folio,
                    'monto'   => (float) $cargos[$i]['amount'],
                    'destino' => null
                ];
            }
        }

        if (empty($sobrantes)) return [];

        $libres      = $this->foliosLibres($ventas);
        $movimientos = [];

        foreach ($sobrantes as $mov) {
            $mov['destino'] = $this->receptorProximo($libres, $mov['origen']);

            $movimientos[] = $mov;
        }

        return $movimientos;
    }

    // Los folios que pueden recibir un cargo: los que ese dia cobraron sin tarjeta.
    // Vienen en orden de folio, que es el orden en que se van tomando.
    //
    // El facturado no entra aunque no tenga tarjeta: ya salio con su folio de
    // factura y su monto esta congelado, asi que colgarle un cargo ajeno cambiaria
    // un documento que ya se entrego.
    function foliosLibres($ventas) {
        $libres = [];

        foreach ($ventas as $item) {
            if (esFacturado($item['status_name'])) continue;
            if (!esServicio($item))                continue;

            $libres[] = $item['folio'];
        }

        return $libres;
    }

    // El folio libre mas cercano, y se lo lleva: la lista se pasa por referencia
    // para que dos cargos no caigan en el mismo destino.
    //
    // Primero hacia adelante, que es como el ejemplo de la casa lo describe —"el
    // ticket proximo"— y como se lee un corte de caja: el cliente que no cabe en su
    // folio sale amparado por uno posterior, nunca por uno que se imprimio antes de
    // que llegara. Solo cuando ya no queda ninguno adelante se busca atras, porque
    // un folio raro es mejor que un cargo duplicado.
    function receptorProximo(&$libres, $origen) {
        $numero   = (int) $origen;
        $adelante = null;
        $atras    = null;

        foreach ($libres as $i => $folio) {
            if ((int) $folio > $numero) {
                $adelante = $i;
                break;
            }

            $atras = $i;
        }

        $elegido = $adelante !== null ? $adelante : $atras;

        if ($elegido === null) return null;

        $folio = $libres[$elegido];

        unset($libres[$elegido]);

        $libres = array_values($libres);

        return $folio;
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

        // El subtotal se cierra a dos decimales aqui, donde nace: es el que se
        // guarda con el papel y contra el que se calcula el descuento de cuadre,
        // y sumar renglones en punto flotante deja colas que no son dinero.
        return ['lineas' => $lineas, 'subtotal' => round($subtotal, 2)];
    }

    function lineaPuente($producto, $cant) {
        return [
            'description' => $producto['name'],
            'quantity'    => $cant,
            'unit_price'  => (float) $producto['price'],
            'amount'      => round($cant * (float) $producto['price'], 2),
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
        $armado = $this->armarPapel($total, $productos, semillaFolio($item['folio'], $this->semillaDelReparto()));

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
            // El servicio de mesa no se reparte: vale $0.00 de cara al reparto, y
            // meterlo en un grupo solo inflaria el conteo de esa tasa con ventas
            // que no aportan un peso a su objetivo.
            if (esServicio($item)) continue;

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

    // -- Vista previa del cierre (punto 20) --

    // Lo mismo que generateDay(), sin escribir una sola fila: mismas validaciones,
    // misma mudanza de cargos, mismo reparto. Devuelve las cifras con las que el
    // usuario decide, y el dia se escribe solo si confirma.
    //
    // La mudanza es lo unico que aqui se hace distinto, y es el motivo de que este
    // metodo exista. El cierre la aplica en la base y VUELVE A LEER el dia, porque
    // el reparto se calcula sobre los montos ya mudados; la vista previa no puede
    // tocar `assigned_folio` —mirar una propuesta y cancelarla dejaria los cargos
    // movidos sin corrida que los explique—, asi que la traslada en memoria.
    function previewDay() {
        $dia = $_POST['dia'] ?? date('Y-m-d');

        // Las mismas puertas que el cierre, en el mismo orden: aprobar una
        // propuesta que generateDay() va a rechazar es peor que no ofrecerla.
        $puente = $this->catalogo(0);

        if (empty($puente)) {
            return [
                'status'  => 400,
                'message' => 'No hay productos de tasa 0% dados de alta. Registralos en Catalogos para poder armar los tickets.'
            ];
        }

        $ventas = $this->listSaleDayForSplit([$this->branchId(), $dia]);

        if (empty($ventas)) {
            $criterio = $this->esWansoft() ? 'pagadas' : 'cobradas por banco';

            return ['status' => 400, 'message' => 'No hay ventas ' . $criterio . ' en el dia'];
        }

        // Los cargos como los exporto el POS —listCardPaymentsByDay lee sale_folio
        // y no el destino— y el dia devuelto a esos montos. Sin este paso, un dia
        // que ya trae mudanzas de un cierre anterior se simularia sobre ellas y los
        // cargos se moverian dos veces.
        $pagos  = $this->esWansoft() ? $this->listCardPaymentsByDay([$this->branchId(), $dia]) : [];
        $ventas = $this->montosDelPos($ventas, $pagos);

        $reasignados = $this->planReasignacion($ventas, $pagos);
        $ventas      = $this->conMudanza($ventas, $reasignados);

        $total = 0;

        foreach ($ventas as $item) $total += (float) $item['total'];

        $descuadre = $this->descuadreDelDia($total);

        if ($descuadre !== '') return ['status' => 400, 'message' => $descuadre];

        $plan = $this->planReparto($ventas);

        // Las dos poblaciones que la pantalla nombra: las que traen cargo que
        // facturar y las que van a salir en $0.00 (servicio de mesa y movimientos
        // que llegaron en cero, ver punto 18).
        $servicio = 0;
        $conCargo = 0;

        foreach ($ventas as $item) {
            if (esFacturado($item['status_name'])) continue;

            if (esServicio($item)) $servicio++;
            else                   $conCargo++;
        }

        $logrado16    = $plan['facturado'] + $plan['monto16'];
        $cuenta16     = $plan['cuenta16'] + $plan['facturados'];
        $totalDelDia  = $plan['total'];

        return [
            'status'       => 200,
            'dia'          => $dia,
            'fechaTexto'   => date('d/m/Y', strtotime($dia)),
            'totalTexto'   => money($totalDelDia),
            'movimientos'  => count($ventas),
            'conCargo'     => $conCargo,
            // La proporcion de la barra sale del reparto que de verdad se armo, no
            // de la meta capturada: es lo que se va a guardar.
            'pct16'        => pctTexto($totalDelDia > 0 ? $logrado16 / $totalDelDia * 100 : 0),
            'pct0'         => pctTexto($totalDelDia > 0 ? $plan['monto0'] / $totalDelDia * 100 : 0),
            'monto16Texto' => money($logrado16),
            'monto0Texto'  => money($plan['monto0']),
            'cuenta16'     => $cuenta16,
            'cuenta0'      => $plan['cuenta0'],
            'tickets'      => $cuenta16 + $plan['cuenta0'] + $servicio,
            'cero'         => $servicio,
            'reasignados'  => array_map(function ($mov) {
                return [
                    'origen'     => $mov['origen'],
                    'destino'    => $mov['destino'] ?: '',
                    'montoTexto' => money($mov['monto'])
                ];
            }, $reasignados),
            // La combinacion con la que se armaria: viaja de vuelta para que el
            // confirmar mande exactamente la que se aprobo.
            'semilla'      => $this->semillaDelReparto()
        ];
    }

    // El dia con los montos que trajo el Excel, antes de que ningun cierre mudara
    // un cargo. `listSaleDayForSplit` los devuelve YA mudados —su monto procesable
    // pasa por folioDelPago()—, asi que la simulacion los reconstruye sumando los
    // cargos por su folio original.
    //
    // Solo en Wansoft: es el unico POS que desglosa vouchers y el unico donde la
    // mudanza existe.
    function montosDelPos($ventas, $pagos) {
        if (!$this->esWansoft()) return $ventas;

        $porFolio = [];

        foreach ($pagos as $pago) {
            $folio = $pago['sale_folio'];

            $porFolio[$folio] = ($porFolio[$folio] ?? 0) + (float) $pago['amount'];
        }

        foreach ($ventas as $i => $item) {
            $ventas[$i]['total'] = $porFolio[$item['folio']] ?? 0;
        }

        return $ventas;
    }

    // La mudanza puesta sin escribirla: el folio que cede pierde el monto del cargo
    // y el que recibe lo suma. Es lo que hace `reasignarCargos` en la base, pero
    // sobre la lista que ya se tiene en memoria.
    function conMudanza($ventas, $movimientos) {
        if (empty($movimientos)) return $ventas;

        $delta = [];

        foreach ($movimientos as $mov) {
            if ($mov['destino'] === null) continue;

            $delta[$mov['origen']]  = ($delta[$mov['origen']]  ?? 0) - (float) $mov['monto'];
            $delta[$mov['destino']] = ($delta[$mov['destino']] ?? 0) + (float) $mov['monto'];
        }

        foreach ($ventas as $i => $item) {
            if (!isset($delta[$item['folio']])) continue;

            $ventas[$i]['total'] = round((float) $item['total'] + $delta[$item['folio']], 2);
        }

        return $ventas;
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
        $dia = $_POST['dia'] ?? date('Y-m-d');

        // Todo lo que puede detener el cierre se pregunta ANTES de mudar un solo
        // cargo. Mudar primero y validar despues deja el dia a medias cuando falta
        // el catalogo o no hay ventas: los cargos ya cambiados de folio, ni un papel
        // armado y ninguna corrida que respalde la mudanza. Un monto movido sin
        // documento que lo explique es justo lo que la reasignacion existe para
        // evitar.
        $puente = $this->catalogo(0);

        if (empty($puente)) {
            return [
                'status'  => 400,
                'message' => 'No hay productos de tasa 0% dados de alta. Registralos en Catalogos para poder armar los tickets.'
            ];
        }

        $ventas = $this->listSaleDayForSplit([$this->branchId(), $dia]);

        if (empty($ventas)) {
            $criterio = $this->esWansoft() ? 'pagadas' : 'cobradas por banco';

            return ['status' => 400, 'message' => 'No hay ventas ' . $criterio . ' en el dia'];
        }

        // El reparto se comprueba antes de mudar un solo cargo: un dia cerrado con
        // las dos tasas sin cuadrar deja tickets que no suman la venta que amparan.
        $total     = 0;
        foreach ($ventas as $item) $total += (float) $item['total'];

        $descuadre = $this->descuadreDelDia($total);

        if ($descuadre !== '') return ['status' => 400, 'message' => $descuadre];

        // Con el dia ya validado se mudan los cargos, y el dia se vuelve a leer: la
        // mudanza cambia el monto de dos folios —el que cede y el que recibe— y el
        // reparto se calcula sobre esos montos. Repartir sobre la lectura anterior
        // dejaria el corte apuntando a un dia que ya no existe.
        //
        // Se relee siempre y no solo cuando algo se movio, porque reasignarCargos
        // tambien deshace las mudanzas del cierre anterior: el dia pudo cambiar aun
        // cuando hoy no haya nada que mudar.
        $reasignados = $this->reasignarCargos($dia);
        $ventas      = $this->listSaleDayForSplit([$this->branchId(), $dia]);

        // El catalogo de IVA solo hace falta si alguna venta del 16% llego sin su
        // comanda, asi que no se exige por adelantado como el puente: el dia con el
        // detallado cargado se reparte igual sin el.
        $conIva = $this->catalogo(0.16);
        $plan   = $this->planReparto($ventas);

        // La combinacion que el usuario aprobo en la vista previa. Sin vista previa
        // —o sin haber tocado Regenerar— llega 0, que es la de siempre.
        $semilla = $this->semillaDelReparto();

        // El reparto queda escrito antes de tocar un solo papel: con que meta se
        // pidio, que objetivo salio de ella y en que venta corta el dia. Sin esto
        // el 70/30 solo vive en esta peticion, y manana la pantalla recalcula el
        // corte con la meta que tenga puesta la barra.
        $runId = $this->abrirCorrida('dia', $dia, $plan);

        // Las mudanzas quedan firmadas por esta corrida. Se sellan aqui y no al
        // aplicarlas porque la corrida nace despues: guarda el reparto, y el
        // reparto solo se puede calcular con los cargos ya en su sitio.
        $this->stampReassignmentsByDay([$runId, $this->branchId(), $dia]);

        // Los papeles se cuentan aqui y no en el plan: el plan dice a que tasa cae
        // la venta, pero el papel puede no armarse (sin productos que cuadren el
        // monto), y el resumen tiene que contar lo que de verdad quedo con ticket.
        $monto0    = 0;
        $cuenta0   = 0;
        $armados16 = 0;
        $servicio  = 0;
        $sinPapel  = 0;
        $lugar     = 0;

        // Los papeles de la corrida anterior sueltan su NOTA —no se borran— TODOS
        // antes de armar ninguno, en una pasada aparte. Liberarla sobre la marcha
        // funciona solo mientras la numeracion no se mueva, y se mueve: la nota es
        // el lugar de la venta en el dia, asi que una carga nueva del Excel o un
        // cambio en el universo del listado recorren todas las notas.
        //
        // Cuando eso pasa, la venta que estrena la nota 3 choca con el papel viejo
        // de la que hoy es la 6 y que todavia no se ha recorrido: el UNIQUE
        // (issue_date, note_number, branch_id) rechaza la insercion y esa venta se
        // queda sin papel, en silencio y contada como si le faltaran productos.
        //
        // El papel se queda porque su id es la identidad interna del ticket (punto
        // 22.1) y rehacer el reparto no lo convierte en otro documento: la nota se
        // aparta en negativo, cada venta actualiza la suya y al final se borran
        // solo los que nadie reutilizo.
        $previos = [];

        foreach ($ventas as $item) {
            if (esFacturado($item['status_name'])) continue;
            if (empty($item['virtual_id']))        continue;

            $previos[] = (int) $item['virtual_id'];
        }

        $this->releaseVirtualNotes($previos);

        foreach ($ventas as $item) {
            $lugar++;

            if (esFacturado($item['status_name'])) continue;

            // El servicio de mesa queda fuera del reparto: no ampara ningun cargo
            // con tarjeta, asi que no tiene nada que mandar al 16% ni al 0%. Su
            // papel es el unico del dia que no se arma con productos, y por eso se
            // atiende antes de preguntarle al plan, que ni siquiera lo agrupo.
            if (esServicio($item)) {
                if ($this->guardarTicketServicio($item, $lugar, $runId)) $servicio++;
                else                                                    $sinPapel++;

                continue;
            }

            if ($plan['grupo'][$item['id']] === '16') {
                // Con su comanda cargada el ticket imprime lo que de verdad
                // consumieron: ese papel manda y no se inventa nada encima.
                //
                // Salvo que el monto del papel ya no sea el de la cuenta —el folio
                // que cedio o recibio un cargo, la cuenta partida entre dos formas
                // de pago—: ahi la comanda suma otra cifra y hay que armarle papel
                // del catalogo aunque la tenga (ver comandaCuadra).
                if (!empty($item['tiene_detalle']) && comandaCuadra($item)) continue;

                // La venta que el POS no reporta con impuesto no puede recibir un
                // papel al 16%: se queda como esta y el listado la sigue marcando.
                $tasa = tasaDe($item);

                if ($tasa <= 0 || empty($conIva)) continue;

                if ($this->guardarTicketVirtual($item, $conIva, $lugar, $tasa, $runId, $semilla)) $armados16++;
                else                                                                              $sinPapel++;

                continue;
            }

            // Grupo 0%: la nota es el lugar de la venta en el dia, el mismo que la
            // pantalla ya venia mostrando antes de generar nada.
            if (!$this->guardarTicketVirtual($item, $puente, $lugar, 0, $runId, $semilla)) {
                $sinPapel++;
                continue;
            }

            $monto0 += (float) $item['total'];
            $cuenta0++;
        }

        // Los que se quedaron con la nota apartada: este reparto ya no los
        // contempla —la venta salio del grupo del cero, o su comanda ahora cuadra y
        // el papel lo pone el POS—, asi que ahi si se sueltan de verdad.
        $this->deleteReleasedVirtualTickets($previos);

        // Lo que el punto 29 pide contar de la ejecucion. Los cargos que de verdad
        // cambiaron de folio son los que encontraron destino: el sobrante que se
        // quedo sin folio libre viaja en la lista con destino vacio y no se mudo a
        // ningun lado, asi que contarlo diria que el dia movio mas de lo que movio.
        $mudados = count(array_filter($reasignados, function ($mov) {
            return $mov['destino'] !== null;
        }));

        $this->cerrarCorrida($runId, [
            'billed_0'          => $monto0,
            'count_0'           => $cuenta0,
            'no_paper'          => $sinPapel,
            'movements_count'   => count($ventas),
            'reassigned_count'  => $mudados,
            // Los papeles de $0.00 se cuentan aparte de los del 0%: aquellos son
            // tasa —llevan importe y renglones puente— y estos son importe, el
            // servicio de mesa y el movimiento que vino en cero (punto 18).
            'zero_ticket_count' => $servicio
        ]);

        return array_merge(
            [
                'status'  => 200,
                'message' => number_format($cuenta0) . ' ticket(s) al 0% generados · ' . number_format($plan['cuenta16'] + $plan['facturados']) . ' al 16%'
                             . ($armados16 > 0 ? ' (' . number_format($armados16) . ' con papel del catalogo)' : ''),
                'dia'     => $dia
            ],
            $this->resumenReparto([
                'dia'         => $dia,
                'generacion'  => $this->corridaFolio,
                'total'       => $plan['total'],
                'objetivo'    => $plan['objetivo'],
                'facturado'   => $plan['facturado'],
                'monto16'     => $plan['monto16'],
                'monto0'      => $monto0,
                // Los tickets del reparto son los que traen monto: el servicio de
                // mesa se cuenta aparte para que la suma de los grupos siga
                // cuadrando contra el numero que encabeza el resumen.
                'tickets'     => count($ventas) - $servicio,
                'facturados'  => $plan['facturados'],
                'cuenta16'    => $plan['cuenta16'],
                'cuenta0'     => $cuenta0,
                'armados16'   => $armados16,
                'servicio'    => $servicio,
                'reasignados' => $reasignados,
                'sinPapel'    => $sinPapel
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

        // Los cargos vuelven a su folio antes de que se vaya la corrida que los
        // mudo: dejar el dia sin repartir es dejarlo como lo mando el POS, y un
        // cargo mudado sin corrida que lo explique seria un monto movido de folio
        // que ya nadie puede rastrear.
        $this->clearReassignmentsByDay([$this->branchId(), $dia]);

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
            // El registro maestro que dejo esta ejecucion (punto 29). Viaja vacio en
            // la vista previa, que todavia no abrio ninguna corrida.
            'generacion'        => $r['generacion'] ?? '',
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
            // El servicio de mesa no es un tercer grupo del reparto: son las
            // cuentas que se cobraron sin tarjeta y solo recibieron su papel. Se
            // reporta para que el conteo del dia cuadre a la vista.
            'servicio'          => $r['servicio'] ?? 0,
            // Los cargos que cambiaron de folio, escritos como los va a leer quien
            // audite el dia: de donde salio, a donde entro y por cuanto. El que se
            // quedo sin folio libre viaja con destino vacio y la pantalla lo dice,
            // porque es el unico caso en que la regla no se pudo cumplir.
            'reasignados'       => array_map(function ($mov) {
                return [
                    'origen'      => $mov['origen'],
                    'destino'     => $mov['destino'] ?: '',
                    'montoTexto'  => money($mov['monto'])
                ];
            }, $r['reasignados'] ?? []),
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
    //
    // La fecha del papel sale de SU venta y no del dia que se esta cerrando. Las
    // dos coinciden siempre —el cierre reparte las ventas que ese dia filtro—,
    // pero coincidian por convencion y no por construccion: bastaba con que el
    // universo del cierre dejara de ser un solo dia para que los papeles salieran
    // sellados con la fecha de la pantalla. La regla del punto 23 es que la fecha
    // operativa la pone el movimiento, y asi lo hace ya `generarFolio`.
    function guardarTicketVirtual($item, $productos, $nota, $tasa, $runId = null, $semilla = 0) {
        $armado   = $this->armarPapel($item['total'], $productos, semillaFolio($item['folio'], $semilla));
        $subtotal = $armado['subtotal'];
        $total    = (float) $item['total'];

        if (empty($armado['lineas'])) return false;

        $base = $tasa > 0 ? round($total / (1 + $tasa), 2) : $total;

        return $this->guardarPapel($item, [
            'note_number' => $nota,
            'subtotal'    => $subtotal,
            'discount'    => max(0, round($subtotal - $total, 2)),
            'tax_rate'    => $tasa,
            'tax'         => $tasa > 0 ? round($total - $base, 2) : 0,
            'total'       => $total,
            'issue_date'  => diaDe($item),
            'sale_id'     => $item['id'],
            // De que corrida salio este papel. Es lo que permite auditar despues
            // con que meta se repartio el dia en que se armo.
            'generation_run_id' => $runId ?: null
        ], $this->partidasDe($armado['lineas']));
    }

    // El papel de una venta, se este armando por primera vez o volviendo a armar.
    //
    // Regenerar es ACTUALIZAR el mismo ticket, no cambiarlo por otro: su id es la
    // identidad interna del papel (punto 22.1) y tiene que sobrevivir a que el dia
    // se rehaga. Lo que se reemplaza son los renglones.
    //
    // Los dos folios se guardan con el papel y no se consultan al imprimir:
    //
    //   visible_folio  el que sale impreso, que es el de su venta.
    //   origin_folio   el movimiento del que salio el cargo que ampara. El mismo,
    //                  salvo que el punto 17 haya mudado un cargo hasta este folio.
    //
    // Son una foto, no un enlace: la mudanza se recalcula entera en cada cierre y
    // se deshace al eliminar el dia, y el papel que ya se entrego tiene que poder
    // seguir diciendo de donde vino su cargo.
    function guardarPapel($item, $campos, $lineas) {
        $campos['visible_folio'] = $item['folio'];
        $campos['origin_folio']  = folioOrigen($item);
        $campos['branch_id']     = $this->branchId();

        $ticketId = (int) (isset($item['virtual_id']) ? $item['virtual_id'] : 0);

        if ($ticketId > 0) {
            // El id va al final porque util->sql toma el ultimo campo como WHERE.
            $campos['id'] = $ticketId;

            if (!$this->updateVirtualTicket($this->util->sql($campos, 1))) return false;

            $this->deleteVirtualDetailByTicket([$ticketId]);
        } else {
            if (!$this->createVirtualTicket($this->util->sql([$campos]))) return false;

            // El recien insertado se busca por su llave natural —el consecutivo del
            // dia es unico por sucursal— y no por el ultimo id de la tabla.
            $creado   = $this->getVirtualTicketByNote([$campos['issue_date'], $campos['note_number'], $this->branchId()]);
            $ticketId = (int) ($creado[0]['id'] ?? 0);

            if ($ticketId === 0) return false;
        }

        foreach ($lineas as $i => $linea) $lineas[$i]['virtual_ticket_id'] = $ticketId;

        return (bool) $this->createVirtualDetail($this->util->sql($lineas));
    }

    // Los renglones del armador con la forma que espera detail_virtual_ticket. El
    // ticket al que se cuelgan lo pone guardarPapel, que es quien sabe su id.
    function partidasDe($lineas) {
        $partidas = [];

        foreach ($lineas as $linea) {
            $partidas[] = [
                'description' => $linea['description'],
                'quantity'    => $linea['quantity'],
                'unit_price'  => $linea['unit_price'],
                'amount'      => $linea['amount'],
                'product_id'  => $linea['product_id']
            ];
        }

        return $partidas;
    }

    // El papel del servicio de mesa. Es el unico del dia que no se arma con
    // productos, y no por falta de catalogo: la cuenta que se cobro sin tarjeta no
    // va a pedir factura, asi que buscarle una combinacion que cuadre el monto
    // seria inventarle un consumo a un documento que nadie va a deducir.
    //
    // Un solo renglon en cero: aqui el renglon ES el total, y el total no ampara
    // ningun cargo por definicion. Lo que la cuenta haya cobrado (ver sale_total)
    // no cambia nada del papel: el movimiento que vino con Total $0.00 recibe el
    // mismo que el servicio de mesa, porque el folio se tiene que emitir igual para
    // que la secuencia del dia no salte un numero.
    function guardarTicketServicio($item, $nota, $runId = null) {
        return $this->guardarPapel($item, [
            'note_number' => $nota,
            'subtotal'    => 0,
            'discount'    => 0,
            'tax_rate'    => 0,
            'tax'         => 0,
            'total'       => 0,
            'issue_date'  => diaDe($item),
            'sale_id'     => $item['id'],
            'generation_run_id' => $runId ?: null
        ], [
            // El renglon va sin producto: no salio del catalogo, y apuntarlo a uno
            // cualquiera ensuciaria lo que ese producto reporta haber vendido.
            [
                'description' => CONCEPTO_SERVICIO,
                'quantity'    => 1,
                'unit_price'  => 0,
                'amount'      => 0,
                'product_id'  => null
            ]
        ]);
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
        $total = totalDelPapel($item);

        // El ticket real de un dia sin comandas cargadas se quedaria sin renglones:
        // el papel saldria en blanco y con el descuento en negativo. Se imprime
        // entonces el consumo como una sola partida, que es lo unico que la venta
        // sabe de si misma cuando su detalle no esta en el sistema y todavia no se
        // le armo papel.
        //
        // El servicio de mesa llega aqui sin renglones a proposito y no por falta
        // de datos (ver getTicket), y su partida se llama por su nombre: lo que
        // ampara es la cuenta, no lo que se consumio en ella.
        if (!$esVirtual && empty($lineas)) {
            $lineas = [[
                'description' => esServicio($item) ? CONCEPTO_SERVICIO : 'CONSUMO',
                'quantity'    => 1,
                'amount'      => $total
            ]];
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
            // Cuatro papeles distintos, y el copy de la pantalla los nombra: el
            // inventado al 0%, el inventado con IVA, el consumo real y el servicio
            // de mesa. Este ultimo se pregunta primero porque tambien se guarda
            // como ticket virtual al 0%, y sin la pregunta se leeria como uno del
            // reparto.
            'grupo'     => esServicio($item)
                ? 'servicio'
                : ($esVirtual
                    ? ($tasa > 0 ? 'ivaGenerado' : 'cero')
                    : (esFacturado($item['status_name']) ? 'facturado' : 'real')),
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
            'billed_0'        => $monto0,
            'count_0'         => $generados,
            'no_paper'        => count($pendientes) - $generados,
            'movements_count' => count($pendientes)
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

        // El papel en cero —el servicio de mesa y el movimiento que vino con Total
        // $0.00— no se arma con productos y sale con el cierre del dia, como el de
        // todos los demas. Sin esto la peticion termina en "no se pudo armar un
        // ticket que cuadre con $0.00", que suena a catalogo incompleto cuando lo
        // que pasa es que no hay nada que cuadrar.
        if (esServicio($item)) {
            return [
                'status'  => 400,
                'message' => 'El movimiento no ampara ningun cargo con tarjeta: su papel se emite en $0.00 con el cierre del dia.'
            ];
        }

        $armado = $this->armarTicket($item);
        if ($armado['status'] !== 200) return $armado;

        $dia = diaDe($item);

        // Regenerar un papel a mano tambien es un proceso de generacion. Cuando la
        // pasada de pendientes ya abrio la suya se hereda, y si no se abre una de
        // este solo ticket.
        $propia = !$runId;

        if ($propia) $runId = $this->abrirCorrida('folio', $dia);

        // La nota no se pide ni se inventa: es el lugar que la venta ocupa en su
        // dia, el mismo que ya se ve en el listado. Regenerar un ticket suelto no
        // la mueve.
        $notas = $this->notasDelDia($dia);
        $nota  = (int) ($notas[$item['id']] ?? 0);

        if ($nota === 0) return ['status' => 400, 'message' => 'La venta no aparece en el corte del dia'];

        $subtotal = $armado['subtotal'];
        $total    = (float) $item['total'];

        // El papel puente siempre va al 0%: la tasa vive en el ticket porque la
        // venta sigue diciendo lo que trajo el POS.
        //
        // El papel anterior no se cambia por otro: se actualiza (ver guardarPapel),
        // asi que el ticket conserva su id ademas de su nota.
        $guardado = $this->guardarPapel($item, [
            'note_number' => $nota,
            'subtotal'    => $subtotal,
            'discount'    => max(0, round($subtotal - $total, 2)),
            'tax_rate'    => 0,
            'tax'         => 0,
            'total'       => $total,
            'issue_date'  => $dia,
            'sale_id'     => $item['id'],
            'generation_run_id' => $runId ?: null
        ], $this->partidasDe($armado['lineas']));

        if (!$guardado) return ['status' => 500, 'message' => 'No se pudo guardar el ticket virtual'];

        // El registro maestro del ticket suelto se cierra aqui, con el unico
        // movimiento que atendio. La corrida heredada no se toca: la cierra la
        // pasada que la abrio, con el conteo de toda la tanda.
        if ($propia) {
            $this->cerrarCorrida($runId, [
                'billed_0'        => $total,
                'count_0'         => 1,
                'movements_count' => 1
            ]);
        }

        return [
            'status'     => 200,
            'message'    => 'Ticket virtual generado con la nota #' . $nota,
            'nota'       => $nota,
            'folio'      => $folio,
            'generacion' => $propia ? $this->corridaFolio : ''
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

// La fecha operativa de una venta: el dia al que pertenece el movimiento, sin su
// hora. Es la que sella el papel (punto 23), y sale del propio movimiento para
// que no dependa de lo que la pantalla tenga seleccionado.
function diaDe($item) {
    return date('Y-m-d', strtotime($item['operation_date']));
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

    // El servicio de mesa no traslada impuesto aunque la venta que lo respalda si
    // lo traiga: su papel no ampara un cargo con tarjeta, asi que no hay IVA que
    // acreditar. Sin esto la fila lo anunciaria al 16% hasta que se genere el dia,
    // y despues al 0%, como si hubiera cambiado de tasa.
    if (esServicio($item)) return 0;

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

// El folio que no ampara ningun cargo que facturar. Son dos casos distintos que
// terminan en el mismo papel —un ticket en $0.00 que conserva el folio y su lugar
// en la secuencia del dia— y por eso se preguntan juntos:
//
//   servicio de mesa   la cuenta cobro dinero, pero no por tarjeta. Su monto
//                      procesable es cero y el de la venta no: esa distancia
//                      entre las dos cifras es lo que lo define.
//   movimiento en cero el Excel lo trajo con Total $0.00. No cobro nada, asi que
//                      las dos cifras son cero (regla 18).
//
// No se pregunta por la forma de pago sino por el monto, porque el monto ya
// incorpora la mudanza de cargos: el folio de efectivo que recibio un voucher deja
// de ser servicio de mesa sin que su forma de pago original haya cambiado, y el
// folio que cedio su unico cargo se convierte en uno.
//
// El servicio de mesa solo existe en Wansoft —en Soft Restaurant el monto
// procesable es el total de la venta y las dos cifras nunca se separan—, pero el
// movimiento en cero puede llegar de cualquiera de los dos.
function esServicio($item) {
    return (float) $item['total'] <= 0;
}

// De los dos casos del papel en cero, cual es el movimiento que vino con Total
// $0.00: el que ademas no cobro nada. El servicio de mesa si cobro —en efectivo, por
// transferencia— y esa es la unica diferencia entre ellos.
//
// No cambia el papel, que es el mismo para los dos: separa lo que la PANTALLA tiene
// que decir de cada uno, porque el importe que no se factura se explica distinto
// cuando existe («se cobro en efectivo») que cuando nunca existio.
function esCeroDeOrigen($item) {
    return (float) ($item['sale_total'] ?? 0) <= 0;
}

// El importe que imprime un papel. Es el monto procesable —lo que el folio va a
// facturar— y en el servicio de mesa eso es cero: su papel no ampara ningun cargo
// con tarjeta, asi que no tiene nada que imprimir aunque la cuenta si haya
// cobrado dinero real (ver sale_total).
function totalDelPapel($item) {
    return esServicio($item) ? 0 : (float) $item['total'];
}

// Si el papel puede imprimir la comanda que trajo el POS. Solo cuando el monto que
// ampara es el de la cuenta entera: entonces los renglones reales suman el total
// del papel y el ticket es el consumo, sin nada que cuadrar.
//
// Cuando no coinciden hay que armarle papel del catalogo aunque su comanda este
// cargada, o el ticket sale con un descuento inventado del tamano de la
// diferencia. Pasa en tres casos, y los tres son de Wansoft:
//
//   la cuenta partida entre la tarjeta y otra forma de pago, donde solo la parte
//   con tarjeta viaja en el papel;
//   el folio que CEDIO un cargo, que bajo de monto y su comanda se quedo arriba;
//   el folio que lo RECIBIO, que subio de monto y su comanda se quedo abajo.
//
// En Soft Restaurant nunca se separan: ahi el monto procesable ES el total de la
// venta, asi que esto siempre da cierto y la comanda manda como siempre.
function comandaCuadra($item) {
    return abs(totalDelPapel($item) - (float) ($item['sale_total'] ?? 0)) < 0.005;
}

// Las dos reglas que deciden si una venta puede recibir papel, leidas del veredicto
// que getTicketByFolio ya calculo en la base. Devuelve el motivo del rechazo, o
// cadena vacia cuando la venta es elegible.
//
// El mensaje nombra el dato que la descalifica (la forma de pago, el estado) porque
// quien pide el ticket a mano necesita saber por que no salio.
function vetoDeGeneracion($item) {
    if (empty($item['es_credito'])) {
        $formas = $item['payment_real'] ?: $item['payment_name'] ?: 'sin pago registrado';

        return 'La venta se cobro con ' . $formas . ': su papel es el de ' . strtolower(CONCEPTO_SERVICIO)
             . ' y sale con el cierre del dia, no se arma por separado.';
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
// El offset es lo que permite REGENERAR la combinacion desde la vista previa
// (punto 20) sin renunciar a lo anterior: con 0 —el caso de siempre— devuelve
// exactamente el crc32 del folio, asi que un papel ya emitido se rearma igual. Con
// otro numero el mismo folio saca otra mezcla, y ese numero queda escrito en la
// corrida (generation_run.paper_seed) para que el dia se pueda rehacer identico.
function semillaFolio($folio, $offset = 0) {
    $offset = (int) $offset;

    return $offset === 0 ? crc32((string) $folio) : crc32($folio . '#' . $offset);
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

// Cuatro estados: el facturado esta bloqueado (no se le arma nada), el servicio de
// mesa no factura, el de tasa 0 pide ticket virtual y el resto queda pendiente de
// facturar.
// Cada estado sale con su tono del core (b-green, b-blue, b-gray, b-yellow) y ademas
// con una clase propia —st-fact, st-serv, st-16, st-0, st-req, st-nof—. El tono no
// alcanza para distinguirlos: "IVA 0%", "Servicio" y "No facturado" comparten b-gray
// y significan cosas distintas, asi que sin ese gancho la hoja de estilos no puede
// darles trato aparte. La terminal Wansoft lo usa para pintarlos sin pildora; el
// Facturador no declara reglas para esas clases y se ve igual que siempre.
function badgeEstado($item, $tasa, $grupo = '') {
    if (esFacturado($item['status_name'])) {
        return '<span class="badge-base b-green st-fact"><i data-lucide="lock" class="w-3 h-3"></i>Facturado ' . $item['invoice_series'] . '</span>';
    }

    // El folio que no ampara ningun cargo con tarjeta. Va en gris y no en ambar
    // porque no es un pendiente: nadie tiene que hacer nada con el, y su papel sale
    // solo con el cierre del dia como el de todos los demas.
    //
    // La pildora dice "Servicio" a secas y no el CONCEPTO_SERVICIO completo: en una
    // columna de badges cortos el nombre entero pesaba de mas, y aqui basta para
    // distinguirlo de las tasas. El papel si lo imprime completo, que es donde el
    // nombre se entrega.
    if (esServicio($item)) {
        return '<span class="badge-base b-gray st-serv">Servicio</span>';
    }

    // El ticket generado dice a que tasa se armo su papel: al 0% el que el reparto
    // mando a esa tasa, al 16% el de la venta que llego sin comanda y estreno papel
    // del catalogo de IVA. El color separa las dos tasas de un vistazo: azul el
    // 16%, gris el 0%.
    if (!empty($item['virtual_id'])) {
        $tono = $tasa == 0 ? 'b-gray st-0' : 'b-blue st-16';

        return '<span class="badge-base ' . $tono . '">IVA ' . porcentaje($tasa) . '</span>';
    }

    // Todavia sin papel, pero el reparto ya sabe a que tasa cae: es el mismo plan
    // que dibuja la linea de corte de la tabla. La fila lo dice desde ahora, porque
    // lo que falta es el papel y no la tasa.
    //
    // Va en el color de su tasa, el mismo del ticket ya generado: es la misma tasa.
    // Que tenga papel o no lo dicen la nota en negrita y el ojo de la fila, no un
    // segundo tono del mismo color que nadie explico. Lo unico aparte es el title,
    // que esta en futuro.
    //
    // Antes caian todas en «No facturado», que es el estado de la venta frente al
    // SAT y no dice nada de a que tasa va: dos cosas distintas en la misma palabra.
    if ($grupo !== '') {
        $cero = $grupo === '0';

        $razon = $cero
            ? 'Su papel se arma al 0% al generar los tickets del dia'
            : 'Se factura al 16% al generar los tickets del dia';

        return '<span class="badge-base ' . ($cero ? 'b-gray st-0' : 'b-blue st-16') . '" title="' . $razon . '">'
             . 'IVA ' . ($cero ? '0%' : '16%') . '</span>';
    }

    if ($tasa == 0) return '<span class="badge-base b-yellow st-req">Requiere ticket virtual</span>';

    return '<span class="badge-base b-gray st-nof">No facturado</span>';
}

function estadoTexto($item, $tasa) {
    if (esFacturado($item['status_name'])) return 'FACTURADO';
    if (esServicio($item))                 return CONCEPTO_SERVICIO;
    if ($tasa == 0)                        return 'IVA 0%';

    return $item['status_name'] ? strtoupper($item['status_name']) : 'SIN ESTADO';
}

// El movimiento PDV del que salio el cargo que el papel ampara (punto 22.1). Es
// el suyo salvo que el punto 17 haya mudado un cargo hasta aqui: entonces el papel
// se imprime con su folio pero el dinero nacio en el de origen.
//
// Manda lo que el ticket guardo al emitirse: la mudanza se recalcula entera en
// cada cierre, y el papel que ya se entrego no puede cambiar de origen porque el
// dia se haya vuelto a repartir. Sin papel todavia se lee de la mudanza vigente,
// que es lo que se va a guardar cuando se genere.
//
// Del listado llega una lista —una cuenta partida en tres cede dos cargos—, pero
// del lado del que RECIBE siempre es uno: receptorProximo se lleva el folio libre
// al usarlo, asi que ningun folio recibe dos.
function folioOrigen($item) {
    if (!empty($item['origin_folio'])) return $item['origin_folio'];

    $recibido = trim((string) (isset($item['recibido_de']) ? $item['recibido_de'] : ''));

    if ($recibido === '') return $item['folio'];

    $folios = explode(',', $recibido);

    return trim($folios[0]);
}

// La marca de la mudanza, en la fila de los dos folios que participan: el que
// recibio el cargo y el que lo cedio. Sin ella el listado mostraria un folio de
// efectivo cobrando mil pesos con tarjeta sin decir de donde salieron, que es
// exactamente la clase de cifra que nadie se atreve a facturar.
//
// Azul el que recibe —es el que ahora factura— y ambar el que cede, que es el que
// bajo de monto respecto de lo que dice su ticket impreso.
function badgeReasignacion($item) {
    $badges = '';

    if (!empty($item['recibido_de'])) {
        $badges .= '<span class="badge-base b-blue ml-1" title="Ampara un cargo con tarjeta que se cobro en el folio '
                 . htmlspecialchars($item['recibido_de'], ENT_QUOTES) . '">&larr; ' . htmlspecialchars($item['recibido_de'], ENT_QUOTES) . '</span>';
    }

    if (!empty($item['cedido_a'])) {
        $badges .= '<span class="badge-base b-yellow ml-1" title="Traia mas de un cargo con tarjeta: el resto se mudo al folio '
                 . htmlspecialchars($item['cedido_a'], ENT_QUOTES) . '">&rarr; ' . htmlspecialchars($item['cedido_a'], ENT_QUOTES) . '</span>';
    }

    return $badges;
}

// El monto de la fila es lo que ese folio va a facturar, no lo que la cuenta
// cobro. En el servicio de mesa las dos cifras se separan: no factura nada aunque
// haya cobrado dos mil pesos en efectivo.
//
// Ese guion va en gris y con el cobro real en el title, porque un monto vacio sin
// explicacion se lee como un dato que falta —y el reflejo es ir a buscarlo a la
// carga del Excel, donde esta perfectamente.
function montoCelda($item) {
    if (!esServicio($item)) {
        return '<span class="font-semibold text-white">' . money($item['total']) . '</span>';
    }

    // El movimiento que vino con Total $0.00 no tiene cobro que nombrar: decir que
    // "se cobro en tarjeta de credito por $0.00" mandaria a buscar un importe que
    // el Excel nunca trajo.
    if (esCeroDeOrigen($item)) {
        return '<span class="text-gray-500" title="No factura: el movimiento vino sin importe en la carga">-</span>';
    }

    $cobro = $item['payment_real'] ? strtolower($item['payment_real']) : 'sin pago registrado';

    return '<span class="text-gray-500" title="No factura: la cuenta se cobro en ' . htmlspecialchars($cobro, ENT_QUOTES)
         . ' por ' . money($item['sale_total']) . '">-</span>';
}

// Por que una fila del dia sin repartir no puede ensenar papel todavia. Cadena
// vacia cuando si puede: la venta trae su comanda cargada y esa comanda suma lo
// que el folio ampara, asi que su ticket al 16% es el consumo real y no una
// propuesta del catalogo.
//
// Es la misma pregunta que resuelve getTicket al armar el papel, escrita aqui para
// que el ojo no prometa un ticket que despues sale del catalogo.
function motivoSinPapel($item, $repartido, $grupo) {
    // El servicio de mesa se abre siempre, tenga papel o no: el suyo no lleva el
    // consumo —papelDe le pone su propio renglon— asi que abrirlo no ensena
    // productos que todavia no son de nadie. Y hay algo que ensenar: la cuenta
    // cobro dinero, aunque no por tarjeta, y su monto procesable sea $0.00.
    if (esServicio($item)) return '';

    // La venta que el reparto manda al 0% no tiene papel hasta que se genera: sus
    // renglones los inventa el generador con productos puente, asi que abrirla
    // antes es leer una propuesta como si fuera el ticket definitivo.
    if ($grupo === '0') return 'tasa-cero';

    // Las dos razones que siguen son del dia sin repartir: pasado el reparto, la
    // venta al 16% ya tiene su papel guardado o su comanda con que abrirse.
    if ($repartido) return '';

    // La venta que llego sin su detallado no tiene renglones que mostrar.
    if (empty($item['tiene_detalle'])) return 'sin-comanda';

    // La tiene, pero por otro monto: la cuenta partida y los dos lados de una
    // mudanza de cargos. Sus renglones no suman lo que el papel ampara.
    if (!comandaCuadra($item)) return 'comanda-parcial';

    return '';
}

// Una accion por fila y segun el estado: el facturado solo avisa que esta
// bloqueado, el que va al 0% abre cuando su papel ya esta generado, el del dia sin
// repartir abre solo si su comanda esta cargada, y el resto abre su ticket virtual.
//
// $grupo es a que tasa lo manda el reparto ('16', '0', o vacio en el servicio de
// mesa, que no se reparte): sale de planReparto, el mismo plan que dibuja la linea
// de corte de la tabla y que aplica el cierre del dia.
function accionTicket($item, $repartido = true, $grupo = '') {
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

    // Solo se abre lo que ya existe: el papel guardado, o la venta con su comanda
    // cargada, que ensena el consumo que iria en su papel al 16%. Las demas dicen en
    // el title por que no, que es lo unico que quien mira la fila puede hacer al
    // respecto.
    $motivo = !empty($item['virtual_id']) ? '' : motivoSinPapel($item, $repartido, $grupo);

    if ($motivo) {
        $razon = [
            'tasa-cero'       => 'Su papel se arma al generar los tickets del dia',
            'sin-comanda'     => 'La venta llego sin su comanda: su papel se arma al generar los tickets del dia',
            'comanda-parcial' => 'El folio ampara solo parte de la cuenta: su papel se arma al generar los tickets del dia'
        ][$motivo];

        return [
            [
                'class'   => 'btn-icon-view',
                'html'    => '<i data-lucide="eye-off" class="w-3.5 h-3.5 text-gray-500"></i>',
                'title'   => $razon,
                'onclick' => "tickets.pendingNotice('{$motivo}')"
            ]
        ];
    }

    // Un solo color para toda la columna: el ojo abre la fila y eso es lo mismo en
    // todas. Lo que cambia de una a otra —si su papel ya esta guardado— ya lo dicen
    // el badge de Estado y la columna Nota, y teñir el icono lo repetia con un
    // codigo de color que no estaba explicado en ningun lado.
    //
    // Sin reparto corrido el clic no arma nada: ensena el ticket de la venta con
    // lo que realmente consumieron, que es el papel que le tocaria al 16%.
    $texto = !empty($item['virtual_id'])
        ? 'Ver el ticket virtual'
        : ($repartido ? 'Armar el ticket virtual' : 'Ver el ticket de la venta');

    return [
        [
            'class'   => 'btn-icon-view',
            'html'    => '<i data-lucide="eye" class="w-3.5 h-3.5"></i>',
            'title'   => $texto,
            'onclick' => "app.selectTicket('{$folio}')"
        ]
    ];
}

$obj = new ctrl();
echo json_encode($obj->{$_POST['opc']}());
