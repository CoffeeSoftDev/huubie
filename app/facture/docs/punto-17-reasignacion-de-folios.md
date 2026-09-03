# Si el código cumple el punto 17 (reasignación de folios)

> Wansoft exporta un renglón por cada voucher, así que una cuenta que se partió entre dos
> tarjetas deja dos cargos con el mismo folio. El punto 17 dice qué hacer con eso: uno se
> queda, el otro se muda a un folio que ese día se cobró sin tarjeta. Este documento revisa
> si lo que ya está escrito cumple, qué se corrigió y qué quedó pendiente de decidir.
>
> **Leído:** 2 archivos de código, 9 consultas a la base real, 10 simulaciones del
> algoritmo con casos límite, 1 cierre completo corrido de punta a punta ·
> **Fecha:** 31/08/2026

---

## Veredicto corto

| Regla | Condiciones | Se cumplen |
|---|---|---|
| 17.1 — Regla de asignación | 8 | 8, con dos desviaciones de criterio |
| 17.2 — Condiciones | 9 | 8 |

La única que falta de verdad es **la 17.2.4 (que quede registrada cualquier reasignación)**:
hoy se registra la que está vigente, no el historial. Las dos desviaciones de la 17.1 no
son incumplimientos —la regla no las prohíbe— pero conviene decidirlas a conciencia
porque hacen que el resultado real no sea idéntico al del ejemplo del documento.

---

## Cómo funciona hoy

Los folios son asientos numerados. Cuando dos clientes traen el mismo boleto porque
partieron la cuenta entre dos tarjetas, el primero se queda en su asiento y al segundo se
le da un asiento que ese día nadie va a ocupar: el de una cuenta que se pagó en efectivo,
que no va a pedir factura.

El apunte de esa mudanza vive en una columna aparte. **El dato original nunca se toca**: el
Excel no se modifica, el importe del efectivo sigue completo, y el folio con el que el POS
cobró sigue siendo el que la conciliación bancaria va a encontrar. En pantalla, el folio
que recibió dice de dónde le llegó el dinero y el que cedió dice a dónde se fue.

La mudanza es el primer paso del cierre del día y **se recalcula entera cada vez**: los
cargos vuelven primero a su folio y desde ahí se reparten otra vez. Nunca se reparte sobre
el reparto anterior, porque eso iría mudando cargos ya mudados hasta que ningún folio
guardara relación con lo que el POS cobró.

---

## 17.1 — Regla de asignación

| # | Condición | Veredicto |
|---|---|---|
| 1 | Cada folio visible se usa una sola vez | Cumple |
| 2 | Uno de los movimientos conserva el folio original | Cumple |
| 3 | Los adicionales reciben un folio disponible | Cumple |
| 4 | La fuente son folios de movimientos de Efectivo | Cumple, con criterio más amplio |
| 5 | El Efectivo puede considerarse con monto operativo $0.00 | Cumple |
| 6 | El monto original del Efectivo se conserva | Cumple |
| 7 | No se modifica el Excel ni se borra el importe original | Cumple |
| 8 | Cada folio disponible se asigna una sola vez | Cumple |

**Se queda el primero capturado, no el más grande.** Es el cobro con el que la cuenta se
cerró y el que la conciliación bancaria va a encontrar primero bajo ese folio.

**El voucher en $0.00 no cuenta.** Wansoft exporta vouchers vacíos —el folio 6284 del 22/08
trae uno— y si se colara como "el primero", el folio se quedaría valiendo nada mientras su
cobro real se muda a otro lado.

### Desviación 1 — la fuente de folios es más amplia que "Efectivo"

La regla dice folios de Efectivo. El código toma **cualquier folio que no cobró tarjeta de
crédito**, que además de efectivo incluiría débito, transferencia, VISA, Mastercard y
American Express: todas existen en el catálogo de formas de pago y todas están activas.

Hoy no se nota, porque los movimientos cargados solo traen EFECTIVO y TARJETA DE CREDITO.
Se notaría el día que el Excel traiga un débito.

Hay una bandera `is_cash` en el catálogo de formas de pago que expresaría la regla al pie
de la letra y que hoy no se usa para esto (sí se usa en el módulo de Cargas).

