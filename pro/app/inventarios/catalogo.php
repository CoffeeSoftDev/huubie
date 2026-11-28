<?php
require_once __DIR__ . '/../../core/security/_Permission.php';

// Sin sesion al login; sin la seccion 'inv-catalogo', a su inicio.
Permission::page('inv-catalogo', '../../');

/*  Catálogo de insumos: el mismo estilo que el Catálogo de venta (su hoja, su
    #main__content y su campo de foto). Una clase por pestaña en
    src/js/catalogo/ y al final catalogo.js, que las instancia. La ficha de
    inventario de los productos es la misma de Stock (components/ficha-inventario). */
$title         = 'Catálogo de insumos';
$script        = 'catalogo';
$proComponents = ['cs-icons', 'cs-icon-picker'];
$components    = ['ficha-inventario'];
$pageCss       = ['app/catalogo/src/css/catalogo.css'];
$pageJs        = ['app/catalogo/src/js/foto-producto.js'];
$pageClass     = 'cp-pagina-pro';
$tabs          = array_map(function ($name) { return 'catalogo/' . $name; }, [
    'productos', 'insumos', 'grupos', 'unidades', 'almacenes', 'areas', 'proveedores', 'tipos-entrada', 'motivos-salida', 'estados-traspaso',
    'estados-requisicion', 'departamentos'
]);

require __DIR__ . '/layout/head.php';
require __DIR__ . '/layout/scripts.php';
