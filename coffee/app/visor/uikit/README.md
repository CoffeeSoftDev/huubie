# UI Kit del Visor de Agentes — Sidebar & Header

Referencia visual de los tokens `--vsr-*` y los estados del sidebar (320 → 56) y el
header (60px) del Visor de Agentes.

## Qué demuestra
- Paleta completa de tokens del Visor en dark y light (terracota, fondos, texto, bordes, file-icons, badges).
- Los 3 estados (idle / hover / active) del `.sidebar-item`.
- Mockup 1:1 del header y del sidebar reales, linkando `visor.css` y `ui-kit.css` (incluye colapso del sidebar a 56px).
- Cómo el CSS pinta el item activo con `border-left` acento + degradado tenue.

## Cómo abrirlo
- Doble clic sobre `visor-uikit.html` (los CSS se cargan relativos, no requiere servidor).
- O vía: `http://localhost/huubie/coffee/app/visor/uikit/visor-uikit.html`.

## Fuente de verdad
Linka (no duplica):
- `coffee/app/visor/src/css/ui-kit.css`
- `coffee/app/visor/src/css/visor.css`

Si cambia un token en `visor.css`, revisar este UI kit y actualizar los swatches.

## Cómo verificarlo
Comparar visualmente con el Visor real:
- `http://localhost/huubie/coffee/app/visor/visor-index.html` (standalone)
- `http://localhost/huubie/coffee/app/visor/index.php` (PHP)
- Toggle de tema en ambos coincide: el del UI kit usa `[data-theme]` igual que el real.

## Diferencias con el UI kit del rail de Almacén
- Mecanismo de tema: `[data-theme]` en `<html>` (no `body.dark-mode`).
- Alcance: sidebar (320→56) + header (no solo rail 80px).
- Convenciones del Visor: items con nombre+icono+tamaño, file-icon por formato, pin de contexto, badge-* semánticos.
