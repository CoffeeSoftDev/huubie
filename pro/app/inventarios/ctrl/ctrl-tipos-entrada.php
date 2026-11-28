<?php
require_once __DIR__ . '/../../../core/security/_Session.php';
if (empty($_POST['opc'])) exit(0);

require_once __DIR__ . '/core-catalogo.php';

/*  Pestaña Tipos de entrada del Catálogo de insumos (inflow_origin): de dónde
    llega la mercancía. Los de «Sistema» los usa el flujo (Producción, Surtido
    de la Matriz...): solo cambian su nombre, descripción, ícono y color, y no
    se dan de baja. */
class ctrl extends coreCatalogo {

    // Columnas: Tipo, Código, Pide proveedor, Nace pendiente, Actualiza costo, Estado.
    public function lsTipos() {
        $fail = $this->needShow();
        if ($fail) return $fail;

        $row = array_map(function ($o) {
            $id     = (int) $o['id'];
            $system = (int) $o['is_system'] === 1;

            return [
                'id'              => $id,
                'Tipo'            => $this->badge($o['name'], $o['color_hex'], null, $o['icon']),
                'Código'          => $this->codeCell($o['code']),
                'Pide proveedor'  => $this->yesNo($o['requires_supplier']),
                'Nace pendiente'  => $this->yesNo($o['starts_pending']),
                'Actualiza costo' => $this->yesNo($o['updates_cost']),
                'Estado'          => $system ? $this->systemCell() : $this->activeCell($o['active']),
                'a'               => $this->rowActions('tiposEntrada', $id, $o['active'], !$system)
            ];
        }, $this->qCatalogRows('inflow_origin', $this->companyId(), $this->activeFilter()));

        return $this->listed('tiposEntrada', $row);
    }

    public function getTipo() {
        $fail = $this->needSave(1);
        if ($fail) return $fail;

        $o = $this->qCatalogRow('inflow_origin', $this->postId(), $this->companyId());

        return $o ? ['status' => 200, 'data' => $o] : $this->fail(404, 'Ese tipo de entrada ya no existe.');
    }

    public function addTipo() {
        $fail = $this->needSave(0);
        if ($fail) return $fail;

        $in = $this->originInput(null);
        if (isset($in['status'])) return $in;

        $in += [
            'code'       => $this->codeFrom('inflow_origin', $in['name']),
            'is_system'  => 0,
            'sort_order' => $this->qMaxSort('inflow_origin', $this->companyId()) + 1,
            'company_id' => $this->companyId(),
            'active'     => 1
        ];

        return $this->attempt(function () use ($in) {
            $this->must($this->qCatalogInsert('inflow_origin', array_keys($in), array_values($in)), 'addTipo');

            return $this->ok('Tipo de entrada agregado.');
        }, 'No se pudo guardar el tipo de entrada.');
    }

    public function editTipo() {
        $fail = $this->needSave(1);
        if ($fail) return $fail;

        $id = $this->postId();
        $o  = $this->qCatalogRow('inflow_origin', $id, $this->companyId());

        if (!$o) return $this->fail(404, 'Ese tipo de entrada ya no existe.');

        $in = $this->originInput($o);
        if (isset($in['status'])) return $in;

        return $this->attempt(function () use ($in, $id) {
            $this->must($this->qCatalogUpdate('inflow_origin', array_keys($in), array_merge(array_values($in), [$id])), 'editTipo');

            return $this->ok('Cambios guardados.');
        }, 'No se pudo guardar el tipo de entrada.');
    }

    public function statusTipo() {
        $fail = $this->needStatus();
        if ($fail) return $fail;

        $o      = $this->qCatalogRow('inflow_origin', $this->postId(), $this->companyId());
        $active = $this->flag('active');

        if (!$o) return $this->fail(404, 'Ese tipo de entrada ya no existe.');
        if ((int) $o['is_system'] === 1) return $this->fail(409, 'Lo usa el sistema: no se da de baja.');

        return $this->attempt(function () use ($o, $active) {
            $this->must($this->qCatalogUpdate('inflow_origin', ['active'], [$active, (int) $o['id']]), 'statusTipo');

            return $this->ok($active === 1 ? 'Tipo de entrada activado.' : 'Tipo de entrada dado de baja. Lo reactivas desde «Inactivos».');
        }, 'No se pudo cambiar el tipo de entrada.');
    }

    // Uno del sistema solo cambia nombre, descripción, ícono y color.
    private function originInput($row) {
        $name = $this->requiredText('name', 'el nombre del tipo de entrada', 120);
        if (is_array($name)) return $name;

        if ($this->qCatalogTaken('inflow_origin', 'name', $name, $this->companyId(), (int) ($row['id'] ?? 0))) return $this->fail(409, 'Ya hay un tipo de entrada con ese nombre.');

        $in = [
            'name'        => $name,
            'description' => $this->textOrNull('description', 255),
            'icon'        => $this->icon(),
            'color_hex'   => $this->color('color_hex', '#4B5563')
        ];

        if (!$row || (int) $row['is_system'] === 0) {
            $in += [
                'requires_supplier' => $this->flag('requires_supplier'),
                'starts_pending'    => $this->flag('starts_pending'),
                'updates_cost'      => $this->flag('updates_cost')
            ];
        }

        return $in;
    }
}

Permission::dispatch(new ctrl(), 'inv-catalogo');
