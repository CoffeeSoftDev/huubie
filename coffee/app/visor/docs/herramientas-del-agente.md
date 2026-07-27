# Herramientas del agente (CoffeeIA)

Elegir qué puede hacer el agente durante el chat y crear herramientas nuevas que
conecten con cualquier API.

Antes, las herramientas estaban **hardcodeadas** y se activaban solas según la
conexión: al conectar una carpeta aparecían `list_dir`/`read_file`/`grep_files`, al
conectar una base aparecía `run_select`. No había forma de apagarlas ni de sumar las
propias. Ahora viven en un catálogo que el usuario controla.

## Dónde se usa

- **Configuración → Herramientas** (menú de la cuenta, en el rail del visor): catálogo
  completo en tarjetas, con el mismo diseño que la sección Modelos. Cada tarjeta tiene
  su switch, y el botón *Nueva herramienta* abre el editor.
- **Menú del chat → Herramientas del agente**: submenú para activar/desactivar sin
  salir de la conversación, más el acceso a *Gestionar herramientas*.

## Las dos familias

| Familia | Qué es | Qué se puede editar |
|---|---|---|
| **Base** | Las del visor: leer carpeta, consultar la base, descargar URL | Activarla y su apariencia (nombre visible, categoría, ícono, descripción del panel) |
| **Propia** | Las que crea el usuario contra una API HTTP | Todo: nombre técnico, endpoint, método, headers, parámetros |

El nombre técnico de una base y su schema los define el código: es lo que el modelo
lee para decidir si la llama, y cambiarlo rompería la ejecución.

## Asignación: a quién se le declara

Cada herramienta se asigna a **chats** y a **agentes**, y las dos condiciones se
combinan (Y). Se edita en la tarjeta *Dónde se usa* del editor.

| Chats | Agentes |
|---|---|
| Visor (chat del documento) | CoffeeIA |
| CoffeeIA (pantalla completa) | CoffeeMagic |
| Playground (sandbox) | CoffeeIntelligence |

Ejemplos:

- Todo marcado → disponible en cualquier chat, para cualquier agente (así nace).
- `Playground` + `CoffeeMagic` → solo ese agente en el Playground la ve; en el Visor
  ni siquiera se declara.
- `Visor` + los tres agentes → el chat del documento la usa siempre. Como el Visor no
  tiene selector de agente, ahí siempre cuenta como `CoffeeIA.md`.

Aplica también a las **base**: puedes dejar `grep_files` solo para el Playground si no
quieres que el chat del documento navegue la carpeta.

Cada superficie se identifica en su petición con `surface` y `agentKey`; un cliente
que no los mande recibe el catálogo completo (retrocompatible).

## Alcance: cuándo se le declara al modelo

Cada herramienta declara de qué depende (`source`), y el turno solo declara lo que su
contexto puede resolver:

| Alcance | Se declara cuando |
|---|---|
| `fs` (carpeta) | hay una carpeta conectada |
| `db` (base) | hay una base conectada |
| `ftp` (servidor remoto) | hay al menos un servidor en `credentials/.env` |
| `web` / `http` | siempre, si está activa |

Si hay activa al menos una herramienta que **se vale sola** —una propia (`http`) o una
de servidor remoto (`ftp`)— el chat corre el loop agéntico aunque no haya carpeta ni
base conectadas; lo decide `tools_has_standalone()`. `fetch_url` queda fuera de esa
cuenta a propósito: está activa por defecto y convertiría cualquier conversación normal
en un turno agéntico sin streaming. Si el modelo no soporta tool-calling o falla, se cae
al streaming normal como siempre.

## Servidores remotos (FTP / FTPS / SFTP)

`ftp_list` y `ftp_read` dejan al agente consultar un servidor remoto en **solo
lectura**: no hay subida, borrado ni renombrado ni siquiera internamente.

Los servidores se declaran en `coffee/app/credentials/.env`, una entrada por
servidor. El alias es lo que va entre `FTP_` y `_URL`, en minúsculas:

