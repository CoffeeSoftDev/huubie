# Si el código cumple el punto 22 (folios de ticket) y el 22.1 (identidad interna)

> El punto 22 pide una sola cosa: que el número que el ticket enseña sea el que trajo el
> movimiento importado del POS, y que el sistema **no** lo reemplace por una secuencia
> inventada (`TCK-000001`). El 22.1 pide algo distinto: que además del folio visible el ticket
> tenga una **identidad técnica propia**, y que cuando haya reasignación se conserven **los dos**
> folios —el visible y el original—.
>
> **Leído:** los dos importadores (Wansoft y Soft Restaurant), el controlador y el modelo de
> Tickets, el papel del ticket, el DDL y las migraciones 08 y 09 ·
> **Auditado:** 01/09/2026 · **Corregido el 22.1:** 01/09/2026 (migración 15)

---

## Veredicto corto

**Los dos se cumplen.** El 22 ya se cumplía; el 22.1 se cumplía a medias y se corrigió el mismo
día (ver sección 5).

El folio del ticket es el movimiento PDV tal cual llegó del archivo, y en el módulo no existe
ninguna secuencia artificial de folios: no hay prefijo `TCK-`, ni `str_pad`, ni contador que
numere folios. El único consecutivo que el sistema genera es la **Nota** (`#12`), que es otro
dato del ERS y vive en su propia columna, sin desplazar al folio.

| Lo que pide el punto | Estado |
|---|---|
| 22 · Folio del Ticket = Movimiento PDV | Cumple |
| 22 · No sustituir por secuencia artificial (`TCK-…`) | Cumple: no existe en el código |
| 22 · Duplicidad resuelta con la regla del punto 17 | Cumple |
| 22.1 · ID interno **único** | Cumple |
| 22.1 · ID interno **permanente** | Cumple desde la migración 15: regenerar actualiza el papel, ya no lo sustituye |
| 22.1 · Folio visible distinguido del original | Cumple: `visible_folio` y `origin_folio` en el ticket |
| 22.1 · Conservar ambos cuando hay reasignación | Cumple: se congelan al emitir, no dependen de la mudanza vigente |

Quedan **dos observaciones de presentación** (no de dato) al final.

---

## 1. De dónde sale el folio

### Wansoft — el movimiento PDV se copia al folio

`guardarVentas()` ([import-facture2-cargas.php:1215](../ctrl/import-facture2-cargas.php)) agrupa
las filas del Excel por movimiento PDV y escribe la venta con el mismo valor en las dos columnas
(línea 1250):

```php
'folio'        => $t['pdv'],
'billing_code' => null,
'pdv_movement' => $t['pdv'],
```

La migración lo deja escrito como regla, y además explica qué **no** puede ser el folio
([migra-05-wansoft.sql:164-167](../sql/migra-05-wansoft.sql)):

> `pdv_movement` es el identificador estable del ticket en Wansoft (6266, 6267…) y es el que se
> copia a `folio`. La «Orden» del día va en `order_number` y **NO** puede ser el folio: reinicia
> en 1 cada día y chocaría con `uk_sale_folio` en la segunda carga.

Es decir: el sistema ya rechazó explícitamente usar un número que reinicia, y se quedó con el
movimiento, que es lo que el punto 22 pide.

### Soft Restaurant — el folio del reporte de ventas

`guardarVentas()` ([import-facture-cargas.php:812](../ctrl/import-facture-cargas.php)) toma la
columna **Folio** del "Reporte de ventas" (línea 819: `'folio' => $v[0]`), declarada en el
contrato del libro como primera columna de la hoja. Tampoco se calcula nada.

En los dos POS el folio es **dato importado**, nunca generado.

---

## 2. Que no exista la secuencia artificial

- Búsqueda de `TCK` en todo `app/`: **cero coincidencias** en el facturador (solo aparece en un
  template de inventarios y en una fuente de iconos, sin relación).
- No hay `sprintf` de folios ni `str_pad` sobre folio: el único `str_pad` del controlador
  ([ctrl-facture-tickets.php:1962](../ctrl/ctrl-facture-tickets.php)) rellena los **centavos** al
  pasar el importe a letras.
- La tabla `virtual_ticket` **no tiene columna de folio**
  ([ddl-facturacion.sql:220-241](../sql/ddl-facturacion.sql)): el papel se cuelga de la venta por
  `sale_id` y toma prestado el folio de ella. Un ticket virtual no puede tener folio propio
  porque el esquema no le dio dónde guardarlo.
