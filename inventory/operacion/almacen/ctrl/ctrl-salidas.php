<?php
require_once __DIR__ . '/../../../conf/_Session.php';
if (empty($_POST['opc'])) exit(0);

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

require_once '../mdl/mdl-salidas.php';
require_once '../../../conf/coffeSoft.php';
require_once '../../../conf/_IaOllama.php';
require_once '../../../conf/_Permissions.php';

class ctrl extends mdl {

    // Acción del rol que pide cada opc (conf/_Permissions.php); los demás solo
    // piden poder entrar a Salidas. Borrar una salida cancelada es eliminar,
    // no darla de baja.
    const PERMISSIONS = [
        'saveSalida'           => 'agregar',
        'askSalidaIA'          => ['agregar', 'eliminar'],
        'verifyEditPassword'   => 'editar',
        'updateSalida'         => 'editar',
        'verifyCancelPassword' => 'cancelar',
        'cancelSalida'         => 'cancelar',
        'saveSalidaEvidence'   => 'subir-comprobante',
        'deleteSalida'         => 'eliminar',
        'deleteSalidaIA'       => 'eliminar'
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
        $productos = array_map(function ($producto) {
            return [
                'id'        => (string) $producto['id'],
                'sku'       => $producto['sku'] ?: '',
                'nombre'    => $producto['nombre'],
                'categoria' => $producto['categoria'] ?: 'Sin categoria',
                'costo'     => (float) $producto['costo'],
                'precio'    => (float) ($producto['precio'] ?? 0),
                'stock'     => 0,
                'image'     => $producto['image'] ?? '',
                'unidad'    => $producto['unidad'] ?? '',
                'icon'      => 'package',
                'bg'        => 'bg-gray-700/40',
                'color'     => 'text-gray-300'
            ];
        }, $this->qProductsForTransfer([$this->companiesId]));

        // Las presentaciones (Caja 24...) salen como un producto más, al costo del
        // empaque; al guardar pasan a su base (renglonesABase).
        foreach ($this->listPresentacionesCaptura([$this->companiesId]) as $p) {
            $productos[] = $this->presentacionCatalogo($p) + [
                'costo'  => (float) $p['cost_unit'],
                'precio' => 0,
                'bg'     => 'bg-gray-700/40',
                'color'  => 'text-gray-300'
            ];
        }

        return [
            'status'          => 200,
            'companies_id'    => $this->companiesId,
            'branch_id'       => $this->branchId,
            'user_id'         => $this->userId,
            'is_admin'        => (int) $this->esAdminIA(),
            // Encendido en Administrador › CoffeeIA y con la casilla IA del rol en Salidas.
            'coffeeia'        => IaOllama::activo($this) && Permissions::can('salidas', 'ia'),
            'sucursales'      => $this->lsSucursales(['company_id' => $this->companiesId, 'user_id' => $this->userId, 'is_owner' => (int) ($_SESSION['is_owner'] ?? 0)]),
            'almacenes'       => $this->lsWarehouses(['companies_id' => $this->companiesId]),
            'motivos_salida'   => $this->lsShrinkageReasons([$this->companiesId]),
            'productos'       => $productos
        ];
    }

    function lsStockByWarehouse() {
        $warehouseId = (int) ($_POST['warehouse_id'] ?? 0);
        $map = [];
        if ($warehouseId > 0) {
            foreach ($this->qStockByWarehouse([$warehouseId]) as $row) {
                $map[(string) $row['item_id']] = (float) $row['quantity'];
            }
            $map = $this->stockConPresentaciones($map, $this->companiesId);
        }
        return ['status' => 200, 'stock' => $map];
    }

    function lsSalidas() {
        $rows = $this->qSalidas([
            'companies_id'    => $this->companiesId,
            'branch_id'       => $_POST['branch_id'] ?? '',
            'reason_id'       => $_POST['reason_id']       ?? '',
            'status'          => $_POST['status']          ?? '',
            'fi'              => $_POST['fi']              ?? '',
            'ff'              => $_POST['ff']              ?? '',
            'q'               => $_POST['q']               ?? ''
        ]);

        $row = [];
        foreach ($rows as $salida) {
            $acciones = [
                [
                    'class'   => 'inline-flex items-center justify-center w-9 h-9 p-2 text-[#9CA3AF] hover:text-blue-600 transition-colors cursor-pointer bg-transparent border-0',
                    'html'    => '<i data-lucide="eye" class="w-4 h-4"></i>',
                    'onclick' => "salidas.getSalida({$salida['id']})"
                ]
            ];
            // Las salidas que genera un pedido al surtirse no se editan aquí.
            if ($salida['status'] !== 'Cancelada' && empty($salida['purchase_order_id'])) {
                $acciones[] = [
                    'class'   => 'inline-flex items-center justify-center w-9 h-9 p-2 text-[#9CA3AF] hover:text-blue-600 transition-colors cursor-pointer bg-transparent border-0',
                    'html'    => '<i data-lucide="pencil" class="w-4 h-4"></i>',
                    'onclick' => "salidas.openEditSalida({$salida['id']})"
                ];
            }
            $row[] = [
                'id'         => $salida['id'],
                'Folio'      => [
                    'html' => renderFolioLink($salida['folio'], $salida['id'])
                ],
                'Fecha'      => fechaHoraSalida($salida['created_at']),
                'Tipo'       => badge($salida['reason_name'], $salida['reason_color'], 100, $salida['reason_bg'] ?? null, $salida['reason_icon'] ?? null),
                'Sucursal'   => $salida['branch_name'] ?: '-',
                'Origen'     => $salida['warehouse_name']  ?: '-',
                'Costo'      => '<span class="text-red-400">' . evaluar((float) $salida['total_cost_loss']) . '</span>',
                'Estado'     => statusBadge($salida['status']),
                'Registrado' => $salida['user_name'] ?: '-',
                'a' => Permissions::rowActions('salidas', $acciones)
            ];
        }
        return ['status' => 200, 'row' => $row];
    }

    function showSalidas() {
        $kpis = $this->getSalidaKpis($this->kpiFilters());
        return ['status' => 200, 'counts' => $kpis];
    }

    function lsKpiDetail() {
        $filters = $this->kpiFilters();

        switch ($_POST['kpi']) {
            case 'kpiPerdida':
                $row = $this->kpiRowsByProduct($filters, 'cost');
                break;
            case 'kpiRegistros':
                $row = $this->kpiRowsByReason($filters);
                break;
            case 'kpiUnidades':
                $row = $this->kpiRowsByProduct($filters, 'units');
                break;
            case 'kpiCanceladas':
                $row = $this->kpiRowsCancelled($filters);
                break;
            default:
                return ['status' => 400, 'message' => 'Indicador no reconocido'];
        }

        return ['status' => 200, 'row' => $row];
    }

