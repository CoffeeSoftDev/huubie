# Punto 19 · Proceso de generación: qué paso vive en qué pieza

> El punto 19 no agrega reglas: pone en orden las que ya existen y dice en qué secuencia las
> vive el usuario, desde que abre Generar Tickets hasta que imprime. Este documento **separa
> los 19 pasos y le asigna a cada uno la pieza de código que hoy lo cumple**, con su capa y su
> archivo.
>
> **Revisado:** 02/09/2026 · **Leído:** pantalla de Tickets (`facture2`), controlador y modelo
> de Tickets, controlador e importador de Cargas (`facture`).
>
> Sustituye a la revisión del 31/08/2026, donde seis pasos quedaban abiertos. Hoy no queda
> ninguno: los pasos 12 y 13 los cerró el segundo campo del modal de distribución, y los
> pasos 14, 16 y 17 la vista previa del [punto 20](punto-20-vista-previa-antes-de-confirmar.md).

---

## Dónde vive cada cosa

El módulo son cuatro capas y el flujo las recorre en este orden:

| Capa | Archivo | Qué le toca del flujo |
|---|---|---|
| Pantalla | `app/facture2/src/js/tickets.js` | pasos 1, 2, 11, 12, 16, 17, 19 |
| Controlador de Tickets | `app/facture/ctrl/ctrl-facture-tickets.php` | pasos 1, 6, 7, 9, 10, 13, 14, 15, 18, 19 |
| Modelo de Tickets | `app/facture/mdl/mdl-facture-tickets.php` | pasos 4, 5 (el universo del día) |
| Cargas / importador Wansoft | `ctrl-facture-cargas.php` · `import-facture2-cargas.php` | pasos 2, 3, 8 |

---

## Los 19 pasos, uno por pieza

| # | Paso | Pieza que lo cumple | Estado |
|---|---|---|---|
| 1 | Usuario abre Generar Tickets | `App.init()` (tickets.js:40) → `init()` (ctrl:89) | Cumple |
| 2 | Selecciona o carga el Excel | `openUploadModal()` (tickets.js:767) → `sendUpload()` (877) → `inspectFile()`/`uploadFile()` (ctrl-cargas:854 y 910) | Cumple |
| 3 | Valida estructura | `contrato()` (import:98) · `validarEncabezados()` (826) · `columnasMalas()` (874) → `renderUploadRejected()` (tickets.js:1858) | Cumple |
| 4 | Identifica movimientos pagados | `estaPagada()` / `ventaElegible()` (mdl:192 y 107) | Cumple |
| 5 | Identifica movimientos de Tarjeta de Crédito | monto procesable por `pm.name = 'TARJETA DE CREDITO'` (mdl:141-174) · `listCardPaymentsByDay()` (433) | Cumple |
| 6 | Identifica movimientos originalmente en $0.00 | `esCeroDeOrigen()` (ctrl:1965), separado de `esServicio()` (1954) | Cumple |
| 7 | Identifica folios disponibles de Efectivo | `foliosLibres()` (ctrl:692) | Cumple, con un matiz |
| 8 | Descarta registros previamente procesados | `movimientosConocidos()` (import:1224) · `contarDiferencias()` (1249) | Cumple |
| 9 | Resuelve duplicidades de folios (punto 17) | `reasignarCargos()` (ctrl:629) → `planReasignacion()` (654) → `receptorProximo()` (713) | Cumple |
| 10 | Calcula Total Tarjeta de Crédito | `kpisDelDia()` (ctrl:306) sobre `getTicketDayCounts()` | Cumple |
| 11 | Muestra el total | `renderStats()` (tickets.js:1490), celda *Tarjeta de crédito* | Cumple |
| 12 | Usuario captura Monto 16% y Monto 0% | `openMetaModal()` (tickets.js:566) con `fMetaValor` + `fMetaCero` · `onInputMeta()` (653) | Cumple |
| 13 | Valida que ambos sumen el total | Pantalla: `renderMetaPreview()` (697) + `lockMetaOk()` (733) · Servidor: `descuadreDelDia()` (ctrl:141), llamado desde `generateDay()` | Cumple |
| 14 | Genera propuesta de Tickets | `previewDay()` (ctrl) — el cierre sin escribir (punto 20) | Cumple |
| 15 | Genera los Tickets de $0.00 | `guardarTicketServicio()` (ctrl), llamado dentro de `generateDay()` | Cumple |
| 16 | Usuario revisa | `TicketsView.renderPreviewDay()` — la propuesta con nada guardado todavía | Cumple |
| 17 | Usuario confirma | *Confirmar* del modal de vista previa → `App.confirmPreview()` | Cumple |
| 18 | Guarda la generación y sus relaciones | `abrirCorrida()` (554) · `stampReassignmentsByDay()` · `cerrarCorrida()` (594) · `deleteDay()` (1382) | Cumple |
| 19 | Imprime o permite imprimir | `showPrintSheet()` (ctrl:1613) → `printSheet()` (tickets.js:1231) · `printTicket()` (1300) | Cumple |

