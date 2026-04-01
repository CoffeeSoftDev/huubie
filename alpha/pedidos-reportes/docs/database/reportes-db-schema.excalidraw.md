# Database Schema - Pedidos Reportes

Excalidraw: https://excalidraw.com/#json=Lu9SmECHeMM7syMtWLR8E,LCve9AG_cyfa8Oaew876uw

## Bases de datos consultadas

### DB: fayxzvov_reginas
| Tabla | Uso |
|---|---|
| `order` | Pedidos/tickets (folio, fecha, totales, descuento, status) |
| `order_clients` | Nombre del cliente asociado al pedido |
| `order_payments` | Pagos por pedido (efectivo, tarjeta, transferencia, propina) |
| `cash_shift` | Turnos de caja (apertura, cierre, totales por método de pago) |

### DB: fayxzvov_alpha
| Tabla | Uso |
|---|---|
| `usr_users` | Nombre del cajero (employee_id en cash_shift) |
| `subsidiaries` | Sucursales filtradas por compañía |

## Consultas por pestaña

- **Tab 1 - Detalle Tickets:** `order` + `order_clients` + `order_payments`
- **Tab 2 - Turnos:** `cash_shift` + `usr_users`
- **Tab 3 - Ticket Diario:** `order` + `order_payments` (GROUP BY DATE)
- **Filtro Sucursales:** `subsidiaries`

## method_pay_id
- 1 = Efectivo
- 2 = Tarjeta
- 3 = Transferencia
