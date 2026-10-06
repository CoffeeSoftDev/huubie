<?php
require_once __DIR__ . '/../../../conf/_Session.php';
if (empty($_POST['opc'])) exit(0);

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

require_once '../mdl/mdl-stock.php';
require_once '../../../conf/coffeSoft.php';
require_once '../../../conf/_IaOllama.php';

class ctrl extends mdl {

    public $companiesId;
    public $branchId;
    public $userId;

    public function __construct() {
        parent::__construct();
        $this->companiesId = (int) ($_SESSION['company_id'] ?? $_POST['companies_id'] ?? 0);
        $this->branchId    = (int) ($_SESSION['branch_id']  ?? $_POST['branch_id']    ?? 0);
        $this->userId      = (int) ($_SESSION['user_id']    ?? $_POST['user_id']      ?? 0);
    }

    function init() {
        return [
            'status'          => 200,
            'branch_id'       => $this->branchId,
            'sucursales'      => $this->lsSucursales(['company_id' => $this->companiesId, 'user_id' => $this->userId, 'is_owner' => (int) ($_SESSION['is_owner'] ?? 0)]),
            'categorias'      => $this->lsCategories([$this->companiesId]),
            'areas'           => $this->lsAreas([$this->companiesId]),
            'estados_ajuste'  => [
                ['id' => '',          'valor' => 'Todos los estados'],
                ['id' => 'Borrador',  'valor' => 'Borrador'],
                ['id' => 'Aplicado',  'valor' => 'Aplicado'],
                ['id' => 'Cancelado', 'valor' => 'Cancelado']
            ]
        ];
    }

    function lsStock() {
        $rows = $this->qStock([
            'companies_id'    => $this->companiesId,
            'branch_id'       => $_POST['branch_id'] ?? '',
            'category_id'     => $_POST['category_id']     ?? '',
            'area_id'         => $_POST['area_id']         ?? '',
            'nivel'           => $_POST['nivel']           ?? '',
            'movimiento'      => $_POST['movimiento']      ?? '',
            'q'               => $_POST['q']               ?? ''
        ]);

        $row = [];
        foreach ($rows as $r) {
            $qty = (float) $r['quantity_total'];
            $min = (float) $r['stock_min'];
            $max = (float) $r['stock_max'];
            $txt = $this->_qty($qty);
            $row[] = [
                'id'        => $r['product_id'],
                'Producto'  => [
                    'class' => 'justify-start px-2 py-2',
                    'html'  => $this->_productCell($r['image'] ?? '', $r['product_name'], $r['product_id'], $r['sku'] ?: '')
                ],
                'Categoría' => $r['category_name'] ?: '-',
                'Stock'     => in_array($txt, ['0', '-0'], true) ? '-' : $txt,
                'Mín'       => $min > 0 ? $this->_qty($min) : '-',
                'Máx'       => $max > 0 ? $this->_qty($max) : '-',
                'Unidad'    => $r['unit_code'] ?: '-',
                'Estado'    => $this->_levelBadge($qty, $min),
                'Últ. Mov'  => $this->_lastMovBadge($r['last_movement_type'] ?? ''),
                'a'         => [
                    [
                        'class'   => 'inline-flex items-center justify-center w-9 h-9 p-2 text-[#9CA3AF] hover:text-blue-600 transition-colors cursor-pointer bg-transparent border-0',
                        'html'    => '<i data-lucide="eye" class="w-4 h-4"></i>',
                        'onclick' => "app.selectProduct({$r['product_id']})"
                    ]
                ]
            ];
        }
        return ['status' => 200, 'row' => $row];
    }

    function showStock() {
        $kpis = $this->getStockKpis([
            'companies_id' => $this->companiesId,
            'branch_id'    => $_POST['branch_id']    ?? '',
            'category_id'  => $_POST['category_id']  ?? '',
            'area_id'      => $_POST['area_id']      ?? '',
            'nivel'        => $_POST['nivel']        ?? '',
            'movimiento'   => $_POST['movimiento']   ?? '',
            'q'            => $_POST['q']             ?? ''
        ]);
        return ['status' => 200, 'counts' => $kpis];
    }

    // -- Conteo fisico --
    // Borrador -> Aplicado | Cancelado. Quien abrio el conteo lo captura y lo aplica;
    // solo Aplicado mueve stock.

    function lsAjustes() {
        $rows = $this->listAjustes([
            'companies_id' => $this->companiesId,
            'branch_id'    => $_POST['branch_id'] ?? '',
            'status'       => $_POST['status']    ?? ''
        ]);

        $newId = (int) ($_POST['new_id'] ?? 0);
        $row = [];
        foreach ($rows as $r) {
            $dot   = $newId && (int) $r['id'] === $newId
                ? "<span title='Nuevo' class='inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1.5 align-middle'></span>"
                : '';
            $hora  = $r['time_adjustment'] ? ' ' . substr($r['time_adjustment'], 0, 5) : '';
            $row[] = [
                'id'          => $r['id'],
                'Folio'       => ['html' => $dot . "<span class='font-mono font-semibold text-gray-800'>" . htmlspecialchars($r['folio'], ENT_QUOTES) . '</span>'],
                'Fecha'       => ($r['date_adjustment'] ? date('d/m/Y', strtotime($r['date_adjustment'])) : '-') . $hora,
                'Almacén'     => $r['warehouse_name'] ?: '-',
                'Estado'      => $this->_adjustBadge($r['status']),
                'Contados'    => (int) $r['total_counted'] . ' / ' . (int) $r['total_products'],
                'Diferencias' => (int) $r['total_differences'],
                'Ajuste'      => $this->_signedMoney((float) $r['total_diff_cost']),
                'Registró'    => $r['registered_name'] ?: '-',
                'Aplicó'      => $r['authorized_name'] ?: '-',
                'a'           => [
                    [
                        'class'   => 'inline-flex items-center justify-center w-9 h-9 p-2 text-[#9CA3AF] hover:text-blue-600 transition-colors cursor-pointer bg-transparent border-0',
                        'html'    => '<i data-lucide="eye" class="w-4 h-4"></i>',
                        'onclick' => "stockCount.render({$r['id']})"
                    ]
                ]
            ];
        }
        return ['status' => 200, 'row' => $row];
    }

