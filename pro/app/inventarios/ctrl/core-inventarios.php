<?php
require_once __DIR__ . '/../../../core/security/_Session.php';
require_once __DIR__ . '/../../../core/security/_Permission.php';
require_once __DIR__ . '/../mdl/mdl-inventarios.php';

/*  Base de los ctrl de Inventarios: una pagina = un ctrl que extiende esta clase.

    Permission::dispatch solo ejecuta los metodos publicos declarados en el ctrl
    de cada archivo: aqui todo es protected.

    Cada ctrl declara su seccion (const SECTION) y cada operacion pide su
    casilla con need(): show, create, update, cancel, print, ver-costos y, en
    Entradas, producir. Sin «ver-costos» las respuestas salen sin importes.

    El MOTOR (stockMove, takeLots, applyInflow...) mueve la existencia SIEMPRE
    dentro de transaction(): bloquea la fila de stock (FOR UPDATE), escribe lo
    que habia y lo que quedo en el renglon y deja el kardex (vista
    inventory_movement) cuadrado. */
class core extends mdl {

    const SECTION = '';

    private $scopeCache   = null;
    private $actionsCache = null;

    // -- Empresa y sucursal (la misma regla que Catalogo) --

    protected function scope() {
        if ($this->scopeCache !== null) return $this->scopeCache;

        $sessionCompany = isset($_SESSION['company_id']) ? (int) $_SESSION['company_id'] : 0;
        $sessionBranch  = isset($_SESSION['branch_id'])  ? (int) $_SESSION['branch_id']  : 0;

        $company   = $sessionCompany > 0 ? $this->qCompany($sessionCompany) : $this->qFirstCompany();
        $companyId = $company ? (int) $company['id'] : 0;
        $branch    = null;

        if ($companyId > 0 && $sessionBranch > 0) {
            $candidate = $this->qBranch($sessionBranch);
            if ($candidate && (int) $candidate['company_id'] === $companyId) $branch = $candidate;
        }

        if ($branch === null && $companyId > 0) $branch = $this->qFirstBranch($companyId);

        $main = $companyId > 0 ? $this->qFirstBranch($companyId) : null;

        $this->scopeCache = [
            'company_id' => $companyId,
            'company'    => $company ? $company['name'] : '',
            'branch_id'  => $branch ? (int) $branch['id'] : 0,
            'branch'     => $branch ? $branch['name'] : '',
            'main_id'    => $main ? (int) $main['id'] : 0,
            'is_main'    => $branch && $main && (int) $branch['id'] === (int) $main['id']
        ];

        return $this->scopeCache;
    }

    protected function companyId()    { return $this->scope()['company_id']; }
    protected function branchId()     { return $this->scope()['branch_id']; }
    protected function mainBranchId() { return $this->scope()['main_id']; }
    protected function userId()       { return (int) Session::user(); }

    protected function needBranch() {
        if ($this->companyId() > 0 && $this->branchId() > 0) return null;

        return ['status' => 409, 'message' => 'No hay una sucursal activa para el inventario.', 'row' => []];
    }

    // -- Permisos de la seccion --

    protected function actions() {
        if ($this->actionsCache === null) $this->actionsCache = Permission::actions(static::SECTION);
        return $this->actionsCache;
    }

    protected function can($action) {
        return in_array($action, $this->actions(), true);
    }

    protected function costs() {
        return $this->can('ver-costos');
    }

    // null si puede; si no, la respuesta 403 con el motivo.
    protected function need($action, $what = 'hacer esto') {
        return $this->can($action) ? null : $this->fail(403, "Tu rol no puede {$what}.");
    }

    // -- Almacenes --
    /*  La primera vez que una sucursal entra al modulo (o le mandan un
        traspaso) se le da su almacen («Almacén Kafeto»). El de la Matriz es el
        principal de la empresa: ahi se piden las requisiciones (etapa
        siguiente). Se cambian en Catálogo. */

