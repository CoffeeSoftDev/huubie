# Roadmap Propuesta 4: Cierre Automatizado con Reportes

## Filosofia

Automatizar el cierre diario para que ocurra sin intervencion manual, complementado con un sistema de reportes que permite consultar cierres historicos, exportar datos y recibir notificaciones.

---

## Alcance

- Todo lo de Propuestas 1, 2 y 3
- Cierre automatico programado (cron job)
- Reportes historicos de cierres
- Exportacion a PDF/Excel
- Notificaciones por cierre pendiente
- Panel de reportes con filtros avanzados

---

## Fases

### Fase 1: Cierre Manual Completo (Base)

Implementar la Propuesta 2 como base: cierre con validaciones, checklist, preview.

### Fase 2: Cierre Automatico

**Componente**: Cron job PHP que se ejecuta diariamente a una hora configurable.

```
Cron: 0 23 * * * (cada dia a las 11:00 PM)
    |
    v
auto_daily_close.php
    |
    ├── Para cada sucursal activa:
    |     |
    |     ├── Hay turnos abiertos?
    |     |     --> SI: Cerrar turno automaticamente
    |     |              Log: "Turno cerrado automaticamente"
    |     |
    |     ├── Ya existe cierre?
    |     |     --> SI: Skip
    |     |
    |     └── Ejecutar closeDailyShift()
    |           Log: "Cierre diario automatico completado"
    |
    └── Enviar resumen por email/notificacion al admin
```

**Script PHP** (`cron/auto_daily_close.php`):

```php
// Pseudo-codigo del cron
foreach ($subsidiaries as $sub) {
    // 1. Cerrar turnos abiertos
    $openShifts = getOpenShiftsBySubsidiary($sub->id);
    foreach ($openShifts as $shift) {
        closeShift($shift->id); // Cierre automatico
        logAction("Turno {$shift->id} cerrado automaticamente");
    }

    // 2. Ejecutar cierre diario
    $existing = getDailyClosureByDate(date('Y-m-d'), $sub->id);
    if (!$existing) {
        $result = closeDailyShift(date('Y-m-d'), $sub->id, SYSTEM_USER_ID);
        logAction("Cierre diario automatico para sucursal {$sub->id}");
    }
}
```

**Tabla nueva**: `daily_close_config`

```sql
CREATE TABLE daily_close_config (
    id INT AUTO_INCREMENT PRIMARY KEY,
    subsidiary_id INT NOT NULL,
    auto_close_enabled TINYINT(1) DEFAULT 0,
    auto_close_time TIME DEFAULT '23:00:00',
    auto_close_shifts TINYINT(1) DEFAULT 1,  -- Cerrar turnos automaticamente
    notify_email VARCHAR(255) NULL,
    notify_before_minutes INT DEFAULT 60,     -- Notificar X minutos antes
    active INT DEFAULT 1
);
```

### Fase 3: Panel de Reportes Historicos

**Nuevo modulo o seccion dentro de pedidos**: Reportes de Cierres

```
+-------------------------------------------------------------------+
|  REPORTES DE CIERRE                                          [X]  |
+-------------------------------------------------------------------+
|                                                                   |
|  Filtros:                                                         |
|  [Sucursal v] [Desde: ___] [Hasta: ___] [Buscar]                |
|                                                                   |
|  +---TABLA DE CIERRES----------------------------------------+   |
|  | Fecha      | Sucursal  | Turnos | Pedidos | Total   | Acc  |  |
|  |------------|-----------|--------|---------|---------|------|  |
|  | 29/03/2026 | Reginas G | 2      | 25      | $15,000 | [>]  |  |
|  | 28/03/2026 | Reginas G | 3      | 30      | $18,500 | [>]  |  |
|  | 27/03/2026 | Reginas G | 2      | 20      | $12,000 | [>]  |  |
|  +-----------------------------------------------------------+   |
|                                                                   |
|  [Exportar PDF]  [Exportar Excel]                                |
|                                                                   |
|  +---GRAFICOS------------------------------------------------+   |
|  |                                                           |    |
|  |  Ventas ultimos 30 dias (grafico de linea)               |    |
|  |  Distribucion de metodos de pago (grafico de pastel)     |    |
|  |                                                           |    |
|  +-----------------------------------------------------------+    |
+-------------------------------------------------------------------+
```

**Queries para reportes**:

```sql
-- Listado de cierres con rango de fechas
SELECT
    dc.id, dc.created_at, dc.total, dc.total_orders, dc.subtotal,
    u.fullname as closed_by,
    s.subsidiarie as subsidiary_name,
    (SELECT COUNT(*) FROM cash_shift cs
     WHERE cs.daily_closure_id = dc.id AND cs.active = 1) as shift_count
FROM daily_closure dc
LEFT JOIN fayxzvov_alpha.usr_users u ON dc.employee_id = u.id
LEFT JOIN fayxzvov_alpha.subsidiaries s ON dc.subsidiary_id = s.id
WHERE dc.created_at BETWEEN :start_date AND :end_date
AND (:subsidiary_id = 0 OR dc.subsidiary_id = :subsidiary_id)
AND dc.active = 1
ORDER BY dc.created_at DESC

-- Totales acumulados para rango
SELECT
    COUNT(*) as total_closures,
    SUM(dc.total) as grand_total,
    SUM(dc.total_orders) as grand_orders,
    AVG(dc.total) as avg_daily_total
FROM daily_closure dc
WHERE dc.created_at BETWEEN :start_date AND :end_date
AND (:subsidiary_id = 0 OR dc.subsidiary_id = :subsidiary_id)
AND dc.active = 1

-- Ventas por dia (para grafico de linea)
SELECT
    DATE(dc.created_at) as date,
    dc.total as daily_total,
    dc.total_orders
FROM daily_closure dc
WHERE dc.created_at BETWEEN :start_date AND :end_date
AND dc.subsidiary_id = :subsidiary_id
AND dc.active = 1
ORDER BY dc.created_at ASC

-- Distribucion de metodos de pago (para grafico de pastel)
SELECT
    cp.payment_method_id,
    mp.method_pay as method_name,
    SUM(cp.amount) as total_amount
FROM closure_payment cp
INNER JOIN daily_closure dc ON cp.daily_closure_id = dc.id
LEFT JOIN method_pay mp ON cp.payment_method_id = mp.id
WHERE dc.created_at BETWEEN :start_date AND :end_date
AND dc.subsidiary_id = :subsidiary_id
AND dc.active = 1
GROUP BY cp.payment_method_id
```

