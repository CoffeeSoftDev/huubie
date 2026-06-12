<?php
session_start();
if (empty($_POST['opc'])) exit(0);

require_once '../mdl/mdl-inventarios.php';

class ctrl extends mdl {

    public $companiesId;
    public $subsidiariesId;
    public $userId;

    public function __construct() {
        parent::__construct();
        $this->companiesId    = (int) ($_SESSION['COM'] ?? $_SESSION['COMPANY_ID'] ?? $_POST['companies_id']    ?? 4);
        $this->subsidiariesId = (int) ($_SESSION['SUB'] ?? $_POST['subsidiaries_id'] ?? 0);
        $this->userId         = (int) ($_SESSION['USR'] ?? $_SESSION['ID']         ?? $_POST['user_id']         ?? 1);
    }

    // ─────────────────────────────────────────────────────────────────
    //  INIT — payload comun para todos los submodulos
    // ─────────────────────────────────────────────────────────────────

    function init() {
        $productos = array_map(function ($p) {
            return [
                'id'        => (string) $p['id'],
                'sku'       => $p['sku'] ?: '',
                'nombre'    => $p['nombre'],
                'categoria' => $p['categoria'] ?: 'Sin categoria',
                'costo'     => (float) $p['costo'],
                'precio'    => (float) ($p['precio'] ?? 0),
                'stock'     => 0,
                'image'     => $p['image'] ?? '',
                'icon'      => 'package',
                'bg'        => 'bg-gray-700/40',
                'color'     => 'text-gray-300'
            ];
        }, $this->qProductsForTransfer([$this->companiesId]));

        return [
            'status'             => 200,
            'companies_id'       => $this->companiesId,
            'subsidiaries_id'    => $this->subsidiariesId,
            'user_id'            => $this->userId,
            'sucursales'         => $this->lsSucursales([$this->companiesId]),
            'almacenes'          => $this->lsWarehouses(['companies_id' => $this->companiesId]),
            'areas'              => $this->lsAreas([$this->companiesId]),
            'unidades'           => $this->lsUnits(),
            'proveedores'        => $this->lsSuppliers([$this->companiesId]),
            'productos'          => $productos,
            'origenes_entrada'   => $this->lsInflowOrigins(),
            'estados_entrada'    => [
                ['id' => '',          'valor' => 'Todos los estados'],
                ['id' => 'Activas',   'valor' => 'Activas (sin Cancelada)'],
                ['id' => 'Aplicada',  'valor' => 'Aplicada'],
                ['id' => 'Pendiente', 'valor' => 'Pendiente'],
                ['id' => 'Cancelada', 'valor' => 'Cancelada']
            ],
            'motivos_merma'      => $this->lsShrinkageReasons(),
            'motivos_ajuste'     => $this->lsAdjustmentReasons(),
            'categorias'         => $this->lsCategories([])
        ];
    }

    // ─────────────────────────────────────────────────────────────────
    //  AJUSTES
    // ─────────────────────────────────────────────────────────────────

    function lsAjustes() {
        $rows = $this->qAjustes([
            'companies_id'    => $this->companiesId,
            'subsidiaries_id' => $_POST['subsidiaries_id'] ?? '',
            'reason_id'       => $_POST['reason_id']       ?? '',
            'fi'              => $_POST['fi']              ?? '',
            'ff'              => $_POST['ff']              ?? ''
        ]);

        $row = [];
        foreach ($rows as $r) {
            $diff = (float) $r['total_diff_cost'];
            $diffHtml = $diff < 0
                ? '<span class="text-red-400">' . evaluar($diff) . '</span>'
                : '<span class="text-green-400">' . evaluar($diff) . '</span>';

            $row[] = [
                'id'         => $r['id'],
                'Folio'      => $r['folio'],
                'Tipo'       => ucfirst($r['adjustment_type']),
                'Motivo'     => $this->_pillBadge($r['reason_name'], $r['reason_color']),
                'Sucursal'   => $r['subsidiary_name'] ?: '-',
                'Almacen'    => $r['warehouse_name']  ?: '-',
                'Productos'  => (int) $r['total_products'],
                'Diferencia' => $diffHtml,
                'Fecha'      => $r['date_adjustment'] . ' ' . substr($r['time_adjustment'], 0, 5),
                'Estado'     => $this->_statusBadge($r['status']),
                'a' => [
                    [
                        'class'   => 'btn btn-sm btn-secondary me-1',
                        'html'    => '<i class="icon-eye"></i>',
                        'onclick' => "ajustes.getAjuste({$r['id']})"
                    ]
                ]
            ];
        }
        return ['status' => 200, 'row' => $row];
    }

