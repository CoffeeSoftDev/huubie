# Conexión a base de datos desde el chat (CoffeeIA / Visor)

Guía de implementación de la función que permite, **escribiéndolo en lenguaje natural
en el chat**, conectarse a cualquier base MySQL local, leer su esquema real y consultar
datos en vivo (SELECT de solo lectura) para responder o generar diagramas.

> Ejemplo: *"conéctate a la base de reginas y genera el gráfico de los maestros"* o
> *"dame los últimos 5 registros de la tabla order"*.

---

## 1. Qué resuelve

- El modelo ya **no inventa** tablas/columnas: recibe el esquema real como fuente de verdad.
- Puede responder con **datos verdaderos** (conteos, ejemplos, agregados) ejecutando
  `SELECT` reales.
- Funciona con **cualquiera** de las bases locales (no está cableado a una sola), elegida
  por su nombre amigable (`reginas` → `fayxzvov_reginas`).
- La conexión es **pegajosa**: una vez conectado, los turnos siguientes la mantienen.

**No usa MCP.** El backend PHP consulta MySQL directo (PDO). MCP sería un protocolo
intermedio innecesario porque el transporte LLM (Ollama / OpenRouter) no es un host MCP.

---

## 2. Arquitectura

```
┌──────────────┐   POST {messages, dbConnect}   ┌─────────────────────────┐
│  visor.js    │ ─────────────────────────────► │ ctrl-coffeeia-stream.php│
│ (frontend)   │ ◄─── SSE chunk/thinking/done ─ │   (o ctrl-coffeeia.php)  │
│ chip 🛢 base │                                 └───────────┬─────────────┘
└──────────────┘                                             │
                                                  coffeeia-context.php
                                                  · detecta base (NL)
                                                  · inyecta esquema
                                                  · loop de tool-calling
                                                             │
                                          ┌──────────────────┴───────────────┐
                                          │        db-introspect.php          │
                                          │ resolve / digest / safe-select /  │
                                          │ tool specs / run_select           │
                                          └──────────────────┬───────────────┘
                                                       PDO   │ (db-config.php ← .env)
                                                             ▼
                                                     MySQL local (WAMP)
```

---

## 3. Archivos

| Archivo | Rol |
|---|---|
| `ctrl/db-config.php` | Lee `DB_*` de `credentials/.env` (host/user/pass, tope de filas, allowlist). |
| `ctrl/db-introspect.php` | Núcleo: conexión PDO, listar/resolver schemas, **digest** del esquema, **`db_safe_select`** (solo lectura), specs de herramientas y runner. |
| `ctrl/coffeeia-context.php` | Detecta la base en el mensaje, inyecta el esquema al system prompt y corre el **loop de tool-calling**. |
| `ctrl/openrouter-client.php` | `chat()` acepta/devuelve `tools`/`tool_calls`; `adaptMessages` conserva turnos de herramienta. |
| `ctrl/ollama-client.php` | Igual para Ollama: `tools` en la raíz, `role:tool` con `tool_name`, normaliza `content`/`tool_calls`. |
| `ctrl/ctrl-coffeeia-stream.php` / `ctrl-coffeeia.php` | Orquestan: si hay base conectada corren el loop; si el modelo no soporta tools, caen al chat normal. |
| `src/js/visor.js` | Envía `dbConnect`, captura la base del evento `done`, mantiene la conexión pegajosa y pinta el chip. |
| `src/css/visor.css` | Estilos del chip de conexión y de las **tablas markdown** en el chat. |

---

## 4. Configuración (`coffee/app/credentials/.env`)

```ini
DB_HOST="127.0.0.1"
DB_PORT=3306
DB_USER="root"
DB_PASS=""
# Tope de filas por SELECT en vivo.
DB_MAX_ROWS=200
# Lista blanca de bases expuestas, separadas por coma. Vacio = todas las no-sistema.
DB_ALLOWED_SCHEMAS=""
```

Las credenciales viven **siempre** server-side; nunca se mandan al modelo.

---

## 5. Flujo de una petición

1. **Frontend** (`visor.js`) arma el payload con `messages`, `graphMode`/`graphTemplate`
   y `dbConnect` (la base activa de la conversación, si la hay).
2. **`coffeeia_build_context()`**:
   - Toma el último mensaje del usuario.
   - Gate barato por regex (`base`, `esquema`, `tabla`, `conéct…`). Si no huele a BD y
     no hay `dbConnect`, **no toca MySQL**.
   - `db_detect_request()` busca un **alias de base existente** como palabra completa
     (`reginas`, `inventory`…). El mensaje actual manda; si no nombra ninguna, usa la
     base pegajosa (`dbConnect`).
   - Si resuelve una base: `db_schema_digest()` arma un resumen compacto (relaciones de
     TODAS las tablas + columnas detalladas hasta un presupuesto de caracteres) y se
     inyecta como `=== ESQUEMA DE BASE DE DATOS (FUENTE DE VERDAD) ===`.
   - Devuelve `['messages', 'model', 'db' => <schema|null>]`.