**Los 19 se cumplen.** Los tres últimos en llegar —14, 16 y 17— los resolvió el
[punto 20](punto-20-vista-previa-antes-de-confirmar.md) el 02/09/2026.

---

## El flujo separado en cinco tramos

### Tramo A · Traer el día (pasos 1 a 3) — pantalla + importador

El módulo abre en el **último día con ventas elegibles**, no en hoy: el Excel del POS se sube en
diferido (`init()`, ctrl:89; con `?dia=` entra directo a uno).

Si el día que se busca no está cargado, la subida ya no obliga a salir a Importación: el botón
**Subir Excel** de la barra (`filterBar()`, tickets.js:399) abre el modal, y `sendUpload()` hace
las dos peticiones del módulo Cargas en orden — `inspectFile` revisa el libro **sin escribir
nada** y solo cuando pasa se manda `uploadFile`. La validación de estructura es del contrato de
Wansoft y el rechazo se explica con su motivo (`hojas`, `otro-tab`, `columnas`, `tickets`).

> El destino lo decide el **contenido** del archivo, no la pantalla desde donde se subió: si el
> libro resulta ser el de comandas o el bancario, `sendUpload()` lo rebota a Importación
> (tickets.js:908-914).

### Tramo B · Depurar el universo del día (pasos 4 a 8) — modelo + importador

| Filtro | Regla | Pieza |
|---|---|---|
| Pagados | de los cuatro estados de Wansoft solo entra **Pagada** | `estaPagada()` (mdl:192) |
| Tarjeta de crédito | el monto procesable suma **solo** los pagos `TARJETA DE CREDITO` | mdl:141-174 |
| $0.00 de origen | las **dos** cifras en cero (`total` y `sale_total`) | `esCeroDeOrigen()` (ctrl:1965) |
| Folios libres | los que ese día no cobraron con tarjeta, en orden de folio, sin los facturados | `foliosLibres()` (ctrl:692) |
| Ya procesados | se cruzan por `pdv_movement` y se omiten uno a uno | `movimientosConocidos()` (import:1224) |

El efectivo **sí** entra al listado, pero con monto procesable cero: es el *servicio de mesa*, y
por eso es el que puede prestar folio en el paso 9.

### Tramo C · Ordenar los folios (paso 9) — controlador

Es lo **primero** que hace el cierre y lo único que reescribe un dato del POS. Se recalcula
entero, nunca en capas: `reasignarCargos()` devuelve primero cada cargo a su folio
(`clearReassignmentsByDay`) y desde ahí reparte otra vez. El folio se queda con el **primer**
cargo que el POS capturó y los sobrantes se mudan al folio libre más cercano hacia adelante;
solo si no queda ninguno adelante se busca atrás.

La mudanza corre **dentro** de `generateDay()` y queda firmada por su corrida
(`stampReassignmentsByDay`), y el día se vuelve a leer después de mudar, porque el reparto se
calcula sobre los montos ya mudados.

### Tramo D · El acuerdo del día (pasos 10 a 13) — pantalla + controlador

1. **Calcula el total** — `kpisDelDia()` (ctrl:306) lo devuelve ya escrito.
2. **Lo muestra** — celda hero de `renderStats()` (tickets.js:1490).
3. **Captura las dos cifras** — el modal *Distribución IVA 16% / IVA 0%* tiene los dos campos.
   El que todavía no se toca **sigue** al otro (`metaTouched`, `onInputMeta()`), así que capturar
   sigue costando un gesto; en cuanto se tocan los dos, ninguno se autocompleta.
   El selector porcentaje/cantidad **traduce**, no reinicia (`onChangeMetaModo()`).
4. **Valida la suma** — en dos capas, y la del servidor no es adorno:
   - Pantalla: `renderMetaPreview()` compara `16% + 0%` contra el total con tolerancia
     `< 0.005`, nombra la diferencia y de qué lado está, y `lockMetaOk()` apaga *Aplicar*
     mientras no cuadre.
   - Servidor: `descuadreDelDia()` (ctrl:141) rehace la misma cuenta y `generateDay()` la
     consulta **antes de mudar un solo cargo** — el cierre se puede llamar sin pasar por el modal.

