<?php
session_start();
if (empty($_POST['opc'])) exit(0);

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

require_once '../mdl/mdl-entradas.php';
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
        $productos = array_map(function ($p) {
            return [
                'id'        => (string) $p['id'],
                'sku'       => $p['sku'] ?: '',
                'nombre'    => $p['nombre'],
                'categoria' => $p['categoria'] ?: 'Sin categoria',
                'costo'     => (float) $p['costo'],
                'precio'    => (float) ($p['precio'] ?? 0),
                // Defaults de impuesto que el formulario precarga por renglon:
                // base sin tax y porcentaje vienen del item (catalogo).
                'price_without_tax' => $p['price_without_tax'] !== null ? (float) $p['price_without_tax'] : null,
                'tax'               => $p['tax'] !== null ? (float) $p['tax'] : null,
                'stock'     => 0,
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
            'sucursales'       => $this->lsSucursales(['company_id' => $this->companiesId, 'user_id' => $this->userId, 'is_owner' => (int) ($_SESSION['is_owner'] ?? 0)]),
            'almacenes'        => $this->lsWarehouses(['companies_id' => $this->companiesId]),
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

    function lsEntradas() {
        $rows = $this->qEntradas([
            'companies_id'    => $this->companiesId,
            'branch_id'       => $_POST['branch_id'] ?? '',
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
                    'class'   => 'inline-flex items-center justify-center w-9 h-9 p-2 text-[#9CA3AF] hover:text-[#C05A40] transition-colors cursor-pointer bg-transparent border-0',
                    'html'    => '<i data-lucide="eye" class="w-4 h-4"></i>',
                    'onclick' => "app.selectEntrada('{$r['folio']}', {$r['id']})"
                ]
            ];

            $row[] = [
                'id'         => $r['id'],
                'Folio'      => $r['folio'],
                'Fecha'      => formatSpanishDate($r['date_inflow']),
                'Origen'     => badge($r['origin_name'], $r['origin_color'], 100, $r['origin_bg'] ?? null),
                'Sucursal'   => $r['branch_name'] ?: '-',
                'Almacen'    => $r['warehouse_name']  ?: '-',
                'Proveedor'  => $r['supplier_name']   ?: '<span class="italic text-gray-400">N/A</span>',
                'Productos'  => (int) $r['total_products'],
                'Costo'      => evaluar((float) $r['total_cost']),
                'Estado'     => $this->statusBadge($r['status']),
                'Registrado' => $r['user_name'] ?: '-',
                'a'          => $a
            ];
        }
        return ['status' => 200, 'row' => $row];
    }

    function showEntradas() {
        $kpis = $this->getEntradaKpis([
            'companies_id'    => $this->companiesId,
            'branch_id'       => $_POST['branch_id'] ?? '',
            'origin_id'       => $_POST['origin_id']       ?? '',
            'status'          => $_POST['status']          ?? '',
            'fi'              => $_POST['fi']              ?? '',
            'ff'              => $_POST['ff']              ?? '',
            'q'               => $_POST['q']               ?? ''
        ]);
        return ['status' => 200, 'counts' => $kpis];
    }

    function getEntrada() {
        $id     = (int) $_POST['id'];
        $header = $this->qGetEntrada([$id]);
        if (!$header) return ['status' => 404, 'message' => 'Entrada no encontrada'];
        // Badge del origen con la misma formula y color (color_hex) que el catalogo y la tabla.
        $header['origin_badge'] = badge($header['origin_name'] ?? '', $header['origin_color'] ?? '#9CA3AF', 100, $header['origin_bg'] ?? null);
        $detail = $this->qGetEntradaDetail([$id]);
        return ['status' => 200, 'header' => $header, 'detail' => $detail];
    }

    function createSupplier() {
        $name = trim($_POST['name'] ?? '');
        if ($name === '') {
            return ['status' => 400, 'message' => 'El nombre del proveedor es obligatorio'];
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
            trim($_POST['phone'] ?? '') ?: null,
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

        $origin       = $this->getInflowOrigin([(int) $payload['inflow_origin_id']]);
        $isProduction = $origin && strtoupper($origin['code']) === 'PRODUCCION';
        $status       = $isProduction ? 'Pendiente' : 'Aplicada';

        // El origen exige proveedor segun la columna requires_supplier (por dato, no por code).
        if ($origin && (int) ($origin['requires_supplier'] ?? 0) === 1 && empty($payload['supplier_id'])) {
            return ['status' => 400, 'message' => 'Este origen requiere seleccionar un proveedor'];
        }

        $folio = $this->nextFolio('ENT-', 'inventory_inflow', $this->companiesId);

        // Normaliza el desglose de impuesto por renglon. tax es el porcentaje
        // (0, 8, 16...) y el COSTO CON IMPUESTO es el valor pivote (lo que captura
        // el usuario): la base sin impuesto se deriva = cost / (1 + tax/100). Si
        // el front solo mandara la base, reconstruimos el costo.
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

            // Reflejamos el ultimo costo capturado en el catalogo del item.
            $this->updateItemTax([$cost, $base, $tax, $productId, $this->companiesId]);

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

    function reverseEntrada() {
        $id     = (int) $_POST['id'];
        $header = $this->qGetEntrada([$id]);

        if (!$header) {
            return ['status' => 404, 'message' => 'Entrada no encontrada'];
        }
        if ($header['status'] === 'Cancelada') {
            return ['status' => 400, 'message' => 'La entrada ya esta cancelada'];
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
        return [
            'status'  => $r ? 200 : 500,
            'message' => $r ? 'Entrada cancelada' : 'No se pudo cancelar'
        ];
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
                'price_without_tax' => $it['price_without_tax'] !== null ? (float) $it['price_without_tax'] : null,
                'tax'               => $it['tax'] !== null ? (float) $it['tax'] : null,
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

$obj = new ctrl();
$opc = $_POST['opc'];
if (!method_exists($obj, $opc)) {
    echo json_encode(['status' => 405, 'message' => "opc '{$opc}' no implementado"]);
    exit(0);
}
echo json_encode($obj->{$opc}());
