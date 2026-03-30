# Estrategia: Boton de Cierre Diario

## Objetivo

Agregar un boton **"Cierre del Dia"** dentro del modal de cierre que consolide todos los turnos cerrados de una fecha+sucursal en un unico registro `daily_closure`, bloqueando la creacion de nuevos pedidos para ese dia.

---

## Diferencia: Cierre de Turno vs Cierre Diario

| Aspecto | Cierre de Turno | Cierre Diario |
|---------|----------------|---------------|
| **Alcance** | 1 sesion de trabajo | Todo el dia operativo |
| **Frecuencia** | Multiples por dia | 1 por dia por sucursal |
| **Tabla** | `cash_shift` | `daily_closure` |
| **Efecto** | Cierra una caja | Bloquea creacion de pedidos |
| **Relacion** | Independiente | Consolida N turnos |
| **Revertible** | No (pero se puede abrir otro) | Deberia ser revertible por admin |

---

## Flujo Propuesto del Boton "Cierre del Dia"

```
Usuario presiona "Cierre del Dia" (nuevo boton en modal)
    |
    v
+----------------------------------+
| 1. VALIDACIONES PRE-CIERRE      |
+----------------------------------+
    |
    ├── Hay turnos abiertos?
    |     --> SI: Mostrar alerta "Cierra todos los turnos antes"
    |              Listar turnos pendientes con opcion de cerrarlos
    |
    ├── Ya existe cierre para hoy+sucursal?
    |     --> SI: Mostrar "El dia ya fue cerrado por [nombre] a las [hora]"
    |
    ├── Hay pedidos sin turno asignado?
    |     --> SI: Advertencia "X pedidos no estan vinculados a ningun turno"
    |
    └── Todo OK
          |
          v
+----------------------------------+
| 2. PREVIEW DEL CIERRE           |
+----------------------------------+
    |
    ├── Mostrar resumen consolidado:
    |     - Total de turnos del dia
    |     - Total de ventas (suma de todos los turnos)
    |     - Desglose por metodo de pago (consolidado)
    |     - Conteo de pedidos por estado
    |     - Comparativa turno por turno
    |
    └── Botones: [Confirmar Cierre] [Cancelar]
          |
          v
+----------------------------------+
| 3. CONFIRMACION (Swal)          |
+----------------------------------+
    |
    ├── "Se cerrara el dia con X turnos y Y pedidos"
    |   "Esta accion bloqueara la creacion de nuevos pedidos"
    |
    └── Confirma
          |
          v
+----------------------------------+
| 4. EJECUCION (Backend)          |
+----------------------------------+
    |
    ├── INSERT daily_closure (total, tax, subtotal, total_orders, employee_id, subsidiary_id)
    |
    ├── INSERT closure_payment x3 (efectivo, tarjeta, transferencia)
    |
    ├── INSERT closure_status_proccess xN (cotizacion, pendiente, cancelado, etc.)
    |
    ├── UPDATE order SET daily_closure_id = ? WHERE fecha+sucursal
    |
    ├── UPDATE cash_shift SET daily_closure_id = ? (vincular turnos al cierre)
    |
    └── Retorna: closure_id, resumen
          |
          v
+----------------------------------+
| 5. POST-CIERRE                  |
+----------------------------------+
    |
    ├── Alert: "Cierre del dia realizado exitosamente"
    ├── Actualizar variable global: dailyClosure = { is_closed: true }
    ├── Actualizar UI: deshabilitar "Nuevo Pedido"
    ├── Generar ticket de cierre diario (formato consolidado)
    └── Opcion de imprimir ticket
```

---

## Consultas SQL Necesarias

### 1. Validar turnos abiertos antes del cierre

```sql
-- Verificar que no haya turnos abiertos para la sucursal
SELECT id, shift_name, opened_at
FROM cash_shift
WHERE subsidiary_id = :subsidiary_id
AND DATE(opened_at) = :date
AND status = 'open'
AND active = 1
```

**Uso**: Si retorna registros, NO permitir el cierre diario.

### 2. Obtener metricas consolidadas del dia

