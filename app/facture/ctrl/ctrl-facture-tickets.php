<?php
session_start();
if (empty($_POST['opc'])) exit(0);

require_once '../mdl/mdl-facture-tickets.php';

define('META_FACTURACION', 0.7);

define('CONCEPTO_SERVICIO', 'SERVICIO DE MESA');

class ctrl extends mdl {
    public $branch;

    public $catalogos = [];
    public $alcances  = [];

    public $toleranciaAjuste = null;

    public $corridaFolio = '';

    public function __construct() {
        parent::__construct();
        $this->branch  = $this->resolveBranch();
        $this->posCode = $this->resolvePos();
    }

    function resolvePos() {
        $ls = $this->getPosCode([$this->branchId()]);

        return strtolower((string) ($ls[0]['code'] ?? ''));
    }

    function resolveBranch() {
        if (!empty($_SESSION['FACTURE_BRANCH'])) return (int) $_SESSION['FACTURE_BRANCH'];

        $ls = $this->getBranch();
        $id = (int) ($ls[0]['id'] ?? 0);
        if ($id > 0) $_SESSION['FACTURE_BRANCH'] = $id;

        return $id;
    }

    function branchId() {
        return $this->branch > 0 ? $this->branch : null;
    }

    function filas($ls) {
        return is_array($ls) ? $ls : [];
    }

    function init() {
        $dias = $this->filas($this->lsDias([$this->branchId()]));
        $pide = $_POST['dia'] ?? '';
        $dia  = '';

        foreach ($dias as $item) {
            if ($item['id'] === $pide) $dia = $pide;
        }

        return [
            'dias'    => $dias,
            'dia'     => $dia ?: ($dias[0]['id'] ?? date('Y-m-d')),
            'metaPct' => round(META_FACTURACION * 100),
            'emisor'  => $this->emisor()
        ];
    }

    // -- Meta de facturacion --

    function metaDelDia($total) {
        $total = (float) $total;
        $modo  = $_POST['metaModo']  ?? 'pct';
        $valor = $_POST['metaValor'] ?? '';

        if ($valor === '' || !is_numeric($valor)) return $total * META_FACTURACION;

        $objetivo = $modo === 'monto' ? (float) $valor : $total * ((float) $valor / 100);

        return max(0, min($objetivo, $total));
    }

    function descuadreDelDia($total) {
        $cero = $_POST['metaCero'] ?? '';

        if ($cero === '' || !is_numeric($cero)) return '';

        $modo    = $_POST['metaModo'] ?? 'pct';
        $total   = (float) $total;
        $monto0  = $modo === 'monto' ? (float) $cero : $total * ((float) $cero / 100);
        $monto16 = $this->metaDelDia($total);
        $dif     = ($monto16 + $monto0) - $total;

        if (abs($dif) < 0.005) return '';

        return 'El reparto no cuadra: ' . ($dif > 0 ? 'sobran ' : 'faltan ') . money(abs($dif))
             . ' para que el IVA 16% y el IVA 0% sumen el Total Tarjeta de Credito (' . money($total) . ').';
    }

    function semillaDelReparto() {
        $semilla = $_POST['semilla'] ?? 0;

        return is_numeric($semilla) ? max(0, (int) $semilla) : 0;
    }

    // El membrete del papel. Viaja con el logo y con el sistema de la sucursal
    // porque el papel los necesita para imprimirse: el logo encabeza la tira en
    // lugar de la razon social, y `pos_code` es lo que decide cual de los dos
    // formatos sale (ver TicketPaper.papel). Sin ellos el ticket de una sucursal
    // de Wansoft se imprimiria con el papel del otro POS.
    function emisor() {
        $ls = $this->getEmisor([$this->branchId()]);

        if (empty($ls)) return emisorVacio();

        return [
            'razon'      => $ls[0]['business_name'] ?: $ls[0]['company_name'],
            'lema'       => $ls[0]['company_name'],
            'rfc'        => $ls[0]['rfc'] ?: $ls[0]['company_rfc'],
            'domicilio'  => $ls[0]['company_address'] ?: $ls[0]['fiscal_address'],
            'expedicion' => $ls[0]['fiscal_address'],
            'telefono'   => $ls[0]['phone'] ?: $ls[0]['company_phone'],
            'logo'       => $ls[0]['logo'] ?: '',
            'pos_code'   => $this->posCode
        ];
    }

    // -- Filtros --

    function filtros() {
        $like = '%' . trim($_POST['q'] ?? '') . '%';

        return [$this->branchId(), $_POST['dia'] ?? date('Y-m-d'), $like, $like, $like];
    }

    // -- Listado del dia --

    function lsTickets() {
        $dia      = $_POST['dia'] ?? date('Y-m-d');
        $ventas   = $this->filas($this->listTicketsByDay($this->filtros()));
        $conteo   = $this->filas($this->getTicketDayCounts([$this->branchId(), $dia]));
        $__row    = [];

        $completo = $this->filas($this->listSaleDayForSplit([$this->branchId(), $dia]));
        $notas    = $this->notasDeVentas($completo);
        $plan     = $this->planReparto($completo);

        $c = $conteo[0] ?? [
            'tickets' => 0, 'facturados'      => 0, 'cero'       => 0, 'generados'      => 0,
            'total'   => 0, 'total_facturado' => 0, 'total_cero' => 0, 'generados_cero' => 0,
            'servicio' => 0, 'movimientos'    => 0, 'generados_servicio' => 0
        ];

        $repartido = (int) $c['generados'] > 0;

        $mudados = $this->mudadosDelDia($dia);

        foreach ($ventas as $item) {
            $esCorte = (int) $plan['corte'] === (int) $item['id'];

            $grupo = $plan['grupo'][$item['id']] ?? '';

            $__row[] = $this->ticketRow($item, (int) ($notas[$item['id']] ?? 0), $esCorte, $repartido, $grupo);
        }

        return [
            'row'    => $__row,
            'thead'  => '',
            'counts' => [
                'tickets'    => (int) $c['tickets'],
                'servicio'   => (int) $c['servicio'],
                'facturados' => (int) $c['facturados'],
                'cero'       => (int) $c['cero'],
                'generados'  => (int) $c['generados'],
                'mostrados'  => count($__row)
            ],
            'kpis'    => $this->kpisDelDia($c),
            'corte'   => $this->resumenCorte($plan),
            'mudados' => $mudados,
            'generaciones' => $this->generacionesDelDia($dia)
        ];
    }

    function mudadosDelDia($dia) {
        if (!$this->esWansoft()) return [];

        $ls = $this->listReassignedByDay([$this->branchId(), $dia]) ?: [];

        return array_map(function ($mov) {
            return [
                'origen'      => $mov['origen'],
                'destino'     => $mov['destino'],
                'montoTexto'  => money($mov['monto']),
                'pagoDestino' => strtolower($mov['pago_destino'] ?: 'otra forma de pago')
            ];
        }, $ls);
    }

    // -- Registro de generacion (punto 29) --

    function generacionesDelDia($dia) {
        $ls = $this->listGenerationRuns([$this->branchId(), $dia]) ?: [];

        return array_map(function ($run) {
            return [
                'folio'        => $run['folio'] ?: '',
                'tipo'         => $this->nombreDeCorrida($run['kind']),
                'fechaTexto'   => date('d/m/Y', strtotime($run['issue_date'])),
                'creadoTexto'  => date('d/m/Y H:i', strtotime($run['created_at'])),
                'usuario'      => $run['user_name'] ?: 'sin usuario',
                'archivo'      => $run['source_file'] ?: '',
                'movimientos'  => (int) $run['movements_count'],
                'totalTexto'   => money($run['day_total']),
                'monto16Texto' => money($run['billed_16']),
                'monto0Texto'  => money($run['billed_0']),
                'tickets'      => (int) $run['tickets'],
                'reasignados'  => (int) $run['reassigned_count'],
                'ceros'        => (int) $run['zero_ticket_count']
            ];
        }, $ls);
    }

    function nombreDeCorrida($kind) {
        $nombres = [
            'dia'   => 'Cierre del dia',
            'cero'  => 'Pendientes al 0%',
            'folio' => 'Ticket regenerado'
        ];

        return $nombres[$kind] ?? $kind;
    }

    function resumenCorte($plan) {
        return [
            'hay'           => $plan['corte'] !== null,
            'cuenta16'      => $plan['cuenta16'] + $plan['facturados'],
            'logradoTexto'  => money($plan['logrado16']),
            'objetivoTexto' => money($plan['objetivo']),
            'cuenta0'       => $plan['cuenta0'],
            'monto0Texto'   => money($plan['monto0'])
        ];
    }

