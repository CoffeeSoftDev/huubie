<?php
require_once __DIR__ . '/../../../core/security/_Session.php';
if (empty($_POST['opc'])) exit(0);

require_once __DIR__ . '/core-catalogo.php';

// Pestaña Modificadores: cuelgan de un grupo; los de un grupo plantilla son de solo lectura.
class ctrl extends core {

    // Opciones del filtro: todos los grupos que la empresa ve.
    public function init() {
        $fail = $this->needCompany();
        if ($fail) return array_merge($fail, ['groups' => []]);

        return ['status' => 200, 'groups' => $this->qModifierGroupOptions($this->companyId())];
    }

    // Opciones del modal: solo grupos propios. keep_id conserva el actual aunque esté inactivo.
    public function formOptions() {
        $fail = $this->needCompany();
        if ($fail) return array_merge($fail, ['groups' => []]);

        return [
            'status' => 200,
            'groups' => $this->qModifierGroupOptions($this->companyId(), true, $this->postId('keep_id'))
        ];
    }

    public function lsModifiers() {
        $fail = $this->needCompany();
        if ($fail) return $fail;

        $company = $this->companyId();
        $group   = $this->selectOrNull('modifier_group_id');
        $row     = [];

        foreach ($this->qListModifiers($company, $this->activeFilter(), $group) as $item) {
            $id     = (int) $item['id'];
            $locked = $item['group_company_id'] === null;

            $row[] = [
                'id'           => $id,
                'Modificador'  => cellTitle($item['name'], $item['description']),
                'Grupo'        => $this->groupCell($item),
                'Precio extra' => moneyCell($item['price']),
                'Cantidad'     => $this->quantityCell($item['quantity']),
                'Estado'       => renderActive($item['active']),
                'a'            => $this->rowActions('modifiers', $id, $item['active'], $locked)
            ];
        }

        return ['status' => 200, 'row' => $row, 'count' => $this->qCountModifiers($company)];
    }

    public function getModifier() {
        $data = $this->qGetModifier($this->postId(), $this->companyId());

        return $data ? ['status' => 200, 'data' => $data] : $this->fail(404, 'El modificador no existe.');
    }

    public function addModifier() {
        $fail = $this->needCompany();
        if ($fail) return $fail;

        $in = $this->modifierInput();
        if (isset($in['status'])) return $in;

        $dup = $this->qFindModifierByName($in['group_id'], $in['name']);
        if ($dup) return $this->duplicated($dup, 'un modificador con ese nombre en el grupo');

        return $this->attempt(function () use ($in) {
            $this->must($this->qCreateModifier([
                'values' => ['name', 'description', 'price', 'quantity', 'modifier_group_id', 'active'],
                'data'   => [$in['name'], $in['description'], $in['price'], $in['quantity'], $in['group_id'], 1]
            ]), 'addModifier');

            return $this->ok('Modificador creado.');
        }, 'No se pudo guardar el modificador.');
    }

    public function editModifier() {
        $fail = $this->needCompany();
        if ($fail) return $fail;

        $id      = $this->postId();
        $current = $this->qGetModifier($id, $this->companyId());

        if (!$current) return $this->fail(404, 'El modificador no existe.');
        if ($current['group_company_id'] === null) return $this->lockedTemplate();

        $in = $this->modifierInput((int) $current['modifier_group_id']);
        if (isset($in['status'])) return $in;

        $dup = $this->qFindModifierByName($in['group_id'], $in['name'], $id);
        if ($dup) return $this->duplicated($dup, 'un modificador con ese nombre en el grupo');

        return $this->attempt(function () use ($in, $id) {
            $this->must($this->qUpdateModifier([
                'values' => ['modifier_group_id', 'name', 'description', 'price', 'quantity', 'updated_at = NOW()'],
                'where'  => ['id'],
                'data'   => [$in['group_id'], $in['name'], $in['description'], $in['price'], $in['quantity'], $id]
            ]), 'editModifier');

            return $this->ok('Modificador actualizado.');
        }, 'No se pudo guardar el modificador.');
    }

    public function statusModifier() {
        $fail = $this->needCompany();
        if ($fail) return $fail;

        $id      = $this->postId();
        $current = $this->qGetModifier($id, $this->companyId());

        if (!$current) return $this->fail(404, 'El modificador no existe.');
        if ($current['group_company_id'] === null) return $this->lockedTemplate();

        $active = $this->flag('active');

        return $this->attempt(function () use ($active, $id) {
            $this->must($this->qUpdateModifier([
                'values' => ['active', 'updated_at = NOW()'],
                'where'  => ['id'],
                'data'   => [$active, $id]
            ]), 'statusModifier');

            return $this->ok($active === 1 ? 'Modificador activado.' : 'Modificador desactivado.');
        }, 'No se pudo cambiar el estado del modificador.');
    }

    // -- Auxiliares --

    // Devuelve los campos listos o una respuesta de error (trae 'status').
    // $currentGroup: el grupo que ya tenía al editar; ese se acepta aunque esté inactivo.
    private function modifierInput($currentGroup = 0) {
        $groupId     = $this->selectOrNull('modifier_group_id');
        $name        = $this->post('name');
        $description = $this->textOrNull('description');
        $price       = $this->amount('price', 0);
        $quantity    = $this->amount('quantity', 0, 3);

        if ($groupId === null)                 return $this->fail(400, 'Elige el grupo del modificador.');
        if ($name === '')                      return $this->fail(400, 'Escribe el nombre del modificador.');
        if ($this->tooLong($name, 255))        return $this->fail(400, 'El nombre admite hasta 255 caracteres.');
        if ($this->tooLong($description, 255)) return $this->fail(400, 'La descripción admite hasta 255 caracteres.');
        if ($price === null)                   return $this->fail(400, 'El precio extra debe ser un número mayor o igual a 0.');
        if ($quantity === null)                return $this->fail(400, 'La cantidad debe ser un número mayor o igual a 0.');

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
            'price'       => $price,
            'quantity'    => $quantity
        ];
    }

    private function groupCell($item) {
        $html = h($item['group_name']);

        return (int) $item['group_active'] === 0 ? $html . ' ' . chip('Inactivo', 'red') : $html;
    }

    // Hasta 3 decimales, sin ceros de relleno: 1.500 -> 1.5; 2.000 -> 2.
    private function quantityCell($value) {
        return rtrim(rtrim(number_format((float) $value, 3, '.', ','), '0'), '.');
    }
}

Permission::dispatch(new ctrl(), 'catalogo');
