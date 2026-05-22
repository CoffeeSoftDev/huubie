// ──────────────────────────────────────────────────────────────────────
//  SAMPLE — Visor de Agentes (CoffeeSoft Library)
//  Datos estaticos que alimentan el modulo visor.js
//  Equivalente al script inline original de:
//    coffee/app/visor/visor-index.html
// ──────────────────────────────────────────────────────────────────────

const SAMPLE_VISOR_HEADER = {
    title:     'Visor de Agentes',
    subtitle:  'CoffeeSoft Library',
    user:      { initials: 'RV', name: 'Rosy V.', role: 'Guardiana' },
    pathLabel: '.claude/agents',
    source:    'Local'
};

const SAMPLE_VISOR_AGENTS = {
    agents: [
        {
            name: 'CoffeeIA',
            file: 'CoffeeIA.md',
            section: 'agentes',
            size: '31 KB',
            frontmatter: {
                name: 'CoffeeIA',
                description: 'Agente principal del framework CoffeeSoft para arquitectura full-stack PHP/JS',
                model: 'opus'
            },
            raw: `---
name: CoffeeIA
description: Agente principal del framework CoffeeSoft para arquitectura full-stack PHP/JS
model: opus
---

# CoffeeIA

> Agente maestro del ecosistema **CoffeeSoft** para generacion de modulos full-stack siguiendo el framework propio (clase Templates + helpers).

## Rol

CoffeeIA orquesta la creacion de modulos completos respetando la arquitectura tripartita:

1. \`class App extends Templates\` — orquesta init/render/layout/filterBar
2. \`class {Entidad} extends Templates\` — capa data (lsXxx, save, toggle)
3. \`class {Entidad}View extends Templates\` — vistas (render*)

## Workflow obligatorio

Sigue las fases descritas en \`WORKFLOW.md\`:

- **Fase 1** — Analisis y diseno
- **Fase 2** — DB + Modelo + Controlador
- **Fase 3** — Frontend JS (tripartita)
- **Fase 4** — Integracion y pruebas

## Reglas duras

- NUNCA saltarse fases bajo presion de "haz todo ya"
- SIEMPRE consultar \`grimorio-fuente.md\` antes de generar JS
- Componentes locales NO heredados: portarlos 1:1 desde el pivote
- Sin banners \`// ════\` ni descriptores \`// Clase: X hace Y\`

## Pivotes canonicos

| Capa | Pivote |
|---|---|
| JS modulo | \`app/inventarios/src/js/pos-entradas.js\` |
| JS sample | \`app/inventarios/src/js/sample_entradas.js\` |
| PHP entry | \`app/inventarios/pos-entradas.php\` |

## Ejemplo de invocacion

\`\`\`
/coffee-ia genera modulo "Recepciones" con campos:
  - folio, fecha, almacen, proveedor, status
  - detail: producto, cantidad, costo_unit
\`\`\`

CoffeeIA respondera con los 4 archivos (DB.sql, mdl-recepciones.php, ctrl-recepciones.php, recepciones.js + sample) listos para integrar.
`
        },
        {
            name: 'CoffeeMagic',
            file: 'CoffeeMagic.md',
            section: 'agentes',
            size: '26 KB',
            frontmatter: {
                name: 'CoffeeMagic',
                description: 'Conjurador de interfaces HTML estaticas con Tailwind y tema Huubie dark',
                model: 'opus'
            },
            raw: `---
name: CoffeeMagic
description: Conjurador de interfaces HTML estaticas con Tailwind y tema Huubie dark
model: opus
---

# CoffeeMagic

Soy **CoffeeMagic**, el conjurador de interfaces del ecosistema CoffeeSoft. Materializo UIs completas en HTML estatico con Tailwind CSS, listas para integrarse con el backend PHP/JS.

## Spells disponibles

1. **conjure table** — tabla con filtros y paginacion
2. **conjure detail** — vista detalle con panel lateral
3. **conjure cards** — dashboard con KPI cards
4. **conjure form** — formulario centrado o modal
5. **conjure modal** — modal reutilizable
6. **conjure selector** — modal de seleccion tipo grid
7. **conjure hub** — pagina indice de navegacion
8. **conjure recibo** — vista de documento/recibo
9. **conjure grid** — grid interactivo tipo calendario
10. **conjure sidebar** — sidebar de navegacion
11. **transmute** — HTML aprobado a modulo JS coffeeSoft

## Tema base

- Paleta: \`#111928\`, \`#1F2A37\`, \`#141d2b\`
- Acento: \`#7C3AED\` (purpura), \`#3FC189\` (verde)
- Tipografia: Inter

## Grimorios cargables

> Los grimorios son archivos MD con snippets reutilizables. CoffeeMagic los carga ANTES de generar HTML.

- \`grimorio-finanzas.md\`
- \`grimorio-rrhh.md\`
- \`grimorio-huubie-ui.md\`
- \`grimorio-coffee-varoch.md\`
- \`grimorio-fuente.md\`
`
        },
        {
            name: 'CoffeeArcher',
            file: 'CoffeeArcher.md',
            section: 'agentes',
            size: '7 KB',
            frontmatter: {
                name: 'CoffeeArcher',
                description: 'QA del ERP-GV con 47 reglas de validacion estructural',
                model: 'opus'
            },
            raw: `---
name: CoffeeArcher
description: QA del ERP-GV con 47 reglas de validacion estructural
model: opus
---

# CoffeeArcher

Agente de control de calidad del **ERP-GV** (Grupo Varoch). Aplica 47 reglas duras sobre cualquier modulo.

## Categorias de reglas

| Categoria | Reglas |
|---|---|
| Estructura DB | 12 |
| Modelos PHP | 9 |
| Controladores | 7 |
| Frontend JS | 11 |
| HTML / UI | 5 |
| Seguridad | 3 |

## Ejemplo de reglas

- **R-DB-01**: Todo amount/subtotal/tax/total va como DOUBLE, no DECIMAL
- **R-DB-04**: FKs al final, despues de active y timestamps
- **R-JS-03**: Prohibido \`// ════\` y \`// Clase: X\` sobre \`class X\`
- **R-UI-02**: Tablas en tema light con fondo blanco \`#ffffff\`

## Output

CoffeeArcher genera un reporte tipo:

\`\`\`
[OK] R-DB-01 montos en DOUBLE
[OK] R-DB-04 FKs al final
[FAIL] R-JS-03 banner detectado en pos-entradas.js linea 47
\`\`\`
`
        },
        {
            name: 'coffee-intelligence',
            file: 'coffee-intelligence.md',
            section: 'agentes',
            size: '11 KB',
            frontmatter: {
                name: 'coffee-intelligence',
                description: 'Analisis de BD desde templates HTML aprobados, emite diagrama de relaciones',
                model: 'opus'
            },
            raw: `---
name: coffee-intelligence
description: Analisis de BD desde templates HTML aprobados, emite diagrama de relaciones
model: opus
---

# coffee-intelligence

Analiza templates HTML aprobados y propone:

1. **Estructura de BD** (tablas, campos, tipos, FKs)
2. **Diagrama de relaciones** en texto plano (seccion 2.bis)
3. **Modelo de datos** alineado con db-rules.md

## Convencion del diagrama

- Caja **doble** = tabla del esquema actual
- Caja **simple** = tabla cross-schema (otro modulo)
- Cardinalidades junto a flechas
- Tabla aparte con leyenda de cada relacion

## Ejemplo

\`\`\`
╔═══════════════╗      1:N    ┌──────────────┐
║  recepciones  ║◄────────────│   almacenes  │
╚═══════════════╝             └──────────────┘
        │ 1:N
        ▼
╔══════════════════╗
║ detail_recepcion ║
╚══════════════════╝
\`\`\`
`
        },
        {
            name: 'KIRBY',
            file: 'KIRBY.md',
            section: 'agentes',
            size: '8 KB',
            frontmatter: {
                name: 'KIRBY',
                description: 'Absorbedor de proyectos: lee codigo legacy y genera documentacion exhaustiva',
                model: 'opus'
            },
            raw: `---
name: KIRBY
description: Absorbedor de proyectos legacy y generador de documentacion
model: opus
---

# KIRBY

> Como el personaje, **absorbe** cualquier proyecto y devuelve sus poderes en forma de documentacion.

## Capacidades

- Escanea directorios completos y extrae arquitectura
- Identifica patrones de framework (CoffeeSoft, Laravel, plain PHP, etc.)
- Genera \`README.md\`, \`ARCHITECTURE.md\`, \`API.md\` y \`SCHEMA.md\`
- Mapea relaciones entre modulos

## Output tipico

\`\`\`
docs/
├── README.md          (overview + setup)
├── ARCHITECTURE.md    (capas y flujo)
├── API.md             (endpoints + payloads)
└── SCHEMA.md          (BD + relaciones)
\`\`\`

## Casos de uso

- Migrar de un ERP legacy a CoffeeSoft
- Documentar codigo heredado sin documentacion
- Generar onboarding para devs nuevos
`
        },
        {
            name: 'CTRL',
            file: 'CTRL.md',
            section: 'agentes',
            size: '5 KB',
            frontmatter: {
                name: 'CTRL',
                description: 'Generador de controladores PHP CoffeeSoft (clase Controllers + actions)',
                model: 'opus'
            },
            raw: `---
name: CTRL
description: Generador de controladores PHP CoffeeSoft
model: opus
---

# CTRL

Agente especializado en generar controladores PHP que extienden \`Controllers\`.

## Patron canonico

\`\`\`php
class CtrlRecepciones extends Controllers {
    function ls() { /* listado */ }
    function save() { /* alta/edicion */ }
    function toggle() { /* baja logica */ }
    function detail() { /* renglones */ }
}
\`\`\`

## Reglas

- Cada action retorna JSON con \`{ status, data, msg }\`
- Validacion de input ANTES de llamar al modelo
- Errores capturados con try/catch y registrados en log

## Cabecera fija

\`\`\`php
<?php
require_once("../../conf/_Rutes.php");
require_once(MDL . 'mdl-recepciones.php');
\`\`\`
`
        },
        {
            name: 'FRONT-JS',
            file: 'FRONT-JS.md',
            section: 'agentes',
            size: '6 KB',
            frontmatter: {
                name: 'FRONT-JS',
                description: 'Reglas y patrones para JavaScript de modulos CoffeeSoft',
                model: 'opus'
            },
            raw: `---
name: FRONT-JS
description: Reglas FRONT-JS para CoffeeSoft
model: opus
---

# FRONT-JS

## Reglas duras

1. Arquitectura tripartita (App + Entidad + View)
2. SAMPLE_* declarado al top del archivo
3. Sin banners decorativos \`// ════\`
4. Sin descriptores \`// Clase: X hace Y\`
5. Sin tildes en strings
6. Prefijo \`_\` solo para helpers de modulo, NO para metodos de clase
7. \`Object.assign\` para merge de root con arrays (NO \`this.ObjectMerge\`)

## Estructura recomendada

\`\`\`js
let api = 'ctrl/ctrl-modulo.php';
let app, entidad, entidadView;

$(async () => {
    entidadView = new EntidadView(api, 'root');
    entidad = new Entidad(api, 'root');
    app = new App(api, 'root');
    await app.init();
});

class App extends Templates { /* ... */ }
class Entidad extends Templates { /* ... */ }
class EntidadView extends Templates { /* ... */ }
\`\`\`
`
        },
        {
            name: 'MDL',
            file: 'MDL.md',
            section: 'agentes',
            size: '5 KB',
            frontmatter: {
                name: 'MDL',
                description: 'Generador de modelos PHP CoffeeSoft (clase Models con CRUD canonico)',
                model: 'opus'
            },
            raw: `---
name: MDL
description: Reglas MDL para modelos PHP
model: opus
---

# MDL

## Patron canonico

\`\`\`php
class MdlRecepciones extends Models {
    public $table = 'recepciones';
    public $primary = 'recepciones_id';

    function ls($f) { /* SELECT con joins */ }
    function save($p) { /* INSERT / UPDATE */ }
    function toggle($id) { /* active = !active */ }
}
\`\`\`

## Convenciones

- Tabla en plural minuscula
- PK con sufijo \`_id\`
- \`detail_\` solo para renglones de transaccion raiz
- Pivotes N:M sin prefijo
- Montos en \`DOUBLE\`, NO \`DECIMAL\`
- Orden de columnas: business cols → FKs (*_id) → active → timestamps
`
        },
        {
            name: 'CoffeeIA.backup-2026-04-28',
            file: 'CoffeeIA.backup-2026-04-28.md',
            section: 'agentes',
            size: '28 KB',
            isBackup: true,
            frontmatter: {
                name: 'CoffeeIA (backup)',
                description: 'Respaldo del agente CoffeeIA al 28-abril-2026 (no usar en produccion)',
                model: 'opus'
            },
            raw: `---
name: CoffeeIA (backup)
description: Respaldo del agente CoffeeIA al 28-abril-2026
model: opus
---

# CoffeeIA — Backup 2026-04-28

> ESTE ARCHIVO ES UN RESPALDO HISTORICO. No es la version vigente del agente.

## Razon del respaldo

Antes de la refactorizacion grande del 28 de abril 2026 que migro CoffeeIA a la nueva arquitectura tripartita estricta (App + Entidad + View), se guardo este snapshot.

## Diferencias clave vs version actual

- No exigia \`sample_*.js\` en archivo separado
- Permitia banners \`// ════\` decorativos
- Componentes locales podian declararse en \`Templates\` (ahora prohibido)
- No tenia el spell \`transmute\`

## Cuando consultar este backup

Solo si necesitas entender decisiones historicas o restaurar un comportamiento previo.
`
        }
    ],
    grimoires: [
        {
            name: 'db-rules',
            file: 'db-rules.md',
            section: 'grimorios',
            size: '14 KB',
            frontmatter: {
                name: 'db-rules',
                description: 'Reglas canonicas de base de datos del ecosistema CoffeeSoft',
                model: 'opus'
            },
            raw: `---
name: db-rules
description: Reglas canonicas de BD CoffeeSoft
model: opus
---

# DB Rules — CoffeeSoft

## Naming

- Tablas: plural minusculas con guion bajo (\`detail_recepciones\`)
- PK: \`{tabla}_id\` (singular + \`_id\`)
- FKs: igual al PK de la tabla referenciada

## Tipos canonicos

| Concepto | Tipo |
|---|---|
| Monto (amount/subtotal/tax/total) | **DOUBLE** |
| Cantidad | DOUBLE |
| Stock | DOUBLE |
| Estado active | TINYINT(1) |
| Fechas | DATETIME |

## Orden de columnas

1. PK (\`*_id\` AUTO_INCREMENT)
2. Columnas de negocio (folio, fecha, descripcion)
3. Montos (amount, tax, total)
4. \`active TINYINT(1) DEFAULT 1\`
5. Timestamps (\`created_at\`, \`updated_at\`)
6. FKs (\`*_id\` al final)

## Prefijo detail_

- \`detail_recepciones\` ✓ (renglones de la recepcion raiz)
- \`almacenes_productos\` ✓ (pivote N:M, sin prefijo)
- \`detail_almacenes_productos\` ✗ (incorrecto)
`
        },
        {
            name: 'grimorio-coffee-varoch',
            file: 'grimorio-coffee-varoch.md',
            section: 'grimorios',
            size: '100 KB',
            frontmatter: {
                name: 'grimorio-coffee-varoch',
                description: 'Patrones de UI del sistema institucional Grupo Varoch (.cv-* classes)',
                model: 'opus'
            },
            raw: `---
name: grimorio-coffee-varoch
description: Patrones UI Grupo Varoch (.cv-*)
model: opus
---

# Grimorio Coffee-Varoch

> Sistema de diseno **institucional** del Grupo Varoch / ERP-GV. Soporta light + dark con header azul \`#003360\` + sidebar blanco.

## Paleta institucional

| Token | Valor | Uso |
|---|---|---|
| \`--cv-primary\` | **\`#003360\`** | Azul institucional Varoch |
| \`--cv-secondary\` | **\`#F24444\`** | Rojo Varoch |
| \`--cv-success\` | \`#7AAB20\` | Verde oliva |
| \`--cv-danger\` | \`#9E1B32\` | Rojo oscuro |
| \`--cv-action\` | \`#2563EB\` | Azul accion (botones, enlaces) |

## Estructura canonica

\`\`\`html
<body class="coffee-varoch">
  <header class="cv-header cv-header-primary">...</header>
  <main class="flex flex-1">
    <section class="cv-sidebar">...</section>
    <div id="main__content">
      <nav><ol class="cv-module-breadcrumb">...</ol></nav>
      <div class="cv-main-container" id="root">...</div>
    </div>
  </main>
</body>
\`\`\`

## Reglas duras

1. Header SIEMPRE azul (\`cv-header-primary\`) — NO blanco
2. Sidebar SIEMPRE blanco (\`cv-sidebar\`) — NO azul
3. Breadcrumb DEBAJO del header, dentro de \`#main__content\`
4. Tablas y tabs usan **Tailwind puro** (NO \`.cv-*\`), identico al output de coffeeSoft.js

## Componentes \`.cv-*\` clave

- \`.cv-card\`, \`.cv-card-hover\`
- \`.cv-kpi\` + \`-label/-value/-foot\`
- \`.cv-btn\` + \`-primary/-action/-success/-danger\`
- \`.cv-badge\` + variantes
- \`.cv-input\`, \`.cv-select\`, \`.cv-textarea\`
- \`.cv-modal-overlay\` + \`.cv-modal\`
`
        },
        {
            name: 'grimorio-fuente',
            file: 'grimorio-fuente.md',
            section: 'grimorios',
            size: '45 KB',
            frontmatter: {
                name: 'grimorio-fuente',
                description: 'Pivotes canonicos para el spell transmute (HTML -> JS coffeeSoft)',
                model: 'opus'
            },
            raw: `---
name: grimorio-fuente
description: Pivotes canonicos para transmute
model: opus
---

# Grimorio Fuente

> Contiene los **pivotes canonicos** del spell \`transmute\` (HTML aprobado a modulo JS coffeeSoft). Tema agnostico.

## Arquitectura tripartita obligatoria

\`\`\`
class App extends Templates           // orquesta (init/render/layout)
class {Entidad} extends Templates     // data (lsXxx, save, toggle)
class {Entidad}View extends Templates // vistas (render*)
\`\`\`

## Pivotes por defecto

| Capa | Pivote |
|---|---|
| JS modulo | \`app/inventarios/src/js/pos-entradas.js\` |
| JS sample | \`app/inventarios/src/js/sample_entradas.js\` |
| PHP entry | \`app/inventarios/pos-entradas.php\` |

## Formato del SAMPLE

\`\`\`js
const SAMPLE_VIEW_HEADER_ENTIDAD = { title, subtitle, back };
const SAMPLE_ENTIDAD_DB = { 'KEY-001': { ... } };
const _entidadRow = (e) => ({ id, Col1, Col2, a: [acciones] });
const SAMPLE_ENTIDAD_TABLE = { row: Object.values(SAMPLE_ENTIDAD_DB).map(_entidadRow) };
\`\`\`

## Reglas duras

1. Componentes locales (\`viewHeader\`, \`viewFooter\`, \`tabsBar\`, \`kpisRow\`) viven en el modulo, NO en \`Templates\`
2. NUNCA asumir herencia: \`Grep\` en coffeeSoft.js antes de invocar \`this.X(...)\`
3. \`SAMPLE_*\` siempre en archivo separado \`sample_{modulo}.js\`
4. Sin banners \`// ════\`, sin tildes en strings
`
        },
        {
            name: 'grimorio-finanzas',
            file: 'grimorio-finanzas.md',
            section: 'grimorios',
            size: '38 KB',
            frontmatter: {
                name: 'grimorio-finanzas',
                description: 'Patrones UI del modulo CoffeeSoft Finanzas (ingresos, egresos, compras)',
                model: 'opus'
            },
            raw: `---
name: grimorio-finanzas
description: Patrones UI modulo Finanzas
model: opus
---

# Grimorio Finanzas

> Patrones extraidos del modulo **CoffeeSoft Finanzas**.

## Spells cubiertos

- \`conjure table\` — tabla con filtros, status badges, paginacion
- \`conjure detail\` — vista detalle con panel lateral
- \`conjure cards\` — dashboard con KPIs
- \`conjure form\` — formulario centrado
- \`conjure hub\` — pagina indice navegacion
- \`conjure modal\` — modales (form, confirmacion, selector)
- \`conjure selector\` — modal seleccion tipo grid

## Status badges

| Estatus | Clases |
|---|---|
| Pagado | \`bg-green-500/15 text-green-400 border border-green-500/30\` |
| Pendiente | \`bg-yellow-500/15 text-yellow-400 border border-yellow-500/30\` |
| Cancelado | \`bg-red-500/15 text-red-400 border border-red-500/30\` |
| Abierta | \`bg-blue-500/15 text-blue-400 border border-blue-500/30\` |

## Referencias

- \`finanzas-ingresos.html\`
- \`finanzas-compras.html\`
- \`finanzas-compras-detalle.html\`
- \`finanzas-index-navegacion.html\`
`
        },
        {
            name: 'grimorio-rrhh',
            file: 'grimorio-rrhh.md',
            section: 'grimorios',
            size: '42 KB',
            frontmatter: {
                name: 'grimorio-rrhh',
                description: 'Patrones UI del modulo CoffeeSoft RRHH (personal, nomina, asistencia)',
                model: 'opus'
            },
            raw: `---
name: grimorio-rrhh
description: Patrones UI modulo RRHH
model: opus
---

# Grimorio RRHH

> Patrones extraidos del modulo **CoffeeSoft RRHH**.

## Spells cubiertos

- \`conjure table\` — listado de personal con filtros
- \`conjure cards\` — KPIs (nomina, asistencia, vacaciones)
- \`conjure grid\` — grid de incidencias por semana
- \`conjure recibo\` — recibo de nomina
- \`conjure form\` — alta de empleado
- \`conjure modal\` — modales de permisos / vacaciones

## Status badges RRHH

| Estatus | Color |
|---|---|
| Activo | verde |
| Vacaciones | amarillo |
| Permiso | azul |
| Baja | rojo |
| Suspendido | gris |

## Badges de puesto

\`\`\`
purple : bg-purple-500/15 text-purple-400
blue   : bg-blue-500/15 text-blue-400
orange : bg-orange-500/15 text-orange-400
pink   : bg-pink-500/15 text-pink-400
\`\`\`

## Referencias

- \`rrhh-personal.html\`
- \`rrhh-nomina-recibo.html\`
- \`rrhh-incidencia-personalizado.html\`
- \`rrhh-permisos.html\`
- \`rrhh-resumen.html\`
`
        },
        {
            name: 'grimorio-huubie-ui',
            file: 'grimorio-huubie-ui.md',
            section: 'grimorios',
            size: '32 KB',
            frontmatter: {
                name: 'grimorio-huubie-ui',
                description: 'Sistema de diseno Huubie UI (.cs-* classes, dark unico, hub en coffee/ui/index.html)',
                model: 'opus'
            },
            raw: `---
name: grimorio-huubie-ui
description: Sistema de diseno Huubie UI
model: opus
---

# Grimorio Huubie UI

> Sistema de diseno **cerrado** con clases \`.cs-*\` declaradas en \`coffee/ui/css/ui-kit.css\`.
> Es dark **unico** (no light/dark toggle).

## Tokens principales

| Token | Valor |
|---|---|
| Fondo base | \`#111928\` |
| Fondo card | \`#1F2A37\` |
| Fondo header | \`#141d2b\` |
| Acento purpura | \`#7C3AED\` |
| Acento verde | \`#3FC189\` |
| Texto secundario | \`#9CA3AF\` |

## Spells cubiertos

- layout, navbar, sidebar
- table, form, modal
- badges (success/danger/warning/info/purple)
- toast, toggle, avatar
- pagination, empty, progress

## Clases canonicas

- \`.cs-card\`, \`.cs-card-hover\`
- \`.cs-input\`, \`.cs-input-group\`, \`.cs-input-group-icon\`
- \`.cs-select\`, \`.cs-textarea\`
- \`.cs-btn\` + \`-primary/-secondary/-success/-danger/-outline/-ghost\`
- \`.cs-badge\` + \`-success/-danger/-warning/-info/-purple\`
- \`.cs-tabs\` + \`.cs-tab\` (con \`.active\`)
- \`.cs-table\`
- \`.cs-scroll\` (scrollbar custom)

## Referencias

- Hub navegable: \`coffee/ui/index.html\`
- Doc maestro: \`app/ui/docs/grimorio-ui-kit.md\`
`
        }
    ]
};