**Decisión pendiente:** ¿la fuente son solo los folios de efectivo, o cualquier folio que
no vaya a pedir factura? Lo segundo es lo que hace el código y tiene su lógica —una
transferencia tampoco pide comprobante de tarjeta—, pero no es lo que dice la regla.

### Desviación 2 — elige el folio de adelante, el ejemplo usa uno de atrás

El ejemplo del documento manda los $1,070 del folio 6275 al **6270**, que es anterior. El
código busca el siguiente folio disponible **hacia adelante** y solo retrocede cuando ya no
queda ninguno. Por eso en los datos reales el cargo se fue al **6276** y no al 6270.

No contradice la letra de la regla, que solo pide "un folio disponible". El razonamiento
del código es que el cliente que no cabe en su folio sale amparado por uno posterior, nunca
por uno que se imprimió antes de que llegara.

**Decisión pendiente:** ¿se deja el criterio de adelante, o se cambia al folio disponible
más bajo para reproducir el ejemplo tal cual?

### Si no queda ningún folio disponible

El cargo se queda duplicado en su folio y el resumen del cierre lo marca con el destino
vacío. Es el único caso en que la regla no se puede cumplir, y la pantalla lo dice en vez
de callarlo. **La regla no define qué hacer aquí.**

---

## 17.2 — Condiciones

| # | Condición | Veredicto |
|---|---|---|
| 1 | Nunca dos tickets finales con el mismo folio | Cumple, garantizado por código |
| 2 | Se conserva el folio original | Cumple |
| 3 | Se conserva el folio finalmente asignado | Cumple |
| 4 | Queda registrada cualquier reasignación | **Solo la vigente, no el historial** |
| 5 | La reasignación es automática | Cumple |
| 6 | Un folio disponible se usa una sola vez | Cumple |
| 7 | No se inventan folios mientras haya disponibles | Cumple: nunca inventa |
| 8 | No altera el Total Tarjeta de Crédito | Cumple |
| 9 | No se pierde el importe original del Efectivo | Cumple |

---

## Lo que se corrigió el 31/08/2026

### Los cargos ya no se mueven antes de validar

El cierre movía los cargos como primerísimo paso y después validaba. Si la validación
fallaba —por ejemplo, catálogo sin productos de tasa 0%— los cargos quedaban movidos, sin
ningún ticket y sin ninguna corrida que respaldara la mudanza. Un monto cambiado de folio
sin documento que lo explicara es justo lo que la reasignación existe para evitar.

Ese estado estaba presente en la base: el folio 6275 había cedido $1,070 al 6276 con cero
tickets generados y cero corridas.

Ahora el cierre pregunta primero por el catálogo y por las ventas del día, y **solo entonces**
mueve los cargos. El día se vuelve a leer después de la mudanza, porque el reparto 16%/0%
se calcula sobre los montos ya mudados. Se relee siempre y no solo cuando algo se movió,
porque el paso también deshace las mudanzas del cierre anterior: el día pudo cambiar aun
cuando hoy no haya nada que mudar.

Probado: con el catálogo vaciado a propósito, el cierre devuelve su error y deja **cero**
cargos movidos.

### Diez productos de tasa 0% para armar el papel

El catálogo traía 174 productos, todos con IVA —son los que el POS exporta— y ninguno
marcado como puente. Sin puentes el cierre no puede armar el papel del 0% y se detiene, que
es lo que disparaba el problema anterior.

Se agregaron diez abarrotes: alimento no preparado envasado y hielo, que es lo que la ley
pone en tasa 0% (LIVA art. 2-A). Un roll de sushi al 0% no sería coherente con la tasa que
el papel declara; un kilo de arroz sí.

Los precios no son decorativos. El armado busca la combinación que suma el total al peso y
solo cuando no existe recurre al descuento de cuadre. Con la escala elegida —165, 120, 89,
65, 48, 35, 25, 22, 18 y 15— **todo monto entero desde $65 cierra exacto**, así que el
descuento deja de hacer falta. Se verificó con la misma tabla de alcance del controlador:
36 huecos, todos por debajo de $65.

**Cambiar un precio por uno más bonito puede abrir huecos.** Antes de tocarlos hay que
recalcular qué montos siguen cerrando.

Está en `sql/seed-01-productos-puente.sql`, con su rollback. Es idempotente.

---

## Lo que queda pendiente

### 1. Cierre de movimiento — el candado del día

