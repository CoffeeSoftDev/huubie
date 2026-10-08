# Login premium · Coffee Inventory

Tres maquetas en la línea del software premium actual (Linear, Vercel, Stripe, Raycast):
minimalistas, tipografía Geist, sombras en capas, textura de grano, relieves sutiles y
entrada escalonada (fade + blur). Son **autocontenidas**: el logo y los íconos van
incrustados como SVG, así que abren solas en cualquier navegador.

| Archivo | Idea |
|---|---|
| `premium-1-obsidiana.html` | Oscuro, sin tarjeta. Ícono de app con relieve y brillo cálido de marca, campos translúcidos, botón claro con relieve. |
| `premium-2-porcelana.html` | Claro. Una tarjeta con sombras en capas y borde degradado, botón negro con relieve y pie de tarjeta. **Aplicada** en `inventory/index.php` y `recuperar.php`. |
| `premium-3-producto.html` | Pantalla dividida: formulario mínimo + panel oscuro con una vista del sistema (cifras ilustrativas). En móvil solo el formulario. |

- `?recordado=1` muestra el estado de usuario recordado.
- Las tres conservan los `id` que usa `acceso/src/js/index.js`; se integran cambiando
  `index.php` + `src/css/index.css`. En producción los íconos vuelven a ser `<i data-lucide>`.
- El checkbox es propio (sin el del navegador) y las animaciones respetan
  `prefers-reduced-motion`.
- Para regenerar los SVG incrustados se usaron marcadores `{{logo}}` / `{{i:nombre}}`
  reemplazados con los íconos de `src/plugin/lucide/lucide.min.js`.

Capturas en `capturas/` (`premium.png` es la vista general).

## Porcelana en producción

- `inventory/index.php` y `inventory/recuperar.php`: marcado nuevo con los mismos `id`.
- `inventory/src/css/index.css`: reescrito con los tokens de Porcelana (lo comparten las dos páginas).
- `inventory/acceso/src/js/index.js`: estado de carga del botón (`.loading` + `disabled`, se
  libera con `ajaxError` porque `send_ajax` no rechaza la promesa) y aviso de Bloq Mayús.
- Capturas reales en `capturas/produccion-login.png` y `capturas/produccion-recuperar.png`.

