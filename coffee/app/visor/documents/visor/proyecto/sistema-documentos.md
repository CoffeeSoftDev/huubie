---
name: sistema-documentos
description: Sistema personal para guardar markdown organizado por proyecto y tipo dentro del Visor
type: proyecto
project: visor
status: draft
date: 2026-05-26
---

# Sistema personal de notas Markdown en el Visor

> **Estado:** propuesta — esperando aprobacion para implementar Fase B.
> **Ubicacion canonica:** `coffee/app/visor/documents/<proyecto>/<tipo>/<archivo>.md`
> **Modo de lectura actual:** preset "Custom..." apuntando a `C:/wamp64/www/huubie/coffee/app/visor/documents/visor/proyecto`.

---

## 1. Contexto

Hoy el modulo Visor (`coffee/app/visor/`) solo lee `.md` desde 4 presets fijos en `C:/Users/CoffeSoft/.claude/`: **agents, commands, steering, grimoires**. Todo es contenido del ecosistema CoffeeSoft / agentes — no hay un espacio para documentacion personal del usuario.

Se necesita un sistema propio para guardar markdown organizado por **proyecto** (inventarios, huubie-core, pedidos, etc.) y por **tipo** (plan, database, actualizacion, proyecto, y los que vayan surgiendo). La intencion es tener **un solo lugar canonico** donde escribir y consultar documentos de trabajo, renderizado en el mismo visor que ya conoces.

**Resultado esperado:** una carpeta `coffee/app/visor/documents/` con estructura `<proyecto>/<tipo>/<archivo>.md`, un nuevo preset "Documents" en el visor que la escanea, y un sidebar de 3 niveles (Proyecto → Tipo → Archivo) en el panel lateral.

**Limitaciones de esta fase:** solo lectura. Crear / editar / borrar se hace con VS Code u otro editor, no desde el visor. CRUD desde UI queda para una fase posterior.

---

## 2. Estructura de carpetas propuesta

```
coffee/app/visor/
├── ctrl/
│   └── ctrl-visor.php
├── src/
├── documents/                          <- NUEVO (raiz del sistema)
│   ├── inventarios/
│   │   ├── plan/
│   │   │   └── fase-1-mvp.md
│   │   ├── database/
│   │   │   ├── propuesta-bd.md
│   │   │   └── migracion-stock.md
│   │   ├── actualizacion/
│   │   │   └── 2026-05-changelog.md
│   │   └── proyecto/
│   │       └── vision-general.md
│   ├── huubie-core/
│   │   ├── proyecto/
│   │   └── plan/
│   └── visor/
│       └── proyecto/
│           └── sistema-documentos.md    <- este archivo
├── index.php
└── visor-index.html
```

### Reglas estructurales

- **Nivel 1 = proyecto** — cualquier carpeta directa dentro de `documents/` es un proyecto.
- **Nivel 2 = tipo** — cualquier carpeta dentro de un proyecto es un tipo, **extensible** (si creas `diseno-ui/`, el visor lo lista solo).
- **Nivel 3 = archivo `.md`** — no se permiten subniveles extra; si llega a hacer falta, se discute despues.
- Nombres en **kebab-case-minuscula** para carpetas y archivos.
- **Tipos canonicos sugeridos** (no obligatorios): `plan`, `database`, `actualizacion`, `proyecto`.
- Archivos sueltos directamente en `documents/<proyecto>/` (sin subcarpeta tipo) se agrupan como tipo `(sin clasificar)`.

---

## 3. Frontmatter recomendado por archivo

Opcional pero util para mostrar chips en el visor:

```markdown
---
name: propuesta-bd-inventarios
description: Esquema fayxzvov_inventario y tablas cross-schema
type: database
project: inventarios
status: draft        # draft | revision | aprobado | obsoleto
date: 2026-05-26
---

# Propuesta BD - Inventarios
...
```

El parser actual (`parseFrontmatter()` en `ctrl-visor.php:58-71`) solo extrae `name / description / model`. **Se extiende** para tambien capturar `type / project / status / date`.

---

## 4. Cambios tecnicos

### 4.1 Backend — `coffee/app/visor/ctrl/ctrl-visor.php`

**Agregar preset `documents`** en `$PRESETS` (lineas 7-40):

```php
'documents' => [
    'label'      => 'Documents',
    'path'       => __DIR__ . '/../documents',
    'subfolder'  => null,
    'subLabel'   => null,
    'pathLabel'  => 'coffee/app/visor/documents',
    'relPrefix'  => 'coffee/app/visor/documents',
    'mode'       => 'tree'   // <- NUEVO flag: activa escaneo 2-niveles
]
```

