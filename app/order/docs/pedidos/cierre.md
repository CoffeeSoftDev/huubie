# Sistema de Turnos y Cierre de Caja

## Resumen General

El sistema de pedidos maneja un flujo de **turnos de caja** (shifts) que controlan cuándo se pueden crear pedidos y cómo se agrupan las ventas para su cierre. Sin un turno abierto, no se pueden crear pedidos nuevos.

---

## Variables Globales Clave

```js
let dailyClosure = { is_closed: false };   // Estado del cierre diario
let openShift    = { has_open_shift: false }; // Si hay turno activo
```

Ambas se obtienen del backend en la llamada `init` al cargar la app:

```js
dailyClosure = req.daily_closure || { is_closed: false };
openShift    = req.open_shift   || { has_open_shift: false };
```

---

## Flujo Completo

### 1. Inicialización (al cargar la app)

```
Usuario entra a pedidos3/index.php
        │
        ▼
  init → API opc:"init"
        │
        ▼
  Se obtienen: dailyClosure, openShift, categories, clients, etc.
        │
        ▼
  app.render() → layout + filterBar + ls (listar pedidos)
```

### 2. Crear Nuevo Pedido → Validaciones Previas

Cuando el usuario presiona **"Nuevo Pedido"**, se ejecuta `showTypePedido()`:

```
showTypePedido()
    │
    ├── ¿dailyClosure.is_closed === true?
    │       → SÍ: Alert "Cierre del día realizado" → BLOQUEADO
    │
    ├── ¿openShift.has_open_shift === false?
    │       → SÍ: Alert "Sin turno abierto" → BLOQUEADO
    │
    └── Ambas OK → normal.render() (abre formulario de pedido)
```

**Conclusión**: Se necesitan **dos condiciones** para crear pedidos:
1. El día NO debe estar cerrado (`dailyClosure.is_closed === false`)
2. Debe haber un turno abierto (`openShift.has_open_shift === true`)

### 3. Abrir el Modal de "Cierre del Día"

El botón **"Cierre del día"** en el filterBar ejecuta `printDailyClose()`:

```
printDailyClose()
    │
    ▼
  Abre modal bootbox con:
    ├── Sidebar izquierdo:
    │     ├── Select de sucursal (solo si rol == 1 / admin)
    │     ├── Selector de fecha (datepicker)
    │     ├── Toggle modo reporte: Detallado / Resumido
    │     ├── Select de turnos (#shiftSelector)
    │     ├── Botón "Abrir Turno"
    │     ├── Botón "Cerrar Caja" (disabled por defecto)
    │     └── Botón "Imprimir Ticket" (disabled por defecto)
    │
    └── Panel derecho:
          └── Vista previa del ticket (#ticketContainer)
```

Después de renderizar el modal, llama a `loadShifts()` para cargar los turnos existentes.

---

## Operaciones Principales

### 4. Cargar Turnos — `loadShifts()`

```
loadShifts()
    │
    ▼
  API opc:"getShiftsByDate" → { date, subsidiaries_id }
    │
    ▼
  Respuesta: shifts[] → cada uno tiene { id, opened_at, status: 'open'|'closed' }
    │
    ├── Llena el <select id="shiftSelector"> con los turnos
    │     Formato: "YYYY-MM-DD hh:mm A [ABIERTO]"
    │
    ├── ¿Hay algún turno con status === 'open'?
    │     → SÍ: Deshabilita botón "Abrir Turno" (solo 1 turno abierto a la vez)
    │     → NO:  Habilita botón "Abrir Turno"
    │
    └── ¿Hay turnos?
          → SÍ: Selecciona el primero y llama viewShiftPreview()
          → NO: Muestra "No hay turnos para esta fecha"
```

### 5. Abrir Turno — `openShift()`

```
openShift()
    │
    ▼
  SweetAlert pide:
    ├── Nombre del turno (opcional) → Ej: "Matutino", "Vespertino"
    └── Fondo de caja inicial ($) → Monto numérico
    │
    ▼
  API opc:"openShift" → { shift_name, opening_amount, subsidiaries_id }
    │
    ├── status 200:
    │     → Alert "Turno abierto"
    │     → loadShifts() (recarga lista)
    │     → openShift = { has_open_shift: true, shift_id: response.shift_id }
    │
    └── Error:
          → Alert con mensaje de error
```

**Regla importante**: Solo puede haber **1 turno abierto** a la vez por sucursal. Si ya hay uno abierto, el botón "Abrir Turno" se deshabilita.

### 6. Ver Preview de Turno — `viewShiftPreview()`