    function kpisDelDia($c) {
        $total     = (float) $c['total'];
        $facturado = (float) $c['total_facturado'];
        $objetivo  = $this->metaDelDia($total);

        $objetivoCero = $total - $objetivo;

        $obtenidoCero = (float) $c['total_cero'];
        $difCero      = $obtenidoCero - $objetivoCero;

        return [
            'metaPct'           => pctTexto($total > 0 ? $objetivo / $total * 100 : 0),
            'metaCeroPct'       => pctTexto($total > 0 ? $objetivoCero / $total * 100 : 0),
            'metaModo'          => ($_POST['metaModo'] ?? 'pct') === 'monto' ? 'monto' : 'pct',
            'total'             => $total,
            'objetivo'          => $objetivo,
            'totalTexto'        => money($total),
            'objetivoTexto'     => money($objetivo),
            'objetivoCeroTexto' => money($objetivoCero),
            'obtenidoCeroTexto' => money($obtenidoCero),
            'difCeroTexto'      => ($difCero >= 0 ? '+' : '-') . money(abs($difCero)),
            'ceroGenerado'      => (int) $c['generados_cero'] > 0,
            'facturadoTexto'    => money($facturado),
            'porFacturarTexto'  => money(max(0, $objetivo - $facturado)),
            'tickets'           => (int) $c['tickets'],
            'servicio'          => (int) $c['servicio'],
            'facturados'        => (int) $c['facturados']
        ];
    }

    function notasDelDia($dia) {
        return $this->notasDeVentas($this->listSaleDayForSplit([$this->branchId(), $dia]));
    }

    function notasDeVentas($ventas) {
        $notas = [];
        $lugar = 0;

        foreach ($ventas as $item) {
            $lugar++;
            $notas[$item['id']] = $lugar;
        }

        return $notas;
    }

    function ticketRow($item, $nota, $esCorte = false, $repartido = true, $grupo = '') {
        $tasa = tasaEfectiva($item);

        $row = [
            'id'     => $item['folio'],
            'Nota'   => notaCelda($nota, !empty($item['virtual_id'])),
            'Folio'  => '<span data-folio="' . $item['folio'] . '" data-id="' . (int) ($item['virtual_id'] ?? 0)
                        . '" class="font-mono text-[10px] text-gray-400">' . $item['folio'] . '</span>',
            'Estado' => badgeEstado($item, $tasa, $grupo) . badgeReasignacion($item),
            'Monto'  => montoCelda($item),
            'a'      => accionTicket($item, $repartido, $grupo)
        ];

        if ($esCorte) $row['opc'] = 3;

        return $row;
    }

    // -- Ticket virtual --

    function getTicket() {
        $folio = $_POST['folio'] ?? '';
        $ls    = $this->getTicketByFolio([$folio, $this->branchId()]);

        if (empty($ls)) return ['status' => 404, 'message' => 'La venta no existe'];

        $item     = $ls[0];
        $generado = !empty($item['virtual_id']);

        $lineas = $generado
            ? $this->listVirtualDetail([$item['virtual_id']])
            : $this->listSaleDetailByFolio([$item['id']]);

        $propuesta = false;

        if (!$generado && esServicio($item)) {
            $lineas = [];
        } elseif (!$generado && (empty($lineas) || !comandaCuadra($item)) && tasaDe($item) > 0) {
            $armado    = $this->armarPapel($item['total'], $this->catalogo(0.16), semillaFolio($item['folio'], $this->semillaDelReparto()));
            $lineas    = $armado['lineas'];
            $propuesta = !empty($lineas);
        }

        $ticket = array_merge($this->cabecera($item), $this->papelDe($item, $lineas, $generado), [
            'generado' => $generado
        ]);

        if ($propuesta) $ticket['grupo'] = 'ivaGenerado';

        return ['status' => 200, 'ticket' => $ticket];
    }

    function cabecera($item) {
        $tasa    = tasaEfectiva($item);
        $semilla = semillaFolio($item['folio']);
        $total   = totalDelPapel($item);
        $origen  = folioOrigen($item);

        return [
            'id'          => !empty($item['virtual_id']) ? (int) $item['virtual_id'] : null,
            'folio'       => $item['folio'],
            'folioOrigen' => $origen,
            'reasignado'  => $origen != $item['folio'],
            'nota'      => $item['note_number'] ? '#' . $item['note_number'] : 'POR ASIGNAR',
            'fecha'     => date('d/m/Y', strtotime($item['operation_date'])),
            'hora'      => date('H:i', strtotime($item['operation_date'])),
            'fechaHora' => date('d/m/Y h:i:s A', strtotime($item['operation_date'])),
            'mesa'      => $item['table_number'] ?: mesaFicticia($semilla),
            'mesero'    => $item['waiter_name'] ?: meseroFicticio($semilla),
            'personas'  => personasFicticias($semilla),
            'orden'     => ordenFicticia($semilla),
            'cajero'    => 'ADMINISTRACION',
            'metodo'    => $this->metodoDelPapel($item),
            'ceroDeOrigen' => esServicio($item) && esCeroDeOrigen($item),
            'tasa'      => $tasa,
            'tasaText'  => porcentaje($tasa),
            'total'     => money($total),
            'propina'   => money(0),
            'letras'    => letras($total),
            'estado'    => estadoTexto($item, $tasa),
            'factura'   => $item['invoice_series'] ?: ''
        ];
    }

    function metodoDelPapel($item) {
        if (esServicio($item)) {
            if (esCeroDeOrigen($item)) return 'SIN PAGO REGISTRADO';

            return $item['payment_real'] ?: 'SIN PAGO REGISTRADO';
        }

        if ($this->esWansoft()) return 'TARJETA DE CREDITO';

        return $item['payment_name'] ?: 'SIN PAGO REGISTRADO';
    }

    function ticketGuardado($item) {
        $lineas = [];

        foreach ($this->listVirtualDetail([$item['virtual_id']]) as $renglon) {
            $lineas[] = [
                'cant'    => cantidad($renglon['quantity']),
                'nombre'  => $renglon['description'],
                'importe' => money($renglon['amount'])
            ];
        }

        return [
            'status' => 200,
            'ticket' => array_merge([
                'lineas'   => $lineas,
                'subtotal' => money($item['virtual_subtotal'])
            ], $this->ajusteDe($item['virtual_discount']))
        ];
    }

    // -- Corrida de generacion --

    function folioDeCorrida() {
        $ls      = $this->filas($this->getNextGenerationRunFolio());
        $numero  = (int) ($ls[0]['siguiente'] ?? 0);

        return 'GEN-' . str_pad($numero ?: 1, 6, '0', STR_PAD_LEFT);
    }

    function archivoDelDia($dia) {
        $ls = $this->filas($this->getSourceFileByDay([$this->branchId(), $dia]));

        return (string) ($ls[0]['file_name'] ?? '');
    }

    function abrirCorrida($kind, $dia, $plan = null) {
        $campos = [
            'folio'                => $this->folioDeCorrida(),
            'kind'                 => $kind,
            'issue_date'           => $dia,
            'source_file'          => $this->archivoDelDia($dia),
            'adjustment_tolerance' => $this->tolerancia(),
            'paper_seed'           => $this->semillaDelReparto(),
            'user_name'            => $_SESSION['NAME'] ?? '',
            'user_id'              => (int) ($_SESSION['USR'] ?? 0) ?: null,
            'branch_id'            => $this->branchId()
        ];

        if ($plan) {
            $valor = $_POST['metaValor'] ?? '';

            $campos = array_merge($campos, [
                'goal_mode'   => is_numeric($valor) ? ($_POST['metaModo'] ?? 'pct') : 'pct',
                'goal_value'  => is_numeric($valor) ? (float) $valor : META_FACTURACION * 100,
                'goal_amount' => $plan['objetivo'],
                'day_total'   => $plan['total'],
                'billed_16'   => $plan['facturado'] + $plan['monto16'],
                'count_16'    => $plan['cuenta16'] + $plan['facturados'],
                'cut_sale_id' => $plan['corte'] ?: null
            ]);
        }

        if (!$this->createGenerationRun($this->util->sql([$campos]))) {
            $campos['folio'] = $this->folioDeCorrida();

            if (!$this->createGenerationRun($this->util->sql([$campos]))) return 0;
        }

        $this->corridaFolio = $campos['folio'];

        $max = $this->getMaxGenerationRunId();

        return (int) ($max[0]['id'] ?? 0);
    }

    function cerrarCorrida($runId, $conteos) {
        if (!$runId) return false;

        $conteos['id'] = $runId;

        return $this->updateGenerationRun($this->util->sql($conteos, 1));
    }

    // -- Reasignacion de cargos --

    function reasignarCargos($dia) {
        if (!$this->esWansoft()) return [];

        $this->clearReassignmentsByDay([$this->branchId(), $dia]);

        $movimientos = $this->planReasignacion(
            $this->listSaleDayForSplit([$this->branchId(), $dia]),
            $this->listCardPaymentsByDay([$this->branchId(), $dia])
        );

        foreach ($movimientos as $mov) {
            if ($mov['destino'] === null) continue;

            $this->reassignPayment([$mov['destino'], $mov['id']]);
        }

        return $movimientos;
    }

    function planReasignacion($ventas, $pagos) {
        $porFolio = [];

        foreach ($pagos as $pago) $porFolio[$pago['sale_folio']][] = $pago;

        $sobrantes = [];

        foreach ($porFolio as $folio => $cargos) {
            for ($i = 1; $i < count($cargos); $i++) {
                $sobrantes[] = [
                    'id'      => (int) $cargos[$i]['id'],
                    'origen'  => (string) $folio,
                    'monto'   => (float) $cargos[$i]['amount'],
                    'destino' => null
                ];
            }
        }

        if (empty($sobrantes)) return [];

        $libres      = $this->foliosLibres($ventas);
        $movimientos = [];

        foreach ($sobrantes as $mov) {
            $mov['destino'] = $this->receptorProximo($libres, $mov['origen']);

            $movimientos[] = $mov;
        }

        return $movimientos;
    }

