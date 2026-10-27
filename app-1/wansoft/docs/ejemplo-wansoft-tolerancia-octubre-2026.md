# Ejemplo de tolerancia de ajuste — Wansoft, 02/10/2026

Carpeta `ejemplo-tolerancia-octubre-2026/`:

| Archivo | Qué es |
|---|---|
| `ReporteVentasPorFormaDePago2026-10-02.xlsx` | Reporte de ventas: 12 movimientos del día y sus vouchers |
| `ReporteDetalleDeVentas2026-10-02.xlsx` | Comandas: 51 renglones de 10 movimientos |
| `ticket-9111.png` | Cómo sale el ticket del caso, generado en local |

**Cómo verlo:** Tickets → Subir Excel → los dos archivos → «Subir Octubre 2026» → Generar tickets →
meta 70/30 → Un día → Confirmar → clic en el folio 9111. Van los dos archivos porque el modal ya no
deja continuar con uno solo.

## Qué trae

| | |
|---|---|
| Día | 02/10/2026 (viernes) |
| Movimientos | 12 (`9101` a `9112`), todos pagados |
| Total | $16,231.00 · propinas $1,151.80 · cobrado $17,382.80 |
| Con tarjeta de crédito | 7 cargos por $11,518.00, cada uno con su voucher |
| En efectivo | 5; salen como servicio de mesa en $0.00 |

## El caso: 9111 pasa la tolerancia

`9111` cobra **$1,330.50** con tarjeta. Es la última venta con tarjeta del día: con la meta 70/30 cae al
**IVA 0%** y su papel se arma con productos puente.

| | |
|---|---|
| Productos a precio de catálogo | $1,345.00 |
| Total cobrado | $1,330.50 |
| Ajuste que haría falta | $14.50 |
| Tolerancia de la sucursal | $10.00 (`branch.adjustment_tolerance`) |
| **Descuento impreso** | **$10.00**, el tope |
| **Al producto** | los $4.50 restantes: HIELO EN BOLSA 2 KG sale en **$10.50** en vez de $15.00 |

El detalle del ticket lo dice: «Se cuadró con un descuento de $10.00, el tope de la tolerancia; los
$4.50 restantes se descontaron del importe del producto».

## El contraste: 9101 queda dentro

`9101` cobra $1,187.50, es la primera venta con tarjeta y cae al IVA 16%. Su ajuste es de **$2.50**: se
imprime como descuento y ningún producto cambia de precio.

## Por qué 9101 y 9111 no traen comanda

Los dos montos llevan centavos y los precios del catálogo son enteros: ninguna comanda cuadraría con
ellos. Sin comanda, el papel se arma del catálogo, que es donde aparece el ajuste. Las otras 10 ventas sí
traen comanda, y su ticket del 16% imprime los platillos tal cual.

## Cómo se comprobó (04/10/2026, base local)

- Subidos los dos archivos por el modal de Tickets y generado el día con 70/30: 5 tickets al 16% (4 con
  comanda, 1 armado), 2 al 0% y 5 de servicio de mesa.
- `9111` salió con Descuento $10.00 y el hielo en $10.50 (`ticket-9111.png`); `9101`, con Descuento $2.50.
- Antes se corrió en solo lectura la misma función del ctrl (`armarPapel()` con `semillaFolio()`) contra
  el catálogo de RYORI RYOKAN: 160 productos al 16% y 10 puente.

## Qué puede cambiar el resultado

- Otro catálogo puente, otra tolerancia en Emisor o «Regenerar productos» (otra semilla) arman otro papel.
- Con una meta que mande `9111` al 16%, el caso se repite del otro lado: ajuste de $19.50, descuento de
  $10.00 y $9.50 menos a MAYONESA CHIPOTLE.
