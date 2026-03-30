# Plan de Cierre Diario - Módulo Pedidos

**Fecha**: 2026-03-29
**Estado**: Implementado (pendiente ejecución de migración SQL)

---

## Contexto

El módulo de pedidos contaba con un sistema de **turnos de caja** (`cash_shift`) funcional, pero le faltaba un **cierre diario consolidado** que sumara todos los turnos del día. Se implementó un sistema completo que abarca desde el MVP hasta un dashboard operativo con comparativas.

---

## Cierre Parcial - Tickets Legacy

### Decisión
Los **119 tickets existentes** (desde 2025-12-08 hasta 2026-03-29) pertenecen a una **lógica anterior** al sistema de cierre diario. Estos tickets:

- **NO se eliminan ni se ocultan** — siguen visibles en listados, búsquedas y reportes
- **NO participan** en el nuevo flujo de cierre diario
- Están marcados con `is_legacy = 1` en la tabla `order`
- Tienen un registro de cierre especial en `daily_closure` (con `is_legacy = 1`) por cada sucursal

### Distribución de tickets legacy
| Sucursal ID | Tickets (sin cancelados) |
|-------------|-------------------------|
| 4           | 94                      |
| 22          | 8                       |
| 25          | 16                      |

### Regla clave
- Queries de **cierre diario**: filtran `AND is_legacy = 0`
- Queries de **consulta/listado**: NO filtran por legacy (siguen visibles)

### Migración
Script SQL en: `alpha/pedidos/docs/plan/cierre/migration-legacy.sql`

> **IMPORTANTE**: Ejecutar UNA SOLA VEZ antes de usar el nuevo sistema.

---

## Fases Implementadas

### Fase 1: MVP - Botón "Cerrar Día"

**Funcionalidad:**
- Botón "Cerrar Día" en el modal de cierre
- Consolida métricas de TODOS los turnos cerrados del día
- Registra en `daily_closure` + `closure_payment` + `closure_status_proccess`
- Vincula órdenes y turnos al cierre (`daily_closure_id`)
- Bloquea creación de nuevos pedidos post-cierre

**Validaciones:**
1. No exista cierre previo para la misma fecha+sucursal
2. No haya turnos abiertos

### Fase 2: Validaciones Estrictas

**Funcionalidad:**
- Preview completo antes de ejecutar el cierre (`getDailyClosePreview`)
- Checklist visual con iconos de estado:
  - Verde ✓ — validación pasada
  - Amarillo ⚠ — advertencia (no bloquea)
  - Rojo ✗ — bloqueante (impide cierre)
- Detección de pedidos huérfanos (sin turno)
- Detección de pedidos con saldo pendiente
- Flujo en 2 pasos: Preview → Confirmación

### Fase 3: Dashboard Multi-turno

**Funcionalidad:**
- Modal transformado en dashboard operativo
- 4 métricas rápidas: Ventas Hoy, Pedidos, Ticket Promedio, vs Ayer %
- Cards de turnos del día con click para ver detalle
- Desglose de pagos con barras proporcionales (Efectivo, Tarjeta, Transferencia)
- Timeline cronológico de actividad del día
- Comparativa porcentual con el día anterior
- Reapertura de cierre (solo admin, requiere motivo)
- Ticket de cierre diario consolidado diferenciado

---

## Archivos Modificados

### Backend

| Archivo | Cambios |
|---------|---------|
| `mdl/mdl-pedidos.php` | +15 métodos nuevos, 2 modificaciones |
| `ctrl/ctrl-pedidos.php` | +4 endpoints nuevos, 1 modificación |

#### Métodos MDL nuevos
| Método | Fase | Descripción |
|--------|------|-------------|
| `getDailyConsolidatedMetrics()` | 1 | SUM de métricas de turnos cerrados |
| `getOpenShiftsByDate()` | 1 | Turnos abiertos para validación |
| `getOrphanOrdersByDate()` | 1 | Pedidos sin turno asignado |
| `getConsolidatedPayments()` | 1 | Pagos consolidados por método |
| `getConsolidatedStatuses()` | 1 | Conteo de estados consolidado |
| `linkShiftsToClosure()` | 1 | Vincular turnos al cierre |
| `getMaxDailyClosure()` | 1 | MAX(id) de daily_closure |
| `getOrdersWithPendingBalance()` | 2 | Pedidos con saldo > 0 |
| `getShiftsDetailByDate()` | 2 | Detalle de turnos con empleado |
| `getDailyComparison()` | 3 | Métricas del día anterior |
| `getDailyTimeline()` | 3 | UNION de eventos cronológicos |
| `reopenDailyClosure()` | 3 | UPDATE status='reopened' |
| `unlinkOrdersFromClosure()` | 3 | Desvincular órdenes |
| `unlinkShiftsFromClosure()` | 3 | Desvincular turnos |
| `getDailyClosureById()` | 3 | Cierre por ID con JOINs |