    function foliosLibres($ventas) {
        $libres = [];

        foreach ($ventas as $item) {
            if (esFacturado($item['status_name'])) continue;
            if (!esServicio($item))                continue;

            $libres[] = $item['folio'];
        }

        return $libres;
    }

    function receptorProximo(&$libres, $origen) {
        $numero   = (int) $origen;
        $adelante = null;
        $atras    = null;

        foreach ($libres as $i => $folio) {
            if ((int) $folio > $numero) {
                $adelante = $i;
                break;
            }

            $atras = $i;
        }

        $elegido = $adelante !== null ? $adelante : $atras;

        if ($elegido === null) return null;

        $folio = $libres[$elegido];

        unset($libres[$elegido]);

        $libres = array_values($libres);

        return $folio;
    }

    // -- Ajuste de cuadre --

    function tolerancia() {
        if ($this->toleranciaAjuste === null) {
            $ls = $this->getEmisor([$this->branchId()]);

            $this->toleranciaAjuste = (float) ($ls[0]['adjustment_tolerance'] ?? 0);
        }

        return $this->toleranciaAjuste;
    }

    function ajusteDe($descuento) {
        $ajuste = round(max(0, (float) $descuento), 2);
        $tope   = $this->tolerancia();

        return [
            'descuento'       => money($ajuste),
            'tolerancia'      => money($tope),
            'conAjuste'       => $ajuste > 0,
            'fueraTolerancia' => $tope > 0 && $ajuste > $tope
        ];
    }

    // -- Armado del papel --

    function catalogo($tasa) {
        $clave = $tasa > 0 ? '16' : '0';

        if (!isset($this->catalogos[$clave])) {
            $this->catalogos[$clave] = $tasa > 0
                ? $this->listTaxProducts([$this->branchId()])
                : $this->listBridgeProducts([$this->branchId()]);
        }

        return $this->catalogos[$clave];
    }

    function armarPapel($total, $productos, $semilla) {
        if (empty($productos)) return ['lineas' => [], 'subtotal' => 0];

        $exacto = $this->armarExacto($total, $productos, $semilla);

        if ($exacto !== null) return $exacto;

        return $this->armarConDescuento($total, $productos, $semilla);
    }

    function tablaAlcance($precios, $tope, $clave) {
        $alcance = isset($this->alcances[$clave]) ? $this->alcances[$clave] : [true];

        if (count($alcance) >= $tope + 1) return $alcance;

        for ($m = count($alcance); $m <= $tope; $m++) {
            $alcance[$m] = false;

            foreach ($precios as $precio) {
                if ($precio <= $m && $alcance[$m - $precio]) {
                    $alcance[$m] = true;
                    break;
                }
            }
        }

        $this->alcances[$clave] = $alcance;

        return $alcance;
    }

    function preciosDe($productos) {
        $precios = [];

        foreach ($productos as $producto) {
            $precio = (float) $producto['price'];

            if ($precio <= 0 || $precio != floor($precio)) continue;

            $precios[(int) $precio] = true;
        }

        $precios = array_keys($precios);
        rsort($precios);

        return $precios;
    }

    function productosPorPrecio($productos) {
        $__row = [];

        foreach ($productos as $producto) {
            $precio = (float) $producto['price'];

            if ($precio <= 0 || $precio != floor($precio)) continue;

            $__row[(int) $precio][] = $producto;
        }

        return $__row;
    }

    function armarExacto($total, $productos, $semilla) {
        $monto = (float) $total;

        if ($monto <= 0 || $monto != floor($monto)) return null;

        $monto   = (int) $monto;
        $precios = $this->preciosDe($productos);

        if (empty($precios)) return null;

        $clave   = md5(implode(',', $precios));
        $alcance = $this->tablaAlcance($precios, $monto, $clave);

        if (empty($alcance[$monto])) return null;

        $porPrecio = $this->productosPorPrecio($productos);
        $partidas  = min(12, max(3, (int) round($monto / 220)));
        $restante  = $monto;
        $puestas   = 0;
        $cuenta    = [];

        mt_srand($semilla);

        while ($restante > 0) {
            $objetivo = $restante / max(1, $partidas - $puestas);
            $caben    = [];

            foreach ($precios as $precio) {
                if ($precio <= $restante && $alcance[$restante - $precio]) $caben[] = $precio;
            }

            if (empty($caben)) return null;

            usort($caben, function ($a, $b) use ($objetivo) {
                $da = abs($a - $objetivo);
                $db = abs($b - $objetivo);

                if ($da == $db) return 0;

                return $da < $db ? -1 : 1;
            });

            $precio  = $caben[mt_rand(0, min(2, count($caben) - 1))];
            $lista   = $porPrecio[$precio];
            $elegido = $lista[mt_rand(0, count($lista) - 1)];
            $id      = $elegido['id'];

            if (isset($cuenta[$id])) $cuenta[$id]['cant']++;
            else                     $cuenta[$id] = ['producto' => $elegido, 'cant' => 1];

            $restante -= $precio;
            $puestas++;
        }

        return $this->renglonesDe($cuenta);
    }

    function armarConDescuento($total, $productos, $semilla) {
        $restante = (float) $total;
        $partidas = min(12, max(3, (int) round($restante / 220)));
        $puestas  = 0;
        $cuenta   = [];

        mt_srand($semilla);

        while (true) {
            $caben = [];
            foreach ($productos as $producto) {
                if ((float) $producto['price'] <= $restante) $caben[] = $producto;
            }

            if (empty($caben)) break;

            $objetivo = $restante / max(1, $partidas - $puestas);

            usort($caben, function ($a, $b) use ($objetivo) {
                $da = abs((float) $a['price'] - $objetivo);
                $db = abs((float) $b['price'] - $objetivo);

                if ($da == $db) return 0;

                return $da < $db ? -1 : 1;
            });

            $elegido = $caben[mt_rand(0, min(2, count($caben) - 1))];
            $id      = $elegido['id'];

            if (isset($cuenta[$id])) $cuenta[$id]['cant']++;
            else                     $cuenta[$id] = ['producto' => $elegido, 'cant' => 1];

            $restante -= (float) $elegido['price'];
            $puestas++;
        }

        if ($restante > 0.009) {
            $barato = end($productos);
            $id     = $barato['id'];

            if (isset($cuenta[$id])) $cuenta[$id]['cant']++;
            else                     $cuenta[$id] = ['producto' => $barato, 'cant' => 1];
        }

        return $this->renglonesDe($cuenta);
    }

    function renglonesDe($cuenta) {
        $lineas   = [];
        $subtotal = 0;

        foreach ($cuenta as $renglon) {
            $linea     = $this->lineaPuente($renglon['producto'], $renglon['cant']);
            $lineas[]  = $linea;
            $subtotal += $linea['amount'];
        }

        return ['lineas' => $lineas, 'subtotal' => round($subtotal, 2)];
    }

    function lineaPuente($producto, $cant) {
        return [
            'description' => $producto['name'],
            'quantity'    => $cant,
            'unit_price'  => (float) $producto['price'],
            'amount'      => round($cant * (float) $producto['price'], 2),
            'product_id'  => $producto['id']
        ];
    }

    function armarTicket($item, $tasa = 0) {
        $productos = $this->catalogo($tasa);

        if (empty($productos)) {
            return [
                'status'  => 400,
                'message' => $tasa > 0
                    ? 'No hay productos con IVA dados de alta. Registralos en Catalogos para poder armar el ticket.'
                    : 'No hay productos de tasa 0% dados de alta. Registralos en Catalogos para poder armar el ticket.'
            ];
        }

        $total  = (float) $item['total'];
        $armado = $this->armarPapel($total, $productos, semillaFolio($item['folio'], $this->semillaDelReparto()));

        if (empty($armado['lineas'])) {
            return ['status' => 400, 'message' => 'No se pudo armar un ticket que cuadre con ' . money($total)];
        }

        $subtotal = $armado['subtotal'];

        return [
            'status'   => 200,
            'lineas'   => $armado['lineas'],
            'subtotal' => $subtotal,
            'ticket'   => array_merge([
                'lineas'   => array_map(function ($linea) {
                    return [
                        'cant'    => cantidad($linea['quantity']),
                        'nombre'  => $linea['description'],
                        'importe' => money($linea['amount'])
                    ];
                }, $armado['lineas']),
                'subtotal' => money($subtotal)
            ], $this->ajusteDe($subtotal - $total))
        ];
    }

    // -- Acciones --

    function generate() {
        $folio     = $_POST['folio'] ?? '';
        $resultado = $this->generarFolio($folio);

        return $resultado;
    }

