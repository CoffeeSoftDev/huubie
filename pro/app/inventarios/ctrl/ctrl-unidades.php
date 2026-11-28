<?php
require_once __DIR__ . '/../../../core/security/_Session.php';
if (empty($_POST['opc'])) exit(0);

require_once __DIR__ . '/core-catalogo.php';

/*  Pestaña Unidades del Catálogo de insumos (unit): en qué se cuenta cada
    producto e insumo. La usan las dos fichas (venta e insumo). Con decimales
    se captura 2.5; sin ellos, piezas enteras. Una unidad en uso no se da de baja. */
class ctrl extends coreCatalogo {

    // Columnas: Código, Unidad, Decimales, Productos, Estado.
    public function lsUnidades() {
        $fail = $this->needShow();
        if ($fail) return $fail;

        $used = $this->qUnitUsage($this->companyId());

        $row = array_map(function ($u) use ($used) {
            $id = (int) $u['id'];
            $n  = (int) ($used[$u['id']] ?? 0);

            return [
                'id'        => $id,
                'Código'    => $this->codeCell($u['code']),
                'Unidad'    => $this->cellTitle($u['name']),
                'Decimales' => (int) $u['allows_decimals'] === 1 ? 'Sí (2.5)' : 'No (piezas)',
                'Productos' => $n > 0 ? $n : $this->dash(),
                'Estado'    => $this->activeCell($u['active']),
                'a'         => $this->rowActions('unidades', $id, $u['active'])
            ];
        }, $this->qCatalogRows('unit', $this->companyId(), $this->activeFilter()));

        return $this->listed('unidades', $row);
    }

    public function getUnidad() {
        $fail = $this->needSave(1);
        if ($fail) return $fail;

        $u = $this->qCatalogRow('unit', $this->postId(), $this->companyId());

        return $u ? ['status' => 200, 'data' => $u] : $this->fail(404, 'Esa unidad ya no existe.');
    }

    public function addUnidad() {
        $fail = $this->needSave(0);
        if ($fail) return $fail;

        $in = $this->unitInput(0);
        if (isset($in['status'])) return $in;

        return $this->attempt(function () use ($in) {
            $this->must($this->qCatalogInsert('unit',
                ['code', 'name', 'allows_decimals', 'sort_order', 'company_id', 'active'],
                [$in['code'], $in['name'], $in['allows_decimals'], $this->qMaxSort('unit', $this->companyId()) + 1, $this->companyId(), 1]
            ), 'addUnidad');

            return $this->ok('Unidad agregada.');
        }, 'No se pudo guardar la unidad.');
    }

    public function editUnidad() {
        $fail = $this->needSave(1);
        if ($fail) return $fail;

        $id = $this->postId();
        if (!$this->qCatalogRow('unit', $id, $this->companyId())) return $this->fail(404, 'Esa unidad ya no existe.');

        $in = $this->unitInput($id);
        if (isset($in['status'])) return $in;

        return $this->attempt(function () use ($in, $id) {
            $this->must($this->qCatalogUpdate('unit', ['code', 'name', 'allows_decimals'], [$in['code'], $in['name'], $in['allows_decimals'], $id]), 'editUnidad');

            return $this->ok('Cambios guardados.');
        }, 'No se pudo guardar la unidad.');
    }

    public function statusUnidad() {
        $fail = $this->needStatus();
        if ($fail) return $fail;

        $u      = $this->qCatalogRow('unit', $this->postId(), $this->companyId());
        $active = $this->flag('active');

        if (!$u) return $this->fail(404, 'Esa unidad ya no existe.');

        if ($active === 0) {
            $used = (int) ($this->qUnitUsage($this->companyId())[$u['id']] ?? 0);

            if ($used > 0) return $this->fail(409, "La usan {$used} " . ($used === 1 ? 'producto' : 'productos') . ': cámbiales la unidad antes.');
        }

        return $this->attempt(function () use ($u, $active) {
            $this->must($this->qCatalogUpdate('unit', ['active'], [$active, (int) $u['id']]), 'statusUnidad');

            return $this->ok($active === 1 ? 'Unidad activada.' : 'Unidad dada de baja. La reactivas desde «Inactivos».');
        }, 'No se pudo cambiar la unidad.');
    }

    private function unitInput($exceptId) {
        $code = strtoupper(preg_replace('/[^A-Za-z0-9]/', '', $this->post('code')));
        $name = $this->requiredText('name', 'el nombre de la unidad', 80);

        if (is_array($name)) return $name;
        if ($code === '' || strlen($code) > 20) return $this->fail(400, 'Escribe el código de la unidad (letras y números, hasta 20).');
        if ($this->qCatalogTaken('unit', 'code', $code, $this->companyId(), $exceptId)) return $this->fail(409, "Ya hay una unidad con el código {$code}.");

        return ['code' => $code, 'name' => $name, 'allows_decimals' => $this->flag('allows_decimals')];
    }
}

Permission::dispatch(new ctrl(), 'inv-catalogo');
