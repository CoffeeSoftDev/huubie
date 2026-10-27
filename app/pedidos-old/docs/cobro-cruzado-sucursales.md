# Cobro cruzado entre sucursales (abono en sucursal distinta a la del pedido)

> Estado: **Opción B implementada** (Fases 1 y 2). Quedan 2 decisiones abiertas (ver abajo).
> Caso disparador: pedido **664** (folio `P664-22`), abono de **$430** cobrado en gpe pero atribuido a cuarta.
>
> **Implementado (Fase 1 — esquema + registro):**
> - Columna `order_payments.subsidiaries_id` creada; backfill a 785 pagos (sucursal del pedido) y corrección del abono #800 → gpe (4).
> - Modal de pago: selector **"Sucursal de cobro"** (admin y cajero). Default = sucursal activa: admin → filtro de la navbar (si "Todas"/0, la del pedido); cajero → su sucursal de sesión (`udn`). Ver `addPayment()` en [app.js](../src/js/app.js).
> - Registro: `addPayment()` en [ctrl-pedidos.php](../ctrl/ctrl-pedidos.php) guarda la sucursal del selector; si no llega (cajero), usa `$_SESSION['SUB']`.
>
> **Implementado (Fase 2 — reportes de cobranza):**
> - `getDailySalesMetrics` y `getShiftSalesMetrics` en [mdl-pedidos.php](../mdl/mdl-pedidos.php): el filtro de cobranza pasó de `po.subsidiaries_id` a `COALESCE(pp.subsidiaries_id, po.subsidiaries_id)`. La cobranza cuenta donde entró el dinero; la venta sigue por sucursal del pedido.
> - `getDailySalesMetrics`: el bloque de **pagos** ahora agrupa por `DATE(pp.date_pay)` (día del cobro), no por `date_creation`. Las **ventas** del mismo método siguen por `date_creation`. Así el #800 cuenta en gpe el **23‑jun** (día real del cobro).
>
> **Implementado (Fase 3 — listado del turno coherente con el total):**
> - `getShiftDetailedOrders` (grupo 2, "ABONOS DE PEDIDOS ANTERIORES") y `getShiftPrevPaymentsSummary` pasaron de `o.subsidiaries_id` a `COALESCE(op.subsidiaries_id, o.subsidiaries_id)`. El abono cruzado ahora se **lista y se cuenta en la sucursal que cobró**, igual que el total. Resuelve la antigua decisión abierta #1: se eligió "listarlo donde se cobró" (no la distinción visual de §5).

---

## 1. Síntoma

El pedido `P664-22` pertenece a la sucursal **Regina´s cuarta**, pero el último abono de **$430** se cobró físicamente en **gpe (matriz)**. En los reportes ese dinero aparece contado en **cuarta**, no en **gpe**, donde realmente entró.

Datos reales verificados en BD (`fayxzvov_reginas`):

| Concepto | Valor | Fecha | Sucursal real del cobro |
|---|---|---|---|
| Venta (`order.subsidiaries_id = 22`) | $780 | 21‑jun | cuarta |
| Abono #790 | $350 | 21‑jun | cuarta (mismo día que se creó) |
| Abono #800 | $430 | 23‑jun | **gpe / matriz** ← el que se quiere reubicar |

Catálogo de sucursales relevante:

- `22` = Regina´s cuarta
- `4` = Reginas guadalupe (gpe / matriz)

---

## 2. Causa raíz

La tabla `fayxzvov_reginas.order_payments` **no guarda en qué sucursal se cobró el pago**. Sus columnas son:

```
id · pay · date_pay · method_pay_id · order_id · type · description
```

No existe `subsidiaries_id` en el pago. El pago solo sabe a qué **pedido** pertenece (`order_id`).

### 2.1 Al registrar el pago