    // Abre el conteo del almacen de la sucursal elegida; si ya hay uno abierto, lo retoma.
    function addConteo() {
        $branchId = (int) ($_POST['branch_id'] ?? 0);
        if (!$branchId) return ['status' => 400, 'message' => 'Elige una sucursal: el conteo físico es por sucursal'];

        $warehouse = $this->getDefaultWarehouse([$branchId, $this->companiesId]);
        if (!$warehouse) return ['status' => 404, 'message' => 'La sucursal no tiene un almacén activo'];

        $open = $this->getOpenConteo([(int) $warehouse['id'], $this->companiesId]);
        if ($open) return ['status' => 200, 'id' => (int) $open['id']];

        $reason = $this->getReasonByCode(['CONTEO_FISICO']);
        if (!$reason) return ['status' => 500, 'message' => 'Falta el motivo CONTEO_FISICO (migración 2026-10-01_conteo-fisico.sql)'];

        $folio  = $this->nextFolio('AJU-', 'inventory_adjustment', $this->companiesId);
        $userId = $this->userId ?: null;

        try {
            return $this->transaction(function () use ($folio, $reason, $userId, $warehouse, $branchId) {
                $this->createConteo([$folio, (int) $reason['id'], $userId, (int) $warehouse['id'], $branchId, $this->companiesId]);

                $row = $this->getConteoIdByFolio([$folio, $this->companiesId]);
                $id  = (int) ($row['id'] ?? 0);
                if (!$id) throw new Exception('Sin id del conteo');

                $this->createConteoDetail([$id, $this->companiesId]);
                $this->createConteoHistory(['Borrador', 'Conteo abierto', $userId, $id]);
                $this->updateConteoTotals([$id, $id]);

                return ['status' => 200, 'id' => $id, 'folio' => $folio];
            });
        } catch (\Throwable $e) {
            return ['status' => 500, 'message' => 'No se pudo abrir el conteo'];
        }
    }

    function getConteo() {
        $id     = (int) ($_POST['id'] ?? 0);
        $header = $this->getConteoById([$id, $this->companiesId]);
        if (!$header) return ['status' => 404, 'message' => 'Conteo no encontrado'];

        $areaId = (string) ($_POST['area_id'] ?? '');
        $items  = $this->listConteoDetail([(int) $header['warehouse_id'], $id]);
        $perms  = $this->_conteoPerms($header);

        $porArea = [];
        $sheet   = [];
        foreach ($items as $it) {
            $k = (string) $it['area_id'];
            $porArea[$k] = ($porArea[$k] ?? 0) + 1;
            $sheet[] = [
                'id'     => (int) $it['item_id'],
                'area'   => $k,
                'system' => $this->_conteoSystem($it),
                'cost'   => (float) $it['cost'],
                'qty'    => $it['physical_quantity'] === null ? null : (float) $it['physical_quantity']
            ];
        }

        // Pestanas: "Todas" y cada area del almacen con cuantos productos tiene.
        $areas = [['id' => '', 'valor' => 'Todas', 'total' => count($items)]];
        foreach ($this->lsAreas([$this->companiesId]) as $a) {
            if ((int) $a['warehouse_id'] !== (int) $header['warehouse_id']) continue;
            $areas[] = [
                'id'    => (string) $a['id'],
                'valor' => $a['valor'],
                'total' => $porArea[(string) $a['id']] ?? 0
            ];
        }

        // En "Todas" cada area abre con su renglon de grupo (colgroup).
        $row   = [];
        $grupo = null;
        foreach ($items as $it) {
            $itArea = (string) $it['area_id'];
            if ($areaId !== '' && $itArea !== $areaId) continue;

            if ($areaId === '' && $itArea !== $grupo) {
                $row[] = [
                    'colgroup' => true,
                    'Area'     => ($it['area_name'] ?: 'Sin área') . ' · ' . $porArea[$itArea] . ' productos'
                ];
                $grupo = $itArea;
            }

            $row[] = [
                'id'         => $it['item_id'],
                'Producto'   => ['html' => $this->_countProduct($it['item_name'], $it['sku'])],
                'Área'       => ['html' => $this->_areaChip($it['area_name'], $it['area_color'])],
                'Unidad'     => ['html' => "<span class='text-gray-500'>" . htmlspecialchars($it['unit_code'] ?: '-', ENT_QUOTES) . '</span>'],
                'Sistema'    => ['html' => "<span class='text-gray-600'>" . $this->_qty($this->_conteoSystem($it)) . '</span>'],
                'Contado'    => ['html' => $this->_countInput($it, $perms['edit'])],
                'Diferencia' => ['html' => "<span class='text-gray-300'>—</span>"],
                'Valor'      => ['html' => "<span class='text-gray-300'>—</span>"]
            ];
        }

        return [
            'status' => 200,
            'header' => [
                'id'       => (int) $header['id'],
                'folio'    => $header['folio'],
                'status'   => $header['status'],
                'badge'    => $this->_adjustBadge($header['status']),
                'subtitle' => ($header['warehouse_name'] ?: 'Almacén') . ' · '
                            . date('d/m/Y', strtotime($header['date_adjustment'])) . ' · Folio ' . $header['folio'],
                'is_blind' => (int) $header['is_blind'],
                'info'     => $this->_conteoInfo($header)
            ],
            'perms'  => $perms,
            'thead'  => $this->_conteoThead(),
            'row'    => $row,
            'areas'  => $areas,
            'sheet'  => $sheet
        ];
    }