    function getSalida() {
        $id     = (int) $_POST['id'];
        $header = $this->qGetSalida([$id]);
        if (!$header) return ['status' => 404, 'message' => 'Salida no encontrada'];
        $header['adjustment_date'] = $this->qLastAdjustmentDate([(int) $header['warehouse_id'], $this->companiesId]);
        $detail = $this->getSalidaDetail([$id]);
        return ['status' => 200, 'header' => $header, 'detail' => $detail];
    }

    // Con un ajuste aplicado en el almacén no se edita una salida de fecha anterior a él.
    private function ajusteBloquea($warehouseId, $fecha) {
        $ajuste = $this->qLastAdjustmentDate([(int) $warehouseId, $this->companiesId]);
        $fecha  = substr((string) $fecha, 0, 10);
        if (!$ajuste || $fecha === '' || $fecha >= $ajuste) return null;

        return 'El almacén tuvo un ajuste el ' . date('d/m/Y', strtotime($ajuste))
             . ': no se puede editar una salida con fecha anterior (' . date('d/m/Y', strtotime($fecha)) . ')';
    }

    function saveSalida() {
        $payload   = json_decode($_POST['payload'] ?? '[]', true);
        $productos = $payload['productos'] ?? [];

        if (empty($productos)) {
            return ['status' => 400, 'message' => 'No se enviaron renglones'];
        }
        if ($ajeno = $this->almacenAjeno($payload['warehouse_id'] ?? 0)) return $ajeno;

        // Caja 24 × 2 sale como 48 piezas de su base, a costo ÷ 24.
        $aBase = $this->renglonesABase($productos, $this->companiesId, ['cost']);
        if ($aBase['error']) return ['status' => 400, 'message' => $aBase['error']];
        $productos = $aBase['productos'];

        $branchId      = (int) ($payload['branch_id'] ?? $this->branchId);
        $folio         = $this->nextFolio('S-', 'inventory_shrinkage', $this->companiesId, $branchId);
        $totalProducts = count($productos);
        $totalUnits    = 0;
        $totalLoss     = 0;
        foreach ($productos as $producto) {
            $totalUnits += (float) $producto['quantity'];
            $totalLoss  += (float) $producto['quantity'] * (float) $producto['cost'];
        }

        $evidenceUrl = $payload['evidence_url'] ?? null;
        $b64 = $payload['evidence_b64'] ?? null;
        if (!empty($b64) && preg_match('#^data:image/([a-zA-Z0-9.+-]+);base64,#', $b64, $mm)) {
            $ext  = strtolower($mm[1]) === 'jpeg' ? 'jpg' : strtolower($mm[1]);
            $data = base64_decode(substr($b64, strpos($b64, ',') + 1), true);
            if ($data !== false) {
                $dir = __DIR__ . '/../../../../inventory/uploads/mermas/';
                if (!is_dir($dir)) @mkdir($dir, 0777, true);
                $fileName = $folio . '.' . $ext;
                if (@file_put_contents($dir . $fileName, $data) !== false) {
                    $evidenceUrl = '/inventory/uploads/mermas/' . $fileName;
                }
            }
        }

        $ok = $this->insertSalida([
            $folio,
            $payload['note']         ?? null,
            $evidenceUrl,
            $totalProducts,
            $totalUnits,
            $totalLoss,
            $payload['status']       ?? 'Aplicada',
            (int) $payload['shrinkage_reason_id'],
            (int) $payload['warehouse_id'],
            $branchId,
            $this->userId,
            $this->companiesId
        ]);

        if (!$ok) return ['status' => 500, 'message' => 'No se pudo registrar la salida'];

        $salidaRow = $this->_Read(
            "SELECT id FROM {$this->bd}inventory_shrinkage WHERE folio = ? AND companies_id = ? LIMIT 1",
            [$folio, $this->companiesId]
        );
        $salidaId = (int) ($salidaRow[0]['id'] ?? 0);

        foreach ($productos as $producto) {
            $productId = (int) $producto['product_id'];
            $warehouse = (int) $payload['warehouse_id'];
            $qty       = (float) $producto['quantity'];
            $cost      = (float) $producto['cost'];

            $stockRow = $this->getStockRow([$productId, $warehouse]);
            $prev     = $stockRow ? (float) $stockRow['quantity'] : 0;
            $post     = $prev - $qty;

            $this->insertSalidaDetail([
                $qty,
                $cost,
                $qty * $cost,
                $prev,
                $post,
                $productId,
                $producto['presentation_id']  ?? null,
                $producto['presentation_qty'] ?? null,
                $salidaId
            ]);

            // Sin renglón de stock en el almacén se crea con lo que quedó: sacar lo que no
            // hay deja el producto en negativo, igual que dice el detalle.
            if ($stockRow) {
                $this->updateStockQuantity([$post, (int) $stockRow['id']]);
            } else {
                $this->insertStockRow([$post, $warehouse, $productId, $this->companiesId]);
            }
        }

        return ['status' => 200, 'message' => 'Salida registrada', 'folio' => $folio, 'id' => $salidaId];
    }

    // Cancelar pide la contraseña de quien está en sesión (igual que en entradas).
    // Al acertar queda una autorización en sesión para ESA salida durante
    // CANCEL_WINDOW segundos; cancelSalida la exige y la consume.
    const CANCEL_WINDOW = 600;

    function verifyCancelPassword() {
        $id     = (int) $_POST['id'];
        $header = $this->qGetSalida([$id]);
        if (!$header || (int) $header['companies_id'] !== $this->companiesId) {
            return ['status' => 404, 'message' => 'Salida no encontrada'];
        }

        // Misma verificación que el login: users.password (bcrypt).
        $user  = $this->qUserPassword([$this->userId]);
        $pass  = str_replace("'", "", $_POST['password']);
        $valid = $user && !empty($user['password']) && password_verify($pass, $user['password']);
        if (!$valid) return ['status' => 401, 'message' => 'Contraseña incorrecta'];

        $_SESSION['shrinkage_cancel'][$id] = time();
        return ['status' => 200, 'message' => 'OK'];
    }

    private function cancelAuthorized($id) {
        $at = (int) ($_SESSION['shrinkage_cancel'][$id] ?? 0);
        return $at > 0 && (time() - $at) <= self::CANCEL_WINDOW;
    }