3. **Endpoint**: si `db` no es null, corre `coffeeia_run_db_tools()`:
   - Llama al modelo con la herramienta `run_select`.
   - Si el modelo pide una consulta → `db_safe_select()` la ejecuta y le devuelve las
     filas (mensaje `role:tool`). Repite hasta 4 rondas o hasta que responde.
   - Emite la respuesta final (en streaming: troceada por palabras; el evento `done`
     incluye `db`).
   - Si el modelo **no** soporta tools o falla, cae al streaming normal (el esquema ya
     está inyectado → el gráfico igual sale).
4. **Frontend**: lee `db` del evento `done`, fija `this.activeDb`, muestra el chip
   `🛢 fayxzvov_reginas ✕` y reenvía `dbConnect` en los siguientes turnos.

---

## 6. Modelo de seguridad

`db_safe_select()` (en `db-introspect.php`) garantiza **solo lectura**:

- La consulta debe empezar con `SELECT/SHOW/DESCRIBE/EXPLAIN/WITH`.
- Prohíbe `INSERT/UPDATE/DELETE/REPLACE/DROP/ALTER/TRUNCATE/CREATE/GRANT/…`,
  `INTO OUTFILE/DUMPFILE`, `LOAD_FILE`, `SET`, `USE`, etc.
- Rechaza **multi-statement** (no se permite `;` intermedio).
- Fuerza un `LIMIT` defensivo si falta (tope `DB_MAX_ROWS`).
- El schema se valida contra la lista real antes de hacer `USE` (sin inyección).
- Lista blanca opcional `DB_ALLOWED_SCHEMAS` para acotar qué bases se exponen.

> Para endurecer más: crear un usuario MySQL dedicado con privilegio `SELECT` solo
> sobre los schemas deseados y ponerlo en `DB_USER`/`DB_PASS`.

---

## 7. Tool-calling (SELECT en vivo)

Herramienta expuesta al modelo (formato OpenAI, válido también para Ollama):

```json
{ "type": "function",
  "function": {
    "name": "run_select",
    "description": "Ejecuta una consulta SQL de SOLO LECTURA y devuelve filas reales.",
    "parameters": { "type": "object",
      "properties": { "sql": { "type": "string" } },
      "required": ["sql"] } } }
```

Diferencias por proveedor que el loop ya absorbe:

| | OpenRouter | Ollama |
|---|---|---|
| `tools` en el request | raíz | raíz |
| `arguments` de la llamada | **string JSON** | **objeto** ya parseado |
| Respuesta del modelo | `tool_calls`/`content` (normalizado) | `message.tool_calls` (se normaliza) |
| Mensaje de resultado | `role:tool` + `tool_call_id` | `role:tool` + `tool_name` |
| `usage` | `prompt_tokens`/`completion_tokens`/`cost` | `prompt_eval_count`/`eval_count` |

Modelos verificados con tools: OpenRouter (gpt-oss-120b, nemotron) y Ollama Cloud
(GLM 5.2, qwen3-coder, kimi-k2.6).

---

## 8. Conexión pegajosa

- El backend devuelve la base resuelta en el evento `done` (`db`).
- `visor.js` la guarda en `this.activeDb` y la reenvía como `dbConnect` cada turno.
- El **mensaje actual tiene prioridad**: si nombras otra base, cambia; si no nombras
  ninguna, se mantiene la activa.
- El chip 🛢 sobre el input muestra la base y permite **desconectar** con la ✕.
- `Limpiar` (🗑️) suelta la conexión además de borrar el chat.

---

## 9. Render de resultados

- Se instruye al modelo a devolver las filas como **tabla markdown**.
- `src/css/visor.css` da estilo a `.ia-msg-text table` (bordes, padding, `nowrap`,
  scroll horizontal, filas alternas) para que no se vean amontonadas.

---

## 10. Cómo extender

- **Nueva herramienta** (p.ej. `list_tables`): agrégala en `db_tool_specs()` y maneja su
  ejecución en `db_run_tool()`.
- **Otra heurística de relaciones**: ver `guessRef()` dentro de `db_schema_digest()`.
- **Más proveedores con tools**: replica el patrón de `adaptMessages` + normalización de
  `content`/`tool_calls` del cliente correspondiente.
- **Selector explícito de base** (en vez de NL): el frontend ya puede mandar `dbConnect`;
  bastaría un dropdown que liste `db_list_schemas()` y lo fije.

---

## 11. Limitaciones

- `SELECT en vivo` depende de que el **modelo** soporte tool-calling; los que no, igual
  generan el gráfico desde el esquema inyectado, pero sin consultas en vivo.
- Nombres **ambiguos** (`erp` existe en varias bases) → el chat pide elegir el nombre exacto.
- La base activa vive en memoria de la sesión; al recargar un chat guardado hay que volver
  a nombrar la base (o reenviar `dbConnect`).
- Modelos `:free` de OpenRouter pueden dar 429/404 por rate-limit del proveedor.
