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

        El orden de este array es el orden en que se cargan las hojas: "Pagos"
        primero, "Reporte de ventas" despues.
    */
    function contrato() {
        return [
            'Pagos' => [
                'tab'          => 'sales-report',
                'target'       => 'payment',
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

        return [
            'status'  => $cargadas > 0 ? 200 : 500,
            'message' => $cargadas > 0
                ? 'Archivo procesado: ' . $cargadas . ' hoja(s) cargada(s)'
                : 'No se pudo cargar ninguna hoja del archivo',
            'steps'   => $steps,
            'hojas'   => $hojas
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
        else                                     $insertadas = $this->guardarComandas($limpias, $batchId);

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
            'rechazadas'   => $this->rechazadas
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
                // Los pagos NO se borran con las ventas: se desligan para que el
                // CASCADE no se los lleve y el nuevo lote los vuelva a cruzar.
                $this->mdl->unlinkSalePaymentByBatch([$lote['id']]);
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

    private function guardarComandas($rows, $batchId) {
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

        return $this->insertarPorBloques($data, 'detail');
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

        // Las ventas cierran la carga: los pagos ya estan en base esperando su
        // folio, asi que el cruce se dispara aqui.
        if ($insertadas > 0) $this->ligarPagos($batchId);

        return $insertadas;
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

    private function insertarBloque($chunk, $target) {
        $values = $this->util->sql($chunk);

        if ($target === 'sale')    return $this->mdl->createSale($values);
        if ($target === 'payment') return $this->mdl->createSalePayment($values);

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
