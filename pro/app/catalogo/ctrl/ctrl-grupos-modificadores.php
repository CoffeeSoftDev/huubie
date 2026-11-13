<?php
require_once __DIR__ . '/../../../core/security/_Session.php';
if (empty($_POST['opc'])) exit(0);

require_once __DIR__ . '/core-catalogo.php';

// Grupos de la pestaña Modificadores (lista de la izquierda): cada grupo es de una empresa
// o una plantilla de Huubie (company_id NULL).
class ctrl extends core {

    // Datos crudos: el JS pinta cada grupo como una tarjeta de la lista.
    public function lsModifierGroups() {
        $fail = $this->needCompany();
        if ($fail) return array_merge($fail, ['groups' => []]);

        $company = $this->companyId();
        $groups  = [];

        foreach ($this->qListModifierGroups($company, $this->activeFilter()) as $item) {
            $groups[] = [
                'id'        => (int) $item['id'],
                'name'      => $item['name'],
                'multiple'  => $this->groupMultiple($item['is_extra'], $item['name']),
                'modifiers' => (int) $item['modifiers'],
                'template'  => $this->isTemplate($item),
                'active'    => (int) $item['active']
            ];
        }

        return ['status' => 200, 'groups' => $groups, 'count' => $this->qCountModifierGroups($company)];
    }

    // is_extra sale como lo trata Pedidos: el formulario muestra lo que de verdad pasa.
    public function getModifierGroup() {
        $data = $this->qGetModifierGroup($this->postId(), $this->companyId());

        if (!$data) return $this->fail(404, 'El grupo no existe.');

        $data['is_extra'] = $this->groupMultiple($data['is_extra'], $data['name']) ? 1 : 0;

        return ['status' => 200, 'data' => $data];
    }

    public function addModifierGroup() {
        $fail = $this->needCompany();
        if ($fail) return $fail;

        $in = $this->groupInput();
        if (isset($in['status'])) return $in;

        $dup = $this->qFindModifierGroupByName($this->companyId(), $in['name']);
        if ($dup) return $this->duplicatedGroup($dup);

        return $this->attempt(function () use ($in) {
            $this->must($this->qCreateModifierGroup([
                'values' => ['name', 'is_extra', 'company_id', 'active'],
                'data'   => [$in['name'], $in['is_extra'], $this->companyId(), 1]
            ]), 'addModifierGroup');

            return $this->ok('Grupo creado.');
        }, 'No se pudo guardar el grupo.');
    }

    public function editModifierGroup() {
        $fail = $this->needCompany();
        if ($fail) return $fail;

        $id    = $this->postId();
        $group = $this->qGetModifierGroup($id, $this->companyId());

        if (!$group) return $this->fail(404, 'El grupo no existe.');
        if ($this->isTemplate($group)) return $this->lockedTemplate();

        $in = $this->groupInput();
        if (isset($in['status'])) return $in;

        $dup = $this->qFindModifierGroupByName($this->companyId(), $in['name'], $id);
        if ($dup) return $this->duplicatedGroup($dup);

        return $this->attempt(function () use ($in, $id) {
            $this->must($this->qUpdateModifierGroup([
                'values' => ['name', 'is_extra', 'updated_at = NOW()'],
                'where'  => ['id'],
                'data'   => [$in['name'], $in['is_extra'], $id]
            ]), 'editModifierGroup');

            return $this->ok('Grupo actualizado.');
        }, 'No se pudo guardar el grupo.');
    }

    public function statusModifierGroup() {
        $fail = $this->needCompany();
        if ($fail) return $fail;

        $id    = $this->postId();
        $group = $this->qGetModifierGroup($id, $this->companyId());

        if (!$group) return $this->fail(404, 'El grupo no existe.');
        if ($this->isTemplate($group)) return $this->lockedTemplate();

        $active = $this->flag('active');

        return $this->attempt(function () use ($active, $id) {
            $this->must($this->qUpdateModifierGroup([
                'values' => ['active', 'updated_at = NOW()'],
                'where'  => ['id'],
                'data'   => [$active, $id]
            ]), 'statusModifierGroup');

            return $this->ok($active === 1 ? 'Grupo activado.' : 'Grupo desactivado.');
        }, 'No se pudo cambiar el estado del grupo.');
    }

    // -- Auxiliares --

    // Devuelve ['name','is_extra'] o una respuesta de error (trae 'status').
    private function groupInput() {
        $name = $this->nameInput();

        if ($name === '')               return $this->fail(400, 'Escribe el nombre del grupo.');
        if ($this->tooLong($name, 100)) return $this->fail(400, 'El nombre admite hasta 100 caracteres.');

        return ['name' => $name, 'is_extra' => $this->flag('is_extra')];
    }

    // El nombre puede chocar con otro grupo propio o con una plantilla.
    private function duplicatedGroup($dup) {
        if ($this->isTemplate($dup)) return $this->fail(409, 'Ya existe una plantilla de Huubie con ese nombre.');

        return $this->duplicated($dup, 'un grupo con ese nombre');
    }
}

Permission::dispatch(new ctrl(), 'catalogo');