    protected function warehouses() {
        return $this->branchWarehouses($this->branchId(), $this->scope()['branch']);
    }

    // Los almacenes de una sucursal de la empresa; si no tiene, le crea el suyo.
    protected function branchWarehouses($branchId, $branchName) {
        $list = $this->qWarehouses($this->companyId(), $branchId);

        if ($list) return $list;

        $isMain = (int) $branchId === $this->mainBranchId() && $this->qCountMainWarehouses($this->companyId()) === 0;
        $name   = 'Almacén ' . $this->shortBranch($branchName);

        $this->qCreateWarehouse(
            ['name', 'is_main', 'is_default', 'supply_moves_stock', 'company_id', 'branch_id', 'active'],
            [$name, $isMain ? 1 : 0, 1, 1, $this->companyId(), (int) $branchId, 1]
        );

        return $this->qWarehouses($this->companyId(), $branchId);
    }

    // El que llega en el POST, si es de la sucursal; '' o 0 = todos los de la sucursal.
    protected function pickWarehouses($key = 'warehouse_id') {
        $all = $this->warehouses();
        $id  = (int) $this->post($key, '0');

        if ($id <= 0) return array_map('intval', array_column($all, 'id'));

        return in_array($id, array_map('intval', array_column($all, 'id')), true) ? [$id] : [];
    }

    protected function ownWarehouse($id) {
        foreach ($this->warehouses() as $w) {
            if ((int) $w['id'] === (int) $id) return $w;
        }

        return null;
    }

    protected function warehouseOptions() {
        return array_map(function ($w) {
            return ['id' => (int) $w['id'], 'valor' => $w['name']];
        }, $this->warehouses());
    }

    // «Reginas Guadalupe» -> «Guadalupe»: la empresa ya se lee arriba.
    protected function shortBranch($name) {
        $company = trim((string) $this->scope()['company']);
        $name    = trim((string) $name);

        if ($company !== '' && mb_stripos($name, $company . ' ', 0, 'UTF-8') === 0) {
            $name = trim(mb_substr($name, mb_strlen($company, 'UTF-8'), null, 'UTF-8'));
        }

        return $name !== '' ? $name : trim((string) $this->scope()['branch']);
    }

    // -- Productos del Catálogo con inventario --

    protected function products() {
        return $this->qProducts($this->companyId(), $this->branchId(), $this->mainBranchId());
    }

    protected function product($id) {
        return $this->qProduct((int) $id, $this->companyId(), $this->branchId(), $this->mainBranchId());
    }

    /*  Lo que la rejilla de captura necesita de cada producto. stock: lo que hay
        en cada almacén de la sucursal ({warehouse_id: cantidad}). Sin
        «ver-costos» el costo no viaja. */
    protected function captureProducts() {
        $byWarehouse = [];

        foreach ($this->qStockRows(array_map('intval', array_column($this->warehouses(), 'id'))) as $row) {
            $byWarehouse[(int) $row['product_id']][(int) $row['warehouse_id']] = round((float) $row['quantity'], 4);
        }

        $costs = $this->costs();

        return array_map(function ($p) use ($byWarehouse, $costs) {
            $id = (int) $p['id'];

            return [
                'id'        => $id,
                'sku'       => (string) $p['sku'],
                'valor'     => $p['name'],
                'kind'      => $p['kind'],
                'unit'      => $p['unit'] ?: 'PZA',
                'decimals'  => (int) $p['decimals'],
                'cost'      => $costs ? round((float) $p['cost'], 4) : null,
                'lots'      => (int) $p['track_lots'],
                'shelf'     => $p['shelf_life_days'] === null ? null : (int) $p['shelf_life_days'],
                'stock'     => isset($byWarehouse[$id]) ? (object) $byWarehouse[$id] : (object) []
            ];
        }, $this->products());
    }

    protected function kindChip($kind) {
        return $kind === 'supply' ? chip('Insumo', 'amber') : chip('Producto', 'slate');
    }

