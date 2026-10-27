# Punto 24 — Reimpresión de Tickets

> El punto 24 pide tres cosas: que la **pantalla principal** ofrezca un botón de *Reimpresión de
> Tickets*; que desde ahí se puedan **consultar tickets ya generados**; y que la consulta acepte
> **una fecha específica** (`22/08/2026`) **o un rango** (`20/08/2026 al 22/08/2026`).
>
> **Tocado:** la pantalla de reimpresión de la terminal Wansoft, su controlador y modelo —nuevos— y
> el tema del módulo · **Fecha:** 01/09/2026

---

## Veredicto corto

El botón del menú y la búsqueda por día ya existían, pero contra una muestra en el JS. Ahora la
pantalla **consulta la base**: `ctrl-facture2-pos.php` + `mdl-facture2-pos.php`, que leen las
ventas del POS en el esquema del Facturador, con el papel virtual unido cuando ya se emitió.

| Lo que pide el punto | Antes | Ahora |
|---|---|---|
| Botón *Reimpresión de Tickets* en la pantalla principal | Cumple | Cumple |
| Consultar tickets previamente generados | Contra una muestra en el JS | **Contra `sale` + `detail_sale`, y `virtual_ticket` cuando existe** |
| Seleccionar una fecha específica | Cumple | Cumple, y se lee `22/08/2026` |
| Seleccionar un rango de fechas | **No existía** | **Cumple: `20/08/2026 al 22/08/2026`** |

---

## Cómo se busca

La pregunta se hace en dos pisos, porque son dos preguntas distintas:

```
┌──────────────────────────────────┐
│  ( ) Ticket      (•) Fecha       │   ← cómo se busca
└──────────────────────────────────┘
┌──────────────────────────────────┐
│  (•) Fecha específica  ( ) Rango │   ← solo aparece dentro de "Fecha"
│         Fecha:  22/08/2026       │
└──────────────────────────────────┘
```

El rango **no es un tercer modo**: es una forma de la fecha, y ponerlo arriba junto a *Ticket* lo
presentaba como una manera distinta de buscar. Por eso la segunda fila vive dentro de la cajita de
captura y solo existe cuando la búsqueda es por fecha.

| Modo | Se captura | Panel |
|---|---|---|
| **Ticket** | Número de orden + movimiento, con el teclado numérico | El papel del ticket |
| **Fecha → Fecha específica** | Un día (`singleDatePicker`) | La lista de ese día |
| **Fecha → Rango** | Los dos extremos | La lista del período, con columna **Fecha** |

Fecha y rango van con calendarios distintos y no con uno solo de rango: en una pantalla táctil,
pedir un día suelto tocando dos veces el mismo número es el gesto que más se falla, y el día suelto
es la búsqueda de todos los días. Es la misma decisión que ya había tomado el filtro de período de
[Ventas](../src/js/ventas.js).

El campo se rotula con el formato del recibo (`DD/MM/YYYY`) y con un separador que se lee
(`separator: ' al '`), así que escribe exactamente lo que pide el punto: `22/08/2026`, o
`20/08/2026 al 22/08/2026`.

---

## De dónde salen los datos

Dos archivos nuevos, autocontenidos, que leen el esquema del Facturador —es la misma operación
vista desde el mostrador— pero solo lo que la terminal necesita. Nada de aquí genera folios ni
reparte el día: eso vive en `ctrl-facture-tickets.php` y ahí se queda.

| `opc` | Qué devuelve | Modelo |
|---|---|---|
| `init` | Días con ventas cobradas, el período de apertura y el emisor | `lsDias`, `getEmisor`, `getPosCode` |
| `lsTickets` | Encabezado + filas del período (`fi`, `ff`) | `listTickets` |
| `getTicket` | El ticket completo por movimiento, cotejando la orden | `getTicketByFolio`, `getSaleByFolio`, `listTicketLines`, `listSaleLines` |
| `getTickets` | Los papeles marcados, para imprimirlos juntos ([punto 25](punto-25-seleccion-y-reimpresion.md)) | `listTicketsByFolios`, `listTicketLinesByTickets`, `listSaleLinesBySales` |

### Los dos papeles del día

El día entregó **dos clases de ticket**, y la terminal reimprime las dos:

| Papel | Dónde vive | Cuándo se usa |
|---|---|---|
| **Inventado** | Fila viva de `virtual_ticket` + `detail_virtual_ticket` | Lo arma el reparto del cierre: la venta que va al 0%, y la del 16% cuya comanda no cuadra |
| **Real** | La propia venta + `detail_sale` | La venta cuya comanda cuadra con su cuenta. El cierre **no le guarda documento a propósito** (ver `generateDay`): su ticket es el consumo que el POS exportó y no hay nada que inventarle |

Por eso la consulta parte de la **venta** y el papel entra con `LEFT JOIN`.

