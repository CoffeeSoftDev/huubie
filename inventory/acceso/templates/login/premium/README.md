# Login premium · Coffee Inventory

Tres maquetas en la línea del software premium actual (Linear, Vercel, Stripe, Raycast):
minimalistas, tipografía Geist, sombras en capas, textura de grano, relieves sutiles y
entrada escalonada (fade + blur). Son **autocontenidas**: el logo y los íconos van
incrustados como SVG, así que abren solas en cualquier navegador.

| Archivo | Idea |
|---|---|
| `premium-1-obsidiana.html` | Oscuro, sin tarjeta. Ícono de app con relieve y brillo cálido de marca, campos translúcidos, botón claro con relieve. |
| `premium-2-porcelana.html` | Claro. Una tarjeta con sombras en capas y borde degradado, botón negro con relieve y pie de tarjeta. |
| `premium-3-producto.html` | Pantalla dividida: formulario mínimo + panel oscuro con una vista del sistema (cifras ilustrativas). En móvil solo el formulario. |

- `?recordado=1` muestra el estado de usuario recordado.
- Las tres conservan los `id` que usa `acceso/src/js/index.js`; se integran cambiando
  `index.php` + `src/css/index.css`. En producción los íconos vuelven a ser `<i data-lucide>`.
- El checkbox es propio (sin el del navegador) y las animaciones respetan
  `prefers-reduced-motion`.
- Para regenerar los SVG incrustados se usaron marcadores `{{logo}}` / `{{i:nombre}}`
  reemplazados con los íconos de `src/plugin/lucide/lucide.min.js`.

Capturas en `capturas/` (`premium.png` es la vista general).
