<?php
require_once __DIR__ . '/../../../conf/_Session.php';
if (empty($_POST['opc'])) exit(0);

if (empty($_SESSION['company_id'])) {
    echo json_encode(['status' => 401, 'message' => 'La sesión expiró, vuelve a entrar']);
    exit(0);
}

require_once '../mdl/mdl-compras.php';
require_once '../../../conf/coffeSoft.php';

class ctrl extends mdl {

    public $companiesId;
    public $branchId;
    public $userId;

    public function __construct() {
        parent::__construct();
        $this->companiesId = (int) $_SESSION['company_id'];
        $this->branchId    = (int) $_SESSION['branch_id'];
        $this->userId      = (int) $_SESSION['user_id'];
    }

    function init() {
        $productos = [];
        foreach ($this->lsProductos([$this->companiesId]) as $producto) {
            $productos[] = [
                'id'                => (string) $producto['id'],
                'sku'               => $producto['sku'] ?: '',
                'nombre'            => $producto['nombre'],
                'categoria'         => $producto['categoria'] ?: 'Sin categoria',
                'costo'             => (float) $producto['costo'],
                'price_without_tax' => (float) $producto['costo_sin_iva'],
                'tax'               => (float) $producto['iva_compra'],
                'unit_id'           => $producto['unit_id'],
                'unidad'            => $producto['unidad'] ?: '',
                'stock'             => 0,
                'descripcion'       => $producto['descripcion'] ?: '',
                'stock_max'         => (float) $producto['stock_max'],
                'image'             => $producto['image'] ?: '',
                'icon'              => 'package',
                'bg'                => 'bg-gray-100',
                'color'             => 'text-gray-500'
            ];
        }

        return [
            'status'      => 200,
            'branch_id'   => $this->branchId,
            'sucursales'  => $this->lsSucursales([
                'company_id' => $this->companiesId,
                'user_id'    => $this->userId,
                'is_owner'   => (int) $_SESSION['is_owner']
            ]),
            'almacenes'   => $this->lsWarehouses([$this->companiesId]),
            'proveedores' => $this->lsSuppliers([$this->companiesId]),
            'categorias'  => $this->lsCategorias([$this->companiesId]),
            'unidades'    => $this->lsUnidades([$this->companiesId]),
            'compradores' => $this->lsBuyers([$this->companiesId]),
            'productos'   => $productos,
            'tipos'       => [
                ['id' => '',           'valor' => 'Todos los tipos'],
                ['id' => 'Rutina',     'valor' => 'Rutina'],
                ['id' => 'Programada', 'valor' => 'Programada'],
                ['id' => 'Esporadica', 'valor' => 'Esporádica']
            ],
            'estados'     => [
                ['id' => 'Activas',    'valor' => 'Por surtir y en surtido'],
                ['id' => 'Pendiente',  'valor' => 'Pendiente'],
                ['id' => 'En surtido', 'valor' => 'En surtido'],
                ['id' => 'Capturada',  'valor' => 'Capturada'],
                ['id' => 'Cancelada',  'valor' => 'Cancelada'],
                ['id' => 'Todas',      'valor' => 'Todas']
            ]
        ];
    }

    function lsCompras() {
        $compras = $this->listCompras([
            'companies_id'  => $this->companiesId,
            'branch_id'     => $_POST['branch_id'],
            'purchase_type' => $_POST['purchase_type'],
            'status'        => $_POST['status'],
            'fi'            => $_POST['fi'],
            'ff'            => $_POST['ff'],
            'q'             => trim($_POST['q'])
        ]);

        $today = date('Y-m-d');
        $__row = [];

        foreach ($compras as $compra) {
            $__row[] = [
                'id'         => $compra['id'],
                'Folio'      => $compra['folio'],
                'Compra'     => renderCompra($compra),
                'Tipo'       => renderTipo($compra['purchase_type']),
                'Fecha'      => renderFecha($compra['date_order'], $compra['status'], $today),
                'Surte'      => $compra['buyer_name'] ?: '<span class="italic text-gray-400">Sin asignar</span>',
                'Materiales' => (int) $compra['total_products'],
                'Importe'    => [
                    'html'  => renderImporte($compra['total_cost'], $compra['status']),
                    'class' => 'text-end'
                ],
                'Estado'     => renderStatus($compra['status']),
                'a'          => actionButtons($compra['id'])
            ];
        }

        return ['status' => 200, 'row' => $__row, 'thead' => ''];
    }

