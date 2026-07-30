<?php
session_start();
if (empty($_POST['opc'])) exit(0);

require_once '../mdl/mdl-facture-cargas.php';
require_once 'import-facture-cargas.php';

// PhpSpreadsheet (vendor) solo es necesario para procesar Excel en uploadFile().
// Se carga bajo demanda para que el resto del modulo opere sin el.
define('AUTOLOAD_PATH', '../../src/vendor/autoload.php');

class ctrl extends mdl {

    public $branch;
    public $userId;

    public function __construct() {
        parent::__construct();
        $this->branch = $this->resolveBranch();
        $this->userId = (int) ($_SESSION['USR'] ?? $_POST['user_id'] ?? 1);
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

        $importador = new ImportFactureCargas($this);
        $contrato   = $importador->contrato();

        return [
            'meses'    => mesesCatalogo(),
            'anios'    => $anios,
            'tabs'     => tabsContrato($contrato),
            'archivos' => archivosContrato($contrato),
            'hojas'    => hojasContrato($contrato),
            'roadmap'  => roadmapContrato()
        ];
    }

    // -- Bitacora --

    function lsBitacora() {
        $tipo = $_POST['tipo'];
        $mes  = (int) $_POST['mes'];
        $anio = (int) $_POST['anio'];

        $importador = new ImportFactureCargas($this);
        $contrato   = $importador->contrato();

        $__row  = [];
        $lotes  = [];
        $filas  = 0;
        $ultimo = null;
        $ls = $this->listImportBatch([$this->branchId(), $anio, $mes]);

        foreach ($ls as $item) {
            // La bitacora esta separada por pestana: la hoja de comandas nunca
            // aparece en el tab de ventas y viceversa.
            if (sheetTab($contrato, $item['sheet_name']) !== $tipo) continue;

            // El listado viene ordenado por fecha DESC: el primero que pasa el
            // filtro es la carga mas reciente del periodo.
            if ($ultimo === null) $ultimo = $item;
            $filas += (int) $item['row_count'];

            // El archivo abre la fila, que es el dato con el que se busca una carga
            // en la bitacora; la hora queda como su acompanante.
            $__row[] = [
                'id'      => $item['id'],
                'Archivo' => '<span class="font-semibold text-gray-300">' . $item['file_name'] . '</span>',
                'Hora'    => rowStamp($item['id'], $item['created_at']),
                'Hoja'    => '<span class="text-gray-400">' . $item['sheet_name'] . '</span>',
                'Filas'   => '<span class="text-gray-400">' . number_format($item['row_count']) . '</span>',
                'Estado'  => '<span class="badge-base b-green">OK</span>',
                'a'       => actionButtons($item['id'])
            ];

            // Los mismos lotes en crudo: con ellos el JS arma la tira de hojas del
            // periodo. Van en el orden de insercion (pagos antes que ventas), que
            // es el orden en que se leyeron del Excel.
            $lotes[] = [
                'id'            => (int) $item['id'],
                'sheet_name'    => $item['sheet_name'],
                'file_name'     => $item['file_name'],
                'row_count'     => (int) $item['row_count'],
                'control_total' => (float) $item['control_total'],
                'stamp'         => fechaLarga($item['created_at'])
            ];
        }

        return [
            'row'     => $__row,
            'thead'   => '',
            'lotes'   => array_reverse($lotes),
            'archivo' => uploadState($ultimo, $filas)
        ];
    }

    // -- Registros cargados de un lote --