    // -- Folios por sucursal: ENT-KAF-0001 (dentro de la transaccion) --

    protected function nextFolio($docType) {
        $branchId = $this->branchId();
        $row      = $this->qFolioForUpdate($branchId, $docType);

        if (!$row) {
            $code = $this->branchCode();

            $this->must($this->qCreateFolio(
                ['doc_type', 'branch_code', 'last_number', 'company_id', 'branch_id', 'active'],
                [$docType, $code, 0, $this->companyId(), $branchId, 1]
            ), 'nextFolio/create');

            $row = $this->qFolioForUpdate($branchId, $docType);
        }

        $this->must($this->qBumpFolio((int) $row['id']), 'nextFolio');

        return $docType . '-' . $row['branch_code'] . '-' . str_pad((string) ((int) $row['last_number'] + 1), 4, '0', STR_PAD_LEFT);
    }

    // Tres letras de la sucursal (Guadalupe -> GUA), sin repetir dentro de la empresa.
    protected function branchCode() {
        $codes = $this->qBranchCodes($this->companyId());

        if (isset($codes[$this->branchId()])) return $codes[$this->branchId()];

        $words = preg_split('/\s+/', $this->shortBranch($this->scope()['branch']));
        $base  = strtoupper(preg_replace('/[^A-Za-z]/', '', strtr(end($words), ['á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ú' => 'u', 'ñ' => 'n', 'Á' => 'A', 'É' => 'E', 'Í' => 'I', 'Ó' => 'O', 'Ú' => 'U', 'Ñ' => 'N'])));
        $base  = substr(str_pad($base, 3, 'X'), 0, 3);
        $code  = $base;

        for ($n = 2; in_array($code, $codes, true); $n++) $code = substr($base, 0, 2) . $n;

        return $code;
    }

    // -- MOTOR (solo dentro de transaction) --

    // Suma o resta del saldo del almacen. Devuelve [antes, quedo]. Puede quedar negativo.
    protected function stockMove($warehouseId, $productId, $delta) {
        $row = $this->qStockRow($warehouseId, $productId, true);

        if (!$row) {
            $this->must($this->qCreateStock(
                ['quantity', 'company_id', 'warehouse_id', 'product_id', 'active'],
                [0, $this->companyId(), $warehouseId, $productId, 1]
            ), 'stockMove/create');

            $row = $this->qStockRow($warehouseId, $productId, true);
        }

        $prev = round((float) $row['quantity'], 4);
        $post = round($prev + $delta, 4);

        $this->must($this->qSetStock((int) $row['id'], $post), 'stockMove');

        return [$prev, $post];
    }

    // Saca de los lotes empezando por el que vence primero. Devuelve el id del primero que tocó.
    protected function takeLots($warehouseId, $productId, $qty) {
        $pieces = $this->takeLotPieces($warehouseId, $productId, $qty);

        return $pieces ? $pieces[0]['id'] : null;
    }

    /*  Lo mismo, pero devuelve cada pedazo que tomó (lote, cantidad, caducidad,
        costo): el traspaso los vuelve a crear en el almacén destino. Lo que no
        cubren los lotes (existencia de antes de llevar lotes) no sale aquí. */
    protected function takeLotPieces($warehouseId, $productId, $qty) {
        $pieces = [];
        $rest   = $qty;

        foreach ($this->qLotsForUpdate($warehouseId, $productId) as $lot) {
            if ($rest <= 0) break;

            $take = min((float) $lot['quantity'], $rest);
            $rest = round($rest - $take, 4);

            $this->must($this->qSetLot((int) $lot['id'], round((float) $lot['quantity'] - $take, 4)), 'takeLots');

            $pieces[] = [
                'id'          => (int) $lot['id'],
                'take'        => round($take, 4),
                'batch_code'  => $lot['batch_code'],
                'cost'        => (float) $lot['cost'],
                'produced_at' => $lot['produced_at'],
                'expires_at'  => $lot['expires_at']
            ];
        }

        return $pieces;
    }