    // Una sucursal no saca del almacén de otra: 403 si alguno de los almacenes no es de las
    // sucursales del usuario (el dueño pasa siempre). null si puede.
    private function almacenAjeno(...$almacenes) {
        foreach ($almacenes as $almacen) {
            if (!$this->almacenDeSusSucursales((int) $almacen)) {
                return ['status' => 403, 'message' => 'Ese almacén no es de tus sucursales: solo puedes registrar salidas del tuyo'];
            }
        }
        return null;
    }

    // -- Editar --

    // Igual que cancelar: contraseña del usuario en sesión y ventana de CANCEL_WINDOW
    // segundos para ESA salida; updateSalida la exige y la consume.
    function verifyEditPassword() {
        $id     = (int) $_POST['id'];
        $header = $this->qGetSalida([$id]);
        if (!$header || (int) $header['companies_id'] !== $this->companiesId) {
            return ['status' => 404, 'message' => 'Salida no encontrada'];
        }
        if (!empty($header['purchase_order_id'])) {
            return ['status' => 400, 'message' => 'Esta salida la generó un pedido al surtirse: se corrige desde Pedidos, no aquí'];
        }
        if ($header['status'] === 'Cancelada') {
            return ['status' => 400, 'message' => 'No se puede editar una salida cancelada'];
        }

        $user  = $this->qUserPassword([$this->userId]);
        $pass  = str_replace("'", "", $_POST['password']);
        $valid = $user && (
            (!empty($user['password']) && password_verify($pass, $user['password'])) ||
            (!empty($user['user_key']) && $user['user_key'] === md5($pass))
        );
        if (!$valid) return ['status' => 401, 'message' => 'Contraseña incorrecta'];

        $_SESSION['shrinkage_edit'][$id] = time();
        return ['status' => 200, 'message' => 'OK'];
    }

    private function editSalidaAuthorized($id) {
        $at = (int) ($_SESSION['shrinkage_edit'][$id] ?? 0);
        return $at > 0 && (time() - $at) <= self::CANCEL_WINDOW;
    }

    // Recalcula el stock por diferencia: se regresa al almacén anterior lo que la
    // salida había sacado y se saca lo nuevo del almacén elegido (si es el mismo,
    // el efecto neto es la diferencia). Todo o nada.
    function updateSalida() {
        $payload   = json_decode($_POST['payload'] ?? '[]', true);
        $id        = (int) ($payload['id'] ?? 0);
        $productos = $payload['productos'] ?? [];
        $header    = $this->qGetSalida([$id]);

        if (!$header || (int) $header['companies_id'] !== $this->companiesId) {
            return ['status' => 404, 'message' => 'Salida no encontrada'];
        }
        if (!empty($header['purchase_order_id'])) {
            return ['status' => 400, 'message' => 'Esta salida la generó un pedido al surtirse: se corrige desde Pedidos, no aquí'];
        }
        if (!$this->editSalidaAuthorized($id)) {
            return ['status' => 403, 'message' => 'Confirma tu contraseña para editar la salida'];
        }
        if ($ajeno = $this->almacenAjeno($header['warehouse_id'], $payload['warehouse_id'] ?? $header['warehouse_id'])) return $ajeno;
        if ($header['status'] === 'Cancelada') {
            return ['status' => 400, 'message' => 'No se puede editar una salida cancelada'];
        }
        if ($errorAjuste = $this->ajusteBloquea($header['warehouse_id'], $header['date_shrinkage'] ?: $header['created_at'])) {
            return ['status' => 400, 'message' => $errorAjuste];
        }
        if (empty($productos)) {
            return ['status' => 400, 'message' => 'No se enviaron renglones'];
        }

        $aBase = $this->renglonesABase($productos, $this->companiesId, ['cost']);
        if ($aBase['error']) return ['status' => 400, 'message' => $aBase['error']];
        $productos = $aBase['productos'];

        $totalUnits = 0;
        $totalLoss  = 0;
        foreach ($productos as $p) {
            $qty  = $p['quantity'] ?? '';
            $cost = $p['cost'] ?? 0;
            if (!is_numeric($qty) || (float) $qty <= 0) {
                return ['status' => 400, 'message' => 'La cantidad de cada producto debe ser mayor que cero'];
            }
            if (!is_numeric($cost) || (float) $cost < 0) {
                return ['status' => 400, 'message' => 'El costo no puede ser negativo'];
            }
            $totalUnits += (float) $qty;
            $totalLoss  += (float) $qty * (float) $cost;
        }

        $oldWarehouse = (int) $header['warehouse_id'];
        $warehouse    = (int) ($payload['warehouse_id'] ?? 0);
        $oldDetail    = $this->getSalidaDetail([$id]);

        if ($warehouse <= 0) return ['status' => 400, 'message' => 'Elige el almacén de la salida'];

        try {
            $this->transaction(function () use ($id, $payload, $productos, $oldWarehouse, $warehouse, $oldDetail, $totalUnits, $totalLoss) {
                foreach ($oldDetail as $d) {
                    $productId = (int) $d['product_id'];
                    $qty       = (float) $d['quantity'];
                    $stockRow  = $this->getStockRow([$productId, $oldWarehouse]);
                    if ($stockRow) {
                        $this->updateStockQuantity([(float) $stockRow['quantity'] + $qty, (int) $stockRow['id']]);
                    } else {
                        $this->insertStockRow([$qty, $oldWarehouse, $productId, $this->companiesId]);
                    }
                }

                $this->disableSalidaDetail([$id]);

                $this->updateSalidaHeader([
                    $payload['note'] ?? null,
                    count($productos),
                    $totalUnits,
                    $totalLoss,
                    (int) $payload['shrinkage_reason_id'],
                    $warehouse,
                    (int) ($payload['branch_id'] ?? $this->branchId),
                    $id,
                    $this->companiesId
                ]);

                foreach ($productos as $p) {
                    $productId = (int) $p['product_id'];
                    $qty       = (float) $p['quantity'];
                    $cost      = (float) $p['cost'];

                    $stockRow = $this->getStockRow([$productId, $warehouse]);
                    $prev     = $stockRow ? (float) $stockRow['quantity'] : 0;
                    $post     = $prev - $qty;

                    $this->insertSalidaDetail([$qty, $cost, $qty * $cost, $prev, $post, $productId, $p['presentation_id'] ?? null, $p['presentation_qty'] ?? null, $id]);

                    if ($stockRow) {
                        $this->updateStockQuantity([$post, (int) $stockRow['id']]);
                    } else {
                        $this->insertStockRow([$post, $warehouse, $productId, $this->companiesId]);
                    }
                }

                // Lo capturado después de esta salida traía el stock de antes de la edición.
                $pares = [];
                foreach ($oldDetail as $d) $pares[] = [$d['product_id'], $oldWarehouse];
                foreach ($productos as $p) $pares[] = [$p['product_id'], $warehouse];
                $this->updateKardexChains($pares, $this->companiesId);
            });
        } catch (Throwable $e) {
            error_log('[updateSalida] ' . $e->getMessage());
            return ['status' => 500, 'message' => 'No se guardó ningún cambio: la base de datos rechazó la edición'];
        }

        unset($_SESSION['shrinkage_edit'][$id]);
        return ['status' => 200, 'message' => 'Salida ' . $header['folio'] . ' actualizada', 'folio' => $header['folio'], 'id' => $id];
    }

