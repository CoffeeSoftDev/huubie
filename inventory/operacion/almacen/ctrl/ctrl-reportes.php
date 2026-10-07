<?php
require_once __DIR__ . '/../../../conf/_Session.php';
if (empty($_POST['opc'])) exit(0);

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

require_once '../mdl/mdl-reportes.php';
require_once '../../../conf/coffeSoft.php';

class ctrl extends mdl {

    public $companiesId;
    public $branchId;
    public $userId;

    public function __construct() {
        parent::__construct();
        $this->companiesId = (int) ($_SESSION['company_id'] ?? 0);
        $this->branchId    = (int) ($_SESSION['branch_id']  ?? 0);
        $this->userId      = (int) ($_SESSION['user_id']    ?? 0);
    }

    function init() {
        $almacenes = [];
        foreach ($this->lsWarehouses([$this->companiesId]) as $almacen) {
            $almacenes[] = [
                'id'        => (int) $almacen['id'],
                'valor'     => $almacen['valor'],
                'branch_id' => (int) $almacen['branch_id']
            ];
        }

        return [
            'status'     => 200,
            'branch_id'  => $this->branchId,
            'sucursales' => $this->lsSucursales([
                'company_id' => $this->companiesId,
                'user_id'    => $this->userId,
                'is_owner'   => (int) ($_SESSION['is_owner'] ?? 0)
            ]),
            'almacenes'  => $almacenes,
            'areas'      => $this->lsAreas([$this->companiesId]),
            'categorias' => $this->lsCategories([$this->companiesId])
        ];
    }

    // -- Lista de periodos --
    // Devuelve todos los periodos del rango aunque no tengan movimientos: un
    // reporte vacio sigue sirviendo como hoja de conteo.
    function lsReportes() {
        $filtros  = reporteFiltros($_POST);
        $rango    = reporteRango($_POST['fi'] ?? '', $_POST['ff'] ?? '');
        $periodos = reportePeriodos($filtros['tipo'], $rango['fi'], $rango['ff']);
        $scope    = reporteScope($this->lsWarehouses([$this->companiesId]), $filtros);

        $conteos = $this->getReporteCounts([
            'companies_id'  => $this->companiesId,
            'warehouse_ids' => $scope['ids'],
            'fi'            => end($periodos)['fi'],
            'ff'            => $periodos[0]['ff'],
            'area_id'       => $filtros['area_id'],
            'category_id'   => $filtros['category_id']
        ]);

        $acumulado = [];
        foreach ($conteos as $conteo) {
            $key      = reporteKey($filtros['tipo'], $conteo['dia']);
            $cantidad = (float) $conteo['cantidad'];

            if (!isset($acumulado[$key])) {
                $acumulado[$key] = [
                    'items'       => [],
                    'movimientos' => 0,
                    'entradas'    => 0.0,
                    'salidas'     => 0.0,
                    'ajustes'     => 0,
                    'diferencia'  => 0.0
                ];
            }

            $acumulado[$key]['items'][(int) $conteo['item_id']] = true;
            $acumulado[$key]['movimientos'] += (int) $conteo['movimientos'];

            if ($conteo['bucket'] === 'entradas') {
                $acumulado[$key]['entradas'] += $cantidad;
            } elseif (in_array($conteo['bucket'], ['ventas', 'salidas', 'desperdicio'], true)) {
                $acumulado[$key]['salidas'] -= $cantidad;
            } elseif ($conteo['bucket'] === 'ajuste') {
                $acumulado[$key]['ajustes']    += (int) $conteo['movimientos'];
                $acumulado[$key]['diferencia'] += $cantidad;
            }
        }

        $data = [];
        foreach ($periodos as $periodo) {
            $totales = $acumulado[$periodo['key']] ?? null;

            $data[] = [
                'key'         => $periodo['key'],
                'tipo'        => $filtros['tipo'],
                'fi'          => $periodo['fi'],
                'ff'          => $periodo['ff'],
                'label'       => $periodo['label'],
                'sublabel'    => $scope['almacen'],
                'productos'   => $totales ? count($totales['items']) : 0,
                'movimientos' => $totales ? $totales['movimientos'] : 0,
                'entradas'    => reporteRedondeo($totales ? $totales['entradas'] : 0),
                'salidas'     => reporteRedondeo($totales ? $totales['salidas'] : 0),
                'ajustes'     => $totales ? $totales['ajustes'] : 0,
                'diferencia'  => reporteRedondeo($totales ? $totales['diferencia'] : 0)
            ];
        }

        return [
            'status' => 200,
            'data'   => $data
        ];
    }