`addPayment()` en [ctrl-pedidos.php:536-547](../ctrl/ctrl-pedidos.php#L536-L547) inserta únicamente:

```php
$values_pay = [
    'pay'           => $pay,
    'date_pay'      => date('Y-m-d H:i:s'),
    'type'          => 2,
    'method_pay_id' => $_POST['method_pay_id'],
    'description'   => $_POST['description'],
    'order_id'      => $id,        // ← se ata al pedido, NO a la sucursal de cobro
];
```

Nunca se guarda la sucursal del cajero (`$_SESSION['SUB']` ni el filtro activo).

### 2.2 Al reportar la cobranza

El reporte de cobranza diaria [mdl-pedidos.php:1183-1198](../mdl/mdl-pedidos.php#L1183-L1198) une el pago con su pedido y filtra por la sucursal **del pedido**:

```sql
FROM order_payments pp
INNER JOIN `order` po ON pp.order_id = po.id
WHERE DATE_FORMAT(date_creation, '%Y-%m-%d') = ?
  AND po.subsidiaries_id = ?   -- ← sucursal del PEDIDO (cuarta), no del pago
```

Resultado: el "TOTAL COBRADO" de gpe **nunca verá** ese abono, porque al unir el pago con su pedido, el pedido dice "cuarta (22)".

---

## 3. Trampa adicional: la fecha del reporte

Hay un segundo detalle importante para cualquier parche. El cierre **diario** agrupa los pagos por **la fecha de creación del pedido**, no por la fecha del abono:

- [mdl-pedidos.php:1189](../mdl/mdl-pedidos.php#L1189) → `WHERE DATE_FORMAT(date_creation, '%Y-%m-%d') = ?` (fecha del **pedido** = 21‑jun).
- El corte por **turno/caja**, en cambio, sí usa `date_pay` y ya contempla "abonos de turnos anteriores": [mdl-pedidos.php:1567-1601](../mdl/mdl-pedidos.php#L1567-L1601).

Consecuencia: dependiendo de **en qué reporte** se mire el faltante, el mismo parche se comporta distinto.

| Reporte | Agrupa pagos por | El abono del 23‑jun aparece en… |
|---|---|---|
| Cierre / corte diario | fecha de **creación del pedido** | el día **21‑jun** |
| Corte de turno / caja | fecha del **pago** (`date_pay`) | el día **23‑jun** |

---

## 4. Opciones

### Opción A — Mover el pedido completo (atajo)

```sql
UPDATE fayxzvov_reginas.`order` SET subsidiaries_id = 4 WHERE id = 664;
```

- ✅ Una línea.
- ⚠️ El folio cambia: `P664-22` → `P664-04` (el folio se arma con la sucursal en [ctrl-pedidos.php:2210-2216](../ctrl/ctrl-pedidos.php#L2210-L2216)).
- ⚠️ Mueve **toda** la venta ($780) **y el abono de $350** a gpe; se los quita a cuarta. Cuadra el efectivo de los $430 pero **descuadra ventas** en ambas sucursales.
- ⚠️ En el cierre **diario** los $430 aparecerían en el **21‑jun** (fecha del pedido), no hoy.
- Solo es correcto si el pedido **nunca debió ser de cuarta** (error de captura).

### Opción B — Que el pago lleve su propia sucursal (corrección de fondo)

1. **Esquema** — agregar la columna:
   ```sql
   ALTER TABLE fayxzvov_reginas.order_payments
     ADD COLUMN subsidiaries_id INT NULL AFTER order_id;
   ```
2. **Registro** — en `addPayment()` guardar la sucursal activa del cajero (`$_SESSION['SUB']` o el `subsidiaries_id` del filtro), no la del pedido.
3. **Reportes** — cambiar `po.subsidiaries_id` por `pp.subsidiaries_id` en las consultas de cobranza/turnos (la **venta** sigue por sucursal del pedido; la **cobranza** va donde entró el dinero).
4. **Backfill** — a los pagos viejos copiarles la sucursal del pedido como default y corregir a mano el caso real:
   ```sql
   -- default histórico
   UPDATE fayxzvov_reginas.order_payments pp
   INNER JOIN fayxzvov_reginas.`order` po ON pp.order_id = po.id
   SET pp.subsidiaries_id = po.subsidiaries_id
   WHERE pp.subsidiaries_id IS NULL;

   -- corrección del caso 664: el abono #800 se cobró en gpe (4)
   UPDATE fayxzvov_reginas.order_payments SET subsidiaries_id = 4 WHERE id = 800;
   ```

Resultado correcto del pedido 664:

```
Pedido 664 → CUARTA (folio P664-22 intacto)
  Venta  $780 ............ cuarta
  Abono  $350 (21-jun) ... cuarta
  Abono  $430 (23-jun) ... gpe   ✅
```

---

## 5. Decisión de diseño en la Opción B

Cuando el abono cuenta en gpe pero la venta en cuarta, **la cobranza y la venta de una sucursal dejan de cuadrar entre sí** (gpe cobra dinero de una venta que no es suya). Eso es correcto cuando hay cobros cruzados, pero conviene que el reporte lo distinga (p. ej. columna "cobrado de otras sucursales") para que el cierre no se vea raro. Ya existe lógica en esa dirección con los "abonos de turnos anteriores" en [mdl-pedidos.php:1567-1601](../mdl/mdl-pedidos.php#L1567-L1601).

---

## 6. Pendiente de decidir

1. **¿En qué pantalla se ve el faltante de los $430?** (cierre diario por fecha / corte de turno-caja / reporte mensual). Esto define cuál query ajustar y si el parche cuadra el día correcto.
2. **¿Parche A o corrección B?** A es rápido pero arrastra venta + folio; B es lo correcto y evita que vuelva a pasar.
3. Si se va por B, confirmar el origen de la "sucursal de cobro": sesión del cajero (`$_SESSION['SUB']`) automática vs. selector explícito en el modal de pago.

---

## 7. Archivos involucrados

| Archivo | Rol |
|---|---|
| [ctrl-pedidos.php](../ctrl/ctrl-pedidos.php) | `addPayment()` (registro del pago), `formatSucursal()` (folio) |
| [mdl-pedidos.php](../mdl/mdl-pedidos.php) | `addMethodPay()` (insert), `getDailySalesMetrics()` y métricas de turno (reportes de cobranza) |
| `fayxzvov_reginas.order_payments` | Tabla de abonos (sin columna de sucursal) |
| `fayxzvov_reginas.order` | Pedido (tiene `subsidiaries_id`) |
