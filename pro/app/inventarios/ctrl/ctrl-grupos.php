<?php
require_once __DIR__ . '/../../../core/security/_Session.php';
if (empty($_POST['opc'])) exit(0);

require_once __DIR__ . '/core-catalogo.php';

/*  Pestaña Grupos del Catálogo de insumos (supply_group): Harinas, Lácteos,
    Empaques. Son de la empresa y no son las categorías de venta, como los
    «Grupos de insumos» de Soft Restaurant. */
class ctrl extends coreCatalogo {

    // Columnas: Grupo, Descripción, Insumos, Estado.
    public function lsGrupos() {
        $fail = $this->needShow();
        if ($fail) return $fail;

        $row = array_map(function ($g) {
            $id = (int) $g['id'];

            return [
                'id'          => $id,
                'Grupo'       => $this->badge($g['name'], $g['color_hex'] ?: '#64748B'),
                'Descripción' => $this->shortText($g['description']),
                'Insumos'     => (int) $g['supplies'] > 0 ? (int) $g['supplies'] : $this->dash(),
                'Estado'      => $this->activeCell($g['active']),
                'a'           => $this->rowActions('grupos', $id, $g['active'])
            ];
        }, $this->qGroupRows($this->companyId(), $this->activeFilter()));

        return $this->listed('grupos', $row);
    }

    public function getGrupo() {
        $fail = $this->needSave(1);
        if ($fail) return $fail;

        $g = $this->qCatalogRow('supply_group', $this->postId(), $this->companyId());

        return $g ? ['status' => 200, 'data' => $g] : $this->fail(404, 'Ese grupo ya no existe.');
    }

    public function addGrupo() {
        $fail = $this->needSave(0);
        if ($fail) return $fail;

        $in = $this->groupInput(0);
        if (isset($in['status'])) return $in;

        return $this->attempt(function () use ($in) {
            $this->must($this->qCatalogInsert('supply_group',
                ['name', 'description', 'color_hex', 'sort_order', 'company_id', 'active'],
                [$in['name'], $in['description'], $in['color_hex'], $this->qMaxSort('supply_group', $this->companyId()) + 1, $this->companyId(), 1]
            ), 'addGrupo');

            return $this->ok('Grupo agregado.');
        }, 'No se pudo guardar el grupo.');
    }

    public function editGrupo() {
        $fail = $this->needSave(1);
        if ($fail) return $fail;

        $id = $this->postId();
        if (!$this->qCatalogRow('supply_group', $id, $this->companyId())) return $this->fail(404, 'Ese grupo ya no existe.');

        $in = $this->groupInput($id);
        if (isset($in['status'])) return $in;

        return $this->attempt(function () use ($in, $id) {
            $this->must($this->qCatalogUpdate('supply_group', ['name', 'description', 'color_hex'], [$in['name'], $in['description'], $in['color_hex'], $id]), 'editGrupo');

            return $this->ok('Cambios guardados.');
        }, 'No se pudo guardar el grupo.');
    }

    // Dado de baja deja de ofrecerse en la ficha; sus insumos lo conservan.
    public function statusGrupo() {
        $fail = $this->needStatus();
        if ($fail) return $fail;

        $g      = $this->qCatalogRow('supply_group', $this->postId(), $this->companyId());
        $active = $this->flag('active');

        if (!$g) return $this->fail(404, 'Ese grupo ya no existe.');

        return $this->attempt(function () use ($g, $active) {
            $this->must($this->qCatalogUpdate('supply_group', ['active'], [$active, (int) $g['id']]), 'statusGrupo');

            return $this->ok($active === 1 ? 'Grupo activado.' : 'Grupo dado de baja. Lo reactivas desde «Inactivos».');
        }, 'No se pudo cambiar el grupo.');
    }

    private function groupInput($exceptId) {
        $name = $this->requiredText('name', 'el nombre del grupo', 120);
        if (is_array($name)) return $name;

        if ($this->qCatalogTaken('supply_group', 'name', $name, $this->companyId(), $exceptId)) return $this->fail(409, 'Ya hay un grupo con ese nombre.');

        return [
            'name'        => $name,
            'description' => $this->textOrNull('description', 255),
            'color_hex'   => $this->color('color_hex', '#64748B')
        ];
    }
}

Permission::dispatch(new ctrl(), 'inv-catalogo');