    // Guarda lo capturado. Solo cambia los renglones cuyo conteo cambio: al
    // capturar se toma la foto del stock (system_quantity) y la hora (counted_at).
    function editConteo() {
        $id     = (int) ($_POST['id'] ?? 0);
        $header = $this->getConteoById([$id, $this->companiesId]);
        if (!$header) return ['status' => 404, 'message' => 'Conteo no encontrado'];
        if (!$this->_conteoPerms($header)['edit']) {
            return ['status' => 403, 'message' => 'Solo quien abrió el conteo puede capturarlo mientras es borrador'];
        }

        $counts  = json_decode($_POST['counts'] ?? '{}', true) ?: [];
        $isBlind = (int) ($_POST['is_blind'] ?? 0) === 1 ? 1 : 0;

        $byItem = [];
        foreach ($this->listConteoDetail([(int) $header['warehouse_id'], $id]) as $it) {
            $byItem[(int) $it['item_id']] = $it;
        }

        try {
            return $this->transaction(function () use ($counts, $byItem, $isBlind, $id) {
                foreach ($counts as $itemId => $value) {
                    $it = $byItem[(int) $itemId] ?? null;
                    if (!$it) continue;

                    if ($value === '' || $value === null) {
                        if ($it['physical_quantity'] !== null) $this->clearConteoDetail([(int) $it['detail_id']]);
                        continue;
                    }

                    $physical = max(0, round((float) $value, 4));
                    if ($it['physical_quantity'] !== null && abs((float) $it['physical_quantity'] - $physical) < 0.00001) continue;

                    $system = (float) $it['stock_live'];
                    $cost   = (float) $it['cost'];
                    $diff   = round($physical - $system, 4);
                    $this->updateConteoDetail([$system, $physical, $diff, $cost, round($diff * $cost, 4), (int) $it['detail_id']]);
                }

                $this->updateConteo([
                    'values' => ['is_blind'],
                    'where'  => ['id'],
                    'data'   => [$isBlind, $id]
                ]);
                $this->updateConteoTotals([$id, $id]);

                return ['status' => 200, 'message' => 'Borrador guardado'];
            });
        } catch (\Throwable $e) {
            return ['status' => 500, 'message' => 'No se pudo guardar el conteo'];
        }
    }

    function statusConteo() {
        $id     = (int) ($_POST['id'] ?? 0);
        $header = $this->getConteoById([$id, $this->companiesId]);
        if (!$header) return ['status' => 404, 'message' => 'Conteo no encontrado'];

        if (($_POST['action'] ?? '') !== 'aplicar') return ['status' => 400, 'message' => 'Acción no válida'];
        if (!$this->_conteoPerms($header)['apply']) return ['status' => 403, 'message' => 'Solo quien abrió el conteo puede aplicarlo mientras es borrador'];
        if ((int) $header['total_counted'] === 0) return ['status' => 400, 'message' => 'Captura al menos un producto antes de aplicar'];

        return $this->_aplicarConteo($header);
    }

    // Al acertar queda una autorización en sesión para ESE conteo durante
    // CANCEL_WINDOW segundos; cancelConteo la exige y la consume.
    const CANCEL_WINDOW = 600;

    function verifyCancelPassword() {
        $id     = (int) ($_POST['id'] ?? 0);
        $header = $this->getConteoById([$id, $this->companiesId]);
        if (!$header) return ['status' => 404, 'message' => 'Conteo no encontrado'];

        $user  = $this->qUserPassword([$this->userId]);
        $pass  = str_replace("'", "", $_POST['password'] ?? '');
        $valid = $user && (
            (!empty($user['password']) && password_verify($pass, $user['password'])) ||
            (!empty($user['user_key']) && $user['user_key'] === md5($pass))
        );
        if (!$valid) return ['status' => 401, 'message' => 'Contraseña incorrecta'];

        $_SESSION['adjustment_cancel'][$id] = time();
        return ['status' => 200, 'message' => 'OK'];
    }

    private function cancelAuthorized($id) {
        $at = (int) ($_SESSION['adjustment_cancel'][$id] ?? 0);
        return $at > 0 && (time() - $at) <= self::CANCEL_WINDOW;
    }

