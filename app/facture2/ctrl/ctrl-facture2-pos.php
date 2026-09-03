<?php
session_start();
if (empty($_POST['opc'])) exit(0);

require_once '../mdl/mdl-facture2-pos.php';

// Quien cobra en la terminal no queda registrado en el esquema: el Excel del POS no
// exporta cajero y la terminal todavia no tiene sesion propia. El papel imprime este
// nombre —el mismo que ya usa el Facturador— y no uno inventado por ticket.
define('CAJERO_TERMINAL', 'ADMINISTRACION');

// Las dos partidas que imprime el papel real cuando la comanda del dia no esta
// cargada. Son las mismas del Facturador (ctrl-facture-tickets.php): el ticket que
// se reimprime aqui tiene que salir identico al que se emitio alla.
define('CONCEPTO_SERVICIO', 'SERVICIO DE MESA');
define('CONCEPTO_CONSUMO',  'CONSUMO');

class ctrl extends mdl {

    public $branch;

    public function __construct() {
        parent::__construct();
        $this->branch  = $this->resolveBranch();
        $this->posCode = $this->resolvePos();
    }

    // La sucursal del modulo vive en el esquema del Facturador, no en la sesion de
    // Huubie, y se cachea en sesion como alla.
    function resolveBranch() {
        if (!empty($_SESSION['FACTURE_BRANCH'])) return (int) $_SESSION['FACTURE_BRANCH'];

        $ls = $this->getBranch();
        $id = (int) ($ls[0]['id'] ?? 0);
        if ($id > 0) $_SESSION['FACTURE_BRANCH'] = $id;

        return $id;
    }

    function resolvePos() {
        $ls = $this->getPosCode([$this->branchId()]);

        return strtolower((string) ($ls[0]['code'] ?? ''));
    }

    // branch_id admite NULL: sin sucursal dada de alta se leen las filas sin
    // sucursal en vez de romper la FK.
    function branchId() {
        return $this->branch > 0 ? $this->branch : null;
    }

    // Un read que no pudo ejecutarse devuelve null, no una lista vacia (ver _Read en
    // _CRUD). Recorrer ese null imprime un Warning ANTES del JSON y la pantalla se
    // queda sin respuesta que leer: un dia sin papeles tiene que llegar al frente
    // como un dia vacio, no como una pantalla rota.
    function filas($ls) {
        return is_array($ls) ? $ls : [];
    }

    // -- Interface --

    // La pantalla abre en el ultimo dia CON VENTAS COBRADAS, no en hoy: el Excel del
    // POS se sube en diferido y el dia de hoy casi nunca tiene nada. Y no en el
    // ultimo dia con tickets aprobados, como antes: la mitad del dia se reimprime
    // desde su comanda real y no espera a que nadie apruebe nada, asi que ese
    // criterio abria en un dia viejo teniendo trabajo mas reciente a la vista.
    //
    // Los dos extremos salen iguales porque el modo que abre es el de un dia suelto.
    function init() {
        $dias = $this->filas($this->lsDias([$this->branchId()]));
        $dia  = $dias[0]['id'] ?? date('Y-m-d');

        return [
            'status' => 200,
            'dias'   => $dias,
            'fi'     => $dia,
            'ff'     => $dia,
            'emisor' => $this->emisor()
        ];
    }