    // -- Reporte de inventario --
    // La existencia inicial se reconstruye hacia atras desde el stock actual porque
    // hay existencias que no nacieron de un movimiento (cargas iniciales).
    function getReporte() {
        $filtros  = reporteFiltros($_POST);
        $periodo  = reportePeriodo($filtros['tipo'], reporteFecha($_POST['fi'] ?? '') ?: date('Y-m-d'));
        $columnas = reporteColumnas($filtros['tipo'], $periodo['fi'], $periodo['ff']);
        $scope    = reporteScope($this->lsWarehouses([$this->companiesId]), $filtros);

        if (empty($scope['ids'])) {
            return [
                'status'  => 404,
                'message' => 'No hay almacenes activos con esos filtros'
            ];
        }

        $productos = $this->listProductosReporte([
            'companies_id'  => $this->companiesId,
            'warehouse_ids' => $scope['ids'],
            'area_id'       => $filtros['area_id'],
            'category_id'   => $filtros['category_id']
        ]);

        if (empty($productos)) {
            return [
                'status'  => 404,
                'message' => 'No hay productos activos e inventariables con esos filtros'
            ];
        }

        $movimientos = $this->listMovimientosReporte([
            'companies_id'  => $this->companiesId,
            'warehouse_ids' => $scope['ids'],
            'fi'            => $periodo['fi']
        ]);

        $porProducto = [];
        foreach ($movimientos as $movimiento) {
            $porProducto[(int) $movimiento['item_id']][] = $movimiento;
        }

        $rows    = [];
        $resumen = [
            'productos'     => 0,
            'entradas'      => 0.0,
            'ventas'        => 0.0,
            'salidas'       => 0.0,
            'desperdicio'   => 0.0,
            'salidas_total' => 0.0,
            'diferencia'    => 0.0,
            'conteos'       => 0
        ];

        foreach ($productos as $producto) {
            $itemId  = (int) $producto['id'];
            $calculo = reporteValores((float) $producto['existencia'], $porProducto[$itemId] ?? [], $columnas);

            if ($filtros['solo_movimiento'] && !$calculo['con_movimiento']) continue;

            $rows[] = [
                'item_id'        => $itemId,
                'sku'            => $producto['sku'] ?? '',
                'name'           => $producto['name'],
                'unidad'         => $producto['unidad'] ?? '',
                'area_id'        => (int) $producto['area_id'],
                'area'           => $producto['area'] ?? 'Sin área',
                'valores'        => $calculo['valores'],
                'totales'        => $calculo['totales'],
                'conceptos'      => $calculo['conceptos'],
                'con_movimiento' => $calculo['con_movimiento']
            ];

            $resumen['productos']++;
            $resumen['entradas']      += $calculo['totales']['entradas'];
            $resumen['ventas']        += $calculo['totales']['ventas'];
            $resumen['salidas']       += $calculo['totales']['salidas'];
            $resumen['desperdicio']   += $calculo['totales']['desperdicio'];
            $resumen['salidas_total'] += $calculo['totales']['salidas_total'];
            $resumen['diferencia']    += $calculo['totales']['diferencia'] ?? 0;

            $conteo = array_filter($calculo['valores']['fisico'], function ($valor) {
                return $valor !== null;
            });
            if ($conteo) $resumen['conteos']++;
        }

        foreach (['entradas', 'ventas', 'salidas', 'desperdicio', 'salidas_total', 'diferencia'] as $campo) {
            $resumen[$campo] = reporteRedondeo($resumen[$campo]);
        }

        $areas      = $this->lsAreas([$this->companiesId]);
        $categorias = $this->lsCategories([$this->companiesId]);

        $filtro = [];
        if ($filtros['area_id'])     $filtro[] = 'Área: '      . reporteValor($areas, $filtros['area_id']);
        if ($filtros['category_id']) $filtro[] = 'Categoría: ' . reporteValor($categorias, $filtros['category_id']);

        $empresa = $this->getCompanyById([$this->companiesId]);

        return [
            'status' => 200,
            'data'   => [
                'tipo'           => $filtros['tipo'],
                'fi'             => $periodo['fi'],
                'ff'             => $periodo['ff'],
                'titulo_periodo' => $periodo['titulo'],
                'columnas'       => $columnas,
                'empresa'        => $empresa['name'] ?? ($_SESSION['company'] ?? ''),
                'rfc'            => $empresa['rfc'] ?? '',
                'ubicacion'      => $empresa['ubication'] ?? '',
                'sucursal'       => $scope['sucursal'],
                'almacen'        => $scope['almacen'],
                'filtro'         => implode(' · ', $filtro),
                'generado'       => date('Y-m-d H:i:s'),
                'usuario'        => $_SESSION['user'] ?? '',
                'rows'           => $rows,
                'resumen'        => $resumen
            ]
        ];
    }
}