    function cancelConteo() {
        $id     = (int) ($_POST['id'] ?? 0);
        $header = $this->getConteoById([$id, $this->companiesId]);
        if (!$header) return ['status' => 404, 'message' => 'Conteo no encontrado'];
        if (!$this->_conteoPerms($header)['cancel']) {
            $vencido = $header['status'] === 'Aplicado' && !$this->_cancelVigente($header);
            return ['status' => 403, 'message' => $vencido
                ? 'Pasaron más de ' . self::CANCEL_DAYS . ' días desde que se aplicó: ya no se puede cancelar'
                : 'Solo quien abrió el conteo puede cancelarlo'];
        }
        if (!$this->cancelAuthorized($id)) return ['status' => 403, 'message' => 'Confirma tu contraseña para cancelar el conteo'];
        unset($_SESSION['adjustment_cancel'][$id]);

        if ($header['status'] === 'Aplicado') return $this->_revertirConteo($header);

        return $this->_conteoTransition($id, ['status'], ['Cancelado'], 'Cancelado', 'Conteo cancelado', 'Conteo cancelado');
    }

    function getProducto() {
        $product_id = (int) $_POST['id'];
        $product    = $this->getProduct([$product_id]);
        if (empty($product)) {
            return ['status' => 404, 'message' => 'Producto no encontrado'];
        }

        $stockRows = $this->getStockByProduct([$product_id]);
        $movsRows  = $this->getMovimientosByProduct([$product_id, $this->companiesId]);

        $total = 0;
        foreach ($stockRows as $s) {
            $total += (float) $s['quantity'];
        }
        $stockSuc = ['' => $total];
        foreach ($stockRows as $s) {
            $sid = (string) $s['branch_id'];
            $stockSuc[$sid] = ($stockSuc[$sid] ?? 0) + (float) $s['quantity'];
        }

        $min = (float) ($product['stock_min'] ?? 0);
        if ($total <= 0) {
            $estado = 'agotado';
        } elseif ($total <= $min) {
            $estado = 'bajo';
        } else {
            $estado = 'ok';
        }

        $almacenes = [];
        foreach ($stockRows as $s) {
            $almacenes[] = [
                'name' => $s['warehouse_name'],
                'type' => 'info'
            ];
        }

        $typeMap = [
            'ENTRADA'       => 'in',
            'MERMA'         => 'out',
            'TRANSFERENCIA' => 'tr',
            'AJUSTE'        => 'adjust'
        ];
        $labelMap = [
            'ENTRADA'       => 'Entrada',
            'MERMA'         => 'Merma',
            'TRANSFERENCIA' => 'Transferencia',
            'AJUSTE'        => 'Ajuste'
        ];
        $movs = [];
        foreach ($movsRows as $m) {
            $type  = $typeMap[$m['movement_type']] ?? 'adjust';
            $label = ($labelMap[$m['movement_type']] ?? $m['movement_type']) . ' · ' . ($m['folio'] ?? '-');
            $qty   = (float) $m['quantity'];
            $movs[] = [
                'type'  => $type,
                'label' => $label,
                'qty'   => $qty >= 0 ? '+' . $qty : (string) $qty,
                'prev'   => $m['stock_prev'] !== null ? $this->_qty($m['stock_prev']) : null,
                'post'   => $m['stock_post'] !== null ? $this->_qty($m['stock_post']) : null,
                'when'   => ($m['occurred_at'] ?? '') . ' · ' . ($m['warehouse_name'] ?? '-'),
                'branch' => $m['branch_name'] ?? ''
            ];
        }

        $dias = isset($product['shelf_life_days']) && $product['shelf_life_days'] !== null
            ? (int) $product['shelf_life_days']
            : null;
        if ($dias === null) {
            $vidaLabel = 'na';
        } elseif ($dias <= 2) {
            $vidaLabel = 'critico';
        } elseif ($dias <= 5) {
            $vidaLabel = 'proximo';
        } else {
            $vidaLabel = 'ok';
        }

        $producto = [
            'name'      => $product['name'],
            'image'     => $product['image'] ?? '',
            'sku'       => $product['sku'] ?: '-',
            'categoria' => $product['category_name'] ?: 'Sin categoría',
            'estado'    => $estado,
            'min'       => (float) ($product['stock_min'] ?? 0),
            'max'       => (float) ($product['stock_max'] ?? 0),
            'stockSuc'  => $stockSuc,
            'almacenes' => $almacenes,
            'movs'      => $movs,
            'vida'      => ['dias' => $dias, 'label' => $vidaLabel],
            'iconBg'    => 'bg-gray-100',
            'iconText'  => 'text-gray-500'
        ];

        return ['status' => 200, 'producto' => $producto];
    }

