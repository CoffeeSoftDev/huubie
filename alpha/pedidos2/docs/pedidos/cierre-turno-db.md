# Base de Datos - Cierre de Turno

## Resumen

El sistema de cierre de turno usa **7 tablas** en `fayxzvov_reginas` y **1 tabla** en `fayxzvov_alpha` para gestionar turnos de caja, cierres diarios y sus metricas.

---

## Tablas Involucradas

### 1. cash_shift (Turnos de caja)

Tabla principal. Cada registro representa un turno abierto/cerrado por un empleado en una sucursal.

| Columna | Tipo | Descripcion |
|---|---|---|
| `id` | int PRI | Identificador unico |
| `subsidiary_id` | int FK | Sucursal (→ `alpha.subsidiaries.id`) |
| `employee_id` | int FK | Empleado que abrio el turno (→ `alpha.usr_users.id`) |
| `daily_closure_id` | int | Cierre diario asociado (→ `daily_closure.id`) |
| `shift_name` | varchar(100) | Nombre del turno ("Matutino", "Vespertino") |
| `opened_at` | datetime | Fecha/hora de apertura |
| `closed_at` | datetime | Fecha/hora de cierre (NULL si esta abierto) |
| `opening_amount` | double | Fondo de caja inicial |
| `total_sales` | double | Total de ventas al cerrar |
| `total_cash` | double | Total pagado en efectivo |
| `total_card` | double | Total pagado con tarjeta |
| `total_transfer` | double | Total pagado por transferencia |
| `total_orders` | int | Numero de pedidos en el turno |
| `status` | enum('open','closed') | Estado del turno |
| `active` | int | Soft delete (1=activo, 0=eliminado) |
| `closing_cash_counted` | double | Efectivo contado al cierre |
| `cash_difference` | double | Diferencia entre esperado y contado |
| `folio_z` | varchar(50) | Folio del corte Z |
| `total_discount` | double | Total de descuentos aplicados |
| `total_cancelled` | double | Total de pedidos cancelados |
| `total_tips` | double | Total de propinas |

**Regla de negocio**: Solo puede existir **1 turno abierto** por sucursal a la vez.

---

### 2. shift_payment (Pagos por turno)

Desglose de pagos agrupados por metodo de pago para cada turno cerrado.

| Columna | Tipo | Descripcion |
|---|---|---|
| `id` | int PRI | Identificador |
| `cash_shift_id` | int FK | Turno (→ `cash_shift.id`) |
| `payment_method_id` | int FK | Metodo de pago (→ `method_pay.id`) |
| `amount` | double | Monto total por metodo |

Se crea al cerrar turno (`closeShift`). Un registro por cada metodo de pago usado.

---

### 3. shift_status_process (Conteo de estados por turno)

Cuantos pedidos habia en cada estado al momento de cerrar el turno.

| Columna | Tipo | Descripcion |
|---|---|---|
| `id` | int PRI | Identificador |
| `cash_shift_id` | int FK | Turno (→ `cash_shift.id`) |
| `status_process_id` | int FK | Estado del pedido (→ `status_process.id`) |
| `amount` | int | Cantidad de pedidos en ese estado |

---

### 4. daily_closure (Cierre diario)

Registro del cierre del dia completo. Es un nivel de bloqueo superior al turno.

| Columna | Tipo | Descripcion |
|---|---|---|
| `id` | int PRI | Identificador |
| `total` | double | Total del dia |
| `tax` | double | Impuestos |
| `subtotal` | double | Subtotal |
| `created_at` | datetime | Fecha/hora del cierre |
| `active` | int | Soft delete |
| `total_orders` | int | Total de pedidos del dia |
| `employee_id` | int FK | Empleado que realizo el cierre (→ `alpha.usr_users.id`) |
| `subsidiary_id` | int FK | Sucursal (→ `alpha.subsidiaries.id`) |

**Regla**: Solo puede existir **1 cierre diario** por fecha+sucursal.