// Complements.

function reporteFecha($valor) {
    $fecha = DateTime::createFromFormat('Y-m-d', (string) $valor);
    return ($fecha && $fecha->format('Y-m-d') === $valor) ? $valor : '';
}

function reporteRedondeo($valor) {
    if ($valor === null) return null;
    // Sumar 0 evita que json_encode devuelva -0.
    return round((float) $valor, 3) + 0;
}

function reporteFiltros($post) {
    $tipo = $post['tipo'] ?? '';

    return [
        'tipo'            => $tipo === 'mensual' ? 'mensual' : 'semanal',
        'branch_id'       => (int) ($post['branch_id']    ?? 0),
        'warehouse_id'    => (int) ($post['warehouse_id'] ?? 0),
        'area_id'         => (int) ($post['area_id']      ?? 0),
        'category_id'     => (int) ($post['category_id']  ?? 0),
        'solo_movimiento' => ($post['solo_movimiento'] ?? '0') === '1'
    ];
}

function reporteRango($fi, $ff) {
    $ff = reporteFecha($ff) ?: date('Y-m-d');
    $fi = reporteFecha($fi) ?: date('Y-m-d', strtotime($ff . ' -6 days'));

    if ($fi > $ff) {
        return [
            'fi' => $ff,
            'ff' => $fi
        ];
    }

    return [
        'fi' => $fi,
        'ff' => $ff
    ];
}

// Almacenes que entran al reporte: el elegido, los de la sucursal o todos los
// activos de la empresa. Los movimientos se filtran por warehouse_id porque en
// traspasos la vista pone la sucursal de origen o de destino.
function reporteScope($almacenes, $filtros) {
    $ids      = [];
    $almacen  = 'Todos los almacenes';
    $sucursal = 'Todas las sucursales';

    foreach ($almacenes as $registro) {
        $id = (int) $registro['id'];

        if ($filtros['warehouse_id']) {
            if ($id !== $filtros['warehouse_id']) continue;
            $ids[]    = $id;
            $almacen  = $registro['almacen'];
            $sucursal = $registro['sucursal'] ?: 'Sin sucursal';
            continue;
        }

        if ($filtros['branch_id'] && (int) $registro['branch_id'] !== $filtros['branch_id']) continue;

        $ids[] = $id;
        if ($filtros['branch_id']) $sucursal = $registro['sucursal'] ?: $sucursal;
    }

    return [
        'ids'      => $ids,
        'almacen'  => $almacen,
        'sucursal' => $sucursal
    ];
}

function reporteValor($catalogo, $id) {
    foreach ($catalogo as $registro) {
        if ((int) $registro['id'] === (int) $id) return $registro['valor'];
    }
    return '#' . $id;
}

function reporteDia($fecha) {
    $dias = ['', 'LUNES', 'MARTES', 'MIÉRCOLES', 'JUEVES', 'VIERNES', 'SÁBADO', 'DOMINGO'];
    return $dias[(int) date('N', strtotime($fecha))];
}

