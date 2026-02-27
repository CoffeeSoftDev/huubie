<?php
session_start();
if (empty($_POST['opc'])) exit(0);


require_once '../mdl/mdl-catalogo.php';

class ctrl extends mdl {

    function init() {
        return [
            'status' => 200
        ];
    }

    function lsCategory() {
        $active = $_POST['active'] ?? 1;
        $ls     = $this->listCategory([$active]);
        $rows   = [];

        foreach ($ls as $item) {
            $a = [];

            if ($active == 1) {
                $a[] = [
                    'class'   => 'btn btn-sm btn-primary me-1',
                    'html'    => '<i class="icon-pencil"></i>',
                    'onclick' => 'category.editCategory(' . $item['id'] . ')'
                ];
                $a[] = [
                    'class'   => 'btn btn-sm btn-danger',
                    'html'    => '<i class="icon-toggle-on"></i>',
                    'onclick' => 'category.statusCategory(' . $item['id'] . ', ' . $item['active'] . ')'
                ];
            } else {
                $a[] = [
                    'class'   => 'btn btn-sm btn-outline-success',
                    'html'    => '<i class="icon-toggle-off"></i>',
                    'onclick' => 'category.statusCategory(' . $item['id'] . ', ' . $item['active'] . ')'
                ];
            }

            $rows[] = [
                'id'              => $item['id'],
                'Categoría'       => $item['valor'],
                // 'Fecha Creación'  => $item['date_creation'],
                'Estado'          => renderStatus($item['active']),
                'a'               => $a
            ];
        }

        return [
            'row' => $rows,
            'ls'  => $ls,
            'ses'=>$_SESSION
        ];
    }

    function getCategory() {
        $id      = $_POST['id'];
        $status  = 404;
        $message = 'Categoría no encontrada';
        $data    = null;

        $category = $this->getCategoryById([$id]);

        if ($category) {
            $status  = 200;
            $message = 'Categoría encontrada';
            $data    = $category;
        }

        return [
            'status'  => $status,
            'message' => $message,
            'data'    => $data
        ];
    }