    function showAjustes() {
        $kpis = $this->getAjusteKpis([
            'companies_id' => $this->companiesId,
            'fi'           => $_POST['fi'] ?? '',
            'ff'           => $_POST['ff'] ?? ''
        ]);
        return ['status' => 200, 'counts' => $kpis];
    }

    function getAjuste() {
        $id     = (int) $_POST['id'];
        $header = $this->qGetAjuste([$id]);
        if (!$header) return ['status' => 404, 'message' => 'Ajuste no encontrado'];
        $detail = $this->qGetAjusteDetail([$id]);
        return ['status' => 200, 'header' => $header, 'detail' => $detail];
    }

    function saveAjuste() {
        $payload   = json_decode($_POST['payload'] ?? '[]', true);
        $productos = $payload['productos'] ?? [];

        if (empty($productos)) {
            return ['status' => 400, 'message' => 'No se enviaron renglones'];
        }

        $folio          = $this->nextFolio('AJU-', 'inventory_adjustment', $this->companiesId);
        $totalProducts  = count($productos);
        $totalDiffUnits = 0;
        $totalDiffCost  = 0;
        foreach ($productos as $p) {
            $diff           = (float) $p['physical_quantity'] - (float) $p['system_quantity'];
            $totalDiffUnits += $diff;
            $totalDiffCost  += $diff * (float) $p['cost'];
        }

        $ok = $this->insertAjuste([
            $folio,
            $payload['note']            ?? null,
            $payload['adjustment_type'] ?? 'individual',
            $totalProducts,
            $totalDiffUnits,
            $totalDiffCost,
            $payload['date_adjustment'] ?? date('Y-m-d'),
            $payload['time_adjustment'] ?? date('H:i:s'),
            $payload['status']          ?? 'Aplicado',
            (int) $payload['adjustment_reason_id'],
            (int) $payload['warehouse_id'],
            (int) ($payload['subsidiaries_id'] ?? $this->subsidiariesId),
            $this->userId,
            !empty($payload['authorized_user_id']) ? (int) $payload['authorized_user_id'] : null,
            $this->companiesId
        ]);

        if (!$ok) return ['status' => 500, 'message' => 'No se pudo registrar el ajuste'];

        $ajusteRow = $this->_Read(
            "SELECT id FROM {$this->bd}inventory_adjustment WHERE folio = ? AND companies_id = ? LIMIT 1",
            [$folio, $this->companiesId]
        );
        $ajusteId = (int) ($ajusteRow[0]['id'] ?? 0);

        foreach ($productos as $p) {
            $productId = (int) $p['product_id'];
            $warehouse = (int) $payload['warehouse_id'];
            $sys       = (float) $p['system_quantity'];
            $phys      = (float) $p['physical_quantity'];
            $diff      = $phys - $sys;
            $cost      = (float) $p['cost'];

            $stockRow = $this->getStockRow([$productId, $warehouse]);
            $prev     = $stockRow ? (float) $stockRow['quantity'] : 0;
            $post     = max(0, $prev + $diff);

            $this->insertAjusteDetail([
                $sys,
                $phys,
                $diff,
                $cost,
                $diff * $cost,
                $prev,
                $post,
                $productId,
                $ajusteId
            ]);

            if ($stockRow) {
                if (($payload['adjustment_type'] ?? '') === 'fisico') {
                    $this->updateStockLastInventory([$post, (int) $stockRow['id']]);
                } else {
                    $this->updateStockQuantity([$post, (int) $stockRow['id']]);
                }
            } else {
                $this->insertStockRow([$post, $warehouse, $productId, $this->companiesId]);
            }
        }

        return ['status' => 200, 'message' => 'Ajuste registrado', 'folio' => $folio, 'id' => $ajusteId];
    }

    function reverseAjuste() {
        $id = (int) $_POST['id'];
        $r  = $this->qReverseAjuste([$id]);
        return [
            'status'  => $r ? 200 : 500,
            'message' => $r ? 'Ajuste cancelado' : 'No se pudo cancelar'
        ];
    }

    // ─────────────────────────────────────────────────────────────────
    //  ADMIN ALMACENES / PRODUCT ATTRIBUTE
    // ─────────────────────────────────────────────────────────────────