> **Corrección de la versión anterior.** Este documento decía que la fuente era `virtual_ticket` con
> `INNER JOIN sale`, y que una venta sin papel aprobado "no tiene nada que reimprimir". Eso confundía
> dos cosas distintas: la venta que **todavía** no tiene papel y la que **nunca** lo va a tener
> porque su ticket es el real. En el día del 22/08/2026 eso dejaba fuera 10 de 36 movimientos de
> forma permanente —el cliente traía el ticket en la mano y la pantalla contestaba que no existía—.
>
> Lo que aquella nota rechazaba con razón sigue en pie: reimprimir **no** es reimprimir la cuenta.
> Por eso el papel real no se arma de cero, se lee tal como el POS lo entregó, y el importe del papel
> aprobado sigue mandando sobre el de la venta cuando existe.

| Qué se imprime | Papel inventado | Papel real |
|---|---|---|
| Renglones | `detail_virtual_ticket` — las partidas tal como se emitieron | `detail_sale` — el consumo que exportó el POS |
| Subtotal y descuento | `virtual_ticket.subtotal` menos su ajuste de cuadre | Deducidos del total; el descuento es lo que los renglones suman de más |
| IVA y total | `virtual_ticket.tax` y `virtual_ticket.total` | La tasa de la venta aplicada sobre `sale.total` |

La venta que llega **sin comanda cargada** no se queda en blanco: se imprime una sola partida —
`CONSUMO`, o `SERVICIO DE MESA` si el movimiento vino en $0.00— igual que hace el Facturador.

### Qué es cada número de la pantalla

- **Movimiento** = `COALESCE(virtual_ticket.visible_folio, sale.folio)`. Es el folio **impreso**, no
  el de la venta: cuando el cierre muda un cargo (punto 17) el papel conserva el suyo, y es el que
  el cliente trae en la mano. Los papeles anteriores a la migración 15 caen al folio de su venta.
- **Orden** = `virtual_ticket.note_number` cuando hay papel aprobado. El papel real todavía no tiene
  nota, y en su lugar va **el sitio que la venta ocupa en su día** por folio ascendente, que es
  exactamente la nota que el cierre le pondría. Se resuelve en la base (`notaSelect`) y no contando
  filas en PHP: la tanda de impresión solo trae lo marcado, y contando ahí numeraría desde 1.
  Reinicia cada jornada, y por eso las listas de varios días se ordenan por fecha y luego por él.

El ticket se busca por el movimiento —que es el que identifica— y la orden se coteja después. Con
eso la pantalla distingue **tres respuestas** en vez de una:

| Lo que pasó | Lo que dice |
|---|---|
| El movimiento no existe | *No existe el movimiento 9999* |
| Existe pero no llegó a cobrarse (abierto, cancelado, eliminado) | *El movimiento 7112 no quedó cobrado: no tiene ticket que reimprimir* |
| Existe y es otra orden | *El movimiento 6266 es la orden 1, no la 5* |

La segunda importa: el universo de la terminal es el mismo que el del módulo de Tickets
(`ventaElegible` — en Wansoft la venta *Pagada*, en Soft Restaurant la que dejó rastro bancario).
Los dos módulos tienen que hablar del mismo día, o el ticket que uno emite es un movimiento que el
otro no conoce.

### Lo que el POS no exporta

Mesa y mesero salen de la comanda cuando está cargada (`detail_sale`); cuando no, se arman con la
semilla del folio, **con las mismas funciones del Facturador**, para que un papel reimpreso aquí
salga idéntico al que se emitió allá. Personas y cajero no existen en el esquema: el primero es
función del folio, el segundo es la constante `CAJERO_TERMINAL`.

La **hora** solo se imprime si la venta la trae. Wansoft exporta la fecha de operación sin hora y la
columna llega en medianoche exacta: escribir `00:00` se leería como una venta cobrada a las doce de
la noche. Cuando ninguna venta del período tiene hora, la columna **no aparece** en la lista.

### El servidor decide las columnas

`lsTickets` devuelve `thead` junto con `row`, y el JS pinta lo que llega. Dos columnas solo salen
cuando dicen algo —**Fecha** con más de un día, **Hora** cuando alguna venta la trae—, y decidirlo
también en el frente dejaría a la tabla y a las filas discutiendo cuántas columnas hay. El clic de
la fila localiza orden y movimiento por ese mismo encabezado, no por posición fija.

---

## Estado interno de la pantalla

`this.mode` (`ticket` | `fecha`) y `this.dateMode` (`dia` | `rango`), más **`fi` / `ff`**: el picker
de día suelto también devuelve dos extremos —iguales entre sí—, así que el filtrado, la lista y el
rótulo trabajan siempre con un período. Al volver de *Rango* a *Fecha específica*, el período se
cierra sobre su primer día.

El período de apertura lo decide el servidor: es el **último día con ventas**, no hoy. El Excel del
POS se sube en diferido y abrir en la fecha del reloj dejaría la pantalla vacía la mayor parte del
tiempo. Por lo mismo, los atajos del calendario (*Último día · Últimos 3 días · Últimos 7
días*) cuelgan de ese día y no del reloj.

