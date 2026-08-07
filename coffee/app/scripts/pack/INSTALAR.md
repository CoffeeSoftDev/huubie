# Pack de agentes CoffeeSoft — instrucciones para el agente

> Este archivo va dirigido al agente (Claude Code u otro) que reciba el pack en el
> equipo nuevo. Si eres una persona: basta con ejecutar `instalar.bat` y leer la
> seccion "Que queda instalado".

## Que es esto

Una copia de la configuracion de agentes del equipo origen. **No es codigo de la
aplicacion** — el codigo ya viaja en el repositorio git. Aqui viene lo que vive
*fuera* del repo y por eso no se clona:

| Carpeta del pack | Destino en el equipo nuevo | Que es |
|---|---|---|
| `claude/agents/` | `~/.claude/agents/` | Definiciones de los subagentes (`CoffeeIA.md`, `CoffeeMagic.md`…) y sus grimorios |
| `claude/steering/` | `~/.claude/steering/` | Reglas del framework CoffeeSoft (FRONT-JS, CTRL, MDL, WORKFLOW…) |
| `claude/commands/` | `~/.claude/commands/` | Slash commands (`/coffee-ia`, `/coffee-magic`, `/actualiza`…) |
| `visor/data/agents.sqlite` | `coffee/app/visor/data/` | Registro de agentes del Visor: prompt, alma, modelo, reglas y memoria |
| `visor/data/tools.sqlite` | `coffee/app/visor/data/` | Catalogo de tools y su asignacion por agente |
| `visor/documents/` | `coffee/app/visor/documents/` | Cajon de TODOs: las listas `todo*.json` de cada usuario y las compartidas |
| `visor/data/todo-shares.sqlite` | `coffee/app/visor/data/` | Quien comparte que lista con quien (solo con `--force`, ver abajo) |

## Instalacion

Desde la raiz del pack descomprimido:

```bash
php instalar.php --dry-run     # revisa que va a tocar, no escribe nada
php instalar.php               # aplica
```

En Windows sin PHP en el PATH: doble clic en `instalar.bat` (busca el php de WAMP).

Opciones:

| Flag | Para que |
|---|---|
| `--dry-run` | Simula. Siempre correr esto primero. |
| `--force` | Reemplaza los `.sqlite` que ya existan en el destino (los respalda antes). |
| `--solo=claude` | Solo `~/.claude`, sin tocar el Visor. |
| `--solo=visor` | Solo las bases del Visor. |
| `--solo=todos` | Solo las listas del cajon de TODOs. |
| `--repo=RUTA` | Raiz del repo destino, si el pack no se descomprimio dentro de el. |
| `--home=RUTA` | Home del usuario, si `USERPROFILE` no es el correcto. |

El instalador **respalda antes de pisar**: cada carpeta o base que ya existia se
renombra a `<nombre>.backup-AAAAMMDD-HHMMSS`. Nada se borra.

## Reglas que debes respetar al instalar

1. **No pises `~/.claude/settings.json`.** Trae los permisos, hooks y preferencias
   del equipo destino. El pack deja `settings.reference.json` al lado para comparar
   a mano si hace falta.
2. **Los `.sqlite` no se reemplazan sin `--force`.** Si el equipo destino ya tenia
   agentes, sus prompts editados y su memoria estan ahi y no viajan en el pack.
   Pregunta antes de forzar.
3. **El pack no trae credenciales.** No hay API keys, ni tokens, ni `.env`, ni
   `cacert.pem`, ni la sesion de Claude Code. Eso se configura aparte (ver abajo).
4. **`agent_key` es el nombre del `.md`** (`CoffeeIA.md`). Es lo que viaja en
   `tools.agents` y en `chats.doc`. No lo renombres.
5. **Las listas de TODO se identifican por su ruta relativa.** Viven en
   `documents/users/<id>/` donde `<id>` es la cuenta del equipo **origen**. Si en el
   equipo nuevo esa persona tiene otro id, mueve la carpeta al id correcto *despues*
   de instalar; el cajon busca por ruta, no por nombre de usuario.
6. **`todo-shares.sqlite` no se instala solo.** Guarda comparticiones por id de
   usuario. Solo tiene sentido con `--force` y si las cuentas del destino son las
   mismas; en cualquier otro caso deja las comparticiones para rehacerlas a mano.

## Despues de instalar

1. **Credenciales.** El Visor necesita `coffee/app/credentials/.env`. Copia
   `visor/credentials/.env.example` a esa ruta y pon las API keys propias del
   equipo nuevo (Ollama Cloud y/o OpenRouter). Sin eso el chat no responde.

2. **Rutas del sandbox.** En ese mismo `.env`, `FS_ALLOWED_ROOTS` define que
   carpetas puede leer el chat. El default es `C:/wamp64/www`; ajustalo si el
   equipo nuevo tiene otro webroot.

3. **Verifica.** Abre `coffee/app/visor/agents.php`: deben aparecer los agentes con
   sus reglas. Si una ficha dice que su archivo de origen no existe, corre el
   instalador otra vez (reapunta las rutas `source_file` al home local).

4. **Claude Code.** Reinicia la sesion para que lea los agentes nuevos. Comprueba
   con `/coffee-ia` o pidiendo el subagente `CoffeeMagic`.

5. **El cajon de TODOs.** Abre el cajon en el Visor: deben aparecer las listas por
   proyecto. Si una cuenta no ve las suyas, revisa que la carpeta este bajo el id
   correcto en `documents/users/`.

## Que NO viene (y por que)

| No incluido | Motivo |
|---|---|
| `credentials/.env`, `cacert.pem`, `coffeedrive.json` | Secretos. Se configuran por equipo. |
| `~/.claude/.credentials.json` | Sesion OAuth de Claude Code del usuario origen. |
| `chats.sqlite`, `pg-threads.sqlite`, `studio-threads.sqlite` | Conversaciones. Son del usuario origen y pesan decenas de MB. |
| `prefs.sqlite` | Preferencias por usuario, con ids que no existen en el equipo nuevo. |
| `todo-link.sqlite` | Codigos de vinculacion de un solo uso, con 10 minutos de vida. |
| `tool_calls` (dentro de `tools.sqlite`) | Telemetria de llamadas. Se purga al exportar. |
| `~/.claude/projects/*/memory` | Memoria de sesion, atada a rutas del equipo origen. |

## Regenerar el pack

Desde el equipo origen, en el repo:

```bash
php coffee/app/scripts/export-agentes.php
```

Deja el ZIP actualizado en `coffee/app/dist/agentes-pack.zip`.