    function planReparto($ventas) {
        $total     = 0;
        $facturado = 0;
        $cuentaFac = 0;

        foreach ($ventas as $item) {
            $total += (float) $item['total'];

            if (!esFacturado($item['status_name'])) continue;

            $facturado += (float) $item['total'];
            $cuentaFac++;
        }

        $objetivo = $this->metaDelDia($total);

        $acumulado = $facturado;

        $grupo    = [];
        $corte    = null;
        $monto16  = 0;
        $monto0   = 0;
        $cuenta16 = 0;
        $cuenta0  = 0;

        foreach ($ventas as $item) {
            if (esServicio($item)) continue;

            if (esFacturado($item['status_name'])) {
                $grupo[$item['id']] = '16';
                continue;
            }

            if ($acumulado < $objetivo) {
                $acumulado          += (float) $item['total'];
                $monto16            += (float) $item['total'];
                $grupo[$item['id']]  = '16';
                $cuenta16++;
                continue;
            }

            $monto0             += (float) $item['total'];
            $grupo[$item['id']]  = '0';
            $cuenta0++;

            if ($corte === null) $corte = $item['id'];
        }

        return [
            'grupo'      => $grupo,
            'corte'      => $corte,
            'total'      => $total,
            'objetivo'   => $objetivo,
            'facturado'  => $facturado,
            'facturados' => $cuentaFac,
            'logrado16'  => $acumulado,
            'monto16'    => $monto16,
            'monto0'     => $monto0,
            'cuenta16'   => $cuenta16,
            'cuenta0'    => $cuenta0
        ];
    }

    // -- Vista previa del cierre (punto 20) --

    function previewDay() {
        return $this->propuestaDelDia($_POST['dia'] ?? date('Y-m-d'));
    }

    function propuestaDelDia($dia) {
        $puente = $this->catalogo(0);

        if (empty($puente)) {
            return [
                'status'  => 400,
                'message' => 'No hay productos de tasa 0% dados de alta. Registralos en Catalogos para poder armar los tickets.'
            ];
        }

        $ventas = $this->listSaleDayForSplit([$this->branchId(), $dia]);

        if (empty($ventas)) {
            $criterio = $this->esWansoft() ? 'pagadas' : 'cobradas por banco';

            return ['status' => 400, 'message' => 'No hay ventas ' . $criterio . ' en el dia'];
        }

        // La mudanza de cargos se simula en memoria y no se escribe: mirar una
        // propuesta y cancelarla dejaria los cargos movidos sin corrida que los
        // explique. Es lo unico que aqui se hace distinto del cierre.
        $pagos  = $this->esWansoft() ? $this->listCardPaymentsByDay([$this->branchId(), $dia]) : [];
        $ventas = $this->montosDelPos($ventas, $pagos);

        $reasignados = $this->planReasignacion($ventas, $pagos);
        $ventas      = $this->conMudanza($ventas, $reasignados);

        $total = 0;

        foreach ($ventas as $item) $total += (float) $item['total'];

        $descuadre = $this->descuadreDelDia($total);

        if ($descuadre !== '') return ['status' => 400, 'message' => $descuadre];

        $plan = $this->planReparto($ventas);

        $servicio = 0;
        $conCargo = 0;

        foreach ($ventas as $item) {
            if (esFacturado($item['status_name'])) continue;

            if (esServicio($item)) $servicio++;
            else                   $conCargo++;
        }

        $logrado16    = $plan['facturado'] + $plan['monto16'];
        $cuenta16     = $plan['cuenta16'] + $plan['facturados'];
        $totalDelDia  = $plan['total'];

        $dif = $logrado16 - $plan['objetivo'];

        return [
            'status'       => 200,
            'dia'          => $dia,
            'fechaTexto'   => date('d/m/Y', strtotime($dia)),
            'totalTexto'   => money($totalDelDia),
            'movimientos'  => count($ventas),
            'conCargo'     => $conCargo,
            'metaPct'         => pctTexto($totalDelDia > 0 ? $plan['objetivo'] / $totalDelDia * 100 : 0),
            'objetivoTexto'   => money($plan['objetivo']),
            'difTexto'        => ($dif >= 0 ? '+' : '-') . money(abs($dif)),
            'sobreMeta'       => $dif >= 0,
            'crudo'           => [
                'total'       => $totalDelDia,
                'objetivo'    => $plan['objetivo'],
                'facturado'   => $plan['facturado'],
                'monto16'     => $plan['monto16'],
                'monto0'      => $plan['monto0'],
                'facturados'  => $plan['facturados'],
                'cuenta16'    => $plan['cuenta16'],
                'cuenta0'     => $plan['cuenta0'],
                'servicio'    => $servicio,
                'conCargo'    => $conCargo,
                'movimientos' => count($ventas)
            ],
            'pct16'        => pctTexto($totalDelDia > 0 ? $logrado16 / $totalDelDia * 100 : 0),
            'pct0'         => pctTexto($totalDelDia > 0 ? $plan['monto0'] / $totalDelDia * 100 : 0),
            'monto16Texto' => money($logrado16),
            'monto0Texto'  => money($plan['monto0']),
            'cuenta16'     => $cuenta16,
            'cuenta0'      => $plan['cuenta0'],
            'tickets'      => $cuenta16 + $plan['cuenta0'] + $servicio,
            'cero'         => $servicio,
            'reasignados'  => array_map(function ($mov) {
                return [
                    'origen'     => $mov['origen'],
                    'destino'    => $mov['destino'] ?: '',
                    'montoTexto' => money($mov['monto'])
                ];
            }, $reasignados),
            'semilla'      => $this->semillaDelReparto()
        ];
    }

    function montosDelPos($ventas, $pagos) {
        if (!$this->esWansoft()) return $ventas;

        $porFolio = [];

        foreach ($pagos as $pago) {
            $folio = $pago['sale_folio'];

            $porFolio[$folio] = ($porFolio[$folio] ?? 0) + (float) $pago['amount'];
        }

        foreach ($ventas as $i => $item) {
            $ventas[$i]['total'] = $porFolio[$item['folio']] ?? 0;
        }

        return $ventas;
    }

    function conMudanza($ventas, $movimientos) {
        if (empty($movimientos)) return $ventas;

        $delta = [];

        foreach ($movimientos as $mov) {
            if ($mov['destino'] === null) continue;

            $delta[$mov['origen']]  = ($delta[$mov['origen']]  ?? 0) - (float) $mov['monto'];
            $delta[$mov['destino']] = ($delta[$mov['destino']] ?? 0) + (float) $mov['monto'];
        }

        foreach ($ventas as $i => $item) {
            if (!isset($delta[$item['folio']])) continue;

            $ventas[$i]['total'] = round((float) $item['total'] + $delta[$item['folio']], 2);
        }

        return $ventas;
    }

    function generateDay($dia = null) {
        $dia = $dia ?: ($_POST['dia'] ?? date('Y-m-d'));

        $puente = $this->catalogo(0);

        if (empty($puente)) {
            return [
                'status'  => 400,
                'message' => 'No hay productos de tasa 0% dados de alta. Registralos en Catalogos para poder armar los tickets.'
            ];
        }

        $ventas = $this->listSaleDayForSplit([$this->branchId(), $dia]);

        if (empty($ventas)) {
            $criterio = $this->esWansoft() ? 'pagadas' : 'cobradas por banco';

            return ['status' => 400, 'message' => 'No hay ventas ' . $criterio . ' en el dia'];
        }

        $total     = 0;
        foreach ($ventas as $item) $total += (float) $item['total'];

        $descuadre = $this->descuadreDelDia($total);

        if ($descuadre !== '') return ['status' => 400, 'message' => $descuadre];

        $reasignados = $this->reasignarCargos($dia);
        $ventas      = $this->listSaleDayForSplit([$this->branchId(), $dia]);

        $conIva = $this->catalogo(0.16);
        $plan   = $this->planReparto($ventas);

        $semilla = $this->semillaDelReparto();

        $runId = $this->abrirCorrida('dia', $dia, $plan);

        $this->stampReassignmentsByDay([$runId, $this->branchId(), $dia]);

        $monto0    = 0;
        $cuenta0   = 0;
        $armados16 = 0;
        $servicio  = 0;
        $sinPapel  = 0;
        $lugar     = 0;

        $previos = [];

        foreach ($ventas as $item) {
            if (esFacturado($item['status_name'])) continue;
            if (empty($item['virtual_id']))        continue;

            $previos[] = (int) $item['virtual_id'];
        }

        // Todas las notas previas se apartan en negativo ANTES de armar ninguna: la
        // nota es el lugar de la venta en el dia y una carga nueva la recorre, asi
        // que liberarlas sobre la marcha choca contra el UNIQUE (issue_date,
        // note_number, branch_id) y deja sin papel a la venta que la estrena.
        $this->releaseVirtualNotes($previos);

        foreach ($ventas as $item) {
            $lugar++;

            if (esFacturado($item['status_name'])) continue;

            if (esServicio($item)) {
                if ($this->guardarTicketServicio($item, $lugar, $runId)) $servicio++;
                else                                                    $sinPapel++;

                continue;
            }

            if ($plan['grupo'][$item['id']] === '16') {
                if (!empty($item['tiene_detalle']) && comandaCuadra($item)) continue;

                $tasa = tasaDe($item);

                if ($tasa <= 0 || empty($conIva)) continue;

                if ($this->guardarTicketVirtual($item, $conIva, $lugar, $tasa, $runId, $semilla)) $armados16++;
                else                                                                              $sinPapel++;

                continue;
            }

            if (!$this->guardarTicketVirtual($item, $puente, $lugar, 0, $runId, $semilla)) {
                $sinPapel++;
                continue;
            }

            $monto0 += (float) $item['total'];
            $cuenta0++;
        }

        $this->deleteReleasedVirtualTickets($previos);

        $mudados = count(array_filter($reasignados, function ($mov) {
            return $mov['destino'] !== null;
        }));

        $this->cerrarCorrida($runId, [
            'billed_0'          => $monto0,
            'count_0'           => $cuenta0,
            'no_paper'          => $sinPapel,
            'movements_count'   => count($ventas),
            'reassigned_count'  => $mudados,
            'zero_ticket_count' => $servicio
        ]);

        return array_merge(
            [
                'status'  => 200,
                'message' => number_format($cuenta0) . ' ticket(s) al 0% generados · ' . number_format($plan['cuenta16'] + $plan['facturados']) . ' al 16%'
                             . ($armados16 > 0 ? ' (' . number_format($armados16) . ' con papel del catalogo)' : ''),
                'dia'     => $dia,
                'crudo'   => [
                    'total'       => $plan['total'],
                    'objetivo'    => $plan['objetivo'],
                    'facturado'   => $plan['facturado'],
                    'monto16'     => $plan['monto16'],
                    'monto0'      => $monto0,
                    'tickets'     => count($ventas) - $servicio,
                    'facturados'  => $plan['facturados'],
                    'cuenta16'    => $plan['cuenta16'],
                    'cuenta0'     => $cuenta0,
                    'armados16'   => $armados16,
                    'servicio'    => $servicio,
                    'sinPapel'    => $sinPapel,
                    'reasignados' => $reasignados
                ]
            ],
            $this->resumenReparto([
                'dia'         => $dia,
                'generacion'  => $this->corridaFolio,
                'total'       => $plan['total'],
                'objetivo'    => $plan['objetivo'],
                'facturado'   => $plan['facturado'],
                'monto16'     => $plan['monto16'],
                'monto0'      => $monto0,
                'tickets'     => count($ventas) - $servicio,
                'facturados'  => $plan['facturados'],
                'cuenta16'    => $plan['cuenta16'],
                'cuenta0'     => $cuenta0,
                'armados16'   => $armados16,
                'servicio'    => $servicio,
                'reasignados' => $reasignados,
                'sinPapel'    => $sinPapel
            ])
        );
    }

