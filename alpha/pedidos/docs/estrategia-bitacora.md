# Estrategia de bitácora — alpha/pedidos

**Fecha:** 15/07/2026 · **Motivación:** caso P774-22 (pedido editado el 13/07 sin dejar rastro; ver `fix-774-cortes.md`).

---

## 1. Qué ya existe (patrón CoffeeSoft)

La bitácora en CoffeeSoft **no es una tabla global**: es una tabla `*_histories` por entidad, escrita desde el `ctrl` con un helper, y leída con JOIN a `usr_users`. El patrón ya vive en Huubie:

| Tabla | BD | Usada por |
|---|---|---|
| `order_histories` | fayxzvov_reginas | app/pedidos y **alpha/pedidos** (365 filas, activa) |
| `evt_histories` | fayxzvov_alpha / reginas | alpha/eventos (`addHistories` en 4 mdl) |
| `reservation_histories` | fayxzvov_reginas | alpha/reservaciones |
| `*_bitacora` (usuario, finanzas, turno, venta…) | rfwsmqex_* | ERP-GV, mismo concepto a mayor escala |

**Esquema de `order_histories`** (no requiere cambios):

```
id · title varchar(50) · action text · date_action datetime
comment text · type varchar(255) · order_id FK · usr_users_id FK
```

**El patrón de escritura** (ctrl-pedidos.php:1374, mismo en eventos):

```php
function logHistory($message, $type = 'general', $title = 'Registro de actividad') {
    return $this->addHistories($this->util->sql([
        'title'        => $title,
        'order_id'     => $_POST['id'],
        'comment'      => $message,
        'action'       => $message,
        'date_action'  => date('Y-m-d H:i:s'),
        'type'         => $type,
        'usr_users_id' => $_SESSION['USR'] ?? 1,
    ]));
}
```

**El patrón de lectura** (mdl-pedidos.php:406): `getHistories` con `LEFT JOIN fayxzvov_alpha.usr_users` ordenado por `date_action DESC`.

## 2. Cobertura actual vs huecos

Hoy solo se registra lo que pasa por **ctrl-pedidos.php**:

| Operación | Registra | Evidencia |
|---|---|---|
| Pago (modal historial, calendario) | ✅ `payment` | "Se registró un pago de $X" |
| Eliminar pago | ✅ `payment` / Eliminar | 734 |
| Descuentos | ✅ `discount` | última 16/04 |
| **Guardar/confirmar en el editor (catálogo)** | ❌ | **el hueco del 774** |
| Crear pedido | ❌ | — |
| Editar productos del pedido | ❌ | — |
| Cambio de estado de entrega | ❌ | app.js y calendario |
| Cancelación de pedido | ❌ | — |
| Reapertura de cierre / recalc de turno | ❌ | otra entidad (fase 3) |

El caso 774 lo demuestra: su bitácora tiene **una sola entrada** (el pago del 14/07); la edición del 13/07 que pisó `date_creation` no dejó nada, porque `ctrl-pedidos-catalogo.php` no llama a `logHistory` en ninguna función.

## 3. Estrategia

### Fase 1 — Cerrar el hueco del editor (catálogo) — prioridad alta

`ctrl` del catálogo ya extiende `MPedidos`, así que `addHistories()` **ya está heredado**; solo falta el helper y las llamadas.

1. **Mover la construcción del registro al modelo** (`mdl-pedidos.php`), con `order_id` explícito para no depender de `$_POST['id']`:

```php
// mdl-pedidos.php — compartido por ctrl-pedidos y ctrl-pedidos-catalogo
function logOrderHistory($orderId, $message, $type = 'general', $title = 'Registro de actividad') {
    return $this->addHistories($this->util->sql([
        'title'        => $title,
        'order_id'     => $orderId,
        'comment'      => $message,
        'action'       => $message,
        'date_action'  => date('Y-m-d H:i:s'),
        'type'         => $type,
        'usr_users_id' => $_SESSION['USR'] ?? ($_SESSION['ID'] ?? 1),
    ]));
}
```

   `logHistory` de ctrl-pedidos.php queda como wrapper (`return $this->logOrderHistory($_POST['id'], ...)`) para no tocar las llamadas existentes.