    function showCompras() {
        $counts = $this->getCompraCounts([
            'companies_id'  => $this->companiesId,
            'branch_id'     => $_POST['branch_id'],
            'purchase_type' => $_POST['purchase_type'],
            'fi'            => $_POST['fi'],
            'ff'            => $_POST['ff'],
            'q'             => trim($_POST['q']),
            'today'         => date('Y-m-d')
        ]);

        return ['status' => 200, 'counts' => $counts];
    }

    function lsCalendario() {
        $events = [];
        $compras = $this->listCompraEvents([
            'companies_id'  => $this->companiesId,
            'branch_id'     => $_POST['branch_id'],
            'purchase_type' => $_POST['purchase_type'],
            'fi'            => $_POST['fi'],
            'ff'            => $_POST['ff']
        ]);

        foreach ($compras as $compra) {
            $events[] = [
                'id'            => $compra['id'],
                'title'         => $compra['name'] ?: $compra['folio'],
                'start'         => $compra['date_order'],
                'allDay'        => true,
                'extendedProps' => [
                    'folio'          => $compra['folio'],
                    'purchase_type'  => $compra['purchase_type'],
                    'status'         => $compra['status'],
                    'buyer_name'     => $compra['buyer_name'] ?: '',
                    'total_products' => (int) $compra['total_products']
                ]
            ];
        }

        return ['status' => 200, 'events' => $events];
    }

    function lsPlantillas() {
        $plantillas = [];
        $nombres    = [];

        foreach ($this->listCompraTemplates([$this->companiesId]) as $compra) {
            $clave = mb_strtolower(trim($compra['name']));
            if (isset($nombres[$clave])) continue;

            $nombres[$clave] = true;
            $plantillas[]    = [
                'id'    => $compra['id'],
                'valor' => $compra['folio'] . ' · ' . $compra['name'] . ' · ' . formatDate($compra['date_order'])
            ];
        }

        return ['status' => 200, 'plantillas' => $plantillas];
    }

    function getCompra() {
        $compra = $this->getCompraById([(int) $_POST['id'], $this->companiesId]);
        if (!$compra) return ['status' => 404, 'message' => 'Compra no encontrada'];

        return $this->compraResponse($compra);
    }

    function addCompra() {
        $payload = $this->payloadCompra();
        $error   = $this->validateCompra($payload, true);
        if ($error) return ['status' => 400, 'message' => $error];

        $isRutina = $payload['purchase_type'] === 'Rutina';
        $fechas   = $isRutina
            ? routineDates($payload['date_order'], $payload['weekdays'], (int) $payload['weeks'])
            : [$payload['date_order']];

        if (!$fechas) {
            return ['status' => 400, 'message' => 'La rutina no tiene fechas: elige al menos un día de la semana'];
        }

        $payload['series_code'] = $isRutina ? $this->nextSeriesCode() : null;
        $productos              = normalizeProductos($payload['productos']);

        try {
            $folios = $this->transaction(function () use ($payload, $productos, $fechas) {
                $folios = [];
                foreach ($fechas as $fecha) {
                    $folios[] = $this->createCompraWithDetail($payload, $productos, $fecha);
                }
                return $folios;
            });
        } catch (\Throwable $e) {
            return ['status' => 500, 'message' => 'No se pudo guardar la compra: ' . $e->getMessage()];
        }

        $message = $isRutina
            ? 'Rutina programada: ' . count($folios) . ' compras, del ' . formatDate($fechas[0]) . ' al ' . formatDate(end($fechas))
            : 'Compra ' . $folios[0] . ' guardada';

        return [
            'status'  => 200,
            'message' => $message,
            'id'      => $this->getCompraIdByFolio([$folios[0], $this->companiesId]),
            'folio'   => $folios[0]
        ];
    }

