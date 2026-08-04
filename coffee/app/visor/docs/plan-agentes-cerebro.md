# Plan — Agentes, Reglas y Memoria en `coffee/app`

> **Origen del análisis:** `ERP-GV/DEV/avatars/` (módulo canónico) + `ERP-GV/DEV/conf/_AvatarBrain.php`, `_Autonomy.php`, `_AgentDelegate.php`.
> **Destino:** `huubie/coffee/app/` (visor · CoffeeIA · Playground · Forge · Studio).
> **Fecha:** 2026-08-04
> **Estado:** fases 0-5 **implementadas y verificadas en local** (2026-08-04). Ver §12.

---

## 1. Qué construyó `avatars` (las cuatro piezas)

`avatars` no es "un chat con prompt". Es un **registro de agentes con cerebro**, y el cerebro
son cuatro piezas que se sostienen entre sí:

### 1.1 El agente — tabla `avatars` (12 filas reales)

```
avatars(id, name, img, description, tags, prompt_system, soul,
        suggested_model, assistant_id, tools, examples, active, date_creation)
```

La identidad no vive en un archivo: vive en una fila. `prompt_system` es el contrato de
trabajo; `soul` es la personalidad y se **concatena aparte** en runtime
(`ctrl-avatar.php:48`, sección `## Personalidad`), de modo que se puede editar el tono sin
tocar las reglas técnicas. `suggested_model` ata cada agente a su modelo natural
(`coffeeIA → gpt-4.1`, `CoffeeMagic! → glm-5.2:cloud`).

### 1.2 Las reglas — `avatar_knowledge` + `avatar_knowledge_share` (29 filas reales)

```
avatar_knowledge(id, avatar_id, name, description, tags, content, when_to_use,
                 rules, examples, evals, priority, weight, flexibility, recovery,
                 auto_summary, active, date_creation, date_update)
UNIQUE (avatar_id, name)
```

**La decisión que hace que todo esto valga la pena:** al system prompt **no viaja el
contenido**, solo un índice de una línea por archivo:

```
## Archivos de reglas (léelos con read_rules)
- CTRL.md — convenciones del controlador · cuándo: antes de escribir un ctrl-*.php
- FRONT JS.md — ciclo de vida init/render/layout · cuándo: al generar JS de módulo
...
```

El agente lee el que necesita, cuando lo necesita, con la tool `read_rules(name, offset?, limit?)`
— paginada, con tope de 24 000 chars por lectura (`BRAIN_RULES_READ_CAP`). Exactamente el
patrón de Claude Code leyendo un steering antes de codear.

`avatar_knowledge_share` da lectura del mismo archivo a otros agentes **sin duplicar la
fila**: hay un dueño, editarlo alcanza a todos. Si un nombre choca, gana el propio.

### 1.3 La memoria — `avatar_memories` (10 filas reales)

```
avatar_memories(id, avatar VARCHAR(150), user_id, content VARCHAR(600), date_creation)
```

Por **(agente, usuario)**. El agente la auto-gestiona con `save_memory` / `forget_memory`;
las últimas 40 se inyectan al prompt cada turno como `- [id] contenido`, con el id visible
para que pueda borrar la que quedó obsoleta. Tope 100 por agente+usuario, 500 chars cada una.

Memorias reales guardadas por los agentes, sin que nadie las escribiera a mano:

```
CoffeeMagic!/3: No utilices emojis, debes usar lucide icons
Coffee IA/3:    El módulo kpi/marketing/anuncios ya tiene un motor KPI V3 en BD…
coffee_magic/2: solo invoca las tools de archivos cuando el usuario te lo indique
```

### 1.4 El cableado — `tools` + `avatar_tools` (24 tools, 88 asignaciones)

El cerebro **solo se enciende si las tools están asignadas al agente**. `_Autonomy.php`
mira los schemas que llegan en el request: si ve `read_rules`, inyecta el índice; si ve
`save_memory`, inyecta las memorias. Sin asignación, el prompt queda como antes. Nada es
implícito, y eso es lo que lo hace seguro de portar.

Más tools del mismo registro: `write_rule` (el agente mejora sus propias reglas),
`ask_agent` (delega a otro agente), `read_error_logs`, `sqlite_query`, `todo_propose`.

---

## 2. Dónde está hoy `coffee/app` y cuál es el hueco

| Pieza | `avatars` | `coffee/app` hoy |
|---|---|---|
| **Agente** | Fila en BD: prompt + alma + imagen + modelo + tools | Archivo `.md` en `~/.claude/agents/`, **3 hardcodeados** en `tools_agents_catalog()` (tools-registry.php:49) |
| **Tools por agente** | Pivote `avatar_tools` | ✅ Ya existe: columna `tools.agents` (CSV) en `data/tools.sqlite` |
| **Reglas** | Índice en prompt + `read_rules` on-demand | Grimorios `.md` marcados a mano → **se inyectan completos** cada turno (`playground.js:1945`, `pinnedFiles`) |
| **Compartir reglas** | `avatar_knowledge_share` | No aplica (son archivos sueltos) |
| **Memoria** | `avatar_memories` + 2 tools + inyección | **No existe** |
| **Evals de una regla** | `avatar_knowledge.evals` (casos + score) | No existe |
| **Delegar a otro agente** | `ask_agent` | No existe |
| **Registro de tools** | MySQL `tools` + catálogo builtin/HTTP | ✅ Ya existe y es **mejor**: `tools.sqlite` con builtin + HTTP del usuario + alcance por superficie |