    // -- El mes completo --

    function mesDelCierre() {
        $mes = $_POST['mes'] ?? '';

        if (preg_match('/^\d{4}-(0[1-9]|1[0-2])$/', $mes)) return $mes;

        return date('Y-m', strtotime($_POST['dia'] ?? date('Y-m-d')));
    }

    function scopeMonth() {
        $mes  = $this->mesDelCierre();
        $dias = $this->filas($this->lsDiasDelMes([$this->branchId(), $mes]));

        $total      = 0;
        $movs       = 0;
        $conCargo   = 0;
        $pendientes = 0;
        $filas      = [];

        foreach ($dias as $item) {
            $total    += (float) $item['total'];
            $movs     += (int) $item['movimientos'];
            $conCargo += (int) $item['con_cargo'];

            $sinRepartir = (int) $item['generados'] === 0;

            if ($sinRepartir) $pendientes++;

            $filas[] = [
                'dia'         => $item['id'],
                'fechaTexto'  => date('d/m/Y', strtotime($item['id'])),
                'totalTexto'  => money($item['total']),
                'movimientos' => (int) $item['movimientos'],
                'conCargo'    => (int) $item['con_cargo'],
                'generados'   => (int) $item['generados'],
                'sinRepartir' => $sinRepartir
            ];
        }

        return [
            'status'      => 200,
            'mes'         => $mes,
            'mesTexto'    => mesTexto($mes),
            'dias'        => $filas,
            'movimientos' => $movs,
            'conCargo'    => $conCargo,
            'totalTexto'  => money($total),
            'pendientes'  => $pendientes
        ];
    }

    // La meta capturada en pesos es de UN dia: repetirla en cada dia del mes le
    // pediria ese importe al que vendio la mitad y descuadraria la suma de las dos
    // tasas. Se traduce a porcentaje contra la venta del mes, que si escala.
    function metaMensualPorcentual($totalMes) {
        if (($_POST['metaModo'] ?? 'pct') !== 'monto') return;

        $valor = $_POST['metaValor'] ?? '';

        if ($valor === '' || !is_numeric($valor)) return;

        $pct = $totalMes > 0
            ? min(100, max(0, (float) $valor / $totalMes * 100))
            : round(META_FACTURACION * 100);

        $_POST['metaModo']  = 'pct';
        $_POST['metaValor'] = $pct;
        $_POST['metaCero']  = 100 - $pct;
    }

    function previewMonth() {
        $mes  = $this->mesDelCierre();
        $dias = $this->filas($this->lsDiasDelMes([$this->branchId(), $mes]));

        if (empty($dias)) {
            return ['status' => 400, 'message' => 'El mes ' . mesTexto($mes) . ' no tiene ventas para repartir'];
        }

        $totalMes = 0;

        foreach ($dias as $item) $totalMes += (float) $item['total'];

        $this->metaMensualPorcentual($totalMes);

        $suma        = $this->sumaVacia();
        $detalle     = [];
        $reasignados = [];
        $motivo      = '';

        foreach ($dias as $item) {
            $propuesta = $this->propuestaDelDia($item['id']);

            if ($propuesta['status'] !== 200) {
                $motivo = $motivo ?: $propuesta['message'];

                $detalle[] = [
                    'dia'        => $item['id'],
                    'fechaTexto' => date('d/m', strtotime($item['id'])),
                    'error'      => $propuesta['message']
                ];

                continue;
            }

            $this->sumarDia($suma, $propuesta['crudo']);

            $reasignados = array_merge($reasignados, $propuesta['reasignados']);

            $detalle[] = [
                'dia'        => $item['id'],
                'fechaTexto' => date('d/m', strtotime($item['id'])),
                'totalTexto' => $propuesta['totalTexto'],
                'pct16'      => $propuesta['pct16'],
                'cuenta16'   => $propuesta['cuenta16'],
                'cuenta0'    => $propuesta['cuenta0'],
                'tickets'    => $propuesta['tickets'],
                'error'      => ''
            ];
        }

        if ($suma['movimientos'] === 0) {
            return ['status' => 400, 'message' => $motivo ?: 'El mes no tiene ventas para repartir'];
        }

        return array_merge(
            $this->cifrasDelReparto($suma),
            [
                'status'     => 200,
                'mes'        => $mes,
                'dia'        => $dias[0]['id'],
                'fechaTexto' => mesTexto($mes),
                'dias'       => $detalle,
                'reasignados' => $reasignados,
                'semilla'     => $this->semillaDelReparto()
            ]
        );
    }

    function generateMonth() {
        $mes  = $this->mesDelCierre();
        $dias = $this->filas($this->lsDiasDelMes([$this->branchId(), $mes]));

        if (empty($dias)) {
            return ['status' => 400, 'message' => 'El mes ' . mesTexto($mes) . ' no tiene ventas para repartir'];
        }

        $totalMes = 0;

        foreach ($dias as $item) $totalMes += (float) $item['total'];

        $this->metaMensualPorcentual($totalMes);

        $suma        = $this->sumaVacia();
        $reasignados = [];
        $corridas    = [];
        $hechos      = [];
        $falla       = null;

        foreach ($dias as $item) {
            $cierre = $this->generateDay($item['id']);

            if ($cierre['status'] !== 200) {
                $falla = ['dia' => $item['id'], 'fechaTexto' => date('d/m/Y', strtotime($item['id'])), 'message' => $cierre['message']];
                break;
            }

            $this->sumarDia($suma, $cierre['crudo']);

            $reasignados = array_merge($reasignados, $cierre['crudo']['reasignados']);
            $corridas[]  = $cierre['generacion'];

            $logrado = $cierre['crudo']['facturado'] + $cierre['crudo']['monto16'];

            $hechos[] = [
                'dia'        => $item['id'],
                'fechaTexto' => date('d/m', strtotime($item['id'])),
                'totalTexto' => $cierre['totalTexto'],
                'pct16'      => pctTexto($cierre['crudo']['total'] > 0 ? $logrado / $cierre['crudo']['total'] * 100 : 0),
                'tickets'    => $cierre['tickets'],
                'generacion' => $cierre['generacion'],
                'error'      => ''
            ];
        }

        if (empty($hechos)) {
            return ['status' => 400, 'message' => $falla ? $falla['fechaTexto'] . ': ' . $falla['message'] : 'No se pudo cerrar el mes'];
        }

        $resumen = $this->resumenReparto(array_merge($suma, [
            'dia'         => $dias[0]['id'],
            'generacion'  => implode(' · ', array_filter($corridas)),
            'reasignados' => $reasignados
        ]));

        $resumen['fechaTexto'] = mesTexto($mes);

        return array_merge($resumen, [
            'status'  => 200,
            'message' => count($hechos) . ' dia(s) cerrados de ' . mesTexto($mes)
                         . ($falla ? ' · se detuvo en ' . $falla['fechaTexto'] : ''),
            'mes'     => $mes,
            'dias'    => $hechos,
            'falla'   => $falla
        ]);
    }