    function editCompra() {
        $compra = $this->getCompraById([(int) $_POST['id'], $this->companiesId]);
        if (!$compra) return ['status' => 404, 'message' => 'Compra no encontrada'];
        if ($compra['status'] !== 'Pendiente') {
            return ['status' => 400, 'message' => 'Solo se edita una compra pendiente; si ya imprimiste la hoja, cancélala y retómala'];
        }

        $payload = $this->payloadCompra();
        $payload['purchase_type'] = $compra['purchase_type'];
        $error = $this->validateCompra($payload, false);
        if ($error) return ['status' => 400, 'message' => $error];

        $productos = normalizeProductos($payload['productos']);
        $totales   = totalsProductos($productos);

        try {
            $this->transaction(function () use ($compra, $payload, $productos, $totales) {
                $this->updateCompra($this->util->sql([
                    'name'                    => $payload['name'],
                    'date_order'              => $payload['date_order'],
                    'branch_id'               => $payload['branch_id'] ?: $compra['branch_id'],
                    'warehouse_id'            => $payload['warehouse_id'] ?: null,
                    'buyer_name'              => $payload['buyer_name'],
                    'note'                    => $payload['note'],
                    'total_products'          => $totales['products'],
                    'total_units'             => $totales['units'],
                    'total_cost'              => $totales['cost'],
                    'total_price_without_tax' => $totales['base'],
                    'id'                      => $compra['id']
                ], 1));

                $this->disableCompraDetail([$compra['id']]);
                foreach ($productos as $producto) {
                    $this->createCompraDetail($this->util->sql(detailRow($compra['id'], $producto)));
                }
            });
        } catch (\Throwable $e) {
            return ['status' => 500, 'message' => 'No se pudo guardar la compra: ' . $e->getMessage()];
        }

        return ['status' => 200, 'message' => 'Compra ' . $compra['folio'] . ' actualizada', 'id' => (int) $compra['id']];
    }

    function cancelCompra() {
        $compra = $this->getCompraById([(int) $_POST['id'], $this->companiesId]);
        if (!$compra) return ['status' => 404, 'message' => 'Compra no encontrada'];
        if (!in_array($compra['status'], ['Pendiente', 'En surtido'], true)) {
            return ['status' => 400, 'message' => 'Solo se cancela una compra que aún no se captura'];
        }

        $update = $this->updateCompra($this->util->sql([
            'status' => 'Cancelada',
            'id'     => $compra['id']
        ], 1));

        return [
            'status'  => $update ? 200 : 500,
            'message' => $update ? 'Compra ' . $compra['folio'] . ' cancelada' : 'No se pudo cancelar la compra'
        ];
    }

    // La primera impresión entrega la hoja a quien surte: la compra pasa a En surtido.
    function printCompra() {
        $compra = $this->getCompraById([(int) $_POST['id'], $this->companiesId]);
        if (!$compra) return ['status' => 404, 'message' => 'Compra no encontrada'];

        if ($compra['status'] === 'Pendiente') {
            $this->updateCompra($this->util->sql([
                'status'     => 'En surtido',
                'printed_at' => date('Y-m-d H:i:s'),
                'id'         => $compra['id']
            ], 1));
            $compra = $this->getCompraById([(int) $compra['id'], $this->companiesId]);
        }

        return $this->compraResponse($compra);
    }

