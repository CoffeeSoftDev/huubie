# Auditoría: pedidos con fecha movida (mismo patrón que el 774)

**Fecha de auditoría:** 15/07/2026 · **BD local:** `fayxzvov_reginas` · Solo lectura, nada corregido.

Origen: `addPayment` pisaba `date_creation` con la fecha del día en cada pago/confirmación (fix aplicado el 14/07/2026 — la lista ya no crece). Los pedidos aquí listados quedaron con fecha incoherente y pueden descuadrar los cortes de sus fechas.

## Señales usadas

1. **Fecha del pedido ≠ fecha del turno de captura** (`cash_shift_id` apunta a un turno de otro día).
2. **Primer pago ANTERIOR a la fecha de creación** (imposible en un pedido sano).
3. **Amarrado a un cierre de otra fecha** (`daily_closure_id` → `closure_date` distinta).

## Pedidos afectados (45, sin contar el 774 ya corregido)

### Señal 1 — turno de otra fecha (20)

| Pedido | Suc | Fecha pedido | Turno (fecha real de captura) | Total |
|---|---|---|---|---|
| 312 | 22 | 2026-04-13 | #9 (2026-04-12) | 1,210 |
| 346 | 4 | 2026-04-18 | #24 (2026-04-16) | 369 |
| 370 | 4 | 2026-04-23 | #44 (2026-04-22) | 850 |
| 416 | 4 | 2026-05-02 | #70 (2026-04-30) | 720 |
| 418 | 4 | 2026-05-03 | #70 (2026-04-30) | 360 |
| 423 | 4 | 2026-05-04 | #75 (2026-05-02) | 1,620 |
| 445 | 4 | 2026-05-10 | #87 (2026-05-06) | 3,300 |
| 519 | 4 | 2026-05-23 | #132 (2026-05-21) | 4,900 |
| 570 | 4 | 2026-06-06 | #173 (2026-06-03) | 650 |
| 583 | 4 | 2026-06-24 | #182 (2026-06-05) | 2,800 |
| 594 | 4 | 2026-06-19 | #192 (2026-06-09) | 1,050 |
| 621 | 4 | 2026-06-15 | #227 (2026-06-17) | 1,050 |
| 624 | 22 | 2026-06-19 | #214 (2026-06-15) | 375 |
| 640 | 4 | 2026-06-19 | #225 (2026-06-17) | 510 |
| 647 | 22 | 2026-06-19 | #229 (2026-06-18) | 500 |
| 675 | 4 | 2026-06-24 | #255 (2026-06-23) | 1,330 |
| 682 | 22 | 2026-06-26 | #268 (2026-06-25) | 1,970 |
| 697 | 4 | 2026-07-07 | #277 (2026-06-26) | 890 |
| 721 | 25 | 2026-07-01 | #293 (2026-06-30) | 580 |
| 722 | 22 | 2026-07-01 | #291 (2026-06-30) | 1,460 |

### Señal 2 — pago anterior a la creación (36; los repetidos ya están arriba)

12, 14, 16, 23, 28, 102, 115, 132, 143, 161, 163, 171, 172, 173, 175, 178, 187, 196, 206, 207, 222, 229, 231, 242, 253, 272, 445, 519, 583, 594, 624, 640, 647, 675, 682, 697.

Con **sobrepago** (pagado > total, revisar aparte): 115 ($620 de $460), 163 ($1,000 de $850), 519 ($5,000 de $4,900).

### Señal 3 — amarrado a cierre de otra fecha (2)

721 (cierre #53 del 30/06) y 722 (cierre #52 del 30/06), ambos con fecha de pedido 01/07: movidos DESPUÉS de cerrado el 30/06.

## Cierres vigentes con totales descuadrados (8)

Guardado en `daily_closure` vs recálculo por fecha de pago real (criterio corregido):

| Cierre | Suc | Fecha | Diferencia | Detalle |
|---|---|---|---|---|
| #34 | 4 | 2026-06-15 | -550 | transfer 2,140 vs real 2,690 |
| #35 | 25 | 2026-06-15 | +550 | transfer 1,350 vs real 800 (cobro cruzado con suc 4) |
| #41 | 4 | 2026-06-19 | -350 | card 650 vs real 1,000 |
| #42 | 4 | 2026-06-20 | -250 | transfer 1,330 vs real 1,580 |
| #43 | 4 | 2026-06-21 | -350 | cash 0 vs real 350 |
| #44 | 22 | 2026-06-26 | +1,000 | cash 1,200 vs real 200 |
| #69 | 4 | 2026-07-06 | +610 | cash 520→260, transfer 2,065→1,715 |
| #75 | 4 | 2026-07-07 | +400 | transfer 3,550 vs real 3,150 |

(Los cierres #4 y #76 también difieren pero están REABIERTOS (status 1), no vigentes.)

## Notas

- Los casos de enero-marzo pueden venir del pisado viejo de ctrl-pedidos.php (quitado en c3a5622, marzo); el efecto contable es el mismo.
- Con el código corregido, los REPORTES regenerados ya muestran el dinero por fecha de pago real; lo que sigue mal es: (a) la fecha con que cada pedido aparece listado, y (b) los totales guardados de esos 8 cierres.
- Corrección propuesta (pendiente de aprobar): restaurar `date_creation` de cada pedido a la fecha de su turno (`cash_shift.opened_at`) y recalcular los cierres afectados. Requiere revisar caso por caso los 3 sobrepagos.

## Queries de detección (read-only, reutilizables en el servidor)

```sql
-- Señal 1: fecha del pedido != fecha del turno de captura
SELECT o.id, o.subsidiaries_id, DATE(o.date_creation) AS fecha_pedido,
       o.cash_shift_id, DATE(cs.opened_at) AS fecha_turno, o.status, o.total_pay
FROM fayxzvov_reginas.`order` o
JOIN fayxzvov_reginas.cash_shift cs ON cs.id = o.cash_shift_id
WHERE DATE(o.date_creation) != DATE(cs.opened_at) AND o.is_legacy = 0;

-- Señal 2: primer pago anterior a la creación
SELECT o.id, o.subsidiaries_id, DATE(o.date_creation) AS fecha_pedido,
       MIN(op.date_pay) AS primer_pago, o.total_pay, SUM(op.pay) AS pagado
FROM fayxzvov_reginas.`order` o
JOIN fayxzvov_reginas.order_payments op ON op.order_id = o.id
WHERE o.is_legacy = 0
GROUP BY o.id HAVING DATE(MIN(op.date_pay)) < DATE(o.date_creation);

-- Señal 3: amarrado a cierre de otra fecha
SELECT o.id, o.subsidiaries_id, DATE(o.date_creation) AS fecha_pedido,
       o.daily_closure_id, DATE(dc.closure_date) AS fecha_cierre
FROM fayxzvov_reginas.`order` o
JOIN fayxzvov_reginas.daily_closure dc ON dc.id = o.daily_closure_id
WHERE DATE(o.date_creation) != DATE(dc.closure_date) AND o.is_legacy = 0;
```