El teclado numérico se apaga en modo fecha —los dígitos no capturan nada ahí— pero no desaparece:
**Enter**, **Borrar** y **ESC** siguen sirviendo, y los dos primeros devuelven a la lista.

---

## El calendario, traducido a papel

La copia de `daterangepicker.css` que sirve a todo Huubie viene tuneada en oscuro (`#1F2A37`) **sin
condicionarlo al tema del body**, así que en esta terminal —blanca de punta a punta— el popup salía
negro. Se repinta en [wansoft-theme.css](../src/css/wansoft-theme.css) bajo
`html[data-wansoft-theme]`, sin tocar al resto del ecosistema: fondo de papel, tinta en los días,
gris en los del mes vecino, la columna de atajos separada por un filete y los días intermedios del
período en el azul de la terminal rebajado.

---

## Probado contra la base

Con los papeles emitidos que había en la sucursal 1 (RYORI RYOKAN) el 22/08/2026:

| Prueba | Resultado |
|---|---|
| `init` | Abre en `2026-08-22`, con el emisor y su logo |
| Fecha específica `22/08/2026` | Los 26 papeles del día, sin columna Fecha ni Hora |
| Rango `20/08/2026 al 22/08/2026` | Los mismos **con** columna Fecha |
| Clic en la fila del movimiento 6276 | Papel del folio 6276, $1,070.00, *MIL SETENTA PESOS 00/100 M.N.* |
| Modo Ticket, orden 11 + movimiento 6276 | El mismo papel, sin botón de regreso |

El folio 6276 es además el caso del punto 17: viajó con `folioOrigen: 6275` y `reasignado: true`.

Después se deshizo ese día en el módulo de Tickets y la base se quedó con las ventas pero sin un
solo papel. La pantalla respondió con **lista vacía**, que en su momento se dio por bueno.

### Corrección del 02/09/2026 — faltaban 10 de 36 movimientos

De ahí salió el defecto: partiendo de `virtual_ticket` la lista del 22/08 mostraba **26 filas** con
las órdenes 3, 4, 5, 7, 9… saltadas. Los 10 ausentes no estaban pendientes de nada — son las ventas
cuya comanda cuadra, a las que el cierre **no les guarda documento a propósito**, así que el hueco
era permanente.

| Prueba (22/08/2026, sucursal 1) | Antes | Ahora |
|---|---|---|
| Lista del día | 26 filas, órdenes salteadas | **36 filas, órdenes 1 a 36 correlativas** |
| Movimiento 6266, orden 1 | *"aún no tiene ticket generado"* | Papel real: 7 renglones, $798.28 + $127.72 = **$926.00** |
| Movimiento 6266, orden 5 | — | *"El movimiento 6266 es la orden 1, no la 5"* |
| Movimiento 9999 | *"No existe el movimiento 9999"* | Igual |
| Movimiento 7112 (cancelado) | *"aún no tiene ticket generado"* | *"no quedó cobrado: no tiene ticket que reimprimir"* |
| Rango 09/07 al 22/08 | — | 59 filas, con columna Fecha y la orden reiniciando cada día |

La convivencia de los dos papeles se comprobó sembrando dos tickets aprobados sobre ese mismo día
—uno al 0% con ajuste de cuadre y otro al 16%— y pidiendo los tres juntos a `getTickets`:

| Movimiento | Papel | Resultado |
|---|---|---|
| 6266 | Aprobado 0% | 2 renglones, subtotal $500.00, descuento $50.00, total **$500.00** |
| 6284 | Aprobado 16% | $3,600.86 + $576.14 = **$4,177.00** |
| 6301 | Real | 28 renglones de comanda, $1,877.59 + $300.41 = **$2,178.00** |

Las órdenes de la tanda (1, 19 y 36) salieron iguales a las de la lista, que era el riesgo de
numerar sobre lo marcado en vez de sobre el día.

Los datos de prueba se retiraron al terminar: la base quedó como estaba.

---

## Lo que falta

1. ~~**No imprime todavía.**~~ Resuelto en el [punto 25](punto-25-seleccion-y-reimpresion.md): el
   papel abierto trae su botón *Reimprimir*, y la lista permite marcar varios y mandarlos juntos.
2. **El calendario ofrece todos los días**, no solo los que tienen ventas. `init` ya devuelve la
   lista (`dias`) y no se está usando para acotar el picker: conviene hacerlo para no ofrecer días
   que abrirían en vacío.
3. **El resto de la terminal sigue sin backend.** `acceso.js`, `admin.js`, `cuentas.js` e
   `inicio.js` ya apuntan a este mismo controlador, pero ninguna pide todavía una opción. El
   dispatcher responde con un JSON de error —y no con un fatal de PHP— cuando llega un `opc` que
   aún no existe.
