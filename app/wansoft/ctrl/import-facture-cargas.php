<?php

// Logica de importacion/parseo del export del POS, separada del controlador
// (mismo patron que contabilidad2/soft-multisucursal/ctrl/import-soft-multisucursal.php):
// cada hoja tiene su propio layout y mezclar los parsers en el ctrl termina
// leyendo una hoja con el mapeo de la otra.
//
// Layout verificado contra docs/Reporte_De_Ventas_YYYYMMDD.xlsx:
//   - "Reporte de ventas": encabezados en fila 7, datos desde la 8, columnas A:J.
//   - "Pagos":             encabezados en fila 7, datos desde la 8, columnas A:H.
//     Trae ademas una tabla dinamica en J:K que NO forma parte del contrato.
//
// El orden de contrato() es el orden de carga y NO es libre: "Pagos" va primero
// para que la hoja de ventas encuentre esos pagos en base y los cruce por folio,
// marcando cuales quedaron facturados.
//
// La clase recibe la instancia del modelo (el ctrl, que extiende mdl) y delega
// en el todas las consultas/inserciones a BD.

define('FACTURE_HEADER_ROW', 7);

class ImportFactureCargas {

    private $mdl;
    private $util;

    // Pagos de la hoja en curso que no encontraron su venta por folio.
    private $sinVenta = 0;

    // Resultado del cruce que dispara la hoja de ventas sobre los pagos ya
    // cargados, y filas que el motor rechazo en la hoja en curso.
    private $ligados    = 0;
    private $facturados = 0;
    private $rechazadas = 0;

    // Catalogo que sembro la hoja de comandas y renglones que quedaron colgados de
    // su venta, su producto y su mesero. 'refrescados' son los productos que ya
    // existian y a los que la carga les cambio el nombre, el precio o su condicion
    // de modificador.
    private $productos   = 0;
    private $refrescados = 0;
    private $meseros     = 0;
    private $renglones   = 0;

    function __construct($mdl) {
        $this->mdl  = $mdl;
        $this->util = $mdl->util;
    }

    /*
        Cada hoja declara su propio layout:
          headerRow    fila de encabezados (los datos empiezan en la siguiente)
          keyIndex     columna que decide si la fila trae datos; en comandas la A
                       (foliocomanda) viene vacia y la clave real es B (foliocuenta)
          controlIndex columna que suma el control total del lote
          dateIndex    columna con la fecha del movimiento, con la que se
                       comprueba que el archivo es del periodo al que se sube.
                       "Pagos" no la declara porque no trae fecha propia: su
                       periodo es el de la venta con la que cruza
          tab          pestana del modulo a la que pertenece la hoja
          orden        posicion en que se lee la hoja en pantalla

        El orden de este array es el orden en que se cargan las hojas: "Pagos"
        primero, "Reporte de ventas" despues.

        En pantalla se leen al reves, por eso 'orden' va aparte: el usuario
        entra por el reporte de ventas y los pagos son su acompanante, aunque
        para cargar tengan que entrar antes.
    */
    function contrato() {
        return [
            'Pagos' => [
                'tab'          => 'sales-report',
                'target'       => 'payment',
                'orden'        => 2,
                'headerRow'    => 7,
                'keyIndex'     => 0,
                'controlIndex' => 3,
                'columns' => [
                    'Folio', 'Metodo de pago', 'Moneda', 'Importe',
                    'Tipo de cambio', 'Subtotal', 'Impuestos', 'Total'
                ]
            ],
            'Reporte de ventas' => [
                'tab'          => 'sales-report',
                'target'       => 'sale',
                'orden'        => 1,
                'headerRow'    => 7,
                'keyIndex'     => 0,
                'controlIndex' => 6,
                'dateIndex'    => 2,
                'columns' => [
                    'Folio', 'Codigo facturacion', 'Fecha', 'Descuento', 'Subtotal',
                    'Impuestos', 'Total', 'Fecha de expiracion', 'Estado', 'Folio factura'
                ]
            ],
            'comandas' => [
                'tab'          => 'commands',
                'target'       => 'detail',
                'orden'        => 1,
                'headerRow'    => 1,
                'keyIndex'     => 1,
                'controlIndex' => 11,
                'dateIndex'    => 3,
                'columns' => [
                    'foliocomanda', 'foliocuenta', 'orden', 'fechaapertura', 'fechacierre',
                    'mesero', 'claveproducto', 'fechadecaptura', 'descripcion', 'cantidad',
                    'descuento', 'importe'
                ]
            ]
        ];
    }