    function cancelSalida() {
        $id     = (int) $_POST['id'];
        $header = $this->qGetSalida([$id]);

        if (!$header) {
            return ['status' => 404, 'message' => 'Salida no encontrada'];
        }
        if ($header['status'] === 'Cancelada') {
            return ['status' => 400, 'message' => 'La salida ya esta cancelada'];
        }
        if (!$this->cancelAuthorized($id)) {
            return ['status' => 403, 'message' => 'Confirma tu contraseña para cancelar la salida'];
        }
        if ($ajeno = $this->almacenAjeno($header['warehouse_id'])) return $ajeno;

        $warehouse = (int) $header['warehouse_id'];
        $detail    = $this->getSalidaDetail([$id]);
        foreach ($detail as $d) {
            $productId = (int) $d['product_id'];
            $qty       = (float) $d['quantity'];
            $stockRow  = $this->getStockRow([$productId, $warehouse]);
            if ($stockRow) {
                $post = (float) $stockRow['quantity'] + $qty;
                $this->updateStockQuantity([$post, (int) $stockRow['id']]);
            } else {
                $this->insertStockRow([$qty, $warehouse, $productId, $this->companiesId]);
            }
        }

        $r = $this->qCancelSalida([$id]);
        if ($r) unset($_SESSION['shrinkage_cancel'][$id]);

        // Ya cancelada sale de la vista: lo que vino después se recalcula sin ella.
        if ($r) $this->updateKardexChains(array_map(function ($d) use ($warehouse) {
            return [$d['product_id'], $warehouse];
        }, $detail), $this->companiesId);
        return [
            'status'  => $r ? 200 : 500,
            'message' => $r ? 'Salida cancelada y stock restaurado' : 'No se pudo cancelar'
        ];
    }

    function deleteSalida() {
        $id     = (int) $_POST['id'];
        $header = $this->qGetSalida([$id]);
        if (!$header) return ['status' => 404, 'message' => 'Salida no encontrada'];
        if (($header['status'] ?? '') !== 'Cancelada') {
            return ['status' => 400, 'message' => 'Solo se puede eliminar una salida cancelada'];
        }
        $r = $this->deleteSalidaById([$id]);
        return [
            'status'  => $r ? 200 : 500,
            'message' => $r ? 'Salida eliminada' : 'No se pudo eliminar'
        ];
    }

    function saveSalidaEvidence() {
        $id     = (int) $_POST['id'];
        $header = $this->qGetSalida([$id]);
        if (!$header) return ['status' => 404, 'message' => 'Salida no encontrada'];
        if (($header['status'] ?? '') === 'Cancelada') {
            return ['status' => 400, 'message' => 'No se puede modificar la evidencia de una salida cancelada'];
        }

        $dir    = __DIR__ . '/../../../../inventory/uploads/mermas/';
        $oldUrl = $header['evidence_url'] ?? null;
        $b64    = $_POST['evidence_b64'] ?? null;

        if (empty($b64)) {
            if (!empty($oldUrl)) {
                $oldFile = $dir . basename($oldUrl);
                if (is_file($oldFile)) @unlink($oldFile);
            }
            $this->updateSalidaEvidence([null, $id]);
            return ['status' => 200, 'message' => 'Evidencia eliminada', 'evidence_url' => null];
        }

        if (!preg_match('#^data:image/([a-zA-Z0-9.+-]+);base64,#', $b64, $mm)) {
            return ['status' => 400, 'message' => 'Formato de imagen invalido'];
        }
        $ext  = strtolower($mm[1]) === 'jpeg' ? 'jpg' : strtolower($mm[1]);
        $data = base64_decode(substr($b64, strpos($b64, ',') + 1), true);
        if ($data === false) {
            return ['status' => 400, 'message' => 'No se pudo decodificar la imagen'];
        }
        if (!is_dir($dir)) @mkdir($dir, 0777, true);
        $fileName = $header['folio'] . '.' . $ext;
        if (@file_put_contents($dir . $fileName, $data) === false) {
            return ['status' => 500, 'message' => 'No se pudo guardar la evidencia'];
        }
        $url = '/inventory/uploads/mermas/' . $fileName;

        if (!empty($oldUrl) && basename($oldUrl) !== $fileName) {
            $oldFile = $dir . basename($oldUrl);
            if (is_file($oldFile)) @unlink($oldFile);
        }

        $this->updateSalidaEvidence([$url, $id]);
        return ['status' => 200, 'message' => 'Evidencia actualizada', 'evidence_url' => $url];
    }

    // -- CoffeeIA --

    // Mismo chat que Catálogo y Entradas (ia-chat.js). El adjunto lo lee
    // ctrl-almacen::readArchivo; aquí se empareja con el catálogo y el servidor lo
    // valida: solo entran ids que existen. El costo no se pide: una salida usa el
    // costo del producto. Lo que no está en el catálogo se reporta como faltante.
    // Un administrador también elimina salidas y reinicia los folios: el modelo solo
    // nombra folios, la vista previa sale de la BD y borrar pide su contraseña.
    const IA_MAX_CATALOGO  = 800;
    const IA_MAX_RENGLONES = 100;
    const IA_MAX_LISTA     = 100;
    const IA_MAX_BORRAR    = 200;

