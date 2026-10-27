# Análisis — Módulo POS Historial de Ventas

> Generado por Coffee Intelligence el 2026-05-17
> Alcance: `app/pos/pos-historial-ventas.php` + `ctrl/` + `mdl/` + `src/js/`

---

## Tabla de contenidos

1. [Revisión técnica](#1-revisión-técnica)
   1. [Puntos buenos](#11-puntos-buenos)
   2. [Puntos malos / oportunidades](#12-puntos-malos--oportunidades)
   3. [Modelo de datos implícito](#13-modelo-de-datos-implícito)
   4. [Top 5 fixes técnicos](#14-top-5-fixes-técnicos-priorizados)
2. [Revisión funcional](#2-revisión-funcional)
   1. [¿Qué hace el módulo?](#21-qué-hace-el-módulo)
   2. [Funcionalidades implementadas](#22-funcionalidades-implementadas)
   3. [Lo que funciona bien (UX)](#23-lo-que-funciona-bien-ux)
   4. [Funcionalidades incompletas / ausentes](#24-funcionalidades-incompletas--ausentes)
   5. [Casos de uso: cubiertos vs no](#25-casos-de-uso-reales-cubiertos-vs-no)
   6. [Top 5 mejoras funcionales](#26-top-5-mejoras-funcionales)

---

## 1. Revisión técnica

### 1.1 Puntos buenos

1. **Separación de capas limpia.** `pos-historial-ventas.php` (vista) → `ctrl/ctrl-*.php` (controlador) → `mdl/mdl-*.php` (modelo) → JS frontend. Cada archivo tiene una sola responsabilidad y `ctrl` extiende `mdl`.
2. **Queries 100% parametrizadas.** Todo `_Read`/`_Update` se invoca con placeholders `?` y arreglo `$data`. Sin SQL injection.
3. **Filtros bien diseñados.** El `WHERE` dinámico cubre 3 modos (`actual`, `dia`, `rango`) + sucursal + status, y el cortocircuito `1=0` cuando no hay turno activo evita listar todo por accidente.
4. **Doble guard de autorización.** Cancelar y reabrir piden credenciales por SweetAlert (`askAdminCreds` / `askAdminKey`) y el servidor revalida contra `usr_users` con `enabled = 1 AND usr_rols_id = 1`. El JS no decide nada.
5. **Escape XSS consistente.** Cada componente trae su `esc(...)` local y se aplica a todo input dinámico. El PHP usa `htmlspecialchars`.
6. **UX moderna.** Tres modos de periodo con campos mostrados/ocultados dinámicamente, panel lateral de detalle, KPIs con tonos semánticos, reimpresión de ticket en ventana hija, badges de estatus.
7. **Soft-delete real.** Cancelaciones marcan `status = 4` + `cancelled_at` + `cancelled_by`. Cumple db-rules §2.4.
8. **Cross-schema bien resuelto.** `subsidiaries` y `usr_users` se referencian desde `fayxzvov_alpha`, no se duplican maestros.

### 1.2 Puntos malos / oportunidades

| # | Severidad | Hallazgo | Ubicación |
|---|---|---|---|
| 1 | 🚨 Crítico | **Inyección de método arbitrario.** `echo json_encode($obj->{$_POST['opc']}())` permite invocar métodos heredados de `mdl`/`CRUD` por POST. Falta whitelist (`in_array($opc, [...])`). | `ctrl-pos-historial-ventas.php:288` |
| 2 | 🚨 Crítico | **MD5 para contraseñas admin.** Compara `u.key = ?` con `md5($key)`. MD5 está roto desde hace 20 años. Migrar a `password_hash` / `password_verify`. | `mdl-*:264, 275` ; `ctrl-*:211, 240` |
| 3 | 🔴 Alto | **`init()` ignora `$subsidiaries_id` parametrizado.** Pasa `$_SESSION['SUB']` a `lsCashShifts`, pero `getActiveShifts` lo lee de `$_POST` sin revalidar contra sesión. | `ctrl-*:11-12, 21` |
| 4 | 🔴 Alto | **`lsSucursales` no filtra por permiso del usuario.** Devuelve todas las activas. | `mdl-*:14-22` |
| 5 | 🔴 Alto | **`updateVenta` confía 100% en `$_POST`.** `$this->util->sql($_POST, 1)` sin whitelist de columnas. Un POST puede mutar `total_pay`, `status`, etc. | `ctrl-*:190` |
| 6 | 🟡 Medio | **Mezcla de naming inconsistente.** `subsidiaries`, `order_payments`, `order_products`, `pedidos_id`, `usr_users` mezclan plural y español, violando db-rules §2.1 y §2.2. | múltiples |
| 7 | 🟡 Medio | **`order_package.pedidos_id` es deuda visible.** FK en español plural dentro de tabla en inglés singular. | `mdl-*:173` |
| 8 | 🟡 Medio | **`getVentaPagos` falsea datos.** `op.pay AS tendered_amount, 0 AS change_amount`. El ticket reimpreso muestra siempre cambio = 0. | `mdl-*:184-185` |
| 9 | 🟡 Medio | **`reprintTicket` recalcula totales mal.** Ignora `descuento` real guardado y lo recalcula desde `it.discount`. | `js:526-528` |
| 10 | 🟢 Bajo | **`fayxzvov_alpha` hardcodeado** mientras `fayxzvov_reginas` viene de `$this->bd`. Inconsistente para multi-tenant. | `mdl-*:19, 150` |
| 11 | 🟢 Bajo | **`status` como TINYINT mágico (1..4)** repartido entre PHP/SQL/JS. db-rules §6 recomienda catálogo + FK. | tres capas |
| 12 | 🟢 Bajo | **Código muerto.** `let turno, subsidiaries_id` globales sin uso; `window.updateSession = () => {}` stub. | `js:4, 6, 29` |

### 1.3 Modelo de datos implícito

| Tabla actual | Esquema | Clase | Nombre correcto | Notas |
|---|---|---|---|---|
| `order` | reginas | transacción raíz | `order` | OK (singular inglés). |
| `order_clients` | reginas | sub-catálogo | `client` | Plural innecesario; sub-catálogo no necesita prefijo `order_`. |
| `order_payments` | reginas | detalle | `detail_order` | Plural + sin prefijo `detail_`. Faltan columnas `tendered_amount`, `change_amount`. |
| `order_package` | reginas | detalle | `detail_order_item` | FK `pedidos_id` debe ser `order_id`. |
| `order_products` | reginas | catálogo | `product` | Plural + prefijo `order_` que sobra. |
| `method_pay` | reginas | catálogo | `payment_method` | Orden de palabras invertido. |
| `cash_shift` | reginas | transacción raíz | ✅ | Bien nombrada. |
| `daily_closure` | reginas | transacción raíz | ✅ | Bien nombrada (FK `daily_closure_id`). |
| `subsidiaries` | alpha | maestro corporativo | `subsidiary` | Plural — deuda histórica cross-schema. |
| `usr_users` | alpha | maestro corporativo | `user` | Prefijo `usr_` redundante. |
| `usr_rols` | alpha | maestro corporativo | `role` | Idem + `rols` mal escrito (debería ser `roles`). |

**Montos:** los casts a `(float)` sugieren que `total_pay`, `discount`, `pay` están en `DOUBLE` (correcto según convención de la casa, §4).

**Faltante grave vs db-rules:** el estado de `order` debería ser un catálogo `order_status` + FK, no TINYINT con map duplicado en tres capas.

### 1.4 Top 5 fixes técnicos priorizados

1. **Whitelist de `opc` + migrar MD5 a `password_hash`.** Las dos vulnerabilidades reales del módulo. Sin esto, lo demás es cosmético.
2. **Sanear `editVenta`.** Whitelist de columnas editables o eliminar el endpoint si solo se usa para casos específicos.
3. **Crear catálogo `order_status`** con FK desde `order.status`. Elimina el mapa duplicado en PHP/SQL/JS.
4. **Renombrar `order_package.pedidos_id` → `order_id`** en un `ALTER` con downtime planeado. Deuda visible.
5. **Limpiar globals muertos en JS y exponer `tendered_amount`/`change_amount` reales** en `order_payments` o documentar que no existen.

---

## 2. Revisión funcional

### 2.1 ¿Qué hace el módulo?

Es la **bitácora de ventas del punto de venta** de Reginas. Permite a cajero / encargado de turno / gerente revisar todas las cuentas que se cerraron (o están abiertas) en una sucursal, ver el detalle de cada una (productos, pagos, cliente, totales) y ejecutar acciones administrativas: cancelar una venta, reabrirla para edición o reimprimir su ticket. Es la pantalla a la que llegan cuando un cliente regresa, cuando hace falta auditar un turno o cuando un cajero metió mal un cobro.

### 2.2 Funcionalidades implementadas

- **Filtro por periodo:** turno actual (default), día específico, o rango de fechas con presets (Hoy, Ayer, Semana, Mes actual, Mes anterior).
- **Filtro por turno de caja abierto** cuando el periodo es "Turno actual".
- **Filtro por estatus**: Pendiente / En proceso / Pagado / Cancelado / Todos.
- **Tabla paginada** (15/pág) con Folio, Cliente, Estatus, Fecha, Total, Descuento y badges de métodos de pago.
- **KPIs de cabecera:** total de ventas, monto total (excluye canceladas), descuentos, conteo de canceladas.
- **Panel lateral de detalle** (~420px) con cliente, fecha/hora, sucursal, turno (abierto/cerrado), items con precio unitario y subtotal, nota, métodos de pago desglosados, subtotal/descuento/total.
- **Cancelación con doble factor** (usuario + clave de admin rol 1), registra `cancelled_at` + `cancelled_by`.
- **Reapertura** (solo clave de admin) que regresa a estado "En proceso" (2) y limpia los campos de cancelación.
- **Reimpresión de ticket** generando HTML imprimible en ventana nueva (formato térmico 280px) con marca "*** Reimpresión ***".
- **Footer dinámico** que reporta cuántas ventas se están mostrando.

### 2.3 Lo que funciona bien (UX)

- **Default "turno actual"** — decisión correcta: es lo que el cajero ve el 90% del tiempo.
- **Panel lateral > modal** — permite auditar venta tras venta sin abrir/cerrar diálogos.
- **Dos modalidades de autorización**: cancelar pide usuario+clave (rastro), reabrir solo clave (menos fricción). Distinción acertada.
- **Botones se deshabilitan** cuando la venta ya está cancelada (`cursor-not-allowed`).
- **Badges de método de pago** dan golpe de vista del mix sin abrir el detalle.
- **KPIs excluyen canceladas** del monto total — coincide con la realidad de negocio.
- **Items con descuento resaltados** en amarillo, precio bruto tachado + neto. Clarifica al gerente.
- **Ticket reimpreso indica "Reimpresión"** — buena práctica anti-fraude.

### 2.4 Funcionalidades incompletas / ausentes

- **No hay búsqueda libre.** Cliente que llega diciendo "soy Juan Pérez" → toca scrollear.
- **No hay filtro por método de pago.** "Dame todas las ventas en tarjeta del día" imposible sin exportar.
- **No hay filtro por cajero ni por cliente.** Auditoría "cuánto vendió María hoy" no es posible.
- **No hay filtro por monto** (min/max). Detectar tickets atípicos requiere ojo.
- **No hay exportación a Excel/PDF** ni botón de imprimir el listado. Reportes a contabilidad → screenshot.
- **No hay devoluciones ni reembolsos.** Solo existe "cancelar todo o nada". Ni nota de crédito ni refund.
- **No hay motivo de cancelación.** Se registra quién y cuándo, pero no por qué.
- **No se ve en UI quién canceló** aunque `cancelled_by` se guarda.
- **No hay registro de quién reabrió.** La reapertura limpia `cancelled_at`/`cancelled_by` sin rastro — **agujero de auditoría**.
- **No hay bloqueo si el turno ya cerró.** El detalle muestra `turnoCerrado: true/false` pero permite cancelar igual.
- **Sin comparativos** vs ayer / semana / mes anterior.
- **Sin gráficas** (ventas por hora, ticket promedio, top productos).
- **Sin paginación infinita ni virtualización.** Con 300 ventas, el cajero pagina 20 veces.
- **Refacturación ausente.** Cliente que pide factura post-venta no tiene flujo aquí.
- **Filtros no recuerdan estado.** Refrescar la página vuelve todo a "Turno actual".
- **"Pendiente" vs "En proceso"** no es obvio cuál es cuál en POS. Falta documentación visual.
- **Reimpresión no queda registrada.** Vector de uso indebido.
- **Sucursal no es filtrable** desde la UI aunque el usuario tenga acceso a varias.

### 2.5 Casos de uso reales: cubiertos vs no

| Escenario | ¿Cubierto? |
|---|---|
| "Cobré mal a un cliente, necesito cancelar la venta" | ✅ Sí — flujo con admin. |
| "Cliente regresa y pide su ticket" | ✅ Sí — reimpresión funciona. |
| "Cliente devuelve 1 de 3 productos" | ❌ No — solo cancelación total. |
| "Cliente regresa al día siguiente con devolución" | ⚠️ Parcial — se puede cancelar pero el turno ya cerró y no hay control. |
| "Auditoría fin de mes: canceladas con motivo" | ❌ No — sin campo de motivo ni filtro de auditoría. |
| "Qué cajero canceló más ventas este mes" | ❌ No — el cajero no se muestra ni se filtra. |
| "Cliente pide factura de venta de la semana pasada" | ❌ No — sin refacturación. |
| "Cuántas ventas en efectivo vs tarjeta hoy" | ⚠️ Parcial — se ven badges pero no se filtran ni totalizan. |
| "Reporte de ventas del mes en Excel para contabilidad" | ❌ No — sin exportación. |
| "Buscar venta por nombre de cliente" | ❌ No — sin búsqueda libre. |
| "Ver ventas de otra sucursal sin cambiar de sesión" | ❌ No — sucursal de sesión. |

### 2.6 Top 5 mejoras funcionales

1. **Búsqueda libre + motivo de cancelación + auditoría de reapertura.** Las tres juntas son la diferencia entre "historial bonito" e "historial confiable" de POS retail serio. Base de cualquier solución madura.
2. **Devoluciones parciales / nota de crédito.** Hoy es "cancelar todo o nada" → obliga a recobrar manual. Es el flujo retail más común de toda tienda física. Una acción "Devolver items" en el panel lateral, con selección granular, abriría todo el escenario.
3. **Exportación a Excel + reporte imprimible del listado.** Contabilidad y dirección piden CSVs semanales. Sin esto el módulo se usa para consulta visual pero nunca como fuente de verdad.
4. **Filtros adicionales** (cajero, método de pago, cliente, monto min/max) **+ persistencia en localStorage.** Habilita auditorías granulares sin tener que entrar a la BD.
5. **Comparativo vs periodo anterior + ticket promedio + ventas por hora.** Convierte la bitácora en dashboard operativo. Un encargado de turno entra y en 5 segundos sabe si va arriba o abajo del comparable.

---

## Archivos analizados

- `app/pos/pos-historial-ventas.php`
- `app/pos/ctrl/ctrl-pos-historial-ventas.php`
- `app/pos/mdl/mdl-pos-historial-ventas.php`
- `app/pos/src/js/pos-historial-ventas.js`
- `C:/Users/CoffeSoft/.claude/agents/grimorios/db-rules.md` (referencia de convenciones)