- El único número que el sistema sí genera es `note_number` — la **Nota #N** que reinicia cada
  día, con `UNIQUE (issue_date, note_number, branch_id)`. Es un requisito aparte del ERS
  («NOTA: #12», consecutivo diario) y ocupa su propia columna, no la del folio.

---

## 3. Dónde se ve el folio

| Lugar | Qué imprime | Referencia |
|---|---|---|
| Listado del día, columna **Folio** | `sale.folio` | [ctrl-facture-tickets.php:343](../ctrl/ctrl-facture-tickets.php) |
| Cabecera del papel (dato `folio`) | `sale.folio` | [ctrl-facture-tickets.php:428](../ctrl/ctrl-facture-tickets.php) |
| Papel impreso, renglón `FOLIO:` | `e.folio` | [ticketPaper.js:272](../src/js/components/ticketPaper.js) |
| Papel Wansoft, renglón `Movimiento:` | `e.movimiento \|\| e.folio` | [ticketPaper.js:351](../src/js/components/ticketPaper.js) |
| Selección, panel y regeneración | se piden **por folio** (`getTicketByFolio`) | [mdl-facture-tickets.php:361](../mdl/mdl-facture-tickets.php) |

Hoy los dos POS imprimen el papel de Soft Restaurant (`PRESTADO`,
[ticketPaper.js:146](../src/js/components/ticketPaper.js)) porque del ticket físico de Wansoft
todavía no hay muestra que copiar. Ese papel rotula el número como `FOLIO:` y el valor es el
movimiento importado.

---

## 4. Duplicidad de folio → punto 17

La base impide que dos ventas compartan folio: `UNIQUE KEY uk_sale_folio (folio, branch_id)`
([ddl-facturacion.sql:204](../sql/ddl-facturacion.sql)). Por eso la duplicidad que el punto 17
resuelve no es de ventas sino de **cargos**: varios pagos con tarjeta capturados sobre el mismo
`sale_folio`.

`reasignarCargos()` ([ctrl-facture-tickets.php:583](../ctrl/ctrl-facture-tickets.php)) muda el
cargo sobrante al folio libre más cercano mediante `payment.assigned_folio`, **sin tocar el folio
de ninguna venta ni renumerar nada**: la venta receptora sigue imprimiendo su propio movimiento
PDV, y el listado marca de dónde vino y a dónde se fue el cargo (`recibido_de` / `cedido_a`,
[mdl-facture-tickets.php:259-267](../mdl/mdl-facture-tickets.php)). Es exactamente lo que el punto
22 delega al 17.

---

## 5. Punto 22.1 — las tres identidades

### 5.1 Lo que la auditoría encontró

`virtual_ticket.id` (`INT AUTO_INCREMENT PRIMARY KEY`) era identidad **única** pero no
**permanente**: el papel no se actualizaba, se borraba y se volvía a crear.

- Regenerar un ticket suelto: `generarFolio()` hacía `deleteVirtualTicket()` y después
  `createVirtualTicket()`. Se conservaba **la nota** —«ya se entregó y no puede cambiar de
  número»—, no el id.
- Rehacer el día: `generateDay()` soltaba todos los papeles del día antes de rearmar, para que
  la numeración pudiera recorrerse sin chocar contra el `UNIQUE (issue_date, note_number,
  branch_id)`.

Consecuencia: el mismo ticket, con la misma nota, el mismo folio y los mismos importes, podía
tener hoy el id 4 810 y mañana el 5 233.

Y el par de folios del 22.1 existía, pero fuera del ticket: `detail_sale_payment.sale_folio` +
`assigned_folio`, que el cierre **reescribe entero** en cada corrida. Un papel impreso ayer no
podía decir de qué folio recibió su cargo si el día se rehacía hoy.

Dos detalles menores que apuntaban a lo mismo: de cara al front el identificador era el folio
(`'id' => $item['folio']`, `selectTicket(folio)`), y el id recién insertado se recuperaba con
`MAX(id)` sobre la tabla entera, sin filtrar por sucursal ni por día.

### 5.2 Lo que se cambió (migración 15)

**En la base** — [migra-15-identidad-ticket.sql](../sql/migra-15-identidad-ticket.sql), con su
rollback y ya enganchada en `aplica-migraciones.bat`:

| Columna nueva en `virtual_ticket` | Qué guarda |
|---|---|
| `visible_folio` | el folio que salió impreso, foto de `sale.folio` al emitir |
| `origin_folio`  | el movimiento PDV del que salió el cargo que ampara; igual al visible cuando no hubo reasignación |

Son una **foto, no un enlace** —mismo espíritu que `detail_virtual_ticket.description`, que
guarda el nombre del producto en vez de leerlo del catálogo—. La migración rellena los papeles
ya emitidos: el visible sale de su venta y el original de los cargos mudados hacia ese folio.

**En el código:**

- `guardarPapel()` ([ctrl-facture-tickets.php](../ctrl/ctrl-facture-tickets.php)) concentra la
  escritura del papel: si la venta ya tenía ticket lo **actualiza**, y solo reemplaza los
  renglones. Lo usan las tres rutas que emitían papel por su cuenta (`guardarTicketVirtual`,
  `guardarTicketServicio`, `generarFolio`), que antes repetían insert + `MAX(id)` + renglones.
- Los dos folios se calculan ahí con `folioOrigen()`, que prefiere lo que el ticket ya guardó y
  solo cae a la mudanza vigente cuando el papel todavía no existe.
- `generateDay()` ya no borra los papeles del día: **suelta su nota** guardándola en negativo
  (`releaseVirtualNotes`), cada venta actualiza la suya y al final se borran únicamente los que
  nadie reutilizó (`deleteReleasedVirtualTickets`). Así la numeración se puede recorrer entera
  sin chocar con el UNIQUE y sin que el papel cambie de identidad.
- El id recién insertado se busca por su **llave natural** (`getVirtualTicketByNote`: día + nota
  + sucursal, que ya es única) en vez de `MAX(id)`.
- `cabecera()` publica las tres identidades en la respuesta de `getTicket` (`id`, `folio`,
  `folioOrigen`, más `reasignado`), y la celda del listado lleva `data-id`.

### 5.3 Verificado contra la base local

Con los 26 papeles del 22/08/2026, uno de ellos con cargo mudado (el folio 6276 ampara los
$1,070.00 que se cobraron en el 6275):

| Prueba | Resultado |
|---|---|
| Migración + relleno de los papeles ya emitidos | 26 de 26 con `visible_folio`; 1 con `origin_folio` distinto (6276 ← 6275) |
| Rehacer el día completo (`generateDay`) | los 26 ids intactos (213…238), ninguna nota negativa colgada, cero renglones huérfanos |
| Regenerar un ticket suelto (`generate` del folio 6289) | conserva id 226 y nota #24, renglones reemplazados |
| Reparto forzado al 100 % (papeles que sobran) | quedan 18, se borran los 8 sobrantes, sin ids nuevos: los supervivientes se actualizaron |
| `getTicket` del folio receptor | `id: 219`, `folio: 6276`, `folioOrigen: 6275`, `reasignado: true` |

### 5.4 Folio visible

`sale.folio`, con `UNIQUE (folio, branch_id)`, y ahora también congelado en el papel. Ver
secciones 1 y 3.

### 5.5 Folio original — dos datos con dos oficios distintos

**El ticket nunca cambia de folio.** Lo que la reasignación del punto 17 muda es el **cargo**, no
el papel, y ese dato se queda donde estaba
([migra-09-reasignacion-cargos.sql:19-23](../sql/migra-09-reasignacion-cargos.sql)):

> `assigned_folio` es esa mudanza. […] El dato original **NO** se toca: `sale_folio` sigue
> diciendo dónde lo cobró el POS, que es lo que el Excel reportó y lo que la conciliación
> bancaria va a buscar.

Después de la migración 15 conviven dos registros del mismo hecho, y es a propósito:

| Dónde | Qué es | Quién lo usa |
|---|---|---|
| `detail_sale_payment.sale_folio` + `assigned_folio` | la mudanza **vigente**, que el cierre recalcula entera cada vez | la aritmética del día (`COALESCE`), los badges `recibido_de` / `cedido_a`, la conciliación bancaria |
| `virtual_ticket.visible_folio` + `origin_folio` | lo que decía el papel **cuando se emitió** | el documento entregado, que ya no cambia porque el día se rehaga |

`folioOrigen()` respeta esa jerarquía: si el ticket ya guardó su origen, manda el guardado; si el
papel todavía no existe, se lee de la mudanza vigente, que es justo la que se va a congelar al
generarlo.

### 5.6 Lo que quedó fuera

- **`deleteDay()` sigue borrando de verdad.** Eliminar el día es una acción explícita del
  usuario, distinta de rehacer el reparto: ahí el papel desaparece con su id. Si la casa quiere
  que un documento entregado nunca se borre de la base, eso es baja lógica y una regla de
  negocio nueva, no parte del 22.1.
- **`getMaxGenerationRunId()`** sigue resolviendo el id de la corrida con `MAX(id)`. Es el mismo
  patrón que se corrigió en el ticket, pero la corrida no es la identidad de ningún documento
  entregado, así que se dejó como estaba.
- **El papel impreso no muestra el folio de origen.** El dato viaja en la respuesta
  (`folioOrigen`, `reasignado`) y el listado ya lo enseña con su badge `← 6275`; imprimirlo en la
  tira es decisión de la casa, no un requisito del punto.

---

## Observaciones (presentación, no dato)

**1. En pantalla la Nota pesa más que el folio.** En el listado la primera columna es *Nota*
(`#12`, en badge) y el folio va después, en gris y a 10 px
([ctrl-facture-tickets.php:342-343](../ctrl/ctrl-facture-tickets.php)); el panel del papel se
titula *«Ticket virtual · Nota 12»* ([tickets.js:835](../src/js/tickets.js)). El dato cumple —el
folio está y es el movimiento—, pero quien mire la pantalla rápido lee primero un consecutivo
diario. Si la casa quiere que el punto 22 también se vea, es cambiar jerarquía visual (folio en
grande, nota como acompañante), no lógica.

**2. El papel de Wansoft, cuando se active, imprime la nota donde va la cuenta.**
`paperWansoft` pone en el bloque central `e.cuenta || e.nota`
([ticketPaper.js:392](../src/js/components/ticketPaper.js)), y para un ticket generado ese valor
llega como `#12` ([ctrl-facture-tickets.php:1590](../ctrl/ctrl-facture-tickets.php)). El folio
sigue impreso abajo en `Movimiento:`, así que no lo sustituye, pero conviene revisar ese hueco
contra la tira física el día que llegue la muestra y se retire `PRESTADO`.