```sql
-- Consolidar ventas de todos los turnos cerrados del dia
SELECT
    COUNT(DISTINCT cs.id) as total_shifts,
    COALESCE(SUM(cs.total_sales), 0) as total_sales,
    COALESCE(SUM(cs.total_cash), 0) as total_cash,
    COALESCE(SUM(cs.total_card), 0) as total_card,
    COALESCE(SUM(cs.total_transfer), 0) as total_transfer,
    COALESCE(SUM(cs.total_orders), 0) as total_orders,
    COALESCE(SUM(cs.total_discount), 0) as total_discount,
    COALESCE(SUM(cs.total_cancelled), 0) as total_cancelled
FROM cash_shift cs
WHERE DATE(cs.opened_at) = :date
AND cs.subsidiary_id = :subsidiary_id
AND cs.status = 'closed'
AND cs.active = 1
```

### 3. Obtener pedidos sin turno (huerfanos del dia)

```sql
-- Pedidos del dia que no estan vinculados a ningun turno
SELECT id, folio, total_pay, name, status
FROM `order`
WHERE DATE(date_creation) = :date
AND subsidiaries_id = :subsidiary_id
AND (cash_shift_id IS NULL OR cash_shift_id = 0)
AND status != 4
AND active = 1
```

### 4. Obtener desglose por metodo de pago (consolidado del dia)

```sql
-- Pagos consolidados de todos los turnos del dia
SELECT
    sp.payment_method_id,
    mp.method_pay as method_name,
    SUM(sp.amount) as total_amount
FROM shift_payment sp
INNER JOIN cash_shift cs ON sp.cash_shift_id = cs.id
LEFT JOIN method_pay mp ON sp.payment_method_id = mp.id
WHERE DATE(cs.opened_at) = :date
AND cs.subsidiary_id = :subsidiary_id
AND cs.status = 'closed'
AND cs.active = 1
GROUP BY sp.payment_method_id
```

### 5. Obtener conteo de estados consolidado

```sql
-- Estados consolidados de todos los turnos del dia
SELECT
    ssp.status_process_id,
    sp.status as status_name,
    SUM(ssp.amount) as total_count
FROM shift_status_process ssp
INNER JOIN cash_shift cs ON ssp.cash_shift_id = cs.id
LEFT JOIN status_process sp ON ssp.status_process_id = sp.id
WHERE DATE(cs.opened_at) = :date
AND cs.subsidiary_id = :subsidiary_id
AND cs.status = 'closed'
AND cs.active = 1
GROUP BY ssp.status_process_id
```

### 6. Crear el cierre diario

```sql
-- Insertar registro de cierre diario
INSERT INTO daily_closure (total, tax, subtotal, total_orders, employee_id, subsidiary_id, created_at, active)
VALUES (:total, :tax, :subtotal, :total_orders, :employee_id, :subsidiary_id, NOW(), 1)
```

### 7. Registrar desglose de pagos del cierre

```sql
-- Un INSERT por cada metodo de pago
INSERT INTO closure_payment (daily_closure_id, payment_method_id, amount)
VALUES (:closure_id, :method_id, :amount)
```

### 8. Registrar conteo de estados del cierre

```sql
-- Un INSERT por cada estado
INSERT INTO closure_status_proccess (daily_closure_id, status_process_id, amount)
VALUES (:closure_id, :status_id, :count)
```

### 9. Vincular ordenes al cierre diario

```sql
-- Asignar daily_closure_id a todas las ordenes del dia
UPDATE `order`
SET daily_closure_id = :closure_id
WHERE DATE(date_creation) = :date
AND subsidiaries_id = :subsidiary_id
AND (daily_closure_id IS NULL OR daily_closure_id = 0)
AND active = 1
```

### 10. Vincular turnos al cierre diario

```sql
-- Asociar los turnos del dia al cierre
UPDATE cash_shift
SET daily_closure_id = :closure_id
WHERE DATE(opened_at) = :date
AND subsidiary_id = :subsidiary_id
AND status = 'closed'
AND active = 1
AND (daily_closure_id IS NULL OR daily_closure_id = 0)
```

### 11. Verificar cierre existente (ya existe)

```sql
-- Ya implementada en getDailyClosureByDate()
SELECT dc.*, u.fullname AS closed_by_name
FROM daily_closure dc
LEFT JOIN fayxzvov_alpha.usr_users u ON u.id = dc.employee_id
WHERE DATE(dc.created_at) = :date
AND dc.subsidiary_id = :subsidiary_id
AND dc.active = 1
LIMIT 1
```

---

## Mensajes del Sistema

### Validaciones