---

### 5. closure_payment (Pagos del cierre diario)

Desglose de pagos por metodo de pago para el cierre del dia.

| Columna | Tipo | Descripcion |
|---|---|---|
| `id` | int PRI | Identificador |
| `daily_closure_id` | int FK | Cierre diario (→ `daily_closure.id`) |
| `payment_method_id` | int FK | Metodo de pago (→ `method_pay.id`) |
| `amount` | double | Monto total |

---

### 6. closure_status_proccess (Estados del cierre diario)

Conteo de pedidos por estado al momento del cierre diario.

| Columna | Tipo | Descripcion |
|---|---|---|
| `id` | int PRI | Identificador |
| `daily_closure_id` | int FK | Cierre diario (→ `daily_closure.id`) |
| `status_process_id` | int FK | Estado (→ `status_process.id`) |
| `amount` | double | Cantidad |

---

### 7. order (Pedidos - columnas relevantes)

La tabla `order` se vincula a turnos y cierres mediante:

| Columna | Uso en cierre |
|---|---|
| `cash_shift_id` | FK al turno activo cuando se creo el pedido |
| `daily_closure_id` | FK al cierre diario (se asigna al cerrar el dia) |
| `status` | Determina si cuenta como venta (!=4) o cancelado (=4) |
| `total_pay` | Monto que se suma en las metricas del turno |

---

### 8. Tablas de referencia (lookup)

| Tabla | Columnas | Uso |
|---|---|---|
| `status_process` | `id`, `status` | Catalogo de estados: 1=Cotizacion, 2=Pendiente, 3=Entregado, 4=Cancelado |
| `method_pay` | `id`, `method_pay` | Catalogo de metodos: 1=Efectivo, 2=Tarjeta, 3=Transferencia |

---

### 9. Tablas cross-database

| Tabla | Base | Uso |
|---|---|---|
| `usr_users` | `fayxzvov_alpha` | Nombre del empleado que abrio/cerro turno (`employee_id`) |
| `subsidiaries` | `fayxzvov_alpha` | Nombre de la sucursal |

---

## Flujo de Datos

### Abrir Turno

```
openShift()
    │
    ├── Valida: no exista turno abierto en la sucursal
    │
    └── INSERT → cash_shift
              subsidiary_id, employee_id, shift_name,
              opened_at=NOW(), opening_amount, status='open'
```

### Crear Pedido (vinculacion al turno)

```
createOrder()
    │
    ├── Busca turno abierto: getOpenShiftBySubsidiary()
    │
    └── INSERT → order
              cash_shift_id = turno_abierto.id (o NULL si no hay)
```

### Cerrar Turno

```
closeShift()
    │
    ├── 1. Calcula metricas: getShiftSalesMetrics()
    │     └── SELECT SUM(total_pay), COUNT(*) FROM order
    │         WHERE cash_shift_id = ? AND status != 4
    │     └── SELECT SUM(pay) FROM order_payments
    │         GROUP BY method_pay_id
    │
    ├── 2. UPDATE → cash_shift
    │     SET closed_at=NOW(), status='closed',
    │         total_sales, total_cash, total_card, total_transfer, total_orders
    │
    ├── 3. INSERT → shift_payment (1 registro por metodo de pago)
    │     cash_shift_id, payment_method_id, amount
    │
    ├── 4. INSERT → shift_status_process (1 registro por estado)
    │     cash_shift_id, status_process_id, amount
    │
    └── 5. UPDATE → order (vincular pedidos sin turno)
          SET cash_shift_id = ? WHERE date BETWEEN opened_at AND closed_at
```

### Cierre Diario

