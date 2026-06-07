# UI Kit del rail `#menu-sidebar` — Almacén

Referencia visual de la paleta y los estados del rail re-tematizado del módulo Almacén.

## Qué demuestra
- Paleta completa del rail en light y dark (terracota, fondos, bordes, iconos, hover, activo).
- Los 3 estados (idle / hover / activo) de los 6 botones del menú.
- Mockup del rail real (mismo HTML que produce `sidebar.js`, mismo CSS que `almacen-sidebar.css`).
- Cómo el CSS reinterpreta la clase `bg-[#C05A40]` que aplica el JS al pasar por `almacen-sidebar.css`.

## Cómo abrirlo
- Doble clic sobre `sidebar-uikit.html` (no requiere servidor, los CSS se cargan relativos).
- O vía: `http://localhost/huubie/inventory/operacion/almacen/uikit/sidebar-uikit.html`.

## Fuente de verdad
Linka (no duplica):
- `inventory/src/css/general.css`
- `inventory/src/css/colors.css`
- `inventory/src/css/dark-mode.css`
- `inventory/operacion/almacen/css/almacen-sidebar.css`

Si cambia un hex en esos archivos, revisar este UI kit y actualizar los swatches.

## Cómo verificarlo
Comparar visualmente con el rail real en cualquier `*.php` del módulo Almacén:
`http://localhost/huubie/inventory/operacion/almacen/almacen.php` (toggle en navbar).

## No va al grimorio de `app/ui/`
Es referencia local del módulo, no del sistema de diseño Huubie (decisión del 2026-06-06).
