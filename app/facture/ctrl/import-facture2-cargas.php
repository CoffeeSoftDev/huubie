<?php

// Logica de importacion del export de Wansoft, hermana de import-facture-cargas.php
// (Soft Restaurant). Misma interfaz publica —contrato(), inspeccionarLibro(),
// procesarLibro()— para que el controlador pueda intercambiarlas sin saber cual
// tiene enfrente.
//
// Se escribio aparte y no como una rama dentro del otro por el mismo motivo que
// aquel se separo de contabilidad2: cada POS tiene su propio layout y mezclar los
// parsers termina leyendo una hoja con el mapeo de la otra. Los dos exports no se
// parecen en casi nada:
//
//   Soft Restaurant           Wansoft
//   ---------------           -------
//   3 hojas                   6 hojas (4 se cargan, 2 son resumen derivable)
//   encabezados en fila 7     fila 15 en el detalle, fila 6 en las bancarias
//   columnas desde la A       desde la B o la C segun la hoja
//   ventas y pagos separados  una sola hoja produce las dos tablas
//   folio fiscal              movimiento PDV
//   sin propina               propina por pago
//
// Layout verificado contra docs/ReporteVentasPorFormaDePago2026-08-23.xlsx.
//
// Los helpers de mecanica pura (normalizeHeader, numVal, cleanDate, columnLetter,
// step, hojasDelTab, tabDelLibro, resumenColumnas, mensajeCarga, ordenarPorHoja)
// NO se redeclaran: viven en import-facture-cargas.php, que el controlador carga
// siempre. Son de leer Excel, no de un POS en particular.

// Tasa a la que se cae cuando el bloque de resumen no permite deducirla. El
// archivo medido da 7312.42 / 45702.58 = 0.16 exacto, pero la tasa se lee del
// propio archivo y esto es solo la red.
define('WANSOFT_TASA_DEFAULT', 0.16);

class ImportFacture2Cargas {

    private $mdl;
    private $util;

    // Resultado de los cruces de la hoja en curso y filas que el motor rechazo.
    private $rechazadas = 0;
    private $ventas     = 0;
    private $pagos      = 0;
    private $meseros    = 0;
    private $cajeros    = 0;
    private $ligados    = 0;
    private $resumenes  = 0;
    private $productos  = 0;

    // Renglones de comanda que estaban esperando su venta y esta carga engancho.
    private $renglones  = 0;

    // Movimientos que ya estaban en base y no se volvieron a cargar, y cuantos de
    // ellos ademas traen un total distinto del que se guardo en su dia.
    private $omitidos   = 0;
    private $difieren   = 0;

    // Suma de control de lo que quedo en base, que en una carga incremental no es
    // la del archivo completo.
    private $controlInsertado = 0;

    // Cuales de los movimientos omitidos traen hoy un importe distinto del guardado.
    // Es una muestra, no la lista entera: cabe en el aviso y sirve para ir a
    // buscarlos, que es para lo que esta.
    const MUESTRA_DIFERENCIAS = 8;

    private $diferencias = [];

    // Filas que se fueron con la carga anterior del periodo que acaba de escribirse.
    // Vive en la instancia porque una hoja puede escribir varios periodos —uno por
    // mes del archivo— y el total de la hoja es la suma de todos.
    private $reemplazadas = 0;

    function __construct($mdl) {
        $this->mdl  = $mdl;
        $this->util = $mdl->util;
    }

    /*
        Cada hoja declara su layout. Sobre el contrato de Soft Restaurant hay dos
        campos mas, y son los que obligan a tener parser propio:

          startIndex   columna fisica donde empieza la tabla. Wansoft deja la A (y
                       a veces la B) vacias como margen del reporte, asi que el
                       indice 0 del contrato NO es la columna A.

          dateIndex    columna que debe traer una fecha valida para que la fila
                       cuente como dato. Wansoft cierra sus hojas con un PIE DE
                       TOTALES —«TOTAL COBRADO:», «PROPINAS:», «IVA:»— que escribe
                       la etiqueta y el importe en las MISMAS columnas de la
                       tabla. En el archivo medido son 6 filas debajo del ultimo
                       pago, con «$54,541.04» justo donde va el movimiento PDV: sin
                       este corte entran como seis pagos fantasma y cinco tickets
                       que no existieron.

                       El pie no lleva fecha y ningun pago real deja de llevarla,
                       asi que la fecha es lo que los separa. Es el equivalente al
                       corte que el importador de Soft hace con el relleno de su
                       tabla dinamica.

        Las otras dos hojas del libro —"Ventas por forma de pago" y "Propinas por
        mesero"— no estan aqui a proposito: las dos son sumas de la hoja de
        detalle y guardarlas seria guardar dos veces el mismo dato. El total por
        forma de pago sale de agrupar los pagos; las propinas por mesero, de
        sumarlas por su mesero.

        El orden del array es el orden de carga y NO es libre: el detalle va
        primero porque crea las ventas de las que cuelgan los movimientos
        bancarios y los pagos eliminados.
    */
    function contrato() {
        return [
            'Detalle por forma de pago' => [
                'tab'          => 'sales-report',
                'target'       => 'wansoft-detail',
                'orden'        => 1,
                'headerRow'    => 15,
                'startIndex'   => 0,
                'keyIndex'     => 5,   // Movimiento PDV: la llave estable del ticket
                'dateIndex'    => 3,   // Fecha: corta el pie de totales
                'controlIndex' => 15,  // Total del pago

                // Las columnas SIN las cuales la carga no puede seguir:
                //   3  Fecha           5  Movimiento PDV   9  Forma de pago
                //   4  Orden           6  Estatus         15  Total
                //
                // Sin ellas no hay ticket que armar: la fecha y el movimiento lo
                // identifican, el total es lo que se cobro y la forma de pago
                // decide si la venta entra siquiera al modulo de tickets.
                //
                // El resto son datos de acompanamiento —mesero, cajero, terminal,
                // referencias— y su ausencia se avisa sin detener nada: entran en
                // nulo, que es lo mismo que pasa cuando el POS los exporta vacios.
                //
                // Una hoja SIN esta lista exige todas sus columnas, que es como se
                // comportaba el importador antes de que existiera la distincion.
                'required'     => [3, 4, 5, 6, 9, 15],

                // Carga INCREMENTAL: los movimientos que ya estan en base se
                // omiten uno a uno en vez de borrar el periodo y reescribirlo.
                // Volver a subir el mismo archivo no duplica nada, y subir uno mas
                // completo del mismo dia solo agrega lo que falta.
                'modo'         => 'incremental',
                'columns' => [
                    'Total', 'Propina', 'Participacion del dia', 'Fecha', 'Orden',
                    'Movimiento PDV', 'Estatus', 'Mesero', 'Cajero', 'Forma de pago',
                    'Fecha de pago', 'Referencia', 'Transaccion', 'Terminal',
                    'Codigo de validacion', 'Total', 'Propina', 'Total Cobrado'
                ]
            ],
            'Pagos por terminal bancaria' => [
                'tab'          => 'sales-report',
                'target'       => 'card',
                'orden'        => 2,
                'headerRow'    => 6,
                'startIndex'   => 1,
                'keyIndex'     => 0,
                'dateIndex'    => 1,
                'controlIndex' => 15,
                'columns' => [
                    'Orden', 'Fecha operacion', 'OrdenId', 'Transaccion', 'ARQC',
                    'Fecha de autorizacion', 'Terminal', 'APN', 'Tipo pinPad',
                    'Tipo operacion', 'Banco', 'Tipo tarjeta', 'Numero de tarjeta',
                    'Mensaje de respuesta', 'Numero de autorizacion', 'Monto',
                    'Pago Anticipado'
                ]
            ],
            'Can y Dev por terminal bancaria' => [
                'tab'          => 'sales-report',
                'target'       => 'card-refund',
                'orden'        => 3,
                'headerRow'    => 6,
                'startIndex'   => 1,
                'keyIndex'     => 0,
                'dateIndex'    => 1,
                'controlIndex' => 15,
                'columns' => [
                    'Orden', 'Fecha operacion', 'OrdenId', 'Transaccion', 'ARQC',
                    'Fecha de autorizacion', 'Terminal', 'APN', 'Tipo pinPad',
                    'Tipo operacion', 'Banco', 'Tipo tarjeta', 'Numero de tarjeta',
                    'Mensaje de respuesta', 'Numero de autorizacion', 'Monto'
                ]
            ],
            'Pagos Eliminados' => [
                'tab'          => 'sales-report',
                'target'       => 'deleted',
                'orden'        => 4,
                'headerRow'    => 6,
                'startIndex'   => 1,
                'keyIndex'     => 2,
                'dateIndex'    => 0,
                'controlIndex' => 8,
                'columns' => [
                    'Fecha registro', 'Fecha de operacion', 'Orden', 'Mesero',
                    'Cajero', 'Usuario Modifica', 'Forma de pago', 'Terminal',
                    'Total', 'Propina', 'Total cobrado'
                ]
            ],

            /*
                El renglon de la comanda: que se consumio, en que mesa y a que hora.
                Medido sobre el export de RYORI RYOKAN de agosto 2026 —8 719 filas,
                759 comandas— y no supuesto.

                Es la hoja MAS PESADA que recibe el modulo: 46 columnas por casi
                nueve mil filas, unas 420 000 celdas. Cargada de golpe pide 160 MB y
                revienta un PHP de 128; por eso esta hoja se lee por bloques y no
                como las demas (ver `leePorBloques`).

                El libro trae una segunda hoja —"Tiempo de orden", la cabecera de
                cada comanda— que NO esta aqui a proposito: sus 13 columnas son
                atributos del ticket y de ellas solo el tiempo de servicio no llega
                ya por otro lado. Se deja fuera hasta que alguien la necesite.

                CUATRO bloques de montos y solo uno viene lleno por fila. Cual, lo
                decide la columna «Accion»:

                    Venta                    8672 filas  ->  37..40  (Detalles de venta)
                    Anulacion de platillo      34        ->  45..48  (Anulaciones)
                    Cancelacion de platillo     9        ->  41..44  (Cortesias y canc.)
                    Cortesia de platillo        3        ->  ambos
                    Cortesia de orden           1        ->  ambos

                Las 43 filas de anulacion y cancelacion vienen SIN el total del
                ticket (columnas 13..16 vacias): el POS no se lo asigna a lo que
                nunca se cobro. No son filas corruptas y no se descartan —son la
                bitacora de lo que se tiro— pero tampoco pueden sumarse como venta.
            */
            'Detalle de ventas' => [
                'tab'          => 'commands',
                'target'       => 'wansoft-command',
                'orden'        => 1,
                'headerRow'    => 9,
                'startIndex'   => 2,   // la tabla arranca en la columna C
                'keyIndex'     => 4,   // Movimiento PDV: cruza con sale.pdv_movement
                'dateIndex'    => 1,   // Fecha de operacion
                'controlIndex' => 37,  // Total del renglon, el unico monto sumable

                // Sin estas no hay renglon que armar: el movimiento lo ancla a su
                // ticket, la clave y la cantidad dicen que se consumio, y la accion
                // decide de que bloque de montos se lee el importe.
                //
                // El resto entra en nulo si falta, que es lo mismo que pasa cuando
                // el POS lo exporta vacio.
                'required'     => [1, 4, 12, 18, 29],

                // Incremental como el resto de Wansoft: los movimientos que ya
                // tienen renglones se omiten enteros en vez de borrar el periodo.
                'modo'         => 'incremental',
                'columns' => [
                    'Dia', 'Fecha de operacion', 'Hora de cierre', 'Semana',
                    'Movimiento PDV', 'Orden', 'Tipo de orden', 'Subtipo de orden',
                    'No. Mesa', 'No. Personas', 'Mesero', 'Terminal', 'Accion',
                    'Subtotal', 'IVA', 'IEPS', 'Total', 'Descuento',
                    'Cantidad', 'Precio unitario', 'Precio unitario con modificador',
                    'Costo real', 'Costo con modificadores', 'Costo ideal',
                    'Tipo de grupo', 'Grupo', 'Descripcion', 'Platillo / Articulo',
                    'Modificador', 'Clave platillo', 'Codigo de barras',
                    'Es modificador', 'Hora de captura', 'Terminal de captura',
                    'Subtotal', 'IVA', 'IEPS', 'Total',   // Detalles de venta
                    'Subtotal', 'IVA', 'IEPS', 'Total',   // Cortesias y cancelaciones
                    'Subtotal', 'IVA', 'IEPS', 'Total'    // Anulaciones
                ]
            ]
        ];
    }

    // Hojas que NO caben en memoria de una sola pieza y se leen por bloques.
    //
    // El resto del modulo carga el libro entero antes de mirarlo, que es lo
    // razonable para un reporte de pagos de 112 KB. La hoja de comandas pesa 15
    // veces mas y ese camino la mata, asi que el controlador pregunta aqui antes
    // de abrir el archivo: si la pestana esta en esta lista, no lo carga y le pasa
    // la RUTA al importador para que la lea de a poco.
    //
    // Medido sobre el archivo real, con el limite de 128 MB del servidor:
    //
    //     todo de golpe   15 s   160 MB   <- truena
    //     bloques 4000    20 s    86 MB
    //     bloques 2000    25 s    54 MB   <- el elegido
    //     bloques 1000    36 s    42 MB
    //     bloques  500    61 s    34 MB
    //
    // 2 000 deja holgura de sobra sobre los 128 MB. Bajar mas solo compra memoria
    // que no hace falta a cambio de duplicar el tiempo.
    //
    // Lo que aquella medicion no vio es que el TIEMPO no escala con el tamano del
    // bloque sino con cuantas veces hay que abrir el archivo, y eso crece con las
    // filas: el export de septiembre trae 23 963 —doce bloques— y se comio los 120
    // segundos del php.ini en la novena apertura, a la altura de la fila 16 010. La
    // peticion moria a media carga y la pantalla se quedaba sin motivo que dar.
    //
    // Por eso el limite se renueva bloque a bloque (ver `cargarPorBloques`): con
    // este presupuesto cada apertura tiene tiempo de sobra —tarda entre diez y
    // quince segundos— y un bloque que de verdad se cuelgue sigue muriendo.
    function leePorBloques($tipo) {
        return $tipo === 'commands';
    }

    const FILAS_POR_BLOQUE    = 2000;
    const SEGUNDOS_POR_BLOQUE = 120;

    // -- El parte de la carga --

    /*
        Donde el importador va apuntando por que paso va, para que la consulta de
        avance pueda contarlo desde OTRA peticion.

        Hasta que no se escribe la primera fila no hay nada que contar en base, y
        con un archivo de 24 000 renglones eso es medio minuto largo: dos aperturas
        completas del Excel —una para los encabezados y otra para el primer bloque—
        durante las cuales la pantalla solo podia decir "leyendo" y el usuario, con
        razon, pensaba que no estaba pasando nada.

        Va en un fichero y no en la sesion porque la sesion esta cerrada a
        proposito: es justo lo que impedia que las dos peticiones —la que carga y la
        que pregunta— corrieran a la vez.
    */
    static function rutaEstado($fileName) {
        return sys_get_temp_dir() . '/facture-carga-' . md5((string) $fileName) . '.json';
    }

    private function apuntarPaso($ctx, $fase, $extra = []) {
        @file_put_contents(
            self::rutaEstado($ctx['fileName']),
            json_encode(array_merge(['fase' => $fase], $extra))
        );
    }