2. **Puntos de registro en `ctrl-pedidos-catalogo.php`:**

| Función | Cuándo | Mensaje propuesto | type |
|---|---|---|---|
| `addPayment` con `$pay > 0` | tras `addMethodPay` | "Se registró un pago de $X (Efectivo)" | `payment` |
| `addPayment` con `$pay <= 0` | tras `updateOrder` | "Pedido guardado como Pendiente sin cobro — total $X" | `edition` |
| creación de pedido | tras el insert | "Pedido creado — total $X, sucursal Y" | `creation` |
| `deleteProduct` / `deleteAllProducts` | tras el delete | "Se eliminó el producto Z ($X)" | `edition` |
| cancelación | tras el update | "Pedido cancelado — motivo" | `cancellation` |

   La fila de `addPayment` sin cobro es **exactamente la que habría delatado el caso 774**: habría quedado "Pedido guardado como Pendiente sin cobro" · 13/07 · usuario.

3. **Cambios sensibles llevan antes → después** en el mensaje. Mínimo cuando cambie: `total_pay`, `discount`, `date_order`/`time_order`. Ej.: "Total: $1,200 → $1,365".

### Fase 2 — Entregas (app.js + calendario)

- `updateDeliveryStatus` en **ctrl-pedidos.php**: ya tiene el pedido cargado (`getOrderID`); registrar "Entrega: No entregado → Entregado" con type `delivery`.
- `updateDeliveryStatus` en **ctrl-calendario.php**: su mdl no extiende MPedidos → duplicar `addHistories` en `mdl-calendario.php` (así se hace en eventos: 4 mdl tienen su copia; es el patrón CoffeeSoft, no un smell).

### Fase 3 — Cierres y turnos (entidad aparte, futuro)

Reapertura de cierre (`statusCierre`) y recálculo de turno (`recalcShift`) no son eventos "de un pedido". Siguiendo el patrón *una tabla `_histories` por entidad*:

```sql
CREATE TABLE fayxzvov_reginas.closure_histories (
  id INT AUTO_INCREMENT PRIMARY KEY,
  title VARCHAR(50), action TEXT, date_action DATETIME,
  comment TEXT, type VARCHAR(255),
  daily_closure_id INT NULL, cash_shift_id INT NULL,
  usr_users_id INT NULL,
  KEY idx_closure (daily_closure_id), KEY idx_shift (cash_shift_id)
);
```

Candidatos: reapertura (ya guarda motivo en `daily_closure`, pero sin historial), `recalcShift` (hoy no deja ningún rastro), creación del cierre.

## 4. Convenciones

- **Types canónicos:** `creation`, `edition`, `payment`, `discount`, `delivery`, `cancellation`, `comment`. (Los existentes `payment`/`discount`/`comment` se conservan tal cual.)
- La bitácora se escribe **solo en el ctrl**, siempre **después** del `_CUD` exitoso.
- **Nunca bloquea:** el resultado de `addHistories` no condiciona el `status` de la respuesta; si el log falla, la operación ya quedó hecha.
- Mensaje en español legible (como hoy), montos con `evaluar()`; detalle técnico extra va en `comment` si difiere de `action`.
- `usr_users_id` siempre de sesión — es el "quién" que le faltó al caso 774.

## 5. Consulta (UI)

- Reusar `getHistories` (mdl-pedidos.php:406). Exponer pestaña/acordeón **"Historial"** en el modal de detalle del pedido en alpha/pedidos (app.js) y en el detalle del calendario — timeline simple, solo lectura (app/pedidos ya tiene este render como referencia: `addHistory` en app/pedidos/src/js/app.js:2126).
- Roles: todos ven el historial del pedido que pueden abrir; no requiere permisos nuevos.

## 6. Fuera de alcance

- Triggers de MySQL o snapshots columna-a-columna (sobredimensionado para el volumen actual: 365 filas en 8 meses).
- `updated_at`/`updated_by` en `order`: compatible y complementario, pero la bitácora da más contexto (qué, quién, cuándo y por qué) con el mismo esfuerzo.
