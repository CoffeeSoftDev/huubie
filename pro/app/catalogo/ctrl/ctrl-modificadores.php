<?php
require_once __DIR__ . '/../../../core/security/_Session.php';
if (empty($_POST['opc'])) exit(0);

require_once __DIR__ . '/core-catalogo.php';

// Opciones de la pestaña Modificadores (lado derecho): cuelgan de un grupo;
// las de un grupo plantilla son de solo lectura.
class ctrl extends core {

    // Grupos del modal: solo propios. keep_id conserva el actual aunque esté inactivo.
    // multiple decide si el precio se pide por porción o por pieza.
    public function formOptions() {
        $fail = $this->needCompany();
        if ($fail) return array_merge($fail, ['groups' => []]);

        $groups = $this->qModifierGroupOptions($this->companyId(), true, $this->postId('keep_id'));

        foreach ($groups as &$group) {
            $group['multiple'] = $this->groupMultiple($group['is_extra'], $group['valor']);
        }
        unset($group);

        return ['status' => 200, 'groups' => $groups];
    }

    // Las opciones de UN grupo: el JS siempre manda modifier_group_id.
    public function lsModifiers() {
        $fail = $this->needCompany();
        if ($fail) return $fail;

        $group = $this->selectOrNull('modifier_group_id');
        $row   = [];

        if ($group === null) return ['status' => 200, 'row' => []];

        foreach ($this->qListModifiers($this->companyId(), $this->activeFilter(), $group) as $item) {
            $id     = (int) $item['id'];
            $locked = $item['group_company_id'] === null;
            $price  = $this->groupMultiple($item['is_extra'], $item['group_name']) ? 'Precio por pieza' : 'Precio por porción';

            $row[] = [
                'id'       => $id,
                'Opción'   => cellTitle($item['name'], $item['description']),
                $price     => moneyCell($item['price']),
                'Estado'   => renderActive($item['active']),
                'a'        => $this->rowActions('modifiers', $id, $item['active'], $locked)
            ];
        }

        return ['status' => 200, 'row' => $row];
    }

    public function getModifier() {
        $data = $this->qGetModifier($this->postId(), $this->companyId());

        return $data ? ['status' => 200, 'data' => $data] : $this->fail(404, 'La opción no existe.');
    }

    public function addModifier() {
        $fail = $this->needCompany();
        if ($fail) return $fail;

        $in = $this->modifierInput();
        if (isset($in['status'])) return $in;

        $dup = $this->qFindModifierByName($in['group_id'], $in['name']);
        if ($dup) return $this->duplicated($dup, 'una opción con ese nombre en el grupo');

        // quantity va en 1, como todas las que ya existen: el formulario ya no la pide.
        return $this->attempt(function () use ($in) {
            $this->must($this->qCreateModifier([
                'values' => ['name', 'description', 'price', 'quantity', 'modifier_group_id', 'active'],
                'data'   => [$in['name'], $in['description'], $in['price'], 1, $in['group_id'], 1]
            ]), 'addModifier');

            return $this->ok('Opción creada.');
        }, 'No se pudo guardar la opción.');
    }

    public function editModifier() {
        $fail = $this->needCompany();
        if ($fail) return $fail;

        $id      = $this->postId();
        $current = $this->qGetModifier($id, $this->companyId());

        if (!$current) return $this->fail(404, 'La opción no existe.');
        if ($current['group_company_id'] === null) return $this->lockedTemplate();

        $in = $this->modifierInput((int) $current['modifier_group_id']);
        if (isset($in['status'])) return $in;

        $dup = $this->qFindModifierByName($in['group_id'], $in['name'], $id);
        if ($dup) return $this->duplicated($dup, 'una opción con ese nombre en el grupo');

        // quantity no se toca: se queda la que ya tenía.
        return $this->attempt(function () use ($in, $id) {
            $this->must($this->qUpdateModifier([
                'values' => ['modifier_group_id', 'name', 'description', 'price', 'updated_at = NOW()'],
                'where'  => ['id'],
                'data'   => [$in['group_id'], $in['name'], $in['description'], $in['price'], $id]
            ]), 'editModifier');

            return $this->ok('Opción actualizada.');
        }, 'No se pudo guardar la opción.');
    }

    public function statusModifier() {
        $fail = $this->needCompany();
        if ($fail) return $fail;

        $id      = $this->postId();
        $current = $this->qGetModifier($id, $this->companyId());

        if (!$current) return $this->fail(404, 'La opción no existe.');
        if ($current['group_company_id'] === null) return $this->lockedTemplate();

        $active = $this->flag('active');

        return $this->attempt(function () use ($active, $id) {
            $this->must($this->qUpdateModifier([
                'values' => ['active', 'updated_at = NOW()'],
                'where'  => ['id'],
                'data'   => [$active, $id]
            ]), 'statusModifier');

            return $this->ok($active === 1 ? 'Opción activada.' : 'Opción desactivada.');
        }, 'No se pudo cambiar el estado de la opción.');
    }

    // -- Auxiliares --

    // Devuelve los campos listos o una respuesta de error (trae 'status').
    // $currentGroup: el grupo que ya tenía al editar; ese se acepta aunque esté inactivo.
    private function modifierInput($currentGroup = 0) {
        $groupId     = $this->selectOrNull('modifier_group_id');
        $name        = $this->nameInput();
        $description = $this->textOrNull('description');
        $price       = $this->amount('price', 0);

        if ($groupId === null)                 return $this->fail(400, 'Elige el grupo de la opción.');
        if ($name === '')                      return $this->fail(400, 'Escribe el nombre de la opción.');
        if ($this->tooLong($name, 255))        return $this->fail(400, 'El nombre admite hasta 255 caracteres.');
        if ($this->tooLong($description, 255)) return $this->fail(400, 'La descripción admite hasta 255 caracteres.');
        if ($price === null)                   return $this->fail(400, 'El precio debe ser un número mayor o igual a 0.');

        $group = $this->qGetModifierGroup($groupId, $this->companyId());

        if (!$group)                   return $this->fail(400, 'El grupo elegido no existe.');
        if ($this->isTemplate($group)) return $this->lockedTemplate();

        if ((int) $group['active'] === 0 && (int) $group['id'] !== $currentGroup) {
            return $this->fail(409, 'El grupo elegido está inactivo. Actívalo o elige otro.');
        }

        return [
            'group_id'    => (int) $group['id'],
            'name'        => $name,
            'description' => $description,
            'price'       => $price
        ];
    }
}

Permission::dispatch(new ctrl(), 'catalogo');
