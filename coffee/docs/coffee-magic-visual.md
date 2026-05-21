# CoffeeMagic — Mapa visual

> Complemento grafico de [coffee-magic-guia.md](coffee-magic-guia.md). Aqui vive el "como funciona" en diagramas.

---

## Tabla de contenido

1. [Vista de 10,000 pies](#1-vista-de-10000-pies)
2. [Anatomia del agente](#2-anatomia-del-agente)
3. [Flujo de invocacion](#3-flujo-de-invocacion)
4. [Arbol de decision de tema](#4-arbol-de-decision-de-tema)
5. [Mapeo dominio → grimorio → spells](#5-mapeo-dominio--grimorio--spells)
6. [Catalogo visual de spells](#6-catalogo-visual-de-spells)
7. [Pipeline del spell `transmute`](#7-pipeline-del-spell-transmute)
8. [Estructura de salida](#8-estructura-de-salida)
9. [Ciclo de vida de una peticion](#9-ciclo-de-vida-de-una-peticion)
10. [Reglas siempre / nunca](#10-reglas-siempre--nunca)

---

## 1. Vista de 10,000 pies

```mermaid
flowchart LR
    U([Usuario]):::user -->|"/coffee-magic ..."| CC[Claude Code]:::cc
    CC -->|Agent tool<br/>subagent_type| CM(("CoffeeMagic<br/>opus")):::agent
    CM -->|Read| GR[(Grimorios .md)]:::data
    CM -->|Write| OUT[/HTML estatico<br/>+ JS modulo opcional/]:::out
    CM -->|Reporta| U

    classDef user fill:#1c64f2,stroke:#fff,color:#fff
    classDef cc fill:#1F2A37,stroke:#7c3aed,color:#fff
    classDef agent fill:#7c3aed,stroke:#fff,color:#fff
    classDef data fill:#0f172a,stroke:#9ca3af,color:#fff
    classDef out fill:#141d2b,stroke:#1c64f2,color:#fff
```

**Idea central:** CoffeeMagic es un sub-proceso especializado que lee grimorios, escribe HTML coherente y opcionalmente lo transmuta en modulo JS coffeeSoft.

---

## 2. Anatomia del agente

```mermaid
mindmap
  root((CoffeeMagic))
    Identidad
      Modelo opus
      Creado por Rosy
      Personalidad teatral
    Capacidades
      10 spells
      1 transmute
      4 sistemas de diseno
    Entradas
      Peticion natural
      Tema explicito
      HTML aprobado
    Salidas
      HTML autocontenido
      Modulo JS tripartita
      Hub navegacion
    Fuentes de verdad
      grimorio-finanzas
      grimorio-rrhh
      grimorio-huubie-ui
      grimorio-coffee-varoch
      grimorio-fuente
```

---

## 3. Flujo de invocacion

### Invocacion directa por usuario

```mermaid
sequenceDiagram
    actor U as Usuario
    participant CC as Claude Code
    participant CM as CoffeeMagic
    participant GR as Grimorio
    participant FS as Filesystem

    U->>CC: /coffee-magic conjura modulo X
    CC->>CM: Agent(subagent_type=CoffeeMagic, prompt)
    CM->>CM: Detecta dominio + tema + spells
    CM-->>U: Confirma plan (si hay ambiguedad)
    U-->>CM: OK
    CM->>GR: Read(grimorio correspondiente)
    GR-->>CM: snippets HTML aprobados
    CM->>FS: Write(HTMLs + hub + modals)
    FS-->>CM: archivos creados
    CM-->>U: Lista de "conjuros completados"
```

### Invocacion delegada desde otro agente

```mermaid
sequenceDiagram
    participant A as Agente padre
    participant CM as CoffeeMagic
    participant FS as Filesystem

    A->>CM: Agent(subagent_type, contexto completo)
    Note over CM: peticion + tema + dominio<br/>+ archivo destino + restricciones
    CM->>FS: Genera artefactos
    CM-->>A: Retorna paths generados
```

---

## 4. Arbol de decision de tema

```mermaid
flowchart TD
    START([Peticion del usuario]) --> Q1{"Menciona<br/>tema?"}
    Q1 -->|No| DARK[/"Dark base + light<br/>con toggle (default)"/]:::dark
    Q1 -->|Si| Q2{Cual?}
    Q2 -->|"huubie / .cs-* /<br/>coffee/ui/"| HUUBIE[/"Huubie UI<br/>dark unico .cs-*"/]:::huubie
    Q2 -->|"varoch / .cv-* /<br/>coffee/ui-kit/"| VAROCH[/"Coffee-Varoch<br/>light + dark .cv-*"/]:::varoch
    Q2 -->|"coffee clasico"| LIGHT[/"Light coffee<br/>paleta original"/]:::light

    classDef dark fill:#111928,stroke:#7c3aed,color:#fff
    classDef huubie fill:#1F2A37,stroke:#1c64f2,color:#fff
    classDef varoch fill:#003360,stroke:#F24444,color:#fff
    classDef light fill:#F2F5F9,stroke:#003360,color:#111
```

### Paletas en comparacion

```text
┌──────────────────────┬──────────────────────┬──────────────────────┐
│   DARK BASE          │   HUUBIE UI          │   COFFEE-VAROCH      │
├──────────────────────┼──────────────────────┼──────────────────────┤
│ bg-main   #111928    │ Dark unico           │ --cv-primary #003360 │
│ bg-card   #1F2A37    │ Clases .cs-*         │ --cv-secondary F24444│
│ bg-input  #1a2332    │ ui-kit.css           │ --cv-success  7AAB20 │
│ bg-header #141d2b    │ NO toggle            │ --cv-action   2563EB │
│ accent    #7c3aed    │ Hub coffee/ui/       │ Light+Dark con body  │
│ btn       #1c64f2    │                      │ class="coffee-varoch"│
└──────────────────────┴──────────────────────┴──────────────────────┘
```

---

## 5. Mapeo dominio → grimorio → spells

```mermaid
flowchart LR
    subgraph DOM[Dominios]
        D1[Finanzas<br/>ingresos/egresos/<br/>compras/bancos]
        D2[RRHH<br/>nomina/asistencia/<br/>vacaciones]
        D3[Huubie UI<br/>.cs-* / coffee/ui]
        D4[Coffee-Varoch<br/>.cv-* / coffee/ui-kit]
        D5[Transmute<br/>HTML aprobado]
    end

    subgraph GRI[Grimorios]
        G1[(grimorio-finanzas.md)]
        G2[(grimorio-rrhh.md)]
        G3[(grimorio-huubie-ui.md)]
        G4[(grimorio-coffee-varoch.md)]
        G5[(grimorio-fuente.md)]
    end

    subgraph SP[Spells]
        S1[table / detail / cards]
        S2[form / modal / selector]
        S3[hub / recibo / grid / sidebar]
        S4[transmute]
    end

    D1 --> G1 --> S1
    D1 --> G1 --> S2
    D2 --> G2 --> S1
    D2 --> G2 --> S3
    D3 --> G3 --> S2
    D3 --> G3 --> S3
    D4 --> G4 --> S1
    D4 --> G4 --> S3
    D5 --> G5 --> S4
```

### Resolucion de ubicacion del grimorio

```text
┌─────────────────────────────────────────────────────────────┐
│  1. Global del usuario                                      │
│     ~/.claude/agents/grimorios/[grimorio].md                │
│                          ↓ (si no existe)                   │
│  2. Local del proyecto                                      │
│     .claude/agents/grimorios/[grimorio].md                  │
│                          ↓ (si no existe)                   │
│  3. Fallback                                                │
│     Glob "**/grimorio-[nombre].md"                          │
└─────────────────────────────────────────────────────────────┘
```

---

## 6. Catalogo visual de spells

```text
┌─ 1. conjure table ────────────────┐  ┌─ 2. conjure detail ───────────────┐
│ ┌─────┬──────────────────────────┐│  │ ┌────────────┐ ┌──────────────┐  │
│ │     │ Header + filtros         ││  │ │            │ │ Panel detalle│  │
│ │ Sb  ├──────────────────────────┤│  │ │   Tabla    │ │  w-[420px]   │  │
│ │     │  ▣▣▣  Tabla sticky      ││  │ │ reducida   │ │  badges      │  │
│ │     │  ▣▣▣                    ││  │ │            │ │  grid k-v    │  │
│ │     │  Showing X-Y of Z       ││  │ │            │ │  footer btns │  │
│ └─────┴──────────────────────────┘│  │ └────────────┘ └──────────────┘  │
└───────────────────────────────────┘  └───────────────────────────────────┘

┌─ 3. conjure cards (dashboard) ────┐  ┌─ 4. conjure form ─────────────────┐
│ ┌─────┬──────────────────────────┐│  │       ┌────────────────────┐      │
│ │     │ ▢ KPI │ ▢ KPI │ ▢ KPI   ││  │       │ Label              │      │
│ │ Sb  ├──────────────────────────┤│  │       │ [ input.input-modal│      │
│ │     │ ▢ KPI │ ▢ KPI │ ▢ KPI   ││  │       │ Label              │      │
│ │     │ Chart.js + tabla resumen││  │       │ [ input            │      │
│ └─────┴──────────────────────────┘│  │       │  [Enviar][Cancelar]│      │
└───────────────────────────────────┘  └───────────────────────────────────┘

┌─ 5. conjure modal ────────────────┐  ┌─ 6. conjure selector ─────────────┐
│       ░░░░░ bg-black/60 ░░░░░     │  │     ┌────────────────────┐        │
│      ┌────────────────────┐       │  │     │ Titulo             │        │
│      │ Titulo        X    │       │  │     │ ┌────┐ ┌────┐      │        │
│      │ Contenido          │       │  │     │ │opc1│ │opc2│ grid │        │
│      │ ......             │       │  │     │ ├────┤ ├────┤      │        │
│      │ [Cancelar][Aceptar]│       │  │     │ │opc3│ │opc4│      │        │
│      └────────────────────┘       │  │     │     [Aceptar]      │        │
└───────────────────────────────────┘  └───────────────────────────────────┘

┌─ 7. conjure hub ──────────────────┐  ┌─ 8. conjure recibo ───────────────┐
│  Categoria A                      │  │  ┌──────────────────────────────┐ │
│  ┌──────┐ ┌──────┐ ┌──────┐       │  │  │  Logo    Recibo  #folio      │ │
│  │ card │ │ card │ │ card │       │  │  │  ─────────────────────────   │ │
│  └──────┘ └──────┘ └──────┘       │  │  │  Datos grid 2 cols           │ │
│  Categoria B                      │  │  │  ─────────────────────────   │ │
│  ┌──────┐ ┌──────┐                │  │  │  Tabla desglose              │ │
│  │ card │ │ card │                │  │  │  ─────────────────────────   │ │
│  └──────┘ └──────┘                │  │  │  Resumen     │ Items panel   │ │
└───────────────────────────────────┘  └──┴──────────────┴───────────────┘──┘

┌─ 9. conjure grid (calendario) ────┐  ┌─ 10. conjure sidebar ─────────────┐
│            01  02  03  04  05     │  │ ┌────────┐                       │
│  Empl A    ●   ●   ○   ●   ●      │  │ │  Logo  │                       │
│  Empl B    ○   ●   ●   ●   ○      │  │ ├────────┤                       │
│  Empl C    ●   ●   ●   ○   ●      │  │ │ ⬚ Menu │ w-56 (224px)          │
│  click → dropdown contextual      │  │ │ ⬚ Menu │ iconos SVG            │
│  dots de color por estado         │  │ │   ⬚ sub│ submenu expandible   │
│                                   │  │ ├────────┤                       │
│                                   │  │ │ ⚙ ⏻ 👤 │ footer                │
└───────────────────────────────────┘  │ └────────┘                       │
                                       └──────────────────────────────────┘
```

---

## 7. Pipeline del spell `transmute`

```mermaid
flowchart TD
    IN[/"HTML aprobado<br/>(fuente)"/]:::in --> READ1[Read pivote<br/>pos-entradas.js<br/>sample_entradas.js<br/>pos-entradas.php]:::step
    READ1 --> READ2[Read HTML fuente<br/>completo]:::step
    READ2 --> DETECT{Detecta tema}:::dec
    DETECT -->|".cs-* o paleta dark"| THUUBIE[Tema huubie]:::t
    DETECT -->|".cv-*"| TVAROCH[Tema varoch]:::t
    DETECT -->|"Tailwind generico"| TDARK[Dark base]:::t

    THUUBIE --> GREP[Grep coffeeSoft.js<br/>por cada componente]:::step
    TVAROCH --> GREP
    TDARK --> GREP

    GREP --> GEN1[/"{dir}/src/js/sample_{modulo}.js<br/>SAMPLE_*_DB + builders + TABLE"/]:::gen
    GEN1 --> GEN2[/"{dir}/src/js/{modulo}.js<br/>class App + Entidad + EntidadView"/]:::gen
    GEN2 --> GEN3[/"{dir}/{modulo}.php<br/>scripts en orden sample → modulo"/]:::gen
    GEN3 --> HUB{Hay hub?}:::dec
    HUB -->|Si| CARD[Clona class exacto<br/>de cards vecinas]:::step
    HUB -->|No| CHECK[node --check<br/>ambos JS]:::step
    CARD --> CHECK
    CHECK --> OUT[/"Modulo coffeeSoft<br/>materializado"/]:::out

    classDef in fill:#141d2b,stroke:#1c64f2,color:#fff
    classDef step fill:#1F2A37,stroke:#7c3aed,color:#fff
    classDef dec fill:#0f172a,stroke:#F24444,color:#fff
    classDef t fill:#003360,stroke:#fff,color:#fff
    classDef gen fill:#111928,stroke:#7AAB20,color:#fff
    classDef out fill:#7c3aed,stroke:#fff,color:#fff
```

### Sintaxis YAML del transmute

```text
       OBLIGATORIO              OPCIONAL (con default/auto-detect)
       ───────────────          ──────────────────────────────────
fuente:      [ruta HTML]   ──►  project:     [PascalCase] (se infiere)
modulo:      [kebab-case]  ──►  referencia:  [ruta JS pivote]
                                tema:        huubie|varoch|dark
                                hub:         [ruta HTML hub]
                                card_label:  [texto card]
                                card_icon:   [lucide icon]
```

---

## 8. Estructura de salida

```text
[nombre-modulo]/
│
├── templates/
│   │
│   ├── [modulo]-index-navegacion.html   ◄── HUB (siempre, si es modulo completo)
│   │
│   ├── [modulo]-[seccion].html          ◄── Templates principales
│   │      └─ ej: ingresos.html, egresos.html
│   │
│   ├── [modulo]-[seccion]-detalle.html  ◄── Vistas detalle (panel lateral)
│   │      └─ ej: ingresos-detalle.html
│   │
│   └── modals/                          ◄── Modales aislados
│       ├── modal-nuevo-registro.html
│       ├── modal-confirmacion.html
│       └── modal-[selector].html
│
└── (si paso por transmute)
    │
    ├── src/js/
    │   ├── sample_[modulo].js           ◄── helpers + SAMPLE_*_DB + builders
    │   └── [modulo].js                  ◄── App + Entidad + EntidadView
    │
    └── [modulo].php                     ◄── entry-point (sample antes que modulo)
```

---

## 9. Ciclo de vida de una peticion

```mermaid
stateDiagram-v2
    [*] --> Recibe: /coffee-magic ...
    Recibe --> Detecta: parsea peticion
    Detecta --> Confirma: dominio + tema + spells
    Confirma --> Confirma: pregunta si hay ambiguedad
    Confirma --> CargaGrimorio: usuario confirma
    CargaGrimorio --> IdentificaSpells: lee snippets
    IdentificaSpells --> ListaArchivos: declara que va a generar
    ListaArchivos --> GeneraHTML: por cada spell
    GeneraHTML --> GeneraHub: si es modulo completo
    GeneraHub --> Reporta: "conjuros completados"
    Reporta --> Transmute: opt-in HTML → JS
    Transmute --> [*]
    Reporta --> [*]: usuario no transmuta
```

---

## 10. Reglas siempre / nunca

```text
┌────────────────────────── SIEMPRE ──────────────────────────┐
│ ✓  Tailwind via CDN + Inter (Google Fonts)                  │
│ ✓  HTML autocontenido (cada archivo standalone)             │
│ ✓  Hub index-navegacion.html cuando es modulo completo      │
│ ✓  Modales en subcarpeta modals/                            │
│ ✓  Sidebar + header + subheader consistentes                │
│ ✓  Tablas con sticky thead + hover states                   │
│ ✓  Badges patron bg-[color]-500/15 text-[color]-400         │
│ ✓  Tablas en light: fondo blanco #ffffff aunque body sea gris│
│ ✓  Sin tema mencionado → light + dark con toggle            │
└─────────────────────────────────────────────────────────────┘

┌────────────────────────── NUNCA ────────────────────────────┐
│ ✗  JS funcional mas alla de theme toggle / window.close()   │
│ ✗  Backend (PHP, APIs) — son demos estaticos                │
│ ✗  Inferir tema/dominio si hay ambiguedad — confirma primero│
│ ✗  Banners `// ════` ni descriptores `// Clase: X hace Y`   │
│ ✗  Tildes en strings de codigo                              │
│ ✗  Mezclar Huubie UI con Coffee-Varoch sin pedido explicito │
└─────────────────────────────────────────────────────────────┘

┌─────────────── REGLAS EXCLUSIVAS DE `transmute` ────────────┐
│ ✓  Lectura COMPLETA del pivote antes de transmutir          │
│ ✓  Grep en coffeeSoft.js por cada componente local          │
│ ✓  SAMPLE_* al top del archivo sample                       │
│ ✓  .php carga sample ANTES del modulo principal             │
│ ✓  node --check pasa en ambos JS sin errores                │
└─────────────────────────────────────────────────────────────┘
```

---

## Leyenda de simbolos

| Simbolo | Significado |
|---|---|
| `(())` | Agente / proceso vivo |
| `[/  /]` | Entrada o salida (datos / archivos) |
| `[( )]` | Almacen de datos (grimorio, BD) |
| `{ }` | Decision |
| `[ ]` | Paso o estado |
| `►` / `→` | Flujo direccional |
| `▣` | Filas de tabla |
| `▢` | Card / KPI |
| `●` / `○` | Estado activo / inactivo en grid |
| `░░` | Overlay translucido |

---

> *"Los diagramas son los hechizos visualizados — sin ellos, el grimorio es solo tinta dormida."* — ✨☕ 🌹