    // El parte se borra al terminar: un fichero viejo haria que la siguiente carga
    // del mismo archivo naciera anunciando el bloque en que murio la anterior.
    private function borrarPaso($ctx) {
        @unlink(self::rutaEstado($ctx['fileName']));
    }

    /*
        Pestanas que el modulo muestra sin tener todavia contrato de hojas.

        No estan muertas: aceptan el archivo y lo RADIOGRAFIAN —dicen que hojas
        trae, en que fila estan sus encabezados y cuales son— sin guardar una sola
        fila. Con esa lectura se escribe el contrato de verdad, medido y no
        supuesto, que es como se escribio todo este archivo.

        Hoy esta vacia. 'commands' vivio aqui hasta que se midio el export real de
        comandas: su contrato esta arriba y la pestana ya guarda.
    */
    function tabsReservados() {
        return [];
    }

    function esReservado($tipo) {
        return isset($this->tabsReservados()[$tipo]);
    }

    // Revision sin escribir nada: a que pestana pertenece el libro y si sus
    // columnas cuadran. Mismo contrato de salida que el importador de Soft, porque
    // el modulo pinta el aviso igual venga de donde venga.
    function inspeccionarLibro($documento, $ctx) {
        // En una pestana reservada no hay columnas contra que comparar: la revision
        // previa no tiene nada que objetar y el archivo pasa directo a la
        // radiografia.
        if ($this->esReservado($ctx['tipo'] ?? '')) {
            return [
                'status'  => 200,
                'destino' => $ctx['tipo'],
                'movido'  => false,
                'hojas'   => $documento->getSheetNames(),
                'suyas'   => [],
                'libro'   => $documento->getSheetNames()
            ];
        }

        $tipo       = isset($ctx['tipo']) ? $ctx['tipo'] : '';
        $contrato   = $this->contrato();
        $hojasLibro = $documento->getSheetNames();
        $destino    = $tipo;

        $notas = $this->notasDelPeriodo($ctx);

        if ($notas) {
            return [
                'status'     => 200,
                'destino'    => $tipo,
                'movido'     => false,
                'hojas'      => [],
                'validacion' => $notas
            ];
        }

        $presentes = $this->hojasPresentes($contrato, $hojasLibro, $destino);

        if (empty($presentes)) {
            return [
                'status'  => 200,
                'destino' => $tipo,
                'movido'  => false,
                'hojas'   => [],
                'validacion' => [
                    'motivo'    => 'hojas',
                    'esperadas' => hojasDelTab($contrato, $tipo),
                    'libro'     => $hojasLibro,
                    'columnas'  => [],
                    'cargadas'  => []
                ]
            ];
        }

        // La revision previa solo objeta lo que DETIENE la carga. Lo que se puede
        // leer igual —una columna corrida, una accesoria que no vino— se avisa
        // cuando el archivo entra, no antes: aqui solo estorbaria.
        $malas = [];
        foreach ($presentes as $nombre) {
            $config   = $contrato[$nombre];
            $columnas = $this->validarEncabezados($documento->getSheetByName($nombre), $config);
            $faltan   = $this->columnasMalas($columnas, $config);

            if (empty($faltan['criticas'])) continue;

            $malas[] = [
                'hoja'      => $nombre,
                'headerRow' => $config['headerRow'],
                'columnas'  => $columnas,
                'faltan'    => $faltan['criticas']
            ];
        }

        $revision = [
            'status'  => 200,
            'destino' => $destino,
            'movido'  => false,
            'hojas'   => $presentes,
            'suyas'   => hojasDelTab($contrato, $destino),
            'libro'   => $hojasLibro
        ];

        if (!empty($malas)) {
            $revision['validacion'] = [
                'motivo'    => 'columnas',
                'esperadas' => [],
                'libro'     => $hojasLibro,
                'columnas'  => $malas,
                'cargadas'  => []
            ];

            return $revision;
        }

        // El periodo se comprueba con las columnas ya validadas: la fecha se
        // localiza por el mapa de encabezados, y con una columna critica rota ese
        // mapa todavia no es de fiar.
        $ajeno = $this->fechasAjenas($documento, $presentes, $contrato, $ctx);

        if ($ajeno) $revision['validacion'] = $ajeno;

        return $revision;
    }

    // Notas ya emitidas sobre el periodo al que va la carga. El corte es el mismo
    // que el de Soft y por la misma razon: un ticket virtual es un documento
    // entregado y su respaldo son las ventas del periodo. Recargar las reemplaza y
    // las notas se irian con ellas por el CASCADE de virtual_ticket.sale_id.
    private function notasDelPeriodo($ctx) {
        $mes  = isset($ctx['mes'])  ? (int) $ctx['mes']  : 0;
        $anio = isset($ctx['anio']) ? (int) $ctx['anio'] : 0;

        if ($mes < 1 || $anio < 2000) return null;

        $branchId = isset($ctx['branchId']) ? $ctx['branchId'] : null;
        $conteo   = $this->mdl->countVirtualTicketByPeriod([$branchId, $anio, $mes]);
        $total    = (int) ($conteo[0]['total'] ?? 0);

        if ($total === 0) return null;

        return [
            'motivo'    => 'tickets',
            'total'     => $total,
            'notaMin'   => (int) ($conteo[0]['nota_min'] ?? 0),
            'notaMax'   => (int) ($conteo[0]['nota_max'] ?? 0),
            'notas'     => $this->mdl->listVirtualTicketByPeriod([$branchId, $anio, $mes]),
            'esperadas' => [],
            'libro'     => [],
            'columnas'  => [],
            'cargadas'  => []
        ];
    }

    // Si el archivo pertenece al periodo al que se esta subiendo.
    //
    // El periodo del lote lo escriben dos selectores de la pantalla, y hasta aqui
    // nadie lo comparaba contra el contenido del Excel. Cada venta guardaba su
    // fecha correcta —eso nunca fallo—, pero el LOTE quedaba sellado con un mes
    // que no contiene, y de ese sello cuelgan las dos operaciones que borran: la
    // sobreescritura del periodo de las hojas bancarias y el candado de notas
    // emitidas.
    //
    // La fecha se lee por el MAPA de columnas y no por posicion: en este export
    // las columnas se corren de sitio, y mirar la celda equivocada haria rechazar
    // archivos buenos por un dato que ni siquiera es una fecha.
    private function fechasAjenas($documento, $presentes, $contrato, $ctx) {
        $mes  = isset($ctx['mes'])  ? (int) $ctx['mes']  : 0;
        $anio = isset($ctx['anio']) ? (int) $ctx['anio'] : 0;

        if ($mes < 1 || $anio < 2000) return null;

        foreach ($presentes as $nombre) {
            $config = $contrato[$nombre];

            // La hoja sin fecha propia no dice nada del periodo: no se pregunta.
            if (!isset($config['dateIndex'])) continue;

            $hoja     = $documento->getSheetByName($nombre);
            $columnas = $this->validarEncabezados($hoja, $config);
            $faltan   = $this->columnasMalas($columnas, $config);

            // La hoja con columnas criticas rotas no se juzga aqui: el bucle de
            // carga la rechaza con su propio detalle, que dice cual falta.
            if (!empty($faltan['criticas'])) continue;

            $ajeno = periodoAjeno(
                conteoDeFechas(
                    $this->columnaDeFechas($hoja, $config, $this->mapaIndices($columnas, $config)),
                    $mes,
                    $anio
                ),
                $mes,
                $anio
            );

            if ($ajeno) {
                $ajeno['hoja'] = $nombre;

                return $ajeno;
            }
        }

        return null;
    }

    // Los valores crudos de la columna de fecha de una hoja. Se lee solo esa
    // columna y la clave: la comprobacion corre antes de la carga, y recorrer el
    // ancho entero de la tabla para preguntar por un dato la haria costar lo mismo
    // que guardarla.
    private function columnaDeFechas($hoja, $config, $mapa) {
        $claveIdx = array_key_exists($config['keyIndex'],  $mapa) ? $mapa[$config['keyIndex']]  : null;
        $fechaIdx = array_key_exists($config['dateIndex'], $mapa) ? $mapa[$config['dateIndex']] : null;

        if ($claveIdx === null || $fechaIdx === null) return [];

        $claveCol = columnLetter($claveIdx);
        $fechaCol = columnLetter($fechaIdx);
        $__row    = [];

        for ($fila = $config['headerRow'] + 1; $fila <= $hoja->getHighestRow(); $fila++) {
            if (trim((string) $hoja->getCell($claveCol . $fila)->getValue()) === '') continue;

            $__row[] = trim((string) $hoja->getCell($fechaCol . $fila)->getValue());
        }

        return $__row;
    }

    private function hojasPresentes($contrato, $hojasLibro, $tab) {
        $__row = [];

        foreach (hojasDelTab($contrato, $tab) as $nombre) {
            if (in_array($nombre, $hojasLibro)) $__row[] = $nombre;
        }

        return $__row;
    }

    // Router: recorre las hojas del contrato que trae el libro, valida su
    // estructura y guarda las que pasan.
    //
    // Las tres hojas bancarias del export medido vinieron VACIAS (solo
    // encabezados). Eso no es un error: una hoja con encabezados correctos y cero
    // filas se reporta como cargada con 0 registros y no arrastra a las demas.
    function procesarLibro($documento, $ctx) {
        $contrato   = $this->contrato();
        $tipo       = isset($ctx['tipo']) ? $ctx['tipo'] : '';
        $esperadas  = hojasDelTab($contrato, $tipo);
        $hojasLibro = $documento->getSheetNames();

        // Pestana reservada: se lee el archivo para describirlo y no se escribe
        // nada. Sin este corte, hojasDelTab caeria en su fallback —el contrato
        // completo— y el modulo buscaria las hojas del reporte de ventas dentro
        // del archivo de comandas.
        if ($this->esReservado($tipo)) return $this->radiografia($documento, $ctx);

        $presentes = $this->hojasPresentes($contrato, $hojasLibro, $tipo);
        $steps     = $ctx['steps'];

        $notas = $this->notasDelPeriodo($ctx);

        if ($notas) {
            $steps[] = step('Revisar periodo', 'error', $notas['total'] . ' nota(s) ya emitidas');

            return [
                'status'     => 409,
                'message'    => 'El periodo ya tiene tickets virtuales emitidos',
                'steps'      => $steps,
                'hojas'      => [],
                'validacion' => $notas
            ];
        }

        $steps[] = step(
            'Detectar hojas',
            count($presentes) ? 'ok' : 'error',
            count($presentes) ? implode(' · ', $presentes) : 'El libro trae: ' . implode(' · ', $hojasLibro)
        );

        if (empty($presentes)) {
            return [
                'status'  => 400,
                'message' => 'Este no es el reporte que espera Wansoft',
                'steps'   => $steps,
                'hojas'   => [],
                'validacion' => [
                    'motivo'    => 'hojas',
                    'esperadas' => $esperadas,
                    'libro'     => $hojasLibro,
                    'columnas'  => [],
                    'cargadas'  => []
                ]
            ];
        }

        // El mismo corte que hace la revision previa, repetido aqui por lo mismo
        // que el de las notas: uploadFile se puede llamar sin haber pasado por
        // ella, y este es el punto donde se empieza a escribir el periodo.
        $ajeno = $this->fechasAjenas($documento, $presentes, $contrato, $ctx);

        if ($ajeno) {
            $steps[] = step('Revisar periodo', 'error', resumenPeriodoAjeno($ajeno));

            return [
                'status'     => 409,
                'message'    => 'El archivo no es del periodo seleccionado',
                'steps'      => $steps,
                'hojas'      => [],
                'validacion' => $ajeno
            ];
        }

        $hojas    = [];
        $cargadas = 0;
        $malas    = [];
        $entraron = [];

        foreach ($presentes as $nombre) {
            $config   = $contrato[$nombre];
            $hoja     = $documento->getSheetByName($nombre);
            $columnas = $this->validarEncabezados($hoja, $config);
            $faltan   = $this->columnasMalas($columnas, $config);

            // Solo las criticas rechazan la hoja: son las columnas obligatorias que
            // no aparecen en ninguna parte de la fila.
            if (!empty($faltan['criticas'])) {
                $nombres = [];
                foreach ($faltan['criticas'] as $c) $nombres[] = $c['esperada'];

                $detalle = 'No se encontro la columna "' . implode('", "', $nombres) . '"';

                $steps[] = step('Validar columnas de "' . $nombre . '"', 'error', $detalle);

                $malas[] = [
                    'hoja'      => $nombre,
                    'headerRow' => $config['headerRow'],
                    'columnas'  => $columnas,
                    'faltan'    => $faltan['criticas']
                ];

                $hojas[] = [
                    'nombre'  => $nombre,
                    'estado'  => 'error',
                    'detalle' => $detalle,
                    'filas'   => 0
                ];
                continue;
            }

            $primera = columnLetter($config['startIndex']);
            $ultima  = columnLetter($config['startIndex'] + count($config['columns']) - 1);

            // Las columnas menores no detienen nada, pero se dicen: un export que
            // empieza a venir incompleto tiene que notarse el primer dia, no cuando
            // alguien eche de menos el dato tres meses despues.
            $steps[] = step(
                'Validar columnas de "' . $nombre . '"',
                empty($faltan['menores']) ? 'ok' : 'warn',
                empty($faltan['menores'])
                    ? count($config['columns']) . ' columnas ' . $primera . ':' . $ultima
                    : count($config['columns']) . ' columnas ' . $primera . ':' . $ultima . ' · ' . $this->resumenMenores($faltan['menores'])
            );

            $carga     = $this->guardarHoja($nombre, $config, $hoja, $ctx, $this->mapaIndices($columnas, $config));
            $cargadas += ($carga['insertadas'] > 0 || $carga['omitidos'] > 0 || $carga['leidas'] === 0) ? 1 : 0;

            if ($carga['insertadas'] > 0) $entraron[] = $nombre;

            if ($carga['reemplazadas'] > 0) {
                $steps[] = step(
                    'Sobreescribir "' . $nombre . '"',
                    'ok',
                    number_format($carga['reemplazadas']) . ' filas de la carga anterior del periodo'
                );
            }

            // Una hoja vacia con encabezados buenos no es un fallo: el POS no
            // registro movimientos de ese tipo en el periodo y hay que decirlo asi.
            //
            // Y una hoja entera repetida tampoco lo es: significa que el archivo ya
            // se habia procesado. Es el caso de quien vuelve a subir el mismo Excel,
            // y merece una respuesta que lo diga en esos terminos y no un error.
            $vacia   = $carga['leidas'] === 0;
            $repetida = $carga['insertadas'] === 0 && $carga['omitidos'] > 0;
            $estado  = ($vacia || $repetida || $carga['insertadas'] > 0) ? 'ok' : 'error';

            if     ($vacia)    $detalle = 'La hoja no trae movimientos en el periodo';
            elseif ($repetida) $detalle = 'Sin registros nuevos: los ' . number_format($carga['omitidos'])
                                        . ' movimientos del archivo ya estaban procesados';
            else               $detalle = number_format($carga['insertadas']) . ' registros en base de datos' . $this->detalleCruce($carga);

            $steps[] = step('Guardar "' . $nombre . '"', $estado, $detalle);

            $hojas[] = [
                'nombre'  => $nombre,
                'estado'  => $estado,
                'detalle' => 'columnas ' . $primera . ':' . $ultima
                           . ($vacia || $repetida ? '' : ' · fila ' . ($config['headerRow'] + 1))
                           . ' · ' . $this->queHizoLaHoja($carga, $vacia, $repetida),
                'filas'   => $carga['insertadas'],
                'leidas'  => $carga['leidas'],
                // Los numeros con los que se responde "y que paso con mi archivo":
                // lo que entro, lo que ya estaba y lo que se fue con la carga
                // anterior. Viajan sueltos —y no solo dentro del texto— porque la
                // pantalla los agrupa por lo que le paso a cada movimiento, y ahi
                // una insercion que sustituye a una fila borrada no cuenta como
                // movimiento nuevo.
                'insertadas'   => $carga['insertadas'],
                'omitidos'     => $carga['omitidos'],
                'reemplazadas' => $carga['reemplazadas'],
                'rechazadas'   => $carga['rechazadas'],
                // Un archivo ya procesado esta al 100 %: se leyo entero, no quedo a
                // medias. La barra al 0 se leeria como que algo fallo.
                'avance'  => ($repetida || $carga['leidas'] === 0)
                    ? 100
                    : round($carga['insertadas'] * 100 / $carga['leidas']),
                // Los movimientos que ya estaban pero traen otro importe. No se
                // tocan: viajan para que la pantalla pueda nombrarlos y el usuario
                // decida que hacer con ellos en el POS.
                'difieren'    => $carga['difieren'],
                'diferencias' => $carga['diferencias']
            ];
        }

        $resultado = [
            'status'  => $cargadas > 0 ? 200 : ($malas ? 422 : 500),
            'message' => mensajeCarga($cargadas, $malas),
            'steps'   => $steps,
            'hojas'   => ordenarPorHoja($hojas, $contrato, 'nombre')
        ];

        if (!empty($malas)) {
            $resultado['validacion'] = [
                'motivo'    => 'columnas',
                'esperadas' => [],
                'libro'     => $hojasLibro,
                'columnas'  => $malas,
                'cargadas'  => $entraron
            ];
        }

        return $resultado;
    }

