# 03 — Pagos/abonos, descuentos y entrega

Las tres mutaciones que ocurren sobre un pedido ya creado y que impactan el dinero del corte.

---

## 3.1 Pagos / abonos

**Propósito.** Registrar abonos parciales o el pago total de un pedido y actualizar su estado.

**Actores y disparador.** Cajero/admin desde el modal de pago (`historyPay`) o desde "Terminar"
en el POS de catálogo.

### Hecho clave: hay DOS `addPayment` distintos

| Método | Archivo | Cuándo se usa | Guarda `subsidiaries_id` en el pago |
|---|---|---|---|
| `addPayment` (pagos) | `ctrl-pedidos.php:700` | modal "Registrar pago"/abonos | **Sí** (`payment_subsidiaries_id` = cobro cruzado, o `SUB`) |
| `addPayment` (terminar) | `ctrl-pedidos-catalogo.php:424` | botón "Terminar" al armar/editar | **No** (inserta el pago sin `subsidiaries_id`) |

Ambos insertan en `order_payments` con `type=2` y `date_pay=NOW`, actualizan `order.total_pay`,
`order.type_id` y `order.status`, y escriben bitácora.

**Cálculo del estado alcanzado (`type_id`/`status`).**
- `pay <= 0` → 1 (Cotización) o 2 (Pendiente) según `target_status`.
- `pay == saldo` → 3 (Pagado).
- resto → 2 (Abono parcial).

**Fórmula de saldo** (`initHistoryPay`): `restante = total_pay − discount − Σ pagos`.

**⚠ Nota crítica.**
- **La divergencia entre los dos `addPayment` es el origen del descuadre de cortes.** El de
  catálogo **no** graba `subsidiaries_id` en `order_payments`; el de pagos sí. El corte del día
  (`getConsolidatedPayments`) reparte el efectivo/tarjeta/transferencia leyendo la sucursal del
  pago. Un pago sin `subsidiaries_id` cae de forma inconsistente respecto a uno con sucursal →
  totales por método que no cuadran (documentado en `docs/audit-pedidos-movidos.md` y
  `docs/cobro-cruzado-sucursales.md`). **Unificar en un solo método de cobro.**
- **`pay == $saldo` es comparación de igualdad exacta sobre `DOUBLE`.** Un centavo de redondeo hace
  que un pago "completo" se registre como abono parcial (queda Pendiente para siempre) o al revés.
  Debe compararse con tolerancia (`abs(pay - saldo) < 0.005`) o trabajar en centavos enteros.
- **`type_id` y `status` guardan el MISMO valor** en el mismo UPDATE. Una de las dos columnas es
  redundante; mantener ambas invita a que se desincronicen (una consulta filtra por `status`, otra
  por `type_id`). Elegir una como fuente de verdad.
- **`date_pay = NOW` fija el pago en el día en que se registra**, no en el del pedido. Correcto para
  caja, pero combinado con el histórico bug de pisar `date_creation` produjo pedidos "mudados" de
  corte (45 casos en la auditoría del 15/07/2026). El pisado de `date_creation` **ya se quitó** de
  ambos `addPayment`; queda pendiente **corregir los datos históricos** y los 8 cierres descuadrados.
- **`initHistoryPay` cae a `SUB = 4` por defecto** (`$_SESSION['SUB'] ?? 4`): un número mágico de
  sucursal como fallback. Si la sesión pierde `SUB`, el folio del ticket sale con sucursal 4.
- `deletePay` borra el pago (`deletePayment`) y registra bitácora, pero **no recalcula ni
  revalida el estado** del pedido: si se borra el pago que lo dejó Pagado, el pedido puede quedar
  en estado 3 con saldo pendiente. Revisar recomputo de `status` tras borrar un pago.

---

## 3.2 Descuentos

**Propósito.** Aplicar/editar/quitar un descuento a nivel pedido (`order.discount` + `info_discount`).

