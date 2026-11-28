<?php
require_once __DIR__ . '/../../../core/security/_Session.php';
if (empty($_POST['opc'])) exit(0);

require_once __DIR__ . '/core-catalogo.php';

/*  Arranque del Catálogo de insumos: empresa y sucursal, los contadores de
    las pestañas, el filtro de estado y las casillas del rol. Cada pestaña
    tiene su ctrl (ctrl-productos, ctrl-insumos, ctrl-grupos, ctrl-unidades,
    ctrl-almacenes, ctrl-areas, ctrl-proveedores, ctrl-tipos-entrada,
    ctrl-motivos-salida, ctrl-estados-traspaso, ctrl-estados-requisicion,
    ctrl-departamentos), como el Catálogo de venta. */
class ctrl extends coreCatalogo {

    const TABS = ['productos', 'insumos', 'grupos', 'unidades', 'almacenes', 'areas', 'proveedores', 'tiposEntrada', 'motivosSalida', 'estados', 'estadosReq', 'departamentos'];

    public function init() {
        $fail = $this->needShow();
        if ($fail) return $fail;

        $counts = [];
        foreach (self::TABS as $tab) $counts[$tab] = $this->countOf($tab);

        return $this->baseInit([
            'counts'       => $counts,
            'statusFilter' => [
                ['id' => '1', 'valor' => 'Activos'],
                ['id' => '0', 'valor' => 'Inactivos']
            ],
            'is_admin'     => $this->isAdmin()
        ]);
    }
}

Permission::dispatch(new ctrl(), 'inv-catalogo');