    function predict() {
        $product_id = (int) $_POST['id'];

        $product   = $this->getProduct([$product_id]);
        if (empty($product)) {
            return ['status' => 404, 'message' => 'Producto no encontrado'];
        }

        $stockRows = $this->getStockByProduct([$product_id]);
        $movsRows  = $this->getMovimientosByProduct([$product_id, $this->companiesId]);

        $total = 0;
        foreach ($stockRows as $s) {
            $total += (float) $s['quantity'];
        }

        $salidas = [];
        foreach ($movsRows as $m) {
            if ($m['movement_type'] === 'MERMA' || (float) $m['quantity'] < 0) {
                $salidas[] = abs((float) $m['quantity']);
            }
        }

        $min = (float) ($product['stock_min'] ?? 0);
        $max = (float) ($product['stock_max'] ?? 0);

        $movResumen = [];
        foreach ($movsRows as $m) {
            $q = (float) $m['quantity'];
            $movResumen[] = [
                'tipo'  => $m['movement_type'],
                'qty'   => $q,
                'fecha' => $m['occurred_at'] ?? $m['created_at'] ?? ''
            ];
        }

        // Tendencia de rotacion: consumo (salidas) por dia de los ultimos 7
        // dias + delta contra la semana previa. Es dato real, no inferido por
        // la IA; se la pasamos al modelo para fundamentar la recomendacion.
        $trend = $this->_buildTendencia($product_id);

        $promptData = json_encode([
            'producto'  => $product['name'],
            'sku'       => $product['sku'] ?? '',
            'stock'     => $total,
            'stock_min' => $min,
            'stock_max' => $max,
            'movimientos'         => $movResumen,
            'actividad_diaria_7d' => array_map(fn($t) => [
                'fecha'   => $t['fecha'],
                'entrada' => $t['entrada'],
                'salida'  => $t['salida']
            ], $trend['tendencia']),
            'entradas_7d'         => $trend['entradas'],
            'salidas_7d'          => $trend['salidas'],
            'variacion_pct_semana' => $trend['delta']
        ], JSON_UNESCAPED_UNICODE);

        $systemMsg = 'Eres un asistente de inventario. Analiza el stock y movimientos del producto y responde UNICAMENTE con un objeto JSON sin texto adicional, sin markdown, sin bloques de codigo. El JSON debe tener exactamente estas claves: dias_agotamiento (entero, estimacion de dias hasta agotarse basandose en el consumo historico), reorden_sugerido (entero, unidades sugeridas para reordenar), resumen (string en espanol, maximo 2 oraciones explicando el patron y la recomendacion).';

        $userMsg = "Analiza este producto y devuelve el JSON solicitado:\n" . $promptData;

        $messages = [
            ['role' => 'system', 'content' => $systemMsg],
            ['role' => 'user',   'content' => $userMsg]
        ];

        // La IA es opcional: si falla (red/credenciales/JSON invalido) igual
        // devolvemos la tendencia real para que el grafico se dibuje. Por eso
        // estas rutas NO cortan con status 500: marcan ia_ok = false.
        $iaOk    = false;
        $iaMsg   = '';
        $dias    = 0;
        $reorden = 0;
        $resumen = '';

        // Mismo cliente que Entradas y Salidas: modelo de Administrador > CoffeeIA.
        // El del visor (OllamaClient) leia OLLAMA_DEFAULT_MODEL, retirado (HTTP 410).
        $ia = IaOllama::desdeCredenciales($this);

        if ($ia === null) {
            $iaMsg = 'La IA no está configurada: falta la llave de Ollama.';
        } else {
            session_write_close();
            set_time_limit(180);

            $r = $ia->chatJson($messages);

            if ($r['ok']) {
                $iaOk    = true;
                $dias    = (int) ($r['data']['dias_agotamiento'] ?? 0);
                $reorden = (int) ($r['data']['reorden_sugerido'] ?? 0);
                $resumen = (string) ($r['data']['resumen'] ?? '');
            } else {
                $iaMsg = $r['error'];
            }
        }

        // Proyeccion de stock a 7 dias: extrapolacion lineal con el promedio
        // diario de salidas de los ultimos 7 dias. No depende de la IA: si no
        // hay historial de salidas devolvemos serie vacia y el frontend solo
        // pintara el historico + el texto IA.
        $proyeccion = [];
        $salidas7d  = (float) $trend['salidas'];
        if ($salidas7d > 0) {
            $promedioSalida = $salidas7d / 7.0;
            $diaLetra = [1 => 'L', 2 => 'M', 3 => 'M', 4 => 'J', 5 => 'V', 6 => 'S', 7 => 'D'];
            for ($offset = 1; $offset <= 7; $offset++) {
                $ts   = strtotime("+{$offset} days");
                $date = date('Y-m-d', $ts);
                $stockFuturo = max(0.0, (float) $total - ($promedioSalida * $offset));
                $proyeccion[] = [
                    'dia'    => $diaLetra[(int) date('N', $ts)],
                    'offset' => $offset,
                    'fecha'  => $date,
                    'stock'  => $stockFuturo
                ];
            }
        }

        return [
            'status'           => 200,
            'ia_ok'            => $iaOk,
            'mensaje_ia'       => $iaMsg,
            'dias_agotamiento' => $dias,
            'reorden_sugerido' => $reorden,
            'resumen'          => $resumen,
            'tendencia'        => $trend['tendencia'],
            'tendencia_delta'  => $trend['delta'],
            'tendencia_total'  => $trend['total'],
            'tendencia_entradas' => $trend['entradas'],
            'tendencia_salidas'  => $trend['salidas'],
            'stock_actual'     => (float) $total,
            'stock_min'        => $min,
            'proyeccion_stock' => $proyeccion
        ];
    }