    // ---------------------------------------------------------------------
    //  Radiografia: leer un archivo cuyo contrato todavia no existe
    // ---------------------------------------------------------------------

    // Describe el libro sin guardar nada. Es lo que convierte una pestana
    // reservada en algo util: en vez de "todavia no se puede", el usuario sube su
    // archivo y obtiene la medicion con la que se escribe el contrato.
    //
    // De cada hoja se busca la fila de encabezados y se leen sus columnas, que es
    // justo lo que un contrato necesita: headerRow, startIndex y columns.
    function radiografia($documento, $ctx) {
        $steps = isset($ctx['steps']) ? $ctx['steps'] : [];
        $hojas = [];

        $steps[] = step('Detectar hojas', 'ok', implode(' · ', $documento->getSheetNames()));

        foreach ($documento->getSheetNames() as $nombre) {
            $ficha = $this->radiografiarHoja($documento->getSheetByName($nombre));

            $steps[] = step(
                'Leer "' . $nombre . '"',
                $ficha['columnas'] ? 'ok' : 'error',
                $ficha['resumen']
            );

            $hojas[] = [
                'nombre'  => $nombre,
                'estado'  => $ficha['columnas'] ? 'ok' : 'error',
                'detalle' => $ficha['resumen'],
                'filas'   => 0,
                'leidas'  => $ficha['filas'],
                'avance'  => 100
            ];
        }

        $steps[] = step(
            'Guardar en base',
            'error',
            'No se guardo nada: esta pestana todavia no tiene contrato'
        );

        return [
            'status'  => 200,
            'message' => 'Radiografia del archivo: ' . count($hojas) . ' hoja(s) leidas. No se guardo ningun registro.',
            'steps'   => $steps,
            'hojas'   => $hojas
        ];
    }

    // La fila de encabezados de una hoja desconocida: la primera con al menos tres
    // celdas de texto seguidas. Es el patron que cumplen las cuatro hojas ya
    // medidas de Wansoft, cuyos encabezados caen en la fila 6 o en la 15 segun la
    // hoja, siempre despues de un membrete de texto suelto.
    private function radiografiarHoja($hoja) {
        $ultima = min($hoja->getHighestRow(), 40);
        $ancho  = min(columnIndex($hoja->getHighestColumn()), 40);

        for ($fila = 1; $fila <= $ultima; $fila++) {
            $celdas = [];

            for ($i = 0; $i < $ancho; $i++) {
                $valor = trim((string) $hoja->getCell(columnLetter($i) . $fila)->getValue());
                if ($valor !== '') $celdas[$i] = $valor;
            }

            if (count($celdas) < 3) continue;

            $indices = array_keys($celdas);
            $inicio  = $indices[0];
            $fin     = $indices[count($indices) - 1];

            return [
                'filas'    => $hoja->getHighestRow(),
                'columnas' => $celdas,
                'resumen'  => 'encabezados en la fila ' . $fila
                            . ' · columnas ' . columnLetter($inicio) . ':' . columnLetter($fin)
                            . ' · ' . count($celdas) . ' campos · ' . implode(' | ', array_slice($celdas, 0, 8))
                            . (count($celdas) > 8 ? ' | …' : '')
            ];
        }

        return [
            'filas'    => $hoja->getHighestRow(),
            'columnas' => [],
            'resumen'  => 'no se encontro una fila de encabezados en las primeras ' . $ultima . ' filas'
        ];
    }

    // Lo que la hoja hizo, en una linea y con verbos.
    //
    // "24 de 24 filas" no dice si esas 24 se guardaron, si ya estaban o si
    // sustituyeron a las de una carga anterior, que es justo lo que se pregunta
    // quien acaba de subir el archivo. Los tres casos se nombran por separado:
    //
    //   nuevos        entraron a la base en esta carga
    //   ya estaban    el movimiento ya se habia procesado y se omitio
    //   reemplazadas  filas de la carga anterior del periodo que se borraron para
    //                 dejar sitio a estas (solo las hojas que se sobreescriben)
    private function queHizoLaHoja($carga, $vacia, $repetida) {
        if ($vacia) return 'la hoja no trae movimientos en el periodo';

        if ($repetida) {
            $texto = 'nada nuevo: los ' . number_format($carga['omitidos']) . ' movimientos ya estaban cargados';

            return $carga['difieren'] > 0
                ? $texto . ', ' . number_format($carga['difieren']) . ' con otro importe'
                : $texto;
        }

        // Lo que entro a ocupar el sitio de una fila borrada no es un movimiento
        // ganado: es el mismo, reescrito. Y si la carga anterior tenia mas de las
        // que trae este archivo, la diferencia se perdio y hay que decirlo.
        $refrescados = min($carga['insertadas'], $carga['reemplazadas']);
        $nuevos      = $carga['insertadas'] - $refrescados;
        $perdidos    = max(0, $carga['reemplazadas'] - $carga['insertadas']);

        $partes = [];

        if ($nuevos      > 0) $partes[] = number_format($nuevos) . ' nuevos';
        if ($refrescados > 0) $partes[] = number_format($refrescados) . ' refrescados (la hoja se reescribe entera)';
        if ($perdidos    > 0) $partes[] = number_format($perdidos) . ' de la carga anterior ya no vienen en el archivo';

        if ($carga['omitidos']   > 0) $partes[] = number_format($carga['omitidos']) . ' ya estaban';
        if ($carga['rechazadas'] > 0) $partes[] = number_format($carga['rechazadas']) . ' rechazados';

        if (empty($partes)) $partes[] = 'sin cambios';

        return implode(' · ', $partes) . ' · ' . number_format($carga['leidas']) . ' filas leidas';
    }

    // Cola del paso "Guardar": lo que la hoja hizo mas alla de insertar.
    private function detalleCruce($carga) {
        $cola = '';

        if ($carga['rechazadas'] > 0) $cola .= ' · ' . number_format($carga['rechazadas']) . ' filas rechazadas';
        if ($carga['ventas']     > 0) $cola .= ' · ' . number_format($carga['ventas']) . ' tickets';
        if ($carga['pagos']      > 0) $cola .= ' · ' . number_format($carga['pagos']) . ' pagos';
        if ($carga['meseros']    > 0) $cola .= ' · ' . number_format($carga['meseros']) . ' meseros nuevos al catalogo';
        if ($carga['cajeros']    > 0) $cola .= ' · ' . number_format($carga['cajeros']) . ' cajeros nuevos al catalogo';
        if ($carga['ligados']    > 0) $cola .= ' · ' . number_format($carga['ligados']) . ' movimientos ligados a su pago';
        if ($carga['renglones']  > 0) $cola .= ' · ' . number_format($carga['renglones']) . ' renglones que esperaban su venta';
        if ($carga['resumenes']  > 0) $cola .= ' · resumen del dia guardado';

        // Los omitidos van al final y siempre que existan: son la respuesta a "por
        // que subi 100 y solo entraron 20".
        if ($carga['omitidos'] > 0) {
            $cola .= ' · ' . number_format($carga['omitidos']) . ' ya estaban y se omitieron';

            if ($carga['difieren'] > 0) {
                $cola .= ' (' . number_format($carga['difieren']) . ' con un total distinto al guardado)';
            }
        }

        return $cola;
    }

    // Devuelve la fila de encabezados COMPLETA con el estado de cada celda, igual
    // que la del importador de Soft. La diferencia es `startIndex`: la lectura
    // arranca donde la hoja pone su tabla, no en la columna A.
    private function validarEncabezados($hoja, $config) {
        $columns = $config['columns'];
        $inicio  = $config['startIndex'];
        $total   = count($columns);
        $limite  = $inicio + ($total * 2);

        $fila = [];
        for ($i = $inicio; $i < $limite; $i++) {
            $letra        = columnLetter($i);
            $fila[$letra] = (string) $hoja->getCell($letra . $config['headerRow'])->getValue();
        }

        $normal = array_map('normalizeHeader', $fila);
        $__row  = [];

        foreach ($columns as $i => $name) {
            $letra    = columnLetter($inicio + $i);
            $esperada = normalizeHeader($name);
            $cuadra   = isset($normal[$letra]) && $normal[$letra] === $esperada;

            $en = $cuadra ? false : array_search($esperada, $normal, true);

            $__row[] = [
                'letra'      => $letra,
                'esperada'   => $name,
                'encontrada' => isset($fila[$letra]) ? trim($fila[$letra]) : '',
                'estado'     => $cuadra ? 'ok' : ($en === false ? 'ausente' : 'movida'),
                'en'         => $en === false ? '' : $en
            ];
        }

        return $__row;
    }

    // Las celdas de la fila que no cuadran, separadas por lo que significan.
    //
    //   criticas  una columna OBLIGATORIA que no esta donde debe. Detiene la
    //             carga: sin ella no hay ticket que armar.
    //
    //   menores   una columna de acompanamiento que no cuadra. Se avisa y se lee
    //             VACIA, que es lo mismo que pasa cuando el POS la exporta en
    //             blanco. No detiene la carga.
    //
    // Da igual si la columna falta o si esta corrida: en los dos casos su posicion
    // no es de fiar y no se lee. Se intento mapearla por nombre para tolerar hojas
    // desplazadas, y se quito: el contrato repite "Total" y "Propina" —una vez para
    // el total del dia y otra para el del pago— asi que la busqueda por nombre
    // devolvia la primera y cargaba el total del dia en cada renglon.
    private function columnasMalas($columnas, $config = null) {
        $criticas = [];
        $menores  = [];

        foreach ($columnas as $i => $c) {
            if ($c['estado'] === 'ok') continue;

            if ($this->esRequerida($config, $i)) $criticas[] = $c;
            else                                 $menores[]  = $c;
        }

        return ['criticas' => $criticas, 'menores' => $menores];
    }

    private function esRequerida($config, $indice) {
        if (!isset($config['required'])) return true;

        return in_array($indice, $config['required'], true);
    }

    // De que columna se lee cada campo del contrato.
    //
    // Solo se leen las que estan EN SU SITIO. Una columna que no cuadra queda en
    // null y su celda se lee vacia: leerla de su posicion daria el dato de la
    // columna vecina, que es peor que no tenerlo, porque entra en base con pinta
    // de bueno.
    private function mapaIndices($columnas, $config) {
        $inicio = $config['startIndex'];
        $__row  = [];

        foreach ($columnas as $i => $c) {
            $__row[$i] = $c['estado'] === 'ok' ? $inicio + $i : null;
        }

        return $__row;
    }

    // Como se resume en una linea lo que no cuadro, para el roadmap y la tarjeta.
    private function resumenMenores($menores) {
        $ausentes = [];
        $movidas  = [];

        foreach ($menores as $c) {
            if ($c['estado'] === 'ausente') $ausentes[] = $c['esperada'];
            else                            $movidas[]  = $c['esperada'] . ' en ' . $c['en'];
        }

        $partes = [];
        if ($ausentes) $partes[] = 'sin ' . implode(', ', $ausentes);
        if ($movidas)  $partes[] = 'fuera de lugar: ' . implode(', ', $movidas);

        return implode(' · ', $partes) . ' · se cargan vacias';
    }

    // Crea el lote de la hoja y vuelca sus filas.
    //
    // A diferencia del importador de Soft, aqui la hoja viaja entera hasta el
    // guardado: el detalle necesita leer el bloque de resumen de las filas 8-12,
    // que esta FUERA de la tabla y no aparece en las filas limpias.
    private function guardarHoja($sheetName, $config, $hoja, $ctx, $mapa = null) {
        $inicio     = $config['startIndex'];
        $total      = count($config['columns']);
        $totalFilas = $hoja->getHighestRow();
        $limpias    = [];

        // Sin mapa se lee por posicion, que es lo que vale cuando la fila de
        // encabezados cuadra entera. Con mapa, cada campo viene de la columna en la
        // que aparecio de verdad, y las que no vinieron quedan en cadena vacia:
        // desde el punto de vista del resto del importador es lo mismo que una
        // celda que el POS exporto en blanco.
        $indice = function ($i) use ($mapa, $inicio) {
            if ($mapa === null) return $inicio + $i;

            return array_key_exists($i, $mapa) ? $mapa[$i] : null;
        };

        $this->reiniciarContadores();

        $claveIdx = $indice($config['keyIndex']);
        $fechaIdx = isset($config['dateIndex']) ? $indice($config['dateIndex']) : null;

        $claveCol = $claveIdx === null ? '' : columnLetter($claveIdx);
        $fechaCol = $fechaIdx === null ? '' : columnLetter($fechaIdx);

        // La columna clave es obligatoria en las cuatro hojas: si no se pudo
        // localizar no hay forma de saber que filas traen datos.
        if ($claveCol === '') return $this->resultadoHoja(0, 0, 0);

        for ($fila = $config['headerRow'] + 1; $fila <= $totalFilas; $fila++) {
            $clave = trim((string) $hoja->getCell($claveCol . $fila)->getValue());
            if ($clave === '') continue; // corta el relleno con formato de la hoja

            // Y esto corta el pie de totales, que si trae valor en la columna
            // clave: «$54,541.04» donde va el movimiento PDV. Lo que no trae es
            // fecha, y ningun movimiento real deja de traerla.
            if ($fechaCol !== '') {
                $marca = trim((string) $hoja->getCell($fechaCol . $fila)->getValue());
                if ($marca === '' || cleanDate($marca) === null) continue;
            }

            $valores = [];
            for ($i = 0; $i < $total; $i++) {
                $col = $indice($i);

                $valores[$i] = $col === null
                    ? ''
                    : trim((string) $hoja->getCell(columnLetter($col) . $fila)->getValue());
            }
            $valores['source_row'] = $fila;

            $limpias[] = $valores;
        }

        // Una hoja sin filas no borra el periodo: no hay nada con que reemplazar y
        // los datos buenos se quedan. Se reporta como cargada sin movimientos.
        if (empty($limpias)) return $this->resultadoHoja(0, 0, 0);

        // El archivo no es un mes: es un rango, y el POS lo exporta como se le
        // pida. Uno que va de junio a septiembre produce CUATRO lotes —uno por
        // mes—, cada uno con las filas de su mes, en vez de un solo lote sellado
        // con el periodo que diga el filtro.
        //
        // Es lo que vuelve cierto el periodo del lote, del que cuelgan la
        // sobreescritura de las hojas bancarias y la bitacora del mes.
        $grupos = $this->agruparPorPeriodo($limpias, $config, $ctx);

        $insertadas   = 0;
        $reemplazadas = 0;
        $leidas       = 0;

        // Los contadores del cruce viven en la instancia y cada grupo los reescribe:
        // se suman aqui para que el paso del roadmap cuente el archivo entero y no
        // solo su ultimo mes.
        $suma    = [];
        $difieren = [];

        foreach ($grupos as $clave => $filas) {
            $suCtx = $this->ctxDelPeriodo($ctx, $clave);

            $insertadas   += $this->guardarGrupo($sheetName, $config, $hoja, $suCtx, $filas);
            $reemplazadas += $this->reemplazadas;
            $leidas       += count($filas);

            foreach ($this->contadores() as $campo => $valor) {
                $suma[$campo] = ($suma[$campo] ?? 0) + $valor;
            }

            // Los movimientos con importe distinto se juntan de todos los meses: son
            // una lista, no un contador, y cada grupo la reescribe al empezar.
            $difieren = array_merge($difieren, $this->diferencias);
        }

        foreach ($suma as $campo => $valor) $this->$campo = $valor;

        $this->diferencias = array_slice($difieren, 0, self::MUESTRA_DIFERENCIAS);

        return $this->resultadoHoja($insertadas, $leidas, $reemplazadas);
    }