### El costo real del hueco, en números

Los archivos que hoy se inyectan enteros:

| Archivo | chars | ≈ tokens |
|---|---:|---:|
| `CoffeeMagic.md` (system prompt) | 41 216 | 10 300 |
| `grimorios/grimorio-coffee-varoch.md` | 100 024 | 25 000 |
| `grimorios/grimorio-huubie-ui.md` | 21 186 | 5 300 |
| **Playground: CoffeeMagic + grimorio Varoch** | **141 240** | **≈ 35 000** |

Son 35 000 tokens de prompt **fijo, en cada turno**, antes de que el usuario escriba nada —
y el modelo los relee completos en cada ronda de herramientas. Con el modelo de `avatars`
el mismo contexto queda en **~120 tokens de índice**, y el agente paga solo por el archivo
que efectivamente abrió (tope 6 000 tokens por lectura).

Ese es el argumento central de este plan. La memoria y el compartir son la consecuencia
natural de tener el registro; el ahorro de contexto es el motivo.

---

## 3. Decisiones de arquitectura

Ocho decisiones, cada una con su porqué. Son el corazón de la propuesta: si alguna no
convence, cambia el diseño.

### D1 — SQLite, no MySQL

`avatars` vive en `rfwsmqex_avatars` (MySQL compartida con el ERP). `coffee/app` es
autocontenido: `data/chats.sqlite`, `prefs.sqlite`, `tools.sqlite`, `auth.sqlite`,
`pg-threads.sqlite`. **Se crea `data/agents.sqlite`** con el mismo patrón: esquema al vuelo
en la primera conexión, `PRAGMA journal_mode = WAL`, migraciones por `PRAGMA table_info`.
Cero dependencias nuevas, cero credenciales.

### D2 — El `.md` deja de ser la fuente de verdad, pero sigue siendo el origen

Hoy `agentKey` es literalmente `'CoffeeIA.md'`, y ese string está guardado en
`tools.agents` (CSV) y en `chats.doc` (el agente de cada conversación viaja ahí,
`coffeeia.js:2057`). **La columna `agent_key` conserva ese valor exacto** — nada que migrar,
nada que romper.

Los `.md` se **importan** una vez (seed) a `agents.prompt_system`, guardando `source_file` y
`source_mtime`. Después la BD manda. Si el `.md` cambia en disco, la ficha del agente muestra
"el archivo de origen cambió" con un botón **Recargar del archivo** — nunca pisa solo.

### D3 — No se crea un pivote de tools: ya existe

`tools.agents` (CSV en `tools.sqlite`) hace lo mismo que `avatar_tools`, con la ventaja de
que vacío significa "todos". Lo único que cambia: `tools_agents_catalog()` deja de devolver
las 3 constantes y lee de `agents.sqlite` (con el hardcode como respaldo si la tabla está
vacía).

### D4 — Las tools del cerebro son builtin con `source = 'brain'`

`read_rules`, `save_memory`, `forget_memory`, `write_rule`, `ask_agent` entran al catálogo
existente como builtin (`tools_builtin_catalog()`), con su spec en el código
(`agent-tools.php`) y su despacho en `tools_run()`. Aparecen en Configuración →
Herramientas como cualquier otra: se activan, se desactivan y se asignan por agente.
**Ni un endpoint paralelo ni un segundo registro.**

### D5 — El cerebro se anexa, nunca sustituye

`brain_prompt_extra()` se llama en `coffeeia_build_context()` **después** de resolver
`$systemPrompt` (venga del `.md`, de `coffee-system.md` o de `systemOverride`) y se
concatena. El Playground, donde el usuario edita el prompt en vivo y lo manda como
`systemOverride`, sigue funcionando igual: su prompt gana, y el bloque de memoria + índice
se le suma. Cambio estrictamente aditivo.

### D6 — El cerebro NO fuerza el loop agéntico (y esto importa)

En `coffee/app`, entrar al loop de herramientas **apaga el streaming de tokens**: el turno
emite eventos de estado y luego el texto completo (`ctrl-coffeeia-stream.php:289`). Por eso
`fetch_url` está deliberadamente fuera de `tools_has_standalone()`.

Si `read_rules` entrara ahí, **todo chat con un agente con reglas perdería el streaming**.
Regla propuesta:

- El **índice** y las **memorias** viajan siempre en el prompt: son texto, no cuestan un loop,
  y son el 80 % del valor. El streaming queda intacto.
- `read_rules` / `save_memory` se **declaran** cuando ya hay otro motivo para el loop
  (carpeta conectada, base conectada, tools HTTP propias).
- Para quien quiera el loop siempre: interruptor por agente `brain_standalone` (default 0).

### D7 — Se recortan los campos que `avatars` guarda pero no usa

