# Punto 25 — Resultado de búsqueda: seleccionar y reimprimir

> El punto 25 continúa el [24](punto-24-reimpresion-de-tickets.md): sobre los tickets del período
> ya listados, el usuario debe poder **seleccionar uno, varios o todos** y **reimprimir**.
>
> **Tocado:** la lista de la pantalla de reimpresión, su controlador y modelo, y el tema del módulo ·
> **Fecha:** 01/09/2026

---

## Lo que se construyó

La propuesta elegida fue la **A**: la lista de siempre con una columna de casillas y una barra de
acción al pie. Sin pantallas nuevas ni modos que aprender.

```
┌──────────────────────────────────────────────────────────────┐
│ [▪]  Orden  Movimiento  Mesa  Mesero            Total        │  ▪ = marca todo el período
├──────────────────────────────────────────────────────────────┤
│ [✓]    1      6266       43   ANDREA          $926.00        │  ← fila teñida
│ [ ]    2      6267       41   CESAR           $814.00        │
│ [✓]    3      6268      104   OMAR          $1,138.00        │
├──────────────────────────────────────────────────────────────┤
│ 3 tickets seleccionados · $3,153.00  [Quitar selección] [Reimprimir 3] │
└──────────────────────────────────────────────────────────────┘
```

| Lo que pide el punto | Cómo quedó |
|---|---|
| Mostrar los tickets del período | Ya lo hacía el punto 24 |
| Seleccionar un ticket | Casilla de la fila |
| Seleccionar varios | Una casilla por fila; la barra cuenta y suma |
| Seleccionar todos | Casilla del encabezado |
| Reimprimir | Botón de la barra, o el del papel cuando se está viendo uno |

---

## Los dos gestos del renglón

Tocar la **casilla** marca; tocar el **resto de la fila** abre el ticket, como antes. Conviven
porque la casilla corta la propagación del clic.

Ahí hubo un detalle que costó: el clic de la fila está enganchado en el propio `<tr>`
(`initSelect`), así que un manejador **delegado** en la tabla corre *después* y su
`stopPropagation()` llega tarde — marcar abría además el papel. La casilla engancha su clic
directamente sobre sí misma, que es lo único que corre antes que el `<tr>`.

### Los tres estados de la casilla de arriba

| Estado | Qué se ve | Qué hace al tocarla |
|---|---|---|
| Nada marcado | Vacía | Marca todo el período |
| Parte marcada | Raya | **Completa** la selección (no la vacía: con 3 de 36 lo que se quiere es marcar el resto) |
| Todo marcado | Palomita | Suelta todo |

La casilla se dibuja con CSS y no con un `<input type="checkbox">`: el nativo llega con el tamaño y
el radio del navegador, y junto a los filetes rectos de este formulario se leía como un control
prestado de otra pantalla.

---

## La barra vive al pie del panel, no al final de la lista

Con 36 renglones, una barra al final del contenido queda fuera de la pantalla justo cuando más se
necesita: marcar arriba y no poder imprimir sin bajar hasta el final.

`position: sticky` no prende aquí —el panel centra su contenido con `align-items: start` y la barra
viaja dentro de una caja más alta que el scrollport—, así que se resolvió con estructura: cuando hay
lista, la clase `is-lista` en `#previewRow` **baja el scroll un piso**. Lo toma el hueco de los
renglones (`#listaWrap`) y la barra, que es su hermana, se queda fija abajo.

---

## Qué se manda a la impresora

Un solo camino para uno y para treinta: `getTickets` recibe los movimientos marcados, devuelve los
papeles ya armados y el frente los pinta en `#printSheet` —la hoja oculta que el `@media print` de
`facture.css` saca a imprimir—, pone `body.printing-sheet` y abre el diálogo. **Un ticket por
hoja**, que es como sale de la impresora y como se entrega.

Esa hoja vive fuera de `#previewRow` porque ese hueco se vacía en cada consulta y se llevaría el
trabajo a medio imprimir.

El papel abierto también trae su propio botón **Reimprimir**, junto al de volver: ese ticket ya está
completo en pantalla y no necesita pasar por la selección. Con eso queda saldado el pendiente que
dejó el punto 24.

### Una consulta, no una por ticket

Imprimir el día entero serían tantas consultas de detalle como tickets marcados si cada papel
pidiera sus renglones. `listTicketLinesByTickets` los trae todos de una vez y el controlador los
reparte por folio.

Lo que se manda a imprimir son **tickets aprobados**: la lista solo ofrece esos (ver el
[punto 24](punto-24-reimpresion-de-tickets.md)), así que la selección no puede contener un
movimiento sin papel.

---

## Cuándo se suelta la selección

Se vacía sola cuando dejaría de tener sentido:

- Al **cambiar de fecha o de período**: son otros tickets, y arrastrar lo marcado mandaría a
  imprimir papeles que ya no están en la lista.
- Al **cambiar entre Fecha y Rango**, por lo mismo.
- Al **volver a la búsqueda por Ticket**, donde solo hay un papel.

Lo que **no** la borra es ir a ver un ticket y volver: la tabla se vuelve a crear con las casillas
vacías, y `paintChecks()` repinta lo marcado sobre los renglones nuevos.

---

## Probado contra la base

Sucursal 1 (RYORI RYOKAN). La mecánica de selección se probó sobre la corrida de 36 tickets que
había el 22/08/2026, y la regla del punto —solo tickets aprobados— sobre tres papeles sembrados a
propósito el 24/08 (retirados al terminar).

| Prueba | Resultado |
|---|---|
| Marcar tres | Barra: *3 tickets seleccionados · $3,153.00*, tres filas teñidas, maestra en raya |
| Maestra con selección parcial | 36 marcados · **$53,015.00** |
| Maestra con todo marcado | Selección vacía, la barra desaparece |
| Tocar la fila (fuera de la casilla) | Abre el ticket, con su botón Reimprimir |
| Reimprimir 3 | Tres papeles en la hoja: 6266, 6268, 6269 · clase puesta al imprimir y retirada al cerrar |
| Reimprimir desde el papel | Un solo papel |
| Ir al ticket y volver | Los marcados siguen marcados |
| Marcar dos aprobados y reimprimir | Dos papeles: 6352 ($660.00) y 6353 ($2,776.00) |
