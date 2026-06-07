<?php
session_start();
if (empty($_POST['opc'])) exit(0);

header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Requested-With");

require_once '../mdl/mdl-salidas.php';
require_once '../../../conf/coffeSoft.php';

class ctrl extends mdl {

    public $companiesId;
    public $subsidiariesId;
    public $userId;

    public function __construct() {
        parent::__construct();
        $this->companiesId    = (int) ($_SESSION['company_id']    ?? $_POST['companies_id']    ?? 0);
        $this->subsidiariesId = (int) ($_SESSION['branch_id'] ?? $_POST['subsidiaries_id'] ?? 0);
        $this->userId         = (int) ($_SESSION['user_id']         ?? $_POST['user_id']         ?? 0);
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
                'icon'      => 'package',
                'bg'        => 'bg-gray-700/40',
                'color'     => 'text-gray-300'
            ];
        }, $this->qProductsForTransfer([$this->companiesId]));

        return [
            'status'          => 200,
            'companies_id'    => $this->companiesId,
            'subsidiaries_id' => $this->subsidiariesId,
            'user_id'         => $this->userId,
            'sucursales'      => $this->lsSucursales([$this->companiesId]),
            'almacenes'       => $this->lsWarehouses(['companies_id' => $this->companiesId]),
            'motivos_salida'   => $this->lsShrinkageReasons(),
            'productos'       => $productos
        ];
    }

    function lsSalidas() {
        $rows = $this->qSalidas([
            'companies_id'    => $this->companiesId,
            'subsidiaries_id' => $_POST['subsidiaries_id'] ?? '',
            'reason_id'       => $_POST['reason_id']       ?? '',
            'fi'              => $_POST['fi']              ?? '',
            'ff'              => $_POST['ff']              ?? '',
            'q'               => $_POST['q']               ?? ''
        ]);

        $row = [];
        foreach ($rows as $salida) {
            $row[] = [
                'id'         => $salida['id'],
                'Folio'      => $salida['folio'],
                'Motivo'     => badge($salida['reason_name'], $salida['reason_color']),
                'Sucursal'   => $salida['subsidiary_name'] ?: '-',
                'Almacen'    => $salida['warehouse_name']  ?: '-',
                'Productos'  => (int) $salida['total_products'],
                'Unidades'   => (float) $salida['total_units'],
                'Costo'      => '<span class="text-red-400">' . evaluar((float) $salida['total_cost_loss']) . '</span>',
                'Fecha'      => date('Y-m-d H:i', strtotime($salida['created_at'])),
                'Estado'     => statusBadge($salida['status']),
                'Registrado' => $salida['user_name'] ?: '-',
                'a' => [
                    [
                        'class'   => 'btn btn-sm btn-secondary me-1',
                        'html'    => '<i class="icon-eye"></i>',
                        'onclick' => "salidas.getSalida({$salida['id']})"
                    ]
                ]
            ];
        }
        return ['status' => 200, 'row' => $row];
    }

    function showSalidas() {
        $kpis = $this->getSalidaKpis([
            'companies_id'    => $this->companiesId,
            'subsidiaries_id' => $_POST['subsidiaries_id'] ?? '',
            'fi'              => $_POST['fi']              ?? '',
            'ff'              => $_POST['ff']              ?? ''
        ]);
        return ['status' => 200, 'counts' => $kpis];
    }

    function getSalida() {
        $id     = (int) $_POST['id'];
        $header = $this->qGetSalida([$id]);
        if (!$header) return ['status' => 404, 'message' => 'Salida no encontrada'];
        $detail = $this->getSalidaDetail([$id]);
        return ['status' => 200, 'header' => $header, 'detail' => $detail];
    }

    function saveSalida() {
        $payload   = json_decode($_POST['payload'] ?? '[]', true);
        $productos = $payload['productos'] ?? [];

        if (empty($productos)) {
            return ['status' => 400, 'message' => 'No se enviaron renglones'];
        }

        $folio         = $this->nextFolio('M-', 'inventory_shrinkage', $this->companiesId);
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
            (int) ($payload['subsidiaries_id'] ?? $this->subsidiariesId),
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
            $post     = max(0, $prev - $qty);

            $this->insertSalidaDetail([
                $qty,
                $cost,
                $qty * $cost,
                $prev,
                $post,
                $productId,
                $salidaId
            ]);

            if ($stockRow) {
                $this->updateStockQuantity([$post, (int) $stockRow['id']]);
            }
        }

        return ['status' => 200, 'message' => 'Salida registrada', 'folio' => $folio, 'id' => $salidaId];
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
}

function statusBadge($status) {
    $colors = [
        'Aplicada'  => '#014737',
        'Aplicado'  => '#014737',
        'Pendiente' => '#633112',
        'Cancelada' => '#572A34',
        'Revertida' => '#572A34'
    ];
    return badge(strtoupper($status), $colors[$status] ?? '#2D3748');
}

$obj = new ctrl();
$opc = $_POST['opc'];
if (!method_exists($obj, $opc)) {
    echo json_encode(['status' => 405, 'message' => "opc '{$opc}' no implementado"]);
    exit(0);
}
echo json_encode($obj->{$opc}());
