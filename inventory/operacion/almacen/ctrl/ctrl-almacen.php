<?php

if (empty($_POST['opc'])) exit(0);

session_start();
require_once '../mdl/mdl-almacen.php';

class ctrl extends mdl {

    function init() {
        return [
            'categorias'  => $this->lsCategories(),
            'unidades'    => $this->lsUnits(),
            'areas'       => $this->lsAreas(),
            'proveedores' => $this->lsProveedores(),
            'almacenes'   => $this->lsWarehouses()
        ];
    }

    function lsMateriales() {

        $filters = [
            'categoria' => $_POST['categoria'] ?? '',
            'area'      => $_POST['area'] ?? '',
            'almacen'   => $_POST['almacen'] ?? '',
            'estado'    => $_POST['estado'] ?? ''
        ];

        $data = $this->listMateriales($filters);
        $rows = [];
        $totalValue = 0;

        foreach ($data as $item) {
            $value = floatval($item['quantity']) * floatval($item['cost']);
            $totalValue += $value;

            $a = [
                [
                    'class'   => 'inline-flex items-center justify-center w-9 h-9 p-2 text-[#9CA3AF] hover:text-[#C05A40] transition-colors cursor-pointer bg-transparent border-0',
                    'html'    => '<i data-lucide="pencil" class="w-4 h-4"></i>',
                    'onclick' => 'products.editMaterial(' . $item['id'] . ')'
                ],
                [
                    'class'   => $item['active'] == 1
                        ? 'inline-flex items-center justify-center w-9 h-9 p-2 text-emerald-500 hover:text-red-600 transition-colors cursor-pointer bg-transparent border-0'
                        : 'inline-flex items-center justify-center w-9 h-9 p-2 text-[#9CA3AF] hover:text-emerald-600 transition-colors cursor-pointer bg-transparent border-0',
                    'html'    => $item['active'] == 1 ? '<i data-lucide="toggle-right" class="w-4 h-4"></i>' : '<i data-lucide="toggle-left" class="w-4 h-4"></i>',
                    'onclick' => 'products.statusMaterial(' . $item['id'] . ', ' . $item['active'] . ')'
                ]
            ];

            $rows[] = [
                'id'         => $item['id'],
                'Insumo'     => [
                    'class' => 'justify-center px-2 py-2',
                    'html'  => renderProductImage($item['image'] ?? '', $item['name'])
                ],
                'SKU'        => $item['sku'] ?? '-',
                'Categoría'  => $item['categoria'] ?? '-',
                'Unidad'     => $item['unidad'] ?? '-',
                'Stock'      => $item['quantity'],
                'Mín'        => $item['stock_min'] ?? '-',
                'Máx'        => $item['stock_max'] ?? '-',
                'Vida útil'  => isset($item['shelf_life_days']) && $item['shelf_life_days'] !== null
                    ? $item['shelf_life_days'] . ' días'
                    : '-',

                'Costo unitario'      => [
                    'html'  => '$' . number_format($item['cost_unit'], 3),
                    'class' => 'text-end'
                ],
                'IVA (%)'            => [
                    'html'  => $item['tax'] . '%',
                    'class' => 'text-end'
                ],
                'Precio con IVA'      => [
                    'html'  => '$' . number_format($item['cost'], 3),
                    'class' => 'text-end '
                ],
                'Estado'     => renderStatus($item['active']),
                'a'          => $a
            ];
        }

        return [
            'row'         => $rows,
            'total_value' => '$' . number_format($totalValue, 2)
        ];
    }

    function getMaterial() {
        $id      = $_POST['id'];
        $status  = 404;
        $message = 'Insumo no encontrado';
        $data    = null;

        $material = $this->getMaterialById($id);

        if ($material) {
            $status  = 200;
            $message = 'Insumo encontrado';
            $data    = $material;
        }

        return [
            'status'  => $status,
            'message' => $message,
            'data'    => $data
        ];
    }