    // Lo surtido entra al almacén como una entrada ENT- (origen Compra o Compra sin
    // proveedor) ligada a la compra por inventory_inflow.purchase_order_id.
    function captureCompra() {
        $payload = json_decode($_POST['payload'], true);
        if (!is_array($payload)) return ['status' => 400, 'message' => 'No llegó la captura'];

        $payload += ['id' => 0, 'warehouse_id' => 0, 'supplier_id' => 0, 'date' => '', 'buyer_name' => '', 'note' => '', 'items' => [], 'extras' => []];

        $compra = $this->getCompraById([(int) $payload['id'], $this->companiesId]);
        if (!$compra) return ['status' => 404, 'message' => 'Compra no encontrada'];
        if (!in_array($compra['status'], ['Pendiente', 'En surtido'], true)) {
            return ['status' => 400, 'message' => 'Esta compra ya no se puede capturar'];
        }

        $warehouseId = (int) $payload['warehouse_id'];
        if (!in_array($warehouseId, array_map('intval', array_column($this->lsWarehouses([$this->companiesId]), 'id')), true)) {
            return ['status' => 400, 'message' => 'Elige el almacén al que entra lo surtido'];
        }

        $fecha = $payload['date'] ?: date('Y-m-d');
        if (!validDate($fecha) || $fecha > date('Y-m-d')) {
            return ['status' => 400, 'message' => 'La fecha de surtido no puede ser posterior a hoy'];
        }

        $detalle = [];
        foreach ($this->listCompraDetail([$compra['id']]) as $renglon) {
            $detalle[(string) $renglon['id']] = $renglon;
        }

        $catalogo = [];
        foreach ($this->lsProductos([$this->companiesId]) as $producto) {
            $catalogo[(string) $producto['id']] = $producto;
        }

        $lineas = [];
        foreach ($payload['items'] as $item) {
            $renglon = $detalle[(string) $item['detail_id']] ?? null;
            if (!$renglon) continue;

            $lineas[] = [
                'detail_id'  => (int) $renglon['id'],
                'product_id' => (int) $renglon['product_id'],
                'nombre'     => $renglon['product_name'],
                'unit_id'    => $renglon['unit_id'],
                'tax'        => (float) $renglon['tax'],
                'quantity'   => max(0, (float) $item['quantity']),
                'total'      => max(0, (float) $item['total']),
                'place'      => trim((string) $item['place'])
            ];
        }

        foreach ($payload['extras'] as $extra) {
            $producto = $catalogo[(string) $extra['product_id']] ?? null;
            if (!$producto) continue;

            $lineas[] = [
                'detail_id'  => 0,
                'product_id' => (int) $producto['id'],
                'nombre'     => $producto['nombre'],
                'unit_id'    => $producto['unit_id'],
                'tax'        => (float) $producto['iva_compra'],
                'quantity'   => max(0, (float) $extra['quantity']),
                'total'      => max(0, (float) $extra['total']),
                'place'      => trim((string) $extra['place'])
            ];
        }

        $surtidas = array_values(array_filter($lineas, function ($linea) {
            return $linea['quantity'] > 0;
        }));
        if (!$surtidas) {
            return ['status' => 400, 'message' => 'No se surtió nada. Si ya no se va a comprar, cancela la compra'];
        }
        foreach ($surtidas as $linea) {
            if ($linea['total'] <= 0) return ['status' => 400, 'message' => 'Falta el costo de ' . $linea['nombre']];
        }

        $supplierId = (int) $payload['supplier_id'];
        if ($supplierId && !in_array($supplierId, array_map('intval', array_column($this->lsSuppliers([$this->companiesId]), 'id')), true)) {
            $supplierId = 0;
        }

        try {
            $entrada = $this->transaction(function () use ($compra, $payload, $lineas, $surtidas, $warehouseId, $supplierId, $fecha) {
                return $this->applyCaptura($compra, $payload, $lineas, $surtidas, $warehouseId, $supplierId, $fecha);
            });
        } catch (\Throwable $e) {
            return ['status' => 500, 'message' => 'No se pudo capturar la compra: ' . $e->getMessage()];
        }

        return [
            'status'  => 200,
            'message' => 'Compra ' . $compra['folio'] . ' capturada: entrada ' . $entrada . ' con ' . count($surtidas) . ' materiales',
            'entrada' => $entrada
        ];
    }

    function extendRutina() {
        $compra = $this->getCompraById([(int) $_POST['id'], $this->companiesId]);
        if (!$compra || !$compra['series_code']) return ['status' => 404, 'message' => 'Rutina no encontrada'];

        $weeks = (int) $_POST['weeks'];
        if ($weeks < 1 || $weeks > 12) return ['status' => 400, 'message' => 'Elige de 1 a 12 semanas'];

        $ultima = $this->getLatestSeriesCompra([$this->companiesId, $compra['series_code']]);
        if (!$ultima) return ['status' => 400, 'message' => 'La rutina no tiene fechas activas para copiar'];

        $desde  = max(date('Y-m-d', strtotime($ultima['date_order'] . ' +1 day')), date('Y-m-d'));
        $fechas = routineDates($desde, explode(',', (string) $ultima['weekdays']), $weeks);
        if (!$fechas) return ['status' => 400, 'message' => 'La rutina no tiene días de la semana'];

        $plantilla = $this->getCompraById([(int) $ultima['id'], $this->companiesId]);
        $productos = [];
        foreach ($this->listCompraDetail([$ultima['id']]) as $renglon) {
            if ((float) $renglon['quantity_ordered'] <= 0) continue;
            $productos[] = [
                'product_id'        => (int) $renglon['product_id'],
                'quantity'          => (float) $renglon['quantity_ordered'],
                'price_without_tax' => $renglon['price_without_tax'] !== null ? (float) $renglon['price_without_tax'] : 0.0,
                'tax'               => (float) $renglon['tax'],
                'cost'              => $renglon['cost'] !== null ? (float) $renglon['cost'] : 0.0,
                'unit_id'           => $renglon['unit_id']
            ];
        }

        $payload = [
            'purchase_type'            => 'Rutina',
            'name'                     => $plantilla['name'],
            'note'                     => $plantilla['note'],
            'branch_id'                => $plantilla['branch_id'],
            'warehouse_id'             => $plantilla['warehouse_id'],
            'buyer_name'               => $plantilla['buyer_name'],
            'origin_purchase_order_id' => null,
            'weekdays'                 => explode(',', (string) $ultima['weekdays']),
            'series_code'              => $compra['series_code']
        ];

        try {
            $this->transaction(function () use ($payload, $productos, $fechas) {
                foreach ($fechas as $fecha) {
                    $this->createCompraWithDetail($payload, $productos, $fecha);
                }
            });
        } catch (\Throwable $e) {
            return ['status' => 500, 'message' => 'No se pudo extender la rutina: ' . $e->getMessage()];
        }

        return [
            'status'  => 200,
            'message' => 'Se programaron ' . count($fechas) . ' fechas más de la rutina, hasta el ' . formatDate(end($fechas))
        ];
    }

