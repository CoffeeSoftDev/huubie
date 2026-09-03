# Export de ejemplo — Wansoft, julio 2026

`ejemplo-wansoft-julio-2026.xlsx`

Archivo de prueba con la estructura real del export de Wansoft, hecho para probar la carga y el
candado de período del punto 23. Se generó con la misma forma que
`ReporteVentasPorFormaDePago2026-08-23.xlsx`: bloque de resumen en las filas 8-12, encabezados en
la 15 y datos desde la 16.

**Súbelo con el filtro en Julio 2026.** Con cualquier otro mes el módulo lo rechaza, que es
justamente lo que se quiere ver.

## Qué trae

| | |
|---|---|
| Hojas | *Detalle por forma de pago* · *Pagos por terminal bancaria* |
| Días | **09/07/2026** ($15,710.50) y **10/07/2026** ($19,400.00) |
| Renglones | 25 de datos + 3 de pie de totales |
| Cuentas pagadas | 23 |
| Total | $35,110.50 · subtotal $30,267.67 · IVA $4,842.83 (16%) |
| Cargos con tarjeta | 14, con su voucher en la hoja bancaria |

## Qué casos ejercita

- **Dos fechas en un archivo** (punto 23): el módulo tiene que conservarlas por separado. En
  Generar Tickets deben aparecer los dos días como opciones distintas, cada uno con su propia
  numeración de notas empezando en #1.
- **Cuenta partida:** el movimiento `7109` viene en dos renglones —tarjeta $1,500 y efectivo
  $820—. Su total real es la suma, $2,320; ninguna de las dos filas lo trae.
- **Movimiento en $0.00** (punto 18): el `7110` no cobró nada y aun así ocupa su lugar en la
  secuencia del día.
- **Venta cancelada:** el `7112` no debe entrar al universo del módulo, que solo mira las
  *Pagadas*.
- **Pie de totales sin fecha:** las tres últimas filas escriben «TOTAL COBRADO:», «PROPINAS:» e
  «IVA:» en las mismas columnas de la tabla. El corte por `dateIndex` las descarta; verificado:
  28 filas con clave, 25 entran.
- **Efectivo vs. tarjeta:** hay de las dos, para que el reparto 16% / 0% tenga con qué trabajar
  y para que existan folios libres que puedan recibir un cargo mudado (punto 17).

## Qué NO trae

La hoja de comandas (el detalle de lo consumido). Las ventas entran sin renglones, así que sus
tickets se imprimen con el consumo como una sola partida o con papel armado del catálogo, según
la tasa a la que caigan.