    /*  Aplica una entrada: suma cada renglon, deja su lote (si el producto lleva
        caducidad) y, si el tipo lo pide, pone el costo como ultimo costo del
        producto y recalcula su costo promedio. */
    protected function applyInflow($inflow, array $lines) {
        foreach ($lines as $line) {
            $productId = (int) $line['product_id'];
            $qty       = (float) $line['quantity'];
            $cost      = (float) $line['cost'];

            [$prev, $post] = $this->stockMove((int) $inflow['warehouse_id'], $productId, $qty);

            $this->must($this->qSetInflowLineStock((int) $line['id'], $prev, $post), 'applyInflow/line');

            $setting = $this->qProductSetting($productId);

            if ($setting && (int) $setting['track_lots'] === 1) {
                $this->must($this->qCreateLot(
                    ['batch_code', 'initial_quantity', 'quantity', 'cost', 'produced_at', 'expires_at', 'company_id', 'warehouse_id', 'product_id', 'detail_inventory_inflow_id', 'active'],
                    [$line['batch_code'], $qty, $qty, $cost, $inflow['origin_code'] === 'PRODUCCION' ? $inflow['operation_date'] : null,
                     $line['expires_at'], $this->companyId(), (int) $inflow['warehouse_id'], $productId, (int) $line['id'], 1]
                ), 'applyInflow/lot');
            }

            if ((int) $inflow['updates_cost'] === 1 && $cost > 0) {
                $this->must($this->qUpdateProductCost($productId, $cost), 'applyInflow/cost');
                $this->averageCost($productId, $qty, $cost, $setting);
            }
        }
    }

    // Promedio ponderado con lo que hay en toda la empresa.
    protected function averageCost($productId, $qty, $cost, $setting) {
        $have    = max(0, $this->qCompanyStock($productId, $this->companyId()) - $qty);
        $before  = $setting ? (float) $setting['average_cost'] : 0;
        $average = ($have + $qty) > 0 ? round(($have * ($before > 0 ? $before : $cost) + $qty * $cost) / ($have + $qty), 4) : $cost;

        if ($setting) {
            $this->must($this->qUpdateProductSetting(['average_cost', 'updated_at = NOW()'], [$average, $productId]), 'averageCost');
            return;
        }

        $this->must($this->qCreateProductSetting(
            ['average_cost', 'company_id', 'product_id', 'active'],
            [$average, $this->companyId(), $productId, 1]
        ), 'averageCost/create');
    }

    // -- Respuestas --

    protected function ok($message, $extra = []) {
        return array_merge(['status' => 200, 'message' => $message], $extra);
    }

    protected function fail($status, $message) {
        return ['status' => $status, 'message' => $message];
    }

    /*  dispatch no atrapa excepciones: sin esto el cliente recibiria un 500 vacio.
        InvStop es un aviso para el usuario («Solo hay 3 de Harina»): la
        transaccion ya se revirtio y el texto sale tal cual, sin log. */
    protected function attempt(callable $fn, $message) {
        try {
            return $fn();
        } catch (InvStop $e) {
            return $this->fail(409, $e->getMessage());
        } catch (Throwable $e) {
            $this->writeToLog('[ INVENTARIOS ] :: ' . $e->getMessage());
            return $this->fail(500, $message);
        }
    }

    // _Insert, _Update y _CUD avisan con un string o false; aqui se vuelve excepcion.
    protected function must($result, $what) {
        if ($result !== true) {
            throw new RuntimeException($what . ': ' . (is_string($result) ? $result : 'sin respuesta de la base'));
        }

        return true;
    }

    protected function newId($what) {
        $id = $this->qLastInsertId();
        if ($id <= 0) throw new RuntimeException("{$what}: sin id");
        return $id;
    }

    // -- Lectura del POST --