    // El listado del periodo. Las columnas las decide esta funcion y viajan con las
    // filas, porque son dos las que solo aparecen cuando dicen algo:
    //
    //   Fecha  solo con mas de un dia. Con un dia suelto repetiria en cada renglon
    //          lo que el campo de arriba ya dice.
    //   Hora   solo si alguna venta la trae. Wansoft exporta la fecha de operacion
    //          sin hora, y la columna saldria vacia de arriba a abajo.
    function lsTickets() {
        $fi      = $_POST['fi'];
        $ff      = $_POST['ff'];
        $multi   = $fi !== $ff;
        $__row   = [];
        $conHora = false;

        $ls = $this->filas($this->listTickets([$this->branchId(), $fi, $ff]));

        foreach ($ls as $item) {
            if ($this->tieneHora($item)) $conHora = true;
        }

        foreach ($ls as $item) {
            $fila = ['id' => $item['sale_id']];

            // La casilla viaja con el movimiento porque es la seleccion la que se
            // manda a imprimir, y ese es el numero con el que se piden los papeles.
            $fila['check'] = checkCell($item['folio'], $this->totalDe($item));

            if ($multi) $fila['fecha'] = fechaCorta($item['issue_date']);

            $fila['orden']      = (string) $item['note_number'];
            $fila['movimiento'] = $item['folio'];
            $fila['mesa']       = $this->mesaDe($item);
            $fila['mesero']     = $this->meseroDe($item);

            if ($conHora) $fila['hora'] = $this->horaDe($item);

            $fila['total'] = money($this->totalDe($item));

            $__row[] = $fila;
        }

        return [
            'status' => 200,
            'thead'  => $this->theadTickets($multi, $conHora),
            'row'    => $__row
        ];
    }

    // La primera columna no tiene titulo: lleva la casilla que marca todo el
    // periodo, y rotularla "Todos" diria dos veces lo que la casilla ya hace.
    function theadTickets($multi, $conHora) {
        $thead = [checkAllCell()];

        if ($multi) $thead[] = 'Fecha';

        $thead = array_merge($thead, ['Orden', 'Movimiento', 'Mesa', 'Mesero']);

        if ($conHora) $thead[] = 'Hora';

        $thead[] = 'Total';

        return $thead;
    }

    // El ticket que se pide por los dos numeros que el cajero tiene a la vista. Se
    // busca por el movimiento —que es el que identifica— y la orden se coteja
    // despues: asi la pantalla puede decir cual de los dos esta mal en vez de un
    // "no existe" que no ayuda a corregir.
    //
    // No encontrarlo es un resultado normal de la pantalla —los dos numeros se
    // teclean—, por eso responde con el motivo redactado y no como un error. Y los
    // motivos son tres, no uno: el movimiento que no existe, el que existe pero
    // todavia no tiene ticket aprobado, y el que se pidio con otra orden.
    function getTicket() {
        $orden      = trim((string) $_POST['orden']);
        $movimiento = trim((string) $_POST['movimiento']);

        $ls = $this->filas($this->getTicketByFolio([$this->branchId(), $movimiento]));

        if (empty($ls)) {
            return [
                'status'  => 404,
                'message' => $this->motivoSinTicket($movimiento)
            ];
        }

        $item = $ls[0];

        if ((string) $item['note_number'] !== $orden) {
            return [
                'status'  => 404,
                'message' => "El movimiento {$movimiento} es la orden {$item['note_number']}, no la {$orden}"
            ];
        }

        return [
            'status' => 200,
            'ticket' => $this->papel($item)
        ];
    }

    // La terminal reimprime lo que el POS cobro: un movimiento que existe pero no
    // llego a pagarse —abierto, cancelado, eliminado— no entrego ningun papel, y
    // quien esta en la caja necesita distinguir eso de haber tecleado mal el numero.
    function motivoSinTicket($movimiento) {
        $venta = $this->filas($this->getSaleByFolio([$this->branchId(), $movimiento]));

        if (empty($venta)) return "No existe el movimiento {$movimiento}";

        return "El movimiento {$movimiento} no quedó cobrado: no tiene ticket que reimprimir";
    }