`weight`, `flexibility`, `recovery`, `auto_summary` existen en `avatar_knowledge` "para la
etapa de vectores" y **ningún código los lee**. No se portan. Sí se portan
`when_to_use` y `priority`, que sí son runtime (arman el índice y su orden).

### D8 — Una sola página nueva

`avatars` reparte esto entre `index.php` (wizard), `playground.php` y `rules.php`.
`coffee/app` ya tiene cinco páginas (visor, coffeeia, playground, forge, studio) y no
necesita tres más: **`agents.php`**, rail de agentes a la izquierda + panel con pestañas a la
derecha. Entra al launcher junto a TODO y Drive.

---

## 4. Diseño de datos — `data/agents.sqlite`

Convenciones de la casa: FKs (`*_id`) al final, después de `active` y los timestamps;
`date_creation` / `date_update` como en `tools.sqlite`.

```sql
-- El agente. `agent_key` conserva el nombre del .md para no romper tools.agents ni chats.doc.
CREATE TABLE agents (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_key     TEXT NOT NULL UNIQUE,              -- 'CoffeeIA.md'
    name          TEXT NOT NULL,                     -- 'CoffeeIA'
    description   TEXT NOT NULL DEFAULT '',
    tags          TEXT NOT NULL DEFAULT '[]',
    img           TEXT NOT NULL DEFAULT '',
    prompt_system TEXT NOT NULL DEFAULT '',
    soul          TEXT NOT NULL DEFAULT '',          -- personalidad; se anexa como "## Personalidad"
    render        TEXT NOT NULL DEFAULT 'markdown',  -- markdown | html | code (ya lo usa PG_AGENTS)
    model         TEXT NOT NULL DEFAULT '',          -- modelo sugerido
    source_file   TEXT NOT NULL DEFAULT '',          -- .md de origen (para "recargar del archivo")
    source_mtime  TEXT NOT NULL DEFAULT '',
    brain_standalone INTEGER NOT NULL DEFAULT 0,     -- 1 = declara read_rules aunque no haya conexiones (ver D6)
    active        INTEGER NOT NULL DEFAULT 1,
    date_creation TEXT NOT NULL,
    date_update   TEXT NOT NULL
);

-- Un archivo de reglas. El contenido NO viaja al prompt: solo name/description/when_to_use.
CREATE TABLE agent_knowledge (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    name          TEXT NOT NULL,                     -- 'CTRL.md'
    description   TEXT NOT NULL DEFAULT '',
    tags          TEXT NOT NULL DEFAULT '[]',
    content       TEXT NOT NULL DEFAULT '',
    when_to_use   TEXT NOT NULL DEFAULT '',          -- runtime: entra al índice del prompt
    rules         TEXT NOT NULL DEFAULT '[]',        -- JSON: viñetas extraídas, para el editor
    examples      TEXT NOT NULL DEFAULT '[]',        -- JSON: pares input→output
    evals         TEXT NOT NULL DEFAULT '[]',        -- JSON: banco de casos (fase 5)
    priority      TEXT NOT NULL DEFAULT 'medium',    -- critical | high | medium | low (ordena el índice)
    source_file   TEXT NOT NULL DEFAULT '',
    active        INTEGER NOT NULL DEFAULT 1,
    date_creation TEXT NOT NULL,
    date_update   TEXT NOT NULL,
    agent_id      INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    UNIQUE (agent_id, name)
);

-- Lectura del archivo de otro agente. El dueño sigue siendo agent_knowledge.agent_id.
CREATE TABLE agent_knowledge_share (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    date_creation TEXT NOT NULL,
    knowledge_id  INTEGER NOT NULL REFERENCES agent_knowledge(id) ON DELETE CASCADE,
    agent_id      INTEGER NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
    UNIQUE (knowledge_id, agent_id)
);

-- Memoria persistente por (agente, usuario). agent_key y no agent_id: el runtime
-- solo conoce la clave que viene en el payload, igual que _AvatarBrain.
CREATE TABLE agent_memories (
    id            INTEGER PRIMARY KEY AUTOINCREMENT,
    agent_key     TEXT NOT NULL,
    user_id       TEXT NOT NULL DEFAULT '',          -- $_SESSION['user_id'], '' = invitado (como chats/prefs)
    content       TEXT NOT NULL,
    date_creation TEXT NOT NULL
);
CREATE INDEX idx_memories_agent_user ON agent_memories (agent_key, user_id);
```

**Topes** (constantes en `agent-brain.php`, calcadas de `_AvatarBrain.php` porque están bien
calibradas): 100 memorias por agente+usuario · 500 chars por memoria · 40 memorias al prompt ·
24 000 chars por lectura de `read_rules` · 20 000 chars por archivo escrito con `write_rule`.

### Seed inicial (una vez, idempotente)

| Origen | Destino |
|---|---|
| `~/.claude/agents/CoffeeIA.md` (32 KB) | `agents` → `CoffeeIA.md` |
| `~/.claude/agents/CoffeeMagic.md` (41 KB) | `agents` → `CoffeeMagic.md` |
| `~/.claude/agents/coffee-intelligence.md` (34 KB) | `agents` → `coffee-intelligence.md` |
| `~/.claude/agents/grimorios/*.md` (7 archivos, 246 KB) | `agent_knowledge` + `agent_knowledge_share` |