**Nueva funcion `readDocumentsTree($baseDir, $relPrefix)`** que reemplaza a `readSection()` cuando `mode === 'tree'`:

- Itera **nivel 1 (proyectos)**: cada subcarpeta directa de `documents/`.
- Para cada proyecto, itera **nivel 2 (tipos)**: subcarpetas + un seudo-tipo `(sin clasificar)` para archivos sueltos.
- Para cada tipo, lista `.md` reusando la misma estructura de item que ya devuelve `readSection()`: `name, file, size, isBackup, frontmatter, raw, mtime, fullPath, relPath`.
- Agrega campos extra: `project` y `type` por item.

**Extender `parseFrontmatter()`** para incluir `type, project, status, date` ademas de los 3 existentes.

**Payload nuevo cuando `mode === 'tree'`:**

```json
{
  "header": { "...": "mismo formato" },
  "documents": {
    "inventarios": {
      "plan":           [ { "item": "..." } ],
      "database":       [ { "item": "..." } ],
      "actualizacion":  [ { "item": "..." } ],
      "proyecto":       [ { "item": "..." } ]
    },
    "huubie-core": { }
  },
  "agents": [],
  "grimoires": []
}
```

### 4.2 Frontend — `coffee/app/visor/src/js/visor.js`

**`Visor.fetchLibrary()`** (linea 345): aceptar nuevo campo `documents` en el payload sin romper la validacion actual.

**`App.init()` / `App.reloadLibrary()`** (lineas 49-72, 220-244):

- Cuando viene `data.documents`, aplanar a `allFiles` para que la busqueda global siga funcionando.
- Pasar el arbol crudo a `visorView.renderSidebarTree()` en lugar de `renderSidebar()`.

**Nuevo `VisorView.renderSidebarTree(documents, currentFile, filter)`** (despues de linea 466):

Render visual del sidebar:

```
[Proyecto] inventarios                     (6)
   plan                                    (1)
     - fase-1-mvp.md                  3 KB
   database                                (2)
     - propuesta-bd.md               14 KB
     - migracion-stock.md             5 KB
   actualizacion                           (1)
     - 2026-05-changelog.md           2 KB
   proyecto                                (1)
     - vision-general.md              4 KB

[Proyecto] huubie-core                     (1)
   proyecto                                (1)
     - vision-arquitectura.md         7 KB
```

- Cabecera proyecto con icono `lucide:folder-tree`.
- Sub-cabecera tipo con icono `lucide:tag` y badge con count.
- Items de archivo iguales a los actuales (`.sidebar-item` reutiliza CSS).
- Colapso por proyecto opcional (click en cabecera, estado en `localStorage`).

**`VisorView.renderBreadcrumb()`** (linea 508): cuando el archivo viene de `documents`, mostrar `documents / <proyecto> / <tipo>` en vez de `agents`.

**`VisorView.renderFrontmatter()`** (linea 517): si existen `type` y `project`, mostrarlos como `<span class="cs-badge badge-info">` ademas de los campos actuales.

### 4.3 UI — `coffee/app/visor/index.php`

**Sin cambios.** El `<select id="folderSelect">` (linea 37) se llena dinamicamente desde `header.presets` (linea 438 en `visor.js`), asi que el nuevo preset aparece automaticamente cuando el backend lo expone.

---

## 5. Archivos criticos a modificar

| Archivo | Cambio | Lineas aprox |
|---|---|---|
| `coffee/app/visor/ctrl/ctrl-visor.php` | + preset `documents`, + `readDocumentsTree()`, extender `parseFrontmatter()` | 7-40, 58-71, 79-115, payload final |
| `coffee/app/visor/src/js/visor.js` | + `renderSidebarTree()`, soporte payload `documents` en `App.init/reloadLibrary` | 49-72, 220-244, 466-506 |
| `coffee/app/visor/src/css/visor.css` | + estilos para cabecera de proyecto y agrupacion 2-niveles (opcional, reutilizar `.section-header`) | final del archivo |

---

## 6. Reutilizacion (no inventar lo que ya existe)

- `parseFrontmatter()` en `ctrl-visor.php:58` — **extender**, no duplicar.
- `fmtSize()` en `ctrl-visor.php:73` — se usa tal cual.
- `presetList()` en `ctrl-visor.php:45` — alimenta el `<select>` sin tocar el frontend.
- `Visor.filterFiles()` y `Visor.findFirstMatch()` en `visor.js:367,376` — reutilizables sobre `allFiles` aplanado.
- `VisorView.renderContent()` en `visor.js:546` — render markdown intacto.
- `marked.js` + `highlight.js` — ya estan via CDN en `index.php:15-17`.

