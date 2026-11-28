<?php
require_once __DIR__ . '/../../../core/security/_Session.php';
if (empty($_POST['opc'])) exit(0);

require_once __DIR__ . '/core-catalogo.php';

/*  Pestaña Almacenes del Catálogo de insumos (warehouse). Cada sucursal tiene
    al menos uno. El Dueño o root ven los de todas las sucursales y eligen el
    principal (Matriz: ahí se piden las requisiciones). Por defecto: uno por
    sucursal. No se da de baja el principal, el único de la sucursal ni uno
    con existencia. */
class ctrl extends coreCatalogo {

    // Las sucursales que ofrece la ficha (solo Dueño o root eligen otra).
    public function formOptions() {
        $fail = $this->needShow();
        if ($fail) return $fail;

        return [
            'status'     => 200,
            'is_admin'   => $this->isAdmin(),
            'branch_id'  => $this->branchId(),
            'sucursales' => array_map(function ($b) {
                return ['id' => (int) $b['id'], 'valor' => $this->shortBranch($b['name'])];
            }, $this->qBranches($this->companyId()))
        ];
    }

    // Columnas: Almacén, Sucursal, Por defecto, Principal, Mueve inventario, Existencia, Estado.
    public function lsAlmacenes() {
        $fail = $this->needShow();
        if ($fail) return $fail;

        $row = array_map(function ($w) {
            $id = (int) $w['id'];

            return [
                'id'               => $id,
                'Almacén'          => $this->cellTitle($w['name']),
                'Sucursal'         => h($this->shortBranch($w['branch'])),
                'Por defecto'      => $this->yesNo($w['is_default']),
                'Principal'        => (int) $w['is_main'] === 1 ? $this->chip('Principal', 'violet') : $this->dash(),
                'Mueve inventario' => $this->yesNo($w['supply_moves_stock']),
                'Existencia'       => h($this->num($w['stock_units'])),
                'Estado'           => $this->activeCell($w['active']),
                'a'                => $this->rowActions('almacenes', $id, $w['active'])
            ];
        }, $this->qWarehouseRows($this->companyId(), $this->activeFilter(), $this->isAdmin() ? null : $this->branchId()));

        return $this->listed('almacenes', $row);
    }

    public function getAlmacen() {
        $fail = $this->needSave(1);
        if ($fail) return $fail;

        $w = $this->ownWarehouseRow($this->postId());

        return $w ? ['status' => 200, 'data' => $w] : $this->fail(404, 'Ese almacén ya no existe.');
    }

    public function addAlmacen() {
        $fail = $this->needSave(0);
        if ($fail) return $fail;

        $in = $this->warehouseInput(null);
        if (isset($in['status'])) return $in;

        return $this->attempt(function () use ($in) {
            $this->transaction(function () use ($in) {
                $this->must($this->qCatalogInsert('warehouse', array_keys($in), array_values($in)), 'addAlmacen');
                $this->uniqueFlags($in, $this->newId('addAlmacen'));
            });

            return $this->ok('Almacén agregado.');
        }, 'No se pudo guardar el almacén.');
    }

    public function editAlmacen() {
        $fail = $this->needSave(1);
        if ($fail) return $fail;

        $id = $this->postId();
        $w  = $this->ownWarehouseRow($id);

        if (!$w) return $this->fail(404, 'Ese almacén ya no existe.');

        $in = $this->warehouseInput($w);
        if (isset($in['status'])) return $in;

        return $this->attempt(function () use ($in, $id) {
            $this->transaction(function () use ($in, $id) {
                $this->must($this->qCatalogUpdate('warehouse', array_keys($in), array_merge(array_values($in), [$id])), 'editAlmacen');
                $this->uniqueFlags($in, $id);
            });

            return $this->ok('Cambios guardados.');
        }, 'No se pudo guardar el almacén.');
    }

    public function statusAlmacen() {
        $fail = $this->needStatus();
        if ($fail) return $fail;

        $w      = $this->ownWarehouseRow($this->postId());
        $active = $this->flag('active');

        if (!$w) return $this->fail(404, 'Ese almacén ya no existe.');

        if ($active === 0) {
            $stop = $this->cannotDeactivate($w);
            if ($stop) return $this->fail(409, $stop);
        }

        return $this->attempt(function () use ($w, $active) {
            $this->must($this->qCatalogUpdate('warehouse', ['active'], [$active, (int) $w['id']]), 'statusAlmacen');

            return $this->ok($active === 1 ? 'Almacén activado.' : 'Almacén dado de baja. Lo reactivas desde «Inactivos».');
        }, 'No se pudo cambiar el almacén.');
    }

    // -- Auxiliares --

    // El almacén, solo si es de los que puede tocar.
    private function ownWarehouseRow($id) {
        $w = $this->qCatalogRow('warehouse', $id, $this->companyId());

        return $w && in_array((int) $w['id'], $this->manageableWarehouseIds(), true) ? $w : null;
    }

    private function warehouseInput($row) {
        $name = $this->requiredText('name', 'el nombre del almacén', 120);
        if (is_array($name)) return $name;

        if ($this->qCatalogTaken('warehouse', 'name', $name, $this->companyId(), (int) ($row['id'] ?? 0))) return $this->fail(409, 'Ya hay un almacén con ese nombre.');

        // Solo el Dueño o root lo ponen en otra sucursal y eligen el principal.
        $branchId = $this->isAdmin() && $this->postId('branch_id') > 0 ? $this->postId('branch_id') : (int) ($row['branch_id'] ?? $this->branchId());
        $branch   = $this->qBranch($branchId);

        if (!$branch || (int) $branch['company_id'] !== $this->companyId()) return $this->fail(400, 'Elige una sucursal de la empresa.');

        $in = [
            'name'               => $name,
            'branch_id'          => $branchId,
            'is_default'         => $this->flag('is_default'),
            'supply_moves_stock' => $this->flag('supply_moves_stock')
        ];

        if ($this->isAdmin()) $in['is_main'] = $this->flag('is_main');

        if ($row && (int) $row['is_main'] === 1 && isset($in['is_main']) && $in['is_main'] === 0) {
            return $this->fail(409, 'Para quitarle «Principal», marca otro almacén como principal.');
        }

        if (!$row) $in += ['company_id' => $this->companyId(), 'active' => 1];

        return $in;
    }

    // Principal: uno por empresa. Por defecto: uno por sucursal. Dentro de transaction().
    private function uniqueFlags($in, $id) {
        if (!empty($in['is_main']))    $this->must($this->qClearWarehouseFlag('is_main', $this->companyId(), null, $id), 'almacen/main');
        if (!empty($in['is_default'])) $this->must($this->qClearWarehouseFlag('is_default', $this->companyId(), $in['branch_id'], $id), 'almacen/default');
    }

    // Por qué no se puede dar de baja; null = sí se puede.
    private function cannotDeactivate($w) {
        if ((int) $w['is_main'] === 1) return 'Es el almacén principal: marca otro como principal antes.';

        $live = $this->qWarehouseRows($this->companyId(), 1, (int) $w['branch_id']);
        if (count($live) <= 1) return 'Es el único almacén activo de la sucursal.';

        foreach ($live as $l) {
            if ((int) $l['id'] === (int) $w['id'] && abs((float) $l['stock_units']) > 0.00001) {
                return 'Todavía tiene existencia: pásala a otro almacén con un traspaso antes.';
            }
        }

        return null;
    }
}

Permission::dispatch(new ctrl(), 'inv-catalogo');