    function addMaterial() {
        $status  = 500;
        $message = 'No se pudo agregar el insumo';

        // Los datos (incluido price) llegan calculados desde el frontend. Si falta algún
        // dato obligatorio se devuelve error para que el frontend muestre la alerta con
        // este message.
        $required = ['name', 'price', 'price_without_tax', 'tax'];
        foreach ($required as $field) {
            if (($_POST[$field] ?? '') === '') {
                return [
                    'status'  => 400,
                    'message' => 'Faltan datos obligatorios del insumo'
                ];
            }
        }

        $now          = date('Y-m-d H:i:s');
        $companies_id = $_SESSION['company_id'];
        $branch_id    = $_SESSION['branch_id'];

        $price             = floatval($_POST['price']);
        $price_without_tax = floatval($_POST['price_without_tax']);
        $tax               = floatval($_POST['tax']);

        $item = [
            'name'            => $_POST['name'] ?? '',
            'image'           => $_POST['image'] ?? '',
            'category_id'     => $_POST['category_id'] ?? null,
            'branch_id'       => $branch_id,
            'companies_id'    => $companies_id,
            'created_at'      => $now,
            'active'          => 1
        ];

        // price, price_without_tax y tax se anexan DESPUÉS de util->sql() para evitar el gotcha
        // 0 == '' (PHP 7.4), que convertiría un 0 en NULL y violaría item.price NOT NULL.
        $sql = $this->util->sql($item);
        $sql['values'][] = 'price';
        $sql['values'][] = 'price_without_tax';
        $sql['values'][] = 'tax';
        $sql['data'][]   = $price;
        $sql['data'][]   = $price_without_tax;
        $sql['data'][]   = $tax;

        $create = $this->createMaterial($sql);

        if ($create) {
            $itemId = $this->getMaxItemId();

            // Campos numéricos NOT NULL con DEFAULT 0 (cost_unit, stock_min): se omiten cuando
            // van vacíos para que aplique el DEFAULT de la BD. Si se mandara 0, util->sql() lo
            // convertiría en NULL (gotcha 0 == '' en PHP 7.4) y violaría el NOT NULL.
            $attribute = [
                'sku'               => $this->getNextSku(),
                'description'       => $_POST['description'] ?? '',
                'shelf_life_days'   => ($_POST['shelf_life_days'] ?? '') === '' ? null : $_POST['shelf_life_days'],
                'stock_max'         => ($_POST['stock_max'] ?? '') === '' ? null : $_POST['stock_max'],
                'warehouse_area_id' => ($_POST['warehouse_area_id'] ?? '') === '' ? null : $_POST['warehouse_area_id'],
                'unit_id'           => $_POST['unit_id'] ?? null,
                'item_id'           => $itemId,
                'companies_id'      => $companies_id,
                'created_at'        => $now,
                'active'            => 1
            ];

            // Solo se incluyen si traen valor real; si no, la BD usa su DEFAULT 0.
            if (($_POST['cost_unit'] ?? '') !== '') $attribute['cost_unit'] = $_POST['cost_unit'];
            if (($_POST['stock_min'] ?? '') !== '') $attribute['stock_min'] = $_POST['stock_min'];

            $this->createItemAttribute($this->util->sql($attribute));

            $status  = 200;
            $message = 'Insumo agregado correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
    }

    function editMaterial() {
        $status  = 500;
        $message = 'Error al editar el insumo';

        $id = $_POST['id'];

        // price se calcula en el backend a partir de price_without_tax y del porcentaje tax.
        $price_without_tax = ($_POST['price_without_tax'] ?? '') === '' ? 0 : floatval($_POST['price_without_tax']);
        $tax               = ($_POST['tax'] ?? '') === '' ? 0 : floatval($_POST['tax']);
        $price             = $price_without_tax + ($price_without_tax * $tax / 100);

        $editItem = $this->updateMaterial([
            'values' => 'name = ?, image = ?, price = ?, price_without_tax = ?, tax = ?, category_id = ?',
            'where'  => 'id = ?',
            'data'   => [
                $_POST['name'] ?? '',
                $_POST['image'] ?? '',
                $price,
                $price_without_tax,
                $tax,
                $_POST['category_id'] ?? null,
                $id
            ]
        ]);

        $this->updateItemAttribute([
            'values' => 'description = ?, cost_unit = ?, stock_min = ?, stock_max = ?, shelf_life_days = ?, warehouse_area_id = ?, unit_id = ?',
            'where'  => 'item_id = ?',
            'data'   => [
                $_POST['description'] ?? '',
                ($_POST['cost_unit'] ?? '') === '' ? 0 : $_POST['cost_unit'],
                ($_POST['stock_min'] ?? '') === '' ? 0 : $_POST['stock_min'],
                ($_POST['stock_max'] ?? '') === '' ? 0 : $_POST['stock_max'],
                ($_POST['shelf_life_days'] ?? '') === '' ? null : $_POST['shelf_life_days'],
                ($_POST['warehouse_area_id'] ?? '') === '' ? null : $_POST['warehouse_area_id'],
                $_POST['unit_id'] ?? null,
                $id
            ]
        ]);

        if ($editItem) {
            $status  = 200;
            $message = 'Insumo editado correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
    }

    function deleteMaterial() {
        $status      = 500;
        $nuevoEstado = $_POST['active'];
        $message     = $nuevoEstado == 1 ? 'No se pudo activar el insumo' : 'No se pudo desactivar el insumo';

        $update = $this->updateMaterial([
            'values' => 'active = ?',
            'where'  => 'id = ?',
            'data'   => [$_POST['active'], $_POST['id']]
        ]);

        if ($update) {
            $status  = 200;
            $message = $nuevoEstado == 1 ? 'Insumo activado correctamente' : 'Insumo desactivado correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
    }

    function statusMaterial() {
        $status  = 500;
        $message = 'No se pudo actualizar el estado';

        $update = $this->updateMaterial([
            'values' => 'active = ?',
            'where'  => 'id = ?',
            'data'   => [$_POST['active'], $_POST['id']]
        ]);

        if ($update) {
            $status  = 200;
            $message = 'Estado actualizado correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
    }
}

// Complements

function renderProductImage($foto, $nombre) {
    $src = !empty($foto) ? $foto : '';

    $img = !empty($src)
        ? '<img src="' . htmlspecialchars($src) . '" alt="Imagen Insumo" class="w-8 h-8 bg-gray-500 rounded-md object-cover" />'
        : '<div class="w-10 h-10 bg-gray-200 rounded-sm flex items-center justify-center">
                <i class="icon-picture-5 text-gray-600"></i>
           </div>';

    return '
        <div class="flex items-center justify-start gap-2 py-1 text-center">
            ' . $img . '
            <div class="text-xs">' . htmlspecialchars($nombre) . '</div>
        </div>';
}

function renderStatus($estatus) {
    switch ($estatus) {
        case 1:
            return '<span class="px-2 py-1 rounded-md text-xs font-semibold bg-green-100 text-green-700">Activo</span>';
        case 0:
            return '<span class="px-2 py-1 rounded-md text-xs font-semibold bg-red-100 text-red-700">Inactivo</span>';
        default:
            return '<span class="px-2 py-1 rounded-md text-xs font-semibold bg-gray-100 text-gray-700">Desconocido</span>';
    }
}

$obj = new ctrl();
echo json_encode($obj->{$_POST['opc']}());