    function askSalidaIA() {
        if (empty($_SESSION['company_id'])) return ['status' => 401, 'message' => 'Tu sesión expiró. Vuelve a entrar.'];

        if (!IaOllama::activo($this)) return ['status' => 403, 'message' => 'CoffeeIA está apagado. Se enciende en Administrador > CoffeeIA.'];

        if (!Permissions::can('salidas', 'ia')) return ['status' => 403, 'message' => 'Tu rol no tiene CoffeeIA en Salidas. Se activa en Accesos › Roles, columna IA.'];

        $mensaje   = mb_substr(trim((string) ($_POST['mensaje'] ?? '')), 0, 4000);
        $adjuntos  = json_decode((string) ($_POST['adjuntos'] ?? '[]'), true);
        $historial = json_decode((string) ($_POST['historial'] ?? '[]'), true);
        $adjuntos  = is_array($adjuntos) ? $adjuntos : [];
        $historial = is_array($historial) ? $historial : [];

        if ($mensaje === '' && empty($adjuntos)) {
            return ['status' => 400, 'message' => 'Adjunta la foto de la nota o escríbeme qué sale.'];
        }

        $ia = IaOllama::desdeCredenciales($this);
        if ($ia === null) return ['status' => 503, 'message' => 'La IA no está configurada: falta la llave de Ollama.'];

        $catalogo = array_slice($this->qProductsForTransfer([$this->companiesId]), 0, self::IA_MAX_CATALOGO);
        $salidas  = $this->esAdminIA() ? $this->listSalidasIA(['companies_id' => $this->companiesId]) : null;

        // Sin esto la sesión queda bloqueada mientras el modelo piensa.
        session_write_close();
        set_time_limit(180);

        $r = $ia->chatJson($this->mensajesSalidaIA($mensaje, $adjuntos, $historial, $catalogo, $salidas));
        if (!$r['ok']) return ['status' => 502, 'message' => $r['error']];

        $borrar = $salidas !== null ? $this->borrarSalidaIA($r['data']) : null;
        if ($borrar === null) return ['status' => 200] + $this->validarSalidaIA($r['data'], $catalogo);

        // La vista previa de eliminar queda en sesión: deleteSalidaIA solo borra lo de aquí.
        session_start();
        unset($_SESSION['iaSalidasBorrar']);
        if ($borrar['token'] !== '') $_SESSION['iaSalidasBorrar'] = ['token' => $borrar['token'], 'ids' => $borrar['ids']];
        unset($borrar['ids']);

        return ['status' => 200, 'borrar' => true] + $borrar;
    }

    // Borra de verdad lo que quedó en la vista previa, regresando el stock. Todo o nada.
    function deleteSalidaIA() {
        if (empty($_SESSION['company_id'])) return ['status' => 401, 'message' => 'Tu sesión expiró. Vuelve a entrar.'];
        if (!$this->esAdminIA()) return ['status' => 403, 'message' => 'Solo un administrador puede eliminar salidas.'];
        if (!Permissions::can('salidas', 'ia')) return ['status' => 403, 'message' => 'Tu rol no tiene CoffeeIA en Salidas. Se activa en Accesos › Roles, columna IA.'];

        $pendiente = $_SESSION['iaSalidasBorrar'] ?? null;
        $token     = (string) ($_POST['token'] ?? '');

        if (!is_array($pendiente) || $token === '' || !hash_equals((string) $pendiente['token'], $token)) {
            return ['status' => 409, 'message' => 'Esa vista previa ya no está vigente. Pídeme las salidas otra vez.'];
        }

        $ids = [];
        foreach ((array) json_decode((string) ($_POST['ids'] ?? '[]'), true) as $i) {
            if (is_numeric($i) && isset($pendiente['ids'][(int) $i])) $ids[] = (int) $pendiente['ids'][(int) $i];
        }
        $ids = array_values(array_unique($ids));

        if (empty($ids)) return ['status' => 400, 'message' => 'No marcaste ninguna salida.'];

        // Misma verificación que el login: bcrypt con respaldo MD5 heredado.
        $user  = $this->qUserPassword([$this->userId]);
        $pass  = str_replace("'", "", (string) ($_POST['password'] ?? ''));
        $valid = $user && $pass !== '' && (
            (!empty($user['password']) && password_verify($pass, $user['password'])) ||
            (!empty($user['user_key']) && $user['user_key'] === md5($pass))
        );
        if (!$valid) return ['status' => 401, 'message' => 'Contraseña incorrecta'];

        // Se buscan otra vez: desde la vista previa pudieron borrarlas.
        $vigentes = array_filter($this->listSalidasIA(['companies_id' => $this->companiesId, 'ids' => $ids]), function ($s) {
            return $s['pedido'] === null;
        });
        if (empty($vigentes)) return ['status' => 409, 'message' => 'Esas salidas ya no están para eliminar.'];

        $folios = [];

        try {
            $this->transaction(function () use ($vigentes, &$folios) {
                foreach ($vigentes as $s) $folios[] = $this->deleteSalidaFullById((int) $s['id'], $this->companiesId);
            });
        } catch (\Throwable $e) {
            return ['status' => 500, 'message' => 'No se eliminó ninguna salida: ' . $e->getMessage()];
        }

        unset($_SESSION['iaSalidasBorrar']);

        $n         = count($folios);
        $faltan    = count($ids) - $n;
        $aplicadas = count(array_filter($vigentes, function ($s) { return $s['status'] === 'Aplicada'; }));
        $message   = ($n === 1 ? 'Eliminé la salida ' : "Eliminé {$n} salidas: ") . implode(', ', $folios) . '.';

        if ($aplicadas > 0) $message .= $aplicadas === 1 ? ' Regresé al stock lo que sacó la aplicada.' : " Regresé al stock lo que sacaron las {$aplicadas} aplicadas.";
        if ($faltan > 0)    $message .= $faltan === 1 ? ' 1 ya no estaba.' : " {$faltan} ya no estaban.";

        // Cada sucursal lleva su serie: el siguiente de cada una de las que se tocaron.
        $siguientes = [];
        foreach (array_unique(array_map('intval', array_column($vigentes, 'branch_id'))) as $b) {
            $siguientes[] = $this->nextFolio('S-', 'inventory_shrinkage', $this->companiesId, $b);
            $siguientes[] = $this->nextFolio('SI-', 'inventory_shrinkage', $this->companiesId, $b);
        }

        return [
            'status'  => 200,
            'message' => $message . ' Siguientes folios: ' . implode(', ', $siguientes) . '.',
            'data'    => ['folios' => $folios, 'ids' => array_map('intval', array_column($vigentes, 'id'))]
        ];
    }

    // Folio con el que la serie de la sucursal de sesión vuelve a empezar.
    private function primerFolioSalida($prefix = 'S-') {
        return $prefix . $this->claveFolio($this->branchId, $this->companiesId) . '-0001';
    }

