# Forge — Fábrica de Módulos

Guía de uso de **Forge**, la página que convierte una conversación con un agente
en archivos reales escritos a disco. Es una **copia aislada del Playground**: usa
los mismos agentes (`.md` de `~/.claude/agents`) y los mismos modelos
(**Ollama Cloud / OpenRouter**), pero añade la capacidad de **materializar** un
módulo multi-archivo en un proyecto.

> **No usa la cuenta de Claude (`claude.exe`).** Trabaja con los modelos que ya
> configuras en el selector (Ollama/OpenRouter), igual que el Playground.

---

## 1. Abrir Forge

1. Enciende **WAMP** (ícono de la bandeja → *Start All Services*).
2. Abre en el navegador:
   ```
   localhost/huubie/coffee/app/visor/forge.php
   ```
3. O navega desde el **rail** izquierdo de cualquier página del visor:
   **Visor · Lab · Forge (🔨) · Admin**.

---

## 2. La interfaz

```
┌──────────────────────────┬──────────────────────────────────────┐
│  CHAT (agente)           │  SANDBOX                              │
│                          │  [ Preview ] [ Código ] [ Módulo ② ]  │
│  · eliges agente,        │                                       │
│    modelo y tema arriba  │  Preview → renderiza HTML             │
│  · escribes la           │  Código  → fuente del render          │
│    instrucción           │  Módulo  → archivos generados +       │
│                          │            destino + acciones         │
└──────────────────────────┴──────────────────────────────────────┘
```

En la barra superior eliges:

| Control | Para qué |
|---|---|
| **Agente** | CoffeeIA (módulos de código), CoffeeMagic (UI HTML), CoffeeIntelligence (BD/markdown). |
| **Tema / sistema de diseño** | Huubie UI, CoffeeSoft Arcilla Invernal, Coffee-Varoch, Libre. Se inyecta el grimorio correspondiente. |
| **Conocimiento** | Edita el prompt del agente al vuelo y ancla grimorios extra como contexto. |
| **Modelo** | Ollama Cloud u OpenRouter (free/pago). |

La pestaña **Módulo** muestra un contador ② cuando el agente generó archivos.

---

## 3. El contrato `@file` (clave)

Para que Forge sepa qué escribir y dónde, el agente entrega **cada archivo en su
propio bloque cercado**, con la ruta relativa en la **primera línea**, marcada
con `@file:`:

````markdown
```php
// @file: ctrl/ctrl-productos.php
<?php
class CtrlProductos { /* ... */ }
```

```js
// @file: src/js/productos.js
const x = 1;
```

```css
/* @file: src/css/productos.css */
body { color: red; }
```
````

- El comentario es el **propio de cada lenguaje**: `//` (php/js/css), `#` (yaml),
  `<!-- -->` (html), `--` (sql).
- La ruta es **relativa a la raíz del proyecto destino**
  (ej. `alpha/pedidos/src/js/app.js`).
- Un archivo por bloque. No mezcles varios archivos en el mismo fence.

> Forge ya **inyecta esta instrucción** al agente cuando usas uno de código
> (CoffeeIA). Normalmente no tienes que pedírselo tú; pero si un modelo no la
> respeta, recuérdaselo: *"entrega cada archivo con su marcador `// @file:`"*.

---

## 4. Flujo paso a paso

1. **Pide el módulo** en el chat. Ej.:
   > *"Genera un CRUD de productos: controlador, modelo y JS frontend."*
2. El agente responde y Forge **detecta los archivos** → salta a la pestaña
   **Módulo**, que los lista. Haz clic en cualquiera para ver su contenido en
   la pestaña **Código**.
3. Elige el **Proyecto destino** en el selector (las subcarpetas de
   `c:\wamp64\www`, p.ej. `huubie`).
4. Pulsa **Previsualizar**. Se abre el diff:

   | Etiqueta | Significado |
   |---|---|
   | `NUEVO` | El archivo no existe → se creará. |
   | `SOBRESCRIBE` | Ya existe y cambia → reemplaza el actual. |
   | `SIN CAMBIOS` | Idéntico al de disco → no hace nada. |
   | `BLOQUEADO` | Ruta o extensión no permitida (no se escribirá). |

5. Revisa y pulsa **Materializar**. Forge escribe los archivos (creando las
   subcarpetas que falten) y confirma con un *toast*.

> **Nada se escribe hasta que confirmas en el diff.** Tanto "Previsualizar" como
> "Materializar" abren primero el modal de comparación.

---

## 5. Seguridad (sandbox)

El backend ([ctrl/ctrl-forge.php](ctrl/ctrl-forge.php)) sólo escribe si:

- El **proyecto destino** es una subcarpeta directa de `c:\wamp64\www`.
- La ruta del archivo cae **dentro** de esa raíz (sin `..`, sin rutas absolutas).
- La **extensión** está en la lista blanca: `php js mjs ts css scss less html htm
  vue astro md markdown json yml yaml xml sql txt csv svg`.

Cualquier archivo que no cumpla aparece como `BLOQUEADO` y se omite.

---

## 6. Diferencias con el Playground

| | Playground (Lab) | Forge |
|---|---|---|
| Genera maquetas HTML | ✔ | ✔ |
| Renderiza en iframe | ✔ | ✔ |
| Detecta módulos multi-archivo | — | ✔ (pestaña Módulo) |
| Escribe a disco | — | ✔ (con preview + confirm) |
| Ajustes (localStorage) | `playground:settings:v1` | `forge:settings:v1` (independiente) |

Forge **no toca** al Playground: son páginas separadas que comparten motor de chat.

---

## 7. Solución de problemas

| Síntoma | Causa / arreglo |
|---|---|
| La pestaña **Módulo** no se llena | El modelo no usó `@file:`. Pídeselo explícito, o cambia a un modelo de código (CoffeeIA + un modelo "código"). |
| Un archivo sale `BLOQUEADO` | Extensión fuera de la lista blanca o ruta con `..`/absoluta. Corrige la ruta en la instrucción. |
| El selector de proyecto está vacío | Apache no sirvió `ctrl-forge.php` o no hay subcarpetas en `www`. Revisa que WAMP esté arriba. |
| El código aparece en el chat | Por diseño, el código va al sandbox/panel, no al chat. En el chat sólo queda la explicación. |
| No escribe nada al materializar | Mira el *toast*: lista los archivos con error y su motivo. |

---

## 8. Referencia técnica

| Pieza | Archivo |
|---|---|
| Página | [forge.php](forge.php) |
| Lógica (chat + fábrica) | [src/js/forge.js](src/js/forge.js) |
| Estilos | [src/css/forge.css](src/css/forge.css) |
| Backend fábrica | [ctrl/ctrl-forge.php](ctrl/ctrl-forge.php) |
| Chat SSE (modelos) | [ctrl/ctrl-coffeeia-stream.php](ctrl/ctrl-coffeeia-stream.php) |

**Endpoints de `ctrl-forge.php`:**

- `GET ?action=projects` → proyectos destino (subcarpetas de www).
- `POST action=preview` (`project`, `files=JSON([{path,content}])`) → diff por
  archivo (`new` / `modified` / `identical` / `blocked`), **sin escribir**.
- `POST action=materialize` (mismos campos) → escribe los archivos y devuelve
  `written[]` / `errors[]`.