**La idea:** cerrar un día y que a partir de ahí ya no se pueda cargar Excel de esa fecha ni
recalcular nada. Lo que quedó, quedó, y se dio por válido.

**Por qué hace falta:** hoy cualquiera puede volver a cargar el Excel de un día ya cerrado y
recorrer toda la numeración de notas. Los papeles que ya se entregaron dejarían de
corresponder con lo que dice el sistema.

**Lo que ya existe y sirve de base:** cada cierre queda registrado con su fecha, sus cifras y
su reparto, y las mudanzas de folio van firmadas por él. El candado tiene dónde vivir sin
inventar una tabla nueva.

**Las dos decisiones que faltan:**

- **Qué pasa con un movimiento que llega tarde.** Si el día 22 ya está cerrado y aparece una
  venta del 22 que no venía en el Excel: ¿se mete al día 22 y obliga a recalcular todo (más
  cómodo de operar, pero el candado se abre y protege menos), o entra como un agregado
  aparte con su propio cierre y el original queda intocado (como trabaja la contabilidad con
  las pólizas complementarias, candado firme)?
- **Quién puede reabrir.** ¿Cualquiera que entre al módulo o solo un usuario con permiso? Y
  si se reabre, ¿queda anotado quién y cuándo?

Del enunciado original: se permiten movimientos nuevos y borrar registros; lo que no se
permite es mover lo que ya se dio por válido.

### 2. Bitácora de reasignaciones (condición 17.2.4)

Hoy el sistema apunta a lápiz. Guarda la mudanza vigente y se puede consultar cuando sea,
pero al deshacer el día para rehacerlo, el apunte se borra y el siguiente cierre escribe uno
nuevo, que puede mandar el dinero a otro folio.

Mientras el día esté cerrado y quieto todo se ve bien. El problema aparece meses después, si
alguien pregunta por qué un folio de efectivo terminó facturando $1,070: la respuesta actual
está, pero si el día se rehizo dos o tres veces no hay forma de saber qué pasó antes ni por
qué cambió el destino.

**Qué haría falta:** una hoja aparte donde cada mudanza quede anotada con su fecha, su hora y
su corrida, y que no se borre al rehacer el día. Es agregar una bitácora, no cambiar cómo
funciona el cierre.

### 3. Candado de base contra dos tickets del mismo folio (condición 17.2.1)

La base impide dos tickets con el mismo **número de nota**, pero no dos tickets sobre el
mismo **folio de venta**. Que hoy no haya duplicados se lo debemos al programa, que borra el
ticket viejo antes de escribir el nuevo.

Si dos personas dan "Generar día" al mismo tiempo, la base no lo impediría por sí sola. Es
un índice único de una línea si se quiere blindado.

---

## Evidencia — el día 22/08/2026, sucursal 1

El caso del enunciado existe tal cual en los datos:

| Folio | Forma de pago | Importe | A dónde fue |
|---|---|---|---|
| 6275 | Tarjeta de crédito | $236.00 | se queda |
| 6275 | Tarjeta de crédito | $1,070.00 | se muda al 6276 |
| 6276 | Efectivo | $5,946.00 | intacto, presta su folio |

Resultado del cierre corrido de punta a punta:

- 26 tickets generados, **ninguno con descuento de cuadre**
- 0 tickets duplicados
- 0 folios de destino repetidos
- Total con tarjeta antes de la mudanza: **$22,331.00** · después: **$22,331.00**
- La mudanza quedó firmada por su corrida

Los diez casos límite simulados —tres vouchers en un mismo folio, más sobrantes que folios
libres, dos folios compitiendo por el mismo destino, folio ya facturado excluido, voucher en
$0.00 ignorado, e idempotencia— pasan todos.

---

## Dónde está cada cosa

| Qué | Dónde |
|---|---|
| El plan de mudanza y a quién le toca cada folio | `ctrl/ctrl-facture-tickets.php`, sección *Reasignación de cargos* |
| El orden del cierre del día | `ctrl/ctrl-facture-tickets.php`, `generateDay()` |
| El folio al que cuenta cada cargo | `mdl/mdl-facture-tickets.php`, `folioDelPago()` |
| Las columnas de la mudanza | `sql/migra-09-reasignacion-cargos.sql` |
| Los productos de tasa 0% | `sql/seed-01-productos-puente.sql` |