    function stopRutina() {
        $compra = $this->getCompraById([(int) $_POST['id'], $this->companiesId]);
        if (!$compra || !$compra['series_code']) return ['status' => 404, 'message' => 'Rutina no encontrada'];

        $cancel = $this->cancelSeriesPending([$this->companiesId, $compra['series_code'], $compra['date_order']]);

        return [
            'status'  => $cancel ? 200 : 500,
            'message' => $cancel
                ? 'Rutina detenida: se cancelaron las fechas pendientes desde el ' . formatDate($compra['date_order'])
                : 'No se pudo detener la rutina'
        ];
    }

    // Helpers:

    private function compraResponse($compra) {
        $compra['tipo_badge']     = renderTipo($compra['purchase_type']);
        $compra['status_badge']   = renderStatus($compra['status']);
        $compra['date_label']     = formatDate($compra['date_order']);
        $compra['weekdays_label'] = weekdaysLabel($compra['weekdays']);

        $serie = null;
        if ($compra['series_code']) {
            $serie = $this->getSeriesSummary([date('Y-m-d'), $this->companiesId, $compra['series_code']]);
            $serie['next_label'] = $serie['next_date'] ? formatDate($serie['next_date']) : '';
            $serie['last_label'] = $serie['last_date'] ? formatDate($serie['last_date']) : '';
        }

        $historial = [];
        foreach ($this->listCompraHistory([$this->companiesId, $compra['name'], $compra['id']]) as $anterior) {
            $historial[] = $anterior + ['date_label' => formatDate($anterior['date_order'])];
        }

        return [
            'status'    => 200,
            'compra'    => $compra,
            'detalle'   => $this->listCompraDetail([$compra['id']]),
            'serie'     => $serie,
            'historial' => $historial,
            'entrada'   => $this->getInflowByCompra([$compra['id']])
        ];
    }

    private function payloadCompra() {
        $payload = json_decode($_POST['payload'], true);

        return array_merge([
            'purchase_type'            => '',
            'name'                     => '',
            'date_order'               => '',
            'weekdays'                 => [],
            'weeks'                    => 0,
            'branch_id'                => 0,
            'warehouse_id'             => 0,
            'buyer_name'               => '',
            'origin_purchase_order_id' => 0,
            'note'                     => '',
            'productos'                => []
        ], is_array($payload) ? $payload : []);
    }

    private function validateCompra(&$payload, $isNew) {
        $payload['name']       = trim((string) $payload['name']);
        $payload['buyer_name'] = trim((string) $payload['buyer_name']);
        $payload['note']       = trim((string) $payload['note']);

        if (!in_array($payload['purchase_type'], ['Rutina', 'Programada', 'Esporadica'], true)) {
            return 'Elige el tipo de compra';
        }
        if ($payload['name'] === '') return 'Ponle un nombre a la compra';
        if (mb_strlen($payload['name']) > 100) return 'El nombre lleva máximo 100 caracteres';
        if (mb_strlen($payload['buyer_name']) > 100) return 'El nombre de quien surte lleva máximo 100 caracteres';
        if (!validDate($payload['date_order'])) return 'Elige la fecha de la compra';

        if ($isNew && $payload['purchase_type'] === 'Rutina') {
            $payload['weekdays'] = array_values(array_unique(array_filter(
                array_map('intval', (array) $payload['weekdays']),
                function ($dia) {
                    return $dia >= 1 && $dia <= 7;
                }
            )));
            sort($payload['weekdays']);
            if (!$payload['weekdays']) return 'Elige al menos un día de la semana';
            if ((int) $payload['weeks'] < 1 || (int) $payload['weeks'] > 12) return 'Programa de 1 a 12 semanas';
        }

        if (empty($payload['productos'])) return 'Agrega al menos un material';
        foreach ($payload['productos'] as $producto) {
            if ((float) $producto['quantity'] <= 0) return 'Revisa las cantidades: todas deben ser mayores a cero';
        }

        $warehouseId = (int) $payload['warehouse_id'];
        if ($warehouseId && !in_array($warehouseId, array_map('intval', array_column($this->lsWarehouses([$this->companiesId]), 'id')), true)) {
            return 'El almacén no es de esta empresa';
        }

        return null;
    }

