<?php
require_once __DIR__ . '/../../../core/security/_Session.php';
if (empty($_POST['opc'])) exit(0);

require_once __DIR__ . '/core-inventarios.php';

/*  Stock: el «Visor de Stock» de inventory/operacion/almacen/stock aplicado
    al Catálogo de pro. Tarjetas por nivel (clic = filtra), filtros de área,
    categoría y movimientos, la tabla de existencias y, en el ojo, la vista del
    producto: existencia por sucursal, almacenes, vida útil y sus movimientos.
    Pestaña «Por caducar»: los lotes que vencen pronto (lo propio de pro).
    Desde la vista del producto, «Abrir ficha»: su sección Inventario (área,
    mínimo, máximo, lotes; en un insumo también grupo y proveedor). Pide la
    casilla editar de Catálogo de insumos, aunque no tenga el Catálogo de
    venta: lo demás de la ficha se ve y no se toca (propuesta B, 28/11/2026).

    Pestaña «Conteos físicos» (R1, 29/11/2026): la de inventory. Un conteo es
    de un almacén de la sucursal: borrador → aplicado | cancelado. Al aplicar,
    cada diferencia se suma al stock de ESE momento (no se escribe lo contado:
    así no se pierde una venta registrada mientras se contaba) y queda en el
    kárdex como AJUSTE. Cancelar un aplicado lo revierte hasta 48 h después.

    En la vista del producto, «Pronóstico» (R3): para cuántos días alcanza con
    lo que sale en promedio, y el texto de CoffeeIA si está configurada.

    Casillas: show, update (abrir y capturar un conteo), aplicar-ajuste (sin
    ella cuenta a ciegas y el conteo queda en borrador), cancel (revertir un
    ajuste aplicado), print, ver-costos. La ficha: update de inv-catalogo. */
class ctrl extends core {

    const SECTION       = 'inv-stock';
    const MOVEMENT_DAYS = 30;
    const CANCEL_HOURS  = 48;

    const ADJUST_STATUS = ['draft' => 'Borrador', 'applied' => 'Aplicado', 'cancelled' => 'Cancelado'];

    public function init() {
        $fail = $this->needBranch();
        if ($fail) return $fail;

        $whIds = array_map('intval', array_column($this->warehouses(), 'id'));

        return $this->baseInit([
            'branch_id'      => $this->branchId(),
            'sucursales'     => $this->branchOptions(),
            'areas'          => $this->areaList(),
            'categorias'     => $this->categoryList(),
            'movement_days'  => self::MOVEMENT_DAYS,
            'lots'           => count($this->qExpiringLots($whIds, 7)),
            'costs'          => $this->costs(),
            'estados_ajuste' => [
                ['id' => '',          'valor' => 'Todos los estados'],
                ['id' => 'draft',     'valor' => 'Borrador'],
                ['id' => 'applied',   'valor' => 'Aplicado'],
                ['id' => 'cancelled', 'valor' => 'Cancelado']
            ]
        ]);
    }

    // -- Existencias --

    // ok · bajo (en el mínimo o debajo) · agotado. Como inventory: el máximo no cambia el nivel.
    private function level($qty, $min) {
        if ($qty <= 0) return 'agotado';
        if ($min > 0 && $qty <= $min) return 'bajo';

        return 'ok';
    }

    /*  Los productos con lo que hay en los almacenes de la sucursal, con los
        filtros (category_id, area_id, movimiento = 'con': movidos en los
        últimos MOVEMENT_DAYS días). $level filtra por nivel. */
    private function rows($level = '') {
        $whIds    = array_map('intval', array_column($this->warehouses(), 'id'));
        $stock    = [];
        $category = $this->selectOrNull('category_id');
        $area     = $this->selectOrNull('area_id');
        $moved    = $this->post('movimiento') === 'con';
        $last     = $this->qLastMoves($whIds);
        $since    = date('Y-m-d', strtotime($this->qNow()['today'] . ' -' . self::MOVEMENT_DAYS . ' days'));
        $list     = [];

        foreach ($this->qStockByProduct($whIds) as $row) $stock[(int) $row['product_id']] = (float) $row['quantity'];

        foreach ($this->products() as $p) {
            $id  = (int) $p['id'];
            $qty = round($stock[$id] ?? 0, 4);
            $lvl = $this->level($qty, (float) $p['stock_min']);
            $mov = $last[$id] ?? null;

            if ($category !== null && (int) $p['category_id'] !== $category) continue;
            if ($area !== null && (int) $p['warehouse_area_id'] !== $area) continue;
            if ($moved && (!$mov || substr($mov['occurred_at'], 0, 10) < $since)) continue;
            if ($level !== '' && $lvl !== $level) continue;

            $list[] = ['p' => $p, 'qty' => $qty, 'level' => $lvl, 'last' => $mov];
        }

        return $list;
    }

    // Columnas: Producto, Stock, Mín, Máx, Unidad, Estado, Últ. Mov
    public function lsStock() {
        $fail = $this->needBranch() ?: $this->need('show', 'ver el stock');
        if ($fail) return $fail;

        $level = in_array($this->post('nivel'), ['ok', 'bajo', 'agotado'], true) ? $this->post('nivel') : '';
        $rows  = [];

        foreach ($this->rows($level) as $r) {
            $p   = $r['p'];
            $id  = (int) $p['id'];
            $min = (float) $p['stock_min'];
            $max = (float) $p['stock_max'];

            $rows[] = [
                'id'       => $id,
                'Producto' => ['class' => 'justify-start px-2 py-2', 'html' => $this->productHtml($p)],
                'Stock'    => abs($r['qty']) < 0.00001 ? '-' : h($this->num($r['qty'])),
                'Mín'      => $min > 0 ? h($this->num($min)) : '-',
                'Máx'      => $max > 0 ? h($this->num($max)) : '-',
                'Unidad'   => h($p['unit'] ?: '-'),
                'Estado'   => $this->levelBadge($r['qty'], $min, $max),
                'Últ. Mov' => $this->lastMoveBadge($r['last']),
                'a'        => [$this->rowIcon('eye', "app.selectProduct({$id})", 'Ver producto')]
            ];
        }

        return ['status' => 200, 'row' => $rows];
    }

