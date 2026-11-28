<?php
require_once __DIR__ . '/../../../core/security/_Session.php';
if (empty($_POST['opc'])) exit(0);

require_once __DIR__ . '/core-catalogo.php';

/*  Pestaña Departamentos del Catálogo de insumos (department; en pantalla
    «Área que pide»): Pastelería, Panadería, Mostrador... La requisición dice
    qué área pide. Nada se borra: se da de baja y se reactiva desde
    «Inactivos». */
class ctrl extends coreCatalogo {

    // Columnas: Departamento, Orden, Estado.
    public function lsDepartamentos() {
        $fail = $this->needShow();
        if ($fail) return $fail;

        $row = array_map(function ($d) {
            $id = (int) $d['id'];

            return [
                'id'           => $id,
                'Departamento' => $this->badge($d['name'], $d['color_hex'] ?: '#64748B', null, $d['icon']),
                'Orden'        => (int) $d['sort_order'],
                'Estado'       => $this->activeCell($d['active']),
                'a'            => $this->rowActions('departamentos', $id, $d['active'])
            ];
        }, $this->qCatalogRows('department', $this->companyId(), $this->activeFilter()));

        return $this->listed('departamentos', $row);
    }

    public function getDepartamento() {
        $fail = $this->needSave(1);
        if ($fail) return $fail;

        $d = $this->qCatalogRow('department', $this->postId(), $this->companyId());

        return $d ? ['status' => 200, 'data' => $d] : $this->fail(404, 'Ese departamento ya no existe.');
    }

    public function addDepartamento() {
        $fail = $this->needSave(0);
        if ($fail) return $fail;

        $in = $this->departmentInput(0);
        if (isset($in['status'])) return $in;

        $in += [
            'sort_order' => $this->qMaxSort('department', $this->companyId()) + 1,
            'company_id' => $this->companyId(),
            'active'     => 1
        ];

        return $this->attempt(function () use ($in) {
            $this->must($this->qCatalogInsert('department', array_keys($in), array_values($in)), 'addDepartamento');

            return $this->ok('Departamento agregado.');
        }, 'No se pudo guardar el departamento.');
    }

    public function editDepartamento() {
        $fail = $this->needSave(1);
        if ($fail) return $fail;

        $id = $this->postId();
        if (!$this->qCatalogRow('department', $id, $this->companyId())) return $this->fail(404, 'Ese departamento ya no existe.');

        $in = $this->departmentInput($id);
        if (isset($in['status'])) return $in;

        return $this->attempt(function () use ($in, $id) {
            $this->must($this->qCatalogUpdate('department', array_keys($in), array_merge(array_values($in), [$id])), 'editDepartamento');

            return $this->ok('Cambios guardados.');
        }, 'No se pudo guardar el departamento.');
    }

    public function statusDepartamento() {
        $fail = $this->needStatus();
        if ($fail) return $fail;

        $d      = $this->qCatalogRow('department', $this->postId(), $this->companyId());
        $active = $this->flag('active');

        if (!$d) return $this->fail(404, 'Ese departamento ya no existe.');

        return $this->attempt(function () use ($d, $active) {
            $this->must($this->qCatalogUpdate('department', ['active'], [$active, (int) $d['id']]), 'statusDepartamento');

            return $this->ok($active === 1 ? 'Departamento activado.' : 'Departamento dado de baja. Lo reactivas desde «Inactivos».');
        }, 'No se pudo cambiar el departamento.');
    }

    private function departmentInput($id) {
        $name = $this->requiredText('name', 'el nombre del departamento', 80);
        if (is_array($name)) return $name;

        if ($this->qCatalogTaken('department', 'name', $name, $this->companyId(), (int) $id)) return $this->fail(409, 'Ya hay un departamento con ese nombre.');

        return [
            'name'      => $name,
            'icon'      => $this->icon(),
            'color_hex' => $this->color('color_hex', '#64748B')
        ];
    }
}

Permission::dispatch(new ctrl(), 'inv-catalogo');