    function lsRegistros() {
        $id = (int) $_POST['id'];

        $batch = $this->getImportBatchById([$id]);
        if (empty($batch)) {
            return ['status' => 404, 'message' => 'La carga no existe', 'row' => []];
        }

        $batch    = $batch[0];
        $importador = new ImportFactureCargas($this);
        $contract   = $importador->contrato();
        $target     = isset($contract[$batch['sheet_name']]) ? $contract[$batch['sheet_name']]['target'] : '';

        // Cada hoja pinta columnas distintas, asi que la alineacion viaja con los
        // datos: el JS no puede adivinar en que posicion cayo cada campo.
        $__row  = [];
        $center = [];
        $right  = [];

        if ($target === 'sale') {
            $center = [1, 2, 3, 6];
            $right  = [4, 5];

            foreach ($this->listSaleByBatch([$id]) as $item) {
                $__row[] = [
                    'id'       => $item['folio'],
                    'Folio'    => '<span class="font-semibold text-gray-300">' . $item['folio'] . '</span>',
                    'Codigo'   => '<span class="text-gray-400 font-mono text-[10px]">' . $item['billing_code'] . '</span>',
                    'Fecha'    => '<span class="text-gray-400">' . fechaLarga($item['operation_date']) . '</span>',
                    'Subtotal' => '<span class="text-gray-400">$' . number_format($item['subtotal'], 2) . '</span>',
                    'Total'    => '<span class="font-semibold text-gray-300">$' . number_format($item['total'], 2) . '</span>',
                    'Estado'   => saleStatusBadge($item['status_name'])
                ];
            }
        }

        if ($target === 'payment') {
            $center = [1, 2, 3, 9];
            $right  = [4, 5, 6, 7, 8];

            foreach ($this->listSalePaymentByBatch([$id]) as $item) {
                $__row[] = [
                    'id'              => $item['sale_folio'],
                    'Folio'           => '<span class="font-semibold text-gray-300">' . $item['sale_folio'] . '</span>',
                    'Metodo'          => '<span class="text-gray-400">' . $item['method_name'] . '</span>',
                    'Moneda'          => '<span class="text-gray-400">' . $item['currency'] . '</span>',
                    'Importe'         => '<span class="font-semibold text-gray-300">$' . number_format($item['amount'], 2) . '</span>',
                    'Tipo de cambio'  => '<span class="text-gray-400">' . number_format($item['exchange_rate'], 2) . '</span>',
                    'Subtotal'        => '<span class="text-gray-400">$' . number_format($item['sale_subtotal'], 2) . '</span>',
                    'Impuesto'        => '<span class="text-gray-400">$' . number_format($item['sale_tax'], 2) . '</span>',
                    'Total'           => '<span class="text-gray-400">$' . number_format($item['sale_total'], 2) . '</span>',
                    'Folio factura'   => invoiceCell($item['invoice_series'])
                ];
            }
        }

        if ($target === 'detail') {
            foreach ($this->listSaleDetailByBatch([$id]) as $item) {
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

        // El nombre del archivo no viaja: el encabezado del detalle titula con la
        // hoja, que es lo que distingue lo que se esta viendo.
        return [
            'status'  => 200,
            'hoja'    => $batch['sheet_name'],
            'total'   => (int) $batch['row_count'],
            'center'  => $center,
            'right'   => $right,
            'row'     => $__row
        ];
    }

    // -- Carga de archivo --

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

            $importador = new ImportFactureCargas($this);
            $resultado  = $importador->procesarLibro($documento, [
                'fileName' => $fichero,
                'mes'      => $mes,
                'anio'     => $anio,
                'branchId' => $this->branchId(),
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

        $importador = new ImportFactureCargas($this);
        $contract   = $importador->contrato();
        $sheet      = $batch[0]['sheet_name'];
        $target     = isset($contract[$sheet]) ? $contract[$sheet]['target'] : '';

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

// La pestana a la que pertenece cada hoja del export.
function sheetTab($contrato, $sheetName) {
    return isset($contrato[$sheetName]) ? $contrato[$sheetName]['tab'] : 'sales-report';
}

// Las pestanas del modulo: una por archivo del POS. El contrato agrupa sus hojas
// por tab, asi que de ahi salen sin escribirlas dos veces.
function tabsContrato($contrato) {
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

    return array_values($__row);
}

// La fila de carga de cada pestana: que archivo se espera, con que nombre lo
// exporta el POS y el patron con el que se avisa cuando el que se sube no
// corresponde. El patron viaja como texto porque cruza en JSON; el JS lo arma.
function archivosContrato($contrato) {
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

    $__row = [];
    foreach ($contrato as $nombre => $config) {
        $tab = $config['tab'];
        if (isset($__row[$tab])) continue;

        $__row[$tab] = array_merge(
            ['id' => $tab, 'titulo' => $tab, 'esperado' => '', 'formato' => '', 'patron' => '.'],
            $archivos[$tab] ?? [],
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
function hojasContrato($contrato) {
    $__row = [];

    foreach ($contrato as $nombre => $config) {
        $columnas = [];
        foreach ($config['columns'] as $i => $campo) {
            $columnas[] = ['letra' => columnLetter($i), 'campo' => $campo];
        }

        $__row[$config['tab']][] = [
            'nombre'   => $nombre,
            'detalle'  => 'columnas A:' . columnLetter(count($config['columns']) - 1) . ' · header fila ' . $config['headerRow'],
            'columnas' => $columnas
        ];
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

// Sin folio de factura la celda no se deja vacia: un pago sin facturar y un pago
// cuya venta todavia no entro al sistema se leen igual y hay que distinguirlos.
function invoiceCell($series) {
    if (empty($series)) return '<span class="cell-null">Sin factura</span>';

    return '<span class="font-mono text-[10px] text-gray-300">' . $series . '</span>';
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
