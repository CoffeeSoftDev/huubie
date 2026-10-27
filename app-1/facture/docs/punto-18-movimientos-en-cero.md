# Si el código cumple el punto 18 (movimientos que vienen en $0.00)

> El punto 18 dice qué hacer con el movimiento que el Excel trae con Total $0.00: no debe
> sumar al Total Tarjeta de Crédito, pero sí debe recibir su ticket, para que el folio y la
> secuencia del día no se salten un número. Este documento revisa qué cumplía, qué no, y
> qué se cambió.
>
> **Leído:** 2 archivos de código, 6 consultas a la base real, 1 cierre completo corrido de
> punta a punta con un movimiento en cero de prueba ·
> **Fecha:** 31/08/2026

---

## Veredicto corto

| Parte de la regla | Antes | Ahora |
|---|---|---|
| No incrementa el Total Tarjeta de Crédito | Cumple | Cumple |
| Genera un ticket válido que conserva folio y secuencia | **No cumplía** | Cumple |
| 18.2 — El efectivo puesto en cero no se confunde con el cero de origen | No aplicaba | Cumple en el nombre; ver 18.2 |

### 18.1 — Regla de generación, campo por campo

Verificado sobre un movimiento en $0.00 corrido de punta a punta por el cierre:

| Lo que pide | Lo que sale | |
|---|---|---|
| Folio correspondiente al movimiento | El folio del movimiento | Cumple |
| Producto: Servicio | `SERVICIO DE MESA` | Cumple: es el nombre de la casa |
| Cantidad: 1 | 1 | Cumple |
| Precio unitario: $0.00 | 0.00 guardado | Cumple, con matiz |
| Importe: $0.00 | $0.00 | Cumple |
| Total del Ticket: $0.00 | $0.00 | Cumple |

**Sobre el nombre del producto:** el papel imprime `SERVICIO DE MESA`, que es como la casa
nombra esa partida, y no `SERVICIO` a secas. Se probó separarlos —una partida propia para el
movimiento en cero— y se descartó: es un solo concepto, y el papel en cero se lee igual venga
de una cuenta cobrada sin tarjeta o de un movimiento que no cobró nada. Lo que distingue a los
dos casos vive en la pantalla, no en el papel (ver 18.2).

**El renglón no sale del catálogo, y así se queda.** La partida se escribe con su nombre y sin
apuntar a ningún producto dado de alta, así que el papel no carga la clave que pediría un CFDI.
Consultado el 31/08/2026, la respuesta fue que **este comprobante se queda como respaldo
interno**: no está pensado para convertirse en factura. Mientras esa decisión no cambie, no hace
falta dar de alta un producto «Servicio» en Catálogos.

**El matiz del precio unitario:** el dato se guarda en cero, pero el papel impreso no tiene
columna de precio unitario —ningún ticket del módulo la tiene, porque replica el formato del
POS, que imprime cantidad, producto e importe—. Con cantidad 1 el precio y el importe son la
misma cifra, así que en el papel no falta información. Si la regla exige verla como columna,
el cambio es del formato del ticket y afecta a todos los papeles, no solo a este.

### 18.2 — Diferencia respecto a los folios de Efectivo

La regla separa dos cosas que en pantalla se parecen: el movimiento que **nació** en $0.00 y el
efectivo que se pone en cero de forma operativa para prestar su folio (punto 17). El segundo
cobró dinero real; su cero es un préstamo de asiento, no una venta vacía.

**Los dos están separados en el código, aunque compartan el papel.** `esCeroDeOrigen()` lee
`sale_total` —es `s.total`, el dato tal cual del Excel, que la reasignación nunca toca—: un
efectivo de $5,946 conserva esa cifra ahí aunque su monto procesable sea cero, y el que nació
en cero la tiene en cero. La distinción se usa donde importa, que es la explicación en
pantalla: el efectivo dice "no factura: la cuenta se cobró en efectivo por $5,946" y el
movimiento en cero dice "vino sin importe en la carga". En el papel los dos imprimen la misma
partida, por decisión de la casa.