Los grimorios de diseño (`grimorio-huubie-ui`, `grimorio-coffeesoft`, `grimorio-coffee-varoch`)
se cuelgan de CoffeeMagic y se **comparten** con CoffeeIA; `db-rules.md` va a
coffee-intelligence. Es exactamente el reparto que hoy se hace a mano con checkboxes.

---

## 5. Diseño del runtime — cómo cambia un turno

```
coffeeia-context.php  ──┐
                        │  1. resuelve $systemPrompt (.md | coffee-system.md | systemOverride)
                        │  2. + modos (editor / lienzo / gráfica)
                        │  3. + systemExtra del front
   NUEVO ──────────────▶│  4. + brain_prompt_extra($agentKey, $userId, $hasRules, $hasMemory)
                        │       ├─ ## Memoria persistente     (últimas 40, con [id])
                        │       └─ ## Archivos de reglas      (índice: name — description · cuándo)
                        └─▶ messages[]

tools-registry.php    ──┐
                        │  tools_for_turn(sources, surface, agent)
   NUEVO ──────────────▶│  + source 'brain' → read_rules, save_memory, forget_memory,
                        │                     write_rule, ask_agent
                        └─▶ specs[] para el loop

coffeeia_run_tool_loop ──▶ tools_run('read_rules', …) ──▶ agent-brain.php ──▶ agents.sqlite
```

Tres archivos tocados, todos de forma aditiva:

| Archivo | Cambio |
|---|---|
| `ctrl/coffeeia-context.php` | 4 líneas: llamar `brain_prompt_extra()` y concatenar |
| `ctrl/tools-registry.php` | añadir las 5 builtin al catálogo, su spec y su rama en `tools_run()`; `tools_agents_catalog()` lee de la BD |
| `ctrl/ctrl-coffeeia*.php` | ninguno — el loop ya es genérico |

### El bloque que se anexa al prompt

```
## Memoria persistente
Hechos guardados en conversaciones anteriores con este usuario:
- [7] El usuario prefiere tablas con createCoffeTable
- [9] No usar emojis en módulos: iconos lucide
Guarda hechos nuevos con save_memory; borra los obsoletos con forget_memory usando el id.

## Archivos de reglas (léelos con read_rules)
- grimorio-huubie-ui.md — sistema .cs-* dark de Huubie · cuándo: al generar UI de Huubie
- grimorio-coffee-varoch.md — paleta institucional GV · cuándo: al generar UI de Grupo Varoch
- db-rules.md — convenciones de base de datos
Antes de escribir código regulado por alguno de estos archivos, léelo con read_rules.
```

**~120 tokens** contra los ~35 000 de hoy.

---

## 6. Diseño de la UI — `agents.php`

