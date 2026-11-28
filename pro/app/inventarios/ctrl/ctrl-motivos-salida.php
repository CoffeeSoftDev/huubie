<?php
require_once __DIR__ . '/../../../core/security/_Session.php';
if (empty($_POST['opc'])) exit(0);

require_once __DIR__ . '/core-catalogo.php';

/*  Pestaña Motivos de salida del Catálogo de insumos (outflow_reason): por qué
    sale la mercancía. «Es merma» la cuenta como pérdida; «Pide foto» no deja
    guardar la salida sin evidencia. Los de «Sistema» (Venta, Consumo de
    producción...) solo cambian nombre, descripción, ícono y color. */
class ctrl extends coreCatalogo {

    // Columnas: Motivo, Código, Es merma, Pide foto, Estado.
    public function lsMotivos() {
        $fail = $this->needShow();
        if ($fail) return $fail;

        $row = array_map(function ($r) {
            $id     = (int) $r['id'];
            $system = (int) $r['is_system'] === 1;

            return [
                'id'        => $id,
                'Motivo'    => $this->badge($r['name'], $r['color_hex'], null, $r['icon']),
                'Código'    => $this->codeCell($r['code']),
                'Es merma'  => $this->yesNo($r['is_loss']),
                'Pide foto' => $this->yesNo($r['requires_evidence']),
                'Estado'    => $system ? $this->systemCell() : $this->activeCell($r['active']),
                'a'         => $this->rowActions('motivosSalida', $id, $r['active'], !$system)
            ];
        }, $this->qCatalogRows('outflow_reason', $this->companyId(), $this->activeFilter()));

        return $this->listed('motivosSalida', $row);
    }

    public function getMotivo() {
        $fail = $this->needSave(1);
        if ($fail) return $fail;

        $r = $this->qCatalogRow('outflow_reason', $this->postId(), $this->companyId());

        return $r ? ['status' => 200, 'data' => $r] : $this->fail(404, 'Ese motivo ya no existe.');
    }

    public function addMotivo() {
        $fail = $this->needSave(0);
        if ($fail) return $fail;

        $in = $this->reasonInput(null);
        if (isset($in['status'])) return $in;

        $in += [
            'code'                => $this->codeFrom('outflow_reason', $in['name']),
            'is_system'           => 0,
            'requires_department' => 0,
            'sort_order'          => $this->qMaxSort('outflow_reason', $this->companyId()) + 1,
            'company_id'          => $this->companyId(),
            'active'              => 1
        ];

        return $this->attempt(function () use ($in) {
            $this->must($this->qCatalogInsert('outflow_reason', array_keys($in), array_values($in)), 'addMotivo');

            return $this->ok('Motivo agregado.');
        }, 'No se pudo guardar el motivo.');
    }

    public function editMotivo() {
        $fail = $this->needSave(1);
        if ($fail) return $fail;

        $id = $this->postId();
        $r  = $this->qCatalogRow('outflow_reason', $id, $this->companyId());

        if (!$r) return $this->fail(404, 'Ese motivo ya no existe.');

        $in = $this->reasonInput($r);
        if (isset($in['status'])) return $in;

        return $this->attempt(function () use ($in, $id) {
            $this->must($this->qCatalogUpdate('outflow_reason', array_keys($in), array_merge(array_values($in), [$id])), 'editMotivo');

            return $this->ok('Cambios guardados.');
        }, 'No se pudo guardar el motivo.');
    }

    public function statusMotivo() {
        $fail = $this->needStatus();
        if ($fail) return $fail;

        $r      = $this->qCatalogRow('outflow_reason', $this->postId(), $this->companyId());
        $active = $this->flag('active');

        if (!$r) return $this->fail(404, 'Ese motivo ya no existe.');
        if ((int) $r['is_system'] === 1) return $this->fail(409, 'Lo usa el sistema: no se da de baja.');

        return $this->attempt(function () use ($r, $active) {
            $this->must($this->qCatalogUpdate('outflow_reason', ['active'], [$active, (int) $r['id']]), 'statusMotivo');

            return $this->ok($active === 1 ? 'Motivo activado.' : 'Motivo dado de baja. Lo reactivas desde «Inactivos».');
        }, 'No se pudo cambiar el motivo.');
    }

    // Uno del sistema solo cambia nombre, descripción, ícono y color.
    private function reasonInput($row) {
        $name = $this->requiredText('name', 'el nombre del motivo', 120);
        if (is_array($name)) return $name;

        if ($this->qCatalogTaken('outflow_reason', 'name', $name, $this->companyId(), (int) ($row['id'] ?? 0))) return $this->fail(409, 'Ya hay un motivo con ese nombre.');

        $in = [
            'name'        => $name,
            'description' => $this->textOrNull('description', 255),
            'icon'        => $this->icon(),
            'color_hex'   => $this->color('color_hex', '#E11D48')
        ];

        if (!$row || (int) $row['is_system'] === 0) {
            $in += ['is_loss' => $this->flag('is_loss'), 'requires_evidence' => $this->flag('requires_evidence')];
        }

        return $in;
    }
}

Permission::dispatch(new ctrl(), 'inv-catalogo');