    protected function post($key, $default = '') {
        return isset($_POST[$key]) ? trim((string) $_POST[$key]) : $default;
    }

    protected function postId($key = 'id') {
        return (int) $this->post($key, '0');
    }

    protected function flag($key) {
        return in_array(strtolower($this->post($key)), ['1', 'true', 'on'], true) ? 1 : 0;
    }

    protected function selectOrNull($key) {
        $value = $this->post($key);
        return ($value === '' || $value === '0') ? null : (int) $value;
    }

    protected function textOrNull($key, $max = 255) {
        $value = $this->post($key);
        if ($value === '') return null;
        return mb_substr($value, 0, $max, 'UTF-8');
    }

    protected function postedJson($key) {
        $value = json_decode($this->post($key), true);
        return is_array($value) ? $value : null;
    }

    // 'YYYY-MM-DD' valida o null.
    protected function dateOrNull($value) {
        $value = trim((string) $value);
        $d     = DateTime::createFromFormat('Y-m-d', $value);

        return ($d && $d->format('Y-m-d') === $value) ? $value : null;
    }

    // El periodo del filtro: fi/ff de getDataRangePicker (YYYY-MM-DD); sin ellos, el mes en curso.
    protected function period() {
        $today = $this->qNow()['today'];
        $from  = $this->dateOrNull($this->post('fi')) ?: substr($today, 0, 8) . '01';
        $to    = $this->dateOrNull($this->post('ff')) ?: $today;

        return $from <= $to ? [$from, $to] : [$to, $from];
    }

    // -- Lo que toda pagina recibe en su init --

    protected function baseInit($extra = []) {
        $scope = $this->scope();

        return array_merge([
            'status'     => 200,
            'scope'      => ['company' => $scope['company'], 'branch' => $scope['branch'], 'is_main' => $scope['is_main']],
            'today'      => $this->qNow()['today'],
            'actions'    => $this->actions(),
            'warehouses' => $this->warehouseOptions()
        ], $extra);
    }

    // -- Contraseña para cancelar (la regla de Pedidos: core-order :: needKey) --

    const KEY_TRIES = 5;
    const KEY_WAIT  = 300;

    // null = correcta. key = true: la pantalla deja la ventana abierta y marca el campo.
    protected function needKey($what) {
        $guard = isset($_SESSION['inv_key']) && is_array($_SESSION['inv_key']) ? $_SESSION['inv_key'] : [];
        $fails = isset($guard['fails']) ? (int) $guard['fails'] : 0;
        $until = isset($guard['until']) ? (int) $guard['until'] : 0;

        if ($until > time()) {
            $minutes = (int) ceil(($until - time()) / 60);

            return ['status' => 429, 'message' => 'Demasiados intentos. Espera ' . ($minutes === 1 ? '1 minuto' : "{$minutes} minutos") . ' y vuelve a intentar.', 'key' => true];
        }

        // Sin trim: se compara tal cual se escribió, igual que al entrar.
        $key  = isset($_POST['key']) ? (string) $_POST['key'] : '';
        $hash = $this->qUserPassword($this->userId());

        if ($hash === '') {
            return ['status' => 409, 'message' => "Tu usuario no tiene contraseña. Pide al Dueño que te asigne una para poder {$what}.", 'key' => true];
        }

        if ($key === '') return ['status' => 401, 'message' => "Escribe tu contraseña para {$what}.", 'key' => true];

        if (!password_verify($key, $hash)) {
            $fails++;

            $_SESSION['inv_key'] = $fails >= self::KEY_TRIES
                ? ['fails' => 0, 'until' => time() + self::KEY_WAIT]
                : ['fails' => $fails, 'until' => 0];

            $left = self::KEY_TRIES - $fails;

            return [
                'status'  => 401,
                'message' => $left <= 0
                    ? 'Contraseña incorrecta. Espera ' . (int) ceil(self::KEY_WAIT / 60) . ' minutos y vuelve a intentar.'
                    : 'Contraseña incorrecta. Te ' . ($left === 1 ? 'queda 1 intento' : "quedan {$left} intentos") . '.',
                'key'     => true
            ];
        }

        unset($_SESSION['inv_key']);

        return null;
    }

