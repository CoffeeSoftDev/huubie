# CoffeeSoft como aplicación instalable (PWA)

`coffee/app/` es instalable como app de escritorio/móvil. Un único partial,
[partials/pwa-head.php](partials/pwa-head.php), se incluye en el `<head>` del login
y de todas las páginas del visor, así que ninguna página necesita JS propio.

## Archivos

| Archivo | Para qué sirve |
|---|---|
| `manifest.json` | Identidad: nombre, iconos, colores, `start_url: visor/index.php`, accesos directos (CoffeeDocs, Playground, Forge, Studio). |
| `sw.js` | Service Worker. Alcance `coffee/app/`, o sea login + visor. |
| `offline.html` | Lo que se ve sin red (estilos inline, no depende de nada). |
| `partials/pwa-head.php` | Etiquetas del `<head>`. Calcula solo la ruta base, funcione desde `app/` o desde `app/visor/`. |
| `src/js/pwa.js` | Registra el SW, botón *Instalar app*, aviso de versión nueva, `theme-color` según el tema. |
| `src/css/pwa.css` | Estilos del botón y del aviso, con los tokens `--vsr-*`. |
| `src/img/pwa/*.png` | Iconos 96/192/512, maskable y apple-touch: el grano de `visor/brand-mark.php` en blanco sobre terracota. |

### Regenerar los iconos

`src/img/pwa/_icon-template.html` es la fuente (512 px). Se captura con Chrome:

```
chrome --headless=new --hide-scrollbars --default-background-color=00000000 \
       --window-size=512,512 --screenshot=icon-512.png _icon-template.html
```

Cambiando `--window-size` y el `width/height` del CSS se sacan los demás tamaños
(los maskable van sin `border-radius` y con el grano al 46 % para respetar la zona
segura). Chrome no captura ventanas de 96 px: ese tamaño se reduce desde el de 512.

## Qué cachea el Service Worker

Es una **lista blanca**, porque en esta app casi todo el contenido es vivo:

- Sólo se cachean assets bajo `/src/` (css, js, img, fuentes) sin `?t=`, y los CDNs
  conocidos (jQuery, tailwind, lucide, jsdelivr, cdnjs, sheetjs, fuentes Google).
- PHP, `/ctrl/`, `documents/`, `data/`, `uploads/`, `prototipo/`, `template/` y los
  previews del forge → siempre a la red, sin interceptar.
- Navegación → red primero; si falla, `offline.html`.

Al cambiar `sw.js` hay que subir la constante `VERSION`: invalida las cachés viejas
y dispara el aviso *"Hay una versión nueva"* en las pestañas abiertas.

## Cómo probarlo en local

Los Service Workers exigen **secure context**, así que hay que entrar por localhost
(o HTTPS en producción):

```
http://localhost/huubie/coffee/app/index.php
```

DevTools → *Application* → *Manifest* / *Service Workers*. El botón *Instalar app*
se ancla al lado del botón de tema (`.theme-toggle`) de cada página; también se
lanza a mano con `pwaInstall()` desde la consola. Si se descarta, no vuelve a
aparecer en 7 días (`localStorage['pwa-install-dismissed']`).
