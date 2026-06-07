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
                'Almacén'         => $item['warehouse_name'] ?? '—',
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

        $_POST['created_at']   = date('Y-m-d H:i:s');
        $_POST['active']       = 1;
        $_POST['companies_id'] = $_SESSION['company_id'];

        // El select envía '' cuando no se elige almacén → NULL para respetar la FK.
        $_POST['warehouse_id'] = ($_POST['warehouse_id'] ?? '') === '' ? null : $_POST['warehouse_id'];

        $exists = $this->existsCategoryByName([$_POST['name']]);

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

        // El select envía '' cuando no se elige almacén → NULL para respetar la FK.
        $_POST['warehouse_id'] = ($_POST['warehouse_id'] ?? '') === '' ? null : $_POST['warehouse_id'];

        // Regla CoffeeSoft: sql(,1) usa el ULTIMO campo como WHERE.
        // El form inyecta los inputs despues del 'id', asi que lo reubicamos al final.
        $id = $_POST['id'];
        unset($_POST['id']);
        $_POST['id'] = $id;

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

        $_POST['created_at']   = date('Y-m-d H:i:s');
        $_POST['active']       = 1;
        $_POST['companies_id'] = $_SESSION['company_id'];

        $exists = $this->existsAreaByName([$_POST['name']]);

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

        // Regla CoffeeSoft: sql(,1) usa el ULTIMO campo como WHERE.
        $id = $_POST['id'];
        unset($_POST['id']);
        $_POST['id'] = $id;

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
                'id'       => $item['id'],
                'Código'   => $item['code'],
                'Unidad'   => $item['valor'],
                'Estado'   => renderStatus($item['active']),
                'a'        => $a
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

        $_POST['created_at']   = date('Y-m-d H:i:s');
        $_POST['active']       = 1;
        $_POST['companies_id'] = $_SESSION['company_id'];

        $exists = $this->existsZoneByName([$_POST['name']]);

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

        // Regla CoffeeSoft: sql(,1) usa el ULTIMO campo como WHERE.
        $id = $_POST['id'];
        unset($_POST['id']);
        $_POST['id'] = $id;

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
    // Origen de entradas -- (catalogo global)

    function lsInflow() {
        $active = $_POST['active'] ?? 1;
        $ls     = $this->listInflow([$active]);
        $rows   = [];

        foreach ($ls as $item) {
            $a = [];

            if ($active == 1) {
                $a[] = [
                    'class'   => 'btn btn-sm btn-primary me-1',
                    'html'    => '<i class="icon-pencil"></i>',
                    'onclick' => 'inflow.editInflow(' . $item['id'] . ')'
                ];
                $a[] = [
                    'class'   => 'btn btn-sm btn-danger',
                    'html'    => '<i class="icon-toggle-on"></i>',
                    'onclick' => 'inflow.statusInflow(' . $item['id'] . ', ' . $item['active'] . ')'
                ];
            } else {
                $a[] = [
                    'class'   => 'btn btn-sm btn-outline-success',
                    'html'    => '<i class="icon-toggle-off"></i>',
                    'onclick' => 'inflow.statusInflow(' . $item['id'] . ', ' . $item['active'] . ')'
                ];
            }

            $rows[] = [
                'id'                => $item['id'],
                'Código'            => $item['code'],
                'Origen'            => badge($item['valor'], $item['color_hex']),
                'Requiere proveedor'=> ($item['requires_supplier'] == 1 ? 'Sí' : 'No'),
                'Estado'            => renderStatus($item['active']),
                'a'                 => $a
            ];
        }

        return [
            'row' => $rows,
            'ls'  => $ls
        ];
    }

    function getInflow() {
        $id      = $_POST['id'];
        $status  = 404;
        $message = 'Origen no encontrado';
        $data    = null;

        $inflow  = $this->getInflowById([$id]);

        if ($inflow) {
            $status  = 200;
            $message = 'Origen encontrado';
            $data    = $inflow;
        }

        return [
            'status'  => $status,
            'message' => $message,
            'data'    => $data
        ];
    }

    function addInflow() {
        $status  = 500;
        $message = 'Error al crear origen';

        $_POST['active'] = 1;

        $exists = $this->existsInflowByName([$_POST['name']]);

        if ($exists > 0) {
            return [
                'status'  => 409,
                'message' => 'Ya existe un origen con ese nombre'
            ];
        }

        $create = $this->createInflow($this->util->sql($_POST));

        if ($create) {
            $status  = 200;
            $message = 'Origen creado exitosamente';
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
    }

    function editInflow() {
        $status  = 500;
        $message = 'Error al editar origen';

        // Regla CoffeeSoft: sql(,1) usa el ULTIMO campo como WHERE.
        $id = $_POST['id'];
        unset($_POST['id']);
        $_POST['id'] = $id;

        $edit    = $this->updateInflow($this->util->sql($_POST, 1));

        if ($edit) {
            $status  = 200;
            $message = 'Origen actualizado correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
    }

    function statusInflow() {
        $status  = 500;
        $message = 'Error al cambiar el estado del origen';

        $update = $this->updateInflow($this->util->sql($_POST, 1));

        if ($update) {
            $status  = 200;
            $message = 'Estado del origen actualizado correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
    }

    // Motivos de salida -- (catalogo global)

    function lsShrinkage() {
        $active = $_POST['active'] ?? 1;
        $ls     = $this->listShrinkage([$active]);
        $rows   = [];

        foreach ($ls as $item) {
            $a = [];

            if ($active == 1) {
                $a[] = [
                    'class'   => 'btn btn-sm btn-primary me-1',
                    'html'    => '<i class="icon-pencil"></i>',
                    'onclick' => 'shrinkage.editShrinkage(' . $item['id'] . ')'
                ];
                $a[] = [
                    'class'   => 'btn btn-sm btn-danger',
                    'html'    => '<i class="icon-toggle-on"></i>',
                    'onclick' => 'shrinkage.statusShrinkage(' . $item['id'] . ', ' . $item['active'] . ')'
                ];
            } else {
                $a[] = [
                    'class'   => 'btn btn-sm btn-outline-success',
                    'html'    => '<i class="icon-toggle-off"></i>',
                    'onclick' => 'shrinkage.statusShrinkage(' . $item['id'] . ', ' . $item['active'] . ')'
                ];
            }

            $rows[] = [
                'id'      => $item['id'],
                'Código'  => $item['code'],
                'Motivo'  => badge($item['valor'], $item['color_hex']),
                'Estado'  => renderStatus($item['active']),
                'a'       => $a
            ];
        }

        return [
            'row' => $rows,
            'ls'  => $ls
        ];
    }

    function getShrinkage() {
        $id      = $_POST['id'];
        $status  = 404;
        $message = 'Motivo no encontrado';
        $data    = null;

        $shrinkage = $this->getShrinkageById([$id]);

        if ($shrinkage) {
            $status  = 200;
            $message = 'Motivo encontrado';
            $data    = $shrinkage;
        }

        return [
            'status'  => $status,
            'message' => $message,
            'data'    => $data
        ];
    }

    function addShrinkage() {
        $status  = 500;
        $message = 'Error al crear motivo';

        $_POST['active'] = 1;

        $exists = $this->existsShrinkageByName([$_POST['name']]);

        if ($exists > 0) {
            return [
                'status'  => 409,
                'message' => 'Ya existe un motivo con ese nombre'
            ];
        }

        $create = $this->createShrinkage($this->util->sql($_POST));

        if ($create) {
            $status  = 200;
            $message = 'Motivo creado exitosamente';
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
    }

    function editShrinkage() {
        $status  = 500;
        $message = 'Error al editar motivo';

        // Regla CoffeeSoft: sql(,1) usa el ULTIMO campo como WHERE.
        $id = $_POST['id'];
        unset($_POST['id']);
        $_POST['id'] = $id;

        $edit    = $this->updateShrinkage($this->util->sql($_POST, 1));

        if ($edit) {
            $status  = 200;
            $message = 'Motivo actualizado correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
    }

    function statusShrinkage() {
        $status  = 500;
        $message = 'Error al cambiar el estado del motivo';

        $update = $this->updateShrinkage($this->util->sql($_POST, 1));

        if ($update) {
            $status  = 200;
            $message = 'Estado del motivo actualizado correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
    }
    // Almacenes --

    function lsWarehouse() {
        $active = $_POST['active'] ?? 1;
        $ls     = $this->listWarehouse([$active]);
        $rows   = [];

        foreach ($ls as $item) {
            $a = [];

            if ($active == 1) {
                $a[] = [
                    'class'   => 'btn btn-sm btn-primary me-1',
                    'html'    => '<i class="icon-pencil"></i>',
                    'onclick' => 'warehouse.editWarehouse(' . $item['id'] . ')'
                ];
                $a[] = [
                    'class'   => 'btn btn-sm btn-danger',
                    'html'    => '<i class="icon-toggle-on"></i>',
                    'onclick' => 'warehouse.statusWarehouse(' . $item['id'] . ', ' . $item['active'] . ')'
                ];
            } else {
                $a[] = [
                    'class'   => 'btn btn-sm btn-outline-success',
                    'html'    => '<i class="icon-toggle-off"></i>',
                    'onclick' => 'warehouse.statusWarehouse(' . $item['id'] . ', ' . $item['active'] . ')'
                ];
            }

            $rows[] = [
                'id'          => $item['id'],
                'Almacén'     => $item['valor'],
                'Área'        => $item['area_name'] ?? '—',
                'Por defecto' => ($item['is_default'] == 1 ? 'Sí' : 'No'),
                'Estado'      => renderStatus($item['active']),
                'a'           => $a
            ];
        }

        return [
            'row' => $rows,
            'ls'  => $ls
        ];
    }

    function getWarehouse() {
        $id      = $_POST['id'];
        $status  = 404;
        $message = 'Almacén no encontrado';
        $data    = null;

        $warehouse = $this->getWarehouseById([$id]);

        if ($warehouse) {
            $status  = 200;
            $message = 'Almacén encontrado';
            $data    = $warehouse;
        }

        return [
            'status'  => $status,
            'message' => $message,
            'data'    => $data
        ];
    }

    function addWarehouse() {
        $status  = 500;
        $message = 'Error al crear almacén';

        $_POST['created_at']      = date('Y-m-d H:i:s');
        $_POST['active']          = 1;
        $_POST['companies_id']    = $_SESSION['company_id'];
        $_POST['subsidiaries_id'] = $_SESSION['branch_id'];

        $exists = $this->existsWarehouseByName([$_POST['name']]);

        if ($exists > 0) {
            return [
                'status'  => 409,
                'message' => 'Ya existe un almacén con ese nombre'
            ];
        }

        $create = $this->createWarehouse($this->util->sql($_POST));

        if ($create) {
            $status  = 200;
            $message = 'Almacén creado exitosamente';
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
    }

    function editWarehouse() {
        $status  = 500;
        $message = 'Error al editar almacén';

        // Regla CoffeeSoft: sql(,1) usa el ULTIMO campo como WHERE.
        $id = $_POST['id'];
        unset($_POST['id']);
        $_POST['id'] = $id;

        $edit = $this->updateWarehouse($this->util->sql($_POST, 1));

        if ($edit) {
            $status  = 200;
            $message = 'Almacén actualizado correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
    }

    function statusWarehouse() {
        $status  = 500;
        $message = 'Error al cambiar el estado del almacén';

        $update = $this->updateWarehouse($this->util->sql($_POST, 1));

        if ($update) {
            $status  = 200;
            $message = 'Estado del almacén actualizado correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
    }

    // Catalogos auxiliares para selects de formularios
    function lsAreasSelect() {
        return [
            'status' => 200,
            'data'   => $this->listAreasSelect()
        ];
    }

    function lsWarehousesSelect() {
        return [
            'status' => 200,
            'data'   => $this->listWarehousesSelect()
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