    // Cantidad sin decimales si la unidad no los lleva (pieza, caja).
    protected function badQuantity($qty, $product) {
        if (!($qty > 0)) return 'La cantidad de «' . $product['name'] . '» debe ser mayor a 0.';
        if ((int) $product['decimals'] !== 1 && floor($qty) != $qty) {
            return '«' . $product['name'] . '» se cuenta en ' . ($product['unit'] ?: 'piezas') . ': sin decimales.';
        }

        return null;
    }

    // -- Foto de evidencia (mermas) --

    const PHOTO_MAX = 5242880;

    protected function decodePhoto($b64) {
        if (!preg_match('#^data:image/[a-z0-9.+-]+;base64,#i', $b64)) return null;

        $data = base64_decode(substr($b64, strpos($b64, ',') + 1), true);
        if ($data === false || strlen($data) > self::PHOTO_MAX) return null;

        $info = @getimagesizefromstring($data);
        $ext  = $info ? ([IMAGETYPE_JPEG => 'jpg', IMAGETYPE_PNG => 'png', IMAGETYPE_WEBP => 'webp'][$info[2]] ?? null) : null;

        return $ext ? ['ext' => $ext, 'data' => $data] : null;
    }

    protected function writePhoto($id, $b64, $folder) {
        $image = $this->decodePhoto($b64);
        $rel   = 'pro_files/' . $this->companyId() . '/' . $this->branchId() . '/inventarios/' . $folder . '/';
        $root  = isset($_SERVER['DOCUMENT_ROOT']) ? rtrim(str_replace('\\', '/', $_SERVER['DOCUMENT_ROOT']), '/') : '';
        $disk  = $root . '/' . $rel;

        if (!$image) throw new RuntimeException('writePhoto: foto inválida');

        if (!is_dir($disk) && !@mkdir($disk, 0775, true) && !is_dir($disk)) {
            throw new RuntimeException('writePhoto: no se pudo crear ' . $disk);
        }

        $name = (int) $id . '_' . bin2hex(random_bytes(6)) . '.' . $image['ext'];

        if (@file_put_contents($disk . $name, $image['data']) === false) {
            throw new RuntimeException('writePhoto: no se pudo escribir ' . $disk . $name);
        }

        return $rel . $name;
    }

    // -- Celdas --

    // Botón cuadrado de la fila (.cp-btn-icon de catalogo.css) con su ícono ya dibujado.
    protected function rowButton($icon, $label, $onclick, $variant = '') {
        return [
            'class'      => 'cp-btn-icon' . ($variant !== '' ? ' cp-btn-icon--' . $variant : ''),
            'html'       => $this->lucideSvg($icon),
            'aria-label' => $label,
            'onclick'    => $onclick
        ];
    }

    protected function lucideSvg($name) {
        $paths = [
            'eye'     => '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>',
            'check'   => '<path d="M20 6 9 17l-5-5"/>',
            'ban'     => '<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>',
            'history' => '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/><path d="M12 7v5l4 2"/>',
            'sliders' => '<line x1="21" x2="14" y1="4" y2="4"/><line x1="10" x2="3" y1="4" y2="4"/><line x1="21" x2="12" y1="12" y2="12"/><line x1="8" x2="3" y1="12" y2="12"/><line x1="21" x2="16" y1="20" y2="20"/><line x1="12" x2="3" y1="20" y2="20"/><line x1="14" x2="14" y1="2" y2="6"/><line x1="8" x2="8" y1="10" y2="14"/><line x1="16" x2="16" y1="18" y2="22"/>',
            'trash'   => '<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
            'package-check' => '<path d="m16 16 2 2 4-4"/><path d="M21 10V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l2-1.14"/><path d="m7.5 4.27 9 5.15"/><polyline points="3.29 7 12 12 20.71 7"/><line x1="12" x2="12" y1="22" y2="12"/>'
        ];

        return '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor"'
             . ' stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' . $paths[$name] . '</svg>';
    }

