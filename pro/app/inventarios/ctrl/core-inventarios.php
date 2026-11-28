<?php
require_once __DIR__ . '/../../../core/security/_Session.php';
require_once __DIR__ . '/../../../core/security/_Permission.php';
require_once __DIR__ . '/../mdl/mdl-inventarios.php';
require_once __DIR__ . '/../mdl/trait-ficha-inventario.php';
require_once __DIR__ . '/../mdl/trait-kardex-cadena.php';

/*  Base de los ctrl de Inventarios: una pagina = un ctrl que extiende esta clase.

    FichaInventario: la sección Inventario de la ficha (área, mínimo, máximo,
    lotes, grupo y proveedor). La misma regla que el Catálogo de venta.

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

    use FichaInventario, KardexCadena;

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

    // Todo opc empieza aquí: sin empresa o sucursal no hay inventario. De paso, la
    // primera vez en la sesión le copia a la empresa la plantilla de los catálogos.
    protected function needBranch() {
        if ($this->companyId() > 0 && $this->branchId() > 0) {
            $this->seedCatalogs();
            return null;
        }

        return ['status' => 409, 'message' => 'No hay una sucursal activa para el inventario.', 'row' => []];
    }

    private function seedCatalogs() {
        $key = 'inv_seeded_' . $this->companyId();

        if (!empty($_SESSION[$key])) return;

        $this->qSeedCatalogs($this->companyId());
        $_SESSION[$key] = 1;
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

    /*  Como en inventory: primero se pide la contraseña (verifyKey del ctrl) y
        queda una autorización en la sesión para ESE documento durante KEY_WINDOW
        segundos; la cancelación la exige y la consume. $doc: 'inflow', 'outflow'... */
    const KEY_WINDOW = 600;

    protected function keyCheck($doc, $id) {
        $fail = $this->needKey('continuar');
        if ($fail) return $fail;

        $_SESSION['inv_auth'][$doc . ':' . (int) $id] = time();

        return $this->ok('Contraseña correcta.');
    }

    protected function keyAuthorized($doc, $id) {
        $at = (int) ($_SESSION['inv_auth'][$doc . ':' . (int) $id] ?? 0);

        return $at > 0 && time() - $at <= self::KEY_WINDOW;
    }

    protected function keyConsume($doc, $id) {
        unset($_SESSION['inv_auth'][$doc . ':' . (int) $id]);
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

    // -- Nombres y números --

    protected function names(array $rows, array $keys) {
        $ids = [];

        foreach ($rows as $row) {
            foreach ($keys as $key) {
                if (!empty($row[$key])) $ids[(int) $row[$key]] = (int) $row[$key];
            }
        }

        return $this->qUserNames(array_values($ids));
    }

    // El número solo, sin ceros de más (para avisos y Antes / Quedó): 1,250.5
    protected function num($n) {
        return rtrim(rtrim(number_format((float) $n, 3, '.', ','), '0'), '.');
    }

    // -- Celdas del visor (las de inventory) --

    // Insignia de dos colores: texto $fg sobre fondo $bg (sin fondo: el mismo color al 10 %).
    protected function badge($text, $fg = '#64748B', $bg = null, $icon = null) {
        $fg    = preg_match('/^#[0-9A-Fa-f]{6}$/', (string) $fg) ? $fg : '#64748B';
        $bg    = $bg ?: $fg . '1A';
        $label = ($text === null || $text === '') ? '-' : $text;
        $ico   = $icon ? '<i data-lucide="' . h($icon) . '" class="w-3 h-3"></i> ' : '';
        $cls   = ($ico ? 'inline-flex items-center gap-1 ' : '') . 'text-[10px] font-semibold px-3 py-1 rounded';

        return '<span class="cs-badge-soft ' . $cls . '" style="--b-fg:' . $fg . ';background:' . $bg . ';color:' . $fg . ';">' . $ico . h($label) . '</span>';
    }

    // pending / applied / cancelled -> como se ve: Pendiente, Aplicada, Cancelada.
    protected function statusName($status) {
        return ['pending' => 'Pendiente', 'applied' => 'Aplicada', 'cancelled' => 'Cancelada'][$status] ?? $status;
    }

    protected function statusBadge($status) {
        $map = [
            'Aplicada'  => ['#16A34A', '#DCFCE7'],
            'Pendiente' => ['#D97706', '#FEF3C7'],
            'Cancelada' => ['#DC2626', '#FEE2E2']
        ];
        $name = $this->statusName($status);
        $c    = $map[$name] ?? ['#475569', '#F1F5F9'];

        return $this->badge(mb_strtoupper($name, 'UTF-8'), $c[0], $c[1]);
    }

    // 26/nov/2026 11:38 am: el día del documento con la hora en que se capturó.
    protected function dateTime($date, $stamp = '') {
        $months = ['', 'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
        $day    = strtotime((string) $date);
        if (!$day) return '-';

        $text = date('d', $day) . '/' . $months[(int) date('n', $day)] . '/' . date('Y', $day);
        $time = strtotime((string) $stamp);

        return $time ? $text . ' ' . date('h:i a', $time) : $text;
    }

    // El folio subrayado que abre el visor; $onclick: «app.selectEntrada('ENT-CUA-0001', 12)».
    protected function folioLink($folio, $onclick) {
        return "<a href='#' onclick=\"{$onclick}; return false;\""
             . " class='font-semibold text-blue-600 underline underline-offset-2 hover:text-blue-700'>" . h($folio) . '</a>';
    }

    // Botón de la fila (ojo, lápiz...) con el ícono de Lucide.
    protected function rowIcon($icon, $onclick, $title = '') {
        return [
            'class'   => 'inline-flex items-center justify-center w-9 h-9 p-2 text-[#9CA3AF] hover:text-blue-600 transition-colors cursor-pointer bg-transparent border-0',
            'html'    => '<i data-lucide="' . $icon . '" class="w-4 h-4"></i>',
            'title'   => $title,
            'onclick' => $onclick
        ];
    }

    // $ 1,250.00; en cero, un guion.
    protected function money($n) {
        $n = (float) $n;
        if (abs($n) < 0.005) return '-';

        return $n < 0
            ? "<span class='text-danger'>$ " . number_format($n, 2, '.', ',') . '</span>'
            : '$ ' . number_format($n, 2, '.', ',');
    }

    protected function percent($part, $total) {
        return (float) $total > 0 ? number_format((float) $part * 100 / (float) $total, 1) . ' %' : '-';
    }

    protected function productCell($name, $sku) {
        return h($name) . ($sku ? ' <span class="text-[10px] text-gray-400">' . h($sku) . '</span>' : '');
    }

    // Renglón de total al pie del desglose (opc 2: borde grueso arriba).
    protected function totalRow($cells) {
        $row = ['id' => 'total'];

        foreach ($cells as $column => $value) $row[$column] = ['html' => $value, 'class' => 'font-bold'];

        $row['opc'] = 2;

        return $row;
    }

    // -- Ficha de inventario (Stock › «Abrir ficha» y Catálogo de insumos › Productos) --
    /*  Lo de la ficha que se ve sin tocarse (foto, nombre, categoría, precio,
        costo) y su sección Inventario. «Lleva inventario», unidad y vida útil
        son del producto: solo los cambia la sucursal dueña (los de la Matriz se
        cambian en la Matriz, como en el Catálogo de venta). Área, mínimo,
        máximo y lotes los cambia cualquiera que pueda editar. Cada ctrl pide
        su permiso antes de llamarlas. */

    protected function fichaResponse($id) {
        $p = $this->qCatalogProduct((int) $id, $this->companyId(), $this->branchId(), $this->mainBranchId());
        if (!$p) return $this->fail(404, 'Ese producto no está en el Catálogo de la sucursal.');

        $supply = $p['kind'] === 'supply';
        $ficha  = $this->fichaRead((int) $p['id'], $p['shelf_life_days']);

        return [
            'status' => 200,
            'data'   => $ficha + [
                'id'               => (int) $p['id'],
                'name'             => $p['name'],
                'kind'             => $p['kind'],
                'sku'              => $p['sku'] ?: '',
                'image'            => $this->photoUrl($p['image']),
                'category'         => trim((string) $p['category']) ?: 'Sin categoría',
                'price'            => (float) $p['price'],
                'cost'             => $this->costs() ? (float) $p['cost'] : null,
                'unit_id'          => $p['unit_id'] ? (int) $p['unit_id'] : '',
                'shelf_life_days'  => $p['shelf_life_days'] === null ? '' : (int) $p['shelf_life_days'],
                'is_inventoriable' => $supply ? 1 : (int) $p['is_inventoriable'],
                'own'              => (int) $p['branch_id'] === $this->branchId()
            ],
            'units'     => $this->fichaUnits($this->companyId(), (int) $p['unit_id']),
            'areas'     => $this->fichaAreas($this->companyId(), $this->branchId()),
            'groups'    => $supply ? $this->fichaGroups($this->companyId(), (int) $ficha['supply_group_id']) : [],
            'suppliers' => $supply ? $this->fichaSuppliers($this->companyId(), $this->branchId(), (int) $ficha['supplier_id']) : []
        ];
    }

    protected function fichaSaveResponse($id) {
        $p = $this->qCatalogProduct((int) $id, $this->companyId(), $this->branchId(), $this->mainBranchId());
        if (!$p) return $this->fail(404, 'Ese producto no está en el Catálogo de la sucursal.');

        $id     = (int) $p['id'];
        $supply = $p['kind'] === 'supply';
        $own    = (int) $p['branch_id'] === $this->branchId();

        // De la Matriz: se quedan como están.
        $product = $own
            ? $this->fichaProductInput($this->companyId(), (int) $p['unit_id'], $supply)
            : ['unit_id' => $p['unit_id'] ? (int) $p['unit_id'] : null, 'shelf_life_days' => $p['shelf_life_days'] === null ? null : (int) $p['shelf_life_days']];

        if (isset($product['status'])) return $product;

        $track = $supply ? 1 : ($own ? $this->flag('is_inventoriable') : (int) $p['is_inventoriable']);

        if ((int) $p['is_inventoriable'] === 1 && $track === 0) {
            $problem = $this->fichaOffProblem($id, $this->companyId(), $p['name']);
            if ($problem) return $this->fail(409, 'No se le puede quitar el inventario: ' . $problem);
        }

        $in = $this->fichaInput($this->fichaAreas($this->companyId(), $this->branchId()), $this->fichaRead($id, $p['shelf_life_days']), $supply, $this->companyId(), $this->branchId());
        if (isset($in['status'])) return $in;

        return $this->attempt(function () use ($id, $own, $product, $track, $in) {
            $this->transaction(function () use ($id, $own, $product, $track, $in) {
                if ($own) {
                    $this->must($this->qUpdateItem(
                        ['unit_id', 'shelf_life_days', 'is_inventoriable', 'updated_at = NOW()'],
                        [$product['unit_id'], $product['shelf_life_days'], $track, $id]
                    ), 'fichaSave/product');
                }

                $this->fichaSave($id, $this->companyId(), $in);
            });

            return $this->ok('Ficha guardada.');
        }, 'No se pudo guardar la ficha. Intenta de nuevo.');
    }

    // -- Lo que comparten los filtros y las capturas --

    // La sucursal: la de la barra (en pro se cambia arriba). Una sola opción.
    protected function branchOptions() {
        return [['id' => $this->branchId(), 'valor' => $this->scope()['branch']]];
    }

    protected function warehouseList() {
        return array_map(function ($w) {
            return ['id' => (int) $w['id'], 'valor' => $w['name'], 'branch_id' => (int) $w['branch_id']];
        }, $this->warehouses());
    }

    protected function areaList() {
        return array_map(function ($a) {
            return ['id' => (int) $a['id'], 'valor' => $a['valor'], 'warehouse_id' => (int) $a['warehouse_id']];
        }, $this->qAreaOptions(array_map('intval', array_column($this->warehouses(), 'id'))));
    }

    protected function unitList() {
        return array_map(function ($u) {
            return ['id' => (int) $u['id'], 'valor' => $u['name'], 'code' => $u['code']];
        }, $this->qUnits($this->companyId()));
    }

    protected function categoryList() {
        $names = [];

        foreach ($this->products() as $p) {
            if ($p['category_id']) $names[(int) $p['category_id']] = trim((string) $p['category']);
        }

        asort($names, SORT_NATURAL | SORT_FLAG_CASE);

        $list = [];
        foreach ($names as $id => $name) $list[] = ['id' => $id, 'valor' => $name];

        return $list;
    }

    /*  El Catálogo como lo pide la captura de inventory (entrada-form,
        salida-form, traspaso-form). Sin «ver-costos» el costo viaja en 0: el
        ctrl usa el del Catálogo al guardar. stock: lo de ese almacén, si viene. */
    protected function catalogProducts($warehouseId = 0) {
        $costs = $this->costs();
        $stock = [];

        if ($warehouseId > 0) {
            foreach ($this->qStockRows([(int) $warehouseId]) as $row) $stock[(int) $row['product_id']] = (float) $row['quantity'];
        }

        return array_map(function ($p) use ($costs, $stock) {
            $id   = (int) $p['id'];
            $cost = $costs ? round((float) $p['cost'], 4) : 0;

            return [
                'id'                => (string) $id,
                'sku'               => (string) ($p['sku'] ?: ''),
                'nombre'            => $p['name'],
                'categoria'         => trim((string) $p['category']) ?: 'Sin categoria',
                'category_id'       => (string) ($p['category_id'] ?: ''),
                'unit_id'           => (string) ($p['unit_id'] ?: ''),
                'unidad'            => $p['unit'] ?: 'PZA',
                'decimals'          => (int) $p['decimals'],
                'costo'             => $cost,
                'price_without_tax' => $cost,
                'tax'               => 0,
                'stock'             => round($stock[$id] ?? 0, 4),
                'descripcion'       => '',
                'stock_max'         => (float) $p['stock_max'],
                'image'             => $this->photoUrl($p['image']),
                'editable'          => false,
                'lots'              => (int) $p['track_lots'],
                'icon'              => 'package',
                'bg'                => 'bg-gray-100',
                'color'             => 'text-gray-500'
            ];
        }, $this->products());
    }

    // La foto del Catálogo ('alpha_files/<empresa>/...', con espacios y acentos) desde la raíz.
    protected function photoUrl($path) {
        $path = trim((string) $path);

        if ($path === '' || preg_match('#^https?://#i', $path)) return $path;

        return '/' . implode('/', array_map('rawurlencode', explode('/', ltrim($path, '/'))));
    }

    // {product_id: existencia} de un almacén de la sucursal.
    protected function stockMap($warehouseId) {
        $map = [];

        if ($this->ownWarehouse($warehouseId)) {
            foreach ($this->qStockRows([(int) $warehouseId]) as $row) $map[(string) $row['product_id']] = round((float) $row['quantity'], 4);
        }

        return $map;
    }

    /*  Con un conteo aplicado en el almacén, lo anterior a su fecha ya no se toca:
        ni capturar con esa fecha, ni editar un documento de esos días (el conteo
        dejaría de cuadrar). null = se puede. */
    protected function adjustmentBlocks($warehouseId, $date) {
        $day  = $this->qLastAdjustmentDates([(int) $warehouseId])[(int) $warehouseId] ?? null;
        $date = substr((string) $date, 0, 10);

        if (!$day || $date === '' || $date >= $day) return null;

        return 'El almacén tuvo un conteo aplicado el ' . date('d/m/Y', strtotime($day)) . ': no se usa una fecha anterior (' . date('d/m/Y', strtotime($date)) . ').';
    }

    // La fecha de un documento: un día válido y no posterior a hoy. null = está bien.
    protected function badDate($date) {
        if (!$this->dateOrNull($date)) return 'Elige una fecha válida.';
        if ($date > $this->qNow()['today']) return 'La fecha no puede ser posterior a hoy.';

        return null;
    }
}

// Corta la transaccion con un aviso para el usuario (ver attempt).
class InvStop extends RuntimeException {}

// Escapa texto para el HTML de las celdas.
if (!function_exists('h')) {
    function h($text) { return htmlspecialchars((string) $text, ENT_QUOTES, 'UTF-8'); }
}
