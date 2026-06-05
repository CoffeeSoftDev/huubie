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
            'proveedores' => $this->lsProveedores()
        ];
    }

    function lsMateriales() {

        $filters = [
            'categoria' => $_POST['categoria'] ?? '',
            'area'      => $_POST['area'] ?? '',
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
                    'class'   => 'btn btn-sm btn-primary me-1',
                    'html'    => '<i class="icon-pencil"></i>',
                    'onclick' => 'products.editMaterial(' . $item['id'] . ')'
                ],
                [
                    'class'   => $item['active'] == 1 ? 'btn btn-sm btn-danger' : 'btn btn-sm btn-outline-danger',
                    'html'    => $item['active'] == 1 ? '<i class="icon-toggle-on"></i>' : '<i class="icon-toggle-off"></i>',
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
                'Costo'      => [
                    'html'  => '$' . number_format($item['cost'], 2),
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

        $now             = date('Y-m-d H:i:s');
        $companies_id    = $_SESSION['companies_id'];
        $subsidiaries_id = $_SESSION['subsidiaries_id'];

        $item = [
            'name'            => $_POST['name'],
            'price'           => $_POST['price'] === '' ? 0 : $_POST['price'],
            'category_id'     => $_POST['category_id'],
            'subsidiaries_id' => $subsidiaries_id,
            'companies_id'    => $companies_id,
            'created_at'      => $now,
            'active'          => 1
        ];

        $create = $this->createMaterial($this->util->sql($item));

        if ($create) {
            $itemId = $this->getMaxItemId();

            $attribute = [
                'sku'               => $this->getNextSku(),
                'description'       => $_POST['description'],
                'cost_unit'         => $_POST['cost_unit'] === '' ? 0 : $_POST['cost_unit'],
                'stock_min'         => $_POST['stock_min'] === '' ? 0 : $_POST['stock_min'],
                'stock_max'         => $_POST['stock_max'] === '' ? 0 : $_POST['stock_max'],
                'warehouse_area_id' => $_POST['warehouse_area_id'],
                'unit_id'           => $_POST['unit_id'],
                'item_id'           => $itemId,
                'companies_id'      => $companies_id,
                'created_at'        => $now,
                'active'            => 1
            ];

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

        $editItem = $this->updateMaterial([
            'values' => 'name = ?, price = ?, category_id = ?',
            'where'  => 'id = ?',
            'data'   => [
                $_POST['name'],
                $_POST['price'] === '' ? 0 : $_POST['price'],
                $_POST['category_id'],
                $id
            ]
        ]);

        $this->updateItemAttribute([
            'values' => 'description = ?, cost_unit = ?, stock_min = ?, stock_max = ?, warehouse_area_id = ?, unit_id = ?',
            'where'  => 'item_id = ?',
            'data'   => [
                $_POST['description'],
                $_POST['cost_unit'] === '' ? 0 : $_POST['cost_unit'],
                $_POST['stock_min'] === '' ? 0 : $_POST['stock_min'],
                $_POST['stock_max'] === '' ? 0 : $_POST['stock_max'],
                $_POST['warehouse_area_id'],
                $_POST['unit_id'],
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
