<?php
session_start();
if (empty($_POST['opc'])) exit(0);

// El modelo de Wansoft extiende al de Soft Restaurant, asi que este require trae
// los dos: el controlador hereda las dos familias de consultas y puede correr
// cualquiera de los dos importadores sin preguntar de quien es cada una.
require_once '../mdl/mdl-facture2-cargas.php';

// Los dos parsers conviven en memoria. Los helpers de mecanica (normalizeHeader,
// numVal, cleanDate, columnLetter, step…) los declara el de Soft y el de Wansoft
// los reusa, por eso este require va primero y no al reves.
require_once 'import-facture-cargas.php';
require_once 'import-facture2-cargas.php';

// PhpSpreadsheet (vendor) solo es necesario para procesar Excel en uploadFile().
// Se carga bajo demanda para que el resto del modulo opere sin el. La ruta se
// resuelve contra __DIR__ y no contra el directorio de trabajo, y se admite una
// copia junto al modulo: cuando se despliega solo la carpeta facture el vendor
// del proyecto no viaja con ella.
$__autoload = '';
foreach ([__DIR__ . '/../../src/vendor/autoload.php', __DIR__ . '/../vendor/autoload.php'] as $__ruta) {
    if (file_exists($__ruta)) { $__autoload = $__ruta; break; }
}
define('AUTOLOAD_PATH', $__autoload);

class ctrl extends mdl2 {

    public $branch;
    public $userId;

    // El importador y el POS se resuelven una vez por peticion: la sucursal no
    // cambia a media carga y preguntarlo seis veces seria seis consultas identicas.
    private $import;
    private $pos;

    public function __construct() {
        parent::__construct();
        $this->branch = $this->resolveBranch();
        $this->userId = (int) ($_SESSION['USR'] ?? $_POST['user_id'] ?? 1);
    }

    // -- Que POS esta operando --

    // El unico punto del modulo donde se decide con que parser se lee el Excel.
    // La respuesta sale de la SUCURSAL (branch.pos_id -> pos.code), no de la
    // sesion ni del nombre del archivo: cada sucursal opera un solo software de
    // punto de venta y de ese dato dependen el layout del reporte y el formato del
    // ticket.
    //
    // Sin POS definido se lee como Soft Restaurant, que es el que ya estaba: una
    // sucursal dada de alta antes del catalogo de POS sigue cargando como siempre
    // en vez de romperse.
    // El POS de la sucursal, resuelto una sola vez: la ficha completa porque la
    // pantalla necesita ademas su nombre y su color para anunciarlo.
    function posInfo() {
        if ($this->pos !== null) return $this->pos;

        $ls   = $this->getPosCode([$this->branchId()]);
        $item = $ls[0] ?? [];
        $code = strtolower((string) ($item['code'] ?? ''));

        // Sin POS definido se cae en Soft Restaurant, que es el que ya estaba, pero
        // el nombre se deja en claro que es un supuesto: una sucursal sin capturar
        // no debe verse igual que una capturada.
        $this->pos = $code === ''
            ? ['code' => 'soft-restaurant', 'name' => 'Sin definir', 'color' => '#6B7280']
            : [
                'code'  => $code,
                'name'  => $item['name']  ?: $code,
                'color' => $item['color'] ?: '#6B7280'
            ];

        return $this->pos;
    }

    function posCode() {
        return $this->posInfo()['code'];
    }

    function importador() {
        if ($this->import !== null) return $this->import;

        $this->import = $this->posCode() === 'wansoft'
            ? new ImportFacture2Cargas($this)
            : new ImportFactureCargas($this);

        return $this->import;
    }

    // Los contratos de TODOS los puntos de venta, no solo el que opera.
    //
    // Listar y cargar son operaciones del POS activo, pero BORRAR no: un lote
    // cargado con el otro sistema sigue ocupando el periodo y tiene que poder
    // limpiarse. Resolviendo su target contra el contrato activo se quedaba vacio,
    // y deleteCarga borraba la fila de la bitacora dejando huerfanos sus 13 mil
    // renglones, que ya nadie podia alcanzar.
    //
    // Las hojas de los dos POS tienen nombres distintos, asi que la union no pisa
    // nada: el contrato del que opera manda en caso de coincidir.
    function contratoCompleto() {
        $otro = $this->posCode() === 'wansoft'
            ? new ImportFactureCargas($this)
            : new ImportFacture2Cargas($this);

        return array_merge($otro->contrato(), $this->importador()->contrato());
    }

