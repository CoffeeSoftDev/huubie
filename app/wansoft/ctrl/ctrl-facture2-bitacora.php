<?php
session_start();
if (empty($_POST['opc'])) exit(0);

require_once '../conf/_Terminal.php';
terminalExige(['catalogos']);

require_once '../mdl/mdl-facture2-bitacora.php';

// Cuantos dias hacia atras abre la pantalla. La bitacora se consulta para explicar
// algo que ya paso —quien cambio un precio, quien borro un dia— y esas preguntas
// llegan dias despues, no el mismo dia: es el mismo criterio del Historial.
define('BITACORA_DIAS', 30);

// Tope de renglones por consulta. Son decenas al dia, pero un mes cerrado de un jalon
// deja una reasignacion por cargo movido, y una consulta sin tope podria mandar miles
// de filas a una tabla que se pinta entera. Si el periodo lo rebasa, la pantalla lo
// dice y pide acotarlo.
define('BITACORA_LIMITE', 1000);

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
        $usuarios = array_merge(
            [['id' => '', 'valor' => 'Todos']],
            $this->filas($this->lsUsuarios([$this->branchId()]))
        );

        return [
            'status'   => 200,
            'usuarios' => $usuarios,
            'acciones' => $this->lsAcciones(),
            'periodo'  => [
                'fi' => date('Y-m-d', strtotime('-' . BITACORA_DIAS . ' days')),
                'ff' => date('Y-m-d')
            ]
        ];
    }

    // Las seis acciones que escriben en la bitacora, como las lee el usuario. No salen
    // de una tabla: son las que el codigo registra, y viven donde se producen.
    function lsAcciones() {
        $acciones = [
            [
                'id'    => '',
                'valor' => 'Todas'
            ]
        ];

        foreach ($this->nombresDeAccion() as $accion => $nombre) {
            $acciones[] = [
                'id'    => $accion,
                'valor' => $nombre
            ];
        }

        return $acciones;
    }

    function nombresDeAccion() {
        return [
            'importacion'  => 'Importación',
            'confirmacion' => 'Confirmación',
            'catalogo'     => 'Catálogo',
            'reasignacion' => 'Reasignación',
            'reimpresion'  => 'Reimpresión',
            'eliminacion'  => 'Eliminación'
        ];
    }

    function nombreDeAccion($accion) {
        $nombres = $this->nombresDeAccion();

        return $nombres[$accion] ?? $accion;
    }

    // -- CRUD --

    // La lista del periodo. Los textos salen ya escapados (ver esc): la tabla pinta la
    // celda como HTML, y el rotulo lleva lo que alguien tecleo —el nombre de un
    // producto, el de un archivo—.
    function lsBitacora() {
        $fi = $_POST['fi'];
        $ff = $_POST['ff'];

        if (!esFecha($fi) || !esFecha($ff)) {
            return ['status' => 400, 'message' => 'Elige las dos fechas del período'];
        }

        if ($fi > $ff) {
            return ['status' => 400, 'message' => 'La fecha inicial no puede ser posterior a la final'];
        }

        $ls = $this->filas($this->listAuditLog([
            'branch' => $this->branchId(),
            'fi'     => $fi,
            'ff'     => $ff,
            'user'   => $_POST['usuario'],
            'action' => $_POST['accion'],
            'limit'  => BITACORA_LIMITE
        ]));

        $__row = [];

        foreach ($ls as $item) {
            $__row[] = [
                'id'      => $item['id'],
                'Fecha'   => fechaCelda($item['id'], $item['created_at']),
                'Usuario' => textoCelda($item['user_name']),
                'Accion'  => accionCelda($item['action'], $this->nombreDeAccion($item['action'])),
                'Que'     => textoCelda($item['label'])
            ];
        }

        return [
            'status'    => 200,
            'thead'     => ['Fecha y hora', 'Usuario', 'Acción', 'Qué'],
            'row'       => $__row,
            'recortado' => count($ls) >= BITACORA_LIMITE,
            'limite'    => BITACORA_LIMITE
        ];
    }

    // El panel de detalle de UN renglon. El servidor lo deja ya escrito —etiquetas,
    // montos con formato, fechas— para que la pantalla solo lo acomode: si el JS
    // interpretara el JSON de `detail`, tendria que saber que significa cada llave de
    // cada accion.
    function getRegistro() {
        $ls = $this->filas($this->getAuditLogById([$_POST['id'], $this->branchId()]));

        if (empty($ls)) return ['status' => 404, 'message' => 'El registro no existe'];

        return [
            'status'   => 200,
            'registro' => $this->registroDe($ls[0])
        ];
    }

    // El detalle guarda dos formas segun lo que paso: un cambio de campo —{antes,
    // despues}— o un dato del resumen de la accion. Los cambios van en su lista, que
    // la pantalla pinta como «antes → despues»; el resto, como pares etiqueta/valor.
    // Una llave que este mapa no conoce se muestra con su propio nombre en vez de
    // perderse: la bitacora no puede esconder lo que alguien decidio registrar.
    //
    // El orden de lectura lo manda el mapa y no la columna: MySQL normaliza el JSON y
    // reacomoda las llaves (por largo y luego por letra), asi que «corrida» saldria
    // despues de «total». Las que el mapa no conoce van al final.
    function registroDe($item) {
        $detalle = json_decode((string) $item['detail'], true);
        $detalle = is_array($detalle) ? $detalle : [];
        $campos  = camposDeBitacora();
        $pares   = [];
        $cambios = [];

        $llaves = array_merge(
            array_intersect(array_keys($campos), array_keys($detalle)),
            array_diff(array_keys($detalle), array_keys($campos))
        );

        foreach ($llaves as $clave) {
            $valor = $detalle[$clave];

            list($etiqueta, $tipo) = $campos[$clave] ?? [$clave, 'texto'];

            if (is_array($valor) && array_key_exists('despues', $valor)) {
                $cambios[] = [
                    'campo'   => $etiqueta,
                    'antes'   => valorDeBitacora($valor['antes'] ?? null, $tipo),
                    'despues' => valorDeBitacora($valor['despues'], $tipo)
                ];

                continue;
            }

            $pares[] = [$etiqueta, valorDeBitacora($valor, $tipo)];
        }

        return [
            'accion'      => $item['action'],
            'accionTexto' => $this->nombreDeAccion($item['action']),
            'label'       => $item['label'],
            'fechaTexto'  => fechaHora($item['created_at']),
            'usuario'     => $item['user_name'] ?: 'sin usuario',
            'pares'       => $pares,
            'cambios'     => $cambios
        ];
    }
}