    // Las filas de la hoja repartidas por el mes al que pertenecen, de la mas
    // antigua a la mas reciente.
    //
    // El mes sale de la fecha de cada fila, que es el dato que dice cuando ocurrio
    // el movimiento. La hoja que no trae fecha propia no se puede repartir y se
    // queda entera en el periodo del filtro, igual que antes; lo mismo la fila
    // suelta cuya fecha no se pudo leer, que va con el resto en vez de perderse.
    private function agruparPorPeriodo($limpias, $config, $ctx) {
        $delFiltro = sprintf('%04d-%02d', (int) $ctx['anio'], (int) $ctx['mes']);

        if (!isset($config['dateIndex'])) return [$delFiltro => $limpias];

        $grupos = [];

        foreach ($limpias as $v) {
            $fecha = cleanDate($v[$config['dateIndex']]);
            $clave = $fecha === null ? $delFiltro : substr($fecha, 0, 7);

            $grupos[$clave][] = $v;
        }

        ksort($grupos);

        return $this->soloLosElegidos($grupos, $ctx);
    }

    // Los meses que la pantalla dejo marcados. El resto del archivo se lee igual
    // —hay que leerlo para saber de que mes es cada fila— pero no se guarda.
    //
    // Una lista vacia no es "ninguno" sino "todos": es como llega cuando el usuario
    // no descarto nada, que es el caso normal.
    private function soloLosElegidos($grupos, $ctx) {
        $elegidos = isset($ctx['meses']) ? $ctx['meses'] : [];

        if (empty($elegidos)) return $grupos;

        $__row = [];

        foreach ($grupos as $clave => $filas) {
            if (in_array($clave, $elegidos, true)) $__row[$clave] = $filas;
        }

        return $__row;
    }

    // El contexto de la carga, apuntando al mes de este grupo. Todo lo demas —el
    // archivo, la sucursal, el usuario— es del mismo envio y no cambia.
    private function ctxDelPeriodo($ctx, $clave) {
        $ctx['anio'] = (int) substr($clave, 0, 4);
        $ctx['mes']  = (int) substr($clave, 5, 2);

        return $ctx;
    }

    // Cada grupo de mes mide lo suyo: los metodos de guardado ASIGNAN estos
    // contadores, no los acumulan, asi que sin ponerlos a cero antes de cada lote
    // la suma del final contaria dos veces lo del grupo anterior.
    private function reiniciarContadores() {
        $this->rechazadas = 0;
        $this->ventas     = 0;
        $this->pagos      = 0;
        $this->meseros    = 0;
        $this->cajeros    = 0;
        $this->ligados    = 0;
        $this->resumenes  = 0;
        $this->renglones  = 0;
        $this->omitidos   = 0;
        $this->difieren   = 0;
        $this->diferencias = [];
    }

    private function contadores() {
        return [
            'rechazadas' => $this->rechazadas,
            'ventas'     => $this->ventas,
            'pagos'      => $this->pagos,
            'meseros'    => $this->meseros,
            'cajeros'    => $this->cajeros,
            'ligados'    => $this->ligados,
            'resumenes'  => $this->resumenes,
            'renglones'  => $this->renglones,
            'omitidos'   => $this->omitidos,
            'difieren'   => $this->difieren
        ];
    }

    // El lote de UN mes y sus filas. Devuelve cuantas entraron y deja en
    // `$this->reemplazadas` las que se fueron con la carga anterior de ese periodo.
    private function guardarGrupo($sheetName, $config, $hoja, $ctx, $limpias) {
        $this->reiniciarContadores();

        $this->reemplazadas = $this->borrarPeriodo($sheetName, $config['target'], $ctx);

        $control = 0;
        foreach ($limpias as $v) $control += numVal($v[$config['controlIndex']]);

        $this->controlInsertado = $control;

        // La ficha de auditoria del lote. `source_rows` queda fijo con lo que traia
        // el archivo; `row_count` y `duplicated_rows` se corrigen al terminar,
        // cuando se sabe cuanto entro y cuanto se omitio por repetido.
        $batch = $this->util->sql([
            'file_name'     => $ctx['fileName'],
            'sheet_name'    => $sheetName,
            'period_year'   => $ctx['anio'],
            'period_month'  => $ctx['mes'],
            'source_rows'   => count($limpias),
            'row_count'     => count($limpias),
            'control_total' => $control,
            'created_at'    => date('Y-m-d H:i:s'),
            'user_name'     => $ctx['userName'] ?? '',
            'user_id'       => $ctx['userId'] ?? null,
            'branch_id'     => $ctx['branchId']
        ]);

        if (!$this->mdl->createImportBatch($batch)) return 0;

        $max     = $this->mdl->getMaxImportBatchId();
        $batchId = (int) $max[0]['id'];

        // Cada target dice a que metodo va su hoja. El default NO es un guardado:
        // una hoja cuyo target nadie atiende se queda en cero y lo dice, en vez de
        // caer en el ultimo metodo de la lista y escribir sus filas en la tabla
        // equivocada.
        if     ($config['target'] === 'wansoft-detail')  $insertadas = $this->guardarDetalle($limpias, $hoja, $batchId, $ctx);
        elseif ($config['target'] === 'wansoft-command') $insertadas = $this->guardarComandas($limpias, $batchId, $ctx);
        elseif ($config['target'] === 'card')            $insertadas = $this->guardarTarjetas($limpias, $batchId, $ctx, 0);
        elseif ($config['target'] === 'card-refund')     $insertadas = $this->guardarTarjetas($limpias, $batchId, $ctx, 1);
        elseif ($config['target'] === 'deleted')         $insertadas = $this->guardarEliminados($limpias, $batchId, $ctx);
        else                                             $insertadas = 0;

        // Un lote sin filas no deja rastro: pasa cuando el archivo entero ya estaba
        // procesado, que no es un fallo pero tampoco una carga.
        if ($insertadas === 0) {
            $this->mdl->deleteImportBatchById($this->util->sql(['id' => $batchId], 1));

            return 0;
        }

        // El lote nacio contando las filas del archivo; ahora se ajusta a las que
        // realmente entraron, junto con su total de control y los duplicados que
        // explican la diferencia.
        if ($insertadas !== count($limpias) || $this->omitidos > 0) {
            $this->mdl->updateImportBatchRows([$insertadas, $this->controlInsertado, $this->omitidos, $batchId]);
        }

        return $insertadas;
    }

    private function resultadoHoja($insertadas, $leidas, $reemplazadas) {
        return [
            'insertadas'   => $insertadas,
            'leidas'       => $leidas,
            'reemplazadas' => $reemplazadas,
            'rechazadas'   => $this->rechazadas,
            'ventas'       => $this->ventas,
            'pagos'        => $this->pagos,
            'meseros'      => $this->meseros,
            'cajeros'      => $this->cajeros,
            'ligados'      => $this->ligados,
            'resumenes'    => $this->resumenes,
            // Renglones de comanda que estaban esperando su venta y esta carga
            // engancho. Va en el resultado porque `detalleCruce` lo lee para
            // redactar el paso, y una clave que falta ahi no es un dato menos: es
            // un Notice impreso ANTES del JSON que deja la respuesta ilegible
            // para el navegador («Unexpected token '<'»).
            'renglones'    => $this->renglones,
            'omitidos'     => $this->omitidos,
            'difieren'     => $this->difieren,
            'diferencias'  => $this->diferencias
        ];
    }

    // Sobreescritura del periodo para las hojas que NO se cargan de forma
    // incremental.
    //
    // La hoja de detalle quedo fuera: sus movimientos se comparan uno a uno contra
    // lo que ya esta en base y los repetidos se omiten, asi que borrar la carga
    // anterior seria tirar datos buenos para volver a escribir los mismos. Las
    // hojas bancarias y la de eliminados si se reemplazan: no tienen una llave
    // estable con la que reconocer un movimiento ya visto —la hoja bancaria del
    // export medido vino vacia y no hay con que medirlo—, y hasta que la haya
    // reemplazar es lo unico que no deja duplicados.
    private function borrarPeriodo($sheetName, $target, $ctx) {
        if ($target === 'wansoft-detail') return 0;

        $previos = $this->mdl->listImportBatchBySheet([
            $ctx['branchId'], $ctx['anio'], $ctx['mes'], $sheetName
        ]);

        if (empty($previos)) return 0;

        $filas = 0;
        foreach ($previos as $lote) {
            $where = $this->util->sql(['import_batch_id' => $lote['id']], 1);

            // Cada target dice de que tabla son sus filas. Un target que nadie
            // reconoce NO cae en el ultimo de la lista: se salta el lote entero.
            //
            // Ese default era un borrado real y silencioso. Con `detail` —las
            // comandas— la carga terminaba llamando a `deleteDeletedPaymentByBatch`,
            // que vacia la tabla de pagos eliminados: no borraba un solo renglon de
            // comanda, pero si se llevaba el lote. Y como la llave es ON DELETE SET
            // NULL, los 8 719 renglones se quedaban sin lote y sin forma de volver
            // a alcanzarlos, asi que la siguiente carga los daba por nuevos.
            if     ($target === 'card' || $target === 'card-refund') $this->mdl->deletePaymentCardByBatch($where);
            elseif ($target === 'detail')                            $this->mdl->deleteSaleDetailByBatch($where);
            elseif ($target === 'payment')                           $this->mdl->deleteSalePaymentByBatch($where);
            elseif ($target === 'deleted')                           $this->mdl->deleteDeletedPaymentByBatch($where);
            else                                                     continue;

            $this->mdl->deleteImportBatchById($this->util->sql(['id' => $lote['id']], 1));
            $filas += (int) $lote['row_count'];
        }

        return $filas;
    }

    // ---------------------------------------------------------------------
    //  Hoja "Detalle por forma de pago"
    // ---------------------------------------------------------------------

    // La hoja principal, y la unica que produce DOS tablas: cada fila es un pago y
    // varias filas comparten ticket (el movimiento 6275 del archivo medido son dos
    // pagos de la misma cuenta, 236 + 1070).
    //
    // El orden importa: primero los catalogos, porque la venta entra ya con el id
    // de su mesero y su cajero resueltos. Es el mismo patron de ventasPorFolio() en
    // el importador de Soft: un mapa en memoria antes de insertar, en vez de un
    // UPDATE por fila despues. Aqui es todavia mas barato, porque los meseros de un
    // dia se cuentan con los dedos.
    private function guardarDetalle($rows, $hoja, $batchId, $ctx) {
        // Los movimientos que ya se procesaron se apartan ANTES de tocar nada: la
        // carga es incremental, no un reemplazo. Volver a subir el mismo archivo no
        // duplica una sola venta, y subir uno mas grande del mismo dia solo agrega
        // lo que falta.
        $conocidos = $this->movimientosConocidos($rows, $ctx);
        $nuevos    = [];

        foreach ($rows as $v) {
            if ($v[5] === '' || isset($conocidos[$v[5]])) continue;

            $nuevos[] = $v;
        }

        $this->omitidos = count($conocidos);
        $this->difieren = $this->contarDiferencias($rows, $conocidos);

        // Todo el archivo ya estaba: no se crea catalogo ni resumen por algo que no
        // aporta un dato nuevo.
        if (empty($nuevos)) return 0;

        // El total de control del lote es el de lo que ENTRA, no el del archivo: un
        // lote que agrego 18 movimientos no cuadra contra la suma de los 36 que
        // traia el Excel, y esa cifra es justo la que se usa para comprobar una
        // carga contra su origen.
        $this->controlInsertado = 0;
        foreach ($nuevos as $v) $this->controlInsertado += numVal($v[15]);

        $this->meseros = $this->sembrarMeseros($nuevos, $ctx);
        $this->cajeros = $this->sembrarCajeros($nuevos, $ctx);

        $meseros = $this->mapaPorNombre($this->mdl->listWaiterByName([$ctx['branchId']]));
        $cajeros = $this->mapaPorNombre($this->mdl->listCashier([$ctx['branchId']]));
        $estados = $this->mapaEstados();
        $metodos = $this->mapaMetodos($ctx);

        $resumen = $this->leerResumen($hoja);
        $tasa    = $this->tasaDelResumen($resumen);

        $this->ventas = $this->guardarVentas($nuevos, $batchId, $ctx, $meseros, $cajeros, $estados, $tasa);
        $this->pagos  = $this->guardarPagos($nuevos, $batchId, $metodos);

        // Los pagos entran con el movimiento PDV en sale_folio y se cuelgan de su
        // venta en una sola sentencia, ya con las ventas del lote en base.
        if ($this->pagos > 0) $this->mdl->linkPaymentToSaleByPdv([$ctx['branchId'], $batchId]);

        // Y aqui se rescatan las comandas que llegaron ANTES que su venta.
        //
        // El archivo de comandas cubre un mes entero y el de ventas se sube por
        // dias, asi que lo normal es que los renglones esperen: en la primera
        // carga real fueron 8 719 renglones de 759 comandas sin ticket todavia.
        //
        // Sin esta llamada, el orden en que el usuario sube los dos archivos
        // decidiria si los datos se cruzan o no, que es una trampa silenciosa: la
        // carga diria «ok» y la comanda se quedaria colgando para siempre.
        //
        // Cuantos engancho se sabe restando, no por lo que devuelve el UPDATE:
        // `_CUD` entrega el booleano de `execute()` y castearlo daba siempre 1.
        $this->renglones = $this->rescatarHuerfanos($ctx);

        $this->resumenes = $this->guardarResumen($rows, $resumen, $batchId, $ctx);

        // Lo que cuenta como "insertadas" de esta hoja son los pagos: es lo que
        // tiene una fila por cada fila del Excel. Las ventas son agrupaciones.
        return $this->pagos;
    }