    // Los papeles que el usuario marco en la lista, armados de una pasada para
    // mandarlos juntos a la impresora (punto 25). Van en el orden de la lista —dia y
    // folio— porque es el orden en que se van a entregar.
    //
    // Uno solo tambien entra por aqui: imprimir uno e imprimir treinta es el mismo
    // trabajo con distinta cuenta, y tener dos caminos los deja divergir.
    function getTickets() {
        $folios = array_values(array_filter(array_map('trim', explode(',', (string) $_POST['folios'])), 'strlen'));

        if (empty($folios)) {
            return ['status' => 400, 'message' => 'No hay tickets seleccionados'];
        }

        $ls = $this->filas($this->listTicketsByFolios(array_merge([$this->branchId()], $folios)));

        if (empty($ls)) {
            return ['status' => 404, 'message' => 'No se encontraron los tickets seleccionados'];
        }

        $lineas   = $this->lineasDeVarios($ls);
        $__ticket = [];

        foreach ($ls as $item) {
            $__ticket[] = $this->papel($item, $lineas[$item['folio']] ?? []);
        }

        return [
            'status'  => 200,
            'tickets' => $__ticket,
            'emisor'  => $this->emisor()
        ];
    }

    // -- Papel --

    // Lo que se imprime, ya formateado: el papel imprime, no calcula.
    //
    // De donde salen los renglones y los montos depende de que papel sea, y son dos:
    //
    //   inventado  el documento aprobado manda entero —sus partidas, su ajuste de
    //              cuadre y su impuesto—, porque es ese el que se entrego.
    //   real       el consumo que el POS exporto, y el desglose deducido del total
    //              que el folio ampara. No hay documento que copiar: el papel ES la
    //              cuenta.
    //
    // Los renglones se pueden pasar ya resueltos: cuando se arman varios papeles a
    // la vez salen todos de una consulta, no de una por ticket (ver lineasDeVarios).
    function papel($item, $lineas = null) {
        $total = $this->totalDe($item);
        $nota  = (int) $item['note_number'];

        if ($lineas === null) $lineas = $this->lineasDe($item);

        // El papel real de una venta sin comanda cargada se quedaria en blanco: se
        // imprime el consumo como una sola partida, que es lo unico que la cuenta
        // sabe de si misma. El folio que no ampara ningun cargo con tarjeta la nombra
        // por lo que es, igual que el papel que arma el Facturador.
        if (empty($lineas)) $lineas = [$this->partidaUnica($item, $total)];

        list($base, $iva, $descuento) = $this->desglose($item, $lineas, $total);

        return [
            'id'        => esVirtual($item) ? (int) $item['virtual_id'] : null,
            'folio'     => $item['folio'],
            'nota'      => '#' . $nota,
            'orden'     => (string) $nota,
            'fecha'     => fechaCorta($item['issue_date']),
            'hora'      => $this->horaDe($item),
            'fechaHora' => $this->fechaHoraDe($item),
            'mesa'      => $this->mesaDe($item),
            'mesero'    => $this->meseroDe($item),
            'personas'  => personasFicticias(semillaFolio($item['folio'])),
            'cajero'    => CAJERO_TERMINAL,
            'lineas'    => $this->renglones($lineas),
            'subtotal'  => money($base),
            'iva'       => money($iva),
            // El ajuste de cuadre se imprime como descuento, y solo cuando lo hubo:
            // en cero seria un renglon que no dice nada.
            'descuento' => $descuento > 0 ? money($descuento) : '',
            // El POS no exporta propina y el ticket la imprime siempre, en cero
            // cuando no la hubo.
            'propina'   => money(0),
            'total'     => money($total),
            'letras'    => letras($total),
            // Los dos folios del punto 22.1: el papel dice de donde salio su cargo
            // cuando el cierre lo mudo.
            'folioOrigen' => $item['origin_folio'] ?: $item['folio'],
            'reasignado'  => $item['origin_folio'] && $item['origin_folio'] != $item['folio']
        ];
    }

    // El importe que imprime el papel es el suyo, que puede diferir del de la cuenta
    // cuando el cierre mudo cargos entre folios (punto 17). Sin papel aprobado es el
    // total de la CUENTA, no el monto facturable que calcula el Facturador: lo que
    // esta pantalla entrega es el ticket del cliente, y ese cobro lo que la cuenta
    // cobro, entrara por tarjeta o no.
    //
    // En el papel real los dos numeros coinciden de todos modos: el Facturador solo
    // deja sin documento propio a la venta cuya comanda cuadra con su cuenta entera
    // (ver comandaCuadra), que es justo cuando no hay diferencia que discutir.
    function totalDe($item) {
        if (esVirtual($item)) return (float) $item['virtual_total'];

        return (float) $item['total'];
    }