### Fase 4: Exportacion PDF/Excel

**PDF**: Generar ticket de cierre en formato PDF descargable usando libreria existente o generacion HTML-to-PDF del lado del cliente.

**Excel**: Endpoint que retorne datos formateados para descarga.

```sql
-- Datos para exportar a Excel (detalle completo)
SELECT
    dc.created_at as 'Fecha Cierre',
    s.subsidiarie as 'Sucursal',
    u.fullname as 'Cerrado Por',
    dc.total as 'Total Ventas',
    dc.total_orders as 'Total Pedidos',
    (SELECT SUM(amount) FROM closure_payment WHERE daily_closure_id = dc.id AND payment_method_id = 1) as 'Efectivo',
    (SELECT SUM(amount) FROM closure_payment WHERE daily_closure_id = dc.id AND payment_method_id = 2) as 'Tarjeta',
    (SELECT SUM(amount) FROM closure_payment WHERE daily_closure_id = dc.id AND payment_method_id = 3) as 'Transferencia'
FROM daily_closure dc
LEFT JOIN fayxzvov_alpha.usr_users u ON dc.employee_id = u.id
LEFT JOIN fayxzvov_alpha.subsidiaries s ON dc.subsidiary_id = s.id
WHERE dc.created_at BETWEEN :start AND :end
AND dc.active = 1
ORDER BY dc.created_at DESC
```

### Fase 5: Notificaciones

**Tipos de notificacion**:

| Evento | Canal | Mensaje |
|--------|-------|---------|
| Cierre pendiente (1hr antes) | In-app | "Recuerda realizar el cierre del dia" |
| Cierre automatico completado | Email | "Cierre automatico realizado: $TOTAL" |
| Turno abierto > 12hrs | In-app | "Turno abierto hace mas de 12 horas" |
| Cierre fallido | Email + In-app | "Error en cierre automatico: [motivo]" |

**Tabla nueva**: `daily_close_notifications`

```sql
CREATE TABLE daily_close_notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    subsidiary_id INT NOT NULL,
    type ENUM('reminder', 'auto_close', 'warning', 'error'),
    message TEXT,
    read_at DATETIME NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    active INT DEFAULT 1
);
```

---

## Diagrama de Arquitectura

```
                    +------------------+
                    |   CRON JOB       |
                    | auto_daily_close |
                    +--------+---------+
                             |
                             v
+----------+    +-----------------------+    +------------------+
| Frontend | -> | ctrl-pedidos.php      | -> | mdl-pedidos.php  |
| app.js   |    |-----------------------|    |------------------|
|          |    | closeDailyShift       |    | Queries BD       |
| Dashboard|    | getDailyDashboard     |    | daily_closure    |
| Reportes |    | getDailyClosePreview  |    | closure_payment  |
| Ticket   |    | getClosureReports     |    | cash_shift       |
| Export   |    | exportClosureData     |    | order            |
+----------+    | reopenDailyClosure    |    +------------------+
                +-----------------------+
                             |
                             v
                    +------------------+
                    | Notificaciones   |
                    | Email + In-app   |
                    +------------------+
```

---

## Estimacion de Complejidad

| Componente | Complejidad |
|------------|-------------|
| Cierre manual (base) | Media |
| Cron automatico | Media |
| Reportes historicos | Alta |
| Graficos | Media |
| Exportacion PDF/Excel | Media |
| Notificaciones | Media |
| Config auto-cierre | Baja |
| **Total** | **Muy Alta** |

---

## Ventajas

- Operacion 100% automatizada si se desea
- Historial completo para auditoria
- Datos exportables para contabilidad
- Alertas proactivas evitan olvidos
- Escalable a multiples sucursales

## Desventajas

- Implementacion muy extensa
- Requiere infraestructura de cron jobs
- Mas tablas y complejidad en BD
- Mantenimiento significativo
- Podria requerir modulo separado para reportes

---

## Recomendacion de Implementacion Progresiva

```
Semana 1-2: Propuesta 1 (MVP)
    --> Boton basico funcional

Semana 3-4: Propuesta 2 (Validaciones)
    --> Preview y checklist

Semana 5-8: Propuesta 3 (Dashboard)
    --> Vista completa + reapertura

Semana 9-12: Propuesta 4 (Automatizacion)
    --> Cron + Reportes + Notificaciones
```

Cada fase es independiente y funcional por si sola. Se puede detener en cualquier punto y el sistema sigue siendo usable.