    function addCategory() {
        $status  = 500;
        $message = 'Error al crear categoría';

        $_POST['date_creation'] = date('Y-m-d H:i:s');
        $_POST['active']        = 1;
        $_POST['udn_id']        = $_SESSION['idUDN'];

        $exists = $this->existsCategoryByName([$_POST['nombreCategoria'],$_SESSION['idUDN']]);

        if ($exists > 0) {
            return [
                'status'  => 409,
                'message' => 'Ya existe una categoría con ese nombre'
            ];
        }

        $create = $this->createCategory($this->util->sql($_POST));

        if ($create) {
            $status  = 200;
            $message = 'Categoría creada exitosamente';
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
    }

    function editCategory() {
        $status  = 500;
        $message = 'Error al editar categoría';

        $values  = $this->util->sql($_POST, 1);
        $edit    = $this->updateCategory($values);

        if ($edit) {
            $status  = 200;
            $message = 'Categoría actualizada correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message,
        
        ];
    }

    function statusCategory() {
        $status  = 500;
        $message = 'Error al cambiar el estado de la categoría';

        $update = $this->updateCategory($this->util->sql($_POST, 1));

        if ($update) {
            $status  = 200;
            $message = 'Estado de la categoría actualizado correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
    }

    // Area --


    function lsArea() {
        $active = $_POST['active'] ?? 1;
        $ls     = $this->listArea([$active]);
        $rows   = [];

        foreach ($ls as $item) {
            $a = [];

            if ($active == 1) {
                $a[] = [
                    'class'   => 'btn btn-sm btn-primary me-1',
                    'html'    => '<i class="icon-pencil"></i>',
                    'onclick' => 'area.editArea(' . $item['id'] . ')'
                ];
                $a[] = [
                    'class'   => 'btn btn-sm btn-danger',
                    'html'    => '<i class="icon-toggle-on"></i>',
                    'onclick' => 'area.statusArea(' . $item['id'] . ', ' . $item['active'] . ')'
                ];
            } else {
                $a[] = [
                    'class'   => 'btn btn-sm btn-outline-success',
                    'html'    => '<i class="icon-toggle-off"></i>',
                    'onclick' => 'area.statusArea(' . $item['id'] . ', ' . $item['active'] . ')'
                ];
            }

            $rows[] = [
                'id'              => $item['id'],
                'Área'            => $item['valor'],
                'Estado'          => renderStatus($item['active']),
                'a'               => $a
            ];
        }

        return [
            'row' => $rows,
            'ls'  => $ls
        ];
    }

    function getArea() {
        $id      = $_POST['id'];
        $status  = 404;
        $message = 'Área no encontrada';
        $data    = null;

        $area    = $this->getAreaById([$id]);

        if ($area) {
            $status  = 200;
            $message = 'Área encontrada';
            $data    = $area;
        }

        return [
            'status'  => $status,
            'message' => $message,
            'data'    => $data
        ];
    }

    function addArea() {
        $status  = 500;
        $message = 'Error al crear área';

        $_POST['date_creation'] = date('Y-m-d H:i:s');
        $_POST['active']        = 1;
        $_POST['udn_id']        = $_SESSION['idUDN'];

        $exists = $this->existsAreaByName([$_POST['nombre_area']]);

        if ($exists > 0) {
            return [
                'status'  => 409,
                'message' => 'Ya existe un área con ese nombre'
            ];
        }

        $create = $this->createArea($this->util->sql($_POST));

        if ($create) {
            $status  = 200;
            $message = 'Área creada exitosamente';
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
    }

    function editArea() {
        $status  = 500;
        $message = 'Error al editar área';

        $edit    = $this->updateArea($this->util->sql($_POST, 1));

        if ($edit) {
            $status  = 200;
            $message = 'Área actualizada correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
    }

    function statusArea() {
        $status  = 500;
        $message = 'Error al cambiar el estado del área';

        $update = $this->updateArea($this->util->sql($_POST, 1));

        if ($update) {
            $status  = 200;
            $message = 'Estado del área actualizado correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
    }

    function lsZone() {
        $active = $_POST['active'] ?? 1;
        $ls     = $this->listZone([$active]);
        $rows   = [];

        foreach ($ls as $item) {
            $a = [];

            if ($active == 1) {
                $a[] = [
                    'class'   => 'btn btn-sm btn-primary me-1',
                    'html'    => '<i class="icon-pencil"></i>',
                    'onclick' => 'zone.editZone(' . $item['id'] . ')'
                ];
                $a[] = [
                    'class'   => 'btn btn-sm btn-danger',
                    'html'    => '<i class="icon-toggle-on"></i>',
                    'onclick' => 'zone.statusZone(' . $item['id'] . ', ' . $item['active'] . ')'
                ];
            } else {
                $a[] = [
                    'class'   => 'btn btn-sm btn-outline-success',
                    'html'    => '<i class="icon-toggle-off"></i>',
                    'onclick' => 'zone.statusZone(' . $item['id'] . ', ' . $item['active'] . ')'
                ];
            }

            $rows[] = [
                'id'              => $item['id'],
                'Departamento'            => $item['valor'],
                'Fecha de creación'  => $item['date_creation'],
                'Estado'          => renderStatus($item['active']),
                'a'               => $a
            ];
        }

        return [
            'row' => $rows,
            'ls'  => $ls
        ];
    }

    function getZone() {
        $id      = $_POST['id'];
        $status  = 404;
        $message = 'Zona no encontrada';
        $data    = null;

        $zone    = $this->getZoneById([$id]);

        if ($zone) {
            $status  = 200;
            $message = 'Zona encontrada';
            $data    = $zone;
        }

        return [
            'status'  => $status,
            'message' => $message,
            'data'    => $data
        ];
    }

    function addZone() {
        $status  = 500;
        $message = 'Error al crear zona';

        $_POST['date_creation'] = date('Y-m-d H:i:s');
        $_POST['active']        = 1;
        $_POST['udn_id']        = $_SESSION['idUDN'];

        $exists = $this->existsZoneByName([$_POST['nombre_zona']]);

        if ($exists > 0) {
            return [
                'status'  => 409,
                'message' => 'Ya existe una zona con ese nombre'
            ];
        }

        $create = $this->createZone($this->util->sql($_POST));

        if ($create) {
            $status  = 200;
            $message = 'Zona creada exitosamente';
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
    }

    function editZone() {
        $status  = 500;
        $message = 'Error al editar zona';

     

        $edit    = $this->updateZone($this->util->sql($_POST, 1));

        if ($edit) {
            $status  = 200;
            $message = 'Zona actualizada correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message, 
        ];
    }

    function statusZone() {
        $status  = 500;
        $message = 'Error al cambiar el estado de la zona';

        $update = $this->updateZone($this->util->sql($_POST, 1));

        if ($update) {
            $status  = 200;
            $message = 'Estado de la zona actualizado correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
    }
}

// Complements

function renderStatus($active) {
    switch ($active) {
        case 1:
            return '<span class="inline-block px-3 py-1 rounded-2xl text-xs font-semibold bg-green-100 text-green-700 min-w-[80px] text-center">Activo</span>';
        case 0:
            return '<span class="inline-block px-3 py-1 rounded-2xl text-xs font-semibold bg-red-100 text-red-700 min-w-[80px] text-center">Inactivo</span>';
        default:
            return '<span class="inline-block px-3 py-1 rounded-2xl text-xs font-semibold bg-gray-100 text-gray-700 min-w-[80px] text-center">Desconocido</span>';
    }
}

$obj = new ctrl();
echo json_encode($obj->{$_POST['opc']}());
