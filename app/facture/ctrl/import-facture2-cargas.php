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

    // Movimientos que ya estaban en base y no se volvieron a cargar, y cuantos de
    // ellos ademas traen un total distinto del que se guardo en su dia.
    private $omitidos   = 0;
    private $difieren   = 0;

    // Suma de control de lo que quedo en base, que en una carga incremental no es
    // la del archivo completo.
    private $controlInsertado = 0;

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
            ]
        ];
    }

    /*
        Pestanas que el modulo YA muestra aunque su contrato de hojas todavia no
        exista. Wansoft va a exportar comandas, pero ese archivo aun no se ha
        medido: no se sabe como se llaman sus hojas ni en que fila arrancan sus
        encabezados, y adivinarlo seria escribir un contrato que la primera carga
        real tiraria a la basura.

        Mientras tanto la pestana no esta muerta: acepta el archivo y lo
        RADIOGRAFIA —dice que hojas trae, en que fila estan sus encabezados y
        cuales son— sin guardar una sola fila. Con esa lectura se cierra el
        contrato de verdad, medido y no supuesto, que es como se escribio el resto
        de este archivo.
    */
    function tabsReservados() {
        return [
            'commands' => [
                'titulo'    => 'Archivo de comandas',
                'subtitulo' => 'Renglones del POS: que se consumio, mesa, mesero y tiempos. El layout de Wansoft todavia no se ha medido, asi que por ahora el archivo se lee para radiografiarlo: el modulo dira que hojas y columnas trae, sin guardar nada.',
                'esperado'  => 'por definir',
                'ejemplo'   => 'comandas',
                'patron'    => '.',
                'formato'   => 'XLS · XLSX',
                'pendiente' => true
            ]
        ];
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
        }

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
                'detalle' => $vacia
                    ? 'columnas ' . $primera . ':' . $ultima . ' · sin movimientos'
                    : ($repetida
                        ? 'columnas ' . $primera . ':' . $ultima . ' · ' . number_format($carga['omitidos']) . ' movimientos ya procesados'
                        : 'columnas ' . $primera . ':' . $ultima . ' · fila ' . ($config['headerRow'] + 1) . ' · ' . number_format($carga['insertadas']) . ' de ' . number_format($carga['leidas']) . ' filas'),
                'filas'   => $carga['insertadas'],
                'leidas'  => $carga['leidas'],
                // Un archivo ya procesado esta al 100 %: se leyo entero, no quedo a
                // medias. La barra al 0 se leeria como que algo fallo.
                'avance'  => ($repetida || $carga['leidas'] === 0)
                    ? 100
                    : round($carga['insertadas'] * 100 / $carga['leidas'])
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

    // Cola del paso "Guardar": lo que la hoja hizo mas alla de insertar.
    private function detalleCruce($carga) {
        $cola = '';

        if ($carga['rechazadas'] > 0) $cola .= ' · ' . number_format($carga['rechazadas']) . ' filas rechazadas';
        if ($carga['ventas']     > 0) $cola .= ' · ' . number_format($carga['ventas']) . ' tickets';
        if ($carga['pagos']      > 0) $cola .= ' · ' . number_format($carga['pagos']) . ' pagos';
        if ($carga['meseros']    > 0) $cola .= ' · ' . number_format($carga['meseros']) . ' meseros nuevos al catalogo';
        if ($carga['cajeros']    > 0) $cola .= ' · ' . number_format($carga['cajeros']) . ' cajeros nuevos al catalogo';
        if ($carga['ligados']    > 0) $cola .= ' · ' . number_format($carga['ligados']) . ' movimientos ligados a su pago';
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

        $this->rechazadas = 0;
        $this->ventas     = 0;
        $this->pagos      = 0;
        $this->meseros    = 0;
        $this->cajeros    = 0;
        $this->ligados    = 0;
        $this->resumenes  = 0;
        $this->omitidos   = 0;
        $this->difieren   = 0;

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

        $reemplazadas = $this->borrarPeriodo($sheetName, $config['target'], $ctx);

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

        if (!$this->mdl->createImportBatch($batch)) return $this->resultadoHoja(0, count($limpias), $reemplazadas);

        $max     = $this->mdl->getMaxImportBatchId();
        $batchId = (int) $max[0]['id'];

        if     ($config['target'] === 'wansoft-detail') $insertadas = $this->guardarDetalle($limpias, $hoja, $batchId, $ctx);
        elseif ($config['target'] === 'card')           $insertadas = $this->guardarTarjetas($limpias, $batchId, $ctx, 0);
        elseif ($config['target'] === 'card-refund')    $insertadas = $this->guardarTarjetas($limpias, $batchId, $ctx, 1);
        else                                            $insertadas = $this->guardarEliminados($limpias, $batchId, $ctx);

        // Un lote sin filas no deja rastro: pasa cuando el archivo entero ya estaba
        // procesado, que no es un fallo pero tampoco una carga.
        if ($insertadas === 0) {
            $this->mdl->deleteImportBatchById($this->util->sql(['id' => $batchId], 1));

            return $this->resultadoHoja(0, count($limpias), $reemplazadas);
        }

        // El lote nacio contando las filas del archivo; ahora se ajusta a las que
        // realmente entraron, junto con su total de control y los duplicados que
        // explican la diferencia.
        if ($insertadas !== count($limpias) || $this->omitidos > 0) {
            $this->mdl->updateImportBatchRows([$insertadas, $this->controlInsertado, $this->omitidos, $batchId]);
        }

        return $this->resultadoHoja($insertadas, count($limpias), $reemplazadas);
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
            'omitidos'     => $this->omitidos,
            'difieren'     => $this->difieren
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

            if ($target === 'card' || $target === 'card-refund') {
                $this->mdl->deletePaymentCardByBatch($where);
            } else {
                $this->mdl->deleteDeletedPaymentByBatch($where);
            }

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

        $this->resumenes = $this->guardarResumen($rows, $resumen, $batchId, $ctx);

        // Lo que cuenta como "insertadas" de esta hoja son los pagos: es lo que
        // tiene una fila por cada fila del Excel. Las ventas son agrupaciones.
        return $this->pagos;
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
        if (empty($conocidos)) return 0;

        $totales = [];
        foreach ($rows as $v) {
            if ($v[5] === '' || !isset($conocidos[$v[5]])) continue;

            if (!isset($totales[$v[5]])) $totales[$v[5]] = 0;
            $totales[$v[5]] += numVal($v[15]);
        }

        $distintos = 0;
        foreach ($totales as $pdv => $total) {
            if (abs($total - (float) $conocidos[$pdv]['total']) > 0.009) $distintos++;
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

        if ($target === 'sale')    return $this->mdl->createSale($values);
        if ($target === 'payment') return $this->mdl->createSalePayment($values);
        if ($target === 'waiter')  return $this->mdl->createWaiter($values);
        if ($target === 'cashier') return $this->mdl->createCashier($values);
        if ($target === 'summary') return $this->mdl->createDailySummary($values);
        if ($target === 'card')    return $this->mdl->createPaymentCard($values);

        return $this->mdl->createDeletedPayment($values);
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