---

## 7. Secuencia de entrega

### Fase A — Propuesta visible en visor (HOY)

1. Crear la carpeta base: `coffee/app/visor/documents/visor/proyecto/` ✅
2. Crear el archivo `sistema-documentos.md` con esta misma propuesta ✅
3. El usuario la abre HOY mismo en el visor usando el preset **"Custom..."** y la ruta absoluta `C:/wamp64/www/huubie/coffee/app/visor/documents/visor/proyecto`. Funciona sin tocar codigo porque `readSection()` ya soporta cualquier directorio plano.
4. Esta es la version "viva" de la propuesta — se ajusta segun feedback antes de implementar Fase B.

### Fase B — Preset "Documents" con tree mode (despues de aprobar)

5. Modificar `ctrl-visor.php` y `visor.js` segun los cambios tecnicos descritos arriba.
6. Migrar gradualmente otros archivos (`inventarios/plan/`, `inventarios/database/`) bajo `documents/`.
7. A partir de ese momento el usuario ya no necesita la ruta custom: aparece **"Documents"** en el selector.

---

## 8. Verificacion end-to-end

### Fase A

- [x] `coffee/app/visor/documents/visor/proyecto/sistema-documentos.md` existe.
- [ ] Abre `http://localhost/coffee/app/visor/index.php` → selector "Custom..." → pega `C:/wamp64/www/huubie/coffee/app/visor/documents/visor/proyecto` → este archivo se renderiza.

### Fase B

1. **Estructura base:** crear manualmente:
   ```
   coffee/app/visor/documents/visor/proyecto/sistema-documentos.md
   coffee/app/visor/documents/inventarios/plan/fase-1-mvp.md
   coffee/app/visor/documents/inventarios/database/propuesta-bd.md
   ```
2. **Backend:** abrir `http://localhost/coffee/app/visor/ctrl/ctrl-visor.php?folder=documents` y verificar que el JSON trae:
   - `header.currentLabel = "Documents"`
   - `documents.visor.proyecto[0].name = "sistema-documentos"`
   - `documents.inventarios.plan` y `documents.inventarios.database` no vacios.
3. **Frontend:** abrir `http://localhost/coffee/app/visor/index.php`, en el selector elegir **"Documents"**. Verificar:
   - Sidebar muestra `visor (1)` y `inventarios (2)` como cabeceras de proyecto.
   - Dentro de `inventarios` se ven `plan (1)` y `database (1)` como sub-cabeceras tipo.
   - Click en `propuesta-bd.md` renderiza markdown correcto.
   - Breadcrumb: `documents / inventarios / database / propuesta-bd.md`.
   - Frontmatter card muestra chips `type: database` y `project: inventarios`.
4. **Extensibilidad:** crear `coffee/app/visor/documents/inventarios/diseno-ui/wireframe-001.md`, refrescar — debe aparecer un nuevo tipo `diseno-ui` sin tocar codigo.
5. **Regresion:** cambiar el selector a "Agentes" y verificar que los presets viejos siguen funcionando igual.

---

## 9. Fuera de alcance (no se hace en esta fase)

- Editor inline / boton "Nuevo MD" desde el visor.
- Borrar / renombrar archivos desde la UI.
- Busqueda full-text con indice (la busqueda actual del visor ya es suficiente para empezar).
- Templates iniciales por tipo (`plan.template.md`, `database.template.md`).
- Versionado git automatico (depende de si la carpeta `documents/` entra o no a `.gitignore` — decision pendiente).

---

## 10. Decision pendiente menor

**Git vs gitignore para `coffee/app/visor/documents/`:**

- Si el contenido es **personal del usuario** y no debe llegar al repo Huubie → agregar a `.gitignore`.
- Si los documentos son **de equipo** (propuestas, planes compartidos) → committearlos.

Por defecto la propuesta **no toca** `.gitignore`; se confirma al implementar Fase B.

---

## 11. Preguntas abiertas

1. ¿Quieres que los **tipos canonicos** (`plan`, `database`, `actualizacion`, `proyecto`) aparezcan ordenados primero y los nuevos despues, o todos en orden alfabetico?
2. ¿El **colapso por proyecto** en el sidebar lo quieres activado por defecto o expandido?
3. Cuando un proyecto tenga muchos archivos, ¿quieres **paginacion** o scroll infinito en el sidebar?
4. ¿`documents/` debe **versionarse en git** con Huubie o vivir solo en local (gitignore)?