    function lsAlmacenes() {
        $rows = $this->lsWarehouses([
            'companies_id'    => $this->companiesId,
            'subsidiaries_id' => $_POST['subsidiaries_id'] ?? ''
        ]);
        $row = [];
        foreach ($rows as $r) {
            $row[] = [
                'id'         => $r['id'],
                'Almacen'    => $r['name'],
                'Sucursal'   => $r['subsidiary_name'] ?: '-',
                'Area'       => $r['area_name'] ?: '-',
                'Default'    => $r['is_default'] ? 'Si' : 'No',
                'a' => [
                    ['class' => 'btn btn-sm btn-primary me-1', 'html' => '<i class="icon-pencil"></i>', 'onclick' => "almacenes.edit({$r['id']})"],
                    ['class' => 'btn btn-sm btn-danger', 'html' => '<i class="icon-trash-empty"></i>', 'onclick' => "almacenes.remove({$r['id']})"]
                ]
            ];
        }
        return ['status' => 200, 'row' => $row];
    }

    function saveAlmacen() {
        $ok = $this->insertWarehouse([
            $_POST['name'],
            (int) ($_POST['is_default'] ?? 0),
            !empty($_POST['warehouse_area_id']) ? (int) $_POST['warehouse_area_id'] : null,
            (int) $_POST['subsidiaries_id'],
            $this->companiesId
        ]);
        return ['status' => $ok ? 200 : 500, 'message' => $ok ? 'Almacen creado' : 'Error al crear'];
    }

    function editAlmacen() {
        $values = $this->util->sql([
            'name'              => $_POST['name'],
            'is_default'        => (int) ($_POST['is_default'] ?? 0),
            'warehouse_area_id' => !empty($_POST['warehouse_area_id']) ? (int) $_POST['warehouse_area_id'] : null,
            'subsidiaries_id'   => (int) $_POST['subsidiaries_id'],
            'id'                => (int) $_POST['id']
        ], 1);
        $r = $this->updateWarehouse($values);
        return ['status' => $r ? 200 : 500, 'message' => $r ? 'Almacen actualizado' : 'Error al actualizar'];
    }

    function removeAlmacen() {
        $r = $this->disableWarehouse([(int) $_POST['id']]);
        return ['status' => $r ? 200 : 500, 'message' => $r ? 'Almacen desactivado' : 'Error'];
    }

    function saveProductAttribute() {
        $ok = $this->insertProductAttribute([
            $_POST['sku'],
            $_POST['description'] ?? null,
            !empty($_POST['shelf_life_days']) ? (int) $_POST['shelf_life_days'] : null,
            (float) ($_POST['cost_unit'] ?? 0),
            (float) ($_POST['stock_min'] ?? 0),
            (float) ($_POST['stock_max'] ?? 0),
            !empty($_POST['warehouse_area_id']) ? (int) $_POST['warehouse_area_id'] : null,
            !empty($_POST['unit_id']) ? (int) $_POST['unit_id'] : null,
            (int) $_POST['product_id'],
            $this->companiesId
        ]);
        return ['status' => $ok ? 200 : 500, 'message' => $ok ? 'Atributo guardado' : 'Error al guardar'];
    }

    // ─────────────────────────────────────────────────────────────────
    //  HELPERS DE PRESENTACION
    // ─────────────────────────────────────────────────────────────────


    private function _statusBadge($status) {
        $map = [
            'Aplicada'  => ['bg' => 'rgba(63,193,137,0.18)', 'fg' => '#3FC189'],
            'Aplicado'  => ['bg' => 'rgba(63,193,137,0.18)', 'fg' => '#3FC189'],
            'Pendiente' => ['bg' => 'rgba(251,191,36,0.18)', 'fg' => '#FBBF24'],
            'Cancelada' => ['bg' => 'rgba(224,36,36,0.18)',  'fg' => '#E02424'],
            'Cancelado' => ['bg' => 'rgba(224,36,36,0.18)',  'fg' => '#E02424']
        ];
        $c = $map[$status] ?? ['bg' => 'rgba(156,163,175,0.18)', 'fg' => '#9CA3AF'];
        return "<span class='px-2 py-0.5 rounded text-[10px] font-bold' style='background:{$c['bg']};color:{$c['fg']};'>" . strtoupper($status) . "</span>";
    }

    private function _pillBadge($label, $colorHex) {
        $label = $label ?: '-';
        $color = $colorHex ?: '#9CA3AF';
        $hex   = ltrim($color, '#');
        $r = hexdec(substr($hex, 0, 2));
        $g = hexdec(substr($hex, 2, 2));
        $b = hexdec(substr($hex, 4, 2));
        $bg = "rgba($r,$g,$b,0.18)";
        return "<span class='px-2 py-0.5 rounded text-[10px] font-bold' style='background:{$bg};color:{$color};'>{$label}</span>";
    }
}

$obj = new ctrl();
$opc = $_POST['opc'];
if (!method_exists($obj, $opc)) {
    echo json_encode(['status' => 405, 'message' => "opc '{$opc}' no implementado"]);
    exit(0);
}
echo json_encode($obj->{$opc}());