    // Engancha las comandas que esperaban su venta y devuelve CUANTAS engancho.
    private function rescatarHuerfanos($ctx) {
        $antes = $this->mdl->countOrphanDetailByBranch([$ctx['branchId']]);
        $antes = (int) ($antes[0]['total'] ?? 0);

        if ($antes === 0) return 0;

        $this->mdl->linkOrphanDetailToSale([$ctx['branchId']]);

        $ahora = $this->mdl->countOrphanDetailByBranch([$ctx['branchId']]);
        $ahora = (int) ($ahora[0]['total'] ?? 0);

        return max(0, $antes - $ahora);
    }

    // Los movimientos del archivo que ya estan en base, indexados por su PDV.
    //
    // Se pregunta en bloques de 400 por el mismo motivo que ventasPorFolio en el
    // importador de Soft: un IN con miles de marcadores revienta el limite de PDO.
    private function movimientosConocidos($rows, $ctx) {
        $pdvs = [];
        foreach ($rows as $v) {
            if ($v[5] !== '') $pdvs[$v[5]] = true;
        }

        if (empty($pdvs)) return [];

        $__row = [];
        foreach (array_chunk(array_keys($pdvs), 400) as $chunk) {
            foreach ($this->mdl->listSaleByPdvList(array_merge([$ctx['branchId']], $chunk)) as $s) {
                $__row[$s['pdv_movement']] = $s;
            }
        }

        return $__row;
    }

    // De los movimientos omitidos, cuantos traen HOY un total distinto del que se
    // guardo cuando entraron.
    //
    // No se actualiza ninguno: la carga es incremental y lo ya procesado no se
    // vuelve a tocar. Pero un ticket que cambio de importe despues de cargarse es
    // otra cosa que un duplicado exacto —alguien lo corrigio en el POS— y quien
    // sube el archivo tiene que poder enterarse.
    private function contarDiferencias($rows, $conocidos) {
        $this->diferencias = [];

        if (empty($conocidos)) return 0;

        $totales = [];
        foreach ($rows as $v) {
            if ($v[5] === '' || !isset($conocidos[$v[5]])) continue;

            if (!isset($totales[$v[5]])) $totales[$v[5]] = 0;
            $totales[$v[5]] += numVal($v[15]);
        }

        $distintos = 0;
        foreach ($totales as $pdv => $total) {
            if (abs($total - (float) $conocidos[$pdv]['total']) <= 0.009) continue;

            $distintos++;

            // Se guardan los primeros, no todos: la lista es para poder ir a
            // buscarlos en el POS, y con veinte en pantalla ya no se busca nada. El
            // conteo de arriba sigue siendo el total, asi que el aviso puede decir
            // cuantos quedan fuera de la muestra.
            if (count($this->diferencias) >= self::MUESTRA_DIFERENCIAS) continue;

            $this->diferencias[] = [
                'pdv'      => (string) $pdv,
                'folio'    => (string) ($conocidos[$pdv]['folio'] ?? ''),
                'guardado' => (float) $conocidos[$pdv]['total'],
                'archivo'  => $total
            ];
        }

        return $distintos;
    }

    // El catalogo de meseros se cruza por NOMBRE porque Wansoft no manda codigo. El
    // que no existe se da de alta con code en nulo; el que ya venia de una carga de
    // Soft Restaurant conserva el suyo y no se toca.
    private function sembrarMeseros($rows, $ctx) {
        $existen = $this->mapaPorNombre($this->mdl->listWaiterByName([$ctx['branchId']]));

        $nuevos = [];
        foreach ($rows as $v) {
            $nombre = limpiarNombre($v[7]);
            if ($nombre === '' || isset($existen[claveNombre($nombre)])) continue;

            $nuevos[claveNombre($nombre)] = $nombre;
        }

        if (empty($nuevos)) return 0;

        $data = [];
        foreach ($nuevos as $nombre) {
            $data[] = ['name' => $nombre, 'branch_id' => $ctx['branchId']];
        }

        return $this->insertarCatalogo($data, 'waiter');
    }

    private function sembrarCajeros($rows, $ctx) {
        $existen = $this->mapaPorNombre($this->mdl->listCashier([$ctx['branchId']]));

        $nuevos = [];
        foreach ($rows as $v) {
            $nombre = limpiarNombre($v[8]);
            if ($nombre === '' || isset($existen[claveNombre($nombre)])) continue;

            $nuevos[claveNombre($nombre)] = $nombre;
        }

        if (empty($nuevos)) return 0;

        $data = [];
        foreach ($nuevos as $nombre) {
            $data[] = ['name' => $nombre, 'branch_id' => $ctx['branchId']];
        }

        return $this->insertarCatalogo($data, 'cashier');
    }

    // Una venta por movimiento PDV. El total del ticket es la SUMA de sus pagos:
    // la columna P es del pago, no de la cuenta, y en un ticket partido ninguna de
    // las dos filas trae el total real.
    private function guardarVentas($rows, $batchId, $ctx, $meseros, $cajeros, $estados, $tasa) {
        $tickets = [];

        foreach ($rows as $v) {
            $pdv = $v[5];
            if ($pdv === '') continue;

            if (!isset($tickets[$pdv])) {
                $tickets[$pdv] = [
                    'pdv'     => $pdv,
                    'orden'   => (int) numVal($v[4]),
                    'fecha'   => cleanDate($v[3]),
                    'estatus' => $v[6],
                    'mesero'  => limpiarNombre($v[7]),
                    'cajero'  => limpiarNombre($v[8]),
                    'total'   => 0,
                    'fila'    => $v['source_row']
                ];
            }

            $tickets[$pdv]['total'] += numVal($v[15]);
        }

        if (empty($tickets)) return 0;

        $data = [];
        foreach ($tickets as $t) {
            // Wansoft solo desglosa el IVA por dia, nunca por ticket. Se deriva con
            // la tasa que el propio archivo declara en su bloque de resumen, para
            // que tasaDe() del modulo de tickets —que divide impuesto entre
            // subtotal— siga leyendo la venta al 16 % y no al 0 %.
            $subtotal = $tasa > 0 ? round($t['total'] / (1 + $tasa), 2) : $t['total'];
            $impuesto = round($t['total'] - $subtotal, 2);

            $data[] = [
                'folio'               => $t['pdv'],
                'billing_code'        => null,
                'pdv_movement'        => $t['pdv'],
                'order_number'        => $t['orden'],
                'subtotal'            => $subtotal,
                'tax'                 => $impuesto,
                'total'               => $t['total'],
                'operation_date'      => $t['fecha'],
                'operation_status_id' => $this->idDe($estados, $t['estatus']),
                'waiter_id'           => $this->idDe($meseros, $t['mesero']),
                'cashier_id'          => $this->idDe($cajeros, $t['cajero']),
                'source_row'          => $t['fila'],
                'branch_id'           => $ctx['branchId'],
                'import_batch_id'     => $batchId
            ];
        }

        return $this->insertarPorBloques($data, 'sale');
    }

    // Un pago por fila del Excel. `sale_folio` lleva el movimiento PDV, que es con
    // lo que se cruza contra la venta un paso despues.
    private function guardarPagos($rows, $batchId, $metodos) {
        $data = [];

        foreach ($rows as $v) {
            if ($v[5] === '') continue;

            $data[] = [
                'sale_folio'        => $v[5],
                'terminal'          => $v[13] === '' ? null : $v[13],
                'reference'         => $v[11] === '' ? null : $v[11],
                'transaction_code'  => $v[12] === '' ? null : $v[12],
                'validation_code'   => $v[14] === '' ? null : $v[14],
                'amount'            => numVal($v[15]),
                'tip'               => numVal($v[16]),
                'paid_at'           => cleanDate($v[10]),
                'payment_method_id' => $this->idDe($metodos, $v[9]),
                'source_row'        => $v['source_row'],
                'import_batch_id'   => $batchId
            ];
        }

        return $this->insertarPorBloques($data, 'payment');
    }

    // El bloque de resumen vive FUERA de la tabla, en las filas 8 a 12, como pares
    // etiqueta/valor en tres columnas (A-B, D-E, H-I). Se lee por etiqueta y no por
    // posicion fija: el POS mueve los pares de sitio segun lo que tenga que decir.
    private function leerResumen($hoja) {
        $pares = [[0, 1], [3, 4], [7, 8]];
        $__row = [];

        for ($fila = 8; $fila <= 12; $fila++) {
            foreach ($pares as $par) {
                $etiqueta = trim((string) $hoja->getCell(columnLetter($par[0]) . $fila)->getValue());
                if ($etiqueta === '') continue;

                $valor = $hoja->getCell(columnLetter($par[1]) . $fila)->getValue();
                $__row[normalizeHeader($etiqueta)] = numVal($valor);
            }
        }

        return $__row;
    }

    // La tasa se DEDUCE del archivo en vez de darla por sentada: el bloque trae el
    // subtotal y el IVA del dia, y su cociente es la tasa con la que se factura esa
    // sucursal. Si el bloque no vino, se cae a la del negocio.
    private function tasaDelResumen($resumen) {
        $subtotal = isset($resumen['subtotal']) ? (float) $resumen['subtotal'] : 0;
        $impuesto = isset($resumen['iva'])      ? (float) $resumen['iva']      : 0;

        if ($subtotal <= 0 || $impuesto <= 0) return WANSOFT_TASA_DEFAULT;

        return round($impuesto / $subtotal, 4);
    }

    // Una fila por dia y sucursal con lo que no se puede derivar de las ventas:
    // comensales, cortesias y platillos cancelados son conteos que el POS calcula y
    // que ningun renglon nuestro reconstruye.
    //
    // El bloque de resumen es del RANGO COMPLETO del reporte, no de un dia. Cuando
    // el export trae un solo dia —el caso medido— se guarda entero. Cuando trae
    // varios, los conteos no se pueden repartir entre ellos y solo se guardan los
    // montos, que si salen dia por dia de las propias filas.
    private function guardarResumen($rows, $resumen, $batchId, $ctx) {
        $dias = [];

        foreach ($rows as $v) {
            $fecha = cleanDate($v[3]);
            if ($fecha === null) continue;

            $dia = substr($fecha, 0, 10);

            if (!isset($dias[$dia])) $dias[$dia] = ['total' => 0, 'tip' => 0, 'tickets' => []];

            $dias[$dia]['total'] += numVal($v[15]);
            $dias[$dia]['tip']   += numVal($v[16]);
            $dias[$dia]['tickets'][$v[5]] = true;
        }

        if (empty($dias)) return 0;

        $unico = count($dias) === 1;
        $tasa  = $this->tasaDelResumen($resumen);
        $data  = [];

        foreach ($dias as $dia => $d) {
            // Con un solo dia manda el bloque de resumen, que trae el desglose
            // LITERAL del POS. Derivarlo daria 45,702.59 donde el archivo dice
            // 45,702.58: un centavo de redondeo que no hay por que inventar
            // teniendo el dato. Con varios dias no queda mas remedio que derivar,
            // porque el bloque es del rango completo.
            $subtotal = $unico && valorDe($resumen, 'subtotal') > 0
                ? valorDe($resumen, 'subtotal')
                : ($tasa > 0 ? round($d['total'] / (1 + $tasa), 2) : $d['total']);

            $impuesto = $unico && valorDe($resumen, 'iva') > 0
                ? valorDe($resumen, 'iva')
                : round($d['total'] - $subtotal, 2);

            $data[] = [
                'order_count'          => count($d['tickets']),
                'guest_count'          => $unico ? (int) valorDe($resumen, 'no personas') : 0,
                'courtesy_count'       => $unico ? (int) valorDe($resumen, 'cortesias completas') : 0,
                'free_dish_count'      => $unico ? (int) valorDe($resumen, 'platillos gratis') : 0,
                'cancelled_dish_count' => $unico ? (int) valorDe($resumen, 'platillos cancelados') : 0,
                'cancelled_sale_count' => $unico ? (int) valorDe($resumen, 'ventas canceladas') : 0,
                'subtotal'             => $subtotal,
                'tax'                  => $impuesto,
                'total'                => $d['total'],
                'tip'                  => round($d['tip'], 2),
                'courtesy_total'       => $unico ? valorDe($resumen, 'total cortesias') : 0,
                'cancellation_total'   => $unico ? valorDe($resumen, 'total cancelaciones') : 0,
                'operation_date'       => $dia,
                'branch_id'            => $ctx['branchId'],
                'import_batch_id'      => $batchId
            ];

            // El UNIQUE es (operation_date, branch_id): la fila del dia se borra
            // antes de escribirla aunque venga de otro lote, o el INSERT choca.
            $this->mdl->deleteDailySummaryByDate([$dia, $ctx['branchId']]);
        }

        return $this->insertarPorBloques($data, 'summary');
    }

    // ---------------------------------------------------------------------
    //  Hojas bancarias y de eliminados
    // ---------------------------------------------------------------------

    // Las dos hojas de terminal caen en la misma tabla y las distingue `is_refund`:
    // la cancelacion y la devolucion son la misma operacion con signo contrario.
    // La hoja de cancelaciones no trae "Pago Anticipado", por eso ese campo se lee
    // solo cuando la columna existe.
    private function guardarTarjetas($rows, $batchId, $ctx, $esDevolucion) {
        $data = [];

        foreach ($rows as $v) {
            $data[] = [
                'pdv_order'          => $v[0],
                'pdv_order_id'       => $v[2] === '' ? null : $v[2],
                'transaction_code'   => $v[3] === '' ? null : $v[3],
                'authorization_code' => $v[14] === '' ? null : $v[14],
                'arqc'               => $v[4] === '' ? null : $v[4],
                'terminal'           => $v[6] === '' ? null : $v[6],
                'apn'                => $v[7] === '' ? null : $v[7],
                'pinpad_type'        => $v[8] === '' ? null : $v[8],
                'operation_type'     => $v[9] === '' ? null : $v[9],
                'bank'               => $v[10] === '' ? null : $v[10],
                'card_type'          => $v[11] === '' ? null : $v[11],
                'card_number'        => $v[12] === '' ? null : $v[12],
                'response_message'   => $v[13] === '' ? null : $v[13],
                'is_prepaid'         => isset($v[16]) ? banderaDe($v[16]) : 0,
                'is_refund'          => $esDevolucion,
                'amount'             => numVal($v[15]),
                'operation_date'     => cleanDate($v[1]),
                'authorized_at'      => cleanDate($v[5]),
                'import_batch_id'    => $batchId
            ];
        }

        $insertadas = $this->insertarPorBloques($data, 'card');

        if ($insertadas > 0) {
            $this->mdl->linkPaymentCardByBatch([$ctx['branchId'], $batchId]);

            $conteo        = $this->mdl->countPaymentCardByBatch([$batchId]);
            $this->ligados = (int) ($conteo[0]['ligados'] ?? 0);
        }

        return $insertadas;
    }

    // Bitacora de pagos borrados en el POS. Se cruza contra los catalogos por
    // nombre igual que el detalle, pero SIN sembrar: un pago que ya no existe no
    // justifica dar de alta a un mesero que nunca aparecio en una venta.
    private function guardarEliminados($rows, $batchId, $ctx) {
        $meseros = $this->mapaPorNombre($this->mdl->listWaiterByName([$ctx['branchId']]));
        $cajeros = $this->mapaPorNombre($this->mdl->listCashier([$ctx['branchId']]));
        $metodos = $this->mapaMetodos($ctx);

        $data = [];
        foreach ($rows as $v) {
            $data[] = [
                'pdv_order'         => $v[2],
                'terminal'          => $v[7] === '' ? null : $v[7],
                'modified_by'       => $v[5] === '' ? null : $v[5],
                'amount'            => numVal($v[8]),
                'tip'               => numVal($v[9]),
                'operation_date'    => cleanDate($v[1]),
                'registered_at'     => cleanDate($v[0]),
                'waiter_id'         => $this->idDe($meseros, limpiarNombre($v[3])),
                'cashier_id'        => $this->idDe($cajeros, limpiarNombre($v[4])),
                'payment_method_id' => $this->idDe($metodos, $v[6]),
                'branch_id'         => $ctx['branchId'],
                'import_batch_id'   => $batchId
            ];
        }

        return $this->insertarPorBloques($data, 'deleted');
    }