Página hermana de `playground.php` / `forge.php` / `studio.php`: mismo `<head>`, mismo
`ui-kit.css` + `visor.css`, tema dark de Huubie, launcher incluido. Prefijo de clases `agt-*`.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ☕ Agentes                              [⊞ apps]  [+ Nuevo agente]  [◐]     │
├──────────────────┬──────────────────────────────────────────────────────────┤
│  AGENTES         │  CoffeeMagic                            ● activo         │
│                  │  Templates y UI · glm-5.2:cloud                          │
│ ▸ ◉ CoffeeIA     │  ┌────────────────────────────────────────────────────┐  │
│     12 reglas    │  │ Identidad │ Prompt │ Alma │ Reglas │ Memoria │ 🔧 │  │
│     3 memorias   │  └────────────────────────────────────────────────────┘  │
│                  │                                                          │
│ ▸ ◉ CoffeeMagic  │   REGLAS                        [↑ Subir .md] [+ Nueva]  │
│     14 reglas ←  │   ┌──────────────────────────────────────────────────┐   │
│     2 memorias   │   │ 📄 blue-print-ui.md          11.0 KB  [alta]  ⋯ │   │
│                  │   │    Blueprint de UI · 2.7k tokens      ●compartida│   │
│ ▸ ◉ CoffeeIntel  │   ├──────────────────────────────────────────────────┤   │
│     3 reglas     │   │ 📄 transmute.md              12.4 KB  [alta]  ⋯ │   │
│                  │   └──────────────────────────────────────────────────┘   │
│ ──────────────   │                                                          │
│  Índice: 340 tok │   COMPARTIDAS CONMIGO                                    │
│  Reglas: 246 KB  │   │ 📄 db-rules.md   de CoffeeIntelligence   solo lectura│
└──────────────────┴──────────────────────────────────────────────────────────┘
```

**Pestañas del panel:**

| Pestaña | Contenido |
|---|---|
| **Identidad** | nombre, clave, descripción, imagen, tags, modelo sugerido, render, activo, origen (`.md` + "recargar del archivo" si cambió) |
| **Prompt** | editor del `prompt_system` con resaltado markdown y contador de tokens |
| **Alma** | editor del `soul` (personalidad), corto |
| **Reglas** | explorador de archivos + editor **Pulir** (Contenido · Cuándo usar + prioridad · Ejemplos · Evals) + compartir |
| **Memoria** | lista con `[id]`, contenido y fecha; olvidar por fila; alta manual; contador N/100 |
| **Herramientas** | checkboxes contra `tools.sqlite` (escribe el CSV `tools.agents`) + interruptor `brain_standalone` |

El editor **Pulir** es la pieza con más trabajo: se porta de `rules.js` (3 148 líneas) el
resaltado markdown detrás del textarea, el contador de tokens y el subir/arrastrar `.md`.

**Barra de presupuesto** (abajo del rail, no existe en `avatars` y aquí sí hace falta): cuánto
pesa el índice que sí viaja vs. cuánto queda on-demand. Es el marcador que justifica el cambio.

---

## 7. Cómo queda `coffee/app`

```
coffee/app/
├── ctrl/                          auth (sin cambios)
├── credentials/                   .env, tokens (sin cambios)
├── data/
│   ├── auth.sqlite
│   ├── chats.sqlite
│   ├── prefs.sqlite
│   ├── tools.sqlite               ← tools_agents_catalog() ahora lee agents.sqlite
│   └── … 
└── visor/
    ├── index.php  coffeeia.php  playground.php  forge.php  studio.php
    ├── agents.php                                              ★ NUEVA
    ├── data/
    │   └── agents.sqlite                                       ★ NUEVA
    ├── ctrl/
    │   ├── coffeeia-context.php   ← + brain_prompt_extra()     ◆ tocado
    │   ├── tools-registry.php     ← + source 'brain'           ◆ tocado
    │   ├── agents-registry.php                                 ★ NUEVO  esquema + seed + lectura
    │   ├── agent-brain.php                                     ★ NUEVO  runtime (gemelo de _AvatarBrain)
    │   ├── agent-tools.php                                     ★ NUEVO  specs de las 5 tools
    │   ├── ctrl-agents.php                                     ★ NUEVO  API: agentes
    │   ├── ctrl-agent-rules.php                                ★ NUEVO  API: reglas + compartir + evals
    │   └── ctrl-agent-memory.php                               ★ NUEVO  API: memorias
    ├── src/js/
    │   ├── agents.js                                           ★ NUEVO  hub + pestañas
    │   ├── agent-rules.js                                      ★ NUEVO  explorador + Pulir
    │   ├── agents-store.js                                     ★ NUEVO  cache cliente (gemelo de tools-config.js)
    │   ├── coffeeia.js            ← agentes de la BD, no del .md   ◆ tocado
    │   └── playground.js          ← ídem + grimorios como reglas   ◆ tocado
    ├── src/css/
    │   ├── agents.css                                          ★ NUEVO
    │   └── agent-rules.css                                     ★ NUEVO
    └── partials/launcher.php      ← + celda "Agentes"          ◆ tocado
```

**9 archivos nuevos · 6 tocados · 0 eliminados.** Nada de lo existente cambia de
comportamiento mientras `agents.sqlite` esté vacía: todos los puntos de entrada tienen
respaldo al camino actual.

---

## 8. Plan por fases

| # | Fase | Entregable | Verificación |
|---|---|---|---|
| **0** | **Registro** | `agents-registry.php` + `agents.sqlite` + seed de los 3 `.md` y 7 grimorios | `SELECT` devuelve 3 agentes y 7 reglas; `tools_agents_catalog()` los lista; el chat sigue igual |
| **1** | **Cerebro (lectura)** | `agent-brain.php` con `brain_prompt_extra()`; índice + memorias al prompt | El prompt de CoffeeMagic incluye el índice; el turno **conserva el streaming** |
| **2** | **Tools del cerebro** | `read_rules` + `save_memory` + `forget_memory` como builtin `source='brain'` | Con carpeta conectada, el agente lee `grimorio-huubie-ui.md` y genera con las clases correctas |
| **3** | **UI Agentes** | `agents.php` + rail + pestañas Identidad/Prompt/Alma/Herramientas | Editar el prompt desde la UI cambia la respuesta del chat |
| **4** | **UI Reglas** | Explorador + Pulir + subir `.md` + compartir | Subir un `.md` → aparece en el índice → el agente lo lee |
| **5** | **UI Memoria** | Lista + olvidar + alta manual | El agente guarda solo; la memoria aparece en el turno siguiente |
| **6** | **Migrar el Playground** | Los checkboxes de grimorios pasan a ser reglas del agente | Un turno de Playground baja de ~35k a ~5k tokens de prompt |
| **7** | **Extras** | `write_rule` · `ask_agent` · evals con juez | El agente mejora su propia regla; delega a otro |

Las fases 0-2 ya entregan el valor completo (ahorro de contexto + memoria) **sin una sola
pantalla nueva**. Las 3-5 son la interfaz para administrarlo. La 6 es la que cobra el ahorro.
La 7 es opcional.

---

## 9. Riesgos y cosas que hay que decidir

1. **Streaming vs. loop agéntico (D6).** El riesgo real de este plan. La propuesta protege el
   streaming por defecto; si se prefiere que `read_rules` esté siempre disponible, hay que
   aceptar que los chats con agente pierdan el token-por-token.
2. **`brain_prompt_extra` corre en cada turno** y toca SQLite dos veces (memorias + índice).
   Con WAL y estas cardinalidades es despreciable, pero conviene medirlo en la fase 1.
3. **Doble fuente de verdad con los `.md`.** Mientras Claude Code siga leyendo
   `~/.claude/agents/`, el mismo agente vivirá en dos sitios. `source_file` + "recargar del
   archivo" lo hace explícito, no lo elimina. Alternativa descartada: que `coffee/app` escriba
   de vuelta al `.md` (rompería el archivo que usa Claude Code).
4. **Memoria de invitado.** `user_id = ''` cuando no hay sesión, igual que chats y prefs: las
   memorias de todos los invitados se mezclan. Aceptable en local; a revisar si se publica.
5. **A decidir:** ¿los grimorios se copian a la BD (una copia que diverge del `.md`) o se
   guardan por referencia leyendo el archivo al vuelo? La propuesta dice **copiar** (es lo que
   hace `avatars`, y permite editarlos desde la UI); por referencia sería más limpio pero
   perdería el editor.

---

## 10. Evidencia empírica — qué tan bien funciona esto en `avatars`

No hace falta especular: `rfwsmqex_avatars.tool_logs` tiene **4 447 llamadas reales** entre el
2026-07-19 y el 2026-08-04. Esto es lo que dicen.

### 10.1 El patrón `read_rules` SÍ funciona, y no solo con Claude

```
read_rules      310 llamadas   25 errores (8%)   avg 4 ms
  CoffeeMagic!  233   ollama
  Coffee IA      27   ollama
  coffee_inteligence 25 ollama
  coffee_magic   24   ollama
  coffeeIA        1   chatgpt