    private function nextSeriesCode() {
        $ultima = $this->getLastSeriesCode([$this->companiesId]);
        $numero = $ultima ? (int) substr($ultima, 4) + 1 : 1;
        return 'RUT-' . str_pad($numero, 4, '0', STR_PAD_LEFT);
    }

    private function createCompraWithDetail($payload, $productos, $fecha) {
        $folio   = $this->nextFolio('CP-', 'purchase_order', $this->companiesId);
        $totales = totalsProductos($productos);

        $this->createCompra($this->util->sql([
            'folio'                    => $folio,
            'name'                     => $payload['name'],
            'date_order'               => $fecha,
            'note'                     => $payload['note'],
            'total_products'           => $totales['products'],
            'total_units'              => $totales['units'],
            'total_cost'               => $totales['cost'],
            'total_price_without_tax'  => $totales['base'],
            'status'                   => 'Pendiente',
            'purchase_type'            => $payload['purchase_type'],
            'series_code'              => $payload['series_code'],
            'weekdays'                 => $payload['series_code'] ? implode(',', $payload['weekdays']) : null,
            'buyer_name'               => $payload['buyer_name'],
            'origin_purchase_order_id' => $payload['origin_purchase_order_id'] ?: null,
            'warehouse_id'             => $payload['warehouse_id'] ?: null,
            'user_id'                  => $this->userId,
            'branch_id'                => $payload['branch_id'] ?: $this->branchId,
            'companies_id'             => $this->companiesId
        ]));

        $id = $this->getCompraIdByFolio([$folio, $this->companiesId]);
        if (!$id) throw new Exception('no se registró la compra ' . $folio);

        foreach ($productos as $producto) {
            $this->createCompraDetail($this->util->sql(detailRow($id, $producto)));
        }

        return $folio;
    }

    private function applyCaptura($compra, $payload, $lineas, $surtidas, $warehouseId, $supplierId, $fecha) {
        $totalUnits = 0;
        $totalCost  = 0.0;
        $totalBase  = 0.0;

        foreach ($lineas as $linea) {
            $unitCost = $linea['quantity'] > 0 ? $linea['total'] / $linea['quantity'] : 0.0;
            $base     = $linea['tax'] > 0 ? $unitCost / (1 + $linea['tax'] / 100) : $unitCost;

            $totalUnits += $linea['quantity'];
            $totalCost  += $linea['total'];
            $totalBase  += $base * $linea['quantity'];

            $renglon = [
                'quantity_received' => $linea['quantity'],
                'subtotal'          => $linea['total'],
                'purchase_place'    => $linea['place']
            ];
            if ($linea['quantity'] > 0) {
                $renglon['price_without_tax'] = $base;
                $renglon['cost']              = $unitCost;
            }

            if ($linea['detail_id']) {
                $this->updateCompraDetail($this->util->sql($renglon + ['id' => $linea['detail_id']], 1));
            } else {
                $this->createCompraDetail($this->util->sql([
                    'purchase_order_id' => $compra['id'],
                    'item_id'           => $linea['product_id'],
                    'unit_id'           => $linea['unit_id'],
                    'quantity_ordered'  => 0,
                    'tax'               => $linea['tax']
                ] + $renglon));
            }
        }

        $folio  = $this->nextFolio('ENT-', 'inventory_inflow', $this->companiesId);
        $origin = $this->getInflowOriginByCode([$supplierId ? 'COMPRA' : 'COMPRA_SP']) ?: $this->getInflowOriginByCode(['COMPRA']);
        $nota   = joinNotes('Compra ' . $compra['folio'] . ' · ' . $compra['name'], $payload['note']);

        $this->createInflow($this->util->sql([
            'folio'                   => $folio,
            'note'                    => mb_substr($nota, 0, 255),
            'total_products'          => count($surtidas),
            'total_units'             => $totalUnits,
            'total_cost'              => $totalCost,
            'total_price_without_tax' => $totalBase,
            'status'                  => 'Aplicada',
            'inflow_origin_id'        => $origin ?: null,
            'warehouse_id'            => $warehouseId,
            'supplier_id'             => $supplierId ?: null,
            'branch_id'               => $compra['branch_id'],
            'user_id'                 => $this->userId,
            'companies_id'            => $this->companiesId,
            'date_inflow'             => $fecha,
            'purchase_order_id'       => $compra['id']
        ]));

        $inflowId = $this->getInflowIdByFolio([$folio, $this->companiesId]);
        if (!$inflowId) throw new Exception('no se generó la entrada');

        foreach ($surtidas as $linea) {
            $unitCost = $linea['total'] / $linea['quantity'];
            $base     = $linea['tax'] > 0 ? $unitCost / (1 + $linea['tax'] / 100) : $unitCost;
            $stock    = $this->getStockRow([$linea['product_id'], $warehouseId]);
            $previous = $stock ? (float) $stock['quantity'] : 0.0;
            $result   = $previous + $linea['quantity'];

            $this->createInflowDetail($this->util->sql([
                'quantity'            => $linea['quantity'],
                'cost'                => $unitCost,
                'subtotal'            => $linea['total'],
                'price_without_tax'   => $base,
                'tax'                 => $linea['tax'],
                'previous_stock'      => $previous,
                'resulting_stock'     => $result,
                'item_id'             => $linea['product_id'],
                'inventory_inflow_id' => $inflowId,
                'unit_id'             => $linea['unit_id']
            ]));

            if ($stock) {
                $this->updateStock($this->util->sql([
                    'quantity'         => $result,
                    'last_movement_at' => date('Y-m-d H:i:s'),
                    'id'               => $stock['id']
                ], 1));
            } else {
                $this->createStock($this->util->sql([
                    'quantity'         => $result,
                    'last_movement_at' => date('Y-m-d H:i:s'),
                    'warehouse_id'     => $warehouseId,
                    'item_id'          => $linea['product_id'],
                    'companies_id'     => $this->companiesId
                ]));
            }

            $this->updateItemCost([$base, $linea['tax'], $linea['product_id'], $this->companiesId]);
        }

        $this->updateCompra($this->util->sql([
            'status'                  => 'Capturada',
            'captured_at'             => date('Y-m-d H:i:s'),
            'captured_user_id'        => $this->userId,
            'warehouse_id'            => $warehouseId,
            'supplier_id'             => $supplierId ?: null,
            'buyer_name'              => trim((string) $payload['buyer_name']) ?: $compra['buyer_name'],
            'total_products'          => count($lineas),
            'total_units'             => $totalUnits,
            'total_cost'              => $totalCost,
            'total_price_without_tax' => $totalBase,
            'id'                      => $compra['id']
        ], 1));

        return $folio;
    }
}