    // Construye la serie de 7 dias (entradas y salidas por dia) y el delta %
    // de actividad total (entradas + salidas) contra la semana anterior, a
    // partir de los movimientos reales del producto.
    private function _buildTendencia($product_id) {
        $rows = $this->getMovActividadDiaria([$product_id, $this->companiesId]);

        $map = [];
        foreach ($rows as $r) {
            // DATE() en MySQL puede devolver la fecha con hora cuando el
            // driver PDO la serializa como datetime. Normalizamos a 'Y-m-d'
            // para que el match por clave con date('Y-m-d', ...) funcione.
            $key = date('Y-m-d', strtotime((string) $r['dia']));
            $map[$key] = [
                'entrada' => (float) $r['entrada'],
                'salida'  => (float) $r['salida']
            ];
        }

        $diaLetra = [1 => 'L', 2 => 'M', 3 => 'M', 4 => 'J', 5 => 'V', 6 => 'S', 7 => 'D'];

        $tendencia = [];
        $sumEnt = 0;
        $sumSal = 0;
        for ($i = 6; $i >= 0; $i--) {
            $ts   = strtotime("-{$i} days");
            $date = date('Y-m-d', $ts);
            $ent  = $map[$date]['entrada'] ?? 0;
            $sal  = $map[$date]['salida']  ?? 0;
            $sumEnt += $ent;
            $sumSal += $sal;
            $tendencia[] = [
                'dia'     => $diaLetra[(int) date('N', $ts)],
                'entrada' => $ent,
                'salida'  => $sal,
                'fecha'   => $date
            ];
        }

        $sumPrev = 0;
        for ($i = 13; $i >= 7; $i--) {
            $date     = date('Y-m-d', strtotime("-{$i} days"));
            $sumPrev += ($map[$date]['entrada'] ?? 0) + ($map[$date]['salida'] ?? 0);
        }

        $sum7  = $sumEnt + $sumSal;
        $delta = $sumPrev > 0 ? (int) round((($sum7 - $sumPrev) / $sumPrev) * 100) : null;

        return [
            'tendencia' => $tendencia,
            'total'     => $sum7,
            'entradas'  => $sumEnt,
            'salidas'   => $sumSal,
            'delta'     => $delta
        ];
    }

    private function _qty($n) {
        $n = (float) $n;
        return (fmod($n, 1) == 0) ? (string) (int) $n : (string) round($n, 2);
    }

    // La foto (item.image) es relativa a inventory/ (uploads/productos/...) y esta tabla
    // se pinta en operacion/almacen/: mismo criterio que renderProductImage (ctrl-almacen)
    // e inventoryFileUrl (coffeeSoft.js). Si no carga, queda el cubo.
    private function _productCell($image, $name, $id = 0, $sku = '') {
        $image = trim((string) $image);
        $src   = '';
        if ($image !== '') $src = preg_match('#^(https?:)?//|^/#', $image) ? $image : '../../' . $image;
        $label = htmlspecialchars(trim((string) $name), ENT_QUOTES);
        $sku   = trim((string) $sku);
        $id    = (int) $id;

        $imgTag = $src !== ''
            ? '<img src="' . htmlspecialchars($src, ENT_QUOTES) . '" onerror="this.remove();"'
                . ' alt="Producto" class="absolute inset-0 w-full h-full object-cover" />'
            : '';

        $click = $id ? ' onclick="app.selectProduct(' . $id . ')" title="Clic para ver detalle"' : '';
        $hover = $id ? ' cursor-pointer transition duration-150 hover:ring-2 hover:ring-blue-400/60 hover:scale-105' : '';

        $skuTag = $sku !== ''
            ? '<span class="font-mono text-[10px] text-gray-400">' . htmlspecialchars($sku, ENT_QUOTES) . '</span>'
            : '';

        return '
            <div class="flex items-center gap-3">
                <div class="relative flex-shrink-0 w-10 h-10 rounded-md bg-gray-100 flex items-center justify-center overflow-hidden' . $hover . '"' . $click . '>
                    <i class="icon-cube text-gray-400 text-lg"></i>
                    ' . $imgTag . '
                </div>
                <div class="flex flex-col leading-tight">
                    <span class="text-sm text-gray-800">' . $label . '</span>
                    ' . $skuTag . '
                </div>
            </div>';
    }

    // -- Conteo fisico: complementos --

    // Quien abrio el conteo lo captura, lo aplica o lo cancela mientras es borrador.
    // Ya aplicado, solo el puede cancelarlo durante CANCEL_DAYS: se revierte el stock.
    // Pendiente: enviado a revision antes de quitar ese paso (01/10/2026); cuenta como borrador.
    const CANCEL_DAYS = 2;

    private function _conteoPerms($header) {
        $owner    = $this->userId > 0 && (int) $header['registered_user_id'] === $this->userId;
        $editable = $owner && in_array($header['status'], ['Borrador', 'Pendiente'], true);
        return [
            'edit'   => $editable,
            'apply'  => $editable,
            'cancel' => $editable || ($owner && $this->_cancelVigente($header))
        ];
    }

    private function _cancelVigente($header) {
        return $header['status'] === 'Aplicado'
            && !empty($header['authorized_at'])
            && time() <= $this->_cancelLimite($header);
    }

    private function _cancelLimite($header) {
        return strtotime($header['authorized_at']) + self::CANCEL_DAYS * 86400;
    }

    // Contado: la foto del stock al capturar. Pendiente: el stock vivo.
    private function _conteoSystem($it) {
        return $it['physical_quantity'] !== null ? (float) $it['system_quantity'] : (float) $it['stock_live'];
    }

