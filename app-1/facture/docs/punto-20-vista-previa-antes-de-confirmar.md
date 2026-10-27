# Punto 20 · Vista previa antes de confirmar

> Antes de guardar definitivamente la generación deberá mostrarse una vista previa, con las
> cifras del reparto a la vista y tres salidas: confirmar, cancelar o regenerar la combinación.
>
> **Escrito e implementado:** 02/09/2026 · **Depende de:** punto 19 (pasos 14, 16 y 17),
> punto 17 (reasignación) y punto 18 (movimientos en cero).
>
> **Piezas:** `previewDay()` (ctrl) · `Tickets.previewDay()` / `App.openPreviewModal()` /
> `TicketsView.renderPreviewDay()` (tickets.js) · `migra-16-semilla-de-papel.sql`.

---

## Qué resuelve

El punto 19 dejó un solo hueco y es justo este: **entre calcular el reparto y escribirlo no hay
nada**. `generateDay()` valida, muda los cargos, reparte, abre corrida, arma los papeles y cierra,
todo en una petición y sin preguntar. Lo que el usuario ve del reparto lo ve **después**, en el
resumen, cuando los papeles ya existen y deshacerlos es *Rehacer reparto*.

El punto 20 mete un alto entre las dos mitades: se enseña lo que va a pasar, y el día se escribe
solo cuando alguien lo autoriza.

---

## Qué se muestra

Cuatro bloques, en el orden en que se leen. Ninguna cifra es una cuenta nueva: **todas se calculan
hoy**, solo que dentro de la misma petición que escribe.

1. **El total con tarjeta** — la cifra más grande del modal, porque de ella sale todo lo demás.
   Debajo, en una línea: cuántos movimientos se seleccionaron y cuántos traen cargo a tarjeta.
2. **El reparto** — una barra con la proporción y dos renglones, 16% y 0%. Cada uno dice su monto
   generado y cuántos tickets caen de ese lado. Nada más.
3. **Lo que se va a escribir** — cuántos tickets se guardan, y de esos cuántos son de $0.00.
4. **Los folios reasignados** — uno por uno, no como conteo: origen, destino y monto. Es lo único
   de todo el cierre que reescribe un dato del POS, así que quien confirma tiene que poder
   reconocer cada folio que va a quedar distinto de su ticket impreso. La banda **no se pinta**
   cuando el día no tuvo ninguno.

| Dato | De dónde sale hoy |
|---|---|
| Total tarjeta de crédito | `kpisDelDia()` (ctrl:306) → `total` |
| Total movimientos seleccionados | `listSaleDayForSplit()` (mdl:696) — el universo del día |
| Total generado al 16% | `planReparto()` (ctrl:1100) → `facturado + monto16` |
| Total generado al 0% | `planReparto()` → `monto0` |
| Número de Tickets generados | `planReparto()` → `cuenta16 + cuenta0` + los de $0.00 |
| Número de Tickets de $0.00 | `esServicio()` (1954) y `esCeroDeOrigen()` (1965) sobre el día |
| Folios reasignados, cuando existan | `planReasignacion()` (ctrl:654) — **sin aplicar** |

### Lo que a propósito NO se muestra

- **El monto capturado del 16% y del 0%.** Se acaban de escribir en el modal de distribución, dos
  pantallas antes. Repetirlos aquí junto al generado invita a restarlos.
- **La diferencia entre lo capturado y lo generado.** Los tickets no se parten, así que el que
  cruza la meta entra completo y la diferencia **siempre existe**: mostrarla en el momento de
  autorizar es poner un número que parece un error delante de quien tiene que decidir. La cifra se
  sigue calculando y se sigue diciendo **después**, en el resumen del cierre
  (`resumenReparto()`, ctrl:1418), que es donde ya se explica por qué la hay.
- **De qué se compone cada grupo** (cuántos traen su comanda, cuántos son servicio de mesa). Es
  detalle de auditoría y vive en el resumen posterior y en el listado.

---

## Las tres salidas

### Confirmar

Corre el cierre que ya existe **con exactamente esta propuesta**: los mismos folios, las mismas
notas, la misma combinación de productos. La propuesta que se aprobó y lo que se guarda tienen que
ser el mismo documento; si al confirmar se recalculara desde cero, la vista previa sería una
ilustración y no una autorización.

### Cancelar

Cierra sin escribir nada. El día se queda sin repartir y los cargos, en su folio original —la
simulación no llegó a tocar `assigned_folio`—.

### Regenerar

Vuelve a armar los papeles con **otra mezcla de productos**. Cambia lo que imprime cada ticket, no
a qué tasa cae ni cuánto vale: el reparto 16% / 0% es el mismo, porque sale de la meta capturada y
del orden de folio, no del catálogo.