```

**309 de 310 lecturas las hizo un modelo de Ollama Cloud** (glm-5.2 / kimi), no un Claude. El
riesgo de "esto funciona en Claude Code pero un modelo mediano no va a leer sus reglas" queda
descartado con 9 días de uso real.

### 10.2 Lee al arrancar la tarea, no a cada rato — y así debe ser

`read_rules` es el **3-18 %** de las llamadas de un día, y hay 4 días con 0 %. Visto de cerca no
es abandono: son **26 lecturas por día activo** de CoffeeMagic!, es decir, abre 2-3 archivos al
empezar una tarea y después trabaja (1 237 `read_file`, 525 `write_file`, 454 `edit_file`).
Ese es exactamente el comportamiento que se busca. Los días con 0 % son sesiones cortas o
tareas que no tocaban código regulado.

### 10.3 El único defecto real del original: los nombres

Los 25 errores de `read_rules` tienen **una sola causa**, y es trivial:

```
'transmute'                   ← el archivo es 'transmute.md'
'transmute-pivote-backend'    ← 'transmute-pivote-backend.md'
'blue-print-ui'               ← 'blue-print-ui.md'
'CTRL.md'                     ← ese archivo es de otro agente
```

El modelo suelta la extensión. `_AvatarBrain::getKnowledgeContent()` hace `LOWER(name) = LOWER(?)`
exacto y falla. **Se arregla en la implementación de Huubie desde el día 1**: resolver también sin
extensión y por prefijo único, y devolver siempre `archivos_disponibles` en el error. El 8 % de
fallo baja a ~1 %.

### 10.4 La memoria automática es la parte débil — hay que decirlo

```
save_memory      10 llamadas    forget_memory   2
```

Diez memorias guardadas en dos semanas, contra 310 lecturas de reglas. **El modelo casi nunca
decide guardar por su cuenta.** Las 10 que guardó son buenas ("no usar emojis, usar lucide"),
pero esperar que la memoria se llene sola es ilusión.

Consecuencia para el plan: la memoria se **siembra desde la UI** (fase 5 sube de prioridad) y
`save_memory` es el complemento, no el motor. El valor está en que las memorias *se inyecten*,
no en que el agente las escriba.

### 10.5 `ask_agent` no vale la pena

```
ask_agent   7 llamadas   2 errores   avg 49 139 ms
```

**49 segundos de promedio** por delegación. Se descarta de la fase 7.

### 10.6 Un hueco que abre la decisión D6

Si `read_rules` solo se declara cuando hay carpeta o base conectada, un chat suelto verá el
índice de reglas **sin poder abrirlas** — el agente sabe que existen y no las alcanza. Peor que
no tenerlas.

Ajuste al plan: `brain_prompt_extra()` **no emite el índice si `read_rules` no está declarada en
ese turno**. Y para el chat sin conexiones, opción de inyectar completas solo las reglas
`priority = 'critical'` (en el reparto propuesto son 2 archivos, ~14 KB), que es el
comportamiento de hoy pero acotado.

---

## 11. Lo que NO se porta de `avatars`, y por qué

| Pieza | Motivo |
|---|---|
| `ask_agent` (delegación entre agentes) | 49 s por llamada en uso real (§10.5) |
| `weight` / `flexibility` / `recovery` / `auto_summary` | Se guardan pero ningún código los lee (D7) |
| `assistant_id` (OpenAI Assistants) | `coffee/app` usa OpenRouter/Ollama, no Assistants |
| `db_connections` + `_BridgeGuard` | `coffee/app` ya tiene su propio `db-introspect.php` con `run_select` de solo lectura |
| `_Workspace.php` (workspace de archivos por conversación) | Ya resuelto por Forge y Studio |
| Tabla `models` | Ya resuelto por `model-config.js` + `coffeeia:global:modelCatalog` |
| Tabla `users` propia de avatars | `coffee/app` tiene `auth.sqlite` |

---

## 12. Estado de la implementación (2026-08-04)

Fases 0-5 construidas y probadas contra un modelo vivo (glm-5.2:cloud vía Ollama Cloud).

### 12.1 Archivos

| Archivo | Estado |
|---|---|
| `ctrl/agents-registry.php` | nuevo — esquema, seed, lectura, presupuesto |
| `ctrl/agent-brain.php` | nuevo — índice, memoria, `read_rules`/`save_memory`/`forget_memory`/`write_rule` |
| `ctrl/agent-tools.php` | nuevo — specs y apariencia de las 4 builtin |
| `ctrl/ctrl-agents.php` | nuevo — API de agentes, reglas y memoria |
| `agents.php` · `src/js/agents.js` · `src/css/agents.css` | nuevos — la pantalla |
| `ctrl/tools-registry.php` | tocado — source `brain`, catálogo desde la BD |
| `ctrl/coffeeia-context.php` | tocado — `brain_prompt_extra()` al final del system |
| `partials/launcher.php` · `src/js/launcher.js` | tocados — celda "Agentes" |

`data/agents.sqlite` se crea y siembra sola en la primera petición (no se versiona, como
el resto de las `.sqlite`).

### 12.2 Lo que se verificó

| Prueba | Resultado |
|---|---|
| Seed desde `~/.claude/agents` | 3 agentes + 7 grimorios repartidos y compartidos |
| Resolución de nombres (§10.3) | `grimorio-huubie-ui` · `GRIMORIO-HUUBIE-UI.MD` · `grimorio-fina` → todos resuelven |
| Nombre inexistente | error + lista de archivos disponibles |
| Paginado de `read_rules` | corte en 24 000 chars con aviso de truncado |
| **Chat real con el modelo** | pidió `read_rules('grimorio-huubie-ui.md')` solo y respondió con `#1F2A37`, `.cs-card`, `.cs-kpi-card` **citando el archivo** |
| **`save_memory` real** | el agente guardó por su cuenta y la recuperó al turno siguiente |
| Aislamiento | no vio memorias de otro usuario ni de otro agente |
| Alta de regla y de memoria desde la UI | 200, aparecen en el índice del turno siguiente |
| Páginas existentes | visor · coffeeia · playground · forge · studio → 200, sin errores de consola |
| Claves de agente | siguen siendo `CoffeeIA.md` / `CoffeeMagic.md` / `coffee-intelligence.md` |