    // Como cierra el papel por abajo. El aprobado ya lo trae escrito; el real se
    // deduce del total y de la tasa que trajo la venta, y su descuento es lo que los
    // renglones suman de mas: la cortesia que el POS aplico, o la parte de la cuenta
    // que se cobro por otra via y no viaja en este papel.
    function desglose($item, $lineas, $total) {
        if (esVirtual($item)) {
            $descuento = (float) $item['virtual_discount'];

            return [
                round((float) $item['virtual_subtotal'] - $descuento, 2),
                (float) $item['virtual_tax'],
                $descuento
            ];
        }

        $suma = 0;
        foreach ($lineas as $linea) $suma += (float) $linea['amount'];

        $descuento = max(0, round($suma - $total, 2));
        $tasa      = tasaEfectiva($item);

        if ($tasa <= 0) return [round($total + $descuento, 2), 0, $descuento];

        list($base, $iva) = $this->desgloseFiscal($item, $total, $tasa);

        return [$base, $iva, $descuento];
    }

    // En Wansoft el total del papel es solo la parte cobrada con tarjeta, asi que el
    // desglose se saca de ese total: imprimir el subtotal de la venta entera dejaria
    // un papel donde la base mas el IVA no dan el total.
    function desgloseFiscal($item, $total, $tasa) {
        if (!$this->esWansoft()) return [(float) $item['subtotal'], (float) $item['tax']];

        $base = round($total / (1 + $tasa), 2);

        return [$base, round($total - $base, 2)];
    }

    function partidaUnica($item, $total) {
        return [
            'description' => esServicio($item) ? CONCEPTO_SERVICIO : CONCEPTO_CONSUMO,
            'quantity'    => 1,
            'amount'      => $total
        ];
    }

    function lineasDe($item) {
        if (esVirtual($item)) return $this->filas($this->listTicketLines([$item['virtual_id']]));

        return $this->filas($this->listSaleLines([$item['sale_id']]));
    }

    // Los renglones de una tanda de papeles en dos consultas —una por origen— y no
    // una por ticket: imprimir el dia entero son treinta y seis papeles, y treinta y
    // seis viajes a la base por su detalle. Se devuelven por folio impreso, que es
    // como los pide getTickets.
    function lineasDeVarios($ls) {
        $papeles = array_values(array_filter(array_column($ls, 'virtual_id')));
        $ventas  = array_values(array_filter(array_column($ls, 'sale_id')));

        // Un IN vacio no es SQL valido, y el dia sin cierre no tiene un solo papel
        // aprobado que pedir.
        $porPapel = $papeles ? $this->agruparPor('virtual_ticket_id', $this->filas($this->listTicketLinesByTickets($papeles))) : [];
        $porVenta = $ventas  ? $this->agruparPor('sale_id',           $this->filas($this->listSaleLinesBySales($ventas)))     : [];

        $__lineas = [];

        foreach ($ls as $item) {
            $__lineas[$item['folio']] = esVirtual($item)
                ? ($porPapel[$item['virtual_id']] ?? [])
                : ($porVenta[$item['sale_id']] ?? []);
        }

        return $__lineas;
    }

    function agruparPor($llave, $ls) {
        $__grupo = [];

        foreach ($ls as $renglon) {
            $__grupo[$renglon[$llave]][] = $renglon;
        }

        return $__grupo;
    }

    function renglones($ls) {
        $__row = [];

        foreach ($ls as $renglon) {
            $__row[] = [
                'cant'    => cantidad($renglon['quantity']),
                'nombre'  => $renglon['description'],
                'importe' => money($renglon['amount'])
            ];
        }

        return $__row;
    }

    // -- Datos que el POS no siempre trae --

