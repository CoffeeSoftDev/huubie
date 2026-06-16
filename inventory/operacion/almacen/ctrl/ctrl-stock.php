<?php
session_start();
if (empty($_POST['opc'])) exit(0);

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

require_once '../mdl/mdl-stock.php';
require_once '../../../conf/coffeSoft.php';

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
            'categorias'      => $this->lsCategories([$this->companiesId])
        ];
    }

    function lsStock() {
        $rows = $this->qStock([
            'companies_id'    => $this->companiesId,
            'branch_id'       => $_POST['branch_id'] ?? '',
            'category_id'     => $_POST['category_id']     ?? '',
            'nivel'           => $_POST['nivel']           ?? '',
            'movimiento'      => $_POST['movimiento']      ?? '',
            'q'               => $_POST['q']               ?? ''
        ]);

        $row = [];
        foreach ($rows as $r) {
            $qty = (float) $r['quantity_total'];
            $min = (float) $r['stock_min'];
            $max = (float) $r['stock_max'];
            $row[] = [
                'id'        => $r['product_id'],
                'Producto'  => [
                    'class' => 'justify-start px-2 py-2',
                    'html'  => $this->_productCell($r['image'] ?? '', $r['product_name'], $r['product_id'], $r['sku'] ?: '')
                ],
                'Categoria' => $r['category_name'] ?: '-',
                'Stock'     => $this->_qty($qty),
                'Min'       => $min > 0 ? $this->_qty($min) : '-',
                'Max'       => $max > 0 ? $this->_qty($max) : '-',
                'Unidad'    => $r['unit_code'] ?: '-',
                'Estado'    => $this->_levelBadge($qty, $min),
                'Ult. Mov'  => $this->_lastMovBadge($r['last_movement_type'] ?? ''),
                'a'         => [
                    [
                        'class'   => 'inline-flex items-center justify-center w-9 h-9 p-2 text-[#9CA3AF] hover:text-[#C05A40] transition-colors cursor-pointer bg-transparent border-0',
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
            'movimiento'   => $_POST['movimiento']   ?? '',
            'q'            => $_POST['q']             ?? ''
        ]);
        return ['status' => 200, 'counts' => $kpis];
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
            'sku'       => $product['sku'] ?: '-',
            'categoria' => $product['category_name'] ?: 'Sin categoria',
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

        try {
            require_once '../../../../coffee/app/visor/ctrl/ollama-client.php';
            $client = new OllamaClient();
            $result = $client->chat($messages, null, ['temperature' => 0.2]);

            $raw = $result['message']['content'] ?? '';
            $raw = preg_replace('/^```(?:json)?\s*/i', '', trim($raw));
            $raw = preg_replace('/\s*```$/', '', $raw);
            $raw = trim($raw);

            $json = json_decode($raw, true);
            if (!is_array($json) || !isset($json['dias_agotamiento'])) {
                preg_match('/\{.*\}/s', $raw, $m2);
                if (!empty($m2[0])) {
                    $json = json_decode($m2[0], true);
                }
            }

            if (is_array($json)) {
                $iaOk    = true;
                $dias    = (int) ($json['dias_agotamiento'] ?? 0);
                $reorden = (int) ($json['reorden_sugerido'] ?? 0);
                $resumen = (string) ($json['resumen'] ?? '');
            } else {
                $iaMsg = 'La IA no devolvio una respuesta valida.';
            }
        } catch (Throwable $e) {
            $iaMsg = 'No se pudo conectar con la IA.';
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

    private function _productCell($image, $name, $id = 0, $sku = '') {
        $path  = ltrim((string) $image, '/');
        $local = !empty($path) ? '/' . $path : '';
        $prod  = !empty($path) ? 'https://huubie.com.mx/' . $path : '';
        $label = htmlspecialchars(trim((string) $name), ENT_QUOTES);
        $sku   = trim((string) $sku);
        $id    = (int) $id;

        $imgTag = !empty($local)
            ? '<img src="' . $local . '" data-prod="' . $prod . '"'
                . ' onerror="if(this.dataset.prod){this.src=this.dataset.prod;this.dataset.prod=\'\';}else{this.remove();}"'
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

    private function _lastMovBadge($type) {
        if (empty($type)) {
            return "<span class='text-[10px] text-gray-300'>Sin movimiento</span>";
        }
        $map = [
            'ENTRADA'       => ['bg' => 'rgba(63,193,137,0.15)', 'fg' => '#15803D', 'lbl' => 'Entrada'],
            'MERMA'         => ['bg' => 'rgba(224,36,36,0.15)',  'fg' => '#B91C1C', 'lbl' => 'Merma'],
            'TRANSFERENCIA' => ['bg' => 'rgba(192,90,64,0.15)',  'fg' => '#C05A40', 'lbl' => 'Traspaso'],
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