    function sumaVacia() {
        return [
            'total'       => 0,
            'objetivo'    => 0,
            'facturado'   => 0,
            'monto16'     => 0,
            'monto0'      => 0,
            'tickets'     => 0,
            'facturados'  => 0,
            'cuenta16'    => 0,
            'cuenta0'     => 0,
            'armados16'   => 0,
            'servicio'    => 0,
            'sinPapel'    => 0,
            'conCargo'    => 0,
            'movimientos' => 0
        ];
    }

    function sumarDia(&$suma, $crudo) {
        foreach ($suma as $clave => $valor) {
            if (isset($crudo[$clave])) $suma[$clave] += $crudo[$clave];
        }

        if (!isset($crudo['tickets'])) {
            $suma['tickets'] += $crudo['movimientos'] - $crudo['servicio'];
        }
    }

    function cifrasDelReparto($suma) {
        $logrado16 = $suma['facturado'] + $suma['monto16'];
        $total     = $suma['total'];
        $cuenta16  = $suma['cuenta16'] + $suma['facturados'];
        $dif       = $logrado16 - $suma['objetivo'];

        return [
            'totalTexto'    => money($total),
            'movimientos'   => $suma['movimientos'],
            'conCargo'      => $suma['conCargo'],
            'pct16'         => pctTexto($total > 0 ? $logrado16 / $total * 100 : 0),
            'pct0'          => pctTexto($total > 0 ? $suma['monto0'] / $total * 100 : 0),
            'monto16Texto'  => money($logrado16),
            'monto0Texto'   => money($suma['monto0']),
            'cuenta16'      => $cuenta16,
            'cuenta0'       => $suma['cuenta0'],
            'tickets'       => $cuenta16 + $suma['cuenta0'] + $suma['servicio'],
            'cero'          => $suma['servicio'],
            'metaPct'       => pctTexto($total > 0 ? $suma['objetivo'] / $total * 100 : 0),
            'objetivoTexto' => money($suma['objetivo']),
            'difTexto'      => ($dif >= 0 ? '+' : '-') . money(abs($dif)),
            'sobreMeta'     => $dif >= 0
        ];
    }

    function deleteDay() {
        $dia    = $_POST['dia'] ?? date('Y-m-d');
        $conteo = $this->getTicketDayCounts([$this->branchId(), $dia]);
        $notas  = (int) ($conteo[0]['generados'] ?? 0);

        if ($notas === 0) {
            return ['status' => 400, 'message' => 'El dia no tiene tickets generados'];
        }

        $donde = [$dia, $this->branchId()];

        // El orden lo impone la FK: fk_vt_run es RESTRICT, asi que la corrida no se
        // borra mientras le cuelgue un papel, y los cargos vuelven a su folio antes
        // de que se vaya la corrida que los mudo.
        if (!$this->deleteVirtualTicketByDay($donde)) {
            return ['status' => 500, 'message' => 'No se pudieron eliminar los tickets del dia'];
        }

        $this->clearReassignmentsByDay([$this->branchId(), $dia]);

        $this->deleteGenerationRunByDay($donde);

        return [
            'status'  => 200,
            'message' => number_format($notas) . ' ticket(s) eliminados · el dia queda sin repartir',
            'dia'     => $dia
        ];
    }

    function resumenReparto($r) {
        $objetivoCero = $r['total'] - $r['objetivo'];
        $logrado16    = $r['facturado'] + $r['monto16'];
        $dif16        = $logrado16 - $r['objetivo'];
        $dif0         = $r['monto0'] - $objetivoCero;

        return [
            'fechaTexto'        => date('d/m/Y', strtotime($r['dia'] ?? date('Y-m-d'))),
            'generacion'        => $r['generacion'] ?? '',
            'metaPct'           => pctTexto($r['total'] > 0 ? $r['objetivo'] / $r['total'] * 100 : 0),
            'metaCeroPct'       => pctTexto($r['total'] > 0 ? $objetivoCero / $r['total'] * 100 : 0),
            'totalTexto'        => money($r['total']),
            'objetivoTexto'     => money($r['objetivo']),
            'objetivoCeroTexto' => money($objetivoCero),
            'facturadoTexto'    => money($r['facturado']),
            'porCubrirTexto'    => money(max(0, $r['objetivo'] - $r['facturado'])),
            'logrado16Texto'    => money($logrado16),
            'logrado0Texto'     => money($r['monto0']),
            'dif16Texto'        => ($dif16 >= 0 ? '+' : '-') . money(abs($dif16)),
            'dif0Texto'         => ($dif0  >= 0 ? '+' : '-') . money(abs($dif0)),
            'tickets'           => $r['tickets'],
            'facturados'        => $r['facturados'],
            'cuenta16'          => $r['cuenta16'],
            'armados16'         => $r['armados16'] ?? 0,
            'cuenta16Total'     => $r['cuenta16'] + $r['facturados'],
            'cuenta0'           => $r['cuenta0'],
            'servicio'          => $r['servicio'] ?? 0,
            'reasignados'       => array_map(function ($mov) {
                return [
                    'origen'      => $mov['origen'],
                    'destino'     => $mov['destino'] ?: '',
                    'montoTexto'  => money($mov['monto'])
                ];
            }, $r['reasignados'] ?? []),
            'sinPapel'          => $r['sinPapel']
        ];
    }

    function guardarTicketVirtual($item, $productos, $nota, $tasa, $runId = null, $semilla = 0) {
        $armado   = $this->armarPapel($item['total'], $productos, semillaFolio($item['folio'], $semilla));
        $subtotal = $armado['subtotal'];
        $total    = (float) $item['total'];

        if (empty($armado['lineas'])) return false;

        $base = $tasa > 0 ? round($total / (1 + $tasa), 2) : $total;

        return $this->guardarPapel($item, [
            'note_number' => $nota,
            'subtotal'    => $subtotal,
            'discount'    => max(0, round($subtotal - $total, 2)),
            'tax_rate'    => $tasa,
            'tax'         => $tasa > 0 ? round($total - $base, 2) : 0,
            'total'       => $total,
            'issue_date'  => diaDe($item),
            'sale_id'     => $item['id'],
            'generation_run_id' => $runId ?: null
        ], $this->partidasDe($armado['lineas']));
    }

    function guardarPapel($item, $campos, $lineas) {
        $campos['visible_folio'] = $item['folio'];
        $campos['origin_folio']  = folioOrigen($item);
        $campos['branch_id']     = $this->branchId();

        $ticketId = (int) (isset($item['virtual_id']) ? $item['virtual_id'] : 0);

        if ($ticketId > 0) {
            $campos['id'] = $ticketId;

            if (!$this->updateVirtualTicket($this->util->sql($campos, 1))) return false;

            $this->deleteVirtualDetailByTicket([$ticketId]);
        } else {
            if (!$this->createVirtualTicket($this->util->sql([$campos]))) return false;

            $creado   = $this->getVirtualTicketByNote([$campos['issue_date'], $campos['note_number'], $this->branchId()]);
            $ticketId = (int) ($creado[0]['id'] ?? 0);

            if ($ticketId === 0) return false;
        }

        foreach ($lineas as $i => $linea) $lineas[$i]['virtual_ticket_id'] = $ticketId;

        return (bool) $this->createVirtualDetail($this->util->sql($lineas));
    }

    function partidasDe($lineas) {
        $partidas = [];

        foreach ($lineas as $linea) {
            $partidas[] = [
                'description' => $linea['description'],
                'quantity'    => $linea['quantity'],
                'unit_price'  => $linea['unit_price'],
                'amount'      => $linea['amount'],
                'product_id'  => $linea['product_id']
            ];
        }

        return $partidas;
    }

    function guardarTicketServicio($item, $nota, $runId = null) {
        return $this->guardarPapel($item, [
            'note_number' => $nota,
            'subtotal'    => 0,
            'discount'    => 0,
            'tax_rate'    => 0,
            'tax'         => 0,
            'total'       => 0,
            'issue_date'  => diaDe($item),
            'sale_id'     => $item['id'],
            'generation_run_id' => $runId ?: null
        ], [
            [
                'description' => CONCEPTO_SERVICIO,
                'quantity'    => 1,
                'unit_price'  => 0,
                'amount'      => 0,
                'product_id'  => null
            ]
        ]);
    }

    // -- Hoja imprimible --

    function showPrintSheet() {
        $ventas = $this->listTicketsByDay($this->filtros());

        if (empty($ventas)) {
            return ['status' => 400, 'message' => 'No hay tickets que imprimir en el dia'];
        }

        $dia      = $_POST['dia'] ?? date('Y-m-d');
        $reales   = agruparPorClave($this->listSaleDetailByDay([$this->branchId(), $dia]), 'sale_folio');
        $virtuales = agruparPorClave($this->listVirtualDetailByDay([$this->branchId(), $dia]), 'sale_id');

        $tickets = [];

        foreach ($ventas as $item) {
            $esVirtual = !empty($item['virtual_id']);
            $lineas    = $esVirtual ? ($virtuales[$item['id']] ?? []) : ($reales[$item['folio']] ?? []);
            $tickets[] = $this->papelDe($item, $lineas, $esVirtual);
        }

        return [
            'status'  => 200,
            'emisor'  => $this->emisor(),
            'tickets' => $tickets
        ];
    }