// Complements.

function esFecha($texto) {
    if (!preg_match('/^(\d{4})-(\d{2})-(\d{2})$/', (string) $texto, $partes)) return false;

    return checkdate((int) $partes[2], (int) $partes[3], (int) $partes[1]);
}

// CTRL.md pide no escapar en el controlador porque el front lo hace al pintar, pero
// createCoffeeTable3 inserta cada celda como HTML tal cual: un producto llamado
// «<img onerror=…>» se ejecutaria en el navegador del administrador al abrir la
// bitacora. Se escapa aqui, en las celdas que arma este archivo; el panel de detalle
// no lo necesita porque la pantalla lo pinta con .text().
function esc($texto) {
    return htmlspecialchars((string) $texto, ENT_QUOTES, 'UTF-8');
}

function money($valor) {
    return '$' . number_format((float) $valor, 2);
}

function fechaHora($fecha) {
    return date('d/m/Y H:i', strtotime($fecha));
}

// El id del renglon viaja en la celda de la fecha: createCoffeeTable3 no lo expone en
// el <tr>, y la pantalla lo necesita para pedir el detalle al hacer clic.
function fechaCelda($id, $fecha) {
    return '<span data-log="' . (int) $id . '" class="whitespace-nowrap tabular-nums">' . fechaHora($fecha) . '</span>';
}

function textoCelda($texto) {
    if ($texto === null || $texto === '') return '<span class="text-gray-400">&mdash;</span>';

    return esc($texto);
}

// La accion con el punto de color de la terminal (ver .ws-accion en
// wansoft-theme.css). La clase sale de la llave de la accion, nunca de texto libre.
function accionCelda($accion, $nombre) {
    return '<span class="ws-accion ws-accion-' . preg_replace('/[^a-z]/', '', $accion) . '">' . esc($nombre) . '</span>';
}

