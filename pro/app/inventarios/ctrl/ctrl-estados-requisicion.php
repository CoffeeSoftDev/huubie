<?php
require_once __DIR__ . '/../../../core/security/_Session.php';
if (empty($_POST['opc'])) exit(0);

require_once __DIR__ . '/core-catalogo.php';

/*  Pestaña Estados de requisición del Catálogo de insumos (requisition_status):
    los usa el flujo de Requisiciones y Surtir. Como en inventory, no se
    agregan, no se dan de baja y el nombre no cambia: solo su ícono y su color
    (los de la insignia en la lista, el visor y la leyenda). Sin color = el
    del tema. */
class ctrl extends coreCatalogo {

    // Columnas: Estado, Orden, Final, Código.
    public function lsEstadosReq() {
        $fail = $this->needShow();
        if ($fail) return $fail;

        $row = array_map(function ($s) {
            $id = (int) $s['id'];

            return [
                'id'     => $id,
                'Estado' => $this->badge($s['name'], $s['color_hex'] ?: '#C05A40', null, $s['icon']),
                'Orden'  => (int) $s['order_index'],
                'Final'  => $this->yesNo($s['is_terminal']),
                'Código' => $this->codeCell($s['code']),
                'a'      => $this->rowActions('estadosReq', $id, 1, false)
            ];
        }, $this->qCatalogRows('requisition_status', $this->companyId(), 1, 'order_index, id'));

        return $this->listed('estadosReq', $row);
    }

    public function getEstadoReq() {
        $fail = $this->needSave(1);
        if ($fail) return $fail;

        $s = $this->qCatalogRow('requisition_status', $this->postId(), $this->companyId());

        return $s ? ['status' => 200, 'data' => $s] : $this->fail(404, 'Ese estado ya no existe.');
    }

    public function editEstadoReq() {
        $fail = $this->needSave(1);
        if ($fail) return $fail;

        $id = $this->postId();
        if (!$this->qCatalogRow('requisition_status', $id, $this->companyId())) return $this->fail(404, 'Ese estado ya no existe.');

        // Color vacío = el del tema (así nace «Entregado»).
        $color = $this->post('color_hex') === '' ? null : $this->color('color_hex', null);

        return $this->attempt(function () use ($id, $color) {
            $this->must($this->qCatalogUpdate('requisition_status', ['icon', 'color_hex'], [$this->icon(), $color, $id]), 'editEstadoReq');

            return $this->ok('Cambios guardados.');
        }, 'No se pudo guardar el estado.');
    }
}

Permission::dispatch(new ctrl(), 'inv-catalogo');