    function desgloseFiscal($item, $total, $tasa) {
        if (!$this->esWansoft()) return [(float) $item['subtotal'], (float) $item['tax']];

        $base = $tasa > 0 ? round($total / (1 + $tasa), 2) : $total;

        return [$base, round($total - $base, 2)];
    }

    function papelDe($item, $lineas, $esVirtual) {
        $total = totalDelPapel($item);

        if (!$esVirtual && empty($lineas)) {
            $lineas = [[
                'description' => esServicio($item) ? CONCEPTO_SERVICIO : 'CONSUMO',
                'quantity'    => 1,
                'amount'      => $total
            ]];
        }

        $suma = 0;
        foreach ($lineas as $linea) $suma += (float) $linea['amount'];

        $tasa      = tasaEfectiva($item);
        $descuento = $esVirtual ? (float) $item['virtual_discount'] : max(0, $suma - $total);

        list($subtotal, $iva) = $tasa > 0
            ? $this->desgloseFiscal($item, $total, $tasa)
            : [$total + $descuento, 0];

        return array_merge($this->cabecera($item), [
            'nota'      => $esVirtual ? '#' . $item['note_number'] : $item['folio'],
            'tasaText'  => porcentaje($tasa),
            'grupo'     => esServicio($item)
                ? 'servicio'
                : ($esVirtual
                    ? ($tasa > 0 ? 'ivaGenerado' : 'cero')
                    : (esFacturado($item['status_name']) ? 'facturado' : 'real')),
            'lineas'    => array_map(function ($linea) {
                return [
                    'cant'    => cantidad($linea['quantity']),
                    'nombre'  => $linea['description'],
                    'importe' => money($linea['amount'])
                ];
            }, $lineas),
            'subtotal'  => money($subtotal),
            'iva'       => money($iva),
            'total'     => money($total)
        ], $this->ajusteDe($descuento));
    }

    function generateAllZero() {
        $dia        = $_POST['dia'] ?? date('Y-m-d');
        $pendientes = $this->listPendingZero([$this->branchId(), $dia]);

        if (empty($pendientes)) {
            return ['status' => 400, 'message' => 'No hay tickets con IVA 0% por generar en el dia'];
        }

        $generados = 0;
        $ultimo    = '';
        $monto0    = 0;

        $runId = $this->abrirCorrida('cero', $dia);

        foreach ($pendientes as $item) {
            $resultado = $this->generarFolio($item['folio'], $runId);

            if ($resultado['status'] === 200) {
                $generados++;
                $monto0 += (float) $item['total'];
                $ultimo  = $item['folio'];
                continue;
            }

            if ($resultado['status'] === 400) return $resultado;
        }

        $this->cerrarCorrida($runId, [
            'billed_0'        => $monto0,
            'count_0'         => $generados,
            'no_paper'        => count($pendientes) - $generados,
            'movements_count' => count($pendientes)
        ]);

        return [
            'status'    => $generados > 0 ? 200 : 500,
            'message'   => $generados > 0
                ? number_format($generados) . ' ticket(s) virtual(es) generados'
                : 'No se pudo generar ningun ticket virtual',
            'generados' => $generados,
            'folio'     => $ultimo
        ];
    }

    function generarFolio($folio, $runId = null) {
        $ls = $this->getTicketByFolio([$folio, $this->branchId()]);

        if (empty($ls)) return ['status' => 404, 'message' => 'La venta no existe'];

        $item = $ls[0];

        if (esFacturado($item['status_name'])) {
            return ['status' => 400, 'message' => 'El ticket ya esta facturado con el folio ' . $item['invoice_series']];
        }

        $veto = $this->esWansoft() ? vetoDeGeneracion($item) : '';
        if ($veto) return ['status' => 400, 'message' => $veto];

        if (esServicio($item)) {
            return [
                'status'  => 400,
                'message' => 'El movimiento no ampara ningun cargo con tarjeta: su papel se emite en $0.00 con el cierre del dia.'
            ];
        }

        $armado = $this->armarTicket($item);
        if ($armado['status'] !== 200) return $armado;

        $dia = diaDe($item);

        $propia = !$runId;

        if ($propia) $runId = $this->abrirCorrida('folio', $dia);

        $notas = $this->notasDelDia($dia);
        $nota  = (int) ($notas[$item['id']] ?? 0);

        if ($nota === 0) return ['status' => 400, 'message' => 'La venta no aparece en el corte del dia'];

        $subtotal = $armado['subtotal'];
        $total    = (float) $item['total'];

        $guardado = $this->guardarPapel($item, [
            'note_number' => $nota,
            'subtotal'    => $subtotal,
            'discount'    => max(0, round($subtotal - $total, 2)),
            'tax_rate'    => 0,
            'tax'         => 0,
            'total'       => $total,
            'issue_date'  => $dia,
            'sale_id'     => $item['id'],
            'generation_run_id' => $runId ?: null
        ], $this->partidasDe($armado['lineas']));

        if (!$guardado) return ['status' => 500, 'message' => 'No se pudo guardar el ticket virtual'];

        if ($propia) {
            $this->cerrarCorrida($runId, [
                'billed_0'        => $total,
                'count_0'         => 1,
                'movements_count' => 1
            ]);
        }

        return [
            'status'     => 200,
            'message'    => 'Ticket virtual generado con la nota #' . $nota,
            'nota'       => $nota,
            'folio'      => $folio,
            'generacion' => $propia ? $this->corridaFolio : ''
        ];
    }
}

function agruparPorClave($filas, $clave) {
    $__row = [];

    foreach ($filas as $fila) $__row[$fila[$clave]][] = $fila;

    return $__row;
}

function diaDe($item) {
    return date('Y-m-d', strtotime($item['operation_date']));
}

function tasaDe($item) {
    $subtotal = (float) $item['subtotal'];
    return $subtotal > 0 ? round((float) $item['tax'] / $subtotal, 2) : 0;
}

function tasaEfectiva($item) {
    if (!empty($item['virtual_id'])) {
        return isset($item['virtual_tax_rate']) ? (float) $item['virtual_tax_rate'] : 0;
    }

    if (esServicio($item)) return 0;

    return tasaDe($item);
}

function money($valor) {
    return '$' . number_format((float) $valor, 2);
}

function porcentaje($tasa) {
    return round($tasa * 100) . '%';
}

function mesTexto($mes) {
    $nombres = [
        '01' => 'Enero', '02' => 'Febrero',   '03' => 'Marzo',     '04' => 'Abril',
        '05' => 'Mayo',  '06' => 'Junio',     '07' => 'Julio',     '08' => 'Agosto',
        '09' => 'Septiembre', '10' => 'Octubre', '11' => 'Noviembre', '12' => 'Diciembre'
    ];

    $partes = explode('-', (string) $mes);
    $nombre = $nombres[$partes[1] ?? ''] ?? '';

    return $nombre ? $nombre . ' ' . $partes[0] : (string) $mes;
}

function pctTexto($pct) {
    return rtrim(rtrim(number_format(round((float) $pct, 1), 1), '0'), '.');
}

function cantidad($valor) {
    $valor = (float) $valor;

    if ($valor == floor($valor)) return number_format($valor, 0);

    return rtrim(rtrim(number_format($valor, 3), '0'), '.');
}

function esFacturado($statusName) {
    return strtoupper((string) $statusName) === 'FACTURADO';
}

function esServicio($item) {
    return (float) $item['total'] <= 0;
}

function esCeroDeOrigen($item) {
    return (float) ($item['sale_total'] ?? 0) <= 0;
}

function totalDelPapel($item) {
    return esServicio($item) ? 0 : (float) $item['total'];
}

function comandaCuadra($item) {
    return abs(totalDelPapel($item) - (float) ($item['sale_total'] ?? 0)) < 0.005;
}

function vetoDeGeneracion($item) {
    if (empty($item['es_credito'])) {
        $formas = $item['payment_real'] ?: $item['payment_name'] ?: 'sin pago registrado';

        return 'La venta se cobro con ' . $formas . ': su papel es el de ' . strtolower(CONCEPTO_SERVICIO)
             . ' y sale con el cierre del dia, no se arma por separado.';
    }

    if (empty($item['esta_pagada'])) {
        $estado = $item['operation_status'] ?: 'sin estado de operacion';

        return 'La venta esta ' . $estado . ': solo se generan tickets de las ventas Pagadas.';
    }

    return '';
}

function emisorVacio() {
    return [
        'razon'      => '', 'lema'     => '', 'rfc'  => '', 'domicilio' => '',
        'expedicion' => '', 'telefono' => '', 'logo' => '', 'pos_code'  => ''
    ];
}

// -- Renglones que el POS no exporta --
function semillaFolio($folio, $offset = 0) {
    $offset = (int) $offset;

    return $offset === 0 ? crc32((string) $folio) : crc32($folio . '#' . $offset);
}