// Las llaves que las seis acciones guardan en `detail`, con su rotulo y la forma de
// leer su valor. Dos acciones comparten llave cuando dicen lo mismo: `dia`, `tickets`,
// `corrida`, `periodo`.
//
// El ORDEN de este mapa es el orden de lectura del panel (ver registroDe), y es uno
// solo para las seis acciones: cada una lee sus llaves en el orden en que aparecen
// aqui. Por eso `movimientos` va antes que `tickets` y `alcance` antes que `dia`.
function camposDeBitacora() {
    return [
        'alcance'                => ['Alcance',              'alcance'],
        'archivo'                => ['Archivo',              'texto'],
        'hoja'                   => ['Hoja',                 'texto'],
        'corrida'                => ['Corrida',              'texto'],
        'tipo'                   => ['Tipo',                 'corrida'],
        'dia'                    => ['Día',                  'fecha'],
        'periodo'                => ['Periodo',              'texto'],
        'folio'                  => ['Folio',                'texto'],
        'nota'                   => ['Nota',                 'texto'],
        'meta'                   => ['Meta',                 'texto'],
        'origen'                 => ['Folio origen',         'texto'],
        'destino'                => ['Folio destino',        'texto'],
        'monto'                  => ['Monto',                'dinero'],
        'movimientos'            => ['Movimientos',          'lista'],
        'total'                  => ['Total',                'dinero'],
        'iva16'                  => ['IVA 16%',              'dinero'],
        'iva0'                   => ['Tasa 0%',              'dinero'],
        'ventas'                 => ['Ventas',               'entero'],
        'filas'                  => ['Filas',                'entero'],
        'duplicadas'             => ['Duplicadas',           'entero'],
        'validos'                => ['Válidos',              'entero'],
        'total_valido'           => ['Total válido',         'dinero'],
        'tickets'                => ['Tickets',              'entero'],
        'corridas'               => ['Corridas',             'lista'],
        'cargas'                 => ['Cargas de Excel',      'entero'],
        'reemplaza'              => ['Reemplaza a',          'lista'],
        'code'                   => ['Clave',                'texto'],
        'name'                   => ['Descripción',          'texto'],
        'price'                  => ['Precio',               'dinero'],
        'is_bridge'              => ['Tasa',                 'tasa'],
        'is_modifier'            => ['Modificador',          'sino'],
        'active'                 => ['Estatus',              'estatus'],
        'business_name'          => ['Razón social',         'texto'],
        'rfc'                    => ['RFC',                  'texto'],
        'phone'                  => ['Teléfono',             'texto'],
        'fiscal_address'         => ['Lugar de expedición',  'texto'],
        'pos'                    => ['Punto de venta',       'texto'],
        'adjustment_tolerance'   => ['Tolerancia de ajuste', 'dinero'],
        'company_business_name'  => ['Lema',                 'texto'],
        'company_fiscal_address' => ['Domicilio fiscal',     'texto']
    ];
}

// Un valor del detalle ya escrito para leerse. Lo que no hay —NULL, cadena vacia, lista
// vacia— se dice con una raya: es el «antes» de un alta y el hueco de un campo en
// blanco, y ninguno de los dos es un cero.
function valorDeBitacora($valor, $tipo) {
    if ($valor === null || $valor === '' || $valor === []) return '—';

    switch ($tipo) {
        case 'dinero':  return money($valor);
        case 'entero':  return number_format((int) $valor);
        case 'fecha':   return date('d/m/Y', strtotime($valor));
        case 'tasa':    return (int) $valor === 1 ? 'Tasa 0%' : 'IVA 16%';
        case 'sino':    return (int) $valor === 1 ? 'Sí' : 'No';
        case 'estatus': return (int) $valor === 1 ? 'Activo' : 'Inactivo';
        case 'corrida': return nombreDeCorrida($valor);
        case 'alcance': return $valor === 'mes' ? 'Mes completo' : 'Día';
    }

    return is_array($valor) ? implode(', ', $valor) : (string) $valor;
}

// Los tres caminos que abren corrida, con los nombres del Historial.
function nombreDeCorrida($kind) {
    $nombres = [
        'dia'   => 'Cierre del día',
        'cero'  => 'Pendientes al 0%',
        'folio' => 'Ticket regenerado'
    ];

    return $nombres[$kind] ?? $kind;
}

$obj = new ctrl();
echo json_encode($obj->{$_POST['opc']}());
