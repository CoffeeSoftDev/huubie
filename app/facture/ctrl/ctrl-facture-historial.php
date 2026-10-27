<?php
session_start();
if (empty($_POST['opc'])) exit(0);

require_once '../mdl/mdl-facture-historial.php';

// Cuantos dias hacia atras abre la pantalla. El registro se consulta para explicar
// algo que ya paso —una aclaracion, un folio que no cuadra— y esas preguntas llegan
// dias despues, no el mismo dia.
define('HISTORIAL_DIAS', 30);

class ctrl extends mdl {

    public $branch;

    public function __construct() {
        parent::__construct();
        $this->branch = $this->resolveBranch();
    }

    // La sucursal del modulo vive en el esquema del Facturador, no en la sesion de
    // Huubie, y se cachea en sesion como en el resto de la terminal.
    function resolveBranch() {
        if (!empty($_SESSION['FACTURE_BRANCH'])) return (int) $_SESSION['FACTURE_BRANCH'];

        $ls = $this->getBranch();
        $id = (int) ($ls[0]['id'] ?? 0);
        if ($id > 0) $_SESSION['FACTURE_BRANCH'] = $id;

        return $id;
    }

    // branch_id admite NULL: sin sucursal dada de alta se leen las filas sin
    // sucursal en vez de romper la FK.
    function branchId() {
        return $this->branch > 0 ? $this->branch : null;
    }

    // Un read que no pudo ejecutarse devuelve null, no una lista vacia (ver _Read en
    // _CRUD). Recorrer ese null imprime un Warning ANTES del JSON y la pantalla se
    // queda sin respuesta que leer.
    function filas($ls) {
        return is_array($ls) ? $ls : [];
    }

    // -- Interface --

    function init() {
        return [
            'status'  => 200,
            'tipos'   => $this->lsTipos(),
            'periodo' => [
                'fi' => date('Y-m-d', strtotime('-' . HISTORIAL_DIAS . ' days')),
                'ff' => date('Y-m-d')
            ]
        ];
    }

    // Los tres caminos que abren corrida, escritos como el usuario los reconoce. No
    // salen de una tabla: son los `kind` que el modulo escribe al generar, y viven
    // en el codigo que los produce.
    function lsTipos() {
        $tipos = [
            [
                'id'    => '',
                'valor' => 'Todos los tipos'
            ]
        ];

        foreach ($this->nombresDeCorrida() as $kind => $nombre) {
            $tipos[] = [
                'id'    => $kind,
                'valor' => $nombre
            ];
        }

        return $tipos;
    }

    function nombresDeCorrida() {
        return [
            'dia'   => 'Cierre del día',
            'cero'  => 'Pendientes al 0%',
            'folio' => 'Ticket regenerado'
        ];
    }

    function nombreDeCorrida($kind) {
        $nombres = $this->nombresDeCorrida();

        return $nombres[$kind] ?? $kind;
    }

    // El listado del periodo. Las cifras salen congeladas de la corrida y no se
    // recalculan sobre el dia de hoy: es justamente lo que el registro demuestra.
    function lsHistorial() {
        $filtros = [
            'branch' => $this->branchId(),
            'fi'     => $_POST['fi'],
            'ff'     => $_POST['ff'],
            'kind'   => $_POST['kind']
        ];

        $__row = [];
        $ls    = $this->filas($this->listGenerationRuns($filtros));

        foreach ($ls as $item) {
            $__row[] = [
                'id'          => $item['id'],
                'Folio'       => folioCelda($item['folio']),
                'Fecha'       => fechaCorta($item['issue_date']),
                'Tipo'        => tipoCelda($item['kind'], $this->nombreDeCorrida($item['kind'])),
                'Usuario'     => usuarioCelda($item['user_name']),
                'Movimientos' => (string) (int) $item['movements_count'],
                'Total'       => montoCelda($item['day_total'], reparte($item['kind'])),
                'Tickets'     => (string) (int) $item['tickets'],
                'a'           => accionFicha($item['id'])
            ];
        }

        return [
            'status'  => 200,
            'thead'   => ['Folio', 'Fecha', 'Tipo', 'Usuario', 'Movimientos', 'Total', 'Tickets'],
            'row'     => $__row,
            'resumen' => $this->resumenDelPeriodo($filtros)
        ];
    }

    // Lo que el periodo ejecuto, sumando las columnas congeladas de las corridas. No
    // son las ventas del dia: una venta que nunca entro a una corrida no cuenta aqui,
    // y esa diferencia es la que hace util el resumen.
    function resumenDelPeriodo($filtros) {
        $c = $this->getGenerationRunCounts($filtros);

        return [
            'corridas'     => (int) $c['corridas'],
            'movimientos'  => number_format((int) $c['movimientos']),
            'totalTexto'   => money($c['total']),
            'monto16Texto' => money($c['monto16']),
            'monto0Texto'  => money($c['monto0']),
            'reasignados'  => (int) $c['reasignados'],
            'ceros'        => (int) $c['ceros']
        ];
    }