    // ---------------------------------------------------------------------
    //  Mapas de catalogo
    // ---------------------------------------------------------------------

    // Los catalogos se resuelven en memoria y no con un UPDATE posterior: son
    // decenas de filas, no miles, y asi la venta entra con su id desde el primer
    // INSERT.
    private function mapaPorNombre($filas) {
        $__row = [];

        foreach ($filas as $item) {
            $__row[claveNombre($item['name'])] = (int) $item['id'];
        }

        return $__row;
    }

    private function mapaEstados() {
        $__row = [];

        foreach ($this->mdl->lsSaleOperationStatus() as $item) {
            $__row[claveNombre($item['valor'])] = (int) $item['id'];
        }

        return $__row;
    }

    // Las formas de pago se cruzan por su nombre NORMALIZADO, no con strtoupper:
    // esa funcion no es multibyte y dejaria «Tarjeta de credito» como «TARJETA DE
    // CRéDITO», que no empata con ningun seed. El catalogo se guarda sin acentos y
    // aqui se compara igual.
    private function mapaMetodos($ctx) {
        $__row = [];

        foreach ($this->mdl->lsPaymentMethod([$ctx['branchId']]) as $item) {
            $__row[claveNombre($item['valor'])] = (int) $item['id'];
        }

        return $__row;
    }

    private function idDe($mapa, $texto) {
        $clave = claveNombre($texto);

        return isset($mapa[$clave]) ? $mapa[$clave] : null;
    }

    // ---------------------------------------------------------------------
    //  Insercion
    // ---------------------------------------------------------------------

    // Un INSERT por cada 400 filas, y el bloque que falla se reintenta fila por
    // fila: PDO tumba las 400 por una sola invalida, y asi entra el archivo
    // completo quedando fuera solo lo que el motor rechaza de verdad.
    private function insertarPorBloques($data, $target) {
        $insertadas = 0;

        foreach (array_chunk($data, 400) as $chunk) {
            if ($this->insertarBloque($chunk, $target) === true) {
                $insertadas += count($chunk);
                continue;
            }

            foreach ($chunk as $fila) {
                if ($this->insertarBloque([$fila], $target) === true) $insertadas++;
                else $this->rechazadas++;
            }
        }

        return $insertadas;
    }

    // Las altas de catalogo no son filas de la hoja: lo que rechace el motor no
    // cuenta como fila rechazada del Excel.
    private function insertarCatalogo($data, $target) {
        $previas    = $this->rechazadas;
        $insertadas = $this->insertarPorBloques($data, $target);

        $this->rechazadas = $previas;

        return $insertadas;
    }

    private function insertarBloque($chunk, $target) {
        $values = $this->util->sql($chunk);

        if ($target === 'sale')     return $this->mdl->createSale($values);
        if ($target === 'payment')  return $this->mdl->createSalePayment($values);
        if ($target === 'waiter')   return $this->mdl->createWaiter($values);
        if ($target === 'cashier')  return $this->mdl->createCashier($values);
        if ($target === 'summary')  return $this->mdl->createDailySummary($values);
        if ($target === 'card')     return $this->mdl->createPaymentCard($values);
        if ($target === 'product')  return $this->mdl->createProduct($values);
        if ($target === 'detail')   return $this->mdl->createSaleDetail($values);
        if ($target === 'deleted')  return $this->mdl->createDeletedPayment($values);

        return false;
    }

    // ---------------------------------------------------------------------
    //  Hojas grandes: se leen por bloques
    // ---------------------------------------------------------------------

    /*
        Camino alterno para las hojas que no caben en memoria de una pieza.

        A diferencia de `procesarLibro`, este metodo NO recibe el libro cargado:
        recibe la RUTA, porque cargarlo es justo lo que hay que evitar. Abre el
        archivo una vez por bloque de filas, procesa ese bloque y lo suelta.

        Lo unico que sobrevive de un bloque al siguiente son cosas diminutas: el
        catalogo visto (174 productos), los meseros (9) y los contadores. Los
        renglones se insertan y se sueltan, asi que la memoria se mantiene plana
        sin importar si el archivo trae nueve mil filas o noventa mil.

        Los renglones entran aunque su venta todavia no exista —el reporte de
        ventas de ese dia puede no haberse subido— y se enganchan al final. Ver
        `linkOrphanDetailToSale` en el modelo.
    */
    function procesarArchivo($ruta, $ctx) {
        $contrato = $this->contrato();
        $tipo     = isset($ctx['tipo']) ? $ctx['tipo'] : '';
        $steps    = isset($ctx['steps']) ? $ctx['steps'] : [];

        $nombre = '';
        foreach ($contrato as $hoja => $config) {
            if ($config['tab'] === $tipo) { $nombre = $hoja; break; }
        }

        if ($nombre === '') {
            return [
                'status'  => 400,
                'message' => 'No hay contrato para esta pestana',
                'steps'   => $steps,
                'hojas'   => []
            ];
        }

        $config = $contrato[$nombre];

        // Cuantas filas trae, SIN cargar el archivo: 1.4 s y 18 MB contra los 160
        // que costaria abrirlo. Ademas sirve para avisar cuanto va a tardar antes
        // de empezar.
        $lector = \PhpOffice\PhpSpreadsheet\IOFactory::createReaderForFile($ruta);
        $total  = 0;

        foreach ($lector->listWorksheetInfo($ruta) as $info) {
            if ($info['worksheetName'] === $nombre) $total = (int) $info['totalRows'];
        }

        if ($total === 0) {
            $steps[] = step('Detectar hojas', 'error', 'El libro no trae la hoja "' . $nombre . '"');

            return [
                'status'     => 400,
                'message'    => 'Este no es el reporte que espera Wansoft',
                'steps'      => $steps,
                'hojas'      => [],
                'validacion' => [
                    'motivo'    => 'hojas',
                    'esperadas' => [$nombre],
                    'libro'     => $this->hojasDelArchivo($lector, $ruta),
                    'columnas'  => [],
                    'cargadas'  => []
                ]
            ];
        }

        $steps[] = step('Detectar hojas', 'ok', $nombre . ' · ' . number_format($total) . ' filas');

        /*
            El periodo con tickets emitidos NO rechaza la carga: le cambia el modo.

            Mientras nadie haya generado un ticket, el mes es material de trabajo y
            la carga REEMPLAZA: se borra lo que habia y se escribe el archivo
            completo. Es lo que permite corregir —un ticket que el POS arreglo
            despues entra con su valor bueno— y es el caso normal.

            En cuanto se genera el primer ticket, ese papel ya salio y sus
            renglones dejan de poder moverse: la carga pasa a solo AGREGAR los
            movimientos que no estaban. Lo ya emitido se queda como se emitio.
        */
        $notas = $this->notasDelPeriodo($ctx);
        $modo  = $notas ? 'incremental' : 'reemplazo';

        $steps[] = step(
            'Revisar periodo',
            'ok',
            $notas
                ? $notas['total'] . ' ticket(s) ya emitidos · solo se agregan movimientos nuevos'
                : 'sin tickets emitidos · la carga reemplaza al periodo'
        );

        // Los encabezados se validan leyendo SOLO su fila: no hace falta el archivo
        // entero para saber si las columnas estan donde el contrato dice. Abrirlo si
        // hace falta, y con un libro grande eso ya son segundos: se apunta.
        $this->apuntarPaso($ctx, 'columnas');

        $docEnc   = $this->leerBloque($ruta, $nombre, $config['headerRow'], 1);
        $columnas = $this->validarEncabezados($docEnc->getSheetByName($nombre), $config);
        $faltan   = $this->columnasMalas($columnas, $config);

        $this->soltarLibro($docEnc);
        unset($docEnc);

        if (!empty($faltan['criticas'])) {
            $nombres = [];
            foreach ($faltan['criticas'] as $c) $nombres[] = $c['esperada'];

            $detalle  = 'No se encontro la columna "' . implode('", "', $nombres) . '"';
            $steps[]  = step('Validar columnas de "' . $nombre . '"', 'error', $detalle);

            return [
                'status'     => 400,
                'message'    => 'El archivo no trae las columnas que espera el detalle de ventas',
                'steps'      => $steps,
                'hojas'      => [['nombre' => $nombre, 'estado' => 'error', 'detalle' => $detalle, 'filas' => 0]],
                'validacion' => [
                    'motivo'    => 'columnas',
                    'esperadas' => [$nombre],
                    'libro'     => [$nombre],
                    'columnas'  => [['hoja' => $nombre, 'headerRow' => $config['headerRow'], 'columnas' => $columnas, 'faltan' => $faltan['criticas']]],
                    'cargadas'  => []
                ]
            ];
        }

        $primera = columnLetter($config['startIndex']);
        $ultima  = columnLetter($config['startIndex'] + count($config['columns']) - 1);

        $steps[] = step(
            'Validar columnas de "' . $nombre . '"',
            empty($faltan['menores']) ? 'ok' : 'warn',
            empty($faltan['menores'])
                ? count($config['columns']) . ' columnas ' . $primera . ':' . $ultima
                : count($config['columns']) . ' columnas ' . $primera . ':' . $ultima . ' · ' . $this->resumenMenores($faltan['menores'])
        );

        $mapa = $this->mapaIndices($columnas, $config);

        return $this->cargarPorBloques($ruta, $nombre, $config, $mapa, $total, $ctx, $steps, $modo);
    }

    // Abre el lote de UN mes de la carga de comandas y, si el modo es reemplazo,
    // limpia antes ese periodo.
    //
    // El borrado va aqui y no al principio porque el mes lo dice el archivo, no el
    // filtro: limpiar por adelantado el periodo de los selectores borraba un mes
    // que la carga a lo mejor ni toca.
    //
    // `row_count` y `control_total` NO se declaran y no es un olvido: se sabran al
    // terminar de leer, y `Utileria::sql` convierte el cero en NULL —compara con
    // `==`, y en PHP `0 == ''` es cierto— contra tres columnas NOT NULL. Omitidas
    // toman su DEFAULT 0, que es el valor que se queria.
    private function abrirLoteComandas($nombre, $ctx, $total, $modo) {
        $reemplazadas = $modo === 'reemplazo'
            ? $this->borrarPeriodo($nombre, 'detail', $ctx)
            : 0;

        $batch = $this->util->sql([
            'file_name'    => $ctx['fileName'],
            'sheet_name'   => $nombre,
            'period_year'  => $ctx['anio'],
            'period_month' => $ctx['mes'],
            'source_rows'  => $total,
            'created_at'   => date('Y-m-d H:i:s'),
            'user_name'    => $ctx['userName'] ?? '',
            'user_id'      => $ctx['userId'] ?? null,
            'branch_id'    => $ctx['branchId']
        ]);

        if (!$this->mdl->createImportBatch($batch)) return null;

        $max = $this->mdl->getMaxImportBatchId();

        return [
            'id'           => (int) $max[0]['id'],
            'reemplazadas' => $reemplazadas
        ];
    }

