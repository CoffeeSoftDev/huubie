# Roadmap Propuesta 3: Cierre Multi-turno con Dashboard

## Filosofia

Transformar el modal de cierre en un **dashboard operativo** que muestre el estado del dia en tiempo real, permita gestionar turnos y ejecutar el cierre diario desde una vista unificada con graficos y comparativas.

---

## Alcance

- Todo lo de Propuestas 1 y 2
- Dashboard visual con metricas en tiempo real
- Graficos de ventas por turno y metodo de pago
- Comparativa con dias anteriores
- Timeline de actividad del dia
- Ticket de cierre diario con formato diferenciado del ticket de turno
- Opcion de reabrir cierre (solo admin)

---

## Fases

### Fase 1: Backend - API de Dashboard

**Nuevos endpoints**:

| opc | Descripcion | Retorna |
|-----|-------------|---------|
| `getDailyDashboard` | Estado completo del dia | Turnos, metricas, timeline, comparativa |
| `closeDailyShift` | Ejecutar cierre diario | Resultado del cierre |
| `reopenDailyClosure` | Reabrir cierre (admin) | Nuevo estado |
| `getDailyComparison` | Comparar con dia anterior | Metricas comparativas |

**Query de comparativa**:

```sql
-- Ventas del dia anterior para la misma sucursal
SELECT
    COALESCE(SUM(cs.total_sales), 0) as prev_total_sales,
    COALESCE(SUM(cs.total_orders), 0) as prev_total_orders,
    COALESCE(SUM(cs.total_cash), 0) as prev_cash,
    COALESCE(SUM(cs.total_card), 0) as prev_card,
    COALESCE(SUM(cs.total_transfer), 0) as prev_transfer
FROM cash_shift cs
WHERE DATE(cs.opened_at) = DATE_SUB(:date, INTERVAL 1 DAY)
AND cs.subsidiary_id = :subsidiary_id
AND cs.status = 'closed'
AND cs.active = 1
```

**Query de timeline de actividad**:

```sql
-- Actividad del dia (turnos abiertos/cerrados, pedidos creados)
(SELECT 'shift_open' as type, opened_at as timestamp, shift_name as detail, id
 FROM cash_shift WHERE DATE(opened_at) = :date AND subsidiary_id = :sub_id AND active = 1)
UNION ALL
(SELECT 'shift_close' as type, closed_at as timestamp, shift_name as detail, id
 FROM cash_shift WHERE DATE(opened_at) = :date AND subsidiary_id = :sub_id AND status = 'closed' AND active = 1)
UNION ALL
(SELECT 'order_created' as type, date_creation as timestamp, folio as detail, id
 FROM `order` WHERE DATE(date_creation) = :date AND subsidiaries_id = :sub_id AND active = 1)
ORDER BY timestamp ASC
```

### Fase 2: Frontend - Dashboard Layout

**Redisenar** el contenido del modal `printDailyClose()`:

```
+-------------------------------------------------------------------+
|  CIERRE DEL DIA - [Sucursal] - [Fecha]                      [X]  |
+-------------------------------------------------------------------+
|                                                                   |
|  +---METRICAS RAPIDAS---------------------------------------+    |
|  |                                                           |    |
|  |  VENTAS HOY    PEDIDOS    TICKET PROM.   vs AYER         |    |
|  |  $15,000       25         $600           +12%            |    |
|  |                                                           |    |
|  +-----------------------------------------------------------+    |
|                                                                   |
|  +---TURNOS DEL DIA---------+  +---DESGLOSE DE PAGOS------+     |
|  |                           |  |                           |     |
|  | Matutino  08:00-14:00     |  |  [===== Efectivo 53% ===] |     |
|  | $8,000 | 12 pedidos  [OK] |  |  [==== Tarjeta 33% ====]  |     |
|  |                           |  |  [== Transfer 14% ==]      |     |
|  | Vespertino 14:30-21:00    |  |                           |     |
|  | $7,000 | 13 pedidos  [OK] |  |  Efectivo:      $8,000    |     |
|  |                           |  |  Tarjeta:       $5,000    |     |
|  +---------------------------+  |  Transferencia: $2,000    |     |
|                                 +---------------------------+     |
|  +---TIMELINE DEL DIA---------------------------------------+    |
|  |                                                           |    |
|  |  08:00 Turno "Matutino" abierto                          |    |
|  |  08:15 Pedido #127 creado - $500                         |    |
|  |  09:30 Pedido #128 creado - $1,200                       |    |
|  |  ...                                                      |    |
|  |  14:00 Turno "Matutino" cerrado - $8,000                 |    |
|  |  14:30 Turno "Vespertino" abierto                        |    |
|  |  ...                                                      |    |
|  +-----------------------------------------------------------+    |
|                                                                   |
|  +---ACCIONES------------------------------------------------+   |
|  |                                                           |    |
|  |  [Abrir Turno]  [Cerrar Dia]  [Imprimir]  [Reabrir*]    |    |
|  |                                                           |    |
|  +-----------------------------------------------------------+    |
+-------------------------------------------------------------------+
* Solo visible para admin si ya existe cierre
```

### Fase 3: Ticket de Cierre Diario

Crear `ticketDailyClose()` con formato diferenciado:

- Header con "CIERRE DIARIO" en lugar de "Cierre Operativo"
- Seccion de resumen por turno
- Consolidado total
- Comparativa con dia anterior (opcional)
- Badge "CIERRE DIARIO" en lugar de "CERRADO"

### Fase 4: Reabrir Cierre (Admin)

**Endpoint**: `reopenDailyClosure`

```sql
-- Soft-delete del cierre
UPDATE daily_closure SET active = 0 WHERE id = :closure_id AND subsidiary_id = :subsidiary_id

-- Desvincular ordenes
UPDATE `order` SET daily_closure_id = NULL
WHERE daily_closure_id = :closure_id

-- Desvincular turnos
UPDATE cash_shift SET daily_closure_id = NULL
WHERE daily_closure_id = :closure_id
```

**Validaciones**:
- Solo rol == 1 (admin)
- Requiere motivo de reapertura
- Log de auditoria

### Fase 5: Integracion y Pruebas

- Dashboard funcional con datos reales
- Cierre diario completo
- Reapertura con permisos
- Ticket de cierre imprimible

---

## Estimacion de Complejidad

| Componente | Complejidad |
|------------|-------------|
| Backend dashboard API | Alta |
| Backend cierre + reabrir | Media |
| Dashboard UI | Alta |
| Timeline | Media |
| Ticket cierre diario | Media |
| Comparativa | Baja |
| **Total** | **Alta** |

---

## Ventajas

- Vista completa del dia en un solo lugar
- Informacion visual (barras, porcentajes)
- Timeline facilita auditoria
- Comparativa ayuda a detectar anomalias
- Reapertura da flexibilidad operativa

## Desventajas

- Implementacion significativamente mas compleja
- Requiere mas queries al backend
- Mas mantenimiento de UI
- Podria ser over-engineering para el uso actual