**El papel automático depende de cuál de los dos efectivos se mire:**

| Efectivo | Monto procesable | Qué recibe hoy |
|---|---|---|
| Prestó su folio y recibió el cargo mudado (6276 ← $1,070 del 6275) | sube a $1,070 | Ticket normal con productos; nunca es servicio |
| No prestó nada | queda en $0.00 | Papel automático en $0.00 con la partida `SERVICIO DE MESA` |

El caso que la regla describe literalmente —el efectivo que liberó su folio— es justo el que
sale bien: al recibir el cargo deja de ser servicio y se le arma papel con productos.

El otro es el servicio de mesa, comportamiento anterior al punto 18, que existe para que la
secuencia del día no salte un número. En el 22/08 son 16 folios: de 36 ventas, 17 son efectivo
—ninguna vino en $0.00 del Excel— y solo el 6276 presta su folio.

**Decisión pendiente:** ¿«Ticket de Servicio» es el documento que define el 18.1, o cualquier
papel automático en $0.00? Con la primera lectura el módulo ya cumple. Con la segunda hay que
dejar sin papel a los folios de efectivo del día. El cambio no recorre la numeración —la nota
es el lugar de la venta y avanza antes de decidir si hay papel, igual que hacía con el
movimiento en cero antes de arreglarlo—, pero deja esos folios como número apartado y vacío en
la hoja imprimible y en el resumen del cierre.

---

## La parte que ya cumplía

El total del día se arma sumando los cobros con tarjeta uno por uno. Un movimiento que vale
cero suma cero: no puede mover la cifra del día ni el reparto 16%/0%.

El punto 17 ya lo tenía blindado por su lado: la reasignación de cargos ignora los vouchers
en $0.00, para que un folio no se quede valiendo nada mientras su cobro real se muda a otro
sitio. El voucher vacío del folio 6284 del 22/08 es el caso que lo destapó.

**Comprobado con datos:** el 22/08 el total de tarjeta es $22,331.00 y el cierre reporta
exactamente esa cifra, con el movimiento en cero de prueba dentro del día.

## La parte que no cumplía

El módulo sabía emitir tickets en $0.00, pero solo para un caso: la mesa que **sí cobró
dinero, aunque no por tarjeta** —el servicio de mesa—. Ese permiso estaba escrito como *"emite
papel en cero solo si la cuenta cobró dinero real"*, y el movimiento del punto 18 no cobró
nada, así que no calificaba.

El resultado es que se quedaba sin papel por las tres vías:

- **El cierre del día** lo mandaba al reparto, buscaba productos del catálogo que sumaran
  $0.00, no encontraba ninguno y lo dejaba pasar.
- **El botón de generar todos al 0%** lo excluía con un filtro de "solo los que traen monto".
- **Pedirlo a mano por folio** respondía *"No se pudo armar un ticket que cuadre con $0.00"*,
  que suena a catálogo incompleto cuando lo que pasa es que no hay nada que cuadrar.

La numeración sí se conservaba: el contador de notas avanza sobre todas las ventas
elegibles, así que los folios de atrás no se recorrían. Quedaba un número apartado y sin
papel encima.

---

## Lo que se cambió el 31/08/2026

**Decisión tomada:** el movimiento en cero recibe **el mismo papel que el servicio de mesa**
—un ticket en $0.00 con un único renglón `SERVICIO DE MESA`—, sin concepto propio. Es el
nombre con el que la casa se refiere a esa partida y el papel no distingue de cuál de los dos
casos viene.

1. **`esServicio()`** pasa a preguntar solo por el monto procesable. Antes exigía además que
   la cuenta hubiera cobrado dinero, y esa condición era justo la que dejaba fuera al
   movimiento en cero. Ahora la función agrupa los dos casos que terminan en el mismo papel,
   y los dos quedan documentados en su comentario.
2. **`guardarTicketServicio()`** pierde el candado que negaba el papel cuando la venta valía
   cero.