    // El ciclo. Crea los lotes, recorre el archivo de a bloques insertando lo que
    // lee, y al terminar resuelve los enlaces que necesitan verlo todo.
    private function cargarPorBloques($ruta, $nombre, $config, $mapa, $total, $ctx, $steps, $modo) {
        /*
            Los dos modos son EXCLUYENTES y hay que elegir uno, no encender los dos.

            Con los dos a la vez la carga se muerde: `borrarPeriodo` borra el lote
            anterior, pero `fk_detail_sale_batch` es ON DELETE SET NULL, asi que
            sus renglones no se van —se quedan con `import_batch_id` en nulo—. Un
            renglon suelto asi ya no lo ve `listDetailPdvLoaded`, que pregunta por
            lote, y el filtro incremental lo da por nuevo. Medido: 8 719 renglones
            se volvieron 17 438.

            De ahi el orden de abajo: en reemplazo se borra Y NO se filtra; en
            incremental se filtra Y NO se borra.
        */
        // Los lotes de la carga, uno por mes que traiga el archivo: 'YYYY-MM' =>
        // ['id', 'insertadas', 'control']. Nacen bajo demanda, la primera vez que
        // aparece una fila de ese mes, asi que un archivo de un solo mes abre un
        // solo lote y se comporta igual que siempre.
        //
        // El periodo NO se puede resolver antes de leer: el archivo se recorre por
        // bloques justamente porque no cabe entero, y hasta que no se lee una fila
        // no se sabe de que mes es.
        $lotes        = [];
        $reemplazadas = 0;

        // Lo unico que cruza de un bloque al siguiente. Todo diminuto: 174
        // productos, 9 meseros y un punado de contadores.
        $catalogo   = $this->mapaProductos($ctx);
        $vistos     = [];
        $leidas     = 0;
        $insertadas = 0;
        $bloques    = 0;

        $desde = $config['headerRow'] + 1;

        for (; $desde <= $total; $desde += self::FILAS_POR_BLOQUE) {
            // Cada bloque estrena su propio presupuesto de tiempo.
            //
            // El reloj de PHP mide la peticion entera, y leer por bloques no la
            // acorta: la abarata en memoria, pero cada vuelta vuelve a abrir el
            // .xlsx completo —descomprimir el zip y parsear su XML— porque el
            // lector no sabe continuar donde lo dejo. Un archivo de 24 000 filas
            // son doce aperturas, y con el limite del php.ini en 120 s el proceso
            // moria a media carga: sin respuesta que devolver, la pantalla solo
            // podia decir "no se pudo leer el archivo".
            //
            // El limite no se quita, se renueva por bloque: un bloque que se
            // cuelgue sigue muriendo, pero un archivo grande deja de morir por ser
            // grande.
            set_time_limit(self::SEGUNDOS_POR_BLOQUE);

            $this->apuntarPaso($ctx, 'bloque', [
                'bloque'  => $bloques + 1,
                'bloques' => (int) ceil(($total - $config['headerRow']) / self::FILAS_POR_BLOQUE),
                'leidas'  => $leidas
            ]);

            $doc   = $this->leerBloque($ruta, $nombre, $desde, self::FILAS_POR_BLOQUE);
            $hoja  = $doc->getSheetByName($nombre);
            $hasta = min($desde + self::FILAS_POR_BLOQUE - 1, $total);
            $filas = [];

            for ($f = $desde; $f <= $hasta; $f++) {
                $fila = $this->filaDeHoja($hoja, $f, $config, $mapa);
                if ($fila === null) continue;

                $filas[] = $fila;
                $leidas++;
            }

            if (!empty($filas)) {
                // En reemplazo el periodo quedo vacio y todo lo del archivo entra,
                // corregido incluido. Filtrar aqui ademas dejaria fuera justo lo
                // que se venia a corregir.
                $nuevas = $modo === 'reemplazo'
                    ? $filas
                    : $this->comandasNuevas($filas, $vistos, $ctx);

                foreach ($this->agruparPorPeriodo($nuevas, $config, $ctx) as $clave => $delMes) {
                    if (!isset($lotes[$clave])) {
                        $abierto = $this->abrirLoteComandas($nombre, $this->ctxDelPeriodo($ctx, $clave), $total, $modo);

                        if ($abierto === null) {
                            $steps[] = step('Guardar en base', 'error', 'No se pudo abrir el lote de carga');

                            return ['status' => 500, 'message' => 'No se pudo abrir el lote de carga', 'steps' => $steps, 'hojas' => []];
                        }

                        $reemplazadas  += $abierto['reemplazadas'];
                        $lotes[$clave]  = ['id' => $abierto['id'], 'insertadas' => 0, 'control' => 0];
                    }

                    $entraron = $this->guardarComandas($delMes, $lotes[$clave]['id'], $ctx, $catalogo);

                    $insertadas                  += $entraron;
                    $lotes[$clave]['insertadas'] += $entraron;

                    foreach ($delMes as $v) $lotes[$clave]['control'] += numVal($v[$config['controlIndex']]);
                }
            }

            // El bloque se suelta ANTES de pedir el siguiente, o los dos coinciden
            // en memoria y la ventaja de leer por partes se pierde.
            $this->soltarLibro($doc);
            unset($doc, $hoja, $filas);
            $bloques++;
        }

        $steps[] = step(
            'Leer "' . $nombre . '"',
            $leidas > 0 ? 'ok' : 'error',
            number_format($leidas) . ' filas en ' . $bloques . ' bloque(s) de ' . number_format(self::FILAS_POR_BLOQUE)
        );

        if ($reemplazadas > 0) {
            $steps[] = step(
                'Sobreescribir "' . $nombre . '"',
                'ok',
                number_format($reemplazadas) . ' renglones de la carga anterior del periodo'
            );
        }

        if ($insertadas === 0) {
            $this->borrarPaso($ctx);

            foreach ($lotes as $lote) {
                $this->mdl->deleteImportBatchById($this->util->sql(['id' => $lote['id']], 1));
            }

            $steps[] = step('Guardar en base', $this->omitidos > 0 ? 'ok' : 'error',
                $this->omitidos > 0
                    ? 'Todas las cuentas del archivo ya estaban cargadas'
                    : 'No entro ninguna fila');

            return [
                'status'  => 200,
                'message' => $this->omitidos > 0
                    ? 'El archivo ya estaba cargado: no habia cuentas nuevas'
                    : 'No se guardo ninguna fila',
                'steps'   => $steps,
                'hojas'   => [[
                    'nombre'  => $nombre,
                    'estado'  => 'ok',
                    'detalle' => $this->omitidos > 0
                        ? 'nada nuevo: las ' . number_format($this->omitidos) . ' cuentas del archivo ya estaban cargadas'
                        : 'no entro ningun renglon',
                    'filas'        => 0,
                    'leidas'       => $leidas,
                    'insertadas'   => 0,
                    'omitidos'     => $this->omitidos,
                    'reemplazadas' => $reemplazadas,
                    'rechazadas'   => $this->rechazadas
                ]]
            ];
        }

        // Con las filas dentro, lo que queda es cruzarlas. La barra ya esta al 100 %
        // y el modal sigue trabajando: se apunta para poder decirlo.
        $this->apuntarPaso($ctx, 'enlaces');

        // El catalogo que nacio con esta carga ya esta en base: ahora se resuelven
        // los enlaces del renglon. Los tres van en una sentencia por lote, no una
        // por fila: son miles de renglones y no terminarian dentro de la peticion.
        $this->productos = $this->sembrarProductos($catalogo, $ctx);

        // Cada renglon queda colgado del folio de su venta, lote por lote: el
        // enlace se resuelve por `import_batch_id`, asi que con la carga repartida
        // en varios meses hay que lanzarlo en todos. Recorrer solo el ultimo dejaba
        // los renglones de los demas meses sin su ticket, esperando una carga que
        // ya habia pasado.
        $sueltos = 0;
        $tickets = 0;

        foreach ($lotes as $lote) {
            $this->mdl->linkDetailProductByBatch([$ctx['branchId'], $this->posId($ctx), $lote['id']]);

            $this->mdl->linkDetailToSaleByPdv([$ctx['branchId'], $lote['id']]);

            // Los que se ligaron son los del lote menos los que quedaron sueltos. No
            // se toma del UPDATE: `_CUD` devuelve el booleano de `execute()` y
            // castearlo anunciaba "1 ligado" con 448 ligados.
            $huerfanos = $this->mdl->countOrphanDetail([$lote['id']]);

            $sueltos += (int) ($huerfanos[0]['total'] ?? 0);
            $tickets += (int) ($huerfanos[0]['tickets'] ?? 0);

            $this->mdl->updateImportBatchRows([$lote['insertadas'], $lote['control'], $this->omitidos, $lote['id']]);
        }

        $this->ligados = max(0, $insertadas - $sueltos);

        $steps[] = step('Guardar en base', 'ok',
            number_format($insertadas) . ' renglones' .
            ($this->productos > 0 ? ' · ' . number_format($this->productos) . ' productos nuevos al catalogo' : '') .
            ($this->meseros   > 0 ? ' · ' . number_format($this->meseros) . ' meseros nuevos' : '') .
            ($this->ligados   > 0 ? ' · ' . number_format($this->ligados) . ' ligados a su venta' : '') .
            ($this->omitidos  > 0 ? ' · ' . number_format($this->omitidos) . ' cuentas ya cargadas' : '')
        );

        // Un renglon sin venta no es un fallo: el reporte de ventas de ese dia
        // puede subirse despues y engancharlo. Pero tiene que decirse, o el
        // usuario cree que cargo completo.
        if ($sueltos > 0) {
            $steps[] = step('Cruzar con las ventas', 'warn',
                number_format($sueltos) . ' renglones de ' . number_format($tickets) .
                ' cuenta(s) esperan su venta · se enlazan solas al cargar el reporte de ventas de esos dias');
        }

        $this->borrarPaso($ctx);

        return [
            'status'  => 200,
            'message' => number_format($insertadas) . ' renglones de detalle cargados',
            'steps'   => $steps,
            'hojas'   => [[
                'nombre'  => $nombre,
                'estado'  => 'ok',
                'detalle' => number_format($insertadas) . ' renglones nuevos'
                           . ($this->omitidos > 0 ? ' · ' . number_format($this->omitidos) . ' cuentas ya estaban' : '')
                           . ($reemplazadas   > 0 ? ' · ' . number_format($reemplazadas) . ' de la carga anterior se reemplazaron' : '')
                           . ' · ' . number_format($leidas) . ' filas leidas',
                'filas'        => $insertadas,
                'leidas'       => $leidas,
                'insertadas'   => $insertadas,
                'omitidos'     => $this->omitidos,
                'reemplazadas' => $reemplazadas,
                'rechazadas'   => $this->rechazadas
            ]]
        ];
    }

    /*
        La revision previa, SIN abrir el libro. Vale para cualquier pestana.

        Dice lo mismo que `inspeccionarLibro` —de que pestana es el archivo y si
        sus columnas cuadran— leyendo solo lo justo: los nombres de las hojas, que
        `listWorksheetInfo` da sin cargar nada, y la fila de encabezados de cada
        una. Ninguna revision necesito nunca el libro entero; solo se hacia asi
        porque era lo que habia.

        LA PESTANA NO DECIDE. Manda el contenido: si el archivo trae las hojas de
        otra pestana, se devuelve `otro-tab` con la sugerida y el modulo se ofrece
        a cargarlo ahi. Es el mismo contrato que ya usa el importador de Soft, y es
        lo que permite soltar cualquier export en cualquier pestana.

        Abrir el libro para revisarlo tenia dos costes: el archivo de comandas
        moria de memoria antes de llegar a la carga —«Allowed memory size
        exhausted»— y, para evitarlo, la revision acababa preguntando por la
        pestana en vez de por el archivo.
    */
    function inspeccionarArchivo($ruta, $ctx) {
        $contrato = $this->contrato();
        $tipo     = isset($ctx['tipo']) ? $ctx['tipo'] : '';

        // Un archivo que PhpSpreadsheet no reconoce lanzaba aqui, y como esta es la
        // PRIMERA peticion del proceso —la revision previa—, la excepcion mataba la
        // respuesta entera: el navegador recibia la pagina de error de PHP en vez de
        // JSON y la pantalla solo podia decir "no se pudo procesar". El motivo se
        // atrapa y viaja como respuesta, que es lo unico con lo que el usuario puede
        // arreglar su archivo.
        try {
            $lector = \PhpOffice\PhpSpreadsheet\IOFactory::createReaderForFile($ruta);
            $hojas  = $this->hojasDelArchivo($lector, $ruta);
        } catch (Exception $e) {
            return [
                'status'  => 400,
                'destino' => $tipo,
                'movido'  => false,
                'hojas'   => [],
                'message' => 'No se pudo leer el archivo: ' . $this->mdl->motivoLectura($e->getMessage())
            ];
        }

        $notas = $this->notasDelPeriodo($ctx);

        if ($notas) {
            return [
                'status'     => 200,
                'destino'    => $tipo,
                'movido'     => false,
                'hojas'      => [],
                'validacion' => $notas
            ];
        }

        $presentes = $this->hojasPresentes($contrato, $hojas, $tipo);
        $destino   = $tipo;
        $movido    = false;

        // Ninguna hoja de esta pestana: puede que el archivo sea de otra.
        //
        // El archivo que pertenece a otra pestana SE SIGUE REVISANDO, contra la suya:
        // es el mismo criterio que ya usa el importador de Soft, y es lo que evita
        // que este camino se salte el resto de la revision.
        //
        // Sin eso, el de comandas subido desde el modal —que siempre pregunta desde
        // el reporte de ventas— salia por aqui y nunca llegaba a la comprobacion del
        // periodo: se cargaba un archivo de agosto con el filtro en septiembre sin
        // decir una palabra, mientras el de ventas si avisaba.
        $otroTab = null;

        if (empty($presentes)) {
            $otro = tabDelLibro($contrato, $hojas, $tipo);

            if ($otro) {
                $destino   = $otro['tab'];
                $movido    = true;
                $presentes = $this->hojasPresentes($contrato, $hojas, $destino);

                // Se guarda para devolverlo si la revision no encuentra nada peor:
                // que el archivo vaya en otra pestana sigue siendo lo que hay que
                // decir cuando sus columnas y su periodo estan bien.
                $otroTab = [
                    'motivo'    => 'otro-tab',
                    'sugerido'  => $otro['tab'],
                    'esperadas' => hojasDelTab($contrato, $tipo),
                    'libro'     => $hojas,
                    'columnas'  => [],
                    'cargadas'  => []
                ];
            }
        }

        if (empty($presentes)) {
            return [
                'status'  => 200,
                'destino' => $tipo,
                'movido'  => false,
                'hojas'   => [],
                'validacion' => [
                    'motivo'    => 'hojas',
                    'esperadas' => hojasDelTab($contrato, $tipo),
                    'libro'     => $hojas,
                    'columnas'  => [],
                    'cargadas'  => []
                ]
            ];
        }

        // Las columnas se revisan hoja por hoja, leyendo solo su fila de
        // encabezados. Igual que en el camino normal, aqui solo se objeta lo que
        // DETIENE la carga.
        //
        // El mapa de cada hoja se guarda: con el se sabe en que columna quedo la
        // fecha, y sin eso no se puede preguntar de que meses es el archivo.
        $malas  = [];
        $mapas  = [];

        foreach ($presentes as $nombre) {
            $config   = $contrato[$nombre];
            $doc      = $this->leerBloque($ruta, $nombre, $config['headerRow'], 1);
            $columnas = $this->validarEncabezados($doc->getSheetByName($nombre), $config);
            $faltan   = $this->columnasMalas($columnas, $config);

            $this->soltarLibro($doc);
            unset($doc);

            if (empty($faltan['criticas'])) {
                $mapas[$nombre] = $this->mapaIndices($columnas, $config);
                continue;
            }

            $malas[] = [
                'hoja'      => $nombre,
                'headerRow' => $config['headerRow'],
                'columnas'  => $columnas,
                'faltan'    => $faltan['criticas']
            ];
        }

        if (!empty($malas)) {
            return [
                'status'  => 200,
                'destino' => $destino,
                'movido'  => $movido,
                'hojas'   => [],
                'validacion' => [
                    'motivo'    => 'columnas',
                    'esperadas' => $presentes,
                    'libro'     => $hojas,
                    'columnas'  => $malas,
                    'cargadas'  => []
                ]
            ];
        }

        // De que meses es el archivo, ANTES de escribir nada.
        //
        // El camino del libro cargado ya lo comprobaba, pero este no: la hoja de
        // comandas no cabe en memoria y la revision se conformaba con mirar sus
        // encabezados. Resultado: el reporte de ventas avisaba de sus meses y el de
        // comandas no, aunque los dos se reparten igual.
        //
        // La lectura recorre el archivo entero pero solo dos columnas, que es lo que
        // la vuelve viable aqui (ver `fechasDelArchivo`).
        $periodo = $this->periodoDelArchivo($ruta, $presentes, $contrato, $mapas, $ctx);
        $ajeno   = $periodo ? $periodo['ajeno'] : null;
        $reparto = $periodo ? $periodo['reparto'] : [];

        // El periodo manda sobre la pestana: los dos avisos podrian salir a la vez y
        // solo cabe uno, asi que gana el que impide cargar. Que el archivo vaya en
        // otra pestana se resuelve solo —el modulo lo lleva a la suya—; que sea de
        // otro mes hay que preguntarlo.
        if ($ajeno) {
            return [
                'status'     => 200,
                'destino'    => $destino,
                'movido'     => $movido,
                'hojas'      => [],
                'validacion' => $ajeno
            ];
        }

        // El reparto acompana a la revision buena: aunque el archivo sea del mes que
        // toca, la pantalla necesita saber si trae mas de uno para poder preguntar
        // cuales se cargan.
        $revision = [
            'status'  => 200,
            'destino' => $destino,
            'movido'  => $movido,
            'hojas'   => $presentes,
            'suyas'   => hojasDelTab($contrato, $destino),
            'libro'   => $hojas,
            'reparto' => $reparto
        ];

        if ($otroTab) $revision['validacion'] = $otroTab;

        return $revision;
    }

    /*
        Un bloque de filas de UNA hoja. El resto del libro no se instancia siquiera.

        Devuelve el LIBRO y no la hoja, aunque quien llama solo quiera la hoja: una
        hoja guarda una referencia a su libro y el libro a sus hojas, y ese ciclo
        impide que PHP libere nada al soltar la variable. Sin el `soltarLibro` que
        va despues, el segundo bloque arranca con la memoria del primero encima y
        el tercero revienta —medido: 93 MB en el bloque 3 de 5—.
    */
    // Si el archivo pertenece al periodo al que se esta subiendo, leyendo sus
    // fechas sin cargar el libro.
    //
    // Es el gemelo de `fechasAjenas` para el camino ligero. Se pregunta por la
    // primera hoja que tenga fecha propia: en el reporte de ventas es el detalle
    // por forma de pago y en el de comandas el detalle de ventas, y en los dos esa
    // hoja es la que trae los movimientos.
    private function periodoDelArchivo($ruta, $presentes, $contrato, $mapas, $ctx) {
        $mes  = isset($ctx['mes'])  ? (int) $ctx['mes']  : 0;
        $anio = isset($ctx['anio']) ? (int) $ctx['anio'] : 0;

        if ($mes < 1 || $anio < 2000) return null;

        foreach ($presentes as $nombre) {
            $config = $contrato[$nombre];

            if (!isset($config['dateIndex']) || !isset($mapas[$nombre])) continue;

            $fechas = $this->fechasDelArchivo($ruta, $nombre, $config, $mapas[$nombre]);

            if (empty($fechas)) continue;

            $conteo = conteoDeFechas($fechas, $mes, $anio);
            $ajeno  = periodoAjeno($conteo, $mes, $anio);

            if ($ajeno) $ajeno['hoja'] = $nombre;

            // El reparto viaja SIEMPRE, se objete o no.
            //
            // Cuando el archivo es del mes del filtro no hay nada que reprochar,
            // pero sigue habiendo algo que decidir si trae varios meses: cuales se
            // cargan. Devolverlo solo junto a la objecion dejaba esa eleccion a
            // merced de que el filtro coincidiera, que no tiene que ver con ella.
            //
            // La hoja con fechas ya dijo lo suyo: las demas del mismo libro son del
            // mismo export y preguntarlas seria abrir el archivo otra vez para
            // confirmar lo que ya se sabe.
            return [
                'ajeno'   => $ajeno,
                'reparto' => repartoPorMes($conteo, $mes, $anio)
            ];
        }

        return null;
    }

