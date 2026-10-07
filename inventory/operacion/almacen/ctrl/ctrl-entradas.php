<?php
require_once __DIR__ . '/../../../conf/_Session.php';
if (empty($_POST['opc'])) exit(0);

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

require_once '../mdl/mdl-entradas.php';
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
        $productos = array_map(function ($p) {
            return [
                'id'        => (string) $p['id'],
                'sku'       => $p['sku'] ?: '',
                'nombre'    => $p['nombre'],
                'categoria' => $p['categoria'] ?: 'Sin categoria',
                'costo'     => (float) $p['costo'],
                // Semilla del renglon: el ultimo costo de compra del producto.
                // En una entrada price_without_tax es la base SIN IVA del costo
                // (igual que en detail_inventory_inflow), no el precio de venta.
                'price_without_tax' => (float) $p['costo_sin_iva'],
                'tax'               => (float) $p['iva_compra'],
                'stock'     => 0,
                // Sobrenombres (Catálogo > Descripción): el buscador también los consulta.
                'descripcion' => $p['descripcion'] ?? '',
                // 0 o vacío = sin máximo; la captura avisa si la entrada lo rebasa.
                'stock_max' => (float) ($p['stock_max'] ?? 0),
                'image'     => $p['image'] ?? '',
                'icon'      => 'package',
                'bg'        => 'bg-gray-100',
                'color'     => 'text-gray-500'
            ];
        }, $this->qProductsForTransfer([$this->companiesId]));

        return [
            'status'           => 200,
            'companies_id'     => $this->companiesId,
            'branch_id'        => $this->branchId,
            'user_id'          => $this->userId,
            'coffeeia'         => IaOllama::activo($this),
            'sucursales'       => $this->lsSucursales(['company_id' => $this->companiesId, 'user_id' => $this->userId, 'is_owner' => (int) ($_SESSION['is_owner'] ?? 0)]),
            'almacenes'        => $this->lsWarehouses(['companies_id' => $this->companiesId]),
            'areas'            => $this->lsAreas([$this->companiesId]),
            'categorias'       => $this->lsCategorias([$this->companiesId]),
            'unidades'         => $this->lsUnidades([$this->companiesId]),
            'proveedores'      => $this->lsSuppliers([$this->companiesId]),
            'origenes_entrada' => $this->lsInflowOrigins(),
            'estados_entrada'  => [
                ['id' => '',          'valor' => 'Todos los estados'],
                ['id' => 'Activas',   'valor' => 'Activas (sin Cancelada)'],
                ['id' => 'Aplicada',  'valor' => 'Aplicada'],
                ['id' => 'Pendiente', 'valor' => 'Pendiente'],
                ['id' => 'Cancelada', 'valor' => 'Cancelada']
            ],
            'productos'        => $productos
        ];
    }

    function lsStockByWarehouse() {
        $warehouseId = (int) ($_POST['warehouse_id'] ?? 0);
        $map = [];
        if ($warehouseId > 0) {
            foreach ($this->qStockByWarehouse([$warehouseId, $this->companiesId]) as $row) {
                $map[(string) $row['item_id']] = (float) $row['quantity'];
            }
        }
        return ['status' => 200, 'stock' => $map];
    }

    function lsEntradas() {
        $rows = $this->qEntradas([
            'companies_id'    => $this->companiesId,
            'branch_id'       => $_POST['branch_id'] ?? '',
            'branch_ids'      => $this->_userBranchIds(),
            'origin_id'       => $_POST['origin_id']       ?? '',
            'status'          => $_POST['status']          ?? '',
            'fi'              => $_POST['fi']              ?? '',
            'ff'              => $_POST['ff']              ?? '',
            'q'               => $_POST['q']               ?? ''
        ]);

        $row = [];
        foreach ($rows as $r) {
            $a = [
                [
                    'class'   => 'inline-flex items-center justify-center w-9 h-9 p-2 text-[#9CA3AF] hover:text-blue-600 transition-colors cursor-pointer bg-transparent border-0',
                    'html'    => '<i data-lucide="eye" class="w-4 h-4"></i>',
                    'onclick' => "app.selectEntrada('{$r['folio']}', {$r['id']})"
                ]
            ];

            if ($r['status'] !== 'Cancelada') {
                $a[] = [
                    'class'   => 'inline-flex items-center justify-center w-9 h-9 p-2 text-[#9CA3AF] hover:text-blue-600 transition-colors cursor-pointer bg-transparent border-0',
                    'html'    => '<i data-lucide="pencil" class="w-4 h-4"></i>',
                    'onclick' => "entradasView.openEditEntrada({$r['id']})"
                ];
            }

            $row[] = [
                'id'         => $r['id'],
                'Folio'      => [
                    'html' => renderFolioLink($r['folio'], $r['id'])
                ],
                'Fecha'      => fechaHoraEntrada($r['date_inflow'], $r['created_at'] ?? ''),
                'Tipo de entrada' => badge($r['origin_name'], $r['origin_color'], 100, $r['origin_bg'] ?? null, $r['origin_icon'] ?? null),
                'Sucursal'   => $r['branch_name'] ?: '-',
                'Origen'     => renderOrigen($r['warehouse_name'], $r['area_name'] ?? ''),
                'Costo'      => evaluar((float) $r['total_cost']),
                'Estado'     => $this->statusBadge($r['status']),
                'Registrado' => $r['user_name'] ?: '-',
                'a'          => $a
            ];
        }
        return ['status' => 200, 'row' => $row];
    }

    function showEntradas() {
        $kpis = $this->getEntradaKpis($this->kpiFilters());
        return ['status' => 200, 'counts' => $kpis];
    }

    function lsKpiDetail() {
        $filters = $this->kpiFilters();

        switch ($_POST['kpi']) {
            case 'kpiEntradas':
                $row = $this->kpiRowsByOrigin($filters);
                break;
            case 'kpiCosto':
                $row = $this->kpiRowsByProduct($filters, 'cost');
                break;
            case 'kpiUnidades':
                $row = $this->kpiRowsByProduct($filters, 'units');
                break;
            case 'kpiAplicadas':
                $row = $this->kpiRowsApplied($filters);
                break;
            default:
                return ['status' => 400, 'message' => 'Indicador no reconocido'];
        }

        return ['status' => 200, 'row' => $row];
    }

    function getEntrada() {
        $id     = (int) $_POST['id'];
        $header = $this->qGetEntrada([$id]);
        if (!$header) return ['status' => 404, 'message' => 'Entrada no encontrada'];
        // Badge del origen con la misma formula y color (color_hex) que el catalogo y la tabla.
        $header['origin_badge'] = badge($header['origin_name'] ?? '', $header['origin_color'] ?? '#9CA3AF', 100, $header['origin_bg'] ?? null, $header['origin_icon'] ?? null);
        $detail = $this->qGetEntradaDetail([$id]);
        return ['status' => 200, 'header' => $header, 'detail' => $detail];
    }

    function createSupplier() {
        $name  = trim($_POST['name'] ?? '');
        $phone = trim($_POST['phone'] ?? '');
        if ($name === '') {
            return ['status' => 400, 'message' => 'El nombre del proveedor es obligatorio'];
        }

        if ($phone !== '' && !preg_match('/^\d{1,10}$/', $phone)) {
            return ['status' => 400, 'message' => 'El teléfono lleva máximo 10 dígitos'];
        }

        $existing = $this->findSupplierByName([$this->companiesId, $name]);
        if ($existing) {
            return [
                'status'  => 200,
                'message' => 'El proveedor ya existia, se reutilizo',
                'id'      => (int) $existing['id'],
                'valor'   => $existing['name'],
                'existed' => true
            ];
        }

        $ok = $this->insertSupplier([
            $name,
            trim($_POST['contact_name'] ?? '') ?: null,
            $phone ?: null,
            trim($_POST['email'] ?? '') ?: null,
            $this->companiesId
        ]);
        if (!$ok) return ['status' => 500, 'message' => 'No se pudo crear el proveedor'];

        $row = $this->findSupplierByName([$this->companiesId, $name]);
        return [
            'status'  => 200,
            'message' => 'Proveedor creado',
            'id'      => (int) ($row['id'] ?? 0),
            'valor'   => $name,
            'existed' => false
        ];
    }

    function saveEntrada() {
        $payload   = json_decode($_POST['payload'] ?? '[]', true);
        $productos = $payload['productos'] ?? [];

        if (empty($productos)) {
            return ['status' => 400, 'message' => 'No se enviaron renglones'];
        }

        if (!empty($payload['date_inflow']) && ($errorFecha = $this->fechaInvalida($payload['date_inflow']))) {
            return ['status' => 400, 'message' => $errorFecha];
        }

        $origin       = $this->getInflowOrigin([(int) $payload['inflow_origin_id']]);
        $isProduction = $origin && strtoupper($origin['code']) === 'PRODUCCION';
        $status       = $isProduction ? 'Pendiente' : 'Aplicada';

        // El origen exige proveedor segun la columna requires_supplier (por dato, no por code).
        if ($origin && (int) ($origin['requires_supplier'] ?? 0) === 1 && empty($payload['supplier_id'])) {
            return ['status' => 400, 'message' => 'Este origen requiere seleccionar un proveedor'];
        }

        $folio = $this->nextFolio('ENT-', 'inventory_inflow', $this->companiesId);
        $norm  = $this->renglonesEntrada($productos);

        $totalProducts = count($norm);
        $totalUnits    = 0;
        $totalCost     = 0;
        $totalBase     = 0;
        foreach ($norm as $p) {
            $totalUnits += $p['quantity'];
            $totalCost  += $p['quantity'] * $p['cost'];
            $totalBase  += $p['quantity'] * $p['price_without_tax'];
        }

        $ok = $this->insertEntrada([
            $folio,
            $payload['note'] ?? null,
            $totalProducts,
            $totalUnits,
            $totalCost,
            $totalBase,
            $status,
            (int) $payload['inflow_origin_id'],
            (int) $payload['warehouse_id'],
            !empty($payload['warehouse_area_id']) ? (int) $payload['warehouse_area_id'] : null,
            !empty($payload['supplier_id']) ? (int) $payload['supplier_id'] : null,
            (int) ($payload['branch_id'] ?? $this->branchId),
            $this->userId,
            $this->companiesId,
            !empty($payload['date_inflow']) ? $payload['date_inflow'] : date('Y-m-d')
        ]);

        if (!$ok) return ['status' => 500, 'message' => 'No se pudo registrar la entrada'];

        $inflowRow = $this->_Read(
            "SELECT id FROM {$this->bd}inventory_inflow WHERE folio = ? AND companies_id = ? LIMIT 1",
            [$folio, $this->companiesId]
        );
        $inflowId = (int) ($inflowRow[0]['id'] ?? 0);

        if (!empty($payload['voucher_b64'])) {
            $url = $this->storeVoucher($folio, $payload['voucher_b64']);
            if ($url) $this->updateEntradaVoucher([$url, $inflowId]);
        }

        foreach ($norm as $p) {
            $productId = $p['product_id'];
            $warehouse = (int) $payload['warehouse_id'];
            $qty       = $p['quantity'];
            $base      = $p['price_without_tax'];
            $tax       = $p['tax'];
            $cost      = $p['cost'];
            $subtotal  = $qty * $cost;

            $stockRow = $this->getStockRow([$productId, $warehouse]);
            $prev     = $stockRow ? (float) $stockRow['quantity'] : 0;
            $post     = $isProduction ? $prev : $prev + $qty;

            $this->insertEntradaDetail([
                $p['batch_code'],
                $qty,
                $cost,
                $subtotal,
                $base,
                $tax,
                $prev,
                $post,
                $p['expires_at'],
                $productId,
                $inflowId,
                $p['unit_id']
            ]);

            // El ultimo costo de compra queda en el producto. Un renglon sin costo
            // (p. ej. produccion) no borra el ultimo costo conocido.
            if ($base > 0) {
                $this->updateItemCost([$base, $tax, $productId, $this->companiesId]);
            }

            if (!$isProduction) {
                if ($stockRow) {
                    $this->updateStockQuantity([$post, (int) $stockRow['id']]);
                } else {
                    $this->insertStockRow([$post, $warehouse, $productId, $this->companiesId]);
                }
            }
        }

        return [
            'status'  => 200,
            'message' => $isProduction ? 'Orden de produccion registrada (pendiente de confirmar)' : 'Entrada registrada',
            'folio'   => $folio,
            'id'      => $inflowId,
            'pending' => $isProduction
        ];
    }

    // Normaliza el desglose de impuesto por renglon. tax es el porcentaje
    // (0, 8, 16...) y el COSTO CON IMPUESTO es el valor pivote (lo que captura
    // el usuario): la base sin impuesto se deriva = cost / (1 + tax/100). Si
    // el front solo mandara la base, reconstruimos el costo.
    private function renglonesEntrada($productos) {
        $norm = [];
        foreach ($productos as $p) {
            $tax  = ($p['tax'] ?? '') === '' || $p['tax'] === null ? 0.0 : (float) $p['tax'];
            $base = ($p['price_without_tax'] ?? '') === '' || $p['price_without_tax'] === null ? null : (float) $p['price_without_tax'];
            $cost = ($p['cost'] ?? '') === '' || $p['cost'] === null ? null : (float) $p['cost'];

            if ($cost === null) {
                $cost = $base !== null ? $base + ($base * $tax / 100) : 0.0;
            }
            $base = $tax > 0 ? $cost / (1 + $tax / 100) : $cost;

            $norm[] = [
                'product_id'        => (int) $p['product_id'],
                'quantity'          => (float) $p['quantity'],
                'price_without_tax' => $base,
                'tax'               => $tax,
                'cost'              => $cost,
                'batch_code'        => $p['batch_code'] ?? null,
                'expires_at'        => $p['expires_at'] ?? null,
                'unit_id'           => !empty($p['unit_id']) ? (int) $p['unit_id'] : null
            ];
        }
        return $norm;
    }

    /*  Edición completa desde el modal (tipo, origen, destino, proveedor, fecha,
        nota y renglones). Si la entrada estaba aplicada, primero se le quita al
        almacén de antes lo que la entrada le había sumado y luego se suma lo nuevo
        al almacén elegido. Una orden de producción pendiente solo cambia sus
        renglones: el stock se aplica al confirmarla. Todo o nada. */
    // Editar una entrada ya registrada pide la contraseña de quien está en sesión.
    // Al acertar queda una autorización en sesión para ESA entrada durante
    // EDIT_WINDOW segundos; updateEntrada/editEntrada la exigen y la consumen.
    const EDIT_WINDOW = 1800;

    // Tamaño máximo del comprobante ya decodificado (4 MB).
    const VOUCHER_MAX = 4194304;

    // Formulario previo de "Agregar Entrada": revisa Tipo de entrada, Sucursal destino,
    // Origen (almacén de esa sucursal) y Fecha antes de abrir la captura, que abre con
    // ellos y los vuelve a mandar al registrar.
    function verifyNuevaEntrada() {
        $origen     = (int) ($_POST['inflow_origin_id'] ?? 0);
        $branchId   = (int) ($_POST['branch_id'] ?? 0);
        $almacen    = (int) ($_POST['warehouse_id'] ?? 0);
        $fecha      = trim((string) ($_POST['date_inflow'] ?? ''));
        $sucursales = $this->_userBranchIds();

        if ($origen <= 0) return ['status' => 400, 'message' => 'Elige el tipo de entrada'];

        if ($branchId <= 0 || ($sucursales && !in_array($branchId, $sucursales, true))) {
            return ['status' => 400, 'message' => 'Elige una de tus sucursales'];
        }

        $almacenes = array_map('intval', array_column($this->lsWarehouses(['companies_id' => $this->companiesId, 'branch_id' => $branchId]) ?: [], 'id'));
        if (!in_array($almacen, $almacenes, true)) return ['status' => 400, 'message' => 'Elige un almacén de esa sucursal'];

        $errorFecha = $this->fechaInvalida($fecha);
        if ($errorFecha) return ['status' => 400, 'message' => $errorFecha];

        return [
            'status' => 200,
            'data'   => [
                'origen'       => $origen,
                'branch_id'    => $branchId,
                'warehouse_id' => $almacen,
                'fecha'        => $fecha
            ]
        ];
    }

    function verifyEditPassword() {
        $id     = (int) $_POST['id'];
        $header = $this->qGetEntrada([$id]);
        if (!$header || (int) $header['companies_id'] !== $this->companiesId) {
            return ['status' => 404, 'message' => 'Entrada no encontrada'];
        }

        // Misma verificación que el login: bcrypt con respaldo MD5 heredado.
        $user  = $this->qUserPassword([$this->userId]);
        $pass  = str_replace("'", "", $_POST['password']);
        $valid = $user && (
            (!empty($user['password']) && password_verify($pass, $user['password'])) ||
            (!empty($user['user_key']) && $user['user_key'] === md5($pass))
        );
        if (!$valid) return ['status' => 401, 'message' => 'Contraseña incorrecta'];

        $_SESSION['inflow_edit'][$id] = time();
        return ['status' => 200, 'message' => 'OK'];
    }

    private function editAuthorized($id) {
        $at = (int) ($_SESSION['inflow_edit'][$id] ?? 0);
        return $at > 0 && (time() - $at) <= self::EDIT_WINDOW;
    }

    function updateEntrada() {
        $payload   = json_decode($_POST['payload'] ?? '[]', true);
        $id        = (int) ($payload['id'] ?? 0);
        $productos = $payload['productos'] ?? [];
        $header    = $this->qGetEntrada([$id]);

        if (!$header || (int) $header['companies_id'] !== $this->companiesId) {
            return ['status' => 404, 'message' => 'Entrada no encontrada'];
        }
        if (!$this->editAuthorized($id)) {
            return ['status' => 403, 'message' => 'Confirma tu contraseña para editar la entrada'];
        }
        if ($header['status'] === 'Cancelada') {
            return ['status' => 400, 'message' => 'No se puede editar una entrada cancelada'];
        }
        if (!empty($payload['date_inflow']) && ($errorFecha = $this->fechaInvalida($payload['date_inflow']))) {
            return ['status' => 400, 'message' => $errorFecha];
        }
        if (empty($productos)) {
            return ['status' => 400, 'message' => 'No se enviaron renglones'];
        }

        $origin = $this->getInflowOrigin([(int) $payload['inflow_origin_id']]);
        if ($origin && (int) ($origin['requires_supplier'] ?? 0) === 1 && empty($payload['supplier_id'])) {
            return ['status' => 400, 'message' => 'Este origen requiere seleccionar un proveedor'];
        }

        $aplicada     = $header['status'] === 'Aplicada';
        $oldWarehouse = (int) $header['warehouse_id'];
        $warehouse    = (int) $payload['warehouse_id'];
        $norm         = $this->renglonesEntrada($productos);

        $totalUnits = 0;
        $totalCost  = 0;
        $totalBase  = 0;
        foreach ($norm as $p) {
            $totalUnits += $p['quantity'];
            $totalCost  += $p['quantity'] * $p['cost'];
            $totalBase  += $p['quantity'] * $p['price_without_tax'];
        }

        try {
            $this->transaction(function () use ($id, $payload, $norm, $aplicada, $oldWarehouse, $warehouse, $totalUnits, $totalCost, $totalBase) {
                if ($aplicada) {
                    foreach ($this->qGetEntradaDetail([$id]) as $d) {
                        $qty      = $d['confirmed_quantity'] !== null ? (float) $d['confirmed_quantity'] : (float) $d['quantity'];
                        $stockRow = $this->getStockRow([(int) $d['product_id'], $oldWarehouse]);
                        if ($stockRow) $this->updateStockQuantity([max(0, (float) $stockRow['quantity'] - $qty), (int) $stockRow['id']]);
                    }
                }

                $this->qDisableEntradaDetail([$id]);

                $this->updateEntradaHeader([
                    $payload['note'] ?? null,
                    count($norm),
                    $totalUnits,
                    $totalCost,
                    $totalBase,
                    (int) $payload['inflow_origin_id'],
                    $warehouse,
                    !empty($payload['warehouse_area_id']) ? (int) $payload['warehouse_area_id'] : null,
                    !empty($payload['supplier_id']) ? (int) $payload['supplier_id'] : null,
                    (int) ($payload['branch_id'] ?? $this->branchId),
                    !empty($payload['date_inflow']) ? $payload['date_inflow'] : date('Y-m-d'),
                    $id,
                    $this->companiesId
                ]);

                $this->qMarkEntradaEdited([$this->userId, $id]);

                foreach ($norm as $p) {
                    $stockRow = $this->getStockRow([$p['product_id'], $warehouse]);
                    $prev     = $stockRow ? (float) $stockRow['quantity'] : 0;
                    $post     = $aplicada ? $prev + $p['quantity'] : $prev;

                    $this->insertEntradaDetail([
                        $p['batch_code'],
                        $p['quantity'],
                        $p['cost'],
                        $p['quantity'] * $p['cost'],
                        $p['price_without_tax'],
                        $p['tax'],
                        $prev,
                        $post,
                        $p['expires_at'],
                        $p['product_id'],
                        $id,
                        $p['unit_id']
                    ]);

                    if ($p['price_without_tax'] > 0) {
                        $this->updateItemCost([$p['price_without_tax'], $p['tax'], $p['product_id'], $this->companiesId]);
                    }

                    if ($aplicada) {
                        if ($stockRow) {
                            $this->updateStockQuantity([$post, (int) $stockRow['id']]);
                        } else {
                            $this->insertStockRow([$post, $warehouse, $p['product_id'], $this->companiesId]);
                        }
                    }
                }
            });
        } catch (Throwable $e) {
            error_log('[updateEntrada] ' . $e->getMessage());
            return ['status' => 500, 'message' => 'No se guardó ningún cambio: la base de datos rechazó la edición'];
        }

        if (!empty($payload['voucher_b64'])) {
            $url = $this->storeVoucher($header['folio'], $payload['voucher_b64']);
            if ($url) $this->updateEntradaVoucher([$url, $id]);
        }

        unset($_SESSION['inflow_edit'][$id]);
        return ['status' => 200, 'message' => 'Entrada ' . $header['folio'] . ' actualizada', 'folio' => $header['folio'], 'id' => $id];
    }

    function confirmEntrada() {
        $id     = (int) $_POST['id'];
        $header = $this->qGetEntrada([$id]);

        if (!$header) {
            return ['status' => 404, 'message' => 'Entrada no encontrada'];
        }
        if ($header['status'] !== 'Pendiente') {
            return ['status' => 400, 'message' => 'La entrada no esta pendiente de confirmar'];
        }

        $quantities = json_decode($_POST['quantities'] ?? '{}', true);
        if (!is_array($quantities)) $quantities = [];

        $warehouse  = (int) $header['warehouse_id'];
        $detail     = $this->qGetEntradaDetail([$id]);
        $totalUnits = 0;
        $totalCost  = 0;
        $totalBase  = 0;
        $affected   = 0;
        foreach ($detail as $d) {
            $detailId  = (int) $d['id'];
            $productId = (int) $d['product_id'];
            $cost      = (float) $d['cost'];
            $base      = (float) $d['price_without_tax'];
            $realQty   = array_key_exists((string) $detailId, $quantities)
                ? max(0, (float) $quantities[$detailId])
                : (float) $d['quantity'];
            $subtotal  = $realQty * $cost;

            $stockRow = $this->getStockRow([$productId, $warehouse]);
            $prev     = $stockRow ? (float) $stockRow['quantity'] : 0;
            $post     = $prev + $realQty;

            $this->confirmEntradaDetail([$realQty, $subtotal, $prev, $post, $detailId]);

            if ($stockRow) {
                $this->updateStockQuantity([$post, (int) $stockRow['id']]);
            } else {
                $this->insertStockRow([$post, $warehouse, $productId, $this->companiesId]);
            }

            if ($realQty > 0) $affected++;
            $totalUnits += $realQty;
            $totalCost  += $subtotal;
            $totalBase  += $realQty * $base;
        }

        $this->updateEntradaTotals([$totalUnits, $totalCost, $totalBase, $id]);
        $r = $this->qApplyEntrada([$this->userId, $id]);

        $udsTxt  = (fmod($totalUnits, 1) == 0) ? (string) (int) $totalUnits : (string) round($totalUnits, 2);
        $prodTxt = $affected . ' ' . ($affected === 1 ? 'producto afectado' : 'productos afectados');

        return [
            'status'   => $r ? 200 : 500,
            'message'  => $r ? "Produccion confirmada: {$prodTxt} ({$udsTxt} uds aplicadas al almacen)" : 'No se pudo confirmar la produccion',
            'affected' => $affected,
            'units'    => $totalUnits
        ];
    }

    function editEntrada() {
        $id     = (int) $_POST['id'];
        $header = $this->qGetEntrada([$id]);

        if (!$header) {
            return ['status' => 404, 'message' => 'Entrada no encontrada'];
        }
        if (!$this->editAuthorized($id)) {
            return ['status' => 403, 'message' => 'Confirma tu contraseña para editar la entrada'];
        }
        if ($header['status'] !== 'Aplicada') {
            return ['status' => 400, 'message' => 'Solo se puede editar una entrada aplicada'];
        }

        $quantities = json_decode($_POST['quantities'] ?? '{}', true);
        if (!is_array($quantities)) $quantities = [];

        $warehouse  = (int) $header['warehouse_id'];
        $detail     = $this->qGetEntradaDetail([$id]);
        $totalUnits = 0;
        $totalCost  = 0;
        $totalBase  = 0;
        $affected   = 0;
        foreach ($detail as $d) {
            $detailId  = (int) $d['id'];
            $productId = (int) $d['product_id'];
            $cost      = (float) $d['cost'];
            $base      = (float) $d['price_without_tax'];
            $oldQty    = $d['confirmed_quantity'] !== null ? (float) $d['confirmed_quantity'] : (float) $d['quantity'];
            $newQty    = array_key_exists((string) $detailId, $quantities)
                ? max(0, (float) $quantities[$detailId])
                : $oldQty;
            $delta     = $newQty - $oldQty;
            $subtotal  = $newQty * $cost;

            $stockRow = $this->getStockRow([$productId, $warehouse]);
            $prev     = $stockRow ? (float) $stockRow['quantity'] : 0;
            $post     = max(0, $prev + $delta);

            $this->confirmEntradaDetail([$newQty, $subtotal, $prev, $post, $detailId]);

            if ($delta != 0) {
                if ($stockRow) {
                    $this->updateStockQuantity([$post, (int) $stockRow['id']]);
                } else if ($newQty > 0) {
                    $this->insertStockRow([$post, $warehouse, $productId, $this->companiesId]);
                }
                $affected++;
            }

            $totalUnits += $newQty;
            $totalCost  += $subtotal;
            $totalBase  += $newQty * $base;
        }

        $this->updateEntradaTotals([$totalUnits, $totalCost, $totalBase, $id]);
        $this->qMarkEntradaEdited([$this->userId, $id]);
        unset($_SESSION['inflow_edit'][$id]);

        $udsTxt  = (fmod($totalUnits, 1) == 0) ? (string) (int) $totalUnits : (string) round($totalUnits, 2);
        $prodTxt = $affected . ' ' . ($affected === 1 ? 'producto ajustado' : 'productos ajustados');

        return [
            'status'   => 200,
            'message'  => $affected > 0
                ? "Entrada actualizada: {$prodTxt} ({$udsTxt} uds en el almacen)"
                : 'No hubo cambios en las cantidades',
            'affected' => $affected,
            'units'    => $totalUnits
        ];
    }

    // Cancelar pide la misma contraseña que editar (verifyEditPassword).
    function reverseEntrada() {
        $id     = (int) $_POST['id'];
        $header = $this->qGetEntrada([$id]);

        if (!$header) {
            return ['status' => 404, 'message' => 'Entrada no encontrada'];
        }
        if ($header['status'] === 'Cancelada') {
            return ['status' => 400, 'message' => 'La entrada ya esta cancelada'];
        }
        if (!$this->editAuthorized($id)) {
            return ['status' => 403, 'message' => 'Confirma tu contraseña para cancelar la entrada'];
        }

        if ($header['status'] === 'Aplicada') {
            $warehouse = (int) $header['warehouse_id'];
            $detail    = $this->qGetEntradaDetail([$id]);
            foreach ($detail as $d) {
                $productId = (int) $d['product_id'];
                $qty       = $d['confirmed_quantity'] !== null ? (float) $d['confirmed_quantity'] : (float) $d['quantity'];
                $stockRow  = $this->getStockRow([$productId, $warehouse]);
                if ($stockRow) {
                    $post = max(0, (float) $stockRow['quantity'] - $qty);
                    $this->updateStockQuantity([$post, (int) $stockRow['id']]);
                }
            }
        }

        $r = $this->qReverseEntrada([$id]);
        if ($r) unset($_SESSION['inflow_edit'][$id]);

        return [
            'status'  => $r ? 200 : 500,
            'message' => $r ? 'Entrada cancelada' : 'No se pudo cancelar'
        ];
    }

    // -- Comprobante --

    // Sube, cambia o quita (voucher_b64 vacío) el comprobante desde el detalle.
    function saveEntradaVoucher() {
        $id     = (int) ($_POST['id'] ?? 0);
        $header = $this->qGetEntrada([$id]);

        if (!$header || (int) $header['companies_id'] !== $this->companiesId) {
            return ['status' => 404, 'message' => 'Entrada no encontrada'];
        }
        if ($header['status'] === 'Cancelada') {
            return ['status' => 400, 'message' => 'No se puede cambiar el comprobante de una entrada cancelada'];
        }

        $b64 = $_POST['voucher_b64'] ?? '';

        if ($b64 === '') {
            $this->dropVoucher($header['voucher_url'] ?? '');
            $this->updateEntradaVoucher([null, $id]);
            return ['status' => 200, 'message' => 'Comprobante eliminado'];
        }

        $url = $this->storeVoucher($header['folio'], $b64);
        if (!$url) {
            return ['status' => 400, 'message' => 'El comprobante debe ser una imagen o un PDF de hasta 4 MB'];
        }

        $this->updateEntradaVoucher([$url, $id]);
        return ['status' => 200, 'message' => 'Comprobante guardado', 'voucher_url' => $url];
    }

    // Guarda la foto o PDF (dataURL) como uploads/entradas/{folio}.{ext} y devuelve la
    // ruta relativa a inventory/, o null si no es válido. Borra la versión anterior
    // aunque tuviera otra extensión.
    private function storeVoucher($folio, $b64) {
        if (!preg_match('#^data:(image/(jpeg|png|webp)|application/pdf);base64,#', $b64, $mm)) return null;

        $data = base64_decode(substr($b64, strpos($b64, ',') + 1), true);
        if ($data === false || strlen($data) > self::VOUCHER_MAX) return null;

        $name = preg_replace('/[^A-Za-z0-9_-]/', '', $folio);
        $ext  = $mm[1] === 'application/pdf' ? 'pdf' : ($mm[2] === 'jpeg' ? 'jpg' : $mm[2]);
        $dir  = __DIR__ . '/../../../uploads/entradas/';
        if (!is_dir($dir)) @mkdir($dir, 0777, true);

        foreach (glob($dir . $name . '.*') ?: [] as $old) @unlink($old);
        if (@file_put_contents($dir . $name . '.' . $ext, $data) === false) return null;

        return 'uploads/entradas/' . $name . '.' . $ext;
    }

    private function dropVoucher($url) {
        if (empty($url)) return;
        $file = __DIR__ . '/../../../uploads/entradas/' . basename($url);
        if (is_file($file)) @unlink($file);
    }

    // -- Subir con IA --

    // El chat es el mismo de Catálogo (ia-chat.js). El adjunto lo lee
    // ctrl-almacen::readArchivo (la foto la transcribe el modelo de visión); aquí el
    // modelo de texto empareja cada renglón con el catálogo y el servidor lo valida:
    // solo entran ids que existen. Lo que no está en el catálogo se propone "Crear".
    const IA_MAX_CATALOGO  = 800;
    const IA_MAX_RENGLONES = 100;

    function askEntradaIA() {
        if (empty($_SESSION['company_id'])) return ['status' => 401, 'message' => 'Tu sesión expiró. Vuelve a entrar.'];

        if (!IaOllama::activo($this)) return ['status' => 403, 'message' => 'CoffeeIA está apagado. Se enciende en Administrador > CoffeeIA.'];

        $mensaje   = mb_substr(trim((string) ($_POST['mensaje'] ?? '')), 0, 4000);
        $adjuntos  = json_decode((string) ($_POST['adjuntos'] ?? '[]'), true);
        $historial = json_decode((string) ($_POST['historial'] ?? '[]'), true);
        $adjuntos  = is_array($adjuntos) ? $adjuntos : [];
        $historial = is_array($historial) ? $historial : [];

        if ($mensaje === '' && empty($adjuntos)) {
            return ['status' => 400, 'message' => 'Adjunta la foto del ticket o escríbeme qué llegó.'];
        }

        $ia = IaOllama::desdeCredenciales($this);
        if ($ia === null) return ['status' => 503, 'message' => 'La IA no está configurada: falta la llave de Ollama.'];

        $catalogo = array_slice($this->qProductsForTransfer([$this->companiesId]), 0, self::IA_MAX_CATALOGO);

        // Sin esto la sesión queda bloqueada mientras el modelo piensa y la tabla de
        // entradas no puede recargar en ese rato.
        session_write_close();
        set_time_limit(180);

        $r = $ia->chatJson($this->mensajesEntradaIA($mensaje, $adjuntos, $historial, $catalogo));
        if (!$r['ok']) return ['status' => 502, 'message' => $r['error']];

        return ['status' => 200] + $this->validarEntradaIA($r['data'], $catalogo);
    }

    private function mensajesEntradaIA($mensaje, $adjuntos, $historial, $catalogo) {
        $filas = array_map(function ($p) {
            return implode(' | ', array_map(function ($v) {
                $v = trim(str_replace(["\r", "\n", '|'], [' ', ' ', '/'], (string) $v));
                return $v === '' ? '-' : $v;
            }, [$p['id'], $p['sku'], $p['nombre'], $p['categoria'], number_format((float) $p['costo'], 2, '.', '')]));
        }, $catalogo);

        $sistema = implode("\n", [
            'Eres CoffeeIA y ayudas a capturar una ENTRADA de mercancía al almacén. Hablas español, en frases cortas.',
            'Te llega lo que se recibió: la transcripción de una foto (factura, ticket, remisión, nota o lista), un Excel o lo que la persona escribe.',
            'Por cada renglón con un producto, búscalo en el CATÁLOGO por nombre, SKU o clave, aunque venga abreviado o escrito distinto.',
            '- Si corresponde a un producto del catálogo va en "items", con el "id" del catálogo y en "ref" el texto del renglón.',
            '- Si NO está en el catálogo va en "missing", con el nombre como aparece en el documento.',
            '- Si la persona solo pregunta o no hay productos, "items" y "missing" van vacíos y contestas en "reply".',
            '- No inventes productos ni cantidades. Un renglón que no se lee no se pone.',
            '- Si un producto aparece dos veces, suma las cantidades en un solo renglón.',
            '- "quantity": cantidad que llegó, como número. Si no se ve, 1.',
            '- "cost": costo unitario CON impuesto, como número sin $ ni comas. Si el documento trae el precio sin IVA y la tasa, súmale el IVA; si solo trae el importe del renglón, divídelo entre la cantidad. Si no hay precio, null.',
            '- Ignora totales, subtotales, impuestos, descuentos, propinas y los datos fiscales o del proveedor.',
            '- Como mucho ' . self::IA_MAX_RENGLONES . ' renglones entre "items" y "missing".',
            '',
            'Responde SOLO con un objeto JSON, sin texto antes ni después. La forma:',
            '{"reply": "Encontré 8 productos; 2 no están en el catálogo.", "items": [{"id": 45, "ref": "COCA COLA 600", "quantity": 12, "cost": 19.99}], "missing": [{"name": "Salsa Valentina 1 L", "quantity": 3, "cost": 35.5}]}',
            '',
            'CATÁLOGO (id | sku | nombre | categoría | último costo con IVA):',
            empty($filas) ? '(vacío)' : implode("\n", $filas)
        ]);

        $mensajes = [['role' => 'system', 'content' => $sistema]];

        foreach (array_slice($historial, -8) as $h) {
            $rol   = is_array($h) ? ($h['role'] ?? '') : '';
            $texto = is_array($h) ? mb_substr(trim((string) ($h['content'] ?? '')), 0, 3000) : '';
            if (($rol === 'user' || $rol === 'assistant') && $texto !== '') $mensajes[] = ['role' => $rol, 'content' => $texto];
        }

        $pregunta = 'MENSAJE: ' . ($mensaje !== '' ? $mensaje : '(sin texto: solo adjuntó archivos)');
        $cupo     = 60000;

        foreach (array_slice($adjuntos, 0, 3) as $a) {
            $texto = is_array($a) ? mb_substr(trim((string) ($a['texto'] ?? '')), 0, min(30000, $cupo)) : '';
            if ($texto === '') continue;

            $cupo     -= mb_strlen($texto);
            $pregunta .= "\n\nARCHIVO «" . $this->textoEntradaIA($a['nombre'] ?? 'archivo') . "»:\n" . $texto;
            if ($cupo <= 0) break;
        }

        $mensajes[] = ['role' => 'user', 'content' => $pregunta];

        return $mensajes;
    }

    // Arma la vista previa del chat: "add" = producto del catálogo, "create" = no está
    // y se da de alta. Un id que no existe no entra como "add": pasa a "create".
    private function validarEntradaIA($data, $catalogo) {
        $porId   = array_column($catalogo, null, 'id');
        $items   = [];
        $missing = [];

        foreach (array_slice(is_array($data['items'] ?? null) ? $data['items'] : [], 0, self::IA_MAX_RENGLONES) as $it) {
            if (!is_array($it)) continue;

            $id   = (int) ($it['id'] ?? 0);
            $qty  = $this->numeroEntradaIA($it['quantity'] ?? null);
            $cost = $this->numeroEntradaIA($it['cost'] ?? null);
            $qty  = $qty > 0 ? $qty : 1;

            if (!isset($porId[$id])) {
                $nombre = $this->textoEntradaIA($it['ref'] ?? '');
                if ($nombre !== '') $missing[] = ['nombre' => $nombre, 'cantidad' => $qty, 'costo' => $cost];
                continue;
            }

            if (isset($items[$id])) {
                $items[$id]['cantidad'] += $qty;
                continue;
            }

            $items[$id] = ['id' => (string) $id, 'nombre' => $porId[$id]['nombre'], 'cantidad' => $qty, 'costo' => $cost];
        }

        foreach (array_slice(is_array($data['missing'] ?? null) ? $data['missing'] : [], 0, self::IA_MAX_RENGLONES) as $m) {
            $nombre = is_array($m) ? $this->textoEntradaIA($m['name'] ?? '') : '';
            if ($nombre === '') continue;

            $qty       = $this->numeroEntradaIA($m['quantity'] ?? null);
            $missing[] = ['nombre' => $nombre, 'cantidad' => $qty > 0 ? $qty : 1, 'costo' => $this->numeroEntradaIA($m['cost'] ?? null)];
        }

        $row = [];

        foreach (array_values($items) as $it) {
            $row[] = [
                'idx'        => count($row),
                'action'     => 'add',
                'valid'      => true,
                'name'       => $it['nombre'],
                'sku'        => $porId[$it['id']]['sku'] ?? '',
                'changes'    => $this->cambiosEntradaIA($it['cantidad'], $it['costo'], 'último costo'),
                'product_id' => $it['id'],
                'cantidad'   => $it['cantidad'],
                'costo'      => $it['costo']
            ];
        }

        foreach ($missing as $m) {
            $row[] = [
                'idx'      => count($row),
                'action'   => 'create',
                'valid'    => true,
                'name'     => $m['nombre'],
                'detail'   => 'No está en el catálogo: se da de alta y se agrega.',
                'changes'  => $this->cambiosEntradaIA($m['cantidad'], $m['costo'], 'sin costo'),
                'cantidad' => $m['cantidad'],
                'costo'    => $m['costo']
            ];
        }

        $reply = $this->textoEntradaIA($data['reply'] ?? '');
        if ($reply === '') {
            $reply = empty($row)
                ? 'No encontré productos que agregar.'
                : count($items) . ' en el catálogo' . (count($missing) ? '; ' . count($missing) . ' no están y los puedo crear.' : '.');
        }

        return [
            'reply' => $reply,
            'token' => empty($row) ? '' : bin2hex(random_bytes(8)),
            'row'   => $row
        ];
    }

    private function cambiosEntradaIA($cantidad, $costo, $sinCosto) {
        return [
            ['label' => 'Cantidad', 'after' => (string) $cantidad],
            ['label' => 'Costo',    'after' => $costo !== null ? '$' . number_format($costo, 2) : $sinCosto]
        ];
    }

    // Número o texto numérico ("$1,250.50"). null si no hay número o es negativo.
    private function numeroEntradaIA($v) {
        if (is_int($v) || is_float($v)) return $v >= 0 ? round((float) $v, 4) : null;
        $v = str_replace(['$', ',', ' '], '', (string) $v);
        return is_numeric($v) && (float) $v >= 0 ? round((float) $v, 4) : null;
    }

    private function textoEntradaIA($v) {
        return mb_substr(trim(strip_tags(is_string($v) ? $v : '')), 0, 200);
    }

    // -- Formatos (plantillas de lote) --

    // Devuelve los formatos visibles ya con sus productos rearmados con el shape
    // del catalogo (init), para que el front pinte la lista y aplique el lote igual.
    function lsFormatos() {
        $headers = $this->qLsFormatos([$this->companiesId, $this->branchId, $this->userId]);
        if (empty($headers)) return ['status' => 200, 'formatos' => []];

        $ids   = array_map(function ($h) { return (int) $h['id']; }, $headers);
        $items = $this->qFormatoItems($ids);

        $byFormat = [];
        foreach ($items as $it) {
            $fid = (int) $it['inflow_format_id'];
            // Mismo shape que init(): costo, base sin impuesto y porcentaje de tax
            // salen del catalogo vigente (no se congelan en el formato), para que
            // el front los siembre con seedTax igual que al agregar desde el buscador.
            $byFormat[$fid][] = [
                'id'                => (string) $it['id'],
                'nombre'            => $it['nombre'],
                'sku'               => $it['sku'] ?: '',
                'categoria'         => $it['categoria'] ?: 'Sin categoria',
                'costo'             => (float) $it['costo'],
                'price_without_tax' => (float) $it['costo_sin_iva'],
                'tax'               => (float) $it['iva_compra'],
                'cantidad'          => (float) $it['cantidad'],
                'stock'             => 0,
                'image'             => $it['image'] ?? '',
                'icon'              => 'package',
                'bg'                => 'bg-gray-100',
                'color'             => 'text-gray-500'
            ];
        }

        $formatos = [];
        foreach ($headers as $h) {
            $fid = (int) $h['id'];
            $formatos[] = [
                'id'        => $fid,
                'name'      => $h['name'],
                'scope'     => $h['scope'],
                'productos' => $byFormat[$fid] ?? []
            ];
        }
        return ['status' => 200, 'formatos' => $formatos];
    }

    function saveFormato() {
        $name      = trim($_POST['name'] ?? '');
        $scope     = $_POST['scope'] ?? 'user';
        $productos = json_decode($_POST['productos'] ?? '[]', true);

        if ($name === '')      return ['status' => 400, 'message' => 'El nombre del formato es obligatorio'];
        if (empty($productos)) return ['status' => 400, 'message' => 'El formato no tiene productos'];
        if (!in_array($scope, ['user', 'subsidiary', 'company'], true)) $scope = 'user';

        $ok = $this->insertFormato([$name, $scope, $this->userId, $this->branchId, $this->companiesId]);
        if (!$ok) return ['status' => 500, 'message' => 'No se pudo guardar el formato'];

        $formatId = $this->qLastFormatoId([$this->companiesId, $this->userId]);
        if (!$formatId) return ['status' => 500, 'message' => 'No se pudo recuperar el formato creado'];

        foreach ($productos as $p) {
            $itemId = (int) ($p['id'] ?? $p['product_id'] ?? 0);
            $qty    = (float) ($p['cantidad'] ?? $p['quantity'] ?? 0);
            if ($itemId <= 0 || $qty <= 0) continue;
            $this->insertFormatoItem([$qty, $itemId, $formatId]);
        }

        return ['status' => 200, 'message' => 'Formato guardado', 'id' => $formatId];
    }

    function deleteFormato() {
        $id = (int) ($_POST['id'] ?? 0);
        if ($id <= 0) return ['status' => 400, 'message' => 'Formato invalido'];

        $f = $this->qGetFormato([$id, $this->companiesId]);
        if (!$f) return ['status' => 404, 'message' => 'Formato no encontrado'];

        $ok = $this->qDeleteFormato([$id, $this->companiesId]);
        return ['status' => $ok ? 200 : 500, 'message' => $ok ? 'Formato eliminado' : 'No se pudo eliminar el formato'];
    }

    // Los mismos filtros para las cards y para su desglose.
    private function kpiFilters() {
        return [
            'companies_id'    => $this->companiesId,
            'branch_id'       => $_POST['branch_id'] ?? '',
            'branch_ids'      => $this->_userBranchIds(),
            'origin_id'       => $_POST['origin_id']       ?? '',
            'status'          => $_POST['status']          ?? '',
            'fi'              => $_POST['fi']              ?? '',
            'ff'              => $_POST['ff']              ?? '',
            'q'               => $_POST['q']               ?? ''
        ];
    }

    private function kpiRowsByOrigin($filters) {
        $origins = $this->listEntradasByOrigin($filters);
        $total   = array_sum(array_column($origins, 'total_entradas'));

        $row = [];
        foreach ($origins as $key => $origin) {
            $row[] = [
                'id'              => $key + 1,
                'Tipo de entrada' => badge($origin['origin_name'] ?: 'Sin tipo', $origin['origin_color'] ?: '#9CA3AF', 100, $origin['origin_bg'] ?? null, $origin['origin_icon'] ?? null),
                'Entradas'        => (int) $origin['total_entradas'],
                'Unidades'        => kpiQuantity($origin['total_unidades']),
                'Costo'           => evaluar((float) $origin['total_costo']),
                'Participación'   => kpiPercent($origin['total_entradas'], $total)
            ];
        }

        if ($row) {
            $row[] = kpiTotalRow([
                'Tipo de entrada' => 'Total',
                'Entradas'        => $total,
                'Unidades'        => kpiQuantity(array_sum(array_column($origins, 'total_unidades'))),
                'Costo'           => evaluar(array_sum(array_column($origins, 'total_costo'))),
                'Participación'   => kpiPercent($total, $total)
            ]);
        }
        return $row;
    }

    private function kpiRowsByProduct($filters, $order) {
        $products = $this->listEntradaProducts(array_merge($filters, ['order' => $order]));
        $field    = $order === 'units' ? 'total_unidades' : 'total_costo';
        $total    = array_sum(array_column($products, $field));

        $row = [];
        foreach ($products as $key => $product) {
            $cells = [
                'id'       => $key + 1,
                'Producto' => kpiProduct($product['product_name'], $product['sku']),
                'Unidad'   => $product['unit'] ?: '-',
                'Cantidad' => kpiQuantity($product['total_unidades'])
            ];
            if ($order === 'cost') $cells['Costo'] = evaluar((float) $product['total_costo']);
            $cells['Participación'] = kpiPercent($product[$field], $total);
            $row[] = $cells;
        }

        if ($row) {
            $totals = [
                'Producto' => 'Total',
                'Unidad'   => '',
                'Cantidad' => kpiQuantity(array_sum(array_column($products, 'total_unidades')))
            ];
            if ($order === 'cost') $totals['Costo'] = evaluar($total);
            $totals['Participación'] = kpiPercent($total, $total);
            $row[] = kpiTotalRow($totals);
        }
        return $row;
    }

    private function kpiRowsApplied($filters) {
        $entradas = $this->qEntradas(array_merge($filters, ['applied' => true]));

        $row = [];
        foreach ($entradas as $entrada) {
            $row[] = [
                'id'              => $entrada['id'],
                'Folio'           => $entrada['folio'],
                'Fecha'           => formatSpanishDate($entrada['date_inflow']),
                'Tipo de entrada' => badge($entrada['origin_name'], $entrada['origin_color'], 100, $entrada['origin_bg'] ?? null, $entrada['origin_icon'] ?? null),
                'Sucursal'        => $entrada['branch_name'] ?: '-',
                'Unidades'        => kpiQuantity($entrada['total_units']),
                'Costo'           => evaluar((float) $entrada['total_cost'])
            ];
        }

        if ($row) {
            $row[] = kpiTotalRow([
                'Folio'           => 'Total',
                'Fecha'           => '',
                'Tipo de entrada' => '',
                'Sucursal'        => '',
                'Unidades'        => kpiQuantity(array_sum(array_column($entradas, 'total_units'))),
                'Costo'           => evaluar(array_sum(array_column($entradas, 'total_cost')))
            ]);
        }
        return $row;
    }

    // "Todas" = las sucursales que el usuario puede ver; un dueño ve la empresa
    // completa ([] = sin filtro) y un usuario sin sucursales no ve nada ([0]).
    // La fecha de una entrada es un día válido y no posterior a hoy. null = está bien.
    private function fechaInvalida($fecha) {
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) $fecha) || !strtotime($fecha)) return 'Elige una fecha válida';
        if ($fecha > date('Y-m-d')) return 'La fecha no puede ser posterior a hoy';

        return null;
    }

    private function _userBranchIds() {
        if ((int) ($_SESSION['is_owner'] ?? 0) === 1) return [];

        $ids = array_map(function ($s) { return (int) $s['id']; }, $this->lsSucursales([
            'company_id' => $this->companiesId,
            'user_id'    => $this->userId,
            'is_owner'   => 0
        ]));
        return $ids ?: [0];
    }

    private function statusBadge($status) {
        // [color de texto, color de fondo] - modelo pastel de 2 colores (igual que los motivos).
        $map = [
            'Aplicada'  => ['#16A34A', '#DCFCE7'],
            'Pendiente' => ['#D97706', '#FEF3C7'],
            'Cancelada' => ['#DC2626', '#FEE2E2']
        ];
        $c = $map[$status] ?? ['#475569', '#F1F5F9'];
        return badge(strtoupper($status), $c[0], 100, $c[1]);
    }

}

