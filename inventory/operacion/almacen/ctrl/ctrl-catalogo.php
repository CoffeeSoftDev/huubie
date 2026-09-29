<?php
require_once __DIR__ . '/../../../conf/_Session.php';
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
                    'class'   => 'inline-flex items-center justify-center w-9 h-9 p-2 text-[#9CA3AF] hover:text-blue-600 transition-colors cursor-pointer bg-transparent border-0',
                    'html'    => '<i data-lucide="pencil" class="w-4 h-4"></i>',
                    'onclick' => 'category.editCategory(' . $item['id'] . ')'
                ];
                $a[] = [
                    'class'   => 'inline-flex items-center justify-center w-9 h-9 p-2 text-emerald-500 hover:text-red-600 transition-colors cursor-pointer bg-transparent border-0',
                    'html'    => '<i data-lucide="toggle-right" class="w-4 h-4"></i>',
                    'onclick' => 'category.statusCategory(' . $item['id'] . ', ' . $item['active'] . ')'
                ];
            } else {
                $a[] = [
                    'class'   => 'inline-flex items-center justify-center w-9 h-9 p-2 text-[#9CA3AF] hover:text-emerald-600 transition-colors cursor-pointer bg-transparent border-0',
                    'html'    => '<i data-lucide="toggle-left" class="w-4 h-4"></i>',
                    'onclick' => 'category.statusCategory(' . $item['id'] . ', ' . $item['active'] . ')'
                ];
                $a[] = [
                    'class'   => 'inline-flex items-center justify-center w-9 h-9 p-2 text-red-500 hover:text-red-700 transition-colors cursor-pointer bg-transparent border-0',
                    'html'    => '<i data-lucide="trash-2" class="w-4 h-4"></i>',
                    'onclick' => 'category.deleteCategory(' . $item['id'] . ')'
                ];
            }

            $rows[] = [
                'id'              => $item['id'],
                'Categoría'       => $item['valor'],
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

    // Los productos de la categoría no se borran: su category_id queda en NULL.
    function deleteCategory() {
        $id       = (int) ($_POST['id'] ?? 0);
        $category = $this->getCategoryById([$id]);

        if (!$category || (int) $category['companies_id'] !== (int) $_SESSION['company_id']) {
            return [
                'status'  => 404,
                'message' => 'Categoría no encontrada'
            ];
        }

        $productos = (int) $this->countItemsByCategory([$id]);

        try {
            $this->transaction(function () use ($id) {
                $this->updateItemsCategoryNull([$id]);
                $this->deleteCategoryById([$id]);
            });
        } catch (\Throwable $e) {
            return [
                'status'  => 500,
                'message' => 'No se pudo eliminar la categoría'
            ];
        }

        return [
            'status'  => 200,
            'message' => $productos > 0
                ? "Categoría eliminada. {$productos} producto(s) quedaron sin categoría"
                : 'Categoría eliminada'
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
                    'class'   => 'inline-flex items-center justify-center w-9 h-9 p-2 text-[#9CA3AF] hover:text-blue-600 transition-colors cursor-pointer bg-transparent border-0',
                    'html'    => '<i data-lucide="pencil" class="w-4 h-4"></i>',
                    'onclick' => 'area.editArea(' . $item['id'] . ')'
                ];
                $a[] = [
                    'class'   => 'inline-flex items-center justify-center w-9 h-9 p-2 text-emerald-500 hover:text-red-600 transition-colors cursor-pointer bg-transparent border-0',
                    'html'    => '<i data-lucide="toggle-right" class="w-4 h-4"></i>',
                    'onclick' => 'area.statusArea(' . $item['id'] . ', ' . $item['active'] . ')'
                ];
            } else {
                $a[] = [
                    'class'   => 'inline-flex items-center justify-center w-9 h-9 p-2 text-[#9CA3AF] hover:text-emerald-600 transition-colors cursor-pointer bg-transparent border-0',
                    'html'    => '<i data-lucide="toggle-left" class="w-4 h-4"></i>',
                    'onclick' => 'area.statusArea(' . $item['id'] . ', ' . $item['active'] . ')'
                ];
            }

            $rows[] = [
                'id'              => $item['id'],
                'Área'            => $item['valor'],
                'Almacén'         => $item['almacen'] ?? '-',
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

        if (empty($_POST['warehouse_id'])) {
            return [
                'status'  => 400,
                'message' => 'Elige el almacén al que pertenece el área'
            ];
        }

        $_POST['created_at']   = date('Y-m-d H:i:s');
        $_POST['active']       = 1;
        $_POST['companies_id'] = $_SESSION['company_id'];

        $exists = $this->existsAreaByName([$_POST['name'], $_POST['warehouse_id'], 0]);

        if ($exists > 0) {
            return [
                'status'  => 409,
                'message' => 'Ese almacén ya tiene un área con ese nombre'
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

    function lsUnit() {
        $active = $_POST['active'] ?? 1;
        $ls     = $this->listUnit([$active]);
        $rows   = [];

        foreach ($ls as $item) {
            $a = [];

            if ($active == 1) {
                $a[] = [
                    'class'   => 'inline-flex items-center justify-center w-9 h-9 p-2 text-[#9CA3AF] hover:text-blue-600 transition-colors cursor-pointer bg-transparent border-0',
                    'html'    => '<i data-lucide="pencil" class="w-4 h-4"></i>',
                    'onclick' => 'unit.editUnit(' . $item['id'] . ')'
                ];
                $a[] = [
                    'class'   => 'inline-flex items-center justify-center w-9 h-9 p-2 text-emerald-500 hover:text-red-600 transition-colors cursor-pointer bg-transparent border-0',
                    'html'    => '<i data-lucide="toggle-right" class="w-4 h-4"></i>',
                    'onclick' => 'unit.statusUnit(' . $item['id'] . ', ' . $item['active'] . ')'
                ];
            } else {
                $a[] = [
                    'class'   => 'inline-flex items-center justify-center w-9 h-9 p-2 text-[#9CA3AF] hover:text-emerald-600 transition-colors cursor-pointer bg-transparent border-0',
                    'html'    => '<i data-lucide="toggle-left" class="w-4 h-4"></i>',
                    'onclick' => 'unit.statusUnit(' . $item['id'] . ', ' . $item['active'] . ')'
                ];
            }

            $rows[] = [
                'id'       => $item['id'],
                'Código'   => renderCode($item['code']),
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

    function getUnit() {
        $id      = $_POST['id'];
        $status  = 404;
        $message = 'Unidad no encontrada';
        $data    = null;

        $unit    = $this->getUnitById([$id]);

        if ($unit) {
            $status  = 200;
            $message = 'Unidad encontrada';
            $data    = $unit;
        }

        return [
            'status'  => $status,
            'message' => $message,
            'data'    => $data
        ];
    }

    function addUnit() {
        $status  = 500;
        $message = 'Error al crear unidad';

        $_POST['created_at']   = date('Y-m-d H:i:s');
        $_POST['active']       = 1;
        $_POST['companies_id'] = $_SESSION['company_id'];

        $exists = $this->existsUnitByName([$_POST['name']]);

        if ($exists > 0) {
            return [
                'status'  => 409,
                'message' => 'Ya existe una unidad con ese nombre'
            ];
        }

        $create = $this->createUnit($this->util->sql($_POST));

        if ($create) {
            $status  = 200;
            $message = 'Unidad creada exitosamente';
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
    }

    function editUnit() {
        $status  = 500;
        $message = 'Error al editar unidad';

        // Regla CoffeeSoft: sql(,1) usa el ULTIMO campo como WHERE.
        $id = $_POST['id'];
        unset($_POST['id']);
        $_POST['id'] = $id;

        $edit    = $this->updateUnit($this->util->sql($_POST, 1));

        if ($edit) {
            $status  = 200;
            $message = 'Unidad actualizada correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message,
        ];
    }

    function statusUnit() {
        $status  = 500;
        $message = 'Error al cambiar el estado de la unidad';

        $update = $this->updateUnit($this->util->sql($_POST, 1));

        if ($update) {
            $status  = 200;
            $message = 'Estado de la unidad actualizado correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
    }

    // Solo si nadie la usa: productos, entradas y órdenes de compra la referencian (FK RESTRICT).
    function deleteUnit() {
        $id   = (int) ($_POST['id'] ?? 0);
        $unit = $this->getUnitById([$id]);

        if (!$unit || (int) $unit['companies_id'] !== (int) $_SESSION['company_id']) {
            return [
                'status'  => 404,
                'message' => 'Unidad no encontrada'
            ];
        }

        $uso = (int) $this->countUnitUsage([$id]);

        if ($uso > 0) {
            return [
                'status'  => 409,
                'message' => "Esta unidad la usan {$uso} producto(s) o movimiento(s). Solo se puede desactivar."
            ];
        }

        $delete = $this->deleteUnitById([$id]);

        return [
            'status'  => $delete ? 200 : 500,
            'message' => $delete ? 'Unidad eliminada' : 'No se pudo eliminar la unidad'
        ];
    }
    // Origen de entradas -- (catalogo global)

    function lsInflow() {
        $active = $_POST['active'] ?? 1;
        $ls     = $this->listInflow([$active]) ?: [];
        $rows   = [];
        $last   = count($ls) - 1;

        foreach ($ls as $i => $item) {
            $a = [];

            if ($active == 1) {
                $a   = sortButtons('inflow.moveInflow', $item['id'], $i === 0, $i === $last);
                $a[] = [
                    'class'   => 'inline-flex items-center justify-center w-9 h-9 p-2 text-[#9CA3AF] hover:text-blue-600 transition-colors cursor-pointer bg-transparent border-0',
                    'html'    => '<i data-lucide="pencil" class="w-4 h-4"></i>',
                    'onclick' => 'inflow.editInflow(' . $item['id'] . ')'
                ];
                $a[] = [
                    'class'   => 'inline-flex items-center justify-center w-9 h-9 p-2 text-emerald-500 hover:text-red-600 transition-colors cursor-pointer bg-transparent border-0',
                    'html'    => '<i data-lucide="toggle-right" class="w-4 h-4"></i>',
                    'onclick' => 'inflow.statusInflow(' . $item['id'] . ', ' . $item['active'] . ')'
                ];
            } else {
                $a[] = [
                    'class'   => 'inline-flex items-center justify-center w-9 h-9 p-2 text-[#9CA3AF] hover:text-emerald-600 transition-colors cursor-pointer bg-transparent border-0',
                    'html'    => '<i data-lucide="toggle-left" class="w-4 h-4"></i>',
                    'onclick' => 'inflow.statusInflow(' . $item['id'] . ', ' . $item['active'] . ')'
                ];
            }

            $rows[] = [
                'id'                => $item['id'],
                'Origen'            => badge($item['valor'], $item['color_hex'], 100, $item['bg_hex'] ?? null, $item['icon'], 'rounded-full'),
                'Código'            => renderCode($item['code']),
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

        $_POST['active']     = 1;
        $_POST['sort_order'] = $this->getMaxInflowSort() + 10;

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

    // El orden manda en el selector de Entradas.
    function moveInflow() {
        $rows  = $this->listInflow([1]) ?: [];
        $order = $this->reorder($rows, (int) $_POST['id'], $_POST['dir'] ?? '');

        if (!$order) {
            return [
                'status'  => 404,
                'message' => 'Origen no encontrado'
            ];
        }

        $actual = array_column($rows, 'sort_order', 'id');

        foreach ($order as $id => $sort) {
            if ((int) $actual[$id] === $sort) continue;
            $this->updateInflow($this->util->sql(['sort_order' => $sort, 'id' => $id], 1));
        }

        return [
            'status'  => 200,
            'message' => 'Orden actualizado'
        ];
    }

    // Motivos de salida -- (catalogo global)

    function lsShrinkage() {
        $active = $_POST['active'] ?? 1;
        $ls     = $this->listShrinkage([$active]) ?: [];
        $rows   = [];
        $last   = count($ls) - 1;

        foreach ($ls as $i => $item) {
            $a = [];

            if ($active == 1) {
                $a   = sortButtons('shrinkage.moveShrinkage', $item['id'], $i === 0, $i === $last);
                $a[] = [
                    'class'   => 'inline-flex items-center justify-center w-9 h-9 p-2 text-[#9CA3AF] hover:text-blue-600 transition-colors cursor-pointer bg-transparent border-0',
                    'html'    => '<i data-lucide="pencil" class="w-4 h-4"></i>',
                    'onclick' => 'shrinkage.editShrinkage(' . $item['id'] . ')'
                ];
                $a[] = [
                    'class'   => 'inline-flex items-center justify-center w-9 h-9 p-2 text-emerald-500 hover:text-red-600 transition-colors cursor-pointer bg-transparent border-0',
                    'html'    => '<i data-lucide="toggle-right" class="w-4 h-4"></i>',
                    'onclick' => 'shrinkage.statusShrinkage(' . $item['id'] . ', ' . $item['active'] . ')'
                ];
            } else {
                $a[] = [
                    'class'   => 'inline-flex items-center justify-center w-9 h-9 p-2 text-[#9CA3AF] hover:text-emerald-600 transition-colors cursor-pointer bg-transparent border-0',
                    'html'    => '<i data-lucide="toggle-left" class="w-4 h-4"></i>',
                    'onclick' => 'shrinkage.statusShrinkage(' . $item['id'] . ', ' . $item['active'] . ')'
                ];
            }

            $rows[] = [
                'id'      => $item['id'],
                'Motivo'  => badge($item['valor'], $item['color_hex'], 100, $item['bg_hex'] ?? null, $item['icon'], 'rounded-full'),
                'Código'  => renderCode($item['code']),
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

        $_POST['active']     = 1;
        $_POST['sort_order'] = $this->getMaxShrinkageSort() + 10;

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

    // El orden manda en el selector de Salidas.
    function moveShrinkage() {
        $rows  = $this->listShrinkage([1]) ?: [];
        $order = $this->reorder($rows, (int) $_POST['id'], $_POST['dir'] ?? '');

        if (!$order) {
            return [
                'status'  => 404,
                'message' => 'Motivo no encontrado'
            ];
        }

        $actual = array_column($rows, 'sort_order', 'id');

        foreach ($order as $id => $sort) {
            if ((int) $actual[$id] === $sort) continue;
            $this->updateShrinkage($this->util->sql(['sort_order' => $sort, 'id' => $id], 1));
        }

        return [
            'status'  => 200,
            'message' => 'Orden actualizado'
        ];
    }

    // Estados de traspaso --

    function lsTransferStatus() {
        $active = $_POST['active'] ?? 1;
        $ls     = $this->listTransferStatus([$active]);
        $rows   = [];

        foreach ($ls as $item) {
            $a = [];

            if ($active == 1) {
                $a[] = [
                    'class'   => 'inline-flex items-center justify-center w-9 h-9 p-2 text-[#9CA3AF] hover:text-blue-600 transition-colors cursor-pointer bg-transparent border-0',
                    'html'    => '<i data-lucide="pencil" class="w-4 h-4"></i>',
                    'onclick' => 'transferStatus.editTransferStatus(' . $item['id'] . ')'
                ];
                $a[] = [
                    'class'   => 'inline-flex items-center justify-center w-9 h-9 p-2 text-emerald-500 hover:text-red-600 transition-colors cursor-pointer bg-transparent border-0',
                    'html'    => '<i data-lucide="toggle-right" class="w-4 h-4"></i>',
                    'onclick' => 'transferStatus.statusTransferStatus(' . $item['id'] . ', ' . $item['active'] . ')'
                ];
            } else {
                $a[] = [
                    'class'   => 'inline-flex items-center justify-center w-9 h-9 p-2 text-[#9CA3AF] hover:text-emerald-600 transition-colors cursor-pointer bg-transparent border-0',
                    'html'    => '<i data-lucide="toggle-left" class="w-4 h-4"></i>',
                    'onclick' => 'transferStatus.statusTransferStatus(' . $item['id'] . ', ' . $item['active'] . ')'
                ];
            }

            $rows[] = [
                'id'        => $item['id'],
                'Código'    => $item['code'],
                'Estado'    => badge($item['valor'], $item['color_hex'], 100, $item['bg_hex'] ?? null),
                'Yo envío'  => $item['name_out'] ?: '-',
                'Yo recibo' => $item['name_in'] ?: '-',
                'Orden'     => $item['order_index'],
                'Activo'    => renderStatus($item['active']),
                'a'         => $a
            ];
        }

        return [
            'row' => $rows,
            'ls'  => $ls
        ];
    }

    function getTransferStatus() {
        $id  = $_POST['id'];
        $row = $this->getTransferStatusById([$id]);

        if ($row) {
            return ['status' => 200, 'message' => 'Estado encontrado', 'data' => $row];
        }

        return ['status' => 404, 'message' => 'Estado no encontrado', 'data' => null];
    }

    function editTransferStatus() {
        $status  = 500;
        $message = 'Error al editar estado';

        // Regla CoffeeSoft: sql(,1) usa el ULTIMO campo como WHERE.
        $id = $_POST['id'];
        unset($_POST['id']);
        $_POST['id'] = $id;

        $edit = $this->updateTransferStatus($this->util->sql($_POST, 1));

        if ($edit) {
            $status  = 200;
            $message = 'Estado de traspaso actualizado correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
    }

    function statusTransferStatus() {
        $status  = 500;
        $message = 'Error al cambiar el estado';

        $update = $this->updateTransferStatus($this->util->sql($_POST, 1));

        if ($update) {
            $status  = 200;
            $message = 'Estado actualizado correctamente';
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
                    'class'   => 'inline-flex items-center justify-center w-9 h-9 p-2 text-[#9CA3AF] hover:text-blue-600 transition-colors cursor-pointer bg-transparent border-0',
                    'html'    => '<i data-lucide="pencil" class="w-4 h-4"></i>',
                    'onclick' => 'warehouse.editWarehouse(' . $item['id'] . ')'
                ];
                $a[] = [
                    'class'   => 'inline-flex items-center justify-center w-9 h-9 p-2 text-emerald-500 hover:text-red-600 transition-colors cursor-pointer bg-transparent border-0',
                    'html'    => '<i data-lucide="toggle-right" class="w-4 h-4"></i>',
                    'onclick' => 'warehouse.statusWarehouse(' . $item['id'] . ', ' . $item['active'] . ')'
                ];
            } else {
                $a[] = [
                    'class'   => 'inline-flex items-center justify-center w-9 h-9 p-2 text-[#9CA3AF] hover:text-emerald-600 transition-colors cursor-pointer bg-transparent border-0',
                    'html'    => '<i data-lucide="toggle-left" class="w-4 h-4"></i>',
                    'onclick' => 'warehouse.statusWarehouse(' . $item['id'] . ', ' . $item['active'] . ')'
                ];
            }

            $rows[] = [
                'id'          => $item['id'],
                'Almacén'     => renderWarehouse($item['valor']),
                'Sucursal'    => $item['branch_name'] ?? '—',
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

        $_POST['created_at']   = date('Y-m-d H:i:s');
        $_POST['active']       = 1;
        $_POST['companies_id'] = $_SESSION['company_id'];

        // La sucursal se elige en el formulario; si no llega, se usa la de la sesión.
        if (($_POST['branch_id'] ?? '') === '') {
            $_POST['branch_id'] = $_SESSION['branch_id'];
        }

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

    // Proveedores --

    function lsSupplier() {
        $active = $_POST['active'] ?? 1;
        $ls     = $this->listSupplier([$active]);
        $rows   = [];

        foreach ($ls as $item) {
            $a = [];

            if ($active == 1) {
                $a[] = [
                    'class'   => 'inline-flex items-center justify-center w-9 h-9 p-2 text-[#9CA3AF] hover:text-blue-600 transition-colors cursor-pointer bg-transparent border-0',
                    'html'    => '<i data-lucide="pencil" class="w-4 h-4"></i>',
                    'onclick' => 'supplier.editSupplier(' . $item['id'] . ')'
                ];
                $a[] = [
                    'class'   => 'inline-flex items-center justify-center w-9 h-9 p-2 text-emerald-500 hover:text-red-600 transition-colors cursor-pointer bg-transparent border-0',
                    'html'    => '<i data-lucide="toggle-right" class="w-4 h-4"></i>',
                    'onclick' => 'supplier.statusSupplier(' . $item['id'] . ', ' . $item['active'] . ')'
                ];
            } else {
                $a[] = [
                    'class'   => 'inline-flex items-center justify-center w-9 h-9 p-2 text-[#9CA3AF] hover:text-emerald-600 transition-colors cursor-pointer bg-transparent border-0',
                    'html'    => '<i data-lucide="toggle-left" class="w-4 h-4"></i>',
                    'onclick' => 'supplier.statusSupplier(' . $item['id'] . ', ' . $item['active'] . ')'
                ];
            }

            $rows[] = [
                'id'        => $item['id'],
                'Proveedor' => $item['valor'],
                'Contacto'  => $item['contact_name'] ?? '—',
                'Teléfono'  => $item['phone'] ?? '—',
                'Email'     => $item['email'] ?? '—',
                'Estado'    => renderStatus($item['active']),
                'a'         => $a
            ];
        }

        return [
            'row' => $rows,
            'ls'  => $ls
        ];
    }

    function getSupplier() {
        $id      = $_POST['id'];
        $status  = 404;
        $message = 'Proveedor no encontrado';
        $data    = null;

        $supplier = $this->getSupplierById([$id]);

        if ($supplier) {
            $status  = 200;
            $message = 'Proveedor encontrado';
            $data    = $supplier;
        }

        return [
            'status'  => $status,
            'message' => $message,
            'data'    => $data
        ];
    }

    function addSupplier() {
        $status  = 500;
        $message = 'Error al crear proveedor';

        $_POST['created_at']   = date('Y-m-d H:i:s');
        $_POST['active']       = 1;
        $_POST['companies_id'] = $_SESSION['company_id'];

        $exists = $this->existsSupplierByName([$_POST['name']]);

        if ($exists > 0) {
            return [
                'status'  => 409,
                'message' => 'Ya existe un proveedor con ese nombre'
            ];
        }

        $create = $this->createSupplier($this->util->sql($_POST));

        if ($create) {
            $status  = 200;
            $message = 'Proveedor creado exitosamente';
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
    }

    function editSupplier() {
        $status  = 500;
        $message = 'Error al editar proveedor';

        // Regla CoffeeSoft: sql(,1) usa el ULTIMO campo como WHERE.
        $id = $_POST['id'];
        unset($_POST['id']);
        $_POST['id'] = $id;

        $edit = $this->updateSupplier($this->util->sql($_POST, 1));

        if ($edit) {
            $status  = 200;
            $message = 'Proveedor actualizado correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
    }

    function statusSupplier() {
        $status  = 500;
        $message = 'Error al cambiar el estado del proveedor';

        $update = $this->updateSupplier($this->util->sql($_POST, 1));

        if ($update) {
            $status  = 200;
            $message = 'Estado del proveedor actualizado correctamente';
        }

        return [
            'status'  => $status,
            'message' => $message
        ];
    }

    // Catalogos auxiliares para selects de formularios
    function lsBranchesSelect() {
        $companyId = $_SESSION['company_id'] ?? 0;

        return [
            'status' => 200,
            'data'   => $this->listBranchesSelect([$companyId])
        ];
    }

    // Mueve una fila un lugar ('up' | 'down') y renumera todas de 10 en 10, así también
    // se acomodan las que traían el mismo sort_order. Devuelve [id => sort_order] o [].
    private function reorder($rows, $id, $dir) {
        $ids = array_map('intval', array_column($rows, 'id'));
        $pos = array_search($id, $ids, true);

        if ($pos === false) return [];

        $to = $dir === 'up' ? $pos - 1 : $pos + 1;

        if (isset($ids[$to])) {
            [$ids[$pos], $ids[$to]] = [$ids[$to], $ids[$pos]];
        }

        $order = [];
        foreach ($ids as $i => $rowId) {
            $order[$rowId] = ($i + 1) * 10;
        }

        return $order;
    }
}

// Complements

function renderCode($code) {
    return '<span class="inline-block px-2 py-0.5 rounded border border-gray-200 bg-gray-100 text-[10px] font-semibold font-mono text-gray-600">' . htmlspecialchars($code ?? '', ENT_QUOTES) . '</span>';
}

// Flechas de orden manual. La primera fila no sube y la última no baja.
function sortButtons($fn, $id, $first, $last) {
    $btn = 'inline-flex items-center justify-center w-9 h-9 p-2 text-[#9CA3AF] transition-colors bg-transparent border-0 ';

    return [
        [
            'class'   => $btn . ($first ? 'opacity-30 pointer-events-none' : 'hover:text-blue-600 cursor-pointer'),
            'html'    => '<i data-lucide="chevron-up" class="w-4 h-4"></i>',
            'title'   => 'Subir',
            'onclick' => $first ? '' : $fn . '(' . $id . ', \'up\')'
        ],
        [
            'class'   => $btn . ($last ? 'opacity-30 pointer-events-none' : 'hover:text-blue-600 cursor-pointer'),
            'html'    => '<i data-lucide="chevron-down" class="w-4 h-4"></i>',
            'title'   => 'Bajar',
            'onclick' => $last ? '' : $fn . '(' . $id . ', \'down\')'
        ]
    ];
}

function renderWarehouse($name) {
    return '<span class="inline-flex items-center gap-2"><i data-lucide="warehouse" class="w-4 h-4 text-gray-400"></i>' . htmlspecialchars($name ?? '', ENT_QUOTES) . '</span>';
}

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