    private function _conteoInfo($header) {
        $quien = $header['authorized_name'] ?: 'el usuario';
        $fecha = $header['authorized_at'] ? date('d/m/Y H:i', strtotime($header['authorized_at'])) : '';

        if ($header['status'] === 'Aplicado') {
            $limite = $this->_cancelVigente($header)
                ? ' Se puede cancelar hasta el ' . date('d/m/Y H:i', $this->_cancelLimite($header)) . '.'
                : '';
            return ['tone' => 'emerald', 'text' => "Aplicado por {$quien} el {$fecha}. Las diferencias ya están en el stock y en el kárdex.{$limite}"];
        }
        if ($header['status'] === 'Cancelado') {
            $text = $header['authorized_at'] ? 'Ajuste cancelado. El stock volvió a como estaba.' : 'Conteo cancelado. No movió el stock.';
            return ['tone' => 'gray', 'text' => $text];
        }
        if ($this->_conteoPerms($header)['edit']) {
            return ['tone' => 'blue', 'text' => 'Captura en «Contado» lo que hay físicamente en el anaquel. La hoja va área por área, como está en el almacén.'];
        }
        return ['tone' => 'gray', 'text' => 'La hoja sigue el orden físico del almacén: área por área, como está en el anaquel.'];
    }

    private function _conteoThead() {
        $th = function ($label, $align) {
            return "<div class='text-{$align} text-[9px] uppercase tracking-wider font-semibold text-gray-500'>{$label}</div>";
        };
        return [
            $th('Producto', 'left'),
            $th('Área', 'left'),
            $th('Unidad', 'center'),
            $th('Sistema', 'right'),
            $th('Contado', 'center'),
            $th('Diferencia', 'right'),
            $th('Valor', 'right')
        ];
    }

    private function _countProduct($name, $sku) {
        $skuTag = $sku ? "<div class='text-[9px] text-gray-400 font-mono'>" . htmlspecialchars($sku, ENT_QUOTES) . '</div>' : '';
        return "<div class='leading-tight'><div class='text-[11px] text-gray-800'>" . htmlspecialchars($name, ENT_QUOTES) . "</div>{$skuTag}</div>";
    }

    private function _areaChip($name, $color) {
        if (empty($name)) {
            return "<span class='text-[9px] text-gray-400'>Sin área</span>";
        }
        $hex   = preg_match('/^#[0-9a-fA-F]{6}$/', (string) $color) ? $color : '#6B7280';
        $label = htmlspecialchars($name, ENT_QUOTES);
        return "<span class='inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-semibold whitespace-nowrap' style='background:{$hex}14;color:{$hex};'>"
             . "<span class='w-1.5 h-1.5 rounded-full' style='background:{$hex};'></span>{$label}</span>";
    }

    // El JS calcula diferencia y valor en vivo con data-system y data-cost.
    // Fuera de borrador se pinta como texto: sin borde y sin captura.
    // compact.css fuerza 1rem y height:auto (!important) en input number: tamano va en style.
    // Borde con border-[1px]: la clase `border` de Bootstrap trae color !important.
    private function _countInput($it, $editable) {
        $value = $it['physical_quantity'] === null ? '' : $this->_qty($it['physical_quantity']);
        $skin  = $editable
            ? 'rounded-lg border-[1px] border-gray-200 bg-gray-50 shadow-sm hover:border-gray-300 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-colors'
            : 'border-0 bg-transparent';
        return '<input type="number" min="0" step="any" inputmode="decimal" placeholder="' . ($editable ? '—' : 'Sin contar') . '"'
             . ' data-count="' . (int) $it['item_id'] . '" data-system="' . $this->_conteoSystem($it) . '" data-cost="' . (float) $it['cost'] . '"'
             . ' value="' . $value . '"' . ($editable ? '' : ' disabled')
             . ' style="font-size:11px !important;height:28px !important;"'
             . ' class="w-[84px] px-[8px] text-center font-semibold text-gray-800 placeholder:font-normal placeholder:text-gray-300 ' . $skin
             . ' [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none">';
    }

    private function _adjustBadge($status) {
        $map = [
            'Borrador'  => ['cls' => 'bg-gray-100 text-gray-600',       'lbl' => 'BORRADOR'],
            'Pendiente' => ['cls' => 'bg-gray-100 text-gray-600',       'lbl' => 'BORRADOR'],
            'Aplicado'  => ['cls' => 'bg-emerald-100 text-emerald-700', 'lbl' => 'APLICADO'],
            'Cancelado' => ['cls' => 'bg-gray-100 text-gray-400',       'lbl' => 'CANCELADO']
        ];
        $c = $map[$status] ?? ['cls' => 'bg-gray-100 text-gray-600', 'lbl' => strtoupper((string) $status)];
        return "<span class='inline-block px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap {$c['cls']}'>{$c['lbl']}</span>";
    }

    private function _signedMoney($n) {
        if (abs($n) < 0.005) return "<span class='text-gray-400'>$0.00</span>";
        $cls = $n < 0 ? 'text-rose-600' : 'text-sky-700';
        return "<span class='font-semibold {$cls}'>" . ($n < 0 ? '-' : '+') . '$' . number_format(abs($n), 2) . '</span>';
    }

    private function _conteoTransition($id, $values, $data, $status, $note, $message) {
        try {
            return $this->transaction(function () use ($id, $values, $data, $status, $note, $message) {
                $this->updateConteo([
                    'values' => $values,
                    'where'  => ['id'],
                    'data'   => array_merge($data, [$id])
                ]);
                $this->createConteoHistory([$status, $note, $this->userId ?: null, $id]);
                return ['status' => 200, 'message' => $message];
            });
        } catch (\Throwable $e) {
            return ['status' => 500, 'message' => 'No se pudo actualizar el conteo'];
        }
    }