```
closeDailyShift()
    │
    ├── 1. Valida: no exista cierre para fecha+sucursal
    │
    ├── 2. INSERT → daily_closure
    │     total, tax, subtotal, total_orders, employee_id, subsidiary_id
    │
    ├── 3. INSERT → closure_payment (1 por metodo)
    │     daily_closure_id, payment_method_id, amount
    │
    ├── 4. INSERT → closure_status_proccess (1 por estado)
    │     daily_closure_id, status_process_id, amount
    │
    └── 5. UPDATE → order
          SET daily_closure_id = ? WHERE DATE(date_creation) = ?
          AND subsidiaries_id = ? AND daily_closure_id IS NULL
```

---

## Diagrama de Relaciones

```
fayxzvov_alpha.usr_users ─────────────┐
fayxzvov_alpha.subsidiaries ──────┐   │
                                  │   │
                                  ▼   ▼
                              cash_shift
                              (turno de caja)
                                  │
                    ┌─────────────┼─────────────┐
                    ▼             ▼              ▼
              shift_payment  shift_status   order
              (por metodo)   _process       (pedidos)
                             (por estado)       │
                                                ▼
                                          order_payments
                                          (pagos individuales)
                                                │
                                                ▼
                                           method_pay


fayxzvov_alpha.usr_users ─────────────┐
fayxzvov_alpha.subsidiaries ──────┐   │
                                  │   │
                                  ▼   ▼
                             daily_closure
                             (cierre del dia)
                                  │
                    ┌─────────────┼─────────────┐
                    ▼             ▼              ▼
           closure_payment  closure_status  order
           (por metodo)     _proccess       (vincula pedidos
                            (por estado)     al cierre)
```

---

## Jerarquia de Bloqueo

```
¿Se puede crear un pedido?
    │
    ├── daily_closure existe para hoy+sucursal?
    │     → SI: BLOQUEADO ("Cierre del dia realizado")
    │
    ├── cash_shift con status='open' para la sucursal?
    │     → NO: BLOQUEADO ("Sin turno abierto")
    │
    └── Ambas OK → PERMITIDO (pedido se vincula al turno abierto)
```

---

## Queries Clave del Modelo

### Metricas del turno (getShiftSalesMetrics)

```sql
-- Total ventas y pedidos
SELECT COUNT(*) as total_orders, COALESCE(SUM(total_pay), 0) as total_sales
FROM `order`
WHERE (cash_shift_id = :shift_id
   OR (cash_shift_id IS NULL
       AND date_creation >= :opened_at
       AND date_creation < :closed_at
       AND subsidiaries_id = :sub_id))
AND status != 4

-- Pagos agrupados por metodo
SELECT pp.method_pay_id, SUM(pp.pay) as total_paid
FROM order_payments pp
INNER JOIN `order` po ON pp.order_id = po.id
WHERE (po.cash_shift_id = :shift_id OR ...)
AND po.status != 4
GROUP BY pp.method_pay_id
```

### Verificar cierre diario (getDailyClosureByDate)

```sql
SELECT dc.*, u.fullname AS closed_by_name
FROM daily_closure dc
LEFT JOIN fayxzvov_alpha.usr_users u ON u.id = dc.employee_id
WHERE DATE(dc.created_at) = :date
AND dc.subsidiary_id = :sub_id
AND dc.active = 1
```

---

## Archivos de Codigo

| Archivo | Funciones relevantes |
|---|---|
| `mdl/mdl-pedidos.php` | `createCashShift`, `closeCashShift`, `getCashShiftById`, `getShiftSalesMetrics`, `getShiftDetailedOrders`, `createShiftPayment`, `createShiftStatusProcess`, `createDailyClosure`, `createClosurePayment`, `createClosureStatusProcess`, `getDailyClosureByDate`, `updateOrdersDailyClosure` |
| `ctrl/ctrl-pedidos.php` | `openShift`, `closeShift`, `getShiftsByDate`, `getShiftMetrics`, `getShiftOrders`, `checkDailyClosure`, `checkOpenShift`, `closeDailyShift` |
| `src/js/app.js` | `printDailyClose`, `loadShifts`, `openShift`, `closeShift`, `viewShiftPreview`, `ticketShiftClose` |
