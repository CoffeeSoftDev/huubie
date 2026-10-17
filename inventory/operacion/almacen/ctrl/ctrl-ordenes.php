<?php
require_once __DIR__ . '/../../../conf/_Session.php';
if (empty($_POST['opc'])) exit(0);

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

require_once '../mdl/mdl-ordenes.php';
require_once '../../../conf/coffeSoft.php';
require_once '../../../conf/_IaOllama.php';
require_once '../../../conf/_Permissions.php';

class ctrl extends mdl {

    public $companiesId;
    public $branchId;
    public $userId;

    // Hoy según MySQL (fechaHoraPedido); se consulta una vez por petición.
    private $hoyBd = null;

    public function __construct() {
        parent::__construct();
        $_POST += ['companies_id' => 0, 'branch_id' => 0, 'user_id' => 0];
        $this->companiesId = (int) ($_SESSION['company_id'] ?? $_POST['companies_id']);
        $this->branchId    = (int) ($_SESSION['branch_id']  ?? $_POST['branch_id']);
        $this->userId      = (int) ($_SESSION['user_id']    ?? $_POST['user_id']);
    }

    function init() {
        $productos = array_map(function ($producto) {
            return [
                'id'                => (string) $producto['id'],
                'sku'               => $producto['sku'] ?: '',
                'nombre'            => $producto['nombre'],
                'categoria'         => $producto['categoria'] ?: 'Sin categoría',
                // Semilla del renglon: ultimo costo de compra (con IVA, base sin
                // IVA y tasa de esa compra). El precio de venta no entra aqui.
                'costo'             => (float) $producto['costo'],
                'price_without_tax' => (float) $producto['costo_sin_iva'],
                'tax'               => (float) $producto['iva_compra'],
                'stock'             => 0,
                // Sobrenombres (Catálogo > Descripción): el buscador también los consulta.
                'descripcion'       => $producto['descripcion'] ?? '',
                'stock_max'         => (float) ($producto['stock_max'] ?? 0),
                'image'             => $producto['image'] ?? '',
                'presentacion'      => $producto['presentacion'] ?? '',
                'unit_id'           => !empty($producto['unit_id']) ? (string) $producto['unit_id'] : '',
                'icon'              => 'package',
                'bg'                => 'bg-gray-100',
                'color'             => 'text-gray-500'
            ];
        }, $this->qProductsForTransfer([$this->companiesId]));

        return [
            'status'        => 200,
            'companies_id'  => $this->companiesId,
            'branch_id'     => $this->branchId,
            'user_id'       => $this->userId,
            'is_admin'      => (int) ($_SESSION['is_admin'] ?? 0),
            // CoffeeIA de Pedidos puede eliminar: el ícono es para el administrador.
            'coffeeia'      => $this->esAdminIA() && IaOllama::activo($this),
            'sucursales'    => $this->lsSucursales(['company_id' => $this->companiesId, 'user_id' => $this->userId, 'is_owner' => (int) ($_SESSION['is_owner'] ?? 0)]),
            'almacenes'     => $this->lsWarehouses(['companies_id' => $this->companiesId]),
            // Para el alta exprés de producto del formulario.
            'categorias'    => $this->lsCategorias([$this->companiesId]),
            'unidades'      => $this->lsUnidades([$this->companiesId]),
            'productos'     => $productos,
            'estados_orden' => [
                ['id' => '',           'valor' => 'Todos los estados'],
                ['id' => 'Activas',    'valor' => 'Activas'],
                ['id' => 'Borrador',   'valor' => 'Borrador'],
                ['id' => 'Solicitada', 'valor' => 'Solicitada'],
                ['id' => 'Aprobada',   'valor' => 'Aprobada'],
                ['id' => 'Parcial',    'valor' => 'Parcial'],
                ['id' => 'Recibida',   'valor' => 'Recibida'],
                ['id' => 'Rechazada',  'valor' => 'Rechazada'],
                ['id' => 'Cancelada',  'valor' => 'Cancelada']
            ],
            // Mis entregas agrupa los estados (los grupos viven en qOrdenes).
            'estados_entrega' => [
                ['id' => '',           'valor' => 'Todos los estados'],
                ['id' => 'PorAtender', 'valor' => 'Por surtir'],
                ['id' => 'Aprobadas',  'valor' => 'Aprobada'],
                ['id' => 'Cerradas',   'valor' => 'Rechazada y Cancelada']
            ]
        ];
    }

    function lsOrdenes() {
        $_POST += ['vista' => 'pedidos', 'branch_id' => '', 'status' => '', 'fi' => '', 'ff' => '', 'q' => ''];

        $ordenes = $this->qOrdenes([
            'companies_id' => $this->companiesId,
            'vista'        => $_POST['vista'],
            'branch_id'    => $_POST['branch_id'],
            'status'       => $_POST['status'],
            'fi'           => $_POST['fi'],
            'ff'           => $_POST['ff'],
            'q'            => $_POST['q']
        ]);

        $__row = [];
        foreach ($ordenes as $orden) {
            $fila = [
                'id'               => $orden['id'],
                'Folio'            => $_POST['vista'] === 'entregas'
                    ? "<span class='whitespace-nowrap'>" . $this->puntoNueva($orden['status']) . $this->folioLink($orden['folio'], $orden['id']) . '</span>'
                    : $this->folioLink($orden['folio'], $orden['id']),
                'Fecha de pedido'  => $this->fechaHoraPedido($orden['date_order'], $orden['created_at']),
                'Entrega para'     => $this->entregaParaCell($orden['date_order']),
                'Solicita → Surte' => $this->rutaCell($orden),
                'Materiales'       => (int) $orden['total_products'],
                'Estado'           => $this->statusBadge($orden['status'])
            ];
            // $fila['Total']      = evaluar((float) $orden['total_cost']);
            $fila['a'] = [
                [
                    'class'   => 'inline-flex items-center justify-center w-9 h-9 p-2 text-[#9CA3AF] hover:text-blue-600 transition-colors cursor-pointer bg-transparent border-0',
                    'html'    => '<i data-lucide="eye" class="w-4 h-4"></i>',
                    'attr'    => ['title' => 'Ver detalle'],
                    'onclick' => "app.selectOrden('{$orden['folio']}', {$orden['id']})"
                ]
            ];

            $__row[] = $fila;
        }

        return ['status' => 200, 'row' => $__row, 'thead' => ''];
    }

    function getOrden() {
        $id     = (int) $_POST['id'];
        $header = $this->qGetOrden([$id]);
        if (!$header) return ['status' => 404, 'message' => 'Pedido no encontrado'];

        $header['status_badge'] = $this->statusBadge($header['status']);
        $detail = $this->qGetOrdenDetail([$id]);
        return ['status' => 200, 'header' => $header, 'detail' => $detail];
    }