    // Foto (o el cubo), nombre y «SKU - Categoría» debajo; clic = la vista del producto.
    private function productHtml($p) {
        $id  = (int) $p['id'];
        $src = $this->photoUrl($p['image']);
        $img = $src !== '' ? '<img src="' . h($src) . '" onerror="this.remove();" alt="" class="absolute inset-0 w-full h-full object-cover">' : '';

        $meta = [];
        if ($p['sku'])      $meta[] = '<span class="font-mono">' . h($p['sku']) . '</span>';
        if ($p['category']) $meta[] = h(trim($p['category']));
        if ($p['kind'] === 'supply') $meta[] = 'Insumo';

        return '<div class="flex items-center gap-3">'
             . '<div class="relative flex-shrink-0 w-10 h-10 rounded-md bg-gray-100 flex items-center justify-center overflow-hidden cursor-pointer transition duration-150 hover:ring-2 hover:ring-blue-400/60" onclick="app.selectProduct(' . $id . ')">'
             . '<i data-lucide="package" class="w-4 h-4 text-gray-400"></i>' . $img . '</div>'
             . '<div class="flex flex-col leading-tight"><span class="font-medium text-gray-800">' . h($p['name']) . '</span>'
             . ($meta ? '<span class="text-[10px] text-gray-400">' . implode(' - ', $meta) . '</span>' : '') . '</div></div>';
    }

    private function levelBadge($qty, $min, $max) {
        if ($qty <= 0)                   $c = ['rgba(224,36,36,0.18)', '#E02424', 'AGOTADO'];
        elseif ($min > 0 && $qty <= $min) $c = ['rgba(251,191,36,0.18)', '#B45309', 'BAJO'];
        elseif ($max > 0 && $qty > $max)  $c = ['rgba(2,132,199,0.18)', '#0284C7', 'ALTO'];
        else                              $c = ['rgba(63,193,137,0.18)', '#15803D', 'OK'];

        return "<span class='px-2 py-0.5 rounded text-[10px] font-bold' style='background:{$c[0]};color:{$c[1]};'>{$c[2]}</span>";
    }

    private function lastMoveBadge($move) {
        if (!$move) return "<span class='text-[10px] text-gray-300'>Sin movimiento</span>";

        $map = [
            'ENTRADA'       => ['rgba(63,193,137,0.15)', '#15803D', 'Entrada'],
            'SALIDA'        => ['rgba(224,36,36,0.15)', '#B91C1C', 'Salida'],
            'TRANSFERENCIA' => ['rgb(var(--brand-600, 192 90 64) / 0.15)', 'rgb(var(--brand-600, 192 90 64))', 'Traspaso'],
            'AJUSTE'        => ['rgba(167,139,250,0.15)', '#7C3AED', 'Ajuste'],
            'CANCELACION'   => ['rgba(156,163,175,0.18)', '#4B5563', 'Cancelación']
        ];
        $c = $map[$move['movement_type']] ?? ['rgba(156,163,175,0.18)', '#6B7280', $move['movement_type']];

        return "<span class='px-2 py-0.5 rounded text-[10px] font-bold' style='background:{$c[0]};color:{$c[1]};'>{$c[2]}</span>"
             . "<span class='block mt-0.5 text-[10px] text-gray-400 whitespace-nowrap'>" . h($this->longDate($move['occurred_at'])) . '</span>';
    }