    private function esAdminIA() {
        return (int) ($_SESSION['is_admin'] ?? 0) === 1;
    }

    // `$salidas` = null para quien no es administrador: el modelo no ve la lista y
    // contesta que eliminar no es para él.
    private function mensajesSalidaIA($mensaje, $adjuntos, $historial, $catalogo, $salidas) {
        $filas = array_map(function ($p) {
            return implode(' | ', array_map(function ($v) {
                $v = trim(str_replace(["\r", "\n", '|'], [' ', ' ', '/'], (string) $v));
                return $v === '' ? '-' : $v;
            }, [$p['id'], $p['sku'], $p['nombre'], $p['categoria']]));
        }, $catalogo);

        $sistema = implode("\n", [
            'Eres CoffeeIA y ayudas a capturar una SALIDA de mercancía del almacén (merma, caducidad, consumo interno, surtido). Hablas español, en frases cortas.',
            'Te llega lo que sale: la transcripción de una foto (nota, hoja de merma, lista o ticket), un Excel o lo que la persona escribe.',
            'Por cada renglón con un producto, búscalo en el CATÁLOGO por nombre, SKU o clave, aunque venga abreviado o escrito distinto.',
            '- Si corresponde a un producto del catálogo va en "items", con el "id" del catálogo y en "ref" el texto del renglón.',
            '- Si NO está en el catálogo va en "missing", con el nombre como aparece en el documento.',
            '- Si la persona solo pregunta o no hay productos, "items" y "missing" van vacíos y contestas en "reply".',
            '- No inventes productos ni cantidades. Un renglón que no se lee no se pone.',
            '- Si un producto aparece varias veces, pon un renglón por cada vez que aparece, con su propia cantidad. No las sumes.',
            '- "quantity": cantidad que sale, como número. Si no se ve, 1.',
            '- No pongas costos: la salida usa el costo registrado del producto.',
            '- Como mucho ' . self::IA_MAX_RENGLONES . ' renglones entre "items" y "missing".',
            '',
            'Responde SOLO con un objeto JSON, sin texto antes ni después. La forma:',
            '{"reply": "Encontré 5 productos; 1 no está en el catálogo.", "items": [{"id": 45, "ref": "COCA COLA 600", "quantity": 12}], "missing": [{"name": "Salsa Valentina 1 L", "quantity": 3}]}',
            '',
            $this->reglasBorrarSalidaIA($salidas),
            '',
            'CATÁLOGO (id | sku | nombre | categoría):',
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
            $pregunta .= "\n\nARCHIVO «" . $this->textoSalidaIA($a['nombre'] ?? 'archivo') . "»:\n" . $texto;
            if ($cupo <= 0) break;
        }

        $mensajes[] = ['role' => 'user', 'content' => $pregunta];

        return $mensajes;
    }

    // Eliminar y reiniciar los folios, con la lista de salidas que ve el modelo. Para
    // quien no es administrador, solo la regla de no hacerlo.
    private function reglasBorrarSalidaIA($salidas) {
        if ($salidas === null) {
            return '- Eliminar salidas o reiniciar folios solo lo hace un administrador. Si te lo piden, dilo en "reply" con "items" y "missing" vacíos.';
        }

        $filas = array_map(function ($s) {
            return implode(' | ', array_map(function ($v) {
                $v = trim(str_replace(["\r", "\n", '|'], [' ', ' ', '/'], (string) $v));
                return $v === '' ? '-' : $v;
            }, [
                $s['folio'],
                substr((string) ($s['date_shrinkage'] ?: $s['created_at']), 0, 10),
                $s['status'] . ((int) $s['active'] === 0 ? ' (oculta)' : ''),
                $s['reason_name'],
                $s['branch_name'],
                $s['warehouse_name'],
                number_format((float) $s['total_cost'], 2, '.', ''),
                $s['pedido'],
                mb_strimwidth((string) $s['note'], 0, 60, '…')
            ]));
        }, array_slice($salidas, 0, self::IA_MAX_LISTA));

        return implode("\n", [
            '== ELIMINAR Y REINICIAR LOS FOLIOS (eres administrador) ==',
            '- Folios: S-KAF-0001 es una salida capturada aquí; SI-KAF-0001 es la salida que se genera al surtir un pedido. KAF es la clave de la sucursal: cada sucursal tiene su propia serie. "La 3" es la S- 3 de la sucursal en la que está.',
            '- Si la persona pide ELIMINAR salidas, pon sus folios completos en "eliminar", ej. ["' . $this->primerFolioSalida() . '"]. Tómalos de la lista SALIDAS. No inventes folios.',
            '- Si pide REINICIAR LOS FOLIOS (que la siguiente vuelva a ' . $this->primerFolioSalida() . '), pon "reiniciar": true. Es la serie de la sucursal en la que está: la vista previa trae TODAS sus salidas y el folio solo vuelve a empezar si se eliminan todas.',
            '- Al eliminar, "items" y "missing" van vacíos. Tú no eliminas: la persona revisa la vista previa y confirma con su contraseña. En "reply" di cuántas y que revise la vista previa; no digas que ya se eliminaron.',
            '- Eliminar borra la salida de verdad y, si estaba aplicada, regresa al stock lo que sacó. Una salida que viene de un pedido (columna pedido) no se elimina aquí: va en Pedidos, junto con su pedido.',
            '- Si no queda claro cuáles, pregunta en "reply" y deja "eliminar" vacío.',
            'La forma al eliminar: {"reply": "Te preparo 2 salidas para eliminar.", "items": [], "missing": [], "eliminar": ["S-KAF-0003", "S-KAF-0004"], "reiniciar": false}',
            '',
            'SALIDAS (folio | fecha | estado | tipo | sucursal | almacén | total | pedido | nota), las ' . count($filas) . ' más recientes de ' . count($salidas) . ':',
            $filas ? implode("\n", $filas) : '(ninguna)'
        ]);
    }

    // Vista previa de eliminar si el modelo nombró folios o pidió reiniciar; null si no
    // (entonces es una captura). Las filas salen de la BD, no del modelo.
    private function borrarSalidaIA($data) {
        $reiniciar = is_array($data) && ($data['reiniciar'] ?? false) === true;
        $folios    = [];

        // S-KAF-0003 tal cual; sin clave ("3", "SI-3") es de la sucursal de sesión.
        $clave = $this->claveFolio($this->branchId, $this->companiesId);
        foreach ((array) (is_array($data) ? ($data['eliminar'] ?? []) : []) as $v) {
            $v = strtoupper(preg_replace('/\s+/', '', is_scalar($v) ? (string) $v : ''));
            if (preg_match('/^(SI|S)-([A-Z0-9]+)-(\d+)$/', $v, $m) || preg_match('/^(SI|S)?-?()(\d+)$/', $v, $m)) {
                $folios[] = ($m[1] ?: 'S') . '-' . ($m[2] !== '' ? $m[2] : $clave) . '-' . str_pad((string) (int) $m[3], 4, '0', STR_PAD_LEFT);
            }
        }

        if (!$reiniciar && !$folios) return null;

        // Reiniciar es la serie de la sucursal de sesión: solo sus salidas.
        $reply   = $this->textoSalidaIA($data['reply'] ?? '');
        $salidas = $this->listSalidasIA(['companies_id' => $this->companiesId] + ($reiniciar ? ['branch_ids' => [$this->branchId]] : ['folios' => array_values(array_unique($folios))]));

        if (!$salidas) {
            return ['reply' => $reiniciar ? 'No hay salidas en esta sucursal: el siguiente folio ya es ' . $this->primerFolioSalida() . '.' : 'No encontré esas salidas.', 'token' => '', 'row' => [], 'ids' => []];
        }
        if (count($salidas) > self::IA_MAX_BORRAR) {
            return ['reply' => 'Son ' . count($salidas) . ' salidas; de una vez solo puedo eliminar ' . self::IA_MAX_BORRAR . '. Pídemelas por partes.', 'token' => '', 'row' => [], 'ids' => []];
        }

        $row = [];
        $ids = [];

        foreach ($salidas as $i => $s) {
            $libre = $s['pedido'] === null;
            $nota  = trim((string) $s['note']);

            $row[] = [
                'idx'    => $i,
                'action' => $reiniciar ? 'reset' : 'delete',
                'valid'  => $libre,
                'name'   => $s['folio'],
                'tag'    => $s['status'] . ((int) $s['active'] === 0 ? ' · oculta' : ''),
                'detail' => implode(' · ', array_filter([
                    fechaHoraSalida($s['created_at']),
                    $s['reason_name'],
                    $s['warehouse_name'],
                    '$' . number_format((float) $s['total_cost'], 2),
                    $nota !== '' ? '«' . mb_strimwidth($nota, 0, 60, '…') . '»' : ''
                ])),
                'warn'   => $libre && $s['status'] === 'Aplicada' ? 'Se regresa al stock lo que sacó.' : '',
                'note'   => $libre ? '' : "Viene del pedido {$s['pedido']}: se elimina en Pedidos, junto con su pedido."
            ];

            $ids[$i] = (int) $s['id'];
        }

        $libres  = count(array_filter($row, function ($r) { return $r['valid']; }));
        $ligadas = count($row) - $libres;

        // Sin ninguna que se pueda borrar no hay vista previa que revisar: manda este aviso.
        if ($libres === 0) {
            $reply = 'Ninguna se puede eliminar aquí: ' . ($ligadas === 1 ? 'viene de un pedido' : 'vienen de pedidos') . '. Se eliminan en Pedidos, junto con su pedido.';
        } elseif ($reply === '') {
            $reply = $reiniciar
                ? 'Para que el folio vuelva a ' . $this->primerFolioSalida() . ' hay que eliminar ' . ($libres === 1 ? 'la salida' : "las {$libres} salidas") . '. Revisa la vista previa.'
                : ($libres === 1 ? 'Te preparé 1 salida para eliminar. Revísala.' : "Te preparé {$libres} salidas para eliminar. Revísalas.");
        }
        if ($reiniciar && $ligadas > 0 && $libres > 0) {
            $reply .= "\n" . ($ligadas === 1 ? '1 viene de un pedido' : "{$ligadas} vienen de pedidos") . ': se eliminan en Pedidos, y mientras queden el folio SI- no vuelve a ' . $this->primerFolioSalida('SI-') . '.';
        }

        return ['reply' => $reply, 'token' => $libres ? bin2hex(random_bytes(8)) : '', 'row' => $row, 'ids' => $ids];
    }

    // Vista previa del chat: "add" = producto del catálogo; "missing" = no está y no
    // se puede sacar (se enseña para revisarlo, sin casilla). Un id que no existe no
    // entra como "add": pasa a faltante con su texto. Un producto repetido en la nota
    // queda en renglones separados.
    private function validarSalidaIA($data, $catalogo) {
        $porId   = array_column($catalogo, null, 'id');
        $items   = [];
        $missing = [];

        foreach (array_slice(is_array($data['items'] ?? null) ? $data['items'] : [], 0, self::IA_MAX_RENGLONES) as $it) {
            if (!is_array($it)) continue;

            $id  = (int) ($it['id'] ?? 0);
            $qty = $this->numeroSalidaIA($it['quantity'] ?? null);
            $qty = $qty > 0 ? $qty : 1;

            if (!isset($porId[$id])) {
                $nombre = $this->textoSalidaIA($it['ref'] ?? '');
                if ($nombre !== '') $missing[] = ['nombre' => $nombre, 'cantidad' => $qty];
                continue;
            }

            $items[] = ['id' => (string) $id, 'nombre' => $porId[$id]['nombre'], 'cantidad' => $qty];
        }

        foreach (array_slice(is_array($data['missing'] ?? null) ? $data['missing'] : [], 0, self::IA_MAX_RENGLONES) as $m) {
            $nombre = is_array($m) ? $this->textoSalidaIA($m['name'] ?? '') : '';
            if ($nombre === '') continue;

            $qty       = $this->numeroSalidaIA($m['quantity'] ?? null);
            $missing[] = ['nombre' => $nombre, 'cantidad' => $qty > 0 ? $qty : 1];
        }

        $row = [];

        foreach ($items as $it) {
            $row[] = [
                'idx'        => count($row),
                'action'     => 'add',
                'valid'      => true,
                'name'       => $it['nombre'],
                'sku'        => $porId[$it['id']]['sku'] ?? '',
                'changes'    => [['label' => 'Cantidad', 'after' => (string) $it['cantidad']]],
                'product_id' => $it['id'],
                'cantidad'   => $it['cantidad']
            ];
        }

        foreach ($missing as $m) {
            $row[] = [
                'idx'      => count($row),
                'action'   => 'missing',
                'valid'    => false,
                'name'     => $m['nombre'],
                'note'     => 'No está en el catálogo: no se puede sacar (' . $m['cantidad'] . ').',
                'cantidad' => $m['cantidad']
            ];
        }

        $reply = $this->textoSalidaIA($data['reply'] ?? '');
        if ($reply === '') {
            $reply = empty($row)
                ? 'No encontré productos que sacar.'
                : count($items) . ' en el catálogo' . (count($missing) ? '; ' . count($missing) . ' no están.' : '.');
        }

        return [
            'reply' => $reply,
            'token' => empty($items) ? '' : bin2hex(random_bytes(8)),
            'row'   => $row
        ];
    }

    // Número o texto numérico ("1,250.5"). null si no hay número o es negativo.
    private function numeroSalidaIA($v) {
        if (is_int($v) || is_float($v)) return $v >= 0 ? round((float) $v, 4) : null;
        $v = str_replace(['$', ',', ' '], '', (string) $v);
        return is_numeric($v) && (float) $v >= 0 ? round((float) $v, 4) : null;
    }

    private function textoSalidaIA($v) {
        return mb_substr(trim(strip_tags(is_string($v) ? $v : '')), 0, 200);
    }

    // Los mismos filtros para las cards y para su desglose.
    private function kpiFilters() {
        return [
            'companies_id'    => $this->companiesId,
            'branch_id'       => $_POST['branch_id'] ?? '',
            'reason_id'       => $_POST['reason_id']       ?? '',
            'status'          => $_POST['status']          ?? '',
            'fi'              => $_POST['fi']              ?? '',
            'ff'              => $_POST['ff']              ?? ''
        ];
    }

    private function kpiRowsByReason($filters) {
        $reasons = $this->listSalidasByReason($filters);
        $total   = array_sum(array_column($reasons, 'total_salidas'));

        $row = [];
        foreach ($reasons as $key => $reason) {
            $row[] = [
                'id'             => $key + 1,
                'Tipo de salida' => badge($reason['reason_name'] ?: 'Sin tipo', $reason['reason_color'] ?: '#9CA3AF', 100, $reason['reason_bg'] ?? null, $reason['reason_icon'] ?? null),
                'Registros'      => (int) $reason['total_salidas'],
                'Unidades'       => kpiQuantity($reason['total_unidades']),
                'Valor'          => evaluar((float) $reason['total_costo']),
                'Participación'  => kpiPercent($reason['total_salidas'], $total)
            ];
        }

        if ($row) {
            $row[] = kpiTotalRow([
                'Tipo de salida' => 'Total',
                'Registros'      => $total,
                'Unidades'       => kpiQuantity(array_sum(array_column($reasons, 'total_unidades'))),
                'Valor'          => evaluar(array_sum(array_column($reasons, 'total_costo'))),
                'Participación'  => kpiPercent($total, $total)
            ]);
        }
        return $row;
    }

    private function kpiRowsByProduct($filters, $order) {
        $products = $this->listSalidaProducts(array_merge($filters, ['order' => $order]));
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
            if ($order === 'cost') $cells['Valor'] = evaluar((float) $product['total_costo']);
            $cells['Participación'] = kpiPercent($product[$field], $total);
            $row[] = $cells;
        }

        if ($row) {
            $totals = [
                'Producto' => 'Total',
                'Unidad'   => '',
                'Cantidad' => kpiQuantity(array_sum(array_column($products, 'total_unidades')))
            ];
            if ($order === 'cost') $totals['Valor'] = evaluar($total);
            $totals['Participación'] = kpiPercent($total, $total);
            $row[] = kpiTotalRow($totals);
        }
        return $row;
    }