**Consumo medido en el turno real:** 14 182 tokens de entrada *incluyendo* la lectura
completa del grimorio (5.3k). Un turno sin lectura: 6 932. Inyectarlo todo como antes:
67 600 fijos, siempre.

### 12.3 Correcciones sobre el diseño original

1. **§10.3 aplicado**: `brain_resolve()` acepta el nombre exacto, sin extensión y por
   prefijo único. Es el 8 % de fallo del módulo original, cerrado de entrada.
2. **§10.6 aplicado y corregido en pruebas**: el primer intento emitía el índice mirando
   el catálogo de herramientas, pero eso no es lo que decide si el turno tiene tools —
   lo deciden los endpoints. Ahora se consulta la misma condición real
   (`fs || db || tools_has_standalone`), y sin ella se inyectan solo las críticas.
3. **Descripciones del seed**: se lee `description` del frontmatter y si no hay, el primer
   encabezado del cuerpo — antes salían como `name: grimorio-huubie-ui`. En el índice se
   recortan a 120 chars: varios `.md` traen un párrafo entero y el índice dejaba de ser ligero.
4. **`ORDER BY` en UNION**: SQLite solo ordena por columnas del resultado; el rango de
   prioridad va como columna (`prio_rank`), no como expresión.

### 12.4 Nota sobre D6 en esta instalación

La decisión D6 protegía el streaming manteniendo las tools de cerebro fuera de
`tools_has_standalone()`. Al medirlo resultó que **`todo_propose` (source `todo`) ya está
activa**, así que los chats de CoffeeIA ya entraban al loop agéntico desde antes: en la
práctica `read_rules` está disponible en todos ellos. El gating sigue implementado y es
correcto — solo que hoy no llega a activarse. Si algún día se desactiva `todo_propose`,
los agentes caen al modo "solo reglas críticas" sin que nadie tenga que tocar nada.

### 12.5 Pendiente

- **Fase 6** — migrar los checkboxes de grimorios del Playground a las reglas del agente.
  Es donde se cobra el ahorro grande (~57k tokens por turno en CoffeeMagic) y quedó al
  final a propósito: hay que confirmar con módulos reales que la calidad de la UI no baja
  al dejar de inyectar el grimorio completo.
- **Fase 7** — banco de evals (la columna `evals` ya existe y se lee). `ask_agent` descartado.
- Cuenta de prueba `qa-agentes@coffee.local` creada para la verificación en navegador:
  borrar cuando no haga falta.

---