#### Métodos MDL modificados
| Método | Cambio |
|--------|--------|
| `getDailyClosureByDate()` | +`AND (dc.status = 'closed' OR dc.status IS NULL) AND dc.is_legacy = 0` |
| `updateOrdersDailyClosure()` | +`AND is_legacy = 0` |

#### Endpoints CTRL nuevos
| Endpoint | Fase | POST params |
|----------|------|-------------|
| `closeDailyShift` | 1 | date, subsidiaries_id |
| `getDailyClosePreview` | 2 | date, subsidiaries_id |
| `getDailyDashboard` | 3 | date, subsidiaries_id |
| `reopenDailyClosure` | 3 | closure_id, reason |

#### Endpoints CTRL modificados
| Endpoint | Cambio |
|----------|--------|
| `checkDailyClosure` | Verifica `status === 'closed'` (no bloquea si reopened) |

### Frontend

| Archivo | Cambios |
|---------|---------|
| `src/js/app.js` | Rediseño completo de sección cierre diario |

#### Métodos JS nuevos/modificados
| Método | Tipo | Descripción |
|--------|------|-------------|
| `printDailyClose()` | Rediseñado | Dashboard layout en modal |
| `loadDashboard()` | Renombrado | Antes `loadShifts()`, ahora llama `getDailyDashboard` |
| `renderDailyDashboard()` | Nuevo | Renderiza métricas, turnos, pagos, timeline |
| `executeDailyClose()` | Nuevo | Preview → Checklist → Confirmación |
| `showDailyCloseChecklist()` | Nuevo | Checklist visual pre-cierre |
| `confirmDailyClose()` | Nuevo | SweetAlert → closeDailyShift |
| `ticketDailyClose()` | Nuevo | Ticket consolidado "CIERRE DIARIO" |
| `reopenDailyClosure()` | Nuevo | SweetAlert con motivo → reopen |
| `viewShiftDetail()` | Nuevo | Helper para expandir detalle de turno |

### Base de Datos

| Tabla | Cambio |
|-------|--------|
| `order` | +columna `is_legacy` TINYINT(1) DEFAULT 0 |
| `daily_closure` | +columnas: `closure_date`, `total_shifts`, `total_cash`, `total_card`, `total_transfer`, `total_discount`, `status`, `reopened_by`, `reopened_at`, `reopen_reason`, `is_legacy` |

---

## Esquema de Flujo

```
Usuario abre "Cierre del Día"
    │
    ├── loadDashboard() → getDailyDashboard
    │       │
    │       └── renderDailyDashboard()
    │           ├── Métricas rápidas (4 cards)
    │           ├── Cards de turnos
    │           ├── Desglose de pagos
    │           ├── Timeline
    │           └── Botones de acción
    │
    ├── Click "Cerrar Día"
    │       │
    │       └── executeDailyClose() → getDailyClosePreview
    │               │
    │               ├── can_close = true → showDailyCloseChecklist()
    │               │       │
    │               │       └── Click "Confirmar" → confirmDailyClose()
    │               │               │
    │               │               └── closeDailyShift → OK → loadDashboard()
    │               │
    │               └── can_close = false → Mostrar issues bloqueantes
    │
    ├── Click "Reabrir" (solo admin)
    │       │
    │       └── reopenDailyClosure() → Swal motivo → POST → loadDashboard()
    │
    └── Click en turno → viewShiftDetail() → viewShiftPreview()
```

---

## Verificación

### Pre-requisitos
1. Ejecutar `migration-legacy.sql` en la base de datos

### Tests manuales
- [ ] Abrir turno → crear pedidos → cerrar turno → verificar que aparece en dashboard
- [ ] Click "Cerrar Día" → ver checklist con validaciones → confirmar → verificar bloqueo
- [ ] Recargar página → verificar que `dailyClosure.is_closed` detecta cierre
- [ ] Consultar tickets legacy → deben aparecer en listados normales
- [ ] Reabrir cierre (admin) → verificar que se puede crear pedidos nuevamente
- [ ] Comparativa vs ayer → verificar porcentajes correctos
- [ ] Imprimir ticket diario → verificar formato consolidado
- [ ] Intentar cerrar con turnos abiertos → debe bloquear

---

## Propuestas NO implementadas

### Propuesta 4: Automatización con Reportes
Documentada en `roadmap-propuesta-4.md`. Incluye:
- Cierre automatizado por cron job (11 PM)
- Reportes históricos con filtros
- Exportación PDF/Excel
- Notificaciones push

Se considera para una fase futura.