    // Revision sin escribir nada: a que pestana pertenece el libro y si sus
    // columnas cuadran. El modulo la consulta ANTES de preguntar el periodo, para
    // que esa confirmacion nombre el destino real y no el boton que se apreto.
    //
    // Sin esto el usuario confirmaba "cargar comandas.xls en Reporte de ventas"
    // (que era falso) y solo despues se le avisaba que el archivo era de otra
    // pestana: dos preguntas seguidas y la primera diciendo lo que no era.
    function inspeccionarLibro($documento, $ctx) {
        $tipo       = isset($ctx['tipo']) ? $ctx['tipo'] : '';
        $contrato   = $this->contrato();
        $hojasLibro = $documento->getSheetNames();
        $destino    = $tipo;

        // El periodo cerrado manda sobre todo lo demas: si ya se emitieron notas
        // no hay nada que revisar del archivo, porque no se va a cargar.
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

        // Ninguna hoja de esta pestana: se mira si el libro es de otra.
        if (empty($presentes)) {
            $otro = tabDelLibro($contrato, $hojasLibro, $tipo);

            if (empty($otro)) {
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

            // Se sigue revisando, pero contra la pestana a la que pertenece: si
            // ahi tampoco sirve, el usuario se entera antes de aceptar el cambio.
            $destino   = $otro['tab'];
            $presentes = $this->hojasPresentes($contrato, $hojasLibro, $destino);
        }

        $malas = [];
        foreach ($presentes as $nombre) {
            $config   = $contrato[$nombre];
            $columnas = $this->validarEncabezados($documento->getSheetByName($nombre), $config['columns'], $config['headerRow']);
            $faltan   = $this->columnasMalas($columnas);

            if (empty($faltan)) continue;

            $malas[] = [
                'hoja'      => $nombre,
                'headerRow' => $config['headerRow'],
                'columnas'  => $columnas,
                'faltan'    => $faltan
            ];
        }

        $revision = [
            'status'  => 200,
            'destino' => $destino,
            'movido'  => $destino !== $tipo,
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

        // El periodo se comprueba con las columnas ya validadas: la fecha se lee
        // por posicion, y con una columna corrida se estaria mirando la celda
        // equivocada para decidir de que mes es el archivo.
        $ajeno = $this->fechasAjenas($documento, $presentes, $contrato, $ctx);

        if ($ajeno) $revision['validacion'] = $ajeno;

        return $revision;
    }

    // Notas ya emitidas sobre el periodo al que va la carga, si las hay.
    //
    // Un ticket virtual es un documento entregado, y su respaldo son las ventas y
    // los renglones de ese periodo. Volver a cargar los reemplaza: en el caso del
    // reporte de ventas, ademas, las notas se irian con las ventas por el CASCADE
    // de virtual_ticket.sale_id, sin quedar rastro de que existieron.
    //
    // Por eso el bloqueo es del PERIODO y no de la hoja: aunque solo comandas o
    // pagos se reemplacen, lo que respalda a la nota deja de ser lo que era.
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
    // que no contiene, y de ese sello cuelgan las dos operaciones destructivas del
    // modulo: la sobreescritura del periodo, que borra por lote, y el candado de
    // notas emitidas.
    //
    // Se pregunta antes de tocar nada y por la misma razon que las notas: lo que
    // viene despues ya borra.
    private function fechasAjenas($documento, $presentes, $contrato, $ctx) {
        $mes  = isset($ctx['mes'])  ? (int) $ctx['mes']  : 0;
        $anio = isset($ctx['anio']) ? (int) $ctx['anio'] : 0;

        if ($mes < 1 || $anio < 2000) return null;

        foreach ($presentes as $nombre) {
            $config = $contrato[$nombre];

            // La hoja sin fecha propia no dice nada del periodo: no se pregunta.
            if (!isset($config['dateIndex'])) continue;

            $hoja   = $documento->getSheetByName($nombre);
            $ajeno  = periodoAjeno(conteoDeFechas($this->columnaDeFechas($hoja, $config), $mes, $anio), $mes, $anio);

            if ($ajeno) {
                $ajeno['hoja'] = $nombre;

                return $ajeno;
            }
        }

        return null;
    }

    // Los valores crudos de la columna de fecha de una hoja. Se lee solo esa
    // columna: la comprobacion del periodo corre antes de la carga y recorrer el
    // ancho entero de la tabla para preguntar por un dato la haria costar lo mismo
    // que guardarla.
    private function columnaDeFechas($hoja, $config) {
        $claveCol = columnLetter($config['keyIndex']);
        $fechaCol = columnLetter($config['dateIndex']);
        $__row    = [];

        for ($fila = $config['headerRow'] + 1; $fila <= $hoja->getHighestRow(); $fila++) {
            if (trim((string) $hoja->getCell($claveCol . $fila)->getValue()) === '') continue;

            $__row[] = trim((string) $hoja->getCell($fechaCol . $fila)->getValue());
        }

        return $__row;
    }

    // Las hojas del contrato de una pestana que el libro trae, en el orden en que
    // hay que cargarlas.
    private function hojasPresentes($contrato, $hojasLibro, $tab) {
        $__row = [];

        foreach (hojasDelTab($contrato, $tab) as $nombre) {
            if (in_array($nombre, $hojasLibro)) $__row[] = $nombre;
        }

        return $__row;
    }

    // Router: recorre las hojas del contrato que trae el libro, valida su
    // estructura y guarda las que pasan. Devuelve siempre 'status' (200 al
    // procesar al menos una hoja, 400 si no reconoce ninguna).
    //
    // Las hojas se pueden subir juntas o por separado: un libro con solo "Pagos"
    // es una carga valida. Lo que decide si una hoja entra son sus columnas, no
    // que venga acompanada. La que no cuadra se queda fuera y se reporta con el
    // detalle de que columna falta o esta corrida, sin arrastrar a las demas.
    //
    // Solo se buscan las hojas de la pestana desde la que se subio: mirar el
    // contrato completo hacia que el archivo de comandas entrara por el boton del
    // reporte de ventas, porque el importador reconocia su hoja igual. La carga
    // se veia bien y los datos aparecian en la otra pestana.
    function procesarLibro($documento, $ctx) {
        $contrato   = $this->contrato();
        $tipo       = isset($ctx['tipo']) ? $ctx['tipo'] : '';
        $esperadas  = hojasDelTab($contrato, $tipo);
        $hojasLibro = $documento->getSheetNames();

        $presentes = $this->hojasPresentes($contrato, $hojasLibro, $tipo);

        $steps = $ctx['steps'];

        // El mismo corte que hace la revision previa, repetido aqui a proposito:
        // uploadFile se puede llamar sin haber pasado por ella, y este es el punto
        // donde se empieza a borrar el periodo.
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

        // Ninguna hoja de esta pestana. Antes de rechazar se mira si el libro trae
        // las de otra: subir comandas por el boton de ventas es el error facil de
        // cometer, y ahi lo util no es negarse sino ofrecer cargarlo donde va. El
        // archivo no se toca aqui; el modulo lo reenvia si el usuario acepta.
        if (empty($presentes)) {
            $otro = tabDelLibro($contrato, $hojasLibro, isset($ctx['tipo']) ? $ctx['tipo'] : '');

            if ($otro) {
                $steps[] = step('Detectar pestana', 'error', 'Las hojas del archivo son de "' . $otro['tab'] . '"');

                return [
                    'status'  => 409,
                    'message' => 'El archivo parece de otra pestana',
                    'steps'   => $steps,
                    'hojas'   => [],
                    'validacion' => [
                        'motivo'    => 'otro-tab',
                        'sugerido'  => $otro['tab'],
                        'suyas'     => $otro['hojas'],
                        'esperadas' => $esperadas,
                        'libro'     => $hojasLibro,
                        'columnas'  => [],
                        'cargadas'  => []
                    ]
                ];
            }

            return [
                'status'  => 400,
                'message' => 'Este no es el archivo que espera esta pestana',
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
        // ella, y este es el punto donde se empieza a borrar el periodo.
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
            $columnas = $this->validarEncabezados($hoja, $config['columns'], $config['headerRow']);
            $faltan   = $this->columnasMalas($columnas);

            if (!empty($faltan)) {
                $steps[] = step('Validar columnas de "' . $nombre . '"', 'error', resumenColumnas($faltan));

                $malas[] = [
                    'hoja'      => $nombre,
                    'headerRow' => $config['headerRow'],
                    'columnas'  => $columnas,
                    'faltan'    => $faltan
                ];

                $hojas[] = [
                    'nombre'  => $nombre,
                    'estado'  => 'error',
                    'detalle' => resumenColumnas($faltan),
                    'filas'   => 0
                ];
                continue;
            }

            $ultima  = columnLetter(count($config['columns']) - 1);
            $steps[] = step('Validar columnas de "' . $nombre . '"', 'ok', count($config['columns']) . ' columnas A:' . $ultima);


            $carga     = $this->guardarHoja($nombre, $config, $hoja, $ctx);
            $cargadas += $carga['insertadas'] > 0 ? 1 : 0;

            if ($carga['insertadas'] > 0) $entraron[] = $nombre;

            // El periodo se sobreescribe, no se acumula: si habia una carga previa
            // de esta hoja se dice cuanto se reemplazo.
            if ($carga['reemplazadas'] > 0) {
                $steps[] = step(
                    'Sobreescribir "' . $nombre . '"',
                    'ok',
                    number_format($carga['reemplazadas']) . ' filas de la carga anterior del periodo'
                );
            }

            $steps[] = step(
                'Guardar "' . $nombre . '"',
                $carga['insertadas'] > 0 ? 'ok' : 'error',
                number_format($carga['insertadas']) . ' registros en base de datos' . $this->detalleCruce($carga)
            );

            $hojas[] = [
                'nombre'  => $nombre,
                'estado'  => $carga['insertadas'] > 0 ? 'ok' : 'error',
                'detalle' => 'columnas A:' . $ultima . ' · fila ' . ($config['headerRow'] + 1) . ' · ' . number_format($carga['insertadas']) . ' de ' . number_format($carga['leidas']) . ' filas',
                'filas'   => $carga['insertadas'],
                'leidas'  => $carga['leidas'],
                'avance'  => $carga['leidas'] > 0 ? round($carga['insertadas'] * 100 / $carga['leidas']) : 0
            ];
        }

        // Las hojas se procesan en el orden en que hay que cargarlas, pero el
        // panel las anuncia en el suyo: el resultado se reacomoda antes de
        // salir para que la carga no reordene lo que ya estaba en pantalla.
        $resultado = [
            'status'  => $cargadas > 0 ? 200 : ($malas ? 422 : 500),
            'message' => mensajeCarga($cargadas, $malas),
            'steps'   => $steps,
            'hojas'   => ordenarPorHoja($hojas, $contrato, 'nombre')
        ];

        // El detalle de columnas solo viaja cuando hay algo que corregir. Lleva
        // ademas lo que si entro: una hoja rechazada junto a otra cargada no se
        // puede anunciar como "no se modifico nada".
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

    // Cola del paso "Guardar": lo que la hoja hizo mas alla de insertar. En pagos
    // son los que quedaron esperando su venta; en ventas, el resultado del cruce
    // por folio contra esos pagos y cuantos trae el POS ya facturados.
    private function detalleCruce($carga) {
        $cola = '';

        if ($carga['rechazadas'] > 0) $cola .= ' · ' . number_format($carga['rechazadas']) . ' filas rechazadas';
        if ($carga['sinVenta']   > 0) $cola .= ' · ' . number_format($carga['sinVenta']) . ' sin venta (se ligan al subir el reporte de ventas)';
        if ($carga['ligados']    > 0) $cola .= ' · ' . number_format($carga['ligados']) . ' pagos ligados por folio';
        if ($carga['facturados'] > 0) $cola .= ' · ' . number_format($carga['facturados']) . ' facturados';
        if ($carga['productos']   > 0) $cola .= ' · ' . number_format($carga['productos']) . ' productos nuevos al catalogo';
        if ($carga['refrescados'] > 0) $cola .= ' · ' . number_format($carga['refrescados']) . ' productos actualizados';
        if ($carga['meseros']     > 0) $cola .= ' · ' . number_format($carga['meseros']) . ' meseros nuevos al catalogo';
        if ($carga['renglones']  > 0) $cola .= ' · ' . number_format($carga['renglones']) . ' renglones ligados a su ticket';

        return $cola;
    }

    // Devuelve la fila de encabezados COMPLETA, celda por celda, con el estado de
    // cada una. Van todas y no solo las que fallan porque el aviso la dibuja como
    // la hoja de Excel que es: sin las columnas buenas no se ve donde empieza el
    // desfase ni contra que comparar.
    //
    // Tres estados, y los dos ultimos se resuelven distinto:
    //
    //   ok       el encabezado esta donde debe.
    //   movida   existe, pero en otra columna. El export esta corrido y basta
    //            reacomodarlo.
    //   ausente  no aparece en ninguna parte de la fila. Falta el dato, o el
    //            archivo es de otro reporte.
    //
    // La fila se lee mas alla del contrato para poder decir a donde se movio una
    // columna cuando el export trae campos de mas al principio.
    private function validarEncabezados($hoja, $columns, $headerRow) {
        $total  = count($columns);
        $limite = $total * 2;

        $fila = [];
        for ($i = 0; $i < $limite; $i++) {
            $letra        = columnLetter($i);
            $fila[$letra] = (string) $hoja->getCell($letra . $headerRow)->getValue();
        }

        $normal = array_map('normalizeHeader', $fila);
        $__row  = [];

        foreach ($columns as $i => $name) {
            $letra    = columnLetter($i);
            $esperada = normalizeHeader($name);
            $cuadra   = $normal[$letra] === $esperada;

            // array_search sobre la fila normalizada: si el encabezado aparece en
            // otra celda, la columna esta corrida y no perdida.
            $en = $cuadra ? false : array_search($esperada, $normal, true);

            $__row[] = [
                'letra'      => $letra,
                'esperada'   => $name,
                'encontrada' => trim($fila[$letra]),
                'estado'     => $cuadra ? 'ok' : ($en === false ? 'ausente' : 'movida'),
                'en'         => $en === false ? '' : $en
            ];
        }

        return $__row;
    }

    // Las celdas de la fila que no cuadran. El aviso necesita las dos listas: la
    // completa para dibujar la hoja y esta para contar y decidir si se rechaza.
    private function columnasMalas($columnas) {
        $__row = [];

        foreach ($columnas as $c) {
            if ($c['estado'] !== 'ok') $__row[] = $c;
        }

        return $__row;
    }

    // Crea el lote de la hoja y vuelca sus filas.
    private function guardarHoja($sheetName, $config, $hoja, $ctx) {
        $total      = count($config['columns']);
        $totalFilas = $hoja->getHighestRow();
        $limpias    = [];

        $this->sinVenta   = 0;
        $this->ligados    = 0;
        $this->facturados = 0;
        $this->rechazadas = 0;
        $this->productos   = 0;
        $this->refrescados = 0;
        $this->meseros     = 0;
        $this->renglones   = 0;

        $claveCol = columnLetter($config['keyIndex']);

        for ($fila = $config['headerRow'] + 1; $fila <= $totalFilas; $fila++) {
            $clave = trim((string) $hoja->getCell($claveCol . $fila)->getValue());
            if ($clave === '') continue; // corta el relleno de la tabla dinamica

            $valores = [];
            for ($i = 0; $i < $total; $i++) {
                $valores[$i] = trim((string) $hoja->getCell(columnLetter($i) . $fila)->getValue());
            }
            $valores['source_row'] = $fila;

            $limpias[] = $valores;
        }

        if (empty($limpias)) return $this->resultadoHoja(0, 0, 0);

        // La hoja se borra del periodo hasta aqui: si el Excel no traia filas no
        // hay nada con que reemplazar y los datos buenos se quedan.
        $reemplazadas = $this->borrarPeriodo($sheetName, $config['target'], $ctx);

        $control = 0;
        foreach ($limpias as $v) $control += numVal($v[$config['controlIndex']]);

        // Ficha de auditoria del lote. Aqui source_rows y row_count coinciden
        // siempre: esta carga reemplaza el periodo y guarda el archivo entero, sin
        // omitir nada por duplicidad.
        $batch = $this->util->sql([
            'file_name'       => $ctx['fileName'],
            'sheet_name'      => $sheetName,
            'period_year'     => $ctx['anio'],
            'period_month'    => $ctx['mes'],
            'source_rows'     => count($limpias),
            'row_count'       => count($limpias),
            'control_total'   => $control,
            'created_at'      => date('Y-m-d H:i:s'),
            'user_name'       => $ctx['userName'] ?? '',
            'user_id'         => $ctx['userId'] ?? null,
            'branch_id'       => $ctx['branchId']
        ]);

        if (!$this->mdl->createImportBatch($batch)) return $this->resultadoHoja(0, count($limpias), $reemplazadas);

        $max     = $this->mdl->getMaxImportBatchId();
        $batchId = (int) $max[0]['id'];

        if ($config['target'] === 'sale')        $insertadas = $this->guardarVentas($limpias, $batchId, $ctx);
        elseif ($config['target'] === 'payment') $insertadas = $this->guardarPagos($limpias, $batchId, $ctx);
        else                                     $insertadas = $this->guardarComandas($limpias, $batchId, $ctx);

        if ($insertadas === 0) {
            $this->mdl->deleteImportBatchById($this->util->sql(['id' => $batchId], 1));
        }

        return $this->resultadoHoja($insertadas, count($limpias), $reemplazadas);
    }

    // Lo que la hoja deja para el roadmap. Los contadores del cruce viven en la
    // instancia porque los llenan guardarPagos/guardarVentas, no este metodo.
    private function resultadoHoja($insertadas, $leidas, $reemplazadas) {
        return [
            'insertadas'   => $insertadas,
            'leidas'       => $leidas,
            'reemplazadas' => $reemplazadas,
            'sinVenta'     => $this->sinVenta,
            'ligados'      => $this->ligados,
            'facturados'   => $this->facturados,
            'rechazadas'   => $this->rechazadas,
            'productos'    => $this->productos,
            'refrescados'  => $this->refrescados,
            'meseros'      => $this->meseros,
            'renglones'    => $this->renglones
        ];
    }

    // Sobreescritura del periodo: la carga reemplaza a la anterior de la misma
    // hoja, no se suma a ella. Sin esto la segunda carga del mes choca contra la
    // UNIQUE de folio y no entra ninguna fila. Devuelve las filas reemplazadas.
    private function borrarPeriodo($sheetName, $target, $ctx) {
        $previos = $this->mdl->listImportBatchBySheet([
            $ctx['branchId'], $ctx['anio'], $ctx['mes'], $sheetName
        ]);

        if (empty($previos)) return 0;

        $filas = 0;
        foreach ($previos as $lote) {
            $where = $this->util->sql(['import_batch_id' => $lote['id']], 1);

            if ($target === 'sale') {
                // Ni los pagos ni los renglones de comanda se borran con las
                // ventas: los dos cuelgan de sale con CASCADE, asi que se desligan
                // antes y el nuevo lote los vuelve a cruzar. Son cargas distintas
                // y el reporte de ventas no manda sobre ellas.
                $this->mdl->unlinkSalePaymentByBatch([$lote['id']]);
                $this->mdl->unlinkSaleDetailByBatch([$lote['id']]);
                $this->mdl->deleteSaleByBatch($where);
            } elseif ($target === 'payment') {
                $this->mdl->deleteSalePaymentByBatch($where);
            } else {
                $this->mdl->deleteSaleDetailByBatch($where);
            }

            $this->mdl->deleteImportBatchById($this->util->sql(['id' => $lote['id']], 1));
            $filas += (int) $lote['row_count'];
        }

        return $filas;
    }

    private function guardarComandas($rows, $batchId, $ctx) {
        $data = [];
        foreach ($rows as $v) {
            $data[] = [
                'comanda_folio'    => $v[0] === '' ? null : $v[0],
                'sale_folio'       => $v[1],
                'table_number'     => $v[2],
                'opened_at'        => cleanDate($v[3]),
                'closed_at'        => cleanDate($v[4]),
                'waiter_code'      => $v[5],
                'product_code'     => $v[6],
                'captured_at'      => cleanDate($v[7]),
                'description'      => $v[8],
                'quantity'         => numVal($v[9]),
                'discount_percent' => numVal($v[10]),
                'amount'           => numVal($v[11]),
                'source_row'       => $v['source_row'],
                'import_batch_id'  => $batchId
            ];
        }

        $insertadas = $this->insertarPorBloques($data, 'detail');

        // El renglon entra con los codigos de texto del Excel, que es todo lo que
        // trae la hoja. Las tres llaves (venta, producto y mesero) se resuelven
        // aqui: primero se da de alta lo que el catalogo no conoce y luego se
        // cuelgan los renglones de su fila. Sin este paso el detalle queda con
        // sale_id, product_id y waiter_id en nulo y las tablas product y waiter
        // vacias, asi que ninguna consulta puede partir del catalogo.
        if ($insertadas > 0) {
            $this->productos = $this->sembrarProductos($rows, $ctx);
            $this->meseros   = $this->sembrarMeseros($rows, $ctx);

            $this->ligarComandas($batchId, $ctx);
        }

        return $insertadas;
    }

    // El catalogo de productos se sincroniza con lo que trae la hoja: el que no
    // existe se da de alta y el que ya existe se refresca. La clave es
    // 'claveproducto' (columna G), que es la que lleva el UNIQUE de la tabla; el
    // folio es de la cuenta y no identifica al producto.
    //
    // Se refresca solo lo que se DERIVA del Excel, y eso lo dice el DDL: name,
    // price y is_modifier son derivados, is_bridge lo marca el usuario a mano y la
    // carga no lo toca.
    //
    // Dos resguardos para no destruir un dato bueno con una carga pobre:
    //   - el nombre solo se escribe si la hoja trae descripcion;
    //   - el precio solo se escribe si la carga vio algun importe mayor a cero,
    //     porque un mes en el que un producto solo aparecio regalado no significa
    //     que valga cero.
    //
    // Un producto cuyos renglones van SIEMPRE en cero no se vende solo: es un
    // modificador (la guarnicion o la preparacion que acompana a un platillo), y
    // asi queda marcado para que no entre a armar tickets.
    private function sembrarProductos($rows, $ctx) {
        $existen = [];
        foreach ($this->mdl->listProduct([$ctx['branchId']]) as $item) $existen[$item['code']] = $item;

        $catalogo = $this->productosDeLaHoja($rows);

        $data = [];
        foreach ($catalogo as $code => $item) {
            if (isset($existen[$code])) {
                $this->refrescarProducto($existen[$code], $item);
                continue;
            }

            $data[] = [
                'code'        => $code,
                'name'        => $item['name'],
                'is_modifier' => $item['is_modifier'],
                'price'       => $item['price'],
                'branch_id'   => $ctx['branchId']
            ];
        }

        if (empty($data)) return 0;

        return $this->insertarCatalogo($data, 'product');
    }

    // Lo que la hoja dice de cada producto, resumido en una sola ficha.
    //
    // El precio es UNITARIO: la hoja trae el importe de la linea, y una linea de
    // tres piezas por 255 no significa que el producto valga 255. De todos los
    // renglones del producto se toma el unitario mas alto, porque los descuentos
    // solo bajan el importe y el maximo es lo mas cerca que la hoja deja del
    // precio de lista.
    private function productosDeLaHoja($rows) {
        $__row = [];

        foreach ($rows as $v) {
            $code = $v[6];
            if ($code === '') continue;

            $importe  = numVal($v[11]);
            $cantidad = numVal($v[9]);
            $unitario = $cantidad > 0 ? round($importe / $cantidad, 2) : $importe;

            if (!isset($__row[$code])) {
                $__row[$code] = ['name' => $v[8], 'price' => 0, 'is_modifier' => 1];
            }

            // El nombre lo pone el primer renglon que traiga descripcion: el POS
            // deja la celda vacia en algunos modificadores.
            if ($__row[$code]['name'] === '' && $v[8] !== '') $__row[$code]['name'] = $v[8];

            if ($unitario > $__row[$code]['price']) $__row[$code]['price'] = $unitario;
            if ($importe > 0)                       $__row[$code]['is_modifier'] = 0;
        }

        return $__row;
    }

    // Escribe en el producto existente solo los campos que cambiaron. Comparar
    // antes de escribir mantiene el updated_at limpio: si la carga no trajo nada
    // nuevo, el producto no se toca y no aparece como modificado.
    private function refrescarProducto($actual, $hoja) {
        $name  = $hoja['name'] !== '' ? $hoja['name']  : $actual['name'];
        $price = $hoja['price'] > 0   ? $hoja['price'] : (float) $actual['price'];

        // La marca de modificador solo se quita, nunca se pone: que un producto
        // haya cobrado alguna vez es prueba definitiva de que se vende solo, pero
        // un mes en el que solo aparecio regalado no prueba lo contrario. Sin esto
        // una carga pobre degradaba un platillo a guarnicion y lo sacaba de los
        // tickets.
        $modifier = (int) $actual['is_modifier'] === 0 ? 0 : (int) $hoja['is_modifier'];

        $igual = $name === $actual['name']
              && abs($price - (float) $actual['price']) < 0.005
              && $modifier === (int) $actual['is_modifier'];

        if ($igual) return;

        if ($this->mdl->updateProduct([$name, $price, $modifier, $actual['id']])) $this->refrescados++;
    }

    // La hoja solo trae la clave del mesero, no su nombre: se da de alta con la
    // clave como nombre para que el renglon tenga a quien colgarse, y queda una
    // fila donde despues se puede escribir el nombre real. El listado de ventas ya
    // lo lee asi (COALESCE(w.name, d.waiter_code)).
    private function sembrarMeseros($rows, $ctx) {
        $existen = [];
        foreach ($this->mdl->listWaiter([$ctx['branchId']]) as $item) $existen[$item['code']] = true;

        $codigos = [];
        foreach ($rows as $v) {
            if ($v[5] === '' || isset($existen[$v[5]])) continue;

            $codigos[$v[5]] = true;
        }

        $data = [];
        foreach (array_keys($codigos) as $code) {
            $data[] = [
                'code'      => $code,
                'name'      => $code,
                'branch_id' => $ctx['branchId']
            ];
        }

        if (empty($data)) return 0;

        return $this->insertarCatalogo($data, 'waiter');
    }

    // Cruce de los renglones del lote contra venta, producto y mesero. Lo que no
    // encuentra pareja se queda en nulo: la venta puede no estar cargada todavia
    // (las comandas se pueden subir antes que el reporte), y ese caso lo cierra
    // ligarDetalles cuando entra la hoja de ventas.
    private function ligarComandas($batchId, $ctx) {
        $this->mdl->linkSaleDetailToSale([$ctx['branchId'], $batchId]);
        $this->mdl->linkSaleDetailToProduct([$ctx['branchId'], $batchId]);
        $this->mdl->linkSaleDetailToWaiter([$ctx['branchId'], $batchId]);

        $conteo = $this->mdl->countSaleDetailByBatch([$batchId]);

        $this->renglones = (int) ($conteo[0]['con_venta'] ?? 0);
    }

    private function guardarVentas($rows, $batchId, $ctx) {
        $status = [];
        foreach ($this->mdl->lsSaleStatus() as $s) $status[strtoupper($s['valor'])] = $s['id'];

        $data = [];
        foreach ($rows as $v) {
            $data[] = [
                'folio'            => $v[0],
                'billing_code'     => $v[1],
                'operation_date'   => cleanDate($v[2]),
                'discount_percent' => (float) $v[3],
                'subtotal'         => (float) $v[4],
                'tax'              => (float) $v[5],
                'total'            => (float) $v[6],
                'expires_at'       => cleanDate($v[7]),
                'sale_status_id'   => isset($status[strtoupper($v[8])]) ? $status[strtoupper($v[8])] : null,
                'invoice_series'   => $v[9] === '' ? null : $v[9],
                'source_row'       => $v['source_row'],
                'branch_id'        => $ctx['branchId'],
                'import_batch_id'  => $batchId
            ];
        }

        $insertadas = $this->insertarPorBloques($data, 'sale');

        // Las ventas cierran la carga: los pagos y los renglones de comanda ya
        // estan en base esperando su folio, asi que el cruce se dispara aqui.
        if ($insertadas > 0) {
            $this->ligarPagos($batchId);
            $this->ligarDetalles($batchId);
        }

        return $insertadas;
    }

    // Los renglones de comanda que entraron antes que su venta se cuelgan del lote
    // recien cargado. Es el mismo cruce por folio de los pagos, y por eso vive
    // aqui: sin el, subir comandas y despues el reporte dejaria el detalle sin
    // sale_id para siempre.
    private function ligarDetalles($batchId) {
        $this->mdl->linkSaleDetailByBatch([$batchId]);
    }

    // Match por folio contra los pagos que entraron antes sin venta ligada. Deja
    // en la instancia cuantos se ligaron y cuantos apuntan a un ticket que el POS
    // reporto facturado, para que el roadmap lo diga.
    private function ligarPagos($batchId) {
        $this->mdl->linkSalePaymentByBatch([$batchId]);

        $conteo = $this->mdl->countSalePaymentByBatch([$batchId]);

        $this->ligados    = (int) ($conteo[0]['ligados'] ?? 0);
        $this->facturados = (int) ($conteo[0]['facturados'] ?? 0);
    }

    private function guardarPagos($rows, $batchId, $ctx) {
        $methods = [];
        foreach ($this->mdl->lsPaymentMethod([$ctx['branchId']]) as $m) $methods[strtoupper($m['valor'])] = $m['id'];

        // El pago cuelga de la venta por sale_id, no solo por el folio de texto. Los
        // pagos van primero, asi que lo normal es que la venta no exista todavia y
        // el pago se guarde sin ligar: la hoja de ventas lo cruza despues. Aqui solo
        // se aprovecha lo que ya este en base (subida de pagos sobre un periodo que
        // ya tiene ventas).
        $ventas = $this->ventasPorFolio($rows, $ctx['branchId']);

        $this->sinVenta = 0;
        $data = [];

        foreach ($rows as $v) {
            $saleId = isset($ventas[$v[0]]) ? $ventas[$v[0]] : null;
            if ($saleId === null) $this->sinVenta++;

            $data[] = [
                'sale_folio'        => $v[0],
                'currency'          => $v[2],
                'amount'            => (float) $v[3],
                'exchange_rate'     => (float) $v[4] ?: 1,
                'sale_subtotal'     => (float) $v[5],
                'sale_tax'          => (float) $v[6],
                'sale_total'        => (float) $v[7],
                'sale_id'           => $saleId,
                'payment_method_id' => isset($methods[strtoupper($v[1])]) ? $methods[strtoupper($v[1])] : null,
                'source_row'        => $v['source_row'],
                'import_batch_id'   => $batchId
            ];
        }

        return $this->insertarPorBloques($data, 'payment');
    }

    // Los folios se consultan en bloques: un IN con miles de marcadores revienta
    // el limite de PDO igual que un INSERT gigante.
    private function ventasPorFolio($rows, $branchId) {
        $folios = [];
        foreach ($rows as $v) {
            if ($v[0] !== '') $folios[$v[0]] = true;
        }

        $mapa = [];
        foreach (array_chunk(array_keys($folios), 400) as $chunk) {
            foreach ($this->mdl->listSaleIdByFolio(array_merge([$branchId], $chunk)) as $s) {
                $mapa[$s['folio']] = (int) $s['id'];
            }
        }

        return $mapa;
    }

    // Un INSERT por cada 400 filas: un solo statement con miles de placeholders
    // revienta el limite de PDO y max_allowed_packet.
    //
    // El bloque es todo o nada para PDO: una sola fila invalida tumba el INSERT y
    // con el las otras 399. Por eso el bloque que falla se reintenta fila por fila,
    // asi entra el archivo completo y solo se quedan fuera las filas que el motor
    // rechaza de verdad, que se cuentan para reportarlas.
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
    // cuenta como fila rechazada del Excel. Igual se nota, porque el renglon que
    // apuntaba a esa clave se queda sin enlace.
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
        if ($target === 'product') return $this->mdl->createProduct($values);
        if ($target === 'waiter')  return $this->mdl->createWaiter($values);

        return $this->mdl->createSaleDetail($values);
    }
}

// Complements

// Normaliza para comparar encabezados sin depender de acentos ni mayusculas: el
// POS exporta "Código facturación" y el contrato lo guarda sin tildes. Los
// acentos se quitan ANTES de strtolower, que no es multibyte y dejaria la "Ó".
function normalizeHeader($text) {
    $from = ['á', 'é', 'í', 'ó', 'ú', 'ü', 'ñ', 'Á', 'É', 'Í', 'Ó', 'Ú', 'Ü', 'Ñ'];
    $to   = ['a', 'e', 'i', 'o', 'u', 'u', 'n', 'a', 'e', 'i', 'o', 'u', 'u', 'n'];

    $text = strtolower(str_replace($from, $to, trim($text)));
    $text = preg_replace('/[^a-z0-9 ]/', '', $text);

    return trim(preg_replace('/\s+/', ' ', $text));
}

// El POS exporta el descuento como "0%" y las cantidades con separadores: se
// limpian antes de castear para no guardar 0 donde habia un numero.
function numVal($value) {
    $limpio = str_replace(['%', ',', '$', ' '], '', (string) $value);

    return is_numeric($limpio) ? (float) $limpio : 0;
}

// Las hojas que el contrato espera para una pestana. Es el universo de lo que se
// busca en el libro: fuera de esta lista una hoja no se lee, aunque el contrato
// la conozca por otra pestana.
//
// Sin pestana reconocida se cae al contrato completo, para que una llamada sin
// 'tipo' no se quede sin nada que buscar.
function hojasDelTab($contrato, $tab) {
    $__row = [];

    foreach ($contrato as $nombre => $config) {
        if ($config['tab'] === $tab) $__row[] = $nombre;
    }

    return empty($__row) ? array_keys($contrato) : $__row;
}

// A que otra pestana pertenecen las hojas que trae el libro. Sirve para el caso
// de subir el archivo por el boton equivocado: el importador no lo carga solo
// (la pestana la elige el usuario), pero si puede decir cual era.
function tabDelLibro($contrato, $hojasLibro, $tabActual) {
    foreach ($contrato as $nombre => $config) {
        if ($config['tab'] === $tabActual)   continue;
        if (!in_array($nombre, $hojasLibro)) continue;

        // Las hojas se devuelven completas: el aviso muestra la pestana sugerida
        // con todo lo que va en ella, no solo con la que disparo el hallazgo.
        return [
            'tab'   => $config['tab'],
            'hojas' => hojasDelTab($contrato, $config['tab'])
        ];
    }

    return null;
}

// Resumen de una linea para el roadmap y la tarjeta de la hoja. El detalle
// columna por columna va en el aviso, que es donde hay lugar para leerlo.
function resumenColumnas($faltan) {
    $ausentes = 0;
    $movidas  = 0;

    foreach ($faltan as $c) {
        if ($c['estado'] === 'ausente') $ausentes++;
        else                            $movidas++;
    }

    $partes = [];
    if ($ausentes > 0) $partes[] = $ausentes . ' columna(s) que faltan';
    if ($movidas  > 0) $partes[] = $movidas . ' fuera de lugar';

    return implode(' · ', $partes);
}

// La carga puede terminar de tres formas y las tres se dicen distinto: todo
// entro, nada entro, o una hoja entro y la otra no. La tercera es la que no
// puede anunciarse como exito a secas.
function mensajeCarga($cargadas, $malas) {
    if ($cargadas > 0 && empty($malas)) return 'Archivo procesado: ' . $cargadas . ' hoja(s) cargada(s)';

    if ($cargadas > 0) {
        return 'Se cargo ' . $cargadas . ' hoja(s), pero ' . count($malas) . ' quedo fuera por sus columnas';
    }

    if (!empty($malas)) return 'Las columnas del archivo no coinciden con el formato del POS';

    return 'No se pudo cargar ninguna hoja del archivo';
}

// El contrato se lee en el orden en que hay que cargar las hojas, que no es el
// orden en que se muestran: 'orden' dice donde va cada una en pantalla. El
// indice de llegada desempata, porque usort no es estable en PHP 7.
function ordenarPorHoja($items, $contrato, $campo) {
    $lista = [];
    foreach ($items as $i => $item) {
        $nombre  = $item[$campo];
        $lista[] = [
            'pos'   => $i,
            'orden' => isset($contrato[$nombre]['orden']) ? (int) $contrato[$nombre]['orden'] : 99,
            'item'  => $item
        ];
    }

    usort($lista, function ($a, $b) {
        return $a['orden'] === $b['orden'] ? $a['pos'] - $b['pos'] : $a['orden'] - $b['orden'];
    });

    return array_column($lista, 'item');
}

function columnLetter($index) {
    $letter = '';
    $index++;

    while ($index > 0) {
        $mod    = ($index - 1) % 26;
        $letter = chr(65 + $mod) . $letter;
        $index  = (int) (($index - $mod) / 26);
    }

    return $letter;
}

function cleanDate($value) {
    if ($value === '' || $value === null) return null;

    // Con setReadDataOnly(true) no se cargan los formatos de celda, asi que una
    // fecha llega como su serial de Excel (46203.80) y no como texto.
    if (is_numeric($value)) {
        return \PhpOffice\PhpSpreadsheet\Shared\Date::excelToDateTimeObject((float) $value)
            ->format('Y-m-d H:i:s');
    }

    // El POS exporta d/m/Y; strtotime lo leeria como m/d/Y y cambiaria el mes.
    if (preg_match('#^(\d{1,2})/(\d{1,2})/(\d{4})(.*)$#', $value, $m)) {
        $value = $m[3] . '-' . $m[2] . '-' . $m[1] . $m[4];
    }

    $time = strtotime($value);

    return $time ? date('Y-m-d H:i:s', $time) : null;
}

// Cuantos movimientos de una hoja caen dentro del mes y anio a los que se esta
// cargando, y que dias son los que se salen. La cuenta es la misma en los dos
// importadores —cambia solo como se llega a la celda de la fecha—, asi que la
// hoja entrega sus valores crudos y aqui se leen con el mismo cleanDate que va a
// escribirlos despues.
function conteoDeFechas($fechas, $mes, $anio) {
    $__row = ['dentro' => 0, 'fuera' => 0, 'dias' => [], 'meses' => [], 'todos' => []];

    foreach ($fechas as $valor) {
        $fecha = cleanDate($valor);
        if ($fecha === null) continue;

        $tiempo = strtotime($fecha);
        $dentro = (int) date('n', $tiempo) === (int) $mes && (int) date('Y', $tiempo) === (int) $anio;

        $__row[$dentro ? 'dentro' : 'fuera']++;

        // Cuantos movimientos trae CADA mes, el del filtro incluido. Va aparte de
        // `meses` a proposito: aquel solo cuenta los ajenos porque de el sale el
        // destino que se ofrece, y el del filtro nunca puede serlo.
        $todos = date('n/Y', $tiempo);
        $__row['todos'][$todos] = isset($__row['todos'][$todos]) ? $__row['todos'][$todos] + 1 : 1;

        if ($dentro) continue;

        $dia = date('d/m/Y', $tiempo);
        $__row['dias'][$dia] = isset($__row['dias'][$dia]) ? $__row['dias'][$dia] + 1 : 1;

        // El mes al que de verdad pertenece el movimiento. Se cuenta aparte de los
        // dias porque es lo que el aviso enfrenta contra el periodo del filtro: al
        // usuario le sirve mas leer "el archivo es de agosto" que deducirlo de una
        // lista de fechas.
        $clave = date('n/Y', $tiempo);
        $__row['meses'][$clave] = isset($__row['meses'][$clave]) ? $__row['meses'][$clave] + 1 : 1;
    }

    return $__row;
}

// El veredicto del periodo: si el archivo pertenece o no al mes al que se esta
// subiendo.
//
// Se rechaza solo cuando la MAYORIA de los movimientos cae fuera. Unas pocas
// filas del mes anterior son normales —la cuenta que se abre a las 23:50 del
// ultimo dia y se cobra pasada la medianoche—, y bloquear por ellas seria negar
// cargas buenas. El archivo entero del mes equivocado, que es el error que
// importa, cae del lado del rechazo sin ambiguedad.
//
// Devuelve NULL cuando el periodo es correcto, para poder preguntarlo como una
// condicion.
function periodoAjeno($conteo, $mes, $anio) {
    if ($conteo['fuera'] === 0 || $conteo['fuera'] <= $conteo['dentro']) return null;

    // El mes con mas movimientos es el que el aviso nombra como "el del archivo":
    // con un export de un solo mes es el suyo, y con uno que cruza el corte es el
    // que manda. Los demas siguen en la lista de dias.
    $meses = $conteo['meses'];
    arsort($meses);
    $manda = key($meses);

    /*
        Que se objeta y que se reparte.

        Esta comprobacion nacio cuando un archivo era un lote sellado con el mes del
        filtro, y entonces la pregunta «¿es de este mes?» decidia donde caian todas
        sus filas. Desde que cada fila va al lote de SU mes, lo unico que queda por
        preguntar es si el usuario se equivoco de mes, y eso solo pasa cuando el mes
        que eligio no esta practicamente en el archivo.

        Un archivo de 1 284 movimientos de julio y 1 137 de agosto cargado en agosto
        NO es una equivocacion: casi la mitad del archivo es de agosto y el resto va
        a su mes solo. Objetarlo obligaba a «moverlo a julio» para acabar creando los
        dos lotes igual, pero desde el otro lado.

        Se objeta cuando se cumplen las dos:
          · el mes del filtro aporta menos de la decima parte del archivo, y
          · hay un mes ajeno que si es sustancial, al que ofrecer la carga.

        La segunda no sobra: sin ella, un export de un año entero —donde ningun mes
        llega al 10 %— se objetaria sin tener a donde ir, y «moverlo» pasearia por
        los meses sin llegar nunca a cargar.
    */
    $umbral = ($conteo['dentro'] + $conteo['fuera']) / 10;

    if ($conteo['dentro'] >= $umbral) return null;
    if (current($meses)   <  $umbral) return null;

    $dias = $conteo['dias'];
    krsort($dias);

    $lista = [];
    $tope  = 0;
    foreach ($dias as $dia => $filas) {
        $lista[] = ['dia' => $dia, 'filas' => $filas];
        $tope    = max($tope, $filas);
    }

    // El periodo que manda, tambien en numeros: con el escrito solo se puede
    // avisar, y lo que la pantalla ofrece es MOVER la carga a ese mes.
    $mesArchivo  = (int) strtok($manda, '/');
    $anioArchivo = (int) substr($manda, strpos($manda, '/') + 1);

    return [
        'motivo'      => 'periodo',
        'mes'         => (int) $mes,
        'anio'        => (int) $anio,
        'mesArchivo'  => $mesArchivo,
        'anioArchivo' => $anioArchivo,
        'dentro'    => $conteo['dentro'],
        'fuera'     => $conteo['fuera'],
        // Los dos periodos ya escritos, que es como los va a leer el aviso: el que
        // el usuario eligio y el que el archivo trae de verdad. Se resuelven aqui
        // con el catalogo del modulo y no en la pantalla, para que el nombre del
        // mes salga de un solo sitio.
        'periodoFiltro'  => periodoTexto($mes, $anio),
        'periodoArchivo' => periodoTexto($mesArchivo, $anioArchivo),
        // De que meses es el archivo y cuantos movimientos pone cada uno. Es el
        // reparto que va a ocurrir —un lote por mes— anunciado antes de cargar.
        'reparto'        => repartoPorMes($conteo, $mes, $anio),
        'mesesArchivo'   => count($meses),
        'dias'      => array_slice($lista, 0, 8),
        'masDias'   => max(0, count($lista) - 8),
        // Para dibujar la proporcion de cada dia sin que la pantalla tenga que
        // recorrer la lista buscando el mayor.
        'tope'      => $tope,
        'esperadas' => [],
        'libro'     => [],
        'columnas'  => [],
        'cargadas'  => []
    ];
}

// Los meses del archivo con sus movimientos, del mas antiguo al mas reciente.
//
// Es la respuesta a "¿cuantos son de julio y cuantos de agosto?", que con el total
// solo no se puede saber: 2 421 movimientos que no son de septiembre no dicen si
// son de un mes o de tres.
//
// El mes del filtro va SIEMPRE, aunque no ponga ninguno: es el que el usuario
// eligio, y verlo en cero es la mitad de la explicacion.
function repartoPorMes($conteo, $mes, $anio) {
    $todos = $conteo['todos'];
    $clave = $mes . '/' . $anio;

    if (!isset($todos[$clave])) $todos[$clave] = 0;

    uksort($todos, function ($a, $b) {
        $ordena = function ($k) {
            return ((int) substr($k, strpos($k, '/') + 1)) * 12 + (int) strtok($k, '/');
        };

        return $ordena($a) - $ordena($b);
    });

    $__row = [];

    foreach ($todos as $k => $movimientos) {
        $m = (int) strtok($k, '/');
        $a = (int) substr($k, strpos($k, '/') + 1);

        $__row[] = [
            'periodo'      => periodoTexto($m, $a),
            'mes'          => $m,
            'anio'         => $a,
            'movimientos'  => $movimientos,
            'esDelFiltro'  => ($m === (int) $mes && $a === (int) $anio)
        ];
    }

    return $__row;
}

// Como se resume el periodo ajeno en la linea del roadmap.
function resumenPeriodoAjeno($ajeno) {
    $dias = [];
    foreach (array_slice($ajeno['dias'], 0, 3) as $item) $dias[] = $item['dia'];

    return number_format($ajeno['fuera']) . ' movimiento(s) de ' . implode(', ', $dias)
         . ($ajeno['masDias'] > 0 ? ' y ' . $ajeno['masDias'] . ' dia(s) mas' : '');
}

function step($titulo, $estado, $detalle) {
    return [
        'titulo'  => $titulo,
        'estado'  => $estado,
        'detalle' => $detalle
    ];
}