// Complements.

function normalizeProductos($productos) {
    $normalizados = [];
    foreach ($productos as $producto) {
        $tax  = (float) $producto['tax'];
        $cost = (float) $producto['cost'];
        if ($cost <= 0 && (float) $producto['price_without_tax'] > 0) {
            $cost = (float) $producto['price_without_tax'] * (1 + $tax / 100);
        }

        $normalizados[] = [
            'product_id'        => (int) $producto['product_id'],
            'quantity'          => (float) $producto['quantity'],
            'cost'              => $cost,
            'tax'               => $tax,
            'price_without_tax' => $tax > 0 ? $cost / (1 + $tax / 100) : $cost,
            'unit_id'           => !empty($producto['unit_id']) ? (int) $producto['unit_id'] : null
        ];
    }
    return $normalizados;
}

function totalsProductos($productos) {
    $totales = ['products' => count($productos), 'units' => 0, 'cost' => 0.0, 'base' => 0.0];
    foreach ($productos as $producto) {
        $totales['units'] += $producto['quantity'];
        $totales['cost']  += $producto['quantity'] * $producto['cost'];
        $totales['base']  += $producto['quantity'] * $producto['price_without_tax'];
    }
    return $totales;
}

function detailRow($compraId, $producto) {
    return [
        'purchase_order_id' => $compraId,
        'item_id'           => $producto['product_id'],
        'unit_id'           => $producto['unit_id'],
        'quantity_ordered'  => $producto['quantity'],
        'quantity_received' => 0,
        'price_without_tax' => $producto['price_without_tax'],
        'tax'               => $producto['tax'],
        'cost'              => $producto['cost'],
        'subtotal'          => $producto['quantity'] * $producto['cost']
    ];
}

// Fechas de una rutina: desde $desde, durante $weeks semanas, solo los días
// de $weekdays (1 = lunes ... 7 = domingo). Tope de 100 fechas.
function routineDates($desde, $weekdays, $weeks) {
    $dias   = array_map('intval', (array) $weekdays);
    $fechas = [];
    $inicio = strtotime($desde);

    for ($offset = 0; $offset < $weeks * 7 && count($fechas) < 100; $offset++) {
        $dia = strtotime("+{$offset} day", $inicio);
        if (in_array((int) date('N', $dia), $dias, true)) $fechas[] = date('Y-m-d', $dia);
    }
    return $fechas;
}