function mesaFicticia($semilla) {
    return (string) ($semilla % 20 + 1);
}

function meseroFicticio($semilla) {
    $nombres = ['MAFER', 'DIANA', 'KARLA', 'JOSUE', 'BRENDA', 'IVAN', 'PAOLA', 'LUIS', 'ANDREA',
                'HUGO', 'XIMENA', 'CESAR', 'ROSY', 'ABEL', 'YARELI', 'OMAR', 'NALLELY'];

    return $nombres[intdiv($semilla, 20) % count($nombres)];
}

function personasFicticias($semilla) {
    return (string) (intdiv($semilla, 400) % 6 + 1);
}

function ordenFicticia($semilla) {
    return (string) (intdiv($semilla, 3000) % 99 + 1);
}

// -- Monto en letras --
function letras($monto) {
    $monto    = round((float) $monto, 2);
    $entero   = (int) floor($monto);
    $centavos = str_pad((string) round(($monto - $entero) * 100), 2, '0', STR_PAD_LEFT);
    $moneda   = $entero == 1 ? 'PESO' : 'PESOS';

    $texto = preg_replace('/UNO$/', 'UN', enLetras($entero));

    return $texto . ' ' . $moneda . ' ' . $centavos . '/100 M.N.';
}

function enLetras($n) {
    $n = (int) $n;

    if ($n === 0)   return 'CERO';
    if ($n < 0)     return 'MENOS ' . enLetras(-$n);

    $unidades = ['', 'UNO', 'DOS', 'TRES', 'CUATRO', 'CINCO', 'SEIS', 'SIETE', 'OCHO', 'NUEVE',
                 'DIEZ', 'ONCE', 'DOCE', 'TRECE', 'CATORCE', 'QUINCE', 'DIECISEIS', 'DIECISIETE',
                 'DIECIOCHO', 'DIECINUEVE', 'VEINTE'];
    $decenas  = ['', '', '', 'TREINTA', 'CUARENTA', 'CINCUENTA', 'SESENTA', 'SETENTA',
                 'OCHENTA', 'NOVENTA'];
    $centenas = ['', 'CIENTO', 'DOSCIENTOS', 'TRESCIENTOS', 'CUATROCIENTOS', 'QUINIENTOS',
                 'SEISCIENTOS', 'SETECIENTOS', 'OCHOCIENTOS', 'NOVECIENTOS'];

    if ($n <= 20) return $unidades[$n];

    if ($n < 100) {
        $d = intdiv($n, 10);
        $u = $n % 10;

        if ($d === 2) return 'VEINTI' . $unidades[$u];

        return $decenas[$d] . ($u ? ' Y ' . $unidades[$u] : '');
    }

    if ($n === 100) return 'CIEN';

    if ($n < 1000) {
        $c = intdiv($n, 100);
        return $centenas[$c] . (($n % 100) ? ' ' . enLetras($n % 100) : '');
    }

    if ($n < 1000000) {
        $miles = intdiv($n, 1000);
        $texto = $miles === 1 ? 'MIL' : enLetras($miles) . ' MIL';
        return $texto . (($n % 1000) ? ' ' . enLetras($n % 1000) : '');
    }

    $millones = intdiv($n, 1000000);
    $texto    = $millones === 1 ? 'UN MILLON' : enLetras($millones) . ' MILLONES';

    return $texto . (($n % 1000000) ? ' ' . enLetras($n % 1000000) : '');
}

function notaCelda($nota, $generado) {
    $clase = $generado ? 'font-bold text-gray-300' : 'text-gray-500';

    return '<span class="' . $clase . '">#' . $nota . '</span>';
}

function badgeEstado($item, $tasa, $grupo = '') {
    if (esFacturado($item['status_name'])) {
        return '<span class="badge-base b-green st-fact"><i data-lucide="lock" class="w-3 h-3"></i>Facturado ' . $item['invoice_series'] . '</span>';
    }

    if (esServicio($item)) {
        return '<span class="badge-base b-gray st-serv">Servicio</span>';
    }

    if (!empty($item['virtual_id'])) {
        $tono = $tasa == 0 ? 'b-gray st-0' : 'b-blue st-16';

        return '<span class="badge-base ' . $tono . '">IVA ' . porcentaje($tasa) . '</span>';
    }

    if ($grupo !== '') {
        $cero = $grupo === '0';

        $razon = $cero
            ? 'Su papel se arma al 0% al generar los tickets del dia'
            : 'Se factura al 16% al generar los tickets del dia';

        return '<span class="badge-base ' . ($cero ? 'b-gray st-0' : 'b-blue st-16') . '" title="' . $razon . '">'
             . 'IVA ' . ($cero ? '0%' : '16%') . '</span>';
    }

    if ($tasa == 0) return '<span class="badge-base b-yellow st-req">Requiere ticket virtual</span>';

    return '<span class="badge-base b-gray st-nof">No facturado</span>';
}

function estadoTexto($item, $tasa) {
    if (esFacturado($item['status_name'])) return 'FACTURADO';
    if (esServicio($item))                 return CONCEPTO_SERVICIO;
    if ($tasa == 0)                        return 'IVA 0%';

    return $item['status_name'] ? strtoupper($item['status_name']) : 'SIN ESTADO';
}

function folioOrigen($item) {
    if (!empty($item['origin_folio'])) return $item['origin_folio'];

    $recibido = trim((string) (isset($item['recibido_de']) ? $item['recibido_de'] : ''));

    if ($recibido === '') return $item['folio'];

    $folios = explode(',', $recibido);

    return trim($folios[0]);
}

function badgeReasignacion($item) {
    $badges = '';

    if (!empty($item['recibido_de'])) {
        $badges .= '<span class="badge-base b-blue ml-1" title="Ampara un cargo con tarjeta que se cobro en el folio '
                 . htmlspecialchars($item['recibido_de'], ENT_QUOTES) . '">&larr; ' . htmlspecialchars($item['recibido_de'], ENT_QUOTES) . '</span>';
    }

    if (!empty($item['cedido_a'])) {
        $badges .= '<span class="badge-base b-yellow ml-1" title="Traia mas de un cargo con tarjeta: el resto se mudo al folio '
                 . htmlspecialchars($item['cedido_a'], ENT_QUOTES) . '">&rarr; ' . htmlspecialchars($item['cedido_a'], ENT_QUOTES) . '</span>';
    }

    return $badges;
}

function montoCelda($item) {
    if (!esServicio($item)) {
        return '<span class="font-semibold text-white">' . money($item['total']) . '</span>';
    }

    if (esCeroDeOrigen($item)) {
        return '<span class="text-gray-500" title="No factura: el movimiento vino sin importe en la carga">-</span>';
    }

    $cobro = $item['payment_real'] ? strtolower($item['payment_real']) : 'sin pago registrado';

    return '<span class="text-gray-500" title="No factura: la cuenta se cobro en ' . htmlspecialchars($cobro, ENT_QUOTES)
         . ' por ' . money($item['sale_total']) . '">-</span>';
}

function motivoSinPapel($item, $repartido, $grupo) {
    if (esServicio($item)) return '';

    if ($grupo === '0') return 'tasa-cero';

    if ($repartido) return '';

    if (empty($item['tiene_detalle'])) return 'sin-comanda';

    if (!comandaCuadra($item)) return 'comanda-parcial';

    return '';
}

function accionTicket($item, $repartido = true, $grupo = '') {
    $folio = $item['folio'];

    if (esFacturado($item['status_name'])) {
        return [
            [
                'class'   => 'btn-icon-view',
                'html'    => '<i data-lucide="lock" class="w-3.5 h-3.5"></i>',
                'title'   => 'Facturado: no se le arma ticket virtual',
                'onclick' => "tickets.lockedNotice('{$folio}')"
            ]
        ];
    }

    $motivo = !empty($item['virtual_id']) ? '' : motivoSinPapel($item, $repartido, $grupo);

    if ($motivo) {
        $razon = [
            'tasa-cero'       => 'Su papel se arma al generar los tickets del dia',
            'sin-comanda'     => 'La venta llego sin su comanda: su papel se arma al generar los tickets del dia',
            'comanda-parcial' => 'El folio ampara solo parte de la cuenta: su papel se arma al generar los tickets del dia'
        ][$motivo];

        return [
            [
                'class'   => 'btn-icon-view',
                'html'    => '<i data-lucide="eye-off" class="w-3.5 h-3.5 text-gray-500"></i>',
                'title'   => $razon,
                'onclick' => "tickets.pendingNotice('{$motivo}')"
            ]
        ];
    }

    $texto = !empty($item['virtual_id'])
        ? 'Ver el ticket virtual'
        : ($repartido ? 'Armar el ticket virtual' : 'Ver el ticket de la venta');

    return [
        [
            'class'   => 'btn-icon-view',
            'html'    => '<i data-lucide="eye" class="w-3.5 h-3.5"></i>',
            'title'   => $texto,
            'onclick' => "app.selectTicket('{$folio}')"
        ]
    ];
}

$obj = new ctrl();
echo json_encode($obj->{$_POST['opc']}());
