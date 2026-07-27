# Documentar la conversación en la carpeta (Visor / CoffeeIA)

Guía de la función que **guarda el chat de CoffeeIA como un `.md` dentro de una carpeta
de trabajo**, para que quede como documentación del proyecto y se pueda **retomar** más
tarde.

**Carpeta destino**, en este orden:

1. la carpeta **conectada por el chat** (*"conéctate a costsys"*), si la hay;
2. si no, la que el **explorador** tiene abierta en ese momento (árbol de documentos,
   preset local o `customPath`).

Con Drive abierto no hay ruta local: la función avisa y no escribe.

> Ejemplo: *"conéctate a costsys"* → se trabaja el chat → **Herramientas → Documentar en
> la carpeta** → queda `costsys/docs/coffeeia/como-se-calcula-el-costo.md`. Semanas
> después: *"conéctate a costsys"* → **Herramientas → Retomar de la carpeta** → el chat
> vuelve con todo el historial.

---

## 1. Qué resuelve

- La conversación deja de vivir solo en el navegador/SQLite del Visor: **viaja con el
  proyecto** (se versiona en git, se lee desde el editor, se comparte con el equipo).
- El documento es **legible** (transcripción turno por turno) y a la vez **retomable**
  (lleva el historial serializado en un bloque oculto).
- El modelo también lo puede leer con `read_file`: la conversación anterior se vuelve
  contexto del proyecto, igual que cualquier otro documento de la carpeta.

Es hermano de la [conexión a carpetas](../ctrl/fs-introspect.php) y de la
[conexión a base de datos](implementacion-conexion-db-chat.md).

---

## 2. Arquitectura

```
┌────────────────────┐  POST save/list  ┌──────────────────────┐
│      visor.js      │ ───────────────► │  ctrl-fs-notes.php   │
│  clase CoffeeIA    │ ◄─ GET read ──── │  (sandbox de escritura)│
│  · _folderDoc      │                  └──────────┬───────────┘
│  · activeFolder    │                             │ valida ruta + whitelist
└────────────────────┘                    fs-introspect.php / fs-config.php
                                                   │
                                       <carpeta conectada>/docs/coffeeia/*.md
```

- **Frontend** (`src/js/visor.js`, clase `CoffeeIA`): construye el markdown, lo escribe,
  lista los documentos de la carpeta y reconstruye el chat al retomar.
- **Backend** (`ctrl/ctrl-fs-notes.php`): única vía de **escritura** dentro de una carpeta
  conectada (la conexión de `fs-introspect.php` es solo-lectura por diseño).

---

## 3. Backend: `ctrl/ctrl-fs-notes.php`

Acciones, siempre con `folder` = carpeta conectada (nombre amigable o ruta):

| Acción | Parámetros | Devuelve |
|---|---|---|
| `save` | `path` (relativa), `content`, `overwrite` | `{success, path, fullPath, name, created, size, mtime}` |
| `list` | — | `{success, folder, name, docs:[{path,title,uid,model,msgCount,updated,size}]}` |
| `read` | `path` | `{success, path, content, size, mtime}` |

Reglas de escritura (todas obligatorias, ninguna la decide el cliente):

1. Sesión válida (`auth_current_user()`), o `401`.
2. La carpeta se resuelve con `fs_canonical_folder()`: debe caer dentro de
   `FS_ALLOWED_ROOTS`.
3. La ruta es **relativa**, sin `..`, sin unidad/raíz, máx. 8 niveles y solo
   `.md` / `.markdown`.
4. Nunca en carpetas vetadas (`FS_IGNORE_DIRS` + `FS_DENY_DIRS`: `credentials`, `.git`,
   `node_modules`…) ni con nombres sensibles (`FS_DENY_FILES`).
5. Tras crear los directorios intermedios, la carpeta destino se **revalida con
   `realpath`** contra la carpeta conectada (defensa contra symlinks).
6. Un archivo existente **no se pisa** sin `overwrite=1`: se responde `exists:true` y el
   cliente pregunta.
7. Tope de 4 MB por documento.

`list` recorre la carpeta (acotado a 4000 archivos) y solo reporta los `.md` cuyo
frontmatter tiene el marcador `coffeeia: conversacion`.

---

## 4. Formato del documento

```markdown
---
coffeeia: conversacion
titulo: Cómo se calcula el costo potencial
uid: chat_abc123              # conversación en chats.sqlite (se re-liga al retomar)
modelo: glm-5.2:cloud
carpeta: C:/wamp64/www/GrupoVaroch/costsys
base: rfwsmqex_gvsl_costsys2  # solo si había base conectada
mensajes: 4
creado: 2026-07-25 10:00:00
actualizado: 2026-07-25 20:33:23
---

# Cómo se calcula el costo potencial

> Conversación con **CoffeeIA** documentada desde el Visor.
> Carpeta: `costsys` · Modelo: `glm-5.2:cloud` · 4 mensajes · Actualizado: …

## 👤 Usuario

como se calcula el costo potencial?

*Adjuntos: receta.xlsx*

## ☕ CoffeeIA

…respuesta…

<!-- coffeeia:history:v1
<base64 del historial, en líneas de 120 chars>
-->
```

