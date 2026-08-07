# dist — paquetes distribuibles

## `agentes-pack.zip`

La configuracion de agentes CoffeeSoft de este equipo, lista para instalar en otro.
Contiene lo que vive **fuera** del repositorio y por eso no se clona con `git`:

- `~/.claude/agents/`, `steering/` y `commands/` — lo que leen Claude Code y el Visor
- `agents.sqlite` — registro de agentes del Visor: prompt, alma, modelo, reglas, memoria
- `tools.sqlite` — catalogo de tools y su asignacion por agente
- El cajon de TODOs: las listas `todo*.json` de `visor/documents/`

**No contiene credenciales**: ni `.env`, ni API keys, ni tokens, ni la sesion de
Claude Code. Tampoco las conversaciones ni las preferencias por usuario.

### Instalarlo en el equipo nuevo

```bash
git clone <este-repo>
cd <repo>
unzip coffee/app/dist/agentes-pack.zip -d agentes-pack
php agentes-pack/instalar.php --dry-run    # revisa
php agentes-pack/instalar.php              # aplica
```

En Windows sin PHP en el PATH: doble clic en `agentes-pack/instalar.bat`.

Las instrucciones completas —incluidas las reglas que un agente debe respetar al
instalar— estan en `INSTALAR.md` **dentro** del ZIP, junto con
`docs/ARQUITECTURA-AGENTES.md`, que explica como encajan las piezas.

### Regenerarlo

```bash
php coffee/app/scripts/export-agentes.php
```

Reescribe este ZIP con el estado actual del equipo. Hazlo cada vez que cambien los
agentes, los grimorios o el steering, y commitea el resultado.