    // jueves 26 de nov 2026 11:38 pm
    private function longDate($stamp) {
        $ts = strtotime((string) $stamp);
        if (!$ts) return (string) $stamp;

        $days   = ['', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
        $months = ['', 'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

        return $days[(int) date('N', $ts)] . ' ' . date('j', $ts) . ' de ' . $months[(int) date('n', $ts)] . ' ' . date('Y g:i a', $ts);
    }

    // Las tarjetas cuentan con los filtros pero sin el nivel (si no, las otras salen en cero).
    public function showStock() {
        $fail = $this->needBranch() ?: $this->need('show', 'ver el stock');
        if ($fail) return $fail;

        $levels = array_count_values(array_column($this->rows(), 'level'));

        return [
            'status' => 200,
            'counts' => [
                'total_productos' => array_sum($levels),
                'total_ok'        => $levels['ok'] ?? 0,
                'total_bajo'      => $levels['bajo'] ?? 0,
                'total_agotado'   => $levels['agotado'] ?? 0
            ]
        ];
    }

    // -- Vista del producto --

    public function getProducto() {
        $fail = $this->needBranch() ?: $this->need('show', 'ver el stock');
        if ($fail) return $fail;

        $p = $this->product($this->postId());
        if (!$p) return $this->fail(404, 'Ese producto no está en el inventario de la sucursal.');

        $id       = (int) $p['id'];
        $stockSuc = ['' => 0.0];
        $almacen  = [];
        $mine     = 0.0;

        foreach ($this->qProductStock($id, $this->companyId()) as $s) {
            $branch = (string) $s['branch_id'];
            $qty    = (float) $s['quantity'];

            $stockSuc['']      += $qty;
            $stockSuc[$branch]  = round(($stockSuc[$branch] ?? 0) + $qty, 4);

            if ((int) $s['branch_id'] === $this->branchId()) {
                $mine     += $qty;
                $almacen[] = ['name' => $s['warehouse'], 'qty' => round($qty, 4)];
            }
        }

        $stockSuc[''] = round($stockSuc[''], 4);

        $types = [
            'ENTRADA'       => ['in', 'Entrada'],
            'SALIDA'        => ['out', 'Salida'],
            'TRANSFERENCIA' => ['tr', 'Traspaso'],
            'AJUSTE'        => ['adjust', 'Ajuste'],
            'CANCELACION'   => ['adjust', 'Cancelación']
        ];

        $movs = array_map(function ($m) use ($types) {
            $t   = $types[$m['movement_type']] ?? ['adjust', $m['movement_type']];
            $qty = (float) $m['quantity'];

            return [
                'type'   => $t[0],
                'dir'    => $qty < 0 ? 'out' : 'in',
                'label'  => $t[1] . ' · ' . $m['folio'],
                'qty'    => ($qty > 0 ? '+' : '') . $this->num($qty),
                'prev'   => $this->num($m['stock_prev']),
                'post'   => $this->num($m['stock_post']),
                'when'   => $this->longDate($m['occurred_at']) . ' · ' . ($m['warehouse'] ?: '-'),
                'branch' => $this->shortBranch($m['branch'])
            ];
        }, $this->qProductMoves($id, $this->companyId(), 40));

        $expiry = $this->qNextExpiry(array_map('intval', array_column($this->warehouses(), 'id')));
        $next   = $expiry[$id] ?? null;
        $days   = $next ? (int) floor((strtotime($next) - strtotime($this->qNow()['today'])) / 86400) : null;

        return [
            'status'   => 200,
            'producto' => [
                'id'         => $id,
                'name'       => $p['name'],
                'image'      => $this->photoUrl($p['image']),
                'sku'        => $p['sku'] ?: '-',
                'categoria'  => trim((string) $p['category']) ?: 'Sin categoría',
                'unidad'     => $p['unit'] ?: 'PZA',
                'estado'     => $this->level($mine, (float) $p['stock_min']),
                'min'        => (float) $p['stock_min'],
                'max'        => (float) $p['stock_max'],
                'stockSuc'   => (object) $stockSuc,
                'almacenes'  => $almacen,
                'movs'       => $movs,
                'vida'       => [
                    'dias'  => $days,
                    'fecha' => $next,
                    'shelf' => $p['shelf_life_days'] === null ? null : (int) $p['shelf_life_days'],
                    'label' => $days === null ? 'na' : ($days <= 2 ? 'critico' : ($days <= 5 ? 'proximo' : 'ok'))
                ],
                'can_ficha' => $this->canFicha()
            ],
            'sucursales' => array_map(function ($b) {
                return ['id' => (string) $b['id'], 'name' => $this->shortBranch($b['name'])];
            }, $this->qBranches($this->companyId()))
        ];
    }

    // -- Por caducar --

    // days: '7', '15', '30' o '' (todos los lotes con caducidad, también los vencidos).
    public function lsLots() {
        $fail = $this->needBranch() ?: $this->need('show', 'ver el stock');
        if ($fail) return $fail;

        $days  = in_array($this->post('days'), ['7', '15', '30'], true) ? (int) $this->post('days') : null;
        $costs = $this->costs();
        $names = array_column($this->products(), null, 'id');
        $rows  = [];

        foreach ($this->qExpiringLots(array_map('intval', array_column($this->warehouses(), 'id')), $days) as $lot) {
            $p = $names[(int) $lot['product_id']] ?? null;
            if (!$p) continue;

            $left = (int) $lot['days_left'];
            $tone = $left <= 0 ? ['#E02424', 'rgba(224,36,36,0.18)'] : ($left <= 3 ? ['#B45309', 'rgba(251,191,36,0.18)'] : ['#475569', '#F1F5F9']);
            $text = $left < 0 ? ($left === -1 ? 'Venció ayer' : 'Venció hace ' . abs($left) . ' días') : ($left === 0 ? 'Vence hoy' : ($left === 1 ? 'Mañana' : "En {$left} días"));

            $row = [
                'id'        => (int) $lot['id'],
                'Producto'  => ['class' => 'justify-start px-2 py-2', 'html' => $this->productHtml($p)],
                'Lote'      => $lot['batch_code'] ? h($lot['batch_code']) : '-',
                'Almacén'   => h($lot['warehouse']),
                'Quedan'    => h($this->num($lot['quantity'])) . ' <span class="text-[10px] text-gray-400">' . h($p['unit'] ?: 'PZA') . '</span>',
                'Caduca'    => h(date('d/m/Y', strtotime($lot['expires_at']))),
                'Faltan'    => $this->badge($text, $tone[0], $tone[1])
            ];

            if ($costs) $row['Valor'] = $this->money((float) $lot['quantity'] * (float) $lot['cost']);

            $rows[] = $row;
        }

        return ['status' => 200, 'row' => $rows];
    }

    // -- Pronóstico (R3): la tarjeta de la vista del producto --
    /*  Entradas y salidas de los últimos 7 días, contra la semana anterior, y la
        proyección a 7 días con el promedio diario de salidas. Es dato real: sin
        CoffeeIA igual se dibuja. Con CoffeeIA (pro/core/config/.env), además
        para cuántos días alcanza y cuánto pedir, en una o dos oraciones. */
    public function predict() {
        $fail = $this->needBranch() ?: $this->need('show', 'ver el stock');
        if ($fail) return $fail;

        $p = $this->product($this->postId());
        if (!$p) return $this->fail(404, 'Ese producto no está en el inventario de la sucursal.');

        $id    = (int) $p['id'];
        $stock = 0.0;

        foreach ($this->qProductStock($id, $this->companyId()) as $s) {
            if ((int) $s['branch_id'] === $this->branchId()) $stock += (float) $s['quantity'];
        }

        $trend  = $this->trend($id);
        $min    = (float) $p['stock_min'];
        $daily  = $trend['salidas'] / 7;
        $days   = $daily > 0 ? (int) floor(max(0, $stock) / $daily) : null;
        $future = [];
        $letter = [1 => 'L', 2 => 'M', 3 => 'M', 4 => 'J', 5 => 'V', 6 => 'S', 7 => 'D'];

        if ($daily > 0) {
            for ($offset = 1; $offset <= 7; $offset++) {
                $ts       = strtotime("+{$offset} days");
                $future[] = ['dia' => $letter[(int) date('N', $ts)], 'offset' => $offset, 'fecha' => date('Y-m-d', $ts), 'stock' => max(0.0, $stock - $daily * $offset)];
            }
        }

        $ia = $this->predictText($p, $stock, $min, $trend);

        return [
            'status'           => 200,
            'ia_ok'            => $ia['ok'],
            'mensaje_ia'       => $ia['error'],
            'dias_agotamiento' => $ia['ok'] ? $ia['dias'] : $days,
            'reorden_sugerido' => $ia['ok'] ? $ia['reorden'] : 0,
            'resumen'          => $ia['resumen'],
            'tendencia'        => $trend['tendencia'],
            'tendencia_delta'  => $trend['delta'],
            'stock_actual'     => round($stock, 4),
            'stock_min'        => $min,
            'proyeccion_stock' => $future
        ];
    }

    // Los 7 días de entradas y salidas, y cuánto cambió la actividad contra la semana anterior.
    private function trend($productId) {
        $map = [];

        foreach ($this->qDailyActivity($productId, $this->companyId()) as $r) {
            $map[date('Y-m-d', strtotime((string) $r['dia']))] = ['entrada' => (float) $r['entrada'], 'salida' => (float) $r['salida']];
        }

        $letter = [1 => 'L', 2 => 'M', 3 => 'M', 4 => 'J', 5 => 'V', 6 => 'S', 7 => 'D'];
        $days   = [];
        $in     = 0;
        $out    = 0;
        $prev   = 0;

        for ($i = 6; $i >= 0; $i--) {
            $ts   = strtotime("-{$i} days");
            $date = date('Y-m-d', $ts);
            $ent  = $map[$date]['entrada'] ?? 0;
            $sal  = $map[$date]['salida'] ?? 0;
            $in  += $ent;
            $out += $sal;

            $days[] = ['dia' => $letter[(int) date('N', $ts)], 'entrada' => $ent, 'salida' => $sal, 'fecha' => $date];
        }

        for ($i = 13; $i >= 7; $i--) {
            $date  = date('Y-m-d', strtotime("-{$i} days"));
            $prev += ($map[$date]['entrada'] ?? 0) + ($map[$date]['salida'] ?? 0);
        }

        return [
            'tendencia' => $days,
            'entradas'  => $in,
            'salidas'   => $out,
            'delta'     => $prev > 0 ? (int) round((($in + $out - $prev) / $prev) * 100) : null
        ];
    }

    // El texto de CoffeeIA. Sin llave o si no contesta: ok = false y la razón.
    private function predictText($p, $stock, $min, $trend) {
        $none = ['ok' => false, 'error' => '', 'dias' => 0, 'reorden' => 0, 'resumen' => ''];

        require_once __DIR__ . '/../../../core/helpers/_IaOllama.php';

        $ia = IaOllama::desdeEnv(null, 40);
        if (!$ia) return ['error' => 'CoffeeIA no está configurada: solo se ve el comportamiento real.'] + $none;

        $datos = json_encode([
            'producto'            => $p['name'],
            'unidad'              => $p['unit'] ?: 'PZA',
            'stock'               => round($stock, 3),
            'stock_min'           => $min,
            'stock_max'           => (float) $p['stock_max'],
            'actividad_diaria_7d' => $trend['tendencia'],
            'entradas_7d'         => $trend['entradas'],
            'salidas_7d'          => $trend['salidas'],
            'variacion_pct_semana' => $trend['delta']
        ], JSON_UNESCAPED_UNICODE);

        session_write_close();
        set_time_limit(90);

        $r = $ia->chatRonda([
            ['role' => 'system', 'content' => 'Eres un asistente de inventario de una pastelería. Responde SOLO un objeto JSON, sin texto ni markdown, con estas claves: dias_agotamiento (entero: días hasta agotarse al ritmo de salidas), reorden_sugerido (entero: unidades a pedir), resumen (string en español, máximo 2 oraciones).'],
            ['role' => 'user', 'content' => "Analiza este producto:\n" . $datos]
        ]);

        if (!$r['ok']) return ['error' => 'CoffeeIA no contestó: ' . $r['error']] + $none;

        $json = json_decode(trim(preg_replace('/^```(?:json)?|```$/m', '', $r['content'])), true);
        if (!is_array($json)) return ['error' => 'CoffeeIA no contestó con el formato esperado.'] + $none;

        return [
            'ok'      => true,
            'error'   => '',
            'dias'    => (int) ($json['dias_agotamiento'] ?? 0),
            'reorden' => (int) ($json['reorden_sugerido'] ?? 0),
            'resumen' => mb_substr((string) ($json['resumen'] ?? ''), 0, 400, 'UTF-8')
        ];
    }

    // -- Conteos físicos (R1) --

    // La lista de la pestaña. status: '' todos, draft, applied o cancelled.
    public function lsAjustes() {
        $fail = $this->needBranch() ?: $this->need('show', 'ver el stock');
        if ($fail) return $fail;

        $status = array_key_exists($this->post('status'), self::ADJUST_STATUS) ? $this->post('status') : '';
        $rows   = $this->qListAdjustments($this->companyId(), $this->branchId(), $status);
        $names  = $this->names($rows, ['user_id', 'applied_user_id']);
        $newId  = $this->postId('new_id');
        $costs  = $this->costs();
        $row    = [];

        foreach ($rows as $r) {
            $id  = (int) $r['id'];
            $dot = $newId === $id ? "<span class='inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1.5 align-middle'></span>" : '';

            $item = [
                'id'          => $id,
                'Folio'       => ['html' => $dot . "<span class='font-mono font-semibold text-gray-800'>" . h($r['folio']) . '</span>'],
                'Fecha'       => h($this->longDate($r['created_at'])),
                'Almacén'     => h($r['warehouse'] ?: '-'),
                'Estado'      => $this->adjustBadge($r['status']),
                'Contados'    => (int) $r['total_counted'] . ' / ' . (int) $r['total_products'],
                'Diferencias' => (int) $r['total_differences']
            ];

            if ($costs) $item['Ajuste'] = $this->signedMoney((float) $r['total_diff_cost']);

            $item['Registró'] = h($names[(int) $r['user_id']] ?? '-');
            $item['Aplicó']   = h($r['applied_user_id'] ? ($names[(int) $r['applied_user_id']] ?? '-') : '-');
            $item['a']        = [
                $this->rowIcon('eye', "stockCount.render({$id})", 'Abrir el conteo'),
                $this->rowIcon('printer', "ajustes.printAjuste({$id})", 'Comprobante')
            ];

            $row[] = $item;
        }

        return ['status' => 200, 'row' => $row];
    }

    // Abre el conteo de un almacén de la sucursal; si ya tiene uno en borrador, lo retoma.
    public function addConteo() {
        $fail = $this->needBranch() ?: $this->need('update', 'abrir un conteo físico');
        if ($fail) return $fail;

        $warehouse = $this->ownWarehouse($this->postId('warehouse_id'));
        if (!$warehouse) return $this->fail(400, 'Elige uno de los almacenes de la sucursal.');

        $open = $this->qOpenCount((int) $warehouse['id'], $this->companyId());
        if ($open) return ['status' => 200, 'id' => (int) $open['id'], 'resumed' => true];

        $reason = $this->qAdjustmentReason($this->companyId(), 'CONTEO_FISICO');
        if (!$reason) return $this->fail(409, 'Falta el motivo «Conteo físico» en el catálogo de ajustes.');

        return $this->attempt(function () use ($warehouse, $reason) {
            $id = $this->transaction(function () use ($warehouse, $reason) {
                $this->must($this->qCreateAdjustment(
                    ['folio', 'adjustment_type', 'is_blind', 'operation_date', 'status', 'user_id', 'company_id', 'branch_id', 'warehouse_id', 'adjustment_reason_id', 'active'],
                    [$this->nextFolio('AJU'), 'fisico', $this->can('aplicar-ajuste') ? 0 : 1, $this->qNow()['today'], 'draft', $this->userId() ?: null,
                     $this->companyId(), $this->branchId(), (int) $warehouse['id'], (int) $reason['id'], 1]
                ), 'addConteo');

                $id = $this->newId('addConteo');

                $this->must($this->qCreateAdjustmentLines($id, $this->companyId(), $this->branchId(), $this->mainBranchId()), 'addConteo/lines');
                $this->must($this->qAdjustmentTotals($id), 'addConteo/totals');

                return $id;
            });

            return ['status' => 200, 'id' => $id];
        }, 'No se pudo abrir el conteo.');
    }

    // La hoja: pestañas por área, un renglón por producto y lo que ya se contó.
    public function getConteo() {
        $fail = $this->needBranch() ?: $this->need('show', 'ver el stock');
        if ($fail) return $fail;

        $h = $this->countHeader($this->postId());
        if (!$h) return $this->fail(404, 'Ese conteo no es de la sucursal.');

        $perms  = $this->countPerms($h);
        $blind  = $this->countBlind($h, $perms);
        $costs  = $this->costs() && !$blind['locked'];
        $areaId = $this->post('area_id');
        $lines  = $this->qAdjustmentLines((int) $h['warehouse_id'], (int) $h['id']);
        $byArea = [];
        $sheet  = [];

        foreach ($lines as $l) {
            $k          = (string) $l['area_id'];
            $byArea[$k] = ($byArea[$k] ?? 0) + 1;
            $sheet[]    = [
                'id'     => (int) $l['product_id'],
                'area'   => $k,
                'system' => $blind['locked'] ? 0 : $this->countSystem($l),
                'cost'   => $costs ? (float) $l['cost'] : 0,
                'qty'    => $l['physical_quantity'] === null ? null : (float) $l['physical_quantity']
            ];
        }

        // Pestañas: «Todas» y cada área del almacén con cuántos productos tiene.
        $areas = [['id' => '', 'valor' => 'Todas', 'total' => count($lines)]];

        foreach ($this->qAreaOptions([(int) $h['warehouse_id']]) as $a) {
            $areas[] = ['id' => (string) $a['id'], 'valor' => $a['valor'], 'total' => $byArea[(string) $a['id']] ?? 0];
        }

        if (!empty($byArea[''])) $areas[] = ['id' => 'sin', 'valor' => 'Sin área', 'total' => $byArea['']];

        $row   = [];
        $group = null;

        foreach ($lines as $l) {
            $k = (string) $l['area_id'];

            if ($areaId === 'sin' && $k !== '') continue;
            if ($areaId !== '' && $areaId !== 'sin' && $k !== $areaId) continue;

            if ($areaId === '' && $k !== $group) {
                $row[] = ['colgroup' => true, 'Area' => ($l['area'] ?: 'Sin área') . ' · ' . $byArea[$k] . ' productos'];
                $group = $k;
            }

            $row[] = [
                'id'         => $l['product_id'],
                'Producto'   => ['html' => $this->countProduct($l['name'], $l['sku'])],
                'Área'       => ['html' => $this->areaChip($l['area'], $l['area_color'])],
                'Unidad'     => ['html' => "<span class='text-gray-500'>" . h($l['unit'] ?: '-') . '</span>'],
                'Sistema'    => ['html' => "<span class='text-gray-600'>" . ($blind['locked'] ? '—' : h($this->num($this->countSystem($l)))) . '</span>'],
                'Contado'    => ['html' => $this->countInput($l, $perms['edit'], $blind['locked'] ? null : $this->countSystem($l), $costs ? (float) $l['cost'] : 0)],
                'Diferencia' => ['html' => "<span class='text-gray-300'>—</span>"],
                'Valor'      => ['html' => "<span class='text-gray-300'>—</span>"]
            ];
        }

        return [
            'status' => 200,
            'header' => [
                'id'          => (int) $h['id'],
                'folio'       => $h['folio'],
                'status'      => self::ADJUST_STATUS[$h['status']] ?? $h['status'],
                'badge'       => $this->adjustBadge($h['status']),
                'subtitle'    => ($h['warehouse'] ?: 'Almacén') . ' · ' . $this->longDate($h['created_at']) . ' · Folio ' . $h['folio'],
                'is_blind'    => $blind['on'] ? 1 : 0,
                'blind_locked' => $blind['locked'],
                'info'        => $this->countInfo($h, $perms)
            ],
            'perms'  => $perms,
            'thead'  => $this->countThead(),
            'row'    => $row,
            'areas'  => $areas,
            'sheet'  => $sheet
        ];
    }

    // La hoja para imprimir: lo contado y, lo que falta, con la casilla en blanco.
    public function printConteo() {
        $fail = $this->needBranch() ?: $this->need('show', 'ver el stock');
        if ($fail) return $fail;

        $h = $this->countHeader($this->postId());
        if (!$h) return $this->fail(404, 'Ese conteo no es de la sucursal.');

        $blind  = $this->countBlind($h, $this->countPerms($h));
        $areaId = $this->post('area_id');
        $items  = [];

        foreach ($this->qAdjustmentLines((int) $h['warehouse_id'], (int) $h['id']) as $l) {
            $k = (string) $l['area_id'];

            if ($areaId === 'sin' && $k !== '') continue;
            if ($areaId !== '' && $areaId !== 'sin' && $k !== $areaId) continue;

            $items[] = [
                'id'      => (int) $l['product_id'],
                'area'    => $l['area'] ?: 'Sin área',
                'name'    => $l['name'],
                'sku'     => $l['sku'] ?: '',
                'unit'    => $l['unit'] ?: '',
                'system'  => $blind['on'] ? null : $this->num($this->countSystem($l)),
                'counted' => $l['physical_quantity'] === null ? null : $this->num($l['physical_quantity'])
            ];
        }

        return [
            'status' => 200,
            'header' => [
                'folio'     => $h['folio'],
                'status'    => self::ADJUST_STATUS[$h['status']] ?? $h['status'],
                'warehouse' => $h['warehouse'] ?: 'Almacén',
                'date'      => $this->longDate($h['created_at']),
                'blind'     => $blind['on']
            ],
            'items'  => $items
        ];
    }

    // El comprobante: solo los productos que se ajustaron (contados y con diferencia).
    public function getAjuste() {
        $fail = $this->needBranch() ?: $this->need('show', 'ver el stock');
        if ($fail) return $fail;

        $h = $this->countHeader($this->postId());
        if (!$h) return $this->fail(404, 'Ese ajuste no es de la sucursal.');

        $costs = $this->costs();
        $names = $this->qUserNames(array_filter([(int) $h['user_id'], (int) $h['applied_user_id']]));
        $items = [];

        foreach ($this->qAdjustmentLines((int) $h['warehouse_id'], (int) $h['id']) as $l) {
            if ($l['physical_quantity'] === null || abs((float) $l['difference']) < 0.00001) continue;

            $items[] = [
                'name'       => $l['name'],
                'sku'        => $l['sku'] ?: '',
                'unit'       => $l['unit'] ?: '',
                'system'     => (float) $l['system_quantity'],
                'counted'    => (float) $l['physical_quantity'],
                'difference' => (float) $l['difference'],
                'cost'       => $costs ? (float) $l['cost'] : 0,
                'cost_diff'  => $costs ? (float) $l['cost_difference'] : 0
            ];
        }

        return [
            'status' => 200,
            'header' => [
                'folio'      => $h['folio'],
                'status'     => self::ADJUST_STATUS[$h['status']] ?? $h['status'],
                'reason'     => $h['reason'] ?: 'Conteo físico',
                'branch'     => $this->shortBranch($h['branch']),
                'warehouse'  => $h['warehouse'] ?: 'Almacén',
                'date'       => $this->longDate($h['created_at']),
                'registered' => $names[(int) $h['user_id']] ?? '',
                'authorized' => $h['applied_user_id'] ? ($names[(int) $h['applied_user_id']] ?? '') : '',
                'applied_at' => $h['applied_at'] ? $this->longDate($h['applied_at']) : '',
                'note'       => $h['note'] ?: '',
                'costs'      => $costs
            ],
            'items'  => $items
        ];
    }

    /*  Guarda lo capturado. Solo cambian los renglones cuyo conteo cambió: al
        capturar se toma la foto del stock (system_quantity) y la hora. */
    public function editConteo() {
        $fail = $this->needBranch() ?: $this->need('update', 'capturar el conteo');
        if ($fail) return $fail;

        $h = $this->countHeader($this->postId());
        if (!$h) return $this->fail(404, 'Ese conteo no es de la sucursal.');

        $perms = $this->countPerms($h);
        if (!$perms['edit']) return $this->fail(409, 'El conteo ya no está en borrador: no se captura.');

        $counts = $this->postedJson('counts') ?: [];
        $blind  = $this->countBlind($h, $perms)['locked'] ? 1 : $this->flag('is_blind');
        $byId   = [];

        foreach ($this->qAdjustmentLines((int) $h['warehouse_id'], (int) $h['id']) as $l) $byId[(int) $l['product_id']] = $l;

        return $this->attempt(function () use ($h, $counts, $blind, $byId) {
            $this->transaction(function () use ($h, $counts, $blind, $byId) {
                foreach ($counts as $productId => $value) {
                    $l = $byId[(int) $productId] ?? null;
                    if (!$l) continue;

                    if ($value === '' || $value === null) {
                        if ($l['physical_quantity'] !== null) $this->must($this->qClearAdjustmentLine((int) $l['detail_id']), 'editConteo/clear');
                        continue;
                    }

                    if (!is_numeric($value)) continue;

                    $physical = max(0, round((float) $value, 4));
                    if ($l['physical_quantity'] !== null && abs((float) $l['physical_quantity'] - $physical) < 0.00001) continue;

                    $system = round((float) $l['stock_live'], 4);
                    $diff   = round($physical - $system, 4);

                    $this->must($this->qSetAdjustmentLine((int) $l['detail_id'], $system, $physical, $diff, (float) $l['cost'], round($diff * (float) $l['cost'], 4)), 'editConteo/line');
                }

                $this->must($this->qUpdateAdjustment(['is_blind', 'updated_at = NOW()'], [$blind, (int) $h['id']]), 'editConteo/header');
                $this->must($this->qAdjustmentTotals((int) $h['id']), 'editConteo/totals');
            });

            return $this->ok('Borrador guardado.');
        }, 'No se pudo guardar el conteo.');
    }

    /*  Aplica: cada diferencia se suma al stock de ESE momento (stockMove) y,
        si es faltante y el producto lleva lotes, sale del que vence primero. */
    public function statusConteo() {
        $fail = $this->needBranch() ?: $this->need('aplicar-ajuste', 'aplicar el ajuste');
        if ($fail) return $fail;

        $h = $this->countHeader($this->postId());
        if (!$h) return $this->fail(404, 'Ese conteo no es de la sucursal.');

        if ($this->post('action') !== 'aplicar')   return $this->fail(400, 'Acción no válida.');
        if (!$this->countPerms($h)['apply'])       return $this->fail(409, 'El conteo ya no está en borrador.');
        if ((int) $h['total_counted'] === 0)       return $this->fail(400, 'Captura al menos un producto antes de aplicar.');

        $note      = mb_substr($this->post('note'), 0, 255, 'UTF-8');
        $warehouse = (int) $h['warehouse_id'];
        $lines     = $this->qAdjustmentLines($warehouse, (int) $h['id']);

        return $this->attempt(function () use ($h, $note, $warehouse, $lines) {
            $this->transaction(function () use ($h, $note, $warehouse, $lines) {
                foreach ($lines as $l) {
                    if ($l['physical_quantity'] === null) continue;

                    $diff = (float) $l['difference'];
                    if (abs($diff) < 0.00001) continue;

                    [$prev, $post] = $this->stockMove($warehouse, (int) $l['product_id'], $diff);

                    if ($diff < 0) $this->takeLots($warehouse, (int) $l['product_id'], abs($diff));

                    $this->must($this->qSetAdjustmentLineStock((int) $l['detail_id'], $prev, $post), 'statusConteo/line');
                }

                $this->must($this->qUpdateAdjustment(
                    ['status', 'note', 'applied_user_id', 'applied_at = NOW()', 'updated_at = NOW()'],
                    ['applied', $note !== '' ? $note : null, $this->userId() ?: null, (int) $h['id']]
                ), 'statusConteo/header');
            });

            return $this->ok("Ajuste {$h['folio']} aplicado: las diferencias ya están en el stock.");
        }, 'No se pudo aplicar el ajuste; el stock no cambió.');
    }

    // Contraseña antes de cancelar (la regla de Entradas y Salidas: invAskPassword).
    public function verifyKey() {
        $fail = $this->needBranch();
        if ($fail) return $fail;

        $h = $this->countHeader($this->postId());
        if (!$h) return $this->fail(404, 'Ese conteo no es de la sucursal.');

        return $this->keyCheck('adjustment', (int) $h['id']);
    }

    /*  Borrador: se descarta (el stock no cambió). Aplicado (hasta 48 h): resta
        del stock de ESE momento lo que el ajuste movió, sin pisar lo de después. */
    public function cancelConteo() {
        $fail = $this->needBranch();
        if ($fail) return $fail;

        $h = $this->countHeader($this->postId());
        if (!$h) return $this->fail(404, 'Ese conteo no es de la sucursal.');

        $perms = $this->countPerms($h);
        $id    = (int) $h['id'];

        if (!$perms['cancel']) {
            return $this->fail(403, $h['status'] === 'applied' && $this->can('cancel')
                ? 'Pasaron más de ' . self::CANCEL_HOURS . ' horas desde que se aplicó: ya no se cancela.'
                : 'Tu rol no puede cancelar este conteo.');
        }

        if (!$this->keyAuthorized('adjustment', $id)) return $this->fail(403, 'Confirma tu contraseña para cancelar.');

        $reason    = mb_substr($this->post('reason'), 0, 255, 'UTF-8') ?: null;
        $warehouse = (int) $h['warehouse_id'];
        $applied   = $h['status'] === 'applied';
        $lines     = $applied ? $this->qAdjustmentLines($warehouse, $id) : [];

        return $this->attempt(function () use ($h, $id, $reason, $warehouse, $applied, $lines) {
            $this->transaction(function () use ($id, $reason, $warehouse, $lines) {
                $pairs = [];

                foreach ($lines as $l) {
                    if ($l['previous_stock'] === null || $l['resulting_stock'] === null) continue;

                    $moved = round((float) $l['resulting_stock'] - (float) $l['previous_stock'], 4);
                    if (abs($moved) < 0.00001) continue;

                    $this->stockMove($warehouse, (int) $l['product_id'], -$moved);
                    if ($moved > 0) $this->takeLots($warehouse, (int) $l['product_id'], $moved);

                    $pairs[] = [(int) $l['product_id'], $warehouse];
                }

                $this->must($this->qUpdateAdjustment(
                    ['status', 'cancel_reason', 'cancelled_user_id', 'cancelled_at = NOW()', 'updated_at = NOW()'],
                    ['cancelled', $reason, $this->userId() ?: null, $id]
                ), 'cancelConteo');

                // Ya cancelado sale del kárdex: lo que vino después se rehace sin él.
                $this->kardexChains($pairs, $this->companyId());
            });

            $this->keyConsume('adjustment', $id);

            return $this->ok($applied ? "Ajuste {$h['folio']} cancelado: el stock volvió a como estaba." : 'Conteo cancelado. El stock no cambió.');
        }, 'No se pudo cancelar; el stock no cambió.');
    }

    // -- Conteos: complementos --

    private function countHeader($id) {
        $h = $this->qAdjustment((int) $id, $this->companyId());

        return $h && (int) $h['branch_id'] === $this->branchId() && $h['adjustment_type'] === 'fisico' ? $h : null;
    }

    /*  edit: borrador y casilla update. apply: borrador y aplicar-ajuste.
        cancel: borrador con update (se descarta) o aplicado con cancel dentro de 48 h. */
    private function countPerms($h) {
        $draft = $h['status'] === 'draft';

        return [
            'edit'   => $draft && $this->can('update'),
            'apply'  => $draft && $this->can('aplicar-ajuste'),
            'cancel' => ($draft && $this->can('update')) || ($this->cancelOpen($h) && $this->can('cancel')),
            'print'  => true
        ];
    }

    private function cancelOpen($h) {
        return $h['status'] === 'applied' && $h['applied_at'] && time() <= strtotime($h['applied_at']) + self::CANCEL_HOURS * 3600;
    }

    // Sin aplicar-ajuste se cuenta a ciegas siempre: no ve lo que dice el sistema.
    private function countBlind($h, $perms) {
        $locked = $perms['edit'] && !$this->can('aplicar-ajuste');

        return ['locked' => $locked, 'on' => $locked || (int) $h['is_blind'] === 1];
    }

    // Contado: la foto del stock al capturar. Sin contar: lo que hay hoy.
    private function countSystem($l) {
        return $l['physical_quantity'] !== null ? (float) $l['system_quantity'] : (float) $l['stock_live'];
    }

    private function countInfo($h, $perms) {
        $names = $this->qUserNames(array_filter([(int) $h['applied_user_id']]));
        $who   = $names[(int) $h['applied_user_id']] ?? 'el usuario';
        $when  = $h['applied_at'] ? date('d/m/Y H:i', strtotime($h['applied_at'])) : '';

        if ($h['status'] === 'applied') {
            $limit = $this->cancelOpen($h) ? ' Se puede cancelar hasta el ' . date('d/m/Y H:i', strtotime($h['applied_at']) + self::CANCEL_HOURS * 3600) . '.' : '';

            return ['tone' => 'emerald', 'text' => "Aplicado por {$who} el {$when}. Las diferencias ya están en el stock y en el kárdex.{$limit}"];
        }

        if ($h['status'] === 'cancelled') {
            return ['tone' => 'gray', 'text' => $h['applied_at'] ? 'Ajuste cancelado. El stock volvió a como estaba.' : 'Conteo cancelado. No movió el stock.'];
        }

        if ($perms['edit'] && !$perms['apply']) {
            return ['tone' => 'blue', 'text' => 'Captura en «Contado» lo que hay en el anaquel. Cuentas a ciegas: quien tiene «Aplicar ajuste» revisa y aplica.'];
        }

        if ($perms['edit']) {
            return ['tone' => 'blue', 'text' => 'Captura en «Contado» lo que hay físicamente. La hoja va área por área, como está en el almacén.'];
        }

        return ['tone' => 'gray', 'text' => 'La hoja sigue el orden del almacén: área por área.'];
    }

    private function countThead() {
        $th = function ($label, $align) {
            return "<div class='text-{$align} text-[9px] uppercase tracking-wider font-semibold text-gray-500'>{$label}</div>";
        };

        return [$th('Producto', 'left'), $th('Área', 'left'), $th('Unidad', 'center'), $th('Sistema', 'right'), $th('Contado', 'center'), $th('Diferencia', 'right'), $th('Valor', 'right')];
    }

    private function countProduct($name, $sku) {
        $skuTag = $sku ? "<div class='text-[9px] text-gray-400 font-mono'>" . h($sku) . '</div>' : '';

        return "<div class='leading-tight'><div class='text-[11px] text-gray-800'>" . h($name) . "</div>{$skuTag}</div>";
    }

    private function areaChip($name, $color) {
        if (empty($name)) return "<span class='text-[9px] text-gray-400'>Sin área</span>";

        $hex = preg_match('/^#[0-9a-fA-F]{6}$/', (string) $color) ? $color : '#6B7280';

        return "<span class='inline-flex items-center gap-1 px-2 py-0.5 rounded text-[9px] font-semibold whitespace-nowrap' style='background:{$hex}14;color:{$hex};'>"
             . "<span class='w-1.5 h-1.5 rounded-full' style='background:{$hex};'></span>" . h($name) . '</span>';
    }

    /*  El JS calcula diferencia y valor en vivo con data-system y data-cost. A
        ciegas data-system va en 0 y no se pinta. Fuera de borrador es texto.
        compact.css fuerza 1rem y height:auto en input number: tamaño en style. */
    private function countInput($l, $editable, $system, $cost) {
        $value = $l['physical_quantity'] === null ? '' : $this->num($l['physical_quantity']);
        $skin  = $editable
            ? 'rounded-lg border-[1px] border-gray-200 bg-gray-50 shadow-sm hover:border-gray-300 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-colors'
            : 'border-0 bg-transparent';

        return '<input type="number" min="0" step="any" inputmode="decimal" placeholder="' . ($editable ? '—' : 'Sin contar') . '"'
             . ' data-count="' . (int) $l['product_id'] . '" data-system="' . (float) $system . '" data-cost="' . (float) $cost . '"'
             . ' value="' . str_replace(',', '', $value) . '"' . ($editable ? '' : ' disabled')
             . ' style="font-size:11px !important;height:28px !important;"'
             . ' class="w-[84px] px-[8px] text-center font-semibold text-gray-800 placeholder:font-normal placeholder:text-gray-300 ' . $skin
             . ' [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none">';
    }

    private function adjustBadge($status) {
        $map = [
            'draft'     => ['bg-gray-100 text-gray-600', 'BORRADOR'],
            'applied'   => ['bg-emerald-100 text-emerald-700', 'APLICADO'],
            'cancelled' => ['bg-gray-100 text-gray-400', 'CANCELADO']
        ];
        $c = $map[$status] ?? ['bg-gray-100 text-gray-600', strtoupper((string) $status)];

        return "<span class='inline-block px-2 py-0.5 rounded text-[10px] font-bold whitespace-nowrap {$c[0]}'>{$c[1]}</span>";
    }

    private function signedMoney($n) {
        if (abs($n) < 0.005) return "<span class='text-gray-400'>$0.00</span>";

        return "<span class='font-semibold " . ($n < 0 ? 'text-rose-600' : 'text-sky-700') . "'>" . ($n < 0 ? '-' : '+') . '$' . number_format(abs($n), 2) . '</span>';
    }

    // -- «Abrir ficha»: la sección Inventario del producto o del insumo --

    // La casilla editar del Catálogo de insumos (la ficha es suya, no de Stock).
    private function canFicha() {
        return Permission::can('inv-catalogo', 'update');
    }

    private function needFicha() {
        $fail = $this->needBranch();
        if ($fail) return $fail;

        return $this->canFicha() ? null : $this->fail(403, 'Tu rol no puede editar el Catálogo de insumos.');
    }

    // La ficha completa (fichaResponse en core-inventarios): la misma del Catálogo de insumos.
    public function getFicha() {
        return $this->needFicha() ?: $this->fichaResponse($this->postId());
    }

    public function saveFicha() {
        return $this->needFicha() ?: $this->fichaSaveResponse($this->postId());
    }
}

Permission::dispatch(new ctrl(), 'inv-stock');
