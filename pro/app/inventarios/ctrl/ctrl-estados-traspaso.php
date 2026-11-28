<?php
require_once __DIR__ . '/../../../core/security/_Session.php';
if (empty($_POST['opc'])) exit(0);

require_once __DIR__ . '/core-catalogo.php';

/*  Pestaña Estados del Catálogo de insumos (transfer_status): los usa el flujo
    del traspaso. No se agregan ni se dan de baja: se cambia cómo se llaman
    (para quien envía y para quien recibe) y su color. */
class ctrl extends coreCatalogo {

    // Columnas: Estado, Lo ve quien envía, Lo ve quien recibe, Código.
    public function lsEstados() {
        $fail = $this->needShow();
        if ($fail) return $fail;

        $row = array_map(function ($s) {
            $id = (int) $s['id'];

            return [
                'id'                 => $id,
                'Estado'             => $this->badge($s['name'], $s['color_hex'], null, $s['icon']),
                'Lo ve quien envía'  => $this->badge($s['name_out'] ?: $s['name'], $s['color_hex']),
                'Lo ve quien recibe' => $this->badge($s['name_in'] ?: $s['name'], $s['color_hex']),
                'Código'             => $this->codeCell($s['code']),
                'a'                  => $this->rowActions('estados', $id, 1, false)
            ];
        }, $this->qCatalogRows('transfer_status', $this->companyId(), 1, 'order_index, id'));

        return $this->listed('estados', $row);
    }

    public function getEstado() {
        $fail = $this->needSave(1);
        if ($fail) return $fail;

        $s = $this->qCatalogRow('transfer_status', $this->postId(), $this->companyId());

        return $s ? ['status' => 200, 'data' => $s] : $this->fail(404, 'Ese estado ya no existe.');
    }

    public function editEstado() {
        $fail = $this->needSave(1);
        if ($fail) return $fail;

        $id = $this->postId();
        if (!$this->qCatalogRow('transfer_status', $id, $this->companyId())) return $this->fail(404, 'Ese estado ya no existe.');

        $name = $this->requiredText('name', 'el nombre del estado', 80);
        if (is_array($name)) return $name;

        $in = [
            'name'      => $name,
            'name_out'  => $this->textOrNull('name_out', 50),
            'name_in'   => $this->textOrNull('name_in', 50),
            'color_hex' => $this->color('color_hex', '#4B5563')
        ];

        return $this->attempt(function () use ($in, $id) {
            $this->must($this->qCatalogUpdate('transfer_status', array_keys($in), array_merge(array_values($in), [$id])), 'editEstado');

            return $this->ok('Cambios guardados.');
        }, 'No se pudo guardar el estado.');
    }
}

Permission::dispatch(new ctrl(), 'inv-catalogo');