La meta **viaja en cada petición** (`getFilters()`, tickets.js:529) en vez de guardarse: el
listado, el cierre y la hoja tienen que verla igual.

### Tramo E · Proponer, confirmar y escribir (pasos 14 a 19) — controlador + pantalla

El botón *Generar ticket* ya no escribe: pide la propuesta con `previewDay()`, que es el cierre
entero **sin guardar nada** —hasta la mudanza de cargos se simula en memoria—, y la enseña. El
usuario confirma, cancela o pide otra combinación de productos (punto 20).

Con el confirmar corre `generateDay()` (ctrl), que sí es un solo golpe: valida → muda cargos →
relee el día → `planReparto()` → abre corrida → suelta las notas previas → recorre las ventas
armando papel → cierra corrida → devuelve el resumen.

Dentro de ese recorrido, cada grupo recibe lo suyo:

- **Servicio de mesa y $0.00** (paso 15) → `guardarTicketServicio()`: un solo renglón, sin
  producto, en $0.00. Se atiende **antes** de preguntarle al plan, porque el plan ni siquiera lo
  agrupó.
- **16%** → si trae su comanda y cuadra, se respeta el papel real; si no, se arma del catálogo de
  IVA (`guardarTicketVirtual`).
- **0%** → siempre papel inventado con los productos puente.

El histórico (paso 18) queda en tres piezas: `abrirCorrida()` guarda con qué meta se pidió el día,
qué objetivo salió y en qué venta corta; `stampReassignmentsByDay()` firma las mudanzas con esa
corrida; `cerrarCorrida()` guarda los conteos de lo que **de verdad** quedó armado. `deleteDay()`
lo deshace en el orden que la FK exige y devuelve los cargos a su folio.

La impresión (paso 19) es `showPrintSheet()` + `renderPrintSheet()`, con el mismo componente
`ticketPaper` que pinta el panel lateral.

---

## El hueco que se cerró (pasos 14, 16 y 17)

Hasta el 02/09/2026 este documento terminaba señalando un solo hueco: **entre calcular y escribir
no había nada**. `generateDay()` validaba, repartía y guardaba en la misma petición, y lo que el
usuario veía del reparto lo veía después, cuando los papeles ya existían.

Lo cerró el **[punto 20](punto-20-vista-previa-antes-de-confirmar.md)**:

| Paso | Cómo se cumple ahora |
|---|---|
| 14 · Propuesta | `previewDay()`: mismas validaciones, mismo `planReparto()`, la mudanza simulada en memoria (`montosDelPos()` + `conMudanza()`) y ni una fila escrita |
| 16 · Revisión | el modal enseña el total con tarjeta, el reparto por tasa, cuántos papeles salen y qué folios cambian de mano |
| 17 · Confirmación | tres salidas: *Confirmar* (verde, es el único botón del módulo que escribe el cierre), *Cancelar* y *Regenerar* |

`generateDay()` no cambió de reglas: cambió de disparador. Ahora cuelga del *Confirmar* del modal,
y recibe además la semilla de la combinación que se aprobó.

---

## Cabos sueltos

**El paso 7 dice "provenientes de Efectivo", pero `foliosLibres()` pregunta por `esServicio()`.**
Desde el punto 18 esa función agrupa **dos** casos —el efectivo y el movimiento que vino en
$0.00—, así que un movimiento que nació en cero puede recibir hoy un cargo mudado, y al recibirlo
deja de valer cero y pierde el ticket de $0.00 que el punto 18 le garantiza. Si la casa quiere que
solo el efectivo preste folio, la línea 697 del controlador tiene que exigir además que el
movimiento **haya cobrado algo**: `!esCeroDeOrigen($item)`.

**`metaCero` es opcional en el servidor.** `descuadreDelDia()` responde vacío si la petición no lo
trae (ctrl:148-150): es la retrocompatibilidad con la pantalla anterior al segundo campo. La
pantalla de hoy siempre lo manda, pero mientras esa puerta siga abierta el paso 13 se puede
saltar llamando al controlador sin él.

**Nada impide en la base que una venta tenga dos papeles.** Heredado del punto 18: el único
candado del esquema es el número de nota único por día y sucursal. El candado vive en el JS
(`runLocked()`), que es de una pestaña. `previewDay()` no lo agrava —no escribe—, pero tampoco lo
arregla.

**El confirmar no comprueba que el día siga siendo el que se aprobó.** Si entra una carga nueva
entre la propuesta y el *Confirmar*, la numeración de notas se recorre y lo que se escribe deja de
ser lo que se autorizó. Detallado en el punto 20.
