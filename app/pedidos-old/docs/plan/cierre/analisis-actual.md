# Analisis de la Estrategia Actual - Cierre de Turno

## Estado Actual del Sistema

El sistema de pedidos opera con un modelo de **turnos de caja** (`cash_shift`) que funciona como unidad operativa para agrupar ventas por sesion de trabajo.

---

## Arquitectura de Turnos (Implementado)

### Flujo Operativo

```
Usuario abre la app
    |
    v
init() --> checkDailyClosure() + checkOpenShift()
    |
    v
+--------------------------+
| dailyClosure.is_closed?  |--SI--> Bloquea "Nuevo Pedido"
+--------------------------+        Muestra alerta amarilla
    | NO
    v
+--------------------------+
| openShift.has_open_shift?|--NO--> Bloquea "Nuevo Pedido"
+--------------------------+        Muestra alerta ambar
    | SI
    v
+--------------------------+
| Turno de otro dia?       |--SI--> Bloquea "Nuevo Pedido"
+--------------------------+        "Turno pendiente de otro dia"
    | NO
    v
Permite crear pedidos
```

### Ciclo de Vida del Turno

```
[Sin turno] --openShift()--> [ABIERTO] --closeShift()--> [CERRADO]
                                |                            |
                                |  Pedidos se vinculan       |  Se calculan metricas
                                |  via cash_shift_id         |  Se guardan totales
                                |                            |  Se generan registros
                                v                            |  en shift_payment y
                           order.cash_shift_id = X           |  shift_status_process
                                                             v
                                                        Ticket de cierre
```

---

## Componentes del Sistema de Turnos

### 1. Frontend (app.js)

| Metodo | Linea | Funcion |
|--------|-------|---------|
| `printDailyClose()` | 2334 | Abre modal principal de cierre |
| `loadShifts()` | 2428 | Carga turnos por fecha/sucursal |
| `openShift()` | 2700 | Dialogo para abrir turno nuevo |
| `closeShift()` | 2755 | Confirmacion y cierre de turno |
| `viewShiftPreview()` | 2520 | Preview del ticket de turno |
| `ticketShiftClose()` | 2566 | Renderiza HTML del ticket |
| `toggleReportMode()` | 2730 | Alterna detallado/resumido |
| `printDailyCloseTicket()` | 2801 | Imprime ticket en ventana nueva |
| `updateDailyClosureStatus()` | 256 | Evalua estado y habilita/deshabilita UI |

### 2. Backend - Controlador (ctrl-pedidos.php)

| opc | Funcion |
|-----|---------|
| `checkDailyClosure` | Verifica si existe cierre para fecha+sucursal |
| `openShift` | Crea turno validando que no exista otro abierto |
| `closeShift` | Cierra turno, calcula metricas, vincula ordenes |
| `getShiftsByDate` | Lista turnos de una fecha |
| `getOpenShifts` | Obtiene turnos abiertos pendientes |
| `getShiftMetrics` | Metricas de un turno (real-time si abierto, stored si cerrado) |
| `getShiftOrders` | Ordenes detalladas de un turno |

### 3. Backend - Modelo (mdl-pedidos.php)

| Metodo | Descripcion |
|--------|-------------|
| `createCashShift()` | INSERT en cash_shift |
| `closeCashShift()` | UPDATE status='closed', guarda totales |
| `getCashShiftById()` | SELECT con JOIN a usr_users |
| `getShiftSalesMetrics()` | Query complejo de metricas por turno |
| `getShiftsBySubsidiaryDate()` | Turnos de una fecha+sucursal |
| `getOpenShiftBySubsidiary()` | Turno abierto actual |
| `getAllOpenShiftsBySubsidiary()` | Todos los turnos abiertos |
| `createShiftPayment()` | INSERT desglose de pagos del turno |
| `createShiftStatusProcess()` | INSERT conteo de estados del turno |
| `updateOrdersCashShift()` | Vincula ordenes huerfanas al turno |

### 4. Tablas de BD

