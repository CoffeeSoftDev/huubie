<?php

if (empty($_POST['opc'])) exit(0);

session_start();
require_once '../mdl/mdl-almacen.php';

class ctrl extends mdl {

    function init() {
        return [
            'zonas'        => $this->lsZonas(),
            'categorias'   => $this->lsCategories(),
            'areas'        => $this->lsAreas(),
            'departamentos'=> $this->lsDepartamentos(),
            'proveedores'  => $this->lsProveedores()
        ];
    }

    function lsMateriales() {
        
        $filters = [
            'zona'      => $_POST['zona'] ?? '',
            'categoria' => $_POST['categoria'] ?? '',
            'area'      => $_POST['area'] ?? '',
            'estado'    => $_POST['estado'] ?? ''
        ];

        $data = $this->listMateriales($filters);
        $rows = [];
        $totalValue = 0;

        foreach ($data as $item) {
            $value = floatval($item['cantidad']) * floatval($item['Costo']);
            $totalValue += $value;

            $a = [
                [
                    'class'   => 'btn btn-sm btn-primary me-1',
                    'html'    => '<i class="icon-pencil"></i>',
                    'onclick' => 'products.editMaterial(' . $item['id'] . ')'
                ],
                [
                    'class'   => $item['Estado'] == 1 ? 'btn btn-sm btn-danger' : 'btn btn-sm btn-outline-danger',
                    'html'    => $item['Estado'] == 1 ? '<i class="icon-toggle-on"></i>' : '<i class="icon-toggle-off"></i>',
                    'onclick' => 'products.statusMaterial(' . $item['id'] . ', ' . $item['Estado'] . ')'
                ]
            ];

            $rows[] = [
                'id'           => $item['id'],
                'Producto'     => [
                    'class' => 'justify-center px-2 py-2',
                    'html'  => renderProductImage($item['rutaImagen'], $item['Equipo'])
                ],
                // 'Código'       => $item['CodigoEquipo'],
                // 'Equipo'       => $item['Equipo'],
                'Grupo'         => $item['area'] ?? '-',
                'Cantidad'     => $item['cantidad'],
                'Presentación'    => $item['categoria'] ?? '-',
                'Costo'        => [
                    'html'  => '$' . number_format($item['Costo'], 2),
                    'class' => 'text-end '
                ],
                'Estado'       => renderStatus($item['Estado']),
                'a'            => $a
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
        $message = 'Material no encontrado';
        $data    = null;

        $material = $this->getMaterialById($id);

        if ($material) {
            $status  = 200;
            $message = 'Material encontrado';
            $data    = $material;
        }

        return [
            'status'  => $status,
            'message' => $message,
            'data'    => $data,
           
        ];
    }

    function addMaterial() {
        $status  = 500;
        $message = 'No se pudo agregar el material';
        
        $_POST['FechaIngreso']  = date('Y-m-d H:i:s');
        $_POST['Estado']        = 1;
        $_POST['UDN_Almacen']   = $_SESSION['idUDN'];
        $_POST['CodigoEquipo']  = $this->getNextCodigoEquipo();

        $create = $this->createMaterial($this->util->sql($_POST));
        
        if ($create) {
            $status  = 200;
            $message = 'Producto agregado correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message,
            'codigo'  => $_POST
        ];
    }

    function editMaterial() {
        $status  = 500;
        $message = 'Error al editar Producto';

        $edit = $this->updateMaterial($this->util->sql($_POST, 1));

        if ($edit) {
            $status  = 200;
            $message = 'Producto editado correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
    }

    function deleteMaterial() {
        $status  = 500;
        $nuevoEstado = $_POST['Estado'];
        $message = $nuevoEstado == 1 ? 'No se pudo activar el Producto' : 'No se pudo desactivar el Producto';

        $update = $this->updateMaterial($this->util->sql($_POST, 1));

        if ($update) {
            $status  = 200;
            $message = $nuevoEstado == 1 ? 'Producto activado correctamente' : 'Producto desactivado correctamente';
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
            'values' => 'Estado = ?',
            'where'  => 'idAlmacen = ?',
            'data'   => [$_POST['Estado'], $_POST['idAlmacen']]
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
        ? '<img src="' . htmlspecialchars($src) . '" alt="Imagen Material" class="w-8 h-8 bg-gray-500 rounded-md object-cover" />'
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
