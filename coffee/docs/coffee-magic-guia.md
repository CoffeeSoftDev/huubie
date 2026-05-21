# CoffeeMagic — Guia de uso

> Conjurador de interfaces del ecosistema CoffeeSoft. Genera templates HTML estaticos listos para integrar con el backend PHP/JS de CoffeeSoft.

---

## Tabla de contenido

1. [Que es CoffeeMagic](#que-es-coffeemagic)
2. [Como se invoca](#como-se-invoca)
3. [Sistemas de diseno soportados](#sistemas-de-diseno-soportados)
4. [Grimorios (fuentes de verdad)](#grimorios-fuentes-de-verdad)
5. [Spells (catalogo de hechizos)](#spells-catalogo-de-hechizos)
6. [Transformaciones (`transmute`)](#transformaciones-transmute)
7. [Flujo de trabajo](#flujo-de-trabajo)
8. [Estructura de salida](#estructura-de-salida)
9. [Ejemplos de invocacion](#ejemplos-de-invocacion)
10. [Reglas criticas](#reglas-criticas)
11. [Referencias rapidas](#referencias-rapidas)

---

## Que es CoffeeMagic

**CoffeeMagic** es un subagente Claude (modelo `opus`) cuyo unico trabajo es **conjurar UIs HTML estaticas** siguiendo el sistema de diseno CoffeeSoft. Vive en `~/.claude/agents/CoffeeMagic.md` y se invoca mediante el comando `/coffee-magic`.

**Caracteristicas clave:**

- Genera HTML autocontenido (un archivo por template, demos puros, sin backend).
- Tema configurable: **dark base** (default), **light**, **huubie-ui** o **coffee-varoch**.
- Trabaja sobre **grimorios** — archivos `.md` con snippets HTML aprobados que reutiliza para mantener coherencia visual.
- Tiene 10 **spells** (hechizos) + 1 **transformacion** (`transmute`) para convertir HTML aprobado en modulo JS coffeeSoft.

**Quien lo creo:** Rosy 🌹 (guardiana del ecosistema CoffeeSoft).

**Personalidad:** Conjurador teatral, calido y creativo. Presenta los entregables como "conjuros completados", llama a sus habilidades `spells` y firma con emojis tematicos: ✨ (magia), 🪄 (conjuro), ☕ (CoffeeSoft), 🌹 (para Rosy), 🔮 (analisis).

---

## Como se invoca

### Desde Claude Code

Hay dos formas:

```text
/coffee-magic
```

Sin argumentos, CoffeeMagic se presenta y lista sus spells disponibles.

```text
/coffee-magic <peticion en lenguaje natural>
```

Le pasas la descripcion de la UI que necesitas y procede a confirmar dominio/tema/spells antes de conjurar.

### Desde otro agente (delegacion)

Cualquier flujo que use el `Agent tool` puede invocarlo con:

- `subagent_type: "coffee-magic"` (o el alias `CoffeeMagic` segun configuracion)
- `prompt`: contexto completo (peticion, tema, dominio, archivo destino, restricciones)

---

## Sistemas de diseno soportados

CoffeeMagic conoce cuatro sistemas. **El usuario decide cual usar mediante la peticion**.

| Sistema | Cuando se aplica | Caracteristicas |
|---|---|---|
| **Dark base** (default) | Sin mencion de tema | Tailwind suelto + paleta `#111928`/`#1F2A37`. Generaria `light + dark` con toggle |
| **Light coffee clasico** | "tema coffee clasico", "paleta clasica" | Paleta light original (no varoch) |
| **Huubie UI** | "huubie ui", "tema huubie", `coffee/ui/` | Clases `.cs-*`, dark unico (no toggle), hub en `coffee/ui/index.html` |
| **Coffee-Varoch** | "tema varoch", "estilo varoch", `coffee/ui-kit/` | Clases `.cv-*`, light+dark, header azul + sidebar blanco, body `class="coffee-varoch"` |

> **Importante:** Huubie UI y dark base **NO** son lo mismo. Huubie UI es un sistema cerrado con `.cs-*` y `ui-kit.css` propio. Dark base usa Tailwind libre con la paleta finanzas/rrhh.

### Paleta dark base (default)

| Token | Valor | Uso |
|---|---|---|
| `bg-main` | `#111928` | Body principal |
| `bg-card` | `#1F2A37` | Cards, modales, paneles |
| `bg-input` | `#1a2332` | Inputs, selects, textareas |
| `bg-header` | `#141d2b` | Headers, subheaders |
| `bg-sidebar` | `#0f172a` | Sidebar de navegacion |
| `accent` | `#7c3aed` | Hover borders, toggles activos |
| `btn-primary` | `#1c64f2` | Botones principales |
| `text-primary` | `#ffffff` | Texto principal |
| `text-secondary` | `#9ca3af` | Labels, descripciones |

### Paleta Coffee-Varoch (light institucional)

| Token | Valor | Uso |
|---|---|---|
| `--cv-primary` | `#003360` | Azul institucional — header, titulos |
| `--cv-secondary` | `#F24444` | Rojo Varoch (NO verde lima) |
| `--cv-success` | `#7AAB20` | Verde oliva — exito |
| `--cv-danger` | `#9E1B32` | Rojo oscuro — alertas |
| `--cv-action` | `#2563EB` | Botones de accion |
| `--cv-bg` (light) | `#F2F5F9` | Fondo principal |
| `--cv-card` (light) | `#FFFFFF` | Cards |

---

## Grimorios (fuentes de verdad)

Los **grimorios** son archivos `.md` con snippets HTML aprobados y reglas tecnicas. CoffeeMagic los lee **antes** de conjurar para garantizar coherencia visual.

| Grimorio | Ubicacion | Dominio | Spells cubiertos |
|---|---|---|---|
| `grimorio-finanzas.md` | `~/.claude/agents/grimorios/` | CoffeeSoft Finanzas | table, detail, cards, form, hub, modal, selector |
| `grimorio-rrhh.md` | `~/.claude/agents/grimorios/` | CoffeeSoft RRHH | table, cards, grid, recibo, form, modal |
| `grimorio-huubie-ui.md` | `~/.claude/agents/grimorios/` | Huubie UI (clases `.cs-*`) | layout, navbar, sidebar, table, form, modal, badges, toast, toggle, avatar, pagination, empty, progress |
| `grimorio-coffee-varoch.md` | `~/.claude/agents/grimorios/` | Coffee-Varoch (clases `.cv-*`) | layout, navbar, sidebar, table, tabs, form, modal, cards, KPI, badges, breadcrumb, container |
| `grimorio-fuente.md` | `~/.claude/agents/grimorios/` | Pivotes canonicos para `transmute` | transmute |

**Resolucion de ubicacion (orden):**

1. Global del usuario: `~/.claude/agents/grimorios/[grimorio].md`
2. Local del proyecto: `.claude/agents/grimorios/[grimorio].md`
3. Fallback: `Glob` con patron `**/grimorio-[nombre].md`

**Mapeo automatico peticion → grimorio:**

- Ingresos, egresos, compras, bancos, CxC/CxP, presupuestos → `grimorio-finanzas.md`
- Empleados, nomina, asistencia, permisos, vacaciones → `grimorio-rrhh.md`
- "Huubie UI", `coffee/ui/index.html`, `ui-kit.css` → `grimorio-huubie-ui.md`
- "coffee-varoch", `coffee/ui-kit/` → `grimorio-coffee-varoch.md`
- Spell `transmute` → `grimorio-fuente.md` (obligatorio)

---

## Spells (catalogo de hechizos)

Los **spells** generan HTML estatico desde cero. Hay 10 spells canonicos.

### 1. `conjure table` — Tabla con filtros y paginacion

Sidebar + Header + Subheader con titulo y filtros, tabla con `sticky thead`, hover states, badges de status contextuales, paginacion ("Showing X-Y of Z"), boton de accion principal.

Referencia: `finanzas-ingresos.html`, `rrhh-personal.html`

### 2. `conjure detail` — Vista detalle con panel lateral

Layout split: tabla simplificada a la izquierda + panel lateral (`w-[420px]`) con datos detallados, badges, grid clave-valor, footer con botones.

Referencia: `finanzas-compras-detalle.html`

### 3. `conjure cards` — Dashboard con KPI cards

Grid de cards (3x2, 2x2) con titulo, valor numerico, subtotales, colores contextuales. Opcionalmente Chart.js + tabla resumen.

Referencia: `finanzas-ingresos-detalle.html`, `rrhh-resumen.html`

### 4. `conjure form` — Formulario centrado o modal

Card centrada con labels `text-[11px] text-gray-500`, inputs `.input-modal`, botones Enviar/Cancelar. Opcionalmente grid de 2 columnas.

### 5. `conjure modal` — Modal reutilizable

Overlay `bg-black/60` + card centrada. Anchos: 400px (simple), 520px (selector), 600px (medio), 720px (complejo). Variantes: confirmacion, formulario, selector grid, upload drag-drop.

### 6. `conjure selector` — Modal de seleccion tipo grid

Grid de opciones clickeables (2 columnas) con icono/texto y boton Aceptar.

Referencia: `modal-seleccionar-ingreso.html`

### 7. `conjure hub` — Pagina indice de navegacion

Landing con grid de cards navegables agrupadas por categoria (H2 `uppercase tracking-wider`). Toggle tema con `localStorage`.

Referencia: `finanzas-index-navegacion.html`

### 8. `conjure recibo` — Vista de documento

Card principal con header (logo + titulo), datos en grid 2 cols, tabla desglose, resumen + panel lateral de items.

Referencia: `rrhh-nomina-recibo.html`

### 9. `conjure grid` — Grid interactivo tipo calendario

Tabla-grid con columnas por fecha + filas por entidad (empleado, producto). Celdas clickeables con dropdown contextual y estados con dots de color.

Referencia: `rrhh-incidencia-personalizado.html`

### 10. `conjure sidebar` — Sidebar de navegacion

Sidebar `w-56` (224px) con logo, menu principal con iconos SVG, submenu expandible, footer (Settings, Logout, avatar).

---

## Transformaciones (`transmute`)

Distinto a los spells: **no genera HTML desde cero**, sino que **convierte HTML aprobado** en un modulo JS coffeeSoft.

| Transformacion | Entrada | Salida |
|---|---|---|
| `transmute` | HTML aprobado | Modulo JS coffeeSoft (`App + Entidad + View + sample_*.js + .php`) |

### Que produce

`transmute` siempre entrega **3 archivos obligatorios** + **1 opcional** (card en hub). Cada archivo tiene una responsabilidad clara y se conecta con los demas via el `.php` entry-point.

> **Convenciones de los placeholders:**
> - `{dir}` = carpeta del modulo dentro de `app/` (ej. `app/inventarios`)
> - `{modulo}` = nombre en kebab-case del modulo (ej. `traspasos`)
> - `{Entidad}` = nombre PascalCase de la entidad principal (ej. `Traspasos`)

---

**1. `{dir}/src/js/sample_{modulo}.js` — Datos mock y helpers**

Es el archivo de **datos en frio**: replica el formato del pivote (`sample_entradas.js`) y contiene todo lo que la UI necesita para funcionar sin backend. Es 100% UI-first ([[feedback_sample_pattern]]).

Que vive aqui:

- **`SAMPLE_VIEW_HEADER_{ENTIDAD}` / `SAMPLE_VIEW_FOOTER_{ENTIDAD}`** — config del header/footer del modulo (title, subtitle, back, info, legends).
- **Helpers de formateo** — funciones modulo con prefijo `_`: `_badgeStatus(val)`, `_fmtMoney(n)`, `_fmtDate(d)`. NO son metodos de clase, son utilidades sueltas.
- **`SAMPLE_{ENTIDAD}_DB`** — objeto-diccionario keyed por folio/codigo (ej. `'TRA-001': { fecha, origen, destino, ... }`). Simula la tabla raiz.
- **`_{entidad}Row(e)`** — funcion builder que transforma una fila de DB en formato fila-tabla con columnas y array `a` de acciones.
- **`SAMPLE_{ENTIDAD}_TABLE`** — `{ row: Object.values(SAMPLE_{ENTIDAD}_DB).map(_{entidad}Row) }`. Lo que consume `createCoffeeTable3()`.
- **`SAMPLE_{ENTIDAD}_COUNTS`** (opcional) — agregados para KPIs (totales, por estado, por sucursal).
- **Catalogos `{ id, valor }[]`** — listas para selects: `SAMPLE_{ENTIDAD}_SUCURSALES`, `SAMPLE_{ENTIDAD}_ESTADOS`, etc.

> **Por que existe:** permite levantar la UI completa sin BD ni backend. Cuando este conectado a Mysql, basta con cambiar el `useFetch` y los `SAMPLE_*` se ignoran. Se carga **antes** del modulo principal en el `.php` para que `app.js` pueda leer estos globales.

---

**2. `{dir}/src/js/{modulo}.js` — Arquitectura tripartita**

Es el **cerebro del modulo**. Contiene las 3 clases canonicas que extienden `Templates` (de `coffeeSoft.js`), cada una con una responsabilidad estricta.

```js
let api = 'ctrl/ctrl-{modulo}.php';
let app, {entidad}, {entidad}View;

$(async () => {
    {entidad}View = new {Entidad}View(api, 'root');
    {entidad}     = new {Entidad}(api, 'root');
    app           = new App(api, 'root');
    await app.init();
});

class App extends Templates       { /* orquesta */ }
class {Entidad} extends Templates { /* data    */ }
class {Entidad}View extends Templates { /* vistas */ }
```

| Clase | Responsabilidad | Metodos tipicos |
|---|---|---|
| `App` | Orquesta el ciclo de vida del modulo: `init()`, `render()`, `layout()`, `filterBar()`, registra event handlers, expone una facade publica para que otros modulos llamen `app.method()` | `init`, `layout`, `createfilterBar`, `bindEvents`, `onBranchChange` |
| `{Entidad}` | Capa de **datos**: lista, guarda, alterna estado. Habla con el backend via `useFetch` (o con `SAMPLE_*` en modo fake). Tambien arma estructuras para KPIs y tablas. | `ls{Entidad}`, `lsKpis`, `save{Entidad}`, `toggle{Entidad}` |
| `{Entidad}View` | Capa de **vistas**: arma DOM. Recibe datos de `{Entidad}` y los pinta. Tambien aloja **componentes locales** que NO existen en `Templates` (`viewHeader`, `viewFooter`, `tabsBar`, `kpisRow`, `entradaForm`, etc.) portados 1:1 desde el pivote. | `renderHeader`, `renderFooter`, `renderTabs`, `viewHeader`, `kpisRow` |

> **Regla critica:** antes de invocar `this.X(...)`, `Grep` en `coffeeSoft.js` para confirmar que `X` existe en `Templates`. Si NO existe, se porta el componente desde el pivote a `{Entidad}View`. **Nunca se asume herencia** ([[feedback_no_class_banner_comments]] + grimorio-fuente).

---

**3. `{dir}/{modulo}.php` — Entry-point**

Es la **pagina HTML server-side** que el usuario abre en el navegador. Replica el `.php` del pivote exactamente, con dos secciones criticas: layout PHP y carga de scripts.

```php
<?php require_once("../conf/_Rutes.php"); ?>
<!DOCTYPE html>
<html lang="es">
<head>
    <?php require_once(__DIR__ . '/../layout/head.php'); ?>
    <?php require_once(__DIR__ . '/../layout/core-libraries.php'); ?>
</head>
<body class="bg-[#111928] text-white" data-bs-theme="dark">
    <div id="menu-navbar"></div>
    <div id="menu-sidebar"></div>
    <div id="mainContainer" class="...mt-16">
        <div id="root"></div>
    </div>
    <script src="/{dir}/src/js/sample_{modulo}.js?t=<?php echo time(); ?>"></script>
    <script src="/{dir}/src/js/{modulo}.js?t=<?php echo time(); ?>"></script>
</body>
</html>
```

Que importa de aqui:

- **Layout compartido** — `head.php` (meta, fonts, CSS globales) y `core-libraries.php` (jQuery, `coffeeSoft.js`, Templates, ApexCharts, etc.) vienen via require.
- **Pivote DOM** — `#root` es el contenedor donde `primaryLayout()` inyecta el modulo. Tambien expone `#menu-navbar` y `#menu-sidebar` para los menus globales.
- **Orden de scripts obligatorio** — primero `sample_{modulo}.js` (define `SAMPLE_*`), luego `{modulo}.js` (los consume). Invertir el orden rompe el modulo.
- **Cache buster** — `?t=<?php echo time(); ?>` fuerza al navegador a recargar el JS en cada visita (util en desarrollo).

---

**4. Card en hub** *(opcional, solo si se pasa `hub:` en el YAML)*

Cuando el modulo vive dentro de un dashboard navegable (ej. `inventarios-index-navegacion.html`), `transmute` agrega una **card clickeable** que linkea al nuevo `.php`. La card NO se inventa: **clona el `class` exacto** de las cards vecinas ya existentes en el hub, cambiando solo tres cosas:

- **Texto** (`card_label` del YAML, ej. "Traspasos")
- **Icono Lucide** (`card_icon` del YAML, ej. `arrow-left-right`)
- **`onclick`** que apunta al `.php` recien generado (ej. `location.href='/app/inventarios/traspasos.php'`)

> **Por que clona en vez de generar:** mantiene la consistencia visual del hub sin que el conjurador tenga que adivinar paddings, bordes y hovers. Si las cards vecinas cambian, las nuevas heredan el cambio.

---

### Como se conectan los 4 archivos

```text
Usuario abre {modulo}.php
        ↓
{modulo}.php carga sample_{modulo}.js  → SAMPLE_* en memoria
        ↓
{modulo}.php carga {modulo}.js          → instancia App, {Entidad}, View
        ↓
App.init() llama Entidad.ls{Entidad}() → lee SAMPLE_{ENTIDAD}_TABLE
        ↓
Entidad pasa datos a View              → View pinta tabla en #root
        ↓
Card en hub (opcional)                 → punto de entrada navegable
```

### Pivote canonico (default)

- `app/inventarios/src/js/pos-entradas.js`
- `app/inventarios/src/js/sample_entradas.js`
- `app/inventarios/pos-entradas.php`

### Sintaxis YAML

```yaml
/coffee-magic transmute
fuente:      [ruta HTML aprobado]              # obligatorio
modulo:      [nombre-kebab]                    # obligatorio
project:     [PascalCase PROJECT_NAME]         # opcional, se infiere
referencia:  [ruta JS pivote]                  # opcional, default pos-entradas.js
tema:        huubie|varoch|dark                # opcional, se detecta del HTML
hub:         [ruta HTML hub]                   # opcional
card_label:  [texto card]                      # solo si hay hub
card_icon:   [lucide icon]                     # solo si hay hub
```

### Tema visual (detectado automatico)

- HTML usa `.cs-*` o paleta `#111928/#1F2A37` → **huubie**
- HTML usa `.cv-*` o `coffee-varoch.css` → **varoch**
- HTML solo Tailwind generico → **dark base** (default)

---

## Flujo de trabajo

1. **Usuario** describe las pantallas que necesita.
2. **CoffeeMagic confirma** (excepto si la peticion ya trae todo explicito):
   - Dominio detectado (finanzas / rrhh / inventario / huubie-ui / coffee-varoch / nuevo)
   - Tema a aplicar (huubie / varoch / dark base / light+dark con toggle)
   - Spells a invocar (lista breve de HTML a generar)
3. **Lee el grimorio** correspondiente con `Read`.
4. **Identifica spells** segun la peticion confirmada.
5. **Lista archivos** que va a generar (templates + modals).
6. **Genera cada HTML** completo reutilizando snippets del grimorio.
7. **Genera el hub** de navegacion que enlaza todo.
8. **Reporta** archivos creados como "conjuros completados".
9. **Opt-in transmutacion** — ofrece materializar el HTML como modulo JS coffeeSoft.

---

## Estructura de salida

Estructura canonica que CoffeeMagic siempre produce cuando es un modulo completo:

```text
[nombre-modulo]/
├── templates/
│   ├── [modulo]-index-navegacion.html      # Hub de demos (siempre)
│   ├── [modulo]-[seccion].html             # Templates principales
│   ├── [modulo]-[seccion]-detalle.html     # Vistas detalle
│   └── modals/                             # Modales reutilizables
│       ├── modal-[accion].html             # Ej: modal-nuevo-registro.html
│       ├── modal-confirmacion.html
│       └── modal-[selector].html
```

Si la peticion es un solo archivo (ej. visor-index.html), genera unicamente ese archivo en la ruta indicada.

---

## Ejemplos de invocacion

### Ejemplo 1 — Conjuro simple sin grimorio especifico

```text
/coffee-magic conjure table para inventario con columnas: ID, Producto, Stock, Precio, Status
```

**Que hace:**
- Detecta dominio "inventario" → no hay grimorio dedicado, usa snippets de finanzas/rrhh.
- Tema default → genera AMBOS (light + dark) con toggle.
- Genera `inventario-stock.html` con tabla, filtros, sidebar y paginacion.

---

### Ejemplo 2 — Modal especifico

```text
/coffee-magic conjure modal form para nuevo proveedor con 8 campos:
nombre, razon social, RFC, telefono, email, direccion, estado, codigo postal
```

**Que hace:**
- Genera `modals/modal-nuevo-proveedor.html` (~520px, formulario centrado con grid 2 cols).
- Overlay `bg-black/60`, boton cerrar X, botones Guardar/Cancelar.

---

### Ejemplo 3 — Modulo completo de finanzas

```text
/coffee-magic conjura el modulo completo de "egresos" con:
- Lista principal de egresos (tabla)
- Vista detalle por egreso (panel lateral)
- Modal de nuevo egreso (form 6 campos)
- Hub de navegacion
```

**Que hace:**
- Lee `grimorio-finanzas.md`.
- Confirma dominio (finanzas) y spells (table, detail, modal, hub).
- Genera:
  - `egresos/templates/egresos-index-navegacion.html`
  - `egresos/templates/egresos.html`
  - `egresos/templates/egresos-detalle.html`
  - `egresos/templates/modals/modal-nuevo-egreso.html`

---

### Ejemplo 4 — Tema Huubie UI explicito

```text
/coffee-magic conjure form en estilo Huubie UI para nuevo cliente con 6 campos
```

**Que hace:**
- Detecta "Huubie UI" → carga `grimorio-huubie-ui.md`.
- Usa clases `.cs-*` (cs-input, cs-btn, cs-card, etc.) y `ui-kit.css`.
- Genera dark unico (NO toggle, Huubie UI es dark unico).

---

### Ejemplo 5 — Tema Coffee-Varoch institucional

```text
/coffee-magic conjure hub con tema varoch para modulo de contabilidad
con secciones: Polizas, Catalogo de cuentas, Balance, Reportes
```

**Que hace:**
- Carga `grimorio-coffee-varoch.md`.
- Genera HTML con `<body class="coffee-varoch">`, header azul `#003360`, sidebar blanco.
- Cards navegables con `.cv-hub-card`.
- Breadcrumb debajo del header dentro de `#main__content`.

---

### Ejemplo 6 — Visor de archivos personalizado (caso real)

```text
/coffee-magic conjura coffee/app/visor/visor-index.html
- Visor de archivos .md con sidebar 280px (Agentes + Grimorios) + main content
- Tema Huubie dark
- Marked.js via CDN para renderizado markdown
- SAMPLE_AGENTS inline con 15 archivos (9 agentes + 6 grimorios)
- Tabs Renderizado/Raw + buscador global + tarjeta de frontmatter
```

**Que hace:**
- Detecta tema Huubie dark, carga `grimorio-huubie-ui.md`.
- Genera unico archivo `visor-index.html` autocontenido.
- Incluye marked.js, Lucide, Tailwind, Inter + JetBrains Mono.

---

### Ejemplo 7 — Spell `transmute` (HTML → modulo JS)

```text
/coffee-magic transmute
fuente:      coffee/templates/inventarios/inventarios-traspasos.html
modulo:      traspasos
project:     Traspasos
hub:         coffee/templates/inventarios/inventarios-index-navegacion.html
card_label:  Traspasos
card_icon:   arrow-left-right
```

**Que hace:**
- Lee el pivote canonico (`pos-entradas.js`, `sample_entradas.js`, `pos-entradas.php`).
- Lee el HTML fuente completo.
- Genera arquitectura tripartita:
  - `inventarios/src/js/sample_traspasos.js`
  - `inventarios/src/js/traspasos.js` (clases `App`, `Traspasos`, `TraspasosView`)
  - `inventarios/traspasos.php`
- Agrega card en el hub de inventarios clonando el `class` exacto de las vecinas.
- Detecta tema huubie desde el HTML fuente (clases `.cs-*`) — no fuerza nada.

---

### Ejemplo 8 — Sin argumentos (autoayuda)

```text
/coffee-magic
```

**Que devuelve:**

```text
✨☕ Soy CoffeeMagic, el conjurador de interfaces del ecosistema CoffeeSoft.
Creado por Rosy 🌹 — guardiana del ecosistema CoffeeSoft.

Mis spells disponibles:
1. conjure table     — Tabla con filtros y paginacion
2. conjure detail    — Vista detalle con panel lateral
3. conjure cards     — Dashboard con KPI cards
4. conjure form      — Formulario centrado o modal
5. conjure modal     — Modal reutilizable
6. conjure selector  — Modal de seleccion tipo grid
7. conjure hub       — Pagina indice de navegacion
8. conjure recibo    — Vista de documento/recibo
9. conjure grid      — Grid interactivo tipo calendario
10. conjure sidebar  — Sidebar de navegacion
11. transmute        — HTML aprobado → modulo JS coffeeSoft

Que interfaz quieres conjurar?
```

---

## Reglas criticas

### Siempre

1. Usa Tailwind CSS via CDN + Inter font (Google Fonts).
2. Genera HTML autocontenido (cada archivo funciona standalone).
3. Crea hub de navegacion (`index-navegacion.html`) cuando es un modulo completo.
4. Separa modales en subcarpeta `modals/`.
5. Sidebar + header + subheader consistentes en cada template.
6. Tablas con `sticky thead` y hover states.
7. Badges con patron `bg-[color]-500/15 text-[color]-400`.
8. En tema light, las tablas SIEMPRE con fondo blanco `#ffffff` (aunque el body sea gris).
9. Si NO se menciona tema, genera AMBOS (light + dark) con toggle.

### Nunca

1. JavaScript funcional mas alla de theme toggle y `window.close()`.
2. Backend (PHP, APIs) — son demos estaticos puros.
3. Inferir silenciosamente tema o dominio cuando hay ambiguedad — confirma primero.
4. Banners decorativos `// ═════` ni descriptores `// Clase: X hace Y`.
5. Tildes en strings de codigo (estilo del codebase).
6. Mezclar Huubie UI con Coffee-Varoch salvo peticion explicita.

### Reglas especificas del spell `transmute`

- Lectura COMPLETA del pivote antes de transmutir.
- `Grep` en `coffeeSoft.js` por cada componente local que va a usar — si no esta en `Templates`, se porta 1:1 desde el pivote.
- `SAMPLE_*` siempre al top del archivo sample.
- `.php` carga sample ANTES del modulo principal.
- `node --check` pasa en ambos JS sin errores.

---

## Referencias rapidas

| Recurso | Ruta |
|---|---|
| Definicion del agente | `~/.claude/agents/CoffeeMagic.md` |
| Grimorio Finanzas | `~/.claude/agents/grimorios/grimorio-finanzas.md` |
| Grimorio RRHH | `~/.claude/agents/grimorios/grimorio-rrhh.md` |
| Grimorio Huubie UI | `~/.claude/agents/grimorios/grimorio-huubie-ui.md` |
| Grimorio Coffee-Varoch | `~/.claude/agents/grimorios/grimorio-coffee-varoch.md` |
| Grimorio Fuente (pivotes) | `~/.claude/agents/grimorios/grimorio-fuente.md` |
| Hub Huubie UI | `coffee/ui/index.html` |
| CSS Huubie UI | `coffee/ui/css/ui-kit.css` |
| Hub Coffee-Varoch | `coffee/ui-kit/index.html` |
| CSS Coffee-Varoch | `coffee/ui/utils/coffee-varoch.css` |
| Pivote `transmute` (JS) | `app/inventarios/src/js/pos-entradas.js` |
| Pivote `transmute` (sample) | `app/inventarios/src/js/sample_entradas.js` |
| Pivote `transmute` (PHP) | `app/inventarios/pos-entradas.php` |

---

> *"He conjurado este documento desde el grimorio de CoffeeMagic. Que cada interfaz que invoques sea materializada con precision."* — ✨☕