- Los encabezados de turno (`## 👤 Usuario` / `## ☕ CoffeeIA`) llevan emoji **a
  propósito**: son marcadores que el modelo nunca produce por accidente, así que sirven
  para reconstruir los turnos si el bloque oculto desaparece.
- El bloque oculto guarda `role`, `content` y `docsMeta`; **no** guarda imágenes en
  base64 (el documento se mantiene ligero).
- La transcripción visible omite el bloque `=== DOCUMENTOS ADJUNTOS ===` que se embebe en
  el mensaje del usuario; el bloque oculto sí lo conserva para no perder contexto.

---

## 5. Frontend: métodos de `CoffeeIA`

| Método | Qué hace |
|---|---|
| `_docTargetFolder()` | Carpeta destino: `activeFolder` o, si no hay, `App.currentExplorerDir()` |
| `saveConversationToFolder()` | Pide la ruta (default `docs/coffeeia/<slug>.md`) y escribe |
| `_writeFolderDoc(folder,path,title,overwrite,silent)` | POST `save`; reintenta con confirmación si ya existe |
| `_refreshFolderDoc()` | Reescribe en silencio el documento ya ligado (lo llama `_autoSaveChat`) |
| `openFolderDocsModal()` | Modal con los documentos de la carpeta destino (`list`) |
| `loadConversationFromFolder(path)` | `read` + `_parseConversationDoc` + `_rebuildFromHistory` |
| `_parseConversationDoc(raw)` | Metadatos + historial (bloque oculto, o transcripción como respaldo) |

`App.currentExplorerDir()` resuelve la carpeta abierta: `header.currentPath` más el
crumb (`visor:docs:crumb`, `[proyecto, tipo]`) cuando el origen es el árbol de
documentos — sin el crumb apuntaría siempre a la raíz de la biblioteca.

Estado: `this._folderDoc = { folder, path, created }`. Guarda **su propia carpeta**, así
que sigue actualizándose ahí aunque el explorador navegue a otro lado o el chat se
conecte a otro proyecto. Solo se desliga al limpiar el chat. Mientras está ligado, cada
turno actualiza el documento y el item del menú pasa a *"Actualizar documentación"*.

Si el documento cae dentro de la carpeta que el explorador muestra, se llama a
`reloadLibrary()` para que aparezca en el árbol sin recargar la página.

**Ruta por defecto según el destino:**

- carpeta **conectada por chat** → `docs/coffeeia/<slug>.md` (agrupa los chats y no
  ensucia la raíz del proyecto);
- carpeta del **explorador** → `<slug>.md` **plano**, porque `readDocumentsTree()` solo
  lee dos niveles (`proyecto/tipo/archivo`): dentro de una subcarpeta el documento
  quedaría invisible en el árbol.

Al retomar se restauran el `uid` (el autoguardado de `chats.sqlite` vuelve a apuntar a la
misma conversación), el modelo y la base conectada, si siguen disponibles.

---

## 6. UI

`index.php` / `index-2.php`, menú **Herramientas** del chat (`#iaToolsMenu`):

- `data-tool="folderdoc"` → **Documentar en la carpeta** / *Actualizar documentación*.
  La descripción del item muestra la carpeta destino vigente y se refresca cada vez que
  se abre el menú (`_toggleToolsMenu`), porque navegar el explorador la cambia.
- `data-tool="folderdocs"` → **Retomar de la carpeta**.

Ambas exigen una carpeta destino local; sin ella avisan con un toast.

---

## 7. Icono de bot en el explorador

Las conversaciones se distinguen a simple vista en el árbol y en la cuadrícula: se pintan
con el icono **`bot`** de Lucide en el color con el que CoffeeIA firma sus mensajes
(`--vsr-accent-soft`, que cambia solo entre tema claro y oscuro).

Se reconocen por el **marcador del frontmatter**, no por el nombre — el usuario bautiza
el archivo como quiera:

| Pieza | Cambio |
|---|---|
| `DOC_KINDS` (visor.js) | Nueva entrada `{ key: 'chat', icon: 'bot', cls: 'fmt-kind-chat' }`, primera de la lista |
| `Visor.isChatDoc(file)` | `frontmatter.coffeeia === 'conversacion'`; respaldo: regex sobre la cabecera de `raw` (árboles que no traen frontmatter parseado, p. ej. Drive) |
| `Visor.fileFormat(file)` | Comprueba `isChatDoc()` justo después del icono forzado a mano, así gana al nombre y a la extensión |
| `parseFrontmatter()` (PHP y JS) | Ambas listas blancas aceptan ahora la clave `coffeeia`; sin esto el marcador se descartaba al construir el árbol |
| `coffee_visor_icon_keys()` | Incluye `chat`, así que también se puede forzar a mano desde el clic derecho |
| `visor.css` | `.fmt-kind-chat` para `.file-icon` (árbol) y `.docx-ic-file` (cuadrícula) |

El icono se usa además en las filas del modal *Retomar de la carpeta*.
