<?php
session_start();
if (empty($_POST['opc'])) exit(0);

require_once '../mdl/mdl-facture-cargas.php';
require_once 'import-facture-cargas.php';

// PhpSpreadsheet (vendor) solo es necesario para procesar Excel en uploadFile().
// Se carga bajo demanda para que el resto del modulo opere sin el.
define('AUTOLOAD_PATH', '../../src/vendor/autoload.php');

class ctrl extends mdl {

    public $subsidiariesId;
    public $userId;

    public function __construct() {
        parent::__construct();
        $this->subsidiariesId = (int) ($_SESSION['SUB'] ?? $_POST['subsidiaries_id'] ?? 0);
        $this->userId         = (int) ($_SESSION['USR'] ?? $_POST['user_id'] ?? 1);
    }

    // subsidiaries_id apunta por FK a fayxzvov_alpha.subsidiaries: un 0 sin
    // sucursal en sesion rompe la restriccion, y la columna admite NULL.
    function branchId() {
        return $this->subsidiariesId > 0 ? $this->subsidiariesId : null;
    }

    function init() {
        $anios = $this->lsAnios([$this->branchId()]);

        if (empty($anios)) {
            $anios = [['id' => date('Y'), 'valor' => date('Y')]];
        }

        return [
            'meses' => mesesCatalogo(),
            'anios' => $anios
        ];
    }

    // -- Bitacora --

    function lsBitacora() {
        $tipo = $_POST['tipo'];
        $mes  = (int) $_POST['mes'];
        $anio = (int) $_POST['anio'];

        $importador = new ImportFactureCargas($this);
        $contrato   = $importador->contrato();

        $__row = [];
        $ls = $this->listImportBatch([$this->branchId(), $anio, $mes]);

        foreach ($ls as $item) {
            // La bitacora esta separada por pestana: la hoja de comandas nunca
            // aparece en el tab de ventas y viceversa.
            if (sheetTab($contrato, $item['sheet_name']) !== $tipo) continue;

            $__row[] = [
                'id'             => $item['id'],
                'Hora'           => rowStamp($item['id'], $item['created_at']),
                'Archivo'        => '<span class="font-semibold text-gray-300">' . $item['file_name'] . '</span>',
                'Hoja'           => '<span class="text-gray-400">' . $item['sheet_name'] . '</span>',
                'Filas'          => '<span class="text-gray-400">' . number_format($item['row_count']) . '</span>',
                'Control total'  => '<span class="font-semibold text-gray-300">$' . number_format($item['control_total'], 2) . '</span>',
                'Estado'         => '<span class="badge-base b-green">OK</span>',
                'a'              => actionButtons($item['id'])
            ];
        }

        return ['row' => $__row, 'thead' => ''];
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

        $__row = [];

        if ($target === 'sale') {
            foreach ($this->listSaleByBatch([$id]) as $item) {
                $__row[] = [
                    'id'       => $item['folio'],
                    'Folio'    => '<span class="font-semibold text-gray-300">' . $item['folio'] . '</span>',
                    'Codigo'   => '<span class="text-gray-400 font-mono text-[10px]">' . $item['billing_code'] . '</span>',
                    'Fecha'    => '<span class="text-gray-400">' . $item['operation_date'] . '</span>',
                    'Subtotal' => '<span class="text-gray-400">$' . number_format($item['subtotal'], 2) . '</span>',
                    'Total'    => '<span class="font-semibold text-gray-300">$' . number_format($item['total'], 2) . '</span>',
                    'Estado'   => saleStatusBadge($item['status_name'])
                ];
            }
        }

        if ($target === 'payment') {
            foreach ($this->listSalePaymentByBatch([$id]) as $item) {
                $__row[] = [
                    'id'      => $item['sale_folio'],
                    'Folio'   => '<span class="font-semibold text-gray-300">' . $item['sale_folio'] . '</span>',
                    'Metodo'  => '<span class="text-gray-400">' . $item['method_name'] . '</span>',
                    'Moneda'  => '<span class="text-gray-400">' . $item['currency'] . '</span>',
                    'Importe' => '<span class="font-semibold text-gray-300">$' . number_format($item['amount'], 2) . '</span>',
                    'Total'   => '<span class="text-gray-400">$' . number_format($item['sale_total'], 2) . '</span>'
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

        return [
            'status'  => 200,
            'titulo'  => $batch['file_name'] . ' · ' . $batch['sheet_name'],
            'total'   => (int) $batch['row_count'],
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

        if ($target === 'sale')    $this->deleteSaleByBatch($where);
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

// El data-batch viaja en la celda para que la fila completa sea clickeable:
// createCoffeeTable3 no expone el id del registro en el <tr>.
function rowStamp($id, $created) {
    return '<span data-batch="' . $id . '" class="text-gray-400">' . date('d/m/Y H:i', strtotime($created)) . '</span>';
}

function saleStatusBadge($name) {
    $tone = strtoupper($name) === 'FACTURADO' ? 'b-green' : 'b-yellow';
    return '<span class="badge-base ' . $tone . '">' . $name . '</span>';
}

function actionButtons($id) {
    return [
        [
            'class'   => 'btn-icon-view',
            'title'   => 'Ver registros',
            'html'    => '<i data-lucide="eye" class="w-4 h-4"></i>',
            'onclick' => "cargas.lsRegistros({$id})"
        ],
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