**Operaciones.**
| opc | Autorización | Valida monto |
|---|---|---|
| `addDiscount` | `canWriteOrder` | **No** (validación comentada) |
| `editDiscount` | `ROLID == 1` (solo admin) | Sí (`0 ≤ desc ≤ total`) |
| `deleteDiscount` | `canWriteOrder` | — |
| `getDiscount` | — | — |

**Reglas de negocio.** El neto es `total_pay − discount`; se refleja en el listado (total tachado)
y en el saldo. Toda operación de descuento deja bitácora (`discount`).

**⚠ Nota crítica.**
- **`addDiscount` tiene la validación "descuento ≤ total" COMENTADA** (líneas 1957-1962). Hoy se
  puede aplicar un descuento **mayor al total** → neto negativo → saldo negativo → el pedido puede
  marcarse Pagado con dinero "de más". `editDiscount` sí valida, pero `addDiscount` (la vía normal)
  no. **Reactivar la validación.**
- **Autorización incoherente entre las tres operaciones:** crear y borrar usan `canWriteOrder`
  (cualquier rol de su sucursal), pero **editar** exige admin (`ROLID==1`). Un cajero puede
  *crear* un descuento arbitrario pero no *corregirlo*. Además el rol 7 (Restringido = "sin
  descuento") **no está bloqueado en backend** en `addDiscount`; el candado es solo de front.
  Revisar y unificar la política.
- Tres respuestas con formas distintas (`data` a veces null, a veces objeto) para operaciones
  hermanas. Normalizar el contrato.

---

## 3.3 Entrega (`updateDeliveryStatus`)

**Propósito.** Marcar el avance físico del pedido: no entregado / entregado / para producir.

**Flujo.** `handleDeliveryClick` (app.js) manda `is_delivered` (0/1/2). Backend valida
`canWriteOrder`, actualiza `order.is_delivered` y registra bitácora (`delivery`) nombrando el
estado alcanzado.

**Reglas de negocio.**
- `is_delivered`: **0** = no entregado · **1** = entregado · **2** = para producir.

**⚠ Nota crítica.**
- **`is_delivered` es un semáforo de 3 estados guardado como si fuera booleano.** El nombre
  (`is_delivered`) miente: "2 = para producir" no es un estado de *entrega* sino de *producción*.
  Mezcla dos dimensiones (producción vs entrega) en una columna. Debería ser un `status` de
  producción separado del flag de entrega, o al menos una columna con nombre honesto
  (`fulfillment_status`) y su catálogo.
- Este es de los **pocos métodos bien blindados** (valida parámetros y `canWriteOrder`): sirve de
  patrón para arreglar los huecos de autorización del apartado 02.

---

## 3.4 Cobro cruzado entre sucursales

**Propósito.** Permitir cobrar en una sucursal un pedido que pertenece a otra.

**Flujo.** El modal de pago (para admin) ofrece "Sucursal de cobro" (`payment_subsidiaries_id`).
`addPayment` (pagos) guarda ese `subsidiaries_id` en `order_payments` y anota en bitácora
`crossPaymentNote` ("cobrado en X, pedido de Y").

**⚠ Nota crítica.**
- **El cobro cruzado solo funciona por la vía `ctrl-pedidos.php::addPayment`.** El "Terminar" del
  catálogo no lleva sucursal de cobro, así que un pago hecho ahí siempre se atribuye implícitamente
  y no puede ser cruzado. Comportamiento inconsistente según por dónde se cobre.
- El dinero de un cobro cruzado entra al corte de la sucursal **de cobro**, pero el pedido "vive"
  en la sucursal **dueña**: el total del corte por sucursal deja de cuadrar contra la suma de
  pedidos de esa sucursal (descuadre conocido: total vs detalle). Es una **regla de negocio sin
  cerrar**, no solo un bug: definir a qué corte pertenece el dinero de un cobro cruzado y reflejarlo
  igual en corte de turno y corte Z. Ver 05 y `docs/cobro-cruzado-sucursales.md`.
