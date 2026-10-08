# Propuestas de login · Coffee Inventory

Maquetas estáticas para rediseñar `inventory/index.php`. Abren solas en el navegador
(Inter de Google Fonts + `src/plugin/lucide`); el `<script>` de cada una es solo demo.

| Archivo | Idea | Cambia en producción |
|---|---|---|
| `login-a-split.html` | Pantalla dividida: marca + vista previa del almacén a la izquierda, formulario a la derecha. En móvil solo el formulario. | `index.php` + `src/css/index.css` |
| `login-b-cuentas.html` | Evolución del login actual para equipos compartidos: hasta 5 cuentas recordadas y entrada en dos pasos. | Además `acceso/src/js/index.js`: `REMEMBER_KEY` pasa a arreglo (`inventory:login:remember:v2`) |
| `login-c-midnight.html` | Dark Huubie tablet-first (campos de 56px, reloj, estado) con modo claro. | `index.php` + `src/css/index.css` |
| `login-d-macos.html` | Estilo Mac: pantalla de bloqueo con fondo de gradiente completo, barra de menú, reloj grande, avatar y campos tipo píldora. La píldora tiembla con clave incorrecta. | `index.php` + `src/css/index.css` |
| `login-e-ios.html` | Estilo iPhone: hoja de vidrio, ícono de app, campos agrupados como en Ajustes e interruptor iOS, sobre el halo del login actual. | `index.php` + `src/css/index.css` |
| `login-f-claude.html` | Estilo Claude: fondo marfil, titular con serifa, tarjeta suave, acento terracota y panel cálido con vista previa. Modo oscuro del sistema. | `index.php` + `src/css/index.css` |
| `login-g-chatgpt.html` | Estilo ChatGPT: blanco sin tarjeta, campos tipo píldora y entrada en dos pasos (correo → contraseña con "Editar"). Modo oscuro del sistema. | Además `index.js`: el primer "Continuar" sin usuario recordado pasa al paso 2 en vez de enviar (`data-step` en `#form_login`) |
| `login-h-corporativo.html` | **Profesional.** Azul marino + azul de confianza: panel con funciones clave del sistema y estantería en línea; formulario con etiquetas arriba y nota de seguridad. | `index.php` + `src/css/index.css` |
| `login-i-industrial.html` | **Profesional.** Grafito + ámbar de señalización de almacén: cuadrícula tenue, tarjeta con franja ámbar, datos en monoespaciada. | `index.php` + `src/css/index.css` |
| `login-j-tecnico.html` | **Profesional.** Blanco + negro sobre papel de plano, marcas de esquina, fecha y estado en monoespaciada, botón con pista ↵. | `index.php` + `src/css/index.css` (y el reloj, en `index.js`) |
| `login-k-empresarial.html` | **Profesional.** Gris pizarra + azul petróleo: tarjeta ancha con el formulario y los módulos reales del sistema (Stock, Entradas, Salidas, Traspasos, Compras, Reportes). | `index.php` + `src/css/index.css` |

D y E comparten 5 tonos de fondo (`data-tone` en `<html>`): **Atardecer**, **Aurora**,
**Cítrico**, **Champán** y **Terracota** (el `#C05A40` de la marca). El selector de tonos es solo de la maqueta (también `?tono=aurora`
en la URL); en producción se fija uno. `?recordado=1` muestra el estado de usuario recordado
y, en F y G, `?tema=dark` fuerza el modo oscuro.

A y C–K conservan todos los `id` que usa `acceso/src/js/index.js` (`#form_login`, `#usuario`,
`#clave`, `#btnEye`, `#rememberMe`, `#login-error`, `#login-error-text`, `#emailField`,
`#rememberedUser`, `#rememberedAvatar`, `#rememberedName`, `#rememberedEmail`,
`#forgetUserBtn`): se integran cambiando solo HTML y CSS (G suma el paso de correo en `index.js`). B mueve
el nombre al título (`Hola, María`), así que su integración incluye el cambio en `index.js`.

Todas suman: aviso de Bloq Mayús, estado de carga en el botón y año dinámico en el pie.
Eso (y los relojes de C y D) son unas líneas extra en `index.js`; el temblor de D y E con
clave incorrecta es solo CSS y se dispara con el `.is-invalid` que ya pone `showLoginError()`.

Capturas (escritorio 1440×900 + móvil 390×844) en `capturas/`.
