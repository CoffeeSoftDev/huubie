# Arquitectura del sistema de agentes

Mapa de donde vive cada pieza, para que el equipo nuevo sepa que instalo y por que.
Hay **dos consumidores distintos** de los mismos archivos `.md`, y conviene no
confundirlos.

## Los dos consumidores

```
                        ~/.claude/agents/*.md
                        ~/.claude/steering/*.md
                                  |
              +-------------------+-------------------+
              |                                       |
    (1) Claude Code (CLI/IDE)              (2) Visor CoffeeIA (web, PHP)
        lee los .md directos                   los importa a agents.sqlite
        subagentes via Agent tool              y sirve el chat desde ahi
```

**(1) Claude Code** lee `~/.claude/agents/*.md` como definiciones de subagente y
`~/.claude/commands/*.md` como slash commands. No hay base de datos: el archivo
en disco *es* la configuracion. Por eso el pack copia esas carpetas tal cual.

**(2) El Visor** (`coffee/app/visor/`) es una app PHP con su propio chat. Importa
esos mismos `.md` a `data/agents.sqlite` la primera vez (`agents_seed()`) y desde
entonces **manda la base de datos**: si editas un prompt en `agents.php` o en el
Lab, el `.md` de disco no cambia. La columna `source_file` guarda de que archivo
salio, y la ficha avisa si ese archivo cambio en disco.

> Consecuencia practica: instalar solo `~/.claude` deja a Claude Code al dia pero
> al Visor con los prompts viejos. Por eso el pack lleva tambien `agents.sqlite`.

## El registro del Visor (`agents.sqlite`)

| Tabla | Que guarda |
|---|---|
| `agents` | Un agente: `agent_key` (= nombre del `.md`), prompt, alma, modelo, temperatura, esfuerzo |
| `agent_knowledge` | Un archivo de reglas (grimorio) con su contenido, prioridad y "cuando usarlo" |
| `agent_knowledge_share` | Lectura del archivo de OTRO agente. El dueno sigue siendo `agent_knowledge.agent_id` |
| `agent_memories` | Memoria persistente por (agente, usuario) |
| `agent_config_backup` | Un respaldo por agente, el que intercambia el boton de restaurar del Lab |

**El punto del diseño:** las reglas *no* viajan completas al prompt. Al system solo
va un indice de una linea por archivo (`nombre — descripcion · cuando`), y el agente
abre el que necesita con la tool `read_rules`. Medido en CoffeeMagic: 10.6k tokens
fijos por turno contra 67.6k del modelo anterior que inyectaba los grimorios enteros.

## Las tools (`tools.sqlite`)

Catalogo de herramientas que el chat expone al modelo. Cada fila tiene un `source`
que dice de donde sale su implementacion:

| `source` | Tools | Implementadas en |
|---|---|---|
| `fs` | `list_dir`, `read_file`, `grep_files` | `ctrl/fs-introspect.php` |
| `db` | `run_select` | `ctrl/db-introspect.php` |
| `web` | `fetch_url` | `ctrl/web-fetch.php` |
| `ftp` | `ftp_list`, `ftp_read` | `ctrl/ftp-introspect.php` |
| `todo` | `todo_list`, `todo_read`, `todo_stats`, `todo_propose` | `ctrl/todo-tool.php` |
| `brain` | `read_rules`, `save_memory`, `forget_memory`, `write_rule` | `ctrl/agent-brain.php` |

La asignacion por agente es la columna `tools.agents` (CSV de `agent_key`). Vacia =
disponible para todos. No hay tabla pivote.

La tabla `tool_calls` (telemetria de ejecuciones) se purga al exportar: no aporta
nada en el equipo nuevo y puede contener rutas y consultas del equipo origen.

## El cajon de TODOs

No tiene tabla de tareas: **cada lista es un archivo `todo*.json` en la biblioteca**.
El cajon barre las raices en cada apertura y arma la vista con lo que encuentra.

| Pieza | Donde |
|---|---|
| Listas propias | `visor/documents/users/<id>/**/todo*.json` |
| Listas compartidas | `visor/documents/shared/**/todo*.json` |
| Quien comparte con quien | `data/todo-shares.sqlite` (`owner_id`, `rel`, `target_id`, `permission`) |
| Codigos de vinculacion externa | `data/todo-link.sqlite` — efimeros, 10 min, un solo uso |
| Nucleo | `ctrl/todos-lib.php` (raices, forma del archivo, validacion de rutas) |
| Entradas | `ctrl/ctrl-todos.php` (sesion del navegador) y `ctrl/ctrl-todo-sync.php` (servidor a servidor por token) |
| Tools del chat | `ctrl/todo-tool.php` — `todo_list`, `todo_read`, `todo_stats`, `todo_propose` |

La **identidad de una lista es su ruta relativa a la raiz**, no su nombre ni un id de
base de datos (`todos_entry()` la expone como `key`). Sobrevive a que cambie el id de
usuario, y por eso el pack restituye las listas con su ruta intacta.

`todo_propose` es la unica tool de escritura y ni siquiera escribe: **propone**. Es el
contrato de `coffee-clown.md`, el agente que cuida el cajon — lee las listas, dice que
se repite entre las correcciones del usuario y sugiere tareas, pero nunca las mete.

## Archivos clave del codigo

| Archivo | Rol |
|---|---|
| `ctrl/path-helper.php` | Resuelve el home donde vive `.claude`. Sobrevive a Apache corriendo como servicio (`COFFEE_CLAUDE_HOME` > `USERPROFILE` > escaneo de `C:\Users\*`) |
| `ctrl/agents-registry.php` | Esquema de `agents.sqlite`, seed desde `~/.claude/agents`, presupuesto de contexto |
| `ctrl/agent-brain.php` | Indice de reglas, memoria y las tools `read_rules` / `save_memory` / `forget_memory` / `write_rule` |
| `ctrl/tools-registry.php` | Catalogo de tools y su despacho |
| `ctrl/coffeeia-context.php` | Arma el system prompt del turno (`coffeeia_build_context()`) |
| `ctrl/fs-config.php` | Sandbox del sistema de archivos: `FS_ALLOWED_ROOTS` y las listas de negacion |

## Pantallas

| Archivo | Para que |
|---|---|
| `agents.php` | Alta y edicion de agentes, sus reglas y su reparto |
| `lab.php` | Lab del Agente: tocar → probar → guardar. El prompt en pantalla viaja como `systemOverride` |
| `index.php` | El chat CoffeeIA |
| `playground.php` | Generacion de UI con sandbox |
| `forge.php` / `studio.php` | Materializacion de modulos multi-archivo |

## Portabilidad: que rompe al cambiar de equipo

1. **Rutas absolutas en `source_file`.** Apuntan al home del equipo origen. El
   instalador las reescribe con el prefijo local.
2. **`FS_ALLOWED_ROOTS`** en `.env`. Default `C:/wamp64/www`. Si el webroot del
   equipo nuevo es otro, el chat no puede conectarse a ninguna carpeta.
3. **Apache como servicio.** Si corre como SYSTEM, `USERPROFILE` apunta a
   `C:\WINDOWS\system32\config\systemprofile` y no encuentra `.claude`. Se resuelve
   con la variable de entorno `COFFEE_CLAUDE_HOME`.
4. **Hooks de `settings.json`.** Los del equipo origen reproducen sonidos desde
   `C:\Windows\Media\claude\`. En otro equipo fallan en silencio; no es grave, pero
   por eso `settings.json` no se pisa.