3. **`generarFolio()`** deja de intentar armarle papel con productos: responde que su ticket
   se emite en $0.00 con el cierre del día, igual que el del servicio de mesa.
4. **`montoCelda()`** ya no dice "se cobró en tarjeta de crédito por $0.00" en el tooltip,
   que mandaba a buscar un importe que el Excel nunca trajo.
5. **`esCeroDeOrigen()`** distingue los dos casos del papel en cero. No cambia el papel —los
   dos imprimen `SERVICIO DE MESA`—: se usa para que la pantalla explique cada uno con su
   propio motivo.

Todo lo demás lo heredó solo, porque la pantalla ya se apoyaba en `esServicio()`: la
píldora *Servicio*, el guion en la columna de monto y la exclusión del reparto.

### La forma de pago que el papel anunciaba

Revisado el 31/08/2026 contra las condiciones del 18.3: las seis se cumplen, pero el papel
salía diciendo **«TARJETA DE CREDITO $0.00»** en su bloque de formas de pago. Wansoft pega a
veces un voucher vacío a la cuenta, y el ticket lo copiaba tal cual: un cobro que nunca
ocurrió, impreso en el documento. Era la misma confusión que ya se había corregido en el
tooltip de la columna Monto, que no se había propagado al papel ni a la nota del panel —donde
llegaba a contradecirse sola: *«la cuenta se cobró con tarjeta de crédito: el papel no ampara
ningún cargo con tarjeta»*.

Ahora el movimiento en cero imprime **`SIN PAGO REGISTRADO`** y la nota del panel dice *«el
movimiento vino sin importe en la carga»*. El servicio de mesa no cambia: sí cobró, y sigue
nombrando su forma de pago real. La distinción la hace `esCeroDeOrigen()`, que hasta hoy solo
consultaba la columna de monto y ahora viaja también en la cabecera del papel.

**Efecto lateral bueno:** el conteo del día ya cuadra. La consulta de KPIs siempre contó
como *servicio* todo lo que tuviera monto procesable cero —incluidos estos movimientos—,
pero el generador se quedaba corto y los reportaba en *sin papel*. Ahora las dos cifras
hablan del mismo conjunto.

### Probado

Con un movimiento en $0.00 insertado en el día 22/08 (folio de prueba, estado Pagada, un
voucher de tarjeta en cero) y el cierre corrido de punta a punta:

- Recibió su ticket: nota **#37**, total **$0.00**, un renglón `SERVICIO DE MESA` con
  cantidad 1, precio unitario 0.00 e importe 0.00.
- El total del día siguió en **$22,331.00**, sin moverse.
- El resumen del cierre reportó **0** movimientos sin papel.
- Sale idéntico al del servicio de mesa: el folio 6268, que cobró en efectivo, imprimió el
  mismo renglón.

Los datos de prueba se borraron y la base quedó como estaba: 36 ventas, cero tickets, cero
corridas.

---

## Lo que queda por decidir

**El botón de "generar todos al 0%" sigue sin incluirlos.** Es deliberado y es el mismo
trato que recibe el servicio de mesa: su papel no se arma con productos y sale con el cierre
del día. Si en la operación real se espera que ese botón también los emita, hay que darle
una vía aparte —no puede pasar por el armador de productos.

**Nada impide en la base que una venta tenga dos papeles.** El único candado del esquema es el
número de nota, que no se puede repetir dentro del mismo día y sucursal. Que una venta no reciba
dos comprobantes lo garantiza hoy el orden del cierre —suelta todos los papeles antes de armar
ninguno—, más el rechazo de la generación a mano y la exclusión del botón masivo. Funciona, pero
es una garantía del código y no del esquema: una vía de generación nueva podría saltársela.
Cerrarlo es agregar un índice único por venta.

**Un movimiento en cero que no esté "Pagada" no aparece.** En Wansoft el módulo solo lista
las ventas pagadas, así que un movimiento en $0.00 marcado como Abierta, Cancelada o
Eliminada no entra al día y no recibe ticket ni número. La regla no dice qué hacer con ese
caso.