    // Como la card: las canceladas del periodo, sin importar el filtro de estado.
    private function kpiRowsCancelled($filters) {
        $salidas = $this->qSalidas(array_merge($filters, ['status' => 'Cancelada']));

        $row = [];
        foreach ($salidas as $salida) {
            $row[] = [
                'id'             => $salida['id'],
                'Folio'          => $salida['folio'],
                'Fecha'          => fechaHoraSalida($salida['created_at']),
                'Tipo de salida' => badge($salida['reason_name'], $salida['reason_color'], 100, $salida['reason_bg'] ?? null, $salida['reason_icon'] ?? null),
                'Sucursal'       => $salida['branch_name'] ?: '-',
                'Unidades'       => kpiQuantity($salida['total_units']),
                'Valor'          => evaluar((float) $salida['total_cost_loss'])
            ];
        }

        if ($row) {
            $row[] = kpiTotalRow([
                'Folio'          => 'Total',
                'Fecha'          => '',
                'Tipo de salida' => '',
                'Sucursal'       => '',
                'Unidades'       => kpiQuantity(array_sum(array_column($salidas, 'total_units'))),
                'Valor'          => evaluar(array_sum(array_column($salidas, 'total_cost_loss')))
            ]);
        }
        return $row;
    }
}

// Folio que abre el visor, igual que el ojo (y que el folio de Entradas).
function renderFolioLink($folio, $id) {
    $label = htmlspecialchars($folio, ENT_QUOTES);
    return "<a href='#' onclick=\"salidas.getSalida(" . (int) $id . "); return false;\""
         . " class='font-semibold text-blue-600 underline underline-offset-2 hover:text-blue-700' title='Ver detalle de la salida'>{$label}</a>";
}