    function createSupplier() {
        $_POST += ['name' => '', 'contact_name' => '', 'phone' => '', 'email' => ''];

        $name = trim($_POST['name']);
        if ($name === '') {
            return ['status' => 400, 'message' => 'El nombre del proveedor es obligatorio'];
        }

        $existing = $this->findSupplierByName([$this->companiesId, $name]);
        if ($existing) {
            return [
                'status'  => 200,
                'message' => 'El proveedor ya existía, se reutilizó',
                'id'      => (int) $existing['id'],
                'valor'   => $existing['name'],
                'existed' => true
            ];
        }

        $ok = $this->insertSupplier([
            $name,
            trim($_POST['contact_name']) ?: null,
            trim($_POST['phone']) ?: null,
            trim($_POST['email']) ?: null,
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

    // Formulario previo de "Nuevo pedido": Solicitar a (obligatoria) y la fecha en que se
    // necesitan los insumos (sin tope hacia adelante). El almacén lo elige quien surte al aprobar.
    function verifyNuevaOrden() {
        $branchId   = (int) ($_POST['branch_id'] ?? 0);
        $fecha      = trim((string) ($_POST['date_order'] ?? ''));
        $sucursales = $this->_userBranchIds();

        if ($branchId <= 0 || ($sucursales && !in_array($branchId, $sucursales, true))) {
            return ['status' => 400, 'message' => 'Elige una de tus sucursales'];
        }

        if ($fecha === '') return ['status' => 400, 'message' => 'Selecciona la fecha en que necesitas tus insumos'];

        $errorFecha = $this->fechaInvalida($fecha);
        if ($errorFecha) return ['status' => 400, 'message' => $errorFecha];

        return [
            'status' => 200,
            'data'   => [
                'branch_id' => $branchId,
                'fecha'     => $fecha
            ]
        ];
    }

    function saveOrden() {
        $_POST += ['payload' => '[]'];

        $payload   = json_decode($_POST['payload'], true);
        $productos = $payload['productos'] ?? [];

        if (empty($productos)) {
            return ['status' => 400, 'message' => 'No se enviaron renglones'];
        }

        $submit = !empty($payload['submit']);
        $status = $submit ? 'Solicitada' : 'Borrador';
        $folio  = $this->nextFolio('OC-', 'purchase_order', $this->companiesId);

        // El costo con impuesto es el pivote; la base sin impuesto se deriva.
        // Si el solicitante no manda costo, los campos de costo quedan null.
        $norm = [];
        foreach ($productos as $producto) {
            $tax  = ($producto['tax']  ?? '') === '' || $producto['tax']  === null ? 0.0  : (float) $producto['tax'];
            $base = ($producto['price_without_tax'] ?? '') === '' || $producto['price_without_tax'] === null ? null : (float) $producto['price_without_tax'];
            $cost = ($producto['cost'] ?? '') === '' || $producto['cost'] === null ? null : (float) $producto['cost'];

            if ($cost !== null) {
                $base = $tax > 0 ? $cost / (1 + $tax / 100) : $cost;
            } elseif ($base !== null) {
                $cost = $base + ($base * $tax / 100);
                $base = $tax > 0 ? $cost / (1 + $tax / 100) : $cost;
            }

            $norm[] = [
                'product_id'        => (int) $producto['product_id'],
                'quantity'          => (float) $producto['quantity'],
                'price_without_tax' => $base,
                'tax'               => $tax,
                'cost'              => $cost,
                'unit_id'           => !empty($producto['unit_id']) ? (int) $producto['unit_id'] : null,
                'note'              => trim((string) ($producto['note'] ?? '')) ?: null
            ];
        }

        $totalProducts = count($norm);
        $totalUnits    = 0;
        $totalCost     = 0.0;
        $totalBase     = 0.0;
        foreach ($norm as $renglon) {
            $totalUnits += $renglon['quantity'];
            if ($renglon['cost'] !== null) {
                $totalCost += $renglon['quantity'] * $renglon['cost'];
            }
            if ($renglon['price_without_tax'] !== null) {
                $totalBase += $renglon['quantity'] * $renglon['price_without_tax'];
            }
        }

        $ok = $this->insertOrden([
            $folio,
            !empty($payload['supplier_id'])   ? (int) $payload['supplier_id']   : null,
            (int) ($payload['branch_id']       ?? $this->branchId),
            !empty($payload['destination_branch_id']) ? (int) $payload['destination_branch_id'] : null,
            !empty($payload['warehouse_id'])  ? (int) $payload['warehouse_id']  : null,
            !empty($payload['date_order'])    ? $payload['date_order']           : date('Y-m-d'),
            !empty($payload['expected_date']) ? $payload['expected_date']        : null,
            $payload['note'] ?? null,
            $totalProducts,
            $totalUnits,
            $totalCost,
            $totalBase,
            $status,
            $this->userId,
            $this->companiesId
        ]);

        if (!$ok) return ['status' => 500, 'message' => 'No se pudo registrar el pedido'];

        // _CUD no devuelve el id generado; se recupera por folio.
        $ordenRow = $this->_Read(
            "SELECT id FROM {$this->bd}purchase_order WHERE folio = ? AND companies_id = ? LIMIT 1",
            [$folio, $this->companiesId]
        );
        $ordenId = (int) ($ordenRow[0]['id'] ?? 0);

        foreach ($norm as $renglon) {
            $subtotal = ($renglon['cost'] !== null) ? $renglon['quantity'] * $renglon['cost'] : 0.0;
            $this->insertOrdenDetail([
                $ordenId,
                $renglon['product_id'],
                $renglon['unit_id'],
                $renglon['quantity'],
                $renglon['price_without_tax'],
                $renglon['tax'],
                $renglon['cost'],
                $subtotal,
                $renglon['note']
            ]);
        }

        return [
            'status'  => 200,
            'message' => $submit ? 'Pedido enviado' : 'Borrador guardado',
            'folio'   => $folio,
            'id'      => $ordenId,
            'pending' => !$submit
        ];
    }

    // Estrategia edit: soft-delete de renglones anteriores + reinsercion.
    // Garantiza quantity_received = 0 en renglones nuevos (OC no aprobada).
    function editOrden() {
        $_POST += ['payload' => '[]'];

        $id     = (int) $_POST['id'];
        $header = $this->qGetOrden([$id]);

        if (!$header) {
            return ['status' => 404, 'message' => 'Pedido no encontrado'];
        }
        if (!in_array($header['status'], ['Borrador', 'Solicitada'], true)) {
            return ['status' => 400, 'message' => 'Solo se puede editar un pedido en estado Borrador o Solicitada'];
        }
        if ($header['status'] === 'Solicitada' && !$this->editAuthorized($id)) {
            return ['status' => 403, 'message' => 'Confirma tu contraseña para editar el pedido'];
        }

        $payload   = json_decode($_POST['payload'], true);
        $productos = $payload['productos'] ?? [];

        if (empty($productos)) {
            return ['status' => 400, 'message' => 'No se enviaron renglones'];
        }

        $this->softDeleteOrdenDetails([$id]);

        $norm = [];
        foreach ($productos as $producto) {
            $tax  = ($producto['tax']  ?? '') === '' || $producto['tax']  === null ? 0.0  : (float) $producto['tax'];
            $base = ($producto['price_without_tax'] ?? '') === '' || $producto['price_without_tax'] === null ? null : (float) $producto['price_without_tax'];
            $cost = ($producto['cost'] ?? '') === '' || $producto['cost'] === null ? null : (float) $producto['cost'];

            if ($cost !== null) {
                $base = $tax > 0 ? $cost / (1 + $tax / 100) : $cost;
            } elseif ($base !== null) {
                $cost = $base + ($base * $tax / 100);
                $base = $tax > 0 ? $cost / (1 + $tax / 100) : $cost;
            }

            $norm[] = [
                'product_id'        => (int) $producto['product_id'],
                'quantity'          => (float) $producto['quantity'],
                'price_without_tax' => $base,
                'tax'               => $tax,
                'cost'              => $cost,
                'unit_id'           => !empty($producto['unit_id']) ? (int) $producto['unit_id'] : null,
                'note'              => trim((string) ($producto['note'] ?? '')) ?: null
            ];
        }

        $totalProducts = count($norm);
        $totalUnits    = 0;
        $totalCost     = 0.0;
        $totalBase     = 0.0;
        foreach ($norm as $renglon) {
            $totalUnits += $renglon['quantity'];
            if ($renglon['cost'] !== null) {
                $totalCost += $renglon['quantity'] * $renglon['cost'];
            }
            if ($renglon['price_without_tax'] !== null) {
                $totalBase += $renglon['quantity'] * $renglon['price_without_tax'];
            }
        }

        foreach ($norm as $renglon) {
            $subtotal = ($renglon['cost'] !== null) ? $renglon['quantity'] * $renglon['cost'] : 0.0;
            $this->insertOrdenDetail([
                $id,
                $renglon['product_id'],
                $renglon['unit_id'],
                $renglon['quantity'],
                $renglon['price_without_tax'],
                $renglon['tax'],
                $renglon['cost'],
                $subtotal,
                $renglon['note']
            ]);
        }

        $this->updateOrdenTotals([$totalProducts, $totalUnits, $totalCost, $totalBase, $id]);

        // Si el payload incluye campos de cabecera opcionales, se actualizan.
        if (!empty($payload['supplier_id']) || isset($payload['warehouse_id']) || isset($payload['note']) || isset($payload['destination_branch_id']) || !empty($payload['branch_id']) || !empty($payload['date_order'])) {
            $fields = [];
            $vals   = [];
            // branch_id ("Solicitar a") y date_order solo se tocan si traen valor real (NOT NULL en BD).
            if (!empty($payload['branch_id']))            { $fields[] = 'branch_id = ?';            $vals[] = (int) $payload['branch_id']; }
            if (!empty($payload['date_order']))           { $fields[] = 'date_order = ?';           $vals[] = $payload['date_order']; }
            if (isset($payload['supplier_id']))           { $fields[] = 'supplier_id = ?';           $vals[] = !empty($payload['supplier_id']) ? (int) $payload['supplier_id'] : null; }
            if (isset($payload['destination_branch_id'])) { $fields[] = 'destination_branch_id = ?'; $vals[] = !empty($payload['destination_branch_id']) ? (int) $payload['destination_branch_id'] : null; }
            if (isset($payload['warehouse_id']))          { $fields[] = 'warehouse_id = ?';          $vals[] = !empty($payload['warehouse_id']) ? (int) $payload['warehouse_id'] : null; }
            if (isset($payload['note']))                  { $fields[] = 'note = ?';                  $vals[] = $payload['note']; }
            if (isset($payload['expected_date']))         { $fields[] = 'expected_date = ?';         $vals[] = $payload['expected_date'] ?: null; }
            if (!empty($fields)) {
                $vals[] = $id;
                $this->_CUD(
                    "UPDATE {$this->bd}purchase_order SET " . implode(', ', $fields) . ", updated_at = NOW() WHERE id = ?",
                    $vals
                );
            }
        }

        unset($_SESSION['orden_edit'][$id]);

        return [
            'status'  => 200,
            'message' => 'Pedido actualizado',
            'id'      => $id
        ];
    }

    // Editar un pedido Solicitada pide la contraseña de quien está en sesión; la
    // autorización dura EDIT_WINDOW segundos y editOrden la consume.
    const EDIT_WINDOW = 1800;

    function verifyEditPassword() {
        $id     = (int) $_POST['id'];
        $header = $this->qGetOrden([$id]);
        if (!$header) return ['status' => 404, 'message' => 'Pedido no encontrado'];

        // Misma verificación que el login: users.password (bcrypt).
        $user  = $this->qUserPassword([$this->userId]);
        $pass  = str_replace("'", "", $_POST['password']);
        $valid = $user && !empty($user['password']) && password_verify($pass, $user['password']);
        if (!$valid) return ['status' => 401, 'message' => 'Contraseña incorrecta'];

        $_SESSION['orden_edit'][$id] = time();
        return ['status' => 200, 'message' => 'OK'];
    }

    private function editAuthorized($id) {
        $at = (int) ($_SESSION['orden_edit'][$id] ?? 0);
        return $at > 0 && (time() - $at) <= self::EDIT_WINDOW;
    }

    function submitOrden() {
        $id     = (int) $_POST['id'];
        $header = $this->qGetOrden([$id]);

        if (!$header) return ['status' => 404, 'message' => 'Pedido no encontrado'];
        if ($header['status'] !== 'Borrador') {
            return ['status' => 400, 'message' => 'Solo se puede enviar un pedido en estado Borrador'];
        }

        $ok = $this->updateOrdenStatus(['Solicitada', $id]);
        return [
            'status'  => $ok ? 200 : 500,
            'message' => $ok ? 'Solicitud enviada para aprobación' : 'No se pudo actualizar el estado'
        ];
    }

    // Aprobar = surtir. `items` = {renglón: cantidad a entregar} de lo que el almacenista
    // dejó marcado: lo demás sale del pedido (los totales se recalculan) y lo marcado se
    // descuenta del almacén en ese momento. Si el stock no alcanza se surte igual y el
    // faltante queda en un reabasto (REAB-) con la fecha compromiso, como en surtir().
    // `reabasto` = '0' cuando el almacenista solo surte: se entrega todo lo marcado sin generar REAB-.
    // `salida` = 'manual' aprueba sin llamar a surtir(): sin salida SI-, sin descuento y sin REAB-;
    // el pedido queda Aprobada y se surte después con el botón Surtir. 'auto' (omisión) surte como siempre.
    function approveOrden() {
        $_POST += ['items' => '{}', 'note' => '', 'warehouse_id' => 0, 'expected_date' => '', 'reabasto' => '1', 'salida' => 'auto', 'vista' => ''];

        $salida = (string) $_POST['salida'];
        if (!in_array($salida, ['auto', 'manual'], true)) {
            return ['status' => 400, 'message' => 'Elige si la salida de almacén es automática o manual'];
        }

        $id     = (int) $_POST['id'];
        $header = $this->qGetOrden([$id]);

        if (!$header) return ['status' => 404, 'message' => 'Pedido no encontrado'];
        if ($header['status'] !== 'Solicitada') {
            return ['status' => 400, 'message' => 'Solo se puede aprobar un pedido en estado Solicitada'];
        }
        if (!$this->puedeGestionarDestino($header)) {
            return ['status' => 403, 'message' => 'Solo la sucursal de destino puede aprobar esta solicitud'];
        }
        if ($_POST['vista'] !== 'entregas' && $this->esCreadorPedido($header)) {
            return ['status' => 403, 'message' => 'No puedes aprobar ni surtir un pedido que tú hiciste'];
        }

        $detalle = $this->qGetOrdenDetail([$id]);
        $byId    = [];
        foreach ($detalle as $renglon) $byId[(string) $renglon['id']] = $renglon;

        $items = json_decode($_POST['items'], true);
        $items = is_array($items) ? array_intersect_key(array_filter($items, function ($qty) { return (float) $qty > 0; }), $byId) : [];
        if (empty($items)) return ['status' => 400, 'message' => 'Selecciona al menos un producto para aprobar'];

        $warehouseId = (int) $_POST['warehouse_id'] ?: (int) $header['warehouse_id'];
        if ($warehouseId <= 0) return ['status' => 400, 'message' => 'Elige el almacén del que se surte'];

        $compromiso = trim((string) $_POST['expected_date']);
        if ($compromiso !== '' && ($error = $this->compromisoInvalido($compromiso))) {
            return ['status' => 400, 'message' => $error];
        }

        $conSalida = $salida === 'auto';
        $reasonId  = $this->getShrinkageReasonId(['SURTIDO_SUC']);
        if ($conSalida && !$reasonId) return ['status' => 500, 'message' => 'Falta configurar el motivo de salida (SURTIDO_SUC)'];

        $note        = mb_substr(trim($_POST['note']), 0, 255) ?: null;
        $conReabasto = $conSalida && (string) $_POST['reabasto'] !== '0';

        try {
            return $this->transaction(function () use ($id, $header, $detalle, $byId, $items, $warehouseId, $compromiso, $reasonId, $note, $conReabasto, $conSalida) {
                $unidades = 0;
                $costo    = 0.0;
                $base     = 0.0;
                foreach ($detalle as $renglon) {
                    if (!isset($items[$renglon['id']])) {
                        if (!$this->softDeleteDetailRow([(int) $renglon['id'], $id])) throw new Exception('No se pudo quitar un producto del pedido');
                        continue;
                    }
                    $unidades += (float) $renglon['quantity_ordered'];
                    $costo    += (float) $renglon['quantity_ordered'] * (float) $renglon['cost'];
                    $base     += (float) $renglon['quantity_ordered'] * (float) $renglon['price_without_tax'];
                }

                if (!$this->updateOrdenTotals([count($items), $unidades, $costo, $base, $id])) throw new Exception('No se pudieron actualizar los totales');
                if (!$this->updateOrdenStatusApprove(['Aprobada', $this->userId, $note, $id])) throw new Exception('No se pudo aprobar el pedido');

                if (!$conSalida) {
                    return [
                        'status'         => 200,
                        'message'        => 'Pedido aprobado sin salida de almacén. Surte la solicitud después con el botón Surtir de su detalle.',
                        'salida_folio'   => null,
                        'reabasto_folio' => null,
                        'orden_status'   => 'Aprobada'
                    ];
                }

                $r = $this->surtir($id, $header, $warehouseId, $items, $byId, $reasonId, $compromiso, 'Surtido de solicitud ' . $header['folio'], $conReabasto);
                // La salida SI- se consulta en Salidas: el aviso lo dice junto a su folio.
                $r['message'] = 'Pedido aprobado. ' . str_replace("salida {$r['salida_folio']},", "salida {$r['salida_folio']} (en Salidas),", $r['message']);
                return $r;
            });
        } catch (\Throwable $e) {
            return ['status' => 500, 'message' => 'No se pudo aprobar el pedido: ' . $e->getMessage()];
        }
    }

    // Editar compromiso del reabasto (REAB-): fecha en que se espera registrar la compra.
    function updateCompromiso() {
        $_POST += ['expected_date' => ''];

        $id     = (int) $_POST['id'];
        $header = $this->qGetOrden([$id]);

        if (!$header) return ['status' => 404, 'message' => 'Pedido no encontrado'];
        if (strpos((string) $header['folio'], 'REAB-') !== 0 || !in_array($header['status'], ['Aprobada', 'Parcial'], true)) {
            return ['status' => 400, 'message' => 'Solo un reabasto pendiente de recibir lleva fecha compromiso'];
        }

        $fecha = trim((string) $_POST['expected_date']);
        $error = $this->compromisoInvalido($fecha);
        if ($error) return ['status' => 400, 'message' => $error];

        $ok = $this->updateOrdenCompromiso([$fecha, $this->userId, $id]);
        return [
            'status'  => $ok ? 200 : 500,
            'message' => $ok ? 'Fecha compromiso guardada' : 'No se pudo guardar la fecha compromiso'
        ];
    }

    function rejectOrden() {
        $_POST += ['reason' => ''];

        $id     = (int) $_POST['id'];
        $header = $this->qGetOrden([$id]);

        if (!$header) return ['status' => 404, 'message' => 'Pedido no encontrado'];
        if ($header['status'] !== 'Solicitada') {
            return ['status' => 400, 'message' => 'Solo se puede rechazar un pedido en estado Solicitada'];
        }
        if (!$this->puedeGestionarDestino($header)) {
            return ['status' => 403, 'message' => 'Solo la sucursal de destino puede rechazar esta solicitud'];
        }

        $reason = trim($_POST['reason']);
        $ok = $this->updateOrdenStatusReject([$this->userId, $reason ?: null, $id]);
        return [
            'status'  => $ok ? 200 : 500,
            'message' => $ok ? 'Pedido rechazado' : 'No se pudo rechazar el pedido'
        ];
    }

    function receiveOrden() {
        $_POST += ['warehouse_id' => 0, 'items' => '{}', 'note' => '', 'costs' => '{}'];

        $id     = (int) $_POST['id'];
        $header = $this->qGetOrden([$id]);

        if (!$header) return ['status' => 404, 'message' => 'Pedido no encontrado'];
        if (!in_array($header['status'], ['Aprobada', 'Parcial'], true)) {
            return ['status' => 400, 'message' => 'Solo se puede recibir una orden Aprobada o Parcial'];
        }

        $warehouseId = $_POST['warehouse_id'] ? (int) $_POST['warehouse_id'] : (int) $header['warehouse_id'];

        if ($warehouseId <= 0) {
            return ['status' => 400, 'message' => 'Se requiere un almacén de destino para recibir la orden'];
        }

        if (empty($header['warehouse_id'])) {
            $this->updateOrdenWarehouse([$warehouseId, $id]);
        }

        $items = json_decode($_POST['items'], true);
        if (!is_array($items) || empty($items)) {
            return ['status' => 400, 'message' => 'No se indicaron materiales a recibir'];
        }

        $detalle = $this->qGetOrdenDetail([$id]);
        if (empty($detalle)) return ['status' => 400, 'message' => 'La orden no tiene renglones'];

        // Costo con IVA corregido con el precio de la factura, por renglon de la orden.
        $costs = json_decode($_POST['costs'], true);
        if (!is_array($costs)) $costs = [];

        // Valida y clampea cada cantidad al pendiente real del renglon.
        $toReceive = [];
        foreach ($detalle as $renglon) {
            $detailId = (string) $renglon['id'];
            if (!array_key_exists($detailId, $items)) continue;

            $pending = (float) $renglon['quantity_ordered'] - (float) $renglon['quantity_received'];
            if ($pending <= 0) continue;

            $qtyNow = max(0, min((float) $items[$detailId], $pending));
            if ($qtyNow <= 0) continue;

            // Lo recibido (entrada y último costo del producto) toma el costo de la factura;
            // la orden conserva el costo con que se pidió.
            if (isset($costs[$detailId]) && is_numeric($costs[$detailId]) && (float) $costs[$detailId] >= 0) {
                $tax  = $renglon['tax'] !== null ? (float) $renglon['tax'] : 0.0;
                $cost = (float) $costs[$detailId];

                $renglon['cost']              = $cost;
                $renglon['price_without_tax'] = $tax > 0 ? $cost / (1 + $tax / 100) : $cost;
            }

            $toReceive[] = array_merge($renglon, ['qty_now' => $qtyNow]);
        }

        if (empty($toReceive)) {
            return ['status' => 400, 'message' => 'No hay cantidades válidas a recibir o todos los renglones ya están completos'];
        }

        $entFolio = $this->nextFolio('ENT-', 'inventory_inflow', $this->companiesId);
        $note     = trim($_POST['note']) ?: 'Recepción de OC ' . $header['folio'];

        $totalProds = count($toReceive);
        $totalUnits = 0;
        $totalCost  = 0.0;
        $totalBase  = 0.0;
        foreach ($toReceive as $linea) {
            $cost = $linea['cost'] !== null ? (float) $linea['cost'] : 0.0;
            $base = $linea['price_without_tax'] !== null ? (float) $linea['price_without_tax'] : 0.0;
            $totalUnits += $linea['qty_now'];
            $totalCost  += $linea['qty_now'] * $cost;
            $totalBase  += $linea['qty_now'] * $base;
        }

        $originId = 1; // inflow_origin COMPRA

        $okInflow = $this->insertInflowFromOrden([
            $entFolio,
            $note,
            $totalProds,
            $totalUnits,
            $totalCost,
            $totalBase,
            'Aplicada',
            $originId,
            $warehouseId,
            $header['supplier_id'] ?: null,
            $header['branch_id'],
            $this->userId,
            $this->companiesId,
            date('Y-m-d'),
            $id
        ]);

        if (!$okInflow) return ['status' => 500, 'message' => 'No se pudo crear la entrada de inventario'];

        $inflowRow = $this->_Read(
            "SELECT id FROM {$this->bd}inventory_inflow WHERE folio = ? AND companies_id = ? LIMIT 1",
            [$entFolio, $this->companiesId]
        );
        $inflowId = (int) ($inflowRow[0]['id'] ?? 0);

        if ($inflowId <= 0) return ['status' => 500, 'message' => 'No se pudo recuperar la entrada generada'];

        foreach ($toReceive as $r) {
            $productId = (int) $r['product_id'];
            $qtyNow    = $r['qty_now'];
            $cost      = $r['cost'] !== null ? (float) $r['cost'] : 0.0;
            $base      = $r['price_without_tax'] !== null ? (float) $r['price_without_tax'] : 0.0;
            $tax       = $r['tax'] !== null ? (float) $r['tax'] : 0.0;
            $subtotal  = $qtyNow * $cost;

            $stockRow = $this->getStockRow([$productId, $warehouseId]);
            $prev     = $stockRow ? (float) $stockRow['quantity'] : 0.0;
            $post     = $prev + $qtyNow;

            $this->insertInflowDetail([
                $qtyNow,
                $cost,
                $subtotal,
                $base,
                $tax,
                $prev,
                $post,
                $productId,
                $inflowId,
                $linea['unit_id'] ?: null
            ]);

            if ($base > 0) {
                $this->updateItemCost([$base, $tax, $productId, $this->companiesId]);
            }

            if ($stockRow) {
                $this->updateStockQuantity([$post, (int) $stockRow['id']]);
            } else {
                $this->insertStockRow([$post, $warehouseId, $productId, $this->companiesId]);
            }

            $this->updateDetailReceived([$qtyNow, (int) $r['id']]);
        }

        $detailUpdated = $this->qGetOrdenDetail([$id]);
        $allReceived   = true;
        $anyReceived   = false;
        foreach ($detailUpdated as $d) {
            if ((float) $d['quantity_received'] > 0) $anyReceived = true;
            if ((float) $d['quantity_received'] < (float) $d['quantity_ordered']) $allReceived = false;
        }

        $newStatus = $allReceived ? 'Recibida' : ($anyReceived ? 'Parcial' : $header['status']);
        $this->updateOrdenStatus([$newStatus, $id]);

        $udsTxt = (fmod($totalUnits, 1) == 0) ? (string) (int) $totalUnits : (string) round($totalUnits, 2);

        return [
            'status'        => 200,
            'message'       => "Recepción registrada: entrada {$entFolio} generada, {$totalProds} materiales, {$udsTxt} uds. Orden ahora {$newStatus}",
            'entrada_folio' => $entFolio,
            'orden_status'  => $newStatus
        ];
    }

    // Las entradas generadas en recepciones parciales previas NO se revierten al cancelar;
    // solo se bloquea seguir recibiendo contra esta OC.
    function cancelOrden() {
        $id     = (int) $_POST['id'];
        $header = $this->qGetOrden([$id]);

        if (!$header) return ['status' => 404, 'message' => 'Pedido no encontrado'];
        if ($header['status'] === 'Recibida') {
            return ['status' => 400, 'message' => 'No se puede cancelar un pedido ya recibido completamente'];
        }
        if ($header['status'] === 'Cancelada') {
            return ['status' => 400, 'message' => 'El pedido ya está cancelado'];
        }

        $ok = $this->updateOrdenStatus(['Cancelada', $id]);
        return [
            'status'  => $ok ? 200 : 500,
            'message' => $ok ? 'Pedido cancelado' : 'No se pudo cancelar el pedido'
        ];
    }

    function printOrden() {
        $id     = (int) $_POST['id'];
        $header = $this->qGetOrden([$id]);
        if (!$header) return ['status' => 404, 'message' => 'Pedido no encontrado'];

        $header['status_badge'] = $this->statusBadge($header['status']);
        $detail = $this->qGetOrdenDetail([$id]);
        return ['status' => 200, 'header' => $header, 'detail' => $detail];
    }

    // Solo la sucursal destino puede aprobar/rechazar solicitudes inter-sucursal.
    // Si la orden no tiene destino definido o es mono-sucursal, no se restringe.
    private function fechaInvalida($fecha) {
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', (string) $fecha) || !strtotime($fecha)) return 'Elige una fecha válida';
        if ($fecha < date('Y-m-d', strtotime('-1 month'))) return 'La fecha no puede ser de hace más de un mes';

        return null;
    }

    private function compromisoInvalido($fecha) {
        if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $fecha) || !strtotime($fecha)) return 'Elige una fecha compromiso válida';
        if ($fecha < date('Y-m-d')) return 'La fecha compromiso no puede ser anterior a hoy';

        return null;
    }

    // Sucursales del usuario (las del select); el dueño no tiene restricción.
    private function _userBranchIds() {
        if ((int) ($_SESSION['is_owner'] ?? 0) === 1) return [];

        $ids = array_map(function ($s) { return (int) $s['id']; }, $this->lsSucursales([
            'company_id' => $this->companiesId,
            'user_id'    => $this->userId,
            'is_owner'   => 0
        ]));
        return $ids ?: [0];
    }

    private function esCreadorPedido($header) {
        if (strpos((string) ($header['folio'] ?? ''), 'REAB-') === 0) return false;
        return $this->userId > 0 && (int) ($header['user_id'] ?? 0) === $this->userId;
    }

    private function puedeGestionarDestino($header) {
        $dest = (int) ($header['destination_branch_id'] ?? 0);
        $orig = (int) ($header['branch_id'] ?? 0);
        $interSucursal = $dest > 0 && $dest !== $orig;
        if (!$interSucursal || $this->branchId <= 0) return true;
        return $this->branchId === $dest;
    }

    private function statusBadge($status) {
        $map = [
            'Borrador'   => ['#475569', '#F1F5F9'],
            'Solicitada' => ['#D97706', '#FEF3C7'],
            'Aprobada'   => ['var(--accent-soft-fg, rgb(var(--brand-700, 168 74 51)))', 'var(--accent-soft-bg, rgb(var(--brand-100, 247 227 220)))'],
            'Parcial'    => ['#EA580C', '#FFEDD5'],
            'Recibida'   => ['#16A34A', '#DCFCE7'],
            'Rechazada'  => ['#DC2626', '#FEE2E2'],
            'Cancelada'  => ['#DC2626', '#FEE2E2']
        ];
        $c = $map[$status] ?? ['#475569', '#F1F5F9'];
        return badge(strtoupper($status), $c[0], 100, $c[1]);
    }

    // Como Origen → Destino en traspasos. El almacén es de quien surte; sin sucursal
    // que surta (reabasto) es el de quien pide.
    private function rutaCell($orden) {
        $surteId  = (int) ($orden['destination_branch_id'] ?? 0);
        $solicita = $this->sucChipCell($orden['branch_id'], $orden['branch_name'], $surteId ? '' : $orden['warehouse_name']);
        $surte    = $surteId
            ? $this->sucChipCell($surteId, $orden['destination_branch_name'], $orden['warehouse_name'])
            : "<span class='text-gray-400'>-</span>";

        return "<div class='flex items-center justify-center gap-1'><div class='min-w-0'>{$solicita}</div>"
             . "<i data-lucide='arrow-right' class='w-4 h-4 text-gray-500 flex-shrink-0'></i><div class='min-w-0'>{$surte}</div></div>";
    }

    // Cuándo se hizo el pedido (created_at): 13/OCT/2026 10:47 PM. `$fecha` (date_order,
    // la fecha en que se necesitan los insumos) solo si falta created_at. Como en Pedidos
    // de alpha (formatSpanishDate), el de hoy dice "Hoy" en dorado y el de ayer "Ayer";
    // hoy sale de MySQL (getFechaBd): PHP corre en UTC y de noche ya marcaba el día
    // siguiente. Meses a mano: strftime depende del locale y está obsoleto desde PHP 8.1.
    private function fechaHoraPedido($fecha, $creado) {
        $momento = strtotime((string) $creado);
        $dia     = $momento ?: strtotime((string) $fecha);
        if (!$dia) return '-';

        if ($this->hoyBd === null) $this->hoyBd = $this->getFechaBd();

        $meses = ['', 'ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
        $ymd   = date('Y-m-d', $dia);
        $texto = date('d', $dia) . '/' . $meses[(int) date('n', $dia)] . '/' . date('Y', $dia);

        if ($ymd === $this->hoyBd)                                       $texto = '<span class="text-[#CE9D14] font-semibold">Hoy</span>';
        elseif ($ymd === date('Y-m-d', strtotime($this->hoyBd . ' -1 day'))) $texto = 'Ayer';

        return $momento ? $texto . ' ' . date('h:i A', $momento) : $texto;
    }

    // Punto antes del folio en Mis entregas, como el del turno en Pedidos de alpha: solo el
    // verde que late en una solicitud nueva (Solicitada, por surtir). Las demás llevan un
    // hueco del mismo ancho para que los folios queden alineados.
    private function puntoNueva($status) {
        return $status === 'Solicitada'
            ? "<span class='inline-block w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse mr-1.5 align-middle' title='Solicitud nueva'></span>"
            : "<span class='inline-block w-1.5 h-1.5 mr-1.5 align-middle'></span>";
    }

    // Columna "Entrega para" (date_order): "Hoy" en rojo si es hoy; si no, con el día de
    // la semana: Lunes 19/OCT/2026. Hoy sale de MySQL (getFechaBd), como en fechaHoraPedido.
    private function entregaParaCell($fecha, $conDia = true) {
        $dia = substr((string) $fecha, 0, 10);
        $ts  = $dia !== '' ? strtotime($dia) : false;
        if (!$ts) return '-';

        if ($this->hoyBd === null) $this->hoyBd = $this->getFechaBd();

        if ($dia === $this->hoyBd) return "<span class='font-semibold text-red-600'>Hoy</span>";

        $meses = ['', 'ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
        $texto = date('d', $ts) . '/' . $meses[(int) date('n', $ts)] . '/' . date('Y', $ts);
        if (!$conDia) return $texto;

        $dias = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        return $dias[(int) date('w', $ts)] . ' ' . $texto;
    }

    private function folioLink($folio, $id) {
        $label = htmlspecialchars($folio, ENT_QUOTES);
        return "<a href=\"javascript:void(0)\" onclick=\"app.selectOrden('{$label}', {$id})\" title=\"Ver detalle del pedido\""
             . " class=\"text-gray-800 hover:text-blue-600 hover:underline cursor-pointer\">{$label}</a>";
    }

    private function sucChipCell($branchId, $branchName, $whName) {
        $palette = [
            ['icon' => 'text-blue-400',   'bg' => 'rgb(var(--brand-600, 192 90 64) / 0.15)',  'border' => 'rgb(var(--brand-600, 192 90 64) / 0.35)'],
            ['icon' => 'text-green-400',  'bg' => 'rgba(63,193,137,0.15)',  'border' => 'rgba(63,193,137,0.35)'],
            ['icon' => 'text-purple-400', 'bg' => 'rgba(168,85,247,0.15)',  'border' => 'rgba(168,85,247,0.35)'],
            ['icon' => 'text-pink-400',   'bg' => 'rgba(244,114,182,0.15)', 'border' => 'rgba(244,114,182,0.35)'],
            ['icon' => 'text-orange-400', 'bg' => 'rgba(251,146,60,0.15)',  'border' => 'rgba(251,146,60,0.35)'],
            ['icon' => 'text-cyan-400',   'bg' => 'rgba(34,211,238,0.15)',  'border' => 'rgba(34,211,238,0.35)']
        ];
        $name = $branchName ?: '-';
        $idx  = $branchId ? ((int) $branchId % count($palette)) : 0;
        $p    = $palette[$idx];
        $wh   = $whName
            ? "<div class='text-[10px] text-gray-500 truncate'>{$whName}</div>"
            : "";
        return "<div class='flex items-center gap-2 w-full text-left'>"
             . "<div class='w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0' style='background:{$p['bg']};border:1px solid {$p['border']};'>"
             . "<i data-lucide='store' class='w-3.5 h-3.5 {$p['icon']}'></i></div>"
             . "<div class='min-w-0'><div class='font-semibold text-gray-800 truncate leading-tight'>{$name}</div>{$wh}</div>"
             . "</div>";
    }

    function stockByWarehouse() {
        $_POST += ['warehouse_id' => 0];

        $warehouseId = (int) $_POST['warehouse_id'];
        if ($warehouseId <= 0) return ['status' => 400, 'message' => 'Almacén no válido'];

        $map = [];
        foreach ($this->qStockByWarehouse([$warehouseId]) as $registro) {
            $map[(string) $registro['item_id']] = (float) $registro['quantity'];
        }
        return ['status' => 200, 'stock' => $map];
    }

    // Surtido inter-sucursal: reabasto opcional (ENT-) + salida (SI-, motivo SURTIDO_SUC).
    // Clampeado al pendiente y al stock real. Todo en una transaccion atomica.
    function fulfillOrden() {
        $_POST += ['warehouse_id' => 0, 'items' => '{}', 'replenish' => '{}', 'note' => '', 'expected_date' => '', 'vista' => ''];

        $id     = (int) $_POST['id'];
        $header = $this->qGetOrden([$id]);

        // Fecha compromiso del reabasto que se genere por lo que faltó (opcional).
        $compromiso = trim((string) $_POST['expected_date']);
        if ($compromiso !== '' && ($error = $this->compromisoInvalido($compromiso))) {
            return ['status' => 400, 'message' => $error];
        }

        if (!$header) return ['status' => 404, 'message' => 'Solicitud no encontrada'];
        if (!in_array($header['status'], ['Solicitada', 'Aprobada', 'Parcial'], true)) {
            return ['status' => 400, 'message' => 'Solo se puede surtir una solicitud Solicitada, Aprobada o Parcial'];
        }
        if (!$this->puedeGestionarDestino($header)) {
            return ['status' => 403, 'message' => 'Solo la sucursal de destino puede surtir esta solicitud'];
        }
        if ($_POST['vista'] !== 'entregas' && $this->esCreadorPedido($header)) {
            return ['status' => 403, 'message' => 'No puedes aprobar ni surtir un pedido que tú hiciste'];
        }

        $warehouseId = $_POST['warehouse_id'] ? (int) $_POST['warehouse_id'] : (int) $header['warehouse_id'];
        if ($warehouseId <= 0) {
            return ['status' => 400, 'message' => 'Se requiere un almacén de origen para surtir'];
        }

        $items = json_decode($_POST['items'] ?? '{}', true);
        if (!is_array($items)) $items = [];

        $detalle = $this->qGetOrdenDetail([$id]);
        if (empty($detalle)) return ['status' => 400, 'message' => 'La solicitud no tiene renglones'];

        $reasonId = $this->getShrinkageReasonId(['SURTIDO_SUC']);
        if (!$reasonId) return ['status' => 500, 'message' => 'Falta configurar el motivo de salida (SURTIDO_SUC)'];

        $byId = [];
        foreach ($detalle as $renglon) $byId[(string) $renglon['id']] = $renglon;

        $note = trim($_POST['note']) ?: ('Surtido de solicitud ' . $header['folio']);

        try {
            return $this->transaction(function () use ($id, $header, $warehouseId, $items, $byId, $reasonId, $compromiso, $note) {
                return $this->surtir($id, $header, $warehouseId, $items, $byId, $reasonId, $compromiso, $note);
            });
        } catch (\Throwable $e) {
            return ['status' => 500, 'message' => 'No se pudo surtir: ' . $e->getMessage()];
        }
    }

    // Salida (SI-, motivo SURTIDO_SUC) de lo que se entrega, reabasto (REAB-) por lo que no
    // alcanzó y estado Recibida/Parcial del pedido. Va dentro de la transacción de quien lo
    // llama (fulfillOrden o approveOrden). `$items` = {renglón: cantidad a entregar}.
    // Sin `$conReabasto` también se entrega todo lo marcado (el stock queda en negativo),
    // pero no se genera la orden de reabasto.
    private function surtir($id, $header, $warehouseId, $items, $byId, $reasonId, $compromiso, $note, $conReabasto = true) {
        if (empty($header['warehouse_id'])) $this->updateOrdenWarehouse([$warehouseId, $id]);

        // Se surte el pendiente completo aunque el stock no alcance: el almacen
        // queda en deficit (negativo) y el faltante (qtyNow - disponible) genera una
        // OC de reabasto pendiente que el encargado debera comprar/registrar.
        $stockCache = [];
        $toSupply   = [];
        $faltantes  = [];
        foreach ($items as $detailId => $qty) {
            $detailId = (string) $detailId;
            if (!isset($byId[$detailId])) continue;

            $renglon = $byId[$detailId];
            $pending = (float) $renglon['quantity_ordered'] - (float) $renglon['quantity_received'];
            if ($pending <= 0) continue;

            $pid = (int) $renglon['product_id'];
            if (!isset($stockCache[$pid])) {
                $sr = $this->getStockRow([$pid, $warehouseId]);
                $stockCache[$pid] = ['id' => $sr ? (int) $sr['id'] : 0, 'qty' => $sr ? (float) $sr['quantity'] : 0.0];
            }

            $avail  = $stockCache[$pid]['qty'];
            $qtyNow = min((float) $qty, $pending); // ya NO se topa al disponible
            if ($qtyNow <= 0) continue;

            $prev = $avail;
            $post = $avail - $qtyNow;              // puede quedar negativo (deficit)
            $stockCache[$pid]['qty'] = $post;

            $faltante = $qtyNow - $avail;          // lo que no se tenia -> a comprar
            if ($conReabasto && $faltante > 0) $faltantes[] = ['detail' => $renglon, 'qty' => $faltante];

            $toSupply[] = [
                'detail_row_id' => (int) $renglon['id'],
                'product_id'    => $pid,
                'cost'          => $renglon['cost'] !== null ? (float) $renglon['cost'] : 0.0,
                'qty'           => $qtyNow,
                'prev'          => $prev,
                'post'          => $post,
                'stock_id'      => $stockCache[$pid]['id']
            ];
        }

        if (empty($toSupply)) {
            throw new Exception('No se indicaron cantidades a surtir');
        }
        if (!empty($faltantes) && $compromiso === '') {
            throw new Exception('Elige la fecha compromiso del reabasto');
        }

        $siFolio  = $this->nextFolio('SI-', 'inventory_shrinkage', $this->companiesId);
        $totProds = count($toSupply);
        $totUnits = 0;
        $totCost  = 0.0;
        foreach ($toSupply as $linea) {
            $totUnits += $linea['qty'];
            $totCost  += $linea['qty'] * $linea['cost'];
        }

        $this->insertShrinkageFromOrden([
            $siFolio, $note, $totProds, $totUnits, $totCost,
            'Aplicada', $reasonId, $warehouseId,
            $header['branch_id'], $this->userId, $this->companiesId, date('Y-m-d'), $id
        ]);
        $shrRow = $this->_Read(
            "SELECT id FROM {$this->bd}inventory_shrinkage WHERE folio = ? AND companies_id = ? LIMIT 1",
            [$siFolio, $this->companiesId]
        );
        $shrId = (int) ($shrRow[0]['id'] ?? 0);
        if ($shrId <= 0) throw new Exception('No se pudo generar la salida de surtido');

        foreach ($toSupply as $linea) {
            $this->insertShrinkageDetail([
                $linea['qty'], $linea['cost'], $linea['qty'] * $linea['cost'], $linea['prev'], $linea['post'], $linea['product_id'], $shrId
            ]);
            // Si el producto no tenia fila de stock en el almacen, se crea con el
            // valor resultante (que puede ser negativo: refleja el deficit a cubrir).
            if ($linea['stock_id'] > 0) $this->updateStockQuantity([$linea['post'], $linea['stock_id']]);
            else                        $this->insertStockRow([$linea['post'], $warehouseId, $linea['product_id'], $this->companiesId]);
            $this->updateDetailReceived([$linea['qty'], $linea['detail_row_id']]);
        }

        // El faltante genera una OC de reabasto pendiente (la compra a registrar).
        $reabFolio = $this->createReabastoOrden($header, $warehouseId, $faltantes, $compromiso);

        $detailUpdated = $this->qGetOrdenDetail([$id]);
        $allDone = true;
        $anyDone = false;
        foreach ($detailUpdated as $renglon) {
            if ((float) $renglon['quantity_received'] > 0) $anyDone = true;
            if ((float) $renglon['quantity_received'] < (float) $renglon['quantity_ordered']) $allDone = false;
        }
        $newStatus = $allDone ? 'Recibida' : ($anyDone ? 'Parcial' : $header['status']);
        $this->updateOrdenStatus([$newStatus, $id]);

        $msg = "Surtido registrado: salida {$siFolio}, {$totProds} materiales.";
        if ($reabFolio) $msg .= " Se generó la orden de reabasto {$reabFolio} (pendiente de compra).";
        $msg .= " Solicitud ahora {$newStatus}.";

        return [
            'status'         => 200,
            'message'        => $msg,
            'salida_folio'   => $siFolio,
            'reabasto_folio' => $reabFolio,
            'orden_status'   => $newStatus
        ];
    }

    // Genera una OC de reabasto pendiente (REAB-, Aprobada, sin proveedor) por el faltante
    // que el stock no alcanzo a cubrir al surtir. El encargado la recibe cuando registra la
    // compra real, y esa entrada repone el almacen y cuadra el deficit. Devuelve el folio
    // REAB- o null si no hubo faltante. `$compromiso` = fecha en que se espera registrar
    // la compra (vacía = sin fecha compromiso).
    private function createReabastoOrden($header, $warehouseId, $faltantes, $compromiso = '') {
        if (empty($faltantes)) return null;

        $folio    = $this->nextFolio('REAB-', 'purchase_order', $this->companiesId);
        $totProds = count($faltantes);
        $totUnits = 0;
        $totCost  = 0.0;
        $totBase  = 0.0;
        foreach ($faltantes as $f) {
            $cost = $f['detail']['cost'] !== null ? (float) $f['detail']['cost'] : 0.0;
            $base = $f['detail']['price_without_tax'] !== null ? (float) $f['detail']['price_without_tax'] : 0.0;
            $totUnits += $f['qty'];
            $totCost  += $f['qty'] * $cost;
            $totBase  += $f['qty'] * $base;
        }

        $this->insertOrden([
            $folio,
            null,                       // proveedor: lo asigna el encargado al comprar
            (int) $header['branch_id'], // sucursal que repone su almacen
            null,                       // destination_branch_id
            $warehouseId,               // almacen a reponer
            date('Y-m-d'),
            null,                       // expected_date
            // Esta nota es la liga del reabasto con su pedido (getPedidoLinksById): no cambiarla.
            'Reabasto por surtido de la solicitud ' . $header['folio'],
            $totProds,
            $totUnits,
            $totCost,
            $totBase,
            'Aprobada',                 // lista para recibir (registrar la compra)
            $this->userId,
            $this->companiesId
        ]);

        $row    = $this->_Read(
            "SELECT id FROM {$this->bd}purchase_order WHERE folio = ? AND companies_id = ? LIMIT 1",
            [$folio, $this->companiesId]
        );
        $reabId = (int) ($row[0]['id'] ?? 0);
        if ($reabId <= 0) throw new Exception('No se pudo generar la orden de reabasto');

        if ($compromiso !== '' && !$this->updateOrdenCompromiso([$compromiso, $this->userId, $reabId])) {
            throw new Exception('No se pudo guardar la fecha compromiso del reabasto');
        }

        foreach ($faltantes as $f) {
            $d        = $f['detail'];
            $cost     = $d['cost'] !== null ? (float) $d['cost'] : null;
            $base     = $d['price_without_tax'] !== null ? (float) $d['price_without_tax'] : null;
            $tax      = $d['tax'] !== null ? (float) $d['tax'] : 0;
            $subtotal = $cost !== null ? $f['qty'] * $cost : 0.0;
            $this->insertOrdenDetail([
                $reabId,
                (int) $d['product_id'],
                !empty($d['unit_id']) ? (int) $d['unit_id'] : null,
                $f['qty'],
                $base,
                $tax,
                $cost,
                $subtotal,
                null
            ]);
        }

        return $folio;
    }

    // -- CoffeeIA --

    // Mismo chat que Catálogo, Entradas y Salidas (ia-chat.js). Aquí el modelo trabaja
    // con herramientas: busca, abre y cuenta pedidos de verdad, decide qué contestar y,
    // si la persona pidió eliminar, propone cuáles (proponer_eliminar) o la serie entera
    // (proponer_reiniciar). Cada vuelta es una petición: si pidió herramientas se
    // ejecutan, el hilo queda en sesión y el chat vuelve a llamar con `turno` (así enseña
    // cada paso mientras trabaja). Eliminar sigue detrás de la vista previa y la
    // contraseña: borra el pedido de verdad con lo que movió (deletePedidoFullById), y
    // al quedar la serie vacía el folio vuelve a OC-0001.
    const IA_MAX_PEDIDOS = 100;
    const IA_MAX_LISTA   = 60;
    const IA_MAX_RONDAS  = 8;
    const IA_ESTADOS     = ['Borrador', 'Solicitada', 'Aprobada', 'Parcial', 'Recibida', 'Rechazada', 'Cancelada'];

    function askPedidoIA() {
        if (empty($_SESSION['company_id'])) return ['status' => 401, 'message' => 'Tu sesión expiró. Vuelve a entrar.'];
        if (!$this->esAdminIA()) return ['status' => 403, 'message' => 'CoffeeIA de Pedidos es solo para administradores.'];
        if (!IaOllama::activo($this)) return ['status' => 403, 'message' => 'CoffeeIA está apagado. Se enciende en Administrador > CoffeeIA.'];

        $ia = IaOllama::desdeCredenciales($this);
        if ($ia === null) return ['status' => 503, 'message' => 'La IA no está configurada: falta la llave de Ollama.'];

        $sucursales = $this->lsSucursales(['company_id' => $this->companiesId, 'user_id' => $this->userId, 'is_owner' => (int) ($_SESSION['is_owner'] ?? 0)]);
        $turno      = (string) ($_POST['turno'] ?? '');

        if ($turno === '') {
            $mensaje   = mb_substr(trim((string) ($_POST['mensaje'] ?? '')), 0, 2000);
            $historial = json_decode((string) ($_POST['historial'] ?? '[]'), true);

            if ($mensaje === '') return ['status' => 400, 'message' => 'Escríbeme algo.'];

            $hilo = [
                'id'        => bin2hex(random_bytes(6)),
                'mensajes'  => $this->mensajesPedidoIA($mensaje, is_array($historial) ? $historial : [], $sucursales),
                'rondas'    => 0,
                'cierre'    => false,
                'propuesta' => [],
                'reiniciar' => false
            ];
        } else {
            $hilo = $_SESSION['iaPedidosHilo'] ?? null;
            if (!is_array($hilo) || !hash_equals((string) $hilo['id'], $turno)) {
                return ['status' => 409, 'message' => 'Perdí el hilo de esta respuesta. Pregúntame otra vez.'];
            }
        }

        // Sin esto la sesión queda bloqueada mientras el modelo piensa y la tabla de
        // pedidos no puede recargar en ese rato. Se reabre para guardar el hilo.
        session_write_close();
        set_time_limit(180);

        // En la última vuelta ya no hay herramientas: tiene que contestar con lo que tiene.
        $ultima = $hilo['rondas'] >= self::IA_MAX_RONDAS - 1;
        $r      = $ia->chatRonda($hilo['mensajes'], $ultima ? [] : $this->herramientasPedidoIA());
        if (!$r['ok']) return ['status' => 502, 'message' => $r['error']];

        $hilo['rondas']++;

        if (!empty($r['tool_calls']) && !$ultima) {
            $hilo['mensajes'][] = ['role' => 'assistant', 'content' => $r['content'], 'tool_calls' => $r['tool_calls']];
            $pasos = [];

            foreach ($r['tool_calls'] as $llamada) {
                $nombre = (string) ($llamada['function']['name'] ?? '');
                $args   = $llamada['function']['arguments'] ?? [];
                $args   = is_array($args) ? $args : (json_decode((string) $args, true) ?: []);
                $hecho  = $this->usarHerramientaPedidoIA($nombre, $args, $sucursales, $hilo);

                $hilo['mensajes'][] = ['role' => 'tool', 'tool_name' => $nombre, 'content' => json_encode($hecho['resultado'], JSON_UNESCAPED_UNICODE)];
                $pasos[]            = $hecho['paso'];
            }

            session_start();
            $_SESSION['iaPedidosHilo'] = $hilo;

            return ['status' => 200, 'turno' => $hilo['id'], 'pasos' => $pasos];
        }

        // Vuelta vacía (todo se le fue en pensar): una sola vuelta más pidiéndole el cierre.
        if ($r['content'] === '' && !$hilo['cierre']) {
            $hilo['cierre']     = true;
            $hilo['mensajes'][] = ['role' => 'system', 'content' => 'No escribiste respuesta. Redacta ahora la respuesta final para la persona con lo que ya averiguaste.'];

            session_start();
            $_SESSION['iaPedidosHilo'] = $hilo;

            return ['status' => 200, 'turno' => $hilo['id'], 'pasos' => ['Redactando la respuesta']];
        }

        // Respuesta final: si propuso eliminar, la vista previa sale de lo que dejó en el
        // hilo (ids ya validados) y reemplaza a la anterior.
        $vista = $hilo['propuesta']
            ? $this->vistaPedidoIA($this->qPedidosIA(['companies_id' => $this->companiesId, 'branch_ids' => $this->_userBranchIds(), 'ids' => $hilo['propuesta'], 'ocultos' => true]), $hilo['reiniciar'])
            : ['row' => [], 'ids' => []];
        $token = empty($vista['ids']) ? '' : bin2hex(random_bytes(8));

        session_start();
        unset($_SESSION['iaPedidosHilo']);
        if ($token !== '') $_SESSION['iaPedidos'] = ['token' => $token, 'ids' => $vista['ids']];

        return [
            'status' => 200,
            'reply'  => $r['content'] !== '' ? $r['content'] : 'No pude redactar una respuesta. Pregúntame otra vez, con otras palabras.',
            'token'  => $token,
            'row'    => $vista['row']
        ];
    }

    // Todo o nada: si un pedido no se puede borrar, la transacción deshace los demás.
    function applyPedidoIA() {
        if (empty($_SESSION['company_id'])) return ['status' => 401, 'message' => 'Tu sesión expiró. Vuelve a entrar.'];
        if (!$this->esAdminIA()) return ['status' => 403, 'message' => 'Solo un administrador puede eliminar pedidos.'];

        $pendiente = $_SESSION['iaPedidos'] ?? null;
        $token     = (string) ($_POST['token'] ?? '');

        if (!is_array($pendiente) || $token === '' || !hash_equals((string) $pendiente['token'], $token)) {
            return ['status' => 409, 'message' => 'Esa vista previa ya no está vigente. Pídeme los pedidos otra vez.'];
        }

        $ids = [];
        foreach ((array) json_decode((string) ($_POST['ids'] ?? '[]'), true) as $i) {
            if (is_numeric($i) && isset($pendiente['ids'][(int) $i])) $ids[] = (int) $pendiente['ids'][(int) $i];
        }
        $ids = array_values(array_unique($ids));

        if (empty($ids)) return ['status' => 400, 'message' => 'No marcaste ningún pedido.'];

        // Misma verificación que el login: users.password (bcrypt).
        $user  = $this->qUserPassword([$this->userId]);
        $pass  = str_replace("'", "", (string) ($_POST['password'] ?? ''));
        $valid = $user && $pass !== '' && !empty($user['password']) && password_verify($pass, $user['password']);
        if (!$valid) return ['status' => 401, 'message' => 'Contraseña incorrecta'];

        // Desde la vista previa pudieron eliminarlos en otra pestaña: se buscan otra vez.
        $vigentes = $this->qPedidosIA(['companies_id' => $this->companiesId, 'branch_ids' => $this->_userBranchIds(), 'ids' => $ids, 'ocultos' => true]);
        if (empty($vigentes)) return ['status' => 409, 'message' => 'Esos pedidos ya no están en la lista.'];

        // Un reabasto marcado junto con su pedido ya se fue con él: deletePedidoFullById
        // devuelve vacío y no se cuenta dos veces.
        $borrado = ['pedidos' => [], 'movimientos' => []];

        try {
            $this->transaction(function () use ($vigentes, &$borrado) {
                foreach ($vigentes as $p) {
                    $borrado = array_merge_recursive($borrado, $this->deletePedidoFullById((int) $p['id'], $this->companiesId));
                }
            });
        } catch (\Throwable $e) {
            return ['status' => 500, 'message' => 'No se eliminó ningún pedido: ' . $e->getMessage()];
        }

        unset($_SESSION['iaPedidos']);

        $folios  = $borrado['pedidos'];
        $n       = count($folios);
        $faltan  = count($ids) - count($vigentes);
        $message = ($n === 1 ? 'Eliminé el pedido ' : "Eliminé {$n} pedidos: ") . implode(', ', $folios) . '.';

        if ($borrado['movimientos']) $message .= ' También borré ' . implode(', ', $borrado['movimientos']) . ' y regresé su stock.';
        if ($faltan > 0)             $message .= $faltan === 1 ? ' 1 ya no estaba en la lista.' : " {$faltan} ya no estaban en la lista.";

        $message .= ' Siguientes folios: ' . $this->nextFolio('OC-', 'purchase_order', $this->companiesId)
                  . ' y ' . $this->nextFolio('REAB-', 'purchase_order', $this->companiesId) . '.';

        return [
            'status'  => 200,
            'message' => $message,
            'data'    => ['folios' => $folios]
        ];
    }

    private function esAdminIA() {
        return (int) ($_SESSION['is_admin'] ?? 0) === 1;
    }

    private function mensajesPedidoIA($mensaje, $historial, $sucursales) {
        $dias  = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
        $filas = array_map(function ($s) {
            return $s['id'] . ' | ' . $s['valor'];
        }, $sucursales);

        $sistema = implode("\n", [
            'Eres CoffeeIA, el asistente del módulo Pedidos del almacén. Hablas español, claro y en frases cortas.',
            'Un pedido (también "solicitud" de materiales) es lo que una sucursal le pide al almacén de otra sucursal o de la suya. Folios: OC-0007 es un pedido; REAB-0002 es un reabasto (la compra que se genera por lo que faltó al surtir). Si dicen "el pedido 7", es OC-0007.',
            'Estados: Borrador, Solicitada (enviada, espera aprobación), Aprobada, Parcial (surtida en parte), Recibida (surtida completa), Rechazada, Cancelada.',
            '',
            '== CÓMO TRABAJAS ==',
            '- Tienes herramientas para consultar los pedidos reales. Úsalas con libertad y las veces que haga falta: busca, abre pedidos, cuenta, compara. Piensa antes de contestar.',
            '- Todo dato de un pedido sale de una herramienta. Nunca inventes folios, cantidades ni fechas.',
            '- Las herramientas ven los pedidos activos. Los "ocultos" son pedidos que se eliminaron antes con el sistema viejo: ya no salen en la lista, pero siguen contando para el folio. Los ves con ocultos = true.',
            '- Contesta cualquier pregunta sobre los pedidos (cuántos hay, qué trae uno, quién lo pidió, cuáles se ven duplicados, vacíos o de prueba) y da tu opinión con lo que veas.',
            '- Si una búsqueda no trae nada, prueba con otro criterio antes de rendirte.',
            '',
            '== ELIMINAR ==',
            '- Solo con proponer_eliminar, y solo si la persona pidió eliminar. Tú no eliminas: al terminar tu respuesta ella ve la vista previa, marca y confirma con su contraseña.',
            '- Antes de proponer, revisa los pedidos. Si el criterio es ambiguo o son muchos, di lo que encontraste y pregunta antes de proponer.',
            '- Eliminar borra el pedido de verdad, con lo que movió en inventario: la salida de su surtido (SI-), las entradas de su recepción y el reabasto (REAB-) que generó. El stock se regresa. Avísalo si ya surtió material.',
            '- Crear, aprobar, surtir o cancelar no se hace aquí: es en la pantalla de Pedidos.',
            '',
            '== REINICIAR FOLIOS ==',
            '- Si piden reiniciar los folios (que el siguiente vuelva a OC-0001), usa proponer_reiniciar: arma la vista previa con TODOS los pedidos y reabastos, también los ocultos. El folio solo vuelve a empezar si se eliminan todos.',
            '- Es lo más delicado que haces: di cuántos pedidos son y cuántos ya movieron inventario, y que revise la vista previa.',
            '',
            '== CÓMO RESPONDES ==',
            '- Texto plano, sin markdown (nada de **, # ni tablas). Listas con guiones.',
            '- Si propusiste eliminar, di cuántos y por qué, y que revise la vista previa.',
            '',
            '== DATOS ==',
            'Hoy es ' . $dias[(int) date('w')] . ' ' . date('Y-m-d') . '.',
            'SUCURSALES (id | nombre):',
            $filas ? implode("\n", $filas) : '-'
        ]);

        $mensajes = [['role' => 'system', 'content' => $sistema]];

        foreach (array_slice($historial, -8) as $h) {
            $rol   = is_array($h) ? ($h['role'] ?? '') : '';
            $texto = is_array($h) ? mb_substr($this->textoPedidoIA($h['content'] ?? ''), 0, 3000) : '';
            if (($rol === 'user' || $rol === 'assistant') && $texto !== '') $mensajes[] = ['role' => $rol, 'content' => $texto];
        }

        $mensajes[] = ['role' => 'user', 'content' => $mensaje];

        return $mensajes;
    }

    // Las herramientas que ve el modelo (formato tools de Ollama). Todas leen, salvo
    // proponer_eliminar y proponer_reiniciar, que solo dejan en el hilo qué pedidos van
    // a la vista previa.
    private function herramientasPedidoIA() {
        $fn = function ($nombre, $descripcion, $propiedades = [], $requeridos = []) {
            return [
                'type'     => 'function',
                'function' => [
                    'name'        => $nombre,
                    'description' => $descripcion,
                    'parameters'  => ['type' => 'object', 'properties' => (object) $propiedades, 'required' => $requeridos]
                ]
            ];
        };

        $folios = ['type' => 'array', 'items' => ['type' => 'string'], 'description' => 'Folios, ej. ["OC-0003", "REAB-0002"]. "7" = OC-0007.'];

        return [
            $fn('buscar_pedidos', 'Busca pedidos activos. Todos los filtros son opcionales; sin filtros trae los más recientes. Devuelve el total y hasta ' . self::IA_MAX_LISTA . ' pedidos con folio, estado, fecha, sucursal que pide y que surte, materiales, nota, quién lo capturó y si ya surtió material.', [
                'folios'      => $folios,
                'kind'        => ['type' => 'string', 'enum' => ['pedido', 'reabasto']],
                'status'      => ['type' => 'array', 'items' => ['type' => 'string', 'enum' => self::IA_ESTADOS]],
                'branch'      => ['type' => 'integer', 'description' => 'id de la sucursal que PIDE'],
                'destination' => ['type' => 'integer', 'description' => 'id de la sucursal que SURTE'],
                'date_from'   => ['type' => 'string', 'description' => 'Fecha del pedido desde, YYYY-MM-DD'],
                'date_to'     => ['type' => 'string', 'description' => 'Fecha del pedido hasta, YYYY-MM-DD'],
                'mine'        => ['type' => 'boolean', 'description' => 'Solo los que capturó la persona que te escribe'],
                'text'        => ['type' => 'string', 'description' => 'Palabra que aparece en la nota del pedido'],
                'product'     => ['type' => 'string', 'description' => 'Nombre (o parte) de un material que viene en el pedido'],
                'ocultos'     => ['type' => 'boolean', 'description' => 'true = también los ocultos (eliminados antes, siguen contando para el folio)']
            ]),
            $fn('ver_pedido', 'Abre un pedido: estado, fechas, sucursales, almacén, quién lo capturó y lo aprobó, notas, motivo de rechazo, fecha compromiso y sus renglones (material, unidad, pedido, entregado, nota).', [
                'folio' => ['type' => 'string', 'description' => 'Folio del pedido, ej. OC-0009']
            ], ['folio']),
            $fn('resumen_pedidos', 'Cuenta los pedidos activos por estado y por sucursal que pide, cuántos ya surtieron material, cuántos ocultos hay y cuáles serán los siguientes folios.'),
            $fn('proponer_eliminar', 'Arma la vista previa para ELIMINAR esos pedidos (máximo ' . self::IA_MAX_PEDIDOS . '), activos u ocultos. Úsala solo si la persona pidió eliminar. No elimina: la persona marca y confirma con su contraseña. Llamarla otra vez reemplaza la propuesta anterior.', [
                'folios' => $folios
            ], ['folios']),
            $fn('proponer_reiniciar', 'Arma la vista previa para REINICIAR LOS FOLIOS: todos los pedidos y reabastos de la empresa, también los ocultos, para que el siguiente sea OC-0001 y REAB-0001. Úsala solo si la persona pidió reiniciar los folios. No elimina: la persona confirma con su contraseña.')
        ];
    }

    // Ejecuta lo que pidió el modelo dentro del alcance del usuario (empresa y sus
    // sucursales). Devuelve el resultado que vuelve al modelo y el paso que ve la persona.
    private function usarHerramientaPedidoIA($nombre, $args, $sucursales, &$hilo) {
        $alcance = ['companies_id' => $this->companiesId, 'branch_ids' => $this->_userBranchIds()];

        switch ($nombre) {
            case 'buscar_pedidos':
                $todos = $this->qPedidosIA($alcance + ($this->filtroPedidoIA($args, $sucursales) ?? []));
                $n     = count($todos);

                return [
                    'resultado' => [
                        'total'     => $n,
                        'mostrados' => min($n, self::IA_MAX_LISTA),
                        'pedidos'   => array_map([$this, 'pedidoCortoIA'], array_slice($todos, 0, self::IA_MAX_LISTA))
                    ],
                    'paso' => 'Buscando pedidos · ' . ($n === 1 ? '1 encontrado' : "{$n} encontrados")
                ];

            case 'ver_pedido':
                $folio = $this->filtroPedidoIA(['folios' => [$args['folio'] ?? '']], $sucursales)['folios'][0] ?? '';
                $p     = $folio !== '' ? ($this->qPedidosIA($alcance + ['folios' => [$folio], 'ocultos' => true])[0] ?? null) : null;

                if (!$p) {
                    return ['resultado' => ['error' => 'No encontré ese pedido entre los de tus sucursales.'], 'paso' => 'Buscando ' . ($folio ?: 'el pedido')];
                }

                $h = $this->qGetOrden([(int) $p['id']]);

                return [
                    'resultado' => $this->pedidoCortoIA($p) + [
                        'almacen'          => $h['warehouse_name'] ?? '',
                        'aprobo'           => $h['approved_user_name'] ?? '',
                        'aprobado_el'      => $h['approved_at'] ?? '',
                        'nota_aprobacion'  => $h['approval_note'] ?? '',
                        'motivo_rechazo'   => $h['reject_reason'] ?? '',
                        'fecha_compromiso' => $h['expected_date'] ?? '',
                        'renglones'        => array_map(function ($d) {
                            return [
                                'material'  => $d['product_name'],
                                'unidad'    => $d['unidad'] ?? '',
                                'pedido'    => (float) $d['quantity_ordered'],
                                'entregado' => (float) $d['quantity_received'],
                                'nota'      => $d['note'] ?? ''
                            ];
                        }, $this->qGetOrdenDetail([(int) $p['id']]))
                    ],
                    'paso' => 'Revisando ' . $p['folio']
                ];

            case 'resumen_pedidos':
                $todos       = $this->qPedidosIA($alcance + ['ocultos' => true]);
                $activos     = array_filter($todos, function ($p) { return (int) $p['active'] === 1; });
                $porEstado   = [];
                $porSucursal = [];

                foreach ($activos as $p) {
                    $suc = $p['branch_name'] ?: '-';

                    $porEstado[$p['status']] = ($porEstado[$p['status']] ?? 0) + 1;
                    $porSucursal[$suc]       = ($porSucursal[$suc] ?? 0) + 1;
                }

                return [
                    'resultado' => [
                        'total'              => count($activos),
                        'por_estado'         => $porEstado,
                        'por_sucursal'       => $porSucursal,
                        'surtieron'          => count(array_filter($activos, function ($p) { return (int) $p['movido'] > 0; })),
                        'ocultos'            => count($todos) - count($activos),
                        'siguiente_pedido'   => $this->nextFolio('OC-', 'purchase_order', $this->companiesId),
                        'siguiente_reabasto' => $this->nextFolio('REAB-', 'purchase_order', $this->companiesId)
                    ],
                    'paso' => 'Contando pedidos'
                ];

            case 'proponer_eliminar':
                $pedidos = $this->filtroPedidoIA(['folios' => $args['folios'] ?? []], $sucursales)['folios'] ?? [];
                if (!$pedidos) return ['resultado' => ['error' => 'Dame folios válidos, ej. OC-0003.'], 'paso' => 'Preparando la vista previa'];

                $hallados          = $this->qPedidosIA($alcance + ['folios' => $pedidos, 'ocultos' => true]);
                $folios            = array_column($hallados, 'folio');
                $hilo['propuesta'] = array_map('intval', array_column($hallados, 'id'));
                $hilo['reiniciar'] = false;

                return [
                    'resultado' => [
                        'en_vista_previa' => count($folios),
                        'folios'          => $folios,
                        'no_encontrados'  => array_values(array_diff($pedidos, $folios)),
                        'ya_surtieron'    => array_column(array_filter($hallados, function ($p) { return (int) $p['movido'] > 0; }), 'folio'),
                        'nota'            => 'La persona verá la vista previa cuando termines tu respuesta. No digas que ya se eliminaron.'
                    ],
                    'paso' => 'Preparando la vista previa · ' . (count($folios) === 1 ? '1 pedido' : count($folios) . ' pedidos')
                ];

            // La serie es de la empresa: si hay pedidos de sucursales que no maneja,
            // borrar solo los suyos no regresaría el folio a OC-0001.
            case 'proponer_reiniciar':
                $ajenos = $alcance['branch_ids'] ? $this->getPedidosAjenosCount($alcance) : 0;
                if ($ajenos > 0) {
                    return [
                        'resultado' => ['error' => "No se puede: hay {$ajenos} pedidos de sucursales que esta persona no maneja. Los folios solo vuelven a empezar si se eliminan todos; eso lo hace el dueño."],
                        'paso'      => 'Revisando la serie de folios'
                    ];
                }

                $todos = $this->qPedidosIA($alcance + ['ocultos' => true]);
                if (!$todos) return ['resultado' => ['error' => 'No hay pedidos: el siguiente folio ya es ' . $this->nextFolio('OC-', 'purchase_order', $this->companiesId) . '.'], 'paso' => 'Revisando la serie de folios'];

                if (count($todos) > self::IA_MAX_PEDIDOS) {
                    return ['resultado' => ['error' => 'Son ' . count($todos) . ' pedidos; de una vez solo puedo ' . self::IA_MAX_PEDIDOS . '. Propón eliminar por partes.'], 'paso' => 'Revisando la serie de folios'];
                }

                $hilo['propuesta'] = array_map('intval', array_column($todos, 'id'));
                $hilo['reiniciar'] = true;

                return [
                    'resultado' => [
                        'en_vista_previa' => count($todos),
                        'ocultos'         => count(array_filter($todos, function ($p) { return (int) $p['active'] === 0; })),
                        'ya_surtieron'    => array_column(array_filter($todos, function ($p) { return (int) $p['movido'] > 0; }), 'folio'),
                        'nota'            => 'La persona verá la vista previa cuando termines tu respuesta. Si los elimina todos, el siguiente folio será OC-0001. No digas que ya se eliminaron.'
                    ],
                    'paso' => 'Preparando el reinicio · ' . (count($todos) === 1 ? '1 pedido' : count($todos) . ' pedidos')
                ];
        }

        return ['resultado' => ['error' => "No existe la herramienta {$nombre}."], 'paso' => 'Herramienta desconocida'];
    }

    // Lo que el modelo ve de cada pedido en una lista.
    private function pedidoCortoIA($p) {
        return [
            'folio'           => $p['folio'],
            'estado'          => $p['status'],
            // Fecha del pedido con la hora de captura, absoluta: el "Hoy" de la tabla es HTML.
            'fecha'           => date('Y-m-d', strtotime((string) $p['date_order'])) . ' ' . date('H:i', strtotime((string) $p['created_at'])),
            'pide'            => $p['branch_name'] ?: '-',
            'surte'           => $p['destination_branch_name'] ?: '-',
            'materiales'      => (int) $p['total_products'],
            'nota'            => $this->textoPedidoIA($p['note']),
            'capturo'         => $this->textoPedidoIA($p['user_name']),
            'surtio_material' => (int) $p['movido'] > 0,
            'oculto'          => (int) $p['active'] === 0
        ];
    }

    // Solo pasan los campos que conoce qPedidosIA, ya validados. null = ningún criterio.
    private function filtroPedidoIA($s, $sucursales) {
        if (!is_array($s)) return null;

        $f      = [];
        $folios = [];

        foreach ((array) ($s['folios'] ?? []) as $v) {
            $v = strtoupper(preg_replace('/\s+/', '', $this->textoPedidoIA($v)));

            if (preg_match('/^(OC|REAB)-?(\d+)$/', $v, $m)) $folios[] = $m[1] . '-' . str_pad((string) (int) $m[2], 4, '0', STR_PAD_LEFT);
            elseif (preg_match('/^\d+$/', $v))              $folios[] = 'OC-' . str_pad((string) (int) $v, 4, '0', STR_PAD_LEFT);
        }
        if ($folios) $f['folios'] = array_slice(array_values(array_unique($folios)), 0, self::IA_MAX_PEDIDOS);

        $kind = strtolower($this->textoPedidoIA($s['kind'] ?? ''));
        if (in_array($kind, ['pedido', 'reabasto'], true)) $f['kind'] = $kind;

        $estados = [];
        foreach ((array) ($s['status'] ?? []) as $v) {
            foreach (self::IA_ESTADOS as $e) {
                if (strcasecmp($e, $this->textoPedidoIA($v)) === 0) $estados[] = $e;
            }
        }
        if ($estados) $f['status'] = array_values(array_unique($estados));

        $suyas = array_map('intval', array_column($sucursales, 'id'));
        foreach (['branch', 'destination'] as $campo) {
            $id = (int) ($s[$campo] ?? 0);
            if ($id && in_array($id, $suyas, true)) $f[$campo] = $id;
        }

        foreach (['date_from', 'date_to'] as $campo) {
            $fecha = $this->textoPedidoIA($s[$campo] ?? '');
            if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $fecha) && strtotime($fecha)) $f[$campo] = $fecha;
        }

        if (($s['mine'] ?? false) === true) $f['user_id'] = $this->userId;

        foreach (['text', 'product'] as $campo) {
            $texto = mb_substr($this->textoPedidoIA($s[$campo] ?? ''), 0, 80);
            if ($texto !== '') $f[$campo] = $texto;
        }

        if (($s['ocultos'] ?? false) === true) $f['ocultos'] = true;

        return $f ? $f : null;
    }

    // Filas de la vista previa del chat (previewRow de ia-chat.js). El índice de la fila
    // es lo que viaja al aplicar; el id del pedido solo vive en la sesión. Con
    // `$reiniciar` las filas van como "reset" (el chat pide un segundo clic).
    private function vistaPedidoIA($pedidos, $reiniciar = false) {
        $row = [];
        $ids = [];

        foreach (array_slice($pedidos, 0, self::IA_MAX_PEDIDOS) as $i => $p) {
            $mats  = (int) $p['total_products'];
            $ruta  = ($p['branch_name'] ?: '-') . ($p['destination_branch_name'] ? ' → ' . $p['destination_branch_name'] : '');
            $nota  = $this->textoPedidoIA($p['note']);
            $ligas = $this->getPedidoLinksById((int) $p['id']);
            $junto = array_merge($ligas['salidas'], $ligas['entradas'], $ligas['reabastos']);
            $lista = count($junto) > 1 ? implode(', ', array_slice($junto, 0, -1)) . ' y ' . end($junto) : implode('', $junto);

            // El chat escapa el texto: el "Hoy" en dorado de la tabla se queda en "Hoy".
            $detalle = array_filter([
                strip_tags($this->fechaHoraPedido($p['date_order'], $p['created_at'])),
                $ruta,
                $mats === 1 ? '1 material' : "{$mats} materiales",
                $nota !== '' ? '«' . mb_strimwidth($nota, 0, 60, '…') . '»' : ''
            ]);

            // Una compra (CP-) que salió de este pedido lo detiene: deletePedidoFullById no lo borra.
            $row[] = [
                'idx'    => $i,
                'action' => $reiniciar ? 'reset' : 'delete',
                'valid'  => !$ligas['compras'],
                'name'   => $p['folio'],
                'tag'    => $p['status'] . ((int) $p['active'] === 0 ? ' · oculto' : ''),
                'detail' => implode(' · ', $detalle),
                'warn'   => $junto ? (count($junto) === 1 ? 'Se borra también ' : 'Se borran también ') . $lista . ', y se regresa el stock.' : '',
                'note'   => $ligas['compras'] ? 'La compra ' . implode(', ', $ligas['compras']) . ' viene de este pedido: no se puede borrar aquí.' : ''
            ];

            $ids[$i] = (int) $p['id'];
        }

        return ['row' => $row, 'ids' => $ids];
    }

    private function textoPedidoIA($valor) {
        return is_scalar($valor) ? trim((string) $valor) : '';
    }

}

$obj = new ctrl();
$opc = $_POST['opc'];
if (!method_exists($obj, $opc)) {
    echo json_encode(['status' => 405, 'message' => "opc '{$opc}' no implementado"]);
    exit(0);
}
// Compras sigue pendiente de definir sus acciones: por ahora basta con que el rol
// tenga alguna en la sección (hoy, solo el Super Admin).
echo json_encode(Permissions::guard('ordenes', $opc, []) ?: $obj->{$opc}());
