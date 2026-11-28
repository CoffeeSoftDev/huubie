<?php
require_once __DIR__ . '/../../../core/security/_Session.php';
if (empty($_POST['opc'])) exit(0);

require_once __DIR__ . '/core-catalogo.php';

/*  Pestaña Áreas del Catálogo de insumos (warehouse_area): dónde se guarda
    cada cosa dentro del almacén (refrigerador, congelador, anaquel). La elige
    la ficha del producto y la del insumo en «Dónde se guarda». */
class ctrl extends coreCatalogo {

    // Los almacenes que ofrece la ficha (los que puede tocar), con el de la sucursal primero.
    public function formOptions() {
        $fail = $this->needShow();
        if ($fail) return $fail;

        $admin = $this->isAdmin();

        return [
            'status'    => 200,
            'branch_id' => $this->branchId(),
            'almacenes' => array_map(function ($w) use ($admin) {
                return [
                    'id'        => (int) $w['id'],
                    'valor'     => $w['name'] . ($admin ? ' · ' . $this->shortBranch($w['branch']) : ''),
                    'branch_id' => (int) $w['branch_id']
                ];
            }, $this->qWarehouseRows($this->companyId(), 1, $admin ? null : $this->branchId()))
        ];
    }

    // Columnas: Área, Almacén, Descripción, Productos, Estado.
    public function lsAreas() {
        $fail = $this->needShow();
        if ($fail) return $fail;

        $used = [];

        foreach ($this->products() as $p) {
            if ($p['warehouse_area_id']) $used[(int) $p['warehouse_area_id']] = ($used[(int) $p['warehouse_area_id']] ?? 0) + 1;
        }

        $row = array_map(function ($a) use ($used) {
            $id = (int) $a['id'];
            $n  = $used[$id] ?? 0;

            return [
                'id'          => $id,
                'Área'        => $this->badge($a['name'], $a['color_hex'] ?: '#0369A1', null, 'map-pin'),
                'Almacén'     => h($a['warehouse']),
                'Descripción' => $this->shortText($a['description']),
                'Productos'   => $n > 0 ? $n : $this->dash(),
                'Estado'      => $this->activeCell($a['active']),
                'a'           => $this->rowActions('areas', $id, $a['active'])
            ];
        }, $this->qAreaRows($this->manageableWarehouseIds(), $this->activeFilter()));

        return $this->listed('areas', $row);
    }

    public function getArea() {
        $fail = $this->needSave(1);
        if ($fail) return $fail;

        $a = $this->ownArea($this->postId());

        return $a ? ['status' => 200, 'data' => $a] : $this->fail(404, 'Esa área ya no existe.');
    }

    public function addArea() {
        $fail = $this->needSave(0);
        if ($fail) return $fail;

        $in = $this->areaInput(0);
        if (isset($in['status'])) return $in;

        return $this->attempt(function () use ($in) {
            $this->must($this->qCatalogInsert('warehouse_area', array_merge(array_keys($in), ['active']), array_merge(array_values($in), [1])), 'addArea');

            return $this->ok('Área agregada.');
        }, 'No se pudo guardar el área.');
    }

    public function editArea() {
        $fail = $this->needSave(1);
        if ($fail) return $fail;

        $id = $this->postId();
        if (!$this->ownArea($id)) return $this->fail(404, 'Esa área ya no existe.');

        $in = $this->areaInput($id);
        if (isset($in['status'])) return $in;

        return $this->attempt(function () use ($in, $id) {
            $this->must($this->qCatalogUpdate('warehouse_area', array_keys($in), array_merge(array_values($in), [$id])), 'editArea');

            return $this->ok('Cambios guardados.');
        }, 'No se pudo guardar el área.');
    }

    // Dada de baja deja de ofrecerse en las fichas; lo que ya la tenía la conserva.
    public function statusArea() {
        $fail = $this->needStatus();
        if ($fail) return $fail;

        $a      = $this->ownArea($this->postId());
        $active = $this->flag('active');

        if (!$a) return $this->fail(404, 'Esa área ya no existe.');

        return $this->attempt(function () use ($a, $active) {
            $this->must($this->qCatalogUpdate('warehouse_area', ['active'], [$active, (int) $a['id']]), 'statusArea');

            return $this->ok($active === 1 ? 'Área activada.' : 'Área dada de baja. La reactivas desde «Inactivos».');
        }, 'No se pudo cambiar el área.');
    }

    // -- Auxiliares --

    // El área, solo si su almacén es de los que puede tocar.
    private function ownArea($id) {
        $a = $this->qAreaRow($id);

        return $a && in_array((int) $a['warehouse_id'], $this->manageableWarehouseIds(), true) ? $a : null;
    }

    private function areaInput($exceptId) {
        $name = $this->requiredText('name', 'el nombre del área', 120);
        if (is_array($name)) return $name;

        $warehouseId = $this->postId('warehouse_id');
        if (!in_array($warehouseId, $this->manageableWarehouseIds(), true)) return $this->fail(400, 'Elige el almacén del área.');

        foreach ($this->qAreaRows([$warehouseId], 1) as $a) {
            if ((int) $a['id'] !== (int) $exceptId && mb_strtolower($a['name'], 'UTF-8') === mb_strtolower($name, 'UTF-8')) {
                return $this->fail(409, 'Ese almacén ya tiene un área con ese nombre.');
            }
        }

        return [
            'name'         => $name,
            'description'  => $this->textOrNull('description', 255),
            'color_hex'    => $this->color('color_hex', '#0369A1'),
            'warehouse_id' => $warehouseId
        ];
    }
}

Permission::dispatch(new ctrl(), 'inv-catalogo');