    // La ficha del punto 29: los once datos de la ejecucion, escritos. Se pide por
    // separado porque en la tabla solo caben siete columnas legibles y el resto se
    // lee cuando alguien pregunta por UNA corrida.
    function getGeneracion() {
        $ls = $this->filas($this->getGenerationRunById([$_POST['id'], $this->branchId()]));

        if (empty($ls)) return ['status' => 404, 'message' => 'El registro no existe'];

        return [
            'status' => 200,
            'ficha'  => $this->fichaDe($ls[0])
        ];
    }

    // Los montos del reparto solo existen en el cierre del dia: la pasada de
    // pendientes y el ticket suelto no reparten nada y sus columnas se quedan en
    // cero. Se mandan vacios y no en $0.00 porque ese cero significa "no aplica" y
    // no "no se facturo nada".
    function fichaDe($run) {
        $reparte = reparte($run['kind']);

        return [
            'folio'        => $run['folio'] ?: '',
            'tipo'         => $this->nombreDeCorrida($run['kind']),
            'fechaTexto'   => fechaCorta($run['issue_date']),
            'usuario'      => $run['user_name'] ?: 'sin usuario',
            'archivo'      => $run['source_file'] ?: 'sin archivo registrado',
            'movimientos'  => number_format((int) $run['movements_count']),
            'totalTexto'   => $reparte ? money($run['day_total']) : '',
            'monto16Texto' => $reparte ? money($run['billed_16']) : '',
            'monto0Texto'  => money($run['billed_0']),
            'tickets'      => number_format((int) $run['tickets']),
            'reasignados'  => number_format((int) $run['reassigned_count']),
            'ceros'        => number_format((int) $run['zero_ticket_count']),
            'creadoTexto'  => fechaHora($run['created_at']),
            'metaTexto'    => $reparte ? metaTexto($run) : '',
            'corteTexto'   => $run['cut_folio'] ?: '',
            'sinPapel'     => (int) $run['no_paper']
        ];
    }
}

// Complements.

// El cierre del dia es el unico camino que reparte el 70/30: de el dependen las
// columnas de meta, total y 16%. Los otros dos atienden lo que quedo pendiente y no
// tienen objetivo que cumplir.
function reparte($kind) {
    return $kind === 'dia';
}

function money($valor) {
    return '$' . number_format((float) $valor, 2);
}

function fechaCorta($fecha) {
    return date('d/m/Y', strtotime($fecha));
}

function fechaHora($fecha) {
    return date('d/m/Y H:i', strtotime($fecha));
}

// Con que orden se repartio el dia. El modo y el valor se guardan tal como se
// pidieron —"70%" y "$15,631.70" son la misma orden—, y al auditar importa cual de
// las dos se dio.
function metaTexto($run) {
    $valor = (float) $run['goal_value'];

    $orden = $run['goal_mode'] === 'amount'
        ? money($valor)
        : rtrim(rtrim(number_format($valor, 2), '0'), '.') . '%';

    return $orden . ' · ' . money($run['goal_amount']);
}

// El folio del registro maestro. Va en monoespaciada porque es un numero que se
// dicta por telefono y se coteja digito por digito.
function folioCelda($folio) {
    if (empty($folio)) return '<span class="text-gray-400">sin folio</span>';

    return '<span class="font-mono text-[11px] font-semibold text-gray-900">' . $folio . '</span>';
}

function tipoCelda($kind, $texto) {
    $tonos = [
        'dia'   => 'bg-[#DCE3F3] text-[#2340BC]',
        'cero'  => 'bg-amber-100 text-amber-700',
        'folio' => 'bg-gray-100 text-gray-600'
    ];

    $tono = $tonos[$kind] ?? 'bg-gray-100 text-gray-600';

    return '<span class="px-2 py-0.5 rounded text-[10.5px] font-semibold ' . $tono . '">' . $texto . '</span>';
}

function usuarioCelda($nombre) {
    if (empty($nombre)) return '<span class="text-gray-400">sin usuario</span>';

    return '<span class="text-gray-700">' . $nombre . '</span>';
}

// El cero de una corrida que no reparte no es un monto: se pinta con una raya, que
// es como se lee "no aplica" en una tabla de cifras.
function montoCelda($monto, $aplica) {
    if (!$aplica) return '<span class="text-gray-300">&mdash;</span>';

    return '<span class="font-mono text-gray-900">' . money($monto) . '</span>';
}

function accionFicha($id) {
    return [
        [
            'class'   => 'btn-icon-view',
            'html'    => '<i data-lucide="eye" class="w-3.5 h-3.5"></i>',
            'title'   => 'Ver la ficha completa de la generación',
            'onclick' => "historial.getGeneracion({$id})"
        ]
    ];
}

$obj = new ctrl();
echo json_encode($obj->{$_POST['opc']}());