    // Las pestanas que el POS anuncia sin tener todavia el contrato de sus hojas.
    // Se pregunta con method_exists y no como parte de la interfaz: el importador
    // de Soft Restaurant no las necesita y no hay por que tocarlo para agregarle
    // un metodo que siempre devolveria un array vacio.
    function tabsReservados() {
        $importador = $this->importador();

        return method_exists($importador, 'tabsReservados') ? $importador->tabsReservados() : [];
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

    // branch_id admite NULL: sin sucursal dada de alta el modulo escribe las
    // filas sin sucursal en vez de romper la FK.
    function branchId() {
        return $this->branch > 0 ? $this->branch : null;
    }

    // Todo lo que el modulo necesita para pintarse sale del contrato del
    // importador: que pestanas hay, que archivo espera cada una, que hojas se leen
    // de el y los pasos del proceso. Asi lo que la pantalla promete y lo que el
    // importador exige no pueden separarse.
    function init() {
        $anios = $this->lsAnios([$this->branchId()]);

        if (empty($anios)) {
            $anios = [['id' => date('Y'), 'valor' => date('Y')]];
        }

        $importador = $this->importador();
        $contrato   = $importador->contrato();

        // Pestanas que el POS declara aunque su contrato de hojas no exista
        // todavia. Van al final, despues de las que si tienen hojas.
        $reservados = $this->tabsReservados();

        // El POS viaja al front para que la pantalla pueda decir con que sistema
        // esta operando: el usuario tiene que saber por que se le pide un archivo
        // y no otro.
        // El periodo con el que abre el modulo: el mes en curso.
        //
        // Sale del SERVIDOR y no del reloj del navegador, que es el mismo criterio
        // con el que se guardan las cargas: si la maquina del usuario tiene otra
        // fecha, el filtro apuntaria a un periodo distinto del que se escribiria en
        // el lote. El anio se limita a los que el select ofrece, para no arrancar
        // con un valor que no esta en la lista.
        $anioActual = date('Y');
        $enLista    = in_array($anioActual, array_column($anios, 'id'));

        return [
            'meses'    => mesesCatalogo(),
            'anios'    => $anios,
            'hoy'      => [
                'mes'  => date('m'),
                'anio' => $enLista ? $anioActual : (string) ($anios[0]['id'] ?? $anioActual)
            ],
            'pos'      => $this->posInfo(),
            'tabs'     => tabsContrato($contrato, $reservados),
            'archivos' => archivosContrato($contrato, $this->posCode(), $reservados),
            'hojas'    => hojasContrato($contrato, $reservados),
            'roadmap'  => roadmapContrato()
        ];
    }

    // -- Bitacora --

    function lsBitacora() {
        $tipo = $_POST['tipo'];
        $mes  = (int) $_POST['mes'];
        $anio = (int) $_POST['anio'];

        $importador = $this->importador();
        $contrato   = $importador->contrato();

        $__row  = [];
        $lotes  = [];
        $filas  = 0;
        $ultimo = null;
        $ajenos = [];
        $ls = $this->listImportBatch([$this->branchId(), $anio, $mes]);

        foreach ($ls as $item) {
            $tab = sheetTab($contrato, $item['sheet_name']);

            // Los lotes de OTRO punto de venta no se listan aqui, pero tampoco se
            // callan: siguen ocupando el periodo y una recarga no los va a
            // reemplazar, porque la sobreescritura es por hoja. Se cuentan para
            // que el pie del panel pueda decir que estan.
            if ($tab === '') {
                $ajenos[$item['sheet_name']] = ($ajenos[$item['sheet_name']] ?? 0) + (int) $item['row_count'];
                continue;
            }

            // La bitacora esta separada por pestana: la hoja de comandas nunca
            // aparece en el tab de ventas y viceversa.
            if ($tab !== $tipo) continue;

            // El listado viene ordenado por fecha DESC: el primero que pasa el
            // filtro es la carga mas reciente del periodo.
            if ($ultimo === null) $ultimo = $item;
            $filas += (int) $item['row_count'];

            // El archivo abre la fila, que es el dato con el que se busca una carga
            // en la bitacora; la hora queda como su acompanante.
            // La fila de la bitacora es la ficha de auditoria de la carga: quien la
            // hizo, que traia el archivo, que entro y que se descarto por repetido.
            // Sin las tres cifras juntas, un lote de 18 sobre un archivo de 36 no
            // se puede explicar.
            $__row[] = [
                'id'         => $item['id'],
                'Archivo'    => '<span class="font-semibold text-gray-300">' . $item['file_name'] . '</span>',
                'Hora'       => rowStamp($item['id'], $item['created_at']),
                'Usuario'    => userCell($item['user_name'], $item['user_id']),
                'Hoja'       => '<span class="text-gray-400">' . $item['sheet_name'] . '</span>',
                'Archivo (filas)' => '<span class="text-gray-400">' . number_format($item['source_rows']) . '</span>',
                'Validos'    => '<span class="font-semibold text-gray-300">' . number_format($item['row_count']) . '</span>',
                'Duplicados' => dupCell($item['duplicated_rows']),
                'Total'      => '<span class="text-gray-400">$' . number_format($item['control_total'], 2) . '</span>',
                'Estado'     => '<span class="badge-base b-green">OK</span>',
                'a'          => actionButtons($item['id'])
            ];

            // Los mismos lotes en crudo: con ellos el JS arma la tira de hojas
            // del periodo, que se ordena aparte con el 'orden' del contrato.
            $lotes[] = [
                'id'            => (int) $item['id'],
                'sheet_name'    => $item['sheet_name'],
                'source_rows'   => (int) $item['source_rows'],
                'duplicated'    => (int) $item['duplicated_rows'],
                // Solo la hoja que trae los pagos puede resumirse por mesero. Sale
                // del contrato y no del nombre de la hoja: si manana se renombra,
                // la pestana sigue apareciendo donde debe.
                'tips'          => ($contrato[$item['sheet_name']]['target'] ?? '') === 'wansoft-detail',
                'file_name'     => $item['file_name'],
                'row_count'     => (int) $item['row_count'],
                'control_total' => (float) $item['control_total'],
                'stamp'         => fechaLarga($item['created_at'])
            ];
        }

        // La bitacora llega de la mas reciente a la mas vieja: se invierte para
        // que dos cargas de la misma hoja queden en el orden en que entraron, y
        // ya sobre eso manda el contrato.
        return [
            'row'     => $__row,
            'thead'   => '',
            'center'  => [2, 3, 4, 7, 8],
            'right'   => [5, 6],
            'lotes'   => ordenarPorHoja(array_reverse($lotes), $contrato, 'sheet_name'),
            'ajenos'  => avisoAjenos($ajenos, $this->posInfo()),
            'archivo' => uploadState($ultimo, $filas)
        ];
    }

    // Los lotes que la pestana esta mostrando.
    //
    // Una pestana es una HOJA, no una carga: desde que el detalle es incremental,
    // el mismo periodo puede tener varias cargas de la misma hoja y las tres
    // juntas son lo que el usuario entiende por "Detalle por forma de pago". El
    // front manda sus ids y aqui se leen como un solo conjunto.
    //
    // Se admite `id` suelto ademas de `ids` porque el borrado de una carga sigue
    // siendo de UNA, y comparte endpoint.
    function loteIds() {
        $crudo = $_POST['ids'] ?? $_POST['id'] ?? '';
        $__row = [];

        foreach (explode(',', (string) $crudo) as $id) {
            $id = (int) trim($id);
            if ($id > 0) $__row[] = $id;
        }

        return $__row;
    }

    // -- Propinas por mesero --

    // La hoja "Propinas por mesero" del libro de Wansoft, reconstruida desde los
    // pagos del lote. No se carga como las otras porque no trae nada propio: es la
    // suma del detalle, y calcularla convierte la pestana en un cuadre contra el
    // Excel en vez de en una copia suya.
    //
    // El porcentaje es la PARTICIPACION en la propina del dia —lo que se lleva cada
    // mesero del bote— y no la propina sobre sus ventas: es como lo reporta el POS
    // y como se reparte en la practica.
    function lsPropinas() {
        $ids = $this->loteIds();

        if (empty($ids)) {
            return ['status' => 404, 'message' => 'La carga no existe', 'row' => []];
        }

        $ls    = $this->listTipsByWaiter($ids);
        $bote  = 0;
        $venta = 0;

        foreach ($ls as $item) {
            $bote  += (float) $item['propina'];
            $venta += (float) $item['ventas'];
        }

        // La comision sobre propina es del negocio y vive en la sucursal: con 0 la
        // columna neta repite la propina, que es lo que reporta el export medido.
        $emisor   = $this->getBranchCommission([$this->branchId()]);
        $comision = (float) ($emisor[0]['tip_commission_rate'] ?? 0);

        $__row = [];
        foreach ($ls as $item) {
            $propina = (float) $item['propina'];
            $resta   = round($propina * $comision / 100, 2);

            $__row[] = [
                'id'          => $item['waiter_name'],
                'Mesero'      => nameCell($item['waiter_name'] === '(sin mesero)' ? '' : $item['waiter_name']),
                'Pagos'       => '<span class="text-gray-400">' . (int) $item['pagos'] . '</span>',
                'Ventas'      => '<span class="text-gray-400">$' . number_format($item['ventas'], 2) . '</span>',
                'Propina'     => tipCell($propina),
                'Participa'   => porcentajeCell($bote > 0 ? $propina * 100 / $bote : 0),
                'Comision'    => '<span class="text-gray-400">$' . number_format($resta, 2) . '</span>',
                'Neto'        => '<span class="font-semibold text-gray-300">$' . number_format($propina - $resta, 2) . '</span>'
            ];
        }

        return [
            'status' => 200,
            'hoja'   => 'Propinas por mesero',
            'total'  => count($__row),
            'center' => [1, 4],
            'right'  => [2, 3, 5, 6],
            'row'    => $__row,
            'pie'    => [
                'meseros'  => count($__row),
                'ventas'   => $venta,
                'propinas' => round($bote, 2),
                'comision' => $comision
            ]
        ];
    }

    // -- Registros cargados de un lote --

    function lsRegistros() {
        $ids = $this->loteIds();

        if (empty($ids)) {
            return ['status' => 404, 'message' => 'La carga no existe', 'row' => []];
        }

        // La ficha de la hoja sale del primer lote; el conteo, de la suma de todos.
        $batch = $this->getImportBatchById([$ids[0]]);
        if (empty($batch)) {
            return ['status' => 404, 'message' => 'La carga no existe', 'row' => []];
        }

        $batch    = $batch[0];
        $importador = $this->importador();
        $contract   = $importador->contrato();
        $target     = isset($contract[$batch['sheet_name']]) ? $contract[$batch['sheet_name']]['target'] : '';

        // Cada hoja pinta columnas distintas, asi que la alineacion viaja con los
        // datos: el JS no puede adivinar en que posicion cayo cada campo.
        $__row  = [];
        $center = [];
        $right  = [];

        if ($target === 'sale') {
            $center = [1, 2, 3, 8, 9, 10];
            $right  = [4, 5, 6, 7];

            foreach ($this->listSaleByBatch($ids) as $item) {
                $__row[] = [
                    'id'                  => $item['folio'],
                    'Folio'               => '<span class="font-semibold text-gray-300">' . $item['folio'] . '</span>',
                    'Codigo facturacion'  => '<span class="text-gray-400 font-mono text-[10px]">' . $item['billing_code'] . '</span>',
                    'Fecha'               => '<span class="text-gray-400">' . fechaLarga($item['operation_date']) . '</span>',
                    // El POS exporta el descuento como importe, no como tasa: la
                    // columna se lee en pesos aunque el campo se llame _percent.
                    'Descuento'           => '<span class="text-gray-400">$' . number_format($item['discount_percent'], 2) . '</span>',
                    'Subtotal'            => '<span class="text-gray-400">$' . number_format($item['subtotal'], 2) . '</span>',
                    'Impuestos'           => '<span class="text-gray-400">$' . number_format($item['tax'], 2) . '</span>',
                    'Total'               => '<span class="font-semibold text-gray-300">$' . number_format($item['total'], 2) . '</span>',
                    'Expiracion'          => dateCell($item['expires_at']),
                    'Estado'              => saleStatusBadge($item['status_name']),
                    'Folio factura'       => invoiceCell($item['invoice_series'])
                ];
            }
        }

        if ($target === 'payment') {
            $center = [1, 2, 3];
            $right  = [4, 5, 6, 7, 8];

            foreach ($this->listSalePaymentByBatch($ids) as $item) {
                $__row[] = [
                    'id'              => $item['sale_folio'],
                    'Folio'           => '<span class="font-semibold text-gray-300">' . $item['sale_folio'] . '</span>',
                    'Metodo'          => '<span class="text-gray-400">' . $item['method_name'] . '</span>',
                    'Moneda'          => '<span class="text-gray-400">' . $item['currency'] . '</span>',
                    'Importe'         => '<span class="font-semibold text-gray-300">$' . number_format($item['amount'], 2) . '</span>',
                    'Tipo de cambio'  => '<span class="text-gray-400">' . number_format($item['exchange_rate'], 2) . '</span>',
                    'Subtotal'        => '<span class="text-gray-400">$' . number_format($item['sale_subtotal'], 2) . '</span>',
                    'Impuesto'        => '<span class="text-gray-400">$' . number_format($item['sale_tax'], 2) . '</span>',
                    'Total'           => '<span class="text-gray-400">$' . number_format($item['sale_total'], 2) . '</span>'
                ];
            }
        }

        if ($target === 'detail') {
            foreach ($this->listSaleDetailByBatch($ids) as $item) {
                $__row[] = [
                    'id'          => $item['sale_folio'],
                    'Cuenta'      => '<span class="font-semibold text-gray-300">' . $item['sale_folio'] . '</span>',
                    'Mesa'        => '<span class="text-gray-400">' . $item['table_number'] . '</span>',
                    'Mesero'      => '<span class="text-gray-400">' . $item['waiter_code'] . '</span>',
                    'Producto'    => '<span class="text-gray-400">' . $item['description'] . '</span>',
                    'Cantidad'    => '<span class="text-gray-400">' . (float) $item['quantity'] . '</span>',
                    'Importe'     => '<span class="font-semibold text-gray-300">$' . number_format($item['amount'], 2) . '</span>'
                ];
            }
        }

        // -- Hojas de Wansoft --

        // La hoja de detalle produjo ventas Y pagos de una sola pasada, y lo que se
        // lista es el PAGO: es lo que tiene una fila por cada fila del Excel. El
        // ticket se ve agrupado en el modulo de ventas.
        //
        // Las columnas van en el mismo orden que la hoja del POS —de Fecha a
        // Total— para que revisar una carga sea leer el Excel en pantalla, sin
        // tener que buscar donde quedo cada campo.
        if ($target === 'wansoft-detail') {
            $center = [1, 2, 3, 4, 5, 6, 8, 11];
            $right  = [13];

            foreach ($this->listPaymentWansoftByBatch($ids) as $item) {
                $__row[] = [
                    'id'          => $item['sale_folio'],
                    'Fecha'       => dateShortCell($item['operation_date']),
                    'Orden'       => '<span class="text-gray-400">' . $item['order_number'] . '</span>',
                    'Movimiento'  => '<span class="font-semibold text-gray-300">' . $item['pdv_movement'] . '</span>',
                    'Estatus'     => operationBadge($item['operation_status']),
                    'Mesero'      => nameCell($item['waiter_name']),
                    'Cajero'      => nameCell($item['cashier_name']),
                    'Forma'       => '<span class="text-gray-400">' . $item['method_name'] . '</span>',
                    'Fecha pago'  => dateShortCell($item['paid_at']),
                    'Referencia'  => '<span class="text-gray-400">' . $item['reference'] . '</span>',
                    'Transaccion' => monoCell($item['transaction_code']),
                    'Terminal'    => '<span class="text-gray-400">' . $item['terminal'] . '</span>',
                    'Validacion'  => monoCell($item['validation_code']),
                    'Total'       => '<span class="font-semibold text-gray-300">$' . number_format($item['amount'], 2) . '</span>'
                ];
            }
        }

        if ($target === 'card' || $target === 'card-refund') {
            $center = [1, 2, 3, 4, 5];
            $right  = [7];

            foreach ($this->listPaymentCardByBatch($ids) as $item) {
                $__row[] = [
                    'id'             => $item['pdv_order'],
                    'Orden'          => '<span class="font-semibold text-gray-300">' . $item['pdv_order'] . '</span>',
                    'Terminal'       => '<span class="text-gray-400">' . $item['terminal'] . '</span>',
                    'Operacion'      => '<span class="text-gray-400">' . $item['operation_type'] . '</span>',
                    'Banco'          => '<span class="text-gray-400">' . $item['bank'] . '</span>',
                    'Tarjeta'        => '<span class="text-gray-400">' . $item['card_type'] . '</span>',
                    'Numero'         => '<span class="text-gray-400 font-mono text-[10px]">' . $item['card_number'] . '</span>',
                    'Autorizacion'   => '<span class="text-gray-400 font-mono text-[10px]">' . $item['authorization_code'] . '</span>',
                    'Monto'          => '<span class="font-semibold text-gray-300">$' . number_format($item['amount'], 2) . '</span>',
                    'Fecha'          => dateCell($item['operation_date'])
                ];
            }
        }

        if ($target === 'deleted') {
            $center = [1, 2, 3, 4];
            $right  = [5, 6];

            foreach ($this->listDeletedPaymentByBatch($ids) as $item) {
                $__row[] = [
                    'id'        => $item['pdv_order'],
                    'Orden'     => '<span class="font-semibold text-gray-300">' . $item['pdv_order'] . '</span>',
                    'Mesero'    => '<span class="text-gray-400">' . $item['waiter_name'] . '</span>',
                    'Cajero'    => '<span class="text-gray-400">' . $item['cashier_name'] . '</span>',
                    'Forma'     => '<span class="text-gray-400">' . $item['method_name'] . '</span>',
                    'Borro'     => '<span class="text-gray-400">' . $item['modified_by'] . '</span>',
                    'Total'     => '<span class="font-semibold text-gray-300">$' . number_format($item['amount'], 2) . '</span>',
                    'Propina'   => tipCell($item['tip']),
                    'Operacion' => dateCell($item['operation_date'])
                ];
            }
        }

        // El nombre del archivo no viaja: el encabezado del detalle titula con la
        // hoja, que es lo que distingue lo que se esta viendo.
        $total = 0;
        foreach ($ids as $loteId) {
            $b = $this->getImportBatchById([$loteId]);
            $total += (int) ($b[0]['row_count'] ?? 0);
        }

        return [
            'status'  => 200,
            'hoja'    => $batch['sheet_name'],
            'total'   => $total,
            'center'  => $center,
            'right'   => $right,
            'row'     => $__row
        ];
    }

    // -- Carga de archivo --

    // Abre el Excel recibido sin tocar la base. Devuelve el documento o el error
    // ya redactado, porque la lectura falla igual en la revision previa y en la
    // carga y no tiene por que escribirse dos veces.
    function leerLibro() {
        if (!file_exists(AUTOLOAD_PATH)) {
            return ['error' => [
                'status'  => 500,
                'message' => 'PhpSpreadsheet (vendor) no esta instalado en este entorno. La subida de Excel solo opera donde el vendor existe.'
            ]];
        }
        require_once AUTOLOAD_PATH;

        if (empty($_FILES)) {
            return ['error' => ['status' => 400, 'message' => 'No se recibio ningun archivo en la peticion.']];
        }

        foreach ($_FILES as $fileData) {
            if ($fileData['error'] !== UPLOAD_ERR_OK) continue;

            try {
                $lector = \PhpOffice\PhpSpreadsheet\IOFactory::createReaderForFile($fileData['tmp_name']);
                $lector->setReadDataOnly(true);

                return ['documento' => $lector->load($fileData['tmp_name']), 'nombre' => $fileData['name']];
            } catch (Exception $e) {
                return ['error' => [
                    'status'  => 400,
                    'message' => 'No se pudo leer el archivo "' . $fileData['name'] . '": ' . $e->getMessage()
                ]];
            }
        }

        return ['error' => ['status' => 400, 'message' => 'No se proceso ningun archivo.']];
    }

    // Revision previa: dice a que pestana pertenece el archivo y si sus columnas
    // cuadran, sin guardar nada. Con eso el modulo arma una sola pregunta, la
    // correcta, en vez de confirmar un destino y desdecirse despues.
    function inspectFile() {
        $libro = $this->leerLibro();
        if (isset($libro['error'])) return $libro['error'];

        // El periodo viaja con la revision: sin el no se puede saber si el mes
        // destino ya tiene notas emitidas, que es lo primero que se comprueba.
        $importador = $this->importador();

        return $importador->inspeccionarLibro($libro['documento'], [
            'tipo'     => $_POST['tipo'] ?? '',
            'mes'      => (int) ($_POST['mes'] ?? 0),
            'anio'     => (int) ($_POST['anio'] ?? 0),
            'branchId' => $this->branchId()
        ]);
    }

    function uploadFile() {
        if (!file_exists(AUTOLOAD_PATH)) {
            return [
                'status'  => 500,
                'message' => 'PhpSpreadsheet (vendor) no esta instalado en este entorno. La subida de Excel solo opera donde el vendor existe.'
            ];
        }
        require_once AUTOLOAD_PATH;

        $mes  = (int) $_POST['mes'];
        $anio = (int) $_POST['anio'];

        // El periodo es parte de la carga, no un adorno del filtro: el lote se
        // guarda con el y la sobreescritura se decide por el.
        if ($mes < 1 || $mes > 12 || $anio < 2000) {
            return [
                'status'  => 400,
                'message' => 'Indica el mes y el anio del periodo antes de subir el archivo.',
                'steps'   => [step('Recibir archivo', 'error', 'Periodo sin especificar')]
            ];
        }

        if (empty($_FILES)) {
            return [
                'status'  => 400,
                'message' => 'No se recibio ningun archivo en la peticion.',
                'steps'   => [step('Recibir archivo', 'error', 'No llego ningun archivo')]
            ];
        }

        $resultado = ['status' => 400, 'message' => 'No se proceso ningun archivo.'];

        // Se lee directo del tmp_name: el Excel es la fuente de la carga, no un
        // adjunto que haya que conservar, y lo que queda en base es el lote.
        foreach ($_FILES as $fileData) {
            if ($fileData['error'] !== UPLOAD_ERR_OK) continue;

            $fichero = $fileData['name'];
            $steps   = [step('Recibir archivo', 'ok', $fichero)];

            try {
                $lector = \PhpOffice\PhpSpreadsheet\IOFactory::createReaderForFile($fileData['tmp_name']);
                $lector->setReadDataOnly(true);
                $documento = $lector->load($fileData['tmp_name']);
            } catch (Exception $e) {
                return [
                    'status'  => 400,
                    'message' => 'No se pudo leer el archivo "' . $fichero . '": ' . $e->getMessage(),
                    'steps'   => array_merge($steps, [step('Abrir libro', 'error', $e->getMessage())])
                ];
            }

            // La pestana viaja solo para redactar el aviso cuando el libro no trae
            // ninguna hoja conocida: sirve para decir que se esperaba ahi.
            // El usuario viaja con la carga para quedar en la bitacora. El nombre se
            // manda ademas del id porque se guarda como copia: el catalogo de
            // usuarios vive en otro esquema y una bitacora de auditoria no puede
            // depender de que ese usuario siga existiendo para poder leerse.
            $importador = $this->importador();
            $resultado  = $importador->procesarLibro($documento, [
                'fileName' => $fichero,
                'tipo'     => $_POST['tipo'] ?? '',
                'mes'      => $mes,
                'anio'     => $anio,
                'branchId' => $this->branchId(),
                'userId'   => $this->userId,
                'userName' => $_SESSION['NAME'] ?? '',
                'steps'    => $steps
            ]);
        }

        return $resultado;
    }

    function deleteCarga() {
        $status  = 500;
        $message = 'Error al eliminar la carga';
        $id      = (int) $_POST['id'];

        $batch = $this->getImportBatchById([$id]);
        if (empty($batch)) return ['status' => 404, 'message' => 'La carga no existe'];

        // El target se resuelve contra los DOS contratos: hay que poder borrar un
        // lote del otro POS, que es justo el que no aparece en la bitacora.
        $contract = $this->contratoCompleto();
        $sheet    = $batch[0]['sheet_name'];
        $target   = isset($contract[$sheet]) ? $contract[$sheet]['target'] : '';

        // Una hoja que ningun contrato conoce no se borra a ciegas: sin target no
        // se sabe en que tabla viven sus filas, y quitar el lote las dejaria
        // huerfanas sin forma de volver a alcanzarlas.
        if ($target === '') {
            return [
                'status'  => 409,
                'message' => 'La hoja "' . $sheet . '" no pertenece a ningun punto de venta conocido. Revisa el lote antes de borrarlo.'
            ];
        }

        $where = $this->util->sql(['import_batch_id' => $id], 1);

        // Pagos y renglones de comanda son la base del cruce y no se van con las
        // ventas: los dos se desligan antes para que el CASCADE de sale_id no los
        // borre. Son cargas propias, con su lote y su hoja.
        if ($target === 'sale') {
            $this->unlinkSalePaymentByBatch([$id]);
            $this->unlinkSaleDetailByBatch([$id]);
            $this->deleteSaleByBatch($where);
        }

        if ($target === 'payment') $this->deleteSalePaymentByBatch($where);
        if ($target === 'detail')  $this->deleteSaleDetailByBatch($where);

        // La hoja de detalle de Wansoft dejo ventas, pagos y el resumen del dia en
        // el mismo lote, asi que se van los tres. Los pagos se borran antes que las
        // ventas aunque el CASCADE de sale_id se los llevaria igual: hacerlo
        // explicito deja el conteo del lote correcto si manana esa FK cambia.
        if ($target === 'wansoft-detail') {
            $this->deleteDailySummaryByBatch($where);
            $this->deleteSalePaymentByBatch($where);
            $this->deleteSaleByBatch($where);
        }

        if ($target === 'card' || $target === 'card-refund') $this->deletePaymentCardByBatch($where);
        if ($target === 'deleted')                           $this->deleteDeletedPaymentByBatch($where);

        $delete = $this->deleteImportBatchById($this->util->sql(['id' => $id], 1));

        if ($delete) {
            $status  = 200;
            $message = 'Carga eliminada correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
    }
}

// Complements

function mesesCatalogo() {
    $nombres = [
        '01' => 'Enero',   '02' => 'Febrero',   '03' => 'Marzo',      '04' => 'Abril',
        '05' => 'Mayo',    '06' => 'Junio',     '07' => 'Julio',      '08' => 'Agosto',
        '09' => 'Septiembre', '10' => 'Octubre', '11' => 'Noviembre', '12' => 'Diciembre'
    ];

    $__row = [];
    foreach ($nombres as $id => $valor) $__row[] = ['id' => $id, 'valor' => $valor];

    return $__row;
}

// La pestana a la que pertenece cada hoja del export, o cadena vacia si la hoja
// no es de este POS.
//
// Antes lo desconocido caia en 'sales-report' por defecto, y con un solo punto de
// venta eso era inofensivo: cualquier hoja que no estuviera en el contrato era de
// una version vieja del mismo reporte. Con dos POS deja de serlo. Una sucursal
// que cambia de Soft Restaurant a Wansoft conserva sus lotes viejos, y ese
// default los colaba en la bitacora del POS nuevo: la pestana "comandas" aparecia
// dentro de la Terminal Wansoft, que no tiene comandas.
//
// Un lote cuya hoja no esta en el contrato activo no se puede ni mostrar: su
// pestana de detalle no sabria que columnas pintar, porque el target sale del
// mismo contrato.
function sheetTab($contrato, $sheetName) {
    return isset($contrato[$sheetName]) ? $contrato[$sheetName]['tab'] : '';
}

// Las pestanas del modulo: una por archivo del POS. El contrato agrupa sus hojas
// por tab, asi que de ahi salen sin escribirlas dos veces.
function tabsContrato($contrato, $reservados = []) {
    $meta = [
        'sales-report' => ['tab' => 'Reporte de ventas', 'lucideIcon' => 'sheet'],
        'commands'     => ['tab' => 'Comandas',          'lucideIcon' => 'utensils']
    ];

    $__row = [];
    foreach ($contrato as $config) {
        $tab = $config['tab'];
        if (isset($__row[$tab])) continue;

        $__row[$tab] = array_merge(['id' => $tab, 'tab' => $tab, 'lucideIcon' => 'sheet'], $meta[$tab] ?? []);
    }

    // Las reservadas cierran la tira: existen en la pantalla pero todavia no
    // tienen hojas que leer, asi que no pueden ir antes de las que si operan.
    foreach ($reservados as $tab => $config) {
        if (isset($__row[$tab])) continue;

        $__row[$tab] = array_merge(
            ['id' => $tab, 'tab' => $tab, 'lucideIcon' => 'sheet'],
            $meta[$tab] ?? [],
            ['pendiente' => true]
        );
    }

    return array_values($__row);
}

// La fila de carga de cada pestana: que archivo se espera, con que nombre lo
// exporta el POS y el patron con el que se avisa cuando el que se sube no
// corresponde. El patron viaja como texto porque cruza en JSON; el JS lo arma.
function archivosContrato($contrato, $posCode = 'soft-restaurant', $reservados = []) {
    // Cada POS exporta su propio archivo y con su propio nombre, asi que la fila
    // de carga cambia con el: anunciar "Reporte_De_Ventas_YYYYMMDD.xlsx" a una
    // sucursal de Wansoft seria pedirle un archivo que su sistema no genera.
    $porPos = [
        'wansoft' => [
            'sales-report' => [
                'titulo'    => 'Reporte de ventas por forma de pago',
                'subtitulo' => 'Sube un solo archivo. De la hoja "Detalle por forma de pago" salen los tickets y sus pagos —con propina, mesero y cajero— y el resumen del dia. Las hojas de terminal bancaria y de pagos eliminados se cargan si el archivo las trae con movimientos.',
                'esperado'  => 'ReporteVentasPorFormaDePagoYYYY-MM-DD.xlsx',
                'ejemplo'   => 'ReporteVentasPorFormaDePago2026-08-23',
                'patron'    => 'reporte|venta|forma|pago',
                'formato'   => 'XLSX'
            ]
        ]
    ];

    $archivos = [
        'sales-report' => [
            'titulo'    => 'Reporte de ventas',
            'subtitulo' => 'Sube un solo archivo. El sistema carga primero la hoja "Pagos" (formas de pago) y despues "Reporte de ventas" (tickets), que las cruza por folio.',
            'esperado'  => 'Reporte_De_Ventas_YYYYMMDD.xlsx',
            'ejemplo'   => 'Reporte_De_Ventas_YYYYMMDD',
            'patron'    => 'reporte|venta',
            'formato'   => 'XLSX'
        ],
        'commands' => [
            'titulo'    => 'Archivo de comandas',
            'subtitulo' => 'Renglones del POS: que se consumio, mesa, mesero y tiempos. Da de alta los productos y meseros que el catalogo no conoce y liga cada renglon con su ticket.',
            'esperado'  => 'comandas.xls',
            'ejemplo'   => 'comandas',
            'patron'    => 'comanda',
            'formato'   => 'XLS'
        ]
    ];

    if (isset($porPos[$posCode])) $archivos = array_merge($archivos, $porPos[$posCode]);

    $__row = [];
    foreach ($contrato as $nombre => $config) {
        $tab = $config['tab'];
        if (isset($__row[$tab])) continue;

        // El modo de carga viaja con la ficha del archivo: la pantalla tiene que
        // avisar cosas distintas segun el periodo se reemplace o se complete.
        $__row[$tab] = array_merge(
            ['id' => $tab, 'titulo' => $tab, 'esperado' => '', 'formato' => '', 'patron' => '.'],
            $archivos[$tab] ?? [],
            ['estado' => 'pendiente', 'modo' => $config['modo'] ?? 'reemplazo']
        );
    }

    // La ficha de una pestana reservada la escribe el propio importador: es el que
    // sabe por que todavia no tiene contrato y que se puede hacer mientras tanto.
    foreach ($reservados as $tab => $config) {
        if (isset($__row[$tab])) continue;

        $__row[$tab] = array_merge(
            ['id' => $tab, 'titulo' => $tab, 'esperado' => '', 'formato' => '', 'patron' => '.'],
            $config,
            ['estado' => 'pendiente']
        );
    }

    return $__row;
}

// Pasos del proceso de carga, en reposo. Son los mismos que devuelve uploadFile
// cuando corre: el modulo los usa para mostrar el avance mientras el servidor
// trabaja, y al responder se reemplazan por los reales.
function roadmapContrato() {
    return [
        ['titulo' => 'Recibir archivo',  'estado' => 'pendiente', 'detalle' => 'Sube el Excel del periodo'],
        ['titulo' => 'Detectar hojas',   'estado' => 'pendiente', 'detalle' => 'Se buscan las hojas del contrato'],
        ['titulo' => 'Validar columnas', 'estado' => 'pendiente', 'detalle' => 'Se comparan contra el formato del POS'],
        ['titulo' => 'Guardar en base',  'estado' => 'pendiente', 'detalle' => 'Un lote por hoja y sus cruces']
    ];
}

// Las hojas que espera cada pestana salen del mismo contrato con el que se valida
// el Excel: asi lo que el panel anuncia y lo que el importador exige no se separan.
// Cada hoja viaja con su mapeo columna -> campo, que es lo que hace falta para
// migrar la informacion.
function hojasContrato($contrato, $reservados = []) {
    $__row = [];

    foreach ($contrato as $nombre => $config) {
        // La tabla no siempre arranca en la columna A: las hojas de Wansoft dejan
        // la A (y a veces la B) como margen del reporte. Sin respetar startIndex el
        // panel anunciaria "A:Q" donde el importador lee "B:R", y quien fuera a
        // revisar el Excel buscaria las columnas una de mas a la izquierda.
        $inicio   = isset($config['startIndex']) ? $config['startIndex'] : 0;
        $columnas = [];

        foreach ($config['columns'] as $i => $campo) {
            $columnas[] = ['letra' => columnLetter($inicio + $i), 'campo' => $campo];
        }

        $primera = columnLetter($inicio);
        $ultima  = columnLetter($inicio + count($config['columns']) - 1);

        $__row[$config['tab']][] = [
            'nombre'   => $nombre,
            'detalle'  => 'columnas ' . $primera . ':' . $ultima . ' · header fila ' . $config['headerRow'],
            'columnas' => $columnas
        ];
    }

    // El panel anuncia las hojas en el mismo orden en que se leen en la tira:
    // si el aside dijera una cosa y las pestanas otra, se leerian como dos
    // listas distintas del mismo archivo.
    foreach ($__row as $tab => $hojas) {
        $__row[$tab] = ordenarPorHoja($hojas, $contrato, 'nombre');
    }

    // El aside de una pestana reservada no puede quedarse en blanco: diria que el
    // archivo no tiene hojas, cuando lo que pasa es que todavia no se han medido.
    foreach ($reservados as $tab => $config) {
        if (isset($__row[$tab])) continue;

        $__row[$tab] = [[
            'nombre'   => 'Layout por definir',
            'detalle'  => 'Sube el archivo y el modulo listara sus hojas y columnas',
            'columnas' => []
        ]];
    }

    return $__row;
}

// El data-batch viaja en la celda para que la fila completa sea clickeable:
// createCoffeeTable3 no expone el id del registro en el <tr>.
function rowStamp($id, $created) {
    return '<span data-batch="' . $id . '" class="text-gray-400">' . fechaLarga($created) . '</span>';
}

// El mes va en texto y en espanol: date() solo lo da en ingles y setlocale no
// es fiable en el Windows donde corre el WAMP, asi que se traduce a mano.
function fechaLarga($fecha) {
    if (empty($fecha)) return '';

    $meses = [
        1 => 'enero',   2  => 'febrero',   3  => 'marzo',      4  => 'abril',
        5 => 'mayo',    6  => 'junio',     7  => 'julio',      8  => 'agosto',
        9 => 'septiembre', 10 => 'octubre', 11 => 'noviembre', 12 => 'diciembre'
    ];

    $time = strtotime($fecha);

    return date('d', $time) . '/ ' . $meses[(int) date('n', $time)] . '/ ' . date('Y h:i a', $time);
}

// Lo que el periodo tiene cargado de OTRO punto de venta. Un lote asi no se
// puede listar —sus columnas no son las de este contrato— pero ocultarlo sin
// decir nada seria peor: sus filas siguen en la base, cuentan en los totales del
// modulo y la carga del POS actual no las va a reemplazar, porque la
// sobreescritura del periodo es hoja por hoja.
function avisoAjenos($ajenos, $pos) {
    if (empty($ajenos)) return null;

    $partes = [];
    $filas  = 0;

    foreach ($ajenos as $hoja => $conteo) {
        $partes[] = $hoja;
        $filas   += $conteo;
    }

    return [
        'hojas' => $partes,
        'filas' => $filas,
        'texto' => count($partes) . ' hoja(s) de otro punto de venta en este periodo · '
                 . implode(' · ', $partes) . ' · ' . number_format($filas) . ' filas',
        'nota'  => 'La sucursal opera ' . $pos['name'] . ' y estas cargas son de otro sistema. No se listan aqui porque sus columnas no son las de este contrato.'
    ];
}

// El estado de la fila de carga sale de la propia bitacora: si el periodo ya
// tiene lotes, la pestana deja de estar "pendiente" y dice que trae datos, con
// que archivo entraron y cuando.
function uploadState($ultimo, $filas) {
    if (empty($ultimo)) return ['estado' => 'pendiente', 'cargado' => ''];

    return [
        'estado'  => 'ok',
        'cargado' => $ultimo['file_name'] . ' · ' . number_format($filas) . ' filas · ' . fechaLarga($ultimo['created_at'])
    ];
}

// Fecha en tres letras y sin hora: 22/ago/2026.
//
// Wansoft exporta la fecha SIN hora, asi que el formato largo le pegaba un
// "12:00 a. m." que no estaba en el archivo: una precision inventada. Ademas la
// hoja de detalle son trece columnas y dos de ellas son fechas; en formato largo
// cada celda se partia en dos lineas y empujaba al resto.
function fechaCorta($fecha) {
    if (empty($fecha)) return '';

    $meses = [
        1 => 'ene', 2  => 'feb', 3  => 'mar', 4  => 'abr',
        5 => 'may', 6  => 'jun', 7  => 'jul', 8  => 'ago',
        9 => 'sep', 10 => 'oct', 11 => 'nov', 12 => 'dic'
    ];

    $time = strtotime($fecha);

    return date('d', $time) . '/' . $meses[(int) date('n', $time)] . '/' . date('Y', $time);
}

function dateShortCell($fecha) {
    if (empty($fecha)) return '<span class="cell-null">Sin fecha</span>';

    return '<span class="text-gray-400 whitespace-nowrap">' . fechaCorta($fecha) . '</span>';
}

// El POS no siempre exporta la fecha de expiracion: la celda vacia se dice, para
// que no se lea como una fecha que no alcanzo a pintarse.
function dateCell($fecha) {
    if (empty($fecha)) return '<span class="cell-null">Sin fecha</span>';

    return '<span class="text-gray-400">' . fechaLarga($fecha) . '</span>';
}

// Sin folio de factura la celda no se deja vacia: un pago sin facturar y un pago
// cuya venta todavia no entro al sistema se leen igual y hay que distinguirlos.
function invoiceCell($series) {
    if (empty($series)) return '<span class="cell-null">Sin factura</span>';

    return '<span class="font-mono text-[10px] text-gray-300">' . $series . '</span>';
}

// Un nombre que no llego no es lo mismo que uno vacio: el POS pudo no exportarlo,
// o el cruce contra el catalogo pudo fallar. En los dos casos hay algo que
// revisar, y una celda en blanco no lo dice.
function nameCell($nombre) {
    if (empty($nombre)) return '<span class="cell-null">Sin asignar</span>';

    return '<span class="text-gray-400">' . $nombre . '</span>';
}

// Referencias, transacciones y codigos de validacion son cadenas del banco: en
// monoespaciado se comparan de un vistazo contra el voucher, que es para lo que
// se miran.
function monoCell($valor) {
    if ($valor === null || $valor === '') return '<span class="cell-null">—</span>';

    return '<span class="text-gray-400 font-mono text-[10px]">' . $valor . '</span>';
}

// El estatus operativo del ticket (Pagada / Cancelada / Eliminada), que no es el
// fiscal. Solo "Pagada" se pinta en verde: el resto son estados que piden mirar.
function operationBadge($name) {
    if (empty($name)) return '<span class="cell-null">Sin estado</span>';

    $tone = strcasecmp($name, 'Pagada') === 0 ? 'b-green' : 'b-yellow';

    return '<span class="badge-base ' . $tone . '">' . $name . '</span>';
}

// El reparto de la propina del dia. Con un decimal basta: la hoja del POS trae
// cuatro y nadie reparte un bote con esa precision.
function porcentajeCell($valor) {
    if ($valor <= 0) return '<span class="cell-null">0%</span>';

    return '<span class="text-gray-400">' . number_format($valor, 1) . '%</span>';
}

// Quien subio el archivo. El nombre se guarda copiado en el lote, asi que la
// bitacora se lee sin cruzar contra el esquema de usuarios —que es de otro modulo
// y puede no existir el dia de la auditoria.
function userCell($nombre, $id) {
    if (empty($nombre)) {
        return $id
            ? '<span class="text-gray-400">usuario ' . (int) $id . '</span>'
            : '<span class="cell-null">Sin registrar</span>';
    }

    return '<span class="text-gray-400">' . $nombre . '</span>';
}

// Los duplicados en cero no se pintan como un dato mas: la carga limpia es el
// caso normal y llenar la columna de ceros esconderia las que si omitieron algo.
function dupCell($duplicados) {
    if ((int) $duplicados === 0) return '<span class="cell-null">—</span>';

    return '<span class="badge-base b-yellow">' . number_format($duplicados) . '</span>';
}

// La propina en cero es informacion, no un hueco: en Wansoft la mayoria de los
// pagos no la llevan y hay que poder distinguir "no dejo propina" de "este POS no
// reporta propinas".
function tipCell($tip) {
    if ((float) $tip <= 0) return '<span class="cell-null">Sin propina</span>';

    return '<span class="text-gray-300">$' . number_format($tip, 2) . '</span>';
}

function saleStatusBadge($name) {
    $tone = strtoupper($name) === 'FACTURADO' ? 'b-green' : 'b-yellow';
    return '<span class="badge-base ' . $tone . '">' . $name . '</span>';
}

// La hoja de la carga se abre desde su pestana en la tira, asi que la fila de la
// bitacora solo conserva la accion que no vive en otro lado: eliminar el lote.
function actionButtons($id) {
    return [
        [
            'class'   => 'btn-icon-danger',
            'title'   => 'Eliminar',
            'html'    => '<i data-lucide="trash-2" class="w-4 h-4"></i>',
            'onclick' => "cargas.deleteCarga({$id})"
        ]
    ];
}

$obj = new ctrl();
echo json_encode($obj->{$_POST['opc']}());