// Complements.

// Fecha de la entrada (la que se eligió en la captura) con la hora en que se creó:
// 06/oct/2026 10:00 am. Meses a mano: strftime depende del locale del servidor.
function fechaHoraEntrada($fecha, $creado) {
    $meses = ['', 'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    $dia   = strtotime((string) $fecha);
    if (!$dia) return '-';

    $texto = date('d', $dia) . '/' . $meses[(int) date('n', $dia)] . '/' . date('Y', $dia);
    $hora  = strtotime((string) $creado);

    return $hora ? $texto . ' ' . date('h:i a', $hora) : $texto;
}

function renderFolioLink($folio, $id) {
    $label = htmlspecialchars($folio, ENT_QUOTES);
    return "<a href='#' onclick=\"app.selectEntrada('{$label}', " . (int) $id . "); return false;\""
         . " class='font-semibold text-blue-600 underline underline-offset-2 hover:text-blue-700' title='Ver detalle de recepción'>{$label}</a>";
}

// Almacén de origen y, en gris, el área de destino: "Almacén General / Vitrina".
function renderOrigen($almacen, $area) {
    $html = htmlspecialchars($almacen ?: '-', ENT_QUOTES);
    if (!empty($area)) $html .= ' <span class="text-gray-400">/ ' . htmlspecialchars($area, ENT_QUOTES) . '</span>';
    return $html;
}

$obj = new ctrl();
$opc = $_POST['opc'];
if (!method_exists($obj, $opc)) {
    echo json_encode(['status' => 405, 'message' => "opc '{$opc}' no implementado"]);
    exit(0);
}
echo json_encode($obj->{$opc}());