| Escenario | Titulo | Mensaje | Icono | Accion |
|-----------|--------|---------|-------|--------|
| Turnos abiertos pendientes | "Turnos sin cerrar" | "Existen {N} turno(s) abierto(s) que deben cerrarse antes de realizar el cierre del dia." | warning | Listar turnos con boton para cerrarlos |
| Ya existe cierre | "Dia ya cerrado" | "El cierre del dia ya fue realizado por {nombre} el {fecha} a las {hora}." | info | Mostrar opcion de ver resumen |
| Pedidos sin turno | "Pedidos sin asignar" | "{N} pedido(s) no estan vinculados a ningun turno. Se incluiran en el cierre diario." | warning | Continuar o cancelar |
| Sin turnos en el dia | "Sin actividad" | "No se encontraron turnos cerrados para esta fecha. No hay datos para cerrar." | info | Solo cerrar dialogo |

### Confirmacion

| Escenario | Titulo | Mensaje | Botones |
|-----------|--------|---------|---------|
| Confirmar cierre | "Confirmar Cierre del Dia" | "Se consolidaran {N} turno(s) con {M} pedidos por un total de {$TOTAL}. Esta accion bloqueara la creacion de nuevos pedidos para hoy en esta sucursal." | [Confirmar Cierre] [Cancelar] |

### Resultados

| Escenario | Titulo | Mensaje | Icono |
|-----------|--------|---------|-------|
| Exito | "Cierre del dia completado" | "Se registro el cierre diario con {N} turnos y {M} pedidos. Total del dia: {$TOTAL}" | success |
| Error | "Error en el cierre" | "{mensaje del backend}" | error |

### Alerta post-cierre (en pantalla principal)

```html
<div id="dailyClosureAlert" class="bg-yellow-900/50 border border-yellow-600 text-yellow-200 px-4 py-2 rounded-lg mb-3 flex items-center gap-2">
    <i class="icon-lock text-yellow-400"></i>
    <span>
        <strong>Cierre del dia realizado.</strong>
        No se pueden crear nuevos pedidos para hoy.
        <br><small class="text-yellow-400">Cerrado por: {nombre}</small>
    </span>
</div>
```

---

## Ubicacion del Boton en la UI

### Opcion recomendada: Dentro del modal existente

Agregar un boton **"Cerrar Dia"** en el sidebar del modal `printDailyClose()`, debajo de "Imprimir Ticket":

```html
<button id="btnDailyClose"
    class="w-full py-2.5 rounded-lg text-sm font-semibold bg-red-600 hover:bg-red-700 text-white flex items-center justify-center gap-2"
    onclick="app.executeDailyClose()">
    <i class="icon-lock"></i> Cerrar Dia
</button>
```

### Condiciones de habilitacion:

- **Habilitado**: Todos los turnos del dia estan cerrados Y no existe cierre previo
- **Deshabilitado**: Hay turnos abiertos O ya existe cierre diario

---

## Ticket de Cierre Diario (Formato)

```
================================
        [LOGO SUCURSAL]
     NOMBRE DE LA SUCURSAL
    PEDIDOS DE PASTELERIA
      CIERRE DIARIO
================================
Fecha:        DD/MM/YYYY
Cerrado por:  [Nombre Empleado]
Hora cierre:  HH:MM AM/PM
Sucursal:     [Nombre]
================================

RESUMEN DE TURNOS
--------------------------------
Turno 1: [Nombre] HH:MM - HH:MM
  Ventas: $X,XXX.XX (N pedidos)

Turno 2: [Nombre] HH:MM - HH:MM
  Ventas: $X,XXX.XX (N pedidos)

================================

CONSOLIDADO DEL DIA
--------------------------------
EFECTIVO:        $X,XXX.XX
TARJETA:         $X,XXX.XX
TRANSFERENCIA:   $X,XXX.XX
--------------------------------
TOTAL CAJA:      $XX,XXX.XX

================================

NUMERO DE PEDIDOS:    XX
COTIZACIONES:         XX
CANCELADOS:           XX

================================
    GRACIAS POR SU PREFERENCIA
            Huubie
   Generado: DD/MM/YYYY HH:MM:SS
================================
```

---

## Archivos a Modificar

| Archivo | Cambios |
|---------|---------|
| `src/js/app.js` | Agregar `executeDailyClose()`, `getDailyClosePreview()`, `ticketDailyClose()`, boton en `printDailyClose()` |
| `ctrl/ctrl-pedidos.php` | Implementar/completar `closeDailyShift`, agregar `getDailyClosePreview` |
| `mdl/mdl-pedidos.php` | Agregar queries consolidadas: `getDailyConsolidatedMetrics()`, `getOpenShiftsByDate()`, `getOrphanOrders()`, `linkShiftsToClosure()` |
