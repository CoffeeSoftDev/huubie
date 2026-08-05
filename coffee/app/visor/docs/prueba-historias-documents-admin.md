# Prueba de la regla `historias-de-usuario.md` — Visor / Admin de documentos

Ejercicio de validación del conocimiento cargado en el agente **CoffeePlanner**
(`coffee-planner.md`, agents.sqlite id 4). Módulo elegido: **Admin de documentos**
del visor, tomando las operaciones reales de `ctrl/ctrl-documents-admin.php`
(`list`, `read`, `save`, `upload`, `mkdir`, `rename`, `delete`) y la pantalla de
`documents-admin.html`.

## SPRINT 1

| Yo ( Usuario) | En el apartado | Quiero (funcionalidad) | Beneficio (para qué) | Criterios de aceptación | Sprint | Points | Fecha |
|---|---|---|---|---|---|---|---|
| **ADMIN DE DOCUMENTOS** | | | | | | | |
| ADMIN | EXPLORADOR DE PROYECTOS | Visualizar los documentos de un proyecto en un árbol de carpetas, pudiendo buscar por nombre de proyecto y por nombre de documento. | Para localizar rápido el documento que se necesita sin recorrer el disco del servidor. | El apartado debe contener los siguientes elementos:<br><br>filterBar:<br>- Buscador de proyecto ( placeholder "Buscar proyecto..." )<br>- Buscador de documento por nombre<br>- Botón de nueva carpeta<br>- Botón de subir archivo ( primary )<br><br>Árbol de carpetas del proyecto seleccionado:<br>- Nombre de carpeta con contador de documentos<br>- Al seleccionar una carpeta se listan sus documentos<br><br>Listado de documentos:<br>- Nombre del documento<br>- Extensión ( badge )<br>- Tamaño<br>- Última modificación<br>- Botones de acción<br>&nbsp;&nbsp;&nbsp;- ver, renombrar, eliminar<br><br>* Mientras no se elija proyecto se muestra el estado vacío "Selecciona un proyecto"<br>* Solo se listan las rutas dentro de la raíz configurada del proyecto | 1.0 | | 4 ago - 17 ago |
| ADMIN | EDITOR DE DOCUMENTO | Abrir un documento markdown, editarlo y guardarlo sin salir del visor. | Para corregir la documentación en el momento en que se detecta el error. | Al precionar el botón de ver se abre el documento con lo siguiente:<br><br>Header:<br>- Ruta del documento<br>- Fecha de última modificación<br>- Tabs [ Vista, Código ]<br><br>Body:<br>- Vista: el markdown renderizado<br>- Código: el texto plano editable<br><br>Footer:<br>- Botón cancelar<br>- Botón guardar<br><br>* El botón de guardar solo se habilita si hubo cambios<br>* Al guardar se actualiza la fecha de modificación del listado<br>** IMPORTANTE **<br>- Guardar sobreescribe el archivo en disco: se pide confirmación cuando el documento cambió desde que se abrió | 1.0 | | 4 ago - 17 ago |
| ADMIN | SUBIR Y ELIMINAR DOCUMENTOS | Subir documentos a la carpeta seleccionada y eliminar los que ya no aplican. | Para mantener la documentación del proyecto al día desde la misma pantalla. | Al precionar el botón de subir archivo se abre un modal con los siguientes campos:<br>- Proyecto ( fijo, el seleccionado )<br>- Carpeta destino<br>- Archivo ( arrastrar o seleccionar )<br>- Botón cancelar y subir<br><br>Al precionar el botón de eliminar:<br>El sistema solicita confirmación explícita ( modal de advertencia con el nombre y la ruta del documento ).<br>El usuario confirma la eliminación.<br>El sistema elimina el archivo y refresca el listado.<br>El usuario recibe confirmación de la eliminación exitosa.<br><br>* Se valida que el nombre no exista ya en la carpeta destino<br>* Se debe guardar quién subió el documento y cuándo<br>* No se permite salir de la raíz del proyecto al elegir carpeta destino ( ni con `..` ) | 1.0 | | 4 ago - 17 ago |

---

## Verificación contra el checklist de la regla

| # | Punto | Resultado |
|---|---|---|
| 1 | Usuario, apartado, funcionalidad y "Para…" | Sí |
| 2 | Criterios nombran filterBar, listado, columnas y campos de modal | Sí |
| 3 | Reglas con `*` / `** IMPORTANTE **` | Sí — raíz del proyecto, duplicados, sobreescritura |
| 4 | Alcance y quién captura | Sí — raíz configurada del proyecto, "quién subió el documento" |
| 5 | Duplicación por perfil | No aplica: el módulo tiene un solo perfil (ADMIN) |
| 6 | Filas banner | Sí — `ADMIN DE DOCUMENTOS` |
| 7 | Sprint y fechas | Sí; Points vacío a propósito |
| 8 | Qué pasa al eliminar | Sí — confirmación con ruta + refresco del listado |