function reporteMes($fecha) {
    $meses = ['', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
    return $meses[(int) date('n', strtotime($fecha))];
}

function reporteLunes($fecha) {
    $ts = strtotime($fecha);
    return date('Y-m-d', strtotime('-' . (date('N', $ts) - 1) . ' days', $ts));
}

function reporteKey($tipo, $fecha) {
    $fecha = substr($fecha, 0, 10);
    if ($tipo === 'mensual') return 'mensual:' . substr($fecha, 0, 7);
    return 'semanal:' . reporteLunes($fecha);
}

// Periodo canonico que contiene la fecha: la semana ISO o el mes completo.
function reportePeriodo($tipo, $fecha) {
    $ts = strtotime($fecha);

    if ($tipo === 'mensual') {
        $fi = date('Y-m-01', $ts);
        $ff = date('Y-m-t', $ts);

        return [
            'key'    => 'mensual:' . date('Y-m', $ts),
            'fi'     => $fi,
            'ff'     => $ff,
            'label'  => ucfirst(reporteMes($fi)) . ' ' . date('Y', $ts),
            'titulo' => 'Mes de ' . reporteMes($fi) . ' ' . date('Y', $ts)
        ];
    }

    $fi = reporteLunes($fecha);
    $ff = date('Y-m-d', strtotime($fi . ' +6 days'));

    return [
        'key'    => 'semanal:' . $fi,
        'fi'     => $fi,
        'ff'     => $ff,
        'label'  => 'Semana ' . (int) date('W', strtotime($fi)) . ' · ' . date('d/m', strtotime($fi)) . ' – ' . date('d/m/Y', strtotime($ff)),
        'titulo' => 'Semana del ' . date('d/m/Y', strtotime($fi)) . ' al ' . date('d/m/Y', strtotime($ff))
    ];
}

// Periodos que intersectan [fi, ff], del mas reciente al mas viejo (tope 92).
function reportePeriodos($tipo, $fi, $ff) {
    $periodos = [];
    $cursor   = $ff;

    while (count($periodos) < 92) {
        $periodo = reportePeriodo($tipo, $cursor);
        if ($periodo['ff'] < $fi) break;

        unset($periodo['titulo']);
        $periodos[] = $periodo;
        $cursor     = date('Y-m-d', strtotime($periodo['fi'] . ' -1 day'));
    }

    return $periodos;
}

// Columnas del reporte: los 7 dias de la semana o las semanas ISO del mes
// recortadas al mes.
function reporteColumnas($tipo, $fi, $ff) {
    $columnas = [];

    if ($tipo === 'mensual') {
        $inicio = $fi;
        $numero = 1;

        while ($inicio <= $ff) {
            $domingo = date('Y-m-d', strtotime(reporteLunes($inicio) . ' +6 days'));
            $fin     = $domingo < $ff ? $domingo : $ff;

            $corto = $inicio === $fin
                ? date('d/m', strtotime($inicio))
                : date('d', strtotime($inicio)) . '-' . date('d/m', strtotime($fin));

            $columnas[] = [
                'key'    => $inicio,
                'nombre' => 'SEM ' . $numero,
                'corto'  => $corto,
                'fi'     => $inicio,
                'ff'     => $fin
            ];

            $inicio = date('Y-m-d', strtotime($fin . ' +1 day'));
            $numero++;
        }

        return $columnas;
    }

    for ($dia = $fi; $dia <= $ff; $dia = date('Y-m-d', strtotime($dia . ' +1 day'))) {
        $columnas[] = [
            'key'    => $dia,
            'nombre' => reporteDia($dia),
            'corto'  => date('d/m', strtotime($dia)),
            'fi'     => $dia,
            'ff'     => $dia
        ];
    }

    return $columnas;
}

// Renglones de un producto por columna. Recibe la existencia ACTUAL y los
// movimientos agregados desde el inicio del periodo en adelante (sin tope).
function reporteValores($existencia, $movimientos, $columnas) {
    $total      = count($columnas);
    $posterior  = 0.0;
    $conMov     = false;
    $conceptos  = [];
    $porColumna = array_fill(0, $total, [
        'entradas'    => 0.0,
        'ventas'      => 0.0,
        'salidas'     => 0.0,
        'desperdicio' => 0.0,
        'ajuste'      => 0.0,
        'hayAjuste'   => false
    ]);

    foreach ($movimientos as $movimiento) {
        $cantidad   = (float) $movimiento['cantidad'];
        $dia        = substr($movimiento['dia'], 0, 10);
        $posterior += $cantidad;

        foreach ($columnas as $indice => $columna) {
            if ($dia < $columna['fi'] || $dia > $columna['ff']) continue;

            $bucket = $movimiento['bucket'];
            if (isset($porColumna[$indice][$bucket])) $porColumna[$indice][$bucket] += $cantidad;
            if ($bucket === 'ajuste') $porColumna[$indice]['hayAjuste'] = true;
            $conMov = true;

            $concepto = reporteConcepto($movimiento);
            if ($concepto) {
                $clave = $concepto['sentido'] . '|' . $concepto['label'];
                if (!isset($conceptos[$clave])) {
                    $conceptos[$clave] = $concepto + [
                        'valores' => array_fill(0, $total, 0.0),
                        'total'   => 0.0
                    ];
                }
                $conceptos[$clave]['valores'][$indice] += abs($cantidad);
                $conceptos[$clave]['total']            += abs($cantidad);
            }
            break;
        }
    }

    $valores = [
        'inicial'       => [],
        'entradas'      => [],
        'ventas'        => [],
        'salidas'       => [],
        'desperdicio'   => [],
        'salidas_total' => [],
        'teorico'       => [],
        'fisico'        => [],
        'diferencia'    => []
    ];
    $totales = [
        'entradas'      => 0.0,
        'ventas'        => 0.0,
        'salidas'       => 0.0,
        'desperdicio'   => 0.0,
        'salidas_total' => 0.0,
        'diferencia'    => null
    ];

    $inicial = $existencia - $posterior;

    foreach ($porColumna as $columna) {
        $entradas     = $columna['entradas'];
        $ventas       = -$columna['ventas'];
        $salidas      = -$columna['salidas'];
        $desperdicio  = -$columna['desperdicio'];
        $salidasTotal = $ventas + $salidas + $desperdicio;
        $teorico      = $inicial + $entradas - $salidasTotal;
        $diferencia   = $columna['hayAjuste'] ? $columna['ajuste'] : null;
        $fisico       = $diferencia === null ? null : $teorico + $diferencia;

        $valores['inicial'][]       = reporteRedondeo($inicial);
        $valores['entradas'][]      = reporteRedondeo($entradas);
        $valores['ventas'][]        = reporteRedondeo($ventas);
        $valores['salidas'][]       = reporteRedondeo($salidas);
        $valores['desperdicio'][]   = reporteRedondeo($desperdicio);
        $valores['salidas_total'][] = reporteRedondeo($salidasTotal);
        $valores['teorico'][]       = reporteRedondeo($teorico);
        $valores['fisico'][]        = reporteRedondeo($fisico);
        $valores['diferencia'][]    = reporteRedondeo($diferencia);

        $totales['entradas']      += $entradas;
        $totales['ventas']        += $ventas;
        $totales['salidas']       += $salidas;
        $totales['desperdicio']   += $desperdicio;
        $totales['salidas_total'] += $salidasTotal;
        if ($diferencia !== null) $totales['diferencia'] = ($totales['diferencia'] ?? 0) + $diferencia;

        $inicial = $teorico + ($diferencia ?? 0);
    }

    foreach ($totales as $campo => $valor) {
        $totales[$campo] = reporteRedondeo($valor);
    }

    // Entradas primero y luego salidas, cada grupo por nombre.
    uasort($conceptos, function ($a, $b) {
        if ($a['sentido'] !== $b['sentido']) return $a['sentido'] === 'entrada' ? -1 : 1;
        return strcmp($a['label'], $b['label']);
    });

    $listaConceptos = [];
    foreach ($conceptos as $concepto) {
        $concepto['valores'] = array_map('reporteRedondeo', $concepto['valores']);
        $concepto['total']   = reporteRedondeo($concepto['total']);
        $listaConceptos[]    = $concepto;
    }

    return [
        'valores'        => $valores,
        'totales'        => $totales,
        'conceptos'      => $listaConceptos,
        'con_movimiento' => $conMov
    ];
}

// De qué fue cada movimiento en el reporte completo: tipo de entrada (inflow_origin)
// o motivo de salida (shrinkage_reason). El ajuste no lleva renglón: es la diferencia.
function reporteConcepto($movimiento) {
    $tipo     = $movimiento['tipo'] ?? '';
    $cantidad = (float) $movimiento['cantidad'];

    if ($tipo === 'ENTRADA') {
        return [
            'sentido' => 'entrada',
            'label'   => 'Entrada · ' . ($movimiento['origen'] ?: 'Sin tipo')
        ];
    }

    if ($tipo === 'SALIDA') {
        $motivo = $movimiento['motivo'] ?: 'Sin motivo';
        return [
            'sentido' => 'salida',
            'label'   => stripos($motivo, 'Salida') === 0 ? $motivo : 'Salida · ' . $motivo
        ];
    }

    if ($tipo === 'TRANSFERENCIA') {
        return [
            'sentido' => $cantidad > 0 ? 'entrada' : 'salida',
            'label'   => $cantidad > 0 ? 'Traspaso recibido' : 'Traspaso enviado'
        ];
    }

    return null;
}

$obj = new ctrl();
$fn  = $_POST['opc'];
if (!method_exists($obj, $fn)) {
    echo json_encode(['status' => 405, 'message' => "opc '{$fn}' no implementado"]);
    exit(0);
}
echo json_encode($obj->$fn());