    // Mesa y mesero salen de la comanda cuando esta cargada; poco mas de la mitad de
    // las ventas la tienen. El resto se arma con la semilla del folio, para que el
    // mismo ticket salga siempre igual por mas veces que se reimprima.
    function mesaDe($item) {
        return $item['table_number'] ?: mesaFicticia(semillaFolio($item['folio']));
    }

    function meseroDe($item) {
        return $item['waiter_name'] ?: meseroFicticio(semillaFolio($item['folio']));
    }

    // La hora es la de la venta que respalda el papel, y no siempre existe: Wansoft
    // exporta la fecha de operacion sin hora y la columna llega en medianoche exacta.
    // Un papel cuya venta ya no esta —la FK la deja en NULL— tampoco la tiene.
    //
    // En los dos casos se devuelve vacia en vez de imprimir "00:00", que se leeria
    // como una venta cobrada a las doce de la noche.
    function horaDe($item) {
        if (!$this->tieneHora($item)) return '';

        return date('H:i', strtotime($item['operation_date']));
    }

    // El renglon de fecha del papel: con hora cuando el POS la trajo, solo el dia
    // cuando no. El dia siempre existe —es el que el ticket lleva impreso— y sale de
    // la emision si la venta ya no esta.
    function fechaHoraDe($item) {
        if (!$this->tieneHora($item)) {
            return fechaCorta($item['operation_date'] ?: $item['issue_date']);
        }

        return date('d/m/Y h:i:s A', strtotime($item['operation_date']));
    }

    function tieneHora($item) {
        return $item['operation_date'] && date('H:i:s', strtotime($item['operation_date'])) !== '00:00:00';
    }

    // -- Emisor --

    // El membrete del papel. Sin sucursal dada de alta sale vacio: el papel imprime
    // lo que hay, no un emisor de relleno.
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
            'telefono'   => $ls[0]['phone'] ?: $ls[0]['company_phone'],
            'logo'       => $ls[0]['logo'] ?: '',
            'pos_code'   => $this->posCode
        ];
    }
}

// -- Complements --

// -- Los dos papeles del dia --
//
// Cual de los dos se esta reimprimiendo. Es la pregunta que reparte todo el armado:
// el aprobado copia su documento y el real se arma de la cuenta. Son las mismas
// reglas del Facturador (ctrl-facture-tickets.php) y tienen que serlo: un papel
// reimpreso aqui sale identico al que se emitio alla.
function esVirtual($item) {
    return !empty($item['virtual_id']);
}

// El movimiento que vino en $0.00: existe, se abrio y se cerro, pero no cobro nada.
// Su papel se imprime igual —el POS lo entrego— con la partida que lo nombra y sin
// impuesto que trasladar.
function esServicio($item) {
    return (float) $item['total'] <= 0;
}

// Ningun Excel trae la tasa: se deduce del par subtotal/impuesto de la venta.
function tasaDe($item) {
    $subtotal = (float) $item['subtotal'];

    return $subtotal > 0 ? round((float) $item['tax'] / $subtotal, 2) : 0;
}

// La tasa que vale es la del papel que se entrega, no la que trajo el POS: la venta
// que el reparto mando al 0% sigue diciendo 16% en `sale`.
function tasaEfectiva($item) {
    if (esVirtual($item)) return (float) $item['tax_rate'];

    if (esServicio($item)) return 0;

    return tasaDe($item);
}

function money($valor) {
    return '$' . number_format((float) $valor, 2);
}

// La cantidad se imprime entera cuando lo es: los productos puente se venden por
// pieza.
function cantidad($valor) {
    $valor = (float) $valor;

    if ($valor == floor($valor)) return number_format($valor, 0);

    return rtrim(rtrim(number_format($valor, 3), '0'), '.');
}

function fechaCorta($fecha) {
    return $fecha ? date('d/m/Y', strtotime($fecha)) : '';
}

