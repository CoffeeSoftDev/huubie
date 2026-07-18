# 08 — Deuda técnica consolidada y priorizada

Resumen accionable de todas las notas críticas del spec, ordenado por impacto. Cada ítem enlaza al
apartado donde está el detalle.

Prioridades: **P0** = dinero/contabilidad (cuadre de cortes) · **P1** = seguridad/autorización ·
**P2** = arquitectura/mantenibilidad · **P3** = limpieza.

---

## P0 — Dinero y cuadre de cortes (lo más urgente)

Estos ítems son **un solo problema de fondo**: no existe una definición única y compartida de
"venta", "cobro" y "saldo". Mientras eso siga abierto, cada corte/reporte puede dar un número
distinto.

| # | Problema | Dónde | Acción propuesta |
|---|---|---|---|
| P0-1 | **Dos `addPayment`** escriben `order_payments` distinto (con/sin `subsidiaries_id`) | [03](03-pagos-descuentos-entrega.md#31-pagos--abonos) | Unificar en **un solo** método de cobro que siempre grabe sucursal de cobro |
| P0-2 | **`total_sales` (venta) ≠ `cash+card+transfer` (cobro)** presentados como lo mismo | [04](04-turno-de-caja.md#42-corte-de-turno-opc-closeshift), [05](05-cierre-del-dia.md) | Separar y renombrar: `total_ordered` vs `total_collected`; nunca mezclarlos |
| P0-3 | **Doble vinculación pedido↔turno** (`cash_shift_id` vs ventana de tiempo) | [04](04-turno-de-caja.md#42-corte-de-turno-opc-closeshift) | Una sola fuente (`cash_shift_id` de creación); huérfanos = excepción explícita |
| P0-4 | **Snapshot congelado (`daily_closure`) vs recálculo en vivo (`getCierre`)**: dos verdades | [05](05-cierre-del-dia.md#52-ejecutar-el-cierre-opc-addcierre) | Decidir: snapshot inmutable **y** prohibir editar pagos de días cerrados |
| P0-5 | **Pagos editables/borrables después de cerrar el día**, sin candado | [05](05-cierre-del-dia.md) | Bloquear mutaciones sobre pedidos de día/turno cerrado; ajustes como movimiento nuevo |
| P0-6 | **`recalcShift` no propaga al `daily_closure`** (arreglo a medias, manual) | [05](05-cierre-del-dia.md#57-recálculo-de-turno-opc-recalcshift) | Añadir `recalcClosure` o que `recalcShift` recalcule el cierre asociado |
| P0-7 | **`addDiscount` sin validar `descuento ≤ total`** (validación comentada) → saldo negativo | [03](03-pagos-descuentos-entrega.md#32-descuentos) | Reactivar la validación; misma regla que `editDiscount` |
| P0-8 | **`pay == $saldo` en `DOUBLE`** (igualdad exacta) decide "pago completo" | [03](03-pagos-descuentos-entrega.md#31-pagos--abonos) | Comparar con tolerancia o trabajar en centavos enteros |
| P0-9 | **`moveFolio` mueve dinero entre cortes sin candado** (rol/turno/cierre/bitácora) | [07](07-administracion.md#72-administración-de-folios-admin-folios) | Solo admin, bloquear si el pedido está en día/turno cerrado, dejar bitácora |
| P0-10 | **Pedidos huérfanos no bloquean el cierre** (advertencia, no bloqueante) | [05](05-cierre-del-dia.md#51-pre-cierre--checklist-opc-showcierre) | Bloquear cierre o forzar asignación de turno antes de cerrar |
| P0-11 | **`opening_amount` (fondo) se captura pero no cuadra la caja** | [04](04-turno-de-caja.md#41-apertura-de-turno-opc-openshift) | Definir si el corte hace arqueo `fondo + efectivo esperado vs contado` |
| P0-12 | **Datos históricos:** 45 pedidos "movidos" + 8 cierres descuadrados (auditoría 15/07/2026) | [`../audit-pedidos-movidos.md`](../audit-pedidos-movidos.md) | Restaurar `date_creation` a la fecha del turno y recalcular los cierres afectados |

> **Deuda de concurrencia (relacionada):** `getMaxOrder`/`getMaxCashShift`/`getMaxClosureId` tras
> el INSERT son condiciones de carrera ([02](02-captura-de-pedido.md), [04](04-turno-de-caja.md),
> [05](05-cierre-del-dia.md)). Usar `lastInsertId`. Y el candado "un turno abierto por sucursal" no
> lo garantiza la BD: falta índice único/transacción.

---

## P1 — Seguridad y autorización

| # | Problema | Dónde | Acción |
|---|---|---|---|
| P1-1 | **`canWriteOrder` no se aplica** en `editOrder` ni en NINGÚN método del catálogo/personalizado | [02](02-captura-de-pedido.md#23-edición-de-pedido-opc-editorder) | Aplicar `canWriteOrder` en toda mutación de pedido/producto |
| P1-2 | **Mass-assignment** por `util->sql($_POST)` en `cancelOrder`, `addProduct`, `addHistory` (y el `price` viaja en el POST) | [02](02-captura-de-pedido.md), [07](07-administracion.md#74-bitácora--historial-del-pedido) | Whitelistar columnas; tomar `price` del catálogo en backend |
| P1-3 | **Subida de archivos sin validación** (extensión/MIME/tamaño), `mkdir 0777`, carpeta web | [02](02-captura-de-pedido.md#25-pos-de-catálogo-productos-del-pedido) | Whitelist jpg/png/webp, límite de tamaño, desactivar ejecución en la carpeta |
| P1-4 | **CRUD de catálogo sin verificación de rol admin** | [07](07-administracion.md#71-catálogo-adminphp--ctrl-adminphp--adminjs) | Verificar rol en `ctrl-admin.php` |
| P1-5 | **CORS `Access-Control-Allow-Origin: *`** en admin-folios y calendario | [07](07-administracion.md) | Cerrar a same-origin |
| P1-6 | **Despacho dinámico sin allow-list** (`$obj->{$_POST['opc']}()`): cualquier método público es invocable | [README](README.md#arquitectura-en-una-pantalla) | Allow-list de `opc` permitidos por controlador |
| P1-7 | **Rol 7 (sin descuento) no bloqueado en backend** en `addDiscount` | [03](03-pagos-descuentos-entrega.md#32-descuentos) | Validar el rol en backend, no solo en front |
| P1-8 | **Bitácora manual sin autor** (`usr_users_id` comentado) | [07](07-administracion.md#74-bitácora--historial-del-pedido) | Reactivar la atribución de usuario |

---

## P2 — Arquitectura y mantenibilidad

| # | Problema | Dónde | Acción |
|---|---|---|---|
| P2-1 | **HTML/estilos armados en los controladores PHP** (`listOrders`, `lsCorteCaja`, `lsFolios`, helpers admin) | [01](01-arranque-sesion-listado.md#14-listado-de-pedidos-opc-listorders), [05](05-cierre-del-dia.md), [07](07-administracion.md) | Mover el render al front (`createTable`); el ctrl devuelve datos |
| P2-2 | **Check de rol `[1,2,3,6,7]` duplicado ~6 veces** (y variantes `==1`) | [01](01-arranque-sesion-listado.md#12-sesión-roles-y-multi-tenant), transversal | Helper único `canUseBranchSelector()` en back y front |
| P2-3 | **`updateTotalOrder` triplicado** (catálogo, personalizado, pedidos) | [02](02-captura-de-pedido.md#26-pastel-personalizado-ctrl-pedidos-personalizadophp) | Unificar en el modelo |
| P2-4 | **`updateDeliveryStatus` duplicado** (pedidos vs calendario, copia inferior) | [07](07-administracion.md#73-calendario-calendario) | Una sola implementación (la que valida y registra) |
| P2-5 | **`getCierre` de ~470 líneas / ~15 queries**, ilegible | [05](05-cierre-del-dia.md#54-visor-del-corte-z-opc-getcierre) | Descomponer y documentar el modelo de atribución de dinero |
| P2-6 | **Lógica de dinero re-implementada** en dashboard, reportes y cada corte | [06](06-dashboard-reportes.md) | Servicio único de ventas/cobros que todos consuman |
| P2-7 | **`status` y `type_id` redundantes** (mismo valor) | [03](03-pagos-descuentos-entrega.md#31-pagos--abonos), [README](README.md#glosario-fuente-única-de-verdad-para-todo-el-spec) | Elegir una columna como fuente de verdad |
| P2-8 | **`is_delivered` mezcla producción y entrega** en una columna | [03](03-pagos-descuentos-entrega.md#33-entrega-updatedeliverystatus) | Separar estado de producción del flag de entrega |
| P2-9 | **N+1 de pagos en `listOrders`** (una query por fila) | [01](01-arranque-sesion-listado.md#14-listado-de-pedidos-opc-listorders) | Resolver con JOIN/agregado en `getOrders` |
| P2-10 | **Cliente identificado por nombre** (duplicados, pisa datos del cliente compartido) | [02](02-captura-de-pedido.md#22-alta-de-pedido-opc-addorder) | Llave natural (teléfono) + unificar alta de cliente (02/07) |
| P2-11 | **Dos definiciones de `saldo_final`** (corte Z vs corte X) con el mismo nombre | [05](05-cierre-del-dia.md#55-corte-de-caja-x-opc-showcortecaja-lscortecaja) | Renombrar (`saldo_en_cajon` vs `total_cobrado`) |
| P2-12 | **Naming engañoso:** `delivered_count` = status 3 (Pagado) reportado como "pagadas"; `venta_bruta == venta_neta` | [05](05-cierre-del-dia.md#54-visor-del-corte-z-opc-getcierre) | Corregir nombres |
| P2-13 | **Estado de turno duplicado** en 3 fuentes (global `openShift`, snapshot `subsidiaries`, navbar) | [01](01-arranque-sesion-listado.md#13-navbar-selector-de-sucursal-e-indicador-de-turno) | Una fuente derivada del backend |
| P2-14 | **Libs desde CDN** (Chart.js, Tailwind, FullCalendar): rompe offline | [06](06-dashboard-reportes.md#61-dashboard-opc-apidashboard-getdashboardmetrics) | Servir locales (como jQuery/DataTables) |
| P2-15 | **Colores de estado hardcodeados** y repetidos (back, front, calendario, cortes) | [07](07-administracion.md#73-calendario-calendario) | Centralizar la paleta de estados |
| P2-16 | **Posible visor duplicado** `order-reports.js` vs módulo `alpha/order-visor/` | [06](06-dashboard-reportes.md#63-visor-de-cierre-order-reportsjs--getcierre-showcortecaja-lscortecaja) | Confirmar el vigente; converger o retirar |

---

## P3 — Limpieza del árbol

| # | Item | Dónde |
|---|---|---|
| P3-1 | `session-reset-timer.js` marcado TEMPORAL — retirar si ya no se necesita | [01](01-arranque-sesion-listado.md), [07](07-administracion.md#75-piezas-temporales--código-muerto-en-el-árbol) |
| P3-2 | `ctrl-projects.php`/`mdl-projects.php` — tabla `projects` inexistente (código muerto) | [README](README.md), [07](07-administracion.md#75-piezas-temporales--código-muerto-en-el-árbol) |
| P3-3 | `mdl-pedidos-catalogo.php` vacío (0 líneas) | [02](02-captura-de-pedido.md#25-pos-de-catálogo-productos-del-pedido) |
| P3-4 | `calendario.zip`, `ctrl/error.log`, `calendario/error_log` versionados | [07](07-administracion.md#75-piezas-temporales--código-muerto-en-el-árbol) |
| P3-5 | `templates/pos/*.html` mockups mezclados con templates productivos | [07](07-administracion.md#75-piezas-temporales--código-muerto-en-el-árbol) |
| P3-6 | Estilos de impresión y reset de scrollbar incrustados en `index.php` | [01](01-arranque-sesion-listado.md), [02](02-captura-de-pedido.md#28-ticket-de-pastelería) |
| P3-7 | `return` con elemento sin clave en `listOrders`; contratos de respuesta inconsistentes | [01](01-arranque-sesion-listado.md#14-listado-de-pedidos-opc-listorders) |

---

## Secuencia sugerida

1. **Congelar el pasado (P0-4/P0-5):** prohibir editar pagos de días cerrados. Es el candado que
   frena que el descuadre siga creciendo.
2. **Unificar el cobro (P0-1) y separar venta vs cobro (P0-2/P0-3):** una sola vía que grabe
   sucursal, un solo criterio de vinculación. Con eso, cortes y reportes empiezan a cuadrar.
3. **Cerrar los huecos de dinero controlables:** `addDiscount` (P0-7), `moveFolio` (P0-9),
   huérfanos (P0-10), igualdad float (P0-8).
4. **Reparar datos históricos (P0-12)** una vez que el código ya no los rompe.
5. **Seguridad (P1):** `canWriteOrder` universal, mass-assignment, subida de archivos, CORS.
6. **Refactor (P2)** guiado por un **servicio único de ventas/cobros** (P2-6), y **limpieza (P3)**.

> Nota: este spec describe el estado **actual** (2026-07-17). No propone rediseño; las acciones son
> el mínimo para que "cada apartado" haga lo que su nombre dice y los cortes cuadren.