function joinNotes($nota, $extra) {
    $extra = trim((string) $extra);
    if ($extra === '') return (string) $nota;
    return $nota ? $nota . ' · ' . $extra : $extra;
}

function validDate($fecha) {
    $parsed = DateTime::createFromFormat('Y-m-d', (string) $fecha);
    return $parsed && $parsed->format('Y-m-d') === $fecha;
}

// "lun 05 ene 2027" sin strftime (deprecado en PHP 8.1).
function formatDate($fecha, $year = true) {
    if (!$fecha) return '-';
    $dias  = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
    $meses = ['', 'ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    $ts    = strtotime($fecha);
    return $dias[(int) date('w', $ts)] . ' ' . date('d', $ts) . ' ' . $meses[(int) date('n', $ts)] . ($year ? ' ' . date('Y', $ts) : '');
}

function renderCompra($compra) {
    $extra = '';
    if ($compra['origin_folio']) {
        $extra = '<span class="block text-[10px] text-gray-400">Retoma ' . $compra['origin_folio'] . '</span>';
    } elseif ($compra['series_code']) {
        $extra = '<span class="block text-[10px] text-gray-400">' . $compra['series_code'] . ' · cada ' . weekdaysLabel($compra['weekdays']) . '</span>';
    }
    return '<span class="font-medium text-gray-800">' . $compra['name'] . '</span>' . $extra;
}

function weekdaysLabel($weekdays) {
    $nombres = [1 => 'lun', 2 => 'mar', 3 => 'mié', 4 => 'jue', 5 => 'vie', 6 => 'sáb', 7 => 'dom'];
    $dias    = array_filter(array_map('intval', explode(',', (string) $weekdays)));
    return implode(', ', array_map(function ($dia) use ($nombres) {
        return $nombres[$dia];
    }, $dias));
}

function renderTipo($tipo) {
    $tipos = [
        'Rutina'     => ['#4338CA', '#E0E7FF', 'repeat', 'Rutina'],
        'Programada' => ['rgb(var(--brand-700, 168 74 51))', 'rgb(var(--brand-100, 247 227 220))', 'star', 'Programada'],
        'Esporadica' => ['#0F766E', '#CCFBF1', 'zap', 'Esporádica']
    ];
    $estilo = $tipos[$tipo] ?? ['#475569', '#F1F5F9', 'circle', $tipo];
    return badge($estilo[3], $estilo[0], 100, $estilo[1], $estilo[2]);
}

function renderStatus($status) {
    $estados = [
        'Pendiente'  => ['#B45309', '#FEF3C7'],
        'En surtido' => ['#C2410C', '#FFEDD5'],
        'Capturada'  => ['#15803D', '#DCFCE7'],
        'Cancelada'  => ['#475569', '#F1F5F9']
    ];
    $estilo = $estados[$status] ?? ['#475569', '#F1F5F9'];
    return badge(strtoupper($status), $estilo[0], 100, $estilo[1]);
}

function renderFecha($fecha, $status, $today) {
    $label = formatDate($fecha, substr($fecha, 0, 4) !== substr($today, 0, 4));
    $activa = in_array($status, ['Pendiente', 'En surtido'], true);

    if ($activa && $fecha === $today) {
        return '<span class="font-semibold text-blue-700">Hoy</span>';
    }
    if ($activa && $fecha < $today) {
        return '<span class="font-semibold text-red-600">' . $label . '</span><span class="block text-[10px] font-semibold text-red-500">Atrasada</span>';
    }
    return $label;
}

function renderImporte($total, $status) {
    if ($status === 'Capturada') return '<span class="font-semibold">' . evaluar($total) . '</span>';
    return '<span class="text-gray-400" title="Estimado con el último costo">~' . evaluar($total) . '</span>';
}

function actionButtons($id) {
    return [
        [
            'class'   => 'inline-flex items-center justify-center w-9 h-9 p-2 text-[#9CA3AF] hover:text-blue-600 transition-colors cursor-pointer bg-transparent border-0',
            'html'    => '<i data-lucide="eye" class="w-4 h-4"></i>',
            'onclick' => "compras.showCompra({$id})"
        ]
    ];
}

$obj = new ctrl();
echo json_encode($obj->{$_POST['opc']}());