// -- Casillas de la seleccion (punto 25) --
//
// La casilla lleva el movimiento y no el id de la venta: es el numero con el que
// despues se piden los papeles a imprimir, y el mismo que el usuario esta viendo en
// la fila. El estado —marcada o no— lo pone la pantalla; aqui salen todas vacias
// porque cada consulta nueva es otro periodo, y la seleccion no lo cruza.
//
// El importe viaja sin formato para que la barra de seleccion sume lo que hay
// marcado sin tener que deshacer el formato de moneda de la columna.
function checkCell($folio, $monto) {
    return '<span class="ws-chk" data-folio="' . $folio . '" data-monto="' . round((float) $monto, 2) . '"></span>';
}

function checkAllCell() {
    return '<span class="ws-chk ws-chk-all" title="Seleccionar todos"></span>';
}

function emisorVacio() {
    return [
        'razon' => '', 'lema' => '', 'rfc' => '', 'domicilio' => '',
        'expedicion' => '', 'telefono' => '', 'logo' => '', 'pos_code' => ''
    ];
}

// -- Renglones que el POS no exporta --
//
// Mesa, mesero y personas se imprimen en todos los tickets, pero el Excel solo trae
// los dos primeros y nada mas cuando la comanda del dia esta cargada. Los que faltan
// se arman a partir del folio: no es azar, es una funcion del folio, asi que el
// mismo ticket muestra hoy y en un ano las mismas personas. Un rand() daria un papel
// distinto en cada reimpresion, que es justo lo contrario de reimprimir.
//
// Son las mismas funciones del Facturador (ctrl-facture-tickets.php): un papel
// reimpreso aqui tiene que salir identico al que se emitio alla.
function semillaFolio($folio) {
    return crc32((string) $folio);
}

function mesaFicticia($semilla) {
    return (string) ($semilla % 20 + 1);
}

function meseroFicticio($semilla) {
    $nombres = ['MAFER', 'DIANA', 'KARLA', 'JOSUE', 'BRENDA', 'IVAN', 'PAOLA', 'LUIS', 'ANDREA',
                'HUGO', 'XIMENA', 'CESAR', 'ROSY', 'ABEL', 'YARELI', 'OMAR', 'NALLELY'];

    return $nombres[intdiv($semilla, 20) % count($nombres)];
}

function personasFicticias($semilla) {
    return (string) (intdiv($semilla, 400) % 6 + 1);
}

// -- Monto en letras --
//
// El renglon "SON:" del ticket. Se arma del lado del servidor por la misma razon que
// los importes: el papel imprime, no calcula.
function letras($monto) {
    $monto    = round((float) $monto, 2);
    $entero   = (int) floor($monto);
    $centavos = str_pad((string) round(($monto - $entero) * 100), 2, '0', STR_PAD_LEFT);
    $moneda   = $entero == 1 ? 'PESO' : 'PESOS';

    // Delante del sustantivo el uno se apocopa: TRESCIENTOS OCHENTA Y UN PESOS, no
    // "OCHENTA Y UNO PESOS".
    $texto = preg_replace('/UNO$/', 'UN', enLetras($entero));

    return $texto . ' ' . $moneda . ' ' . $centavos . '/100 M.N.';
}

// Numero a letras en la forma corta del espanol de Mexico: sin "y" entre grupos
// (DOSCIENTOS TREINTA) y con las contracciones que el idioma exige (VEINTIUNO, CIEN,
// UN MIL).
function enLetras($n) {
    $n = (int) $n;

    if ($n === 0) return 'CERO';
    if ($n < 0)   return 'MENOS ' . enLetras(-$n);

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

// La terminal apunta todas sus pantallas a este controlador y varias todavia no
// tienen su opcion escrita. Sin esta guarda, pedir una que no existe seria un fatal
// de PHP y la pantalla recibiria una respuesta que no es JSON.
$obj = new ctrl();

if (!method_exists($obj, $_POST['opc'])) {
    echo json_encode(['status' => 400, 'message' => "Opción no disponible: {$_POST['opc']}"]);
    exit(0);
}

echo json_encode($obj->{$_POST['opc']}());
