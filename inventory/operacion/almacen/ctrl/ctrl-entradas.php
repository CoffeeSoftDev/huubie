<?php
require_once __DIR__ . '/../../../conf/_Session.php';
if (empty($_POST['opc'])) exit(0);

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

require_once '../mdl/mdl-entradas.php';
require_once '../../../conf/coffeSoft.php';
require_once '../../../conf/_IaOllama.php';
require_once '../../../conf/_Permissions.php';

class ctrl extends mdl {

    // Acción del rol que pide cada opc (conf/_Permissions.php); los demás solo
    // piden poder entrar a Entradas. Confirmar una producción termina su alta;
    // la contraseña se pide igual para editar que para cancelar.
    const PERMISSIONS = [
        'verifyNuevaEntrada' => 'agregar',
        'saveEntrada'        => 'agregar',
        'confirmEntrada'     => 'agregar',
        'createSupplier'     => 'agregar',
        'saveFormato'        => 'agregar',
        'deleteFormato'      => 'agregar',
        'askEntradaIA'       => ['agregar', 'eliminar'],
        'verifyEditPassword' => ['editar', 'cancelar'],
        'updateEntrada'      => 'editar',
        'editEntrada'        => 'editar',
        'reverseEntrada'     => 'cancelar',
        'saveEntradaVoucher' => 'subir-comprobante',
        'deleteEntradaIA'    => 'eliminar'
    ];

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
                // Prellenan el formulario de edición del producto en la captura.
                'category_id' => (string) ($p['category_id'] ?? ''),
                'unit_id'     => (string) ($p['unit_id'] ?? ''),
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
                // Uno de Matriz (u otra sucursal) se captura pero no se edita desde aquí.
                'editable'  => $this->puedeEditarProducto($p['branch_id'] ?? null),
                'icon'      => 'package',
                'bg'        => 'bg-gray-100',
                'color'     => 'text-gray-500'
            ];
        }, $this->qProductsForTransfer([$this->companiesId]));

        // Las presentaciones (Caja 24...) se capturan como un producto más: su costo es
        // el del empaque y al guardar pasan a su base (renglonesABase).
        foreach ($this->listPresentacionesCaptura([$this->companiesId]) as $p) {
            $tax  = (float) $p['iva_compra'];
            $base = (float) $p['cost_unit'];

            $productos[] = $this->presentacionCatalogo($p) + [
                'costo'             => round($base * (1 + $tax / 100), 4),
                'price_without_tax' => $base,
                'tax'               => $tax,
                'descripcion'       => '',
                'stock_max'         => 0,
                'bg'                => 'bg-gray-100',
                'color'             => 'text-gray-500'
            ];
        }

        return [
            'status'           => 200,
            'companies_id'     => $this->companiesId,
            'branch_id'        => $this->branchId,
            'user_id'          => $this->userId,
            'is_admin'         => (int) $this->esAdminIA(),
            // Encendido en Administrador › CoffeeIA y con la casilla IA del rol en Entradas.
            'coffeeia'         => IaOllama::activo($this) && Permissions::can('entradas', 'ia'),
            'sucursales'       => $this->lsSucursales(['company_id' => $this->companiesId, 'user_id' => $this->userId, 'is_owner' => (int) ($_SESSION['is_owner'] ?? 0)]),
            'almacenes'        => $this->lsWarehouses(['companies_id' => $this->companiesId]),
            'areas'            => $this->lsAreas([$this->companiesId]),
            'categorias'       => $this->lsCategorias([$this->companiesId]),
            'unidades'         => $this->lsUnidades([$this->companiesId]),
            'proveedores'      => $this->lsSuppliers([$this->companiesId]),
            'origenes_entrada' => $this->lsInflowOrigins([$this->companiesId]),
            'ajustes'          => array_column($this->qLastAdjustments([$this->companiesId]), 'last_date', 'warehouse_id'),
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
            $map = $this->stockConPresentaciones($map, $this->companiesId);
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
                'a'          => Permissions::rowActions('entradas', $a)
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
        $header['adjustment_date'] = $this->qLastAdjustmentDate([(int) $header['warehouse_id'], $this->companiesId]);
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
        if ($ajeno = $this->almacenAjeno($payload['warehouse_id'] ?? 0)) return $ajeno;

        if (!empty($payload['date_inflow']) && ($errorFecha = $this->fechaInvalida($payload['date_inflow']))) {
            return ['status' => 400, 'message' => $errorFecha];
        }
        if ($errorAjuste = $this->ajusteBloquea($payload['warehouse_id'] ?? 0, !empty($payload['date_inflow']) ? $payload['date_inflow'] : date('Y-m-d'))) {
            return ['status' => 400, 'message' => $errorAjuste];
        }
        if ($errorNeg = $this->renglonesNegativos($productos)) {
            return ['status' => 400, 'message' => $errorNeg];
        }

        // Caja 24 × 2 entra como 48 piezas de su base, a costo ÷ 24.
        $aBase = $this->renglonesABase($productos, $this->companiesId, ['cost', 'price_without_tax']);
        if ($aBase['error']) return ['status' => 400, 'message' => $aBase['error']];
        $productos = $aBase['productos'];

        $origin       = $this->getInflowOrigin([(int) $payload['inflow_origin_id'], $this->companiesId]);
        $isProduction = $origin && strtoupper($origin['code']) === 'PRODUCCION';
        $status       = $isProduction ? 'Pendiente' : 'Aplicada';

        // El origen exige proveedor segun la columna requires_supplier (por dato, no por code).
        if ($origin && (int) ($origin['requires_supplier'] ?? 0) === 1 && empty($payload['supplier_id'])) {
            return ['status' => 400, 'message' => 'Este origen requiere seleccionar un proveedor'];
        }

        $branchId = (int) ($payload['branch_id'] ?? $this->branchId);
        $folio    = $this->nextFolio('ENT-', 'inventory_inflow', $this->companiesId, $branchId);
        $norm     = $this->renglonesEntrada($productos);

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
            $this->folioFactura($payload),
            $totalProducts,
            $totalUnits,
            $totalCost,
            $totalBase,
            $status,
            (int) $payload['inflow_origin_id'],
            (int) $payload['warehouse_id'],
            !empty($payload['warehouse_area_id']) ? (int) $payload['warehouse_area_id'] : null,
            !empty($payload['supplier_id']) ? (int) $payload['supplier_id'] : null,
            $branchId,
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

        $this->costoPresentaciones($aBase['usadas']);

        return [
            'status'  => 200,
            'message' => $isProduction ? 'Orden de produccion registrada (pendiente de confirmar)' : 'Entrada registrada',
            'folio'   => $folio,
            'id'      => $inflowId,
            'pending' => $isProduction
        ];
    }

    // Folio de la factura con que llegó la entrada (opcional, hasta 50 caracteres); null si
    // viene vacío.
    private function folioFactura($payload) {
        return mb_substr(trim((string) ($payload['invoice_folio'] ?? '')), 0, 50) ?: null;
    }

    // El costo sin impuesto con que entró cada presentación queda como su último costo,
    // igual que el del producto (updateItemCost). Sin costo (producción) no se toca.
    private function costoPresentaciones($usadas) {
        foreach ($usadas as $u) {
            $base = (float) ($u['price_without_tax'] ?? 0);
            if ($base > 0) $this->updatePresentacionCosto([round($base, 4), $u['id'], $this->companiesId]);
        }
    }

    // Mensaje si algún renglón trae un número negativo (cantidad, costo, base o impuesto); null si no.
    private function renglonesNegativos($productos) {
        $campos = ['quantity' => 'La cantidad', 'cost' => 'El costo', 'price_without_tax' => 'El costo sin impuesto', 'tax' => 'El impuesto'];
        foreach ($productos as $p) {
            foreach ($campos as $campo => $nombre) {
                if (isset($p[$campo]) && $p[$campo] !== '' && (!is_numeric($p[$campo]) || (float) $p[$campo] < 0)) {
                    return "$nombre no puede ser negativo ni inválido (renglón de producto " . (int) ($p['product_id'] ?? 0) . ')';
                }
            }
        }
        return null;
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

        $errorFecha = $this->fechaInvalida($fecha) ?: $this->ajusteBloquea($almacen, $fecha);
        if ($errorFecha) return ['status' => 400, 'message' => $errorFecha];

        $tipo       = $this->getInflowOrigin([$origen, $this->companiesId]);
        $supplierId = (int) ($_POST['supplier_id'] ?? 0);
        $exige      = $tipo && (int) ($tipo['requires_supplier'] ?? 0) === 1;
        if ($exige && $supplierId <= 0) return ['status' => 400, 'message' => 'Este tipo de entrada requiere elegir un proveedor'];

        return [
            'status' => 200,
            'data'   => [
                'origen'       => $origen,
                'branch_id'    => $branchId,
                'warehouse_id' => $almacen,
                'fecha'        => $fecha,
                'supplier_id'  => $exige ? $supplierId : ''
            ]
        ];
    }

    function verifyEditPassword() {
        $id     = (int) $_POST['id'];
        $header = $this->qGetEntrada([$id]);
        if (!$header || (int) $header['companies_id'] !== $this->companiesId) {
            return ['status' => 404, 'message' => 'Entrada no encontrada'];
        }

        // Misma verificación que el login: users.password (bcrypt).
        $user  = $this->qUserPassword([$this->userId]);
        $pass  = str_replace("'", "", $_POST['password']);
        $valid = $user && !empty($user['password']) && password_verify($pass, $user['password']);
        if (!$valid) return ['status' => 401, 'message' => 'Contraseña incorrecta'];

        $_SESSION['inflow_edit'][$id] = time();
        return ['status' => 200, 'message' => 'OK'];
    }

    // Con un ajuste aplicado en el almacén, lo anterior a su fecha ya no se toca: ni
    // editar una entrada de esos días, ni pasarla a una fecha previa al ajuste, ni dar
    // de alta una nueva con esa fecha (el conteo dejaría de cuadrar).
    private function ajusteBloquea($warehouseId, $fecha) {
        $ajuste = $this->qLastAdjustmentDate([(int) $warehouseId, $this->companiesId]);
        $fecha  = substr((string) $fecha, 0, 10);
        if (!$ajuste || $fecha === '' || $fecha >= $ajuste) return null;

        return 'El almacén tuvo un ajuste el ' . date('d/m/Y', strtotime($ajuste))
             . ': no se puede usar una fecha anterior (' . date('d/m/Y', strtotime($fecha)) . ')';
    }

    private function editAuthorized($id) {
        $at = (int) ($_SESSION['inflow_edit'][$id] ?? 0);
        return $at > 0 && (time() - $at) <= self::EDIT_WINDOW;
    }

    // Una sucursal no mete stock en el almacén de otra: 403 si alguno de los almacenes no es
    // de las sucursales del usuario (el dueño pasa siempre). null si puede.
    private function almacenAjeno(...$almacenes) {
        foreach ($almacenes as $almacen) {
            if (!$this->almacenDeSusSucursales((int) $almacen)) {
                return ['status' => 403, 'message' => 'Ese almacén no es de tus sucursales: solo puedes registrar entradas en el tuyo'];
            }
        }
        return null;
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
        if ($ajeno = $this->almacenAjeno($header['warehouse_id'], $payload['warehouse_id'] ?? $header['warehouse_id'])) return $ajeno;
        if ($header['status'] === 'Cancelada') {
            return ['status' => 400, 'message' => 'No se puede editar una entrada cancelada'];
        }
        if (!empty($payload['date_inflow']) && ($errorFecha = $this->fechaInvalida($payload['date_inflow']))) {
            return ['status' => 400, 'message' => $errorFecha];
        }
        $errorAjuste = $this->ajusteBloquea($header['warehouse_id'], $header['date_inflow'])
            ?: $this->ajusteBloquea($payload['warehouse_id'] ?? $header['warehouse_id'], !empty($payload['date_inflow']) ? $payload['date_inflow'] : date('Y-m-d'));
        if ($errorAjuste) return ['status' => 400, 'message' => $errorAjuste];
        if (empty($productos)) {
            return ['status' => 400, 'message' => 'No se enviaron renglones'];
        }
        if ($errorNeg = $this->renglonesNegativos($productos)) {
            return ['status' => 400, 'message' => $errorNeg];
        }

        $aBase = $this->renglonesABase($productos, $this->companiesId, ['cost', 'price_without_tax']);
        if ($aBase['error']) return ['status' => 400, 'message' => $aBase['error']];
        $productos = $aBase['productos'];

        $origin = $this->getInflowOrigin([(int) $payload['inflow_origin_id'], $this->companiesId]);
        if ($origin && (int) ($origin['requires_supplier'] ?? 0) === 1 && empty($payload['supplier_id'])) {
            return ['status' => 400, 'message' => 'Este origen requiere seleccionar un proveedor'];
        }

        $aplicada    = $header['status'] === 'Aplicada';
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
                // Se quita exacto, sin tope en cero: si lo que entró ya salió, el tope dejaba
                // stock de más al volver a sumar los renglones.
                $oldDetail = $this->qGetEntradaDetail([$id]);
                if ($aplicada) {
                    foreach ($oldDetail as $d) {
                        $qty      = $d['confirmed_quantity'] !== null ? (float) $d['confirmed_quantity'] : (float) $d['quantity'];
                        $stockRow = $this->getStockRow([(int) $d['product_id'], $oldWarehouse]);
                        if ($stockRow) $this->updateStockQuantity([(float) $stockRow['quantity'] - $qty, (int) $stockRow['id']]);
                    }
                }

                $this->qDisableEntradaDetail([$id]);

                $this->updateEntradaHeader([
                    $payload['note'] ?? null,
                    $this->folioFactura($payload),
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

                // Lo capturado después de esta entrada traía el stock de antes de la edición.
                $pares = [];
                foreach ($oldDetail as $d) $pares[] = [$d['product_id'], $oldWarehouse];
                foreach ($norm as $p)      $pares[] = [$p['product_id'], $warehouse];
                $this->updateKardexChains($pares, $this->companiesId);
            });
        } catch (Throwable $e) {
            error_log('[updateEntrada] ' . $e->getMessage());
            return ['status' => 500, 'message' => 'No se guardó ningún cambio: la base de datos rechazó la edición'];
        }

        $this->costoPresentaciones($aBase['usadas']);

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
        if ($ajeno = $this->almacenAjeno($header['warehouse_id'])) return $ajeno;

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
        if ($ajeno = $this->almacenAjeno($header['warehouse_id'])) return $ajeno;
        if ($errorAjuste = $this->ajusteBloquea($header['warehouse_id'], $header['date_inflow'])) {
            return ['status' => 400, 'message' => $errorAjuste];
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
            $post     = $prev + $delta;

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

        $this->updateKardexChains(array_map(function ($d) use ($warehouse) {
            return [$d['product_id'], $warehouse];
        }, $detail), $this->companiesId);

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
        if ($ajeno = $this->almacenAjeno($header['warehouse_id'])) return $ajeno;

        $warehouse = (int) $header['warehouse_id'];
        $detail    = [];
        if ($header['status'] === 'Aplicada') {
            $detail = $this->qGetEntradaDetail([$id]);
            foreach ($detail as $d) {
                $productId = (int) $d['product_id'];
                $qty       = $d['confirmed_quantity'] !== null ? (float) $d['confirmed_quantity'] : (float) $d['quantity'];
                $stockRow  = $this->getStockRow([$productId, $warehouse]);
                if ($stockRow) {
                    $post = (float) $stockRow['quantity'] - $qty;
                    $this->updateStockQuantity([$post, (int) $stockRow['id']]);
                }
            }
        }

        $r = $this->qReverseEntrada([$id]);
        if ($r) unset($_SESSION['inflow_edit'][$id]);

        // Ya cancelada sale de la vista: lo que vino después se recalcula sin ella.
        if ($r) $this->updateKardexChains(array_map(function ($d) use ($warehouse) {
            return [$d['product_id'], $warehouse];
        }, $detail), $this->companiesId);

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
    // Un administrador también elimina entradas y reinicia el folio: el modelo solo
    // nombra folios, la vista previa sale de la BD y borrar pide su contraseña.
    const IA_MAX_CATALOGO  = 800;
    const IA_MAX_RENGLONES = 100;
    const IA_MAX_LISTA     = 100;
    const IA_MAX_BORRAR    = 200;

    // Debajo de este "seguro" (0 a 100) el renglón sale con aviso de letra dudosa.
    const IA_SEGURO = 85;

    function askEntradaIA() {
        if (empty($_SESSION['company_id'])) return ['status' => 401, 'message' => 'Tu sesión expiró. Vuelve a entrar.'];

        if (!IaOllama::activo($this)) return ['status' => 403, 'message' => 'CoffeeIA está apagado. Se enciende en Administrador > CoffeeIA.'];

        if (!Permissions::can('entradas', 'ia')) return ['status' => 403, 'message' => 'Tu rol no tiene CoffeeIA en Entradas. Se activa en Accesos › Roles, columna IA.'];

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
        $entradas = $this->esAdminIA() ? $this->listEntradasIA(['companies_id' => $this->companiesId, 'branch_ids' => $this->_userBranchIds()]) : null;

        // Sin esto la sesión queda bloqueada mientras el modelo piensa y la tabla de
        // entradas no puede recargar en ese rato.
        session_write_close();
        set_time_limit(180);

        $r = $ia->chatJson($this->mensajesEntradaIA($mensaje, $adjuntos, $historial, $catalogo, $entradas));
        if (!$r['ok']) return ['status' => 502, 'message' => $r['error']];

        $borrar = $entradas !== null ? $this->borrarEntradaIA($r['data']) : null;
        if ($borrar === null) return ['status' => 200] + $this->validarEntradaIA($r['data'], $catalogo);

        // La vista previa de eliminar queda en sesión: deleteEntradaIA solo borra lo de aquí.
        session_start();
        unset($_SESSION['iaEntradasBorrar']);
        if ($borrar['token'] !== '') $_SESSION['iaEntradasBorrar'] = ['token' => $borrar['token'], 'ids' => $borrar['ids']];
        unset($borrar['ids']);

        return ['status' => 200, 'borrar' => true] + $borrar;
    }

    // Borra de verdad lo que quedó en la vista previa, regresando el stock. Todo o nada.
    function deleteEntradaIA() {
        if (empty($_SESSION['company_id'])) return ['status' => 401, 'message' => 'Tu sesión expiró. Vuelve a entrar.'];
        if (!$this->esAdminIA()) return ['status' => 403, 'message' => 'Solo un administrador puede eliminar entradas.'];
        if (!Permissions::can('entradas', 'ia')) return ['status' => 403, 'message' => 'Tu rol no tiene CoffeeIA en Entradas. Se activa en Accesos › Roles, columna IA.'];

        $pendiente = $_SESSION['iaEntradasBorrar'] ?? null;
        $token     = (string) ($_POST['token'] ?? '');

        if (!is_array($pendiente) || $token === '' || !hash_equals((string) $pendiente['token'], $token)) {
            return ['status' => 409, 'message' => 'Esa vista previa ya no está vigente. Pídeme las entradas otra vez.'];
        }

        $ids = [];
        foreach ((array) json_decode((string) ($_POST['ids'] ?? '[]'), true) as $i) {
            if (is_numeric($i) && isset($pendiente['ids'][(int) $i])) $ids[] = (int) $pendiente['ids'][(int) $i];
        }
        $ids = array_values(array_unique($ids));

        if (empty($ids)) return ['status' => 400, 'message' => 'No marcaste ninguna entrada.'];

        // Misma verificación que el login: bcrypt con respaldo MD5 heredado.
        $user  = $this->qUserPassword([$this->userId]);
        $pass  = str_replace("'", "", (string) ($_POST['password'] ?? ''));
        $valid = $user && $pass !== '' && (
            (!empty($user['password']) && password_verify($pass, $user['password'])) ||
            (!empty($user['user_key']) && $user['user_key'] === md5($pass))
        );
        if (!$valid) return ['status' => 401, 'message' => 'Contraseña incorrecta'];

        // Se buscan otra vez: desde la vista previa pudieron borrarlas o ligarlas a un pedido.
        $vigentes = array_filter($this->listEntradasIA(['companies_id' => $this->companiesId, 'branch_ids' => $this->_userBranchIds(), 'ids' => $ids]), function ($e) {
            return $e['pedido'] === null;
        });
        if (empty($vigentes)) return ['status' => 409, 'message' => 'Esas entradas ya no están para eliminar.'];

        $folios = [];

        try {
            $this->transaction(function () use ($vigentes, &$folios) {
                foreach ($vigentes as $e) $folios[] = $this->deleteEntradaFullById((int) $e['id'], $this->companiesId);
            });
        } catch (\Throwable $e) {
            return ['status' => 500, 'message' => 'No se eliminó ninguna entrada: ' . $e->getMessage()];
        }

        unset($_SESSION['iaEntradasBorrar']);

        $n         = count($folios);
        $faltan    = count($ids) - $n;
        $aplicadas = count(array_filter($vigentes, function ($e) { return $e['status'] === 'Aplicada'; }));
        $message   = ($n === 1 ? 'Eliminé la entrada ' : "Eliminé {$n} entradas: ") . implode(', ', $folios) . '.';

        if ($aplicadas > 0) $message .= $aplicadas === 1 ? ' Resté del stock lo que sumó la aplicada.' : " Resté del stock lo que sumaron las {$aplicadas} aplicadas.";
        if ($faltan > 0)    $message .= $faltan === 1 ? ' 1 ya no estaba.' : " {$faltan} ya no estaban.";

        // Cada sucursal lleva su serie: el siguiente de cada una de las que se tocaron.
        $siguientes = array_map(function ($b) {
            return $this->nextFolio('ENT-', 'inventory_inflow', $this->companiesId, $b);
        }, array_values(array_unique(array_map('intval', array_column($vigentes, 'branch_id')))));

        return [
            'status'  => 200,
            'message' => $message . (count($siguientes) === 1 ? ' Siguiente folio: ' : ' Siguientes folios: ') . implode(', ', $siguientes) . '.',
            'data'    => ['folios' => $folios]
        ];
    }

    // Folio con el que la serie de la sucursal de sesión vuelve a empezar.
    private function primerFolioEntrada() {
        return 'ENT-' . $this->claveFolio($this->branchId, $this->companiesId) . '-0001';
    }

    private function esAdminIA() {
        return (int) ($_SESSION['is_admin'] ?? 0) === 1;
    }

    // `$entradas` = null para quien no es administrador: el modelo no ve la lista y
    // contesta que eliminar no es para él.
    private function mensajesEntradaIA($mensaje, $adjuntos, $historial, $catalogo, $entradas) {
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
            '- En la transcripción, una palabra con (?) pegado es letra dudosa y [ilegible] es lo que no se leyó.',
            '- "seguro" (0 a 100) en cada renglón de "items": qué tan seguro estás de que es ESE producto, contando letra dudosa, abreviaturas y faltas. 100 = se lee claro y coincide; menos de ' . self::IA_SEGURO . ' = lo elegiste por parecido.',
            '- Si "seguro" es menor que ' . self::IA_SEGURO . ', pon en "otros" hasta 2 productos más del catálogo que también se parezcan, cada uno con su "id" y su "seguro".',
            '- En "missing", si algún producto del catálogo se parece, ponlo en "parecido" con su "id" y su "seguro".',
            '- Si la persona solo pregunta o no hay productos, "items" y "missing" van vacíos y contestas en "reply".',
            '- No inventes productos ni cantidades. Un renglón que no se lee no se pone.',
            '- Si un producto aparece dos veces, suma las cantidades en un solo renglón.',
            '- "quantity": cantidad que llegó, como número. Si no se ve, 1.',
            '- "cost": costo unitario CON impuesto, como número sin $ ni comas. Si el documento trae el precio sin IVA y la tasa, súmale el IVA; si solo trae el importe del renglón, divídelo entre la cantidad. Si no hay precio, null.',
            '- Ignora totales, subtotales, impuestos, descuentos, propinas y los datos fiscales o del proveedor.',
            '- Como mucho ' . self::IA_MAX_RENGLONES . ' renglones entre "items" y "missing".',
            '',
            'Responde SOLO con un objeto JSON, sin texto antes ni después. La forma:',
            '{"reply": "Encontré 8 productos; 2 no están en el catálogo.", "items": [{"id": 45, "ref": "COCA COLA 600", "seguro": 98, "quantity": 12, "cost": 19.99}, {"id": 12, "ref": "AZUCAR MOR(?)", "seguro": 70, "otros": [{"id": 13, "seguro": 20}], "quantity": 2, "cost": null}], "missing": [{"name": "Salsa Valentina 1 L", "quantity": 3, "cost": 35.5, "parecido": {"id": 80, "seguro": 40}}]}',
            '',
            $this->reglasBorrarEntradaIA($entradas),
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

    // Eliminar y reiniciar el folio, con la lista de entradas que ve el modelo. Para
    // quien no es administrador, solo la regla de no hacerlo.
    private function reglasBorrarEntradaIA($entradas) {
        if ($entradas === null) {
            return '- Eliminar entradas o reiniciar folios solo lo hace un administrador. Si te lo piden, dilo en "reply" con "items" y "missing" vacíos.';
        }

        $filas = array_map(function ($e) {
            return implode(' | ', array_map(function ($v) {
                $v = trim(str_replace(["\r", "\n", '|'], [' ', ' ', '/'], (string) $v));
                return $v === '' ? '-' : $v;
            }, [
                $e['folio'],
                substr((string) ($e['date_inflow'] ?: $e['created_at']), 0, 10),
                $e['status'] . ((int) $e['active'] === 0 ? ' (oculta)' : ''),
                $e['origin_name'],
                $e['branch_name'],
                $e['warehouse_name'],
                $e['supplier_name'],
                number_format((float) $e['total_cost'], 2, '.', ''),
                $e['pedido'],
                mb_strimwidth((string) $e['note'], 0, 60, '…')
            ]));
        }, array_slice($entradas, 0, self::IA_MAX_LISTA));

        return implode("\n", [
            '== ELIMINAR Y REINICIAR EL FOLIO (eres administrador) ==',
            '- Cada sucursal tiene su propia serie de folios con su clave: ENT-KAF-0003 es la 3 de la sucursal con clave KAF.',
            '- Si la persona pide ELIMINAR entradas, pon sus folios completos en "eliminar", ej. ["' . $this->primerFolioEntrada() . '"]. Tómalos de la lista ENTRADAS; "la 3" es la 3 de la sucursal en la que está. No inventes folios.',
            '- Si pide REINICIAR EL FOLIO (que la siguiente vuelva a ' . $this->primerFolioEntrada() . '), pon "reiniciar": true. Es la serie de la sucursal en la que está: la vista previa trae TODAS sus entradas y el folio solo vuelve a empezar si se eliminan todas.',
            '- Al eliminar, "items" y "missing" van vacíos. Tú no eliminas: la persona revisa la vista previa y confirma con su contraseña. En "reply" di cuántas y que revise la vista previa; no digas que ya se eliminaron.',
            '- Eliminar borra la entrada de verdad y, si estaba aplicada, resta del stock lo que sumó. Una entrada que viene de un pedido (columna pedido) no se elimina aquí: va en Pedidos, junto con su pedido.',
            '- Si no queda claro cuáles, pregunta en "reply" y deja "eliminar" vacío.',
            'La forma al eliminar: {"reply": "Te preparo 2 entradas para eliminar.", "items": [], "missing": [], "eliminar": ["ENT-KAF-0003", "ENT-KAF-0004"], "reiniciar": false}',
            '',
            'ENTRADAS (folio | fecha | estado | tipo | sucursal | almacén | proveedor | total | pedido | nota), las ' . count($filas) . ' más recientes de ' . count($entradas) . ':',
            $filas ? implode("\n", $filas) : '(ninguna)'
        ]);
    }

    // Vista previa de eliminar si el modelo nombró folios o pidió reiniciar; null si no
    // (entonces es una captura). Las filas salen de la BD, no del modelo.
    private function borrarEntradaIA($data) {
        $reiniciar = is_array($data) && ($data['reiniciar'] ?? false) === true;
        $folios    = [];

        // ENT-KAF-0003 tal cual; sin clave ("3", "ENT-3") es de la sucursal de sesión.
        $clave = $this->claveFolio($this->branchId, $this->companiesId);
        foreach ((array) (is_array($data) ? ($data['eliminar'] ?? []) : []) as $v) {
            $v = strtoupper(preg_replace('/\s+/', '', is_scalar($v) ? (string) $v : ''));
            if (preg_match('/^ENT-([A-Z0-9]+)-(\d+)$/', $v, $m) || preg_match('/^(?:ENT-?)?()(\d+)$/', $v, $m)) {
                $folios[] = 'ENT-' . ($m[1] !== '' ? $m[1] : $clave) . '-' . str_pad((string) (int) $m[2], 4, '0', STR_PAD_LEFT);
            }
        }

        if (!$reiniciar && !$folios) return null;

        // Reiniciar es la serie de la sucursal de sesión: solo sus entradas.
        $alcance = ['companies_id' => $this->companiesId, 'branch_ids' => $reiniciar ? [$this->branchId] : $this->_userBranchIds()];
        $reply   = $this->textoEntradaIA($data['reply'] ?? '');

        $entradas = $this->listEntradasIA($alcance + ($reiniciar ? [] : ['folios' => array_values(array_unique($folios))]));

        if (!$entradas) {
            return ['reply' => $reiniciar ? 'No hay entradas en esta sucursal: el siguiente folio ya es ' . $this->primerFolioEntrada() . '.' : 'No encontré esas entradas.', 'token' => '', 'row' => [], 'ids' => []];
        }
        if (count($entradas) > self::IA_MAX_BORRAR) {
            return ['reply' => 'Son ' . count($entradas) . ' entradas; de una vez solo puedo eliminar ' . self::IA_MAX_BORRAR . '. Pídemelas por partes.', 'token' => '', 'row' => [], 'ids' => []];
        }

        $row = [];
        $ids = [];

        foreach ($entradas as $i => $e) {
            $libre  = $e['pedido'] === null;
            $origen = strpos((string) $e['pedido'], 'CP-') === 0 ? 'la compra' : 'el pedido';
            $nota   = trim((string) $e['note']);

            $row[] = [
                'idx'    => $i,
                'action' => $reiniciar ? 'reset' : 'delete',
                'valid'  => $libre,
                'name'   => $e['folio'],
                'tag'    => $e['status'] . ((int) $e['active'] === 0 ? ' · oculta' : ''),
                'detail' => implode(' · ', array_filter([
                    fechaHoraEntrada($e['date_inflow'], $e['created_at']),
                    $e['origin_name'],
                    $e['warehouse_name'],
                    '$' . number_format((float) $e['total_cost'], 2),
                    $nota !== '' ? '«' . mb_strimwidth($nota, 0, 60, '…') . '»' : ''
                ])),
                'warn'   => $libre && $e['status'] === 'Aplicada' ? 'Se resta del stock lo que sumó.' : '',
                'note'   => $libre ? '' : "Viene de {$origen} {$e['pedido']}: se elimina en Pedidos, junto con su pedido."
            ];

            $ids[$i] = (int) $e['id'];
        }

        $libres  = count(array_filter($row, function ($r) { return $r['valid']; }));
        $ligadas = count($row) - $libres;

        // Sin ninguna que se pueda borrar no hay vista previa que revisar: manda este aviso.
        if ($libres === 0) {
            $reply = 'Ninguna se puede eliminar aquí: ' . ($ligadas === 1 ? 'viene de un pedido' : 'vienen de pedidos') . '. Se eliminan en Pedidos, junto con su pedido.';
        } elseif ($reply === '') {
            $reply = $reiniciar
                ? 'Para que el folio vuelva a ' . $this->primerFolioEntrada() . ' hay que eliminar ' . ($libres === 1 ? 'la entrada' : "las {$libres} entradas") . '. Revisa la vista previa.'
                : ($libres === 1 ? 'Te preparé 1 entrada para eliminar. Revísala.' : "Te preparé {$libres} entradas para eliminar. Revísalas.");
        }
        if ($reiniciar && $ligadas > 0 && $libres > 0) {
            $reply .= "\n" . ($ligadas === 1 ? '1 viene de un pedido' : "{$ligadas} vienen de pedidos") . ': se eliminan en Pedidos, y mientras queden el folio no vuelve a ' . $this->primerFolioEntrada() . '.';
        }

        return ['reply' => $reply, 'token' => $libres ? bin2hex(random_bytes(8)) : '', 'row' => $row, 'ids' => $ids];
    }

    // Arma la vista previa del chat: "add" = producto del catálogo, "create" = no está
    // y se da de alta. Un id que no existe no entra como "add": pasa a "create".
    // Lo que no se leyó claro sale con aviso y el porcentaje de lo más parecido.
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
            $ref  = $this->textoEntradaIA($it['ref'] ?? '');

            if (!isset($porId[$id])) {
                $nombre = $this->sinDudaEntradaIA($ref);
                if ($nombre !== '') $missing[] = ['nombre' => $nombre, 'ref' => $ref, 'parecido' => null, 'cantidad' => $qty, 'costo' => $cost];
                continue;
            }

            $aviso = $this->avisoLetraIA($ref, $id, $it['seguro'] ?? null, $it['otros'] ?? [], $porId);

            if (isset($items[$id])) {
                $items[$id]['cantidad'] += $qty;
                if ($items[$id]['warn'] === '') $items[$id]['warn'] = $aviso;
                continue;
            }

            $items[$id] = ['id' => (string) $id, 'nombre' => $porId[$id]['nombre'], 'cantidad' => $qty, 'costo' => $cost, 'warn' => $aviso];
        }

        foreach (array_slice(is_array($data['missing'] ?? null) ? $data['missing'] : [], 0, self::IA_MAX_RENGLONES) as $m) {
            $ref    = is_array($m) ? $this->textoEntradaIA($m['name'] ?? '') : '';
            $nombre = $this->sinDudaEntradaIA($ref);
            if ($nombre === '') continue;

            $qty       = $this->numeroEntradaIA($m['quantity'] ?? null);
            $missing[] = ['nombre' => $nombre, 'ref' => $ref, 'parecido' => $m['parecido'] ?? null, 'cantidad' => $qty > 0 ? $qty : 1, 'costo' => $this->numeroEntradaIA($m['cost'] ?? null)];
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
                'warn'       => $it['warn'],
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
                'warn'     => $this->avisoFaltanteIA($m['ref'], $m['parecido'], $porId),
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

        $dudosos = count(array_filter($row, function ($r) { return $r['warn'] !== ''; }));
        if ($dudosos > 0) {
            $reply .= "\n" . ($dudosos === 1 ? 'Un renglón no lo leí claro' : "{$dudosos} renglones no los leí claro") . ': te dejé el porcentaje de lo más parecido. Revísalos antes de confirmar.';
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

    // -- Letra dudosa --

    // Aviso de un renglón del catálogo elegido por parecido: lo que se leyó, qué tan
    // seguro está el modelo (si no lo dijo, cuánto se parece lo leído al nombre) y los
    // otros candidatos. '' si se leyó claro.
    private function avisoLetraIA($ref, $id, $seguro, $otros, $porId) {
        $seguro = $this->seguroEntradaIA($seguro);
        if (!$this->tieneDudaIA($ref) && ($seguro === null || $seguro >= self::IA_SEGURO)) return '';

        $seguro    = $seguro ?? $this->parecidoEntradaIA($ref, $porId[$id]['nombre']);
        $aviso     = 'No estoy seguro de la letra' . ($ref !== '' ? ': leí «' . $ref . '»' : '') . ". Lo más parecido es este ({$seguro}%).";
        $alternos  = [];

        foreach (array_slice(is_array($otros) ? $otros : [], 0, 2) as $o) {
            $oid = is_array($o) ? (int) ($o['id'] ?? 0) : 0;
            if ($oid === $id || !isset($porId[$oid])) continue;

            $pct        = $this->seguroEntradaIA($o['seguro'] ?? null) ?? $this->parecidoEntradaIA($ref, $porId[$oid]['nombre']);
            $alternos[] = $porId[$oid]['nombre'] . " ({$pct}%)";
        }

        return $alternos ? $aviso . ' También podría ser ' . implode(' o ', $alternos) . '.' : $aviso;
    }

    // Lo que no está en el catálogo: si la letra venía dudosa o se parece a un producto
    // que sí está, se avisa antes de darlo de alta.
    private function avisoFaltanteIA($ref, $parecido, $porId) {
        $pid    = is_array($parecido) ? (int) ($parecido['id'] ?? 0) : 0;
        $partes = [];

        if ($this->tieneDudaIA($ref)) $partes[] = 'No estoy seguro de la letra: leí «' . $ref . '».';

        if (isset($porId[$pid])) {
            $pct      = $this->seguroEntradaIA($parecido['seguro'] ?? null) ?? $this->parecidoEntradaIA($ref, $porId[$pid]['nombre']);
            $partes[] = 'Lo más parecido en el catálogo: ' . $porId[$pid]['nombre'] . " ({$pct}%). Si es ese, desmárcalo y agrégalo desde la entrada.";
        }

        return implode(' ', $partes);
    }

    // "seguro" del modelo como entero de 0 a 100 (0.7 cuenta como 70); null si no lo mandó.
    private function seguroEntradaIA($v) {
        $n = $this->numeroEntradaIA($v);
        if ($n === null) return null;

        return (int) round(min(100, $n > 0 && $n < 1 ? $n * 100 : $n));
    }

    // Respaldo cuando el modelo no dio porcentaje: letras en común entre lo leído y el nombre.
    private function parecidoEntradaIA($ref, $nombre) {
        similar_text(mb_strtolower($this->sinDudaEntradaIA($ref), 'UTF-8'), mb_strtolower((string) $nombre, 'UTF-8'), $pct);

        return (int) round($pct);
    }

    private function tieneDudaIA($texto) {
        return strpos($texto, '(?)') !== false || stripos($texto, '[ilegible]') !== false;
    }

    // El nombre sin las marcas de la transcripción: así se da de alta el producto.
    private function sinDudaEntradaIA($texto) {
        return trim(preg_replace('/\s+/', ' ', str_ireplace(['(?)', '[ilegible]'], ' ', $texto)));
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

        // Una presentación del lote se guarda como su base (2 cajas de 24 = 48 piezas).
        $renglones = array_map(function ($p) {
            return ['product_id' => (string) ($p['id'] ?? $p['product_id'] ?? ''), 'quantity' => (float) ($p['cantidad'] ?? $p['quantity'] ?? 0)];
        }, $productos);
        $aBase = $this->renglonesABase($renglones, $this->companiesId, []);

        foreach ($aBase['productos'] as $p) {
            $itemId = (int) $p['product_id'];
            $qty    = (float) $p['quantity'];
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
echo json_encode(Permissions::guard('entradas', $opc, ctrl::PERMISSIONS) ?: $obj->{$opc}());