## 13. Lab del Agente (2026-08-04)

Página nueva `lab.php`, portada del Playground de `avatars`. **Su esencia: la
configuración de un agente no se afina en un formulario a ciegas, sino mientras se
prueba.** Panel de configuración y chat comparten pantalla; el botón ↑ baja lo que
estás probando al agente real, respaldando lo anterior.

Es distinto del Playground que ya existía: aquel genera UI (sandbox, versiones,
plantillas, hilos guardados); este afina agentes y su conversación es **efímera**.

### 13.1 Qué se portó

| Pieza de `avatars` | En `coffee/app` |
|---|---|
| Panel en acordeón (prompt · alma · modelo+temp+esfuerzo · conocimiento · tools) | ✅ + secciones de Reglas y Memoria conectadas a `agents.sqlite` |
| ↑ Guardar / ↺ Restaurar con respaldo | ✅ `configSave` / `configRestore` + tabla `agent_config_backup` (un respaldo por agente, se intercambia al restaurar) |
| "Mejorar" el prompt con IA | ✅ en prompt **y** en alma, con instrucciones distintas para cada uno |
| Dividir un `.md` en varias reglas | ✅ corte por H1/H2/H3, nombre derivado del título, preámbulo conservado en la primera sección |
| Anillo de contexto + compactar | ✅ estimación local vs. lo que reportó el servidor, auto-compacta al 85 % |
| Modo riel del panel | ✅ recordado en `localStorage` |

Descartado: el sandbox de HTML con versiones (ya lo tiene el Playground) y el permiso
de BD del módulo (`coffee/app` resuelve las conexiones por otro camino).

### 13.2 Lo que se verificó

| Prueba | Resultado |
|---|---|
| **El ciclo central** | alma editada **sin guardar** → el modelo respondió con la marca pedida (`VERIFICADO-LAB-2026`) |
| Guardar | el alma quedó en la fila del agente; aparece ↺ y se apaga "sin guardar" |
| Restaurar | volvió el alma anterior en panel **y** en servidor; el botón alterna |
| Dividir | manual de 598 chars → 4 archivos por H2 (`base-de-datos.md`, …); con H1, 1 archivo |
| **Las reglas creadas al dividir sirven** | el agente leyó `base-de-datos.md` y citó su contenido |
| Mejorar con IA | `"responde corto"` → alma redactada en 3 frases |
| Aviso al salir | `beforeunload` bloquea la navegación con cambios pendientes |
| Resto de páginas | visor · coffeeia · playground · forge · studio · agents → 200, sin errores de consola |

### 13.3 Archivos

Nuevos: `lab.php`, `src/js/lab.js`, `src/css/lab.css`.
Tocados: `ctrl/ctrl-agents.php` (configSave/configRestore + `agents_apply_tools`),
`ctrl/agents-registry.php` (tabla de respaldo + columnas `temperature`/`effort`),
`partials/launcher.php`, `src/js/launcher.js` y el rail de las seis páginas.

### 13.4 Detalles que costaron

- `IARender.postProcess()` recibe el mensaje **ya montado** en el DOM, no un string.
  Pasarle HTML daba `$msg.find is not a function` y tumbaba cada respuesta.
- El endpoint SSE emite `chunk` / `thinking` / `done` / `error` — no hay evento
  `status` ni `tool`; los avisos del loop de herramientas llegan como `thinking`.
- `applyToSelect` agrupa en `<optgroup>`: el fallback tenía que buscar `option`, no
  `children`, o el select quedaba sin valor.

### 13.5 Ajustes de diseño (2026-08-04, segunda pasada)

**El chat del Lab pasó a ser el mismo del Visor y el Playground.** Tenía burbujas
propias (`.lab-msg`), y eso significaba mantener dos veces el estilo del markdown, las
tablas, el código y la vista previa de HTML — todo eso cuelga de `.ia-msg-text`. Ahora
usa el markup exacto: `.pg-chat-body` como cuerpo, `.ia-msg user|ai` con su etiqueta de
rol, el loader de puntos del Playground, el pie `.ia-msg-meta-footer` (Credits · Tokens ·
Time + copiar) y el composer `.ia-drawer-input` con auto-alto.

**Scrollbars finas — y el motivo por el que no bastaba declararlas.** En Chrome 121+,
declarar `scrollbar-width` o `scrollbar-color` **apaga los `::-webkit-scrollbar`** del
mismo elemento, y `scrollbar-color` además **se hereda**, así que apagaba también los de
sus hijos. Consecuencias que se encontraron al medir:

| Contenedor | Antes | Ahora |
|---|---:|---:|
| Chat del Playground | ~10 px (thin nativo, no los 8 px declarados) | **8 px** |
| Modal de dividir del Lab | 15–17 px | **5–7 px** |
| Editores del Lab y de Agentes | 12 px | **7 px** |

La corrección: los `::-webkit-scrollbar` quedan sueltos, la forma estándar se mueve a
`@supports not selector(::-webkit-scrollbar)` (Firefox), y donde la herencia venía de
fuera se rompe con `scrollbar-color: auto`. Se aplicó también a `playground.css` y
`studio.css`, cuyos 8 px declarados nunca habían llegado a verse.