    // «Hoy» / «Ayer» / 22/11/2026, y la hora debajo.
    protected function dateCell($date, $stamp = null) {
        $today = $this->qNow()['today'];
        $label = $date === $today ? 'Hoy' : ($date === date('Y-m-d', strtotime($today . ' -1 day')) ? 'Ayer' : date('d/m/Y', strtotime($date)));

        return '<div>' . h($label) . '</div>' . ($stamp ? '<div class="cp-celda-sub">' . h(substr($stamp, 11, 5)) . '</div>' : '');
    }

    protected function statusChip($status) {
        switch ($status) {
            case 'pending':   return chip('Pendiente', 'amber');
            case 'cancelled': return chip('Cancelada', 'red');
            default:          return chip('Aplicada', 'emerald');
        }
    }

    // Chip con el color guardado en el catálogo (orígenes y motivos).
    protected function colorChip($text, $hex) {
        $hex = preg_match('/^#[0-9A-Fa-f]{6}$/', (string) $hex) ? $hex : '#64748B';

        return '<span class="cp-chip" style="background:' . $hex . '1A;color:' . $hex . '">' . h($text) . '</span>';
    }

    protected function names(array $rows, array $keys) {
        $ids = [];

        foreach ($rows as $row) {
            foreach ($keys as $key) {
                if (!empty($row[$key])) $ids[(int) $row[$key]] = (int) $row[$key];
            }
        }

        return $this->qUserNames(array_values($ids));
    }

    // Cantidad con su unidad, sin ceros de más: 12 PZA, 2.5 KG.
    protected function qty($n, $unit = '') {
        $text = $this->num($n);
        return $unit ? $text . ' <span class="cp-celda-sub">' . h($unit) . '</span>' : $text;
    }

    // El número solo, sin ceros de más (para avisos y Antes / Quedó): 1,250.5
    protected function num($n) {
        return rtrim(rtrim(number_format((float) $n, 3, '.', ','), '0'), '.');
    }
}

// Corta la transaccion con un aviso para el usuario (ver attempt).
class InvStop extends RuntimeException {}

// -- Celdas (las mismas de Catalogo; aqui por si este archivo carga solo) --

if (!function_exists('h')) {
    function h($text) { return htmlspecialchars((string) $text, ENT_QUOTES, 'UTF-8'); }
}

if (!function_exists('money')) {
    function money($number) { return '$' . number_format((float) $number, 2); }
}

// En cero no dice $0.00: lleva el guion de las celdas vacías.
if (!function_exists('moneyCell')) {
    function moneyCell($number) {
        return abs((float) $number) < 0.005 ? '<span class="cp-celda-sub">—</span>' : money($number);
    }
}

if (!function_exists('chip')) {
    function chip($text, $tone = 'slate') {
        $tones = [
            'slate'   => 'bg-slate-100 text-slate-600',
            'emerald' => 'bg-emerald-50 text-emerald-700',
            'amber'   => 'bg-amber-50 text-amber-700',
            'sky'     => 'bg-sky-50 text-sky-700',
            'violet'  => 'bg-violet-50 text-violet-700',
            'red'     => 'bg-red-50 text-red-700'
        ];

        return '<span class="cp-chip ' . ($tones[$tone] ?? $tones['slate']) . '">' . h($text) . '</span>';
    }
}

if (!function_exists('cellTitle')) {
    function cellTitle($title, $sub = '') {
        $html = '<div class="cp-celda-titulo">' . h($title) . '</div>';
        return ($sub === null || $sub === '') ? $html : $html . '<div class="cp-celda-sub">' . h($sub) . '</div>';
    }
}
