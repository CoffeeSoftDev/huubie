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
    // su venta, su producto y su mesero.
    private $productos = 0;
    private $meseros   = 0;
    private $renglones = 0;

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
                'columns' => [
                    'foliocomanda', 'foliocuenta', 'orden', 'fechaapertura', 'fechacierre',
                    'mesero', 'claveproducto', 'fechadecaptura', 'descripcion', 'cantidad',
                    'descuento', 'importe'
                ]
            ]
        ];
    }

    // Router: recorre las hojas del contrato que trae el libro, valida su
    // estructura y guarda las que pasan. Devuelve siempre 'status' (200 al
    // procesar al menos una hoja, 400 si no reconoce ninguna).
    function procesarLibro($documento, $ctx) {
        $contrato = $this->contrato();
        $hojasLibro = $documento->getSheetNames();

        $presentes = [];
        foreach ($contrato as $nombre => $config) {
            if (in_array($nombre, $hojasLibro)) $presentes[] = $nombre;
        }

        $steps = $ctx['steps'];
        $steps[] = step(
            'Detectar hojas',
            count($presentes) ? 'ok' : 'error',
            count($presentes) ? implode(' · ', $presentes) : 'El libro trae: ' . implode(' · ', $hojasLibro)
        );

        if (empty($presentes)) {
            return [
                'status'  => 400,
                'message' => 'El archivo no contiene las hojas "Reporte de ventas" ni "Pagos". No se modifico ningun dato.',
                'steps'   => $steps,
                'hojas'   => []
            ];
        }

        $hojas    = [];
        $cargadas = 0;

        foreach ($presentes as $nombre) {
            $config = $contrato[$nombre];
            $hoja   = $documento->getSheetByName($nombre);
            $faltan = $this->validarEncabezados($hoja, $config['columns'], $config['headerRow']);

            if (!empty($faltan)) {
                $steps[] = step('Validar columnas de "' . $nombre . '"', 'error', implode(', ', $faltan));
                $hojas[] = [
                    'nombre'  => $nombre,
                    'estado'  => 'error',
                    'detalle' => 'Columnas que no coinciden: ' . implode(', ', $faltan),
                    'filas'   => 0
                ];
                continue;
            }

            $ultima  = columnLetter(count($config['columns']) - 1);
            $steps[] = step('Validar columnas de "' . $nombre . '"', 'ok', count($config['columns']) . ' columnas A:' . $ultima);


            $carga     = $this->guardarHoja($nombre, $config, $hoja, $ctx);
            $cargadas += $carga['insertadas'] > 0 ? 1 : 0;

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
        return [
            'status'  => $cargadas > 0 ? 200 : 500,
            'message' => $cargadas > 0
                ? 'Archivo procesado: ' . $cargadas . ' hoja(s) cargada(s)'
                : 'No se pudo cargar ninguna hoja del archivo',
            'steps'   => $steps,
            'hojas'   => ordenarPorHoja($hojas, $contrato, 'nombre')
        ];
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
        if ($carga['productos']  > 0) $cola .= ' · ' . number_format($carga['productos']) . ' productos nuevos al catalogo';
        if ($carga['meseros']    > 0) $cola .= ' · ' . number_format($carga['meseros']) . ' meseros nuevos al catalogo';
        if ($carga['renglones']  > 0) $cola .= ' · ' . number_format($carga['renglones']) . ' renglones ligados a su ticket';

        return $cola;
    }

    // Devuelve las columnas del contrato que NO estan en su posicion.
    private function validarEncabezados($hoja, $columns, $headerRow) {
        $faltan = [];

        foreach ($columns as $i => $name) {
            $letra  = columnLetter($i);
            $actual = (string) $hoja->getCell($letra . $headerRow)->getValue();

            if (normalizeHeader($actual) !== normalizeHeader($name)) {
                $faltan[] = $letra . ': se esperaba "' . $name . '"';
            }
        }

        return $faltan;
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
        $this->productos  = 0;
        $this->meseros    = 0;
        $this->renglones  = 0;

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

        $batch = $this->util->sql([
            'file_name'       => $ctx['fileName'],
            'sheet_name'      => $sheetName,
            'period_year'     => $ctx['anio'],
            'period_month'    => $ctx['mes'],
            'row_count'       => count($limpias),
            'control_total'   => $control,
            'created_at'      => date('Y-m-d H:i:s'),
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

    // Alta de los productos que la hoja trae y el catalogo todavia no. El producto
    // nace del primer renglon en que aparece y se queda con lo que ese renglon
    // dice: la descripcion y el importe, tal cual vienen en la hoja. No se calcula
    // nada (no se divide entre la cantidad ni se busca el importe mas alto): el
    // catalogo guarda lo que el Excel trajo, y corregirlo es trabajo de quien lo
    // administra, no del importador.
    //
    // Un producto cuyos renglones van SIEMPRE en cero no se vende solo: es un
    // modificador (la guarnicion o la preparacion que acompana a un platillo), y
    // asi queda marcado para que no entre a armar tickets.
    private function sembrarProductos($rows, $ctx) {
        $existen = [];
        foreach ($this->mdl->listProduct([$ctx['branchId']]) as $item) $existen[$item['code']] = true;

        $catalogo = [];

        foreach ($rows as $v) {
            $code = $v[6];
            if ($code === '' || isset($existen[$code])) continue;

            if (!isset($catalogo[$code])) {
                $catalogo[$code] = ['name' => $v[8], 'price' => numVal($v[11]), 'is_modifier' => 1];
            }

            if (numVal($v[11]) > 0) $catalogo[$code]['is_modifier'] = 0;
        }

        $data = [];
        foreach ($catalogo as $code => $item) {
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

function step($titulo, $estado, $detalle) {
    return [
        'titulo'  => $titulo,
        'estado'  => $estado,
        'detalle' => $detalle
    ];
}