| Tabla | Registros | Estado |
|-------|-----------|--------|
| `cash_shift` | Turno de caja | Funcional |
| `shift_payment` | Pagos por metodo del turno | Funcional |
| `shift_status_process` | Conteo de estados del turno | Funcional |
| `daily_closure` | Cierre diario | Tabla existe, INSERT parcial |
| `closure_payment` | Pagos del cierre diario | Tabla existe, sin uso activo |
| `closure_status_proccess` | Estados del cierre diario | Tabla existe, sin uso activo |

---

## Metricas que Calcula el Cierre de Turno

Al cerrar un turno (`closeShift`), el sistema calcula:

```sql
-- Ventas totales (excluyendo cancelados)
SELECT COUNT(*) as total_orders, SUM(total_pay) as total_sales
FROM `order`
WHERE cash_shift_id = :shift_id AND status != 4

-- Pagos agrupados por metodo
SELECT pp.method_pay_id, SUM(pp.pay) as total_paid
FROM order_payments pp
INNER JOIN `order` po ON pp.order_id = po.id
WHERE po.cash_shift_id = :shift_id AND po.status != 4
GROUP BY pp.method_pay_id
```

### Datos almacenados en cash_shift al cerrar:

| Campo | Contenido |
|-------|-----------|
| `total_sales` | Suma de total_pay de ordenes activas |
| `total_cash` | Total pagado en efectivo (method_pay_id=1) |
| `total_card` | Total pagado con tarjeta (method_pay_id=2) |
| `total_transfer` | Total por transferencia (method_pay_id=3) |
| `total_orders` | Conteo de ordenes activas |
| `closed_at` | Timestamp del cierre |

---

## Lo que FALTA: Cierre Diario

### Funcionalidad existente (parcial):

1. **Deteccion**: `checkDailyClosure()` puede verificar si ya existe un cierre
2. **Bloqueo UI**: `updateDailyClosureStatus()` deshabilita "Nuevo Pedido" si existe cierre
3. **Tablas**: `daily_closure`, `closure_payment`, `closure_status_proccess` ya existen
4. **Modelo**: `createDailyClosure()`, `getDailyClosureByDate()`, `updateOrdersDailyClosure()` existen

### Funcionalidad faltante:

1. **Boton en UI**: No existe un boton "Cierre Diario" separado del cierre de turno
2. **Logica de consolidacion**: No hay funcion que sume metricas de TODOS los turnos del dia
3. **Validacion pre-cierre**: No valida que todos los turnos esten cerrados antes del cierre diario
4. **Ticket de cierre diario**: No existe un formato de ticket que consolide el dia completo
5. **Reapertura**: No hay mecanismo para reabrir un cierre diario

---

## Mensajes Actuales del Sistema

| Contexto | Mensaje | Icono |
|----------|---------|-------|
| Dia cerrado (alerta) | "Cierre del dia realizado. No se pueden crear nuevos pedidos para hoy." | icon-lock |
| Dia cerrado (alert) | "No se pueden crear nuevos pedidos porque ya se realizo el cierre del dia para esta sucursal." | warning |
| Sin turno (alerta) | "Sin turno abierto - abrir turno en Cierre del dia para crear pedidos" | amber pulse |
| Sin turno (alert) | "Debes abrir un turno de caja antes de crear pedidos." | warning |
| Turno viejo (alerta) | "Turno del DD/MMM/YYYY sin cerrar - cerrar turno para crear nuevos pedidos" | amber pulse |
| Turno viejo (alert) | "Existe un turno abierto que no corresponde al dia de hoy." | warning |
| Turno abierto | "Turno abierto" | success |
| Turno cerrado | "Turno cerrado" | success |

---

## Conclusion

El sistema tiene una base solida para turnos individuales. La pieza faltante es el **cierre diario** que actue como consolidador de todos los turnos de un dia, generando un registro unico en `daily_closure` con sus respectivos desgloses en `closure_payment` y `closure_status_proccess`, y vinculando todas las ordenes del dia via `daily_closure_id`.