// 20/SEP/2026 10:00 AM. El mes va de una lista fija: strftime depende del locale
// del servidor y está obsoleto desde PHP 8.1.
function fechaHoraSalida($fecha) {
    $ts = strtotime((string) $fecha);
    if (!$ts) return '-';
    $meses = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
    return date('d', $ts) . '/' . $meses[(int) date('n', $ts) - 1] . '/' . date('Y h:i A', $ts);
}

function statusBadge($status) {
    // [color de texto, color de fondo] - modelo pastel de 2 colores (igual que los motivos).
    $map = [
        'Aplicada'  => ['#16A34A', '#DCFCE7'],
        'Aplicado'  => ['#16A34A', '#DCFCE7'],
        'Pendiente' => ['#D97706', '#FEF3C7'],
        'Cancelada' => ['#DC2626', '#FEE2E2'],
        'Revertida' => ['#DC2626', '#FEE2E2']
    ];
    $c = $map[$status] ?? ['#475569', '#F1F5F9'];
    return badge(strtoupper($status), $c[0], 100, $c[1]);
}

$obj = new ctrl();
$opc = $_POST['opc'];
if (!method_exists($obj, $opc)) {
    echo json_encode(['status' => 405, 'message' => "opc '{$opc}' no implementado"]);
    exit(0);
}
echo json_encode(Permissions::guard('salidas', $opc, ctrl::PERMISSIONS) ?: $obj->{$opc}());