    // Se suma la diferencia al stock de ESE momento, no se escribe lo contado:
    // asi no se pierde una salida registrada mientras se contaba.
    private function _aplicarConteo($header) {
        $id        = (int) $header['id'];
        $warehouse = (int) $header['warehouse_id'];
        $items     = $this->listConteoDetail([$warehouse, $id]);

        try {
            return $this->transaction(function () use ($id, $warehouse, $items, $header) {
                foreach ($items as $it) {
                    if ($it['physical_quantity'] === null) continue;

                    $diff     = (float) $it['difference'];
                    $stockRow = $this->getStockRow([(int) $it['item_id'], $warehouse]);

                    if (abs($diff) < 0.00001) {
                        if ($stockRow) $this->updateStockInventoryAt([(int) $stockRow['id']]);
                        continue;
                    }

                    $prev = $stockRow ? (float) $stockRow['quantity'] : 0;
                    $post = max(0, round($prev + $diff, 4));
                    $this->updateConteoDetailStock([$prev, $post, (int) $it['detail_id']]);

                    if ($stockRow) $this->updateStockConteo([$post, (int) $stockRow['id']]);
                    else $this->insertStockConteo([$post, $warehouse, (int) $it['item_id'], $this->companiesId]);
                }

                $this->updateConteo([
                    'values' => ['status', 'authorized_user_id', 'authorized_at = NOW()'],
                    'where'  => ['id'],
                    'data'   => ['Aplicado', $this->userId, $id]
                ]);
                $this->createConteoHistory(['Aplicado', 'Ajuste aplicado', $this->userId, $id]);

                return ['status' => 200, 'message' => "Ajuste {$header['folio']} aplicado correctamente"];
            });
        } catch (\Throwable $e) {
            return ['status' => 500, 'message' => 'No se pudo aplicar el ajuste; el stock no cambió'];
        }
    }

    // Resta al stock de ESE momento lo que el ajuste sumo (resulting - previous),
    // igual que al aplicar: no se pisan los movimientos posteriores.
    private function _revertirConteo($header) {
        $id        = (int) $header['id'];
        $warehouse = (int) $header['warehouse_id'];
        $items     = $this->listConteoDetail([$warehouse, $id]);

        try {
            return $this->transaction(function () use ($id, $warehouse, $items, $header) {
                foreach ($items as $it) {
                    if ($it['previous_stock'] === null || $it['resulting_stock'] === null) continue;

                    $applied  = (float) $it['resulting_stock'] - (float) $it['previous_stock'];
                    $stockRow = $this->getStockRow([(int) $it['item_id'], $warehouse]);
                    if (!$stockRow || abs($applied) < 0.00001) continue;

                    $post = max(0, round((float) $stockRow['quantity'] - $applied, 4));
                    $this->updateStockQuantity([$post, (int) $stockRow['id']]);
                }

                $this->updateConteo([
                    'values' => ['status'],
                    'where'  => ['id'],
                    'data'   => ['Cancelado', $id]
                ]);
                $this->createConteoHistory(['Cancelado', 'Ajuste cancelado; stock revertido', $this->userId ?: null, $id]);

                return ['status' => 200, 'message' => "Ajuste {$header['folio']} cancelado y stock restaurado"];
            });
        } catch (\Throwable $e) {
            return ['status' => 500, 'message' => 'No se pudo cancelar el ajuste; el stock no cambió'];
        }
    }

    private function _lastMovBadge($type) {
        if (empty($type)) {
            return "<span class='text-[10px] text-gray-300'>Sin movimiento</span>";
        }
        $map = [
            'ENTRADA'       => ['bg' => 'rgba(63,193,137,0.15)', 'fg' => '#15803D', 'lbl' => 'Entrada'],
            'MERMA'         => ['bg' => 'rgba(224,36,36,0.15)',  'fg' => '#B91C1C', 'lbl' => 'Merma'],
            'TRANSFERENCIA' => ['bg' => 'rgb(var(--brand-600, 192 90 64) / 0.15)',  'fg' => 'rgb(var(--brand-600, 192 90 64))', 'lbl' => 'Traspaso'],
            'AJUSTE'        => ['bg' => 'rgba(167,139,250,0.15)','fg' => '#7C3AED', 'lbl' => 'Ajuste']
        ];
        $c = $map[$type] ?? ['bg' => 'rgba(156,163,175,0.18)', 'fg' => '#6B7280', 'lbl' => $type];
        return "<span class='px-2 py-0.5 rounded text-[10px] font-bold' style='background:{$c['bg']};color:{$c['fg']};'>{$c['lbl']}</span>";
    }

    private function _levelBadge($qty, $min) {
        if ($qty <= 0) {
            $c = ['bg' => 'rgba(224,36,36,0.18)', 'fg' => '#E02424', 'lbl' => 'AGOTADO'];
        } elseif ($qty <= $min) {
            $c = ['bg' => 'rgba(251,191,36,0.18)', 'fg' => '#FBBF24', 'lbl' => 'BAJO'];
        } else {
            $c = ['bg' => 'rgba(63,193,137,0.18)', 'fg' => '#3FC189', 'lbl' => 'OK'];
        }
        return "<span class='px-2 py-0.5 rounded text-[10px] font-bold' style='background:{$c['bg']};color:{$c['fg']};'>{$c['lbl']}</span>";
    }
}

$obj = new ctrl();
$opc = $_POST['opc'];
if (!method_exists($obj, $opc)) {
    echo json_encode(['status' => 405, 'message' => "opc '{$opc}' no implementado"]);
    exit(0);
}
echo json_encode($obj->{$opc}());