> **Cabo suelto.** Hoy la combinación **no es azar**: `armarPapel()` (ctrl:800) recibe
> `semillaFolio()` (2030), que es `crc32` del folio, justamente para que *"el ticket 174291 muestre
> hoy y en un año las mismas personas y la misma orden"*. Regenerar rompe eso si se hace con
> `rand()`.
>
> La forma de tenerlo todo: la semilla pasa a ser `folio + offset de corrida`. El offset vive en la
> propuesta mientras nadie la guarda —cada *Regenerar* lo incrementa— y **queda escrito en
> `generation_run` al confirmar**. Así la reimpresión de mañana reconstruye el mismo papel que se
> entregó, y la regeneración solo existe antes de que el documento exista.
>
> Esto pide una columna nueva en `generation_run` (`paper_seed`) y que `guardarTicketVirtual()` la
> reciba. Es el único cambio de esquema que el punto 20 necesita.

---

## Cómo quedó

### 1. `previewDay()` en el controlador

Es `generateDay()` **sin escribir**: mismas validaciones previas —catálogo de tasa 0% dado de alta,
día con ventas, reparto cuadrado—, mismo `planReparto()`, mismo recorrido. De nada serviría
aprobar una propuesta que el cierre va a rechazar, así que las tres puertas son las mismas y con
los mismos mensajes.

**El punto delicado era la reasignación.** `generateDay()` muda los cargos en la base *antes* de
repartir, porque el reparto se calcula sobre los montos ya mudados. La vista previa no puede
tocarlos —mirar una propuesta y cancelarla dejaría los cargos movidos sin corrida que los
explique—, así que traslada los montos en memoria, en dos pasos:

- `montosDelPos()` devuelve el día a lo que trajo el Excel. Hace falta porque
  `listSaleDayForSplit()` ya entrega los montos mudados (su monto procesable pasa por
  `folioDelPago()`), y simular sobre eso movería los cargos dos veces al rehacer un día.
- `conMudanza()` resta el cargo al folio que cede y se lo suma al que recibe, sobre la lista que
  ya está en memoria.

`planReasignacion()` no se tocó: ya devolvía la lista sin aplicar nada.

### 2. La semilla

`semillaFolio($folio, $offset = 0)`. Con offset 0 devuelve el `crc32` de siempre, así que los
papeles ya emitidos se rearman idénticos. El offset viaja en la petición (`semilla`), lo resuelve
`semillaDelReparto()` y se guarda en `generation_run.paper_seed` al confirmar.

### 3. El botón

*Generar ticket* ya no escribe: abre la vista previa (`Tickets.previewDay()`). El cierre cuelga del
**Confirmar** del modal, y `runLocked()` cubre desde ahí — no desde que se abrió la propuesta, que
no escribe nada y puede repetirse.

*Rehacer reparto* también pasa por aquí: su pregunta decide entre rehacer y eliminar, no autoriza
el reparto que va a quedar.

### Lo que se verificó

Contra la base local, con el día del 09/07/2026 del archivo de ejemplo:

- La vista previa y el cierre devuelven **las mismas cifras** —total, montos por tasa, conteos y
  la lista de folios reasignados—.
- Después de pedir la propuesta, `assigned_folio` sigue en NULL: la simulación **no escribe**.
- Con una segunda tarjeta inyectada en el folio 7103, la propuesta anuncia `7103 → 7104` por
  $500.00 y el cierre hace exactamente esa mudanza.
- Confirmar tras un *Regenerar* guarda `paper_seed = 1`, y los renglones de los papeles salen
  distintos con el mismo reparto: mismos montos, otros productos.
- Las tres puertas responden igual que el cierre: sin catálogo puente, día sin ventas y reparto
  descuadrado.

### Lo que quedó pendiente

`generateDay()` **no comprueba que el día siga siendo el mismo** que se aprobó. Si entra una carga
nueva entre la propuesta y el confirmar, la numeración de notas se recorre y lo que se escribe deja
de ser lo que se autorizó. La ventana es de segundos y el módulo no admite dos sesiones cerrando el
mismo día, pero el candado no existe: haría falta que la propuesta viajara con una huella del día
—su total y su conteo— y que el cierre la comparara antes de escribir.

---

## Lo que NO cambia

- **El reparto.** `planReparto()` decide igual: por orden de folio, sin partir tickets.
- **La reasignación.** Mismas reglas del punto 17; la vista previa solo la enseña antes.
- **Los tickets de $0.00.** Mismo `guardarTicketServicio()`, misma regla del punto 18.
- **El histórico.** `abrirCorrida()` / `cerrarCorrida()` siguen siendo del confirmar, no de la
  propuesta: una vista previa que abriera corrida dejaría corridas huérfanas cada vez que alguien
  mira y cancela.