    // Las fechas de TODAS las filas de una hoja, sin abrir el libro entero.
    //
    // Se leen dos columnas: la clave, que dice si la fila es dato —el pie de
    // totales trae importe pero no clave— y la fecha. Es lo mismo que comprueba
    // `columnaDeFechas` en el camino del libro cargado, con la diferencia de que
    // aqui el libro no cabria.
    //
    // La fila de encabezados se salta: su celda de fecha dice "Fecha de operacion"
    // y contaria como un movimiento sin mes.
    private function fechasDelArchivo($ruta, $nombre, $config, $mapa) {
        $claveIdx = array_key_exists($config['keyIndex'],  $mapa) ? $mapa[$config['keyIndex']]  : null;
        $fechaIdx = array_key_exists($config['dateIndex'], $mapa) ? $mapa[$config['dateIndex']] : null;

        if ($claveIdx === null || $fechaIdx === null) return [];

        $claveCol = columnLetter($claveIdx);
        $fechaCol = columnLetter($fechaIdx);

        $lector = \PhpOffice\PhpSpreadsheet\IOFactory::createReaderForFile($ruta);
        $lector->setReadDataOnly(true);
        $lector->setLoadSheetsOnly($nombre);
        $lector->setReadFilter(filtroDeColumnas($nombre, [$claveCol, $fechaCol], $config['headerRow'] + 1));

        $doc  = $lector->load($ruta);
        $hoja = $doc->getSheetByName($nombre);

        $__row = [];

        for ($fila = $config['headerRow'] + 1; $fila <= $hoja->getHighestRow(); $fila++) {
            if (trim((string) $hoja->getCell($claveCol . $fila)->getValue()) === '') continue;

            $__row[] = trim((string) $hoja->getCell($fechaCol . $fila)->getValue());
        }

        $this->soltarLibro($doc);
        unset($doc, $hoja);

        return $__row;
    }

    private function leerBloque($ruta, $nombre, $desde, $filas) {
        $lector = \PhpOffice\PhpSpreadsheet\IOFactory::createReaderForFile($ruta);
        $lector->setReadDataOnly(true);
        $lector->setLoadSheetsOnly($nombre);
        $lector->setReadFilter(filtroDeBloque($nombre, $desde, $filas));

        return $lector->load($ruta);
    }

    // Rompe el ciclo hoja <-> libro para que el recolector pueda llevarse el
    // bloque que ya se proceso. Es lo que mantiene la memoria plana.
    private function soltarLibro($doc) {
        if ($doc === null) return;

        $doc->disconnectWorksheets();
    }

    private function hojasDelArchivo($lector, $ruta) {
        $__row = [];
        foreach ($lector->listWorksheetInfo($ruta) as $info) $__row[] = $info['worksheetName'];

        return $__row;
    }

    // Una fila del Excel con los indices del contrato. Devuelve null cuando la fila
    // no es dato: sin fecha en `dateIndex` es el pie de totales o una fila en
    // blanco, el mismo corte que usa el resto del importador.
    private function filaDeHoja($hoja, $numero, $config, $mapa) {
        $fila = [];

        // `mapaIndices` ya devuelve el indice ABSOLUTO de la columna (startIndex
        // incluido). Volver a sumarlo aqui correria la lectura dos columnas y el
        // renglon saldria con los datos del vecino.
        foreach ($mapa as $i => $indiceReal) {
            if ($indiceReal === null) { $fila[$i] = null; continue; }

            $fila[$i] = $hoja->getCell(columnLetter($indiceReal) . $numero)->getValue();
        }

        if (cleanDate($fila[$config['dateIndex']] ?? '') === null) return null;
        if (trim((string) ($fila[$config['keyIndex']] ?? '')) === '') return null;

        $fila['source_row'] = $numero;

        return $fila;
    }

    // Las comandas que no estan ya en base. Se pregunta por bloque y no de una vez
    // por la misma razon que movimientosConocidos: un IN con miles de marcadores
    // revienta el limite de PDO.
    private function comandasNuevas($filas, &$vistos, $ctx) {
        $pdvs = [];
        foreach ($filas as $v) {
            $pdv = trim((string) $v[4]);
            if ($pdv !== '' && !isset($vistos[$pdv])) $pdvs[$pdv] = true;
        }

        $cargados = [];
        if (!empty($pdvs)) {
            foreach (array_chunk(array_keys($pdvs), 400) as $chunk) {
                foreach ($this->mdl->listDetailPdvLoaded(array_merge($chunk, [$ctx['branchId']])) as $d) {
                    $cargados[$d['sale_folio']] = true;
                }
            }
        }

        foreach ($pdvs as $pdv => $x) $vistos[$pdv] = isset($cargados[$pdv]);

        $__row = [];
        foreach ($filas as $v) {
            $pdv = trim((string) $v[4]);

            if ($pdv !== '' && !empty($vistos[$pdv])) { $this->omitidos++; continue; }

            $__row[] = $v;
        }

        return $__row;
    }

    /*
        De filas del Excel a renglones de comanda.

        Dos decisiones que solo se entienden con el archivo medido delante:

        EL IMPORTE sale de uno de los cuatro bloques de montos segun «Accion». Con
        el bloque fijo, las 34 anulaciones y las 9 cancelaciones entrarian en cero
        —sus columnas de venta vienen vacias— y desapareceria del historial lo que
        se tiro.

        EL NOMBRE del producto NO es la columna «Descripcion», aunque lo parezca:
        ahi el capturista escribe texto libre («PEDIDO DEL ING LUIS AUTORIZO EL
        CHEF») y tiene 1 267 valores distintos contra 157 platillos reales. El
        nombre esta en «Platillo / Articulo», salvo cuando la fila es un
        modificador: entonces «Platillo» trae al PADRE y el nombre esta en
        «Modificador».
    */
    private function guardarComandas($rows, $batchId, $ctx, &$catalogo) {
        if (empty($rows)) return 0;

        $data = [];

        foreach ($rows as $v) {
            $esMod  = claveNombre($v[31]) === 'si';
            $clave  = trim((string) $v[29]);
            $nombre = limpiarNombre($esMod ? $v[28] : $v[27]);
            $padre  = $esMod ? trim((string) $v[27]) : '';

            // El catalogo se acumula mientras se lee y se siembra al final: son 174
            // productos en todo el archivo y caben de sobra en memoria.
            if ($clave !== '' && !isset($catalogo[$clave])) {
                $catalogo[$clave] = [
                    'name'        => $nombre,
                    'is_modifier' => $esMod ? 1 : 0,
                    'group_type'  => limpiarNombre($v[24]),
                    'group_name'  => limpiarNombre($v[25]),
                    'price'       => numVal($v[20]),
                    'nuevo'       => true
                ];
            }

            $data[] = [
                'sale_folio'          => trim((string) $v[4]),
                'table_number'        => trim((string) $v[8]) !== '' ? trim((string) $v[8]) : null,
                'waiter_code'         => null,
                'product_code'        => $clave !== '' ? $clave : null,
                'parent_product_name' => $padre !== '' ? $padre : null,
                'description'         => limpiarNombre($v[26]),
                'action'              => limpiarNombre($v[12]),
                'capture_terminal'    => limpiarNombre($v[33]),
                'is_modifier'         => $esMod ? 1 : 0,
                'source_row'          => $v['source_row'],
                'quantity'            => numVal($v[18]),
                'unit_price'          => numVal($v[20]),
                'discount_percent'    => numVal($v[17]),
                'amount'              => $this->importeDelRenglon($v),
                'closed_at'           => cleanDate($v[2]),
                'captured_at'         => cleanDate($v[32]),
                'import_batch_id'     => $batchId
            ];
        }

        return $this->insertarPorBloques($data, 'detail');
    }

    // El bloque de montos que corresponde a la accion de la fila.
    private function importeDelRenglon($v) {
        $accion = claveNombre($v[12]);

        if (strpos($accion, 'anulacion')   === 0) return numVal($v[45]);
        if (strpos($accion, 'cancelacion') === 0) return numVal($v[41]);
        if (strpos($accion, 'cortesia')    === 0) return numVal($v[41]);

        return numVal($v[37]);
    }

    // El catalogo del POS que opera, indexado por clave.
    private function mapaProductos($ctx) {
        $__row = [];

        foreach ($this->mdl->listProductByPos([$ctx['branchId'], $this->posId($ctx)]) as $p) {
            $__row[$p['code']] = [
                'name'        => $p['name'],
                'is_modifier' => (int) $p['is_modifier'],
                'nuevo'       => false
            ];
        }

        return $__row;
    }

    // Da de alta lo que el archivo trajo y el catalogo no tenia. El precio entra
    // como referencia: el que de verdad se cobro vive en el renglon, porque hay
    // productos que se venden a varios precios.
    private function sembrarProductos($catalogo, $ctx) {
        $data = [];

        foreach ($catalogo as $code => $p) {
            if (empty($p['nuevo'])) continue;

            $data[] = [
                'code'        => $code,
                'name'        => $p['name'],
                'is_modifier' => $p['is_modifier'],
                'is_bridge'   => 0,
                'group_type'  => $p['group_type'] ?? null,
                'group_name'  => $p['group_name'] ?? null,
                'price'       => $p['price'] ?? 0,
                'branch_id'   => $ctx['branchId'],
                'pos_id'      => $this->posId($ctx)
            ];
        }

        if (empty($data)) return 0;

        return $this->insertarCatalogo($data, 'product');
    }

    // El POS de la sucursal. Viaja en el contexto cuando el controlador lo sabe;
    // si no, se pregunta.
    private function posId($ctx) {
        if (isset($ctx['posId'])) return (int) $ctx['posId'];

        $ls = $this->mdl->getPosId([$ctx['branchId']]);

        return isset($ls[0]['pos_id']) ? (int) $ls[0]['pos_id'] : null;
    }
}

// Complements

// La llave con la que se cruzan los nombres del POS contra el catalogo. Sin
// acentos, sin mayusculas y sin espacios de mas: «RAMÓN  PÉREZ» y «Ramon Perez»
// son la misma persona y el POS los escribe de las dos formas entre exports.
//
// Reusa normalizeHeader porque hace exactamente eso, y ademas quita la puntuacion
// que a veces cuelga de los nombres capturados a mano.
function claveNombre($texto) {
    return normalizeHeader((string) $texto);
}

// El nombre TAL COMO se guarda: se respetan mayusculas y acentos del POS —es lo
// que se va a imprimir en el ticket— pero se colapsan los espacios, que es lo
// unico que crearia un duplicado que el UNIQUE si dejaria pasar.
function limpiarNombre($texto) {
    return trim(preg_replace('/\s+/', ' ', (string) $texto));
}

// Las banderas del POS llegan como texto y no siempre en el mismo idioma.
function banderaDe($valor) {
    $limpio = strtolower(trim((string) $valor));

    return in_array($limpio, ['1', 'si', 'sí', 'true', 'x', 'yes'], true) ? 1 : 0;
}

function valorDe($resumen, $clave) {
    return isset($resumen[$clave]) ? $resumen[$clave] : 0;
}

// El inverso de columnLetter: 'A' -> 1, 'R' -> 18, 'AA' -> 27. La radiografia lo
// necesita para saber hasta donde leer una hoja que no conoce.
function columnIndex($letra) {
    $letra = strtoupper(preg_replace('/[^A-Za-z]/', '', (string) $letra));
    $total = 0;

    for ($i = 0; $i < strlen($letra); $i++) {
        $total = $total * 26 + (ord($letra[$i]) - 64);
    }

    return $total;
}

/*
    El filtro que hace posible leer un archivo mas grande que la memoria.

    PhpSpreadsheet pregunta por CADA celda del XML si debe instanciarla. Las que
    responden `false` se leen y se tiran sin convertirse en objeto, que es donde
    esta todo el costo: 420 000 celdas convertidas son 160 MB, y las de un bloque
    de 2 000 filas son 54.

    Va en una funcion y como clase ANONIMA, no como clase con nombre al final del
    archivo, porque implementa una interfaz de PhpSpreadsheet y el vendor se carga
    BAJO DEMANDA: declararla al incluir este archivo obligaria a tener la libreria
    presente para listar cargas o borrar un lote, que hoy funcionan sin ella.

    El nombre de la hoja llega vacio en algunos formatos, y ahi no se puede
    descartar por hoja: se deja pasar y decide el rango de filas. Descartar por
    defecto perderia el archivo entero.
*/
function filtroDeBloque($hoja, $desde, $filas) {
    return new class($hoja, $desde, $filas) implements \PhpOffice\PhpSpreadsheet\Reader\IReadFilter {

        private $hoja;
        private $desde;
        private $hasta;

        public function __construct($hoja, $desde, $filas) {
            $this->hoja  = $hoja;
            $this->desde = $desde;
            $this->hasta = $desde + $filas - 1;
        }

        public function readCell($column, $row, $worksheetName = '') {
            if ($worksheetName !== '' && $worksheetName !== $this->hoja) return false;

            return $row >= $this->desde && $row <= $this->hasta;
        }
    };
}

/*
    El mismo filtro, pero al reves: TODAS las filas y solo unas columnas.

    Es lo que permite preguntarle a un archivo de 4.5 MB de que meses es sin
    abrirlo entero. La hoja de comandas son 420 000 celdas y no cabe en memoria,
    pero sus columnas de clave y de fecha son 48 000: una novena parte, que entra
    de sobra y en una sola pasada.

    La alternativa era recorrerlo por bloques como hace la carga, y ahi el coste no
    esta en las celdas sino en abrir el archivo: doce aperturas de un xlsx que hay
    que descomprimir y parsear entero cada vez, contra una sola de esta.

    Va como clase anonima dentro de una funcion por el mismo motivo que la de
    arriba: el vendor se carga bajo demanda y declararla al incluir el archivo
    obligaria a tener PhpSpreadsheet presente para listar cargas o borrar un lote.
*/
function filtroDeColumnas($hoja, $columnas, $desde) {
    return new class($hoja, $columnas, $desde) implements \PhpOffice\PhpSpreadsheet\Reader\IReadFilter {

        private $hoja;
        private $columnas;
        private $desde;

        public function __construct($hoja, $columnas, $desde) {
            $this->hoja     = $hoja;
            $this->columnas = array_flip($columnas);
            $this->desde    = $desde;
        }

        public function readCell($column, $row, $worksheetName = '') {
            if ($worksheetName !== '' && $worksheetName !== $this->hoja) return false;
            if ($row < $this->desde) return false;

            return isset($this->columnas[$column]);
        }
    };
}