```
viewShiftPreview()
    │
    ▼
  Lee shiftId del <select>
    │
    ▼
  API opc:"getShiftMetrics" → { shift_id }
    │ Respuesta: { data: métricas, shift: info_turno, subsidiary_name, logo }
    │
    ├── Si modo === 'detailed':
    │     API opc:"getShiftOrders" → { shift_id }
    │     Respuesta: { orders: [...] }
    │
    ▼
  ticketShiftClose() → Renderiza ticket HTML en #ticketContainer
    │
    ├── Habilita botón "Imprimir Ticket"
    │
    └── ¿Turno status === 'open'?
          → SÍ: Habilita botón "Cerrar Caja"
          → NO: Deshabilita botón "Cerrar Caja"
```

### 7. Cerrar Caja (Cerrar Turno) — `closeShift()`

```
closeShift()
    │
    ▼
  API opc:"getShiftOrders" → Obtiene conteo de pedidos del turno
    │
    ▼
  SweetAlert confirmación:
    "Se cerrarán X tickets de venta con la información actual"
    │
    ├── Confirma:
    │     API opc:"closeShift" → { shift_id }
    │       │
    │       ├── status 200:
    │       │     → Alert "Turno cerrado"
    │       │     → loadShifts() (recarga)
    │       │     → ls() (recarga tabla de pedidos)
    │       │     → openShift = { has_open_shift: false }
    │       │
    │       └── Error → Alert error
    │
    └── Cancela → No hace nada
```

### 8. Imprimir Ticket — `printDailyCloseTicket()`

Abre una ventana nueva (`window.open`) con el contenido HTML del ticket formateado para impresión con estilos inline tipo POS (320px de ancho, fuente monospace).

---

## Ticket de Cierre — Contenido (`ticketShiftClose`)

El ticket muestra:

| Sección | Datos |
|---------|-------|
| **Header** | Logo, nombre sucursal, "PEDIDOS DE PASTELERÍA", "Cierre Operativo", badge CERRADO/EN CURSO |
| **Info** | Fecha, Turno (nombre o hora), Sucursal |
| **Desglose** (modo detallado) | Lista de ventas: Folio #ID → $total |
| **Formas de Pago** | Efectivo, Tarjeta, Transferencia |
| **Total Caja** | Suma de las 3 formas de pago |
| **Contadores** | Número de pedidos, Cotizaciones, Cancelados |
| **Footer** | "GRACIAS POR SU PREFERENCIA", marca Huubie, timestamp |

---

## Modos de Reporte — `toggleReportMode(mode)`

- **Detallado**: Incluye desglose individual de cada venta (folio + monto)
- **Resumido**: Solo muestra totales por forma de pago y contadores

Se alterna con los botones en el sidebar y recarga el preview llamando `viewShiftPreview()`.

---

## Diagrama de Estados del Turno

```
  [No existe turno]
        │
        │ openShift()
        ▼
  [Turno ABIERTO]  ← Se pueden crear pedidos
        │              Los pedidos se asocian a este turno
        │
        │ closeShift()
        ▼
  [Turno CERRADO]  ← Ya NO se pueden crear pedidos (a menos que se abra otro turno)
                      Se genera ticket de cierre con métricas
```

---

## Endpoints del Backend (opc)

| opc | Descripción | Parámetros |
|-----|-------------|------------|
| `init` | Carga inicial de la app | — |
| `checkDailyClosure` | Verifica si el día está cerrado | `subsidiaries_id` |
| `getShiftsByDate` | Lista turnos de una fecha | `date`, `subsidiaries_id` |
| `openShift` | Abre un nuevo turno | `shift_name`, `opening_amount`, `subsidiaries_id` |
| `closeShift` | Cierra un turno activo | `shift_id` |
| `getShiftMetrics` | Métricas de un turno (ventas, totales) | `shift_id` |
| `getShiftOrders` | Pedidos asociados a un turno | `shift_id` |

---

## Relación con dailyClosure

`dailyClosure` es un estado independiente que se verifica con `checkDailyClosure`. Es un nivel de bloqueo superior al turno:

```
¿Puede crear pedidos?
    │
    ├── dailyClosure.is_closed? → NO puede (día cerrado)
    │
    └── openShift.has_open_shift? → NO puede (sin turno)
    │
    └── Ambas OK → SÍ puede crear pedidos
```

Cuando `dailyClosure.is_closed === true`:
- El botón "Nuevo Pedido" se deshabilita visualmente
- Se muestra una alerta amarilla: "Cierre del día realizado"
- Si intenta crear pedido, recibe alert de bloqueo