```ini
FTP_PROD_URL   = ftps://usuario:clave@ftp.midominio.com:21
FTP_PROD_ROOT  = /public_html          ; opcional, carpeta a la que se ancla todo
FTP_PROD_LABEL = Producción            ; opcional, nombre legible
```

Esquemas admitidos: `ftp`, `ftps` (FTP sobre TLS) y `sftp` (SSH). Si la contraseña
lleva `@ : / #`, escríbela URL-encoded (`%40`, `%3A`…). Sin ningún servidor
declarado, las dos herramientas no se le declaran al modelo.

**Las credenciales nunca salen de PHP.** El modelo solo conoce el alias; el
navegador tampoco recibe usuario ni contraseña, y si cURL falla, la URL se limpia
antes de que el error llegue al contexto.

Cómo lo usa el agente: llama a `ftp_list` sin argumentos y recibe el catálogo de
servidores (alias, host, raíz); luego navega con `server` + `path` y lee con
`ftp_read`.

Mismos límites que la carpeta local: todo se ancla al `ROOT` (`..` no escapa), los
archivos de credenciales (`.env`, llaves) no se listan ni se leen, los binarios se
listan pero no se leen como texto, 300 entradas por listado y 64 KB por archivo.

Ajustes opcionales del `.env`: `FTP_TIMEOUT`, `FTP_CONNECT_TIMEOUT`,
`FTP_MAX_FILE_BYTES`, `FTP_MAX_LIST_ENTRIES`, `FTP_PASSIVE` (1 por defecto) y
`FTP_VERIFY_CERT` (0 por defecto, para certificados autofirmados de hosting
compartido).

## Crear una herramienta propia

1. **Identidad**: nombre técnico en `snake_case` (así la invoca el modelo), nombre
   visible, descripción (el modelo decide con ella: sé concreto), categoría e ícono.
2. **Conexión**: método y endpoint. Un parámetro puede ir en la ruta con llaves:
   `https://api.ejemplo.com/ciudades/{ciudad}`. El resto viaja como query string
   (GET/DELETE) o como JSON body (POST/PUT/PATCH).
3. **Headers**: `${MI_API_KEY}` se resuelve contra `coffee/app/credentials/.env` en el
   servidor. El secreto nunca se guarda en el catálogo ni pasa por el navegador.
4. **Parámetros**: nombre, tipo, descripción y si es requerido. Con eso se arma el
   schema que ve el modelo (se previsualiza en vivo).
5. **Probar ahora**: ejecuta la llamada real con argumentos JSON de ejemplo, tal como
   la haría el modelo.

Solo se envían los parámetros declarados en el schema: si el modelo inventa uno, se
descarta.

## Piezas

| Archivo | Rol |
|---|---|
| `ctrl/tools-registry.php` | Catálogo en SQLite (`data/tools.sqlite`), specs del turno, asignación y ejecutor HTTP |
| `ctrl/ftp-config.php` | Servidores remotos declarados en `credentials/.env` |
| `ctrl/ftp-introspect.php` | `ftp_list` / `ftp_read`: transporte cURL, parseo del listado y sandbox |
| `ctrl/ctrl-tools.php` | ABC del catálogo: list / get / save / status / assign / delete / test |
| `ctrl/coffeeia-context.php` | `coffeeia_run_tool_loop()`: motor único de los cuatro loops (carpeta, base, híbrido, propias) |
| `src/js/tools-config.js` | `CoffeeToolConfig`: cliente del catálogo + evento `coffeeia:tools-changed` |
| `src/js/account-menu.js` | Sección Herramientas del modal de Configuración |
| `src/js/visor.js` | Submenú de herramientas en el menú del chat |

El catálogo vive en el **servidor** (no en `localStorage` como los modelos) porque
quien ejecuta las herramientas durante el chat es PHP.

## Límites defensivos

- Solo endpoints `http(s)`; timeout de 25 s por llamada y respuesta recortada a 20 000
  caracteres antes de entrar al contexto.
- Los nombres de las herramientas base están reservados: una propia no puede pisarlos.
- Las base no se eliminan, se desactivan.
- Los errores de una herramienta vuelven al modelo como JSON: los lee y corrige, sin
  romper el turno.
